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
    title: 'Disciplinas para concursos',
    description: 'Encontre disciplinas com questões publicadas e pratique por matéria no ConcursoMestre.',
    path: '/disciplinas',
    searchParams: await searchParams,
  });
}

export default function SubjectsDirectoryPage({
  searchParams,
}: {
  searchParams: Promise<{ busca?: string; letra?: string; pagina?: string }>;
}) {
  return <PublicTaxonomyDirectory type="subjects" searchParams={searchParams} />;
}
