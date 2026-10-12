import React, { useMemo, useState } from 'react';
import Icon from './Icon';
import { Field, Toggle, Segmented } from './Editors';
import {
  SOURCE_KINDS, buildRequest, findList, arrayPaths, recordKeys, guessKeys, parseOptions, cleanSource,
} from '../model/dynamicSource';
import { fetchDataSource, webserviceUrl } from '../api/dynamicFormApi';


export default function DynamicSourceEditor({ ds, onChange, context, fields = [], columns = [], usedBy = [], uid }) {
  const d = { ...cleanSource(ds), params: (ds && ds.params) || [] };
  const set = (patch) => onChange({ ...d, ...patch });
  const setParam = (i, patch) => set({ params: d.params.map((p, j) => (j === i ? { ...p, ...patch } : p)) });

  const [test, setTest] = useState({ values: {}, busy: false, result: null });
  const [keys, setKeys] = useState({ lists: [], fields: [] });

  const placeholders = useMemo(
    () => [...new Set((d.url.match(/\{([A-Za-z_][\w.-]*)\}/g) || []).map((m) => m.slice(1, -1)).filter((n) => n !== 'webserviceUrl'))],
    [d.url]
  );
  const missingPlaceholderParams = placeholders.filter((n) => !d.params.some((p) => p.name === n));

  const addParam = (name = '') => {
    const first = context === 'column' && columns.length ? { source: 'column', column: columns[0] }
      : fields.length ? { source: 'field', field: (fields.find((f) => f.dynamic) || fields[0]).id }
        : { source: 'static', value: '' };
    set({ params: [...d.params, { name, required: true, ...first }] });
  };

  const linkLabel = (p) => {
    if (p.source === 'field') return (fields.find((f) => f.id === p.field) || {}).label || 'a field';
    if (p.source === 'column') return p.column || 'a column';
    return 'fixed value';
  };

  const runTest = async () => {
    setTest((t) => ({ ...t, busy: true, result: null }));
    const request = buildRequest(d, (p) => test.values[p.name], webserviceUrl());
    if (!d.url) { setTest((t) => ({ ...t, busy: false, result: { ok: false, message: 'Paste the API URL first.' } })); return; }
    if (!request.ready) {
      setTest((t) => ({ ...t, busy: false, result: { ok: false, message: `Enter a test value for: ${request.missing.join(', ')}` } }));
      return;
    }
    try {
      const res = await fetchDataSource(request);
      const lists = arrayPaths(res).filter((x) => x !== '' || Array.isArray(res));
      const list = findList(res, d.listPath);
      const fieldKeys = recordKeys(list || []);
      setKeys({ lists, fields: fieldKeys });
      // fill what is still empty: list path, value key, label key
      const patch = {};
      if (!d.listPath && !Array.isArray(res) && list) {
        const path = lists.find((p) => findList(res, p) === list);
        if (path) patch.listPath = path;
      }
      const g = guessKeys(fieldKeys);
      if (!d.valueKey && g.valueKey) patch.valueKey = g.valueKey;
      if (!d.labelKey && g.labelKey) patch.labelKey = g.labelKey;
      const next = { ...d, ...patch };
      if (Object.keys(patch).length) set(patch);
      let options = [];
      let parseError = '';
      try { options = parseOptions(res, next); } catch (e) { parseError = e.message; }
      setTest((t) => ({
        ...t, busy: false,
        result: { ok: !parseError, url: request.url, method: request.method, body: request.body, options, parseError, raw: JSON.stringify(res, null, 2).slice(0, 1200), count: list ? list.length : 0 },
      }));
    } catch (e) {
      setTest((t) => ({ ...t, busy: false, result: { ok: false, url: request.url, message: e.message } }));
    }
  };

  const fieldGroups = [
    { label: 'Dropdowns', items: fields.filter((f) => f.dynamic) },
    { label: 'Other fields', items: fields.filter((f) => !f.dynamic) },
  ].filter((g) => g.items.length);

  return (
    <div className="dfb-ds">
      {usedBy.length > 0 && (
        <div className="dfb-formula-note" role="note">Linked: {usedBy.join(', ')} reload{usedBy.length === 1 ? 's' : ''} when this value changes.</div>
      )}

      <Field label="API URL" help="">
        <textarea className="form-control dfb-tall dfb-mono-input" rows={2} spellCheck={false} value={d.url}
          placeholder="Paste the full URL."
          onChange={(e) => set({ url: e.target.value.replace(/\s+/g, '') })} />
      </Field>

      <div className="dfb-two">
        <div className="dfb-prop">
          <span className="dfb-prop-label">Method</span>
          <Segmented label="Method" value={d.method} options={[{ value: 'GET', label: 'GET' }, { value: 'POST', label: 'POST' }]} onChange={(method) => set({ method })} />
        </div>
        <Field label="Placeholder">
          <input className="form-control" value={d.placeholder} onChange={(e) => set({ placeholder: e.target.value })} />
        </Field>
      </div>
      <Toggle label="Send login token" help="Authorization: Bearer token from this session" checked={d.sendToken} onChange={(v) => set({ sendToken: v })} />

      {/* ---------- parameters ---------- */}
      <div className="dfb-prop-label-row dfb-mt8">
        <span className="dfb-prop-label">Parameters ({d.params.length})</span>
        <button type="button" className="dfb-link-btn" onClick={() => addParam()}>+ Add parameter</button>
      </div>
      
      {missingPlaceholderParams.length > 0 && (
        <div className="dfb-ds-warn">
          The URL uses {missingPlaceholderParams.map((n) => `{${n}}`).join(', ')}.{' '}
          {missingPlaceholderParams.map((n) => (
            <button key={n} type="button" className="dfb-link-btn" onClick={() => addParam(n)}>Add “{n}”</button>
          ))}
        </div>
      )}
      {d.params.length === 0 && <p className="dfb-help"></p>}
      <ol className="dfb-ds-params">
        {d.params.map((p, i) => (
          <li key={i}>
            <div className="dfb-ds-param-head">
              <span>{p.name || 'Unnamed'} ← {linkLabel(p)}</span>
              <button type="button" className="dfb-tool dfb-tool-danger" title="Remove parameter" aria-label={`Remove parameter ${p.name}`}
                onClick={() => set({ params: d.params.filter((_, j) => j !== i) })}><Icon name="close" size={14} /></button>
            </div>
            <div className="dfb-two">
              <Field label="Parameter name">
                <input className="form-control dfb-mono-input" value={p.name} placeholder="stateId"
                  onChange={(e) => setParam(i, { name: e.target.value.replace(/\s+/g, '') })} />
              </Field>
              <Field label="Value from">
                <select className="form-control" value={p.source}
                  onChange={(e) => {
                    const source = e.target.value;
                    const patch = { source };
                    if (source === 'field' && !p.field && fields[0]) patch.field = (fields.find((f) => f.dynamic) || fields[0]).id;
                    if (source === 'column' && !p.column && columns[0]) patch.column = columns[0];
                    setParam(i, patch);
                  }}>
                  {SOURCE_KINDS.filter((k) => k.value !== 'column' || context === 'column').map((k) => (
                    <option key={k.value} value={k.value}>{k.label}</option>
                  ))}
                </select>
              </Field>
            </div>
            {p.source === 'field' && (
              <Field label="Field" help="">
                <select className="form-control" value={p.field || ''} onChange={(e) => setParam(i, { field: e.target.value })}>
                  <option value="">Select field</option>
                  {fieldGroups.map((g) => (
                    <optgroup key={g.label} label={g.label}>
                      {g.items.map((f) => <option key={f.id} value={f.id}>{f.label}</option>)}
                    </optgroup>
                  ))}
                  {p.field && !fields.some((f) => f.id === p.field) && <option value={p.field}>Missing field ({p.field})</option>}
                </select>
              </Field>
            )}
            {p.source === 'column' && (
              <Field label="Column (same row)">
                <select className="form-control" value={p.column || ''} onChange={(e) => setParam(i, { column: e.target.value })}>
                  <option value="">Select column</option>
                  {columns.map((c) => <option key={c} value={c}>{c}</option>)}
                  {p.column && !columns.includes(p.column) && <option value={p.column}>Missing column ({p.column})</option>}
                </select>
              </Field>
            )}
            {p.source === 'static' && (
              <Field label="Value">
                <input className="form-control" value={p.value ?? ''} onChange={(e) => setParam(i, { value: e.target.value })} />
              </Field>
            )}
            <Toggle label="Required" help={p.required !== false ? 'The API is called only when this has a value' : 'Sent only when it has a value'}
              checked={p.required !== false} onChange={(v) => setParam(i, { required: v })} />
          </li>
        ))}
      </ol>

      {/* ---------- response mapping ---------- */}
      <span className="dfb-prop-label dfb-mt8">Response</span>
      <Field label="List path" help="">
        <input className="form-control dfb-mono-input" list={`${uid}-lists`} value={d.listPath} placeholder="data"
          onChange={(e) => set({ listPath: e.target.value.trim() })} />
        <datalist id={`${uid}-lists`}>{keys.lists.map((k) => <option key={k} value={k} />)}</datalist>
      </Field>
      <div className="dfb-two">
        <Field label="Value key" help="">
          <input className="form-control dfb-mono-input" list={`${uid}-keys`} value={d.valueKey} placeholder="Ex : id"
            onChange={(e) => set({ valueKey: e.target.value.trim() })} />
        </Field>
        <Field label="Label key" help="">
          <input className="form-control dfb-mono-input" list={`${uid}-keys`} value={d.labelKey} placeholder="Ex : name"
            onChange={(e) => set({ labelKey: e.target.value.trim() })} />
        </Field>
      </div>
      <datalist id={`${uid}-keys`}>{keys.fields.map((k) => <option key={k} value={k} />)}</datalist>
      {keys.fields.length > 0 && (
        <div className="dfb-chips">
          {keys.fields.map((k) => (
            <span key={k} className="dfb-ds-key">
              {k}
              <button type="button" onClick={() => set({ valueKey: k })} title={`Use ${k} as value`} className={d.valueKey === k ? 'is-on' : ''}>value</button>
              <button type="button" onClick={() => set({ labelKey: k })} title={`Use ${k} as label`} className={d.labelKey === k ? 'is-on' : ''}>label</button>
            </span>
          ))}
        </div>
      )}

      {/* ---------- test ---------- */}
      <div className="dfb-ds-test">
        <span className="dfb-prop-label">Test API</span>
        {d.params.filter((p) => p.source !== 'static').map((p) => (
          <Field key={p.name || p.field || p.column} label={`Test value for ${p.name || '(unnamed)'}`}>
            <input className="form-control" value={test.values[p.name] ?? ''} placeholder="e.g. 36"
              onChange={(e) => setTest((t) => ({ ...t, values: { ...t.values, [p.name]: e.target.value } }))} />
          </Field>
        ))}
        <button type="button" className="ButtonSmall dfb-small" onClick={runTest} disabled={test.busy}>
          {test.busy ? 'Calling…' : 'Test API'}
        </button>
        {test.result && (
          <div className={`dfb-ds-result ${test.result.ok ? 'is-ok' : 'is-bad'}`} role="status">
            {test.result.url && <div className="dfb-mono-input dfb-ds-url">{test.result.method || d.method} {test.result.url}</div>}
            {test.result.message && <div>{test.result.message}</div>}
            {test.result.raw !== undefined && (
              <>
                {test.result.ok
                  ? <div><b>{test.result.options.length} option{test.result.options.length === 1 ? '' : 's'}</b> loaded.</div>
                  : <div><b>{test.result.parseError}</b> ({test.result.count} record{test.result.count === 1 ? '' : 's'} found)</div>}
                {test.result.options.length > 0 && (
                  <table className="dfb-ds-sample">
                    <thead><tr><th>Value</th><th>Label</th></tr></thead>
                    <tbody>{test.result.options.slice(0, 5).map((o) => <tr key={o.value}><td>{o.value}</td><td>{o.label}</td></tr>)}</tbody>
                  </table>
                )}
                <details>
                  <summary>Response</summary>
                  <pre>{test.result.raw}</pre>
                </details>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
