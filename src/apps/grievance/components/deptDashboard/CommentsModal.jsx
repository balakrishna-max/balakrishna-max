import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { motion } from 'framer-motion';
import { X, MessageSquare, Loader2, User } from 'lucide-react';
import { deptDashboardApi } from '../../API/deptDashboardApi';

export default function CommentsModal({ config, ticketId, onClose }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const res = await deptDashboardApi.getTicketComments(config, ticketId);
        if (res.data?.status === 'SUCCESS') setData(res.data.data);
      } catch {}
      finally { setLoading(false); }
    })();
  }, [ticketId, config]);

  const remarks = (data?.remarksDTOs || []).slice().sort(
    (a, b) => new Date(a.ticketRemarksCreatedOn) - new Date(b.ticketRemarksCreatedOn)
  );
  const users = data?.userDTOs || [];

  return createPortal(
    <div className="grv-modal-overlay" onClick={onClose}>
      <motion.div
        className="grv-modal-box dept-comments-modal-box"
        onClick={(e) => e.stopPropagation()}
        initial={{ opacity: 0, scale: 0.95, y: 16 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 16 }}
        transition={{ duration: 0.22 }}
      >
        <div className="dept-comments-modal-header">
          <div className="dept-comments-modal-title">
            <div className="dept-comments-modal-icon">
              <MessageSquare size={20} />
            </div>
            <div>
              <h2>Comments</h2>
              <p>{remarks.length} comment{remarks.length !== 1 ? 's' : ''}</p>
            </div>
          </div>
          <button className="dept-icon-btn" onClick={onClose}><X size={18} /></button>
        </div>

        <div className="dept-comments-modal-body">
          {loading ? (
            <div className="dept-comments-loading">
              <Loader2 size={26} className="spin" />
              <span>Loading...</span>
            </div>
          ) : remarks.length === 0 ? (
            <div className="dept-comments-loading">
              <MessageSquare size={36} />
              <span>No comments yet</span>
            </div>
          ) : (
            <div className="dept-comments-list">
              {remarks.map((r, idx) => {
                const user = users.find((u) => String(u.userID) === String(r.ticketRemarksUserId));
                const name = user?.helpDeskUserFirstName || 'Unknown';
                const initial = name.charAt(0).toUpperCase();
                return (
                  <motion.div
                    key={r.ticketRemarksId || idx}
                    className="dept-comment-item"
                    initial={{ opacity: 0, x: -12 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: idx * 0.05 }}
                  >
                    <div className="dept-comment-avatar">
                      {user?.helpDeskUserImageData ? (
                        <img
                          src={`data:image/${(user.helpDeskUserImageType || 'png').toLowerCase()};base64,${user.helpDeskUserImageData}`}
                          alt={name}
                        />
                      ) : (
                        <span className="dept-comment-avatar-initial">{initial}</span>
                      )}
                    </div>
                    <div className="dept-comment-bubble">
                      <div className="dept-comment-bubble-header">
                        <div className="dept-comment-bubble-author">
                          <User size={12} /> <span>{name}</span>
                        </div>
                        <span className="dept-comment-bubble-time">
                          {r.ticketRemarksCreatedOn || ''}
                        </span>
                      </div>
                      <p className="dept-comment-bubble-text">{r.ticketRemarksDetails || ''}</p>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          )}
        </div>

        <div className="dept-comments-modal-footer">
          <button className="dept-btn-ghost" onClick={onClose}>Close</button>
        </div>
      </motion.div>
    </div>,
    document.body
  );
}