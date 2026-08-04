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
  Question,
  QuestionPayload,
  QuestionSourcePayload,
  QuestionTaxonomyLabel,
  SystemSettings,
} from '@types';
import type { PageExtractionResult } from '@services/questions';
import {
  ENEM_SUBJECT_AREA_DESCRIPTIONS,
  ENEM_SUBJECT_AREA_OPTIONS,
} from '@services/filters';

export type PdfJsModule = typeof import('pdfjs-dist/legacy/build/pdf.mjs');
export type PdfDocumentProxy = Awaited<ReturnType<PdfJsModule['getDocument']>['promise']>;

export type GenerateSpecificType = 'teacher' | 'detailed';
export type ImportPublishAction = 'exam' | 'questions' | `question:${number}`;

export interface ImportedQuestionDraft extends Partial<Question> {
  importTempId?: string;
  questionCreatePayload?: QuestionPayload;
  text?: string;
  number?: number | string;
  questionNumber?: number | string;
  question_number?: number | string;
  isQuestion?: boolean;
  rejectionReason?: string;
  supportText?: string;
  referenceText?: string;
  contextKey?: string;
  grupoQuestaoTempId?: string | number;
  contextTempId?: string | number;
  contextTitle?: string;
  contextScope?: string;
  sourcePage?: number | string;
  needsImportReview?: boolean;
  hasFigure?: boolean;
  figureDescription?: string;
  figureBox?: FigureBox;
  supportFigureBox?: FigureBox;
  supportFigureBoxes?: FigureBox[];
  optionFigureBox?: FigureBox;
  optionFigureBoxes?: FigureBox[];
  supportImages?: ImportedQuestionImageDraft[];
  imageDescriptions?: string[];
  modality?: ImportedQuestionType;
  expectedOptionsCount?: number | string;
  expected_options_count?: number | string;
  correctOptionIndex?: number;
  anulada?: boolean;
  isCanceled?: boolean;
  isCancelled?: boolean;
  isCanceledQuestion?: boolean;
  isCancelledQuestion?: boolean;
  is_cancelled?: boolean;
  isAttributedToAll?: boolean;
  attributedToAll?: boolean;
  is_attributed_to_all?: boolean;
  subject?: string;
  topic?: string;
  specificSubject?: string;
  options?: string[];
  difficulty?: string;
  raw?: string;
  status?: 'ok' | 'incompleta' | 'revisar';
  extractionStatus?: 'ok' | 'incompleta' | 'revisar';
  questionType?: ImportedQuestionType;
  statusReasons?: ImportedQuestionStatusReason[];
  validationReasons?: ImportedQuestionStatusReason[];
  fieldMetadata?: Partial<Record<string, ExtractionFieldMetadata>>;
  extractionFieldMetadata?: Partial<Record<string, ExtractionFieldMetadata>>;
  qualityReport?: QuestionExtractionQuality;
  extractionQuality?: QuestionExtractionQuality;
}

export interface QuestionCreateImportCardParams {
  tempId?: string;
  source?: QuestionSourcePayload;
  questionNumber: number;
  statement: string;
  introText: string;
  referenceText: string;
  teacherComment: string;
  detailedComment: string;
  contextKey: string;
  bancas: QuestionTaxonomyLabel[];
  orgaos: QuestionTaxonomyLabel[];
  cargos: QuestionTaxonomyLabel[];
  assuntos: Question['assuntos'];
  anos: Question['anos'];
  carreiras: NonNullable<Question['carreiras']>;
  niveis: QuestionTaxonomyLabel[];
  nivel?: Question['nivel'];
  tiposProva: Array<number | QuestionTaxonomyLabel>;
  tipo: string;
  dificuldade: number;
  itens: Question['itens'];
  resposta: number;
  correctOptionIndex?: number;
  hasFigure: boolean;
  figureDescription?: string;
  supportImages: ImportedQuestionImageDraft[];
  status: ImportedQuestionStatus;
  needsImportReview: boolean;
  reasons: ImportedQuestionStatusReason[];
  quality: QuestionExtractionQuality;
}

export type ExtractionFieldMetadata = {
  origin: 'mechanical' | 'ai' | 'manual';
  confidence: number;
  sourcePage?: number;
  sourceBox?: FigureBox;
};

export type QuestionExtractionOrigin = 'mechanical' | 'ai' | 'hybrid' | 'manual' | 'placeholder';

export interface QuestionExtractionQuality {
  origin: QuestionExtractionOrigin;
  confidence: number;
  complete: boolean;
  localized: boolean;
  needsReview: boolean;
  reasons: string[];
  probablePages?: number[];
}

export const EXAM_IMPORT_PARSER_VERSION = 'positioned-pdf-v3';

export interface ImportMetadata extends NonNullable<PageExtractionResult['metadata']> {
  hash_id?: string;
  subjects?: string[];
  title?: string;
  examTitle?: string;
  name?: string;
  nome?: string;
  ano?: string | number;
  organization?: string;
  organizations?: unknown[];
  orgao?: string;
  role?: string;
  cargo?: string;
  roles?: string[];
  cargos?: string[];
  level?: string;
  nivel?: string;
  focos?: unknown[];
  source?: string;
  sources?: string[];
  orgaos?: unknown[];
  caderno?: string;
  booklet?: string;
  tipoCaderno?: string;
  corCaderno?: string;
  bookletType?: string;
  bookletColor?: string;
  cadernoTipo?: string;
  cadernoCor?: string;
  totalQuestions?: string | number;
  total_questions?: string | number;
  totalQuestoes?: string | number;
  questionCount?: string | number;
  questionStart?: string | number;
  questionEnd?: string | number;
  startQuestion?: string | number;
  endQuestion?: string | number;
  firstQuestionNumber?: string | number;
  lastQuestionNumber?: string | number;
  numeroInicial?: string | number;
  numeroFinal?: string | number;
  questaoInicial?: string | number;
  questaoFinal?: string | number;
  intervaloQuestoes?: unknown;
  questionRange?: unknown;
  registrationStart?: string;
  registrationEnd?: string;
  examDate?: string;
  registrationFee?: string;
  dataInscricaoInicio?: string;
  dataInscricaoFim?: string;
  dataProva?: string;
  valorInscricao?: string;
  requirements?: unknown[];
  requirementsDetailed?: unknown[];
  requisitos?: unknown[];
  requisitosDetalhados?: unknown[];
  remunerations?: unknown[];
  remunerationsDetailed?: unknown[];
  remuneracoes?: unknown[];
  remuneracoesDetalhadas?: unknown[];
  vacancies?: unknown[];
  vacanciesDetailed?: unknown[];
  vagas?: unknown[];
  vagasDetalhadas?: unknown[];
  programmaticContent?: unknown[];
  programmaticContentDetailed?: unknown[];
  conteudoProgramatico?: unknown[];
  conteudoProgramaticoDetalhado?: unknown[];
  stages?: unknown[];
  etapas?: unknown[];
  platformQuestionIds?: unknown[];
  questoesVinculadas?: unknown[];
}

export interface FigureBox {
  x?: number | string;
  y?: number | string;
  width?: number | string;
  height?: number | string;
}

export interface UseAdminImportWorkflowOptions {
  enabled?: boolean;
  systemSettings: SystemSettings;
  addToast: (message: string, type?: string) => void;
  onImportedQuestionsSaved?: (questions: Question[]) => void;
  updateSystemSettings?: (settings: SystemSettings) => Promise<unknown> | unknown;
  saveSystemSettingsNow?: (settings?: SystemSettings) => Promise<unknown> | unknown;
}

export interface ImportedContextDraft {
  tempId: string;
  externalKey?: string;
  title: string;
  text: string;
  referenceText?: string;
  richText?: string;
  questionNumbers: number[];
  hasFigure: boolean;
  figureDescription: string;
  page: number;
  sourcePage?: number;
  imageData?: string;
  pageImageData?: string;
  figureBox?: FigureBox;
  figures?: Array<{
    figureKey: string;
    type?: string;
    description?: string;
    imageData?: string;
    pageImageData?: string;
    figureBox?: FigureBox;
    page?: number;
    order?: number;
  }>;
  manualCropApplied?: boolean;
}

export interface ImportedQuestionImageDraft {
  tempId: string;
  title: string;
  description?: string;
  url?: string;
  usage?: 'statement' | 'support' | 'alternative' | 'context' | 'reference';
  imageData?: string;
  pageImageData?: string;
  figureBox?: FigureBox;
  page?: number;
  manualCropApplied?: boolean;
}

export interface ImportDiagnostics {
  expectedQuestionNumbers: number[];
  extractedQuestionNumbers: number[];
  localizedQuestionNumbers: number[];
  completeQuestionNumbers: number[];
  incompleteQuestionNumbers: number[];
  missingQuestionNumbers: number[];
  placeholderQuestionNumbers: number[];
  visualPendingQuestionNumbers: number[];
  duplicateQuestionNumbers: number[];
  suspiciousQuestionNumbers: number[];
  cardsCreatedCount: number;
  completeCardsCount: number;
  incompleteCardsCount: number;
  placeholderCardsCount: number;
  aiLimitReached?: boolean;
  aiTokenLimitReached?: boolean;
  aiQuotaLimitReached?: boolean;
  aiCallCount?: number;
  aiCallLimit?: number;
  aiCallsSkipped?: number;
  aiCallsSavedEstimate?: number;
  aiLimitedPages?: number[];
  aiTokenLimitPages?: number[];
  aiQuotaLimitPages?: number[];
  pagesWithoutNativeText?: number[];
  lowConfidencePages?: number[];
  orphanContentBlocks?: PageContentBlock[];
  aiLimitMessage?: string;
  aiTokenLimitMessage?: string;
  aiQuotaLimitMessage?: string;
}

export interface ImportAiBudget {
  maxCalls: number;
  usedCalls: number;
  reservedCalls: number;
  skippedCalls: number;
  failedCalls: number;
  cacheHits: number;
  exhausted: boolean;
}

export interface ImportAiCallReservation {
  purpose: string;
  cacheKey: string;
  callNumber: number;
}

export type AiExtractionPurpose =
  | 'none'
  | 'scanned_page'
  | 'missing_question'
  | 'incomplete_question'
  | 'visual_question'
  | 'context_repair'
  | 'layout_repair'
  | 'answer_key_repair';

export interface AiExtractionDecision {
  useAi: boolean;
  purpose: AiExtractionPurpose;
  targetQuestionNumbers: number[];
  targetPages: number[];
  cropBox?: FigureBox;
  priority: number;
  reasons: string[];
}

export interface PdfTextHighlight {
  text: string;
  bold: boolean;
  italic: boolean;
  underline: boolean;
}

export interface PdfPageRichText {
  plainText: string;
  richText: string;
  highlights: PdfTextHighlight[];
  hasHighlights: boolean;
  pageNumber?: number;
  items?: PositionedPdfTextItem[];
  lines?: PdfTextLine[];
  blocks?: PdfTextBlock[];
  columns?: PdfTextColumn[];
  pageType?: PdfPageData['pageType'];
  nativeTextCoverage?: number;
  layoutConfidence?: number;
  renderedPageData?: string;
  contentBlocks?: PageContentBlock[];
}

export type PositionedPdfTextItem = {
  text: string;
  pageNumber: number;
  rawIndex: number;
  x: number;
  y: number;
  width: number;
  height: number;
  normalizedX: number;
  normalizedY: number;
  normalizedWidth: number;
  normalizedHeight: number;
  fontName?: string;
  fontSize?: number;
  bold: boolean;
  italic: boolean;
  underline: boolean;
  hasEOL: boolean;
};

export type PdfTextLine = {
  text: string;
  richText: string;
  pageNumber: number;
  index: number;
  items: PositionedPdfTextItem[];
  x: number;
  y: number;
  width: number;
  height: number;
  normalizedX: number;
  normalizedY: number;
  normalizedWidth: number;
  normalizedHeight: number;
  columnIndex?: number;
};

export type PdfTextBlock = {
  text: string;
  richText: string;
  pageNumber: number;
  index: number;
  lines: PdfTextLine[];
  x: number;
  y: number;
  width: number;
  height: number;
  normalizedX: number;
  normalizedY: number;
  normalizedWidth: number;
  normalizedHeight: number;
  columnIndex?: number;
};

export type PdfTextColumn = {
  pageNumber: number;
  index: number;
  lines: PdfTextLine[];
  blocks: PdfTextBlock[];
  x: number;
  width: number;
  normalizedX: number;
  normalizedWidth: number;
};

export type PdfPageData = {
  pageNumber: number;
  plainText: string;
  richText: string;
  items: PositionedPdfTextItem[];
  lines: PdfTextLine[];
  blocks: PdfTextBlock[];
  columns: PdfTextColumn[];
  pageType:
    | 'cover'
    | 'instructions'
    | 'question_page'
    | 'context_page'
    | 'answer_key'
    | 'discursive'
    | 'blank'
    | 'unknown';
  nativeTextCoverage: number;
  layoutConfidence: number;
  renderedPageData?: string;
  contentBlocks?: PageContentBlock[];
};

export type PageContentBlockType =
  | 'question_marker'
  | 'question_text'
  | 'option'
  | 'shared_context'
  | 'individual_support'
  | 'reference'
  | 'figure'
  | 'table'
  | 'header'
  | 'footer'
  | 'instruction'
  | 'unknown';

export type PageContentBlock = {
  id: string;
  pageNumber: number;
  type: PageContentBlockType;
  text: string;
  richText?: string;
  boundingBox: FigureBox;
  columnIndex?: number;
  confidence: number;
  linkedQuestionNumbers?: number[];
  reasons: string[];
};

export type ImportMetadataField = keyof ImportMetadata;
export type ExtractedQuestionEditableField =
  | 'subject'
  | 'topic'
  | 'specificSubject'
  | 'agency'
  | 'organization'
  | 'role'
  | 'year'
  | 'level'
  | 'difficulty'
  | 'modality';

export let pdfJsModulePromise: Promise<PdfJsModule> | null = null;

export const loadPdfJsModule = async (): Promise<PdfJsModule> => {
  if (!pdfJsModulePromise) {
    pdfJsModulePromise = import('pdfjs-dist/legacy/build/pdf.mjs').then((module) => {
      module.GlobalWorkerOptions.workerSrc = new URL(
        'pdfjs-dist/legacy/build/pdf.worker.min.mjs',
        import.meta.url,
      ).toString();

      return module;
    });
  }

  return pdfJsModulePromise;
};

export const readErrorMessage = (error: unknown) => {
  const candidate = error as {
    message?: string;
    response?: {
      status?: number;
      statusText?: string;
      data?: unknown;
    };
  };
  const data = candidate?.response?.data;
  const dataMessage = typeof data === 'string'
    ? data
    : data && typeof data === 'object'
      ? [
        (data as { message?: unknown }).message,
        (data as { error?: unknown }).error,
        (data as { detail?: unknown }).detail,
        (data as { details?: unknown }).details,
      ]
        .map((value) => (typeof value === 'string' ? value : ''))
        .find(Boolean)
      : '';
  const status = candidate?.response?.status;
  const fallback = error instanceof Error ? error.message : 'Erro inesperado.';
  return dataMessage || (status ? `${fallback} (${status})` : fallback);
};

export const isAiTokenLimitError = (error: unknown) => {
  const message = readErrorMessage(error).toLowerCase();
  return /token|tokens|context|contexto|context length|janela de contexto|max[_ -]?tokens|too long|input too large|payload too large|request entity too large|limite de contexto|limite de tokens|excedeu.*token|excede.*token|excedeu.*contexto|excede.*contexto/.test(message);
};

export const isAiQuotaLimitError = (error: unknown) => {
  const message = readErrorMessage(error).toLowerCase();
  return /quota|cota|rate limit|rate-limit|resource exhausted|too many requests|429|limite de cota|quota exceeded|exceeded for metric|quota exceeded for metric|requests per minute|tokens per minute|rpm|tpm/.test(message);
};

export const readExpectedQuestionTotal = (...values: unknown[]) => {
  for (const value of values) {
    if (typeof value === 'number' && Number.isFinite(value) && value > 0) {
      return Math.round(value);
    }

    const text = typeof value === 'string'
      ? value
      : value && typeof value === 'object'
        ? String((value as { totalQuestions?: unknown }).totalQuestions
          || (value as { totalQuestoes?: unknown }).totalQuestoes
          || (value as { questionCount?: unknown }).questionCount
          || '')
        : '';
    const match = text.replace(/\./g, '').match(/\b(\d{1,4})\b/);
    const parsed = match ? Number(match[1]) : 0;
    if (Number.isFinite(parsed) && parsed > 0 && parsed <= 1000) {
      return Math.round(parsed);
    }
  }

  return 0;
};

export const buildSequentialQuestionNumbers = (total: number) => Array.from(
  { length: Math.max(0, Math.round(total)) },
  (_, index) => index + 1,
);

export const buildInclusiveQuestionNumbers = (start: number, end: number) => {
  const normalizedStart = Math.round(start);
  const normalizedEnd = Math.round(end);
  if (
    !Number.isFinite(normalizedStart)
    || !Number.isFinite(normalizedEnd)
    || normalizedStart <= 0
    || normalizedEnd < normalizedStart
    || normalizedEnd - normalizedStart > 1000
  ) {
    return [];
  }

  return Array.from(
    { length: normalizedEnd - normalizedStart + 1 },
    (_, index) => normalizedStart + index,
  );
};

export const readPositiveQuestionNumber = (value: unknown) => {
  if (typeof value === 'number' && Number.isFinite(value) && value > 0) {
    return Math.round(value);
  }

  const text = typeof value === 'string'
    ? value
    : value && typeof value === 'object'
      ? JSON.stringify(value)
      : '';
  const match = text.replace(/\./g, '').match(/\b(\d{1,4})\b/);
  const parsed = match ? Number(match[1]) : 0;
  return Number.isFinite(parsed) && parsed > 0 && parsed <= 1000 ? Math.round(parsed) : 0;
};

export const resolveQuestionRangeFromMetadata = (metadata: Record<string, unknown> | null | undefined) => {
  const rangeRecord = toLooseRecord(readLooseField(metadata, [
    'questionRange',
    'intervaloQuestoes',
    'intervalo_questoes',
    'rangeQuestoes',
    'faixaQuestoes',
    'faixa_questoes',
  ]));

  const start = readPositiveQuestionNumber(readLooseField(metadata, [
    'questionStart',
    'startQuestion',
    'firstQuestionNumber',
    'numeroInicial',
    'questaoInicial',
    'questãoInicial',
    'primeiraQuestao',
    'primeiraQuestão',
  ]) || readLooseField(rangeRecord, ['start', 'inicio', 'início', 'from', 'de', 'first']));

  const end = readPositiveQuestionNumber(readLooseField(metadata, [
    'questionEnd',
    'endQuestion',
    'lastQuestionNumber',
    'numeroFinal',
    'questaoFinal',
    'questãoFinal',
    'ultimaQuestao',
    'últimaQuestão',
  ]) || readLooseField(rangeRecord, ['end', 'fim', 'to', 'ate', 'até', 'last']));

  return { start, end };
};

export const resolveExpectedQuestionNumbersForImport = ({
  declaredTotal,
  metadata,
  questionNumbers,
}: {
  declaredTotal: number;
  metadata?: Record<string, unknown> | null;
  questionNumbers: number[];
}) => {
  const uniqueQuestionNumbers = Array.from(new Set(
    questionNumbers
      .map((number) => Math.round(Number(number)))
      .filter((number) => Number.isFinite(number) && number > 0),
  )).sort((left, right) => left - right);

  const normalizedTotal = Number.isFinite(declaredTotal) && declaredTotal > 0
    ? Math.round(declaredTotal)
    : 0;
  const { start, end } = resolveQuestionRangeFromMetadata(metadata);

  if (start > 0 && end >= start) {
    return buildInclusiveQuestionNumbers(start, end);
  }

  if (start > 0 && normalizedTotal > 0) {
    return buildInclusiveQuestionNumbers(start, start + normalizedTotal - 1);
  }

  if (end > 0 && normalizedTotal > 0) {
    return buildInclusiveQuestionNumbers(Math.max(1, end - normalizedTotal + 1), end);
  }

  if (uniqueQuestionNumbers.length > 0) {
    const minQuestionNumber = uniqueQuestionNumbers[0];
    const maxQuestionNumber = uniqueQuestionNumbers[uniqueQuestionNumbers.length - 1];

    if (normalizedTotal > 0 && minQuestionNumber > 1) {
      const observedSpan = maxQuestionNumber - minQuestionNumber + 1;
      if (observedSpan === normalizedTotal) {
        return buildInclusiveQuestionNumbers(minQuestionNumber, maxQuestionNumber);
      }

      if (uniqueQuestionNumbers.length <= normalizedTotal) {
        return buildInclusiveQuestionNumbers(minQuestionNumber, minQuestionNumber + normalizedTotal - 1);
      }
    }

    if (normalizedTotal <= 0) {
      return uniqueQuestionNumbers;
    }
  }

  return normalizedTotal > 0 ? buildSequentialQuestionNumbers(normalizedTotal) : uniqueQuestionNumbers;
};

export const stripHtml = (value: string) => value.replace(/<[^>]*>?/gm, '');

export const escapeHtml = (value: string) => String(value || '')
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&#39;');

export const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
export const blockHtmlPattern = /<\/?(?:p|div|h[1-6]|ul|ol|li|table|figure|figcaption|blockquote|pre|section|article)\b/i;
export const safeInlineHtmlPattern = /<\/?(?:strong|em|u|b|i|mark)\b[^>]*>|<br\s*\/?>/gi;

export const normalizeStructuredText = (value: string) => String(value || '')
  .replace(/\r\n?/g, '\n')
  .replace(/\u00A0/g, ' ')
  .split('\n')
  .map((line) => line.replace(/[ \t]+/g, ' ').trim())
  .join('\n')
  .replace(/\n{3,}/g, '\n\n')
  .trim();

export const normalizeInlineText = (value: string) => String(value || '')
  .replace(/\s+/g, ' ')
  .trim();

export const normalizeSafeInlineTag = (tag: string) => {
  const normalized = tag.toLowerCase().replace(/\s+/g, ' ').trim();
  if (/^<br\s*\/?>$/.test(normalized)) return '<br />';
  const closing = /^<\//.test(normalized);
  const name = normalized.match(/^<\/?\s*([a-z0-9]+)/)?.[1] || '';
  if (name === 'b') return closing ? '</strong>' : '<strong>';
  if (name === 'i') return closing ? '</em>' : '<em>';
  if (['strong', 'em', 'u', 'mark'].includes(name)) {
    return closing ? `</${name}>` : `<${name}>`;
  }
  return '';
};

export const escapeStructuredTextPreservingInlineHtml = (value: string) => {
  const tokens: string[] = [];
  const safeTags: string[] = [];
  const tokenized = String(value || '').replace(safeInlineHtmlPattern, (tag) => {
    const safeTag = normalizeSafeInlineTag(tag);
    if (!safeTag) {
      return '';
    }
    const token = `__CM_SAFE_INLINE_${tokens.length}__`;
    tokens.push(token);
    safeTags.push(safeTag);
    return token;
  });

  return tokens.reduce(
    (current, token, index) => current.replaceAll(token, safeTags[index] || ''),
    escapeHtml(tokenized),
  );
};

