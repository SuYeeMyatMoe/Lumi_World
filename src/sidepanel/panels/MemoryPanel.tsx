import { useState } from 'react';
import { useLocalStorage } from '../../shared/storage/useChromeStorage';
import { sendMessage, sendTabMessage } from '../../shared/messaging/sendMessage';
import type { LumiFocusSnapshot } from '../../shared/types/lumiFocus';

async function showOnPage(item: LumiFocusSnapshot) {
  if (item.tabId < 0) return;
  try {
    await chrome.tabs.update(item.tabId, { active: true });
    await sendTabMessage(item.tabId, { type: 'HIGHLIGHT_SELECTOR', selector: item.selector });
  } catch {
    /* tab is gone */
  }
}

interface Props {
  selected: string[];
  onToggle: (id: string) => void;
}

export function MemoryPanel({ selected, onToggle }: Props) {
  const memory = useLocalStorage('lumiMemory');
  const [scoring, setScoring] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const score = async (id: string) => {
    setScoring(id);
    setError(null);
    const r = await sendMessage({ type: 'REQUEST_SCORE', objectId: id });
    if (!r.ok) setError(r.error);
    setScoring(null);
  };

  return (
    <section className="lumi-card">
      <div className="mb-2 flex items-center justify-between">
        <span className="lumi-label text-lumi-focus">Lumi Memory · {memory.items.length}</span>
        {memory.items.length > 0 && (
          <button className="lumi-btn !py-1 !px-2" onClick={() => sendMessage({ type: 'CLEAR_MEMORY' })}>
            Clear
          </button>
        )}
      </div>

      {memory.items.length === 0 ? (
        <div className="rounded-lg border border-dashed border-lumi-border p-3 text-center">
          <p className="text-xs text-lumi-muted">Nothing remembered yet.</p>
          <p className="mt-1 text-[11px] text-lumi-muted">
            Hover anything on a page and <kbd className="rounded border border-lumi-border px-1">Alt</kbd>+click it.
          </p>
        </div>
      ) : (
        <ul className="flex flex-col gap-2">
          {memory.items.map((item) => (
            <MemoryCard
              key={item.id}
              item={item}
              selected={selected.includes(item.id)}
              scoring={scoring === item.id}
              onToggle={() => onToggle(item.id)}
              onScore={() => score(item.id)}
              onRemove={() => sendMessage({ type: 'REMOVE_MEMORY_ITEM', id: item.id })}
            />
          ))}
        </ul>
      )}
      {error && <p className="mt-2 text-[11px] text-lumi-warn">{error}</p>}
    </section>
  );
}

function MemoryCard({
  item,
  selected,
  scoring,
  onToggle,
  onScore,
  onRemove,
}: {
  item: LumiFocusSnapshot;
  selected: boolean;
  scoring: boolean;
  onToggle: () => void;
  onScore: () => void;
  onRemove: () => void;
}) {
  const host = safeHost(item.tabUrl);
  const s = item.missionScore;
  return (
    <li
      className={`group cursor-pointer rounded-lg border p-2.5 transition ${
        selected ? 'border-lumi-focus bg-lumi-focus/5' : 'border-lumi-border bg-black/20 hover:border-lumi-muted/40'
      }`}
      onClick={onToggle}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-sm font-medium">{item.extracted.label ?? item.tagName}</p>
          <p className="truncate text-[11px] text-lumi-muted">{host}</p>
        </div>
        {item.extracted.price && <span className="shrink-0 text-xs font-semibold text-lumi-mission">{item.extracted.price}</span>}
      </div>
      <p className="mt-1 line-clamp-2 text-[11px] leading-snug text-lumi-muted">{item.text}</p>

      {s && (
        <div className="mt-2">
          <div className="flex items-center justify-between text-[11px]">
            <span className="text-lumi-muted">Mission match</span>
            <span className={`font-semibold ${s.score >= 70 ? 'text-lumi-success' : s.score >= 40 ? 'text-lumi-warn' : 'text-lumi-danger'}`}>{s.score}%</span>
          </div>
          <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-white/5">
            <div className={`h-full rounded-full ${s.score >= 70 ? 'bg-lumi-success' : s.score >= 40 ? 'bg-lumi-warn' : 'bg-lumi-danger'}`} style={{ width: `${s.score}%` }} />
          </div>
          <p className="mt-1 text-[11px] text-lumi-text">{s.verdict}</p>
          {s.matchedConstraints.length > 0 && (
            <ul className="mt-1 space-y-0.5">
              {s.matchedConstraints.slice(0, 4).map((c) => (
                <li key={c} className="text-[10.5px] text-lumi-muted">
                  {c}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      <div className="mt-2 flex items-center gap-1 opacity-70 transition group-hover:opacity-100" onClick={(e) => e.stopPropagation()}>
        <button className="lumi-btn !py-0.5 !px-2 !text-[11px]" onClick={onScore} disabled={scoring}>
          {scoring ? 'Scoring…' : s ? 'Re-score' : 'Score vs mission'}
        </button>
        <button className="lumi-btn !py-0.5 !px-2 !text-[11px]" onClick={() => showOnPage(item)} title="Switch to the tab and scroll to it">
          Show
        </button>
        <button className="lumi-btn !py-0.5 !px-2 !text-[11px]" onClick={onRemove}>
          Forget
        </button>
        {selected && <span className="ml-auto text-[10px] font-semibold uppercase tracking-wider text-lumi-focus">Selected</span>}
      </div>
    </li>
  );
}

function safeHost(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
}
