import { describe, expect, it } from 'vitest';
import { createAnswerSubmissionAuthError, getAnswerSubmissionAuthState } from '../answerSubmissionAuth';

describe('answer submission authentication state', () => {
  it.each(['pending', 'required', 'verification-required'] as const)('identifies %s without treating it as a save failure', (state) => {
    expect(getAnswerSubmissionAuthState(createAnswerSubmissionAuthError(state))).toBe(state);
  });

  it('does not classify unrelated errors as authentication state', () => {
    expect(getAnswerSubmissionAuthState(new Error('Falha interna'))).toBeNull();
  });
});
