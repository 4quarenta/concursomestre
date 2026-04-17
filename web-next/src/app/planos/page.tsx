import type { Metadata } from 'next';
import MarketingPlansLandingClient from '@/components/landing/MarketingPlansLandingClient';
import { buildLandingMetadata, loadPublicMarketingPageData } from '@/lib/publicMarketing';

export async function generateMetadata(): Promise<Metadata> {
  return buildLandingMetadata('planos', await loadPublicMarketingPageData('planos'));
}

export default async function PlanosPage() {
  const pageData = await loadPublicMarketingPageData('planos');

  return (
    <MarketingPlansLandingClient
      slug="planos"
      siteName={pageData.siteName}
      plans={pageData.plans}
      systemSettings={pageData.settings}
      landing={pageData.landing}
      loading={false}
      isPreviewMode={false}
    />
  );
}
