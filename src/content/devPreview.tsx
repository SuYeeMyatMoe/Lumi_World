// Dev-only: mounts the content overlay on a plain page, opt-in via ?preview=1.
// Never mounts on the demo page by itself — on localhost the real content script is
// already injecting, and a second mount races it and shadows the extension (the mascot
// click opens a tab instead of the side panel).
import { installDevShim } from '../shared/devShim';
// The crx dev plugin fixes the demo page's module list when the server starts, and this
// file is the only /src module on it. Booting the scripted seller from here means the
// chat works without restarting the dev server. Both are dev-only and no-ops elsewhere.
import '../demo/sellerBoot';

const HOST_ID = 'lumi-world-host';

function isDemoPage(): boolean {
  return location.search.includes('preview=1');
}

function mountDemoPreview() {
  const existing = document.getElementById(HOST_ID);
  if (existing?.shadowRoot?.querySelector('.lumi-widget, .lumi-reopen')) return;
  existing?.remove();
  installDevShim();
  const rt = (chrome as unknown as { runtime: { sendMessage: (m: unknown, cb?: (r: unknown) => void) => void } }).runtime;
  rt.sendMessage = (msg: unknown, cb?: (r: unknown) => void) => {
    const m = msg as { type: string; pos?: { x: number; y: number; vw: number; vh: number } | null; snapshot?: unknown };
    if (m.type === 'GET_TAB_ID') return cb?.({ ok: true, data: 1 });
    if (m.type === 'OPEN_SIDE_PANEL') {
      window.open('/src/sidepanel/index.html', 'lumi-space');
      return cb?.({ ok: true, data: null });
    }
    if (m.type === 'FOCUS_HOVER') {
      chrome.storage.session.get('liveAgentState').then((r) => {
        const cur = (r.liveAgentState as { state: string }) ?? { state: 'idle' };
        const busy = cur.state === 'thinking' || cur.state === 'warning' || cur.state === 'success';
        chrome.storage.session.set({
          liveAgentState: { ...cur, focusScreenPos: m.pos ? { ...m.pos, tabId: 1 } : null, state: busy ? cur.state : m.pos ? 'looking' : 'idle', updatedAt: Date.now() },
        });
      });
      return cb?.({ ok: true, data: null });
    }
    if (m.type === 'FOCUS_PINNED') {
      const snap = { ...(m.snapshot as object), id: `focus_${Date.now()}`, createdAt: Date.now(), tabId: 1, tabUrl: location.href, tabTitle: document.title };
      chrome.storage.local.get('lumiMemory').then((r) => {
        const items = (r.lumiMemory as { items: unknown[] } | undefined)?.items ?? [];
        chrome.storage.local.set({ lumiMemory: { items: [snap, ...items].slice(0, 50) } });
      });
      chrome.storage.session.set({ liveAgentState: { state: 'success', focusScreenPos: null, message: 'Got it.', updatedAt: Date.now() } });
      setTimeout(() => chrome.storage.session.set({ liveAgentState: { state: 'idle', focusScreenPos: null, updatedAt: Date.now() } }), 1800);
      return cb?.({ ok: true, data: snap });
    }
    cb?.({ ok: false, code: 'UNKNOWN', error: 'Dev preview: background not available.' });
  };
  void import('./index');
}

if (isDemoPage()) {
  window.setTimeout(mountDemoPreview, 400);
}
