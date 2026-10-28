
const COMPONENTS = {
  formBuilder: () => import('./apps/form-builder/index.jsx'),
  collab: () => import('./apps/collab/index.jsx'),
  reports: () => import('./apps/reports/index.jsx'),
  grievance: () => import('./apps/grievance/index.jsx'),
};

const loaded = {};

function load(name) {
  if (!COMPONENTS[name]) {
    return Promise.reject(
      new Error(
        `Unknown component "${name}". Known: ${Object.keys(COMPONENTS).join(', ')}`
      )
    );
  }

  if (!loaded[name]) {
    loaded[name] = COMPONENTS[name]().catch((e) => {
      delete loaded[name];
      throw e;
    });
  }

  return loaded[name];
}

function call(name, method, ...args) {
  return load(name).then((m) => {
    if (typeof m[method] !== 'function') {
      throw new Error(`Component "${name}" has no ${method}()`);
    }

    return m[method](...args);
  });
}

window.A2ZReactApps = {
  components: Object.keys(COMPONENTS),
  preload: (name) => load(name).then(() => undefined),
  mount: (name, el, config) => call(name, 'mount', el, config),
  open: (name, config) => call(name, 'open', config),
  close: (name) => (loaded[name] ? call(name, 'close') : Promise.resolve()),
};

