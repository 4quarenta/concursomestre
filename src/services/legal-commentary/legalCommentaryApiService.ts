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

import { apiClient, ENDPOINTS, assertApiSuccess, readApiData, readApiErrorMessage } from '@services/api';
import { buildRequestCacheKey, withRequestCoalescing } from '@services/api/requestCoalescer';
import { getCurrentUserSnapshot } from '@services/auth/session';
import type { AxiosRequestConfig } from 'axios';
import type {
  ArticleExamTip,
  ArticleJurisprudence,
  LawArticle,
  LawDetail,
  LawSummary,
  Question,
  LegalArea,
  LegalArticleEditorialSnapshot,
  LegalArticleSyllabus,
  LegalRichContentBlock,
  LegalRichContentBlockType,
  LegalEditorialBatchRun,
  LegalEditorialGenerationResult,
  LegalEditorialGenerationScope,
  LawSectionEditorial,
  LegalFavoriteType,
  LegalHomeSnapshot,
  LegalSearchResult,
  LegalSyncLog,
  LegalUserComment,
  LegalUserCommentSubmissionResult,
  RelatedQuestionLawArticle,
  RelatedQuestionLawMatch,
  LawUpdate,
  TeacherComment,
} from '@types';

interface LegalSearchPayload {
  results: LegalSearchResult[];
}

interface LegalAdminListPayload {
  laws: LawSummary[];
  home: LegalHomeSnapshot;
}

interface LegalAdminDetailPayload {
  law: LawDetail | null;
  areas: LegalArea[];
}

interface LegalAdminUpdatesPayload {
  law: LawDetail | null;
  updates: LawUpdate[];
  syncLogs: LegalSyncLog[];
}

export interface PlanaltoCatalogItem {
  url: string;
  label: string;
  sourceId?: string | null;
  sourceLabel?: string | null;
  exists?: boolean;
  lawId?: string | null;
  platformTitle?: string | null;
  lastSyncedAt?: string | null;
  lastUpdatedAt?: string | null;
}

export interface PlanaltoCatalogSource {
  id: string;
  label: string;
  description: string;
  sortOrder?: number;
}

interface PlanaltoCatalogPayload {
  items: PlanaltoCatalogItem[];
  sources: PlanaltoCatalogSource[];
}

interface PlanaltoImportPayload {
  law: LawDetail;
  persisted: boolean;
  created?: boolean;
  sourceUrl: string;
  sync?: {
    insertedArticles: number;
    changedArticles: number;
    revokedArticles: number;
  };
}

export interface LegalEditorialGenerationInput {
  scope: LegalEditorialGenerationScope;
  lawId?: string;
  articleId?: string;
  law: Partial<LawDetail | LawSummary>;
  article?: Partial<LawArticle> | null;
  section?: Record<string, unknown> | null;
  existingEditorial?: Partial<LegalArticleEditorialSnapshot>;
  previewOnly?: boolean;
  batchRunId?: string;
}

const unwrap = <T>(response: unknown, fallback: T): T => readApiData<T>(response, fallback);
const lawDetailCache = new Map<string, LawDetail | null>();
const lawDetailPromiseCache = new Map<string, Promise<LawDetail | null>>();
const lawOutlineCache = new Map<string, LawDetail | null>();
const lawOutlinePromiseCache = new Map<string, Promise<LawDetail | null>>();
const relatedQuestionLawsCache = new Map<string, RelatedQuestionLawMatch[]>();
const homeSnapshotCache = new Map<string, LegalHomeSnapshot>();
const homeSnapshotPromiseCache = new Map<string, Promise<LegalHomeSnapshot>>();

const normalizeText = (value: unknown) => String(value || '')
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .toLowerCase()
  .trim();

