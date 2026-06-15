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
import { Bookmark, ChevronDown, ChevronUp, FileText, Gavel, GripVertical, Loader2, Search } from 'lucide-react';
import { useAuth } from '@providers/AuthProvider';
import { useToast } from '@providers/ToastProvider';
import {
  PLATFORM_METRIC_VALUE_CLASS,
  PLATFORM_PAGE_DESCRIPTION_CLASS,
  PLATFORM_PAGE_TITLE_CLASS,
  PLATFORM_SURFACE_CARD_CLASS,
} from '@constants/layout';
import { useAppConfigStore } from '@/state/app-config/appConfigStore';
import { legalCommentaryApiService } from '@services/legal-commentary';
import { resolveSystemFeatureFlag } from '@services/system/moduleFlags';
import type { LawArticle, LawSection, LawSummary, LegalHomeSnapshot, LegalTaxonomySummary } from '@types';
import BetaFeaturePage from '../../components/shared/feedback/BetaFeaturePage';

type UserLike = {
  id?: string;
  userId?: string;
  email?: string;
  isAdmin?: boolean;
  role?: string;
} | null;

type SortMode = 'name' | 'access' | 'updated';
type LawOutlineStatus = 'idle' | 'loading' | 'ready' | 'error';

type LawOutlineEntry = {
  status: LawOutlineStatus;
  sections: LawSectionSummary[];
  errorMessage?: string;
  startedAt?: number;
};

type LawSectionSummary = {
  id: string;
  sectionSlug?: string;
  title: string;
  fromArticle: string;
  toArticle: string;
  articles: number;
  primaryArticleId: string;
  articleIds: string[];
  articlePreviews: LawSectionArticleSummary[];
  isFavorite: boolean;
};

type LawSectionArticleSummary = {
  id: string;
  number: string;
  title: string;
  isFavorite: boolean;
};

type LawSubjectGroup = {
  id: string;
  name: string;
  description: string;
  order: number;
  iconTone: string;
};

type LawSubjectBucket = {
  area: LawSubjectGroup;
  laws: LawSummary[];
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

const LAW_OUTLINE_WATCHDOG_MS = 10_000;
const LAW_OUTLINE_SOFT_TIMEOUT_MS = 8_000;
const buildSectionFavoriteKey = (lawId: string, sectionId: string) => `${lawId}:${sectionId}`;
type SectionReadingEntry = { startedAt?: string; completedAt?: string; restartedAt?: string };
type SectionReadingState = Record<string, SectionReadingEntry>;

const getSectionReadingStorageKey = (userKey: string, lawId: string) => `cm:legal-commentary:section-reading:${userKey}:${lawId}`;
const buildSectionReadingKey = (section: Pick<LawSectionSummary, 'id' | 'fromArticle' | 'toArticle'>) => {
  const from = String(section.fromArticle || '').trim();
  const to = String(section.toArticle || from).trim();
  return from || to ? `${from}:${to}` : String(section.id || '');
};

const readSectionReadingState = (userKey: string, lawId: string): SectionReadingState => {
  if (typeof window === 'undefined' || !userKey || !lawId) return {};
  try {
    const parsed = JSON.parse(window.localStorage.getItem(getSectionReadingStorageKey(userKey, lawId)) || '{}');
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed as SectionReadingState : {};
  } catch {
    return {};
  }
};

const saveSectionReadingState = (userKey: string, lawId: string, state: SectionReadingState) => {
  if (typeof window === 'undefined' || !userKey || !lawId) return;
  window.localStorage.setItem(getSectionReadingStorageKey(userKey, lawId), JSON.stringify(state));
};

const getDateTimeValue = (value?: string) => {
  const timestamp = value ? Date.parse(value) : 0;
  return Number.isFinite(timestamp) ? timestamp : 0;
};

const isSectionReadingRestartPending = (entry?: SectionReadingEntry) => (
  getDateTimeValue(entry?.restartedAt) > getDateTimeValue(entry?.completedAt)
);

const getSectionReadingEntry = (
  state: SectionReadingState | undefined,
  section: Pick<LawSectionSummary, 'id' | 'fromArticle' | 'toArticle'>,
) => {
  if (!state) return undefined;
  return state[buildSectionReadingKey(section)] || state[String(section.id || '')];
};

const getSectionReadActionLabel = (reading?: { startedAt?: string; completedAt?: string }, progressPercent?: number) => {
  if (reading?.completedAt || Number(progressPercent || 0) >= 100) return 'Ler novamente';
  if (reading?.startedAt) return 'Marcar como lido';
  return 'Começar';
};

const getUserId = (user: UserLike) => user?.id || user?.userId || user?.email || null;

const normalizeText = (value: unknown) => String(value || '')
  .normalize('NFKD')
  .replace(/[\u0300-\u036f]/g, '')
  .replace(/[\u200B-\u200D\uFEFF]/g, '')
  .replace(/\s+/g, ' ')
  .toLowerCase()
  .trim();

const UNCATEGORIZED_LEGAL_SUBJECT: LawSubjectGroup = {
  id: 'subject-sem-materia-definida',
  name: 'Sem materia definida',
  description: 'Leis sem materia ou disciplina vinculada.',
  order: 9999,
  iconTone: 'text-slate-500',
};

const normalizeSubjectSlug = (value: unknown) => normalizeText(value)
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/^-+|-+$/g, '');

const isTruthyTaxonomyFlag = (value: unknown) => (
  value === true
  || value === 1
  || String(value || '').trim().toLowerCase() === '1'
  || String(value || '').trim().toLowerCase() === 'true'
);

const isMateriaTaxonomyEntry = (value: unknown) => {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const record = value as LegalTaxonomySummary;
  const taxonomyLevel = normalizeText(record.taxonomyLevel || record.taxonomy_level);
  return isTruthyTaxonomyFlag(record.materia)
    || isTruthyTaxonomyFlag(record.meta_materia)
    || taxonomyLevel === 'materia'
    || taxonomyLevel === 'disciplina';
};

const toCandidateList = (value: unknown): unknown[] => {
  if (Array.isArray(value)) {
    return value;
  }

  if (value === null || value === undefined || value === '') {
    return [];
  }

  return [value];
};

const coerceLegalSubjectGroup = (candidate: unknown): LawSubjectGroup | null => {
  if (candidate === null || candidate === undefined || candidate === '') {
    return null;
  }

  if (typeof candidate === 'string' || typeof candidate === 'number') {
    const name = String(candidate).trim();
    if (!name) return null;
    return {
      id: `subject-${normalizeSubjectSlug(name) || name}`,
      name,
      description: '',
      order: 500,
      iconTone: 'text-[#615fff]',
    };
  }

  if (typeof candidate !== 'object') {
    return null;
  }

  const record = candidate as LegalTaxonomySummary & Record<string, unknown>;
  const name = String(
    record.name
    || record.nome
    || record.title
    || record.label
    || record.subjectName
    || record.materiaName
    || record.disciplinaName
    || '',
  ).trim();

  if (!name) {
    return null;
  }

  const rawId = String(
    record.id
    || record.slug
    || record.subjectFilterId
    || record.materiaId
    || record.disciplinaId
    || '',
  ).trim();
  const slug = normalizeSubjectSlug(rawId || name) || normalizeSubjectSlug(name);

  return {
    id: `subject-${slug || name}`,
    name,
    description: String(record.description || record.descricao || '').trim(),
    order: Number.isFinite(Number(record.order || record.sortOrder || record.sort_order))
      ? Number(record.order || record.sortOrder || record.sort_order)
      : 500,
    iconTone: String(record.iconTone || record.icon_tone || 'text-[#615fff]').trim() || 'text-[#615fff]',
  };
};

