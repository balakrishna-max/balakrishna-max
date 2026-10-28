import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { motion } from 'framer-motion';
import {
  X, Clock, AlertTriangle, CheckCircle2, Loader2,
  User, TrendingUp, Zap, ShieldAlert, Award, Calendar,
} from 'lucide-react';
import { grievanceApi } from '../../API/grievanceApi';

const LEVEL_META = {
  L1:    { label: 'L1 Support',     color: 'blue',   Icon: Zap,         desc: 'Basic Troubleshooting' },
  L2:    { label: 'L2 Support',     color: 'purple', Icon: TrendingUp,  desc: 'Advanced Technical Support' },
  L3:    { label: 'L3 Support',     color: 'amber',  Icon: Award,       desc: 'Expert / Management Level' },
  ADMIN: { label: 'Admin Support',  color: 'red',    Icon: ShieldAlert, desc: 'Administrative Support' },
};

// Parse "2026-09-22T18:42:04.017" or "22/09/2026 6:42:04 PM"
function parseAnyDate(s) {
  if (!s) return null;
  if (typeof s !== 'string') return null;
  const iso = new Date(s);
  if (!isNaN(iso.getTime())) return iso;

  const m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})\s+(\d{1,2}):(\d{2}):(\d{2})\s*(am|pm)?$/i);
  if (m) {
    let h = +m[4];
    if (m[7]?.toLowerCase() === 'pm' && h !== 12) h += 12;
    if (m[7]?.toLowerCase() === 'am' && h === 12) h = 0;
    return new Date(+m[3], +m[2] - 1, +m[1], h, +m[5], +m[6]);
  }
  return null;
}

