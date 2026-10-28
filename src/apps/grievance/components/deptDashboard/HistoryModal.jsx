import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { motion } from 'framer-motion';
import {
  X, CheckCircle2, Search, Settings, PackageCheck, Loader2,
  Calendar, MessageSquare, User, AlertTriangle, Star,
} from 'lucide-react';
import { deptDashboardApi } from '../../API/deptDashboardApi';

const STEPS = [
  { code: 100, title: 'Ticket Created',          Icon: CheckCircle2 },
  { code: 101, title: 'Auto-Assigned',           Icon: PackageCheck },
  { code: 102, title: 'Under Investigation',     Icon: Search },
  { code: 103, title: 'Solution Implementation', Icon: Settings },
  { code: 104, title: 'Resolution & Closure',    Icon: CheckCircle2 },
];

export default function HistoryModal({ config, ticketId, ticketStatus, onClose, onFeedback }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    (async () => {
      try {
        const res = await deptDashboardApi.getTicketById(config, ticketId);
        if (res.data?.status === 'SUCCESS' && res.data?.data) {
          setData(res.data.data);
        } else {
          setError(`API error: ${res.data?.status || 'unknown'}`);
        }
      } catch (e) {
        setError(e?.response?.data || e?.message || 'Failed to load ticket history');
      } finally {
        setLoading(false);
      }
    })();
  }, [ticketId, config]);

  const ticketInfo = data?.TicketData || {};
  const history = ticketInfo.ticketHistoryDTOList || [];
  const users = data?.HelpDeskUsers || [];
  const current = parseInt(ticketInfo.ticketStatus || ticketStatus, 10);
  const isClosed = current === 105;

  const getHistoryItem = (code) =>
    history.find((h) => parseInt(h.ticketHistoryStatus, 10) === code);

  const getAssignedUserName = (record) => {
    if (!record) return '';
    const uid = record.ticketAssignedTo || ticketInfo.ticketAssignedTo;
    if (!uid) return '';
    const u = users.find((x) => String(x.helpDeskUserId) === String(uid));
    return u?.helpDeskUserFirstName || '';
  };

  return createPortal(
    <div className="grv-modal-overlay" onClick={onClose}>
      <motion.div
        className="grv-modal-box dept-history-modal-box"
        onClick={(e) => e.stopPropagation()}
        initial={{ opacity: 0, scale: 0.95, y: 16 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 16 }}
        transition={{ duration: 0.22 }}
      >
        <div className="dept-history-modal-header">
          <div className="dept-history-modal-title">
            <div className="dept-history-modal-icon">
              <CheckCircle2 size={20} />
            </div>
            <div>
              <h2>Ticket History</h2>
              <p>Complete journey of this support ticket</p>
            </div>
          </div>
          <button className="dept-icon-btn" onClick={onClose}><X size={18} /></button>
        </div>

        <div className="dept-history-modal-body">
          {loading ? (
            <div className="dept-history-loading">
              <Loader2 size={28} className="spin" />
              <span>Loading ticket history...</span>
            </div>
          ) : error ? (
            <div className="dept-history-loading" style={{ color: '#dc2626' }}>
              <AlertTriangle size={28} />
              <span>{error}</span>
            </div>
          ) : (
            <div className="dept-history-timeline">
              {STEPS.map((s, idx) => {
                const item = getHistoryItem(s.code);
                const Icon = s.Icon;
                const isDone = s.code < current;
                const isCurrent = s.code === current;
                const state = isDone ? 'done' : isCurrent ? 'current' : 'pending';
                const dateText = item?.ticketHistoryUpdatedOn || '';
                const commentText = item?.ticketHistoryRemarks || '';
                const assignedName = getAssignedUserName(item);
                const isAutoAssign = s.code === 101;

                return (
                  <motion.div
                    key={s.code}
                    className={`dept-history-timeline-item ${state}`}
                    initial={{ opacity: 0, x: -12 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: idx * 0.06 }}
                  >
                    <div className={`dept-history-timeline-node ${state}`}>
                      <Icon size={16} />
                    </div>
                    {idx < STEPS.length - 1 && (
                      <div className={`dept-history-timeline-connector ${isDone ? 'done' : ''}`} />
                    )}
                    <div className="dept-history-timeline-content">
                      <div className="dept-history-timeline-header">
                        <h3 className={`dept-history-timeline-title ${state}`}>{s.title}</h3>
                        {dateText && (
                          <span className="dept-history-timeline-time">
                            <Calendar size={11} /> {dateText}
                          </span>
                        )}
                      </div>
                      {isAutoAssign && assignedName && (
                        <div className="dept-history-timeline-badge-row">
                          <span className="dept-history-timeline-pill">
                            <User size={11} /> Auto-assigned to {assignedName}
                          </span>
                        </div>
                      )}
                      {!isAutoAssign && commentText && (
                        <div className="dept-history-timeline-remarks">
                          <div className="dept-history-timeline-remarks-header">
                            <MessageSquare size={12} /> Latest Comments
                          </div>
                          <p>{commentText}</p>
                        </div>
                      )}
                    </div>
                  </motion.div>
                );
              })}
            </div>
          )}
        </div>

        <div className="dept-history-modal-footer">
          {isClosed && onFeedback && (
            <button
              className="dept-btn-primary dept-feedback-trigger"
              onClick={() => onFeedback(ticketId)}
            >
              <Star size={14} /> Give Feedback
            </button>
          )}
          <button className="dept-btn-ghost" onClick={onClose}>Close</button>
        </div>
      </motion.div>
    </div>,
    document.body
  );
}