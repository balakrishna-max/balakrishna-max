import React, { useEffect, useRef } from 'react';
import { USER_GROUPS, CHOICE_COLUMN_TYPES } from '../model/schema';
import { useAsset } from '../config/AppContext';
import { isDynamic } from '../model/dynamicSource';


function dynamicStatus(dyn, placeholder, linkNames) {
  if (!dyn) return { text: placeholder, disabled: true };
  switch (dyn.status) {
    case 'unset': return { text: 'API URL not set', disabled: true };
    case 'waiting': return { text: `Select ${linkNames(dyn.missing)} first`, disabled: true };
    case 'loading': return { text: 'Loading…', disabled: true };
    case 'error': return { text: 'Could not load options', disabled: true };
    default: return { text: dyn.options.length ? placeholder : 'No options found', disabled: dyn.options.length === 0 };
  }
}

export function DynamicSelect({ id, ds, dyn, value, onChange, onRetry, className = 'form-control', linkNames = (m) => (m || []).join(', '), ariaLabel, invalid }) {
  const placeholder = (ds && ds.placeholder) || '-Select-';
  const st = dynamicStatus(dyn, placeholder, linkNames);
  return (
    <>
      <select id={id} className={className} value={value || ''} disabled={st.disabled} aria-label={ariaLabel}
        aria-invalid={invalid ? 'true' : undefined} aria-busy={dyn && dyn.status === 'loading' ? 'true' : undefined}
        onChange={(e) => onChange(e.target.value)}>
        <option value="">{st.text}</option>
        {dyn && dyn.status === 'ready' && dyn.options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
      {dyn && dyn.status === 'error' && (
        <span className="dfb-ds-inline-err" role="alert">
          {dyn.message}{' '}
          {onRetry && <button type="button" className="dfb-link-btn" onClick={onRetry}>Retry</button>}
        </span>
      )}
    </>
  );
}


export function SignaturePad({ id, value, onChange, penColor = '#000000', height = 160, disabled }) {
  const canvasRef = useRef(null);
  const drawing = useRef(false);
  const dirty = useRef(false);


  useEffect(() => {
    const c = canvasRef.current;
    if (!c) return;
    const ratio = window.devicePixelRatio || 1;
    const w = c.clientWidth || 300;
    c.width = Math.round(w * ratio);
    c.height = Math.round(Number(height) * ratio);
    const ctx = c.getContext('2d');
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    ctx.clearRect(0, 0, w, Number(height));
    if (value) {
      const img = new Image();
      img.onload = () => ctx.drawImage(img, 0, 0, w, Number(height));
      img.src = value;
    }
    dirty.current = !!value;
  }, [height, value === '' || value == null]);

  const point = (e) => {
    const r = canvasRef.current.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  };
  const down = (e) => {
    if (disabled) return;
    e.preventDefault();
    canvasRef.current.setPointerCapture(e.pointerId);
    drawing.current = true;
    const ctx = canvasRef.current.getContext('2d');
    const p = point(e);
    ctx.strokeStyle = penColor;
    ctx.lineWidth = 2.2;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(p.x, p.y);
    ctx.lineTo(p.x + 0.01, p.y + 0.01);
    ctx.stroke();
  };
  const move = (e) => {
    if (!drawing.current) return;
    const ctx = canvasRef.current.getContext('2d');
    const p = point(e);
    ctx.lineTo(p.x, p.y);
    ctx.stroke();
    dirty.current = true;
  };
  const up = () => {
    if (!drawing.current) return;
    drawing.current = false;
    dirty.current = true;
    onChange(canvasRef.current.toDataURL('image/png'));
  };
  const clear = () => {
    const c = canvasRef.current;
    c.getContext('2d').clearRect(0, 0, c.width, c.height);
    dirty.current = false;
    onChange('');
  };

  return (
    <div className="dfb-sign">
      <canvas id={id} ref={canvasRef} className="dfb-sign-pad" style={{ height: `${Number(height)}px` }}
        role="img" aria-label="Signature pad. Draw with the mouse, a pen or a finger."
        onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up} onPointerLeave={up} />
      <div className="dfb-sign-bar">
        <span className="dfb-help">{value ? 'Signed' : 'Sign inside the box'}</span>
        {!disabled && <button type="button" className="dfb-link-btn" onClick={clear} disabled={!value}>Clear</button>}
      </div>
    </div>
  );
}


