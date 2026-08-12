import type { Metadata } from 'next';
import PublicTaxonomyDirectory from '../taxonomias/PublicTaxonomyDirectory';

export const revalidate = 300;

export const metadata: Metadata = {
  title: 'Disciplinas para concursos',
  description: 'Encontre disciplinas com questões publicadas e pratique por matéria no ConcursoMestre.',
  alternates: { canonical: '/disciplinas' },
  openGraph: {
    title: 'Disciplinas para concursos',
    description: 'Explore disciplinas e resolva questões organizadas por matéria.',
    url: '/disciplinas',
    type: 'website',
  },
};

export default function SubjectsDirectoryPage({
  searchParams,
}: {
  searchParams: Promise<{ busca?: string; letra?: string; pagina?: string }>;
}) {
  return <PublicTaxonomyDirectory type="subjects" searchParams={searchParams} />;
}
