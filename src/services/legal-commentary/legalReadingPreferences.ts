import type { LegalReadingPreferences } from '@types';

const LEGAL_READING_PREFERENCES_PREFIX = 'cm:legal-commentary:reader-tools:';

export const DEFAULT_LEGAL_READING_PREFERENCES: LegalReadingPreferences = {
  readingMode: 'commented',
  commentedViewMode: 'cards',
  readingFlowMode: 'list',
  isFocusMode: false,
  hideSecondaryPanels: false,
  highlightMode: 'selection',
  highlightColor: 'yellow',
  showComments: false,
  isImmersiveMode: false,
};

export const getLegalReadingPreferencesStorageKey = (userKey: string, lawId: string) =>
  `${LEGAL_READING_PREFERENCES_PREFIX}${userKey}:${lawId}`;

export const readLegalReadingPreferences = (
  userKey: string,
  lawId: string,
): LegalReadingPreferences => {
  if (typeof window === 'undefined' || !userKey || !lawId) {
    return DEFAULT_LEGAL_READING_PREFERENCES;
  }

  try {
    const rawValue = window.localStorage.getItem(getLegalReadingPreferencesStorageKey(userKey, lawId));
    if (!rawValue) {
      return DEFAULT_LEGAL_READING_PREFERENCES;
    }

    const parsed = JSON.parse(rawValue) as Partial<LegalReadingPreferences> | null;
    return {
      ...DEFAULT_LEGAL_READING_PREFERENCES,
      ...(parsed || {}),
    };
  } catch {
    return DEFAULT_LEGAL_READING_PREFERENCES;
  }
};

export const saveLegalReadingPreferences = (
  userKey: string,
  lawId: string,
  preferences: LegalReadingPreferences,
) => {
  if (typeof window === 'undefined' || !userKey || !lawId) {
    return;
  }

  window.localStorage.setItem(
    getLegalReadingPreferencesStorageKey(userKey, lawId),
    JSON.stringify(preferences),
  );
};
