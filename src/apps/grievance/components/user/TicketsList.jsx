import React, { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Search, Eye, MessageSquare, Mic, MicOff,
  ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight,
  Inbox, Loader2,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { userGrievanceApi } from '../../API/userGrievanceApi';

const RECORDS_PER_PAGE = 5;

const STATUS_MAP = {
  100: { text: 'Open',        cls: 'open' },
  101: { text: 'In Progress', cls: 'inprogress' },
  102: { text: 'In Progress', cls: 'inprogress' },
  103: { text: 'Pending',     cls: 'pending' },
  104: { text: 'Resolved',    cls: 'resolved' },
  105: { text: 'Closed',      cls: 'closed' },
};

const PRIORITY_MAP = {
  1: { text: 'High',   cls: 'high' },
  2: { text: 'Medium', cls: 'medium' },
  3: { text: 'Low',    cls: 'low' },
};

/* Map UI label → backend status code (matches JSP switch) */
const STATUS_CODE_MAP = {
  Open: 100,
  InProgress: 101,
  Pending: 103,
  Resolved: 104,
  Closed: 105,
  todays: 200,
};

export default function TicketsList({
  config, statusFilter, refreshKey, onViewTicket, onViewComments,
}) {
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalElements, setTotalElements] = useState(0);
  const [searchText, setSearchText] = useState('');
  const [listening, setListening] = useState(false);

  const recognitionRef = useRef(null);
  const requestIdRef = useRef(0);

  /* Main data-load effect */
  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter.code, page, refreshKey]);

  /* Debounced search */
  useEffect(() => {
    const id = setTimeout(() => {
      if (page !== 1) setPage(1);
      else load();
    }, 400);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchText]);

  const load = async () => {
    const myReq = ++requestIdRef.current;
    setLoading(true);
    try {
      /* statusFilter.code comes from StatCards as a numeric code
         (100, 101, 103, 104, 105, 200) or null for "All". */
      const status = statusFilter.code ?? undefined;

      const params = {
        status,
        page: page - 1,               // backend is 0-based
        size: RECORDS_PER_PAGE,
        search: searchText || '',
        ticketRaisedBy: config.userID,
        assignedUserIds: [],
        priorities: [],
        fromDate: undefined,
        toDate: undefined,
      };

      console.log('🔍 [TicketsList] load() →', JSON.stringify(params));

      const res = await userGrievanceApi.getTickets(params);

      if (myReq !== requestIdRef.current) return;

      if (res.data?.data) {
        setTickets(res.data.data.tickets || []);
        setTotalElements(res.data.data.totalItems || 0);
      } else {
        setTickets([]);
        setTotalElements(0);
      }
    } catch (err) {
      if (myReq === requestIdRef.current) {
        console.error(err);
        setTickets([]);
        setTotalElements(0);
      }
    } finally {
      if (myReq === requestIdRef.current) setLoading(false);
    }
  };

  /* Voice search */
  const toggleVoice = async () => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) {
      toast.error('Speech recognition is not supported in this browser. Please use Chrome or Edge.', {
        duration: 4000,
      });
      return;
    }
    if (listening) {
      try { recognitionRef.current?.stop(); } catch (e) { console.warn(e); }
      return;
    }
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('Microphone API not available');
      }
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach((track) => track.stop());
    } catch (err) {
      let msg = 'Microphone not available.';
      if (err.name === 'NotFoundError' || err.message?.includes('Requested device not found')) {
        msg = 'Microphone not available: Requested device not found.';
      } else if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        msg = 'Microphone access denied. Please allow microphone access in your browser settings.';
      } else if (err.name === 'NotReadableError') {
        msg = 'Microphone is already in use by another application.';
      } else if (err.name === 'SecurityError') {
        msg = 'Microphone access blocked. Make sure the page is loaded over HTTPS.';
      } else if (err.message) {
        msg = 'Microphone not available: ' + err.message;
      }
      toast.error(msg, { duration: 5000 });
      return;
    }
    try {
      const rec = new SR();
      rec.continuous = false;
      rec.interimResults = true;
      rec.lang = 'en-US';
      rec.maxAlternatives = 1;

      rec.onstart = () => {
        setListening(true);
        toast.success('Listening... Speak now.', { duration: 2000 });
      };
      rec.onend = () => setListening(false);
      rec.onerror = (event) => {
        setListening(false);
        let msg = 'Voice recognition error.';
        switch (event.error) {
          case 'no-speech': msg = 'No speech detected. Please try again.'; break;
          case 'audio-capture': msg = 'Microphone not available: Requested device not found.'; break;
          case 'not-allowed': msg = 'Microphone access denied.'; break;
          case 'aborted': return;
          case 'network': msg = 'Network error. Check your connection.'; break;
          case 'service-not-allowed': msg = 'Speech recognition service not available.'; break;
          default: msg = 'Voice recognition error: ' + event.error;
        }
        toast.error(msg, { duration: 4000 });
      };
      rec.onresult = (event) => {
        let text = '';
        for (let i = event.resultIndex; i < event.results.length; i++) {
          text += event.results[i][0].transcript;
        }
        const cleaned = text.replace(/[.?!]+$/, '').trim();
        setSearchText(cleaned);
      };
      recognitionRef.current = rec;
      rec.start();
    } catch (e) {
      setListening(false);
      toast.error('Unable to start voice recognition: ' + (e.message || 'Unknown error'), {
        duration: 4000,
      });
    }
  };

  const totalPages = Math.max(1, Math.ceil(totalElements / RECORDS_PER_PAGE));
  const startRecord = totalElements === 0 ? 0 : (page - 1) * RECORDS_PER_PAGE + 1;
  const endRecord = Math.min(startRecord + tickets.length - 1, totalElements);

  return (
    <div className="tickets-list-card">
      {/* Header */}
      <div className="tickets-list-header">
        <div className="tickets-list-title">
          <h2>{statusFilter.label || 'My Tickets'}</h2>
          <p>{totalElements} total ticket{totalElements !== 1 ? 's' : ''}</p>
        </div>

        <div className="tickets-list-toolbar">
          <div className="tl-search">
            <Search size={14} />
            <input
              type="text"
              placeholder="Search by ticket ID or issue..."
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
            />
            <button
              type="button"
              className={`tl-mic ${listening ? 'is-listening' : ''}`}
              onClick={toggleVoice}
              title={listening ? 'Stop voice search' : 'Voice search'}
              aria-label={listening ? 'Stop voice search' : 'Voice search'}
            >
              {listening ? <MicOff size={13} /> : <Mic size={13} />}
            </button>
          </div>
        </div>
      </div>

      {/* Body */}
      {loading ? (
        <div className="tickets-loading">
          <Loader2 size={26} className="spin" />
          <span>Loading tickets...</span>
        </div>
      ) : tickets.length === 0 ? (
        <motion.div
          className="tickets-empty"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <Inbox size={44} />
          <h3>No tickets found</h3>
          <p>Try adjusting your search, or create a new ticket</p>
        </motion.div>
      ) : (
        <>
          <div className="tickets-items">
            <AnimatePresence initial={false}>
              {tickets.map((t, idx) => {
                const status = STATUS_MAP[t.ticketStatus] || { text: 'Unknown', cls: '' };
                const priority = PRIORITY_MAP[t.ticketPriority] || { text: '', cls: '' };
                return (
                  <motion.article
                    key={t.ticketId}
                    className="ticket-item"
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    transition={{ delay: idx * 0.04, duration: 0.25 }}
                  >
                    <div className="ticket-item-header">
                      <div className="ticket-item-id">
                        <span className="tii-label">Ticket</span>
                        <span className="tii-number">{t.ticketNumber}</span>
                      </div>
                      <div className="ticket-item-actions">
                        {priority.text && (
                          <span className={`ticket-priority-pill ${priority.cls}`}>
                            {priority.text}
                          </span>
                        )}
                        <span className={`ticket-status-pill ${status.cls}`}>
                          {status.text}
                        </span>
                        <button
                          className="ticket-icon-btn"
                          onClick={() => onViewTicket(t.ticketId)}
                          title="View details"
                        >
                          <Eye size={14} />
                        </button>
                        <button
                          className="ticket-icon-btn"
                          onClick={() => onViewComments(t.ticketId)}
                          title="View comments"
                        >
                          <MessageSquare size={14} />
                        </button>
                      </div>
                    </div>

                    <div className="ticket-item-body">
                      <p className="ticket-item-desc">{t.ticketDescription || '—'}</p>
                      <div className="ticket-item-meta">
                        <span className="tim-item">
                          <strong>Assigned:</strong> {t.ticketSupportUserName || 'Unassigned'}
                        </span>
                        <span className="tim-item">
                          {t.ticketCreatedOn || ''}
                        </span>
                        {t.ticketClosedDate && (
                          <span className="tim-item">
                            <strong>Closed:</strong> {t.ticketClosedDate}
                          </span>
                        )}
                      </div>
                      {t.ticketComments && (
                        <div className="ticket-item-comment">
                          <MessageSquare size={12} />
                          <span>{t.ticketComments}</span>
                        </div>
                      )}
                    </div>
                  </motion.article>
                );
              })}
            </AnimatePresence>
          </div>

          {totalElements > RECORDS_PER_PAGE && (
            <div className="tickets-pagination">
              <span className="tickets-page-info">
                Showing <strong>{startRecord}</strong> – <strong>{endRecord}</strong> of <strong>{totalElements}</strong>
              </span>
              <div className="tickets-page-controls">
                <button onClick={() => setPage(1)} disabled={page === 1}><ChevronsLeft size={14} /></button>
                <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}><ChevronLeft size={14} /></button>
                <span className="page-pill">Page {page} of {totalPages}</span>
                <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page === totalPages}><ChevronRight size={14} /></button>
                <button onClick={() => setPage(totalPages)} disabled={page === totalPages}><ChevronsRight size={14} /></button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}