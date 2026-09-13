import { useEffect, useState } from 'react';
import type { LocalStorageSchema, SessionStorageSchema, LocalKey, SessionKey } from './storageKeys';
import { getLocal, getSession, localDefault, sessionDefault } from './storage';

export function useLocalStorage<K extends LocalKey>(key: K): LocalStorageSchema[K] {
  const [value, setValue] = useState<LocalStorageSchema[K]>(() => localDefault(key));

  useEffect(() => {
    let cancelled = false;
    getLocal(key).then((v) => {
      if (!cancelled) setValue(v);
    });
    const listener = (changes: Record<string, chrome.storage.StorageChange>, area: string) => {
      if (area !== 'local' || !(key in changes)) return;
      const next = changes[key].newValue;
      setValue((next === undefined ? localDefault(key) : next) as LocalStorageSchema[K]);
    };
    chrome.storage.onChanged.addListener(listener);
    return () => {
      cancelled = true;
      chrome.storage.onChanged.removeListener(listener);
    };
  }, [key]);

  return value;
}

export function useSessionStorage<K extends SessionKey>(key: K): SessionStorageSchema[K] {
  const [value, setValue] = useState<SessionStorageSchema[K]>(() => sessionDefault(key));

  useEffect(() => {
    let cancelled = false;
    getSession(key).then((v) => {
      if (!cancelled) setValue(v);
    });
    const listener = (changes: Record<string, chrome.storage.StorageChange>, area: string) => {
      if (area !== 'session' || !(key in changes)) return;
      const next = changes[key].newValue;
      setValue((next === undefined ? sessionDefault(key) : next) as SessionStorageSchema[K]);
    };
    chrome.storage.onChanged.addListener(listener);
    return () => {
      cancelled = true;
      chrome.storage.onChanged.removeListener(listener);
    };
  }, [key]);

  return value;
}
