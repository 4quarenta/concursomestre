import type { Metadata } from 'next';
import { notFound, permanentRedirect } from 'next/navigation';
import KnowledgeTaxonomyDetail from '../../taxonomias/KnowledgeTaxonomyDetail';
import { buildKnowledgeTaxonomyMetadata } from '../../taxonomias/knowledgeTaxonomyMetadata';
import { fetchPublicKnowledgeTaxonomyForServer } from '../../taxonomias/knowledgeTaxonomyServerData';

export const revalidate = 300;
type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  return buildKnowledgeTaxonomyMetadata(await fetchPublicKnowledgeTaxonomyForServer('assunto', slug));
}

export default async function SubjectPage({ params }: Props) {
  const { slug } = await params;
  const subject = await fetchPublicKnowledgeTaxonomyForServer('assunto', slug);
  if (!subject) notFound();
  if (subject.requestedSlug !== subject.slug) permanentRedirect(subject.canonicalPath);
  return <KnowledgeTaxonomyDetail taxonomy={subject} />;
}
