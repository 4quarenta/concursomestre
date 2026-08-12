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
import type {
  ExamFileAttachment,
  ExamFileKind,
  Question,
  QuestionAlternativePayload,
  QuestionAsset,
  QuestionContextPayload,
  QuestionEditorialPayload,
  QuestionFilterValuePayload,
  QuestionFiltersPayload,
  QuestionPayload,
  QuestionStats,
  UserAnswer,
} from 'types';
import { isQuestionPubliclyVisible, withQuestionPublicationAliases } from './questionPublication';

type QuestionListResult = {
  rows: Question[];
  total: number;
  pageInfo?: {
    limit: number;
    total: number;
    hasMore: boolean;
    nextCursor: string | null;
  };
};

type SubmitAnswerResult = {
  success: boolean;
  message?: string;
  newXp?: number;
  newLevel?: number;
  answer?: {
    selectedOptionIndex: number;
    correctOptionIndex: number;
    isCorrect: boolean;
  };
};

type QuestionCreateResponse = {
  question?: Question;
  id?: string | number;
};

export type ImportedQuestionBatchPayload = {
  schemaVersion?: 'question-import.v2';
  import?: Record<string, unknown>;
  exam: Record<string, unknown>;
  focus: Record<string, unknown>;
  contexts: QuestionContextPayload[];
  questions: Array<Question | QuestionPayload>;
  requireExistingExam?: boolean;
  require_existing_exam?: boolean;
};

type ImportedExamPayload = {
  exam: Record<string, unknown>;
  focus: Record<string, unknown>;
};

type ImportedQuestionBatchResponse = {
  exam?: Record<string, unknown>;
  prova?: Record<string, unknown>;
  count?: number;
  created?: Question[];
  duplicatesSkipped?: Array<Record<string, unknown>>;
  duplicates_skipped?: Array<Record<string, unknown>>;
  skippedDuplicateCount?: number;
  skipped_duplicate_count?: number;
  newTaxonomies?: Array<Record<string, unknown>>;
};

type ImportedQuestionMultiBatchResponse = {
  count?: number;
  created?: Question[];
  skippedDuplicateCount?: number;
  itemFailures?: Array<Record<string, unknown>>;
  batches?: Array<{
    clientKey?: string;
    count?: number;
    created?: Question[];
    duplicatesSkipped?: Array<Record<string, unknown>>;
    duplicates_skipped?: Array<Record<string, unknown>>;
    skippedDuplicateCount?: number;
    skipped_duplicate_count?: number;
    itemFailures?: Array<Record<string, unknown>>;
    item_failures?: Array<Record<string, unknown>>;
  }>;
};

type ToggleSavedQuestionResponse = {
  isSaved?: boolean;
  is_saved?: boolean;
  message?: string;
  xpGain?: number;
  xp_gain?: number;
  newXp?: number;
  new_xp?: number;
  newLevel?: number;
  new_level?: number;
};

type ToggleSavedQuestionResult = {
  success: boolean;
  isSaved?: boolean;
  message?: string;
  xpGain?: number;
  newXp?: number;
  newLevel?: number;
};

export type QuestionEditorialFeedbackKind = 'teacher' | 'detailed';
export type QuestionEditorialFeedbackValue = 'like' | 'dislike';

export type QuestionEditorialFeedbackSnapshot = {
  feedback: Record<QuestionEditorialFeedbackKind, QuestionEditorialFeedbackValue | null>;
  counts: Record<QuestionEditorialFeedbackKind, {
    likes: number;
    dislikes: number;
  }>;
};

type QuestionFilters = Record<string, string | number | boolean | undefined | null>;

type QuestionPageResponse = {
  rows?: Question[];
  total?: number;
};

type QuestionV2TaxonomyItem = {
  id?: string | number | null;
  label?: string;
  slug?: string;
  parentId?: string | number | null;
};

type QuestionV2Asset = {
  tempId?: string;
  type?: string;
  usage?: string;
  url?: string;
  base64?: string;
  alt?: string;
  caption?: string;
  sourcePage?: number | null;
  order?: number;
};

type QuestionV2Alternative = {
  id?: string;
  tempId?: string;
  order?: number;
  label?: string;
  text?: string;
  textClean?: string;
  assets?: QuestionV2Asset[];
};

export type QuestionV2Detail = {
  id?: string | number;
  source?: {
    origin?: string;
    examId?: string | number | null;
    questionNumber?: string | number | null;
    questionGroupId?: string | number | null;
    sourcePage?: string | number | null;
  };
  content?: {
    statement?: string;
    statementClean?: string;
    supportText?: string;
    reference?: string;
  };
  assets?: QuestionV2Asset[];
  contexts?: Array<{
    id?: string | number | null;
    tempId?: string;
    type?: string;
    body?: string;
    bodyClean?: string;
    reference?: string;
    sourcePage?: string | number | null;
    assets?: QuestionV2Asset[];
    questionNumbers?: Array<string | number>;
  }>;
  filters?: {
    subjects?: QuestionV2TaxonomyItem[];
    topics?: QuestionV2TaxonomyItem[];
    subtopics?: QuestionV2TaxonomyItem[];
    examBoards?: QuestionV2TaxonomyItem[];
    organizations?: QuestionV2TaxonomyItem[];
    roles?: QuestionV2TaxonomyItem[];
    careers?: QuestionV2TaxonomyItem[];
    years?: Array<string | number>;
    levels?: QuestionV2TaxonomyItem[];
    examTypes?: QuestionV2TaxonomyItem[];
  };
  type?: string;
  difficulty?: string;
  alternatives?: QuestionV2Alternative[];
  publication?: {
    status?: string;
    visibility?: string;
    scheduledAt?: string | null;
    publishedAt?: string | null;
  };
  stats?: {
    totalAttempts?: number;
    correctCount?: number;
    wrongCount?: number;
  };
  userState?: {
    answered?: boolean;
    isSaved?: boolean;
  };
  userAnswer?: unknown;
  examSummary?: Array<Record<string, unknown>> | Record<string, unknown> | null;
  engagement?: {
    commentsCount?: number;
  };
  editorialAvailability?: {
    hasTeacherComment?: boolean;
    hasDetailedAnalysis?: boolean;
  };
  editorial?: QuestionEditorialPayload[];
};

export type QuestionV2ListItem = {
  id?: string | number;
  statementPreview?: string;
  type?: string;
  difficulty?: string;
  hasImage?: boolean;
  taxonomySummary?: QuestionV2Detail['filters'];
  stats?: {
    attempts?: number;
    correct?: number;
    wrong?: number;
  };
  publication?: {
    status?: string;
    visibility?: string;
  };
  userState?: {
    answered?: boolean;
    isSaved?: boolean;
    selectedOptionId?: string | number | null;
    selectedOptionIndex?: number | null;
  };
  publishedAt?: string | null;
  createdAt?: string | null;
  engagement?: {
    commentsCount?: number;
  };
};

export type QuestionV2PageResponse = {
  items?: Array<QuestionV2ListItem | QuestionV2Detail>;
  pageInfo?: {
    limit?: number;
    total?: number;
    hasMore?: boolean;
    nextCursor?: string | null;
  };
};

type SubmitAnswerApiResponse = {
  new_xp?: number;
  new_level?: number;
  answer?: {
    selectedOptionIndex?: number;
    correctOptionIndex?: number;
    isCorrect?: boolean;
  };
};

const toRecord = (value: unknown): Record<string, unknown> | null => (
  value && typeof value === 'object' ? value as Record<string, unknown> : null
);

const readText = (value: unknown): string => (
  value === undefined || value === null ? '' : String(value)
);

const readFirstNonEmptyText = (...values: unknown[]): string => {
  for (const value of values) {
    const text = readText(value);
    if (text.trim() !== '') {
      return text;
    }
  }

  return '';
};

const readSourceScalar = (value: unknown): string | number | null => (
  typeof value === 'string' || typeof value === 'number' ? value : null
);

