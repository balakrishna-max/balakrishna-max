import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { motion } from 'framer-motion';
import {
  X, MessageSquare, Loader2, AlertTriangle, User, Clock,
} from 'lucide-react';
import { grievanceApi } from '../../API/grievanceApi';

const CommentsModal = ({ ticketId, onClose }) => {
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
        const res = await grievanceApi.getTicketComments(ticketId);
        console.log('🔍 [CommentsModal] Response:', res.data);

        if (res.data?.status === 'SUCCESS' && res.data.data) {
          setData(res.data.data);
        } else {
          setError(`API error: ${res.data?.status || 'unknown'}`);
        }
      } catch (e) {
        console.error('🔍 [CommentsModal] Error:', e);
        setError(e?.response?.data || e?.message || 'Failed to load comments');
      } finally {
        setLoading(false);
      }
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
        transition={{ duration: 0.22, ease: 'easeOut' }}
      >
        {/* Header */}
        <div className="comments-modal-header">
          <div className="comments-modal-title">
            <div className="comments-modal-icon">
              <MessageSquare size={20} />
            </div>
            <div>
              <h2>Comments</h2>
              <p>
                {remarks.length} {remarks.length === 1 ? 'comment' : 'comments'} on
                this ticket
              </p>
            </div>
          </div>
          <button className="icon-btn" onClick={onClose} aria-label="Close">
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="comments-modal-body">
          {loading ? (
            <div className="comments-loading">
              <Loader2 size={28} className="spin" />
              <span>Loading comments...</span>
            </div>
          ) : error ? (
            <div className="comments-loading comments-error">
              <AlertTriangle size={28} />
              <span>{error}</span>
            </div>
          ) : remarks.length === 0 ? (
            <div className="comments-loading">
              <MessageSquare size={32} />
              <span>No comments yet</span>
              <p className="comments-empty-hint">
                Comments will appear here when agents add them.
              </p>
            </div>
          ) : (
            <div className="comments-list">
              {remarks.map((r, idx) => {
                const user = users.find(
                  (u) => String(u.userID) === String(r.ticketRemarksUserId)
                );
                const userName = user?.helpDeskUserFirstName || 'Unknown User';
                const initial = userName.charAt(0).toUpperCase();

                return (
                  <motion.div
                    key={r.ticketRemarksId || idx}
                    className="comment-item"
                    initial={{ opacity: 0, x: -12 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: idx * 0.05, duration: 0.25 }}
                  >
                    {/* Avatar */}
                    <div className="comment-avatar">
                      {user?.helpDeskUserImageData ? (
                        <img
                          src={`data:image/${(user.helpDeskUserImageType || 'png').toLowerCase()};base64,${user.helpDeskUserImageData}`}
                          alt={userName}
                        />
                      ) : (
                        <span className="comment-avatar-initial">{initial}</span>
                      )}
                    </div>

                    {/* Bubble */}
                    <div className="comment-bubble">
                      <div className="comment-bubble-header">
                        <div className="comment-bubble-author">
                          <User size={12} />
                          <span>{userName}</span>
                        </div>
                        <div className="comment-bubble-time">
                          <Clock size={11} />
                          <span>{r.ticketRemarksCreatedOn || ''}</span>
                        </div>
                      </div>
                      <p className="comment-bubble-text">
                        {r.ticketRemarksDetails || ''}
                      </p>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="comments-modal-footer">
          <button className="btn-ghost" onClick={onClose}>
            Close
          </button>
        </div>
      </motion.div>
    </div>,
    document.body
  );
};

export default CommentsModal;