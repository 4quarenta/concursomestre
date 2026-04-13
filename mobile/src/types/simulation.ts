import type { Question } from '@/types/questions';

export interface MobileSimulationConfig {
  questionCount: number;
  timerEnabled: boolean;
  timerMinutes: number;
}

export interface MobileSimulationSeed {
  config: MobileSimulationConfig;
  questions: Question[];
  startedAt: number;
}

export interface MobileSimulationResult {
  score: number;
  total: number;
  elapsedSeconds: number;
}
