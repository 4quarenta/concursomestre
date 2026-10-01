'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import { ArrowLeft, ArrowRight, ArrowUpRight, Check, CirclePlay, CreditCard, FileQuestion, FlaskConical, LineChart, LockKeyhole, ShieldCheck, Sparkles, Target } from 'lucide-react';

interface EliteOfferProps {
  checkoutHref: string;
  monthlyPrice: number | null;
  annualPrice: number | null;
}

const organizations = [
  { name: 'Polícia Federal', category: 'Segurança pública', logo: '/assets/organizations/policia-federal.png', width: 'basis-[245px]' },
  { name: 'INSS', category: 'Previdência', logo: '/assets/organizations/inss.png', width: 'basis-[205px]' },
  { name: 'Receita Federal do Brasil', category: 'Área fiscal', logo: '/assets/organizations/receita-federal.jpg', width: 'basis-[270px]' },
  { name: 'Banco Central do Brasil', category: 'Área financeira', logo: '/assets/organizations/banco-central.png', width: 'basis-[270px]' },
  { name: 'Tribunal de Contas da União', category: 'Controle', logo: '/assets/organizations/tcu.png', width: 'basis-[320px]' },
  { name: 'Justiça Eleitoral', category: 'Tribunais', logo: '/assets/organizations/justica-eleitoral.jpg', width: 'basis-[250px]' },
  { name: 'Polícia Rodoviária Federal', category: 'Segurança pública', logo: '/assets/organizations/policia-rodoviaria-federal.png', width: 'basis-[295px]' },
  { name: 'Banco do Brasil', category: 'Área financeira', logo: '/assets/organizations/banco-do-brasil.png', width: 'basis-[225px]' },
];

const features = [
  {
    id: 'questions', tab: 'Pratique questões', kicker: 'Aprenda resolvendo', title: 'Mais de 3 milhões de questões reais',
    description: 'Cada questão explica as alternativas uma a uma e traz um resumo para você entender o conteúdo e saber o que revisar. Você encontra macetes e identifica o que mais costuma cair nas provas.',
    points: ['Análise detalhada de cada alternativa', 'Resumo da questão com macetes de estudo', 'Veja os assuntos mais cobrados e direcione sua revisão'], icon: FileQuestion,
  },
  {
    id: 'simulations', tab: 'Faça simulados', kicker: 'Treine em condições de prova', title: 'Faça simulados do seu jeito',
    description: 'Monte simulados para testar seus conhecimentos, treinar no ritmo de uma prova e comparar seu desempenho com o de seus concorrentes.',
    points: ['Escolha banca, matérias e quantidade', 'Compare seu resultado com o dos concorrentes', 'Revise o resultado e acompanhe sua evolução'], icon: CirclePlay,
  },
  {
    id: 'xray', tab: 'Raio-X da banca', kicker: 'Entenda o perfil da cobrança', title: 'Analise a banca com um Raio-X aprofundado',
    description: 'Explore os assuntos mais cobrados e veja como a banca distribui questões nas provas.',
    points: ['Visão organizada por assunto', 'Histórico de provas e questões', 'Mais contexto para direcionar sua revisão'], icon: FlaskConical,
  },
  {
    id: 'compare', tab: 'Compare seu desempenho', kicker: 'Coloque seu resultado em contexto', title: 'Avalie seu desempenho em relação aos concorrentes',
    description: 'Compare seu rendimento com referências disponíveis da mesma prova e entenda como está sua preparação.',
    points: ['Acompanhe seus acertos e aproveitamento', 'Compare sua nota com a média da prova', 'Use o resultado para ajustar seus estudos'], icon: LineChart,
  },
  {
    id: 'improve', tab: 'Veja o que melhorar', kicker: 'Transforme dados em próximos passos', title: 'Descubra onde concentrar seus estudos',
    description: 'Identifique matérias e assuntos que merecem mais atenção e planeje melhor sua próxima revisão.',
    points: ['Visualize pontos de atenção', 'Priorize assuntos com menor aproveitamento', 'Acompanhe sua evolução ao longo do tempo'], icon: Target,
  },
  {
    id: 'updates', tab: 'Novidades da plataforma', kicker: 'A plataforma segue evoluindo', title: 'Seja o primeiro a conhecer as novidades',
    description: 'O Concurso Mestre está em constante desenvolvimento, construindo melhorias para apoiar sua preparação.',
    points: ['Novos recursos em desenvolvimento', 'Melhorias contínuas na experiência', 'Uma plataforma que evolui junto com você'], icon: Sparkles,
  },
] as const;