const Mandatory = () => <span className="mandatory"> *</span>;


const TYPO_KEYS = ['fontSize', 'color', 'fontFamily', 'fontWeight', 'fontStyle', 'textDecoration', 'textTransform', 'letterSpacing', 'lineHeight', 'textAlign'];
export function typography(styles) {
  if (!styles) return undefined;
  const out = {};
  TYPO_KEYS.forEach((k) => { if (styles[k]) out[k] = styles[k]; });
  return Object.keys(out).length ? out : undefined;
}


export function richHtml(content) {
  const c = content || '';
  if (c.includes('&lt;') && !/<[a-zA-Z!/]/.test(c)) {
    const t = document.createElement('textarea');
    t.innerHTML = c;
    return t.value;
  }
  return c;
}


function FormulaNote({ formula }) {
  if (!formula) return null;
  const c = formula.cond;
  return (
    <div className="dfb-f-rt">
      <span className="dfb-f-rt-formula"><b>Formula:</b> {formula.formula}</span>
      {c && c.ok === true && <span className="dfb-f-rt-ok"> ✓ Condition satisfied</span>}
      {c && c.ok === false && <span className="dfb-f-rt-bad"> ✗ Condition not satisfied</span>}
      {c && c.ok === null && c.missing && c.missing.length > 0 && (
        <span className="dfb-f-rt-wait"> Enter {c.missing.join(', ')} to check</span>
      )}
      {formula.calculated && formula.missing && formula.missing.length > 0 && (
        <span className="dfb-f-rt-wait"> Enter {formula.missing.join(', ')} to calculate</span>
      )}
      {formula.message && <span className="dfb-f-rt-bad"> {formula.message}</span>}
    </div>
  );
}

