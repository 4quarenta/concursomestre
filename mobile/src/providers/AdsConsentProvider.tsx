import React from "react";
import { Platform } from "react-native";
import {
  AdsConsent,
  AdsConsentPrivacyOptionsRequirementStatus,
  type AdsConsentInfo,
} from "react-native-google-mobile-ads";
import mobileAds from "react-native-google-mobile-ads";
import { AdExperienceProvider } from "@/providers/AdExperienceProvider";
import { AdsConsentContext, type AdsConsentContextValue } from "@/providers/AdsConsentContext";

export { useAdsConsent } from "@/providers/AdsConsentContext";

let sdkInitialization: Promise<boolean> | null = null;

const initializeAdsSdk = (): Promise<boolean> => {
  if (!sdkInitialization) {
    sdkInitialization = mobileAds()
      .initialize()
      .then(() => true)
      .catch((error: unknown) => {
        if (__DEV__) console.warn("[AdsConsent] Mobile Ads SDK initialization failed", error);
        return false;
      });
  }
  return sdkInitialization;
};

export const AdsConsentProvider: React.FC<React.PropsWithChildren> = ({ children }) => {
  const [consentInfo, setConsentInfo] = React.useState<AdsConsentInfo | null>(null);
  const [sdkReady, setSdkReady] = React.useState(false);
  const [consentRequestFailed, setConsentRequestFailed] = React.useState(false);
  const [isConsentLoading, setIsConsentLoading] = React.useState(false);
  const consentRequestInFlight = React.useRef(false);

  const applyConsentInfo = React.useCallback(async (info: AdsConsentInfo | null) => {
    setConsentInfo(info);
    if (Platform.OS !== "android" || !info?.canRequestAds) {
      setSdkReady(false);
      return;
    }
    setSdkReady(await initializeAdsSdk());
  }, []);

  const retryConsent = React.useCallback(async () => {
    if (Platform.OS !== "android" || consentRequestInFlight.current) return;
    consentRequestInFlight.current = true;
    setConsentRequestFailed(false);
    setIsConsentLoading(true);
    try {
      const updatedInfo = await AdsConsent.gatherConsent();
      if (__DEV__) {
        console.info("[AdsConsent] UMP result", {
          status: updatedInfo.status,
          canRequestAds: updatedInfo.canRequestAds,
          privacyOptionsRequirementStatus: updatedInfo.privacyOptionsRequirementStatus,
          isConsentFormAvailable: updatedInfo.isConsentFormAvailable,
        });
      }
      await applyConsentInfo(updatedInfo);
      setConsentRequestFailed(false);
    } catch (error: unknown) {
      if (__DEV__) console.warn("[AdsConsent] UMP request failed", error);
      // Keep previously stored UMP decisions, but fail closed if no valid
      // permission to request ads is available.
      const previousInfo = await AdsConsent.getConsentInfo().catch(() => null);
      if (__DEV__ && previousInfo) {
        console.info("[AdsConsent] using cached UMP result", {
          status: previousInfo.status,
          canRequestAds: previousInfo.canRequestAds,
          privacyOptionsRequirementStatus: previousInfo.privacyOptionsRequirementStatus,
          isConsentFormAvailable: previousInfo.isConsentFormAvailable,
        });
      }
      await applyConsentInfo(previousInfo);
      setConsentRequestFailed(!previousInfo?.canRequestAds);
    } finally {
      consentRequestInFlight.current = false;
      setIsConsentLoading(false);
    }
  }, [applyConsentInfo]);

  React.useEffect(() => {
    if (Platform.OS === "android") void retryConsent();
  }, [retryConsent]);

  const showPrivacyOptions = React.useCallback(async () => {
    if (Platform.OS !== "android" || !consentInfo?.privacyOptionsRequirementStatus) return;
    try {
      const updatedInfo = await AdsConsent.showPrivacyOptionsForm();
      await applyConsentInfo(updatedInfo);
    } catch {
      // A dismissed or unavailable UMP form should not crash Settings.
    }
  }, [applyConsentInfo, consentInfo?.privacyOptionsRequirementStatus]);

  const value = React.useMemo<AdsConsentContextValue>(() => ({
    canRequestAds: sdkReady && Boolean(consentInfo?.canRequestAds),
    isConsentReady: Boolean(consentInfo),
    consentRequestFailed,
    isConsentLoading,
    privacyOptionsRequired:
      Platform.OS === "android" &&
      consentInfo?.privacyOptionsRequirementStatus === AdsConsentPrivacyOptionsRequirementStatus.REQUIRED,
    retryConsent,
    showPrivacyOptions,
  }), [consentInfo, consentRequestFailed, isConsentLoading, retryConsent, sdkReady, showPrivacyOptions]);

  return (
    <AdsConsentContext.Provider value={value}>
      <AdExperienceProvider>{children}</AdExperienceProvider>
    </AdsConsentContext.Provider>
  );
};
