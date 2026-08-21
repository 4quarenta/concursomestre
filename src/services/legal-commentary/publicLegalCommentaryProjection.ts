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
  ArticleJurisprudence,
  LegalArticleBlock,
  LegalArticleParagraph,
  LegalArticleSyllabus,
  LegalArea,
  LegalRichContentBlock,
  LegalTargetedText,
  LegalTaxonomySummary,
  PublicLegalUserComment,
  LawSection,
  LawUpdate,
  PublicLawArticle,
  PublicLawDetail,
  PublicLawSectionEditorial,
  PublicLawStudyModule,
  PublicLegalEditorialAccess,
  PublicLegalFeatureAccessState,
  TeacherComment,
} from '@types';

type UnknownRecord = Record<string, unknown>;

const asRecord = (value: unknown): UnknownRecord | null => (
  value !== null && typeof value === 'object' && !Array.isArray(value)
    ? value as UnknownRecord
    : null
);

const records = (value: unknown): UnknownRecord[] => (
  Array.isArray(value) ? value.map(asRecord).filter((item): item is UnknownRecord => item !== null) : []
);

const strings = (value: unknown): string[] => (
  Array.isArray(value)
    ? value.filter((item): item is string | number | boolean => ['string', 'number', 'boolean'].includes(typeof item))
      .map(String)
      .filter(Boolean)
    : []
);

const scalarList = (value: unknown): Array<string | number | boolean> => (
  Array.isArray(value)
    ? value.filter((item): item is string | number | boolean => ['string', 'number', 'boolean'].includes(typeof item))
    : []
);

const pick = <T extends UnknownRecord>(record: UnknownRecord, keys: readonly string[]): T => {
  const result: UnknownRecord = {};
  keys.forEach((key) => {
    if (Object.prototype.hasOwnProperty.call(record, key)) result[key] = record[key];
  });
  return result as T;
};

const normalizeAccess = (value: unknown): PublicLegalEditorialAccess => {
  const mode = String(value || '').toLowerCase();
  return ['full', 'preview', 'locked', 'hidden'].includes(mode)
    ? mode as PublicLegalEditorialAccess
    : 'locked';
};

const projectTarget = (value: unknown) => {
  const record = asRecord(value);
  return record ? pick(record, ['kind', 'label', 'blockId']) : undefined;
};

const projectTaxonomy = (value: unknown): LegalTaxonomySummary | string | null => {
  if (typeof value === 'string') return value;
  const record = asRecord(value);
  return record ? pick<LegalTaxonomySummary & UnknownRecord>(record, [
    'id', 'slug', 'name', 'nome', 'title', 'label', 'materia', 'meta_materia',
    'taxonomyLevel', 'taxonomy_level', 'parentId', 'parent_id',
  ]) : null;
};

const projectTaxonomyList = (value: unknown): Array<LegalTaxonomySummary | string> => (
  Array.isArray(value)
    ? value.map(projectTaxonomy).filter((item): item is LegalTaxonomySummary | string => item !== null)
    : []
);

const projectRichBlocks = (value: unknown): LegalRichContentBlock[] => records(value).map((record) => ({
  ...pick(record, ['type', 'title', 'content']),
  items: strings(record.items),
  headers: strings(record.headers),
  rows: Array.isArray(record.rows) ? record.rows.map(strings) : [],
  target: projectTarget(record.target),
} as LegalRichContentBlock));

const projectReaction = (record: UnknownRecord, authenticated: boolean) => ({
  ...pick(record, ['reactionKey', 'likes', 'dislikes']),
  ...(authenticated && Object.prototype.hasOwnProperty.call(record, 'userReaction')
    ? { userReaction: record.userReaction }
    : {}),
});

