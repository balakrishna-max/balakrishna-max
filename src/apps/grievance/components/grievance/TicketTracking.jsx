import React, { useEffect, useState } from 'react';
import {
  CheckCircle2, Search, Settings, PackageCheck,
  ArrowLeft, Loader2, AlertTriangle,
} from 'lucide-react';
import { motion } from 'framer-motion';
import { grievanceApi } from '../../API/grievanceApi';

const TIMELINE_STEPS = [
  { code: 100, title: 'Ticket Created', desc: 'Your ticket has been submitted successfully', Icon: CheckCircle2 },
  { code: 101, title: 'Auto-Assigned', desc: 'Ticket routed to the appropriate specialist', Icon: PackageCheck },
  { code: 102, title: 'Under Investigation', desc: 'Our team is analyzing the issue', Icon: Search },
  { code: 103, title: 'Solution Implementation', desc: 'Fix is being deployed and tested', Icon: Settings },
  { code: 104, title: 'Resolution & Closure', desc: 'Ticket will be closed after confirmation', Icon: CheckCircle2 },
];

const TicketTracking = ({ ticketId, onBack }) => {
  const [data, setData] = useState(null);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    (async () => {
      try {
        const res = await grievanceApi.getTicketById(ticketId);
        if (res.data.status === 'SUCCESS') {
          setData(res.data.data.TicketData);
          setHistory(res.data.data.TicketHistoryDTOList || []);
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
  }, [ticketId]);

  if (loading) {
    return (
      <div className="grv-card" style={{ textAlign: 'center', padding: 60 }}>
        <Loader2 size={28} className="spin" style={{ color: '#4765BA' }} />
        <div style={{ marginTop: 12, color: '#6b7280' }}>Loading ticket details…</div>
        <style>{`.spin { animation: spin 1s linear infinite; } @keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  if (error) {
    return (
      <div className="grv-card" style={{ textAlign: 'center', padding: 60 }}>
        <AlertTriangle size={36} style={{ color: '#ef4444', marginBottom: 12 }} />
        <div style={{ color: '#ef4444' }}>{error}</div>
        <button className="grv-btn grv-btn-secondary" onClick={onBack} style={{ marginTop: 20 }}>
          <ArrowLeft size={16} /> Back
        </button>
      </div>
    );
  }

  const currentStatus = parseInt(data.ticketStatus, 10);

  const getHistoryDate = (code) => {
    const item = history.find((h) => parseInt(h.ticketHistoryStatus, 10) === code);
    return item?.ticketHistoryUpdatedOn || '';
  };

  return (
    <motion.div
      className="grv-card"
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
    >
      <div style={{ marginBottom: 24 }}>
        <h2 style={{ fontSize: 20, fontWeight: 700, margin: '0 0 6px' }}>
          Ticket Tracking
        </h2>
        <div style={{ fontSize: 14, color: '#6b7280' }}>
          Ticket ID:{' '}
          <span style={{ color: '#4765BA', fontWeight: 700 }}>{data.ticketNumber}</span>
        </div>
      </div>

      <div className="grv-timeline">
        {TIMELINE_STEPS.map(({ code, title, desc, Icon }) => {
          const isDone = code < currentStatus;
          const isCurrent = code === currentStatus;
          const cls = isDone ? 'done' : isCurrent ? 'current' : '';
          const date = getHistoryDate(code);

          return (
            <motion.div
              key={code}
              className={`grv-tl-item ${cls}`}
              initial={{ opacity: 0, x: -12 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: (code - 100) * 0.05 }}
            >
              <div className="grv-tl-icon">
                <Icon size={14} />
              </div>
              <div className="grv-tl-header">
                <h3 className="grv-tl-title">{title}</h3>
                {date && <span className="grv-tl-time">{date}</span>}
              </div>
              <p className="grv-tl-desc">{desc}</p>
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
};

export default TicketTracking;