import type { ReactNode } from 'react';
import { buildNoIndexMetadata } from '../../seoMetadata';

export const metadata = buildNoIndexMetadata({
  title: 'Checkout',
});

export default function CheckoutPlanLayout({ children }: Readonly<{ children: ReactNode }>) {
  return children;
}
