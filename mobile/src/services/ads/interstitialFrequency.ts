import { DEFAULT_MOBILE_SYSTEM_SETTINGS } from '@/types/system';

const MIN_TRANSITIONS = 2;
const MAX_TRANSITIONS = 20;
const MIN_INTERVAL_SECONDS = 30;
const MAX_INTERVAL_SECONDS = 3600;

const advertisingSettings = (payload: Record<string, unknown>) => (
  payload.advertising && typeof payload.advertising === 'object'
    ? payload.advertising as Record<string, unknown>
    : {}
);

export const normalizeMobileInterstitialFrequency = (payload: Record<string, unknown>): number => {
  const advertising = advertisingSettings(payload);
  const rawFrequency = Number(
    advertising.mobileInterstitialEveryTransitions
      ?? payload.mobileInterstitialEveryTransitions
      // Keep reading the current admin contract until its matching global
      // transition setting is published.
      ?? advertising.mobileInterstitialEveryQuestions
      ?? payload.mobileInterstitialEveryQuestions
      ?? DEFAULT_MOBILE_SYSTEM_SETTINGS.mobileInterstitialEveryTransitions,
  );

  return Number.isFinite(rawFrequency)
    ? Math.min(MAX_TRANSITIONS, Math.max(MIN_TRANSITIONS, Math.floor(rawFrequency)))
    : DEFAULT_MOBILE_SYSTEM_SETTINGS.mobileInterstitialEveryTransitions;
};

export const normalizeMobileInterstitialMinIntervalSeconds = (payload: Record<string, unknown>): number => {
  const advertising = advertisingSettings(payload);
  const rawInterval = Number(
    advertising.mobileInterstitialMinIntervalSeconds
      ?? payload.mobileInterstitialMinIntervalSeconds
      ?? DEFAULT_MOBILE_SYSTEM_SETTINGS.mobileInterstitialMinIntervalSeconds,
  );

  return Number.isFinite(rawInterval)
    ? Math.min(MAX_INTERVAL_SECONDS, Math.max(MIN_INTERVAL_SECONDS, Math.floor(rawInterval)))
    : DEFAULT_MOBILE_SYSTEM_SETTINGS.mobileInterstitialMinIntervalSeconds;
};

export const canShowGlobalInterstitial = ({
  transitionCount,
  frequency,
  lastShownAt,
  now,
  minIntervalMs,
}: {
  transitionCount: number;
  frequency: number;
  lastShownAt: number;
  now: number;
  minIntervalMs: number;
}): boolean => transitionCount >= frequency && now - lastShownAt >= minIntervalMs;

/** Treat App Open and interstitial impressions as one fullscreen-ad cooldown. */
export const latestFullscreenAdTimestamp = (interstitialAt: number, appOpenAt: number): number => (
  Math.max(interstitialAt, appOpenAt)
);
