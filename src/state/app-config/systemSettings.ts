import { PRICING, PLAN_DETAILS } from '@constants/index';
import type { SystemSettings } from '@types';
import { DEFAULT_STRIPE_PAYMENT_METHODS_SETTINGS, normalizeStripePaymentMethodsSettings } from '@services/payments/stripePaymentMethodsConfig';
import { DEFAULT_PLAN_ENTITLEMENTS, DEFAULT_PLAN_USAGE_LIMITS } from '@constants/subscriptions/planEntitlements';
import {
  DEFAULT_LEGAL_COMMENTARY_FEATURE_CONFIG,
  normalizeLegalCommentaryFeatureConfig,
} from '@constants/legal-commentary/featureAccess';
import { createDefaultLandingPageContent, mergeLandingPageContent } from '@/app/landing/landingContent';
import { mergeMarketingLandingPages } from '@services/marketing/landingPages';
import { DEFAULT_EMAIL_TEMPLATES, normalizeEmailTemplates } from '@constants/email/defaultEmailTemplates';
import {
  normalizeCampaignBannerActionUrl,
  normalizePromotionNotificationActionUrl,
} from '@services/marketing/promotionCampaign';

export const DEFAULT_SYSTEM_SETTINGS: SystemSettings = {
  activeTheme: 'default',
  paymentProvider: 'stripe',
  paymentCheckoutMode: 'internal',
  cardVaultProvider: 'stripe',
  stripePaymentMethods: DEFAULT_STRIPE_PAYMENT_METHODS_SETTINGS,
  pricing: {
    Gratuito: { ...PRICING.Gratuito, quarterlyDiscountPercent: 0, annualDiscountPercent: 0 },
    Essencial: { ...PRICING.Essencial, quarterlyDiscountPercent: 10, annualDiscountPercent: 30 },
    Pro: { ...PRICING.Pro, quarterlyDiscountPercent: 10, annualDiscountPercent: 30 },
    Elite: { ...PRICING.Elite, quarterlyDiscountPercent: 10, annualDiscountPercent: 30 },
  },
  planDetails: PLAN_DETAILS,
  planEntitlements: DEFAULT_PLAN_ENTITLEMENTS,
  planUsageLimits: DEFAULT_PLAN_USAGE_LIMITS,
  legalCommentaryFeatureConfig: DEFAULT_LEGAL_COMMENTARY_FEATURE_CONFIG,
  activePromotion: {
    isActive: false,
    name: 'Black Friday',
    slug: 'black-friday',
    discountPercentage: 30,
    bannerText: '30% OFF em todos os planos anuais!',
    themeColor: '#000000',
    landingPageTitle: 'Aprovacao Garantida',
    landingPageHeadline: 'Promocao Exclusiva',
    landingPageSubheadline: 'Descontos imperdiveis nos planos Pro e Elite.',
    featuresHighlight: ['IA Ilimitada', 'Raio-X da Banca', 'Simulados'],
    notificationTitle: 'Oferta especial ConcursoMestre',
    notificationMessage: 'Aproveite a campanha ativa e acelere sua preparacao hoje.',
    notificationActionUrl: '/planos',
    emailEnabled: false,
    emailSubject: 'Sua preparacao pode ficar mais leve hoje',
    emailPreview: 'Veja a campanha ativa antes que ela termine.',
    emailBody: 'Selecionamos uma oferta para ajudar voce a continuar estudando com mais recursos.',
    siteBanners: [
      {
        id: 'banner-topbar-default',
        enabled: true,
        placement: 'topbar',
        headline: 'Oferta ativa no ConcursoMestre',
        description: 'Plano com desconto por tempo limitado.',
        ctaLabel: 'Ver oferta',
        actionUrl: '/planos',
        backgroundColor: '#0f172a',
      },
    ],
    automationRules: [
      {
        id: 'automation-recent-signup',
        enabled: false,
        condition: 'recent_signup',
        channel: 'email',
        delayHours: 24,
        subject: 'Boas-vindas ao ConcursoMestre',
        message: 'Mostre o caminho mais curto para comecar a estudar com uma oferta de entrada.',
      },
    ],
  },
  limitedOfferCountdown: {
    enabled: false,
    endsAt: '',
  },
  landingPageContent: createDefaultLandingPageContent(),
  landingPages: mergeMarketingLandingPages(undefined, 'ConcursoMestre'),
  coupons: [
    { code: 'BEMVINDO10', discountPercentage: 10, uses: 15, maxUses: 100, autoApply: false, targetType: 'all', targetId: null },
  ],
  features: {
    practiceEnabled: true,
    marketplaceEnabled: true,
    rankingsEnabled: true,
    referralEnabled: true,
    annotatedLawsEnabled: false,
    flashcardsEnabled: false,
    communityEnabled: true,
    aiCommentsEnabled: true,
    bulkImportEnabled: true,
    reportsEnabled: true,
    notificationsEnabled: true,
    simulationsEnabled: true,
    studyScheduleEnabled: true,
    maintenanceMode: false,
    registrationEnabled: true,
    landingPagePromoEnabled: true,
    xRayEnabled: true,
    loginRequired: true,
    partnerRegistrationEnabled: true,
    recurringEnabled: true,
    sameTierCycleChangeEnabled: false,
  },
  geminiApiKey: '',
  hasGeminiApiKeyConfigured: false,
  recaptchaEnabled: false,
  recaptchaSiteKey: '',
  recaptchaSecretKey: '',
  hasRecaptchaSecretConfigured: false,
  googleAuthClientId: '',
  hasGoogleAuthClientConfigured: false,
  hasSmtpPasswordConfigured: false,
  emailTemplates: DEFAULT_EMAIL_TEMPLATES,
};

