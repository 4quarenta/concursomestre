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

'use client';

import React, { useCallback, useMemo, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import {
  ArrowRight,
  CheckCircle2,
  ChevronDown,
  CircleHelp,
  CreditCard,
  LayoutTemplate,
  ShieldCheck,
  Sparkles,
  Star,
  Target,
  Trophy,
} from 'lucide-react';
import type { MarketingLandingPage, Plan, PlanName } from '@types';
import {
  getCanonicalPlanName,
  getConfiguredPlanDisplayName,
  isPlanEnabledByName,
  resolvePlanAutoCouponsById,
  resolvePlanDiscountBadgesByCycle,
  resolvePlanOffer,
} from '@services/plans';
import { themeConfig } from '@constants/themes';
import { getPublicPlanFeaturesForPlan } from '@constants/subscriptions/planEntitlements';
import LimitedOfferCountdown from '../../../components/shared/marketing/LimitedOfferCountdown';
import LandingSectionHeader from '../../landing/components/LandingSectionHeader';
import { ThemeOrnaments } from '../../landing/components/ThemeOrnaments';
import useMarketingPlansLanding from '../hooks/useMarketingPlansLanding';

type BillingCycle = 'monthly' | 'quarterly' | 'annual';
type PlanPricingByName = Partial<Record<PlanName, Partial<Record<BillingCycle, number>>>>;

interface MarketingPlansLandingPageProps {
  slug: string;
}

const BILLING_CYCLE_OPTIONS: Array<{ key: BillingCycle; label: string }> = [
  { key: 'monthly', label: 'Mensal' },
  { key: 'quarterly', label: 'Trimestral' },
  { key: 'annual', label: 'Anual' },
];

const formatCurrency = (value: number) => `R$ ${Number(value || 0).toLocaleString('pt-BR', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})}`;

const getCycleCount = (cycle: BillingCycle) => (cycle === 'annual' ? 12 : cycle === 'quarterly' ? 3 : 1);
const getCycleLabel = (cycle: BillingCycle) => (cycle === 'annual' ? 'ano' : cycle === 'quarterly' ? 'cada 3 meses' : 'mes');

const getConfiguredCycleAmount = (planName: PlanName, cycle: BillingCycle, pricing: PlanPricingByName) => {
  if (cycle === 'annual') {
    return Number(pricing?.[planName]?.annual || 0);
  }

  if (cycle === 'quarterly') {
    return Number(pricing?.[planName]?.quarterly || 0);
  }

  return Number(pricing?.[planName]?.monthly || 0);
};

const isPlanInCycle = (plan: Plan, cycle: BillingCycle) => {
  const intervalUnit = String(plan.interval_unit || '').toLowerCase();
  const intervalCount = Number(plan.interval_count || 1);
  const isMonthly = intervalUnit === 'month' && intervalCount === 1;
  const isQuarterly = intervalUnit === 'month' && intervalCount === 3;
  const isAnnual = intervalUnit === 'year' || (intervalUnit === 'month' && intervalCount === 12);
  const isCustomShortCycle = intervalUnit === 'day' || intervalUnit === 'week';

  if (Number(plan.price || 0) === 0) {
    return true;
  }

  if (cycle === 'quarterly') {
    return isQuarterly;
  }

  if (cycle === 'annual') {
    return isAnnual;
  }

  return isMonthly || isCustomShortCycle;
};

const getCardIcon = (planName: PlanName) => {
  if (planName === 'Elite') {
    return Trophy;
  }

  if (planName === 'Pro') {
    return Sparkles;
  }

  return Target;
};

const getLandingCardsGridClassName = (count: number) => {
  if (count <= 1) {
    return 'grid gap-6 lg:grid-cols-1';
  }

  if (count === 2) {
    return 'grid gap-6 lg:grid-cols-2';
  }

  return 'grid gap-6 lg:grid-cols-3';
};

const MarketingPlansLandingPage = ({ slug }: MarketingPlansLandingPageProps) => {
  const searchParams = useSearchParams();
  const [billingCycle, setBillingCycle] = useState<BillingCycle>('annual');
  const {
    siteName,
    plans,
    systemSettings,
    landing,
    loading,
    isPreviewMode,
    previewRequested,
    canAccessPreview,
  } = useMarketingPlansLanding({ slug });

  const currentTheme = themeConfig[systemSettings.activeTheme || 'default'] || themeConfig.default;
  const ThemeIcon = currentTheme.icon;
  const forceModeClass = currentTheme.forceMode === 'dark'
    ? 'dark bg-slate-950 text-white'
    : currentTheme.forceMode === 'light'
      ? 'light bg-white text-slate-950'
      : '';

  const trackingQueryString = useMemo(() => {
    const params = new URLSearchParams(searchParams?.toString());
    params.delete('preview');
    const serialized = params.toString();
    return serialized ? `?${serialized}` : '';
  }, [searchParams]);

  const appendTracking = useCallback((path: string) => `${path}${trackingQueryString}`, [trackingQueryString]);

  const availablePlansByCanonical = useMemo(() => {
    return plans
      .filter((plan) => plan.is_active !== false)
      .filter((plan) => isPlanEnabledByName(plan.name, systemSettings.planDetails))
      .filter((plan) => isPlanInCycle(plan, billingCycle))
      .reduce<Partial<Record<PlanName, Plan>>>((accumulator, plan) => {
        const canonical = getCanonicalPlanName(plan.name);
        accumulator[canonical] = plan;
        return accumulator;
      }, {});
  }, [billingCycle, plans, systemSettings.planDetails]);

  const activePlansInCycle = useMemo(
    () => Object.values(availablePlansByCanonical).filter(Boolean) as Plan[],
    [availablePlansByCanonical],
  );

  const autoCouponsByPlanId = useMemo(
    () => resolvePlanAutoCouponsById(activePlansInCycle, systemSettings.coupons || []),
    [activePlansInCycle, systemSettings.coupons],
  );

  const offersByPlanId = useMemo(() => {
    return Object.fromEntries(activePlansInCycle.map((plan) => ([
      plan.id,
      resolvePlanOffer({
        plan,
        pricing: systemSettings.pricing,
        planDetails: systemSettings.planDetails,
        discountAmount: autoCouponsByPlanId[plan.id]?.discountAmount || 0,
      }),
    ])));
  }, [activePlansInCycle, autoCouponsByPlanId, systemSettings.planDetails, systemSettings.pricing]);

  const eliteDiscountBadgesByCycle = useMemo(() => (
    resolvePlanDiscountBadgesByCycle({
      plans: plans.filter((plan) => plan.is_active !== false && isPlanEnabledByName(plan.name, systemSettings.planDetails)),
      canonicalPlanName: 'Elite',
      coupons: systemSettings.coupons || [],
      pricing: systemSettings.pricing,
      planDetails: systemSettings.planDetails,
    })
  ), [plans, systemSettings.coupons, systemSettings.planDetails, systemSettings.pricing]);

  const landingPage = landing as MarketingLandingPage | null;
  const landingPlanCards = useMemo(() => {
    if (!landingPage) {
      return [];
    }

    return landingPage.planCards.map((card) => {
      const canonicalPlanName = card.planName;
      const plan = availablePlansByCanonical[canonicalPlanName] || null;
      const cycleCount = getCycleCount(billingCycle);
      const configuredCycleAmount = getConfiguredCycleAmount(canonicalPlanName, billingCycle, systemSettings.pricing);
      const configuredMonthlyAmount = cycleCount > 0 ? configuredCycleAmount / cycleCount : configuredCycleAmount;
      const offer = plan ? offersByPlanId[plan.id] : null;
      const displayName = getConfiguredPlanDisplayName(canonicalPlanName, systemSettings.planDetails, card.title);
      const entitlementFeatures = getPublicPlanFeaturesForPlan(canonicalPlanName, systemSettings.planEntitlements, {
        maxItems: 6,
        includeDisabled: false,
        usageLimits: systemSettings.planUsageLimits,
      }).map((feature) => feature.text);

      return {
        ...card,
        displayName,
        plan,
        offer,
        monthlyAmount: offer?.discountedMonthlyAmount ?? configuredMonthlyAmount,
        cycleAmount: offer?.discountedCycleAmount ?? configuredCycleAmount,
        originalMonthlyAmount: offer?.originalMonthlyAmount ?? configuredMonthlyAmount,
        originalCycleAmount: offer?.originalCycleAmount ?? configuredCycleAmount,
        hasDiscount: Boolean(offer?.hasDiscount),
        discountPercent: Number(offer?.effectiveDiscountPercent || 0),
        cycleLabel: offer?.cycleLabel || getCycleLabel(billingCycle),
        checkoutHref: plan
          ? (Number(plan.price || 0) === 0 ? appendTracking('/auth?register=true') : appendTracking(`/checkout/${plan.id}`))
          : appendTracking('/plans'),
        isAvailable: Boolean(plan),
        featureList: entitlementFeatures.length > 0 ? entitlementFeatures : card.summaryBenefits,
      };
    });
  }, [appendTracking, availablePlansByCanonical, billingCycle, landingPage, offersByPlanId, systemSettings.planDetails, systemSettings.planEntitlements, systemSettings.planUsageLimits, systemSettings.pricing]);

  const featuredCard = landingPlanCards.find((card) => card.featured) || landingPlanCards.find((card) => card.planName === 'Elite') || landingPlanCards[0] || null;
  const comparisonColumns = landingPage?.planCards.map((card) => ({
    key: card.planName,
    label: card.title,
    featured: Boolean(card.featured || card.planName === 'Elite'),
  })) || [];
  const limitedOfferEndsAt = systemSettings.limitedOfferCountdown?.endsAt || '';
  const hasActiveLimitedOfferCountdown = Boolean(
    systemSettings.limitedOfferCountdown?.enabled
    && limitedOfferEndsAt,
  );

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 px-6 py-20 dark:bg-slate-950">
        <div className="flex flex-col items-center gap-4 text-center">
          <div className="h-12 w-12 animate-spin rounded-full border-b-2 border-indigo-500" />
          <p className="text-sm font-bold text-slate-500 dark:text-slate-400">Carregando landing comercial...</p>
        </div>
      </div>
    );
  }

  if (!landingPage) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 px-6 py-20 dark:bg-slate-950">
        <div className="max-w-xl rounded-2xl border border-slate-200 bg-white p-10 text-center shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-rose-50 text-rose-600 dark:bg-rose-900/20 dark:text-rose-300">
            <LayoutTemplate size={28} />
          </div>
          <h1 className="mt-6 text-2xl font-black text-slate-900 dark:text-slate-100">Landing nao encontrada</h1>
          <p className="mt-3 text-sm font-medium leading-relaxed text-slate-500 dark:text-slate-400">
            {previewRequested && !canAccessPreview
              ? 'O preview administrativo exige perfil com acesso ao painel.'
              : 'Esta campanha nao esta publicada ou nao existe no catalogo atual.'}
          </p>
          <Link href="/" className="mt-6 inline-flex items-center justify-center rounded-2xl bg-indigo-600 px-6 py-3 text-[10px] font-black uppercase tracking-[0.18em] text-white">
            Voltar ao inicio
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className={`min-h-screen font-sans selection:bg-indigo-100 dark:selection:bg-indigo-900/30 ${forceModeClass || 'bg-white text-slate-950 dark:bg-slate-950 dark:text-white'}`}>
      {isPreviewMode && (
        <div className="border-b border-amber-200 bg-amber-50 px-6 py-3 text-center text-[10px] font-black uppercase tracking-[0.2em] text-amber-700 dark:border-amber-900/30 dark:bg-amber-900/10 dark:text-amber-300">
          Preview administrativo da landing: {landingPage.title}
        </div>
      )}

      <header className="sticky top-0 z-40 border-b border-slate-100 bg-white/88 px-6 py-4 backdrop-blur-md dark:border-slate-900 dark:bg-slate-950/88">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4">
          <Link href="/" className="flex items-center gap-2 text-2xl font-black tracking-tight text-indigo-600 dark:text-indigo-400">
            <ThemeIcon className="h-8 w-8" />
            <span>{siteName}</span>
          </Link>
          <div className="flex items-center gap-3 text-xs font-bold uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">
            <ShieldCheck size={16} className="text-emerald-500" />
            Checkout seguro
          </div>
        </div>
      </header>

      <section className="relative isolate overflow-hidden px-6 pb-24 pt-20">
        <ThemeOrnaments themeId={systemSettings.activeTheme} />
        <div className="mx-auto grid max-w-7xl gap-10 lg:grid-cols-[minmax(0,1fr),420px] lg:items-center">
          <div className="space-y-8">
            <div className={`inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-[10px] font-black uppercase tracking-[0.2em] ${currentTheme.accent}`}>
              <Star size={14} />
              {landingPage.hero.eyebrow}
            </div>
            <div className="space-y-5">
              <h1 className="max-w-4xl text-5xl font-black leading-[1.02] tracking-tight text-slate-950 dark:text-white md:text-7xl">
                {landingPage.hero.title}
              </h1>
              <p className="max-w-3xl text-lg font-medium leading-relaxed text-slate-500 dark:text-slate-400 md:text-xl">
                {landingPage.hero.description}
              </p>
            </div>
            <div className="flex flex-col gap-4 sm:flex-row">
              <a
                href={featuredCard?.checkoutHref || appendTracking('/plans')}
                className={`inline-flex items-center justify-center gap-3 rounded-2xl px-8 py-5 text-xs font-black uppercase tracking-[0.2em] text-white shadow-xl transition-all hover:scale-[1.01] active:scale-95 ${currentTheme.button}`}
              >
                {landingPage.hero.primaryCtaLabel}
                <ArrowRight size={16} />
              </a>
              <a
                href="#comparar-planos"
                className="inline-flex items-center justify-center gap-3 rounded-2xl border border-slate-200 bg-white px-8 py-5 text-xs font-black uppercase tracking-[0.2em] text-slate-900 shadow-sm transition-all hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:text-white dark:hover:bg-slate-800/60"
              >
                {landingPage.hero.secondaryCtaLabel}
              </a>
            </div>
            <p className="text-sm font-semibold text-slate-500 dark:text-slate-400">{landingPage.hero.proof}</p>
          </div>

          <div className="rounded-[2.75rem] border border-slate-200 bg-white p-7 shadow-xl dark:border-slate-800 dark:bg-slate-900">
            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400 dark:text-slate-500">Plano recomendado</p>
            <h2 className="mt-3 text-3xl font-black tracking-tight text-slate-900 dark:text-white">
              {featuredCard?.displayName || 'Plano Elite'}
            </h2>
            <p className="mt-3 text-sm font-medium leading-relaxed text-slate-500 dark:text-slate-400">
              {featuredCard?.description || landingPage.eliteSection.description}
            </p>
            <div className="mt-6 rounded-2xl bg-slate-950 p-6 text-white dark:bg-slate-950">
              {featuredCard?.hasDiscount ? (
                <>
                  <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-300 line-through">
                    De {formatCurrency(featuredCard.originalMonthlyAmount)}/mes
                  </p>
                  <p className="mt-2 text-4xl font-black tracking-tight text-emerald-300">
                    {formatCurrency(featuredCard.monthlyAmount)}
                    <span className="ml-1 text-sm font-bold text-emerald-100">/mes</span>
                  </p>
                  {getCycleCount(billingCycle) > 1 && (
                    <p className="mt-2 text-xs font-bold uppercase tracking-[0.16em] text-emerald-100">
                      {formatCurrency(featuredCard.cycleAmount)}/{featuredCard.cycleLabel}
                    </p>
                  )}
                </>
              ) : (
                <p className="text-4xl font-black tracking-tight text-emerald-300">
                  {formatCurrency(featuredCard?.monthlyAmount || 0)}
                  <span className="ml-1 text-sm font-bold text-emerald-100">/mes</span>
                </p>
              )}
            </div>

            <ul className="mt-6 space-y-3">
              {(featuredCard?.featureList || landingPage.eliteSection.bullets).map((item) => (
                <li key={item} className="flex items-start gap-2 text-sm font-semibold text-slate-700 dark:text-slate-300">
                  <CheckCircle2 size={16} className="mt-0.5 shrink-0 text-emerald-500" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      <section id="comparar-planos" className="px-6 pb-8">
        <div className="mx-auto max-w-7xl">
          <div className="mb-10 flex flex-wrap items-center justify-between gap-4">
            <LandingSectionHeader
              eyebrow="Comparar ciclos"
              title="Escolha o ciclo comercial que faz sentido para o seu momento"
              description="Os cards usam o catalogo oficial ativo e refletem descontos automaticos configurados no admin."
              align="left"
            />
            <div className="inline-flex items-center gap-1 rounded-2xl border border-slate-200 bg-slate-100 p-1 dark:border-slate-800 dark:bg-slate-900">
              {BILLING_CYCLE_OPTIONS.map((option) => (
                <button
                  key={option.key}
                  type="button"
                  onClick={() => setBillingCycle(option.key)}
                  className={`inline-flex items-center gap-2 rounded-xl px-5 py-2.5 text-[10px] font-black uppercase tracking-[0.18em] transition-all ${
                    billingCycle === option.key
                      ? 'bg-white text-slate-900 shadow-sm dark:bg-indigo-600 dark:text-white'
                      : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'
                  }`}
                >
                  {option.label}
                  {eliteDiscountBadgesByCycle[option.key] > 0 && (
                    <span className={`rounded-full px-2 py-1 text-[9px] font-black uppercase tracking-[0.12em] ${
                      billingCycle === option.key
                        ? 'bg-white/20 text-current dark:bg-white/15'
                        : 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-300'
                    }`}>
                      {eliteDiscountBadgesByCycle[option.key]}% OFF
                    </span>
                  )}
                </button>
              ))}
            </div>
          </div>

          <div className="mb-8 rounded-2xl border border-emerald-200 bg-emerald-50/90 p-5 shadow-sm dark:border-emerald-900/40 dark:bg-emerald-950/20">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
              <div className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-white text-emerald-600 shadow-sm dark:bg-slate-900 dark:text-emerald-300">
                <CreditCard size={18} />
              </div>
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.18em] text-emerald-700 dark:text-emerald-300">
                  Limite do cartao
                </p>
                <p className="mt-2 text-sm font-semibold leading-relaxed text-emerald-950 dark:text-emerald-50">
                  Quando o checkout exibir cobranca mensal do termo, o limite do cartao acompanha somente o valor pago no mes.
                  Voce nao precisa comprometer o limite total do ciclo de uma vez.
                </p>
              </div>
            </div>
          </div>

          <div className={getLandingCardsGridClassName(landingPlanCards.length)}>
            {landingPlanCards.map((card) => {
              const Icon = getCardIcon(card.planName);
              return (
                <article
                  key={card.id}
                  className={`relative flex h-full flex-col overflow-hidden rounded-2xl border p-8 transition-all ${
                    card.featured
                      ? 'border-slate-900 bg-slate-900 text-white shadow-2xl dark:border-indigo-500 dark:bg-indigo-600'
                      : 'border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className={`inline-flex h-12 w-12 items-center justify-center rounded-2xl ${card.featured ? 'bg-white/10 text-white' : 'bg-indigo-50 text-indigo-600 dark:bg-indigo-900/20 dark:text-indigo-300'}`}>
                      <Icon size={22} />
                    </div>
                    <div className="flex flex-wrap justify-end gap-2">
                      {card.badge && (
                        <span className={`rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-[0.18em] ${card.featured ? 'bg-white/10 text-white' : 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200'}`}>
                          {card.badge}
                        </span>
                      )}
                      {card.hasDiscount && card.discountPercent > 0 && (
                        <span className={`rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-[0.18em] animate-pulse ${card.featured ? 'bg-emerald-300 text-slate-950' : 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-300'}`}>
                          {card.discountPercent}% OFF
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="mt-6">
                    <h3 className="text-3xl font-black tracking-tight">{card.displayName}</h3>
                    <p className={`mt-3 text-sm font-medium leading-relaxed ${card.featured ? 'text-slate-100' : 'text-slate-500 dark:text-slate-400'}`}>
                      {card.description}
                    </p>
                  </div>
                  <div className="mt-6 space-y-2">
                    {card.hasDiscount ? (
                      <>
                        <p className={`text-xs font-bold uppercase tracking-[0.16em] line-through ${card.featured ? 'text-slate-300' : 'text-slate-400 dark:text-slate-500'}`}>
                          De {formatCurrency(card.originalMonthlyAmount)}/mes
                        </p>
                        <p className={`text-4xl font-black tracking-tight ${card.featured ? 'text-emerald-300' : 'text-emerald-600 dark:text-emerald-400'}`}>
                          {formatCurrency(card.monthlyAmount)}
                          <span className={`ml-1 text-sm font-bold ${card.featured ? 'text-emerald-100' : 'text-emerald-500 dark:text-emerald-300'}`}>/mes</span>
                        </p>
                        {getCycleCount(billingCycle) > 1 && (
                          <p className={`text-xs font-bold uppercase tracking-[0.16em] ${card.featured ? 'text-emerald-100' : 'text-emerald-500 dark:text-emerald-300'}`}>
                            {formatCurrency(card.cycleAmount)}/{card.cycleLabel}
                          </p>
                        )}
                      </>
                    ) : (
                      <p className={`text-4xl font-black tracking-tight ${card.featured ? 'text-emerald-300' : 'text-emerald-600 dark:text-emerald-400'}`}>
                        {formatCurrency(card.monthlyAmount)}
                        <span className={`ml-1 text-sm font-bold ${card.featured ? 'text-emerald-100' : 'text-emerald-500 dark:text-emerald-300'}`}>/mes</span>
                      </p>
                    )}

                    <p className={`text-[10px] font-black uppercase tracking-[0.18em] ${card.featured ? 'text-indigo-100' : 'text-slate-600 dark:text-slate-300'}`}>
                      Garantia de 7 dias
                    </p>
                  </div>

                  <ul className="mt-8 flex-1 space-y-3 text-left">
                    {card.featureList.map((item) => (
                      <li key={item} className={`flex items-start gap-2 text-sm font-semibold ${card.featured ? 'text-white' : 'text-slate-700 dark:text-slate-300'}`}>
                        <CheckCircle2 size={16} className={`mt-0.5 shrink-0 ${card.featured ? 'text-white' : 'text-emerald-500'}`} />
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>

                  <a
                    href={card.checkoutHref}
                    className={`mt-8 inline-flex items-center justify-center gap-2 rounded-[1.6rem] px-6 py-4 text-[10px] font-black uppercase tracking-[0.18em] transition-all ${
                      card.isAvailable
                        ? (card.featured ? 'bg-white text-slate-950 hover:bg-slate-100' : `${currentTheme.button} text-white hover:opacity-90`)
                        : 'border border-slate-200 bg-slate-100 text-slate-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400'
                    }`}
                  >
                    {card.isAvailable ? card.ctaLabel : 'Ver catalogo'}
                    <ArrowRight size={16} />
                  </a>
                </article>
              );
            })}
          </div>

          {hasActiveLimitedOfferCountdown && (
            <LimitedOfferCountdown enabled endsAt={limitedOfferEndsAt} className="mx-auto mt-10 max-w-5xl" />
          )}
        </div>
      </section>

      <section className="bg-slate-50 px-6 py-24 dark:bg-slate-950">
        <div className="mx-auto max-w-7xl">
          <LandingSectionHeader
            eyebrow={landingPage.authoritySection.eyebrow}
            title={landingPage.authoritySection.title}
            description={landingPage.authoritySection.description}
          />

          <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
            {landingPage.authoritySection.items.map((item) => (
              <article key={item.title} className="rounded-[2.25rem] border border-slate-200 bg-white p-7 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                <div className="mb-5 inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-600 dark:bg-indigo-900/20 dark:text-indigo-300">
                  <Sparkles size={20} />
                </div>
                <h3 className="text-xl font-black tracking-tight text-slate-900 dark:text-white">{item.title}</h3>
                <p className="mt-3 text-sm font-medium leading-relaxed text-slate-500 dark:text-slate-400">{item.description}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="px-6 py-24">
        <div className="mx-auto max-w-7xl">
          <LandingSectionHeader
            eyebrow={landingPage.valueMatrix.eyebrow}
            title={landingPage.valueMatrix.title}
            description="Uma vitrine objetiva do que muda na pratica quando o estudo deixa de ser solto e passa a ser guiado por uma plataforma completa."
          />

          <div className="grid gap-6 lg:grid-cols-3">
            {[
              { title: 'O que voce faz', items: landingPage.valueMatrix.whatYouDo },
              { title: 'O que voce recebe', items: landingPage.valueMatrix.whatYouReceive },
              { title: 'O que voce conquista', items: landingPage.valueMatrix.whatYouConquer },
            ].map((column) => (
              <article key={column.title} className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                <h3 className="text-2xl font-black tracking-tight text-slate-900 dark:text-white">{column.title}</h3>
                <ul className="mt-6 space-y-3">
                  {column.items.map((item) => (
                    <li key={item} className="flex items-start gap-2 text-sm font-semibold text-slate-700 dark:text-slate-300">
                      <CheckCircle2 size={16} className="mt-0.5 shrink-0 text-emerald-500" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-slate-950 px-6 py-24 text-white">
        <div className="mx-auto grid max-w-7xl gap-8 lg:grid-cols-[minmax(0,1fr),380px] lg:items-center">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-indigo-300">{landingPage.eliteSection.eyebrow}</p>
            <h2 className="mt-4 text-4xl font-black tracking-tight md:text-5xl">{landingPage.eliteSection.title}</h2>
            <p className="mt-5 max-w-3xl text-base font-medium leading-relaxed text-slate-300">{landingPage.eliteSection.description}</p>
            <ul className="mt-8 grid gap-3 md:grid-cols-2">
              {landingPage.eliteSection.bullets.map((item) => (
                <li key={item} className="flex items-start gap-2 text-sm font-semibold text-white">
                  <CheckCircle2 size={16} className="mt-0.5 shrink-0 text-emerald-400" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/5 p-8">
            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-indigo-200">Plano Elite</p>
            <h3 className="mt-3 text-3xl font-black">{featuredCard?.displayName || 'Elite'}</h3>
            <p className="mt-3 text-sm font-medium leading-relaxed text-slate-300">
              {featuredCard?.description || landingPage.eliteSection.description}
            </p>
            <a
              href={featuredCard?.checkoutHref || appendTracking('/plans')}
              className="mt-8 inline-flex w-full items-center justify-center gap-2 rounded-[1.7rem] bg-white px-6 py-4 text-[10px] font-black uppercase tracking-[0.18em] text-slate-950 transition-all hover:bg-slate-100"
            >
              {landingPage.eliteSection.ctaLabel}
              <ArrowRight size={16} />
            </a>
          </div>
        </div>
      </section>

      <section className="px-6 py-24">
        <div className="mx-auto max-w-7xl">
          <LandingSectionHeader
            eyebrow="Comparacao de planos"
            title="Veja com clareza por que o Elite concentra a experiencia mais completa"
            description="A tabela abaixo ajuda a comparar volume, profundidade e maturidade de recursos entre as opcoes comerciais."
          />

          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <div className="overflow-x-auto">
              <table className="min-w-full border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-800">
                    <th className="px-6 py-5 text-left text-[10px] font-black uppercase tracking-[0.18em] text-slate-600 dark:text-slate-300">Recurso</th>
                    {comparisonColumns.map((column) => (
                      <th
                        key={column.key}
                        className={`px-6 py-5 text-left text-[10px] font-black uppercase tracking-[0.18em] ${
                          column.featured ? 'text-indigo-600 dark:text-indigo-300' : 'text-slate-600 dark:text-slate-300'
                        }`}
                      >
                        {column.label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {landingPage.comparisonRows.map((row) => (
                    <tr key={row.id} className="border-b border-slate-100 last:border-b-0 dark:border-slate-800/80">
                      <td className="px-6 py-5 text-sm font-black text-slate-900 dark:text-white">{row.label}</td>
                      {comparisonColumns.map((column) => (
                        <td key={`${row.id}-${column.key}`} className={`px-6 py-5 text-sm font-medium ${column.featured ? 'text-slate-900 dark:text-white' : 'text-slate-500 dark:text-slate-400'}`}>
                          {row.values[column.key] || '-'}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </section>

      <section className="bg-slate-50 px-6 py-24 dark:bg-slate-950">
        <div className="mx-auto max-w-7xl">
          <LandingSectionHeader
            eyebrow="Quebra de objecao"
            title="A decisao fica mais simples quando voce entende o risco real de continuar estudando no improviso"
            description="Estas sao as insegurancas mais comuns antes da assinatura. A ideia aqui e responder com clareza e sem promessa vazia."
          />

          <div className="grid gap-6 lg:grid-cols-2">
            {landingPage.objections.map((item) => (
              <article key={item.title} className="rounded-[2.25rem] border border-slate-200 bg-white p-7 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                <h3 className="text-xl font-black tracking-tight text-slate-900 dark:text-white">{item.title}</h3>
                <p className="mt-3 text-sm font-medium leading-relaxed text-slate-500 dark:text-slate-400">{item.description}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="px-6 py-24">
        <div className="mx-auto max-w-5xl rounded-[2.75rem] border border-emerald-200 bg-emerald-50 p-10 text-center shadow-sm dark:border-emerald-900/30 dark:bg-emerald-900/10">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-white text-emerald-600 shadow-sm dark:bg-slate-900 dark:text-emerald-300">
            <ShieldCheck size={28} />
          </div>
          <h2 className="mt-6 text-4xl font-black tracking-tight text-slate-900 dark:text-white">{landingPage.guarantee.title}</h2>
          <p className="mx-auto mt-4 max-w-3xl text-base font-medium leading-relaxed text-slate-600 dark:text-slate-300">{landingPage.guarantee.description}</p>
        </div>
      </section>

      <section className="bg-slate-50 px-6 py-24 dark:bg-slate-950">
        <div className="mx-auto max-w-5xl">
          <LandingSectionHeader
            eyebrow="Perguntas frequentes"
            title="As respostas que costumam decidir a compra"
            description="Tudo com foco em seguranca, acesso, cancelamento e entendimento claro do que esta incluso."
          />

          <div className="space-y-4">
            {landingPage.faq.map((item) => (
              <details key={item.id} className="group rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-left">
                  <div className="flex items-start gap-3">
                    <div className="mt-0.5 inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-600 dark:bg-indigo-900/20 dark:text-indigo-300">
                      <CircleHelp size={18} />
                    </div>
                    <span className="text-base font-black text-slate-900 dark:text-white">{item.question}</span>
                  </div>
                  <ChevronDown size={18} className="shrink-0 text-slate-400 transition-transform group-open:rotate-180 dark:text-slate-500" />
                </summary>
                <p className="ml-[52px] mt-4 text-sm font-medium leading-relaxed text-slate-500 dark:text-slate-400">{item.answer}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      <section className="px-6 py-24">
        <div className="mx-auto max-w-6xl rounded-[2.75rem] border border-slate-200 bg-white p-10 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
            <div className="space-y-3">
              <p className="text-[10px] font-black uppercase tracking-[0.18em] text-indigo-600 dark:text-indigo-300">Decisao final</p>
              <h2 className="text-4xl font-black tracking-tight text-slate-900 dark:text-white">{landingPage.finalCta.title}</h2>
              <p className="max-w-3xl text-sm font-medium leading-relaxed text-slate-500 dark:text-slate-400">{landingPage.finalCta.description}</p>
            </div>
            <div className="flex flex-col gap-3 sm:flex-row">
              <a
                href={featuredCard?.checkoutHref || appendTracking('/plans')}
                className={`inline-flex items-center justify-center gap-2 rounded-[1.7rem] px-8 py-4 text-[10px] font-black uppercase tracking-[0.18em] text-white transition-all hover:scale-[1.01] active:scale-95 ${currentTheme.button}`}
              >
                {landingPage.finalCta.primaryCtaLabel}
                <ArrowRight size={16} />
              </a>
              <a
                href="#comparar-planos"
                className="inline-flex items-center justify-center gap-2 rounded-[1.7rem] border border-slate-200 bg-slate-50 px-8 py-4 text-[10px] font-black uppercase tracking-[0.18em] text-slate-700 transition-all hover:bg-white dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700"
              >
                {landingPage.finalCta.secondaryCtaLabel}
              </a>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};

export default MarketingPlansLandingPage;
