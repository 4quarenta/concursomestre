import type { SystemSettings } from '@types';

type FeatureKey = keyof NonNullable<SystemSettings['features']>;

const normalizeBooleanLike = (value: unknown): boolean | null => {
  if (typeof value === 'boolean') {
    return value;
  }

  if (typeof value === 'number') {
    return value !== 0;
  }

  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();

    if (['1', 'true', 'yes', 'on'].includes(normalized)) {
      return true;
    }

    if (['0', 'false', 'no', 'off', ''].includes(normalized)) {
      return false;
    }
  }

  return null;
};

export const resolveSystemFeatureFlag = (
  settings: Partial<SystemSettings> | null | undefined,
  key: FeatureKey,
  fallback = true,
): boolean => {
  const nestedValue = normalizeBooleanLike(settings?.features?.[key]);
  if (nestedValue !== null) {
    return nestedValue;
  }

  const flatValue = normalizeBooleanLike((settings as Record<string, unknown> | null | undefined)?.[key]);
  if (flatValue !== null) {
    return flatValue;
  }

  return fallback;
};
