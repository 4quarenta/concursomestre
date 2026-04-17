'use client';

import React, { useMemo, useState } from 'react';
import Link from 'next/link';
import { ArrowRight, BookOpen, BrainCircuit, CheckCircle2, Globe, GraduationCap, LineChart, MessageSquareQuote, ShieldCheck, Sparkles, Star, Target, Trophy, XCircle, Zap } from 'lucide-react';
import type { Plan, PlanConfig, SystemSettings } from '@/types';
import LimitedOfferCountdown from '@/components/shared/marketing/LimitedOfferCountdown';
import { themeConfig } from '@/constants/themes';
import { getCanonicalPlanName, getConfiguredPlanDisplayName, isPlanEnabledByName, resolvePlanAutoCouponsById, resolvePlanDiscountBadgesByCycle, resolvePlanOffer } from '@/services/plans';
import { websiteManifest } from '@/config/platform';
import { ThemeOrnaments } from './ThemeOrnaments';
import LandingSectionHeader from './LandingSectionHeader';
import { mergeLandingPageContent, landingFeatureIconMap, landingSocialIconMap, createDefaultLandingPageContent } from './landingContent';
import { BILLING_CYCLE_OPTIONS, type LandingBillingCycle, FEEDBACK_ITEMS, FINAL_CONVERSION_CONTENT, HERO_BENEFITS, HOW_IT_HELPS, OBJECTIVE_FOCUS_ITEMS, PLAN_COPY_BY_TIER, PROOF_STRIP } from './homepageContent';

interface LandingCommercialClientProps {
  systemSettings: SystemSettings;
  plans: Plan[];
}

