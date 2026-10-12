import { createContext, useContext, useMemo, useState, useCallback, useEffect } from 'react';
import { connectSocket, disconnectSocket } from '../api/socket.js';

const CollabContext = createContext(null);
const isInIframe = (() => {
  try {
    return window.self !== window.top;
  } catch {

    return true;
  }
})();

const SESSION_LABELS = {
  agreementId: 'Agreement ID',
  tenderId: 'Tender ID',
  indentId: 'Procurement ID',
  projectId: 'Project ID',
};

export function CollabProvider({ initialConfig, children }) {
  const [config, setConfig] = useState(initialConfig || {});
  const [isOpen, setIsOpen] = useState(Boolean(initialConfig?.autoOpen));
  const [activeTab, setActiveTab] = useState('chat');
  const [selectedUsers, setSelectedUsers] = useState([]);
  const [socketConnected, setSocketConnected] = useState(false);


  useEffect(() => {
    const baseUrl = config.apiBaseUrl;
    if (!baseUrl) return undefined;

    connectSocket({
      baseUrl,
      authToken: config.authToken,
      onConnect: () => setSocketConnected(true),
      onDisconnect: () => setSocketConnected(false),
      onError: () => setSocketConnected(false),
    }).catch(() => setSocketConnected(false));

    return () => {
      disconnectSocket();
      setSocketConnected(false);
    };
  }, [config.apiBaseUrl, config.authToken]);

  const open = useCallback((nextConfig) => {
    if (nextConfig) setConfig((prev) => ({ ...prev, ...nextConfig }));
    setIsOpen(true);
  }, []);
  const close = useCallback(() => {
    setIsOpen(false);
 
    if (isInIframe) window.parent.postMessage({ type: 'collab-close' }, '*');
  }, []);

  const selectedUserIds = useMemo(
    () =>
      selectedUsers
        .map((u) => String(u.id))
        .sort((a, b) => (parseInt(a, 10) || 0) - (parseInt(b, 10) || 0))
        .join(','),
    [selectedUsers]
  );

  const headerText = useMemo(() => {
    const { sessionId, sessionType, sessionLabel } = config;
    if (!sessionId || sessionId === '0' || sessionId === 'null') return null;
    return {
      typeLabel: (SESSION_LABELS[sessionType] || '') + ' :',
      value: `${sessionId}${sessionLabel ? ' - ' + sessionLabel : ''}`,
    };
  }, [config]);

  const asset = useCallback(
    (relPath) => `${config.assetBaseUrl || config.apiBaseUrl || ''}${relPath}`,
    [config.assetBaseUrl, config.apiBaseUrl]
  );

  const value = useMemo(
    () => ({
      config,
      setConfig,
      isOpen,
      open,
      close,
      activeTab,
      setActiveTab,
      selectedUsers,
      setSelectedUsers,
      selectedUserIds,
      headerText,
      asset,
      isInIframe,
      socketConnected,
    }),
    [config, isOpen, open, close, activeTab, selectedUsers, selectedUserIds, headerText, asset, socketConnected]
  );

  return <CollabContext.Provider value={value}>{children}</CollabContext.Provider>;
}

export function useCollab() {
  const ctx = useContext(CollabContext);
  if (!ctx) throw new Error('useCollab must be used within a CollabProvider');
  return ctx;
}
