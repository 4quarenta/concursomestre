import type { ReactNode } from 'react';
import { buildNoIndexMetadata } from '../seoMetadata';

export const metadata = buildNoIndexMetadata({
  title: 'Painel do parceiro',
});

export default function PartnerDashboardLayout({ children }: Readonly<{ children: ReactNode }>) {
  return children;
}
