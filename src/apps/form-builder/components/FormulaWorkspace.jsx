import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  formulaFields, existingFormulas, appendToFormula, backspace as backspaceFormula, validateFormula,
  extractAllFieldsFromFormula, escapeHtml, decodeHtmlEntities, splitAtResult, calculate, isComparisonFormula,
} from '../model/formula';
import { updateFormulaDetails } from '../api/dynamicFormApi';
import { confirmDialog } from '../api/alerts';


const CALC_KEYS = [
  ['+', '+'], ['-', '-'], ['*', '×'], ['/', '÷'], ['%', '%'], ['(', '('], [')', ')'], ['.', '.'],
  ['<', '<'], ['>', '>'], ['<=', '≤'], ['>=', '≥'], ['==', '=='], ['!=', '≠'], ['&&', 'AND'], ['||', 'OR'],
  ['7', '7'], ['8', '8'], ['9', '9'], ['CLEAR', 'C'],
  ['4', '4'], ['5', '5'], ['6', '6'], ['BACK', '⌫'],
  ['1', '1'], ['2', '2'], ['3', '3'], ['0', '0'],
];

const clone = (o) => JSON.parse(JSON.stringify(o));

function explicitFailure(res) {
  if (!res || typeof res !== 'object') return null;
  if (res.success === false || res.success === 'false') return res.message || 'The server rejected the request';
  if (res.status && /fail|error/i.test(String(res.status))) return res.message || res.error || String(res.status);
  return null;
}

function storedFormula(json, mainFieldValue, isSection) {
  if (!json) return undefined;
  if (isSection) {
    const b = mainFieldValue.indexOf('[');
    const col = mainFieldValue.substring(0, b).trim();
    const sec = mainFieldValue.substring(b + 1, mainFieldValue.length - 1).trim();
    const s = (json.sections || []).find((x) => x.tableHeader === sec);
    const c = s && (s.tableColumns || []).find((x) => x.columnHeader === col);
    return c ? decodeHtmlEntities(c.formula || '') : undefined;
  }
  const c = (json.components || []).find((x) => x.label === mainFieldValue && x.type === 'number');
  return c ? decodeHtmlEntities(c.formula || '') : undefined;
}

const NOT_STORED = 'The server answered, but the saved form does not contain this change. '
  + 'Check updateFormulaDetails on the server (see the browser console for the request and response).';
const displayName = (f) => (f.kind === 'section-field' ? `${f.label} [${f.section}]` : f.label);


function appendValue(text, value, result) {
  if (['<=', '>=', '==', '!=', '&&', '||'].includes(value)) {
    const first = appendToFormula(text, value[0], result);
    if (first.error) return first;
    return appendToFormula(first.text, value[1], result);
  }
  return appendToFormula(text, value, result);
}