export function FieldControl({ comp, mode = 'design', value, onChange, error, formula, dyn, onRetry, fieldLabel }) {
  const design = mode === 'design';
  const asset = useAsset();
  const fileRef = useRef(null);
  const id = `dfb-${mode}-${comp.id}`;
  const set = (v) => onChange && onChange(comp.id, v);

  if (comp.type === 'richtext') {
    return <div className="dfb-rich-out" dangerouslySetInnerHTML={{ __html: richHtml(comp.content) }} />;
  }

  const label = (
    <label htmlFor={id} style={typography(comp.labelStyles)}>
      {comp.label || <span className="dfb-muted">Untitled field</span>}
      {comp.required === 'yes' && <Mandatory />}
    </label>
  );

  const inputProps = {
    id,
    name: id,
    className: 'form-control',
    tabIndex: design ? -1 : undefined,
    readOnly: design || !!(formula && formula.calculated),
    'aria-invalid': error ? 'true' : undefined,
  };
  const calculated = !design && formula && formula.calculated;
  const condState = !design && formula && formula.cond ? formula.cond.ok : null;

  let control;
  switch (comp.type) {
    case 'textarea':
      control = (
        <textarea {...inputProps} placeholder={comp.placeholder || 'Enter text'} maxLength={comp.maxlength || undefined}
          value={design ? '' : value || ''} onChange={(e) => set(e.target.value)} />
      );
      break;

    case 'number':
      control = (
        <input {...inputProps} type="number" placeholder={calculated ? 'Auto-Calculated' : 'Enter no'}
          className={`form-control${calculated ? ' dfb-calculated' : ''}${condState === true ? ' dfb-cond-ok' : condState === false ? ' dfb-cond-bad' : ''}`}
          tabIndex={design || calculated ? -1 : undefined}
          min={comp.min ?? undefined} max={comp.max ?? undefined} step={comp.step ?? undefined}
          value={design ? '' : value ?? ''} onChange={(e) => { if (!calculated) set(e.target.value); }} />
      );
      break;

    case 'date':
    case 'dates':
      control = design ? (
        
        <input {...inputProps} type="text" className="form-control dateIcon" placeholder="Select date" />
      ) : (
        <input {...inputProps} type="date" min={comp.minDate || undefined} max={comp.maxDate || undefined}
          value={value || ''} onChange={(e) => set(e.target.value)} />
      );
      break;

    case 'select':
      if (isDynamic(comp)) {
        control = design ? (
          <select {...inputProps} disabled value="">
            <option value="">{comp.dataSource.url ? (comp.dataSource.placeholder || '-Select-') : 'API URL not set'}</option>
          </select>
        ) : (
          <DynamicSelect id={id} ds={comp.dataSource} dyn={dyn} value={value} invalid={!!error}
            onChange={(v) => set(v)} onRetry={onRetry}
            linkNames={(missing) => (missing || []).map((n) => (fieldLabel ? fieldLabel(comp, n) : n)).join(', ')} />
        );
        break;
      }
      control = (
        <select {...inputProps} disabled={design} value={design ? '' : value || ''} onChange={(e) => set(e.target.value)}>
          <option value="">-Select-</option>
          {(comp.options || []).filter((o) => !o.isPlaceholder).map((o, i) => (
            <option key={i} value={o.value || o.label}>{o.label}</option>
          ))}
        </select>
      );
      break;

    case 'radio':
    case 'checkbox': {
      const multi = comp.type === 'checkbox';
      const cur = multi ? value || [] : value || '';
      control = (
        <div className={multi ? 'dfb-check-group' : 'radio-container'}
          role={multi ? 'group' : 'radiogroup'} aria-label={comp.label}>
          {(comp.options || []).map((o, i) => {
            const oid = `${id}_${i}`;
            return (
              <React.Fragment key={i}>
                <input id={oid} type={comp.type} name={id} tabIndex={design ? -1 : undefined} disabled={design}
                  checked={design ? false : multi ? cur.includes(o.value) : cur === o.value}
                  onChange={(e) => set(multi ? (e.target.checked ? [...cur, o.value] : cur.filter((v) => v !== o.value)) : o.value)} />
                <label htmlFor={oid} style={typography(o.labelStyles)}>{o.label}</label>
              </React.Fragment>
            );
          })}
        </div>
      );
      break;
    }

    // case 'signature':
    //   control = design ? (
    //     <div className="dfb-sign-design" style={{ height: `${Number(comp.height || 160)}px` }}>Sign here</div>
    //   ) : (
    //     <SignaturePad id={id} value={value} onChange={(v) => set(v)} penColor={comp.penColor || '#000000'} height={comp.height || 160} />
    //   );
    //   break;

    case 'file': {
      const files = !design && value ? Array.from(value) : [];
      const hint = [comp.fileTypes, comp.max ? `max ${comp.max} MB` : null, comp.multiple === 'yes' ? 'multiple files' : null]
        .filter(Boolean).join(', ');
      control = (
        <div className="fileInputGroup-icon" style={{ width: 'fit-content' }}>
          <input ref={fileRef} id={id} type="file" className="form-control dnone" tabIndex={-1}
            accept={comp.fileTypes || undefined} multiple={comp.multiple === 'yes'}
            onChange={(e) => set(e.target.files && e.target.files.length ? e.target.files : null)} />
          <a data-tooltip="Upload File" role="button" tabIndex={design ? -1 : 0}
            onClick={() => !design && fileRef.current && fileRef.current.click()}
            onKeyDown={(e) => !design && (e.key === 'Enter' || e.key === ' ') && fileRef.current.click()}>
            <img src={asset('resources/assets/icons/file_upload.svg')} alt="Upload file" />
          </a>
          {files.length > 0 && <span className="dfb-file-name">{files.map((f) => f.name).join(', ')}</span>}
          {hint && <small className="dfb-file-hint">{hint}</small>}
        </div>
      );
      break;
    }

    default:
      control = (
        <input {...inputProps} type={comp.inputType === 'email' ? 'email' : comp.inputType === 'tel' ? 'tel' : 'text'}
          placeholder={comp.placeholder || 'Enter text'} maxLength={comp.maxlength || undefined}
          value={design ? '' : value || ''} onChange={(e) => set(e.target.value)} />
      );
  }

  return (
    <div className="form-group dfb-field">
      {label}
      {control}
      {comp.type === 'number' && design && (
        <div className="dfb-hint">
          Filled by {(USER_GROUPS.find((g) => g.value === comp.userGroupType) || USER_GROUPS[0]).label}
          {comp.formula ? ', calculated by formula' : ''}
        </div>
      )}
      {design && isDynamic(comp) && (
        <div className="dfb-hint">
          Options from API{fieldLabel && comp.dataSource.params && comp.dataSource.params.some((p) => p.source === 'field')
            ? `, linked to ${comp.dataSource.params.filter((p) => p.source === 'field').map((p) => fieldLabel(comp, p.name)).join(', ')}` : ''}
        </div>
      )}
      {!design && <FormulaNote formula={formula} />}
      {error && <span className="dfb-error" role="alert">{error}</span>}
    </div>
  );
}


