import React, { useState, useEffect } from 'react';
import { AlertCircle, Moon, Sun } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import TicketForm from '../../components/grievance/TicketForm';
import TicketConfirmation from '../../components/grievance/TicketConfirmation';
import TicketTracking from '../../components/grievance/TicketTracking';

const STEPS = [
  { id: 'FORM', label: 'Raise Ticket' },
  { id: 'CONFIRMATION', label: 'Confirmation' },
  { id: 'TRACKING', label: 'Track Status' },
];

const Grievance = ({ config }) => {
  const [view, setView] = useState('FORM');
  const [createdTicket, setCreatedTicket] = useState(null);
  const [darkMode, setDarkMode] = useState(() => {
    return localStorage.getItem('grv-ticket-theme') === 'dark';
  });

  const currentStepIndex = STEPS.findIndex((s) => s.id === view);

  // Apply theme class to body so it covers all elements
  useEffect(() => {
    document.body.classList.toggle('grv-ticket-dark', darkMode);
    localStorage.setItem('grv-ticket-theme', darkMode ? 'dark' : 'light');
  }, [darkMode]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      document.body.classList.remove('grv-ticket-dark');
    };
  }, []);

  return (
    <div className={`grv-wrapper grv-grievance-page ${darkMode ? 'grv-ticket-dark' : ''}`}>
      {/* Header */}
      <div className="grv-header">
        <div className="grv-header-icon">
          <AlertCircle size={26} />
        </div>
        <div style={{ flex: 1 }}>
          <h1 className="grv-header-title">Grievance Portal</h1>
          <p className="grv-header-subtitle">
            Raise, track, and resolve your issues with ease
          </p>
        </div>
        <button
          className="grv-theme-toggle"
          onClick={() => setDarkMode((d) => !d)}
          title={darkMode ? 'Switch to light mode' : 'Switch to dark mode'}
          aria-label={darkMode ? 'Switch to light mode' : 'Switch to dark mode'}
        >
          {darkMode ? <Sun size={16} /> : <Moon size={16} />}
        </button>
      </div>

      {/* Stepper */}
      <div className="grv-stepper">
        {STEPS.map((step, idx) => {
          const isDone = idx < currentStepIndex;
          const isActive = idx === currentStepIndex;
          return (
            <React.Fragment key={step.id}>
              <div className={`grv-step ${isActive ? 'active' : ''} ${isDone ? 'done' : ''}`}>
                <div className="grv-step-num">{idx + 1}</div>
                <span>{step.label}</span>
              </div>
              {idx < STEPS.length - 1 && (
                <div className={`grv-step-line ${isDone ? 'done' : ''}`} />
              )}
            </React.Fragment>
          );
        })}
      </div>

      {/* View switch */}
      <AnimatePresence mode="wait">
        <motion.div
          key={view}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -12 }}
          transition={{ duration: 0.25 }}
        >
          {view === 'FORM' && (
            <TicketForm
              config={config}
              onSuccess={(ticket) => {
                setCreatedTicket(ticket);
                setView('CONFIRMATION');
              }}
            />
          )}

          {view === 'CONFIRMATION' && createdTicket && (
            <TicketConfirmation
              ticket={createdTicket}
              onTrack={() => setView('TRACKING')}
              onBack={() => setView('FORM')}
            />
          )}

          {view === 'TRACKING' && createdTicket && (
            <TicketTracking
              ticketId={createdTicket.ticketId}
              onBack={() => setView('CONFIRMATION')}
            />
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  );
};

export default Grievance;