import type { ActionType, RiskLevel } from './types/agentAction';
import type { Mission } from './types/mission';

// Deterministic on purpose: risk gating must be auditable and never delegated to the model.
const RISK_TABLE: Record<ActionType, RiskLevel> = {
  highlight: 'low',
  scroll: 'low',
  compare: 'low',
  read: 'low',
  'fill-form': 'medium',
  // An offer inside the mandate is low risk on purpose: the ceiling already bounds it,
  // so Lumi sends it herself. Accepting a deal is what the human approves.
  'send-offer': 'low',
  'accept-deal': 'medium',
  submit: 'high',
  delete: 'high',
  'navigate-payment': 'high',
  'click-buy': 'high',
};

export function classifyRisk(type: ActionType): RiskLevel {
  return RISK_TABLE[type];
}

export function requiresPreview(risk: RiskLevel): boolean {
  return risk !== 'low';
}

export function requiresExplicitApproval(risk: RiskLevel): boolean {
  return risk === 'high';
}

export type MandateVerdict = { ok: true } | { ok: false; reason: string };

export interface MandateInput {
  // The price Lumi is about to commit to, if one is known.
  price?: number | null;
  // Text describing the thing being bought, searched for the must-haves.
  text?: string;
}

function formatAmount(value: number, currency: string | null | undefined): string {
  const digits = value.toLocaleString('en-MY', { maximumFractionDigits: 2 });
  return currency ? `${currency}${digits}` : digits;
}

// Deterministic mandate enforcement. The model proposes; this function disposes.
// Never calls out, never asks the model, and refuses on the first violation it finds
// so the reason shown on screen names one concrete thing.
export function checkMandate(input: MandateInput, mission: Mission | null): MandateVerdict {
  const mandate = mission?.mandate;
  if (!mandate) return { ok: true };

  const { price } = input;
  if (typeof price === 'number' && Number.isFinite(price)) {
    // walkAway, when stated separately, is the harder limit of the two.
    const limit =
      mandate.walkAway !== null && mandate.ceiling !== null
        ? Math.min(mandate.walkAway, mandate.ceiling)
        : mandate.walkAway ?? mandate.ceiling;

    if (limit !== null && price > limit) {
      const which = mandate.ceiling !== null && limit === mandate.ceiling ? 'ceiling' : 'walk-away limit';
      return {
        ok: false,
        reason: `${formatAmount(price, mandate.currency)} is above my mandate (${which} ${formatAmount(limit, mandate.currency)}). I'll stop before that one.`,
      };
    }
  }

  const haystack = (input.text ?? '').toLowerCase();
  if (haystack) {
    for (const requirement of mandate.mustHave) {
      if (!requirement.trim()) continue;
      if (!satisfies(haystack, requirement)) {
        return { ok: false, reason: `I can't confirm "${requirement}" on this one, and you told me that's non-negotiable.` };
      }
    }
  }

  return { ok: true };
}

// Words vendors use interchangeably for the same thing. "16 GB RAM" has to match a card
// that says "16 GB DDR5" or "16 GB unified memory", or the mandate refuses every real
// listing and the agent becomes useless rather than careful.
const EQUIVALENT_CLASSES: RegExp[] = [/^(ram|memory|ddr\d*|lpddr\d*x?|sdram|unified)$/];

// Amounts must match exactly and stay attached to their unit: "8 GB RAM" must not be
// satisfied by a card that happens to mention a 16-core chip and 8 GB of storage.
const QUANTITY = /(\d+(?:\.\d+)?)\s*-?\s*(gb|tb|mb|ghz|mhz|kg|w|hz|inch|in|")/gi;
const STOPWORDS = new Set(['a', 'an', 'the', 'of', 'or', 'and', 'with', 'at', 'least', 'min', 'minimum', 'up', 'to']);

function classOf(token: string): RegExp | null {
  return EQUIVALENT_CLASSES.find((c) => c.test(token)) ?? null;
}

// The one place that decides whether a listing meets a requirement. The side panel
// calls this too, so what the panel scores and what the guard allows cannot drift.
export function meetsRequirement(text: string, requirement: string): boolean {
  return satisfies((text ?? '').toLowerCase(), requirement);
}

function satisfies(haystack: string, requirement: string): boolean {
  const needle = requirement.toLowerCase();

  // 1. Every quantity in the requirement must appear with its unit.
  QUANTITY.lastIndex = 0;
  const quantities = Array.from(needle.matchAll(QUANTITY));
  for (const [, amount, unit] of quantities) {
    const pattern = new RegExp(`\\b${escapeRegExp(amount)}\\s*-?\\s*${escapeRegExp(unit)}\\b`, 'i');
    if (!pattern.test(haystack)) return false;
  }

  // 2. Every other meaningful word must appear, or a word of the same class must.
  const consumed = needle.replace(QUANTITY, ' ');
  const words = consumed.split(/[^a-z0-9]+/i).filter((w) => w.length > 1 && !STOPWORDS.has(w));
  const haystackWords = haystack.split(/[^a-z0-9]+/i).filter(Boolean);

  for (const word of words) {
    if (haystackWords.includes(word)) continue;
    const family = classOf(word);
    if (family && haystackWords.some((h) => family.test(h))) continue;
    return false;
  }
  return true;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
