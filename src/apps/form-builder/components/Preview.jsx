import React, { useMemo, useState } from 'react';
import { FieldControl, SectionTable } from './FieldControl';
import { isFullWidth } from '../model/schema';
import { applyFormulas } from '../model/formula';
import { isDynamic, buildRequest, dependentsOf, dependentColumns } from '../model/dynamicSource';
import { webserviceUrl } from '../api/dynamicFormApi';
import useDynamicOptions from './useDynamicOptions';

function check(c, v) {
  const empty = v == null || v === '' || (Array.isArray(v) && v.length === 0);
  if (c.required === 'yes' && empty) return 'This field is required';
  if (empty) return '';
  if (c.type === 'text' || c.type === 'textarea') {
    if (c.minlength && String(v).length < Number(c.minlength)) return `Enter at least ${c.minlength} characters`;
    if (c.pattern) {
      try {
        
        const re = new RegExp(`^(?:${c.pattern.replace(/^\^/, '').replace(/\$$/, '')})$`);
        if (!re.test(v)) {
          return c.inputType === 'email' ? 'Enter a valid email address (e.g., name@domain.com)'
            : c.inputType === 'tel' ? 'Phone number must be 10 digits starting with 6-9'
              : 'Please enter a valid value';
        }
      } catch { }
    }
  }
  if (c.type === 'number') {
    const n = Number(v);
    if (Number.isNaN(n)) return 'Enter a number';
    if (c.min != null && c.min !== '' && n < Number(c.min)) return `Must be at least ${c.min}`;
    if (c.max != null && c.max !== '' && n > Number(c.max)) return `Must be at most ${c.max}`;
  }
  if (c.type === 'file' && v && v.length) {
    for (const f of Array.from(v)) {
      const mb = f.size / (1024 * 1024);
      if (c.min && mb < parseFloat(c.min)) return `File must be at least ${c.min} MB`;
      if (c.max && mb > parseFloat(c.max)) return `File must be less than ${c.max} MB`;
    }
  }
  return '';
}