export default function FormulaWorkspace({ liveJson, formId, ensureSaved, onSynced }) {
  const fields = useMemo(() => formulaFields(liveJson), [liveJson]);
  const formulas = useMemo(() => existingFormulas(liveJson), [liveJson]);
  const formLabels = useMemo(() => fields.form.map((f) => f.label), [fields]);
  const allLabels = useMemo(
    () => [...formLabels, ...fields.sections.flatMap((s) => s.fields.map((f) => f.label))],
    [formLabels, fields]
  );
  const sectionFieldCount = fields.sections.reduce((n, s) => n + s.fields.length, 0);

  const [resultType, setResultType] = useState('form');
  const [result, setResult] = useState(null);
  const [history, setHistory] = useState({ list: [''], idx: 0 });
  const [editing, setEditing] = useState(null);
  const [error, setError] = useState('');
  const [status, setStatus] = useState(null);
  const [tab, setTab] = useState('form');
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState(null);
  const dragValue = useRef(null);
  const areaRef = useRef(null);

  const text = history.list[history.idx];
  const check = validateFormula(text);

  const push = (t) => setHistory((h) => {
    const list = [...h.list.slice(0, h.idx + 1), t].slice(-50);
    return { list, idx: list.length - 1 };
  });
  const resetEditor = (t = '') => setHistory({ list: [t], idx: 0 });

  const flash = (type, msg) => setStatus({ type, text: msg });
  useEffect(() => {
    if (!status || status.type === 'error') return undefined;
    const id = setTimeout(() => setStatus(null), 4000);
    return () => clearTimeout(id);
  }, [status]);


  useEffect(() => {
    if (!result) return;
    const exists = result.type === 'form'
      ? fields.form.some((f) => f.label === result.name)
      : fields.sections.some((s) => s.fields.some((f) => f.fullName === result.fullName));
    if (!exists) { setResult(null); resetEditor(''); setEditing(null); }
  }, [fields]);

  const focusArea = () => setTimeout(() => areaRef.current && areaRef.current.focus(), 0);

  const chooseResultType = (type) => {
    setResultType(type);
    setResult(null);
    setEditing(null);
    setError('');
    resetEditor('');
    setTab(type === 'form' ? 'form' : 'section');
  };

  const chooseResult = (value) => {
    setError('');
    setEditing(null);
    if (!value) { setResult(null); resetEditor(''); return; }
    if (resultType === 'form') {
      setResult({ name: value, fullName: value, type: 'form', section: '' });
      resetEditor(`${value} = `);
    } else {
      const name = value.split('[')[0].trim();
      const section = value.substring(value.indexOf('[') + 1, value.lastIndexOf(']')).trim();
      setResult({ name, fullName: value, type: 'section', section });
      resetEditor(`${name} = `);
    }
    focusArea();
  };

  const add = (value, context) => {
    if (!result) { setError('Please select a result field first'); return; }
    if (context && context !== result.type) {
      setError(`Cannot mix ${context} fields with ${result.type} fields`);
      return;
    }
    const r = appendValue(text, value, result);
    if (r.error) { setError(r.error); return; }
    setError('');
    push(r.text);
  };

  const doBackspace = () => {
    const t = backspaceFormula(text, allLabels, result);
    if (t !== text) push(t);
    setError('');
  };
  const clearFormula = () => { resetEditor(result ? `${result.name} = ` : ''); setError(''); };
  const undo = () => setHistory((h) => ({ ...h, idx: Math.max(0, h.idx - 1) }));
  const redo = () => setHistory((h) => ({ ...h, idx: Math.min(h.list.length - 1, h.idx + 1) }));


  const onKeyDown = (e) => {
    const k = e.key.toLowerCase();
    if ((e.ctrlKey || e.metaKey) && k === 'z') { e.preventDefault(); if (e.shiftKey) redo(); else undo(); return; }
    if ((e.ctrlKey || e.metaKey) && k === 'y') { e.preventDefault(); redo(); return; }
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    if (e.key === 'Backspace') { e.preventDefault(); doBackspace(); return; }
    if (e.key === 'Escape') { clearFormula(); return; }
    if (/^[0-9+\-*/%().<>=&|!]$/.test(e.key)) { e.preventDefault(); add(e.key); }
  };


  const applyFormula = (json, mainFieldValue, isSection, encoded, deps) => {
    if (isSection) {
      const bracket = mainFieldValue.indexOf('[');
      if (bracket === -1) return "Invalid section field format. Should be 'Field Name [Section Name]'";
      const fieldName = mainFieldValue.substring(0, bracket).trim();
      const sectionName = mainFieldValue.substring(bracket + 1, mainFieldValue.length - 1).trim();
      const section = (json.sections || []).find((s) => s.tableHeader === sectionName);
      if (!section) return `Section "${sectionName}" not found.`;
      const col = (section.tableColumns || []).find((c) => c.columnHeader === fieldName && c.inputType === 'number');
      if (!col) return `Field "${fieldName}" not found in section "${sectionName}".`;
      col.formula = encoded;
      col.formulaName = mainFieldValue;
      col.dependencies = deps;
      return '';
    }
    const comp = (json.components || []).find((c) => c.label === mainFieldValue && c.type === 'number');
    if (!comp) return `Field "${mainFieldValue}" not found.`;
    comp.formula = encoded;
    comp.formulaName = mainFieldValue;
    comp.dependencies = deps;
    return '';
  };

  const errorText = (e) => {
    let msg = e.message;
    try { msg = JSON.parse(e.xhr.responseText).message || msg; } catch { /* not JSON */ }
    return msg;
  };

  const save = async () => {
    const formula = text.trim();
    if (!result) { setError('Please select a result field'); return; }
    const { rightSide, hasEquals } = splitAtResult(formula);
    if (!formula) { setError('Formula is empty! Please create a formula first.'); return; }
    if (!hasEquals) { setError("Formula must contain '=' operator"); return; }
    if (!rightSide) { setError('Formula expression cannot be empty'); return; }
    if (!check.valid) { setError(check.message || 'Please fix the formula errors before saving.'); return; }

    const isSection = result.type === 'section';
    const mainFieldValue = result.fullName.trim();
    const isUpdate = !!editing;

    // checkFormulaExists()
    const same = formulas.find((f) => {
      if (editing && f.uiKey === editing.uiKey) return false;
      return displayName(f) === mainFieldValue && decodeHtmlEntities(f.formula || '').trim() === formula;
    });
    if (same) { setError('This formula already exists for this field. Please edit the existing formula instead.'); return; }

    const current = formulas.find((f) => displayName(f) === mainFieldValue);
    if (!isUpdate && current && !(await confirmDialog(`"${mainFieldValue}" already has a formula. Replace it?`))) return;

    setBusy(true);
    try {
      const saved = await ensureSaved();
      if (!saved) return;
      const json = clone(saved.json);
      const numberLabels = (json.components || []).filter((c) => c.type === 'number').map((c) => c.label);
      const deps = extractAllFieldsFromFormula(formula, numberLabels, json.sections || []);
      const encoded = escapeHtml(formula);
      const problem = applyFormula(json, mainFieldValue, isSection, encoded, deps);
      if (problem) { setError(problem); return; }

      const payload = {
        jsonData: JSON.stringify(json),
        hdnFormIdValue: saved.formId,
        formulaData: {
          fieldName: mainFieldValue,
          formula: encoded,
          isSectionField: isSection,
          dependencies: deps,
          formulaId: editing ? editing.formulaId : null,
        },
        isUpdate,
        isSection,
      };
      const res = await updateFormulaDetails(payload);
      const failed = explicitFailure(res);
      if (failed) { flash('error', 'Failed to save formula: ' + failed); return; }

      const serverJson = await onSynced(json, saved.formId);
      if (serverJson && storedFormula(serverJson, mainFieldValue, isSection) !== formula) {
        console.error('[SmartForms] Formula not found in the stored form after saving', { expected: formula, stored: storedFormula(serverJson, mainFieldValue, isSection) });
        flash('error', NOT_STORED);
        return;
      }
      setEditing(null);
      setResult(null);
      resetEditor('');
      setError('');
      flash('success', isUpdate ? 'Formula updated successfully!' : 'Formula saved successfully!');
    } catch (e) {
      console.error('Save formula failed', e, e.xhr && e.xhr.responseText);
      flash('error', 'Failed to save formula: ' + errorText(e));
    } finally {
      setBusy(false);
    }
  };

  const remove = async (f) => {
    if (!(await confirmDialog('Are you sure you want to delete this formula?'))) return;
    setBusy(true);
    try {
      const saved = await ensureSaved();
      if (!saved) return;
      const json = clone(saved.json);
      if (f.kind === 'section-field') {
        const section = (json.sections || []).find((s) => s.tableHeader === f.section);
        const col = section && (section.tableColumns || []).find((c) => c.id === f.formulaId || c.columnHeader === f.label);
        if (col) { col.formula = ''; col.formulaName = ''; col.dependencies = []; }
      } else {
        const comp = (json.components || []).find((c) => (c.id === f.formulaId || c.label === f.label) && c.type === 'number');
        if (comp) { comp.formula = ''; comp.formulaName = ''; comp.dependencies = []; }
      }
      const payload = {
        jsonData: JSON.stringify(json),
        hdnFormIdValue: saved.formId,
        deleteFormula: true,
        formulaId: f.formulaId,
      };
      const res = await updateFormulaDetails(payload);
      const failed = explicitFailure(res);
      if (failed) { flash('error', 'Failed to delete formula: ' + failed); return; }

      const serverJson = await onSynced(json, saved.formId);
      if (serverJson && storedFormula(serverJson, displayName(f), f.kind === 'section-field')) {
        flash('error', NOT_STORED);
        return;
      }
      if (editing && editing.uiKey === f.uiKey) { setEditing(null); setResult(null); resetEditor(''); }
      flash('success', 'Formula deleted successfully!');
    } catch (e) {
      console.error('Delete formula failed', e);
      flash('error', 'Failed to delete formula: ' + errorText(e));
    } finally {
      setBusy(false);
    }
  };

  const edit = (f) => {
    const decoded = decodeHtmlEntities(f.formula || '');
    const isSection = f.kind === 'section-field';
    setResultType(isSection ? 'section' : 'form');
    setTab(isSection ? 'section' : 'form');
    setResult(isSection
      ? { name: f.label, fullName: `${f.label} [${f.section}]`, type: 'section', section: f.section }
      : { name: f.label, fullName: f.label, type: 'form', section: '' });
    resetEditor(decoded);
    setEditing(f);
    setError('');
    flash('success', `Editing formula: ${f.label}`);
    focusArea();
  };

  const cancelEdit = () => { setEditing(null); setResult(null); resetEditor(''); setError(''); };

  const openPreview = (formula, resultName) => {
    if (!formula.trim()) { setError('Please create a formula first!'); return; }
    const v = validateFormula(formula);
    if (!v.valid) { setError(v.message || 'Please fix the formula errors before previewing.'); return; }
    setPreview({ formula, resultName });
  };


  const resultOptions = resultType === 'form'
    ? fields.form.map((f) => ({ value: f.label, label: f.label }))
    : fields.sections.flatMap((s) => s.fields.map((f) => ({ value: f.fullName, label: `${f.label} (${s.tableHeader})` })));

  const shownError = error || (!check.valid ? check.message : '');

  return (
    <div className="dfb-formulas">

      <div className="dfb-f-grid">
        {/* ---------- Formula Builder ---------- */}
        <div className="form-controls">
          <div className="tHeader"><div className="tHeaderLeft"><h1>{editing ? 'Edit Formula' : 'Formula Builder'}</h1></div></div>
          <div className="dfb-two dfb-mt8">
            <div className="form-group">
              <label htmlFor="dfb-f-type">Result Field Type</label>
              <select id="dfb-f-type" className="form-control" value={resultType} disabled={!!editing}
                onChange={(e) => chooseResultType(e.target.value)}>
                <option value="form">Form Fields</option>
                <option value="section" disabled={sectionFieldCount === 0}>
                  {sectionFieldCount === 0 ? 'Section Fields (none)' : 'Section Fields'}
                </option>
              </select>
            </div>
            <div className="form-group">
              <label htmlFor="dfb-f-result">{resultType === 'form' ? 'Form Result Field' : 'Section Result Field'}</label>
              <select id="dfb-f-result" className="form-control" value={result ? result.fullName : ''} disabled={!!editing}
                onChange={(e) => chooseResult(e.target.value)}>
                <option value="">{resultType === 'form' ? 'SELECT FORM FIELD' : 'SELECT SECTION FIELD'}</option>
                {resultOptions.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>
          </div>
          {resultOptions.length === 0 && (
            <p className="dfb-help">
              
            </p>
          )}

          <div className="form-group">
            <label id="dfb-f-expr-label">Formula Expression</label>
            <div
              ref={areaRef}
              className={`dfb-formula-area${!check.valid ? ' is-invalid' : ''}${!result ? ' is-disabled' : ''}`}
              tabIndex={0}
              role="textbox"
              aria-labelledby="dfb-f-expr-label"
              aria-invalid={!check.valid}
              onKeyDown={onKeyDown}
              onDragOver={(e) => { if (dragValue.current) e.preventDefault(); }}
              onDrop={(e) => {
                e.preventDefault();
                const d = dragValue.current;
                dragValue.current = null;
                if (d) add(d.value, d.context);
              }}
            >
              {text || <span className="dfb-muted">{result ? '' : 'Select a result field, then click or drag fields and operators here'}</span>}
              {!check.valid && <span className="dfb-formula-flag" title={check.message}>!</span>}
            </div>
            {shownError && <span className="dfb-error" role="alert">{shownError}</span>}
            <span className="dfb-help">  </span>
          </div>

          <div className="p5 text-center mtb10 dfb-f-actions">
            <button type="button" className="Button" onClick={undo} disabled={history.idx <= 0} title="Undo (Ctrl+Z)" aria-label="Undo">&#8630;</button>
            <button type="button" className="Button" onClick={redo} disabled={history.idx >= history.list.length - 1} title="Redo (Ctrl+Y)" aria-label="Redo">&#8631;</button>
            <button type="button" className="Button" onClick={() => openPreview(text.trim(), result ? result.fullName : '')} disabled={!result}>Preview</button>
            <button type="button" className="Button" onClick={save} disabled={busy || !result}>{busy ? 'Saving…' : editing ? 'Update' : 'Save'}</button>
            {editing && <button type="button" className="Button" onClick={cancelEdit}>Cancel</button>}
          </div>
          {status && <div className={`dfb-f-status is-${status.type}`} role="status">{status.text}</div>}
        </div>

        {/* ---------- Available Fields ---------- */}
        <div className="form-controls">
          <div className="tHeader"><div className="tHeaderLeft"><h1>Available Fields</h1></div></div>
          <div className="dfb-f-tabs" role="tablist">
            <button type="button" role="tab" aria-selected={tab === 'form'} className={tab === 'form' ? 'is-on' : ''} onClick={() => setTab('form')}>Form Fields</button>
            <button type="button" role="tab" aria-selected={tab === 'section'} className={tab === 'section' ? 'is-on' : ''} onClick={() => setTab('section')}>Section Fields</button>
          </div>
          {tab === 'form' ? (
            <div className="dfb-f-chips">
              {fields.form.length === 0 && <p className="dfb-help">No number fields in this form.</p>}
              {fields.form.map((f) => {
                const off = result && result.type !== 'form';
                return (
                  <button key={f.key} type="button" className="dfb-f-chip" draggable={!off} disabled={off}
                    title={off ? 'Section formulas can only use section fields' : `Add ${f.label}`}
                    onDragStart={(e) => { dragValue.current = { value: f.label, context: 'form' }; e.dataTransfer.setData('text/plain', f.label); }}
                    onClick={() => add(f.label, 'form')}>{f.label}</button>
                );
              })}
            </div>
          ) : (
            <div className="dfb-f-sections">
              {fields.sections.length === 0 && <p className="dfb-help">No sections found in this form.</p>}
              {fields.sections.map((s) => (
                <div key={s.tableId} className="dfb-f-section">
                  <div className="dfb-f-section-head"><b>{s.tableHeader || 'Unnamed Section'}</b><span>{s.fields.length} field(s)</span></div>
                  <div className="dfb-f-chips">
                    {s.fields.length === 0 && <span className="dfb-help">No number fields in this section</span>}
                    {s.fields.map((f) => {
                      const off = result && result.type !== 'section';
                      return (
                        <button key={f.key} type="button" className="dfb-f-chip is-section" draggable={!off} disabled={off}
                          title={off ? 'Form formulas can only use form fields' : `Add ${f.label}`}
                          onDragStart={(e) => { dragValue.current = { value: f.fullName, context: 'section' }; e.dataTransfer.setData('text/plain', f.label); }}
                          onClick={() => add(f.fullName, 'section')}>{f.label}</button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ---------- Calculator ---------- */}
        <div className="form-controls">
          <div className="tHeader"><div className="tHeaderLeft"><h1>Calculator</h1></div></div>
          <div className="dfb-calc">
            {CALC_KEYS.map(([value, label]) => {
              if (value === 'CLEAR') {
                return <button key={value} type="button" className="dfb-calc-btn is-action" onClick={clearFormula} title="Clear" aria-label="Clear">{label}</button>;
              }
              if (value === 'BACK') {
                return <button key={value} type="button" className="dfb-calc-btn is-action" onClick={doBackspace} title="Backspace" aria-label="Backspace">{label}</button>;
              }
              return (
                <button key={value} type="button" className={`dfb-calc-btn${/^\d$/.test(value) ? ' is-num' : ''}`} draggable
                  onDragStart={(e) => { dragValue.current = { value }; e.dataTransfer.setData('text/plain', value); }}
                  onClick={() => add(value)} aria-label={value}>{label}</button>
              );
            })}
          </div>
        </div>
      </div>

      {/* ---------- All Existing Formulas ---------- */}
      <div className="form-controls">
        <div className="tHeader"><div className="tHeaderLeft"><h1>All Existing Formulas</h1></div></div>
        <div className="dfb-table-scroll">
          <table className="tablesorter-blue dfb-mt8" width="100%">
            <thead>
              <tr>
                <th><span className="TextHead">S.No.</span></th>
                <th><span className="TextHead">Result Field</span></th>
                <th><span className="TextHead">Formula</span></th>
                <th><span className="TextHead">Type</span></th>
                <th><span className="TextHead">Action</span></th>
              </tr>
            </thead>
            <tbody>
              {formulas.length === 0 && (
                <tr><td colSpan={5} style={{ textAlign: 'center' }}>No formulas found. Create your first formula!</td></tr>
              )}
              {formulas.map((f, i) => {
                const name = displayName(f);
                const decoded = decodeHtmlEntities(f.formula || '');
                return (
                  <tr key={f.uiKey} className={editing && editing.uiKey === f.uiKey ? 'dfb-row-editing' : ''}>
                    <td className="tdCenter">{i + 1}</td>
                    <td className="dfb-td-left">{name}</td>
                    <td className="dfb-td-left dfb-formula-cell">{decoded}</td>
                    <td className="tdCenter">{f.kind === 'section-field' ? 'Section' : 'Form'}</td>
                    <td className="tdCenter dfb-nowrap">
                      <button type="button" className="ButtonSmall" onClick={() => openPreview(decoded, name)}>Preview</button>
                      <button type="button" className="ButtonSmall" onClick={() => edit(f)} disabled={busy}>Edit</button>
                      <button type="button" className="ButtonSmall dfb-danger" onClick={() => remove(f)} disabled={busy}>Delete</button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {preview && (
        <FormulaPreview
          formula={preview.formula}
          resultName={preview.resultName}
          labels={allLabels}
          sections={liveJson.sections || []}
          onClose={() => setPreview(null)}
        />
      )}
    </div>
  );
}

/** "Formula Preview" popup with live calculation and "Try Demo Values" */
function FormulaPreview({ formula, resultName, labels, sections, onClose }) {
  const resultLabel = splitAtResult(formula).leftSide;
  const used = useMemo(
    () => extractAllFieldsFromFormula(formula, labels, sections).filter((f) => f !== resultLabel),
    [formula, labels, sections, resultLabel]
  );
  const [values, setValues] = useState({});
  const comparison = isComparisonFormula(formula);

  let out = '';
  let tone = '';
  const filled = used.filter((f) => values[f] !== undefined && values[f] !== '');
  if (filled.length === used.length) {
    try {
      const nums = {};
      used.forEach((f) => { nums[f] = parseFloat(values[f]); });
      const r = calculate(formula, nums);
      if (typeof r === 'boolean') {
        out = r ? '✓ Valid' : '✗ Invalid';
        tone = r ? 'ok' : 'bad';
      } else if (Number.isFinite(r)) {
        out = String(Math.round(r * 1e10) / 1e10);
      } else {
        out = 'Not a number (check division by zero)';
        tone = 'bad';
      }
    } catch (e) {
      out = 'Error: ' + e.message;
      tone = 'bad';
    }
  }

  useEffect(() => {
    const esc = (e) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', esc);
    return () => document.removeEventListener('keydown', esc);
  }, [onClose]);

  const demo = () => {
    const v = {};
    used.forEach((f, i) => { v[f] = String(10 + i * 5); });
    setValues(v);
  };

  return (
    <div className="popup dfb-popup" style={{ display: 'block' }} onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="popupContent dfb-popup-content dfb-popup-wide" role="dialog" aria-modal="true" aria-labelledby="dfb-fp-title">
        <div className="popupHeader">
          <div className="pageTitle" id="dfb-fp-title">Formula Preview</div>
          <span className="close" role="button" tabIndex={0} aria-label="Close" onClick={onClose}
            onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && onClose()}>x</span>
        </div>
        <div className="contentBody">
          <div className="dfb-formula-display">Formula: {formula}</div>
          <div className="dfb-fp-grid">
            {used.map((f) => (
              <div key={f} className="form-group">
                <label htmlFor={`dfb-fp-${f}`}>{f}</label>
                <input id={`dfb-fp-${f}`} type="number" step="any" className="form-control" placeholder="Enter value"
                  value={values[f] ?? ''} onChange={(e) => setValues((x) => ({ ...x, [f]: e.target.value }))} />
              </div>
            ))}
            <div className="form-group dfb-fp-result">
              <label htmlFor="dfb-fp-result">{comparison ? 'Validation Result' : resultName}</label>
              <input id="dfb-fp-result" type="text" readOnly className={`form-control${tone ? ` is-${tone}` : ''}`}
                placeholder={comparison ? 'Validation result will appear here' : 'Calculated result will appear here'} value={out} />
            </div>
          </div>
        </div>
        <div className="p5 text-center mtb10">
          <input type="button" className="Button" value="Try Demo Values" onClick={demo} />
          <input type="button" className="Button" value="Close" onClick={onClose} />
        </div>
      </div>
    </div>
  );
}