const FEATURE_SETTING_KEYS = Object.keys(DEFAULT_SYSTEM_SETTINGS.features) as Array<keyof SystemSettings['features']>;

const normalizeFeatureFlag = (value: unknown, fallback: boolean): boolean => {
  if (typeof value === 'boolean') {
    return value;
  }

  if (typeof value === 'number') {
    return value !== 0;
  }

  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();

    if (['1', 'true', 'yes', 'on'].includes(normalized)) {
      return true;
    }

    if (['0', 'false', 'no', 'off', ''].includes(normalized)) {
      return false;
    }
  }

  return fallback;
};

export const mergeSystemSettings = (
  base: SystemSettings,
  incoming?: Partial<SystemSettings> | null,
): SystemSettings => {
  const payload = (incoming || {}) as Partial<SystemSettings> & Record<string, unknown>;
  const nextSettings = { ...base, ...payload } as SystemSettings;
  const incomingFeatures = (payload.features && typeof payload.features === 'object'
    ? payload.features
    : {}) as Partial<SystemSettings['features']>;
  const mergedFeatures = { ...base.features, ...incomingFeatures } as SystemSettings['features'];
  const mergedLandingPageContent = mergeLandingPageContent(
    (payload.landingPageContent as Partial<SystemSettings['landingPageContent']>) ?? base.landingPageContent,
  );
  const resolvedSiteName = typeof payload.siteName === 'string' && payload.siteName.trim() !== ''
    ? payload.siteName.trim()
    : (typeof base.siteName === 'string' && base.siteName.trim() !== '' ? base.siteName.trim() : 'ConcursoMestre');
  const mergedLandingPages = mergeMarketingLandingPages(
    (payload.landingPages as Partial<SystemSettings['landingPages']>) ?? base.landingPages,
    resolvedSiteName,
  );
  const incomingPromotion = (
    payload.activePromotion && typeof payload.activePromotion === 'object'
      ? payload.activePromotion
      : {}
  ) as Partial<SystemSettings['activePromotion']>;
  const mergedActivePromotion: SystemSettings['activePromotion'] = {
    ...base.activePromotion,
    ...incomingPromotion,
    isActive: normalizeFeatureFlag(incomingPromotion.isActive, base.activePromotion.isActive),
    featuresHighlight: Array.isArray(incomingPromotion.featuresHighlight)
      ? incomingPromotion.featuresHighlight.map((item) => String(item || '').trim()).filter(Boolean)
      : base.activePromotion.featuresHighlight,
    notificationActionUrl: normalizePromotionNotificationActionUrl(
      incomingPromotion.notificationActionUrl ?? base.activePromotion.notificationActionUrl,
      { slug: String(incomingPromotion.slug || base.activePromotion.slug || '') },
    ),
    siteBanners: (Array.isArray(incomingPromotion.siteBanners)
      ? incomingPromotion.siteBanners
      : base.activePromotion.siteBanners
    ).map((banner) => ({
      ...banner,
      actionUrl: normalizeCampaignBannerActionUrl(
        banner.actionUrl,
        { slug: String(incomingPromotion.slug || base.activePromotion.slug || '') },
      ),
    })),
    automationRules: Array.isArray(incomingPromotion.automationRules)
      ? incomingPromotion.automationRules
      : base.activePromotion.automationRules,
  };
  const incomingLimitedOfferCountdown = (
    payload.limitedOfferCountdown && typeof payload.limitedOfferCountdown === 'object'
      ? payload.limitedOfferCountdown
      : {}
  ) as Partial<SystemSettings['limitedOfferCountdown']>;
  const mergedLimitedOfferCountdown: SystemSettings['limitedOfferCountdown'] = {
    ...base.limitedOfferCountdown,
    ...incomingLimitedOfferCountdown,
    enabled: normalizeFeatureFlag(incomingLimitedOfferCountdown.enabled, base.limitedOfferCountdown.enabled),
    endsAt: typeof incomingLimitedOfferCountdown.endsAt === 'string'
      ? incomingLimitedOfferCountdown.endsAt
      : base.limitedOfferCountdown.endsAt,
  };
  const mergedStripePaymentMethods = normalizeStripePaymentMethodsSettings(
    (payload.stripePaymentMethods as Partial<SystemSettings['stripePaymentMethods']>) ?? base.stripePaymentMethods,
  );
  const mergedLegalCommentaryFeatureConfig = normalizeLegalCommentaryFeatureConfig(
    (payload.legalCommentaryFeatureConfig as Partial<SystemSettings['legalCommentaryFeatureConfig']>) ?? base.legalCommentaryFeatureConfig,
  );
  const mergedEmailTemplates = normalizeEmailTemplates(
    (payload.emailTemplates as Partial<SystemSettings['emailTemplates']>) ?? base.emailTemplates,
  );

  FEATURE_SETTING_KEYS.forEach((featureKey) => {
    const hasNestedValue = Object.prototype.hasOwnProperty.call(incomingFeatures, featureKey);
    const hasFlatValue = Object.prototype.hasOwnProperty.call(payload, featureKey);
    const candidate = hasNestedValue
      ? incomingFeatures[featureKey]
      : (hasFlatValue ? payload[featureKey as string] : mergedFeatures[featureKey]);

    mergedFeatures[featureKey] = normalizeFeatureFlag(candidate, base.features[featureKey]);
  });

  return {
    ...nextSettings,
    activePromotion: mergedActivePromotion,
    features: mergedFeatures,
    landingPageContent: mergedLandingPageContent,
    landingPages: mergedLandingPages,
    limitedOfferCountdown: mergedLimitedOfferCountdown,
    stripePaymentMethods: mergedStripePaymentMethods,
    legalCommentaryFeatureConfig: mergedLegalCommentaryFeatureConfig,
    emailTemplates: mergedEmailTemplates,
  };
};