export default function Preview({ state }) {
  const [values, setValues] = useState({});
  const [tables, setTables] = useState({});
  const [touched, setTouched] = useState({});
  const [checked, setChecked] = useState(false);
  const [result, setResult] = useState(null);

  const comps = useMemo(
    () => state.items.filter((it) => it.kind === 'component' && it.comp.type !== 'richtext').map((it) => it.comp),
    [state.items]
  );

  
  const form = useMemo(
    () => applyFormulas(comps.map((c) => ({ key: c.id, label: c.label, formula: c.formula })), values),
    [comps, values]
  );

  
  const rowFormulas = useMemo(() => {
    const out = {};
    state.items.forEach((it) => {
      if (it.kind !== 'section') return;
      const cols = (it.sec.tableColumns || []).map((c) => ({ key: c.id, label: c.columnHeader, formula: c.formula }));
      out[it.key] = (tables[it.key] || [{}]).map((row) => applyFormulas(cols, row));
    });
    return out;
  }, [state.items, tables]);

  
  const formValues = form.values;
  const wanted = useMemo(() => {
    const ws = webserviceUrl();
    const list = [];
    comps.filter(isDynamic).forEach((c) => {
      list.push({
        id: c.id,
        ds: c.dataSource,
        request: buildRequest(c.dataSource, (p) => (p.source === 'field' ? formValues[p.field] : undefined), ws),
      });
    });
    state.items.forEach((it) => {
      if (it.kind !== 'section') return;
      const cols = it.sec.tableColumns || [];
      const idOf = (header) => (cols.find((c) => c.columnHeader === header) || {}).id;
      (tables[it.key] || [{}]).forEach((row, ri) => {
        cols.filter(isDynamic).forEach((col) => {
          list.push({
            id: `${it.key}|${ri}|${col.id}`,
            ds: col.dataSource,
            request: buildRequest(col.dataSource, (p) => {
              if (p.source === 'column') return row[idOf(p.column)];
              if (p.source === 'field') return formValues[p.field];
              return undefined;
            }, ws),
          });
        });
      });
    });
    return list;
  }, [comps, state.items, tables, formValues]);
  const dyn = useDynamicOptions(wanted);

  const rowDynFor = (it) => (tables[it.key] || [{}]).map((row, ri) => {
    const o = {};
    (it.sec.tableColumns || []).filter(isDynamic).forEach((col) => { o[col.id] = dyn.state[`${it.key}|${ri}|${col.id}`]; });
    return o;
  });

  
  const paramFieldLabel = (comp, paramName) => {
    const prm = ((comp.dataSource && comp.dataSource.params) || []).find((x) => x.name === paramName);
    if (!prm || prm.source !== 'field') return paramName;
    const f = comps.find((c) => c.id === prm.field);
    return f ? f.label : paramName;
  };

  const fieldFormula = (c) => {
    const rule = form.rules[c.id];
    if (!rule) return null;
    const calc = form.calc[c.id];
    return {
      formula: rule.formula,
      calculated: rule.isCalculation,
      missing: rule.isCalculation && calc && calc.status === 'missing' ? calc.missing : null,
      message: calc && calc.status === 'error' ? calc.message : null,
      cond: rule.isComparison ? form.cond[c.id] : null,
    };
  };

  const errorFor = (c) => {
    const rule = form.rules[c.id];
    const v = form.values[c.id];
    if (rule && rule.isCalculation) {
      if (c.required === 'yes' && (v === '' || v == null)) {
        const miss = form.calc[c.id] && form.calc[c.id].missing;
        return miss && miss.length ? `Calculated from ${miss.join(', ')}. Fill those first.` : 'This field is required';
      }
      return check(c, v);
    }
    const base = check(c, v);
    if (base) return base;
    if (rule && rule.isComparison && form.cond[c.id] && form.cond[c.id].ok === false) return 'Condition not satisfied';
    return '';
  };

  const onChange = (id, v) => {
    
    const cleared = dependentsOf(id, comps);
    setValues((x) => {
      const n = { ...x, [id]: v };
      cleared.forEach((d) => { n[d] = ''; });
      return n;
    });
    
    const changed = [id, ...cleared];
    setTables((t) => {
      let next = t;
      state.items.forEach((it) => {
        if (it.kind !== 'section') return;
        const cols = it.sec.tableColumns || [];
        const hit = cols.filter((c) => isDynamic(c) && (c.dataSource.params || []).some((p) => p.source === 'field' && changed.includes(p.field)));
        if (!hit.length) return;
        const headers = new Set(hit.flatMap((c) => [c.columnHeader, ...dependentColumns(c.columnHeader, cols)]));
        const ids = cols.filter((c) => headers.has(c.columnHeader)).map((c) => c.id);
        next = { ...next, [it.key]: (next[it.key] || [{}]).map((row) => { const r = { ...row }; ids.forEach((cid) => { r[cid] = ''; }); return r; }) };
      });
      return next;
    });
    setTouched((t) => ({ ...t, [id]: true }));
  };

  
  const onCellChange = (it) => (ri, col, val) => {
    const cols = it.sec.tableColumns || [];
    const below = dependentColumns(col.columnHeader, cols);
    const ids = cols.filter((c) => below.includes(c.columnHeader)).map((c) => c.id);
    setTables((t) => ({
      ...t,
      [it.key]: (t[it.key] || [{}]).map((row, i) => {
        if (i !== ri) return row;
        const r = { ...row, [col.id]: val };
        ids.forEach((cid) => { r[cid] = ''; });
        return r;
      }),
    }));
  };

  const shownError = (c) => (checked || touched[c.id] ? errorFor(c) : '');

  const run = () => {
    setChecked(true);
    let fieldProblems = 0;
    comps.forEach((c) => { if (errorFor(c)) fieldProblems++; });
    let tableProblems = 0;
    state.items.forEach((it) => {
      if (it.kind !== 'section') return;
      (tables[it.key] || [{}]).forEach((row, ri) => {
        const rf = rowFormulas[it.key][ri];
        (it.sec.tableColumns || []).forEach((col) => {
          const v = rf.values[col.id];
          if (col.required === 'yes' && (v == null || v === '' || (Array.isArray(v) && v.length === 0))) tableProblems++;
          if (rf.cond[col.id] && rf.cond[col.id].ok === false) tableProblems++;
        });
      });
    });
    const n = fieldProblems + tableProblems;
    setResult(n === 0
      ? { ok: true, text: 'Every answer passes the form’s rules and formulas.' }
      : { ok: false, text: `${n} answer${n > 1 ? 's need' : ' needs'} attention.` });
  };

  const reset = () => { setValues({}); setTables({}); setTouched({}); setChecked(false); setResult(null); };

  return (
    <div className="dfb-canvas">
      <div className={`form-controls dfb-sheet dfb-cols-${state.layout} is-preview`}>
        <div className="tHeader dfb-sheet-head">
          <div className="tHeaderLeft"><h1>{state.title.trim() || 'Untitled form'}</h1></div>
          <div className="tHeaderRight dfb-sheet-meta">Preview, answers are not saved</div>
        </div>
        {state.items.length === 0 ? (
          <div className="dfb-empty"><p>Nothing to preview yet. Add fields in Build.</p></div>
        ) : (
          <div className="dfb-grid">
            {state.items.map((it) => (
              <div key={it.key} className={`dfb-cell${isFullWidth(it) ? ' is-full' : ''}`}>
                {it.kind === 'section' ? (
                  <SectionTable sec={it.sec} mode="fill" rows={tables[it.key] || [{}]} rowFormulas={rowFormulas[it.key]}
                    rowDyn={rowDynFor(it)} onRetryCell={(ri, colId) => dyn.retry(`${it.key}|${ri}|${colId}`)}
                    onCellChange={onCellChange(it)}
                    onRowsChange={(rows) => setTables((t) => ({ ...t, [it.key]: rows }))} />
                ) : it.comp.type === 'richtext' ? (
                  <FieldControl comp={it.comp} mode="fill" />
                ) : (
                  <FieldControl comp={it.comp} mode="fill" value={form.values[it.comp.id]} onChange={onChange}
                    error={shownError(it.comp)} formula={fieldFormula(it.comp)}
                    dyn={dyn.state[it.comp.id]} onRetry={() => dyn.retry(it.comp.id)} fieldLabel={paramFieldLabel} />
                )}
              </div>
            ))}
          </div>
        )}
        <div className="dfb-sheet-foot p5 text-center">
          {result && <span className={`dfb-result ${result.ok ? 'is-ok' : 'is-bad'}`} role="status">{result.text}</span>}
          <input type="button" className="Button" value="Check Answers" onClick={run} />
          <input type="button" className="Button" value="Reset" onClick={reset} />
        </div>
      </div>
    </div>
  );
}
