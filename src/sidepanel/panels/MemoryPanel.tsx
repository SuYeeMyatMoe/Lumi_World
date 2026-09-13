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
      <div className="lumi-section-head">
        <span className="lumi-label">
          Lumi Memory <span className="ml-1 rounded-full bg-lumi-focus/15 px-1.5 py-px text-lumi-focus">{memory.items.length}</span>
        </span>
        {memory.items.length > 0 && (
          <button className="lumi-btn !min-h-8 !py-1 !px-2.5" onClick={() => sendMessage({ type: 'CLEAR_MEMORY' })}>
            Clear
          </button>
        )}
      </div>

      {memory.items.length === 0 ? (
        <div className="lumi-raised border-dashed p-4 text-center">
          <p className="text-xs font-medium">Nothing remembered yet</p>
          <p className="mt-1 text-[11px] text-lumi-muted">
            Hover anything on a page and <kbd className="rounded-md border border-lumi-border bg-lumi-bg/60 px-1.5 py-px font-sans text-[10px]">Alt</kbd> + click it.
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
  const host = safeHost(item.tabUrl, item.tabTitle);
  const s = item.missionScore;
  return (
    <li
      className={`group cursor-pointer rounded-xl border border-l-2 p-3 transition ${
        selected
          ? 'border-lumi-focus/60 border-l-lumi-focus bg-lumi-focus/[0.07]'
          : 'border-lumi-border/60 border-l-transparent bg-lumi-raised/70 hover:border-lumi-border'
      }`}
      onClick={onToggle}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-sm font-medium">{item.extracted.label ?? item.tagName}</p>
          <p className="truncate text-[11px] text-lumi-muted">{host}</p>
        </div>
        {item.extracted.price && <span className="shrink-0 text-xs font-semibold tabular-nums text-lumi-text">{item.extracted.price}</span>}
      </div>
      <p className="mt-1 line-clamp-2 text-[11px] leading-snug text-lumi-muted">{item.text}</p>

      {s && (
        <div className="mt-2">
          <div className="flex items-center justify-between text-[11px]">
            <span className="text-lumi-muted">Mission match</span>
            <span className={`font-semibold ${s.score >= 70 ? 'text-lumi-success' : s.score >= 40 ? 'text-lumi-warn' : 'text-lumi-danger'}`}>{s.score}%</span>
          </div>
          <div className="lumi-meter mt-1.5">
            <div className={s.score >= 70 ? 'bg-lumi-success' : s.score >= 40 ? 'bg-lumi-warn' : 'bg-lumi-danger'} style={{ width: `${s.score}%` }} />
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

      <div className="mt-2.5 flex flex-wrap items-center gap-1.5 opacity-80 transition group-hover:opacity-100" onClick={(e) => e.stopPropagation()}>
        <button className="lumi-btn !min-h-7 !py-0.5 !px-2.5 !text-[11px]" onClick={onScore} disabled={scoring}>
          {scoring ? 'Scoring…' : s ? 'Re-score' : 'Score vs mission'}
        </button>
        <button className="lumi-btn !min-h-7 !py-0.5 !px-2.5 !text-[11px]" onClick={() => showOnPage(item)} title="Switch to the tab and scroll to it">
          Show
        </button>
        <button className="lumi-btn !min-h-7 !py-0.5 !px-2.5 !text-[11px]" onClick={onRemove}>
          Forget
        </button>
        {selected && <span className="lumi-chip ml-auto border-lumi-focus/50 text-lumi-focus">Selected</span>}
      </div>
    </li>
  );
}

// Every card names where it came from, whether the user pinned it or the orchestrator
// did. An item with no usable URL still gets a line, so the cards stay the same shape.
function safeHost(url: string, title?: string): string {
  try {
    const host = new URL(url).hostname.replace(/^www\./, '');
    if (host) return host;
  } catch {
    /* not a URL — fall through to the title */
  }
  const trimmed = (title ?? '').trim();
  if (trimmed) return trimmed.length > 48 ? `${trimmed.slice(0, 47)}…` : trimmed;
  return 'unknown source';
}
