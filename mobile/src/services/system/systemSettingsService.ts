import { apiClient } from '@/services/api/client';
import { ENDPOINTS } from '@/services/api/endpoints';
import { readApiData } from '@/services/api/response';
import {
  DEFAULT_MOBILE_FEATURE_FLAGS,
  DEFAULT_MOBILE_SYSTEM_SETTINGS,
  type MobileFeatureFlags,
  type MobileFeatureKey,
  type MobileSystemSettings,
} from '@/types/system';

const normalizeBooleanLike = (value: unknown): boolean | null => {
  if (typeof value === 'boolean') {
    return value;
  }

  if (typeof value === 'number') {
    return value !== 0;
  }

  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (['1', 'true', 'yes', 'on'].includes(normalized)) return true;
    if (['0', 'false', 'no', 'off', ''].includes(normalized)) return false;
  }

  return null;
};

const resolveFeatureFlag = (
  payload: Record<string, unknown>,
  key: MobileFeatureKey,
  fallback: boolean,
): boolean => {
  const features = (payload.features && typeof payload.features === 'object')
    ? payload.features as Record<string, unknown>
    : {};

  const nestedValue = normalizeBooleanLike(features[key]);
  if (nestedValue !== null) {
    return nestedValue;
  }

  const flatValue = normalizeBooleanLike(payload[key]);
  if (flatValue !== null) {
    return flatValue;
  }

  return fallback;
};

const normalizeSystemSettingsPayload = (payload: Record<string, unknown>): MobileSystemSettings => {
  const normalizePixKey = () => {
    const rawValue = typeof payload.pixKey === 'string'
      ? payload.pixKey
      : typeof payload.pix_key === 'string'
        ? payload.pix_key
        : '';

    const value = rawValue.trim();
    return value || undefined;
  };

  const features: MobileFeatureFlags = {
    practiceEnabled: resolveFeatureFlag(
      payload,
      'practiceEnabled',
      DEFAULT_MOBILE_FEATURE_FLAGS.practiceEnabled,
    ),
    simulationsEnabled: resolveFeatureFlag(
      payload,
      'simulationsEnabled',
      DEFAULT_MOBILE_FEATURE_FLAGS.simulationsEnabled,
    ),
    rankingsEnabled: resolveFeatureFlag(
      payload,
      'rankingsEnabled',
      DEFAULT_MOBILE_FEATURE_FLAGS.rankingsEnabled,
    ),
    marketplaceEnabled: resolveFeatureFlag(
      payload,
      'marketplaceEnabled',
      DEFAULT_MOBILE_FEATURE_FLAGS.marketplaceEnabled,
    ),
    annotatedLawsEnabled: resolveFeatureFlag(
      payload,
      'annotatedLawsEnabled',
      DEFAULT_MOBILE_FEATURE_FLAGS.annotatedLawsEnabled,
    ),
    flashcardsEnabled: resolveFeatureFlag(
      payload,
      'flashcardsEnabled',
      DEFAULT_MOBILE_FEATURE_FLAGS.flashcardsEnabled,
    ),
    xRayEnabled: resolveFeatureFlag(
      payload,
      'xRayEnabled',
      DEFAULT_MOBILE_FEATURE_FLAGS.xRayEnabled,
    ),
  };

  return {
    features,
    pixKey: normalizePixKey(),
  };
};

const pickSettingsPayload = (response: any): Record<string, unknown> => {
  const data = readApiData<Record<string, unknown>>(response, {});
  if (data && typeof data === 'object') {
    return data;
  }

  if (response && typeof response === 'object') {
    return response as Record<string, unknown>;
  }

  return {};
};

export const systemSettingsService = {
  async getSystemSettings(): Promise<MobileSystemSettings> {
    const response = await apiClient.get<any>(ENDPOINTS.settings.get, {
      params: {
        _: Date.now(),
      },
    });

    return normalizeSystemSettingsPayload(pickSettingsPayload(response));
  },

  createDefaultSystemSettings(): MobileSystemSettings {
    return {
      features: { ...DEFAULT_MOBILE_SYSTEM_SETTINGS.features },
      pixKey: DEFAULT_MOBILE_SYSTEM_SETTINGS.pixKey,
    };
  },
};

export default systemSettingsService;
