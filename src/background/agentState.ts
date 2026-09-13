import { getLocal, getSession, setSession } from '../shared/storage/storage';
import type { AgentState, FocusScreenPos } from '../shared/types/agentState';

let successTimer: ReturnType<typeof setTimeout> | null = null;

export async function setAgentState(state: AgentState, message?: string): Promise<void> {
  const current = await getSession('liveAgentState');
  await setSession('liveAgentState', { ...current, state, message, updatedAt: Date.now() });
}

export async function setFocusPos(pos: FocusScreenPos | null): Promise<void> {
  const current = await getSession('liveAgentState');
  const busy = current.state === 'thinking' || current.state === 'warning';
  const state: AgentState = busy ? current.state : pos ? 'looking' : 'idle';
  await setSession('liveAgentState', { ...current, focusScreenPos: pos, state, updatedAt: Date.now() });
}

export async function flashSuccess(message: string, ms = 1800): Promise<void> {
  if (successTimer) clearTimeout(successTimer);
  await setAgentState('success', message);
  successTimer = setTimeout(async () => {
    const current = await getSession('liveAgentState');
    if (current.state === 'success') {
      await setSession('liveAgentState', {
        ...current,
        state: current.focusScreenPos ? 'looking' : 'idle',
        message: undefined,
        updatedAt: Date.now(),
      });
    }
  }, ms);
}

export async function settleToIdle(): Promise<void> {
  const current = await getSession('liveAgentState');
  await setSession('liveAgentState', {
    ...current,
    state: current.focusScreenPos ? 'looking' : 'idle',
    message: undefined,
    updatedAt: Date.now(),
  });
}

// A held state is a promise to the user that something is happening. When nothing is,
// the mascot has to go back to resting or the panel lies: a leftover "needs approval"
// with no preview behind it is the worst of these, because it invites a click that does
// nothing. A pending preview is the one legitimate reason to sit in warning.
const SETTLE_AFTER_MS = 3000;
// A model call can legitimately hold 'thinking' for a while; only rescue it if it is
// clearly stuck. Each negotiation turn refreshes updatedAt, so a live run never trips it.
const STUCK_AFTER_MS = 20000;
const SWEEP_EVERY_MS = 1000;

let sweeper: ReturnType<typeof setInterval> | null = null;

async function sweep(): Promise<void> {
  const current = await getSession('liveAgentState');
  if (current.state === 'idle' || current.state === 'looking') return;

  const age = Date.now() - current.updatedAt;
  const limit = current.state === 'thinking' || current.state === 'listening' ? STUCK_AFTER_MS : SETTLE_AFTER_MS;
  if (age < limit) return;

  // An outstanding approval is not staleness — leave it alone.
  const preview = await getLocal('pendingPreview');
  if (preview) return;

  await settleToIdle();
}

export function startSettleWatchdog(): void {
  if (sweeper) return;
  // The worker is terminated when idle, which stops the interval. It runs again on the
  // next wake, so sweep once immediately: that is when a state stranded by a shutdown
  // gets cleared, and any message from the page is enough to trigger it.
  void sweep().catch(() => {});
  sweeper = setInterval(() => {
    void sweep().catch(() => {});
  }, SWEEP_EVERY_MS);
}