const PLAN_ORDER_INDEX: Record<string, number> = { Gratuito: 0, Essencial: 1, Pro: 2, Elite: 3 };
const HOW_IT_HELPS_ICONS = [Target, BookOpen, Sparkles, LineChart, BrainCircuit, ShieldCheck] as const;
const OBJECTIVE_ICONS = [Trophy, GraduationCap, Zap] as const;
const formatCurrency = (value: number) => `R$ ${value.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const isPlanInCycle = (plan: Plan, cycle: LandingBillingCycle) => {
  const isMonthly = plan.interval_unit === 'month' && plan.interval_count === 1;
  const isQuarterly = plan.interval_unit === 'month' && plan.interval_count === 3;
  const isAnnual = plan.interval_unit === 'year' || (plan.interval_unit === 'month' && plan.interval_count === 12);
  if (plan.price === 0) return true;
  if (cycle === 'monthly') return isMonthly;
  if (cycle === 'quarterly') return isQuarterly;
  return isAnnual;
};

const getMonthlyEquivalent = (plan: Plan) => {
  if (plan.price === 0) return 0;
  if (plan.interval_unit === 'year') return plan.price / 12;
  if (plan.interval_unit === 'month' && plan.interval_count > 1) return plan.price / plan.interval_count;
  return plan.price;
};

const getPlanTotalLabel = (plan: Plan) => {
  if (plan.price === 0) return 'Sem cobrança';
  if (plan.interval_unit === 'year') return `${formatCurrency(plan.price)} por ano`;
  if (plan.interval_unit === 'month' && plan.interval_count === 3) return `${formatCurrency(plan.price)} a cada 3 meses`;
  return `${formatCurrency(plan.price)} por mês`;
};

const getPlanFeatureList = (plan: Plan) => {
  if (!Array.isArray(plan.features)) return [];
  return plan.features.filter((feature) => feature.included).map((feature) => feature.text).filter(Boolean).slice(0, 5);
};

const normalizeFeatureKey = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();

const LANDING_PLAN_FEATURE_COPY: Array<{ match: string[]; text: string }> = [
  { match: ['banco de questoes', 'questoes ilimitadas'], text: 'Acesso completo a milhares de questões para treinar todos os dias.' },
  { match: ['simulados', 'simulados ilimitados'], text: 'Simulados ilimitados com análise detalhada do seu desempenho.' },
  { match: ['comentarios', 'comentarios da comunidade'], text: 'Comentários e contexto para revisar melhor e aprender com cada erro.' },
  { match: ['desempenho', 'estatisticas', 'estatisticas basicas'], text: 'Leitura clara da sua evolução para saber onde ajustar a rota.' },
  { match: ['revisao', 'materiais', 'materiais de estudo'], text: 'Revisão mais eficiente com apoio para voltar no que realmente importa.' },
];

const formatPlanFeatureForLanding = (feature: string) => {
  const normalized = normalizeFeatureKey(feature);
  const mapped = LANDING_PLAN_FEATURE_COPY.find((item) => item.match.some((term) => normalized.includes(term)));
  return mapped?.text || feature;
};

const getConfiguredPlanFeatures = (
  plan: Plan,
  configuredPlanDetails?: Partial<Record<'Gratuito' | 'Essencial' | 'Pro' | 'Elite', PlanConfig>> | null,
) => {
  const canonicalPlan = getCanonicalPlanName(plan.name);
  const configuredFeatures = configuredPlanDetails?.[canonicalPlan]?.features;
  if (Array.isArray(configuredFeatures) && configuredFeatures.length > 0) {
    return configuredFeatures
      .filter((feature) => feature?.included)
      .map((feature) => String(feature.text || '').trim())
      .filter(Boolean)
      .slice(0, 5);
  }

  return getPlanFeatureList(plan);
};

const getConfiguredPlanFeatureItems = (
  plan: Plan,
  configuredPlanDetails?: Partial<Record<'Gratuito' | 'Essencial' | 'Pro' | 'Elite', PlanConfig>> | null,
) => {
  const canonicalPlan = getCanonicalPlanName(plan.name);
  const configuredFeatures = configuredPlanDetails?.[canonicalPlan]?.features;
  if (Array.isArray(configuredFeatures) && configuredFeatures.length > 0) {
    return configuredFeatures
      .map((feature) => ({
        included: Boolean(feature?.included),
        text: String(feature?.text || '').trim(),
      }))
      .filter((feature) => feature.text);
  }

  if (!Array.isArray(plan.features)) {
    return [];
  }

  return plan.features
    .map((feature) => ({
      included: Boolean(feature?.included),
      text: String(feature?.text || '').trim(),
    }))
    .filter((feature) => feature.text);
};

const buildCanonicalUrl = (url?: string | null) => String(url || '').trim() || websiteManifest.website.canonicalUrl || `${window.location.origin}/`;

const LandingCommercialClient: React.FC<LandingCommercialClientProps> = ({ systemSettings, plans }) => {
  const [billingCycle, setBillingCycle] = useState<LandingBillingCycle>('annual');

  const currentTheme = themeConfig[systemSettings.activeTheme || 'default'] || themeConfig.default;
  const ThemeIcon = currentTheme.icon;
  const siteName = systemSettings.siteName || websiteManifest.website.applicationName || 'ConcursoMestre';
  const landingContent = useMemo(() => mergeLandingPageContent(systemSettings.landingPageContent || createDefaultLandingPageContent()), [systemSettings.landingPageContent]);
  const forceModeClass = currentTheme.forceMode === 'dark' ? 'dark bg-slate-950 text-white' : currentTheme.forceMode === 'light' ? 'light bg-white text-slate-950' : '';

  const visibleFeatureCards = useMemo(() => landingContent.featureCards.filter((card) => card.enabled !== false), [landingContent.featureCards]);
  const activeSocialLinks = useMemo(() => landingContent.socialLinks.filter((link) => link.enabled && link.url), [landingContent.socialLinks]);
  const planCatalog = useMemo(() => plans
    .filter((plan) => plan.is_active !== false)
    .filter((plan) => isPlanEnabledByName(plan.name, systemSettings.planDetails))
    .sort((left, right) => {
      const leftOrder = PLAN_ORDER_INDEX[getCanonicalPlanName(left.name)] ?? 99;
      const rightOrder = PLAN_ORDER_INDEX[getCanonicalPlanName(right.name)] ?? 99;
      return leftOrder === rightOrder ? left.price - right.price : leftOrder - rightOrder;
    }), [plans, systemSettings.planDetails]);
  const freePlan = useMemo(() => planCatalog.find((plan) => plan.price === 0) || null, [planCatalog]);
  const visiblePlans = useMemo(() => {
    const cyclePlans = planCatalog.filter((plan) => isPlanInCycle(plan, billingCycle));
    const paidPlans = cyclePlans.filter((plan) => plan.price > 0);
    return freePlan ? [freePlan, ...paidPlans] : paidPlans;
  }, [billingCycle, freePlan, planCatalog]);
  const featuredPlanId = useMemo(() => visiblePlans.find((plan) => getCanonicalPlanName(plan.name) === 'Pro')?.id ?? visiblePlans.find((plan) => plan.price > 0)?.id ?? null, [visiblePlans]);

  const autoCouponsByPlanId = useMemo(
    () => resolvePlanAutoCouponsById(visiblePlans, systemSettings.coupons || []),
    [systemSettings.coupons, visiblePlans],
  );

  const planOffersById = useMemo(() => {
    return Object.fromEntries(visiblePlans.map((plan) => [
      plan.id,
      resolvePlanOffer({
        plan,
        pricing: systemSettings.pricing,
        planDetails: systemSettings.planDetails,
        discountAmount: autoCouponsByPlanId[plan.id]?.discountAmount || 0,
      }),
    ]));
  }, [autoCouponsByPlanId, systemSettings.planDetails, systemSettings.pricing, visiblePlans]);

  const eliteDiscountBadgesByCycle = useMemo(() => (
    resolvePlanDiscountBadgesByCycle({
      plans: planCatalog,
      canonicalPlanName: 'Elite',
      coupons: systemSettings.coupons || [],
      pricing: systemSettings.pricing,
      planDetails: systemSettings.planDetails,
    })
  ), [planCatalog, systemSettings.coupons, systemSettings.planDetails, systemSettings.pricing]);

  const hasVisibleOffer = useMemo(
    () => visiblePlans.some((plan) => planOffersById[plan.id]?.hasDiscount),
    [planOffersById, visiblePlans],
  );
  const limitedOfferEndsAt = systemSettings.limitedOfferCountdown?.endsAt || '';
  const hasActiveLimitedOfferCountdown = Boolean(
    systemSettings.limitedOfferCountdown?.enabled
    && limitedOfferEndsAt
    && new Date(limitedOfferEndsAt).getTime() > Date.now(),
  );



  const navLinks = [
    { label: 'Recursos', href: '#recursos' },
    { label: 'Como ajuda', href: '#como-ajuda' },
    { label: 'Focos', href: '#focos' },
    { label: 'Planos', href: '#planos' },
  ];

  return (
    <div className={`min-h-screen font-sans selection:bg-indigo-100 transition-colors duration-300 dark:selection:bg-indigo-900/30 ${forceModeClass || 'bg-white dark:bg-slate-950'}`}>
      {systemSettings.activePromotion.isActive && (
        <div className="border-b border-white/10 bg-slate-900 px-6 py-2.5 text-center text-[10px] font-black uppercase tracking-[0.2em] text-white dark:bg-indigo-950">
          <div className="mx-auto flex max-w-7xl items-center justify-center gap-3">
            <Zap size={14} className="text-amber-400" />
            <span>{systemSettings.activePromotion.bannerText}</span>
            <Link href="/auth?register=true" className="rounded-full bg-white px-3 py-1 text-[9px] text-slate-900 transition-colors hover:bg-slate-100">
              Começar grátis
            </Link>
          </div>
        </div>
      )}
      <nav className="sticky top-0 z-50 border-b border-slate-100 bg-white/85 px-6 py-4 backdrop-blur-md dark:border-slate-900 dark:bg-slate-950/85">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-6">
          <Link href="/" className="flex shrink-0 items-center gap-2 text-2xl font-black tracking-tight text-indigo-600 dark:text-indigo-400">
            <ThemeIcon className="h-8 w-8" />
            <span>{siteName}</span>
          </Link>

          <div className="hidden flex-1 items-center justify-center gap-6 md:flex">
            {navLinks.map((link) => (
              <a
                key={link.label}
                href={link.href}
                className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 transition-colors hover:text-indigo-600 dark:text-slate-400 dark:hover:text-indigo-300"
              >
                {link.label}
              </a>
            ))}
          </div>

          <div className="flex shrink-0 items-center gap-4">
            <Link href="/auth" className="text-[11px] font-black uppercase tracking-widest text-slate-900 transition-colors hover:text-indigo-600 dark:text-slate-100 dark:hover:text-indigo-400">
              Entrar
            </Link>
            <Link
              href="/auth?register=true"
              className={`rounded-xl px-6 py-2.5 text-[10px] font-black uppercase tracking-widest text-white shadow-lg transition-all hover:scale-105 active:scale-95 ${currentTheme.button}`}
            >
              Criar conta grátis
            </Link>
          </div>
        </div>
      </nav>
      <section className="relative isolate overflow-hidden px-6 pb-28 pt-20">
        <ThemeOrnaments themeId={systemSettings.activeTheme} />

        <div className="absolute left-1/2 top-0 -z-10 h-full w-full max-w-7xl -translate-x-1/2 opacity-10 dark:opacity-20">
          <div className={`absolute left-10 top-20 h-96 w-96 rounded-full blur-[120px] ${currentTheme.bgOverlay}`} />
          <div className={`absolute bottom-20 right-10 h-96 w-96 rounded-full blur-[120px] ${currentTheme.bgOverlay} opacity-60`} />
        </div>

        <div className="mx-auto max-w-5xl">
          <div className="space-y-8 text-center">
            <div className={`inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-[10px] font-black uppercase tracking-[0.2em] ${currentTheme.accent}`}>
              <CheckCircle2 size={14} />
              Estude com direção, não no escuro
            </div>

            <div className="space-y-5">
              <h1 className="text-5xl font-black leading-[1.05] tracking-tight text-slate-950 dark:text-white md:text-7xl">
                Se você quer passar,
                {' '}
                <span className={`bg-gradient-to-r bg-clip-text text-transparent ${currentTheme.heroGradient}`}>
                  precisa estudar com estratégia
                </span>
                .
              </h1>
              <p className="mx-auto max-w-3xl text-lg font-medium leading-relaxed text-slate-500 dark:text-slate-400 md:text-xl">
                Banco de questões, simulados e análise de desempenho para te mostrar exatamente onde você está e como melhorar.
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              {HERO_BENEFITS.map((benefit) => (
                <div key={benefit} className="rounded-[1.75rem] border border-slate-200 bg-white/80 p-4 shadow-sm backdrop-blur-sm dark:border-slate-800 dark:bg-slate-900/80">
                  <p className="flex items-start gap-2 text-sm font-semibold leading-relaxed text-slate-700 dark:text-slate-300">
                    <CheckCircle2 size={16} className="mt-0.5 shrink-0 text-emerald-500" />
                    <span>{benefit}</span>
                  </p>
                </div>
              ))}
            </div>

            <div className="flex flex-col gap-4 pt-2 sm:flex-row">
              <Link
                href="/auth?register=true"
                className={`flex items-center justify-center gap-3 rounded-[2rem] px-10 py-5 text-sm font-black uppercase tracking-[0.2em] text-white shadow-xl transition-all hover:scale-105 active:scale-95 sm:flex-1 ${currentTheme.button}`}
              >
                Começar grátis <ArrowRight size={18} />
              </Link>
              <a
                href="#planos"
                className="flex items-center justify-center gap-3 rounded-[2rem] border border-slate-200 bg-white px-10 py-5 text-sm font-black uppercase tracking-[0.2em] text-slate-900 shadow-md transition-all hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:text-white dark:hover:bg-slate-800/60 sm:flex-1"
              >
                Ver planos
              </a>
            </div>

            <p className="text-sm font-semibold text-slate-500 dark:text-slate-400">
              Sem cartão • Comece em menos de 1 minuto
            </p>
          </div>
        </div>
      </section>

      <section className="bg-slate-950 px-6 py-16">
        <div className="mx-auto grid max-w-7xl gap-5 md:grid-cols-2 xl:grid-cols-4">
          {PROOF_STRIP.map((item) => (
            <div key={item.title} className="rounded-[1.75rem] border border-white/10 bg-white/5 p-5">
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-indigo-300">{item.title}</p>
              <p className="mt-3 text-sm font-medium leading-relaxed text-slate-300">{item.description}</p>
            </div>
          ))}
        </div>
      </section>
      <section id="recursos" className="bg-slate-50 px-6 py-28 transition-colors dark:bg-slate-950">
        <div className="mx-auto max-w-7xl">
          <LandingSectionHeader
            eyebrow="O que você encontra na plataforma"
            title="Recursos pensados para fazer você estudar melhor"
            description="Tudo aqui existe para te dar mais clareza, mais direção e mais chance de evoluir sem desperdiçar tempo."
          />

          <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
            {visibleFeatureCards.map((card) => {
              const Icon = landingFeatureIconMap[card.iconKey];
              return (
                <article key={card.id} className="group rounded-[2.5rem] border border-slate-100 bg-white p-8 shadow-sm transition-all hover:-translate-y-1 hover:shadow-xl dark:border-slate-800 dark:bg-slate-900">
                  <div className="mb-6 inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-600 transition-transform group-hover:scale-110 dark:bg-indigo-900/20 dark:text-indigo-300">
                    <Icon size={24} />
                  </div>
                  <h3 className="text-xl font-black tracking-tight text-slate-900 dark:text-white">{card.title}</h3>
                  <p className="mt-3 text-sm font-medium leading-relaxed text-slate-500 dark:text-slate-400">{card.description}</p>
                </article>
              );
            })}
          </div>
        </div>
      </section>

      <section id="como-ajuda" className="px-6 py-28">
        <div className="mx-auto max-w-7xl">
          <LandingSectionHeader
            eyebrow={`Como o ${siteName} vai te ajudar`}
            title="Um fluxo para estudar com mais direção"
            description="Você pratica, revisa e acompanha sua evolução no mesmo lugar, sem depender de tentativa e erro para saber o que fazer depois."
          />

          <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
            {HOW_IT_HELPS.map((item, index) => {
              const Icon = HOW_IT_HELPS_ICONS[index % HOW_IT_HELPS_ICONS.length];
              return (
                <div key={item.title} className="rounded-[2.25rem] border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                  <div className="mb-5 flex items-center gap-3">
                    <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-indigo-600 dark:bg-slate-800 dark:text-indigo-300">
                      <Icon size={20} />
                    </div>
                    <span className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400 dark:text-slate-500">Etapa {index + 1}</span>
                  </div>
                  <h3 className="text-lg font-black text-slate-900 dark:text-white">{item.title}</h3>
                  <p className="mt-3 text-sm font-medium leading-relaxed text-slate-500 dark:text-slate-400">{item.description}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      <section className="bg-slate-50 px-6 py-28 dark:bg-slate-950">
        <div className="mx-auto max-w-7xl">
          <LandingSectionHeader
            eyebrow="Recomendações e feedback"
            title="Quem usa, evolui"
            description="A plataforma precisa fazer sentido na rotina real de quem quer estudar melhor, com mais clareza e menos improviso."
          />

          <div className="grid gap-6 lg:grid-cols-3">
            {FEEDBACK_ITEMS.map((item) => (
              <article key={item.author} className="rounded-[2.25rem] border border-slate-200 bg-white p-7 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                <div className="mb-5 inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-600 dark:bg-indigo-900/20 dark:text-indigo-300">
                  <MessageSquareQuote size={20} />
                </div>
                <p className="text-base font-semibold leading-relaxed text-slate-700 dark:text-slate-200">{item.quote}</p>
                <div className="mt-6 border-t border-slate-200 pt-4 dark:border-slate-800">
                  <p className="text-sm font-black text-slate-900 dark:text-white">{item.author}</p>
                  <p className="mt-1 text-xs font-medium uppercase tracking-[0.16em] text-slate-400 dark:text-slate-500">{item.context}</p>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section id="focos" className="px-6 py-28">
        <div className="mx-auto max-w-7xl">
          <LandingSectionHeader
            eyebrow="Especialização por objetivo"
            title="A sua chave para concursos e exames mais disputados do país"
            description="Cada objetivo pede uma estratégia diferente. A plataforma te ajuda a estudar com mais precisão no contexto da prova que você quer enfrentar."
          />

          <div className="grid gap-6 lg:grid-cols-3">
            {OBJECTIVE_FOCUS_ITEMS.map((item, index) => {
              const Icon = OBJECTIVE_ICONS[index % OBJECTIVE_ICONS.length];
              return (
                <article key={item.title} className="rounded-[2.5rem] border border-slate-200 bg-white p-8 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                  <div className="mb-6 inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-600 dark:bg-indigo-900/20 dark:text-indigo-300">
                    <Icon size={24} />
                  </div>
                  <h3 className="text-2xl font-black tracking-tight text-slate-900 dark:text-white">{item.title}</h3>
                  <p className="mt-4 text-sm font-medium leading-relaxed text-slate-500 dark:text-slate-400">{item.description}</p>
                  <ul className="mt-6 space-y-3">
                    {item.bullets.map((bullet) => (
                      <li key={bullet} className="flex items-start gap-2 text-sm font-semibold text-slate-700 dark:text-slate-300">
                        <CheckCircle2 size={16} className="mt-0.5 shrink-0 text-emerald-500" />
                        <span>{bullet}</span>
                      </li>
                    ))}
                  </ul>
                </article>
              );
            })}
          </div>
        </div>
      </section>
      <section className="bg-slate-950 px-6 py-24 text-white">
        <div className="mx-auto grid max-w-7xl gap-8 lg:grid-cols-[minmax(0,1fr)_420px]">
          <div className="space-y-5">
            <p className="text-[10px] font-black uppercase tracking-[0.3em] text-indigo-300">Comece grátis</p>
            <h2 className="text-3xl font-black tracking-tight md:text-5xl">Comece grátis e veja sua evolução na prática</h2>
            <p className="max-w-3xl text-base font-medium leading-relaxed text-slate-300">
              Crie sua conta, teste a plataforma e entenda rapidamente onde você precisa melhorar.
            </p>
            <div className="flex flex-col gap-4 sm:flex-row">
              <Link href="/auth?register=true" className="inline-flex items-center justify-center gap-3 rounded-[2rem] bg-white px-8 py-4 text-xs font-black uppercase tracking-[0.2em] text-slate-950 transition-all hover:bg-slate-100">
                Começar grátis <ArrowRight size={16} />
              </Link>
              <a href="#planos" className="inline-flex items-center justify-center gap-3 rounded-[2rem] border border-white/15 px-8 py-4 text-xs font-black uppercase tracking-[0.2em] text-white transition-all hover:bg-white/5">
                Ver planos
              </a>
            </div>
            <p className="text-sm font-semibold text-slate-400">Sem compromisso. Sem cartão.</p>
          </div>

          <div className="rounded-[2.5rem] border border-white/10 bg-white/5 p-7">
            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-indigo-200">Plano de entrada</p>
            <h3 className="mt-3 text-2xl font-black">{freePlan ? getConfiguredPlanDisplayName(freePlan.name, systemSettings.planDetails, freePlan.name) : 'Acesso gratuito'}</h3>
            <p className="mt-3 text-sm font-medium leading-relaxed text-slate-300">
              {freePlan?.description || 'Ideal para conhecer a plataforma, praticar com foco e descobrir rapidamente como seu estudo pode ganhar mais direção.'}
            </p>
            <ul className="mt-6 space-y-3">
              {(freePlan ? getConfiguredPlanFeatures(freePlan, systemSettings.planDetails).map(formatPlanFeatureForLanding) : [
                'Teste a plataforma sem pagar.',
                'Comece com prática, revisão e mais clareza.',
                'Suba de plano quando fizer sentido para você.',
              ]).map((item) => (
                <li key={item} className="flex items-start gap-2 text-sm font-semibold text-white">
                  <CheckCircle2 size={16} className="mt-0.5 shrink-0 text-emerald-400" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      <section id="planos" className="px-6 py-28">
        <div className="mx-auto max-w-7xl">
          <LandingSectionHeader
            eyebrow="Planos e preços"
            title="Entre grátis agora e avance para o plano certo quando quiser ir além"
            description="Você pode começar sem pagar e subir de plano quando quiser mais profundidade, mais volume de treino e mais análise para acelerar seu resultado."
          />

          <div className="mb-12 flex justify-center">
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

          {visiblePlans.length === 0 ? (
            <div className="rounded-[2.5rem] border border-slate-200 bg-white p-10 text-center shadow-sm dark:border-slate-800 dark:bg-slate-900">
              <p className="text-sm font-bold text-slate-500 dark:text-slate-400">Nenhum plano ativo encontrado no catálogo atual.</p>
            </div>
          ) : (
            <div className="grid justify-center gap-6 [grid-template-columns:repeat(auto-fit,minmax(280px,320px))]">
              {visiblePlans.map((plan) => {
                const canonicalName = getCanonicalPlanName(plan.name);
                const displayName = getConfiguredPlanDisplayName(plan.name, systemSettings.planDetails, plan.name);
                const isFeatured = plan.id === featuredPlanId;
                const planCopy = PLAN_COPY_BY_TIER[canonicalName] || PLAN_COPY_BY_TIER.Gratuito;
                  const featureItems = getConfiguredPlanFeatureItems(plan, systemSettings.planDetails).map((feature) => ({
                    ...feature,
                    text: formatPlanFeatureForLanding(feature.text),
                  }));
                  const offer = planOffersById[plan.id];
                  const showOffer = Boolean(offer?.hasDiscount);
                  const showCycleTotal = Boolean(showOffer && offer.cycleCount > 1);
                const cycleSuffix = offer?.cycleLabel === 'ano'
                  ? '/ano'
                  : offer?.cycleLabel === 'cada 3 meses'
                    ? '/cada 3 meses'
                    : '/mês';
                const pricingFooterLabel = showOffer
                  ? (hasActiveLimitedOfferCountdown ? 'Oferta por tempo limitado' : 'Desconto aplicado')
                  : (plan.price === 0 ? 'Sem cobrança' : getPlanTotalLabel(plan));

                return (
                  <article
                    key={plan.id}
                    className={`relative isolate flex h-full flex-col overflow-hidden rounded-[2.5rem] border p-8 text-center transition-all ${
                      isFeatured
                        ? 'scale-[1.02] border-slate-900 bg-slate-900 text-white shadow-2xl dark:border-indigo-500 dark:bg-indigo-600'
                        : 'border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900'
                    }`}
                  >
                    {isFeatured && (
                      <>
                        <div className="pointer-events-none absolute inset-x-10 top-10 -z-10 h-32 rounded-full bg-emerald-400/30 blur-3xl animate-pulse" />
                        <div className="pointer-events-none absolute right-8 top-20 -z-10 h-28 w-28 rounded-full bg-cyan-300/20 blur-3xl animate-pulse" />
                      </>
                    )}
                    <div className="mb-6 flex flex-col items-center justify-center gap-4">
                      <div className="space-y-3">
                        <p className={`text-[10px] font-black uppercase tracking-[0.18em] ${isFeatured ? 'text-indigo-200' : 'text-indigo-600 dark:text-indigo-300'}`}>
                          {planCopy.eyebrow}
                        </p>
                        <h3 className="text-2xl font-black tracking-tight">{displayName}</h3>
                      </div>
                      <div className="flex flex-wrap items-center justify-center gap-2">
                        {isFeatured && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-white/10 px-3 py-1 text-[10px] font-black uppercase tracking-[0.18em] text-white backdrop-blur-md">
                            <Star size={12} className="fill-white" />
                            Mais escolhido
                          </span>
                        )}
                        {showOffer && offer.effectiveDiscountPercent > 0 && (
                          <span className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-[0.18em] animate-pulse ${
                            isFeatured ? 'bg-emerald-300 text-slate-950' : 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-300'
                          }`}>
                            {offer.effectiveDiscountPercent}% OFF
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex flex-col items-center space-y-2">
                      {showOffer && plan.price > 0 ? (
                        <>
                          <p className={`text-xs font-bold uppercase tracking-[0.16em] line-through ${isFeatured ? 'text-slate-300' : 'text-slate-400 dark:text-slate-500'}`}>
                            De {formatCurrency(offer.originalMonthlyAmount)}/mês
                          </p>
                          <p className={`text-4xl font-black tracking-tight ${isFeatured ? 'text-emerald-300' : 'text-emerald-600 dark:text-emerald-400'}`}>
                            {formatCurrency(offer.discountedMonthlyAmount)}
                            <span className={`ml-1 text-sm font-bold ${isFeatured ? 'text-emerald-100' : 'text-emerald-500 dark:text-emerald-300'}`}>/mês</span>
                          </p>
                          {showCycleTotal && (
                            <p className={`text-xs font-bold uppercase tracking-[0.16em] ${isFeatured ? 'text-emerald-100' : 'text-emerald-500 dark:text-emerald-300'}`}>
                              {formatCurrency(offer.discountedCycleAmount)}{cycleSuffix}
                            </p>
                          )}
                        </>
                      ) : (
                        <>
                          <p className={`text-4xl font-black tracking-tight ${isFeatured ? 'text-emerald-300' : 'text-emerald-600 dark:text-emerald-400'}`}>
                            {plan.price === 0 ? 'Grátis' : formatCurrency(offer?.discountedMonthlyAmount || 0)}
                            {plan.price > 0 && <span className={`ml-1 text-sm font-bold ${isFeatured ? 'text-emerald-100' : 'text-emerald-500 dark:text-emerald-300'}`}>/mês</span>}
                          </p>
                        </>
                      )}
                      <p className={`text-xs font-bold uppercase tracking-[0.16em] ${isFeatured ? 'text-emerald-100' : 'text-emerald-500 dark:text-emerald-300'}`}>
                        {pricingFooterLabel}
                      </p>
                    </div>

                    <p className={`mt-5 max-w-sm text-sm font-medium leading-relaxed ${isFeatured ? 'text-slate-100' : 'text-slate-500 dark:text-slate-400'}`}>
                      {planCopy.description}
                    </p>

                      <ul className="mt-8 flex-1 self-stretch space-y-3 text-left">
                        {featureItems.map((feature) => {
                          const isEnabled = feature.included;
                          const iconClass = isFeatured
                            ? (isEnabled ? 'text-white' : 'text-white/60')
                            : (isEnabled ? 'text-emerald-500' : 'text-slate-400');
                          const textClass = isFeatured
                            ? (isEnabled ? 'text-white' : 'text-white/70')
                            : (isEnabled ? 'text-slate-700 dark:text-slate-300' : 'text-slate-400 dark:text-slate-500');

                          return (
                            <li key={`${feature.text}-${isEnabled ? 'on' : 'off'}`} className="flex items-start gap-2 text-sm font-semibold">
                              {isEnabled ? (
                                <CheckCircle2 size={16} className={`mt-0.5 shrink-0 ${iconClass}`} />
                              ) : (
                                <XCircle size={16} className={`mt-0.5 shrink-0 ${iconClass}`} />
                              )}
                              <span className={textClass}>{feature.text}</span>
                            </li>
                          );
                        })}
                      </ul>

                    <Link
                      href={`/checkout/${plan.id}`}
                      className={`mt-8 inline-flex w-full items-center justify-center gap-2 rounded-[1.6rem] px-6 py-4 text-[10px] font-black uppercase tracking-[0.18em] transition-all ${
                        isFeatured ? 'bg-white text-slate-950 hover:bg-slate-100' : `${currentTheme.button} text-white hover:opacity-90`
                      }`}
                    >
                      {planCopy.cta}
                    </Link>
                  </article>
                );
              })}
            </div>
          )}

          {hasVisibleOffer && hasActiveLimitedOfferCountdown && (
            <LimitedOfferCountdown enabled endsAt={limitedOfferEndsAt} className="mx-auto mt-10 max-w-5xl" />
          )}
        </div>
      </section>
      <section className="bg-slate-50 px-6 py-28 dark:bg-slate-950">
        <div className="mx-auto max-w-7xl">
          <LandingSectionHeader
            eyebrow="Comunidade e presença"
            title="Conteúdos e dicas para estudar melhor todos os dias"
            description="Acompanhe novidades, orientações práticas e os canais da plataforma para manter o estudo vivo fora da rotina de questões."
          />

          <div className="grid gap-6 md:grid-cols-3">
            {(activeSocialLinks.length > 0 ? activeSocialLinks : landingContent.socialLinks).map((item) => {
              const Icon = landingSocialIconMap[item.iconKey];
              const isClickable = Boolean(item.url);
              const content = (
                <div className="rounded-[2.25rem] border border-slate-200 bg-white p-7 shadow-sm transition-all hover:-translate-y-1 hover:shadow-xl dark:border-slate-800 dark:bg-slate-900">
                  <div className="mb-5 inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-600 dark:bg-indigo-900/20 dark:text-indigo-300">
                    <Icon size={20} />
                  </div>
                  <h3 className="text-lg font-black text-slate-900 dark:text-white">{item.label}</h3>
                  <p className="mt-2 text-sm font-medium text-slate-500 dark:text-slate-400">
                    {item.handle || 'Acompanhe novidades, dicas práticas e atualizações da plataforma.'}
                  </p>
                  <p className="mt-4 text-[10px] font-black uppercase tracking-[0.18em] text-indigo-600 dark:text-indigo-300">
                    {isClickable ? 'Acessar canal' : 'Canal em configuração'}
                  </p>
                </div>
              );

              if (!isClickable) return <div key={item.id}>{content}</div>;
              return <a key={item.id} href={item.url} target="_blank" rel="noreferrer" className="block">{content}</a>;
            })}
          </div>
        </div>
      </section>

      <section className="px-6 py-28">
        <div className="mx-auto max-w-7xl">
          <LandingSectionHeader
            eyebrow="Próximo passo"
            title="Se você quer estudar com mais direção, o próximo passo é começar"
            description="Sem promessas vazias. A ideia aqui é simples: usar uma rotina mais clara para transformar esforço em progresso real."
            align="left"
          />

          <div className="grid gap-8 lg:grid-cols-2">
            {FINAL_CONVERSION_CONTENT.map((block) => (
              <article key={block.title} className="rounded-[2.5rem] border border-slate-200 bg-white p-8 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                <h3 className="text-2xl font-black tracking-tight text-slate-900 dark:text-white">{block.title}</h3>
                <div className="mt-5 space-y-4">
                  {block.paragraphs.map((paragraph) => {
                    const resolvedParagraph = paragraph.replace('ConcursoMestre', siteName);
                    return <p key={resolvedParagraph} className="text-sm font-medium leading-relaxed text-slate-600 dark:text-slate-400">{resolvedParagraph}</p>;
                  })}
                </div>
              </article>
            ))}
          </div>

          <div className="mt-10 rounded-[2.5rem] border border-indigo-100 bg-indigo-50 p-8 dark:border-indigo-900/30 dark:bg-indigo-900/10">
            <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
              <div className="space-y-3">
                <p className="text-[10px] font-black uppercase tracking-[0.18em] text-indigo-600 dark:text-indigo-300">Criar conta</p>
                <h3 className="text-3xl font-black tracking-tight text-slate-900 dark:text-white">
                  Comece grátis e veja na prática onde você pode evoluir mais rápido.
                </h3>
                <p className="max-w-3xl text-sm font-medium leading-relaxed text-slate-600 dark:text-slate-400">
                  Crie sua conta, conheça o fluxo da plataforma e descubra como questões, simulados, revisão e desempenho podem trabalhar juntos no seu resultado.
                </p>
              </div>
              <Link href="/auth?register=true" className={`inline-flex items-center justify-center gap-3 rounded-[2rem] px-8 py-4 text-xs font-black uppercase tracking-[0.2em] text-white transition-all hover:scale-105 active:scale-95 ${currentTheme.button}`}>
                Criar conta grátis <ArrowRight size={16} />
              </Link>
            </div>
          </div>
        </div>
      </section>

      <footer className="border-t border-slate-100 px-6 py-20 shadow-inner dark:border-slate-900">
        <div className="mx-auto grid max-w-7xl gap-12 md:grid-cols-4">
          <div className="space-y-6">
            <div className="flex items-center gap-2 text-xl font-black tracking-tight text-indigo-600 dark:text-indigo-400">
              <ThemeIcon size={24} />
              <span>{siteName}</span>
            </div>
            <p className="text-sm leading-relaxed text-slate-500 dark:text-slate-400">
              Plataforma de estudos para concurso, OAB e ENEM com banco de questões, simulados, revisão e análise de desempenho.
            </p>
          </div>

          <div>
            <h4 className="mb-6 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 dark:text-slate-500">Produto</h4>
            <ul className="space-y-4 text-sm font-bold text-slate-600 dark:text-slate-400">
              <li><a href="#recursos" className="transition-colors hover:text-indigo-600 dark:hover:text-indigo-300">Recursos</a></li>
              <li><a href="#focos" className="transition-colors hover:text-indigo-600 dark:hover:text-indigo-300">Focos de preparação</a></li>
              <li><a href="#planos" className="transition-colors hover:text-indigo-600 dark:hover:text-indigo-300">Planos</a></li>
            </ul>
          </div>

          <div>
            <h4 className="mb-6 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 dark:text-slate-500">Acesso</h4>
            <ul className="space-y-4 text-sm font-bold text-slate-600 dark:text-slate-400">
              <li><Link href="/auth" className="transition-colors hover:text-indigo-600 dark:hover:text-indigo-300">Entrar</Link></li>
              <li><Link href="/auth?register=true" className="transition-colors hover:text-indigo-600 dark:hover:text-indigo-300">Criar conta grátis</Link></li>
              <li><Link href="/planos" className="transition-colors hover:text-indigo-600 dark:hover:text-indigo-300">Ver planos completos</Link></li>
            </ul>
          </div>

          <div>
            <h4 className="mb-6 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 dark:text-slate-500">Institucional</h4>
            <div className="flex items-center gap-2 text-sm font-bold text-slate-600 dark:text-slate-400">
              <Globe size={18} />
              <span>Português (Brasil)</span>
            </div>
            <p className="mt-4 text-[10px] font-medium leading-relaxed text-slate-400">
              © 2026 {siteName}. Plataforma focada em clareza, prática e evolução real de estudos.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default LandingCommercialClient;
