import type { ReactNode } from 'react';
import { notFound } from 'next/navigation';
import {
  fetchLawDetailForServer,
  fetchLegalCommentaryModuleAvailability,
} from '../legalCommentaryServerData';

type LawDetailLayoutProps = {
  children: ReactNode;
  params: Promise<{ slug: string }>;
};

export default async function LawDetailLayout({ children, params }: LawDetailLayoutProps) {
  const isModuleAvailable = await fetchLegalCommentaryModuleAvailability();
  if (!isModuleAvailable) {
    return children;
  }

  const { slug } = await params;
  const law = await fetchLawDetailForServer(slug);
  if (!law) {
    notFound();
  }

  return children;
}
