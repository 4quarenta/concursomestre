import { describe, expect, it } from 'vitest';
import { normalizeGoogleAuthClientId } from '@/services/system/googleAuthSettings';
import {
  canShowGlobalInterstitial,
  latestFullscreenAdTimestamp,
  normalizeMobileInterstitialFrequency,
  normalizeMobileInterstitialMinIntervalSeconds,
} from '@/services/ads/interstitialFrequency';
import { normalizeMobileAdsEnabled } from '@/services/ads/mobileAdsSettings';

describe('systemSettingsService Google OAuth configuration', () => {
  it('normalizes the public web OAuth client ID for native Google sign-in', () => {
    const clientId = normalizeGoogleAuthClientId({
      authentication: {
        google: {
          clientId: '1234567890-mobile_test.apps.googleusercontent.com',
        },
      },
    });

    expect(clientId).toBe(
      '1234567890-mobile_test.apps.googleusercontent.com',
    );
  });

  it('keeps the OAuth client ID absent when the public setting is not configured', () => {
    const clientId = normalizeGoogleAuthClientId({
      authentication: { google: {} },
    });

    expect(clientId).toBeUndefined();
  });

  it('reads and bounds global interstitial transition frequency, with compatibility for old settings', () => {
    expect(normalizeMobileInterstitialFrequency({
      advertising: { mobileInterstitialEveryTransitions: 5 },
    })).toBe(5);
    expect(normalizeMobileInterstitialFrequency({
      advertising: { mobileInterstitialEveryQuestions: 1 },
    })).toBe(2);
    expect(normalizeMobileInterstitialFrequency({
      mobileInterstitialEveryQuestions: 7,
    })).toBe(7);
  });

  it('requires both the global transition count and minimum elapsed time for an interstitial', () => {
    const conditions = {
      transitionCount: 3,
      frequency: 3,
      lastShownAt: 1000,
      now: 181_000,
      minIntervalMs: 180_000,
    };
    expect(canShowGlobalInterstitial(conditions)).toBe(true);
    expect(canShowGlobalInterstitial({ ...conditions, transitionCount: 2 })).toBe(false);
    expect(canShowGlobalInterstitial({ ...conditions, now: 180_999 })).toBe(false);
  });

  it('uses the most recent App Open or interstitial impression for the shared cooldown', () => {
    const appOpenAt = 10_000;
    const lastFullscreenAdAt = latestFullscreenAdTimestamp(0, appOpenAt);

    expect(lastFullscreenAdAt).toBe(appOpenAt);
    expect(canShowGlobalInterstitial({
      transitionCount: 2,
      frequency: 2,
      lastShownAt: lastFullscreenAdAt,
      now: appOpenAt + 179_999,
      minIntervalMs: 180_000,
    })).toBe(false);
    expect(canShowGlobalInterstitial({
      transitionCount: 2,
      frequency: 2,
      lastShownAt: lastFullscreenAdAt,
      now: appOpenAt + 180_000,
      minIntervalMs: 180_000,
    })).toBe(true);
  });

  it('normalizes the global interstitial minimum interval', () => {
    expect(normalizeMobileInterstitialMinIntervalSeconds({
      advertising: { mobileInterstitialMinIntervalSeconds: 240 },
    })).toBe(240);
    expect(normalizeMobileInterstitialMinIntervalSeconds({
      mobileInterstitialMinIntervalSeconds: 2,
    })).toBe(30);
  });

  it('honors the app-wide mobile ads switch and preserves ads for older payloads', () => {
    expect(normalizeMobileAdsEnabled({
      advertising: { mobileAdsEnabled: false, mobileInterstitialEveryQuestions: 5 },
    })).toBe(false);
    expect(normalizeMobileAdsEnabled({
      advertising: { mobileAdsEnabled: true },
    })).toBe(true);
    expect(normalizeMobileAdsEnabled({})).toBe(true);
  });
});
