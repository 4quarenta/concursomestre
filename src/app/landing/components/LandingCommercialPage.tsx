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
import Link from 'next/link';
import {
  BarChart3,
  BookOpenCheck,
  CalendarDays,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  FileText,
  GraduationCap,
  Instagram,
  Landmark,
  Menu,
  Repeat2,
  Scale,
  Send,
  ShieldCheck,
  Smartphone,
  Star,
  Target,
  X,
  Youtube,
  Zap,
} from 'lucide-react';
import type { Plan } from '@types';
import { getAssetUrl } from '@services/api';
import { homeTestimonialsService, resolveHomeTestimonials, type HomeTestimonial } from '@services/marketing/homeTestimonials';
import {
  getCanonicalPlanName,
  getConfiguredPlanDisplayName,
  isPlanEnabledByName,
  planService,
  resolvePlanAutoCouponsById,
  resolvePlanDiscountBadgesByCycle,
  resolvePlanOffer,
} from '@services/plans';
import { BILLING_CYCLE_OPTIONS, PLAN_COPY_BY_TIER, type LandingBillingCycle } from '../homepageContent';
import PublicBrandLink from '../../../components/shared/layout/PublicBrandLink';
import { useAppConfigStore } from '@/state/app-config/appConfigStore';

const NAV_ITEMS = [
  { label: 'Recursos', href: '#recursos' },
  { label: 'Planos', href: '#planos' },
  { label: 'Depoimentos', href: '#depoimentos' },
  { label: 'Blog', href: '#blog' },
];

const HERO_BULLETS = [
  'Estude com foco no que realmente cai',
  'Acompanhe sua evolução de verdade',
  'Tenha um plano personalizado para você',
];

const FEATURES = [
  {
    title: 'Concursos realizados',
    text: 'Pratique por provas anteriores e entenda como cada banca costuma cobrar.',
    icon: ClipboardList,
  },
  {
    title: 'Plano de estudos',
    text: 'Plano personalizado de acordo com seu tempo, edital e objetivo.',
    icon: BookOpenCheck,
  },
  {
    title: 'Raio-X da banca',
    text: 'Veja assuntos mais cobrados, perfil da banca e prioridades de estudo.',
    icon: Zap,
  },
  {
    title: 'Simulados',
    text: 'Simulados inéditos com correção automática e rankings.',
    icon: Target,
  },
  {
    title: 'Revisões',
    text: 'Revise o que importa com resumos e questões por assunto.',
    icon: Repeat2,
  },
  {
    title: 'Desempenho',
    text: 'Acompanhe sua evolução com gráficos claros e objetivos.',
    icon: BarChart3,
  },
  {
    title: 'Lei comentada',
    text: 'Estude a legislação com comentários objetivos e contexto para concursos.',
    icon: FileText,
  },
  {
    title: 'Cronograma Elite',
    text: 'Monte sua rotina semanal com metas, revisões e blocos de questões.',
    icon: CalendarDays,
  },
];

const PROCESS_STEPS = [
  {
    title: 'Diagnóstico inicial',
    text: 'Entenda seu nível antes de decidir o próximo estudo.',
  },
  {
    title: 'Prioridade por edital',
    text: 'Veja o que merece mais atenção na sua prova.',
  },
  {
    title: 'Treino direcionado',
    text: 'Resolva questões ligadas aos seus pontos fracos.',
  },
  {
    title: 'Revisão inteligente',
    text: 'Volte nos erros certos antes que eles virem padrão.',
  },
  {
    title: 'Decisão com dados',
    text: 'Ajuste sua rotina com base na sua evolução real.',
  },
];

const APPROVAL_CONTEXTS = [
  {
    title: 'Concursos públicos',
    text: 'Edital, banca e histórico de cobrança importam. O estudo precisa priorizar o que mais aparece e medir acertos por matéria.',
    icon: Landmark,
  },
  {
    title: 'ENEM',
    text: 'A prova exige consistência, interpretação e treino por área. Simulados e revisão dos erros ajudam a ganhar ritmo sem estudar no escuro.',
    icon: GraduationCap,
  },
  {
    title: 'OAB',
    text: 'Na primeira fase, lei comentada e questões por assunto encurtam o caminho entre leitura, entendimento e aplicação prática.',
    icon: Scale,
  },
];

const PLAN_ORDER_INDEX: Record<string, number> = { Gratuito: 0, Essencial: 1, Pro: 2, Elite: 3 };

const formatCurrency = (value: number) => `R$ ${Number(value || 0).toLocaleString('pt-BR', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})}`;

const isPlanInCycle = (plan: Plan, cycle: LandingBillingCycle) => {
  const intervalUnit = String(plan.interval_unit || '').toLowerCase();
  const intervalCount = Number(plan.interval_count || 1);
  const isMonthly = intervalUnit === 'month' && intervalCount === 1;
  const isQuarterly = intervalUnit === 'month' && intervalCount === 3;
  const isAnnual = intervalUnit === 'year' || (intervalUnit === 'month' && intervalCount === 12);
  const isCustomShortCycle = intervalUnit === 'day' || intervalUnit === 'week';

  if (Number(plan.price || 0) === 0) return true;
  if (cycle === 'monthly') return isMonthly || isCustomShortCycle;
  if (cycle === 'quarterly') return isQuarterly;
  return isAnnual;
};