const projectTeacherComments = (value: unknown, authenticated: boolean): TeacherComment[] => records(value).map((record) => ({
  ...pick(record, [
    'id', 'articleId', 'title', 'body', 'texto', 'importance', 'style',
    'authorName', 'autor', 'authorRole', 'cargo', 'reviewedAt',
  ]),
  richBlocks: projectRichBlocks(record.richBlocks ?? record.blocks),
  blocks: projectRichBlocks(record.richBlocks ?? record.blocks),
  keywords: strings(record.keywords),
  examFocus: strings(record.examFocus),
  pitfalls: strings(record.pitfalls),
  relatedRefs: strings(record.relatedRefs),
  ...projectReaction(record, authenticated),
} as TeacherComment));

const projectJurisprudence = (value: unknown, authenticated: boolean): ArticleJurisprudence[] => records(value).map((record) => ({
  ...pick(record, [
    'id', 'articleId', 'court', 'tribunal', 'precedentType', 'title', 'summary',
    'texto', 'examImpact', 'isConsolidated', 'priority', 'sourceUrl',
  ]),
  target: projectTarget(record.target),
  ...projectReaction(record, authenticated),
} as ArticleJurisprudence));

const projectSyllabi = (value: unknown, authenticated: boolean): LegalArticleSyllabus[] => records(value).map((record) => ({
  ...pick(record, [
    'id', 'articleId', 'court', 'tribunal', 'number', 'numero', 'text', 'texto',
    'sourceUrl', 'priority', 'isBinding', 'vinculante',
  ]),
  target: projectTarget(record.target),
  ...projectReaction(record, authenticated),
} as LegalArticleSyllabus));

const projectTargetedTexts = (value: unknown): Array<string | LegalTargetedText> => (
  Array.isArray(value) ? value.reduce<Array<string | LegalTargetedText>>((result, item) => {
    if (typeof item === 'string') {
      result.push(item);
      return result;
    }
    const record = asRecord(item);
    if (record) {
      result.push({
        ...pick(record, ['id', 'title', 'body', 'text', 'author']),
        body: String(record.body ?? record.text ?? ''),
        target: projectTarget(record.target),
      } as LegalTargetedText);
    }
    return result;
  }, []) : []
);

const projectFeatures = (value: unknown): Record<string, PublicLegalFeatureAccessState> => {
  const record = asRecord(value);
  if (!record) return {};
  return Object.fromEntries(Object.entries(record).flatMap(([featureKey, rawState]) => {
    const state = asRecord(rawState);
    if (!state) return [];
    return [[featureKey, {
      ...pick(state, ['requires_plan', 'enabled', 'limit_key', 'limit_value']),
      feature_key: featureKey,
      mode: normalizeAccess(state.mode),
      fallback_mode: normalizeAccess(state.fallback_mode),
    } satisfies PublicLegalFeatureAccessState]];
  }));
};

const featureMode = (
  features: Record<string, PublicLegalFeatureAccessState>,
  key: string,
): PublicLegalEditorialAccess => normalizeAccess(features[key]?.mode);

const projectStudyModules = (
  value: unknown,
  features: Record<string, PublicLegalFeatureAccessState>,
): Record<string, PublicLawStudyModule> => {
  const record = asRecord(value);
  if (!record) return {};
  return Object.fromEntries(Object.entries(record).flatMap(([moduleKey, rawModule]) => {
    const moduleRecord = asRecord(rawModule);
    if (!moduleRecord) return [];
    const feature = asRecord(moduleRecord.feature);
    const featureKey = String(feature?.feature_key || '');
    const mode = featureMode(features, featureKey);
    if (mode === 'hidden') return [];
    const result: PublicLawStudyModule = {
      ...pick(moduleRecord, ['title', 'badge']),
      mode,
      ...(featureKey && features[featureKey] ? { feature: features[featureKey] } : {}),
    };
    if (mode === 'preview' && typeof moduleRecord.preview === 'string') result.preview = moduleRecord.preview;
    if (mode === 'full') {
      Object.assign(result, pick(moduleRecord, [
        'body', 'front', 'back', 'preview', 'percent', 'level', 'importance',
        'theme', 'questionCount', 'count', 'ctaLabel', 'ctaHref',
      ]));
      result.items = scalarList(moduleRecord.items);
      result.connections = scalarList(moduleRecord.connections);
    }
    return [[moduleKey, result]];
  }));
};

