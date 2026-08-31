import type { ReactNode } from 'react';
import { buildNoIndexMetadata } from '../seoMetadata';

export const metadata = buildNoIndexMetadata({
  title: 'Flashcards',
});

export default function FlashcardsLayout({ children }: Readonly<{ children: ReactNode }>) {
  return children;
}
