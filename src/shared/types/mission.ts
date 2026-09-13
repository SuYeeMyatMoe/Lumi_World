// Parsed from the plain-language goal by the parseMandate tool, then enforced
// deterministically in riskClassifier.checkMandate — the model never decides a limit.
export interface Mandate {
  mustHave: string[];
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
