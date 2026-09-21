export type MobileFeatureKey =
  | 'practiceEnabled'
  | 'simulationsEnabled'
  | 'rankingsEnabled'
  | 'marketplaceEnabled'
  | 'annotatedLawsEnabled'
  | 'flashcardsEnabled'
  | 'xRayEnabled';

export interface MobileFeatureFlags {
  practiceEnabled: boolean;
  simulationsEnabled: boolean;
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
  years: string[];
}

export interface MobilePlanDetail {
  displayName?: string;
  enabled?: boolean;
}

export type MobilePlanDetailsMap = Record<string, MobilePlanDetail>;
export type MobilePlanName = 'Gratuito' | 'Essencial' | 'Pro' | 'Elite';

export interface MobilePlanPricing {
  monthly: number;
  quarterly: number;
  annual: number;
  quarterlyDiscountPercent: number;
  annualDiscountPercent: number;
}

export type MobilePlanPricingMap = Partial<Record<MobilePlanName, MobilePlanPricing>>;

export interface MobileSystemSettings {
  features: MobileFeatureFlags;
  sameTierCycleChangeEnabled: boolean;
  planDetails: MobilePlanDetailsMap;
  pricing: MobilePlanPricingMap;
  pixKey?: string;
  taxonomies: MobileGlobalTaxonomies;
}

export const DEFAULT_MOBILE_FEATURE_FLAGS: MobileFeatureFlags = {
  practiceEnabled: true,
  simulationsEnabled: true,
  rankingsEnabled: true,
  marketplaceEnabled: true,
  annotatedLawsEnabled: false,
  flashcardsEnabled: false,
  xRayEnabled: true,
};

export const DEFAULT_MOBILE_SYSTEM_SETTINGS: MobileSystemSettings = {
  features: { ...DEFAULT_MOBILE_FEATURE_FLAGS },
  sameTierCycleChangeEnabled: false,
  planDetails: {},
  pricing: {},
  pixKey: undefined,
  taxonomies: {
    agencies: [],
    roles: [],
    years: [],
  },
};
