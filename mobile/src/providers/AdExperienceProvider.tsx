import React from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  AdEventType,
  InterstitialAd,
  useAppOpenAd,
} from "react-native-google-mobile-ads";
import type { AdError } from "react-native-google-mobile-ads";
import { useAdsConsent } from "@/providers/AdsConsentContext";
import { useAuth } from "@/providers/AuthProvider";
import { mobileAdUnits, mobileAdsSupported } from "@/services/ads/adUnits";
import { canShowGlobalInterstitial, latestFullscreenAdTimestamp } from "@/services/ads/interstitialFrequency";

const INTERSTITIAL_LAST_SHOWN_KEY = "ads.interstitial.last-shown.v1";
const APP_OPEN_LAST_SHOWN_KEY = "ads.app-open.last-shown.v1";
const APP_OPEN_COOLDOWN_MS = 30 * 60 * 1000;
const INTERSTITIAL_IDLE_DELAY_MS = 800;
const INTERSTITIAL_RELOAD_DELAY_MS = 30 * 1000;
const INTERSTITIAL_COUNT_FREQUENCY_MIN = 2;
const INTERSTITIAL_COUNT_FREQUENCY_MAX = 20;

type AdExperienceContextValue = {
  registerPageTransition: () => void;
};

const AdExperienceContext = React.createContext<AdExperienceContextValue>({
  registerPageTransition: () => undefined,
});

const readTimestamp = async (key: string) => {
  const value = await AsyncStorage.getItem(key).catch(() => null);
  const timestamp = Number(value);
  return Number.isFinite(timestamp) && timestamp > 0 ? timestamp : 0;
};

