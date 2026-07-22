import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const practiceSource = readFileSync(
  resolve(process.cwd(), 'src/app/practice/PracticeClient.tsx'),
  'utf8',
);

describe('practice answer submission wiring', () => {
  it('returns the canonical answer promise to QuestionCard', () => {
    const handlerStart = practiceSource.indexOf('const handleAnswer = useCallback');
    const handlerEnd = practiceSource.indexOf('const handleFilterChange', handlerStart);
    const handlerSource = practiceSource.slice(handlerStart, handlerEnd);

    expect(handlerStart).toBeGreaterThan(-1);
    expect(handlerSource).toContain("Omit<UserAnswer, 'isCorrect' | 'correctOptionIndex'>");
    expect(handlerSource).toContain('return dispatchAnswer(ans);');
    expect(handlerSource).not.toMatch(/^\s*dispatchAnswer\(ans\);/m);
  });
});
