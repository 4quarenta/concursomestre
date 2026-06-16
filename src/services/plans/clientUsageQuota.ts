import type { PlanUsageLimitKey } from '@types';

const getLocalDateKey = (date = new Date()): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const getDailyUsageStorageKey = (userId: string | null | undefined, limitKey: PlanUsageLimitKey) => (
  `cm:usage:${limitKey}:${userId || 'guest'}:${getLocalDateKey()}`
);

export const readDailyUsageCount = (userId: string | null | undefined, limitKey: PlanUsageLimitKey): number => {
  if (typeof window === 'undefined') {
    return 0;
  }

  const rawValue = window.localStorage.getItem(getDailyUsageStorageKey(userId, limitKey));
  const parsedValue = Number(rawValue || 0);
  return Number.isFinite(parsedValue) ? Math.max(0, parsedValue) : 0;
};

export const incrementDailyUsageCount = (
  userId: string | null | undefined,
  limitKey: PlanUsageLimitKey,
  amount = 1,
) => {
  if (typeof window === 'undefined') {
    return;
  }

  const currentValue = readDailyUsageCount(userId, limitKey);
  window.localStorage.setItem(getDailyUsageStorageKey(userId, limitKey), String(currentValue + Math.max(1, amount)));
};
