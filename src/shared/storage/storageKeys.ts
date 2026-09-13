import type { LumiMemoryStore } from '../types/lumiMemory';
import type { Mission } from '../types/mission';
import type { LumiSettings } from '../types/settings';
import type { AgentAction } from '../types/agentAction';
import type { LiveAgentState } from '../types/agentState';
import type { CompareResult } from '../types/compare';
import type { LumiPreview } from '../types/lumiPreview';

export interface LocalStorageSchema {
  lumiMemory: LumiMemoryStore;
  mission: Mission | null;
  lumiSettings: LumiSettings;
  actionLog: AgentAction[];
  compareResults: CompareResult[];
  pendingPreview: LumiPreview | null;
  overlayVisible: boolean;
}

export interface SessionStorageSchema {
  liveAgentState: LiveAgentState;
}

export type LocalKey = keyof LocalStorageSchema;
export type SessionKey = keyof SessionStorageSchema;
