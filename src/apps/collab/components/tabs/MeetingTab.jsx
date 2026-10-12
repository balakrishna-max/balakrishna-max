import { useEffect, useState, useCallback } from 'react';
import InlineBanner from '../InlineBanner.jsx';
import { useCollab } from '../../context/CollabContext.jsx';
import { saveMeetingInvitation, getMeetings, markMeetingRead, updateUnreadCountByType } from '../../api/client.js';
import { formatMonthDay, formatChatTime, getMeetingStatus } from '../../utils/collabHelpers.js';
import Flatpickr from 'react-flatpickr';
import 'flatpickr/dist/flatpickr.min.css';

export default function MeetingTab({ onAfterAction }) {
  const { config, selectedUserIds } = useCollab();
  const [filter, setFilter] = useState('received');
  const [meetings, setMeetings] = useState([]);
  const [pageNo, setPageNo] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const [title, setTitle] = useState('');
  const [date, setDate] = useState('');
  const [link, setLink] = useState('');
  const [error, setError] = useState('');
  const [listError, setListError] = useState('');
  const [saving, setSaving] = useState(false);

  const loadMeetings = useCallback(
    (ft, page) => {
      getMeetings(ft, config.sessionId, page, config.moduleId)
        .then(({ data }) => {
          updateUnreadCountByType(config.userId, 'MEETING').catch(() => {});
          let items = [];
          if (data?.content) {
            items = data.content;
            if (data.totalPages) setTotalPages(data.totalPages);
          } else if (Array.isArray(data)) {
            items = data;
          }
          setMeetings(items);
          onAfterAction?.();
        })
        .catch(() => { 
          setMeetings([]); 
          setListError('Unable to load meeting invitations right now. Please try again.'); 
        });
    },
    [config.sessionId, config.moduleId, config.userId, onAfterAction]
  );

  useEffect(() => {
    setPageNo(1);
    loadMeetings(filter, 1);
  }, [filter, loadMeetings]);

  const formatDateForBackend = (dateStr) => {
    if (!dateStr) return '';
    
    return dateStr;
  };

  const submit = () => {
    setError('');
    if (!selectedUserIds) return setError('Please select at least one user.');
    if (title.trim().length < 3) return setError('Title must be at least 3 characters.');
    if (!date) return setError('Date & time is required.');
    if (link.trim().length < 5) return setError('Invitation link looks too short.');

    
    const formattedDate = formatDateForBackend(date);

    setSaving(true);
    saveMeetingInvitation({
      meetingInviDate: formattedDate,
      meetingInviLink: link,
      meetingInviTitle: title,
      selectedIds: selectedUserIds,
      tenderId: config.sessionId,
      moduleId: config.moduleId,
    })
      .then(() => {
        setTitle('');
        setDate('');
        setLink('');
        setFilter('sent');
        loadMeetings('sent', 1);
      })
      .catch((err) => {
        setError(err.isServerErrorPage ? 'Server error while scheduling meeting. Please try again.' : 'Failed to schedule meeting.');
      })
      .finally(() => setSaving(false));
  };

  const joinMeeting = (item) => {
    const primaryId = item.nMeetingMasterID || item.meetingId;
    if (filter !== 'sent' && item.messageread === 1 && primaryId) {
      markMeetingRead(primaryId).then(() => loadMeetings('received', pageNo));
    }
    window.open(item.sMeetingLink || item.meetingInviLink, '_blank');
  };

  return (
    <div>
      <div className="a2z-collab-compose-form">
        <div className="a2z-collab-form-row">
          <div className="form-group" style={{ flex: 2 }}>
            <label>
              Title<span className="mand">*</span>
            </label>
            <input 
              className="form-control" 
              maxLength={100} 
              value={title} 
              onChange={(e) => setTitle(e.target.value)} 
              placeholder="Enter meeting title" 
            />
          </div>
          <div className="form-group">
            <label>
              Date &amp; Time<span className="mand">*</span>
            </label>
            <Flatpickr
              className="form-control"
              options={{
                enableTime: true,
                dateFormat: "d-m-Y h:i K",
                time_24hr: false,
                minDate: "today",
                minuteIncrement: 5,
                allowInput: true,
                placeholder: "Select date & time",
                
                altInput: true,
                altFormat: "d-m-Y h:i K",
                
                defaultDate: new Date(),
                
                locale: {
                  firstDayOfWeek: 1,
                  amPM: ["AM", "PM"],
                  time_24hr: false,
                },
                
                disableMobile: true,
              }}
              value={date}
              onChange={([selectedDate], dateStr) => {
                setDate(dateStr || '');
              }}
            />
            {/* Show the format that will be sent to backend */}
            {date && (
              <small style={{ color: '#6c757d', display: 'block', marginTop: '4px', fontSize: '11px' }}>
                Sending to server: {date}
              </small>
            )}
          </div>
        </div>
        <div className="a2z-collab-form-row">
          <div className="form-group">
            <label>
              Invitation Link<span className="mand">*</span>
            </label>
            <input 
              className="form-control" 
              maxLength={500} 
              value={link} 
              onChange={(e) => setLink(e.target.value)} 
              placeholder="Enter meeting link (e.g., https://meet.google.com/...)" 
            />
          </div>
        </div>
        {error && <InlineBanner message={error} />}
        <div className="a2z-collab-footernew">
          <input 
            type="button" 
            value={saving ? 'Sending…' : 'Send Invitation'} 
            className="Button2" 
            onClick={submit} 
            disabled={saving} 
          />
        </div>
      </div>

      <div className="a2z-collab-meeting-header-row">
        <div className="a2z-collab-meeting-filters">
          <button 
            type="button" 
            className={`a2z-collab-meeting-filter${filter === 'received' ? ' active' : ''}`} 
            onClick={() => setFilter('received')}
          >
            Received
          </button>
          <button 
            type="button" 
            className={`a2z-collab-meeting-filter${filter === 'sent' ? ' active' : ''}`} 
            onClick={() => setFilter('sent')}
          >
            Sent
          </button>
        </div>
      </div>

      {listError && <InlineBanner message={listError} />}
      <div id="collabMeetingListContainer">
        {!listError && meetings.length === 0 && (
          <div className="a2z-collab-muted">
            {filter === 'received' ? 'No meeting invitations received.' : 'No meeting invitations sent.'}
          </div>
        )}
        {meetings.map((item, i) => {
          const rawDate = item.dtMeetingDate || item.meetingInviDate || '';
          const md = formatMonthDay(rawDate);
          const status = getMeetingStatus(rawDate);
          const title = item.sMeetingTitle || item.meetingInviTitle || '--';
          const sender = item.sSenderUserName || item.sender || '';
          const receiver = item.selectedIds || item.receiver || '';
          const desc = filter === 'sent' ? (receiver ? 'To: ' + receiver : '') : sender ? 'By: ' + sender : '';
          const link = item.sMeetingLink || item.meetingInviLink || '';
          const sentTime = formatChatTime(item.sendingDate || item.dtLastModified);

          return (
            <div className="a2z-collab-meeting-item" key={i}>
              <div className="a2z-collab-meeting-date">
                <div className="a2z-collab-meeting-month">{md.month}</div>
                <div className="a2z-collab-meeting-day">{md.day}</div>
              </div>
              <div className="a2z-collab-meeting-left">
                <div className="a2z-collab-meeting-title-row">
                  <div className="a2z-collab-meeting-name">{title}</div>
                  <span className={`a2z-collab-meeting-status ${status.cls}`}>
                    {status.cls === 'status-ongoing' && <span className="a2z-collab-status-dot" />}
                    {status.label}
                  </span>
                  <span className="a2z-collab-meeting-time">{sentTime}</span>
                </div>
                {desc && <div className="a2z-collab-meeting-desc">{desc}</div>}
              </div>
              <div className="a2z-collab-meeting-right">
                {link ? (
                  status.cls === 'status-ended' ? (
                    <input 
                      type="button" 
                      value="Ended" 
                      className="Button2 a2z-collab-meeting-join-disabled" 
                      disabled 
                    />
                  ) : (
                    <input 
                      type="button" 
                      value="Join Meeting" 
                      className="Button2" 
                      onClick={() => joinMeeting(item)} 
                    />
                  )
                ) : (
                  <button type="button" className="a2z-collab-details-btn">
                    Details
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {totalPages > 1 && (
        <ul className="pagination" style={{ marginTop: '15px' }}>
          {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
            <li className={`page-item${p === pageNo ? ' active' : ''}`} key={p}>
              <a
                className="page-link"
                href="#"
                onClick={(e) => {
                  e.preventDefault();
                  setPageNo(p);
                  loadMeetings(filter, p);
                }}
              >
                {p}
              </a>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}