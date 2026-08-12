import type { ReactNode } from 'react';
import { buildNoIndexMetadata } from '../seoMetadata';
import 'katex/dist/katex.min.css';
import { MarketplaceProvider } from '@providers/MarketplaceProvider';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export const metadata = buildNoIndexMetadata({
  title: 'Painel admin',
});

export default function AdminLayout({ children }: Readonly<{ children: ReactNode }>) {
  return <MarketplaceProvider>{children}</MarketplaceProvider>;
}
