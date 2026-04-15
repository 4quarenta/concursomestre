export type MobileFeatureKey = 'annotatedLawsEnabled' | 'flashcardsEnabled' | 'xRayEnabled';

export interface MobileFeatureFlags {
  annotatedLawsEnabled: boolean;
  flashcardsEnabled: boolean;
  xRayEnabled: boolean;
}

export interface MobileSystemSettings {
  features: MobileFeatureFlags;
}

export const DEFAULT_MOBILE_FEATURE_FLAGS: MobileFeatureFlags = {
  annotatedLawsEnabled: false,
  flashcardsEnabled: false,
  xRayEnabled: true,
};

export const DEFAULT_MOBILE_SYSTEM_SETTINGS: MobileSystemSettings = {
  features: { ...DEFAULT_MOBILE_FEATURE_FLAGS },
};