const getLawSubjectGroups = (law: LawSummary): LawSubjectGroup[] => {
  const record = law as LawSummary & Record<string, unknown>;
  const candidates: unknown[] = [
    ...toCandidateList(record.subjects),
    ...toCandidateList(record.materias),
    ...toCandidateList(record.disciplinas),
    ...toCandidateList(record.disciplines),
    ...toCandidateList(record.subject),
    ...toCandidateList(record.materia),
    ...toCandidateList(record.disciplina),
    ...toCandidateList(record.subjectName),
    ...toCandidateList(record.materiaName),
    ...toCandidateList(record.disciplinaName),
  ];

  const assuntos = Array.isArray(record.assuntos) ? record.assuntos : [];
  assuntos
    .filter(isMateriaTaxonomyEntry)
    .forEach((item) => candidates.push(item));

  const grouped = new Map<string, LawSubjectGroup>();
  const groupedByName = new Set<string>();
  candidates
    .map(coerceLegalSubjectGroup)
    .filter((item): item is LawSubjectGroup => Boolean(item))
    .forEach((item) => {
      const nameKey = normalizeSubjectSlug(item.name);
      if (!grouped.has(item.id) && !groupedByName.has(nameKey)) {
        grouped.set(item.id, item);
        groupedByName.add(nameKey);
      }
    });

  if (grouped.size === 0) {
    [
      ...toCandidateList(record.lawTopicName),
      ...toCandidateList(record.topicName),
    ]
      .map(coerceLegalSubjectGroup)
      .filter((item): item is LawSubjectGroup => Boolean(item))
      .forEach((item) => {
        const nameKey = normalizeSubjectSlug(item.name);
        if (!grouped.has(item.id) && !groupedByName.has(nameKey)) {
          grouped.set(item.id, item);
          groupedByName.add(nameKey);
        }
      });
  }

  return grouped.size > 0 ? Array.from(grouped.values()) : [UNCATEGORIZED_LEGAL_SUBJECT];
};

const collectHomeLaws = (snapshot: LegalHomeSnapshot): LawSummary[] => {
  const lawsById = new Map<string, LawSummary>();
  const addLaw = (law: LawSummary | null | undefined) => {
    const lawId = String(law?.id || '').trim();
    if (!law || !lawId || lawsById.has(lawId)) {
      return;
    }
    lawsById.set(lawId, law);
  };

  snapshot.lawsByArea.forEach((group) => {
    (group.laws || []).forEach(addLaw);
  });
  snapshot.mostAccessed.forEach(addLaw);
  snapshot.favoriteLaws.forEach(addLaw);
  snapshot.recentlyStudied.forEach(addLaw);
  snapshot.recentlyUpdated.forEach(addLaw);

  return Array.from(lawsById.values());
};

const buildSubjectBuckets = (laws: LawSummary[]): LawSubjectBucket[] => {
  const buckets = new Map<string, { area: LawSubjectGroup; laws: Map<string, LawSummary> }>();

  laws.forEach((law) => {
    getLawSubjectGroups(law).forEach((subject) => {
      const bucketKey = normalizeSubjectSlug(subject.name) || subject.id;
      if (!buckets.has(bucketKey)) {
        buckets.set(bucketKey, { area: { ...subject, id: bucketKey }, laws: new Map<string, LawSummary>() });
      }

      buckets.get(bucketKey)!.laws.set(law.id, law);
    });
  });

  const mergedBuckets = new Map<string, { area: LawSubjectGroup; laws: Map<string, LawSummary> }>();

  Array.from(buckets.values()).forEach((bucket) => {
    const canonicalKey = normalizeSubjectSlug(bucket.area.name) || normalizeSubjectSlug(bucket.area.id) || bucket.area.id;
    const existing = mergedBuckets.get(canonicalKey);

    if (!existing) {
      mergedBuckets.set(canonicalKey, {
        area: { ...bucket.area, id: canonicalKey },
        laws: new Map(bucket.laws),
      });
      return;
    }

    bucket.laws.forEach((law, lawId) => {
      existing.laws.set(lawId, law);
    });

    if (
      bucket.area.order < existing.area.order
      || (
        bucket.area.order === existing.area.order
        && bucket.area.description.length > existing.area.description.length
      )
    ) {
      existing.area = { ...bucket.area, id: canonicalKey };
    }
  });

  return Array.from(mergedBuckets.values())
    .map((bucket) => ({
      area: bucket.area,
      laws: Array.from(bucket.laws.values()),
    }))
    .sort((left, right) => (
      left.area.order - right.area.order
      || left.area.name.localeCompare(right.area.name, 'pt-BR')
    ));
};

const formatNumber = (value: number) => new Intl.NumberFormat('pt-BR').format(Number(value || 0));
const getLawArticleCount = (law: LawSummary) => Math.max(0, Number(law.articleCount || law.totalArtigos || 0));

const buildLawDisplayTitle = (law: LawSummary) => {
  const shortTitle = String(law.shortTitle || law.title || '').trim();
  const number = String(law.number || '').trim();
  const titleHasNumber = normalizeText(shortTitle).includes(normalizeText(number));

  if (titleHasNumber || !number) {
    return shortTitle || 'Lei sem titulo';
  }

  return `Lei n\u00BA ${number} - ${shortTitle}`;
};

const formatArticleCount = (value: number) => `${formatNumber(value)} artigos`;
const formatProgressPercent = (value?: number) => `${Math.max(0, Math.min(100, Math.round(Number(value || 0))))}%`;
const getLawBackendProgressPercent = (law: LawSummary) => Number(law.progress?.progressPercent ?? law.progressPercent ?? 0);
const getLawViewedArticleIds = (law: LawSummary) => new Set(
  (law.progress?.viewedArticleIds || [])
    .map((id) => String(id || '').trim())
    .filter(Boolean),
);
const hasLawReadingProgress = (law: LawSummary) => getLawBackendProgressPercent(law) > 0 || getLawViewedArticleIds(law).size > 0;
const hasSectionReadingProgress = (sectionReading: SectionReadingState = {}) => (
  Object.values(sectionReading).some((entry) => Boolean(entry?.completedAt || isSectionReadingRestartPending(entry)))
);
const getSectionArticleIds = (section: Pick<LawSectionSummary, 'articleIds' | 'articlePreviews'>) => Array.from(new Set([
  ...(section.articleIds || []),
  ...(section.articlePreviews || []).map((article) => article.id),
]
  .map((articleId) => String(articleId || '').trim())
  .filter(Boolean)));
