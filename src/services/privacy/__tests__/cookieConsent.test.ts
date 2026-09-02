import { afterEach, describe, expect, it } from 'vitest';
import {
  COOKIE_CONSENT_OPEN_EVENT,
  COOKIE_CONSENT_STORAGE_KEY,
  readCookieConsent,
  requestCookieConsentPreferences,
  writeCookieConsent,
} from '../cookieConsent';

describe('cookie consent contract', () => {
  afterEach(() => {
    delete (globalThis as { window?: unknown }).window;
  });

  it('keeps optional categories disabled until an explicit choice', () => {
    const storage = new Map<string, string>();
    const windowMock = {
      localStorage: {
        getItem: (key: string) => storage.get(key) ?? null,
        setItem: (key: string, value: string) => storage.set(key, value),
      },
      dispatchEvent: () => true,
    };
    (globalThis as { window?: unknown }).window = windowMock;

    expect(readCookieConsent()).toBeNull();
    const saved = writeCookieConsent({ analytics: false, marketing: false });
    expect(saved?.necessary).toBe(true);
    expect(saved?.analytics).toBe(false);
    expect(saved?.marketing).toBe(false);
    expect(JSON.parse(storage.get(COOKIE_CONSENT_STORAGE_KEY) || '{}')).toMatchObject({ version: 1, analytics: false, marketing: false });
  });

  it('rejects malformed persisted consent', () => {
    const storage = new Map([[COOKIE_CONSENT_STORAGE_KEY, '{"version":2,"analytics":true,"marketing":false}']]);
    (globalThis as { window?: unknown }).window = {
      localStorage: { getItem: (key: string) => storage.get(key) ?? null },
    };
    expect(readCookieConsent()).toBeNull();
  });

  it('can request the preferences panel without exposing a persistent floating control', () => {
    const events: string[] = [];
    (globalThis as { window?: unknown }).window = {
      dispatchEvent: (event: Event) => {
        events.push(event.type);
        return true;
      },
    };

    requestCookieConsentPreferences();

    expect(events).toEqual([COOKIE_CONSENT_OPEN_EVENT]);
  });
});