export const AdExperienceProvider: React.FC<React.PropsWithChildren> = ({ children }) => {
  const { canRequestAds } = useAdsConsent();
  const { isBootstrapped, systemSettings } = useAuth();
  const mobileAdsEnabled = systemSettings.mobileAdsEnabled !== false;
  const [storageReady, setStorageReady] = React.useState(false);
  const [appOpenAllowed, setAppOpenAllowed] = React.useState(false);
  const [interstitialStatus, setInterstitialStatus] = React.useState<"idle" | "loading" | "loaded" | "showing" | "error">("idle");
  const interstitialStatusRef = React.useRef(interstitialStatus);
  const interstitialRef = React.useRef<InterstitialAd | null>(null);
  const lastInterstitialAt = React.useRef(0);
  const lastAppOpenAt = React.useRef(0);
  const pageTransitionCount = React.useRef(0);
  const coldStartAttempted = React.useRef(false);
  const transitionAdTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const reloadTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  // Deliberately use the one-shot hook, not the manager: the manager also
  // displays App Open when any external flow returns the app to foreground
  // (including Google sign-in), which caused a second ad after login.
  const appOpen = useAppOpenAd({
    adUnitId: mobileAdsSupported && canRequestAds && isBootstrapped && mobileAdsEnabled ? mobileAdUnits.appOpen : null,
    autoLoad: mobileAdsSupported && canRequestAds && isBootstrapped && mobileAdsEnabled && appOpenAllowed && !coldStartAttempted.current,
  });
  const appOpenStatus = appOpen.status;
  const showAppOpen = appOpen.show;
  const appOpenIsShowing = appOpenStatus === "showing";

  const setInterstitialStatusSafe = React.useCallback((status: typeof interstitialStatus) => {
    interstitialStatusRef.current = status;
    setInterstitialStatus(status);
  }, []);

  const recordFullscreenAdShown = React.useCallback((shownAt: number = Date.now()) => {
    // App Open and interstitial are both full-screen formats. Share the
    // cooldown and clear accumulated transitions so they cannot chain.
    lastInterstitialAt.current = shownAt;
    pageTransitionCount.current = 0;
    if (transitionAdTimer.current) clearTimeout(transitionAdTimer.current);
    transitionAdTimer.current = null;
    void AsyncStorage.setItem(INTERSTITIAL_LAST_SHOWN_KEY, String(shownAt)).catch(() => undefined);
  }, []);

  React.useEffect(() => {
    let mounted = true;
    void Promise.all([
      readTimestamp(INTERSTITIAL_LAST_SHOWN_KEY),
      readTimestamp(APP_OPEN_LAST_SHOWN_KEY),
    ]).then(([interstitialAt, appOpenAt]) => {
      if (!mounted) return;
      lastInterstitialAt.current = latestFullscreenAdTimestamp(interstitialAt, appOpenAt);
      lastAppOpenAt.current = appOpenAt;
      setStorageReady(true);
    });
    return () => { mounted = false; };
  }, []);

  React.useEffect(() => {
    if (!mobileAdsSupported || !canRequestAds || !isBootstrapped || !mobileAdsEnabled) {
      setInterstitialStatusSafe("idle");
      return undefined;
    }

    let mounted = true;
    let activeAd: InterstitialAd | null = null;
    let removeListener: (() => void) | null = null;

    const clearActiveAd = () => {
      const oldAd = activeAd;
      activeAd = null;
      if (interstitialRef.current === oldAd) interstitialRef.current = null;
      removeListener?.();
      removeListener = null;
      oldAd?.destroy();
    };

    const loadFreshAd = () => {
      if (!mounted) return;
      clearActiveAd();

      try {
        const ad = InterstitialAd.createForAdRequest(mobileAdUnits.interstitial);
        activeAd = ad;
        interstitialRef.current = ad;
        setInterstitialStatusSafe("loading");
        removeListener = ad.addAdEventsListener(({ type, payload }) => {
          if (!mounted || activeAd !== ad) return;

          if (type === AdEventType.LOADED) {
            setInterstitialStatusSafe("loaded");
            return;
          }

          if (type === AdEventType.OPENED) {
            const shownAt = Date.now();
            recordFullscreenAdShown(shownAt);
            setInterstitialStatusSafe("showing");
            return;
          }

          if (type === AdEventType.CLOSED) {
            setInterstitialStatusSafe("idle");
            clearActiveAd();
            reloadTimer.current = setTimeout(loadFreshAd, 250);
            return;
          }

          if (type === AdEventType.ERROR) {
            const error = payload as AdError;
            if (__DEV__) console.warn("[Ads] Interstitial failed", error.message);
            setInterstitialStatusSafe("error");
            clearActiveAd();
            // Back off after a failed request; do not create a retry loop.
            reloadTimer.current = setTimeout(loadFreshAd, INTERSTITIAL_RELOAD_DELAY_MS);
          }
        });
        ad.load();
      } catch (error) {
        if (__DEV__) console.warn("[Ads] Could not create interstitial", error);
        setInterstitialStatusSafe("error");
        reloadTimer.current = setTimeout(loadFreshAd, INTERSTITIAL_RELOAD_DELAY_MS);
      }
    };

    if (reloadTimer.current) clearTimeout(reloadTimer.current);
    loadFreshAd();

    return () => {
      mounted = false;
      if (reloadTimer.current) clearTimeout(reloadTimer.current);
      reloadTimer.current = null;
      clearActiveAd();
      if (transitionAdTimer.current) clearTimeout(transitionAdTimer.current);
      transitionAdTimer.current = null;
    };
  }, [canRequestAds, isBootstrapped, mobileAdsEnabled, recordFullscreenAdShown, setInterstitialStatusSafe]);

  const tryShowGlobalInterstitial = React.useCallback(() => {
    const configuredFrequency = Number(systemSettings.mobileInterstitialEveryTransitions || INTERSTITIAL_COUNT_FREQUENCY_MIN);
    const frequency = Number.isFinite(configuredFrequency)
      ? Math.min(INTERSTITIAL_COUNT_FREQUENCY_MAX, Math.max(INTERSTITIAL_COUNT_FREQUENCY_MIN, Math.floor(configuredFrequency)))
      : INTERSTITIAL_COUNT_FREQUENCY_MIN;
    const configuredInterval = Number(systemSettings.mobileInterstitialMinIntervalSeconds || 180);
    const minIntervalMs = (Number.isFinite(configuredInterval) ? Math.max(30, configuredInterval) : 180) * 1000;
    const ad = interstitialRef.current;
    const eligible = mobileAdsSupported
      && mobileAdsEnabled
      && canRequestAds
      && storageReady
      && interstitialStatusRef.current === "loaded"
      && !appOpenIsShowing
      && ad !== null
      && canShowGlobalInterstitial({
        transitionCount: pageTransitionCount.current,
        frequency,
        lastShownAt: lastInterstitialAt.current,
        now: Date.now(),
        minIntervalMs,
      });

    if (!eligible || !ad) return;

    try {
      void Promise.resolve(ad.show()).catch(() => setInterstitialStatusSafe("error"));
    } catch {
      setInterstitialStatusSafe("error");
    }
  }, [appOpenIsShowing, canRequestAds, mobileAdsEnabled, setInterstitialStatusSafe, storageReady, systemSettings.mobileInterstitialEveryTransitions, systemSettings.mobileInterstitialMinIntervalSeconds]);

  const registerPageTransition = React.useCallback(() => {
    if (!mobileAdsEnabled) {
      pageTransitionCount.current = 0;
      return;
    }

    pageTransitionCount.current += 1;
    const configuredFrequency = Number(systemSettings.mobileInterstitialEveryTransitions || INTERSTITIAL_COUNT_FREQUENCY_MIN);
    const frequency = Number.isFinite(configuredFrequency)
      ? Math.min(INTERSTITIAL_COUNT_FREQUENCY_MAX, Math.max(INTERSTITIAL_COUNT_FREQUENCY_MIN, Math.floor(configuredFrequency)))
      : INTERSTITIAL_COUNT_FREQUENCY_MIN;
    if (pageTransitionCount.current < frequency) return;

    // Let the destination screen finish rendering first; rapid tab changes
    // coalesce into one check after the user pauses, never into the animation.
    if (transitionAdTimer.current) clearTimeout(transitionAdTimer.current);
    transitionAdTimer.current = setTimeout(() => {
      transitionAdTimer.current = null;
      tryShowGlobalInterstitial();
    }, INTERSTITIAL_IDLE_DELAY_MS);
  }, [mobileAdsEnabled, systemSettings.mobileInterstitialEveryTransitions, tryShowGlobalInterstitial]);

  React.useEffect(() => {
    if (!mobileAdsSupported || !canRequestAds || !mobileAdsEnabled || !storageReady || coldStartAttempted.current) return undefined;

    const eligibleAt = lastAppOpenAt.current + APP_OPEN_COOLDOWN_MS;
    const timer = setTimeout(() => setAppOpenAllowed(true), Math.max(0, eligibleAt - Date.now()));
    return () => clearTimeout(timer);
  }, [canRequestAds, mobileAdsEnabled, storageReady]);

  React.useEffect(() => {
    if (coldStartAttempted.current || !isBootstrapped || !mobileAdsEnabled || !storageReady || !appOpenAllowed) return;
    if (appOpenStatus === "loaded") {
      coldStartAttempted.current = true;
      if (__DEV__) console.info("[Ads] Showing cold-start App Open ad");
      showAppOpen();
      return;
    }
    if (appOpenStatus === "error" || appOpenStatus === "no-fill") {
      coldStartAttempted.current = true;
    }
  }, [appOpenAllowed, appOpenStatus, isBootstrapped, mobileAdsEnabled, showAppOpen, storageReady]);

  React.useEffect(() => {
    if (__DEV__) {
      console.info("[Ads] App Open state", {
        status: appOpenStatus,
        canRequestAds,
        mobileAdsEnabled,
        appOpenAllowed,
        isBootstrapped,
        storageReady,
      });
    }
  }, [appOpenStatus, appOpenAllowed, canRequestAds, isBootstrapped, mobileAdsEnabled, storageReady]);

  React.useEffect(() => {
    if (appOpenStatus !== "showing") return;
    const now = Date.now();
    lastAppOpenAt.current = now;
    setAppOpenAllowed(false);
    void AsyncStorage.setItem(APP_OPEN_LAST_SHOWN_KEY, String(now)).catch(() => undefined);
    recordFullscreenAdShown(now);
  }, [appOpenStatus, recordFullscreenAdShown]);

  const contextValue = React.useMemo(
    () => ({ registerPageTransition }),
    [registerPageTransition],
  );
  return <AdExperienceContext.Provider value={contextValue}>{children}</AdExperienceContext.Provider>;
};

export const useAdExperience = () => React.useContext(AdExperienceContext);
