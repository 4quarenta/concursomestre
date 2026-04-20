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

import type {
  LawArticle,
  LawDetail,
  LawSummary,
  LegalFavoriteType,
  LegalHomeSnapshot,
  LegalSearchResult,
  LegalUserComment,
  LegalUserFavorite,
  LegalUserProgress,
} from '@types';
import {
  buildLawDetailSeed,
  examTipsSeed,
  jurisprudenceSeed,
  lawArticlesSeed,
  lawsSeed,
  legalAreasSeed,
  teacherCommentsSeed,
} from './legalCommentaryData';

const FAVORITES_STORAGE_KEY = 'cm:legal-commentary:favorites';
const COMMENTS_STORAGE_KEY = 'cm:legal-commentary:comments';
const PROGRESS_STORAGE_KEY = 'cm:legal-commentary:progress';

const isBrowser = () => typeof window !== 'undefined' && Boolean(window.localStorage);

const normalizeSearch = (value: string) =>
  value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();

const nowIso = () => new Date().toISOString();

const createId = (prefix: string) => {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return `${prefix}-${crypto.randomUUID()}`;
  }

  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
};

const readStorage = <T>(key: string, fallback: T): T => {
  if (!isBrowser()) return fallback;

  try {
    const raw = window.localStorage.getItem(key);
    return raw ? JSON.parse(raw) as T : fallback;
  } catch {
    return fallback;
  }
};

const writeStorage = <T>(key: string, value: T) => {
  if (!isBrowser()) return;
  window.localStorage.setItem(key, JSON.stringify(value));
};

const getUserKey = (userId?: string | number | null) => String(userId || 'guest');

const getFavorites = (userId?: string | number | null): LegalUserFavorite[] => {
  const allFavorites = readStorage<LegalUserFavorite[]>(FAVORITES_STORAGE_KEY, []);
  return allFavorites.filter((favorite) => favorite.userId === getUserKey(userId));
};

const getAllComments = () => readStorage<LegalUserComment[]>(COMMENTS_STORAGE_KEY, []);
const saveAllComments = (comments: LegalUserComment[]) => writeStorage(COMMENTS_STORAGE_KEY, comments);

const getAllProgress = () => readStorage<LegalUserProgress[]>(PROGRESS_STORAGE_KEY, []);
const saveAllProgress = (progress: LegalUserProgress[]) => writeStorage(PROGRESS_STORAGE_KEY, progress);

const isFavorite = (
  favorites: LegalUserFavorite[],
  type: LegalFavoriteType,
  targetId: string,
) => favorites.some((favorite) => favorite.type === type && favorite.targetId === targetId);

const getLawProgress = (
  law: LawSummary,
  userId?: string | number | null,
) => {
  const progress = getAllProgress().find((item) => item.userId === getUserKey(userId) && item.lawId === law.id);
  return progress?.progressPercent || 0;
};

const applyUserStateToLaw = (
  law: LawSummary,
  favorites: LegalUserFavorite[],
  userId?: string | number | null,
): LawSummary => ({
  ...law,
  isFavorite: isFavorite(favorites, 'law', law.id),
  progressPercent: getLawProgress(law, userId),
});

const applyUserStateToArticle = (
  article: LawArticle,
  favorites: LegalUserFavorite[],
  progress?: LegalUserProgress,
): LawArticle => ({
  ...article,
  isFavorite: isFavorite(favorites, 'article', article.id),
  readAt: progress?.viewedArticleIds.includes(article.id) ? progress.lastViewedAt : undefined,
});

const getLawBySlug = (slug: string) => lawsSeed.find((law) => law.slug === slug);

