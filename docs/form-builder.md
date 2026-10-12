# Smart Form Builder

Part of **a2z-react-apps** (see the main README for how it is built and loaded).
Code: `src/apps/form-builder/`. Mounted into `#dynamic-form-react-root` on DynamicFormMenu.jsp.

React is only the UI. It talks to the existing endpoints: no new controllers, services, tables or URLs.
`DynamicFormBuilder.jsp` / `DynamicFormBuilder.js` are no longer opened from the menu.
`CreateFormula.jsp` / `createFormula.html` are no longer linked either: formulas are built in the "Formulas" tab.

## Styling: the application's own CSS

Fields, data grids, cards, headers, buttons, the pager and the layout popup use the classes from
the application's `style_new.css`, the same ones the old JSPs and the runtime renderer use:
`form-controls`, `tHeader`/`tHeaderLeft`, `form-group`, `form-control`, `mandatory`,
`radio-container`, `dateIcon`, `fileInputGroup-icon`, `tablesorter-blue`, `TextHead`, `tdCenter`,
`Button`, `ButtonSmall`, `pager`, `popup`/`popupContent`/`popupHeader`.

React does not copy those rules. The page already loads `style_new.css` through the header, so
the builder always matches the application, including future changes to that file.
`src/apps/form-builder/styles/dfb.css` only styles the builder's own layout (element panel, canvas, properties panel,
drag indicators) and takes its colours from the `:root` variables in `style_new.css`
(`--primary-color`, `--text-primary`, `--border-color`, ...).

- A page that does not load `style_new.css` can pass `data-dfb-app-css` to the loader script;
  the loader adds it (with the nonce) only if it is not already on the page.
- `.form-control` in `style_new.css` fixes the height with `!important`, so textareas are one line
  high in the application. The canvas and preview show them the same way, and the builder no longer
  offers a "visible rows" setting that the stylesheet would override.
- Checkbox groups use `.dfb-check-group`, a square version of `.radio-container`
  (whose `label::before` would otherwise draw radio circles on checkboxes).

## Formulas (inside the builder)

The "Formulas" tab (next to Build and Preview) replaces `CreateFormula.jsp` / `createDynamicFormFormula.js`.
The "Create Formula" icon was removed from the list page; "Preview Formula" stays.

Saved format and requests are the same as the old page:
- `formula` = HTML-encoded `"Result = expression"` (e.g. `Total = Base Price&gt;=Tax`), plus `formulaName` and
  `dependencies`, on the number component or section column. `dependencies` uses the old algorithm.
- `updateFormulaDetails` receives the same payload for save, update and delete.
- That endpoint stores the whole form JSON, so pending form changes are saved through `saveFormData.html` first
  (a new form is created on the first formula save), then the formula request uses the returned form ID.
- The regular "Save Form" keeps the formula keys.

Behaviour differences from the old page:
- Comparison formulas such as `Result = A >= B` validate correctly (the old `splitFormula` threw on them).
- The preview calculator uses a small built-in evaluator instead of `eval()` / math.js from a CDN (CSP-safe).
- Keyboard entry works while the formula box has focus, not globally on the page.
- Formulas refer to fields by label: the properties panel shows which formulas use a field, and deleting such a
  field asks for confirmation.

Formulas in Preview (same rules as the old runtime in DynamicFormBuilder.js):
- Calculation formulas (`Total = Base*Fixed`): the result field is read-only ("Auto-Calculated"), filled when all
  inputs have values, rounded to 3 decimals, in dependency order (chains work).
- Comparison formulas (`Number = Number<=Total`): the field stays editable and shows "✓ Condition satisfied" or
  "✗ Condition not satisfied"; Check Answers counts an unsatisfied condition as an error.
- Input-table column formulas are applied per row.

Saving is verified: after `updateFormulaDetails` replies, the form is re-read with `getDynamicFormDetails.html`.
The formula list shows what is really stored. If the formula is missing from the stored form, an error is shown
and the request/response are logged in the browser console with the prefix `[SmartForms]`.

Files: `src/apps/form-builder/model/formula.js` (logic + runtime), `src/apps/form-builder/components/FormulaWorkspace.jsx` (UI),
`src/apps/form-builder/components/Preview.jsx` and `src/apps/form-builder/components/FieldControl.jsx` (formulas while filling in).

## Dynamic dropdowns (API) and Signature

Both are in the element panel (Basic elements).

### Dynamic Dropdown
Options come from an API. Use it for any linked lists: State -> District -> Mandal,
Tender category -> Evaluation type, and so on. Settings (Data source tab, or the column settings in an input table):