export const isLikelySupportTitleLine = (value: string) => {
  const clean = stripHtml(value).replace(/\s+/g, ' ').trim();
  if (!clean || clean.length > 120) {
    return false;
  }

  if (/^(?:TEXTOS?\s+(?:[IVXLC]+|\d+)|Texto\s+[A-Z0-9]+|Figura|Imagem|Tirinha|Charge|Gr[aá]fico|Tabela|Mapa|Quadro)\b/i.test(clean)) {
    return true;
  }

  const letters = clean.replace(/[^\p{L}]/gu, '');
  const uppercaseLetters = letters.replace(/[^\p{Lu}]/gu, '');
  return letters.length >= 5 && uppercaseLetters.length / letters.length > 0.72;
};

export const isLikelyAuthorLine = (value: string) => {
  const clean = stripHtml(value).replace(/\s+/g, ' ').trim();
  if (!clean || clean.length > 90 || /[.!?:;]$/.test(clean)) {
    return false;
  }

  const words = clean.split(/\s+/).filter(Boolean);
  if (words.length < 2 || words.length > 8) {
    return false;
  }

  return words.every((word) => (
    /^(?:de|da|do|das|dos|e)$/i.test(word)
    || /^[A-ZÁÉÍÓÚÂÊÔÃÕÇ][a-zà-öø-ÿ]+(?:[-'][A-ZÁÉÍÓÚÂÊÔÃÕÇ]?[a-zà-öø-ÿ]+)?$/.test(word)
  ));
};

export const isLikelySupportSubtitleLine = (value: string) => {
  const clean = stripHtml(value).replace(/\s+/g, ' ').trim();
  if (!clean || clean.length > 90 || /[.!?:;]$/.test(clean)) {
    return false;
  }

  const words = clean.split(/\s+/).filter(Boolean);
  return words.length <= 10 && /^[A-ZÁÉÍÓÚÂÊÔÃÕÇ"“0-9]/.test(clean);
};

export const isPipeTableBlock = (lines: string[]) => (
  lines.length >= 2
  && lines.every((line) => line.includes('|'))
  && lines.every((line) => line.split('|').map((cell) => cell.trim()).filter(Boolean).length >= 2)
);

export const formatPipeTableHtml = (lines: string[]) => {
  const rows = lines.map((line) => line.split('|').map((cell) => cell.trim()).filter(Boolean));
  const columnCount = Math.max(...rows.map((row) => row.length));
  if (columnCount < 2 || rows.some((row) => row.length !== columnCount)) {
    return '';
  }

  const header = rows[0];
  const bodyRows = rows.slice(1).filter((row) => !row.every((cell) => /^:?-{2,}:?$/.test(cell)));
  const renderCell = (tag: 'td' | 'th', value: string) => `<${tag}>${escapeStructuredTextPreservingInlineHtml(value)}</${tag}>`;
  const headerHtml = `<thead><tr>${header.map((cell) => renderCell('th', cell)).join('')}</tr></thead>`;
  const bodyHtml = `<tbody>${bodyRows.map((row) => `<tr>${row.map((cell) => renderCell('td', cell)).join('')}</tr>`).join('')}</tbody>`;
  return `<table>${headerHtml}${bodyHtml}</table>`;
};

export const isFigureMarkerLine = (value: string) => /^\[FIGURA:\s*[-\w]+\]$/i.test(String(value || '').trim());

export const formatStructuredSupportHtml = (value: string) => {
  const raw = String(value || '').trim();
  if (!raw || blockHtmlPattern.test(raw)) {
    return raw;
  }

  const structured = normalizeStructuredText(raw);
  if (!structured) {
    return '';
  }

  const hasStructure = /\n/.test(structured);
  const hasInlineHtml = /<\/?(?:strong|em|u|b|i|mark)\b/i.test(structured);
  if (!hasStructure && !hasInlineHtml) {
    return structured;
  }

  return structured
    .split(/\n{2,}/)
    .map((block) => {
      const lines = block.split(/\n/).map((line) => line.trim()).filter(Boolean);
      if (lines.length === 0) {
        return '';
      }

      if (isPipeTableBlock(lines)) {
        return formatPipeTableHtml(lines) || `<p>${lines.map(escapeStructuredTextPreservingInlineHtml).join('<br />')}</p>`;
      }

      if (lines.length === 1) {
        if (isFigureMarkerLine(lines[0])) {
          return lines[0];
        }
        const content = escapeStructuredTextPreservingInlineHtml(lines[0]);
        return isLikelySupportTitleLine(lines[0]) ? `<h4>${content}</h4>` : `<p>${content}</p>`;
      }

      const [firstLine, ...bodyLines] = lines;
      if (isLikelySupportTitleLine(firstLine)) {
        const htmlParts = [`<h4>${escapeStructuredTextPreservingInlineHtml(firstLine)}</h4>`];
        let textBodyLines = bodyLines;
        const [possibleSubtitleLine, possibleAuthorLine, ...remainingAfterSubtitle] = bodyLines;
        if (possibleSubtitleLine && possibleAuthorLine && isLikelySupportSubtitleLine(possibleSubtitleLine) && isLikelyAuthorLine(possibleAuthorLine)) {
          htmlParts.push(`<p>${escapeStructuredTextPreservingInlineHtml(possibleSubtitleLine)}</p>`);
          htmlParts.push(`<p><em>${escapeStructuredTextPreservingInlineHtml(possibleAuthorLine)}</em></p>`);
          textBodyLines = remainingAfterSubtitle;
        } else if (possibleSubtitleLine && isLikelyAuthorLine(possibleSubtitleLine)) {
          htmlParts.push(`<p><em>${escapeStructuredTextPreservingInlineHtml(possibleSubtitleLine)}</em></p>`);
          textBodyLines = bodyLines.slice(1);
        }

        const bodyHtml = textBodyLines
          .map(escapeStructuredTextPreservingInlineHtml)
          .filter(Boolean)
          .join('<br />');
        if (bodyHtml) {
          htmlParts.push(`<p>${bodyHtml}</p>`);
        }
        return htmlParts.join('');
      }

      return `<p>${lines.map(escapeStructuredTextPreservingInlineHtml).join('<br />')}</p>`;
    })
    .filter(Boolean)
    .join('');
};

export const toImportMetadata = (metadata: PageExtractionResult['metadata']) => (
  (metadata && typeof metadata === 'object' ? metadata : null) as ImportMetadata | null
);

export const toImportedQuestionDraft = (question: Partial<Question>) => question as ImportedQuestionDraft;

export const slugify = (value: string) => String(value || '')
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/^-+|-+$/g, '') || 'item';

export const normalizeComparisonText = (value: string) => String(value || '')
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .replace(/[^a-z0-9]+/gi, ' ')
  .replace(/\s+/g, ' ')
  .trim()
  .toLowerCase();

export type ExamParserProfileId =
  | 'generic'
  | 'adaptive'
  | 'ibfc'
  | 'cebraspe'
  | 'fgv'
  | 'fcc'
  | 'vunesp'
  | 'instituto-aocp'
  | 'idecan'
  | 'quadrix'
  | 'iades'
  | 'fundatec'
  | 'cetro'
  | 'consulplan'
  | 'instituto-mais'
  | 'nc-ufpr'
  | 'fumarc'
  | 'fepese'
  | 'funrio'
  | 'ieses'
  | 'instituto-access'
  | 'instituto-consultec'
  | 'instituto-selecon'
  | 'avanca-sp'
  | 'cetap'
  | 'funcab'
  | 'vunesp-militar'
  | 'esaf'
  | 'cesgranrio'
  | 'vestibular'
  | 'enem';

export type ImportedQuestionStatus = 'ok' | 'incompleta' | 'revisar';
export type ImportedQuestionStatusReason =
  | 'sem_enunciado'
  | 'sem_alternativas'
  | 'alternativas_incompletas'
  | 'numero_duplicado'
  | 'possivel_texto_base_misturado'
  | 'figura_sem_recorte'
  | 'tipo_indefinido'
  | 'questao_sem_enunciado'
  | 'contexto_referenciado_nao_encontrado'
  | 'estrutura_texto_achatada'
  | 'tabela_corrompida'
  | 'poema_corrompido'
  | 'lei_corrompida'
  | 'contexto_quebrado_entre_paginas'
  | 'contexto_compartilhado_nao_vinculado'
  | 'questao_nao_localizada'
  | 'questao_placeholder_criada'
  | 'enunciado_ausente'
  | 'alternativas_ausentes'
  | 'conteudo_nao_extraido'
  | 'pagina_provavel'
  | 'aguardando_complemento_manual'
  | 'ia_indisponivel_quota'
  | 'parser_mecanico_sem_correspondencia'
  | 'contexto_possivelmente_nao_localizado'
  | 'figura_possivelmente_nao_localizada'
  | 'gabarito_indica_existencia'
  | 'texto_apoio_referenciado_nao_encontrado'
  | 'figura_referenciada_nao_encontrada'
  | 'tabela_referenciada_nao_encontrada'
  | 'referencia_possivelmente_misturada'
  | 'contexto_vinculo_ambiguo'
  | 'tabela_visual_sem_recorte'
  | 'classificacao_incompleta'
  | 'comentario_editorial_sem_base_suficiente';
export type ImportedQuestionType =
  | 'multipla escolha'
  | 'certo ou errado'
  | 'verdadeiro/falso'
  | 'multipla assertiva'
  | 'somatorio'
  | 'discursiva'
  | 'redacao'
  | 'estudo de caso'
  | 'desconhecido';

export interface ParserMarkerPattern {
  pattern: RegExp;
  numberGroup?: number;
  source: string;
}

export type DetectedQuestionMarkerStyle =
  | 'word'
  | 'q'
  | 'item'
  | 'line-number'
  | 'numbered'
  | 'dash'
  | string;

export type DetectedOptionMarkerStyle =
  | 'parenthesized'
  | 'punctuated'
  | 'dash'
  | 'word'
  | 'inline'
  | string;

export type DetectedQuestionModality =
  | ImportedQuestionType
  | 'julgamento'
  | 'indefinida';

export interface AdaptiveExamParserEvidence {
  confidence: number;
  detectedAgency?: string;
  observedQuestionMarkers: DetectedQuestionMarkerStyle[];
  observedOptionMarkers: DetectedOptionMarkerStyle[];
  observedOptionCounts: number[];
  observedQuestionNumbers: number[];
  probableModalities: DetectedQuestionModality[];
  questionNumberRange?: {
    first: number;
    last: number;
  };
  evidence: string[];
}

export interface ExamParserProfile {
  id: ExamParserProfileId;
  label: string;
  signalPattern?: RegExp;
  defaultMultipleChoiceOptions?: number;
  adaptiveEvidence?: AdaptiveExamParserEvidence;
  questionMarkerPatterns: ParserMarkerPattern[];
  optionMarkerPatterns: RegExp[];
  pageHeaderPattern?: RegExp;
  footerPattern?: RegExp;
  contextStartPattern: RegExp;
  trueFalseMode?: boolean;
  certoErradoMode?: boolean;
}

export const COMMON_QUESTION_MARKER_PATTERNS: ParserMarkerPattern[] = [
  { pattern: /\b(?:quest[aã]o|questao)\s*(?:n[ºo]\s*)?0*(\d{1,3})\b/gi, numberGroup: 1, source: 'word' },
  { pattern: /\bq\.?\s*0*(\d{1,3})\b/gi, numberGroup: 1, source: 'q' },
  { pattern: /\bitem\s+0*(\d{1,3})\b/gi, numberGroup: 1, source: 'item' },
  { pattern: /(^|\n)\s*0*(\d{1,3})\s*(?=\n\s*\S)/g, numberGroup: 2, source: 'line-number' },
  { pattern: /(^|(?<=\s))0*(\d{1,3})\s*[.)]\s+(?=\S)/g, numberGroup: 2, source: 'numbered' },
  { pattern: /(^|(?<=\s))0*(\d{1,3})\s*[-–—]\s+(?=\S)/g, numberGroup: 2, source: 'dash' },
];

export const OPTION_LABELS = ['A', 'B', 'C', 'D', 'E', 'F'];

export const COMMON_OPTION_MARKER_PATTERNS = [
  /(^|[\s([{;,:?!])(?:alternativa\s+)?\(?([A-F])\)?\s*[).:;\-–—]\s*/gi,
  /(^|[\s([{;,:?!])alternativa\s+([A-F])\b\s*/gi,
  /(^|[\s([{;,:?!])([A-F])\s+(?=\S)/gi,
];

export const COMMON_PAGE_HEADER_PATTERN = /\b(?:caderno\s+de\s+quest[oõ]es|prova\s+objetiva|concurso\s+p[uú]blico|processo\s+seletivo|rascunho|assinatura\s+do\s+candidato)\b/i;
export const COMMON_FOOTER_PATTERN = /\b(?:www\.[\w.-]+|p[aá]gina\s+\d+|\d+\s*$|confira\s+seus\s+dados|cart[aã]o[- ]resposta)\b/i;
export const VISUAL_CONTEXT_TERMS_PATTERN = '(?:figura|imagem|fotografia|desenho|grafico|gr[aá]fico|tabela|mapa|charge|tirinha|cartum|quadrinho|fluxograma|organograma|circuito|planta|esquema|diagrama|infografico|infogr[aá]fico|quadro|tabela\\s+periodica|imagem\\s+historica|desenho\\s+geometrico|esquema\\s+quimico)';
export const COMMON_CONTEXT_START_PATTERN = new RegExp(`\\b(?:textos?\\s+(?:[ivxlc]+|\\d+)|leia\\s+os?\\s+textos?|leia\\s+o\\s+texto\\s+abaixo|considere\\s+o\\s+texto|considere\\s+as\\s+(?:(?:\\w+)\\s+){0,4}passagens|com\\s+base\\s+no\\s+texto|para\\s+responder(?:\\s+[aà]s?)?\\s+(?:quest(?:[oõ]es|oes)|itens?)|texto\\s+para\\s+(?:(?:responder|os?|as?)\\s+)*(?:quest(?:[oõ]es|oes)|itens?)|(?:quest(?:[oõ]es|oes)|itens?)\\s+(?:de(?:\\s+n[uú]meros?)?\\s+)?\\d{1,3}\\s*(?:a|ate|-)\\s*\\d{1,3}|aten[cç][aã]o\\s*:\\s*para\\s+responder|observe\\s+(?:a|o)\\s+${VISUAL_CONTEXT_TERMS_PATTERN}|analise\\s+a\\s+tabela|no\\s+trecho\\s+destacado|na\\s+(?:figura|tabela)|fragmento|${VISUAL_CONTEXT_TERMS_PATTERN}\\s*\\d*)\\b`, 'i');

export const GENERIC_EXAM_PARSER_PROFILE: ExamParserProfile = {
  id: 'generic',
  label: 'Generico',
  defaultMultipleChoiceOptions: 0,
  questionMarkerPatterns: COMMON_QUESTION_MARKER_PATTERNS,
  optionMarkerPatterns: COMMON_OPTION_MARKER_PATTERNS,
  pageHeaderPattern: COMMON_PAGE_HEADER_PATTERN,
  footerPattern: COMMON_FOOTER_PATTERN,
  contextStartPattern: COMMON_CONTEXT_START_PATTERN,
};

export const countPatternMatches = (text: string, pattern: RegExp) => Array.from(text.matchAll(cloneGlobalPattern(pattern))).length;

export const inferAdaptiveOptionCountFromText = (text: string, parserProfile: ExamParserProfile = GENERIC_EXAM_PARSER_PROFILE) => {
  const markers = readOptionMarkers(text, parserProfile);
  if (markers.length < 2) {
    return 0;
  }

  const structuredMarkers = markers.filter((marker) => marker.structured);
  const reliableMarkers = structuredMarkers.length >= 2 ? structuredMarkers : markers;
  const labels = new Set(reliableMarkers.map((marker) => marker.label));
  const hasAtoD = ['A', 'B', 'C', 'D'].every((label) => labels.has(label));
  const hasAtoE = hasAtoD && labels.has('E');
  const hasAtoF = hasAtoE && labels.has('F');
  if (hasAtoF) {
    return 6;
  }
  if (hasAtoE) {
    return 5;
  }
  if (hasAtoD) {
    return 4;
  }

  const orderedLabels = reliableMarkers.map((marker) => marker.label).join('');
  if (/ABCD(?!E)/.test(orderedLabels)) {
    return 4;
  }
  if (/ABCDEF/.test(orderedLabels)) {
    return 6;
  }
  if (/ABCDE/.test(orderedLabels)) {
    return 5;
  }
  return 0;
};

export const inferOptionMarkerStyles = (markers: ReturnType<typeof readOptionMarkers>): DetectedOptionMarkerStyle[] => {
  const styles = new Set<DetectedOptionMarkerStyle>();
  markers.forEach((marker) => {
    if (marker.raw && /\balternativa\s+[A-F]\b/i.test(marker.raw)) {
      styles.add('word');
    }
    if (marker.raw && /\([A-F]\)/i.test(marker.raw)) {
      styles.add('parenthesized');
    }
    if (marker.raw && /[A-F]\s*[-–—]/i.test(marker.raw)) {
      styles.add('dash');
    }
    if (marker.raw && /[A-F]\s*[).:;]/i.test(marker.raw)) {
      styles.add('punctuated');
    }
    if (!marker.structured) {
      styles.add('inline');
    }
  });
  return Array.from(styles);
};

export const inferProbableModalitiesFromText = (text: string, parserProfile: ExamParserProfile): DetectedQuestionModality[] => {
  const clean = stripHtml(text).replace(/\s+/g, ' ').trim();
  const modalities = new Set<DetectedQuestionModality>();
  if (isTrueFalseExamText(clean)) {
    modalities.add('certo ou errado');
  }
  if (isVerdadeiroFalsoExamText(clean)) {
    modalities.add('verdadeiro/falso');
  }
  if (/\b(?:assertivas?|afirma[cç][oõ]es?|itens?\s+[ivxlcdm]+|i\s*,?\s*ii\s*,?\s*iii)\b/i.test(clean)) {
    modalities.add('multipla assertiva');
  }
  if (/\b(?:reda[cç][aã]o|texto\s+dissertativo|estudo\s+de\s+caso|caso\s+cl[ií]nico)\b/i.test(clean)) {
    modalities.add('discursiva');
  }
  if (modalities.size === 0 && readOptionMarkers(clean, parserProfile).length >= 2) {
    modalities.add('multipla escolha');
  }
  return Array.from(modalities);
};

export const buildAdaptiveExamParserProfile = (
  text: string,
  baseProfile: ExamParserProfile = GENERIC_EXAM_PARSER_PROFILE,
): ExamParserProfile => {
  const normalizedText = String(text || '');
  const observedQuestionMarkers = COMMON_QUESTION_MARKER_PATTERNS
    .map((pattern) => ({ source: pattern.source, count: countPatternMatches(normalizedText, pattern.pattern) }))
    .filter((entry) => entry.count > 0)
    .sort((left, right) => right.count - left.count)
    .map((entry) => entry.source);

  const observedQuestionNumbers = findQuestionMarkers(normalizedText, baseProfile)
    .map((marker) => marker.number)
    .filter((number, index, list) => number > 0 && list.indexOf(number) === index)
    .slice(0, 250);

  const optionCounts = Array.from(normalizedText.matchAll(/(?:^|\s)(?:0*\d{1,3}\s*[.)-]\s+|quest[aã]o\s+0*\d{1,3}\b|q\.?\s*0*\d{1,3}\b)([\s\S]*?)(?=(?:^|\s)(?:0*\d{1,3}\s*[.)-]\s+|quest[aã]o\s+0*\d{1,3}\b|q\.?\s*0*\d{1,3}\b)|$)/gim))
    .map((match) => inferAdaptiveOptionCountFromText(match[1] || match[0], baseProfile))
    .filter((count) => count >= 2 && count <= 6);

  const rankedOptionCounts = [2, 3, 4, 5, 6]
    .map((count) => ({
      count,
      hits: optionCounts.filter((item) => item === count).length,
    }))
    .filter((entry) => entry.hits > 0)
    .sort((left, right) => right.hits - left.hits)
    .map((entry) => entry.count);

  const observedOptionMarkers = inferOptionMarkerStyles(readOptionMarkers(normalizedText, baseProfile));
  const probableModalities = inferProbableModalitiesFromText(normalizedText, baseProfile);
  const defaultMultipleChoiceOptions = rankedOptionCounts[0] || 0;
  const sortedQuestionNumbers = [...observedQuestionNumbers].sort((left, right) => left - right);
  const confidence = Math.min(1, (
    (observedQuestionMarkers.length > 0 ? 0.35 : 0)
    + (observedQuestionNumbers.length >= 3 ? 0.35 : observedQuestionNumbers.length > 0 ? 0.15 : 0)
    + (rankedOptionCounts.length > 0 ? 0.30 : 0)
  ));

  if (!confidence) {
    return {
      ...baseProfile,
      defaultMultipleChoiceOptions: 0,
      trueFalseMode: false,
      certoErradoMode: false,
    };
  }

  return {
    ...baseProfile,
    id: 'adaptive',
    label: baseProfile.id === 'generic'
      ? 'Adaptativo'
      : `${baseProfile.label} + adaptativo`,
    defaultMultipleChoiceOptions,
    trueFalseMode: false,
    certoErradoMode: false,
    adaptiveEvidence: {
      confidence,
      observedQuestionMarkers,
      observedOptionMarkers,
      observedOptionCounts: rankedOptionCounts,
      observedQuestionNumbers,
      probableModalities,
      questionNumberRange: sortedQuestionNumbers.length > 0
        ? {
            first: sortedQuestionNumbers[0],
            last: sortedQuestionNumbers[sortedQuestionNumbers.length - 1],
          }
        : undefined,
      evidence: [
        observedQuestionMarkers.length ? `Marcadores de questao: ${observedQuestionMarkers.join(', ')}` : '',
        observedOptionMarkers.length ? `Marcadores de alternativa: ${observedOptionMarkers.join(', ')}` : '',
        rankedOptionCounts.length ? `Alternativas por questao: ${rankedOptionCounts.join(', ')}` : '',
        probableModalities.length ? `Modalidades provaveis: ${probableModalities.join(', ')}` : '',
      ].filter(Boolean),
    },
  };
};

export const createStandardExamParserProfile = ({
  id,
  label,
  signalPattern,
  defaultMultipleChoiceOptions = 0,
  pageHeaderPattern,
  footerPattern = COMMON_FOOTER_PATTERN,
  contextStartPattern = COMMON_CONTEXT_START_PATTERN,
  trueFalseMode = false,
  certoErradoMode = false,
}: Pick<ExamParserProfile, 'id' | 'label' | 'signalPattern'> & Partial<ExamParserProfile>): ExamParserProfile => ({
  id,
  label,
  signalPattern,
  defaultMultipleChoiceOptions,
  questionMarkerPatterns: COMMON_QUESTION_MARKER_PATTERNS,
  optionMarkerPatterns: COMMON_OPTION_MARKER_PATTERNS,
  pageHeaderPattern: pageHeaderPattern || signalPattern || COMMON_PAGE_HEADER_PATTERN,
  footerPattern,
  contextStartPattern,
  trueFalseMode,
  certoErradoMode,
});

export const EXAM_PARSER_PROFILES: ExamParserProfile[] = [
  {
    id: 'enem',
    label: 'ENEM / INEP',
    signalPattern: /\b(?:enem|inep|exame\s+nacional\s+do\s+ensino\s+m[eé]dio)\b/i,
    defaultMultipleChoiceOptions: 5,
    questionMarkerPatterns: COMMON_QUESTION_MARKER_PATTERNS,
    optionMarkerPatterns: COMMON_OPTION_MARKER_PATTERNS,
    pageHeaderPattern: /\b(?:enem|inep|caderno\s+\d+|prova\s+(?:azul|amarela|branca|rosa|cinza)|ci[eê]ncias|linguagens|matem[aá]tica)\b/i,
    footerPattern: COMMON_FOOTER_PATTERN,
    contextStartPattern: COMMON_CONTEXT_START_PATTERN,
  },
  {
    id: 'ibfc',
    label: 'IBFC',
    signalPattern: /\bibfc\b/i,
    defaultMultipleChoiceOptions: 4,
    questionMarkerPatterns: COMMON_QUESTION_MARKER_PATTERNS,
    optionMarkerPatterns: COMMON_OPTION_MARKER_PATTERNS,
    pageHeaderPattern: /\bibfc\s*\d{0,3}\b|\bvers[aã]o\s+[a-z]\b/i,
    footerPattern: /\bibfc[_\s-]*\d+|\bvers[aã]o\s+[a-z]\b|\bwww\.pciconcursos\.com\.br\b|\b\d+\s*$/i,
    contextStartPattern: COMMON_CONTEXT_START_PATTERN,
  },
  {
    id: 'cebraspe',
    label: 'CEBRASPE / CESPE',
    signalPattern: /\b(?:cebraspe|cespe|unb)\b/i,
    defaultMultipleChoiceOptions: 2,
    questionMarkerPatterns: COMMON_QUESTION_MARKER_PATTERNS,
    optionMarkerPatterns: COMMON_OPTION_MARKER_PATTERNS,
    pageHeaderPattern: /\b(?:cebraspe|cespe|unb|certo|errado)\b/i,
    footerPattern: COMMON_FOOTER_PATTERN,
    contextStartPattern: COMMON_CONTEXT_START_PATTERN,
    trueFalseMode: true,
    certoErradoMode: true,
  },
  {
    id: 'fgv',
    label: 'FGV',
    signalPattern: /\b(?:fgv|funda[cç][aã]o\s+getulio\s+vargas|get[úu]lio\s+vargas)\b/i,
    defaultMultipleChoiceOptions: 5,
    questionMarkerPatterns: COMMON_QUESTION_MARKER_PATTERNS,
    optionMarkerPatterns: COMMON_OPTION_MARKER_PATTERNS,
    pageHeaderPattern: /\b(?:fgv|funda[cç][aã]o\s+getulio\s+vargas|get[úu]lio\s+vargas)\b/i,
    footerPattern: COMMON_FOOTER_PATTERN,
    contextStartPattern: COMMON_CONTEXT_START_PATTERN,
  },
  {
    id: 'fcc',
    label: 'FCC',
    signalPattern: /\b(?:fcc|funda[cç][aã]o\s+carlos\s+chagas)\b/i,
    defaultMultipleChoiceOptions: 5,
    questionMarkerPatterns: COMMON_QUESTION_MARKER_PATTERNS,
    optionMarkerPatterns: COMMON_OPTION_MARKER_PATTERNS,
    pageHeaderPattern: /\b(?:fcc|funda[cç][aã]o\s+carlos\s+chagas)\b/i,
    footerPattern: COMMON_FOOTER_PATTERN,
    contextStartPattern: COMMON_CONTEXT_START_PATTERN,
  },
  {
    id: 'vunesp',
    label: 'VUNESP',
    signalPattern: /\b(?:vunesp|fundacao\s+vunesp)\b(?![\s\S]{0,120}\b(?:militar|policia\s+militar|pm\b|soldado|oficial)\b)/i,
    defaultMultipleChoiceOptions: 5,
    questionMarkerPatterns: COMMON_QUESTION_MARKER_PATTERNS,
    optionMarkerPatterns: COMMON_OPTION_MARKER_PATTERNS,
    pageHeaderPattern: /\b(?:vunesp|funda[cç][aã]o\s+vunesp)\b/i,
    footerPattern: COMMON_FOOTER_PATTERN,
    contextStartPattern: COMMON_CONTEXT_START_PATTERN,
  },
  createStandardExamParserProfile({
    id: 'vunesp-militar',
    label: 'VUNESP Militar',
    signalPattern: /\b(?:vunesp\s+militar|vunesp.*(?:policia\s+militar|pm\b|soldado|oficial)|(?:policia\s+militar|pm\b|soldado|oficial).*vunesp)\b/i,
    defaultMultipleChoiceOptions: 5,
  }),
  {
    id: 'instituto-aocp',
    label: 'Instituto AOCP',
    signalPattern: /\b(?:instituto\s+aocp|aocp)\b/i,
    defaultMultipleChoiceOptions: 0,
    questionMarkerPatterns: COMMON_QUESTION_MARKER_PATTERNS,
    optionMarkerPatterns: COMMON_OPTION_MARKER_PATTERNS,
    pageHeaderPattern: /\b(?:instituto\s+aocp|aocp)\b/i,
    footerPattern: COMMON_FOOTER_PATTERN,
    contextStartPattern: COMMON_CONTEXT_START_PATTERN,
  },
  {
    id: 'idecan',
    label: 'IDECAN',
    signalPattern: /\bidecan\b/i,
    defaultMultipleChoiceOptions: 0,
    questionMarkerPatterns: COMMON_QUESTION_MARKER_PATTERNS,
    optionMarkerPatterns: COMMON_OPTION_MARKER_PATTERNS,
    pageHeaderPattern: /\bidecan\b/i,
    footerPattern: COMMON_FOOTER_PATTERN,
    contextStartPattern: COMMON_CONTEXT_START_PATTERN,
  },
  {
    id: 'quadrix',
    label: 'Quadrix',
    signalPattern: /\bquadrix\b/i,
    defaultMultipleChoiceOptions: 0,
    questionMarkerPatterns: COMMON_QUESTION_MARKER_PATTERNS,
    optionMarkerPatterns: COMMON_OPTION_MARKER_PATTERNS,
    pageHeaderPattern: /\bquadrix\b/i,
    footerPattern: COMMON_FOOTER_PATTERN,
    contextStartPattern: COMMON_CONTEXT_START_PATTERN,
  },
  createStandardExamParserProfile({
    id: 'iades',
    label: 'IADES',
    signalPattern: /\biades\b/i,
    defaultMultipleChoiceOptions: 5,
  }),
  createStandardExamParserProfile({
    id: 'fundatec',
    label: 'FUNDATEC',
    signalPattern: /\bfundatec\b/i,
    defaultMultipleChoiceOptions: 5,
  }),
  createStandardExamParserProfile({
    id: 'cetro',
    label: 'CETRO',
    signalPattern: /\bcetro\b/i,
    defaultMultipleChoiceOptions: 5,
  }),
  createStandardExamParserProfile({
    id: 'consulplan',
    label: 'CONSULPLAN',
    signalPattern: /\bconsulplan\b/i,
    defaultMultipleChoiceOptions: 4,
  }),
  createStandardExamParserProfile({
    id: 'instituto-mais',
    label: 'Instituto Mais',
    signalPattern: /\b(?:instituto\s+mais|mais\s+organizacao|mais\s+organizacoes)\b/i,
    defaultMultipleChoiceOptions: 5,
  }),
  createStandardExamParserProfile({
    id: 'nc-ufpr',
    label: 'NC-UFPR',
    signalPattern: /\b(?:nc\s*[-/]?\s*ufpr|nucleo\s+de\s+concursos\s+da\s+ufpr|ufpr)\b/i,
    defaultMultipleChoiceOptions: 5,
  }),
  createStandardExamParserProfile({
    id: 'fumarc',
    label: 'FUMARC',
    signalPattern: /\bfumarc\b/i,
    defaultMultipleChoiceOptions: 4,
  }),
  createStandardExamParserProfile({
    id: 'fepese',
    label: 'FEPESE',
    signalPattern: /\bfepese\b/i,
    defaultMultipleChoiceOptions: 5,
  }),
  createStandardExamParserProfile({
    id: 'funrio',
    label: 'FUNRIO',
    signalPattern: /\bfunrio\b/i,
    defaultMultipleChoiceOptions: 5,
  }),
  createStandardExamParserProfile({
    id: 'ieses',
    label: 'IESES',
    signalPattern: /\bieses\b/i,
    defaultMultipleChoiceOptions: 5,
  }),
  createStandardExamParserProfile({
    id: 'instituto-access',
    label: 'Instituto ACCESS',
    signalPattern: /\b(?:instituto\s+access|access)\b/i,
    defaultMultipleChoiceOptions: 4,
  }),
  createStandardExamParserProfile({
    id: 'instituto-consultec',
    label: 'Instituto Consultec',
    signalPattern: /\b(?:instituto\s+consultec|consultec)\b/i,
    defaultMultipleChoiceOptions: 5,
  }),
  createStandardExamParserProfile({
    id: 'instituto-selecon',
    label: 'Instituto Selecon',
    signalPattern: /\b(?:instituto\s+selecon|selecon)\b/i,
    defaultMultipleChoiceOptions: 5,
  }),
  createStandardExamParserProfile({
    id: 'avanca-sp',
    label: 'Avanca SP',
    signalPattern: /\b(?:avanca\s+sp|avança\s+sp|avancasp)\b/i,
    defaultMultipleChoiceOptions: 5,
  }),
  createStandardExamParserProfile({
    id: 'cetap',
    label: 'CETAP',
    signalPattern: /\bcetap\b/i,
    defaultMultipleChoiceOptions: 5,
  }),
  createStandardExamParserProfile({
    id: 'funcab',
    label: 'FUNCAB',
    signalPattern: /\bfuncab\b/i,
    defaultMultipleChoiceOptions: 5,
  }),
  createStandardExamParserProfile({
    id: 'esaf',
    label: 'ESAF',
    signalPattern: /\b(?:esaf|escola\s+de\s+administracao\s+fazendaria)\b/i,
    defaultMultipleChoiceOptions: 5,
  }),
  createStandardExamParserProfile({
    id: 'cesgranrio',
    label: 'CESGRANRIO',
    signalPattern: /\b(?:cesgranrio|fundacao\s+cesgranrio)\b/i,
    defaultMultipleChoiceOptions: 5,
  }),
  createStandardExamParserProfile({
    id: 'vestibular',
    label: 'Vestibulares tradicionais',
    signalPattern: /\b(?:vestibular|fuvest|unicamp|unesp|uerj|ita|ime|comvest)\b/i,
    defaultMultipleChoiceOptions: 5,
  }),
];

export const resolveExamParserProfile = (...signals: unknown[]): ExamParserProfile => {
  const normalizedSignal = normalizeComparisonText(signals.map((signal) => String(signal || '')).join(' '));
  return EXAM_PARSER_PROFILES.find((profile) => (
    profile.signalPattern?.test(normalizedSignal)
  )) || GENERIC_EXAM_PARSER_PROFILE;
};

export const cloneGlobalPattern = (pattern: RegExp) => new RegExp(pattern.source, pattern.flags.includes('g') ? pattern.flags : `${pattern.flags}g`);

export const normalizePdfTextForParsing = (
  value: string,
  parserProfile: ExamParserProfile = GENERIC_EXAM_PARSER_PROFILE,
) => {
  const headerPattern = parserProfile.pageHeaderPattern || COMMON_PAGE_HEADER_PATTERN;
  const footerPattern = parserProfile.footerPattern || COMMON_FOOTER_PATTERN;
  const rawLines = String(value || '')
    .replace(/\r\n?/g, '\n')
    .replace(/\u00A0/g, ' ')
    .replace(/([A-Za-zÀ-ÖØ-öø-ÿ])-\s*\n\s*([a-zà-öø-ÿ])/g, '$1$2')
    .split('\n')
    .map((line) => line.replace(/[ \t]+/g, ' ').trim());

  const lines = rawLines.reduce<string[]>((keptLines, line, lineIndex, list) => {
    const clean = line.replace(/\s+/g, ' ').trim();
    if (!clean) {
      if (keptLines[keptLines.length - 1] !== '') {
        keptLines.push('');
      }
      return keptLines;
    }

      if (/^\d{1,3}$/.test(clean)) {
        const nextLine = list.slice(lineIndex + 1).find((candidate) => candidate.replace(/\s+/g, ' ').trim()) || '';
        const cleanNextLine = nextLine.replace(/\s+/g, ' ').trim();
        const likelyStandaloneQuestionNumber = cleanNextLine.length >= 10
          && !headerPattern.test(cleanNextLine)
          && !footerPattern.test(cleanNextLine)
          && !isLikelyInstructionText(cleanNextLine);
        if (likelyStandaloneQuestionNumber) {
          keptLines.push(`${Number(clean)})`);
        }
        return keptLines;
      }
      if (/^\d{1,3}\s+\d{1,3}$/.test(clean)) {
        const nextLine = list.slice(lineIndex + 1).find((candidate) => candidate.replace(/\s+/g, ' ').trim()) || '';
        const cleanNextLine = nextLine.replace(/\s+/g, ' ').trim();
        const likelyTwoColumnQuestionNumbers = cleanNextLine.length >= 10
          && !headerPattern.test(cleanNextLine)
          && !footerPattern.test(cleanNextLine)
          && !isLikelyInstructionText(cleanNextLine);
        if (likelyTwoColumnQuestionNumbers) {
          keptLines.push(clean);
        }
        return keptLines;
      }
      if (/^(?:rascunho|assinatura\s+do\s+candidato|caderno\s+de\s+quest[oõ]es)$/i.test(clean)) {
        return keptLines;
      }
      if (headerPattern.test(clean) && clean.length < 120 && !isLikelySupportTitleLine(clean) && !questionCommandPattern.test(clean)) {
        return keptLines;
      }
      if (
        footerPattern.test(clean)
        && clean.length < 120
        && !parserProfile.contextStartPattern.test(clean)
        && !supportContextSignalPattern.test(clean)
        && !/\b(?:fonte|dispon[ií]vel|acesso|adaptad[ao])\b/i.test(clean)
      ) {
        return keptLines;
      }
      keptLines.push(clean);
      return keptLines;
    }, [])
    .filter((line, index, list) => line || (index > 0 && index < list.length - 1));

  return normalizeStructuredText(lines.join('\n'));
};

export const DISCIPLINE_TITLE_PATTERNS: RegExp[] = [
  /\bL[ií]ngua\s+Portuguesa\b/gi,
  /\bLiteratura\b/gi,
  /\bMatem[aá]tica\b/gi,
  /\bRacioc[ií]nio\s+L[oó]gico\b/gi,
  /\bDireito\s+Constitucional\b/gi,
  /\bDireito\s+Administrativo\b/gi,
  /\bDireito\s+Penal\b/gi,
  /\bDireito\s+Processual\s+Penal\b/gi,
  /\bDireito\s+Civil\b/gi,
  /\bInform[aá]tica\b/gi,
  /\bF[ií]sica\b/gi,
  /\bQu[ií]mica\b/gi,
  /\bBiologia\b/gi,
  /\bAtualidades\b/gi,
  /\bHist[oó]ria\b/gi,
  /\bGeografia\b/gi,
  /\bDireitos\s+Humanos\b/gi,
  /\bLegisla[cç][aã]o\s+Especial\b/gi,
  /\bEstat[ií]stica\b/gi,
  /\bContabilidade\b/gi,
  /\bAdministra[cç][aã]o\b/gi,
  /\bMedicina\b/gi,
  /\bEnfermagem\b/gi,
  /\bConhecimentos\s+Gerais\b/gi,
  /\bConhecimentos\s+Espec[ií]ficos\b/gi,
  /\bNo[cç][oõ]es\s+de\s+Direito\b/gi,
  /\bLegisla[cç][aã]o\b/gi,
];

export const normalizeDisciplineTitle = (value: string) => String(value || '')
  .replace(/\s+/g, ' ')
  .trim()
  .replace(/\b([A-ZÀ-ÖØ-Þ])([A-ZÀ-ÖØ-Þ]+)\b/g, (match) => (
    match.charAt(0).toUpperCase() + match.slice(1).toLowerCase()
  ));

export const inferDisciplineFromTextBefore = (value: string) => {
  const prefix = String(value || '').slice(-2500);
  const candidates: Array<{ index: number; title: string }> = [];
  DISCIPLINE_TITLE_PATTERNS.forEach((pattern) => {
    for (const match of prefix.matchAll(cloneGlobalPattern(pattern))) {
      candidates.push({ index: match.index ?? 0, title: normalizeDisciplineTitle(match[0]) });
    }
  });

  const lines = prefix.split(/\n| {2,}/).map((line) => line.trim()).filter(Boolean);
  lines.forEach((line, lineIndex) => {
    const clean = stripHtml(line).replace(/\s+/g, ' ').trim();
    const letters = clean.replace(/[^\p{L}]/gu, '');
    const uppercaseLetters = letters.replace(/[^\p{Lu}]/gu, '');
    if (
      clean.length >= 6
      && clean.length <= 90
      && uppercaseLetters.length >= 5
      && uppercaseLetters.length / Math.max(1, letters.length) > 0.72
      && !isLikelyInstructionText(clean)
      && !isLikelySupportContextStartLine(clean)
    ) {
      candidates.push({ index: prefix.length - lines.length + lineIndex, title: normalizeDisciplineTitle(clean) });
    }
  });

  return candidates.sort((left, right) => right.index - left.index)[0]?.title || '';
};

export const ROLE_START_PATTERN = /^(?:soldado|cabo|sargento|tenente|oficial|professor|analista|t[eé]cnico|tecnico|agente|assistente|auditor|fiscal|escriv[aã]o|delegado|m[eé]dico|medico|enfermeiro|engenheiro|combatente)\b/i;
export const ROLE_SIGNAL_PATTERN = /\b(?:cargo|prova|soldado|cabo|sargento|tenente|oficial|professor|analista|t[eé]cnico|tecnico|agente|assistente|auditor|fiscal|escriv[aã]o|delegado|m[eé]dico|medico|enfermeiro|engenheiro|combatentes?|pol[ií]cia|policia|bombeiro|pm|bm|qpc|qbmp)\b/i;

export const cleanRoleCandidate = (value: unknown) => String(value || '')
  .replace(/^[\s:;,\-–—]+/, '')
  .replace(/\b(?:cargo|prova|cargo\/prova)\s*[:\-–—]\s*/i, '')
  .replace(/\s+/g, ' ')
  .trim();

export const readExamEntityLabel = (value: unknown): string => {
  if (!value || typeof value !== 'object') {
    return String(value || '').trim();
  }

  const record = value as Record<string, unknown>;
  return String(record.name || record.nome || record.sigla || record.descricao || record['descrição'] || record.slug || '').trim();
};

export const cleanOrganizationCandidate = (value: unknown) => readExamEntityLabel(value)
  .replace(/^[\s:;,\-–—]+/, '')
  .replace(/\b(?:[oó]rg[aã]o|orgao|fonte|institui[cç][aã]o)\s*[:\-–—]\s*/i, '')
  .replace(/\s+/g, ' ')
  .trim();

export const splitOrganizationCandidate = (value: unknown) => {
  const clean = cleanOrganizationCandidate(value);
  if (!clean) {
    return [];
  }

  return clean
    .split(/(?:\r?\n|;|,|\s*\/\s*|\s+\|\s+)/)
    .map(cleanOrganizationCandidate)
    .filter((item) => item.length >= 2 && item.length <= 120);
};

export const normalizeOrganizationList = (...values: unknown[]) => {
  const organizations = values
    .flatMap((value) => {
      if (Array.isArray(value)) {
        return value.flatMap((item) => splitOrganizationCandidate(item));
      }

      return splitOrganizationCandidate(value);
    })
    .filter(Boolean);

  const seen = new Set<string>();
  return organizations.filter((organization) => {
    const key = normalizeComparisonText(organization);
    if (!key || seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
};

export const splitRoleCandidate = (value: unknown, requireSignal = false) => {
  const clean = cleanRoleCandidate(value);
  if (!clean) {
    return [];
  }

  return clean
    .split(/(?:\r?\n|;|\s*\/\s*|\s+\|\s+|\s+(?=(?:Soldado|Cabo|Sargento|Tenente|Oficial|Professor|Analista|T[eé]cnico|Tecnico|Agente|Assistente|Auditor|Fiscal|Escriv[aã]o|Delegado|M[eé]dico|Medico|Enfermeiro|Engenheiro)\b))/i)
    .map(cleanRoleCandidate)
    .filter((item) => item.length >= 3 && item.length <= 140)
    .filter((item) => !requireSignal || ROLE_SIGNAL_PATTERN.test(item));
};

export const normalizeRoleList = (...values: unknown[]) => {
  const roles = values
    .flatMap((value) => {
      if (Array.isArray(value)) {
        return value.flatMap((item) => splitRoleCandidate(item));
      }

      return splitRoleCandidate(value);
    })
    .filter(Boolean);

  const seen = new Set<string>();
  return roles.filter((role) => {
    const key = normalizeComparisonText(role);
    if (!key || seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
};

export const summarizeRoleList = (roles: string[], fallback = '') => (
  roles.length > 0 ? roles.join(' / ') : String(fallback || '').trim()
);

export const summarizeExamTitleList = (items: string[], fallback = '') => (
  items.length > 0 ? items.join('/') : String(fallback || '').trim()
);

export const toPromptHint = (...values: unknown[]) => {
  for (const value of values) {
    if (Array.isArray(value)) {
      const joined = value
        .map(readExamEntityLabel)
        .map((item) => item.replace(/\s+/g, ' ').trim())
        .filter(Boolean)
        .join(' / ');
      if (joined) {
        return joined;
      }
      continue;
    }

    if (typeof value === 'number' && Number.isFinite(value)) {
      return String(value);
    }

    const text = readExamEntityLabel(value).replace(/\s+/g, ' ').trim();
    if (text) {
      return text;
    }
  }

  return '';
};

export const inferRolesFromText = (value: string, fileName = '') => {
  const text = String(value || '');
  const candidates: string[] = [];
  const labeledMatches = Array.from(text.matchAll(/\b(?:cargo|prova|cargo\/prova)\s*[:\-–—]\s*([^\r\n|]{3,180})/gi));
  labeledMatches.forEach((match) => {
    candidates.push(...splitRoleCandidate(match[1]));
  });

  text
    .split(/\r?\n/)
    .map(cleanRoleCandidate)
    .filter((line) => line.length >= 6 && line.length <= 140)
    .filter((line) => ROLE_SIGNAL_PATTERN.test(line) && (ROLE_START_PATTERN.test(line) || /\b(?:pm|bm|qpc|qbmp|combatentes?)\b/i.test(line)))
    .forEach((line) => candidates.push(...splitRoleCandidate(line, true)));

  candidates.push(...splitRoleCandidate(fileName.replace(/\.[a-z0-9]+$/i, ''), true));

  return normalizeRoleList(candidates);
};

export const toLooseRecord = (value: unknown): Record<string, unknown> | null => (
  value && typeof value === 'object' ? value as Record<string, unknown> : null
);

export const readPdfTextStyle = (item: unknown, styles: Record<string, unknown>) => {
  const record = toLooseRecord(item);
  const fontName = String(record?.fontName || '');
  const styleRecord = toLooseRecord(styles[fontName]);
  return `${fontName} ${String(styleRecord?.fontFamily || '')}`.toLowerCase();
};

export const isBoldPdfTextStyle = (styleText: string) => (
  /\b(bold|black|heavy|semibold|semi-bold|demi|extrabold|extra-bold)\b/i.test(styleText)
);

export const isItalicPdfTextStyle = (styleText: string) => (
  /\b(italic|oblique|italico|it\b)\b/i.test(styleText)
);

export const isUnderlinePdfTextStyle = (styleText: string) => (
  /\b(underline|underlined|sublinhad[oa]|subline)\b/i.test(styleText)
);

export const isMeaningfulHighlightText = (value: string) => {
  const clean = stripHtml(value).replace(/\s+/g, ' ').trim();
  return clean.length >= 2 && /[\p{L}\p{N}]/u.test(clean) && !/^\W+$/.test(clean);
};

export const mergeAdjacentHighlights = (items: PdfTextHighlight[]) => {
  const merged: PdfTextHighlight[] = [];
  items.forEach((item) => {
    const previous = merged[merged.length - 1];
    if (
      previous
      && previous.bold === item.bold
      && previous.italic === item.italic
      && previous.underline === item.underline
      && previous.text.length + item.text.length <= 120
    ) {
      previous.text = `${previous.text}${/\s$/.test(previous.text) || /^\s/.test(item.text) ? '' : ' '}${item.text}`.replace(/\s+/g, ' ');
      return;
    }

    merged.push({ ...item });
  });

  return merged
    .map((item) => ({ ...item, text: item.text.replace(/\s+/g, ' ').trim() }))
    .filter((item) => isMeaningfulHighlightText(item.text));
};

export const wrapHighlightedText = (value: string, highlight: Pick<PdfTextHighlight, 'bold' | 'italic' | 'underline'>) => {
  let output = escapeHtml(value);
  if (highlight.underline) {
    output = `<u>${output}</u>`;
  }
  if (highlight.italic) {
    output = `<em>${output}</em>`;
  }
  if (highlight.bold) {
    output = `<strong>${output}</strong>`;
  }
  return output;
};

export type PdfTextSegment = PdfTextHighlight & {
  lineBreakAfter?: boolean;
  blockBreakAfter?: boolean;
};

export const joinPdfTextSegments = (
  items: PdfTextSegment[],
  render: (item: PdfTextSegment) => string,
) => {
  let output = '';
  items.forEach((item) => {
    const rendered = render(item).trim();
    if (!rendered) {
      return;
    }

    if (output && !/[\s\n]$/.test(output)) {
      output += ' ';
    }
    output += rendered;

    if (item.blockBreakAfter) {
      output += '\n\n';
    } else if (item.lineBreakAfter) {
      output += '\n';
    }
  });

  return normalizeStructuredText(output);
};

export const buildPlainPdfText = (items: PdfTextSegment[]) => joinPdfTextSegments(
  items,
  (item) => item.text,
);

export const buildHighlightedPdfTextHtml = (items: PdfTextSegment[]) => joinPdfTextSegments(
  items,
  (item) => (
    item.bold || item.italic || item.underline
      ? wrapHighlightedText(item.text, item)
      : escapeHtml(item.text)
  ),
);

export const normalizePdfCoord = (value: number, total: number) => (
  total > 0 && Number.isFinite(value)
    ? Math.max(0, Math.min(1000, (value / total) * 1000))
    : 0
);

export const getPdfLineBox = <T extends {
  normalizedX: number;
  normalizedY: number;
  normalizedWidth: number;
  normalizedHeight: number;
  x?: number;
  y?: number;
  width?: number;
  height?: number;
}>(items: T[]) => {
  const left = Math.min(...items.map((item) => item.normalizedX));
  const top = Math.min(...items.map((item) => item.normalizedY));
  const right = Math.max(...items.map((item) => item.normalizedX + item.normalizedWidth));
  const bottom = Math.max(...items.map((item) => item.normalizedY + item.normalizedHeight));
  const rawLeft = Math.min(...items.map((item) => Number(item.x ?? item.normalizedX)));
  const rawTop = Math.min(...items.map((item) => Number(item.y ?? item.normalizedY)));
  const rawRight = Math.max(...items.map((item) => Number(item.x ?? item.normalizedX) + Number(item.width ?? item.normalizedWidth)));
  const rawBottom = Math.max(...items.map((item) => Number(item.y ?? item.normalizedY) + Number(item.height ?? item.normalizedHeight)));

  return {
    x: rawLeft,
    y: rawTop,
    width: Math.max(1, rawRight - rawLeft),
    height: Math.max(1, rawBottom - rawTop),
    normalizedX: left,
    normalizedY: top,
    normalizedWidth: Math.max(1, right - left),
    normalizedHeight: Math.max(1, bottom - top),
  };
};

export const buildLineTextFromPdfItems = (items: PositionedPdfTextItem[], rich = false) => items
  .slice()
  .sort((left, right) => left.normalizedX - right.normalizedX || left.rawIndex - right.rawIndex)
  .map((item) => {
    const text = rich && (item.bold || item.italic || item.underline)
      ? wrapHighlightedText(item.text, item)
      : rich
        ? escapeHtml(item.text)
        : item.text;
    return text.trim();
  })
  .filter(Boolean)
  .join(' ')
  .replace(/\s+([,.;:!?])/g, '$1')
  .trim();

export const makePdfTextLine = (
  items: PositionedPdfTextItem[],
  index: number,
  pageNumber: number,
): PdfTextLine => {
  const box = getPdfLineBox(items);
  return {
    text: buildLineTextFromPdfItems(items),
    richText: buildLineTextFromPdfItems(items, true),
    pageNumber,
    index,
    items: items.slice().sort((left, right) => left.normalizedX - right.normalizedX || left.rawIndex - right.rawIndex),
    ...box,
  };
};

export const reconstructPdfTextLines = (
  items: PositionedPdfTextItem[],
  pageNumber: number,
) => {
  const sorted = items
    .filter((item) => item.text.trim())
    .slice()
    .sort((left, right) => left.normalizedY - right.normalizedY || left.normalizedX - right.normalizedX || left.rawIndex - right.rawIndex);
  const rows: PositionedPdfTextItem[][] = [];

  sorted.forEach((item) => {
    const threshold = Math.max(4, Math.min(18, item.normalizedHeight * 0.7));
    const row = rows.find((candidate) => {
      const averageY = candidate.reduce((sum, current) => sum + current.normalizedY, 0) / candidate.length;
      return Math.abs(averageY - item.normalizedY) <= threshold;
    });
    if (row) {
      row.push(item);
    } else {
      rows.push([item]);
    }
  });

  const lines: PdfTextLine[] = [];
  rows
    .sort((left, right) => (
      Math.min(...left.map((item) => item.normalizedY))
      - Math.min(...right.map((item) => item.normalizedY))
    ))
    .forEach((row) => {
      const rowItems = row.slice().sort((left, right) => left.normalizedX - right.normalizedX || left.rawIndex - right.rawIndex);
      let segment: PositionedPdfTextItem[] = [];
      rowItems.forEach((item) => {
        const previous = segment[segment.length - 1];
        const gap = previous
          ? item.normalizedX - (previous.normalizedX + previous.normalizedWidth)
          : 0;
        const splitGap = Math.max(54, Math.min(150, (previous?.normalizedHeight || item.normalizedHeight || 10) * 4.2));
        if (previous && gap > splitGap && segment.length > 0) {
          lines.push(makePdfTextLine(segment, lines.length, pageNumber));
          segment = [item];
        } else {
          segment.push(item);
        }
      });
      if (segment.length > 0) {
        lines.push(makePdfTextLine(segment, lines.length, pageNumber));
      }
    });

  return lines;
};

export const detectPdfTextColumns = (lines: PdfTextLine[], pageNumber: number): PdfTextColumn[] => {
  if (lines.length === 0) {
    return [];
  }

  const leftLines = lines.filter((line) => line.normalizedX < 440 && line.normalizedX + line.normalizedWidth < 650);
  const rightLines = lines.filter((line) => line.normalizedX > 430);
  const hasTwoColumns = leftLines.length >= 4
    && rightLines.length >= 4
    && leftLines.length + rightLines.length >= Math.max(8, Math.floor(lines.length * 0.55));
  const splitX = hasTwoColumns ? 500 : 1000;
  const groups = hasTwoColumns
    ? [
        lines.filter((line) => line.normalizedX < splitX),
        lines.filter((line) => line.normalizedX >= splitX),
      ].filter((group) => group.length > 0)
    : [lines];

  return groups.map((group, index) => {
    const sortedLines = group
      .slice()
      .sort((left, right) => left.normalizedY - right.normalizedY || left.normalizedX - right.normalizedX);
    sortedLines.forEach((line) => {
      line.columnIndex = index;
    });
    const box = getPdfLineBox(sortedLines);
    return {
      pageNumber,
      index,
      lines: sortedLines,
      blocks: [],
      x: box.x,
      width: box.width,
      normalizedX: box.normalizedX,
      normalizedWidth: box.normalizedWidth,
    };
  });
};

export const makePdfTextBlock = (
  lines: PdfTextLine[],
  index: number,
  pageNumber: number,
): PdfTextBlock => {
  const box = getPdfLineBox(lines);
  return {
    text: normalizeStructuredText(lines.map((line) => line.text).filter(Boolean).join('\n')),
    richText: normalizeStructuredText(lines.map((line) => line.richText || escapeHtml(line.text)).filter(Boolean).join('\n')),
    pageNumber,
    index,
    lines,
    columnIndex: lines[0]?.columnIndex,
    ...box,
  };
};

export const reconstructPdfTextBlocks = (columns: PdfTextColumn[], pageNumber: number): PdfTextBlock[] => {
  const blocks: PdfTextBlock[] = [];
  columns.forEach((column) => {
    let currentLines: PdfTextLine[] = [];
    column.lines.forEach((line) => {
      const previous = currentLines[currentLines.length - 1];
      const verticalGap = previous
        ? line.normalizedY - (previous.normalizedY + previous.normalizedHeight)
        : 0;
      const startsNewQuestion = /^\s*(?:quest[aã]o\s*)?0*\d{1,3}\s*[).:-]/i.test(line.text)
        || /^\s*q\.?\s*0*\d{1,3}\b/i.test(line.text);
      const startsNewContext = isLikelySupportContextStartLine(line.text);
      const shouldBreak = Boolean(previous && (
        verticalGap > Math.max(18, previous.normalizedHeight * 1.9)
        || (startsNewQuestion && currentLines.length > 0)
        || (startsNewContext && currentLines.length > 1)
      ));

      if (shouldBreak && currentLines.length > 0) {
        blocks.push(makePdfTextBlock(currentLines, blocks.length, pageNumber));
        currentLines = [line];
      } else {
        currentLines.push(line);
      }
    });
    if (currentLines.length > 0) {
      blocks.push(makePdfTextBlock(currentLines, blocks.length, pageNumber));
    }
  });

  columns.forEach((column) => {
    column.blocks = blocks.filter((block) => block.columnIndex === column.index);
  });

  return blocks;
};

export const classifyPdfPageType = (
  plainText: string,
  questionMarkers: number,
): PdfPageData['pageType'] => {
  const clean = normalizeComparisonText(plainText);
  if (!clean) return 'blank';
  if (/\bgabarito\b/.test(clean) && /\b(?:questao|resposta|alternativa|anulada)\b/.test(clean)) return 'answer_key';
  if (/\b(?:redacao|discursiva|estudo de caso)\b/.test(clean)) return 'discursive';
  if (questionMarkers > 0 || /\b(?:assinale|julgue|marque|responda)\b/.test(clean)) return 'question_page';
  if (/\b(?:texto i|texto ii|leia o texto|considere o texto|para responder as questoes|observe a figura|analise a tabela)\b/.test(clean)) return 'context_page';
  if (/\b(?:instrucoes|instrucoes gerais|caderno de questoes|cartao resposta|assinatura do candidato)\b/.test(clean)) return 'instructions';
  if (/\b(?:concurso publico|processo seletivo|prova objetiva)\b/.test(clean) && clean.length < 3000) return 'cover';
  return 'unknown';
};

export const buildPlainTextFromPdfLayout = (columns: PdfTextColumn[], blocks: PdfTextBlock[]) => {
  if (columns.length > 0) {
    return normalizeStructuredText(columns
      .flatMap((column) => column.blocks.length > 0 ? column.blocks : [makePdfTextBlock(column.lines, 0, column.pageNumber)])
      .map((block) => block.text)
      .filter(Boolean)
      .join('\n\n'));
  }

  return normalizeStructuredText(blocks.map((block) => block.text).filter(Boolean).join('\n\n'));
};

export const buildRichTextFromPdfLayout = (columns: PdfTextColumn[], blocks: PdfTextBlock[]) => {
  if (columns.length > 0) {
    return normalizeStructuredText(columns
      .flatMap((column) => column.blocks.length > 0 ? column.blocks : [makePdfTextBlock(column.lines, 0, column.pageNumber)])
      .map((block) => block.richText)
      .filter(Boolean)
      .join('\n\n'));
  }

  return normalizeStructuredText(blocks.map((block) => block.richText).filter(Boolean).join('\n\n'));
};

export const mergeNormalizedPdfBoxes = (items: Array<Pick<PdfTextLine, 'normalizedX' | 'normalizedY' | 'normalizedWidth' | 'normalizedHeight'>>) => {
  if (items.length === 0) {
    return undefined;
  }

  const left = Math.min(...items.map((item) => item.normalizedX));
  const top = Math.min(...items.map((item) => item.normalizedY));
  const right = Math.max(...items.map((item) => item.normalizedX + item.normalizedWidth));
  const bottom = Math.max(...items.map((item) => item.normalizedY + item.normalizedHeight));
  const margin = 24;

  return {
    x: Math.max(0, Math.round(left - margin)),
    y: Math.max(0, Math.round(top - margin)),
    width: Math.min(1000, Math.round((right - left) + (margin * 2))),
    height: Math.min(1000, Math.round((bottom - top) + (margin * 2))),
  } satisfies FigureBox;
};

export const REFERENCE_BLOCK_PATTERN = /\b(?:dispon[ií]vel\s+em|acesso\s+em|adaptad[ao]\s+de|adaptad[ao]|fonte|internet|fragmento\s+adaptado|in\s*:)\b|https?:\/\/|www\./i;
export const VISUAL_BLOCK_PATTERN = new RegExp(`\\b(?:${VISUAL_CONTEXT_TERMS_PATTERN})\\b`, 'i');
export const VISUAL_INSTRUCTION_PATTERN = new RegExp(`\\b(?:observe|analise|considere|com\\s+base)\\b.{0,80}\\b(?:${VISUAL_CONTEXT_TERMS_PATTERN})\\b`, 'i');
export const TABLE_BLOCK_PATTERN = /\b(?:tabela|quadro)\s*(?:[ivxlc]+|\d+)?\b/i;

export const getPageBlockBox = (block: PdfTextBlock): FigureBox => ({
  x: Math.max(0, Math.round(block.normalizedX)),
  y: Math.max(0, Math.round(block.normalizedY)),
  width: Math.max(1, Math.min(1000, Math.round(block.normalizedWidth))),
  height: Math.max(1, Math.min(1000, Math.round(block.normalizedHeight))),
});

export const toNumericFigureBox = (box?: FigureBox) => {
  if (!box) {
    return undefined;
  }
  return {
    x: Number(box.x || 0),
    y: Number(box.y || 0),
    width: Number(box.width || 0),
    height: Number(box.height || 0),
  };
};

export const getBlockQuestionMarker = (value: string) => {
  const clean = stripHtml(value).replace(/\s+/g, ' ').trim();
  const match = clean.match(/^(?:quest[aã]o\s*)?0*(\d{1,3})\s*[).:-]/i)
    || clean.match(/^q\.?\s*0*(\d{1,3})\b/i)
    || clean.match(/^item\s*0*(\d{1,3})\b/i);
  return match ? Number(match[1]) : 0;
};

export const blockLooksLikeTextTable = (block: PdfTextBlock) => {
  const structured = normalizeStructuredText(block.text);
  const lines = structured.split('\n').map((line) => line.trim()).filter(Boolean);
  if (TABLE_BLOCK_PATTERN.test(structured) && lines.length >= 2) {
    return true;
  }
  if (lines.length >= 2 && lines.filter((line) => (line.match(/\|/g) || []).length >= 2).length >= 2) {
    return true;
  }
  const rowLikeLines = block.lines.filter((line) => line.items.length >= 3);
  return rowLikeLines.length >= 2
    && rowLikeLines.length >= Math.ceil(block.lines.length * 0.55);
};

export const classifyPageContentBlock = (
  block: PdfTextBlock,
  pageData: Pick<PdfPageData, 'pageNumber'>,
): PageContentBlock => {
  const text = normalizeStructuredText(block.text);
  const clean = stripHtml(text).replace(/\s+/g, ' ').trim();
  const questionNumber = getBlockQuestionMarker(clean);
  const explicitQuestionNumbers = extractExplicitContextQuestionNumbers(clean);
  const reasons: string[] = [];
  let type: PageContentBlockType = 'unknown';
  let confidence = 0.4;

  if (
    block.normalizedY <= 72
    && clean.length < 180
    && (COMMON_PAGE_HEADER_PATTERN.test(clean) || isLikelyPageBookletHeader(clean))
  ) {
    type = 'header';
    confidence = 0.9;
    reasons.push('regiao_superior_com_sinal_de_cabecalho');
  } else if (
    block.normalizedY + block.normalizedHeight >= 930
    && clean.length < 180
    && COMMON_FOOTER_PATTERN.test(clean)
  ) {
    type = 'footer';
    confidence = 0.9;
    reasons.push('regiao_inferior_com_sinal_de_rodape');
  } else if (questionNumber > 0) {
    type = 'question_marker';
    confidence = 0.96;
    reasons.push('marcador_numerico_de_questao');
  } else if (/^\s*(?:alternativa\s+)?\(?[A-F]\)?\s*[).:;\-–—]\s*/i.test(clean)) {
    type = 'option';
    confidence = 0.94;
    reasons.push('marcador_de_alternativa');
  } else if (explicitQuestionNumbers.length >= 2) {
    type = 'shared_context';
    confidence = 0.98;
    reasons.push('escopo_explicito_para_multiplas_questoes');
  } else if (REFERENCE_BLOCK_PATTERN.test(clean)) {
    type = 'reference';
    confidence = 0.88;
    reasons.push('marcador_bibliografico_ou_url');
  } else if (blockLooksLikeTextTable(block)) {
    type = 'table';
    confidence = 0.82;
    reasons.push('estrutura_tabular_posicional');
  } else if (
    isLikelySupportContextStartLine(clean)
    || /^(?:considere|considerando)\s+(?:a\s+)?(?:seguinte\s+)?(?:situa[cç][aã]o|caso|hip[oó]tese|fragmento|trecho)\b/i.test(clean)
    || supportContextSignalPattern.test(clean)
  ) {
    type = explicitQuestionNumbers.length === 1 || !contextHasPluralQuestionDirective(clean)
      ? 'individual_support'
      : 'shared_context';
    confidence = explicitQuestionNumbers.length > 0 ? 0.94 : 0.78;
    reasons.push(explicitQuestionNumbers.length > 0 ? 'escopo_explicito' : 'sinal_de_texto_base');
  } else if (VISUAL_INSTRUCTION_PATTERN.test(clean) || (VISUAL_BLOCK_PATTERN.test(clean) && clean.length < 180)) {
    type = 'figure';
    confidence = 0.68;
    reasons.push('indicacao_textual_de_recurso_visual');
  } else if (isLikelyInstructionText(clean)) {
    type = 'instruction';
    confidence = 0.76;
    reasons.push('instrucao_geral');
  } else if (questionCommandPattern.test(clean) && clean.length >= 12) {
    type = 'question_text';
    confidence = 0.68;
    reasons.push('comando_de_questao_sem_marcador_no_bloco');
  }

  return {
    id: `pag-${pageData.pageNumber}-bloco-${block.index + 1}`,
    pageNumber: pageData.pageNumber,
    type,
    text,
    richText: block.richText,
    boundingBox: getPageBlockBox(block),
    columnIndex: block.columnIndex,
    confidence,
    linkedQuestionNumbers: explicitQuestionNumbers,
    reasons,
  };
};

export const inferContextTitleFromBlockText = (value: string, fallback: string) => {
  const clean = stripHtml(value).replace(/\s+/g, ' ').trim();
  const combinedTexts = clean.match(/\bTextos?\s+[IVXLC\d]+\s*(?:e|,|\/)\s*[IVXLC\d]+\b/i)?.[0];
  if (combinedTexts) {
    return combinedTexts.replace(/^texto\b/i, 'Textos');
  }
  const named = clean.match(/\b(?:Textos?|Figura|Tabela|Quadro)\s+(?:[IVXLC]+|\d+)\b/i)?.[0];
  return named || fallback;
};

export const sameQuestionScope = (left: number[] = [], right: number[] = []) => {
  if (left.length === 0 || right.length === 0) {
    return true;
  }
  return left.some((number) => right.includes(number));
};

export const buildPageContentInventory = (
  pageData: Pick<PdfPageData, 'pageNumber' | 'blocks' | 'pageType'>,
): PageContentBlock[] => {
  const contentBlocks = pageData.blocks.map((block) => classifyPageContentBlock(block, pageData));
  const questionMarkers = contentBlocks
    .map((block, index) => ({
      index,
      number: block.type === 'question_marker' ? getBlockQuestionMarker(block.text) : 0,
      block,
    }))
    .filter((entry) => entry.number > 0);

  const nextQuestionAfter = (index: number) => questionMarkers.find((entry) => entry.index > index);
  const previousQuestionBefore = (index: number) => questionMarkers
    .slice()
    .reverse()
    .find((entry) => entry.index < index);

  contentBlocks.forEach((block, index) => {
    if (block.type === 'shared_context' && (block.linkedQuestionNumbers || []).length === 0) {
      const following = questionMarkers
        .filter((entry) => entry.index > index)
        .slice(0, 8)
        .filter((entry) => textNeedsExternalSupportContext(entry.block.text));
      block.linkedQuestionNumbers = following.map((entry) => entry.number);
      if (block.linkedQuestionNumbers.length >= 2) {
        block.reasons.push('escopo_inferido_pelo_uso_nas_questoes_seguintes');
      }
    }

    if (
      ['individual_support', 'reference', 'figure', 'table', 'unknown'].includes(block.type)
      && (block.linkedQuestionNumbers || []).length === 0
    ) {
      const nextQuestion = nextQuestionAfter(index);
      const previousQuestion = previousQuestionBefore(index);
      const linkedNumber = nextQuestion?.number || previousQuestion?.number || 0;
      if (linkedNumber > 0) {
        block.linkedQuestionNumbers = [linkedNumber];
        block.reasons.push(nextQuestion ? 'vinculo_por_proximidade_anterior' : 'vinculo_por_proximidade_posterior');
      }
    }
  });

  const syntheticVisualBlocks: PageContentBlock[] = [];
  contentBlocks.forEach((block, index) => {
    const hasVisualCue = VISUAL_INSTRUCTION_PATTERN.test(block.text)
      || (
        ['question_marker', 'question_text', 'shared_context', 'individual_support'].includes(block.type)
        && VISUAL_BLOCK_PATTERN.test(block.text)
      );
    if (!hasVisualCue) {
      return;
    }
    const next = contentBlocks.slice(index + 1).find((candidate) => (
      candidate.columnIndex === block.columnIndex
      || block.boundingBox.width && Number(block.boundingBox.width) >= 700
    ));
    if (!next) {
      return;
    }
    const top = Number(block.boundingBox.y || 0) + Number(block.boundingBox.height || 0) + 8;
    const bottom = Number(next.boundingBox.y || 0) - 8;
    if (bottom - top < 42) {
      return;
    }
    syntheticVisualBlocks.push({
      id: `${block.id}-regiao-visual`,
      pageNumber: block.pageNumber,
      type: TABLE_BLOCK_PATTERN.test(block.text) ? 'table' : 'figure',
      text: '',
      boundingBox: {
        x: Math.max(0, Math.min(Number(block.boundingBox.x || 0), Number(next.boundingBox.x || 0))),
        y: top,
        width: Math.min(1000, Math.max(
          Number(block.boundingBox.width || 0),
          Number(next.boundingBox.width || 0),
        )),
        height: bottom - top,
      },
      columnIndex: block.columnIndex,
      confidence: 0.72,
      linkedQuestionNumbers: block.linkedQuestionNumbers,
      reasons: ['regiao_visual_inferida_por_espaco_entre_blocos'],
    });
  });

  return [...contentBlocks, ...syntheticVisualBlocks];
};

export const mergeExtractionContextList = (
  contexts: NonNullable<PageExtractionResult['pageContexts']>,
): NonNullable<PageExtractionResult['pageContexts']> => {
  const merged: NonNullable<PageExtractionResult['pageContexts']> = [];

  contexts.forEach((context) => {
    const textParts = splitQuestionSupportReference(String(context.text || context.richText || ''));
    const text = sanitizeSupportContextText(textParts.supportText || String(context.text || context.richText || ''));
    const referenceText = mergeReferenceText(context.referenceText || '', textParts.referenceText);
    const questionNumbers = resolveScopedContextQuestionNumbers(
      context.appliesToQuestionNumbers || [],
      text,
      referenceText,
      context.title,
    );
    const normalizedText = normalizeComparisonText(text);
    const box = normalizeExtractionFigureBox(context.figureBox);
    const existing = merged.find((candidate) => {
      const candidateText = normalizeComparisonText(String(candidate.text || candidate.richText || ''));
      const candidateBox = normalizeExtractionFigureBox(candidate.figureBox);
      const sameText = normalizedText.length >= 40
        && candidateText.length >= 40
        && (
          normalizedText === candidateText
          || normalizedText.includes(candidateText)
          || candidateText.includes(normalizedText)
        );
      const sameBox = Boolean(
        box
        && candidateBox
        && Number(context.sourcePage || 0) === Number(candidate.sourcePage || 0)
        && Math.abs(Number(box.x) - Number(candidateBox.x)) <= 18
        && Math.abs(Number(box.y) - Number(candidateBox.y)) <= 18
        && Math.abs(Number(box.width) - Number(candidateBox.width)) <= 28
        && Math.abs(Number(box.height) - Number(candidateBox.height)) <= 28
      );
      return sameQuestionScope(questionNumbers, candidate.appliesToQuestionNumbers || [])
        && (sameText || sameBox);
    });

    if (!existing) {
      merged.push({
        ...context,
        text,
        referenceText,
        appliesToQuestionNumbers: questionNumbers,
      });
      return;
    }

    const existingText = String(existing.text || existing.richText || '');
    if (stripHtml(text).length > stripHtml(existingText).length) {
      existing.text = text;
      existing.richText = context.richText || existing.richText;
    }
    existing.referenceText = mergeReferenceText(existing.referenceText || '', referenceText);
    existing.appliesToQuestionNumbers = resolveScopedContextQuestionNumbers(
      Array.from(new Set([
        ...(existing.appliesToQuestionNumbers || []),
        ...questionNumbers,
      ])).sort((left, right) => left - right),
      existing.text,
      existing.referenceText,
      existing.title,
      context.title,
    );
    existing.hasFigure = Boolean(existing.hasFigure || context.hasFigure);
    existing.figureBox = existing.figureBox || context.figureBox;
    existing.figureDescription = Array.from(new Set([
      existing.figureDescription,
      context.figureDescription,
    ].map((value) => String(value || '').trim()).filter(Boolean))).join('\n\n');
    existing.figures = [
      ...(existing.figures || []),
      ...(context.figures || []),
    ].filter((figure, index, list) => {
      const signature = [
        figure.figureKey,
        figure.page,
        figure.figureBox?.x,
        figure.figureBox?.y,
        figure.figureBox?.width,
        figure.figureBox?.height,
      ].join(':');
      return list.findIndex((candidate) => [
        candidate.figureKey,
        candidate.page,
        candidate.figureBox?.x,
        candidate.figureBox?.y,
        candidate.figureBox?.width,
        candidate.figureBox?.height,
      ].join(':') === signature) === index;
    });
  });

  return merged;
};

export const extractContextsFromPageInventory = (
  inventory: PageContentBlock[],
  pageNumber: number,
): NonNullable<PageExtractionResult['pageContexts']> => {
  const contexts: NonNullable<PageExtractionResult['pageContexts']> = [];
  const ordered = inventory.filter((block) => !block.id.endsWith('-regiao-visual'));

  ordered.forEach((block, index) => {
    const explicitQuestionNumbers = extractExplicitContextQuestionNumbers(block.text);
    const questionNumbers = explicitQuestionNumbers.length >= 2
      ? explicitQuestionNumbers
      : block.type === 'shared_context'
        ? block.linkedQuestionNumbers || []
        : [];
    if (block.type !== 'shared_context' || questionNumbers.length < 2) {
      return;
    }

    const contentBlocks: PageContentBlock[] = [block];
    for (let cursor = index + 1; cursor < ordered.length; cursor += 1) {
      const candidate = ordered[cursor];
      if (candidate.type === 'shared_context') {
        break;
      }
      if (candidate.type === 'question_marker') {
        const number = getBlockQuestionMarker(candidate.text);
        if (questionNumbers.includes(number)) {
          break;
        }
      }
      if (['header', 'footer', 'instruction'].includes(candidate.type)) {
        continue;
      }
      if (
        (candidate.linkedQuestionNumbers || []).length > 0
        && !sameQuestionScope(candidate.linkedQuestionNumbers, questionNumbers)
      ) {
        break;
      }
      contentBlocks.push(candidate);
    }

    const textualContent = contentBlocks
      .filter((candidate) => !['figure'].includes(candidate.type))
      .map((candidate) => candidate.richText || candidate.text)
      .filter(Boolean)
      .join('\n\n');
    const split = splitQuestionSupportReference(textualContent);
    const contextText = sanitizeSupportContextText(split.supportText || textualContent);
    const visualBlocks = inventory.filter((candidate) => (
      (
        candidate.type === 'figure'
        || (
          candidate.type === 'table'
          && (candidate.id.endsWith('-regiao-visual') || !stripHtml(candidate.text).trim())
        )
      )
      && sameQuestionScope(candidate.linkedQuestionNumbers, questionNumbers)
      && (
        !candidate.id.endsWith('-regiao-visual')
        || (
          (candidate.linkedQuestionNumbers || []).length >= 2
          && (candidate.linkedQuestionNumbers || []).every((number) => questionNumbers.includes(number))
        )
      )
      && (
        candidate.id.endsWith('-regiao-visual')
        || contentBlocks.some((contentBlock) => contentBlock.id === candidate.id)
      )
    ));
    const title = inferContextTitleFromBlockText(
      [block.text, contextText].join(' '),
      `Texto de apoio - questões ${questionNumbers.join(', ')}`,
    );
    const contextKey = `pag-${pageNumber}-contexto-${questionNumbers[0]}-${questionNumbers[questionNumbers.length - 1]}-${slugify(title)}`;

    contexts.push({
      contextKey,
      title,
      text: contextText,
      richText: contextText,
      referenceText: split.referenceText,
      sourcePage: pageNumber,
      appliesToQuestionNumbers: questionNumbers,
      hasFigure: visualBlocks.length > 0,
      figureDescription: visualBlocks.length > 0
        ? `Recurso visual compartilhado: ${visualBlocks.some((item) => item.type === 'table') ? 'tabela/quadro' : 'figura/imagem'}.`
        : '',
      figureBox: toNumericFigureBox(visualBlocks[0]?.boundingBox),
      figures: visualBlocks.map((visual, visualIndex) => ({
        figureKey: `${contextKey}-fig-${String(visualIndex + 1).padStart(2, '0')}`,
        type: visual.type,
        description: visual.type === 'table' ? 'Tabela ou quadro compartilhado' : 'Figura compartilhada',
        figureBox: toNumericFigureBox(visual.boundingBox),
        page: pageNumber,
        order: visualIndex + 1,
      })),
    });
  });

  return mergeExtractionContextList(contexts);
};

export const enrichMechanicalExtractionFromInventory = (
  extraction: PageExtractionResult,
  inventory: PageContentBlock[],
  pageNumber: number,
): PageExtractionResult => {
  const inventoryContexts = extractContextsFromPageInventory(inventory, pageNumber);
  const contexts = mergeExtractionContextList([
    ...(extraction.pageContexts || []),
    ...inventoryContexts,
  ]);
  const contextByQuestion = new Map<number, NonNullable<PageExtractionResult['pageContexts']>[number]>();
  contexts
    .slice()
    .sort((left, right) => (
      (left.appliesToQuestionNumbers?.length || 999)
      - (right.appliesToQuestionNumbers?.length || 999)
    ))
    .forEach((context) => {
      (context.appliesToQuestionNumbers || []).forEach((number) => {
        if (!contextByQuestion.has(number)) {
          contextByQuestion.set(number, context);
        }
      });
    });

  const questions = (extraction.questions || []).map((question) => {
    const draft = question as ImportedQuestionDraft;
    const number = normalizeQuestionNumber(draft.questionNumber ?? draft.number, 0);
    const context = contextByQuestion.get(number);
    const singleBlocks = inventory.filter((block) => (
      (block.linkedQuestionNumbers || []).length === 1
      && block.linkedQuestionNumbers?.[0] === number
      && ['individual_support', 'reference', 'figure', 'table', 'unknown'].includes(block.type)
      && !contexts.some((candidate) => (
        (candidate.appliesToQuestionNumbers || []).includes(number)
        && sameQuestionScope(block.linkedQuestionNumbers, candidate.appliesToQuestionNumbers)
        && ['shared_context', 'reference', 'figure', 'table'].includes(block.type)
      ))
    ));
    const supportBlocks = singleBlocks.filter((block) => ['individual_support', 'table', 'unknown'].includes(block.type));
    const referenceBlocks = singleBlocks.filter((block) => block.type === 'reference');
    const visualBlocks = inventory.filter((block) => (
      (
        block.type === 'figure'
        || (
          block.type === 'table'
          && (block.id.endsWith('-regiao-visual') || !stripHtml(block.text).trim())
        )
      )
      && (block.linkedQuestionNumbers || []).length === 1
      && block.linkedQuestionNumbers?.[0] === number
      && !context
    ));
    const supportTextCandidate = supportBlocks
      .map((block) => block.richText || block.text)
      .filter((text) => stripHtml(String(text || '')).trim().length >= 20)
      .join('\n\n');
    const supportParts = splitQuestionSupportReference(supportTextCandidate);
    const supportText = String(draft.supportText || draft.introText || supportParts.supportText || '').trim();
    const referenceText = mergeReferenceText(
      String(draft.referenceText || ''),
      supportParts.referenceText,
      ...referenceBlocks.map((block) => block.text),
    );
    const supportFigureBoxes = normalizeExtractionFigureBoxes(
      draft.supportFigureBoxes,
      draft.supportFigureBox,
      ...visualBlocks.map((block) => block.boundingBox),
    ).map((box) => toNumericFigureBox(box)).filter(Boolean) as Array<{
      x: number;
      y: number;
      width: number;
      height: number;
    }>;
    const statusReasons = Array.from(new Set([
      ...(draft.statusReasons || []),
      ...(draft.validationReasons || []),
    ])).filter((reason) => {
      if (
        (context || supportText)
        && ['contexto_referenciado_nao_encontrado', 'texto_apoio_referenciado_nao_encontrado'].includes(reason)
      ) {
        return false;
      }
      if (
        (context?.hasFigure || supportFigureBoxes.length > 0)
        && ['figura_sem_recorte', 'figura_referenciada_nao_encontrada', 'tabela_visual_sem_recorte', 'tabela_referenciada_nao_encontrada'].includes(reason)
      ) {
        return false;
      }
      return true;
    });

    return {
      ...question,
      contextKey: context?.contextKey || draft.contextKey,
      contextTitle: context?.title || draft.contextTitle,
      supportText,
      introText: supportText,
      referenceText,
      hasFigure: Boolean(draft.hasFigure || context?.hasFigure || supportFigureBoxes.length > 0),
      supportFigureBox: toNumericFigureBox(draft.supportFigureBox) || supportFigureBoxes[0],
      supportFigureBoxes,
      statusReasons,
      validationReasons: statusReasons,
    };
  });

  return {
    ...extraction,
    pageContexts: contexts,
    questions,
  };
};

export const estimatePdfQuestionRegionBox = (
  pageData: PdfPageData | PdfPageRichText | undefined,
  targetQuestionNumbers: number[],
): FigureBox | undefined => {
  const lines = Array.isArray(pageData?.lines) ? pageData.lines : [];
  if (lines.length === 0 || targetQuestionNumbers.length === 0) {
    return undefined;
  }

  const targetSet = new Set(targetQuestionNumbers.map((number) => Number(number)).filter((number) => number > 0));
  const markerAtLine = (line: PdfTextLine) => {
    const clean = stripHtml(line.text).replace(/\s+/g, ' ').trim();
    const match = clean.match(/^(?:quest[aã]o\s*)?0*(\d{1,3})\s*[).:-]/i)
      || clean.match(/^q\.?\s*0*(\d{1,3})\b/i)
      || clean.match(/^item\s*0*(\d{1,3})\b/i);
    return match ? Number(match[1]) : 0;
  };

  const sortedLines = lines
    .slice()
    .sort((left, right) => (
      (left.columnIndex ?? 0) - (right.columnIndex ?? 0)
      || left.normalizedY - right.normalizedY
      || left.normalizedX - right.normalizedX
    ));

  const selectedLines: PdfTextLine[] = [];
  let collecting = false;
  for (let index = 0; index < sortedLines.length; index += 1) {
    const line = sortedLines[index];
    const marker = markerAtLine(line);
    if (marker > 0) {
      if (targetSet.has(marker)) {
        collecting = true;
      } else if (collecting && selectedLines.length > 0) {
        break;
      }
    }

    if (collecting) {
      selectedLines.push(line);
    }
  }

  if (selectedLines.length === 0) {
    return undefined;
  }

  return mergeNormalizedPdfBoxes(selectedLines);
};

export const shouldIgnoreDominantHighlight = (items: PdfTextHighlight[], field: 'bold' | 'italic' | 'underline') => {
  const meaningfulItems = items.filter((item) => isMeaningfulHighlightText(item.text));
  if (meaningfulItems.length < 12) {
    return false;
  }
  const highlightedCount = meaningfulItems.filter((item) => item[field]).length;
  return highlightedCount / meaningfulItems.length > 0.72;
};

export const applyPdfHighlightsToHtml = (value: string, highlights: PdfTextHighlight[]) => {
  if (!value || highlights.length === 0) {
    return value;
  }

  let output = value;
  const candidateHighlights = highlights
    .filter((highlight) => isMeaningfulHighlightText(highlight.text))
    .filter((highlight) => (
      stripHtml(output).replace(/\s+/g, ' ').toLowerCase()
        .includes(stripHtml(highlight.text).replace(/\s+/g, ' ').toLowerCase())
    ))
    .sort((left, right) => right.text.length - left.text.length)
    .slice(0, 30);

  candidateHighlights.forEach((highlight) => {
    const cleanText = stripHtml(highlight.text).replace(/\s+/g, ' ').trim();
    if (!cleanText) {
      return;
    }

    const pattern = new RegExp(escapeRegExp(cleanText).replace(/\s+/g, '\\s+'), 'i');
    output = output.replace(pattern, (match, offset: number, fullText: string) => {
      const before = fullText.slice(Math.max(0, offset - 48), offset);
      const after = fullText.slice(offset + match.length, offset + match.length + 48);
      if (/<(?:strong|b|em|i|u)[^>]*>[^<]*$/i.test(before) && /^<\/(?:strong|b|em|i|u)>/i.test(after)) {
        return match;
      }

      return wrapHighlightedText(match, highlight);
    });
  });

  return output;
};

export const ENEM_AREA_NORMALIZED_NAMES = new Set(
  ENEM_SUBJECT_AREA_OPTIONS.map((areaName) => normalizeComparisonText(areaName)),
);

export const ENEM_DISCIPLINE_LABELS = Object.values(ENEM_SUBJECT_AREA_DESCRIPTIONS).flat();

export const ENEM_DISCIPLINE_KEYWORDS: Array<{ label: string; keywords: string[] }> = [
  { label: 'Lingua Portuguesa', keywords: ['lingua portuguesa', 'portugues', 'gramatica', 'interpretacao de texto', 'crase', 'regencia', 'concordancia', 'coesao', 'coerencia'] },
  { label: 'Literatura', keywords: ['literatura', 'poesia', 'poema', 'romance', 'narrador', 'modernismo', 'barroco', 'arcadismo'] },
  { label: 'Lingua Estrangeira (Ingles ou Espanhol)', keywords: ['ingles', 'espanhol', 'english', 'spanish', 'foreign language'] },
  { label: 'Artes', keywords: ['arte', 'artes', 'pintura', 'escultura', 'musica', 'teatro', 'danca', 'cinema'] },
  { label: 'Educacao Fisica', keywords: ['educacao fisica', 'esporte', 'atividade fisica', 'corpo', 'jogo', 'lazer'] },
  { label: 'Tecnologias da Informacao e Comunicacao', keywords: ['tecnologia da informacao', 'tecnologias da informacao', 'tic', 'internet', 'rede social', 'midia digital'] },
  { label: 'Historia (Geral e Brasil)', keywords: ['historia', 'brasil colonial', 'republica', 'imperio', 'revolucao', 'guerra', 'ditadura', 'escravidao'] },
  { label: 'Geografia', keywords: ['geografia', 'clima', 'relevo', 'territorio', 'urbanizacao', 'cartografia', 'globalizacao', 'demografia'] },
  { label: 'Filosofia', keywords: ['filosofia', 'etica', 'moral', 'platao', 'aristoteles', 'kant', 'descartes', 'socrates'] },
  { label: 'Sociologia', keywords: ['sociologia', 'sociedade', 'cultura', 'classe social', 'movimento social', 'trabalho', 'desigualdade'] },
  { label: 'Quimica', keywords: ['quimica', 'molecula', 'atomo', 'reacao', 'solucao', 'ph', 'estequiometria', 'tabela periodica', 'ligacao quimica'] },
  { label: 'Fisica', keywords: ['fisica', 'forca', 'energia', 'calor', 'onda', 'ondas', 'ressonancia', 'frequencia', 'comprimento de onda', 'velocidade', 'movimento', 'grafico', 'luz', 'espectro', 'luminescencia', 'fluido', 'irradiacao'] },
  { label: 'Biologia', keywords: ['biologia', 'celula', 'genetica', 'organismo', 'anfibio', 'veneno', 'toxina', 'bacteria', 'virus', 'vacina', 'evolucao'] },
  { label: 'Ecologia', keywords: ['ecologia', 'ecossistema', 'cadeia alimentar', 'biodiversidade', 'bioma', 'populacao', 'relacao ecologica'] },
  { label: 'Impactos Ambientais', keywords: ['impacto ambiental', 'poluicao', 'aquecimento global', 'mudancas climaticas', 'desmatamento', 'emissoes', 'co2'] },
  { label: 'Saude', keywords: ['saude', 'doenca', 'epidemiologia', 'saneamento', 'vacina', 'tratamento', 'recem nascido'] },
  { label: 'Algebra', keywords: ['algebra', 'equacao', 'funcao', 'sistema linear', 'polinomio', 'inequacao'] },
  { label: 'Geometria', keywords: ['geometria', 'area', 'volume', 'angulo', 'triangulo', 'circunferencia', 'poligono', 'plano cartesiano'] },
  { label: 'Estatistica', keywords: ['estatistica', 'media', 'mediana', 'moda', 'probabilidade', 'desvio padrao', 'grafico estatistico'] },
  { label: 'Matematica Financeira', keywords: ['matematica financeira', 'juros', 'porcentagem', 'desconto', 'taxa', 'parcelamento'] },
  { label: 'Raciocinio Logico', keywords: ['raciocinio logico', 'logica', 'proposicao', 'sequencia logica', 'argumento'] },
  { label: 'Matematica', keywords: ['matematica', 'numero', 'razao', 'proporcao', 'sequencia', 'pa', 'pg', 'calculo'] },
];

export const hasMeaningfulTextOverlap = (left: string, right: string) => {
  const normalizedLeft = normalizeComparisonText(left);
  const normalizedRight = normalizeComparisonText(right);
  if (normalizedLeft.length < 80 || normalizedRight.length < 80) {
    return false;
  }

  return normalizedLeft.includes(normalizedRight.slice(0, 80))
    || normalizedRight.includes(normalizedLeft.slice(0, 80));
};

export const normalizeQuestionNumber = (value: unknown, fallback: number) => {
  const match = String(value ?? '').match(/\d+/);
  const parsed = match ? Number(match[0]) : fallback;
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

export const readImportBooleanFlag = (value: unknown) => {
  if (typeof value === 'boolean') {
    return value;
  }
  if (typeof value === 'number') {
    return value === 1;
  }

  const normalized = String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase();

  if (['', '0', 'false', 'no', 'n', 'nao', 'null', 'undefined'].includes(normalized)) {
    return false;
  }
  if (['1', 'true', 'yes', 'y', 'sim', 's'].includes(normalized)) {
    return true;
  }

  return Boolean(value);
};

export const isImportedQuestionMarkedCanceled = (question: Question | ImportedQuestionDraft) => {
  const draft = question as ImportedQuestionDraft;
  return readImportBooleanFlag(draft.anulada)
    || readImportBooleanFlag(draft.isCanceled)
    || readImportBooleanFlag(draft.isCancelled)
    || readImportBooleanFlag(draft.isCanceledQuestion)
    || readImportBooleanFlag(draft.isCancelledQuestion)
    || readImportBooleanFlag(draft.is_cancelled);
};

export const isImportedQuestionAttributedToAll = (question: Question | ImportedQuestionDraft) => {
  const draft = question as ImportedQuestionDraft;
  return readImportBooleanFlag(draft.isAttributedToAll)
    || readImportBooleanFlag(draft.attributedToAll)
    || readImportBooleanFlag(draft.is_attributed_to_all);
};

export const normalizeCanceledImportedQuestion = (
  question: Question,
  canceledOverride?: boolean,
  attributedToAllOverride?: boolean,
): Question => {
  const inferredCanceled = isImportedQuestionMarkedCanceled(question);
  const isCanceled = canceledOverride ?? inferredCanceled;
  const inferredAttributedToAll = isImportedQuestionAttributedToAll(question);
  const isAttributedToAll = attributedToAllOverride ?? inferredAttributedToAll;

  if (!isCanceled && !isAttributedToAll) {
    return question;
  }

  const firstOptionId = Array.isArray(question.itens) && question.itens.length > 0
    ? Number(question.itens[0].id || 1)
    : 1;
  const currentAnswer = Number(question.resposta);
  const resposta = Number.isFinite(currentAnswer) && currentAnswer > 0
    ? currentAnswer
    : Number.isFinite(firstOptionId) && firstOptionId > 0
      ? firstOptionId
      : 1;

  return {
    ...question,
    ...(isCanceled
      ? {
          anulada: true,
          isCanceled: true,
          isCancelled: true,
          isCanceledQuestion: true,
          isCancelledQuestion: true,
          is_cancelled: true,
        }
      : {}),
    ...(isAttributedToAll
      ? {
          isAttributedToAll: true,
          attributedToAll: true,
          is_attributed_to_all: true,
        }
      : {}),
    correctOptionIndex: 0,
    resposta,
  } as unknown as Question;
};

export const instructionPattern = /\b(instru[cç][oõ]es|cart[aã]o[- ]resposta|prova objetiva|rascunho|transcreva|assine|dura[cç][aã]o|caderno de quest[oõ]es|aten[cç][aã]o|folha de respostas)\b/i;
export const questionCommandPattern = /\b(quest[aã]o|assinale|julgue|considere|responda|marque|com base|de acordo|nesse contexto|neste contexto|nesse sentido|neste sentido|infere-se|no que se refere|observe|analise|a partir|segundo|qual|quais|acerca|em rela[cç][aã]o|sobre|o texto|a figura|o gr[aá]fico|o esquema|a tabela)\b/i;

export const isLikelyInstructionText = (value: string) => {
  const clean = stripHtml(value).replace(/\s+/g, ' ').trim();
  if (clean.length < 18) {
    return true;
  }
  if (instructionPattern.test(clean) && !questionCommandPattern.test(clean)) {
    return true;
  }
  return false;
};

export const normalizeContextClassifierText = (value: string) => stripHtml(String(value || ''))
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .replace(/[ºª]/g, '')
  .replace(/\s+/g, ' ')
  .trim()
  .toUpperCase();

export const pageBookletHeaderPattern = /\b(CIENCIAS DA NATUREZA E SUAS TECNOLOGIAS|CIENCIAS HUMANAS E SUAS TECNOLOGIAS|LINGUAGENS(?: CODIGOS)? E SUAS TECNOLOGIAS|MATEMATICA E SUAS TECNOLOGIAS|CADERNO\s+\d+|QUESTOES?\s+DE\s+\d+\s+A\s+\d+|[12]\s*DIA|AMAREL[OA]|AZUL|ROSA|BRANC[OA]|CINZA|PROVA\s+(?:AMAREL[OA]|AZUL|ROSA|BRANC[OA]|CINZA))\b/i;
export const supportContextSignalPattern = new RegExp(`\\b(TEXTOS?\\s+(?:[IVXLC]+|\\d+)|leia\\s+os?\\s+textos?|leia\\s+o\\s+texto\\s+abaixo|considere\\s+o\\s+texto|considere\\s+as\\s+(?:(?:\\w+)\\s+){0,4}passagens|para\\s+responder(?:\\s+[aà]s?)?\\s+(?:quest(?:[oõ]es|oes)|itens?)|texto\\s+para\\s+(?:(?:responder|os?|as?)\\s+)*(?:quest(?:[oõ]es|oes)|itens?)|(?:quest(?:[oõ]es|oes)|itens?)\\s+(?:de(?:\\s+n[uú]meros?)?\\s+)?\\d{1,3}\\s*(?:a|ate|-)\\s*\\d{1,3}|aten[cç][aã]o\\s*:\\s*para\\s+responder|com\\s+base\\s+no\\s+texto|no\\s+trecho\\s+destacado|na\\s+figura|na\\s+tabela|fragmento|adaptad[ao]|dispon[ií]vel em|acesso em|fonte|${VISUAL_CONTEXT_TERMS_PATTERN})\\b`, 'i');
export const supportContextStartPattern = new RegExp(`\\b(TEXTOS?\\s+(?:[IVXLC]+|\\d+)|leia\\s+os?\\s+textos?|leia\\s+o\\s+texto\\s+abaixo|considere\\s+o\\s+texto|considere\\s+as\\s+(?:(?:\\w+)\\s+){0,4}passagens|para\\s+responder(?:\\s+[aà]s?)?\\s+(?:quest(?:[oõ]es|oes)|itens?)|texto\\s+para\\s+(?:(?:responder|os?|as?)\\s+)*(?:quest(?:[oõ]es|oes)|itens?)|(?:quest(?:[oõ]es|oes)|itens?)\\s+(?:de(?:\\s+n[uú]meros?)?\\s+)?\\d{1,3}\\s*(?:a|ate|-)\\s*\\d{1,3}|aten[cç][aã]o\\s*:\\s*para\\s+responder|observe\\s+(?:a|o)\\s+${VISUAL_CONTEXT_TERMS_PATTERN}|analise\\s+a\\s+tabela|${VISUAL_CONTEXT_TERMS_PATTERN})\\b`, 'i');
export const visualOptionPlaceholderPattern = /^Alternativa visual\b/i;

export const isLikelyNamedTextTitleLine = (value: string, nextLine = '') => {
  const clean = stripHtml(value).replace(/\s+/g, ' ').trim();
  const nextClean = stripHtml(nextLine).replace(/\s+/g, ' ').trim();
  if (!clean) {
    return false;
  }

  if (/^texto$/i.test(clean)) {
    return Boolean(nextClean)
      && nextClean.length <= 120
      && !questionCommandPattern.test(nextClean)
      && !instructionPattern.test(nextClean);
  }

  const match = clean.match(/^texto\s+(.{2,120})$/i);
  if (!match) {
    return false;
  }

  const title = match[1].trim();
  if (/^(?:de|do|da|dos|das|para|com|em|no|na|nos|nas|assume|possui|apresenta|trata|aborda|se|a|o|as|os)\b/i.test(title)) {
    return false;
  }

  return /^[A-Z0-9ÁÉÍÓÚÂÊÔÃÕÇ"“]/.test(title);
};

export const isLikelySupportContextStartLine = (value: string, nextLine = '') => {
  const clean = stripHtml(value).replace(/\s+/g, ' ').trim();
  return supportContextStartPattern.test(clean)
    || isLikelyNamedTextTitleLine(clean, nextLine);
};

export const findSupportContextStartIndex = (value: string) => {
  const structured = normalizeStructuredText(value);
  let cursor = 0;
  const lines = structured.split('\n');
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index] || '';
    const nextLine = lines[index + 1] || '';
    if (isLikelySupportContextStartLine(line, nextLine)) {
      return cursor;
    }
    cursor += line.length + 1;
  }

  const fallbackMatch = structured.match(/\bTEXTOS?\s+(?:[IVXLC]+|\d+)\b/i);
  return fallbackMatch?.index ?? -1;
};

export const isLikelyPageBookletHeader = (value: string) => {
  const normalized = normalizeContextClassifierText(value);
  if (!normalized) {
    return true;
  }

  const hasHeaderSignal = pageBookletHeaderPattern.test(normalized);
  const parserProfile = resolveExamParserProfile(normalized, value);
  const hasProfileHeaderSignal = Boolean(parserProfile.pageHeaderPattern?.test(normalized));
  const hasSupportSignal = supportContextSignalPattern.test(normalized);
  const hasQuestionCommand = questionCommandPattern.test(value);
  const mostlyHeaderTokens = [
    'CIENCIAS',
    'TECNOLOGIAS',
    'CADERNO',
    'QUESTOES',
    'DIA',
    'AMARELO',
    'AZUL',
    'ROSA',
    'BRANCO',
    'CINZA',
  ].filter((token) => normalized.includes(token)).length >= 3;

  return ((hasHeaderSignal && mostlyHeaderTokens) || (hasProfileHeaderSignal && normalized.length < 180))
    && !hasSupportSignal
    && !hasQuestionCommand;
};

export const trimBookletHeaderFromContext = (value: string) => {
  const structured = normalizeStructuredText(value);
  const lines = structured.split('\n').map((line) => line.trim());
  const supportLineIndex = lines.findIndex((line, index) => (
    Boolean(line)
    && isLikelySupportContextStartLine(line, lines.slice(index + 1).find(Boolean) || '')
  ));

  if (supportLineIndex > 0) {
    const possibleHeader = lines.slice(0, supportLineIndex).filter(Boolean).join(' ');
    const looksLikeHeaderPrefix = isLikelyPageBookletHeader(possibleHeader)
      || isLikelyInstructionText(possibleHeader)
      || possibleHeader.length < 220;
    if (looksLikeHeaderPrefix) {
      return lines.slice(supportLineIndex).join('\n').trim();
    }
  }

  return structured;
};

export const isLikelyContextReferenceCommand = (value: string) => {
  const normalized = normalizeContextClassifierText(value);
  if (!normalized) {
    return true;
  }
  return /^(?:INTERNET\s*:\s*\.)?\s*(?:NO QUE SE REFERE|COM BASE|CONSIDERANDO|A PARTIR).*?\b(?:JULGUE|ASSINALE|RESPONDA)\b.*\b(?:ITENS|QUESTOES|ITEM)\b/.test(normalized)
    && normalized.length < 260;
};

export const sanitizeSupportContextText = (value: string) => {
  if (blockHtmlPattern.test(String(value || ''))) {
    return String(value || '').trim();
  }

  let clean = trimBookletHeaderFromContext(value)
    .replace(/^pcimarkpci\s+/i, '')
    .replace(/^[A-Za-z0-9+/=]{80,}\s+/, '')
    .replace(/\bwww\.pciconcursos\.com\.br\b\s*\|\s*\d+_[A-Z0-9_]+.*?(?=\bTexto\s+[A-Z0-9]{4,}\b|\bTEXTOS?\s+[IVXLC]+\b|$)/i, '')
    .replace(/\b(?:CESPE|CEBRASPE)\s*[-|]\s*[^.]{0,180}?(?=\bTexto\s+[A-Z0-9]{4,}\b|\bTEXTOS?\s+[IVXLC]+\b|$)/i, '')
    .trim();

  const textMarkerMatch = clean.match(/\bTexto\s+(?!abaixo\b|acima\b|base\b|apresentado\b|seguinte\b)(?:[A-Z0-9_]{4,}|[IVXLC]+|\d+)\b/);
  const textMarker = textMarkerMatch?.index ?? -1;
  const supportStartIndex = findSupportContextStartIndex(clean);
  if (supportStartIndex > 0 || textMarker > 0) {
    const safeStart = [supportStartIndex, textMarker]
      .filter((index) => index > 0)
      .sort((left, right) => left - right)[0] ?? -1;
    if (safeStart > 0) {
      clean = clean.slice(safeStart).trim();
    }
  }

  clean = clean
    .replace(/\s+(?:Considerando|No que se refere|Com base|A partir)\s+.{0,420}?\b(?:julgue|assinale|responda)\b.{0,180}$/i, '');

  clean = normalizeStructuredText(clean);

  if (isLikelyContextReferenceCommand(clean)) {
    return '';
  }

  return clean;
};

export interface TextSpan {
  start: number;
  end: number;
  text: string;
}

export const isReferenceSegment = (value: string) => (
  /\b(?:et al\.|Revista|Jornal|Journal|Med\.|Chem\.|Res\.|Dispon[ií]vel em|Acesso em|Fonte|Internet|Adaptad[ao]\s+de|adaptad[ao]|fragmento|In\s*:|\d{4})\b|https?:\/\/|www\./i
    .test(value)
);

export const normalizeReferenceSegment = (value: string) => String(value || '')
  .replace(/\s+/g, ' ')
  .replace(/\s+([,.;:])/g, '$1')
  .trim();

export const collectReferenceSpans = (clean: string) => {
  const spans: TextSpan[] = [];
  const pushSpan = (start: number, end: number) => {
    if (start < 0 || end <= start || end > clean.length) {
      return;
    }

    const text = normalizeReferenceSegment(clean.slice(start, end));
    if (text && isReferenceSegment(text)) {
      spans.push({ start, end, text });
    }
  };

  const authorReferencePattern = /\b\p{Lu}{2,},\s+\p{Lu}\.[\s\S]{0,560}?\((?:fragmento|adaptad[ao])\)\.?/giu;
  for (const match of clean.matchAll(authorReferencePattern)) {
    pushSpan(match.index ?? -1, (match.index ?? -1) + match[0].length);
  }

  const sourceMarkerPattern = /\b(?:Dispon[ií]vel em|Acesso em|Adaptad[ao]\s+de|Fonte|Internet|In)\s*:/gi;
  for (const match of clean.matchAll(sourceMarkerPattern)) {
    const start = match.index ?? -1;
    if (start < 0 || spans.some((span) => start >= span.start && start < span.end)) {
      continue;
    }

    const tail = clean.slice(start);
    const adaptedMatch = tail.match(/\((?:fragmento|adaptad[ao])\)\.?/i);
    const accessMatch = tail.match(/Acesso em\s*:[\s\S]{0,160}?\d{4}\.?/i);
    const lineEndMatch = tail.match(/^[^\n]{12,260}(?:\.|$)/);
    const endpoint = [adaptedMatch, accessMatch]
      .map((endpointMatch) => (
        endpointMatch && endpointMatch.index !== undefined
          ? endpointMatch.index + endpointMatch[0].length
          : -1
      ))
      .filter((index) => index > 0)
      .sort((left, right) => right - left)[0];

    if (endpoint) {
      pushSpan(start, start + endpoint);
    } else if (lineEndMatch) {
      pushSpan(start, start + lineEndMatch[0].length);
    }
  }

  return spans
    .sort((left, right) => left.start - right.start)
    .reduce<TextSpan[]>((merged, span) => {
      const previous = merged[merged.length - 1];
      if (!previous || span.start > previous.end) {
        merged.push(span);
        return merged;
      }

      if (span.end > previous.end) {
        previous.end = span.end;
        previous.text = normalizeReferenceSegment(clean.slice(previous.start, previous.end));
      }
      return merged;
    }, []);
};

export const isOperationalImportReference = (value: string) => {
  const clean = normalizeComparisonText(value);
  if (!clean) {
    return true;
  }

  const withoutAccents = clean.normalize('NFD').replace(/\p{Diacritic}/gu, '');
  const isOnlyFilePagePointer = /^(?:arquivo\s+)?[\w\s().-]+\.(?:pdf|png|jpe?g|webp)\s*,?\s*(?:pag(?:ina)?|page)\s*\d+$/i
    .test(withoutAccents);
  const isGenericPagePointer = /^(?:prova|gabarito|edital|caderno)(?:\s+[\w\s().-]+)?\s*,?\s*(?:pag(?:ina)?|page)\s*\d+$/i
    .test(withoutAccents);

  return isOnlyFilePagePointer || isGenericPagePointer;
};

export const sanitizeReferenceTextForImport = (value: string) => (
  String(value || '')
    .split(/\n{2,}|\n/)
    .map(normalizeReferenceSegment)
    .filter((segment) => segment && !isOperationalImportReference(segment))
    .join('\n\n')
    .trim()
);

export const mergeReferenceText = (...values: string[]) => {
  const seen = new Set<string>();
  const segments = values
    .flatMap((value) => String(value || '').split(/\n{2,}/))
    .map(normalizeReferenceSegment)
    .map(sanitizeReferenceTextForImport)
    .filter(Boolean)
    .filter((value) => {
      const key = normalizeComparisonText(value);
      if (!key || seen.has(key)) {
        return false;
      }
      seen.add(key);
      return true;
    });

  return segments.join('\n\n');
};

export const splitQuestionSupportReference = (value: string) => {
  const clean = sanitizeSupportContextText(value);
  if (!clean) {
    return { supportText: '', referenceText: '' };
  }

  const referenceSpans = collectReferenceSpans(clean);
  if (!referenceSpans.length) {
    return { supportText: clean, referenceText: '' };
  }

  const supportParts: string[] = [];
  let cursor = 0;
  referenceSpans.forEach((span) => {
    supportParts.push(clean.slice(cursor, span.start));
    cursor = span.end;
  });
  supportParts.push(clean.slice(cursor));

  const supportText = normalizeStructuredText(supportParts.join('\n\n'))
    .replace(/[ \t]+([,.;:])/g, '$1')
    .trim();
  const referenceText = mergeReferenceText(...referenceSpans.map((span) => span.text));

  return {
    supportText,
    referenceText,
  };
};

export const estimatePdfResourceRegionBox = (
  pageData: PdfPageData | PdfPageRichText | undefined,
  targetQuestionNumbers: number[] = [],
): FigureBox | undefined => {
  const targetSet = new Set(targetQuestionNumbers.filter((number) => number > 0));
  const candidates = (pageData?.contentBlocks || []).filter((block) => {
    if (!['shared_context', 'individual_support', 'reference', 'figure', 'table', 'unknown'].includes(block.type)) {
      return false;
    }
    const linked = block.linkedQuestionNumbers || [];
    return targetSet.size === 0 || linked.length === 0 || linked.some((number) => targetSet.has(number));
  });
  if (candidates.length === 0) {
    return undefined;
  }

  const left = Math.min(...candidates.map((block) => Number(block.boundingBox.x || 0)));
  const top = Math.min(...candidates.map((block) => Number(block.boundingBox.y || 0)));
  const right = Math.max(...candidates.map((block) => (
    Number(block.boundingBox.x || 0) + Number(block.boundingBox.width || 0)
  )));
  const bottom = Math.max(...candidates.map((block) => (
    Number(block.boundingBox.y || 0) + Number(block.boundingBox.height || 0)
  )));
  const margin = 18;
  return {
    x: Math.max(0, left - margin),
    y: Math.max(0, top - margin),
    width: Math.min(1000, right + margin) - Math.max(0, left - margin),
    height: Math.min(1000, bottom + margin) - Math.max(0, top - margin),
  };
};

export const shouldRepairQuestionPartsWithAi = ({
  rawText,
  supportText,
  referenceText,
  statement,
  options,
  expectedOptionsCount,
}: {
  rawText: string;
  supportText: string;
  referenceText: string;
  statement: string;
  options: string[];
  expectedOptionsCount: number;
}) => {
  const cleanStatement = stripHtml(statement).replace(/\s+/g, ' ').trim();
  const hasReferenceInsideStatement = /\b(?:Dispon[ií]vel em|Acesso em|Fonte|et al\.|Revista|Journal|adaptad[ao])\b/i
    .test(cleanStatement);
  const hasSupportDuplicatedInStatement = Boolean(supportText) && hasMeaningfulTextOverlap(cleanStatement, supportText);
  const rawLooksOptioned = readOptionMarkers(rawText).length >= Math.min(5, expectedOptionsCount);
  const missingOptionsDespiteMarkers = options.length < expectedOptionsCount && rawLooksOptioned;

  return cleanStatement.length > 0
    && (
      hasReferenceInsideStatement
      || hasSupportDuplicatedInStatement
      || missingOptionsDespiteMarkers
      || (Boolean(referenceText) && hasMeaningfulTextOverlap(cleanStatement, referenceText))
    );
};

export const normalizeAiRepairedOptions = (options: unknown, expectedOptionsCount: number) => (
  Array.isArray(options)
    ? options
      .map((option) => stripOptionLabel(String(option || '').replace(/\s+/g, ' ').trim()))
      .filter(Boolean)
      .slice(0, Math.max(2, expectedOptionsCount))
    : []
);

export const shouldPromoteAsSupportContext = (value: string) => {
  const clean = sanitizeSupportContextText(value);
  const hasSupportSignal = supportContextSignalPattern.test(clean)
    || extractExplicitContextQuestionNumbers(clean).length > 0;
  if (
    (isLikelyInstructionText(clean) && !hasSupportSignal)
    || isLikelyPageBookletHeader(clean)
  ) {
    return false;
  }
  if (clean.length <= 120) {
    const lines = normalizeStructuredText(clean).split('\n').filter(Boolean);
    return clean.length >= 40 && (
      hasSupportSignal
      || isLikelySupportContextStartLine(lines[0] || '', lines[1] || '')
    );
  }
  return true;
};

export const textNeedsExternalSupportContext = (...values: string[]) => {
  const text = normalizeComparisonText(stripHtml(values.join(' ')));
  return /\b(?:texto|fragmento|trecho|passagem|paragrafo|narrador|autor|termo destacado|expressao destacada|palavra destacada|passagens destacadas|figura|imagem|grafico|tabela|tirinha|charge)\b/.test(text)
    || /\b(?:1o|2o|3o|4o|5o)\s*(?:paragrafo|§)\b/.test(text);
};

export const isCarryoverEligibleTextContext = (context: ImportedContextDraft) => (
  Boolean(context.text)
  && !context.hasFigure
  && !context.figureDescription
  && !context.imageData
  && !isLikelyPageBookletHeader(context.text)
  && (
    /^pag-\d+-contexto-textual$/.test(context.tempId)
    || context.questionNumbers.length >= 6
  )
);

export const findCarryoverTextContextForQuestion = (
  questionNumber: number,
  questionPage: number,
  contexts: ImportedContextDraft[],
) => {
  if (!Number.isFinite(questionNumber) || questionNumber <= 0) {
    return null;
  }

  return contexts
    .filter(isCarryoverEligibleTextContext)
    .filter((context) => {
      const contextQuestionNumbers = Array.from(new Set(context.questionNumbers.filter((number) => number > 0)));
      if (contextQuestionNumbers.length === 0) {
        return false;
      }

      const lastQuestionNumber = Math.max(...contextQuestionNumbers);
      const contextPage = Number(context.page || 0);
      return lastQuestionNumber < questionNumber
        && questionNumber - lastQuestionNumber <= 24
        && (!questionPage || !contextPage || contextPage <= questionPage);
    })
    .sort((left, right) => {
      const leftLastQuestion = Math.max(...left.questionNumbers.filter((number) => number > 0));
      const rightLastQuestion = Math.max(...right.questionNumbers.filter((number) => number > 0));
      if (leftLastQuestion !== rightLastQuestion) {
        return rightLastQuestion - leftLastQuestion;
      }

      return Number(right.page || 0) - Number(left.page || 0);
    })[0] || null;
};

export const isInlineQuestionNumberReference = (text: string, markerIndex: number) => {
  const before = text.slice(Math.max(0, markerIndex - 24), markerIndex);
  if (/[.)!?]$/.test(before.trimEnd())) {
    return false;
  }
  const broadBefore = text.slice(Math.max(0, markerIndex - 90), markerIndex)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ');
  if (/\b(?:quest(?:ao|oes)|itens?)\s+(?:de(?:\s+(?:numero|numeros|n[ou]?\.?))?\s+|(?:numero|numeros|n[ou]?\.?)\s+)?(?:\d{1,3}\s*(?:,|;|e|a|ate|-|ao)\s*){0,12}$/i.test(broadBefore)) {
    return true;
  }
  return /\b(?:quest[aã]o|questao|item|itens?|q\.?|da|de|do|das|dos|na|no|nas|nos|nesta|neste|nessa|nesse|desta|deste|dessa|desse)\s+$/i.test(before);
};

export const parseContextQuestionNumbers = (value: string, fallbackNumber = 0) => {
  const normalized = String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  const scopeWindow = normalized.match(/\b(?:quest(?:ao|oes)|itens?)\b.{0,160}/i)?.[0] || '';
  const scopedRangeMatch = scopeWindow.match(/0*(\d{1,3})\s*(?:a|ate|ao|-)\s*0*(\d{1,3})\b/i);
  if (scopedRangeMatch) {
    const start = Number(scopedRangeMatch[1]);
    const end = Number(scopedRangeMatch[2]);
    if (Number.isFinite(start) && Number.isFinite(end) && start > 0 && end >= start && end - start <= 120) {
      return Array.from({ length: end - start + 1 }, (_, index) => start + index);
    }
  }

  const scopeNounPattern = String.raw`(?:quest(?:ao|oes)|itens?)`;
  const scopeNumberQualifierPattern = String.raw`(?:\s+de(?:\s+(?:numero|numeros|n[ou]?\.?))?|\s+(?:numero|numeros|n[ou]?\.?))?`;
  const rangeMatch = normalized.match(new RegExp(String.raw`\b${scopeNounPattern}${scopeNumberQualifierPattern}\s*0*(\d{1,3})\s*(?:a|ate|ao|-)\s*0*(\d{1,3})\b`, 'i'));
  const looseRangeMatch = rangeMatch || normalized.match(/\b(?:quest(?:ao|oes)|itens?)\D{0,32}?0*(\d{1,3})\s*(?:a|ate|ao|-)\s*0*(\d{1,3})\b/i);
  if (looseRangeMatch) {
    const start = Number(looseRangeMatch[1]);
    const end = Number(looseRangeMatch[2]);
    if (Number.isFinite(start) && Number.isFinite(end) && start > 0 && end >= start && end - start <= 120) {
      return Array.from({ length: end - start + 1 }, (_, index) => start + index);
    }
  }

  const listMatch = normalized.match(new RegExp(String.raw`\b${scopeNounPattern}${scopeNumberQualifierPattern}\s+((?:0*\d{1,3}\s*(?:,|e|;|\/)?\s*){1,20})(?:seguintes?|a seguir|abaixo)?\b`, 'i'));
  const explicitNumbers = listMatch
    ? Array.from(listMatch[1].matchAll(/\d{1,3}/g)).map((match) => Number(match[0]))
    : [];
  const numbers = explicitNumbers
    .filter((number) => Number.isFinite(number) && number > 0 && number < 500)
    .filter((number, index, list) => list.indexOf(number) === index);

  if (numbers.length > 0) {
    return numbers;
  }

  return fallbackNumber > 0 ? [fallbackNumber] : [];
};

export const extractExplicitContextQuestionNumbers = (...values: unknown[]) => {
  const text = values.map((value) => stripHtml(String(value || ''))).filter(Boolean).join(' ');
  const normalized = text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim();

  if (!/\b(?:quest(?:ao|oes)|itens?)\b/i.test(normalized)) {
    return [];
  }

  return parseContextQuestionNumbers(normalized, 0);
};

export const resolveScopedContextQuestionNumbers = (
  declaredQuestionNumbers: number[],
  ...contextSignals: unknown[]
) => {
  const explicitQuestionNumbers = extractExplicitContextQuestionNumbers(...contextSignals);
  if (explicitQuestionNumbers.length > 0) {
    return explicitQuestionNumbers;
  }

  return declaredQuestionNumbers
    .filter((number) => Number.isFinite(number) && number > 0)
    .filter((number, index, list) => list.indexOf(number) === index);
};

export const extractInterQuestionSupportContexts = (
  normalizedText: string,
  markers: Array<{ number: number; index: number; raw: string }>,
  pageIndex: number,
  parserProfile: ExamParserProfile = GENERIC_EXAM_PARSER_PROFILE,
): NonNullable<PageExtractionResult['pageContexts']> => {
  const contexts: NonNullable<PageExtractionResult['pageContexts']> = [];
  const contextStartPattern = new RegExp(parserProfile.contextStartPattern.source, 'gi');

  markers.forEach((marker, markerIndex) => {
    if (markerIndex === 0) {
      return;
    }

    const previous = markers[markerIndex - 1];
    const gap = normalizedText.slice(previous.index + previous.raw.length, marker.index).trim();
    if (
      gap.length < 40
      || !/\b(?:para\s+responder|texto\s+para\s+as?\s+quest(?:ao|[oõ]es)|quest(?:ao|[oõ]es)|seguintes?|abaixo|a\s+seguir|leia\s+os?\s+textos?|considere\s+o\s+texto|considere\s+as\s+passagens|observe\s+(?:a|o)\s+(?:figura|imagem|gr[aá]fico|tabela|mapa)|analise\s+a\s+tabela|com\s+base\s+no\s+texto|no\s+trecho\s+destacado|na\s+(?:figura|tabela))\b/i.test(gap)
    ) {
      return;
    }

    let startIndex = -1;
    for (const match of gap.matchAll(contextStartPattern)) {
      startIndex = match.index ?? startIndex;
      break;
    }
    if (startIndex < 0) {
      return;
    }
    const optionMarkers = readOptionMarkers(gap, parserProfile);
    if (
      optionMarkers.length >= 2
      && startIndex < Math.min(optionMarkers[0]?.index ?? 0, 120)
      && questionCommandPattern.test(gap.slice(0, Math.min(gap.length, 260)))
    ) {
      return;
    }

    const contextParts = splitQuestionSupportReference(gap.slice(startIndex));
    const contextText = sanitizeSupportContextText(contextParts.supportText || gap.slice(startIndex));
    const cleanContextText = stripHtml(contextText).replace(/\s+/g, ' ').trim();
    if (cleanContextText.length < 40 || isLikelyInstructionText(cleanContextText) || isLikelyPageBookletHeader(cleanContextText)) {
      return;
    }

    const questionNumbers = parseContextQuestionNumbers(cleanContextText, marker.number);
    if (!questionNumbers.includes(marker.number)) {
      return;
    }

    const firstNumber = questionNumbers[0] || marker.number;
    const lastNumber = questionNumbers[questionNumbers.length - 1] || marker.number;
    contexts.push({
      contextKey: `pag-${pageIndex}-contexto-q-${firstNumber}-${lastNumber}`,
      title: questionNumbers.length > 1
        ? `Texto de apoio - questoes ${questionNumbers.join(', ')}`
        : `Texto de apoio - questao ${marker.number}`,
      text: contextText,
      referenceText: contextParts.referenceText,
      sourcePage: pageIndex,
      appliesToQuestionNumbers: questionNumbers,
      hasFigure: false,
      figureDescription: '',
    });
  });

  return contexts;
};

export const splitNamedSupportContexts = (
  contextText: string,
  questionNumbers: number[],
  pageIndex: number,
): NonNullable<PageExtractionResult['pageContexts']> => {
  const structured = normalizeStructuredText(contextText);
  if (!structured || questionNumbers.length === 0) {
    return [];
  }

  const lines = structured.split('\n');
  const starts: Array<{ lineIndex: number; title: string }> = [];
  lines.forEach((line, lineIndex) => {
    const clean = stripHtml(line).replace(/\s+/g, ' ').trim();
    if (/^Texto\s+(?:[IVXLC]+|\d+)\b/i.test(clean)) {
      starts.push({ lineIndex, title: clean });
    }
  });

  if (starts.length < 2) {
    return [];
  }

  return starts
    .map((start, index) => {
      const nextStart = starts[index + 1];
      const block = lines.slice(start.lineIndex, nextStart?.lineIndex ?? lines.length).join('\n').trim();
      const blockParts = splitQuestionSupportReference(block);
      const text = sanitizeSupportContextText(blockParts.supportText || block);
      if (stripHtml(text).replace(/\s+/g, ' ').trim().length < 20) {
        return null;
      }

      return {
        contextKey: `pag-${pageIndex}-contexto-${slugify(start.title)}`,
        title: start.title,
        text,
        referenceText: blockParts.referenceText,
        sourcePage: pageIndex,
        appliesToQuestionNumbers: questionNumbers,
        hasFigure: pageLikelyHasFigure(text),
        figureDescription: '',
      };
    })
    .filter(Boolean) as NonNullable<PageExtractionResult['pageContexts']>;
};

export const collectQuestionMarkersFromPatterns = (
  value: string,
  parserProfile: ExamParserProfile = resolveExamParserProfile(value),
) => {
  const text = normalizeQuestionMarkerText(value);
  const profileMarkers = parserProfile.questionMarkerPatterns.flatMap((markerPattern) => (
    Array.from(text.matchAll(cloneGlobalPattern(markerPattern.pattern)))
      .map((match) => {
        const raw = match[0] || '';
        const leading = match[1] && /^\s+$/.test(match[1]) ? String(match[1]) : '';
        return {
          number: Number(match[markerPattern.numberGroup || 1]),
          index: (match.index ?? 0) + leading.length,
          raw: raw.slice(leading.length),
          source: markerPattern.source,
        };
      })
  ));

  return [
    ...profileMarkers,
    ...(isTrueFalseExamText(text)
      ? findPlainTrueFalseMarkers(text)
      : []),
  ]
    .filter((marker) => Number.isFinite(marker.number) && marker.number > 0 && marker.number < 500)
    .filter((marker) => !['word', 'numbered', 'dash'].includes(marker.source) || !isInlineQuestionNumberReference(text, marker.index))
    .sort((left, right) => left.index - right.index)
    .filter((marker, index, list) => list.findIndex((item) => item.number === marker.number && Math.abs(item.index - marker.index) < 12) === index);
};

export const extractQuestionNumbersFromText = (value: string, parserProfile: ExamParserProfile = resolveExamParserProfile(value)) => {
  const matches = collectQuestionMarkersFromPatterns(value, parserProfile);

  return matches.map((marker) => marker.number);
};

export const normalizeQuestionMarkerText = (value: string) => String(value || '')
  .replace(/\bQ\s*U\s*E\s*S\s*T\s*\S\s*O\b/gi, 'Questao')
  .replace(/(^|\n)\s*0*(\d{1,3})\s+0*(\d{1,3})\s*(?=\n\s*\S)/g, '$1$2)\n$3) ')
  .replace(/(^|[^\d])0*(\d{1,3})\s*[.)]\s*(?=(?:Relativamente|Ticio|Tício|Apresenta-se|Dentre|A\s+conduta|Leia|Como|Assinale|No\s+que|Em\s+relacao|Em\s+rela[cç][aã]o|De\s+acordo|Considerando|Com\s+base|Sobre|Qual|Quais|Julgue|Acerca|No\s+tocante|Quanto)\b)/gi, '$1$2) ');

export const isTrueFalseExamText = (value: string) => (
  /\b(cespe|cebraspe|julgue os itens|julgue os próximos itens|julgue os seguintes itens|item certo|item errado|código c|codigo c)\b/i.test(String(value || ''))
  || (/\bCERTO\b/i.test(String(value || '')) && /\bERRADO\b/i.test(String(value || '')))
);

export const isVerdadeiroFalsoExamText = (value: string) => (
  /\b(?:verdadeiro|falso|atribua\s+v|valores\s+de\s+verdadeiro|sequ[eê]ncia\s+correta\s+de\s+cima\s+para\s+baixo)\b/i.test(String(value || ''))
  || /\(\s*\)\s+.{0,120}\b(?:v|f)\b/i.test(String(value || ''))
);

export const findPlainTrueFalseMarkers = (text: string) => {
  const candidates = Array.from(text.matchAll(/(^|\s)(\d{1,3})\s+(?=\p{Lu})/gu))
    .map((match) => ({
      number: Number(match[2]),
      index: (match.index ?? 0) + match[1].length,
      raw: match[0].slice(match[1].length),
      source: 'plain-true-false',
    }))
    .filter((marker) => Number.isFinite(marker.number) && marker.number > 0 && marker.number < 500);

  const accepted: typeof candidates = [];
  const hasNearbyCommand = (index: number) => /julgue\s+os\s+.{0,120}?itens/i
    .test(text.slice(Math.max(0, index - 420), index));

  candidates.forEach((marker) => {
    const previous = accepted[accepted.length - 1];
    const startsCommandBlock = hasNearbyCommand(marker.index);
    const continuesPreviousItem = Boolean(previous)
      && marker.number === previous.number + 1
      && marker.index > previous.index
      && marker.index - previous.index < 3200;

    if (startsCommandBlock || continuesPreviousItem) {
      accepted.push(marker);
    }
  });

  return accepted;
};

export const inferRoleFromFileName = (fileName = '') => {
  const baseName = String(fileName || '')
    .replace(/\.[^.]+$/, '')
    .replace(/[_-]+/g, ' ')
    .trim();
  const compact = baseName
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/gi, '')
    .toLowerCase();

  if (!compact || compact.includes('gabarito') || compact.includes('provaenem')) {
    return '';
  }
  if (compact.includes('agenteadministrativo')) {
    return 'Agente Administrativo';
  }

  return baseName
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
};

export const stripOptionLabel = (value: string) => String(value || '')
  .replace(/^\s*(?:alternativa\s*)?\(?[A-F]\)?(?:\s*[\s.)\-–—:]+|\s+)/i, '')
  .trim();

export const readOptionMarkers = (
  text: string,
  parserProfile: ExamParserProfile = resolveExamParserProfile(text),
) => {
  const markers = parserProfile.optionMarkerPatterns.flatMap((pattern) => (
    Array.from(text.matchAll(cloneGlobalPattern(pattern)))
      .map((match) => {
        const leading = match[1] || '';
        const label = String(match[2] || match[3] || '').toUpperCase();
        const raw = match[0].slice(String(leading).length);
        const index = (match.index ?? 0) + String(leading).length;
        const end = index + raw.length;
        return {
          label,
          index,
          end,
          raw,
          structured: Boolean(label) && (
            /(?:alternativa\s+)?\(?[A-F]\)?\s*[).:;\-–—]/i.test(raw)
            || /alternativa\s+[A-F]/i.test(raw)
          ),
        };
      })
  ));

  return markers
    .filter((marker) => /^[A-F]$/.test(marker.label))
    .sort((left, right) => left.index - right.index)
    .filter((marker, index, list) => (
      list.findIndex((item) => item.label === marker.label && Math.abs(item.index - marker.index) < 8) === index
    ));
};

export const looksLikeOptionCueBefore = (text: string, index: number) => {
  const before = text.slice(Math.max(0, index - 120), index).toLowerCase();
  return /(\?|respectivamente|alternativa|alternativas|op[cç][aã]o|op[cç][oõ]es|representad[oa] em|esbo[cç]ad[oa] no|corresponde(?:m)? a|associad[oa] a|causad[oa] pel[ao]|provocad[oa] pel[ao]|induzid[oa] pel[ao]|decorre d[ao]|mais pr[oó]xim[ao] de|igual a|valor de|resultado de|finalidade de|objetivo de|serve para|permite|porque|pois|s[ãa]o|seria(?:m)?|assinale|marque|em:)\s*[,.:;]?$/i.test(before)
    || /(?:^|\s)(?:[ée]\s+a|e\s+a|[ée]|e)\s*[,.:;]?$/.test(before);
};

export const trimExtractedOptionText = (value: string) => String(value || '')
  .replace(/\s+(?:Considere|Leia|Observe|Analise)\s+[\s\S]{0,900}?\bpara\s+responder\b[\s\S]*$/i, '')
  .replace(/\s+(?:TEXTO\s+[IVXLC]+:?|MATEM[ÁA]TICA\b|RACIOC[IÍ]NIO\b|CONHECIMENTOS\b|www\.pciconcursos\.com\.br\b|\*?(?=[A-Z0-9]*\d)[A-Z0-9]{6,}\*?.*$|ENEM\d{4}.*$).*$/i, '')
  .trim();

export const stripTrailingExamNoise = (value: string) => String(value || '')
  .replace(/\s+(?:\*?(?=[A-Z0-9]*\d)[A-Z0-9]{6,}\*?)(?:\s*ENEM\d{4}){1,}.*$/i, '')
  .replace(/\s+(?:ENEM\d{4}){2,}.*$/i, '')
  .replace(/\s+\*?(?=[A-Z0-9]*\d)[A-Z0-9]{6,}\*?\s*$/i, '')
  .replace(/\s+/g, ' ')
  .trim();

export const extractOptionFragmentsFromText = (
  value: string,
  expectedOptionsCount?: unknown,
  parserProfile: ExamParserProfile = resolveExamParserProfile(value),
) => {
  const text = String(value || '').replace(/\s+/g, ' ').trim();
  const candidates = readOptionMarkers(text, parserProfile);
  const firstStructuredIndex = candidates.findIndex((candidate) => candidate.structured);
  if (firstStructuredIndex < 0) {
    return { statement: text, optionsByLabel: new Map<string, string>() };
  }

  const labels = OPTION_LABELS.slice(0, getExpectedOptionsCount('multipla escolha', expectedOptionsCount));
  const markers = [];
  const seen = new Set<string>();
  for (let index = firstStructuredIndex; index < candidates.length; index += 1) {
    const candidate = candidates[index];
    if (!labels.includes(candidate.label)) {
      continue;
    }
    if (seen.has(candidate.label)) {
      if (!candidate.structured) {
        continue;
      }
      break;
    }
    if (!candidate.structured && markers.length > 0 && markers.every((marker) => marker.structured)) {
      continue;
    }
    seen.add(candidate.label);
    markers.push(candidate);
  }

  const optionsByLabel = new Map<string, string>();
  markers.forEach((marker, index) => {
    const next = markers[index + 1];
    const option = trimExtractedOptionText(text.slice(marker.end, next?.index ?? text.length).replace(/\s+/g, ' ').trim());
    if (option) {
      optionsByLabel.set(marker.label, option);
    }
  });

  const firstMarker = markers[0];
  const statement = firstMarker ? text.slice(0, firstMarker.index).replace(/\s+/g, ' ').trim() : text;
  return { statement, optionsByLabel };
};

export const extractOptionsFromText = (
  value: string,
  expectedOptionsCount?: unknown,
  parserProfile: ExamParserProfile = resolveExamParserProfile(value),
) => {
  const text = String(value || '').replace(/\s+/g, ' ').trim();
  const textWithoutTrailingNoise = stripTrailingExamNoise(text);
  const effectiveTextLength = Math.max(1, textWithoutTrailingNoise.length || text.length);
  const candidates = readOptionMarkers(text, parserProfile);

  const labels = OPTION_LABELS.slice(0, getExpectedOptionsCount('multipla escolha', expectedOptionsCount));
  const visualAlternativesMatch = text.match(/^(.*?)(?:^|\s)A\s+B\s+C\s+D\s+E(?:\s+(?:\*?[A-Z0-9]{6,}\*?.*|ENEM\d{4}.*))?$/i)
    || textWithoutTrailingNoise.match(/^(.*?)(?:^|\s)A\s+B\s+C\s+D\s+E$/i);
  if (visualAlternativesMatch) {
    const statement = stripTrailingExamNoise(String(visualAlternativesMatch[1] || '').trim());
    if (statement && looksLikeOptionCueBefore(text, statement.length + 1)) {
      return {
        statement,
        options: labels.map((label) => `Alternativa visual ${label}`),
      };
    }
  }

  const groups = candidates
    .map((start, startIndex) => {
      const seen = new Set<string>();
      const group = [];
      for (let index = startIndex; index < candidates.length && group.length < labels.length; index += 1) {
        const candidate = candidates[index];
        if (!labels.includes(candidate.label)) {
          continue;
        }
        if (seen.has(candidate.label)) {
          if (!candidate.structured) {
            continue;
          }
          break;
        }
        if (!candidate.structured && group.length > 0 && group.every((marker) => marker.structured)) {
          continue;
        }
        seen.add(candidate.label);
        group.push(candidate);
      }
      return group;
    })
    .filter((group) => {
      if (group.length < 2 || group[0]?.label !== 'A') {
        return false;
      }

      const firstMarker = [...group].sort((left, right) => left.index - right.index)[0];
      const orderedLabels = [...group].sort((left, right) => left.index - right.index).map((marker) => marker.label).join('');
      const isNaturalOptionRun = orderedLabels === labels.slice(0, group.length).join('');
      const isLateInQuestion = firstMarker.index > Math.max(120, effectiveTextLength * 0.42);
      if (
        firstMarker.label === 'A'
        && !looksLikeOptionCueBefore(text, firstMarker.index)
        && !(isNaturalOptionRun && group.length >= 4 && isLateInQuestion)
      ) {
        return false;
      }

      return true;
    });

  const rankGroup = (group: typeof candidates) => {
    const chronologicalGroup = [...group].sort((left, right) => left.index - right.index);
    const orderedLabels = group.map((marker) => marker.label).join('');
    const optionLengths = chronologicalGroup
      .map((marker, index) => {
        const next = chronologicalGroup[index + 1];
        return text.slice(marker.end, next?.index ?? text.length).replace(/\s+/g, ' ').trim().length;
      })
      .filter((length) => length > 0);
    const otherMax = Math.max(1, ...optionLengths.slice(1));
    const firstOptionTooLarge = optionLengths[0] > Math.max(80, otherMax * 2.5);
    const firstMarker = chronologicalGroup[0];
    const emptyStatementPenalty = firstMarker.index < 8 && !firstMarker.structured ? 650 : 0;
    const imbalancePenalty = firstOptionTooLarge ? 750 : 0;
    const structuredScore = group.filter((marker) => marker.structured).length * 35;
    const fullGroupScore = group.length === 5 ? 500 : 0;
    const naturalOrderScore = orderedLabels === labels.slice(0, group.length).join('') ? 120 : 0;
    const hasStatementScore = firstMarker.index > 20 ? 120 : 0;
    return (group.length * 1000) + structuredScore + fullGroupScore + naturalOrderScore + hasStatementScore - emptyStatementPenalty - imbalancePenalty;
  };

  const markers = groups.sort((left, right) => rankGroup(right) - rankGroup(left))[0] || [];
  if (markers.length < 2) {
    const fragments = extractOptionFragmentsFromText(text, expectedOptionsCount, parserProfile);
    if (fragments.optionsByLabel.size > 1) {
      return {
        statement: fragments.statement,
        options: labels.map((label) => fragments.optionsByLabel.get(label) || '').filter(Boolean),
      };
    }
    return { statement: text, options: [] as string[] };
  }

  const chronologicalMarkers = [...markers].sort((left, right) => left.index - right.index);
  const optionByLabel = new Map<string, string>();
  chronologicalMarkers
    .map((marker, index) => {
      const next = chronologicalMarkers[index + 1];
      optionByLabel.set(marker.label, trimExtractedOptionText(text.slice(marker.end, next?.index ?? text.length).replace(/\s+/g, ' ').trim()));
      return marker;
    })
    .filter(Boolean);

  const options = labels.map((label) => optionByLabel.get(label) || '').filter(Boolean);
  const firstMarker = chronologicalMarkers[0];
  const statement = stripTrailingExamNoise(text.slice(0, firstMarker.index).replace(/\s+/g, ' ').trim());
  const fullVisualAlternativeSet = chronologicalMarkers.length >= 5
    && labels.every((label) => optionByLabel.has(label))
    && labels.every((label) => {
      const option = optionByLabel.get(label) || '';
      return option === '' || /^[A-F]$/i.test(option) || /^ENEM\d+/i.test(option);
    });

  if (fullVisualAlternativeSet) {
    return {
      statement,
      options: labels.map((label) => `Alternativa visual ${label}`),
    };
  }

  return { statement, options };
};

export const isTrivialVisualOption = (option: string, label: string) => {
  const normalized = String(option || '')
    .replace(/\s+/g, ' ')
    .trim();
  return normalized.toUpperCase() === label
    || new RegExp(`^alternativa\\s+visual\\s+${label}$`, 'i').test(normalized)
    || new RegExp(`^op[cç][aã]o\\s+${label}$`, 'i').test(normalized);
};

export const normalizeVisualOptions = (options: string[]) => {
  const labels = OPTION_LABELS;
  const hasTrivialVisualSet = options.length >= 2
    && options.every((option, index) => isTrivialVisualOption(option, labels[index] || String(index + 1)));

  return hasTrivialVisualSet
    ? options.map((_, index) => `Alternativa visual ${labels[index] || index + 1}`)
    : options;
};

export const shouldUseExtractedStatement = (rawText: string, extractedStatement: string, extractedOptionsCount: number) => {
  const text = String(rawText || '').replace(/\s+/g, ' ').trim();
  const statement = String(extractedStatement || '').replace(/\s+/g, ' ').trim();
  if (!statement || statement.length >= text.length) {
    return false;
  }

  return extractedOptionsCount >= 2
    || /(?:^|\s)A\s+B\s+C\s+D\s+E(?:\s|$)/i.test(text)
    || readOptionMarkers(text).length >= 2;
};

export const normalizeImportedOptions = (
  rawOptions: unknown,
  rawText: string,
  modality?: string,
  expectedOptionsCount?: unknown,
  parserProfile: ExamParserProfile = resolveExamParserProfile(rawText),
) => {
  const expectedCount = getExpectedOptionsCount(modality || 'multipla escolha', expectedOptionsCount);
  const extracted = extractOptionsFromText(rawText, expectedCount, parserProfile);
  const options = Array.isArray(rawOptions)
    ? normalizeVisualOptions(rawOptions.map((option) => stripOptionLabel(String(option))).filter(Boolean)).slice(0, expectedCount)
    : [];
  if (options.length >= 2) {
    return {
      statement: shouldUseExtractedStatement(rawText, extracted.statement, extracted.options.length)
        ? extracted.statement
        : rawText,
      options,
    };
  }
  if (String(modality || '').toLowerCase().includes('certo')) {
    return { statement: rawText, options: ['Certo', 'Errado'] };
  }
  return extracted;
};

export const splitSupportContextFromStatement = (value: string) => {
  const text = String(value || '').replace(/\s+/g, ' ').trim();
  if (!/^TEXTOS?\s+(?:[IVXLC]+|\d+)\b/i.test(text)) {
    return { supportText: '', statement: text };
  }

  const questionStartPattern = /\b(Nesse contexto|Neste contexto|Nesse sentido|Neste sentido|Com base|Considerando|A partir|De acordo com|No texto|Na situa[cç][aã]o|Assinale|Marque|Qual|Quais|Infere-se|Conclui-se)\b/i;
  const searchStart = Math.max(
    0,
    ...Array.from(text.matchAll(/\bTEXTOS?\s+(?:[IVXLC]+|\d+)\b/gi)).map((match) => (match.index || 0) + match[0].length),
  );
  const searchArea = text.slice(searchStart);
  const questionMatch = searchArea.match(questionStartPattern);
  if (!questionMatch || questionMatch.index === undefined) {
    return { supportText: '', statement: text };
  }

  const questionIndex = searchStart + questionMatch.index;
  const supportText = sanitizeSupportContextText(text.slice(0, questionIndex).trim());
  const statement = text.slice(questionIndex).trim();

  if (!supportText || statement.length < 20 || !(questionStartPattern.test(statement) || questionCommandPattern.test(statement))) {
    return { supportText: '', statement: text };
  }

  const splitReference = splitQuestionSupportReference(supportText);
  return { ...splitReference, statement };
};

export const splitInlineSupportContextFromStatement = (value: string) => {
  const text = String(value || '').replace(/\s+/g, ' ').trim();
  if (text.length < 220) {
    return { supportText: '', statement: text };
  }

  const supportEvidencePattern = /\b(dispon[ií]vel em|acesso em|adaptad[ao]|fonte|fragmento|figura|imagem|gr[aá]fico|tabela|esquema|tirinha|charge|texto\s+[IVXLC]+)\b/i;
  const referenceEndPattern = /(?:\((?:adaptad[ao]|fragmento)\)\.?|Acesso em:\s*[^.]{2,180}\.\s*|Dispon[ií]vel em:\s*[^.]{2,180}\.\s*)/gi;
  const statementAfterReferencePattern = /\b(?:A\s+(?:perda|massa|quantidade|figura|alternativa|relacao|rela[cç][aã]o|distancia|dist[aâ]ncia|producao|produ[cç][aã]o|probabilidade|agua|[áa]gua|radiacao|radia[cç][aã]o|funcao|fun[cç][aã]o|medida|area|[áa]rea|adesao|ades[aã]o)|O\s+(?:processo|fen[oô]meno|comportamento|[áa]cido|valor|diagrama|gr[aá]fico|resultado|n[uú]mero|total|produto|emprego|desenvolvimento)|Os\s+(?:espectros|dados|valores|sapinhos)|As\s+(?:informacoes|informa[cç][oõ]es|figuras|alternativas)|Esse|Essa|Esses|Essas|Ness[ea]\s+contexto|Nest[ea]\s+contexto|Qual|Quais|Dar\s+destino|Considerando|Em\s+\d{4}|Para\s+[oa])\b/i;
  const commandPattern = /\b(Qual(?:\s+[eé]\s+)?|Quais|Esse|Essa|Esses|Essas|O fenômeno|A característica|Nesse contexto|Neste contexto|Nesse sentido|Neste sentido|Com base|Considerando|A partir|De acordo com|Diante disso|Assinale|Marque|Infere-se|Conclui-se)\b/gi;
  const inlineCommandPattern = /\b(Qual(?:\s+[eé]\s+)?|Quais|Esse|Essa|Esses|Essas|O fenômeno|A característica|Nesse contexto|Neste contexto|Nesse sentido|Neste sentido|Com base|Considerando|A partir|De acordo com|Diante disso|Assinale|Marque|Infere-se|Conclui-se)\b/i;

  const referenceMatches = Array.from(text.matchAll(referenceEndPattern));
  for (let cursor = referenceMatches.length - 1; cursor >= 0; cursor -= 1) {
    const referenceMatch = referenceMatches[cursor];
    const referenceEnd = (referenceMatch.index ?? 0) + referenceMatch[0].length;
    const afterReference = text.slice(referenceEnd);
    const statementMatch = afterReference.match(statementAfterReferencePattern);
    if (!statementMatch || statementMatch.index === undefined || statementMatch.index > 80) {
      continue;
    }

    const questionIndex = referenceEnd + statementMatch.index;
    const supportCandidate = text.slice(0, questionIndex).trim();
    const statementCandidate = text.slice(questionIndex).trim();
    const splitReference = splitQuestionSupportReference(supportCandidate);

    if (
      splitReference.supportText
      && statementCandidate.length >= 25
      && statementCandidate.length <= 900
      && !isLikelyInstructionText(splitReference.supportText)
      && !isLikelyPageBookletHeader(splitReference.supportText)
    ) {
      return {
        ...splitReference,
        statement: statementCandidate,
      };
    }
  }

  const candidates = Array.from(text.matchAll(commandPattern))
    .map((match) => match.index ?? -1)
    .filter((index) => index > 120 && index < text.length - 20);

  for (let cursor = candidates.length - 1; cursor >= 0; cursor -= 1) {
    const index = candidates[cursor];
    const supportCandidate = text.slice(0, index).trim();
    const statementCandidate = text.slice(index).trim();
    const hasQuestionEnding = /[?!.,:]$/.test(statementCandidate) || /\?/.test(statementCandidate) || /respectivamente[,.:;]?$/i.test(statementCandidate);
    const hasSupportEvidence = supportEvidencePattern.test(supportCandidate) || supportCandidate.length >= 380;
    const statementLooksValid = (questionCommandPattern.test(statementCandidate) || inlineCommandPattern.test(statementCandidate))
      && statementCandidate.length >= 35
      && statementCandidate.length <= 700;

    if (hasSupportEvidence && statementLooksValid && hasQuestionEnding) {
      const splitReference = splitQuestionSupportReference(supportCandidate);
      if (splitReference.supportText && !isLikelyInstructionText(splitReference.supportText) && !isLikelyPageBookletHeader(splitReference.supportText)) {
        return { ...splitReference, statement: statementCandidate };
      }
    }
  }

  return { supportText: '', statement: text };
};

export const normalizeExpectedOptionsCount = (value: unknown) => {
  const count = Number(String(value ?? '').match(/[2-6]/)?.[0] || 0);
  return Number.isFinite(count) && count >= 2 && count <= 6 ? count : 0;
};

export const inferExpectedOptionsCountFromText = (...values: unknown[]) => {
  const text = values.map((value) => String(value || '')).filter(Boolean).join(' ');
  const normalized = normalizeComparisonText(text);
  if (!normalized) {
    return 0;
  }

  const compactVisualOptions = text.match(/(?:^|\s)A\s+B\s+C\s+D(?:\s+E)?(?:\s+F)?(?:\s|$)/i)?.[0] || '';
  if (/\bF\b/i.test(compactVisualOptions)) {
    return 6;
  }
  if (/\bE\b/i.test(compactVisualOptions)) {
    return 5;
  }
  if (compactVisualOptions) {
    return 4;
  }

  const parserProfile = resolveExamParserProfile(text);
  const optionMarkers = readOptionMarkers(text);
  const structuredOptionMarkers = optionMarkers.filter((marker) => marker.structured);
  const reliableOptionMarkers = structuredOptionMarkers.length >= 2 ? structuredOptionMarkers : optionMarkers;
  const labels = new Set(reliableOptionMarkers.map((marker) => marker.label));
  if (['A', 'B', 'C', 'D'].every((label) => labels.has(label)) && !labels.has('E')) {
    return 4;
  }
  if (['A', 'B', 'C', 'D', 'E', 'F'].every((label) => labels.has(label))) {
    return 6;
  }
  if (['A', 'B', 'C', 'D', 'E'].every((label) => labels.has(label))) {
    return 5;
  }

  const adaptiveCount = inferAdaptiveOptionCountFromText(text, parserProfile);
  if (adaptiveCount) {
    return adaptiveCount;
  }

  return 0;
};

export const getExpectedOptionsCount = (
  modality?: unknown,
  explicitCount?: unknown,
  parserProfile: ExamParserProfile = GENERIC_EXAM_PARSER_PROFILE,
) => {
  const explicit = normalizeExpectedOptionsCount(explicitCount);
  if (explicit) {
    return explicit;
  }

  const modalityText = String(modality || '').toLowerCase();
  if (modalityText.includes('certo')) {
    return 2;
  }
  if (modalityText.includes('verdadeiro') || modalityText.includes('falso')) {
    return 2;
  }
  if (modalityText.includes('discursiva') || modalityText.includes('redacao') || modalityText.includes('redação') || modalityText.includes('estudo de caso')) {
    return 0;
  }

  const adaptiveDefault = parserProfile.adaptiveEvidence?.observedOptionCounts?.[0] || 0;
  return normalizeExpectedOptionsCount(modalityText)
    || normalizeExpectedOptionsCount(adaptiveDefault)
    || 0;
};

export const inferQuestionType = (
  rawText: string,
  options: string[],
  parserProfile: ExamParserProfile,
): ImportedQuestionType => {
  const clean = stripHtml(rawText).replace(/\s+/g, ' ').trim();
  if (isTrueFalseExamText(clean)) {
    return 'certo ou errado';
  }
  if (isVerdadeiroFalsoExamText(clean)) {
    return 'verdadeiro/falso';
  }
  if (/\b(?:somat[oó]rio|some\s+os\s+itens|soma\s+das\s+alternativas|valor\s+da\s+soma)\b/i.test(clean)) {
    return 'somatorio';
  }
  if (/\b(?:assertivas?|afirma[cç][oõ]es?|itens?\s+[ivxlcdm]+|i\s*,?\s*ii\s*,?\s*iii|est[aã]o\s+corretas?)\b/i.test(clean)) {
    return 'multipla assertiva';
  }
  if (/\b(?:reda[cç][aã]o|texto\s+dissertativo[- ]argumentativo|produza\s+um\s+texto)\b/i.test(clean)) {
    return 'redacao';
  }
  if (/\b(?:estudo\s+de\s+caso|caso\s+cl[ií]nico|situa[cç][aã]o[- ]problema)\b/i.test(clean)) {
    return 'estudo de caso';
  }
  if (options.length >= 2) {
    return 'multipla escolha';
  }
  if (/\b(?:discursiva|redija|discorra|responda\s+em|texto\s+dissertativo|quest[aã]o\s+aberta)\b/i.test(clean)) {
    return 'discursiva';
  }
  return 'desconhecido';
};

export const looksLikeFlattenedStructuredText = (value: string) => {
  const raw = String(value || '').trim();
  const clean = stripHtml(raw).replace(/\s+/g, ' ').trim();
  if (clean.length < 360) {
    return false;
  }
  if (blockHtmlPattern.test(raw) || /<br\s*\/?>|\n{2,}/i.test(raw)) {
    return false;
  }

  const hasSupportSignal = /\b(?:texto\s+[ivxlc]+|leia\s+o\s+texto|considere\s+o\s+texto|poema|versos?|fonte\s*:|dispon[ií]vel\s+em|acesso\s+em|adaptad[ao]|figura|tabela|gr[aá]fico)\b/i
    .test(clean);
  const sentenceBreaks = (clean.match(/[.!?]\s+[A-ZÁÉÍÓÚÂÊÔÃÕÇ"“]/g) || []).length;
  return hasSupportSignal && sentenceBreaks >= 3;
};

export const hasPreservedTextBreaks = (value: string) => (
  /<br\s*\/?>|\n|<\/(?:p|tr|li|h[1-6])>/i.test(String(value || ''))
);

export const looksLikeCorruptedTableText = (...values: string[]) => {
  const raw = values.map((value) => String(value || '')).join(' ').trim();
  const clean = stripHtml(raw).replace(/\s+/g, ' ').trim();
  if (!clean) {
    return false;
  }
  if (/<table\b/i.test(raw) || (raw.includes('|') && hasPreservedTextBreaks(raw))) {
    return false;
  }

  const hasTableSignal = /\b(?:tabela|quadro|planilha|coluna|linha|dados|ano|popula[cç][aã]o|percentual|valor)\b/i.test(clean);
  const numericTokens = (clean.match(/\b\d+(?:[.,]\d+)?%?\b/g) || []).length;
  const hasCollapsedRows = /\b(?:ano|popula[cç][aã]o|valor|percentual)\b.{0,80}\b\d{2,4}\b.{0,80}\b\d+(?:[.,]\d+)?%?\b.{0,80}\b\d{2,4}\b.{0,80}\b\d+(?:[.,]\d+)?%?\b/i
    .test(clean);
  return hasTableSignal && !hasPreservedTextBreaks(raw) && (numericTokens >= 3 || hasCollapsedRows);
};

export const looksLikeCorruptedPoemText = (...values: string[]) => {
  const raw = values.map((value) => String(value || '')).join(' ').trim();
  const clean = stripHtml(raw).replace(/\s+/g, ' ').trim();
  if (!clean || hasPreservedTextBreaks(raw)) {
    return false;
  }

  const hasPoemSignal = /\b(?:poema|verso|estrofe|soneto|eu\s+l[ií]rico|minha\s+terra|as\s+aves|gorjeiam)\b/i.test(clean);
  const likelyVerseFragments = (clean.match(/\b(?:onde|que|quando|enquanto|n[aã]o|minha|meu|minhas|teus|suas)\b/gi) || []).length;
  return hasPoemSignal && clean.length >= 90 && likelyVerseFragments >= 3;
};

export const looksLikeCorruptedLawText = (...values: string[]) => {
  const raw = values.map((value) => String(value || '')).join(' ').trim();
  const clean = stripHtml(raw).replace(/\s+/g, ' ').trim();
  if (!clean || hasPreservedTextBreaks(raw)) {
    return false;
  }

  const hasLawArticle = /\b(?:art\.?|artigo)\s*\d+[ºo]?\b/i.test(clean);
  const romanIncisos = (clean.match(/\b[IVXLCDM]{1,6}\s*[-–—]/g) || []).length;
  const paragraphs = (clean.match(/§\s*\d+[ºo]?/g) || []).length;
  const alineas = (clean.match(/\b[a-z]\)\s+/gi) || []).length;
  return clean.length >= 120 && hasLawArticle && romanIncisos + paragraphs + alineas >= 2;
};

export const mentionsSharedContextWithoutLink = (value: string, contextKey?: string) => (
  !String(contextKey || '').trim()
  && /\b(?:quest(?:[oõ]es|oes)|itens?)\s+\d{1,3}\s*(?:a|ate|e|,|-)\s*\d{1,3}\b/i.test(stripHtml(value))
);

export const looksLikeBrokenCrossPageContext = (value: string, contextKey?: string) => (
  !String(contextKey || '').trim()
  && /\b(?:continua[cç][aã]o\s+do\s+texto|texto\s+da\s+p[aá]gina\s+anterior|continua\s+na\s+p[aá]gina|p[aá]gina\s+anterior|parte\s+2\s+do\s+texto)\b/i.test(stripHtml(value))
);

export const referencedResourceKinds = (...values: string[]) => {
  const text = normalizeComparisonText(stripHtml(values.join(' ')));
  return {
    text: /\b(?:texto|textos i e ii|fragmento|trecho|passagem|paragrafo|poema|noticia|artigo de lei|caso hipotetico|situacao apresentada)\b/.test(text),
    figure: /\b(?:figura|imagem|grafico|mapa|charge|tirinha|cartum|quadrinho|diagrama|fluxograma|esquema|fotografia|desenho)\b/.test(text),
    table: /\b(?:tabela|quadro)\b/.test(text),
  };
};

export const findQuestionMarkers = (
  value: string,
  parserProfile: ExamParserProfile = resolveExamParserProfile(value),
) => collectQuestionMarkersFromPatterns(value, parserProfile);

export const contextHasPluralQuestionDirective = (value: string) => {
  const normalized = String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim();

  return /\b(?:para\s+responder(?:\s+(?:as?|aos?))?\s+(?:quest(?:ao|oes)|itens?)|texto\s+para\s+(?:(?:responder|os?|as?)\s+)*(?:quest(?:ao|oes)|itens?)|atencao\s*:\s*para\s+responder|quest(?:ao|oes)\s+seguintes?|itens?\s+(?:seguintes?|a\s+seguir)|com\s+base\s+no\s+texto\s+acima\s*,?\s*responda\s+(?:as?|aos?)\s+(?:quest(?:ao|oes)|itens?)|quest(?:ao|oes)\s+que\s+(?:tratam|abordam|versam)\b)/i
    .test(normalized);
};

export const pageLikelyHasFigure = (value: string) => (
  new RegExp(`\\b(?:${VISUAL_CONTEXT_TERMS_PATTERN}|ilustra[cç][aã]o|fotografia|desenho\\s+geometrico|circuito\\s+eletrico|planta|esquema\\s+quimico|tabela\\s+periodica)\\b`, 'i')
    .test(value)
);

export const normalizeExtractionFigureBox = (box?: FigureBox) => {
  if (!box) {
    return undefined;
  }

  const normalized = {
    x: Number(box.x),
    y: Number(box.y),
    width: Number(box.width),
    height: Number(box.height),
  };

  return Object.values(normalized).every((value) => Number.isFinite(value))
    ? normalized
    : undefined;
};

export const normalizeExtractionFigureBoxes = (...values: Array<FigureBox | FigureBox[] | undefined>) => (
  values
    .flatMap((value) => (Array.isArray(value) ? value : value ? [value] : []))
    .map((box) => normalizeExtractionFigureBox(box))
    .filter(Boolean)
    .filter((box, index, list) => {
      const signature = [box?.x, box?.y, box?.width, box?.height]
        .map((value) => Math.round(Number(value) || 0))
        .join(':');
      return list.findIndex((item) => [item?.x, item?.y, item?.width, item?.height]
        .map((value) => Math.round(Number(value) || 0))
        .join(':') === signature) === index;
    }) as FigureBox[]
);

export const readLooseField = (record: Record<string, unknown> | null | undefined, keys: string[]) => {
  if (!record) return undefined;
  for (const key of keys) {
    if (Object.prototype.hasOwnProperty.call(record, key)) {
      return record[key];
    }
  }

  const normalizedKeyMap = new Map<string, string>();
  Object.keys(record).forEach((key) => {
    normalizedKeyMap.set(normalizeComparisonText(key).replace(/\s+/g, ''), key);
  });

  for (const key of keys) {
    const normalizedKey = normalizeComparisonText(key).replace(/\s+/g, '');
    const matchedKey = normalizedKeyMap.get(normalizedKey);
    if (matchedKey && Object.prototype.hasOwnProperty.call(record, matchedKey)) {
      return record[matchedKey];
    }
  }

  return undefined;
};
