import type { Metadata } from 'next';
import type { Promotion } from '@types';
import { buildSiteUrl, normalizeSiteUrl } from '../../config/siteUrl';
import { websiteManifest } from '../../config/platform';
import { buildPromotionPath, isPromotionActiveForSlug } from './promotionCampaign';

const FETCH_TIMEOUT_MS = 3500;

const readEnv = (key: string): string => {
  if (typeof process === 'undefined' || !process.env) {
    return '';
  }

  const value = process.env[key];
  return typeof value === 'string' ? value.trim() : '';
};

const getApiBaseUrl = () => normalizeSiteUrl(
  readEnv('NEXT_PUBLIC_API_BASE_URL')
    || readEnv('API_BASE_URL')
    || 'http://localhost/questao-pro-backend/api/',
  'http://localhost/questao-pro-backend/api/',
);

const stripMetadataText = (value: unknown, fallback: string) => {
  const normalized = String(value || '')
    .replace(/[\u0000-\u001F\u007F]/g, ' ')
    .replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?>[\s\S]*?<\/style>/gi, ' ')
    .replace(/<\/?[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  return normalized || fallback;
};

const readEnvelopeData = (payload: unknown): Record<string, any> => {
  if (!payload || typeof payload !== 'object') {
    return {};
  }

  if (Object.prototype.hasOwnProperty.call(payload, 'data')) {
    const data = (payload as { data?: unknown }).data;
    return data && typeof data === 'object' ? data as Record<string, any> : {};
  }

  return payload as Record<string, any>;
};

const fetchPublicSettingsForPromotionSeo = async (): Promise<Record<string, any>> => {
  if (typeof fetch !== 'function') {
    return {};
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    const response = await fetch(new URL('settings.php', getApiBaseUrl()).toString(), {
      cache: 'no-store',
      headers: {
        Accept: 'application/json',
      },
      signal: controller.signal,
    });

    if (!response.ok) {
      return {};
    }

    return readEnvelopeData(await response.json());
  } catch {
    return {};
  } finally {
    clearTimeout(timeout);
  }
};

export const resolveActivePromotionForSeo = async (slug: string) => {
  const settings = await fetchPublicSettingsForPromotionSeo();
  const siteName = stripMetadataText(settings.siteName, websiteManifest.website.applicationName || 'ConcursoMestre');
  const promotion = settings.activePromotion as Promotion | undefined;
  const promoEnabled = settings.features?.landingPagePromoEnabled !== false;

  return {
    promotion: promoEnabled && isPromotionActiveForSlug(promotion, slug) ? promotion || null : null,
    siteName,
  };
};

export const buildPromotionMetadata = async (slug: string): Promise<Metadata> => {
  const { promotion, siteName } = await resolveActivePromotionForSeo(slug);

  if (!promotion) {
    return {
      title: `Promocao indisponivel | ${siteName}`,
      description: 'Esta campanha nao esta ativa ou o link acessado nao corresponde a promocao publicada.',
      robots: {
        index: false,
        follow: false,
        googleBot: {
          index: false,
          follow: false,
        },
      },
    };
  }

  const promotionPath = buildPromotionPath(promotion);
  const canonical = buildSiteUrl(promotionPath || `/promo/${slug}`);
  const title = stripMetadataText(
    promotion.landingPageTitle || promotion.name,
    `${promotion.name || 'Promocao'} | ${siteName}`,
  );
  const description = stripMetadataText(
    promotion.landingPageSubheadline || promotion.bannerText,
    'Campanha ativa para estudar com mais recursos no ConcursoMestre.',
  );

  return {
    title,
    description,
    alternates: {
      canonical,
    },
    robots: {
      index: true,
      follow: true,
    },
    openGraph: {
      title,
      description,
      url: canonical,
      siteName,
      locale: 'pt_BR',
      type: 'website',
    },
    twitter: {
      card: 'summary',
      title,
      description,
    },
  };
};