const getPlanTotalLabel = (plan: Plan) => {
  if (Number(plan.price || 0) === 0) return 'Sem cobrança';
  if (plan.interval_unit === 'year') return `${formatCurrency(Number(plan.price || 0))} por ano`;
  if (plan.interval_unit === 'month' && Number(plan.interval_count || 1) === 3) return `${formatCurrency(Number(plan.price || 0))} a cada 3 meses`;
  return `${formatCurrency(Number(plan.price || 0))} por mês`;
};

type PlanFeatureSource = {
  included?: boolean;
  text?: string | null;
};

const getConfiguredPlanFeatureItems = (
  plan: Plan,
  configuredPlanDetails?: Partial<Record<string, { features?: PlanFeatureSource[] }>> | null,
) => {
  const canonicalPlan = getCanonicalPlanName(plan.name);
  const configuredFeatures = configuredPlanDetails?.[canonicalPlan]?.features;
  const sourceFeatures = Array.isArray(configuredFeatures) && configuredFeatures.length > 0
    ? configuredFeatures
    : Array.isArray(plan.features)
      ? plan.features
      : [];

  return sourceFeatures
    .map((feature) => ({
      included: Boolean(feature?.included),
      text: String(feature?.text || '').trim(),
    }))
    .filter((feature: { text: string }) => feature.text)
    .slice(0, 6);
};

const FINAL_BENEFITS = [
  { label: 'Sem cartão de crédito', icon: ShieldCheck },
  { label: 'Cancele quando quiser', icon: CheckCircle2 },
  { label: 'Comece em menos de 1 minuto', icon: Smartphone },
];

const FAQ_ITEMS = [
  {
    question: 'Posso começar sem pagar?',
    answer: 'Sim. O plano gratuito permite explorar a plataforma, resolver questões e entender se o método faz sentido para sua rotina.',
  },
  {
    question: 'Preciso cadastrar cartão?',
    answer: 'Não. Para criar a conta gratuita, você não precisa informar cartão de crédito.',
  },
  {
    question: 'Os planos trimestral e anual têm desconto?',
    answer: 'Quando houver desconto ativo no catálogo, ele aparece automaticamente na área de planos.',
  },
  {
    question: 'Serve para qualquer concurso?',
    answer: 'A plataforma funciona melhor para quem quer estudar por banca, provas anteriores, assuntos e desempenho real.',
  },
  {
    question: 'Posso cancelar depois?',
    answer: 'Sim. Você pode cancelar quando quiser pela sua conta, sem precisar falar com suporte para isso.',
  },
];

const FOOTER_COLUMNS = [
  {
    title: 'Navegação',
    links: [
      { label: 'Recursos', href: '#recursos' },
      { label: 'Planos', href: '#planos' },
      { label: 'Depoimentos', href: '#depoimentos' },
      { label: 'Blog', href: '#blog' },
    ],
  },
  {
    title: 'Suporte',
    links: [
      { label: 'Central de ajuda', href: '/support' },
      { label: 'Fale conosco', href: '/support' },
    ],
  },
  {
    title: 'Legal',
    links: [
      { label: 'Termos de uso', href: '/terms' },
      { label: 'Política de privacidade', href: '/privacy' },
    ],
  },
];

const SectionTitle = ({
  children,
  className = '',
}: {
  children: React.ReactNode;
  className?: string;
}) => (
  <h2 className={`text-center text-2xl font-black leading-tight tracking-tight text-[#07103a] md:text-3xl ${className}`}>
    {children}
  </h2>
);

