
export const SOURCE_KINDS = [
  { value: 'field', label: 'Another form field' },
  { value: 'column', label: 'Another column (same row)' },
  { value: 'static', label: 'Fixed value' },
];

export function defaultSource() {
  return {
    url: '',
    method: 'GET',
    sendToken: true,
    params: [],
    listPath: '',
    valueKey: '',
    labelKey: '',
    placeholder: '-Select-',
  };
}

export const isDynamic = (compOrCol) => !!(compOrCol && compOrCol.dataSource && typeof compOrCol.dataSource === 'object');


export function cleanSource(ds) {
  const d = { ...defaultSource(), ...(ds || {}) };
  return {
    url: String(d.url || '').trim(),
    method: d.method === 'POST' ? 'POST' : 'GET',
    sendToken: d.sendToken !== false,
    params: (d.params || [])
      .filter((p) => String(p.name || '').trim())
      .map((p) => {
        const out = { name: String(p.name).trim(), source: ['field', 'column', 'static'].includes(p.source) ? p.source : 'static', required: p.required !== false };
        if (out.source === 'field') out.field = p.field || '';
        if (out.source === 'column') out.column = p.column || '';
        if (out.source === 'static') out.value = p.value == null ? '' : String(p.value);
        return out;
      }),
    listPath: String(d.listPath || '').trim(),
    valueKey: String(d.valueKey || '').trim(),
    labelKey: String(d.labelKey || '').trim(),
    placeholder: String(d.placeholder || '-Select-'),
  };
}



const blank = (v) => v === undefined || v === null || String(v).trim() === '';


export function buildRequest(ds, resolve, webserviceUrl = '') {
  const d = cleanSource(ds);
  const values = {};
  const missing = [];
  d.params.forEach((p) => {
    const v = p.source === 'static' ? p.value : resolve(p);
    if (blank(v)) {
      if (p.required) missing.push(p.name);
    } else {
      values[p.name] = String(v);
    }
  });

  let url = d.url.replace(/\{webserviceUrl\}/g, String(webserviceUrl || '').replace(/\/+$/, ''));
  const used = new Set();
  url = url.replace(/\{([A-Za-z_][\w.-]*)\}/g, (m, name) => {
    if (name in values) { used.add(name); return encodeURIComponent(values[name]); }
    if (d.params.some((p) => p.name === name)) { if (!missing.includes(name)) missing.push(name); }
    return m;
  });
  const rest = {};
  Object.keys(values).forEach((k) => { if (!used.has(k)) rest[k] = values[k]; });

  let query = '';
  let body = null;
  if (d.method === 'GET') {
    const qs = new URLSearchParams(rest).toString();
    if (qs) query = (url.includes('?') ? '&' : '?') + qs;
  } else {
    body = rest;
  }
  const fullUrl = url + query;
  return {
    ready: !!d.url && missing.length === 0,
    missing,
    url: fullUrl,
    method: d.method,
    body,
    sendToken: d.sendToken,
    key: `${d.method} ${fullUrl} ${body ? JSON.stringify(body) : ''}`,
  };
}



export function getPath(obj, path) {
  if (!path) return obj;
  return String(path).split('.').reduce((o, k) => (o == null ? undefined : o[k]), obj);
}


export function findList(response, listPath) {
  if (listPath) {
    const v = getPath(response, listPath);
    return Array.isArray(v) ? v : null;
  }
  if (Array.isArray(response)) return response;
  if (response && typeof response === 'object') {
    for (const k of ['data', 'result', 'results', 'list', 'items', 'content', 'rows', 'records']) {
      if (Array.isArray(response[k])) return response[k];
    }
    for (const k of Object.keys(response)) {
      if (Array.isArray(response[k])) return response[k];
      if (response[k] && typeof response[k] === 'object') {
        for (const k2 of Object.keys(response[k])) if (Array.isArray(response[k][k2])) return response[k][k2];
      }
    }
  }
  return null;
}

export function arrayPaths(response, prefix = '', depth = 0, out = []) {
  if (Array.isArray(response)) { out.push(prefix); return out; }
  if (response && typeof response === 'object' && depth < 3) {
    Object.keys(response).forEach((k) => arrayPaths(response[k], prefix ? `${prefix}.${k}` : k, depth + 1, out));
  }
  return out;
}

export function recordKeys(list) {
  const first = (list || []).find((r) => r && typeof r === 'object');
  if (!first) return [];
  const keys = [];
  Object.keys(first).forEach((k) => {
    const v = first[k];
    if (v && typeof v === 'object' && !Array.isArray(v)) Object.keys(v).forEach((k2) => keys.push(`${k}.${k2}`));
    else if (!Array.isArray(v)) keys.push(k);
  });
  return keys;
}

export function guessKeys(keys) {
  const lower = keys.map((k) => k.toLowerCase());
  const pick = (tests) => {
    for (const t of tests) { const i = lower.findIndex(t); if (i >= 0) return keys[i]; }
    return '';
  };
  const valueKey = pick([(k) => k === 'id', (k) => k === 'value', (k) => /id$/.test(k), (k) => k === 'code', (k) => /code$/.test(k)]);
  const labelKey = pick([(k) => k === 'name', (k) => k === 'label', (k) => k === 'text', (k) => /name$/.test(k), (k) => /desc/.test(k), (k) => /title/.test(k)]);
  return { valueKey, labelKey };
}