const buildCompletedArticleIdsForLaw = (
  law: LawSummary,
  sections: LawSectionSummary[] = [],
  sectionReading: SectionReadingState = {},
) => {
  const completedArticleIds = new Set(getLawViewedArticleIds(law));

  sections.forEach((section) => {
    const readingEntry = getSectionReadingEntry(sectionReading, section);
    const sectionArticleIds = getSectionArticleIds(section);

    if (isSectionReadingRestartPending(readingEntry)) {
      sectionArticleIds.forEach((articleId) => completedArticleIds.delete(articleId));
      return;
    }

    if (readingEntry?.completedAt) {
      sectionArticleIds.forEach((articleId) => completedArticleIds.add(articleId));
    }
  });

  return completedArticleIds;
};
const isSectionCompletedForProgress = (
  section: LawSectionSummary,
  completedArticleIds: Set<string>,
  sectionReading: SectionReadingState,
) => {
  const readingEntry = getSectionReadingEntry(sectionReading, section);
  if (isSectionReadingRestartPending(readingEntry)) return false;
  if (readingEntry?.completedAt) return true;

  const sectionArticleIds = getSectionArticleIds(section);
  return sectionArticleIds.length > 0 && sectionArticleIds.every((articleId) => completedArticleIds.has(articleId));
};
const resolveLawProgressPercent = (
  law: LawSummary,
  sections: LawSectionSummary[] = [],
  sectionReading: SectionReadingState = {},
) => {
  const backendProgress = getLawBackendProgressPercent(law);
  const articleCount = getLawArticleCount(law);
  const viewedArticleIds = getLawViewedArticleIds(law);
  const completedArticleIds = buildCompletedArticleIdsForLaw(law, sections, sectionReading);
  const hasLocalReadingSignal = sections.some((section) => {
    const readingEntry = getSectionReadingEntry(sectionReading, section);
    return Boolean(readingEntry?.completedAt || isSectionReadingRestartPending(readingEntry));
  });

  if (sections.length > 0) {
    const sectionArticleIds = sections
      .flatMap((section) => getSectionArticleIds(section));
    const knownArticleIds = new Set(sectionArticleIds);
    const totalArticles = articleCount > 0 ? articleCount : knownArticleIds.size;

    if (totalArticles > 0) {
      if (articleCount > 0 && viewedArticleIds.size > 0) {
        return Math.round((Math.min(completedArticleIds.size, totalArticles) / totalArticles) * 100);
      }

      if (hasLocalReadingSignal) {
        return Math.round((Math.min(completedArticleIds.size, totalArticles) / totalArticles) * 100);
      }

      if (backendProgress <= 0 && viewedArticleIds.size > 0) {
        return Math.round((Math.min(completedArticleIds.size, totalArticles) / totalArticles) * 100);
      }
    }
  }

  if (articleCount > 0 && viewedArticleIds.size > 0) {
    return Math.round((Math.min(viewedArticleIds.size, articleCount) / articleCount) * 100);
  }

  return backendProgress;
};

const getArticleNumber = (article: LawArticle) => String(article.number || article.numero || '').trim();
const getArticleTitle = (article: LawArticle) => String(article.title || article.titulo || '').trim();
const getArticleOrdinal = (value: unknown): number | null => {
  const match = String(value || '').match(/\d+/);
  if (!match) return null;
  const parsed = Number(match[0]);
  return Number.isFinite(parsed) ? parsed : null;
};

const buildSectionRangeLabel = (section: LawSectionSummary) => (
  section.fromArticle === section.toArticle
    ? `Artigo ${section.fromArticle}`
    : `Artigos ${section.fromArticle} a ${section.toArticle}`
);

const stripSectionPrefix = (rawTitle: string) => {
  const normalized = String(rawTitle || '').replace(/\s+/g, ' ').trim();
  if (!normalized) {
    return '';
  }

  const withoutPrefix = normalized
    .replace(/^(?:T[IÍ]TULO|CAP[IÍ]TULO|SE[CÇ][AÃ]O|SUBSE[CÇ][AÃ]O|LIVRO)\s+[IVXLCDM0-9]+(?:-[A-Z])?(?:\s*[-–—:]\s*|\s+)/i, '')
    .replace(/^[-–—:]\s*/, '')
    .trim();

  return withoutPrefix || normalized;
};

const buildSectionRowLabel = (section: LawSectionSummary, index: number) => {
  const cleanTitle = stripSectionPrefix(section.title);
  return `${String(index + 1).padStart(2, '0')} - ${buildSectionRangeLabel(section)}${cleanTitle ? ` - ${cleanTitle}` : ''}`;
};

const withOutlineTimeout = async <T,>(promise: Promise<T>, timeoutMs = LAW_OUTLINE_SOFT_TIMEOUT_MS): Promise<T> => {
  let timeoutId: number | null = null;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutId = window.setTimeout(() => {
      reject(new Error('outline_timeout'));
    }, timeoutMs);
  });

  try {
    return await Promise.race([promise, timeoutPromise]);
  } finally {
    if (timeoutId !== null) {
      window.clearTimeout(timeoutId);
    }
  }
};

const buildSectionsFromLawDetail = (_law: LawSummary, detail: { articles?: LawArticle[]; sections?: LawSection[] } | null | undefined): LawSectionSummary[] => {
  const articles = Array.isArray(detail?.articles) ? detail.articles : [];
  const articlesBySection = new Map<string, LawArticle[]>();
  articles.forEach((article) => {
    const sectionId = String(article.sectionId || '');
    if (!sectionId) return;
    const collection = articlesBySection.get(sectionId) || [];
    collection.push(article);
    articlesBySection.set(sectionId, collection);
  });

  const sections = Array.isArray(detail?.sections) ? detail.sections : [];

  if (sections.length === 0 && articles.length > 0) {
    const firstArticle = articles[0];
    const lastArticle = articles[articles.length - 1];
    const articleIds = articles.map((article) => String(article.id));

    return [{
      id: `law-${_law.id}-all`,
      sectionSlug: `law-${_law.id}-all`,
      title: 'Capitulo unico',
      fromArticle: getArticleNumber(firstArticle),
      toArticle: getArticleNumber(lastArticle),
      articles: articles.length,
      primaryArticleId: articleIds[0] || '',
      articleIds,
      articlePreviews: articles.map((article) => ({
        id: String(article.id),
        number: getArticleNumber(article),
        title: getArticleTitle(article),
        isFavorite: Boolean(article.isFavorite),
      })),
      isFavorite: false,
    }];
  }

  return sections.map((section) => {
    let sectionArticles = articlesBySection.get(String(section.id)) || [];
    if (sectionArticles.length === 0) {
      const fromOrdinal = getArticleOrdinal(section.fromArticle);
      const toOrdinal = getArticleOrdinal(section.toArticle || section.fromArticle);
      if (fromOrdinal !== null) {
        const upperLimit = toOrdinal !== null ? toOrdinal : fromOrdinal;
        sectionArticles = articles.filter((article) => {
          const articleOrdinal = getArticleOrdinal(getArticleNumber(article));
          return articleOrdinal !== null && articleOrdinal >= fromOrdinal && articleOrdinal <= upperLimit;
        });
      }
    }

    const articleIds = sectionArticles.map((article) => String(article.id));
    return {
      id: String(section.id),
      sectionSlug: String(section.slug || section.id),
      title: String(section.displayTitle || section.title || 'Capitulo da lei'),
      fromArticle: String(section.fromArticle || sectionArticles[0]?.number || ''),
      toArticle: String(section.toArticle || sectionArticles[sectionArticles.length - 1]?.number || ''),
      articles: Number(section.articleCount || sectionArticles.length),
      primaryArticleId: articleIds[0] || '',
      articleIds,
      articlePreviews: sectionArticles.map((article) => ({
        id: String(article.id),
        number: getArticleNumber(article),
        title: getArticleTitle(article),
        isFavorite: Boolean(article.isFavorite),
      })),
      isFavorite: Boolean(section.isFavorite),
    };
  });
};

