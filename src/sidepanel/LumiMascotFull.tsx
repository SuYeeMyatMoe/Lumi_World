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

const STATE_GLOW: Record<string, string> = {
  idle: 'rgba(103, 232, 249, 0.35)',
  looking: 'rgba(34, 211, 238, 0.45)',
  thinking: 'rgba(167, 139, 250, 0.45)',
  warning: 'rgba(245, 158, 11, 0.45)',
  success: 'rgba(52, 211, 153, 0.45)',
  listening: 'rgba(244, 114, 182, 0.45)',
};

const STATE_COLOR: Record<string, string> = {
  idle: 'text-lumi-muted border-lumi-border',
  looking: 'text-lumi-focus border-lumi-focus/50',
  thinking: 'text-lumi-focus border-lumi-focus/50',
  warning: 'text-lumi-warn border-lumi-warn/50',
  success: 'text-lumi-success border-lumi-success/50',
  listening: 'text-lumi-sky border-lumi-sky/50',
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
    <section className="lumi-card overflow-hidden !p-0">
      {/* Corner tab, the reference's one decorative accent; sky so it bridges to the on-page cyan. */}
      <span aria-hidden className="absolute bottom-0 right-5 h-1.5 w-16 rounded-t-sm bg-lumi-sky/80" />

      <div className="flex items-center gap-4 p-4">
        {/* Mascot tile: raised surface with a state-tinted bloom behind Lumi */}
        <div className="lumi-raised relative h-[104px] w-[104px] shrink-0 overflow-hidden sm:h-28 sm:w-28">
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 opacity-90"
            style={{ background: `radial-gradient(circle at 50% 58%, ${STATE_GLOW[live.state]} 0%, transparent 62%)` }}
          />
          <div className="relative h-full w-full">
            <LumiMascot state={live.state} target={target} size="full" cursorFallback={target === null} />
          </div>
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-base font-bold tracking-tight">{BRAND.mascot}</h2>
            <span className={`lumi-chip ${STATE_COLOR[live.state]}`}>{STATE_LABEL[live.state]}</span>
          </div>
          <p className="mt-1.5 text-xs leading-snug text-lumi-muted">{live.message ?? BRAND.pointLine}</p>
        </div>
      </div>
    </section>
  );
}
