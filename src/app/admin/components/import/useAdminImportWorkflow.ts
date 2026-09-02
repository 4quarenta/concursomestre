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

import { useEffect, useMemo, useRef, useState } from 'react';
import type {
  Prova,
  Question,
  QuestionAlternativePayload,
  QuestionAsset,
  QuestionFiltersPayload,
  QuestionFilterValuePayload,
  QuestionPayload,
  QuestionTaxonomyLabel,
  SystemSettings,
} from '@types';
import { aiService, questionService, type PageExtractionResult } from '@services/questions';
import { fetchAuthenticatedResource } from '@services/api';
import { adminService } from '@services/admin/adminService';
import { examService } from '@services/exams/examService';
import {
  ENEM_FOCUS_NAME,
  ENEM_SUBJECT_AREA_DESCRIPTIONS,
  ENEM_SUBJECT_AREA_OPTIONS,
} from '@services/filters';
import { normalizeProvaRecord } from '../exams/examBankUtils';
import { useAppConfigStore } from '@/state/app-config/appConfigStore';
import { runPythonExtractor } from './pythonExtractorClient';
import { buildImportedContextsForPublication } from './granReviewPublicationCore';
import { readCanonicalQuestionFilters, resolveFirstQuestionFocus } from './adminImportCanonicalFilters';
import {
  type GenerateSpecificType,
  type ImportPublishAction,
  type ImportedQuestionDraft,
  type QuestionExtractionQuality,
  type ImportMetadata,
  type FigureBox,
  type UseAdminImportWorkflowOptions,
  type ImportedContextDraft,
  type ImportedQuestionImageDraft,
  type ImportDiagnostics,
  type ImportAiBudget,
  type ImportAiCallReservation,
  type AiExtractionPurpose,
  type PdfPageRichText,
  type PdfDocumentProxy,
  type PdfJsModule,
  type PositionedPdfTextItem,
  type PageContentBlock,
  type ImportedQuestionStatusReason,
  type PageQuestionRange,
  type ImportMetadataField,
  type ExtractedQuestionEditableField,
  EXAM_IMPORT_PARSER_VERSION,
  loadPdfJsModule,
  readErrorMessage,
  isAiTokenLimitError,
  isAiQuotaLimitError,
  readExpectedQuestionTotal,
  buildSequentialQuestionNumbers,
  resolveExpectedQuestionNumbersForImport,
  stripHtml,
  escapeHtml,
  escapeRegExp,
  formatStructuredSupportHtml,
  normalizeInlineText,
  toImportMetadata,
  toImportedQuestionDraft,
  slugify,
  normalizeComparisonText,
  OPTION_LABELS,
  buildAdaptiveExamParserProfile,
  resolveExamParserProfile,
  normalizePdfTextForParsing,
  readPdfTextStyle,
  normalizePdfCoord,
  isBoldPdfTextStyle,
  isItalicPdfTextStyle,
  isUnderlinePdfTextStyle,
  shouldIgnoreDominantHighlight,
  reconstructPdfTextLines,
  detectPdfTextColumns,
  reconstructPdfTextBlocks,
  buildPlainTextFromPdfLayout,
  buildPlainPdfText,
  mergeAdjacentHighlights,
  buildRichTextFromPdfLayout,
  buildHighlightedPdfTextHtml,
  classifyPdfPageType,
  normalizeOrganizationList,
  normalizeRoleList,
  summarizeExamTitleList,
  toPromptHint,
  toLooseRecord,
  VISUAL_BLOCK_PATTERN,
  buildPageContentInventory,
  mergeExtractionContextList,
  extractContextsFromPageInventory,
  enrichMechanicalExtractionFromInventory,
  estimatePdfQuestionRegionBox,
  applyPdfHighlightsToHtml,
  ENEM_AREA_NORMALIZED_NAMES,
  normalizeQuestionNumber,
  isImportedQuestionMarkedCanceled,
  isImportedQuestionAttributedToAll,
  normalizeCanceledImportedQuestion,
  questionCommandPattern,
  isLikelyInstructionText,
  visualOptionPlaceholderPattern,
  isLikelyPageBookletHeader,
  sanitizeSupportContextText,
  sanitizeReferenceTextForImport,
  mergeReferenceText,
  splitQuestionSupportReference,
  estimatePdfResourceRegionBox,
  shouldRepairQuestionPartsWithAi,
  normalizeAiRepairedOptions,
  shouldPromoteAsSupportContext,
  textNeedsExternalSupportContext,
  findCarryoverTextContextForQuestion,
  extractExplicitContextQuestionNumbers,
  resolveScopedContextQuestionNumbers,
  extractQuestionNumbersFromText,
  normalizeQuestionMarkerText,
  readOptionMarkers,
  stripTrailingExamNoise,
  normalizeImportedOptions,
  splitSupportContextFromStatement,
  splitInlineSupportContextFromStatement,
  inferExpectedOptionsCountFromText,
  getExpectedOptionsCount,
  inferQuestionType,
  validateExtractedQuestionDraft,
  refreshManuallyEditedImportQuestion,
  getQuestionPublicationBlockReasons,
  inferQuestionExtractionOrigin,
  getQuestionExpectedOptionsCount,
  getQuestionIntroText,
  getQuestionReferenceText,
  getQuestionStatementText,
  getQuestionOptionTexts,
  hasVisualOptionPayload,
  buildFinalQuestionReviewRawText,
  getReliableExtractedQuestionNumber,
  auditQuestionCoverage,
  isQuestionReadyForImportPublication,
  publishSelectedImportQuestionEntries,
  shouldRunFinalQuestionPartsReview,
  getImportedQuestionNumber,
  getPublishedExamId,
  getPublishedQuestionNumberFromRecord,
  completeQuestionOptionsFromPrefix,
  shouldUseAnswerKeyPage,
  ATTRIBUTED_TO_ALL_ANSWER_INDEX,
  CANCELED_ANSWER_INDEX,
  parseAnswerKeyFromText,
  buildBookletMetadata,
  inferMetadataFromText,
  findQuestionMarkers,
  extractStructuredPrefixBeforeFirstQuestion,
  createMechanicalExtractionFromText,
  questionLikelyHasVisualAlternatives,
  extractionLikelyNeedsSupportContextFallback,
  extractionNeedsAi,
  decideAiExtractionForPage,
  getQuestionFieldMetadata,
  hashTextForImportCache,
  computeArrayBufferFingerprint,
  buildFigureBoxCacheSignature,
  annotatePageExtractionResult,
  normalizeExtractionFigureBox,
  normalizeExtractionFigureBoxes,
  mergeFigureBoxes,
  mergeQuestionEditorialPatch,
  mergePageExtractionResults,
  normalizeDifficulty,
  createTaxonomyLabel,
  readLooseField,
  readLooseText,
  readLooseArray,
  readLooseMetadataTextList,
  readLooseStructuredList,
  firstMetadataText,
  extractJsonObjectText,
  normalizeAnswerIndex,
  inferImportedQuestionTypeFromPayload,
  readExternalImageData,
  normalizeAiQuestionOptions,
  externalDetailedCommentIsGeneric,
  normalizeExternalAiContextPayload,
  inferProbablePagesForMissingQuestion,
  ensureExpectedQuestionDrafts,
  createExpectedQuestionPlaceholder,
  getTaxonomyText,
  getQuestionTaxonomyParts,
  uniqueTextList,
  getRootFocusText,
  getFocusSelectValue,
  resolveExamInheritedFocus,
  getExtractedQuestionNumber,
  buildExamTitle,
  buildImportExamTaxonomyMetadata,
  isEnemImportSignal,
  normalizeEnemTaxonomyHierarchy,
  resolveTaxonomyHierarchy,
  readExternalAiQuestionTaxonomy,
  buildExternalAiQuestionTaxonomies,
  readExternalQuestionSourcePayload,
  buildQuestionPayloadImportCard,
  syncCanonicalQuestionPayload,
  deriveQuestionSubjects,
  applyExamYearToQuestion,
  applySharedExamMetadataToQuestion,
  parseSubjectsInput,
  yieldToImportReviewPaint,
} from './adminImportWorkflowCore';
export type { GenerateSpecificType, ImportPublishAction } from './adminImportWorkflowCore';
export const useAdminImportWorkflow = ({
  enabled = true,
  systemSettings,
  addToast,
  onImportedQuestionsSaved,
}: UseAdminImportWorkflowOptions) => {
  const [qFile, setQFile] = useState<File | null>(null);
  const [kFile, setKFile] = useState<File | null>(null);
  const [examBank, setExamBank] = useState<Prova[]>([]);
  const [isLoadingExamBank, setIsLoadingExamBank] = useState(false);
  const [selectedExamId, setSelectedExamId] = useState('');
  const [inheritedProofFileName, setInheritedProofFileName] = useState('');
  const [inheritedAnswerKeyFileName, setInheritedAnswerKeyFileName] = useState('');
  const [selectedFocusId, setSelectedFocusId] = useState('');
  const [manualFocusName, setManualFocusName] = useState('');
  const [importMetadata, setImportMetadata] = useState<ImportMetadata | null>(null);
  const [extractedContexts, setExtractedContexts] = useState<ImportedContextDraft[]>([]);
  const [importDiagnostics, setImportDiagnostics] = useState<ImportDiagnostics>({
    expectedQuestionNumbers: [],
    extractedQuestionNumbers: [],
    localizedQuestionNumbers: [],
    completeQuestionNumbers: [],
    incompleteQuestionNumbers: [],
    missingQuestionNumbers: [],
    placeholderQuestionNumbers: [],
    visualPendingQuestionNumbers: [],
    duplicateQuestionNumbers: [],
    suspiciousQuestionNumbers: [],
    cardsCreatedCount: 0,
    completeCardsCount: 0,
    incompleteCardsCount: 0,
    placeholderCardsCount: 0,
  });
  const [isProcessing, setIsProcessing] = useState(false);
  const [extractWithComment, setExtractWithComment] = useState(false);
  const [extractWithDetailedAnalysis, setExtractWithDetailedAnalysis] = useState(false);
  const [examProgress, setExamProgress] = useState(0);
  const [keyProgress, setKeyProgress] = useState(0);
  const [logs, setLogs] = useState<string[]>([]);
  const [extractedQuestions, setExtractedQuestions] = useState<Question[]>([]);
  const [isBulkGenerating, setIsBulkGenerating] = useState(false);
  const [bulkGenerationType, setBulkGenerationType] = useState<GenerateSpecificType | null>(null);
  const [isRetryingMissingQuestions, setIsRetryingMissingQuestions] = useState(false);
  const [bulkProgress, setBulkProgress] = useState(0);
  const [generatingSpecific, setGeneratingSpecific] = useState<{ index: number; type: GenerateSpecificType } | null>(null);
  const [publishedExam, setPublishedExam] = useState<Record<string, unknown> | null>(null);
  const [publishedQuestionNumbers, setPublishedQuestionNumbers] = useState<number[]>([]);
  const [publishingAction, setPublishingAction] = useState<ImportPublishAction | null>(null);
  const publishingActionRef = useRef<ImportPublishAction | null>(null);
  const selectedExam = useMemo(
    () => examBank.find((exam) => String(exam.id) === selectedExamId) || null,
    [examBank, selectedExamId],
  );
  const selectedExamRecord = useMemo(
    () => (selectedExam ? ({ ...selectedExam } as unknown as Record<string, unknown>) : null),
    [selectedExam],
  );
  const activePublishedExam = selectedExamRecord || publishedExam;
  const activePublishedExamId = getPublishedExamId(activePublishedExam);
  const selectedExamFocus = useMemo(
    () => resolveExamInheritedFocus(selectedExam, systemSettings.taxonomies),
    [selectedExam, systemSettings.taxonomies],
  );
  useEffect(() => {
    if (!enabled) {
      setIsLoadingExamBank(false);
      return;
    }
    let active = true;
    setIsLoadingExamBank(true);
    examService.list({ limit: 500, status: 'published,draft' })
      .then((items) => {
        if (active) setExamBank(items);
      })
      .catch((error) => {
        if (active) addLog(`Banco de provas indisponivel: ${readErrorMessage(error)}`);
      })
      .finally(() => {
        if (active) setIsLoadingExamBank(false);
      });
    return () => {
      active = false;
    };
  // The exam list is loaded once for this workbench session.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled]);
  const getSelectedExamMetadata = (): ImportMetadata => {
    if (!selectedExam) return {};
    const selectedExamRecordForMetadata = selectedExam as unknown as Record<string, unknown>;
    const organizations = (selectedExam.orgaos?.length ? selectedExam.orgaos : [selectedExam.orgao])
      .filter(Boolean)
      .map((item) => String(item.sigla || item.nome || item.name || '').trim())
      .filter(Boolean);
    const roles = (selectedExam.cargos?.length ? selectedExam.cargos : [selectedExam.cargo])
      .filter(Boolean)
      .map((item) => String(item.descricao || item['descrição'] || item.name || '').trim())
      .filter(Boolean);
    const agency = String(selectedExam.banca?.sigla || selectedExam.banca?.nome || '').trim();
    const totalQuestions = readExpectedQuestionTotal(
      selectedExam.totalQuestoes,
      selectedExamRecordForMetadata.totalQuestions,
      selectedExamRecordForMetadata.total_questions,
      selectedExamRecordForMetadata.questionCount,
      selectedExamRecordForMetadata.questoes,
      selectedExamRecordForMetadata.questions,
      selectedExamRecordForMetadata.metadata,
    );
    return {
      agency,
      year: String(selectedExam.ano),
      ano: selectedExam.ano,
      title: selectedExam.nome,
      examTitle: selectedExam.nome,
      name: selectedExam.nome,
      nome: selectedExam.nome,
      source: organizations[0] || '',
      sources: organizations,
      role: roles[0] || '',
      roles,
      level: selectedExam.nivel || '',
      caderno: selectedExam.caderno || selectedExam.tipoCaderno || '',
      tipoCaderno: selectedExam.tipoCaderno || selectedExam.bookletType || '',
      corCaderno: selectedExam.corCaderno || selectedExam.bookletColor || '',
      ...(totalQuestions > 0
        ? {
          totalQuestions,
          total_questions: totalQuestions,
          totalQuestoes: totalQuestions,
          questionCount: totalQuestions,
        }
        : {}),
    };
  };
  useEffect(() => {
    if (!selectedExamRecord || !selectedExam) {
      return;
    }
    setPublishedExam(selectedExamRecord);
    setImportMetadata((current) => ({
      ...(current || {}),
      ...getSelectedExamMetadata(),
    }));
  // Keep the workbench tied to the selected Banco de Provas record.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedExam?.id, selectedExamRecord]);
  useEffect(() => {
    if (!selectedExamId || !selectedExamFocus) {
      return;
    }
    const inheritedFocusValue = getFocusSelectValue(selectedExamFocus);
    if (inheritedFocusValue && inheritedFocusValue !== selectedFocusId) {
      setSelectedFocusId(inheritedFocusValue);
    }
    if (manualFocusName.trim()) {
      setManualFocusName('');
    }
  }, [manualFocusName, selectedExamFocus, selectedExamId, selectedFocusId]);
  const loadAttachedExamFile = async (exam: Prova, kind: 'prova' | 'gabarito') => {
    const files = exam.files?.length ? exam.files : (exam.examFiles || []);
    const attachment = files.find((file) => (file.kind || file.type) === kind);
    const url = attachment?.url || (kind === 'prova'
      ? exam.proofUrl || exam.pdfUrl
      : exam.answerKeyUrl || exam.gabaritoUrl);
    if (!url) return null;
    const response = await fetchAuthenticatedResource(url);
    const blob = await response.blob();
    const fallbackName = kind === 'prova' ? `prova-${exam.id}.pdf` : `gabarito-${exam.id}.pdf`;
    return new File([blob], attachment?.name || fallbackName, {
      type: blob.type || attachment?.mimeType || 'application/pdf',
    });
  };
  const handleSelectedExamIdChange = async (value: string) => {
    setSelectedExamId(value);
    setPublishedQuestionNumbers([]);
    setQFile(null);
    setKFile(null);
    setInheritedProofFileName('');
    setInheritedAnswerKeyFileName('');
    const exam = examBank.find((item) => String(item.id) === value) || null;
    setPublishedExam(exam ? { ...exam } as unknown as Record<string, unknown> : null);
    if (!exam) {
      setSelectedFocusId('');
      setManualFocusName('');
      return;
    }
    const examFocus = resolveExamInheritedFocus(exam, systemSettings.taxonomies);
    if (examFocus) {
      setSelectedFocusId(getFocusSelectValue(examFocus));
      setManualFocusName('');
    }
    const organizations = (exam.orgaos?.length ? exam.orgaos : [exam.orgao])
      .filter(Boolean)
      .map((item) => String(item.sigla || item.nome || item.name || '').trim())
      .filter(Boolean);
    const roles = (exam.cargos?.length ? exam.cargos : [exam.cargo])
      .filter(Boolean)
      .map((item) => String(item.descricao || item['descrição'] || item.name || '').trim())
      .filter(Boolean);
    setImportMetadata((current) => ({
      ...(current || {}),
      agency: String(exam.banca?.sigla || exam.banca?.nome || '').trim(),
      year: String(exam.ano),
      ano: exam.ano,
      title: exam.nome,
      examTitle: exam.nome,
      source: organizations[0] || '',
      sources: organizations,
      role: roles[0] || '',
      roles,
      level: exam.nivel || '',
    }));

    const [proofResult, answerKeyResult] = await Promise.allSettled([
      loadAttachedExamFile(exam, 'prova'),
      loadAttachedExamFile(exam, 'gabarito'),
    ]);
    if (proofResult.status === 'fulfilled' && proofResult.value) {
      setQFile(proofResult.value);
      setInheritedProofFileName(proofResult.value.name);
      addLog(`Arquivo de prova reutilizado do Banco de Provas: ${proofResult.value.name}.`);
    } else if (proofResult.status === 'rejected') {
      addLog(`Nao foi possivel carregar a prova anexada (${readErrorMessage(proofResult.reason)}). Selecione o PDF manualmente.`);
    }
    if (answerKeyResult.status === 'fulfilled' && answerKeyResult.value) {
      setKFile(answerKeyResult.value);
      setInheritedAnswerKeyFileName(answerKeyResult.value.name);
      addLog(`Gabarito reutilizado do Banco de Provas: ${answerKeyResult.value.name}.`);
    } else if (answerKeyResult.status === 'rejected') {
      addLog(`Nao foi possivel carregar o gabarito anexado (${readErrorMessage(answerKeyResult.reason)}). Selecione o PDF manualmente.`);
    }
  };

  const addLog = (message: string) => {
    setLogs((previous) => [`> ${message}`, ...previous].slice(0, 50));
  };

  const beginPublishingAction = (action: ImportPublishAction) => {
    if (publishingActionRef.current) {
      return false;
    }

    publishingActionRef.current = action;
    setPublishingAction(action);
    return true;
  };

  const finishPublishingAction = (action?: ImportPublishAction) => {
    if (!action || publishingActionRef.current === action) {
      publishingActionRef.current = null;
      setPublishingAction(null);
    }
  };

  const resolveSelectedFocus = (): QuestionTaxonomyLabel | null => {
    if (selectedExamFocus) {
      const focusName = getRootFocusText(getTaxonomyText(selectedExamFocus));
      return focusName
        ? { ...selectedExamFocus, name: focusName, nome: focusName }
        : selectedExamFocus;
    }
    const manualName = manualFocusName.trim();
    if (manualName) {
      return createTaxonomyLabel(manualName);
    }

    const focus = (systemSettings.taxonomies?.careers || [])
      .find((item) => getFocusSelectValue(item as QuestionTaxonomyLabel) === selectedFocusId);
    const focusName = getRootFocusText(getTaxonomyText(focus as QuestionTaxonomyLabel | undefined));
    return focusName ? { ...(focus as QuestionTaxonomyLabel), name: focusName, nome: focusName } : null;
  };

  const getTaxonomyReferenceNames = () => {
    const taxonomies = systemSettings.taxonomies;
    return {
      subjects: uniqueTextList(taxonomies?.subjects || []),
      topics: uniqueTextList([
        ...(taxonomies?.subjectTopics || []),
        ...(taxonomies?.topics || []),
      ]),
      specificSubjects: uniqueTextList(taxonomies?.specificSubjects || []),
    };
  };

  const getTaxonomyReferenceItems = () => {
    const taxonomies = systemSettings.taxonomies;
    return {
      subjects: (taxonomies?.subjects || []) as unknown as QuestionTaxonomyLabel[],
      topics: [
        ...((taxonomies?.subjectTopics || []) as unknown as QuestionTaxonomyLabel[]),
        ...((taxonomies?.topics || []) as unknown as QuestionTaxonomyLabel[]),
      ],
      specificSubjects: (taxonomies?.specificSubjects || []) as unknown as QuestionTaxonomyLabel[],
    };
  };

  const isAiConfigured = () => Boolean(
    systemSettings.hasGeminiApiKeyConfigured
    || systemSettings.hasOpenAiApiKeyConfigured
    || systemSettings.geminiApiKey
    || systemSettings.openaiApiKey,
  );

  const isCurrentImportEnem = (...values: unknown[]) => isEnemImportSignal(
    importMetadata?.examType,
    importMetadata?.role,
    importMetadata?.roles,
    importMetadata?.cargos,
    importMetadata?.title,
    importMetadata?.examTitle,
    importMetadata?.source,
    importMetadata?.agency,
    getTaxonomyText(resolveSelectedFocus()),
    ...values,
  );

  const normalizeTaxonomyForCurrentImport = (
    subject: string,
    topic: string,
    specificSubject: string,
    textSignals: unknown[] = [],
  ) => {
    const initial = isCurrentImportEnem(subject, topic, specificSubject, ...textSignals)
      ? normalizeEnemTaxonomyHierarchy(subject, topic, specificSubject, textSignals)
      : { subject, topic, specificSubject };

    return resolveTaxonomyHierarchy(initial.subject, initial.topic, initial.specificSubject);
  };

  const findExistingTaxonomyByName = (
    items: QuestionTaxonomyLabel[],
    name: string,
    parentName = '',
  ) => {
    const normalizedName = normalizeComparisonText(name);
    const normalizedParent = normalizeComparisonText(parentName);
    if (!normalizedName) {
      return null;
    }

    const matches = items.filter((item) => {
      const itemName = normalizeComparisonText(getTaxonomyText(item));
      const itemSlug = normalizeComparisonText(String(item.slug || '').replace(/-/g, ' '));
      const itemCleanName = normalizeComparisonText(String(item.nome_clean || ''));
      return itemName === normalizedName || itemSlug === normalizedName || itemCleanName === normalizedName;
    });

    if (matches.length <= 1 || !normalizedParent) {
      return matches[0] || null;
    }

    return matches.find((item) => [
      item.parentName,
      item.parent_name,
      item.parent,
      item.paiNome,
      item.pai_nome,
      item.rootSubjectName,
      item.root_subject_name,
    ].some((value) => normalizeComparisonText(String(value || '')) === normalizedParent)) || matches[0] || null;
  };

  const createResolvedTaxonomyLabel = (
    name: string,
    items: QuestionTaxonomyLabel[],
    extras: Record<string, unknown> = {},
    parentName = '',
  ) => {
    const cleanName = String(name || '').trim();
    if (!cleanName) {
      return null;
    }

    const existing = findExistingTaxonomyByName(items, cleanName, parentName);
    if (existing) {
      const existingName = getTaxonomyText(existing) || cleanName;
      return {
        ...existing,
        ...extras,
        id: existing.id,
        name: existingName,
        nome: existingName,
        slug: existing.slug || slugify(existingName),
      } as QuestionTaxonomyLabel;
    }

    return createTaxonomyLabel(cleanName, extras) as QuestionTaxonomyLabel;
  };

  const buildResolvedSubjectTaxonomies = (
    question: Question,
    updates: Partial<Record<'subject' | 'topic' | 'specificSubject', string>>,
  ) => {
    const current = getQuestionTaxonomyParts(question);
    const draft = question as unknown as ImportedQuestionDraft;
    const hierarchy = normalizeTaxonomyForCurrentImport(
      updates.subject ?? current.subject,
      updates.topic ?? current.topic,
      updates.specificSubject ?? current.specificSubject,
      [
        question.enunciado,
        draft.text,
        draft.introText,
        draft.supportText,
        draft.referenceText,
        ...(Array.isArray(question.itens) ? question.itens.map((item) => item.corpo) : []),
      ],
    );
    const references = getTaxonomyReferenceItems();
    const subject = createResolvedTaxonomyLabel(hierarchy.subject, references.subjects, { materia: true });
    const topic = createResolvedTaxonomyLabel(
      hierarchy.topic,
      references.topics,
      { materia: false },
      hierarchy.subject,
    );
    const specificSubject = createResolvedTaxonomyLabel(
      hierarchy.specificSubject,
      references.specificSubjects,
      { materia: false, parentName: hierarchy.topic || hierarchy.subject },
      hierarchy.topic || hierarchy.subject,
    );

    return [subject, topic, specificSubject].filter(Boolean) as unknown as Question['assuntos'];
  };

  const applyTaxonomyClassificationToQuestion = (
    question: Question,
    classification: {
      subject?: string;
      topic?: string;
      specificSubject?: string;
      difficulty?: string;
    },
  ) => {
    const current = getQuestionTaxonomyParts(question);
    const nextSubject = String(classification.subject || current.subject || '').trim();
    const nextTopic = String(classification.topic || current.topic || '').trim();
    const nextSpecificSubject = String(classification.specificSubject || current.specificSubject || '').trim();
    const hierarchy = resolveTaxonomyHierarchy(nextSubject, nextTopic, nextSpecificSubject);

    if (!nextSpecificSubject && !nextSubject && !nextTopic) {
      return question;
    }

    return {
      ...question,
      assuntos: buildResolvedSubjectTaxonomies(question, {
        subject: hierarchy.subject,
        topic: hierarchy.topic,
        specificSubject: hierarchy.specificSubject,
      }),
      ...(classification.difficulty
        ? {
          dificuldade: normalizeDifficulty(classification.difficulty),
          difficulty: classification.difficulty,
        }
        : {}),
    } as Question;
  };

  const shouldReclassifyQuestionTaxonomy = (taxonomy: {
    subject: string;
    topic: string;
    specificSubject: string;
  }) => {
    const subject = normalizeComparisonText(taxonomy.subject);
    const topic = normalizeComparisonText(taxonomy.topic);
    const specificSubject = normalizeComparisonText(taxonomy.specificSubject);
    const weakLabels = new Set(['', 'geral', 'generico', 'diversos', 'diverso', 'outros', 'outras']);

    if (
      weakLabels.has(subject)
      || weakLabels.has(topic)
      || weakLabels.has(specificSubject)
      || ENEM_AREA_NORMALIZED_NAMES.has(subject)
      || ENEM_AREA_NORMALIZED_NAMES.has(topic)
    ) {
      return true;
    }

    return topic === specificSubject
      || subject === topic
      || subject === specificSubject;
  };

  const classifyMissingQuestionSubjects = async (
    questions: Question[],
    pageIndex: number | string,
    options: { allowAi?: boolean } = {},
  ) => {
    const logScope = typeof pageIndex === 'number' ? `Pag ${pageIndex}` : pageIndex;
    const pending = questions
      .map((question, index) => {
        const taxonomy = getQuestionTaxonomyParts(question);
        return { question, index, taxonomy };
      })
      .filter(({ taxonomy }) => shouldReclassifyQuestionTaxonomy(taxonomy));

    if (pending.length === 0) {
      return questions;
    }

    if (options.allowAi === false) {
      return questions;
    }

    if (!isAiConfigured()) {
      addLog(`${logScope}: filtros incompletos/suspeitos em ${pending.length} questao(oes); IA nao configurada.`);
      return questions;
    }

    const references = getTaxonomyReferenceNames();
    const nextQuestions = [...questions];
    const chunkSize = 10;
    let filledCount = 0;

    for (let start = 0; start < pending.length; start += chunkSize) {
      const chunk = pending.slice(start, start + chunkSize);
      try {
        const classifications = await aiService.classifyImportedQuestionTaxonomies({
          ...references,
          questions: chunk.map(({ question, index, taxonomy }) => ({
            localId: String(index),
            number: getExtractedQuestionNumber(question, index + 1),
            text: String(question.enunciado || ''),
            options: (question.itens || []).map((item) => String(item.corpo || '')).filter(Boolean),
            currentSubject: taxonomy.subject,
            currentTopic: taxonomy.topic,
            currentSpecificSubject: taxonomy.specificSubject,
          })),
        });
        const classificationsById = new Map(
          classifications.map((classification) => [String(classification.localId), classification]),
        );

        chunk.forEach(({ question, index }) => {
          const classification = classificationsById.get(String(index));
          if (!classification?.specificSubject) {
            return;
          }
          nextQuestions[index] = applyTaxonomyClassificationToQuestion(question, classification);
          filledCount += 1;
        });
      } catch (error) {
        addLog(`${logScope}: IA nao conseguiu classificar filtros do lote (${readErrorMessage(error)}).`);
      }
    }

    if (filledCount > 0) {
      addLog(`${logScope}: IA revisou filtros de ${filledCount} questao(oes).`);
    }

    return nextQuestions;
  };

  const applyQuestionPartsRepair = (
    question: Question,
    repairedParts: Awaited<ReturnType<typeof aiService.repairImportedQuestionParts>>,
  ) => {
    const expectedOptionsCount = getQuestionExpectedOptionsCount(question);
    const supportParts = splitQuestionSupportReference(String(repairedParts.supportText || '').trim());
    const repairedSupportText = sanitizeSupportContextText(supportParts.supportText || String(repairedParts.supportText || '').trim());
    const repairedReferenceText = mergeReferenceText(
      String(repairedParts.referenceText || '').trim(),
      supportParts.referenceText,
    );
    const repairedStatement = stripTrailingExamNoise(
      String(repairedParts.statement || '').replace(/\s+/g, ' ').trim(),
    );
    const repairedOptions = normalizeAiRepairedOptions(repairedParts.options, expectedOptionsCount);
    const currentOptions = getQuestionOptionTexts(question);
    const canReplaceOptions = !hasVisualOptionPayload(question)
      && repairedOptions.length >= 2
      && (
        currentOptions.length < expectedOptionsCount
        || readOptionMarkers(stripHtml(getQuestionStatementText(question))).length >= Math.min(3, expectedOptionsCount)
      );
    const nextItems = canReplaceOptions
      ? repairedOptions.map((option, optionIndex) => {
        const previous = question.itens?.[optionIndex];
        const label = previous?.rotulo || String.fromCharCode(65 + optionIndex);
        return {
          ...(previous || {}),
          id: previous?.id || optionIndex + 1,
          ordem: optionIndex + 1,
          rotulo: label,
          corpo: option,
          corpo_clean: stripHtml(option),
        };
      })
      : question.itens;
    const introText = repairedSupportText || getQuestionIntroText(question);
    const referenceText = repairedReferenceText || getQuestionReferenceText(question);

    return {
      ...question,
      ...(repairedStatement ? {
        enunciado: repairedStatement,
        enunciado_clean: stripHtml(repairedStatement),
      } : {}),
      introText,
      intro_text: introText,
      referenceText,
      reference_text: referenceText,
      itens: nextItems,
      needsImportReview: canReplaceOptions
        ? nextItems.length < expectedOptionsCount
        : Boolean((question as unknown as { needsImportReview?: boolean }).needsImportReview),
    } as unknown as Question;
  };

  const reviewQuestionPartsAfterExtraction = async (
    questions: Question[],
    options: { allowAi?: boolean } = {},
  ) => {
    const pending = questions
      .map((question, index) => ({ question, index }))
      .filter(({ question }) => shouldRunFinalQuestionPartsReview(question));

    if (pending.length === 0) {
      return questions;
    }

    if (options.allowAi === false) {
      return questions;
    }

    if (!isAiConfigured()) {
      addLog(`Revisao final: ${pending.length} questao(oes) com separacao suspeita; IA nao configurada.`);
      return questions;
    }

    addLog(`Revisao final: IA conferindo texto de apoio, referencia, enunciado e alternativas em ${pending.length} questao(oes) suspeita(s).`);
    const nextQuestions = [...questions];

    for (const { question, index } of pending) {
      const questionNumber = getExtractedQuestionNumber(question, index + 1);
      const expectedOptionsCount = getQuestionExpectedOptionsCount(question);

      try {
        const repairedParts = await aiService.repairImportedQuestionParts({
          rawText: buildFinalQuestionReviewRawText(question),
          supportText: getQuestionIntroText(question),
          referenceText: getQuestionReferenceText(question),
          statement: getQuestionStatementText(question),
          options: getQuestionOptionTexts(question),
          modality: String((question as unknown as { modality?: unknown }).modality || question.tipo || ''),
          expectedOptionsCount,
        });
        const confidence = Number(repairedParts.confidence ?? 0);
        const repairedOptions = normalizeAiRepairedOptions(repairedParts.options, expectedOptionsCount);
        const hasUsefulRepair = Boolean(
          String(repairedParts.statement || '').trim()
          || String(repairedParts.supportText || '').trim()
          || String(repairedParts.referenceText || '').trim()
          || repairedOptions.length >= 2,
        );

        if (!hasUsefulRepair || confidence < 0.45) {
          addLog(`Questao #${questionNumber}: IA nao teve seguranca para revisar a separacao automaticamente.`);
          continue;
        }

        nextQuestions[index] = applyQuestionPartsRepair(question, repairedParts);
        addLog(`Questao #${questionNumber}: separacao final revisada por IA.`);
      } catch (error) {
        addLog(`Questao #${questionNumber}: revisao final por IA falhou (${readErrorMessage(error)}).`);
      }
    }

    return nextQuestions;
  };

  const generateDetailedAnalysesForQuestions = async (
    questions: Question[],
    options: { updateLiveState?: boolean; logLabel?: string } = {},
  ) => {
    const pending = questions
      .map((question, index) => ({ question, index }))
      .filter(({ question }) => !String(question.detailedComment || '').trim());

    if (pending.length === 0) {
      return questions;
    }

    const updatedQuestions = [...questions];
    const chunkSize = 5;
    let processed = 0;

    addLog(options.logLabel || `Gerando analise detalhada em lote para ${pending.length} questao(oes)...`);

    for (let start = 0; start < pending.length; start += chunkSize) {
      const chunk = pending.slice(start, start + chunkSize);
      try {
        const analyses = await aiService.generateDetailedAnalysesBatch(chunk.map(({ question, index }) => ({
          localId: String(index),
          question,
        })));

        chunk.forEach(({ question, index }) => {
          const markdown = analyses[String(index)];
          if (markdown) {
            updatedQuestions[index] = mergeQuestionEditorialPatch(updatedQuestions[index] || question, {
              detailedComment: markdown,
            });
          }
        });

        const missingAfterBatch = chunk.filter(({ index }) => !String(updatedQuestions[index]?.detailedComment || '').trim());
        for (const { question, index } of missingAfterBatch) {
          try {
            const detail = await aiService.generateDetailedAnalysis(question);
            updatedQuestions[index] = mergeQuestionEditorialPatch(updatedQuestions[index] || question, {
              detailedComment: detail,
            });
          } catch {
            addLog(`Erro ao gerar detalhado para questao ${index + 1}.`);
          }
        }
      } catch (error) {
        addLog(`Lote de analise detalhada falhou (${readErrorMessage(error)}). Tentando questoes do lote individualmente.`);
        for (const { question, index } of chunk) {
          try {
            const detail = await aiService.generateDetailedAnalysis(question);
            updatedQuestions[index] = mergeQuestionEditorialPatch(updatedQuestions[index] || question, {
              detailedComment: detail,
            });
          } catch {
            addLog(`Erro ao gerar detalhado para questao ${index + 1}.`);
          }
        }
      }

      processed += chunk.length;
      setBulkProgress(Math.round((processed / pending.length) * 100));
      if (options.updateLiveState) {
        setExtractedQuestions((current) => current.map((question, index) => (
          updatedQuestions[index]
            ? mergeQuestionEditorialPatch(question, updatedQuestions[index])
            : question
        )));
      }
    }

    return updatedQuestions;
  };

  const generateTeacherCommentsForQuestions = async (
    questions: Question[],
    options: { updateLiveState?: boolean; logLabel?: string } = {},
  ) => {
    const pending = questions
      .map((question, index) => ({ question, index }))
      .filter(({ question }) => !String(question.teacherComment || '').trim());

    if (pending.length === 0) {
      return questions;
    }

    const updatedQuestions = [...questions];
    const chunkSize = 8;
    let processed = 0;

    if (options.logLabel) {
      addLog(options.logLabel);
    }

    for (let start = 0; start < pending.length; start += chunkSize) {
      const chunk = pending.slice(start, start + chunkSize);
      try {
        const comments = await aiService.generateTeacherCommentsBatch(chunk.map(({ question, index }) => ({
          localId: String(index),
          question,
        })));

        chunk.forEach(({ question, index }) => {
          const comment = comments[String(index)];
          if (comment) {
            updatedQuestions[index] = mergeQuestionEditorialPatch(updatedQuestions[index] || question, {
              teacherComment: comment,
            });
          }
        });

        const missingAfterBatch = chunk.filter(({ index }) => !String(updatedQuestions[index]?.teacherComment || '').trim());
        for (const { question, index } of missingAfterBatch) {
          try {
            const comment = await aiService.generateTeacherComment(question);
            updatedQuestions[index] = mergeQuestionEditorialPatch(updatedQuestions[index] || question, {
              teacherComment: comment,
            });
          } catch {
            addLog(`Erro ao gerar comentario do professor para questao ${index + 1}.`);
          }
        }
      } catch (error) {
        addLog(`Lote de comentarios do professor falhou (${readErrorMessage(error)}). Tentando questoes do lote individualmente.`);
        for (const { question, index } of chunk) {
          try {
            const comment = await aiService.generateTeacherComment(question);
            updatedQuestions[index] = mergeQuestionEditorialPatch(updatedQuestions[index] || question, {
              teacherComment: comment,
            });
          } catch {
            addLog(`Erro ao gerar comentario do professor para questao ${index + 1}.`);
          }
        }
      }

      processed += chunk.length;
      setBulkProgress(Math.round((processed / pending.length) * 100));
      if (options.updateLiveState) {
        setExtractedQuestions((current) => current.map((question, index) => (
          updatedQuestions[index]
            ? mergeQuestionEditorialPatch(question, updatedQuestions[index])
            : question
        )));
      }
    }

    return updatedQuestions;
  };

  const mergeMetadata = (current: ImportMetadata | null, next: PageExtractionResult['metadata']) => {
    const normalizedNext = toImportMetadata(next);
    if (!normalizedNext) {
      return current;
    }

    const merged = {
      ...(current || {}),
      ...Object.fromEntries(
        Object.entries(normalizedNext).filter(([, value]) => String(value ?? '').trim() !== ''),
      ),
    } as ImportMetadata;
    const roles = normalizeRoleList(current?.roles, current?.cargos, current?.role, normalizedNext.roles, normalizedNext.cargos, normalizedNext.role);
    const organizations = normalizeOrganizationList(current?.sources, current?.orgaos, current?.source, normalizedNext.sources, normalizedNext.orgaos, normalizedNext.source);
    const role = summarizeExamTitleList(roles, merged.role || merged.examName || merged.contestName || '');
    const source = summarizeExamTitleList(organizations, merged.source || '');

    const selectedMetadata = selectedExam ? getSelectedExamMetadata() : null;

    return {
      ...merged,
      ...(role ? { role } : {}),
      ...(roles.length > 0 ? { roles, cargos: roles } : {}),
      ...(source ? { source } : {}),
      ...(organizations.length > 0 ? { sources: organizations } : {}),
      ...buildBookletMetadata(merged),
      ...(selectedMetadata || {}),
    } as ImportMetadata;
  };

  const getContextFigureSignature = (context: Partial<ImportedContextDraft>) => {
    if (!context.hasFigure || !context.figureBox || !context.page) {
      return '';
    }

    const box = context.figureBox;
    const snap = (value: unknown) => Math.round((Number(value) || 0) / 12) * 12;
    const values = [box.x, box.y, box.width, box.height].map(snap);
    if (values.some((value) => value <= 0) || values[2] <= 0 || values[3] <= 0) {
      return '';
    }

    return `pag-${context.page}:figura:${values.join(':')}`;
  };

  const normalizeVisualTextSignature = (value?: string) => (
    normalizeComparisonText(stripHtml(String(value || '')))
      .replace(/\b(?:figura|imagem|suporte visual|contexto|questao|questao\s+\d+)\b/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
  );

  const getFigureBoxSignature = (box?: FigureBox) => {
    if (!box) {
      return '';
    }

    const snap = (value: unknown) => Math.round((Number(value) || 0) / 8) * 8;
    const values = [box.x, box.y, box.width, box.height].map(snap);
    if (values.some((value) => !Number.isFinite(value))) {
      return '';
    }

    return values.join(':');
  };
  const getSupportImageSignature = (image: Partial<ImportedQuestionImageDraft>) => {
    if (String(image.url || '').trim()) return `url:${String(image.url || '').trim()}`;
    const imageData = String(image.imageData || '').trim();
    if (imageData) {
      return `image:${imageData}`;
    }

    const pageImageData = String(image.pageImageData || '').trim();
    const boxSignature = getFigureBoxSignature(image.figureBox);
    if (pageImageData && boxSignature) {
      return `crop:${pageImageData}:${boxSignature}`;
    }

    if (boxSignature) {
      return `box:${Number(image.page || 0) || 0}:${boxSignature}`;
    }

    const descriptionSignature = normalizeVisualTextSignature(image.description || image.title);
    if (descriptionSignature.length >= 24) {
      return `description:${descriptionSignature}`;
    }

    return '';
  };
  const supportImageHasUsefulPayload = (image: Partial<ImportedQuestionImageDraft>) => (
    Boolean(String(image.url || '').trim()) || Boolean(String(image.imageData || '').trim())
    || Boolean(String(image.pageImageData || '').trim() && image.figureBox)
    || Boolean(image.figureBox)
    || normalizeVisualTextSignature(image.description).length >= 24
  );

  const externalTextOnlyImagePattern = /\b(?:recorte\s+contextual\s+visual|dispon[ií]vel\s+como\s+imagem|suporte\s+visual\s+da\s+quest[aã]o|imagem\s+da\s+p[aá]gina\s+\d+\s+do\s+caderno)\b/i;
  const concreteVisualResourcePattern = /\b(?:gr[aá]fico|mapa|charge|tirinha|foto|fotografia|diagrama|fluxograma|esquema|f[oó]rmula|cartaz|ilustra[cç][aã]o|infogr[aá]fico|tabela\s+visual|quadro\s+visual)\b/i;

  const shouldDropExternalTextDuplicateImage = (
    image: Partial<ImportedQuestionImageDraft>,
    supportText: string,
    statement: string,
    linkedContext?: ImportedContextDraft,
  ) => {
    const imageText = [
      image.title,
      image.description,
    ].filter(Boolean).join(' ');
    const hasTextOnlyBoilerplate = externalTextOnlyImagePattern.test(imageText);
    const hasConcreteVisualCue = concreteVisualResourcePattern.test(imageText);
    const normalizedImageText = normalizeComparisonText(imageText);
    const normalizedSupport = normalizeComparisonText([
      supportText,
      statement,
      linkedContext?.title,
      linkedContext?.text,
    ].filter(Boolean).join('\n\n'));

    if (hasTextOnlyBoilerplate && !hasConcreteVisualCue && normalizedSupport.length >= 40) {
      return true;
    }

    return !String(image.imageData || '').trim()
      && normalizedImageText.length >= 40
      && normalizedSupport.includes(normalizedImageText)
      && !hasConcreteVisualCue;
  };

  const mergeContextText = (...values: Array<string | undefined>) => {
    const parts = values
      .flatMap((value) => String(value || '').split(/\n{2,}/))
      .map((value) => value.trim())
      .filter(Boolean);

    const kept: string[] = [];
    parts.forEach((part) => {
      const normalizedPart = normalizeComparisonText(part);
      if (!normalizedPart) {
        return;
      }

      const containedIndex = kept.findIndex((item) => normalizeComparisonText(item).includes(normalizedPart));
      if (containedIndex >= 0) {
        return;
      }

      for (let index = kept.length - 1; index >= 0; index -= 1) {
        const normalizedExisting = normalizeComparisonText(kept[index]);
        if (normalizedPart.includes(normalizedExisting)) {
          kept.splice(index, 1);
        }
      }

      kept.push(part);
    });

    return kept.join('\n\n');
  };

  const mergeContextFigures = (
    tempId: string,
    previous?: ImportedContextDraft,
    context?: Partial<ImportedContextDraft>,
  ) => {
    const figures = new Map<string, NonNullable<ImportedContextDraft['figures']>[number]>();
    (previous?.figures || []).forEach((figure) => {
      if (figure.figureKey) {
        figures.set(figure.figureKey, figure);
      }
    });

    (context?.figures || []).forEach((figure, index) => {
      const figureKey = String(figure.figureKey || `${tempId}-fig-${String(index + 1).padStart(2, '0')}`);
      figures.set(figureKey, {
        ...figure,
        figureKey,
        imageData: figure.imageData || (index === 0 ? context?.imageData : undefined),
        pageImageData: figure.pageImageData || context?.pageImageData,
        page: Number(figure.page || context?.page || previous?.page || 0) || undefined,
        order: Number(figure.order || index + 1),
      });
    });

    if (context?.hasFigure && context.figureBox && !Array.from(figures.values()).some((figure) => figure.figureBox === context.figureBox)) {
      const figureKey = `${tempId}-fig-01`;
      figures.set(figureKey, {
        figureKey,
        type: 'figure',
        description: context.figureDescription || previous?.figureDescription || '',
        imageData: context.imageData || previous?.imageData,
        pageImageData: context.pageImageData || previous?.pageImageData,
        figureBox: context.figureBox,
        page: Number(context.page || previous?.page || 0) || undefined,
        order: 1,
      });
    }

    return Array.from(figures.values()).sort((left, right) => Number(left.order || 0) - Number(right.order || 0));
  };

  const insertMissingContextFigureMarkers = (
    value: string,
    figures: NonNullable<ImportedContextDraft['figures']>,
  ) => {
    if (!figures.length) {
      return value;
    }

    const missingMarkers = figures
      .map((figure) => `[FIGURA: ${figure.figureKey}]`)
      .filter((marker) => !String(value || '').includes(marker));
    if (!missingMarkers.length) {
      return value;
    }

    return [value, ...missingMarkers].filter(Boolean).join('\n\n');
  };

  const removeContainedPartialContextsForQuestion = (
    contextMap: Map<string, ImportedContextDraft>,
    questionNumber: number,
    fullSupportText: string,
  ) => {
    const normalizedFullText = normalizeComparisonText(fullSupportText);
    if (!questionNumber || normalizedFullText.length < 80) {
      return;
    }

    Array.from(contextMap.entries()).forEach(([tempId, context]) => {
      if (!context.questionNumbers.includes(questionNumber) || context.hasFigure) {
        return;
      }

      const normalizedContextText = normalizeComparisonText(context.text);
      if (
        normalizedContextText
        && normalizedContextText.length < normalizedFullText.length
        && normalizedFullText.includes(normalizedContextText)
      ) {
        contextMap.delete(tempId);
      }
    });
  };

  const isTextOnlyContextDraft = (context: ImportedContextDraft) => (
    Boolean(context.text)
    && !context.hasFigure
    && !context.figureDescription
    && !context.imageData
    && !(Array.isArray(context.figures) && context.figures.length > 0)
  );

  const clearQuestionContextLink = (question: Question, contextTempId: string) => {
    const draft = question as Question & {
      contextKey?: string;
      grupoQuestaoTempId?: string | number;
      contextTempId?: string | number;
      grupoQuestaoId?: string | number | null;
      grupo_questao_id?: string | number | null;
    };

    if (
      String(draft.contextKey || '') !== contextTempId
      && String(draft.grupoQuestaoTempId || '') !== contextTempId
      && String(draft.contextTempId || '') !== contextTempId
    ) {
      return question;
    }

    return {
      ...question,
      contextKey: '',
      grupoQuestaoTempId: undefined,
      contextTempId: undefined,
      grupoQuestaoId: null,
      grupo_questao_id: null,
    } as Question;
  };

  const attachQuestionContextLink = (question: Question, contextTempId: string, contextTitle = '') => ({
    ...question,
    introText: '',
    intro_text: '',
    contextKey: contextTempId,
    contextTitle: contextTitle || (question as unknown as ImportedQuestionDraft).contextTitle || '',
    grupoQuestaoTempId: contextTempId,
    contextTempId,
  } as Question);

  const getQuestionContextTempId = (question: Question) => {
    const draft = question as unknown as ImportedQuestionDraft & { contextTempId?: string | number };
    return String(draft.contextKey || draft.grupoQuestaoTempId || draft.contextTempId || '').trim();
  };

  const getQuestionSourcePage = (question: Question) => {
    const draft = question as unknown as ImportedQuestionDraft & { source_page?: number | string };
    const page = Number(draft.sourcePage || draft.source_page || 0);
    return Number.isFinite(page) && page > 0 ? page : 0;
  };

  const questionHasSupportPayload = (question: Question) => {
    const draft = question as unknown as ImportedQuestionDraft;
    return Boolean(
      stripHtml(getQuestionIntroText(question)).replace(/\s+/g, ' ').trim().length >= 40
      || (Array.isArray(draft.supportImages) && draft.supportImages.length > 0)
    );
  };

  const contextHasSupportPayload = (context: ImportedContextDraft) => (
    stripHtml(String(context.text || context.richText || '')).replace(/\s+/g, ' ').trim().length > 0
    || Boolean(context.referenceText)
    || Boolean(context.hasFigure || context.figureDescription || context.imageData || context.pageImageData || context.figureBox)
    || (Array.isArray(context.figures) && context.figures.length > 0)
  );

  const buildSupportImagesFromContext = (
    context: ImportedContextDraft,
    questionNumber: number,
  ): ImportedQuestionImageDraft[] => {
    const images: ImportedQuestionImageDraft[] = [];
    const pushImage = (image: ImportedQuestionImageDraft) => {
      const signature = getSupportImageSignature(image);
      if (!supportImageHasUsefulPayload(image) || (signature && images.some((existing) => getSupportImageSignature(existing) === signature))) {
        return;
      }
      images.push(image);
    };

    if (context.imageData || context.pageImageData || context.figureBox) {
      pushImage({
        tempId: `${context.tempId}-q-${questionNumber}-support-fig-01`,
        title: context.figureDescription || context.title || `Figura de apoio da questao ${questionNumber}`,
        description: context.figureDescription,
        imageData: context.imageData,
        pageImageData: context.pageImageData,
        figureBox: context.figureBox,
        page: context.sourcePage || context.page,
        manualCropApplied: context.manualCropApplied,
      });
    }

    (context.figures || []).forEach((figure, index) => {
      pushImage({
        tempId: figure.figureKey || `${context.tempId}-q-${questionNumber}-support-fig-${index + 1}`,
        title: figure.description || context.title || `Figura de apoio da questao ${questionNumber}`,
        description: figure.description,
        imageData: figure.imageData,
        pageImageData: figure.pageImageData,
        figureBox: figure.figureBox,
        page: figure.page || context.sourcePage || context.page,
        manualCropApplied: Boolean(figure.imageData),
      });
    });

    return images;
  };

  const mergeQuestionSupportImages = (
    question: Question,
    incomingImages: ImportedQuestionImageDraft[],
  ) => {
    const draft = question as unknown as ImportedQuestionDraft;
    const existingImages = Array.isArray(draft.supportImages) ? draft.supportImages : [];
    const seen = new Set<string>();
    return [...existingImages, ...incomingImages].filter((image) => {
      const signature = getSupportImageSignature(image);
      if (!supportImageHasUsefulPayload(image) || !signature || seen.has(signature)) {
        return false;
      }
      seen.add(signature);
      return true;
    });
  };

  const questionNeedsExternalTextContext = (question: Question) => (
    textNeedsExternalSupportContext(
      getQuestionStatementText(question),
      getQuestionOptionTexts(question).join(' '),
    )
  );

  const questionUsesGeneralTextReference = (question: Question) => {
    const text = normalizeComparisonText(stripHtml([
      getQuestionStatementText(question),
      getQuestionOptionTexts(question).join(' '),
    ].join(' ')));
    return /\b(?:o texto|do texto|no texto|ao texto|esse texto|este texto|sentido global do texto|carater memorialistico|caracter memorialistico|narrador|autor)\b/.test(text);
  };

  const addQuestionNumberToContext = (
    contextMap: Map<string, ImportedContextDraft>,
    contextTempId: string,
    questionNumber: number,
  ) => {
    const context = contextMap.get(contextTempId);
    if (!context || !Number.isFinite(questionNumber) || questionNumber <= 0) {
      return;
    }
    const explicitQuestionNumbers = extractExplicitContextQuestionNumbers(context.text, context.referenceText, context.title);
    if (explicitQuestionNumbers.length > 0 && !explicitQuestionNumbers.includes(questionNumber)) {
      context.questionNumbers = explicitQuestionNumbers;
      contextMap.set(contextTempId, context);
      return;
    }
    context.questionNumbers = Array.from(new Set([...context.questionNumbers, questionNumber])).sort((a, b) => a - b);
    contextMap.set(contextTempId, context);
  };

  const findBestContextForQuestion = (
    question: Question,
    questionNumber: number,
    contextMap: Map<string, ImportedContextDraft>,
  ) => {
    const questionPage = getQuestionSourcePage(question);
    const candidates = Array.from(contextMap.values()).filter((context) => (
      (stripHtml(context.text).replace(/\s+/g, ' ').trim().length >= 40 || context.hasFigure || context.figureDescription)
      && !isLikelyPageBookletHeader(context.text)
    ));

    const exactMatches = candidates.filter((context) => context.questionNumbers.includes(questionNumber));
    if (exactMatches.length > 0) {
      return exactMatches
        .sort((left, right) => left.questionNumbers.length - right.questionNumbers.length)[0];
    }

    if (!questionPage) {
      return null;
    }

    const samePageContext = candidates
      .filter((context) => (
        context.page === questionPage
        && (
          context.questionNumbers.length === 0
          || (
            questionNumber >= Math.min(...context.questionNumbers)
            && questionNumber <= Math.max(...context.questionNumbers)
          )
        )
      ))
      .sort((left, right) => {
        const leftSpecificity = left.questionNumbers.length || 999;
        const rightSpecificity = right.questionNumbers.length || 999;
        return leftSpecificity - rightSpecificity;
      })[0] || null;

    if (samePageContext) {
      return samePageContext;
    }

    const carryoverContext = findCarryoverTextContextForQuestion(questionNumber, questionPage, candidates);
    if (carryoverContext) {
      return carryoverContext;
    }

    if (!questionUsesGeneralTextReference(question)) {
      return null;
    }

    const broadTextContext = candidates
      .filter((context) => {
        if (!isTextOnlyContextDraft(context)) {
          return false;
        }
        const cleanText = stripHtml(context.text).replace(/\s+/g, ' ').trim();
        if (cleanText.length < 140) {
          return false;
        }
        const contextPage = Number(context.page || context.sourcePage || 0);
        if (questionPage && contextPage && contextPage > questionPage) {
          return false;
        }

        const contextQuestionNumbers = Array.from(new Set(context.questionNumbers.filter((number) => number > 0)));
        const lastQuestionNumber = contextQuestionNumbers.length > 0 ? Math.max(...contextQuestionNumbers) : 0;
        const firstQuestionNumber = contextQuestionNumbers.length > 0 ? Math.min(...contextQuestionNumbers) : 0;
        const looksSpecificFragment = /\b(?:fragmento|trecho\s+abaixo|passagens?\s+destacadas?|considere\s+as\s+passagens)\b/i.test(stripHtml(context.text))
          && contextQuestionNumbers.length > 0
          && contextQuestionNumbers.length <= 3
          && !/^Texto\s+(?:[IVXLC]+|\d+)/i.test(context.title || '');
        if (looksSpecificFragment) {
          return false;
        }
        if (contextQuestionNumbers.length === 0) {
          return !questionPage || !contextPage || questionPage - contextPage <= 2;
        }

        return questionNumber >= Math.max(1, firstQuestionNumber - 1)
          && questionNumber <= lastQuestionNumber + 12;
      })
      .sort((left, right) => {
        const leftPage = Number(left.page || left.sourcePage || 0);
        const rightPage = Number(right.page || right.sourcePage || 0);
        if (leftPage !== rightPage) {
          return rightPage - leftPage;
        }
        const leftLastQuestion = Math.max(0, ...left.questionNumbers.filter((number) => number > 0));
        const rightLastQuestion = Math.max(0, ...right.questionNumbers.filter((number) => number > 0));
        return rightLastQuestion - leftLastQuestion;
      })[0] || null;

    return broadTextContext;
  };

  const restoreMissingQuestionContextLinks = (
    questions: Question[],
    contextMap: Map<string, ImportedContextDraft>,
  ) => questions.map((question, index) => {
    const questionNumber = getExtractedQuestionNumber(question, index + 1);
    const linkedContextTempId = getQuestionContextTempId(question);
    if (linkedContextTempId && contextMap.has(linkedContextTempId)) {
      const linkedContext = contextMap.get(linkedContextTempId);
      const explicitQuestionNumbers = extractExplicitContextQuestionNumbers(
        linkedContext?.text,
        linkedContext?.referenceText,
        linkedContext?.title,
      );
      if (explicitQuestionNumbers.length > 0 && !explicitQuestionNumbers.includes(questionNumber)) {
        return clearQuestionContextLink(question, linkedContextTempId);
      }
      addQuestionNumberToContext(contextMap, linkedContextTempId, questionNumber);
      return question;
    }

    if (questionHasSupportPayload(question) || !questionNeedsExternalTextContext(question)) {
      return question;
    }

    const context = findBestContextForQuestion(question, questionNumber, contextMap);
    if (!context) {
      return question;
    }

    addQuestionNumberToContext(contextMap, context.tempId, questionNumber);
    return attachQuestionContextLink(question, context.tempId, context.title);
  });

  const normalizeQuestionContextUsage = (
    questions: Question[],
    contextMap: Map<string, ImportedContextDraft>,
  ) => {
    let nextQuestions = restoreMissingQuestionContextLinks(
      questions.map((question) => ({ ...question })),
      contextMap,
    );

    const normalizedContextEntries = Array.from(contextMap.entries()).map(([tempId, context]) => {
      const scopedQuestionNumbers = resolveScopedContextQuestionNumbers(
        Array.from(new Set(context.questionNumbers.filter((number) => number > 0))),
        context.text,
        context.referenceText,
        context.title,
      );
      const nextContext = {
        ...context,
        questionNumbers: scopedQuestionNumbers,
      };
      contextMap.set(tempId, nextContext);
      return [tempId, nextContext] as const;
    });

    const contextTempIdByQuestionNumber = new Map<number, string>();
    normalizedContextEntries
      .sort((left, right) => right[1].questionNumbers.length - left[1].questionNumbers.length)
      .forEach(([tempId, context]) => {
        context.questionNumbers.forEach((questionNumber) => {
          if (questionNumber > 0 && !contextTempIdByQuestionNumber.has(questionNumber)) {
            contextTempIdByQuestionNumber.set(questionNumber, tempId);
          }
        });
      });

    nextQuestions = nextQuestions.map((question, index) => {
      const questionNumber = getExtractedQuestionNumber(question, index + 1);
      const linkedContextTempId = getQuestionContextTempId(question);
      const selectedContextTempId = contextTempIdByQuestionNumber.get(questionNumber) || '';
      if (selectedContextTempId) {
        const selectedContext = contextMap.get(selectedContextTempId);
        return attachQuestionContextLink(question, selectedContextTempId, selectedContext?.title || '');
      }
      if (linkedContextTempId && contextMap.has(linkedContextTempId)) {
        return clearQuestionContextLink(question, linkedContextTempId);
      }
      return question;
    });

    Array.from(contextMap.entries()).forEach(([tempId, context]) => {
      const questionNumbers = Array.from(new Set(context.questionNumbers.filter((number) => number > 0)));
      if (questionNumbers.length !== 1 || !contextHasSupportPayload(context)) {
        return;
      }

      const questionNumber = questionNumbers[0];
      nextQuestions = nextQuestions.map((question, index) => {
        if (getExtractedQuestionNumber(question, index + 1) !== questionNumber) {
          return question;
        }

        const baseQuestion = clearQuestionContextLink(question, tempId) as Question & {
          introText?: string;
          intro_text?: string;
          referenceText?: string;
          reference_text?: string;
          needsImportReview?: boolean;
        };
        const mergedIntroText = mergeContextText(
          baseQuestion.introText || baseQuestion.intro_text,
          context.text,
          context.figureDescription ? `Figura/Imagem: ${context.figureDescription}` : '',
        );
        const mergedReferenceText = mergeReferenceText(baseQuestion.referenceText, baseQuestion.reference_text, context.referenceText);
        const supportImages = mergeQuestionSupportImages(
          baseQuestion,
          buildSupportImagesFromContext(context, questionNumber),
        );
        return {
          ...baseQuestion,
          introText: mergedIntroText,
          intro_text: mergedIntroText,
          referenceText: mergedReferenceText,
          reference_text: mergedReferenceText,
          supportImages,
          needsImportReview: true,
        } as Question;
      });
      contextMap.delete(tempId);
    });

    const introTextGroups = new Map<string, { text: string; questionNumbers: number[] }>();
    nextQuestions.forEach((question, index) => {
      const introText = String((question as { introText?: string; intro_text?: string }).introText || (question as { intro_text?: string }).intro_text || '').trim();
      const normalizedIntroText = normalizeComparisonText(introText);
      if (normalizedIntroText.length < 80) {
        return;
      }

      const questionNumber = getExtractedQuestionNumber(question, index + 1);
      const group = introTextGroups.get(normalizedIntroText) || { text: introText, questionNumbers: [] };
      group.questionNumbers.push(questionNumber);
      introTextGroups.set(normalizedIntroText, group);
    });

    introTextGroups.forEach((group, normalizedIntroText) => {
      const questionNumbers = Array.from(new Set(group.questionNumbers)).sort((a, b) => a - b);
      const matchingSharedContext = Array.from(contextMap.entries()).find(([, context]) => (
        isTextOnlyContextDraft(context)
        && context.questionNumbers.length > 1
        && normalizeComparisonText(context.text) === normalizedIntroText
      ));

      if (matchingSharedContext) {
        const [tempId, context] = matchingSharedContext;
        context.questionNumbers = Array.from(new Set([...context.questionNumbers, ...questionNumbers])).sort((a, b) => a - b);
        contextMap.set(tempId, context);
        nextQuestions = nextQuestions.map((question, index) => (
          questionNumbers.includes(getExtractedQuestionNumber(question, index + 1))
            ? attachQuestionContextLink(question, tempId)
            : question
        ));
        return;
      }

      if (questionNumbers.length < 2) {
        return;
      }

      const tempId = `contexto-compartilhado-${slugify(normalizedIntroText.slice(0, 72))}`;
      upsertContextDraft(contextMap, {
        tempId,
        title: `Texto de apoio compartilhado (${questionNumbers.join(', ')})`,
        text: group.text,
        questionNumbers,
        hasFigure: false,
        figureDescription: '',
        page: 0,
      });

      nextQuestions = nextQuestions.map((question, index) => (
        questionNumbers.includes(getExtractedQuestionNumber(question, index + 1))
          ? attachQuestionContextLink(question, tempId)
          : question
      ));
    });

    return {
      questions: nextQuestions,
      contexts: Array.from(contextMap.values()),
    };
  };

  const upsertContextDraft = (
    contextMap: Map<string, ImportedContextDraft>,
    context: Partial<ImportedContextDraft>,
  ) => {
    const tempId = String(context.tempId || '').trim();
    if (!tempId) {
      return '';
    }

    const incomingParts = splitQuestionSupportReference(context.text || '');
    const incomingText = sanitizeSupportContextText(incomingParts.supportText || context.text || '');
    const incomingReferenceText = mergeReferenceText(context.referenceText, incomingParts.referenceText);
    const signature = getContextFigureSignature(context);
    const matchingContext = signature
      ? Array.from(contextMap.values()).find((item) => getContextFigureSignature(item) === signature)
      : null;
    const targetTempId = matchingContext?.tempId || tempId;
    const previous = contextMap.get(targetTempId);
    const isOnlyBookletHeader = !previous
      && !context.hasFigure
      && !context.figureDescription
      && isLikelyPageBookletHeader(incomingText);
    if (isOnlyBookletHeader) {
      return '';
    }

    const declaredQuestionNumbers = [
      ...(previous?.questionNumbers || []),
      ...(context.questionNumbers || []),
    ].filter((value, index, list) => list.indexOf(value) === index);
    const figures = mergeContextFigures(targetTempId, previous, context);
    const mergedText = insertMissingContextFigureMarkers(
      mergeContextText(previous?.text, incomingText),
      figures,
    );
    const questionNumbers = resolveScopedContextQuestionNumbers(
      declaredQuestionNumbers,
      mergedText,
      incomingReferenceText,
      previous?.referenceText,
      context.title,
      previous?.title,
    );

    contextMap.set(targetTempId, {
      tempId: targetTempId,
      title: context.title || previous?.title || 'Contexto da prova',
      text: mergedText,
      referenceText: mergeReferenceText(previous?.referenceText, incomingReferenceText),
      richText: context.richText || previous?.richText,
      questionNumbers,
      hasFigure: Boolean(previous?.hasFigure || context.hasFigure),
      figureDescription: mergeContextText(previous?.figureDescription, context.figureDescription),
      page: context.page || previous?.page || 0,
      sourcePage: context.sourcePage || context.page || previous?.sourcePage,
      imageData: context.imageData || previous?.imageData,
      pageImageData: context.pageImageData || previous?.pageImageData,
      figureBox: context.figureBox || previous?.figureBox,
      figures,
      manualCropApplied: Boolean(previous?.manualCropApplied || context.manualCropApplied),
    });
    return targetTempId;
  };

  const pdfToImage = async (pdfDoc: PdfDocumentProxy, pageNum: number): Promise<string> => {
    const page = await pdfDoc.getPage(pageNum);
    const viewport = page.getViewport({ scale: 1.55 });
    const canvas = document.createElement('canvas');
    canvas.width = viewport.width;
    canvas.height = viewport.height;

    const context = canvas.getContext('2d');
    if (context) {
      await page.render({ canvasContext: context, viewport }).promise;
      return canvas.toDataURL('image/jpeg', 0.72).split(',')[1];
    }

    throw new Error('Falha ao renderizar PDF');
  };

  const renderPdfRegionToImage = async ({
    pdf,
    pageNumber,
    box,
    scale = 1.9,
    margin = 24,
  }: {
    pdf: PdfDocumentProxy;
    pageNumber: number;
    box?: FigureBox;
    scale?: number;
    margin?: number;
  }): Promise<string> => {
    if (!box) {
      return pdfToImage(pdf, pageNumber);
    }

    const page = await pdf.getPage(pageNumber);
    const viewport = page.getViewport({ scale });
    const canvas = document.createElement('canvas');
    canvas.width = Math.ceil(viewport.width);
    canvas.height = Math.ceil(viewport.height);
    const context = canvas.getContext('2d');
    if (!context) {
      throw new Error('Falha ao renderizar recorte do PDF');
    }
    await page.render({ canvasContext: context, viewport }).promise;

    const normalizedBox = normalizeExtractionFigureBox(box);
    if (!normalizedBox) {
      return canvas.toDataURL('image/jpeg', 0.78).split(',')[1];
    }

    const left = Math.max(0, Math.floor((Number(normalizedBox.x) / 1000) * canvas.width) - margin);
    const top = Math.max(0, Math.floor((Number(normalizedBox.y) / 1000) * canvas.height) - margin);
    const right = Math.min(canvas.width, Math.ceil(((Number(normalizedBox.x) + Number(normalizedBox.width)) / 1000) * canvas.width) + margin);
    const bottom = Math.min(canvas.height, Math.ceil(((Number(normalizedBox.y) + Number(normalizedBox.height)) / 1000) * canvas.height) + margin);
    const width = Math.max(1, right - left);
    const height = Math.max(1, bottom - top);

    if (width < 30 || height < 30) {
      return canvas.toDataURL('image/jpeg', 0.78).split(',')[1];
    }

    const cropCanvas = document.createElement('canvas');
    cropCanvas.width = width;
    cropCanvas.height = height;
    const cropContext = cropCanvas.getContext('2d');
    if (!cropContext) {
      return canvas.toDataURL('image/jpeg', 0.78).split(',')[1];
    }
    cropContext.drawImage(canvas, left, top, width, height, 0, 0, width, height);
    return cropCanvas.toDataURL('image/jpeg', 0.84).split(',')[1];
  };

  const cropFigureImage = async (
    pageImageBase64: string,
    figureBox?: FigureBox,
    options: { manual?: boolean } = {},
  ): Promise<string | undefined> => {
    if (!figureBox) {
      return undefined;
    }

    const box = {
      x: Number(figureBox.x),
      y: Number(figureBox.y),
      width: Number(figureBox.width),
      height: Number(figureBox.height),
    };

    const values = [box.x, box.y, box.width, box.height];
    if (values.some((value) => !Number.isFinite(value)) || box.width <= 0 || box.height <= 0) {
      return undefined;
    }

    const normalizedArea = (box.width * box.height) / 1_000_000;
    if (!options.manual && (normalizedArea > 0.7 || box.width > 920 || box.height > 920)) {
      addLog('Figura ignorada: a caixa retornada pela IA parecia abranger a pagina inteira.');
      return undefined;
    }

    const image = new Image();
    const dataUrl = pageImageBase64.startsWith('data:')
      ? pageImageBase64
      : `data:image/jpeg;base64,${pageImageBase64}`;

    await new Promise<void>((resolve, reject) => {
      image.onload = () => resolve();
      image.onerror = () => reject(new Error('Falha ao carregar imagem para recorte.'));
      image.src = dataUrl;
    });

    const boxPixelWidth = Math.round((box.width / 1000) * image.naturalWidth);
    const boxPixelHeight = Math.round((box.height / 1000) * image.naturalHeight);
    const clampPadding = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));
    const paddingX = options.manual ? 0 : clampPadding(Math.round(boxPixelWidth * 0.055), 16, 46);
    const paddingY = options.manual ? 0 : clampPadding(Math.round(boxPixelHeight * 0.065), 16, 54);
    const boxLeft = Math.round((box.x / 1000) * image.naturalWidth);
    const boxTop = Math.round((box.y / 1000) * image.naturalHeight);
    const boxRight = Math.round(((box.x + box.width) / 1000) * image.naturalWidth);
    const boxBottom = Math.round(((box.y + box.height) / 1000) * image.naturalHeight);
    const sourceX = Math.max(0, boxLeft - paddingX);
    const sourceY = Math.max(0, boxTop - paddingY);
    const sourceRight = Math.min(image.naturalWidth, boxRight + paddingX);
    const sourceBottom = Math.min(image.naturalHeight, boxBottom + paddingY);
    const sourceWidth = sourceRight - sourceX;
    const sourceHeight = sourceBottom - sourceY;

    if (sourceWidth <= 20 || sourceHeight <= 20) {
      return undefined;
    }

    const croppedAreaRatio = (sourceWidth * sourceHeight) / (image.naturalWidth * image.naturalHeight);
    if (!options.manual && croppedAreaRatio > 0.82) {
      addLog('Figura ignorada: mesmo apos o ajuste, o recorte ficou grande demais para ser uma figura isolada.');
      return undefined;
    }

    const canvas = document.createElement('canvas');
    canvas.width = sourceWidth;
    canvas.height = sourceHeight;
    const context = canvas.getContext('2d');
    if (!context) {
      return undefined;
    }

    context.drawImage(image, sourceX, sourceY, sourceWidth, sourceHeight, 0, 0, sourceWidth, sourceHeight);
    return canvas.toDataURL('image/jpeg', 0.9).split(',')[1];
  };

  const createVisualOptionHtml = (label: string, imageBase64: string) => (
    `<img src="${imageBase64.startsWith('data:') ? imageBase64 : `data:image/jpeg;base64,${imageBase64}`}" alt="Alternativa ${label}" loading="lazy" />`
  );

  const extractFirstInlineImageData = (html?: string) => {
    const match = String(html || '').match(/<img\b[^>]*\bsrc\s*=\s*["'](data:image\/[^"']+)["'][^>]*>/i);
    return match?.[1] || '';
  };

  const createSupportImageHtml = (image: ImportedQuestionImageDraft, fallbackIndex: number) => {
    if (!image.imageData) {
      return '';
    }

    const title = image.title || `Figura ${fallbackIndex + 1}`;
    const description = image.description || '';
    return [
      '<figure class="question-support-figure">',
      `<img src="data:image/jpeg;base64,${image.imageData}" alt="${title.replace(/"/g, '&quot;')}" loading="lazy" />`,
      description ? `<figcaption>${description}</figcaption>` : '',
      '</figure>',
    ].filter(Boolean).join('');
  };

  const buildContextPublishContent = (context: ImportedContextDraft) => {
    const sourceText = String(context.text || '').trim();
    const existingFigures = Array.isArray(context.figures) ? context.figures : [];
    const normalizeContextImageUri = (image?: string) => {
      const value = String(image || '').trim();
      if (!value) return '';
      return value.startsWith('data:') ? value : `data:image/jpeg;base64,${value}`;
    };
    const createPublishedContextFigureHtml = (figureKey: string, image?: string, description?: string) => {
      const imageUri = normalizeContextImageUri(image);
      const caption = String(description || context.figureDescription || context.title || '').trim();

      if (!imageUri) {
        return `[FIGURA: ${figureKey}]`;
      }

      return [
        '<figure class="question-support-figure cm-import-context-figure">',
        `<img src="${escapeHtml(imageUri)}" alt="${escapeHtml(caption || 'Figura do contexto')}" loading="lazy" />`,
        caption ? `<figcaption>${escapeHtml(caption)}</figcaption>` : '',
        '</figure>',
      ].filter(Boolean).join('');
    };
    const publishedFigures = existingFigures.map((figure, index) => {
      const metadata = { ...figure };
      delete metadata.imageData;
      delete metadata.pageImageData;
      return {
        ...metadata,
        figureKey: String(figure.figureKey || `${context.tempId}-fig-${String(index + 1).padStart(2, '0')}`),
      };
    });
    const extractedImages: string[] = [];
    const ensurePublishedFigure = (figureKey: string, order: number) => {
      if (publishedFigures.some((figure) => figure.figureKey === figureKey)) {
        return;
      }

      publishedFigures.push({
        figureKey,
        type: 'figure',
        description: context.figureDescription || context.title || 'Figura vinculada ao contexto',
        figureBox: order === 1 ? context.figureBox : undefined,
        page: context.page,
        order,
      });
    };
    const replaceInlineFigure = (html: string) => {
      const inlineImageData = extractFirstInlineImageData(html);
      const order = extractedImages.length + 1;
      const figureKey = existingFigures[order - 1]?.figureKey || `${context.tempId}-fig-${String(order).padStart(2, '0')}`;
      if (inlineImageData) {
        extractedImages.push(inlineImageData);
      }
      ensurePublishedFigure(figureKey, order);
      return `[FIGURA: ${figureKey}]`;
    };
    const textWithoutInlineImages = sourceText
      .replace(/<figure\b[^>]*>[\s\S]*?<img\b[^>]*\bsrc\s*=\s*["']data:image\/[^"']+["'][^>]*>[\s\S]*?<\/figure>/gi, replaceInlineFigure)
      .replace(/<img\b[^>]*\bsrc\s*=\s*["']data:image\/[^"']+["'][^>]*>/gi, replaceInlineFigure);
    const figureImageData = existingFigures.map((figure) => figure.imageData).find(Boolean) || '';
    const imageData = context.imageData || figureImageData || extractedImages[0] || '';
    const figureMarkerPattern = /\[FIGURA:\s*([-\w]+)\]/gi;
    let consumedPrimaryImage = false;
    const richText = (() => {
      if (!sourceText) {
        return imageData
          ? createPublishedContextFigureHtml(`${context.tempId}-fig-01`, imageData)
          : '';
      }

      if (/<img\b/i.test(sourceText)) {
        return sourceText;
      }

      const replaced = sourceText.replace(figureMarkerPattern, (_marker, rawFigureKey) => {
        const figureKey = String(rawFigureKey || '').trim();
        const figure = existingFigures.find((item) => String(item.figureKey || '') === figureKey);
        const figureImageDataForKey = String(figure?.imageData || figure?.pageImageData || '').trim()
          || (!consumedPrimaryImage ? imageData : '');
        consumedPrimaryImage = consumedPrimaryImage || Boolean(figureImageDataForKey);
        return createPublishedContextFigureHtml(
          figureKey,
          figureImageDataForKey,
          figure?.description || context.figureDescription,
        );
      });

      if (replaced !== sourceText) {
        return replaced;
      }

      return imageData
        ? [sourceText, createPublishedContextFigureHtml(`${context.tempId}-fig-01`, imageData)].join('\n\n')
        : sourceText;
    })();

    return {
      text: textWithoutInlineImages,
      richText,
      referenceText: String(context.referenceText || '').trim(),
      imageData,
      figures: publishedFigures,
    };
  };

  const buildIntroTextWithSupportImages = (question: Question) => {
    const draft = question as unknown as ImportedQuestionDraft;
    const introText = formatStructuredSupportHtml(String(draft.introText || (question as { intro_text?: string }).intro_text || '').trim());
    const supportImages = Array.isArray(draft.supportImages) ? draft.supportImages : [];
    const imageHtml = supportImages
      .map((image, index) => createSupportImageHtml(image, index))
      .filter(Boolean)
      .join('\n\n');

    if (!imageHtml) {
      if (!introText || introText === String(draft.introText || (question as { intro_text?: string }).intro_text || '').trim()) {
        return question;
      }

      return {
        ...question,
        introText,
        intro_text: introText,
      } as Question;
    }

    const nextIntroText = [introText, imageHtml].filter(Boolean).join('\n\n');
    return {
      ...question,
      introText: nextIntroText,
      intro_text: nextIntroText,
    } as Question;
  };

  type CroppedOptionImage = {
    imageData: string;
    figureBox: FigureBox;
  };

  const cropVisualOptionImages = async (
    pageImageBase64: string,
    figureBox: FigureBox | undefined,
    optionCount: number,
  ): Promise<CroppedOptionImage[]> => {
    const normalizedBox = normalizeExtractionFigureBox(figureBox);
    if (!pageImageBase64 || !normalizedBox || optionCount < 2) {
      return [];
    }

    const area = (Number(normalizedBox.width) * Number(normalizedBox.height)) / 1_000_000;
    if (area > 0.78 || Number(normalizedBox.width) > 960 || Number(normalizedBox.height) > 960) {
      addLog('Alternativas visuais mantidas para revisao: a caixa retornada pela IA ficou grande demais.');
      return [];
    }

    const box = {
      x: Number(normalizedBox.x),
      y: Number(normalizedBox.y),
      width: Number(normalizedBox.width),
      height: Number(normalizedBox.height),
    };
    const splitHorizontally = box.width > box.height * 1.35;
    const segmentSize = splitHorizontally ? box.width / optionCount : box.height / optionCount;
    const overlap = Math.max(0, Math.min(10, Math.round(segmentSize * 0.035)));
    const croppedImages: CroppedOptionImage[] = [];

    for (let index = 0; index < optionCount; index += 1) {
      const optionBox = splitHorizontally
        ? {
            x: Math.max(0, box.x + (segmentSize * index) - (index > 0 ? overlap : 0)),
            y: box.y,
            width: Math.min(1000, segmentSize + (index > 0 ? overlap : 0) + (index < optionCount - 1 ? overlap : 0)),
            height: box.height,
          }
        : {
            x: box.x,
            y: Math.max(0, box.y + (segmentSize * index) - (index > 0 ? overlap : 0)),
            width: box.width,
            height: Math.min(1000, segmentSize + (index > 0 ? overlap : 0) + (index < optionCount - 1 ? overlap : 0)),
          };

      const cropped = await cropFigureImage(pageImageBase64, optionBox, { manual: true });
      if (!cropped) {
        return [];
      }
      croppedImages.push({ imageData: cropped, figureBox: optionBox });
    }

    return croppedImages;
  };

  const pdfPageToRichText = async (pdfDoc: PdfDocumentProxy, pageNum: number): Promise<PdfPageRichText> => {
    try {
      const page = await pdfDoc.getPage(pageNum);
      const viewport = page.getViewport({ scale: 1 });
      const content = await page.getTextContent();
      const contentRecord = content as unknown as { items?: unknown[]; styles?: Record<string, unknown> };
      const styles = contentRecord.styles || {};
      const rawItems = (contentRecord.items || [])
        .map((item, rawIndex) => {
          const record = toLooseRecord(item);
          const text = normalizeInlineText(String(record?.str || ''));
          if (!text) {
            return null;
          }

          const styleText = readPdfTextStyle(item, styles);
          const transform = Array.isArray(record?.transform) ? record.transform : [];
          const x = Number(transform[4]);
          const baselineY = Number(transform[5]);
          const width = Number(record?.width || 0);
          const height = Number(record?.height || Math.abs(Number(transform[3])) || 0);
          const safeX = Number.isFinite(x) ? x : 0;
          const safeHeight = Number.isFinite(height) && height > 0 ? height : 10;
          const topY = Number.isFinite(baselineY)
            ? Math.max(0, Number(viewport.height || 0) - baselineY - safeHeight)
            : 0;
          return {
            text,
            pageNumber: pageNum,
            rawIndex,
            x: safeX,
            y: topY,
            width: Number.isFinite(width) && width > 0 ? width : Math.max(text.length * safeHeight * 0.46, 1),
            height: safeHeight,
            normalizedX: normalizePdfCoord(safeX, Number(viewport.width || 0)),
            normalizedY: normalizePdfCoord(topY, Number(viewport.height || 0)),
            normalizedWidth: normalizePdfCoord(Number.isFinite(width) && width > 0 ? width : Math.max(text.length * safeHeight * 0.46, 1), Number(viewport.width || 0)),
            normalizedHeight: normalizePdfCoord(safeHeight, Number(viewport.height || 0)),
            fontName: String(record?.fontName || ''),
            fontSize: safeHeight,
            bold: isBoldPdfTextStyle(styleText),
            italic: isItalicPdfTextStyle(styleText),
            underline: isUnderlinePdfTextStyle(styleText),
            hasEOL: record?.hasEOL === true,
          };
        })
        .filter(Boolean) as PositionedPdfTextItem[];
      const rawItemsWithBreaks = rawItems.map((item, index) => {
        const next = rawItems[index + 1];
        const yDelta = next ? Math.abs(item.normalizedY - next.normalizedY) : 0;
        const lineThreshold = Math.max(4, Math.min(item.normalizedHeight, 18) * 0.65);
        const blockThreshold = Math.max(18, item.normalizedHeight * 1.9);
        const lineBreakAfter = Boolean(item.hasEOL || (next && yDelta > lineThreshold));
        const blockBreakAfter = Boolean(lineBreakAfter && next && yDelta > blockThreshold);
        return {
          ...item,
          lineBreakAfter,
          blockBreakAfter,
        };
      });
      const ignoreBold = shouldIgnoreDominantHighlight(rawItemsWithBreaks, 'bold');
      const ignoreItalic = shouldIgnoreDominantHighlight(rawItemsWithBreaks, 'italic');
      const ignoreUnderline = shouldIgnoreDominantHighlight(rawItemsWithBreaks, 'underline');
      const normalizedItems = rawItemsWithBreaks.map((item) => ({
        ...item,
        bold: ignoreBold ? false : item.bold,
        italic: ignoreItalic ? false : item.italic,
        underline: ignoreUnderline ? false : item.underline,
      }));
      const positionedItems = normalizedItems.map(({ lineBreakAfter: _lineBreakAfter, blockBreakAfter: _blockBreakAfter, ...item }) => item);
      const lines = reconstructPdfTextLines(positionedItems, pageNum);
      const columns = detectPdfTextColumns(lines, pageNum);
      const blocks = reconstructPdfTextBlocks(columns, pageNum);
      const layoutPlainText = buildPlainTextFromPdfLayout(columns, blocks);
      const plainText = layoutPlainText || buildPlainPdfText(normalizedItems);
      const highlights = mergeAdjacentHighlights(
        normalizedItems.filter((item) => item.bold || item.italic || item.underline),
      );
      const richText = highlights.length > 0
        ? buildRichTextFromPdfLayout(columns, blocks) || buildHighlightedPdfTextHtml(normalizedItems)
        : plainText;
      const pageParserProfile = resolveExamParserProfile(plainText);
      const questionMarkerCount = findQuestionMarkers(plainText, pageParserProfile).length;
      const textChars = stripHtml(plainText).replace(/\s+/g, '').length;
      const nativeTextCoverage = Math.min(1, textChars / Math.max(250, (Number(viewport.width || 1) * Number(viewport.height || 1)) / 3200));
      const layoutConfidence = Math.min(1, [
        lines.length > 0 ? 0.3 : 0,
        blocks.length > 0 ? 0.25 : 0,
        columns.length > 0 ? 0.2 : 0,
        questionMarkerCount > 0 ? 0.25 : 0,
      ].reduce((sum, value) => sum + value, 0));
      const pageType = classifyPdfPageType(plainText, questionMarkerCount);
      const contentBlocks = buildPageContentInventory({
        pageNumber: pageNum,
        blocks,
        pageType,
      });

      return {
        pageNumber: pageNum,
        plainText,
        richText,
        highlights,
        hasHighlights: highlights.length > 0,
        items: positionedItems,
        lines,
        blocks,
        columns,
        pageType,
        nativeTextCoverage,
        layoutConfidence,
        contentBlocks,
      };
    } catch {
      return {
        pageNumber: pageNum,
        plainText: '',
        richText: '',
        highlights: [],
        hasHighlights: false,
        items: [],
        lines: [],
        blocks: [],
        columns: [],
        pageType: 'blank',
        nativeTextCoverage: 0,
        layoutConfidence: 0,
        contentBlocks: [],
      };
    }
  };

  const pdfPageToText = async (pdfDoc: PdfDocumentProxy, pageNum: number): Promise<string> => (
    (await pdfPageToRichText(pdfDoc, pageNum)).plainText
  );

  const buildTargetAnswerKeySignal = (metadata: ImportMetadata | null) => {
    const targetRoles = normalizeRoleList(metadata?.roles, metadata?.cargos, metadata?.role);
    return targetRoles.length > 0
      ? targetRoles
      : String(metadata?.examTitle || metadata?.title || '').trim();
  };

  const readCurrentAnswerKeyMap = async (pdfjs: PdfJsModule): Promise<Record<number, number>> => {
    if (!kFile) {
      return {};
    }

    const keyBuffer = await kFile.arrayBuffer();
    const keyPdf = await pdfjs.getDocument(keyBuffer).promise;
    const keyMap: Record<number, number> = {};
    const targetAnswerKeySignal = buildTargetAnswerKeySignal(importMetadata);

    for (let pageIndex = 1; pageIndex <= keyPdf.numPages; pageIndex += 1) {
      const keyText = await pdfPageToText(keyPdf, pageIndex);
      if (!shouldUseAnswerKeyPage(keyText, targetAnswerKeySignal)) {
        continue;
      }

      Object.assign(keyMap, parseAnswerKeyFromText(keyText, targetAnswerKeySignal));
    }

    return keyMap;
  };

  const updateDiagnosticsForQuestionList = (questions: Question[]) => {
    setImportDiagnostics((previous) => {
      const coverage = auditQuestionCoverage(questions, previous.expectedQuestionNumbers);
      return {
        ...previous,
        expectedQuestionNumbers: coverage.expectedQuestionNumbers,
        extractedQuestionNumbers: coverage.extractedQuestionNumbers,
        localizedQuestionNumbers: coverage.localizedQuestionNumbers,
        completeQuestionNumbers: coverage.completeQuestionNumbers,
        incompleteQuestionNumbers: coverage.incompleteQuestionNumbers,
        missingQuestionNumbers: coverage.missingQuestionNumbers,
        placeholderQuestionNumbers: coverage.placeholderQuestionNumbers,
        visualPendingQuestionNumbers: coverage.visualPendingQuestionNumbers,
        duplicateQuestionNumbers: coverage.duplicateQuestionNumbers,
        suspiciousQuestionNumbers: coverage.suspiciousQuestionNumbers,
        cardsCreatedCount: coverage.cardsCreatedCount,
        completeCardsCount: coverage.completeCardsCount,
        incompleteCardsCount: coverage.incompleteCardsCount,
        placeholderCardsCount: coverage.placeholderCardsCount,
      };
    });
  };

  useEffect(() => {
    if (extractedQuestions.length > 0) {
      updateDiagnosticsForQuestionList(extractedQuestions);
    }
  }, [extractedQuestions]);

  const shouldReplaceImportedQuestionBackup = (current: Question | undefined, candidate: Question) => {
    if (!current) {
      return true;
    }

    const currentOptions = getQuestionOptionTexts(current).length;
    const candidateOptions = getQuestionOptionTexts(candidate).length;
    if (candidateOptions !== currentOptions) {
      return candidateOptions > currentOptions;
    }

    const currentSupportLength = stripHtml(getQuestionIntroText(current)).length + stripHtml(getQuestionReferenceText(current)).length;
    const candidateSupportLength = stripHtml(getQuestionIntroText(candidate)).length + stripHtml(getQuestionReferenceText(candidate)).length;
    if (candidateSupportLength !== currentSupportLength) {
      return candidateSupportLength > currentSupportLength;
    }

    return stripHtml(getQuestionStatementText(candidate)).length > stripHtml(getQuestionStatementText(current)).length;
  };

  const rememberImportedQuestionBackup = (
    backups: Map<number, Question>,
    question: Question,
    fallbackIndex: number,
  ) => {
    const questionNumber = getExtractedQuestionNumber(question, fallbackIndex);
    if (!Number.isFinite(questionNumber) || questionNumber <= 0) {
      return;
    }
    if (shouldReplaceImportedQuestionBackup(backups.get(questionNumber), question)) {
      backups.set(questionNumber, question);
    }
  };

  const restoreMissingQuestionsFromBackups = (
    questions: Question[],
    expectedQuestionNumbers: number[],
    backups: Map<number, Question>,
  ) => {
    const presentNumbers = new Set(
      questions.map((question, index) => getExtractedQuestionNumber(question, index + 1)),
    );
    const recoveredNumbers = expectedQuestionNumbers.filter((number) => !presentNumbers.has(number) && backups.has(number));
    if (recoveredNumbers.length === 0) {
      return { questions, recoveredNumbers };
    }

    const recoveredQuestions = recoveredNumbers
      .map((number) => backups.get(number))
      .filter(Boolean) as Question[];
    const mergedQuestions = [...questions, ...recoveredQuestions]
      .sort((left, right) => (
        getExtractedQuestionNumber(left, 0) - getExtractedQuestionNumber(right, 0)
      ));

    return { questions: mergedQuestions, recoveredNumbers };
  };

  const inferRetryPagesForMissingQuestions = (
    missingNumbers: number[],
    pagesCount: number,
    questions: Question[],
    pageNumbersByPage: Map<number, number[]>,
  ) => {
    const targetsByPage = new Map<number, Set<number>>();
    const remaining = new Set(missingNumbers);
    const addTarget = (pageIndex: number, questionNumber: number) => {
      if (pageIndex < 1 || pageIndex > pagesCount) {
        return;
      }
      const targets = targetsByPage.get(pageIndex) || new Set<number>();
      targets.add(questionNumber);
      targetsByPage.set(pageIndex, targets);
    };

    pageNumbersByPage.forEach((pageQuestionNumbers, pageIndex) => {
      pageQuestionNumbers
        .filter((questionNumber) => remaining.has(questionNumber))
        .forEach((questionNumber) => {
          addTarget(pageIndex, questionNumber);
          remaining.delete(questionNumber);
        });
    });

    const pageQuestionRanges = Array.from(pageNumbersByPage.entries())
      .filter(([, numbers]) => numbers.length > 0)
      .map(([pageNumber, numbers]) => ({
        pageNumber,
        minQuestion: Math.min(...numbers),
        maxQuestion: Math.max(...numbers),
      }));
    Array.from(remaining).forEach((questionNumber) => {
      const probablePages = inferProbablePagesForMissingQuestion({
        questionNumber,
        extractedQuestions: questions as unknown as ImportedQuestionDraft[],
        pageQuestionRanges,
        totalPages: pagesCount,
        expectedQuestionCount: Math.max(...missingNumbers, ...questions.map((question, index) => getExtractedQuestionNumber(question, index + 1)), 1),
      });
      probablePages.forEach((pageIndex) => addTarget(pageIndex, questionNumber));
    });

    return Array.from(targetsByPage.entries())
      .map(([pageIndex, targets]) => ({
        pageIndex,
        targets: Array.from(targets).sort((a, b) => a - b),
      }))
      .sort((left, right) => left.pageIndex - right.pageIndex);
  };

  const mapTextExtractionQuestions = ({
    result,
    pageIndex,
    pageRichText,
    pageText,
    keyMap,
    selectedFocus,
    contextMap,
    targetNumbers,
    metadata,
    fileName = '',
    logPrefix = 'Texto',
  }: {
    result: PageExtractionResult;
    pageIndex: number;
    pageRichText: PdfPageRichText;
    pageText: string;
    keyMap: Record<number, number>;
    selectedFocus: QuestionTaxonomyLabel;
    contextMap: Map<string, ImportedContextDraft>;
    targetNumbers?: number[];
    metadata?: ImportMetadata | null;
    fileName?: string;
    logPrefix?: string;
  }) => {
    const targetSet = targetNumbers && targetNumbers.length > 0 ? new Set(targetNumbers) : null;
    const nextMetadata = mergeMetadata(metadata ?? importMetadata, result.metadata);

    for (let contextIndex = 0; contextIndex < (result.pageContexts || []).length; contextIndex += 1) {
      const context = (result.pageContexts || [])[contextIndex];
      const tempId = String(context.contextKey || `texto-${pageIndex}-contexto-${contextIndex + 1}`);
      const contextQuestionNumbers = Array.isArray(context.appliesToQuestionNumbers)
        ? context.appliesToQuestionNumbers.map((value) => normalizeQuestionNumber(value, 0)).filter(Boolean)
        : [];
      const scopedContextQuestionNumbers = resolveScopedContextQuestionNumbers(
        contextQuestionNumbers,
        context.text,
        context.referenceText,
        context.title,
      );
      const questionNumbers = targetSet
        ? scopedContextQuestionNumbers.filter((number) => targetSet.has(number))
        : scopedContextQuestionNumbers;
      if (targetSet && scopedContextQuestionNumbers.length > 0 && questionNumbers.length === 0) {
        continue;
      }

      upsertContextDraft(contextMap, {
        tempId,
        title: context.title || `Texto de apoio - ${logPrefix.toLowerCase()} ${pageIndex}`,
        text: formatStructuredSupportHtml(applyPdfHighlightsToHtml(context.text || '', pageRichText.highlights)),
        referenceText: applyPdfHighlightsToHtml(context.referenceText || '', pageRichText.highlights),
        richText: context.richText,
        questionNumbers,
        hasFigure: Boolean(context.hasFigure),
        figureDescription: context.figureDescription || '',
        page: pageIndex,
        sourcePage: context.sourcePage || pageIndex,
        figureBox: context.figureBox,
        figures: (context.figures || []).map((figure, figureIndex) => ({
          ...figure,
          figureKey: String(figure.figureKey || `${tempId}-fig-${String(figureIndex + 1).padStart(2, '0')}`),
        })),
      });
    }

    const mappedQuestions: Question[] = [];
    (result.questions || []).forEach((question, questionIndex) => {
      const rawQuestion = toImportedQuestionDraft(question);
      const inferredQuestionNumber = rawQuestion.number || rawQuestion.questionNumber;
      const questionNumber = normalizeQuestionNumber(inferredQuestionNumber, questionIndex + 1);
      if (targetSet && !targetSet.has(questionNumber)) {
        return;
      }

      const rawText = String(rawQuestion.text || question.enunciado || '').trim();
      const parserProfile = resolveExamParserProfile(fileName, pageText, nextMetadata?.agency);
      const expectedOptionsCount = inferExpectedOptionsCountFromText(rawText, pageText, fileName, nextMetadata?.agency)
        || getExpectedOptionsCount(
          rawQuestion.modality || question.tipo,
          rawQuestion.expectedOptionsCount ?? rawQuestion.expected_options_count,
          parserProfile,
        );
      const normalizedOptions = normalizeImportedOptions(
        rawQuestion.options,
        rawText,
        rawQuestion.modality,
        expectedOptionsCount,
      );
      const options = normalizedOptions.options;
      const questionTextForSignals = normalizedOptions.statement || rawText;
      const cleanQuestionSignalText = stripHtml(questionTextForSignals).replace(/\s+/g, ' ').trim();
      const hasNumberedDraft = Boolean(String(inferredQuestionNumber || '').trim()) && cleanQuestionSignalText.length >= 8;
      const isQuestion = (
        rawQuestion.isQuestion !== false
        || hasNumberedDraft
      )
        && (!isLikelyInstructionText(questionTextForSignals) || hasNumberedDraft)
        && (
          options.length >= 1
          || hasNumberedDraft
        );

      if (!isQuestion) {
        return;
      }

      const correctIndex = keyMap[questionNumber] !== undefined
        ? keyMap[questionNumber]
        : Number.isInteger(rawQuestion.correctOptionIndex)
          ? Number(rawQuestion.correctOptionIndex)
          : 0;
      const isAttributedToAllQuestion = correctIndex === ATTRIBUTED_TO_ALL_ANSWER_INDEX || isImportedQuestionAttributedToAll(rawQuestion);
      const isCanceledQuestion = (
        correctIndex === CANCELED_ANSWER_INDEX
        || (correctIndex < 0 && correctIndex !== ATTRIBUTED_TO_ALL_ANSWER_INDEX)
        || isImportedQuestionMarkedCanceled(rawQuestion)
      );
      const splitStatement = splitSupportContextFromStatement(normalizedOptions.statement || rawText);
      const rawExplicitSupportText = sanitizeSupportContextText(String(rawQuestion.supportText || rawQuestion.introText || '').trim());
      const rawExplicitSupportParts = splitQuestionSupportReference(rawExplicitSupportText);
      const rawExplicitSupportBody = rawExplicitSupportParts.supportText || rawExplicitSupportText;
      const inlineSplitStatement = splitInlineSupportContextFromStatement(splitStatement.statement);
      let questionText = inlineSplitStatement.statement || splitStatement.statement || normalizedOptions.statement || rawText;
      const supportText = rawExplicitSupportBody || mergeContextText(splitStatement.supportText, inlineSplitStatement.supportText);
      const referenceText = mergeReferenceText(
        String(rawQuestion.referenceText || '').trim(),
        rawExplicitSupportParts.referenceText,
        'referenceText' in inlineSplitStatement ? String(inlineSplitStatement.referenceText || '').trim() : '',
        'referenceText' in splitStatement ? String(splitStatement.referenceText || '').trim() : '',
      );
      const referencedContextKey = String(rawQuestion.contextKey || '').trim();
      const referencedContext = referencedContextKey ? contextMap.get(referencedContextKey) : undefined;
      const referencedContextIsShared = Boolean(referencedContext && referencedContext.questionNumbers.length > 1);
      const hasOnlyHeaderSupportText = Boolean(supportText) && isLikelyPageBookletHeader(supportText);
      const shouldStoreSupportAsIntroText = Boolean(supportText)
        && !hasOnlyHeaderSupportText
        && !referencedContextIsShared;
      const linkedContextKey = shouldStoreSupportAsIntroText ? '' : referencedContextKey;
      const roleLabels = normalizeRoleList(
        nextMetadata?.roles,
        nextMetadata?.cargos,
        nextMetadata?.role,
        result.metadata?.roles,
        result.metadata?.cargos,
        result.metadata?.role,
      );
      const agencyLabel = String(nextMetadata?.agency || result.metadata?.agency || '').trim();
      const organizationLabels = normalizeOrganizationList(
        nextMetadata?.sources,
        nextMetadata?.orgaos,
        nextMetadata?.source,
        result.metadata?.source,
      );
      const levelLabel = String(rawQuestion.level || nextMetadata?.level || result.metadata?.level || '').trim();
      const optionsForItems = options.map((option) => (
        /<img\b|data:image\//i.test(option)
          ? option
          : applyPdfHighlightsToHtml(option, pageRichText.highlights)
      ));

      questionText = applyPdfHighlightsToHtml(questionText, pageRichText.highlights);
      const introText = shouldStoreSupportAsIntroText
        ? formatStructuredSupportHtml(applyPdfHighlightsToHtml(supportText, pageRichText.highlights))
        : '';
      const formattedReferenceText = applyPdfHighlightsToHtml(referenceText, pageRichText.highlights);
      const taxonomy = normalizeTaxonomyForCurrentImport(
        String(rawQuestion.subject || '').trim(),
        String(rawQuestion.topic || '').trim(),
        String(rawQuestion.specificSubject || '').trim(),
        [
          rawText,
          questionText,
          supportText,
          referenceText,
          ...options,
          pageText,
        ],
      );
      const validation = validateExtractedQuestionDraft({
        statement: questionText,
        options: optionsForItems,
        expectedOptionsCount,
        questionType: inferQuestionType(rawText, optionsForItems, parserProfile),
        rawText,
        hasFigure: rawQuestion.hasFigure,
        figureBox: rawQuestion.figureBox || rawQuestion.supportFigureBox || rawQuestion.optionFigureBox,
        contextKey: linkedContextKey,
        supportText: introText,
      });
      const validationReasons = Array.from(new Set([
        ...(rawQuestion.statusReasons || []),
        ...(rawQuestion.validationReasons || []),
        ...validation.reasons,
      ]));
      const extractionStatus = validation.status !== 'ok'
        ? validation.status
        : rawQuestion.extractionStatus || rawQuestion.status || 'ok';
      const rejectionReason = rawQuestion.rejectionReason || validationReasons[0] || '';

      const mappedQuestion = normalizeCanceledImportedQuestion({
        ...question,
        questionNumber,
        question_number: questionNumber,
        sourcePage: pageIndex,
        source_page: pageIndex,
        fieldMetadata: getQuestionFieldMetadata(question),
        extractionFieldMetadata: getQuestionFieldMetadata(question),
        contextKey: linkedContextKey,
        grupoQuestaoTempId: linkedContextKey || undefined,
        introText,
        intro_text: introText,
        referenceText: formattedReferenceText,
        reference_text: formattedReferenceText,
        enunciado: questionText,
        enunciado_clean: stripHtml(questionText),
        bancas: agencyLabel
          ? [{ sigla: agencyLabel, name: agencyLabel, id: null, slug: slugify(agencyLabel) }]
          : [],
        orgaos: organizationLabels.map((organizationLabel) => createTaxonomyLabel(organizationLabel)),
        cargos: roleLabels.map((roleLabel) => createTaxonomyLabel(roleLabel, { descricao: roleLabel })),
        assuntos: buildResolvedSubjectTaxonomies(question as Question, taxonomy),
        carreiras: [selectedFocus],
        anos: nextMetadata?.year ? [Number(nextMetadata.year)] : [new Date().getFullYear()],
        niveis: levelLabel ? [createTaxonomyLabel(levelLabel)] : [],
        tiposProva: nextMetadata?.examType ? [createTaxonomyLabel(nextMetadata.examType)] : [],
        expectedOptionsCount,
        expected_options_count: expectedOptionsCount,
        tipo: optionsForItems.length === 2 ? 'certo ou errado' : 'multipla escolha',
        dificuldade: normalizeDifficulty(rawQuestion.difficulty),
        correctOptionIndex: isCanceledQuestion || isAttributedToAllQuestion ? 0 : correctIndex,
        anulada: isCanceledQuestion,
        isCanceled: isCanceledQuestion,
        isCancelled: isCanceledQuestion,
        isAttributedToAll: isAttributedToAllQuestion,
        attributedToAll: isAttributedToAllQuestion,
        is_attributed_to_all: isAttributedToAllQuestion,
        status: extractionStatus,
        extractionStatus,
        statusReasons: validationReasons,
        validationReasons,
        rejectionReason,
        needsImportReview: optionsForItems.length < expectedOptionsCount || extractionStatus !== 'ok',
        itens: optionsForItems.map((option, optionIndex) => ({
          id: optionIndex + 1,
          ordem: optionIndex + 1,
          rotulo: String.fromCharCode(65 + optionIndex),
          corpo: option,
          corpo_clean: stripHtml(option).trim(),
        })),
        resposta: isCanceledQuestion || isAttributedToAllQuestion ? 1 : correctIndex + 1,
        questionOrigin: 'exam',
        question_origin: 'exam',
        stats: { totalAttempts: 0, correctCount: 0, wrongCount: 0 },
        comments: [],
      } as unknown as Question, isCanceledQuestion, isAttributedToAllQuestion);

      mappedQuestions.push(mappedQuestion);
    });

    return { questions: mappedQuestions, metadata: nextMetadata };
  };

  const runPythonImportBridge = async (
    selectedFocus: QuestionTaxonomyLabel,
    selectedExamMetadata: ImportMetadata,
  ) => {
    if (!qFile) return false;

    const metadataPayload = {
      ...(selectedExam ? selectedExamMetadata : {}),
      selectedExamId: selectedExam?.id || selectedExamId || undefined,
      selectedExamTitle: selectedExam?.nome || selectedExamMetadata.examTitle || selectedExamMetadata.title,
      focus: selectedFocus,
      focusName: getTaxonomyText(selectedFocus),
      totalQuestions: selectedExamMetadata.totalQuestions
        || selectedExamRecord?.totalQuestions
        || selectedExamRecord?.totalQuestoes
        || selectedExam?.totalQuestoes,
      source: selectedExamMetadata.source,
      sources: selectedExamMetadata.sources,
      roles: selectedExamMetadata.roles || selectedExamMetadata.cargos,
      agency: selectedExamMetadata.agency,
      year: selectedExamMetadata.year || selectedExamMetadata.ano,
      level: selectedExamMetadata.level,
    } as Record<string, unknown>;

    let pythonResult: Awaited<ReturnType<typeof runPythonExtractor>> = null;
    try {
      pythonResult = await runPythonExtractor({
        examFile: qFile,
        answerKeyFile: kFile,
        metadata: metadataPayload,
      });
    } catch (error) {
      addLog(`Extrator Python indisponivel (${readErrorMessage(error)}). Usando fluxo legado temporariamente.`);
      return false;
    }

    if (!pythonResult) {
      addLog('Extrator Python nao configurado. Defina NEXT_PUBLIC_IMPORT_EXTRACTOR_URL para ativar a nova arquitetura.');
      return false;
    }

    (pythonResult.logs || []).forEach((message) => addLog(message));
    if (pythonResult.reviewObject && Object.keys(pythonResult.reviewObject).length > 0) {
      addLog(`JSON_CANONICO_DA_EXTRACAO = ${JSON.stringify(pythonResult.reviewObject, null, 2)}`);
    }

    const nextQuestions = Array.isArray(pythonResult.questions)
      ? pythonResult.questions as unknown as Question[]
      : [];
    const nextContexts = Array.isArray(pythonResult.contexts)
      ? pythonResult.contexts.map((context) => ({
        tempId: context.tempId,
        title: context.title || 'Contexto',
        text: context.text || '',
        referenceText: context.referenceText || '',
        richText: context.richText || context.text || '',
        questionNumbers: Array.isArray(context.questionNumbers) ? context.questionNumbers : [],
        hasFigure: Boolean(context.hasFigure),
        figureDescription: context.figureDescription || '',
        page: Number(context.page || context.sourcePage || 0),
        sourcePage: Number(context.sourcePage || context.page || 0) || undefined,
      } as ImportedContextDraft))
      : [];

    const pythonDiagnostics = pythonResult.diagnostics || ({} as NonNullable<typeof pythonResult.diagnostics>);
    const nextDiagnostics: ImportDiagnostics = {
      expectedQuestionNumbers: pythonDiagnostics.expectedQuestionNumbers || [],
      extractedQuestionNumbers: pythonDiagnostics.extractedQuestionNumbers || [],
      localizedQuestionNumbers: pythonDiagnostics.localizedQuestionNumbers || [],
      completeQuestionNumbers: pythonDiagnostics.completeQuestionNumbers || [],
      incompleteQuestionNumbers: pythonDiagnostics.incompleteQuestionNumbers || [],
      missingQuestionNumbers: pythonDiagnostics.missingQuestionNumbers || [],
      placeholderQuestionNumbers: pythonDiagnostics.placeholderQuestionNumbers || [],
      visualPendingQuestionNumbers: pythonDiagnostics.visualPendingQuestionNumbers || [],
      duplicateQuestionNumbers: pythonDiagnostics.duplicateQuestionNumbers || [],
      suspiciousQuestionNumbers: pythonDiagnostics.suspiciousQuestionNumbers || [],
      cardsCreatedCount: pythonDiagnostics.cardsCreatedCount || nextQuestions.length,
      completeCardsCount: pythonDiagnostics.completeCardsCount || 0,
      incompleteCardsCount: pythonDiagnostics.incompleteCardsCount || 0,
      placeholderCardsCount: pythonDiagnostics.placeholderCardsCount || 0,
      pagesWithoutNativeText: pythonDiagnostics.pagesWithoutNativeText || [],
      lowConfidencePages: pythonDiagnostics.lowConfidencePages || [],
      aiQuotaLimitReached: Boolean(pythonDiagnostics.aiQuotaLimitReached),
      aiTokenLimitReached: Boolean(pythonDiagnostics.aiTokenLimitReached),
      aiLimitReached: Boolean(pythonDiagnostics.aiLimitReached),
      aiCallCount: Number(pythonDiagnostics.aiCallCount || 0),
      aiCallLimit: Number(pythonDiagnostics.aiCallLimit || 0),
      aiCallsSkipped: Number(pythonDiagnostics.aiCallsSkipped || 0),
      aiCallsSavedEstimate: Number(pythonDiagnostics.aiCallsSavedEstimate || 0),
    };

    setExtractedQuestions(nextQuestions);
    setExtractedContexts(nextContexts);
    setImportDiagnostics(nextDiagnostics);
    setImportMetadata({
      ...(selectedExam ? selectedExamMetadata : {}),
      ...(pythonResult.metadata || {}),
      subjects: deriveQuestionSubjects(nextQuestions),
    } as ImportMetadata);
    setExamProgress(100);
    setKeyProgress(100);

    addLog(
      `IMPORTACAO PYTHON CONCLUIDA! ${nextDiagnostics.cardsCreatedCount} card(s): `
      + `${nextDiagnostics.completeCardsCount} completo(s), `
      + `${nextDiagnostics.incompleteCardsCount} incompleto(s), `
      + `${nextDiagnostics.placeholderCardsCount} pendente(s).`,
    );
    return true;
  };

  const handleImportProcess = async () => {
    if (!qFile || !kFile) {
      addToast('Arquivos de prova e gabarito são obrigatórios para este processo.', 'error');
      return;
    }
    const selectedFocus = resolveSelectedFocus();
    if (!selectedFocus) {
      addToast('Selecione ou crie um foco antes de importar a prova.', 'error');
      return;
    }

    setIsProcessing(true);
    setLogs([]);
    setExtractedQuestions([]);
    setExtractedContexts([]);
    setPublishedExam(selectedExam ? { ...selectedExam } as unknown as Record<string, unknown> : null);
    setPublishedQuestionNumbers([]);
    finishPublishingAction();
    setImportDiagnostics({
      expectedQuestionNumbers: [],
      extractedQuestionNumbers: [],
      localizedQuestionNumbers: [],
      completeQuestionNumbers: [],
      incompleteQuestionNumbers: [],
      missingQuestionNumbers: [],
      placeholderQuestionNumbers: [],
      visualPendingQuestionNumbers: [],
      duplicateQuestionNumbers: [],
      suspiciousQuestionNumbers: [],
      cardsCreatedCount: 0,
      completeCardsCount: 0,
      incompleteCardsCount: 0,
      placeholderCardsCount: 0,
      aiLimitReached: false,
      aiTokenLimitReached: false,
      aiQuotaLimitReached: false,
      aiCallCount: 0,
      aiCallLimit: 0,
      aiLimitedPages: [],
      aiTokenLimitPages: [],
      aiQuotaLimitPages: [],
      pagesWithoutNativeText: [],
      aiLimitMessage: '',
      aiTokenLimitMessage: '',
      aiQuotaLimitMessage: '',
    });
    const selectedExamMetadata = getSelectedExamMetadata();
    setImportMetadata(selectedExam ? selectedExamMetadata : null);
    setExamProgress(0);
    setKeyProgress(0);

    const handledByPythonExtractor = await runPythonImportBridge(selectedFocus, selectedExamMetadata);
    if (handledByPythonExtractor) {
      setIsProcessing(false);
      return;
    }

    try {
      const pdfjs = await loadPdfJsModule();
      const questionBuffer = await qFile.arrayBuffer();
      const questionPdfFingerprint = computeArrayBufferFingerprint(questionBuffer, qFile);
      const questionPdf = await pdfjs.getDocument(questionBuffer).promise;
      const firstQuestionPageText = questionPdf.numPages > 0 ? await pdfPageToText(questionPdf, 1) : '';
      const inferredMetadata = inferMetadataFromText(firstQuestionPageText, qFile.name);
      const initialMetadata = selectedExam
        ? { ...inferredMetadata, ...selectedExamMetadata }
        : inferredMetadata;
      if (initialMetadata && Object.keys(initialMetadata).length > 0) {
        setImportMetadata(initialMetadata);
      }
      const provider = String(systemSettings.aiProvider || 'auto').toLowerCase();
      const geminiModel = systemSettings.geminiModel || 'gemini-3.5-flash';
      const openAiModel = systemSettings.openAiModel || 'gpt-4o-mini';
      addLog(provider === 'gemini'
        ? `IA configurada: Gemini / ${geminiModel}.`
        : provider === 'openai'
          ? `IA configurada: OpenAI / ${openAiModel}.`
          : `IA configurada: modo automatico (OpenAI ${openAiModel}; fallback Gemini ${geminiModel}).`);
      const importAiCallLimit = Math.min(12, Math.max(3, Math.ceil(Math.max(1, questionPdf.numPages) * 0.20)));
      const activeAiModel = provider === 'openai'
        ? openAiModel
        : provider === 'gemini'
          ? geminiModel
          : `${openAiModel}|${geminiModel}`;
      const importAiBudget: ImportAiBudget = {
        maxCalls: importAiCallLimit,
        usedCalls: 0,
        reservedCalls: 0,
        skippedCalls: 0,
        failedCalls: 0,
        cacheHits: 0,
        exhausted: false,
      };
      const importAiCache = new Set<string>();
      const aiLimitedPages = new Set<number>();
      const aiTokenLimitPages = new Set<number>();
      const aiQuotaLimitPages = new Set<number>();
      const aiLimitedPurposes = new Set<string>();
      let aiQuotaExceeded = false;
      const buildImportAiCacheKey = (
        purpose: string,
        details?: {
          fingerprint?: string;
          page?: number;
          targets?: number[];
          text?: string;
          cropBox?: FigureBox;
          promptVersion?: string;
        },
      ) => [
        'exam-import',
        EXAM_IMPORT_PARSER_VERSION,
        activeAiModel,
        details?.fingerprint || questionPdfFingerprint,
        details?.promptVersion || 'questions-page-v2',
        purpose,
        details?.page ? `p${details.page}` : '',
        details?.targets?.length ? `q${details.targets.slice().sort((left, right) => left - right).join('-')}` : '',
        details?.cropBox ? `box${buildFigureBoxCacheSignature(details.cropBox)}` : '',
        details?.text ? hashTextForImportCache(normalizeComparisonText(details.text).slice(0, 1600)) : '',
      ].filter(Boolean).join('|');
      const syncImportAiBudgetDiagnostics = (message?: string) => {
        setImportDiagnostics((previous) => ({
          ...previous,
          aiLimitReached: previous.aiLimitReached || importAiBudget.exhausted,
          aiCallCount: importAiBudget.usedCalls,
          aiCallLimit: importAiBudget.maxCalls,
          aiLimitMessage: message || previous.aiLimitMessage,
        }));
      };
      const reserveImportAiCall = (
        purpose: string,
        details?: {
          fingerprint?: string;
          page?: number;
          targets?: number[];
          text?: string;
          cropBox?: FigureBox;
          promptVersion?: string;
        },
      ): ImportAiCallReservation | null => {
        if (!isAiConfigured()) {
          importAiBudget.skippedCalls += 1;
          return null;
        }
        const cacheKey = buildImportAiCacheKey(purpose, details);
        if (importAiCache.has(cacheKey)) {
          importAiBudget.cacheHits += 1;
          addLog(`IA cache hit: ${purpose}. Chamada repetida ignorada nesta importacao.`);
          syncImportAiBudgetDiagnostics();
          return null;
        }
        if (aiQuotaExceeded) {
          aiLimitedPurposes.add(purpose);
          importAiBudget.skippedCalls += 1;
          return null;
        }
        if (importAiBudget.usedCalls >= importAiBudget.maxCalls) {
          aiLimitedPurposes.add(purpose);
          importAiBudget.skippedCalls += 1;
          importAiBudget.exhausted = true;
          syncImportAiBudgetDiagnostics(`Limite adaptativo de IA atingido (${importAiBudget.usedCalls}/${importAiBudget.maxCalls}). O importador continuou com PDF.js/parser mecanico e deixou pendencias para nova tentativa.`);
          return null;
        }
        importAiBudget.usedCalls += 1;
        importAiBudget.reservedCalls += 1;
        importAiCache.add(cacheKey);
        addLog(`IA chamada ${importAiBudget.usedCalls}/${importAiBudget.maxCalls}: ${purpose}.`);
        syncImportAiBudgetDiagnostics();
        return { purpose, cacheKey, callNumber: importAiBudget.usedCalls };
      };
      if (selectedExam) {
        addLog(`Prova vinculada ao Banco de Provas: #${selectedExam.id} - ${selectedExam.nome}.`);
      }
      const targetAnswerRole = normalizeRoleList(initialMetadata.roles, initialMetadata.cargos, initialMetadata.role);
      const targetAnswerKeySignal = targetAnswerRole.length > 0
        ? targetAnswerRole
        : String(initialMetadata.examTitle || initialMetadata.title || '').trim();

      addLog('Iniciando leitura do gabarito...');
      const keyBuffer = await kFile.arrayBuffer();
      const answerKeyFingerprint = computeArrayBufferFingerprint(keyBuffer, kFile);
      const keyPdf = await pdfjs.getDocument(keyBuffer).promise;
      const keyMap: Record<number, number> = {};
      const initialMetadataRecord = initialMetadata as Record<string, unknown>;
      const answerKeyPromptContext = {
        agencyHint: toPromptHint(initialMetadata.agency),
        sourceHint: toPromptHint(initialMetadata.sources, initialMetadata.orgaos, initialMetadata.source),
        yearHint: toPromptHint(initialMetadata.year, initialMetadata.ano),
        roleHint: toPromptHint(targetAnswerRole, initialMetadata.role, initialMetadata.cargo, initialMetadata.examTitle, selectedExam?.nome),
        bookletTypeHint: toPromptHint(initialMetadata.bookletType, initialMetadata.cadernoTipo, initialMetadata.tipoCaderno, initialMetadata.booklet, initialMetadata.caderno),
        bookletColorHint: toPromptHint(initialMetadata.bookletColor, initialMetadata.cadernoCor, initialMetadata.corCaderno),
        expectedQuestionCount: Number(toPromptHint(initialMetadataRecord.totalQuestions, initialMetadataRecord.total_questions)) || undefined,
      };
      for (let pageIndex = 1; pageIndex <= keyPdf.numPages; pageIndex += 1) {
        const keyText = await pdfPageToText(keyPdf, pageIndex);
        if (!shouldUseAnswerKeyPage(keyText, targetAnswerKeySignal)) {
          addLog(`Gabarito pag ${pageIndex}: pagina ignorada por nao corresponder ao cargo/prova selecionado.`);
          setKeyProgress(Math.round((pageIndex / keyPdf.numPages) * 100));
          continue;
        }
        const mechanicalKeyMap = parseAnswerKeyFromText(keyText, targetAnswerKeySignal);
        if (Object.keys(mechanicalKeyMap).length >= 5) {
          Object.assign(keyMap, mechanicalKeyMap);
          addLog(`Gabarito pag ${pageIndex}: ${Object.keys(mechanicalKeyMap).length} respostas extraidas mecanicamente.`);
        } else if (reserveImportAiCall(`Gabarito pag ${pageIndex}`, {
          fingerprint: answerKeyFingerprint,
          page: pageIndex,
          text: keyText,
          promptVersion: 'answer-key-v2',
        })) {
          try {
            const keyImage = await pdfToImage(keyPdf, pageIndex);
            Object.assign(keyMap, await aiService.extractAnswerKeyMapping(keyImage, answerKeyPromptContext));
            addLog(`Gabarito pag ${pageIndex}: parser local nao encontrou respostas; IA usada como fallback.`);
          } catch (error) {
            importAiBudget.failedCalls += 1;
            addLog(`Gabarito pag ${pageIndex}: IA indisponivel (${readErrorMessage(error)}). Pagina mantida sem respostas automaticas.`);
          }
        } else {
          addLog(`Gabarito pag ${pageIndex}: parser local nao encontrou respostas suficientes; pagina mantida para revisao sem nova chamada de IA.`);
        }
        setKeyProgress(Math.round((pageIndex / keyPdf.numPages) * 100));
      }
      setKeyProgress(100);
      addLog('Gabarito oficial mapeado.');
      const mappedAnswerKeyNumbers = Object.keys(keyMap)
        .map((key) => Number(key))
        .filter((number) => Number.isFinite(number) && number > 0)
        .sort((a, b) => a - b);
      const expectedTotalFromMetadata = readExpectedQuestionTotal(
        initialMetadataRecord.totalQuestions,
        initialMetadataRecord.total_questions,
        initialMetadataRecord.totalQuestoes,
        initialMetadataRecord.questionCount,
        selectedExam?.totalQuestoes,
        selectedExamRecord?.totalQuestions,
        selectedExamRecord?.totalQuestoes,
        selectedExamRecord?.questionCount,
      );
      const expectedQuestionNumbers = expectedTotalFromMetadata > mappedAnswerKeyNumbers.length
        ? buildSequentialQuestionNumbers(expectedTotalFromMetadata)
        : mappedAnswerKeyNumbers;
      if (expectedQuestionNumbers.length > 0) {
        const initialPlaceholderCoverage = auditQuestionCoverage([], expectedQuestionNumbers);
        const initialPlaceholderDrafts = ensureExpectedQuestionDrafts({
          questions: [],
          expectedQuestionNumbers,
          diagnostics: {
            ...initialPlaceholderCoverage,
            aiCallCount: importAiBudget.usedCalls,
            aiCallLimit: importAiBudget.maxCalls,
          },
          defaultMetadata: initialMetadata,
          totalPages: questionPdf.numPages,
          answerKeyMap: keyMap,
          defaultFocus: selectedFocus,
        });
        setExtractedQuestions(initialPlaceholderDrafts.questions as unknown as Question[]);
        setImportDiagnostics((previous) => ({
          ...previous,
          expectedQuestionNumbers: initialPlaceholderDrafts.diagnostics.expectedQuestionNumbers,
          extractedQuestionNumbers: initialPlaceholderDrafts.diagnostics.extractedQuestionNumbers,
          localizedQuestionNumbers: initialPlaceholderDrafts.diagnostics.localizedQuestionNumbers,
          completeQuestionNumbers: initialPlaceholderDrafts.diagnostics.completeQuestionNumbers,
          incompleteQuestionNumbers: initialPlaceholderDrafts.diagnostics.incompleteQuestionNumbers,
          missingQuestionNumbers: initialPlaceholderDrafts.diagnostics.missingQuestionNumbers,
          placeholderQuestionNumbers: initialPlaceholderDrafts.diagnostics.placeholderQuestionNumbers,
          visualPendingQuestionNumbers: initialPlaceholderDrafts.diagnostics.visualPendingQuestionNumbers,
          duplicateQuestionNumbers: initialPlaceholderDrafts.diagnostics.duplicateQuestionNumbers,
          suspiciousQuestionNumbers: initialPlaceholderDrafts.diagnostics.suspiciousQuestionNumbers,
          cardsCreatedCount: initialPlaceholderDrafts.diagnostics.cardsCreatedCount,
          completeCardsCount: initialPlaceholderDrafts.diagnostics.completeCardsCount,
          incompleteCardsCount: initialPlaceholderDrafts.diagnostics.incompleteCardsCount,
          placeholderCardsCount: initialPlaceholderDrafts.diagnostics.placeholderCardsCount,
          aiCallCount: importAiBudget.usedCalls,
          aiCallLimit: importAiBudget.maxCalls,
        }));
        if (mappedAnswerKeyNumbers.length > 0 && expectedTotalFromMetadata > mappedAnswerKeyNumbers.length) {
          addLog(`Gabarito mapeou ${mappedAnswerKeyNumbers.length} resposta(s); total esperado da prova/metadados: ${expectedTotalFromMetadata} questoes.`);
        } else if (mappedAnswerKeyNumbers.length > 0) {
          addLog(`Gabarito indica ${expectedQuestionNumbers.length} questoes esperadas.`);
        } else {
          addLog(`Total esperado definido pela prova/metadados: ${expectedQuestionNumbers.length} questoes.`);
        }
        addLog(`${initialPlaceholderDrafts.diagnostics.cardsCreatedCount} card(s) de revisao inicial criado(s); o parser substituirá pendentes quando localizar conteúdo real.`);
      }

      addLog('Iniciando motor de extracao IA (prova)...');
      const pagesCount = questionPdf.numPages;
      addLog(`Arquivo de prova identificado: ${pagesCount} paginas.`);

      let allFoundQuestions: Question[] = [];
      let currentMetadata: ImportMetadata | null = initialMetadata;
      const expectedQuestionSet = new Set<number>(expectedQuestionNumbers);
      const contextMap = new Map<string, ImportedContextDraft>();
      const importedQuestionBackups = new Map<number, Question>();
      const processedPageNumbers = new Set<number>();
      const pagesWithoutNativeText = new Set<number>();
      const pagesWithoutQuestionDrafts = new Set<number>();
      const pagesWithAiFallback = new Set<number>();
      const failedPageReads = new Map<number, string>();
      const pageQuestionRanges = new Map<number, PageQuestionRange>();
      type CarryoverContext = { text: string; referenceText: string; title: string; startPage: number; visualBlocks: PageContentBlock[] };
      let pendingCarryoverContext: CarryoverContext | null = null;

      for (let pageIndex = 1; pageIndex <= pagesCount; pageIndex += 1) {
        addLog(`Lendo pag ${pageIndex}/${pagesCount}...`);
        try {

        const pageRichText = await pdfPageToRichText(questionPdf, pageIndex);
        const pageText = pageRichText.plainText;
        const orphanContentBlocks = (pageRichText.contentBlocks || []).filter((block) => (
          block.type === 'unknown'
          && (block.linkedQuestionNumbers || []).length === 0
          && stripHtml(block.text).replace(/\s+/g, ' ').trim().length >= 20
        ));
        if (orphanContentBlocks.length > 0) {
          setImportDiagnostics((previous) => ({
            ...previous,
            orphanContentBlocks: [
              ...(previous.orphanContentBlocks || []).filter((block) => block.pageNumber !== pageIndex),
              ...orphanContentBlocks,
            ],
          }));
        }
        const cleanPageTextLength = stripHtml(pageText).replace(/\s+/g, ' ').trim().length;
        if (cleanPageTextLength < 40) {
          pagesWithoutNativeText.add(pageIndex);
        }
        const normalizedPageText = normalizeQuestionMarkerText(pageText).replace(/\s+/g, ' ').trim();
        const pageParserProfileForText = buildAdaptiveExamParserProfile(
          [qFile.name, normalizedPageText, currentMetadata?.agency].filter(Boolean).join('\n'),
          resolveExamParserProfile(qFile.name, normalizedPageText, currentMetadata?.agency),
        );
        const currentPageMarkers = findQuestionMarkers(normalizedPageText, pageParserProfileForText);
        addLog(`Pag ${pageIndex}: texto nativo ${cleanPageTextLength} caractere(s), ${currentPageMarkers.length} marcador(es) de questao detectado(s).`);
        const pagePrefix = currentPageMarkers[0]
          ? normalizedPageText.slice(0, currentPageMarkers[0].index).trim()
          : '';
        if (pagePrefix && allFoundQuestions.length > 0) {
          const lastQuestion = allFoundQuestions[allFoundQuestions.length - 1];
          const completedQuestion = completeQuestionOptionsFromPrefix(lastQuestion, pagePrefix);
          if (completedQuestion) {
            allFoundQuestions = [
              ...allFoundQuestions.slice(0, -1),
              completedQuestion,
            ];
            const carryoverReviewState = ensureExpectedQuestionDrafts({
              questions: allFoundQuestions as unknown as ImportedQuestionDraft[],
              expectedQuestionNumbers: Array.from(expectedQuestionSet).sort((left, right) => left - right),
              diagnostics: {
                ...auditQuestionCoverage(allFoundQuestions, Array.from(expectedQuestionSet).sort((left, right) => left - right)),
                aiLimitReached: aiLimitedPages.size > 0 || aiLimitedPurposes.size > 0,
                aiTokenLimitReached: aiTokenLimitPages.size > 0,
                aiQuotaLimitReached: aiQuotaLimitPages.size > 0,
                aiCallCount: importAiBudget.usedCalls,
                aiCallLimit: importAiBudget.maxCalls,
                aiCallsSkipped: importAiBudget.skippedCalls,
                aiCallsSavedEstimate: importAiBudget.cacheHits + importAiBudget.skippedCalls,
                aiLimitedPages: Array.from(aiLimitedPages),
                aiTokenLimitPages: Array.from(aiTokenLimitPages),
                aiQuotaLimitPages: Array.from(aiQuotaLimitPages),
                pagesWithoutNativeText: Array.from(pagesWithoutNativeText),
              },
              defaultMetadata: currentMetadata || initialMetadata,
              pageQuestionRanges: Array.from(pageQuestionRanges.values()),
              totalPages: pagesCount,
              answerKeyMap: keyMap,
              defaultFocus: selectedFocus,
            });
            setExtractedQuestions(carryoverReviewState.questions as unknown as Question[]);
            addLog(`Questao #${getExtractedQuestionNumber(completedQuestion, allFoundQuestions.length)} completada com alternativas que continuavam na pag ${pageIndex}.`);
          }
        }
        const pageQuestionNumbers = extractQuestionNumbersFromText(pageText);
        pageQuestionNumbers.forEach((number) => expectedQuestionSet.add(number));
        if (pageQuestionNumbers.length > 0) {
          pageQuestionRanges.set(pageIndex, {
            pageNumber: pageIndex,
            minQuestion: Math.min(...pageQuestionNumbers),
            maxQuestion: Math.max(...pageQuestionNumbers),
          });
        }
        const structuredPagePrefix = extractStructuredPrefixBeforeFirstQuestion(pageText);
        const pageSupportCandidate = pageQuestionNumbers.length > 0
          ? structuredPagePrefix || pagePrefix
          : normalizePdfTextForParsing(pageText, pageParserProfileForText);
        const pagePrefixParts = splitQuestionSupportReference(pageSupportCandidate);
        const pagePrefixSupportText = sanitizeSupportContextText(pagePrefixParts.supportText || pageSupportCandidate);
        if (
          pageQuestionNumbers.length === 0
          && shouldPromoteAsSupportContext(pagePrefixSupportText)
        ) {
          const previousCarryoverContext = pendingCarryoverContext as CarryoverContext | null;
          const visualBlocks = (pageRichText.contentBlocks || []).filter((block) => (
            ['figure', 'table'].includes(block.type)
            && (
              block.id.endsWith('-regiao-visual')
              || VISUAL_BLOCK_PATTERN.test(pagePrefixSupportText)
            )
          ));
          pendingCarryoverContext = {
            text: previousCarryoverContext
              ? mergeContextText(previousCarryoverContext.text, pagePrefixSupportText)
              : pagePrefixSupportText,
            referenceText: mergeReferenceText(previousCarryoverContext?.referenceText, pagePrefixParts.referenceText),
            title: previousCarryoverContext?.title || `Texto de apoio - pagina ${pageIndex}`,
            startPage: previousCarryoverContext?.startPage || pageIndex,
            visualBlocks: [
              ...(previousCarryoverContext?.visualBlocks || []),
              ...visualBlocks,
            ],
          };
          addLog(`Pag ${pageIndex}: texto-base sem questoes guardado para vinculo com a proxima pagina.`);
        }
        if (
          pageQuestionNumbers.length > 0
          && shouldPromoteAsSupportContext(mergeContextText(pendingCarryoverContext?.text, pagePrefixSupportText))
        ) {
          const mergedSupportText = mergeContextText(pendingCarryoverContext?.text, pagePrefixSupportText);
          const mergedReferenceText = mergeReferenceText(pendingCarryoverContext?.referenceText, pagePrefixParts.referenceText);
          const sourcePage = pendingCarryoverContext?.startPage || pageIndex;
          const carryoverVisualBlocks = pendingCarryoverContext?.visualBlocks || [];
          const primaryVisualBox = carryoverVisualBlocks[0]?.boundingBox;
          const carryoverPageImage = primaryVisualBox
            ? await pdfToImage(questionPdf, sourcePage)
            : undefined;
          const carryoverImageData = primaryVisualBox && carryoverPageImage
            ? await cropFigureImage(carryoverPageImage, primaryVisualBox)
            : undefined;
          const scopedQuestionNumbers = resolveScopedContextQuestionNumbers(
            pageQuestionNumbers,
            mergedSupportText,
            mergedReferenceText,
            pendingCarryoverContext?.title,
          );
          const carryoverTempId = sourcePage === pageIndex
              ? `pag-${pageIndex}-contexto-textual`
              : `pag-${sourcePage}-${pageIndex}-contexto-textual`;
          upsertContextDraft(contextMap, {
            tempId: carryoverTempId,
            title: pendingCarryoverContext?.title || `Texto de apoio - pagina ${pageIndex}`,
            text: formatStructuredSupportHtml(applyPdfHighlightsToHtml(mergedSupportText, pageRichText.highlights)),
            referenceText: applyPdfHighlightsToHtml(mergedReferenceText, pageRichText.highlights),
            questionNumbers: scopedQuestionNumbers,
            hasFigure: carryoverVisualBlocks.length > 0,
            figureDescription: carryoverVisualBlocks.length > 0
              ? 'Recurso visual pertencente ao contexto iniciado na página anterior.'
              : '',
            page: pageIndex,
            sourcePage,
            imageData: carryoverImageData,
            pageImageData: carryoverPageImage,
            figureBox: primaryVisualBox,
            figures: carryoverVisualBlocks.map((visual, visualIndex) => ({
              figureKey: `${carryoverTempId}-fig-${String(visualIndex + 1).padStart(2, '0')}`,
              type: visual.type,
              description: visual.type === 'table' ? 'Tabela ou quadro do contexto' : 'Figura do contexto',
              figureBox: visual.boundingBox,
              page: visual.pageNumber,
              order: visualIndex + 1,
            })),
          });
          addLog(`Pag ${pageIndex}: texto de apoio vinculado as questoes ${scopedQuestionNumbers.join(', ')}.`);
          pendingCarryoverContext = null;
        }
        if (pageQuestionNumbers.length > 0) {
          const expectedFromPdf = Array.from(expectedQuestionSet).sort((a, b) => a - b);
          setImportDiagnostics((previous) => ({
            ...previous,
            expectedQuestionNumbers: expectedFromPdf.length > previous.expectedQuestionNumbers.length
              ? expectedFromPdf
              : previous.expectedQuestionNumbers,
            extractedQuestionNumbers: previous.extractedQuestionNumbers,
            missingQuestionNumbers: (expectedFromPdf.length > previous.expectedQuestionNumbers.length
              ? expectedFromPdf
              : previous.expectedQuestionNumbers).filter((number) => !previous.extractedQuestionNumbers.includes(number)),
          }));
        }
        const mechanicalResult = annotatePageExtractionResult(
          enrichMechanicalExtractionFromInventory(
            createMechanicalExtractionFromText(pageText, pageIndex, qFile.name),
            pageRichText.contentBlocks || [],
            pageIndex,
          ),
          'mechanical',
          0.82,
        );
        let pageImage: string | null = null;
        const ensurePageImage = async () => {
          if (!pageImage) {
            pageImage = await pdfToImage(questionPdf, pageIndex);
          }
          return pageImage;
        };
        let result = mechanicalResult;
        if (mechanicalResult.questions.length > 0) {
          addLog(`Pag ${pageIndex}: ${mechanicalResult.questions.length} questao(oes) extraida(s) mecanicamente.`);
        }

        const extractedNumbersBeforePage = new Set<number>([
          ...allFoundQuestions.map((question, extractedIndex) => getExtractedQuestionNumber(question, extractedIndex + 1)),
          ...mechanicalResult.questions.map((question, extractedIndex) => getExtractedQuestionNumber(question as unknown as Question, extractedIndex + 1)),
        ].filter((number) => Number.isFinite(number) && number > 0));
        const allExpectedAlreadyCovered = expectedQuestionSet.size > 0
          && Array.from(expectedQuestionSet).every((number) => extractedNumbersBeforePage.has(number));
        if (allExpectedAlreadyCovered) {
          addLog(`Pag ${pageIndex}: IA visual dispensada; todas as questoes esperadas ja foram extraidas.`);
        }
        const pageAiDecision = allExpectedAlreadyCovered
          ? {
            useAi: false,
            purpose: 'none' as AiExtractionPurpose,
            targetQuestionNumbers: [],
            targetPages: [pageIndex],
            priority: 0,
            reasons: ['todas_as_questoes_esperadas_cobertas'],
          }
          : decideAiExtractionForPage(pageText, mechanicalResult, {
            pageNumber: pageIndex,
            expectedQuestionNumbers: Array.from(expectedQuestionSet),
            alreadyExtractedQuestionNumbers: Array.from(extractedNumbersBeforePage),
            includeTeacherComment: extractWithComment,
            hasPageHighlights: pageRichText.hasHighlights,
            pageData: pageRichText,
          });
        const shouldUseAiForPage = pageAiDecision.useAi;
        if (shouldUseAiForPage) {
          addLog(`Pag ${pageIndex}: IA direcionada para ${pageAiDecision.purpose} (${pageAiDecision.reasons.join(', ') || 'sem motivo informado'}).`);
        }
        const pageAiReservation = shouldUseAiForPage
          ? reserveImportAiCall(`Prova pag ${pageIndex}: ${pageAiDecision.purpose}`, {
            fingerprint: questionPdfFingerprint,
            page: pageIndex,
            targets: pageAiDecision.targetQuestionNumbers.length > 0 ? pageAiDecision.targetQuestionNumbers : pageQuestionNumbers,
            text: pageText,
            cropBox: pageAiDecision.cropBox,
            promptVersion: 'questions-page-v2',
          })
          : null;
        if (pageAiReservation) {
          pagesWithAiFallback.add(pageIndex);
          try {
            const shouldUseRegion = Boolean(pageAiDecision.cropBox && pageAiDecision.purpose !== 'scanned_page');
            const pageImageBase64 = shouldUseRegion
              ? await renderPdfRegionToImage({
                pdf: questionPdf,
                pageNumber: pageIndex,
                box: pageAiDecision.cropBox,
              })
              : await ensurePageImage();
            if (shouldUseRegion) {
              addLog(`Pag ${pageIndex}: IA recebeu recorte localizado para ${pageAiDecision.purpose}.`);
            }
            const pageParserProfile = buildAdaptiveExamParserProfile(
              [qFile.name, pageText, currentMetadata?.agency].filter(Boolean).join('\n'),
              resolveExamParserProfile(qFile.name, pageText, currentMetadata?.agency),
            );
            const lastQuestionRecord = allFoundQuestions.length > 0
              ? allFoundQuestions[allFoundQuestions.length - 1] as unknown as Record<string, unknown>
              : null;
            const aiTargetQuestionNumbers = pageAiDecision.targetQuestionNumbers.length > 0
              ? pageAiDecision.targetQuestionNumbers
              : pageQuestionNumbers;
            const aiPageContext = {
                pageNumber: pageIndex,
                totalPages: pagesCount,
                source: toPromptHint(currentMetadata?.sources, currentMetadata?.orgaos, currentMetadata?.source),
                year: toPromptHint(currentMetadata?.year, currentMetadata?.ano),
                role: toPromptHint(currentMetadata?.roles, currentMetadata?.cargos, currentMetadata?.role, currentMetadata?.cargo, currentMetadata?.examTitle, selectedExam?.nome),
                bookletType: toPromptHint(currentMetadata?.bookletType, currentMetadata?.cadernoTipo, currentMetadata?.tipoCaderno, currentMetadata?.booklet, currentMetadata?.caderno),
                bookletColor: toPromptHint(currentMetadata?.bookletColor, currentMetadata?.cadernoCor, currentMetadata?.corCaderno),
                suggestedModality: pageParserProfile.adaptiveEvidence?.probableModalities?.[0]
                  || (pageParserProfile.adaptiveEvidence?.observedOptionCounts?.[0]
                    ? `multipla escolha com ${pageParserProfile.adaptiveEvidence.observedOptionCounts[0]} alternativas observadas`
                    : ''),
                previousQuestionHint: lastQuestionRecord
                  ? stripHtml(String(lastQuestionRecord.text || lastQuestionRecord.enunciado || '')).replace(/\s+/g, ' ').trim().slice(0, 600)
                  : '',
                previousContextHint: pendingCarryoverContext?.text?.slice(0, 800) || '',
              };
            const aiResult = shouldUseRegion
              ? await aiService.extractQuestionsFromRegion({
                imageBase64: pageImageBase64,
                includeTeacherComment: extractWithComment,
                nativeText: pageText,
                richText: pageRichText.richText,
                targetQuestionNumbers: aiTargetQuestionNumbers,
                parserProfile: pageParserProfile,
                pageContext: aiPageContext,
                purpose: pageAiDecision.purpose,
                cropBox: pageAiDecision.cropBox,
              })
              : await aiService.extractQuestionsFromPage(
                pageImageBase64,
                extractWithComment,
                pageText,
                aiTargetQuestionNumbers,
                pageRichText.richText,
                pageParserProfile,
                aiPageContext,
              );
            result = mergePageExtractionResults(mechanicalResult, aiResult, shouldUseRegion ? pageAiDecision.cropBox : undefined);
            addLog(`Pag ${pageIndex}: IA usada apenas como complemento/fallback.`);
          } catch (error) {
            importAiBudget.failedCalls += 1;
            result = mechanicalResult;
            const errorMessage = readErrorMessage(error);
            if (isAiTokenLimitError(error)) {
              aiTokenLimitPages.add(pageIndex);
              addLog(`Pag ${pageIndex}: limite de tokens/contexto da IA (${errorMessage}). Mantida extracao mecanica para revisao.`);
              if (mechanicalResult.questions.length === 0 && cleanPageTextLength < 40) {
                addLog(`Pag ${pageIndex}: sem texto nativo para extracao mecanica; reduza o PDF ou use nova tentativa visual/OCR com menos paginas.`);
              }
              setImportDiagnostics((previous) => ({
                ...previous,
                aiTokenLimitReached: true,
                aiTokenLimitPages: Array.from(aiTokenLimitPages).sort((left, right) => left - right),
                pagesWithoutNativeText: Array.from(pagesWithoutNativeText).sort((left, right) => left - right),
                aiTokenLimitMessage: `A IA recusou a pagina por limite de tokens/contexto. A imagem foi compactada e o parser mecanico foi mantido, mas paginas escaneadas sem texto nativo dependem de OCR/IA visual.`,
              }));
            } else if (isAiQuotaLimitError(error)) {
              aiQuotaExceeded = true;
              aiQuotaLimitPages.add(pageIndex);
              addLog(`Pag ${pageIndex}: cota da IA excedida (${errorMessage}). Novas chamadas de IA foram pausadas; o importador continuara com PDF.js e parser mecanico.`);
              if (mechanicalResult.questions.length === 0 && cleanPageTextLength < 40) {
                addLog(`Pag ${pageIndex}: sem texto nativo suficiente para parser mecanico; esta pagina ficara pendente ate nova cota/OCR visual.`);
              }
              setImportDiagnostics((previous) => ({
                ...previous,
                aiQuotaLimitReached: true,
                aiQuotaLimitPages: Array.from(aiQuotaLimitPages).sort((left, right) => left - right),
                pagesWithoutNativeText: Array.from(pagesWithoutNativeText).sort((left, right) => left - right),
                aiQuotaLimitMessage: `A cota do provedor de IA foi excedida. O importador pausou novas chamadas de IA nesta execucao e continuou lendo o PDF com PDF.js/parser mecanico.`,
              }));
            } else {
              addLog(`Pag ${pageIndex}: IA indisponivel (${errorMessage}). Mantida extracao mecanica para revisao.`);
            }
          }
        } else if (shouldUseAiForPage && !isAiConfigured()) {
          addLog(`Pag ${pageIndex}: fallback visual recomendado, mas IA nao esta configurada; parser mecanico mantido para revisao.`);
        } else if (shouldUseAiForPage) {
          aiLimitedPages.add(pageIndex);
          if (aiQuotaExceeded) {
            aiQuotaLimitPages.add(pageIndex);
            addLog(`Pag ${pageIndex}: fallback visual recomendado, mas a cota da IA ja foi excedida; parser mecanico mantido para revisao.`);
          } else {
            addLog(`Pag ${pageIndex}: fallback visual recomendado, mas nao foi possivel reservar IA; parser mecanico mantido para revisao.`);
          }
          if (mechanicalResult.questions.length === 0 && cleanPageTextLength < 40) {
            addLog(`Pag ${pageIndex}: sem texto nativo para parser mecanico; esta pagina depende de OCR/IA visual para extrair questoes.`);
          }
          setImportDiagnostics((previous) => ({
            ...previous,
            aiLimitReached: true,
            aiQuotaLimitReached: previous.aiQuotaLimitReached || aiQuotaExceeded,
            aiCallCount: importAiBudget.usedCalls,
            aiCallLimit: importAiBudget.maxCalls,
            aiLimitedPages: Array.from(aiLimitedPages).sort((left, right) => left - right),
            aiQuotaLimitPages: Array.from(aiQuotaLimitPages).sort((left, right) => left - right),
            pagesWithoutNativeText: Array.from(pagesWithoutNativeText).sort((left, right) => left - right),
            aiLimitMessage: aiQuotaExceeded
              ? `A cota do provedor de IA foi excedida. As proximas paginas continuaram pela leitura nativa do PDF e parser mecanico.`
              : `Nao foi possivel acionar IA em algumas paginas. Paginas sem texto nativo exigem OCR/IA visual para extracao.`,
            aiQuotaLimitMessage: aiQuotaExceeded
              ? `A cota do provedor de IA foi excedida. O importador pausou novas chamadas e preservou a extracao mecanica para revisao.`
              : previous.aiQuotaLimitMessage,
          }));
        }

        currentMetadata = mergeMetadata(currentMetadata, result.metadata);
        setImportMetadata(currentMetadata);
        const extractionMetadata = currentMetadata;

        for (let contextIndex = 0; contextIndex < (result.pageContexts || []).length; contextIndex += 1) {
          const context = (result.pageContexts || [])[contextIndex];
          const tempId = String(context.contextKey || `pag-${pageIndex}-contexto-${contextIndex + 1}`);
          const declaredQuestionNumbers = Array.isArray(context.appliesToQuestionNumbers)
            ? context.appliesToQuestionNumbers.map((value) => normalizeQuestionNumber(value, 0)).filter(Boolean)
            : [];
          const questionNumbers = resolveScopedContextQuestionNumbers(
            declaredQuestionNumbers,
            context.text,
            context.referenceText,
            context.title,
          );
          const contextPageImage = context.hasFigure ? await ensurePageImage() : undefined;
          const croppedImageData = context.hasFigure
            ? await cropFigureImage(contextPageImage || '', context.figureBox)
            : undefined;
          if (context.hasFigure && !croppedImageData) {
            addLog(`Figura do contexto ${tempId} mantida apenas como descricao: recorte ausente ou invalido.`);
          }
          upsertContextDraft(contextMap, {
            tempId,
            title: context.title || `Texto de apoio - pagina ${pageIndex}`,
            text: formatStructuredSupportHtml(applyPdfHighlightsToHtml(context.text || '', pageRichText.highlights)),
            referenceText: applyPdfHighlightsToHtml(context.referenceText || '', pageRichText.highlights),
            richText: context.richText,
            questionNumbers,
            hasFigure: Boolean(context.hasFigure),
            figureDescription: context.figureDescription || '',
            page: pageIndex,
            sourcePage: context.sourcePage || pageIndex,
            imageData: croppedImageData,
            pageImageData: contextPageImage,
            figureBox: context.figureBox,
            figures: (context.figures || []).map((figure, figureIndex) => ({
              ...figure,
              figureKey: String(figure.figureKey || `${tempId}-fig-${String(figureIndex + 1).padStart(2, '0')}`),
            })),
          });
        }

        if (result.questions && result.questions.length > 0) {
          const validPageQuestions = result.questions.filter((question, questionIndex) => {
            const rawQuestion = toImportedQuestionDraft(question);
            const inferredQuestionNumber = rawQuestion.number || rawQuestion.questionNumber || pageQuestionNumbers[questionIndex];
            const hasOriginalNumber = String(inferredQuestionNumber || '').trim() !== '';
            const questionNumber = normalizeQuestionNumber(
              inferredQuestionNumber,
              allFoundQuestions.length + questionIndex + 1,
            );
            const rawText = String(rawQuestion.text || question.enunciado || '').trim();
            const parserProfile = resolveExamParserProfile(qFile.name, pageText, extractionMetadata?.agency);
            const expectedOptionsCount = inferExpectedOptionsCountFromText(rawText, pageText, qFile.name)
              || getExpectedOptionsCount(
                rawQuestion.modality || question.tipo,
                rawQuestion.expectedOptionsCount ?? rawQuestion.expected_options_count,
                parserProfile,
              );
            const { statement, options } = normalizeImportedOptions(
              rawQuestion.options,
              rawText,
              rawQuestion.modality,
              expectedOptionsCount,
            );
            const questionTextForSignals = statement || rawText;
            const cleanQuestionSignalText = stripHtml(questionTextForSignals).replace(/\s+/g, ' ').trim();
            const hasQuestionShape = hasOriginalNumber
              && questionCommandPattern.test(questionTextForSignals);
            const looksLikeNumberedQuestion = hasOriginalNumber
              && cleanQuestionSignalText.length >= 8;
            const isQuestion = (
              rawQuestion.isQuestion !== false
              || looksLikeNumberedQuestion
            )
              && (!isLikelyInstructionText(questionTextForSignals) || looksLikeNumberedQuestion)
              && (options.length >= 1 || hasQuestionShape || looksLikeNumberedQuestion);

            if (!isQuestion) {
              addLog(`Ignorado na pag ${pageIndex}: trecho sem formato de questao real${questionNumber ? ` (#${questionNumber})` : ''}.`);
            } else if (options.length < 2) {
              addLog(`Questao #${questionNumber} mantida para revisao, mas alternativas precisam ser conferidas.`);
            }

            return isQuestion;
          });

          addLog(`${validPageQuestions.length}/${result.questions.length} questoes reais encontradas na pag ${pageIndex}.`);

          const mappedQuestions: Question[] = [];
          for (let questionIndex = 0; questionIndex < validPageQuestions.length; questionIndex += 1) {
            const question = validPageQuestions[questionIndex];
            const rawQuestion = toImportedQuestionDraft(question);
            const questionNumber = normalizeQuestionNumber(
              rawQuestion.number || rawQuestion.questionNumber || pageQuestionNumbers[questionIndex],
              allFoundQuestions.length + questionIndex + 1,
            );
            const rawText = String(rawQuestion.text || question.enunciado || '').trim();
            const parserProfile = resolveExamParserProfile(qFile.name, pageText, extractionMetadata?.agency);
            const expectedOptionsCount = inferExpectedOptionsCountFromText(rawText, pageText, qFile.name)
              || getExpectedOptionsCount(
                rawQuestion.modality || question.tipo,
                rawQuestion.expectedOptionsCount ?? rawQuestion.expected_options_count,
                parserProfile,
              );
            const normalizedOptions = normalizeImportedOptions(rawQuestion.options, rawText, rawQuestion.modality, expectedOptionsCount);
            let options = normalizedOptions.options;
            const correctIndex = keyMap[questionNumber] !== undefined
              ? keyMap[questionNumber]
              : Number.isInteger(rawQuestion.correctOptionIndex)
                ? Number(rawQuestion.correctOptionIndex)
                : 0;
            const optionFigureBoxes = normalizeExtractionFigureBoxes(
              rawQuestion.optionFigureBoxes,
              rawQuestion.optionFigureBox,
            );
            const optionFigureBox = normalizeExtractionFigureBox(
              rawQuestion.optionFigureBox
              || mergeFigureBoxes(optionFigureBoxes)
              || (options.some((option) => visualOptionPlaceholderPattern.test(option)) ? rawQuestion.figureBox : undefined),
            );
            const likelyVisualChoiceQuestion = questionLikelyHasVisualAlternatives(
              rawText,
              pageText,
              rawQuestion.modality,
            );
            const expectedOptionsForVisualChoice = expectedOptionsCount;
            let hasVisualOptions = options.some((option) => visualOptionPlaceholderPattern.test(option))
              || Boolean(optionFigureBox && optionFigureBoxes.length > 0)
              || Boolean(optionFigureBox && options.length < 2 && !String(rawQuestion.modality || '').toLowerCase().includes('certo'))
              || (options.length < expectedOptionsForVisualChoice && likelyVisualChoiceQuestion);
            if (hasVisualOptions && options.length < expectedOptionsForVisualChoice) {
              options = OPTION_LABELS
                .slice(0, expectedOptionsForVisualChoice)
                .map((label) => `Alternativa visual ${label}`);
              hasVisualOptions = true;
              addLog(`Questao #${questionNumber}: alternativas visuais detectadas na imagem; placeholders ${OPTION_LABELS.slice(0, expectedOptionsForVisualChoice).join('-')} criados para recorte.`);
            }
            const supportFigureBox = normalizeExtractionFigureBox(
              rawQuestion.supportFigureBox || (!hasVisualOptions ? rawQuestion.figureBox : undefined),
            );
            const supportFigureBoxes = normalizeExtractionFigureBoxes(
              rawQuestion.supportFigureBoxes,
              supportFigureBox,
            );
            let visualOptionPageImage = '';
            let visualOptionImages: CroppedOptionImage[] = [];
            if (hasVisualOptions && options.length >= 2) {
              visualOptionPageImage = await ensurePageImage();
              if (optionFigureBox) {
                visualOptionImages = optionFigureBoxes.length === options.length
                  ? (await Promise.all(optionFigureBoxes.map(async (box) => {
                      const cropped = await cropFigureImage(visualOptionPageImage, box, { manual: true });
                      return cropped ? { imageData: cropped, figureBox: box } : null;
                    }))).filter(Boolean) as CroppedOptionImage[]
                  : await cropVisualOptionImages(visualOptionPageImage, optionFigureBox, options.length);
                if (visualOptionImages.length === options.length) {
                  addLog(`Questao #${questionNumber}: alternativas visuais recortadas individualmente.`);
                } else {
                  addLog(`Questao #${questionNumber}: alternativas visuais precisam de revisao; o recorte individual nao foi possivel.`);
                }
              } else {
                addLog(`Questao #${questionNumber}: alternativas visuais provaveis, mas sem caixa confiavel. A pagina ficou disponivel para recorte manual de A-E.`);
              }
            }
            let optionsForItems = visualOptionImages.length === options.length
              ? options.map((_, optionIndex) => (
                  createVisualOptionHtml(String.fromCharCode(65 + optionIndex), visualOptionImages[optionIndex].imageData)
                ))
              : options;
            const isAttributedToAllQuestion = correctIndex === ATTRIBUTED_TO_ALL_ANSWER_INDEX || isImportedQuestionAttributedToAll(rawQuestion);
            const isCanceledQuestion = (
              correctIndex === CANCELED_ANSWER_INDEX
              || (correctIndex < 0 && correctIndex !== ATTRIBUTED_TO_ALL_ANSWER_INDEX)
              || isImportedQuestionMarkedCanceled(rawQuestion)
            );
            const splitStatement = splitSupportContextFromStatement(normalizedOptions.statement || rawText);
            const rawExplicitSupportText = sanitizeSupportContextText(String(rawQuestion.supportText || rawQuestion.introText || '').trim());
            const rawExplicitSupportParts = splitQuestionSupportReference(rawExplicitSupportText);
            const rawExplicitSupportBody = rawExplicitSupportParts.supportText || rawExplicitSupportText;
            const explicitSupportLooksLikeTail = /^(?:dispon[ií]vel em|acesso em|fonte|adaptad[ao]|esse|essa|esses|essas|qual|quais|nesse|neste|com base|considerando|a partir|de acordo)/i
              .test(rawExplicitSupportText);
            const combinedSplitStatement = explicitSupportLooksLikeTail
              ? splitInlineSupportContextFromStatement(`${splitStatement.statement} ${rawExplicitSupportText}`)
              : { supportText: '', statement: '' };
            const inlineSplitStatement = combinedSplitStatement.supportText
              ? combinedSplitStatement
              : splitInlineSupportContextFromStatement(splitStatement.statement);
            let questionText = inlineSplitStatement.statement || splitStatement.statement || normalizedOptions.statement || rawText;
            let referenceText = mergeReferenceText(
              String(rawQuestion.referenceText || '').trim(),
              rawExplicitSupportParts.referenceText,
              'referenceText' in inlineSplitStatement ? String(inlineSplitStatement.referenceText || '').trim() : '',
              'referenceText' in combinedSplitStatement ? String(combinedSplitStatement.referenceText || '').trim() : '',
              'referenceText' in splitStatement ? String(splitStatement.referenceText || '').trim() : '',
            );
            const subjectLabel = String(rawQuestion.subject || '').trim();
            const topicLabel = String(rawQuestion.topic || '').trim();
            const specificSubjectLabel = String(rawQuestion.specificSubject || '').trim();
            const roleLabels = normalizeRoleList(
              extractionMetadata?.roles,
              extractionMetadata?.cargos,
              result.metadata?.roles,
              result.metadata?.cargos,
              extractionMetadata?.role,
              result.metadata?.role,
            );
            const agencyLabel = String(extractionMetadata?.agency || result.metadata?.agency || '').trim();
            const organizationLabels = normalizeOrganizationList(
              extractionMetadata?.sources,
              extractionMetadata?.orgaos,
              extractionMetadata?.source,
              result.metadata?.source,
            );
            const levelLabel = String(rawQuestion.level || extractionMetadata?.level || result.metadata?.level || '').trim();
            const explicitSupportText = combinedSplitStatement.supportText ? '' : rawExplicitSupportBody;
            const splitSupportText = mergeContextText(splitStatement.supportText, inlineSplitStatement.supportText);
            let supportText = explicitSupportText || splitSupportText;
            if (shouldRepairQuestionPartsWithAi({
              rawText,
              supportText,
              referenceText,
              statement: questionText,
              options,
              expectedOptionsCount,
            })) {
              const repairAiReservation = reserveImportAiCall(`Questao #${questionNumber}: reparo de OCR`, {
                fingerprint: questionPdfFingerprint,
                page: pageIndex,
                targets: questionNumber > 0 ? [questionNumber] : [],
                text: rawText,
                promptVersion: 'question-parts-repair-v1',
              });
              if (repairAiReservation) {
                try {
                  const repairedParts = await aiService.repairImportedQuestionParts({
                    rawText,
                    supportText,
                    referenceText,
                    statement: questionText,
                    options,
                    modality: rawQuestion.modality || question.tipo,
                    expectedOptionsCount,
                  });
                  const repairedSupportText = sanitizeSupportContextText(String(repairedParts.supportText || '').trim());
                  const repairedReferenceText = String(repairedParts.referenceText || '').trim();
                  const repairedStatement = String(repairedParts.statement || '').replace(/\s+/g, ' ').trim();
                  const repairedOptions = normalizeAiRepairedOptions(repairedParts.options, expectedOptionsCount);
                  const confidence = Number(repairedParts.confidence ?? 0);

                  if (confidence >= 0.55 || repairedStatement || repairedOptions.length >= 2) {
                    supportText = repairedSupportText || supportText;
                    referenceText = repairedReferenceText
                      ? mergeReferenceText(repairedReferenceText)
                      : referenceText;
                    questionText = repairedStatement || questionText;

                    if (!hasVisualOptions && repairedOptions.length >= Math.max(2, options.length)) {
                      options = repairedOptions;
                      optionsForItems = repairedOptions;
                    }

                    addLog(`Questao #${questionNumber}: texto de apoio/referencia/enunciado revisado por IA por ambiguidade no OCR.`);
                  }
                } catch (error) {
                  importAiBudget.failedCalls += 1;
                  addLog(`Questao #${questionNumber}: reparo por IA indisponivel; mantida separacao mecanica (${readErrorMessage(error)}).`);
                }
              }
            }
            const resolvedTaxonomy = normalizeTaxonomyForCurrentImport(
              subjectLabel,
              topicLabel,
              specificSubjectLabel,
              [
                rawText,
                questionText,
                supportText,
                referenceText,
                ...options,
              ],
            );
            const resolvedAssuntos = buildResolvedSubjectTaxonomies(question as Question, resolvedTaxonomy);
            const hasUnresolvedVisualOptions = optionsForItems.some((option) => visualOptionPlaceholderPattern.test(option));
            const figureDescription = [
              rawQuestion.figureDescription,
              ...(Array.isArray(rawQuestion.imageDescriptions) ? rawQuestion.imageDescriptions : []),
            ].filter(Boolean).join('\n');
            const contextFigureBox = hasUnresolvedVisualOptions ? optionFigureBox : undefined;
            const hasQuestionFigureContext = Boolean(contextFigureBox && (rawQuestion.hasFigure || hasUnresolvedVisualOptions));
            const contextFigureDescription = hasVisualOptions && !hasUnresolvedVisualOptions && !supportFigureBox
              ? ''
              : figureDescription;
            const hasOnlyHeaderSupportText = Boolean(supportText)
              && isLikelyPageBookletHeader(supportText)
              && !figureDescription
              && !hasQuestionFigureContext;
            const hasQuestionContextPayload = Boolean(
              (supportText && !hasOnlyHeaderSupportText)
              || contextFigureDescription
              || hasQuestionFigureContext,
            );
            const referencedContextKey = String(rawQuestion.contextKey || '').trim();
            const referencedContext = referencedContextKey ? contextMap.get(referencedContextKey) : undefined;
            const referencedContextQuestionNumbers = referencedContext
              ? Array.from(new Set(referencedContext.questionNumbers.filter((number) => number > 0)))
              : [];
            const referencedContextIsShared = referencedContextQuestionNumbers.length > 1;
            const hasSupportFigurePayload = supportFigureBoxes.length > 0;
            const hasVisualContextPayload = Boolean(hasQuestionFigureContext || contextFigureDescription);
            const shouldStoreSupportAsIntroText = Boolean(supportText || hasSupportFigurePayload)
              && !hasOnlyHeaderSupportText
              && (!hasVisualContextPayload || hasSupportFigurePayload)
              && !referencedContextIsShared;
            const splitContextKey = splitSupportText
              && !shouldStoreSupportAsIntroText
              ? `pag-${pageIndex}-q-${questionNumber}-contexto-textual`
              : '';
            const contextKey = shouldStoreSupportAsIntroText
              ? ''
              : splitContextKey
                || referencedContextKey
                || (hasQuestionContextPayload ? `pag-${pageIndex}-q-${questionNumber}-contexto` : '');
            let linkedContextKey = contextKey;

            if (contextKey && hasQuestionContextPayload) {
              if (splitSupportText) {
                removeContainedPartialContextsForQuestion(contextMap, questionNumber, supportText);
              }
              const questionPageImage = hasQuestionFigureContext ? await ensurePageImage() : undefined;
              const croppedImageData = hasQuestionFigureContext
                ? await cropFigureImage(questionPageImage || '', contextFigureBox)
                : undefined;
              if (hasQuestionFigureContext && !croppedImageData) {
                addLog(`Figura da questao ${questionNumber} mantida apenas como descricao: recorte ausente ou invalido.`);
              }
              linkedContextKey = upsertContextDraft(contextMap, {
                tempId: contextKey,
                title: rawQuestion.contextTitle || `Texto de apoio da questao ${questionNumber}`,
                text: formatStructuredSupportHtml(applyPdfHighlightsToHtml(supportText, pageRichText.highlights)),
                referenceText,
                questionNumbers: [questionNumber],
                hasFigure: Boolean(hasQuestionFigureContext || contextFigureDescription),
                figureDescription: contextFigureDescription,
                page: pageIndex,
                sourcePage: pageIndex,
                imageData: croppedImageData,
                pageImageData: questionPageImage,
                figureBox: contextFigureBox,
              }) || '';
            }

            let supportImages: ImportedQuestionImageDraft[] = [];
            if (shouldStoreSupportAsIntroText && supportFigureBoxes.length > 0) {
              const questionPageImage = await ensurePageImage();
              supportImages = (await Promise.all(supportFigureBoxes.map(async (box, supportImageIndex) => {
                const croppedImageData = await cropFigureImage(questionPageImage, box);
                if (!croppedImageData) {
                  return null;
                }

                return {
                  tempId: `q-${questionNumber}-support-${supportImageIndex + 1}`,
                  title: `Figura de apoio ${supportImageIndex + 1}`,
                  description: rawQuestion.imageDescriptions?.[supportImageIndex] || figureDescription || '',
                  imageData: croppedImageData,
                  pageImageData: questionPageImage,
                  figureBox: box,
                  page: pageIndex,
                } satisfies ImportedQuestionImageDraft;
              }))).filter(Boolean) as ImportedQuestionImageDraft[];

              if (supportFigureBoxes.length > 0 && supportImages.length === 0) {
                addLog(`Questao #${questionNumber}: figura(s) de apoio precisam de revisao; o recorte automatico nao foi confiavel.`);
              }
            }

            questionText = applyPdfHighlightsToHtml(questionText, pageRichText.highlights);
            supportText = formatStructuredSupportHtml(applyPdfHighlightsToHtml(supportText, pageRichText.highlights));
            referenceText = applyPdfHighlightsToHtml(referenceText, pageRichText.highlights);
            optionsForItems = optionsForItems.map((option) => (
              /<img\b|data:image\//i.test(option)
                ? option
                : applyPdfHighlightsToHtml(option, pageRichText.highlights)
            ));
            const validation = validateExtractedQuestionDraft({
              statement: questionText,
              options: optionsForItems,
              expectedOptionsCount,
              questionType: inferQuestionType(rawText, optionsForItems, parserProfile),
              rawText,
              hasFigure: rawQuestion.hasFigure || hasQuestionFigureContext || hasSupportFigurePayload || hasVisualOptions,
              figureBox: rawQuestion.figureBox || supportFigureBox || contextFigureBox || optionFigureBox,
              contextKey: linkedContextKey,
              supportText: shouldStoreSupportAsIntroText ? supportText : '',
            });
            const validationReasons = Array.from(new Set([
              ...(rawQuestion.statusReasons || []),
              ...(rawQuestion.validationReasons || []),
              ...validation.reasons,
            ]));
            const extractionStatus = validation.status !== 'ok'
              ? validation.status
              : rawQuestion.extractionStatus || rawQuestion.status || 'ok';
            const rejectionReason = rawQuestion.rejectionReason || validationReasons[0] || '';

            const mappedQuestion = normalizeCanceledImportedQuestion({
              ...question,
              hashId: extractionMetadata?.hash_id,
              questionNumber,
              question_number: questionNumber,
              sourcePage: pageIndex,
              source_page: pageIndex,
              fieldMetadata: getQuestionFieldMetadata(question),
              extractionFieldMetadata: getQuestionFieldMetadata(question),
              contextKey: linkedContextKey,
              grupoQuestaoTempId: linkedContextKey || undefined,
              figureDescription,
              introText: shouldStoreSupportAsIntroText ? supportText : String(rawQuestion.introText || '').trim(),
              intro_text: shouldStoreSupportAsIntroText ? supportText : String(rawQuestion.introText || '').trim(),
              supportImages,
              referenceText,
              reference_text: referenceText,
              enunciado: questionText,
              enunciado_clean: stripHtml(questionText),
              bancas: agencyLabel
                ? [{ sigla: agencyLabel, name: agencyLabel, id: null, slug: agencyLabel.toLowerCase() }]
                : [],
              orgaos: organizationLabels.map((organizationLabel) => createTaxonomyLabel(organizationLabel)),
              cargos: roleLabels.map((roleLabel) => ({
                id: null,
                slug: slugify(roleLabel),
                descricao: roleLabel,
              })),
              assuntos: resolvedAssuntos,
              carreiras: [selectedFocus],
              anos: extractionMetadata?.year ? [Number(extractionMetadata.year)] : [new Date().getFullYear()],
              niveis: levelLabel ? [createTaxonomyLabel(levelLabel)] : [],
              tiposProva: extractionMetadata?.examType ? [createTaxonomyLabel(extractionMetadata.examType)] : [],
              expectedOptionsCount,
              expected_options_count: expectedOptionsCount,
              tipo: optionsForItems.length === 2 ? 'certo ou errado' : 'multipla escolha',
              dificuldade: normalizeDifficulty(rawQuestion.difficulty),
              correctOptionIndex: isCanceledQuestion || isAttributedToAllQuestion ? 0 : correctIndex,
              anulada: isCanceledQuestion,
              isCanceled: isCanceledQuestion,
              isCancelled: isCanceledQuestion,
              isAttributedToAll: isAttributedToAllQuestion,
              attributedToAll: isAttributedToAllQuestion,
              is_attributed_to_all: isAttributedToAllQuestion,
              status: extractionStatus,
              extractionStatus,
              statusReasons: validationReasons,
              validationReasons,
              rejectionReason,
              needsImportReview: optionsForItems.length < expectedOptionsCount || hasUnresolvedVisualOptions || extractionStatus !== 'ok',
              hasImageItens: (visualOptionImages.length > 0 && visualOptionImages.length === options.length) || (hasUnresolvedVisualOptions && Boolean(visualOptionPageImage)),
              itens: optionsForItems.map((option, optionIndex) => {
                const optionLabel = String.fromCharCode(65 + optionIndex);
                const cleanOption = stripHtml(option).trim();
                const visualOptionImage = visualOptionImages[optionIndex];
                return {
                  id: optionIndex + 1,
                  ordem: optionIndex + 1,
                  rotulo: optionLabel,
                  corpo: option,
                  corpo_clean: cleanOption || `Alternativa visual ${optionLabel}`,
                  imageData: visualOptionImage?.imageData,
                  pageImageData: visualOptionImage || hasUnresolvedVisualOptions ? visualOptionPageImage : undefined,
                  figureBox: visualOptionImage?.figureBox || (hasUnresolvedVisualOptions ? optionFigureBox : undefined),
                };
              }),
              resposta: isCanceledQuestion || isAttributedToAllQuestion ? 1 : correctIndex + 1,
              questionOrigin: 'exam',
              question_origin: 'exam',
              stats: { totalAttempts: 0, correctCount: 0, wrongCount: 0 },
              comments: [],
            } as unknown as Question, isCanceledQuestion, isAttributedToAllQuestion);
            if (isCanceledQuestion) {
              addLog(`Questao #${questionNumber}: gabarito oficial indica anulada; extraida normalmente e marcada como anulada.`);
            }
            if (isAttributedToAllQuestion) {
              addLog(`Questao #${questionNumber}: gabarito oficial indica atribuida a todos; extraida normalmente e marcada para pontuacao a todos.`);
            }
            rememberImportedQuestionBackup(importedQuestionBackups, mappedQuestion, questionNumber);
            mappedQuestions.push(mappedQuestion);

            const liveImportState = normalizeQuestionContextUsage(
              [...allFoundQuestions, ...mappedQuestions],
              contextMap,
            );
            const liveCoverage = auditQuestionCoverage(
              liveImportState.questions,
              Array.from(expectedQuestionSet).sort((left, right) => left - right),
            );
            const liveEnsuredDrafts = ensureExpectedQuestionDrafts({
              questions: liveCoverage.questions as unknown as ImportedQuestionDraft[],
              expectedQuestionNumbers: liveCoverage.expectedQuestionNumbers,
              diagnostics: {
                ...liveCoverage,
                aiLimitReached: aiLimitedPages.size > 0 || aiLimitedPurposes.size > 0,
                aiTokenLimitReached: aiTokenLimitPages.size > 0,
                aiQuotaLimitReached: aiQuotaLimitPages.size > 0,
                aiCallCount: importAiBudget.usedCalls,
                aiCallLimit: importAiBudget.maxCalls,
                aiCallsSkipped: importAiBudget.skippedCalls,
                aiCallsSavedEstimate: importAiBudget.cacheHits + importAiBudget.skippedCalls,
                aiLimitedPages: Array.from(aiLimitedPages),
                aiTokenLimitPages: Array.from(aiTokenLimitPages),
                aiQuotaLimitPages: Array.from(aiQuotaLimitPages),
                pagesWithoutNativeText: Array.from(pagesWithoutNativeText),
              },
              defaultMetadata: currentMetadata || initialMetadata,
              pageQuestionRanges: Array.from(pageQuestionRanges.values()),
              totalPages: pagesCount,
              answerKeyMap: keyMap,
              defaultFocus: selectedFocus,
            });
            setExtractedQuestions(liveEnsuredDrafts.questions as unknown as Question[]);
            setExtractedContexts(liveImportState.contexts);
            setImportDiagnostics((previous) => ({
              ...previous,
              expectedQuestionNumbers: liveEnsuredDrafts.diagnostics.expectedQuestionNumbers.length > 0
                ? liveEnsuredDrafts.diagnostics.expectedQuestionNumbers
                : previous.expectedQuestionNumbers,
              extractedQuestionNumbers: liveEnsuredDrafts.diagnostics.extractedQuestionNumbers,
              localizedQuestionNumbers: liveEnsuredDrafts.diagnostics.localizedQuestionNumbers,
              completeQuestionNumbers: liveEnsuredDrafts.diagnostics.completeQuestionNumbers,
              incompleteQuestionNumbers: liveEnsuredDrafts.diagnostics.incompleteQuestionNumbers,
              missingQuestionNumbers: liveEnsuredDrafts.diagnostics.missingQuestionNumbers,
              placeholderQuestionNumbers: liveEnsuredDrafts.diagnostics.placeholderQuestionNumbers,
              visualPendingQuestionNumbers: liveEnsuredDrafts.diagnostics.visualPendingQuestionNumbers,
              duplicateQuestionNumbers: liveEnsuredDrafts.diagnostics.duplicateQuestionNumbers,
              suspiciousQuestionNumbers: liveEnsuredDrafts.diagnostics.suspiciousQuestionNumbers,
              cardsCreatedCount: liveEnsuredDrafts.diagnostics.cardsCreatedCount,
              completeCardsCount: liveEnsuredDrafts.diagnostics.completeCardsCount,
              incompleteCardsCount: liveEnsuredDrafts.diagnostics.incompleteCardsCount,
              placeholderCardsCount: liveEnsuredDrafts.diagnostics.placeholderCardsCount,
              aiLimitReached: previous.aiLimitReached || aiLimitedPages.size > 0 || aiLimitedPurposes.size > 0,
              aiTokenLimitReached: previous.aiTokenLimitReached || aiTokenLimitPages.size > 0,
              aiQuotaLimitReached: previous.aiQuotaLimitReached || aiQuotaLimitPages.size > 0,
              aiCallCount: importAiBudget.usedCalls,
              aiCallLimit: importAiBudget.maxCalls,
              aiCallsSkipped: importAiBudget.skippedCalls,
              aiCallsSavedEstimate: importAiBudget.cacheHits + importAiBudget.skippedCalls,
            }));
            await yieldToImportReviewPaint();
          }

          const classifiedMappedQuestions = await classifyMissingQuestionSubjects(mappedQuestions, pageIndex, { allowAi: false });
          allFoundQuestions = [...allFoundQuestions, ...classifiedMappedQuestions];
          const normalizedImportState = normalizeQuestionContextUsage(allFoundQuestions, contextMap);
          allFoundQuestions = normalizedImportState.questions;
          const pageCoverage = auditQuestionCoverage(
            allFoundQuestions,
            Array.from(expectedQuestionSet).sort((left, right) => left - right),
          );
          allFoundQuestions = pageCoverage.questions;
          const pageEnsuredDrafts = ensureExpectedQuestionDrafts({
            questions: pageCoverage.questions as unknown as ImportedQuestionDraft[],
            expectedQuestionNumbers: pageCoverage.expectedQuestionNumbers,
            diagnostics: {
              ...pageCoverage,
              aiLimitReached: aiLimitedPages.size > 0 || aiLimitedPurposes.size > 0,
              aiTokenLimitReached: aiTokenLimitPages.size > 0,
              aiQuotaLimitReached: aiQuotaLimitPages.size > 0,
              aiCallCount: importAiBudget.usedCalls,
              aiCallLimit: importAiBudget.maxCalls,
              aiCallsSkipped: importAiBudget.skippedCalls,
              aiCallsSavedEstimate: importAiBudget.cacheHits + importAiBudget.skippedCalls,
              aiLimitedPages: Array.from(aiLimitedPages),
              aiTokenLimitPages: Array.from(aiTokenLimitPages),
              aiQuotaLimitPages: Array.from(aiQuotaLimitPages),
              pagesWithoutNativeText: Array.from(pagesWithoutNativeText),
            },
            defaultMetadata: currentMetadata || initialMetadata,
            pageQuestionRanges: Array.from(pageQuestionRanges.values()),
            totalPages: pagesCount,
            answerKeyMap: keyMap,
            defaultFocus: selectedFocus,
          });
          setExtractedQuestions(pageEnsuredDrafts.questions as unknown as Question[]);
          setExtractedContexts(normalizedImportState.contexts);
          setImportMetadata((previous) => ({
            ...(previous || {}),
            subjects: deriveQuestionSubjects(allFoundQuestions),
          } as ImportMetadata));
          setImportDiagnostics((previous) => ({
            ...previous,
            expectedQuestionNumbers: pageEnsuredDrafts.diagnostics.expectedQuestionNumbers.length > 0
              ? pageEnsuredDrafts.diagnostics.expectedQuestionNumbers
              : previous.expectedQuestionNumbers,
            extractedQuestionNumbers: pageEnsuredDrafts.diagnostics.extractedQuestionNumbers,
            localizedQuestionNumbers: pageEnsuredDrafts.diagnostics.localizedQuestionNumbers,
            completeQuestionNumbers: pageEnsuredDrafts.diagnostics.completeQuestionNumbers,
            incompleteQuestionNumbers: pageEnsuredDrafts.diagnostics.incompleteQuestionNumbers,
            missingQuestionNumbers: pageEnsuredDrafts.diagnostics.missingQuestionNumbers,
            placeholderQuestionNumbers: pageEnsuredDrafts.diagnostics.placeholderQuestionNumbers,
            visualPendingQuestionNumbers: pageEnsuredDrafts.diagnostics.visualPendingQuestionNumbers,
            duplicateQuestionNumbers: pageEnsuredDrafts.diagnostics.duplicateQuestionNumbers,
            suspiciousQuestionNumbers: pageEnsuredDrafts.diagnostics.suspiciousQuestionNumbers,
            cardsCreatedCount: pageEnsuredDrafts.diagnostics.cardsCreatedCount,
            completeCardsCount: pageEnsuredDrafts.diagnostics.completeCardsCount,
            incompleteCardsCount: pageEnsuredDrafts.diagnostics.incompleteCardsCount,
            placeholderCardsCount: pageEnsuredDrafts.diagnostics.placeholderCardsCount,
            aiLimitReached: previous.aiLimitReached || aiLimitedPages.size > 0 || aiLimitedPurposes.size > 0,
            aiTokenLimitReached: previous.aiTokenLimitReached || aiTokenLimitPages.size > 0,
            aiQuotaLimitReached: previous.aiQuotaLimitReached || aiQuotaLimitPages.size > 0,
            aiCallCount: importAiBudget.usedCalls,
            aiCallLimit: importAiBudget.maxCalls,
            aiCallsSkipped: importAiBudget.skippedCalls,
            aiCallsSavedEstimate: importAiBudget.cacheHits + importAiBudget.skippedCalls,
          }));
        }
        if (!result.questions || result.questions.length === 0) {
          pagesWithoutQuestionDrafts.add(pageIndex);
          addLog(`Pag ${pageIndex}: nenhuma questao extraida; pagina registrada como lida para auditoria.`);
        }
        } catch (error) {
          failedPageReads.set(pageIndex, readErrorMessage(error));
          addLog(`Pag ${pageIndex}: falha ao processar pagina (${readErrorMessage(error)}). Continuando leitura das demais paginas.`);
        } finally {
          processedPageNumbers.add(pageIndex);
          setExamProgress(Math.round((pageIndex / pagesCount) * 100));
        }
      }

      addLog(`Auditoria do PDF: ${processedPageNumbers.size}/${pagesCount} pagina(s) percorrida(s).`);
      if (pagesWithoutNativeText.size > 0) {
        addLog(`Auditoria do PDF: pagina(s) sem texto nativo suficiente: ${Array.from(pagesWithoutNativeText).join(', ')}.`);
      }
      if (pagesWithAiFallback.size > 0) {
        addLog(`Auditoria do PDF: fallback por imagem/IA acionado na(s) pagina(s): ${Array.from(pagesWithAiFallback).join(', ')}.`);
      }
      if (aiLimitedPages.size > 0) {
        addLog(`Auditoria do PDF: fallback visual nao executado na(s) pagina(s): ${Array.from(aiLimitedPages).join(', ')}.`);
      }
      if (aiTokenLimitPages.size > 0) {
        addLog(`Auditoria do PDF: limite de tokens/contexto da IA atingido na(s) pagina(s): ${Array.from(aiTokenLimitPages).join(', ')}.`);
      }
      if (aiQuotaLimitPages.size > 0) {
        addLog(`Auditoria do PDF: cota da IA excedida na(s) pagina(s): ${Array.from(aiQuotaLimitPages).join(', ')}. A leitura continuou via PDF.js/parser mecanico.`);
      }
      addLog(`Auditoria de IA: ${importAiBudget.usedCalls}/${importAiBudget.maxCalls} chamada(s), ${importAiBudget.cacheHits} repetida(s) evitada(s), ${importAiBudget.failedCalls} falha(s), ${importAiBudget.skippedCalls} pulada(s).`);
      if (pagesWithoutQuestionDrafts.size > 0) {
        addLog(`Auditoria do PDF: pagina(s) lida(s) sem rascunho de questao: ${Array.from(pagesWithoutQuestionDrafts).join(', ')}.`);
      }
      if (failedPageReads.size > 0) {
        addLog(`Auditoria do PDF: pagina(s) com falha de processamento: ${Array.from(failedPageReads.entries()).map(([page, message]) => `${page} (${message})`).join(', ')}.`);
      }

      let normalizedImportState = normalizeQuestionContextUsage(allFoundQuestions, contextMap);
      allFoundQuestions = normalizedImportState.questions;
      allFoundQuestions = await reviewQuestionPartsAfterExtraction(allFoundQuestions, { allowAi: false });
      allFoundQuestions = await classifyMissingQuestionSubjects(allFoundQuestions, 'Revisao final', { allowAi: false });
      const finalExpectedQuestionNumbers = Array.from(expectedQuestionSet).sort((a, b) => a - b);
      const restoredMissing = restoreMissingQuestionsFromBackups(
        allFoundQuestions,
        finalExpectedQuestionNumbers,
        importedQuestionBackups,
      );
      if (restoredMissing.recoveredNumbers.length > 0) {
        allFoundQuestions = restoredMissing.questions;
        addLog(`Recuperacao mecanica final: questao(oes) ${restoredMissing.recoveredNumbers.join(', ')} reinserida(s) antes da revisao.`);
      }
      normalizedImportState = normalizeQuestionContextUsage(allFoundQuestions, contextMap);
      allFoundQuestions = normalizedImportState.questions;
      const diagnosticExpectedQuestionNumbers = finalExpectedQuestionNumbers.length > 0
        ? finalExpectedQuestionNumbers
        : importDiagnostics.expectedQuestionNumbers;
      const prePlaceholderCoverage = auditQuestionCoverage(allFoundQuestions, diagnosticExpectedQuestionNumbers);
      const ensuredDrafts = ensureExpectedQuestionDrafts({
        questions: prePlaceholderCoverage.questions as unknown as ImportedQuestionDraft[],
        expectedQuestionNumbers: diagnosticExpectedQuestionNumbers,
        diagnostics: {
          ...prePlaceholderCoverage,
          aiLimitReached: aiLimitedPages.size > 0 || aiLimitedPurposes.size > 0,
          aiTokenLimitReached: aiTokenLimitPages.size > 0,
          aiQuotaLimitReached: aiQuotaLimitPages.size > 0,
          aiCallCount: importAiBudget.usedCalls,
          aiCallLimit: importAiBudget.maxCalls,
          aiCallsSkipped: importAiBudget.skippedCalls,
          aiCallsSavedEstimate: importAiBudget.cacheHits + importAiBudget.skippedCalls,
          aiLimitedPages: Array.from(aiLimitedPages),
          aiTokenLimitPages: Array.from(aiTokenLimitPages),
          aiQuotaLimitPages: Array.from(aiQuotaLimitPages),
          pagesWithoutNativeText: Array.from(pagesWithoutNativeText),
        },
        defaultMetadata: currentMetadata || initialMetadata,
        pageQuestionRanges: Array.from(pageQuestionRanges.values()),
        totalPages: pagesCount,
        answerKeyMap: keyMap,
        defaultFocus: selectedFocus || undefined,
      });
      const finalCoverage = ensuredDrafts.diagnostics;
      allFoundQuestions = ensuredDrafts.questions as unknown as Question[];
      if (ensuredDrafts.createdPlaceholders.length > 0) {
        addLog(
          `${ensuredDrafts.createdPlaceholders.length} card(s) pendente(s) criado(s) para questões não localizadas: `
          + ensuredDrafts.createdPlaceholders
            .map((question) => normalizeQuestionNumber(question.questionNumber ?? question.number, 0))
            .filter(Boolean)
            .join(', '),
        );
      }
      setExtractedQuestions([...allFoundQuestions]);
      setExtractedContexts(normalizedImportState.contexts);
      setImportMetadata((previous) => ({
        ...(previous || {}),
        subjects: deriveQuestionSubjects(allFoundQuestions),
      } as ImportMetadata));
      setImportDiagnostics((previous) => ({
        ...previous,
        expectedQuestionNumbers: finalCoverage.expectedQuestionNumbers,
        extractedQuestionNumbers: finalCoverage.extractedQuestionNumbers,
        localizedQuestionNumbers: finalCoverage.localizedQuestionNumbers,
        completeQuestionNumbers: finalCoverage.completeQuestionNumbers,
        incompleteQuestionNumbers: finalCoverage.incompleteQuestionNumbers,
        missingQuestionNumbers: finalCoverage.missingQuestionNumbers,
        placeholderQuestionNumbers: finalCoverage.placeholderQuestionNumbers,
        visualPendingQuestionNumbers: finalCoverage.visualPendingQuestionNumbers,
        duplicateQuestionNumbers: finalCoverage.duplicateQuestionNumbers,
        suspiciousQuestionNumbers: finalCoverage.suspiciousQuestionNumbers,
        cardsCreatedCount: finalCoverage.cardsCreatedCount,
        completeCardsCount: finalCoverage.completeCardsCount,
        incompleteCardsCount: finalCoverage.incompleteCardsCount,
        placeholderCardsCount: finalCoverage.placeholderCardsCount,
        aiLimitReached: previous.aiLimitReached || aiLimitedPages.size > 0 || aiLimitedPurposes.size > 0,
        aiTokenLimitReached: previous.aiTokenLimitReached || aiTokenLimitPages.size > 0,
        aiQuotaLimitReached: previous.aiQuotaLimitReached || aiQuotaLimitPages.size > 0,
        aiCallCount: importAiBudget.usedCalls,
        aiCallLimit: importAiBudget.maxCalls,
        aiCallsSkipped: importAiBudget.skippedCalls,
        aiCallsSavedEstimate: importAiBudget.cacheHits + importAiBudget.skippedCalls,
        aiLimitedPages: Array.from(aiLimitedPages).sort((left, right) => left - right),
        aiTokenLimitPages: Array.from(aiTokenLimitPages).sort((left, right) => left - right),
        aiQuotaLimitPages: Array.from(aiQuotaLimitPages).sort((left, right) => left - right),
        pagesWithoutNativeText: Array.from(pagesWithoutNativeText).sort((left, right) => left - right),
        aiLimitMessage: aiLimitedPages.size > 0
          ? `${aiLimitedPages.size} pagina(s) precisavam de leitura visual, mas a IA nao foi acionada.`
          : previous.aiLimitMessage,
        aiTokenLimitMessage: aiTokenLimitPages.size > 0
          ? `Limite de tokens/contexto atingido em ${aiTokenLimitPages.size} pagina(s). A imagem enviada foi compactada e o texto OCR foi reduzido; paginas sem texto nativo continuam exigindo OCR/IA visual.`
          : previous.aiTokenLimitMessage,
        aiQuotaLimitMessage: aiQuotaLimitPages.size > 0
          ? `Cota do provedor de IA excedida. O importador pausou novas chamadas de IA e continuou com PDF.js/parser mecanico.`
          : previous.aiQuotaLimitMessage,
      }));
      const missingCount = finalCoverage.missingQuestionNumbers.length;
      if (missingCount > 0) {
        addLog(`Revisão: ${missingCount} questão(ões) ainda sem conteúdo suficiente; todas possuem card editável.`);
      }
      if (finalCoverage.incompleteQuestionNumbers.length > 0) {
        addLog(`Revisao: ${finalCoverage.incompleteQuestionNumbers.length} card(s) incompleto(s): ${finalCoverage.incompleteQuestionNumbers.join(', ')}.`);
      }
      if (extractWithDetailedAnalysis && finalCoverage.completeQuestionNumbers.length > 0) {
        setIsBulkGenerating(true);
        setBulkProgress(0);
        const completeNumberSet = new Set(finalCoverage.completeQuestionNumbers);
        const completeQuestions = allFoundQuestions.filter((question) => (
          completeNumberSet.has(getReliableExtractedQuestionNumber(question))
        ));
        const generatedCompleteQuestions = await generateDetailedAnalysesForQuestions(completeQuestions, {
          updateLiveState: false,
          logLabel: 'Gerando analise detalhada em lote apos a extracao...',
        });
        const generatedByNumber = new Map(
          generatedCompleteQuestions.map((question) => [getReliableExtractedQuestionNumber(question), question]),
        );
        allFoundQuestions = allFoundQuestions.map((question) => (
          generatedByNumber.get(getReliableExtractedQuestionNumber(question)) || question
        ));
        setExtractedQuestions([...allFoundQuestions]);
        setIsBulkGenerating(false);
      }
      addLog(
        `IMPORTACAO CONCLUIDA! ${finalCoverage.cardsCreatedCount} card(s): `
        + `${finalCoverage.completeCardsCount} completo(s), `
        + `${finalCoverage.incompleteCardsCount} incompleto(s) e `
        + `${finalCoverage.placeholderCardsCount} pendente(s) sem localizacao.`,
      );
    } catch (error) {
      addLog(`ERRO CRITICO: ${readErrorMessage(error)}`);
      setIsBulkGenerating(false);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleRetryMissingQuestions = async () => {
    const missingNumbers = [
      ...(importDiagnostics.missingQuestionNumbers || []),
      ...(importDiagnostics.incompleteQuestionNumbers || []),
    ]
      .filter((number, index, list) => Number.isFinite(number) && number > 0 && list.indexOf(number) === index)
      .sort((a, b) => a - b);

    if (missingNumbers.length === 0) {
      addToast('Nao ha questoes faltantes para tentar novamente.', 'info');
      return;
    }

    if (!qFile) {
      addToast('Selecione novamente o PDF da prova antes de tentar recuperar as faltantes.', 'error');
      return;
    }

    const selectedFocus = resolveSelectedFocus();
    if (!selectedFocus) {
      addToast('Selecione ou crie um foco antes de tentar recuperar as faltantes.', 'error');
      return;
    }

    if (isProcessing || isBulkGenerating || isRetryingMissingQuestions) {
      addToast('Aguarde o processamento atual terminar antes de tentar novamente.', 'info');
      return;
    }

    setIsRetryingMissingQuestions(true);
    setBulkProgress(0);

    try {
      const pdfjs = await loadPdfJsModule();
      const questionBuffer = await qFile.arrayBuffer();
      const questionPdfFingerprint = computeArrayBufferFingerprint(questionBuffer, qFile);
      const questionPdf = await pdfjs.getDocument(questionBuffer).promise;
      const pagesCount = questionPdf.numPages;
      const keyMap = await readCurrentAnswerKeyMap(pdfjs);
      const pageRichTextByPage = new Map<number, PdfPageRichText>();
      const pageNumbersByPage = new Map<number, number[]>();

      addLog(`Tentativa focada: buscando ${missingNumbers.length} questao(oes) faltante(s) no PDF da prova.`);

      for (let pageIndex = 1; pageIndex <= pagesCount; pageIndex += 1) {
        const pageRichText = await pdfPageToRichText(questionPdf, pageIndex);
        pageRichTextByPage.set(pageIndex, pageRichText);
        pageNumbersByPage.set(pageIndex, extractQuestionNumbersFromText(pageRichText.plainText));
      }

      const retryPlan = inferRetryPagesForMissingQuestions(
        missingNumbers,
        pagesCount,
        extractedQuestions,
        pageNumbersByPage,
      );

      if (retryPlan.length === 0) {
        addToast('Nao encontrei paginas candidatas para as questoes faltantes.', 'warning');
        addLog('Tentativa focada encerrada: nenhuma pagina candidata foi encontrada.');
        return;
      }

      addLog(`Tentativa focada: ${retryPlan.length} pagina(s) candidata(s) serao reprocessadas.`);
      const remainingNumbers = new Set(missingNumbers);
      const recoveredQuestions: Question[] = [];
      let retryMetadata = importMetadata;
      const retryContextMap = new Map<string, ImportedContextDraft>();
      extractedContexts.forEach((context) => {
        retryContextMap.set(context.tempId, { ...context });
      });
      let retryAiQuotaExceeded = false;
      const retryAiCache = new Set<string>();
      const retryAiCallLimit = Math.min(8, Math.max(2, Math.ceil(retryPlan.length * 0.35)));
      let retryAiCallCount = 0;
      const reserveRetryAiCall = (purpose: string, details: {
        page: number;
        targets: number[];
        text?: string;
        cropBox?: FigureBox;
        promptVersion?: string;
      }) => {
        const cacheKey = [
          'exam-import-retry',
          EXAM_IMPORT_PARSER_VERSION,
          questionPdfFingerprint,
          details.promptVersion || 'missing-question-retry-v2',
          purpose,
          `p${details.page}`,
          details.targets.slice().sort((left, right) => left - right).join('-'),
          details.cropBox ? `box${buildFigureBoxCacheSignature(details.cropBox)}` : '',
          details.text ? hashTextForImportCache(normalizeComparisonText(details.text).slice(0, 1600)) : '',
        ].filter(Boolean).join('|');
        if (retryAiCache.has(cacheKey)) {
          addLog(`IA cache hit: ${purpose}. Tentativa focada repetida ignorada.`);
          return null;
        }
        if (retryAiQuotaExceeded || retryAiCallCount >= retryAiCallLimit) {
          setImportDiagnostics((previous) => ({
            ...previous,
            aiLimitReached: true,
            aiLimitMessage: retryAiQuotaExceeded
              ? previous.aiLimitMessage
              : `Limite adaptativo da tentativa focada atingido (${retryAiCallCount}/${retryAiCallLimit}). O restante ficou para revisao manual ou nova tentativa.`,
          }));
          return null;
        }
        retryAiCache.add(cacheKey);
        retryAiCallCount += 1;
        addLog(`IA tentativa focada ${retryAiCallCount}/${retryAiCallLimit}: ${purpose}.`);
        return cacheKey;
      };

      const runAiMissingQuestionRecovery = async (
        pageIndex: number,
        targets: number[],
        sourceLabel: string,
      ): Promise<number> => {
        const aiTargets = targets
          .filter((questionNumber, index, list) => (
            remainingNumbers.has(questionNumber)
            && Number.isFinite(questionNumber)
            && questionNumber > 0
            && list.indexOf(questionNumber) === index
          ))
          .sort((left, right) => left - right);

        if (aiTargets.length === 0) {
          return 0;
        }

        if (!isAiConfigured()) {
          addLog(`Pag ${pageIndex}: ${aiTargets.join(', ')} ainda faltante(s), mas IA nao esta configurada para complementar.`);
          return 0;
        }

        if (retryAiQuotaExceeded) {
          addLog(`Pag ${pageIndex}: ${aiTargets.join(', ')} ainda faltante(s), mas a cota da IA ja foi excedida; mantendo recuperacao mecanica para revisao.`);
          return 0;
        }

        const pageRichText = pageRichTextByPage.get(pageIndex) || await pdfPageToRichText(questionPdf, pageIndex);
        const pageText = pageRichText.plainText;
        const retryCropBox = estimatePdfQuestionRegionBox(pageRichText, aiTargets);
        const retryReservation = reserveRetryAiCall(`${sourceLabel} pag ${pageIndex}`, {
          page: pageIndex,
          targets: aiTargets,
          text: pageText,
          cropBox: retryCropBox,
        });
        if (!retryReservation) {
          addLog(`Pag ${pageIndex}: IA focada nao reservada para ${aiTargets.join(', ')}; mantendo parser mecanico/revisao.`);
          return 0;
        }
        const pageImageBase64 = retryCropBox
          ? await renderPdfRegionToImage({
            pdf: questionPdf,
            pageNumber: pageIndex,
            box: retryCropBox,
          })
          : await pdfToImage(questionPdf, pageIndex);
        if (retryCropBox) {
          addLog(`Pag ${pageIndex}: tentativa de faltantes usando recorte localizado para ${aiTargets.join(', ')}.`);
        }

        try {
          const pageParserProfile = resolveExamParserProfile(qFile.name, pageText, retryMetadata?.agency);
          const lastQuestionRecord = extractedQuestions.length > 0
            ? extractedQuestions[extractedQuestions.length - 1] as unknown as Record<string, unknown>
            : null;
          const aiResult = await aiService.extractQuestionsFromPage(
            pageImageBase64,
            extractWithComment,
            pageText,
            aiTargets,
            pageRichText.richText,
            pageParserProfile,
            {
              pageNumber: pageIndex,
              totalPages: questionPdf.numPages,
              source: toPromptHint(retryMetadata?.sources, retryMetadata?.orgaos, retryMetadata?.source),
              year: toPromptHint(retryMetadata?.year, retryMetadata?.ano),
              role: toPromptHint(retryMetadata?.roles, retryMetadata?.cargos, retryMetadata?.role, retryMetadata?.cargo, retryMetadata?.examTitle, selectedExam?.nome),
              bookletType: toPromptHint(retryMetadata?.bookletType, retryMetadata?.cadernoTipo, retryMetadata?.tipoCaderno, retryMetadata?.booklet, retryMetadata?.caderno),
              bookletColor: toPromptHint(retryMetadata?.bookletColor, retryMetadata?.cadernoCor, retryMetadata?.corCaderno),
              suggestedModality: pageParserProfile.adaptiveEvidence?.probableModalities?.[0]
                || (pageParserProfile.adaptiveEvidence?.observedOptionCounts?.[0]
                  ? `multipla escolha com ${pageParserProfile.adaptiveEvidence.observedOptionCounts[0]} alternativas observadas`
                  : ''),
              previousQuestionHint: lastQuestionRecord
                ? stripHtml(String(lastQuestionRecord.text || lastQuestionRecord.enunciado || '')).replace(/\s+/g, ' ').trim().slice(0, 600)
                : '',
              previousContextHint: '',
            },
          );
          retryMetadata = mergeMetadata(retryMetadata, aiResult.metadata);
          const mapped = mapTextExtractionQuestions({
            result: aiResult,
            pageIndex,
            pageRichText,
            pageText,
            targetNumbers: aiTargets,
            keyMap,
            selectedFocus,
            contextMap: retryContextMap,
            metadata: retryMetadata,
            fileName: qFile.name,
            logPrefix: `Pag ${pageIndex}`,
          });
          retryMetadata = mapped.metadata;
          const usefulQuestions = mapped.questions.filter((question) => {
            const questionNumber = getExtractedQuestionNumber(question, 0);
            return remainingNumbers.has(questionNumber);
          });

          usefulQuestions.forEach((question) => {
            const questionNumber = getExtractedQuestionNumber(question, 0);
            remainingNumbers.delete(questionNumber);
            recoveredQuestions.push(question);
          });

          if (usefulQuestions.length === 0) {
            addLog(`Pag ${pageIndex}: ${sourceLabel} nao recuperou nenhuma das faltantes (${aiTargets.join(', ')}).`);
            return 0;
          }

          addLog(`Pag ${pageIndex}: ${sourceLabel} recuperou ${usefulQuestions.length} faltante(s) (${usefulQuestions.map((question) => getExtractedQuestionNumber(question, 0)).join(', ')}).`);
          return usefulQuestions.length;
        } catch (error) {
          const errorMessage = readErrorMessage(error);
          if (isAiTokenLimitError(error)) {
            setImportDiagnostics((previous) => {
              const tokenPages = new Set(previous.aiTokenLimitPages || []);
              tokenPages.add(pageIndex);
              return {
                ...previous,
                aiTokenLimitReached: true,
                aiTokenLimitPages: Array.from(tokenPages).sort((left, right) => left - right),
                aiTokenLimitMessage: `A tentativa focada estourou limite de tokens/contexto. O importador manteve a extracao mecanica e sinalizou as questoes para revisao.`,
              };
            });
            addLog(`Pag ${pageIndex}: ${sourceLabel} falhou por limite de tokens/contexto (${errorMessage}).`);
          } else if (isAiQuotaLimitError(error)) {
            retryAiQuotaExceeded = true;
            setImportDiagnostics((previous) => {
              const quotaPages = new Set(previous.aiQuotaLimitPages || []);
              quotaPages.add(pageIndex);
              return {
                ...previous,
                aiQuotaLimitReached: true,
                aiQuotaLimitPages: Array.from(quotaPages).sort((left, right) => left - right),
                aiQuotaLimitMessage: `A tentativa focada excedeu a cota do provedor de IA. O importador pausou novas chamadas e manteve a recuperacao mecanica para revisao.`,
              };
            });
            addLog(`Pag ${pageIndex}: ${sourceLabel} falhou por cota da IA (${errorMessage}). Novas chamadas de IA foram pausadas nesta tentativa.`);
          } else {
            addLog(`Pag ${pageIndex}: ${sourceLabel} falhou (${errorMessage}).`);
          }
          return 0;
        }
      };

      for (let planIndex = 0; planIndex < retryPlan.length; planIndex += 1) {
        const { pageIndex, targets } = retryPlan[planIndex];
        const activeTargets = targets.filter((questionNumber) => remainingNumbers.has(questionNumber));
        if (activeTargets.length === 0) {
          setBulkProgress(Math.round(((planIndex + 1) / retryPlan.length) * 100));
          continue;
        }

        const pageRichText = pageRichTextByPage.get(pageIndex) || await pdfPageToRichText(questionPdf, pageIndex);
        const pageText = pageRichText.plainText;
        const mechanicalResult = annotatePageExtractionResult(
          enrichMechanicalExtractionFromInventory(
            createMechanicalExtractionFromText(pageText, pageIndex, qFile.name),
            pageRichText.contentBlocks || [],
            pageIndex,
          ),
          'mechanical',
          0.82,
        );
        const mechanicalMapped = mapTextExtractionQuestions({
          result: mechanicalResult,
          pageIndex,
          pageRichText,
          pageText,
          targetNumbers: activeTargets,
          keyMap,
          selectedFocus,
          contextMap: retryContextMap,
          metadata: retryMetadata,
          fileName: qFile.name,
          logPrefix: `Pag ${pageIndex}`,
        });
        retryMetadata = mechanicalMapped.metadata;
        const mechanicalUsefulQuestions = mechanicalMapped.questions.filter((question) => {
          const questionNumber = getExtractedQuestionNumber(question, 0);
          return remainingNumbers.has(questionNumber);
        });

        mechanicalUsefulQuestions.forEach((question) => {
          const questionNumber = getExtractedQuestionNumber(question, 0);
          remainingNumbers.delete(questionNumber);
          recoveredQuestions.push(question);
        });

        if (mechanicalUsefulQuestions.length > 0) {
          addLog(`Pag ${pageIndex}: parser local recuperou ${mechanicalUsefulQuestions.length} faltante(s) (${mechanicalUsefulQuestions.map((question) => getExtractedQuestionNumber(question, 0)).join(', ')}).`);
        }

        const aiTargets = activeTargets.filter((questionNumber) => remainingNumbers.has(questionNumber));
        if (aiTargets.length > 0) {
          await runAiMissingQuestionRecovery(pageIndex, aiTargets, 'IA focada');
        }

        setBulkProgress(Math.round(((planIndex + 1) / retryPlan.length) * 100));
      }

      if (remainingNumbers.size > 0) {
        addLog(
          `Tentativa focada: ${remainingNumbers.size} questao(oes) permanecem pendentes apos `
          + `as paginas provaveis. Nenhuma varredura ampla por IA foi executada.`,
        );
      }

      if (recoveredQuestions.length === 0) {
        addToast(
          retryAiQuotaExceeded
            ? 'A recuperacao mecanica foi executada. A IA nao foi usada porque a cota foi excedida; os cards pendentes foram mantidos.'
            : 'A recuperacao mecanica foi executada, mas nenhum card pendente recebeu novo conteudo.',
          'warning',
        );
        addLog('Tentativa focada concluida sem apagar ou ocultar os cards pendentes.');
        return;
      }

      const questionsByNumber = new Map<number, Question>();
      extractedQuestions.forEach((question, index) => {
        questionsByNumber.set(getExtractedQuestionNumber(question, index + 1), question);
      });
      recoveredQuestions.forEach((question) => {
        const questionNumber = getExtractedQuestionNumber(question, 0);
        if (questionNumber > 0) {
          questionsByNumber.set(questionNumber, question);
        }
      });

      let nextQuestions = Array.from(questionsByNumber.entries())
        .sort(([leftNumber], [rightNumber]) => leftNumber - rightNumber)
        .map(([, question]) => question);
      nextQuestions = await reviewQuestionPartsAfterExtraction(nextQuestions, { allowAi: false });
      nextQuestions = await classifyMissingQuestionSubjects(nextQuestions, 'Tentativa faltantes', { allowAi: false });
      const normalizedImportState = normalizeQuestionContextUsage(nextQuestions, retryContextMap);
      nextQuestions = normalizedImportState.questions;
      const retryPageRanges = Array.from(pageNumbersByPage.entries())
        .filter(([, numbers]) => numbers.length > 0)
        .map(([pageNumber, numbers]) => ({
          pageNumber,
          minQuestion: Math.min(...numbers),
          maxQuestion: Math.max(...numbers),
        }));
      const ensuredRetryDrafts = ensureExpectedQuestionDrafts({
        questions: nextQuestions as unknown as ImportedQuestionDraft[],
        expectedQuestionNumbers: importDiagnostics.expectedQuestionNumbers,
        diagnostics: importDiagnostics,
        defaultMetadata: retryMetadata || importMetadata || undefined,
        pageQuestionRanges: retryPageRanges,
        totalPages: pagesCount,
        answerKeyMap: keyMap,
        defaultFocus: selectedFocus || undefined,
      });
      nextQuestions = ensuredRetryDrafts.questions as unknown as Question[];

      setExtractedQuestions(nextQuestions);
      setExtractedContexts(normalizedImportState.contexts);
      setImportMetadata({
        ...(retryMetadata || {}),
        subjects: deriveQuestionSubjects(nextQuestions),
      } as ImportMetadata);
      setImportDiagnostics(ensuredRetryDrafts.diagnostics);

      const stillMissing = missingNumbers.filter((questionNumber) => (
        !ensuredRetryDrafts.diagnostics.completeQuestionNumbers.includes(questionNumber)
      ));
      addToast(
        `${recoveredQuestions.length} questão(ões) recuperada(s).${stillMissing.length > 0 ? ` Ainda faltam ${stillMissing.length}.` : ''}`,
        recoveredQuestions.length > 0 ? 'success' : 'warning',
      );
      addLog(`Tentativa focada concluída: ${recoveredQuestions.length} recuperada(s), ${stillMissing.length} ainda faltante(s).`);
    } catch (error) {
      addToast(`Erro ao tentar recuperar questoes faltantes: ${readErrorMessage(error)}`, 'error');
      addLog(`Tentativa focada interrompida: ${readErrorMessage(error)}`);
    } finally {
      setIsRetryingMissingQuestions(false);
      setBulkProgress(0);
    }
  };

  const handleParseQuestionsFromText = async (sourceText: string) => {
    const text = String(sourceText || '').trim();
    if (!text) {
      addToast('Cole o texto da questao antes de gerar.', 'error');
      return;
    }

    const selectedFocus = resolveSelectedFocus();
    if (!selectedFocus) {
      addToast('Selecione ou crie um foco antes de gerar questoes por texto.', 'error');
      return;
    }

    if (isProcessing || isBulkGenerating || isRetryingMissingQuestions) {
      addToast('Aguarde o processamento atual terminar antes de gerar por texto.', 'info');
      return;
    }

    try {
      const pageIndex = Math.max(
        0,
        ...extractedQuestions.map((question) => Number((question as unknown as ImportedQuestionDraft).sourcePage || 0)),
      ) + 1;
      const fileName = qFile?.name || `${String(importMetadata?.agency || 'manual')}-texto-colado.txt`;
      const textAnswerKey = parseAnswerKeyFromText(text, buildTargetAnswerKeySignal(importMetadata));
      let keyMap: Record<number, number> = {};
      if (kFile) {
        try {
          const pdfjs = await loadPdfJsModule();
          keyMap = await readCurrentAnswerKeyMap(pdfjs);
        } catch (error) {
          addLog(`Texto colado: nao foi possivel reler o gabarito oficial (${readErrorMessage(error)}).`);
        }
      }
      keyMap = { ...keyMap, ...textAnswerKey };

      const result = annotatePageExtractionResult(
        createMechanicalExtractionFromText(text, pageIndex, fileName),
        'mechanical',
        0.82,
      );
      if (!result.questions.length) {
        addToast('Nao encontrei questoes numeradas no texto colado.', 'warning');
        addLog('Texto colado: nenhum marcador de questao reconhecido.');
        return;
      }

      const contextMap = new Map<string, ImportedContextDraft>();
      extractedContexts.forEach((context) => {
        contextMap.set(context.tempId, { ...context });
      });

      const mapped = mapTextExtractionQuestions({
        result,
        pageIndex,
        pageRichText: {
          plainText: text,
          richText: text,
          highlights: [],
          hasHighlights: false,
        },
        pageText: text,
        keyMap,
        selectedFocus,
        contextMap,
        metadata: importMetadata,
        fileName,
        logPrefix: 'Texto colado',
      });

      if (!mapped.questions.length) {
        addToast('O texto foi lido, mas nenhuma questao valida ficou pronta para revisao.', 'warning');
        addLog('Texto colado: os trechos detectados nao tinham formato minimo de questao.');
        return;
      }

      const questionsByNumber = new Map<number, Question>();
      extractedQuestions.forEach((question, index) => {
        questionsByNumber.set(getExtractedQuestionNumber(question, index + 1), question);
      });

      let addedCount = 0;
      let updatedCount = 0;
      mapped.questions.forEach((question) => {
        const questionNumber = getExtractedQuestionNumber(question, 0);
        if (!questionNumber) {
          return;
        }

        const previous = questionsByNumber.get(questionNumber);
        if (!previous) {
          addedCount += 1;
          questionsByNumber.set(questionNumber, question);
          return;
        }

        updatedCount += 1;
        questionsByNumber.set(
          questionNumber,
          shouldReplaceImportedQuestionBackup(previous, question) ? question : previous,
        );
      });

      let nextQuestions = Array.from(questionsByNumber.entries())
        .sort(([leftNumber], [rightNumber]) => leftNumber - rightNumber)
        .map(([, question]) => question);
      nextQuestions = await reviewQuestionPartsAfterExtraction(nextQuestions);
      nextQuestions = await classifyMissingQuestionSubjects(nextQuestions, 'Texto colado');

      const normalizedImportState = normalizeQuestionContextUsage(nextQuestions, contextMap);
      nextQuestions = normalizedImportState.questions;
      const nextMetadata = {
        ...(mapped.metadata || importMetadata || {}),
        subjects: deriveQuestionSubjects(nextQuestions),
      } as ImportMetadata;

      setExtractedQuestions(nextQuestions);
      setExtractedContexts(normalizedImportState.contexts);
      setImportMetadata(nextMetadata);
      updateDiagnosticsForQuestionList(nextQuestions);
      addLog(`Texto colado: ${mapped.questions.length} questao(oes) processada(s), ${addedCount} adicionada(s), ${updatedCount} atualizada(s).`);
      addToast(`${mapped.questions.length} questao(oes) gerada(s) pelo texto colado.`, 'success');
    } catch (error) {
      addToast(`Erro ao gerar questoes pelo texto: ${readErrorMessage(error)}`, 'error');
      addLog(`Texto colado: falha ao processar (${readErrorMessage(error)}).`);
    }
  };

  const handleImportFromAiJson = async (
    sourceJson: string,
    options: { silentSuccess?: boolean } = {},
  ) => {
    const rawJson = String(sourceJson || '').trim();
    if (!rawJson) {
      addToast('Cole a resposta JSON da IA antes de gerar a revisão.', 'error');
      return;
    }

    if (isProcessing || isBulkGenerating || isRetryingMissingQuestions) {
      addToast('Aguarde o processamento atual terminar antes de importar o JSON da IA.', 'info');
      return;
    }

    try {
      const payload = JSON.parse(extractJsonObjectText(rawJson)) as Record<string, unknown>;
      const selectedFocus = resolveSelectedFocus();
      const metadataRecord = toLooseRecord(readLooseField(payload, ['metadata', 'metadados', 'exam', 'prova'])) || {};
      const rawQuestions = readLooseArray(payload, ['questions', 'questoes', 'questões']);
      if (!rawQuestions.length) {
        addToast('O JSON não possui a lista "questions". Peça para a IA retornar o formato exato do prompt.', 'error');
        return;
      }

      const organizationItems = readLooseMetadataTextList(metadataRecord, [
        'organizations',
        'organization',
        'orgaos',
        'órgãos',
        'orgao',
        'órgão',
        'sources',
        'source',
      ]);
      const roleItems = readLooseMetadataTextList(metadataRecord, [
        'roles',
        'role',
        'cargos',
        'cargo',
        'cargoProva',
        'cargo/prova',
      ]);
      const focusItems = readLooseMetadataTextList(metadataRecord, ['focos', 'focus', 'focuses', 'area', 'areas']);
      const registrationStart = readLooseText(metadataRecord, [
        'registrationStart',
        'dataInscricaoInicio',
        'inscricaoInicio',
        'inicioInscricao',
        'subscriptionStart',
      ]) || importMetadata?.registrationStart || importMetadata?.dataInscricaoInicio || '';
      const registrationEnd = readLooseText(metadataRecord, [
        'registrationEnd',
        'dataInscricaoFim',
        'inscricaoFim',
        'fimInscricao',
        'prazoInscricao',
        'subscriptionEnd',
      ]) || importMetadata?.registrationEnd || importMetadata?.dataInscricaoFim || '';
      const examDate = readLooseText(metadataRecord, [
        'examDate',
        'dataProva',
        'provaData',
        'date',
      ]) || importMetadata?.examDate || importMetadata?.dataProva || '';
      const registrationFee = readLooseText(metadataRecord, [
        'registrationFee',
        'valorInscricao',
        'taxaInscricao',
        'inscricaoValor',
        'fee',
      ]) || importMetadata?.registrationFee || importMetadata?.valorInscricao || '';
      const requirements = readLooseStructuredList(metadataRecord, ['requirements', 'requisitos']);
      const requirementsDetailed = readLooseStructuredList(metadataRecord, [
        'requirementsDetailed',
        'requisitosDetalhados',
        'requisitosEstruturados',
      ]);
      const remunerations = readLooseStructuredList(metadataRecord, ['remunerations', 'remuneracoes', 'remunerações']);
      const remunerationsDetailed = readLooseStructuredList(metadataRecord, [
        'remunerationsDetailed',
        'remuneracoesDetalhadas',
        'remuneraçõesDetalhadas',
        'remuneracaoEstruturada',
        'remuneraçãoEstruturada',
      ]);
      const vacancies = readLooseStructuredList(metadataRecord, ['vacancies', 'vagas']);
      const vacanciesDetailed = readLooseStructuredList(metadataRecord, [
        'vacanciesDetailed',
        'vagasDetalhadas',
        'vagasEstruturadas',
      ]);
      const programmaticContent = readLooseStructuredList(metadataRecord, [
        'programmaticContent',
        'conteudoProgramatico',
        'conteúdoProgramático',
      ]);
      const programmaticContentDetailed = readLooseStructuredList(metadataRecord, [
        'programmaticContentDetailed',
        'conteudoProgramaticoDetalhado',
        'conteúdoProgramáticoDetalhado',
        'programaDetalhado',
      ]);
      const stages = readLooseStructuredList(metadataRecord, ['stages', 'etapas', 'fases']);
      const platformQuestionIds = readLooseStructuredList(metadataRecord, [
        'platformQuestionIds',
        'questoesVinculadas',
        'questõesVinculadas',
        'questionIds',
      ]);
      const selectedExamMetadata = selectedExam ? getSelectedExamMetadata() : {};
      const baseImportMetadata = {
        ...(importMetadata || {}),
        ...selectedExamMetadata,
      } as ImportMetadata;
      const baseImportMetadataRecord = baseImportMetadata as Record<string, unknown>;

      const nextMetadata = {
        ...(baseImportMetadata || {}),
        ...metadataRecord,
        selectedExamId: selectedExam?.id || selectedExamId || baseImportMetadataRecord.selectedExamId,
        selectedExamTitle: selectedExam?.nome || baseImportMetadataRecord.selectedExamTitle || baseImportMetadata.examTitle || baseImportMetadata.title,
        agency: readLooseText(metadataRecord, ['agency', 'banca', 'board']) || baseImportMetadata?.agency || '',
        source: firstMetadataText(organizationItems, baseImportMetadata?.source || ''),
        sources: organizationItems.length > 0 ? organizationItems : baseImportMetadata?.sources,
        organization: firstMetadataText(organizationItems, baseImportMetadata?.organization || ''),
        organizations: organizationItems.length > 0 ? organizationItems : baseImportMetadata?.organizations,
        orgao: firstMetadataText(organizationItems, baseImportMetadata?.orgao || ''),
        orgaos: organizationItems.length > 0 ? organizationItems : baseImportMetadata?.orgaos,
        role: firstMetadataText(roleItems, baseImportMetadata?.role || ''),
        roles: roleItems.length > 0 ? roleItems : baseImportMetadata?.roles,
        cargo: firstMetadataText(roleItems, baseImportMetadata?.cargo || ''),
        cargos: roleItems.length > 0 ? roleItems : baseImportMetadata?.cargos,
        year: readLooseText(metadataRecord, ['year', 'ano']) || baseImportMetadata?.year || '',
        ano: readLooseText(metadataRecord, ['year', 'ano']) || baseImportMetadata?.ano || baseImportMetadata?.year || '',
        level: readLooseText(metadataRecord, ['level', 'nivel', 'nível']) || baseImportMetadata?.level || baseImportMetadata?.nivel || '',
        nivel: readLooseText(metadataRecord, ['level', 'nivel', 'nível']) || baseImportMetadata?.nivel || baseImportMetadata?.level || '',
        title: readLooseText(metadataRecord, ['title', 'titulo', 'examTitle', 'nome']) || baseImportMetadata?.title || baseImportMetadata?.examTitle || '',
        totalQuestions: readLooseField(metadataRecord, ['totalQuestions', 'totalQuestoes', 'total_questoes', 'questionCount'])
          || baseImportMetadata?.totalQuestions,
        questionStart: readLooseField(metadataRecord, [
          'questionStart',
          'startQuestion',
          'firstQuestionNumber',
          'numeroInicial',
          'questaoInicial',
          'questãoInicial',
          'primeiraQuestao',
          'primeiraQuestão',
        ]) || baseImportMetadata?.questionStart || baseImportMetadata?.startQuestion || baseImportMetadata?.firstQuestionNumber,
        questionEnd: readLooseField(metadataRecord, [
          'questionEnd',
          'endQuestion',
          'lastQuestionNumber',
          'numeroFinal',
          'questaoFinal',
          'questãoFinal',
          'ultimaQuestao',
          'últimaQuestão',
        ]) || baseImportMetadata?.questionEnd || baseImportMetadata?.endQuestion || baseImportMetadata?.lastQuestionNumber,
        questionRange: readLooseField(metadataRecord, [
          'questionRange',
          'intervaloQuestoes',
          'intervalo_questoes',
          'rangeQuestoes',
          'faixaQuestoes',
          'faixa_questoes',
        ]) || baseImportMetadata?.questionRange || baseImportMetadata?.intervaloQuestoes,
        focos: focusItems.length > 0 ? focusItems : baseImportMetadata?.focos,
        registrationStart,
        registrationEnd,
        examDate,
        registrationFee,
        dataInscricaoInicio: registrationStart,
        dataInscricaoFim: registrationEnd,
        dataProva: examDate,
        valorInscricao: registrationFee,
        requirements: requirements.length > 0 ? requirements : baseImportMetadata?.requirements,
        requisitos: requirements.length > 0 ? requirements : baseImportMetadata?.requisitos,
        requirementsDetailed: requirementsDetailed.length > 0 ? requirementsDetailed : baseImportMetadata?.requirementsDetailed,
        requisitosDetalhados: requirementsDetailed.length > 0 ? requirementsDetailed : baseImportMetadata?.requisitosDetalhados,
        remunerations: remunerations.length > 0 ? remunerations : baseImportMetadata?.remunerations,
        remuneracoes: remunerations.length > 0 ? remunerations : baseImportMetadata?.remuneracoes,
        remunerationsDetailed: remunerationsDetailed.length > 0 ? remunerationsDetailed : baseImportMetadata?.remunerationsDetailed,
        remuneracoesDetalhadas: remunerationsDetailed.length > 0 ? remunerationsDetailed : baseImportMetadata?.remuneracoesDetalhadas,
        vacancies: vacancies.length > 0 ? vacancies : baseImportMetadata?.vacancies,
        vagas: vacancies.length > 0 ? vacancies : baseImportMetadata?.vagas,
        vacanciesDetailed: vacanciesDetailed.length > 0 ? vacanciesDetailed : baseImportMetadata?.vacanciesDetailed,
        vagasDetalhadas: vacanciesDetailed.length > 0 ? vacanciesDetailed : baseImportMetadata?.vagasDetalhadas,
        programmaticContent: programmaticContent.length > 0 ? programmaticContent : baseImportMetadata?.programmaticContent,
        conteudoProgramatico: programmaticContent.length > 0 ? programmaticContent : baseImportMetadata?.conteudoProgramatico,
        programmaticContentDetailed: programmaticContentDetailed.length > 0 ? programmaticContentDetailed : baseImportMetadata?.programmaticContentDetailed,
        conteudoProgramaticoDetalhado: programmaticContentDetailed.length > 0 ? programmaticContentDetailed : baseImportMetadata?.conteudoProgramaticoDetalhado,
        stages: stages.length > 0 ? stages : baseImportMetadata?.stages,
        etapas: stages.length > 0 ? stages : baseImportMetadata?.etapas,
        platformQuestionIds: platformQuestionIds.length > 0 ? platformQuestionIds : baseImportMetadata?.platformQuestionIds,
        questoesVinculadas: platformQuestionIds.length > 0 ? platformQuestionIds : baseImportMetadata?.questoesVinculadas,
      } as ImportMetadata;

      const contexts = normalizeExternalAiContextPayload(
        readLooseField(payload, ['temporary_context', 'temporaryContext', 'contexts', 'contextos', 'pageContexts']),
      );
      const contextByTitle = new Map<string, string>();
      contexts.forEach((context) => {
        [
          context.title,
          context.externalKey,
          context.tempId,
        ].forEach((label) => {
          const normalizedLabel = normalizeComparisonText(label);
          if (normalizedLabel && !contextByTitle.has(normalizedLabel)) {
            contextByTitle.set(normalizedLabel, context.tempId);
          }
        });
      });
      const contextByQuestionNumber = new Map<number, string>();
      contexts
        .filter((context) => context.questionNumbers.length > 1)
        .sort((left, right) => left.questionNumbers.length - right.questionNumbers.length)
        .forEach((context) => {
          context.questionNumbers.forEach((questionNumber) => {
            if (Number.isFinite(questionNumber) && questionNumber > 0 && !contextByQuestionNumber.has(questionNumber)) {
              contextByQuestionNumber.set(questionNumber, context.tempId);
            }
          });
        });
      const answerKeyMap: Record<number, number> = {};
      const alreadyPublishedQuestionNumbers = new Set<number>();
      const normalizedQuestions = rawQuestions.map((item, index) => {
        const record = toLooseRecord(item) || {};
        const sourceRecord = toLooseRecord(readLooseField(record, ['source', 'origem'])) || {};
        const contentRecord = toLooseRecord(readLooseField(record, ['content', 'conteudo', 'conteúdo'])) || {};
        const answerRecord = toLooseRecord(readLooseField(record, ['answer', 'gabarito', 'resposta'])) || {};
        const editorialItems = readLooseArray(record, ['editorial']);
        const readEditorialBody = (type: string) => {
          const item = editorialItems
            .map((editorialItem) => toLooseRecord(editorialItem))
            .find((editorialItem) => String(editorialItem?.type || '').trim() === type);
          return readLooseText(item, ['body', 'text', 'texto', 'markdown', 'comment']);
        };
        const number = normalizeQuestionNumber(
          readLooseField(sourceRecord, ['questionNumber', 'number', 'numero', 'número'])
          || readLooseField(record, ['number', 'numero', 'número', 'questionNumber', 'questao', 'questão']),
          index + 1,
        );
        const sourceProvider = readLooseText(sourceRecord, ['provider', 'sourceProvider']).toLowerCase();
        const localQuestionId = Number(readLooseField(sourceRecord, ['localQuestionId', 'local_question_id']) || 0);
        const sourceAlreadyPublished = readLooseField(sourceRecord, ['alreadyPublished', 'already_published']) === true;
        if (
          sourceProvider === 'gran'
          && sourceAlreadyPublished
          && Number.isInteger(localQuestionId)
          && localQuestionId > 0
        ) {
          alreadyPublishedQuestionNumbers.add(number);
        }
        const filters = toLooseRecord(readLooseField(record, ['filters', 'filtros'])) || {};
        const canonicalFilters = readCanonicalQuestionFilters(filters);
        const externalTaxonomy = readExternalAiQuestionTaxonomy(record, filters);
        const rawOptions = normalizeAiQuestionOptions(
          readLooseField(record, ['alternatives', 'alternativas', 'options', 'itens']),
        );
        const answerIndex = normalizeAnswerIndex(readLooseField(answerRecord, [
          'raw',
          'value',
          'correctAlternativeTempIds',
          'correctAlternativeIds',
          'alternativeId',
        ]) || readLooseField(record, [
          'answer',
          'gabarito',
          'correct',
          'correctOption',
          'correctOptionIndex',
          'resposta',
        ]));
        if (Number.isInteger(answerIndex)) {
          answerKeyMap[number] = Number(answerIndex);
        }
        const modality = inferImportedQuestionTypeFromPayload(
          readLooseField(record, ['type', 'modality', 'modalidade', 'questionType', 'tipo']),
          rawOptions.length,
        );
        const contextLabel = readLooseText(sourceRecord, ['contextTempId', 'contextKey', 'questionGroupId'])
          || readLooseText(record, ['contextKey', 'contexto', 'contextTitle', 'tituloContexto']);
        const contextKey = contextByTitle.get(normalizeComparisonText(contextLabel))
          || contextByQuestionNumber.get(number)
          || contextLabel
          || '';
        const linkedContext = contextKey
          ? contexts.find((context) => context.tempId === contextKey || context.externalKey === contextKey)
          : undefined;
        const statusReasons = readLooseArray(record, ['statusReasons', 'motivos', 'reasons'])
          .map((reason) => String(reason || '').trim())
          .filter(Boolean) as ImportedQuestionStatusReason[];
        const taxonomyNeedsReview = !externalTaxonomy.subject || !externalTaxonomy.topic || !externalTaxonomy.specificSubject;
        const rawStatement = readLooseText(contentRecord, ['statement', 'enunciado', 'command', 'comando', 'text', 'texto'])
          || readLooseText(record, ['statement', 'enunciado', 'command', 'comando', 'text', 'texto']);
        const statementSplit = (() => {
          const explicitTextSplit = splitSupportContextFromStatement(rawStatement);
          if (explicitTextSplit.supportText) return explicitTextSplit;

          const inlineTextSplit = splitInlineSupportContextFromStatement(rawStatement);
          if (inlineTextSplit.supportText) return inlineTextSplit;

          return { supportText: '', referenceText: '', statement: rawStatement };
        })();
        const statement = statementSplit.statement || rawStatement;
        const rawSupportText = [
          readLooseText(contentRecord, ['supportText', 'textoApoio', 'texto_de_apoio']),
          readLooseText(record, ['supportText', 'textoApoio', 'texto_de_apoio']),
          statementSplit.supportText,
        ].filter(Boolean).join('\n\n');
        const supportText = (() => {
          const cleanSupportText = rawSupportText.trim();
          if (!cleanSupportText || !linkedContext || linkedContext.questionNumbers.length <= 1) {
            return cleanSupportText;
          }

          const normalizedSupport = normalizeComparisonText(cleanSupportText);
          const normalizedContext = normalizeComparisonText([
            linkedContext.title,
            linkedContext.text,
            linkedContext.figureDescription,
          ].filter(Boolean).join('\n\n'));
          const isSameSharedContext = normalizedSupport.length >= 40 && (
            normalizedContext.includes(normalizedSupport)
            || normalizedSupport.includes(normalizedContext)
          );
          const isOnlySharedFigureDescription = /^figura\s*\/?\s*imagem\s*:/i.test(cleanSupportText)
            && Boolean(linkedContext.hasFigure || linkedContext.figureDescription || linkedContext.figures?.length);

          return isSameSharedContext || isOnlySharedFigureDescription ? '' : cleanSupportText;
        })();
        const referenceText = sanitizeReferenceTextForImport([
          readLooseText(contentRecord, ['reference', 'referenceText', 'referencia', 'fonte']),
          readLooseText(record, ['referenceText', 'referencia', 'fonte']),
          (statementSplit as { referenceText?: string }).referenceText,
        ].filter(Boolean).join('\n\n'));
        const teacherComment = readEditorialBody('teacher_comment') || readLooseText(record, [
          'teacherComment',
          'professorComment',
          'comentarioProfessor',
          'comentárioProfessor',
          'comentario_do_professor',
          'comentário_do_professor',
          'comentarioDoProfessor',
          'comentárioDoProfessor',
          'gabaritoComentado',
          'gabarito_comentado',
        ]);
        const rawDetailedComment = readEditorialBody('detailed_analysis') || readLooseText(record, [
          'detailedComment',
          'detailedAnalysis',
          'analiseDetalhada',
          'análiseDetalhada',
          'analise_detalhada',
          'análise_detalhada',
          'analiseCompleta',
          'análiseCompleta',
          'comentarioDetalhado',
          'comentárioDetalhado',
        ]);
        const genericDetailedComment = externalDetailedCommentIsGeneric(rawDetailedComment);
        const detailedComment = genericDetailedComment ? '' : rawDetailedComment;
        const rawSupportImages = readLooseArray(record, [
          'assets',
          'supportImages',
          'support_images',
          'imagensApoio',
          'imagens_apoio',
          'figures',
          'figuras',
          'images',
          'imagens',
        ]).map((image, imageIndex) => {
          const imageRecord = toLooseRecord(image);
          return {
            tempId: readLooseText(imageRecord, ['tempId', 'temp_id', 'id']) || `ai-json-q${number}-img-${imageIndex + 1}`,
            title: readLooseText(imageRecord, ['title', 'titulo', 'name', 'nome']) || `Figura ${imageIndex + 1}`,
            description: readLooseText(imageRecord, ['description', 'descricao', 'text', 'texto']),
            imageData: readExternalImageData(imageRecord),
            url: readLooseText(imageRecord, ['url', 'src']),
            usage: (['statement', 'support', 'alternative', 'context', 'reference'].includes(readLooseText(imageRecord, ['usage', 'usage_type'])) ? readLooseText(imageRecord, ['usage', 'usage_type']) : 'support') as ImportedQuestionImageDraft['usage'],
            pageImageData: readLooseText(imageRecord, ['pageImageData', 'page_image_data', 'pageBase64']),
            figureBox: normalizeExtractionFigureBox(readLooseField(imageRecord, ['figureBox', 'box', 'bbox']) as FigureBox),
            page: Number(readLooseField(imageRecord, ['page', 'pagina']) || 0) || undefined,
            manualCropApplied: Boolean(readExternalImageData(imageRecord)),
          };
        }).filter((image) => (
          supportImageHasUsefulPayload(image)
          && !shouldDropExternalTextDuplicateImage(image, supportText, statement, linkedContext as ImportedContextDraft | undefined)
        ));
        const sharedContextImageSignatures = new Set(
          linkedContext && linkedContext.questionNumbers.length > 1
            ? buildSupportImagesFromContext(linkedContext, number)
              .map((image) => getSupportImageSignature(image))
              .filter(Boolean)
            : [],
        );
        const supportImages = mergeQuestionSupportImages(
          { supportImages: [] } as unknown as Question,
          rawSupportImages.filter((image) => !sharedContextImageSignatures.has(getSupportImageSignature(image))),
        );
        const singleQuestionImageData = readExternalImageData(record);
        if (singleQuestionImageData) {
          const withMainImage = mergeQuestionSupportImages(
            { supportImages } as unknown as Question,
            [{
            tempId: `ai-json-q${number}-img-main`,
            title: readLooseText(record, ['figureTitle', 'tituloFigura']) || 'Figura da questão',
            description: readLooseText(record, ['figureDescription', 'descricaoFigura']),
            imageData: singleQuestionImageData,
            pageImageData: readLooseText(record, ['pageImageData', 'page_image_data', 'pageBase64']),
            figureBox: normalizeExtractionFigureBox(readLooseField(record, ['figureBox', 'box', 'bbox']) as FigureBox),
            page: Number(readLooseField(record, ['page', 'pagina']) || 0) || undefined,
            manualCropApplied: true,
            }],
          );
          supportImages.splice(0, supportImages.length, ...withMainImage);
        }
        const itens = rawOptions.map((option, optionIndex) => ({
          id: optionIndex + 1,
          ordem: optionIndex + 1,
          letra: option.label,
          rotulo: option.label,
          texto: option.text,
          corpo: [
            option.text,
            option.imageData ? createVisualOptionHtml(option.label, option.imageData) : '',
          ].filter(Boolean).join('\n\n'),
          correta: Number.isInteger(answerIndex) ? optionIndex === Number(answerIndex) : false,
          imageData: option.imageData,
          pageImageData: option.pageImageData,
          figureBox: option.figureBox,
        }));
        const hasMinimumContent = Boolean(statement.trim()) && (
          modality === 'discursiva'
          || modality === 'redacao'
          || rawOptions.length >= 2
        );
        const reasons = Array.from(new Set([
          ...statusReasons,
          ...(!statement.trim() ? ['enunciado_ausente' as const] : []),
          ...(rawOptions.length < 2 && modality !== 'discursiva' && modality !== 'redacao' ? ['alternativas_ausentes' as const] : []),
          ...(!hasMinimumContent ? ['aguardando_complemento_manual' as const] : []),
          ...(taxonomyNeedsReview ? ['classificacao_incompleta' as const] : []),
          ...(genericDetailedComment ? ['comentario_editorial_sem_base_suficiente' as const] : []),
        ]));
        const quality: QuestionExtractionQuality = {
          origin: 'manual',
          confidence: hasMinimumContent ? 0.92 : 0.45,
          localized: Boolean(statement.trim() || rawOptions.length),
          complete: hasMinimumContent,
          needsReview: !hasMinimumContent || reasons.length > 0,
          reasons,
        };
        return buildQuestionPayloadImportCard({
          ...{ tempId: readLooseText(record, ['tempId', 'temp_id', 'externalKey', 'external_key']), source: readExternalQuestionSourcePayload(sourceRecord, number, contextKey, sourceAlreadyPublished) },
          questionNumber: number,
          statement,
          introText: supportText,
          referenceText,
          teacherComment,
          detailedComment,
          contextKey,
          bancas: canonicalFilters.examBoards.length > 0 ? canonicalFilters.examBoards : (nextMetadata.agency ? [createTaxonomyLabel(String(nextMetadata.agency), { sigla: String(nextMetadata.agency) })] : []),
          orgaos: canonicalFilters.organizations.length > 0 ? canonicalFilters.organizations : (nextMetadata.source ? [createTaxonomyLabel(String(nextMetadata.source))] : []),
          cargos: canonicalFilters.roles.length > 0 ? canonicalFilters.roles : (nextMetadata.role ? [createTaxonomyLabel(String(nextMetadata.role), { descricao: String(nextMetadata.role) })] : []),
          assuntos: (canonicalFilters.subjects.length + canonicalFilters.topics.length + canonicalFilters.subtopics.length > 0
            ? [...canonicalFilters.subjects, ...canonicalFilters.topics, ...canonicalFilters.subtopics]
            : buildExternalAiQuestionTaxonomies(externalTaxonomy)) as Question['assuntos'],
          anos: canonicalFilters.years.length > 0 ? canonicalFilters.years : (Number(nextMetadata.year) ? [Number(nextMetadata.year)] : []),
          carreiras: canonicalFilters.careers.length > 0 ? canonicalFilters.careers : (selectedFocus ? [selectedFocus] : []),
          niveis: canonicalFilters.levels.length > 0 ? canonicalFilters.levels : (nextMetadata.level ? [createTaxonomyLabel(String(nextMetadata.level))] : []),
          nivel: nextMetadata.level || undefined,
          tiposProva: canonicalFilters.examTypes.length > 0 ? canonicalFilters.examTypes : (nextMetadata.examType ? [createTaxonomyLabel(String(nextMetadata.examType))] : []),
          tipo: modality,
          hasFigure: supportImages.length > 0 || rawOptions.some((option) => option.imageData || option.figureBox),
          figureDescription: readLooseText(record, ['figureDescription', 'descricaoFigura'])
            || supportImages.map((image) => image.description).filter(Boolean).join('\n'),
          dificuldade: normalizeDifficulty(String(readLooseField(filters, ['dificuldade', 'difficulty']) || readLooseField(record, ['difficulty', 'dificuldade']) || '')),
          itens: itens as unknown as Question['itens'],
          resposta: Number.isInteger(answerIndex) ? Number(answerIndex) + 1 : 0,
          correctOptionIndex: Number.isInteger(answerIndex) ? Number(answerIndex) : undefined,
          supportImages,
          status: hasMinimumContent ? 'ok' : 'incompleta',
          needsImportReview: !hasMinimumContent || reasons.length > 0,
          reasons,
          quality,
        });
      });

      const normalizedQuestionNumbers = normalizedQuestions.map((question, index) => getImportedQuestionNumber(question, index + 1));
      const declaredTotal = Number(
        nextMetadata.totalQuestions
        || nextMetadata.total_questions
        || nextMetadata.totalQuestoes
        || nextMetadata.questionCount
        || 0,
      );
      const expectedQuestionNumbers = resolveExpectedQuestionNumbersForImport({
        declaredTotal,
        metadata: nextMetadata as unknown as Record<string, unknown>,
        questionNumbers: normalizedQuestionNumbers,
      });
      const baseDiagnostics: ImportDiagnostics = {
        expectedQuestionNumbers,
        extractedQuestionNumbers: normalizedQuestionNumbers,
        localizedQuestionNumbers: normalizedQuestions
          .filter((question) => Boolean(String(question.enunciado || '').trim()))
          .map((question, index) => getImportedQuestionNumber(question, index + 1)),
        completeQuestionNumbers: [],
        incompleteQuestionNumbers: [],
        missingQuestionNumbers: [],
        placeholderQuestionNumbers: [],
        visualPendingQuestionNumbers: [],
        duplicateQuestionNumbers: [],
        suspiciousQuestionNumbers: [],
        cardsCreatedCount: 0,
        completeCardsCount: 0,
        incompleteCardsCount: 0,
        placeholderCardsCount: 0,
      };
      const ensured = ensureExpectedQuestionDrafts({
        questions: normalizedQuestions as unknown as ImportedQuestionDraft[],
        expectedQuestionNumbers,
        diagnostics: baseDiagnostics,
        defaultMetadata: nextMetadata,
        answerKeyMap,
        defaultFocus: selectedFocus || undefined,
      });
      const normalizedImportState = normalizeQuestionContextUsage(
        ensured.questions as unknown as Question[],
        new Map(contexts.map((context) => [context.tempId, context])),
      );

      setExtractedQuestions(normalizedImportState.questions);
      setExtractedContexts(normalizedImportState.contexts);
      setImportMetadata({
        ...nextMetadata,
        subjects: deriveQuestionSubjects(normalizedImportState.questions),
      });
      setImportDiagnostics(ensured.diagnostics);
      setPublishedExam(null);
      setPublishedQuestionNumbers(Array.from(alreadyPublishedQuestionNumbers).sort((left, right) => left - right));
      addLog(`JSON da IA importado: ${ensured.diagnostics.cardsCreatedCount} card(s), ${ensured.diagnostics.completeCardsCount} completo(s), ${ensured.diagnostics.placeholderCardsCount} pendente(s).`);
      if (!options.silentSuccess) {
        addToast('Resposta da IA carregada na revisão.', 'success');
      }
    } catch (error) {
      addToast(`Não foi possível ler o JSON da IA: ${readErrorMessage(error)}`, 'error');
      addLog(`JSON da IA: falha ao importar (${readErrorMessage(error)}).`);
    }
  };

  const handleImportExternalEditorialJson = async (sourceJson: string) => {
    const rawJson = String(sourceJson || '').trim();
    if (!rawJson) {
      addToast('Cole o JSON editorial da IA externa antes de aplicar.', 'error');
      return;
    }

    if (isProcessing || isBulkGenerating || isRetryingMissingQuestions) {
      addToast('Aguarde o processamento atual terminar antes de aplicar o JSON editorial.', 'info');
      return;
    }

    try {
      const candidate = rawJson.startsWith('[')
        ? rawJson
        : extractJsonObjectText(rawJson);
      const payload = JSON.parse(candidate) as unknown;
      const payloadRecord = toLooseRecord(payload);
      const rawQuestions = Array.isArray(payload)
        ? payload
        : readLooseArray(payloadRecord, ['questions', 'questoes', 'questões']);

      if (!rawQuestions.length) {
        addToast('O JSON editorial precisa conter "questions" com number e teacherComment ou detailedComment.', 'error');
        return;
      }

      const patchesByNumber = new Map<number, Partial<Question>>();
      rawQuestions.forEach((item, index) => {
        const record = toLooseRecord(item);
        if (!record) return;

        const number = normalizeQuestionNumber(
          readLooseField(record, ['number', 'numero', 'número', 'questionNumber', 'questao', 'questão']),
          index + 1,
        );
        const teacherComment = readLooseText(record, [
          'teacherComment',
          'professorComment',
          'comentarioProfessor',
          'comentárioProfessor',
          'comentario_do_professor',
          'comentário_do_professor',
          'comentarioDoProfessor',
          'comentárioDoProfessor',
          'gabaritoComentado',
          'gabarito_comentado',
        ]);
        const rawDetailedComment = readLooseText(record, [
          'detailedComment',
          'detailedAnalysis',
          'analiseDetalhada',
          'análiseDetalhada',
          'analise_detalhada',
          'análise_detalhada',
          'analiseCompleta',
          'análiseCompleta',
          'comentarioDetalhado',
          'comentárioDetalhado',
        ]);
        const detailedComment = externalDetailedCommentIsGeneric(rawDetailedComment) ? '' : rawDetailedComment;
        const patch: Partial<Question> = {};

        if (teacherComment.trim()) {
          patch.teacherComment = teacherComment;
        }
        if (detailedComment.trim()) {
          patch.detailedComment = detailedComment;
        }
        if (Number.isFinite(number) && number > 0 && (patch.teacherComment || patch.detailedComment)) {
          patchesByNumber.set(number, {
            ...patchesByNumber.get(number),
            ...patch,
          });
        }
      });

      if (patchesByNumber.size === 0) {
        addToast('Nenhum comentário ou análise detalhada válido foi encontrado no JSON editorial.', 'error');
        return;
      }

      const appliedCount = extractedQuestions.filter((question, index) => (
        patchesByNumber.has(getImportedQuestionNumber(question, index + 1))
      )).length;
      setExtractedQuestions((current) => current.map((question, index) => {
        const number = getImportedQuestionNumber(question, index + 1);
        const patch = patchesByNumber.get(number);
        if (!patch) return question;
        return mergeQuestionEditorialPatch(question, patch);
      }));

      addLog(`JSON editorial externo aplicado: ${appliedCount} questao(oes) atualizada(s).`);
      addToast(`JSON editorial aplicado em ${appliedCount} questao(oes).`, 'success');
    } catch (error) {
      addToast(`Não foi possível ler o JSON editorial: ${readErrorMessage(error)}`, 'error');
      addLog(`JSON editorial externo: falha ao importar (${readErrorMessage(error)}).`);
    }
  };

  const handleBulkGenerateDetailed = async () => {
    if (extractedQuestions.length === 0) {
      return;
    }

    setIsBulkGenerating(true);
    setBulkGenerationType('detailed');
    setBulkProgress(0);
    try {
      const updatedQuestions = await generateDetailedAnalysesForQuestions(extractedQuestions, {
        updateLiveState: true,
        logLabel: 'Iniciando geracao em lote de analises detalhadas...',
      });
      setExtractedQuestions((current) => current.map((question, index) => (
        updatedQuestions[index]
          ? mergeQuestionEditorialPatch(question, updatedQuestions[index])
          : question
      )));
      addLog('Geracao em massa concluida!');
    } finally {
      setIsBulkGenerating(false);
      setBulkGenerationType(null);
    }
  };

  const handleBulkGenerateTeacher = async () => {
    if (extractedQuestions.length === 0) {
      return;
    }

    setIsBulkGenerating(true);
    setBulkGenerationType('teacher');
    setBulkProgress(0);
    try {
      const updatedQuestions = await generateTeacherCommentsForQuestions(extractedQuestions, {
        updateLiveState: true,
        logLabel: 'Iniciando geracao em lote de comentarios do professor...',
      });
      setExtractedQuestions((current) => current.map((question, index) => (
        updatedQuestions[index]
          ? mergeQuestionEditorialPatch(question, updatedQuestions[index])
          : question
      )));
      addLog('Geracao em massa de comentarios do professor concluida!');
    } finally {
      setIsBulkGenerating(false);
      setBulkGenerationType(null);
    }
  };

  const handleGenerateSpecific = async (index: number, type: GenerateSpecificType) => {
    setGeneratingSpecific({ index, type });
    const question = extractedQuestions[index];

    if (!question) {
      setGeneratingSpecific(null);
      return;
    }

    try {
      const fieldPatch = type === 'teacher'
        ? { teacherComment: await aiService.generateTeacherComment(question) }
        : { detailedComment: await aiService.generateDetailedAnalysis(question) };

      setExtractedQuestions((previous) => {
        const next = [...previous];
        next[index] = mergeQuestionEditorialPatch(next[index] || question, fieldPatch);
        return next;
      });
    } catch {
      addToast('Erro ao gerar comentario. Tente novamente.', 'error');
    } finally {
      setGeneratingSpecific(null);
    }
  };

  const readRequiredExamMetadata = () => {
    const roles = normalizeRoleList(importMetadata?.roles, importMetadata?.cargos, importMetadata?.role || importMetadata?.cargo);
    const organizations = normalizeOrganizationList(importMetadata?.sources, importMetadata?.orgaos, importMetadata?.source);
    const role = summarizeExamTitleList(roles, String(importMetadata?.role || importMetadata?.cargo || importMetadata?.examName || importMetadata?.contestName || '').trim());
    const agency = String(importMetadata?.agency || '').trim();
    const source = summarizeExamTitleList(organizations, String(importMetadata?.source || '').trim());
    const year = String(importMetadata?.year || importMetadata?.ano || '').trim();

    return { agency, organizations, role, roles, source, year };
  };

  const buildImportExamPayload = (questionsForSubjects: Question[]) => {
    const examName = buildExamTitle(importMetadata, qFile?.name?.replace(/\.pdf$/i, '') || 'Prova importada');
    const examTaxonomyMetadata = buildImportExamTaxonomyMetadata(importMetadata);
    const metadataSubjects = Array.isArray(importMetadata?.subjects) && importMetadata.subjects.length > 0
      ? importMetadata.subjects
      : deriveQuestionSubjects(questionsForSubjects.length > 0 ? questionsForSubjects : extractedQuestions);
    const bookletMetadata = buildBookletMetadata(importMetadata, qFile?.name, examName);

    return {
      examName,
      exam: {
        ...importMetadata,
        ...bookletMetadata,
        subjects: metadataSubjects,
        title: examName,
        examTitle: examName,
        name: examName,
        nome: examName,
        ...examTaxonomyMetadata.payload,
        year: importMetadata?.year || new Date().getFullYear(),
        level: importMetadata?.level || '',
        examType: importMetadata?.examType || 'Concurso',
      },
    };
  };

  const syncPublishedExam = async (exam: Record<string, unknown> | undefined, examName: string) => {
    const examRecord: Record<string, unknown> = exam && typeof exam === 'object' ? exam : {};
    const bookletMetadata = buildBookletMetadata(importMetadata, qFile?.name, examName);
    const roleLabels = normalizeRoleList(importMetadata?.roles, importMetadata?.cargos, importMetadata?.role);
    const organizationLabels = normalizeOrganizationList(importMetadata?.sources, importMetadata?.orgaos, importMetadata?.source);
    const sourceSummary = summarizeExamTitleList(organizationLabels, importMetadata?.source || '');
    const primaryRole = roleLabels[0] || importMetadata?.role || '';
    const primarySource = organizationLabels[0] || sourceSummary || importMetadata?.source || '';
    const responseBanca = toLooseRecord(examRecord.banca);
    const responseOrgao = toLooseRecord(examRecord.orgao);
    const responseCargo = toLooseRecord(examRecord.cargo);
    const responseOrgaos = Array.isArray(examRecord.orgaos)
      ? examRecord.orgaos.filter((item): item is Record<string, unknown> => Boolean(toLooseRecord(item))).map((item) => toLooseRecord(item) as Record<string, unknown>)
      : [];
    const responseCargos = Array.isArray(examRecord.cargos)
      ? examRecord.cargos.filter((item): item is Record<string, unknown> => Boolean(toLooseRecord(item))).map((item) => toLooseRecord(item) as Record<string, unknown>)
      : [];
    const agencyLabel = String(responseBanca?.sigla || responseBanca?.nome || responseBanca?.name || importMetadata?.agency || '').trim();
    const orgaoTaxonomies = responseOrgaos.length > 0
      ? responseOrgaos
      : organizationLabels.map((organization) => createTaxonomyLabel(organization));
    const cargoTaxonomies = responseCargos.length > 0
      ? responseCargos
      : roleLabels.map((role) => createTaxonomyLabel(role, { descricao: role }));
    const normalizedExam = normalizeProvaRecord({
      ...examRecord,
      ...bookletMetadata,
      roles: roleLabels,
      cargos: cargoTaxonomies,
      sources: organizationLabels,
      orgaos: orgaoTaxonomies,
      id: getPublishedExamId(examRecord),
      nome: String(examRecord.nome || examRecord.name || examRecord.title || examRecord.examTitle || examName),
      slug: String(examRecord.slug || slugify(examName)),
      ano: Number(examRecord.ano || examRecord.year || importMetadata?.year || new Date().getFullYear()),
      tipo: Number(examRecord.tipo || 0),
      index: String(examRecord.index || ''),
      nivel: String(examRecord.nivel || examRecord.level || importMetadata?.level || ''),
      examType: importMetadata?.examType || examRecord.examType || examRecord.exam_type || 'Concurso',
      banca: {
        id: Number(responseBanca?.id || 0),
        sigla: String(responseBanca?.sigla || agencyLabel),
        nome: String(responseBanca?.nome || responseBanca?.name || agencyLabel),
        slug: String(responseBanca?.slug || slugify(agencyLabel || 'banca')),
      },
      orgao: {
        id: Number(responseOrgao?.id || orgaoTaxonomies[0]?.id || 0),
        sigla: String(responseOrgao?.sigla || responseOrgao?.nome || responseOrgao?.name || primarySource),
        nome: String(responseOrgao?.nome || responseOrgao?.name || responseOrgao?.sigla || primarySource),
        slug: String(responseOrgao?.slug || orgaoTaxonomies[0]?.slug || slugify(primarySource || 'orgao')),
      },
      cargo: {
        id: Number(responseCargo?.id || cargoTaxonomies[0]?.id || 0),
        descricao: String(responseCargo?.descricao || responseCargo?.['descrição'] || responseCargo?.name || primaryRole),
        ['descrição']: String(responseCargo?.['descrição'] || responseCargo?.descricao || responseCargo?.name || primaryRole),
        slug: String(responseCargo?.slug || cargoTaxonomies[0]?.slug || slugify(primaryRole || 'cargo')),
      },
    });
    const savedExam = normalizedExam
      ? { ...normalizedExam, ...bookletMetadata }
      : { ...examRecord, ...bookletMetadata, nome: examName, title: examName, examTitle: examName };
    if (!getPublishedExamId(savedExam)) {
      addLog('A API respondeu a publicacao da prova sem ID. As questoes nao serao liberadas para publicacao ate a prova retornar um ID valido.');
      return null;
    }
    setPublishedExam(savedExam as Record<string, unknown>);

    if (!normalizedExam) {
      addLog('Prova publicada, mas a lista local de provas nao foi normalizada agora. O ID retornado pelo backend foi preservado para publicar as questoes.');
      return savedExam as Record<string, unknown>;
    }

    const previousExamBank = systemSettings.examBank || [];
    const nextSettings = {
      ...systemSettings,
      examBank: [
        normalizedExam,
        ...previousExamBank.filter((item) => String(item.id) !== String(normalizedExam.id)),
      ],
    };
    try {
      useAppConfigStore.getState().replaceSystemSettings(nextSettings);
      await adminService.saveSystemSettings(nextSettings);
    } catch (error) {
      useAppConfigStore.getState().replaceSystemSettings(nextSettings);
      addLog(`Prova publicada e mantida na lista local, mas a sincronizacao persistente do banco de provas falhou (${readErrorMessage(error)}).`);
    }
    return normalizedExam;
  };

  const ensurePublishedExamForQuestions = async (selectedFocus: QuestionTaxonomyLabel) => {
    if (activePublishedExam && activePublishedExamId) return activePublishedExam;
    const { examName, exam } = buildImportExamPayload(extractedQuestions);
    const response = await questionService.createImportedExam({ exam, focus: selectedFocus as Record<string, unknown> });
    if (!response.success) throw new Error(response.message || 'Falha ao salvar a prova importada.');

    const syncedExam = await syncPublishedExam(response.exam, examName);
    if (!syncedExam || !getPublishedExamId(syncedExam as Record<string, unknown>)) throw new Error('A API salvou a prova, mas nao retornou um ID valido para vincular as questoes.');

    return syncedExam as Record<string, unknown>;
  };

  const buildQuestionPublishPayload = (entries: Array<{ question: Question; index: number }>) => {
    const normalizedImportState = normalizeQuestionContextUsage(
      extractedQuestions.map((question) => applyExamYearToQuestion(question, importMetadata)),
      new Map(extractedContexts.map((context) => [context.tempId, { ...context }])),
    );
    const normalizedQuestionByNumber = new Map<number, Question>();
    normalizedImportState.questions.forEach((question, index) => {
      normalizedQuestionByNumber.set(getImportedQuestionNumber(question, index + 1), question);
    });
    const normalizedEntries = entries.map(({ question, index }) => {
      const questionNumber = getImportedQuestionNumber(question, index + 1);
      return {
        index,
        question: normalizedQuestionByNumber.get(questionNumber) || applyExamYearToQuestion(question, importMetadata),
      };
    });
    const contextsForState = normalizedImportState.contexts;
    const contextByTempId = new Map(contextsForState.map((context) => [context.tempId, context]));
    const contextTempIdByQuestionNumber = new Map<number, string>();
    contextsForState.forEach((context) => {
      context.questionNumbers.forEach((questionNumber) => {
        if (Number.isFinite(questionNumber) && questionNumber > 0) {
          contextTempIdByQuestionNumber.set(questionNumber, context.tempId);
        }
      });
    });

    const usedQuestionNumbersByContextTempId = new Map<string, Set<number>>();
    const prepareImportedQuestionForCreate = (question: Question) => {
      const syncedQuestion = syncCanonicalQuestionPayload(question);
      const syncedDraft = syncedQuestion as unknown as ImportedQuestionDraft;
      const payload = syncedDraft.questionCreatePayload || (syncedQuestion as unknown as QuestionPayload);
      const teacherComment = payload.editorial?.find((item) => item.type === 'teacher_comment')?.body
        || syncedQuestion.editorialComments?.teacherComment
        || syncedQuestion.teacherComment
        || '';
      const detailedComment = payload.editorial?.find((item) => item.type === 'detailed_analysis')?.body
        || syncedQuestion.editorialComments?.detailedComment
        || syncedQuestion.detailedComment
        || '';

      return {
        ...payload,
        id: null,
        editorial: [
          { type: 'teacher_comment', title: '', body: teacherComment, status: 'draft' },
          { type: 'detailed_analysis', title: '', body: detailedComment, status: 'draft' },
        ],
        review: {
          required: Boolean((syncedQuestion as ImportedQuestionDraft).needsImportReview || payload.review?.required || payload.review?.needsReview),
          status: ((syncedQuestion as ImportedQuestionDraft).needsImportReview || payload.review?.required || payload.review?.needsReview) ? 'pending' : 'reviewed',
          reasons: Array.from(new Set([
            ...(payload.review?.reasons || payload.review?.statusReasons || []),
            ...(((syncedQuestion as ImportedQuestionDraft).statusReasons || []) as string[]),
          ])),
        },
      } as unknown as Question;
    };

    const questionsForPublish = normalizedEntries.map(({ question, index }) => {
      const questionNumber = getImportedQuestionNumber(question, index + 1);
      const questionWithSupportImages = prepareImportedQuestionForCreate(normalizeCanceledImportedQuestion(buildIntroTextWithSupportImages(
        applyExamYearToQuestion(question, importMetadata),
      )));
      const draft = questionWithSupportImages as unknown as ImportedQuestionDraft;
      const payloadDraft = questionWithSupportImages as unknown as QuestionPayload & Record<string, unknown>;
      const referencedContextTempId = String(
        payloadDraft.source?.contextTempId
        || draft.contextKey
        || draft.grupoQuestaoTempId
        || draft.contextTempId
        || '',
      ).trim();
      const contextTempId = contextTempIdByQuestionNumber.get(questionNumber)
        || (referencedContextTempId && contextByTempId.has(referencedContextTempId) ? referencedContextTempId : '');

      if (!contextTempId) {
        const payloadRecord = questionWithSupportImages as unknown as QuestionPayload;
        return {
          ...questionWithSupportImages,
          source: {
            ...(payloadRecord.source || { origin: 'exam' }),
            questionNumber,
            contextTempId: undefined,
          },
          questionNumber,
          question_number: questionNumber,
          contextKey: draft.contextKey || '',
          grupoQuestaoTempId: draft.contextKey || undefined,
          contextTempId: draft.contextKey || undefined,
        } as Question;
      }

      const usedQuestionNumbers = usedQuestionNumbersByContextTempId.get(contextTempId) || new Set<number>();
      usedQuestionNumbers.add(questionNumber);
      usedQuestionNumbersByContextTempId.set(contextTempId, usedQuestionNumbers);

      return {
        ...questionWithSupportImages,
        source: {
          ...((questionWithSupportImages as unknown as QuestionPayload).source || { origin: 'exam' }),
          questionNumber,
          contextTempId,
        },
        questionNumber,
        question_number: questionNumber,
        contextKey: contextTempId,
        grupoQuestaoTempId: contextTempId,
        contextTempId,
      } as Question;
    });
    const selectedQuestionNumbers = new Set(
      questionsForPublish.map((question, index) => getImportedQuestionNumber(question, normalizedEntries[index]?.index + 1)),
    );
    const contextsForPublish = contextsForState
      .map((context) => ({
        ...context,
        questionNumbers: Array.from(new Set([
          ...context.questionNumbers.filter((questionNumber) => selectedQuestionNumbers.has(questionNumber)),
          ...Array.from(usedQuestionNumbersByContextTempId.get(context.tempId) || []),
        ])).sort((left, right) => left - right),
      }))
      .filter((context) => (
        context.questionNumbers.length > 0
        || usedQuestionNumbersByContextTempId.has(context.tempId)
      ));

    return {
      questionsForPublish,
      contextsForPublish,
      questionNumbers: Array.from(selectedQuestionNumbers),
      normalizedQuestions: normalizedImportState.questions,
      normalizedContexts: normalizedImportState.contexts,
    };
  };

  const prepareSelectedGranReviewPublication = (indexes: number[]) => {
    const published = new Set(publishedQuestionNumbers);
    const entries = Array.from(new Set(indexes)).sort((left, right) => left - right)
      .map((index) => ({ question: extractedQuestions[index], index }))
      .filter((entry): entry is { question: Question; index: number } => Boolean(entry.question))
      .filter(({ question, index }) => isQuestionReadyForImportPublication(question) && !published.has(getImportedQuestionNumber(question, index + 1)));
    const focus = resolveSelectedFocus() || resolveFirstQuestionFocus(extractedQuestions as unknown as Array<Record<string, unknown>>);
    const { agency, role, source, year } = readRequiredExamMetadata();
    if (entries.length === 0) return { error: 'Nenhuma questão selecionada está pronta para publicação.' };
    if (!focus) return { error: 'Selecione ou crie um foco antes de publicar.' };
    if (!agency || !year || !source || !role) return { error: 'Preencha Banca, Ano, Órgão e Cargo/Prova antes de publicar a prova.' };
    const prepared = buildQuestionPublishPayload(entries);
    const { exam } = buildImportExamPayload(prepared.questionsForPublish);
    return {
      questionNumbers: prepared.questionNumbers,
      payload: {
        schemaVersion: 'question-import.v2' as const,
        exam,
        focus: focus as Record<string, unknown>,
        contexts: buildImportedContextsForPublication(prepared.contextsForPublish, buildContextPublishContent),
        questions: prepared.questionsForPublish,
      },
    };
  };

  const applyGranReviewPublicationResult = (result: Record<string, unknown>) => {
    const created = Array.isArray(result.created) ? result.created as Question[] : [];
    const duplicates = Array.isArray(result.duplicatesSkipped) ? result.duplicatesSkipped : Array.isArray(result.duplicates_skipped) ? result.duplicates_skipped : [];
    const confirmed = Array.from(new Set([
      ...created.map((question) => getPublishedQuestionNumberFromRecord(question)).filter((number) => number > 0),
      ...duplicates.filter((item): item is Record<string, unknown> => Boolean(item && typeof item === 'object')).map(getPublishedQuestionNumberFromRecord).filter((number) => number > 0),
    ]));
    if (confirmed.length) setPublishedQuestionNumbers((previous) => Array.from(new Set([...previous, ...confirmed])).sort((left, right) => left - right));
    if (created.length) onImportedQuestionsSaved?.(created);
  };

  const validateExamBeforePublish = () => {
    const selectedFocus = resolveSelectedFocus()
      || resolveFirstQuestionFocus(extractedQuestions as unknown as Array<Record<string, unknown>>);
    if (!selectedFocus) {
      addToast('Selecione ou crie um foco antes de publicar.', 'error');
      return null;
    }

    const { agency, role, source, year } = readRequiredExamMetadata();
    if (!agency || !year || !source || !role) {
      addToast('Preencha Banca, Ano, Orgao e Cargo/Prova antes de publicar a prova.', 'error');
      return null;
    }

    return selectedFocus;
  };

  const handlePublishExamOnly = async () => {
    if (publishingActionRef.current) {
      return;
    }

    const selectedFocus = validateExamBeforePublish();
    if (!selectedFocus) {
      return;
    }
    if (!beginPublishingAction('exam')) {
      return;
    }

    try {
      const wasAlreadyPublished = Boolean(activePublishedExam && activePublishedExamId);
      const syncedExam = await ensurePublishedExamForQuestions(selectedFocus);
      if (wasAlreadyPublished) {
        addLog(`Prova #${selectedExam?.id || getPublishedExamId(syncedExam)} ja vinculada. Nenhuma prova duplicada foi criada.`);
        addToast('A prova selecionada já está vinculada ao lote.', 'success');
      } else {
        addToast('Prova publicada. Agora voce pode publicar as questoes vinculadas.', 'success');
      }
    } catch (error) {
      addToast(`Erro ao publicar prova: ${readErrorMessage(error)}`, 'error');
    } finally {
      finishPublishingAction('exam');
    }
  };

  const publishQuestionEntries = async (
    entries: Array<{ question: Question; index: number }>,
    action: ImportPublishAction,
  ) => {
    if (publishingActionRef.current) {
      return;
    }

    const selectedFocus = validateExamBeforePublish();
    if (!selectedFocus) {
      return;
    }
    if (entries.length === 0) {
      addToast('Nenhuma questao pendente para publicar.', 'info');
      return;
    }

    const incompleteEntries = entries.filter(({ question }) => !isQuestionReadyForImportPublication(question));
    if (incompleteEntries.length > 0) {
      addToast(
        `${incompleteEntries.length} questao(oes) ainda estao incompletas. Preencha enunciado, tipo, alternativas e gabarito antes de publicar.`,
        'error',
      );
      return;
    }

    if (!beginPublishingAction(action)) {
      return;
    }

    try {
      const ensuredExam = await ensurePublishedExamForQuestions(selectedFocus);
      const publishedExamId = getPublishedExamId(ensuredExam);
      if (!publishedExamId) {
        throw new Error('A prova nao retornou um ID valido para vincular as questoes.');
      }
      if (!activePublishedExam) {
        addLog(`Prova #${publishedExamId} publicada automaticamente antes das questoes selecionadas.`);
      }
      const {
        questionsForPublish,
        contextsForPublish,
        questionNumbers,
        normalizedQuestions,
        normalizedContexts,
      } = buildQuestionPublishPayload(entries);
      const { examName, exam } = buildImportExamPayload(questionsForPublish);
      const examPayloadForQuestionBatch = selectedExamRecord
        ? {
          id: publishedExamId,
          provaId: publishedExamId,
          prova_id: publishedExamId,
          publishedExamId,
          published_exam_id: publishedExamId,
          selectedExamId: publishedExamId,
          selected_exam_id: publishedExamId,
          linkOnly: true,
          link_only: true,
          preserveExistingExam: true,
          preserve_existing_exam: true,
        }
        : {
          ...exam,
          publishedExamId,
          provaId: publishedExamId,
          prova_id: publishedExamId,
        };
      const response = await questionService.createImportedQuestionBatch({
        schemaVersion: 'question-import.v2',
        exam: examPayloadForQuestionBatch,
        focus: selectedFocus as Record<string, unknown>,
        contexts: buildImportedContextsForPublication(contextsForPublish, buildContextPublishContent),
        questions: questionsForPublish,
        requireExistingExam: true,
      }, null);

      if (!response.success) {
        throw new Error(response.message || 'Falha ao salvar as questoes importadas.');
      }

      if (selectedExamRecord) {
        setPublishedExam(selectedExamRecord);
        addLog(`Prova #${publishedExamId} preservada: o lote foi apenas vinculado ao cadastro existente, sem atualizar metadados do Banco de Provas.`);
      } else {
        await syncPublishedExam((response.exam || ensuredExam) as Record<string, unknown>, examName);
      }
      setExtractedQuestions(normalizedQuestions);
      setExtractedContexts(normalizedContexts);
      if (response.created && response.created.length > 0) {
        onImportedQuestionsSaved?.(response.created);
      }
      const createdQuestionNumbers = (response.created || [])
        .map((question) => getPublishedQuestionNumberFromRecord(question))
        .filter((number) => number > 0);
      const alreadyExistingQuestionNumbers = (response.duplicatesSkipped || [])
        .filter((duplicate) => String(duplicate.reason || '') === 'already_exists')
        .map((duplicate) => getPublishedQuestionNumberFromRecord(duplicate))
        .filter((number) => number > 0);
      const confirmedQuestionNumbers = Array.from(new Set([
        ...createdQuestionNumbers,
        ...alreadyExistingQuestionNumbers,
      ]));
      const confirmedOrCountFallbackNumbers = confirmedQuestionNumbers.length > 0
        ? confirmedQuestionNumbers
        : Number(response.count || 0) > 0
          ? questionNumbers.slice(0, Number(response.count || 0))
          : [];

      if (entries.length > 0 && confirmedOrCountFallbackNumbers.length === 0 && !response.skippedDuplicateCount) {
        throw new Error('O backend respondeu com sucesso, mas nao confirmou nenhum item criado. A lista foi mantida para nova tentativa.');
      }

      if (confirmedOrCountFallbackNumbers.length > 0) {
        setPublishedQuestionNumbers((previous) => (
          Array.from(new Set([...previous, ...confirmedOrCountFallbackNumbers])).sort((left, right) => left - right)
        ));
      }

      let message = entries.length === 1 ? 'Questao publicada.' : `${entries.length} questao(oes) enviadas para publicacao.`;
      if (confirmedOrCountFallbackNumbers.length > 0 && confirmedOrCountFallbackNumbers.length < entries.length) {
        message += `\n\n${confirmedOrCountFallbackNumbers.length}/${entries.length} item(ns) confirmado(s) pelo backend. Os demais continuam pendentes na lista.`;
      }
      if (response.skippedDuplicateCount && response.skippedDuplicateCount > 0) {
        message += `\n\n${response.skippedDuplicateCount} questao(oes) duplicada(s) ignorada(s).`;
      }
      if (response.newTaxonomies?.length) {
        const createdTaxonomies = response.newTaxonomies
          .map((taxonomy) => [taxonomy.type, taxonomy.name].filter(Boolean).join(': '))
          .filter(Boolean);

        if (createdTaxonomies.length > 0) {
          message += `\n\nNovos itens criados: ${createdTaxonomies.join(', ')}`;
        }
      }

      addToast(message, 'success');
    } catch (error) {
      addToast(`Erro ao publicar questoes: ${readErrorMessage(error)}`, 'error');
    } finally {
      finishPublishingAction(action);
    }
  };

  const handlePublishAllQuestions = async () => {
    const publishedSet = new Set(publishedQuestionNumbers);
    const unpublishedEntries = extractedQuestions
      .map((question, index) => ({ question, index }))
      .filter(({ question, index }) => !publishedSet.has(getImportedQuestionNumber(question, index + 1)));
    const entries = unpublishedEntries.filter(({ question }) => isQuestionReadyForImportPublication(question));
    const skippedEntries = unpublishedEntries.filter(({ question }) => !isQuestionReadyForImportPublication(question));
    if (skippedEntries.length > 0) {
      addLog(
        `${skippedEntries.length} card(s) incompleto(s) não serão publicados. `
        + `${entries.length} questão(ões) completa(s) seguirão para publicação.`,
      );
      addToast(
        `${skippedEntries.length} pendente(s) será(ão) mantida(s) na revisão. Publicando somente ${entries.length} questão(ões) completa(s).`,
        entries.length > 0 ? 'warning' : 'error',
      );
    }
    if (entries.length === 0) {
      return;
    }

    await publishQuestionEntries(entries, 'questions');
  };

  const handlePublishSelectedQuestions = (indexes: number[]) => publishSelectedImportQuestionEntries({
    indexes,
    questions: extractedQuestions,
    publishedQuestionNumbers,
    getQuestionNumber: getImportedQuestionNumber,
    onSkipped: (skippedCount, readyCount) => addToast(`${skippedCount} seleção(ões) incompleta(s) foram mantidas na revisão. Publicando somente ${readyCount} questão(ões) pronta(s).`, readyCount > 0 ? 'warning' : 'error'),
    onEmpty: (emptySelection) => { if (emptySelection) addToast('Selecione ao menos uma questão pronta para publicar.', 'info'); },
    publish: (entries) => publishQuestionEntries(entries, 'questions'),
  });

  const handlePublishSingleQuestion = async (index: number) => {
    const question = extractedQuestions[index];
    if (!question) {
      addToast('Questao nao encontrada na revisao.', 'error');
      return;
    }

    const questionNumber = getImportedQuestionNumber(question, index + 1);
    if (publishedQuestionNumbers.includes(questionNumber)) {
      addToast('Esta questao ja foi publicada.', 'info');
      return;
    }

    await publishQuestionEntries([{ question, index }], `question:${questionNumber}`);
  };

  const replaceExtractedQuestion = (index: number, question: Question) => {
    setExtractedQuestions((previous) => {
      const next = [...previous];
      next[index] = refreshManuallyEditedImportQuestion(question);
      return next;
    });
  };

  const markExtractedQuestionReviewed = (index: number) => {
    const question = extractedQuestions[index];
    if (!question) {
      addToast('Questão não encontrada na revisão.', 'error');
      return;
    }

    const blockReasons = getQuestionPublicationBlockReasons(question);
    const questionNumber = getImportedQuestionNumber(question, index + 1);
    if (blockReasons.length > 0) {
      addToast(`A questão ${questionNumber} ainda tem pendências obrigatórias: ${blockReasons.map((reason) => reason.replace(/_/g, ' ')).join(', ')}.`, 'warning');
      return;
    }

    setExtractedQuestions((previous) => previous.map((currentQuestion, currentIndex) => {
      if (currentIndex !== index) {
        return currentQuestion;
      }

      const draft = currentQuestion as unknown as ImportedQuestionDraft;
      const quality: QuestionExtractionQuality = {
        ...(draft.qualityReport || draft.extractionQuality || {
          origin: inferQuestionExtractionOrigin(currentQuestion),
          confidence: 0.92,
          localized: true,
          complete: true,
          needsReview: false,
          reasons: [],
        }),
        complete: true,
        needsReview: false,
        reasons: [],
      };

      return {
        ...currentQuestion,
        status: 'ok',
        extractionStatus: 'ok',
        needsImportReview: false,
        statusReasons: [],
        validationReasons: [],
        rejectionReason: '',
        qualityReport: quality,
        extractionQuality: quality,
      } as unknown as Question;
    }));

    setImportDiagnostics((previous) => {
      const withoutQuestion = (numbers?: number[]) => (numbers || []).filter((number) => number !== questionNumber);
      const completeQuestionNumbers = Array.from(new Set([...(previous.completeQuestionNumbers || []), questionNumber]))
        .sort((left, right) => left - right);
      const incompleteQuestionNumbers = withoutQuestion(previous.incompleteQuestionNumbers);
      const placeholderQuestionNumbers = withoutQuestion(previous.placeholderQuestionNumbers);

      return {
        ...previous,
        completeQuestionNumbers,
        incompleteQuestionNumbers,
        missingQuestionNumbers: withoutQuestion(previous.missingQuestionNumbers),
        placeholderQuestionNumbers,
        visualPendingQuestionNumbers: withoutQuestion(previous.visualPendingQuestionNumbers),
        suspiciousQuestionNumbers: withoutQuestion(previous.suspiciousQuestionNumbers),
        completeCardsCount: completeQuestionNumbers.length,
        incompleteCardsCount: incompleteQuestionNumbers.filter((number) => !placeholderQuestionNumbers.includes(number)).length,
        placeholderCardsCount: placeholderQuestionNumbers.length,
      };
    });

    addToast(`Questão ${questionNumber} marcada como revisada.`, 'success');
  };

  const updateImportMetadataField = (field: ImportMetadataField, value: string) => {
    const metadataValue = field === 'subjects' ? parseSubjectsInput(value) : value;
    setImportMetadata((previous) => {
      const roleListPatch = field === 'role'
        ? {
          roles: normalizeRoleList(value),
          cargos: normalizeRoleList(value),
        }
        : {};
      const sourceListPatch = field === 'source'
        ? {
          sources: normalizeOrganizationList(value),
        }
        : {};
      const titlePatch = field === 'title'
        ? { examTitle: value }
        : field === 'examTitle'
          ? { title: value }
          : {};
      const nextMetadata = {
        ...(previous || {}),
        [field]: metadataValue,
        ...roleListPatch,
        ...sourceListPatch,
        ...titlePatch,
      } as ImportMetadata;

      return {
        ...nextMetadata,
        ...buildBookletMetadata(nextMetadata),
      } as ImportMetadata;
    });

    if (['agency', 'source', 'role', 'year', 'level', 'examType'].includes(field)) {
      setExtractedQuestions((previous) => previous.map((question) => (
        applySharedExamMetadataToQuestion(question, field, value)
      )));
    }
  };

  const updateExtractedQuestionField = (
    index: number,
    field: ExtractedQuestionEditableField,
    value: string,
  ) => {
    setExtractedQuestions((previous) => {
      const next = [...previous];
      const question = next[index];
      if (!question) {
        return previous;
      }

      if (field === 'subject' || field === 'topic' || field === 'specificSubject') {
        const current = getQuestionTaxonomyParts(question);
        const hierarchy = resolveTaxonomyHierarchy(
          field === 'subject' ? value : current.subject,
          field === 'topic' ? value : current.topic,
          field === 'specificSubject' ? value : current.specificSubject,
        );
        next[index] = {
          ...question,
          assuntos: buildResolvedSubjectTaxonomies(question, hierarchy),
        } as unknown as Question;
        return next;
      }

      if (field === 'agency') {
        next[index] = {
          ...question,
          bancas: value ? [createTaxonomyLabel(value, { sigla: value })] : [],
        } as unknown as Question;
        return next;
      }

      if (field === 'organization') {
        const organizations = normalizeOrganizationList(value);
        next[index] = {
          ...question,
          orgaos: organizations.map((organization) => createTaxonomyLabel(organization)),
        } as unknown as Question;
        return next;
      }

      if (field === 'role') {
        const roles = normalizeRoleList(value);
        next[index] = {
          ...question,
          cargos: roles.map((role) => createTaxonomyLabel(role, { descricao: role })),
        } as unknown as Question;
        return next;
      }

      if (field === 'year') {
        const parsedYear = Number(String(value).replace(/\D/g, ''));
        next[index] = {
          ...question,
          anos: Number.isFinite(parsedYear) && parsedYear > 0 ? [parsedYear] : [],
          year: Number.isFinite(parsedYear) && parsedYear > 0 ? parsedYear : undefined,
          ano: Number.isFinite(parsedYear) && parsedYear > 0 ? parsedYear : undefined,
        } as Question & { year?: number; ano?: number };
        return next;
      }

      if (field === 'level') {
        next[index] = {
          ...question,
          nivel: value || null,
          level: value || null,
          niveis: value ? [createTaxonomyLabel(value)] : [],
        } as Question & { niveis?: QuestionTaxonomyLabel[] };
        return next;
      }

      if (field === 'difficulty') {
        next[index] = {
          ...question,
          dificuldade: normalizeDifficulty(value),
          difficulty: value,
        } as Question;
        return next;
      }

      if (field === 'modality') {
        next[index] = refreshManuallyEditedImportQuestion({
          ...question,
          tipo: value,
          modality: value,
        } as Question);
        return next;
      }

      return next;
    });
  };

  const updateExtractedQuestionStatement = (index: number, value: string) => {
    setExtractedQuestions((previous) => {
      const next = [...previous];
      const question = next[index];
      if (!question) {
        return previous;
      }

      next[index] = refreshManuallyEditedImportQuestion(syncCanonicalQuestionPayload({
        ...question,
        content: {
          ...(question.content || { statement: '' }),
          statement: value,
        },
        enunciado: value,
        enunciado_clean: stripHtml(value),
      } as Question));
      return next;
    });
  };

  const updateExtractedQuestionIntroText = (index: number, value: string) => {
    setExtractedQuestions((previous) => {
      const next = [...previous];
      const question = next[index];
      if (!question) {
        return previous;
      }

      next[index] = syncCanonicalQuestionPayload({
        ...question,
        content: {
          ...(question.content || { statement: getQuestionStatementText(question) }),
          supportText: value,
        },
        introText: value,
        intro_text: value,
      } as Question);
      return next;
    });
  };

  const updateExtractedQuestionReferenceText = (index: number, value: string) => {
    setExtractedQuestions((previous) => {
      const next = [...previous];
      const question = next[index];
      if (!question) {
        return previous;
      }

      next[index] = syncCanonicalQuestionPayload({
        ...question,
        content: {
          ...(question.content || { statement: getQuestionStatementText(question) }),
          reference: value,
        },
        referenceText: value,
        reference_text: value,
      } as unknown as Question);
      return next;
    });
  };

  const updateExtractedQuestionOption = (questionIndex: number, optionIndex: number, value: string) => {
    setExtractedQuestions((previous) => {
      const next = [...previous];
      const question = next[questionIndex];
      if (!question || !Array.isArray(question.itens)) {
        return previous;
      }

      next[questionIndex] = refreshManuallyEditedImportQuestion(syncCanonicalQuestionPayload({
        ...question,
        itens: question.itens.map((item, index) => (
          index === optionIndex
            ? {
              ...item,
              corpo: value,
              corpo_clean: stripHtml(value),
            }
            : item
        )),
      } as Question));
      return next;
    });
  };

  const updateExtractedQuestionCorrectOption = (questionIndex: number, optionIndex: number) => {
    setExtractedQuestions((previous) => {
      const next = [...previous];
      const question = next[questionIndex];
      if (!question || optionIndex < 0 || optionIndex >= (Array.isArray(question.itens) ? question.itens.length : 0)) {
        return previous;
      }
      next[questionIndex] = refreshManuallyEditedImportQuestion(syncCanonicalQuestionPayload({
        ...question,
        correctOptionIndex: optionIndex,
        resposta: optionIndex + 1,
      } as Question));
      return next;
    });
  };

  const addExtractedQuestionOption = (questionIndex: number) => {
    setExtractedQuestions((previous) => {
      const next = [...previous];
      const question = next[questionIndex];
      if (!question) {
        return previous;
      }

      const currentItems = Array.isArray(question.itens) ? question.itens : [];
      const nextIndex = currentItems.length;
      if (nextIndex >= 10) {
        addToast('Limite de 10 alternativas por questao atingido.', 'error');
        return previous;
      }

      next[questionIndex] = refreshManuallyEditedImportQuestion(syncCanonicalQuestionPayload({
        ...question,
        itens: [
          ...currentItems,
          {
            id: nextIndex + 1,
            ordem: nextIndex + 1,
            rotulo: String.fromCharCode(65 + nextIndex),
            corpo: '',
            corpo_clean: '',
          },
        ],
        needsImportReview: true,
      } as Question));
      return next;
    });
  };

  const addExtractedQuestionSupportImage = (questionIndex: number, imageData: string, fileName = '') => {
    const cleanImageData = imageData.includes(',') ? imageData.split(',').pop() || imageData : imageData;
    setExtractedQuestions((previous) => {
      const next = [...previous];
      const question = next[questionIndex] as unknown as ImportedQuestionDraft | undefined;
      if (!question) {
        return previous;
      }

      const questionNumber = getExtractedQuestionNumber(question as Question, questionIndex + 1);
      const supportImages = Array.isArray(question.supportImages) ? question.supportImages : [];
      const nextSupportImages = [
        ...supportImages,
        {
          tempId: `manual-q-${questionNumber}-fig-${Date.now()}`,
          title: fileName || `Figura de apoio da questao ${questionNumber}`,
          imageData: cleanImageData,
          pageImageData: cleanImageData,
          manualCropApplied: true,
        },
      ];
      next[questionIndex] = syncCanonicalQuestionPayload({
        ...(next[questionIndex] as Question),
        assets: [
          ...(((next[questionIndex] as Question).assets || []).filter((asset) => asset.usage !== 'support')),
          ...nextSupportImages.map((image, imageIndex) => ({
            id: String(image.tempId || `img_${imageIndex + 1}`),
            type: 'image' as const,
            usage: 'support' as const,
            url: '',
            base64: image.imageData,
            alt: image.title,
            caption: image.title,
            sourcePage: null,
            order: imageIndex + 1,
          })),
        ],
        supportImages: nextSupportImages,
        needsImportReview: true,
      } as unknown as Question);
      return next;
    });
  };

  const updateExtractedQuestionOptionImage = (
    questionIndex: number,
    optionIndex: number,
    imageData: string,
  ) => {
    const cleanImageData = imageData.includes(',') ? imageData.split(',').pop() || imageData : imageData;
    setExtractedQuestions((previous) => previous.map((currentQuestion, currentIndex) => {
      if (currentIndex !== questionIndex || !Array.isArray(currentQuestion.itens)) {
        return currentQuestion;
      }

      return refreshManuallyEditedImportQuestion(syncCanonicalQuestionPayload({
        ...currentQuestion,
        hasImageItens: true,
        needsImportReview: true,
        itens: currentQuestion.itens.map((item, currentOptionIndex) => {
          if (currentOptionIndex !== optionIndex) {
            return item;
          }

          const label = item.rotulo || String.fromCharCode(65 + optionIndex);
          return {
            ...item,
            corpo: createVisualOptionHtml(label, cleanImageData),
            corpo_clean: stripHtml(item.corpo || '') || `Alternativa visual ${label}`,
            imageData: cleanImageData,
            pageImageData: cleanImageData,
            figureBox: { x: 0, y: 0, width: 1000, height: 1000 },
          };
        }),
      } as unknown as Question));
    }));
  };

  const removeExtractedQuestionOption = (questionIndex: number, optionIndex: number) => {
    setExtractedQuestions((previous) => {
      const next = [...previous];
      const question = next[questionIndex];
      if (!question || !Array.isArray(question.itens)) {
        return previous;
      }

      const currentItems = question.itens;
      if (currentItems.length <= 1) {
        addToast('A questao precisa manter pelo menos uma alternativa.', 'error');
        return previous;
      }

      const nextItems = currentItems
        .filter((_, index) => index !== optionIndex)
        .map((item, index) => ({
          ...item,
          id: index + 1,
          ordem: index + 1,
          rotulo: String.fromCharCode(65 + index),
        }));
      const currentCorrectIndex = Number((question as { correctOptionIndex?: unknown }).correctOptionIndex);
      const nextCorrectIndex = Number.isFinite(currentCorrectIndex)
        ? Math.max(0, Math.min(
          nextItems.length - 1,
          currentCorrectIndex > optionIndex ? currentCorrectIndex - 1 : currentCorrectIndex,
        ))
        : 0;

      next[questionIndex] = refreshManuallyEditedImportQuestion(syncCanonicalQuestionPayload({
        ...question,
        itens: nextItems,
        correctOptionIndex: nextCorrectIndex,
        resposta: nextCorrectIndex + 1,
        needsImportReview: true,
      } as Question));
      return next;
    });
  };

  const updateExtractedContextContent = (tempId: string, value: string) => {
    setExtractedContexts((previous) => previous.map((context) => (
      context.tempId === tempId
        ? {
          ...context,
          text: value,
        }
        : context
    )));
  };

  const updateExtractedContextField = (
    tempId: string,
    field: 'title' | 'text' | 'referenceText' | 'figureDescription',
    value: string,
  ) => {
    setExtractedContexts((previous) => previous.map((context) => (
      context.tempId === tempId
        ? {
          ...context,
          [field]: value,
        }
        : context
    )));
  };

  const updateExtractedContextQuestionNumbers = (tempId: string, questionNumbers: number[]) => {
    const uniqueNumbers = Array.from(new Set(
      questionNumbers
        .map((number) => Number(number))
        .filter((number) => Number.isFinite(number) && number > 0),
    )).sort((a, b) => a - b);
    const nextContexts = extractedContexts.map((context) => (
      context.tempId === tempId
        ? {
          ...context,
          questionNumbers: uniqueNumbers,
        }
        : context
    ));
    const targetContext = nextContexts.find((context) => context.tempId === tempId);
    const questionsWithUpdatedLinks = extractedQuestions.map((question, index) => {
      const questionNumber = getExtractedQuestionNumber(question, index + 1);
      const currentContextTempId = getQuestionContextTempId(question);
      if (targetContext && uniqueNumbers.includes(questionNumber)) {
        return attachQuestionContextLink(question, tempId, targetContext.title);
      }
      if (currentContextTempId === tempId) {
        return clearQuestionContextLink(question, tempId);
      }
      return question;
    });
    const normalizedState = normalizeQuestionContextUsage(
      questionsWithUpdatedLinks,
      new Map(nextContexts.map((context) => [context.tempId, { ...context }])),
    );
    setExtractedQuestions(normalizedState.questions);
    setExtractedContexts(normalizedState.contexts);
  };

  const updateExtractedContextImage = (tempId: string, imageData: string, fileName = '') => {
    const cleanImageData = imageData.includes(',') ? imageData.split(',').pop() || imageData : imageData;
    setExtractedContexts((previous) => previous.map((context) => (
      context.tempId === tempId
        ? (() => {
          const figureKey = context.figures?.[0]?.figureKey || `${tempId}-fig-01`;
          const hasInlineImage = /<img\b/i.test(context.text || '');
          const hasFigureMarker = new RegExp(`\\[FIGURA:\\s*${escapeRegExp(figureKey)}\\]`, 'i').test(context.text || '')
            || /\[FIGURA:\s*[-\w]+\]/i.test(context.text || '');
          const nextText = hasInlineImage || hasFigureMarker
            ? context.text
            : [context.text, `[FIGURA: ${figureKey}]`].filter(Boolean).join('\n\n');

          return {
          ...context,
          text: nextText,
          hasFigure: true,
          figureDescription: context.figureDescription || fileName || context.title || 'Figura vinculada ao contexto',
          imageData: cleanImageData,
          pageImageData: cleanImageData,
          figureBox: { x: 0, y: 0, width: 1000, height: 1000 },
          figures: [
            {
              figureKey,
              type: 'figure',
              description: context.figureDescription || fileName || context.title || 'Figura vinculada ao contexto',
              imageData: cleanImageData,
              pageImageData: cleanImageData,
              figureBox: { x: 0, y: 0, width: 1000, height: 1000 },
              page: context.page,
              order: 1,
            },
            ...(context.figures || []).filter((figure) => figure.figureKey !== figureKey),
          ],
          manualCropApplied: true,
          };
        })()
        : context
    )));
    addToast('Figura adicionada ao contexto.', 'success');
  };

  const addExtractedContext = () => {
    const tempId = `manual-context-${Date.now()}`;
    setExtractedContexts((previous) => [
      ...previous,
      {
        tempId,
        title: `Novo contexto ${previous.length + 1}`,
        text: '',
        referenceText: '',
        richText: '',
        questionNumbers: [],
        hasFigure: false,
        figureDescription: '',
        page: 0,
      },
    ]);
    addToast('Contexto criado. Vincule as questoes que devem usa-lo.', 'success');
  };

  const addExtractedContextForQuestion = (questionIndex: number) => {
    const question = extractedQuestions[questionIndex];
    if (!question) {
      addToast('Questao nao encontrada para vincular contexto.', 'error');
      return;
    }

    const questionNumber = getExtractedQuestionNumber(question, questionIndex + 1);
    const tempId = `manual-q-${questionNumber}-context-${Date.now()}`;
    setExtractedContexts((previous) => [
      ...previous,
      {
        tempId,
        title: `Texto de apoio da questao ${questionNumber}`,
        text: '',
        questionNumbers: [questionNumber],
        hasFigure: false,
        figureDescription: '',
        page: Number((question as ImportedQuestionDraft).sourcePage || 0),
      },
    ]);
    setExtractedQuestions((previous) => previous.map((currentQuestion, currentIndex) => (
      currentIndex === questionIndex
        ? {
          ...currentQuestion,
          contextKey: tempId,
          grupoQuestaoTempId: tempId,
          needsImportReview: true,
        } as Question
        : currentQuestion
    )));
    addToast('Contexto criado e vinculado a questao.', 'success');
  };

  const removeExtractedContext = (tempId: string) => {
    setExtractedContexts((previous) => previous.filter((context) => context.tempId !== tempId));
    setExtractedQuestions((previous) => previous.map((question) => {
      const draft = question as ImportedQuestionDraft;
      if (String(draft.contextKey || draft.grupoQuestaoTempId || '') !== tempId) {
        return question;
      }

      const next = { ...question } as ImportedQuestionDraft;
      delete next.contextKey;
      delete next.grupoQuestaoTempId;
      return next as Question;
    }));
    addToast('Contexto removido do lote.', 'success');
  };

  const updateExtractedQuestionSupportImageCrop = async (
    questionIndex: number,
    imageTempId: string,
    figureBox: FigureBox,
  ) => {
    const question = extractedQuestions[questionIndex] as unknown as ImportedQuestionDraft | undefined;
    const supportImages = Array.isArray(question?.supportImages) ? question.supportImages : [];
    const supportImage = supportImages.find((image) => image.tempId === imageTempId);
    if (!supportImage) {
      addToast('Figura de apoio nao encontrada nesta questao.', 'error');
      return;
    }
    if (!supportImage.pageImageData) {
      addToast('Pagina original desta figura nao esta disponivel para recorte.', 'error');
      return;
    }

    const normalizedBox = normalizeExtractionFigureBox(figureBox);
    if (!normalizedBox) {
      addToast('Recorte invalido.', 'error');
      return;
    }

    const imageData = await cropFigureImage(supportImage.pageImageData, normalizedBox, { manual: true });
    if (!imageData) {
      addToast('Nao foi possivel aplicar este recorte.', 'error');
      return;
    }

    setExtractedQuestions((previous) => previous.map((currentQuestion, currentIndex) => {
      if (currentIndex !== questionIndex) {
        return currentQuestion;
      }

      const draft = currentQuestion as unknown as ImportedQuestionDraft;
      return {
        ...currentQuestion,
        supportImages: (draft.supportImages || []).map((image) => (
          image.tempId === imageTempId
            ? {
              ...image,
              imageData,
              figureBox: normalizedBox,
              manualCropApplied: true,
            }
            : image
        )),
      } as unknown as Question;
    }));
    addToast('Recorte da figura de apoio aplicado.', 'success');
  };

  const removeExtractedQuestionSupportImage = (questionIndex: number, imageTempId: string) => {
    setExtractedQuestions((previous) => previous.map((question, currentIndex) => {
      if (currentIndex !== questionIndex) {
        return question;
      }

      const draft = question as unknown as ImportedQuestionDraft;
      return {
        ...question,
        supportImages: (draft.supportImages || []).filter((image) => image.tempId !== imageTempId),
      } as unknown as Question;
    }));
  };

  const updateExtractedQuestionOptionImageCrop = async (
    questionIndex: number,
    optionIndex: number,
    figureBox: FigureBox,
  ) => {
    const question = extractedQuestions[questionIndex];
    const option = question?.itens?.[optionIndex] as (
      | (NonNullable<Question['itens']>[number] & { pageImageData?: string; imageData?: string; figureBox?: FigureBox })
      | undefined
    );
    if (!question || !option) {
      addToast('Alternativa nao encontrada.', 'error');
      return;
    }
    const cropSourceImage = option.pageImageData || option.imageData || extractFirstInlineImageData(option.corpo);
    if (!cropSourceImage) {
      addToast('Imagem desta alternativa nao esta disponivel para recorte.', 'error');
      return;
    }

    const normalizedBox = normalizeExtractionFigureBox(figureBox);
    if (!normalizedBox) {
      addToast('Recorte invalido.', 'error');
      return;
    }

    const imageData = await cropFigureImage(cropSourceImage, normalizedBox, { manual: true });
    if (!imageData) {
      addToast('Nao foi possivel aplicar este recorte.', 'error');
      return;
    }

    setExtractedQuestions((previous) => previous.map((currentQuestion, currentIndex) => {
      if (currentIndex !== questionIndex || !Array.isArray(currentQuestion.itens)) {
        return currentQuestion;
      }

      return {
        ...currentQuestion,
        hasImageItens: true,
        itens: currentQuestion.itens.map((item, currentOptionIndex) => {
          if (currentOptionIndex !== optionIndex) {
            return item;
          }

          const label = item.rotulo || String.fromCharCode(65 + optionIndex);
          return {
            ...item,
            corpo: createVisualOptionHtml(label, imageData),
            corpo_clean: `Alternativa visual ${label}`,
            imageData,
            pageImageData: option.pageImageData || cropSourceImage,
            figureBox: normalizedBox,
          };
        }),
      } as unknown as Question;
    }));
    addToast('Recorte da alternativa aplicado.', 'success');
  };

  const removeExtractedQuestion = (index: number) => {
    setExtractedQuestions((previous) => {
      const question = previous[index];
      if (!question) {
        return previous;
      }

      const questionNumber = getExtractedQuestionNumber(question, index + 1);
      const isExpectedQuestion = importDiagnostics.expectedQuestionNumbers.includes(questionNumber);
      setExtractedContexts((contexts) => contexts
        .flatMap((context) => {
          if (!context.questionNumbers.includes(questionNumber)) {
            return [context];
          }

          const questionNumbers = context.questionNumbers.filter((number) => number !== questionNumber);
          return questionNumbers.length > 0 ? [{ ...context, questionNumbers }] : [];
        }));

      if (isExpectedQuestion) {
        const draft = question as unknown as ImportedQuestionDraft;
        const probablePages = draft.qualityReport?.probablePages
          || draft.extractionQuality?.probablePages
          || (Number(draft.sourcePage || 0) > 0 ? [Number(draft.sourcePage)] : []);
        const placeholder = createExpectedQuestionPlaceholder({
          questionNumber,
          probablePages,
          metadata: importMetadata || undefined,
          correctOptionIndex: Number.isInteger(Number(draft.correctOptionIndex))
            ? Number(draft.correctOptionIndex)
            : undefined,
          defaultFocus: resolveSelectedFocus() || undefined,
        });
        addToast(`O conteudo da questao ${questionNumber} foi limpo, mas o card foi mantido porque ela faz parte da prova esperada.`, 'info');
        return previous.map((item, currentIndex) => currentIndex === index ? placeholder : item);
      }

      addToast(`Questao ${questionNumber} removida do lote de importacao.`, 'success');
      return previous.filter((_, currentIndex) => currentIndex !== index);
    });
  };

  const updateContextFigureCrop = async (tempId: string, figureBox: FigureBox) => {
    const context = extractedContexts.find((item) => item.tempId === tempId);
    if (!context) {
      addToast('Contexto da figura nao encontrado.', 'error');
      return;
    }
    if (!context.pageImageData) {
      addToast('A pagina original desta figura nao esta disponivel para recorte manual.', 'error');
      return;
    }

    const normalizedBox = {
      x: Math.max(0, Math.min(1000, Number(figureBox.x) || 0)),
      y: Math.max(0, Math.min(1000, Number(figureBox.y) || 0)),
      width: Math.max(10, Math.min(1000, Number(figureBox.width) || 0)),
      height: Math.max(10, Math.min(1000, Number(figureBox.height) || 0)),
    };
    normalizedBox.width = Math.min(normalizedBox.width, 1000 - normalizedBox.x);
    normalizedBox.height = Math.min(normalizedBox.height, 1000 - normalizedBox.y);

    const imageData = await cropFigureImage(context.pageImageData, normalizedBox, { manual: true });
    if (!imageData) {
      addToast('Nao foi possivel aplicar este recorte. Ajuste a area e tente novamente.', 'error');
      return;
    }

    setExtractedContexts((previous) => previous.map((item) => (
      item.tempId === tempId
        ? (() => {
          const figureKey = item.figures?.[0]?.figureKey || `${tempId}-fig-01`;
          const hasInlineImage = /<img\b/i.test(item.text || '');
          const hasFigureMarker = new RegExp(`\\[FIGURA:\\s*${escapeRegExp(figureKey)}\\]`, 'i').test(item.text || '')
            || /\[FIGURA:\s*[-\w]+\]/i.test(item.text || '');
          const nextText = hasInlineImage || hasFigureMarker
            ? item.text
            : [item.text, `[FIGURA: ${figureKey}]`].filter(Boolean).join('\n\n');

          return {
          ...item,
          text: nextText,
          imageData,
          figureBox: normalizedBox,
          hasFigure: true,
          figures: [
            {
              figureKey,
              type: 'figure',
              description: item.figureDescription || item.title || 'Figura vinculada ao contexto',
              imageData,
              pageImageData: item.pageImageData,
              figureBox: normalizedBox,
              page: item.page,
              order: 1,
            },
            ...(item.figures || []).filter((figure) => figure.figureKey !== figureKey),
          ],
          manualCropApplied: true,
          };
        })()
        : item
    )));
    addLog(`Recorte da figura "${context.title}" atualizado manualmente.`);
    addToast('Recorte aplicado ao contexto. Confira o preview antes de publicar.', 'success');
  };

  return {
    qFile,
    setQFile,
    kFile,
    setKFile,
    examBank,
    isLoadingExamBank,
    selectedExamId,
    handleSelectedExamIdChange,
    selectedExamFocusLabel: selectedExamFocus ? getTaxonomyText(selectedExamFocus) : '',
    inheritedProofFileName,
    inheritedAnswerKeyFileName,
    selectedFocusId,
    setSelectedFocusId,
    manualFocusName,
    setManualFocusName,
    importMetadata,
    importDiagnostics,
    extractedContexts,
    isProcessing,
    extractWithComment,
    setExtractWithComment,
    extractWithDetailedAnalysis,
    setExtractWithDetailedAnalysis,
    examProgress,
    keyProgress,
    logs,
    extractedQuestions,
    isBulkGenerating,
    bulkGenerationType,
    isRetryingMissingQuestions,
    bulkProgress,
    publishedExam: activePublishedExam,
    publishedQuestionNumbers,
    publishingAction,
    generatingSpecific,
    handleImportProcess,
    handleBulkGenerateDetailed,
    handleBulkGenerateTeacher,
    handleRetryMissingQuestions,
    handleParseQuestionsFromText,
    handleImportFromAiJson,
    handleImportExternalEditorialJson,
    handleGenerateSpecific,
    handlePublishExamOnly,
    handlePublishAllQuestions,
    handlePublishSelectedQuestions,
    handlePublishSingleQuestion,
    prepareSelectedGranReviewPublication,
    applyGranReviewPublicationResult,
    updateImportMetadataField,
    updateExtractedQuestionField,
    updateExtractedQuestionStatement,
    updateExtractedQuestionIntroText,
    updateExtractedQuestionReferenceText,
    updateExtractedQuestionOption,
    updateExtractedQuestionCorrectOption,
    addExtractedQuestionOption,
    removeExtractedQuestionOption,
    addExtractedQuestionSupportImage,
    updateExtractedQuestionOptionImage,
    addExtractedContext,
    addExtractedContextForQuestion,
    removeExtractedContext,
    updateExtractedContextContent,
    updateExtractedContextField,
    updateExtractedContextQuestionNumbers,
    updateExtractedContextImage,
    updateExtractedQuestionSupportImageCrop,
    removeExtractedQuestionSupportImage,
    updateExtractedQuestionOptionImageCrop,
    markExtractedQuestionReviewed,
    replaceExtractedQuestion,
    removeExtractedQuestion,
    updateContextFigureCrop,
  };
};

export const __examImportParserTestApi = {
  auditQuestionCoverage,
  buildAdaptiveExamParserProfile,
  buildExamTitle,
  buildImportExamTaxonomyMetadata,
  buildPageContentInventory,
  createMechanicalExtractionFromText,
  decideAiExtractionForPage,
  estimatePdfQuestionRegionBox,
  estimatePdfResourceRegionBox,
  enrichMechanicalExtractionFromInventory,
  extractContextsFromPageInventory,
  extractExplicitContextQuestionNumbers,
  extractionLikelyNeedsSupportContextFallback,
  extractionNeedsAi,
  extractQuestionNumbersFromText,
  findCarryoverTextContextForQuestion,
  findQuestionMarkers,
  formatStructuredSupportHtml,
  getExtractedQuestionNumber,
  inferExpectedOptionsCountFromText,
  inferProbablePagesForMissingQuestion,
  ensureExpectedQuestionDrafts,
  isQuestionReadyForImportPublication,
  mergeExtractionContextList,
  normalizeAiQuestionOptions,
  externalDetailedCommentIsGeneric,
  parseAnswerKeyFromText,
  resolveExamParserProfile,
  textNeedsExternalSupportContext,
};

