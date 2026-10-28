import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AlertCircle, Sun, Moon } from 'lucide-react';
import RaiseTicketPage from '../../components/deptGrievance/RaiseTicketPage';
import TicketSuccessPage from '../../components/deptGrievance/TicketSuccessPage';
import TicketTrackingPage from '../../components/deptGrievance/TicketTrackingPage';
import KnowledgeBasePage from '../../components/deptGrievance/KnowledgeBasePage';
import ChatbotWidget from '../../components/deptGrievance/ChatbotWidget';
import '../../styles/deptGrievance/grievance.css';
import '../../styles/deptGrievance/TicketForm.css';
import '../../styles/deptGrievance/TicketConfirmation.css';
import '../../styles/deptGrievance/TicketTracking.css';
import '../../styles/deptGrievance/ChatbotWidget.css';
import '../../styles/deptGrievance/darkMode.css';

const STEPS = [
  { id: 'RAISE', label: 'Raise Ticket' },
  { id: 'SUCCESS', label: 'Confirmation' },
  { id: 'TRACKING', label: 'Track Status' },
];

export default function DeptGrievanceDashboard({ config }) {
  const [page, setPage] = useState('RAISE'); // RAISE | SUCCESS | TRACKING | KB
  const [ticket, setTicket] = useState(null);
  const [darkMode, setDarkMode] = useState(() =>
    localStorage.getItem('grv-ticket-theme') === 'dark'
  );

  useEffect(() => {
    document.body.classList.toggle('grv-ticket-dark', darkMode);
    localStorage.setItem('grv-ticket-theme', darkMode ? 'dark' : 'light');
  }, [darkMode]);

  useEffect(() => () => {
    document.body.classList.remove('grv-ticket-dark');
  }, []);

  const currentStepIndex = STEPS.findIndex((s) => s.id === page);

  const reset = () => {
    setTicket(null);
    setPage('RAISE');
  };

  return (
    <div className="dept-grievance-root grv-grievance-page">
      {/* Header */}
      <div className="grv-header">
        <div className="grv-header-icon">
          <AlertCircle size={26} />
        </div>
        <div style={{ flex: 1 }}>
          <h1 className="grv-header-title">
            {page === 'RAISE' && 'Raise Ticket'}
            {page === 'SUCCESS' && 'Ticket Created'}
            {page === 'TRACKING' && 'Ticket Tracking'}
            {page === 'KB' && 'Knowledge Base'}
          </h1>
          <p className="grv-header-subtitle">
            {page === 'RAISE' && "Describe your issue and we'll help you resolve"}
            {page === 'SUCCESS' && 'Your ticket has been submitted successfully'}
            {page === 'TRACKING' && 'Follow your ticket through every stage'}
            {page === 'KB' && 'Detailed guides and documentation'}
          </p>
        </div>
        <button
          className="grv-theme-toggle"
          onClick={() => setDarkMode((d) => !d)}
          title={darkMode ? 'Switch to light mode' : 'Switch to dark mode'}
        >
          {darkMode ? <Sun size={16} /> : <Moon size={16} />}
        </button>
      </div>

      {/* Stepper (only on the main 3-step flow, hidden on KB) */}
      {page !== 'KB' && (
        <div className="grv-stepper">
          {STEPS.map((step, idx) => {
            const isDone = idx < currentStepIndex;
            const isActive = idx === currentStepIndex;
            return (
              <React.Fragment key={step.id}>
                <div className={`grv-step ${isActive ? 'active' : ''} ${isDone ? 'done' : ''}`}>
                  <div className="grv-step-num">{isDone ? '✓' : idx + 1}</div>
                  <span>{step.label}</span>
                </div>
                {idx < STEPS.length - 1 && (
                  <div className={`grv-step-line ${isDone ? 'done' : ''}`} />
                )}
              </React.Fragment>
            );
          })}
        </div>
      )}

      {/* Page switch */}
      <AnimatePresence mode="wait">
        <motion.div
          key={page}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -12 }}
          transition={{ duration: 0.25 }}
        >
          {page === 'RAISE' && (
            <RaiseTicketPage
              config={config}
              onTicketCreated={(t) => {
                setTicket(t);
                setPage('SUCCESS');
              }}
            />
          )}

          {page === 'SUCCESS' && ticket && (
            <TicketSuccessPage
              ticket={ticket}
              config={config}
              onBack={reset}
              onTrack={() => setPage('TRACKING')}
              onOpenKB={() => setPage('KB')}
            />
          )}

          {page === 'TRACKING' && ticket && (
            <TicketTrackingPage
              ticketId={ticket.ticketId}
              config={config}
              onBack={() => setPage('SUCCESS')}
            />
          )}

          {page === 'KB' && (
            <KnowledgeBasePage config={config} onBack={() => setPage('SUCCESS')} />
          )}
        </motion.div>
      </AnimatePresence>

      <ChatbotWidget config={config} />
    </div>
  );
}