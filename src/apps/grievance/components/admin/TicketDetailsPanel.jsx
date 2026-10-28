import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X, User, Calendar, Paperclip, Tag, AlertTriangle,
  History, Clock, MessageSquare, Loader2, Download,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { grievanceApi } from '../../API/grievanceApi';
import UpdateTicketForm from './UpdateTicketForm';
import HistoryModal from './HistoryModal';
import SlaModal from './SlaModal';
import CommentsModal from './CommentsModal';

const PRIORITY_TEXT = { 1: 'High', 2: 'Medium', 3: 'Low' };
const STATUS_MAP = {
  100: { text: 'Open',                class: 'open' },
  101: { text: 'Assigned',            class: 'inprogress' },
  102: { text: 'Under Investigation', class: 'inprogress' },
  103: { text: 'Pending',             class: 'pending' },
  104: { text: 'Resolved',            class: 'resolved' },
  105: { text: 'Closed',              class: 'closed' },
};

const TicketDetailsPanel = ({ config, ticketId, onClose, onUpdated }) => {
  const [data, setData] = useState(null);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(null);

  const fetchTicket = async () => {
    setLoading(true);
    try {
      const res = await grievanceApi.getTicketById(ticketId);
      if (res.data.status === 'SUCCESS') {
        setData(res.data.data.TicketData);
        setUsers(res.data.data.HelpDeskUsers || []);
      }
    } catch (err) {
      toast.error('Failed to load ticket');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchTicket(); }, [ticketId]);

  if (loading) {
    return (
      <motion.div
        className="detail-panel loading"
        initial={{ opacity: 0, x: 40 }}
        animate={{ opacity: 1, x: 0 }}
        exit={{ opacity: 0, x: 40 }}
        transition={{ type: 'spring', damping: 25, stiffness: 300 }}
      >
        <Loader2 size={24} className="spin" />
      </motion.div>
    );
  }

  if (!data) return null;

  const assignedUser = users.find((u) => u.helpDeskUserId === data.ticketAssignedTo);
  const status = STATUS_MAP[data.ticketStatus] || { text: 'Unknown', class: '' };

  const handleDownload = () => {
    const encodedName = encodeURIComponent(data.ticketFileAttachementName);
    const encodedPath = btoa(data.ticketFileAttachementPath);
    window.open(
      `${config.apiUrl}/ticket/${encodedName}/getAttachment/${encodedPath}`,
      '_blank'
    );
  };

  return (
    <>
      <motion.div
        className="detail-panel"
        initial={{ opacity: 0, x: 60 }}
        animate={{ opacity: 1, x: 0 }}
        exit={{ opacity: 0, x: 60 }}
        transition={{ type: 'spring', damping: 26, stiffness: 280 }}
      >
        <div className="detail-header">
          <div className="detail-title">
            <span>Ticket ID</span>
            <strong>{data.ticketNumber}</strong>
          </div>
          <button className="icon-btn" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        <div className="detail-body">
          <DetailRow icon={<Tag size={14} />} label="Issue Description" value={data.ticketDescription} />
          <DetailRow
            icon={<AlertTriangle size={14} />}
            label="Priority"
            value={
              <span className={`priority-pill ${data.ticketPriority == 1 ? 'high' : data.ticketPriority == 2 ? 'medium' : 'low'}`}>
                {PRIORITY_TEXT[data.ticketPriority] || 'N/A'}
              </span>
            }
          />
          <DetailRow icon={<Tag size={14} />} label="Category" value={data.ticketProcessName} />
          <DetailRow
            icon={<User size={14} />}
            label="Assigned Agent"
            value={
              <div className="agent-cell">
                <div className="agent-avatar small">
                  {assignedUser?.helpDeskUserImageData
                    ? <img src={`data:image/${assignedUser.helpDeskUserImageType.toLowerCase()};base64,${assignedUser.helpDeskUserImageData}`} alt="" />
                    : <User size={12} />}
                </div>
                <span>{assignedUser?.helpDeskUserFirstName || 'Unassigned'}</span>
              </div>
            }
          />
          <DetailRow icon={<Calendar size={14} />} label="Created Date" value={data.ticketDate} />
          <DetailRow
            icon={<Paperclip size={14} />}
            label="Attachment"
            value={
              data.ticketFileAttachementName ? (
                <button className="link-btn" onClick={handleDownload}>
                  <Download size={12} /> {data.ticketFileAttachementName}
                </button>
              ) : 'No attachment'
            }
          />
          <DetailRow
            icon={<Tag size={14} />}
            label="Status"
            value={<span className={`status-pill ${status.class}`}>{status.text}</span>}
          />
          {data.ticketComments && data.ticketComments.trim() && (
            <DetailRow icon={<MessageSquare size={14} />} label="Latest Comments" value={data.ticketComments} />
          )}
        </div>

        <div className="detail-actions">
          <button className="action-chip" onClick={() => setModal('history')}>
            <History size={14} /> History
          </button>
          <button className="action-chip" onClick={() => setModal('sla')}>
            <Clock size={14} /> SLA Info
          </button>
          <button className="action-chip" onClick={() => setModal('comments')}>
            <MessageSquare size={14} /> Comments
          </button>
        </div>

        <UpdateTicketForm
          config={config}
          ticket={data}
          users={users}
          onUpdated={() => {
            fetchTicket();
            onUpdated?.();
          }}
        />
      </motion.div>

      {/* Animated Modals */}
      <AnimatePresence>
        {modal === 'history' && (
          <motion.div
            key="history-modal"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            <HistoryModal
              config={config}
              ticketId={data.ticketId}
              ticketStatus={data.ticketStatus}
              onClose={() => setModal(null)}
            />
          </motion.div>
        )}

        {modal === 'sla' && (
          <motion.div
            key="sla-modal"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            <SlaModal
              config={config}
              ticketNumber={data.ticketNumber}
              onClose={() => setModal(null)}
            />
          </motion.div>
        )}

        {modal === 'comments' && (
          <motion.div
            key="comments-modal"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            <CommentsModal
              config={config}
              ticketId={data.ticketId}
              onClose={() => setModal(null)}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};

const DetailRow = ({ icon, label, value }) => (
  <div className="detail-row">
    <div className="detail-row-label">
      {icon}
      <span>{label}</span>
    </div>
    <div className="detail-row-value">{value}</div>
  </div>
);

export default TicketDetailsPanel;