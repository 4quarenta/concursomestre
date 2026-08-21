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

import type { SeoEnvelopeCarrier } from '@services/seo/seoEnvelope';

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

export type LegalContentStatus = 'active' | 'published' | 'draft' | 'scheduled' | 'revoked' | 'partially_revoked' | 'monitoring';
export type LegalFavoriteType = 'law' | 'section' | 'article' | 'jurisprudence' | 'teacher_comment';
export type LegalUserCommentStatus = 'visible' | 'hidden' | 'reported' | 'deleted';
export type LegalUpdateChangeType = 'created' | 'changed' | 'revoked' | 'renumbered';
export type LegalSyncStatus = 'success' | 'warning' | 'failed' | 'running';

export interface LegalArea {
  id: string;
  catalogId?: string;
  slug: LegalAreaSlug;
  name: string;
  nome?: string;
  colorClass?: string;
  cor?: string | null;
  iconName?: string;
  icone?: string | null;
  totalLaws?: number;
  totalLeis?: number;
  description: string;
  order: number;
  iconTone: string;
}

export interface LegalTaxonomySummary {
  id?: string;
  slug?: string | null;
  name?: string | null;
  nome?: string | null;
  title?: string | null;
  label?: string | null;
  materia?: boolean | number | string;
  meta_materia?: boolean | number | string;
  taxonomyLevel?: string | null;
  taxonomy_level?: string | null;
  parentId?: string | number | null;
  parent_id?: string | number | null;
}

export interface LawSummary {
  id: string;
  slug: string;
  areaId: string;
  lawTopicFilterId?: string | null;
  lawTopicName?: string | null;
  lawTopicSlug?: string | null;
  topicName?: string | null;
  topicSlug?: string | null;
  subjectFilterId?: string | null;
  subjectName?: string | null;
  materiaName?: string | null;
  disciplinaName?: string | null;
  subject?: LegalTaxonomySummary | string | null;
  subjects?: Array<LegalTaxonomySummary | string>;
  materia?: LegalTaxonomySummary | string | null;
  materias?: Array<LegalTaxonomySummary | string>;
  disciplina?: LegalTaxonomySummary | string | null;
  disciplinas?: Array<LegalTaxonomySummary | string>;
  disciplines?: Array<LegalTaxonomySummary | string>;
  assuntos?: LegalTaxonomySummary[];
  acronym?: string;
  sigla?: string | null;
  catalogId?: string;
  title: string;
  shortTitle: string;
  nome?: string;
  number: string;
  numero?: string;
  year?: string;
  ano?: string | null;
  description?: string;
  descricao?: string;
  date: string;
  publishedAt?: string;
  published_at?: string;
  aliases: string[];
  summary: string;
  preamble?: string;
  ementa?: string;
  status: LegalContentStatus;
  officialUrl: string;
  urlPlanalto?: string;
  sourceName: string;
  lastImportedAt?: string;
  lastSyncedAt: string;
  lastUpdatedAt?: string;
  ultimaImportacao?: string;
  ultimaSincronizacao?: string;
  ultimaAtualizacao?: string | null;
  syncStatus?: LegalSyncStatus | string;
  statusSincronizacao?: LegalSyncStatus | string;
  syncMessage?: string;
  isRecentlyUpdated: boolean;
  atualizacaoPendente?: boolean;
  articleCount: number;
  totalArtigos?: number;
  commentedArticleCount: number;
  artigosComentados?: number;
  jurisprudenceCount: number;
  examTipCount: number;
  accessCount: number;
  progress?: LegalUserProgress | null;
  progressPercent?: number;
  isFavorite?: boolean;
}

export interface LegalArticleBlock {
  id: string;
  blockUid?: string;
  kind: 'caput' | 'paragraph' | 'inciso' | 'alinea' | 'item' | 'note';
  label: string;
  text: string;
  parentBlockId?: string | null;
  anchor?: string | null;
  sourceNote?: string;
  notes?: string[];
  isRecentlyChanged?: boolean;
  previousText?: string;
  sortOrder?: number;
}

export type LegalRichContentBlockType =
  | 'paragraph'
  | 'bullet_list'
  | 'table'
  | 'warning'
  | 'tip'
  | 'macete'
  | 'jurisprudence'
  | 'example'
  | 'comparison'
  | 'summary';

export interface LegalRichContentBlock {
  type: LegalRichContentBlockType;
  title?: string;
  content?: string;
  items?: string[];
  headers?: string[];
  rows?: string[][];
  target?: {
    kind?: LegalArticleBlock['kind'] | 'article' | 'section';
    label?: string;
    blockId?: string;
  };
}