const hasResolvedArticleBindings = (sections: LawSectionSummary[]) => (
  sections.some((section) => (
    String(section.primaryArticleId || '').trim() !== ''
    || (Array.isArray(section.articleIds) && section.articleIds.length > 0)
  ))
);

const InlineSpinner: React.FC<{ label?: string }> = ({ label }) => (
  <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-black text-slate-500 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300">
    <Loader2 size={15} className="animate-spin text-[#615fff]" />
    {label ? <span>{label}</span> : <span className="sr-only">Carregando</span>}
  </div>
);

const AnnotatedLawsPage: React.FC = () => {
  const { currentUser, updateUser } = useAuth();
  const { addToast } = useToast();
  const systemSettings = useAppConfigStore((state) => state.systemSettings);
  const userId = getUserId(currentUser as UserLike);
  const isAdminPreview = Boolean(
    (currentUser as UserLike)?.isAdmin
    || (currentUser as UserLike)?.role === 'admin'
    || (currentUser as UserLike)?.role === 'editor',
  );
  const isFeatureEnabled = resolveSystemFeatureFlag(systemSettings, 'annotatedLawsEnabled', true);

  const [snapshot, setSnapshot] = React.useState<LegalHomeSnapshot>(EMPTY_LEGAL_HOME);
  const [isLoading, setIsLoading] = React.useState(true);
  const [homeLoadError, setHomeLoadError] = React.useState<string | null>(null);
  const [homeReloadVersion, setHomeReloadVersion] = React.useState(0);
  const [query, setQuery] = React.useState('');
  const [selectedArea, setSelectedArea] = React.useState('all');
  const [sortMode, setSortMode] = React.useState<SortMode>('name');
  const [expandedAreaId, setExpandedAreaId] = React.useState('');
  const [expandedLawByArea, setExpandedLawByArea] = React.useState<Record<string, string>>({});
  const [expandedSectionByLawId, setExpandedSectionByLawId] = React.useState<Record<string, string>>({});
  const [lawOutlineById, setLawOutlineById] = React.useState<Record<string, LawOutlineEntry>>({});
  const [sectionFavoriteBusyMap, setSectionFavoriteBusyMap] = React.useState<Record<string, boolean>>({});
  const [sectionReadBusyMap, setSectionReadBusyMap] = React.useState<Record<string, boolean>>({});
  const [sectionReadingByLawId, setSectionReadingByLawId] = React.useState<Record<string, SectionReadingState>>({});
  const lawOutlineByIdRef = React.useRef<Record<string, LawOutlineEntry>>({});
  const pendingOutlineIdsRef = React.useRef<Set<string>>(new Set());
  const isMountedRef = React.useRef(true);
  const addToastRef = React.useRef(addToast);
  const homeRequestIdRef = React.useRef(0);

  React.useEffect(() => {
    isMountedRef.current = true;

    return () => {
      isMountedRef.current = false;
    };
  }, []);

  React.useEffect(() => {
    addToastRef.current = addToast;
  }, [addToast]);

  React.useEffect(() => {
    lawOutlineByIdRef.current = lawOutlineById;
  }, [lawOutlineById]);

  React.useEffect(() => {
    const intervalId = window.setInterval(() => {
      if (!isMountedRef.current) {
        return;
      }

      const now = Date.now();
      setLawOutlineById((current) => {
        let mutated = false;
        const next: Record<string, LawOutlineEntry> = { ...current };

        Object.entries(current).forEach(([lawId, entry]) => {
          if (entry.status !== 'loading' || !entry.startedAt) {
            return;
          }

          if (now - entry.startedAt <= LAW_OUTLINE_WATCHDOG_MS) {
            return;
          }

          pendingOutlineIdsRef.current.delete(lawId);
          mutated = true;
          next[lawId] = {
            status: 'error',
            sections: entry.sections || [],
            errorMessage: 'A consulta desta lei demorou para responder. Tente novamente.',
            startedAt: undefined,
          };
        });

        return mutated ? next : current;
      });
    }, 2_000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, []);

  React.useEffect(() => {
    let active = true;
    homeRequestIdRef.current += 1;
    const requestId = homeRequestIdRef.current;
    const loadingFrameId = window.requestAnimationFrame(() => {
      if (!active || requestId !== homeRequestIdRef.current) {
        return;
      }
      setIsLoading(true);
      setHomeLoadError(null);
    });

    legalCommentaryApiService.getHomeSnapshot({ force: true })
      .then((nextSnapshot) => {
        if (!active || requestId !== homeRequestIdRef.current) {
          return;
        }
        setSnapshot(nextSnapshot);
      })
      .catch(() => {
        if (!active || requestId !== homeRequestIdRef.current) {
          return;
        }
        setHomeLoadError('Nao foi possivel carregar a Lei Comentada agora.');
        addToastRef.current('Nao foi possivel carregar a Lei Comentada agora.', 'error');
      })
      .finally(() => {
        if (!active || requestId !== homeRequestIdRef.current) {
          return;
        }
        setIsLoading(false);
      });

    return () => {
      active = false;
      window.cancelAnimationFrame(loadingFrameId);
    };
  }, [homeReloadVersion, userId]);

  const homeLaws = React.useMemo(() => collectHomeLaws(snapshot), [snapshot]);
  const subjectBuckets = React.useMemo(() => buildSubjectBuckets(homeLaws), [homeLaws]);

  const groupedAreas = React.useMemo(() => {
    const normalizedQuery = normalizeText(query);

    return subjectBuckets
      .filter((group) => selectedArea === 'all' || String(group.area.id) === String(selectedArea))
      .map((group) => {
        const areaLaws = Array.isArray(group.laws) ? group.laws : [];
        const groupHaystack = normalizeText([
          group.area.name,
          group.area.description,
        ].join(' '));
        const laws = areaLaws
          .filter((law) => {
            if (!normalizedQuery) return true;
            if (groupHaystack.includes(normalizedQuery)) return true;
            const subjectHaystack = normalizeText(getLawSubjectGroups(law)
              .flatMap((subject) => [subject.name, subject.description])
              .join(' '));
            const haystack = normalizeText([
              law.shortTitle,
              law.title,
              law.number,
              law.summary,
              law.description,
              law.acronym,
              law.subjectName,
              law.materiaName,
              law.disciplinaName,
              subjectHaystack,
            ].join(' '));
            return haystack.includes(normalizedQuery);
          })
          .sort((left, right) => {
            if (sortMode === 'access') {
              return Number(right.accessCount || 0) - Number(left.accessCount || 0);
            }

            if (sortMode === 'updated') {
              const leftTime = new Date(left.lastUpdatedAt || left.lastSyncedAt || left.date || 0).getTime();
              const rightTime = new Date(right.lastUpdatedAt || right.lastSyncedAt || right.date || 0).getTime();
              return rightTime - leftTime;
            }

            return String(left.shortTitle || left.title || '').localeCompare(
              String(right.shortTitle || right.title || ''),
              'pt-BR',
            );
          });

        return {
          area: group.area,
          laws,
          readCount: areaLaws.filter(hasLawReadingProgress).length,
          totalCount: areaLaws.length,
        };
      })
      .filter((group) => group.laws.length > 0);
  }, [query, selectedArea, sortMode, subjectBuckets]);

  React.useEffect(() => {
    const frameId = window.requestAnimationFrame(() => {
      if (!userId) {
        setSectionReadingByLawId({});
        return;
      }

      const nextState: Record<string, SectionReadingState> = {};
      homeLaws.forEach((law) => {
        nextState[law.id] = readSectionReadingState(userId, law.id);
      });
      setSectionReadingByLawId(nextState);
    });

    return () => window.cancelAnimationFrame(frameId);
  }, [homeLaws, userId]);

  React.useEffect(() => {
    if (groupedAreas.length === 0) {
      const resetFrameId = window.requestAnimationFrame(() => {
        setExpandedAreaId('');
        setExpandedLawByArea({});
      });
      return () => window.cancelAnimationFrame(resetFrameId);
    }

    if (expandedAreaId && !groupedAreas.some((group) => group.area.id === expandedAreaId)) {
      const resetFrameId = window.requestAnimationFrame(() => setExpandedAreaId(''));
      return () => window.cancelAnimationFrame(resetFrameId);
    }
  }, [expandedAreaId, groupedAreas]);

  const toggleArea = (areaId: string) => {
    setExpandedAreaId((current) => (current === areaId ? '' : areaId));
  };

  const ensureLawOutline = React.useCallback(async (law: LawSummary, force = false) => {
    const currentEntry = lawOutlineByIdRef.current[law.id];
    if (
      !force
      && currentEntry?.status === 'ready'
      && currentEntry.sections.length > 0
      && hasResolvedArticleBindings(currentEntry.sections)
    ) {
      return;
    }

    if (
      currentEntry?.status === 'loading'
      && currentEntry.startedAt
      && (Date.now() - currentEntry.startedAt > LAW_OUTLINE_WATCHDOG_MS)
    ) {
      pendingOutlineIdsRef.current.delete(law.id);
    }

    if (force) {
      pendingOutlineIdsRef.current.delete(law.id);
    }

    if (pendingOutlineIdsRef.current.has(law.id)) {
      return;
    }

    pendingOutlineIdsRef.current.add(law.id);
    setLawOutlineById((current) => {
      const previousSections = current[law.id]?.sections || [];
      return {
        ...current,
        [law.id]: {
          status: 'loading',
          sections: previousSections,
          errorMessage: undefined,
          startedAt: Date.now(),
        },
      };
    });

    const watchdogId = window.setTimeout(() => {
      if (!isMountedRef.current) {
        return;
      }

      setLawOutlineById((current) => {
        const activeEntry = current[law.id];
        if (!activeEntry || activeEntry.status !== 'loading') {
          return current;
        }

        pendingOutlineIdsRef.current.delete(law.id);
        return {
          ...current,
          [law.id]: {
            status: 'error',
            sections: activeEntry.sections || [],
            errorMessage: 'A consulta desta lei demorou para responder. Tente novamente.',
            startedAt: undefined,
          },
        };
      });
    }, LAW_OUTLINE_WATCHDOG_MS);

    try {
      const outlineDetail = await withOutlineTimeout(
        legalCommentaryApiService.getLawOutline(
          law.slug,
          force ? { force: true } : undefined,
        ),
      );

      let sections = buildSectionsFromLawDetail(law, outlineDetail);

      if (sections.length === 0 || !hasResolvedArticleBindings(sections)) {
        const fullDetail = await withOutlineTimeout(
          legalCommentaryApiService.getLawDetail(
            law.slug,
            force ? { force: true } : undefined,
          ),
        );
        sections = buildSectionsFromLawDetail(law, fullDetail);
      }

      if (isMountedRef.current) {
        setLawOutlineById((current) => ({
          ...current,
          [law.id]: {
            status: 'ready',
            sections,
            errorMessage: undefined,
            startedAt: undefined,
          },
        }));
      }
    } catch (primaryError) {
      const fallbackMessage = primaryError instanceof Error && /timeout|outline_timeout/i.test(primaryError.message)
        ? 'A consulta desta lei demorou para responder. Tentando modo alternativo...'
        : 'Nao foi possivel carregar as secoes desta lei agora.';

      try {
        const fullDetail = await withOutlineTimeout(
          legalCommentaryApiService.getLawDetail(
            law.slug,
            force ? { force: true } : undefined,
          ),
        );
        const sections = buildSectionsFromLawDetail(law, fullDetail);
        if (sections.length > 0 && isMountedRef.current) {
          setLawOutlineById((current) => ({
            ...current,
            [law.id]: {
              status: 'ready',
              sections,
              errorMessage: undefined,
              startedAt: undefined,
            },
          }));
          return;
        }
      } catch {
        // Continua para estado de erro abaixo.
      }

      if (isMountedRef.current) {
        setLawOutlineById((current) => ({
          ...current,
          [law.id]: {
            status: 'error',
            sections: current[law.id]?.sections || [],
            errorMessage: fallbackMessage,
            startedAt: undefined,
          },
        }));
      }
    } finally {
      window.clearTimeout(watchdogId);
      pendingOutlineIdsRef.current.delete(law.id);
    }
  }, []);

  React.useEffect(() => {
    if (!userId || homeLaws.length === 0) {
      return undefined;
    }

    const lawsNeedingProgressOutline = homeLaws.filter((law) => {
      const sectionReading = sectionReadingByLawId[law.id] || {};
      const needsSectionAwareProgress = hasSectionReadingProgress(sectionReading);
      if (!needsSectionAwareProgress) {
        return false;
      }

      const outlineEntry = lawOutlineById[law.id];
      if (
        outlineEntry?.status === 'ready'
        && outlineEntry.sections.length > 0
        && hasResolvedArticleBindings(outlineEntry.sections)
      ) {
        return false;
      }

      return outlineEntry?.status !== 'loading' && !pendingOutlineIdsRef.current.has(law.id);
    }).slice(0, 6);

    if (lawsNeedingProgressOutline.length === 0) {
      return undefined;
    }

    let cancelled = false;
    const timeoutIds: number[] = [];
    const frameId = window.requestAnimationFrame(() => {
      lawsNeedingProgressOutline.forEach((law, index) => {
        const timeoutId = window.setTimeout(() => {
          if (!cancelled) {
            void ensureLawOutline(law, false);
          }
        }, index * 120);
        timeoutIds.push(timeoutId);
      });
    });

    return () => {
      cancelled = true;
      window.cancelAnimationFrame(frameId);
      timeoutIds.forEach((timeoutId) => window.clearTimeout(timeoutId));
    };
  }, [ensureLawOutline, homeLaws, lawOutlineById, sectionReadingByLawId, userId]);

  const handleToggleLaw = (areaId: string, law: LawSummary) => {
    const currentLawId = expandedLawByArea[areaId];
    const nextLawId = currentLawId === law.id ? '' : law.id;

    setExpandedLawByArea((current) => ({
      ...current,
      [areaId]: nextLawId,
    }));

    if (nextLawId) {
      setLawOutlineById((current) => {
        const currentEntry = current[law.id];
        if (
          currentEntry
          && currentEntry.sections.length > 0
          && hasResolvedArticleBindings(currentEntry.sections)
        ) {
          return current;
        }

        return {
          ...current,
          [law.id]: {
            status: 'loading',
            sections: [],
            errorMessage: undefined,
            startedAt: Date.now(),
          },
        };
      });

      void ensureLawOutline(law, false);
    }
  };

  React.useEffect(() => {
    if (!expandedAreaId) {
      return;
    }

    const openedArea = groupedAreas.find((group) => group.area.id === expandedAreaId);
    if (!openedArea || openedArea.laws.length === 0) {
      const resetFrameId = window.requestAnimationFrame(() => {
        setExpandedLawByArea((current) => {
          if (!current[expandedAreaId]) {
            return current;
          }
          return { ...current, [expandedAreaId]: '' };
        });
      });
      return () => window.cancelAnimationFrame(resetFrameId);
    }

    const selectedLawId = expandedLawByArea[openedArea.area.id];
    if (!selectedLawId) {
      return;
    }

    const selectedLaw = openedArea.laws.find((law) => law.id === selectedLawId);
    if (!selectedLaw) {
      const resetFrameId = window.requestAnimationFrame(() => {
        setExpandedLawByArea((current) => ({
          ...current,
          [openedArea.area.id]: '',
        }));
      });
      return () => window.cancelAnimationFrame(resetFrameId);
    }
  }, [expandedAreaId, expandedLawByArea, groupedAreas]);

  const prefetchLaw = (slug: string) => {
    void legalCommentaryApiService.prefetchLawDetail(slug);
  };

  const toggleSectionArticles = React.useCallback((lawId: string, sectionId: string) => {
    setExpandedSectionByLawId((current) => ({
      ...current,
      [lawId]: current[lawId] === sectionId ? '' : sectionId,
    }));
  }, []);

  const handleToggleSectionFavorite = React.useCallback(async (
    lawId: string,
    section: LawSectionSummary,
  ) => {
    if (!userId) {
      addToast('Entre na sua conta para salvar favoritos.', 'warning');
      return;
    }

    const favoriteKey = buildSectionFavoriteKey(lawId, section.id);
    if (sectionFavoriteBusyMap[favoriteKey]) {
      return;
    }

    const targetSectionId = String(section.id || '').trim();
    if (!targetSectionId) {
      addToast('Nao foi possivel identificar este capitulo para salvar.', 'error');
      return;
    }

    const previousFavorite = Boolean(section.isFavorite);
    const optimisticFavorite = !previousFavorite;

    setSectionFavoriteBusyMap((current) => ({ ...current, [favoriteKey]: true }));
    setLawOutlineById((current) => {
      const currentEntry = current[lawId];
      if (!currentEntry) return current;
      return {
        ...current,
        [lawId]: {
          ...currentEntry,
          sections: currentEntry.sections.map((entry) => (
            entry.id === section.id
              ? { ...entry, isFavorite: optimisticFavorite }
              : entry
          )),
        },
      };
    });

    try {
      const result = await legalCommentaryApiService.toggleFavorite('article', targetSectionId);
      const persistedFavorite = Boolean(result.isFavorite);

      setLawOutlineById((current) => {
        const currentEntry = current[lawId];
        if (!currentEntry) return current;
        return {
          ...current,
          [lawId]: {
            ...currentEntry,
            sections: currentEntry.sections.map((entry) => (
              entry.id === section.id
                ? { ...entry, isFavorite: persistedFavorite }
                : entry
            )),
          },
        };
      });

      addToast(persistedFavorite ? 'Capitulo salvo nos favoritos.' : 'Capitulo removido dos favoritos.', 'success');
    } catch {
      setLawOutlineById((current) => {
        const currentEntry = current[lawId];
        if (!currentEntry) return current;
        return {
          ...current,
          [lawId]: {
            ...currentEntry,
            sections: currentEntry.sections.map((entry) => (
              entry.id === section.id
                ? { ...entry, isFavorite: previousFavorite }
                : entry
            )),
          },
        };
      });
      addToast('Nao foi possivel atualizar o favorito deste capitulo.', 'error');
    } finally {
      setSectionFavoriteBusyMap((current) => {
        if (!current[favoriteKey]) return current;
        const next = { ...current };
        delete next[favoriteKey];
        return next;
      });
    }
  }, [addToast, sectionFavoriteBusyMap, userId]);

  const handleMarkSectionAsRead = React.useCallback(async (
    law: LawSummary,
    section: LawSectionSummary,
    currentReading: SectionReadingState,
  ) => {
    if (!userId) {
      addToast('Entre na sua conta para salvar o progresso.', 'warning');
      return;
    }

    const busyKey = `${law.id}:${section.id}`;
    if (sectionReadBusyMap[busyKey]) {
      return;
    }

    const articleIds = Array.from(new Set([
      ...(section.articleIds || []),
      ...(section.articlePreviews || []).map((article) => article.id),
    ]
      .map((articleId) => String(articleId || '').trim())
      .filter(Boolean)));

    const completedAt = new Date().toISOString();
    setSectionReadBusyMap((current) => ({ ...current, [busyKey]: true }));

    try {
      const progressResults = [];
      if (articleIds.length > 0) {
        for (const articleId of articleIds) {
          progressResults.push(await legalCommentaryApiService.recordArticleView(law.id, articleId));
        }
      } else {
        progressResults.push(await legalCommentaryApiService.recordLawView(law.id));
      }
      const latestProgress = [...progressResults].reverse().find((progress) => (
        progress.newXp !== undefined || progress.newLevel !== undefined
      ));
      const totalXpGain = progressResults.reduce((total, progress) => total + Number(progress.xpGain || 0), 0);

      if (latestProgress) {
        void updateUser({
          ...(latestProgress.newXp !== undefined ? { xp: latestProgress.newXp } : {}),
          ...(latestProgress.newLevel !== undefined ? { level: latestProgress.newLevel } : {}),
        });
      }

      const sectionReadingKey = buildSectionReadingKey(section);
      const existingReading = getSectionReadingEntry(currentReading, section);
      const nextLawReading = {
        ...currentReading,
        [sectionReadingKey]: {
          ...existingReading,
          startedAt: existingReading?.startedAt || completedAt,
          completedAt,
        },
        [section.id]: {
          ...existingReading,
          startedAt: existingReading?.startedAt || completedAt,
          completedAt,
        },
      };

      saveSectionReadingState(userId, law.id, nextLawReading);
      setSectionReadingByLawId((current) => ({
        ...current,
        [law.id]: nextLawReading,
      }));
      setHomeReloadVersion((current) => current + 1);

      addToast(
        totalXpGain > 0 ? `Seção marcada como lida. +${totalXpGain} XP.` : 'Seção marcada como lida.',
        'success',
      );
    } catch {
      addToast('Não foi possível marcar esta seção como lida agora.', 'error');
    } finally {
      setSectionReadBusyMap((current) => {
        if (!current[busyKey]) return current;
        const next = { ...current };
        delete next[busyKey];
        return next;
      });
    }
  }, [addToast, sectionReadBusyMap, updateUser, userId]);

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
    <div className="w-full animate-fade-in space-y-5">
      <header className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[#615fff]">
            Biblioteca Legislativa
          </p>
          <h1 className={`mt-2 ${PLATFORM_PAGE_TITLE_CLASS}`}>
            Lei comentada
          </h1>
          <p className={`mt-2 ${PLATFORM_PAGE_DESCRIPTION_CLASS}`}>
            Seu acervo de legislacao comentada, com foco no que realmente cai em prova.
          </p>
        </div>

        <div className="grid gap-3 sm:grid-cols-3 xl:min-w-[390px]">
          <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Leis</p>
            <p className={`mt-2 leading-none ${PLATFORM_METRIC_VALUE_CLASS}`}>{formatNumber(snapshot.totals.laws)}</p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Artigos</p>
            <p className={`mt-2 leading-none ${PLATFORM_METRIC_VALUE_CLASS}`}>{formatNumber(snapshot.totals.articles)}</p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Atualizacoes</p>
            <p className={`mt-2 leading-none ${PLATFORM_METRIC_VALUE_CLASS}`}>{formatNumber(snapshot.totals.updatedRecently)}</p>
          </div>
        </div>
      </header>

      <section className={`${PLATFORM_SURFACE_CARD_CLASS} p-4`}>
        <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_220px_230px]">
          <div className="relative">
            <Search size={16} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Buscar por lei, tema ou assunto..."
              className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 pl-10 pr-4 text-sm font-semibold text-slate-700 outline-none transition-colors focus:border-[#615fff]/40 focus:bg-white dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100"
            />
          </div>

          <select
            value={selectedArea}
            onChange={(event) => setSelectedArea(event.target.value)}
            className="h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 outline-none transition-colors focus:border-[#615fff]/40 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-100"
          >
            <option value="all">Todas as materias</option>
            {subjectBuckets.map((group) => (
              <option key={group.area.id} value={group.area.id}>
                {group.area.name}
              </option>
            ))}
          </select>

          <select
            value={sortMode}
            onChange={(event) => setSortMode(event.target.value as SortMode)}
            className="h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 outline-none transition-colors focus:border-[#615fff]/40 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-100"
          >
            <option value="name">Ordenar por: Nome da lei</option>
            <option value="access">Ordenar por: Mais acessadas</option>
            <option value="updated">Ordenar por: Atualizacao recente</option>
          </select>
        </div>
      </section>

      <section className={`${PLATFORM_SURFACE_CARD_CLASS} overflow-hidden`}>
        {isLoading && groupedAreas.length === 0 ? (
          <div className="space-y-4 p-5">
            {Array.from({ length: 5 }).map((_, index) => (
              <div key={`law-loading-${index}`} className="animate-pulse rounded-xl border border-slate-200 bg-slate-50 px-4 py-4 dark:border-slate-800 dark:bg-slate-900">
                <div className="h-5 w-56 rounded bg-slate-200 dark:bg-slate-700" />
                <div className="mt-3 h-3 w-40 rounded bg-slate-200 dark:bg-slate-700" />
              </div>
            ))}
          </div>
        ) : homeLoadError && groupedAreas.length === 0 ? (
          <div className="flex flex-col items-start gap-3 p-6">
            <p className="text-sm font-semibold text-red-600 dark:text-red-300">{homeLoadError}</p>
            <button
              type="button"
              onClick={() => setHomeReloadVersion((current) => current + 1)}
              className="inline-flex h-9 items-center justify-center rounded-lg border border-[#615fff]/35 px-3 text-xs font-black text-[#615fff] transition-colors hover:bg-[#615fff] hover:text-white"
            >
              Tentar novamente
            </button>
          </div>
        ) : groupedAreas.length === 0 ? (
          <div className="p-6 text-sm font-semibold text-slate-500 dark:text-slate-400">
            Nenhuma lei encontrada para este filtro.
          </div>
        ) : (
          groupedAreas.map((group) => {
            const isOpen = expandedAreaId === group.area.id;
            return (
              <div key={group.area.id} className="border-b border-slate-100 last:border-b-0 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => toggleArea(group.area.id)}
                  className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left transition-colors hover:bg-slate-50 dark:hover:bg-slate-900"
                >
                  <div className="flex min-w-0 items-center gap-2.5">
                    <GripVertical size={14} className="shrink-0 text-slate-300 dark:text-slate-600" />
                    <p className="truncate text-lg font-bold tracking-tight text-slate-900 dark:text-slate-100">
                      {group.area.name}
                    </p>
                    <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-black uppercase tracking-[0.08em] text-slate-500 dark:bg-slate-800 dark:text-slate-300">
                      {group.readCount}/{group.totalCount}
                    </span>
                  </div>
                  {isOpen ? (
                    <ChevronUp size={17} className="shrink-0 text-slate-400" />
                  ) : (
                    <ChevronDown size={17} className="shrink-0 text-slate-400" />
                  )}
                </button>

                {isOpen ? (
                  <div className="border-l-2 border-[#615fff] bg-slate-50/35 px-3 py-3 dark:bg-slate-900/20">
                    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
                      {group.laws.map((law) => {
                        const isLawOpen = expandedLawByArea[group.area.id] === law.id;
                        const outline = lawOutlineById[law.id] || { status: 'idle', sections: [] };
                        const effectiveSections = outline.sections;
                        const lawReading = sectionReadingByLawId[law.id] || {};
                        const effectiveProgressPercent = resolveLawProgressPercent(law, effectiveSections, lawReading);
                        const completedArticleIds = buildCompletedArticleIdsForLaw(law, effectiveSections, lawReading);

                        return (
                          <article key={law.id} className="overflow-hidden border-b border-slate-100 last:border-b-0 dark:border-slate-800">
                            <button
                              type="button"
                              onClick={() => handleToggleLaw(group.area.id, law)}
                              className="flex w-full flex-col gap-3 px-4 py-3 text-left transition-colors hover:bg-slate-50/70 dark:hover:bg-slate-800/40 sm:flex-row sm:items-center"
                            >
                              <div className="flex min-w-0 flex-1 items-center gap-3">
                                <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-indigo-50 text-[#615fff] dark:bg-indigo-500/10">
                                  <Gavel size={16} />
                                </span>
                                <div className="min-w-0">
                                  <p className="truncate text-base font-bold text-slate-900 dark:text-slate-100">
                                    {buildLawDisplayTitle(law)}
                                  </p>
                                  <p className="mt-1 text-xs font-semibold text-slate-500 dark:text-slate-400">
                                    {formatArticleCount(getLawArticleCount(law))}
                                  </p>
                                </div>
                              </div>

                              <div className="flex w-full items-center gap-3 sm:w-[280px]">
                                <div className="h-2 flex-1 rounded-full bg-slate-200 dark:bg-slate-700">
                                  <div
                                    className="h-full rounded-full bg-[#2f6ff5] transition-[width]"
                                    style={{ width: formatProgressPercent(effectiveProgressPercent) }}
                                  />
                                </div>
                                <span className="text-sm font-bold text-[#2f6ff5]">
                                  {formatProgressPercent(effectiveProgressPercent)}
                                </span>
                                <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-slate-200 bg-white text-slate-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300">
                                  {isLawOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                                </span>
                              </div>
                            </button>

                            {isLawOpen ? (
                              <div className="border-t border-slate-100 bg-white px-3 pb-3 pt-3 dark:border-slate-800 dark:bg-slate-950/40">
                                {outline.status === 'loading' && effectiveSections.length === 0 ? (
                                  <InlineSpinner />
                                ) : null}

                                {outline.status === 'error' && outline.sections.length === 0 ? (
                                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                                    <p className="text-xs font-semibold text-red-500 dark:text-red-400">
                                      {outline.errorMessage || 'Nao foi possivel carregar as secoes desta lei agora.'}
                                    </p>
                                    <button
                                      type="button"
                                      onClick={() => {
                                        void ensureLawOutline(law, true);
                                      }}
                                      className="inline-flex h-9 items-center justify-center rounded-lg border border-[#615fff]/35 px-3 text-[11px] font-black text-[#615fff] transition-colors hover:bg-[#615fff] hover:text-white"
                                    >
                                      Tentar novamente
                                    </button>
                                  </div>
                                ) : null}

                                {outline.status === 'ready' && effectiveSections.length === 0 ? (
                                  <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                                    Esta lei nao possui secoes de artigos disponiveis no momento.
                                  </p>
                                ) : null}

                                {effectiveSections.length > 0 ? (
                                  <div className="space-y-2">
                                    {effectiveSections.map((section, index) => {
                                      const sectionReadingKey = buildSectionReadingKey(section);
                                      const readingState = getSectionReadingEntry(lawReading, section);
                                      const isSectionCompleted = isSectionCompletedForProgress(section, completedArticleIds, lawReading);
                                      const actionLabel = getSectionReadActionLabel(readingState, isSectionCompleted ? 100 : 0);
                                      const shouldMarkAsRead = Boolean(readingState?.startedAt && !isSectionCompleted);
                                      const readBusyKey = `${law.id}:${section.id}`;
                                      const isMarkingSectionAsRead = Boolean(sectionReadBusyMap[readBusyKey]);
                                      const sectionArticles = section.articlePreviews || [];
                                      const isSectionArticlesOpen = expandedSectionByLawId[law.id] === section.id;

                                      return (
                                      <div
                                        key={section.id}
                                        className="rounded-lg border border-slate-200 bg-slate-50 dark:border-slate-800 dark:bg-slate-900"
                                      >
                                        <div className="flex flex-col gap-3 px-3 py-2.5 md:flex-row md:items-center md:justify-between">
                                          <button
                                            type="button"
                                            onClick={() => toggleSectionArticles(law.id, section.id)}
                                            disabled={sectionArticles.length === 0}
                                            aria-expanded={isSectionArticlesOpen}
                                            className="flex min-w-0 flex-1 items-center gap-3 text-left disabled:cursor-default"
                                          >
                                            <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-slate-200 bg-white text-slate-500 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-300">
                                              {isSectionArticlesOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                                            </span>
                                            <FileText size={15} className="shrink-0 text-slate-400" />
                                            <span className="min-w-0">
                                              <span className="block truncate text-sm font-semibold text-slate-700 dark:text-slate-200">
                                                {buildSectionRowLabel(section, index)}
                                              </span>
                                              <span className="mt-0.5 block text-[11px] font-bold uppercase tracking-[0.08em] text-slate-400 dark:text-slate-500">
                                                {sectionArticles.length > 0
                                                  ? `${formatNumber(sectionArticles.length)} artigo(s) vinculado(s)`
                                                  : 'Nenhum artigo vinculado'}
                                              </span>
                                            </span>
                                          </button>
                                          <div className="flex items-center gap-2">
                                            {shouldMarkAsRead ? (
                                              <button
                                                type="button"
                                                onClick={() => {
                                                  void handleMarkSectionAsRead(law, section, lawReading);
                                                }}
                                                disabled={isMarkingSectionAsRead}
                                                className="inline-flex h-9 items-center justify-center gap-2 rounded-lg border border-emerald-500 bg-emerald-500 px-4 text-sm font-bold text-white transition-colors hover:bg-emerald-600 disabled:cursor-not-allowed disabled:opacity-70"
                                              >
                                                {isMarkingSectionAsRead ? <Loader2 size={14} className="animate-spin" /> : null}
                                                {actionLabel}
                                              </button>
                                            ) : (
                                              <Link
                                                href={{
                                                  pathname: `/lei-comentada/${law.slug}`,
                                                  query: {
                                                    lawId: law.id,
                                                    sectionId: section.id,
                                                    from: section.fromArticle,
                                                    to: section.toArticle,
                                                    view: 'pdf',
                                                  },
                                                }}
                                                onMouseEnter={() => prefetchLaw(law.slug)}
                                                onClick={() => {
                                                  if (!userId || isSectionCompleted) return;
                                                  const existingReading = getSectionReadingEntry(lawReading, section);
                                                  const nextLawReading = {
                                                    ...lawReading,
                                                    [sectionReadingKey]: {
                                                      ...existingReading,
                                                      startedAt: existingReading?.startedAt || new Date().toISOString(),
                                                    },
                                                    [section.id]: {
                                                      ...existingReading,
                                                      startedAt: existingReading?.startedAt || new Date().toISOString(),
                                                    },
                                                  };
                                                  saveSectionReadingState(userId, law.id, nextLawReading);
                                                  setSectionReadingByLawId((current) => ({
                                                    ...current,
                                                    [law.id]: nextLawReading,
                                                  }));
                                                }}
                                                className="inline-flex h-9 items-center justify-center rounded-lg border border-[#2f6ff5] bg-[#2f6ff5] px-4 text-sm font-bold text-white transition-colors hover:bg-[#255ee0]"
                                              >
                                                {actionLabel}
                                              </Link>
                                            )}
                                            <button
                                              type="button"
                                              onClick={() => {
                                                void handleToggleSectionFavorite(law.id, section);
                                              }}
                                              disabled={Boolean(sectionFavoriteBusyMap[buildSectionFavoriteKey(law.id, section.id)])}
                                              className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-400 transition-colors hover:border-amber-200 hover:text-amber-500 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-700 dark:bg-slate-900"
                                              title={section.isFavorite ? 'Remover favorito' : 'Salvar favorito'}
                                              aria-label={section.isFavorite ? 'Remover favorito' : 'Salvar favorito'}
                                            >
                                              <Bookmark
                                                size={16}
                                                className={section.isFavorite ? 'fill-amber-400 text-amber-500' : ''}
                                              />
                                            </button>
                                          </div>
                                        </div>

                                        {isSectionArticlesOpen && sectionArticles.length > 0 ? (
                                          <div className="border-t border-slate-200 bg-white px-3 py-2 dark:border-slate-800 dark:bg-slate-950/40">
                                            <div className="divide-y divide-slate-100 overflow-hidden rounded-lg border border-slate-100 dark:divide-slate-800 dark:border-slate-800">
                                              {sectionArticles.map((article) => (
                                                <Link
                                                  key={article.id}
                                                  href={{
                                                    pathname: `/lei-comentada/${law.slug}`,
                                                    query: {
                                                      lawId: law.id,
                                                      sectionId: section.id,
                                                      articleId: article.id,
                                                      from: section.fromArticle,
                                                      to: section.toArticle,
                                                      view: 'pdf',
                                                    },
                                                  }}
                                                  onMouseEnter={() => prefetchLaw(law.slug)}
                                                  className="flex items-center justify-between gap-3 bg-white px-3 py-2 text-sm transition-colors hover:bg-slate-50 dark:bg-slate-950/20 dark:hover:bg-slate-900"
                                                >
                                                  <span className="flex min-w-0 items-center gap-2">
                                                    <FileText size={14} className="shrink-0 text-slate-400" />
                                                    <span className="shrink-0 font-black text-slate-700 dark:text-slate-200">
                                                      Art. {article.number || '-'}
                                                    </span>
                                                    {article.title ? (
                                                      <span className="truncate text-xs font-semibold text-slate-500 dark:text-slate-400">
                                                        {article.title}
                                                      </span>
                                                    ) : null}
                                                  </span>
                                                  <span className="shrink-0 text-xs font-black text-[#615fff]">
                                                    Abrir
                                                  </span>
                                                </Link>
                                              ))}
                                            </div>
                                          </div>
                                        ) : null}
                                      </div>
                                      );
                                    })}
                                  </div>
                                ) : null}
                              </div>
                            ) : null}
                          </article>
                        );
                      })}
                    </div>
                  </div>
                ) : null}
              </div>
            );
          })
        )}
      </section>
    </div>
  );
};

export default AnnotatedLawsPage;