const createHomeSnapshot = (userId?: string | number | null): LegalHomeSnapshot => {
  const favorites = getFavorites(userId);
  const lawsWithState = lawsSeed.map((law) => applyUserStateToLaw(law, favorites, userId));
  const progress = getAllProgress().filter((item) => item.userId === getUserKey(userId));
  const recentlyStudiedIds = [...progress]
    .sort((a, b) => new Date(b.lastViewedAt).getTime() - new Date(a.lastViewedAt).getTime())
    .map((item) => item.lawId);

  const lawsByArea = legalAreasSeed
    .sort((a, b) => a.order - b.order)
    .map((area) => ({
      area,
      laws: lawsWithState
        .filter((law) => law.areaId === area.id)
        .sort((a, b) => b.accessCount - a.accessCount),
    }))
    .filter((group) => group.laws.length > 0);

  return {
    areas: legalAreasSeed,
    lawsByArea,
    mostAccessed: [...lawsWithState].sort((a, b) => b.accessCount - a.accessCount).slice(0, 4),
    favoriteLaws: lawsWithState.filter((law) => law.isFavorite).slice(0, 4),
    recentlyStudied: recentlyStudiedIds
      .map((lawId) => lawsWithState.find((law) => law.id === lawId))
      .filter(Boolean)
      .slice(0, 4) as LawSummary[],
    recentlyUpdated: lawsWithState.filter((law) => law.isRecentlyUpdated).slice(0, 6),
    totals: {
      laws: lawsWithState.length,
      articles: lawsWithState.reduce((total, law) => total + law.articleCount, 0),
      commentedArticles: lawsWithState.reduce((total, law) => total + law.commentedArticleCount, 0),
      updatedRecently: lawsWithState.filter((law) => law.isRecentlyUpdated).length,
    },
  };
};

const buildLawDetail = (
  slug: string,
  userId?: string | number | null,
): LawDetail | null => {
  const law = getLawBySlug(slug);
  if (!law) return null;

  const detail = buildLawDetailSeed(law);
  if (!detail) return null;

  const favorites = getFavorites(userId);
  const progress = getAllProgress().find((item) => item.userId === getUserKey(userId) && item.lawId === law.id);
  const articleIds = new Set(detail.articles.map((article) => article.id));
  const userComments = getAllComments()
    .filter((comment) => articleIds.has(comment.articleId) && comment.status !== 'deleted')
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  const lawWithState = applyUserStateToLaw(law, favorites, userId);

  return {
    ...detail,
    ...lawWithState,
    area: detail.area,
    articles: detail.articles.map((article) => applyUserStateToArticle(article, favorites, progress)),
    teacherComments: detail.teacherComments.map((comment) => ({
      ...comment,
      isFavorite: isFavorite(favorites, 'teacher_comment', comment.id),
    })),
    jurisprudence: detail.jurisprudence.map((item) => ({
      ...item,
      isFavorite: isFavorite(favorites, 'jurisprudence', item.id),
    })),
    examTips: detail.examTips,
    userComments,
    progress,
  };
};

