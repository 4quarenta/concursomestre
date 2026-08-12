import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import {
  ArrowLeft,
  ArrowRight,
  BookOpenCheck,
  Building2,
  CalendarDays,
  CheckCircle2,
  ExternalLink,
  FileText,
  Landmark,
  ListChecks,
} from 'lucide-react';
import { buildSiteUrl } from '@/config/siteUrl';
import {
  PLATFORM_PAGE_DESCRIPTION_CLASS,
  PLATFORM_PAGE_TITLE_CLASS,
  PLATFORM_SURFACE_CARD_CLASS,
} from '@constants/layout';
import { serializeStructuredData } from '@services/seo/structuredData';
import {
  fetchPublicBoardDetail,
  type PublicBoardExamStatus,
} from '../../taxonomias/taxonomyDirectoryServerData';

export const revalidate = 300;

type BoardPageProps = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ status?: string; pagina?: string }>;
};

const STATUS_OPTIONS: Array<{
  value: PublicBoardExamStatus | 'all';
  label: string;
  countKey: 'total' | 'open' | 'upcoming' | 'completed' | 'unknown';
}> = [
  { value: 'all', label: 'Todos', countKey: 'total' },
  { value: 'open', label: 'Inscrições abertas', countKey: 'open' },
  { value: 'upcoming', label: 'Próximos', countKey: 'upcoming' },
  { value: 'completed', label: 'Realizados', countKey: 'completed' },
  { value: 'unknown', label: 'Sem data', countKey: 'unknown' },
];

const STATUS_LABELS: Record<PublicBoardExamStatus, string> = {
  open: 'Inscrições abertas',
  upcoming: 'Próximo',
  completed: 'Realizado',
  unknown: 'Data não informada',
};

const STATUS_CLASSES: Record<PublicBoardExamStatus, string> = {
  open: 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300',
  upcoming: 'border-sky-200 bg-sky-50 text-sky-700 dark:border-sky-800 dark:bg-sky-950/40 dark:text-sky-300',
  completed: 'border-slate-200 bg-slate-100 text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300',
  unknown: 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-300',
};

const readStatus = (value: string | undefined): PublicBoardExamStatus | 'all' => (
  ['open', 'upcoming', 'completed', 'unknown'].includes(String(value || ''))
    ? value as PublicBoardExamStatus
    : 'all'
);

const formatDate = (value: string | null) => {
  if (!value) return null;
  const date = new Date(`${value.slice(0, 10)}T12:00:00`);
  return Number.isNaN(date.getTime()) ? null : new Intl.DateTimeFormat('pt-BR').format(date);
};

const buildStatusHref = (slug: string, status: PublicBoardExamStatus | 'all', page = 1) => {
  const query = new URLSearchParams();
  if (status !== 'all') query.set('status', status);
  if (page > 1) query.set('pagina', String(page));
  const suffix = query.toString();
  return suffix ? `/bancas/${slug}?${suffix}` : `/bancas/${slug}`;
};

const modalityLabel = (value: string) => {
  const normalized = value.toLowerCase();
  if (normalized.includes('certo') || normalized.includes('true_false')) return 'Certo ou errado';
  if (normalized.includes('multipla') || normalized.includes('multiple') || normalized.includes('single')) return 'Múltipla escolha';
  return 'Modalidade não informada';
};

const difficultyLabel = (value: number) => {
  if (value <= 0) return 'Dificuldade não informada';
  if (value === 1) return 'Fácil';
  if (value === 2) return 'Média';
  return 'Difícil';
};

export async function generateMetadata({ params }: BoardPageProps): Promise<Metadata> {
  const { slug } = await params;
  const detail = await fetchPublicBoardDetail({ slug, page: 1, status: 'all' });
  if (!detail) return { title: 'Banca não encontrada' };
  const boardName = detail.board.acronym && detail.board.acronym !== detail.board.name
    ? `${detail.board.acronym} - ${detail.board.name}`
    : detail.board.name;
  const description = detail.board.description
    || `Conheça a banca ${boardName}, consulte provas e pratique ${detail.board.questionCount} questões publicadas.`;
  return {
    title: `${boardName} - questões e provas`,
    description,
    alternates: { canonical: `/bancas/${detail.board.slug}` },
    openGraph: {
      title: `${boardName} - questões e provas`,
      description,
      url: `/bancas/${detail.board.slug}`,
      type: 'website',
      images: detail.board.imageUrl ? [{ url: detail.board.imageUrl }] : undefined,
    },
  };
}