function formatDuration(totalSeconds) {
  const s = Math.abs(totalSeconds);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${sec}s`;
  return `${sec}s`;
}

const SlaModal = ({ config, ticketNumber, onClose }) => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [tick, setTick] = useState(0); // forces re-render every second

  useEffect(() => {
    if (!ticketNumber) {
      setError('No ticket number provided');
      setLoading(false);
      return;
    }

    (async () => {
      setLoading(true);
      setError('');
      try {
        const res = await grievanceApi.getTicketHistoryByNumber(ticketNumber);
        console.log('🔍 [SlaModal] Response:', res.data);

        if (res.data?.status === 'SUCCESS' && res.data.data) {
          setData(res.data.data);
        } else {
          setError(`API error: ${res.data?.status || 'unknown'}`);
        }
      } catch (e) {
        console.error('🔍 [SlaModal] Error:', e);
        setError(e?.response?.data || e?.message || 'Failed to load SLA info');
      } finally {
        setLoading(false);
      }
    })();
  }, [ticketNumber]);

  // tick every second for live progress on the current stage
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(id);
  }, []);

  const history = (data?.ticketHistoryDTOList || []).filter(
    (r) => r.slaLevel && r.slaUserDefinedTime
  );

  // Sort oldest first
  history.sort((a, b) => {
    const da = parseAnyDate(a.ticketHistoryCreatedOn);
    const db = parseAnyDate(b.ticketHistoryCreatedOn);
    if (!da || !db) return 0;
    return da - db;
  });

  // Enrich each entry with SLA state
  // ✅ Each stage runs from its own creation to the NEXT stage's creation.
  //    The last stage runs from its creation to "now".
  const enriched = history.map((r, idx) => {
    const created = parseAnyDate(r.ticketHistoryCreatedOn) || new Date();
    const slaSec = Number(r.slaUserDefinedTime) * 60;
    const isLatest = idx === history.length - 1;

    const stageEnd = isLatest
      ? new Date()
      : parseAnyDate(history[idx + 1].ticketHistoryCreatedOn) || new Date();

    const elapsed = Math.max(0, Math.floor((stageEnd - created) / 1000));
    const pct = slaSec > 0 ? Math.min(100, (elapsed / slaSec) * 100) : 0;
    const remaining = slaSec - elapsed;
    const breached = elapsed > slaSec;
    const level = (r.slaLevel || '').toUpperCase();
    const meta = LEVEL_META[level] || LEVEL_META.L1;

    return {
      ...r, created, slaSec, isLatest,
      used: elapsed, pct, remaining, breached, level, meta,
    };
  });

  const totalBreached = enriched.filter((e) => e.breached).length;
  const latest = enriched[enriched.length - 1];
  const overallPct = latest ? latest.pct : 0;
  const overallStatus =
    totalBreached > 0 ? 'breached' :
    overallPct > 80    ? 'critical' :
    overallPct > 50    ? 'warning'  : 'healthy';

  const STATUS_COPY = {
    breached: { text: 'SLA Breached',    cls: 'danger',  Icon: ShieldAlert },
    critical: { text: 'SLA Critical',    cls: 'danger',  Icon: AlertTriangle },
    warning:  { text: 'Approaching SLA', cls: 'warning', Icon: Clock },
    healthy:  { text: 'Within SLA',      cls: 'success', Icon: CheckCircle2 },
  };
  const overall = STATUS_COPY[overallStatus] || STATUS_COPY.healthy;

  return createPortal(
    <div className="grv-modal-overlay" onClick={onClose}>
      <motion.div
        className="grv-modal-box sla-modal-box"
        onClick={(e) => e.stopPropagation()}
        initial={{ opacity: 0, scale: 0.95, y: 16 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 16 }}
        transition={{ duration: 0.22, ease: 'easeOut' }}
      >
        {/* Header */}
        <div className="sla-modal-header">
          <div className="sla-modal-title">
            <div className="sla-modal-icon">
              <Clock size={20} />
            </div>
            <div>
              <h2>SLA Information</h2>
              <p>Escalation timeline for ticket {ticketNumber}</p>
            </div>
          </div>
          <button className="icon-btn" onClick={onClose} aria-label="Close">
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="sla-modal-body">
          {loading ? (
            <div className="sla-loading">
              <Loader2 size={28} className="spin" />
              <span>Loading SLA information...</span>
            </div>
          ) : error ? (
            <div className="sla-loading sla-error">
              <AlertTriangle size={28} />
              <span>{error}</span>
            </div>
          ) : enriched.length === 0 ? (
            <div className="sla-loading">
              <Clock size={28} />
              <span>No SLA escalation data available</span>
              <p className="sla-empty-hint">
                This ticket hasn't reached any escalation level yet.
              </p>
            </div>
          ) : (
            <>
              {/* Overall status banner */}
              {latest && (
                <motion.div
                  className={`sla-overall-banner ${overall.cls}`}
                  initial={{ opacity: 0, y: -8 }}
                  animate={{ opacity: 1, y: 0 }}
                >
                  <div className="sla-overall-icon">
                    <overall.Icon size={22} />
                  </div>
                  <div className="sla-overall-info">
                    <span className="sla-overall-label">Current Status</span>
                    <span className="sla-overall-value">{overall.text}</span>
                  </div>
                  <div className="sla-overall-meta">
                    <span className="sla-overall-pct">{Math.round(overallPct)}%</span>
                    <span className="sla-overall-sub">
                      {latest.breached
                        ? `${formatDuration(latest.remaining)} overdue`
                        : `${formatDuration(latest.remaining)} remaining`}
                    </span>
                  </div>
                </motion.div>
              )}

              {/* Escalation cards */}
              <div className="sla-cards">
                {enriched.map((e, idx) => {
                  const MetaIcon = e.meta.Icon;
                  const isBreached = e.breached;
                  const isActive   = e.isLatest && !isBreached;
                  const isResolved = !e.isLatest;

                  const badgeText = isBreached
                    ? 'Breached'
                    : isActive
                    ? 'Active'
                    : 'Resolved';

                  return (
                    <motion.div
                      key={e.ticketHistoryId || idx}
                      className={`sla-card level-${e.meta.color} ${
                        isBreached ? 'breached' : ''
                      } ${isActive ? 'active' : ''}`}
                      initial={{ opacity: 0, y: 12 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: idx * 0.07, duration: 0.3 }}
                    >
                      {/* Card header */}
                      <div className="sla-card-header">
                        <div className="sla-card-title-row">
                          <div className={`sla-card-level-badge ${e.meta.color}`}>
                            <MetaIcon size={13} />
                            <span>{e.level}</span>
                          </div>
                          <div className="sla-card-title-text">
                            <h3>{e.meta.label}</h3>
                            <p>{e.meta.desc}</p>
                          </div>
                        </div>

                        <div className="sla-card-header-right">
                          <span
                            className={`sla-badge ${
                              isBreached ? 'breached' : isActive ? 'active' : 'resolved'
                            }`}
                          >
                            {isBreached && <ShieldAlert size={11} />}
                            {isActive && <Clock size={11} />}
                            {isResolved && !isBreached && <CheckCircle2 size={11} />}
                            {badgeText}
                          </span>
                          <span
                            className={`sla-card-pct ${
                              isBreached ? 'danger' : e.pct > 80 ? 'warning' : 'success'
                            }`}
                          >
                            {Math.round(e.pct)}%
                          </span>
                        </div>
                      </div>

                      {/* Progress bar */}
                      <div className="sla-progress">
                        <motion.div
                          className={`sla-progress-fill ${
                            isBreached ? 'danger' : e.pct > 80 ? 'warning' : 'success'
                          }`}
                          initial={{ width: 0 }}
                          animate={{ width: `${e.pct}%` }}
                          transition={{
                            delay: idx * 0.07 + 0.2,
                            duration: 0.8,
                            ease: 'easeOut',
                          }}
                        />
                      </div>

                      {/* Meta info */}
                      <div className="sla-card-meta">
                        <div className="sla-card-meta-item">
                          <Clock size={12} />
                          <span>
                            SLA Time:{' '}
                            <strong>{Math.round(e.slaSec / 60)} min</strong>
                          </span>
                        </div>

                        {e.assignedUserName && (
                          <div className="sla-card-meta-item">
                            <User size={12} />
                            <span>
                              Assigned to: <strong>{e.assignedUserName}</strong>
                            </span>
                          </div>
                        )}

                        <div className="sla-card-meta-item">
                          <Calendar size={12} />
                          <span>
                            {e.ticketHistoryCreatedOn
                              ? new Date(e.created).toLocaleString()
                              : 'N/A'}
                          </span>
                        </div>
                      </div>

                      {/* Remarks */}
                      {e.ticketHistoryRemarks && (
                        <div className="sla-card-remarks">
                          <span className="sla-card-remarks-label">Remarks:</span>
                          <span>{e.ticketHistoryRemarks}</span>
                        </div>
                      )}
                    </motion.div>
                  );
                })}
              </div>

              {/* Legend */}
              <motion.div
                className="sla-legend"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.5 }}
              >
                <h4>Escalation Timeline</h4>
                <div className="sla-legend-grid">
                  {Object.entries(LEVEL_META).map(([key, m]) => {
                    const Icon = m.Icon;
                    return (
                      <div key={key} className={`sla-legend-item level-${m.color}`}>
                        <div className={`sla-legend-dot ${m.color}`}>
                          <Icon size={11} />
                        </div>
                        <div>
                          <div className="sla-legend-title">Escalate to {key}</div>
                          <div className="sla-legend-desc">{m.desc}</div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </motion.div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="sla-modal-footer">
          <button className="btn-ghost" onClick={onClose}>
            Close
          </button>
        </div>
      </motion.div>
    </div>,
    document.body
  );
};

export default SlaModal;