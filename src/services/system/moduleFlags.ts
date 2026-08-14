/*
* ----------------------------------------------------
* @author: 4quarenta
* @author URI: https://github.com/4quarenta
* @copyright: (c) 2026 ConcursoMestre. All rights reserved
* ----------------------------------------------------
*
* @since 1.0.0
*
*/

import type { SystemSettings } from '@types';
import { isQuestionsIndexPath } from '@services/routes/publicRoutes';

type FeatureKey = keyof NonNullable<SystemSettings['features']>;

const MODULE_PATH_FEATURES: ReadonlyArray<{ prefix: string; key: FeatureKey }> = [
  { prefix: '/lei-comentada', key: 'annotatedLawsEnabled' },
  { prefix: '/flashcards', key: 'flashcardsEnabled' },
  { prefix: '/simulation', key: 'simulationsEnabled' },
  { prefix: '/cronograma', key: 'studyScheduleEnabled' },
  { prefix: '/x-ray', key: 'xRayEnabled' },
  { prefix: '/ranking', key: 'rankingsEnabled' },
  { prefix: '/marketplace', key: 'marketplaceEnabled' },
];

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

export const getModuleFeatureKeyForPath = (path: string): FeatureKey | null => {
  const normalizedPath = String(path || '').trim().split(/[?#]/, 1)[0];
  if (isQuestionsIndexPath(normalizedPath)) {
    return 'practiceEnabled';
  }
  return MODULE_PATH_FEATURES.find(({ prefix }) => (
    normalizedPath === prefix || normalizedPath.startsWith(`${prefix}/`)
  ))?.key ?? null;
};

export const isModulePathEnabled = (
  settings: Partial<SystemSettings> | null | undefined,
  path: string,
  fallback = true,
): boolean => {
  const featureKey = getModuleFeatureKeyForPath(path);
  return featureKey ? resolveSystemFeatureFlag(settings, featureKey, fallback) : true;
};
