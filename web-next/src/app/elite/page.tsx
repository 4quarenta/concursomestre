import type { Metadata } from 'next';
import MarketingPlansLandingClient from '@/components/landing/MarketingPlansLandingClient';
import { buildLandingMetadata, loadPublicMarketingPageData } from '@/lib/publicMarketing';

export async function generateMetadata(): Promise<Metadata> {
  return buildLandingMetadata('elite', await loadPublicMarketingPageData('elite'));
}

export default async function ElitePage() {
  const pageData = await loadPublicMarketingPageData('elite');

  return (
    <MarketingPlansLandingClient
      slug="elite"
      siteName={pageData.siteName}
      plans={pageData.plans}
      systemSettings={pageData.settings}
      landing={pageData.landing}
      loading={false}
      isPreviewMode={false}
    />
  );
}
