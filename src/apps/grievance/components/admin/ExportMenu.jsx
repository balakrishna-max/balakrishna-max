import React, { useState, useRef, useEffect } from 'react';
import { Download, FileSpreadsheet, FileText, ChevronDown } from 'lucide-react';

export default function ExportMenu({ onExportExcel, onExportPDF, disabled }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  /* Close on outside click */
  useEffect(() => {
    const onDoc = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  return (
    <div className="export-menu-wrap" ref={ref}>
      <button
        className="hero-btn export-btn"
        onClick={() => setOpen((o) => !o)}
        disabled={disabled}
        title="Download current view"
      >
        <Download size={16} />
        Export
        <ChevronDown size={14} style={{ opacity: 0.7 }} />
      </button>

      {open && (
        <div className="export-dropdown">
          <button
            className="export-item"
            onClick={() => { setOpen(false); onExportExcel(); }}
          >
            <FileSpreadsheet size={16} />
            <div>
              <div className="export-item-title">Excel (.xlsx)</div>
              <div className="export-item-sub">Spreadsheet with all columns</div>
            </div>
          </button>

          <button
            className="export-item"
            onClick={() => { setOpen(false); onExportPDF(); }}
          >
            <FileText size={16} />
            <div>
              <div className="export-item-title">PDF (.pdf)</div>
              <div className="export-item-sub">Print-ready table layout</div>
            </div>
          </button>
        </div>
      )}
    </div>
  );
}