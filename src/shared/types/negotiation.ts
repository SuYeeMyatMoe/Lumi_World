// Contract between the negotiation layer (writer) and the fallback layer (reader).
// 'walked-away' means the seller's final price stayed above the mandate ceiling.
export interface NegotiationOutcome {
  objectId: string;
  outcome: 'agreed' | 'walked-away';
  agreedPrice?: number;
  ceiling: number | null;
  updatedAt: number;
}
