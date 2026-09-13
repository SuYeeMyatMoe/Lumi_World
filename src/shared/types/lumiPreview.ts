export interface LumiPreviewFieldChange {
  selector: string;
  label: string;
  currentValue: string;
  proposedValue: string;
}

export interface LumiPreview {
  actionId: string;
  tabId: number;
  changes: LumiPreviewFieldChange[];
  rationale?: string;
  protectedFieldCount: number;
}
