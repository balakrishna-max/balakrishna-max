import { useEffect, useState, useCallback } from 'react';
import InlineBanner from '../InlineBanner.jsx';
import { useCollab } from '../../context/CollabContext.jsx';
import { sendEmail, getEmails, markEmailRead, updateUnreadCountByType } from '../../api/client.js';
import { formatChatTime } from '../../utils/collabHelpers.js';

export default function EmailTab({ onAfterAction }) {
  const { config, selectedUserIds, asset } = useCollab();
  const [filter, setFilter] = useState('received');
  const [emails, setEmails] = useState([]);
  const [pageNo, setPageNo] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [view, setView] = useState('list'); // list | compose | detail
  const [selected, setSelected] = useState(null);

  const [subject, setSubject] = useState('');
  const [description, setDescription] = useState('');
  const [error, setError] = useState('');
  const [listError, setListError] = useState('');
  const [sending, setSending] = useState(false);

  const loadEmails = useCallback(
    (ft, page) => {
      getEmails(ft, config.sessionId, page, config.moduleId)
        .then(({ data }) => {
          updateUnreadCountByType(config.userId, 'EMAIL').catch(() => {});
          let items = [];
          if (data?.content) {
            items = data.content;
            if (data.totalPages) setTotalPages(data.totalPages);
          } else if (Array.isArray(data)) {
            items = data;
          }
          const expectedMailType = ft === 'sent' ? 0 : 1;
          items = items.filter((item) => Number(item.mailType) === expectedMailType);
          setEmails(items);
          onAfterAction?.();
        })
        .catch(() => { setEmails([]); setListError('Unable to load emails right now. Please try again.'); });
    },
    [config.sessionId, config.moduleId, config.userId, onAfterAction]
  );

  useEffect(() => {
    if (view === 'list') {
      setPageNo(1);
      loadEmails(filter, 1);
    }
  }, [filter, view, loadEmails]);

  const submitEmail = () => {
    setError('');
    if (!selectedUserIds) return setError('Please select at least one user.');
    if (subject.trim().length < 3) return setError('Subject must be at least 3 characters.');
    if (description.trim().length < 2) return setError('Message body is required.');

    setSending(true);
    sendEmail({
      description,
      subject,
      tenderId: config.sessionId,
      selectedIds: selectedUserIds,
      selectedcheckbox: 'sendEmail',
      moduleId: config.moduleId,
    })
      .then(() => {
        setSubject('');
        setDescription('');
        setView('list');
        setFilter('sent');
      })
      .catch((err) => setError(err.isServerErrorPage ? 'Server error while sending email. Please try again.' : 'Failed to send email.'))
      .finally(() => setSending(false));
  };

  const openDetail = (item) => {
    setSelected(item);
    setView('detail');
    if (filter === 'received' && item.pkId) {
      markEmailRead(item.communicationType, item.pkId).catch(() => {});
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {view === 'list' && (
        <>
          <div className="a2z-collab-email-header-row">
            <div className="a2z-collab-email-filters">
              <button type="button" className={`a2z-collab-email-filter${filter === 'received' ? ' active' : ''}`} onClick={() => setFilter('received')}>
                Received
              </button>
              <button type="button" className={`a2z-collab-email-filter${filter === 'sent' ? ' active' : ''}`} onClick={() => setFilter('sent')}>
                Sent
              </button>
            </div>
            <input type="button" value="New Email" className="Button2" onClick={() => setView('compose')} />
          </div>

          {listError && <InlineBanner message={listError} />}
          <div id="collabEmailListContainer">
            {!listError && emails.length === 0 && <div className="a2z-collab-muted">No emails found.</div>}
            {emails.map((item, i) => {
              const isUnread = filter === 'received' && item.messagRead === 1;
              const displayUser = filter === 'sent' ? item.reciver : item.sender;
              return (
                <div className={`a2z-collab-email-card${isUnread ? ' unread' : ''}`} key={i} onClick={() => openDetail(item)}>
                  <div className="a2z-collab-email-card-main">
                    <div className="a2z-collab-email-card-info">
                      <div className="a2z-collab-email-card-subject">{item.subject || '(No Subject)'}</div>
                      <div className="a2z-collab-email-card-to">
                        {filter === 'sent' ? 'To : ' : 'From : '}
                        {displayUser}
                      </div>
                    </div>
                    <div className="a2z-collab-email-card-date">{formatChatTime(item.date)}</div>
                  </div>
                </div>
              );
            })}
          </div>

          {totalPages > 1 && (
            <ul className="pagination">
              {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
                <li className={`page-item${p === pageNo ? ' active' : ''}`} key={p}>
                  <a
                    className="page-link"
                    onClick={() => {
                      setPageNo(p);
                      loadEmails(filter, p);
                    }}
                  >
                    {p}
                  </a>
                </li>
              ))}
            </ul>
          )}
        </>
      )}

      {view === 'compose' && (
        <div className="a2z-collab-compose-form">
          <div className="form-group">
            <label>
              Subject <span className="mand">*</span>
            </label>
            <textarea className="form-control tArea" maxLength={100} value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Enter here" />
          </div>
          <div className="form-group">
            <label>
              Write <span className="mand">*</span>
            </label>
            <textarea
              className="form-control tArea"
              rows={5}
              maxLength={500}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Enter here"
            />
          </div>
          {error && <InlineBanner message={error} />}
          <div className="a2z-collab-footer border-top">
            <button type="button" className="a2z-collab-back-btn" onClick={() => setView('list')}>
              <img src={asset('/resources/img/back-arrow-left.svg')} alt="Back" />
            </button>
            <input type="button" value={sending ? 'Sending…' : 'Send'} className="Button2" onClick={submitEmail} disabled={sending} />
          </div>
        </div>
      )}

      {view === 'detail' && selected && (
        <div className="a2z-collab-email-detail-content">
          <div className="a2z-collab-email-detail-header">
            <div className="a2z-collab-email-detail-subject">{selected.subject}</div>
            <div className="a2z-collab-email-detail-meta">
              <span>{filter === 'sent' ? selected.reciver : selected.sender}</span>
              <span className="a2z-collab-muted" style={{ padding: 0 }}>
                {formatChatTime(selected.date)}
              </span>
            </div>
          </div>
          <div className="a2z-collab-email-detail-body">{(selected.description || selected.body || selected.message || '').replace(/\n/g, '\n')}</div>
          <div className="a2z-collab-footer border-top">
            <button type="button" className="a2z-collab-back-btn" onClick={() => setView('list')}>
              <img src={asset('/resources/img/back-arrow-left.svg')} alt="Back" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