function CarouselArrow({ direction, onClick }: { direction: 'previous' | 'next'; onClick: () => void }) {
  const Icon = direction === 'previous' ? ArrowLeft : ArrowRight;
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={direction === 'previous' ? 'Órgãos anteriores' : 'Próximos órgãos'}
      className="grid h-10 w-10 place-items-center rounded-full border border-blue-100/15 bg-[#101d30] text-slate-200 transition hover:border-blue-300/50 hover:bg-[#172a46] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-300"
    >
      <Icon aria-hidden="true" size={16} />
    </button>
  );
}

function DemoFrame({ children }: { children: ReactNode }) {
  return (
    <div className="relative min-h-[285px] overflow-hidden rounded-2xl border border-slate-200 bg-[#f6f8fb] text-slate-800 shadow-[0_18px_46px_rgba(0,0,0,.34)] sm:min-h-[310px]">
      <div className="flex h-9 items-center gap-1.5 border-b border-slate-200 bg-white px-3">
        <span className="h-2 w-2 rounded-full bg-slate-300" />
        <span className="h-2 w-2 rounded-full bg-slate-300" />
        <span className="h-2 w-2 rounded-full bg-slate-300" />
        <span className="ml-2 text-[9px] font-bold text-slate-500">Área de estudos · Concurso Mestre</span>
        <span className="ml-auto rounded-full bg-slate-100 px-2 py-1 text-[8px] font-extrabold text-slate-500">PRÉVIA DO PRODUTO</span>
      </div>
      <div className="p-3 sm:p-4">{children}</div>
      <span className="absolute bottom-2 right-3 text-[8px] font-medium text-slate-400">Interface ilustrativa</span>
    </div>
  );
}

function QuestionsDemo() {
  return (
    <DemoFrame>
      <p className="text-[9px] font-extrabold uppercase tracking-[.1em] text-slate-500">Questões · Direito Constitucional</p>
      <div className="mt-2.5 rounded-xl border border-slate-200 bg-white p-3.5 shadow-sm sm:p-4">
        <div className="flex flex-wrap items-center gap-2 text-[9px] text-slate-500"><span className="rounded-full bg-indigo-50 px-2 py-1 font-extrabold text-indigo-700">CESPE</span><span>2023</span><span>·</span><span>Constituição Federal</span></div>
        <p className="mt-3 text-[11px] font-bold leading-[1.55] text-slate-800 sm:text-xs">São Poderes da União, independentes e harmônicos entre si, o Legislativo, o Executivo e o Judiciário.</p>
        <div className="mt-3 grid gap-1.5 text-[10px]"><div className="rounded-lg border border-slate-200 px-2.5 py-2">Certo</div><div className="rounded-lg border border-slate-200 px-2.5 py-2">Errado</div></div>
        <div className="mt-3 flex items-center justify-between text-[9px] text-slate-500"><span>Questão 12 de 20</span><span className="rounded-md bg-blue-600 px-3 py-2 font-bold text-white">Responder</span></div>
        <div className="mt-3 rounded-lg border border-indigo-100 bg-indigo-50/80 p-2.5">
          <p className="text-[9px] font-extrabold text-indigo-800">Depois de responder, entenda o porquê</p>
          <p className="mt-1 text-[9px] leading-4 text-slate-600">Análise alternativa por alternativa, resumo do conteúdo, macetes e assuntos mais cobrados para orientar sua revisão.</p>
        </div>
      </div>
    </DemoFrame>
  );
}

