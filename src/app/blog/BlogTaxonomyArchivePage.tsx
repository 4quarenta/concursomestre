import Link from 'next/link';
import { ChevronRight } from 'lucide-react';
import { buildSiteUrl } from '@/config/siteUrl';
import { publicRoutes } from '@services/routes/publicRoutes';
import { serializeStructuredData } from '@services/seo/structuredData';
import type { PublicBlogTaxonomyArchive } from '@services/blog';
import BlogArticleCard from './BlogArticleCard';
import BlogConversionCta from './BlogConversionCta';
import BlogHeader from './BlogHeader';

const kindLabels: Record<string, string> = {
  general: 'Tag', topic: 'Assunto', region: 'Região', state: 'Estado',
  career: 'Carreira', organization: 'Órgão', exam_board: 'Banca',
};

export default function BlogTaxonomyArchivePage({
  archive,
}: {
  archive: PublicBlogTaxonomyArchive;
}) {
  const { taxonomy, items, pageInfo } = archive;
  const typeLabel = taxonomy.type === 'category' ? 'Categoria' : (kindLabels[taxonomy.kind || 'general'] || 'Tag');
  const archivePath = taxonomy.type === 'category'
    ? publicRoutes.blog.category(taxonomy.slug)
    : publicRoutes.blog.tag(taxonomy.slug);
  const breadcrumbs = [
    { label: 'Início', path: '/' },
    { label: 'Blog', path: publicRoutes.blog.index() },
    { label: taxonomy.label, path: archivePath },
  ];
  const jsonLd = [
    {
      '@context': 'https://schema.org',
      '@type': 'CollectionPage',
      '@id': buildSiteUrl(`${archivePath}#collection`),
      name: taxonomy.label,
      description: taxonomy.description || undefined,
      url: buildSiteUrl(archivePath),
      inLanguage: 'pt-BR',
      mainEntity: {
        '@type': 'ItemList',
        numberOfItems: items.length,
        itemListElement: items.map((article, index) => ({
          '@type': 'ListItem', position: index + 1, name: article.title, url: buildSiteUrl(`/blog/${article.slug}`),
        })),
      },
    },
    {
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: breadcrumbs.map((item, index) => ({
        '@type': 'ListItem', position: index + 1, name: item.label, item: buildSiteUrl(item.path),
      })),
    },
  ];

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: serializeStructuredData(jsonLd) }} />
      <BlogHeader />
      <main>
        <section className="border-b border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-950">
          <div className="mx-auto max-w-7xl px-5 py-10 lg:px-8">
            <nav aria-label="Breadcrumb" className="mb-5 flex flex-wrap items-center gap-1 text-sm text-slate-500">
              {breadcrumbs.map((item, index) => (
                <span key={item.path} className="inline-flex items-center gap-1">
                  {index > 0 ? <ChevronRight aria-hidden="true" size={14} /> : null}
                  {index === breadcrumbs.length - 1
                    ? <span aria-current="page">{item.label}</span>
                    : <Link href={item.path} className="hover:text-indigo-600">{item.label}</Link>}
                </span>
              ))}
            </nav>
            <p className="text-xs font-black uppercase tracking-[0.16em] text-indigo-600">{typeLabel}</p>
            <h1 className="mt-2 break-words text-4xl font-black text-slate-950 dark:text-white">{taxonomy.label}</h1>
            <p className="mt-3 max-w-3xl leading-7 text-slate-600 dark:text-slate-300">
              {taxonomy.description || (taxonomy.type === 'category'
                ? `Publicações editoriais da categoria ${taxonomy.label}.`
                : `Publicações do blog associadas à tag ${taxonomy.label}.`)}
            </p>
          </div>
        </section>
        <section className="mx-auto max-w-7xl px-5 py-10 lg:px-8" aria-labelledby="blog-taxonomy-posts">
          <h2 id="blog-taxonomy-posts" className="mb-6 text-2xl font-black text-slate-950 dark:text-white">Publicações</h2>
          {items.length > 0 ? (
            <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
              {items.map((article) => <BlogArticleCard key={article.id} article={article} />)}
            </div>
          ) : (
            <div className="border border-dashed border-slate-300 bg-white px-6 py-12 text-center dark:border-slate-700 dark:bg-slate-950">
              <p className="font-bold text-slate-700 dark:text-slate-200">Ainda não há publicações públicas nesta página.</p>
              <Link href={publicRoutes.blog.index()} className="mt-4 inline-flex text-sm font-bold text-indigo-600 hover:underline">Voltar ao blog</Link>
            </div>
          )}
          {pageInfo.hasMore && pageInfo.nextCursor ? (
            <div className="mt-9 flex justify-center">
              <Link
                href={taxonomy.type === 'category'
                  ? publicRoutes.blog.category(taxonomy.slug, { cursor: pageInfo.nextCursor })
                  : publicRoutes.blog.tag(taxonomy.slug, { cursor: pageInfo.nextCursor })}
                className="inline-flex h-11 items-center justify-center rounded-md border border-slate-300 bg-white px-5 text-sm font-bold text-slate-800 hover:border-indigo-400 hover:text-indigo-600 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                rel="next"
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
