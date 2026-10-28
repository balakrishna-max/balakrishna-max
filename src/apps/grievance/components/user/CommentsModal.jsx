import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { motion } from 'framer-motion';
import { X, MessageSquare, Loader2, User } from 'lucide-react';
import { userGrievanceApi } from '../../API/userGrievanceApi';
import '../../styles/user/CommentsModal.css';

const CommentsModal = ({ config, ticketId, onClose }) => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const res = await userGrievanceApi.getTicketComments(ticketId);
        if (res.data?.status === 'SUCCESS') setData(res.data.data);
      } catch {}
      finally { setLoading(false); }
    })();
  }, [ticketId]);

  const remarks = (data?.remarksDTOs || []).slice().sort(
    (a, b) => new Date(a.ticketRemarksCreatedOn) - new Date(b.ticketRemarksCreatedOn)
  );
  const users = data?.userDTOs || [];

  return createPortal(
    <div className="grv-modal-overlay" onClick={onClose}>
      <motion.div
        className="grv-modal-box comments-modal-box"
        onClick={(e) => e.stopPropagation()}
        initial={{ opacity: 0, scale: 0.95, y: 16 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 16 }}
        transition={{ duration: 0.22 }}
      >
        <div className="comments-modal-header">
          <div className="comments-modal-title">
            <div className="comments-modal-icon">
              <MessageSquare size={20} />
            </div>
            <div>
              <h2>Comments</h2>
              <p>{remarks.length} comment{remarks.length !== 1 ? 's' : ''}</p>
            </div>
          </div>
          <button className="icon-btn" onClick={onClose}><X size={18} /></button>
        </div>

        <div className="comments-modal-body">
          {loading ? (
            <div className="comments-loading">
              <Loader2 size={26} className="spin" />
              <span>Loading...</span>
            </div>
          ) : remarks.length === 0 ? (
            <div className="comments-loading">
              <MessageSquare size={36} />
              <span>No comments yet</span>
            </div>
          ) : (
            <div className="comments-list">
              {remarks.map((r, idx) => {
                const user = users.find((u) => String(u.userID) === String(r.ticketRemarksUserId));
                const name = user?.helpDeskUserFirstName || 'Unknown';
                const initial = name.charAt(0).toUpperCase();
                return (
                  <motion.div
                    key={r.ticketRemarksId || idx}
                    className="comment-item"
                    initial={{ opacity: 0, x: -12 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: idx * 0.05 }}
                  >
                    <div className="comment-avatar">
                      {user?.helpDeskUserImageData ? (
                        <img
                          src={`data:image/${(user.helpDeskUserImageType || 'png').toLowerCase()};base64,${user.helpDeskUserImageData}`}
                          alt={name}
                        />
                      ) : (
                        <span className="comment-avatar-initial">{initial}</span>
                      )}
                    </div>
                    <div className="comment-bubble">
                      <div className="comment-bubble-header">
                        <div className="comment-bubble-author">
                          <User size={12} /> <span>{name}</span>
                        </div>
                        <span className="comment-bubble-time">
                          {r.ticketRemarksCreatedOn || ''}
                        </span>
                      </div>
                      <p className="comment-bubble-text">{r.ticketRemarksDetails || ''}</p>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          )}
        </div>

        <div className="comments-modal-footer">
          <button className="btn-ghost" onClick={onClose}>Close</button>
        </div>
      </motion.div>
    </div>,
    document.body
  );
};

export default CommentsModal;