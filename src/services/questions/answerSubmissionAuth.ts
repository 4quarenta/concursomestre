export type AnswerSubmissionAuthState = 'pending' | 'required' | 'verification-required';

const ANSWER_AUTH_STATE_ERROR = 'ANSWER_AUTH_STATE';

export const createAnswerSubmissionAuthError = (state: AnswerSubmissionAuthState): Error & {
  code: typeof ANSWER_AUTH_STATE_ERROR;
  authState: AnswerSubmissionAuthState;
} => {
  const error = new Error('A autenticação precisa ser resolvida antes de responder.') as Error & {
    code: typeof ANSWER_AUTH_STATE_ERROR;
    authState: AnswerSubmissionAuthState;
  };
  error.code = ANSWER_AUTH_STATE_ERROR;
  error.authState = state;
  return error;
};

export const getAnswerSubmissionAuthState = (error: unknown): AnswerSubmissionAuthState | null => {
  if (!error || typeof error !== 'object' || !('code' in error) || error.code !== ANSWER_AUTH_STATE_ERROR) {
    return null;
  }

  if (!('authState' in error)) {
    return null;
  }

  const state = error.authState;
  return state === 'pending' || state === 'required' || state === 'verification-required' ? state : null;
};
