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
import {
  AlertTriangle,
  BookOpen,
  ChevronRight,
  FileText,
  Gavel,
  Heart,
  Landmark,
  Scale,
  Search,
  Star,
} from 'lucide-react';
import { useAuth } from '@providers/AuthProvider';
import { useData } from '@providers/DataProvider';
import { useToast } from '@providers/ToastProvider';
import {
  PLATFORM_PAGE_DESCRIPTION_CLASS,
  PLATFORM_PAGE_TITLE_CLASS,
  PLATFORM_SECTION_TITLE_CLASS,
  PLATFORM_SURFACE_CARD_CLASS,
} from '@constants/layout';
import BetaFeaturePage from '../../components/shared/feedback/BetaFeaturePage';
import { resolveSystemFeatureFlag } from '@services/system/moduleFlags';
import { legalCommentaryApiService } from '@services/legal-commentary';
import type { LawSummary, LegalArea, LegalHomeSnapshot, LegalSearchResult } from '@types';

type FilterKey = 'all' | string;

const EMPTY_LEGAL_HOME: LegalHomeSnapshot = {
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

const getUserId = (user: any) => user?.id || user?.userId || user?.email || null;

const getLawYear = (date?: string) => {
  if (!date) return '';
  const year = new Date(date).getFullYear();
  return Number.isFinite(year) ? String(year) : '';
};

const getAreaTitle = (area: LegalArea) =>
  area.name.startsWith('Legislação') || area.name.startsWith('Direitos') ? area.name : `Direito ${area.name}`;

const getLawChipLabel = (law: LawSummary) => law.acronym || law.shortTitle.replace('Constituição Federal', 'CF/88');

const AreaIcon: React.FC<{ area: LegalArea; size?: number }> = ({ area, size = 18 }) => {
  if (area.slug === 'constitucional') return <Scale size={size} />;
  if (area.slug === 'penal') return <Gavel size={size} />;
  if (area.slug === 'administrativo') return <Landmark size={size} />;
  return <BookOpen size={size} />;
};

const LawCard: React.FC<{
  law: LawSummary;
  onToggleFavorite: (law: LawSummary) => void;
  onPrefetch: (slug: string) => void;
}> = ({ law, onToggleFavorite, onPrefetch }) => (
  <article
    className="group flex min-h-[190px] flex-col justify-between rounded-[2rem] border border-slate-200 bg-white p-5 shadow-sm transition-all hover:border-indigo-200 hover:shadow-md dark:border-slate-800 dark:bg-slate-900 dark:hover:border-indigo-500/40"
    onMouseEnter={() => onPrefetch(law.slug)}
    onFocusCapture={() => onPrefetch(law.slug)}
    onTouchStart={() => onPrefetch(law.slug)}
  >
    <div className="flex items-start justify-between gap-4">
      <Link href={`/lei-comentada/${law.slug}`} className="min-w-0 flex-1">
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <span className="rounded-xl bg-slate-100 px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.16em] text-slate-600 dark:bg-slate-800 dark:text-slate-300">
            {law.acronym || law.number.split('/')[0]}
          </span>
          <span className="text-xs font-bold text-slate-400">{law.year || getLawYear(law.date)}</span>
          {law.isRecentlyUpdated ? (
            <span className="inline-flex items-center gap-1 rounded-xl bg-amber-50 px-2.5 py-1.5 text-[10px] font-black uppercase tracking-[0.16em] text-amber-700 dark:bg-amber-500/10 dark:text-amber-300">
              <AlertTriangle size={11} /> Atualizada
            </span>
          ) : null}
        </div>
        <h3 className="text-lg font-black leading-tight text-slate-900 transition-colors group-hover:text-indigo-600 dark:text-slate-100 dark:group-hover:text-indigo-300">
          {law.shortTitle}
        </h3>
        <p className="mt-2 line-clamp-2 text-sm font-medium leading-6 text-slate-500 dark:text-slate-400">
          {law.description || law.summary}
        </p>
      </Link>

      <button
        onClick={() => onToggleFavorite(law)}
        className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl transition-colors ${law.isFavorite ? 'bg-rose-50 text-rose-600 dark:bg-rose-500/10 dark:text-rose-300' : 'text-slate-300 hover:bg-rose-50 hover:text-rose-500 dark:hover:bg-rose-500/10'}`}
        title={law.isFavorite ? 'Remover dos favoritos' : 'Favoritar lei'}
      >
        <Heart size={17} fill={law.isFavorite ? 'currentColor' : 'none'} />
      </button>
    </div>

    <div className="mt-6 space-y-3">
      <div className="flex items-center justify-between gap-3">
        <span className="text-xs font-bold text-slate-500 dark:text-slate-400">
          {law.commentedArticleCount}/{law.articleCount} comentados
        </span>
        <span className="text-xs font-bold text-slate-400">{law.progressPercent || 0}% lido</span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
        <div
          className="h-full rounded-full bg-indigo-600 dark:bg-indigo-500"
          style={{ width: `${Math.min(100, Math.round((law.commentedArticleCount / Math.max(1, law.articleCount)) * 100))}%` }}
        />
      </div>
      <Link
        href={`/lei-comentada/${law.slug}`}
        className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-indigo-600 px-4 py-3 text-[11px] font-black uppercase tracking-[0.18em] text-white shadow-lg shadow-indigo-200/70 transition-all hover:-translate-y-0.5 hover:bg-indigo-700 hover:shadow-indigo-300/70 dark:bg-indigo-500 dark:shadow-none dark:hover:bg-indigo-400"
      >
        Abrir lei <ChevronRight size={14} />
      </Link>
    </div>
  </article>
);

const SearchResultCard: React.FC<{ result: LegalSearchResult }> = ({ result }) => (
  <Link
    href={`/lei-comentada/${result.lawSlug}${result.articleId ? `#${result.articleId}` : ''}`}
    className="block rounded-[1.6rem] border border-slate-200 bg-white p-5 shadow-sm transition-all hover:border-indigo-200 hover:shadow-md dark:border-slate-800 dark:bg-slate-900 dark:hover:border-indigo-500/40"
  >
    <div className="mb-3 flex items-center justify-between gap-3">
      <span className="rounded-xl bg-indigo-50 px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.16em] text-indigo-600 dark:bg-indigo-500/10 dark:text-indigo-300">
        {result.type.replace('_', ' ')}
      </span>
      <span className="text-[11px] font-bold text-slate-400">{result.areaName}</span>
    </div>
    <h3 className="text-sm font-black text-slate-900 dark:text-slate-100">{result.title}</h3>
    <p className="mt-2 line-clamp-2 text-xs font-medium leading-5 text-slate-500 dark:text-slate-400">{result.excerpt}</p>
  </Link>
);

const AnnotatedLawsPage: React.FC = () => {
  const { currentUser } = useAuth();
  const { systemSettings } = useData();
  const { addToast } = useToast();
  const userId = getUserId(currentUser);
  const isAdminPreview = Boolean((currentUser as any)?.isAdmin || (currentUser as any)?.role === 'admin' || (currentUser as any)?.role === 'editor');
  const isFeatureEnabled = resolveSystemFeatureFlag(systemSettings, 'annotatedLawsEnabled', true);
  const [snapshot, setSnapshot] = React.useState<LegalHomeSnapshot>(EMPTY_LEGAL_HOME);
  const [searchResults, setSearchResults] = React.useState<LegalSearchResult[]>([]);
  const [query, setQuery] = React.useState('');
  const [filter, setFilter] = React.useState<FilterKey>('all');
  const [isLoading, setIsLoading] = React.useState(true);

  React.useEffect(() => {
    let isCurrent = true;
    setIsLoading(true);

    legalCommentaryApiService.getHomeSnapshot()
      .then((nextSnapshot) => {
        if (isCurrent) setSnapshot(nextSnapshot);
      })
      .catch(() => {
        if (isCurrent) addToast('Nao foi possivel carregar as leis salvas no banco.', 'error');
      })
      .finally(() => {
        if (isCurrent) setIsLoading(false);
      });

    return () => {
      isCurrent = false;
    };
  }, [addToast, userId]);

  React.useEffect(() => {
    const normalizedQuery = query.trim();
    if (!normalizedQuery) {
      setSearchResults([]);
      return undefined;
    }

    let isCurrent = true;
    const timer = window.setTimeout(() => {
      legalCommentaryApiService.search(normalizedQuery)
        .then((results) => {
          if (isCurrent) setSearchResults(results);
        })
        .catch(() => {
          if (isCurrent) setSearchResults([]);
        });
    }, 250);

    return () => {
      isCurrent = false;
      window.clearTimeout(timer);
    };
  }, [query]);

  const filteredGroups = React.useMemo(() => {
    return snapshot.lawsByArea
      .map((group) => ({
        ...group,
        laws: filter === 'all' ? group.laws : group.area.id === filter ? group.laws : [],
      }))
      .filter((group) => group.laws.length > 0);
  }, [filter, snapshot.lawsByArea]);

  const reloadSnapshot = React.useCallback(async () => {
    const nextSnapshot = await legalCommentaryApiService.getHomeSnapshot();
    setSnapshot(nextSnapshot);
  }, []);

  const prefetchLawDetail = React.useCallback((slug: string) => {
    void legalCommentaryApiService.prefetchLawDetail(slug);
  }, []);

  const toggleFavorite = async (law: LawSummary) => {
    if (!currentUser) {
      addToast('Entre na sua conta para favoritar leis e artigos.', 'warning');
      return;
    }

    try {
      const result = await legalCommentaryApiService.toggleFavorite('law', law.id);
      await reloadSnapshot();
      addToast(result.isFavorite ? 'Lei adicionada aos favoritos.' : 'Lei removida dos favoritos.', 'success');
    } catch {
      addToast('Nao foi possivel atualizar o favorito.', 'error');
    }
  };

  if (!isFeatureEnabled && !isAdminPreview) {
    return (
      <BetaFeaturePage
        title="Lei Comentada"
        description="Consulta guiada de legislação com comentários, jurisprudência e acompanhamento de alterações."
        icon={FileText}
        isEnabled={false}
        featureLabel="Lei Comentada"
      />
    );
  }

  return (
    <div className="w-full space-y-6 animate-fade-in">
      <section className={`${PLATFORM_SURFACE_CARD_CLASS} overflow-hidden`}>
        <div className="grid gap-0 xl:grid-cols-[minmax(0,1fr)_360px]">
          <div className="px-6 py-7 md:px-8">
            <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
              <div className="flex min-w-0 items-start gap-4">
                <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-600 dark:bg-indigo-500/10 dark:text-indigo-300">
                  <FileText size={24} />
                </div>
                <div className="min-w-0">
                  <p className="text-[10px] font-black uppercase tracking-[0.22em] text-indigo-600 dark:text-indigo-300">
                    Biblioteca legislativa
                  </p>
                  <h1 className={`${PLATFORM_PAGE_TITLE_CLASS} mt-2`}>Lei Comentada</h1>
                  <p className={`${PLATFORM_PAGE_DESCRIPTION_CLASS} mt-2`}>
                    Legislação comentada artigo por artigo, com leitura limpa, fonte oficial e conteúdo focado em concursos.
                  </p>
                </div>
              </div>

              <div className="grid min-w-[min(100%,360px)] grid-cols-3 gap-3">
                <div className="rounded-2xl bg-slate-50 p-4 dark:bg-slate-800/70">
                  <p className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">Leis</p>
                  <p className="mt-2 text-2xl font-black text-slate-900 dark:text-slate-100">{snapshot.totals.laws}</p>
                </div>
                <div className="rounded-2xl bg-slate-50 p-4 dark:bg-slate-800/70">
                  <p className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">Artigos</p>
                  <p className="mt-2 text-2xl font-black text-slate-900 dark:text-slate-100">{snapshot.totals.articles}</p>
                </div>
                <div className="rounded-2xl bg-slate-50 p-4 dark:bg-slate-800/70">
                  <p className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">Atualiz.</p>
                  <p className="mt-2 text-2xl font-black text-slate-900 dark:text-slate-100">{snapshot.totals.updatedRecently}</p>
                </div>
              </div>
            </div>

            <div className="mt-7 max-w-4xl">
              <div className="relative">
                <Search className="pointer-events-none absolute left-5 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
                <input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Buscar lei, artigo, tema de concurso ou jurisprudência"
                  className="h-14 w-full rounded-2xl border border-slate-200 bg-slate-50 pl-12 pr-5 text-sm font-semibold text-slate-900 outline-none transition-all placeholder:text-slate-400 focus:border-indigo-300 focus:bg-white focus:ring-4 focus:ring-indigo-500/10 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100 dark:focus:border-indigo-500 dark:focus:bg-slate-900"
                />
              </div>
            </div>
          </div>

          <aside className="border-t border-slate-200 bg-slate-50 px-6 py-7 dark:border-slate-800 dark:bg-slate-950/70 md:px-8 xl:border-l xl:border-t-0">
            <div className="flex items-center gap-2">
              <Star size={17} className="text-indigo-600 dark:text-indigo-300" />
              <h2 className="text-sm font-black uppercase tracking-[0.18em] text-slate-700 dark:text-slate-200">Mais acessadas</h2>
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              {snapshot.mostAccessed.slice(0, 6).map((law) => (
                <Link
                  key={law.id}
                  href={`/lei-comentada/${law.slug}`}
                  onMouseEnter={() => prefetchLawDetail(law.slug)}
                  onFocus={() => prefetchLawDetail(law.slug)}
                  className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-black text-slate-600 transition-colors hover:border-indigo-200 hover:text-indigo-600 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300 dark:hover:border-indigo-500/40 dark:hover:text-indigo-300"
                >
                  {getLawChipLabel(law)}
                </Link>
              ))}
            </div>
          </aside>
        </div>
      </section>

      <div className="grid gap-6 xl:grid-cols-[290px_minmax(0,1fr)]">
        <aside className="space-y-4">
          <section className={`${PLATFORM_SURFACE_CARD_CLASS} p-4`}>
            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400 dark:text-slate-500">Áreas</p>
            <h2 className="mt-2 text-base font-black text-slate-900 dark:text-slate-100">Filtrar legislação</h2>
            <div className="mt-4 space-y-2">
              <button
                onClick={() => setFilter('all')}
                className={`flex w-full items-center justify-between rounded-2xl px-4 py-3 text-left text-sm font-black transition-all ${filter === 'all' ? 'bg-indigo-600 text-white shadow-sm' : 'bg-slate-50 text-slate-600 hover:bg-slate-100 hover:text-indigo-600 dark:bg-slate-800/70 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-indigo-300'}`}
              >
                Todas
                <span className="text-xs opacity-80">{snapshot.totals.laws}</span>
              </button>
              {snapshot.lawsByArea.map((group) => (
                <button
                  key={group.area.id}
                  onClick={() => setFilter(group.area.id)}
                  className={`flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-left transition-all ${filter === group.area.id ? 'bg-indigo-50 text-indigo-700 ring-1 ring-indigo-100 dark:bg-indigo-500/10 dark:text-indigo-300 dark:ring-indigo-500/20' : 'bg-slate-50 text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:bg-slate-800/70 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-slate-100'}`}
                >
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-white text-indigo-600 dark:bg-slate-900 dark:text-indigo-300">
                    <AreaIcon area={group.area} size={16} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-black">{getAreaTitle(group.area)}</span>
                    <span className="block text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400">{group.laws.length} leis</span>
                  </span>
                </button>
              ))}
            </div>
          </section>

          <section className={`${PLATFORM_SURFACE_CARD_CLASS} p-4`}>
            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400 dark:text-slate-500">Seu estudo</p>
            <div className="mt-4 space-y-3">
              <div className="rounded-2xl bg-slate-50 p-4 dark:bg-slate-800/70">
                <p className="text-xs font-black text-slate-900 dark:text-slate-100">Favoritas</p>
                <p className="mt-1 text-xs font-medium leading-5 text-slate-500 dark:text-slate-400">{snapshot.favoriteLaws.length || 0} leis salvas</p>
              </div>
              <div className="rounded-2xl bg-slate-50 p-4 dark:bg-slate-800/70">
                <p className="text-xs font-black text-slate-900 dark:text-slate-100">Recentes</p>
                <p className="mt-1 text-xs font-medium leading-5 text-slate-500 dark:text-slate-400">{snapshot.recentlyStudied.length || 0} leis estudadas</p>
              </div>
            </div>
          </section>
        </aside>

        <section className="min-w-0 space-y-6">
          {query.trim() ? (
            <section className="space-y-4">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400 dark:text-slate-500">Busca</p>
                  <h2 className={PLATFORM_SECTION_TITLE_CLASS}>Resultados encontrados</h2>
                </div>
                <span className="self-start rounded-2xl bg-slate-100 px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.16em] text-slate-500 dark:bg-slate-800 dark:text-slate-400 sm:self-auto">
                  {searchResults.length} item(ns)
                </span>
              </div>
              <div className="grid gap-4 lg:grid-cols-2 2xl:grid-cols-3">
                {searchResults.length > 0 ? (
                  searchResults.map((result) => <SearchResultCard key={result.id} result={result} />)
                ) : (
                  <div className={`${PLATFORM_SURFACE_CARD_CLASS} p-10 text-center lg:col-span-2 2xl:col-span-3`}>
                    <Search className="mx-auto mb-3 text-slate-300 dark:text-slate-600" size={34} />
                    <p className="text-sm font-black text-slate-900 dark:text-slate-100">Nenhum resultado encontrado.</p>
                    <p className="mt-1 text-sm font-medium text-slate-500 dark:text-slate-400">Tente pelo número da lei, artigo, apelido ou tema de prova.</p>
                  </div>
                )}
              </div>
            </section>
          ) : (
            <section className="space-y-7">
              {isLoading ? (
                <div className={`${PLATFORM_SURFACE_CARD_CLASS} p-10 text-center`}>
                  <BookOpen className="mx-auto mb-4 text-slate-300 dark:text-slate-600" size={36} />
                  <h3 className="text-lg font-black text-slate-900 dark:text-slate-100">Carregando leis salvas...</h3>
                  <p className="mt-2 text-sm font-medium text-slate-500 dark:text-slate-400">A biblioteca vem direto do banco da plataforma.</p>
                </div>
              ) : filteredGroups.length > 0 ? filteredGroups.map((group) => (
                <div key={group.area.id} className="space-y-4">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-600 dark:bg-indigo-500/10 dark:text-indigo-300">
                        <AreaIcon area={group.area} />
                      </div>
                      <div>
                        <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400 dark:text-slate-500">Área do direito</p>
                        <h2 className={PLATFORM_SECTION_TITLE_CLASS}>{getAreaTitle(group.area)}</h2>
                      </div>
                    </div>
                    <span className="self-start rounded-2xl bg-slate-100 px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.16em] text-slate-500 dark:bg-slate-800 dark:text-slate-400 sm:self-auto">
                      {group.laws.length} leis
                    </span>
                  </div>

                  <div className="grid gap-4 lg:grid-cols-2">
                    {group.laws.map((law) => (
                      <LawCard key={law.id} law={law} onToggleFavorite={toggleFavorite} onPrefetch={prefetchLawDetail} />
                    ))}
                  </div>
                </div>
              )) : (
                <div className={`${PLATFORM_SURFACE_CARD_CLASS} p-10 text-center`}>
                  <BookOpen className="mx-auto mb-4 text-slate-300 dark:text-slate-600" size={36} />
                  <h3 className="text-lg font-black text-slate-900 dark:text-slate-100">Nada para exibir neste filtro.</h3>
                  <p className="mt-2 text-sm font-medium text-slate-500 dark:text-slate-400">Altere a área para ver outras leis comentadas.</p>
                </div>
              )}
            </section>
          )}
        </section>
      </div>
    </div>
  );
};

export default AnnotatedLawsPage;
