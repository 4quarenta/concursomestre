import type { Metadata } from 'next';
import PracticePage from '../practice/PracticePage';
import { buildPublicPageMetadata } from '../seoMetadata';
import { publicRoutes } from '@services/routes/publicRoutes';

type SearchPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export const dynamic = 'force-dynamic';

const PATH = publicRoutes.search.index();
const TITLE = 'Busca de questões de concursos';
const DESCRIPTION = 'Pesquise questões públicas por palavra-chave e refine os resultados com os filtros de prática do ConcursoMestre.';

export const metadata: Metadata = buildPublicPageMetadata({
  title: TITLE,
  description: DESCRIPTION,
  path: PATH,
});

export default async function SearchPage({ searchParams }: SearchPageProps) {
  const resolvedSearchParams = searchParams ? await searchParams : {};
  const query = Array.isArray(resolvedSearchParams.q) ? resolvedSearchParams.q[0] : resolvedSearchParams.q;
  const normalizedSearchParams = query && !resolvedSearchParams.keyword
    ? { ...resolvedSearchParams, keyword: query }
    : resolvedSearchParams;

  return (
    <PracticePage
      searchParams={Promise.resolve(normalizedSearchParams)}
      semanticPage={{
        path: PATH,
        title: TITLE,
        description: DESCRIPTION,
        eyebrow: 'Busca no banco de questões',
        breadcrumbLabel: 'Busca',
      }}
    />
  );
}
