import { describe, expect, it } from 'vitest';
import { resolveQuestionStatsTotal } from '../questionStatsPresentation';

describe('question statistics presentation', () => {
  it('keeps the canonical attempt total when option rows are incomplete', () => {
    expect(resolveQuestionStatsTotal(7, 5)).toBe(7);
  });

  it('falls back to option counts only when the aggregate is not populated', () => {
    expect(resolveQuestionStatsTotal(0, 5)).toBe(5);
    expect(resolveQuestionStatsTotal(0, 0)).toBe(0);
  });
});
