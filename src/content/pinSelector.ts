import { createSnapshot } from '../shared/dom/elementSnapshot';
import { resolveSelector } from '../shared/dom/selector';
import { sendMessage } from '../shared/messaging/sendMessage';
import type { LumiResult } from '../shared/types/messages';
import type { LumiFocusSnapshot } from '../shared/types/lumiFocus';

// Remembers one element the orchestrator points at, as if the user had Alt+clicked it.
//
// The FOCUS_PINNED round-trip is made from here rather than from the side panel on
// purpose: the background reads tabId, tabUrl and tabTitle off sender.tab, and a message
// sent from the panel has no sender.tab at all — the memory item would land with no
// source. Sending it from the page keeps the provenance, and the stored snapshot (with
// its id) comes back for the caller to score and compare.
export async function pinSelector(selector: string): Promise<LumiResult<LumiFocusSnapshot>> {
  const el = resolveSelector(selector);
  if (!el) return { ok: false, code: 'UNKNOWN', error: 'That element is no longer on the page.' };

  const snapshot = createSnapshot(el);
  // createSnapshot refuses sensitive fields; nothing else is a reason to fail here.
  if (!snapshot) return { ok: false, code: 'UNKNOWN', error: 'Lumi will not remember that element.' };

  return sendMessage({ type: 'FOCUS_PINNED', snapshot });
}
