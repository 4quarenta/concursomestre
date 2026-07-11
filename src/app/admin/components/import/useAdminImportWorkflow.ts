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

type PdfJsModule = typeof import('pdfjs-dist/legacy/build/pdf.mjs');
type PdfDocumentProxy = Awaited<ReturnType<PdfJsModule['getDocument']>['promise']>;

export type GenerateSpecificType = 'teacher' | 'detailed';
export type ImportPublishAction = 'exam' | 'questions' | `question:${number}`;

interface ImportedQuestionDraft extends Partial<Question> {
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

interface QuestionCreateImportCardParams {
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

type ExtractionFieldMetadata = {
  origin: 'mechanical' | 'ai' | 'manual';
  confidence: number;
  sourcePage?: number;
  sourceBox?: FigureBox;
};

type QuestionExtractionOrigin = 'mechanical' | 'ai' | 'hybrid' | 'manual' | 'placeholder';

interface QuestionExtractionQuality {
  origin: QuestionExtractionOrigin;
  confidence: number;
  complete: boolean;
  localized: boolean;
  needsReview: boolean;
  reasons: string[];
  probablePages?: number[];
}

const EXAM_IMPORT_PARSER_VERSION = 'positioned-pdf-v3';

interface ImportMetadata extends NonNullable<PageExtractionResult['metadata']> {
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

interface FigureBox {
  x?: number | string;
  y?: number | string;
  width?: number | string;
  height?: number | string;
}

interface UseAdminImportWorkflowOptions {
  enabled?: boolean;
  systemSettings: SystemSettings;
  addToast: (message: string, type?: string) => void;
  onImportedQuestionsSaved?: (questions: Question[]) => void;
  updateSystemSettings?: (settings: SystemSettings) => Promise<unknown> | unknown;
  saveSystemSettingsNow?: (settings?: SystemSettings) => Promise<unknown> | unknown;
}

interface ImportedContextDraft {
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

interface ImportedQuestionImageDraft {
  tempId: string;
  title: string;
  description?: string;
  imageData?: string;
  pageImageData?: string;
  figureBox?: FigureBox;
  page?: number;
  manualCropApplied?: boolean;
}

interface ImportDiagnostics {
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

interface ImportAiBudget {
  maxCalls: number;
  usedCalls: number;
  reservedCalls: number;
  skippedCalls: number;
  failedCalls: number;
  cacheHits: number;
  exhausted: boolean;
}

interface ImportAiCallReservation {
  purpose: string;
  cacheKey: string;
  callNumber: number;
}

type AiExtractionPurpose =
  | 'none'
  | 'scanned_page'
  | 'missing_question'
  | 'incomplete_question'
  | 'visual_question'
  | 'context_repair'
  | 'layout_repair'
  | 'answer_key_repair';

interface AiExtractionDecision {
  useAi: boolean;
  purpose: AiExtractionPurpose;
  targetQuestionNumbers: number[];
  targetPages: number[];
  cropBox?: FigureBox;
  priority: number;
  reasons: string[];
}

interface PdfTextHighlight {
  text: string;
  bold: boolean;
  italic: boolean;
  underline: boolean;
}

interface PdfPageRichText {
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

type PositionedPdfTextItem = {
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

type PdfTextLine = {
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

type PdfTextBlock = {
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

type PdfTextColumn = {
  pageNumber: number;
  index: number;
  lines: PdfTextLine[];
  blocks: PdfTextBlock[];
  x: number;
  width: number;
  normalizedX: number;
  normalizedWidth: number;
};

type PdfPageData = {
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

type PageContentBlockType =
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

type ImportMetadataField = keyof ImportMetadata;
type ExtractedQuestionEditableField =
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

let pdfJsModulePromise: Promise<PdfJsModule> | null = null;

const loadPdfJsModule = async (): Promise<PdfJsModule> => {
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

const readErrorMessage = (error: unknown) => {
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

const isAiTokenLimitError = (error: unknown) => {
  const message = readErrorMessage(error).toLowerCase();
  return /token|tokens|context|contexto|context length|janela de contexto|max[_ -]?tokens|too long|input too large|payload too large|request entity too large|limite de contexto|limite de tokens|excedeu.*token|excede.*token|excedeu.*contexto|excede.*contexto/.test(message);
};

const isAiQuotaLimitError = (error: unknown) => {
  const message = readErrorMessage(error).toLowerCase();
  return /quota|cota|rate limit|rate-limit|resource exhausted|too many requests|429|limite de cota|quota exceeded|exceeded for metric|quota exceeded for metric|requests per minute|tokens per minute|rpm|tpm/.test(message);
};

const readExpectedQuestionTotal = (...values: unknown[]) => {
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

const buildSequentialQuestionNumbers = (total: number) => Array.from(
  { length: Math.max(0, Math.round(total)) },
  (_, index) => index + 1,
);

const buildInclusiveQuestionNumbers = (start: number, end: number) => {
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

const readPositiveQuestionNumber = (value: unknown) => {
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

const resolveQuestionRangeFromMetadata = (metadata: Record<string, unknown> | null | undefined) => {
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

const resolveExpectedQuestionNumbersForImport = ({
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

const stripHtml = (value: string) => value.replace(/<[^>]*>?/gm, '');

const escapeHtml = (value: string) => String(value || '')
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&#39;');

const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const blockHtmlPattern = /<\/?(?:p|div|h[1-6]|ul|ol|li|table|figure|figcaption|blockquote|pre|section|article)\b/i;
const safeInlineHtmlPattern = /<\/?(?:strong|em|u|b|i|mark)\b[^>]*>|<br\s*\/?>/gi;

const normalizeStructuredText = (value: string) => String(value || '')
  .replace(/\r\n?/g, '\n')
  .replace(/\u00A0/g, ' ')
  .split('\n')
  .map((line) => line.replace(/[ \t]+/g, ' ').trim())
  .join('\n')
  .replace(/\n{3,}/g, '\n\n')
  .trim();

const normalizeInlineText = (value: string) => String(value || '')
  .replace(/\s+/g, ' ')
  .trim();

const normalizeSafeInlineTag = (tag: string) => {
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

const escapeStructuredTextPreservingInlineHtml = (value: string) => {
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

const isLikelySupportTitleLine = (value: string) => {
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

const isLikelyAuthorLine = (value: string) => {
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

const isLikelySupportSubtitleLine = (value: string) => {
  const clean = stripHtml(value).replace(/\s+/g, ' ').trim();
  if (!clean || clean.length > 90 || /[.!?:;]$/.test(clean)) {
    return false;
  }

  const words = clean.split(/\s+/).filter(Boolean);
  return words.length <= 10 && /^[A-ZÁÉÍÓÚÂÊÔÃÕÇ"“0-9]/.test(clean);
};

const isPipeTableBlock = (lines: string[]) => (
  lines.length >= 2
  && lines.every((line) => line.includes('|'))
  && lines.every((line) => line.split('|').map((cell) => cell.trim()).filter(Boolean).length >= 2)
);

const formatPipeTableHtml = (lines: string[]) => {
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

const isFigureMarkerLine = (value: string) => /^\[FIGURA:\s*[-\w]+\]$/i.test(String(value || '').trim());

const formatStructuredSupportHtml = (value: string) => {
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

const toImportMetadata = (metadata: PageExtractionResult['metadata']) => (
  (metadata && typeof metadata === 'object' ? metadata : null) as ImportMetadata | null
);

const toImportedQuestionDraft = (question: Partial<Question>) => question as ImportedQuestionDraft;

const slugify = (value: string) => String(value || '')
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/^-+|-+$/g, '') || 'item';

const normalizeComparisonText = (value: string) => String(value || '')
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .replace(/[^a-z0-9]+/gi, ' ')
  .replace(/\s+/g, ' ')
  .trim()
  .toLowerCase();

type ExamParserProfileId =
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

type ImportedQuestionStatus = 'ok' | 'incompleta' | 'revisar';
type ImportedQuestionStatusReason =
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
type ImportedQuestionType =
  | 'multipla escolha'
  | 'certo ou errado'
  | 'verdadeiro/falso'
  | 'multipla assertiva'
  | 'somatorio'
  | 'discursiva'
  | 'redacao'
  | 'estudo de caso'
  | 'desconhecido';

interface ParserMarkerPattern {
  pattern: RegExp;
  numberGroup?: number;
  source: string;
}

type DetectedQuestionMarkerStyle =
  | 'word'
  | 'q'
  | 'item'
  | 'line-number'
  | 'numbered'
  | 'dash'
  | string;

type DetectedOptionMarkerStyle =
  | 'parenthesized'
  | 'punctuated'
  | 'dash'
  | 'word'
  | 'inline'
  | string;

type DetectedQuestionModality =
  | ImportedQuestionType
  | 'julgamento'
  | 'indefinida';

interface AdaptiveExamParserEvidence {
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

interface ExamParserProfile {
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

const COMMON_QUESTION_MARKER_PATTERNS: ParserMarkerPattern[] = [
  { pattern: /\b(?:quest[aã]o|questao)\s*(?:n[ºo]\s*)?0*(\d{1,3})\b/gi, numberGroup: 1, source: 'word' },
  { pattern: /\bq\.?\s*0*(\d{1,3})\b/gi, numberGroup: 1, source: 'q' },
  { pattern: /\bitem\s+0*(\d{1,3})\b/gi, numberGroup: 1, source: 'item' },
  { pattern: /(^|\n)\s*0*(\d{1,3})\s*(?=\n\s*\S)/g, numberGroup: 2, source: 'line-number' },
  { pattern: /(^|(?<=\s))0*(\d{1,3})\s*[.)]\s+(?=\S)/g, numberGroup: 2, source: 'numbered' },
  { pattern: /(^|(?<=\s))0*(\d{1,3})\s*[-–—]\s+(?=\S)/g, numberGroup: 2, source: 'dash' },
];

const OPTION_LABELS = ['A', 'B', 'C', 'D', 'E', 'F'];

const COMMON_OPTION_MARKER_PATTERNS = [
  /(^|[\s([{;,:?!])(?:alternativa\s+)?\(?([A-F])\)?\s*[).:;\-–—]\s*/gi,
  /(^|[\s([{;,:?!])alternativa\s+([A-F])\b\s*/gi,
  /(^|[\s([{;,:?!])([A-F])\s+(?=\S)/gi,
];

const COMMON_PAGE_HEADER_PATTERN = /\b(?:caderno\s+de\s+quest[oõ]es|prova\s+objetiva|concurso\s+p[uú]blico|processo\s+seletivo|rascunho|assinatura\s+do\s+candidato)\b/i;
const COMMON_FOOTER_PATTERN = /\b(?:www\.[\w.-]+|p[aá]gina\s+\d+|\d+\s*$|confira\s+seus\s+dados|cart[aã]o[- ]resposta)\b/i;
const VISUAL_CONTEXT_TERMS_PATTERN = '(?:figura|imagem|fotografia|desenho|grafico|gr[aá]fico|tabela|mapa|charge|tirinha|cartum|quadrinho|fluxograma|organograma|circuito|planta|esquema|diagrama|infografico|infogr[aá]fico|quadro|tabela\\s+periodica|imagem\\s+historica|desenho\\s+geometrico|esquema\\s+quimico)';
const COMMON_CONTEXT_START_PATTERN = new RegExp(`\\b(?:textos?\\s+(?:[ivxlc]+|\\d+)|leia\\s+os?\\s+textos?|leia\\s+o\\s+texto\\s+abaixo|considere\\s+o\\s+texto|considere\\s+as\\s+(?:(?:\\w+)\\s+){0,4}passagens|com\\s+base\\s+no\\s+texto|para\\s+responder(?:\\s+[aà]s?)?\\s+(?:quest(?:[oõ]es|oes)|itens?)|texto\\s+para\\s+(?:(?:responder|os?|as?)\\s+)*(?:quest(?:[oõ]es|oes)|itens?)|(?:quest(?:[oõ]es|oes)|itens?)\\s+(?:de(?:\\s+n[uú]meros?)?\\s+)?\\d{1,3}\\s*(?:a|ate|-)\\s*\\d{1,3}|aten[cç][aã]o\\s*:\\s*para\\s+responder|observe\\s+(?:a|o)\\s+${VISUAL_CONTEXT_TERMS_PATTERN}|analise\\s+a\\s+tabela|no\\s+trecho\\s+destacado|na\\s+(?:figura|tabela)|fragmento|${VISUAL_CONTEXT_TERMS_PATTERN}\\s*\\d*)\\b`, 'i');

const GENERIC_EXAM_PARSER_PROFILE: ExamParserProfile = {
  id: 'generic',
  label: 'Generico',
  defaultMultipleChoiceOptions: 0,
  questionMarkerPatterns: COMMON_QUESTION_MARKER_PATTERNS,
  optionMarkerPatterns: COMMON_OPTION_MARKER_PATTERNS,
  pageHeaderPattern: COMMON_PAGE_HEADER_PATTERN,
  footerPattern: COMMON_FOOTER_PATTERN,
  contextStartPattern: COMMON_CONTEXT_START_PATTERN,
};

const countPatternMatches = (text: string, pattern: RegExp) => Array.from(text.matchAll(cloneGlobalPattern(pattern))).length;

const inferAdaptiveOptionCountFromText = (text: string, parserProfile: ExamParserProfile = GENERIC_EXAM_PARSER_PROFILE) => {
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

const inferOptionMarkerStyles = (markers: ReturnType<typeof readOptionMarkers>): DetectedOptionMarkerStyle[] => {
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

const inferProbableModalitiesFromText = (text: string, parserProfile: ExamParserProfile): DetectedQuestionModality[] => {
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

const buildAdaptiveExamParserProfile = (
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

const createStandardExamParserProfile = ({
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

const EXAM_PARSER_PROFILES: ExamParserProfile[] = [
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

const resolveExamParserProfile = (...signals: unknown[]): ExamParserProfile => {
  const normalizedSignal = normalizeComparisonText(signals.map((signal) => String(signal || '')).join(' '));
  return EXAM_PARSER_PROFILES.find((profile) => (
    profile.signalPattern?.test(normalizedSignal)
  )) || GENERIC_EXAM_PARSER_PROFILE;
};

const cloneGlobalPattern = (pattern: RegExp) => new RegExp(pattern.source, pattern.flags.includes('g') ? pattern.flags : `${pattern.flags}g`);

const normalizePdfTextForParsing = (
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

const DISCIPLINE_TITLE_PATTERNS: RegExp[] = [
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

const normalizeDisciplineTitle = (value: string) => String(value || '')
  .replace(/\s+/g, ' ')
  .trim()
  .replace(/\b([A-ZÀ-ÖØ-Þ])([A-ZÀ-ÖØ-Þ]+)\b/g, (match) => (
    match.charAt(0).toUpperCase() + match.slice(1).toLowerCase()
  ));

const inferDisciplineFromTextBefore = (value: string) => {
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

const ROLE_START_PATTERN = /^(?:soldado|cabo|sargento|tenente|oficial|professor|analista|t[eé]cnico|tecnico|agente|assistente|auditor|fiscal|escriv[aã]o|delegado|m[eé]dico|medico|enfermeiro|engenheiro|combatente)\b/i;
const ROLE_SIGNAL_PATTERN = /\b(?:cargo|prova|soldado|cabo|sargento|tenente|oficial|professor|analista|t[eé]cnico|tecnico|agente|assistente|auditor|fiscal|escriv[aã]o|delegado|m[eé]dico|medico|enfermeiro|engenheiro|combatentes?|pol[ií]cia|policia|bombeiro|pm|bm|qpc|qbmp)\b/i;

const cleanRoleCandidate = (value: unknown) => String(value || '')
  .replace(/^[\s:;,\-–—]+/, '')
  .replace(/\b(?:cargo|prova|cargo\/prova)\s*[:\-–—]\s*/i, '')
  .replace(/\s+/g, ' ')
  .trim();

const readExamEntityLabel = (value: unknown): string => {
  if (!value || typeof value !== 'object') {
    return String(value || '').trim();
  }

  const record = value as Record<string, unknown>;
  return String(record.name || record.nome || record.sigla || record.descricao || record['descrição'] || record.slug || '').trim();
};

const cleanOrganizationCandidate = (value: unknown) => readExamEntityLabel(value)
  .replace(/^[\s:;,\-–—]+/, '')
  .replace(/\b(?:[oó]rg[aã]o|orgao|fonte|institui[cç][aã]o)\s*[:\-–—]\s*/i, '')
  .replace(/\s+/g, ' ')
  .trim();

const splitOrganizationCandidate = (value: unknown) => {
  const clean = cleanOrganizationCandidate(value);
  if (!clean) {
    return [];
  }

  return clean
    .split(/(?:\r?\n|;|,|\s*\/\s*|\s+\|\s+)/)
    .map(cleanOrganizationCandidate)
    .filter((item) => item.length >= 2 && item.length <= 120);
};

const normalizeOrganizationList = (...values: unknown[]) => {
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

const splitRoleCandidate = (value: unknown, requireSignal = false) => {
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

const normalizeRoleList = (...values: unknown[]) => {
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

const summarizeRoleList = (roles: string[], fallback = '') => (
  roles.length > 0 ? roles.join(' / ') : String(fallback || '').trim()
);

const summarizeExamTitleList = (items: string[], fallback = '') => (
  items.length > 0 ? items.join('/') : String(fallback || '').trim()
);

const toPromptHint = (...values: unknown[]) => {
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

const inferRolesFromText = (value: string, fileName = '') => {
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

const toLooseRecord = (value: unknown): Record<string, unknown> | null => (
  value && typeof value === 'object' ? value as Record<string, unknown> : null
);

const readPdfTextStyle = (item: unknown, styles: Record<string, unknown>) => {
  const record = toLooseRecord(item);
  const fontName = String(record?.fontName || '');
  const styleRecord = toLooseRecord(styles[fontName]);
  return `${fontName} ${String(styleRecord?.fontFamily || '')}`.toLowerCase();
};

const isBoldPdfTextStyle = (styleText: string) => (
  /\b(bold|black|heavy|semibold|semi-bold|demi|extrabold|extra-bold)\b/i.test(styleText)
);

const isItalicPdfTextStyle = (styleText: string) => (
  /\b(italic|oblique|italico|it\b)\b/i.test(styleText)
);

const isUnderlinePdfTextStyle = (styleText: string) => (
  /\b(underline|underlined|sublinhad[oa]|subline)\b/i.test(styleText)
);

const isMeaningfulHighlightText = (value: string) => {
  const clean = stripHtml(value).replace(/\s+/g, ' ').trim();
  return clean.length >= 2 && /[\p{L}\p{N}]/u.test(clean) && !/^\W+$/.test(clean);
};

const mergeAdjacentHighlights = (items: PdfTextHighlight[]) => {
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

const wrapHighlightedText = (value: string, highlight: Pick<PdfTextHighlight, 'bold' | 'italic' | 'underline'>) => {
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

type PdfTextSegment = PdfTextHighlight & {
  lineBreakAfter?: boolean;
  blockBreakAfter?: boolean;
};

const joinPdfTextSegments = (
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

const buildPlainPdfText = (items: PdfTextSegment[]) => joinPdfTextSegments(
  items,
  (item) => item.text,
);

const buildHighlightedPdfTextHtml = (items: PdfTextSegment[]) => joinPdfTextSegments(
  items,
  (item) => (
    item.bold || item.italic || item.underline
      ? wrapHighlightedText(item.text, item)
      : escapeHtml(item.text)
  ),
);

const normalizePdfCoord = (value: number, total: number) => (
  total > 0 && Number.isFinite(value)
    ? Math.max(0, Math.min(1000, (value / total) * 1000))
    : 0
);

const getPdfLineBox = <T extends {
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

const buildLineTextFromPdfItems = (items: PositionedPdfTextItem[], rich = false) => items
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

const makePdfTextLine = (
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

const reconstructPdfTextLines = (
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

const detectPdfTextColumns = (lines: PdfTextLine[], pageNumber: number): PdfTextColumn[] => {
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

const makePdfTextBlock = (
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

const reconstructPdfTextBlocks = (columns: PdfTextColumn[], pageNumber: number): PdfTextBlock[] => {
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

const classifyPdfPageType = (
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

const buildPlainTextFromPdfLayout = (columns: PdfTextColumn[], blocks: PdfTextBlock[]) => {
  if (columns.length > 0) {
    return normalizeStructuredText(columns
      .flatMap((column) => column.blocks.length > 0 ? column.blocks : [makePdfTextBlock(column.lines, 0, column.pageNumber)])
      .map((block) => block.text)
      .filter(Boolean)
      .join('\n\n'));
  }

  return normalizeStructuredText(blocks.map((block) => block.text).filter(Boolean).join('\n\n'));
};

const buildRichTextFromPdfLayout = (columns: PdfTextColumn[], blocks: PdfTextBlock[]) => {
  if (columns.length > 0) {
    return normalizeStructuredText(columns
      .flatMap((column) => column.blocks.length > 0 ? column.blocks : [makePdfTextBlock(column.lines, 0, column.pageNumber)])
      .map((block) => block.richText)
      .filter(Boolean)
      .join('\n\n'));
  }

  return normalizeStructuredText(blocks.map((block) => block.richText).filter(Boolean).join('\n\n'));
};

const mergeNormalizedPdfBoxes = (items: Array<Pick<PdfTextLine, 'normalizedX' | 'normalizedY' | 'normalizedWidth' | 'normalizedHeight'>>) => {
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

const REFERENCE_BLOCK_PATTERN = /\b(?:dispon[ií]vel\s+em|acesso\s+em|adaptad[ao]\s+de|adaptad[ao]|fonte|internet|fragmento\s+adaptado|in\s*:)\b|https?:\/\/|www\./i;
const VISUAL_BLOCK_PATTERN = new RegExp(`\\b(?:${VISUAL_CONTEXT_TERMS_PATTERN})\\b`, 'i');
const VISUAL_INSTRUCTION_PATTERN = new RegExp(`\\b(?:observe|analise|considere|com\\s+base)\\b.{0,80}\\b(?:${VISUAL_CONTEXT_TERMS_PATTERN})\\b`, 'i');
const TABLE_BLOCK_PATTERN = /\b(?:tabela|quadro)\s*(?:[ivxlc]+|\d+)?\b/i;

const getPageBlockBox = (block: PdfTextBlock): FigureBox => ({
  x: Math.max(0, Math.round(block.normalizedX)),
  y: Math.max(0, Math.round(block.normalizedY)),
  width: Math.max(1, Math.min(1000, Math.round(block.normalizedWidth))),
  height: Math.max(1, Math.min(1000, Math.round(block.normalizedHeight))),
});

const toNumericFigureBox = (box?: FigureBox) => {
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

const getBlockQuestionMarker = (value: string) => {
  const clean = stripHtml(value).replace(/\s+/g, ' ').trim();
  const match = clean.match(/^(?:quest[aã]o\s*)?0*(\d{1,3})\s*[).:-]/i)
    || clean.match(/^q\.?\s*0*(\d{1,3})\b/i)
    || clean.match(/^item\s*0*(\d{1,3})\b/i);
  return match ? Number(match[1]) : 0;
};

const blockLooksLikeTextTable = (block: PdfTextBlock) => {
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

const classifyPageContentBlock = (
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

const inferContextTitleFromBlockText = (value: string, fallback: string) => {
  const clean = stripHtml(value).replace(/\s+/g, ' ').trim();
  const combinedTexts = clean.match(/\bTextos?\s+[IVXLC\d]+\s*(?:e|,|\/)\s*[IVXLC\d]+\b/i)?.[0];
  if (combinedTexts) {
    return combinedTexts.replace(/^texto\b/i, 'Textos');
  }
  const named = clean.match(/\b(?:Textos?|Figura|Tabela|Quadro)\s+(?:[IVXLC]+|\d+)\b/i)?.[0];
  return named || fallback;
};

const sameQuestionScope = (left: number[] = [], right: number[] = []) => {
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

const mergeExtractionContextList = (
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

const extractContextsFromPageInventory = (
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

const enrichMechanicalExtractionFromInventory = (
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

const estimatePdfQuestionRegionBox = (
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

const shouldIgnoreDominantHighlight = (items: PdfTextHighlight[], field: 'bold' | 'italic' | 'underline') => {
  const meaningfulItems = items.filter((item) => isMeaningfulHighlightText(item.text));
  if (meaningfulItems.length < 12) {
    return false;
  }
  const highlightedCount = meaningfulItems.filter((item) => item[field]).length;
  return highlightedCount / meaningfulItems.length > 0.72;
};

const applyPdfHighlightsToHtml = (value: string, highlights: PdfTextHighlight[]) => {
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

const ENEM_AREA_NORMALIZED_NAMES = new Set(
  ENEM_SUBJECT_AREA_OPTIONS.map((areaName) => normalizeComparisonText(areaName)),
);

const ENEM_DISCIPLINE_LABELS = Object.values(ENEM_SUBJECT_AREA_DESCRIPTIONS).flat();

const ENEM_DISCIPLINE_KEYWORDS: Array<{ label: string; keywords: string[] }> = [
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

const hasMeaningfulTextOverlap = (left: string, right: string) => {
  const normalizedLeft = normalizeComparisonText(left);
  const normalizedRight = normalizeComparisonText(right);
  if (normalizedLeft.length < 80 || normalizedRight.length < 80) {
    return false;
  }

  return normalizedLeft.includes(normalizedRight.slice(0, 80))
    || normalizedRight.includes(normalizedLeft.slice(0, 80));
};

const normalizeQuestionNumber = (value: unknown, fallback: number) => {
  const match = String(value ?? '').match(/\d+/);
  const parsed = match ? Number(match[0]) : fallback;
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

const readImportBooleanFlag = (value: unknown) => {
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

const isImportedQuestionMarkedCanceled = (question: Question | ImportedQuestionDraft) => {
  const draft = question as ImportedQuestionDraft;
  return readImportBooleanFlag(draft.anulada)
    || readImportBooleanFlag(draft.isCanceled)
    || readImportBooleanFlag(draft.isCancelled)
    || readImportBooleanFlag(draft.isCanceledQuestion)
    || readImportBooleanFlag(draft.isCancelledQuestion)
    || readImportBooleanFlag(draft.is_cancelled);
};

const isImportedQuestionAttributedToAll = (question: Question | ImportedQuestionDraft) => {
  const draft = question as ImportedQuestionDraft;
  return readImportBooleanFlag(draft.isAttributedToAll)
    || readImportBooleanFlag(draft.attributedToAll)
    || readImportBooleanFlag(draft.is_attributed_to_all);
};

const normalizeCanceledImportedQuestion = (
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

const instructionPattern = /\b(instru[cç][oõ]es|cart[aã]o[- ]resposta|prova objetiva|rascunho|transcreva|assine|dura[cç][aã]o|caderno de quest[oõ]es|aten[cç][aã]o|folha de respostas)\b/i;
const questionCommandPattern = /\b(quest[aã]o|assinale|julgue|considere|responda|marque|com base|de acordo|nesse contexto|neste contexto|nesse sentido|neste sentido|infere-se|no que se refere|observe|analise|a partir|segundo|qual|quais|acerca|em rela[cç][aã]o|sobre|o texto|a figura|o gr[aá]fico|o esquema|a tabela)\b/i;

const isLikelyInstructionText = (value: string) => {
  const clean = stripHtml(value).replace(/\s+/g, ' ').trim();
  if (clean.length < 18) {
    return true;
  }
  if (instructionPattern.test(clean) && !questionCommandPattern.test(clean)) {
    return true;
  }
  return false;
};

const normalizeContextClassifierText = (value: string) => stripHtml(String(value || ''))
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .replace(/[ºª]/g, '')
  .replace(/\s+/g, ' ')
  .trim()
  .toUpperCase();

const pageBookletHeaderPattern = /\b(CIENCIAS DA NATUREZA E SUAS TECNOLOGIAS|CIENCIAS HUMANAS E SUAS TECNOLOGIAS|LINGUAGENS(?: CODIGOS)? E SUAS TECNOLOGIAS|MATEMATICA E SUAS TECNOLOGIAS|CADERNO\s+\d+|QUESTOES?\s+DE\s+\d+\s+A\s+\d+|[12]\s*DIA|AMAREL[OA]|AZUL|ROSA|BRANC[OA]|CINZA|PROVA\s+(?:AMAREL[OA]|AZUL|ROSA|BRANC[OA]|CINZA))\b/i;
const supportContextSignalPattern = new RegExp(`\\b(TEXTOS?\\s+(?:[IVXLC]+|\\d+)|leia\\s+os?\\s+textos?|leia\\s+o\\s+texto\\s+abaixo|considere\\s+o\\s+texto|considere\\s+as\\s+(?:(?:\\w+)\\s+){0,4}passagens|para\\s+responder(?:\\s+[aà]s?)?\\s+(?:quest(?:[oõ]es|oes)|itens?)|texto\\s+para\\s+(?:(?:responder|os?|as?)\\s+)*(?:quest(?:[oõ]es|oes)|itens?)|(?:quest(?:[oõ]es|oes)|itens?)\\s+(?:de(?:\\s+n[uú]meros?)?\\s+)?\\d{1,3}\\s*(?:a|ate|-)\\s*\\d{1,3}|aten[cç][aã]o\\s*:\\s*para\\s+responder|com\\s+base\\s+no\\s+texto|no\\s+trecho\\s+destacado|na\\s+figura|na\\s+tabela|fragmento|adaptad[ao]|dispon[ií]vel em|acesso em|fonte|${VISUAL_CONTEXT_TERMS_PATTERN})\\b`, 'i');
const supportContextStartPattern = new RegExp(`\\b(TEXTOS?\\s+(?:[IVXLC]+|\\d+)|leia\\s+os?\\s+textos?|leia\\s+o\\s+texto\\s+abaixo|considere\\s+o\\s+texto|considere\\s+as\\s+(?:(?:\\w+)\\s+){0,4}passagens|para\\s+responder(?:\\s+[aà]s?)?\\s+(?:quest(?:[oõ]es|oes)|itens?)|texto\\s+para\\s+(?:(?:responder|os?|as?)\\s+)*(?:quest(?:[oõ]es|oes)|itens?)|(?:quest(?:[oõ]es|oes)|itens?)\\s+(?:de(?:\\s+n[uú]meros?)?\\s+)?\\d{1,3}\\s*(?:a|ate|-)\\s*\\d{1,3}|aten[cç][aã]o\\s*:\\s*para\\s+responder|observe\\s+(?:a|o)\\s+${VISUAL_CONTEXT_TERMS_PATTERN}|analise\\s+a\\s+tabela|${VISUAL_CONTEXT_TERMS_PATTERN})\\b`, 'i');
const visualOptionPlaceholderPattern = /^Alternativa visual\b/i;

const isLikelyNamedTextTitleLine = (value: string, nextLine = '') => {
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

const isLikelySupportContextStartLine = (value: string, nextLine = '') => {
  const clean = stripHtml(value).replace(/\s+/g, ' ').trim();
  return supportContextStartPattern.test(clean)
    || isLikelyNamedTextTitleLine(clean, nextLine);
};

const findSupportContextStartIndex = (value: string) => {
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

const isLikelyPageBookletHeader = (value: string) => {
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

const trimBookletHeaderFromContext = (value: string) => {
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

const isLikelyContextReferenceCommand = (value: string) => {
  const normalized = normalizeContextClassifierText(value);
  if (!normalized) {
    return true;
  }
  return /^(?:INTERNET\s*:\s*\.)?\s*(?:NO QUE SE REFERE|COM BASE|CONSIDERANDO|A PARTIR).*?\b(?:JULGUE|ASSINALE|RESPONDA)\b.*\b(?:ITENS|QUESTOES|ITEM)\b/.test(normalized)
    && normalized.length < 260;
};

const sanitizeSupportContextText = (value: string) => {
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

interface TextSpan {
  start: number;
  end: number;
  text: string;
}

const isReferenceSegment = (value: string) => (
  /\b(?:et al\.|Revista|Jornal|Journal|Med\.|Chem\.|Res\.|Dispon[ií]vel em|Acesso em|Fonte|Internet|Adaptad[ao]\s+de|adaptad[ao]|fragmento|In\s*:|\d{4})\b|https?:\/\/|www\./i
    .test(value)
);

const normalizeReferenceSegment = (value: string) => String(value || '')
  .replace(/\s+/g, ' ')
  .replace(/\s+([,.;:])/g, '$1')
  .trim();

const collectReferenceSpans = (clean: string) => {
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

const isOperationalImportReference = (value: string) => {
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

const sanitizeReferenceTextForImport = (value: string) => (
  String(value || '')
    .split(/\n{2,}|\n/)
    .map(normalizeReferenceSegment)
    .filter((segment) => segment && !isOperationalImportReference(segment))
    .join('\n\n')
    .trim()
);

const mergeReferenceText = (...values: string[]) => {
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

const splitQuestionSupportReference = (value: string) => {
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

const estimatePdfResourceRegionBox = (
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

const shouldRepairQuestionPartsWithAi = ({
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

const normalizeAiRepairedOptions = (options: unknown, expectedOptionsCount: number) => (
  Array.isArray(options)
    ? options
      .map((option) => stripOptionLabel(String(option || '').replace(/\s+/g, ' ').trim()))
      .filter(Boolean)
      .slice(0, Math.max(2, expectedOptionsCount))
    : []
);

const shouldPromoteAsSupportContext = (value: string) => {
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

const textNeedsExternalSupportContext = (...values: string[]) => {
  const text = normalizeComparisonText(stripHtml(values.join(' ')));
  return /\b(?:texto|fragmento|trecho|passagem|paragrafo|narrador|autor|termo destacado|expressao destacada|palavra destacada|passagens destacadas|figura|imagem|grafico|tabela|tirinha|charge)\b/.test(text)
    || /\b(?:1o|2o|3o|4o|5o)\s*(?:paragrafo|§)\b/.test(text);
};

const isCarryoverEligibleTextContext = (context: ImportedContextDraft) => (
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

const findCarryoverTextContextForQuestion = (
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

const isInlineQuestionNumberReference = (text: string, markerIndex: number) => {
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

const parseContextQuestionNumbers = (value: string, fallbackNumber = 0) => {
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

const extractExplicitContextQuestionNumbers = (...values: unknown[]) => {
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

const resolveScopedContextQuestionNumbers = (
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

const extractInterQuestionSupportContexts = (
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

const splitNamedSupportContexts = (
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

const collectQuestionMarkersFromPatterns = (
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

const extractQuestionNumbersFromText = (value: string, parserProfile: ExamParserProfile = resolveExamParserProfile(value)) => {
  const matches = collectQuestionMarkersFromPatterns(value, parserProfile);

  return matches.map((marker) => marker.number);
};

const normalizeQuestionMarkerText = (value: string) => String(value || '')
  .replace(/\bQ\s*U\s*E\s*S\s*T\s*\S\s*O\b/gi, 'Questao')
  .replace(/(^|\n)\s*0*(\d{1,3})\s+0*(\d{1,3})\s*(?=\n\s*\S)/g, '$1$2)\n$3) ')
  .replace(/(^|[^\d])0*(\d{1,3})\s*[.)]\s*(?=(?:Relativamente|Ticio|Tício|Apresenta-se|Dentre|A\s+conduta|Leia|Como|Assinale|No\s+que|Em\s+relacao|Em\s+rela[cç][aã]o|De\s+acordo|Considerando|Com\s+base|Sobre|Qual|Quais|Julgue|Acerca|No\s+tocante|Quanto)\b)/gi, '$1$2) ');

const isTrueFalseExamText = (value: string) => (
  /\b(cespe|cebraspe|julgue os itens|julgue os próximos itens|julgue os seguintes itens|item certo|item errado|código c|codigo c)\b/i.test(String(value || ''))
  || (/\bCERTO\b/i.test(String(value || '')) && /\bERRADO\b/i.test(String(value || '')))
);

const isVerdadeiroFalsoExamText = (value: string) => (
  /\b(?:verdadeiro|falso|atribua\s+v|valores\s+de\s+verdadeiro|sequ[eê]ncia\s+correta\s+de\s+cima\s+para\s+baixo)\b/i.test(String(value || ''))
  || /\(\s*\)\s+.{0,120}\b(?:v|f)\b/i.test(String(value || ''))
);

const findPlainTrueFalseMarkers = (text: string) => {
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

const inferRoleFromFileName = (fileName = '') => {
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

const stripOptionLabel = (value: string) => String(value || '')
  .replace(/^\s*(?:alternativa\s*)?\(?[A-F]\)?(?:\s*[\s.)\-–—:]+|\s+)/i, '')
  .trim();

const readOptionMarkers = (
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

const looksLikeOptionCueBefore = (text: string, index: number) => {
  const before = text.slice(Math.max(0, index - 120), index).toLowerCase();
  return /(\?|respectivamente|alternativa|alternativas|op[cç][aã]o|op[cç][oõ]es|representad[oa] em|esbo[cç]ad[oa] no|corresponde(?:m)? a|associad[oa] a|causad[oa] pel[ao]|provocad[oa] pel[ao]|induzid[oa] pel[ao]|decorre d[ao]|mais pr[oó]xim[ao] de|igual a|valor de|resultado de|finalidade de|objetivo de|serve para|permite|porque|pois|s[ãa]o|seria(?:m)?|assinale|marque|em:)\s*[,.:;]?$/i.test(before)
    || /(?:^|\s)(?:[ée]\s+a|e\s+a|[ée]|e)\s*[,.:;]?$/.test(before);
};

const trimExtractedOptionText = (value: string) => String(value || '')
  .replace(/\s+(?:Considere|Leia|Observe|Analise)\s+[\s\S]{0,900}?\bpara\s+responder\b[\s\S]*$/i, '')
  .replace(/\s+(?:TEXTO\s+[IVXLC]+:?|MATEM[ÁA]TICA\b|RACIOC[IÍ]NIO\b|CONHECIMENTOS\b|www\.pciconcursos\.com\.br\b|\*?(?=[A-Z0-9]*\d)[A-Z0-9]{6,}\*?.*$|ENEM\d{4}.*$).*$/i, '')
  .trim();

const stripTrailingExamNoise = (value: string) => String(value || '')
  .replace(/\s+(?:\*?(?=[A-Z0-9]*\d)[A-Z0-9]{6,}\*?)(?:\s*ENEM\d{4}){1,}.*$/i, '')
  .replace(/\s+(?:ENEM\d{4}){2,}.*$/i, '')
  .replace(/\s+\*?(?=[A-Z0-9]*\d)[A-Z0-9]{6,}\*?\s*$/i, '')
  .replace(/\s+/g, ' ')
  .trim();

const extractOptionFragmentsFromText = (
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

const extractOptionsFromText = (
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

const isTrivialVisualOption = (option: string, label: string) => {
  const normalized = String(option || '')
    .replace(/\s+/g, ' ')
    .trim();
  return normalized.toUpperCase() === label
    || new RegExp(`^alternativa\\s+visual\\s+${label}$`, 'i').test(normalized)
    || new RegExp(`^op[cç][aã]o\\s+${label}$`, 'i').test(normalized);
};

const normalizeVisualOptions = (options: string[]) => {
  const labels = OPTION_LABELS;
  const hasTrivialVisualSet = options.length >= 2
    && options.every((option, index) => isTrivialVisualOption(option, labels[index] || String(index + 1)));

  return hasTrivialVisualSet
    ? options.map((_, index) => `Alternativa visual ${labels[index] || index + 1}`)
    : options;
};

const shouldUseExtractedStatement = (rawText: string, extractedStatement: string, extractedOptionsCount: number) => {
  const text = String(rawText || '').replace(/\s+/g, ' ').trim();
  const statement = String(extractedStatement || '').replace(/\s+/g, ' ').trim();
  if (!statement || statement.length >= text.length) {
    return false;
  }

  return extractedOptionsCount >= 2
    || /(?:^|\s)A\s+B\s+C\s+D\s+E(?:\s|$)/i.test(text)
    || readOptionMarkers(text).length >= 2;
};

const normalizeImportedOptions = (
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

const splitSupportContextFromStatement = (value: string) => {
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

const splitInlineSupportContextFromStatement = (value: string) => {
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

const normalizeExpectedOptionsCount = (value: unknown) => {
  const count = Number(String(value ?? '').match(/[2-6]/)?.[0] || 0);
  return Number.isFinite(count) && count >= 2 && count <= 6 ? count : 0;
};

const inferExpectedOptionsCountFromText = (...values: unknown[]) => {
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

const getExpectedOptionsCount = (
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

const inferQuestionType = (
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

const looksLikeFlattenedStructuredText = (value: string) => {
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

const hasPreservedTextBreaks = (value: string) => (
  /<br\s*\/?>|\n|<\/(?:p|tr|li|h[1-6])>/i.test(String(value || ''))
);

const looksLikeCorruptedTableText = (...values: string[]) => {
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

const looksLikeCorruptedPoemText = (...values: string[]) => {
  const raw = values.map((value) => String(value || '')).join(' ').trim();
  const clean = stripHtml(raw).replace(/\s+/g, ' ').trim();
  if (!clean || hasPreservedTextBreaks(raw)) {
    return false;
  }

  const hasPoemSignal = /\b(?:poema|verso|estrofe|soneto|eu\s+l[ií]rico|minha\s+terra|as\s+aves|gorjeiam)\b/i.test(clean);
  const likelyVerseFragments = (clean.match(/\b(?:onde|que|quando|enquanto|n[aã]o|minha|meu|minhas|teus|suas)\b/gi) || []).length;
  return hasPoemSignal && clean.length >= 90 && likelyVerseFragments >= 3;
};

const looksLikeCorruptedLawText = (...values: string[]) => {
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

const mentionsSharedContextWithoutLink = (value: string, contextKey?: string) => (
  !String(contextKey || '').trim()
  && /\b(?:quest(?:[oõ]es|oes)|itens?)\s+\d{1,3}\s*(?:a|ate|e|,|-)\s*\d{1,3}\b/i.test(stripHtml(value))
);

const looksLikeBrokenCrossPageContext = (value: string, contextKey?: string) => (
  !String(contextKey || '').trim()
  && /\b(?:continua[cç][aã]o\s+do\s+texto|texto\s+da\s+p[aá]gina\s+anterior|continua\s+na\s+p[aá]gina|p[aá]gina\s+anterior|parte\s+2\s+do\s+texto)\b/i.test(stripHtml(value))
);

const referencedResourceKinds = (...values: string[]) => {
  const text = normalizeComparisonText(stripHtml(values.join(' ')));
  return {
    text: /\b(?:texto|textos i e ii|fragmento|trecho|passagem|paragrafo|poema|noticia|artigo de lei|caso hipotetico|situacao apresentada)\b/.test(text),
    figure: /\b(?:figura|imagem|grafico|mapa|charge|tirinha|cartum|quadrinho|diagrama|fluxograma|esquema|fotografia|desenho)\b/.test(text),
    table: /\b(?:tabela|quadro)\b/.test(text),
  };
};

const validateExtractedQuestionDraft = ({
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

const getQuestionExpectedOptionsCount = (question: Question) => {
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

const getQuestionIntroText = (question: Question) => {
  const draft = question as unknown as ImportedQuestionDraft & { intro_text?: string };
  return String(question.content?.supportText || draft.introText || draft.intro_text || '').trim();
};

const getQuestionReferenceText = (question: Question) => {
  const draft = question as unknown as ImportedQuestionDraft & { reference_text?: string };
  return String(question.content?.reference || draft.referenceText || draft.reference_text || '').trim();
};

const getQuestionStatementText = (question: Question) => (
  String(question.content?.statement || question.enunciado || (question as unknown as { text?: string }).text || '').trim()
);

const getQuestionOptionTexts = (question: Question) => (
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

const hasVisualOptionPayload = (question: Question) => (
  (Array.isArray(question.itens) ? question.itens : []).some((item) => {
    const record = item as unknown as { imageData?: unknown; pageImageData?: unknown };
    const body = String(item.corpo || '');
    return Boolean(record.imageData || record.pageImageData || /<img\b|data:image\/|Alternativa visual/i.test(body));
  })
);

const buildFinalQuestionReviewRawText = (question: Question) => {
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

const getReliableExtractedQuestionNumber = (question: Question) => {
  const record = question as Question & {
    questionNumber?: number | string;
    question_number?: number | string;
    number?: number | string;
  };
  return normalizeQuestionNumber(record.questionNumber ?? record.question_number ?? record.number, 0);
};

const inferQuestionExtractionOrigin = (question: Question): QuestionExtractionOrigin => {
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

const isPlaceholderQuestion = (question: Question) => {
  const draft = question as unknown as ImportedQuestionDraft;
  return draft.qualityReport?.origin === 'placeholder'
    || draft.extractionQuality?.origin === 'placeholder'
    || (draft.statusReasons || []).includes('questao_placeholder_criada');
};

const buildQuestionExtractionQuality = (
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

const auditQuestionCoverage = (
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

const getQuestionPublicationBlockReasons = (question: Question) => {
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

const isQuestionReadyForImportPublication = (question: Question) => (
  getQuestionPublicationBlockReasons(question).length === 0
);

const refreshManuallyEditedImportQuestion = (question: Question): Question => {
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

const shouldRunFinalQuestionPartsReview = (question: Question) => {
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

const getImportedQuestionNumber = (question: Question, fallback: number): number => {
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

const getPublishedExamId = (exam: Record<string, unknown> | null | undefined) => (
  exam?.id
  ?? exam?.provaId
  ?? exam?.prova_id
  ?? exam?.exam_id
  ?? exam?.publishedExamId
  ?? exam?.published_exam_id
);

const getPublishedQuestionNumberFromRecord = (value: unknown, fallback = 0) => {
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

const completeQuestionOptionsFromPrefix = (question: Question, prefixText: string) => {
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

const answerLetterToIndex = (value: string) => {
  const letter = String(value || '').trim().toUpperCase();
  const index = OPTION_LABELS.indexOf(letter);
  return index >= 0 ? index : null;
};

const normalizeComparableText = (value: string) => String(value || '')
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .replace(/[^a-z0-9]+/gi, ' ')
  .replace(/\s+/g, ' ')
  .trim()
  .toUpperCase();

const normalizeAnswerKeyRoleTargets = (targetRole: string | string[] = '') => {
  const roleCandidates = normalizeRoleList(targetRole);
  const rawCandidates = Array.isArray(targetRole) ? targetRole : [targetRole];
  const candidates = roleCandidates.length > 0 ? roleCandidates : rawCandidates;

  return candidates
    .map((role) => normalizeComparableText(String(role || '')))
    .filter((role, index, list) => role.length > 0 && list.indexOf(role) === index);
};

const pickAnswerKeySection = (text: string, targetRole: string | string[] = '') => {
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

const shouldUseAnswerKeyPage = (text: string, targetRole: string | string[] = '') => {
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

const ATTRIBUTED_TO_ALL_ANSWER_INDEX = -2;
const CANCELED_ANSWER_INDEX = -1;
const ANSWER_KEY_TOKEN_PATTERN_SOURCE = String.raw`ATRIBU[IÍ]D[AO]S?\s+A\s+TODOS|QUEST[AÃ]O\s+ANULAD[AO]|QUEST[AÃ]O\s+CANCELAD[AO]|ANULAD[OA]|CANCELAD[OA]|\b(?:TODOS|[A-F]|X|T)\b|\*`;

const convertAnswerTokenToIndex = (value: string, trueFalseMode: boolean) => {
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

const parseAnswerEntries = (text: string) => {
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

const parseAnswerKeyFromText = (value: string, targetRole: string | string[] = ''): Record<number, number> => {
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

const BOOKLET_COLOR_LABELS: Array<[RegExp, string]> = [
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

const normalizeBookletType = (value: unknown) => {
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

const normalizeBookletColor = (value: unknown) => {
  const normalized = normalizeComparisonText(String(value || ''));
  if (!normalized) {
    return '';
  }

  return BOOKLET_COLOR_LABELS.find(([pattern]) => pattern.test(normalized))?.[1] || '';
};

const inferStandaloneBookletColor = (...values: unknown[]) => {
  const shortSignal = values
    .map((value) => String(value || '').trim())
    .filter((value) => value.length > 0 && value.length <= 180)
    .join(' ');
  const normalized = normalizeComparisonText(shortSignal);

  return BOOKLET_COLOR_LABELS.find(([pattern]) => pattern.test(normalized))?.[1] || '';
};

const inferBookletMetadataFromText = (...values: unknown[]) => {
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

const buildBookletMetadata = (metadata: ImportMetadata | null, ...signals: unknown[]): Partial<ImportMetadata> => {
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

const inferMetadataFromText = (value: string, fileName = ''): ImportMetadata => {
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

const extractMechanicalOptionsFromText = (
  value: string,
  expectedOptionsCount?: unknown,
  parserProfile: ExamParserProfile = resolveExamParserProfile(value),
) => {
  return extractOptionsFromText(value, expectedOptionsCount, parserProfile);
};

const findQuestionMarkers = (
  value: string,
  parserProfile: ExamParserProfile = resolveExamParserProfile(value),
) => collectQuestionMarkersFromPatterns(value, parserProfile);

const extractStructuredPrefixBeforeFirstQuestion = (
  value: string,
  parserProfile: ExamParserProfile = resolveExamParserProfile(value),
) => {
  const text = normalizeQuestionMarkerText(value);
  const markers = findQuestionMarkers(text, parserProfile);
  return markers[0] ? text.slice(0, markers[0].index).trim() : '';
};

type MechanicalQuestionSegment = {
  marker: { number: number; index: number; raw: string };
  segment: string;
  subject: string;
  hasSpecificContext: boolean;
};

const contextHasPluralQuestionDirective = (value: string) => {
  const normalized = String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim();

  return /\b(?:para\s+responder(?:\s+(?:as?|aos?))?\s+(?:quest(?:ao|oes)|itens?)|texto\s+para\s+(?:(?:responder|os?|as?)\s+)*(?:quest(?:ao|oes)|itens?)|atencao\s*:\s*para\s+responder|quest(?:ao|oes)\s+seguintes?|itens?\s+(?:seguintes?|a\s+seguir)|com\s+base\s+no\s+texto\s+acima\s*,?\s*responda\s+(?:as?|aos?)\s+(?:quest(?:ao|oes)|itens?)|quest(?:ao|oes)\s+que\s+(?:tratam|abordam|versam)\b)/i
    .test(normalized);
};

const inferContextQuestionNumbersFromUsage = (
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

const createMechanicalExtractionFromText = (
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

const pageLikelyHasFigure = (value: string) => (
  new RegExp(`\\b(?:${VISUAL_CONTEXT_TERMS_PATTERN}|ilustra[cç][aã]o|fotografia|desenho\\s+geometrico|circuito\\s+eletrico|planta|esquema\\s+quimico|tabela\\s+periodica)\\b`, 'i')
    .test(value)
);

const questionLikelyHasVisualAlternatives = (
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

const getExtractionQuestionText = (question: PageExtractionResult['questions'][number]) => {
  const draft = question as ImportedQuestionDraft & { raw?: string };
  return [
    draft.text,
    (question as Question).enunciado,
    draft.raw,
    Array.isArray(draft.options) ? draft.options.join(' ') : '',
  ].map((value) => String(value || '').trim()).filter(Boolean).join(' ');
};

const getExtractionQuestionSupportText = (question: PageExtractionResult['questions'][number]) => {
  const draft = question as ImportedQuestionDraft & { intro_text?: string };
  return String(draft.supportText || draft.introText || draft.intro_text || '').trim();
};

const getExtractionQuestionContextKey = (question: PageExtractionResult['questions'][number]) => {
  const draft = question as ImportedQuestionDraft & {
    contextTempId?: string | number;
    grupoQuestaoTempId?: string | number;
  };
  return String(draft.contextKey || draft.contextTempId || draft.grupoQuestaoTempId || '').trim();
};

const extractionQuestionHasSupportPayload = (question: PageExtractionResult['questions'][number]) => {
  const draft = question as ImportedQuestionDraft;
  return Boolean(
    stripHtml(getExtractionQuestionSupportText(question)).replace(/\s+/g, ' ').trim().length >= 40
    || draft.supportFigureBox
    || (Array.isArray(draft.supportFigureBoxes) && draft.supportFigureBoxes.length > 0)
    || (Array.isArray(draft.supportImages) && draft.supportImages.length > 0)
  );
};

const extractionContextHasPayload = (context: NonNullable<PageExtractionResult['pageContexts']>[number]) => (
  stripHtml(String(context.text || context.richText || '')).replace(/\s+/g, ' ').trim().length >= 40
  || Boolean(context.hasFigure || context.figureBox || context.figureDescription)
  || (Array.isArray(context.figures) && context.figures.length > 0)
);

const extractionQuestionNeedsContextFallback = (question: PageExtractionResult['questions'][number]) => (
  textNeedsExternalSupportContext(getExtractionQuestionText(question))
  && !getExtractionQuestionContextKey(question)
  && !extractionQuestionHasSupportPayload(question)
);

const pageHasLikelySupportContext = (
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

const extractionLikelyNeedsSupportContextFallback = (
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

const extractionNeedsAi = (
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

const decideAiExtractionForPage = (
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

const mergeExtractionText = (...values: Array<unknown>) => {
  const parts = values
    .map((value) => String(value || '').trim())
    .filter(Boolean);

  return Array.from(new Set(parts)).join('\n\n');
};

const createExtractionFieldMetadata = (
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

const getQuestionFieldMetadata = (question: PageExtractionResult['questions'][number]) => {
  const draft = question as ImportedQuestionDraft;
  return {
    ...(draft.fieldMetadata || {}),
    ...(draft.extractionFieldMetadata || {}),
  };
};

const setQuestionFieldMetadata = (
  question: PageExtractionResult['questions'][number],
  metadata: Partial<Record<string, ExtractionFieldMetadata>>,
) => ({
  ...(question as ImportedQuestionDraft),
  fieldMetadata: metadata,
  extractionFieldMetadata: metadata,
}) as PageExtractionResult['questions'][number];

const hasMeaningfulExtractionValue = (value: unknown) => {
  if (Array.isArray(value)) {
    return value.filter((item) => String(item || '').trim()).length > 0;
  }
  return String(value || '').trim().length > 0;
};

const hashTextForImportCache = (value: string) => {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36);
};

const computeArrayBufferFingerprint = (buffer: ArrayBuffer, file?: File | null) => {
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

const buildFigureBoxCacheSignature = (box?: FigureBox) => {
  const normalized = normalizeExtractionFigureBox(box);
  if (!normalized) {
    return '';
  }
  return [normalized.x, normalized.y, normalized.width, normalized.height]
    .map((value) => Math.round(Number(value) || 0))
    .join(':');
};

const chooseExtractionValue = <T,>(
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

const annotateQuestionExtractionFields = (
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

const annotatePageExtractionResult = (
  result: PageExtractionResult,
  origin: ExtractionFieldMetadata['origin'],
  confidence: number,
  sourceBox?: FigureBox,
): PageExtractionResult => ({
  ...result,
  questions: (result.questions || []).map((question) => annotateQuestionExtractionFields(question, origin, confidence, sourceBox)),
});

const normalizeExtractionFigureBox = (box?: FigureBox) => {
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

const normalizeExtractionFigureBoxes = (...values: Array<FigureBox | FigureBox[] | undefined>) => (
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

const mergeFigureBoxes = (boxes: FigureBox[]) => {
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

const mergeQuestionExtractionDraft = (
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

const mergeQuestionEditorialPatch = (current: Question, patch: Partial<Question>): Question => ({
  ...current,
  ...patch,
  teacherComment: String(patch.teacherComment || '').trim()
    ? patch.teacherComment
    : current.teacherComment,
  detailedComment: String(patch.detailedComment || '').trim()
    ? patch.detailedComment
    : current.detailedComment,
});

const mergePageExtractionResults = (
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

const normalizeDifficulty = (value: string | number | undefined | null) => {
  const normalized = String(value ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  if (normalized.includes('facil') || normalized === '1') return 1;
  if (normalized.includes('dificil') || normalized === '3') return 3;
  return 2;
};

const createTaxonomyLabel = (name: string, extras: Record<string, unknown> = {}) => ({
  id: undefined,
  name,
  nome: name,
  slug: slugify(name),
  ...extras,
});

const readLooseField = (record: Record<string, unknown> | null | undefined, keys: string[]) => {
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

const readLooseText = (record: Record<string, unknown> | null | undefined, keys: string[]) => {
  const value = readLooseField(record, keys);
  if (value === null || value === undefined) return '';
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return String(value).trim();
  }
  return '';
};

const readLooseArray = (record: Record<string, unknown> | null | undefined, keys: string[]) => {
  const value = readLooseField(record, keys);
  return Array.isArray(value) ? value : [];
};

const readLooseArrayOrScalar = (record: Record<string, unknown> | null | undefined, keys: string[]) => {
  const value = readLooseField(record, keys);
  if (Array.isArray(value)) return value;
  return value === null || value === undefined || value === '' ? [] : [value];
};

const metadataItemToDisplayText = (item: unknown) => {
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

const readLooseMetadataTextList = (record: Record<string, unknown> | null | undefined, keys: string[]) => (
  readLooseArrayOrScalar(record, keys)
    .map(metadataItemToDisplayText)
    .map((item) => item.trim())
    .filter(Boolean)
    .filter((item, index, list) => list.findIndex((candidate) => normalizeComparisonText(candidate) === normalizeComparisonText(item)) === index)
);

const readLooseStructuredList = (record: Record<string, unknown> | null | undefined, keys: string[]) => {
  const values = readLooseArrayOrScalar(record, keys);
  return values.length > 0 ? values : [];
};

const firstMetadataText = (items: string[], fallback = '') => items.find(Boolean) || fallback;

const extractJsonObjectText = (value: string) => {
  const clean = String(value || '').trim();
  const fenced = clean.match(/```(?:json)?\s*([\s\S]*?)```/i)?.[1]?.trim();
  const candidate = fenced || clean;
  if (candidate.startsWith('{') && candidate.endsWith('}')) return candidate;
  const start = candidate.indexOf('{');
  const end = candidate.lastIndexOf('}');
  return start >= 0 && end > start ? candidate.slice(start, end + 1) : candidate;
};

const parseQuestionNumberList = (value: unknown): number[] => {
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

const normalizeAnswerIndex = (value: unknown) => {
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

const inferImportedQuestionTypeFromPayload = (value: unknown, optionsCount: number): ImportedQuestionType => {
  const normalized = normalizeComparisonText(String(value || ''));
  if (normalized.includes('certo') && normalized.includes('errado')) return 'certo ou errado';
  if (normalized.includes('verdadeiro') || normalized.includes('falso')) return 'verdadeiro/falso';
  if (normalized.includes('discurs')) return 'discursiva';
  if (optionsCount >= 2) return 'multipla escolha';
  return 'desconhecido';
};

const readExternalImageData = (record?: Record<string, unknown> | null) => {
  const value = readLooseText(record, [
    'imageData',
    'image_data',
    'base64',
    'data',
    'dataUrl',
    'dataURL',
    'src',
    'url',
  ]);
  return value.replace(/^data:image\/[a-z0-9.+-]+;base64,/i, '').trim();
};

const normalizeAiQuestionOptions = (value: unknown) => {
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

const externalDetailedCommentIsGeneric = (value: string) => {
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

const normalizeExternalAiContextPayload = (payload: unknown): ImportedContextDraft[] => {
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

interface PageQuestionRange {
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

const scoreImportedQuestionDraft = (question: Question) => {
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

const createExpectedQuestionPlaceholder = ({
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

const getTaxonomyText = (item: QuestionTaxonomyLabel | string | number | undefined | null) => {
  if (item === null || item === undefined) {
    return '';
  }
  if (typeof item === 'string' || typeof item === 'number') {
    return String(item).trim();
  }
  return String(item.name || item.nome || item.descricao || item.sigla || '').trim();
};

const toQuestionFilterValue = (
  item: QuestionTaxonomyLabel | string | number | undefined | null,
): QuestionFilterValuePayload | null => {
  const label = getTaxonomyText(item);
  if (!label) {
    return null;
  }

  if (item && typeof item === 'object') {
    return {
      id: item.id ?? null,
      label,
      slug: item.slug ? String(item.slug) : undefined,
    };
  }

  return {
    id: null,
    label,
  };
};

const toQuestionFilterValues = (
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

const buildQuestionFiltersPayload = ({
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
  const subjectTaxonomy = assuntos.find((subject) => Boolean((subject as QuestionTaxonomyLabel).materia));
  const nonSubjectTaxonomies = assuntos.filter((subject) => !Boolean((subject as QuestionTaxonomyLabel).materia));
  const topicTaxonomy = nonSubjectTaxonomies[0];
  const specificSubjectTaxonomies = nonSubjectTaxonomies.slice(1);

  return {
    materias: toQuestionFilterValues([subjectTaxonomy]),
    topicos: toQuestionFilterValues([topicTaxonomy]),
    assuntos: toQuestionFilterValues(specificSubjectTaxonomies),
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

const getQuestionTaxonomyParts = (question: Question) => {
  const subjects = Array.isArray(question.assuntos) ? question.assuntos : [];
  const subject = subjects.find((item) => Boolean(item.materia));
  const nonSubjects = subjects.filter((item) => !item.materia);

  return {
    subject: getTaxonomyText(subject as unknown as QuestionTaxonomyLabel),
    topic: getTaxonomyText(nonSubjects[0] as unknown as QuestionTaxonomyLabel),
    specificSubject: getTaxonomyText(nonSubjects[1] as unknown as QuestionTaxonomyLabel),
  };
};

const uniqueTextList = (values: unknown[]) => values
  .map((value) => {
    if (value && typeof value === 'object') {
      return getTaxonomyText(value as QuestionTaxonomyLabel);
    }
    return String(value || '').trim();
  })
  .filter((value, index, list) => value.length > 0 && list.indexOf(value) === index);

const getRootFocusText = (value: string) => (
  String(value || '')
    .split('/')
    .map((part) => part.trim())
    .filter(Boolean)[0]
  || String(value || '').trim()
);

const getFocusSelectValue = (item: QuestionTaxonomyLabel | string | number | undefined | null) => {
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

const normalizeFocusCandidate = (
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

const findFocusByIdOrName = (
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

const toLooseCandidateList = (value: unknown) => {
  if (Array.isArray(value)) {
    return value;
  }
  if (value === null || value === undefined || String(value).trim() === '') {
    return [];
  }
  return [value];
};

const parseLooseRecordValue = (value: unknown): Record<string, unknown> | null => {
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

const findTaxonomyByText = (
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

const getTaxonomyParentValue = (item: QuestionTaxonomyLabel | null | undefined) => {
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

const getTaxonomyParentName = (item: QuestionTaxonomyLabel | null | undefined) => {
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

const resolveExamInheritedFocus = (
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

const getExtractedQuestionNumber = (question: Question, fallback: number) => {
  const record = question as Question & {
    questionNumber?: number | string;
    question_number?: number | string;
    number?: number | string;
  };
  return normalizeQuestionNumber(record.questionNumber ?? record.question_number ?? record.number, fallback);
};

const cleanExamTitlePart = (value: unknown) => String(value || '')
  .replace(/\s+/g, ' ')
  .replace(/\s*\(\d{4}\)\s*$/, '')
  .trim();

const cleanExplicitExamTitle = (value: unknown) => String(value || '')
  .replace(/\s+/g, ' ')
  .trim();

const readExamYear = (...values: unknown[]) => (
  values.map((value) => String(value || '').match(/\b(19\d{2}|20\d{2})\b/)?.[0]).find(Boolean) || ''
);

const joinExamTitleParts = (...parts: unknown[]) => parts.map(cleanExamTitlePart).filter(Boolean).join(' - ');

const buildStandardExamTitle = (metadata: ImportMetadata | null) => {
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

const buildExamTitle = (metadata: ImportMetadata | null, fallback = 'Prova importada') => {
  const standardTitle = buildStandardExamTitle(metadata);
  const explicitTitle = cleanExplicitExamTitle(metadata?.title || metadata?.examTitle || metadata?.name || metadata?.nome);
  return explicitTitle || standardTitle || fallback;
};

const buildImportExamTaxonomyMetadata = (metadata: ImportMetadata | null) => {
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

const broaderTopicForSpecificSubject = (specificSubject: string, subject: string, fallbackTopic = '') => {
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

const findEnemAreaLabel = (...values: unknown[]) => {
  const normalizedValues = values.map((value) => normalizeComparisonText(String(value || ''))).filter(Boolean);
  return ENEM_SUBJECT_AREA_OPTIONS.find((areaName) => {
    const normalizedArea = normalizeComparisonText(areaName);
    return normalizedValues.some((value) => value === normalizedArea || value.includes(normalizedArea));
  }) || '';
};

const isEnemAreaLabel = (value: string) => ENEM_AREA_NORMALIZED_NAMES.has(normalizeComparisonText(value));

const findEnemDisciplineLabel = (values: unknown[], areaLabel = '') => {
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

const isEnemImportSignal = (...values: unknown[]) => {
  const normalized = normalizeComparisonText(values.map((value) => String(value || '')).join(' '));
  return normalized.includes(normalizeComparisonText(ENEM_FOCUS_NAME))
    || normalized.includes('inep')
    || normalized.includes('exame nacional do ensino medio');
};

const normalizeEnemTaxonomyHierarchy = (
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

const resolveTaxonomyHierarchy = (subject: string, topic: string, specificSubject: string) => {
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

const EXTERNAL_AI_SUBJECT_KEYS = [
  'materia',
  'matéria',
  'subject',
  'disciplina',
  'discipline',
  'area',
  'área',
];

const EXTERNAL_AI_TOPIC_KEYS = [
  'topico',
  'tópico',
  'topic',
  'tema',
  'theme',
];

const EXTERNAL_AI_SPECIFIC_SUBJECT_KEYS = [
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

const readExternalAiQuestionTaxonomy = (
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

const buildExternalAiQuestionTaxonomies = (taxonomy: {
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

const buildQuestionPayloadImportCard = ({
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
      const imageData = String(record.imageData || record.base64 || '');
      const url = String(record.url || '');
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

const buildCanonicalAlternativesFromQuestion = (question: Question): QuestionAlternativePayload[] => {
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

const syncCanonicalQuestionPayload = (question: Question): Question => {
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

const parseSubjectsInput = (value: string) => String(value || '')
  .split(/[,;\n]/)
  .map((item) => item.trim())
  .filter((item, index, list) => item.length > 0 && list.indexOf(item) === index);

const deriveQuestionSubjects = (questions: Question[]) => questions
  .flatMap((question) => (question.assuntos || [])
    .filter((subject) => Boolean(subject.materia))
    .map((subject) => getTaxonomyText(subject as unknown as QuestionTaxonomyLabel)))
  .filter((subject, index, list) => subject.length > 0 && list.indexOf(subject) === index);

const applySharedExamMetadataToQuestion = (
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

const applyExamYearToQuestion = (
  question: Question,
  metadata?: ImportMetadata | null,
): Question => {
  const parsedYear = Number(readExamYear(metadata?.year, metadata?.ano));
  if (!Number.isFinite(parsedYear) || parsedYear <= 0) {
    return question;
  }

  return applySharedExamMetadataToQuestion(question, 'year', String(parsedYear));
};

const yieldToImportReviewPaint = () => new Promise<void>((resolve) => {
  if (typeof window !== 'undefined' && typeof window.requestAnimationFrame === 'function') {
    window.requestAnimationFrame(() => resolve());
    return;
  }

  setTimeout(resolve, 0);
});

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
    Boolean(String(image.imageData || '').trim())
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
      console.log('[ConcursoMestre][Importador] JSON_CANONICO_DA_EXTRACAO', pythonResult.reviewObject);
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
      let pendingCarryoverContext: {
        text: string;
        referenceText: string;
        title: string;
        startPage: number;
        visualBlocks: PageContentBlock[];
      } | null = null;

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
          const visualBlocks = (pageRichText.contentBlocks || []).filter((block) => (
            ['figure', 'table'].includes(block.type)
            && (
              block.id.endsWith('-regiao-visual')
              || VISUAL_BLOCK_PATTERN.test(pagePrefixSupportText)
            )
          ));
          pendingCarryoverContext = {
            text: pendingCarryoverContext
              ? mergeContextText(pendingCarryoverContext.text, pagePrefixSupportText)
              : pagePrefixSupportText,
            referenceText: mergeReferenceText(pendingCarryoverContext?.referenceText, pagePrefixParts.referenceText),
            title: pendingCarryoverContext?.title || `Texto de apoio - pagina ${pageIndex}`,
            startPage: pendingCarryoverContext?.startPage || pageIndex,
            visualBlocks: [
              ...(pendingCarryoverContext?.visualBlocks || []),
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
        defaultFocus: selectedFocus,
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
        defaultFocus: selectedFocus,
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

  const handleImportFromAiJson = async (sourceJson: string) => {
    const rawJson = String(sourceJson || '').trim();
    if (!rawJson) {
      addToast('Cole a resposta JSON da IA antes de gerar a revisão.', 'error');
      return;
    }

    const selectedFocus = resolveSelectedFocus();
    if (!selectedFocus) {
      addToast('Selecione ou crie um foco antes de importar o JSON da IA.', 'error');
      return;
    }

    if (isProcessing || isBulkGenerating || isRetryingMissingQuestions) {
      addToast('Aguarde o processamento atual terminar antes de importar o JSON da IA.', 'info');
      return;
    }

    try {
      const payload = JSON.parse(extractJsonObjectText(rawJson)) as Record<string, unknown>;
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
        const filters = toLooseRecord(readLooseField(record, ['filters', 'filtros'])) || {};
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
          const imageData = readExternalImageData(imageRecord);
          return {
            tempId: `ai-json-q${number}-img-${imageIndex + 1}`,
            title: readLooseText(imageRecord, ['title', 'titulo', 'name', 'nome']) || `Figura ${imageIndex + 1}`,
            description: readLooseText(imageRecord, ['description', 'descricao', 'text', 'texto']),
            imageData,
            pageImageData: readLooseText(imageRecord, ['pageImageData', 'page_image_data', 'pageBase64']),
            figureBox: normalizeExtractionFigureBox(readLooseField(imageRecord, ['figureBox', 'box', 'bbox']) as FigureBox),
            page: Number(readLooseField(imageRecord, ['page', 'pagina']) || 0) || undefined,
            manualCropApplied: Boolean(imageData),
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
          questionNumber: number,
          statement,
          introText: supportText,
          referenceText,
          teacherComment,
          detailedComment,
          contextKey,
          bancas: nextMetadata.agency ? [createTaxonomyLabel(String(nextMetadata.agency), { sigla: String(nextMetadata.agency) })] : [],
          orgaos: nextMetadata.source ? [createTaxonomyLabel(String(nextMetadata.source))] : [],
          cargos: nextMetadata.role ? [createTaxonomyLabel(String(nextMetadata.role), { descricao: String(nextMetadata.role) })] : [],
          assuntos: buildExternalAiQuestionTaxonomies(externalTaxonomy),
          anos: Number(nextMetadata.year) ? [Number(nextMetadata.year)] : [],
          carreiras: selectedFocus ? [selectedFocus] : [],
          niveis: nextMetadata.level ? [createTaxonomyLabel(String(nextMetadata.level))] : [],
          nivel: nextMetadata.level || undefined,
          tiposProva: nextMetadata.examType ? [createTaxonomyLabel(String(nextMetadata.examType))] : [],
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
        defaultFocus: selectedFocus,
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
      setPublishedQuestionNumbers([]);
      addLog(`JSON da IA importado: ${ensured.diagnostics.cardsCreatedCount} card(s), ${ensured.diagnostics.completeCardsCount} completo(s), ${ensured.diagnostics.placeholderCardsCount} pendente(s).`);
      addToast('Resposta da IA carregada na revisão.', 'success');
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

  const validateExamBeforePublish = () => {
    const selectedFocus = resolveSelectedFocus();
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
    if (selectedExamRecord && activePublishedExamId) {
      setPublishedExam(selectedExamRecord);
      addLog(`Prova #${selectedExam?.id || activePublishedExamId} ja vinculada. Nenhuma prova duplicada foi criada.`);
      addToast('A prova selecionada já está vinculada ao lote.', 'success');
      return;
    }
    if (!beginPublishingAction('exam')) {
      return;
    }

    try {
      const { examName, exam } = buildImportExamPayload(extractedQuestions);
      const response = await questionService.createImportedExam({
        exam,
        focus: selectedFocus as Record<string, unknown>,
      });

      if (!response.success) {
        throw new Error(response.message || 'Falha ao salvar a prova importada.');
      }

      const syncedExam = await syncPublishedExam(response.exam, examName);
      if (!syncedExam || !getPublishedExamId(syncedExam as Record<string, unknown>)) {
        throw new Error('A API salvou a prova, mas nao retornou um ID valido para o banco de provas.');
      }
      addToast('Prova publicada. Agora voce pode publicar as questoes vinculadas.', 'success');
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
    if (!activePublishedExam) {
      addToast('Publique a prova antes de publicar questoes.', 'error');
      return;
    }
    const publishedExamId = activePublishedExamId;
    if (!publishedExamId) {
      addToast('A prova publicada nao retornou ID valido. Publique a prova novamente antes das questoes.', 'error');
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
        contexts: contextsForPublish.map((context) => {
          const publishContent = buildContextPublishContent(context);
          const contextAssets: QuestionAsset[] = [
            ...(context.imageData
              ? [{
                tempId: `${context.tempId}-img-1`,
                type: 'image' as const,
                usage: 'context' as const,
                base64: context.imageData,
                alt: context.figureDescription || context.title || 'Imagem do contexto.',
                sourcePage: context.sourcePage || context.page || null,
                order: 1,
              }]
              : []),
            ...(context.figures || [])
              .filter((figure) => Boolean(figure.imageData))
              .map((figure, index) => ({
                tempId: String(figure.figureKey || `${context.tempId}-img-${index + 2}`),
                type: 'image' as const,
                usage: 'context' as const,
                base64: String(figure.imageData || ''),
                alt: figure.description || context.figureDescription || `Imagem ${index + 2} do contexto.`,
                sourcePage: figure.page || context.sourcePage || context.page || null,
                order: index + 2,
              })),
          ].filter((asset, index, assets) => (
            assets.findIndex((candidate) => candidate.tempId === asset.tempId) === index
          ));
          let contextText = String(publishContent.text || context.text || '')
            .replace(/\[FIGURA:\s*([-\w]+)\]/gi, '[image:$1]')
            .trim();
          contextAssets.forEach((asset) => {
            const marker = `[image:${asset.tempId}]`;
            if (!contextText.includes(marker)) {
              contextText = [contextText, marker].filter(Boolean).join('\n\n');
            }
          });

          return {
            tempId: context.tempId,
            type: context.questionNumbers.length > 1 ? 'shared' : 'individual',
            body: contextText,
            bodyClean: stripHtml(contextText),
            reference: String(publishContent.referenceText || context.referenceText || '').trim(),
            sourcePage: context.sourcePage || context.page || null,
            assets: contextAssets,
            questionNumbers: context.questionNumbers,
          };
        }),
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
        await syncPublishedExam((response.exam || activePublishedExam) as Record<string, unknown>, examName);
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
        } as Question;
        return next;
      }

      if (field === 'agency') {
        next[index] = {
          ...question,
          bancas: value ? [createTaxonomyLabel(value, { sigla: value })] : [],
        } as Question;
        return next;
      }

      if (field === 'organization') {
        const organizations = normalizeOrganizationList(value);
        next[index] = {
          ...question,
          orgaos: organizations.map((organization) => createTaxonomyLabel(organization)),
        } as Question;
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
          defaultFocus: resolveSelectedFocus(),
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
    handlePublishSingleQuestion,
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

