import type { ActionType, RiskLevel } from './types/agentAction';
import type { Mission } from './types/mission';

// Deterministic on purpose: risk gating must be auditable and never delegated to the model.
const RISK_TABLE: Record<ActionType, RiskLevel> = {
  highlight: 'low',
  scroll: 'low',
  compare: 'low',
  read: 'low',
  'fill-form': 'medium',
  'send-offer': 'medium',
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
      const needle = requirement.trim().toLowerCase();
      if (!needle) continue;
      if (!haystack.includes(needle)) {
        return { ok: false, reason: `I can't confirm "${requirement}" on this one, and you told me that's non-negotiable.` };
      }
    }
  }

  return { ok: true };
}
