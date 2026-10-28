import React from 'react';
import { CheckCircle2, Ticket, ArrowRight } from 'lucide-react';
import { motion } from 'framer-motion';

const PRIORITY_LABEL = { '1': 'High', '2': 'Medium', '3': 'Low' };
const PRIORITY_CLASS = { '1': 'high', '2': 'medium', '3': 'low' };

const TicketConfirmation = ({ ticket, onTrack, onBack }) => {
  return (
    <motion.div
      className="grv-card grv-success"
      initial={{ opacity: 0, scale: 0.96 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.3 }}
    >
      <div className="grv-success-icon">
        <CheckCircle2 size={48} />
      </div>

      <h2 className="grv-success-title">Ticket Created Successfully!</h2>

      <div className="grv-ticket-id">{ticket.ticketNumber}</div>

      <p className="grv-success-msg">
        Your ticket has been registered. You will receive updates via email.
      </p>

      <div className="grv-confirm-grid">
        <DetailBox label="Date" value={ticket.ticketDate} />
        <DetailBox label="Category" value={ticket.ticketProcessName} />
        <DetailBox
          label="Priority"
          value={
            <span className={`grv-priority-badge ${PRIORITY_CLASS[ticket.ticketPriority]}`}>
              {PRIORITY_LABEL[ticket.ticketPriority]}
            </span>
          }
        />
        <DetailBox label="Page" value={ticket.ticketUrl} />
      </div>

      <div className="grv-actions">
        <button className="grv-btn grv-btn-secondary" onClick={onBack}>
          Raise Another Ticket
        </button>
        <button className="grv-btn grv-btn-primary" onClick={onTrack}>
          <Ticket size={16} /> Track Ticket Status <ArrowRight size={16} />
        </button>
      </div>
    </motion.div>
  );
};

const DetailBox = ({ label, value }) => (
  <div className="grv-detail-box">
    <div className="grv-detail-label">{label}</div>
    <div className="grv-detail-value">{value}</div>
  </div>
);

export default TicketConfirmation;