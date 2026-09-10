import type { Question } from '@/types/questions';

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

export interface SimulationDetail extends SimulationListItem {
  config?: Record<string, any>;
  questions?: Question[];
  answers?: Record<string, any>;
  startTime?: number;
  endTime?: number;
}

export interface SimulationAnswerResult {
  selectedOptionIndex: number;
  isCorrect: boolean;
  correctOptionIndex: number;
}

export interface SimulationSaveResult {
  success: boolean;
  id: string;
  status?: string;
  score: number;
  answeredCount: number;
  correctCount: number;
  results: Record<string, SimulationAnswerResult>;
  newXp?: number;
  newLevel?: number;
  message?: string;
}
