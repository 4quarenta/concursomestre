import type { Metadata } from 'next';
import { buildPublicPageMetadata } from '../seoMetadata';
import { publicRoutes } from '@services/routes/publicRoutes';
import GlobalSearchResults from './GlobalSearchResults';
import { fetchGlobalSearchResults } from './globalSearchServerData';

type SearchPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export const dynamic = 'force-dynamic';

const PATH = publicRoutes.search.index();
const TITLE = 'Busca global no ConcursoMestre';
const DESCRIPTION = 'Pesquise questões, provas, notícias, disciplinas, assuntos e outros conteúdos públicos do ConcursoMestre.';

export const metadata: Metadata = buildPublicPageMetadata({
  title: TITLE,
  description: DESCRIPTION,
  path: PATH,
});

export default async function SearchPage({ searchParams }: SearchPageProps) {
  const resolvedSearchParams = searchParams ? await searchParams : {};
  const rawQuery = resolvedSearchParams.q ?? resolvedSearchParams.keyword ?? resolvedSearchParams.busca;
  const query = (Array.isArray(rawQuery) ? rawQuery[0] : rawQuery || '').trim().slice(0, 120);
  const results = await fetchGlobalSearchResults(query);

  return <GlobalSearchResults query={query} results={results} />;
}
