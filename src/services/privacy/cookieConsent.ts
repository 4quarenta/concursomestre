export const COOKIE_CONSENT_STORAGE_KEY = 'cm:cookie-consent:v1';
export const COOKIE_CONSENT_CHANGE_EVENT = 'cm:cookie-consent-changed';

export type CookieConsentPreferences = {
  version: 1;
  necessary: true;
  analytics: boolean;
  marketing: boolean;
  updatedAt: string;
};

const isBoolean = (value: unknown): value is boolean => typeof value === 'boolean';

export const parseCookieConsent = (raw: string | null): CookieConsentPreferences | null => {
  if (!raw) return null;

  try {
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return null;

    const value = parsed as Partial<CookieConsentPreferences>;
    if (value.version !== 1) return null;
    if (!isBoolean(value.analytics) || !isBoolean(value.marketing)) return null;

    return {
      version: 1,
      necessary: true,
      analytics: value.analytics,
      marketing: value.marketing,
      updatedAt: typeof value.updatedAt === 'string' ? value.updatedAt : '',
    };
  } catch {
    return null;
  }
};

export const readCookieConsent = (): CookieConsentPreferences | null => {
  if (typeof window === 'undefined') return null;
  try {
    return parseCookieConsent(window.localStorage.getItem(COOKIE_CONSENT_STORAGE_KEY));
  } catch {
    return null;
  }
};

export const writeCookieConsent = (
  preferences: Pick<CookieConsentPreferences, 'analytics' | 'marketing'>,
): CookieConsentPreferences | null => {
  if (typeof window === 'undefined') return null;

  const value: CookieConsentPreferences = {
    version: 1,
    necessary: true,
    analytics: preferences.analytics,
    marketing: preferences.marketing,
    updatedAt: new Date().toISOString(),
  };

  try {
    window.localStorage.setItem(COOKIE_CONSENT_STORAGE_KEY, JSON.stringify(value));
    window.dispatchEvent(new CustomEvent(COOKIE_CONSENT_CHANGE_EVENT));
    return value;
  } catch {
    return null;
  }
};
