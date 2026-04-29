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
import {
  getAccessToken,
  getCurrentUserSnapshot,
  isAccessTokenExpired,
  refreshAuthSession,
} from '@services/auth/session';
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
  LegalEditorialBatchRun,
  LegalEditorialGenerationResult,
  LegalEditorialGenerationScope,
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
  existingEditorial?: Partial<LegalArticleEditorialSnapshot>;
  previewOnly?: boolean;
  batchRunId?: string;
}

const unwrap = <T>(response: any, fallback: T): T => readApiData<T>(response, fallback);
const lawDetailCache = new Map<string, LawDetail | null>();
const lawDetailPromiseCache = new Map<string, Promise<LawDetail | null>>();
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

const getUserScopedCacheKey = () => {
  const user = getCurrentUserSnapshot();
  return String(user?.id || user?.email || 'guest');
};

const buildLawDetailCacheKey = (slug: string) => `${getUserScopedCacheKey()}:${slug}`;

const ensureAuthenticatedOptionalRead = async () => {
  const user = getCurrentUserSnapshot();
  if (!user) {
    return;
  }

  const token = getAccessToken();
  if (token && !isAccessTokenExpired(token, 30)) {
    return;
  }

  try {
    await refreshAuthSession({
      reason: 'manual',
      force: true,
      allowAnonymousFailure: true,
    });
  } catch {
    // Leituras opcionais continuam publicas se a sessao nao puder ser renovada.
  }
};

const invalidateLegalUserStateCaches = () => {
  homeSnapshotCache.clear();
  homeSnapshotPromiseCache.clear();
  lawDetailCache.clear();
  lawDetailPromiseCache.clear();
};