export default async function PublicBoardPage({ params, searchParams }: BoardPageProps) {
  const [{ slug }, query] = await Promise.all([params, searchParams]);
  const status = readStatus(query.status);
  const requestedPage = Math.max(1, Number.parseInt(String(query.pagina || '1'), 10) || 1);
  const detail = await fetchPublicBoardDetail({ slug, page: requestedPage, status });
  if (!detail) notFound();

  const { board, examSummary } = detail;
  const boardName = board.acronym && board.acronym !== board.name
    ? `${board.acronym} - ${board.name}`
    : board.name;
  const profileByModality = new Map<string, number>();
  const profileByDifficulty = new Map<number, number>();
  detail.questionProfile.forEach((item) => {
    profileByModality.set(item.modality, (profileByModality.get(item.modality) || 0) + item.questionCount);
    profileByDifficulty.set(item.difficulty, (profileByDifficulty.get(item.difficulty) || 0) + item.questionCount);
  });
  const maxSubjectCount = Math.max(1, ...detail.topSubjects.map((item) => item.questionCount));
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: board.name,
    alternateName: board.acronym || undefined,
    url: buildSiteUrl(`/bancas/${board.slug}`),
    sameAs: board.website ? [board.website] : undefined,
    logo: board.imageUrl || undefined,
    description: board.description || undefined,
  };

  return (
    <div className="w-full animate-fade-in space-y-5">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: serializeStructuredData(jsonLd) }} />

      <Link href="/bancas" prefetch={false} className="inline-flex items-center gap-1.5 text-xs font-black text-[#615fff] hover:underline">
        <ArrowLeft size={14} /> Todas as bancas
      </Link>

      <header className={`${PLATFORM_SURFACE_CARD_CLASS} overflow-hidden`}>
        <div className="flex flex-col gap-5 p-5 sm:flex-row sm:items-start sm:p-6">
          <div className="grid h-20 w-20 shrink-0 place-items-center overflow-hidden rounded-md border border-indigo-100 bg-indigo-50 text-[#615fff] dark:border-indigo-900 dark:bg-indigo-950/40">
            {board.imageUrl ? (
              <Image src={board.imageUrl} alt={`Logo ${boardName}`} width={80} height={80} unoptimized className="h-full w-full object-contain p-2" />
            ) : <Landmark size={30} />}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[#615fff]">Banca organizadora</p>
            <h1 className={`mt-2 ${PLATFORM_PAGE_TITLE_CLASS}`}>{boardName}</h1>
            <p className={`mt-3 max-w-4xl ${PLATFORM_PAGE_DESCRIPTION_CLASS}`}>
              {board.description || 'Banca cadastrada no acervo público do ConcursoMestre. Os dados abaixo são calculados a partir das questões e provas publicadas.'}
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              <Link href={{ pathname: '/practice', query: { agency: board.acronym || board.name } }} className="inline-flex h-10 items-center gap-2 rounded-md bg-[#615fff] px-4 text-xs font-black text-white hover:bg-[#514dff]">
                <BookOpenCheck size={15} /> Resolver questões
              </Link>
              {board.website ? (
                <a href={board.website} target="_blank" rel="noreferrer" className="inline-flex h-10 items-center gap-2 rounded-md border border-slate-200 bg-white px-4 text-xs font-black text-slate-600 hover:border-[#615fff]/40 hover:text-[#615fff] dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200">
                  Site oficial <ExternalLink size={14} />
                </a>
              ) : null}
            </div>
          </div>
        </div>
      </header>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4" aria-label="Resumo da banca">
        <div className={`${PLATFORM_SURFACE_CARD_CLASS} p-5`}><ListChecks size={18} className="text-[#615fff]" /><strong className="mt-3 block text-2xl text-slate-950 dark:text-white">{board.questionCount.toLocaleString('pt-BR')}</strong><span className="text-xs font-semibold text-slate-500">Questões publicadas</span></div>
        <div className={`${PLATFORM_SURFACE_CARD_CLASS} p-5`}><FileText size={18} className="text-sky-600" /><strong className="mt-3 block text-2xl text-slate-950 dark:text-white">{examSummary.total.toLocaleString('pt-BR')}</strong><span className="text-xs font-semibold text-slate-500">Provas e concursos</span></div>
        <div className={`${PLATFORM_SURFACE_CARD_CLASS} p-5`}><CalendarDays size={18} className="text-emerald-600" /><strong className="mt-3 block text-2xl text-slate-950 dark:text-white">{examSummary.open.toLocaleString('pt-BR')}</strong><span className="text-xs font-semibold text-slate-500">Com inscrições abertas</span></div>
        <div className={`${PLATFORM_SURFACE_CARD_CLASS} p-5`}><CheckCircle2 size={18} className="text-slate-500" /><strong className="mt-3 block text-2xl text-slate-950 dark:text-white">{examSummary.completed.toLocaleString('pt-BR')}</strong><span className="text-xs font-semibold text-slate-500">Realizados</span></div>
      </section>

      <section className="grid gap-5 xl:grid-cols-[minmax(0,1.2fr)_minmax(320px,0.8fr)]">
        <div className={`${PLATFORM_SURFACE_CARD_CLASS} p-5 sm:p-6`}>
          <h2 className="text-base font-black text-slate-950 dark:text-white">Disciplinas mais presentes</h2>
          <p className="mt-1 text-xs leading-5 text-slate-500">Contagem objetiva nas questões públicas vinculadas à banca.</p>
          {detail.topSubjects.length ? (
            <div className="mt-5 space-y-4">
              {detail.topSubjects.map((subject) => (
                <div key={subject.id}>
                  <div className="flex items-center justify-between gap-3 text-xs">
                    <Link href={{ pathname: '/practice', query: { agency: board.acronym || board.name, materia: subject.name } }} className="min-w-0 truncate font-bold text-slate-700 hover:text-[#615fff] dark:text-slate-200">{subject.name}</Link>
                    <span className="shrink-0 font-black text-slate-500">{subject.questionCount.toLocaleString('pt-BR')}</span>
                  </div>
                  <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800"><div className="h-full rounded-full bg-[#615fff]" style={{ width: `${Math.max(4, (subject.questionCount / maxSubjectCount) * 100)}%` }} /></div>
                </div>
              ))}
            </div>
          ) : <p className="mt-5 text-sm text-slate-500">Ainda não há volume suficiente para calcular este recorte.</p>}
        </div>

        <div className={`${PLATFORM_SURFACE_CARD_CLASS} p-5 sm:p-6`}>
          <h2 className="text-base font-black text-slate-950 dark:text-white">Características na base</h2>
          <p className="mt-1 text-xs leading-5 text-slate-500">Perfil calculado, sem atribuir características não comprovadas à banca.</p>
          <div className="mt-5 space-y-5">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.15em] text-slate-400">Modalidade</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {Array.from(profileByModality.entries()).map(([modality, count]) => <span key={modality} className="rounded-md bg-indigo-50 px-3 py-2 text-xs font-bold text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-300">{modalityLabel(modality)} · {count.toLocaleString('pt-BR')}</span>)}
              </div>
            </div>
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.15em] text-slate-400">Dificuldade cadastrada</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {Array.from(profileByDifficulty.entries()).map(([difficulty, count]) => <span key={difficulty} className="rounded-md bg-slate-100 px-3 py-2 text-xs font-bold text-slate-700 dark:bg-slate-800 dark:text-slate-200">{difficultyLabel(difficulty)} · {count.toLocaleString('pt-BR')}</span>)}
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className={`${PLATFORM_SURFACE_CARD_CLASS} overflow-hidden`}>
        <div className="border-b border-slate-200 p-5 dark:border-slate-800 sm:p-6">
          <h2 className="text-lg font-black text-slate-950 dark:text-white">Concursos e provas da banca</h2>
          <p className="mt-1 text-xs leading-5 text-slate-500">O status usa as datas de inscrição, prova e resultado cadastradas em cada prova.</p>
          <nav className="mt-4 flex gap-2 overflow-x-auto pb-1" aria-label="Situação dos concursos">
            {STATUS_OPTIONS.map((option) => (
              <Link key={option.value} href={buildStatusHref(board.slug, option.value)} prefetch={false} aria-current={status === option.value ? 'page' : undefined} className={`inline-flex h-9 shrink-0 items-center rounded-md border px-3 text-xs font-black ${status === option.value ? 'border-[#615fff] bg-[#615fff] text-white' : 'border-slate-200 bg-white text-slate-600 hover:border-[#615fff]/40 hover:text-[#615fff] dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200'}`}>
                {option.label} · {examSummary[option.countKey].toLocaleString('pt-BR')}
              </Link>
            ))}
          </nav>
        </div>

        {detail.exams.length ? (
          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {detail.exams.map((exam) => (
              <article key={exam.id} className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={`rounded-md border px-2 py-1 text-[10px] font-black uppercase ${STATUS_CLASSES[exam.status]}`}>{STATUS_LABELS[exam.status]}</span>
                    {exam.year ? <span className="text-xs font-black text-slate-400">{exam.year}</span> : null}
                  </div>
                  <h3 className="mt-2 text-sm font-black leading-6 text-slate-950 dark:text-white"><Link href={`/blog/provas/${exam.slug}`} className="hover:text-[#615fff]">{exam.title}</Link></h3>
                  <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500">
                    {exam.organizations.length ? <span className="inline-flex items-center gap-1"><Building2 size={13} /> {exam.organizations.join(' / ')}</span> : null}
                    {exam.registrationStart && exam.registrationEnd ? <span>Inscrições: {formatDate(exam.registrationStart)} a {formatDate(exam.registrationEnd)}</span> : null}
                    {exam.examDate ? <span>Prova: {formatDate(exam.examDate)}</span> : null}
                    <span>{exam.questionCount.toLocaleString('pt-BR')} questões</span>
                  </div>
                </div>
                <Link href={`/blog/provas/${exam.slug}`} className="inline-flex h-10 shrink-0 items-center justify-center gap-1 rounded-md border border-slate-200 px-4 text-xs font-black text-slate-600 hover:border-[#615fff]/40 hover:text-[#615fff] dark:border-slate-700 dark:text-slate-200">Ver prova <ArrowRight size={14} /></Link>
              </article>
            ))}
          </div>
        ) : <div className="p-10 text-center text-sm font-semibold text-slate-500">Nenhuma prova encontrada neste status.</div>}

        {detail.pageInfo.pages > 1 ? (
          <nav className="flex items-center justify-between border-t border-slate-200 p-4 dark:border-slate-800" aria-label="Paginação de provas">
            {detail.pageInfo.hasPrevious ? <Link href={buildStatusHref(board.slug, status, detail.pageInfo.page - 1)} prefetch={false} className="text-xs font-black text-[#615fff] hover:underline">Anterior</Link> : <span className="text-xs font-black text-slate-300">Anterior</span>}
            <span className="text-xs font-bold text-slate-500">Página {detail.pageInfo.page} de {detail.pageInfo.pages}</span>
            {detail.pageInfo.hasMore ? <Link href={buildStatusHref(board.slug, status, detail.pageInfo.page + 1)} prefetch={false} className="text-xs font-black text-[#615fff] hover:underline">Próxima</Link> : <span className="text-xs font-black text-slate-300">Próxima</span>}
          </nav>
        ) : null}
      </section>
    </div>
  );
}
