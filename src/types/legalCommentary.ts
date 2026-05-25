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

export interface LawSummary {
  id: string;
  slug: string;
  areaId: string;
  lawTopicFilterId?: string | null;
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

export interface LegalArticleParagraph {
  number: string;
  text: string;
}

export interface LegalArticleSyllabus {
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
  jurisprudenceNotes?: string[];
  syllabi?: LegalArticleSyllabus[];
  sumulas?: LegalArticleSyllabus[];
  doctrine?: string[];
  doutrina?: string[];
  examTip?: string;
  macete?: string | null;
  relatedQuestionCount?: number;
  questoesRelacionadas?: number;
  comentarios?: TeacherComment[];
  jurisprudencia?: ArticleJurisprudence[];
  hierarchy?: {
    partLabel?: string | null;
    part?: string;
    bookLabel?: string | null;
    book?: string;
    titleLabel?: string | null;
    title?: string;
    chapterLabel?: string | null;
    chapter?: string;
    sectionLabel?: string | null;
    section?: string;
    subsectionLabel?: string | null;
    subsection?: string;
    resolvedSubtopic?: string;
    resolvedAssunto?: string;
  };
  blocks: LegalArticleBlock[];
  officialAnchor?: string;
  isRecentlyChanged?: boolean;
  isFavorite?: boolean;
  readAt?: string;
  assuntoFilterId?: string | null;
  subjectFilterId?: string | null;
  topicFilterId?: string | null;
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

export interface TeacherComment {
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

export interface ArticleJurisprudence {
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
  isFavorite?: boolean;
}

export interface ArticleExamTip {
  id: string;
  articleId: string;
  title: string;
  body: string;
  texto?: string;
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
  userAvatar?: string;
  avatarUrl?: string;
  photoUrl?: string;
  userPhotoUrl?: string;
  userPlan?: 'Gratuito' | 'Essencial' | 'Pro' | 'Elite' | string;
  body: string;
  status: LegalUserCommentStatus;
  moderationStatus?: 'pending' | 'approved' | 'spam';
  createdAt: string;
  updatedAt?: string;
  reportedCount?: number;
}

export interface LegalUserCommentSubmissionResult {
  id: string;
  moderationStatus: 'pending' | 'approved' | 'spam';
  requiresModeration: boolean;
  message?: string;
  comment?: LegalUserComment;
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

export interface LawSectionEditorial {
  id?: string;
  lawId?: string;
  sectionId?: string | null;
  sectionKey: string;
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

export interface LawDetail extends LawSummary {
  area: LegalArea;
  ementa: string;
  sections?: LawSection[];
  articles: LawArticle[];
  teacherComments: TeacherComment[];
  jurisprudence: ArticleJurisprudence[];
  examTips: ArticleExamTip[];
  sumulas?: LegalArticleSyllabus[];
  userComments: LegalUserComment[];
  updates: LawUpdate[];
  syncLogs?: LegalSyncLog[];
  progress?: LegalUserProgress;
  sectionEditorials?: LawSectionEditorial[];
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
  doctrine: string[];
  jurisprudenceNotes?: string[];
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
