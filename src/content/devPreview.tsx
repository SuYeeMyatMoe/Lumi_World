// Dev-only: mounts the content overlay on a plain page (demo/index.html?preview=1)
// with the chrome.* shim, so the focus engine and mini mascot can be exercised without
// loading the unpacked extension. Background-dependent features report "not available".
import { installDevShim } from '../shared/devShim';

if (new URLSearchParams(location.search).get('preview') === '1') {
  installDevShim();
  // Route FOCUS_HOVER / FOCUS_PINNED locally so the mascot reacts in preview mode.
  const rt = (chrome as unknown as { runtime: { sendMessage: (m: unknown, cb?: (r: unknown) => void) => void } }).runtime;
  rt.sendMessage = (msg: unknown, cb?: (r: unknown) => void) => {
    const m = msg as { type: string; pos?: { x: number; y: number; vw: number; vh: number } | null; snapshot?: unknown };
    if (m.type === 'GET_TAB_ID') return cb?.({ ok: true, data: 1 });
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
  import('./index');
}
