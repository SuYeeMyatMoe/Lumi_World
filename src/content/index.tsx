import { createRoot } from 'react-dom/client';
import { ContentApp } from './ContentApp';
import overlayCss from './overlay.css?inline';
import { getLocal } from '../shared/storage/storage';
import { registerMessageHandlers } from '../shared/messaging/onMessage';
import type { TabMessage, TabResponseMap } from '../shared/types/messages';
import { applyFieldValue, detectFormFields } from '../shared/dom/formFieldDetector';
import { resolveSelector } from '../shared/dom/selector';
import { LUMI_HIGHLIGHT_EVENT } from './events';

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
  // Stub — filled in by the Execution layer (CLAUDE.md 4.2).
  SUBMIT_FORM() {
    return { ok: false, code: 'UNKNOWN', error: 'not implemented' };
  },
  // Stubs — filled in by the Negotiation layer (CLAUDE.md 4.3).
  READ_CHAT() {
    return { ok: false, code: 'UNKNOWN', error: 'not implemented' };
  },
  CLICK_SELECTOR() {
    return { ok: false, code: 'UNKNOWN', error: 'not implemented' };
  },
  HIGHLIGHT_SELECTOR(msg) {
    const el = msg.selector ? resolveSelector(msg.selector) : null;
    el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    window.dispatchEvent(new CustomEvent(LUMI_HIGHLIGHT_EVENT, { detail: el }));
    return { ok: true, data: null };
  },
});

async function mount() {
  if (window.top !== window) return; // main frame only
  if (document.getElementById(HOST_ID)) return;

  const settings = await getLocal('lumiSettings');
  if (settings.disabledOrigins.includes(location.origin)) return;

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
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => void mount(), { once: true });
} else {
  void mount();
}
