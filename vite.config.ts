import { defineConfig } from 'vite';
import { fileURLToPath, URL } from 'node:url';
import react from '@vitejs/plugin-react';
import { crx } from '@crxjs/vite-plugin';
import manifest from './manifest.config';

// `vite build --watch` re-empties outDir on every rebuild, so dist/manifest.json
// briefly disappears and Chrome unloads the unpacked extension — Lumi then stops
// injecting on real websites while the demo page (own dev server) keeps working.
// scripts/dev.mjs wipes dist once at startup instead.
const isWatch = process.argv.includes('--watch') || process.argv.includes('-w');

export default defineConfig({
  plugins: [
    react(),
    crx({
      manifest,
      contentScripts: {
        // HMR preamble opens a chrome.runtime port on every site. When Google
        // puts the tab in bfcache the port dies and CRXJS throws uncaught.
        preambleCode: false,
        // IIFE in `vite build` so websites never load vendor/vite-client.js.
        standaloneFiles: ['src/content/index.tsx'],
      },
    }),
  ],
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  // CRXJS builds the content script in a nested Vite build that runs with no
  // plugins and inherits only `define` (see crxjs createIifeConfig). Without
  // this, React's CJS wrapper keeps a live `process.env.NODE_ENV` reference and
  // the content script dies with "process is not defined" before it can mount —
  // so Lumi never appears on real websites. The demo page is unaffected because
  // its dev server shims `process`, which is why it kept working.
  define: {
    'process.env.NODE_ENV': JSON.stringify('production'),
  },
  build: {
    emptyOutDir: !isWatch,
    rollupOptions: {
      input: {
        sidepanel: 'src/sidepanel/index.html',
        options: 'src/options/index.html',
      },
    },
  },
  server: {
    port: 5173,
    strictPort: true,
    hmr: { protocol: 'ws', host: 'localhost', port: 24678, clientPort: 24678 },
  },
});
