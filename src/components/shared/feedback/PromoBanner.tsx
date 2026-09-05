/*
* ----------------------------------------------------
* @author: 4quarenta
* @author URI: https://github.com/4quarenta
* @copyright: (c) 2026 ConcursoMestre. All rights reserved
* ----------------------------------------------------
*
* @since 1.0.0
*
*/


import React from 'react';
import Link from 'next/link';
import { Timer, ArrowRight, X } from 'lucide-react';
import { buildPromotionPath, isPromotionActiveForSlug } from '@services/marketing/promotionCampaign';
import { useAppConfigStore } from '@/state/app-config/appConfigStore';
import { analyticsTrackingService } from '@services/analytics/analyticsTrackingService';
import marketingCampaignService, { type MarketingPublicCampaign } from '@services/marketing/marketingCampaignService';

const PromoBanner: React.FC = () => {
  const systemSettings = useAppConfigStore((state) => state.systemSettings);
  const [isVisible, setIsVisible] = React.useState(true);
  const [operationalCampaign, setOperationalCampaign] = React.useState<MarketingPublicCampaign | null>(null);
  const promo = systemSettings.activePromotion;
  const promoEnabled = systemSettings.features.landingPagePromoEnabled;
  const promotionPath = operationalCampaign?.landingSlug ? `/l/${operationalCampaign.landingSlug}` : buildPromotionPath(promo);

  React.useEffect(() => {
    let mounted = true;
    void marketingCampaignService.listPublicCampaigns().then((campaigns) => {
      if (!mounted) return;
      const candidate = campaigns.find((campaign) => campaign.placements.includes('topbar') && campaign.channels.includes('in_app')) || null;
      setOperationalCampaign(candidate);
    }).catch(() => undefined);
    return () => { mounted = false; };
  }, []);

  React.useEffect(() => {
    if (!operationalCampaign) return;
    void marketingCampaignService.recordPublicInteraction({
      campaignId: operationalCampaign.id,
      interactionType: 'impression',
      sessionKey: analyticsTrackingService.getSessionKey(),
      landingId: operationalCampaign.landingSlug || undefined,
      placement: 'topbar',
    });
  }, [operationalCampaign]);

  const legacyPromotionVisible = isPromotionActiveForSlug(promo, promo.slug);
  if ((!legacyPromotionVisible && !operationalCampaign) || !isVisible || !promoEnabled || !promotionPath) return null;
  const headline = String(operationalCampaign?.content.headline || promo.bannerText);
  const ctaLabel = String(operationalCampaign?.content.ctaLabel || 'Aproveitar Agora');

  return (
    <div
      className="w-full py-2.5 px-4 flex items-center justify-between text-white text-xs md:text-sm font-bold shadow-lg relative z-50 animate-slide-down transition-all duration-300"
      style={{ backgroundColor: promo.themeColor }}
    >
      <div className="flex items-center gap-3 mx-auto">
        <div className="flex items-center gap-2 px-3 py-1 bg-white/20 backdrop-blur-md rounded-full border border-white/10">
          <Timer size={14} className="animate-pulse" />
          <span className="uppercase tracking-[0.1em] text-[10px]">{headline}</span>
        </div>
        <Link
          href={promotionPath}
          onClick={() => {
            if (operationalCampaign) {
              void marketingCampaignService.recordPublicInteraction({ campaignId: operationalCampaign.id, interactionType: 'cta_clicked', sessionKey: analyticsTrackingService.getSessionKey(), landingId: operationalCampaign.landingSlug || undefined, placement: 'topbar', ctaId: 'topbar-primary' });
            }
            void analyticsTrackingService.trackLifecycleEvent({
              eventName: 'cta_clicked',
              source: 'promotion_banner',
              utmCampaign: promo.slug,
              metadata: {
                campaignId: promo.slug,
                landingId: promo.slug,
                ctaId: 'topbar-primary',
                placement: 'topbar',
              },
            });
          }}
          className="bg-white text-slate-900 px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest hover:scale-105 active:scale-95 transition-all flex items-center gap-1.5 shadow-sm"
        >
          {ctaLabel} <ArrowRight size={10} />
        </Link>
      </div>
      <button
        onClick={() => {
          setIsVisible(false);
          if (operationalCampaign) void marketingCampaignService.recordPublicInteraction({ campaignId: operationalCampaign.id, interactionType: 'dismissal', sessionKey: analyticsTrackingService.getSessionKey(), placement: 'topbar' });
        }}
        className="absolute right-4 top-1/2 -translate-y-1/2 p-2 hover:bg-white/20 rounded-full transition-colors"
        title="Fechar banner"
      >
        <X size={16} />
      </button>
    </div>
  );
};

export default PromoBanner;