export function parseOptions(response, ds) {
  const d = cleanSource(ds);
  let res = response;
  if (typeof res === 'string') {
    try { res = JSON.parse(res); } catch { throw new Error('The API did not return JSON'); }
  }
  const list = findList(res, d.listPath);
  if (!list) throw new Error(d.listPath ? `No list found at "${d.listPath}" in the response` : 'No list found in the response');
  if (!d.valueKey || !d.labelKey) throw new Error('Choose the value key and label key');
  const seen = new Set();
  const out = [];
  list.forEach((r) => {
    if (r == null) return;
    const value = typeof r === 'object' ? getPath(r, d.valueKey) : r;
    const label = typeof r === 'object' ? getPath(r, d.labelKey) : r;
    if (value === undefined || value === null) return;
    const v = String(value);
    if (seen.has(v)) return;
    seen.add(v);
    out.push({ value: v, label: label == null ? v : String(label) });
  });
  return out;
}


export const parentFields = (ds) => (ds && ds.params ? ds.params.filter((p) => p.source === 'field' && p.field).map((p) => p.field) : []);

export const parentColumns = (ds) => (ds && ds.params ? ds.params.filter((p) => p.source === 'column' && p.column).map((p) => p.column) : []);


export function dependentsOf(id, comps) {
  const out = new Set();
  const walk = (cur) => {
    comps.forEach((c) => {
      if (isDynamic(c) && parentFields(c.dataSource).includes(cur) && !out.has(c.id)) {
        out.add(c.id);
        walk(c.id);
      }
    });
  };
  walk(id);
  return [...out];
}


export function dependentColumns(header, cols) {
  const out = new Set();
  const walk = (cur) => {
    cols.forEach((c) => {
      if (isDynamic(c) && parentColumns(c.dataSource).includes(cur) && !out.has(c.columnHeader)) {
        out.add(c.columnHeader);
        walk(c.columnHeader);
      }
    });
  };
  walk(header);
  return [...out];
}


export function columnsUsingField(id, sections) {
  const out = [];
  (sections || []).forEach((s) => (s.tableColumns || []).forEach((c) => {
    if (isDynamic(c) && parentFields(c.dataSource).includes(id)) out.push({ tableId: s.tableId, column: c.columnHeader });
  }));
  return out;
}


export function validateSources(items) {
  const comps = items.filter((i) => i.kind === 'component').map((i) => i.comp);
  const byId = new Map(comps.map((c) => [c.id, c]));
  const keyOf = new Map(items.filter((i) => i.kind === 'component').map((i) => [i.comp.id, i.key]));

  const checkSource = (ds, where, key, siblingHeaders) => {
    const d = cleanSource(ds);
    if (!d.url) return { message: `${where}: paste the API URL`, key };
    if (!/^(https?:\/\/|\/|\{webserviceUrl\}|[A-Za-z0-9_.-]+(\/|$|\?))/.test(d.url)) return { message: `${where}: the API URL does not look valid`, key };
    if (!d.valueKey || !d.labelKey) return { message: `${where}: choose the value key and label key (use Test API)`, key };
    const names = new Set();
    for (const p of d.params) {
      if (names.has(p.name)) return { message: `${where}: parameter "${p.name}" is used twice`, key };
      names.add(p.name);
      if (p.source === 'field') {
        if (!p.field || !byId.has(p.field)) return { message: `${where}: parameter "${p.name}" is linked to a field that no longer exists`, key };
      }
      if (p.source === 'column') {
        if (!siblingHeaders) return { message: `${where}: parameter "${p.name}" can only read a column inside a table`, key };
        if (!p.column || !siblingHeaders.includes(p.column)) return { message: `${where}: parameter "${p.name}" is linked to a column that no longer exists`, key };
      }
    }
    return null;
  };

  for (const c of comps) {
    if (!isDynamic(c)) continue;
    const problem = checkSource(c.dataSource, `Dropdown "${c.label}"`, keyOf.get(c.id), null);
    if (problem) return problem;
    if (dependentsOf(c.id, comps).includes(c.id)) return { message: `Dropdown "${c.label}" depends on itself through other dropdowns`, key: keyOf.get(c.id) };
  }
  for (const it of items) {
    if (it.kind !== 'section') continue;
    const cols = it.sec.tableColumns || [];
    const headers = cols.map((c) => c.columnHeader);
    for (const col of cols) {
      if (!isDynamic(col)) continue;
      const problem = checkSource(col.dataSource, `Column "${col.columnHeader}" in "${it.sec.tableHeader}"`, it.key, headers);
      if (problem) return problem;
      if (dependentColumns(col.columnHeader, cols).includes(col.columnHeader)) {
        return { message: `Column "${col.columnHeader}" depends on itself through other columns`, key: it.key };
      }
    }
  }
  return null;
}
