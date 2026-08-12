import type { ReactNode } from 'react';
import { buildNoIndexMetadata } from '../seoMetadata';
import { MarketplaceProvider } from '@providers/MarketplaceProvider';

export const metadata = buildNoIndexMetadata({
  title: 'Painel do parceiro',
});

export default function PartnerDashboardLayout({ children }: Readonly<{ children: ReactNode }>) {
  return <MarketplaceProvider>{children}</MarketplaceProvider>;
}
