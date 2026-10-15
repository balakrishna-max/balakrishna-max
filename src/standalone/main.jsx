import React, { useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { APP_BASE_URL, APP_STYLESHEET_PATH, REPORTS_API_URL } from '../config/commonURLConstants.js';
import '../entry.js';
import './standalone.css';

const CONTEXT_PATH = new URL(APP_BASE_URL).pathname.replace(/\/+$/, '');
const API_BASE = window.location.origin + CONTEXT_PATH;
const SETTINGS_KEY = 'a2z.standalone.settings';

const DEFAULTS = {
  orgId: '1',
  webserviceUrl: '',
  token: '',
  userId: '',
  userType: '',
  sessionId: '',
  sessionType: 'tenderId',
  sessionLabel: '',
  moduleId: '',
};

const FIELDS = [
  ['orgId', 'Organisation ID (nOrgID)'],
  ['webserviceUrl', 'Web service URL (departments)'],
  ['token', 'JWT token (localStorage JWT_TOKEN of the application)'],
  ['userId', 'User ID (N_USER_ID)'],
  ['userType', 'User type (N_USER_TYPE)'],
  ['sessionId', 'Collaboration: tender / agreement / project ID'],
  ['sessionType', 'Collaboration: type (tenderId, agreementId, indentId, projectId)'],
  ['sessionLabel', 'Collaboration: label'],
  ['moduleId', 'Collaboration: module ID'],
];

const TABS = [
  { key: 'formBuilder', label: 'Smart Form Builder' },
  { key: 'reports', label: 'MIS Reports' },
];

function readSettings() {
  try {
    return { ...DEFAULTS, ...JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}') };
  } catch {
    return { ...DEFAULTS };
  }
}

function writeSettings(values) {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(values));
    if (values.token) localStorage.setItem('JWT_TOKEN', values.token);
    else localStorage.removeItem('JWT_TOKEN');
  } catch {
    /* storage blocked: the values apply to this page view only */
  }
}

function preparePage(settings) {
  const base = document.createElement('base');
  base.href = `${CONTEXT_PATH}/`;
  document.head.prepend(base);

  const css = document.createElement('link');
  css.rel = 'stylesheet';
  css.href = CONTEXT_PATH + APP_STYLESHEET_PATH;
  document.head.prepend(css);

  window.contextPath = CONTEXT_PATH;
  window.webserviceUrl = settings.webserviceUrl;
  window.N_USER_ID = settings.userId;
  window.N_USER_TYPE = settings.userType;
  if (settings.token) {
    try { localStorage.setItem('JWT_TOKEN', settings.token); } catch { /* storage blocked */ }
  }
}

function componentConfig(name, settings) {
  if (name === 'formBuilder') {
    return {
      standalone: true,
      contextPath: CONTEXT_PATH,
      orgId: settings.orgId,
      webserviceurl: settings.webserviceUrl,
      token: settings.token,
      forms: [],
    };
  }
  return { height: 'calc(100vh - 58px)' };
}

function Panel({ name, active, settings }) {
  const ref = useRef(null);
  const [state, setState] = useState('idle');

  useEffect(() => {
    if (!active || state !== 'idle') return;
    setState('loading');
    window.A2ZReactApps.mount(name, ref.current, componentConfig(name, settings))
      .then(() => setState('ready'))
      .catch((e) => setState('error: ' + (e && e.message ? e.message : e)));
  }, [active, name, settings, state]);

  return (
    <section className="a2zs-panel" hidden={!active}>
      {state.startsWith('error') && <p className="a2zs-error">{state}</p>}
      <div ref={ref} />
    </section>
  );
}

function SettingsDialog({ settings, onClose }) {
  const [values, setValues] = useState(settings);
  const save = (e) => {
    e.preventDefault();
    writeSettings(values);
    window.location.reload();
  };
  return (
    <div className="a2zs-overlay" role="dialog" aria-modal="true" aria-label="Settings">
      <form className="a2zs-dialog" onSubmit={save}>
        <h2>Settings</h2>
        <p className="a2zs-muted">
          Values a JSP page normally provides. Saved in this browser for the standalone page only.
        </p>
        {FIELDS.map(([key, label]) => (
          <label key={key} className="a2zs-field">
            <span>{label}</span>
            <input
              className="form-control"
              value={values[key]}
              onChange={(e) => setValues({ ...values, [key]: e.target.value })}
            />
          </label>
        ))}
        <div className="a2zs-actions">
          <button type="button" className="Button" onClick={onClose}>Cancel</button>
          <button type="submit" className="Button">Save and reload</button>
        </div>
      </form>
    </div>
  );
}

function Shell({ settings }) {
  const [tab, setTab] = useState(() => {
    if (window.location.pathname.startsWith('/mis-reports') ||
        window.location.pathname.startsWith('/dashboard')) return 'reports';
    const fromHash = window.location.hash.replace('#', '');
    return TABS.some((t) => t.key === fromHash) ? fromHash : TABS[0].key;
  });
  const [showSettings, setShowSettings] = useState(false);

  useEffect(() => {
    const syncTabWithLocation = () => {
      if (window.location.pathname.startsWith('/mis-reports') ||
          window.location.pathname.startsWith('/dashboard')) {
        setTab('reports');
        return;
      }

      const fromHash = window.location.hash.replace('#', '');
      setTab(TABS.some((t) => t.key === fromHash) ? fromHash : TABS[0].key);
    };

    window.addEventListener('popstate', syncTabWithLocation);
    return () => window.removeEventListener('popstate', syncTabWithLocation);
  }, []);

  const select = (key) => {
    setTab(key);
    const nextUrl = key === 'reports' ? '/mis-reports' : '/#formBuilder';
    if (`${window.location.pathname}${window.location.search}${window.location.hash}` !== nextUrl) {
      window.history.pushState(null, '', nextUrl);
      window.dispatchEvent(new PopStateEvent('popstate'));
    }
  };

  const openCollab = () => {
    window.A2ZReactApps.open('collab', {
      sessionId: settings.sessionId,
      sessionType: settings.sessionType || 'tenderId',
      sessionLabel: settings.sessionLabel,
      moduleId: settings.moduleId,
      userId: settings.userId,
      userType: settings.userType,
      deptId: '',
      apiBaseUrl: API_BASE,
      assetBaseUrl: API_BASE,
    });
  };

  return (
    <>
      <header className="a2zs-bar">
        <strong className="a2zs-title">A2Z React Apps</strong>
        <nav className="a2zs-tabs" role="tablist">
          {TABS.map((t) => (
            <button
              key={t.key}
              type="button"
              role="tab"
              aria-selected={tab === t.key}
              className={`a2zs-tab${tab === t.key ? ' is-active' : ''}`}
              onClick={() => select(t.key)}
            >
              {t.label}
            </button>
          ))}
          <button type="button" className="a2zs-tab" onClick={openCollab}>Collaboration</button>
        </nav>
       
        <button type="button" className="a2zs-tab" onClick={() => setShowSettings(true)}>Settings</button>
      </header>

      {TABS.map((t) => (
        <Panel key={t.key} name={t.key} active={tab === t.key} settings={settings} />
      ))}

      {showSettings && <SettingsDialog settings={settings} onClose={() => setShowSettings(false)} />}
    </>
  );
}

const settings = readSettings();
preparePage(settings);
createRoot(document.getElementById('a2z-standalone')).render(<Shell settings={settings} />);
