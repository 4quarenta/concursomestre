import Link from 'next/link';
import { Suspense } from 'react';
import { buildSiteUrl } from '@/config/siteUrl';
import { buildQuestionPath, summarizeSeoText } from '@services/seo';
import { publicRoutes } from '@services/routes/publicRoutes';
import { serializeStructuredData } from '@services/seo/structuredData';
import PracticeClient from './PracticeClient';
import { fetchPracticeInitialQuestions } from './practiceServerData';

type PracticePageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

const PracticePublicCollectionFallback = ({
  initialQuestionPage,
}: {
  initialQuestionPage: Awaited<ReturnType<typeof fetchPracticeInitialQuestions>>;
}) => (
  <section aria-labelledby="practice-public-collection-title" className="space-y-4 px-3 sm:px-4 md:px-0" data-hydration-interaction>
    <h2 id="practice-public-collection-title" className="text-xl font-black text-slate-900 dark:text-slate-100">
      Questões disponíveis
    </h2>
    <ul className="space-y-3">
      {initialQuestionPage.questions.map((question) => (
        <li key={String(question.id)}>
          <Link
            href={buildQuestionPath(question)}
            className="block rounded-md border border-slate-200 bg-white p-4 text-sm font-bold leading-6 text-slate-800 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-100"
          >
            {summarizeSeoText(question.enunciado_clean || question.enunciado || `Questão ${question.id}`, 180)}
          </Link>
        </li>
      ))}
    </ul>
  </section>
);

export default async function PracticePage({ searchParams }: PracticePageProps) {
  const resolvedSearchParams = searchParams ? await searchParams : {};
  const initialQuestionPage = await fetchPracticeInitialQuestions({
    searchParams: resolvedSearchParams,
  });
  const questionItems = initialQuestionPage.questions.slice(0, initialQuestionPage.pageInfo.limit);
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: 'Questões de concursos para praticar',
    description: 'Banco de questões organizado por banca, disciplina, assunto, cargo e ano.',
    url: buildSiteUrl(publicRoutes.questions.index()),
    inLanguage: 'pt-BR',
    mainEntity: {
      '@type': 'ItemList',
      numberOfItems: questionItems.length,
      itemListElement: questionItems.map((question, index) => ({
        '@type': 'ListItem',
        position: index + 1,
        name: summarizeSeoText(question.enunciado_clean || question.enunciado || `Questão ${question.id}`, 120),
        url: buildSiteUrl(buildQuestionPath(question)),
      })),
    },
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: serializeStructuredData(jsonLd) }}
      />
      <header
        className="space-y-4 px-3 pb-2 sm:px-4 md:px-0"
        data-practice-semantic-header
        data-semantic-content
      >
        <nav aria-label="Breadcrumb" className="flex items-center gap-2 text-xs font-bold text-slate-500 dark:text-slate-400">
          <Link href="/" className="transition-colors hover:text-indigo-600">Início</Link>
          <span aria-hidden="true">/</span>
          <span aria-current="page">Questões</span>
        </nav>
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-indigo-600 dark:text-indigo-300">Banco de questões</p>
          <h1 className="mt-2 text-2xl font-black tracking-tight text-slate-900 dark:text-slate-100 sm:text-3xl">
            Questões de concursos para praticar
          </h1>
          <p className="mt-2 max-w-3xl text-sm font-medium leading-6 text-slate-600 dark:text-slate-300">
            Resolva questões públicas e use filtros por disciplina, banca, assunto, cargo e ano para direcionar seus estudos.
          </p>
        </div>
        <nav aria-label="Explorar o acervo" className="flex flex-wrap gap-x-5 gap-y-2 text-sm font-bold text-indigo-700 dark:text-indigo-300">
          <Link href="/disciplinas" className="hover:underline">Disciplinas</Link>
          <Link href="/bancas" className="hover:underline">Bancas</Link>
          <Link href={publicRoutes.exams.index()} className="hover:underline">Provas</Link>
        </nav>
      </header>
      <Suspense fallback={<PracticePublicCollectionFallback initialQuestionPage={initialQuestionPage} />}>
        <PracticeClient initialQuestionPage={initialQuestionPage} semanticPageHeaderRendered />
      </Suspense>
    </>
  );
}
