# MIS Reports (analytics-dashboard frontend)

Part of **a2z-react-apps** (see the main README for how it is built and loaded).
Code: `src/apps/reports/`. Mounted into `#a2z-reports-root` on `reports/newMisReports.jsp`
(admin dashboard tile "Reports" -> `misReports.html`).

## What was copied, what was changed

The **analytics-dashboard-fe-report-only** project, copied as it is:

    src/apps/reports/
      pages/Dashboard.jsx                     unchanged
      components/*.jsx                        unchanged (ChartRenderer, DashboardControls, DashboardVisualization,
                                              DataTable, SearchableDropdown)
      utils/dashboardConfig.js, dashboardData.js   unchanged
      services/security/reportCrypto.js       unchanged
      services/csv/csvParser.js               unchanged
      styles/*.css                            unchanged
      assets/                                 unchanged
      services/api/dashboardApi.js            ONE change: the API address is REPORTS_API_URL from
                                              src/config/commonURLConstants.js (was VITE_API_BASE_URL in .env)
      index.jsx                               new: replaces main.jsx / embed.jsx (mount / unmount; also sets
                                              window.ReportDashboard like embed.jsx did)
      reports-embed.css                       new: replaces index.css (see below)

When you change the dashboard in its own project, copy the changed files over the ones here.
Keep `dashboardApi.js`'s `REPORTS_API_URL` import and do not copy `index.css`, `main.jsx`, `embed.jsx` or `.env`.

Libraries: ECharts 6 and PapaParse 5 (added to package.json). React stays on the project's React 18:
the dashboard uses no React 19-only API, so all three components share one React.

## Why index.css was replaced

In its own app the dashboard owned the whole page. `index.css` styled `html`, `body`, `button`, `img`,
`h1`-`p`, set `html { font-size: 13px }`, and put all design tokens on `:root`. Inside a JSP that would restyle
the application's header and footer. Also, every `rem` in the dashboard CSS would grow by about 23% at the
JSP's 16px root size.

`reports-embed.css` keeps the dashboard identical without touching the rest of the page:
- The design tokens stay on `:root`, because `ChartRenderer.jsx` reads them from `document.documentElement`.
  The exception is `--shadow-sm` / `--shadow-md`, which `style_new.css` already defines for the application;
  the dashboard's values for those two are set on `.a2z-reports`.
- Everything `html`/`body` gave the dashboard (13px font, line-height 1.5, colours, full height) is set on the
  container. The element resets only apply inside it (`:where(.a2z-reports)`, the same specificity as before).
- `rem` -> px at build time (13px per rem) for this folder only (`vite.config.js`, plugin `a2z-reports-rem`).
- A few `style_new.css` rules reached into the dashboard; each is reset in the last section of the file:
  `input[type=file] {display:block}` (showed the hidden CSV picker), `label {font-weight:600}`,
  `span {font-size:12px}`, `table th {font-size:11px !important}`, the inset shadow on text inputs,
  and `line-height` on headings and radios.

This was checked by comparing the computed style of every element (588) of the stand-alone app with the
embedded one, in five states (report loaded, dropdown open, status filter, table only, mobile drawer):
no differences apart from the height (the embedded dashboard fills the window below the JSP header).

## Height

The stand-alone app filled the browser window. Embedded, it fills the window below the header:
`height: max(640px, calc(100vh - 140px))` in `reports-embed.css`. Change 140px to your header height, or set
`data-height="..."` on `#a2z-reports-root` (e.g. `data-height="calc(100vh - 180px)"`).
Below 900px wide the dashboard grows with its content, as in the original.

## API

The iconnector service (`com.iconnector.reports`), no changes there:
`POST {REPORTS_API_URL}/api/reports` with `{ clientPublicKey, data: { reportType } }`, encrypted reply
(ECDH P-256 / HKDF-SHA256 / AES-256-GCM, gzip), decrypted by `reportCrypto.js`.

`reportCrypto.js` uses WebCrypto, which browsers only allow on HTTPS pages or `localhost`. On a page opened as
`http://<ip or host>` (not localhost) the reports cannot be decrypted. Serve QA / production over HTTPS.

The address is `REPORTS_API_URL` in `src/config/commonURLConstants.js`; the page's CSP `connect-src` must allow it.

## Security (iconnector side)

`/api/reports` and `/api/departments` have no login check, and `CorsConfig` allows any origin (`*`).
The encryption protects the data in transit only: anyone who can reach the service can send their own key
and read every report. Restrict `allowedOrigins` to the MVC application and verify the user on the server
before production.
