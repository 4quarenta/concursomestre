import { permanentRedirect } from 'next/navigation';
import { publicRoutes, sanitizePublicRouteQuery } from '@services/routes/publicRoutes';

type QuestionsAliasPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function QuestionsAliasPage({ searchParams }: QuestionsAliasPageProps) {
  const resolvedSearchParams = searchParams ? await searchParams : {};
  permanentRedirect(publicRoutes.questions.index(
    sanitizePublicRouteQuery('questions_hub', resolvedSearchParams),
  ));
}
