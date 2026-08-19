import type { Metadata } from 'next';
import { notFound, permanentRedirect } from 'next/navigation';
import KnowledgeTaxonomyDetail from '../../taxonomias/KnowledgeTaxonomyDetail';
import { buildKnowledgeTaxonomyMetadata } from '../../taxonomias/knowledgeTaxonomyMetadata';
import { fetchPublicKnowledgeTaxonomyForServer } from '../../taxonomias/knowledgeTaxonomyServerData';

export const revalidate = 300;
type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  return buildKnowledgeTaxonomyMetadata(await fetchPublicKnowledgeTaxonomyForServer('topico', slug));
}

export default async function TopicPage({ params }: Props) {
  const { slug } = await params;
  const topic = await fetchPublicKnowledgeTaxonomyForServer('topico', slug);
  if (!topic) notFound();
  if (topic.requestedSlug !== topic.slug) permanentRedirect(topic.canonicalPath);
  return <KnowledgeTaxonomyDetail taxonomy={topic} />;
}
