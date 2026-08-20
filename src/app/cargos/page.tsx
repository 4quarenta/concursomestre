import type { Metadata } from 'next';
import { buildTaxonomyDirectoryMetadata, type DirectoryMetadataSearchParams } from '../taxonomias/directoryMetadata';
import ProfessionalDirectory from '../profissoes/ProfessionalDirectory';

export const revalidate = 300;
export async function generateMetadata({ searchParams }: { searchParams: Promise<DirectoryMetadataSearchParams> }): Promise<Metadata> {
  return buildTaxonomyDirectoryMetadata({ title: 'Cargos públicos', description: 'Encontre cargos e acesse concursos, provas e questões relacionadas no ConcursoMestre.', path: '/cargos', searchParams: await searchParams });
}
export default function PositionsPage({ searchParams }: { searchParams: Promise<{ pagina?: string; busca?: string; letra?: string }> }) { return <ProfessionalDirectory kind="position" searchParams={searchParams}/>; }
