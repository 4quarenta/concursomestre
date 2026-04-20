'use client';

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

import React from 'react';
import Link from 'next/link';
import { AlertTriangle, BookOpen, Edit3, FileText, Plus, RefreshCcw, Search, Trash2 } from 'lucide-react';
import { useToast } from '@providers/ToastProvider';
import { legalCommentaryApiService } from '@services/legal-commentary';
import type { LawSummary, LegalHomeSnapshot } from '@types';

interface AdminLegalCommentarySectionProps {
  filter?: string;
}

const EMPTY_HOME: LegalHomeSnapshot = {
  areas: [],
  lawsByArea: [],
  mostAccessed: [],
  favoriteLaws: [],
  recentlyStudied: [],
  recentlyUpdated: [],
  totals: {
    laws: 0,
    articles: 0,
    commentedArticles: 0,
    updatedRecently: 0,
  },
};

const getLawEditPath = (lawId: string | number) =>
  `/admin/operation/lei-comentada/${encodeURIComponent(String(lawId))}/edit`;

const AdminLegalCommentarySection = ({ filter = '' }: AdminLegalCommentarySectionProps) => {
  const { addToast } = useToast();
  const [query, setQuery] = React.useState(filter);
  const [laws, setLaws] = React.useState<LawSummary[]>([]);
  const [home, setHome] = React.useState<LegalHomeSnapshot>(EMPTY_HOME);
  const [isLoading, setIsLoading] = React.useState(true);
  const [deletingId, setDeletingId] = React.useState<string | null>(null);

  const areaNameById = React.useMemo(() => {
    const entries: Array<[string, string]> = home.areas.map((area) => [area.id, area.name]);
    return new Map<string, string>(entries);
  }, [home.areas]);

  const loadLaws = React.useCallback(async (nextQuery = query) => {
    setIsLoading(true);
    try {
      const payload = await legalCommentaryApiService.getAdminList(nextQuery);
      setLaws(payload.laws || []);
      setHome(payload.home || EMPTY_HOME);
    } catch {
      addToast('Nao foi possivel carregar as leis comentadas.', 'error');
    } finally {
      setIsLoading(false);
    }
  }, [addToast, query]);

  React.useEffect(() => {
    void loadLaws(query);
  }, []);

  const handleSearchSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    void loadLaws(query);
  };

  const handleDelete = async (law: LawSummary) => {
    const confirmed = window.confirm(`Remover "${law.shortTitle}" da base da Lei Comentada?`);
    if (!confirmed) return;

    setDeletingId(law.id);
    try {
      await legalCommentaryApiService.deleteAdminLaw(law.id);
      addToast('Lei removida com sucesso.', 'success');
      await loadLaws(query);
    } catch {
      addToast('Nao foi possivel remover a lei.', 'error');
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="space-y-5">
      <div className="grid gap-4 md:grid-cols-4">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Leis</p>
          <p className="mt-2 text-3xl font-black text-slate-900 dark:text-slate-100">{home.totals.laws}</p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Artigos</p>
          <p className="mt-2 text-3xl font-black text-slate-900 dark:text-slate-100">{home.totals.articles}</p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Comentados</p>
          <p className="mt-2 text-3xl font-black text-slate-900 dark:text-slate-100">{home.totals.commentedArticles}</p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Atualizadas</p>
          <p className="mt-2 text-3xl font-black text-slate-900 dark:text-slate-100">{home.totals.updatedRecently}</p>
        </div>
      </div>

      <div className="rounded-[2rem] border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-indigo-600 dark:text-indigo-300">Conteudo persistente</p>
            <h2 className="mt-2 text-xl font-black text-slate-900 dark:text-slate-100">Lei Comentada</h2>
            <p className="mt-1 max-w-3xl text-sm font-medium leading-6 text-slate-500 dark:text-slate-400">
              Gerencie leis, artigos, comentarios de professor, jurisprudencia, sumulas, macetes e vinculos com materias/assuntos.
            </p>
          </div>

          <div className="flex flex-col gap-2 sm:flex-row">
            <button
              type="button"
              onClick={() => void loadLaws(query)}
              className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-slate-200 px-4 text-[10px] font-black uppercase tracking-[0.16em] text-slate-600 transition-colors hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
            >
              <RefreshCcw size={15} /> Recarregar
            </button>
            <Link
              href={getLawEditPath('new')}
              className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-indigo-600 px-5 text-[10px] font-black uppercase tracking-[0.16em] text-white shadow-sm transition-colors hover:bg-indigo-700"
            >
              <Plus size={16} /> Nova lei
            </Link>
          </div>
        </div>

        <form onSubmit={handleSearchSubmit} className="mt-5 flex flex-col gap-3 sm:flex-row">
          <div className="relative flex-1">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={17} />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Buscar por nome, numero, apelido, area ou ementa"
              className="h-12 w-full rounded-xl border border-slate-200 bg-slate-50 pl-11 pr-4 text-sm font-semibold text-slate-900 outline-none transition-colors focus:border-indigo-300 focus:bg-white dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:focus:border-indigo-500"
            />
          </div>
          <button type="submit" className="h-12 rounded-xl bg-slate-900 px-5 text-[10px] font-black uppercase tracking-[0.16em] text-white dark:bg-white dark:text-slate-950">
            Buscar
          </button>
        </form>
      </div>

      <div className="overflow-hidden rounded-[2rem] border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[980px] text-left text-xs">
            <thead className="border-b border-slate-100 bg-slate-50 text-[10px] font-black uppercase tracking-[0.14em] text-slate-400 dark:border-slate-800 dark:bg-slate-800/50">
              <tr>
                <th className="p-4">Lei</th>
                <th className="p-4">Area</th>
                <th className="p-4">Artigos</th>
                <th className="p-4">Editorial</th>
                <th className="p-4">Fonte</th>
                <th className="p-4">Status</th>
                <th className="p-4 text-center">Acoes</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {isLoading ? (
                <tr>
                  <td colSpan={7} className="p-10 text-center text-sm font-bold text-slate-500">Carregando leis...</td>
                </tr>
              ) : laws.length > 0 ? laws.map((law) => (
                <tr key={law.id} className="transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/50">
                  <td className="p-4">
                    <div className="flex items-start gap-3">
                      <div className="rounded-2xl bg-indigo-50 p-3 text-indigo-600 dark:bg-indigo-500/10 dark:text-indigo-300">
                        <FileText size={17} />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-black text-slate-900 dark:text-slate-100">{law.shortTitle}</p>
                        <p className="mt-1 text-xs font-semibold text-slate-500 dark:text-slate-400">{law.number}{law.year ? ` / ${law.year}` : ''}</p>
                        <p className="mt-1 line-clamp-1 max-w-xl text-xs font-medium text-slate-400">{law.description || law.summary}</p>
                      </div>
                    </div>
                  </td>
                  <td className="p-4 font-bold text-slate-600 dark:text-slate-300">{areaNameById.get(law.areaId) || '-'}</td>
                  <td className="p-4">
                    <span className="rounded-xl bg-slate-100 px-3 py-1.5 text-[10px] font-black uppercase text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                      {law.articleCount} artigos
                    </span>
                  </td>
                  <td className="p-4">
                    <div className="flex flex-col gap-1 text-[10px] font-black uppercase tracking-[0.12em] text-slate-500">
                      <span>{law.commentedArticleCount} comentados</span>
                      <span>{law.jurisprudenceCount} jurisprudencias</span>
                      <span>{law.examTipCount} macetes</span>
                    </div>
                  </td>
                  <td className="p-4">
                    <a href={law.officialUrl} target="_blank" rel="noreferrer" className="text-xs font-black text-indigo-600 hover:text-indigo-700 dark:text-indigo-300">
                      Planalto
                    </a>
                  </td>
                  <td className="p-4">
                    <div className="flex flex-wrap gap-2">
                      <span className="rounded-xl bg-emerald-50 px-2.5 py-1 text-[9px] font-black uppercase text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300">
                        {law.status}
                      </span>
                      {law.isRecentlyUpdated ? (
                        <span className="inline-flex items-center gap-1 rounded-xl bg-amber-50 px-2.5 py-1 text-[9px] font-black uppercase text-amber-700 dark:bg-amber-500/10 dark:text-amber-300">
                          <AlertTriangle size={11} /> atualizada
                        </span>
                      ) : null}
                    </div>
                  </td>
                  <td className="p-4">
                    <div className="flex justify-center gap-2">
                      <Link
                        href={getLawEditPath(law.id)}
                        className="rounded-xl p-2 text-slate-400 transition-colors hover:bg-indigo-50 hover:text-indigo-600 dark:hover:bg-indigo-500/10 dark:hover:text-indigo-300"
                        title="Editar lei"
                      >
                        <Edit3 size={16} />
                      </Link>
                      <button
                        type="button"
                        disabled={deletingId === law.id}
                        onClick={() => void handleDelete(law)}
                        className="rounded-xl p-2 text-slate-400 transition-colors hover:bg-red-50 hover:text-red-600 disabled:opacity-40 dark:hover:bg-red-500/10"
                        title="Remover lei"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              )) : (
                <tr>
                  <td colSpan={7} className="p-10 text-center">
                    <BookOpen className="mx-auto mb-3 text-slate-300 dark:text-slate-600" size={34} />
                    <p className="text-sm font-black text-slate-900 dark:text-slate-100">Nenhuma lei cadastrada no banco.</p>
                    <p className="mt-1 text-sm font-medium text-slate-500 dark:text-slate-400">Crie a primeira lei para publicar o modulo Lei Comentada.</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default AdminLegalCommentarySection;
