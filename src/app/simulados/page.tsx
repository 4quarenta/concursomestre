import type { Metadata } from 'next';
import SimulationsDirectory from './SimulationsDirectory';
import { buildSimulationsDirectoryMetadata } from './simulationMetadata';

export const revalidate = 300;
type SearchParams = Record<string, string | string[] | undefined>;
export async function generateMetadata({ searchParams }: { searchParams: Promise<SearchParams> }): Promise<Metadata> {
  return buildSimulationsDirectoryMetadata(await searchParams);
}
export default function SimulationsPage({ searchParams }: { searchParams: Promise<{ pagina?: string; busca?: string }> }) {
  return <SimulationsDirectory searchParams={searchParams}/>;
}
