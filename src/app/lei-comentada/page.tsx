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
} from 'lucide-react';
import { useAuth } from '@providers/AuthProvider';
import { useData } from '@providers/DataProvider';
import { useToast } from '@providers/ToastProvider';
import {
  PLATFORM_PAGE_DESCRIPTION_CLASS,
  PLATFORM_PAGE_TITLE_CLASS,
  PLATFORM_SECTION_TITLE_CLASS,
} from '@constants/layout';
import BetaFeaturePage from '../../components/shared/feedback/BetaFeaturePage';
import { resolveSystemFeatureFlag } from '@services/system/moduleFlags';
import { legalCommentaryApiService } from '@services/legal-commentary';
import type { LawSummary, LegalArea, LegalHomeSnapshot, LegalSearchResult } from '@types';

type FilterKey = 'all' | string;

const PANEL_CLASS = 'rounded-3xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900';
const MUTED_CELL_CLASS = 'rounded-2xl bg-slate-50 dark:bg-slate-800/70';

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

const applyLawFavoriteToSnapshot = (
  snapshot: LegalHomeSnapshot,
  lawId: string,
  isFavorite: boolean,
): LegalHomeSnapshot => {
  const updateLaw = (law: LawSummary): LawSummary => (
    String(law.id) === String(lawId) ? { ...law, isFavorite } : law
  );

  const lawsByArea = snapshot.lawsByArea.map((group) => ({
    ...group,
    laws: group.laws.map(updateLaw),
  }));
  const allLaws = lawsByArea.flatMap((group) => group.laws);

  return {
    ...snapshot,
    lawsByArea,
    mostAccessed: snapshot.mostAccessed.map(updateLaw),
    favoriteLaws: allLaws.filter((law) => law.isFavorite),
    recentlyStudied: snapshot.recentlyStudied.map(updateLaw),
    recentlyUpdated: snapshot.recentlyUpdated.map(updateLaw),
  };
};

const AreaIcon: React.FC<{ area: LegalArea; size?: number }> = ({ area, size = 18 }) => {
  if (area.slug === 'constitucional') return <Scale size={size} />;
  if (area.slug === 'penal') return <Gavel size={size} />;
  if (area.slug === 'administrativo') return <Landmark size={size} />;
  return <BookOpen size={size} />;
};

const MetricBox = ({
  label,
  value,
  helper,
}: {
  label: string;
  value: string | number;
  helper?: string;
}) => (
  <div className={MUTED_CELL_CLASS}>
    <div className="px-3 py-2.5">
      <p className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-400 dark:text-slate-500">{label}</p>
      <p className="mt-1 text-xl font-black tracking-tight text-slate-900 dark:text-slate-100">{value}</p>
      {helper ? <p className="mt-0.5 truncate text-[11px] font-semibold text-slate-500 dark:text-slate-400">{helper}</p> : null}
    </div>
  </div>
);

const ProgressBar = ({ value }: { value: number }) => (
  <div className="h-2 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800">
    <div
      className="h-full rounded-full bg-indigo-600 dark:bg-indigo-500"
      style={{ width: `${Math.max(0, Math.min(100, Math.round(value || 0)))}%` }}
    />
  </div>
);

