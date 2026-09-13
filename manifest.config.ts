import { defineManifest } from '@crxjs/vite-plugin';

// Least-privilege tradeoff: the Mini Mode mascot must auto-inject on every page,
// which requires static content_scripts matches. activeTab cannot do that.
// Users can pause Lumi per-origin from the Options page (lumiSettings.disabledOrigins).
export default defineManifest({
  manifest_version: 3,
  name: 'Lumi World',
  description: 'Lumi — AI that understands what you mean. Point at something and Lumi understands.',
  version: '0.1.0',
  action: { default_title: 'Open Lumi' },
  permissions: ['storage', 'scripting', 'sidePanel', 'tabs'],
  host_permissions: ['https://api.openai.com/*'],
  background: { service_worker: 'src/background/index.ts', type: 'module' },
  side_panel: { default_path: 'src/sidepanel/index.html' },
  options_page: 'src/options/index.html',
  content_scripts: [
    {
      matches: ['http://*/*', 'https://*/*'],
      js: ['src/content/index.tsx'],
      run_at: 'document_idle',
    },
  ],
  icons: {
    16: 'public/icons/icon16.png',
    48: 'public/icons/icon48.png',
    128: 'public/icons/icon128.png',
  },
});
