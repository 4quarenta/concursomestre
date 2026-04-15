export interface SimulationListItem {
  id: string;
  name?: string;
  status?: string;
  score?: number;
  questionCount?: number;
  source?: 'remote' | 'local';
  createdAt?: number | string;
  updatedAt?: number | string;
}
