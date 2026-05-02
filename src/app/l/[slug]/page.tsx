import type { Metadata } from 'next';
import LandingCampaignPage from '../../landing-campaign/LandingCampaignPage';
import { buildMarketingLandingMetadata } from '@/services/marketing/landingPageSeo';

type LandingCampaignRouteParams = {
  slug?: string;
};

export async function generateMetadata({
  params,
}: {
  params: Promise<LandingCampaignRouteParams>;
}): Promise<Metadata> {
  const { slug = '' } = await params;
  return buildMarketingLandingMetadata(slug);
}

export default LandingCampaignPage;
