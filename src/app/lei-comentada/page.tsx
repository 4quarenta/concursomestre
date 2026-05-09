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
  ArrowRight,
  BadgeCheck,
  BookOpen,
  BookText,
  BriefcaseBusiness,
  ChevronRight,
  Clock3,
  FileText,
  Gavel,
  Heart,
  Landmark,
  Library,
  NotebookPen,
  Search,
  Shield,
  Sparkles,
  Scale,
  X,
} from 'lucide-react';
import { useAuth } from '@providers/AuthProvider';
import { useAppConfigStore } from '@/state/app-config/appConfigStore';
import { useStudyTracker } from '@providers/StudyTrackerProvider';
import { useToast } from '@providers/ToastProvider';
import {
  PLATFORM_METRIC_VALUE_CLASS,
  PLATFORM_PAGE_DESCRIPTION_CLASS,
  PLATFORM_PAGE_TITLE_CLASS,
  PLATFORM_SECTION_TITLE_CLASS,
  PLATFORM_SURFACE_CARD_CLASS,
} from '@constants/layout';
import BetaFeaturePage from '../../components/shared/feedback/BetaFeaturePage';
import { resolveSystemFeatureFlag } from '@services/system/moduleFlags';
import { formatStudyDuration } from '@services/statistics/studyTimeFormatting';
import { legalCommentaryApiService } from '@services/legal-commentary';
import type { LawSummary, LegalArea, LegalHomeSnapshot, LegalSearchResult } from '@types';

type UserLike = {
  id?: string;
  userId?: string;
  email?: string;
  isAdmin?: boolean;
  role?: string;
} | null;

type AreaFilter = 'all' | string;
type TypeFilter = 'all' | string;
type SortMode = 'study' | 'access';
type ViewMode = 'list' | 'grid';

type AreaLibraryCard = {
  area: LegalArea;
  laws: LawSummary[];
  topLaw: LawSummary | null;
  lawCount: number;
  totalArticles: number;
  progressPercent: number;
  studyScore: number;
  accessScore: number;
};

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

const FILTER_FIELD_CLASS =
  'h-11 rounded-2xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 outline-none transition-all focus:border-[#615fff]/35 focus:ring-4 focus:ring-[#615fff]/10 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-200';

const CHIP_BUTTON_CLASS =
  'inline-flex h-10 items-center rounded-2xl border border-slate-200 bg-white px-3.5 text-xs font-bold text-slate-600 transition-all hover:border-[#615fff]/30 hover:text-[#615fff] dark:border-slate-800 dark:bg-slate-950 dark:text-slate-300 dark:hover:border-[#615fff]/35 dark:hover:text-indigo-200';

const INNER_CARD_CLASS =
  'rounded-[1.5rem] border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-950';

const formatNumber = (value: number) => new Intl.NumberFormat('pt-BR').format(Number(value || 0));

const formatArticleCount = (value: number) => `${formatNumber(value)} artigos`;

const clampPercent = (value: number) => Math.max(0, Math.min(100, Math.round(Number(value || 0))));

const formatLawDate = (value?: string) => {
  if (!value) return '--';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '--';
  return new Intl.DateTimeFormat('pt-BR').format(date);
};

const normalizeText = (value: unknown) => String(value || '')
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .toLowerCase()
  .trim();

const getUserId = (user: UserLike) => user?.id || user?.userId || user?.email || null;

const getAreaTitle = (area: LegalArea) => (
  area.name.startsWith('Direito') ? area.name : `Direito ${area.name}`
);

const getAreaDescription = (area: LegalArea, topLaw?: LawSummary | null) => {
  const baseDescription = String(area.description || '').trim();
  if (baseDescription) {
    return baseDescription;
  }

  const fallback = String(topLaw?.summary || topLaw?.description || '').trim();
  if (fallback) {
    return fallback;
  }

  return 'Acervo organizado para leitura guiada, revisão e estudo com foco em prova.';
};

const getLawChipLabel = (law: LawSummary) => {
  if (law.acronym) return law.acronym;
  if (law.shortTitle.includes('Constituição Federal')) return 'CF/88';
  return law.shortTitle.length > 22 ? `${law.shortTitle.slice(0, 22)}...` : law.shortTitle;
};

const getLawType = (law: LawSummary) => {
  const haystack = normalizeText([
    law.acronym,
    law.shortTitle,
    law.title,
    law.number,
    law.description,
  ].join(' '));

  if (haystack.includes('constituicao')) return 'Constituição';
  if (haystack.includes('codigo') || ['cp', 'cpp', 'cc', 'cpc'].includes(normalizeText(law.acronym))) return 'Código';
  if (haystack.includes('estatuto')) return 'Estatuto';
  if (haystack.includes('lei complementar')) return 'Lei complementar';
  if (haystack.includes('consolidacao') || normalizeText(law.acronym) === 'clt') return 'Consolidação';
  return 'Lei especial';
};

