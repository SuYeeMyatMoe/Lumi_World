import { useEffect, useState } from 'react';
import { useLocalStorage } from '../shared/storage/useChromeStorage';
import { setLocal } from '../shared/storage/storage';
import { sendMessage } from '../shared/messaging/sendMessage';
import { BRAND } from '../shared/constants';
import { DEFAULT_MODEL } from '../shared/types/settings';
import type { LocalKey } from '../shared/storage/storageKeys';

const MODELS = ['gpt-4o-mini', 'gpt-4o', 'gpt-4.1-mini', 'gpt-4.1'];

// Everything a take leaves behind, including hiddenOrigins — a × clicked on the mascot in
// an earlier take otherwise leaves Lumi invisible on that origin for the next one.
// lumiSettings is deliberately absent: the API key and the execute origins must survive a
// reset, or the next take starts by failing.
// Typed as LocalKey[] so a mistyped key is a compile error rather than a key that
// silently fails to clear and shows up as a stale panel mid-take.
const DEMO_STATE_KEYS: LocalKey[] = [
  'lumiMemory',
  'compareResults',
  'actionLog',
  'pendingPreview',
  'mission',
  'negotiationOutcome',
  'hiddenOrigins',
];

export function OptionsApp() {
  const settings = useLocalStorage('lumiSettings');
  const [key, setKey] = useState('');
  const [model, setModel] = useState(DEFAULT_MODEL);
  const [origins, setOrigins] = useState<string[]>([]);
  const [newOrigin, setNewOrigin] = useState('');
  const [saved, setSaved] = useState(false);
  const [reset, setReset] = useState(false);
  const [showKey, setShowKey] = useState(false);

  useEffect(() => {
    setKey(settings.openaiApiKey);
    setModel(settings.model || DEFAULT_MODEL);
    setOrigins(settings.disabledOrigins);
  }, [settings]);

  const save = async () => {
    await setLocal('lumiSettings', { ...settings, openaiApiKey: key.trim(), model, disabledOrigins: origins });
    setSaved(true);
    setTimeout(() => setSaved(false), 1800);
  };

  // Removing the keys rather than writing empty values lets getLocal fall back to the
  // defaults in storage.ts, so this never drifts from them.
  const resetDemoState = async () => {
    await chrome.storage.local.remove(DEMO_STATE_KEYS);
    await sendMessage({ type: 'SET_AGENT_STATE', state: 'idle' });
    setReset(true);
    setTimeout(() => setReset(false), 1800);
  };

  const addOrigin = () => {
    const raw = newOrigin.trim();
    if (!raw) return;
    let origin = raw;
    try {
      origin = new URL(raw.includes('://') ? raw : `https://${raw}`).origin;
    } catch {
      return;
    }
    if (!origins.includes(origin)) setOrigins([...origins, origin]);
    setNewOrigin('');
  };

  return (
    <div className="mx-auto max-w-xl px-6 py-10">
      <h1 className="text-xl font-bold tracking-tight">{BRAND.name} · Options</h1>
      <p className="mt-1 text-sm text-lumi-muted">{BRAND.tagline}</p>

      <section className="lumi-card mt-6">
        <span className="lumi-label text-lumi-focus">OpenAI</span>
        <p className="mb-3 mt-1 text-xs text-lumi-muted">
          Stored only in this browser's extension storage and sent only to <code>api.openai.com</code>. Lumi never sends page content anywhere else.
        </p>
        <label className="block text-xs font-medium">API key</label>
        <div className="mt-1 flex gap-2">
          <input
            className="lumi-input font-mono"
            type={showKey ? 'text' : 'password'}
            placeholder="sk-…"
            value={key}
            onChange={(e) => setKey(e.target.value)}
            autoComplete="off"
            spellCheck={false}
          />
          <button className="lumi-btn shrink-0" onClick={() => setShowKey((s) => !s)}>
            {showKey ? 'Hide' : 'Show'}
          </button>
        </div>

        <label className="mt-4 block text-xs font-medium">Model</label>
        <select className="lumi-input mt-1" value={model} onChange={(e) => setModel(e.target.value)}>
          {MODELS.map((m) => (
            <option key={m} value={m}>
              {m}
            </option>
          ))}
        </select>
      </section>

      <section className="lumi-card mt-4">
        <span className="lumi-label">Paused sites</span>
        <p className="mb-3 mt-1 text-xs text-lumi-muted">
          Lumi injects its mascot on every http(s) page so it can watch what you point at. Add origins here to keep Lumi off them entirely.
        </p>
        <div className="flex gap-2">
          <input
            className="lumi-input"
            placeholder="https://mail.example.com"
            value={newOrigin}
            onChange={(e) => setNewOrigin(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && addOrigin()}
          />
          <button className="lumi-btn shrink-0" onClick={addOrigin}>
            Add
          </button>
        </div>
        {origins.length > 0 && (
          <ul className="mt-3 space-y-1">
            {origins.map((o) => (
              <li key={o} className="flex items-center justify-between rounded-md border border-lumi-border bg-black/20 px-2 py-1.5 text-xs">
                <span className="font-mono">{o}</span>
                <button className="text-lumi-muted hover:text-lumi-danger" onClick={() => setOrigins(origins.filter((x) => x !== o))}>
                  Remove
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="lumi-card mt-4">
        <span className="lumi-label text-lumi-danger">High-risk execution</span>
        <p className="mb-3 mt-1 text-xs text-lumi-muted">
          High-risk actions execute only on these origins; everywhere else they are gated.
        </p>
        <ul className="space-y-1">
          {settings.executeHighRiskOrigins.map((o) => (
            <li key={o} className="rounded-md border border-lumi-border bg-black/20 px-2 py-1.5 font-mono text-xs">
              {o}
            </li>
          ))}
        </ul>
        <p className="mt-2 text-[11px] text-lumi-muted">
          Read-only. Approving a high-risk action anywhere else records the approval without touching the page.
        </p>
      </section>

      <section className="lumi-card mt-4">
        <span className="lumi-label">Demo</span>
        <p className="mb-3 mt-1 text-xs text-lumi-muted">
          Clears Lumi Memory, comparisons, the action log, any pending preview, the mission and the last negotiation
          outcome, brings the mascot back on any site you closed it on, and settles Lumi to idle — so a recording take
          starts from an empty panel. Your API key, model and paused sites are kept.
        </p>
        <div className="flex items-center gap-3">
          <button className="lumi-btn" onClick={resetDemoState}>
            Reset demo state
          </button>
          {reset && <span className="text-xs text-lumi-success">Demo state cleared.</span>}
        </div>
      </section>

      <div className="mt-6 flex items-center gap-3">
        <button className="lumi-btn-primary" onClick={save}>
          Save
        </button>
        {saved && <span className="text-xs text-lumi-success">Saved.</span>}
      </div>

      <section className="mt-10 text-xs text-lumi-muted">
        <p className="lumi-label mb-2">How to use</p>
        <ol className="list-decimal space-y-1 pl-4">
          <li>Hover anything on a page — Lumi turns to look at it.</li>
          <li>
            <kbd className="rounded border border-lumi-border px-1">Alt</kbd>+click to remember it (Lumi Memory).
          </li>
          <li>Close Lumi with the × on the mascot to hide it on this site. Other websites keep Lumi. Click the Lumi chip or the toolbar icon to bring it back.</li>
          <li>Open the side panel, set a Mission, select two objects and compare.</li>
          <li>On a form, ask Lumi to fill it — you'll see a Lumi Preview before anything is written.</li>
        </ol>
      </section>
    </div>
  );
}
