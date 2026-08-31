import type { ReactNode } from 'react';
import { buildNoIndexMetadata } from '../seoMetadata';

export const metadata = buildNoIndexMetadata({
  title: 'Dashboard',
});

export default function DashboardLayout({ children }: Readonly<{ children: ReactNode }>) {
  return children;
}