export const Header = () => {
  const [isMenuOpen, setIsMenuOpen] = React.useState(false);

  return (
    <header className="sticky top-0 z-40 border-b border-slate-100/80 bg-white/90 backdrop-blur-xl">
      <div className="mx-auto flex h-20 w-full max-w-7xl items-center justify-between px-5 sm:px-8">
        <PublicBrandLink width={205} priority surface="light" />

        <nav className="hidden items-center gap-10 text-sm font-semibold text-[#1d284f] lg:flex" aria-label="Navegação principal">
          {NAV_ITEMS.map((item) => (
            <Link key={item.href} href={item.href} className="transition-colors hover:text-[#684cff]">
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="hidden items-center gap-5 lg:flex">
          <Link href="/auth?mode=login" className="text-sm font-bold text-[#07103a] transition-colors hover:text-[#684cff]">
            Entrar
          </Link>
          <Link href="/auth?mode=signup" className="rounded-xl bg-[#07103a] px-5 py-3 text-sm font-bold text-white shadow-sm transition hover:bg-[#111d52]">
            Começar grátis
          </Link>
        </div>

        <button
          type="button"
          className="inline-flex h-11 w-11 items-center justify-center rounded-xl border border-slate-200 text-[#07103a] lg:hidden"
          onClick={() => setIsMenuOpen((current) => !current)}
          aria-label={isMenuOpen ? 'Fechar menu' : 'Abrir menu'}
          aria-expanded={isMenuOpen}
        >
          {isMenuOpen ? <X size={20} /> : <Menu size={20} />}
        </button>
      </div>

      {isMenuOpen && (
        <div className="border-t border-slate-100 bg-white px-5 py-5 shadow-lg lg:hidden">
          <nav className="mx-auto flex max-w-7xl flex-col gap-4 text-sm font-bold text-[#07103a]" aria-label="Navegação mobile">
            {NAV_ITEMS.map((item) => (
              <Link key={item.href} href={item.href} onClick={() => setIsMenuOpen(false)}>
                {item.label}
              </Link>
            ))}
            <div className="mt-2 grid grid-cols-2 gap-3">
              <Link href="/auth?mode=login" className="rounded-xl border border-slate-200 px-4 py-3 text-center">
                Entrar
              </Link>
              <Link href="/auth?mode=signup" className="rounded-xl bg-[#07103a] px-4 py-3 text-center text-white">
                Começar grátis
              </Link>
            </div>
          </nav>
        </div>
      )}
    </header>
  );
};

const MetricCard = ({
  label,
  value,
  trend,
}: {
  label: string;
  value: string;
  trend: string;
}) => (
  <div className="rounded-xl border border-slate-100 bg-white p-4 shadow-sm">
    <p className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-400">{label}</p>
    <p className="mt-2 text-xl font-black text-[#07103a]">{value}</p>
    <p className="mt-1 text-[11px] font-bold text-emerald-600">{trend}</p>
  </div>
);

const PlatformMockup = () => (
  <div className="relative mx-auto w-full max-w-3xl">
    <div className="rounded-2xl border-[10px] border-slate-950 bg-slate-950 shadow-2xl shadow-indigo-100">
      <div className="rounded-[1.35rem] bg-white p-5">
        <div className="grid gap-5 md:grid-cols-[155px_1fr]">
          <aside className="hidden rounded-2xl bg-[#f6f7ff] p-4 md:block">
            <p className="text-xs font-black text-[#07103a]">Olá, Concurseiro</p>
            <div className="mt-5 space-y-3 text-[11px] font-bold text-slate-500">
              {['Início', 'Plano de estudos', 'Questões', 'Simulados', 'Revisões'].map((item, index) => (
                <div key={item} className={`flex items-center gap-2 rounded-lg px-2 py-2 ${index === 0 ? 'bg-white text-[#684cff] shadow-sm' : ''}`}>
                  <span className="h-2 w-2 rounded-full bg-[#7a5cff]" />
                  {item}
                </div>
              ))}
            </div>
          </aside>

          <div className="min-w-0">
            <p className="text-sm font-black text-[#07103a]">Seu desempenho</p>
            <div className="mt-4 grid gap-3 sm:grid-cols-3">
              <MetricCard label="Questões resolvidas" value="1.248" trend="+15% no mês" />
              <MetricCard label="Taxa de acerto" value="76%" trend="+4,8% de evolução" />
              <MetricCard label="Sequência" value="12 dias" trend="Parabéns" />
            </div>

            <div className="mt-4 grid gap-4 lg:grid-cols-[1fr_180px]">
              <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
                <p className="text-xs font-black text-[#07103a]">Evolução semanal</p>
                <svg viewBox="0 0 420 190" role="img" aria-label="Gráfico de evolução semanal" className="mt-4 h-40 w-full">
                  <defs>
                    <linearGradient id="mockupLineFill" x1="0" x2="0" y1="0" y2="1">
                      <stop offset="0%" stopColor="#7059ff" stopOpacity="0.16" />
                      <stop offset="100%" stopColor="#7059ff" stopOpacity="0" />
                    </linearGradient>
                  </defs>
                  <path d="M20 150 L70 92 L115 110 L160 64 L205 102 L250 72 L295 98 L340 69 L390 38 L390 174 L20 174 Z" fill="url(#mockupLineFill)" />
                  <path d="M20 150 L70 92 L115 110 L160 64 L205 102 L250 72 L295 98 L340 69 L390 38" fill="none" stroke="#6b55ff" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" />
                  {[20, 70, 115, 160, 205, 250, 295, 340, 390].map((x, index) => (
                    <circle key={x} cx={x} cy={[150, 92, 110, 64, 102, 72, 98, 69, 38][index]} r="5" fill="#6b55ff" />
                  ))}
                </svg>
              </div>

              <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
                <p className="text-xs font-black text-[#07103a]">Próximos estudos</p>
                <div className="mt-4 space-y-3">
                  {[
                    ['D. Administrativo', 'Aula 12'],
                    ['Português', 'Revisão'],
                    ['Raciocínio lógico', 'Questões'],
                  ].map(([title, label], index) => (
                    <div key={title} className="flex items-center gap-3">
                      <span className={`flex h-8 w-8 items-center justify-center rounded-lg text-xs font-black text-white ${index === 0 ? 'bg-rose-400' : index === 1 ? 'bg-teal-400' : 'bg-amber-400'}`}>
                        {index + 1}
                      </span>
                      <div>
                        <p className="text-[11px] font-black text-[#07103a]">{title}</p>
                        <p className="text-[10px] font-semibold text-slate-400">{label}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <div className="absolute -bottom-8 left-2 w-36 rounded-[1.6rem] border-[8px] border-slate-950 bg-slate-950 shadow-2xl shadow-slate-300 sm:left-0 sm:w-48 lg:-left-10 lg:bottom-2">
      <div className="rounded-[1rem] bg-white p-4">
        <div className="mx-auto mb-3 h-1.5 w-10 rounded-full bg-slate-950" />
        <p className="text-[11px] font-black text-[#07103a]">Plano de estudos</p>
        <div className="mt-4 space-y-3">
          {[
            ['Dir. Constitucional', 'Concluído', 'bg-emerald-400'],
            ['Português', 'Em andamento', 'bg-amber-400'],
            ['Raciocínio lógico', 'Pendente', 'bg-slate-300'],
          ].map(([title, label, color]) => (
            <div key={title}>
              <div className="flex items-center justify-between gap-2">
                <p className="truncate text-[10px] font-bold text-[#07103a]">{title}</p>
                <p className="text-[8px] font-black text-slate-400">{label}</p>
              </div>
              <div className="mt-1 h-1.5 rounded-full bg-slate-100">
                <div className={`h-full rounded-full ${color}`} style={{ width: label === 'Concluído' ? '100%' : label === 'Em andamento' ? '58%' : '24%' }} />
              </div>
            </div>
          ))}
        </div>
        <div className="mt-5 grid grid-cols-4 gap-2 text-center text-[8px] font-bold text-slate-400">
          {['Início', 'Questões', 'Estat.', 'Mais'].map((item) => <span key={item}>{item}</span>)}
        </div>
      </div>
    </div>
  </div>
);

export const HeroSection = () => (
  <section className="mx-auto grid w-full max-w-7xl items-center gap-12 px-5 pb-18 pt-14 sm:px-8 lg:grid-cols-[0.82fr_1.18fr] lg:pb-20 lg:pt-16">
    <div className="max-w-2xl">
      <h1 className="text-3xl font-black leading-[1.1] tracking-tight text-[#07103a] sm:text-4xl lg:text-5xl">
        Se você quer passar, <span className="text-[#684cff]">precisa estudar</span> com estratégia.
      </h1>
      <p className="mt-5 max-w-xl text-sm font-medium leading-6 text-slate-600 md:text-base md:leading-7">
        A plataforma completa para estudar com mais direção, menos promessa e mais resultado.
      </p>

      <div className="mt-7 space-y-3">
        {HERO_BULLETS.map((item) => (
          <div key={item} className="flex items-center gap-3 text-sm font-semibold text-[#1d284f]">
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[#edeaff] text-[#684cff]">
              <Check size={13} strokeWidth={3} />
            </span>
            {item}
          </div>
        ))}
      </div>

      <div className="mt-9 flex flex-col gap-4 sm:flex-row">
        <Link href="/auth?mode=signup" className="inline-flex h-12 items-center justify-center rounded-xl bg-[#07103a] px-7 text-sm font-bold text-white shadow-sm transition hover:bg-[#111d52]">
          Começar grátis
        </Link>
        <Link href="#planos" className="inline-flex h-12 items-center justify-center rounded-xl border border-slate-200 bg-white px-7 text-sm font-bold text-[#07103a] transition hover:border-[#684cff] hover:text-[#684cff]">
          Ver planos
        </Link>
      </div>
      <p className="mt-4 text-xs font-medium text-slate-500">Grátis para sempre. Sem cartão de crédito.</p>
    </div>

    <PlatformMockup />
  </section>
);

export const FeatureCard = ({
  title,
  text,
  icon: Icon,
}: {
  title: string;
  text: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
}) => (
  <article className="rounded-2xl border border-indigo-100 bg-white p-5 text-center shadow-sm transition hover:-translate-y-1 hover:border-[#8b78ff] hover:shadow-xl hover:shadow-indigo-100/60">
    <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-[#f0edff] text-[#684cff]">
      <Icon size={24} />
    </div>
    <h3 className="mt-5 text-sm font-black text-[#07103a]">{title}</h3>
    <p className="mt-3 text-sm font-medium leading-6 text-slate-600">{text}</p>
  </article>
);

const FeaturesSection = () => (
  <section id="recursos" className="mx-auto w-full max-w-7xl px-5 py-16 sm:px-8">
    <SectionTitle>Tudo que você precisa em um só lugar</SectionTitle>
    <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
      {FEATURES.map((feature) => (
        <FeatureCard key={feature.title} {...feature} />
      ))}
    </div>
  </section>
);

const ApprovalContextSection = () => (
  <section className="mx-auto w-full max-w-7xl px-5 py-12 sm:px-8">
    <div className="grid gap-8 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8 lg:grid-cols-[0.9fr_1.1fr] lg:items-center">
      <div>
        <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#684cff]">Aprovação com direção</p>
        <h2 className="mt-3 text-2xl font-black leading-tight tracking-tight text-[#07103a] md:text-3xl">
          Cada prova cobra de um jeito. Sua preparação também precisa mudar.
        </h2>
        <p className="mt-4 text-sm font-medium leading-6 text-slate-600">
          Concurso público, ENEM e OAB têm lógicas diferentes, mas uma coisa é comum: quem acompanha dados, revisa erros e treina com método sai na frente.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-1">
        {APPROVAL_CONTEXTS.map(({ title, text, icon: Icon }) => (
          <article key={title} className="rounded-2xl border border-indigo-100 bg-slate-50 p-4">
            <div className="flex items-start gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#edeaff] text-[#684cff]">
                <Icon size={18} />
              </span>
              <div>
                <h3 className="text-sm font-black text-[#07103a]">{title}</h3>
                <p className="mt-1 text-sm font-medium leading-6 text-slate-600">{text}</p>
              </div>
            </div>
          </article>
        ))}
      </div>
    </div>
  </section>
);

export const ProcessSection = () => (
  <section className="mx-auto w-full max-w-7xl px-5 py-16 sm:px-8">
    <SectionTitle>Estude menos no escuro, mais no que dá resultado</SectionTitle>
    <p className="mx-auto mt-4 max-w-2xl text-center text-sm font-medium leading-6 text-slate-500">
      A plataforma mostra onde você está perdendo ponto e transforma isso em prática, revisão e acompanhamento.
    </p>
    <div className="mt-12 grid gap-8 md:grid-cols-5">
      {PROCESS_STEPS.map((step, index) => (
        <article key={step.title} className="relative text-center">
          {index < PROCESS_STEPS.length - 1 && (
            <ChevronRight className="absolute -right-5 top-4 hidden text-slate-300 md:block" size={22} />
          )}
          <div className="mx-auto flex h-9 w-9 items-center justify-center rounded-full bg-[#684cff] text-sm font-black text-white shadow-lg shadow-indigo-200">
            {index + 1}
          </div>
          <h3 className="mt-5 text-sm font-black text-[#07103a]">{step.title}</h3>
          <p className="mt-3 text-sm font-medium leading-6 text-slate-500">{step.text}</p>
        </article>
      ))}
    </div>
  </section>
);

const getTestimonialInitials = (name: string) => {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const initials = parts.length > 1 ? `${parts[0][0]}${parts[1][0]}` : parts[0]?.slice(0, 2);
  return (initials || 'CM').toUpperCase();
};

const StarsRating = ({ rating = 5 }: { rating?: number }) => {
  const safeRating = Math.max(1, Math.min(5, Math.round(Number(rating) || 5)));

  return (
    <div className="flex items-center gap-1" aria-label={`Avaliação ${safeRating} de 5`}>
      {Array.from({ length: 5 }).map((_, index) => (
        <Star
          key={index}
          size={15}
          className={index < safeRating ? 'fill-amber-400 text-amber-400' : 'text-slate-200'}
        />
      ))}
    </div>
  );
};

export const TestimonialsSection = () => {
  const [activeSlide, setActiveSlide] = React.useState(0);
  const [approvedTestimonials, setApprovedTestimonials] = React.useState<HomeTestimonial[]>([]);
  const testimonialsPerSlide = 3;
  const testimonials = React.useMemo(() => resolveHomeTestimonials(approvedTestimonials), [approvedTestimonials]);
  const totalSlides = Math.max(1, Math.ceil(testimonials.length / testimonialsPerSlide));
  const currentSlide = Math.min(activeSlide, totalSlides - 1);
  const visibleTestimonials = React.useMemo(() => {
    const start = currentSlide * testimonialsPerSlide;
    return testimonials.slice(start, start + testimonialsPerSlide);
  }, [currentSlide, testimonials]);

  React.useEffect(() => {
    let isMounted = true;

    homeTestimonialsService.getApproved()
      .then((items) => {
        if (isMounted) setApprovedTestimonials(items);
      })
      .catch(() => {
        if (isMounted) setApprovedTestimonials([]);
      });

    return () => {
      isMounted = false;
    };
  }, []);

  const goToPrevious = () => setActiveSlide((current) => {
    const safeCurrent = Math.min(current, totalSlides - 1);
    return safeCurrent === 0 ? totalSlides - 1 : safeCurrent - 1;
  });
  const goToNext = () => setActiveSlide((current) => (Math.min(current, totalSlides - 1) + 1) % totalSlides);

  return (
    <section id="depoimentos" className="mx-auto w-full max-w-7xl px-5 py-16 sm:px-8">
      <div className="rounded-2xl bg-[#f3f1ff] p-6 sm:p-7 lg:p-8">
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div className="md:max-w-xl">
            <SectionTitle className="md:text-left">Quem usa, aprova</SectionTitle>
            <p className="mt-3 text-center text-sm font-medium leading-6 text-slate-600 md:text-left">
              Relatos curtos de quem usou dados, questões e revisão para estudar com mais direção.
            </p>
          </div>

          <div className="flex items-center justify-center gap-2 md:justify-end">
            <button
              type="button"
              onClick={goToPrevious}
              disabled={totalSlides <= 1}
              className="flex h-10 w-10 items-center justify-center rounded-xl border border-indigo-100 bg-white text-[#07103a] shadow-sm transition hover:border-[#684cff] hover:text-[#684cff] disabled:cursor-not-allowed disabled:opacity-50"
              aria-label="Depoimentos anteriores"
            >
              <ChevronLeft size={18} />
            </button>
            <button
              type="button"
              onClick={goToNext}
              disabled={totalSlides <= 1}
              className="flex h-10 w-10 items-center justify-center rounded-xl border border-indigo-100 bg-white text-[#07103a] shadow-sm transition hover:border-[#684cff] hover:text-[#684cff] disabled:cursor-not-allowed disabled:opacity-50"
              aria-label="Próximos depoimentos"
            >
              <ChevronRight size={18} />
            </button>
          </div>
        </div>

        <div className="mt-8 grid gap-5 lg:grid-cols-3">
          {visibleTestimonials.map((testimonial) => {
            const photoUrl = getAssetUrl(testimonial.photoUrl || '');

            return (
              <article key={testimonial.id} className="flex min-h-[260px] flex-col rounded-2xl border border-indigo-100 bg-white p-5 shadow-sm">
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    {photoUrl ? (
                      // Testimonial avatars can come from user uploads or Google accounts, so the host list is intentionally dynamic.
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={photoUrl}
                        alt={`Foto de ${testimonial.name}`}
                        className="h-12 w-12 rounded-full border border-indigo-100 object-cover"
                        loading="lazy"
                        referrerPolicy="no-referrer"
                      />
                    ) : (
                      <div className="flex h-12 w-12 items-center justify-center rounded-full border border-indigo-100 bg-[#f3f1ff] text-xs font-black uppercase tracking-wider text-[#684cff]">
                        {getTestimonialInitials(testimonial.name)}
                      </div>
                    )}
                    <div>
                      <p className="text-sm font-black text-[#07103a]">{testimonial.name}</p>
                      <p className="mt-1 text-xs font-semibold text-slate-500">{testimonial.role}</p>
                    </div>
                  </div>
                  <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.12em] text-emerald-700">
                    Verificado
                  </span>
                </div>

                <div className="mt-5">
                  <StarsRating rating={testimonial.rating} />
                </div>
                <p className="mt-5 flex-1 text-sm font-medium leading-7 text-[#1d284f]">{testimonial.text}</p>
              </article>
            );
          })}
        </div>

        <div className="mt-6 flex items-center justify-center gap-2">
          {Array.from({ length: totalSlides }).map((_, index) => (
            <button
              key={index}
              type="button"
              onClick={() => setActiveSlide(index)}
              className={`h-2.5 rounded-full transition-all ${currentSlide === index ? 'w-8 bg-[#684cff]' : 'w-2.5 bg-indigo-200'}`}
              aria-label={`Ir para grupo de depoimentos ${index + 1}`}
              aria-current={currentSlide === index}
            />
          ))}
        </div>
      </div>
    </section>
  );
};

export const PricingSection = () => {
  const systemSettings = useAppConfigStore((state) => state.systemSettings);
  const isSystemSettingsLoaded = useAppConfigStore((state) => state.isSystemSettingsLoaded);
  const [billingCycle, setBillingCycle] = React.useState<LandingBillingCycle>('annual');
  const [plans, setPlans] = React.useState<Plan[]>([]);
  const [plansLoaded, setPlansLoaded] = React.useState(false);

  React.useEffect(() => {
    let isMounted = true;

    planService.getPlans()
      .then((catalog) => {
        if (isMounted) setPlans(Array.isArray(catalog) ? catalog : []);
      })
      .finally(() => {
        if (isMounted) setPlansLoaded(true);
      });

    return () => {
      isMounted = false;
    };
  }, []);

  const planCatalog = React.useMemo(() => plans
    .filter((plan) => plan.is_active !== false)
    .filter((plan) => isPlanEnabledByName(plan.name, systemSettings.planDetails))
    .sort((left, right) => {
      const leftOrder = PLAN_ORDER_INDEX[getCanonicalPlanName(left.name)] ?? 99;
      const rightOrder = PLAN_ORDER_INDEX[getCanonicalPlanName(right.name)] ?? 99;
      return leftOrder === rightOrder ? Number(left.price || 0) - Number(right.price || 0) : leftOrder - rightOrder;
    }), [plans, systemSettings.planDetails]);

  const freePlan = React.useMemo(() => planCatalog.find((plan) => Number(plan.price || 0) === 0) || null, [planCatalog]);
  const visiblePlans = React.useMemo(() => {
    const cyclePlans = planCatalog.filter((plan) => isPlanInCycle(plan, billingCycle));
    const paidPlans = cyclePlans.filter((plan) => Number(plan.price || 0) > 0);
    return freePlan ? [freePlan, ...paidPlans] : paidPlans;
  }, [billingCycle, freePlan, planCatalog]);

  const featuredPlanId = React.useMemo(
    () => visiblePlans.find((plan) => getCanonicalPlanName(plan.name) === 'Pro')?.id
      ?? visiblePlans.find((plan) => Number(plan.price || 0) > 0)?.id
      ?? null,
    [visiblePlans],
  );

  const autoCouponsByPlanId = React.useMemo(
    () => resolvePlanAutoCouponsById(visiblePlans, systemSettings.coupons || []),
    [systemSettings.coupons, visiblePlans],
  );

  const planOffersById = React.useMemo(() => Object.fromEntries(visiblePlans.map((plan) => [
    plan.id,
    resolvePlanOffer({
      plan,
      pricing: systemSettings.pricing,
      planDetails: systemSettings.planDetails,
      discountAmount: autoCouponsByPlanId[plan.id]?.discountAmount || 0,
    }),
  ])), [autoCouponsByPlanId, systemSettings.planDetails, systemSettings.pricing, visiblePlans]);

  const discountBadgesByCycle = React.useMemo(() => (
    resolvePlanDiscountBadgesByCycle({
      plans: planCatalog,
      canonicalPlanName: planCatalog.some((plan) => getCanonicalPlanName(plan.name) === 'Elite') ? 'Elite' : 'Pro',
      coupons: systemSettings.coupons || [],
      pricing: systemSettings.pricing,
      planDetails: systemSettings.planDetails,
    })
  ), [planCatalog, systemSettings.coupons, systemSettings.planDetails, systemSettings.pricing]);

  return (
    <section id="planos" className="mx-auto w-full max-w-6xl px-5 py-16 sm:px-8">
      <SectionTitle>Escolha o plano ideal para você</SectionTitle>
      <p className="mt-4 text-center text-sm font-medium text-slate-500">Planos oficiais do catálogo, com ciclos e descontos aplicados automaticamente.</p>

      <div className="mt-8 flex justify-center">
        <div className="inline-flex flex-wrap items-center justify-center gap-1 rounded-2xl border border-slate-200 bg-slate-50 p-1">
          {BILLING_CYCLE_OPTIONS.map((option) => (
            <button
              key={option.key}
              type="button"
              onClick={() => setBillingCycle(option.key)}
              className={`inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-[10px] font-black uppercase tracking-[0.16em] transition-all ${
                billingCycle === option.key
                  ? 'bg-white text-[#07103a] shadow-sm'
                  : 'text-slate-500 hover:text-[#07103a]'
              }`}
            >
              {option.label}
              {discountBadgesByCycle[option.key] > 0 && (
                <span className="rounded-full bg-emerald-500/10 px-2 py-1 text-[9px] font-black text-emerald-600">
                  {discountBadgesByCycle[option.key]}% OFF
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {!plansLoaded || !isSystemSettingsLoaded ? (
        <div className="mt-10 rounded-2xl border border-indigo-100 bg-white p-10 text-center shadow-sm">
          <p className="text-sm font-bold text-slate-500">Carregando catálogo oficial de planos...</p>
        </div>
      ) : visiblePlans.length === 0 ? (
        <div className="mt-10 rounded-2xl border border-indigo-100 bg-white p-10 text-center shadow-sm">
          <p className="text-sm font-bold text-slate-500">Nenhum plano ativo encontrado para este ciclo.</p>
        </div>
      ) : (
        <div className="mt-10 grid justify-center gap-6 [grid-template-columns:repeat(auto-fit,minmax(280px,330px))]">
          {visiblePlans.map((plan) => {
            const canonicalName = getCanonicalPlanName(plan.name);
            const displayName = getConfiguredPlanDisplayName(plan.name, systemSettings.planDetails, plan.name);
            const planCopy = PLAN_COPY_BY_TIER[canonicalName] || PLAN_COPY_BY_TIER.Gratuito;
            const featureItems = getConfiguredPlanFeatureItems(plan, systemSettings.planDetails);
            const offer = planOffersById[plan.id];
            const isFeatured = plan.id === featuredPlanId;
            const showOffer = Boolean(offer?.hasDiscount && Number(plan.price || 0) > 0);
            const showCycleTotal = Boolean(Number(plan.price || 0) > 0 && offer?.cycleCount && offer.cycleCount > 1);
            const cycleSuffix = offer?.cycleLabel === 'ano'
              ? '/ano'
              : offer?.cycleLabel === 'cada 3 meses'
                ? '/cada 3 meses'
                : '/mês';
            const ctaHref = Number(plan.price || 0) === 0 ? '/auth?mode=signup' : `/checkout/${plan.id}`;
            const ctaLabel = Number(plan.price || 0) === 0 ? 'Começar grátis' : (planCopy.cta || `Assinar ${displayName}`);

            return (
              <article
                key={plan.id}
                className={`relative flex h-full flex-col rounded-2xl border bg-white p-6 shadow-sm transition ${
                  isFeatured ? 'border-[#684cff] shadow-indigo-100' : 'border-indigo-100'
                }`}
              >
                {isFeatured && (
                  <span className="absolute -top-4 left-1/2 -translate-x-1/2 rounded-full bg-[#684cff] px-4 py-1.5 text-xs font-black text-white">
                    Mais escolhido
                  </span>
                )}

                <div className="text-center">
                  <p className="text-[10px] font-black uppercase tracking-[0.16em] text-[#684cff]">{planCopy.eyebrow}</p>
                  <h3 className="mt-3 text-xl font-black text-[#07103a]">{displayName}</h3>
                  <p className="mt-2 min-h-10 text-sm font-medium leading-5 text-slate-500">{planCopy.description}</p>
                </div>

                <div className="mt-7 text-center">
                  {showOffer ? (
                    <>
                      <p className="text-xs font-bold uppercase tracking-[0.14em] text-slate-400 line-through">
                        De {formatCurrency(offer.originalMonthlyAmount)}/mês
                      </p>
                      <p className="mt-1 text-3xl font-black text-[#07103a]">
                        {formatCurrency(offer.discountedMonthlyAmount)}
                        <span className="ml-1 text-sm font-semibold text-slate-500">/mês</span>
                      </p>
                      <span className="mt-3 inline-flex rounded-full bg-emerald-500/10 px-3 py-1 text-[10px] font-black uppercase tracking-[0.14em] text-emerald-600">
                        {offer.effectiveDiscountPercent}% OFF
                      </span>
                    </>
                  ) : (
                    <p className="text-3xl font-black text-[#07103a]">
                      {Number(plan.price || 0) === 0 ? 'R$ 0' : formatCurrency(offer?.discountedMonthlyAmount || Number(plan.price || 0))}
                      <span className="ml-1 text-sm font-semibold text-slate-500">{Number(plan.price || 0) === 0 ? '/mês' : '/mês'}</span>
                    </p>
                  )}

                  <p className="mt-3 text-xs font-bold uppercase tracking-[0.14em] text-slate-500">
                    {showCycleTotal ? `${formatCurrency(offer.discountedCycleAmount)}${cycleSuffix}` : getPlanTotalLabel(plan)}
                  </p>
                </div>

                <ul className="mt-8 flex-1 space-y-4">
                  {featureItems.map((feature) => (
                    <li key={`${plan.id}-${feature.text}`} className={`flex gap-3 text-sm font-medium ${feature.included ? 'text-[#1d284f]' : 'text-slate-400'}`}>
                      <Check size={17} className={`mt-0.5 shrink-0 ${feature.included ? 'text-[#07103a]' : 'text-slate-300'}`} />
                      {feature.text}
                    </li>
                  ))}
                </ul>

                <Link
                  href={ctaHref}
                  className={`mt-8 inline-flex h-12 w-full items-center justify-center rounded-xl text-sm font-bold transition ${
                    isFeatured
                      ? 'bg-[#684cff] text-white shadow-lg shadow-indigo-200 hover:bg-[#563fe0]'
                      : 'border border-slate-200 text-[#07103a] hover:border-[#684cff] hover:text-[#684cff]'
                  }`}
                >
                  {ctaLabel}
                </Link>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
};

export const FAQSection = () => {
  const [openQuestion, setOpenQuestion] = React.useState(FAQ_ITEMS[0]?.question || '');

  return (
    <section className="mx-auto w-full max-w-4xl px-5 py-16 sm:px-8">
      <SectionTitle>Dúvidas frequentes</SectionTitle>
      <div className="mt-10 space-y-3">
        {FAQ_ITEMS.map((item) => {
          const isOpen = openQuestion === item.question;
          const answerId = `faq-${item.question.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;

          return (
            <article key={item.question} className="rounded-2xl border border-indigo-100 bg-white shadow-sm">
              <button
                type="button"
                className="flex w-full items-center justify-between gap-5 px-6 py-5 text-left"
                onClick={() => setOpenQuestion((current) => current === item.question ? '' : item.question)}
                aria-expanded={isOpen}
                aria-controls={answerId}
              >
                <span className="text-sm font-black text-[#07103a]">{item.question}</span>
                <ChevronDown className={`shrink-0 text-[#684cff] transition-transform ${isOpen ? 'rotate-180' : ''}`} size={20} />
              </button>
              <div id={answerId} className={`${isOpen ? 'block' : 'hidden'} px-6 pb-5`}>
                <p className="text-sm font-medium leading-6 text-slate-600">{item.answer}</p>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
};

export const FinalCTA = () => (
  <section className="mx-auto w-full max-w-7xl px-5 py-16 sm:px-8">
    <div className="grid gap-8 rounded-2xl bg-[#07103a] p-7 text-white sm:p-9 lg:grid-cols-[1fr_1.45fr] lg:items-center lg:p-10">
      <div>
        <h2 className="text-2xl font-black leading-tight tracking-tight md:text-3xl">Comece grátis hoje e veja a diferença na prática</h2>
        <p className="mt-4 max-w-xl text-sm font-medium leading-6 text-indigo-100">
          Crie sua conta e tenha acesso liberado para explorar a plataforma completa.
        </p>
        <Link href="/auth?mode=signup" className="mt-7 inline-flex h-12 items-center justify-center rounded-xl bg-[#684cff] px-7 text-sm font-bold text-white transition hover:bg-[#563fe0]">
          Começar grátis
        </Link>
      </div>

      <div className="grid gap-4 border-t border-white/10 pt-8 sm:grid-cols-3 lg:border-l lg:border-t-0 lg:pl-10 lg:pt-0">
        {FINAL_BENEFITS.map(({ label, icon: Icon }) => (
          <div key={label} className="flex items-center gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white/10 text-indigo-100">
              <Icon size={18} />
            </span>
            <span className="text-sm font-semibold text-indigo-50">{label}</span>
          </div>
        ))}
      </div>
    </div>
  </section>
);

export const Footer = () => (
  <footer id="blog" className="mx-auto w-full max-w-7xl px-5 pb-10 pt-6 sm:px-8">
    <div className="grid gap-10 border-t border-slate-100 pt-10 lg:grid-cols-[1.4fr_2fr_0.8fr]">
      <div>
        <PublicBrandLink width={205} surface="light" />
        <p className="mt-5 max-w-xs text-sm font-medium leading-6 text-slate-500">
          Estude com estratégia. Aprove com consistência.
        </p>
      </div>

      <div className="grid gap-8 sm:grid-cols-3">
        {FOOTER_COLUMNS.map((column) => (
          <div key={column.title}>
            <h3 className="text-sm font-black text-[#07103a]">{column.title}</h3>
            <ul className="mt-4 space-y-3">
              {column.links.map((link) => (
                <li key={`${column.title}-${link.label}`}>
                  <Link href={link.href} className="text-sm font-medium text-slate-500 transition hover:text-[#684cff]">
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      <div>
        <h3 className="text-sm font-black text-[#07103a]">Siga a gente</h3>
        <div className="mt-4 flex gap-3">
          {[
            { label: 'Instagram', icon: Instagram, href: 'https://instagram.com' },
            { label: 'YouTube', icon: Youtube, href: 'https://youtube.com' },
            { label: 'Telegram', icon: Send, href: 'https://telegram.org' },
          ].map(({ label, icon: Icon, href }) => (
            <Link
              key={label}
              href={href}
              className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 text-[#07103a] transition hover:border-[#684cff] hover:text-[#684cff]"
              aria-label={label}
            >
              <Icon size={17} />
            </Link>
          ))}
        </div>
      </div>
    </div>
    <p className="mt-10 text-center text-xs font-medium text-slate-400">© 2026 ConcursoMestre. Todos os direitos reservados.</p>
  </footer>
);

const LandingCommercialPage: React.FC = () => (
  <div className="min-h-screen bg-white text-[#07103a]">
    <Header />
    <main>
      <HeroSection />
      <FeaturesSection />
      <ApprovalContextSection />
      <ProcessSection />
      <TestimonialsSection />
      <PricingSection />
      <FAQSection />
      <FinalCTA />
    </main>
    <Footer />
  </div>
);

export default LandingCommercialPage;
