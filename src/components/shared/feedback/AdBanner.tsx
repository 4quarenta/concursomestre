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

const AdBanner: React.FC<AdBannerProps> = ({ type, className = "" }) => {
    const { currentUser } = useAuth();
    const bannerRef = useRef<HTMLDivElement>(null);
    const systemSettings = useAppConfigStore((state) => state.systemSettings);
    const hidesAds = hasPlanBenefit(currentUser, 'no_ads', systemSettings.planEntitlements);

    // Efeito para carregar o script global do AdSense se necessário
    useEffect(() => {
        if (!systemSettings.adsEnabled || hidesAds) return;

        const scriptId = 'adsense-script-loader';
        const officialTestId = 'ca-pub-3940256099942544';
        const clientId = systemSettings.adsenseClientId && systemSettings.adsenseClientId !== 'ca-pub-test'
            ? systemSettings.adsenseClientId
            : officialTestId;

        if (!document.getElementById(scriptId) && !document.querySelector('script[src*="adsbygoogle.js"]')) {
            const script = document.createElement('script');
            script.id = scriptId;
            script.src = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${clientId}`;
            script.async = true;
            script.crossOrigin = "anonymous";
            document.head.appendChild(script);
        }
    }, [systemSettings.adsEnabled, systemSettings.adsenseClientId, hidesAds]);

    // Efeito principal de renderização/injeção de anúncios
    useEffect(() => {
        if (!systemSettings.adsEnabled || hidesAds || !bannerRef.current) return;

        const contentMap: Record<AdBannerProps['type'], string | undefined> = {
            top: systemSettings.adBannerTop,
            sidebar: systemSettings.adBannerSidebar,
            bottom: systemSettings.adBannerBottom
        };
        const customContent = contentMap[type];

        // Caso 1: Conteúdo Customizado (HTML/Scripts do DB)
        if (customContent) {
            bannerRef.current.innerHTML = normalizeQuestionRichHtml(customContent);
            return;
        }

        // Caso 2: AdSense
        // IDs Oficiais de Teste do Google
        const officialTestPubId = 'ca-pub-3940256099942544';
        const officialTestSlotId = '6300978111';

        const clientId = systemSettings.adsenseClientId && systemSettings.adsenseClientId !== 'ca-pub-test'
            ? systemSettings.adsenseClientId
            : officialTestPubId;

        const isTest = clientId === officialTestPubId;
        const slotId = isTest ? officialTestSlotId : '8707198108'; // Slot real ou genérico

        // Limpa e injeta
        bannerRef.current.innerHTML = '';

        const container = document.createElement('div');
        container.className = 'flex flex-col items-center justify-center w-full h-full p-2 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-100 dark:border-slate-700 min-h-[100px]';

        const ins = document.createElement('ins');
        ins.className = 'adsbygoogle';
        ins.style.display = 'block';
        ins.style.width = '100%';

        // Formatos retangulares sugeridos pela Google para testes
        if (type === 'sidebar') {
            ins.style.height = '250px';
            ins.setAttribute('data-ad-format', 'rectangle');
        } else {
            ins.style.height = '90px';
            ins.setAttribute('data-ad-format', 'horizontal');
        }

        ins.setAttribute('data-ad-client', clientId);
        ins.setAttribute('data-ad-slot', slotId);
        ins.setAttribute('data-full-width-responsive', 'true');

        if (isTest) {
            ins.setAttribute('data-adtest', 'on');
        }

        const label = document.createElement('div');
        label.className = 'text-[9px] font-black uppercase tracking-widest text-slate-400 mt-2';
        label.textContent = isTest ? 'Ads de Teste (Google Official)' : 'Publicidade';

        container.appendChild(ins);
        container.appendChild(label);
        bannerRef.current.appendChild(container);

        try {
            (window.adsbygoogle = window.adsbygoogle || []).push({});
        } catch {
            // Google Ads can reject duplicate pushes during hot reload; production rendering can continue.
        }
    }, [type, systemSettings.adsEnabled, systemSettings.adsenseClientId, systemSettings.adBannerTop, systemSettings.adBannerSidebar, systemSettings.adBannerBottom, hidesAds]);

    if (!systemSettings.adsEnabled || hidesAds) return null;

    return (
        <div
            ref={bannerRef}
            className={`ad-banner ad-banner-${type} ${className} relative flex items-center justify-center bg-white dark:bg-slate-900 rounded-2xl border-2 border-dashed border-slate-200 dark:border-slate-800 overflow-hidden w-full my-6 transition-all group shadow-sm min-h-[100px]`}
        />
    );
};

export default AdBanner;
