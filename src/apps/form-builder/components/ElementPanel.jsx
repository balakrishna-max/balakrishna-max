import React, { useMemo, useState } from 'react';
import Icon from './Icon';
import { ELEMENTS, PALETTE } from '../model/fieldCatalog';

export default function ElementPanel({ onAdd, dragRef, open, onClose }) {
  const [q, setQ] = useState('');
  const groups = useMemo(() => {
    const s = q.trim().toLowerCase();
    return PALETTE.map((g) => ({
      ...g,
      keys: g.keys.filter((k) => !s || ELEMENTS[k].label.toLowerCase().includes(s)),
    })).filter((g) => g.keys.length);
  }, [q]);

  return (
    <aside className={`dfb-palette${open ? ' is-open' : ''}`} aria-label="Form elements">
      <div className="dfb-palette-head">
        <h2>Form elements</h2>
        <button type="button" className="dfb-icon-btn dfb-only-narrow" onClick={onClose} aria-label="Close elements">
          <Icon name="close" />
        </button>
      </div>
      <div className="dfb-palette-search">
        <Icon name="search" size={16} />
        <input
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search elements"
          aria-label="Search elements"
        />
      </div>
      <div className="dfb-palette-list">
        {groups.length === 0 && <p className="dfb-palette-empty">No element matches “{q}”.</p>}
        {groups.map((g) => (
          <div key={g.title} className="dfb-palette-group">
            <h3>{g.title}</h3>
            <ul>
              {g.keys.map((k) => (
                <li key={k}>
                  <button
                    type="button"
                    className="dfb-el"
                    draggable
                    onDragStart={(e) => {
                      dragRef.current = { type: 'new', element: k };
                      e.dataTransfer.effectAllowed = 'copy';
                      e.dataTransfer.setData('text/plain', k);
                    }}
                    onDragEnd={() => (dragRef.current = null)}
                    onClick={() => onAdd(k)}
                    title={`Add ${ELEMENTS[k].label}`}
                  >
                    <span className="dfb-el-ico"><Icon name={ELEMENTS[k].icon} /></span>
                    <span>{ELEMENTS[k].label}</span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </aside>
  );
}
