import React, { useEffect, useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight,
  User, Inbox,
} from 'lucide-react';
import { grievanceApi } from '../../API/grievanceApi';
import ExportMenu from './ExportMenu';
import { exportToExcel, exportToPDF } from '../../utils/exportTickets';
import '../../styles/admin/TicketsTable.css';

const PRIORITY_MAP = {
  1: { text: 'High',   cls: 'high' },
  2: { text: 'Medium', cls: 'medium' },
  3: { text: 'Low',    cls: 'low' },
};

const STATUS_MAP = {
  100: { text: 'Open',        cls: 'open' },
  101: { text: 'In Progress', cls: 'inprogress' },
  102: { text: 'In Progress', cls: 'inprogress' },
  103: { text: 'Pending',     cls: 'pending' },
  104: { text: 'Resolved',    cls: 'resolved' },
  105: { text: 'Closed',      cls: 'closed' },
};

const PAGE_SIZE_DEFAULT = 10;

const TicketsTable = ({
  config, filter, refreshKey, onStatsUpdate, onTicketClick,
  advancedFilters = {}, searchQuery = '', onDataLoad,
}) => {
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(PAGE_SIZE_DEFAULT);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const res = await grievanceApi.getTicketsByStatus({
          status: filter.status,
          flag: filter.flag,
          page: 0,
          size: 200,
        });
        if (cancelled) return;
        if (res.data.status === 'SUCCESS') {
          const list = res.data.data.RequestedTickets || [];
          setTickets(list);
          onStatsUpdate?.(res.data.data.DashBoardCount);
          onDataLoad?.(list);
        }
      } catch (err) {
        console.error('Ticket fetch failed:', err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [filter.status, filter.flag, refreshKey]);

  /* Client-side filter */
  const filteredTickets = useMemo(() => {
    let list = [...tickets];

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter((t) =>
        (t.ticketNumber || '').toLowerCase().includes(q) ||
        (t.ticketDescription || '').toLowerCase().includes(q) ||
        (t.ticketSupportUserName || '').toLowerCase().includes(q) ||
        (t.ticketProcessName || '').toLowerCase().includes(q)
      );
    }

    if (advancedFilters.ticketNumber) {
      list = list.filter((t) =>
        (t.ticketNumber || '').toLowerCase().includes(advancedFilters.ticketNumber.toLowerCase())
      );
    }
    if (advancedFilters.user) {
      list = list.filter((t) =>
        String(t.ticketAssignedTo) === String(advancedFilters.user)
      );
    }
    if (advancedFilters.priority) {
      list = list.filter((t) =>
        String(t.ticketPriority) === String(advancedFilters.priority)
      );
    }
    if (advancedFilters.category) {
      list = list.filter((t) =>
        (t.ticketProcessName || '').toLowerCase() === advancedFilters.category.toLowerCase()
      );
    }
    if (advancedFilters.slaStatus) {
      list = list.filter((t) => {
        const sla = computeSla(t);
        return advancedFilters.slaStatus === 'breach'
          ? sla.cls === 'breach'
          : sla.cls === 'ok';
      });
    }

    return list;
  }, [tickets, searchQuery, advancedFilters]);

  const paginatedTickets = useMemo(() => {
    const start = page * pageSize;
    return filteredTickets.slice(start, start + pageSize);
  }, [filteredTickets, page, pageSize]);

  const computedTotal = filteredTickets.length;
  const computedTotalPages = Math.max(1, Math.ceil(computedTotal / pageSize));

  useEffect(() => { setPage(0); }, [searchQuery, advancedFilters, filter.status]);

  const pageRange = () => {
    const from = computedTotal === 0 ? 0 : page * pageSize + 1;
    const to = Math.min((page + 1) * pageSize, computedTotal);
    return `${from} - ${to} of ${computedTotal} rows`;
  };

  /* ------------------------------------------------------------
     EXPORT HANDLERS — use the full filtered set (all pages),
     not just the visible page.
     ------------------------------------------------------------ */
  const handleExportExcel = () => {
    const rows = filteredTickets.map((t) => ({
      ...t,
      slaText: computeSla(t).text,
    }));
    exportToExcel(rows, {
      title: filter.tabName || 'Tickets Report',
      filterLabel: filter.tabName || 'All',
      search: searchQuery || '',
    });
  };

  const handleExportPDF = () => {
    const rows = filteredTickets.map((t) => ({
      ...t,
      slaText: computeSla(t).text,
    }));
    exportToPDF(rows, {
      title: filter.tabName || 'Tickets Report',
      filterLabel: filter.tabName || 'All',
      search: searchQuery || '',
    });
  };

  if (loading) {
    return (
      <div className="tickets-card">
        <div className="tickets-header">
          <h2>{filter.tabName}</h2>
          <span className="tickets-count">Loading...</span>
        </div>
        <div className="tickets-skeleton">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="tickets-skeleton-row">
              <div className="tickets-skeleton-cell w10" />
              <div className="tickets-skeleton-cell w20" />
              <div className="tickets-skeleton-cell w30" />
              <div className="tickets-skeleton-cell w15" />
              <div className="tickets-skeleton-cell w10" />
              <div className="tickets-skeleton-cell w10" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  const hasActiveFilters =
    !!searchQuery || Object.values(advancedFilters).some(Boolean);

  return (
    <div className="tickets-card">
      <div className="tickets-header">
        <h2>{filter.tabName}</h2>
        <div className="tickets-header-right">
          <span className="tickets-count">
            {computedTotal} {hasActiveFilters ? 'filtered' : 'total'}
          </span>
          <ExportMenu
            onExportExcel={handleExportExcel}
            onExportPDF={handleExportPDF}
            disabled={computedTotal === 0}
          />
        </div>
      </div>

      {paginatedTickets.length === 0 ? (
        <div className="empty-state">
          <Inbox size={44} />
          <h3>No tickets match your filters</h3>
          <p>Try clearing your search or adjusting the filter panel</p>
        </div>
      ) : (
        <>
          <div className="table-wrapper">
            <table className="tickets-table">
              <thead>
                <tr>
                  <th>S.No</th>
                  <th>Ticket ID</th>
                  <th>Issue</th>
                  <th>Agent</th>
                  <th>SLA</th>
                  <th>Priority</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                <AnimatePresence initial={false}>
                  {paginatedTickets.map((t, idx) => {
                    const priority = PRIORITY_MAP[t.ticketPriority] || { text: '-', cls: '' };
                    const status = STATUS_MAP[t.ticketStatus] || { text: 'Unknown', cls: '' };
                    const sla = computeSla(t);
                    const serial = page * pageSize + idx + 1;

                    return (
                      <motion.tr
                        key={t.ticketId}
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0 }}
                        transition={{ delay: Math.min(idx * 0.02, 0.3), duration: 0.2 }}
                        onClick={() => onTicketClick(t.ticketId)}
                        style={{ cursor: 'pointer' }}
                      >
                        <td className="center">{serial}</td>
                        <td className="center">
                          <span className="ticket-link">{t.ticketNumber}</span>
                        </td>
                        <td className="issue-cell">
                          {t.ticketDescription || '-'}
                        </td>
                        <td>
                          <div className="agent-cell">
                            <div className="agent-avatar">
                              {t.helpDeskUserImageData ? (
                                <img
                                  src={`data:image/${(t.helpDeskUserImageType || 'png').toLowerCase()};base64,${t.helpDeskUserImageData}`}
                                  alt=""
                                />
                              ) : (
                                <User size={14} />
                              )}
                            </div>
                            <span>{t.ticketSupportUserName || 'Unassigned'}</span>
                          </div>
                        </td>
                        <td className="center">
                          <span className={`sla-pill ${sla.cls}`}>{sla.text}</span>
                        </td>
                        <td className="center">
                          <span className={`priority-pill ${priority.cls}`}>
                            {priority.text}
                          </span>
                        </td>
                        <td className="center">
                          <span className={`status-pill ${status.cls}`}>
                            {status.text}
                          </span>
                        </td>
                      </motion.tr>
                    );
                  })}
                </AnimatePresence>
              </tbody>
            </table>
          </div>

          <div className="tickets-pagination">
            <div className="pagination-left">
              <button className="page-btn" disabled={page === 0} onClick={() => setPage(0)}>
                <ChevronsLeft size={14} />
              </button>
              <button className="page-btn" disabled={page === 0} onClick={() => setPage(page - 1)}>
                <ChevronLeft size={14} />
              </button>
              <span className="page-indicator">
                Page <strong>{page + 1}</strong> of <strong>{computedTotalPages}</strong>
              </span>
              <button className="page-btn" disabled={page >= computedTotalPages - 1} onClick={() => setPage(page + 1)}>
                <ChevronRight size={14} />
              </button>
              <button className="page-btn" disabled={page >= computedTotalPages - 1} onClick={() => setPage(computedTotalPages - 1)}>
                <ChevronsRight size={14} />
              </button>
            </div>

            <div className="pagination-mid">
              <span>Rows per page:</span>
              <select
                value={pageSize}
                onChange={(e) => {
                  setPageSize(Number(e.target.value));
                  setPage(0);
                }}
              >
                {[10, 20, 30, 40].map((n) => (
                  <option key={n} value={n}>{n}</option>
                ))}
              </select>
            </div>

            <div className="pagination-right">{pageRange()}</div>
          </div>
        </>
      )}
    </div>
  );
};