const normalizeEditorialSnapshot = (payload: any): LegalArticleEditorialSnapshot => ({
  articleId: String(payload?.articleId || ''),
  articleNumber: payload?.articleNumber ? String(payload.articleNumber) : undefined,
  teacherComments: ensureArray<TeacherComment>(payload?.teacherComments),
  examTips: ensureArray<ArticleExamTip>(payload?.examTips),
  doctrine: ensureArray<string>(payload?.doctrine).map((item) => String(item || '')).filter(Boolean),
  jurisprudenceNotes: ensureArray<string>(payload?.jurisprudenceNotes).map((item) => String(item || '')).filter(Boolean),
  jurisprudence: ensureArray<ArticleJurisprudence>(payload?.jurisprudence),
  sumulas: ensureArray<LegalArticleSyllabus>(payload?.sumulas),
});

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
      await ensureAuthenticatedOptionalRead();
      const response = await apiClient.get(ENDPOINTS.legalCommentary.list) as any;
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
    const response = await apiClient.get(ENDPOINTS.legalCommentary.list, {
      params: { q: query },
    }) as any;
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
      await ensureAuthenticatedOptionalRead();
      const response = await apiClient.get(ENDPOINTS.legalCommentary.detail, {
        params: { slug: normalizedSlug },
      }) as any;
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
    const response = await apiClient.post(ENDPOINTS.legalCommentary.favorite, { type, targetId }) as any;
    const envelope = assertApiSuccess<{ isFavorite: boolean }>(response, 'Nao foi possivel atualizar o favorito.');
    const payload = unwrap(envelope.raw, { isFavorite: false });
    invalidateLegalUserStateCaches();
    return payload;
  },

  async recordLawView(lawId: string): Promise<void> {
    await apiClient.post(ENDPOINTS.legalCommentary.progress, { lawId }) as any;
    invalidateLegalUserStateCaches();
  },

  async recordArticleView(lawId: string, articleId: string): Promise<void> {
    await apiClient.post(ENDPOINTS.legalCommentary.progress, { lawId, articleId }) as any;
    invalidateLegalUserStateCaches();
  },

  async addUserComment(input: { articleId: string; body: string }): Promise<LegalUserCommentSubmissionResult> {
    const response = await apiClient.post(ENDPOINTS.legalCommentary.comment, {
      action: 'create',
      ...input,
    }) as any;
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
    }) as any;
    const envelope = assertApiSuccess<LegalUserComment>(response, 'Nao foi possivel atualizar o comentario.');
    const payload = unwrap<LegalUserComment>(envelope.raw, {} as LegalUserComment);
    invalidateLegalUserStateCaches();
    return payload;
  },

  async deleteUserComment(commentId: string): Promise<void> {
    const response = await apiClient.post(ENDPOINTS.legalCommentary.comment, {
      action: 'delete',
      commentId,
    }) as any;
    assertApiSuccess(response, 'Nao foi possivel excluir o comentario.');
    invalidateLegalUserStateCaches();
  },

  async reportUserComment(commentId: string): Promise<void> {
    const response = await apiClient.post(ENDPOINTS.legalCommentary.comment, {
      action: 'report',
      commentId,
    }) as any;
    assertApiSuccess(response, 'Nao foi possivel denunciar o comentario.');
  },

  async getAdminList(query = ''): Promise<LegalAdminListPayload> {
    const response = await apiClient.get(ENDPOINTS.legalCommentary.adminList, {
      params: query ? { q: query } : undefined,
    }) as any;
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
    const response = await apiClient.get(ENDPOINTS.legalCommentary.adminDetail, {
      params: { id },
    }) as any;
    return unwrap<LegalAdminDetailPayload>(response, { law: null, areas: [] });
  },

  async saveAdminLaw(payload: Partial<LawDetail> & Record<string, any>): Promise<LawDetail> {
    const response = await apiClient.post(ENDPOINTS.legalCommentary.adminSave, payload) as any;
    const envelope = assertApiSuccess<LawDetail>(response, 'Nao foi possivel salvar a lei.');
    return unwrap<LawDetail>(envelope.raw, {} as LawDetail);
  },

  async deleteAdminLaw(id: string): Promise<void> {
    const response = await apiClient.post(`${ENDPOINTS.legalCommentary.adminDelete}?id=${encodeURIComponent(id)}`) as any;
    assertApiSuccess(response, 'Nao foi possivel remover a lei.');
  },

  async getSyncCatalog(sourceIds: string[] = []): Promise<PlanaltoCatalogPayload> {
    const response = await apiClient.get(ENDPOINTS.legalCommentary.adminCatalog, {
      params: sourceIds.length > 0 ? { sources: sourceIds.join(',') } : undefined,
    }) as any;
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
    }) as any;
    const envelope = assertApiSuccess<PlanaltoImportPayload>(response, 'Nao foi possivel importar a lei do Planalto.');
    return unwrap<PlanaltoImportPayload>(envelope.raw, {} as PlanaltoImportPayload);
  },

  async syncAdminLaw(id: string): Promise<PlanaltoImportPayload> {
    const response = await apiClient.post(ENDPOINTS.legalCommentary.adminSync, { id }) as any;
    const envelope = assertApiSuccess<PlanaltoImportPayload>(response, 'Nao foi possivel sincronizar esta lei.');
    return unwrap<PlanaltoImportPayload>(envelope.raw, {} as PlanaltoImportPayload);
  },

  async getAdminLawUpdates(id: string): Promise<LegalAdminUpdatesPayload> {
    const response = await apiClient.get(ENDPOINTS.legalCommentary.adminUpdates, {
      params: { id },
    }) as any;
    return unwrap<LegalAdminUpdatesPayload>(response, { law: null, updates: [], syncLogs: [] });
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
      }) as any;
      const envelope = assertApiSuccess<LegalEditorialGenerationResult>(response, 'Nao foi possivel gerar o conteudo com IA.');
      const payload = unwrap<LegalEditorialGenerationResult>(envelope.raw, {} as LegalEditorialGenerationResult);
      return {
        ...payload,
        editorial: normalizeEditorialSnapshot(payload.editorial),
      };
    } catch (error: any) {
      const message = readApiErrorMessage(error, 'Nao foi possivel gerar o conteudo com IA.');
      throw new Error(normalizeAiGenerationErrorMessage(message));
    }
  },

  async startAdminEditorialBatch(lawId: string, articleIds: string[]): Promise<LegalEditorialBatchRun> {
    const response = await apiClient.post(ENDPOINTS.legalCommentary.adminBatchStart, {
      lawId,
      articleIds,
    }) as any;
    const envelope = assertApiSuccess<{ run: LegalEditorialBatchRun }>(response, 'Nao foi possivel iniciar o lote editorial.');
    return unwrap<{ run: LegalEditorialBatchRun }>(envelope.raw, { run: {} as LegalEditorialBatchRun }).run;
  },

  async getAdminEditorialBatchStatus(params: { runId?: string; lawId?: string }): Promise<LegalEditorialBatchRun | null> {
    const response = await apiClient.get(ENDPOINTS.legalCommentary.adminBatchStatus, {
      params,
    }) as any;
    const payload = unwrap<{ run: LegalEditorialBatchRun | null }>(response, { run: null });
    return payload.run || null;
  },

  async retryAdminEditorialBatch(runId: string): Promise<LegalEditorialBatchRun> {
    const response = await apiClient.post(ENDPOINTS.legalCommentary.adminBatchRetry, {
      runId,
    }) as any;
    const envelope = assertApiSuccess<{ run: LegalEditorialBatchRun }>(response, 'Nao foi possivel reprocessar os artigos falhados.');
    return unwrap<{ run: LegalEditorialBatchRun }>(envelope.raw, { run: {} as LegalEditorialBatchRun }).run;
  },

  async stopAdminEditorialBatch(runId: string): Promise<LegalEditorialBatchRun> {
    const response = await apiClient.post(ENDPOINTS.legalCommentary.adminBatchStop, {
      runId,
    }) as any;
    const envelope = assertApiSuccess<{ run: LegalEditorialBatchRun }>(response, 'Nao foi possivel interromper o lote editorial.');
    return unwrap<{ run: LegalEditorialBatchRun }>(envelope.raw, { run: {} as LegalEditorialBatchRun }).run;
  },
};

export default legalCommentaryApiService;
