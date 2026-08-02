/*
* ----------------------------------------------------
* @author: 4quarenta
* @author URI: https://github.com/4quarenta
* @copyright: (c) 2026 ConcursoMestre. All rights reserved
* ----------------------------------------------------
*
* @since 1.1.0
*
*/

import type {
  Prova,
  Question,
  QuestionAlternativePayload,
  QuestionFiltersPayload,
  QuestionFilterValuePayload,
  QuestionPayload,
  QuestionTaxonomyLabel,
  SystemSettings,
} from '@types';
import type { PageExtractionResult } from '@services/questions';
import {
  ENEM_FOCUS_NAME,
  ENEM_SUBJECT_AREA_DESCRIPTIONS,
  ENEM_SUBJECT_AREA_OPTIONS,
} from '@services/filters';

import type {
  AiExtractionDecision,
  ExamParserProfile,
  ExtractionFieldMetadata,
  FigureBox,
  ImportDiagnostics,
  ImportMetadata,
  ImportMetadataField,
  ImportedContextDraft,
  ImportedQuestionDraft,
  ImportedQuestionStatus,
  ImportedQuestionStatusReason,
  ImportedQuestionType,
  PdfPageData,
  PdfPageRichText,
  QuestionCreateImportCardParams,
  QuestionExtractionOrigin,
  QuestionExtractionQuality,
} from './adminImportWorkflowParsingCore';

import {
  ENEM_AREA_NORMALIZED_NAMES,
  ENEM_DISCIPLINE_KEYWORDS,
  ENEM_DISCIPLINE_LABELS,
  OPTION_LABELS,
  REFERENCE_BLOCK_PATTERN,
  buildAdaptiveExamParserProfile,
  contextHasPluralQuestionDirective,
  estimatePdfQuestionRegionBox,
  estimatePdfResourceRegionBox,
  extractExplicitContextQuestionNumbers,
  extractInterQuestionSupportContexts,
  extractOptionFragmentsFromText,
  extractOptionsFromText,
  extractQuestionNumbersFromText,
  findQuestionMarkers,
  findSupportContextStartIndex,
  getExpectedOptionsCount,
  hasMeaningfulTextOverlap,
  inferDisciplineFromTextBefore,
  inferExpectedOptionsCountFromText,
  inferQuestionType,
  inferRoleFromFileName,
  inferRolesFromText,
  isLikelyInstructionText,
  isTrueFalseExamText,
  looksLikeBrokenCrossPageContext,
  looksLikeCorruptedLawText,
  looksLikeCorruptedPoemText,
  looksLikeCorruptedTableText,
  looksLikeFlattenedStructuredText,
  mentionsSharedContextWithoutLink,
  mergeExtractionContextList,
  normalizeComparisonText,
  normalizeExpectedOptionsCount,
  normalizeExtractionFigureBox,
  normalizeExtractionFigureBoxes,
  normalizeImportedOptions,
  normalizeOrganizationList,
  normalizePdfTextForParsing,
  normalizeQuestionMarkerText,
  normalizeQuestionNumber,
  normalizeRoleList,
  pageLikelyHasFigure,
  questionCommandPattern,
  readLooseField,
  readOptionMarkers,
  referencedResourceKinds,
  resolveExamParserProfile,
  resolveScopedContextQuestionNumbers,
  sanitizeReferenceTextForImport,
  sanitizeSupportContextText,
  shouldPromoteAsSupportContext,
  slugify,
  splitNamedSupportContexts,
  splitQuestionSupportReference,
  stripHtml,
  summarizeExamTitleList,
  summarizeRoleList,
  supportContextSignalPattern,
  textNeedsExternalSupportContext,
  toLooseRecord,
} from './adminImportWorkflowParsingCore';

export const validateExtractedQuestionDraft = ({
  statement,
  options,
  expectedOptionsCount,
  questionType,
  rawText,
  hasFigure,
  figureBox,
  contextKey,
  supportText,
}: {
  statement: string;
  options: string[];
  expectedOptionsCount: number;
  questionType: ImportedQuestionType;
  rawText: string;
  hasFigure?: boolean;
  figureBox?: FigureBox;
  contextKey?: string;
  supportText?: string;
}): { status: ImportedQuestionStatus; reasons: ImportedQuestionStatusReason[] } => {
  const reasons: ImportedQuestionStatusReason[] = [];
  const cleanStatement = stripHtml(statement).replace(/\s+/g, ' ').trim();
  const cleanRaw = stripHtml(rawText).replace(/\s+/g, ' ').trim();
  const cleanSupportText = stripHtml(supportText || '').replace(/\s+/g, ' ').trim();
  const resourceKinds = referencedResourceKinds(cleanStatement, cleanRaw);
  const hasContextOrSupport = Boolean(String(contextKey || '').trim() || cleanSupportText.length >= 20);
  const hasVisualResource = Boolean(hasFigure && figureBox);

  if (cleanStatement.length < 12) {
    reasons.push('sem_enunciado');
    reasons.push('questao_sem_enunciado');
  }
  if (
    ['multipla escolha', 'multipla assertiva', 'somatorio'].includes(questionType)
    || (expectedOptionsCount > 0 && !['certo ou errado', 'verdadeiro/falso', 'discursiva', 'redacao', 'estudo de caso'].includes(questionType))
  ) {
    if (options.length === 0) {
      reasons.push('sem_alternativas');
    } else if (options.length < expectedOptionsCount) {
      reasons.push('alternativas_incompletas');
    }
  }
  if (
    questionType === 'desconhecido'
    && options.length === 0
    && /\b(?:alternativas?|assinale|marque|op[cç][aã]o|op[cç][oõ]es)\b/i.test(cleanRaw)
  ) {
    reasons.push('sem_alternativas');
  }
  if (questionType === 'desconhecido') {
    reasons.push('tipo_indefinido');
  }
  if (
    cleanStatement.length > 650
    && /\b(?:texto\s+[ivxlc]+|leia\s+o\s+texto|considere\s+o\s+texto|para\s+responder|fonte\s*:|dispon[ií]vel\s+em)\b/i.test(cleanStatement)
  ) {
    reasons.push('possivel_texto_base_misturado');
  }
  if (hasFigure && !figureBox && !String(contextKey || '').trim()) {
    reasons.push('figura_sem_recorte');
  }
  if (resourceKinds.figure && !hasVisualResource && !String(contextKey || '').trim()) {
    reasons.push('figura_referenciada_nao_encontrada');
    reasons.push('figura_sem_recorte');
  }
  if (resourceKinds.table && !hasVisualResource && !hasContextOrSupport) {
    reasons.push('tabela_referenciada_nao_encontrada');
    reasons.push('tabela_visual_sem_recorte');
  }
  if (resourceKinds.text && !hasContextOrSupport) {
    reasons.push('texto_apoio_referenciado_nao_encontrado');
  }
  if (
    textNeedsExternalSupportContext(cleanStatement, cleanRaw)
    && !String(contextKey || '').trim()
    && cleanSupportText.length < 40
  ) {
    reasons.push('contexto_referenciado_nao_encontrado');
  }
  if (options.some((option) => REFERENCE_BLOCK_PATTERN.test(stripHtml(option)))) {
    reasons.push('referencia_possivelmente_misturada');
  }
  if (looksLikeFlattenedStructuredText(supportText || '') || looksLikeFlattenedStructuredText(statement)) {
    reasons.push('estrutura_texto_achatada');
  }
  if (looksLikeCorruptedTableText(statement, supportText || '', rawText)) {
    reasons.push('tabela_corrompida');
  }
  if (looksLikeCorruptedPoemText(statement, supportText || '', rawText)) {
    reasons.push('poema_corrompido');
  }
  if (looksLikeCorruptedLawText(statement, supportText || '', rawText)) {
    reasons.push('lei_corrompida');
  }
  if (mentionsSharedContextWithoutLink(rawText, contextKey)) {
    reasons.push('contexto_compartilhado_nao_vinculado');
  }
  if (looksLikeBrokenCrossPageContext(rawText, contextKey)) {
    reasons.push('contexto_quebrado_entre_paginas');
  }

  const uniqueReasons = Array.from(new Set(reasons));
  const status: ImportedQuestionStatus = uniqueReasons.length === 0
    ? 'ok'
    : uniqueReasons.some((reason) => ['sem_enunciado', 'questao_sem_enunciado', 'sem_alternativas', 'alternativas_incompletas'].includes(reason))
      ? 'incompleta'
      : 'revisar';

  return { status, reasons: uniqueReasons };
};

export const getQuestionExpectedOptionsCount = (question: Question) => {
  const record = question as unknown as {
    tipo?: unknown;
    modality?: unknown;
    expectedOptionsCount?: unknown;
    expected_options_count?: unknown;
    bancas?: unknown[];
    banca?: unknown;
  };
  const agencySignal = [
    ...(Array.isArray(record.bancas) ? record.bancas : []),
    record.banca,
  ].map((item) => getTaxonomyText(item as QuestionTaxonomyLabel)).join(' ');
  const explicitCount = Number(record.expectedOptionsCount ?? record.expected_options_count);
  if (Number.isFinite(explicitCount) && explicitCount >= 2) {
    return explicitCount;
  }
  const modality = String(record.tipo || record.modality || '').toLowerCase();
  if (modality.includes('certo') || modality.includes('verdadeiro')) {
    return 2;
  }
  const actualOptionsCount = Array.isArray(question.itens)
    ? question.itens.map((item) => String(item.corpo || '').trim()).filter(Boolean).length
    : 0;
  if (actualOptionsCount >= 2) {
    return actualOptionsCount;
  }
  if (isPlaceholderQuestion(question) || inferQuestionExtractionOrigin(question) === 'manual') {
    return Array.isArray(question.itens) ? question.itens.length : 0;
  }
  return getExpectedOptionsCount(
    record.tipo || record.modality,
    record.expectedOptionsCount ?? record.expected_options_count,
    resolveExamParserProfile(agencySignal),
  );
};

export const getQuestionIntroText = (question: Question) => {
  const draft = question as unknown as ImportedQuestionDraft & { intro_text?: string };
  return String(question.content?.supportText || draft.introText || draft.intro_text || '').trim();
};

export const getQuestionReferenceText = (question: Question) => {
  const draft = question as unknown as ImportedQuestionDraft & { reference_text?: string };
  return String(question.content?.reference || draft.referenceText || draft.reference_text || '').trim();
};

export const getQuestionStatementText = (question: Question) => (
  String(question.content?.statement || question.enunciado || (question as unknown as { text?: string }).text || '').trim()
);

export const getQuestionOptionTexts = (question: Question) => (
  Array.isArray(question.alternatives) && question.alternatives.length
    ? question.alternatives.map((item) => String(item.text || '').trim()).filter(Boolean)
    : Array.isArray(question.itens)
    ? question.itens.map((item) => String(item.corpo || '').trim()).filter(Boolean)
    : Array.isArray((question as unknown as ImportedQuestionDraft).options)
      ? ((question as unknown as ImportedQuestionDraft).options || [])
        .map((item) => String(item || '').trim())
        .filter(Boolean)
      : []
);

export const hasVisualOptionPayload = (question: Question) => (
  (Array.isArray(question.itens) ? question.itens : []).some((item) => {
    const record = item as unknown as { imageData?: unknown; pageImageData?: unknown };
    const body = String(item.corpo || '');
    return Boolean(record.imageData || record.pageImageData || /<img\b|data:image\/|Alternativa visual/i.test(body));
  })
);

export const buildFinalQuestionReviewRawText = (question: Question) => {
  const draft = question as unknown as ImportedQuestionDraft;
  const parts = [
    String(draft.text || '').trim(),
    getQuestionIntroText(question),
    getQuestionReferenceText(question),
    getQuestionStatementText(question),
    getQuestionOptionTexts(question).map((option, index) => `${String.fromCharCode(65 + index)}) ${stripHtml(option)}`).join('\n'),
  ];
  const seen = new Set<string>();
  return parts
    .map((part) => part.replace(/\s+/g, ' ').trim())
    .filter(Boolean)
    .filter((part) => {
      const key = normalizeComparisonText(part);
      if (!key || seen.has(key)) {
        return false;
      }
      seen.add(key);
      return true;
    })
    .join('\n\n');
};

export const getReliableExtractedQuestionNumber = (question: Question) => {
  const record = question as Question & {
    questionNumber?: number | string;
    question_number?: number | string;
    number?: number | string;
  };
  return normalizeQuestionNumber(record.questionNumber ?? record.question_number ?? record.number, 0);
};

export const inferQuestionExtractionOrigin = (question: Question): QuestionExtractionOrigin => {
  const draft = question as unknown as ImportedQuestionDraft;
  const existingOrigin = draft.qualityReport?.origin || draft.extractionQuality?.origin;
  if (existingOrigin) {
    return existingOrigin;
  }

  const origins = new Set(
    Object.values({
      ...(draft.fieldMetadata || {}),
      ...(draft.extractionFieldMetadata || {}),
    })
      .map((metadata) => metadata?.origin)
      .filter(Boolean),
  );
  if (origins.has('manual')) {
    return 'manual';
  }
  if (origins.has('mechanical') && origins.has('ai')) {
    return 'hybrid';
  }
  if (origins.has('ai')) {
    return 'ai';
  }
  return 'mechanical';
};

export const isPlaceholderQuestion = (question: Question) => {
  const draft = question as unknown as ImportedQuestionDraft;
  return draft.qualityReport?.origin === 'placeholder'
    || draft.extractionQuality?.origin === 'placeholder'
    || (draft.statusReasons || []).includes('questao_placeholder_criada');
};

export const buildQuestionExtractionQuality = (
  question: Question,
  duplicate = false,
): QuestionExtractionQuality => {
  const draft = question as unknown as ImportedQuestionDraft;
  const questionNumber = getReliableExtractedQuestionNumber(question);
  const statement = stripHtml(getQuestionStatementText(question)).replace(/\s+/g, ' ').trim();
  const supportText = stripHtml(getQuestionIntroText(question)).replace(/\s+/g, ' ').trim();
  const referenceText = stripHtml(getQuestionReferenceText(question)).replace(/\s+/g, ' ').trim();
  const rawText = stripHtml(String(draft.raw || draft.text || '')).replace(/\s+/g, ' ').trim();
  const options = getQuestionOptionTexts(question);
  const expectedOptionsCount = getQuestionExpectedOptionsCount(question);
  const reasons = Array.from(new Set([
    ...(draft.statusReasons || []),
    ...(draft.validationReasons || []),
    ...(draft.rejectionReason ? [draft.rejectionReason] : []),
    ...(duplicate ? ['numero_duplicado'] : []),
  ].filter(Boolean)));
  const origin = inferQuestionExtractionOrigin(question);
  const probablePages = Array.from(new Set(
    [
      ...(draft.qualityReport?.probablePages || []),
      ...(draft.extractionQuality?.probablePages || []),
      Number(draft.sourcePage || 0),
    ].filter((page) => Number.isFinite(page) && Number(page) > 0).map(Number),
  )).sort((left, right) => left - right);
  const hasRealContent = statement.length >= 8
    || supportText.length >= 20
    || referenceText.length >= 20
    || rawText.length >= 12
    || options.length > 0
    || Boolean(draft.hasFigure || draft.figureBox || draft.supportFigureBox || draft.optionFigureBox);
  const localized = origin !== 'placeholder' && questionNumber > 0 && hasRealContent;
  const status = draft.extractionStatus || draft.status || 'revisar';
  const optionsComplete = expectedOptionsCount <= 0 || options.length >= expectedOptionsCount;
  const complete = localized
    && status === 'ok'
    && statement.length >= 12
    && optionsComplete
    && !duplicate;
  const metadataValues = Object.values({
    ...(draft.fieldMetadata || {}),
    ...(draft.extractionFieldMetadata || {}),
  }).filter((metadata): metadata is ExtractionFieldMetadata => Boolean(metadata));
  const metadataConfidence = metadataValues.length > 0
    ? metadataValues.reduce((sum, metadata) => sum + Number(metadata.confidence || 0), 0) / metadataValues.length
    : 0;
  const confidence = Math.max(0, Math.min(1,
    metadataConfidence
    || (complete ? 0.92 : localized ? 0.62 : 0.2),
  ));
  const normalizedReasons = reasons.length > 0
    ? reasons
    : complete
      ? []
      : localized
        ? ['estrutura_incompleta_ou_ambigua']
        : ['questao_nao_localizada'];

  return {
    origin,
    confidence,
    complete,
    localized,
    needsReview: !complete,
    reasons: normalizedReasons,
    probablePages: probablePages.length > 0 ? probablePages : undefined,
  };
};

export const auditQuestionCoverage = (
  questions: Question[],
  expectedQuestionNumbers: number[],
) => {
  const numberCounts = new Map<number, number>();
  questions.forEach((question) => {
    const number = getReliableExtractedQuestionNumber(question);
    if (number > 0) {
      numberCounts.set(number, (numberCounts.get(number) || 0) + 1);
    }
  });
  const duplicateQuestionNumbers = Array.from(numberCounts.entries())
    .filter(([, count]) => count > 1)
    .map(([number]) => number)
    .sort((left, right) => left - right);
  const duplicateSet = new Set(duplicateQuestionNumbers);
  const auditedQuestions = questions.map((question) => {
    const number = getReliableExtractedQuestionNumber(question);
    const quality = buildQuestionExtractionQuality(question, duplicateSet.has(number));
    return {
      ...(question as unknown as ImportedQuestionDraft),
      qualityReport: quality,
      extractionQuality: quality,
    } as unknown as Question;
  });
  const localizedQuestionNumbers = auditedQuestions
    .filter((question) => (question as unknown as ImportedQuestionDraft).qualityReport?.localized)
    .map(getReliableExtractedQuestionNumber)
    .filter((number, index, list) => number > 0 && list.indexOf(number) === index)
    .sort((left, right) => left - right);
  const completeQuestionNumbers = auditedQuestions
    .filter((question) => (question as unknown as ImportedQuestionDraft).qualityReport?.complete)
    .map(getReliableExtractedQuestionNumber)
    .filter((number, index, list) => number > 0 && list.indexOf(number) === index)
    .sort((left, right) => left - right);
  const placeholderQuestionNumbers = auditedQuestions
    .filter((question) => isPlaceholderQuestion(question))
    .map(getReliableExtractedQuestionNumber)
    .filter((number, index, list) => number > 0 && list.indexOf(number) === index)
    .sort((left, right) => left - right);
  const incompleteQuestionNumbers = auditedQuestions
    .filter((question) => {
      const quality = (question as unknown as ImportedQuestionDraft).qualityReport;
      return Boolean(quality?.localized && !quality.complete);
    })
    .map(getReliableExtractedQuestionNumber)
    .filter((number, index, list) => number > 0 && list.indexOf(number) === index)
    .sort((left, right) => left - right);
  const missingQuestionNumbers = expectedQuestionNumbers
    .filter((number) => !localizedQuestionNumbers.includes(number));
  const visualPendingQuestionNumbers = auditedQuestions
    .filter((question) => {
      const quality = (question as unknown as ImportedQuestionDraft).qualityReport;
      return quality?.needsReview
        && quality.reasons.some((reason) => reason === 'figura_sem_recorte' || reason.includes('visual'));
    })
    .map(getReliableExtractedQuestionNumber)
    .filter((number, index, list) => number > 0 && list.indexOf(number) === index)
    .sort((left, right) => left - right);
  const suspiciousQuestionNumbers = auditedQuestions
    .filter((question) => (question as unknown as ImportedQuestionDraft).qualityReport?.needsReview)
    .map(getReliableExtractedQuestionNumber)
    .filter((number, index, list) => number > 0 && list.indexOf(number) === index)
    .sort((left, right) => left - right);

  return {
    questions: auditedQuestions,
    expectedQuestionNumbers,
    extractedQuestionNumbers: localizedQuestionNumbers,
    localizedQuestionNumbers,
    completeQuestionNumbers,
    incompleteQuestionNumbers,
    missingQuestionNumbers,
    placeholderQuestionNumbers,
    visualPendingQuestionNumbers,
    duplicateQuestionNumbers,
    suspiciousQuestionNumbers,
    cardsCreatedCount: auditedQuestions.length,
    completeCardsCount: completeQuestionNumbers.length,
    incompleteCardsCount: incompleteQuestionNumbers.filter((number) => !placeholderQuestionNumbers.includes(number)).length,
    placeholderCardsCount: placeholderQuestionNumbers.length,
  };
};

