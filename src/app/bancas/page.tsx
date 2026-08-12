import type { Metadata } from 'next';
import PublicTaxonomyDirectory from '../taxonomias/PublicTaxonomyDirectory';

export const revalidate = 300;

export const metadata: Metadata = {
  title: 'Bancas de concursos',
  description: 'Consulte bancas organizadoras e pratique com questões publicadas de cada banca.',
  alternates: { canonical: '/bancas' },
  openGraph: {
    title: 'Bancas de concursos',
    description: 'Conheça as bancas e resolva questões pelo perfil de cobrança.',
    url: '/bancas',
    type: 'website',
  },
};

export default function BoardsDirectoryPage({
  searchParams,
}: {
  searchParams: Promise<{ busca?: string; letra?: string; pagina?: string }>;
}) {
  return <PublicTaxonomyDirectory type="boards" searchParams={searchParams} />;
}
