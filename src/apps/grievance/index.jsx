import React from 'react';
import { createRoot } from 'react-dom/client';

import App from './App.jsx';
import './index.css';

/*
 * Grievance (helpdesk) component of A2Z React Apps.
 *
 * Loaded by the A2Z loader from a JSP:
 *
 *   A2ZReact.mount('grievance', document.getElementById('grievance-react-root'), {
 *     page: 'ADMIN_DASHBOARD',          // or USER_DASHBOARD, DEPT_GRIEVANCE, DEPT_DASHBOARD, TICKET_RAISE
 *     userID, userType, orgId, token, apiUrl, contextPath, currentDate, ...
 *   });
 *
 * The configuration object is the same one the standalone grievance-react
 * project received, so the JSP parameters do not change.
 */

const mountedRoots = new WeakMap();

function readStorageToken() {
  try {
    return (
      localStorage.getItem('JWT_TOKEN') ||
      sessionStorage.getItem('JWT_TOKEN') ||
      ''
    );
  } catch (e) {
    return '';
  }
}

/**
 * The JSP passes token as a string that may be 'null' or empty.
 * Fall back to the JWT the application stores in the browser.
 */
function resolveConfig(config) {
  const resolved = { ...config };

  if (!resolved.token || resolved.token === 'null') {
    const fallback = readStorageToken();
    if (fallback) {
      resolved.token = fallback;
    } else {
      console.warn('[Grievance] No token found in config or storage');
    }
  }

  // Read by the axios client (base URL + bearer token) and by CallbackRequest.
  window.GRIEVANCE_CONFIG = resolved;
  return resolved;
}

export function mount(element, config = {}) {
  if (!element) {
    throw new Error('Grievance mount element is required.');
  }

  const resolved = resolveConfig(config);
  const existingRoot = mountedRoots.get(element);

  if (existingRoot) {
    existingRoot.render(
      <React.StrictMode>
        <App config={resolved} />
      </React.StrictMode>
    );
    return existingRoot;
  }

  element.innerHTML = '';

  const root = createRoot(element);
  mountedRoots.set(element, root);
  root.render(
    <React.StrictMode>
      <App config={resolved} />
    </React.StrictMode>
  );

  return root;
}

export function close(element) {
  if (!element) {
    return;
  }

  const root = mountedRoots.get(element);

  if (root) {
    root.unmount();
    mountedRoots.delete(element);
  }
}

export function open(config = {}) {
  if (!config.element) {
    throw new Error(
      'Provide an element when opening the grievance application.'
    );
  }

  return mount(config.element, config);
}