/* ------------------------------------------------------------
   Helpers
   ------------------------------------------------------------ */
function parseDate(str) {
  if (!str) return null;
  str = String(str).trim().replace(/\s+/g, ' ').toLowerCase();

  let m = str.match(/^(\d{2})[/\-](\d{2})[/\-](\d{4}) (\d{1,2}):(\d{2}) (am|pm)$/);
  if (m) {
    let h = parseInt(m[4], 10);
    if (m[6] === 'pm' && h !== 12) h += 12;
    if (m[6] === 'am' && h === 12) h = 0;
    return new Date(+m[3], +m[2] - 1, +m[1], h, +m[5], 0);
  }
  m = str.match(/^(\d{2})[/\-](\d{2})[/\-](\d{4}) (\d{1,2}):(\d{2})$/);
  if (m) return new Date(+m[3], +m[2] - 1, +m[1], +m[4], +m[5], 0);
  m = str.match(/^(\d{2})[/\-](\d{2})[/\-](\d{4})$/);
  if (m) return new Date(+m[3], +m[2] - 1, +m[1], 0, 0, 0);

  const iso = new Date(str);
  return isNaN(iso.getTime()) ? null : iso;
}

function computeSla(ticket) {
  const startStr = ticket.ticketUpdatedOn || ticket.ticketDate;
  const slaMinutes = Number(ticket.slaUserDefinedTime);
  const start = parseDate(startStr);
  if (!start || isNaN(slaMinutes)) return { text: '-', cls: '' };

  const status = Number(ticket.ticketStatus);
  const end = (status === 104 || status === 105)
    ? parseDate(ticket.ticketUpdatedOn)
    : new Date();
  if (!end) return { text: '-', cls: '' };

  let diffSec = Math.floor((end - start) / 1000);
  if (diffSec < 0) diffSec = 0;

  const remaining = slaMinutes * 60 - diffSec;
  const abs = Math.abs(remaining);
  const h = Math.floor(abs / 3600);
  const m = Math.floor((abs % 3600) / 60);

  if (remaining > 0) return { text: `In ${h}h ${m}m`, cls: 'ok' };
  return { text: `Crossed ${h}h ${m}m`, cls: 'breach' };
}

export default TicketsTable;