import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import fs from 'node:fs';
import path from 'node:path';
import { APP_BASE_URL, DEV_SERVER_PORT, DEV_SERVER_URL } from './src/config/commonURLConstants.js';

const appUrl = new URL(APP_BASE_URL);
const appContextPath = appUrl.pathname.replace(/\/+$/, '');
const appProxy = appContextPath
  ? { [appContextPath]: { target: appUrl.origin, changeOrigin: true, ws: true } }
  : {};

const COMPONENT_CHUNKS = { formBuilder: 'form-builder', collab: 'collab', reports: 'reports' };

const loaderSource = (build) =>
  fs.readFileSync(path.resolve('loader/loader.template.js'), 'utf8')
    .replace('var BUILD = __A2Z_BUILD__;', 'var BUILD = ' + JSON.stringify(build) + ';');

const toAsciiJs = (s) => s.replace(/[^\x00-\x7f]/g, (c) => '\\u' + c.charCodeAt(0).toString(16).padStart(4, '0'));
const toAsciiCss = (s) => s.replace(/[^\x00-\x7f]/g, (c) => '\\' + c.codePointAt(0).toString(16) + ' ');

function chunkFor(id) {
  const n = id.split(path.sep).join('/');
  if (/\/node_modules\/(react|react-dom|scheduler)\//.test(n)) return 'react';
  if (n.includes('/src/config/')) return 'config';
  if (n.includes('/src/apps/form-builder/') || /\/node_modules\/sweetalert2\//.test(n)) return 'form-builder';
  if (n.includes('/src/apps/collab/') ||
      /\/node_modules\/(axios|@stomp|sockjs-client|flatpickr|react-flatpickr)\//.test(n)) return 'collab';
  if (/\/node_modules\/(echarts|zrender|papaparse|tslib)\//.test(n)) return 'reports-vendor';
  if (n.includes('/src/apps/reports/')) return 'reports';
  return undefined;
}

const REPORTS_REM_PX = 13;
const reportsRemToPx = {
  postcssPlugin: 'a2z-reports-rem',
  Once(root, { result }) {
    const from = String((result.opts && result.opts.from) || '').split(path.sep).join('/');
    if (!from.includes('/src/apps/reports/')) return;
    root.walkDecls((decl) => {
      if (!/rem\b/.test(decl.value)) return;
      decl.value = decl.value.replace(/(-?\d*\.?\d+)rem\b/g, (m, n) => `${+(parseFloat(n) * REPORTS_REM_PX).toFixed(3)}px`);
    });
  },
};

function a2zLoader() {
  let outDir;
  let entryFile;
  let components = {};
  return {
    name: 'a2z-loader',
    configResolved(c) { outDir = path.resolve(c.root, c.build.outDir); },
    configureServer(server) {
      server.middlewares.use('/loader.js', (req, res) => {
        res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
        res.setHeader('Cache-Control', 'no-store');
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.end(loaderSource({ mode: 'dev' }));
      });
    },
    generateBundle(_opts, bundle) {
      const entry = Object.values(bundle).find((f) => f.type === 'chunk' && f.isEntry);
      entryFile = entry && entry.fileName;

      const files = (fileName, seen = new Set()) => {
        const c = bundle[fileName];
        if (!c || c.type !== 'chunk' || seen.has(fileName)) return seen;
        seen.add(fileName);
        c.imports.forEach((f) => files(f, seen));
        return seen;
      };
      components = {};
      Object.entries(COMPONENT_CHUNKS).forEach(([name, chunkName]) => {
        const chunk = Object.values(bundle).find((f) => f.type === 'chunk' && f.name === chunkName && entry.dynamicImports.includes(f.fileName));
        if (!chunk) return;
        const js = [...files(chunk.fileName)];
        const css = js.flatMap((f) => [...((bundle[f].viteMetadata && bundle[f].viteMetadata.importedCss) || [])]);
        components[name] = { js, css };
      });
    },
    writeBundle() {
      if (!entryFile) throw new Error('a2z-loader: entry chunk not found');
      const walk = (dir) => fs.readdirSync(dir, { withFileTypes: true })
        .flatMap((d) => (d.isDirectory() ? walk(path.join(dir, d.name)) : [path.join(dir, d.name)]));
      for (const file of walk(outDir)) {
        if (file.endsWith('.js')) fs.writeFileSync(file, toAsciiJs(fs.readFileSync(file, 'utf8')));
        else if (file.endsWith('.css')) fs.writeFileSync(file, toAsciiCss(fs.readFileSync(file, 'utf8')));
      }
      fs.writeFileSync(path.join(outDir, 'loader.js'), loaderSource({ mode: 'prod', entry: entryFile, components }));
    },
  };
}

export default defineConfig(({ command }) => ({

  base: command === 'build' ? './' : '/',

  plugins: [react(), a2zLoader()],

  define: { global: 'globalThis' },
  css: { postcss: { plugins: [reportsRemToPx] } },
  optimizeDeps: {
    esbuildOptions: { define: { global: 'globalThis' } },

    entries: ['index.html', 'src/entry.js', 'src/apps/*/index.jsx'],
    include: [
      'react', 'react-dom', 'react-dom/client', 'react/jsx-runtime', 'react/jsx-dev-runtime',
      'axios', '@stomp/stompjs', 'sockjs-client', 'flatpickr', 'react-flatpickr', 'sweetalert2',
      'echarts/core', 'echarts/charts', 'echarts/components', 'echarts/features', 'echarts/renderers', 'papaparse',
    ],
  },
  server: {

    warmup: { clientFiles: ['./src/standalone/main.jsx', './src/entry.js', './src/apps/*/index.jsx', './src/apps/**/*.{js,jsx}'] },
    port: DEV_SERVER_PORT,
    proxy: appProxy,
    strictPort: true,
    cors: true,

    origin: DEV_SERVER_URL,
  },
  preview: { port: DEV_SERVER_PORT, strictPort: true, cors: true },
  build: {
    outDir: process.env.OUT_DIR || 'dist',
    emptyOutDir: true,
    target: 'es2020',

    modulePreload: { polyfill: false },
    cssCodeSplit: true,
    rollupOptions: {
      input: { 'a2z-react': path.resolve('src/entry.js') },
      preserveEntrySignatures: false,
      output: {
        format: 'es',
        entryFileNames: '[name].[hash].js',
        chunkFileNames: 'chunks/[name].[hash].js',
        assetFileNames: 'chunks/[name].[hash][extname]',
        manualChunks: chunkFor,
      },
    },
  },
}));
