import { PLAN_DETAILS, PRICING } from '@/constants';
import { createDefaultLandingPageContent } from '@/components/landing/landingContent';
import { createDefaultEliteLandingPage, createDefaultPlansLandingPage } from '@/services/marketing/landingPages';
import type { MarketingLandingPage, SystemSettings } from '@/types';

const DEFAULT_SITE_NAME = 'ConcursoMestre';

const buildDefaultPricing = (): SystemSettings['pricing'] => ({
  Gratuito: { ...PRICING.Gratuito, quarterlyDiscountPercent: 0, annualDiscountPercent: 0 },
  Essencial: { ...PRICING.Essencial, quarterlyDiscountPercent: 10, annualDiscountPercent: 30 },
  Pro: { ...PRICING.Pro, quarterlyDiscountPercent: 10, annualDiscountPercent: 30 },
  Elite: { ...PRICING.Elite, quarterlyDiscountPercent: 10, annualDiscountPercent: 30 },
});

const buildDefaultLandingPages = (siteName: string): MarketingLandingPage[] => ([
  createDefaultPlansLandingPage(siteName),
  createDefaultEliteLandingPage(siteName),
]);

export const createPublicSystemSettings = (siteName = DEFAULT_SITE_NAME): SystemSettings => ({
  activeTheme: 'default',
  paymentProvider: 'stripe',
  paymentCheckoutMode: 'internal',
  cardVaultProvider: 'stripe',
  pricing: buildDefaultPricing(),
  planDetails: PLAN_DETAILS,
  activePromotion: {
    isActive: false,
    name: '',
    slug: '',
    discountPercentage: 0,
    bannerText: '',
    themeColor: '#4F46E5',
    landingPageTitle: '',
    landingPageHeadline: '',
    landingPageSubheadline: '',
    featuresHighlight: [],
  },
  limitedOfferCountdown: {
    enabled: false,
    endsAt: '',
  },
  landingPageContent: createDefaultLandingPageContent(),
  landingPages: buildDefaultLandingPages(siteName),
  coupons: [],
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
    maintenanceMode: false,
    registrationEnabled: true,
    landingPagePromoEnabled: true,
    xRayEnabled: true,
    loginRequired: true,
    partnerRegistrationEnabled: true,
    recurringEnabled: true,
    sameTierCycleChangeEnabled: false,
  },
  siteName,
});

export const mergePublicSystemSettings = (
  incoming?: Partial<SystemSettings> | null,
): SystemSettings => {
  const resolvedSiteName = String(incoming?.siteName || '').trim() || DEFAULT_SITE_NAME;
  const defaults = createPublicSystemSettings(resolvedSiteName);

  return {
    ...defaults,
    ...incoming,
    siteName: resolvedSiteName,
    pricing: {
      ...defaults.pricing,
      ...(incoming?.pricing || {}),
    },
    planDetails: {
      ...defaults.planDetails,
      ...(incoming?.planDetails || {}),
    },
    activePromotion: {
      ...defaults.activePromotion,
      ...(incoming?.activePromotion || {}),
      featuresHighlight: Array.isArray(incoming?.activePromotion?.featuresHighlight)
        ? incoming.activePromotion.featuresHighlight
        : defaults.activePromotion.featuresHighlight,
    },
    limitedOfferCountdown: {
      ...defaults.limitedOfferCountdown,
      ...(incoming?.limitedOfferCountdown || {}),
    },
    landingPageContent: incoming?.landingPageContent || defaults.landingPageContent,
    landingPages: Array.isArray(incoming?.landingPages) && incoming.landingPages.length > 0
      ? incoming.landingPages
      : defaults.landingPages,
    coupons: Array.isArray(incoming?.coupons) ? incoming.coupons : defaults.coupons,
    features: {
      ...defaults.features,
      ...(incoming?.features || {}),
    },
    seo: incoming?.seo || defaults.seo,
  };
};

