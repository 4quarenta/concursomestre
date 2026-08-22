import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound, permanentRedirect } from 'next/navigation';
import { Building2, CalendarDays, ExternalLink, FileQuestion, FileText, Landmark, ListChecks, WalletCards } from 'lucide-react';
import CanonicalBreadcrumbs from '@/components/seo/CanonicalBreadcrumbs';
import StructuredData from '@/components/seo/StructuredData';
import { PLATFORM_PAGE_DESCRIPTION_CLASS, PLATFORM_PAGE_TITLE_CLASS, PLATFORM_SURFACE_CARD_CLASS } from '@constants/layout';
import { buildBreadcrumbList, buildItemList, buildStructuredDataGraph, buildWebPage } from '@services/seo/structuredData';
import { buildContestMetadata, contestDescription, contestStatusLabel } from '../contestMetadata';
import { fetchPublicContestForServer, type PublicContest } from '../contestServerData';

export const revalidate = 300;
type Props = { params: Promise<{ slug: string }> };
const money = (value: number | null) => value == null ? null : new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
const date = (value: string | null | undefined) => value ? new Intl.DateTimeFormat('pt-BR', { dateStyle: 'long', timeZone: 'America/Sao_Paulo' }).format(new Date(value)) : null;
const load = async (slug: string): Promise<PublicContest | null> => {
  const result = await fetchPublicContestForServer(slug);
  if (result && 'redirectSlug' in result) {
    permanentRedirect(`/concursos/${encodeURIComponent(result.redirectSlug)}`);
  }
  return result && !('redirectSlug' in result) ? result : null;
};
export async function generateMetadata({ params }: Props): Promise<Metadata> { const { slug } = await params; return buildContestMetadata(await load(slug)); }

