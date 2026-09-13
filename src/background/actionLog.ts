import { getLocal, updateLocal } from '../shared/storage/storage';
import type { AgentAction, ActionType, ActionStatus } from '../shared/types/agentAction';
import { classifyRisk } from '../shared/riskClassifier';
import { uid } from '../shared/constants';

const LOG_CAP = 100;

export async function createAction(
  type: ActionType,
  label: string,
  extra: Partial<Pick<AgentAction, 'tabId' | 'targetSelector' | 'payload'>> = {},
  status: ActionStatus = 'proposed',
): Promise<AgentAction> {
  const action: AgentAction = {
    id: uid('act'),
    type,
    label,
    risk: classifyRisk(type),
    status,
    createdAt: Date.now(),
    ...extra,
  };
  await updateLocal('actionLog', (log) => [action, ...log].slice(0, LOG_CAP));
  return action;
}

export async function updateActionStatus(actionId: string, status: ActionStatus): Promise<AgentAction | null> {
  let updated: AgentAction | null = null;
  await updateLocal('actionLog', (log) =>
    log.map((a) => {
      if (a.id !== actionId) return a;
      updated = { ...a, status, resolvedAt: status === 'applied' || status === 'rejected' ? Date.now() : a.resolvedAt };
      return updated;
    }),
  );
  return updated;
}

export async function findAction(actionId: string): Promise<AgentAction | null> {
  const log = await getLocal('actionLog');
  return log.find((a) => a.id === actionId) ?? null;
}