export const getQuestionPublicationBlockReasons = (question: Question) => {
  const draft = question as unknown as ImportedQuestionDraft;
  const statement = stripHtml(getQuestionStatementText(question)).replace(/\s+/g, ' ').trim();
  const options = getQuestionOptionTexts(question);
  const type = String(question.tipo || draft.modality || draft.questionType || '').toLowerCase();
  const expectedOptionsCount = getQuestionExpectedOptionsCount(question);
  const correctOptionIndex = Number(draft.correctOptionIndex);
  const response = Number(question.resposta);
  const reasons: string[] = [];

  if (statement.length < 12) reasons.push('enunciado_ausente');
  if (!type || type === 'desconhecido') reasons.push('tipo_indefinido');
  if (!['discursiva', 'redacao', 'estudo de caso'].includes(type)) {
    if (options.length < 2) reasons.push('alternativas_ausentes');
    else if (expectedOptionsCount > 0 && options.length < expectedOptionsCount) reasons.push('alternativas_incompletas');
    const hasValidAnswer = (Number.isInteger(correctOptionIndex) && correctOptionIndex >= 0 && correctOptionIndex < options.length)
      || (Number.isInteger(response) && response > 0 && response <= options.length)
      || Boolean(question.anulada || question.isCanceled || draft.isAttributedToAll || draft.attributedToAll);
    if (!hasValidAnswer) reasons.push('gabarito_ausente');
  }

  return Array.from(new Set(reasons));
};

export const isQuestionReadyForImportPublication = (question: Question) => (
  getQuestionPublicationBlockReasons(question).length === 0
);

export const publishSelectedImportQuestionEntries = async ({
  indexes,
  questions,
  publishedQuestionNumbers,
  getQuestionNumber,
  onSkipped,
  onEmpty,
  publish,
}: {
  indexes: number[];
  questions: Question[];
  publishedQuestionNumbers: number[];
  getQuestionNumber: (question: Question, fallback: number) => number;
  onSkipped: (skippedCount: number, readyCount: number) => void;
  onEmpty: (emptySelection: boolean) => void;
  publish: (entries: Array<{ question: Question; index: number }>) => Promise<void>;
}) => {
  const selectedIndexes = Array.from(new Set(indexes))
    .filter((index) => Number.isInteger(index) && index >= 0 && index < questions.length);
  const publishedSet = new Set(publishedQuestionNumbers);
  const selectedEntries = selectedIndexes
    .map((index) => ({ question: questions[index], index }))
    .filter(({ question, index }) => Boolean(question) && !publishedSet.has(getQuestionNumber(question, index + 1)));
  const entries = selectedEntries.filter(({ question }) => isQuestionReadyForImportPublication(question));
  const skippedEntries = selectedEntries.filter(({ question }) => !isQuestionReadyForImportPublication(question));

  if (skippedEntries.length > 0) onSkipped(skippedEntries.length, entries.length);
  if (entries.length === 0) {
    onEmpty(selectedIndexes.length === 0);
    return;
  }

  await publish(entries);
};

export const refreshManuallyEditedImportQuestion = (question: Question): Question => {
  const draft = question as unknown as ImportedQuestionDraft;
  const publicationReasons = getQuestionPublicationBlockReasons(question);
  const retainedReasons = (draft.statusReasons || []).filter((reason) => ![
    'questao_nao_localizada',
    'questao_placeholder_criada',
    'enunciado_ausente',
    'alternativas_ausentes',
    'conteudo_nao_extraido',
    'aguardando_complemento_manual',
    'parser_mecanico_sem_correspondencia',
    'gabarito_indica_existencia',
  ].includes(reason));
  const reasons = Array.from(new Set([
    ...retainedReasons,
    ...publicationReasons.filter((reason): reason is ImportedQuestionStatusReason => (
      ['enunciado_ausente', 'alternativas_ausentes', 'alternativas_incompletas', 'tipo_indefinido'].includes(reason)
    )),
  ]));
  const complete = publicationReasons.length === 0;
  const localized = stripHtml(getQuestionStatementText(question)).trim().length > 0
    || getQuestionOptionTexts(question).length > 0
    || Boolean(draft.hasFigure || draft.figureBox || draft.supportFigureBox || draft.optionFigureBox);
  const quality: QuestionExtractionQuality = {
    origin: 'manual',
    confidence: complete ? 1 : localized ? 0.75 : 0.25,
    localized,
    complete,
    needsReview: !complete,
    reasons,
    probablePages: draft.qualityReport?.probablePages || draft.extractionQuality?.probablePages,
  };

  return {
    ...question,
    status: complete ? 'ok' : 'incompleta',
    extractionStatus: complete ? 'ok' : 'incompleta',
    needsImportReview: !complete,
    statusReasons: reasons,
    validationReasons: reasons,
    rejectionReason: reasons[0] || '',
    qualityReport: quality,
    extractionQuality: quality,
  } as unknown as Question;
};

export const shouldRunFinalQuestionPartsReview = (question: Question) => {
  const statement = stripHtml(getQuestionStatementText(question)).replace(/\s+/g, ' ').trim();
  const introText = stripHtml(getQuestionIntroText(question)).replace(/\s+/g, ' ').trim();
  const referenceText = stripHtml(getQuestionReferenceText(question)).replace(/\s+/g, ' ').trim();
  const options = getQuestionOptionTexts(question);
  const expectedOptionsCount = getQuestionExpectedOptionsCount(question);
  const optionMarkers = readOptionMarkers(statement);
  const hasReferenceInsideStatement = /\b(?:Dispon[ií]vel em|Acesso em|Fonte|et al\.|Revista|Journal|adaptad[ao]|fragmento)\b/i
    .test(statement);
  const hasDuplicatedSupport = Boolean(introText) && hasMeaningfulTextOverlap(statement, introText);
  const hasDuplicatedReference = Boolean(referenceText) && hasMeaningfulTextOverlap(statement, referenceText);
  const hasOptionsInsideStatement = optionMarkers.length >= Math.min(3, expectedOptionsCount)
    && options.length < expectedOptionsCount;
  const hasSuspiciousLongStatement = statement.length > 850 && options.length < expectedOptionsCount;

  return Boolean(statement)
    && (
      hasReferenceInsideStatement
      || hasDuplicatedSupport
      || hasDuplicatedReference
      || hasOptionsInsideStatement
      || hasSuspiciousLongStatement
    );
};

export const getImportedQuestionNumber = (question: Question, fallback: number): number => {
  const draft = question as unknown as ImportedQuestionDraft;
  const record = question as unknown as Record<string, unknown>;
  const rawNumber = draft.questionNumber
    ?? draft.number
    ?? record.question_number
    ?? record.sourceQuestionNumber
    ?? record.source_question_number;
  const numericNumber = Number(rawNumber);
  return Number.isFinite(numericNumber) && numericNumber > 0 ? numericNumber : fallback;
};

export const getPublishedExamId = (exam: Record<string, unknown> | null | undefined) => (
  exam?.id
  ?? exam?.provaId
  ?? exam?.prova_id
  ?? exam?.exam_id
  ?? exam?.publishedExamId
  ?? exam?.published_exam_id
);

export const getPublishedQuestionNumberFromRecord = (value: unknown, fallback = 0) => {
  const record = toLooseRecord(value);
  if (!record) {
    return fallback;
  }

  const rawNumber = record.questionNumber
    ?? record.question_number
    ?? record.number
    ?? record.sourceQuestionNumber
    ?? record.source_question_number;
  const numericNumber = Number(String(rawNumber ?? '').match(/\d+/)?.[0] || 0);
  return Number.isFinite(numericNumber) && numericNumber > 0 ? numericNumber : fallback;
};

export const completeQuestionOptionsFromPrefix = (question: Question, prefixText: string) => {
  const expectedOptionsCount = getQuestionExpectedOptionsCount(question);
  const currentItems = Array.isArray(question.itens) ? question.itens : [];
  if (currentItems.length >= expectedOptionsCount) {
    return null;
  }

  const fragments = extractOptionFragmentsFromText(prefixText, expectedOptionsCount);
  if (fragments.optionsByLabel.size === 0) {
    return null;
  }

  const labels = OPTION_LABELS;
  const itemByLabel = new Map<string, NonNullable<Question['itens']>[number]>();
  currentItems.forEach((item, index) => {
    const label = String(item.rotulo || labels[index] || '').toUpperCase();
    if (label) {
      itemByLabel.set(label, item);
    }
  });

  labels.slice(0, expectedOptionsCount).forEach((label, index) => {
    if (!itemByLabel.has(label) && fragments.optionsByLabel.has(label)) {
      const option = fragments.optionsByLabel.get(label) || '';
      itemByLabel.set(label, {
        id: index + 1,
        ordem: index + 1,
        rotulo: label,
        corpo: option,
        corpo_clean: stripHtml(option),
      });
    }
  });

  const nextItems = labels
    .slice(0, expectedOptionsCount)
    .map((label, index) => {
      const item = itemByLabel.get(label);
      return item ? { ...item, id: index + 1, ordem: index + 1, rotulo: label } : null;
    })
    .filter(Boolean) as NonNullable<Question['itens']>;

  if (nextItems.length <= currentItems.length) {
    return null;
  }

  return {
    ...question,
    itens: nextItems,
    needsImportReview: nextItems.length < expectedOptionsCount,
  } as Question;
};

export const answerLetterToIndex = (value: string) => {
  const letter = String(value || '').trim().toUpperCase();
  const index = OPTION_LABELS.indexOf(letter);
  return index >= 0 ? index : null;
};

export const normalizeComparableText = (value: string) => String(value || '')
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .replace(/[^a-z0-9]+/gi, ' ')
  .replace(/\s+/g, ' ')
  .trim()
  .toUpperCase();

export const normalizeAnswerKeyRoleTargets = (targetRole: string | string[] = '') => {
  const roleCandidates = normalizeRoleList(targetRole);
  const rawCandidates = Array.isArray(targetRole) ? targetRole : [targetRole];
  const candidates = roleCandidates.length > 0 ? roleCandidates : rawCandidates;

  return candidates
    .map((role) => normalizeComparableText(String(role || '')))
    .filter((role, index, list) => role.length > 0 && list.indexOf(role) === index);
};

export const pickAnswerKeySection = (text: string, targetRole: string | string[] = '') => {
  const roles = normalizeAnswerKeyRoleTargets(targetRole);
  if (roles.length === 0) {
    return text;
  }

  const cargoMatches = Array.from(text.matchAll(/\bCARGO\s*:\s*/gi));
  if (cargoMatches.length === 0) {
    return text;
  }

  const sections = cargoMatches.map((match, index) => {
    const start = match.index ?? 0;
    const next = cargoMatches[index + 1];
    const end = next?.index ?? text.length;
    const section = text.slice(start, end);
    const firstAnswer = section.search(new RegExp(`\\b\\d{1,3}\\s*(?:${ANSWER_KEY_TOKEN_PATTERN_SOURCE})`, 'i'));
    const title = firstAnswer > 0 ? section.slice(0, firstAnswer) : section.slice(0, 140);
    return { title, section };
  });

  const exact = sections.find((section) => {
    const title = normalizeComparableText(section.title);
    return roles.some((role) => title.includes(role));
  });
  if (exact) {
    return exact.section;
  }

  const scored = sections
    .map((section) => {
      const title = normalizeComparableText(section.title);
      const scores = roles.map((role) => {
        const roleWords = role.split(' ').filter((word) => word.length > 2);
        const score = roleWords.filter((word) => title.includes(word)).length;
        const requiredScore = roleWords.length > 1 ? Math.max(2, roleWords.length) : 1;
        return { score, requiredScore };
      });
      const best = scores.sort((left, right) => right.score - left.score)[0] || { score: 0, requiredScore: 1 };
      return {
        ...section,
        score: best.score,
        requiredScore: best.requiredScore,
      };
    })
    .sort((left, right) => right.score - left.score);

  const bestSection = scored[0];
  return bestSection && bestSection.score >= bestSection.requiredScore ? bestSection.section : '';
};

export const shouldUseAnswerKeyPage = (text: string, targetRole: string | string[] = '') => {
  const roles = normalizeAnswerKeyRoleTargets(targetRole);
  if (roles.length === 0) {
    return true;
  }

  const normalized = normalizeComparableText(text);
  const hasRoleMatch = roles.some((role) => {
    const roleWords = role.split(' ').filter((word) => word.length > 2);
    const matchedRoleWords = roleWords.filter((word) => normalized.includes(word)).length;
    const requiredRoleScore = roleWords.length > 1 ? Math.max(2, Math.ceil(roleWords.length * 0.6)) : 1;

    return matchedRoleWords >= requiredRoleScore;
  });

  if (hasRoleMatch) {
    return true;
  }

  if (
    normalized.includes('CONHECIMENTOS GERAIS')
    && normalized.includes('NIVEL SUPERIOR')
    && roles.some((role) => role.includes('TENENTE') || role.includes('SUPERIOR') || role.includes('CIRURGIAO') || role.includes('MEDICO'))
  ) {
    return true;
  }

  if (
    normalized.includes('CONHECIMENTOS GERAIS')
    && normalized.includes('NIVEL MEDIO')
    && roles.some((role) => role.includes('SOLDADO') || role.includes('MEDIO'))
  ) {
    return true;
  }

  if (/\bCARGO\s+\d+\b/.test(normalized) || /\bCARGO\s*:/.test(normalized)) {
    return false;
  }

  return !normalized.includes('GABARITOS OFICIAIS');
};

export const ATTRIBUTED_TO_ALL_ANSWER_INDEX = -2;
export const CANCELED_ANSWER_INDEX = -1;
export const ANSWER_KEY_TOKEN_PATTERN_SOURCE = String.raw`ATRIBU[IÍ]D[AO]S?\s+A\s+TODOS|QUEST[AÃ]O\s+ANULAD[AO]|QUEST[AÃ]O\s+CANCELAD[AO]|ANULAD[OA]|CANCELAD[OA]|\b(?:TODOS|[A-F]|X|T)\b|\*`;

export const convertAnswerTokenToIndex = (value: string, trueFalseMode: boolean) => {
  const rawAnswer = String(value || '').toUpperCase().replace(/\s+/g, ' ').trim();
  const normalizedAnswer = normalizeComparisonText(rawAnswer);
  if (
    normalizedAnswer === 't'
    || normalizedAnswer === 'todos'
    || normalizedAnswer.includes('atribuida a todos')
    || normalizedAnswer.includes('atribuidos a todos')
  ) {
    return ATTRIBUTED_TO_ALL_ANSWER_INDEX;
  }
  if (
    rawAnswer === '*'
    || rawAnswer === 'X'
    || normalizedAnswer.startsWith('anulad')
    || normalizedAnswer.startsWith('questao anulad')
    || normalizedAnswer.startsWith('cancelad')
    || normalizedAnswer.startsWith('questao cancelad')
  ) {
    return CANCELED_ANSWER_INDEX;
  }
  if (trueFalseMode) {
    if (rawAnswer === 'C') return 0;
    if (rawAnswer === 'E') return 1;
    return null;
  }
  return answerLetterToIndex(rawAnswer);
};

export const parseAnswerEntries = (text: string) => {
  const normalizedText = text
    .replace(new RegExp(`\\b(\\d{2})\\s+(\\d)\\s+(?=${ANSWER_KEY_TOKEN_PATTERN_SOURCE})`, 'gi'), '$1$2 ');
  const directEntries = Array.from(normalizedText.matchAll(new RegExp(`(?:quest[aã]o\\s*)?(\\d{1,3})\\s*(?:[-.:)]\\s*)?(${ANSWER_KEY_TOKEN_PATTERN_SOURCE})(?=\\s|$)`, 'gi')))
    .map((entry) => ({ number: Number(entry[1]), answer: String(entry[2] || '').toUpperCase().replace(/\s+/g, ' ').trim() }));

  const tokens = Array.from(normalizedText.matchAll(new RegExp(`\\d{1,3}|${ANSWER_KEY_TOKEN_PATTERN_SOURCE}`, 'gi')))
    .map((match) => String(match[0]).toUpperCase().replace(/\s+/g, ' ').trim());
  const tableEntries: Array<{ number: number; answer: string }> = [];

  for (let index = 0; index < tokens.length; index += 1) {
    const firstNumber = Number(tokens[index]);
    if (!Number.isFinite(firstNumber) || firstNumber <= 0 || firstNumber >= 500) {
      continue;
    }

    const numbers = [firstNumber];
    let cursor = index + 1;
    while (cursor < tokens.length) {
      const nextNumber = Number(tokens[cursor]);
      if (!Number.isFinite(nextNumber) || nextNumber !== numbers[numbers.length - 1] + 1) {
        break;
      }
      numbers.push(nextNumber);
      cursor += 1;
    }

    if (numbers.length < 5) {
      continue;
    }

    const answers: string[] = [];
    while (cursor < tokens.length && answers.length < numbers.length && new RegExp(`^(?:${ANSWER_KEY_TOKEN_PATTERN_SOURCE})$`, 'i').test(tokens[cursor])) {
      answers.push(tokens[cursor]);
      cursor += 1;
    }

    if (answers.length >= numbers.length) {
      numbers.forEach((number, numberIndex) => {
        tableEntries.push({ number, answer: answers[numberIndex] });
      });
      index = cursor - 1;
    }
  }

  return [...directEntries, ...tableEntries]
    .filter((entry) => Number.isFinite(entry.number) && entry.number > 0 && entry.number < 500);
};