const projectArticle = (
  value: unknown,
  features: Record<string, PublicLegalFeatureAccessState>,
  authenticated: boolean,
): PublicLawArticle | null => {
  const record = asRecord(value);
  if (!record) return null;
  const id = String(record.id || '').trim();
  if (!id) return null;
  const paragraphs = records(record.paragraphs ?? record.paragrafos).map((paragraph) => (
    pick<LegalArticleParagraph & UnknownRecord>(paragraph, ['number', 'text'])
  ));
  const result: PublicLawArticle = {
    ...pick(record, [
      'id', 'lawId', 'sectionId', 'slug', 'number', 'numero', 'title', 'titulo',
      'text', 'texto', 'officialAnchor', 'isRecentlyChanged', 'relatedQuestionCount',
      'questoesRelacionadas', 'assuntoFilterId', 'officialStatus', 'publicArticlePath',
    ]),
    id,
    lawId: String(record.lawId || ''),
    slug: String(record.slug || ''),
    number: String(record.number || record.numero || ''),
    paragraphs,
    paragrafos: paragraphs,
    blocks: records(record.blocks).map((block) => pick<LegalArticleBlock & UnknownRecord>(block, [
      'id', 'blockUid', 'kind', 'label', 'text', 'parentBlockId', 'anchor',
      'isRecentlyChanged', 'sortOrder',
    ])),
    studyModules: projectStudyModules(record.studyModules, features),
  };
  if (authenticated) Object.assign(result, pick(record, ['isFavorite', 'readAt']));
  if (featureMode(features, 'lei.comentario_basico') === 'full') {
    result.comentarios = projectTeacherComments(record.comentarios, authenticated);
  }
  if (featureMode(features, 'lei.doutrina') === 'full') {
    result.doctrine = projectTargetedTexts(record.doctrine ?? record.doutrina);
    result.doutrina = result.doctrine;
  }
  if (featureMode(features, 'lei.macete') === 'full') {
    result.macete = typeof record.macete === 'string' ? record.macete : null;
    result.examTip = typeof record.examTip === 'string' ? record.examTip : result.macete;
  }
  if (featureMode(features, 'lei.jurisprudencia') === 'full') {
    result.jurisprudenceNotes = projectTargetedTexts(record.jurisprudenceNotes);
    result.jurisprudencia = projectJurisprudence(record.jurisprudencia, authenticated);
  }
  if (featureMode(features, 'lei.sumulas') === 'full') {
    result.sumulas = projectSyllabi(record.sumulas ?? record.syllabi, authenticated);
    result.syllabi = result.sumulas;
  }
  return result;
};

