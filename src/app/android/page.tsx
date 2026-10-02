import Image from 'next/image';
import Link from 'next/link';
import type { Metadata } from 'next';
import { ArrowDownToLine, ArrowRight, BarChart3, BookOpenCheck, Check, Smartphone } from 'lucide-react';
import Footer from '@/components/shared/layout/Footer';
import StructuredData from '@/components/seo/StructuredData';
import { buildStructuredDataGraph, buildWebPage } from '@services/seo/structuredData';
import { fetchPublicMarketingSettings } from '../publicMarketingSettings';

export const revalidate = 300;

export const metadata: Metadata = {
  title: 'ConcursoMestre para Android',
  description: 'Pratique questões, faça simulados e acompanhe seu desempenho no aplicativo Android do ConcursoMestre.',
  alternates: { canonical: '/android' },
  openGraph: {
    title: 'ConcursoMestre para Android',
    description: 'Questões, simulados e desempenho para acompanhar sua preparação no celular.',
    url: '/android',
    type: 'website',
  },
};

const resolveAndroidStoreUrl = (value?: string | null) => {
  try {
    const url = new URL(String(value || '').trim());
    if (
      url.protocol === 'https:'
      && url.hostname === 'play.google.com'
      && url.pathname === '/store/apps/details'
      && url.searchParams.get('id') === 'com.concursomestre.mobile'
    ) return url.toString();
  } catch {
    // An invalid or unpublished Play Store URL keeps the download action unavailable.
  }
  return null;
};

const features = [
  {
    icon: BookOpenCheck,
    title: 'Questões para concursos',
    description: 'Pratique pelo banco de questões e organize sua sessão de estudo.',
  },
  {
    icon: Smartphone,
    title: 'Estude de onde estiver',
    description: 'Acesse questões e simulados pelo celular, no seu ritmo.',
  },
  {
    icon: BarChart3,
    title: 'Acompanhe sua evolução',
    description: 'Consulte seu histórico e veja seu desempenho ao longo da preparação.',
  },
];

function StoreAction({ href, compact = false }: { href: string | null; compact?: boolean }) {
  const className = `inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-5 py-3 text-center text-[13px] font-extrabold transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-blue-300 ${compact ? 'min-h-10 px-4 text-[12px]' : ''} ${href ? 'bg-blue-500 text-white shadow-[0_10px_32px_rgba(59,130,246,.22)] hover:bg-blue-400' : 'cursor-not-allowed border border-white/10 bg-white/[.06] text-slate-300'}`;

  if (!href) {
    return (
      <button type="button" disabled className={className}>
        <ArrowDownToLine aria-hidden="true" size={16} />
        Em breve
      </button>
    );
  }

  return (
    <a href={href} target="_blank" rel="noopener noreferrer" className={className}>
      <ArrowDownToLine aria-hidden="true" size={16} />
      Baixar na Google Play
      <ArrowRight aria-hidden="true" size={15} />
    </a>
  );
}

