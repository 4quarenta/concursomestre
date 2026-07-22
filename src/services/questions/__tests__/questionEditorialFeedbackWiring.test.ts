import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const questionCardSource = readFileSync(
  resolve(process.cwd(), 'src/app/questions/components/QuestionCard.tsx'),
  'utf8',
);

describe('question editorial feedback loading', () => {
  it('does not request editorial feedback while every list card mounts', () => {
    const lazyLoaderStart = questionCardSource.indexOf('const loadEditorialFeedback = React.useCallback');
    const requestPosition = questionCardSource.indexOf('questionService.getEditorialFeedback(');
    const lazyOpenCalls = questionCardSource.match(/void loadEditorialFeedback\(\);/g) || [];

    expect(lazyLoaderStart).toBeGreaterThan(-1);
    expect(requestPosition).toBeGreaterThan(lazyLoaderStart);
    expect(questionCardSource.match(/questionService\.getEditorialFeedback\(/g)).toHaveLength(1);
    expect(lazyOpenCalls).toHaveLength(2);
  });

  it('deduplicates an in-flight feedback request per card', () => {
    expect(questionCardSource).toContain('if (editorialFeedbackRequestRef.current)');
    expect(questionCardSource).toContain('return editorialFeedbackRequestRef.current;');
    expect(questionCardSource).toContain('editorialFeedbackRequestRef.current = request;');
  });
});
