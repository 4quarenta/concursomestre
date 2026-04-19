import type { ReactNode } from 'react';
import { buildPublicPageMetadata } from '../seoMetadata';

export const metadata = buildPublicPageMetadata({
  title: 'Lei comentada',
  description: 'Estude legislacao para concursos com leitura orientada, comentarios e conexao com questoes da plataforma.',
  path: '/lei-comentada',
});

export default function LeiComentadaLayout({ children }: Readonly<{ children: ReactNode }>) {
  return children;
}