export const parseAnswerKeyFromText = (value: string, targetRole: string | string[] = ''): Record<number, number> => {
  const text = pickAnswerKeySection(String(value || '').replace(/\s+/g, ' ').trim(), targetRole);
  const entries = parseAnswerEntries(text);
  const trueFalseMode = entries.length >= 20
    && entries.every((entry) => (
      ['C', 'E', 'X', '*', 'T', 'TODOS', 'ANULADA', 'ANULADO', 'CANCELADA', 'CANCELADO'].includes(entry.answer)
      || normalizeComparisonText(entry.answer).includes('atribuida a todos')
    ));
  const result: Record<number, number> = {};

  entries.forEach((entry) => {
    const number = Number(entry.number);
    const index = convertAnswerTokenToIndex(entry.answer, trueFalseMode);
    if (!Number.isFinite(number) || number <= 0 || number >= 500 || index === null) {
      return;
    }
    if (result[number] === undefined) {
      result[number] = index;
    }
  });

  return result;
};

export const BOOKLET_COLOR_LABELS: Array<[RegExp, string]> = [
  [/\bamarel[oa]\b/, 'Amarelo'],
  [/\bazul\b/, 'Azul'],
  [/\brosa\b/, 'Rosa'],
  [/\bbranc[oa]\b/, 'Branco'],
  [/\bcinza\b/, 'Cinza'],
  [/\bverde\b/, 'Verde'],
  [/\blaranja\b/, 'Laranja'],
  [/\brox[oa]\b/, 'Roxo'],
  [/\bpret[oa]\b/, 'Preto'],
];

export const normalizeBookletType = (value: unknown) => {
  const clean = String(value || '').replace(/[_-]+/g, ' ').replace(/\s+/g, ' ').trim();
  if (!clean) {
    return '';
  }

  const letter = clean.match(/^(?:tipo\s*)?([A-Z])$/i)?.[1];
  if (letter) {
    return `Tipo ${letter.toUpperCase()}`;
  }

  const number = clean.match(/^(?:caderno\s*)?(\d{1,2})$/i)?.[1];
  if (number) {
    return `Caderno ${number}`;
  }

  return clean;
};

export const normalizeBookletColor = (value: unknown) => {
  const normalized = normalizeComparisonText(String(value || ''));
  if (!normalized) {
    return '';
  }

  return BOOKLET_COLOR_LABELS.find(([pattern]) => pattern.test(normalized))?.[1] || '';
};

export const inferStandaloneBookletColor = (...values: unknown[]) => {
  const shortSignal = values
    .map((value) => String(value || '').trim())
    .filter((value) => value.length > 0 && value.length <= 180)
    .join(' ');
  const normalized = normalizeComparisonText(shortSignal);

  return BOOKLET_COLOR_LABELS.find(([pattern]) => pattern.test(normalized))?.[1] || '';
};

export const inferBookletMetadataFromText = (...values: unknown[]) => {
  const normalized = normalizeComparisonText(values.map((value) => String(value || '')).filter(Boolean).join(' '));
  if (!normalized) {
    return { bookletType: '', bookletColor: '' };
  }

  const colorContextMatch = normalized.match(
    /\b(?:caderno|prova|gabarito|cartao resposta|cartao resposta oficial|versao)\s*(?:\d{1,2}\s*)?(amarel[oa]|azul|rosa|branc[oa]|cinza|verde|laranja|rox[oa]|pret[oa])\b|\b(amarel[oa]|azul|rosa|branc[oa]|cinza|verde|laranja|rox[oa]|pret[oa])\s*(?:caderno|prova|gabarito|cartao resposta|versao)\b/,
  );
  const bookletColor = normalizeBookletColor(colorContextMatch?.[1] || colorContextMatch?.[2])
    || inferStandaloneBookletColor(...values);
  const letterType = normalized.match(/\b(?:tipo|versao|caderno tipo|prova tipo)\s*([a-e])\b/)?.[1];
  const numberedBooklet = normalized.match(/\bcaderno\s*(?:n(?:o|umero)?\s*)?(\d{1,2})\b/)?.[1];
  const bookletType = normalizeBookletType(letterType || numberedBooklet);

  return { bookletType, bookletColor };
};

export const buildBookletMetadata = (metadata: ImportMetadata | null, ...signals: unknown[]): Partial<ImportMetadata> => {
  const inferred = inferBookletMetadataFromText(
    metadata?.caderno,
    metadata?.booklet,
    metadata?.tipoCaderno,
    metadata?.bookletType,
    metadata?.cadernoTipo,
    metadata?.corCaderno,
    metadata?.bookletColor,
    metadata?.cadernoCor,
    ...signals,
  );
  const tipoCaderno = normalizeBookletType(
    metadata?.tipoCaderno || metadata?.bookletType || metadata?.cadernoTipo || inferred.bookletType,
  );
  const corCaderno = normalizeBookletColor(
    metadata?.corCaderno || metadata?.bookletColor || metadata?.cadernoCor || inferred.bookletColor,
  );
  const caderno = String(metadata?.caderno || metadata?.booklet || '').trim()
    || [tipoCaderno, corCaderno].filter(Boolean).join(' - ');

  return {
    ...(caderno ? { caderno, booklet: caderno } : {}),
    ...(tipoCaderno ? { tipoCaderno, bookletType: tipoCaderno, cadernoTipo: tipoCaderno } : {}),
    ...(corCaderno ? { corCaderno, bookletColor: corCaderno, cadernoCor: corCaderno } : {}),
  };
};

export const inferMetadataFromText = (value: string, fileName = ''): ImportMetadata => {
  const text = String(value || '');
  const normalized = text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  const lower = `${normalized} ${fileName}`.toLowerCase();
  const year = (normalized.match(/\b(20\d{2}|19\d{2})\b/) || fileName.match(/\b(20\d{2}|19\d{2})\b/))?.[1] || '';
  const bookletMetadata = buildBookletMetadata(null, normalized, fileName);
  const readField = (labels: string[]) => {
    for (const label of labels) {
      const match = normalized.match(new RegExp(`${label}\\s*[:\\-]\\s*([^|\\n\\r]{2,80})`, 'i'));
      if (match?.[1]) {
        return match[1].replace(/\s{2,}/g, ' ').trim();
      }
    }
    return '';
  };

  if (lower.includes('enem') || lower.includes('exame nacional do ensino medio') || lower.includes('inep')) {
    const enemTitle = year ? `INEP - ${year} - INEP - ENEM` : 'INEP - INEP - ENEM';
    return {
      agency: 'INEP',
      source: 'INEP',
      year,
      role: 'ENEM',
      level: 'Superior',
      examType: 'ENEM',
      ...bookletMetadata,
      title: enemTitle,
      examTitle: enemTitle,
    };
  }

  const agency = readField(['Banca', 'Organizadora', 'Instituicao organizadora']);
  const source = readField(['Orgao', 'Orgao/Fonte', 'Fonte']);
  const explicitRole = readField(['Cargo', 'Prova', 'Cargo/Prova']) || inferRoleFromFileName(fileName);
  const roleList = normalizeRoleList(inferRolesFromText(text, fileName), explicitRole);
  const role = summarizeRoleList(roleList, explicitRole);
  const level = readField(['Nivel', 'Escolaridade'])
    || (lower.includes('nivel superior') || lower.includes('nível superior') || lower.includes('tenente') ? 'Superior' : '')
    || (lower.includes('nivel medio') || lower.includes('nível médio') || lower.includes('soldado') ? 'Médio' : '');
  const detectedAgencyProfile = resolveExamParserProfile(fileName, normalized);
  const inferredAgency = agency
    || (detectedAgencyProfile.id !== 'generic' ? detectedAgencyProfile.label : '')
    || (lower.includes('ibfc') ? 'IBFC' : lower.includes('cebraspe') ? 'CEBRASPE' : lower.includes('cespe') ? 'CESPE' : '');
  const inferredSource = source
    || (lower.includes('policia militar') && lower.includes('corpo de bombeiros') && lower.includes('paraiba') ? 'PM/PB / CBM/PB' : '')
    || (lower.includes('pm/pb') || lower.includes('policia militar da paraiba') || lower.includes('polícia militar da paraíba') ? 'PM/PB' : '')
    || (lower.includes('pm/ma') || lower.includes('policia militar do maranhao') || lower.includes('polícia militar do maranhão') ? 'PM/MA' : '');

  return {
    ...(inferredAgency ? { agency: inferredAgency } : {}),
    ...(inferredSource ? { source: inferredSource } : {}),
    ...(role ? { role } : {}),
    ...(roleList.length > 0 ? { roles: roleList, cargos: roleList } : {}),
    ...(level ? { level } : {}),
    ...(year ? { year } : {}),
    ...bookletMetadata,
    examType: lower.includes('concurso') ? 'Concurso' : undefined,
  };
};

export const extractMechanicalOptionsFromText = (
  value: string,
  expectedOptionsCount?: unknown,
  parserProfile: ExamParserProfile = resolveExamParserProfile(value),
) => {
  return extractOptionsFromText(value, expectedOptionsCount, parserProfile);
};

export const extractStructuredPrefixBeforeFirstQuestion = (
  value: string,
  parserProfile: ExamParserProfile = resolveExamParserProfile(value),
) => {
  const text = normalizeQuestionMarkerText(value);
  const markers = findQuestionMarkers(text, parserProfile);
  return markers[0] ? text.slice(0, markers[0].index).trim() : '';
};

export type MechanicalQuestionSegment = {
  marker: { number: number; index: number; raw: string };
  segment: string;
  subject: string;
  hasSpecificContext: boolean;
};

export const inferContextQuestionNumbersFromUsage = (
  contextText: string,
  segments: MechanicalQuestionSegment[],
) => {
  const dependentNumbers = segments
    .filter((segment) => !segment.hasSpecificContext)
    .filter((segment) => textNeedsExternalSupportContext(segment.segment))
    .map((segment) => segment.marker.number)
    .filter((number, index, list) => list.indexOf(number) === index);

  if (dependentNumbers.length > 0) {
    return dependentNumbers;
  }

  const hasNamedTextBlock = /^Texto\s+(?:[IVXLC]+|\d+)\b/im.test(stripHtml(contextText));
  if (!contextHasPluralQuestionDirective(contextText) && !hasNamedTextBlock) {
    return [];
  }

  const firstSubject = segments.find((segment) => !segment.hasSpecificContext)?.subject || '';
  const inferred: number[] = [];
  for (const segment of segments) {
    if (segment.hasSpecificContext) {
      inferred.push(segment.marker.number);
      continue;
    }
    if (
      firstSubject
      && segment.subject
      && normalizeComparisonText(segment.subject) !== normalizeComparisonText(firstSubject)
      && inferred.length > 0
    ) {
      break;
    }
    inferred.push(segment.marker.number);
  }

  return inferred.filter((number, index, list) => number > 0 && list.indexOf(number) === index);
};

export const createMechanicalExtractionFromText = (
  pageText: string,
  pageIndex: number,
  fileName: string,
): PageExtractionResult => {
  const firstPassText = normalizePdfTextForParsing(pageText);
  const initialMetadata = inferMetadataFromText(firstPassText || pageText, fileName);
  const initialParserProfile = buildAdaptiveExamParserProfile(
    [fileName, firstPassText, initialMetadata.agency].filter(Boolean).join('\n'),
    resolveExamParserProfile(fileName, firstPassText, initialMetadata.agency),
  );
  const cleanedPageText = normalizePdfTextForParsing(pageText, initialParserProfile);
  const normalizedText = normalizeQuestionMarkerText(cleanedPageText || pageText)
    .replace(/[ \t]+/g, ' ')
    .trim();
  const inferredMetadata = inferMetadataFromText(normalizedText, fileName);
  const profileAgency = initialParserProfile.id !== 'generic' ? initialParserProfile.label : '';
  const metadata = {
    ...inferredMetadata,
    agency: inferredMetadata.agency || initialMetadata.agency || profileAgency,
  };
  const parserProfile = buildAdaptiveExamParserProfile(
    [fileName, normalizedText, metadata.agency].filter(Boolean).join('\n'),
    resolveExamParserProfile(fileName, normalizedText, metadata.agency),
  );
  const markers = findQuestionMarkers(normalizedText, parserProfile);
  const trueFalseMode = isTrueFalseExamText(normalizedText);
  if (markers.length === 0) {
    return { metadata, pageContexts: [], questions: [] };
  }

  const structuredPrefix = extractStructuredPrefixBeforeFirstQuestion(cleanedPageText || pageText, parserProfile);
  const contextPrefixParts = splitQuestionSupportReference(structuredPrefix || normalizedText.slice(0, markers[0].index).trim());
  const contextPrefix = sanitizeSupportContextText(
    contextPrefixParts.supportText || structuredPrefix || normalizedText.slice(0, markers[0].index).trim(),
  );
  const hasContinuationOptions = extractOptionFragmentsFromText(
    contextPrefix,
    inferExpectedOptionsCountFromText(contextPrefix, normalizedText, fileName),
    parserProfile,
  ).optionsByLabel.size >= 2
    && readOptionMarkers(contextPrefix, parserProfile).filter((marker) => marker.structured).length >= 2;
  const explicitPrefixQuestionNumbers = extractExplicitContextQuestionNumbers(
    structuredPrefix,
    contextPrefix,
    contextPrefixParts.referenceText,
  );
  const hasExplicitSharedPrefixScope = explicitPrefixQuestionNumbers.length >= 2;
  const hasSharedContext = (
    shouldPromoteAsSupportContext(contextPrefix)
    || hasExplicitSharedPrefixScope
    || contextHasPluralQuestionDirective(contextPrefix)
  ) && stripHtml(contextPrefix).replace(/\s+/g, ' ').trim().length >= 40
    && (!hasContinuationOptions || hasExplicitSharedPrefixScope);
  const interQuestionContexts = extractInterQuestionSupportContexts(normalizedText, markers, pageIndex, parserProfile);
  const interContextQuestionNumbers = new Set(
    interQuestionContexts.flatMap((context) => context.appliesToQuestionNumbers || []),
  );
  const questionSegments: MechanicalQuestionSegment[] = markers.map((marker, index) => {
    const next = markers[index + 1];
    const segment = normalizedText.slice(marker.index + marker.raw.length, next?.index ?? normalizedText.length).trim();
    return {
      marker,
      segment,
      subject: inferDisciplineFromTextBefore(normalizedText.slice(0, marker.index)),
      hasSpecificContext: interContextQuestionNumbers.has(marker.number),
    };
  });
  const prefixQuestionNumbers = explicitPrefixQuestionNumbers.length > 0
    ? explicitPrefixQuestionNumbers
    : inferContextQuestionNumbersFromUsage(contextPrefix, questionSegments);
  const hasSharedPrefixContext = hasSharedContext && prefixQuestionNumbers.length >= 2;
  const singlePrefixSupportQuestionNumber = hasSharedContext && prefixQuestionNumbers.length === 1
    ? prefixQuestionNumbers[0]
    : 0;
  const namedPrefixContexts = hasSharedPrefixContext
    ? splitNamedSupportContexts(contextPrefix, prefixQuestionNumbers, pageIndex)
    : [];
  const contextKey = hasSharedPrefixContext
    ? namedPrefixContexts[0]?.contextKey || `pag-${pageIndex}-contexto-textual`
    : '';
  const prefixContextAppliesToQuestion = (questionNumber: number) => (
    Boolean(contextKey)
    && prefixQuestionNumbers.includes(questionNumber)
  );
  const questions = questionSegments.map(({ marker, segment, subject }) => {
    const initialExpectedOptionsCount = trueFalseMode
      ? 2
      : inferExpectedOptionsCountFromText(segment, normalizedText);
    const extracted = trueFalseMode
      ? { statement: segment, options: ['Certo', 'Errado'] }
      : extractMechanicalOptionsFromText(segment, initialExpectedOptionsCount, parserProfile);
    let questionType = inferQuestionType(segment, extracted.options, parserProfile);
    let questionOptions = extracted.options;
    if (trueFalseMode) {
      questionType = 'certo ou errado';
      questionOptions = ['Certo', 'Errado'];
    } else if (questionType === 'verdadeiro/falso') {
      questionOptions = ['Verdadeiro', 'Falso'];
    }
    const expectedOptionsCount = questionType === 'certo ou errado' || questionType === 'verdadeiro/falso'
      ? 2
      : ['discursiva', 'redacao', 'estudo de caso'].includes(questionType)
        ? 0
        : initialExpectedOptionsCount;
    const modality: ImportedQuestionDraft['modality'] = questionType;
    const specificContextKey = interQuestionContexts.find((context) => (
      Array.isArray(context.appliesToQuestionNumbers)
      && context.appliesToQuestionNumbers.includes(marker.number)
    ))?.contextKey || '';
    const linkedContextKey = specificContextKey || (prefixContextAppliesToQuestion(marker.number) ? contextKey : '');
    const statement = extracted.statement || (questionOptions.length > 0 ? '' : segment);
    const validation = validateExtractedQuestionDraft({
      statement,
      options: questionOptions,
      expectedOptionsCount,
      questionType,
      rawText: segment,
      hasFigure: pageLikelyHasFigure(segment),
      contextKey: linkedContextKey,
      supportText: singlePrefixSupportQuestionNumber === marker.number ? contextPrefix : '',
    });
    const individualPrefixSupportText = singlePrefixSupportQuestionNumber === marker.number ? contextPrefix : '';
    const individualPrefixReferenceText = individualPrefixSupportText ? contextPrefixParts.referenceText : '';

    return {
      number: String(marker.number),
      questionNumber: marker.number,
      isQuestion: true,
      text: trueFalseMode ? segment : statement,
      options: questionOptions,
      expectedOptionsCount,
      expected_options_count: expectedOptionsCount,
      contextKey: linkedContextKey,
      contextTitle: specificContextKey
        ? `Texto de apoio - questao ${marker.number}`
        : linkedContextKey ? `Texto de apoio - pagina ${pageIndex}` : '',
      supportText: individualPrefixSupportText,
      referenceText: individualPrefixReferenceText,
      modality,
      questionType,
      raw: segment,
      status: validation.status,
      extractionStatus: validation.status,
      statusReasons: validation.reasons,
      validationReasons: validation.reasons,
      subject,
      topic: '',
      specificSubject: '',
      level: metadata.level || 'Superior',
      difficulty: 'Média',
      page: pageIndex,
    };
  });
  const questionNumberCounts = questions.reduce<Map<number, number>>((counts, question) => {
    const number = Number(question.questionNumber || question.number);
    if (Number.isFinite(number) && number > 0) {
      counts.set(number, (counts.get(number) || 0) + 1);
    }
    return counts;
  }, new Map<number, number>());
  const questionsWithDuplicateStatus = questions.map((question) => {
    const number = Number(question.questionNumber || question.number);
    if (!Number.isFinite(number) || (questionNumberCounts.get(number) || 0) <= 1) {
      return question;
    }

    const reasons = Array.from(new Set([
      ...(question.statusReasons || []),
      'numero_duplicado' as ImportedQuestionStatusReason,
    ]));
    const duplicateStatus: ImportedQuestionStatus = question.status === 'incompleta' ? 'incompleta' : 'revisar';
    return {
      ...question,
      status: duplicateStatus,
      extractionStatus: duplicateStatus,
      statusReasons: reasons,
      validationReasons: reasons,
    };
  });

  return {
    metadata,
    pageContexts: [
      ...(contextKey
        ? namedPrefixContexts.length > 0
          ? namedPrefixContexts
          : [{
        contextKey,
        title: `Texto de apoio - pagina ${pageIndex}`,
        text: contextPrefix,
        referenceText: contextPrefixParts.referenceText,
        sourcePage: pageIndex,
        appliesToQuestionNumbers: prefixQuestionNumbers,
        hasFigure: false,
        figureDescription: '',
      }]
        : []),
      ...interQuestionContexts,
    ],
    questions: questionsWithDuplicateStatus,
  };
};

