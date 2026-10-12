import { richHtml } from './FieldControl';
import React, { useEffect, useRef, useState } from 'react';
import Icon from './Icon';
import DynamicSourceEditor from './DynamicSourceEditor';
import { defaultSource, dependentColumns, parentColumns } from '../model/dynamicSource';
import { COLUMN_TYPES, CHOICE_COLUMN_TYPES, PATTERNS, newChoiceValue } from '../model/schema';

export function RichTextEditor({ itemKey, value, onChange }) {
  const ref = useRef(null);
  const [imgUrl, setImgUrl] = useState('');

  
  useEffect(() => {
    if (ref.current) ref.current.innerHTML = richHtml(value);
  
  }, [itemKey]);

  const exec = (cmd, arg) => {
    ref.current && ref.current.focus();
    document.execCommand(cmd, false, arg);
    onChange(ref.current.innerHTML);
  };

  const insertImage = () => {
    const u = imgUrl.trim();
    if (!/^(https?:\/\/|\/|data:image\/)/i.test(u)) return;
    ref.current.focus();
    document.execCommand('insertHTML', false, `<img src="${u.replace(/"/g, '&quot;')}" alt="" style="max-width:100%">`);
    onChange(ref.current.innerHTML);
    setImgUrl('');
  };

  const tools = [
    ['H2', () => exec('formatBlock', 'H2'), 'Heading'],
    ['H3', () => exec('formatBlock', 'H3'), 'Subheading'],
    ['P', () => exec('formatBlock', 'P'), 'Paragraph'],
    [<Icon key="b" name="bold" size={15} />, () => exec('bold'), 'Bold'],
    [<Icon key="i" name="italic" size={15} />, () => exec('italic'), 'Italic'],
    [<Icon key="u" name="underline" size={15} />, () => exec('underline'), 'Underline'],
    [<Icon key="l" name="list" size={15} />, () => exec('insertUnorderedList'), 'Bulleted list'],
    [<Icon key="d" name="divider" size={15} />, () => exec('insertHorizontalRule'), 'Divider line'],
  ];

  return (
    <div className="dfb-rte">
      <div className="dfb-rte-bar" role="toolbar" aria-label="Text formatting">
        {tools.map(([label, fn, title], i) => (
          <button key={i} type="button" className="dfb-rte-btn" title={title} aria-label={title}
            onMouseDown={(e) => e.preventDefault()} onClick={fn}>{label}</button>
        ))}
      </div>
      <div
        ref={ref}
        className="dfb-rte-area dfb-rich-out"
        contentEditable
        suppressContentEditableWarning
        onInput={(e) => onChange(e.currentTarget.innerHTML)}
        aria-label="Block content"
        role="textbox"
        aria-multiline="true"
      />
      <div className="dfb-row dfb-mt8">
        <input className="form-control" placeholder="Image URL" value={imgUrl} onChange={(e) => setImgUrl(e.target.value)} aria-label="Image URL" />
        <button type="button" className="ButtonSmall dfb-small" onClick={insertImage} disabled={!imgUrl.trim()}>Insert image</button>
      </div>
    </div>
  );
}


