// Parsed from the plain-language goal by the parseMandate tool, then enforced
// deterministically in riskClassifier.checkMandate — the model never decides a limit.
// What to optimise for once the hard limits are satisfied. 'best-fit' is the default:
// the mandate says what is acceptable, this says how to choose among the acceptable.
export type MissionObjective = 'cheapest' | 'best-fit';

export interface Mandate {
  mustHave: string[];
  objective: MissionObjective;
  ceiling: number | null;
  currency: string | null;
  walkAway: number | null;
}

export interface Mission {
  id: string;
  goal: string;
  createdAt: number;
  status: 'active' | 'completed' | 'archived';
  mandate?: Mandate;
}
