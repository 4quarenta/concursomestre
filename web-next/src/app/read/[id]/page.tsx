import type { Metadata } from 'next';
import MaterialReaderClient from '@/components/reader/MaterialReaderClient';

export const metadata: Metadata = {
  title: 'Leitor de material | ConcursoMestre',
  description: 'Leitor protegido de materiais adquiridos no ConcursoMestre.',
  robots: {
    index: false,
    follow: false,
  },
};

export default async function ReadPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  return <MaterialReaderClient materialId={id} />;
}
