
(function () {
  if (window.A2ZReact) return;

  var BUILD = __A2Z_BUILD__;
  var me = document.currentScript;
  var attr = function (n) { return me ? me.getAttribute(n) : null; };
  var nonce = (me && (me.nonce || attr('nonce'))) || '';
  var appUrl = (attr('data-app-url') || attr('data-dfb-app-url') || attr('data-collab-app-url') ||
    (me ? me.src.replace(/\/[^\/]*$/, '') : '')).replace(/\/+$/, '');
  var COLLAB_TRIGGER = attr('data-collab-trigger') || '#collaborationSlideId a';
  var COLLAB_BADGE = attr('data-collab-badge') || '#collabUnreadCount';
  var ROOTS = {
    formBuilder: attr('data-form-root') || 'dynamic-form-react-root',
    reports: attr('data-reports-root') || 'a2z-reports-root',
  };
  var PRELOAD = attr('data-preload') || 'idle';
  var BADGE_POLL_MS = 30000;

  var entry = { status: 'idle', promise: null };
  var warmed = {};

  function add(tag, attrs, text) {
    var el = document.createElement(tag);
    for (var k in attrs) if (attrs[k] != null) el.setAttribute(k, attrs[k]);
    if (nonce) { el.setAttribute('nonce', nonce); el.nonce = nonce; }
    if (text) el.textContent = text;
    return el;
  }

  function loadScript(src, type) {
    return new Promise(function (resolve, reject) {
      var s = add('script', { src: src, type: type || null, crossorigin: type === 'module' ? '' : null });
      s.onload = resolve;
      s.onerror = function () { reject(new Error('Could not load ' + src)); };
      document.head.appendChild(s);
    });
  }

  function loadStyle(href) {
    return new Promise(function (resolve, reject) {
      var l = add('link', { rel: 'stylesheet', href: href });
      l.onload = resolve;
      l.onerror = function () { reject(new Error('Could not load ' + href)); };
      document.head.appendChild(l);
    });
  }

  function log(level, msg, extra) {
    if (window.console && console[level]) console[level]('[A2ZReact] ' + msg, extra === undefined ? '' : extra);
  }

  function warm(name) {
    if (BUILD.mode !== 'prod' || warmed[name]) return;
    warmed[name] = true;
    var files = (BUILD.components && BUILD.components[name]) || { js: [], css: [] };
    var hint = function (rel, href, as) {
      if (document.querySelector('link[href="' + href + '"]')) return;
      document.head.appendChild(add('link', { rel: rel, href: href, as: as || null, crossorigin: '' }));
    };
    hint('modulepreload', appUrl + '/' + BUILD.entry);
    files.js.forEach(function (f) { hint('modulepreload', appUrl + '/' + f); });
    files.css.forEach(function (f) { hint('preload', appUrl + '/' + f, 'style'); });
  }


  function ensureNonceMeta() {
    if (nonce && !document.querySelector('meta[property="csp-nonce"]')) {
      document.head.appendChild(add('meta', { property: 'csp-nonce' }));
    }
  }

  function loadDev() {

    document.head.appendChild(add('script', { type: 'module' },
      'import RefreshRuntime from "' + appUrl + '/@react-refresh";' +
      'RefreshRuntime.injectIntoGlobalHook(window);' +
      'window.$RefreshReg$ = () => {};' +
      'window.$RefreshSig$ = () => (type) => type;' +
      'window.__vite_plugin_react_preamble_installed__ = true;'));
    return loadScript(appUrl + '/@vite/client', 'module')
      .then(function () { return loadScript(appUrl + '/src/entry.js', 'module'); });
  }

  function ensureAppCss() {
    var href = attr('data-dfb-app-css');
    if (!href) return Promise.resolve();
    var abs = new URL(href, document.baseURI).href;
    var links = document.querySelectorAll('link[rel="stylesheet"]');
    for (var i = 0; i < links.length; i++) if (links[i].href === abs) return Promise.resolve();
    return loadStyle(abs)['catch'](function (e) { log('warn', e.message); });
  }


  function loadEntry() {
    if (entry.promise) return entry.promise;
    entry.status = 'loading';
    ensureNonceMeta();
    entry.promise = (BUILD.mode === 'dev' ? loadDev() : loadScript(appUrl + '/' + BUILD.entry, 'module'))
      .then(function () {
        if (!window.A2ZReactApps) throw new Error('Entry loaded but A2ZReactApps is missing');
        entry.status = 'loaded';
        return window.A2ZReactApps;
      })['catch'](function (e) {
        entry.status = 'failed';
        entry.promise = null;
        throw e;
      });
    return entry.promise;
  }

  function call(fn) {
    return loadEntry().then(fn)['catch'](function (e) { log('error', e && e.message ? e.message : e, e); throw e; });
  }

  function preload(name) {
    warm(name);
    return call(function (apps) { return apps.preload(name); });
  }

  

  var NAMES = { formBuilder: 'Smart Form Builder', reports: 'Reports' };

  function rootOf(name, el) {
    if (el && el.nodeType === 1) return el;
    if (typeof el === 'string') return document.getElementById(el.replace(/^#/, ''));
    return ROOTS[name] ? document.getElementById(ROOTS[name]) : null;
  }

  function showError(name, root, err) {
    if (root && !root.hasChildNodes()) {
      var p = document.createElement('p');
      p.style.color = '#b3261e';
      p.style.padding = '16px';
      p.textContent = (NAMES[name] || name) + ' could not be loaded. ' + (err && err.message ? err.message : '');
      root.appendChild(p);
    }
  }

  function mountComponent(name, el, config) {
    var root = rootOf(name, el);
    if (!root) return Promise.reject(new Error('Element for "' + name + '" not found'));
    warm(name);
    var before = name === 'formBuilder' ? ensureAppCss() : Promise.resolve();
    return before
      .then(function () { return call(function (apps) { return apps.mount(name, root, config); }); })
      ['catch'](function (e) { showError(name, root, e); throw e; });
  }


  function readCollabContext() {
    var fn = function (n) { return typeof window[n] === 'function' ? window[n]() : ''; };
    var base = window.location.origin + (window.contextPath || window.CONTEXT_PATH || '');
    return {
      sessionId: fn('getCollaborationId') || '',
      sessionType: fn('getCollaborationContext') || 'tenderId',
      sessionLabel: fn('getCollaborationLabel') || '',
      moduleId: fn('getActiveModule') || '',
      userId: window.N_USER_ID || '',
      userType: window.N_USER_TYPE || '',
      deptId: window.COLLAB_DEPT_ID || '',
      apiBaseUrl: base,
      assetBaseUrl: base,
    };
  }

  function openCollab(config) {
    var ctx = readCollabContext();
    if (config) for (var k in config) if (config[k] !== undefined && config[k] !== null && config[k] !== '') ctx[k] = config[k];
    warm('collab');
    return call(function (apps) { return apps.open('collab', ctx); });
  }

  function refreshCollabBadge() {
    var badgeEl = document.querySelector(COLLAB_BADGE);
    if (!badgeEl) return;
    var url = readCollabContext().apiBaseUrl.replace(/\/+$/, '') + '/getRecvdCount.html';
    fetch(url, { credentials: 'include' })
      .then(function (res) {
        var type = res.headers.get('content-type') || '';
        if (type.indexOf('application/json') === -1) throw new Error('Non-JSON response (not logged in, or wrong URL): ' + url);
        return res.json();
      })
      .then(function (data) {
        var total = (Number(data.chatsRecievedCount) || 0) + (Number(data.recievedDocCount) || 0) +
          (Number(data.meetingInvRecievedCount) || 0) + (Number(data.recievedemailAndSmsCount) || 0);
        badgeEl.textContent = total > 0 ? total : '';
      })['catch'](function (err) { log('warn', 'Unable to refresh unread badge: ' + err.message); });
  }

  function triggerOf(target) {
    if (!COLLAB_TRIGGER || COLLAB_TRIGGER === 'none' || !target || !target.closest) return null;
    return target.closest(COLLAB_TRIGGER);
  }

  function onTriggerClick(e) {
    e.preventDefault();
    e.stopPropagation();
    openCollab()['catch'](function () {});
  }

  function attachCollabTrigger() {
    if (!COLLAB_TRIGGER || COLLAB_TRIGGER === 'none') return [];
    var found = document.querySelectorAll(COLLAB_TRIGGER);
    for (var i = 0; i < found.length; i++) {
      if (found[i].getAttribute('data-a2z-collab-bound')) continue;
      found[i].setAttribute('data-a2z-collab-bound', '1');
      found[i].addEventListener('click', onTriggerClick);
    }
    return found;
  }

  // Triggers rendered later (ajax / tabs): catch the click on the document instead
  document.addEventListener('click', function (e) {
    var t = triggerOf(e.target);
    if (t && !t.getAttribute('data-a2z-collab-bound')) onTriggerClick(e);
  });

  function onIntent(e) {
    if (PRELOAD !== 'none' && triggerOf(e.target)) preload('collab')['catch'](function () {});
  }
  document.addEventListener('pointerover', onIntent, { passive: true });
  document.addEventListener('focusin', onIntent);
  document.addEventListener('touchstart', onIntent, { passive: true });


  window.addEventListener('message', function (event) {
    var d = event && event.data;
    if (!d || event.origin !== window.location.origin) return;
    if (d.type === 'collab-counts-updated') refreshCollabBadge();
  });



  function mount(name, el, config) {
    if (name === 'collab') return openCollab(config);
    return mountComponent(name, el, config);
  }

  function open(name, config) {
    if (name === 'collab') return openCollab(config);
    if (ROOTS[name]) return mountComponent(name, null, config);
    return call(function (apps) { return apps.open(name, config); });
  }

  window.A2ZReact = {
    mount: mount,
    open: open,
    close: function (name) {
      return entry.status === 'loaded' ? window.A2ZReactApps.close(name) : Promise.resolve();
    },
    preload: preload,
    refreshCollabBadge: refreshCollabBadge,
    get status() { return entry.status; },
    appUrl: appUrl,
    mode: BUILD.mode,
  };

  if (!window.DynamicFormLoader) {
    window.DynamicFormLoader = {
      load: function () { return mountComponent('formBuilder'); },
      open: function () { return mountComponent('formBuilder'); },
      get status() { return entry.status; },
      appUrl: appUrl,
      mode: BUILD.mode,
    };
  }
  if (!window.CollabApp) {
    window.CollabApp = {
      open: function (config) { return openCollab(config); },
      close: function () { return window.A2ZReact.close('collab'); },
    };
  }



  function whenIdle(fn) {
    var run = function () {
      if (window.requestIdleCallback) window.requestIdleCallback(fn, { timeout: 4000 });
      else setTimeout(fn, 1200);
    };
    if (document.readyState === 'complete') run();
    else window.addEventListener('load', run);
  }

  if (attr('data-autoload') !== 'false') {
    for (var n in ROOTS) if (document.getElementById(ROOTS[n])) warm(n);
  }

  function start() {
    var triggers = attachCollabTrigger();
    if (document.querySelector(COLLAB_BADGE)) {
      refreshCollabBadge();
      setInterval(refreshCollabBadge, BADGE_POLL_MS);
    }
    if (attr('data-autoload') !== 'false') {
      for (var name in ROOTS) {
        if (rootOf(name)) mountComponent(name)['catch'](function () {});
      }
    }

    if (PRELOAD === 'idle' && triggers.length) whenIdle(function () { preload('collab')['catch'](function () {}); });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
})();
