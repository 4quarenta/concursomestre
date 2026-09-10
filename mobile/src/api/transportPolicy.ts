import { normalizeApiFailure } from '@/api/errors';

export const API_REQUEST_TIMEOUT_MS = 20_000;

export const shouldRetryApiFailure = (failureCount: number, error: unknown): boolean => {
  if (failureCount >= 1) return false;
  return normalizeApiFailure(error).retryable;
};

export const retryDelayMs = (attemptIndex: number): number => Math.min(1000 * 2 ** attemptIndex, 4000);
