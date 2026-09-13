type Handler<Msg extends { type: string }, ResMap extends Record<Msg['type'], unknown>> = {
  [K in Msg['type']]: (message: Extract<Msg, { type: K }>, sender: chrome.runtime.MessageSender) => Promise<ResMap[K]> | ResMap[K];
};

export function registerMessageHandlers<Msg extends { type: string }, ResMap extends Record<Msg['type'], unknown>>(
  handlers: Handler<Msg, ResMap>,
): void {
  chrome.runtime.onMessage.addListener((message: Msg, sender, sendResponse) => {
    const handler = handlers[message?.type as Msg['type']];
    if (!handler) return false;
    Promise.resolve(handler(message as never, sender))
      .then(sendResponse)
      .catch((err) => sendResponse({ ok: false, error: String(err), code: 'UNKNOWN' }));
    return true;
  });
}