export function OptionsEditor({ comp, onChange }) {
  const isSelect = comp.type === 'select';
  const placeholder = (comp.options || []).filter((o) => o.isPlaceholder);
  const opts = (comp.options || []).filter((o) => !o.isPlaceholder);
  const [bulk, setBulk] = useState(null);

  const commit = (next) => onChange([...placeholder, ...next]);

  const rename = (i, label) =>
    commit(opts.map((o, j) => {
      if (j !== i) return o;
      
      if (isSelect && (!o.value || o.value === o.label)) return { ...o, label, value: label };
      return { ...o, label };
    }));

  const add = () => {
    const label = `Option ${opts.length + 1}`;
    commit([...opts, isSelect ? { value: label, label, selected: false } : { value: newChoiceValue(comp.type, opts.length), label }]);
  };

  const move = (i, d) => {
    const n = [...opts];
    const [x] = n.splice(i, 1);
    n.splice(i + d, 0, x);
    commit(n);
  };

  const applyBulk = () => {
    const labels = bulk.split('\n').map((s) => s.trim()).filter(Boolean);
    const byLabel = new Map(opts.map((o) => [o.label, o]));
    commit(labels.map((l, i) => byLabel.get(l) || (isSelect ? { value: l, label: l, selected: false } : { value: newChoiceValue(comp.type, i), label: l })));
    setBulk(null);
  };

  return (
    <div className="dfb-options">
      <div className="dfb-prop-label-row">
        <span className="dfb-prop-label">Options</span>
        <button type="button" className="dfb-link-btn" onClick={() => setBulk(bulk === null ? opts.map((o) => o.label).join('\n') : null)}>
          {bulk === null ? 'Edit as list' : 'Cancel'}
        </button>
      </div>
      {bulk !== null ? (
        <>
          <textarea className="form-control dfb-tall" rows={6} value={bulk} onChange={(e) => setBulk(e.target.value)} aria-label="One option per line" />
          <p className="dfb-help">One option per line.</p>
          <button type="button" className="ButtonSmall dfb-small" onClick={applyBulk}>Apply</button>
        </>
      ) : (
        <>
          <ul className="dfb-opt-list">
            {opts.map((o, i) => (
              <li key={o.value + ':' + i}>
                <input className="form-control" value={o.label} onChange={(e) => rename(i, e.target.value)} aria-label={`Option ${i + 1}`} />
                <button type="button" className="dfb-tool" title="Move up" disabled={i === 0} onClick={() => move(i, -1)}><Icon name="up" size={14} /></button>
                <button type="button" className="dfb-tool" title="Move down" disabled={i === opts.length - 1} onClick={() => move(i, 1)}><Icon name="down" size={14} /></button>
                <button type="button" className="dfb-tool dfb-tool-danger" title="Remove option" disabled={opts.length <= 1}
                  onClick={() => commit(opts.filter((_, j) => j !== i))}><Icon name="close" size={14} /></button>
              </li>
            ))}
          </ul>
          <button type="button" className="ButtonSmall dfb-small" onClick={add}><Icon name="plus" size={14} /> Add option</button>
        </>
      )}
    </div>
  );
}


