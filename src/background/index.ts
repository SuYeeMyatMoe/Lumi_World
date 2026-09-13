import { registerMessageHandlers } from '../shared/messaging/onMessage';
import { sendTabMessage } from '../shared/messaging/sendMessage';
import { getLocal, setLocal, updateLocal } from '../shared/storage/storage';
import type { RuntimeMessage, RuntimeResponseMap } from '../shared/types/messages';
import type { LumiFocusSnapshot } from '../shared/types/lumiFocus';
import type { CompareResult } from '../shared/types/compare';
import type { LumiPreview } from '../shared/types/lumiPreview';
import type { Mandate, Mission } from '../shared/types/mission';
import { LUMI_MEMORY_CAP } from '../shared/types/lumiMemory';
import { LUMI_VOICE, uid } from '../shared/constants';
import { callTool } from './openaiClient';
import { compareResultSchema, formFillSchema, mandateSchema, scoreResultSchema } from './toolSchemas';
import { flashSuccess, setAgentState, setFocusPos, settleToIdle } from './agentState';
import { createAction, findAction, updateActionStatus } from './actionLog';
import { checkMandate } from '../shared/riskClassifier';
import { parseAmountLoose, parsePrice } from '../shared/dom/price';
import { showOverlay } from '../shared/overlayVisibility';

// Content scripts are "untrusted contexts" for storage.session; grant access so the
// mini mascot can read liveAgentState without round-tripping through messaging.
chrome.storage.session.setAccessLevel({ accessLevel: 'TRUSTED_AND_UNTRUSTED_CONTEXTS' }).catch(() => {});

// Recover from the old global overlayVisible flag, which hid Lumi on every site.
void chrome.storage.local.remove('overlayVisible');

chrome.runtime.onInstalled.addListener(() => {
  chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch(() => {});
});
chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch(() => {});

function describeObject(o: LumiFocusSnapshot, tag: string): string {
  return [
    `[${tag}] ${o.extracted.label ?? o.tagName}`,
    o.extracted.price ? `Price: ${o.extracted.price}` : null,
    `Source: ${o.tabTitle} (${o.tabUrl})`,
    `Content: ${o.text}`,
  ]
    .filter(Boolean)
    .join('\n');
}

function describeMandate(mandate: Mandate | undefined): string | null {
  if (!mandate) return null;
  const parts: string[] = [];
  if (mandate.mustHave.length > 0) parts.push(`must have ${mandate.mustHave.join(', ')}`);
  if (mandate.ceiling !== null) parts.push(`never above ${mandate.currency ?? ''}${mandate.ceiling}`);
  if (mandate.walkAway !== null) parts.push(`walk away above ${mandate.currency ?? ''}${mandate.walkAway}`);
  return parts.length > 0 ? `Mandate (hard limits, enforced in code): ${parts.join('; ')}` : null;
}

async function missionContext(): Promise<string> {
  const mission = await getLocal('mission');
  if (!mission?.goal) return 'Mission: (none set — judge on general usefulness and value)';
  return [`Mission: ${mission.goal}`, describeMandate(mission.mandate)].filter(Boolean).join('\n');
}

// Which remembered object is this fill actually about? Match a proposed value against a
// remembered label (either direction, so "ASUS TUF A15" matches "ASUS TUF Gaming A15"),
// then fall back to the best mission score, then to a single unambiguous memory.
function findMandateSubject(values: string[], items: LumiFocusSnapshot[]): LumiFocusSnapshot | null {
  for (const raw of values) {
    const value = raw.trim().toLowerCase();
    if (value.length < 3) continue;
    const hit = items.find((o) => {
      const label = (o.extracted.label ?? '').trim().toLowerCase();
      return label.length >= 3 && (label.includes(value) || value.includes(label));
    });
    if (hit) return hit;
  }
  const scored = items.filter((o) => o.missionScore).sort((a, b) => (b.missionScore?.score ?? 0) - (a.missionScore?.score ?? 0));
  if (scored.length > 0) return scored[0];
  return items.length === 1 ? items[0] : null;
}

