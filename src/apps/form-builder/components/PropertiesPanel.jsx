import React, { useEffect, useState } from 'react';
import Icon from './Icon';
import { describeItem } from '../model/fieldCatalog';
import { USER_GROUPS, validateTitle } from '../model/schema';
import { Field, Toggle, PatternSelect, Segmented, RichTextEditor, OptionsEditor, SectionEditor } from './Editors';
import DynamicSourceEditor from './DynamicSourceEditor';
import { isDynamic, dependentsOf, parentFields, columnsUsingField } from '../model/dynamicSource';


function linkableFields(items, selfId) {
  const comps = items.filter((i) => i.kind === 'component' && i.comp.type !== 'richtext').map((i) => i.comp);
  const blocked = new Set(selfId ? [selfId, ...dependentsOf(selfId, comps)] : []);
  return comps
    .filter((c) => !blocked.has(c.id) && !['file', 'signature'].includes(c.type))
    .map((c) => ({ id: c.id, label: c.label || '(no label)', dynamic: isDynamic(c) }));
}

const LAYOUTS = [
  { value: '1', label: 'One column' },
  { value: '2', label: 'Two column' },
  { value: '3', label: 'Three column' },
];

export default function PropertiesPanel({
  item, state, dispatch, departments, department, setDepartment, formId, titleError, onOpenFormulas, formulaUsage = {}, open, onClose,
}) {
  return (
    <aside className={`dfb-props${open ? ' is-open' : ''}`} aria-label="Properties">
      <div className="dfb-props-head">
        <div>
          <h2>{item ? describeItem(item) : 'Form settings'}</h2>
          {item && <p>{item.kind === 'section' ? item.sec.tableId : item.comp.id}</p>}
        </div>
        <div className="dfb-row">
          {item && (
            <button type="button" className="dfb-link-btn" onClick={() => dispatch({ type: 'SELECT', key: null })}>
              Form settings
            </button>
          )}
          <button type="button" className="dfb-icon-btn dfb-only-narrow" onClick={onClose} aria-label="Close properties">
            <Icon name="close" />
          </button>
        </div>
      </div>
      {!item ? (
        <FormSettings {...{ state, dispatch, departments, department, setDepartment, formId, titleError, onOpenFormulas }} />
      ) : item.kind === 'section' ? (
        <SectionEditor sec={item.sec} formulaUsage={formulaUsage} formFields={linkableFields(state.items, null)}
          onChange={(sec) => dispatch({ type: 'UPDATE_SECTION', key: item.key, sec })} />
      ) : (
        <ComponentProps key={item.key} item={item} items={state.items} dispatch={dispatch} formulaUsage={formulaUsage} onOpenFormulas={onOpenFormulas} />
      )}
    </aside>
  );
}

function FormSettings({ state, dispatch, departments, department, setDepartment, formId, titleError, onOpenFormulas }) {
  const [touched, setTouched] = useState(false);
  const err = (titleError || touched) ? validateTitle(state.title) : '';
  const fields = state.items.filter((i) => i.kind === 'component' && i.comp.type !== 'richtext').length;
  const tables = state.items.filter((i) => i.kind === 'section').length;
  const numbers = state.items.filter((i) => i.kind === 'component' && i.comp.type === 'number').length
    + state.items.filter((i) => i.kind === 'section').reduce((n, i) => n + (i.sec.tableColumns || []).filter((c) => c.inputType === 'number').length, 0);
  const formulaCount = state.items.filter((i) => i.kind === 'component' && i.comp.formula).length
    + state.items.filter((i) => i.kind === 'section').reduce((n, i) => n + (i.sec.tableColumns || []).filter((c) => c.formula).length, 0);

  return (
    <div className="dfb-props-body">
      <Field label="Form title" error={err} >
        <input className={`form-control${err ? ' is-invalid' : ''}`} value={state.title} maxLength={60}
          onBlur={() => setTouched(true)}
          onChange={(e) => dispatch({ type: 'SET_TITLE', title: e.target.value })} />
      </Field>
      <Field label="Department">
        <select className="form-control" value={department} onChange={(e) => setDepartment(e.target.value)}>
          <option value="">Select Department</option>
          {departments.map((d) => (
            <option key={d.nDepartmentID} value={String(d.nDepartmentID)}>{d.sDepartmentName}</option>
          ))}
        </select>
      </Field>
      <div className="dfb-prop">
        <span className="dfb-prop-label">Layout</span>
        <Segmented label="Layout" value={state.layout} options={LAYOUTS} onChange={(layout) => dispatch({ type: 'SET_LAYOUT', layout })} />
        {/* <span className="dfb-help">Fields per row when the form is filled in. Text blocks and tables always use the full width.</span> */}
      </div>

      <dl className="dfb-stats">
        <div><dt>Fields</dt><dd>{fields}</dd></div>
        <div><dt>Tables</dt><dd>{tables}</dd></div>
        <div><dt>Form ID</dt><dd>{formId || 'Not saved yet'}</dd></div>
      </dl>

      <div className="dfb-prop">
        <span className="dfb-prop-label">Formulas</span>
        <button type="button" className="ButtonSmall dfb-small" onClick={onOpenFormulas}>
          <Icon name="formula" size={15} /> Open Formulas{formulaCount ? ` (${formulaCount})` : ''}
        </button>
        <span className="dfb-help">
          {numbers === 0 ? 'Formulas calculate Number fields. Add a Number field first.' : 'Create, edit, preview and delete formulas for this form.'}
        </span>
      </div>
    </div>
  );
}

