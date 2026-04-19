import type { ReactNode } from 'react';
import { buildNoIndexMetadata } from '../seoMetadata';

export const metadata = buildNoIndexMetadata({
  title: 'Assinatura',
});

export default function SubscriptionLayout({ children }: Readonly<{ children: ReactNode }>) {
  return children;
}
