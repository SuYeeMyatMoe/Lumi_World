import { useMemo } from 'react';
import { LumiMascot } from '../mascot/LumiMascot';
import { useAgentState } from '../mascot/useAgentState';
import type { MascotTarget } from '../mascot/useLookAt';
import { BRAND } from '../shared/constants';

const STATE_LABEL: Record<string, string> = {
  idle: 'Idle',
  looking: 'Looking',
  thinking: 'Thinking',
  warning: 'Needs approval',
  success: 'Done',
  listening: 'Listening',
};

const STATE_COLOR: Record<string, string> = {
  idle: 'text-lumi-muted border-lumi-border',
  looking: 'text-lumi-focus border-lumi-focus/40',
  thinking: 'text-violet-300 border-violet-400/40',
  warning: 'text-lumi-warn border-lumi-warn/40',
  success: 'text-lumi-success border-lumi-success/40',
  listening: 'text-pink-300 border-pink-400/40',
};

export function LumiMascotFull() {
  const live = useAgentState();

  // Focus lives in the page's window; project it into a normalized glance direction.
  // The side panel sits to the right of the page, so the mascot leans left toward it.
  const target = useMemo<MascotTarget | null>(() => {
    const p = live.focusScreenPos;
    if (!p) return null;
    const nx = (p.x / p.vw - 0.5) * 2 - 0.6;
    const ny = (p.y / p.vh - 0.5) * 2;
    return { normalized: true, nx, ny };
  }, [live.focusScreenPos]);

  return (
    <div className="relative flex flex-col items-center">
      <div className="h-44 w-full">
        <LumiMascot state={live.state} target={target} size="full" cursorFallback={target === null} />
      </div>
      <div className="-mt-2 flex items-center gap-2">
        <span className="text-sm font-semibold tracking-tight">{BRAND.mascot}</span>
        <span className={`lumi-chip ${STATE_COLOR[live.state]}`}>{STATE_LABEL[live.state]}</span>
      </div>
      <p className="mt-1 h-4 text-center text-xs text-lumi-muted">{live.message ?? BRAND.pointLine}</p>
    </div>
  );
}
