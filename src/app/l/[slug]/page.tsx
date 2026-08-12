import type { Metadata } from 'next';
import LandingCampaignPage from '../../landing-campaign/LandingCampaignPage';
import { notFound } from 'next/navigation';
import { buildMarketingLandingMetadata, resolvePublishedMarketingLandingForSeo } from '@/services/marketing/landingPageSeo';

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

export default async function LandingCampaignRoute({ params }: { params: Promise<LandingCampaignRouteParams> }) {
  const { slug = '' } = await params;
  const { landing } = await resolvePublishedMarketingLandingForSeo(slug);
  if (!landing) {
    notFound();
  }

  return <LandingCampaignPage slug={slug} />;
}
