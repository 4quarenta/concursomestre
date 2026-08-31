import type { ReactNode } from 'react';
import { buildPublicPageMetadata } from '../seoMetadata';

export const metadata = buildPublicPageMetadata({
  title: 'Lei Comentada',
  description: 'Estude legislação para concursos com texto oficial, comentários, jurisprudência, macetes e atualizações monitoradas.',
  path: '/lei-comentada',
});

export default function LeiComentadaLayout({ children }: Readonly<{ children: ReactNode }>) {
  return children;
}
