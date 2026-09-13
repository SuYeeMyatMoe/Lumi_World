export interface LumiSettings {
  openaiApiKey: string;
  model: string;
  disabledOrigins: string[];
}

export const DEFAULT_MODEL = 'gpt-4o-mini';

export const defaultSettings = (): LumiSettings => ({
  openaiApiKey: '',
  model: DEFAULT_MODEL,
  disabledOrigins: [],
});
