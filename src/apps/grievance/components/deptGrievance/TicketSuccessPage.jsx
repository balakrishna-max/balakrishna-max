import React from 'react';
import { CheckCircle2, Ticket, ArrowRight, BookOpen, ArrowLeft } from 'lucide-react';
import { motion } from 'framer-motion';

const PRIORITY_LABEL = { '1': 'High', '2': 'Medium', '3': 'Low' };
const PRIORITY_CLASS = { '1': 'high', '2': 'medium', '3': 'low' };

export default function TicketSuccessPage({
  ticket,
  config,
  onBack,
  onTrack,
  onOpenKB,
}) {
  const hasSteps = (ticket.categorySteps?.length || 0) > 0;
  const hasFaqs = (ticket.categoryFaqsDTO?.length || 0) > 0;

  return (
    <motion.div
      className="grv-card grv-success"
      initial={{ opacity: 0, scale: 0.96 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.3 }}
    >
      {/* Success icon */}
      <div className="grv-success-icon">
        <CheckCircle2 size={48} />
      </div>

      <h2 className="grv-success-title">Ticket Created Successfully!</h2>

      <div className="grv-ticket-id">{ticket.ticketNumber}</div>

      <p className="grv-success-msg">
        Your ticket has been registered. You will receive updates via email.
      </p>

      {/* Detail grid — 3-column, matching supplier */}
      <div className="grv-confirm-grid">
        <DetailBox label="Date" value={ticket.ticketDate} />
        <DetailBox label="Category" value={ticket.ticketProcessName} />
        <DetailBox
          label="Priority"
          value={
            <span className={`grv-priority-badge ${PRIORITY_CLASS[ticket.ticketPriority]}`}>
              {PRIORITY_LABEL[ticket.ticketPriority] || '-'}
            </span>
          }
        />
        <DetailBox label="Page" value={ticket.ticketUrl} />
      </div>

      {/* Action buttons — inline, right-aligned like supplier */}
      <div className="grv-actions">
        <button className="grv-btn grv-btn-secondary" onClick={onBack}>
          Raise Another Ticket
        </button>
        <button className="grv-btn grv-btn-primary" onClick={onTrack}>
          <Ticket size={16} /> Track Ticket Status <ArrowRight size={16} />
        </button>
      </div>

      {/* Optional steps + FAQs (below the fold, matching JSP) */}
      {(hasSteps || hasFaqs) && (
        <div className="grv-success-extra">
          <div className="grv-section-header">
            <h3>{ticket.ticketProcessName} — Suggested Steps</h3>
            <button className="grv-link-btn" onClick={onOpenKB}>
              <BookOpen size={14} /> Knowledge Base
            </button>
          </div>

          {hasSteps &&
            ticket.categorySteps.map((s, i) => (
              <div key={i} className="grv-step-row">
                <div className="grv-step-num">{i + 1}</div>
                <div className="grv-step-text">{s.stepInstruction}</div>
              </div>
            ))}

          {hasFaqs &&
            ticket.categoryFaqsDTO.map((faq, i) => (
              <details key={i} className="grv-faq">
                <summary>{faq.name}</summary>
                <div className="grv-faq-body">
                  {(faq.faqanswers || []).length > 0 ? (
                    faq.faqanswers.map((a, j) => <p key={j}>{a.answer}</p>)
                  ) : (
                    <p>No additional details available.</p>
                  )}
                </div>
              </details>
            ))}
        </div>
      )}
    </motion.div>
  );
}

/* ---- Detail box (matches supplier .grv-detail-box) ---- */
function DetailBox({ label, value }) {
  return (
    <div className="grv-detail-box">
      <div className="grv-detail-label">{label}</div>
      <div className="grv-detail-value">{value}</div>
    </div>
  );
}