const LawCard: React.FC<{
  law: LawSummary;
  onToggleFavorite: (law: LawSummary) => void;
  onPrefetch: (slug: string) => void;
}> = ({ law, onToggleFavorite, onPrefetch }) => {
  const commentedPercent = Math.round((law.commentedArticleCount / Math.max(1, law.articleCount)) * 100);
  const readPercent = Math.max(0, Math.min(100, Math.round(law.progressPercent || 0)));

  return (
    <article
      className={`${PANEL_CLASS} group flex min-h-[166px] flex-col p-4 transition-colors hover:border-indigo-300 dark:hover:border-indigo-500/50`}
      onMouseEnter={() => onPrefetch(law.slug)}
      onFocusCapture={() => onPrefetch(law.slug)}
      onTouchStart={() => onPrefetch(law.slug)}
    >
      <div className="flex min-w-0 items-start gap-3">
        <Link href={`/lei-comentada/${law.slug}`} className="min-w-0 flex-1">
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <span className="rounded-xl bg-slate-100 px-2 py-1 text-[10px] font-black uppercase tracking-[0.14em] text-slate-600 dark:bg-slate-800 dark:text-slate-300">
              {law.acronym || law.number.split('/')[0]}
            </span>
            <span className="text-[11px] font-bold text-slate-400">{law.year || getLawYear(law.date)}</span>
            {law.isRecentlyUpdated ? (
              <span className="inline-flex items-center gap-1 rounded-xl bg-amber-50 px-2 py-1 text-[10px] font-black uppercase tracking-[0.14em] text-amber-700 dark:bg-amber-500/10 dark:text-amber-300">
                <AlertTriangle size={11} /> Atualizada
              </span>
            ) : null}
          </div>
          <h3 className="line-clamp-2 text-base font-black leading-tight text-slate-900 transition-colors group-hover:text-indigo-600 dark:text-slate-100 dark:group-hover:text-indigo-300">
            {law.shortTitle}
          </h3>
          <p className="mt-2 line-clamp-2 text-sm font-medium leading-6 text-slate-500 dark:text-slate-400">
            {law.description || law.summary}
          </p>
        </Link>

        <button
          type="button"
          onClick={() => onToggleFavorite(law)}
          className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl transition-colors ${law.isFavorite ? 'bg-rose-50 text-rose-600 dark:bg-rose-500/10 dark:text-rose-300' : 'text-slate-300 hover:bg-rose-50 hover:text-rose-500 dark:hover:bg-rose-500/10'}`}
          title={law.isFavorite ? 'Remover dos favoritos' : 'Favoritar lei'}
        >
          <Heart size={16} fill={law.isFavorite ? 'currentColor' : 'none'} />
        </button>
      </div>

      <div className="mt-auto pt-4">
        <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
          <div>
            <div className="mb-1 flex items-center justify-between gap-2 text-[11px] font-bold text-slate-500 dark:text-slate-400">
              <span>Comentados</span>
              <span>{law.commentedArticleCount}/{law.articleCount}</span>
            </div>
            <ProgressBar value={commentedPercent} />
          </div>
          <div>
            <div className="mb-1 flex items-center justify-between gap-2 text-[11px] font-bold text-slate-500 dark:text-slate-400">
              <span>Leitura</span>
              <span>{readPercent}%</span>
            </div>
            <ProgressBar value={readPercent} />
          </div>
        </div>

        <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-3 dark:border-slate-800">
          <span className="text-xs font-semibold text-slate-400">{law.articleCount} artigos</span>
          <Link
            href={`/lei-comentada/${law.slug}`}
            className="inline-flex h-9 items-center gap-2 rounded-xl bg-indigo-600 px-3 text-xs font-black text-white transition-colors hover:bg-indigo-700 dark:bg-indigo-500 dark:hover:bg-indigo-400"
          >
            Abrir <ChevronRight size={14} />
          </Link>
        </div>
      </div>
    </article>
  );
};

const SearchResultCard: React.FC<{ result: LegalSearchResult }> = ({ result }) => (
  <Link
    href={`/lei-comentada/${result.lawSlug}${result.articleId ? `#${result.articleId}` : ''}`}
    className={`${PANEL_CLASS} block p-4 transition-colors hover:border-indigo-300 dark:hover:border-indigo-500/50`}
  >
    <div className="mb-2 flex min-w-0 items-center justify-between gap-3">
      <span className="rounded-xl bg-indigo-50 px-2 py-1 text-[10px] font-black uppercase tracking-[0.14em] text-indigo-600 dark:bg-indigo-500/10 dark:text-indigo-300">
        {result.type.replace('_', ' ')}
      </span>
      <span className="truncate text-[11px] font-bold text-slate-400">{result.areaName}</span>
    </div>
    <h3 className="line-clamp-2 text-sm font-black text-slate-900 dark:text-slate-100">{result.title}</h3>
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
        if (isCurrent) addToast('Não foi possível carregar as leis salvas no banco.', 'error');
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
      try {
        const nextSnapshot = await legalCommentaryApiService.getHomeSnapshot({ force: true });
        setSnapshot(applyLawFavoriteToSnapshot(nextSnapshot, law.id, result.isFavorite));
      } catch {
        setSnapshot((current) => applyLawFavoriteToSnapshot(current, law.id, result.isFavorite));
      }
      addToast(result.isFavorite ? 'Lei adicionada aos favoritos.' : 'Lei removida dos favoritos.', 'success');
    } catch {
      addToast('Não foi possível atualizar o favorito.', 'error');
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
    <div className="w-full space-y-5 animate-fade-in">
      <header className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div className="min-w-0">
          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-indigo-600 dark:text-indigo-300">
            Biblioteca legislativa
          </p>
          <h1 className={`${PLATFORM_PAGE_TITLE_CLASS} mt-1 flex items-center gap-2`}>
            <FileText className="text-indigo-600 dark:text-indigo-300" size={24} /> Lei Comentada
          </h1>
          <p className={`${PLATFORM_PAGE_DESCRIPTION_CLASS} mt-1 max-w-3xl`}>
            Legislação comentada artigo por artigo, com texto oficial, conteúdo de prova e leitura organizada.
          </p>
        </div>

        <div className="grid gap-2 sm:grid-cols-3 md:w-[430px]">
          <MetricBox label="Leis" value={snapshot.totals.laws} />
          <MetricBox label="Artigos" value={snapshot.totals.articles} />
          <MetricBox label="Atualizadas" value={snapshot.totals.updatedRecently} />
        </div>
      </header>

      <section className={`${PANEL_CLASS} p-4`}>
        <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px] xl:items-start">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Buscar lei, artigo, tema de concurso ou jurisprudência"
              className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 pl-10 pr-4 text-sm font-semibold text-slate-900 outline-none transition-all placeholder:text-slate-400 focus:border-indigo-300 focus:bg-white focus:ring-4 focus:ring-indigo-500/10 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100 dark:focus:border-indigo-500 dark:focus:bg-slate-900"
            />
          </div>

          <div className="min-w-0">
            <p className="mb-2 text-[10px] font-black uppercase tracking-[0.16em] text-slate-400 dark:text-slate-500">Mais acessadas</p>
            <div className="flex gap-2 overflow-x-auto pb-1 xl:flex-wrap xl:overflow-visible xl:pb-0">
              {snapshot.mostAccessed.slice(0, 6).map((law) => (
                <Link
                  key={law.id}
                  href={`/lei-comentada/${law.slug}`}
                  onMouseEnter={() => prefetchLawDetail(law.slug)}
                  onFocus={() => prefetchLawDetail(law.slug)}
                  className="shrink-0 rounded-xl border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-xs font-black text-slate-600 transition-colors hover:border-indigo-300 hover:text-indigo-600 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-300 dark:hover:border-indigo-500/40 dark:hover:text-indigo-300"
                >
                  {getLawChipLabel(law)}
                </Link>
              ))}
            </div>
          </div>
        </div>
      </section>

      <div className="grid gap-5 xl:grid-cols-[270px_minmax(0,1fr)]">
        <aside className="space-y-4 xl:sticky xl:top-4 xl:self-start">
          <section className={`${PANEL_CLASS} p-3`}>
            <div className="px-1 pb-2">
              <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400 dark:text-slate-500">Áreas</p>
              <h2 className="mt-1 text-base font-black text-slate-900 dark:text-slate-100">Filtrar legislação</h2>
            </div>
            <div className="space-y-1.5">
              <button
                type="button"
                onClick={() => setFilter('all')}
                className={`flex h-10 w-full items-center justify-between rounded-xl px-3 text-left text-sm font-black transition-colors ${filter === 'all' ? 'bg-indigo-600 text-white' : 'text-slate-600 hover:bg-slate-100 hover:text-indigo-600 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-indigo-300'}`}
              >
                Todas
                <span className="text-xs opacity-80">{snapshot.totals.laws}</span>
              </button>
              {snapshot.lawsByArea.map((group) => (
                <button
                  key={group.area.id}
                  type="button"
                  onClick={() => setFilter(group.area.id)}
                  className={`flex min-h-11 w-full items-center gap-3 rounded-xl px-3 py-2 text-left transition-colors ${filter === group.area.id ? 'bg-indigo-50 text-indigo-700 ring-1 ring-indigo-100 dark:bg-indigo-500/10 dark:text-indigo-300 dark:ring-indigo-500/20' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-slate-100'}`}
                >
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-xl bg-white text-indigo-600 ring-1 ring-slate-200 dark:bg-slate-950 dark:text-indigo-300 dark:ring-slate-800">
                    <AreaIcon area={group.area} size={15} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-black">{getAreaTitle(group.area)}</span>
                    <span className="block text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400">{group.laws.length} leis</span>
                  </span>
                </button>
              ))}
            </div>
          </section>

          <section className={`${PANEL_CLASS} p-3`}>
            <div className="px-1 pb-2">
              <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400 dark:text-slate-500">Seu estudo</p>
            </div>
            <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-1">
              <div className={MUTED_CELL_CLASS}>
                <div className="px-3 py-2.5">
                  <p className="text-xs font-black text-slate-900 dark:text-slate-100">Favoritas</p>
                  <p className="mt-1 text-xs font-medium leading-5 text-slate-500 dark:text-slate-400">{snapshot.favoriteLaws.length || 0} leis salvas</p>
                </div>
              </div>
              <div className={MUTED_CELL_CLASS}>
                <div className="px-3 py-2.5">
                  <p className="text-xs font-black text-slate-900 dark:text-slate-100">Recentes</p>
                  <p className="mt-1 text-xs font-medium leading-5 text-slate-500 dark:text-slate-400">{snapshot.recentlyStudied.length || 0} leis estudadas</p>
                </div>
              </div>
            </div>
          </section>
        </aside>

        <section className="min-w-0 space-y-5">
          {query.trim() ? (
            <section className="space-y-4">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400 dark:text-slate-500">Busca</p>
                  <h2 className={PLATFORM_SECTION_TITLE_CLASS}>Resultados encontrados</h2>
                </div>
                <span className="self-start rounded-xl bg-slate-100 px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.14em] text-slate-500 dark:bg-slate-800 dark:text-slate-400 sm:self-auto">
                  {searchResults.length} item(ns)
                </span>
              </div>
              <div className="grid gap-3 lg:grid-cols-2 2xl:grid-cols-3">
                {searchResults.length > 0 ? (
                  searchResults.map((result) => <SearchResultCard key={result.id} result={result} />)
                ) : (
                  <div className={`${PANEL_CLASS} p-8 text-center lg:col-span-2 2xl:col-span-3`}>
                    <Search className="mx-auto mb-3 text-slate-300 dark:text-slate-600" size={32} />
                    <p className="text-sm font-black text-slate-900 dark:text-slate-100">Nenhum resultado encontrado.</p>
                    <p className="mt-1 text-sm font-medium text-slate-500 dark:text-slate-400">Tente pelo número da lei, artigo, apelido ou tema de prova.</p>
                  </div>
                )}
              </div>
            </section>
          ) : (
            <section className="space-y-6">
              {isLoading ? (
                <div className={`${PANEL_CLASS} p-8 text-center`}>
                  <BookOpen className="mx-auto mb-4 text-slate-300 dark:text-slate-600" size={36} />
                  <h3 className="text-lg font-black text-slate-900 dark:text-slate-100">Carregando leis salvas...</h3>
                  <p className="mt-2 text-sm font-medium text-slate-500 dark:text-slate-400">A biblioteca vem direto do banco da plataforma.</p>
                </div>
              ) : filteredGroups.length > 0 ? filteredGroups.map((group) => (
                <div key={group.area.id} className="space-y-3">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex min-w-0 items-center gap-3">
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600 dark:bg-indigo-500/10 dark:text-indigo-300">
                        <AreaIcon area={group.area} />
                      </div>
                      <div className="min-w-0">
                        <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400 dark:text-slate-500">Área do direito</p>
                        <h2 className={`${PLATFORM_SECTION_TITLE_CLASS} truncate`}>{getAreaTitle(group.area)}</h2>
                      </div>
                    </div>
                    <span className="self-start rounded-xl bg-slate-100 px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.14em] text-slate-500 dark:bg-slate-800 dark:text-slate-400 sm:self-auto">
                      {group.laws.length} leis
                    </span>
                  </div>

                  <div className="grid gap-3 lg:grid-cols-2">
                    {group.laws.map((law) => (
                      <LawCard key={law.id} law={law} onToggleFavorite={toggleFavorite} onPrefetch={prefetchLawDetail} />
                    ))}
                  </div>
                </div>
              )) : (
                <div className={`${PANEL_CLASS} p-8 text-center`}>
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
