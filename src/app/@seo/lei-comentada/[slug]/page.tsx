import Link from 'next/link';
import { notFound } from 'next/navigation';
import { fetchLawDetailForServer } from '../../../lei-comentada/legalCommentaryServerData';
import type { LawArticle } from '@types';

export const revalidate = 300;

type LegalCommentaryDetailSeoProps = {
  params: Promise<{ slug: string }>;
};

const articleText = (article: LawArticle) => {
  const blocks = Array.isArray(article.blocks) ? article.blocks : [];
  if (blocks.length > 0) {
    return blocks.map((block) => [block.label, block.text].filter(Boolean).join(' '));
  }

  const paragraphs = article.paragraphs || article.paragrafos || [];
  const baseText = article.text || article.texto || '';
  return [baseText, ...paragraphs.map((paragraph) => [paragraph.number, paragraph.text].filter(Boolean).join(' '))]
    .filter(Boolean);
};

export default async function LegalCommentaryDetailSeoSnapshot({ params }: LegalCommentaryDetailSeoProps) {
  const { slug } = await params;
  const law = await fetchLawDetailForServer(slug);

  if (!law) notFound();

  return (
    <main className="min-h-screen bg-slate-50 px-5 py-10 text-slate-900">
      <article className="mx-auto max-w-4xl rounded-lg border border-slate-200 bg-white p-6 sm:p-10">
        <nav aria-label="Breadcrumb" className="mb-6 text-sm text-slate-500">
          <Link href="/lei-comentada" className="text-indigo-700">Lei comentada</Link>
          <span aria-hidden="true"> / </span>
          <span>{law.shortTitle || law.title}</span>
        </nav>

        <header className="border-b border-slate-200 pb-6">
          <p className="text-xs font-bold uppercase tracking-widest text-indigo-600">Legislação para concursos</p>
          <h1 className="mt-2 text-4xl font-bold">{law.title}</h1>
          {(law.ementa || law.summary) ? <p className="mt-4 text-lg leading-8 text-slate-600">{law.ementa || law.summary}</p> : null}
        </header>

        <div className="mt-8 space-y-8">
          {law.articles.map((article) => (
            <section key={String(article.id)} id={article.slug || `artigo-${article.id}`}>
              <h2 className="text-xl font-semibold">
                {[article.number || article.numero, article.title || article.titulo].filter(Boolean).join(' — ')}
              </h2>
              <div className="mt-3 space-y-3 text-base leading-7 text-slate-700">
                {articleText(article).map((text, index) => <p key={`${article.id}-${index}`}>{text}</p>)}
              </div>
            </section>
          ))}
        </div>
      </article>
    </main>
  );
}
