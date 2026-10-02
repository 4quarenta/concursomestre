import Image from 'next/image';
import Link from 'next/link';
import type { Metadata } from 'next';
import { ArrowRight, Check, CreditCard, LockKeyhole, ShieldCheck, Zap } from 'lucide-react';
import type { Plan } from '@types';
import {
  getCanonicalPlanName,
  isPlanEnabledByName,
  resolvePlanAutoCouponsById,
  resolvePlanOffer,
} from '@services/plans';
import { fetchPublicMarketingSettings } from '../publicMarketingSettings';
import { fetchPublicPlanCatalogForServer } from '../planos/plansServerData';
import EliteLandingSections from './EliteLandingSections';
import EliteSalesSections from './EliteSalesSections';
import ElitePlanComparison from './ElitePlanComparison';
import Footer from '@/components/shared/layout/Footer';

export const revalidate = 300;

export const metadata: Metadata = {
  title: 'Plano Elite para concursos',
  description: 'Conheça o plano anual Elite do ConcursoMestre: pratique questões, faça simulados e acompanhe sua preparação para concursos.',
  alternates: { canonical: '/elite' },
  openGraph: {
    title: 'Plano Elite para concursos | ConcursoMestre',
    description: 'Pratique questões, faça simulados e acompanhe sua preparação para concursos com o plano anual Elite do ConcursoMestre.',
    url: '/elite',
    type: 'website',
  },
};

type SearchParams = Record<string, string | string[] | undefined>;
type EliteLandingProps = { searchParams?: Promise<SearchParams> };

const formatCurrency = (value: number) => new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
}).format(value);

const getCanonicalName = (plan: Plan) => String(plan.canonical_name || plan.name || '').trim().toLocaleLowerCase('pt-BR');
const isElite = (plan: Plan) => getCanonicalName(plan) === 'elite' || getCanonicalName(plan).startsWith('elite ');
const isActive = (plan: Plan) => plan.is_active !== false;

const findElitePlan = (
  plans: Plan[],
  unit: Plan['interval_unit'],
  planDetails?: Parameters<typeof isPlanEnabledByName>[1],
) => plans.find((plan) => (
  isElite(plan)
  && isActive(plan)
  && isPlanEnabledByName(plan.name, planDetails)
  && plan.interval_unit === unit
  && Number(plan.price) > 0
));

const makeCheckoutHref = (planId: number, params: SearchParams) => {
  const allowedKeys = /^(utm_source|utm_medium|utm_campaign|utm_content|utm_term|gclid|fbclid|ttclid)$/i;
  const query = new URLSearchParams();
  for (const [key, rawValue] of Object.entries(params)) {
    if (!allowedKeys.test(key)) continue;
    const value = Array.isArray(rawValue) ? rawValue[0] : rawValue;
    if (value) query.set(key, value.slice(0, 500));
  }
  const suffix = query.toString();
  return `/checkout/${planId}${suffix ? `?${suffix}` : ''}`;
};

const benefits = [
  'Questões ilimitadas e análise detalhada',
  'Cronograma de estudos personalizado',
  'Simulados exclusivos',
  'Raio-X completo da banca',
  'Suporte prioritário e acesso antecipado',
];

