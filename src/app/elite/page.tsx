import Image from 'next/image';
import Link from 'next/link';
import type { Metadata } from 'next';
import { ArrowRight, Check, LockKeyhole, ShieldCheck, Sparkles, Zap } from 'lucide-react';
import type { Plan } from '@types';
import { fetchPublicPlanCatalogForServer } from '../planos/plansServerData';

export const revalidate = 300;

export const metadata: Metadata = {
  title: 'Plano Elite para concursos',
  description: 'Estude com questões, análise detalhada, Chat Mentor e cronograma inteligente. Conheça o plano anual Elite.',
  alternates: { canonical: '/elite' },
  openGraph: {
    title: 'Plano Elite para concursos | ConcursoMestre',
    description: 'Pratique com foco, acompanhe sua evolução e prepare-se para sua próxima prova com o Elite.',
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

const findElitePlan = (plans: Plan[], unit: Plan['interval_unit']) => plans.find((plan) => (
  isElite(plan) && isActive(plan) && plan.interval_unit === unit && Number(plan.price) > 0
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
  'Chat Mentor ilimitado',
  'Cronograma de estudos com IA',
  'Simulados exclusivos',
  'Raio-X completo da banca',
  'Suporte prioritário e acesso antecipado',
];

export default async function EliteLandingPage({ searchParams }: EliteLandingProps) {
  const [plans, query] = await Promise.all([
    fetchPublicPlanCatalogForServer(),
    searchParams ? searchParams : Promise.resolve({}),
  ]);
  const annualPlan = findElitePlan(plans, 'year');
  const monthlyPlan = findElitePlan(plans, 'month');
  const annualPrice = annualPlan ? Number(annualPlan.price) : null;
  const monthlyPrice = monthlyPlan ? Number(monthlyPlan.price) : null;
  const monthlyEquivalent = annualPrice !== null ? annualPrice / 12 : null;
  const regularAnnualPrice = monthlyPrice !== null ? monthlyPrice * 12 : null;
  const discountPercent = annualPrice !== null && regularAnnualPrice !== null && regularAnnualPrice > annualPrice
    ? Math.round((1 - annualPrice / regularAnnualPrice) * 100)
    : null;
  const annualCheckoutHref = annualPlan ? makeCheckoutHref(annualPlan.id, query) : '/plans';
  const savings = regularAnnualPrice !== null && annualPrice !== null && regularAnnualPrice > annualPrice
    ? regularAnnualPrice - annualPrice
    : null;

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

      <main className="relative isolate mx-auto grid min-h-[calc(100svh-76px)] max-w-[1320px] items-center gap-10 px-5 py-12 sm:px-8 sm:py-16 lg:grid-cols-[minmax(0,1.04fr)_minmax(420px,.96fr)] lg:gap-14 lg:px-10 lg:py-20">
        <div aria-hidden="true" className="pointer-events-none absolute -right-40 top-16 -z-10 h-[440px] w-[600px] rounded-full bg-blue-700/15 blur-[110px]" />
        <section aria-labelledby="elite-title" className="mx-auto w-full max-w-[650px] lg:mx-0">
          <p className="inline-flex items-center gap-2.5 text-[11px] font-extrabold uppercase tracking-[.16em] text-blue-100 sm:text-xs">
            <span aria-hidden="true" className="h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_16px_rgba(52,211,153,.8)]" />
            Plano Elite · preparação completa
          </p>
          <h1 id="elite-title" className="mt-5 max-w-[680px] text-[clamp(2.65rem,5.1vw,4.45rem)] font-black leading-[1.035] tracking-[-.055em]">
            Treine com foco. <span className="text-blue-300">Estude com estratégia.</span>
          </h1>
          <p className="mt-5 max-w-[590px] text-base leading-7 text-slate-300 sm:text-lg sm:leading-8">
            Pratique com questões, entenda seus erros e acompanhe sua evolução com as ferramentas avançadas do Elite.
          </p>

          <ul className="mt-7 grid gap-3.5">
            {[
              'Questões ilimitadas, comentários e análise detalhada.',
              'Chat Mentor e cronograma de estudos com inteligência artificial.',
              'Simulados exclusivos e Raio-X para conhecer melhor cada banca.',
            ].map((item) => (
              <li key={item} className="flex items-start gap-3 text-sm font-medium leading-6 text-slate-200 sm:text-[15px]">
                <Check aria-hidden="true" size={19} className="mt-0.5 shrink-0 text-emerald-400" strokeWidth={3} />
                <span>{item}</span>
              </li>
            ))}
          </ul>

          <div className="mt-8 flex flex-wrap items-center gap-x-5 gap-y-4">
            <a href="#oferta-elite" className="inline-flex min-h-12 items-center justify-center gap-2.5 rounded-xl bg-slate-100 px-6 py-3 text-sm font-extrabold text-slate-950 shadow-[0_10px_35px_rgba(79,139,235,.18)] transition hover:bg-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-blue-300">
              Quero estudar com o Elite <ArrowRight aria-hidden="true" size={17} />
            </a>
            <p className="inline-flex items-center gap-2 text-sm font-medium text-slate-300">
              <ShieldCheck aria-hidden="true" size={18} className="text-emerald-400" />
              Garantia de 7 dias
            </p>
          </div>
        </section>

        <aside id="oferta-elite" aria-labelledby="elite-offer-title" className="mx-auto w-full max-w-[590px] scroll-mt-6 rounded-[22px] border border-blue-100/15 bg-gradient-to-br from-[#152238] to-[#0c1524] p-5 shadow-[0_28px_85px_rgba(0,0,0,.38)] sm:p-7 lg:mx-0">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 id="elite-offer-title" className="text-xs font-extrabold uppercase tracking-[.13em] text-blue-50">Elite · anual</h2>
            <span className="rounded-full border border-emerald-300/20 bg-emerald-400/10 px-3 py-1.5 text-[9px] font-extrabold uppercase tracking-[.09em] text-emerald-200 sm:text-[10px]">Melhor custo-benefício</span>
          </div>

          {annualPlan && annualPrice !== null && monthlyEquivalent !== null ? (
            <>
              <div className="mt-6 flex flex-wrap items-center gap-2.5 text-sm text-slate-400">
                {monthlyPrice !== null ? <span><span className="sr-only">Preço mensal:</span><s>{formatCurrency(monthlyPrice)}/mês no plano mensal</s></span> : null}
                {discountPercent !== null ? <span className="rounded-full bg-emerald-400/15 px-2.5 py-1 text-xs font-extrabold text-emerald-300">{discountPercent}% de economia</span> : null}
              </div>
              <div className="mt-3 flex items-baseline gap-2">
                <span className="text-xl font-bold">R$</span>
                <span className="text-[clamp(3.6rem,7vw,5rem)] font-black leading-none tracking-[-.065em]">{monthlyEquivalent.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                <span className="text-base text-slate-300">/mês</span>
              </div>
              <p className="mt-2 text-sm text-slate-300">No plano anual do Elite</p>
              <p className="mt-1 text-xs text-slate-400">Total de <strong className="font-bold text-slate-200">{formatCurrency(annualPrice)} por ano</strong> · cobrança anual</p>
              {savings !== null ? <p className="mt-5 rounded-lg border border-emerald-300/20 bg-emerald-400/[.07] px-3.5 py-3 text-center text-xs font-bold leading-5 text-emerald-300">Economize {formatCurrency(savings)} em relação a 12 mensalidades</p> : null}
              <Link href={annualCheckoutHref} className="mt-3 inline-flex min-h-14 w-full items-center justify-center gap-2.5 rounded-xl bg-blue-500 px-5 py-4 text-center text-sm font-extrabold text-white shadow-[0_8px_28px_rgba(53,117,221,.22)] transition hover:bg-blue-400 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-blue-200">
                Assinar o Elite anual <ArrowRight aria-hidden="true" size={18} />
              </Link>
            </>
          ) : (
            <div className="mt-6 rounded-xl border border-amber-300/20 bg-amber-300/[.06] p-4">
              <p className="text-sm font-semibold text-amber-100">Consulte as condições atuais do plano Elite.</p>
              <Link href="/plans" className="mt-3 inline-flex items-center gap-2 text-sm font-bold text-blue-200 hover:text-white">Ver planos <ArrowRight size={15} /></Link>
            </div>
          )}

          <div className="my-5 h-px bg-white/10" />
          <p className="mb-4 text-[10px] font-extrabold uppercase tracking-[.13em] text-slate-400">Tudo do Pro, mais recursos avançados</p>
          <ul className="grid gap-x-4 gap-y-3 sm:grid-cols-2">
            {benefits.map((benefit) => (
              <li key={benefit} className="flex items-start gap-2.5 text-xs leading-5 text-slate-200">
                <Sparkles aria-hidden="true" size={14} className="mt-0.5 shrink-0 text-blue-300" />
                <span>{benefit}</span>
              </li>
            ))}
          </ul>
          <div className="my-5 h-px bg-white/10" />
          <ul className="grid gap-2.5 text-xs text-slate-300">
            <li className="flex items-center gap-2.5"><ShieldCheck aria-hidden="true" size={15} className="text-blue-300" /> Garantia de 7 dias</li>
            <li className="flex items-center gap-2.5"><Zap aria-hidden="true" size={15} className="text-blue-300" /> Acesso após confirmação do pagamento</li>
            <li className="flex items-center gap-2.5"><LockKeyhole aria-hidden="true" size={15} className="text-blue-300" /> Pagamento processado com segurança</li>
          </ul>
        </aside>
      </main>
    </div>
  );
}
