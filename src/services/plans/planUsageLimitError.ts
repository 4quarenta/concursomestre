import type { PlanUsageLimitKey } from '@types';
import { readApiErrorMessage } from '@services/api/response';

const normalizeErrorText = (value: string): string => value
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .toLowerCase();

const USAGE_LIMIT_MESSAGES: Array<{ pattern: RegExp; key: PlanUsageLimitKey }> = [
  { pattern: /limite de questoes por dia/, key: 'questions_per_day' },
  { pattern: /limite de simulados por semana/, key: 'simulations_per_week' },
  { pattern: /limite de simulados por mes/, key: 'simulations_per_month' },
];

export const getPlanUsageLimitKeyFromError = (error: unknown): PlanUsageLimitKey | null => {
  const message = normalizeErrorText(readApiErrorMessage(error, ''));
  return USAGE_LIMIT_MESSAGES.find(({ pattern }) => pattern.test(message))?.key ?? null;
};
