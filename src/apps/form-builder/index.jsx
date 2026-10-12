import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { configureApi } from './api/dynamicFormApi';
import { configureNavigation } from './api/navigation';
import './styles/dfb.css';


function readFormsFromDom(id) {
  const host = document.getElementById(id);
  if (!host) return [];
  return Array.from(host.querySelectorAll('[data-form-id]')).map((el) => ({
    id: el.dataset.formId || '',
    name: el.dataset.formName || '',
    modified: el.dataset.modified || '',
    mode: el.dataset.formMode || '0',
  }));
}

const roots = new WeakMap();

export function mount(el, extraConfig) {
  el = el || document.getElementById('dynamic-form-react-root');
  if (!el) throw new Error('Form builder root element not found');
  if (roots.has(el) || el.dataset.mounted) return; // already mounted
  el.dataset.mounted = '1';
  el.textContent = ''; 
  const d = el.dataset;
  const fromServer = {};
  const put = (k, v) => { if (v !== undefined && String(v).trim() !== '') fromServer[k] = String(v).trim(); };
  put('contextPath', d.contextPath);
  put('orgId', d.orgId);
  put('webserviceurl', d.webserviceurl);

  const config = { ...(window.dynamicFormConfig || {}), ...fromServer, ...(extraConfig || {}) };
  if (!config.forms) config.forms = readFormsFromDom('dynamic-form-list-data');
  configureApi(config);
  configureNavigation(config);

  const root = createRoot(el);
  roots.set(el, root);
  root.render(<App config={config} />);
}

export function open(config) {
  return mount(null, config);
}

export function unmount(el) {
  el = el || document.getElementById('dynamic-form-react-root');
  const root = el && roots.get(el);
  if (!root) return;
  root.unmount();
  roots.delete(el);
  delete el.dataset.mounted;
}

export const close = unmount;