const stripHtml = (value: string): string => value.replace(/<[^>]*>?/gm, '').trim();

const readTaxonomyLabel = (value: unknown): string => {
  const record = toRecord(value);
  if (!record) {
    return readText(value).trim();
  }

  return readText(
    record.label
    ?? record.name
    ?? record.nome
    ?? record.descricao
    ?? record['descrição']
    ?? record.sigla
    ?? record.slug
    ?? '',
  ).trim();
};

const readTaxonomySlug = (value: unknown): string | undefined => {
  const record = toRecord(value);
  const slug = readText(record?.slug).trim();
  return slug || undefined;
};

const readTaxonomyId = (value: unknown): string | number | null => {
  const record = toRecord(value);
  const id = record?.id ?? record?.value ?? null;
  const normalizedId = readText(id).trim().toLowerCase();
  if (!normalizedId || normalizedId === 'null' || normalizedId === 'undefined') {
    return null;
  }

  return id as string | number | null;
};

const toQuestionFilterValue = (value: unknown): QuestionFilterValuePayload | null => {
  const label = readTaxonomyLabel(value);
  if (!label) {
    return null;
  }

  const id = readTaxonomyId(value);
  return {
    ...(id !== null ? { id } : {}),
    label,
    slug: readTaxonomySlug(value),
  };
};

const toQuestionFilterValues = (values: unknown): QuestionFilterValuePayload[] => {
  if (!Array.isArray(values)) {
    return [];
  }

  const seen = new Set<string>();
  return values.reduce<QuestionFilterValuePayload[]>((items, value) => {
    const item = toQuestionFilterValue(value);
    if (!item) {
      return items;
    }

    const key = `${item.id ?? ''}:${item.slug ?? ''}:${item.label}`.toLowerCase();
    if (seen.has(key)) {
      return items;
    }

    seen.add(key);
    items.push(item);
    return items;
  }, []);
};

const readQuestionTaxonomyLevel = (value: unknown): string => {
  const record = toRecord(value);
  return readText(record?.taxonomyLevel ?? record?.taxonomy_level ?? record?.level ?? '').toLowerCase();
};

const splitQuestionSubjectFilters = (question: Question): Pick<QuestionFiltersPayload, 'subjects' | 'topics' | 'subtopics'> => {
  const legacySubjects = Array.isArray(question.assuntos) ? question.assuntos : [];
  const materias = legacySubjects.filter((item) => {
    const record = toRecord(item);
    return Boolean(record?.materia || record?.meta_materia || readQuestionTaxonomyLevel(item) === 'materia');
  });
  const topicos = legacySubjects.filter((item) => readQuestionTaxonomyLevel(item) === 'topico');
  const assuntos = legacySubjects.filter((item) => {
    const record = toRecord(item);
    return !record?.materia && !record?.meta_materia && readQuestionTaxonomyLevel(item) !== 'materia' && readQuestionTaxonomyLevel(item) !== 'topico';
  });

  return {
    subjects: toQuestionFilterValues(question.filters?.subjects?.length ? question.filters.subjects : question.filters?.materias?.length ? question.filters.materias : materias),
    topics: toQuestionFilterValues(question.filters?.topics?.length ? question.filters.topics : question.filters?.topicos?.length ? question.filters.topicos : topicos),
    subtopics: toQuestionFilterValues(question.filters?.subtopics?.length ? question.filters.subtopics : question.filters?.assuntos?.length ? question.filters.assuntos : assuntos),
  };
};

const buildQuestionFiltersPayload = (question: Question): QuestionFiltersPayload => {
  const subjectFilters = splitQuestionSubjectFilters(question);
  const levelValues = question.filters?.niveis?.length
    ? question.filters.niveis
    : [question.nivel ?? question.level].filter((value) => value !== undefined && value !== null && String(value).trim() !== '');

  return {
    ...subjectFilters,
    examBoards: toQuestionFilterValues(question.filters?.examBoards?.length ? question.filters.examBoards : question.filters?.bancas?.length ? question.filters.bancas : question.bancas),
    organizations: toQuestionFilterValues(question.filters?.organizations?.length ? question.filters.organizations : question.filters?.orgaos?.length ? question.filters.orgaos : question.orgaos),
    roles: toQuestionFilterValues(question.filters?.roles?.length ? question.filters.roles : question.filters?.cargos?.length ? question.filters.cargos : question.cargos),
    careers: toQuestionFilterValues(question.filters?.careers?.length ? question.filters.careers : question.filters?.carreiras?.length ? question.filters.carreiras : question.carreiras),
    years: toQuestionFilterValues(question.filters?.years?.length ? question.filters.years : question.filters?.anos?.length ? question.filters.anos : question.anos),
    levels: toQuestionFilterValues(question.filters?.levels?.length ? question.filters.levels : question.filters?.niveis?.length ? question.filters.niveis : levelValues),
    examTypes: toQuestionFilterValues(question.filters?.examTypes?.length ? question.filters.examTypes : question.filters?.tiposProva?.length ? question.filters.tiposProva : question.tiposProva),
  };
};

const normalizeQuestionDifficultyPayload = (question: Question): string => {
  const rawDifficulty = readText(question.difficulty || question.dificuldade || '').trim().toLowerCase();
  if (['1', 'facil', 'fácil', 'easy'].includes(rawDifficulty)) {
    return 'easy';
  }
  if (['3', 'dificil', 'difícil', 'hard'].includes(rawDifficulty)) {
    return 'hard';
  }
  return 'medium';
};

const normalizeQuestionTypePayload = (question: Question): string => {
  const questionRecord = question as Question & { type?: string };
  const rawType = readText(questionRecord.type || question.questionType || question.tipo || '').trim().toLowerCase();
  if (rawType.includes('certo') || rawType.includes('errado') || rawType === 'true_false') {
    return 'true_false';
  }
  if (rawType.includes('multipla') || rawType.includes('múltipla') || rawType === 'single_choice') {
    return 'single_choice';
  }
  return rawType || 'single_choice';
};

const buildQuestionAlternativesPayload = (question: Question): QuestionAlternativePayload[] => {
  if (Array.isArray(question.alternatives) && question.alternatives.length > 0) {
    return question.alternatives.map((alternative, index) => ({
      tempId: alternative.tempId || alternative.id || `alt_${readText(alternative.label || String.fromCharCode(65 + index)).toLowerCase()}`,
      ...(alternative.id ? { id: alternative.id } : {}),
      order: Number(alternative.order || index + 1),
      label: readText(alternative.label || String.fromCharCode(65 + index)),
      text: readText(alternative.text),
      textClean: stripHtml(readText(alternative.textClean ?? alternative.text)),
      assets: Array.isArray(alternative.assets) ? alternative.assets : [],
    }));
  }

  return (Array.isArray(question.itens) ? question.itens : []).map((item, index) => ({
    tempId: `alt_${readText(item.rotulo || String.fromCharCode(65 + index)).toLowerCase()}`,
    order: Number(item.ordem || item.id || index + 1),
    label: readText(item.rotulo || String.fromCharCode(65 + index)),
    text: readText(item.corpo),
    textClean: stripHtml(readText(item.corpo_clean ?? item.corpo)),
    assets: [],
  }));
};

const normalizeQuestionAssetPayload = (asset: QuestionAsset, index: number): QuestionAsset | null => {
  const url = readText(asset.url).trim();
  const base64 = readText(asset.base64).trim();
  if (!url && !base64) {
    return null;
  }

  const usage = ['statement', 'support', 'alternative', 'context', 'reference'].includes(readText(asset.usage))
    ? asset.usage
    : 'statement';

  return {
    tempId: readText(asset.tempId ?? asset.id).trim() || `img_${usage}_${index + 1}`,
    type: 'image',
    usage,
    ...(url ? { url } : {}),
    ...(base64 ? { base64 } : {}),
    alt: readText(asset.alt).trim() || 'Imagem vinculada a questao.',
    ...(readText(asset.caption).trim() ? { caption: readText(asset.caption).trim() } : {}),
    sourcePage: asset.sourcePage ?? null,
    order: Number(asset.order || index + 1),
  };
};