export interface LegalTargetedText {
  id?: string;
  title?: string;
  body: string;
  text?: string;
  author?: string;
  target?: LegalRichContentBlock['target'];
}

export interface LegalContentReactionState {
  reactionKey?: string;
  likes?: number;
  dislikes?: number;
  userReaction?: 'like' | 'dislike' | null;
}

export interface LegalArticleParagraph {
  number: string;
  text: string;
}

export interface LegalArticleSyllabus extends LegalContentReactionState {
  id?: string;
  articleId?: string;
  court: string;
  tribunal?: string;
  number: string;
  numero?: string;
  text: string;
  texto?: string;
  sourceUrl?: string | null;
  priority?: string;
  isBinding?: boolean;
  vinculante?: boolean;
  target?: LegalRichContentBlock['target'];
}

export interface LawArticle {
  id: string;
  lawId: string;
  sectionId?: string | null;
  slug: string;
  number: string;
  numero?: string;
  title?: string;
  titulo?: string;
  text?: string;
  texto?: string;
  paragraphs?: LegalArticleParagraph[];
  paragrafos?: LegalArticleParagraph[];
  jurisprudenceNotes?: Array<string | LegalTargetedText>;
  syllabi?: LegalArticleSyllabus[];
  sumulas?: LegalArticleSyllabus[];
  doctrine?: Array<string | LegalTargetedText>;
  doutrina?: Array<string | LegalTargetedText>;
  examTip?: string;
  macete?: string | null;
  relatedQuestionCount?: number;
  questoesRelacionadas?: number;
  comentarios?: TeacherComment[];
  jurisprudencia?: ArticleJurisprudence[];
  blocks: LegalArticleBlock[];
  officialAnchor?: string;
  officialStatus?: string;
  publicArticlePath?: string | null;
  isRecentlyChanged?: boolean;
  isFavorite?: boolean;
  readAt?: string;
  assuntoFilterId?: string | null;
}

export interface LawSection {
  id: string;
  lawId: string;
  slug?: string;
  title: string;
  displayTitle?: string;
  titleLabel?: string | null;
  titleName?: string | null;
  chapterLabel?: string | null;
  chapterName?: string | null;
  subtopicFilterId?: string | null;
  assuntoFilterId?: string | null;
  fromArticle?: string | null;
  toArticle?: string | null;
  articleCount: number;
  sortOrder?: number;
  isFavorite?: boolean;
}

export interface TeacherComment extends LegalContentReactionState {
  id: string;
  articleId: string;
  title: string;
  body: string;
  texto?: string;
  importance?: 'alta' | 'media' | 'baixa' | string;
  style?: string;
  richBlocks?: LegalRichContentBlock[];
  blocks?: LegalRichContentBlock[];
  keywords?: string[];
  avoidRepetitionNote?: string;
  examFocus: string[];
  pitfalls: string[];
  relatedRefs: string[];
  authorName: string;
  autor?: string;
  authorRole?: string;
  cargo?: string | null;
  reviewedAt: string;
  isFavorite?: boolean;
}

export interface ArticleJurisprudence extends LegalContentReactionState {
  id: string;
  articleId: string;
  court: 'STF' | 'STJ' | 'TST' | 'TCU' | 'TRF' | 'TJ';
  tribunal?: string;
  precedentType: string;
  title: string;
  summary: string;
  texto?: string;
  examImpact: string;
  isConsolidated: boolean;
  priority: 'high' | 'medium' | 'low';
  sourceUrl?: string;
  target?: LegalRichContentBlock['target'];
  isFavorite?: boolean;
}

export interface ArticleExamTip extends LegalContentReactionState {
  id: string;
  articleId: string;
  title: string;
  body: string;
  texto?: string;
  tags: string[];
  target?: LegalRichContentBlock['target'];
}

export interface LegalUserFavorite {
  id: string;
  userId: string;
  type: LegalFavoriteType;
  targetId: string;
  createdAt: string;
}

export interface LegalFavoriteSavedItem {
  id: string;
  type: 'law' | 'section' | 'article';
  targetId: string;
  lawId: string;
  lawSlug: string;
  lawTitle: string;
  title: string;
  subtitle: string;
  description?: string;
  href: string;
  articleCount?: number;
  progressPercent?: number;
  createdAt?: string;
}

