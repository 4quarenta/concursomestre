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
import { ChevronDown, ChevronUp, FileText, Gavel, GripVertical, Loader2, Search, Star } from 'lucide-react';
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
import type { LawArticle, LawSection, LawSummary, LegalHomeSnapshot } from '@types';
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
  sectionKey?: string;
  title: string;
  fromArticle: string;
  toArticle: string;
  articles: number;
  primaryArticleId: string;
  articleIds: string[];
  isFavorite: boolean;
};

type LawSummaryWithArticleAliases = LawSummary & {
  articlesCount?: number | string;
  totalArticles?: number | string;
  artigos?: number | string | unknown[];
  articles?: number | string | unknown[];
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
type SectionReadingState = Record<string, { startedAt?: string; completedAt?: string }>;

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

const getSectionReadingEntry = (
  state: SectionReadingState | undefined,
  section: Pick<LawSectionSummary, 'id' | 'fromArticle' | 'toArticle'>,
) => {
  if (!state) return undefined;
  return state[buildSectionReadingKey(section)] || state[String(section.id || '')];
};

const getSectionReadActionLabel = (reading?: { startedAt?: string; completedAt?: string }, progressPercent?: number) => {
  if (reading?.completedAt || Number(progressPercent || 0) >= 100) return 'Ler novamente';
  if (reading?.startedAt) return 'Continuar lendo';
  return 'Começar';
};

const getUserId = (user: UserLike) => user?.id || user?.userId || user?.email || null;

const normalizeText = (value: unknown) => String(value || '')
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .toLowerCase()
  .trim();

const formatNumber = (value: number) => new Intl.NumberFormat('pt-BR').format(Number(value || 0));

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

const resolveLawArticleCount = (law: LawSummary): number => {
  const lawWithAliases = law as LawSummaryWithArticleAliases;
  const candidates: unknown[] = [
    law.articleCount,
    law.totalArtigos,
    lawWithAliases.articlesCount,
    lawWithAliases.totalArticles,
    lawWithAliases.artigos,
    lawWithAliases.articles,
  ];

  for (const candidate of candidates) {
    if (Array.isArray(candidate) && candidate.length > 0) {
      return candidate.length;
    }

    if (typeof candidate === 'number' && Number.isFinite(candidate) && candidate > 0) {
      return Math.round(candidate);
    }

    if (typeof candidate === 'string') {
      const extracted = candidate.match(/\d+/g)?.join('') || '';
      if (!extracted) {
        continue;
      }

      const parsed = Number(extracted);
      if (Number.isFinite(parsed) && parsed > 0) {
        return Math.round(parsed);
      }
    }
  }

  return 1;
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

  return (detail?.sections || []).map((section) => {
    const sectionArticles = articlesBySection.get(String(section.id)) || [];
    const articleIds = sectionArticles.map((article) => String(article.id));
    return {
      id: String(section.id),
      sectionKey: String(section.slug || section.id),
      title: String(section.displayTitle || section.title || 'Secao da lei'),
      fromArticle: String(section.fromArticle || sectionArticles[0]?.number || ''),
      toArticle: String(section.toArticle || sectionArticles[sectionArticles.length - 1]?.number || ''),
      articles: Number(section.articleCount || sectionArticles.length),
      primaryArticleId: articleIds[0] || '',
      articleIds,
      isFavorite: Boolean(section.isFavorite),
    };
  });
};

const isFallbackSectionCollection = (law: LawSummary, sections: LawSectionSummary[]) => (
  sections.length === 1 && sections[0]?.id === `full-law-${law.id}`
);

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
  const { currentUser } = useAuth();
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
  const [lawOutlineById, setLawOutlineById] = React.useState<Record<string, LawOutlineEntry>>({});
  const [sectionFavoriteBusyMap, setSectionFavoriteBusyMap] = React.useState<Record<string, boolean>>({});
  const [sectionReadingByLawId, setSectionReadingByLawId] = React.useState<Record<string, SectionReadingState>>({});
  const lawOutlineByIdRef = React.useRef<Record<string, LawOutlineEntry>>({});
  const pendingOutlineIdsRef = React.useRef<Set<string>>(new Set());
  const isMountedRef = React.useRef(true);
  const addToastRef = React.useRef(addToast);
  const homeRequestIdRef = React.useRef(0);

  React.useEffect(() => () => {
    isMountedRef.current = false;
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

  const groupedAreas = React.useMemo(() => {
    const normalizedQuery = normalizeText(query);

    return snapshot.lawsByArea
      .filter((group) => selectedArea === 'all' || String(group.area.id) === String(selectedArea))
      .map((group) => {
        const areaLaws = Array.isArray(group.laws) ? group.laws : [];
        const laws = areaLaws
          .filter((law) => {
            if (!normalizedQuery) return true;
            const haystack = normalizeText([
              law.shortTitle,
              law.title,
              law.number,
              law.summary,
              law.description,
              law.acronym,
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
          readCount: areaLaws.filter((law) => Number(law.progressPercent || 0) > 0).length,
          totalCount: areaLaws.length,
        };
      })
      .filter((group) => group.laws.length > 0);
  }, [query, selectedArea, snapshot.lawsByArea, sortMode]);

  React.useEffect(() => {
    const frameId = window.requestAnimationFrame(() => {
      if (!userId) {
        setSectionReadingByLawId({});
        return;
      }

      const nextState: Record<string, SectionReadingState> = {};
      snapshot.lawsByArea.forEach((group) => {
        (group.laws || []).forEach((law) => {
          nextState[law.id] = readSectionReadingState(userId, law.id);
        });
      });
      setSectionReadingByLawId(nextState);
    });

    return () => window.cancelAnimationFrame(frameId);
  }, [snapshot.lawsByArea, userId]);

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

      if (sections.length === 0) {
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

  const handleToggleSectionFavorite = React.useCallback(async (
    lawId: string,
    section: LawSectionSummary,
  ) => {
    if (!userId) {
      addToast('Entre na sua conta para salvar favoritos.', 'warning');
      return;
    }

    const sectionKey = buildSectionFavoriteKey(lawId, section.id);
    if (sectionFavoriteBusyMap[sectionKey]) {
      return;
    }

    const targetSectionId = String(section.id || '').trim();
    if (!targetSectionId) {
      addToast('Nao foi possivel identificar esta secao para salvar.', 'error');
      return;
    }

    const previousFavorite = Boolean(section.isFavorite);
    const optimisticFavorite = !previousFavorite;

    setSectionFavoriteBusyMap((current) => ({ ...current, [sectionKey]: true }));
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

      addToast(persistedFavorite ? 'Secao salva nos favoritos.' : 'Secao removida dos favoritos.', 'success');
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
      addToast('Nao foi possivel atualizar o favorito desta secao.', 'error');
    } finally {
      setSectionFavoriteBusyMap((current) => {
        if (!current[sectionKey]) return current;
        const next = { ...current };
        delete next[sectionKey];
        return next;
      });
    }
  }, [addToast, sectionFavoriteBusyMap, userId]);

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
            <option value="all">Todas as areas</option>
            {snapshot.lawsByArea.map((group) => (
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
                                    {formatArticleCount(law.articleCount)}
                                  </p>
                                </div>
                              </div>

                              <div className="flex w-full items-center gap-3 sm:w-[280px]">
                                <div className="h-2 flex-1 rounded-full bg-slate-200 dark:bg-slate-700">
                                  <div
                                    className="h-full rounded-full bg-[#2f6ff5] transition-[width]"
                                    style={{ width: formatProgressPercent(law.progressPercent) }}
                                  />
                                </div>
                                <span className="text-sm font-bold text-[#2f6ff5]">
                                  {formatProgressPercent(law.progressPercent)}
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
                                      const lawReading = sectionReadingByLawId[law.id] || {};
                                      const readingState = getSectionReadingEntry(lawReading, section);
                                      const actionLabel = getSectionReadActionLabel(readingState, law.progressPercent);

                                      return (
                                      <div
                                        key={section.id}
                                        className="flex flex-col gap-3 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 dark:border-slate-800 dark:bg-slate-900 md:flex-row md:items-center md:justify-between"
                                      >
                                        <div className="flex min-w-0 items-center gap-3">
                                          <FileText size={15} className="shrink-0 text-slate-400" />
                                          <p className="truncate text-sm font-semibold text-slate-700 dark:text-slate-200">
                                            {buildSectionRowLabel(section, index)}
                                          </p>
                                        </div>
                                        <div className="flex items-center gap-2">
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
                                              if (!userId) return;
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
                                            <Star
                                              size={16}
                                              className={section.isFavorite ? 'fill-amber-400 text-amber-500' : ''}
                                            />
                                          </button>
                                        </div>
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