function ComponentProps({ item, items = [], dispatch, formulaUsage = {}, onOpenFormulas }) {
  const c = item.comp;
  const dynamic = isDynamic(c);
  const [tab, setTab] = useState(dynamic ? 'source' : 'general');
  const up = (patch) => dispatch({ type: 'UPDATE_COMPONENT', key: item.key, patch });
  const hasValidation = c.type !== 'richtext' && !['select', 'radio', 'checkbox', 'signature'].includes(c.type);
  const comps = items.filter((i) => i.kind === 'component').map((i) => i.comp);

  const linkedBy = [
    ...comps.filter((x) => isDynamic(x) && parentFields(x.dataSource).includes(c.id)).map((x) => x.label),
    ...columnsUsingField(c.id, items.filter((i) => i.kind === 'section').map((i) => i.sec)).map((x) => `${x.column} (table)`),
  ];
  const tabs = [
    { value: 'general', label: 'General' },
    ...(dynamic ? [{ value: 'source', label: 'Data source' }] : []),
    ...(hasValidation ? [{ value: 'validation', label: 'Validation' }] : []),
    ...(c.type !== 'richtext' ? [{ value: 'style', label: 'Label style' }] : []),
  ];
  useEffect(() => { if (!tabs.some((t) => t.value === tab)) setTab('general'); }); // eslint-disable-line

  return (
    <div className="dfb-props-body">
      {tabs.length > 1 && <Segmented label="Property group" value={tab} options={tabs} onChange={setTab} />}

      {tab === 'general' && (
        <>
          <Field label={c.type === 'richtext' ? 'Block name' : 'Field label'}
            help={c.type === 'richtext' ? 'Only shown in the builder.' : undefined}>
            <input className="form-control" value={c.label || ''} maxLength={80} onChange={(e) => up({ label: e.target.value })} />
          </Field>
          {c.type === 'number' && (() => {
            const users = formulaUsage[String(c.label || '').toLowerCase()] || [];
            if (!users.length && !c.formula) return null;
            return (
              <div className="dfb-formula-note" role="note">
                {c.formula && <div><b>Calculated by formula.</b></div>}
                {users.length > 0 && <div>Used in: {users.join(', ')}.</div>}
                <div>Formulas refer to fields by label. After renaming, update those formulas.</div>
                <button type="button" className="dfb-link-btn" onClick={onOpenFormulas}>Open Formulas</button>
              </div>
            );
          })()}

          {c.type === 'richtext' && (
            <RichTextEditor itemKey={item.key} value={c.content} onChange={(content) => up({ content })} />
          )}

          {c.type !== 'richtext' && (
            <Toggle label="Required"  checked={c.required === 'yes'}
              onChange={(v) => up({ required: v ? 'yes' : 'no' })} />
          )}

          {(c.type === 'text' || c.type === 'textarea') && (
            <Field label="Placeholder">
              <input className="form-control" value={c.placeholder || ''} onChange={(e) => up({ placeholder: e.target.value })} />
            </Field>
          )}

          {c.type === 'number' && (
            <div className="dfb-prop">
              <span className="dfb-prop-label">Filled by</span>
              <Segmented label="Filled by" value={c.userGroupType || '103'} options={USER_GROUPS} onChange={(v) => up({ userGroupType: v })} />
            </div>
          )}

          {['select', 'radio', 'checkbox'].includes(c.type) && !dynamic && (
            <OptionsEditor comp={c} onChange={(options) => up({ options })} />
          )}

          {dynamic && (
            <div className="dfb-formula-note" role="note">
              Options load from {c.dataSource.url ? 'the API' : 'an API (not set yet)'}.
              <button type="button" className="dfb-link-btn" onClick={() => setTab('source')}>Edit data source</button>
            </div>
          )}
          {!dynamic && linkedBy.length > 0 && (
            <div className="dfb-formula-note" role="note">Linked: {linkedBy.join(', ')} reload when this value changes.</div>
          )}

          {c.type === 'signature' && (
            <>
              <div className="dfb-prop">
                <span className="dfb-prop-label">Pen colour</span>
                <Segmented label="Pen colour" value={c.penColor || '#000000'}
                  options={[{ value: '#000000', label: 'Black' }, { value: '#0b3d91', label: 'Blue' }]}
                  onChange={(v) => up({ penColor: v })} />
              </div>
              <div className="dfb-prop">
                <span className="dfb-prop-label">Pad height</span>
                <Segmented label="Pad height" value={String(c.height || '160')}
                  options={[{ value: '120', label: 'Small' }, { value: '160', label: 'Medium' }, { value: '220', label: 'Large' }]}
                  onChange={(v) => up({ height: v })} />
              </div>
              <span className="dfb-help">Saved as a PNG image of the signature.</span>
            </>
          )}

          {c.type === 'file' && (
            <Toggle label="Allow multiple files" checked={c.multiple === 'yes'} onChange={(v) => up({ multiple: v ? 'yes' : 'no' })} />
          )}
        </>
      )}

      {tab === 'source' && dynamic && (
        <>
          <Field label="Field label" help="">
            <input className="form-control" value={c.label || ''} maxLength={80} onChange={(e) => up({ label: e.target.value })} />
          </Field>
          <Toggle label="Required" checked={c.required === 'yes'} onChange={(v) => up({ required: v ? 'yes' : 'no' })} />
        </>
      )}
      {tab === 'source' && dynamic && (
        <DynamicSourceEditor
          uid={c.id}
          ds={c.dataSource}
          context="field"
          fields={linkableFields(items, c.id)}
          usedBy={linkedBy}
          onChange={(dataSource) => up({ dataSource })}
        />
      )}
      {tab === 'validation' && <ValidationProps c={c} up={up} />}
      {tab === 'style' && <LabelStyle c={c} up={up} />}
    </div>
  );
}

