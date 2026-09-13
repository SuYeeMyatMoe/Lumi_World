export interface LumiSettings {
  openaiApiKey: string;
  model: string;
  disabledOrigins: string[];
  // High-risk actions execute only on these origins; everywhere else they are gated.
  executeHighRiskOrigins: string[];
}

export const DEFAULT_MODEL = 'gpt-4o-mini';

export const defaultSettings = (): LumiSettings => ({
  openaiApiKey: '',
  model: DEFAULT_MODEL,
  disabledOrigins: [],
  executeHighRiskOrigins: ['http://localhost:5173'],
});
