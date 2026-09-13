import { getSession, setSession } from '../shared/storage/storage';
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
