import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { SlidersHorizontal, X, RotateCcw, Calendar, Flag, Tag, ArrowUpDown } from 'lucide-react';
import '../../styles/user/TicketFilters.css';

const PRIORITIES = [
  { value: '1', label: 'High',   cls: 'high' },
  { value: '2', label: 'Medium', cls: 'medium' },
  { value: '3', label: 'Low',    cls: 'low' },
];

const SORTS = [
  { value: 'newest',   label: 'Newest First' },
  { value: 'oldest',   label: 'Oldest First' },
  { value: 'priority', label: 'By Priority' },
];

const TicketFilters = ({ open, onClose, onApply, categories = [], current }) => {
  const [filters, setFilters] = useState(
    current || { priority: '', categoryId: '', fromDate: '', toDate: '', sortBy: 'newest' }
  );

  const set = (k, v) => setFilters((p) => ({ ...p, [k]: v }));

  const reset = () => {
    const empty = { priority: '', categoryId: '', fromDate: '', toDate: '', sortBy: 'newest' };
    setFilters(empty);
    onApply(empty);
  };

  const apply = () => {
    onApply(filters);
    onClose();
  };

  const activeCount = [filters.priority, filters.categoryId, filters.fromDate, filters.toDate]
    .filter(Boolean).length + (filters.sortBy !== 'newest' ? 1 : 0);

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            className="filter-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />
          <motion.aside
            className="filter-drawer"
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 28, stiffness: 300 }}
          >
            <div className="filter-drawer-header">
              <div className="filter-drawer-title">
                <SlidersHorizontal size={16} />
                <h3>Filters</h3>
                {activeCount > 0 && <span className="filter-badge">{activeCount}</span>}
              </div>
              <button className="filter-close" onClick={onClose}><X size={16} /></button>
            </div>

            <div className="filter-drawer-body">
              {/* Priority */}
              <div className="filter-section">
                <label className="filter-label"><Flag size={12} /> Priority</label>
                <div className="filter-chips">
                  {PRIORITIES.map((p) => (
                    <button
                      key={p.value}
                      type="button"
                      className={`filter-chip ${p.cls} ${filters.priority === p.value ? 'active' : ''}`}
                      onClick={() => set('priority', filters.priority === p.value ? '' : p.value)}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Category */}
              <div className="filter-section">
                <label className="filter-label"><Tag size={12} /> Category</label>
                <select
                  className="filter-select"
                  value={filters.categoryId}
                  onChange={(e) => set('categoryId', e.target.value)}
                >
                  <option value="">All Categories</option>
                  {categories.map((c) => (
                    <option key={c.ticketCategoryId} value={c.ticketCategoryId}>
                      {c.ticketCategoryName}
                    </option>
                  ))}
                </select>
              </div>

              {/* Date range */}
              <div className="filter-section">
                <label className="filter-label"><Calendar size={12} /> Date Range</label>
                <div className="filter-date-range">
                  <input
                    type="date"
                    className="filter-input"
                    value={filters.fromDate}
                    onChange={(e) => set('fromDate', e.target.value)}
                  />
                  <span>to</span>
                  <input
                    type="date"
                    className="filter-input"
                    value={filters.toDate}
                    onChange={(e) => set('toDate', e.target.value)}
                  />
                </div>
              </div>

              {/* Sort */}
              <div className="filter-section">
                <label className="filter-label"><ArrowUpDown size={12} /> Sort By</label>
                <div className="filter-chips">
                  {SORTS.map((s) => (
                    <button
                      key={s.value}
                      type="button"
                      className={`filter-chip neutral ${filters.sortBy === s.value ? 'active' : ''}`}
                      onClick={() => set('sortBy', s.value)}
                    >
                      {s.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="filter-drawer-footer">
              <button className="filter-btn-reset" onClick={reset}>
                <RotateCcw size={13} /> Reset
              </button>
              <button className="filter-btn-apply" onClick={apply}>
                Apply Filters
              </button>
            </div>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
};

export default TicketFilters;