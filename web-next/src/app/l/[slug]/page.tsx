import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import MarketingPlansLandingClient from '@/components/landing/MarketingPlansLandingClient';
import { buildLandingMetadata, loadPublicMarketingPageData } from '@/lib/publicMarketing';
import { buildMarketingLandingPath } from '@/services/marketing/landingPages';

interface DynamicLandingPageProps {
  params: Promise<{ slug: string }>;
}

export async function generateStaticParams() {
  const { settings } = await loadPublicMarketingPageData('planos');

  return (settings.landingPages || [])
    .filter((landing) => landing.status === 'published')
    .map((landing) => landing.slug)
    .filter((slug) => slug !== 'planos' && slug !== 'elite')
    .map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: DynamicLandingPageProps): Promise<Metadata> {
  const { slug } = await params;
  return buildLandingMetadata(slug, await loadPublicMarketingPageData(slug));
}

export default async function DynamicLandingPage({ params }: DynamicLandingPageProps) {
  const { slug } = await params;
  const pageData = await loadPublicMarketingPageData(slug);

  if (!pageData.landing) {
    notFound();
  }

  if (buildMarketingLandingPath(slug) !== `/l/${slug}`) {
    notFound();
  }

  return (
    <MarketingPlansLandingClient
      slug={slug}
      siteName={pageData.siteName}
      plans={pageData.plans}
      systemSettings={pageData.settings}
      landing={pageData.landing}
      loading={false}
      isPreviewMode={false}
    />
  );
}
