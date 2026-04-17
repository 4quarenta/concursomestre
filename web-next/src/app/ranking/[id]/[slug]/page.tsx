import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowRight, Clock3, FileBadge2, Trophy, Users } from 'lucide-react';
import { buildRankingMetadata, loadPublicRankingById } from '@/lib/publicRankings';
import { buildRankingPath, buildRankingSlug } from '@/services/seo/slug';

interface RankingPageProps {
  params: Promise<{ id: string; slug: string }>;
}

export async function generateMetadata({ params }: RankingPageProps): Promise<Metadata> {
  const { id } = await params;
  const ranking = await loadPublicRankingById(id);

  if (!ranking) {
    return {
      title: 'Ranking nao encontrado | ConcursoMestre',
      robots: { index: false, follow: false },
    };
  }

  return buildRankingMetadata(ranking);
}

export default async function RankingPage({ params }: RankingPageProps) {
  const { id, slug } = await params;
  const ranking = await loadPublicRankingById(id);

  if (!ranking) {
    notFound();
  }

  const canonicalPath = buildRankingPath(ranking);
  const canonicalSlug = buildRankingSlug(ranking);
  const topEntries = Array.isArray(ranking.entries) ? ranking.entries.slice(0, 20) : [];

  return (
    <section className="mx-auto w-full max-w-7xl space-y-6 px-4 py-8 sm:px-6 lg:px-8">
      {slug !== canonicalSlug && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-900">
          URL canonica: <Link href={canonicalPath} className="underline underline-offset-2">{canonicalPath}</Link>
        </div>
      )}

      <div className="overflow-hidden rounded-[2rem] border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="border-b border-slate-200 bg-gradient-to-br from-amber-50 via-white to-indigo-50 p-6 dark:border-slate-800 dark:from-slate-900 dark:via-slate-900 dark:to-slate-950">
          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-amber-600 dark:text-amber-300">Ranking publico</p>
          <div className="mt-4 flex flex-wrap items-start justify-between gap-4">
            <div className="space-y-3">
              <h1 className="text-3xl font-black tracking-tight text-slate-900 dark:text-slate-100 md:text-5xl">{ranking.name}</h1>
              <p className="max-w-3xl text-sm font-medium leading-7 text-slate-500 dark:text-slate-400 md:text-base">
                {ranking.institution} · {ranking.totalQuestions} questoes · {ranking.entries?.length || 0} participacoes registradas.
              </p>
            </div>
            <Link
              href="/ranking"
              className="inline-flex items-center gap-2 rounded-2xl bg-indigo-600 px-5 py-3 text-xs font-black uppercase tracking-[0.18em] text-white transition-all hover:bg-indigo-700"
            >
              Abrir central de rankings <ArrowRight size={14} />
            </Link>
          </div>
        </div>

        <div className="grid gap-6 p-6 xl:grid-cols-[320px,minmax(0,1fr)]">
          <aside className="space-y-4">
            <div className="rounded-[2rem] border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
              <h2 className="text-xl font-black tracking-tight text-slate-900 dark:text-slate-100">Resumo</h2>
              <div className="mt-4 space-y-3 text-sm text-slate-600 dark:text-slate-300">
                <div className="flex items-center gap-2">
                  <Trophy size={16} className="text-amber-600 dark:text-amber-300" />
                  <span>Status do gabarito: {ranking.keyStatus === 'official' ? 'Oficial' : 'Pendente'}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Users size={16} className="text-indigo-600 dark:text-indigo-300" />
                  <span>{ranking.entries?.length || 0} participantes</span>
                </div>
                <div className="flex items-center gap-2">
                  <FileBadge2 size={16} className="text-emerald-600 dark:text-emerald-300" />
                  <span>{ranking.examTypes?.join(', ') || 'Tipo padrao'}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Clock3 size={16} className="text-sky-600 dark:text-sky-300" />
                  <span>{ranking.hasDiscursive ? 'Com discursiva' : 'Sem discursiva'}</span>
                </div>
              </div>
            </div>
          </aside>

          <div className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <div className="flex items-center justify-between gap-4">
              <div>
                <h2 className="text-xl font-black tracking-tight text-slate-900 dark:text-slate-100">Top colocacoes</h2>
                <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">Visao publica das primeiras participacoes registradas neste ranking.</p>
              </div>
            </div>

            <div className="mt-6 overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-200 text-sm dark:divide-slate-800">
                <thead>
                  <tr className="text-left text-[10px] font-black uppercase tracking-[0.18em] text-slate-400 dark:text-slate-500">
                    <th className="pb-3 pr-4">Posicao</th>
                    <th className="pb-3 pr-4">Candidato</th>
                    <th className="pb-3 pr-4">Categoria</th>
                    <th className="pb-3 pr-4">Prova</th>
                    <th className="pb-3">Nota</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {topEntries.map((entry, index) => (
                    <tr key={entry.id || `${entry.userName}-${index}`} className="align-top">
                      <td className="py-3 pr-4 font-black text-slate-900 dark:text-slate-100">#{index + 1}</td>
                      <td className="py-3 pr-4 text-slate-600 dark:text-slate-300">{entry.userName}</td>
                      <td className="py-3 pr-4 text-slate-500 dark:text-slate-400">{entry.category}</td>
                      <td className="py-3 pr-4 text-slate-500 dark:text-slate-400">{entry.examType || 'Padrao'}</td>
                      <td className="py-3 font-semibold text-slate-900 dark:text-slate-100">{entry.score}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
