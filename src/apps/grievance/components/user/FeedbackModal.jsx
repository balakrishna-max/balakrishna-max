import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { motion } from 'framer-motion';
import { X, Star, Loader2, CheckCircle2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { userGrievanceApi } from '../../API/userGrievanceApi';
import '../../styles/user/FeedbackModal.css';

const FeedbackModal = ({ config, ticketId, onClose }) => {
  const [stars, setStars] = useState(0);
  const [hover, setHover] = useState(0);
  const [comments, setComments] = useState('');
  const [feedbackId, setFeedbackId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const res = await userGrievanceApi.getFeedback(ticketId);
        if (res.data?.status === 'SUCCESS' && res.data.data) {
          setFeedbackId(res.data.data.feedBackId);
          setStars(res.data.data.feedbackStar || 0);
          setComments(res.data.data.feedBackComments || '');
        }
      } catch {}
      finally { setLoading(false); }
    })();
  }, [ticketId]);

  const submit = async () => {
    if (stars === 0) { toast.error('Please select a rating'); return; }
    setSubmitting(true);
    try {
      const res = await userGrievanceApi.saveFeedback({
        feedBackId: feedbackId || null,
        ticketId,
        userId: config.userID,
        feedBackComments: comments,
        feedbackStar: stars,
        feedBackValue: 1,
      });
      if (res.data?.status === 'SUCCESS') {
        setFeedbackId(res.data.data.feedBackId);
        setSuccess(true);
        setTimeout(onClose, 1800);
      } else {
        toast.error('Failed to save feedback');
      }
    } catch { toast.error('Failed to save feedback'); }
    finally { setSubmitting(false); }
  };

  return createPortal(
    <div className="grv-modal-overlay" onClick={onClose}>
      <motion.div
        className="grv-modal-box feedback-modal-box"
        onClick={(e) => e.stopPropagation()}
        initial={{ opacity: 0, scale: 0.95, y: 16 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 16 }}
        transition={{ duration: 0.22 }}
      >
        <div className="feedback-modal-header">
          <div>
            <h2>How was your experience?</h2>
            <p>Your feedback helps us improve our support</p>
          </div>
          <button className="icon-btn" onClick={onClose}><X size={18} /></button>
        </div>

        {loading ? (
          <div className="feedback-loading"><Loader2 size={24} className="spin" /></div>
        ) : success ? (
          <div className="feedback-success">
            <motion.div
              className="feedback-success-icon"
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: 'spring', damping: 15 }}
            >
              <CheckCircle2 size={44} />
            </motion.div>
            <h3>Thank you!</h3>
            <p>Your feedback has been recorded.</p>
          </div>
        ) : (
          <>
            <div className="feedback-stars-wrap">
              {[1, 2, 3, 4, 5].map((n) => (
                <motion.button
                  key={n}
                  type="button"
                  className="feedback-star"
                  onMouseEnter={() => setHover(n)}
                  onMouseLeave={() => setHover(0)}
                  onClick={() => setStars(n)}
                  whileHover={{ scale: 1.15 }}
                  whileTap={{ scale: 0.92 }}
                >
                  <Star
                    size={34}
                    className={(hover || stars) >= n ? 'filled' : ''}
                    fill={(hover || stars) >= n ? 'currentColor' : 'none'}
                  />
                </motion.button>
              ))}
            </div>

            <div className="feedback-rating-label">
              {['Poor', 'Fair', 'Good', 'Very Good', 'Excellent'][(hover || stars) - 1] || 'Select a rating'}
            </div>

            <div className="feedback-comment-field">
              <label>Additional comments (optional)</label>
              <textarea
                rows={3}
                placeholder="Anything else you'd like to share?"
                value={comments}
                onChange={(e) => setComments(e.target.value)}
                maxLength={200}
              />
              <div className="feedback-counter">{comments.length}/200</div>
            </div>

            <div className="feedback-actions">
              <button className="btn-ghost" onClick={onClose}>Cancel</button>
              <button
                className="btn-primary"
                onClick={submit}
                disabled={submitting || stars === 0}
              >
                {submitting ? <><Loader2 size={14} className="spin" /> Submitting...</> : 'Submit Feedback'}
              </button>
            </div>
          </>
        )}
      </motion.div>
    </div>,
    document.body
  );
};

export default FeedbackModal;