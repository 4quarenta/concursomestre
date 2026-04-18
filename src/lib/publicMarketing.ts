import type { Metadata } from 'next';
import { safeServerFetch } from '@/lib/api';
import { mergePublicSystemSettings } from '@/lib/publicSettings';
import { buildMarketingLandingPath, getPublishedMarketingLandingBySlug } from '@/services/marketing/landingPages';
import type { MarketingLandingPage, Plan, SystemSettings } from '@/types';

const DEFAULT_SITE_NAME = 'ConcursoMestre';

export interface PublicMarketingPageData {
  settings: SystemSettings;
  plans: Plan[];
  siteName: string;
  landing: MarketingLandingPage | null;
}

export const loadPublicMarketingPageData = async (slug: string): Promise<PublicMarketingPageData> => {
  const [rawSettings, rawPlans] = await Promise.all([
    safeServerFetch<Partial<SystemSettings>>('settings.php', {}),
    safeServerFetch<Plan[]>('plans/list.php', []),
  ]);

  const settings = mergePublicSystemSettings(rawSettings);
  const siteName = settings.siteName || DEFAULT_SITE_NAME;
  const landing = getPublishedMarketingLandingBySlug(settings.landingPages || [], slug);

  return {
    settings,
    plans: Array.isArray(rawPlans) ? rawPlans : [],
    siteName,
    landing,
  };
};

export const buildLandingMetadata = (
  slug: string,
  data: Pick<PublicMarketingPageData, 'landing' | 'siteName'>,
): Metadata => {
  const { landing, siteName } = data;

  if (!landing) {
    return {
      title: `Landing | ${siteName}`,
      description: `Campanha publica do ${siteName}.`,
      robots: { index: false, follow: false },
    };
  }

  const title = landing.seo?.title || `${siteName} | Planos para estudar com mais estrategia`;
  const description = landing.seo?.metaDescription || `Compare os planos do ${siteName} e escolha a assinatura ideal.`;

  return {
    title: {
      absolute: title,
    },
    description,
    openGraph: {
      title: landing.seo?.ogTitle || title,
      description: landing.seo?.ogDescription || description,
      siteName,
      type: 'website',
    },
    alternates: {
      canonical: landing.seo?.canonicalUrl || buildMarketingLandingPath(slug),
    },
  };
};
