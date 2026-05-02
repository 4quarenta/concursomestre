import type { Promotion } from '@types';
import { normalizeLandingSlug } from './landingPages';

const DEFAULT_CAMPAIGN_ACTION_URL = '/planos';
const PRIVATE_CAMPAIGN_PATH_PREFIXES = [
  '/admin',
  '/api',
  '/read',
];

export const normalizePromotionSlug = (value: unknown) => normalizeLandingSlug(String(value || ''));

export const isPromotionActiveForSlug = (promotion: Promotion | null | undefined, routeSlug: unknown) => {
  if (!promotion?.isActive) {
    return false;
  }

  const promotionSlug = normalizePromotionSlug(promotion.slug);
  const requestedSlug = normalizePromotionSlug(routeSlug);

  return promotionSlug !== '' && requestedSlug !== '' && promotionSlug === requestedSlug;
};

export const buildPromotionPath = (promotion: Pick<Promotion, 'slug'> | null | undefined) => {
  const slug = normalizePromotionSlug(promotion?.slug);
  return slug ? `/promo/${slug}` : '';
};

const stripUnsafeUrlText = (value: unknown) => String(value || '')
  .replace(/[\u0000-\u001F\u007F]/g, '')
  .replace(/<\/?[^>]+>/g, '')
  .trim();

const isPrivateCampaignPath = (path: string) => {
  const normalizedPath = path.toLowerCase();
  return PRIVATE_CAMPAIGN_PATH_PREFIXES.some((prefix) => (
    normalizedPath === prefix || normalizedPath.startsWith(`${prefix}/`)
  ));
};

export const sanitizeCampaignActionUrl = (value: unknown, fallback = DEFAULT_CAMPAIGN_ACTION_URL) => {
  const candidate = stripUnsafeUrlText(value);
  const safeFallback = fallback || DEFAULT_CAMPAIGN_ACTION_URL;

  if (!candidate) {
    return safeFallback;
  }

  if (candidate.startsWith('/') && !candidate.startsWith('//')) {
    const path = candidate.split(/[?#]/, 1)[0] || '/';
    return isPrivateCampaignPath(path) ? safeFallback : candidate;
  }

  if (/^https?:\/\//i.test(candidate)) {
    return candidate;
  }

  return safeFallback;
};

export const normalizeCampaignBannerActionUrl = (value: unknown, promotion?: Pick<Promotion, 'slug'> | null) => (
  sanitizeCampaignActionUrl(value, buildPromotionPath(promotion) || DEFAULT_CAMPAIGN_ACTION_URL)
);

export const normalizePromotionNotificationActionUrl = (
  value: unknown,
  promotion?: Pick<Promotion, 'slug'> | null,
) => sanitizeCampaignActionUrl(value, buildPromotionPath(promotion) || DEFAULT_CAMPAIGN_ACTION_URL);
