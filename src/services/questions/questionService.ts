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

type ImportedQuestionBatchPayload = {
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
        body: readText(normalizedQuestion.editorial?.find?.((item) => item.type === 'teacher_comment')?.body ?? normalizedQuestion.editorialComments?.teacherComment ?? normalizedQuestion.teacherComment),
        status: 'draft',
      },
      {
        type: 'detailed_analysis',
        title: '',
        body: readText(normalizedQuestion.editorial?.find?.((item) => item.type === 'detailed_analysis')?.body ?? normalizedQuestion.editorialComments?.detailedComment ?? normalizedQuestion.detailedComment),
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
      const response = await apiClient.get<QuestionPageResponse | Question[]>(
        ENDPOINTS.questions.list,
        {
          params,
        },
      );

      const payload = readApiData<QuestionPageResponse | Question[]>(response, {});
      const rows = Array.isArray(payload)
        ? payload
        : Array.isArray(payload.rows)
          ? payload.rows
          : [];
      const normalizedRows = rows.map((row) => withQuestionPublicationAliases(row));
      const visibleRows = includeUnpublished
        ? normalizedRows
        : normalizedRows.filter((row) => isQuestionPubliclyVisible(row));
      const total = Array.isArray(payload) ? visibleRows.length : Number(payload.total || visibleRows.length);

      return {
        rows: visibleRows,
        total,
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
    const response = await apiClient.get<Question>(
      ENDPOINTS.questions.show,
      {
        params: {
          id: String(questionId),
        },
      },
    );

    return withQuestionPublicationAliases(readApiData<Question>(response, {} as Question));
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
    const response = await apiClient.post<SubmitAnswerApiResponse>(
      ENDPOINTS.questions.submit,
      {
        question_id: answer.questionId,
        selected_option: answer.selectedOptionIndex,
        time_taken: answer.timeTaken || 0,
        simulation_id: (() => {
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
      const canonicalPayload: ImportedQuestionBatchPayload = {
        ...payload,
        questions: payload.questions.map((question) => buildCanonicalQuestionPayload(question as unknown as Question)),
      };
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
  async toggleSavedQuestion(userId: string, questionId: string | number): Promise<ToggleSavedQuestionResult> {
    try {
      const response = await apiClient.post<ToggleSavedQuestionResponse>(
        ENDPOINTS.questions.toggleSave,
        {
          user_id: userId,
          question_id: questionId,
        },
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