function SimulationsDemo() {
  return (
    <DemoFrame>
      <p className="text-[9px] font-extrabold uppercase tracking-[.1em] text-slate-500">Simulados · personalize sua prática</p>
      <div className="mt-2.5 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex items-center gap-3"><span className="grid h-10 w-10 place-items-center rounded-xl bg-indigo-50 text-blue-700"><CirclePlay size={19} /></span><div><p className="text-xs font-extrabold">Simulado personalizado</p><p className="mt-1 text-[10px] text-slate-500">Escolha matérias, banca e quantidade</p></div><span className="ml-auto rounded-lg bg-blue-600 px-3 py-2 text-[9px] font-extrabold text-white">Criar</span></div>
        <div className="mt-4 rounded-lg border border-slate-200 p-3">
          <p className="text-[9px] font-bold text-slate-500">Resultado · comparação com concorrentes</p>
          <div className="mt-2 grid grid-cols-2 gap-2">
            <div className="rounded-lg bg-indigo-50 px-3 py-2"><p className="text-[8px] font-bold text-slate-500">Seu resultado</p><p className="mt-0.5 text-sm font-black text-indigo-800">72%</p></div>
            <div className="rounded-lg bg-slate-50 px-3 py-2"><p className="text-[8px] font-bold text-slate-500">Média dos concorrentes</p><p className="mt-0.5 text-sm font-black text-slate-700">64%</p></div>
          </div>
        </div>
      </div>
    </DemoFrame>
  );
}

function XrayDemo() {
  const topics = [['Direito Constitucional', 'w-[82%]'], ['Direito Administrativo', 'w-[68%]'], ['Português', 'w-[55%]'], ['Raciocínio Lógico', 'w-[39%]']] as const;
  return (
    <DemoFrame>
      <div className="flex items-center justify-between"><p className="text-[9px] font-extrabold uppercase tracking-[.1em] text-slate-500">Raio-X da banca · CESPE</p><span className="rounded-full bg-indigo-50 px-2 py-1 text-[8px] font-bold text-indigo-700">Perfil de cobrança</span></div>
      <div className="mt-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm"><p className="text-xs font-extrabold">Assuntos mais recorrentes</p><p className="mt-1 text-[9px] text-slate-500">Distribuição de questões por matéria</p><div className="mt-4 space-y-3">{topics.map(([topic, width]) => <div key={topic}><div className="mb-1.5 flex justify-between text-[9px] font-semibold text-slate-600"><span>{topic}</span><span className="text-slate-400">Analisar</span></div><div className="h-2 overflow-hidden rounded-full bg-slate-100"><div className={`h-full rounded-full bg-gradient-to-r from-blue-600 to-indigo-500 ${width}`} /></div></div>)}</div></div>
    </DemoFrame>
  );
}

function ComparisonDemo() {
  return (
    <DemoFrame>
      <p className="text-[9px] font-extrabold uppercase tracking-[.1em] text-slate-500">Desempenho · prova selecionada</p>
      <div className="mt-2.5 grid grid-cols-2 gap-2"><div className="rounded-xl border border-slate-200 bg-white p-3.5"><p className="text-[9px] font-bold text-slate-500">Seu aproveitamento</p><p className="mt-1 text-2xl font-black tracking-tight text-slate-800">72%</p><p className="mt-1 text-[9px] font-semibold text-emerald-600">Seu resultado</p></div><div className="rounded-xl border border-slate-200 bg-white p-3.5"><p className="text-[9px] font-bold text-slate-500">Concorrentes</p><p className="mt-1 text-2xl font-black tracking-tight text-slate-800">64%</p><p className="mt-1 text-[9px] font-semibold text-slate-500">Média dos participantes</p></div></div>
      <div className="mt-2.5 rounded-xl border border-slate-200 bg-white p-3.5"><div className="flex items-center justify-between text-[9px] font-bold text-slate-600"><span>Comparativo por matéria</span><span className="text-blue-700">Ver análise <ArrowUpRight className="inline" size={12} /></span></div><div className="mt-3 space-y-2"><div className="flex items-center gap-2 text-[9px]"><span className="w-20 text-slate-500">Português</span><div className="h-1.5 flex-1 rounded-full bg-slate-100"><div className="h-full w-[72%] rounded-full bg-blue-600" /></div><span className="font-bold text-slate-600">72%</span></div><div className="flex items-center gap-2 text-[9px]"><span className="w-20 text-slate-500">Média</span><div className="h-1.5 flex-1 rounded-full bg-slate-100"><div className="h-full w-[64%] rounded-full bg-slate-400" /></div><span className="font-bold text-slate-600">64%</span></div></div></div>
    </DemoFrame>
  );
}

