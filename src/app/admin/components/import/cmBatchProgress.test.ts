import { describe, expect, it } from 'vitest';
import { queueActivityLabel, queueProgress } from './cmBatchProgress';

describe('CM Batch progress', () => {
  it('does not mistake a stored running status for an active browser worker', () => {
    expect(queueActivityLabel('running', false)).toBe('Aguardando continuação');
    expect(queueActivityLabel('queued', false)).toBe('Aguardando continuação');
    expect(queueActivityLabel('running', true)).toBe('Processando nesta aba');
  });
  it('counts blocked decisions separately from successful imports', () => {
    const result = queueProgress({ completedExams: 6, completedQuestions: 0, blocked: 363, failed: 0 }, 447);
    expect(result.completed).toBe(6);
    expect(result.evaluated).toBe(369);
    expect(result.percent).toBeCloseTo(82.55, 2);
  });
  it('handles empty progress and bounded percentages', () => {
    expect(queueProgress({}, 0).percent).toBe(0);
    expect(queueProgress({ failed: 3 }, 2).percent).toBe(100);
    expect(queueActivityLabel('paused', false)).toBe('Pausada');
  });
});
