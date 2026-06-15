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

import React, { useEffect, useRef } from 'react';
import { useAuth } from '@providers/AuthProvider';
import { hasPlanBenefit } from '@services/plans/planAccess';
import { useAppConfigStore } from '@/state/app-config/appConfigStore';
import { normalizeQuestionRichHtml } from '@services/questions/questionHtmlSanitizer';

declare global {
    interface Window {
        adsbygoogle: unknown[];
    }
}

interface AdBannerProps {
    type: 'top' | 'sidebar' | 'bottom';
    className?: string;
}

const OFFICIAL_TEST_PUB_ID = 'ca-pub-3940256099942544';
const OFFICIAL_TEST_SLOT_ID = '6300978111';

const AdBanner: React.FC<AdBannerProps> = ({ type, className = '' }) => {
    const { currentUser } = useAuth();
    const bannerRef = useRef<HTMLDivElement>(null);
    const systemSettings = useAppConfigStore((state) => state.systemSettings);
    const hidesAds = hasPlanBenefit(currentUser, 'no_ads', systemSettings.planEntitlements);
    const canReceiveAds = hasPlanBenefit(currentUser, 'ads.adsense_banner', systemSettings.planEntitlements);
    const hasReducedAds = hasPlanBenefit(currentUser, 'ads.reduced', systemSettings.planEntitlements);
    const placementEnabledMap: Record<AdBannerProps['type'], boolean> = {
        top: systemSettings.adPlacementTopEnabled !== false,
        sidebar: systemSettings.adPlacementSidebarEnabled !== false && !hasReducedAds,
        bottom: systemSettings.adPlacementBottomEnabled !== false,
    };
    const isPlacementEnabled = placementEnabledMap[type];

    useEffect(() => {
        if (!systemSettings.adsEnabled || hidesAds || !canReceiveAds || !isPlacementEnabled) return;

        const scriptId = 'adsense-script-loader';
        const configuredClientId = String(systemSettings.adsenseClientId || '').trim();
        const slotMap: Record<AdBannerProps['type'], string | undefined> = {
            top: systemSettings.adsenseTopSlotId,
            sidebar: systemSettings.adsenseSidebarSlotId,
            bottom: systemSettings.adsenseBottomSlotId,
        };
        const configuredSlotId = String(slotMap[type] || '').trim();
        const forceGoogleTestMode = systemSettings.adsenseTestMode === true;
        const clientId = !forceGoogleTestMode && configuredClientId && configuredClientId !== 'ca-pub-test' && configuredSlotId
            ? configuredClientId
            : OFFICIAL_TEST_PUB_ID;

        if (!document.getElementById(scriptId) && !document.querySelector('script[src*="adsbygoogle.js"]')) {
            const script = document.createElement('script');
            script.id = scriptId;
            script.src = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${clientId}`;
            script.async = true;
            script.crossOrigin = 'anonymous';
            document.head.appendChild(script);
        }
    }, [
        type,
        systemSettings.adsEnabled,
        systemSettings.adsenseTestMode,
        systemSettings.adsenseClientId,
        systemSettings.adsenseTopSlotId,
        systemSettings.adsenseSidebarSlotId,
        systemSettings.adsenseBottomSlotId,
        hidesAds,
        canReceiveAds,
        isPlacementEnabled,
    ]);

    useEffect(() => {
        if (!systemSettings.adsEnabled || hidesAds || !canReceiveAds || !isPlacementEnabled || !bannerRef.current) return;

        const contentMap: Record<AdBannerProps['type'], string | undefined> = {
            top: systemSettings.adBannerTop,
            sidebar: systemSettings.adBannerSidebar,
            bottom: systemSettings.adBannerBottom,
        };
        const customContent = contentMap[type];
        const forceGoogleTestMode = systemSettings.adsenseTestMode === true;

        if (customContent && !forceGoogleTestMode) {
            bannerRef.current.innerHTML = normalizeQuestionRichHtml(customContent);
            return;
        }

        const slotMap: Record<AdBannerProps['type'], string | undefined> = {
            top: systemSettings.adsenseTopSlotId,
            sidebar: systemSettings.adsenseSidebarSlotId,
            bottom: systemSettings.adsenseBottomSlotId,
        };
        const configuredClientId = String(systemSettings.adsenseClientId || '').trim();
        const configuredSlotId = String(slotMap[type] || '').trim();
        const isTest = forceGoogleTestMode || !configuredClientId || configuredClientId === 'ca-pub-test' || !configuredSlotId;
        const clientId = isTest ? OFFICIAL_TEST_PUB_ID : configuredClientId;
        const slotId = isTest ? OFFICIAL_TEST_SLOT_ID : configuredSlotId;

        bannerRef.current.innerHTML = '';

        if (!slotId) {
            return;
        }

        const ins = document.createElement('ins');
        ins.className = 'adsbygoogle';
        ins.style.display = 'block';
        ins.style.width = '100%';

        if (type === 'sidebar') {
            ins.style.height = '250px';
            ins.setAttribute('data-ad-format', 'rectangle');
        } else {
            ins.style.height = '90px';
            ins.setAttribute('data-ad-format', 'auto');
        }

        ins.setAttribute('data-ad-client', clientId);
        ins.setAttribute('data-ad-slot', slotId);
        ins.setAttribute('data-full-width-responsive', 'true');

        if (isTest) {
            ins.setAttribute('data-adtest', 'on');
        }

        const label = document.createElement('div');
        label.className = 'pointer-events-none absolute bottom-2 left-1/2 -translate-x-1/2 text-[9px] font-black uppercase tracking-widest text-slate-400';
        label.textContent = isTest ? 'Ads de teste Google' : 'Publicidade';

        bannerRef.current.appendChild(ins);
        bannerRef.current.appendChild(label);

        try {
            (window.adsbygoogle = window.adsbygoogle || []).push({});
        } catch {
            // AdSense pode recusar pushes duplicados durante hot reload.
        }
    }, [
        type,
        systemSettings.adsEnabled,
        systemSettings.adsenseTestMode,
        systemSettings.adsenseClientId,
        systemSettings.adsenseTopSlotId,
        systemSettings.adsenseSidebarSlotId,
        systemSettings.adsenseBottomSlotId,
        systemSettings.adBannerTop,
        systemSettings.adBannerSidebar,
        systemSettings.adBannerBottom,
        hidesAds,
        canReceiveAds,
        isPlacementEnabled,
    ]);

    if (!systemSettings.adsEnabled || hidesAds || !canReceiveAds || !isPlacementEnabled) return null;

    return (
        <div
            ref={bannerRef}
            className={`ad-banner ad-banner-${type} ${className} relative my-6 flex min-h-[100px] w-full items-center justify-center overflow-hidden rounded-2xl border-2 border-dashed border-slate-200 bg-white shadow-sm transition-all dark:border-slate-800 dark:bg-slate-900`}
        />
    );
};

export default AdBanner;