export const questionLikelyHasVisualAlternatives = (
  rawText: string,
  pageText: string,
  modality?: string,
) => {
  if (String(modality || '').toLowerCase().includes('certo')) {
    return false;
  }

  const clean = stripHtml(rawText).replace(/\s+/g, ' ').trim();
  const pageHasVisualMaterial = pageLikelyHasFigure(`${clean} ${pageText}`);
  const hasChoiceCue = /\b(?:alternativas?|op[cç][oõ]es|gr[aá]ficos?|figuras?|imagens?|esbo[cç]ad[ao]s?|representa(?:m)?|mostra(?:m)?|indica(?:m)?|corresponde(?:m)?|assinale|qual|quais|a seguir|abaixo)\b/i
    .test(clean);
  const hasLooseVisualLabels = /(?:^|\s)A\s+B\s+C\s+D\s+E(?:\s|$)/i.test(clean);

  return pageHasVisualMaterial && (hasChoiceCue || hasLooseVisualLabels);
};

export const getExtractionQuestionText = (question: PageExtractionResult['questions'][number]) => {
  const draft = question as ImportedQuestionDraft & { raw?: string };
  return [
    draft.text,
    (question as Question).enunciado,
    draft.raw,
    Array.isArray(draft.options) ? draft.options.join(' ') : '',
  ].map((value) => String(value || '').trim()).filter(Boolean).join(' ');
};

export const getExtractionQuestionSupportText = (question: PageExtractionResult['questions'][number]) => {
  const draft = question as ImportedQuestionDraft & { intro_text?: string };
  return String(draft.supportText || draft.introText || draft.intro_text || '').trim();
};

export const getExtractionQuestionContextKey = (question: PageExtractionResult['questions'][number]) => {
  const draft = question as ImportedQuestionDraft & {
    contextTempId?: string | number;
    grupoQuestaoTempId?: string | number;
  };
  return String(draft.contextKey || draft.contextTempId || draft.grupoQuestaoTempId || '').trim();
};

export const extractionQuestionHasSupportPayload = (question: PageExtractionResult['questions'][number]) => {
  const draft = question as ImportedQuestionDraft;
  return Boolean(
    stripHtml(getExtractionQuestionSupportText(question)).replace(/\s+/g, ' ').trim().length >= 40
    || draft.supportFigureBox
    || (Array.isArray(draft.supportFigureBoxes) && draft.supportFigureBoxes.length > 0)
    || (Array.isArray(draft.supportImages) && draft.supportImages.length > 0)
  );
};

export const extractionContextHasPayload = (context: NonNullable<PageExtractionResult['pageContexts']>[number]) => (
  stripHtml(String(context.text || context.richText || '')).replace(/\s+/g, ' ').trim().length >= 40
  || Boolean(context.hasFigure || context.figureBox || context.figureDescription)
  || (Array.isArray(context.figures) && context.figures.length > 0)
);

export const extractionQuestionNeedsContextFallback = (question: PageExtractionResult['questions'][number]) => (
  textNeedsExternalSupportContext(getExtractionQuestionText(question))
  && !getExtractionQuestionContextKey(question)
  && !extractionQuestionHasSupportPayload(question)
);

export const pageHasLikelySupportContext = (
  pageText: string,
  parserProfile: ExamParserProfile,
) => {
  const clean = stripHtml(pageText).replace(/\s+/g, ' ').trim();
  if (clean.length < 80 || isLikelyInstructionText(clean)) {
    return false;
  }

  const normalizedText = normalizeQuestionMarkerText(normalizePdfTextForParsing(pageText, parserProfile) || pageText)
    .replace(/[ \t]+/g, ' ')
    .trim();
  const markers = findQuestionMarkers(normalizedText, parserProfile);
  const prefix = markers[0]
    ? sanitizeSupportContextText(extractStructuredPrefixBeforeFirstQuestion(pageText, parserProfile) || normalizedText.slice(0, markers[0].index))
    : '';
  const hasPromotablePrefix = prefix.length >= 40 && shouldPromoteAsSupportContext(prefix);
  const hasExplicitSharedScope = extractExplicitContextQuestionNumbers(clean).length >= 2;
  const hasContextStart = findSupportContextStartIndex(pageText) >= 0 || supportContextSignalPattern.test(clean);
  const hasVisualContextCue = pageLikelyHasFigure(clean) && /\b(?:observe|analise|considere|com\s+base|quest(?:[oõ]es|oes)|itens?)\b/i.test(clean);

  return Boolean(
    hasPromotablePrefix
    || hasExplicitSharedScope
    || (hasContextStart && (markers.length > 0 || questionCommandPattern.test(clean)))
    || hasVisualContextCue
  );
};

export const extractionLikelyNeedsSupportContextFallback = (
  pageText: string,
  extraction: PageExtractionResult,
  parserProfile: ExamParserProfile,
) => {
  const pageLooksContextual = pageHasLikelySupportContext(pageText, parserProfile);
  const questions = extraction.questions || [];
  const contexts = extraction.pageContexts || [];
  const linkedContextKeys = new Set(
    questions
      .map((question) => getExtractionQuestionContextKey(question))
      .filter(Boolean),
  );
  const hasContextPayload = contexts.some(extractionContextHasPayload);
  const hasQuestionSupportPayload = questions.some(extractionQuestionHasSupportPayload);
  const unresolvedContextQuestion = questions.some(extractionQuestionNeedsContextFallback);

  if (unresolvedContextQuestion) {
    return true;
  }

  if (!pageLooksContextual) {
    return false;
  }

  if (!hasContextPayload && !hasQuestionSupportPayload) {
    return true;
  }

  const explicitQuestionNumbers = extractExplicitContextQuestionNumbers(pageText);
  if (explicitQuestionNumbers.length >= 2) {
    const explicitSet = new Set(explicitQuestionNumbers);
    const linkedByContextScope = new Set(
      contexts.flatMap((context) => (
        extractionContextHasPayload(context)
          ? resolveScopedContextQuestionNumbers(
            Array.isArray(context.appliesToQuestionNumbers)
              ? context.appliesToQuestionNumbers.map((value) => normalizeQuestionNumber(value, 0)).filter(Boolean)
              : [],
            context.text,
            context.referenceText,
            context.title,
          )
          : []
      )),
    );
    const questionNumbersWithoutContext = questions
      .map((question, index) => ({
        number: normalizeQuestionNumber(
          (question as ImportedQuestionDraft).questionNumber || question.number,
          index + 1,
        ),
        hasContext: Boolean(getExtractionQuestionContextKey(question)) || extractionQuestionHasSupportPayload(question),
      }))
      .filter((item) => explicitSet.has(item.number) && !item.hasContext && !linkedByContextScope.has(item.number));

    if (questionNumbersWithoutContext.length > 0) {
      return true;
    }
  }

  return contexts.some((context) => (
    extractionContextHasPayload(context)
    && String(context.contextKey || '').trim()
    && !linkedContextKeys.has(String(context.contextKey || '').trim())
    && (!Array.isArray(context.appliesToQuestionNumbers) || context.appliesToQuestionNumbers.length === 0)
  ));
};

export const extractionNeedsAi = (
  pageText: string,
  extraction: PageExtractionResult,
  _includeTeacherComment: boolean,
  _hasPageHighlights = false,
) => {
  const parserProfile = resolveExamParserProfile(pageText);
  const pageQuestionNumbers = extractQuestionNumbersFromText(pageText, parserProfile);
  const extractedQuestionNumbers = (extraction.questions || [])
    .map((question, index) => normalizeQuestionNumber(
      (question as ImportedQuestionDraft).questionNumber || (question as ImportedQuestionDraft).number,
      index + 1,
    ))
    .filter((number, index, list) => number > 0 && list.indexOf(number) === index);
  const pageLooksLikeQuestionContent = () => {
    const clean = stripHtml(pageText).replace(/\s+/g, ' ').trim();
    if (clean.length < 40) {
      return false;
    }
    const optionMarkers = readOptionMarkers(clean, parserProfile);
    return (
      questionCommandPattern.test(clean)
      && (optionMarkers.length >= 2 || /\b(?:assinale|julgue|marque|responda|correta|incorreta|exceto)\b/i.test(clean))
      && !isLikelyInstructionText(clean)
    );
  };

  if (!pageText || stripHtml(pageText).replace(/\s+/g, ' ').trim().length < 40) {
    return true;
  }
  if (pageQuestionNumbers.length > extractedQuestionNumbers.length) {
    return true;
  }
  if (!extraction.questions.length && (pageQuestionNumbers.length > 0 || pageLooksLikeQuestionContent())) {
    return true;
  }
  if (extractionLikelyNeedsSupportContextFallback(pageText, extraction, parserProfile)) {
    return true;
  }
  const questionsMissingOptions = extraction.questions.filter((question) => {
    const draft = question as ImportedQuestionDraft;
    const questionText = String(draft.text || question.enunciado || '');
    const expectedOptionsCount = inferExpectedOptionsCountFromText(questionText, pageText)
      || getExpectedOptionsCount(draft.modality, draft.expectedOptionsCount ?? draft.expected_options_count);
    return normalizeImportedOptions(draft.options, questionText, draft.modality, expectedOptionsCount).options.length < expectedOptionsCount;
  });
  if (questionsMissingOptions.length > 0) {
    const lastQuestion = extraction.questions[extraction.questions.length - 1] as ImportedQuestionDraft | undefined;
    const lastQuestionNumber = normalizeQuestionNumber(lastQuestion?.number || lastQuestion?.questionNumber, 0);
    const onlyLastQuestionIsIncomplete = lastQuestionNumber > 0 && questionsMissingOptions.every((question) => {
      const draft = question as ImportedQuestionDraft;
      return normalizeQuestionNumber(draft.number || draft.questionNumber, 0) === lastQuestionNumber;
    });
    if (onlyLastQuestionIsIncomplete) {
      return false;
    }
    return true;
  }
  return extraction.questions.length > 0 && pageLikelyHasFigure(pageText);
};

export const decideAiExtractionForPage = (
  pageText: string,
  extraction: PageExtractionResult,
  options: {
    pageNumber: number;
    expectedQuestionNumbers?: number[];
    alreadyExtractedQuestionNumbers?: number[];
    includeTeacherComment?: boolean;
    hasPageHighlights?: boolean;
    pageData?: PdfPageData | PdfPageRichText;
  },
): AiExtractionDecision => {
  const parserProfile = resolveExamParserProfile(pageText);
  const cleanTextLength = stripHtml(pageText).replace(/\s+/g, ' ').trim().length;
  const pageQuestionNumbers = extractQuestionNumbersFromText(pageText, parserProfile);
  const extractedQuestionNumbers = (extraction.questions || [])
    .map((question, index) => normalizeQuestionNumber(
      (question as ImportedQuestionDraft).questionNumber || (question as ImportedQuestionDraft).number,
      index + 1,
    ))
    .filter((number, index, list) => number > 0 && list.indexOf(number) === index);
  const alreadyExtracted = new Set(options.alreadyExtractedQuestionNumbers || []);
  const expectedOnPage = (options.expectedQuestionNumbers || [])
    .filter((number) => pageQuestionNumbers.includes(number) || !alreadyExtracted.has(number));
  const missingOnPage = expectedOnPage.filter((number) => !extractedQuestionNumbers.includes(number) && !alreadyExtracted.has(number));
  const baseDecision: AiExtractionDecision = {
    useAi: false,
    purpose: 'none',
    targetQuestionNumbers: missingOnPage.length > 0 ? missingOnPage : pageQuestionNumbers,
    targetPages: [options.pageNumber],
    cropBox: estimatePdfQuestionRegionBox(options.pageData, missingOnPage.length > 0 ? missingOnPage : pageQuestionNumbers),
    priority: 0,
    reasons: [],
  };

  if (!extractionNeedsAi(pageText, extraction, Boolean(options.includeTeacherComment), Boolean(options.hasPageHighlights))) {
    return baseDecision;
  }

  if (cleanTextLength < 40) {
    return {
      ...baseDecision,
      useAi: true,
      purpose: 'scanned_page',
      priority: 95,
      reasons: ['pagina_sem_texto_nativo_suficiente'],
    };
  }

  if (missingOnPage.length > 0) {
    return {
      ...baseDecision,
      useAi: true,
      purpose: 'missing_question',
      priority: 85,
      targetQuestionNumbers: missingOnPage,
      cropBox: estimatePdfQuestionRegionBox(options.pageData, missingOnPage),
      reasons: ['numero_esperado_nao_localizado_mecanicamente'],
    };
  }

  const questionsMissingOptions = (extraction.questions || []).filter((question) => {
    const draft = question as ImportedQuestionDraft;
    const questionText = String(draft.text || question.enunciado || '');
    const expectedOptionsCount = inferExpectedOptionsCountFromText(questionText, pageText)
      || getExpectedOptionsCount(draft.modality, draft.expectedOptionsCount ?? draft.expected_options_count);
    return normalizeImportedOptions(draft.options, questionText, draft.modality, expectedOptionsCount).options.length < expectedOptionsCount;
  });
  if (questionsMissingOptions.length > 0) {
    return {
      ...baseDecision,
      useAi: true,
      purpose: 'incomplete_question',
      priority: 80,
      targetQuestionNumbers: questionsMissingOptions
        .map((question, index) => normalizeQuestionNumber(
          (question as ImportedQuestionDraft).questionNumber || (question as ImportedQuestionDraft).number,
          index + 1,
        ))
        .filter(Boolean),
      cropBox: estimatePdfQuestionRegionBox(
        options.pageData,
        questionsMissingOptions
          .map((question, index) => normalizeQuestionNumber(
            (question as ImportedQuestionDraft).questionNumber || (question as ImportedQuestionDraft).number,
            index + 1,
          ))
          .filter(Boolean),
      ),
      reasons: ['alternativas_incompletas'],
    };
  }

  if (extractionLikelyNeedsSupportContextFallback(pageText, extraction, parserProfile)) {
    return {
      ...baseDecision,
      useAi: true,
      purpose: 'context_repair',
      priority: 75,
      cropBox: estimatePdfResourceRegionBox(options.pageData, baseDecision.targetQuestionNumbers)
        || baseDecision.cropBox,
      reasons: ['contexto_ou_texto_de_apoio_pendente'],
    };
  }

  if ((extraction.questions || []).length > 0 && pageLikelyHasFigure(pageText)) {
    return {
      ...baseDecision,
      useAi: true,
      purpose: 'visual_question',
      priority: 70,
      cropBox: estimatePdfResourceRegionBox(options.pageData, baseDecision.targetQuestionNumbers)
        || baseDecision.cropBox,
      reasons: ['conteudo_visual_na_pagina'],
    };
  }

  return {
    ...baseDecision,
    useAi: true,
    purpose: 'layout_repair',
    priority: 60,
    cropBox: baseDecision.cropBox,
    reasons: ['layout_ambiguo_para_parser_mecanico'],
  };
};

export const mergeExtractionText = (...values: Array<unknown>) => {
  const parts = values
    .map((value) => String(value || '').trim())
    .filter(Boolean);

  return Array.from(new Set(parts)).join('\n\n');
};

export const createExtractionFieldMetadata = (
  origin: ExtractionFieldMetadata['origin'],
  confidence: number,
  sourcePage?: number | string,
  sourceBox?: FigureBox,
): ExtractionFieldMetadata => ({
  origin,
  confidence: Math.max(0, Math.min(1, Number(confidence) || 0)),
  sourcePage: Number.isFinite(Number(sourcePage)) ? Number(sourcePage) : undefined,
  sourceBox: normalizeExtractionFigureBox(sourceBox),
});

export const getQuestionFieldMetadata = (question: PageExtractionResult['questions'][number]) => {
  const draft = question as ImportedQuestionDraft;
  return {
    ...(draft.fieldMetadata || {}),
    ...(draft.extractionFieldMetadata || {}),
  };
};

export const setQuestionFieldMetadata = (
  question: PageExtractionResult['questions'][number],
  metadata: Partial<Record<string, ExtractionFieldMetadata>>,
) => ({
  ...(question as ImportedQuestionDraft),
  fieldMetadata: metadata,
  extractionFieldMetadata: metadata,
}) as PageExtractionResult['questions'][number];

export const hasMeaningfulExtractionValue = (value: unknown) => {
  if (Array.isArray(value)) {
    return value.filter((item) => String(item || '').trim()).length > 0;
  }
  return String(value || '').trim().length > 0;
};

export const hashTextForImportCache = (value: string) => {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36);
};

export const computeArrayBufferFingerprint = (buffer: ArrayBuffer, file?: File | null) => {
  const bytes = new Uint8Array(buffer);
  const sampleSize = Math.min(4096, bytes.length);
  const head = Array.from(bytes.slice(0, sampleSize)).map((byte) => String.fromCharCode(byte)).join('');
  const tail = bytes.length > sampleSize
    ? Array.from(bytes.slice(Math.max(0, bytes.length - sampleSize))).map((byte) => String.fromCharCode(byte)).join('')
    : '';
  return [
    file?.name || 'pdf',
    file?.size || bytes.length,
    file?.lastModified || 0,
    hashTextForImportCache(`${head}|${tail}`),
  ].join(':');
};

export const buildFigureBoxCacheSignature = (box?: FigureBox) => {
  const normalized = normalizeExtractionFigureBox(box);
  if (!normalized) {
    return '';
  }
  return [normalized.x, normalized.y, normalized.width, normalized.height]
    .map((value) => Math.round(Number(value) || 0))
    .join(':');
};

export const chooseExtractionValue = <T,>(
  baseValue: T,
  supplementValue: T,
  baseMetadata: ExtractionFieldMetadata | undefined,
  supplementMetadata: ExtractionFieldMetadata | undefined,
) => {
  const baseHasValue = hasMeaningfulExtractionValue(baseValue);
  const supplementHasValue = hasMeaningfulExtractionValue(supplementValue);
  if (!baseHasValue && supplementHasValue) {
    return { value: supplementValue, metadata: supplementMetadata };
  }
  if (baseHasValue && !supplementHasValue) {
    return { value: baseValue, metadata: baseMetadata };
  }
  if (
    baseHasValue
    && supplementHasValue
    && (supplementMetadata?.confidence || 0) > (baseMetadata?.confidence || 0)
    && supplementMetadata?.origin !== 'ai'
  ) {
    return { value: supplementValue, metadata: supplementMetadata };
  }
  return { value: baseValue, metadata: baseMetadata };
};