const dedupeById = <T extends { id: string }>(items: T[]): T[] => {
  const seen = new Set<string>();
  return items.filter((item) => {
    const key = String(item.id || '');
    if (!key || seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
};

const normalizeQuestionTaxonomy = (question: Question) => {
  const assuntos = Array.isArray(question.assuntos) ? question.assuntos : [];
  const subjects = assuntos
    .filter((item) => item && item.materia)
    .map((item) => ({
      id: String(item.id),
      name: String(item.nome || item.name || '').trim(),
    }))
    .filter((item) => item.name);

  const topics = assuntos
    .filter((item) => item && !item.materia)
    .map((item) => ({
      id: String(item.id),
      rootId: item.assunto_raiz ? String(item.assunto_raiz) : null,
      name: String(item.nome || item.name || '').trim(),
    }))
    .filter((item) => item.name);

  if (!subjects.length && assuntos.length > 0) {
    const fallback = assuntos[0];
    if (fallback?.nome) {
      subjects.push({
        id: String(fallback.id || fallback.slug || fallback.nome),
        name: String(fallback.nome).trim(),
      });
    }
  }

  return { subjects, topics };
};

const buildRelatedQuestionLawsCacheKey = (question: Question) => {
  const taxonomy = normalizeQuestionTaxonomy(question);
  return JSON.stringify({
    id: String(question.id || ''),
    subjects: taxonomy.subjects.map((item) => item.id),
    topics: taxonomy.topics.map((item) => item.id),
  });
};

const buildLawSummarySearchText = (law: LawSummary) => normalizeText([
  law.title,
  law.shortTitle,
  law.acronym,
  law.number,
  law.description,
  law.summary,
  law.ementa,
  ...(Array.isArray(law.aliases) ? law.aliases : []),
].join(' '));

const buildArticleSearchText = (article: LawArticle) => normalizeText([
  article.number,
  article.title,
  article.text,
  article.texto,
  article.hierarchy?.title,
  article.hierarchy?.chapter,
  article.hierarchy?.section,
  ...(Array.isArray(article.blocks) ? article.blocks.slice(0, 4).map((block) => block.text) : []),
].join(' '));

const pickArticleSnippet = (article: LawArticle) => {
  const sourceText = String(article.text || article.texto || article.blocks?.[0]?.text || '').replace(/\s+/g, ' ').trim();
  if (!sourceText) {
    return '';
  }

  return sourceText.length > 180 ? `${sourceText.slice(0, 177)}...` : sourceText;
};

const buildRelatedLawReason = (matchedSubjects: string[], matchedTopics: string[]) => {
  if (matchedSubjects.length > 0 && matchedTopics.length > 0) {
    return `Relacionada à matéria ${matchedSubjects[0]} e ao assunto ${matchedTopics[0]} desta questão.`;
  }

  if (matchedTopics.length > 0) {
    return `Relacionada ao assunto ${matchedTopics[0]} desta questão.`;
  }

  if (matchedSubjects.length > 0) {
    return `Relacionada à matéria ${matchedSubjects[0]} desta questão.`;
  }

  return 'Relacionada ao conteúdo jurídico desta questão.';
};

const normalizeAiGenerationErrorMessage = (message: string): string => {
  const normalized = message.toLowerCase();

  if (
    normalized.includes('quota exceeded')
    || normalized.includes('resource_exhausted')
    || normalized.includes('current quota')
    || normalized.includes('rate-limits')
  ) {
    return 'A chave Gemini configurada no backend está sem cota para geração. Ative faturamento/quota no projeto dessa chave ou troque para outra chave com uso liberado.';
  }

  if (normalized.includes('gemini api key nao esta configurada')) {
    return 'A Gemini API Key ainda nao está configurada no backend. Salve a chave nas configuracoes do sistema e tente novamente.';
  }

  if (
    normalized.includes('erro de conexao com o gemini api')
    || normalized.includes('failed to connect')
    || normalized.includes('connection refused')
  ) {
    return 'O backend não conseguiu se conectar à Gemini API. Verifique conectividade externa e regras de firewall do servidor.';
  }

  if (
    normalized.includes('currently experiencing high demand')
    || normalized.includes('"status": "unavailable"')
    || normalized.includes('temporarily unavailable')
  ) {
    return 'A Gemini API esta com alta demanda neste momento. Tente novamente em alguns instantes.';
  }

  return message;
};

const ensureArray = <T>(value: unknown): T[] => (Array.isArray(value) ? value as T[] : []);
const asRecord = (payload: unknown): Record<string, unknown> => (
  payload && typeof payload === 'object' ? payload as Record<string, unknown> : {}
);

const getUserScopedCacheKey = () => {
  const user = getCurrentUserSnapshot();
  return String(user?.id || user?.email || 'guest');
};

const buildLawDetailCacheKey = (slug: string) => `${getUserScopedCacheKey()}:${slug}`;
const OUTLINE_REQUEST_TIMEOUT_MS = 12_000;

type PublicReadRequestConfig = AxiosRequestConfig & { _skipRefreshHandling: true };

const publicReadRequestConfig = (config: AxiosRequestConfig = {}): PublicReadRequestConfig => ({
  ...config,
  _skipRefreshHandling: true,
}) as PublicReadRequestConfig;

const invalidateLegalUserStateCaches = () => {
  homeSnapshotCache.clear();
  homeSnapshotPromiseCache.clear();
  lawDetailCache.clear();
  lawDetailPromiseCache.clear();
  lawOutlineCache.clear();
  lawOutlinePromiseCache.clear();
};

const normalizeEditorialSnapshot = (payload: unknown): LegalArticleEditorialSnapshot => {
  const record = asRecord(payload);

  return {
    articleId: String(record.articleId || ''),
    articleNumber: record.articleNumber ? String(record.articleNumber) : undefined,
    teacherComments: ensureArray<TeacherComment>(record.teacherComments),
    examTips: ensureArray<ArticleExamTip>(record.examTips),
    doctrine: ensureArray<string>(record.doctrine).map((item) => String(item || '')).filter(Boolean),
    jurisprudenceNotes: ensureArray<string>(record.jurisprudenceNotes).map((item) => String(item || '')).filter(Boolean),
    jurisprudence: ensureArray<ArticleJurisprudence>(record.jurisprudence),
    sumulas: ensureArray<LegalArticleSyllabus>(record.sumulas),
  };
};

const LEGAL_RICH_BLOCK_TYPES: LegalRichContentBlockType[] = [
  'paragraph',
  'bullet_list',
  'table',
  'warning',
  'tip',
  'macete',
  'jurisprudence',
  'example',
  'comparison',
  'summary',
];

const normalizeRichBlockType = (value: unknown): LegalRichContentBlockType => {
  const type = String(value || 'paragraph') as LegalRichContentBlockType;
  return LEGAL_RICH_BLOCK_TYPES.includes(type) ? type : 'paragraph';
};

const LEGAL_RICH_TARGET_KINDS = ['article', 'section', 'caput', 'paragraph', 'inciso', 'alinea', 'item', 'note'] as const;
type LegalRichTargetKind = NonNullable<NonNullable<LegalRichContentBlock['target']>['kind']>;

const normalizeRichTargetKind = (value: unknown): LegalRichTargetKind | undefined => {
  const kind = String(value || '') as LegalRichTargetKind;
  return LEGAL_RICH_TARGET_KINDS.includes(kind) ? kind : undefined;
};

const normalizeRichBlocks = (payload: unknown): LegalRichContentBlock[] => ensureArray<unknown>(payload)
  .filter((item) => item && typeof item === 'object')
  .map((item): LegalRichContentBlock => {
    const record = asRecord(item);
    const target = asRecord(record.target);

    return {
      type: normalizeRichBlockType(record.type),
      title: record.title ? String(record.title) : undefined,
      content: record.content ? String(record.content) : undefined,
      items: ensureArray<string>(record.items).map((entry) => String(entry || '')).filter(Boolean),
      headers: ensureArray<string>(record.headers).map((entry) => String(entry || '')).filter(Boolean),
      rows: ensureArray<unknown>(record.rows)
        .filter(Array.isArray)
        .map((row) => row.map((cell) => String(cell || ''))),
      target: record.target && typeof record.target === 'object'
      ? {
        kind: normalizeRichTargetKind(target.kind),
        label: target.label ? String(target.label) : undefined,
        blockId: target.blockId ? String(target.blockId) : undefined,
      }
      : undefined,
    };
  });

const normalizeSectionEditorial = (payload: unknown): LawSectionEditorial | undefined => {
  if (!payload || typeof payload !== 'object') {
    return undefined;
  }

  const record = asRecord(payload);

  return {
    sectionKey: String(record.sectionKey || ''),
    sectionTitle: String(record.sectionTitle || ''),
    rangeLabel: String(record.rangeLabel || ''),
    articleCount: Number(record.articleCount || 0),
    importance: record.importance ? String(record.importance) : undefined,
    style: record.style ? String(record.style) : undefined,
    summary: String(record.summary || ''),
    blocks: normalizeRichBlocks(record.blocks),
    examFocus: ensureArray<string>(record.examFocus).map((item) => String(item || '')).filter(Boolean),
    examFocusText: record.examFocusText ? String(record.examFocusText) : undefined,
    keywords: ensureArray<string>(record.keywords).map((item) => String(item || '')).filter(Boolean),
    avoidRepetitionNote: record.avoidRepetitionNote ? String(record.avoidRepetitionNote) : undefined,
    macetes: ensureArray<string>(record.macetes).map((item) => String(item || '')).filter(Boolean),
    doctrine: ensureArray<string>(record.doctrine).map((item) => String(item || '')).filter(Boolean),
    jurisprudence: ensureArray<ArticleJurisprudence>(record.jurisprudence),
    sumulas: ensureArray<LegalArticleSyllabus>(record.sumulas),
    highlights: ensureArray<LawSectionEditorial['highlights'][number]>(record.highlights),
  };
};

export const legalCommentaryApiService = {
  async getHomeSnapshot(options?: { force?: boolean }): Promise<LegalHomeSnapshot> {
    const cacheKey = getUserScopedCacheKey();

    if (options?.force) {
      homeSnapshotCache.delete(cacheKey);
      homeSnapshotPromiseCache.delete(cacheKey);
    }

    const cachedSnapshot = homeSnapshotCache.get(cacheKey);
    if (cachedSnapshot) {
      return cachedSnapshot;
    }

    const existingRequest = homeSnapshotPromiseCache.get(cacheKey);
    if (existingRequest) {
      return existingRequest;
    }

    const request = (async () => {
      const response = await apiClient.get(
        ENDPOINTS.legalCommentary.list,
        publicReadRequestConfig(),
      );
      const payload = unwrap<LegalHomeSnapshot>(response, {
        areas: [],
        lawsByArea: [],
        mostAccessed: [],
        favoriteLaws: [],
        recentlyStudied: [],
        recentlyUpdated: [],
        totals: { laws: 0, articles: 0, commentedArticles: 0, updatedRecently: 0 },
      });
      homeSnapshotCache.set(cacheKey, payload);
      return payload;
    })();

    homeSnapshotPromiseCache.set(cacheKey, request);

    try {
      return await request;
    } finally {
      homeSnapshotPromiseCache.delete(cacheKey);
    }
  },

  async search(query: string): Promise<LegalSearchResult[]> {
    const response = await apiClient.get(ENDPOINTS.legalCommentary.list, publicReadRequestConfig({
      params: { q: query },
    }));
    const payload = unwrap<LegalSearchPayload>(response, { results: [] });
    return Array.isArray(payload.results) ? payload.results : [];
  },

  async getLawDetail(slug: string, options?: { force?: boolean }): Promise<LawDetail | null> {
    const normalizedSlug = String(slug || '').trim();
    if (!normalizedSlug) return null;

    const cacheKey = buildLawDetailCacheKey(normalizedSlug);

    if (options?.force) {
      lawDetailCache.delete(cacheKey);
      lawDetailPromiseCache.delete(cacheKey);
    }

    if (lawDetailCache.has(cacheKey)) {
      return lawDetailCache.get(cacheKey) ?? null;
    }

    const existingRequest = lawDetailPromiseCache.get(cacheKey);
    if (existingRequest) {
      return existingRequest;
    }

    const request = (async () => {
      const response = await apiClient.get(ENDPOINTS.legalCommentary.detail, publicReadRequestConfig({
        params: { slug: normalizedSlug },
      }));
      const lawDetail = unwrap<LawDetail | null>(response, null);
      lawDetailCache.set(cacheKey, lawDetail);
      return lawDetail;
    })();

    lawDetailPromiseCache.set(cacheKey, request);

    try {
      return await request;
    } finally {
      lawDetailPromiseCache.delete(cacheKey);
    }
  },

  async getLawOutline(slug: string, options?: { force?: boolean }): Promise<LawDetail | null> {
    const normalizedSlug = String(slug || '').trim();
    if (!normalizedSlug) return null;

    const cacheKey = buildLawDetailCacheKey(normalizedSlug);

    if (options?.force) {
      lawOutlineCache.delete(cacheKey);
      lawOutlinePromiseCache.delete(cacheKey);
    }

    if (lawOutlineCache.has(cacheKey)) {
      return lawOutlineCache.get(cacheKey) ?? null;
    }

    const existingRequest = lawOutlinePromiseCache.get(cacheKey);
    if (existingRequest) {
      return existingRequest;
    }

    const request = (async () => {
      const response = await apiClient.get(ENDPOINTS.legalCommentary.detail, publicReadRequestConfig({
        params: { slug: normalizedSlug, outline: 1 },
        timeout: OUTLINE_REQUEST_TIMEOUT_MS,
      }));
      const lawDetail = unwrap<LawDetail | null>(response, null);
      lawOutlineCache.set(cacheKey, lawDetail);
      return lawDetail;
    })();

    lawOutlinePromiseCache.set(cacheKey, request);

    try {
      return await request;
    } finally {
      lawOutlinePromiseCache.delete(cacheKey);
    }
  },

  async prefetchLawDetail(slug: string): Promise<void> {
    try {
      await this.getLawDetail(slug);
    } catch {
      // Prefetch nao deve bloquear a navegacao.
    }
  },

  async getRelatedLawsForQuestion(question: Question): Promise<RelatedQuestionLawMatch[]> {
    const cacheKey = buildRelatedQuestionLawsCacheKey(question);
    if (relatedQuestionLawsCache.has(cacheKey)) {
      return relatedQuestionLawsCache.get(cacheKey) || [];
    }

    const { subjects, topics } = normalizeQuestionTaxonomy(question);
    if (!subjects.length && !topics.length) {
      relatedQuestionLawsCache.set(cacheKey, []);
      return [];
    }

    const subjectNames = subjects.map((item) => item.name).filter(Boolean);
    const topicNames = topics.map((item) => item.name).filter(Boolean);
    const subjectIds = new Set(subjects.map((item) => item.id));
    const topicIds = new Set(topics.map((item) => item.id));
    const subjectNamesNormalized = subjectNames.map(normalizeText);
    const topicNamesNormalized = topicNames.map(normalizeText);

    const home = await this.getHomeSnapshot();
    const allLaws = dedupeById<LawSummary>(home.lawsByArea.flatMap((entry) => entry.laws));

    const summaryCandidates = allLaws
      .map((law) => {
        const haystack = buildLawSummarySearchText(law);
        let score = 0;
        const lawSubjectId = String(law.areaId || '');
        const matchedSubjectNames = subjectNames.filter((name, index) => {
          const normalized = subjectNamesNormalized[index];
          if (!normalized) return false;
          const isMatch = haystack.includes(normalized);
          if (isMatch) {
            score += 4;
          }
          return isMatch;
        });

        if (lawSubjectId && subjectIds.has(lawSubjectId)) {
          score += 12;
          const subjectName = subjects.find((item) => item.id === lawSubjectId)?.name;
          if (subjectName && !matchedSubjectNames.includes(subjectName)) {
            matchedSubjectNames.push(subjectName);
          }
        }

        const matchedTopicNames = topicNames.filter((name, index) => {
          const normalized = topicNamesNormalized[index];
          if (!normalized) return false;
          const isMatch = haystack.includes(normalized);
          if (isMatch) {
            score += 6;
          }
          return isMatch;
        });

        const areaName = normalizeText(home.lawsByArea.find((entry) => entry.laws.some((item) => item.id === law.id))?.area?.name || '');
        subjectNamesNormalized.forEach((normalized, index) => {
          if (normalized && (normalized.includes(areaName) || areaName.includes(normalized))) {
            score += 5;
            if (!matchedSubjectNames.includes(subjectNames[index])) {
              matchedSubjectNames.push(subjectNames[index]);
            }
          }
        });

        return {
          law,
          score,
          matchedSubjectNames,
          matchedTopicNames,
        };
      })
      .filter((entry) => entry.score > 0)
      .sort((left, right) => right.score - left.score)
      .slice(0, 6);

    const lawDetails = await Promise.all(
      summaryCandidates.map(async (entry) => ({
        summary: entry,
        detail: await this.getLawDetail(entry.law.slug),
      })),
    );

    const results = lawDetails
      .map(({ summary, detail }) => {
        const matchedArticles: RelatedQuestionLawArticle[] = Array.isArray(detail?.articles)
          ? detail!.articles
            .map((article) => {
              let score = 0;
              const articleMatchedSubjects = new Set<string>(summary.matchedSubjectNames);
              const articleMatchedTopics = new Set<string>(summary.matchedTopicNames);

              if (article.subjectFilterId && subjectIds.has(String(article.subjectFilterId))) {
                score += 6;
                const subjectName = subjects.find((item) => item.id === String(article.subjectFilterId))?.name;
                if (subjectName) {
                  articleMatchedSubjects.add(subjectName);
                }
              }

              if (article.subjectFilterId && topicIds.has(String(article.subjectFilterId))) {
                score += 12;
                const topicName = topics.find((item) => item.id === String(article.subjectFilterId))?.name;
                if (topicName) {
                  articleMatchedTopics.add(topicName);
                }
              }

              if (article.topicFilterId && topicIds.has(String(article.topicFilterId))) {
                score += 18;
                const topicName = topics.find((item) => item.id === String(article.topicFilterId))?.name;
                if (topicName) {
                  articleMatchedTopics.add(topicName);
                }
              }

              const articleSearchText = buildArticleSearchText(article);

              subjectNamesNormalized.forEach((normalized, index) => {
                if (normalized && articleSearchText.includes(normalized)) {
                  score += 3;
                  articleMatchedSubjects.add(subjectNames[index]);
                }
              });

              topicNamesNormalized.forEach((normalized, index) => {
                if (normalized && articleSearchText.includes(normalized)) {
                  score += 6;
                  articleMatchedTopics.add(topicNames[index]);
                }
              });

              if (score <= 0) {
                return null;
              }

              return {
                id: article.id,
                number: article.number,
                title: article.title,
                snippet: pickArticleSnippet(article),
                matchScore: score,
                matchedSubjectNames: Array.from(articleMatchedSubjects),
                matchedTopicNames: Array.from(articleMatchedTopics),
              };
            })
            .filter((item): item is RelatedQuestionLawArticle => Boolean(item))
            .sort((left, right) => right.matchScore - left.matchScore)
            .slice(0, 3)
          : [];

        const score = summary.score + matchedArticles.reduce((accumulator, item) => accumulator + item.matchScore, 0);
        const matchedSubjectNames = Array.from(new Set([
          ...summary.matchedSubjectNames,
          ...matchedArticles.flatMap((item) => item.matchedSubjectNames),
        ]));
        const matchedTopicNames = Array.from(new Set([
          ...summary.matchedTopicNames,
          ...matchedArticles.flatMap((item) => item.matchedTopicNames),
        ]));

        if (score <= 0) {
          return null;
        }

        return {
          law: summary.law,
          reason: buildRelatedLawReason(matchedSubjectNames, matchedTopicNames),
          score,
          matchedSubjectNames,
          matchedTopicNames,
          matchedArticles,
        };
      })
      .filter((item): item is RelatedQuestionLawMatch => Boolean(item))
      .sort((left, right) => right.score - left.score)
      .slice(0, 3);

    relatedQuestionLawsCache.set(cacheKey, results);
    return results;
  },

  async toggleFavorite(type: LegalFavoriteType, targetId: string): Promise<{ isFavorite: boolean }> {
    const response = await apiClient.post(ENDPOINTS.legalCommentary.favorite, { type, targetId });
    const envelope = assertApiSuccess<{ isFavorite: boolean }>(response, 'Nao foi possivel atualizar o favorito.');
    const payload = unwrap(envelope.raw, { isFavorite: false });
    invalidateLegalUserStateCaches();
    return payload;
  },

  async recordLawView(lawId: string): Promise<void> {
    await apiClient.post(ENDPOINTS.legalCommentary.progress, { lawId });
    invalidateLegalUserStateCaches();
  },

  async recordArticleView(lawId: string, articleId: string): Promise<void> {
    await apiClient.post(ENDPOINTS.legalCommentary.progress, { lawId, articleId });
    invalidateLegalUserStateCaches();
  },

  async addUserComment(input: { articleId: string; body: string }): Promise<LegalUserCommentSubmissionResult> {
    const response = await apiClient.post(ENDPOINTS.legalCommentary.comment, {
      action: 'create',
      ...input,
    });
    const envelope = assertApiSuccess<LegalUserCommentSubmissionResult>(response, 'Nao foi possivel criar o comentario.');
    const payload = unwrap<LegalUserCommentSubmissionResult>(envelope.raw, {
      id: '',
      moderationStatus: 'pending',
      requiresModeration: true,
    });
    invalidateLegalUserStateCaches();
    return payload;
  },

  async updateUserComment(commentId: string, body: string): Promise<LegalUserComment> {
    const response = await apiClient.post(ENDPOINTS.legalCommentary.comment, {
      action: 'update',
      commentId,
      body,
    });
    const envelope = assertApiSuccess<LegalUserComment>(response, 'Nao foi possivel atualizar o comentario.');
    const payload = unwrap<LegalUserComment>(envelope.raw, {} as LegalUserComment);
    invalidateLegalUserStateCaches();
    return payload;
  },

  async deleteUserComment(commentId: string): Promise<void> {
    const response = await apiClient.post(ENDPOINTS.legalCommentary.comment, {
      action: 'delete',
      commentId,
    });
    assertApiSuccess(response, 'Nao foi possivel excluir o comentario.');
    invalidateLegalUserStateCaches();
  },

  async reportUserComment(commentId: string): Promise<void> {
    const response = await apiClient.post(ENDPOINTS.legalCommentary.comment, {
      action: 'report',
      commentId,
    });
    assertApiSuccess(response, 'Nao foi possivel denunciar o comentario.');
  },

  async getAdminList(query = ''): Promise<LegalAdminListPayload> {
    const response = await apiClient.get(ENDPOINTS.legalCommentary.adminList, {
      params: query ? { q: query } : undefined,
    });
    return unwrap<LegalAdminListPayload>(response, {
      laws: [],
      home: {
        areas: [],
        lawsByArea: [],
        mostAccessed: [],
        favoriteLaws: [],
        recentlyStudied: [],
        recentlyUpdated: [],
        totals: { laws: 0, articles: 0, commentedArticles: 0, updatedRecently: 0 },
      },
    });
  },

  async getAdminDetail(id: string): Promise<LegalAdminDetailPayload> {
    const normalizedId = String(id || '').trim();
    return withRequestCoalescing(
      buildRequestCacheKey('legal-commentary:admin-detail', { id: normalizedId }),
      async () => {
        const response = await apiClient.get(ENDPOINTS.legalCommentary.adminDetail, {
          params: { id: normalizedId },
        });
        return unwrap<LegalAdminDetailPayload>(response, { law: null, areas: [] });
      },
      15_000,
    );
  },

  async saveAdminLaw(payload: Partial<LawDetail> & Record<string, unknown>): Promise<LawDetail> {
    const response = await apiClient.post(ENDPOINTS.legalCommentary.adminSave, payload);
    const envelope = assertApiSuccess<LawDetail>(response, 'Nao foi possivel salvar a lei.');
    const law = unwrap<LawDetail>(envelope.raw, {} as LawDetail);
    invalidateLegalUserStateCaches();
    return law;
  },

  async deleteAdminLaw(id: string): Promise<void> {
    const response = await apiClient.post(`${ENDPOINTS.legalCommentary.adminDelete}?id=${encodeURIComponent(id)}`);
    assertApiSuccess(response, 'Nao foi possivel remover a lei.');
    invalidateLegalUserStateCaches();
  },

  async getSyncCatalog(sourceIds: string[] = []): Promise<PlanaltoCatalogPayload> {
    const response = await apiClient.get(ENDPOINTS.legalCommentary.adminCatalog, {
      params: sourceIds.length > 0 ? { sources: sourceIds.join(',') } : undefined,
    });
    const payload = unwrap<PlanaltoCatalogPayload>(response, { items: [], sources: [] });
    return {
      items: Array.isArray(payload.items) ? payload.items : [],
      sources: Array.isArray(payload.sources) ? payload.sources : [],
    };
  },

  async importLawFromPlanalto(url: string, persist = false): Promise<PlanaltoImportPayload> {
    const response = await apiClient.post(ENDPOINTS.legalCommentary.adminImport, {
      url,
      persist,
    });
    const envelope = assertApiSuccess<PlanaltoImportPayload>(response, 'Nao foi possivel importar a lei do Planalto.');
    const payload = unwrap<PlanaltoImportPayload>(envelope.raw, {} as PlanaltoImportPayload);
    if (persist) {
      invalidateLegalUserStateCaches();
    }
    return payload;
  },

  async syncAdminLaw(id: string): Promise<PlanaltoImportPayload> {
    const response = await apiClient.post(ENDPOINTS.legalCommentary.adminSync, { id });
    const envelope = assertApiSuccess<PlanaltoImportPayload>(response, 'Nao foi possivel sincronizar esta lei.');
    const payload = unwrap<PlanaltoImportPayload>(envelope.raw, {} as PlanaltoImportPayload);
    invalidateLegalUserStateCaches();
    return payload;
  },

  async getAdminLawUpdates(id: string): Promise<LegalAdminUpdatesPayload> {
    const normalizedId = String(id || '').trim();
    return withRequestCoalescing(
      buildRequestCacheKey('legal-commentary:admin-updates', { id: normalizedId }),
      async () => {
        const response = await apiClient.get(ENDPOINTS.legalCommentary.adminUpdates, {
          params: { id: normalizedId },
        });
        return unwrap<LegalAdminUpdatesPayload>(response, { law: null, updates: [], syncLogs: [] });
      },
      15_000,
    );
  },

  async generateAdminEditorial(input: LegalEditorialGenerationInput): Promise<LegalEditorialGenerationResult> {
    try {
      const response = await apiClient.post(ENDPOINTS.legalCommentary.adminGenerate, {
        ...input,
        existingEditorial: input.existingEditorial ? {
          articleId: input.existingEditorial.articleId,
          articleNumber: input.existingEditorial.articleNumber,
          teacherComments: input.existingEditorial.teacherComments || [],
          examTips: input.existingEditorial.examTips || [],
          doctrine: input.existingEditorial.doctrine || [],
          jurisprudenceNotes: input.existingEditorial.jurisprudenceNotes || [],
          jurisprudence: input.existingEditorial.jurisprudence || [],
          sumulas: input.existingEditorial.sumulas || [],
        } : undefined,
      });
      const envelope = assertApiSuccess<LegalEditorialGenerationResult>(response, 'Nao foi possivel gerar o conteudo com IA.');
      const payload = unwrap<LegalEditorialGenerationResult>(envelope.raw, {} as LegalEditorialGenerationResult);
      return {
        ...payload,
        editorial: normalizeEditorialSnapshot(payload.editorial),
        sectionEditorial: normalizeSectionEditorial(asRecord(payload).sectionEditorial),
      };
    } catch (error: unknown) {
      const message = readApiErrorMessage(error, 'Nao foi possivel gerar o conteudo com IA.');
      throw new Error(normalizeAiGenerationErrorMessage(message));
    }
  },

  async startAdminEditorialBatch(lawId: string, articleIds: string[]): Promise<LegalEditorialBatchRun> {
    const response = await apiClient.post(ENDPOINTS.legalCommentary.adminBatchStart, {
      lawId,
      articleIds,
    });
    const envelope = assertApiSuccess<{ run: LegalEditorialBatchRun }>(response, 'Nao foi possivel iniciar o lote editorial.');
    return unwrap<{ run: LegalEditorialBatchRun }>(envelope.raw, { run: {} as LegalEditorialBatchRun }).run;
  },

  async getAdminEditorialBatchStatus(params: { runId?: string; lawId?: string }): Promise<LegalEditorialBatchRun | null> {
    return withRequestCoalescing(
      buildRequestCacheKey('legal-commentary:admin-batch-status', params),
      async () => {
        const response = await apiClient.get(ENDPOINTS.legalCommentary.adminBatchStatus, {
          params,
        });
        const payload = unwrap<{ run: LegalEditorialBatchRun | null }>(response, { run: null });
        return payload.run || null;
      },
      0,
    );
  },

  async retryAdminEditorialBatch(runId: string): Promise<LegalEditorialBatchRun> {
    const response = await apiClient.post(ENDPOINTS.legalCommentary.adminBatchRetry, {
      runId,
    });
    const envelope = assertApiSuccess<{ run: LegalEditorialBatchRun }>(response, 'Nao foi possivel reprocessar os artigos falhados.');
    return unwrap<{ run: LegalEditorialBatchRun }>(envelope.raw, { run: {} as LegalEditorialBatchRun }).run;
  },

  async stopAdminEditorialBatch(runId: string): Promise<LegalEditorialBatchRun> {
    const response = await apiClient.post(ENDPOINTS.legalCommentary.adminBatchStop, {
      runId,
    });
    const envelope = assertApiSuccess<{ run: LegalEditorialBatchRun }>(response, 'Nao foi possivel interromper o lote editorial.');
    return unwrap<{ run: LegalEditorialBatchRun }>(envelope.raw, { run: {} as LegalEditorialBatchRun }).run;
  },
};

export default legalCommentaryApiService;