export default async function EliteLandingPage({ searchParams }: EliteLandingProps) {
  const [plans, query, marketingSettings] = await Promise.all([
    fetchPublicPlanCatalogForServer(),
    searchParams ? searchParams : Promise.resolve({}),
    fetchPublicMarketingSettings(),
  ]);
  const pricing = marketingSettings.settings?.pricing;
  const planDetails = marketingSettings.settings?.planDetails;
  const annualPlan = findElitePlan(plans, 'year', planDetails);
  const monthlyPlan = findElitePlan(plans, 'month', planDetails);
  const annualOffer = annualPlan ? resolvePlanOffer({ plan: annualPlan, pricing, planDetails }) : null;
  const monthlyOffer = monthlyPlan ? resolvePlanOffer({ plan: monthlyPlan, pricing, planDetails }) : null;
  const annualPrice = annualOffer?.discountedCycleAmount ?? null;
  const monthlyPrice = monthlyOffer?.discountedMonthlyAmount ?? (monthlyPlan ? Number(monthlyPlan.price) : null);
  const monthlyEquivalent = annualOffer?.discountedMonthlyAmount ?? null;
  const regularAnnualPrice = annualOffer?.originalCycleAmount ?? null;
  const discountPercent = annualOffer?.effectiveDiscountPercent ?? null;
  const annualCheckoutHref = annualPlan ? makeCheckoutHref(annualPlan.id, query) : '/plans';
  const savings = regularAnnualPrice !== null && annualPrice !== null && regularAnnualPrice > annualPrice
    ? regularAnnualPrice - annualPrice
    : null;
  const activePlans = plans
    .filter((plan) => isActive(plan) && isPlanEnabledByName(plan.name, planDetails))
    .sort((left, right) => {
      const order: Record<string, number> = { Gratuito: 0, Essencial: 1, Pro: 2, Elite: 3 };
      const leftName = getCanonicalPlanName(left.name);
      const rightName = getCanonicalPlanName(right.name);
      const nameOrder = (order[leftName] ?? 99) - (order[rightName] ?? 99);
      if (nameOrder !== 0) return nameOrder;
      const leftCycles = left.interval_unit === 'year' ? 12 : Number(left.interval_count || 1);
      const rightCycles = right.interval_unit === 'year' ? 12 : Number(right.interval_count || 1);
      return leftCycles - rightCycles;
    });
  const autoCouponsByPlanId = resolvePlanAutoCouponsById(activePlans, marketingSettings.settings?.coupons || []);
  const offerCards = activePlans.map((plan) => {
    const offer = resolvePlanOffer({
      plan,
      pricing,
      planDetails,
      discountAmount: autoCouponsByPlanId[plan.id]?.discountAmount || 0,
    });
    const isFree = Number(plan.price || 0) <= 0;
    const cycleCount = Math.max(1, Number(offer.cycleCount || 1));
    const intervalPeriod = {
      day: 'dias',
      week: 'semanas',
      month: 'meses',
      year: 'anos',
    }[plan.interval_unit];
    const cycleName = isFree
      ? offer.displayName
      : plan.interval_unit === 'year'
        ? 'Anual'
        : plan.interval_unit === 'month' && cycleCount === 3
          ? 'Trimestral'
          : plan.interval_unit === 'month' && cycleCount === 1
            ? 'Mensal'
            : `A cada ${cycleCount} ${intervalPeriod}`;
    const cycleLabel = isFree
      ? 'sem cobrança'
      : plan.interval_unit === 'year'
        ? 'no ciclo anual'
        : plan.interval_unit === 'month' && cycleCount === 1
          ? 'por mês'
          : `a cada ${cycleCount} ${intervalPeriod}`;
    const savingsAmount = Math.max(0, Math.round((offer.originalCycleAmount - offer.discountedCycleAmount) * 100) / 100);
    const isRecommended = getCanonicalPlanName(plan.name) === 'Elite' && plan.interval_unit === 'year';

    return {
      planId: plan.id,
      planName: offer.displayName,
      cycleName,
      monthlyAmount: isFree ? 0 : offer.discountedMonthlyAmount,
      cycleAmount: offer.discountedCycleAmount,
      cycleLabel,
      isFree,
      isRecommended,
      discountPercent: offer.effectiveDiscountPercent,
      savingsAmount,
      checkoutHref: isFree ? '/auth?mode=signup' : makeCheckoutHref(plan.id, query),
    };
  });
  const socialLinks = (marketingSettings.settings?.landingPageContent?.socialLinks || [])
    .filter((link) => link.enabled && /^https?:\/\//i.test(link.url));

  return (
    <div className="min-h-screen overflow-hidden bg-[#070d19] text-slate-50">
      <header className="flex h-[76px] items-center justify-center border-b border-white/[0.08] bg-[#070d19]/90 px-5">
        <Link href="/" aria-label="ConcursoMestre — início" className="rounded focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-blue-300">
          <Image
            src="/branding/logo-full-light.png"
            alt="ConcursoMestre"
            width={600}
            height={132}
            priority
            className="h-auto w-[190px] sm:w-[220px]"
          />
        </Link>
      </header>

      <main className="relative isolate mx-auto grid min-h-[calc(100svh-76px)] max-w-[1180px] items-center gap-8 px-5 py-9 sm:px-7 sm:py-12 lg:grid-cols-[minmax(0,1.04fr)_minmax(390px,.96fr)] lg:gap-10 lg:px-9 lg:py-14">
        <div aria-hidden="true" className="pointer-events-none absolute -right-40 top-16 -z-10 h-[400px] w-[540px] rounded-full bg-blue-700/15 blur-[110px]" />
        <section aria-labelledby="elite-title" className="mx-auto w-full max-w-[590px] lg:mx-0">
          <p className="inline-flex items-center gap-2 text-[10px] font-extrabold uppercase tracking-[.14em] text-blue-100 sm:text-[11px]">
            <span aria-hidden="true" className="h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_16px_rgba(52,211,153,.8)]" />
            Plano Elite · preparação completa
          </p>
          <h1 id="elite-title" className="mt-4 max-w-[620px] text-[clamp(1.9rem,3.3vw,2.65rem)] font-black leading-[1.06] tracking-[-.05em]">
            Acesso completo, <span className="text-blue-300">pelo preço de um lanche.</span>
          </h1>
          <p className="mt-4 max-w-[540px] text-sm leading-6 text-slate-300 sm:text-base sm:leading-7">
            Tenha acesso a questões, simulados, análise de bancas e recursos para acompanhar sua preparação, com cobrança mensal no cartão.
          </p>

          <ul className="mt-5 grid gap-2.5">
            {[
              'Questões ilimitadas, comentários e análise detalhada.',
              'Cronograma de estudos personalizado.',
              'Simulados exclusivos e Raio-X para conhecer melhor cada banca.',
            ].map((item) => (
              <li key={item} className="flex items-start gap-2.5 text-[13px] font-medium leading-5 text-slate-200 sm:text-sm">
                <Check aria-hidden="true" size={17} className="mt-0.5 shrink-0 text-emerald-400" strokeWidth={3} />
                <span>{item}</span>
              </li>
            ))}
          </ul>

          <div className="mt-6 flex flex-wrap items-center gap-x-4 gap-y-3">
            <a href="#oferta-elite" className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-slate-100 px-5 py-2.5 text-[13px] font-extrabold text-slate-950 shadow-[0_10px_35px_rgba(79,139,235,.18)] transition hover:bg-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-blue-300">
              Quero estudar com o Elite <ArrowRight aria-hidden="true" size={16} />
            </a>
            <p className="inline-flex items-center gap-2 text-[13px] font-medium text-slate-300">
              <ShieldCheck aria-hidden="true" size={17} className="text-emerald-400" />
              Garantia de 7 dias
            </p>
          </div>
        </section>

        <aside id="oferta-elite" aria-labelledby="elite-offer-title" className="mx-auto w-full max-w-[520px] scroll-mt-6 rounded-[20px] border border-blue-100/15 bg-gradient-to-br from-[#152238] to-[#0c1524] p-4 shadow-[0_24px_70px_rgba(0,0,0,.38)] sm:p-6 lg:mx-0">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 id="elite-offer-title" className="text-[11px] font-extrabold uppercase tracking-[.13em] text-blue-50">Elite · anual</h2>
            <span className="rounded-full border border-emerald-300/20 bg-emerald-400/10 px-2.5 py-1 text-[9px] font-extrabold uppercase tracking-[.09em] text-emerald-200">Melhor custo-benefício</span>
          </div>

          {annualPlan && annualPrice !== null && monthlyEquivalent !== null ? (
            <>
              <div className="mt-4 flex flex-wrap items-center gap-2 text-xs text-slate-400">
                {monthlyPrice !== null ? <span><span className="sr-only">Preço mensal:</span><s>{formatCurrency(monthlyPrice)}/mês no plano mensal</s></span> : null}
                {discountPercent !== null ? <span className="rounded-full bg-emerald-400/15 px-2.5 py-1 text-xs font-extrabold text-emerald-300">{discountPercent}% de economia</span> : null}
              </div>
              <div className="mt-2 flex items-baseline gap-1.5">
                <span className="text-lg font-bold">R$</span>
                <span className="text-[clamp(3rem,5.8vw,4rem)] font-black leading-none tracking-[-.065em]">{monthlyEquivalent.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                <span className="text-sm text-slate-300">/mês</span>
              </div>
              <p className="mt-1.5 text-[13px] text-slate-300">No plano anual do Elite</p>
              <p className="mt-1 text-[11px] text-slate-400">Equivalente a <strong className="font-bold text-slate-200">{formatCurrency(monthlyEquivalent)}/mês</strong> em até 12 cobranças · total de {formatCurrency(annualPrice)} no período anual</p>
              <p className="mt-2 flex items-start gap-2 text-[11px] leading-4 text-slate-300"><CreditCard aria-hidden="true" size={14} className="mt-0.5 shrink-0 text-emerald-400" />No cartão, o pagamento acontece mês a mês: apenas a parcela do mês é lançada, sem cobrar o total anual de uma vez.</p>
              {savings !== null ? <p className="mt-4 rounded-lg border border-emerald-300/20 bg-emerald-400/[.07] px-3 py-2.5 text-center text-[11px] font-bold leading-4 text-emerald-300">Economize {formatCurrency(savings)} em relação a 12 mensalidades</p> : null}
              <Link href={annualCheckoutHref} className="mt-3 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-blue-500 px-4 py-3 text-center text-[13px] font-extrabold text-white shadow-[0_8px_28px_rgba(53,117,221,.22)] transition hover:bg-blue-400 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-blue-200">
                Assinar o Elite anual <ArrowRight aria-hidden="true" size={17} />
              </Link>
            </>
          ) : (
            <div className="mt-6 rounded-xl border border-amber-300/20 bg-amber-300/[.06] p-4">
              <p className="text-sm font-semibold text-amber-100">Consulte as condições atuais do plano Elite.</p>
              <Link href="/plans" className="mt-3 inline-flex items-center gap-2 text-sm font-bold text-blue-200 hover:text-white">Ver planos <ArrowRight size={15} /></Link>
            </div>
          )}

          <div className="my-4 h-px bg-white/10" />
          <p className="mb-3 text-[10px] font-extrabold uppercase tracking-[.13em] text-slate-400">Recursos do plano Elite</p>
          <ul className="grid gap-x-3 gap-y-2.5 sm:grid-cols-2">
            {benefits.map((benefit) => (
              <li key={benefit} className="flex items-start gap-2 text-[11px] leading-[18px] text-slate-200">
                <Check aria-hidden="true" size={14} className="mt-0.5 shrink-0 text-emerald-400" strokeWidth={3} />
                <span>{benefit}</span>
              </li>
            ))}
          </ul>
          <div className="my-4 h-px bg-white/10" />
          <ul className="grid gap-2 text-[11px] text-slate-300">
            <li className="flex items-center gap-2"><ShieldCheck aria-hidden="true" size={14} className="text-emerald-400" /> Garantia de 7 dias</li>
            <li className="flex items-center gap-2"><Zap aria-hidden="true" size={14} className="text-emerald-400" /> Acesso após confirmação do pagamento</li>
            <li className="flex items-center gap-2"><LockKeyhole aria-hidden="true" size={14} className="text-emerald-400" /> Pagamento processado com segurança</li>
          </ul>
        </aside>
      </main>
      <EliteLandingSections checkoutHref={annualCheckoutHref} monthlyPrice={monthlyEquivalent} annualPrice={annualPrice} />
      <ElitePlanComparison settings={marketingSettings.settings ?? undefined} />
      <EliteSalesSections offers={offerCards} socialLinks={socialLinks} />
      <div className="dark bg-[#070d19] px-5">
        <Footer />
      </div>
    </div>
  );
}
