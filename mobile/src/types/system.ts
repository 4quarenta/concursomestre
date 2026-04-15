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

export interface MobileSystemSettings {
  features: MobileFeatureFlags;
  sameTierCycleChangeEnabled: boolean;
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
  pixKey: undefined,
  taxonomies: {
    agencies: [],
    roles: [],
    years: [],
  },
};
