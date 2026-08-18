import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import {
  ArrowRight,
  BookOpen,
  ChevronRight,
  FileQuestion,
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
import { buildDisciplineMetadata } from '../disciplineMetadata';
import { fetchPublicDisciplineForServer } from '../disciplineServerData';

export const revalidate = 300;

type DisciplinePageProps = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: DisciplinePageProps): Promise<Metadata> {
  const { slug } = await params;
  return buildDisciplineMetadata(await fetchPublicDisciplineForServer(slug));
}

export default async function DisciplinePage({ params }: DisciplinePageProps) {
  const { slug } = await params;
  const discipline = await fetchPublicDisciplineForServer(slug);
  if (!discipline) notFound();

  const canonicalUrl = buildSiteUrl(discipline.canonicalPath);
  const description = discipline.description || undefined;
  const breadcrumbItems = discipline.breadcrumbs.map((item, index) => ({
    '@type': 'ListItem',
    position: index + 1,
    name: item.label,
    item: buildSiteUrl(item.canonicalPath),
  }));
  const questionItems = discipline.questions.map((question, index) => ({
    '@type': 'ListItem',
    position: index + 1,
    name: question.excerpt || `Questão ${question.id}`,
    url: buildSiteUrl(question.path),
  }));
  const structuredData = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'CollectionPage',
        '@id': `${canonicalUrl}#webpage`,
        url: canonicalUrl,
        name: `Questões de ${discipline.name}`,
        description,
        mainEntity: questionItems.length > 0 ? { '@id': `${canonicalUrl}#questions` } : undefined,
      },
      {
        '@type': 'BreadcrumbList',
        '@id': `${canonicalUrl}#breadcrumb`,
        itemListElement: breadcrumbItems,
      },
      ...(questionItems.length > 0 ? [{
        '@type': 'ItemList',
        '@id': `${canonicalUrl}#questions`,
        numberOfItems: questionItems.length,
        itemListElement: questionItems,
      }] : []),
    ],
  };

  return (
    <article data-semantic-content className="w-full animate-fade-in space-y-5">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: serializeStructuredData(structuredData) }} />

      <nav data-breadcrumbs aria-label="Breadcrumb" className="flex flex-wrap items-center gap-1.5 text-xs font-bold text-slate-500">
        {discipline.breadcrumbs.map((item, index) => (
          <span key={`${item.canonicalPath}-${item.label}`} className="inline-flex items-center gap-1.5">
            {index > 0 ? <ChevronRight size={12} aria-hidden="true" /> : null}
            {index === discipline.breadcrumbs.length - 1
              ? <span aria-current="page" className="text-slate-700 dark:text-slate-200">{item.label}</span>
              : <Link href={item.canonicalPath} prefetch={false} className="hover:text-[#615fff] hover:underline">{item.label}</Link>}
          </span>
        ))}
      </nav>

      <header className={`${PLATFORM_SURFACE_CARD_CLASS} p-5 sm:p-6`}>
        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-indigo-700 dark:text-indigo-300">Disciplina</p>
        <h1 className={`mt-2 ${PLATFORM_PAGE_TITLE_CLASS}`}>Questões de {discipline.name}</h1>
        {description ? <p className={`mt-3 max-w-4xl ${PLATFORM_PAGE_DESCRIPTION_CLASS}`}>{description}</p> : null}
        <div className="mt-5 flex flex-wrap items-center gap-3">
          <Link href={discipline.questionsPath} prefetch={false} className="inline-flex h-10 items-center gap-2 rounded-md bg-[#615fff] px-4 text-xs font-black text-white hover:bg-[#514dff]">
            <ListChecks size={15} /> Ver todas as questões
          </Link>
          <span className="inline-flex h-10 items-center gap-2 rounded-md border border-slate-200 bg-white px-4 text-xs font-black text-slate-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200">
            <FileQuestion size={15} className="text-[#615fff]" /> {discipline.questionCount.toLocaleString('pt-BR')} questões públicas
          </span>
        </div>
      </header>

      {discipline.topics.length > 0 ? (
        <section className={`${PLATFORM_SURFACE_CARD_CLASS} p-5 sm:p-6`} aria-labelledby="discipline-topics-title">
          <h2 id="discipline-topics-title" className="text-base font-black text-slate-950 dark:text-white">Tópicos relacionados</h2>
          <p className="mt-1 text-xs leading-5 text-slate-500">Relações diretas cadastradas nesta disciplina.</p>
          <div className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
            {discipline.topics.map((topic) => (
              <Link key={topic.id} href={topic.questionsPath} prefetch={false} className="flex min-h-16 items-center gap-3 rounded-md border border-slate-200 px-4 py-3 hover:border-[#615fff]/40 hover:text-[#615fff] dark:border-slate-800">
                <BookOpen size={16} className="shrink-0" />
                <span className="min-w-0 flex-1"><strong className="block truncate text-sm">{topic.name}</strong><span className="text-xs text-slate-500">{topic.questionCount.toLocaleString('pt-BR')} questões</span></span>
                <ChevronRight size={14} className="shrink-0 text-slate-400" />
              </Link>
            ))}
          </div>
        </section>
      ) : null}

      <section className={`${PLATFORM_SURFACE_CARD_CLASS} p-5 sm:p-6`} aria-labelledby="discipline-questions-title">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div><h2 id="discipline-questions-title" className="text-base font-black text-slate-950 dark:text-white">Questões recentes</h2><p className="mt-1 text-xs leading-5 text-slate-500">Primeira coleção pública vinculada à disciplina.</p></div>
          <Link href={discipline.questionsPath} prefetch={false} className="inline-flex items-center gap-1 text-xs font-black text-[#615fff] hover:underline">Abrir ferramenta <ArrowRight size={13} /></Link>
        </div>
        {discipline.questions.length > 0 ? (
          <ol className="mt-4 divide-y divide-slate-100 dark:divide-slate-800">
            {discipline.questions.map((question) => (
              <li key={question.id} className="py-3 first:pt-0 last:pb-0">
                <Link href={question.path} prefetch={false} className="group flex items-start gap-3">
                  <span className="grid h-8 w-8 shrink-0 place-items-center rounded-md bg-indigo-50 text-xs font-black text-[#615fff] dark:bg-indigo-500/10">{question.id}</span>
                  <span className="line-clamp-3 text-sm font-semibold leading-6 text-slate-700 group-hover:text-[#615fff] dark:text-slate-200">{question.excerpt || `Questão ${question.id}`}</span>
                </Link>
              </li>
            ))}
          </ol>
        ) : <p className="mt-4 text-sm text-slate-500">Nenhuma questão pública disponível nesta coleção.</p>}
      </section>

      {(discipline.boards.length > 0 || discipline.exams.length > 0) ? (
        <section className="grid gap-5 xl:grid-cols-2" aria-label="Relações da disciplina">
          {discipline.boards.length > 0 ? (
            <div className={`${PLATFORM_SURFACE_CARD_CLASS} p-5 sm:p-6`}><h2 className="flex items-center gap-2 text-base font-black text-slate-950 dark:text-white"><Landmark size={17} className="text-[#615fff]" /> Bancas relacionadas</h2><div className="mt-4 flex flex-wrap gap-2">{discipline.boards.map((board) => <Link key={board.id} href={board.path} prefetch={false} className="rounded-md border border-slate-200 px-3 py-2 text-xs font-bold text-slate-700 hover:border-[#615fff]/40 hover:text-[#615fff] dark:border-slate-700 dark:text-slate-200">{board.acronym || board.name} · {board.questionCount.toLocaleString('pt-BR')}</Link>)}</div></div>
          ) : null}
          {discipline.exams.length > 0 ? (
            <div className={`${PLATFORM_SURFACE_CARD_CLASS} p-5 sm:p-6`}><h2 className="flex items-center gap-2 text-base font-black text-slate-950 dark:text-white"><FileText size={17} className="text-[#615fff]" /> Provas relacionadas</h2><div className="mt-4 space-y-2">{discipline.exams.map((exam) => <Link key={exam.id} href={exam.path} prefetch={false} className="flex items-center justify-between gap-3 rounded-md border border-slate-200 px-3 py-2.5 text-xs font-bold text-slate-700 hover:border-[#615fff]/40 hover:text-[#615fff] dark:border-slate-700 dark:text-slate-200"><span className="min-w-0 truncate">{exam.name}</span><span className="shrink-0 text-slate-500">{exam.year || 'Ano não informado'} · {exam.questionCount.toLocaleString('pt-BR')}</span></Link>)}</div></div>
          ) : null}
        </section>
      ) : null}
    </article>
  );
}
