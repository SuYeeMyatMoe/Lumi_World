import { useEffect, useState } from 'react';

interface Props {
  target: Element | null;
  pinned: boolean;
  /** Lumi is acting on this element right now. */
  working?: boolean;
  label?: string;
}

interface Box {
  top: number;
  left: number;
  width: number;
  height: number;
}

export function HighlightOverlay({ target, pinned, working = false, label }: Props) {
  const [box, setBox] = useState<Box | null>(null);

  useEffect(() => {
    if (!target) {
      setBox(null);
      return;
    }
    let raf = 0;
    const update = () => {
      const r = target.getBoundingClientRect();
      setBox((prev) => {
        if (prev && prev.top === r.top && prev.left === r.left && prev.width === r.width && prev.height === r.height) return prev;
        return { top: r.top, left: r.left, width: r.width, height: r.height };
      });
      raf = requestAnimationFrame(update);
    };
    raf = requestAnimationFrame(update);
    const ro = new ResizeObserver(update);
    ro.observe(target);
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
    };
  }, [target]);

  if (!box || box.width === 0) return null;

  return (
    <div
      className={`lumi-highlight${working ? ' working' : pinned ? ' pinned' : ''}`}
      style={{ top: box.top - 2, left: box.left - 2, width: box.width + 4, height: box.height + 4 }}
    >
      <span className="lumi-highlight-tag">{working ? 'LUMI · WORKING' : pinned ? 'Remembered' : 'Lumi Focus'}</span>
      {!pinned && !working && (
        <span className="lumi-highlight-hint">
          <kbd>Alt</kbd>+<kbd>Click</kbd> or double-click to remember{label ? ` · ${label}` : ''}
        </span>
      )}
    </div>
  );
}
