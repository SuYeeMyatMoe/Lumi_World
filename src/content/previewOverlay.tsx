import { useEffect, useState } from 'react';
import type { LumiPreview } from '../shared/types/lumiPreview';
import type { AgentAction } from '../shared/types/agentAction';
import { resolveSelector } from '../shared/dom/selector';
import { sendMessage } from '../shared/messaging/sendMessage';

interface Props {
  preview: LumiPreview;
  action: AgentAction | null;
}

interface FieldBox {
  selector: string;
  value: string;
  top: number;
  left: number;
  width: number;
  height: number;
}

export function PreviewOverlay({ preview, action }: Props) {
  const [boxes, setBoxes] = useState<FieldBox[]>([]);
  const [confirmed, setConfirmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const isHigh = action?.risk === 'high';

  useEffect(() => {
    let raf = 0;
    const update = () => {
      const next: FieldBox[] = [];
      for (const change of preview.changes) {
        const el = resolveSelector(change.selector);
        if (!el) continue;
        const r = el.getBoundingClientRect();
        if (r.width === 0) continue;
        next.push({ selector: change.selector, value: change.proposedValue, top: r.top, left: r.left, width: r.width, height: r.height });
      }
      setBoxes(next);
      raf = requestAnimationFrame(update);
    };
    raf = requestAnimationFrame(update);
    return () => cancelAnimationFrame(raf);
  }, [preview]);

  const apply = async () => {
    setBusy(true);
    await sendMessage({ type: 'APPLY_ACTION', actionId: preview.actionId });
    setBusy(false);
  };
  const reject = async () => {
    setBusy(true);
    await sendMessage({ type: 'REJECT_ACTION', actionId: preview.actionId });
    setBusy(false);
  };

  return (
    <>
      {boxes.map((b) => (
        <div key={b.selector} className="lumi-preview-field" style={{ top: b.top, left: b.left, width: b.width, height: b.height }}>
          <span className="lumi-preview-field-value">{b.value}</span>
        </div>
      ))}

      <div className={`lumi-preview-card${isHigh ? ' high' : ''}`}>
        <div className="lumi-preview-title">
          <span>{isHigh ? 'Lumi Trust · High risk' : 'Lumi Preview'}</span>
          <span className="lumi-preview-risk">{action?.risk ?? 'medium'}</span>
        </div>

        {isHigh ? (
          <div className="lumi-preview-note">
            <strong style={{ color: '#e8e8f0' }}>{action?.label}</strong>
            <br />
            {preview.rationale}
          </div>
        ) : (
          <>
            <div className="lumi-preview-note">I want to change {preview.changes.length} field{preview.changes.length === 1 ? '' : 's'}. Nothing has been written yet.</div>
            {preview.changes.map((c) => (
              <div key={c.selector} className="lumi-preview-row">
                <span className="label">{c.label}</span>
                <span className="value">
                  {c.currentValue ? <span className="old">{c.currentValue}</span> : null}
                  {c.proposedValue}
                </span>
              </div>
            ))}
            {preview.rationale && <div className="lumi-preview-note" style={{ marginTop: 8 }}>{preview.rationale}</div>}
          </>
        )}

        <div className="lumi-preview-locked">🔒 Password &amp; payment fields: not accessed</div>

        {isHigh && (
          <label className="lumi-confirm-check">
            <input type="checkbox" checked={confirmed} onChange={(e) => setConfirmed(e.target.checked)} />
            I understand this action cannot be undone
          </label>
        )}

        <div className="lumi-preview-actions">
          <button className="lumi-btn" onClick={reject} disabled={busy}>
            Reject
          </button>
          <button className={`lumi-btn ${isHigh ? 'danger' : 'primary'}`} onClick={apply} disabled={busy || (isHigh && !confirmed)}>
            {isHigh ? 'Approve' : 'Apply'}
          </button>
        </div>
      </div>
    </>
  );
}