function ImproveDemo() {
  const tasks = [['Direito Administrativo', 'Revisar'], ['Raciocínio Lógico', 'Praticar'], ['Português', 'Em dia']] as const;
  return (
    <DemoFrame>
      <p className="text-[9px] font-extrabold uppercase tracking-[.1em] text-slate-500">Seu plano de revisão</p>
      <div className="mt-2.5 space-y-2">{tasks.map(([task, action], index) => <div key={task} className="flex items-center gap-2.5 rounded-xl border border-slate-200 bg-white px-3 py-2.5"><span className={`grid h-6 w-6 place-items-center rounded-lg ${index === 2 ? 'bg-emerald-50 text-emerald-600' : 'bg-amber-50 text-amber-600'}`}>{index === 2 ? <Check size={14} /> : <Target size={13} />}</span><span className="text-[10px] font-bold text-slate-700">{task}</span><span className="ml-auto rounded-full bg-slate-100 px-2 py-1 text-[8px] font-bold text-slate-500">{action}</span></div>)}</div>
      <div className="mt-2.5 rounded-xl border border-slate-200 bg-white p-3.5"><p className="text-[9px] font-bold text-slate-500">Seu desempenho por matéria</p><div className="mt-3 grid h-20 grid-cols-5 items-end gap-2">{[['h-[45%]', 'Adm.'], ['h-[60%]', 'Lógico'], ['h-[78%]', 'Port.'], ['h-[55%]', 'Info.'], ['h-[70%]', 'Const.']].map(([height, label], index) => <div key={label} className="flex h-full flex-col items-center justify-end gap-1"><span className={`w-full rounded-t-md ${index === 0 || index === 1 ? 'bg-amber-400' : 'bg-blue-500'} ${height}`} /><span className="text-[7px] text-slate-500">{label}</span></div>)}</div></div>
    </DemoFrame>
  );
}

function UpdatesDemo() {
  return (
    <DemoFrame>
      <p className="text-[9px] font-extrabold uppercase tracking-[.1em] text-slate-500">Evolução da plataforma</p>
      <div className="mt-2.5 space-y-2"><div className="flex gap-3 rounded-xl border border-slate-200 bg-white p-3.5"><span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-indigo-50 text-blue-700"><Sparkles size={17} /></span><div><div className="flex flex-wrap items-center gap-2"><p className="text-[10px] font-extrabold">Novos recursos em desenvolvimento</p><span className="rounded-full bg-blue-50 px-2 py-1 text-[7px] font-extrabold uppercase text-blue-700">Em evolução</span></div><p className="mt-1 text-[9px] leading-4 text-slate-500">Estamos construindo melhorias para apoiar sua preparação. Acompanhe as novidades da plataforma.</p></div></div><div className="flex gap-3 rounded-xl border border-slate-200 bg-white p-3.5"><span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-emerald-50 text-emerald-700"><Check size={17} /></span><div><p className="text-[10px] font-extrabold">Melhorias contínuas</p><p className="mt-1 text-[9px] leading-4 text-slate-500">A experiência evolui com novas entregas e ajustes ao longo do tempo.</p></div></div></div>
    </DemoFrame>
  );
}

function FeatureDemo({ id }: { id: (typeof features)[number]['id'] }) {
  if (id === 'questions') return <QuestionsDemo />;
  if (id === 'simulations') return <SimulationsDemo />;
  if (id === 'xray') return <XrayDemo />;
  if (id === 'compare') return <ComparisonDemo />;
  if (id === 'improve') return <ImproveDemo />;
  return <UpdatesDemo />;
}

