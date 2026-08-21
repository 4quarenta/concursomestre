import type { Metadata } from 'next';
import MaterialsDirectory from './MaterialsDirectory';
import { buildMaterialsDirectoryMetadata } from './materialMetadata';

export const revalidate = 300;
type SearchParams = Record<string, string | string[] | undefined>;
export async function generateMetadata({ searchParams }: { searchParams: Promise<SearchParams> }): Promise<Metadata> {
  return buildMaterialsDirectoryMetadata(await searchParams);
}
export default function MaterialsPage({ searchParams }: { searchParams: Promise<{ pagina?: string; busca?: string }> }) {
  return <MaterialsDirectory searchParams={searchParams}/>;
}
