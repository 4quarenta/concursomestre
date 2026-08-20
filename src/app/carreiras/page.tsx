import type { Metadata } from 'next';
import { buildTaxonomyDirectoryMetadata, type DirectoryMetadataSearchParams } from '../taxonomias/directoryMetadata';
import ProfessionalDirectory from '../profissoes/ProfessionalDirectory';

export const revalidate = 300;
export async function generateMetadata({ searchParams }: { searchParams: Promise<DirectoryMetadataSearchParams> }): Promise<Metadata> {
  return buildTaxonomyDirectoryMetadata({ title: 'Carreiras públicas', description: 'Explore carreiras, cargos e concursos relacionados no ConcursoMestre.', path: '/carreiras', searchParams: await searchParams });
}
export default function CareersPage({ searchParams }: { searchParams: Promise<{ pagina?: string; busca?: string; letra?: string }> }) { return <ProfessionalDirectory kind="career" searchParams={searchParams}/>; }
