import React, { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import {
  Folder, CircleDot, Clock, Hourglass, Award, XCircle,
} from 'lucide-react';
import { deptDashboardApi } from '../../API/deptDashboardApi';

const CARDS = [
  { key: 'today',      label: 'Today',       code: 200, color: 'indigo',  Icon: Folder },
  { key: 'open',       label: 'Open',        code: 100, color: 'emerald', Icon: CircleDot },
  { key: 'inprogress', label: 'In Progress', code: 101, color: 'amber',   Icon: Clock },
  { key: 'pending',    label: 'Pending',     code: 103, color: 'orange',  Icon: Hourglass },
  { key: 'resolved',   label: 'Resolved',    code: 104, color: 'teal',    Icon: Award },
  { key: 'closed',     label: 'Closed',      code: 105, color: 'rose',    Icon: XCircle },
];

const AnimatedNumber = ({ value }) => {
  const [display, setDisplay] = useState(0);
  const fromRef = useRef(0);
  const rafRef = useRef(null);

  useEffect(() => {
    const target = Number(value) || 0;
    const duration = 700;
    const start = performance.now();
    const startVal = fromRef.current;

    const tick = (now) => {
      const p = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - p, 3);
      const next = Math.round(startVal + (target - startVal) * eased);
      setDisplay(next);
      if (p < 1) rafRef.current = requestAnimationFrame(tick);
      else fromRef.current = target;
    };

    rafRef.current = requestAnimationFrame(tick);
    return () => rafRef.current && cancelAnimationFrame(rafRef.current);
  }, [value]);

  return <>{display}</>;
};

export default function StatCards({ config, refreshKey, activeCode, onSelect }) {
  const [counts, setCounts] = useState({
    today: 0, open: 0, inprogress: 0, pending: 0, resolved: 0, closed: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    (async () => {
      try {
        const res = await deptDashboardApi.getTicketCounts(config);
        if (cancelled) return;
        if (res.data?.data?.TicketList) compute(res.data.data.TicketList);
      } catch (e) {
        console.error('Counts fetch failed:', e);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [config.userID, refreshKey]);

  const compute = (tickets) => {
    let today = 0, open = 0, inprogress = 0, pending = 0, resolved = 0, closed = 0;
    const now = new Date();

    tickets.forEach((t) => {
      if (t.ticketCreatedOn) {
        const parts = t.ticketCreatedOn.split(' ');
        const d = parts[0].split('/');
        const t24 = parts[1] ? parts[1].split(':') : ['0', '0'];
        let h = parseInt(t24[0], 10);
        const m = parseInt(t24[1], 10) || 0;
        const ampm = (parts[2] || '').toLowerCase();
        if (ampm === 'pm' && h < 12) h += 12;
        if (ampm === 'am' && h === 12) h = 0;
        const dt = new Date(+d[2], +d[1] - 1, +d[0], h, m);
        if (
          dt.getFullYear() === now.getFullYear() &&
          dt.getMonth() === now.getMonth() &&
          dt.getDate() === now.getDate()
        ) today++;
      }

      switch (t.ticketStatus) {
        case 100: open++; break;
        case 101:
        case 102: inprogress++; break;
        case 103: pending++; break;
        case 104: resolved++; break;
        case 105: closed++; break;
        default: break;
      }
    });

    setCounts({ today, open, inprogress, pending, resolved, closed });
  };

  const total =
    counts.today + counts.open + counts.inprogress +
    counts.pending + counts.resolved + counts.closed;

  return (
    <div className="dept-user-stats-wrap">
      <div className="dept-user-stats-grid">
        {CARDS.map((card, idx) => {
          const Icon = card.Icon;
          const isActive = activeCode === card.code;
          const value = counts[card.key];

          return (
            <motion.button
              key={card.key}
              type="button"
              className={`dept-stat-card color-${card.color} ${isActive ? 'active' : ''} ${loading ? 'is-loading' : ''}`}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.06, duration: 0.35 }}
              whileHover={{ y: -6, scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() =>
                onSelect(
                  isActive ? null : card.code,
                  isActive ? 'My Tickets' : card.label
                )
              }
            >
              <div className={`dept-stat-icon color-${card.color}`}>
                <Icon size={20} />
              </div>
              <div className="dept-stat-body">
                <div className="dept-stat-value">
                  {loading ? <div className="dept-stat-skel" /> : <AnimatedNumber value={value} />}
                </div>
                <div className="dept-stat-label">{card.label}</div>
              </div>
              {isActive && (
                <motion.div
                  className="dept-stat-active-bar"
                  layoutId="activeBar"
                  transition={{ type: 'spring', damping: 25, stiffness: 300 }}
                />
              )}
            </motion.button>
          );
        })}
      </div>
    </div>
  );
}