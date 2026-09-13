export interface Mission {
  id: string;
  goal: string;
  createdAt: number;
  status: 'active' | 'completed' | 'archived';
}
