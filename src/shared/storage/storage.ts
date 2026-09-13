import type { LocalStorageSchema, SessionStorageSchema, LocalKey, SessionKey } from './storageKeys';
import { emptyLumiMemory } from '../types/lumiMemory';
import { defaultSettings } from '../types/settings';
import { initialLiveAgentState } from '../types/agentState';

const localDefaults: LocalStorageSchema = {
  lumiMemory: emptyLumiMemory(),
  mission: null,
  lumiSettings: defaultSettings(),
  actionLog: [],
  compareResults: [],
  pendingPreview: null,
  hiddenOrigins: [],
  negotiationOutcome: null,
};

const sessionDefaults: SessionStorageSchema = {
  liveAgentState: initialLiveAgentState(),
};

export async function getLocal<K extends LocalKey>(key: K): Promise<LocalStorageSchema[K]> {
  const result = await chrome.storage.local.get(key);
  const value = result[key];
  if (value === undefined) return localDefaults[key];
  if (key === 'hiddenOrigins' && !Array.isArray(value)) return [] as unknown as LocalStorageSchema[K];
  return value as LocalStorageSchema[K];
}

export async function setLocal<K extends LocalKey>(key: K, value: LocalStorageSchema[K]): Promise<void> {
  await chrome.storage.local.set({ [key]: value });
}

export async function updateLocal<K extends LocalKey>(
  key: K,
  updater: (current: LocalStorageSchema[K]) => LocalStorageSchema[K],
): Promise<LocalStorageSchema[K]> {
  const current = await getLocal(key);
  const next = updater(current);
  await setLocal(key, next);
  return next;
}

export async function getSession<K extends SessionKey>(key: K): Promise<SessionStorageSchema[K]> {
  const result = await chrome.storage.session.get(key);
  const value = result[key];
  return (value === undefined ? sessionDefaults[key] : value) as SessionStorageSchema[K];
}

export async function setSession<K extends SessionKey>(key: K, value: SessionStorageSchema[K]): Promise<void> {
  await chrome.storage.session.set({ [key]: value });
}

export function localDefault<K extends LocalKey>(key: K): LocalStorageSchema[K] {
  return localDefaults[key];
}

export function sessionDefault<K extends SessionKey>(key: K): SessionStorageSchema[K] {
  return sessionDefaults[key];
}