export const annotateQuestionExtractionFields = (
  question: PageExtractionResult['questions'][number],
  origin: ExtractionFieldMetadata['origin'],
  confidence: number,
  sourceBox?: FigureBox,
) => {
  const draft = question as ImportedQuestionDraft;
  const questionRecord = question as Record<string, unknown>;
  const rawSourcePage = draft.sourcePage || questionRecord.sourcePage || questionRecord.source_page;
  const sourcePage = typeof rawSourcePage === 'string' || typeof rawSourcePage === 'number' ? rawSourcePage : undefined;
  const existing = getQuestionFieldMetadata(question);
  const nextMetadata: Partial<Record<string, ExtractionFieldMetadata>> = { ...existing };
  const mark = (field: string, value: unknown, fieldBox?: FigureBox) => {
    if (hasMeaningfulExtractionValue(value) && !nextMetadata[field]) {
      nextMetadata[field] = createExtractionFieldMetadata(origin, confidence, sourcePage, fieldBox || sourceBox);
    }
  };

  mark('number', draft.number ?? draft.questionNumber ?? question.number ?? question.questionNumber);
  mark('text', draft.text || question.enunciado);
  mark('options', draft.options);
  mark('supportText', draft.supportText);
  mark('referenceText', draft.referenceText);
  mark('contextKey', draft.contextKey);
  mark('contextTitle', draft.contextTitle);
  mark('figureBox', draft.figureBox, draft.figureBox);
  mark('supportFigureBox', draft.supportFigureBox, draft.supportFigureBox);
  mark('optionFigureBox', draft.optionFigureBox, draft.optionFigureBox);
  mark('teacherComment', (question as { teacherComment?: string }).teacherComment);
  mark('detailedComment', (question as { detailedComment?: string }).detailedComment);

  return setQuestionFieldMetadata(question, nextMetadata);
};

export const annotatePageExtractionResult = (
  result: PageExtractionResult,
  origin: ExtractionFieldMetadata['origin'],
  confidence: number,
  sourceBox?: FigureBox,
): PageExtractionResult => ({
  ...result,
  questions: (result.questions || []).map((question) => annotateQuestionExtractionFields(question, origin, confidence, sourceBox)),
});

export const mergeFigureBoxes = (boxes: FigureBox[]) => {
  const normalizedBoxes = boxes
    .map((box) => normalizeExtractionFigureBox(box))
    .filter(Boolean) as FigureBox[];
  if (normalizedBoxes.length === 0) {
    return undefined;
  }

  const bounds = normalizedBoxes.map((box) => ({
    x: Number(box.x),
    y: Number(box.y),
    right: Number(box.x) + Number(box.width),
    bottom: Number(box.y) + Number(box.height),
  }));
  const x = Math.max(0, Math.min(...bounds.map((box) => box.x)));
  const y = Math.max(0, Math.min(...bounds.map((box) => box.y)));
  const right = Math.min(1000, Math.max(...bounds.map((box) => box.right)));
  const bottom = Math.min(1000, Math.max(...bounds.map((box) => box.bottom)));

  return {
    x,
    y,
    width: Math.max(1, right - x),
    height: Math.max(1, bottom - y),
  };
};

export const mergeQuestionExtractionDraft = (
  previous: PageExtractionResult['questions'][number],
  next: PageExtractionResult['questions'][number],
): PageExtractionResult['questions'][number] => {
  const previousDraft = previous as ImportedQuestionDraft;
  const nextDraft = next as ImportedQuestionDraft;
  const previousText = String(previousDraft.text || previous.enunciado || '');
  const nextText = String(nextDraft.text || next.enunciado || '');
  const previousExpectedOptionsCount = inferExpectedOptionsCountFromText(previousText)
    || getExpectedOptionsCount(
      previousDraft.modality,
      previousDraft.expectedOptionsCount ?? previousDraft.expected_options_count,
    );
  const nextExpectedOptionsCount = inferExpectedOptionsCountFromText(nextText)
    || getExpectedOptionsCount(
      nextDraft.modality,
      nextDraft.expectedOptionsCount ?? nextDraft.expected_options_count,
    );
  const previousNormalized = normalizeImportedOptions(
    previousDraft.options,
    previousText,
    previousDraft.modality,
    previousExpectedOptionsCount,
  );
  const nextNormalized = normalizeImportedOptions(
    nextDraft.options,
    nextText,
    nextDraft.modality,
    nextExpectedOptionsCount,
  );
  const previousOptionsCount = previousNormalized.options.length;
  const nextOptionsCount = nextNormalized.options.length;
  const previousIsComplete = previousOptionsCount >= previousExpectedOptionsCount;
  const nextIsComplete = nextOptionsCount >= nextExpectedOptionsCount;
  const preferNextCore = (nextIsComplete && !previousIsComplete)
    || (!previousIsComplete && !nextIsComplete && nextOptionsCount > previousOptionsCount)
    || (
      nextIsComplete === previousIsComplete
      && nextOptionsCount === previousOptionsCount
      && nextText.length > previousText.length
      && nextOptionsCount > 0
    );
  const base = preferNextCore ? next : previous;
  const supplement = preferNextCore ? previous : next;
  const baseDraft = base as ImportedQuestionDraft;
  const supplementDraft = supplement as ImportedQuestionDraft;
  const baseFieldMetadata = getQuestionFieldMetadata(base);
  const supplementFieldMetadata = getQuestionFieldMetadata(supplement);
  const mergedFieldMetadata: Partial<Record<string, ExtractionFieldMetadata>> = {
    ...supplementFieldMetadata,
    ...baseFieldMetadata,
  };
  const supportTextChoice = chooseExtractionValue(
    baseDraft.supportText,
    supplementDraft.supportText,
    baseFieldMetadata.supportText,
    supplementFieldMetadata.supportText,
  );
  const referenceTextChoice = chooseExtractionValue(
    baseDraft.referenceText,
    supplementDraft.referenceText,
    baseFieldMetadata.referenceText,
    supplementFieldMetadata.referenceText,
  );
  const contextKeyChoice = chooseExtractionValue(
    baseDraft.contextKey,
    supplementDraft.contextKey,
    baseFieldMetadata.contextKey,
    supplementFieldMetadata.contextKey,
  );
  const contextTitleChoice = chooseExtractionValue(
    baseDraft.contextTitle,
    supplementDraft.contextTitle,
    baseFieldMetadata.contextTitle,
    supplementFieldMetadata.contextTitle,
  );
  if (supportTextChoice.metadata) mergedFieldMetadata.supportText = supportTextChoice.metadata;
  if (referenceTextChoice.metadata) mergedFieldMetadata.referenceText = referenceTextChoice.metadata;
  if (contextKeyChoice.metadata) mergedFieldMetadata.contextKey = contextKeyChoice.metadata;
  if (contextTitleChoice.metadata) mergedFieldMetadata.contextTitle = contextTitleChoice.metadata;
  const mergedFigureDescription = mergeExtractionText(baseDraft.figureDescription, supplementDraft.figureDescription);
  const mergedImageDescriptions = [
    ...(Array.isArray(baseDraft.imageDescriptions) ? baseDraft.imageDescriptions : []),
    ...(Array.isArray(supplementDraft.imageDescriptions) ? supplementDraft.imageDescriptions : []),
  ].filter(Boolean);

  const mergedQuestion = {
    ...base,
    subject: baseDraft.subject || supplementDraft.subject,
    topic: baseDraft.topic || supplementDraft.topic,
    specificSubject: baseDraft.specificSubject || supplementDraft.specificSubject,
    difficulty: baseDraft.difficulty || supplementDraft.difficulty,
    level: baseDraft.level || supplementDraft.level,
    expectedOptionsCount: normalizeExpectedOptionsCount(baseDraft.expectedOptionsCount ?? baseDraft.expected_options_count)
      || normalizeExpectedOptionsCount(supplementDraft.expectedOptionsCount ?? supplementDraft.expected_options_count)
      || inferExpectedOptionsCountFromText(baseDraft.text || (base as Question).enunciado, supplementDraft.text || (supplement as Question).enunciado),
    expected_options_count: normalizeExpectedOptionsCount(baseDraft.expectedOptionsCount ?? baseDraft.expected_options_count)
      || normalizeExpectedOptionsCount(supplementDraft.expectedOptionsCount ?? supplementDraft.expected_options_count)
      || inferExpectedOptionsCountFromText(baseDraft.text || (base as Question).enunciado, supplementDraft.text || (supplement as Question).enunciado),
    teacherComment: (base as { teacherComment?: string }).teacherComment || (supplement as { teacherComment?: string }).teacherComment,
    detailedComment: (base as { detailedComment?: string }).detailedComment || (supplement as { detailedComment?: string }).detailedComment,
    contextKey: contextKeyChoice.value || '',
    contextTitle: contextTitleChoice.value || '',
    contextScope: baseDraft.contextScope || supplementDraft.contextScope,
    supportText: supportTextChoice.value || '',
    referenceText: referenceTextChoice.value || '',
    hasFigure: Boolean(baseDraft.hasFigure || supplementDraft.hasFigure),
    figureDescription: mergedFigureDescription,
    figureBox: normalizeExtractionFigureBox(baseDraft.figureBox || supplementDraft.figureBox),
    supportFigureBox: normalizeExtractionFigureBox(baseDraft.supportFigureBox || supplementDraft.supportFigureBox),
    supportFigureBoxes: normalizeExtractionFigureBoxes(
      baseDraft.supportFigureBoxes,
      supplementDraft.supportFigureBoxes,
      baseDraft.supportFigureBox || supplementDraft.supportFigureBox,
    ) as unknown as PageExtractionResult['questions'][number]['supportFigureBoxes'],
    optionFigureBox: normalizeExtractionFigureBox(baseDraft.optionFigureBox || supplementDraft.optionFigureBox),
    optionFigureBoxes: normalizeExtractionFigureBoxes(
      baseDraft.optionFigureBoxes,
      supplementDraft.optionFigureBoxes,
      baseDraft.optionFigureBox || supplementDraft.optionFigureBox,
    ) as unknown as PageExtractionResult['questions'][number]['optionFigureBoxes'],
    imageDescriptions: Array.from(new Set(mergedImageDescriptions)),
  };

  return setQuestionFieldMetadata(mergedQuestion as PageExtractionResult['questions'][number], mergedFieldMetadata);
};

export const mergeQuestionEditorialPatch = (current: Question, patch: Partial<Question>): Question => ({
  ...current,
  ...patch,
  teacherComment: String(patch.teacherComment || '').trim()
    ? patch.teacherComment
    : current.teacherComment,
  detailedComment: String(patch.detailedComment || '').trim()
    ? patch.detailedComment
    : current.detailedComment,
});

export const mergePageExtractionResults = (
  mechanical: PageExtractionResult,
  aiResult: PageExtractionResult,
  aiSourceBox?: FigureBox,
): PageExtractionResult => {
  const byNumber = new Map<string, PageExtractionResult['questions'][number]>();
  [
    ...(mechanical.questions || []).map((question) => annotateQuestionExtractionFields(question, 'mechanical', 0.82)),
    ...(aiResult.questions || []).map((question) => annotateQuestionExtractionFields(question, 'ai', 0.68, aiSourceBox)),
  ].forEach((question) => {
    const number = String(question.number || question.questionNumber || '').trim();
    if (!number) {
      byNumber.set(`item-${byNumber.size}`, question);
      return;
    }

    const previous = byNumber.get(number);
    if (!previous) {
      byNumber.set(number, question);
      return;
    }

    const previousDraft = previous as ImportedQuestionDraft;
    const nextDraft = question as ImportedQuestionDraft;
    const previousText = String(previousDraft.text || previous.enunciado || '');
    const nextText = String(nextDraft.text || question.enunciado || '');
    const previousExpectedOptionsCount = inferExpectedOptionsCountFromText(previousText)
      || getExpectedOptionsCount(
        previousDraft.modality,
        previousDraft.expectedOptionsCount ?? previousDraft.expected_options_count,
      );
    const nextExpectedOptionsCount = inferExpectedOptionsCountFromText(nextText)
      || getExpectedOptionsCount(
        nextDraft.modality,
        nextDraft.expectedOptionsCount ?? nextDraft.expected_options_count,
      );
    const previousOptions = normalizeImportedOptions(previousDraft.options, previousText, previousDraft.modality, previousExpectedOptionsCount).options.length;
    const nextOptions = normalizeImportedOptions(nextDraft.options, nextText, nextDraft.modality, nextExpectedOptionsCount).options.length;
    const previousComplete = previousOptions >= previousExpectedOptionsCount;
    const nextComplete = nextOptions >= nextExpectedOptionsCount;
    byNumber.set(number, nextOptions >= previousOptions
      && (nextComplete || !previousComplete)
      ? mergeQuestionExtractionDraft(previous, question)
      : mergeQuestionExtractionDraft(question, previous));
  });

  return {
    metadata: {
      ...(mechanical.metadata || {}),
      ...(aiResult.metadata || {}),
    },
    pageContexts: mergeExtractionContextList([
      ...(mechanical.pageContexts || []),
      ...(aiResult.pageContexts || []),
    ]),
    questions: Array.from(byNumber.values()),
  };
};

export const normalizeDifficulty = (value: string | number | undefined | null) => {
  const normalized = String(value ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  if (normalized.includes('facil') || normalized === '1') return 1;
  if (normalized.includes('dificil') || normalized === '3') return 3;
  return 2;
};

export const createTaxonomyLabel = (name: string, extras: Record<string, unknown> = {}) => ({
  id: undefined,
  name,
  nome: name,
  slug: slugify(name),
  ...extras,
});

export const readLooseText = (record: Record<string, unknown> | null | undefined, keys: string[]) => {
  const value = readLooseField(record, keys);
  if (value === null || value === undefined) return '';
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return String(value).trim();
  }
  return '';
};

export const readLooseArray = (record: Record<string, unknown> | null | undefined, keys: string[]) => {
  const value = readLooseField(record, keys);
  return Array.isArray(value) ? value : [];
};

export const readLooseArrayOrScalar = (record: Record<string, unknown> | null | undefined, keys: string[]) => {
  const value = readLooseField(record, keys);
  if (Array.isArray(value)) return value;
  return value === null || value === undefined || value === '' ? [] : [value];
};

export const metadataItemToDisplayText = (item: unknown) => {
  const record = toLooseRecord(item);
  if (record) {
    return readLooseText(record, [
      'name',
      'nome',
      'title',
      'titulo',
      'sigla',
      'label',
      'descricao',
      'description',
      'texto',
      'text',
      'value',
    ]);
  }
  return String(item ?? '').trim();
};

export const readLooseMetadataTextList = (record: Record<string, unknown> | null | undefined, keys: string[]) => (
  readLooseArrayOrScalar(record, keys)
    .map(metadataItemToDisplayText)
    .map((item) => item.trim())
    .filter(Boolean)
    .filter((item, index, list) => list.findIndex((candidate) => normalizeComparisonText(candidate) === normalizeComparisonText(item)) === index)
);

export const readLooseStructuredList = (record: Record<string, unknown> | null | undefined, keys: string[]) => {
  const values = readLooseArrayOrScalar(record, keys);
  return values.length > 0 ? values : [];
};

export const firstMetadataText = (items: string[], fallback = '') => items.find(Boolean) || fallback;

export const extractJsonObjectText = (value: string) => {
  const clean = String(value || '').trim();
  const fenced = clean.match(/```(?:json)?\s*([\s\S]*?)```/i)?.[1]?.trim();
  const candidate = fenced || clean;
  if (candidate.startsWith('{') && candidate.endsWith('}')) return candidate;
  const start = candidate.indexOf('{');
  const end = candidate.lastIndexOf('}');
  return start >= 0 && end > start ? candidate.slice(start, end + 1) : candidate;
};

export const parseQuestionNumberList = (value: unknown): number[] => {
  if (Array.isArray(value)) {
    return value
      .flatMap((item) => parseQuestionNumberList(item))
      .filter((number, index, list) => list.indexOf(number) === index)
      .sort((left, right) => left - right);
  }

  if (typeof value === 'number' && Number.isFinite(value) && value > 0) {
    return [Math.round(value)];
  }

  const text = String(value || '').trim();
  if (!text) return [];
  const numbers = new Set<number>();
  const rangeMatches = Array.from(text.matchAll(/(\d{1,3})\s*(?:a|ate|até|-|–|—)\s*(\d{1,3})/gi));
  rangeMatches.forEach((match) => {
    const start = Number(match[1]);
    const end = Number(match[2]);
    if (Number.isFinite(start) && Number.isFinite(end) && start > 0 && end >= start && end - start <= 200) {
      for (let number = start; number <= end; number += 1) numbers.add(number);
    }
  });
  Array.from(text.matchAll(/\d{1,3}/g)).forEach((match) => {
    const number = Number(match[0]);
    if (Number.isFinite(number) && number > 0) numbers.add(number);
  });
  return Array.from(numbers).sort((left, right) => left - right);
};

export const normalizeAnswerIndex = (value: unknown) => {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value >= 1 && value <= 5 ? value - 1 : value >= 0 && value <= 4 ? value : undefined;
  }
  const clean = String(value || '').trim().toUpperCase();
  if (/^[A-E]$/.test(clean)) {
    return clean.charCodeAt(0) - 65;
  }
  const numeric = Number(clean.match(/\d+/)?.[0] || Number.NaN);
  if (Number.isFinite(numeric)) {
    return numeric >= 1 && numeric <= 5 ? numeric - 1 : numeric >= 0 && numeric <= 4 ? numeric : undefined;
  }
  return undefined;
};

export const inferImportedQuestionTypeFromPayload = (value: unknown, optionsCount: number): ImportedQuestionType => {
  const normalized = normalizeComparisonText(String(value || ''));
  if (normalized.includes('certo') && normalized.includes('errado')) return 'certo ou errado';
  if (normalized.includes('verdadeiro') || normalized.includes('falso')) return 'verdadeiro/falso';
  if (normalized.includes('discurs')) return 'discursiva';
  if (optionsCount >= 2) return 'multipla escolha';
  return 'desconhecido';
};

