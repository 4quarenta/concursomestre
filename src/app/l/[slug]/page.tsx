import type { Metadata } from 'next';
import LandingCampaignPage from '../../landing-campaign/LandingCampaignPage';
import { notFound } from 'next/navigation';
import { buildMarketingLandingMetadata, resolvePublishedMarketingLandingForSeo } from '@/services/marketing/landingPageSeo';

type LandingCampaignRouteParams = {
  slug?: string;
};

export async function generateMetadata({
  params,
  searchParams,
}: {
  params: Promise<LandingCampaignRouteParams>;
  searchParams: Promise<{ preview?: string }>;
}): Promise<Metadata> {
  const { slug = '' } = await params;
  const { preview = '' } = await searchParams;
  if (String(preview).trim() !== '') {
    return {
      title: 'Preview administrativo | ConcursoMestre',
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

  return buildMarketingLandingMetadata(slug);
}

export default async function LandingCampaignRoute({
  params,
  searchParams,
}: {
  params: Promise<LandingCampaignRouteParams>;
  searchParams: Promise<{ preview?: string }>;
}) {
  const { slug = '' } = await params;
  const { preview = '' } = await searchParams;
  const { landing } = await resolvePublishedMarketingLandingForSeo(slug);
  if (!landing && String(preview).trim() === '') {
    notFound();
  }

  return <LandingCampaignPage slug={slug} />;
}
