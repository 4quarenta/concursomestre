import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import BlogArticleCard from '../../BlogArticleCard';
import BlogConversionCta from '../../BlogConversionCta';
import BlogHeader from '../../BlogHeader';
import { fetchBlogPageForServer, fetchBlogTagsForServer } from '../../blogServerData';

type PageProps = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ cursor?: string }>;
};

const kindLabels: Record<string, string> = {
  general: 'Tag',
  topic: 'Assunto',
  region: 'Região',
  state: 'Estado',
  career: 'Carreira',
  organization: 'Órgão',
  exam_board: 'Banca',
};

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const tags = await fetchBlogTagsForServer();
  const tag = tags.find((item) => item.slug === slug);
  if (!tag) return { title: 'Tag não encontrada', robots: { index: false } };
  return {
    title: `${tag.label}: notícias de concursos`,
    description: tag.description || `Notícias, editais e atualizações sobre ${tag.label}.`,
    alternates: { canonical: `/blog/tag/${slug}` },
  };
}

export default async function BlogTagPage({ params, searchParams }: PageProps) {
  const { slug } = await params;
  const { cursor = '' } = await searchParams;
  const [page, tags] = await Promise.all([
    fetchBlogPageForServer({ tag: slug, cursor }),
    fetchBlogTagsForServer(),
  ]);
  const tag = tags.find((item) => item.slug === slug);
  if (!tag) notFound();

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900">
      <BlogHeader />
      <main>
        <section className="border-b border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-950">
          <div className="mx-auto max-w-7xl px-5 py-10 lg:px-8">
            <p className="text-xs font-black uppercase tracking-[0.16em] text-indigo-600">{kindLabels[tag.kind] || 'Tag'}</p>
            <h1 className="mt-2 text-4xl font-black text-slate-950 dark:text-white">{tag.label}</h1>
            <p className="mt-3 max-w-3xl text-slate-600 dark:text-slate-300">
              {tag.description || `${tag.articleCount || page.items.length} notícia(s) relacionada(s) a ${tag.label}.`}
            </p>
          </div>
        </section>
        <section className="mx-auto max-w-7xl px-5 py-10 lg:px-8">
          <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
            {page.items.map((article) => <BlogArticleCard key={article.id} article={article} />)}
          </div>
          {page.pageInfo.hasMore && page.pageInfo.nextCursor ? (
            <div className="mt-9 flex justify-center">
              <Link
                href={{ pathname: `/blog/tag/${slug}`, query: { cursor: page.pageInfo.nextCursor } }}
                className="inline-flex h-11 items-center justify-center rounded-md border border-slate-300 bg-white px-5 text-sm font-bold text-slate-800 hover:border-indigo-400 hover:text-indigo-600 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
              >
                Mais notícias
              </Link>
            </div>
          ) : null}
        </section>
        <BlogConversionCta />
      </main>
    </div>
  );
}
