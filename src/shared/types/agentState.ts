export type AgentState = 'idle' | 'looking' | 'thinking' | 'warning' | 'success' | 'listening';

export interface FocusScreenPos {
  x: number;
  y: number;
  vw: number;
  vh: number;
  tabId: number;
}

export interface LiveAgentState {
  state: AgentState;
  focusScreenPos: FocusScreenPos | null;
  message?: string;
  updatedAt: number;
}

export const initialLiveAgentState = (): LiveAgentState => ({
  state: 'idle',
  focusScreenPos: null,
  updatedAt: Date.now(),
});
