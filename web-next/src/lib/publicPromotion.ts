import type { Metadata } from 'next';
import { safeServerFetch } from '@/lib/api';
import { mergePublicSystemSettings } from '@/lib/publicSettings';
import type { SystemSettings } from '@/types';

export interface PublicPromotionPageData {
  settings: SystemSettings;
  promotion: SystemSettings['activePromotion'];
  isEnabled: boolean;
}

export const loadPublicPromotionPageData = async (): Promise<PublicPromotionPageData> => {
  const rawSettings = await safeServerFetch<Partial<SystemSettings>>('settings.php', {});
  const settings = mergePublicSystemSettings(rawSettings);

  return {
    settings,
    promotion: settings.activePromotion,
    isEnabled: Boolean(settings.features.landingPagePromoEnabled && settings.activePromotion.isActive),
  };
};

export const buildPromotionMetadata = (data: PublicPromotionPageData): Metadata => {
  if (!data.isEnabled) {
    return {
      title: 'Promocao indisponivel | ConcursoMestre',
      robots: { index: false, follow: false },
    };
  }

  const title = data.promotion.landingPageTitle || `${data.promotion.name} | ConcursoMestre`;
  const description = data.promotion.landingPageSubheadline || data.promotion.bannerText || 'Promocao especial do ConcursoMestre.';

  return {
    title: {
      absolute: title,
    },
    description,
    alternates: {
      canonical: `/promo/${data.promotion.slug}`,
    },
    openGraph: {
      title,
      description,
      type: 'website',
    },
  };
};
