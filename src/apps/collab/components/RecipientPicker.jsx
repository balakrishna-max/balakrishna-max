import { useEffect, useRef, useState } from 'react';
import { useCollab } from '../context/CollabContext.jsx';
import { getSubUsers, getUsersByDepartment } from '../api/client.js';
import { getAvatarColor, getInitials } from '../utils/collabHelpers.js';

export default function RecipientPicker() {
  const { config, selectedUsers, setSelectedUsers } = useCollab();
  const [allUsers, setAllUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const wrapRef = useRef(null);

  useEffect(() => {
    if (!config.userId) {
      setLoadError('No user ID configured — recipients cannot be loaded.');
      return;
    }

    setLoading(true);
    setLoadError('');

    const mapDeptResponse = (data) =>
      (Array.isArray(data) ? data : []).map((item) => ({
        id: item.userID,
        label: item.userName,
        avatar: item.profilePic || item.avatar || null,
      }));

    const mapSubUserResponse = (data) =>
      (data?.data || []).map((item) => ({
        id: item.nUserID,
        label: item.supplierUserName,
        avatar: item.profilePic || null,
      }));

    const isDeptUser = config.userType === '103';
    const primary = isDeptUser
      ? getUsersByDepartment(config.deptId).then((r) => mapDeptResponse(r.data))
      : getSubUsers(config.userId).then((r) => mapSubUserResponse(r.data));

    primary
      .then((list) => {
        if (list.length > 0) {
          setAllUsers(list);
          return;
        }
        
        const fallback = isDeptUser
          ? getSubUsers(config.userId).then((r) => mapSubUserResponse(r.data))
          : getUsersByDepartment(config.deptId).then((r) => mapDeptResponse(r.data));
        return fallback.then((list2) => setAllUsers(list2));
      })
      .catch((err) => {
        console.error('Error fetching recipient list', err);
        setLoadError('Unable to load recipients right now.');
      })
      .finally(() => setLoading(false));
  }, [config.userId, config.deptId, config.userType]);

  useEffect(() => {
    function onClickOutside(e) {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, []);

  const selectedIds = new Set(selectedUsers.map((u) => String(u.id)));
  const filtered = allUsers.filter(
    (u) => !selectedIds.has(String(u.id)) && (u.label || '').toLowerCase().includes(query.toLowerCase())
  );

  const addUser = (u) => {
    setSelectedUsers((prev) => [...prev, u]);
    setQuery('');
    setOpen(false);
  };
  const removeUser = (id) => {
    setSelectedUsers((prev) => prev.filter((u) => String(u.id) !== String(id)));
  };

  return (
    <div className="a2z-collab-token-wrap" ref={wrapRef}>
      <div className="a2z-collab-token-field">
        <i className="a2z-collab-token-search-icon">🔍</i>
        <div className="a2z-collab-token-inner">
          {selectedUsers.map((u) => {
            const c = getAvatarColor(u.label);
            return (
              <span className="a2z-collab-chip" key={u.id}>
                <span className="a2z-collab-chip-av" style={{ background: c.bg, color: c.color }}>
                  {getInitials(u.label)}
                </span>
                <span className="a2z-collab-chip-label">{u.label}</span>
                <button type="button" className="a2z-collab-chip-x" onClick={(e) => { e.preventDefault(); removeUser(u.id); }}>
                  &times;
                </button>
              </span>
            );
          })}
          <input
            className="a2z-collab-token-input"
            placeholder={
              loading
                ? 'Loading recipients…'
                : selectedUsers.length
                ? ''
                : allUsers.length
                ? 'Search collaborators…'
                : 'No recipients found'
            }
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setOpen(true);
            }}
            onFocus={() => setOpen(true)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                e.stopPropagation();
                if (filtered[0]) addUser(filtered[0]);
              }
            }}
          />
        </div>
      </div>
      {loadError && <div className="a2z-collab-form-error">{loadError}</div>}
      <div className={`a2z-collab-suggest-box${open && filtered.length ? ' open' : ''}`}>
        {filtered.slice(0, 30).map((u) => {
          const c = getAvatarColor(u.label);
          return (
            <div className="a2z-collab-suggest-item" key={u.id} onClick={() => addUser(u)}>
              <span className="a2z-collab-suggest-av-text" style={{ background: c.bg, color: c.color }}>
                {getInitials(u.label)}
              </span>
              <span className="a2z-collab-suggest-name">{u.label}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
