import type { ReactNode } from 'react';
import 'katex/dist/katex.min.css';
import { MarketplaceProvider } from '@providers/MarketplaceProvider';

export default function SearchLayout({ children }: Readonly<{ children: ReactNode }>) {
  return <MarketplaceProvider>{children}</MarketplaceProvider>;
}
