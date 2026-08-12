import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const practiceSource = fs.readFileSync(
  path.resolve(process.cwd(), 'src/app/practice/PracticeClient.tsx'),
  'utf8',
);

const actionsSource = fs.readFileSync(
  path.resolve(process.cwd(), 'src/state/question-bank/useQuestionBankActions.ts'),
  'utf8',
);

describe('practice infinite scroll', () => {
  it('does not make the bootstrap effect depend on the loading state it mutates', () => {
    expect(practiceSource).not.toContain(
      'isLoadingMore || hasBootstrappedQuestionsRef.current === questionQueryKey',
    );
    expect(practiceSource).toContain('bootstrapRequestIdRef.current === requestId');
  });

  it('surfaces page failures and offers an explicit retry instead of an endless spinner', () => {
    expect(actionsSource).toContain('throw error;');
    expect(practiceSource).toContain("setLoadMoreError('Não foi possível carregar mais questões.')");
    expect(practiceSource).toContain('Tentar carregar novamente');
    expect(practiceSource).toContain('isLoadingMore ? (');
  });
});
