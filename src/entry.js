/*
 * The one entry module that loader.js loads (only when a component is first needed).
 * It contains no component code: each component is a separate chunk, imported the first
 * time it is mounted/opened. React itself is shared between them (one copy).
 *
 * To add another component: create src/apps/<name>/index.jsx exporting mount()/open()/close()
 * and register it below.
 */
const COMPONENTS = {
  formBuilder: () => import('./apps/form-builder/index.jsx'),
  collab: () => import('./apps/collab/index.jsx'),
  reports: () => import('./apps/reports/index.jsx'),
};

const loaded = {};

function load(name) {
  if (!COMPONENTS[name]) return Promise.reject(new Error(`Unknown component "${name}". Known: ${Object.keys(COMPONENTS).join(', ')}`));
  if (!loaded[name]) {
    loaded[name] = COMPONENTS[name]().catch((e) => {
      delete loaded[name]; // a failed download can be retried
      throw e;
    });
  }
  return loaded[name];
}

function call(name, method, ...args) {
  return load(name).then((m) => {
    if (typeof m[method] !== 'function') throw new Error(`Component "${name}" has no ${method}()`);
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
