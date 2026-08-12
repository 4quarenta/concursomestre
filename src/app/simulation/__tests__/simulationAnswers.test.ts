import { describe, expect, it } from 'vitest';
import type { SimulationSession } from '@types';
import { mergeSimulationAnswer } from '../simulationAnswers';

const makeSession = (): SimulationSession => ({
  id: 'simulation-test',
  title: 'Simulado',
  questions: [],
  answers: {},
  config: {} as SimulationSession['config'],
  startTime: Date.now(),
  status: 'active',
} as SimulationSession);

describe('mergeSimulationAnswer', () => {
  it('preserves every answer submitted in sequence', () => {
    const first = mergeSimulationAnswer(makeSession(), 10, { index: 0, is_correct: 0, time_taken: 2 });
    const second = mergeSimulationAnswer(first, 20, { index: 1, is_correct: 0, time_taken: 3 });
    const third = mergeSimulationAnswer(second, 30, { index: 2, is_correct: 0, time_taken: 4 });

    expect(third?.answers).toMatchObject({
      10: { index: 0 },
      20: { index: 1 },
      30: { index: 2 },
    });
  });

  it('does not materialize a session after it has been cleared', () => {
    expect(mergeSimulationAnswer(null, 10, { index: 0, is_correct: 0, time_taken: 1 })).toBeNull();
  });
});
