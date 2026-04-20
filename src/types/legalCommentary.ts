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

export type LegalAreaSlug =
  | 'constitucional'
  | 'penal'
  | 'administrativo'
  | 'civil'
  | 'tributario'
  | 'processual'
  | 'processual-penal'
  | 'legislacao-especial'
  | 'direitos-humanos'
  | 'trabalho'
  | 'ambiental'
  | 'eleitoral';

export type LegalContentStatus = 'active' | 'revoked' | 'partially_revoked' | 'monitoring';
export type LegalFavoriteType = 'law' | 'article' | 'jurisprudence' | 'teacher_comment';
export type LegalUserCommentStatus = 'visible' | 'hidden' | 'reported' | 'deleted';
export type LegalUpdateChangeType = 'created' | 'changed' | 'revoked' | 'renumbered';
export type LegalSyncStatus = 'success' | 'warning' | 'failed' | 'running';

export interface LegalArea {
  id: string;
  catalogId?: string;
  slug: LegalAreaSlug;
  name: string;
  colorClass?: string;
  iconName?: string;
  totalLaws?: number;
  description: string;
  order: number;
  iconTone: string;
}

export interface LawSummary {
  id: string;
  slug: string;
  areaId: string;
  acronym?: string;
  catalogId?: string;
  title: string;
  shortTitle: string;
  number: string;
  year?: string;
  description?: string;
  date: string;
  aliases: string[];
  summary: string;
  ementa?: string;
  status: LegalContentStatus;
  officialUrl: string;
  sourceName: 'Portal do Planalto';
  lastSyncedAt: string;
  lastUpdatedAt?: string;
  isRecentlyUpdated: boolean;
  articleCount: number;
  commentedArticleCount: number;
  jurisprudenceCount: number;
  examTipCount: number;
  accessCount: number;
  progressPercent?: number;
  isFavorite?: boolean;
}

export interface LegalArticleBlock {
  id: string;
  kind: 'caput' | 'paragraph' | 'inciso' | 'alinea' | 'item';
  label: string;
  text: string;
  isRecentlyChanged?: boolean;
  previousText?: string;
}

export interface LegalArticleParagraph {
  number: string;
  text: string;
}

export interface LegalArticleSyllabus {
  court: string;
  number: string;
  text: string;
}

export interface LawArticle {
  id: string;
  lawId: string;
  slug: string;
  number: string;
  title?: string;
  text?: string;
  paragraphs?: LegalArticleParagraph[];
  jurisprudenceNotes?: string[];
  syllabi?: LegalArticleSyllabus[];
  doctrine?: string[];
  examTip?: string;
  relatedQuestionCount?: number;
  hierarchy: {
    part?: string;
    book?: string;
    title?: string;
    chapter?: string;
    section?: string;
  };
  blocks: LegalArticleBlock[];
  officialAnchor?: string;
  isRecentlyChanged?: boolean;
  isFavorite?: boolean;
  readAt?: string;
  subjectFilterId?: string | null;
  topicFilterId?: string | null;
}

export interface TeacherComment {
  id: string;
  articleId: string;
  title: string;
  body: string;
  examFocus: string[];
  pitfalls: string[];
  relatedRefs: string[];
  authorName: string;
  authorRole?: string;
  reviewedAt: string;
  isFavorite?: boolean;
}

export interface ArticleJurisprudence {
  id: string;
  articleId: string;
  court: 'STF' | 'STJ' | 'TST' | 'TCU' | 'TRF' | 'TJ';
  precedentType: string;
  title: string;
  summary: string;
  examImpact: string;
  isConsolidated: boolean;
  priority: 'high' | 'medium' | 'low';
  sourceUrl?: string;
  isFavorite?: boolean;
}

export interface ArticleExamTip {
  id: string;
  articleId: string;
  title: string;
  body: string;
  tags: string[];
}

export interface LegalUserFavorite {
  id: string;
  userId: string;
  type: LegalFavoriteType;
  targetId: string;
  createdAt: string;
}

export interface LegalUserComment {
  id: string;
  articleId: string;
  userId: string;
  userName: string;
  body: string;
  status: LegalUserCommentStatus;
  createdAt: string;
  updatedAt?: string;
  reportedCount?: number;
}

export interface LegalUserProgress {
  id: string;
  userId: string;
  lawId: string;
  viewedArticleIds: string[];
  lastArticleId?: string;
  lastViewedAt: string;
  progressPercent: number;
}

export interface LawUpdate {
  id: string;
  lawId: string;
  articleId?: string;
  changedAt: string;
  changeType: LegalUpdateChangeType;
  title: string;
  summary: string;
  previousText?: string;
  currentText?: string;
  sourceUrl: string;
  examImpact?: string;
}

export interface LegalSyncLog {
  id: string;
  lawId?: string;
  status: LegalSyncStatus;
  startedAt: string;
  finishedAt?: string;
  sourceUrl?: string;
  message: string;
  insertedArticles?: number;
  changedArticles?: number;
  revokedArticles?: number;
}

export interface LawDetail extends LawSummary {
  area: LegalArea;
  ementa: string;
  articles: LawArticle[];
  teacherComments: TeacherComment[];
  jurisprudence: ArticleJurisprudence[];
  examTips: ArticleExamTip[];
  userComments: LegalUserComment[];
  updates: LawUpdate[];
  progress?: LegalUserProgress;
}

export interface LegalSearchResult {
  id: string;
  type: 'law' | 'article' | 'teacher_comment' | 'jurisprudence';
  title: string;
  excerpt: string;
  areaName: string;
  lawSlug: string;
  articleId?: string;
}

export interface LegalHomeSnapshot {
  areas: LegalArea[];
  lawsByArea: Array<{
    area: LegalArea;
    laws: LawSummary[];
  }>;
  mostAccessed: LawSummary[];
  favoriteLaws: LawSummary[];
  recentlyStudied: LawSummary[];
  recentlyUpdated: LawSummary[];
  totals: {
    laws: number;
    articles: number;
    commentedArticles: number;
    updatedRecently: number;
  };
}

export interface LegalSyncRunResult {
  status: LegalSyncStatus;
  startedAt: string;
  finishedAt: string;
  checkedLaws: number;
  changedLaws: number;
  logs: LegalSyncLog[];
}