export default async function ContestDetailPage({ params }: Props) {
  const { slug } = await params; const contest = await load(slug); if (!contest) notFound();
  const description = contestDescription(contest);
  const breadcrumbs = contest.breadcrumbs.map((item) => ({ label: item.label, path: item.canonicalPath }));
  const structuredData = buildStructuredDataGraph([
    buildWebPage({ path: contest.canonicalPath, name: contest.title, description }),
    buildBreadcrumbList(breadcrumbs),
    ...(contest.exams.length ? [buildItemList(contest.exams.map((item) => ({ name: item.title, path: item.path })))] : []),
  ]);
  return <article data-semantic-content className="w-full space-y-5 animate-fade-in">
    <StructuredData value={structuredData} />
    <CanonicalBreadcrumbs items={breadcrumbs} />
    <header className={`${PLATFORM_SURFACE_CARD_CLASS} p-5 sm:p-6`}>
      <p className="text-xs font-black text-indigo-700 dark:text-indigo-300">{contestStatusLabel(contest.status, contest.isOpen)}</p>
      <h1 className={`mt-2 ${PLATFORM_PAGE_TITLE_CLASS}`}>{contest.title}</h1>
      <p className={`mt-3 max-w-4xl ${PLATFORM_PAGE_DESCRIPTION_CLASS}`}>{description}</p>
      <div className="mt-4 flex flex-wrap gap-2 text-xs font-bold text-slate-600 dark:text-slate-300">
        {contest.year ? <span className="inline-flex items-center gap-1.5 rounded-md border border-slate-200 px-3 py-2 dark:border-slate-700"><CalendarDays size={14} /> {contest.year}</span> : null}
        {contest.organizations.map((item) => <Link key={item.id} href={item.path} className="inline-flex items-center gap-1.5 rounded-md border border-slate-200 px-3 py-2 hover:text-[#615fff] dark:border-slate-700"><Building2 size={14} /> {item.acronym || item.name}</Link>)}
        {contest.board ? <Link href={contest.board.path} className="inline-flex items-center gap-1.5 rounded-md border border-slate-200 px-3 py-2 hover:text-[#615fff] dark:border-slate-700"><Landmark size={14} /> {contest.board.acronym || contest.board.name}</Link> : null}
        {contest.officialUrl ? <a href={contest.officialUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 rounded-md border border-slate-200 px-3 py-2 hover:text-[#615fff] dark:border-slate-700">Página oficial <ExternalLink size={13} /></a> : null}
      </div>
    </header>
    <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4" aria-label="Datas do concurso">{[
      ['Edital', contest.dates.noticePublishedAt], ['Início das inscrições', contest.dates.registrationStartAt], ['Fim das inscrições', contest.dates.registrationEndAt], ['Prova', contest.dates.examStartAt],
    ].filter(([, value]) => value).map(([label, value]) => <div key={label} className={`${PLATFORM_SURFACE_CARD_CLASS} p-4`}><p className="text-xs font-bold text-slate-500">{label}</p><p className="mt-2 text-sm font-black text-slate-900 dark:text-white">{date(value)}</p></div>)}</section>
    {contest.positions.length ? <section className={`${PLATFORM_SURFACE_CARD_CLASS} p-5 sm:p-6`} aria-labelledby="positions-title"><h2 id="positions-title" className="flex items-center gap-2 text-base font-black text-slate-950 dark:text-white"><WalletCards size={17} className="text-[#615fff]" /> Cargos e ofertas</h2><div className="mt-4 grid gap-3 md:grid-cols-2">{contest.positions.map((position) => <div key={position.id} className="rounded-md border border-slate-200 p-4 dark:border-slate-700"><h3 className="font-black text-slate-900 dark:text-white"><Link href={position.path} className="hover:text-[#615fff]">{position.name}</Link></h3><p className="mt-2 text-xs leading-5 text-slate-500">{[position.vacancies != null ? `${position.vacancies} vaga(s)` : null, position.reserveRegistry ? 'cadastro reserva' : null, position.educationLevel, position.weeklyHours ? `${position.weeklyHours}h semanais` : null, position.locationLabel].filter(Boolean).join(' · ') || 'Detalhes públicos em atualização'}</p>{position.salaryMin != null || position.salaryMax != null ? <p className="mt-2 text-xs font-bold text-emerald-700 dark:text-emerald-300">Remuneração: {[money(position.salaryMin), money(position.salaryMax)].filter(Boolean).join(' a ')}</p> : null}</div>)}</div></section> : null}
    {contest.documents.length ? <section className={`${PLATFORM_SURFACE_CARD_CLASS} p-5 sm:p-6`} aria-labelledby="documents-title"><h2 id="documents-title" className="flex items-center gap-2 text-base font-black text-slate-950 dark:text-white"><FileText size={17} className="text-[#615fff]" /> Editais e documentos</h2><div className="mt-4 space-y-2">{contest.documents.map((document) => <a key={document.id} href={document.url} target="_blank" rel="noopener noreferrer" className="flex items-center justify-between gap-3 rounded-md border border-slate-200 px-3 py-2.5 text-sm font-bold hover:text-[#615fff] dark:border-slate-700"><span>{document.title}</span><ExternalLink size={14} /></a>)}</div></section> : null}
    <section className="grid gap-5 xl:grid-cols-2" aria-label="Prática relacionada">
      <div className={`${PLATFORM_SURFACE_CARD_CLASS} p-5 sm:p-6`}><h2 className="flex items-center gap-2 text-base font-black text-slate-950 dark:text-white"><FileText size={17} className="text-[#615fff]" /> Provas relacionadas</h2>{contest.exams.length ? <div className="mt-4 space-y-2">{contest.exams.map((exam) => <Link key={exam.id} href={exam.path} className="flex items-center justify-between gap-3 rounded-md border border-slate-200 px-3 py-2.5 text-sm font-bold hover:text-[#615fff] dark:border-slate-700"><span>{exam.title}</span><span className="text-xs text-slate-500">{exam.questionCount} questões</span></Link>)}</div> : <p className="mt-3 text-sm text-slate-500">Ainda não há prova pública explicitamente vinculada.</p>}</div>
      <div className={`${PLATFORM_SURFACE_CARD_CLASS} p-5 sm:p-6`}><h2 className="flex items-center gap-2 text-base font-black text-slate-950 dark:text-white"><FileQuestion size={17} className="text-[#615fff]" /> Questões relacionadas</h2><p className="mt-2 text-xs text-slate-500">{contest.questionCount.toLocaleString('pt-BR')} questão(ões) em provas explicitamente vinculadas.</p>{contest.questions.length ? <ol className="mt-3 space-y-2">{contest.questions.map((question) => <li key={question.id}><Link href={question.path} className="line-clamp-2 text-sm font-semibold hover:text-[#615fff]">{question.excerpt || `Questão ${question.id}`}</Link></li>)}</ol> : <p className="mt-3 text-sm text-slate-500">As questões serão exibidas quando houver prova pública associada.</p>}{contest.exams.length ? <Link href={contest.exams[0].path} className="mt-4 inline-flex items-center gap-2 rounded-md bg-[#615fff] px-4 py-2.5 text-sm font-black text-white"><ListChecks size={15} /> Ver provas deste concurso</Link> : null}</div>
    </section>
  </article>;
}
