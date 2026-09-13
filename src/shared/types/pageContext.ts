// A text-only read of what the current page is about, used to propose missions
// before the user has told Lumi anything. Never carries markup, values or inputs.
export interface PageCard {
  label: string;
  price: string | null;
}

export interface PageContext {
  title: string;
  url: string;
  headings: string[];
  cards: PageCard[];
}

export interface MissionSuggestion {
  goal: string;
  why: string;
}

export interface MissionSuggestions {
  suggestions: MissionSuggestion[];
  // 'fallback' means these were derived in code because the model was unavailable.
  source: 'model' | 'fallback';
}
