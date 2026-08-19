import type { Metadata } from 'next';
import { buildPublicPageMetadata } from '../seoMetadata';
import { launchModeRobots } from '@services/seo/launchControl';
import ContestDirectoryView from './ContestDirectoryView';
import { fetchContestDirectoryForServer } from './contestServerData';

export const revalidate = 300;
type Search = { pagina?: string; busca?: string; ano?: string; status?: string };
const functional = (value: Search) => Object.keys(value).length > 0;
export async function generateMetadata({ searchParams }: { searchParams: Promise<Search> }): Promise<Metadata> {
  const params = await searchParams;
  const metadata = buildPublicPageMetadata({ title: 'Concursos públicos', description: 'Acompanhe concursos, editais, cargos, provas e questões em um catálogo de entidades reais.', path: '/concursos' });
  return functional(params) ? { ...metadata, robots: launchModeRobots(true) } : metadata;
}
export default async function ContestsPage({ searchParams }: { searchParams: Promise<Search> }) {
  const params = await searchParams;
  return <ContestDirectoryView directory={await fetchContestDirectoryForServer(params)} search={params.busca} year={params.ano} status={params.status} />;
}
