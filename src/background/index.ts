import { registerMessageHandlers } from '../shared/messaging/onMessage';
import { sendTabMessage } from '../shared/messaging/sendMessage';
import { getLocal, setLocal, updateLocal } from '../shared/storage/storage';
import type { RuntimeMessage, RuntimeResponseMap } from '../shared/types/messages';
import type { LumiFocusSnapshot } from '../shared/types/lumiFocus';
import type { CompareResult } from '../shared/types/compare';
import type { AgentAction } from '../shared/types/agentAction';
import type { LumiPreview } from '../shared/types/lumiPreview';
import type { Mandate, Mission } from '../shared/types/mission';
import { LUMI_MEMORY_CAP } from '../shared/types/lumiMemory';
import { LUMI_VOICE, uid } from '../shared/constants';
import { callTool } from './openaiClient';
import { compareResultSchema, formFillSchema, mandateSchema, offerSchema, scoreResultSchema } from './toolSchemas';
import { flashSuccess, setAgentState, setFocusPos, settleToIdle } from './agentState';
import { createAction, findAction, mergeActionPayload, updateActionStatus } from './actionLog';
import { checkMandate } from '../shared/riskClassifier';
import { parseAmountLoose, parseLastPrice, parsePrice } from '../shared/dom/price';
import { lastCounterpartPrice } from '../shared/dom/chatSurfaceDetector';
import { showOverlay } from '../shared/overlayVisibility';
import { suggestMissions } from './handlers/suggestMissions';

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

// The tighter of ceiling and walk-away is the number that actually binds.
function bindingLimit(mission: Mission | null): number | null {
  const m = mission?.mandate;
  if (!m) return null;
  if (m.ceiling !== null && m.walkAway !== null) return Math.min(m.ceiling, m.walkAway);
  return m.walkAway ?? m.ceiling;
}

