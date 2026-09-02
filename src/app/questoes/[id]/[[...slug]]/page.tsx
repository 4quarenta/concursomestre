import type { Metadata } from 'next';
import { notFound, permanentRedirect } from 'next/navigation';
import QuestionPublicPage from '@/app/question/QuestionPublicPage';
import { buildQuestionMetaDescription, buildQuestionMetaTitle } from '@/app/question/questionSeo';
import CanonicalBreadcrumbs from '@/components/seo/CanonicalBreadcrumbs';
import StructuredData from '@/components/seo/StructuredData';
import { buildQuestionMetadata } from '@/app/question/questionPageMetadata';
import { fetchPublicQuestionRoute } from '@/app/question/questionServerResolver';
import { publicRoutes, sanitizePublicRouteQuery } from '@services/routes/publicRoutes';
import { buildBreadcrumbList, buildStructuredDataGraph, buildWebPage } from '@services/seo/structuredData';

type QuestionPageParams = {
  id?: string;
  slug?: string[];
};

export async function generateMetadata({ params }: { params: Promise<QuestionPageParams> }): Promise<Metadata> {
  const resolvedParams = await params;
  return buildQuestionMetadata(await fetchPublicQuestionRoute(resolvedParams.id));
}

export default async function FutureQuestionPage({
  params,
  searchParams,
}: {
  params: Promise<QuestionPageParams>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const resolvedParams = await params;
  const resolution = await fetchPublicQuestionRoute(resolvedParams.id);
  if (!resolution) {
    notFound();
  }
  if (resolution.question.id === undefined) {
    notFound();
  }

  const requestedSlug = Array.isArray(resolvedParams.slug) ? resolvedParams.slug.join('/') : '';
  if (requestedSlug !== resolution.futureSlug) {
    const query = sanitizePublicRouteQuery('question_detail', searchParams ? await searchParams : {});
    permanentRedirect(publicRoutes.questions.detail(
      resolution.question.id,
      resolution.futureSlug,
      query,
    ));
  }

  const breadcrumbs = [
    { label: 'Início', path: '/' },
    { label: 'Questões', path: publicRoutes.questions.index() },
    { label: `Questão ${resolution.question.id}`, path: resolution.futurePath },
  ];
  const structuredData = buildStructuredDataGraph([
    buildWebPage({
      path: resolution.futurePath,
      name: buildQuestionMetaTitle(resolution.question),
      description: buildQuestionMetaDescription(resolution.question),
    }),
    buildBreadcrumbList(breadcrumbs),
  ]);

  return (
    <>
      <StructuredData value={structuredData} />
      <div className="mx-auto w-full max-w-[1600px] px-4 pt-5 sm:px-6 lg:px-8">
        <CanonicalBreadcrumbs items={breadcrumbs} />
      </div>
      <QuestionPublicPage initialQuestion={resolution.question} routeFamily="future" />
    </>
  );
}
