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
import { flashSuccess, setAgentState, setFocusPos, settleToIdle, startSettleWatchdog } from './agentState';
import { createAction, findAction, mergeActionPayload, updateActionStatus } from './actionLog';
import { checkMandate } from '../shared/riskClassifier';
import { parseAmountLoose, parseLastPrice, parsePrice } from '../shared/dom/price';
import { lastCounterpartPrice } from '../shared/dom/chatSurfaceDetector';
import { showOverlay } from '../shared/overlayVisibility';
import { suggestMissions } from './handlers/suggestMissions';

// Content scripts are "untrusted contexts" for storage.session; grant access so the
// mini mascot can read liveAgentState without round-tripping through messaging.
chrome.storage.session.setAccessLevel({ accessLevel: 'TRUSTED_AND_UNTRUSTED_CONTEXTS' }).catch(() => {});

// Nothing may sit in a held state once there is nothing to hold it for.
startSettleWatchdog();

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

const MAX_NEGOTIATION_TURNS = 6;
const NEGOTIATION_PAUSE_MS = 1500;

function round50(value: number): number {
  return Math.round(value / 50) * 50;
}

// Counters must move and must never repeat. Step halfway from our last offer towards
// the lower of their price and our ceiling, rounded to something a human would say.
function nextCounter(lastOffer: number | null, sellerPrice: number, limit: number, offered: Set<number>): number {
  const target = Math.min(sellerPrice, limit);
  const base = lastOffer === null ? target : (lastOffer + target) / 2;
  let amount = Math.min(limit, round50(base));
  while (offered.has(amount) && amount > 50) amount -= 50;
  return Math.min(limit, Math.max(amount, 0));
}

