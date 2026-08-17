import type { Metadata } from 'next';
import { notFound, permanentRedirect } from 'next/navigation';
import QuestionPublicPage from '@/app/question/QuestionPublicPage';
import { buildQuestionMetadata } from '@/app/question/questionPageMetadata';
import { fetchPublicQuestionRoute } from '@/app/question/questionServerResolver';
import { publicRoutes, sanitizePublicRouteQuery } from '@services/routes/publicRoutes';
import { buildAbsoluteUrl } from '@services/seo/slug';

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

  const requestedSlug = Array.isArray(resolvedParams.slug) ? resolvedParams.slug.join('/') : '';
  if (requestedSlug !== resolution.futureSlug) {
    const query = sanitizePublicRouteQuery('question_detail', searchParams ? await searchParams : {});
    permanentRedirect(publicRoutes.questions.detail(
      resolution.question.id,
      resolution.futureSlug,
      query,
    ));
  }

  return (
    <QuestionPublicPage
      initialQuestion={resolution.question}
      routeFamily="future"
      canonicalUrl={buildAbsoluteUrl(resolution.futurePath)}
    />
  );
}
