import React from 'react';
import { createRoot } from 'react-dom/client';
import { CollabProvider, useCollab } from './context/CollabContext.jsx';
import CollabPanel from './components/CollabPanel.jsx';
import { setApiBaseUrl, setAuthToken } from './api/client.js';
import './styles/collab.css';



let root = null;
let handle = null;
const waiting = [];

function Bridge() {
  const collab = useCollab();
  React.useEffect(() => {
    handle = collab;
    while (waiting.length) waiting.shift()(collab);
  }, [collab]);
  return <CollabPanel />;
}

function ensureMounted() {
  if (root) return;
  let el = document.getElementById('collab-widget-root');
  if (!el) {
    el = document.createElement('div');
    el.id = 'collab-widget-root';
    document.body.appendChild(el);
  }
  root = createRoot(el);
  root.render(
    <CollabProvider initialConfig={{}}>
      <Bridge />
    </CollabProvider>
  );
}

const ready = () => (handle ? Promise.resolve(handle) : new Promise((resolve) => waiting.push(resolve)));

export function open(config = {}) {
  ensureMounted();
  if (config.apiBaseUrl) setApiBaseUrl(config.apiBaseUrl);
  if (config.authToken) setAuthToken(config.authToken);

  const hasSessionId = config.sessionId && config.sessionId !== '0' && config.sessionId !== 'null';
  if (!hasSessionId) {
    console.warn('[Collaboration] No sessionId: the loader reads it from window.getCollaborationId().');
  }

  return ready().then((h) => h.open(config));
}

export function close() {
  if (handle) handle.close();
}


export function mount(_el, config) {
  return open(config);
}