export const readExternalImageData = (record?: Record<string, unknown> | null) => {
  const primaryValue = readLooseText(record, [
    'imageData',
    'image_data',
    'base64',
    'data',
    'dataUrl',
    'dataURL',
  ]);
  const sourceValue = readLooseText(record, ['src', 'url']);
  const value = primaryValue || (/^data:image\//i.test(sourceValue) ? sourceValue : '');
  return value.replace(/^data:image\/[a-z0-9.+-]+;base64,/i, '').trim();
};

export const normalizeAiQuestionOptions = (value: unknown) => {
  const labels = ['A', 'B', 'C', 'D', 'E'];
  if (Array.isArray(value)) {
    return value.map((item, index) => {
      const record = toLooseRecord(item);
      const label = readLooseText(record, ['label', 'letra', 'option', 'alternativa']).toUpperCase() || labels[index] || String(index + 1);
      const text = record
        ? readLooseText(record, ['text', 'texto', 'value', 'conteudo', 'content', 'description'])
        : String(item || '').trim();
      return {
        label,
        text,
        imageData: readExternalImageData(record),
        pageImageData: readLooseText(record, ['pageImageData', 'page_image_data', 'pageBase64']),
        figureBox: normalizeExtractionFigureBox(readLooseField(record, ['figureBox', 'box', 'bbox']) as FigureBox),
      };
    }).filter((option) => option.text || option.imageData);
  }
  const record = toLooseRecord(value);
  if (record) {
    return labels.map((label) => ({
      label,
      text: readLooseText(record, [label, label.toLowerCase()]),
      imageData: '',
      pageImageData: '',
      figureBox: undefined,
    })).filter((option) => option.text);
  }
  return [];
};

export const externalDetailedCommentIsGeneric = (value: string) => {
  const normalized = String(value || '').toLowerCase();
  if (!normalized.trim()) return false;

  const genericPatterns = [
    'não acompanha o critério decisivo do item',
    'não corresponde ao gabarito oficial',
    'corresponde ao gabarito oficial',
    'não atende ao comando da questão',
  ];
  const genericOccurrences = genericPatterns.reduce((total, pattern) => (
    total + normalized.split(pattern).length - 1
  ), 0);

  return genericOccurrences >= 2;
};

export const normalizeExternalAiContextPayload = (payload: unknown): ImportedContextDraft[] => {
  const contexts: ImportedContextDraft[] = [];
  const addContext = (key: string, value: unknown, index: number) => {
    const record = toLooseRecord(value);
    const title = readLooseText(record, ['title', 'titulo', 'name', 'nome']) || key || `Contexto ${index + 1}`;
    const text = record
      ? readLooseText(record, ['body', 'text', 'texto', 'value', 'conteudo', 'content'])
      : String(value || '').trim();
    const referenceText = sanitizeReferenceTextForImport(readLooseText(record, ['reference', 'referenceText', 'referencia', 'fonte']));
    const questionNumbers = parseQuestionNumberList(
      readLooseField(record, ['questionNumbers', 'questionIds', 'question_ids', 'questions', 'questoes', 'appliesTo', 'vinculadoAs']),
    );
    const contextImageData = readExternalImageData(record);
    const contextPageImageData = readLooseText(record, ['pageImageData', 'page_image_data', 'pageBase64']);
    const contextFigureBox = normalizeExtractionFigureBox(readLooseField(record, ['figureBox', 'box', 'bbox']) as FigureBox);
    const figures = [
      ...readLooseArray(record, ['assets']),
      ...readLooseArray(record, ['figures', 'imagens', 'images']),
    ].map((figure, figureIndex) => {
      const figureRecord = toLooseRecord(figure);
      return {
        figureKey: readLooseText(figureRecord, ['tempId', 'id', 'figureKey'])
          || `ai-context-${index + 1}-fig-${figureIndex + 1}`,
        type: 'figure',
        title: readLooseText(figureRecord, ['title', 'titulo', 'name', 'nome']) || `Figura ${figureIndex + 1}`,
        description: figureRecord
          ? readLooseText(figureRecord, ['description', 'descricao', 'text', 'texto'])
          : String(figure || '').trim(),
        imageData: readExternalImageData(figureRecord),
        pageImageData: readLooseText(figureRecord, ['pageImageData', 'page_image_data', 'pageBase64']),
        figureBox: normalizeExtractionFigureBox(readLooseField(figureRecord, ['figureBox', 'box', 'bbox']) as FigureBox),
        page: Number(readLooseField(figureRecord, ['page', 'pagina']) || 0) || undefined,
        order: figureIndex + 1,
      };
    });

    if (!text && !contextImageData && figures.length === 0) return;
    contexts.push({
      tempId: readLooseText(record, ['tempId', 'id', 'contextKey'])
        || `ai-context-${index + 1}-${slugify(title || key || 'contexto')}`,
      externalKey: key,
      title,
      text,
      referenceText,
      richText: text,
      questionNumbers,
      hasFigure: figures.length > 0 || Boolean(contextImageData || contextFigureBox || readLooseField(record, ['hasFigure', 'temFigura'])),
      figureDescription: readLooseText(record, ['figureDescription', 'descricaoFigura']) || figures.map((figure) => figure.description).filter(Boolean).join('\n'),
      page: Number(readLooseField(record, ['page', 'pagina']) || 0),
      sourcePage: Number(readLooseField(record, ['sourcePage', 'paginaFonte']) || readLooseField(record, ['page', 'pagina']) || 0) || undefined,
      imageData: contextImageData,
      pageImageData: contextPageImageData,
      figureBox: contextFigureBox,
      figures,
    });
  };

  if (Array.isArray(payload)) {
    payload.forEach((item, index) => addContext(`Contexto ${index + 1}`, item, index));
  } else {
    const record = toLooseRecord(payload);
    if (record) {
      Object.entries(record).forEach(([key, value], index) => addContext(key, value, index));
    }
  }

  return contexts;
};

export interface PageQuestionRange {
  pageNumber: number;
  minQuestion: number;
  maxQuestion: number;
}

export const inferProbablePagesForMissingQuestion = ({
  questionNumber,
  extractedQuestions,
  pageQuestionRanges,
  totalPages,
  expectedQuestionCount,
}: {
  questionNumber: number;
  extractedQuestions: ImportedQuestionDraft[];
  pageQuestionRanges: PageQuestionRange[];
  totalPages: number;
  expectedQuestionCount: number;
}): number[] => {
  const clampPage = (page: number) => Math.max(1, Math.min(Math.max(1, totalPages), page));
  const pages = new Set<number>();
  const knownQuestions = extractedQuestions
    .map((question) => ({
      number: normalizeQuestionNumber(question.questionNumber ?? question.number, 0),
      page: Number(question.sourcePage || 0),
      localized: question.qualityReport?.localized
        ?? question.extractionQuality?.localized
        ?? Boolean(String(question.text || question.enunciado || question.raw || '').trim()),
    }))
    .filter((item) => item.number > 0 && item.page > 0 && item.localized)
    .sort((left, right) => left.number - right.number);
  const previous = [...knownQuestions].reverse().find((item) => item.number < questionNumber);
  const next = knownQuestions.find((item) => item.number > questionNumber);

  if (previous && next) {
    const start = Math.min(previous.page, next.page);
    const end = Math.max(previous.page, next.page);
    if (end - start <= 2) {
      for (let page = start; page <= end; page += 1) pages.add(clampPage(page));
    } else {
      pages.add(clampPage(previous.page));
      pages.add(clampPage(Math.round((previous.page + next.page) / 2)));
      pages.add(clampPage(next.page));
    }
  } else if (previous) {
    pages.add(clampPage(previous.page));
    pages.add(clampPage(previous.page + 1));
  } else if (next) {
    pages.add(clampPage(next.page - 1));
    pages.add(clampPage(next.page));
  }

  pageQuestionRanges.forEach((range) => {
    if (questionNumber >= range.minQuestion - 1 && questionNumber <= range.maxQuestion + 1) {
      pages.add(clampPage(range.pageNumber));
    }
  });

  if (pages.size === 0 && totalPages > 0 && expectedQuestionCount > 0) {
    pages.add(clampPage(Math.ceil((questionNumber / expectedQuestionCount) * totalPages)));
  }

  return Array.from(pages).sort((left, right) => left - right).slice(0, 3);
};

export const scoreImportedQuestionDraft = (question: Question) => {
  const quality = buildQuestionExtractionQuality(question);
  const statementLength = stripHtml(getQuestionStatementText(question)).trim().length;
  const supportLength = stripHtml(getQuestionIntroText(question)).trim().length
    + stripHtml(getQuestionReferenceText(question)).trim().length;
  const optionCount = getQuestionOptionTexts(question).length;
  return (quality.origin === 'manual' ? 100000 : 0)
    + (quality.complete ? 50000 : 0)
    + (quality.localized ? 20000 : 0)
    + (isPlaceholderQuestion(question) ? -50000 : 0)
    + optionCount * 2000
    + Math.min(statementLength, 3000)
    + Math.min(supportLength, 2000)
    + (hasVisualOptionPayload(question) ? 500 : 0);
};

export const createExpectedQuestionPlaceholder = ({
  questionNumber,
  probablePages,
  metadata,
  correctOptionIndex,
  aiQuotaLimited = false,
  defaultFocus,
}: {
  questionNumber: number;
  probablePages: number[];
  metadata?: ImportMetadata;
  correctOptionIndex?: number;
  aiQuotaLimited?: boolean;
  defaultFocus?: QuestionTaxonomyLabel;
}): Question => {
  const agency = String(metadata?.agency || '').trim();
  const organizations = normalizeOrganizationList(metadata?.sources, metadata?.orgaos, metadata?.source);
  const roles = normalizeRoleList(metadata?.roles, metadata?.cargos, metadata?.role, metadata?.cargo);
  const year = Number(metadata?.year || metadata?.ano || 0);
  const level = String(metadata?.level || '').trim();
  const reasons: ImportedQuestionStatusReason[] = [
    'questao_nao_localizada',
    'questao_placeholder_criada',
    'enunciado_ausente',
    'alternativas_ausentes',
    'conteudo_nao_extraido',
    'aguardando_complemento_manual',
    'parser_mecanico_sem_correspondencia',
    ...(aiQuotaLimited ? ['ia_indisponivel_quota' as const] : []),
    ...(probablePages.length > 0 ? ['pagina_provavel' as const] : []),
    ...(Number.isInteger(correctOptionIndex) ? ['gabarito_indica_existencia' as const] : []),
  ];
  const quality: QuestionExtractionQuality = {
    origin: 'placeholder',
    confidence: 0,
    localized: false,
    complete: false,
    needsReview: true,
    reasons,
    probablePages: probablePages.length > 0 ? probablePages : undefined,
  };

  return {
    questionNumber,
    question_number: questionNumber,
    number: questionNumber,
    sourcePage: probablePages[0],
    source_page: probablePages[0],
    probablePages,
    text: '',
    raw: '',
    options: [],
    enunciado: '',
    enunciado_clean: '',
    introText: '',
    intro_text: '',
    referenceText: '',
    reference_text: '',
    bancas: agency ? [createTaxonomyLabel(agency, { sigla: agency })] : [],
    orgaos: organizations.map((organization) => createTaxonomyLabel(organization)),
    cargos: roles.map((role) => createTaxonomyLabel(role, { descricao: role })),
    assuntos: [],
    anos: Number.isFinite(year) && year > 0 ? [year] : [],
    carreiras: defaultFocus ? [defaultFocus] : [],
    niveis: level ? [createTaxonomyLabel(level)] : [],
    nivel: level || undefined,
    level: level || undefined,
    tiposProva: metadata?.examType ? [createTaxonomyLabel(metadata.examType)] : [],
    tipo: 'desconhecido',
    modality: 'desconhecido',
    questionType: 'desconhecido',
    dificuldade: 2,
    itens: [],
    resposta: Number.isInteger(correctOptionIndex) ? Number(correctOptionIndex) + 1 : 0,
    correctOptionIndex: Number.isInteger(correctOptionIndex) ? correctOptionIndex : undefined,
    status: 'incompleta',
    extractionStatus: 'incompleta',
    needsImportReview: true,
    statusReasons: reasons,
    validationReasons: reasons,
    rejectionReason: 'questao_nao_localizada',
    qualityReport: quality,
    extractionQuality: quality,
    questionOrigin: 'exam',
    question_origin: 'exam',
    stats: { totalAttempts: 0, correctCount: 0, wrongCount: 0 },
    comments: [],
  } as unknown as Question;
};

export const ensureExpectedQuestionDrafts = ({
  questions,
  expectedQuestionNumbers,
  diagnostics,
  probablePageByQuestion = {},
  defaultMetadata,
  pageQuestionRanges = [],
  totalPages = 0,
  answerKeyMap = {},
  defaultFocus,
}: {
  questions: ImportedQuestionDraft[];
  expectedQuestionNumbers: number[];
  diagnostics: ImportDiagnostics;
  probablePageByQuestion?: Record<number, number[]>;
  defaultMetadata?: ImportMetadata;
  pageQuestionRanges?: PageQuestionRange[];
  totalPages?: number;
  answerKeyMap?: Record<number, number>;
  defaultFocus?: QuestionTaxonomyLabel;
}): {
  questions: ImportedQuestionDraft[];
  createdPlaceholders: ImportedQuestionDraft[];
  diagnostics: ImportDiagnostics;
} => {
  const expected = Array.from(new Set(
    expectedQuestionNumbers.filter((number) => Number.isFinite(number) && number > 0),
  )).sort((left, right) => left - right);
  const bestByNumber = new Map<number, Question>();
  const duplicates = new Set<number>(diagnostics.duplicateQuestionNumbers || []);
  const unnumberedQuestions: Question[] = [];

  questions.forEach((draft) => {
    const question = draft as unknown as Question;
    const number = getReliableExtractedQuestionNumber(question);
    if (number <= 0) {
      unnumberedQuestions.push(question);
      return;
    }
    const previous = bestByNumber.get(number);
    if (previous) {
      duplicates.add(number);
    }
    if (!previous || scoreImportedQuestionDraft(question) > scoreImportedQuestionDraft(previous)) {
      bestByNumber.set(number, question);
    }
  });

  const realQuestions = Array.from(bestByNumber.values());
  const createdPlaceholders = expected
    .filter((number) => !bestByNumber.has(number))
    .map((number) => {
      const probablePages = probablePageByQuestion[number]
        || inferProbablePagesForMissingQuestion({
          questionNumber: number,
          extractedQuestions: realQuestions as unknown as ImportedQuestionDraft[],
          pageQuestionRanges,
          totalPages,
          expectedQuestionCount: expected.length,
        });
      const placeholder = createExpectedQuestionPlaceholder({
        questionNumber: number,
        probablePages,
        metadata: defaultMetadata,
        correctOptionIndex: answerKeyMap[number],
        aiQuotaLimited: Boolean(diagnostics.aiQuotaLimitReached),
        defaultFocus,
      });
      bestByNumber.set(number, placeholder);
      return placeholder as unknown as ImportedQuestionDraft;
    });

  const canonicalQuestions = [
    ...Array.from(bestByNumber.entries())
      .sort(([left], [right]) => left - right)
      .map(([, question]) => question),
    ...unnumberedQuestions,
  ];
  const coverage = auditQuestionCoverage(canonicalQuestions, expected);
  const nextDiagnostics: ImportDiagnostics = {
    ...diagnostics,
    expectedQuestionNumbers: coverage.expectedQuestionNumbers,
    extractedQuestionNumbers: coverage.extractedQuestionNumbers,
    localizedQuestionNumbers: coverage.localizedQuestionNumbers,
    completeQuestionNumbers: coverage.completeQuestionNumbers,
    incompleteQuestionNumbers: coverage.incompleteQuestionNumbers,
    missingQuestionNumbers: coverage.missingQuestionNumbers,
    placeholderQuestionNumbers: coverage.placeholderQuestionNumbers,
    visualPendingQuestionNumbers: coverage.visualPendingQuestionNumbers,
    duplicateQuestionNumbers: Array.from(duplicates).sort((left, right) => left - right),
    suspiciousQuestionNumbers: coverage.suspiciousQuestionNumbers,
    cardsCreatedCount: coverage.cardsCreatedCount,
    completeCardsCount: coverage.completeCardsCount,
    incompleteCardsCount: coverage.incompleteCardsCount,
    placeholderCardsCount: coverage.placeholderCardsCount,
  };

  return {
    questions: coverage.questions as unknown as ImportedQuestionDraft[],
    createdPlaceholders,
    diagnostics: nextDiagnostics,
  };
};

export const getTaxonomyText = (item: QuestionTaxonomyLabel | string | number | undefined | null) => {
  if (item === null || item === undefined) {
    return '';
  }
  if (typeof item === 'string' || typeof item === 'number') {
    return String(item).trim();
  }
  return String(item.name || item.nome || item.descricao || item.sigla || '').trim();
};

export const toQuestionFilterValue = (
  item: QuestionTaxonomyLabel | string | number | undefined | null,
): QuestionFilterValuePayload | null => {
  const label = getTaxonomyText(item);
  if (!label) {
    return null;
  }

  if (item && typeof item === 'object') {
    const payload: QuestionFilterValuePayload = {
      id: item.id ?? null,
      label,
      slug: item.slug ? String(item.slug) : undefined,
    };
    const metadataKeys: Array<keyof QuestionFilterValuePayload> = [
      'materia',
      'taxonomyLevel',
      'taxonomy_level',
      'provider',
      'externalId',
      'externalParentId',
      'externalRootId',
      'externalSlug',
      'parentName',
      'rootSubjectName',
      'palavrasChave',
    ];
    metadataKeys.forEach((key) => {
      const value = item[key];
      if (value !== undefined && value !== null && value !== '') {
        Object.assign(payload, { [key]: value });
      }
    });
    return payload;
  }

  return {
    id: null,
    label,
  };
};

export const toQuestionFilterValues = (
  values: Array<QuestionTaxonomyLabel | string | number | undefined | null> = [],
) => {
  const seen = new Set<string>();
  return values
    .map(toQuestionFilterValue)
    .filter((item): item is QuestionFilterValuePayload => Boolean(item))
    .filter((item) => {
      const key = `${item.id ?? ''}:${normalizeComparisonText(item.label)}`;
      if (seen.has(key)) {
        return false;
      }
      seen.add(key);
      return true;
      });
};

const normalizeTaxonomyLevel = (item: QuestionTaxonomyLabel) => (
  normalizeComparisonText(
    String(item.taxonomyLevel || item.taxonomy_level || ''),
  )
);

export const partitionQuestionTaxonomies = (
  assuntos: QuestionTaxonomyLabel[] = [],
) => {
  const subjects: QuestionTaxonomyLabel[] = [];
  const topics: QuestionTaxonomyLabel[] = [];
  const subtopics: QuestionTaxonomyLabel[] = [];
  const legacyNonSubjects: QuestionTaxonomyLabel[] = [];

  assuntos.forEach((item) => {
    const level = normalizeTaxonomyLevel(item);
    if (
      Boolean(item.materia)
      || level === 'materia'
      || level === 'disciplina'
      || level === 'subject'
    ) {
      subjects.push(item);
      return;
    }
    if (level.includes('topico') || level.includes('topic')) {
      topics.push(item);
      return;
    }
    if (
      level.includes('assunto')
      || level.includes('subtopico')
      || level.includes('subtopic')
    ) {
      subtopics.push(item);
      return;
    }
    legacyNonSubjects.push(item);
  });

  // Contratos antigos armazenavam [materia, topico, assunto...] sem nivel.
  // O fallback fica restrito a esses itens realmente sem classificacao.
  if (legacyNonSubjects.length > 0) {
    if (topics.length === 0) {
      topics.push(legacyNonSubjects[0]);
      subtopics.push(...legacyNonSubjects.slice(1));
    } else {
      subtopics.push(...legacyNonSubjects);
    }
  }

  return { subjects, topics, subtopics };
};

export const buildQuestionFiltersPayload = ({
  assuntos = [],
  bancas = [],
  orgaos = [],
  cargos = [],
  carreiras = [],
  anos = [],
  nivel,
  niveis = [],
  tiposProva = [],
  provas = [],
}: {
  assuntos?: QuestionTaxonomyLabel[];
  bancas?: QuestionTaxonomyLabel[];
  orgaos?: QuestionTaxonomyLabel[];
  cargos?: QuestionTaxonomyLabel[];
  carreiras?: QuestionTaxonomyLabel[];
  anos?: Array<string | number>;
  nivel?: string | null;
  niveis?: QuestionTaxonomyLabel[];
  tiposProva?: Array<QuestionTaxonomyLabel | string | number>;
  provas?: Array<QuestionTaxonomyLabel | string | number>;
}): QuestionFiltersPayload => {
  const {
    subjects,
    topics,
    subtopics,
  } = partitionQuestionTaxonomies(assuntos);

  return {
    materias: toQuestionFilterValues(subjects),
    topicos: toQuestionFilterValues(topics),
    assuntos: toQuestionFilterValues(subtopics),
    bancas: toQuestionFilterValues(bancas),
    orgaos: toQuestionFilterValues(orgaos),
    cargos: toQuestionFilterValues(cargos),
    carreiras: toQuestionFilterValues(carreiras),
    anos: toQuestionFilterValues(anos),
    niveis: toQuestionFilterValues([
      ...(niveis || []),
      nivel || undefined,
    ]),
    tiposProva: toQuestionFilterValues(tiposProva),
    provas: toQuestionFilterValues(provas),
  };
};

export const getQuestionTaxonomyParts = (question: Question) => {
  const taxonomies = partitionQuestionTaxonomies(
    (Array.isArray(question.assuntos) ? question.assuntos : []) as unknown as QuestionTaxonomyLabel[],
  );

  return {
    subject: getTaxonomyText(taxonomies.subjects[0]),
    topic: getTaxonomyText(taxonomies.topics[0]),
    specificSubject: getTaxonomyText(taxonomies.subtopics[0]),
  };
};

export const uniqueTextList = (values: unknown[]) => values
  .map((value) => {
    if (value && typeof value === 'object') {
      return getTaxonomyText(value as QuestionTaxonomyLabel);
    }
    return String(value || '').trim();
  })
  .filter((value, index, list) => value.length > 0 && list.indexOf(value) === index);

export const getRootFocusText = (value: string) => (
  String(value || '')
    .split('/')
    .map((part) => part.trim())
    .filter(Boolean)[0]
  || String(value || '').trim()
);

export const getFocusSelectValue = (item: QuestionTaxonomyLabel | string | number | undefined | null) => {
  if (item === null || item === undefined) {
    return '';
  }
  if (typeof item === 'string' || typeof item === 'number') {
    const value = getRootFocusText(String(item).trim());
    return value ? `name:${slugify(value)}` : '';
  }

  const id = String(item.id ?? '').trim();
  if (id) {
    return `id:${id}`;
  }
  const slug = String(item.slug ?? '').trim();
  if (slug) {
    return `slug:${slug}`;
  }
  const label = getTaxonomyText(item);
  return label ? `name:${slugify(getRootFocusText(label))}` : '';
};

export const normalizeFocusCandidate = (
  item: QuestionTaxonomyLabel | string | number | undefined | null,
  focusOptions: QuestionTaxonomyLabel[] = [],
) => {
  const rawName = getRootFocusText(getTaxonomyText(item));
  if (!rawName) {
    return null;
  }

  const candidateValue = getFocusSelectValue(item);
  const normalizedName = normalizeComparisonText(rawName);
  const normalizedSlug = normalizeComparisonText(slugify(rawName).replace(/-/g, ' '));
  const existing = focusOptions.find((focus) => (
    getFocusSelectValue(focus) === candidateValue
    || normalizeComparisonText(getTaxonomyText(focus)) === normalizedName
    || normalizeComparisonText(String(focus.slug || '').replace(/-/g, ' ')) === normalizedSlug
  ));

  if (existing) {
    const focusName = getRootFocusText(getTaxonomyText(existing));
    return focusName ? { ...existing, name: focusName, nome: focusName } : existing;
  }

  if (typeof item === 'object' && item !== null) {
    return { ...item, name: rawName, nome: rawName, slug: item.slug || slugify(rawName) };
  }

  return createTaxonomyLabel(rawName) as QuestionTaxonomyLabel;
};

export const findFocusByIdOrName = (
  focusOptions: QuestionTaxonomyLabel[] = [],
  idOrName: unknown,
) => {
  const rawValue = String(idOrName ?? '').trim();
  if (!rawValue) {
    return null;
  }

  const normalizedValue = normalizeComparisonText(rawValue);
  const normalizedSlugValue = normalizeComparisonText(rawValue.replace(/-/g, ' '));

  return focusOptions.find((focus) => (
    String(focus.id ?? '').trim() === rawValue
    || normalizeComparisonText(getTaxonomyText(focus)) === normalizedValue
    || normalizeComparisonText(String(focus.slug || '').replace(/-/g, ' ')) === normalizedSlugValue
  )) || null;
};

export const toLooseCandidateList = (value: unknown) => {
  if (Array.isArray(value)) {
    return value;
  }
  if (value === null || value === undefined || String(value).trim() === '') {
    return [];
  }
  return [value];
};

export const parseLooseRecordValue = (value: unknown): Record<string, unknown> | null => {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  if (typeof value !== 'string' || !value.trim()) {
    return null;
  }
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? parsed as Record<string, unknown>
      : null;
  } catch {
    return null;
  }
};

