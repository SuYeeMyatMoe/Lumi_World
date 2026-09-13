export interface LumiFocusRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface LumiFocusSnapshot {
  id: string;
  createdAt: number;
  tabId: number;
  tabUrl: string;
  tabTitle: string;
  selector: string;
  tagName: string;
  role?: string;
  text: string;
  attributes: Partial<Record<'href' | 'alt' | 'ariaLabel' | 'name' | 'title', string>>;
  boundingRect: LumiFocusRect;
  extracted: {
    label?: string;
    price?: string;
  };
  missionScore?: {
    score: number;
    verdict: string;
    matchedConstraints: string[];
  };
}