const buildQuestionAssetsPayload = (question: Question): QuestionAsset[] => {
  const assets = (Array.isArray(question.assets) ? question.assets : [])
    .map(normalizeQuestionAssetPayload)
    .filter((asset): asset is QuestionAsset => Boolean(asset));
  const imageUrl = readText(question.imageUrl).trim();
  if (imageUrl && !assets.some((asset) => asset.url === imageUrl || asset.base64 === imageUrl)) {
    assets.push({
      tempId: 'img_statement_1',
      type: 'image',
      usage: 'statement',
      url: imageUrl,
      alt: 'Imagem do enunciado.',
      order: assets.length + 1,
    });
  }

  const seen = new Set<string>();
  return assets.filter((asset) => {
    const key = `${asset.tempId || asset.id}:${asset.url || asset.base64 || ''}`.toLowerCase();
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
};

const buildCanonicalQuestionPayload = (question: Question): QuestionPayload => {
  const normalizedQuestion = withQuestionPublicationAliases(question);
  const questionRecord = normalizedQuestion as Question & Record<string, unknown>;
  const sourceRecord = toRecord(normalizedQuestion.source) || {};
  const contentRecord = toRecord(normalizedQuestion.content) || {};
  const publicationRecord = toRecord(normalizedQuestion.publication) || {};
  const reviewRecord = toRecord(normalizedQuestion.review) || {};
  const alternatives = buildQuestionAlternativesPayload(normalizedQuestion);
  const answerRecord = toRecord(normalizedQuestion.answer) || {};
  const answerValue = answerRecord.raw ?? answerRecord.value ?? normalizedQuestion.resposta ?? null;
  const answerAlternative = alternatives.find((alternative) => (
    String(alternative.order) === String(answerValue)
    || String(alternative.label).toLowerCase() === String(answerValue).toLowerCase()
    || String(alternative.tempId) === String(answerRecord.alternativeId || '')
    || String(alternative.id || '') === String(answerRecord.alternativeId || '')
  ));

  return {
    tempId: readText(questionRecord.tempId).trim() || undefined,
    id: normalizedQuestion.id ?? null,
    source: {
      origin: readText(sourceRecord.origin || normalizedQuestion.questionOrigin || normalizedQuestion.question_origin || (normalizedQuestion.provaId ? 'exam' : 'platform')).trim() || 'platform',
      examId: readSourceScalar(sourceRecord.examId ?? normalizedQuestion.provaId ?? null),
      questionNumber: readSourceScalar(sourceRecord.questionNumber ?? questionRecord.questionNumber),
      contextTempId: readSourceScalar(sourceRecord.contextTempId ?? questionRecord.contextTempId ?? questionRecord.context_temp_id ?? normalizedQuestion.grupoQuestaoId ?? normalizedQuestion.grupo_questao_id ?? normalizedQuestion.grupoQuestao?.id),
      sourcePage: readSourceScalar(sourceRecord.sourcePage ?? questionRecord.sourcePage),
    },
    content: {
      statement: readText(contentRecord.statement ?? normalizedQuestion.enunciado),
      statementClean: readText(contentRecord.statementClean ?? stripHtml(readText(normalizedQuestion.enunciado_clean ?? normalizedQuestion.enunciado))),
      supportText: readText(contentRecord.supportText ?? normalizedQuestion.introText ?? normalizedQuestion.intro_text),
      reference: readText(contentRecord.reference ?? normalizedQuestion.referenceText ?? normalizedQuestion.reference_text),
    },
    assets: buildQuestionAssetsPayload(normalizedQuestion),
    filters: normalizedQuestion.filters ? {
      subjects: toQuestionFilterValues(normalizedQuestion.filters.subjects?.length ? normalizedQuestion.filters.subjects : normalizedQuestion.filters.materias),
      topics: toQuestionFilterValues(normalizedQuestion.filters.topics?.length ? normalizedQuestion.filters.topics : normalizedQuestion.filters.topicos),
      subtopics: toQuestionFilterValues(normalizedQuestion.filters.subtopics?.length ? normalizedQuestion.filters.subtopics : normalizedQuestion.filters.assuntos),
      examBoards: toQuestionFilterValues(normalizedQuestion.filters.examBoards?.length ? normalizedQuestion.filters.examBoards : normalizedQuestion.filters.bancas),
      organizations: toQuestionFilterValues(normalizedQuestion.filters.organizations?.length ? normalizedQuestion.filters.organizations : normalizedQuestion.filters.orgaos),
      roles: toQuestionFilterValues(normalizedQuestion.filters.roles?.length ? normalizedQuestion.filters.roles : normalizedQuestion.filters.cargos),
      careers: toQuestionFilterValues(normalizedQuestion.filters.careers?.length ? normalizedQuestion.filters.careers : normalizedQuestion.filters.carreiras),
      years: toQuestionFilterValues(normalizedQuestion.filters.years?.length ? normalizedQuestion.filters.years : normalizedQuestion.filters.anos),
      levels: toQuestionFilterValues(normalizedQuestion.filters.levels?.length ? normalizedQuestion.filters.levels : normalizedQuestion.filters.niveis),
      examTypes: toQuestionFilterValues(normalizedQuestion.filters.examTypes?.length ? normalizedQuestion.filters.examTypes : normalizedQuestion.filters.tiposProva),
    } : buildQuestionFiltersPayload(normalizedQuestion),
    type: normalizeQuestionTypePayload(normalizedQuestion),
    difficulty: normalizeQuestionDifficultyPayload(normalizedQuestion),
    alternatives,
    answer: {
      mode: normalizeQuestionTypePayload(normalizedQuestion) === 'true_false' ? 'boolean' : 'single',
      raw: answerAlternative?.label ?? answerValue,
      correctAlternativeTempIds: answerAlternative?.tempId ? [answerAlternative.tempId] : [],
    },
    editorial: [
      {
        type: 'teacher_comment',
        title: '',
        body: readFirstNonEmptyText(
          normalizedQuestion.teacherComment,
          normalizedQuestion.editorialComments?.teacherComment,
          normalizedQuestion.editorial?.find?.((item) => item.type === 'teacher_comment')?.body,
        ),
        status: 'draft',
      },
      {
        type: 'detailed_analysis',
        title: '',
        body: readFirstNonEmptyText(
          normalizedQuestion.detailedComment,
          normalizedQuestion.editorialComments?.detailedComment,
          normalizedQuestion.editorial?.find?.((item) => item.type === 'detailed_analysis')?.body,
        ),
        status: 'draft',
      },
    ],
    publication: {
      status: readText(publicationRecord.status ?? normalizedQuestion.publishStatus ?? 'published') || 'published',
      visibility: readText(publicationRecord.visibility ?? normalizedQuestion.visibilityStatus ?? 'public') || 'public',
      scheduledAt: readText(publicationRecord.scheduledAt ?? normalizedQuestion.scheduledAt).trim() || null,
    },
    review: {
      required: Boolean(reviewRecord.required ?? reviewRecord.needsReview ?? false),
      status: readText(reviewRecord.status ?? 'pending') || 'pending',
      reasons: Array.isArray(reviewRecord.reasons)
        ? reviewRecord.reasons.map((reason) => readText(reason)).filter(Boolean)
        : Array.isArray(reviewRecord.statusReasons)
          ? reviewRecord.statusReasons.map((reason) => readText(reason)).filter(Boolean)
          : [],
    },
  };
};

/**
 * A revisao do importador existe apenas no cliente. Quando o lote chega a
 * este servico, a acao solicitada ja e de publicacao e nao de salvar rascunho.
 * Normalizar aqui evita que o estado transitorio do card seja persistido como
 * `draft` ou `private` por engano, inclusive nos lotes do coletor Gran.
 */
const buildPublishedImportedQuestionBatchPayload = (
  payload: ImportedQuestionBatchPayload,
): ImportedQuestionBatchPayload => ({
  ...payload,
  schemaVersion: 'question-import.v2',
  exam: {
    ...(payload.exam || {}),
    publishStatus: 'published',
    statusEditorial: 'published',
    status_editorial: 'published',
    visibilityStatus: 'public',
    visibility_status: 'public',
  },
  questions: payload.questions.map((question) => {
    const canonicalQuestion = buildCanonicalQuestionPayload(question as unknown as Question);

    return {
      ...canonicalQuestion,
      publication: {
        ...canonicalQuestion.publication,
        status: 'published',
        visibility: 'public',
        scheduledAt: null,
      },
    };
  }),
});

const EMPTY_EDITORIAL_FEEDBACK_SNAPSHOT: QuestionEditorialFeedbackSnapshot = {
  feedback: {
    teacher: null,
    detailed: null,
  },
  counts: {
    teacher: {
      likes: 0,
      dislikes: 0,
    },
    detailed: {
      likes: 0,
      dislikes: 0,
    },
  },
};

const normalizeEditorialFeedbackValue = (value: unknown): QuestionEditorialFeedbackValue | null => {
  const normalized = String(value || '').trim().toLowerCase();
  return normalized === 'like' || normalized === 'dislike' ? normalized : null;
};

const readEditorialFeedbackCounts = (value: unknown) => {
  const record = toRecord(value) || {};
  return {
    likes: Number(record.likes || 0) || 0,
    dislikes: Number(record.dislikes || 0) || 0,
  };
};

const normalizeEditorialFeedbackSnapshot = (value: unknown): QuestionEditorialFeedbackSnapshot => {
  const record = toRecord(value) || {};
  const feedbackRecord = toRecord(record.feedback) || {};
  const countsRecord = toRecord(record.counts) || {};

  return {
    feedback: {
      teacher: normalizeEditorialFeedbackValue(feedbackRecord.teacher),
      detailed: normalizeEditorialFeedbackValue(feedbackRecord.detailed),
    },
    counts: {
      teacher: readEditorialFeedbackCounts(countsRecord.teacher),
      detailed: readEditorialFeedbackCounts(countsRecord.detailed),
    },
  };
};

const readImportedExamRecord = (payload: unknown): Record<string, unknown> | undefined => {
  const record = toRecord(payload);
  if (!record) {
    return undefined;
  }

  const directExam = [
    record.exam,
    record.prova,
    record.importedExam,
    record.imported_exam,
    record.createdExam,
    record.created_exam,
    record.publishedExam,
    record.published_exam,
  ]
    .map(toRecord)
    .find(Boolean);
  if (directExam) {
    return directExam;
  }

  const nestedContainers = [
    record.data,
    record.result,
    record.payload,
    record.item,
    record.record,
    record.row,
  ];
  for (const nestedContainer of nestedContainers) {
    const nestedRecord = toRecord(nestedContainer);
    if (nestedRecord && nestedRecord !== record) {
      const nestedExam = readImportedExamRecord(nestedRecord);
      if (nestedExam) {
        return nestedExam;
      }
    }
  }

  const hasExamShape = [
    'id',
    'exam_id',
    'prova_id',
    'publishedExamId',
    'published_exam_id',
    'nome',
    'name',
    'title',
    'examTitle',
    'exam_title',
    'ano',
    'year',
    'caderno',
    'tipoCaderno',
    'bookletType',
    'corCaderno',
    'bookletColor',
  ]
    .some((key) => record[key] !== undefined && record[key] !== null && String(record[key]).trim() !== '');

  return hasExamShape ? record : undefined;
};

const withImportedQuestionAliases = (question: Question): Question => {
  const normalizedQuestion = withQuestionPublicationAliases(question);
  const record = normalizedQuestion as Question & Record<string, unknown>;
  const sourceQuestionNumber = record.questionNumber
    ?? record.question_number
    ?? record.number
    ?? record.sourceQuestionNumber
    ?? record.source_question_number;

  if (sourceQuestionNumber === undefined || sourceQuestionNumber === null || String(sourceQuestionNumber).trim() === '') {
    return normalizedQuestion;
  }

  return {
    ...normalizedQuestion,
    questionNumber: sourceQuestionNumber,
    question_number: sourceQuestionNumber,
    number: sourceQuestionNumber,
    sourceQuestionNumber: sourceQuestionNumber,
    source_question_number: sourceQuestionNumber,
  } as Question;
};

const readExamFileAttachment = (value: unknown, fallbackKind: ExamFileKind): ExamFileAttachment => {
  const record = toRecord(value) || {};
  return {
    kind: String(record.kind || fallbackKind) as ExamFileKind,
    label: String(record.label || ''),
    name: String(record.name || record.fileName || record.file_name || ''),
    url: String(record.url || record.fileUrl || record.file_url || ''),
    mimeType: String(record.mimeType || record.mime_type || ''),
    size: Number(record.size || 0) || undefined,
    uploadedAt: String(record.uploadedAt || record.uploaded_at || ''),
  };
};

const mapV2TaxonomyItems = (items: QuestionV2TaxonomyItem[] | undefined): QuestionFilterValuePayload[] => (
  Array.isArray(items)
    ? items
      .map((item) => ({
        ...(item.id !== undefined && item.id !== null ? { id: item.id } : {}),
        label: readText(item.label).trim(),
        slug: readText(item.slug).trim() || undefined,
      }))
      .filter((item) => item.label)
    : []
);

type LegacyTaxonomyKind = 'subject' | 'board' | 'organization' | 'role' | 'generic';

const mapV2TaxonomyItemsToLegacy = (
  items: QuestionFilterValuePayload[] | undefined,
  kind: LegacyTaxonomyKind,
) => (Array.isArray(items) ? items.map((item) => {
  const label = readText(item.label).trim();
  const base = {
    ...(item.id !== undefined && item.id !== null ? { id: item.id } : {}),
    nome: label,
    name: label,
    label,
    slug: readText(item.slug).trim(),
  };

  if (kind === 'board' || kind === 'organization') {
    return { ...base, sigla: label };
  }
  if (kind === 'role') {
    return { ...base, descricao: label, descrição: label };
  }
  if (kind === 'subject') {
    return { ...base, materia: true };
  }
  return base;
}) : []);

const mapV2YearsToLegacy = (items: QuestionFilterValuePayload[] | undefined): number[] => (
  (Array.isArray(items) ? items : [])
    .map((item) => Number(item.label))
    .filter((year) => Number.isInteger(year) && year > 0)
);

const mapV2Contexts = (contexts: QuestionV2Detail['contexts']) => (
  Array.isArray(contexts)
    ? contexts.map((context) => ({
      ...(context.id !== undefined && context.id !== null ? { id: context.id } : {}),
      ...(context.tempId ? { tempId: context.tempId } : {}),
      type: context.type || 'shared',
      body: readText(context.body),
      bodyClean: readText(context.bodyClean),
      reference: readText(context.reference),
      sourcePage: context.sourcePage ?? null,
      assets: Array.isArray(context.assets) ? context.assets : [],
      questionNumbers: Array.isArray(context.questionNumbers) ? context.questionNumbers : [],
    }))
    : []
);

const mapV2ExamSummaryToLegacy = (summary: QuestionV2Detail['examSummary']) => {
  if (!summary) return [];
  const rows = Array.isArray(summary) ? summary : [summary];
  return rows.map((exam) => ({
    ...exam,
    id: exam.id,
    nome: readText(exam.name ?? exam.nome).trim(),
    name: readText(exam.name ?? exam.nome).trim(),
    ano: Number(exam.year ?? exam.ano) || undefined,
  }));
};

const mapV2DifficultyToLegacy = (difficulty: string | undefined): number => {
  const normalized = readText(difficulty).toLowerCase();
  if (normalized.includes('facil') || normalized.includes('fácil') || normalized === 'easy') return 1;
  if (normalized.includes('dificil') || normalized.includes('difícil') || normalized === 'hard') return 3;
  return 2;
};

const mapV2TypeToLegacy = (type: string | undefined): string => (
  readText(type).toLowerCase() === 'true_false' ? 'certo ou errado' : 'multipla escolha'
);

const mapV2FiltersToLegacy = (filters: QuestionV2Detail['filters']): QuestionFiltersPayload => ({
  subjects: mapV2TaxonomyItems(filters?.subjects),
  topics: mapV2TaxonomyItems(filters?.topics),
  subtopics: mapV2TaxonomyItems(filters?.subtopics),
  examBoards: mapV2TaxonomyItems(filters?.examBoards),
  organizations: mapV2TaxonomyItems(filters?.organizations),
  roles: mapV2TaxonomyItems(filters?.roles),
  careers: mapV2TaxonomyItems(filters?.careers),
  years: toQuestionFilterValues(filters?.years || []),
  levels: mapV2TaxonomyItems(filters?.levels),
  examTypes: mapV2TaxonomyItems(filters?.examTypes),
});

const readV2EditorialBody = (
  editorial: QuestionV2Detail['editorial'],
  type: 'teacher_comment' | 'detailed_analysis',
): string => {
  if (!Array.isArray(editorial)) return '';
  const item = editorial.find((entry) => entry?.type === type);
  return readText(item?.body).trim();
};

export const mapV2DetailToQuestion = (detail: QuestionV2Detail): Question => {
  const filters = mapV2FiltersToLegacy(detail.filters);
  const alternatives = Array.isArray(detail.alternatives) ? detail.alternatives : [];
  const contexts = mapV2Contexts(detail.contexts);
  const exams = mapV2ExamSummaryToLegacy(detail.examSummary);
  const teacherComment = readV2EditorialBody(detail.editorial, 'teacher_comment');
  const detailedComment = readV2EditorialBody(detail.editorial, 'detailed_analysis');
  const hasTeacherComment = Boolean(detail.editorialAvailability?.hasTeacherComment) || teacherComment !== '';
  const hasDetailedComment = Boolean(detail.editorialAvailability?.hasDetailedAnalysis) || detailedComment !== '';
  const firstAssetUrl = Array.isArray(detail.assets)
    ? detail.assets.find((asset) => readText(asset.url).trim())?.url || ''
    : '';
  const legacyQuestion: Question = {
    id: detail.id as Question['id'],
    source: detail.source,
    content: detail.content,
    assets: detail.assets || [],
    contexts,
    editorial: detail.editorial || [],
    enunciado: detail.content?.statement || '',
    enunciado_clean: detail.content?.statementClean || stripHtml(detail.content?.statement || ''),
    introText: detail.content?.supportText || '',
    referenceText: detail.content?.reference || '',
    imageUrl: firstAssetUrl,
    tipo: mapV2TypeToLegacy(detail.type),
    questionType: detail.type,
    dificuldade: mapV2DifficultyToLegacy(detail.difficulty),
    difficulty: detail.difficulty,
    resposta: -1,
    itens: alternatives.map((alternative, index) => ({
      id: alternative.tempId || alternative.id || `alt_${index + 1}`,
      ordem: alternative.order || index + 1,
      rotulo: alternative.label || String.fromCharCode(65 + index),
      corpo: alternative.text || '',
      corpo_clean: alternative.textClean || stripHtml(alternative.text || ''),
      assets: alternative.assets || [],
    })),
    alternatives,
    filters,
    assuntos: [
      ...mapV2TaxonomyItemsToLegacy(filters.subjects, 'subject'),
      ...mapV2TaxonomyItemsToLegacy(filters.topics, 'generic'),
      ...mapV2TaxonomyItemsToLegacy(filters.subtopics, 'generic'),
    ],
    bancas: mapV2TaxonomyItemsToLegacy(filters.examBoards, 'board'),
    orgaos: mapV2TaxonomyItemsToLegacy(filters.organizations, 'organization'),
    cargos: mapV2TaxonomyItemsToLegacy(filters.roles, 'role'),
    carreiras: mapV2TaxonomyItemsToLegacy(filters.careers, 'generic'),
    anos: mapV2YearsToLegacy(filters.years),
    nivel: filters.levels?.[0]?.label,
    tiposProva: filters.examTypes || [],
    provaId: detail.source?.examId ?? exams[0]?.id ?? undefined,
    provas: exams,
    publishStatus: detail.publication?.status,
    publicationStatus: detail.publication?.status,
    publish_status: detail.publication?.status,
    visibilityStatus: detail.publication?.visibility,
    visibility_status: detail.publication?.visibility,
    publishedAt: detail.publication?.publishedAt || undefined,
    stats: {
      totalAttempts: detail.stats?.totalAttempts || 0,
      correctCount: detail.stats?.correctCount || 0,
      wrongCount: detail.stats?.wrongCount || 0,
    },
    commentsCount: Math.max(0, Number(detail.engagement?.commentsCount || 0)),
    comments: null,
    teacherComment,
    detailedComment,
    hasTeacherComment,
    hasDetailedComment,
    isSaved: Boolean(detail.userState?.isSaved),
  } as unknown as Question;

  return withQuestionPublicationAliases(legacyQuestion);
};

export const mapV2ListItemToQuestion = (item: QuestionV2ListItem): Question => {
  const filters = mapV2FiltersToLegacy(item.taxonomySummary);
  return withQuestionPublicationAliases({
    id: item.id as Question['id'],
    enunciado: item.statementPreview || '',
    enunciado_clean: item.statementPreview || '',
    tipo: mapV2TypeToLegacy(item.type),
    questionType: item.type,
    dificuldade: mapV2DifficultyToLegacy(item.difficulty),
    difficulty: item.difficulty,
    resposta: -1,
    imageUrl: item.hasImage ? '__has_image__' : '',
    filters,
    assuntos: [
      ...mapV2TaxonomyItemsToLegacy(filters.subjects, 'subject'),
      ...mapV2TaxonomyItemsToLegacy(filters.topics, 'generic'),
      ...mapV2TaxonomyItemsToLegacy(filters.subtopics, 'generic'),
    ],
    bancas: mapV2TaxonomyItemsToLegacy(filters.examBoards, 'board'),
    orgaos: mapV2TaxonomyItemsToLegacy(filters.organizations, 'organization'),
    cargos: mapV2TaxonomyItemsToLegacy(filters.roles, 'role'),
    carreiras: mapV2TaxonomyItemsToLegacy(filters.careers, 'generic'),
    anos: mapV2YearsToLegacy(filters.years),
    nivel: filters.levels?.[0]?.label,
    publishStatus: item.publication?.status,
    publicationStatus: item.publication?.status,
    publish_status: item.publication?.status,
    visibilityStatus: item.publication?.visibility,
    visibility_status: item.publication?.visibility,
    publishedAt: item.publishedAt || undefined,
    stats: {
      totalAttempts: item.stats?.attempts || 0,
      correctCount: item.stats?.correct || 0,
      wrongCount: item.stats?.wrong || 0,
    },
    commentsCount: Math.max(0, Number(item.engagement?.commentsCount || 0)),
    comments: null,
    isSaved: Boolean(item.userState?.isSaved),
    userAnswer: item.userState?.answered ? {
      selectedOptionId: item.userState.selectedOptionId ?? null,
      selectedOptionIndex: item.userState.selectedOptionIndex ?? null,
    } : undefined,
    itens: [],
    alternatives: [],
  } as unknown as Question);
};

const resolveSelectedAlternativeId = (answer: Omit<UserAnswer, 'isCorrect' | 'correctOptionIndex'>): string => {
  const record = toRecord(answer);
  const explicitId = readText(record?.selectedAlternativeId ?? record?.selected_alternative_id).trim();
  if (explicitId) {
    return explicitId;
  }

  const alternatives = Array.isArray(record?.alternatives) ? record.alternatives : [];
  const selectedIndex = Number(answer.selectedOptionIndex);
  const selectedAlternative = alternatives[selectedIndex];
  const selectedRecord = toRecord(selectedAlternative);
  const candidate = readText(
    selectedRecord?.tempId
    ?? selectedRecord?.id
    ?? selectedRecord?.label
    ?? selectedRecord?.rotulo
    ?? '',
  ).trim();

  if (candidate) {
    return candidate;
  }

  return Number.isInteger(selectedIndex) && selectedIndex >= 0
    ? String.fromCharCode(65 + selectedIndex)
    : '';
};

/**
 * Fachada oficial do dominio de questoes.
 * Ela conecta prática, histórico, estatísticas e manutenção administrativa ao backend oficial.
 * @since v1.0.0
 */
export const questionService = {
  /**
   * Carrega uma pagina de questoes com total.
   * @since v1.0.0
   */
  async getQuestionPage(filters?: QuestionFilters): Promise<QuestionListResult> {
    const includeUnpublished = Boolean(filters?.includeUnpublished || filters?.includeDrafts || filters?.admin);
    const params = includeUnpublished
      ? filters
      : {
        ...filters,
        publication_scope: 'public',
        publish_status: 'published',
      };

    return withRequestCoalescing(buildRequestCacheKey('questions:list', params), async () => {
      const response = await apiClient.get<QuestionPageResponse | Question[] | QuestionV2PageResponse>(
        includeUnpublished ? ENDPOINTS.questions.list : ENDPOINTS.questions.v2List,
        {
          params,
        },
      );

      const payload = readApiData<QuestionPageResponse | Question[] | QuestionV2PageResponse>(response, {});
      const v2Items = !includeUnpublished && !Array.isArray(payload) && Array.isArray((payload as QuestionV2PageResponse).items)
        ? (payload as QuestionV2PageResponse).items || []
        : null;
      const rows = v2Items
        ? v2Items.map((item) => (
          'content' in item || Array.isArray((item as QuestionV2Detail).alternatives)
            ? mapV2DetailToQuestion(item as QuestionV2Detail)
            : mapV2ListItemToQuestion(item as QuestionV2ListItem)
        ))
        : Array.isArray(payload)
        ? payload
        : 'rows' in payload && Array.isArray(payload.rows)
          ? payload.rows
          : [];
      const normalizedRows = rows.map((row) => withQuestionPublicationAliases(row));
      const visibleRows = includeUnpublished
        ? normalizedRows
        : normalizedRows.filter((row) => isQuestionPubliclyVisible(row));
      const v2PageInfo = v2Items ? (payload as QuestionV2PageResponse).pageInfo : undefined;
      const total = v2Items
        ? Math.max(visibleRows.length, Number(v2PageInfo?.total ?? visibleRows.length))
        : Array.isArray(payload) ? visibleRows.length : Number(('total' in payload ? payload.total : undefined) || visibleRows.length);

      return {
        rows: visibleRows,
        total,
        ...(v2Items ? {
          pageInfo: {
            limit: Number(v2PageInfo?.limit || filters?.limit || visibleRows.length || 20),
            total,
            hasMore: Boolean(v2PageInfo?.hasMore),
            nextCursor: typeof v2PageInfo?.nextCursor === 'string' && v2PageInfo.nextCursor
              ? v2PageInfo.nextCursor
              : null,
          },
        } : {}),
      };
    }, 2500);
  },

  /**
   * Mantem a compatibilidade com consumidores antigos que esperam apenas a lista.
   * @since v1.0.0
   */
  async getQuestions(filters?: QuestionFilters): Promise<Question[]> {
    const result = await this.getQuestionPage(filters);
    return result.rows;
  },

  /**
   * Carrega uma questao publica isolada.
   * @since v1.0.0
   */
  async getQuestionById(questionId: string | number): Promise<Question> {
    const response = await apiClient.get<QuestionV2Detail>(
      ENDPOINTS.questions.v2Show,
      {
        params: {
          id: String(questionId),
        },
      },
    );

    return mapV2DetailToQuestion(readApiData<QuestionV2Detail>(response, {}));
  },

  /**
   * Carrega uma questao pelo contrato administrativo de edicao.
   * @since v1.0.0
   */
  async getQuestionForAdminEdit(questionId: string | number): Promise<Question> {
    const normalizedQuestionId = String(questionId);
    return withRequestCoalescing(
      buildRequestCacheKey('questions:admin-edit', { id: normalizedQuestionId }),
      async () => {
        const response = await apiClient.get<Question>(
          ENDPOINTS.questions.edit,
          {
            params: {
              id: normalizedQuestionId,
            },
            timeout: 15000,
          },
        );

        return withQuestionPublicationAliases(readApiData<Question>(response, {} as Question));
      },
      15_000,
    );
  },

  /**
   * Persiste a resposta do usuario e devolve o snapshot de progressao.
   * @since v1.0.0
   */
  async submitUserAnswer(answer: Omit<UserAnswer, 'isCorrect' | 'correctOptionIndex'>): Promise<SubmitAnswerResult> {
    const answerRecord = toRecord(answer);
    const suppliedIdempotencyKey = readText(
      answerRecord?.idempotencyKey ?? answerRecord?.idempotency_key,
    ).trim();
    const idempotencyKey = suppliedIdempotencyKey
      || (typeof globalThis.crypto?.randomUUID === 'function'
        ? globalThis.crypto.randomUUID()
        : `answer-${Date.now()}-${Math.random().toString(36).slice(2, 14)}`);
    const response = await apiClient.post<SubmitAnswerApiResponse>(
      ENDPOINTS.questions.v2Answer,
      {
        questionId: answer.questionId,
        selectedAlternativeId: resolveSelectedAlternativeId(answer),
        idempotencyKey,
        timeTaken: answer.timeTaken || 0,
        simulationId: (() => {
          const rawSimulationId = answer.simulationId;
          if (typeof rawSimulationId === 'number') return rawSimulationId;
          if (typeof rawSimulationId === 'string' && /^\d+$/.test(rawSimulationId.trim())) {
            return Number(rawSimulationId.trim());
          }
          return null;
        })(),
      },
    );
    const backendErrorMessage = readApiErrorMessage(response, '');
    if (
      typeof backendErrorMessage === 'string'
      && backendErrorMessage.toLowerCase().includes('nenhum campo editavel foi enviado')
    ) {
      return {
        success: true,
        message: 'Resposta já registrada.',
      };
    }

    const envelope = assertApiSuccess(response, 'Não foi possível salvar a resposta.');
    const payload = readApiData<SubmitAnswerApiResponse>(response, {});
    return {
      success: true,
      message: envelope.message,
      newXp: payload.new_xp ?? (typeof envelope.raw.new_xp === 'number' ? envelope.raw.new_xp : undefined),
      newLevel: payload.new_level ?? (typeof envelope.raw.new_level === 'number' ? envelope.raw.new_level : undefined),
      answer: payload.answer
        && Number.isInteger(payload.answer.selectedOptionIndex)
        && Number.isInteger(payload.answer.correctOptionIndex)
        && typeof payload.answer.isCorrect === 'boolean'
        ? {
          selectedOptionIndex: payload.answer.selectedOptionIndex,
          correctOptionIndex: payload.answer.correctOptionIndex,
          isCorrect: payload.answer.isCorrect,
        }
        : undefined,
    };
  },

  /**
   * Carrega o histórico de respostas do usuário para uma questão específica.
   * @since v1.0.0
   */
  async getQuestionHistory(questionId: string | number, userId?: string): Promise<UserAnswer[]> {
    const response = await apiClient.get<UserAnswer[]>(
      ENDPOINTS.questions.history,
      {
        params: {
          question_id: String(questionId),
          user_id: userId || '',
        },
      },
    );

    const payload = readApiData<UserAnswer[]>(response, []);
    if (!Array.isArray(payload)) {
      return [];
    }

    return payload.map((item) => {
      const legacyItem = item as UserAnswer & {
        selected_option_index?: number | string | null;
        is_correct?: boolean | number | null;
      };
      const selectedOptionIndex = Number(
        item.selectedOptionIndex
        ?? legacyItem.selected_option_index
        ?? 0,
      );
      const rawTimestamp = Number(item.timestamp || 0);

      return {
        ...item,
        selectedOptionIndex: Number.isFinite(selectedOptionIndex) ? selectedOptionIndex : 0,
        isCorrect: Boolean(item.isCorrect ?? legacyItem.is_correct),
        timestamp: rawTimestamp > 0 && rawTimestamp < 10_000_000_000 ? rawTimestamp * 1000 : rawTimestamp,
      };
    });
  },

  /**
   * Carrega as estatísticas agregadas de uma questão.
   * @since v1.0.0
   */
  async getQuestionStats(questionId: string | number): Promise<QuestionStats> {
    const response = await apiClient.get<QuestionStats>(
      ENDPOINTS.questions.stats,
      {
        params: {
          question_id: String(questionId),
        },
      },
    );

    return readApiData<QuestionStats>(response, {
      totalAttempts: 0,
      correctCount: 0,
      wrongCount: 0,
      optionDistribution: {},
    });
  },

  /**
   * Carrega likes/dislikes editoriais do comentário do professor e da análise detalhada.
   * @since v1.0.0
   */
  async getEditorialFeedback(questionId: string | number): Promise<QuestionEditorialFeedbackSnapshot> {
    try {
      const response = await apiClient.get<QuestionEditorialFeedbackSnapshot>(
        ENDPOINTS.questions.editorialFeedback,
        {
          params: {
            question_id: String(questionId),
          },
        },
      );

      return normalizeEditorialFeedbackSnapshot(readApiData<QuestionEditorialFeedbackSnapshot>(response, EMPTY_EDITORIAL_FEEDBACK_SNAPSHOT));
    } catch {
      return EMPTY_EDITORIAL_FEEDBACK_SNAPSHOT;
    }
  },

  /**
   * Persiste o like/dislike editorial do usuário autenticado.
   * @since v1.0.0
   */
  async setEditorialFeedback(
    questionId: string | number,
    contentType: QuestionEditorialFeedbackKind,
    value: QuestionEditorialFeedbackValue | null,
  ): Promise<QuestionEditorialFeedbackSnapshot> {
    const response = await apiClient.post<QuestionEditorialFeedbackSnapshot>(
      ENDPOINTS.questions.editorialFeedback,
      {
        question_id: String(questionId),
        content_type: contentType,
        value,
      },
    );

    assertApiSuccess(response, 'Não foi possível registrar sua avaliação.');
    return normalizeEditorialFeedbackSnapshot(readApiData<QuestionEditorialFeedbackSnapshot>(response, EMPTY_EDITORIAL_FEEDBACK_SNAPSHOT));
  },

  /**
   * Bridge legado para usos antigos do servico.
   * @since v1.0.0
   */
  async submitAnswer(answer: UserAnswer): Promise<{ success: boolean; message?: string }> {
    try {
      const result = await this.submitUserAnswer(answer);
      return { success: result.success, message: result.message };
    } catch (error: unknown) {
      return { success: false, message: readApiErrorMessage(error, 'Não foi possível salvar a resposta.') };
    }
  },

  /**
   * Cria uma única questão usando o endpoint oficial de persistência.
   * @since v1.0.0
   */
  async createQuestion(questionData: Question): Promise<{ success: boolean; question?: Question }> {
    try {
      const normalizedQuestion = withQuestionPublicationAliases(questionData);
      const canonicalPayload = buildCanonicalQuestionPayload(normalizedQuestion);
      const response = await apiClient.post<QuestionCreateResponse>(
        ENDPOINTS.questions.create,
        canonicalPayload,
      );

      const envelope = assertApiSuccess<QuestionCreateResponse>(response, 'Não foi possível criar a questão.');
      const payload = readApiData<QuestionCreateResponse>(response, {});
      const resolvedId = Number(payload.id ?? envelope.raw.id ?? normalizedQuestion.id) || Number(normalizedQuestion.id);

      return {
        success: true,
        question: payload.question
          ? withQuestionPublicationAliases(payload.question)
          : { ...normalizedQuestion, ...canonicalPayload, id: resolvedId },
      };
    } catch {
      return { success: false };
    }
  },

  /**
   * Cria várias questões preservando o contrato antigo usado pelo app.
   * @since v1.0.0
   */
  async createQuestions(questions: Question[]): Promise<{ success: boolean; count?: number; created?: Question[] }> {
    try {
      let successCount = 0;
      const created: Question[] = [];

      for (const question of questions) {
        const result = await this.createQuestion(question);
        if (result.success && result.question) {
          successCount += 1;
          created.push(result.question);
        }
      }

      return { success: true, count: successCount, created };
    } catch {
      return { success: false };
    }
  },

  /**
   * Envia edital, gabarito ou prova para armazenamento persistente.
   * @since v1.0.0
   */
  async uploadExamFile(file: File, kind: ExamFileKind): Promise<ExamFileAttachment> {
    const formData = new FormData();
    formData.append('kind', kind);
    formData.append('file', file, file.name);

    const response = await apiClient.post<{ file?: ExamFileAttachment }>(
      ENDPOINTS.questions.examFiles,
      formData,
      { timeout: 120000 },
    );
    const envelope = assertApiSuccess<{ file?: ExamFileAttachment }>(response, 'Não foi possível enviar o arquivo da prova.');
    const data = readApiData<{ file?: ExamFileAttachment } | ExamFileAttachment>(response, {});
    const uploaded = toRecord(data) && 'file' in (data as Record<string, unknown>)
      ? (data as { file?: ExamFileAttachment }).file
      : data || envelope.raw.file;
    const attachment = readExamFileAttachment(uploaded, kind);

    if (!attachment.url) {
      throw new Error('O backend não retornou a URL do arquivo.');
    }

    return attachment;
  },

  /**
   * Persiste uma importação oficial de PDF com prova, contextos e questões vinculadas.
   * @since v1.0.0
   */
  async createImportedExam(
    payload: ImportedExamPayload,
  ): Promise<{ success: boolean; message?: string; exam?: Record<string, unknown> }> {
    try {
      const response = await apiClient.post<{ exam?: Record<string, unknown> }>(
        ENDPOINTS.questions.examImport,
        payload,
        { timeout: 30000 },
      );

      const envelope = assertApiSuccess<{ exam?: Record<string, unknown> }>(response, 'Não foi possível salvar a prova.');
      const data = readApiData<{ exam?: Record<string, unknown>; prova?: Record<string, unknown> } | Record<string, unknown>>(response, {});
      const exam = readImportedExamRecord(data) || readImportedExamRecord(envelope.raw);

      return {
        success: true,
        message: envelope.message,
        exam,
      };
    } catch (error: unknown) {
      return {
        success: false,
        message: readApiErrorMessage(error, 'Não foi possível salvar a prova.'),
      };
    }
  },

  /**
   * Persiste uma importação oficial de PDF com prova, contextos e questões vinculadas.
   * @since v1.0.0
   */
  async createImportedQuestionBatch(
    payload: ImportedQuestionBatchPayload,
    proofPdf?: File | null,
  ): Promise<{
    success: boolean;
    message?: string;
    count?: number;
    created?: Question[];
    exam?: Record<string, unknown>;
    duplicatesSkipped?: Array<Record<string, unknown>>;
    skippedDuplicateCount?: number;
    newTaxonomies?: Array<Record<string, unknown>>;
  }> {
    try {
      const formData = new FormData();
      const canonicalPayload = buildPublishedImportedQuestionBatchPayload(payload);
      formData.append('payload', JSON.stringify(canonicalPayload));
      if (proofPdf) {
        formData.append('proof_pdf', proofPdf, proofPdf.name);
      }

      const response = await apiClient.post<ImportedQuestionBatchResponse>(
        ENDPOINTS.questions.bulkImport,
        formData,
        { timeout: 300000 },
      );

      const envelope = assertApiSuccess<ImportedQuestionBatchResponse>(response, 'Não foi possível importar a prova.');
      const raw = envelope.raw as ImportedQuestionBatchResponse;
      const data = readApiData<ImportedQuestionBatchResponse>(response, {} as ImportedQuestionBatchResponse);
      const created = Array.isArray(data.created)
        ? data.created.map((question) => withImportedQuestionAliases(question))
        : [];

      return {
        success: true,
        count: Number(data.count ?? raw.count ?? created.length),
        created,
        exam: readImportedExamRecord(data) || readImportedExamRecord(raw),
        duplicatesSkipped: data.duplicatesSkipped ?? data.duplicates_skipped ?? raw.duplicatesSkipped ?? raw.duplicates_skipped ?? [],
        skippedDuplicateCount: Number(data.skippedDuplicateCount ?? data.skipped_duplicate_count ?? raw.skippedDuplicateCount ?? raw.skipped_duplicate_count ?? 0),
        newTaxonomies: data.newTaxonomies ?? raw.newTaxonomies,
      };
    } catch (error: unknown) {
      const message = error instanceof Error && error.message === 'Network Error'
        ? 'O servidor interrompeu a importação antes de responder. Verifique o limite de upload/tempo do PHP ou reduza imagens muito grandes no lote.'
        : readApiErrorMessage(error, 'Não foi possível importar a prova.');

      return {
        success: false,
        message,
        count: 0,
        created: [],
        duplicatesSkipped: [],
        skippedDuplicateCount: 0,
        newTaxonomies: [],
        exam: undefined,
      };
    }
  },

  /** Persiste lotes de provas distintos em uma unica requisicao administrativa. */
  async createImportedQuestionMultiBatch(batches: Array<{ clientKey: string; payload: ImportedQuestionBatchPayload }>): Promise<{
    success: boolean;
    message?: string;
    count: number;
    skippedDuplicateCount: number;
    itemFailures: Array<Record<string, unknown>>;
    batches: Array<Record<string, unknown>>;
  }> {
    try {
      const response = await apiClient.post<ImportedQuestionMultiBatchResponse>(
        ENDPOINTS.questions.multiBatchImport,
        {
          schemaVersion: 'question-import.v2',
          batches: batches.map(({ clientKey, payload }) => ({
            clientKey,
            payload: buildPublishedImportedQuestionBatchPayload(payload),
          })),
        },
        { timeout: 300000 },
      );
      const envelope = assertApiSuccess<ImportedQuestionMultiBatchResponse>(response, 'Não foi possível publicar as questões selecionadas.');
      const data = readApiData<ImportedQuestionMultiBatchResponse>(response, {} as ImportedQuestionMultiBatchResponse);
      const raw = envelope.raw as ImportedQuestionMultiBatchResponse;
      return {
        success: true,
        message: envelope.message,
        count: Number(data.count ?? raw.count ?? 0),
        skippedDuplicateCount: Number(data.skippedDuplicateCount ?? raw.skippedDuplicateCount ?? 0),
        itemFailures: data.itemFailures ?? raw.itemFailures ?? [],
        batches: Array.isArray(data.batches) ? data.batches : Array.isArray(raw.batches) ? raw.batches : [],
      };
    } catch (error: unknown) {
      return {
        success: false,
        message: readApiErrorMessage(error, 'Não foi possível publicar as questões selecionadas.'),
        count: 0,
        skippedDuplicateCount: 0,
        itemFailures: [],
        batches: [],
      };
    }
  },

  /**
   * Atualiza uma questão usando o endpoint oficial de update.
   * @since v1.0.0
   */
  async updateQuestion(id: string, questionData: Question): Promise<{ success: boolean; question?: Question }> {
    try {
      const normalizedQuestion = withQuestionPublicationAliases(questionData);
      const canonicalPayload = {
        ...buildCanonicalQuestionPayload(normalizedQuestion),
        id,
      };
      const response = await apiClient.post<Question>(
        ENDPOINTS.questions.update,
        canonicalPayload,
      );

      assertApiSuccess(response, 'Não foi possível atualizar a questão.');
      return {
        success: true,
        question: {
          ...normalizedQuestion,
          ...canonicalPayload,
          id: Number(id) || Number(normalizedQuestion.id),
        } as Question,
      };
    } catch {
      return { success: false };
    }
  },

  /**
   * Exclui uma questão usando o contrato real do backend.
   * @since v1.0.0
   */
  async deleteQuestion(id: string | number): Promise<{ success: boolean; message?: string }> {
    try {
      const response = await apiClient.get(
        ENDPOINTS.questions.delete,
        { params: { id: String(id) } },
      );

      const envelope = assertApiSuccess(response, 'Não foi possível excluir a questão.');
      return {
        success: true,
        message: envelope.message,
      };
    } catch (error: unknown) {
      return { success: false, message: readApiErrorMessage(error, 'Não foi possível excluir a questão.') };
    }
  },

  /**
   * Alterna o estado salvo de uma questão para o usuário atual.
   * @since v1.0.0
   */
  async toggleSavedQuestion(
    userId: string,
    questionId: string | number,
    desiredSavedState?: boolean,
  ): Promise<ToggleSavedQuestionResult> {
    try {
      const requestPayload: Record<string, string | number | boolean> = {
        user_id: userId,
        question_id: questionId,
      };
      if (typeof desiredSavedState === 'boolean') {
        requestPayload.is_saved = desiredSavedState;
      }

      const response = await apiClient.post<ToggleSavedQuestionResponse>(
        ENDPOINTS.questions.toggleSave,
        requestPayload,
      );

      const envelope = assertApiSuccess<ToggleSavedQuestionResponse>(response, 'Não foi possível atualizar os salvos.');
      const payload = readApiData<ToggleSavedQuestionResponse>(response, {});
      const raw = toRecord(envelope.raw) || {};
      const resolvedSaved = payload.isSaved ?? payload.is_saved ?? raw.isSaved ?? raw.is_saved;
      const xpGain = Number(payload.xpGain ?? payload.xp_gain ?? raw.xpGain ?? raw.xp_gain);
      const newXp = Number(payload.newXp ?? payload.new_xp ?? raw.newXp ?? raw.new_xp);
      const newLevel = Number(payload.newLevel ?? payload.new_level ?? raw.newLevel ?? raw.new_level);

      return {
        success: true,
        isSaved: typeof resolvedSaved === 'boolean' ? resolvedSaved : undefined,
        message: payload.message || envelope.message,
        xpGain: Number.isFinite(xpGain) ? xpGain : undefined,
        newXp: Number.isFinite(newXp) ? newXp : undefined,
        newLevel: Number.isFinite(newLevel) ? newLevel : undefined,
      };
    } catch (error: unknown) {
      return { success: false, message: readApiErrorMessage(error, 'Não foi possível atualizar os salvos.') };
    }
  },

  /**
   * Limpa o progresso de respostas do usuário atual.
   * @since v1.0.0
   */
  async resetAnswers(userId: string): Promise<{ success: boolean; message?: string }> {
    try {
      const response = await apiClient.post(
        ENDPOINTS.questions.resetAnswers,
        { user_id: userId },
      );

      const envelope = assertApiSuccess(response, 'Não foi possível limpar as respostas.');

      return {
        success: true,
        message: envelope.message,
      };
    } catch (error: unknown) {
      return { success: false, message: readApiErrorMessage(error, 'Não foi possível limpar as respostas.') };
    }
  },
};

export default questionService;