const searchContent = (query: string, userId?: string | number | null): LegalSearchResult[] => {
  const normalized = normalizeSearch(query);
  if (!normalized) return [];

  const laws = createHomeSnapshot(userId).lawsByArea.flatMap((group) => group.laws.map((law) => ({
    law,
    area: group.area,
  })));

  const lawResults = laws
    .filter(({ law, area }) => normalizeSearch([
      law.title,
      law.shortTitle,
      law.acronym || '',
      law.number,
      law.year || '',
      law.description || '',
      law.summary,
      law.ementa || '',
      area.name,
      ...law.aliases,
    ].join(' ')).includes(normalized))
    .map<LegalSearchResult>(({ law, area }) => ({
      id: `law-${law.id}`,
      type: 'law',
      title: law.shortTitle,
      excerpt: law.summary,
      areaName: area.name,
      lawSlug: law.slug,
    }));

  const articleResults = lawArticlesSeed
    .filter((article) => normalizeSearch([
      article.number,
      article.title || '',
      article.text || '',
      article.hierarchy.title || '',
      article.hierarchy.chapter || '',
      ...article.blocks.map((block) => `${block.label} ${block.text}`),
      ...(article.paragraphs || []).map((paragraph) => `${paragraph.number} ${paragraph.text}`),
      ...(article.jurisprudenceNotes || []),
      ...(article.syllabi || []).map((syllabus) => `${syllabus.court} ${syllabus.number} ${syllabus.text}`),
      ...(article.doctrine || []),
      article.examTip || '',
    ].join(' ')).includes(normalized))
    .map<LegalSearchResult>((article) => {
      const law = lawsSeed.find((item) => item.id === article.lawId)!;
      const area = legalAreasSeed.find((item) => item.id === law.areaId)!;
      return {
        id: `article-${article.id}`,
        type: 'article',
        title: `${law.shortTitle}, art. ${article.number}`,
        excerpt: article.title || article.blocks[0]?.text || law.summary,
        areaName: area.name,
        lawSlug: law.slug,
        articleId: article.id,
      };
    });

  const commentResults = teacherCommentsSeed
    .filter((comment) => normalizeSearch([
      comment.title,
      comment.body,
      ...comment.examFocus,
      ...comment.pitfalls,
    ].join(' ')).includes(normalized))
    .map<LegalSearchResult>((comment) => {
      const article = lawArticlesSeed.find((item) => item.id === comment.articleId)!;
      const law = lawsSeed.find((item) => item.id === article.lawId)!;
      const area = legalAreasSeed.find((item) => item.id === law.areaId)!;
      return {
        id: `teacher-${comment.id}`,
        type: 'teacher_comment',
        title: comment.title,
        excerpt: comment.body,
        areaName: area.name,
        lawSlug: law.slug,
        articleId: article.id,
      };
    });

  const jurisprudenceResults = jurisprudenceSeed
    .filter((item) => normalizeSearch([
      item.title,
      item.summary,
      item.examImpact,
      item.court,
    ].join(' ')).includes(normalized))
    .map<LegalSearchResult>((item) => {
      const article = lawArticlesSeed.find((articleItem) => articleItem.id === item.articleId)!;
      const law = lawsSeed.find((lawItem) => lawItem.id === article.lawId)!;
      const area = legalAreasSeed.find((areaItem) => areaItem.id === law.areaId)!;
      return {
        id: `jur-${item.id}`,
        type: 'jurisprudence',
        title: `${item.court}: ${item.title}`,
        excerpt: item.examImpact,
        areaName: area.name,
        lawSlug: law.slug,
        articleId: article.id,
      };
    });

  return [...lawResults, ...articleResults, ...commentResults, ...jurisprudenceResults].slice(0, 20);
};

