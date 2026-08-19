import type { Metadata } from 'next';
import { notFound, permanentRedirect } from 'next/navigation';
import KnowledgeTaxonomyDetail from '../../taxonomias/KnowledgeTaxonomyDetail';
import { buildDisciplineMetadata } from '../disciplineMetadata';
import { fetchPublicDisciplineForServer } from '../disciplineServerData';

export const revalidate = 300;
type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  return buildDisciplineMetadata(await fetchPublicDisciplineForServer(slug));
}

export default async function DisciplinePage({ params }: Props) {
  const { slug } = await params;
  const discipline = await fetchPublicDisciplineForServer(slug);
  if (!discipline) notFound();
  if (discipline.requestedSlug !== discipline.slug) permanentRedirect(discipline.canonicalPath);
  return <KnowledgeTaxonomyDetail taxonomy={discipline} />;
}
