import type { LumiFocusSnapshot } from './lumiFocus';
import type { AgentState, FocusScreenPos } from './agentState';
import type { CompareResult } from './compare';
import type { LumiPreview } from './lumiPreview';
import type { AgentAction } from './agentAction';
import type { Mission } from './mission';
import type { MissionSuggestions, PageContext } from './pageContext';

export interface DetectedFormField {
  selector: string;
  label: string;
  currentValue: string;
  kind: string;
  // Selector of the owning <form>, so an approved submit targets the right one.
  formSelector: string;
}

export type LumiError = {
  ok: false;
  error: string;
  code: 'NO_API_KEY' | 'NETWORK' | 'API' | 'PARSE' | 'NO_TAB' | 'REFUSED' | 'UNKNOWN';
};
export type LumiOk<T> = { ok: true; data: T };
export type LumiResult<T> = LumiOk<T> | LumiError;

// Content script / side panel -> background
export type RuntimeMessage =
  | { type: 'FOCUS_HOVER'; pos: Omit<FocusScreenPos, 'tabId'> | null }
  | { type: 'GET_TAB_ID' }
  | { type: 'FOCUS_PINNED'; snapshot: Omit<LumiFocusSnapshot, 'id' | 'createdAt' | 'tabId' | 'tabUrl' | 'tabTitle'> }
  | { type: 'PARSE_MISSION'; goal: string }
  | { type: 'REQUEST_COMPARE'; objectAId: string; objectBId: string }
  | { type: 'REQUEST_SCORE'; objectId: string }
  | { type: 'REQUEST_FORM_FILL' }
  | { type: 'REQUEST_OFFER'; objectId: string }
  | { type: 'REQUEST_SUBMIT' }
  | { type: 'APPLY_ACTION'; actionId: string }
  | { type: 'REJECT_ACTION'; actionId: string }
  | { type: 'SET_AGENT_STATE'; state: AgentState; message?: string }
  | { type: 'OPEN_SIDE_PANEL' }
  | { type: 'REMOVE_MEMORY_ITEM'; id: string }
  | { type: 'CLEAR_MEMORY' }
  | { type: 'SUGGEST_MISSIONS' };

// Background -> content script (tab-targeted)
export type TabMessage =
  | { type: 'DETECT_FORM_FIELDS' }
  | { type: 'APPLY_FIELD_VALUES'; changes: { selector: string; value: string }[] }
  | { type: 'HIGHLIGHT_SELECTOR'; selector: string | null }
  | { type: 'SUBMIT_FORM'; selector: string }
  | { type: 'READ_CHAT'; selector: string }
  | { type: 'CLICK_SELECTOR'; selector: string }
  | { type: 'READ_PAGE_CONTEXT' }
  | { type: 'PIN_SELECTOR'; selector: string };

export type RuntimeResponseMap = {
  FOCUS_HOVER: LumiResult<null>;
  GET_TAB_ID: LumiResult<number>;
  FOCUS_PINNED: LumiResult<LumiFocusSnapshot>;
  PARSE_MISSION: LumiResult<Mission>;
  REQUEST_COMPARE: LumiResult<CompareResult>;
  REQUEST_SCORE: LumiResult<LumiFocusSnapshot>;
  REQUEST_FORM_FILL: LumiResult<LumiPreview>;
  REQUEST_OFFER: LumiResult<LumiPreview>;
  REQUEST_SUBMIT: LumiResult<AgentAction>;
  APPLY_ACTION: LumiResult<AgentAction>;
  REJECT_ACTION: LumiResult<AgentAction>;
  SET_AGENT_STATE: LumiResult<null>;
  OPEN_SIDE_PANEL: LumiResult<null>;
  REMOVE_MEMORY_ITEM: LumiResult<null>;
  CLEAR_MEMORY: LumiResult<null>;
  SUGGEST_MISSIONS: LumiResult<MissionSuggestions>;
};

export type TabResponseMap = {
  DETECT_FORM_FIELDS: LumiResult<{ fields: DetectedFormField[]; protectedCount: number }>;
  APPLY_FIELD_VALUES: LumiResult<{ applied: number }>;
  HIGHLIGHT_SELECTOR: LumiResult<null>;
  SUBMIT_FORM: LumiResult<{ submitted: boolean }>;
  READ_CHAT: LumiResult<{ transcript: string; inputSelector: string; sendSelector: string }>;
  CLICK_SELECTOR: LumiResult<{ clicked: boolean }>;
  READ_PAGE_CONTEXT: LumiResult<PageContext>;
  PIN_SELECTOR: LumiResult<LumiFocusSnapshot>;
};
