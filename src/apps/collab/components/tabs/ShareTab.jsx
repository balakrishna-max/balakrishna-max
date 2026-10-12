import { useEffect, useState, useCallback } from 'react';
import InlineBanner from '../InlineBanner.jsx';
import { useCollab } from '../../context/CollabContext.jsx';
import {
  shareDocument,
  getShareDocs,
  downloadCollabFile,
  triggerBlobDownload,
  updateUnreadCountByType,
} from '../../api/client.js';
import { getAvatarColor, getInitials, buildFileIconClass, formatChatTime } from '../../utils/collabHelpers.js';

const ALLOWED_EXT = ['pdf', 'doc', 'docx', 'xls', 'xlsx'];
const MAX_SIZE = 5 * 1024 * 1024;

function buildAvatarFooter(users) {
  return users.map((user, i) => {
    const c = getAvatarColor(user);
    return (
      <span className="a2z-collab-footer-user" key={i}>
        <span className="a2z-collab-doc-avatar-initials" style={{ background: c.bg, color: c.color }}>
          {getInitials(user)}
        </span>
        <span className="a2z-collab-footer-name">{user}</span>
      </span>
    );
  });
}

export default function ShareTab({ onAfterAction }) {
  const { config, selectedUserIds, asset } = useCollab();
  const [filter, setFilter] = useState('received');
  const [docs, setDocs] = useState([]);
  const [pageNo, setPageNo] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const [description, setDescription] = useState('');
  const [file, setFile] = useState(null);
  const [fileLabel, setFileLabel] = useState('Drop files here or click to browse');
  const [error, setError] = useState('');
  const [listError, setListError] = useState('');
  const [sending, setSending] = useState(false);
  const [downloading, setDownloading] = useState(false);

  const loadDocs = useCallback(
    (ft, page) => {
      getShareDocs(ft, config.sessionId, page, config.moduleId)
        .then(({ data }) => {
          updateUnreadCountByType(config.userId, 'SHARE').catch(() => {});
          let items = [];
          if (Array.isArray(data)) {
            data.forEach((d) => {
              if (d.content) items = items.concat(d.content);
            });
          } else if (data?.content) {
            items = data.content;
            if (data.totalPages) setTotalPages(data.totalPages);
          }
          setDocs(items);
          onAfterAction?.();
        })
        .catch(() => { setDocs([]); setListError('Unable to load documents right now. Please try again.'); });
    },
    [config.sessionId, config.moduleId, config.userId, onAfterAction]
  );

  useEffect(() => {
    setPageNo(1);
    loadDocs(filter, 1);
  }, [filter, loadDocs]);

  const onFileChange = (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setError('');
    const ext = f.name.split('.').pop().toLowerCase();
    if (f.size === 0) return setError('Selected file is empty.');
    if (f.name.length > 50) return setError('File name must not exceed 50 characters.');
    if (f.size > MAX_SIZE) return setError('File size must be below 5 MB.');
    if (!ALLOWED_EXT.includes(ext)) return setError('File extension must be one of: ' + ALLOWED_EXT.join(', '));
    setFile(f);
    setFileLabel(f.name);
  };

  const submitShare = () => {
    setError('');
    if (!selectedUserIds) return setError('Please select at least one user.');
    if (!file) return setError('File is mandatory.');
    if (description.trim().length < 3) return setError('Description must be at least 3 characters.');

    const formData = new FormData();
    formData.set('hdnSelectedUserIds', selectedUserIds);
    formData.set('hdnTenderId', config.sessionId || '');
    formData.set('messagetype', 1);
    formData.set('message', description);
    formData.set('moduleId', config.moduleId || '');
    formData.set('upFile', file);

    setSending(true);
    shareDocument(formData)
      .then(() => {
        setDescription('');
        setFile(null);
        setFileLabel('Drop files here or click to browse');
        setFilter('sent');
        loadDocs('sent', 1);
      })
      .catch((err) => setError(err.isServerErrorPage ? 'Server error while sharing document. Please try again.' : 'Failed to share document.'))
      .finally(() => setSending(false));
  };

  
  const handleDownload = (filePath, fileName, e) => {
    if (e) e.preventDefault();
    
    if (!filePath) {
      alert('File path is missing, unable to download.');
      return;
    }

    setDownloading(true);
    
    downloadCollabFile(filePath)
      .then((response) => {
        
        let downloadedFileName = fileName || 'download';
        const contentDisposition = response.headers['content-disposition'];
        if (contentDisposition && contentDisposition.indexOf('filename=') !== -1) {
          downloadedFileName = contentDisposition.split('filename=')[1].replace(/["']/g, '');
        }
        
        
        triggerBlobDownload(response.data, downloadedFileName, contentDisposition);
        setDownloading(false);
      })
      .catch((error) => {
        console.error('Download error:', error);
        
        
        if (error.isServerErrorPage) {
          alert('Server error while downloading. Please try again.');
        } else if (error.response && error.response.data) {
        
          try {
            const reader = new FileReader();
            reader.onload = function() {
              alert(reader.result || 'Unable to download file. Please try again.');
            };
            reader.readAsText(error.response.data);
          } catch (e) {
            alert('Unable to download file. Please try again.');
          }
        } else {
          alert('Unable to download file. Please try again.');
        }
        setDownloading(false);
      });
  };

  return (
    <div>
      <div className="a2z-collab-section-label mt-1">Attach Files</div>
      <div className="a2z-collab-dropzone" onClick={() => document.getElementById('collabUpFileReact').click()}>
        <div className="a2z-collab-dropzone-icon">
          <img src={asset('/resources/img/uploadcloud-icon.svg')} alt="Upload" />
        </div>
        <div className="a2z-collab-dropzone-text">{fileLabel}</div>
        <div className="a2z-collab-dropzone-hint">Supports PDF, DOC, DOCX, XLS, XLSX (Max 5 MB)</div>
        <input id="collabUpFileReact" type="file" style={{ display: 'none' }} accept=".pdf,.doc,.docx,.xls,.xlsx" onChange={onFileChange} />
      </div>

      <div className="a2z-collab-compose-form">
        <div className="form-group">
          <label>
            Description <span className="mand">*</span>
          </label>
          <textarea
            className="form-control tArea"
            rows={4}
            maxLength={500}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Enter here"
          />
          {error && <InlineBanner message={error} />}
        </div>
        <div className="a2z-collab-footernew">
          <input 
            type="button" 
            value={sending ? 'Sharing…' : 'Submit'} 
            className="Button2" 
            onClick={submitShare} 
            disabled={sending} 
          />
        </div>
      </div>

      <div className="a2z-collab-docs-header">
        <div className="a2z-collab-docs-filters">
          <button 
            type="button" 
            className={`a2z-collab-docs-filter${filter === 'received' ? ' active' : ''}`} 
            onClick={() => setFilter('received')}
          >
            Received
          </button>
          <button 
            type="button" 
            className={`a2z-collab-docs-filter${filter === 'sent' ? ' active' : ''}`} 
            onClick={() => setFilter('sent')}
          >
            Sent
          </button>
        </div>
      </div>

      {listError && <InlineBanner message={listError} />}
      <div className="a2z-collab-docs-list">
        {!listError && docs.length === 0 && <div className="a2z-collab-muted">No documents found.</div>}
        {docs.map((item, i) => {
          const iconClass = buildFileIconClass(item.fileName);
          const users = item.senderUserName
            ? [item.senderUserName.trim()]
            : (item.receiverUserNames || '').split('|').map((u) => u.trim()).filter(Boolean);
          const footerLabel = filter === 'sent' ? 'To:' : 'From:';
          const senderFilePath = item.senderFilePath || '';
          const filePath = item.filePath || item.sFilePath || item.senderFilePath || item.sFile_Path || '';
          const sMessageText = item.sMessageText || '';
          const sentTime = formatChatTime(item.dtMessageSend);
          const fileName = item.fileName || item.sFileName || 'download';

          return (
            <div className="a2z-collab-doc-item" key={i}>
              <div className="a2z-collab-doc-main">
                <div className={`a2z-collab-doc-icon ${iconClass}`}>{iconClass.toUpperCase().slice(0, 3)}</div>
                <div className="a2z-collab-doc-info">
                  <div className="a2z-collab-doc-name">{sMessageText}</div>
                  {sentTime && <div className="a2z-collab-doc-time">{sentTime}</div>}
                </div>
                <div className="a2z-collab-doc-actions">
                  <button 
                    type="button" 
                    className="a2z-collab-doc-download" 
                    onClick={(e) => handleDownload(filePath, fileName, e)}
                    disabled={downloading || !filePath}
                    title={!filePath ? 'File path not available' : 'Download file'}
                  >
                    <img src={asset('/resources/img/download-icon-new.svg')} alt="Download" />
                    {downloading && <span className="a2z-collab-download-spinner">...</span>}
                  </button>
                </div>
              </div>
              {users.length > 0 && (
                <div className="a2z-collab-doc-footer">
                  <span className="a2z-collab-doc-sent-to">{footerLabel}</span>
                  <div className="a2z-collab-doc-avatars">{buildAvatarFooter(users)}</div>
                </div>
              )}
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
                href="#"
                onClick={(e) => {
                  e.preventDefault();
                  setPageNo(p);
                  loadDocs(filter, p);
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