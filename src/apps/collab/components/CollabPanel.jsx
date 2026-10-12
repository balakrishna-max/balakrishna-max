import { useEffect, useState, useCallback } from 'react';
import { useCollab } from '../context/CollabContext.jsx';
import { getTabUnreadCounts } from '../api/client.js';
import RecipientPicker from './RecipientPicker.jsx';
import InlineBanner from './InlineBanner.jsx';
import ChatTab from './tabs/ChatTab.jsx';
import ShareTab from './tabs/ShareTab.jsx';
import MeetingTab from './tabs/MeetingTab.jsx';
import EmailTab from './tabs/EmailTab.jsx';

const TABS = [
  { key: 'chat', label: 'Chat', countKey: 'chatsRecievedCount', icon: '/resources/img/collaboraton-chat-new.svg' },
  { key: 'share', label: 'Share', countKey: 'recievedDocCount', icon: '/resources/img/collaboraton-sharedDocument.svg' },
  { key: 'meeting', label: 'Meeting', countKey: 'meetingInvRecievedCount', icon: '/resources/img/collaboraton-meeting-Inviation.svg' },
  { key: 'email', label: 'Email', countKey: 'recievedemailAndSmsCount', icon: '/resources/img/collaboraton-email-sms.svg' },
];

export default function CollabPanel() {
  const { isOpen, close, activeTab, setActiveTab, headerText, asset, config, isInIframe } = useCollab();
  const [counts, setCounts] = useState({});

  const refreshCounts = useCallback(async () => {
    try {
      const { data } = await getTabUnreadCounts();
      setCounts(data || {});
      if (isInIframe) window.parent.postMessage({ type: 'collab-counts-updated' }, '*');
      else window.postMessage({ type: 'collab-counts-updated' }, window.location.origin);
    } catch {
      console.log('Unable to load collaboration unread tab counts');
    }
  }, [isInIframe]);

  useEffect(() => {
    if (isOpen) refreshCounts();
  }, [isOpen, refreshCounts]);

  const selectTab = (key) => {
    setActiveTab(key);
    setCounts((prev) => ({ ...prev, [TABS.find((t) => t.key === key)?.countKey]: 0 }));
  };

  const hasSessionId = config.sessionId && config.sessionId !== '0' && config.sessionId !== 'null';

  const offcanvasStyle = isInIframe
    ? { position: 'static', right: 0, width: '100%', height: '100vh', boxShadow: 'none', display: 'flex' }
    : undefined;

  return (
    <>
      {!isInIframe && isOpen && <div className="a2z-collab-backdrop" onClick={close} />}
      <div
        className={`a2z-collab-offcanvas${isOpen ? ' show' : ''}`}
        style={offcanvasStyle}
        role="dialog"
        aria-label="Collaboration"
       
        onClick={(e) => e.stopPropagation()}
      >
        <div className="a2z-collab-header">
          <div className="a2z-collab-header-left">
            <div className="a2z-collab-icon-wrap">
              <img src={asset('/resources/img/Collaboration-icon.svg')} alt="Collaboration" />
            </div>
            <div>
              <div className="a2z-collab-title">Collaboration</div>
              {headerText && (
                <div className="a2z-collab-subtitle-wrap">
                  <span className="a2z-collab-subtitle">{headerText.typeLabel}</span>
                  <span className="a2z-collab-subtitle">{headerText.value}</span>
                </div>
              )}
            </div>
          </div>
          <div className="a2z-collab-header-actions">
            <button type="button" className="a2z-collab-close-btn" onClick={close} aria-label="Close">
              <img src={asset('/resources/img/cancel-icon-new.svg')} alt="Close" />
            </button>
          </div>
        </div>


        <RecipientPicker />

        <div className="a2z-collab-tab-nav">
          {TABS.map((tab) => (
            <button
              key={tab.key}
              type="button"
              className={`a2z-collab-tab${activeTab === tab.key ? ' active' : ''}`}
              onClick={() => selectTab(tab.key)}
              data-a2z-collab-tab={tab.key}
            >
              <span className="a2z-collab-tab-icon-wrap">
                <img src={asset(tab.icon)} alt={tab.label} />
                {Boolean(counts[tab.countKey]) && (
                  <span className="a2z-collab-tab-badge">{counts[tab.countKey]}</span>
                )}
              </span>
              <span>{tab.label}</span>
            </button>
          ))}
        </div>

        <div className="a2z-collab-body">
          <div className={`a2z-collab-panel${activeTab === 'chat' ? ' active' : ''}`}>
            <ChatTab onAfterAction={refreshCounts} />
          </div>
          <div className={`a2z-collab-panel${activeTab === 'share' ? ' active' : ''}`}>
            <ShareTab onAfterAction={refreshCounts} />
          </div>
          <div className={`a2z-collab-panel${activeTab === 'meeting' ? ' active' : ''}`}>
            <MeetingTab onAfterAction={refreshCounts} />
          </div>
          <div className={`a2z-collab-panel${activeTab === 'email' ? ' active' : ''}`}>
            <EmailTab onAfterAction={refreshCounts} />
          </div>
        </div>
      </div>
    </>
  );
}
