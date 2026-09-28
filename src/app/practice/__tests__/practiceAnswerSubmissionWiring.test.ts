import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const practiceSource = readFileSync(
  resolve(process.cwd(), 'src/app/practice/PracticeClient.tsx'),
  'utf8',
);
const questionCardSource = readFileSync(
  resolve(process.cwd(), 'src/app/questions/components/QuestionCard.tsx'),
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

  it('does not show the guest flow while auth bootstrap is pending', () => {
    const handlerStart = practiceSource.indexOf('const handleAnswer = useCallback');
    const handlerEnd = practiceSource.indexOf('const handleFilterChange', handlerStart);
    const handlerSource = practiceSource.slice(handlerStart, handlerEnd);

    expect(handlerSource.indexOf('if (authIsLoading)')).toBeGreaterThan(-1);
    expect(handlerSource.indexOf('if (authIsLoading)')).toBeLessThan(handlerSource.indexOf('if (!currentUser)'));
    expect(handlerSource).toContain("createAnswerSubmissionAuthError('pending')");
    expect(handlerSource).toContain("createAnswerSubmissionAuthError('required')");
  });

  it('revalidates an existing token before showing the guest modal', () => {
    expect(questionCardSource).toContain('if (!getAccessToken())');
    expect(questionCardSource).toContain('await refreshAuthSession({');
    expect(questionCardSource).toContain("await resolveMissingAnswerSession('answer');");
    expect(questionCardSource).toContain("if (authState === 'required')");
  });
});
