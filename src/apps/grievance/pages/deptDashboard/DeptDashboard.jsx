import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { LayoutDashboard, Moon, Sun } from 'lucide-react';
import StatCards from '../../components/deptDashboard/StatCards';
import CreateTicketForm from '../../components/deptDashboard/CreateTicketForm';
import TicketsList from '../../components/deptDashboard/TicketsList';
import CommentsModal from '../../components/deptDashboard/CommentsModal';
import HistoryModal from '../../components/deptDashboard/HistoryModal';
import FeedbackModal from '../../components/deptDashboard/FeedbackModal';
import '../../styles/deptDashboard/DeptDashboard.css';
import '../../styles/deptDashboard/StatCards.css';
import '../../styles/deptDashboard/CreateTicketForm.css';
import '../../styles/deptDashboard/TicketsList.css';
import '../../styles/deptDashboard/CommentsModal.css';
import '../../styles/deptDashboard/HistoryModal.css';
import '../../styles/deptDashboard/FeedbackModal.css';
import '../../styles/deptDashboard/darkMode.css';

const DeptDashboard = ({ config }) => {
  const [commentsTicketId, setCommentsTicketId] = useState(null);
  const [historyTicketId, setHistoryTicketId] = useState(null);
  const [feedbackTicketId, setFeedbackTicketId] = useState(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [statusFilter, setStatusFilter] = useState({ code: null, label: 'My Tickets' });
  const [formOpen, setFormOpen] = useState(true);
  const [darkMode, setDarkMode] = useState(() => {
    return localStorage.getItem('grv-ticket-theme') === 'dark';
  });

  const refresh = () => setRefreshKey((k) => k + 1);

  /* Dark mode class on <body> — needed for portaled modals */
  useEffect(() => {
    document.body.classList.toggle('grv-ticket-dark', darkMode);
    localStorage.setItem('grv-ticket-theme', darkMode ? 'dark' : 'light');
  }, [darkMode]);

  useEffect(() => () => {
    document.body.classList.remove('grv-ticket-dark');
  }, []);

  return (
    <div className="dept-dashboard-root">
      {/* ===================== HERO ===================== */}
      <motion.header
        className="dept-hero"
        initial={{ opacity: 0, y: -12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
      >
        <div className="dept-hero-icon">
          <LayoutDashboard size={24} />
        </div>
        <div className="dept-hero-text">
          <h1>Grievance Dashboard</h1>
          <p>Raise, track, and monitor your support tickets</p>
        </div>
        <div className="dept-hero-actions">
          <button
            className="dept-hero-icon-btn"
            onClick={() => setDarkMode((d) => !d)}
            title={darkMode ? 'Light mode' : 'Dark mode'}
          >
            {darkMode ? <Sun size={16} /> : <Moon size={16} />}
          </button>
          <button
            className="dept-hero-action-btn"
            onClick={() => setFormOpen((f) => !f)}
          >
            {formOpen ? 'Hide Form' : 'New Ticket'}
          </button>
        </div>
      </motion.header>

      {/* ===================== STAT CARDS ===================== */}
      <StatCards
        config={config}
        refreshKey={refreshKey}
        activeCode={statusFilter.code}
        onSelect={(code, label) => setStatusFilter({ code, label })}
      />

      {/* ===================== MAIN GRID ===================== */}
      <div className={`dept-main-grid ${formOpen ? '' : 'full-width'}`}>
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
          onViewFeedback={(id) => setFeedbackTicketId(id)}
        />
      </div>

      {/* ===================== MODALS ===================== */}
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
            onFeedback={(id) => {
              setHistoryTicketId(null);
              setFeedbackTicketId(id);
            }}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {feedbackTicketId && (
          <FeedbackModal
            config={config}
            ticketId={feedbackTicketId}
            onClose={() => setFeedbackTicketId(null)}
          />
        )}
      </AnimatePresence>
    </div>
  );
};

export default DeptDashboard;