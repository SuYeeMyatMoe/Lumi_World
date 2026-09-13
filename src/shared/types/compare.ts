export interface CompareResult {
  id: string;
  createdAt: number;
  objectAId: string;
  objectBId: string;
  winner: 'A' | 'B' | 'tie';
  scoreA: number;
  scoreB: number;
  reasons: string[];
  summary: string;
}
