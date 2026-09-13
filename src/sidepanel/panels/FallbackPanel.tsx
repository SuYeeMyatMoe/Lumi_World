import { useState } from 'react';
import { sendMessage } from '../../shared/messaging/sendMessage';
import { useLocalStorage } from '../../shared/storage/useChromeStorage';

export function FallbackPanel() {
  const memory = useLocalStorage('lumiMemory');
  const outcome = useLocalStorage('negotiationOutcome');
  const mission = useLocalStorage('mission');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!outcome || outcome.outcome !== 'walked-away') return null;

  const rejected = memory.items.find((item) => item.id === outcome.objectId);
  const searchAlternatives = async () => {
    setBusy(true);
    setError(null);
    const result = await sendMessage({ type: 'SEARCH_ALTERNATIVES', objectId: outcome.objectId });
    if (!result.ok) setError(result.error);
    setBusy(false);
  };

  return (
    <section className="lumi-card border-lumi-mission/40">
      <span className="lumi-label text-lumi-mission">Seller walked away</span>
      <p className="mt-1 text-xs text-lumi-muted">
        That offer was above your limit. Lumi can search for a new matching product instead.
      </p>
      <div className="mt-3 rounded-lg border border-lumi-border bg-black/30 p-3">
        <p className="lumi-label text-lumi-success">Search outside Lumi Memory</p>
        <p className="mt-1 text-sm font-semibold">{rejected?.extracted.label ?? 'Find a similar product'}</p>
        <p className="mt-1 text-[11px] text-lumi-muted">
          {mission?.goal || 'Lumi will use the failed product and your price limit to search Google Shopping.'}
        </p>
        <button className="lumi-btn-primary mt-3 w-full" onClick={searchAlternatives} disabled={busy}>
          {busy ? 'Searching…' : 'Search matching alternatives'}
        </button>
      </div>
      {error && <p className="mt-2 text-[11px] text-lumi-warn">{error}</p>}
    </section>
  );
}