function money(value: number, currency: string | null | undefined): string {
  return `${currency ?? 'RM'}${value.toLocaleString('en-US')}`;
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

// After an offer is sent, read the seller's reply and write the outcome the fallback
// layer watches: agreed when the standing price is within the mandate, walked-away when
// the seller's own final number stays above it.
async function recordNegotiationOutcome(tabId: number, action: AgentAction): Promise<void> {
  const objectId = typeof action.payload?.objectId === 'string' ? action.payload.objectId : '';
  if (!objectId) return;
  await new Promise((resolve) => setTimeout(resolve, 400));
  const after = await sendTabMessage(tabId, { type: 'READ_CHAT', selector: '' });
  if (!after.ok) return;

  const mission = await getLocal('mission');
  const limit = bindingLimit(mission);
  const price = lastCounterpartPrice(after.data.transcript);
  const accepted = /\b(deal|agreed|accept)/i.test(after.data.transcript);

  if (price === null) return;
  const withinMandate = limit === null || price <= limit;

  if (accepted && withinMandate) {
    await setLocal('negotiationOutcome', { objectId, outcome: 'agreed', agreedPrice: price, ceiling: limit, updatedAt: Date.now() });
    return;
  }
  if (!withinMandate) {
    await setLocal('negotiationOutcome', { objectId, outcome: 'walked-away', ceiling: limit, updatedAt: Date.now() });
  }
}

async function tabOrigin(tabId: number): Promise<string | null> {
  try {
    const tab = await chrome.tabs.get(tabId);
    return tab.url ? new URL(tab.url).origin : null;
  } catch {
    return null;
  }
}

// Whether an approved high-risk action may actually touch this page. Deterministic and
// origin-based: the demo store executes, every other site records the approval only.
async function mayExecuteHighRisk(tabId: number | undefined): Promise<{ allowed: boolean; origin: string | null }> {
  if (tabId === undefined) return { allowed: false, origin: null };
  const settings = await getLocal('lumiSettings');
  const origin = await tabOrigin(tabId);
  return { allowed: origin !== null && settings.executeHighRiskOrigins.includes(origin), origin };
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

  // Drafts the next message in a negotiation. The seller's standing counter is checked
  // against the mandate in code first: if it is already above the limit Lumi refuses
  // without calling the model at all, so the refusal cannot be talked out of.
  async REQUEST_OFFER(msg) {
    const tabId = await activeTabId();
    if (tabId === null) return { ok: false, code: 'NO_TAB', error: 'No active tab.' };

    const mem = await getLocal('lumiMemory');
    const obj = mem.items.find((i) => i.id === msg.objectId);
    if (!obj) return { ok: false, code: 'UNKNOWN', error: 'That object is no longer in Lumi Memory.' };

    const chat = await sendTabMessage(tabId, { type: 'READ_CHAT', selector: '' });
    if (!chat.ok) return chat;
    const { transcript, inputSelector, sendSelector } = chat.data;

    const mission = await getLocal('mission');
    const limit = bindingLimit(mission);
    const currency = mission?.mandate?.currency ?? null;

    // An opening asking price above the mandate is not a refusal — it is the reason to
    // negotiate. A COUNTER above the mandate is refused: Lumi says so, and either stops
    // (the seller called it final, so there is nothing left to win) or counters at the
    // limit. Turn counting is what separates "their first ask" from "their answer to us".
    const sellerTurns = transcript.split('\n').filter((line) => line.trim().length > 0).length;
    const lastSellerLine = transcript.split('\n').filter(Boolean).pop() ?? '';
    const counter = lastCounterpartPrice(transcript);
    let refusalNote: string | null = null;

    if (counter !== null && sellerTurns >= 2) {
      const verdict = checkMandate({ price: counter }, mission);
      if (!verdict.ok) {
        refusalNote = verdict.reason;
        await createAction('send-offer', `Refused to meet ${money(counter, currency)}`, { tabId, targetSelector: inputSelector }, 'refused');
        await setAgentState('warning', verdict.reason);
        if (/\bfinal\b|\blast (?:price|offer)\b|best i can/i.test(lastSellerLine)) {
          await setLocal('negotiationOutcome', { objectId: obj.id, outcome: 'walked-away', ceiling: limit, updatedAt: Date.now() });
          setTimeout(() => settleToIdle(), 6000);
          return { ok: false, code: 'REFUSED', error: verdict.reason };
        }
      }
    }

    await setAgentState('thinking', LUMI_VOICE.thinking);
    const result = await callTool({
      tool: 'proposeOffer',
      schema: offerSchema,
      userContent: [
        await missionContext(),
        '',
        `You are negotiating for: ${describeObject(obj, 'TARGET')}`,
        '',
        `Seller's messages so far:\n${transcript || '(no messages yet)'}`,
        '',
        limit !== null ? `Hard limit: never offer more than ${limit}.` : 'No budget limit was stated.',
        'Propose the next offer.',
      ].join('\n'),
    });

    if (!result.ok) {
      await setAgentState('warning', result.code === 'NO_API_KEY' ? LUMI_VOICE.noKey : LUMI_VOICE.uncertain);
      setTimeout(() => settleToIdle(), 2500);
      return result;
    }

    // Clamp in code. The model is a drafter, not the thing that decides the number.
    const amount = limit !== null ? Math.min(result.data.amount, limit) : result.data.amount;
    const stated = parseLastPrice(result.data.message);
    const text = stated === amount ? result.data.message : `Could you do ${money(amount, currency)}?`;

    const action = await createAction('send-offer', `Offer ${money(amount, currency)}`, {
      tabId,
      targetSelector: inputSelector,
      payload: { amount, sendSelector, objectId: obj.id },
    });
    const preview: LumiPreview = {
      actionId: action.id,
      tabId,
      changes: [{ selector: inputSelector, label: 'Message to seller', currentValue: '', proposedValue: text }],
      rationale: refusalNote ? `${refusalNote} Countering at my limit instead.` : result.data.rationale,
      protectedFieldCount: 0,
    };
    await setLocal('pendingPreview', preview);
    await updateActionStatus(action.id, 'previewed');
    // Keep the refusal on screen when there was one: it is the point being made.
    await setAgentState('warning', refusalNote ?? LUMI_VOICE.needsApproval);
    return { ok: true, data: preview };
  },

  async REQUEST_SUBMIT() {
    const tabId = await activeTabId();
    if (tabId === null) return { ok: false, code: 'NO_TAB', error: 'No active tab.' };

    // The form the user can actually see filled in: the one owning the most fields.
    const detected = await sendTabMessage(tabId, { type: 'DETECT_FORM_FIELDS' });
    if (!detected.ok) return { ok: false, code: 'NO_TAB', error: 'Lumi is not running on this page. Reload the tab and try again.' };
    const counts = new Map<string, number>();
    for (const f of detected.data.fields) {
      if (f.formSelector) counts.set(f.formSelector, (counts.get(f.formSelector) ?? 0) + 1);
    }
    const formSelector = [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
    if (!formSelector) return { ok: false, code: 'UNKNOWN', error: 'No form on this page to submit.' };

    const { allowed, origin } = await mayExecuteHighRisk(tabId);
    const action = await createAction('submit', 'Submit this form', {
      tabId,
      targetSelector: formSelector,
      payload: { formSelector, origin },
    });
    const preview: LumiPreview = {
      actionId: action.id,
      tabId,
      changes: [],
      rationale: allowed
        ? 'Submitting sends the form to the site. This cannot be undone by Lumi.'
        : `Submitting sends the form to the site. On ${origin ?? 'this origin'} Lumi will record your approval but not execute it.`,
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
    // An approved offer is typed into the composer and then sent, and the seller's
    // reply is read back so the outcome is recorded for the fallback layer.
    if (action.type === 'send-offer' && preview?.actionId === action.id) {
      const applied = await sendTabMessage(preview.tabId, {
        type: 'APPLY_FIELD_VALUES',
        changes: preview.changes.map((c) => ({ selector: c.selector, value: c.proposedValue })),
      });
      if (!applied.ok) {
        await setLocal('pendingPreview', null);
        await settleToIdle();
        return { ok: false, code: 'NO_TAB', error: 'Could not reach the chat to send the offer.' };
      }
      const sendSelector = typeof action.payload?.sendSelector === 'string' ? action.payload.sendSelector : '';
      if (sendSelector) await sendTabMessage(preview.tabId, { type: 'CLICK_SELECTOR', selector: sendSelector });
      await recordNegotiationOutcome(preview.tabId, action);
    }

    // A submit executes only where the settings allow it. Everywhere else the approval is
    // recorded and the page is left alone — the gate, not the click, is the deliverable.
    if (action.type === 'submit') {
      const { allowed, origin } = await mayExecuteHighRisk(action.tabId);
      const formSelector = typeof action.payload?.formSelector === 'string' ? action.payload.formSelector : '';
      if (allowed && action.tabId !== undefined && formSelector) {
        const submitted = await sendTabMessage(action.tabId, { type: 'SUBMIT_FORM', selector: formSelector });
        if (!submitted.ok || !submitted.data.submitted) {
          await setLocal('pendingPreview', null);
          await settleToIdle();
          return { ok: false, code: 'NO_TAB', error: 'Could not reach the page to submit. Is the tab still open?' };
        }
      }
      await mergeActionPayload(action.id, { executed: allowed, origin });
    }

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

  // The user gesture behind this message survives only until the first await, so
  // sidePanel.open() has to be started before anything else — otherwise Chrome rejects
  // it with "may only be called in response to a user gesture". Start it first, settle
  // it last, and surface the failure instead of swallowing it.
  async OPEN_SIDE_PANEL(_msg, sender) {
    const tabId = sender.tab?.id;
    const windowId = sender.tab?.windowId;
    if (tabId === undefined && windowId === undefined) {
      return { ok: false, code: 'NO_TAB', error: 'No tab to open Lumi in.' };
    }
    // Opening for the calling tab is the form that reliably keeps the click's user
    // activation; windowId is only a fallback for senders without a tab id.
    const opening = tabId !== undefined ? chrome.sidePanel.open({ tabId }) : chrome.sidePanel.open({ windowId: windowId! });

    const url = sender.tab?.url;
    if (url) {
      try {
        await showOverlay(new URL(url).origin);
      } catch {
        /* chrome:// and other non-http tabs */
      }
    }

    try {
      await opening;
    } catch (err) {
      // Surfaced into the mascot bubble as well as the worker console: a silent failure
      // here is what made this bug take so long to find.
      const detail = err instanceof Error ? err.message : String(err);
      console.warn('[Lumi] sidePanel.open failed:', detail);
      await setAgentState('warning', `Lumi Space blocked: ${detail}`);
      setTimeout(() => settleToIdle(), 8000);
      return { ok: false, code: 'UNKNOWN', error: detail };
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

  SUGGEST_MISSIONS: () => suggestMissions(),
});

// Clear stale focus when the user leaves a tab so the mascot settles.
chrome.tabs.onActivated.addListener(() => {
  setFocusPos(null).catch(() => {});
});