export default function EliteLandingSections({ checkoutHref, monthlyPrice, annualPrice }: EliteOfferProps) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [activeTab, setActiveTab] = useState<(typeof features)[number]['id']>('questions');
  const [carouselPage, setCarouselPage] = useState(0);

  const scrollOrganizations = (direction: -1 | 1) => {
    const track = trackRef.current;
    if (!track) return;
    track.scrollBy({ left: direction * Math.max(track.clientWidth * 0.78, 220), behavior: 'smooth' });
  };

  const updateCarouselPage = () => {
    const track = trackRef.current;
    if (!track) return;
    const maxScroll = track.scrollWidth - track.clientWidth;
    setCarouselPage(maxScroll > 0 ? Math.min(2, Math.round((track.scrollLeft / maxScroll) * 2)) : 0);
  };

  const handleTabKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
    const currentIndex = features.findIndex((feature) => feature.id === activeTab);
    const offset = event.key === 'ArrowRight' ? 1 : -1;
    const nextFeature = features[(currentIndex + offset + features.length) % features.length];
    event.preventDefault();
    setActiveTab(nextFeature.id);
    document.getElementById(`elite-tab-${nextFeature.id}`)?.focus();
  };

  return (
    <>
      <section aria-labelledby="elite-organizations-title" className="border-y border-white/[.06] bg-[radial-gradient(ellipse_at_50%_0%,rgba(36,85,158,.13),transparent_70%)] px-5 py-14 sm:px-7 sm:py-[72px] lg:px-9">
        <div className="mx-auto max-w-[1180px]">
          <div className="flex flex-wrap items-end justify-between gap-5">
            <div className="max-w-[720px]">
              <p className="text-[10px] font-extrabold uppercase tracking-[.16em] text-blue-300">Sua próxima aprovação começa aqui</p>
              <h2 id="elite-organizations-title" className="mt-3 text-[clamp(1.8rem,3.8vw,2.65rem)] font-black leading-[1.08] tracking-[-.045em]">Estude para os principais concursos</h2>
              <p className="mt-3 max-w-[620px] text-sm leading-6 text-slate-300 sm:text-[15px]">Encontre questões e provas dos órgãos que movem sua carreira. Escolha seu objetivo e prepare-se com foco.</p>
            </div>
            <div className="flex gap-2 pb-0.5">
              <CarouselArrow direction="previous" onClick={() => scrollOrganizations(-1)} />
              <CarouselArrow direction="next" onClick={() => scrollOrganizations(1)} />
            </div>
          </div>

          <div ref={trackRef} onScroll={updateCarouselPage} className="mt-7 flex snap-x snap-mandatory gap-3 overflow-x-auto pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {organizations.map((organization) => (
              <article key={organization.name} title={organization.name} className={`flex h-[92px] shrink-0 snap-start items-center gap-3 rounded-2xl border border-blue-100/10 bg-gradient-to-br from-[#14243b] to-[#0c1727] px-3.5 transition hover:-translate-y-0.5 hover:border-blue-200/30 sm:h-[102px] sm:px-4 ${organization.width}`}>
                <span className="grid h-11 w-11 shrink-0 place-items-center overflow-hidden rounded-xl border border-slate-200/70 bg-white p-1.5 sm:h-12 sm:w-12">
                  <Image src={organization.logo} alt={organization.name} width={48} height={48} sizes="48px" className="h-full w-full object-contain" />
                </span>
                <span className="min-w-0">
                  <span className="block whitespace-nowrap text-[11px] font-extrabold leading-4 text-slate-100 sm:text-xs">{organization.name}</span>
                  <span className="mt-1.5 block whitespace-nowrap text-[9px] font-bold uppercase tracking-[.1em] text-slate-400">{organization.category}</span>
                </span>
              </article>
            ))}
          </div>
          <div className="mt-1 flex items-center justify-between text-[11px] text-slate-500">
            <span>Explore órgãos e áreas de atuação</span>
            <div className="flex items-center gap-1.5" aria-hidden="true">{[0, 1, 2].map((page) => <span key={page} className={`h-1.5 rounded-full transition-all ${carouselPage === page ? 'w-5 bg-blue-400' : 'w-1.5 bg-slate-600'}`} />)}</div>
          </div>
        </div>
      </section>

      <section aria-labelledby="elite-features-title" className="px-5 py-16 sm:px-7 sm:py-20 lg:px-9">
        <div className="mx-auto max-w-[1180px]">
          <div className="mx-auto mb-8 max-w-[700px] text-center sm:mb-9">
            <p className="text-[10px] font-extrabold uppercase tracking-[.16em] text-blue-300">Tudo para avançar na preparação</p>
            <h2 id="elite-features-title" className="mt-3 text-[clamp(1.9rem,4vw,2.75rem)] font-black leading-[1.08] tracking-[-.05em]">Seu estudo, com mais direção</h2>
            <p className="mx-auto mt-3 max-w-[620px] text-sm leading-6 text-slate-300 sm:text-[15px]">Conheça na prática os recursos do Elite e veja como cada etapa da preparação pode ficar mais organizada.</p>
          </div>

          <div className="overflow-hidden rounded-[20px] border border-blue-100/10 bg-gradient-to-br from-[#101e32] to-[#0a1321] shadow-[0_25px_80px_rgba(0,0,0,.24)] sm:rounded-[23px]">
            <div role="tablist" aria-label="Recursos do plano Elite" onKeyDown={handleTabKeyDown} className="inline-flex max-w-full gap-1 overflow-x-auto rounded-xl bg-slate-800 p-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {features.map((feature) => (
                <button key={feature.id} id={`elite-tab-${feature.id}`} type="button" role="tab" aria-selected={activeTab === feature.id} aria-controls={`elite-panel-${feature.id}`} tabIndex={activeTab === feature.id ? 0 : -1} onClick={() => setActiveTab(feature.id)} className={`min-h-10 shrink-0 rounded-lg px-3.5 text-[11px] font-bold transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-300 sm:px-4 sm:text-xs ${activeTab === feature.id ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-400 hover:text-white'}`}>
                  {feature.tab}
                </button>
              ))}
            </div>

            {features.map((feature) => {
              const Icon = feature.icon;
              const isActive = activeTab === feature.id;
              return (
                <div key={feature.id} id={`elite-panel-${feature.id}`} role="tabpanel" aria-labelledby={`elite-tab-${feature.id}`} hidden={!isActive} className={`${isActive ? 'grid' : 'hidden'} items-center gap-7 p-5 sm:gap-9 sm:p-8 lg:grid-cols-[.88fr_1.12fr] lg:gap-10 lg:p-9`}>
                  <div>
                    <p className="flex items-center gap-2 text-[10px] font-extrabold uppercase tracking-[.13em] text-blue-300"><Icon aria-hidden="true" size={15} />{feature.kicker}</p>
                    <h3 className="mt-3 text-[clamp(1.65rem,3vw,2.15rem)] font-black leading-[1.12] tracking-[-.04em]">{feature.title}</h3>
                    <p className="mt-3 max-w-[440px] text-[13px] leading-6 text-slate-300 sm:text-sm">{feature.description}</p>
                    <ul className="mt-5 grid gap-3">
                      {feature.points.map((point) => <li key={point} className="flex items-start gap-2.5 text-xs leading-5 text-slate-200"><span className="mt-0.5 grid h-[18px] w-[18px] shrink-0 place-items-center rounded-full bg-emerald-400/10 text-emerald-300"><Check aria-hidden="true" size={12} strokeWidth={3} /></span><span>{point}</span></li>)}
                    </ul>
                  </div>
                  <FeatureDemo id={feature.id} />
                </div>
              );
            })}
          </div>
        </div>
      </section>

      <section aria-labelledby="elite-feature-offer-title" className="px-5 pb-16 sm:px-7 sm:pb-20 lg:px-9">
        <div className="mx-auto max-w-[1180px]">
          <header className="mx-auto mb-5 max-w-[820px] text-center sm:mb-6">
            <p className="text-[10px] font-extrabold uppercase tracking-[.16em] text-slate-400">Tudo para avançar na preparação</p>
            <h2 id="elite-feature-offer-title" className="mt-2 text-[clamp(1.6rem,3.2vw,2.15rem)] font-black leading-[1.1] tracking-[-.045em]">
              Sabemos como a vida do <span className="text-[#9ecbff]">concurseiro</span> é difícil.
            </h2>
            <p className="mx-auto mt-2 max-w-[680px] text-sm leading-6 text-slate-300">
              O Elite reúne ferramentas para você estudar com estratégia, com cobrança mensal no cartão.
            </p>
          </header>

          <div className="relative overflow-hidden rounded-[19px] border border-white/[.12] bg-[linear-gradient(112deg,#141d2b_0%,#101824_58%,#111925_100%)] px-5 py-5 shadow-[0_20px_50px_rgba(0,0,0,.22)] sm:px-6">
            <div aria-hidden="true" className="pointer-events-none absolute -right-8 -top-16 h-40 w-60 rounded-full bg-slate-300/[.06] blur-3xl" />
            <div className="relative grid gap-4 md:grid-cols-[minmax(0,1fr)_auto_auto] md:items-center md:gap-5">
              <div className="min-w-0">
                <span className="inline-flex min-h-6 items-center rounded-full border border-white/[.12] bg-white/[.05] px-2.5 py-1 text-[10px] font-extrabold tracking-[.12em] text-slate-200">ELITE ANUAL</span>
                <h3 className="mt-2 max-w-[540px] text-[clamp(1rem,1.8vw,1.15rem)] font-extrabold leading-6 tracking-[-.025em]">
                  <span className="text-[#9ecbff]">Acesso completo</span> pelo preço de uma lata de Coca-Cola.
                </h3>
              </div>

              <div className="text-left md:border-l md:border-white/[.14] md:pl-5 md:text-right">
                {monthlyPrice !== null && annualPrice !== null ? (
                  <>
                    <p className="flex items-baseline gap-1.5 md:justify-end">
                      <span className="text-sm font-bold text-slate-100">R$</span>
                      <span className="text-[30px] font-black leading-none tracking-[-.06em] text-white">{monthlyPrice.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                      <span className="text-[13px] text-slate-300">/mês</span>
                    </p>
                    <p className="mt-1.5 text-[11px] whitespace-nowrap text-slate-400">Total anual de R$ {annualPrice.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                  </>
                ) : (
                  <p className="text-sm font-bold text-slate-100">Consulte o valor do Elite anual.</p>
                )}
              </div>

              <Link href={checkoutHref} className="inline-flex min-h-12 w-full items-center justify-center gap-2 whitespace-nowrap rounded-[11px] bg-[#e8edf5] px-4 py-3 text-center text-[11px] font-extrabold uppercase tracking-[.06em] text-slate-950 transition hover:bg-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-blue-300 md:w-auto">
                <span className="shrink-0 whitespace-nowrap">Quero o Elite anual</span> <ArrowRight aria-hidden="true" size={16} className="shrink-0" />
              </Link>
            </div>

            <ul className="relative mt-4 flex flex-wrap gap-x-6 gap-y-2.5 border-t border-white/[.10] pt-3 text-[11px] font-semibold text-slate-300">
              <li className="flex items-center gap-2"><LockKeyhole aria-hidden="true" size={14} className="shrink-0 text-[#9ecbff]" /> Compra segura</li>
              <li className="flex items-center gap-2"><ShieldCheck aria-hidden="true" size={14} className="shrink-0 text-[#9ecbff]" /> Garantia de 7 dias</li>
              <li className="flex items-center gap-2"><CreditCard aria-hidden="true" size={14} className="shrink-0 text-[#9ecbff]" /> Só a parcela do mês ocupa o limite do cartão</li>
            </ul>
          </div>
        </div>
      </section>
    </>
  );
}
