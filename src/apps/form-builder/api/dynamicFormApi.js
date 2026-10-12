import { WEBSERVICE_URL } from '../../../config/commonURLConstants.js';

 

let cfg = {};
export function configureApi(config) {
  cfg = config || {};
}

const present = (v) =>
  v !== undefined && v !== null && String(v).trim() !== '' &&
  !/^\$\{.*\}$/.test(String(v).trim());

const firstPresent = (...vals) => {
  for (const v of vals) if (present(v)) return String(v).trim();
  return '';
};

function readLocalStorage(key) {
  try {
    return window.localStorage ? window.localStorage.getItem(key) : null;
  } catch {
    return null;
  }
}

export function webserviceUrl() {
  return firstPresent(cfg.webserviceurl, window.webserviceUrl, window.webserviceurl, WEBSERVICE_URL).replace(/\/+$/, '');
}

function authToken() {
  let t = firstPresent(cfg.token, readLocalStorage('JWT_TOKEN'), window.token);
  if (t.length > 1 && t.startsWith('"') && t.endsWith('"')) {
    try { t = JSON.parse(t); } catch { /* keep */ }
  }
  return t.replace(/^Bearer\s+/i, '');
}

function language() {
  return firstPresent(cfg.languageFlag, window.language, window.languageFlag) || 'en';
}

function orgId() {
  return firstPresent(cfg.orgId, window.orgId, window.nOrgID);
}

const ep = () => ({
  save: 'saveFormData.html',
  details: 'getDynamicFormDetails.html',
  formula: 'updateFormulaDetails',
  departments: `${webserviceUrl()}/departments/topLevelDepartments`,
  ...(cfg.endpoints || {}),
});


function ajax(opts) {
  const $ = window.jQuery;
  if ($ && $.ajax) {
    return new Promise((resolve, reject) => {
      $.ajax({
        ...opts,
        success: (data) => resolve(data),
        error: (xhr, status, err) => {
          const e = new Error(err || status || 'Request failed');
          e.xhr = xhr;
          reject(e);
        },
      });
    });
  }
  const isJson = (opts.contentType || '').includes('application/json');
  return fetch(opts.url, {
    method: opts.type || 'GET',
    credentials: 'same-origin',
    headers: {
      'X-Requested-With': 'XMLHttpRequest',
      'Content-Type': isJson ? 'application/json' : 'application/x-www-form-urlencoded; charset=UTF-8',
      ...(opts.headers || {}),
    },
    // GET/HEAD requests must not carry a body
    body: /^(GET|HEAD)$/i.test(opts.type || 'GET') ? undefined : isJson ? opts.data : new URLSearchParams(opts.data || {}).toString(),
  }).then(async (r) => {
    const text = await r.text();
    if (!r.ok) throw Object.assign(new Error(r.statusText || 'Request failed'), { status: r.status, body: text });
    try { return JSON.parse(text); } catch { return text; }
  });
}

const parseMaybe = (v) => {
  if (typeof v !== 'string') return v;
  try { return JSON.parse(v); } catch { return v; }
};


export async function saveForm({ formJson, formName, department, formID }) {
  const data = {
    jsonFormData: JSON.stringify(formJson),
    formName,
    department,
    formID: formID || '',
    orgID: orgId(),
  };
  const res = parseMaybe(await ajax({ url: ep().save, type: 'POST', data, dataType: 'json' }));
  return res;
}

export async function getFormDetails(formId) {
  const res = parseMaybe(
    await ajax({
      url: ep().details,
      type: 'POST',
      contentType: 'application/json',
      data: JSON.stringify({ hdnFormIdValue: formId }),
    })
  );
  const json = parseMaybe(res && res.sDynamicXML);
  if (!json || typeof json !== 'object') throw new Error('The saved form definition could not be read.');
  
  const department =
    res.nDepartmentID ?? res.departmentId ?? res.department ?? res.nDepartmentId ?? '';
  return { json, department: department == null ? '' : String(department) };
}

export async function getDepartments() {
  if (!webserviceUrl() && !(cfg.endpoints && cfg.endpoints.departments)) {
    console.error('[SmartForms] webserviceUrl is empty. Department list not loaded.');
    return [];
  }
  const token = authToken();
  if (!token) console.warn('[SmartForms] No JWT in localStorage "JWT_TOKEN".');
  const res = parseMaybe(
    await ajax({
      url: ep().departments,
      type: 'POST',
      contentType: 'application/json',
      headers: {
        ...(token ? { Authorization: 'Bearer ' + token } : {}),
        'Accept-Language': language(),
      },
      data: JSON.stringify({ nOrgID: orgId() }),
    })
  );
  if (res && res.status === 'SUCCESS' && Array.isArray(res.data)) return res.data;
  console.warn(res && res.message);
  return [];
}


export async function updateFormulaDetails(payload) {
  const res = parseMaybe(
    await ajax({
      url: ep().formula,
      type: 'POST',
      contentType: 'application/json',
      data: JSON.stringify(payload),
    })
  );
  if (res && typeof res === 'object' && typeof res.updatedData === 'string') res.updatedData = parseMaybe(res.updatedData);
  if (typeof res === 'string' && /<html|<!doctype/i.test(res)) {

    throw new Error('The server returned a web page instead of a JSON reply (session expired or wrong URL?)');
  }
  return res && typeof res === 'object' ? res : {};
}

export async function fetchDataSource(request) {
  
  const token = request.sendToken ? authToken() : '';
  const headers = { 'Accept-Language': language(), ...(token ? { Authorization: 'Bearer ' + token } : {}) };
  try {
    const res = await ajax({
      url: request.url,
      type: request.method,
      headers,
      dataType: 'json',
      ...(request.method === 'POST' ? { contentType: 'application/json', data: JSON.stringify(request.body || {}) } : {}),
    });
    return parseMaybe(res);
  } catch (e) {
    const status = (e.xhr && e.xhr.status) || e.status;
    if (status === 0 || e instanceof TypeError) {
      throw new Error('The API could not be reached (network, CORS or Content-Security-Policy connect-src)');
    }
    if (status === 401 || status === 403) throw new Error(`Not authorised (HTTP ${status}). Check the login token setting.`);
    if (status) throw new Error(`The API replied with HTTP ${status}`);
    if (/parsererror|JSON/i.test(e.message || '')) throw new Error('The API did not return JSON');
    throw new Error(e.message || 'The API call failed');
  }
}
