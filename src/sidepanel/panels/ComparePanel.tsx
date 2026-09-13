import { useState } from 'react';
import { useLocalStorage } from '../../shared/storage/useChromeStorage';
import { sendMessage } from '../../shared/messaging/sendMessage';
import type { CompareResult } from '../../shared/types/compare';

interface Props {
  selected: string[];
}

export function ComparePanel({ selected }: Props) {
  const memory = useLocalStorage('lumiMemory');
  const results = useLocalStorage('compareResults');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [aId, bId] = selected;
  const a = memory.items.find((i) => i.id === aId);
  const b = memory.items.find((i) => i.id === bId);
  const latest = results[0];
  const latestA = latest ? memory.items.find((i) => i.id === latest.objectAId) : undefined;
  const latestB = latest ? memory.items.find((i) => i.id === latest.objectBId) : undefined;

  const compare = async () => {
    if (!a || !b) return;
    setBusy(true);
    setError(null);
    const r = await sendMessage({ type: 'REQUEST_COMPARE', objectAId: a.id, objectBId: b.id });
    if (!r.ok) setError(r.error);
    setBusy(false);
  };

  return (
    <section className="lumi-card">
      <span className="lumi-label">Compare</span>
      <p className="mb-2 mt-1 text-xs text-lumi-muted">
        {selected.length < 2 ? 'Select two remembered objects above.' : `“${a?.extracted.label ?? 'A'}” vs “${b?.extracted.label ?? 'B'}”`}
      </p>
      <button className="lumi-btn-primary w-full" onClick={compare} disabled={busy || !a || !b}>
        {busy ? 'Lumi is thinking…' : 'Which fits my mission better?'}
      </button>
      {error && <p className="mt-2 text-[11px] text-lumi-warn">{error}</p>}

      {latest && latestA && latestB && <CompareCard result={latest} labelA={latestA.extracted.label ?? 'A'} labelB={latestB.extracted.label ?? 'B'} />}
    </section>
  );
}

function CompareCard({ result, labelA, labelB }: { result: CompareResult; labelA: string; labelB: string }) {
  const winnerLabel = result.winner === 'A' ? labelA : result.winner === 'B' ? labelB : 'Tie';
  return (
    <div className="mt-3 rounded-lg border border-lumi-border bg-black/30 p-3">
      <div className="grid grid-cols-2 gap-2 sm:gap-3">
        <ScoreColumn label={labelA} score={result.scoreA} winner={result.winner === 'A'} />
        <ScoreColumn label={labelB} score={result.scoreB} winner={result.winner === 'B'} />
      </div>
      <div className="mt-3 border-t border-lumi-border pt-2">
        <p className="lumi-label text-lumi-success">Best match</p>
        <p className="text-sm font-semibold">{winnerLabel}</p>
        <p className="mt-1 text-xs text-lumi-muted">{result.summary}</p>
        <ul className="mt-2 space-y-1">
          {result.reasons.map((r) => (
            <li key={r} className="flex gap-1.5 text-[11.5px] leading-snug">
              <span className="text-lumi-focus">›</span>
              <span>{r}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

function ScoreColumn({ label, score, winner }: { label: string; score: number; winner: boolean }) {
  return (
    <div className={`rounded-md border p-2 ${winner ? 'border-lumi-success/50 bg-lumi-success/5' : 'border-lumi-border'}`}>
      <p className="truncate text-[11px] font-medium">{label}</p>
      <p className={`mt-1 text-xl font-bold tabular-nums sm:text-2xl ${winner ? 'text-lumi-success' : 'text-lumi-text'}`}>{Math.round(score)}%</p>
      <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-white/5">
        <div className={`h-full rounded-full ${winner ? 'bg-lumi-success' : 'bg-lumi-muted'}`} style={{ width: `${score}%` }} />
      </div>
    </div>
  );
}