function QuestionPhonePreview() {
  return (
    <div className="relative mx-auto w-full max-w-[370px]">
      <div aria-hidden="true" className="absolute inset-x-8 -inset-y-7 rounded-full bg-blue-500/20 blur-[70px]" />
      <div className="relative mx-auto w-[min(100%,300px)] rounded-[38px] border border-slate-500/60 bg-[#030811] p-[7px] shadow-[0_28px_90px_rgba(0,0,0,.55)] sm:w-[310px]">
        <div className="overflow-hidden rounded-[31px] border border-white/[.08] bg-[#0b1422]">
          <div className="flex h-8 items-center justify-between px-5 text-[9px] font-semibold text-slate-200">
            <span>9:41</span>
            <span aria-hidden="true" className="flex items-center gap-1.5"><span className="h-1.5 w-1.5 rounded-full bg-slate-200" /><span className="h-2 w-3 rounded-sm border border-slate-300" /></span>
          </div>
          <div className="px-4 pb-4 pt-1">
            <div className="flex items-center justify-between border-b border-white/[.08] pb-3">
              <div>
                <p className="text-[10px] font-bold text-slate-100">Questão 01</p>
                <p className="mt-1 text-[8px] font-semibold text-blue-300">Direito Constitucional</p>
              </div>
              <span className="rounded-full border border-white/10 px-2 py-1 text-[7px] font-bold text-slate-300">Salvar</span>
            </div>
            <p className="mt-3 text-[9px] font-bold leading-[15px] text-slate-100">Marque a alternativa correta sobre os princípios da Administração Pública.</p>
            <div className="mt-3 space-y-2">
              {[
                ['A', 'Legalidade, impessoalidade, moralidade, publicidade e eficiência.'],
                ['B', 'Soberania, cidadania, dignidade e pluralismo político.'],
                ['C', 'Livre iniciativa, concorrência e defesa do consumidor.'],
                ['D', 'Proporcionalidade, motivação e continuidade do serviço.'],
              ].map(([letter, answer], index) => (
                <div key={letter} className={`flex items-start gap-2 rounded-xl border p-2.5 ${index === 0 ? 'border-emerald-400/55 bg-emerald-400/[.08]' : 'border-white/[.09] bg-white/[.025]'}`}>
                  <span className={`grid h-5 w-5 shrink-0 place-items-center rounded-full text-[8px] font-extrabold ${index === 0 ? 'bg-emerald-400 text-[#062018]' : 'bg-slate-700 text-slate-100'}`}>{letter}</span>
                  <span className={`text-[8px] leading-[13px] ${index === 0 ? 'text-emerald-50' : 'text-slate-300'}`}>{answer}</span>
                  {index === 0 ? <Check aria-label="Alternativa selecionada" size={13} className="ml-auto shrink-0 text-emerald-300" strokeWidth={3} /> : null}
                </div>
              ))}
            </div>
            <div className="mt-3 rounded-xl border border-blue-300/20 bg-blue-300/[.06] p-3">
              <p className="text-[8px] font-extrabold text-blue-200">Comentário da questão</p>
              <p className="mt-1 text-[7px] leading-[12px] text-slate-300">Confira a resolução e entenda por que cada alternativa está certa ou errada.</p>
            </div>
            <p className="mt-3 text-center text-[7px] font-semibold uppercase tracking-[.1em] text-slate-500">Prévia ilustrativa do aplicativo</p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default async function AndroidLandingPage() {
  const marketingSettings = await fetchPublicMarketingSettings();
  const storeUrl = resolveAndroidStoreUrl(marketingSettings.settings?.mobileAppUpdatePolicy?.androidStoreUrl);

  return (
    <div className="min-h-screen overflow-hidden bg-[#070d19] text-slate-50">
      <StructuredData value={buildStructuredDataGraph([buildWebPage({ path: '/android', name: 'ConcursoMestre para Android' })])} />

      <header className="border-b border-white/[.08] bg-[#070d19]/90 px-5">
        <div className="mx-auto flex h-[72px] max-w-[1180px] items-center justify-between gap-4">
          <Link href="/" aria-label="ConcursoMestre — início" className="shrink-0 rounded focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-blue-300">
            <Image src="/branding/logo-full-light.png" alt="ConcursoMestre" width={600} height={132} priority className="h-auto w-[168px] sm:w-[190px]" />
          </Link>
          <nav aria-label="Navegação da página" className="hidden items-center gap-7 text-xs font-semibold text-slate-300 md:flex">
            <a href="#recursos" className="transition hover:text-white">Recursos</a>
            <a href="#como-funciona" className="transition hover:text-white">Como funciona</a>
            <a href="#baixar" className="transition hover:text-white">Sobre o app</a>
          </nav>
          <div className="shrink-0"><StoreAction href={storeUrl} compact /></div>
        </div>
      </header>

      <main>
        <section id="como-funciona" aria-labelledby="android-title" className="relative isolate overflow-hidden px-5 py-12 sm:px-7 sm:py-16 lg:px-9 lg:py-20">
          <div aria-hidden="true" className="pointer-events-none absolute -right-32 top-0 -z-10 h-[520px] w-[600px] rounded-full bg-blue-700/15 blur-[120px]" />
          <div className="mx-auto grid max-w-[1180px] items-center gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(340px,.85fr)] lg:gap-14">
            <div className="max-w-[630px]">
              <p className="inline-flex items-center gap-2 text-[10px] font-extrabold uppercase tracking-[.16em] text-blue-300 sm:text-[11px]">
                <Smartphone aria-hidden="true" size={14} /> ConcursoMestre no Android
              </p>
              <h1 id="android-title" className="mt-4 text-[clamp(2.35rem,5.5vw,4.5rem)] font-black leading-[1.02] tracking-[-.055em]">
                Sua preparação <span className="text-blue-300">acompanha você.</span>
              </h1>
              <p className="mt-5 max-w-[570px] text-[15px] leading-7 text-slate-300 sm:text-base sm:leading-8">
                Resolva questões, pratique com simulados e acompanhe seu desempenho direto do celular.
              </p>
              <div className="mt-7 flex flex-wrap items-center gap-4">
                <StoreAction href={storeUrl} />
                <span className="inline-flex items-center gap-2 text-[12px] font-semibold text-slate-300"><Check aria-hidden="true" size={15} className="text-emerald-400" />Questões e simulados em um só app</span>
              </div>
              {!storeUrl ? <p className="mt-3 max-w-md text-[10px] leading-4 text-slate-500">O link de download será ativado após a publicação oficial do app na Google Play.</p> : null}
            </div>
            <QuestionPhonePreview />
          </div>
        </section>

        <section id="recursos" aria-label="Recursos do aplicativo" className="border-y border-white/[.06] bg-[#0a1320]/80 px-5 py-6 sm:px-7 lg:px-9">
          <div className="mx-auto grid max-w-[1180px] gap-3 md:grid-cols-3">
            {features.map(({ icon: Icon, title, description }) => (
              <article key={title} className="flex items-start gap-3 rounded-2xl border border-blue-100/[.08] bg-gradient-to-br from-[#111e30] to-[#0c1625] p-4 sm:p-5">
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-blue-300/10 bg-blue-300/[.08] text-blue-300"><Icon aria-hidden="true" size={19} /></span>
                <div>
                  <h2 className="text-[13px] font-extrabold text-slate-100">{title}</h2>
                  <p className="mt-1.5 text-[11px] leading-[18px] text-slate-400">{description}</p>
                </div>
              </article>
            ))}
          </div>
        </section>

        <section id="baixar" aria-labelledby="android-details-title" className="px-5 py-14 sm:px-7 sm:py-18 lg:px-9 lg:py-20">
          <div className="mx-auto grid max-w-[1180px] items-center gap-8 rounded-[24px] border border-blue-100/[.09] bg-gradient-to-br from-[#101d30] to-[#0a1422] p-6 sm:p-9 lg:grid-cols-[1fr_auto] lg:p-11">
            <div>
              <p className="text-[10px] font-extrabold uppercase tracking-[.16em] text-blue-300">Tudo para avançar na preparação</p>
              <h2 id="android-details-title" className="mt-3 max-w-[650px] text-[clamp(1.7rem,3vw,2.5rem)] font-black leading-[1.1] tracking-[-.045em]">Questões, simulados e seu histórico de estudos no mesmo lugar.</h2>
              <p className="mt-3 max-w-[680px] text-sm leading-6 text-slate-300">Pratique pelo banco de questões, monte simulados personalizados e retome sua preparação pelo celular.</p>
            </div>
            <StoreAction href={storeUrl} />
          </div>
        </section>
      </main>

      <div className="dark bg-[#070d19] px-5"><Footer /></div>
    </div>
  );
}