export const sanitizePersistedSystemSettings = (settings: SystemSettings): SystemSettings => {
  const nextSettings = { ...settings };

  const stripeSecretKey = typeof nextSettings.stripeSecretKey === 'string' ? nextSettings.stripeSecretKey.trim() : '';
  if (stripeSecretKey !== '') {
    nextSettings.hasStripeSecretConfigured = true;
  }
  nextSettings.stripeSecretKey = '';

  const stripeWebhookSecret = typeof nextSettings.stripeWebhookSecret === 'string' ? nextSettings.stripeWebhookSecret.trim() : '';
  if (stripeWebhookSecret !== '') {
    nextSettings.hasStripeWebhookConfigured = true;
  }
  nextSettings.stripeWebhookSecret = '';

  const geminiApiKey = typeof nextSettings.geminiApiKey === 'string' ? nextSettings.geminiApiKey.trim() : '';
  if (geminiApiKey !== '') {
    nextSettings.hasGeminiApiKeyConfigured = true;
  }
  nextSettings.geminiApiKey = '';

  const recaptchaSecretKey = typeof nextSettings.recaptchaSecretKey === 'string' ? nextSettings.recaptchaSecretKey.trim() : '';
  if (recaptchaSecretKey !== '') {
    nextSettings.hasRecaptchaSecretConfigured = true;
  }
  nextSettings.recaptchaSecretKey = '';

  const googleClientId = typeof nextSettings.googleAuthClientId === 'string' ? nextSettings.googleAuthClientId.trim() : '';
  if (googleClientId !== '') {
    nextSettings.hasGoogleAuthClientConfigured = true;
  }

  const smtpPass = typeof nextSettings.smtpPass === 'string' ? nextSettings.smtpPass.trim() : '';
  if (smtpPass !== '') {
    nextSettings.hasSmtpPasswordConfigured = true;
  }
  nextSettings.smtpPass = '';

  return nextSettings;
};

export const resolvePersistedSystemSettings = (
  fallback: SystemSettings,
  persisted?: Partial<SystemSettings> | null,
): SystemSettings => {
  if (persisted && Object.keys(persisted).length > 0) {
    return sanitizePersistedSystemSettings(mergeSystemSettings(DEFAULT_SYSTEM_SETTINGS, persisted));
  }

  return sanitizePersistedSystemSettings(mergeSystemSettings(DEFAULT_SYSTEM_SETTINGS, fallback));
};

export default DEFAULT_SYSTEM_SETTINGS;