const projectSectionEditorial = (
  value: unknown,
  features: Record<string, PublicLegalFeatureAccessState>,
  authenticated: boolean,
): PublicLawSectionEditorial | null => {
  const record = asRecord(value);
  if (!record) return null;
  const access = normalizeAccess(record.access ?? featureMode(features, 'lei.raiox'));
  const result: PublicLawSectionEditorial = {
    ...pick(record, ['id', 'lawId', 'sectionId', 'sectionTitle', 'rangeLabel', 'fromArticle', 'toArticle', 'articleCount']),
    sectionTitle: String(record.sectionTitle || ''),
    rangeLabel: String(record.rangeLabel || ''),
    articleCount: Number(record.articleCount || 0),
    hasContent: Boolean(record.hasContent),
    access,
  };
  if (access !== 'full') return result;
  Object.assign(result, pick(record, ['importance', 'style', 'summary', 'examFocusText']));
  result.blocks = projectRichBlocks(record.blocks);
  result.examFocus = strings(record.examFocus);
  result.keywords = strings(record.keywords);
  result.highlights = records(record.highlights).map((highlight) => ({
    articleId: String(highlight.articleId || ''),
    articleNumber: String(highlight.articleNumber || ''),
    title: String(highlight.title || ''),
    excerpt: String(highlight.excerpt || ''),
  }));
  if (featureMode(features, 'lei.macete') === 'full') result.macetes = strings(record.macetes);
  if (featureMode(features, 'lei.doutrina') === 'full') {
    result.doctrine = strings(record.doctrine ?? record.doutrina);
    result.doutrina = result.doctrine;
  }
  if (featureMode(features, 'lei.jurisprudencia') === 'full') {
    result.jurisprudence = projectJurisprudence(record.jurisprudence ?? record.jurisprudencia, authenticated);
    result.jurisprudencia = result.jurisprudence;
  }
  if (featureMode(features, 'lei.sumulas') === 'full') {
    result.sumulas = projectSyllabi(record.sumulas, authenticated);
  }
  Object.assign(result, projectReaction(record, authenticated));
  return result;
};

const projectUserComments = (value: unknown, authenticated: boolean): PublicLegalUserComment[] => records(value).flatMap((record) => {
  const status = String(record.status || 'visible');
  const moderation = String(record.moderationStatus || 'approved');
  if (!authenticated && (status !== 'visible' || moderation !== 'approved')) return [];
  const comment: PublicLegalUserComment = {
    ...pick(record, [
      'id', 'articleId', 'parentCommentId', 'parent_comment_id', 'userName',
      'userAvatar', 'avatarUrl', 'photoUrl', 'userPhotoUrl', 'userPlan', 'userRole',
      'body', 'status', 'createdAt', 'updatedAt', 'likes', 'dislikes',
    ]),
    ...(authenticated ? pick(record, ['userId', 'moderationStatus', 'userHasPendingReport', 'userReaction']) : {}),
    id: String(record.id || ''),
    articleId: String(record.articleId || ''),
    userName: String(record.userName || ''),
    body: String(record.body || ''),
    status: String(record.status || 'visible') as PublicLegalUserComment['status'],
    createdAt: String(record.createdAt || ''),
  };
  return comment.id && comment.articleId ? [comment] : [];
});

