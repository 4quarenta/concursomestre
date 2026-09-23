import type { Promotion } from '@types';
import { normalizeLandingSlug } from './landingPages';
import { isCampaignWithinWindow } from './marketingConversion';

const DEFAULT_CAMPAIGN_ACTION_URL = '/planos';
const PRIVATE_CAMPAIGN_PATH_PREFIXES = [
  '/admin',
  '/api',
  '/read',
];

export const normalizePromotionSlug = (value: unknown) => normalizeLandingSlug(String(value || ''));

/**
 * A oferta global so pode publicar copy promocional quando a campanha esta
 * explicitamente ativa e dentro da janela configurada. O tema visual pode
 * continuar selecionado separadamente, mas nunca deve reutilizar o texto de
 * uma oferta pausada ou encerrada.
 */
export const isPromotionRuntimeActive = (
  promotion: Pick<Promotion, 'isActive' | 'status' | 'startsAt' | 'endsAt'> | null | undefined,
  now = new Date(),
) => {
  if (!promotion?.isActive) {
    return false;
  }

  return isCampaignWithinWindow({
    status: promotion.status || 'active',
    startsAt: promotion.startsAt,
    endsAt: promotion.endsAt,
  }, now);
};

export type PromotionRuntimeState = 'draft' | 'scheduled' | 'active' | 'paused' | 'ended' | 'archived';

export const resolvePromotionRuntimeState = (
  promotion: Pick<Promotion, 'isActive' | 'status' | 'startsAt' | 'endsAt'> | null | undefined,
  now = new Date(),
): PromotionRuntimeState => {
  const status = promotion?.status || (promotion?.isActive ? 'active' : 'paused');

  if (status === 'draft' || status === 'archived' || status === 'paused') {
    return status;
  }

  if (status === 'ended') {
    return 'ended';
  }

  if (!promotion?.isActive) {
    return 'paused';
  }

  if (!isCampaignWithinWindow({
    status,
    startsAt: promotion.startsAt,
    endsAt: promotion.endsAt,
  }, now)) {
    const endsAt = promotion.endsAt ? new Date(promotion.endsAt).getTime() : null;
    if (endsAt !== null && Number.isFinite(endsAt) && now.getTime() >= endsAt) {
      return 'ended';
    }
    return 'scheduled';
  }

  return 'active';
};

export const PROMOTION_RUNTIME_STATE_LABELS: Record<PromotionRuntimeState, string> = {
  draft: 'Rascunho',
  scheduled: 'Agendada',
  active: 'Publicada agora',
  paused: 'Pausada',
  ended: 'Encerrada',
  archived: 'Arquivada',
};

export const isPromotionActiveForSlug = (promotion: Promotion | null | undefined, routeSlug: unknown) => {
  if (!promotion) {
    return false;
  }

  const promotionSlug = normalizePromotionSlug(promotion.slug);
  const requestedSlug = normalizePromotionSlug(routeSlug);

  if (promotionSlug === '' || requestedSlug === '' || promotionSlug !== requestedSlug) {
    return false;
  }

  return isPromotionRuntimeActive(promotion);
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
