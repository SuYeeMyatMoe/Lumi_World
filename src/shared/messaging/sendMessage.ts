import type { RuntimeMessage, RuntimeResponseMap, TabMessage, TabResponseMap } from '../types/messages';

export function sendMessage<M extends RuntimeMessage>(message: M): Promise<RuntimeResponseMap[M['type']]> {
  return new Promise((resolve) => {
    try {
      chrome.runtime.sendMessage(message, (response) => {
        if (chrome.runtime.lastError) {
          resolve({ ok: false, error: chrome.runtime.lastError.message ?? 'Messaging error', code: 'UNKNOWN' } as RuntimeResponseMap[M['type']]);
          return;
        }
        resolve(response as RuntimeResponseMap[M['type']]);
      });
    } catch (err) {
      resolve({ ok: false, error: String(err), code: 'UNKNOWN' } as RuntimeResponseMap[M['type']]);
    }
  });
}

export function sendTabMessage<M extends TabMessage>(tabId: number, message: M): Promise<TabResponseMap[M['type']]> {
  return new Promise((resolve) => {
    try {
      chrome.tabs.sendMessage(tabId, message, (response) => {
        if (chrome.runtime.lastError) {
          resolve({ ok: false, error: chrome.runtime.lastError.message ?? 'Tab messaging error', code: 'NO_TAB' } as TabResponseMap[M['type']]);
          return;
        }
        resolve(response as TabResponseMap[M['type']]);
      });
    } catch (err) {
      resolve({ ok: false, error: String(err), code: 'NO_TAB' } as TabResponseMap[M['type']]);
    }
  });
}
