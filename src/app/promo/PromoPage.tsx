'use client';

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
import { useAppConfigStore } from '@/state/app-config/appConfigStore';
import { Check, ShieldCheck, Star, Zap } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { buildProfilePath } from '../profile/profileNavigation';
import { isPromotionActiveForSlug } from '@services/marketing/promotionCampaign';

interface PromoLandingProps {
  slug?: string;
}

const PromoLanding: React.FC<PromoLandingProps> = ({ slug = '' }) => {
  const systemSettings = useAppConfigStore((state) => state.systemSettings);
  const router = useRouter();
  const promo = systemSettings.activePromotion;
  const promoEnabled = systemSettings.features.landingPagePromoEnabled;
  const canShowPromotion = promoEnabled && isPromotionActiveForSlug(promo, slug);

  if (!canShowPromotion) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center px-6 text-center">
        <h1 className="text-2xl font-bold text-slate-800 transition-colors dark:text-slate-200">
          Promocao indisponivel
        </h1>
        <p className="mt-3 max-w-md text-sm font-medium leading-6 text-slate-500 dark:text-slate-400">
          Esta campanha nao esta ativa ou o link acessado nao corresponde a promocao publicada.
        </p>
        <button
          type="button"
          onClick={() => router.push('/')}
          className="mt-4 font-bold text-indigo-600 transition-colors hover:underline dark:text-indigo-400"
        >
          Voltar ao inicio
        </button>
      </div>
    );
  }

  const annualElitePrice = Number(systemSettings.pricing.Elite.annual || 0);
  const discountedAnnualElitePrice = annualElitePrice * (1 - Number(promo.discountPercentage || 0) / 100);

  return (
    <div className="min-h-screen bg-slate-50 transition-colors dark:bg-slate-950">
      <section
        className="relative w-full overflow-hidden px-6 py-24 text-center text-white"
        style={{ backgroundColor: promo.themeColor }}
      >
        <div className="relative z-10 mx-auto max-w-4xl space-y-8">
          <span className="inline-block rounded-full border border-white/10 bg-white/20 px-4 py-2 text-xs font-black uppercase tracking-[0.2em] backdrop-blur-md">
            Oferta por tempo limitado
          </span>
          <h1 className="text-5xl font-black leading-none tracking-tight drop-shadow-sm md:text-7xl">
            {promo.landingPageHeadline}
          </h1>
          <p className="mx-auto max-w-2xl text-xl font-medium leading-relaxed opacity-90 md:text-2xl">
            {promo.landingPageSubheadline}
          </p>
          <div className="pt-4">
            <button
              type="button"
              onClick={() => router.push(buildProfilePath('personal'))}
              className="px-12 py-5 text-sm font-black uppercase tracking-widest text-slate-900 transition-all hover:scale-105 active:scale-95 rounded-full bg-white shadow-2xl"
            >
              Quero aproveitar {promo.discountPercentage}% off
            </button>
          </div>
        </div>
        <div className="pointer-events-none absolute inset-0 opacity-10">
          <div className="absolute -left-20 -top-20 h-96 w-96 rounded-full bg-white blur-3xl" />
          <div className="absolute right-0 top-1/2 h-80 w-80 rounded-full bg-white blur-3xl" />
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 py-24">
        <h2 className="mb-16 text-center text-4xl font-black text-slate-900 transition-colors dark:text-slate-100">
          Por que assinar agora?
        </h2>
        <div className="grid grid-cols-1 gap-8 md:grid-cols-3">
          {promo.featuresHighlight.map((feature, index) => {
            const Icon = index === 0 ? Zap : index === 1 ? ShieldCheck : Star;

            return (
              <article
                key={`${feature}-${index}`}
                className="group relative overflow-hidden rounded-[2rem] border border-slate-200 bg-white p-10 shadow-xl transition-all hover:-translate-y-2 dark:border-slate-800 dark:bg-slate-900"
              >
                <div className="mb-8 flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-100 text-slate-900 shadow-sm transition-all group-hover:bg-indigo-600 group-hover:text-white dark:bg-slate-800 dark:text-indigo-400">
                  <Icon size={32} />
                </div>
                <h3 className="mb-3 text-2xl font-black text-slate-900 transition-colors dark:text-slate-100">
                  {feature}
                </h3>
                <p className="font-medium leading-relaxed text-slate-500 transition-colors dark:text-slate-400">
                  Aproveite os recursos premium para estudar com mais foco, constancia e leitura clara do seu progresso.
                </p>
                <div className="absolute -bottom-6 -right-6 h-24 w-24 rounded-full bg-indigo-50 blur-2xl transition-colors group-hover:bg-indigo-500/10 dark:bg-indigo-900/10" />
              </article>
            );
          })}
        </div>
      </section>

      <section className="bg-slate-900 px-6 py-24 text-center transition-colors dark:bg-slate-950">
        <div className="relative mx-auto max-w-4xl overflow-hidden rounded-[2rem] bg-gradient-to-br from-indigo-600 to-purple-700 p-12 text-white shadow-2xl transition-colors dark:from-indigo-700 dark:to-purple-900 md:p-20">
          <div className="relative z-10 flex flex-col items-center">
            <h2 className="mb-8 text-4xl font-black md:text-5xl">Plano Elite Anual</h2>
            <div className="mb-10 flex flex-col items-center justify-center gap-4 md:flex-row">
              <span className="text-2xl font-bold opacity-50 line-through">
                R$ {annualElitePrice.toFixed(2).replace('.', ',')}
              </span>
              <div className="flex items-baseline gap-2">
                <span className="text-xs font-black uppercase tracking-widest opacity-80">Apenas</span>
                <span className="text-6xl font-black md:text-8xl">
                  R$ {discountedAnnualElitePrice.toFixed(2).replace('.', ',')}
                </span>
              </div>
            </div>
            <p className="mb-12 max-w-xl text-lg font-medium text-indigo-100 opacity-90">
              Sua jornada rumo a estabilidade com uma rotina de estudo mais organizada e estrategica.
            </p>
            <button
              type="button"
              onClick={() => router.push(buildProfilePath('personal'))}
              className="w-full rounded-2xl bg-white px-16 py-6 text-sm font-black uppercase tracking-widest text-indigo-700 shadow-xl transition-all hover:scale-105 hover:bg-slate-50 active:scale-95 md:w-auto"
            >
              Assinar com desconto
            </button>
            <div className="mt-8 flex items-center gap-2 text-[11px] font-black uppercase tracking-widest opacity-70">
              <Check size={14} /> Garantia de 7 dias
            </div>
          </div>
          <div className="absolute right-0 top-0 -mr-32 -mt-32 h-64 w-64 rounded-full bg-white/5 blur-3xl" />
          <div className="absolute bottom-0 left-0 -mb-32 -ml-32 h-64 w-64 rounded-full bg-purple-500/10 blur-3xl" />
        </div>
      </section>
    </div>
  );
};

export default PromoLanding;
