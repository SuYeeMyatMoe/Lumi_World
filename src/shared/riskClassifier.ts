import type { ActionType, RiskLevel } from './types/agentAction';

// Deterministic on purpose: risk gating must be auditable and never delegated to the model.
const RISK_TABLE: Record<ActionType, RiskLevel> = {
  highlight: 'low',
  scroll: 'low',
  compare: 'low',
  read: 'low',
  'fill-form': 'medium',
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
