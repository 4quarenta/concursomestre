import type { Metadata } from 'next';
import { buildPublicPageMetadata } from '../seoMetadata';
import { launchModeRobots } from '@services/seo/launchControl';
import ContestDirectoryView from '../concursos/ContestDirectoryView';
import { fetchContestDirectoryForServer } from '../concursos/contestServerData';

export const revalidate = 300;
type Search = { pagina?: string; busca?: string; ano?: string };
export async function generateMetadata({ searchParams }: { searchParams: Promise<Search> }): Promise<Metadata> {
  const params = await searchParams;
  const metadata = buildPublicPageMetadata({ title: 'Concursos abertos', description: 'Consulte concursos canônicos com inscrições comprovadamente abertas e seus dados públicos.', path: '/concursos-abertos' });
  return Object.keys(params).length > 0 ? { ...metadata, robots: launchModeRobots(true) } : metadata;
}
export default async function OpenContestsPage({ searchParams }: { searchParams: Promise<Search> }) {
  const params = await searchParams;
  return <ContestDirectoryView openOnly directory={await fetchContestDirectoryForServer(params, true)} search={params.busca} year={params.ano} />;
}
