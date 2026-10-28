import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { motion } from 'framer-motion';
import {
  X, CheckCircle2, Search, Settings, PackageCheck, Loader2,
  Calendar, MessageSquare, User, AlertTriangle,
} from 'lucide-react';
import { grievanceApi } from '../../API/grievanceApi';

const STEPS = [
  { code: 100, title: 'Ticket Created',          Icon: CheckCircle2 },
  { code: 101, title: 'Auto-Assigned',           Icon: PackageCheck },
  { code: 102, title: 'Under Investigation',     Icon: Search },
  { code: 103, title: 'Solution Implementation', Icon: Settings },
  { code: 104, title: 'Resolution & Closure',    Icon: CheckCircle2 },
];

const HistoryModal = ({ config, ticketId, ticketStatus, onClose }) => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!ticketId) {
      setError('No ticket ID provided');
      setLoading(false);
      return;
    }

    (async () => {
      setLoading(true);
      setError('');
      try {
        const res = await grievanceApi.getTicketById(ticketId);

        // 🔍 Debug — shows each history item's fields in the console
        (res.data?.data?.TicketData?.ticketHistoryDTOList || []).forEach((h, i) => {
          console.log(`🔍 [${i}] status=${h.ticketHistoryStatus}`, {
            date: h.ticketHistoryUpdatedOn,
            remarks: h.ticketHistoryRemarks,
            desc: h.ticketHistoryDescription,
          });
        });

        if (res.data?.status === 'SUCCESS' && res.data?.data) {
          setData(res.data.data);
        } else {
          setError(`API error: ${res.data?.status || 'unknown'}`);
        }
      } catch (e) {
        console.error('🔍 [HistoryModal] Error:', e);
        setError(e?.response?.data || e?.message || 'Failed to load ticket history');
      } finally {
        setLoading(false);
      }
    })();
  }, [ticketId]);

  const ticketInfo = data?.TicketData || {};
  const history = ticketInfo.ticketHistoryDTOList || [];
  const users = data?.HelpDeskUsers || [];

  const current = parseInt(ticketInfo.ticketStatus || ticketStatus, 10);

  // Match history item by status code — same record holds both date and comment
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
        className="grv-modal-box"
        onClick={(e) => e.stopPropagation()}
        initial={{ opacity: 0, scale: 0.95, y: 16 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 16 }}
        transition={{ duration: 0.22, ease: 'easeOut' }}
      >
        {/* Header */}
        <div className="history-modal-header">
          <div className="history-modal-title">
            <div className="history-modal-icon">
              <CheckCircle2 size={20} />
            </div>
            <div>
              <h2>Ticket History</h2>
              <p>Complete journey of this support ticket</p>
            </div>
          </div>
          <button className="icon-btn" onClick={onClose} aria-label="Close">
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="history-modal-body">
          {loading ? (
            <div className="history-loading">
              <Loader2 size={28} className="spin" />
              <span>Loading ticket history...</span>
            </div>
          ) : error ? (
            <div className="history-loading" style={{ color: '#dc2626' }}>
              <AlertTriangle size={28} />
              <span>{error}</span>
            </div>
          ) : (
            <div className="history-timeline">
              {STEPS.map((s, idx) => {
                const item = getHistoryItem(s.code);
                const Icon = s.Icon;
                const isDone = s.code < current;
                const isCurrent = s.code === current;
                const state = isDone ? 'done' : isCurrent ? 'current' : 'pending';

                // ✅ BOTH date and comment come from the same history item
                const dateText    = item?.ticketHistoryUpdatedOn || '';
                const commentText = item?.ticketHistoryRemarks || '';

                const assignedName = getAssignedUserName(item);
                const isAutoAssign = s.code === 101;

                return (
                  <motion.div
                    key={s.code}
                    className={`history-timeline-item ${state}`}
                    initial={{ opacity: 0, x: -12 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: idx * 0.06, duration: 0.25 }}
                  >
                    <div className={`history-timeline-node ${state}`}>
                      <Icon size={16} />
                    </div>

                    {idx < STEPS.length - 1 && (
                      <div
                        className={`history-timeline-connector ${isDone ? 'done' : ''}`}
                      />
                    )}

                    <div className="history-timeline-content">
                      <div className="history-timeline-header">
                        <div className="history-timeline-title-row">
                          <h3 className="history-timeline-title">{s.title}</h3>
                        </div>
                        {dateText && (
                          <span className="history-timeline-time">
                            <Calendar size={11} />
                            {dateText}
                          </span>
                        )}
                      </div>

                      {/* Auto-assign step: show agent pill only */}
                      {isAutoAssign && assignedName && (
                        <div className="history-timeline-badge-row">
                          <span className="history-timeline-pill">
                            <User size={11} /> Auto-assigned to {assignedName}
                          </span>
                        </div>
                      )}

                      {/* Other steps: show per-step comment from ticketHistoryRemarks */}
                      {!isAutoAssign && commentText && (
                        <div className="history-timeline-remarks">
                          <div className="history-timeline-remarks-header">
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

        {/* Footer */}
        <div className="history-modal-footer">
          <button className="btn-ghost" onClick={onClose}>
            Close
          </button>
        </div>
      </motion.div>
    </div>,
    document.body
  );
};

export default HistoryModal;