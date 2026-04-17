import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { ArrowRight, BookOpen, ShoppingBag, Star, Tag, UserRound } from 'lucide-react';
import { buildMaterialMetadata, loadPublicMaterialById } from '@/lib/publicMaterials';
import { buildMaterialStructuredData, serializeStructuredData } from '@/lib/structuredData';
import { buildMaterialPath, buildMaterialSlug, summarizeSeoText } from '@/services/seo/slug';

interface MaterialPageProps {
  params: Promise<{ id: string; slug: string }>;
}

export const revalidate = 3600;

export async function generateMetadata({ params }: MaterialPageProps): Promise<Metadata> {
  const { id } = await params;
  const material = await loadPublicMaterialById(id);

  if (!material) {
    return {
      title: 'Material nao encontrado | ConcursoMestre',
      robots: { index: false, follow: false },
    };
  }

  return buildMaterialMetadata(material);
}

export default async function MaterialPage({ params }: MaterialPageProps) {
  const { id, slug } = await params;
  const material = await loadPublicMaterialById(id);

  if (!material) {
    notFound();
  }

  const canonicalPath = buildMaterialPath(material);
  const canonicalSlug = buildMaterialSlug(material);
  if (slug !== canonicalSlug) {
    redirect(canonicalPath);
  }

  const subjectLabel = typeof material.subject === 'string' ? material.subject : material.subjectText || 'Materia nao informada';

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: serializeStructuredData(buildMaterialStructuredData(material)) }}
      />
      <section className="mx-auto w-full max-w-7xl space-y-6 px-4 py-8 sm:px-6 lg:px-8">
        <div className="overflow-hidden rounded-[2rem] border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="border-b border-slate-200 bg-gradient-to-br from-emerald-50 via-white to-sky-50 p-6 dark:border-slate-800 dark:from-slate-900 dark:via-slate-900 dark:to-slate-950">
          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-emerald-600 dark:text-emerald-300">Material publico</p>
          <div className="mt-4 flex flex-wrap items-start justify-between gap-4">
            <div className="space-y-3">
              <h1 className="text-3xl font-black tracking-tight text-slate-900 dark:text-slate-100 md:text-5xl">{material.title}</h1>
              <p className="max-w-3xl text-sm font-medium leading-7 text-slate-500 dark:text-slate-400 md:text-base">
                {summarizeSeoText(material.description || material.details || 'Material do marketplace ConcursoMestre.', 180)}
              </p>
            </div>
            <div className="rounded-2xl border border-emerald-200 bg-white px-5 py-4 text-right shadow-sm dark:border-emerald-900/30 dark:bg-slate-900">
              <p className="text-[10px] font-black uppercase tracking-[0.18em] text-emerald-600 dark:text-emerald-300">Preco</p>
              <p className="mt-2 text-2xl font-black text-slate-900 dark:text-slate-100">
                {material.price > 0 ? `R$ ${material.price.toFixed(2)}` : 'Gratis'}
              </p>
            </div>
          </div>
        </div>

        <div className="grid gap-6 p-6 xl:grid-cols-[minmax(0,1.5fr),360px]">
          <article className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <h2 className="text-xl font-black tracking-tight text-slate-900 dark:text-slate-100">Descricao</h2>
            <p className="mt-4 text-sm leading-7 text-slate-600 dark:text-slate-300">
              {material.description || material.details || 'Sem descricao adicional.'}
            </p>
          </article>

          <aside className="space-y-4">
            <div className="rounded-[2rem] border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
              <h2 className="text-xl font-black tracking-tight text-slate-900 dark:text-slate-100">Resumo</h2>
              <div className="mt-4 space-y-3 text-sm text-slate-600 dark:text-slate-300">
                <div className="flex items-center gap-2">
                  <BookOpen size={16} className="text-indigo-600 dark:text-indigo-300" />
                  <span>{subjectLabel}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Tag size={16} className="text-fuchsia-600 dark:text-fuchsia-300" />
                  <span>{material.topic || 'Topico nao informado'}</span>
                </div>
                <div className="flex items-center gap-2">
                  <UserRound size={16} className="text-sky-600 dark:text-sky-300" />
                  <span>{material.authorName}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Star size={16} className="text-amber-600 dark:text-amber-300" />
                  <span>{material.rating?.toFixed?.(1) || material.rating || 0} de avaliacao media</span>
                </div>
                <div className="flex items-center gap-2">
                  <ShoppingBag size={16} className="text-emerald-600 dark:text-emerald-300" />
                  <span>{material.salesCount || 0} vendas registradas</span>
                </div>
              </div>
            </div>

            <div className="rounded-[2rem] border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
              <h2 className="text-xl font-black tracking-tight text-slate-900 dark:text-slate-100">Acoes</h2>
              <div className="mt-5 flex flex-col gap-3">
                <Link
                  href="/marketplace"
                  className="inline-flex items-center justify-center gap-2 rounded-2xl bg-indigo-600 px-4 py-3 text-xs font-black uppercase tracking-[0.18em] text-white transition-all hover:bg-indigo-700"
                >
                  Ver no marketplace <ArrowRight size={14} />
                </Link>
              </div>
            </div>
          </aside>
        </div>
        </div>
      </section>
    </>
  );
}
