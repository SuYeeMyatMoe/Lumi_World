import { useSessionStorage } from '../shared/storage/useChromeStorage';
import type { LiveAgentState } from '../shared/types/agentState';

export function useAgentState(): LiveAgentState {
  return useSessionStorage('liveAgentState');
}