export const findTaxonomyByText = (
  items: QuestionTaxonomyLabel[] = [],
  value: unknown,
) => {
  const rawLabel = getTaxonomyText(value as QuestionTaxonomyLabel);
  const normalizedLabel = normalizeComparisonText(rawLabel);
  const normalizedSlug = normalizeComparisonText(String((value as QuestionTaxonomyLabel | undefined)?.slug || rawLabel).replace(/-/g, ' '));
  if (!normalizedLabel && !normalizedSlug) {
    return null;
  }

  return items.find((item) => (
    normalizeComparisonText(getTaxonomyText(item)) === normalizedLabel
    || normalizeComparisonText(String(item.slug || '').replace(/-/g, ' ')) === normalizedSlug
  )) || null;
};

export const getTaxonomyParentValue = (item: QuestionTaxonomyLabel | null | undefined) => {
  if (!item) {
    return undefined;
  }
  return item.parentId
    ?? item.parent_id
    ?? item.pai
    ?? item.focoId
    ?? item.foco_id
    ?? item.carreiraId
    ?? item.carreira_id;
};

export const getTaxonomyParentName = (item: QuestionTaxonomyLabel | null | undefined) => {
  if (!item) {
    return '';
  }
  return String(
    item.parentName
    ?? item.parent_name
    ?? item.paiNome
    ?? item.pai_nome
    ?? item.focoNome
    ?? item.foco_nome
    ?? item.carreiraNome
    ?? item.carreira_nome
    ?? '',
  ).trim();
};

export const resolveExamInheritedFocus = (
  exam: Prova | null,
  taxonomies: SystemSettings['taxonomies'],
) => {
  if (!exam) {
    return null;
  }

  const focusOptions = [
    ...((taxonomies?.careers || []) as unknown as QuestionTaxonomyLabel[]),
    ...((taxonomies?.areas || []) as unknown as QuestionTaxonomyLabel[]),
  ];
  const roleOptions = (taxonomies?.roles || []) as unknown as QuestionTaxonomyLabel[];
  const examRecord = exam as unknown as Record<string, unknown>;
  const metadataRecord = parseLooseRecordValue(
    readLooseField(examRecord, ['metadata', 'metadataJson', 'metadata_json', 'rawMetadata', 'raw_metadata']),
  ) || {};

  const directCandidates = [
    exam.focos,
    exam.carreiras,
    exam.foco,
    exam.carreira,
    readLooseField(examRecord, ['focos', 'carreiras', 'focuses', 'careers', 'areas']),
    readLooseField(examRecord, ['foco', 'carreira', 'focus', 'career', 'area']),
    readLooseField(metadataRecord, ['focos', 'carreiras', 'focuses', 'careers', 'areas']),
    readLooseField(metadataRecord, ['foco', 'carreira', 'focus', 'career', 'area']),
    readLooseField(metadataRecord, ['focusName', 'focus_name', 'focoNome', 'foco_nome', 'careerName', 'career_name']),
  ].flatMap(toLooseCandidateList);

  for (const candidate of directCandidates) {
    const normalized = normalizeFocusCandidate(candidate as QuestionTaxonomyLabel | string | number, focusOptions);
    if (normalized) {
      return normalized;
    }
  }

  const roleCandidates = [
    exam.cargos,
    exam.cargo,
    exam.roles,
    readLooseField(examRecord, ['cargos', 'roles', 'cargo', 'role']),
    readLooseField(metadataRecord, ['cargos', 'roles', 'cargo', 'role']),
  ].flatMap(toLooseCandidateList) as Array<QuestionTaxonomyLabel | string | number>;

  for (const roleCandidate of roleCandidates) {
    const roleRecord = typeof roleCandidate === 'object' && roleCandidate !== null
      ? roleCandidate as QuestionTaxonomyLabel
      : findTaxonomyByText(roleOptions, roleCandidate);
    const resolvedRole = roleRecord || findTaxonomyByText(roleOptions, roleCandidate);
    const parentValue = getTaxonomyParentValue(resolvedRole);
    const parentFocus = findFocusByIdOrName(focusOptions, parentValue)
      || findFocusByIdOrName(focusOptions, getTaxonomyParentName(resolvedRole));
    const normalizedParent = normalizeFocusCandidate(parentFocus, focusOptions);
    if (normalizedParent) {
      return normalizedParent;
    }
  }

  const signalText = normalizeComparisonText([
    exam.nome,
    exam.slug,
    getTaxonomyText(exam.banca as unknown as QuestionTaxonomyLabel),
    ...(exam.orgaos?.length ? exam.orgaos : [exam.orgao]).map((item) => getTaxonomyText(item as unknown as QuestionTaxonomyLabel)),
    ...(exam.cargos?.length ? exam.cargos : [exam.cargo]).map((item) => getTaxonomyText(item as unknown as QuestionTaxonomyLabel)),
    ...(Array.isArray(exam.roles) ? exam.roles : []),
  ].filter(Boolean).join(' '));

  const safeFocusLabel = signalText.match(/\b(policia|policial|bombeiro|militar|seguranca publica)\b/)
    ? focusOptions.find((focus) => {
      const label = normalizeComparisonText(getTaxonomyText(focus));
      return label.includes('policial') || label.includes('seguranca publica');
    })
    : null;

  return normalizeFocusCandidate(safeFocusLabel, focusOptions);
};

export const getExtractedQuestionNumber = (question: Question, fallback: number) => {
  const record = question as Question & {
    questionNumber?: number | string;
    question_number?: number | string;
    number?: number | string;
  };
  return normalizeQuestionNumber(record.questionNumber ?? record.question_number ?? record.number, fallback);
};

export const cleanExamTitlePart = (value: unknown) => String(value || '')
  .replace(/\s+/g, ' ')
  .replace(/\s*\(\d{4}\)\s*$/, '')
  .trim();

export const cleanExplicitExamTitle = (value: unknown) => String(value || '')
  .replace(/\s+/g, ' ')
  .trim();

export const readExamYear = (...values: unknown[]) => (
  values.map((value) => String(value || '').match(/\b(19\d{2}|20\d{2})\b/)?.[0]).find(Boolean) || ''
);

export const joinExamTitleParts = (...parts: unknown[]) => parts.map(cleanExamTitlePart).filter(Boolean).join(' - ');

export const buildStandardExamTitle = (metadata: ImportMetadata | null) => {
  const roles = normalizeRoleList(metadata?.roles, metadata?.cargos, metadata?.role || metadata?.cargo);
  const role = summarizeExamTitleList(
    roles,
    cleanExamTitlePart(metadata?.role || metadata?.cargo || metadata?.examName || metadata?.contestName),
  );
  const organizations = normalizeOrganizationList(metadata?.sources, metadata?.orgaos, metadata?.source);
  const agency = cleanExamTitlePart(metadata?.agency);
  const source = summarizeExamTitleList(organizations, cleanExamTitlePart(metadata?.source));
  const year = readExamYear(metadata?.year, metadata?.ano);
  return joinExamTitleParts(agency, year, source, role);
};

export const buildExamTitle = (metadata: ImportMetadata | null, fallback = 'Prova importada') => {
  const standardTitle = buildStandardExamTitle(metadata);
  const explicitTitle = cleanExplicitExamTitle(metadata?.title || metadata?.examTitle || metadata?.name || metadata?.nome);
  return explicitTitle || standardTitle || fallback;
};

export const buildImportExamTaxonomyMetadata = (metadata: ImportMetadata | null) => {
  const roleLabels = normalizeRoleList(metadata?.roles, metadata?.cargos, metadata?.role || metadata?.cargo);
  const organizationLabels = normalizeOrganizationList(metadata?.sources, metadata?.orgaos, metadata?.source);
  const roleSummary = summarizeExamTitleList(
    roleLabels,
    String(metadata?.role || metadata?.cargo || metadata?.examName || metadata?.contestName || '').trim(),
  );
  const sourceSummary = summarizeExamTitleList(organizationLabels, String(metadata?.source || '').trim());
  const agencyLabel = String(metadata?.agency || '').trim();
  const bankTaxonomy = agencyLabel ? createTaxonomyLabel(agencyLabel, { sigla: agencyLabel }) : undefined;
  const organizationTaxonomies = organizationLabels.map((organization) => createTaxonomyLabel(organization));
  const roleTaxonomies = roleLabels.map((role) => createTaxonomyLabel(role, { descricao: role }));

  return {
    agencyLabel,
    organizationLabels,
    organizationTaxonomies,
    roleLabels,
    roleTaxonomies,
    roleSummary,
    sourceSummary,
    payload: {
      agency: agencyLabel,
      source: sourceSummary,
      sources: organizationLabels,
      banca: bankTaxonomy,
      bancas: bankTaxonomy ? [bankTaxonomy] : [],
      orgao: organizationTaxonomies[0],
      orgaos: organizationTaxonomies,
      cargo: roleTaxonomies[0],
      role: roleSummary,
      roles: roleLabels,
      cargos: roleTaxonomies,
    },
  };
};

export const broaderTopicForSpecificSubject = (specificSubject: string, subject: string, fallbackTopic = '') => {
  const normalizedSpecific = normalizeComparisonText(specificSubject);
  const normalizedSubject = normalizeComparisonText(subject);
  const normalizedFallback = normalizeComparisonText(fallbackTopic);
  const languageSubject = /portugues|lingua portuguesa|gramatica|linguagens/.test(normalizedSubject);

  if (normalizedSpecific === 'crase') return 'Regência';
  if (/concordancia/.test(normalizedSpecific)) return 'Sintaxe';
  if (/regencia/.test(normalizedSpecific)) return 'Sintaxe';
  if (/pontuacao/.test(normalizedSpecific)) return languageSubject ? 'Sintaxe' : fallbackTopic;
  if (/acentuacao|ortografia/.test(normalizedSpecific)) return 'Fonologia e Ortografia';
  if (/ressonancia|frequencia|comprimento de onda|amplitude|interferencia|reflexao|refracao|difracao/.test(normalizedSpecific)) return 'Ondulatória';
  if (/calculo estequiometrico|mol|massa molar|balanceamento/.test(normalizedSpecific)) return 'Estequiometria';
  if (/area|perimetro|triangulo|circunferencia|poligono/.test(normalizedSpecific) && /geometria/.test(normalizedFallback)) return fallbackTopic;
  if (/inferencia|coesao|coerencia|sentido|referencia/.test(normalizedSpecific)) return 'Interpretação de texto';

  return fallbackTopic;
};

export const findEnemAreaLabel = (...values: unknown[]) => {
  const normalizedValues = values.map((value) => normalizeComparisonText(String(value || ''))).filter(Boolean);
  return ENEM_SUBJECT_AREA_OPTIONS.find((areaName) => {
    const normalizedArea = normalizeComparisonText(areaName);
    return normalizedValues.some((value) => value === normalizedArea || value.includes(normalizedArea));
  }) || '';
};

export const isEnemAreaLabel = (value: string) => ENEM_AREA_NORMALIZED_NAMES.has(normalizeComparisonText(value));

export const findEnemDisciplineLabel = (values: unknown[], areaLabel = '') => {
  const normalizedValues = values.map((value) => normalizeComparisonText(String(value || ''))).filter(Boolean);
  if (normalizedValues.length === 0) {
    return '';
  }

  const allowedLabels = areaLabel
    ? ENEM_SUBJECT_AREA_DESCRIPTIONS[areaLabel as keyof typeof ENEM_SUBJECT_AREA_DESCRIPTIONS] || ENEM_DISCIPLINE_LABELS
    : ENEM_DISCIPLINE_LABELS;
  const allowedNormalized = new Set(allowedLabels.map((label) => normalizeComparisonText(label)));

  for (const label of allowedLabels) {
    const normalizedLabel = normalizeComparisonText(label);
    const baseLabel = normalizeComparisonText(String(label).replace(/\s*\([^)]*\)\s*/g, ' '));
    if (normalizedValues.some((value) => value === normalizedLabel || value === baseLabel)) {
      return label;
    }
  }

  const keywordMatch = ENEM_DISCIPLINE_KEYWORDS.find(({ label, keywords }) => (
    allowedNormalized.has(normalizeComparisonText(label))
    && keywords.some((keyword) => normalizedValues.some((value) => value.includes(normalizeComparisonText(keyword))))
  ));

  return keywordMatch?.label || '';
};

export const isEnemImportSignal = (...values: unknown[]) => {
  const normalized = normalizeComparisonText(values.map((value) => String(value || '')).join(' '));
  return normalized.includes(normalizeComparisonText(ENEM_FOCUS_NAME))
    || normalized.includes('inep')
    || normalized.includes('exame nacional do ensino medio');
};

export const normalizeEnemTaxonomyHierarchy = (
  subject: string,
  topic: string,
  specificSubject: string,
  textSignals: unknown[] = [],
) => {
  const areaLabel = findEnemAreaLabel(subject, topic, specificSubject, ...textSignals);
  const subjectIsArea = isEnemAreaLabel(subject);
  const topicIsArea = isEnemAreaLabel(topic);

  if (!areaLabel && !subjectIsArea && !topicIsArea) {
    return { subject, topic, specificSubject };
  }

  const discipline = findEnemDisciplineLabel(
    [subject, topic, specificSubject, ...textSignals],
    areaLabel,
  );
  if (!discipline) {
    return { subject, topic, specificSubject };
  }

  const normalizedDiscipline = normalizeComparisonText(discipline);
  const nextTopic = topicIsArea || normalizeComparisonText(topic) === normalizedDiscipline
    ? broaderTopicForSpecificSubject(specificSubject, discipline, '')
    : topic;

  return {
    subject: discipline,
    topic: nextTopic,
    specificSubject,
  };
};

