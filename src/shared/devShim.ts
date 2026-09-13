// Minimal chrome.* shim so extension pages can be previewed in a plain browser tab
// (npm run dev → open /src/sidepanel/index.html). No-op inside the real extension.

type Listener = (changes: Record<string, { oldValue?: unknown; newValue?: unknown }>, area: string) => void;

function makeArea(area: string, backing: Storage | Map<string, string>) {
  const read = (k: string) => (backing instanceof Map ? backing.get(k) : backing.getItem(`lumi:${area}:${k}`)) ?? null;
  const write = (k: string, v: string) => (backing instanceof Map ? backing.set(k, v) : backing.setItem(`lumi:${area}:${k}`, v));
  const listeners: Listener[] = [];
  const api = {
    async get(keys: string | string[]) {
      const list = Array.isArray(keys) ? keys : [keys];
      const out: Record<string, unknown> = {};
      for (const k of list) {
        const raw = read(k);
        if (raw !== null) out[k] = JSON.parse(raw);
      }
      return out;
    },
    async set(items: Record<string, unknown>) {
      const changes: Record<string, { oldValue?: unknown; newValue?: unknown }> = {};
      for (const [k, v] of Object.entries(items)) {
        const old = read(k);
        write(k, JSON.stringify(v));
        changes[k] = { oldValue: old ? JSON.parse(old) : undefined, newValue: v };
      }
      queueMicrotask(() => listeners.forEach((l) => l(changes, area)));
    },
    async setAccessLevel() {},
    _listeners: listeners,
  };
  return api;
}

export function installDevShim(): void {
  if (typeof chrome !== 'undefined' && chrome.storage?.local) return;
  const local = makeArea('local', localStorage);
  const session = makeArea('session', new Map());
  const all = [local, session];
  const onChanged = {
    addListener: (l: Listener) => all.forEach((a) => a._listeners.push(l)),
    removeListener: (l: Listener) =>
      all.forEach((a) => {
        const i = a._listeners.indexOf(l);
        if (i >= 0) a._listeners.splice(i, 1);
      }),
  };
  const shim = {
    storage: { local, session, onChanged },
    runtime: {
      sendMessage: (_msg: unknown, cb?: (r: unknown) => void) => cb?.({ ok: false, code: 'UNKNOWN', error: 'Dev preview: background not available.' }),
      onMessage: { addListener: () => {} },
      openOptionsPage: () => window.open('/src/options/index.html', '_blank'),
      lastError: undefined,
    },
    tabs: { sendMessage: () => {} },
  };
  (globalThis as unknown as { chrome: unknown }).chrome = shim;
  (window as unknown as { __LUMI_DEV_SHIM__: boolean }).__LUMI_DEV_SHIM__ = true;
}
