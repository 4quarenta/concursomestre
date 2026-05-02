import type { Metadata } from 'next';
import PromoLanding from '../PromoPage';
import { buildPromotionMetadata } from '@/services/marketing/promotionSeo';

type PromoRouteParams = {
  slug?: string;
};

export async function generateMetadata({
  params,
}: {
  params: Promise<PromoRouteParams>;
}): Promise<Metadata> {
  const { slug = '' } = await params;
  return buildPromotionMetadata(slug);
}

export default async function PromoPage({
  params,
}: {
  params: Promise<PromoRouteParams>;
}) {
  const { slug = '' } = await params;
  return <PromoLanding slug={slug} />;
}