export const resolveTaxonomyHierarchy = (subject: string, topic: string, specificSubject: string) => {
  const normalizedTopic = normalizeComparisonText(topic);
  const normalizedSpecific = normalizeComparisonText(specificSubject);
  if (!normalizedSpecific || normalizedTopic !== normalizedSpecific) {
    return { subject, topic, specificSubject };
  }

  const broaderTopic = broaderTopicForSpecificSubject(specificSubject, subject, topic);
  return {
    subject,
    topic: broaderTopic && normalizeComparisonText(broaderTopic) !== normalizedSpecific ? broaderTopic : topic,
    specificSubject,
  };
};

export const EXTERNAL_AI_SUBJECT_KEYS = [
  'materia',
  'matéria',
  'subject',
  'disciplina',
  'discipline',
  'area',
  'área',
];

export const EXTERNAL_AI_TOPIC_KEYS = [
  'topico',
  'tópico',
  'topic',
  'tema',
  'theme',
];

export const EXTERNAL_AI_SPECIFIC_SUBJECT_KEYS = [
  'assunto',
  'specificSubject',
  'specific_subject',
  'assuntoEspecifico',
  'assunto_especifico',
  'assuntoEspecífico',
  'ponto',
  'conteudo',
  'conteúdo',
];

export const readExternalAiQuestionTaxonomy = (
  record: Record<string, unknown>,
  filters: Record<string, unknown>,
) => {
  const classification = toLooseRecord(readLooseField(record, [
    'classification',
    'classificacao',
    'classificação',
    'taxonomy',
    'taxonomia',
  ])) || {};

  const readFilterLabel = (keys: string[]) => {
    const direct = readLooseText(filters, keys);
    if (direct) return direct;
    const raw = readLooseField(filters, keys);
    const list = Array.isArray(raw) ? raw : [];
    const first = toLooseRecord(list[0]);
    return readLooseText(first, ['label', 'name', 'nome', 'title', 'titulo', 'slug']) || String(list[0] || '').trim();
  };

  let subject = (
    readFilterLabel(['subjects', 'materias', ...EXTERNAL_AI_SUBJECT_KEYS])
    || readLooseText(classification, EXTERNAL_AI_SUBJECT_KEYS)
    || readLooseText(record, EXTERNAL_AI_SUBJECT_KEYS)
  ).trim();
  let topic = (
    readFilterLabel(['topics', 'topicos', ...EXTERNAL_AI_TOPIC_KEYS])
    || readLooseText(classification, EXTERNAL_AI_TOPIC_KEYS)
    || readLooseText(record, EXTERNAL_AI_TOPIC_KEYS)
  ).trim();
  let specificSubject = (
    readFilterLabel(['subtopics', 'assuntos', ...EXTERNAL_AI_SPECIFIC_SUBJECT_KEYS])
    || readLooseText(classification, EXTERNAL_AI_SPECIFIC_SUBJECT_KEYS)
    || readLooseText(record, EXTERNAL_AI_SPECIFIC_SUBJECT_KEYS)
  ).trim();

  const normalizedSubject = normalizeComparisonText(subject);
  const normalizedTopic = normalizeComparisonText(topic);
  const normalizedSpecific = normalizeComparisonText(specificSubject);

  if (!normalizedSubject && normalizedTopic) {
    subject = topic;
    topic = specificSubject;
    specificSubject = '';
  } else if (normalizedSubject && normalizedSubject === normalizedTopic && normalizedSpecific && normalizedSpecific !== normalizedTopic) {
    topic = specificSubject;
    specificSubject = '';
  }

  return resolveTaxonomyHierarchy(subject, topic, specificSubject);
};

export const buildExternalAiQuestionTaxonomies = (taxonomy: {
  subject: string;
  topic: string;
  specificSubject: string;
}) => {
  const subject = taxonomy.subject.trim()
    ? createTaxonomyLabel(taxonomy.subject, { materia: true })
    : null;
  const topic = taxonomy.topic.trim()
    ? createTaxonomyLabel(taxonomy.topic, { materia: false, parentName: taxonomy.subject || undefined })
    : null;
  const specificSubject = taxonomy.specificSubject.trim()
    ? createTaxonomyLabel(taxonomy.specificSubject, { materia: false, parentName: taxonomy.topic || taxonomy.subject || undefined })
    : null;

  return [subject, topic, specificSubject].filter(Boolean) as unknown as Question['assuntos'];
};

export const buildQuestionPayloadImportCard = ({
  questionNumber,
  statement,
  introText,
  referenceText,
  teacherComment,
  detailedComment,
  contextKey,
  bancas,
  orgaos,
  cargos,
  assuntos,
  anos,
  carreiras,
  niveis,
  nivel,
  tiposProva,
  tipo,
  dificuldade,
  itens,
  resposta,
  correctOptionIndex,
  hasFigure,
  figureDescription,
  supportImages,
  status,
  needsImportReview,
  reasons,
  quality,
}: QuestionCreateImportCardParams): Question => {
  const importTempId = `ai-json-${questionNumber}`;
  const alternativePayloads: QuestionAlternativePayload[] = itens.map((item, index) => ({
    tempId: `q_${questionNumber}_alt_${String.fromCharCode(97 + index)}`,
    order: index + 1,
    label: String(item.rotulo || String.fromCharCode(65 + index)),
    text: String(item.corpo || ''),
    textClean: stripHtml(String(item.corpo_clean || item.corpo || '')),
    assets: [],
  }));
  const correctAlternative = alternativePayloads[correctOptionIndex] || null;
  const assetPayload = (supportImages || [])
    .map((image, index) => {
      const record = image as unknown as Record<string, unknown>;
      const tempId = String(record.tempId || record.id || `q_${questionNumber}_img_${index + 1}`);
      const rawImageData = String(record.imageData || record.base64 || '');
      const explicitUrl = String(record.url || '');
      const url = explicitUrl || (/^https:\/\//i.test(rawImageData) ? rawImageData : '');
      const imageData = url === rawImageData ? '' : rawImageData;
      return {
        tempId,
        type: 'image' as const,
        usage: 'support' as const,
        url,
        base64: imageData,
        alt: String(record.description || record.alt || record.caption || ''),
        caption: String(record.caption || ''),
        sourcePage: record.page ? String(record.page) : null,
        order: index + 1,
      };
    });
  const questionCreatePayload: QuestionPayload = {
    tempId: importTempId,
    id: null,
    source: {
      origin: 'exam',
      examId: null,
      questionNumber,
      contextTempId: contextKey || null,
      sourcePage: null,
    },
    content: {
      statement,
      statementClean: stripHtml(statement),
      supportText: introText,
      reference: referenceText,
    },
    assets: assetPayload,
    filters: buildQuestionFiltersPayload({
      assuntos: assuntos as unknown as QuestionTaxonomyLabel[],
      bancas: (bancas || []) as unknown as QuestionTaxonomyLabel[],
      orgaos: (orgaos || []) as unknown as QuestionTaxonomyLabel[],
      cargos: (cargos || []) as unknown as QuestionTaxonomyLabel[],
      carreiras: (carreiras || []) as unknown as QuestionTaxonomyLabel[],
      anos: (anos || []) as Array<string | number>,
      nivel: nivel ? String(nivel) : null,
      niveis: (niveis || []) as unknown as QuestionTaxonomyLabel[],
      tiposProva: (tiposProva || []) as Array<QuestionTaxonomyLabel | string | number>,
    }),
    type: tipo,
    difficulty: String(dificuldade),
    alternatives: alternativePayloads,
    answer: {
      mode: tipo === 'true_false' || tipo === 'certo ou errado' ? 'boolean' : 'single',
      raw: correctAlternative?.label || '',
      correctAlternativeTempIds: correctAlternative?.tempId ? [correctAlternative.tempId] : [],
    },
    editorial: [
      { type: 'teacher_comment', title: '', body: teacherComment, status: 'draft' },
      { type: 'detailed_analysis', title: '', body: detailedComment, status: 'draft' },
    ],
    publication: {
      status: 'draft',
      visibility: 'public',
      scheduledAt: null,
    },
    review: {
      required: needsImportReview,
      status: needsImportReview ? 'pending' : 'reviewed',
      reasons,
    },
  };

  const legacyCompatibilityMirror = {
    enunciado: statement,
    enunciado_clean: stripHtml(statement),
    introText,
    referenceText,
    bancas: bancas as unknown as Question['bancas'],
    orgaos: orgaos as unknown as Question['orgaos'],
    cargos: cargos as unknown as Question['cargos'],
    assuntos,
    anos,
    carreiras,
    niveis,
    nivel,
    level: nivel,
    tiposProva,
    tipo,
    dificuldade,
    itens,
    resposta,
    questionOrigin: 'exam',
    question_origin: 'exam',
    grupoQuestao: undefined,
    grupoQuestaoId: null,
    grupo_questao_id: null,
    teacherComment,
    detailedComment,
    hasTeacherComment: Boolean(teacherComment.trim()),
    hasDetailedComment: Boolean(detailedComment.trim()),
    stats: { totalAttempts: 0, correctCount: 0, wrongCount: 0 },
  } as unknown as Question;

  const {
    id: _payloadId,
    ...questionPayloadForCard
  } = questionCreatePayload;

  const importCard: ImportedQuestionDraft = {
    ...legacyCompatibilityMirror,
    ...questionPayloadForCard,
    importTempId,
    hashId: importTempId,
    hash: importTempId,
    questionCreatePayload,
    editorial: questionCreatePayload.editorial,
    editorialComments: {
      teacherComment,
      detailedComment,
    },
    questionNumber,
    question_number: questionNumber,
    number: questionNumber,
    contextKey,
    grupoQuestaoTempId: contextKey || undefined,
    contextTempId: contextKey || undefined,
    hasFigure,
    figureDescription,
    supportImages,
    correctOptionIndex,
    status,
    extractionStatus: status,
    needsImportReview,
    statusReasons: reasons,
    validationReasons: reasons,
    qualityReport: quality,
    extractionQuality: quality,

    // Compatibilidade temporaria da revisao: estes nomes nao fazem parte do payload final.
    text: statement,
    raw: statement,
    supportText: introText,
    intro_text: introText,
    reference_text: referenceText,
    modality: tipo as ImportedQuestionType,
    questionType: tipo as ImportedQuestionType,
    difficulty: String(dificuldade),
    options: itens.map((item) => stripHtml(item.corpo || '').trim()).filter(Boolean),
  };

  return importCard as Question;
};

export const buildCanonicalAlternativesFromQuestion = (question: Question): QuestionAlternativePayload[] => {
  if (Array.isArray(question.itens) && question.itens.length) {
    return question.itens.map((item, index) => ({
      tempId: `alt_${String.fromCharCode(97 + index)}`,
      order: item.ordem || index + 1,
      label: item.rotulo || String.fromCharCode(65 + index),
      text: item.corpo || '',
      textClean: stripHtml(item.corpo_clean || item.corpo || ''),
      assets: [],
    }));
  }

  if (Array.isArray(question.alternatives) && question.alternatives.length) {
    return question.alternatives.map((alternative, index) => ({
      tempId: alternative.tempId || alternative.id || `alt_${String.fromCharCode(97 + index)}`,
      ...(alternative.id ? { id: alternative.id } : {}),
      order: alternative.order || index + 1,
      label: alternative.label || String.fromCharCode(65 + index),
      text: alternative.text || '',
      textClean: alternative.textClean || stripHtml(alternative.text || ''),
      assets: alternative.assets || [],
    }));
  }

  return [];
};

export const syncCanonicalQuestionPayload = (question: Question): Question => {
  const alternatives = buildCanonicalAlternativesFromQuestion(question);
  const correctIndex = Number.isInteger((question as ImportedQuestionDraft).correctOptionIndex)
    ? Number((question as ImportedQuestionDraft).correctOptionIndex)
    : Math.max(0, Number(question.resposta || 1) - 1);
  const correctAlternative = alternatives[correctIndex] || null;
  const existingComments = question.editorialComments || {};
  const teacherComment = question.editorial?.find((item) => item.type === 'teacher_comment')?.body
    || existingComments.teacherComment
    || question.teacherComment
    || '';
  const detailedComment = question.editorial?.find((item) => item.type === 'detailed_analysis')?.body
    || existingComments.detailedComment
    || question.detailedComment
    || '';
  const syncedFilters = buildQuestionFiltersPayload({
    assuntos: (question.assuntos || []) as unknown as QuestionTaxonomyLabel[],
    bancas: (question.bancas || []) as unknown as QuestionTaxonomyLabel[],
    orgaos: (question.orgaos || []) as unknown as QuestionTaxonomyLabel[],
    cargos: (question.cargos || []) as unknown as QuestionTaxonomyLabel[],
    carreiras: (question.carreiras || []) as unknown as QuestionTaxonomyLabel[],
    anos: (question.anos || []) as Array<string | number>,
    nivel: (question.nivel || question.level || null) as string | null,
    niveis: ((question as Question & { niveis?: QuestionTaxonomyLabel[] }).niveis || []) as QuestionTaxonomyLabel[],
    tiposProva: (question.tiposProva || []) as Array<QuestionTaxonomyLabel | string | number>,
    provas: ((question.provas || []) as unknown) as Array<QuestionTaxonomyLabel | string | number>,
  });
  const existingPayload = (question as ImportedQuestionDraft).questionCreatePayload;
  const syncedQuestionCreatePayload = existingPayload
    ? {
      ...existingPayload,
      content: {
        statement: question.content?.statement || question.enunciado || '',
        statementClean: question.content?.statementClean || stripHtml(question.enunciado || ''),
        supportText: question.content?.supportText || question.introText || question.intro_text || '',
        reference: question.content?.reference || question.referenceText || question.reference_text || '',
      },
      filters: syncedFilters,
      alternatives,
      answer: {
        mode: question.answer?.mode || question.answer?.type || 'single',
        raw: correctAlternative?.label || question.answer?.raw || question.answer?.value || '',
        correctAlternativeTempIds: correctAlternative?.tempId ? [correctAlternative.tempId] : question.answer?.correctAlternativeTempIds || [],
      },
      editorial: [
        { type: 'teacher_comment', title: '', body: teacherComment, status: 'draft' },
        { type: 'detailed_analysis', title: '', body: detailedComment, status: 'draft' },
      ],
      review: {
        required: Boolean((question as ImportedQuestionDraft).needsImportReview || question.review?.required || question.review?.needsReview),
        status: ((question as ImportedQuestionDraft).needsImportReview || question.review?.required || question.review?.needsReview) ? 'pending' : 'reviewed',
        reasons: Array.from(new Set([
          ...(question.review?.reasons || question.review?.statusReasons || []),
          ...(((question as ImportedQuestionDraft).statusReasons || []) as string[]),
        ])),
      },
    }
    : undefined;

  return {
    ...question,
    questionCreatePayload: syncedQuestionCreatePayload,
    content: {
      statement: question.content?.statement || question.enunciado || '',
      statementClean: question.content?.statementClean || stripHtml(question.enunciado || ''),
      supportText: question.content?.supportText || question.introText || question.intro_text || '',
      reference: question.content?.reference || question.referenceText || question.reference_text || '',
    },
    filters: syncedFilters,
    alternatives,
    answer: {
      mode: question.answer?.mode || question.answer?.type || 'single',
      raw: correctAlternative?.label || question.answer?.raw || question.answer?.value || '',
      correctAlternativeTempIds: correctAlternative?.tempId ? [correctAlternative.tempId] : question.answer?.correctAlternativeTempIds || [],
    },
    editorial: [
      { type: 'teacher_comment', title: '', body: teacherComment, status: 'draft' },
      { type: 'detailed_analysis', title: '', body: detailedComment, status: 'draft' },
    ],
    editorialComments: { teacherComment, detailedComment },
    review: {
      required: Boolean((question as ImportedQuestionDraft).needsImportReview || question.review?.required || question.review?.needsReview),
      status: ((question as ImportedQuestionDraft).needsImportReview || question.review?.required || question.review?.needsReview) ? 'pending' : 'reviewed',
      reasons: Array.from(new Set([
        ...(question.review?.reasons || question.review?.statusReasons || []),
        ...(((question as ImportedQuestionDraft).statusReasons || []) as string[]),
      ])),
    },
  } as Question;
};

export const parseSubjectsInput = (value: string) => String(value || '')
  .split(/[,;\n]/)
  .map((item) => item.trim())
  .filter((item, index, list) => item.length > 0 && list.indexOf(item) === index);

export const deriveQuestionSubjects = (questions: Question[]) => questions
  .flatMap((question) => (question.assuntos || [])
    .filter((subject) => Boolean(subject.materia))
    .map((subject) => getTaxonomyText(subject as unknown as QuestionTaxonomyLabel)))
  .filter((subject, index, list) => subject.length > 0 && list.indexOf(subject) === index);

export const applySharedExamMetadataToQuestion = (
  question: Question,
  field: ImportMetadataField,
  value: string,
): Question => {
  if (field === 'agency') {
    return {
      ...question,
      bancas: value ? [createTaxonomyLabel(value, { sigla: value })] : [],
    } as Question;
  }

  if (field === 'source') {
    const organizations = normalizeOrganizationList(value);
    return {
      ...question,
      orgaos: organizations.map((organization) => createTaxonomyLabel(organization)),
    } as Question;
  }

  if (field === 'role') {
    const roles = normalizeRoleList(value);
    return {
      ...question,
      cargos: roles.map((role) => createTaxonomyLabel(role, { descricao: role })),
    } as unknown as Question;
  }

  if (field === 'year') {
    const parsedYear = Number(String(value).replace(/\D/g, ''));
    return {
      ...question,
      anos: Number.isFinite(parsedYear) && parsedYear > 0 ? [parsedYear] : [],
      year: Number.isFinite(parsedYear) && parsedYear > 0 ? parsedYear : undefined,
      ano: Number.isFinite(parsedYear) && parsedYear > 0 ? parsedYear : undefined,
    } as Question & { year?: number; ano?: number };
  }

  if (field === 'level') {
    return {
      ...question,
      nivel: value || null,
      level: value || null,
      niveis: value ? [createTaxonomyLabel(value)] : [],
    } as Question & { niveis?: QuestionTaxonomyLabel[] };
  }

  if (field === 'examType') {
    return {
      ...question,
      tiposProva: value ? [createTaxonomyLabel(value)] : [],
    } as unknown as Question;
  }

  return question;
};

export const applyExamYearToQuestion = (
  question: Question,
  metadata?: ImportMetadata | null,
): Question => {
  const parsedYear = Number(readExamYear(metadata?.year, metadata?.ano));
  if (!Number.isFinite(parsedYear) || parsedYear <= 0) {
    return question;
  }

  return applySharedExamMetadataToQuestion(question, 'year', String(parsedYear));
};

export const yieldToImportReviewPaint = () => new Promise<void>((resolve) => {
  if (typeof window !== 'undefined' && typeof window.requestAnimationFrame === 'function') {
    window.requestAnimationFrame(() => resolve());
    return;
  }

  setTimeout(resolve, 0);
});
