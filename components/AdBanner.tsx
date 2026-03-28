import React, { useEffect, useRef } from 'react';
import { useData } from '../context/DataContext';
import { useAuth } from '../context/AuthContext';

declare global {
    interface Window {
        adsbygoogle: any[];
    }
}

interface AdBannerProps {
    type: 'top' | 'sidebar' | 'bottom';
    className?: string;
}

const AdBanner: React.FC<AdBannerProps> = ({ type, className = "" }) => {
    const { currentUser } = useAuth();
    const plan = (currentUser?.subscription?.plan?.name || currentUser?.plan || 'Gratuito').toLowerCase();

    // Ocultar anúncios para usuários dos planos Pro e Elite
    const isElite = plan.includes('elite') || plan.includes('pro') || (currentUser?.subscription?.plan?.tier || 0) >= 3;

    const bannerRef = useRef<HTMLDivElement>(null);
    const { systemSettings } = useData();

    // Efeito para carregar o script global do AdSense se necessário
    useEffect(() => {
        if (!systemSettings.adsEnabled || isElite) return;

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
    }, [systemSettings.adsEnabled, systemSettings.adsenseClientId, isElite]);

    // Efeito principal de renderização/injeção de anúncios
    useEffect(() => {
        if (!systemSettings.adsEnabled || isElite || !bannerRef.current) return;

        const contentMap: any = {
            top: systemSettings.adBannerTop,
            sidebar: systemSettings.adBannerSidebar,
            bottom: systemSettings.adBannerBottom
        };
        const customContent = contentMap[type];

        // Caso 1: Conteúdo Customizado (HTML/Scripts do DB)
        if (customContent) {
            bannerRef.current.innerHTML = customContent;
            const scripts = bannerRef.current.getElementsByTagName('script');
            for (let i = 0; i < scripts.length; i++) {
                const script = document.createElement('script');
                if (scripts[i].src) {
                    script.src = scripts[i].src;
                    script.async = true;
                } else {
                    script.textContent = scripts[i].textContent;
                }
                document.body.appendChild(script);
            }
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
        } catch (e) {
            console.debug('[AdBanner] Push attempted during render/HMR');
        }
    }, [type, systemSettings.adsEnabled, systemSettings.adsenseClientId, systemSettings.adBannerTop, systemSettings.adBannerSidebar, systemSettings.adBannerBottom, isElite]);

    if (!systemSettings.adsEnabled || isElite) return null;

    return (
        <div
            ref={bannerRef}
            className={`ad-banner ad-banner-${type} ${className} relative flex items-center justify-center bg-white dark:bg-slate-900 rounded-2xl border-2 border-dashed border-slate-200 dark:border-slate-800 overflow-hidden w-full my-6 transition-all group shadow-sm min-h-[100px]`}
        />
    );
};

export default AdBanner;
