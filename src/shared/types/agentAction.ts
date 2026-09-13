export type ActionType =
  | 'highlight'
  | 'scroll'
  | 'compare'
  | 'read'
  | 'fill-form'
  | 'send-offer'
  | 'submit'
  | 'delete'
  | 'navigate-payment'
  | 'click-buy';

export type RiskLevel = 'low' | 'medium' | 'high';

export type ActionStatus = 'proposed' | 'previewed' | 'approved' | 'applied' | 'rejected' | 'refused';

export interface AgentAction {
  id: string;
  type: ActionType;
  label: string;
  tabId?: number;
  targetSelector?: string;
  payload?: Record<string, unknown>;
  risk: RiskLevel;
  status: ActionStatus;
  createdAt: number;
  resolvedAt?: number;
}
