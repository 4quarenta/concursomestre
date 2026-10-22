import Link from 'next/link';
import { Suspense } from 'react';
import PlatformPageHeader from '@/components/shared/layout/PlatformPageHeader';
import StructuredData from '@/components/seo/StructuredData';
import { buildQuestionPath, summarizeSeoText } from '@services/seo';
import { publicRoutes } from '@services/routes/publicRoutes';
import { buildBreadcrumbList, buildCollectionPage, buildItemList, buildStructuredDataGraph } from '@services/seo/structuredData';
import PracticeClient from './PracticeClient';
import { fetchPracticeInitialQuestions } from './practiceServerData';

type PracticePageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
  semanticPage?: {
    path: string;
    title: string;
    description: string;
    eyebrow: string;
    breadcrumbLabel: string;
  };
};

const DEFAULT_SEMANTIC_PAGE = {
  path: publicRoutes.questions.index(),
  title: 'Questões',
  description: 'Resolva questões de concursos e filtre o banco por matéria, banca, assunto, cargo, dificuldade e ano.',
  eyebrow: 'Banco de questões',
  breadcrumbLabel: 'Questões',
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

export default async function PracticePage({ searchParams, semanticPage = DEFAULT_SEMANTIC_PAGE }: PracticePageProps) {
  const resolvedSearchParams = searchParams ? await searchParams : {};
  const initialQuestionPage = await fetchPracticeInitialQuestions({
    searchParams: resolvedSearchParams,
  });
  const questionItems = initialQuestionPage.questions.slice(0, initialQuestionPage.pageInfo.limit);
  const path = semanticPage.path;
  const breadcrumbs = [{ label: 'Início', path: '/' }, { label: semanticPage.breadcrumbLabel, path }];
  const itemList = buildItemList(questionItems.map((question) => ({
    name: summarizeSeoText(question.enunciado_clean || question.enunciado || `Questão ${question.id}`, 120),
    path: buildQuestionPath(question),
  })));
  const jsonLd = buildStructuredDataGraph([
    { ...buildCollectionPage({ path, name: semanticPage.title, description: semanticPage.description }), mainEntity: itemList },
    buildBreadcrumbList(breadcrumbs),
  ]);

  return (
    <>
      <StructuredData value={jsonLd} />
      <PlatformPageHeader
        title={semanticPage.title}
        description={semanticPage.description}
        eyebrow={semanticPage.path === publicRoutes.questions.index() ? undefined : semanticPage.eyebrow}
        breadcrumbs={breadcrumbs}
        className="pb-2"
        practiceHeader
        footer={semanticPage.path === publicRoutes.questions.index() ? undefined : (
          <nav aria-label="Explorar o acervo" className="flex flex-wrap gap-x-5 gap-y-2 text-sm font-bold text-indigo-700 dark:text-indigo-300">
            <Link href={publicRoutes.disciplines.index()} className="hover:underline">Disciplinas</Link>
            <Link href={publicRoutes.boards.index()} className="hover:underline">Bancas</Link>
            <Link href={publicRoutes.exams.index()} className="hover:underline">Provas</Link>
          </nav>
        )}
      />
      <Suspense fallback={<PracticePublicCollectionFallback initialQuestionPage={initialQuestionPage} />}>
        <PracticeClient initialQuestionPage={initialQuestionPage} semanticPageHeaderRendered />
      </Suspense>
    </>
  );
}