- **API URL**: paste the full URL. `{name}` placeholders are filled from parameters (path values);
  `{webserviceUrl}` is replaced by the web service address of the page (`var webserviceUrl`,
  else `WEBSERVICE_URL` in `src/config/commonURLConstants.js`).
- **Method**: GET (parameters in the query string) or POST (parameters as a JSON body).
- **Send login token**: adds `Authorization: Bearer <localStorage JWT_TOKEN>`.
- **Parameters** (any number): name, and where the value comes from:
  another form field (e.g. `stateId` from State), another column of the same table row, or a fixed value.
  Required parameters keep the dropdown disabled ("Select State first") until they have a value.
- **Response**: list path (e.g. `data`, `result.items`, empty = detect), value key, label key.
- **Test API**: calls the API with test values, detects the list and keys, shows the first options.

When a field changes, every dropdown that loads from it (directly or through others) is cleared and reloaded,
in form fields and in table rows.

Saved format (unknown to an old runtime it still renders as a normal empty dropdown):
```json
{ "type": "select", "options": [{ "value": "", "label": "-Select-", "isPlaceholder": true, "selected": true }],
  "dataSource": { "url": "{webserviceUrl}/master/districts", "method": "GET", "sendToken": true,
    "params": [{ "name": "stateId", "source": "field", "field": "<id of State>", "required": true }],
    "listPath": "data", "valueKey": "districtId", "labelKey": "districtName", "placeholder": "-Select-" } }
```
Table columns: `inputType: "dropdown"` + the same `dataSource`; `source: "column"` params store the column header
(renaming a column updates the links). Links to form fields use the field id, so renaming labels is safe.

Calls go from the browser: the API must allow the app's origin (CORS) and be allowed by the page's
Content-Security-Policy `connect-src`.

### Signature
`{ "type": "signature", "required": "yes|no", "penColor": "#000000", "height": "160" }`.
The filled value is a PNG data URL (`data:image/png;base64,...`).

### Filling page (runtime)
The builder's Preview implements both. The page where bidders/departments fill the saved form
(DynamicFormBuilder.js / PreviewFormTest.js) must also support `dataSource` and `type: "signature"`;
the logic in `src/apps/form-builder/model/dynamicSource.js` (buildRequest, parseOptions, dependentsOf) is framework-free and can be reused there.

## Endpoints used (all existing, same request shapes as DynamicFormBuilder.js)

| Action | Endpoint | Request |
|---|---|---|
| Save / update | `saveFormData.html` | form-urlencoded: `jsonFormData, formName, department, formID, orgID` (`formID` empty = create) |
| Load for edit / clone | `getDynamicFormDetails.html` | JSON `{ hdnFormIdValue }` -> `sDynamicXML` |
| Departments | `{webserviceurl}/departments/topLevelDepartments` | JSON `{ nOrgID }`, Bearer `token` |
| Save / update formula | `updateFormulaDetails` | JSON `{ jsonData, hdnFormIdValue, formulaData:{fieldName, formula, isSectionField, dependencies, formulaId}, isUpdate, isSection }` |
| Delete formula | `updateFormulaDetails` | JSON `{ jsonData, hdnFormIdValue, deleteFormula: true, formulaId }` |
| Preview formula (list page) | `textDynamicForm.html` | POST `hdnFormIdValue`, unchanged |

## Saved JSON

Identical shape and key order to the old save button:
`formId, formTitle, formLayout, formName, components, sections, layoutOrder, metadata`.
Only types the runtime renderer supports are written:
`text, textarea, number, select, radio, checkbox, date, file, richtext` and grid `sections`.

Differences from the old builder (all additive, no breaking change):
- Field IDs are kept when a form is edited (the old save regenerated them, which broke formula references).
- Unknown keys on components (e.g. `formula`, `dependencies`) are preserved on re-save.
- File fields also write `minSize` / `maxSize` (MB), which the runtime validator reads.
  `min` / `max` are still written as before.

## Where things live

    src/apps/form-builder/api/dynamicFormApi.js   existing endpoints (uses the page's jQuery.ajax)
    src/apps/form-builder/api/alerts.js           reuses commonSwalAlert.js / SweetAlert2
    src/apps/form-builder/model/schema.js         load/save conversion + the old validation rules
    src/apps/form-builder/model/fieldCatalog.js   element list and how each maps to a saved type
    src/apps/form-builder/pages/                  FormLibrary, FormBuilder
    src/apps/form-builder/components/             Canvas, ElementPanel, PropertiesPanel, Editors, Preview, FieldControl