export function SectionTable({ sec, mode = 'design', rows = [{}], onRowsChange, rowFormulas, rowDyn, onRetryCell, onCellChange }) {
  const design = mode === 'design';
  const cols = sec.tableColumns || [];

  const cell = (col, r, ri) => {
    const rf = !design && rowFormulas && rowFormulas[ri];
    const rule = rf && rf.rules && rf.rules[col.id];
    if (rule && rule.isCalculation && col.inputType === 'number') {
      const cv = rf.values[col.id];
      const miss = rf.calc[col.id] && rf.calc[col.id].missing;
      return (
        <input className="form-control dfb-calculated" type="number" readOnly tabIndex={-1}
          placeholder="Auto-Calculated" value={cv ?? ''} aria-label={`${col.columnHeader}, row ${ri + 1}`}
          title={miss && miss.length ? `Enter ${miss.join(', ')} to calculate` : rule.formula} />
      );
    }
    const v = r[col.id];
    const set = (val) => {
      if (onCellChange) onCellChange(ri, col, val);
      else if (onRowsChange) onRowsChange(rows.map((x, i) => (i === ri ? { ...x, [col.id]: val } : x)));
    };
    if (isDynamic(col)) {
      if (design) {
        return (
          <select className="form-control" disabled tabIndex={-1} value="" aria-label={col.columnHeader}>
            <option value="">{col.dataSource.url ? 'Options from API' : 'API URL not set'}</option>
          </select>
        );
      }
      return (
        <DynamicSelect ds={col.dataSource} dyn={rowDyn && rowDyn[ri] && rowDyn[ri][col.id]} value={v}
          ariaLabel={`${col.columnHeader}, row ${ri + 1}`} onChange={set}
          onRetry={onRetryCell ? () => onRetryCell(ri, col.id) : undefined}
          linkNames={(missing) => (missing || []).map((n) => {
            const prm = (col.dataSource.params || []).find((x) => x.name === n);
            return prm && prm.source === 'column' ? prm.column : n;
          }).join(', ')} />
      );
    }
    const p = { className: 'form-control', readOnly: design, tabIndex: design ? -1 : undefined, 'aria-label': `${col.columnHeader}, row ${ri + 1}` };
    const t = col.inputType;
    if (t === 'textarea') return <textarea {...p} placeholder={`Enter ${col.columnHeader}`} value={v || ''} onChange={(e) => set(e.target.value)} />;
    if (t === 'number') return <input {...p} type="number" placeholder={`Enter ${col.columnHeader}`} value={v ?? ''} onChange={(e) => set(e.target.value)} />;
    if (t === 'date' || t === 'dates')
      return design
        ? <input {...p} type="text" className="form-control dateIcon" placeholder={`Enter ${col.columnHeader}`} />
        : <input {...p} type="date" value={v || ''} onChange={(e) => set(e.target.value)} />;
    if (t === 'file') return <input {...p} type="file" className="form-control" disabled={design} onChange={() => set('file')} />;
    if (CHOICE_COLUMN_TYPES.includes(t)) {
      const opts = col.options || [];
      if (t === 'dropdown' || t === 'select')
        return (
          <select {...p} disabled={design} value={v || ''} onChange={(e) => set(e.target.value)}>
            <option value="">-select-</option>
            {opts.map((o, i) => <option key={i} value={o.value || o.label}>{o.label}</option>)}
          </select>
        );
      return (
        <div className={t === 'checkbox' ? 'dfb-check-group' : 'radio-container'}>
          {opts.length === 0 && <span className="dfb-muted">No options yet</span>}
          {opts.map((o, i) => {
            const oid = `${sec.tableId}-${mode}-${col.id}-${ri}-${i}`;
            return (
              <React.Fragment key={i}>
                <input id={oid} type={t} disabled={design} name={`${sec.tableId}-${mode}-${col.id}-${ri}`}
                  checked={!design && (t === 'radio' ? v === o.label : (v || []).includes(o.label))}
                  onChange={(e) => set(t === 'radio' ? o.label : e.target.checked ? [...(v || []), o.label] : (v || []).filter((x) => x !== o.label))} />
                <label htmlFor={oid}>{o.label}</label>
              </React.Fragment>
            );
          })}
        </div>
      );
    }
    return <input {...p} type="text" placeholder={`Enter ${col.columnHeader}`} value={v || ''} onChange={(e) => set(e.target.value)} />;
  };

  return (
    <div className="dfb-grid-block">
      <div className="tHeader">
        <div className="tHeaderLeft"><h1>{sec.tableHeader || 'Untitled table'}</h1></div>
        {!design && (
          <div className="tHeaderRight">
            <button type="button" className="ButtonSmall" onClick={() => onRowsChange([...rows, {}])}>Add Row</button>
          </div>
        )}
      </div>
      <div className="dfb-table-scroll">
        <table className="tablesorter-blue" width="100%">
          <thead>
            <tr>
              <th><span className="TextHead">S.No.</span></th>
              {cols.map((c, i) => (
                <th key={i}>
                  <span className="TextHead">{c.columnHeader || 'Untitled'}</span>
                  {c.required === 'yes' && <Mandatory />}
                </th>
              ))}
              {!design && <th><span className="TextHead">Action</span></th>}
            </tr>
          </thead>
          <tbody>
            {rows.map((r, ri) => (
              <tr key={ri}>
                <td className="tdCenter">{ri + 1}</td>
                {cols.map((c, ci) => {
                  const cd = !design && rowFormulas && rowFormulas[ri] && rowFormulas[ri].cond[c.id];
                  return (
                    <td key={ci}>
                      {cell(c, r, ri)}
                      {cd && cd.ok === true && <div className="dfb-f-rt-ok dfb-f-rt-cell">✓ Condition satisfied</div>}
                      {cd && cd.ok === false && <div className="dfb-f-rt-bad dfb-f-rt-cell">✗ Condition not satisfied</div>}
                    </td>
                  );
                })}
                {!design && (
                  <td className="tdCenter">
                    <button type="button" className="dfb-link-btn" disabled={rows.length === 1}
                      onClick={() => onRowsChange(rows.filter((_, i) => i !== ri))}>Delete</button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
