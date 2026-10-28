import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import {
  Ticket, Clock, Hourglass, CheckCircle,
  XCircle, BarChart3, TrendingUp,
} from 'lucide-react';
import { grievanceApi } from '../../API/grievanceApi';
import '../../styles/admin/AnalyticsCards.css';

const CARDS = [
  { key: 'openTickets',       label: 'Open Tickets',   status: 100, flag: '0',     icon: Ticket,      color: 'green'  },
  { key: 'inProgressTickets', label: 'In Progress',    status: 101, flag: '0',     icon: Clock,       color: 'orange' },
  { key: 'pendingTickets',    label: 'Pending',        status: 103, flag: '0',     icon: Hourglass,   color: 'amber'  },
  { key: 'resolvedTickets',   label: 'Resolved',       status: 104, flag: '0',     icon: CheckCircle, color: 'blue'   },
  { key: 'closedTickets',     label: 'Closed',         status: 105, flag: '0',     icon: XCircle,     color: 'red'    },
  { key: 'totalTickets',      label: 'Total Tickets',  status: 0,   flag: 'total', icon: BarChart3,   color: 'purple' },
  { key: 'slaCompliance',     label: 'SLA Compliance', status: null, flag: null,   icon: TrendingUp,  color: 'teal'   },
];

const AnalyticsCards = ({ stats, activeStatus, onSelect, onStatsLoaded }) => {
  // Fire onStatsLoaded once stats has real data
  useEffect(() => {
    if (!onStatsLoaded) return;
    // Consider "loaded" when totalTickets is present (even if 0)
    if (stats && stats.totalTickets !== undefined) {
      onStatsLoaded();
    }
  }, [stats, onStatsLoaded]);

  return (
    <div className="analytics-grid">
      {CARDS.map((card, i) => {
        const Icon = card.icon;
        const value = stats[card.key];
        const isPercent = card.key === 'slaCompliance';
        const isActive = activeStatus === card.status;
        const clickable = card.status !== null;

        return (
          <motion.div
            key={card.key}
            className={`analytic-card ${card.color} ${isActive ? 'active' : ''} ${clickable ? 'clickable' : ''}`}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05, duration: 0.35 }}
            whileHover={clickable ? { y: -3 } : {}}
            onClick={() => {
              if (!clickable) return;
              const tabNames = {
                100: 'Open Tickets',
                101: 'In Progress Tickets',
                103: 'Pending Tickets',
                104: 'Resolved Tickets',
                105: 'Closed Tickets',
                0: 'Total Tickets',
              };
              onSelect(card.status, card.flag, tabNames[card.status] || 'Tickets');
            }}
          >
            <div className={`analytic-icon ${card.color}`}>
              <Icon size={22} />
            </div>
            <div className="analytic-body">
              <div className="analytic-value">
                {value !== undefined && value !== null ? value : 0}
                {isPercent ? '%' : ''}
              </div>
              <div className="analytic-label">{card.label}</div>
            </div>
          </motion.div>
        );
      })}
    </div>
  );
};

export default AnalyticsCards;