const getStudyRelevanceScore = (law: LawSummary) => (
  Number(law.examTipCount || 0) * 5
  + Number(law.jurisprudenceCount || 0) * 4
  + Number(law.commentedArticleCount || 0) * 2
  + Number(law.accessCount || 0) * 0.35
);

const getAreaTone = (slug: string) => {
  const normalized = normalizeText(slug);

  if (normalized.includes('constitucional')) {
    return {
      icon: Scale,
      iconBoxClassName: 'bg-[#615fff]/10 text-[#615fff] dark:bg-indigo-500/15 dark:text-indigo-200',
      accentClassName: 'text-[#615fff] dark:text-indigo-200',
      progressClassName: 'from-[#615fff] to-indigo-500',
    };
  }

  if (normalized.includes('civil')) {
    return {
      icon: BookOpen,
      iconBoxClassName: 'bg-sky-100 text-sky-600 dark:bg-sky-500/15 dark:text-sky-200',
      accentClassName: 'text-sky-600 dark:text-sky-200',
      progressClassName: 'from-sky-500 to-cyan-400',
    };
  }

  if (normalized.includes('penal') && normalized.includes('processual')) {
    return {
      icon: FileText,
      iconBoxClassName: 'bg-amber-100 text-amber-600 dark:bg-amber-500/15 dark:text-amber-200',
      accentClassName: 'text-amber-600 dark:text-amber-200',
      progressClassName: 'from-amber-500 to-orange-400',
    };
  }

  if (normalized.includes('penal')) {
    return {
      icon: Gavel,
      iconBoxClassName: 'bg-emerald-100 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-200',
      accentClassName: 'text-emerald-600 dark:text-emerald-200',
      progressClassName: 'from-emerald-500 to-teal-400',
    };
  }

  if (normalized.includes('administrativo')) {
    return {
      icon: Landmark,
      iconBoxClassName: 'bg-rose-100 text-rose-600 dark:bg-rose-500/15 dark:text-rose-200',
      accentClassName: 'text-rose-600 dark:text-rose-200',
      progressClassName: 'from-rose-500 to-pink-400',
    };
  }

  if (normalized.includes('trabalho')) {
    return {
      icon: BriefcaseBusiness,
      iconBoxClassName: 'bg-violet-100 text-violet-600 dark:bg-violet-500/15 dark:text-violet-200',
      accentClassName: 'text-violet-600 dark:text-violet-200',
      progressClassName: 'from-violet-500 to-fuchsia-400',
    };
  }

  return {
    icon: Library,
    iconBoxClassName: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-200',
    accentClassName: 'text-slate-700 dark:text-slate-200',
    progressClassName: 'from-slate-500 to-slate-400',
  };
};

const buildQuickAccessLaws = (allLaws: LawSummary[], fallbackLaws: LawSummary[]) => {
  const desiredQuickLinks = [
    {
      key: 'cf88',
      label: 'CF/88',
      matcher: (law: LawSummary) => normalizeText([law.acronym, law.shortTitle, law.title].join(' ')).includes('constituicao federal'),
    },
    {
      key: 'lmp',
      label: 'LMP',
      matcher: (law: LawSummary) => {
        const haystack = normalizeText([law.shortTitle, law.title, law.number].join(' '));
        return haystack.includes('maria da penha') || haystack.includes('11340');
      },
    },
    {
      key: 'cp',
      label: 'Código Penal',
      matcher: (law: LawSummary) => {
        const haystack = normalizeText([law.acronym, law.shortTitle, law.title].join(' '));
        return haystack.includes('codigo penal') || normalizeText(law.acronym) === 'cp';
      },
    },
    {
      key: '9455',
      label: 'Lei 9.455',
      matcher: (law: LawSummary) => normalizeText(law.number).includes('9455'),
    },
  ];

  const seen = new Set<string>();
  const matches = desiredQuickLinks
    .map((config) => {
      const match = allLaws.find((law) => config.matcher(law));
      if (!match) return null;
      seen.add(match.id);
      return {
        law: match,
        label: config.label,
      };
    })
    .filter((entry): entry is { law: LawSummary; label: string } => Boolean(entry));

  if (matches.length >= 4) {
    return matches.slice(0, 4);
  }

  const fallback = fallbackLaws
    .filter((law) => !seen.has(law.id))
    .slice(0, 4 - matches.length)
    .map((law) => ({
      law,
      label: getLawChipLabel(law),
    }));

  return [...matches, ...fallback];
};

const ProgressBar = ({
  value,
  gradientClassName,
}: {
  value: number;
  gradientClassName: string;
}) => (
  <div className="h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
    <div
      className={`h-full rounded-full bg-gradient-to-r ${gradientClassName}`}
      style={{ width: `${clampPercent(value)}%` }}
    />
  </div>
);

const MetricBox = ({
  label,
  value,
}: {
  label: string;
  value: string | number;
}) => (
  <div className={`${INNER_CARD_CLASS} px-4 py-3.5`}>
    <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400 dark:text-slate-500">{label}</p>
    <p className={`${PLATFORM_METRIC_VALUE_CLASS} mt-2 text-[2rem]`}>{value}</p>
  </div>
);

