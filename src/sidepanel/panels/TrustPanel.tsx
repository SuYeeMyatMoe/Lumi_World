import { useState } from 'react';
import { useLocalStorage } from '../../shared/storage/useChromeStorage';
import { sendMessage, sendTabMessage } from '../../shared/messaging/sendMessage';
import type { AgentAction, RiskLevel } from '../../shared/types/agentAction';

const RISK_STYLE: Record<RiskLevel, string> = {
  low: 'text-lumi-success border-lumi-success/40',
  medium: 'text-lumi-warn border-lumi-warn/40',
  high: 'text-lumi-danger border-lumi-danger/40',
};

const STATUS_LABEL: Record<AgentAction['status'], string> = {
  proposed: 'Proposed',
  previewed: 'Awaiting approval',
  approved: 'Approved',
  applied: 'Applied',
  rejected: 'Rejected',
  refused: 'Refused',
};

// Same jump as a memory card's Show: switch to the tab, then let the content script
// scroll to the element and outline it. Approving something you cannot see is the thing
// this panel exists to prevent.
async function showOnPage(tabId: number, selector: string) {
  if (tabId < 0 || !selector) return;
  try {
    await chrome.tabs.update(tabId, { active: true });
    await sendTabMessage(tabId, { type: 'HIGHLIGHT_SELECTOR', selector });
  } catch {
    /* tab is gone */
  }
}

export function TrustPanel() {
  const log = useLocalStorage('actionLog');
  const pending = useLocalStorage('pendingPreview');
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const pendingAction = pending ? log.find((a) => a.id === pending.actionId) : undefined;

  const run = async (kind: 'fill' | 'high') => {
    setBusy(kind);
    setError(null);
    const r = kind === 'fill' ? await sendMessage({ type: 'REQUEST_FORM_FILL' }) : await sendMessage({ type: 'REQUEST_SUBMIT' });
    if (!r.ok) setError(r.error);
    setBusy(null);
  };

  return (
    <section className="lumi-card">
      <span className="lumi-label">Lumi Trust</span>
      <p className="mb-2 mt-1 text-xs text-lumi-muted">Limits are enforced in code. Lumi previews before it acts and refuses rather than exceeds them.</p>

      <div className="mb-3 grid grid-cols-3 gap-1 text-center text-[10px]">
        <div className="rounded-md border border-lumi-success/30 py-1 text-lumi-success">
          LOW
          <br />
          <span className="text-lumi-muted">auto</span>
        </div>
        <div className="rounded-md border border-lumi-warn/30 py-1 text-lumi-warn">
          MEDIUM
          <br />
          <span className="text-lumi-muted">preview</span>
        </div>
        <div className="rounded-md border border-lumi-danger/30 py-1 text-lumi-danger">
          HIGH
          <br />
          <span className="text-lumi-muted">approve</span>
        </div>
      </div>

      <div className="flex gap-2">
        <button className="lumi-btn flex-1" onClick={() => run('fill')} disabled={busy !== null || !!pending}>
          {busy === 'fill' ? 'Reading form…' : 'Fill form from memory'}
        </button>
        <button className="lumi-btn flex-1 !border-lumi-danger/40" onClick={() => run('high')} disabled={busy !== null || !!pending}>
          Place order
        </button>
      </div>
      {error && <p className="mt-2 text-[11px] text-lumi-warn">{error}</p>}

      {pending && pendingAction && (
        <div className={`mt-3 rounded-lg border p-2.5 ${pendingAction.risk === 'high' ? 'border-lumi-danger/50 bg-lumi-danger/5' : 'border-lumi-warn/50 bg-lumi-warn/5'}`}>
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold">{pendingAction.label}</span>
            <span className={`lumi-chip ${RISK_STYLE[pendingAction.risk]}`}>{pendingAction.risk}</span>
          </div>
          <p className="mt-1 text-[11px] text-lumi-muted">
            {pendingAction.risk === 'high' ? 'Lumi is waiting for explicit approval on the page.' : `Preview shown on the page — ${pending.changes.length} field(s).`}
          </p>
          <div className="mt-2 flex gap-1">
            <button
              className="lumi-btn !py-1 !px-2"
              title="Switch to the tab and scroll to what is waiting"
              onClick={() => showOnPage(pending.tabId, pendingAction.targetSelector ?? pending.changes[0]?.selector ?? '')}
            >
              Show
            </button>
            <button className="lumi-btn !py-1 !px-2" onClick={() => sendMessage({ type: 'REJECT_ACTION', actionId: pending.actionId })}>
              Reject
            </button>
            {pendingAction.risk !== 'high' && (
              <button className="lumi-btn-primary !py-1 !px-2" onClick={() => sendMessage({ type: 'APPLY_ACTION', actionId: pending.actionId })}>
                Apply
              </button>
            )}
          </div>
        </div>
      )}

      <div className="mt-3">
        <span className="lumi-label">Activity</span>
        {log.length === 0 ? (
          <p className="mt-1 text-[11px] text-lumi-muted">No actions yet.</p>
        ) : (
          <ul className="mt-1 max-h-48 space-y-1 overflow-y-auto pr-1">
            {log.slice(0, 20).map((a) => (
              <li key={a.id} className="flex items-center justify-between gap-2 rounded-md border border-lumi-border bg-black/20 px-2 py-1.5">
                <div className="min-w-0">
                  <p className="truncate text-[11.5px]">{a.label}</p>
                  <p className="text-[10px] text-lumi-muted">
                    {STATUS_LABEL[a.status]}{executionNote(a)} · {timeAgo(a.createdAt)}
                  </p>
                </div>
                <span className={`lumi-chip shrink-0 ${RISK_STYLE[a.risk]}`}>{a.risk}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}

// A high-risk action that was approved either reached the page or did not. Saying which
// is the whole point of the origin gate, so the activity row says it outright.
function executionNote(a: AgentAction): string {
  if (a.type !== 'submit' || typeof a.payload?.executed !== 'boolean') return '';
  return a.payload.executed ? ' · executed' : ' · recorded';
}

function timeAgo(ts: number): string {
  const s = Math.max(0, Math.round((Date.now() - ts) / 1000));
  if (s < 60) return `${s}s ago`;
  const m = Math.round(s / 60);
  if (m < 60) return `${m}m ago`;
  return `${Math.round(m / 60)}h ago`;
}
