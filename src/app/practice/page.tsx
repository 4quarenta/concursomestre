import { permanentRedirect } from 'next/navigation';
import { publicRoutes, sanitizePublicRouteQuery } from '@services/routes/publicRoutes';

type PracticePageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export const dynamic = 'force-dynamic';

export default async function PracticeAliasPage({ searchParams }: PracticePageProps) {
  const resolvedSearchParams = searchParams ? await searchParams : {};
  permanentRedirect(publicRoutes.questions.index(
    sanitizePublicRouteQuery('questions_hub', resolvedSearchParams),
  ));
}
