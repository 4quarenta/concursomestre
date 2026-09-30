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
  type MobilePlanEntitlements,
  type MobilePlanName,
  type MobilePlanPricing,
  type MobilePlanPricingMap,
  type MobilePlanUsageLimits,
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
  const careers = normalizeTaxonomyItems(source.careers);
  const years = normalizeYears(source.years);

  return { agencies, roles, careers, years };
};

const normalizePlanDetails = (payload: Record<string, unknown>): MobilePlanDetailsMap => {
  const plans = payload.plans && typeof payload.plans === 'object'
    ? payload.plans as Record<string, unknown>
    : {};
  const rawPlanDetails = payload.planDetails ?? plans.planDetails;

  if (!rawPlanDetails || typeof rawPlanDetails !== 'object') {
    return {};
  }

  const source = rawPlanDetails as Record<string, unknown>;
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

const normalizePlanPricing = (payload: Record<string, unknown>): MobilePlanPricingMap => {
  const plans = payload.plans && typeof payload.plans === 'object'
    ? payload.plans as Record<string, unknown>
    : {};
  const rawPricing = payload.pricing ?? plans.pricing;

  if (!rawPricing || typeof rawPricing !== 'object') {
    return {};
  }

  const source = rawPricing as Record<string, unknown>;
  return Object.entries(source).reduce<MobilePlanPricingMap>((accumulator, [key, value]) => {
    if (!value || typeof value !== 'object') {
      return accumulator;
    }

    const normalizedKey = String(key || '').trim() as MobilePlanName;
    if (!['Gratuito', 'Essencial', 'Pro', 'Elite'].includes(normalizedKey)) {
      return accumulator;
    }

    const pricing = value as Record<string, unknown>;
    accumulator[normalizedKey] = {
      monthly: Number(pricing.monthly || 0),
      quarterly: Number(pricing.quarterly || 0),
      annual: Number(pricing.annual || 0),
      quarterlyDiscountPercent: Number(pricing.quarterlyDiscountPercent || pricing.quarterly_discount_percent || 0),
      annualDiscountPercent: Number(pricing.annualDiscountPercent || pricing.annual_discount_percent || 0),
    } satisfies MobilePlanPricing;

    return accumulator;
  }, {});
};

const readPlansSettings = (payload: Record<string, unknown>) =>
  payload.plans && typeof payload.plans === 'object'
    ? payload.plans as Record<string, unknown>
    : {};

const isMobilePlanName = (value: string): value is MobilePlanName =>
  ['Gratuito', 'Essencial', 'Pro', 'Elite'].includes(value);

const normalizePlanEntitlements = (
  payload: Record<string, unknown>,
): MobilePlanEntitlements => {
  const plans = readPlansSettings(payload);
  const rawEntitlements = payload.planEntitlements ?? plans.planEntitlements;
  if (!rawEntitlements || typeof rawEntitlements !== 'object') return {};

  return Object.entries(rawEntitlements as Record<string, unknown>).reduce<MobilePlanEntitlements>(
    (result, [planName, rawPlan]) => {
      if (!isMobilePlanName(planName) || !rawPlan || typeof rawPlan !== 'object') {
        return result;
      }

      const entitlements = Object.entries(rawPlan as Record<string, unknown>).reduce<
        Record<string, boolean | { enabled?: boolean }>
      >((normalized, [key, rawValue]) => {
        const enabled = rawValue && typeof rawValue === 'object'
          ? normalizeBooleanLike((rawValue as Record<string, unknown>).enabled)
          : normalizeBooleanLike(rawValue);
        if (enabled !== null) normalized[key] = { enabled };
        return normalized;
      }, {});

      result[planName] = entitlements;
      return result;
    },
    {},
  );
};

const normalizePlanUsageLimits = (
  payload: Record<string, unknown>,
): MobilePlanUsageLimits => {
  const plans = readPlansSettings(payload);
  const rawLimits = payload.planUsageLimits ?? plans.planUsageLimits;
  if (!rawLimits || typeof rawLimits !== 'object') return {};

  return Object.entries(rawLimits as Record<string, unknown>).reduce<MobilePlanUsageLimits>(
    (result, [planName, rawPlan]) => {
      if (!isMobilePlanName(planName) || !rawPlan || typeof rawPlan !== 'object') {
        return result;
      }

      const limits = Object.entries(rawPlan as Record<string, unknown>).reduce<
        Record<string, { mode: 'limited' | 'unlimited'; value: number | null }>
      >((normalized, [key, rawValue]) => {
        if (!rawValue || typeof rawValue !== 'object') return normalized;
        const row = rawValue as Record<string, unknown>;
        const isUnlimited = String(row.mode || '').toLowerCase() === 'unlimited';
        const rawNumber = Number(row.value);
        normalized[key] = {
          mode: isUnlimited ? 'unlimited' : 'limited',
          value: isUnlimited
            ? null
            : Number.isFinite(rawNumber)
              ? Math.max(0, rawNumber)
              : 0,
        };
        return normalized;
      }, {});

      result[planName] = limits;
      return result;
    },
    {},
  );
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
  const rawUpdatePolicy = payload.mobileAppUpdatePolicy && typeof payload.mobileAppUpdatePolicy === 'object'
    ? payload.mobileAppUpdatePolicy as Record<string, unknown>
    : {};
  const authentication = payload.authentication && typeof payload.authentication === 'object'
    ? payload.authentication as Record<string, unknown>
    : {};
  const recaptcha = authentication.recaptcha && typeof authentication.recaptcha === 'object'
    ? authentication.recaptcha as Record<string, unknown>
    : {};
  const recaptchaEnabled = normalizeBooleanLike(recaptcha.enabled ?? payload.recaptchaEnabled);
  const recaptchaAndroidSiteKey = String(
    recaptcha.androidSiteKey ?? payload.recaptchaAndroidSiteKey ?? '',
  ).trim();
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
    studyScheduleEnabled: resolveFeatureFlag(
      payload,
      'studyScheduleEnabled',
      DEFAULT_MOBILE_FEATURE_FLAGS.studyScheduleEnabled,
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
    mobileAppUpdatePolicy: {
      enabled: normalizeBooleanLike(rawUpdatePolicy.enabled) ?? false,
      latestVersion: String(rawUpdatePolicy.latestVersion || '').trim(),
      minimumVersion: String(rawUpdatePolicy.minimumVersion || '').trim(),
      message: String(rawUpdatePolicy.message || '').trim(),
      androidStoreUrl: String(rawUpdatePolicy.androidStoreUrl || '').trim(),
      iosStoreUrl: String(rawUpdatePolicy.iosStoreUrl || '').trim(),
    },
    features,
    recaptchaEnabled: recaptchaEnabled ?? false,
    recaptchaAndroidSiteKey: recaptchaAndroidSiteKey || undefined,
    sameTierCycleChangeEnabled: resolveBooleanSetting(payload, 'sameTierCycleChangeEnabled', false),
    planDetails: normalizePlanDetails(payload),
    pricing: normalizePlanPricing(payload),
    planEntitlements: normalizePlanEntitlements(payload),
    planUsageLimits: normalizePlanUsageLimits(payload),
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
      mobileAppUpdatePolicy: { ...DEFAULT_MOBILE_SYSTEM_SETTINGS.mobileAppUpdatePolicy },
      features: { ...DEFAULT_MOBILE_SYSTEM_SETTINGS.features },
      recaptchaEnabled: DEFAULT_MOBILE_SYSTEM_SETTINGS.recaptchaEnabled,
      recaptchaAndroidSiteKey: DEFAULT_MOBILE_SYSTEM_SETTINGS.recaptchaAndroidSiteKey,
      sameTierCycleChangeEnabled: DEFAULT_MOBILE_SYSTEM_SETTINGS.sameTierCycleChangeEnabled,
      planDetails: { ...DEFAULT_MOBILE_SYSTEM_SETTINGS.planDetails },
      pricing: { ...DEFAULT_MOBILE_SYSTEM_SETTINGS.pricing },
      planEntitlements: { ...DEFAULT_MOBILE_SYSTEM_SETTINGS.planEntitlements },
      planUsageLimits: { ...DEFAULT_MOBILE_SYSTEM_SETTINGS.planUsageLimits },
      pixKey: DEFAULT_MOBILE_SYSTEM_SETTINGS.pixKey,
      taxonomies: {
        agencies: [...DEFAULT_MOBILE_SYSTEM_SETTINGS.taxonomies.agencies],
        roles: [...DEFAULT_MOBILE_SYSTEM_SETTINGS.taxonomies.roles],
        careers: [...DEFAULT_MOBILE_SYSTEM_SETTINGS.taxonomies.careers],
        years: [...DEFAULT_MOBILE_SYSTEM_SETTINGS.taxonomies.years],
      },
    };
  },
};

export default systemSettingsService;
