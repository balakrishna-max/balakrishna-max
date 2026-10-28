import React, { useEffect, useState } from 'react';
import {
  CheckCircle2, Search, Settings, PackageCheck,
  ArrowLeft, Loader2, AlertTriangle, MessageSquare, User,
} from 'lucide-react';
import { motion } from 'framer-motion';
import { deptGrievanceApi } from '../../API/deptGrievanceApi';

const STEPS = [
  { code: 100, title: 'Ticket Created',          desc: 'Your ticket has been submitted successfully',    Icon: CheckCircle2 },
  { code: 101, title: 'Auto-Assigned',           desc: 'Ticket routed to the appropriate specialist',     Icon: PackageCheck },
  { code: 102, title: 'Under Investigation',     desc: 'Our team is analyzing the issue',                 Icon: Search },
  { code: 103, title: 'Solution Implementation', desc: 'Fix is being deployed and tested',                Icon: Settings },
  { code: 104, title: 'Resolution & Closure',    desc: 'Ticket will be closed after confirmation',        Icon: CheckCircle2 },
];

const PRIORITY_LABEL = { '1': 'High', '2': 'Medium', '3': 'Low' };
const PRIORITY_CLASS = { '1': 'high', '2': 'medium', '3': 'low' };

export default function TicketTrackingPage({ ticketId, config, onBack }) {
  const [data, setData] = useState(null);
  const [users, setUsers] = useState([]);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    (async () => {
      try {
        const res = await deptGrievanceApi.getTicketById(config, ticketId);
        if (res.data?.status === 'SUCCESS') {
          const t = res.data.data.TicketData;
          setData(t);
          setUsers(res.data.data.HelpDeskUsers || []);
          setHistory(t.ticketHistoryDTOList || []);
        } else {
          setError('Ticket not found');
        }
      } catch (err) {
        console.error(err);
        setError('Failed to load ticket');
      } finally {
        setLoading(false);
      }
    })();
  }, [ticketId, config]);

  if (loading) {
    return (
      <div className="grv-card grv-loading">
        <Loader2 size={28} className="spin" />
        <span>Loading ticket details…</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="grv-card grv-loading grv-error-state">
        <AlertTriangle size={36} />
        <span>{error}</span>
        <button className="grv-btn grv-btn-secondary" onClick={onBack}>
          <ArrowLeft size={16} /> Back
        </button>
      </div>
    );
  }

  const current = parseInt(data.ticketStatus, 10);
  const assigned = users.find(
    (u) => String(u.helpDeskUserId) === String(data.ticketAssignedTo)
  );
  const priority = String(data.ticketPriority);

  const getHistoryItem = (code) =>
    history.find((h) => parseInt(h.ticketHistoryStatus, 10) === code);

  return (
    <motion.div className="grv-card" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
      {/* Ticket ID bar */}
      <div className="grv-ticket-id-bar">
        <span className="grv-ticket-id-label">Ticket ID</span>
        <span className="grv-ticket-id-value">{data.ticketNumber}</span>
      </div>

      {/* Timeline */}
      <div className="grv-timeline">
        {STEPS.map((step, idx) => {
          const item = getHistoryItem(step.code);
          const Icon = step.Icon;
          const isDone = step.code < current;
          const isCurrent = step.code === current;
          const state = isDone ? 'done' : isCurrent ? 'current' : 'pending';
          const isAutoAssign = step.code === 101;

          return (
            <motion.div
              key={step.code}
              className={`grv-tl-item ${state}`}
              initial={{ opacity: 0, x: -12 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: idx * 0.05 }}
            >
              <div className={`grv-tl-icon ${state}`}>
                <Icon size={14} />
              </div>

              <div className="grv-tl-header">
                <h3 className={`grv-tl-title ${state}`}>{step.title}</h3>
                {item?.ticketHistoryUpdatedOn && (
                  <span className="grv-tl-time">{item.ticketHistoryUpdatedOn}</span>
                )}
              </div>

              {isAutoAssign && assigned && (
                <div className="grv-tl-badge-row">
                  <span className="grv-tl-pill">
                    <User size={11} /> Auto-assigned to {assigned.helpDeskUserFirstName}
                  </span>
                </div>
              )}

              {!isAutoAssign && item?.ticketHistoryRemarks ? (
                <div className="grv-tl-comment">
                  <div className="grv-tl-comment-label">
                    <MessageSquare size={12} /> Latest Comment
                  </div>
                  <p>{item.ticketHistoryRemarks}</p>
                </div>
              ) : (
                <p className="grv-tl-desc">{step.desc}</p>
              )}
            </motion.div>
          );
        })}
      </div>

      <div className="grv-actions">
        <button className="grv-btn grv-btn-secondary" onClick={onBack}>
          <ArrowLeft size={16} /> Back
        </button>
      </div>
    </motion.div>
  );
}