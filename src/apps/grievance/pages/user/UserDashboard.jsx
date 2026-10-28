import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { LayoutDashboard, PlusCircle, Moon, Sun } from 'lucide-react';
import StatCards from '../../components/user/StatCards';
import CreateTicketForm from '../../components/user/CreateTicketForm';
import TicketsList from '../../components/user/TicketsList';
import CommentsModal from '../../components/user/CommentsModal';
import HistoryModal from '../../components/user/HistoryModal';
import '../../styles/user/UserDashboard.css';

const UserDashboard = ({ config }) => {
  const [commentsTicketId, setCommentsTicketId] = useState(null);
  const [historyTicketId, setHistoryTicketId] = useState(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [statusFilter, setStatusFilter] = useState({ code: null, label: 'All Tickets' });
  const [formOpen, setFormOpen] = useState(true);
  const [darkMode, setDarkMode] = useState(() => {
    return localStorage.getItem('grv-theme') === 'dark';
  });

  const refresh = () => setRefreshKey((k) => k + 1);

 useEffect(() => {
  // Apply class to <body> so portaled modals are styled too
  document.body.classList.toggle('grv-dark', darkMode);
  localStorage.setItem('grv-theme', darkMode ? 'dark' : 'light');
}, [darkMode]);

// Cleanup on unmount
useEffect(() => {
  return () => {
    document.body.classList.remove('grv-dark');
  };
}, []);

  useEffect(() => {
    const onKey = (e) => {
      const tag = e.target.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;

      if (e.key === '/') {
        e.preventDefault();
        document.querySelector('.tl-search input')?.focus();
      } else if (e.key === 'n' || e.key === 'N') {
        setFormOpen(true);
      } else if (e.key === 'Escape') {
        if (commentsTicketId) setCommentsTicketId(null);
        else if (historyTicketId) setHistoryTicketId(null);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [commentsTicketId, historyTicketId]);

  return (
    <div className={`user-dashboard ${darkMode ? 'grv-dark' : ''}`}>
      <motion.header
        className="user-hero"
        initial={{ opacity: 0, y: -12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
      >
        <div className="user-hero-icon">
          <LayoutDashboard size={24} />
        </div>
        <div className="user-hero-text">
          <h1>Grievance Dashboard</h1>
          <p>Raise, track, and monitor your support tickets</p>
        </div>
        <div className="user-hero-actions">
          <button
            className="hero-icon-btn"
            onClick={() => setDarkMode((d) => !d)}
            title={darkMode ? 'Light mode' : 'Dark mode'}
          >
            {darkMode ? <Sun size={16} /> : <Moon size={16} />}
          </button>
          <button
            className="hero-action-btn"
            onClick={() => setFormOpen((f) => !f)}
          >
            <PlusCircle size={16} />
            {formOpen ? 'Hide Form' : 'New Ticket'}
          </button>
        </div>
      </motion.header>

      <StatCards
        config={config}
        refreshKey={refreshKey}
        activeCode={statusFilter.code}
        onSelect={(code, label) => setStatusFilter({ code, label })}
      />

      <div className={`user-main-grid ${formOpen ? '' : 'full-width'}`}>
        <AnimatePresence>
          {formOpen && (
            <motion.div
              initial={{ opacity: 0, x: -20, width: 0 }}
              animate={{ opacity: 1, x: 0, width: 'auto' }}
              exit={{ opacity: 0, x: -20, width: 0 }}
              transition={{ duration: 0.3, ease: 'easeInOut' }}
            >
              <CreateTicketForm config={config} onCreated={refresh} />
            </motion.div>
          )}
        </AnimatePresence>

        <TicketsList
          config={config}
          statusFilter={statusFilter}
          refreshKey={refreshKey}
          onViewTicket={(id) => setHistoryTicketId(id)}
          onViewComments={(id) => setCommentsTicketId(id)}
        />
      </div>

      <AnimatePresence>
        {commentsTicketId && (
          <CommentsModal
            config={config}
            ticketId={commentsTicketId}
            onClose={() => setCommentsTicketId(null)}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {historyTicketId && (
          <HistoryModal
            config={config}
            ticketId={historyTicketId}
            ticketStatus={null}
            onClose={() => setHistoryTicketId(null)}
          />
        )}
      </AnimatePresence>
    </div>
  );
};

export default UserDashboard;