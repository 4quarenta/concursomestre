import type { Metadata } from 'next';
import PublicTaxonomyDirectory from '../taxonomias/PublicTaxonomyDirectory';
import { buildTaxonomyDirectoryMetadata, type DirectoryMetadataSearchParams } from '../taxonomias/directoryMetadata';

export const revalidate = 300;

export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<DirectoryMetadataSearchParams>;
}): Promise<Metadata> {
  return buildTaxonomyDirectoryMetadata({
    title: 'Bancas de concursos',
    description: 'Consulte bancas organizadoras e pratique com questões publicadas de cada banca.',
    path: '/bancas',
    searchParams: await searchParams,
  });
}

export default function BoardsDirectoryPage({
  searchParams,
}: {
  searchParams: Promise<{ busca?: string; letra?: string; pagina?: string }>;
}) {
  return <PublicTaxonomyDirectory type="boards" searchParams={searchParams} />;
}