// Types a message into the chat composer and sends it.
async function sayInChat(tabId: number, inputSelector: string, sendSelector: string, text: string): Promise<boolean> {
  const applied = await sendTabMessage(tabId, { type: 'APPLY_FIELD_VALUES', changes: [{ selector: inputSelector, value: text }] });
  if (!applied.ok || applied.data.applied === 0) return false;
  if (!sendSelector) return false;
  const clicked = await sendTabMessage(tabId, { type: 'CLICK_SELECTOR', selector: sendSelector });
  return clicked.ok;
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

  // Negotiates on its own inside the mandate. Offers at or below the ceiling are sent
  // without asking, because the ceiling is the permission. The human is asked exactly
  // once, at the moment of agreeing to pay.
  async REQUEST_OFFER(msg) {
    const tabId = await activeTabId();
    if (tabId === null) return { ok: false, code: 'NO_TAB', error: 'No active tab.' };

    const mem = await getLocal('lumiMemory');
    const obj = mem.items.find((i) => i.id === msg.objectId);
    if (!obj) return { ok: false, code: 'UNKNOWN', error: 'That object is no longer in Lumi Memory.' };

    const mission = await getLocal('mission');
    const limit = bindingLimit(mission);
    const currency = mission?.mandate?.currency ?? null;
    if (limit === null) {
      return { ok: false, code: 'UNKNOWN', error: 'Set a mission with a ceiling before I negotiate.' };
    }
    const cash = (value: number) => money(value, currency);

    const offered = new Set<number>();
    let lastOffer: number | null = null;
    let refusals = 0;

    for (let turn = 1; turn <= MAX_NEGOTIATION_TURNS; turn++) {
      const chat = await sendTabMessage(tabId, { type: 'READ_CHAT', selector: '' });
      if (!chat.ok) return chat;
      const { transcript, inputSelector, sendSelector } = chat.data;
      const lines = transcript.split('\n').filter((l) => l.trim().length > 0);
      const sellerPrice = lastCounterpartPrice(transcript);
      // One line means they have only stated an asking price. That is the reason to
      // negotiate, not something to accept or refuse.
      const hasAnswered = lines.length >= 2;

      await setAgentState('thinking', LUMI_VOICE.thinking);

      // 1. Their price is inside the mandate. This is the single approval.
      if (sellerPrice !== null && sellerPrice <= limit && hasAnswered) {
        const action = await createAction('accept-deal', `Accept at ${cash(sellerPrice)}`, {
          tabId,
          targetSelector: inputSelector,
          payload: { amount: sellerPrice, inputSelector, sendSelector, objectId: obj.id },
        });
        const preview: LumiPreview = {
          actionId: action.id,
          tabId,
          changes: [{ selector: inputSelector, label: 'Message to seller', currentValue: '', proposedValue: `${cash(sellerPrice)} works — deal.` }],
          rationale: `Send this and close the deal at ${cash(sellerPrice)}?`,
          protectedFieldCount: 0,
        };
        await setLocal('pendingPreview', preview);
        await updateActionStatus(action.id, 'previewed');
        await setAgentState('warning', `${cash(sellerPrice)} works. Approve and I'll close it.`);
        return { ok: true, data: preview };
      }

      let amount: number;
      let text: string;

      if (sellerPrice !== null && sellerPrice > limit && hasAnswered) {
        // 2. Above the mandate. They have already had one refusal and a counter, so
        // they are not going to move: stop rather than keep bidding against a wall.
        if (refusals >= 1) {
          await sayInChat(tabId, inputSelector, sendSelector, "That's above my limit, I'll stop here.");
          await createAction('send-offer', `Walked away from ${cash(sellerPrice)}`, { tabId, targetSelector: inputSelector }, 'refused');
          await setLocal('negotiationOutcome', { objectId: obj.id, outcome: 'walked-away', ceiling: limit, updatedAt: Date.now() });
          await setAgentState('warning', `${cash(sellerPrice)} is above my mandate. I stopped.`);
          setTimeout(() => settleToIdle(), 6000);
          return { ok: false, code: 'REFUSED', error: `${cash(sellerPrice)} is above the mandate ceiling of ${cash(limit)}.` };
        }
        refusals += 1;
        amount = nextCounter(lastOffer, sellerPrice, limit, offered);
        // Our own number comes first on purpose: the counterpart reads the first amount
        // in the message as the offer, so leading with theirs would offer it back to them.
        text = `I can do ${cash(amount)}. ${cash(sellerPrice)} is above my limit of ${cash(limit)}.`;
        await createAction('send-offer', `Refused ${cash(sellerPrice)}, countered ${cash(amount)}`, { tabId, targetSelector: inputSelector }, 'refused');
      } else {
        // 3. Opening offer, or a counter that is simply the next step.
        const drafted = await callTool({
          tool: 'proposeOffer',
          schema: offerSchema,
          userContent: [
            await missionContext(),
            describeObject(obj, 'TARGET'),
            `Last messages from the seller:\n${lines.slice(-3).join('\n') || '(none yet)'}`,
            lastOffer === null ? 'I have not made an offer yet.' : `My last offer was ${lastOffer}.`,
            `Hard limit: never offer more than ${limit}. The amount is clamped in code anyway.`,
            'Draft my next message. Short, first person, no pleasantries and no boilerplate.',
          ].join('\n\n'),
        });
        if (!drafted.ok) {
          await setAgentState('warning', drafted.code === 'NO_API_KEY' ? LUMI_VOICE.noKey : LUMI_VOICE.uncertain);
          setTimeout(() => settleToIdle(), 2500);
          return drafted;
        }
        amount =
          lastOffer === null
            ? Math.min(round50(drafted.data.amount), limit)
            : nextCounter(lastOffer, sellerPrice ?? limit, limit, offered);
        if (offered.has(amount)) amount = nextCounter(lastOffer, sellerPrice ?? limit, limit, offered);
        text = parseLastPrice(drafted.data.message) === amount ? drafted.data.message : `I can do ${cash(amount)}.`;
        await createAction('send-offer', `Offered ${cash(amount)}`, { tabId, targetSelector: inputSelector }, 'applied');
      }

      await setAgentState('thinking', `Countering at ${cash(amount)}…`);
      const sent = await sayInChat(tabId, inputSelector, sendSelector, text);
      if (!sent) {
        await settleToIdle();
        return { ok: false, code: 'NO_TAB', error: 'Could not reach the chat to send the offer.' };
      }
      offered.add(amount);
      lastOffer = amount;

      // Paced so a viewer can read each turn as it happens.
      await new Promise((resolve) => setTimeout(resolve, NEGOTIATION_PAUSE_MS));
    }

    await setLocal('negotiationOutcome', { objectId: obj.id, outcome: 'walked-away', ceiling: limit, updatedAt: Date.now() });
    await setAgentState('warning', 'We did not converge. I stopped before my limit.');
    setTimeout(() => settleToIdle(), 6000);
    return { ok: false, code: 'REFUSED', error: 'Negotiation did not converge within the turn limit.' };
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
    // The one approval in a negotiation: sending the acceptance. Offers below the
    // ceiling were already sent autonomously; this is the moment money is committed.
    if (action.type === 'accept-deal' && preview?.actionId === action.id) {
      const sendSelector = typeof action.payload?.sendSelector === 'string' ? action.payload.sendSelector : '';
      const sent = await sayInChat(
        preview.tabId,
        preview.changes[0]?.selector ?? '',
        sendSelector,
        preview.changes[0]?.proposedValue ?? '',
      );
      if (!sent) {
        await setLocal('pendingPreview', null);
        await settleToIdle();
        return { ok: false, code: 'NO_TAB', error: 'Could not reach the chat to accept the deal.' };
      }
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
