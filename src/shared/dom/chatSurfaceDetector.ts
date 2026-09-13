import { parseLastPrice } from './price';
import { buildSelector } from './selector';
import { isSensitiveField } from './sensitiveFieldGuard';

export interface ChatSurface {
  /** Container holding the message history. */
  listSelector: string;
  /** Matches the counterpart's individual messages inside the list. */
  messageSelector: string;
  /** Where Lumi's drafted offer is written (APPLY_FIELD_VALUES target). */
  inputSelector: string;
  /** Button that sends the drafted offer (CLICK_SELECTOR target). */
  sendSelector: string;
}

// The demo store's scripted seller widget. Kept as literals so the recorded run
// never depends on the heuristic below.
const DEMO_ROOT = '#seller-chat';
const DEMO_SURFACE: ChatSurface = {
  listSelector: '#seller-chat .messages',
  messageSelector: '#seller-chat li.msg.seller',
  inputSelector: '#seller-chat textarea[name="offerMessage"]',
  sendSelector: '#seller-send',
};

const INPUT_HINT = /message|offer|chat|reply/i;
const SEND_HINT = /send|reply/i;
const LIST_HINT = '[role="log"], .messages';
const MAX_WALK = 6;

/**
 * Finds the chat surface Lumi can negotiate in: fixed selectors on the demo store,
 * otherwise a heuristic pass over any page that looks like it has a chat box.
 * Returns null when nothing on the page qualifies — callers must handle that.
 */
export function resolveChatSurface(root: ParentNode = document): ChatSurface | null {
  // Guarded fixed path: only trust the literals if the widget's input is actually there,
  // so a renamed field falls through to the heuristic instead of returning dead selectors.
  const demoRoot = query(root, DEMO_ROOT);
  if (demoRoot && query(root, DEMO_SURFACE.inputSelector)) return DEMO_SURFACE;

  for (const input of chatInputCandidates(root)) {
    const list = findMessageList(input);
    if (!list) continue;
    const send = findSendButton(input, list);
    if (!send) continue;
    return {
      listSelector: buildSelector(list),
      messageSelector: messageSelectorFor(list),
      inputSelector: buildSelector(input),
      sendSelector: buildSelector(send),
    };
  }
  return null;
}

/** Last price mentioned in a chat transcript — the counterpart's standing counter. */
export function lastCounterpartPrice(transcriptText: string): number | null {
  return parseLastPrice(transcriptText);
}

function chatInputCandidates(root: ParentNode): HTMLElement[] {
  const nodes = Array.from(
    root.querySelectorAll<HTMLElement>('textarea, [contenteditable=""], [contenteditable="true"]'),
  );
  return nodes.filter((el) => {
    if (isSensitiveField(el)) return false;
    if (el instanceof HTMLTextAreaElement && (el.disabled || el.readOnly)) return false;
    if (!isVisible(el)) return false;
    const haystack = [
      el.getAttribute('placeholder'),
      el.getAttribute('data-placeholder'),
      el.getAttribute('aria-label'),
      el.getAttribute('name'),
    ]
      .filter(Boolean)
      .join(' ');
    return INPUT_HINT.test(haystack);
  });
}

// A message list is an ancestor of the input, or a sibling/descendant within a few
// levels up — the usual "history above, composer below" layout.
function findMessageList(input: HTMLElement): Element | null {
  let scope: Element | null = input.parentElement;
  for (let depth = 0; depth < MAX_WALK && scope && scope !== document.body; depth++) {
    if (isMessageList(scope) && !scope.contains(input)) return scope;
    for (const candidate of Array.from(scope.querySelectorAll(`${LIST_HINT}, ul, ol`))) {
      if (candidate.contains(input)) continue;
      if (isMessageList(candidate)) return candidate;
    }
    scope = scope.parentElement;
  }
  return null;
}

function isMessageList(el: Element): boolean {
  if (el.matches(LIST_HINT)) return true;
  if (el.tagName === 'UL' || el.tagName === 'OL') {
    return Array.from(el.children).filter((c) => c.tagName === 'LI').length >= 3;
  }
  return false;
}

function messageSelectorFor(list: Element): string {
  const base = buildSelector(list);
  const hasListItems = Array.from(list.children).some((c) => c.tagName === 'LI');
  return hasListItems ? `${base} > li` : `${base} > *`;
}

function findSendButton(input: HTMLElement, list: Element): Element | null {
  let scope: Element | null = input.parentElement;
  for (let depth = 0; depth < MAX_WALK && scope && scope !== document.body; depth++) {
    const buttons = Array.from(scope.querySelectorAll('button, [role="button"], input[type="submit"]'));
    const match = buttons.find((b) => !list.contains(b) && SEND_HINT.test(buttonText(b)));
    if (match) return match;
    scope = scope.parentElement;
  }
  return null;
}

function buttonText(el: Element): string {
  const value = el instanceof HTMLInputElement ? el.value : '';
  const text = (el as HTMLElement).innerText ?? el.textContent ?? '';
  return [text, value, el.getAttribute('aria-label'), el.getAttribute('title')].filter(Boolean).join(' ');
}

function query(root: ParentNode, selector: string): Element | null {
  try {
    return root.querySelector(selector);
  } catch {
    return null;
  }
}

function isVisible(el: HTMLElement): boolean {
  const rect = el.getBoundingClientRect();
  if (rect.width === 0 || rect.height === 0) return false;
  const style = getComputedStyle(el);
  return style.visibility !== 'hidden' && style.display !== 'none';
}
