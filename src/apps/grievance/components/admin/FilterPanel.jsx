import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Filter, X, User, Flag, Tag, Clock, RotateCcw, Check,
} from 'lucide-react';

const FilterPanel = ({ tickets, users, categories, onFilterChange, open, onClose }) => {
  const [filters, setFilters] = useState({
    user: '',
    priority: '',
    category: '',
    slaStatus: '',
    ticketNumber: '',
  });

  // Extract unique values from tickets
  const uniqueUsers = users.length > 0 ? users : [
    ...new Map(tickets.map((t) => [t.ticketAssignedTo, {
      id: t.ticketAssignedTo,
      name: t.ticketSupportUserName || 'Unassigned',
    }])).values(),
  ].filter((u) => u.id);

  const uniqueCategories = categories.length > 0 ? categories : [
    ...new Set(tickets.map((t) => t.ticketProcessName).filter(Boolean)),
  ];

  const handleChange = (key, value) => {
    const next = { ...filters, [key]: value };
    setFilters(next);
    onFilterChange(next);
  };

  const reset = () => {
    const empty = {
      user: '', priority: '', category: '', slaStatus: '', ticketNumber: '',
    };
    setFilters(empty);
    onFilterChange(empty);
  };

  const activeCount = Object.values(filters).filter(Boolean).length;

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            className="filter-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />

          {/* Panel */}
          <motion.div
            className="filter-panel"
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 250 }}
          >
            <div className="filter-panel-header">
              <div className="filter-panel-title">
                <Filter size={18} />
                <span>Filters</span>
                {activeCount > 0 && (
                  <span className="filter-count">{activeCount}</span>
                )}
              </div>
              <button className="icon-btn" onClick={onClose}>
                <X size={18} />
              </button>
            </div>

            <div className="filter-panel-body">
              {/* Ticket number search */}
              <div className="filter-group">
                <label><Tag size={12} /> Ticket Number</label>
                <input
                  type="text"
                  placeholder="e.g. #ORG-2026..."
                  value={filters.ticketNumber}
                  onChange={(e) => handleChange('ticketNumber', e.target.value)}
                />
              </div>

              {/* User filter */}
              <div className="filter-group">
                <label><User size={12} /> Assigned Agent</label>
                <select
                  value={filters.user}
                  onChange={(e) => handleChange('user', e.target.value)}
                >
                  <option value="">All Agents</option>
                  {uniqueUsers.map((u) => (
                    <option key={u.id || u.helpDeskUserId} value={u.id || u.helpDeskUserId}>
                      {u.name || u.helpDeskUserFirstName}
                    </option>
                  ))}
                </select>
              </div>

              {/* Priority */}
              <div className="filter-group">
                <label><Flag size={12} /> Priority</label>
                <div className="filter-chips">
                  {[
                    { v: '1', l: 'High',   cls: 'high' },
                    { v: '2', l: 'Medium', cls: 'medium' },
                    { v: '3', l: 'Low',    cls: 'low' },
                  ].map((p) => (
                    <button
                      key={p.v}
                      className={`filter-chip ${p.cls} ${filters.priority === p.v ? 'active' : ''}`}
                      onClick={() => handleChange('priority', filters.priority === p.v ? '' : p.v)}
                    >
                      {filters.priority === p.v && <Check size={12} />}
                      {p.l}
                    </button>
                  ))}
                </div>
              </div>

              {/* Category */}
              <div className="filter-group">
                <label><Tag size={12} /> Category</label>
                <select
                  value={filters.category}
                  onChange={(e) => handleChange('category', e.target.value)}
                >
                  <option value="">All Categories</option>
                  {uniqueCategories.map((c, i) => {
                    const name = typeof c === 'string' ? c : c.ticketCategoryName;
                    const val = typeof c === 'string' ? c : c.ticketCategoryName;
                    return <option key={i} value={val}>{name}</option>;
                  })}
                </select>
              </div>

              {/* SLA Status */}
              <div className="filter-group">
                <label><Clock size={12} /> SLA Status</label>
                <div className="filter-chips">
                  <button
                    className={`filter-chip ok ${filters.slaStatus === 'ok' ? 'active' : ''}`}
                    onClick={() => handleChange('slaStatus', filters.slaStatus === 'ok' ? '' : 'ok')}
                  >
                    {filters.slaStatus === 'ok' && <Check size={12} />}
                    Within SLA
                  </button>
                  <button
                    className={`filter-chip breach ${filters.slaStatus === 'breach' ? 'active' : ''}`}
                    onClick={() => handleChange('slaStatus', filters.slaStatus === 'breach' ? '' : 'breach')}
                  >
                    {filters.slaStatus === 'breach' && <Check size={12} />}
                    Breached
                  </button>
                </div>
              </div>
            </div>

            <div className="filter-panel-footer">
              <button className="btn-ghost" onClick={reset}>
                <RotateCcw size={14} /> Reset All
              </button>
              <button className="btn-primary" onClick={onClose}>
                Apply Filters
              </button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};

export default FilterPanel;