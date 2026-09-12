import type { Question } from '@/types/questions';

export type MobileSimulationDifficulty = 'all' | 'easy' | 'medium' | 'hard';
export type MobileSimulationFeedbackMode = 'after_all' | 'instant';

export interface MobileSimulationConfig {
  questionCount: number;
  timerEnabled: boolean;
  timerMinutes: number;
  keyword?: string;
  difficulty?: MobileSimulationDifficulty;
  feedbackMode?: MobileSimulationFeedbackMode;
  subjects?: string[];
  agencies?: string[];
  years?: string[];
  organizations?: string[];
  roles?: string[];
  topics?: string[];
}

export interface MobileSimulationSeed {
  id?: string;
  config: MobileSimulationConfig;
  questions: Question[];
  startedAt: number;
}

export interface MobileSimulationQuestionResult {
  question: Question;
  selectedIndex?: number;
  answered: boolean;
  isCorrect: boolean;
  correctIndex: number;
}

export interface MobileSimulationResult {
  score: number;
  total: number;
  elapsedSeconds: number;
  questionResults: MobileSimulationQuestionResult[];
}