export function SectionEditor({ sec, onChange, formulaUsage = {}, formFields = [] }) {
  const cols = sec.tableColumns || [];
  const [open, setOpen] = useState(0);
  const setCols = (next) => onChange({ ...sec, tableColumns: next });
  const patch = (i, p) => setCols(cols.map((c, j) => (j === i ? { ...c, ...p } : c)));
  /** Rename a column and keep dynamic-dropdown links (params reading this column) pointing at it */
  const renameColumn = (i, header) => {
    const old = cols[i].columnHeader;
    setCols(cols.map((c, j) => {
      if (j === i) return { ...c, columnHeader: header };
      if (!c.dataSource || !old) return c;
      return {
        ...c,
        dataSource: {
          ...c.dataSource,
          params: (c.dataSource.params || []).map((p) => (p.source === 'column' && p.column === old ? { ...p, column: header } : p)),
        },
      };
    }));
  };
  const changeType = (i, value) => {
    const c = cols[i];
    if (value === 'dynamicDropdown') {
      patch(i, { inputType: 'dropdown', dataSource: c.dataSource || defaultSource(), options: undefined, validations: {}, pattern: undefined });
      return;
    }
    patch(i, {
      inputType: value, dataSource: undefined, validations: {}, pattern: undefined,
      options: CHOICE_COLUMN_TYPES.includes(value) ? c.options || [{ value: 'Option 1', label: 'Option 1', selected: false }] : undefined,
    });
  };
  const patchV = (i, p) => patch(i, { validations: { ...(cols[i].validations || {}), ...p } });

  const move = (i, d) => {
    const n = [...cols];
    const [x] = n.splice(i, 1);
    n.splice(i + d, 0, x);
    setCols(n);
    setOpen(i + d);
  };

  return (
    <div className="dfb-props-body">
      <Field label="Table name">
        <input className="form-control" value={sec.tableHeader} maxLength={60} onChange={(e) => onChange({ ...sec, tableHeader: e.target.value })} />
      </Field>
      <div className="dfb-prop-label-row">
        <span className="dfb-prop-label">Columns</span>
        <span className="dfb-help">{cols.length} of 12</span>
      </div>
      <ol className="dfb-col-list">
        {cols.map((c, i) => {
          const isOpen = open === i;
          const t = c.inputType;
          const ut = c.dataSource ? 'dynamicDropdown' : t === 'dates' ? 'date' : t === 'select' ? 'dropdown' : t;
          return (
            <li key={i} className={isOpen ? 'is-open' : ''}>
              <div className="dfb-col-head">
                <button type="button" className="dfb-col-toggle" onClick={() => setOpen(isOpen ? -1 : i)} aria-expanded={isOpen}>
                  <span>{c.columnHeader || 'Untitled column'}</span>
                  <small>{(COLUMN_TYPES.find((x) => x.value === ut) || { label: t }).label}</small>
                </button>
                <button type="button" className="dfb-tool" title="Move left" disabled={i === 0} onClick={() => move(i, -1)}><Icon name="up" size={14} /></button>
                <button type="button" className="dfb-tool" title="Move right" disabled={i === cols.length - 1} onClick={() => move(i, 1)}><Icon name="down" size={14} /></button>
                <button type="button" className="dfb-tool dfb-tool-danger" title="Delete column" disabled={cols.length <= 1}
                  onClick={() => { setCols(cols.filter((_, j) => j !== i)); setOpen(-1); }}><Icon name="trash" size={14} /></button>
              </div>
              {isOpen && (
                <div className="dfb-col-body">
                  <Field label="Column header">
                    <input className="form-control" value={c.columnHeader} onChange={(e) => renameColumn(i, e.target.value)} />
                  </Field>
                  {t === 'number' && (c.formula || (formulaUsage[String(c.columnHeader || '').toLowerCase()] || []).length > 0) && (
                    <div className="dfb-formula-note" role="note">
                      {c.formula ? 'Calculated by formula. ' : ''}
                      {(formulaUsage[String(c.columnHeader || '').toLowerCase()] || []).length > 0 &&
                        `Used in: ${formulaUsage[String(c.columnHeader || '').toLowerCase()].join(', ')}. `}
                      Formulas refer to columns by header; update them after renaming.
                    </div>
                  )}
                  <Field label="Answer type">
                    <select className="form-control" value={ut} onChange={(e) => changeType(i, e.target.value)}>
                      {COLUMN_TYPES.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                    </select>
                  </Field>
                  <Toggle label="Required" checked={c.required === 'yes'} onChange={(v) => patch(i, { required: v ? 'yes' : 'no' })} />
                  {c.dataSource && (
                    <DynamicSourceEditor
                      uid={`${sec.tableId}-c${i}`}
                      ds={c.dataSource}
                      context="column"
                      fields={formFields}
                      columns={cols.map((x) => x.columnHeader)
                        .filter((h) => h && h !== c.columnHeader && !dependentColumns(c.columnHeader, cols).includes(h))}
                      usedBy={cols.filter((x) => x.dataSource && parentColumns(x.dataSource).includes(c.columnHeader)).map((x) => x.columnHeader)}
                      onChange={(dataSource) => patch(i, { dataSource })}
                    />
                  )}
                  {CHOICE_COLUMN_TYPES.includes(t) && !c.dataSource && (
                    <Field label="Options (one per line)">
                      <textarea className="form-control dfb-tall" rows={4}
                        value={(c.options || []).map((o) => o.label).join('\n')}
                        onChange={(e) => patch(i, { options: e.target.value.split('\n').map((l) => ({ value: l, label: l, selected: false })) })} />
                    </Field>
                  )}
                  {(t === 'text' || t === 'textarea') && (
                    <>
                      <Field label="Allowed characters">
                        <PatternSelect value={(c.validations || {}).pattern || c.pattern || ''} onChange={(v) => patchV(i, { pattern: v })} />
                      </Field>
                      <div className="dfb-two">
                        <Field label="Min length"><input className="form-control" type="number" min="0" value={(c.validations || {}).minLength || ''} onChange={(e) => patchV(i, { minLength: e.target.value })} /></Field>
                        <Field label="Max length"><input className="form-control" type="number" min="0" value={(c.validations || {}).maxLength || ''} onChange={(e) => patchV(i, { maxLength: e.target.value })} /></Field>
                      </div>
                    </>
                  )}
                  {t === 'number' && (
                    <div className="dfb-two">
                      <Field label="Minimum"><input className="form-control" type="number" value={(c.validations || {}).min || ''} onChange={(e) => patchV(i, { min: e.target.value })} /></Field>
                      <Field label="Maximum"><input className="form-control" type="number" value={(c.validations || {}).max || ''} onChange={(e) => patchV(i, { max: e.target.value })} /></Field>
                    </div>
                  )}
                  {t === 'file' && (
                    <>
                      <Field label="Allowed file types"><input className="form-control" placeholder=".pdf,.jpg" value={(c.validations || {}).fileTypes || ''} onChange={(e) => patchV(i, { fileTypes: e.target.value })} /></Field>
                      <div className="dfb-two">
                        <Field label="Min size (MB)"><input className="form-control" type="number" min="0" value={(c.validations || {}).minSize || ''} onChange={(e) => patchV(i, { minSize: e.target.value })} /></Field>
                        <Field label="Max size (MB)"><input className="form-control" type="number" min="0" value={(c.validations || {}).maxSize || ''} onChange={(e) => patchV(i, { maxSize: e.target.value })} /></Field>
                      </div>
                    </>
                  )}
                </div>
              )}
            </li>
          );
        })}
      </ol>
      <button type="button" className="ButtonSmall dfb-small" disabled={cols.length >= 12}
        onClick={() => { setCols([...cols, { id: `col_${Date.now().toString(36)}`, columnHeader: `Column Header ${cols.length + 1}`, inputType: 'text', required: 'no' }]); setOpen(cols.length); }}>
        <Icon name="plus" size={14} /> Add column
      </button>
    </div>
  );
}


export function Field({ label, help, children, error }) {
  return (
    <label className="dfb-prop">
      <span className="dfb-prop-label">{label}</span>
      {children}
      {error ? <span className="dfb-error">{error}</span> : help ? <span className="dfb-help">{help}</span> : null}
    </label>
  );
}

export function Toggle({ label, checked, onChange, help }) {
  return (
    <label className="dfb-toggle">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span className="dfb-toggle-track" aria-hidden="true"><span /></span>
      <span className="dfb-toggle-text">
        {label}
        {help && <small>{help}</small>}
      </span>
    </label>
  );
}

export function PatternSelect({ value, onChange }) {
  const known = PATTERNS.some((p) => p.value === (value || ''));
  return (
    <select className="form-control" value={value || ''} onChange={(e) => onChange(e.target.value)}>
      {PATTERNS.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
      {!known && <option value={value}>Custom: {value}</option>}
    </select>
  );
}

export function Segmented({ value, options, onChange, label }) {
  return (
    <div className="dfb-seg" role="radiogroup" aria-label={label}>
      {options.map((o) => (
        <button key={o.value} type="button" role="radio" aria-checked={value === o.value}
          className={value === o.value ? 'is-on' : ''} onClick={() => onChange(o.value)}>
          {o.label}
        </button>
      ))}
    </div>
  );
}
