import { apiClient } from '@/services/api/client';
import { ENDPOINTS } from '@/services/api/endpoints';
import { readApiData } from '@/services/api/response';
import {
  DEFAULT_MOBILE_FEATURE_FLAGS,
  DEFAULT_MOBILE_SYSTEM_SETTINGS,
  type MobileFeatureFlags,
  type MobileFeatureKey,
  type MobileGlobalTaxonomies,
  type MobileTaxonomyItem,
  type MobilePlanDetailsMap,
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

const normalizeTaxonomyItems = (value: unknown): MobileTaxonomyItem[] => {
  if (!Array.isArray(value)) return [];

  return value
    .map((entry, index) => {
      if (typeof entry === 'string') {
        const name = entry.trim();
        if (!name) return null;

        return {
          id: name || `taxonomy-${index}`,
          name,
        } satisfies MobileTaxonomyItem;
      }

      if (!entry || typeof entry !== 'object') return null;

      const row = entry as Record<string, unknown>;
      const name = String(row.name || row.nome || '').trim();
      if (!name) return null;

      return {
        id: String(row.id || row.slug || name || `taxonomy-${index}`),
        name,
        slug: typeof row.slug === 'string' ? row.slug : undefined,
      } satisfies MobileTaxonomyItem;
    })
    .filter((item): item is MobileTaxonomyItem => Boolean(item));
};

const normalizeYears = (value: unknown): string[] => {
  if (!Array.isArray(value)) return [];

  const uniqueYears = new Set<string>();
  value.forEach((entry) => {
    const year = String(entry || '').trim();
    if (year) {
      uniqueYears.add(year);
    }
  });

  return [...uniqueYears].sort((left, right) => right.localeCompare(left));
};

const normalizeTaxonomies = (payload: Record<string, unknown>): MobileGlobalTaxonomies => {
  const source = payload.taxonomies && typeof payload.taxonomies === 'object'
    ? payload.taxonomies as Record<string, unknown>
    : payload;

  const agencies = normalizeTaxonomyItems(source.agencies);
  const roles = normalizeTaxonomyItems(source.roles);
  const years = normalizeYears(source.years);

  return { agencies, roles, years };
};

const normalizePlanDetails = (payload: Record<string, unknown>): MobilePlanDetailsMap => {
  if (!payload.planDetails || typeof payload.planDetails !== 'object') {
    return {};
  }

  const source = payload.planDetails as Record<string, unknown>;
  return Object.entries(source).reduce<MobilePlanDetailsMap>((accumulator, [key, value]) => {
    if (!value || typeof value !== 'object') {
      return accumulator;
    }

    const detail = value as Record<string, unknown>;
    const displayName = typeof detail.displayName === 'string'
      ? detail.displayName.trim()
      : '';
    const enabled = normalizeBooleanLike(detail.enabled);

    accumulator[key] = {
      displayName: displayName || undefined,
      enabled: enabled !== null ? enabled : undefined,
    };

    return accumulator;
  }, {});
};

const resolveBooleanSetting = (
  payload: Record<string, unknown>,
  key: string,
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
    sameTierCycleChangeEnabled: resolveBooleanSetting(payload, 'sameTierCycleChangeEnabled', false),
    planDetails: normalizePlanDetails(payload),
    pixKey: normalizePixKey(),
    taxonomies: normalizeTaxonomies(payload),
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
      sameTierCycleChangeEnabled: DEFAULT_MOBILE_SYSTEM_SETTINGS.sameTierCycleChangeEnabled,
      planDetails: { ...DEFAULT_MOBILE_SYSTEM_SETTINGS.planDetails },
      pixKey: DEFAULT_MOBILE_SYSTEM_SETTINGS.pixKey,
      taxonomies: {
        agencies: [...DEFAULT_MOBILE_SYSTEM_SETTINGS.taxonomies.agencies],
        roles: [...DEFAULT_MOBILE_SYSTEM_SETTINGS.taxonomies.roles],
        years: [...DEFAULT_MOBILE_SYSTEM_SETTINGS.taxonomies.years],
      },
    };
  },
};

export default systemSettingsService;
