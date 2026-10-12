import React, { useState } from 'react';
import Icon from './Icon';
import { FieldControl, SectionTable } from './FieldControl';
import { isFullWidth } from '../model/schema';

export default function Canvas({ title, layout, items, selectedKey, dragRef, dispatch, onDropNew }) {
  const [target, setTarget] = useState(null);

  const paramFieldLabel = (comp, paramName) => {
    const p = ((comp.dataSource && comp.dataSource.params) || []).find((x) => x.name === paramName);
    if (!p || p.source !== 'field') return paramName;
    const it = items.find((i) => i.kind === 'component' && i.comp.id === p.field);
    return it ? it.comp.label : paramName;
  }; 

  const clear = () => setTarget(null);

  const performDrop = (index) => {
    const d = dragRef.current;
    dragRef.current = null;
    clear();
    if (!d) return;
    if (d.type === 'new') onDropNew(d.element, index);
    if (d.type === 'move') dispatch({ type: 'MOVE', key: d.key, to: index });
  };

  const onCardOver = (e, i, item) => {
    if (!dragRef.current) return;
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = dragRef.current.type === 'new' ? 'copy' : 'move';
    const r = e.currentTarget.getBoundingClientRect();
    const vertical = isFullWidth(item) || layout === '1';
    const before = vertical ? e.clientY < r.top + r.height / 2 : e.clientX < r.left + r.width / 2;
    const edge = before ? 'before' : 'after';
    if (!target || target.index !== i || target.edge !== edge) setTarget({ index: i, edge });
  };

  return (
    <div
      className="dfb-canvas"
      onDragOver={(e) => {
        if (!dragRef.current) return;
        e.preventDefault();
        if (!target || target.index !== items.length) setTarget({ index: items.length });
      }}
      onDragLeave={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget)) clear();
      }}
      onDrop={(e) => {
        e.preventDefault();
        performDrop(target && target.edge ? target.index + (target.edge === 'after' ? 1 : 0) : items.length);
      }}
      onClick={(e) => e.target === e.currentTarget && dispatch({ type: 'SELECT', key: null })}
    >
      <div className={`form-controls dfb-sheet dfb-cols-${layout}`}>
        <div className="tHeader dfb-sheet-head" onClick={() => dispatch({ type: 'SELECT', key: null })}>
          <div className="tHeaderLeft"><h1>{title.trim() || 'Untitled form'}</h1></div>
          <div className="tHeaderRight dfb-sheet-meta">{{ 1: 'Single column', 2: 'Two column', 3: 'Three column' }[layout]} layout</div>
        </div>

        {items.length === 0 ? (
          <div className={`dfb-empty${target ? ' is-target' : ''}`}>
            <Icon name="plus" size={28} />
            <p>Drag an element here, or click one in the left panel.</p>
          </div>
        ) : (
          <div className="dfb-grid">
            {items.map((item, i) => {
              const full = isFullWidth(item);
              const sel = item.key === selectedKey;
              const edge = target && target.index === i ? target.edge : null;
              return (
                <div
                  key={item.key}
                  className={`dfb-card${sel ? ' is-selected' : ''}${full ? ' is-full' : ''}${edge ? ` drop-${edge}` : ''}`}
                  draggable
                  onDragStart={(e) => {
                    dragRef.current = { type: 'move', key: item.key };
                    e.dataTransfer.effectAllowed = 'move';
                    e.dataTransfer.setData('text/plain', item.key);
                  }}
                  onDragEnd={() => { dragRef.current = null; clear(); }}
                  onDragOver={(e) => onCardOver(e, i, item)}
                  onDrop={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    performDrop(i + (edge === 'after' ? 1 : 0));
                  }}
                  onClick={(e) => { e.stopPropagation(); dispatch({ type: 'SELECT', key: item.key }); }}
                  onKeyDown={(e) => {
                    if (e.target !== e.currentTarget) return;
                    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); dispatch({ type: 'SELECT', key: item.key }); }
                    if (e.altKey && e.key === 'ArrowUp') { e.preventDefault(); dispatch({ type: 'MOVE', key: item.key, to: i - 1 }); }
                    if (e.altKey && e.key === 'ArrowDown') { e.preventDefault(); dispatch({ type: 'MOVE', key: item.key, to: i + 2 }); }
                  }}
                  tabIndex={0}
                  role="button"
                  aria-pressed={sel}
                  aria-label={`${item.kind === 'section' ? item.sec.tableHeader : item.comp.label || 'Field'}. Alt plus arrow keys to move.`}
                >
                  <div className="dfb-card-tools" onClick={(e) => e.stopPropagation()}>
                    <span className="dfb-grip" title="Drag to move"><Icon name="grip" size={16} /></span>
                    <span className="dfb-spacer" />
                    <button type="button" className="dfb-tool" title="Move up" disabled={i === 0}
                      onClick={() => dispatch({ type: 'MOVE', key: item.key, to: i - 1 })}><Icon name="up" size={15} /></button>
                    <button type="button" className="dfb-tool" title="Move down" disabled={i === items.length - 1}
                      onClick={() => dispatch({ type: 'MOVE', key: item.key, to: i + 2 })}><Icon name="down" size={15} /></button>
                    <button type="button" className="dfb-tool" title="Duplicate"
                      onClick={() => dispatch({ type: 'DUPLICATE', key: item.key })}><Icon name="copy" size={15} /></button>
                    <button type="button" className="dfb-tool dfb-tool-danger" title="Delete"
                      onClick={() => dispatch({ type: 'REMOVE', key: item.key })}><Icon name="trash" size={15} /></button>
                  </div>
                  <div className="dfb-card-body">
                    {item.kind === 'section' ? <SectionTable sec={item.sec} /> : <FieldControl comp={item.comp} fieldLabel={paramFieldLabel} />}
                  </div>
                </div>
              );
            })}
            {target && target.index === items.length && <div className="dfb-drop-tail" />}
          </div>
        )}
      </div>
    </div>
  );
}
