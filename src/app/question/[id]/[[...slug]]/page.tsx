import { notFound, permanentRedirect } from 'next/navigation';
import { fetchPublicQuestionRoute } from '../../questionServerResolver';
import { publicRoutes, sanitizePublicRouteQuery } from '@services/routes/publicRoutes';

type QuestionPageParams = {
  id?: string;
  slug?: string[];
};

export default async function LegacyQuestionRedirect({
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

  const query = sanitizePublicRouteQuery('question_detail', searchParams ? await searchParams : {});
  permanentRedirect(publicRoutes.questions.detail(
    resolution.question.id,
    resolution.futureSlug,
    query,
  ));
}
