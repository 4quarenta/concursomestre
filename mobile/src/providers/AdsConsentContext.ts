import React from "react";

export type AdsConsentContextValue = {
  canRequestAds: boolean;
  isConsentReady: boolean;
  consentRequestFailed: boolean;
  isConsentLoading: boolean;
  privacyOptionsRequired: boolean;
  retryConsent: () => Promise<void>;
  showPrivacyOptions: () => Promise<void>;
};

export const AdsConsentContext = React.createContext<AdsConsentContextValue>({
  canRequestAds: false,
  isConsentReady: false,
  consentRequestFailed: false,
  isConsentLoading: false,
  privacyOptionsRequired: false,
  retryConsent: async () => undefined,
  showPrivacyOptions: async () => undefined,
});

export const useAdsConsent = () => React.useContext(AdsConsentContext);

