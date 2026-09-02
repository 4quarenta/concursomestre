import { PRICING, PLAN_DETAILS } from '@constants/index';
import type { DiscountCode, MarketingLandingPage, SystemSettings } from '@types';
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
  DEFAULT_GAMIFICATION_SETTINGS,
  DEFAULT_NOTIFICATION_SETTINGS,
  normalizeGamificationSettings,
  normalizeNotificationSettings,
} from '@constants/gamificationNotificationSettings';
import {
  normalizeCampaignBannerActionUrl,
  normalizePromotionNotificationActionUrl,
} from '@services/marketing/promotionCampaign';

export const DEFAULT_SYSTEM_SETTINGS: SystemSettings = {
  platformVersion: '1.0.0',
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
    emailBody: 'Selecionamos uma oferta para ajudar você a continuar estudando com mais recursos.',
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
  coupons: [],
  features: {
    practiceEnabled: true,
    marketplaceEnabled: true,
    rankingsEnabled: true,
    referralEnabled: true,
    annotatedLawsEnabled: false,
    flashcardsEnabled: false,
    communityEnabled: true,
    supportDonationsEnabled: true,
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
    autoRefundEnabled: false,
  },
  aiProvider: 'gemini',
  geminiApiKey: '',
  geminiModel: 'gemini-3.5-flash',
  hasGeminiApiKeyConfigured: false,
  openaiApiKey: '',
  openAiModel: 'gpt-4o-mini',
  hasOpenAiApiKeyConfigured: false,
  recaptchaEnabled: false,
  recaptchaSiteKey: '',
  recaptchaSecretKey: '',
  hasRecaptchaSecretConfigured: false,
  adsEnabled: false,
  adsenseTestMode: false,
  adsenseClientId: '',
  adsTxtContent: '',
  adsenseTopSlotId: '',
  adsenseSidebarSlotId: '',
  adsenseBottomSlotId: '',
  adPlacementTopEnabled: true,
  adPlacementSidebarEnabled: true,
  adPlacementBottomEnabled: true,
  adPlacementInterstitialEnabled: true,
  adPlacementNavigationPopEnabled: false,
  facebookAdsId: '',
  adBannerTop: '',
  adBannerSidebar: '',
  adBannerBottom: '',
  adInterstitialSlotId: '',
  adNavigationPopUrl: '',
  googleAuthClientId: '',
  hasGoogleAuthClientConfigured: false,
  facebookAuthAppId: '',
  facebookAuthAppSecret: '',
  hasFacebookAuthConfigured: false,
  appleAuthClientId: '',
  appleAuthRedirectUri: '',
  hasAppleAuthConfigured: false,
  hasSmtpPasswordConfigured: false,
  emailLogoUrl: '',
  emailTemplates: DEFAULT_EMAIL_TEMPLATES,
  gamification: DEFAULT_GAMIFICATION_SETTINGS,
  notificationSettings: DEFAULT_NOTIFICATION_SETTINGS,
  legalContactEmail: 'juridico@concursomestre.ai',
  privacyContactEmail: 'dpo@concursomestre.ai',
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

const normalizeDiscountCodes = (value: unknown): DiscountCode[] => {
  if (!Array.isArray(value)) {
    return [];
  }

  const normalizeStringList = (listValue: unknown, lowercase = false) => {
    const source = typeof listValue === 'string'
      ? listValue.split(/[\r\n,;]+/)
      : Array.isArray(listValue)
        ? listValue
        : [];

    return Array.from(new Set(source
      .map((item) => String(item || '').trim())
      .filter(Boolean)
      .map((item) => (lowercase ? item.toLowerCase() : item))));
  };

  return value
    .map<DiscountCode | null>((coupon) => {
      const rawCoupon = (coupon || {}) as Partial<DiscountCode> & Record<string, unknown>;
      const code = String(rawCoupon.code || '').trim().toUpperCase();

      if (!code) {
        return null;
      }

      const targetType = rawCoupon.targetType === 'plan' || rawCoupon.targetType === 'item'
        ? rawCoupon.targetType
        : 'all';
      const targetId = targetType === 'all'
        ? null
        : String(rawCoupon.targetId || '').trim() || null;
      const discountAmount = rawCoupon.discountAmount === undefined
        ? undefined
        : Math.max(0, Number(rawCoupon.discountAmount || 0));

      const normalizedCoupon: DiscountCode = {
        code,
        discountPercentage: Math.max(0, Number(rawCoupon.discountPercentage || 0)),
        ...(discountAmount !== undefined ? { discountAmount } : {}),
        uses: Math.max(0, Number(rawCoupon.uses || 0)),
        maxUses: Math.max(0, Number(rawCoupon.maxUses || 0)),
        expiresAt: typeof rawCoupon.expiresAt === 'string' ? rawCoupon.expiresAt : undefined,
        autoApply: Boolean(rawCoupon.autoApply),
        targetType,
        targetId,
        newUsersOnly: Boolean(rawCoupon.newUsersOnly ?? rawCoupon.new_users_only),
        firstPurchaseOnly: Boolean(rawCoupon.firstPurchaseOnly ?? rawCoupon.first_purchase_only),
        allowedUserIds: normalizeStringList(rawCoupon.allowedUserIds ?? rawCoupon.allowed_user_ids),
        allowedUserEmails: normalizeStringList(rawCoupon.allowedUserEmails ?? rawCoupon.allowed_user_emails, true),
      };

      return normalizedCoupon;
    })
    .filter((coupon): coupon is DiscountCode => coupon !== null);
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
    Array.isArray(payload.landingPages)
      ? payload.landingPages.filter((page): page is MarketingLandingPage => Boolean(page))
      : base.landingPages,
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
      ? incomingPromotion.siteBanners.filter((banner): banner is NonNullable<typeof banner> => Boolean(banner))
      : base.activePromotion?.siteBanners || []
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
    Array.isArray(payload.emailTemplates)
      ? payload.emailTemplates.filter(Boolean) as unknown as Parameters<typeof normalizeEmailTemplates>[0]
      : base.emailTemplates,
  );
  const mergedGamification = normalizeGamificationSettings(
    (payload.gamification as Partial<SystemSettings['gamification']>) ?? base.gamification,
  );
  const mergedNotificationSettings = normalizeNotificationSettings(
    (payload.notificationSettings as Partial<SystemSettings['notificationSettings']>) ?? base.notificationSettings,
  );
  const mergedCoupons = normalizeDiscountCodes(
    Object.prototype.hasOwnProperty.call(payload, 'coupons')
      ? payload.coupons
      : base.coupons,
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
    gamification: mergedGamification,
    notificationSettings: mergedNotificationSettings,
    coupons: mergedCoupons,
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

  const openaiApiKey = typeof nextSettings.openaiApiKey === 'string' ? nextSettings.openaiApiKey.trim() : '';
  if (openaiApiKey !== '') {
    nextSettings.hasOpenAiApiKeyConfigured = true;
  }
  nextSettings.openaiApiKey = '';

  const aiProvider = typeof nextSettings.aiProvider === 'string' ? nextSettings.aiProvider.trim().toLowerCase() : 'gemini';
  nextSettings.aiProvider = ['gemini', 'openai', 'auto'].includes(aiProvider) ? aiProvider : 'gemini';
  if (!nextSettings.geminiModel) {
    nextSettings.geminiModel = 'gemini-3.5-flash';
  }
  if (!nextSettings.openAiModel) {
    nextSettings.openAiModel = 'gpt-4o-mini';
  }

  const recaptchaSecretKey = typeof nextSettings.recaptchaSecretKey === 'string' ? nextSettings.recaptchaSecretKey.trim() : '';
  if (recaptchaSecretKey !== '') {
    nextSettings.hasRecaptchaSecretConfigured = true;
  }
  nextSettings.recaptchaSecretKey = '';

  const googleClientId = typeof nextSettings.googleAuthClientId === 'string' ? nextSettings.googleAuthClientId.trim() : '';
  if (googleClientId !== '') {
    nextSettings.hasGoogleAuthClientConfigured = true;
  }

  const facebookAppId = typeof nextSettings.facebookAuthAppId === 'string' ? nextSettings.facebookAuthAppId.trim() : '';
  const facebookAppSecret = typeof nextSettings.facebookAuthAppSecret === 'string' ? nextSettings.facebookAuthAppSecret.trim() : '';
  if (facebookAppId !== '' && facebookAppSecret !== '') {
    nextSettings.hasFacebookAuthConfigured = true;
  }
  nextSettings.facebookAuthAppSecret = '';

  const appleClientId = typeof nextSettings.appleAuthClientId === 'string' ? nextSettings.appleAuthClientId.trim() : '';
  if (appleClientId !== '') {
    nextSettings.hasAppleAuthConfigured = true;
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
  const fallbackSettings = sanitizePersistedSystemSettings(mergeSystemSettings(DEFAULT_SYSTEM_SETTINGS, fallback));

  if (persisted && Object.keys(persisted).length > 0) {
    return sanitizePersistedSystemSettings(mergeSystemSettings(fallbackSettings, persisted));
  }

  return fallbackSettings;
};

export default DEFAULT_SYSTEM_SETTINGS;