export const parsePublicLawDetail = (
  value: unknown,
  { authenticated = false }: { authenticated?: boolean } = {},
): PublicLawDetail | null => {
  const record = asRecord(value);
  if (!record) return null;
  const id = String(record.id || '').trim();
  const slug = String(record.slug || '').trim();
  if (!id || !slug || !Array.isArray(record.articles)) return null;
  const features = projectFeatures(record.features);
  const result = {
    ...pick(record, [
      'areaId', 'lawTopicFilterId', 'lawTopicName', 'lawTopicSlug', 'topicName', 'topicSlug',
      'subjectFilterId', 'subjectName', 'materiaName', 'disciplinaName', 'acronym', 'sigla',
      'catalogId', 'title', 'shortTitle', 'nome', 'number', 'numero', 'year', 'ano',
      'description', 'descricao', 'date', 'publishedAt', 'published_at', 'summary', 'preamble',
      'ementa', 'status', 'officialUrl', 'urlPlanalto', 'sourceName', 'lastSyncedAt',
      'lastUpdatedAt', 'ultimaSincronizacao', 'ultimaAtualizacao', 'isRecentlyUpdated',
      'atualizacaoPendente', 'articleCount', 'totalArtigos', 'commentedArticleCount',
      'artigosComentados', 'jurisprudenceCount', 'examTipCount', 'accessCount', 'outlineOnly',
      'hasLockedFeatures', 'publicationDecision', 'seoDecision', 'seoFacts',
    ]),
    id,
    slug,
    title: String(record.title || ''),
    shortTitle: String(record.shortTitle || record.title || ''),
    number: String(record.number || record.numero || ''),
    date: String(record.date || ''),
    aliases: strings(record.aliases),
    summary: String(record.summary || ''),
    status: String(record.status || 'active'),
    officialUrl: String(record.officialUrl || record.urlPlanalto || ''),
    sourceName: String(record.sourceName || ''),
    articleCount: Number(record.articleCount || 0),
    commentedArticleCount: Number(record.commentedArticleCount || 0),
    jurisprudenceCount: Number(record.jurisprudenceCount || 0),
    examTipCount: Number(record.examTipCount || 0),
    accessCount: Number(record.accessCount || 0),
    subject: projectTaxonomy(record.subject),
    materia: projectTaxonomy(record.materia),
    disciplina: projectTaxonomy(record.disciplina),
    subjects: projectTaxonomyList(record.subjects),
    materias: projectTaxonomyList(record.materias),
    disciplinas: projectTaxonomyList(record.disciplinas),
    disciplines: projectTaxonomyList(record.disciplines),
    assuntos: projectTaxonomyList(record.assuntos).filter((item): item is LegalTaxonomySummary => typeof item !== 'string'),
    area: asRecord(record.area) ? pick<LegalArea & UnknownRecord>(asRecord(record.area)!, [
      'id', 'catalogId', 'slug', 'name', 'nome', 'colorClass', 'cor', 'iconName', 'icone',
      'totalLaws', 'totalLeis', 'description', 'order', 'iconTone',
    ]) : undefined,
    sections: records(record.sections).map((section): LawSection => ({
      ...pick(section, [
        'id', 'lawId', 'slug', 'title', 'displayTitle', 'titleLabel', 'titleName',
        'chapterLabel', 'chapterName', 'subtopicFilterId', 'assuntoFilterId',
        'fromArticle', 'toArticle', 'articleCount', 'sortOrder',
      ]),
      ...(authenticated ? pick(section, ['isFavorite']) : {}),
      id: String(section.id || ''),
      lawId: String(section.lawId || ''),
      title: String(section.title || ''),
      articleCount: Number(section.articleCount || 0),
    })),
    articles: records(record.articles)
      .map((article) => projectArticle(article, features, authenticated))
      .filter((article): article is PublicLawArticle => article !== null),
    sectionEditorials: records(record.sectionEditorials)
      .map((editorial) => projectSectionEditorial(editorial, features, authenticated))
      .filter((editorial): editorial is PublicLawSectionEditorial => editorial !== null),
    userComments: projectUserComments(record.userComments, authenticated),
    userCommentsPageInfo: asRecord(record.userCommentsPageInfo)
      ? pick(asRecord(record.userCommentsPageInfo)!, ['limit', 'hasMore']) as { limit: number; hasMore: boolean }
      : null,
    updates: records(record.updates).map((update) => pick<LawUpdate & UnknownRecord>(update, [
      'id', 'lawId', 'articleId', 'changedAt', 'changeType', 'title', 'summary', 'sourceUrl',
    ])),
    features,
    hasLockedFeatures: Boolean(record.hasLockedFeatures),
    planAccess: asRecord(record.planAccess) ? pick(asRecord(record.planAccess)!, ['planName', 'status']) : null,
    editorialAvailability: Object.fromEntries(Object.entries(asRecord(record.editorialAvailability) || {}).flatMap(([key, raw]) => {
      const availability = asRecord(raw);
      return availability ? [[key, {
        available: Boolean(availability.available),
        access: normalizeAccess(availability.access),
      }]] : [];
    })),
  } as PublicLawDetail;

  if (authenticated) {
    Object.assign(result, pick(record, ['isFavorite', 'progressPercent']));
    const progress = asRecord(record.progress);
    if (progress) {
      result.progress = {
        ...pick(progress, ['id', 'lawId', 'lastArticleId', 'lastViewedAt']),
        viewedArticleIds: strings(progress.viewedArticleIds),
        progressPercent: Number(progress.progressPercent || 0),
      };
    }
  }

  return result;
};
