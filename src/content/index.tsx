import { createRoot } from 'react-dom/client';
import { ContentApp } from './ContentApp';
import overlayCss from './overlay.css?inline';
import { getLocal } from '../shared/storage/storage';
import { registerMessageHandlers } from '../shared/messaging/onMessage';
import type { TabMessage, TabResponseMap } from '../shared/types/messages';
import { applyFieldValue, detectFormFields } from '../shared/dom/formFieldDetector';
import { resolveSelector } from '../shared/dom/selector';
import { resolveChatSurface } from '../shared/dom/chatSurfaceDetector';
import { LUMI_HIGHLIGHT_EVENT } from './events';
import { readPageContext } from './pageContext';
import { pinSelector } from './pinSelector';

const HOST_ID = 'lumi-world-host';

registerMessageHandlers<TabMessage, TabResponseMap>({
  DETECT_FORM_FIELDS() {
    const { fields, protectedCount } = detectFormFields();
    return { ok: true, data: { fields, protectedCount } };
  },
  APPLY_FIELD_VALUES(msg) {
    let applied = 0;
    for (const change of msg.changes) {
      if (applyFieldValue(change.selector, change.value)) applied += 1;
    }
    return { ok: true, data: { applied } };
  },
  // The last step of an approved high-risk action. requestSubmit() rather than submit()
  // so the page's own validation and submit handler still run, exactly as a click would.
  SUBMIT_FORM(msg) {
    const el = resolveSelector(msg.selector);
    const form = el instanceof HTMLFormElement ? el : (el?.closest('form') ?? null);
    if (!form) return { ok: false, code: 'UNKNOWN', error: 'Could not find that form on the page.' };
    form.requestSubmit();
    return { ok: true, data: { submitted: true } };
  },
  // Reads only the counterpart's messages, so the last price in the transcript is the
  // seller's standing counter and never something Lumi said herself.
  READ_CHAT(msg) {
    const surface = resolveChatSurface();
    if (!surface) return { ok: false, code: 'UNKNOWN', error: 'No chat to negotiate in on this page.' };
    const selector = msg.selector || surface.messageSelector;
    let nodes: Element[] = [];
    try {
      nodes = Array.from(document.querySelectorAll(selector));
    } catch {
      return { ok: false, code: 'UNKNOWN', error: 'That chat selector is not valid.' };
    }
    const transcript = nodes
      .map((n) => ((n as HTMLElement).innerText ?? n.textContent ?? '').replace(/\s+/g, ' ').trim())
      .filter(Boolean)
      .join('\n');
    return { ok: true, data: { transcript, inputSelector: surface.inputSelector, sendSelector: surface.sendSelector } };
  },
  CLICK_SELECTOR(msg) {
    const el = resolveSelector(msg.selector);
    if (!(el instanceof HTMLElement)) return { ok: false, code: 'UNKNOWN', error: 'Nothing on the page matches that selector.' };
    el.click();
    return { ok: true, data: { clicked: true } };
  },
  HIGHLIGHT_SELECTOR(msg) {
    const el = msg.selector ? resolveSelector(msg.selector) : null;
    el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    window.dispatchEvent(new CustomEvent(LUMI_HIGHLIGHT_EVENT, { detail: el }));
    return { ok: true, data: null };
  },
  READ_PAGE_CONTEXT: () => ({ ok: true as const, data: readPageContext() }),
  PIN_SELECTOR: (msg) => pinSelector(msg.selector),
});

async function mount() {
  try {
    if (window.top !== window) return; // main frame only
    const existing = document.getElementById(HOST_ID);
    if (existing) {
      const alive = existing.shadowRoot?.querySelector('.lumi-widget, .lumi-reopen');
      if (alive) return;
      existing.remove();
    }

    let disabled = false;
    try {
      const settings = await getLocal('lumiSettings');
      disabled = Boolean(settings.disabledOrigins?.includes(location.origin));
    } catch {
      /* storage can be briefly unavailable after a reload — still show Lumi */
    }
    if (disabled) return;

    const host = document.createElement('div');
    host.id = HOST_ID;
    host.style.position = 'fixed';
    host.style.inset = '0';
    host.style.zIndex = '2147483647';
    host.style.pointerEvents = 'none';
    const shadow = host.attachShadow({ mode: 'open' });

    const style = document.createElement('style');
    style.textContent = overlayCss;
    shadow.appendChild(style);

    const mountPoint = document.createElement('div');
    shadow.appendChild(mountPoint);
    document.documentElement.appendChild(host);

    createRoot(mountPoint).render(<ContentApp shadowHost={host} />);
  } catch (error) {
    console.error('[lumi] overlay failed to mount', error);
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => void mount(), { once: true });
} else {
  void mount();
}