export const legalCommentaryService = {
  getHomeSnapshot(userId?: string | number | null) {
    return createHomeSnapshot(userId);
  },

  search(query: string, userId?: string | number | null) {
    return searchContent(query, userId);
  },

  getLawDetail(slug: string, userId?: string | number | null) {
    return buildLawDetail(slug, userId);
  },

  getRecentlyUpdatedLaws(userId?: string | number | null) {
    return createHomeSnapshot(userId).recentlyUpdated;
  },

  toggleFavorite(userId: string | number | null | undefined, type: LegalFavoriteType, targetId: string) {
    const userKey = getUserKey(userId);
    const allFavorites = readStorage<LegalUserFavorite[]>(FAVORITES_STORAGE_KEY, []);
    const existing = allFavorites.find((favorite) => (
      favorite.userId === userKey &&
      favorite.type === type &&
      favorite.targetId === targetId
    ));

    if (existing) {
      const next = allFavorites.filter((favorite) => favorite.id !== existing.id);
      writeStorage(FAVORITES_STORAGE_KEY, next);
      return { isFavorite: false, favorites: next.filter((favorite) => favorite.userId === userKey) };
    }

    const nextFavorite: LegalUserFavorite = {
      id: createId('fav'),
      userId: userKey,
      type,
      targetId,
      createdAt: nowIso(),
    };

    const next = [nextFavorite, ...allFavorites];
    writeStorage(FAVORITES_STORAGE_KEY, next);
    return { isFavorite: true, favorites: next.filter((favorite) => favorite.userId === userKey) };
  },

  recordLawView(userId: string | number | null | undefined, lawId: string) {
    const userKey = getUserKey(userId);
    const allProgress = getAllProgress();
    const law = lawsSeed.find((item) => item.id === lawId);
    if (!law) return;

    const existing = allProgress.find((item) => item.userId === userKey && item.lawId === lawId);
    const nextProgress: LegalUserProgress = {
      id: existing?.id || createId('progress'),
      userId: userKey,
      lawId,
      viewedArticleIds: existing?.viewedArticleIds || [],
      lastArticleId: existing?.lastArticleId,
      lastViewedAt: nowIso(),
      progressPercent: existing?.progressPercent || 0,
    };

    saveAllProgress([nextProgress, ...allProgress.filter((item) => item.id !== nextProgress.id)]);
  },

  recordArticleView(userId: string | number | null | undefined, lawId: string, articleId: string) {
    const userKey = getUserKey(userId);
    const allProgress = getAllProgress();
    const lawArticles = lawArticlesSeed.filter((article) => article.lawId === lawId);
    const existing = allProgress.find((item) => item.userId === userKey && item.lawId === lawId);
    const viewedArticleIds = Array.from(new Set([...(existing?.viewedArticleIds || []), articleId]));
    const progressPercent = lawArticles.length > 0 ? Math.round((viewedArticleIds.length / lawArticles.length) * 100) : 0;
    const nextProgress: LegalUserProgress = {
      id: existing?.id || createId('progress'),
      userId: userKey,
      lawId,
      viewedArticleIds,
      lastArticleId: articleId,
      lastViewedAt: nowIso(),
      progressPercent,
    };

    saveAllProgress([nextProgress, ...allProgress.filter((item) => item.id !== nextProgress.id)]);
  },

  addUserComment(input: {
    articleId: string;
    userId: string | number;
    userName: string;
    body: string;
  }) {
    const body = input.body.trim();
    if (!body) {
      throw new Error('Escreva um comentário antes de enviar.');
    }

    const comment: LegalUserComment = {
      id: createId('comment'),
      articleId: input.articleId,
      userId: String(input.userId),
      userName: input.userName,
      body,
      status: 'visible',
      createdAt: nowIso(),
    };

    const next = [comment, ...getAllComments()];
    saveAllComments(next);
    return comment;
  },

  updateUserComment(commentId: string, userId: string | number, body: string) {
    const comments = getAllComments();
    const comment = comments.find((item) => item.id === commentId);
    if (!comment) throw new Error('Comentário não encontrado.');
    if (comment.userId !== String(userId)) throw new Error('Você só pode editar o próprio comentário.');

    const next = comments.map((item) => item.id === commentId
      ? { ...item, body: body.trim(), updatedAt: nowIso() }
      : item);
    saveAllComments(next);
  },

  deleteUserComment(commentId: string, userId: string | number) {
    const comments = getAllComments();
    const comment = comments.find((item) => item.id === commentId);
    if (!comment) throw new Error('Comentário não encontrado.');
    if (comment.userId !== String(userId)) throw new Error('Você só pode excluir o próprio comentário.');

    const next = comments.map((item) => item.id === commentId
      ? { ...item, status: 'deleted' as const, updatedAt: nowIso() }
      : item);
    saveAllComments(next);
  },

  reportUserComment(commentId: string) {
    const comments = getAllComments();
    const next = comments.map((item) => item.id === commentId
      ? { ...item, status: 'reported' as const, reportedCount: (item.reportedCount || 0) + 1, updatedAt: nowIso() }
      : item);
    saveAllComments(next);
  },

  getStaticContracts() {
    return {
      areas: legalAreasSeed,
      laws: lawsSeed,
      articles: lawArticlesSeed,
      teacherComments: teacherCommentsSeed,
      jurisprudence: jurisprudenceSeed,
      examTips: examTipsSeed,
    };
  },
};

export default legalCommentaryService;