export interface LegalUserComment {
  id: string;
  articleId: string;
  parentCommentId?: string | null;
  parent_comment_id?: string | number | null;
  userId: string;
  userName: string;
  userAvatar?: string;
  avatarUrl?: string;
  photoUrl?: string;
  userPhotoUrl?: string;
  userPlan?: 'Gratuito' | 'Essencial' | 'Pro' | 'Elite' | string;
  userRole?: 'admin' | 'user' | 'partner' | 'staff' | string;
  body: string;
  status: LegalUserCommentStatus;
  moderationStatus?: 'pending' | 'approved' | 'spam';
  createdAt: string;
  updatedAt?: string;
  reportedCount?: number;
  userHasPendingReport?: boolean;
  likes?: number;
  dislikes?: number;
  userReaction?: 'like' | 'dislike' | null;
}

export interface LegalUserCommentSubmissionResult {
  id: string;
  moderationStatus: 'pending' | 'approved' | 'spam';
  requiresModeration: boolean;
  message?: string;
  comment?: LegalUserComment;
  xpGain?: number;
  newXp?: number;
  newLevel?: number;
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

export interface LawSectionEditorial extends LegalContentReactionState {
  id?: string;
  lawId?: string;
  sectionId?: string | null;
  sectionTitle: string;
  rangeLabel: string;
  articleCount: number;
  importance?: 'alta' | 'media' | 'baixa' | string;
  style?: string;
  summary: string;
  blocks?: LegalRichContentBlock[];
  examFocus: string[];
  examFocusText?: string;
  keywords?: string[];
  avoidRepetitionNote?: string;
  macetes: string[];
  doctrine: string[];
  jurisprudence: ArticleJurisprudence[];
  sumulas: LegalArticleSyllabus[];
  highlights: Array<{
    articleId: string;
    articleNumber: string;
    title: string;
    excerpt: string;
  }>;
}

export interface LawDetail extends LawSummary, SeoEnvelopeCarrier {
  area: LegalArea;
  ementa: string;
  sections?: LawSection[];
  articles: LawArticle[];
  teacherComments: TeacherComment[];
  jurisprudence: ArticleJurisprudence[];
  examTips: ArticleExamTip[];
  sumulas?: LegalArticleSyllabus[];
  userComments: LegalUserComment[];
  userCommentsPageInfo?: {
    limit: number;
    hasMore: boolean;
  };
  updates: LawUpdate[];
  syncLogs?: LegalSyncLog[];
  progress?: LegalUserProgress;
  sectionEditorials?: LawSectionEditorial[];
}

export type PublicLegalEditorialAccess = 'full' | 'preview' | 'locked' | 'hidden';

export interface PublicLegalFeatureAccessState {
  feature_key: string;
  requires_plan?: string;
  enabled?: boolean;
  mode: PublicLegalEditorialAccess;
  fallback_mode?: PublicLegalEditorialAccess;
  limit_key?: string | null;
  limit_value?: number | null;
}

export interface PublicLegalEditorialAvailability {
  available: boolean;
  access: PublicLegalEditorialAccess;
}

export interface PublicLawStudyModule {
  title?: string;
  badge?: string;
  mode: PublicLegalEditorialAccess;
  feature?: PublicLegalFeatureAccessState;
  preview?: string;
  body?: string | null;
  front?: string;
  back?: string;
  items?: Array<string | number | boolean>;
  connections?: Array<string | number | boolean>;
  percent?: number;
  level?: string;
  importance?: string;
  theme?: string;
  questionCount?: number;
  count?: number;
  ctaLabel?: string;
  ctaHref?: string;
}

export interface PublicLawArticle {
  id: string;
  lawId: string;
  sectionId?: string | null;
  slug: string;
  number: string;
  numero?: string;
  title?: string;
  titulo?: string;
  text?: string;
  texto?: string;
  paragraphs?: LegalArticleParagraph[];
  paragrafos?: LegalArticleParagraph[];
  blocks: LegalArticleBlock[];
  officialAnchor?: string;
  officialStatus?: string;
  publicArticlePath?: string | null;
  isRecentlyChanged?: boolean;
  relatedQuestionCount?: number;
  questoesRelacionadas?: number;
  assuntoFilterId?: string | null;
  isFavorite?: boolean;
  readAt?: string | null;
  comentarios?: TeacherComment[];
  doctrine?: Array<string | LegalTargetedText>;
  doutrina?: Array<string | LegalTargetedText>;
  macete?: string | null;
  examTip?: string | null;
  jurisprudenceNotes?: Array<string | LegalTargetedText>;
  jurisprudencia?: ArticleJurisprudence[];
  syllabi?: LegalArticleSyllabus[];
  sumulas?: LegalArticleSyllabus[];
  studyModules?: Record<string, PublicLawStudyModule>;
}

export interface PublicLawSectionEditorial {
  id?: string;
  lawId?: string;
  sectionId?: string | null;
  sectionTitle: string;
  rangeLabel: string;
  fromArticle?: string | null;
  toArticle?: string | null;
  articleCount: number;
  hasContent: boolean;
  access: PublicLegalEditorialAccess;
  importance?: 'alta' | 'media' | 'baixa' | string;
  style?: string;
  summary?: string;
  blocks?: LegalRichContentBlock[];
  examFocus?: string[];
  examFocusText?: string;
  keywords?: string[];
  macetes?: string[];
  doctrine?: string[];
  doutrina?: string[];
  jurisprudence?: ArticleJurisprudence[];
  jurisprudencia?: ArticleJurisprudence[];
  sumulas?: LegalArticleSyllabus[];
  highlights?: Array<{
    articleId: string;
    articleNumber: string;
    title: string;
    excerpt: string;
  }>;
  reactionKey?: string;
  likes?: number;
  dislikes?: number;
  userReaction?: 'like' | 'dislike' | null;
}

export interface PublicLegalUserProgress {
  id?: string;
  lawId?: string;
  viewedArticleIds: string[];
  lastArticleId?: string | null;
  lastViewedAt?: string;
  progressPercent: number;
}

export type PublicLegalUserComment = Omit<LegalUserComment, 'userId'> & {
  userId?: string;
};

export interface PublicLawDetail extends SeoEnvelopeCarrier {
  id: string;
  slug: string;
  areaId?: string;
  lawTopicFilterId?: string | null;
  lawTopicName?: string | null;
  lawTopicSlug?: string | null;
  topicName?: string | null;
  topicSlug?: string | null;
  subjectFilterId?: string | null;
  subjectName?: string | null;
  materiaName?: string | null;
  disciplinaName?: string | null;
  subject?: LegalTaxonomySummary | string | null;
  subjects?: Array<LegalTaxonomySummary | string>;
  materia?: LegalTaxonomySummary | string | null;
  materias?: Array<LegalTaxonomySummary | string>;
  disciplina?: LegalTaxonomySummary | string | null;
  disciplinas?: Array<LegalTaxonomySummary | string>;
  disciplines?: Array<LegalTaxonomySummary | string>;
  assuntos?: LegalTaxonomySummary[];
  acronym?: string;
  sigla?: string | null;
  catalogId?: string;
  title: string;
  shortTitle: string;
  nome?: string;
  number: string;
  numero?: string;
  year?: string;
  ano?: string | null;
  description?: string;
  descricao?: string;
  date: string;
  publishedAt?: string;
  published_at?: string;
  aliases: string[];
  summary: string;
  preamble?: string;
  ementa?: string;
  status: LegalContentStatus;
  officialUrl: string;
  urlPlanalto?: string;
  sourceName: string;
  lastSyncedAt?: string;
  lastUpdatedAt?: string | null;
  ultimaSincronizacao?: string;
  ultimaAtualizacao?: string | null;
  isRecentlyUpdated?: boolean;
  atualizacaoPendente?: boolean;
  articleCount: number;
  totalArtigos?: number;
  commentedArticleCount: number;
  artigosComentados?: number;
  jurisprudenceCount: number;
  examTipCount: number;
  accessCount: number;
  outlineOnly?: boolean;
  area?: LegalArea;
  sections: LawSection[];
  articles: PublicLawArticle[];
  userComments?: PublicLegalUserComment[];
  userCommentsPageInfo?: { limit: number; hasMore: boolean } | null;
  updates?: LawUpdate[];
  progress?: PublicLegalUserProgress;
  progressPercent?: number;
  isFavorite?: boolean;
  sectionEditorials: PublicLawSectionEditorial[];
  features: Record<string, PublicLegalFeatureAccessState>;
  hasLockedFeatures: boolean;
  planAccess?: { planName?: string; status?: string } | null;
  editorialAvailability: Record<string, PublicLegalEditorialAvailability>;
}

export type LegalEditorialGenerationScope =
  | 'article-full'
  | 'stage-a'
  | 'stage-b'
  | 'stage-c'
  | 'field-comment'
  | 'field-macete'
  | 'field-doutrina'
  | 'field-jurisprudencia'
  | 'field-sumulas'
  | 'section-analysis';

export type LegalEditorialGenerationStatus = 'success' | 'partial' | 'failed' | 'skipped' | 'pending' | 'running' | 'completed' | 'stopped';

export interface LegalEditorialBatchItem {
  id: string;
  articleId: string;
  articleNumber: string;
  status: LegalEditorialGenerationStatus;
  stageAStatus: LegalEditorialGenerationStatus;
  stageBStatus: LegalEditorialGenerationStatus;
  stageCStatus: LegalEditorialGenerationStatus;
  errorMessage?: string | null;
  warnings: string[];
  result: Record<string, unknown>;
  attempts: Record<string, unknown>;
  startedAt?: string | null;
  finishedAt?: string | null;
}

export interface LegalEditorialBatchRun {
  id: string;
  lawId: string;
  status: LegalEditorialGenerationStatus;
  requestedScope: LegalEditorialGenerationScope;
  totalArticles: number;
  processedArticles: number;
  successfulArticles: number;
  failedArticles: number;
  partialArticles: number;
  lastError?: string | null;
  startedAt: string;
  finishedAt?: string | null;
  items: LegalEditorialBatchItem[];
}

export interface LegalEditorialStageResult {
  status: LegalEditorialGenerationStatus;
  warnings: string[];
  regeneratedFields: string[];
  attempts: Record<string, unknown>;
  approvedCount: number;
}

export interface LegalArticleEditorialSnapshot {
  articleId: string;
  articleNumber?: string;
  teacherComments: TeacherComment[];
  examTips: ArticleExamTip[];
  doctrine: Array<string | LegalTargetedText>;
  jurisprudenceNotes?: Array<string | LegalTargetedText>;
  jurisprudence: ArticleJurisprudence[];
  sumulas: LegalArticleSyllabus[];
}

export interface LegalEditorialGenerationResult {
  scope: LegalEditorialGenerationScope;
  lawId: string;
  articleId: string;
  articleNumber?: string;
  persisted: boolean;
  editorial: LegalArticleEditorialSnapshot;
  sectionEditorial?: LawSectionEditorial;
  stages: {
    stageA: LegalEditorialStageResult;
    stageB: LegalEditorialStageResult;
    stageC: LegalEditorialStageResult;
  };
  summary: {
    status: LegalEditorialGenerationStatus;
    scope: LegalEditorialGenerationScope;
    approvedBlocks: number;
    warnings: string[];
  };
  batch?: LegalEditorialBatchRun;
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
  favoriteItems?: LegalFavoriteSavedItem[];
  recentlyStudied: LawSummary[];
  recentlyUpdated: LawSummary[];
  totals: {
    laws: number;
    articles: number;
    commentedArticles: number;
    updatedRecently: number;
  };
}

export interface RelatedQuestionLawArticle {
  id: string;
  number: string;
  title?: string;
  snippet?: string;
  matchScore: number;
  matchedSubjectNames: string[];
  matchedTopicNames: string[];
}

export interface RelatedQuestionLawMatch {
  law: LawSummary;
  reason: string;
  score: number;
  matchedSubjectNames: string[];
  matchedTopicNames: string[];
  matchedArticles: RelatedQuestionLawArticle[];
}

export interface LegalSyncRunResult {
  status: LegalSyncStatus;
  startedAt: string;
  finishedAt: string;
  checkedLaws: number;
  changedLaws: number;
  logs: LegalSyncLog[];
}

export type LegalReadingMode = 'commented' | 'dry';
export type LegalCommentedViewMode = 'cards' | 'pdf';
export type LegalReadingFlowMode = 'list' | 'paged';
export type LegalHighlightMode = 'selection' | 'block';
export type LegalHighlightColor = 'yellow' | 'blue' | 'pink' | 'green';

export interface LegalReadingPreferences {
  readingMode: LegalReadingMode;
  commentedViewMode: LegalCommentedViewMode;
  readingFlowMode: LegalReadingFlowMode;
  isFocusMode: boolean;
  hideSecondaryPanels: boolean;
  highlightMode: LegalHighlightMode;
  highlightColor: LegalHighlightColor;
  showComments: boolean;
  isImmersiveMode: boolean;
}

export interface LegalHighlightEntry {
  id: string;
  type: 'selection' | 'block';
  articleId: string;
  color: LegalHighlightColor;
  createdAt: number;
  unitId?: string;
  unitLabel?: string;
  preview?: string;
  selectedText?: string;
  startAnchor?: string;
  endAnchor?: string;
  blockId?: string;
}
