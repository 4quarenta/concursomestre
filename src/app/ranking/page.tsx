import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowRight, Clock3, FileBadge2, Trophy, Users } from 'lucide-react';
import { loadPublicRankings } from '@/lib/publicRankings';
import { buildRankingPath } from '@/services/seo/slug';

export const revalidate = 3600;

export const metadata: Metadata = {
  title: 'Rankings publicos | ConcursoMestre',
  description: 'Acompanhe rankings publicos, colocacoes e provas ja publicadas na plataforma ConcursoMestre.',
  alternates: {
    canonical: '/ranking',
  },
};

const formatCreatedAt = (timestamp: number) => {
  try {
    return new Intl.DateTimeFormat('pt-BR', {
      dateStyle: 'medium',
    }).format(new Date(timestamp));
  } catch {
    return new Date(timestamp).toLocaleDateString('pt-BR');
  }
};

export default async function RankingPage() {
  const rawRankings = await loadPublicRankings();
  const rankings = rawRankings
    .filter((ranking) => !ranking.status || ranking.status === 'approved')
    .sort((left, right) => Number(right.createdAt || 0) - Number(left.createdAt || 0));

  return (
    <section className="mx-auto w-full max-w-7xl space-y-6 px-4 py-8 sm:px-6 lg:px-8">
      <div className="overflow-hidden rounded-[2rem] border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="border-b border-slate-200 bg-gradient-to-br from-amber-50 via-white to-indigo-50 p-6 dark:border-slate-800 dark:from-slate-900 dark:via-slate-900 dark:to-slate-950">
          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-amber-600 dark:text-amber-300">Central de rankings</p>
          <div className="mt-4 flex flex-wrap items-start justify-between gap-4">
            <div className="max-w-3xl space-y-3">
              <h1 className="text-3xl font-black tracking-tight text-slate-900 dark:text-slate-100 md:text-5xl">
                Rankings publicos para acompanhar desempenho e colocacao
              </h1>
              <p className="text-sm font-medium leading-7 text-slate-500 dark:text-slate-400 md:text-base">
                Veja provas publicadas, acompanhe participacoes registradas e abra a pagina detalhada de cada ranking.
              </p>
            </div>
            <div className="rounded-[1.5rem] border border-slate-200 bg-white px-5 py-4 text-right shadow-sm dark:border-slate-800 dark:bg-slate-900">
              <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400 dark:text-slate-500">Rankings ativos</p>
              <p className="mt-2 text-3xl font-black text-slate-900 dark:text-slate-100">{rankings.length}</p>
            </div>
          </div>
        </div>

        <div className="p-6">
          {rankings.length > 0 ? (
            <div className="grid gap-5 lg:grid-cols-2">
              {rankings.map((ranking) => {
                const topEntries = Array.isArray(ranking.entries) ? ranking.entries.slice(0, 3) : [];

                return (
                  <article
                    key={ranking.id}
                    className="rounded-[1.75rem] border border-slate-200 bg-white p-5 shadow-sm transition-colors dark:border-slate-800 dark:bg-slate-900"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-4">
                      <div className="space-y-3">
                        <div className="inline-flex items-center gap-2 rounded-full bg-amber-50 px-3 py-1 text-[10px] font-black uppercase tracking-[0.18em] text-amber-700 dark:bg-amber-500/10 dark:text-amber-300">
                          <Trophy size={12} />
                          Ranking publicado
                        </div>
                        <div>
                          <h2 className="text-2xl font-black tracking-tight text-slate-900 dark:text-slate-100">
                            {ranking.name}
                          </h2>
                          <p className="mt-2 text-sm font-medium leading-7 text-slate-500 dark:text-slate-400">
                            {ranking.institution}
                          </p>
                        </div>
                      </div>

                      <Link
                        href={buildRankingPath(ranking)}
                        className="inline-flex items-center gap-2 rounded-2xl bg-indigo-600 px-4 py-3 text-[10px] font-black uppercase tracking-[0.18em] text-white transition-colors hover:bg-indigo-700"
                      >
                        Abrir ranking
                        <ArrowRight size={14} />
                      </Link>
                    </div>

                    <div className="mt-5 grid gap-3 sm:grid-cols-2">
                      <div className="rounded-[1.5rem] border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950">
                        <div className="flex items-center gap-2 text-slate-900 dark:text-slate-100">
                          <Users size={16} className="text-indigo-600 dark:text-indigo-300" />
                          <span className="text-sm font-black">{ranking.entries?.length || 0} participantes</span>
                        </div>
                        <p className="mt-2 text-xs font-medium leading-6 text-slate-500 dark:text-slate-400">
                          Participacoes publicas registradas neste ranking.
                        </p>
                      </div>
                      <div className="rounded-[1.5rem] border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950">
                        <div className="flex items-center gap-2 text-slate-900 dark:text-slate-100">
                          <FileBadge2 size={16} className="text-emerald-600 dark:text-emerald-300" />
                          <span className="text-sm font-black">{ranking.totalQuestions} questoes</span>
                        </div>
                        <p className="mt-2 text-xs font-medium leading-6 text-slate-500 dark:text-slate-400">
                          {ranking.hasDiscursive ? 'Com etapa discursiva.' : 'Sem etapa discursiva.'}
                        </p>
                      </div>
                    </div>

                    <div className="mt-5 flex flex-wrap items-center gap-3 text-[10px] font-black uppercase tracking-[0.18em] text-slate-400 dark:text-slate-500">
                      <span className="inline-flex items-center gap-1">
                        <Clock3 size={12} />
                        Publicado em {formatCreatedAt(ranking.createdAt)}
                      </span>
                      <span>{ranking.examTypes?.join(', ') || 'Tipo padrao'}</span>
                      <span>{ranking.keyStatus === 'official' ? 'Gabarito oficial' : 'Gabarito pendente'}</span>
                    </div>

                    {topEntries.length > 0 ? (
                      <div className="mt-5 rounded-[1.5rem] border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950">
                        <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400 dark:text-slate-500">
                          Top 3 inicial
                        </p>
                        <div className="mt-3 space-y-2">
                          {topEntries.map((entry, index) => (
                            <div
                              key={entry.id || `${ranking.id}-${entry.userName}-${index}`}
                              className="flex items-center justify-between gap-3 rounded-xl bg-white px-3 py-2 text-sm dark:bg-slate-900"
                            >
                              <div className="min-w-0">
                                <p className="truncate font-black text-slate-900 dark:text-slate-100">
                                  #{index + 1} {entry.userName}
                                </p>
                                <p className="truncate text-xs font-medium text-slate-500 dark:text-slate-400">
                                  {entry.category} · {entry.examType || 'Padrao'}
                                </p>
                              </div>
                              <span className="shrink-0 font-black text-indigo-600 dark:text-indigo-300">
                                {entry.score}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : null}
                  </article>
                );
              })}
            </div>
          ) : (
            <div className="rounded-[2rem] border border-dashed border-slate-200 bg-slate-50 px-6 py-16 text-center dark:border-slate-800 dark:bg-slate-950">
              <h2 className="text-2xl font-black text-slate-900 dark:text-slate-100">Nenhum ranking publicado ainda</h2>
              <p className="mt-3 text-sm font-medium leading-7 text-slate-500 dark:text-slate-400">
                Assim que novos rankings forem liberados, eles aparecerao nesta central com acesso publico.
              </p>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