const num = (v) => (v === null || v === undefined ? '' : v);

function ValidationProps({ c, up }) {
  if (c.type === 'text' || c.type === 'textarea') {
    return (
      <>
        <Field label="Allowed characters">
          <PatternSelect value={c.pattern || ''} onChange={(v) => up({ pattern: v || null })} />
        </Field>
        <div className="dfb-two">
          <Field label="Min length"><input className="form-control" type="number" min="0" value={num(c.minlength)} onChange={(e) => up({ minlength: e.target.value })} /></Field>
          <Field label="Max length"><input className="form-control" type="number" min="0" value={num(c.maxlength)} onChange={(e) => up({ maxlength: e.target.value })} /></Field>
        </div>
      </>
    );
  }
  if (c.type === 'number') {
    return (
      <>
        <div className="dfb-two">
          <Field label="Minimum"><input className="form-control" type="number" value={num(c.min)} onChange={(e) => up({ min: e.target.value })} /></Field>
          <Field label="Maximum"><input className="form-control" type="number" value={num(c.max)} onChange={(e) => up({ max: e.target.value })} /></Field>
        </div>
        <Field label="Step" help="Leave empty to allow any decimal."><input className="form-control" type="number" min="0" value={num(c.step)} onChange={(e) => up({ step: e.target.value })} /></Field>
      </>
    );
  }
  if (c.type === 'date' || c.type === 'dates') {
    return (
      <>
        <div className="dfb-two">
          <Field label="Earliest date"><input className="form-control" type="date" value={num(c.minDate)} onChange={(e) => up({ minDate: e.target.value })} /></Field>
          <Field label="Latest date"><input className="form-control" type="date" value={num(c.maxDate)} onChange={(e) => up({ maxDate: e.target.value })} /></Field>
        </div>
        <Field label="Date format">
          <select className="form-control" value={c.dateFormat || 'YYYY-MM-DD'} onChange={(e) => up({ dateFormat: e.target.value })}>
            {['YYYY-MM-DD', 'DD-MM-YYYY', 'DD/MM/YYYY'].map((f) => <option key={f}>{f}</option>)}
          </select>
        </Field>
      </>
    );
  }
  if (c.type === 'file') {
    const chips = ['.pdf', '.jpg', '.jpeg', '.png', '.doc', '.docx', '.xls', '.xlsx'];
    const cur = (c.fileTypes || '').split(',').map((s) => s.trim()).filter(Boolean);
    const toggle = (t) => up({ fileTypes: (cur.includes(t) ? cur.filter((x) => x !== t) : [...cur, t]).join(',') || null });
    return (
      <>
        <div className="dfb-prop">
          <span className="dfb-prop-label">Allowed file types</span>
          <div className="dfb-chips">
            {chips.map((t) => (
              <button key={t} type="button" className={`dfb-chip${cur.includes(t) ? ' is-on' : ''}`} aria-pressed={cur.includes(t)} onClick={() => toggle(t)}>{t}</button>
            ))}
          </div>
          <span className="dfb-help">{cur.length ? cur.join(', ') : 'No selection allows any file type.'}</span>
        </div>
        <div className="dfb-two">
          <Field label="Min size (MB)"><input className="form-control" type="number" min="0" value={num(c.min)} onChange={(e) => up({ min: e.target.value })} /></Field>
          <Field label="Max size (MB)"><input className="form-control" type="number" min="0" value={num(c.max)} onChange={(e) => up({ max: e.target.value })} /></Field>
        </div>
      </>
    );
  }
  return null;
}