const CircularProgress = ({
  value,
  label,
}: {
  value: number;
  label: string;
}) => {
  const percent = clampPercent(value);

  return (
    <div className="mx-auto flex w-full max-w-[220px] flex-col items-center gap-4">
      <div
        className="relative h-36 w-36 rounded-full"
        style={{
          background: `conic-gradient(#615fff 0deg ${percent * 3.6}deg, rgba(226,232,240,1) ${percent * 3.6}deg 360deg)`,
        }}
      >
        <div className="absolute inset-[14px] flex flex-col items-center justify-center rounded-full bg-white dark:bg-slate-900">
          <span className="text-3xl font-black tracking-tight text-slate-900 dark:text-slate-100">{percent}%</span>
          <span className="mt-1 text-[10px] font-black uppercase tracking-[0.16em] text-slate-400 dark:text-slate-500">{label}</span>
        </div>
      </div>
    </div>
  );
};

const StudyStatRow = ({
  icon: Icon,
  title,
  helper,
  toneClassName,
}: {
  icon: React.ElementType;
  title: string;
  helper: string;
  toneClassName: string;
}) => (
  <div className="flex items-center gap-3 rounded-[1.35rem] bg-slate-50 px-3 py-3 dark:bg-slate-950/60">
    <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl ${toneClassName}`}>
      <Icon size={17} />
    </span>
    <div className="min-w-0">
      <p className="text-sm font-black text-slate-900 dark:text-slate-100">{title}</p>
      <p className="mt-0.5 text-xs font-medium text-slate-500 dark:text-slate-400">{helper}</p>
    </div>
  </div>
);

const SearchResultCard = ({ result }: { result: LegalSearchResult }) => (
  <Link
    href={`/lei-comentada/${result.lawSlug}${result.articleId ? `#${result.articleId}` : ''}`}
    className={`${PLATFORM_SURFACE_CARD_CLASS} block p-5 transition-all hover:-translate-y-0.5 hover:border-[#615fff]/25 hover:shadow-lg hover:shadow-[#615fff]/10`}
  >
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0">
        <span className="inline-flex rounded-full bg-[#615fff]/10 px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.14em] text-[#615fff] dark:bg-indigo-500/15 dark:text-indigo-200">
          {result.type.replace('_', ' ')}
        </span>
        <h3 className="mt-3 line-clamp-2 text-base font-black leading-tight text-slate-900 dark:text-slate-100">{result.title}</h3>
      </div>
      <ArrowRight size={16} className="shrink-0 text-slate-300 dark:text-slate-600" />
    </div>
    <p className="mt-3 line-clamp-2 text-sm font-medium leading-6 text-slate-500 dark:text-slate-400">{result.excerpt}</p>
    <p className="mt-3 text-[11px] font-bold uppercase tracking-[0.14em] text-slate-400 dark:text-slate-500">{result.areaName}</p>
  </Link>
);

const AreaModal = ({
  entry,
  isOpen,
  query,
  onQueryChange,
  onClose,
  onPrefetch,
  topAccessLawIds,
}: {
  entry: AreaLibraryCard | null;
  isOpen: boolean;
  query: string;
  onQueryChange: (value: string) => void;
  onClose: () => void;
  onPrefetch: (slug: string) => void;
  topAccessLawIds: Set<string>;
}) => {
  React.useEffect(() => {
    if (!isOpen) {
      return undefined;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('keydown', handleEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', handleEscape);
    };
  }, [isOpen, onClose]);

  const filteredLaws = React.useMemo(() => {
    if (!entry) return [];
    const normalizedQuery = normalizeText(query);
    if (!normalizedQuery) return entry.laws;

    return entry.laws.filter((law) => normalizeText([
      law.shortTitle,
      law.title,
      law.acronym,
      law.number,
      law.summary,
      law.description,
    ].join(' ')).includes(normalizedQuery));
  }, [entry, query]);

  if (!isOpen || !entry) return null;

  const tone = getAreaTone(entry.area.slug);
  const Icon = tone.icon;

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-slate-950/40 p-4 backdrop-blur-sm" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`Leis da area ${getAreaTitle(entry.area)}`}
        className="max-h-[92vh] w-full max-w-4xl overflow-hidden rounded-[2rem] border border-slate-200 bg-white shadow-[0_30px_80px_-40px_rgba(15,23,42,0.45)] dark:border-slate-800 dark:bg-slate-900"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4 border-b border-slate-100 px-6 py-6 dark:border-slate-800">
          <div className="flex min-w-0 items-start gap-4">
            <span className={`flex h-16 w-16 shrink-0 items-center justify-center rounded-[1.75rem] ${tone.iconBoxClassName}`}>
              <Icon size={30} />
            </span>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-[1.85rem] font-black tracking-tight text-slate-900 dark:text-slate-100">{getAreaTitle(entry.area)}</h2>
                <span className="inline-flex rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.14em] text-slate-500 dark:bg-slate-800 dark:text-slate-300">
                  {entry.lawCount} {entry.lawCount === 1 ? 'lei' : 'leis'}
                </span>
              </div>
              <p className="mt-2 max-w-2xl text-sm font-medium leading-6 text-slate-500 dark:text-slate-400">
                {getAreaDescription(entry.area, entry.topLaw)}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-10 w-10 items-center justify-center rounded-2xl text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-200"
            aria-label="Fechar modal"
          >
            <X size={18} />
          </button>
        </div>

        <div className="px-6 py-5">
          <div className="relative">
            <Search className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <input
              value={query}
              onChange={(event) => onQueryChange(event.target.value)}
              placeholder="Buscar lei nesta area..."
              className="h-11 w-full rounded-[1.1rem] border border-slate-200 bg-white pl-11 pr-4 text-sm font-semibold text-slate-900 outline-none transition-all focus:border-[#615fff]/30 focus:ring-4 focus:ring-[#615fff]/10 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100"
            />
          </div>
        </div>

        <div className="max-h-[58vh] overflow-y-auto px-6 pb-4">
          <div className="hidden grid-cols-[minmax(0,1fr)_110px_140px_120px] gap-4 border-b border-slate-100 px-3 py-3 text-[10px] font-black uppercase tracking-[0.18em] text-slate-400 dark:border-slate-800 dark:text-slate-500 md:grid">
            <span>Lei</span>
            <span>Artigos</span>
            <span>Atualizacao</span>
            <span>Acoes</span>
          </div>

          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {filteredLaws.map((law) => (
              <div key={law.id} className="grid gap-3 px-3 py-4 md:grid-cols-[minmax(0,1fr)_110px_140px_120px] md:items-center">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="truncate text-sm font-black text-slate-900 dark:text-slate-100">{law.shortTitle}</p>
                    {topAccessLawIds.has(law.id) ? (
                      <span className="inline-flex rounded-full bg-emerald-50 px-2.5 py-1 text-[10px] font-black text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-200">
                        Mais acessada
                      </span>
                    ) : null}
                  </div>
                  <p className="mt-1 truncate text-xs font-medium text-slate-500 dark:text-slate-400">
                    {law.description || law.summary || law.number}
                  </p>
                </div>

                <div className="text-sm font-black text-slate-700 dark:text-slate-200">
                  {formatNumber(law.articleCount)}
                </div>

                <div className="text-sm font-semibold text-slate-500 dark:text-slate-400">
                  {formatLawDate(law.lastUpdatedAt || law.date || law.lastSyncedAt)}
                </div>

                <div>
                  <Link
                    href={`/lei-comentada/${law.slug}`}
                    onMouseEnter={() => onPrefetch(law.slug)}
                    className="inline-flex h-10 items-center justify-center gap-2 rounded-2xl border border-[#615fff]/20 px-4 text-sm font-black text-[#615fff] transition-all hover:bg-[#615fff] hover:text-white dark:border-indigo-500/30 dark:text-indigo-200 dark:hover:bg-indigo-500"
                  >
                    Abrir <ArrowRight size={14} />
                  </Link>
                </div>
              </div>
            ))}

            {filteredLaws.length === 0 ? (
              <div className="px-3 py-10 text-center">
                <p className="text-base font-black text-slate-900 dark:text-slate-100">Nenhuma lei encontrada</p>
                <p className="mt-2 text-sm font-medium text-slate-500 dark:text-slate-400">
                  Tente buscar pelo nome, sigla ou numero da lei.
                </p>
              </div>
            ) : null}
          </div>
        </div>

        <div className="flex items-center justify-between gap-4 border-t border-slate-100 px-6 py-4 dark:border-slate-800">
          <p className="text-sm font-semibold text-slate-500 dark:text-slate-400">
            Mostrando {filteredLaws.length} {filteredLaws.length === 1 ? 'lei' : 'leis'}
          </p>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-11 items-center justify-center rounded-2xl border border-slate-200 px-5 text-sm font-black text-slate-600 transition-colors hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
};

const AreaCard = ({
  entry,
  viewMode,
  onPrefetch,
  onOpen,
}: {
  entry: AreaLibraryCard;
  viewMode: ViewMode;
  onPrefetch: (slug: string) => void;
  onOpen: (entry: AreaLibraryCard) => void;
}) => {
  const tone = getAreaTone(entry.area.slug);
  const Icon = tone.icon;
  const isGrid = viewMode === 'grid';
  const primaryLaw = entry.topLaw;

  return (
    <button
      type="button"
      className={`${PLATFORM_SURFACE_CARD_CLASS} group block w-full overflow-hidden p-5 text-left transition-all hover:-translate-y-0.5 hover:border-[#615fff]/25 hover:shadow-[0_22px_50px_-28px_rgba(97,95,255,0.35)] ${isGrid ? 'h-full' : ''}`}
      onClick={() => onOpen(entry)}
      onMouseEnter={() => {
        if (primaryLaw) onPrefetch(primaryLaw.slug);
      }}
      onFocusCapture={() => {
        if (primaryLaw) onPrefetch(primaryLaw.slug);
      }}
    >
      <div className={`grid gap-5 ${isGrid ? 'h-full grid-rows-[auto_auto_auto]' : 'xl:grid-cols-[minmax(0,1.1fr)_120px_220px_26px] xl:items-center'}`}>
        <div className="min-w-0">
          <div className="flex items-start gap-4">
            <span className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-[1.5rem] ${tone.iconBoxClassName}`}>
              <Icon size={28} />
            </span>
            <div className="min-w-0">
              <h3 className="text-[1.35rem] font-black tracking-tight text-slate-900 dark:text-slate-100">{getAreaTitle(entry.area)}</h3>
              <p className="mt-2 line-clamp-2 max-w-2xl text-sm font-medium leading-6 text-slate-500 dark:text-slate-400">
                {getAreaDescription(entry.area, entry.topLaw)}
              </p>
            </div>
          </div>
        </div>

        <div className={`space-y-1.5 ${isGrid ? '' : 'xl:border-l xl:border-slate-100 xl:px-5 dark:xl:border-slate-800'}`}>
          <span className="inline-flex rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.14em] text-slate-500 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-300">
            {entry.lawCount} {entry.lawCount === 1 ? 'lei' : 'leis'}
          </span>
          <p className="text-base font-black text-slate-700 dark:text-slate-200">{formatArticleCount(entry.totalArticles)}</p>
        </div>

        <div className={`space-y-2 ${isGrid ? '' : 'xl:px-2'}`}>
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm font-bold text-slate-500 dark:text-slate-400">Progresso</p>
            <span className={`text-sm font-black ${tone.accentClassName}`}>{clampPercent(entry.progressPercent)}%</span>
          </div>
          <ProgressBar value={entry.progressPercent} gradientClassName={tone.progressClassName} />
        </div>

        <div className={`flex ${isGrid ? 'items-end justify-end' : 'items-center justify-end'}`}>
          <ChevronRight size={20} className="text-slate-300 transition-colors group-hover:text-[#615fff] dark:text-slate-600 dark:group-hover:text-indigo-200" />
        </div>
      </div>
    </button>
  );
};

const AnnotatedLawsPage: React.FC = () => {
  const { currentUser } = useAuth();
  const systemSettings = useAppConfigStore((state) => state.systemSettings);
  const { displayTotals } = useStudyTracker();
  const { addToast } = useToast();
  const userId = getUserId(currentUser as UserLike);
  const isAdminPreview = Boolean((currentUser as UserLike)?.isAdmin || (currentUser as UserLike)?.role === 'admin' || (currentUser as UserLike)?.role === 'editor');
  const isFeatureEnabled = resolveSystemFeatureFlag(systemSettings, 'annotatedLawsEnabled', true);
  const [snapshot, setSnapshot] = React.useState<LegalHomeSnapshot>(EMPTY_LEGAL_HOME);
  const [searchResults, setSearchResults] = React.useState<LegalSearchResult[]>([]);
  const [query, setQuery] = React.useState('');
  const [selectedArea, setSelectedArea] = React.useState<AreaFilter>('all');
  const [selectedType, setSelectedType] = React.useState<TypeFilter>('all');
  const [sortMode, setSortMode] = React.useState<SortMode>('study');
  const [viewMode, setViewMode] = React.useState<ViewMode>('list');
  const [isLoading, setIsLoading] = React.useState(true);
  const [selectedAreaEntry, setSelectedAreaEntry] = React.useState<AreaLibraryCard | null>(null);
  const [areaModalQuery, setAreaModalQuery] = React.useState('');

  React.useEffect(() => {
    let isCurrent = true;
    const frameId = window.requestAnimationFrame(() => {
      if (isCurrent) {
        setIsLoading(true);
      }
    });

    legalCommentaryApiService.getHomeSnapshot()
      .then((nextSnapshot) => {
        if (isCurrent) {
          setSnapshot(nextSnapshot);
        }
      })
      .catch(() => {
        if (isCurrent) {
          addToast('Nao foi possivel carregar a biblioteca legislativa agora.', 'error');
        }
      })
      .finally(() => {
        if (isCurrent) {
          setIsLoading(false);
        }
      });

    return () => {
      isCurrent = false;
      window.cancelAnimationFrame(frameId);
    };
  }, [addToast, userId]);

  React.useEffect(() => {
    const normalizedQuery = query.trim();
    if (!normalizedQuery) {
      return undefined;
    }

    let isCurrent = true;
    const timer = window.setTimeout(() => {
      legalCommentaryApiService.search(normalizedQuery)
        .then((results) => {
          if (isCurrent) {
            setSearchResults(results);
          }
        })
        .catch(() => {
          if (isCurrent) {
            setSearchResults([]);
          }
        });
    }, 250);

    return () => {
      isCurrent = false;
      window.clearTimeout(timer);
    };
  }, [query]);

  const allLaws = React.useMemo(
    () => snapshot.lawsByArea.flatMap((group) => group.laws),
    [snapshot.lawsByArea],
  );

  const lawTypeOptions = React.useMemo(() => {
    const set = new Set<string>();
    allLaws.forEach((law) => set.add(getLawType(law)));
    return Array.from(set).sort((left, right) => left.localeCompare(right, 'pt-BR'));
  }, [allLaws]);

  const quickAccessLaws = React.useMemo(
    () => buildQuickAccessLaws(allLaws, snapshot.mostAccessed),
    [allLaws, snapshot.mostAccessed],
  );

  const topAccessLawIds = React.useMemo(
    () => new Set(snapshot.mostAccessed.map((law) => law.id)),
    [snapshot.mostAccessed],
  );

  const studyMetrics = React.useMemo(() => {
    const startedLaws = allLaws.filter((law) => Number(law.progressPercent || 0) > 0);
    const annotatedLaws = allLaws.filter((law) => Number(law.commentedArticleCount || 0) > 0);
    const equivalentReadArticles = allLaws.reduce((total, law) => (
      total + (Number(law.articleCount || 0) * clampPercent(law.progressPercent || 0)) / 100
    ), 0);
    const overallProgress = snapshot.totals.articles > 0
      ? (equivalentReadArticles / snapshot.totals.articles) * 100
      : 0;

    return {
      startedLawsCount: startedLaws.length,
      annotatedLawsCount: annotatedLaws.length,
      equivalentReadArticles: Math.round(equivalentReadArticles),
      overallProgress,
    };
  }, [allLaws, snapshot.totals.articles]);

  const areaCards = React.useMemo<AreaLibraryCard[]>(() => {
    return snapshot.lawsByArea
      .map((group) => {
        const filteredLaws = group.laws.filter((law) => {
          const matchesArea = selectedArea === 'all' || group.area.id === selectedArea;
          const matchesType = selectedType === 'all' || getLawType(law) === selectedType;
          return matchesArea && matchesType;
        });

        const sortedLaws = [...filteredLaws].sort((left, right) => {
          if (sortMode === 'access') {
            return Number(right.accessCount || 0) - Number(left.accessCount || 0);
          }

          return getStudyRelevanceScore(right) - getStudyRelevanceScore(left);
        });

        const totalArticles = sortedLaws.reduce((total, law) => total + Number(law.articleCount || 0), 0);
        const equivalentReadArticles = sortedLaws.reduce((total, law) => (
          total + (Number(law.articleCount || 0) * clampPercent(law.progressPercent || 0)) / 100
        ), 0);
        const progressPercent = totalArticles > 0 ? (equivalentReadArticles / totalArticles) * 100 : 0;

        return {
          area: group.area,
          laws: sortedLaws,
          topLaw: sortedLaws[0] || null,
          lawCount: sortedLaws.length,
          totalArticles,
          progressPercent,
          studyScore: sortedLaws.reduce((total, law) => total + getStudyRelevanceScore(law), 0),
          accessScore: sortedLaws.reduce((total, law) => total + Number(law.accessCount || 0), 0),
        };
      })
      .filter((entry) => entry.laws.length > 0)
      .sort((left, right) => {
        if (sortMode === 'access') {
          return right.accessScore - left.accessScore;
        }
        return right.studyScore - left.studyScore;
      });
  }, [selectedArea, selectedType, snapshot.lawsByArea, sortMode]);

  const prefetchLawDetail = React.useCallback((slug: string) => {
    void legalCommentaryApiService.prefetchLawDetail(slug);
  }, []);

  const openAreaModal = React.useCallback((entry: AreaLibraryCard) => {
    setSelectedAreaEntry(entry);
    setAreaModalQuery('');
  }, []);

  const closeAreaModal = React.useCallback(() => {
    setSelectedAreaEntry(null);
    setAreaModalQuery('');
  }, []);

  if (!isFeatureEnabled && !isAdminPreview) {
    return (
      <BetaFeaturePage
        title="Lei Comentada"
        description="Consulta guiada de legislacao com comentarios, jurisprudencia, macetes e leitura organizada."
        icon={FileText}
        isEnabled={false}
        featureLabel="Lei Comentada"
      />
    );
  }

  return (
    <div className="w-full space-y-6 animate-fade-in">
      <header className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
        <div className="min-w-0">
          <p className="text-[10px] font-black uppercase tracking-[0.22em] text-[#615fff] dark:text-indigo-300">
            Biblioteca legislativa
          </p>
          <h1 className={`${PLATFORM_PAGE_TITLE_CLASS} mt-2`}>
            Lei comentada
          </h1>
          <p className={`${PLATFORM_PAGE_DESCRIPTION_CLASS} mt-2 max-w-3xl`}>
            Seu acervo de legislacao comentada, com foco no que realmente cai em prova.
          </p>
        </div>

        <div className="grid gap-3 sm:grid-cols-3 xl:min-w-[460px]">
          <MetricBox label="Leis" value={formatNumber(snapshot.totals.laws)} />
          <MetricBox label="Artigos" value={formatNumber(snapshot.totals.articles)} />
          <MetricBox label="Atualizacoes" value={formatNumber(snapshot.totals.updatedRecently)} />
        </div>
      </header>

      <section className={`${PLATFORM_SURFACE_CARD_CLASS} p-4 md:p-5`}>
        <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
          <div className="space-y-4">
            <div className="relative">
              <Search className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Buscar por lei, tema ou assunto..."
                className="h-12 w-full rounded-[1.4rem] border border-slate-200 bg-slate-50 pl-11 pr-4 text-sm font-semibold text-slate-900 outline-none transition-all placeholder:text-slate-400 focus:border-[#615fff]/30 focus:bg-white focus:ring-4 focus:ring-[#615fff]/10 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100"
              />
            </div>

            <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_auto]">
              <select value={selectedArea} onChange={(event) => setSelectedArea(event.target.value)} className={FILTER_FIELD_CLASS}>
                <option value="all">Todas as areas</option>
                {snapshot.lawsByArea.map((group) => (
                  <option key={group.area.id} value={group.area.id}>
                    {getAreaTitle(group.area)}
                  </option>
                ))}
              </select>

              <select value={selectedType} onChange={(event) => setSelectedType(event.target.value)} className={FILTER_FIELD_CLASS}>
                <option value="all">Todos os tipos</option>
                {lawTypeOptions.map((type) => (
                  <option key={type} value={type}>{type}</option>
                ))}
              </select>

              <select value={sortMode} onChange={(event) => setSortMode(event.target.value as SortMode)} className={FILTER_FIELD_CLASS}>
                <option value="study">Mais cobradas</option>
                <option value="access">Mais acessadas</option>
              </select>

              <div className="inline-flex h-11 rounded-[1.2rem] border border-slate-200 bg-white p-1 dark:border-slate-800 dark:bg-slate-950">
                {([
                  { id: 'list', label: 'Lista' },
                  { id: 'grid', label: 'Grade' },
                ] as Array<{ id: ViewMode; label: string }>).map((mode) => (
                  <button
                    key={mode.id}
                    type="button"
                    onClick={() => setViewMode(mode.id)}
                    className={`inline-flex items-center rounded-[0.95rem] px-4 text-xs font-black transition-all ${
                      viewMode === mode.id
                        ? 'bg-[#615fff] text-white'
                        : 'text-slate-500 hover:text-[#615fff] dark:text-slate-400 dark:hover:text-indigo-200'
                    }`}
                  >
                    {mode.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.18em] text-slate-400 dark:text-slate-500">
              <Sparkles size={13} className="text-[#615fff] dark:text-indigo-300" />
              Acesso rapido
            </div>
            <div className="flex flex-wrap gap-2">
              {quickAccessLaws.map((entry) => (
                <Link
                  key={`${entry.label}-${entry.law.id}`}
                  href={`/lei-comentada/${entry.law.slug}`}
                  onMouseEnter={() => prefetchLawDetail(entry.law.slug)}
                  className={CHIP_BUTTON_CLASS}
                >
                  {entry.label}
                </Link>
              ))}
            </div>
          </div>
        </div>
      </section>

      <div className="grid gap-6 xl:grid-cols-[280px_minmax(0,1fr)]">
        <aside className="space-y-4 xl:sticky xl:top-4 xl:self-start">
          <section className={`${PLATFORM_SURFACE_CARD_CLASS} p-4`}>
            <div className="mb-4">
              <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400 dark:text-slate-500">Seu estudo</p>
            </div>

            <div className="space-y-2.5">
              <StudyStatRow
                icon={Heart}
                title="Favoritas"
                helper={`${snapshot.favoriteLaws.length} leis salvas`}
                toneClassName="bg-rose-100 text-rose-600 dark:bg-rose-500/15 dark:text-rose-200"
              />
              <StudyStatRow
                icon={Clock3}
                title="Recentes"
                helper={`${snapshot.recentlyStudied.length} leis revisitadas`}
                toneClassName="bg-sky-100 text-sky-600 dark:bg-sky-500/15 dark:text-sky-200"
              />
              <StudyStatRow
                icon={BadgeCheck}
                title="Lidas"
                helper={`${studyMetrics.startedLawsCount} leis com progresso`}
                toneClassName="bg-emerald-100 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-200"
              />
              <StudyStatRow
                icon={NotebookPen}
                title="Com anotacoes"
                helper={`${studyMetrics.annotatedLawsCount} leis com comentarios no acervo`}
                toneClassName="bg-violet-100 text-violet-600 dark:bg-violet-500/15 dark:text-violet-200"
              />
            </div>
          </section>

          <section className={`${PLATFORM_SURFACE_CARD_CLASS} p-4`}>
            <div className="mb-4">
              <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400 dark:text-slate-500">Progresso geral</p>
            </div>

            <CircularProgress value={studyMetrics.overallProgress} label="do acervo" />

            <div className="mt-5 space-y-3 border-t border-slate-100 pt-4 dark:border-slate-800">
              <div className="flex items-center justify-between gap-3 text-sm">
                <span className="font-semibold text-slate-500 dark:text-slate-400">Leis lidas</span>
                <span className="font-black text-slate-900 dark:text-slate-100">{formatNumber(studyMetrics.startedLawsCount)}</span>
              </div>
              <div className="flex items-center justify-between gap-3 text-sm">
                <span className="font-semibold text-slate-500 dark:text-slate-400">Artigos lidos</span>
                <span className="font-black text-slate-900 dark:text-slate-100">{formatNumber(studyMetrics.equivalentReadArticles)}</span>
              </div>
              <div className="flex items-center justify-between gap-3 text-sm">
                <span className="font-semibold text-slate-500 dark:text-slate-400">Tempo de estudo</span>
                <span className="font-black text-slate-900 dark:text-slate-100">{formatStudyDuration(displayTotals.readingSeconds)}</span>
              </div>
            </div>
          </section>
        </aside>

        <section className="min-w-0 space-y-5">
          {query.trim() ? (
            <section className="space-y-4">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400 dark:text-slate-500">Resultados</p>
                  <h2 className={PLATFORM_SECTION_TITLE_CLASS}>Busca em leis, artigos e comentarios</h2>
                </div>
                <span className="inline-flex w-fit rounded-full bg-slate-100 px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.14em] text-slate-500 dark:bg-slate-800 dark:text-slate-300">
                  {searchResults.length} itens
                </span>
              </div>

              <div className="grid gap-4 lg:grid-cols-2 2xl:grid-cols-3">
                {searchResults.length > 0 ? (
                  searchResults.map((result) => (
                    <SearchResultCard key={result.id} result={result} />
                  ))
                ) : (
                  <div className={`${PLATFORM_SURFACE_CARD_CLASS} p-8 text-center lg:col-span-2 2xl:col-span-3`}>
                    <Search className="mx-auto mb-4 text-slate-300 dark:text-slate-600" size={32} />
                    <h3 className="text-lg font-black text-slate-900 dark:text-slate-100">Nenhum resultado encontrado</h3>
                    <p className="mt-2 text-sm font-medium text-slate-500 dark:text-slate-400">
                      Tente buscar pelo numero da lei, artigo ou pelo tema principal da materia.
                    </p>
                  </div>
                )}
              </div>
            </section>
          ) : isLoading ? (
            <div className={`${PLATFORM_SURFACE_CARD_CLASS} p-9 text-center`}>
              <BookText className="mx-auto mb-4 text-slate-300 dark:text-slate-600" size={36} />
              <h3 className="text-lg font-black text-slate-900 dark:text-slate-100">Carregando o acervo legislativo...</h3>
              <p className="mt-2 text-sm font-medium text-slate-500 dark:text-slate-400">
                Estamos organizando as areas, leis e progresso para montar sua trilha de leitura.
              </p>
            </div>
          ) : areaCards.length > 0 ? (
            <section className="space-y-4">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400 dark:text-slate-500">Acervo por area</p>
                  <h2 className={PLATFORM_SECTION_TITLE_CLASS}>Estude menos no escuro, mais no que da resultado</h2>
                </div>
                <span className="inline-flex w-fit rounded-full bg-[#615fff]/10 px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.14em] text-[#615fff] dark:bg-indigo-500/15 dark:text-indigo-200">
                  {areaCards.length} areas visiveis
                </span>
              </div>

              <div className={`grid gap-4 ${viewMode === 'grid' ? '2xl:grid-cols-2' : 'grid-cols-1'}`}>
                {areaCards.map((entry) => (
                  <AreaCard
                    key={entry.area.id}
                    entry={entry}
                    viewMode={viewMode}
                    onPrefetch={prefetchLawDetail}
                    onOpen={openAreaModal}
                  />
                ))}
              </div>
            </section>
          ) : (
            <div className={`${PLATFORM_SURFACE_CARD_CLASS} p-9 text-center`}>
              <Shield className="mx-auto mb-4 text-slate-300 dark:text-slate-600" size={36} />
              <h3 className="text-lg font-black text-slate-900 dark:text-slate-100">Nada para exibir com esse recorte</h3>
              <p className="mt-2 text-sm font-medium text-slate-500 dark:text-slate-400">
                Ajuste a area, o tipo de lei ou a ordenacao para revelar outras trilhas de leitura.
              </p>
            </div>
          )}
        </section>
      </div>

      <AreaModal
        entry={selectedAreaEntry}
        isOpen={Boolean(selectedAreaEntry)}
        query={areaModalQuery}
        onQueryChange={setAreaModalQuery}
        onClose={closeAreaModal}
        onPrefetch={prefetchLawDetail}
        topAccessLawIds={topAccessLawIds}
      />
    </div>
  );
};

export default AnnotatedLawsPage;
