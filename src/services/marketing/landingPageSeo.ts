import type { Metadata } from 'next';
import type { MarketingLandingPage } from '@types';
import { buildSiteUrl } from '../../config/siteUrl';
import { websiteManifest } from '../../config/platform';
import { resolveAbsoluteApiBaseUrl } from '../api/baseUrl';
import {
  buildMarketingLandingPath,
  getPublishedMarketingLandingBySlug,
  mergeMarketingLandingPages,
  normalizeLandingSlug,
} from './landingPages';

type LandingSeoResolution = {
  landing: MarketingLandingPage | null;
  siteName: string;
};

const FETCH_TIMEOUT_MS = 3500;

const readEnv = (key: string): string => {
  if (typeof process === 'undefined' || !process.env) {
    return '';
  }

  const value = process.env[key];
  return typeof value === 'string' ? value.trim() : '';
};

const getApiBaseUrl = () => resolveAbsoluteApiBaseUrl(
  readEnv('NEXT_PUBLIC_API_BASE_URL') || readEnv('API_BASE_URL') || undefined,
);

const readEnvelopeData = (payload: unknown): Record<string, unknown> => {
  if (!payload || typeof payload !== 'object') {
    return {};
  }

  if (Object.prototype.hasOwnProperty.call(payload, 'data')) {
    const data = (payload as { data?: unknown }).data;
    return data && typeof data === 'object' ? data as Record<string, unknown> : {};
  }

  return payload as Record<string, unknown>;
};

const fetchPublicSettingsForLandingSeo = async (): Promise<Record<string, unknown>> => {
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

export const resolvePublishedMarketingLandingForSeo = async (slug: string): Promise<LandingSeoResolution> => {
  const settings = await fetchPublicSettingsForLandingSeo();
  const siteName = String(settings.siteName || websiteManifest.website.applicationName || 'ConcursoMestre').trim();
  const landingPages = Array.isArray(settings.landingPages)
    ? settings.landingPages as Partial<MarketingLandingPage>[]
    : [];
  const pages = mergeMarketingLandingPages(landingPages, siteName);
  const landing = getPublishedMarketingLandingBySlug(pages, normalizeLandingSlug(slug));

  return {
    landing,
    siteName,
  };
};

const resolveLandingCanonicalUrl = (landing: MarketingLandingPage) => {
  const customCanonical = String(landing.seo?.canonicalUrl || '').trim();

  if (/^https?:\/\//i.test(customCanonical)) {
    return customCanonical;
  }

  if (customCanonical.startsWith('/')) {
    return buildSiteUrl(customCanonical);
  }

  return buildSiteUrl(buildMarketingLandingPath(landing.slug));
};

export const buildMarketingLandingMetadata = async (slug: string): Promise<Metadata> => {
  const { landing, siteName } = await resolvePublishedMarketingLandingForSeo(slug);

  if (!landing) {
    return {
      title: `Campanha indisponivel | ${siteName}`,
      description: 'Esta campanha nao esta publicada ou nao existe no catalogo atual.',
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

  const title = landing.seo?.title || `${landing.title} | ${siteName}`;
  const description = landing.seo?.metaDescription || landing.hero.description;
  const canonical = resolveLandingCanonicalUrl(landing);
  const ogTitle = landing.seo?.ogTitle || title;
  const ogDescription = landing.seo?.ogDescription || description;

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
      title: ogTitle,
      description: ogDescription,
      url: canonical,
      siteName,
      locale: 'pt_BR',
      type: 'website',
    },
    twitter: {
      card: 'summary',
      title: ogTitle,
      description: ogDescription,
    },
  };
};