async function activeTabId(): Promise<number | null> {
  const [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
  return tab?.id ?? null;
}

registerMessageHandlers<RuntimeMessage, RuntimeResponseMap>({
  async FOCUS_HOVER(msg, sender) {
    const tabId = sender.tab?.id;
    if (msg.pos && tabId !== undefined) {
      await setFocusPos({ ...msg.pos, tabId });
    } else {
      await setFocusPos(null);
    }
    return { ok: true, data: null };
  },

  async GET_TAB_ID(_msg, sender) {
    const id = sender.tab?.id;
    if (id === undefined) return { ok: false, code: 'NO_TAB', error: 'Not a tab context.' };
    return { ok: true, data: id };
  },

  async FOCUS_PINNED(msg, sender) {
    const tab = sender.tab;
    const snapshot: LumiFocusSnapshot = {
      ...msg.snapshot,
      id: uid('focus'),
      createdAt: Date.now(),
      tabId: tab?.id ?? -1,
      tabUrl: tab?.url ?? '',
      tabTitle: tab?.title ?? '',
    };
    await updateLocal('lumiMemory', (mem) => ({ items: [snapshot, ...mem.items].slice(0, LUMI_MEMORY_CAP) }));
    await createAction('read', `Remembered "${snapshot.extracted.label ?? snapshot.tagName}"`, { tabId: snapshot.tabId, targetSelector: snapshot.selector }, 'applied');
    await flashSuccess(LUMI_VOICE.remembered);
    return { ok: true, data: snapshot };
  },

  // Turns a plain-language goal into a mandate. The goal is always stored, even when the
  // model call fails, so a missing key costs the mandate but never the mission itself.
  async PARSE_MISSION(msg) {
    const goal = msg.goal.trim();
    if (!goal) return { ok: false, code: 'UNKNOWN', error: 'Set a goal first.' };

    const existing = await getLocal('mission');
    const base: Mission = {
      id: existing?.id ?? uid('mission'),
      goal,
      createdAt: existing?.createdAt ?? Date.now(),
      status: 'active',
    };

    await setAgentState('thinking', LUMI_VOICE.thinking);
    const result = await callTool({
      tool: 'parseMandate',
      schema: mandateSchema,
      userContent: `Extract the hard constraints from this mission.\n\nMission: ${goal}`,
    });

    if (!result.ok) {
      await setLocal('mission', base);
      await setAgentState('warning', result.code === 'NO_API_KEY' ? LUMI_VOICE.noKey : LUMI_VOICE.uncertain);
      setTimeout(() => settleToIdle(), 3000);
      return { ok: true, data: base };
    }

    const mandate: Mandate = {
      mustHave: result.data.mustHave,
      ceiling: result.data.ceiling ?? null,
      currency: result.data.currency ?? null,
      walkAway: result.data.walkAway ?? null,
    };
    const mission: Mission = { ...base, mandate };
    await setLocal('mission', mission);
    await flashSuccess(LUMI_VOICE.done);
    return { ok: true, data: mission };
  },

  async REQUEST_COMPARE(msg) {
    const mem = await getLocal('lumiMemory');
    const a = mem.items.find((i) => i.id === msg.objectAId);
    const b = mem.items.find((i) => i.id === msg.objectBId);
    if (!a || !b) return { ok: false, code: 'UNKNOWN', error: 'One of the selected objects is no longer in Lumi Memory.' };

    await setAgentState('thinking', LUMI_VOICE.thinking);
    const result = await callTool({
      tool: 'compareLumiFocusObjects',
      schema: compareResultSchema,
      userContent: `${await missionContext()}\n\nCompare these two objects for the mission.\n\n${describeObject(a, 'A')}\n\n${describeObject(b, 'B')}`,
    });

    if (!result.ok) {
      await setAgentState('warning', result.code === 'NO_API_KEY' ? LUMI_VOICE.noKey : LUMI_VOICE.uncertain);
      setTimeout(() => settleToIdle(), 2500);
      return result;
    }

    const compare: CompareResult = {
      id: uid('cmp'),
      createdAt: Date.now(),
      objectAId: a.id,
      objectBId: b.id,
      ...result.data,
    };
    await updateLocal('compareResults', (list) => [compare, ...list].slice(0, 20));
    await createAction('compare', `Compared "${a.extracted.label ?? 'A'}" vs "${b.extracted.label ?? 'B'}"`, {}, 'applied');
    await flashSuccess(LUMI_VOICE.done);
    return { ok: true, data: compare };
  },

  async REQUEST_SCORE(msg) {
    const mem = await getLocal('lumiMemory');
    const obj = mem.items.find((i) => i.id === msg.objectId);
    if (!obj) return { ok: false, code: 'UNKNOWN', error: 'Object not found in Lumi Memory.' };

    await setAgentState('thinking', LUMI_VOICE.thinking);
    const result = await callTool({
      tool: 'scoreMissionMatch',
      schema: scoreResultSchema,
      userContent: `${await missionContext()}\n\nScore this object.\n\n${describeObject(obj, 'OBJECT')}`,
    });

    if (!result.ok) {
      await setAgentState('warning', result.code === 'NO_API_KEY' ? LUMI_VOICE.noKey : LUMI_VOICE.uncertain);
      setTimeout(() => settleToIdle(), 2500);
      return result;
    }

    const scored: LumiFocusSnapshot = { ...obj, missionScore: result.data };
    await updateLocal('lumiMemory', (m) => ({ items: m.items.map((i) => (i.id === obj.id ? scored : i)) }));
    await flashSuccess(LUMI_VOICE.done);
    return { ok: true, data: scored };
  },

  async REQUEST_FORM_FILL() {
    const tabId = await activeTabId();
    if (tabId === null) return { ok: false, code: 'NO_TAB', error: 'No active tab.' };

    const detected = await sendTabMessage(tabId, { type: 'DETECT_FORM_FIELDS' });
    if (!detected.ok) return { ok: false, code: 'NO_TAB', error: 'Lumi is not running on this page. Reload the tab and try again.' };
    const { fields, protectedCount } = detected.data;
    if (fields.length === 0) return { ok: false, code: 'UNKNOWN', error: 'No fillable form fields found on this page.' };

    const mem = await getLocal('lumiMemory');
    const objects = mem.items.slice(0, 6).map((o, i) => describeObject(o, `MEMORY ${i + 1}`)).join('\n\n');
    const fieldList = fields.map((f) => `- selector: ${f.selector}\n  label: ${f.label}\n  kind: ${f.kind}\n  current: ${f.currentValue || '(empty)'}`).join('\n');

    await setAgentState('thinking', LUMI_VOICE.thinking);
    const result = await callTool({
      tool: 'proposeFormFill',
      schema: formFillSchema,
      userContent: `${await missionContext()}\n\nRemembered objects:\n${objects || '(none)'}\n\nForm fields on the current page:\n${fieldList}\n\nPropose values only for fields you can confidently fill from the mission or remembered objects. Use exact selectors.`,
    });

    if (!result.ok) {
      await setAgentState('warning', result.code === 'NO_API_KEY' ? LUMI_VOICE.noKey : LUMI_VOICE.uncertain);
      setTimeout(() => settleToIdle(), 2500);
      return result;
    }

    const bySelector = new Map(fields.map((f) => [f.selector, f]));
    const changes = result.data.fills
      .filter((f) => bySelector.has(f.selector) && f.value.trim().length > 0)
      .map((f) => {
        const field = bySelector.get(f.selector)!;
        return { selector: f.selector, label: field.label, currentValue: field.currentValue, proposedValue: f.value };
      });

    if (changes.length === 0) {
      await setAgentState('warning', LUMI_VOICE.uncertain);
      setTimeout(() => settleToIdle(), 2500);
      return { ok: false, code: 'UNKNOWN', error: "Lumi couldn't confidently map any remembered data to this form." };
    }

    // Mandate gate. Runs on the object the fill is about, then on every value that is
    // itself an amount. Deterministic and model-free: the refusal is a property of the code.
    const mission = await getLocal('mission');
    const subject = findMandateSubject(changes.map((c) => c.proposedValue), mem.items);
    const subjectPrice = subject ? parsePrice(subject.extracted.price) ?? parsePrice(subject.text) : null;
    const checks: { input: Parameters<typeof checkMandate>[0]; label: string }[] = [];
    if (subject) checks.push({ input: { price: subjectPrice, text: subject.text }, label: subject.extracted.label ?? 'that one' });
    for (const change of changes) {
      const amount = parseAmountLoose(change.proposedValue);
      if (amount !== null) checks.push({ input: { price: amount }, label: change.label });
    }

    for (const check of checks) {
      const verdict = checkMandate(check.input, mission);
      if (verdict.ok) continue;
      await createAction('fill-form', `Refused to fill: ${check.label}`, { tabId }, 'refused');
      await setAgentState('warning', verdict.reason || LUMI_VOICE.refused);
      setTimeout(() => settleToIdle(), 3000);
      return { ok: false, code: 'REFUSED', error: verdict.reason };
    }

    const action = await createAction('fill-form', `Fill ${changes.length} field${changes.length === 1 ? '' : 's'}`, { tabId });
    const preview: LumiPreview = {
      actionId: action.id,
      tabId,
      changes,
      rationale: result.data.rationale,
      protectedFieldCount: protectedCount,
    };
    await setLocal('pendingPreview', preview);
    await updateActionStatus(action.id, 'previewed');
    await setAgentState('warning', LUMI_VOICE.needsApproval);
    return { ok: true, data: preview };
  },

  // Stub — filled in by the Negotiation layer (CLAUDE.md 4.3).
  async REQUEST_OFFER() {
    return { ok: false, code: 'UNKNOWN', error: 'not implemented' };
  },

  async REQUEST_HIGH_RISK_DEMO() {
    const tabId = await activeTabId();
    const action = await createAction('submit', 'Submit this form', { tabId: tabId ?? undefined });
    const preview: LumiPreview = {
      actionId: action.id,
      tabId: tabId ?? -1,
      changes: [],
      rationale: 'Submitting sends the form to the site. This cannot be undone by Lumi.',
      protectedFieldCount: 0,
    };
    await setLocal('pendingPreview', preview);
    await updateActionStatus(action.id, 'previewed');
    await setAgentState('warning', LUMI_VOICE.needsApproval);
    return { ok: true, data: action };
  },

  async APPLY_ACTION(msg) {
    const action = await findAction(msg.actionId);
    if (!action) return { ok: false, code: 'UNKNOWN', error: 'Action not found.' };
    const preview = await getLocal('pendingPreview');

    if (action.type === 'fill-form' && preview?.actionId === action.id) {
      const applied = await sendTabMessage(preview.tabId, {
        type: 'APPLY_FIELD_VALUES',
        changes: preview.changes.map((c) => ({ selector: c.selector, value: c.proposedValue })),
      });
      if (!applied.ok) {
        await setLocal('pendingPreview', null);
        await settleToIdle();
        return { ok: false, code: 'NO_TAB', error: 'Could not reach the page to apply changes. Is the tab still open?' };
      }
    }
    // High-risk demo actions (submit) are intentionally NOT executed against the page;
    // the gate itself is the deliverable. Only the approval is recorded.

    await setLocal('pendingPreview', null);
    const updated = (await updateActionStatus(action.id, 'applied')) ?? action;
    await flashSuccess(LUMI_VOICE.done);
    return { ok: true, data: updated };
  },

  async REJECT_ACTION(msg) {
    const updated = await updateActionStatus(msg.actionId, 'rejected');
    await setLocal('pendingPreview', null);
    await settleToIdle();
    if (!updated) return { ok: false, code: 'UNKNOWN', error: 'Action not found.' };
    return { ok: true, data: updated };
  },

  async SET_AGENT_STATE(msg) {
    await setAgentState(msg.state, msg.message);
    return { ok: true, data: null };
  },

  async OPEN_SIDE_PANEL(_msg, sender) {
    const url = sender.tab?.url;
    if (url) {
      try {
        await showOverlay(new URL(url).origin);
      } catch {
        /* chrome:// and other non-http tabs */
      }
    }
    const windowId = sender.tab?.windowId;
    if (windowId !== undefined) {
      await chrome.sidePanel.open({ windowId }).catch(() => {});
    }
    return { ok: true, data: null };
  },

  async REMOVE_MEMORY_ITEM(msg) {
    await updateLocal('lumiMemory', (m) => ({ items: m.items.filter((i) => i.id !== msg.id) }));
    return { ok: true, data: null };
  },

  async CLEAR_MEMORY() {
    await setLocal('lumiMemory', { items: [] });
    await setLocal('compareResults', []);
    return { ok: true, data: null };
  },
});

// Clear stale focus when the user leaves a tab so the mascot settles.
chrome.tabs.onActivated.addListener(() => {
  setFocusPos(null).catch(() => {});
});
