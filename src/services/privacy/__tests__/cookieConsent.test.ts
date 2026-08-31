import { describe, expect, it } from 'vitest';
import { parseCookieConsent } from '../cookieConsent';

describe('cookie consent contract', () => {
  it('fails closed for malformed or incomplete optional consent', () => {
    expect(parseCookieConsent(null)).toBeNull();
    expect(parseCookieConsent('{"version":2,"analytics":true,"marketing":false}')).toBeNull();
    expect(parseCookieConsent('{"version":1,"analytics":"yes","marketing":false}')).toBeNull();
    expect(parseCookieConsent('{"version":1,"analytics":false}')).toBeNull();
  });

  it('normalizes necessary consent and preserves optional categories', () => {
    expect(parseCookieConsent('{"version":1,"analytics":true,"marketing":false,"updatedAt":"2026-08-30T00:00:00.000Z"}')).toEqual({
      version: 1,
      necessary: true,
      analytics: true,
      marketing: false,
      updatedAt: '2026-08-30T00:00:00.000Z',
    });
  });
});
