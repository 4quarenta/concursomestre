/*
* ----------------------------------------------------
* @author: 4quarenta
* @author URI: https://github.com/4quarenta
* @copyright: (c) 2026 ConcursoMestre. All rights reserved
* ----------------------------------------------------
*
* @since 1.0.0
*
*/

import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import BlogTaxonomyArchivePage from '../../BlogTaxonomyArchivePage';
import { fetchBlogTaxonomyArchiveForServer } from '../../blogServerData';
import { buildBlogTaxonomyMetadata } from '../../blogTaxonomyMetadata';

export const revalidate = 300;

type PageProps = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

const cursorValue = (query: Record<string, string | string[] | undefined>): string => (
  typeof query.cursor === 'string' ? query.cursor : ''
);

export async function generateMetadata({ params, searchParams }: PageProps): Promise<Metadata> {
  const [{ slug }, query] = await Promise.all([params, searchParams]);
  const archive = await fetchBlogTaxonomyArchiveForServer('category', slug, cursorValue(query));
  return buildBlogTaxonomyMetadata(archive?.taxonomy || null, Object.keys(query).length > 0);
}

export default async function BlogCategoryPage({ params, searchParams }: PageProps) {
  const [{ slug }, query] = await Promise.all([params, searchParams]);
  const archive = await fetchBlogTaxonomyArchiveForServer('category', slug, cursorValue(query));
  if (!archive) notFound();
  return <BlogTaxonomyArchivePage archive={archive} />;
}
