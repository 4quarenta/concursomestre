import type { ReactNode } from 'react';
import { buildNoIndexMetadata } from '../seoMetadata';
import { MarketplaceProvider } from '@providers/MarketplaceProvider';

export const metadata = buildNoIndexMetadata({
  title: 'Materiais para concursos',
  description: 'Acesse materiais, resumos e PDFs para complementar os estudos em concursos publicos.',
});

export default function MaterialLayout({ children }: Readonly<{ children: ReactNode }>) {
  return <MarketplaceProvider>{children}</MarketplaceProvider>;
}
