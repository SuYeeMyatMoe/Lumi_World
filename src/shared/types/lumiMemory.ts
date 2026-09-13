import type { LumiFocusSnapshot } from './lumiFocus';

export const LUMI_MEMORY_CAP = 50;

export interface LumiMemoryStore {
  items: LumiFocusSnapshot[];
}

export const emptyLumiMemory = (): LumiMemoryStore => ({ items: [] });
