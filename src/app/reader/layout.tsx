import type { ReactNode } from 'react';
import { buildNoIndexMetadata } from '../seoMetadata';
import { MarketplaceProvider } from '@providers/MarketplaceProvider';

export const metadata = buildNoIndexMetadata({ title: 'Leitor de materiais' });

export default function ReaderLayout({ children }: Readonly<{ children: ReactNode }>) {
  return <MarketplaceProvider>{children}</MarketplaceProvider>;
}
