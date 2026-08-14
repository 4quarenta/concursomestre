import type { ReactNode } from 'react';
import PracticeLayout, { metadata as questionsMetadata } from '../practice/layout';

export const metadata = questionsMetadata;

export default function QuestionsLayout({ children }: Readonly<{ children: ReactNode }>) {
  return <PracticeLayout>{children}</PracticeLayout>;
}
