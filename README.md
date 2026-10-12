# a2z-react-apps

The **Smart Form Builder**, the **Collaboration panel** and the **MIS Reports** in one React project,
loaded into the JSP pages through **one `loader.js`**. Each component is downloaded only when it is used:

| Component | Name | When it is loaded | Code |
|---|---|---|---|
| Smart Form Builder | `formBuilder` | page has `#dynamic-form-react-root` (DynamicFormMenu.jsp) | `src/apps/form-builder/` |
| Collaboration panel | `collab` | in the background once the page is idle; opened by the collaboration icon | `src/apps/collab/` |
| MIS Reports | `reports` | page has `#a2z-reports-root` (newMisReports.jsp) | `src/apps/reports/` |

Details: [docs/form-builder.md](docs/form-builder.md), [docs/collaboration.md](docs/collaboration.md),
[docs/reports.md](docs/reports.md).

## Server addresses: `src/config/commonURLConstants.js`

Every address the apps use is in this one file:

| Constant | Used for | Development value |
|---|---|---|
| `APP_BASE_URL` | MVC application (collaboration API) when the page does not give its own address | `http://localhost:8085/a2zproduct` |
| `REPORTS_API_URL` | iconnector service: MIS reports API | `http://localhost:9595` |
| `WEBSERVICE_URL` | web service (form builder departments) when the page has no `var webserviceUrl` | empty (the page's value) |
| `DEV_SERVER_PORT` / `DEV_SERVER_URL` | Vite dev server (`npm run dev`) | `5173` / `http://localhost:5173` |
| `APP_STYLESHEET_PATH` | standalone page only: the application's `style_new.css` inside `APP_BASE_URL` | `/resources/css/style_new.css` |

**Deploying:** set the production values in `commonURLConstants.js`, run `npm run build`, copy `dist/`.

## Project structure

    src/config/commonURLConstants.js   all server addresses
    index.html, src/standalone/        standalone page (npm run dev), not part of the build
    src/entry.js                       list of components; each one is a lazy import()
    src/apps/form-builder/             Smart Form Builder
    src/apps/collab/                   Collaboration panel
    src/apps/reports/                  MIS Reports (analytics-dashboard frontend)
    loader/loader.template.js          the loader (becomes dist/loader.js)
    jsp/resource-caching.xml           Spring MVC caching for the built files
    vite.config.js                     build: entry + one chunk per component + shared React chunk

## Build and deploy

    npm install
    npm run build

    dist/loader.js                         the only file the JSPs reference (serve with no-cache)
    dist/a2z-react.<hash>.js               entry
    dist/chunks/react.<hash>.js            React (shared)
    dist/chunks/form-builder.<hash>.js/.css
    dist/chunks/collab.<hash>.js/.css
    dist/chunks/reports.<hash>.js/.css
    dist/chunks/reports-vendor.<hash>.js   ECharts + PapaParse, reports page only

Copy the whole `dist/` folder (with `chunks/`) to `src/main/webapp/resources/react/a2z/`, or build straight there:

    OUT_DIR=../MyApp/src/main/webapp/resources/react/a2z npm run build

Add `jsp/resource-caching.xml` to the Spring MVC config: `loader.js` is never cached, every other file
(content-hashed names) is cached for a year. All files are pure ASCII (the pages are ISO-8859-1).

## JSP changes

### Common header (newSearchHeader.jsp / headerDept.jsp), once

```jsp
<script nonce="${nonToken}">
  (function () {
    var DEV = true; // false in QA / production
    var LOADER_URL = DEV
      ? 'http://localhost:5173/loader.js'
      : '${pageContext.request.contextPath}/resources/react/a2z/loader.js';

    var s = document.createElement('script');
    s.src = LOADER_URL;
    s.setAttribute('nonce', '${nonToken}');
    s.setAttribute('data-collab-trigger', '#collaborationSlideId a');
    document.head.appendChild(s);
  })();
</script>
```

This is the one address outside `commonURLConstants.js`: the loader is what loads React, so the page has to
know where it is. In production it is the application's own `/resources` folder.

The collaboration panel reads the page globals `window.contextPath`, `getCollaborationId()`,
`getCollaborationContext()`, `getCollaborationLabel()`, `getActiveModule()`, `N_USER_ID`, `N_USER_TYPE`,
`COLLAB_DEPT_ID` when it opens. The unread badge `#collabUnreadCount` is refreshed every 30 s.

### DynamicFormMenu.jsp

```jsp
<div id="dynamic-form-list-data" hidden> ... ${dynamicFormList} ... </div>
<div id="dynamic-form-react-root"
     data-context-path="${pageContext.request.contextPath}"
     data-org-id="${orgId}"
     data-webserviceurl="${sessionScope.webserviceUrl}"></div>
```

### newMisReports.jsp

```jsp
<div id="a2z-reports-root"></div>
```

The reports address comes from `REPORTS_API_URL`: no `data-api-base`, no controller change.
Optional: `data-height="calc(100vh - 180px)"` when the header is taller than 140px.
If the page does not include the common header, add the loader script above to it as well
(loading it twice is harmless).

### Content-Security-Policy

- Production: nothing new for the scripts (the loader and every chunk carry the nonce).
- `connect-src` must allow the `REPORTS_API_URL` address (reports page).
- Development: allow `http://localhost:5173` in `script-src` and `style-src`, and `ws://localhost:5173`
  in `connect-src`.

## Development

    npm install
    npm run dev           # serves loader.js on http://localhost:5173 with hot reload

Keep `var DEV = true` in the header script: the JSP pages on Tomcat then load the live code. API calls still go
to Tomcat / iconnector. The same `npm run dev` also serves the standalone page (next section).

## Run standalone (without a JSP)

    npm install
    npm run dev           # open http://localhost:5173

The standalone page has the Smart Form Builder and MIS Reports as tabs, and a Collaboration button.

- **Log in first:** sign in to the MVC application (`APP_BASE_URL`, e.g. http://localhost:8085/a2zproduct) in the
  same browser, or use the "Log in to the application" link. The dev server forwards every request under the
  context path (`/a2zproduct/...`) to `APP_BASE_URL`, so the form builder and collaboration use that login
  session. Collaboration's websocket goes through the same proxy.
- **Settings:** the button in the top bar holds what a JSP page normally provides: organisation ID, web service
  URL (form builder departments), JWT token, user ID / type, and the collaboration tender / module IDs.
  They are saved in this browser for the standalone page only.
- **Reports:** call `REPORTS_API_URL` directly, as in the JSP.
- **Stylesheet:** the application's `style_new.css` is loaded from the running MVC app (`APP_STYLESHEET_PATH`).
- **Form library:** the list of existing forms comes from the JSP, so standalone it starts empty.
  New forms can be created and saved.

`npm run build` is not affected: the standalone page is not part of `dist/`.

## JavaScript API

```js
A2ZReact.open('collab');                                // context from the page globals
A2ZReact.open('collab', { sessionId: '4821', sessionType: 'tenderId', moduleId: '7' });
A2ZReact.close('collab');
A2ZReact.mount('formBuilder');                          // into #dynamic-form-react-root
A2ZReact.mount('reports');                              // into #a2z-reports-root
A2ZReact.preload('collab');
A2ZReact.refreshCollabBadge();
```

Old names keep working: `DynamicFormLoader.load()` / `.open()`, `CollabApp.open(config)` / `.close()`.

Loader attributes (optional): `data-app-url`, `data-collab-trigger` (`none` disables it), `data-collab-badge`,
`data-form-root`, `data-reports-root`, `data-dfb-app-css`, `data-autoload="false"`,
`data-preload` (`idle` default, `intent`, `none`).

## Adding another component

1. Create `src/apps/<name>/index.jsx` exporting `mount(el, config)` and/or `open(config)` and `close()`.
2. Register it in `src/entry.js` and add its chunk name to `COMPONENT_CHUNKS` / `chunkFor()` in `vite.config.js`.
3. Server addresses go into `src/config/commonURLConstants.js`.