function LabelStyle({ c, up }) {
  const s = c.labelStyles || {};
  const set = (k, v) => {
    const next = { ...s, [k]: v };
    if (!v) delete next[k];
    up({ labelStyles: next });
  };
  return (
    <>
      <div className="dfb-two">
        <Field label="Size">
          <select className="form-control" value={s.fontSize || ''} onChange={(e) => set('fontSize', e.target.value)}>
            <option value="">Default</option>
            {['12px', '13px', '14px', '16px', '18px', '20px', '24px'].map((v) => <option key={v}>{v}</option>)}
          </select>
        </Field>
        <Field label="Colour">
          <input className="form-control dfb-color" type="color" value={toHex(s.color) || '#1b2540'} onChange={(e) => set('color', e.target.value)} />
        </Field>
      </div>
      <div className="dfb-prop">
        <span className="dfb-prop-label">Emphasis</span>
        <div className="dfb-chips">
          <button type="button" className={`dfb-chip${isBold(s.fontWeight) ? ' is-on' : ''}`} aria-pressed={isBold(s.fontWeight)}
            onClick={() => set('fontWeight', isBold(s.fontWeight) ? '' : '700')}><b>Bold</b></button>
          <button type="button" className={`dfb-chip${s.fontStyle === 'italic' ? ' is-on' : ''}`} aria-pressed={s.fontStyle === 'italic'}
            onClick={() => set('fontStyle', s.fontStyle === 'italic' ? '' : 'italic')}><i>Italic</i></button>
          <button type="button" className={`dfb-chip${s.textDecoration === 'underline' ? ' is-on' : ''}`} aria-pressed={s.textDecoration === 'underline'}
            onClick={() => set('textDecoration', s.textDecoration === 'underline' ? '' : 'underline')}><u>Underline</u></button>
        </div>
      </div>
      <div className="dfb-prop">
        <span className="dfb-prop-label">Alignment</span>
        <Segmented label="Alignment" value={s.textAlign || 'left'} options={[{ value: 'left', label: 'Left' }, { value: 'center', label: 'Centre' }, { value: 'right', label: 'Right' }]}
          onChange={(v) => set('textAlign', v === 'left' ? '' : v)} />
      </div>
      <button type="button" className="dfb-link-btn" onClick={() => up({ labelStyles: {} })}>Reset label style</button>
    </>
  );
}

const isBold = (w) => w === 'bold' || Number(w) >= 600;
function toHex(color) {
  if (!color) return '';
  if (color.startsWith('#')) return color.length === 4 ? '#' + [...color.slice(1)].map((x) => x + x).join('') : color;
  const m = color.match(/\d+/g);
  if (!m || m.length < 3) return '';
  return '#' + m.slice(0, 3).map((n) => Number(n).toString(16).padStart(2, '0')).join('');
}
