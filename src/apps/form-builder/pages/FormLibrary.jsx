import React, { useEffect, useMemo, useRef, useState } from 'react';
import { openPreviewFormula, goToDashboard } from '../api/navigation';
import { useAsset } from '../config/AppContext';

const PAGE_SIZES = [10, 20, 30, 40];


export default function FormLibrary({ forms, onCreate, onEdit, onClone }) {
  const asset = useAsset();
  const [q, setQ] = useState('');
  const [size, setSize] = useState(10);
  const [page, setPage] = useState(0);
  const [picking, setPicking] = useState(false);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    return !s ? forms : forms.filter((f) => f.id.toLowerCase().includes(s) || f.name.toLowerCase().includes(s));
  }, [forms, q]);

  const pages = Math.max(1, Math.ceil(filtered.length / size));
  const cur = Math.min(page, pages - 1);
  const rows = filtered.slice(cur * size, cur * size + size);
  const first = Math.max(0, Math.min(cur - 2, pages - 5));

  const IconBtn = ({ tip, img, disabled, onClick }) => (
    <button type="button" data-tooltip={tip} aria-label={tip} disabled={disabled} onClick={onClick}
      className="dfb-icon-action" style={{ cursor: disabled ? 'not-allowed' : 'pointer' }}>
      <img alt="" src={asset(`resources/img/${img}`)} style={disabled ? { opacity: 0.2 } : undefined} />
    </button>
  );

  return (
    <div className="dfb-library">
      <div className="form-controls">
        <div className="tHeader">
          <div className="tHeaderLeft"><h1>Search Existing Forms</h1></div>
          <div className="tHeaderRight p0">
            <button type="button" className="ButtonSmall" onClick={() => setPicking(true)}>Create New Form</button>
          </div>
        </div>
        <div className="row dfb-lib-search">
          <div className="col-md-3">
            <div className="form-group">
              <div className="my-flex">
                <input className="form-control" autoComplete="off" maxLength={200} placeholder="Form ID/Form Name"
                  aria-label="Search by form ID or form name" value={q}
                  onChange={(e) => { setQ(e.target.value); setPage(0); }} />
                <img alt="" aria-hidden="true" src={asset('resources/assets/img/search_red.svg')} />
              </div>
            </div>
          </div>
        </div>
      </div>
      <div className="p5 text-center mtb10">
        <input type="button" className="Button" value="Reset" onClick={() => { setQ(''); setPage(0); }} />
      </div>

      <div className="form-controls">
        <div className="tHeader">
          <div className="tHeaderLeft"><h1>Smart Form Library</h1></div>
        </div>
        <div className="dfb-table-scroll">
          <table className="tablesorter-blue dfb-lib-table" width="100%">
            <thead>
              <tr>
                <th className="tdCenter"><span className="TextHead">S. No.</span></th>
                <th className="tdCenter"><span className="TextHead">Form Id</span></th>
                <th><span className="TextHead">Form Name</span></th>
                <th><span className="TextHead">Created Date</span></th>
                <th className="tdCenter"><span className="TextHead">Select</span></th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 && (
                <tr className="no-result">
                  <td colSpan={5} style={{ textAlign: 'center' }}>
                    {forms.length === 0 ? 'No forms yet. Use Create New Form to add one.' : 'No results found'}
                  </td>
                </tr>
              )}
              {rows.map((f, i) => {
                const locked = String(f.mode) !== '0';
                const off = ' Disabled, Data Already Filled';
                return (
                  <tr key={f.id}>
                    <td className="tdCenter">{cur * size + i + 1}</td>
                    <td className="tdCenter">{f.id}</td>
                    <td className="dfb-td-left">{f.name}</td>
                    <td className="dfb-td-left">{f.modified}</td>
                    <td className="tdCenter">
                      <div className="dfb-icon-actions">
                        <IconBtn tip={`Edit Smart Form${locked ? off : ''}`} img="edit.svg" disabled={locked} onClick={() => onEdit(f.id)} />
                        <IconBtn tip={`Clone Smart Form${locked ? off : ''}`} img="copyTender.svg" disabled={locked} onClick={() => onClone(f.id)} />
                        <IconBtn tip={`Preview Formula${locked ? off : ''}`} img="formula-view.svg" disabled={locked} onClick={() => openPreviewFormula(f.id)} />
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div className="p5 text-center mtb10">
          <table width="100%" className="pager">
            <tbody>
              <tr>
                <td align="left" width="33%">
                  Show{' '}
                  <select className="pagesize" value={size} aria-label="Records per page"
                    onChange={(e) => { setSize(Number(e.target.value)); setPage(0); }}>
                    {PAGE_SIZES.map((n) => <option key={n} value={n}>{n}</option>)}
                  </select>{' '}
                  Records
                </td>
                <td align="center" width="33%">
                  Showing{' '}
                  <span className="pagedisplay">
                    {filtered.length ? `${cur * size + 1} to ${Math.min(filtered.length, (cur + 1) * size)} of ${filtered.length}` : '0 of 0'}
                  </span>
                </td>
                <td align="right" width="33%">
                  <span className="page-numbers dfb-pages">
                    <button type="button" className="dfb-page-btn" disabled={cur === 0} onClick={() => setPage(cur - 1)} aria-label="Previous page">&lsaquo;</button>
                    {Array.from({ length: Math.min(5, pages) }).map((_, k) => {
                      const n = first + k;
                      return (
                        <button key={n} type="button" className={`dfb-page-btn${n === cur ? ' is-on' : ''}`}
                          aria-current={n === cur ? 'page' : undefined} onClick={() => setPage(n)}>{n + 1}</button>
                      );
                    })}
                    <button type="button" className="dfb-page-btn" disabled={cur >= pages - 1} onClick={() => setPage(cur + 1)} aria-label="Next page">&rsaquo;</button>
                  </span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <div className="p5 text-center mtb10">
        <input type="button" className="Button" value="Previous" onClick={goToDashboard} />
      </div>

      {picking && <LayoutPopup onCancel={() => setPicking(false)} onPick={(l) => { setPicking(false); onCreate(l); }} />}
    </div>
  );
}

const LAYOUTS = [
  { value: '1', label: 'Single Column' },
  { value: '2', label: 'Two Column' },
  { value: '3', label: 'Three Column' },
];

function LayoutPopup({ onPick, onCancel }) {
  const [v, setV] = useState('');
  const [err, setErr] = useState('');
  const ref = useRef(null);

  useEffect(() => {
    const prev = document.activeElement;
    const firstInput = ref.current && ref.current.querySelector('input');
    firstInput && firstInput.focus();
    const esc = (e) => e.key === 'Escape' && onCancel();
    document.addEventListener('keydown', esc);
    return () => { document.removeEventListener('keydown', esc); prev && prev.focus && prev.focus(); };
  }, [onCancel]);

  return (
    <div className="popup dfb-popup" style={{ display: 'block' , backgroundColor: 'transparent' }} onClick={(e) => e.target === e.currentTarget && onCancel()}>
      <div className="popupContent dynamicForms dfb-popup-content" role="dialog" aria-modal="true" aria-labelledby="dfb-layout-title" ref={ref}>
        <div className="popupHeader">
          <div className="pageTitle" id="dfb-layout-title">Select Layout</div>
          <span className="close" role="button" tabIndex={0} aria-label="Close"
            onClick={onCancel} onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && onCancel()}>x</span>
        </div>
        <div className="contentBody">
          <div className="radio-container" role="radiogroup" aria-label="Layout">
            {LAYOUTS.map((l) => (
              <React.Fragment key={l.value}>
                <input id={`dfb-layout-${l.value}`} type="radio" name="dfbSelectLayout" value={l.value}
                  checked={v === l.value} onChange={() => { setV(l.value); setErr(''); }} />
                <label htmlFor={`dfb-layout-${l.value}`}>{l.label}</label>
              </React.Fragment>
            ))}
          </div>
          <div className="dfb-layout-previews" aria-hidden="true">
            {LAYOUTS.map((l) => (
              <span key={l.value} className={`dfb-layout-art dfb-art-${l.value}${v === l.value ? ' is-on' : ''}`}
                onClick={() => { setV(l.value); setErr(''); }}>
                {Array.from({ length: Number(l.value) * 3 }).map((_, i) => <i key={i} />)}
              </span>
            ))}
          </div>
          {err && <span className="dfb-error">{err}</span>}
        </div>
        <div className="p5 text-center mtb10">
          <input type="button" className="Button" value="Submit Layout"
            onClick={() => (v ? onPick(v) : setErr('Please select a layout'))} />
        </div>
      </div>
    </div>
  );
}
