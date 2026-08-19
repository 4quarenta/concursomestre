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
    title: 'Órgãos públicos e concursos',
    description: 'Consulte órgãos públicos e encontre questões e provas relacionadas no ConcursoMestre.',
    path: '/orgaos',
    searchParams: await searchParams,
  });
}

export default function OrganizationsDirectoryPage({
  searchParams,
}: {
  searchParams: Promise<{ busca?: string; letra?: string; pagina?: string }>;
}) {
  return <PublicTaxonomyDirectory type="organizations" searchParams={searchParams} />;
}
