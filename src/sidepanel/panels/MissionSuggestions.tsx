import { useState } from 'react';
import { sendMessage } from '../../shared/messaging/sendMessage';
import type { MissionSuggestions as Suggestions } from '../../shared/types/pageContext';

// Replaces the static example missions: Lumi reads the page the user is actually on
// and proposes missions from it. Without an API key the suggestion still appears —
// derived in code — which is the point we make on camera.
export function MissionSuggestions({ onPick }: { onPick?: (goal: string) => void }) {
  const [result, setResult] = useState<Suggestions | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const suggest = async () => {
    setLoading(true);
    setError(null);
    const response = await sendMessage({ type: 'SUGGEST_MISSIONS' });
    setLoading(false);
    if (!response.ok) {
      setResult(null);
      setError(response.error);
      return;
    }
    setResult(response.data);
  };

  // Goes through PARSE_MISSION so a picked suggestion gets the same mandate treatment
  // as a typed one: the ceiling and must-haves are extracted and enforced in code.
  // The background stores the plain goal if the parse fails, so this never loses the pick.
  const pick = async (goal: string) => {
    const response = await sendMessage({ type: 'PARSE_MISSION', goal });
    if (!response.ok) setError(response.error);
    onPick?.(goal);
  };

  return (
    <div className="mt-3 flex flex-col gap-1">
      <button className="lumi-btn !py-1 !px-2 self-start" onClick={suggest} disabled={loading}>
        {loading ? 'Reading this page…' : 'Suggest from this page'}
      </button>

      {error && <p className="mt-1 text-[11px] text-lumi-warn">{error}</p>}

      {result?.suggestions.map((s) => (
        <button
          key={s.goal}
          className="mt-1 text-left text-[11px] text-lumi-muted hover:text-lumi-text"
          onClick={() => pick(s.goal)}
        >
          → {s.goal}
          {s.why && <span className="block pl-3 text-[10px] opacity-60">{s.why}</span>}
        </button>
      ))}

      {result?.source === 'fallback' && (
        <p className="mt-1 text-[10px] text-lumi-muted">Read from the page without a model — no API key.</p>
      )}
    </div>
  );
}
