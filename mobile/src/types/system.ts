export type MobileFeatureKey =
  | 'practiceEnabled'
  | 'simulationsEnabled'
  | 'studyScheduleEnabled'
  | 'rankingsEnabled'
  | 'marketplaceEnabled'
  | 'annotatedLawsEnabled'
  | 'flashcardsEnabled'
  | 'xRayEnabled';

export interface MobileFeatureFlags {
  practiceEnabled: boolean;
  simulationsEnabled: boolean;
  studyScheduleEnabled: boolean;
  rankingsEnabled: boolean;
  marketplaceEnabled: boolean;
  annotatedLawsEnabled: boolean;
  flashcardsEnabled: boolean;
  xRayEnabled: boolean;
}

export interface MobileTaxonomyItem {
  id: string;
  name: string;
  slug?: string;
}

export interface MobileGlobalTaxonomies {
  agencies: MobileTaxonomyItem[];
  roles: MobileTaxonomyItem[];
  careers: MobileTaxonomyItem[];
  years: string[];
}

export interface MobilePlanDetail {
  displayName?: string;
  enabled?: boolean;
}

export type MobilePlanDetailsMap = Record<string, MobilePlanDetail>;
export type MobilePlanName = 'Gratuito' | 'Essencial' | 'Pro' | 'Elite';

export type MobilePlanEntitlementValue = boolean | { enabled?: boolean };
export type MobilePlanEntitlements = Partial<
  Record<MobilePlanName, Record<string, MobilePlanEntitlementValue>>
>;

export interface MobilePlanUsageLimitValue {
  mode: 'limited' | 'unlimited';
  value: number | null;
}

export type MobilePlanUsageLimits = Partial<
  Record<MobilePlanName, Record<string, MobilePlanUsageLimitValue>>
>;

export interface MobileAppUpdatePolicy {
  enabled: boolean;
  latestVersion: string;
  minimumVersion: string;
  message: string;
  androidStoreUrl: string;
  iosStoreUrl: string;
}

export interface MobilePlanPricing {
  monthly: number;
  quarterly: number;
  annual: number;
  quarterlyDiscountPercent: number;
  annualDiscountPercent: number;
}

export type MobilePlanPricingMap = Partial<Record<MobilePlanName, MobilePlanPricing>>;

export interface MobileSystemSettings {
  mobileAppUpdatePolicy: MobileAppUpdatePolicy;
  mobileAdsEnabled: boolean;
  mobileInterstitialEveryTransitions: number;
  mobileInterstitialMinIntervalSeconds: number;
  /** @deprecated use mobileInterstitialEveryTransitions */
  mobileInterstitialEveryQuestions: number;
  features: MobileFeatureFlags;
  recaptchaEnabled: boolean;
  recaptchaAndroidSiteKey?: string;
  googleAuthClientId?: string;
  sameTierCycleChangeEnabled: boolean;
  planDetails: MobilePlanDetailsMap;
  pricing: MobilePlanPricingMap;
  planEntitlements: MobilePlanEntitlements;
  planUsageLimits: MobilePlanUsageLimits;
  pixKey?: string;
  taxonomies: MobileGlobalTaxonomies;
}

export const DEFAULT_MOBILE_FEATURE_FLAGS: MobileFeatureFlags = {
  practiceEnabled: true,
  simulationsEnabled: true,
  studyScheduleEnabled: true,
  rankingsEnabled: true,
  marketplaceEnabled: true,
  annotatedLawsEnabled: false,
  flashcardsEnabled: false,
  xRayEnabled: true,
};

export const DEFAULT_MOBILE_SYSTEM_SETTINGS: MobileSystemSettings = {
  mobileAdsEnabled: true,
  mobileInterstitialEveryTransitions: 2,
  mobileInterstitialMinIntervalSeconds: 180,
  mobileInterstitialEveryQuestions: 2,
  mobileAppUpdatePolicy: {
    enabled: false,
    latestVersion: '',
    minimumVersion: '',
    message: '',
    androidStoreUrl: '',
    iosStoreUrl: '',
  },
  features: { ...DEFAULT_MOBILE_FEATURE_FLAGS },
  recaptchaEnabled: false,
  recaptchaAndroidSiteKey: undefined,
  googleAuthClientId: undefined,
  sameTierCycleChangeEnabled: false,
  planDetails: {},
  pricing: {},
  planEntitlements: {},
  planUsageLimits: {},
  pixKey: undefined,
  taxonomies: {
    agencies: [],
    roles: [],
    careers: [],
    years: [],
  },
};
