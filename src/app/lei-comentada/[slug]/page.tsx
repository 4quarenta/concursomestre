'use client';

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

import React from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import {
  ArrowLeft,
  ArrowRight,
  Bookmark,
  BookOpen,
  Bold,
  ChevronDown,
  ChevronRight,
  CheckCircle2,
  Crown,
  Eraser,
  ExternalLink,
  Eye,
  EyeOff,
  FileText,
  Flag,
  Highlighter,
  Italic,
  Lightbulb,
  Lock,
  Loader2,
  MessageSquare,
  Minus,
  Plus,
  RotateCcw,
  Save,
  Search,
  Share2,
  Scale,
  Star,
  Table,
  ThumbsDown,
  ThumbsUp,
  Trash2,
  Underline,
  Zap,
} from 'lucide-react';
import { useAuth } from '@providers/AuthProvider';
import { useToast } from '@providers/ToastProvider';
import MathRichText from '@/components/shared/math/MathRichText';
import RichTextEditor from '@/components/shared/ui/RichTextEditor';
import UpgradeModal from '@/components/shared/overlays/UpgradeModal';
import { getAssetUrl } from '@services/api';
import {
  PLATFORM_PAGE_DESCRIPTION_CLASS,
  PLATFORM_PAGE_TITLE_CLASS,
  PLATFORM_SURFACE_CARD_CLASS,
} from '@constants/layout';
import { legalCommentaryApiService } from '@services/legal-commentary';
import { supportService } from '@services/support';
import { reportsService } from '@services/reports';
import { questionService } from '@services/questions';
import { normalizeQuestionRichHtml } from '@services/questions/questionHtmlSanitizer';
import { useAppConfigStore } from '@/state/app-config/appConfigStore';
import {
  getAccessPlanName,
  getBenefitPlanLabel,
  getBenefitRequiredPlan,
  getNextPlanForHigherUsageLimit,
  getPlanUsageLimitForPlanName,
  hasPlanBenefit,
  isPlanUsageUnlimitedForPlanName,
  type CanonicalPlanName,
} from '@services/plans/planAccess';
import { incrementDailyUsageCount, readDailyUsageCount } from '@services/plans/clientUsageQuota';
import {
  DEFAULT_LEGAL_COMMENTARY_FEATURE_CONFIG,
  normalizeLegalCommentaryFeatureConfig,
} from '@constants/legal-commentary/featureAccess';
import type {
  ArticleExamTip,
  ArticleJurisprudence,
  LegalCommentaryFeatureConfigurableKey,
  LegalCommentaryFeatureFallbackMode,
  LegalCommentaryFeatureKey,
  LegalRichContentBlock,
  LegalUserComment,
  LawArticle,
  LawDetail,
  LawSection,
  LawSectionEditorial,
  LegalTargetedText,
  PlanBenefitKey,
  Question,
  TeacherComment,
} from '@types';

type CurrentUserLike = {
  id?: string;
  userId?: string;
  name?: string;
  email?: string;
  role?: 'student' | 'admin' | 'partner' | 'staff' | 'user';
  plan?: string;
  planDisplayName?: string;
  level?: number;
  photoUrl?: string;
} | null;

type ReadingTab = 'comments' | 'law' | 'analysis' | 'questions';
type CalloutTone = 'teacher' | 'doctrine' | 'juris' | 'tip' | 'question';
type LawSectionSummary = LawSection & {
  sectionSlug?: string;
  fromArticle: string;
  toArticle: string;
  articles: number;
  primaryArticleId: string;
  articleIds: string[];
};

type RenderableBlock = {
  id: string;
  sourceId?: string;
  kind: LawArticle['blocks'][number]['kind'] | 'fallback';
  label: string;
  text: string;
  isCaput: boolean;
  isLegalNote: boolean;
  indentLevel: number;
};

type InlineLegalNote = {
  id: string;
  tone: CalloutTone;
  title: string;
  body: string;
  referenceText: string;
  reactionKey?: string;
  likes?: number;
  dislikes?: number;
  userReaction?: 'like' | 'dislike' | null;
  targetBlockId?: string;
  blocks?: LegalRichContentBlock[];
  actionLabel?: string;
  isLocked?: boolean;
  lockedFeatureLabel?: string;
  lockedRequiredPlan?: string;
};

type RelatedQuestionsState = {
  status: 'idle' | 'loading' | 'ready' | 'error';
  rows: Question[];
  total: number;
  error?: string;
};

type SectionSupportActionMode = 'report' | 'teacher_request' | 'analysis_request';

type SectionTargetOption = {
  id: string;
  label: string;
  details: string;
};

const getUserId = (user: CurrentUserLike) => user?.id || user?.userId || user?.email || null;

const normalizeText = (value: unknown) => String(value || '')
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .toLowerCase()
  .trim();

const normalizeStorageKeyPart = (value: unknown) => normalizeText(value)
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/^-+|-+$/g, '');

const normalizeReferenceText = (value: unknown) => normalizeText(value)
  .replace(/[ºª]/g, '')
  .replace(/[^a-z0-9\s]/g, ' ')
  .replace(/\s+/g, ' ')
  .trim();

const getSignificantTokens = (value: unknown) => normalizeReferenceText(value)
  .split(' ')
  .filter((token) => token.length >= 5 && ![
    'artigo',
    'inciso',
    'alinea',
    'paragrafo',
    'caput',
    'direito',
    'questao',
    'prova',
    'banca',
    'concurso',
    'jurisprudencia',
    'doutrina',
    'sumula',
  ].includes(token));

const escapeLegalAnalysisHtml = (value: unknown) => String(value || '')
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&#039;');

const hasLegalRichBlockContent = (block?: LegalRichContentBlock | null) => Boolean(
  String(block?.content || '').trim()
  || (Array.isArray(block?.items) && block.items.some((item) => String(item || '').trim()))
  || (Array.isArray(block?.rows) && block.rows.some((row) => Array.isArray(row) && row.some((cell) => String(cell || '').trim()))),
);

const legalRichBlockToSingleAnalysisHtml = (block: LegalRichContentBlock) => {
  const title = String(block.title || '').trim();
  const content = String(block.content || '').trim();
  const parts: string[] = [];

  if (title) {
    parts.push(`<h3>${escapeLegalAnalysisHtml(title)}</h3>`);
  }

  if (block.type === 'table' && Array.isArray(block.rows) && block.rows.length > 0) {
    const headers = (block.headers || []).map((header) => `<th>${escapeLegalAnalysisHtml(header)}</th>`).join('');
    const rows = block.rows
      .filter((row) => Array.isArray(row) && row.some((cell) => String(cell || '').trim()))
      .map((row) => `<tr>${row.map((cell) => `<td>${escapeLegalAnalysisHtml(cell)}</td>`).join('')}</tr>`)
      .join('');
    parts.push(`<table>${headers ? `<thead><tr>${headers}</tr></thead>` : ''}<tbody>${rows}</tbody></table>`);
  } else if (content) {
    parts.push(content);
  }

  const items = (block.items || []).map((item) => String(item || '').trim()).filter(Boolean);
  if (items.length > 0) {
    parts.push(`<ul>${items.map((item) => `<li>${item}</li>`).join('')}</ul>`);
  }

  return parts.join('');
};

const buildSingleSectionAnalysisHtml = (editorial?: LawSectionEditorial | null) => {
  if (!editorial) {
    return '';
  }

  const blockHtml = (editorial.blocks || [])
    .filter(hasLegalRichBlockContent)
    .map(legalRichBlockToSingleAnalysisHtml)
    .filter(Boolean)
    .join('');

  if (blockHtml.trim()) {
    return blockHtml;
  }

  return String(editorial.summary || '').trim();
};

const formatDate = (iso?: string | null) => {
  if (!iso) return 'Sem registro';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return 'Sem registro';
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(date);
};

const formatPercent = (value?: number) => `${Math.max(0, Math.min(100, Math.round(Number(value || 0))))}%`;

const formatDateTime = (iso?: string | null) => {
  if (!iso) return 'Agora';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return 'Agora';
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
};

const stripRichText = (value: unknown) => String(value || '')
  .replace(/<[^>]+>/g, ' ')
  .replace(/\s+/g, ' ')
  .trim();

const normalizeLegalSearchText = (value: unknown) => normalizeText(stripRichText(value))
  .replace(/[^a-z0-9]+/g, ' ')
  .replace(/\s+/g, ' ')
  .trim();

const cleanLegalNoteText = (value: unknown) => String(value || '')
  .replace(/\s*\[(?:caput|par[aá]grafo(?:\s+u[nú]nico)?|inciso\s+[ivxlcdm]+|al[ií]nea\s+[a-z]|item\s+[a-z0-9]+)\]\s*/giu, ' ')
  .replace(/\s+/g, ' ')
  .trim();

const cleanLegalNoteTitle = (value: unknown) => cleanLegalNoteText(value)
  .replace(/^nota:\s*/iu, '')
  .trim();

const truncateText = (value: unknown, maxLength = 220) => {
  const text = stripRichText(value);
  return text.length > maxLength ? `${text.slice(0, maxLength - 1).trim()}…` : text;
};

const LEGAL_COMMENTARY_CONFIGURABLE_KEYS = new Set<LegalCommentaryFeatureConfigurableKey>([
  'lei.comentario_basico',
  'lei.doutrina',
  'lei.macete',
  'lei.como_cai',
  'lei.jurisprudencia',
  'lei.sumulas',
  'lei.questoes',
  'lei.raiox',
  'lei.anotacoes',
  'lei.modo_foco',
  'lei.favoritos',
  'lei.solicitar_comentario',
]);

const LEGAL_COMMENTARY_FEATURE_LABELS: Record<LegalCommentaryFeatureConfigurableKey, string> = {
  'lei.comentario_basico': 'Comentario do professor',
  'lei.doutrina': 'Doutrina',
  'lei.macete': 'Macete',
  'lei.como_cai': 'Como cai em prova',
  'lei.jurisprudencia': 'Jurisprudencia',
  'lei.sumulas': 'Sumulas',
  'lei.questoes': 'Questoes relacionadas',
  'lei.raiox': 'Analise detalhada',
  'lei.anotacoes': 'Anotacoes',
  'lei.modo_foco': 'Modo foco',
  'lei.favoritos': 'Favoritos',
  'lei.solicitar_comentario': 'Solicitar comentario',
};

const isConfigurableLegalFeatureKey = (
  featureKey: LegalCommentaryFeatureKey,
): featureKey is LegalCommentaryFeatureConfigurableKey => LEGAL_COMMENTARY_CONFIGURABLE_KEYS.has(
  featureKey as LegalCommentaryFeatureConfigurableKey,
);

const resolveInlineLegalNoteFeatureKey = (note: InlineLegalNote): LegalCommentaryFeatureConfigurableKey => {
  const title = normalizeText(note.title);

  if (note.tone === 'doctrine' || title.includes('doutrina')) {
    return 'lei.doutrina';
  }

  if (title.includes('sumula')) {
    return 'lei.sumulas';
  }

  if (note.tone === 'juris' || title.includes('jurisprudencia')) {
    return 'lei.jurisprudencia';
  }

  if (note.tone === 'tip' || title.includes('macete')) {
    return 'lei.macete';
  }

  if (note.tone === 'question') {
    return 'lei.questoes';
  }

  if (title.includes('como cai')) {
    return 'lei.como_cai';
  }

  return 'lei.comentario_basico';
};

type SectionReadingEntry = { startedAt?: string; completedAt?: string; restartedAt?: string };
type SectionReadingState = Record<string, SectionReadingEntry>;

const getSectionReadingStorageKey = (userKey: string, lawId: string) => `cm:legal-commentary:section-reading:${userKey}:${lawId}`;
const getSectionFavoriteStorageKey = (userKey: string, lawId: string) => `cm:legal-commentary:favorite-sections:${userKey}:${lawId}`;
const getTeacherCommentRequestStorageKey = (userKey: string, lawId: string) => (
  `cm:legal-commentary:teacher-comment-requests:${userKey}:${lawId}`
);
const getReaderMarkupStorageKey = (userKey: string, lawId: string, sectionId: string) => (
  `cm:legal-commentary:reader-markup:${userKey || 'guest'}:${lawId}:${sectionId}`
);
const buildSectionReadingKey = (section: Pick<LawSectionSummary, 'id' | 'fromArticle' | 'toArticle'>) => {
  const from = String(section.fromArticle || '').trim();
  const to = String(section.toArticle || from).trim();
  return from || to ? `${from}:${to}` : String(section.id || '');
};

const READER_TEXT_COLORS = ['#0f172a', '#2563eb', '#16a34a', '#dc2626', '#9333ea'];
const READER_HIGHLIGHT_COLORS = ['#fef08a', '#bbf7d0', '#bfdbfe', '#fecdd3', '#e9d5ff'];
const FLOATING_READER_TOOLBAR_TOP_OFFSET = 10;

const hexToRgb = (hexColor: string) => {
  const normalized = hexColor.replace('#', '').trim();
  if (!/^[0-9a-f]{6}$/i.test(normalized)) return '';
  const red = Number.parseInt(normalized.slice(0, 2), 16);
  const green = Number.parseInt(normalized.slice(2, 4), 16);
  const blue = Number.parseInt(normalized.slice(4, 6), 16);
  return `rgb(${red}, ${green}, ${blue})`;
};

const matchesReaderCommandElement = (element: HTMLElement, command: 'bold' | 'italic' | 'underline') => {
  const tagName = element.tagName.toLowerCase();
  const readerStyle = String(element.dataset.readerStyle || '').toLowerCase();
  if (readerStyle === command) {
    return true;
  }

  if (command === 'bold') {
    const rawWeight = element.style.fontWeight;
    const numericWeight = Number.parseInt(rawWeight, 10);
    return tagName === 'b'
      || tagName === 'strong'
      || rawWeight === 'bold'
      || rawWeight === 'bolder'
      || (Number.isFinite(numericWeight) && numericWeight >= 600);
  }

  if (command === 'italic') {
    return tagName === 'i' || tagName === 'em' || element.style.fontStyle === 'italic';
  }

  return tagName === 'u' || element.style.textDecoration.includes('underline');
};

const readReaderMarkupHtml = (storageKey: string) => {
  if (typeof window === 'undefined' || !storageKey) return '';
  try {
    return normalizeQuestionRichHtml(window.localStorage.getItem(storageKey) || '');
  } catch {
    return '';
  }
};

const saveReaderMarkupHtml = (storageKey: string, markupHtml: string) => {
  if (typeof window === 'undefined' || !storageKey) return;
  window.localStorage.setItem(storageKey, normalizeQuestionRichHtml(markupHtml));
};

const clearReaderMarkupHtml = (storageKey: string) => {
  if (typeof window === 'undefined' || !storageKey) return;
  window.localStorage.removeItem(storageKey);
};

const readSectionReadingState = (userKey: string, lawId: string): SectionReadingState => {
  if (typeof window === 'undefined' || !userKey || !lawId) return {};
  try {
    const parsed = JSON.parse(window.localStorage.getItem(getSectionReadingStorageKey(userKey, lawId)) || '{}');
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed as SectionReadingState : {};
  } catch {
    return {};
  }
};

const saveSectionReadingState = (userKey: string, lawId: string, state: SectionReadingState) => {
  if (typeof window === 'undefined' || !userKey || !lawId) return;
  window.localStorage.setItem(getSectionReadingStorageKey(userKey, lawId), JSON.stringify(state));
};

const getSectionReadingEntry = (
  state: SectionReadingState,
  section: Pick<LawSectionSummary, 'id' | 'fromArticle' | 'toArticle'>,
) => state[buildSectionReadingKey(section)] || state[String(section.id || '')];

const getDateTimeValue = (value?: string) => {
  const timestamp = value ? Date.parse(value) : 0;
  return Number.isFinite(timestamp) ? timestamp : 0;
};

const isSectionReadingRestartPending = (entry?: SectionReadingEntry) => (
  getDateTimeValue(entry?.restartedAt) > getDateTimeValue(entry?.completedAt)
);

const getSectionArticleIds = (section: Pick<LawSectionSummary, 'articleIds'>) => (section.articleIds || [])
  .map((articleId) => String(articleId || '').trim())
  .filter(Boolean);

const readFavoriteSectionIds = (userKey: string, lawId: string) => {
  if (typeof window === 'undefined' || !userKey || !lawId) return new Set<string>();
  try {
    const parsed = JSON.parse(window.localStorage.getItem(getSectionFavoriteStorageKey(userKey, lawId)) || '[]');
    return new Set(Array.isArray(parsed) ? parsed.map((item) => String(item)).filter(Boolean) : []);
  } catch {
    return new Set<string>();
  }
};

const saveFavoriteSectionIds = (userKey: string, lawId: string, ids: Set<string>) => {
  if (typeof window === 'undefined' || !userKey || !lawId) return;
  window.localStorage.setItem(getSectionFavoriteStorageKey(userKey, lawId), JSON.stringify(Array.from(ids)));
};

const readTeacherCommentRequestKeys = (userKey: string, lawId: string) => {
  if (typeof window === 'undefined' || !userKey || !lawId) return new Set<string>();
  try {
    const parsed = JSON.parse(window.localStorage.getItem(getTeacherCommentRequestStorageKey(userKey, lawId)) || '[]');
    return new Set(Array.isArray(parsed) ? parsed.map((item) => String(item)).filter(Boolean) : []);
  } catch {
    return new Set<string>();
  }
};

const saveTeacherCommentRequestKeys = (userKey: string, lawId: string, ids: Set<string>) => {
  if (typeof window === 'undefined' || !userKey || !lawId) return;
  window.localStorage.setItem(getTeacherCommentRequestStorageKey(userKey, lawId), JSON.stringify(Array.from(ids)));
};

const getArticleNumber = (article: LawArticle) => String(article.number || article.numero || '').trim();

const getArticleTaxonomyNames = (article: LawArticle) => {
  return [
    article.title,
    article.titulo,
  ]
    .map((item) => String(item || '').replace(/\s+/g, ' ').trim())
    .filter(Boolean);
};

const getArticleTextLines = (article: LawArticle): string[] => {
  const blockLines = Array.isArray(article.blocks)
    ? article.blocks
      .map((block) => String(block.text || '').trim())
      .filter(Boolean)
    : [];

  if (blockLines.length > 0) {
    return blockLines;
  }

  const paragraphLines = (Array.isArray(article.paragraphs) ? article.paragraphs : [])
    .map((paragraph) => String(paragraph.text || '').trim())
    .filter(Boolean);

  if (paragraphLines.length > 0) {
    return paragraphLines;
  }

  const singleLine = String(article.text || article.texto || '').trim();
  return singleLine ? [singleLine] : [];
};

const resolveArticleTeacherComments = (law: LawDetail, article: LawArticle): TeacherComment[] => {
  if (Array.isArray(article.comentarios) && article.comentarios.length > 0) {
    return article.comentarios;
  }

  return (Array.isArray(law.teacherComments) ? law.teacherComments : [])
    .filter((comment) => String(comment.articleId) === String(article.id));
};

const resolveArticleJurisprudence = (law: LawDetail, article: LawArticle): ArticleJurisprudence[] => {
  if (Array.isArray(article.jurisprudencia) && article.jurisprudencia.length > 0) {
    return article.jurisprudencia;
  }

  return (Array.isArray(law.jurisprudence) ? law.jurisprudence : [])
    .filter((entry) => String(entry.articleId) === String(article.id));
};

const normalizeLegalHeadingText = (value: string): string => value
  .replace(/\s+/g, ' ')
  .replace(/^capitulo\b/i, 'Capítulo')
  .replace(/^se[cç][aã]o\b/i, 'Seção')
  .replace(/^subse[cç][aã]o\b/i, 'Subseção')
  .trim();

const joinLegalHeadingParts = (...parts: Array<unknown>) => (
  parts
    .map((part) => normalizeLegalHeadingText(String(part || '').trim()))
    .filter(Boolean)
    .join(' - ')
);

const isArticleHeadingText = (value: string): boolean => /^\s*art\.?\s*\d/i.test(value);

const getSectionHeaderText = (article: LawArticle): string => {
  const raw = String(article.title || article.titulo || '').trim();
  if (!raw || isArticleHeadingText(raw)) return '';

  return normalizeLegalHeadingText(raw
    .replace(/^(?:T[IÍ]TULO|CAP[IÍ]TULO|SE[CÇ][AÃ]O|SUBSE[CÇ][AÃ]O|LIVRO|PARTE)\s+[IVXLCDM0-9]+(?:\s*[---]\s*|\s+)/i, '')
    .trim());
};

const getReadableSectionTitle = (section?: LawSectionSummary | null): string => {
  const raw = joinLegalHeadingParts(
    joinLegalHeadingParts(section?.chapterLabel, section?.chapterName),
    joinLegalHeadingParts(section?.titleLabel, section?.titleName),
  ) || String(section?.displayTitle || section?.title || '').trim();
  if (!raw) return '';

  return normalizeLegalHeadingText(raw);
};

const getTitleMarker = (article: LawArticle): string => {
  const raw = String(article.title || article.titulo || '').trim();
  return raw && !isArticleHeadingText(raw) ? raw : '';
};

const isLegalTextNoteBlock = (kind: RenderableBlock['kind'], label: string, text: string): boolean => {
  if (kind === 'note') {
    return true;
  }

  const normalized = normalizeText(`${label} ${text}`).replace(/\s+/g, ' ').trim();
  return /^nota(?:\s|\()/i.test(normalized);
};

const getLegalBlockIndentLevel = (kind: RenderableBlock['kind'], isLegalNote: boolean): number => {
  if (isLegalNote) return 1;
  if (kind === 'paragraph') return 1;
  if (kind === 'inciso') return 2;
  if (kind === 'alinea') return 3;
  if (kind === 'item') return 4;
  return 0;
};

const getLegalBlockIndentClass = (indentLevel: number): string => {
  if (indentLevel >= 4) return 'ml-12 sm:ml-20';
  if (indentLevel === 3) return 'ml-9 sm:ml-16';
  if (indentLevel === 2) return 'ml-6 sm:ml-10';
  if (indentLevel === 1) return 'ml-3 sm:ml-6';
  return '';
};

const buildArticleBlocks = (article: LawArticle): RenderableBlock[] => {
  const blocks = Array.isArray(article.blocks) ? article.blocks : [];
  if (blocks.length > 0) {
    return blocks
      .map((block, index) => {
        const kind = block.kind || 'caput';
        const label = String(block.label || '').trim();
        const text = String(block.text || '').trim();
        const isLegalNote = isLegalTextNoteBlock(kind, label, text);

        return {
          id: `${article.id}-block-${index}`,
          sourceId: block.id,
          kind,
          label,
          text,
          isCaput: String(kind || '') === 'caput',
          isLegalNote,
          indentLevel: getLegalBlockIndentLevel(kind, isLegalNote),
        };
      })
      .filter((block) => block.text);
  }

  const fallbackText = String(article.text || article.texto || '').trim();
  const fallbackParagraphs = Array.isArray(article.paragraphs) ? article.paragraphs : [];
  const lines: RenderableBlock[] = [];

  if (fallbackText) {
    lines.push({
      id: `${article.id}-caput`,
      kind: 'fallback',
      label: `Art. ${getArticleNumber(article) || '-'}`,
      text: fallbackText,
      isCaput: true,
      isLegalNote: false,
      indentLevel: 0,
    });
  }

  fallbackParagraphs.forEach((paragraph, index) => {
    const text = String(paragraph.text || '').trim();
    if (!text) return;
    lines.push({
      id: `${article.id}-paragraph-${index}`,
      kind: 'paragraph',
      label: String(paragraph.number || '').trim(),
      text,
      isCaput: false,
      isLegalNote: false,
      indentLevel: 1,
    });
  });

  return lines;
};

const collectLegalSearchValues = (value: unknown): string[] => {
  if (value === null || value === undefined) {
    return [];
  }

  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    const text = stripRichText(value);
    return text ? [text] : [];
  }

  if (Array.isArray(value)) {
    return value.flatMap(collectLegalSearchValues);
  }

  if (typeof value === 'object') {
    return Object.values(value as Record<string, unknown>).flatMap(collectLegalSearchValues);
  }

  return [];
};

const extractArticleOrdinals = (value: unknown): number[] => (
  String(value || '')
    .match(/\d+/g)
    ?.map((item) => Number.parseInt(item, 10))
    .filter((item) => Number.isFinite(item)) || []
);

const getArticleOrdinal = (article: LawArticle): number | null => {
  const [ordinal] = extractArticleOrdinals(getArticleNumber(article));
  return ordinal || null;
};

const sectionContainsArticle = (section: LawSectionSummary, article: LawArticle): boolean => {
  const articleId = String(article.id || '').trim();
  if (articleId && (section.articleIds || []).map((id) => String(id)).includes(articleId)) {
    return true;
  }

  if (article.sectionId && String(article.sectionId) === String(section.id)) {
    return true;
  }

  const articleOrdinal = getArticleOrdinal(article);
  if (!articleOrdinal) {
    return false;
  }

  const [fromOrdinal] = extractArticleOrdinals(section.fromArticle);
  const [toOrdinal] = extractArticleOrdinals(section.toArticle || section.fromArticle);
  if (!fromOrdinal || !toOrdinal) {
    return false;
  }

  return articleOrdinal >= Math.min(fromOrdinal, toOrdinal) && articleOrdinal <= Math.max(fromOrdinal, toOrdinal);
};

const getSectionSearchTitles = (section: LawSectionSummary) => [
  section.title,
  section.displayTitle,
  section.chapterLabel,
  section.chapterName,
  section.titleLabel,
  section.titleName,
]
  .map(normalizeLegalSearchText)
  .filter(Boolean);

const sectionEditorialMatchesArticle = (
  editorial: LawSectionEditorial,
  article: LawArticle,
  sections: LawSectionSummary[],
): boolean => {
  const articleId = String(article.id || '').trim();
  const articleNumber = normalizeLegalSearchText(getArticleNumber(article));
  const articleOrdinal = getArticleOrdinal(article);
  const matchingSections = sections.filter((section) => sectionContainsArticle(section, article));
  const matchingSectionIds = new Set(matchingSections.map((section) => String(section.id)));

  if (editorial.sectionId && (
    String(editorial.sectionId) === String(article.sectionId || '')
    || matchingSectionIds.has(String(editorial.sectionId))
  )) {
    return true;
  }

  if ((editorial.highlights || []).some((highlight) => (
    (articleId && String(highlight.articleId || '') === articleId)
    || (articleNumber && normalizeLegalSearchText(highlight.articleNumber) === articleNumber)
  ))) {
    return true;
  }

  const rangeOrdinals = extractArticleOrdinals(editorial.rangeLabel);
  if (articleOrdinal && rangeOrdinals.length > 0) {
    const fromOrdinal = rangeOrdinals[0];
    const toOrdinal = rangeOrdinals.length > 1 ? rangeOrdinals[rangeOrdinals.length - 1] : fromOrdinal;
    if (articleOrdinal >= Math.min(fromOrdinal, toOrdinal) && articleOrdinal <= Math.max(fromOrdinal, toOrdinal)) {
      return true;
    }
  }

  const editorialSectionTitle = normalizeLegalSearchText(editorial.sectionTitle);
  return Boolean(editorialSectionTitle && matchingSections.some((section) => (
    getSectionSearchTitles(section).includes(editorialSectionTitle)
  )));
};

const buildSectionEditorialSearchValuesForArticle = (
  law: LawDetail,
  article: LawArticle,
  sections: LawSectionSummary[],
) => (Array.isArray(law.sectionEditorials) ? law.sectionEditorials : [])
  .filter((editorial) => sectionEditorialMatchesArticle(editorial, article, sections))
  .flatMap((editorial) => [
    editorial.sectionTitle,
    editorial.rangeLabel,
    editorial.importance,
    editorial.style,
    editorial.summary,
    editorial.examFocusText,
    ...(editorial.examFocus || []),
    ...(editorial.keywords || []),
    ...(editorial.macetes || []),
    ...(editorial.doctrine || []),
    ...collectLegalSearchValues(editorial.blocks || []),
    ...collectLegalSearchValues(editorial.highlights || []),
    ...collectLegalSearchValues(editorial.jurisprudence || []),
    ...collectLegalSearchValues(editorial.sumulas || []),
  ]);

const resolveArticleExamTips = (law: LawDetail, article: LawArticle): ArticleExamTip[] => (
  Array.isArray(law.examTips)
    ? law.examTips.filter((tip) => String(tip.articleId || '') === String(article.id))
    : []
);

const resolveArticleUserCommentsForSearch = (
  law: LawDetail,
  article: LawArticle,
  userId?: string | null,
): LegalUserComment[] => (
  Array.isArray(law.userComments)
    ? law.userComments.filter((comment) => (
      String(comment.articleId) === String(article.id)
      && comment.status !== 'deleted'
      && (comment.status !== 'hidden' || (comment.moderationStatus === 'pending' && String(comment.userId) === String(userId || '')))
      && comment.moderationStatus !== 'spam'
    ))
    : []
);

const buildArticleSearchHaystack = (
  law: LawDetail,
  article: LawArticle,
  sections: LawSectionSummary[],
  userId?: string | null,
) => normalizeLegalSearchText([
  article.number,
  article.numero,
  article.title,
  article.titulo,
  article.text,
  article.texto,
  article.examTip,
  article.macete,
  ...getArticleTextLines(article),
  ...buildArticleBlocks(article).flatMap((block) => [block.kind, block.label, block.text]),
  ...collectLegalSearchValues(article.paragraphs || []),
  ...collectLegalSearchValues(article.paragrafos || []),
  ...collectLegalSearchValues(article.syllabi || []),
  ...collectLegalSearchValues(article.sumulas || []),
  ...collectLegalSearchValues(article.doctrine || []),
  ...collectLegalSearchValues(article.doutrina || []),
  ...collectLegalSearchValues(article.jurisprudenceNotes || []),
  ...collectLegalSearchValues(resolveArticleTeacherComments(law, article)),
  ...collectLegalSearchValues(resolveArticleJurisprudence(law, article)),
  ...collectLegalSearchValues(resolveArticleExamTips(law, article)),
  ...collectLegalSearchValues(resolveArticleUserCommentsForSearch(law, article, userId)),
  ...buildSectionEditorialSearchValuesForArticle(law, article, sections),
].join(' '));

const getBlockReferenceTokens = (block: RenderableBlock) => {
  const label = normalizeReferenceText(block.label);
  const text = normalizeReferenceText(block.text);
  const tokens = new Set<string>();

  if (block.isCaput || block.kind === 'caput' || block.kind === 'fallback') {
    tokens.add('caput');
  }

  if (block.kind === 'paragraph') {
    tokens.add(label);
    if (label.includes('unico') || text.includes('paragrafo unico')) {
      tokens.add('paragrafo unico');
    }
    const paragraphNumber = label.match(/\d+/)?.[0];
    if (paragraphNumber) {
      tokens.add(`paragrafo ${paragraphNumber}`);
      tokens.add(`paragraph ${paragraphNumber}`);
    }
  }

  if (block.kind === 'inciso') {
    const roman = label.match(/\b[ivxlcdm]+\b/i)?.[0]?.toLowerCase();
    if (roman) {
      tokens.add(`inciso ${roman}`);
    }
  }

  if (block.kind === 'alinea') {
    const letter = label.match(/\b[a-z]\b/i)?.[0]?.toLowerCase();
    if (letter) {
      tokens.add(`alinea ${letter}`);
    }
  }

  if (block.kind === 'item' && label) {
    tokens.add(`item ${label}`);
  }

  return Array.from(tokens).filter(Boolean);
};

const scoreBlockForNote = (block: RenderableBlock, noteText: string) => {
  const referenceText = normalizeReferenceText(noteText);
  const referenceTokens = getBlockReferenceTokens(block);
  const explicitMatchScore = referenceTokens.reduce((score, token) => (
    token && referenceText.includes(token) ? score + 80 : score
  ), 0);

  const blockTokens = new Set(getSignificantTokens(`${block.label} ${block.text}`));
  const noteTokens = getSignificantTokens(noteText);
  const semanticScore = noteTokens.reduce((score, token) => (
    blockTokens.has(token) ? score + 6 : score
  ), 0);

  return explicitMatchScore + semanticScore + (block.isCaput ? 1 : 0);
};

const resolveNoteBlockId = (blocks: RenderableBlock[], note: InlineLegalNote) => {
  if (blocks.length === 0) {
    return '';
  }

  if (note.targetBlockId) {
    const directMatch = blocks.find((block) => block.sourceId === note.targetBlockId || block.id === note.targetBlockId);
    if (directMatch) {
      return directMatch.id;
    }
  }

  const noteText = `${note.title} ${note.body} ${note.referenceText}`;
  const rankedBlocks = blocks
    .map((block) => ({
      block,
      score: scoreBlockForNote(block, noteText),
    }))
    .sort((a, b) => b.score - a.score);

  if (rankedBlocks[0]?.score > 1) {
    return rankedBlocks[0].block.id;
  }

  return blocks.find((block) => block.isCaput)?.id || blocks[0].id;
};

const formatLegalTargetReference = (target?: LegalRichContentBlock['target']) => {
  if (!target) return '';
  return [target.kind, target.label, target.blockId].filter(Boolean).join(' ');
};

const getTargetedTextBody = (item: string | LegalTargetedText) => (
  typeof item === 'string'
    ? item
    : String(item.body || item.text || '').trim()
);

const getTargetedTextTarget = (item: string | LegalTargetedText) => (
  typeof item === 'string' ? undefined : item.target
);

const groupInlineNotesByBlock = (blocks: RenderableBlock[], notes: InlineLegalNote[]) => {
  const grouped = new Map<string, InlineLegalNote[]>();

  notes.forEach((note) => {
    if (!note.body) return;
    const blockId = resolveNoteBlockId(blocks, note);
    if (!blockId) return;
    grouped.set(blockId, [...(grouped.get(blockId) || []), note]);
  });

  return grouped;
};

const buildInlineLegalNotes = ({
  article,
  teacherComments,
  doctrine,
  jurisprudenceNotes,
  jurisprudence,
  sumulas,
  examTips,
  fallbackExamTip,
}: {
  article: LawArticle;
  teacherComments: TeacherComment[];
  doctrine: Array<string | LegalTargetedText>;
  jurisprudenceNotes: Array<string | LegalTargetedText>;
  jurisprudence: ArticleJurisprudence[];
  sumulas: NonNullable<LawArticle['sumulas']>;
  examTips: ArticleExamTip[];
  fallbackExamTip: string;
}): InlineLegalNote[] => {
  const articleNumber = getArticleNumber(article);
  const resolvedExamTips = examTips.length > 0
    ? examTips
    : (fallbackExamTip ? [{
      id: `tip-${article.id}-${articleNumber || 'article'}`,
      articleId: article.id,
      title: 'Macete',
      body: fallbackExamTip,
      tags: [],
    }] : []);

  return [
    ...teacherComments.map((comment) => ({
      id: `teacher-${comment.id}`,
      tone: 'teacher' as const,
      title: comment.title || 'Comentário do professor',
      body: String(comment.body || comment.texto || '').trim(),
      reactionKey: comment.reactionKey || `inline-note:teacher-${comment.id}`,
      likes: Number(comment.likes || 0),
      dislikes: Number(comment.dislikes || 0),
      userReaction: comment.userReaction,
      referenceText: [
        comment.title,
        comment.body,
        comment.texto,
        ...(Array.isArray(comment.richBlocks) ? comment.richBlocks.map((block) => `${block.target?.kind || ''} ${block.target?.label || ''} ${block.title || ''} ${block.content || ''}`) : []),
        ...(Array.isArray(comment.blocks) ? comment.blocks.map((block) => `${block.target?.kind || ''} ${block.target?.label || ''} ${block.title || ''} ${block.content || ''}`) : []),
        ...(Array.isArray(comment.relatedRefs) ? comment.relatedRefs : []),
      ].join(' '),
      blocks: Array.isArray(comment.richBlocks) && comment.richBlocks.length > 0
        ? comment.richBlocks
        : (Array.isArray(comment.blocks) ? comment.blocks : []),
      targetBlockId: (Array.isArray(comment.richBlocks) ? comment.richBlocks : comment.blocks || [])
        .map((block) => block.target?.blockId)
        .find(Boolean),
    })),
    ...doctrine.map((text, index) => ({
      id: `doctrine-${article.id}-${index}`,
      tone: 'doctrine' as const,
      title: 'Doutrina',
      body: getTargetedTextBody(text),
      referenceText: [formatLegalTargetReference(getTargetedTextTarget(text)), getTargetedTextBody(text)].join(' '),
      targetBlockId: getTargetedTextTarget(text)?.blockId,
    })),
    ...jurisprudenceNotes.map((text, index) => ({
      id: `juris-note-${article.id}-${index}`,
      tone: 'juris' as const,
      title: 'Jurisprudência',
      body: getTargetedTextBody(text),
      referenceText: [formatLegalTargetReference(getTargetedTextTarget(text)), getTargetedTextBody(text)].join(' '),
      targetBlockId: getTargetedTextTarget(text)?.blockId,
    })),
    ...jurisprudence.map((entry, index) => ({
      id: `juris-${entry.id || `${article.id}-${index}`}`,
      tone: 'juris' as const,
      title: entry.title ? `Jurisprudência: ${entry.title}` : 'Jurisprudência',
      body: String(entry.summary || entry.texto || entry.examImpact || '').trim(),
      reactionKey: entry.reactionKey || (entry.id ? `inline-note:juris-${entry.id}` : `inline-note:juris-${article.id}-${index}`),
      likes: Number(entry.likes || 0),
      dislikes: Number(entry.dislikes || 0),
      userReaction: entry.userReaction,
      referenceText: [formatLegalTargetReference(entry.target), entry.title, entry.summary, entry.texto, entry.examImpact, entry.court, entry.precedentType].join(' '),
      targetBlockId: entry.target?.blockId,
    })),
    ...sumulas.map((sumula, index) => ({
      id: `sumula-${sumula.id || `${article.id}-${index}`}`,
      tone: 'juris' as const,
      title: sumula.number ? `Súmula ${sumula.number}` : 'Súmula',
      body: String(sumula.text || sumula.texto || '').trim(),
      reactionKey: sumula.reactionKey || (sumula.id ? `inline-note:sumula-${sumula.id}` : `inline-note:sumula-${article.id}-${index}`),
      likes: Number(sumula.likes || 0),
      dislikes: Number(sumula.dislikes || 0),
      userReaction: sumula.userReaction,
      referenceText: [formatLegalTargetReference(sumula.target), sumula.number, sumula.numero, sumula.text, sumula.texto, sumula.court, sumula.tribunal].join(' '),
      targetBlockId: sumula.target?.blockId,
    })),
    ...resolvedExamTips.map((tip, index) => ({
      id: `tip-${tip.id || `${article.id}-${index}`}`,
      tone: 'tip' as const,
      title: tip.title || 'Macete',
      body: String(tip.body || tip.texto || '').trim(),
      reactionKey: tip.reactionKey || (tip.id ? `inline-note:tip-${tip.id}` : `inline-note:tip-${article.id}-${index}`),
      likes: Number(tip.likes || 0),
      dislikes: Number(tip.dislikes || 0),
      userReaction: tip.userReaction,
      referenceText: [formatLegalTargetReference(tip.target), tip.body, tip.texto, ...(Array.isArray(tip.tags) ? tip.tags : [])].join(' '),
      targetBlockId: tip.target?.blockId,
    })),
  ].filter((note) => note.body);
};

const SpinnerBlock: React.FC<{ label: string }> = ({ label }) => (
  <div className="flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-5 text-sm font-bold text-slate-500 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300">
    <Loader2 size={16} className="animate-spin text-[#615fff]" />
    <span>{label}</span>
  </div>
);

const LegalCommentaryDetailSkeleton: React.FC = () => {
  const skeletonLine = (className: string) => (
    <div className={`animate-pulse rounded-full bg-slate-200 dark:bg-slate-800 ${className}`} />
  );

  return (
    <div className="space-y-4 pb-10" aria-busy="true" aria-label="Carregando lei comentada">
      <section className={`${PLATFORM_SURFACE_CARD_CLASS} p-5`}>
        <div className="flex flex-wrap items-center gap-2">
          {skeletonLine('h-3 w-28')}
          {skeletonLine('h-3 w-4')}
          {skeletonLine('h-3 w-40')}
          {skeletonLine('h-3 w-4')}
          {skeletonLine('h-3 w-24')}
        </div>

        <div className="mt-4 flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0 flex-1">
            {skeletonLine('h-8 w-72 max-w-full')}
            {skeletonLine('mt-3 h-4 w-52 max-w-full')}
          </div>
          <div className="flex flex-wrap gap-2">
            {[0, 1, 2, 3, 4].map((item) => (
              <div
                key={`legal-skeleton-action-${item}`}
                className="h-9 w-32 animate-pulse rounded-xl border border-slate-200 bg-slate-100 dark:border-slate-700 dark:bg-slate-800"
              />
            ))}
          </div>
        </div>

        <div className="mt-5 max-w-md">
          <div className="mb-2 flex items-center justify-between">
            {skeletonLine('h-3 w-32')}
            {skeletonLine('h-3 w-10')}
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700">
            <div className="h-full w-1/3 animate-pulse rounded-full bg-[#615fff]/70" />
          </div>
        </div>

        <div className="mt-5 grid gap-3 lg:grid-cols-[minmax(0,1fr)_320px]">
          <div className="h-11 animate-pulse rounded-xl border border-slate-200 bg-slate-100 dark:border-slate-700 dark:bg-slate-800" />
          <div className="h-11 animate-pulse rounded-xl border border-slate-200 bg-slate-100 dark:border-slate-700 dark:bg-slate-800" />
        </div>
      </section>

      <section className="space-y-2">
        <div className={`${PLATFORM_SURFACE_CARD_CLASS} flex flex-wrap items-center gap-2 px-3 py-2`}>
          {[0, 1, 2, 3, 4, 5, 6].map((item) => (
            <div
              key={`legal-skeleton-toolbar-${item}`}
              className="h-9 w-24 animate-pulse rounded-lg border border-slate-200 bg-slate-100 dark:border-slate-700 dark:bg-slate-800"
            />
          ))}
        </div>
        <div className={`${PLATFORM_SURFACE_CARD_CLASS} flex flex-wrap items-center justify-between gap-2 px-3 py-2`}>
          <div className="flex flex-wrap gap-2">
            {[0, 1, 2, 3, 4].map((item) => (
              <div
                key={`legal-skeleton-editor-${item}`}
                className="h-9 w-10 animate-pulse rounded-lg border border-slate-200 bg-slate-100 dark:border-slate-700 dark:bg-slate-800"
              />
            ))}
          </div>
          <div className="h-9 w-28 animate-pulse rounded-lg bg-slate-900 dark:bg-slate-100" />
        </div>
      </section>

      <section className={`${PLATFORM_SURFACE_CARD_CLASS} overflow-hidden`}>
        <div className="border-b border-slate-200 px-5 py-3 dark:border-slate-700">
          {skeletonLine('h-3 w-48')}
        </div>
        <div className="bg-slate-100/70 p-4 dark:bg-slate-950/50">
          <div className="mx-auto max-w-[980px] rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-900 md:p-9">
            <header className="mb-8 text-center">
              {skeletonLine('mx-auto h-3 w-40')}
              {skeletonLine('mx-auto mt-3 h-7 w-72 max-w-full')}
            </header>

            <div className="space-y-7">
              {[0, 1, 2].map((article) => (
                <article key={`legal-skeleton-article-${article}`} className="space-y-4">
                  <div className="flex items-start justify-between gap-4">
                    {skeletonLine('h-7 w-20')}
                    <div className="h-7 w-7 animate-pulse rounded-full bg-indigo-100 dark:bg-indigo-500/20" />
                  </div>
                  <div className="space-y-3">
                    {skeletonLine('h-4 w-full')}
                    {skeletonLine('h-4 w-[92%]')}
                    {skeletonLine('h-4 w-[78%]')}
                  </div>
                  <div className="ml-6 space-y-3">
                    {skeletonLine('h-4 w-[86%]')}
                    {skeletonLine('h-4 w-[70%]')}
                  </div>
                  <div className="rounded-xl border border-amber-200 bg-amber-50/70 p-4 dark:border-amber-500/30 dark:bg-amber-500/10">
                    {skeletonLine('h-3 w-24')}
                    {skeletonLine('mt-3 h-4 w-[82%]')}
                  </div>
                </article>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className={`${PLATFORM_SURFACE_CARD_CLASS} grid gap-3 px-4 py-3 lg:grid-cols-[auto_minmax(0,1fr)_auto] lg:items-center`}>
        <div className="flex flex-wrap gap-2">
          {skeletonLine('h-9 w-36 rounded-lg')}
          {skeletonLine('h-9 w-32 rounded-lg')}
        </div>
        <div className="grid grid-cols-2 gap-1 rounded-xl border border-slate-200 bg-slate-50 p-1 dark:border-slate-700 dark:bg-slate-900 sm:grid-cols-4">
          {[0, 1, 2, 3].map((item) => (
            <div key={`legal-skeleton-tab-${item}`} className="h-9 animate-pulse rounded-lg bg-slate-200 dark:bg-slate-800" />
          ))}
        </div>
        {skeletonLine('h-9 w-36 rounded-lg')}
      </section>
    </div>
  );
};

const LegalFeatureFallbackPanel: React.FC<{
  title: string;
  description: string;
  requiredPlan: string;
  mode: LegalCommentaryFeatureFallbackMode | 'full';
  previewItems?: string[];
}> = ({ title, description, requiredPlan, mode, previewItems = [] }) => {
  if (mode === 'full') {
    return null;
  }

  return (
    <div className="rounded-xl border border-amber-200 bg-amber-50/75 p-5 text-amber-950 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-100">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="inline-flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.16em] text-amber-700 dark:text-amber-200">
            <Crown size={14} />
            {requiredPlan}
          </p>
          <h3 className="mt-2 text-lg font-black text-slate-900 dark:text-slate-50">{title}</h3>
          <p className="mt-2 max-w-2xl text-sm font-semibold leading-6 text-amber-900/85 dark:text-amber-50/85">
            {description}
          </p>
          {previewItems.length > 0 ? (
            <div className="mt-3 flex flex-wrap gap-2">
              {previewItems.slice(0, 4).map((item) => (
                <span
                  key={item}
                  className="inline-flex rounded-full border border-amber-200 bg-white/70 px-3 py-1 text-[10px] font-black uppercase tracking-[0.12em] text-amber-800 dark:border-amber-400/20 dark:bg-slate-950/25 dark:text-amber-100"
                >
                  {item}
                </span>
              ))}
            </div>
          ) : null}
        </div>
        <Link
          href="/plans"
          className="inline-flex h-10 shrink-0 items-center justify-center rounded-xl bg-[#615fff] px-4 text-xs font-black uppercase tracking-[0.12em] text-white transition-colors hover:bg-[#514dff]"
        >
          Ver planos
        </Link>
      </div>
    </div>
  );
};

const ToolbarButton: React.FC<{
  icon: React.ReactNode;
  label: string;
  onClick?: () => void;
  active?: boolean;
  disabled?: boolean;
}> = ({ icon, label, onClick, active, disabled }) => (
  <button
    type="button"
    onClick={onClick}
    disabled={disabled}
    className={`inline-flex h-8 shrink-0 items-center gap-1.5 rounded-lg border px-2 text-xs font-bold transition-colors sm:h-9 sm:px-3 ${
      active
        ? 'border-[#615fff]/35 bg-[#615fff]/10 text-[#514dff]'
        : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200'
    }`}
  >
    {icon}
    <span className="hidden sm:inline">{label}</span>
  </button>
);

const ReaderEditorButton: React.FC<{
  label: string;
  icon: React.ReactNode;
  onPress: () => void;
  disabled?: boolean;
  active?: boolean;
}> = ({ label, icon, onPress, disabled, active }) => (
  <button
    type="button"
    title={label}
    aria-label={label}
    aria-pressed={Boolean(active)}
    disabled={disabled}
    onMouseDown={(event) => {
      event.preventDefault();
      if (!disabled) {
        onPress();
      }
    }}
    onKeyDown={(event) => {
      if (event.key !== 'Enter' && event.key !== ' ') {
        return;
      }
      event.preventDefault();
      if (!disabled) {
        onPress();
      }
    }}
    className={`grid h-8 min-w-8 shrink-0 place-items-center rounded-lg border px-2 text-xs font-black transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#615fff]/45 disabled:cursor-not-allowed disabled:opacity-50 sm:h-9 sm:min-w-9 ${
      active
        ? 'border-[#615fff] bg-[#615fff] text-white shadow-sm shadow-[#615fff]/25'
        : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800'
    }`}
  >
    {icon}
  </button>
);

const ReaderColorButton: React.FC<{
  label: string;
  color: string;
  onPress: () => void;
  active?: boolean;
}> = ({ label, color, onPress, active }) => (
  <button
    type="button"
    title={label}
    aria-label={label}
    aria-pressed={Boolean(active)}
    onMouseDown={(event) => {
      event.preventDefault();
      onPress();
    }}
    onKeyDown={(event) => {
      if (event.key !== 'Enter' && event.key !== ' ') {
        return;
      }
      event.preventDefault();
      onPress();
    }}
    className={`grid h-7 w-7 shrink-0 place-items-center rounded-lg border bg-white transition-transform hover:scale-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#615fff]/45 dark:bg-slate-900 sm:h-8 sm:w-8 ${
      active ? 'border-[#615fff] shadow-sm shadow-[#615fff]/25 ring-2 ring-[#615fff]/35' : 'border-slate-200 dark:border-slate-700'
    }`}
  >
    <span className="h-3.5 w-3.5 rounded-full border border-slate-200 sm:h-4 sm:w-4" style={{ backgroundColor: color }} />
  </button>
);

const getLegalCommentAvatarUrl = (comment: LegalUserComment) => {
  const rawAvatar = String(comment.userAvatar || comment.userPhotoUrl || comment.photoUrl || comment.avatarUrl || '').trim();
  return getAssetUrl(rawAvatar)
    || rawAvatar
    || `https://ui-avatars.com/api/?name=${encodeURIComponent(comment.userName || 'Aluno')}&background=615fff&color=fff&size=64`;
};

const LegalCommentPlanBadge: React.FC<{ plan?: string }> = ({ plan }) => {
  switch (plan) {
    case 'Elite':
      return <Crown size={12} className="fill-amber-500 text-amber-500" aria-label="Plano Elite" />;
    case 'Pro':
      return <Zap size={12} className="fill-indigo-500 text-indigo-500" aria-label="Plano Pro" />;
    case 'Essencial':
      return <Star size={12} className="fill-blue-500 text-blue-500" aria-label="Plano Essencial" />;
    default:
      return null;
  }
};

const LegalCommentAuthorRoleBadge: React.FC<{ role?: string | null }> = ({ role }) => {
  const normalizedRole = String(role || '').toLowerCase();
  if (normalizedRole !== 'admin' && normalizedRole !== 'staff') {
    return null;
  }

  const isAdmin = normalizedRole === 'admin';
  return (
    <span
      className={`rounded-full px-2 py-0.5 text-[8px] font-black uppercase tracking-[0.12em] ${
        isAdmin
          ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-950'
          : 'bg-blue-50 text-blue-700 ring-1 ring-blue-100 dark:bg-blue-500/10 dark:text-blue-200 dark:ring-blue-400/20'
      }`}
    >
      {isAdmin ? 'Admin' : 'Staff'}
    </span>
  );
};

const legalReactionInFlightKeys = new Set<string>();

const ReactionControls: React.FC<{
  storageKey: string;
  initialLikes?: number;
  initialDislikes?: number;
  initialReaction?: 'like' | 'dislike' | null;
}> = ({ storageKey, initialLikes = 0, initialDislikes = 0, initialReaction }) => {
  const [reaction, setReaction] = React.useState<'like' | 'dislike' | null>(null);
  const [counts, setCounts] = React.useState(() => ({
    likes: Math.max(0, Number(initialLikes || 0)),
    dislikes: Math.max(0, Number(initialDislikes || 0)),
  }));
  const [isSavingReaction, setIsSavingReaction] = React.useState(false);
  const reactionRequestInFlightRef = React.useRef(false);

  React.useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    const frameId = window.requestAnimationFrame(() => {
      const storedReaction = window.localStorage.getItem(`cm:legal-reaction:${storageKey}`);
      setCounts({
        likes: Math.max(0, Number(initialLikes || 0)),
        dislikes: Math.max(0, Number(initialDislikes || 0)),
      });
      if (typeof initialReaction !== 'undefined') {
        setReaction(initialReaction === 'like' || initialReaction === 'dislike' ? initialReaction : null);
        return;
      }
      setReaction(storedReaction === 'like' || storedReaction === 'dislike' ? storedReaction : null);
    });

    return () => window.cancelAnimationFrame(frameId);
  }, [initialDislikes, initialLikes, initialReaction, storageKey]);

  const updateReaction = (nextReaction: 'like' | 'dislike') => {
    if (reactionRequestInFlightRef.current || legalReactionInFlightKeys.has(storageKey)) {
      return;
    }

    const previousReaction = reaction;
    const previousCounts = counts;
    const resolvedReaction = previousReaction === nextReaction ? null : nextReaction;
    const optimisticCounts = {
      likes: Math.max(0, previousCounts.likes - (previousReaction === 'like' ? 1 : 0) + (resolvedReaction === 'like' ? 1 : 0)),
      dislikes: Math.max(0, previousCounts.dislikes - (previousReaction === 'dislike' ? 1 : 0) + (resolvedReaction === 'dislike' ? 1 : 0)),
    };
    const storageReactionKey = `cm:legal-reaction:${storageKey}`;

    reactionRequestInFlightRef.current = true;
    legalReactionInFlightKeys.add(storageKey);
    setIsSavingReaction(true);
    setReaction(resolvedReaction);
    setCounts(optimisticCounts);
    if (typeof window !== 'undefined') {
      if (resolvedReaction) {
        window.localStorage.setItem(storageReactionKey, resolvedReaction);
      } else {
        window.localStorage.removeItem(storageReactionKey);
      }
    }

    void Promise.resolve()
      .then(() => legalCommentaryApiService.setContentReaction(storageKey, resolvedReaction))
      .then((result) => {
        const persistedReaction = result.userReaction === 'like' || result.userReaction === 'dislike'
          ? result.userReaction
          : null;
        setCounts({
          likes: Math.max(0, Number(result.likes || 0)),
          dislikes: Math.max(0, Number(result.dislikes || 0)),
        });
        setReaction(persistedReaction);
        if (typeof window !== 'undefined') {
          if (persistedReaction) {
            window.localStorage.setItem(storageReactionKey, persistedReaction);
          } else {
            window.localStorage.removeItem(storageReactionKey);
          }
        }
      })
      .catch(() => {
        setCounts(previousCounts);
        setReaction(previousReaction);
        if (typeof window !== 'undefined') {
          if (previousReaction) {
            window.localStorage.setItem(storageReactionKey, previousReaction);
          } else {
            window.localStorage.removeItem(storageReactionKey);
          }
        }
      })
      .finally(() => {
        reactionRequestInFlightRef.current = false;
        legalReactionInFlightKeys.delete(storageKey);
        setIsSavingReaction(false);
      });
  };

  return (
    <div className="flex items-center gap-1.5">
      <button
        type="button"
        onClick={(event) => {
          event.preventDefault();
          event.stopPropagation();
          updateReaction('like');
        }}
        disabled={isSavingReaction}
        className={`inline-flex h-7 items-center gap-1 rounded-lg border px-2 text-[10px] font-black transition-colors ${
          reaction === 'like'
            ? 'border-emerald-200 bg-emerald-50 text-emerald-600 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-300'
            : 'border-slate-200 bg-white/70 text-slate-500 hover:border-emerald-200 hover:text-emerald-600 dark:border-slate-700 dark:bg-slate-900/40 dark:text-slate-300'
        } disabled:cursor-wait disabled:opacity-70`}
        aria-label="Curtir"
      >
        <ThumbsUp size={12} />
        {counts.likes}
      </button>
      <button
        type="button"
        onClick={(event) => {
          event.preventDefault();
          event.stopPropagation();
          updateReaction('dislike');
        }}
        disabled={isSavingReaction}
        className={`inline-flex h-7 items-center gap-1 rounded-lg border px-2 text-[10px] font-black transition-colors ${
          reaction === 'dislike'
            ? 'border-red-200 bg-red-50 text-red-600 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-300'
            : 'border-slate-200 bg-white/70 text-slate-500 hover:border-red-200 hover:text-red-600 dark:border-slate-700 dark:bg-slate-900/40 dark:text-slate-300'
        } disabled:cursor-wait disabled:opacity-70`}
        aria-label="Não curtir"
      >
        <ThumbsDown size={12} />
        {counts.dislikes}
      </button>
    </div>
  );
};

const RelatedQuestionPreviewCard: React.FC<{ question: Question; index: number }> = ({ question, index }) => {
  const subjectNames = (question.assuntos || [])
    .filter((item) => item?.materia)
    .map((item) => String(item.nome || item.name || '').trim())
    .filter(Boolean);
  const topicNames = (question.assuntos || [])
    .filter((item) => !item?.materia)
    .map((item) => String(item.nome || item.name || '').trim())
    .filter(Boolean);
  const questionId = String(question.id || question.hashId || question.hash || '');

  return (
    <article className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition-colors dark:border-slate-700 dark:bg-slate-900">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[10px] font-black uppercase tracking-[0.16em] text-[#615fff]">
            Questão {index + 1}
          </p>
          <h3 className="mt-2 text-sm font-black leading-6 text-slate-900 dark:text-slate-100">
            {truncateText(question.enunciado_clean || question.enunciado, 260)}
          </h3>
        </div>
        <Link
          href={questionId ? `/practice?questionId=${encodeURIComponent(questionId)}` : '/practice'}
          className="inline-flex h-9 shrink-0 items-center justify-center rounded-lg bg-slate-900 px-3 text-xs font-black text-white transition-colors hover:bg-[#615fff] dark:bg-slate-100 dark:text-slate-950"
        >
          Resolver
        </Link>
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        {[...subjectNames.slice(0, 1), ...topicNames.slice(0, 3)].map((label) => (
          <span
            key={label}
            className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[10px] font-bold text-slate-500 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-300"
          >
            {label}
          </span>
        ))}
      </div>
    </article>
  );
};

const LegalCommentsPanel: React.FC<{
  comments: LegalUserComment[];
  value: string;
  disabled: boolean;
  isSubmitting: boolean;
  onChange: (value: string) => void;
  onSubmit: () => void;
  onReport: (commentId: string) => void;
  onDelete: (commentId: string) => void;
  currentUserId: string;
}> = ({
  comments,
  value,
  disabled,
  isSubmitting,
  onChange,
  onSubmit,
  onReport,
  onDelete,
  currentUserId,
}) => (
  <section className={`${PLATFORM_SURFACE_CARD_CLASS} p-5`}>
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div>
        <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#615fff]">Comentários</p>
        <h2 className="mt-1 text-lg font-black text-slate-900 dark:text-slate-100">Discussão da seção</h2>
      </div>
      <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-black text-slate-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300">
        {comments.length} {comments.length === 1 ? 'comentário' : 'comentários'}
      </span>
    </div>

    <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-950/60">
      <RichTextEditor
        initialValue={value}
        onChange={onChange}
        disabled={disabled || isSubmitting}
        placeholder={disabled ? 'Entre na sua conta para comentar.' : 'Escreva um comentário sobre esta seção...'}
      />
      <div className="mt-3 flex justify-end">
        <button
          type="button"
          onClick={onSubmit}
          disabled={disabled || isSubmitting || !stripRichText(value)}
          className="inline-flex h-9 items-center gap-2 rounded-lg bg-[#615fff] px-4 text-xs font-black text-white transition-colors hover:bg-[#514dff] disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isSubmitting ? <Loader2 size={14} className="animate-spin" /> : <MessageSquare size={14} />}
          Comentar
        </button>
      </div>
    </div>

    <div className="mt-5 space-y-4">
      {comments.length ? comments.map((comment) => (
        <article
          key={comment.id}
          id={`legal-comment-${comment.id}`}
          className="rounded-xl border border-slate-100 bg-white p-4 shadow-sm transition-all dark:border-slate-700 dark:bg-slate-800"
        >
          <div className="flex items-start justify-between gap-3 text-[10px]">
            <div className="flex min-w-0 items-center gap-2">
              <Image
                src={getLegalCommentAvatarUrl(comment)}
                alt={comment.userName || 'Aluno'}
                width={28}
                height={28}
                unoptimized
                className="h-7 w-7 shrink-0 rounded-full border border-slate-200 object-cover dark:border-slate-700"
              />
              <div className="min-w-0">
                <div className="flex min-w-0 items-center gap-1.5">
                  <span className="truncate font-bold text-slate-700 dark:text-slate-200">{comment.userName || 'Aluno'}</span>
                  <LegalCommentAuthorRoleBadge role={comment.userRole} />
                  <LegalCommentPlanBadge plan={comment.userPlan} />
                </div>
                <span className="text-[9px] font-semibold text-slate-400 dark:text-slate-500">{formatDateTime(comment.createdAt)}</span>
              </div>
            </div>
            {comment.moderationStatus === 'pending' ? (
              <span className="shrink-0 rounded bg-amber-50 px-2 py-0.5 text-[8px] font-black uppercase text-amber-700 dark:bg-amber-500/10 dark:text-amber-200">
                Pendente
              </span>
            ) : null}
          </div>

          <MathRichText content={normalizeQuestionRichHtml(comment.body)} className="mt-3 text-xs font-medium leading-relaxed text-slate-600 dark:text-slate-300" />

          <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
            <ReactionControls
              storageKey={`comment:${comment.id}`}
              initialLikes={Number(comment.likes || 0)}
              initialDislikes={Number(comment.dislikes || 0)}
              initialReaction={comment.userReaction}
            />
            <div className="flex items-center gap-3">
            {comment.userId !== currentUserId ? (
              <button
                type="button"
                onClick={() => onReport(comment.id)}
                className="flex items-center gap-1 text-[10px] font-bold text-slate-400 transition-all hover:text-red-500 dark:text-slate-500 dark:hover:text-red-400"
              >
                <Flag size={11} />
                Reportar
              </button>
            ) : (
              <button
                type="button"
                onClick={() => onDelete(comment.id)}
                className="flex items-center gap-1 text-[10px] font-bold text-slate-400 transition-all hover:text-red-600 dark:text-slate-500 dark:hover:text-red-500"
              >
                <Trash2 size={11} />
                Deletar
              </button>
            )}
            </div>
          </div>
        </article>
      )) : (
        <div className="rounded-xl border border-dashed border-slate-200 bg-white px-4 py-8 text-center dark:border-slate-700 dark:bg-slate-900">
          <MessageSquare size={26} className="mx-auto text-slate-300 dark:text-slate-600" />
          <p className="mt-3 text-sm font-bold text-slate-500 dark:text-slate-300">Ainda não há comentários nesta seção.</p>
        </div>
      )}
    </div>
  </section>
);

const RichLegalContentBlocks: React.FC<{ blocks?: LegalRichContentBlock[] }> = ({ blocks }) => {
  const visibleBlocks = (blocks || []).filter((block) => (
    String(block.content || '').trim()
    || (Array.isArray(block.items) && block.items.length > 0)
    || (Array.isArray(block.rows) && block.rows.length > 0)
  ));

  if (visibleBlocks.length === 0) {
    return null;
  }

  const getBlockSurfaceClass = (type: LegalRichContentBlock['type']) => {
    const classes: Record<LegalRichContentBlock['type'], string> = {
      paragraph: 'border-slate-200 bg-white text-slate-700 dark:border-slate-700 dark:bg-slate-900/85 dark:text-slate-200',
      bullet_list: 'border-slate-200 bg-white text-slate-700 dark:border-slate-700 dark:bg-slate-900/85 dark:text-slate-200',
      table: 'border-slate-200 bg-white text-slate-700 dark:border-slate-700 dark:bg-slate-900/85 dark:text-slate-200',
      summary: 'border-indigo-200 bg-indigo-50/60 text-slate-800 dark:border-indigo-500/30 dark:bg-indigo-500/10 dark:text-indigo-50',
      tip: 'border-emerald-200 bg-emerald-50/65 text-emerald-950 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-50',
      macete: 'border-violet-200 bg-violet-50/65 text-violet-950 dark:border-violet-500/30 dark:bg-violet-500/10 dark:text-violet-50',
      warning: 'border-amber-200 bg-amber-50/70 text-amber-950 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-50',
      jurisprudence: 'border-sky-200 bg-sky-50/65 text-sky-950 dark:border-sky-500/30 dark:bg-sky-500/10 dark:text-sky-50',
      example: 'border-fuchsia-200 bg-fuchsia-50/65 text-fuchsia-950 dark:border-fuchsia-500/30 dark:bg-fuchsia-500/10 dark:text-fuchsia-50',
      comparison: 'border-slate-200 bg-slate-50 text-slate-800 dark:border-slate-700 dark:bg-slate-900/85 dark:text-slate-100',
    };

    return classes[type] || classes.paragraph;
  };

  return (
    <div className="mt-3 space-y-4">
      {visibleBlocks.map((block, index) => {
        const title = cleanLegalNoteTitle(block.title);
        const content = cleanLegalNoteText(block.content);
        const items = (block.items || []).map(cleanLegalNoteText).filter(Boolean);
        const headers = (block.headers || []).map((item) => String(item || '').trim()).filter(Boolean);
        const rows = (block.rows || [])
          .filter((row) => Array.isArray(row) && row.some((cell) => String(cell || '').trim()))
          .map((row) => row.map(cleanLegalNoteText));
        const surfaceClass = getBlockSurfaceClass(block.type);

        if (block.type === 'table' && rows.length > 0) {
          return (
            <div key={`${block.type}-${index}`} className={`overflow-hidden rounded-xl border shadow-sm ${surfaceClass}`}>
              {title ? <p className="border-b border-current/10 px-4 py-3 text-[11px] font-black uppercase tracking-[0.12em]">{title}</p> : null}
              <table className="w-full border-collapse text-left text-sm">
                {headers.length > 0 ? (
                  <thead className="bg-white/55 dark:bg-slate-950/25">
                    <tr>
                      {headers.map((header, headerIndex) => (
                        <th key={`${header}-${headerIndex}`} className="border-t border-current/10 px-4 py-3 text-xs font-black uppercase tracking-[0.08em]">
                          {header}
                        </th>
                      ))}
                    </tr>
                  </thead>
                ) : null}
                <tbody>
                  {rows.map((row, rowIndex) => (
                    <tr key={`row-${rowIndex}`}>
                      {row.map((cell, cellIndex) => (
                        <td key={`cell-${cellIndex}`} className="border-t border-current/10 px-4 py-3 align-top">
                          <MathRichText content={String(cell || '')} className="text-sm font-medium leading-6" />
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          );
        }

        return (
          <div key={`${block.type}-${index}`} className={`rounded-xl border px-4 py-3 shadow-sm ${surfaceClass}`}>
            {title ? <p className="text-[11px] font-black uppercase tracking-[0.14em] opacity-80">{title}</p> : null}
            {content ? (
              <MathRichText
                content={content}
                className="mt-2 text-sm font-medium leading-7 [&_mark]:rounded [&_mark]:bg-yellow-200/80 [&_mark]:px-1 [&_strong]:font-black"
              />
            ) : null}
            {items.length > 0 ? (
              <ul className="mt-3 list-disc space-y-2 pl-5 text-sm font-medium leading-7">
                {items.map((item, itemIndex) => (
                  <li key={`${item}-${itemIndex}`}>
                    <MathRichText content={item} className="text-sm font-medium leading-7 [&_mark]:rounded [&_mark]:bg-yellow-200/80 [&_mark]:px-1 [&_strong]:font-black" />
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        );
      })}
    </div>
  );
};

const InlineLegalContentBlocks: React.FC<{ blocks?: LegalRichContentBlock[] }> = ({ blocks }) => {
  const visibleBlocks = (blocks || []).filter((block) => (
    String(block.content || '').trim()
    || (Array.isArray(block.items) && block.items.length > 0)
    || (Array.isArray(block.rows) && block.rows.length > 0)
  ));

  if (visibleBlocks.length === 0) {
    return null;
  }

  return (
    <div className="mt-2 space-y-3">
      {visibleBlocks.map((block, index) => {
        const title = cleanLegalNoteTitle(block.title);
        const content = cleanLegalNoteText(block.content);
        const items = (block.items || []).map(cleanLegalNoteText).filter(Boolean);
        const headers = (block.headers || []).map((item) => String(item || '').trim()).filter(Boolean);
        const rows = (block.rows || [])
          .filter((row) => Array.isArray(row) && row.some((cell) => String(cell || '').trim()))
          .map((row) => row.map(cleanLegalNoteText));

        if (block.type === 'table' && rows.length > 0) {
          return (
            <div key={`${block.type}-${index}`} className="overflow-x-auto">
              {title ? <p className="mb-2 text-[10px] font-black uppercase tracking-[0.12em] opacity-80">{title}</p> : null}
              <table className="w-full min-w-[420px] border-collapse overflow-hidden rounded-lg text-left text-xs">
                {headers.length > 0 ? (
                  <thead>
                    <tr>
                      {headers.map((header, headerIndex) => (
                        <th key={`${header}-${headerIndex}`} className="border border-current/15 bg-white/40 px-3 py-2 font-black uppercase tracking-[0.08em] dark:bg-slate-950/20">
                          {header}
                        </th>
                      ))}
                    </tr>
                  </thead>
                ) : null}
                <tbody>
                  {rows.map((row, rowIndex) => (
                    <tr key={`inline-row-${rowIndex}`}>
                      {row.map((cell, cellIndex) => (
                        <td key={`inline-cell-${cellIndex}`} className="border border-current/15 bg-white/25 px-3 py-2 align-top dark:bg-slate-950/10">
                          <MathRichText content={String(cell || '')} className="text-xs font-semibold leading-5" />
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          );
        }

        return (
          <div key={`${block.type}-${index}`}>
            {title ? <p className="text-[10px] font-black uppercase tracking-[0.12em] opacity-80">{title}</p> : null}
            {content ? (
              <MathRichText
                content={content}
                className="mt-1 text-sm font-semibold leading-6 [&_mark]:rounded [&_mark]:bg-yellow-200/80 [&_mark]:px-1 [&_strong]:font-black"
              />
            ) : null}
            {items.length > 0 ? (
              <ul className="mt-2 list-disc space-y-1.5 pl-5 text-sm font-semibold leading-6">
                {items.map((item, itemIndex) => (
                  <li key={`${item}-${itemIndex}`}>
                    <MathRichText content={item} className="text-sm font-semibold leading-6 [&_mark]:rounded [&_mark]:bg-yellow-200/80 [&_mark]:px-1 [&_strong]:font-black" />
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        );
      })}
    </div>
  );
};

const CalloutBlock: React.FC<{
  tone: CalloutTone;
  title: string;
  body: string;
  blocks?: LegalRichContentBlock[];
  actionLabel?: string;
  isLocked?: boolean;
  lockedFeatureLabel?: string;
  lockedRequiredPlan?: string;
  reactionKey?: string;
  initialLikes?: number;
  initialDislikes?: number;
  initialReaction?: 'like' | 'dislike' | null;
  hideReaction?: boolean;
}> = ({
  tone,
  title,
  body,
  blocks,
  actionLabel,
  isLocked,
  lockedFeatureLabel,
  lockedRequiredPlan,
  reactionKey,
  initialLikes = 0,
  initialDislikes = 0,
  initialReaction,
  hideReaction,
}) => {
  const toneClass: Record<CalloutTone, string> = {
    teacher: 'border-indigo-200 bg-indigo-50/75 text-indigo-900 dark:border-indigo-500/30 dark:bg-indigo-500/10 dark:text-indigo-100',
    doctrine: 'border-amber-200 bg-amber-50/75 text-amber-900 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-100',
    juris: 'border-sky-200 bg-sky-50/75 text-sky-900 dark:border-sky-500/30 dark:bg-sky-500/10 dark:text-sky-100',
    tip: 'border-emerald-200 bg-emerald-50/75 text-emerald-900 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-100',
    question: 'border-fuchsia-200 bg-fuchsia-50/75 text-fuchsia-900 dark:border-fuchsia-500/30 dark:bg-fuchsia-500/10 dark:text-fuchsia-100',
  };
  const cleanTitle = cleanLegalNoteTitle(title);
  const cleanBody = cleanLegalNoteText(body);
  const hasRichBlocks = (blocks || []).some((block) => (
    String(block.content || '').trim()
    || (Array.isArray(block.items) && block.items.length > 0)
    || (Array.isArray(block.rows) && block.rows.length > 0)
  ));
  const shouldFlattenBlocks = tone === 'teacher' || tone === 'tip';
  const titleKey = normalizeText(cleanTitle);
  const icon = titleKey.includes('sumula')
    ? <Scale size={14} aria-hidden="true" />
    : ({
      teacher: <MessageSquare size={14} aria-hidden="true" />,
      doctrine: <BookOpen size={14} aria-hidden="true" />,
      juris: <Scale size={14} aria-hidden="true" />,
      tip: <Lightbulb size={14} aria-hidden="true" />,
      question: <FileText size={14} aria-hidden="true" />,
    } satisfies Record<CalloutTone, React.ReactNode>)[tone];
  const unlockLabel = lockedRequiredPlan || actionLabel || 'Plano superior';
  const lockedCtaLabel = unlockLabel.toLowerCase().startsWith('plano')
    ? `Disponivel no ${unlockLabel}`
    : unlockLabel;
  const contentNode = hasRichBlocks && shouldFlattenBlocks ? (
    <InlineLegalContentBlocks blocks={blocks} />
  ) : hasRichBlocks ? (
    <RichLegalContentBlocks blocks={blocks} />
  ) : cleanBody ? (
    <MathRichText content={cleanBody} className="mt-2 text-sm font-semibold leading-6" />
  ) : null;

  return (
    <aside className={`ml-4 rounded-xl border px-4 py-3 ${isLocked ? 'py-3' : ''} ${toneClass[tone]}`}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="inline-flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.14em]">
          {icon}
          <span>{cleanTitle}</span>
        </p>
        {actionLabel && !isLocked ? (
          <span className="text-xs font-bold">{actionLabel} <ArrowRight size={12} className="inline-block" /></span>
        ) : null}
      </div>
      {isLocked ? (
        <div className="relative mt-2 max-h-[118px] min-h-[82px] overflow-hidden rounded-xl border border-white/40 bg-white/20 dark:border-white/10 dark:bg-slate-950/10">
          <div className="pointer-events-none select-none blur-[3px] opacity-60">
            {contentNode || (
              <MathRichText
                content={`${lockedFeatureLabel || cleanTitle} disponivel para assinantes.`}
                className="p-3 text-xs font-semibold leading-5"
              />
            )}
          </div>
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-white/72 px-3 py-3 text-center backdrop-blur-[1px] dark:bg-slate-950/72">
            <p className="text-[10px] font-black uppercase tracking-[0.16em] opacity-80">
              {lockedFeatureLabel || cleanTitle}
            </p>
            <Link
              href="/plans"
              className="inline-flex min-h-9 items-center justify-center rounded-xl bg-[#615fff] px-4 text-[11px] font-black uppercase tracking-[0.12em] text-white shadow-sm transition-colors hover:bg-[#514dff]"
            >
              {lockedCtaLabel}
            </Link>
          </div>
        </div>
      ) : contentNode}
      {!hideReaction && !isLocked ? (
      <div className="mt-3 flex justify-end">
        <ReactionControls
          storageKey={reactionKey || `callout:${normalizeStorageKeyPart(cleanTitle)}:${normalizeStorageKeyPart(cleanBody).slice(0, 48)}`}
          initialLikes={initialLikes}
          initialDislikes={initialDislikes}
          initialReaction={initialReaction}
        />
      </div>
      ) : null}
    </aside>
  );
};

const LawDetailPage: React.FC = () => {
  const params = useParams<{ slug: string }>();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { currentUser, updateUser } = useAuth();
  const { addToast } = useToast();
  const systemSettings = useAppConfigStore((state) => state.systemSettings);
  const readerEditorRef = React.useRef<HTMLDivElement>(null);
  const readingContentSectionRef = React.useRef<HTMLElement>(null);
  const commentsContentSectionRef = React.useRef<HTMLDivElement>(null);
  const analysisContentSectionRef = React.useRef<HTMLElement>(null);
  const questionsContentSectionRef = React.useRef<HTMLElement>(null);
  const pendingTabScrollRef = React.useRef<ReadingTab | null>(null);
  const readerToolbarAnchorRef = React.useRef<HTMLDivElement>(null);
  const readerToolbarRef = React.useRef<HTMLElement>(null);
  const progressCompletionInFlightRef = React.useRef(false);

  const slug = String(params?.slug || '').trim();
  const userId = React.useMemo(() => String(getUserId((currentUser as CurrentUserLike) || null) || ''), [currentUser]);
  const legalFeatureConfig = React.useMemo(
    () => normalizeLegalCommentaryFeatureConfig(
      systemSettings.legalCommentaryFeatureConfig || DEFAULT_LEGAL_COMMENTARY_FEATURE_CONFIG,
    ),
    [systemSettings.legalCommentaryFeatureConfig],
  );
  const canAccessLegalModule = hasPlanBenefit(currentUser, 'module.lei_comentada', systemSettings.planEntitlements);
  const canAccessLegalFeature = React.useCallback((featureKey: LegalCommentaryFeatureKey) => {
    if (featureKey === 'lei.texto') {
      return true;
    }

    return hasPlanBenefit(currentUser, featureKey as PlanBenefitKey, systemSettings.planEntitlements);
  }, [currentUser, systemSettings.planEntitlements]);
  const getLegalFeatureFallbackMode = React.useCallback((featureKey: LegalCommentaryFeatureKey) => {
    if (canAccessLegalFeature(featureKey)) {
      return 'full' as const;
    }

    if (!isConfigurableLegalFeatureKey(featureKey)) {
      return 'locked' as const;
    }

    return legalFeatureConfig[featureKey]?.fallbackMode || 'locked';
  }, [canAccessLegalFeature, legalFeatureConfig]);
  const getLegalFeatureRequiredPlanLabel = React.useCallback(
    (featureKey: LegalCommentaryFeatureKey) => getBenefitPlanLabel(featureKey as PlanBenefitKey, systemSettings.planEntitlements),
    [systemSettings.planEntitlements],
  );
  const openLegalFeatureUpgradeModal = React.useCallback((featureKey: LegalCommentaryFeatureKey, featureName: string) => {
    setLegalFeatureUpgradeModal({
      featureName,
      requiredPlan: getBenefitRequiredPlan(featureKey as PlanBenefitKey, systemSettings.planEntitlements) as CanonicalPlanName,
    });
  }, [systemSettings.planEntitlements]);
  const applyInlineLegalNoteAccess = React.useCallback((note: InlineLegalNote): InlineLegalNote | null => {
    const featureKey = resolveInlineLegalNoteFeatureKey(note);
    const mode = getLegalFeatureFallbackMode(featureKey);

    if (mode === 'full') {
      return note;
    }

    const requiredPlan = getLegalFeatureRequiredPlanLabel(featureKey);
    const featureLabel = LEGAL_COMMENTARY_FEATURE_LABELS[featureKey] || note.title || 'Recurso';

    return {
      ...note,
      id: `${note.id}-locked-${mode}`,
      actionLabel: requiredPlan,
      lockedFeatureLabel: featureLabel,
      lockedRequiredPlan: requiredPlan,
      likes: 0,
      dislikes: 0,
      userReaction: null,
      reactionKey: undefined,
      isLocked: true,
    };
  }, [getLegalFeatureFallbackMode, getLegalFeatureRequiredPlanLabel]);
  const applyUserProgressMutation = React.useCallback((progress?: { newXp?: number; newLevel?: number }) => {
    if (!progress || (progress.newXp === undefined && progress.newLevel === undefined)) {
      return;
    }

    void updateUser({
      ...(progress.newXp !== undefined ? { xp: progress.newXp } : {}),
      ...(progress.newLevel !== undefined ? { level: progress.newLevel } : {}),
    });
  }, [updateUser]);

  const sectionFrom = String(searchParams.get('from') || '').trim();
  const sectionTo = String(searchParams.get('to') || '').trim();
  const sectionQueryId = String(searchParams.get('sectionId') || searchParams.get('section') || '').trim();
  const requestedLawId = String(searchParams.get('lawId') || '').trim();

  const [law, setLaw] = React.useState<LawDetail | null>(null);
  const [isLoading, setIsLoading] = React.useState(true);
  const [loadError, setLoadError] = React.useState('');
  const [searchTerm, setSearchTerm] = React.useState('');
  const [fontScale, setFontScale] = React.useState(100);
  const [activeTab, setActiveTab] = React.useState<ReadingTab>('law');
  const [isSummaryOpen, setIsSummaryOpen] = React.useState(false);
  const [isFocusMode, setIsFocusMode] = React.useState(false);
  const [showLegalTextNotes, setShowLegalTextNotes] = React.useState(false);
  const [showEditorialAnnotations, setShowEditorialAnnotations] = React.useState(true);
  const [isScrollToolbarHidden, setIsScrollToolbarHidden] = React.useState(false);
  const [isTogglingFavorite, setIsTogglingFavorite] = React.useState(false);
  const [isDeepAnalysisOpen, setIsDeepAnalysisOpen] = React.useState(true);
  const [favoriteSectionIds, setFavoriteSectionIds] = React.useState<Set<string>>(() => new Set());
  const [sectionReadingState, setSectionReadingState] = React.useState<SectionReadingState>({});
  const [isReportingSection, setIsReportingSection] = React.useState(false);
  const [sectionReportModalOpen, setSectionReportModalOpen] = React.useState(false);
  const [sectionSupportActionMode, setSectionSupportActionMode] = React.useState<SectionSupportActionMode>('report');
  const [sectionReportTitle, setSectionReportTitle] = React.useState('Problema nesta seção');
  const [sectionReportReason, setSectionReportReason] = React.useState('Erro no texto da lei');
  const [sectionReportDetails, setSectionReportDetails] = React.useState('');
  const [sectionSupportTargetId, setSectionSupportTargetId] = React.useState('section');
  const [commentBody, setCommentBody] = React.useState('');
  const [isSubmittingComment, setIsSubmittingComment] = React.useState(false);
  const [requestedTeacherCommentKeys, setRequestedTeacherCommentKeys] = React.useState<Set<string>>(() => new Set());
  const [savedReaderMarkupHtml, setSavedReaderMarkupHtml] = React.useState('');
  const [readerMarkupVersion, setReaderMarkupVersion] = React.useState(0);
  const [readerActiveCommands, setReaderActiveCommands] = React.useState({
    bold: false,
    italic: false,
    underline: false,
  });
  const [readerSaveUpgradeOpen, setReaderSaveUpgradeOpen] = React.useState(false);
  const [legalFeatureUpgradeModal, setLegalFeatureUpgradeModal] = React.useState<{
    featureName: string;
    requiredPlan: CanonicalPlanName;
  } | null>(null);
  const [readerActiveTextColor, setReaderActiveTextColor] = React.useState('');
  const [readerActiveHighlightColor, setReaderActiveHighlightColor] = React.useState('');
  const [readerFloatingToolbar, setReaderFloatingToolbar] = React.useState<{
    active: boolean;
    left: number;
    width: number;
    height: number;
  } | null>(null);
  const [relatedQuestionsState, setRelatedQuestionsState] = React.useState<RelatedQuestionsState>({
    status: 'idle',
    rows: [],
    total: 0,
  });

  const scrollToTabContent = React.useCallback((tab: ReadingTab) => {
    if (typeof window === 'undefined') {
      return;
    }

    const target = tab === 'comments'
      ? commentsContentSectionRef.current
      : tab === 'analysis'
        ? analysisContentSectionRef.current
        : tab === 'questions'
          ? questionsContentSectionRef.current
          : readingContentSectionRef.current;

    if (!target) {
      return;
    }

    const top = target.getBoundingClientRect().top + window.scrollY - 96;
    window.scrollTo({ top: Math.max(0, top), behavior: 'smooth' });
  }, []);

  const handleBottomTabChange = React.useCallback((tab: ReadingTab) => {
    if (tab === activeTab) {
      scrollToTabContent(tab);
      return;
    }

    pendingTabScrollRef.current = tab;
    setActiveTab(tab);
  }, [activeTab, scrollToTabContent]);

  React.useEffect(() => {
    const tab = pendingTabScrollRef.current;
    if (!tab || tab !== activeTab || typeof window === 'undefined') {
      return undefined;
    }

    pendingTabScrollRef.current = null;
    const frameId = window.requestAnimationFrame(() => scrollToTabContent(tab));
    return () => window.cancelAnimationFrame(frameId);
  }, [activeTab, scrollToTabContent]);

  const loadLaw = React.useCallback(async (options?: { force?: boolean }) => {
    const identifiers = Array.from(new Set(
      [slug, requestedLawId]
        .map((value) => String(value || '').trim())
        .filter(Boolean),
    ));

    if (identifiers.length === 0) {
      setLaw(null);
      setIsLoading(false);
      setLoadError('Lei não encontrada.');
      return;
    }

    setIsLoading(true);
    setLoadError('');
    try {
      let detail: LawDetail | null = null;

      for (const identifier of identifiers) {
        try {
          detail = await legalCommentaryApiService.getLawDetail(identifier, options);
        } catch (error) {
          if (identifier === identifiers[identifiers.length - 1]) {
            throw error;
          }
        }

        if (detail) {
          break;
        }
      }

      setLaw(detail);
      if (!detail) {
        setLoadError('Lei não encontrada.');
      }
    } catch {
      setLaw(null);
      setLoadError('Não foi possível carregar esta lei agora.');
    } finally {
      setIsLoading(false);
    }
  }, [requestedLawId, slug]);

  React.useEffect(() => {
    let active = true;

    const run = async () => {
      if (!active) return;
      await loadLaw();
    };

    void run();
    return () => {
      active = false;
    };
  }, [loadLaw]);

  React.useEffect(() => {
    if (!law || !userId) return;
    void legalCommentaryApiService.recordLawView(law.id);
  }, [law, userId]);

  React.useEffect(() => {
    if (typeof document === 'undefined') return undefined;

    if (isFocusMode) {
      document.body.dataset.legalReadingFocus = 'true';
    } else {
      delete document.body.dataset.legalReadingFocus;
    }

    return () => {
      delete document.body.dataset.legalReadingFocus;
    };
  }, [isFocusMode]);

  React.useEffect(() => {
    if (typeof window === 'undefined') {
      return undefined;
    }

    let frameId = 0;
    const updateToolbarPosition = () => {
      window.cancelAnimationFrame(frameId);
      frameId = window.requestAnimationFrame(() => {
        const anchor = readerToolbarAnchorRef.current;
        const toolbar = readerToolbarRef.current;
        if (!anchor || !toolbar) {
          setReaderFloatingToolbar(null);
          return;
        }

        const anchorRect = anchor.getBoundingClientRect();
        const toolbarHeight = toolbar.offsetHeight || anchorRect.height;
        const shouldFloat = anchorRect.top <= FLOATING_READER_TOOLBAR_TOP_OFFSET;

        if (!shouldFloat) {
          setReaderFloatingToolbar(null);
          return;
        }

        setReaderFloatingToolbar((current) => {
          const next = {
            active: true,
            left: anchorRect.left,
            width: anchorRect.width,
            height: toolbarHeight,
          };

          if (
            current?.active
            && Math.abs(current.left - next.left) < 0.5
            && Math.abs(current.width - next.width) < 0.5
            && Math.abs(current.height - next.height) < 0.5
          ) {
            return current;
          }

          return next;
        });
      });
    };

    updateToolbarPosition();
    window.addEventListener('scroll', updateToolbarPosition, true);
    window.addEventListener('resize', updateToolbarPosition);
    return () => {
      window.cancelAnimationFrame(frameId);
      window.removeEventListener('scroll', updateToolbarPosition, true);
      window.removeEventListener('resize', updateToolbarPosition);
    };
  }, []);

  const sections = React.useMemo(() => {
    if (!law) return [];
    const articlesBySection = new Map<string, LawArticle[]>();
    (law.articles || []).forEach((article) => {
      const sectionId = String(article.sectionId || '');
      if (!sectionId) return;
      const collection = articlesBySection.get(sectionId) || [];
      collection.push(article);
      articlesBySection.set(sectionId, collection);
    });

    const lawSections = Array.isArray(law.sections) ? law.sections : [];
    if (lawSections.length === 0 && Array.isArray(law.articles) && law.articles.length > 0) {
      const firstArticle = law.articles[0];
      const lastArticle = law.articles[law.articles.length - 1];
      const articleIds = law.articles.map((article) => String(article.id));

      return [{
        id: `law-${law.id}-all`,
        lawId: String(law.id),
        title: 'Capitulo unico',
        displayTitle: 'Capitulo unico',
        sectionSlug: `law-${law.id}-all`,
        fromArticle: String(firstArticle.number || firstArticle.numero || ''),
        toArticle: String(lastArticle.number || lastArticle.numero || ''),
        articles: law.articles.length,
        primaryArticleId: articleIds[0] || '',
        articleIds,
        articleCount: law.articles.length,
      }];
    }

    return lawSections.map((section): LawSectionSummary => {
      const sectionArticles = articlesBySection.get(String(section.id)) || [];
      const articleIds = sectionArticles.map((article) => String(article.id));
      return {
        ...section,
        id: String(section.id),
        lawId: String(section.lawId || law.id),
        title: String(section.displayTitle || section.title || 'Capitulo da lei'),
        displayTitle: String(section.displayTitle || section.title || 'Capitulo da lei'),
        sectionSlug: String(section.slug || section.id),
        fromArticle: String(section.fromArticle || sectionArticles[0]?.number || ''),
        toArticle: String(section.toArticle || sectionArticles[sectionArticles.length - 1]?.number || ''),
        articles: Number(section.articleCount || sectionArticles.length),
        primaryArticleId: articleIds[0] || '',
        articleIds,
        articleCount: Number(section.articleCount || sectionArticles.length),
      };
    });
  }, [law]);

  const activeSection = React.useMemo<LawSectionSummary | null>(() => {
    if (!law || sections.length === 0) return null;

    if (sectionQueryId) {
      const byId = sections.find((section) => String(section.id) === sectionQueryId || String(section.sectionSlug || '') === sectionQueryId);
      if (byId) return byId;
    }

    if (sectionFrom || sectionTo) {
      const byRange = sections.find((section) => (
        (!sectionFrom || normalizeText(section.fromArticle) === normalizeText(sectionFrom))
        && (!sectionTo || normalizeText(section.toArticle) === normalizeText(sectionTo))
      ));
      if (byRange) return byRange;
    }

    return sections[0] || null;
  }, [law, sectionFrom, sectionQueryId, sectionTo, sections]);

  const readerMarkupKey = React.useMemo(() => (
    law && activeSection
      ? getReaderMarkupStorageKey(userId || 'guest', law.id, activeSection.id)
      : ''
  ), [activeSection, law, userId]);

  React.useEffect(() => {
    if (typeof window === 'undefined') return undefined;

    const frame = window.requestAnimationFrame(() => {
      setSavedReaderMarkupHtml(readerMarkupKey ? readReaderMarkupHtml(readerMarkupKey) : '');
      setReaderMarkupVersion((current) => current + 1);
    });

    return () => window.cancelAnimationFrame(frame);
  }, [readerMarkupKey]);

  const sanitizedHtml = React.useMemo(
    () => (savedReaderMarkupHtml ? normalizeQuestionRichHtml(savedReaderMarkupHtml) : ''),
    [savedReaderMarkupHtml],
  );
  const normalizedSearchTerm = React.useMemo(() => normalizeLegalSearchText(searchTerm), [searchTerm]);
  const isSearchingLegalContent = Boolean(normalizedSearchTerm);
  const shouldRenderSavedReaderMarkup = Boolean(
    getLegalFeatureFallbackMode('lei.anotacoes') === 'full'
    && sanitizedHtml
    && !isSearchingLegalContent,
  );

  const activeSectionArticles = React.useMemo(() => {
    if (!law || !activeSection) return [];

    const sectionArticleIds = activeSection.articleIds?.length
      ? new Set(activeSection.articleIds.map((id) => String(id)))
      : null;

    return law.articles.filter((article) => {
      if (sectionArticleIds) {
        return sectionArticleIds.has(String(article.id));
      }

      return String(article.sectionId || '') === String(activeSection.id);
    });
  }, [activeSection, law]);

  const activeSectionArticleIds = React.useMemo(
    () => new Set(activeSectionArticles.map((article) => String(article.id))),
    [activeSectionArticles],
  );
  const activeSectionReadingKey = activeSection ? buildSectionReadingKey(activeSection) : '';

  const backendViewedArticleIds = React.useMemo(
    () => new Set((law?.progress?.viewedArticleIds || []).map((id) => String(id))),
    [law?.progress?.viewedArticleIds],
  );
  const backendProgressPercent = Number(law?.progress?.progressPercent || law?.progressPercent || 0);

  const completedArticleIds = React.useMemo(() => {
    const articleIds = new Set(backendViewedArticleIds);

    sections.forEach((section) => {
      const sectionArticleIds = getSectionArticleIds(section);
      const readingEntry = getSectionReadingEntry(sectionReadingState, section);

      if (isSectionReadingRestartPending(readingEntry)) {
        sectionArticleIds.forEach((articleId) => articleIds.delete(articleId));
        return;
      }

      if (!readingEntry?.completedAt) {
        return;
      }

      sectionArticleIds.forEach((articleId) => articleIds.add(articleId));
    });

    return articleIds;
  }, [backendViewedArticleIds, sectionReadingState, sections]);

  const completedSectionKeys = React.useMemo(() => new Set(sections
    .filter((section) => {
      const readingEntry = getSectionReadingEntry(sectionReadingState, section);

      if (isSectionReadingRestartPending(readingEntry)) {
        return false;
      }

      if (readingEntry?.completedAt) {
        return true;
      }

      const articleIds = getSectionArticleIds(section);
      return articleIds.length > 0 && articleIds.every((id) => completedArticleIds.has(id));
    })
    .map((section) => buildSectionReadingKey(section))), [completedArticleIds, sectionReadingState, sections]);

  const hasRestartedSectionReading = React.useMemo(
    () => sections.some((section) => isSectionReadingRestartPending(getSectionReadingEntry(sectionReadingState, section))),
    [sectionReadingState, sections],
  );

  const articleProgressPercent = React.useMemo(() => {
    const expectedArticleCount = Number(law?.articleCount || law?.totalArtigos || 0);
    const loadedArticleCount = Array.isArray(law?.articles) ? law.articles.length : 0;
    const totalArticles = expectedArticleCount > 0 ? expectedArticleCount : loadedArticleCount;
    if (totalArticles <= 0) {
      return null;
    }

    const completedArticles = Math.min(completedArticleIds.size, totalArticles);
    const localProgressPercent = Math.round((completedArticles / totalArticles) * 100);

    if (hasRestartedSectionReading || completedArticleIds.size > 0 || backendViewedArticleIds.size > 0) {
      return localProgressPercent;
    }

    return backendProgressPercent;
  }, [backendProgressPercent, backendViewedArticleIds.size, completedArticleIds, hasRestartedSectionReading, law]);

  const sectionProgressPercent = sections.length > 0
    ? Math.round((completedSectionKeys.size / sections.length) * 100)
    : 0;
  const activeSectionReading = activeSection ? getSectionReadingEntry(sectionReadingState, activeSection) : undefined;
  const isActiveSectionFavorite = Boolean(activeSection && favoriteSectionIds.has(activeSection.id));
  const isActiveSectionCompleted = Boolean(activeSectionReadingKey && completedSectionKeys.has(activeSectionReadingKey));
  const activeSectionActionLabel = isActiveSectionCompleted
    ? 'Ler novamente'
    : activeSectionReading?.startedAt
      ? 'Marcar como lido'
      : 'Começar leitura';

  const sectionUserComments = React.useMemo(() => {
    if (!law || activeSectionArticleIds.size === 0) return [];

    return (Array.isArray(law.userComments) ? law.userComments : [])
      .filter((comment) => {
        const rawArticleId = String(comment.articleId || '').trim();
        const rawSectionId = String(
          (comment as Partial<LegalUserComment> & { sectionId?: string | number; section_id?: string | number }).sectionId
          || (comment as Partial<LegalUserComment> & { sectionId?: string | number; section_id?: string | number }).section_id
          || '',
        ).trim();
        const belongsToActiveArticle = rawArticleId !== '' && activeSectionArticleIds.has(rawArticleId);
        const belongsToActiveSection = rawSectionId !== '' && activeSection && rawSectionId === String(activeSection.id);
        const isSectionWideComment = rawArticleId === '' && rawSectionId === '' && activeSection;

        return (
          (belongsToActiveArticle || belongsToActiveSection || isSectionWideComment)
          && comment.status !== 'deleted'
          && (comment.status !== 'hidden' || (comment.moderationStatus === 'pending' && String(comment.userId) === userId))
          && comment.moderationStatus !== 'spam'
        );
      })
      .sort((left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime());
  }, [activeSection, activeSectionArticleIds, law, userId]);

  const relatedQuestionScope = React.useMemo(() => {
    if (!law) {
      return { subject: '', topics: [] as string[] };
    }

    const topics = Array.from(new Set([
      activeSection?.title,
      ...activeSectionArticles.flatMap(getArticleTaxonomyNames),
    ]
      .map((item) => String(item || '').trim())
      .filter(Boolean)));

    return {
      subject: String(law.area?.name || '').trim(),
      topics,
    };
  }, [activeSection?.title, activeSectionArticles, law]);
  const analysisFeatureMode = getLegalFeatureFallbackMode('lei.raiox');
  const questionsFeatureMode = getLegalFeatureFallbackMode('lei.questoes');
  const annotationsFeatureMode = getLegalFeatureFallbackMode('lei.anotacoes');
  const focusFeatureMode = getLegalFeatureFallbackMode('lei.modo_foco');
  const favoritesFeatureMode = getLegalFeatureFallbackMode('lei.favoritos');
  const teacherRequestFeatureMode = getLegalFeatureFallbackMode('lei.solicitar_comentario');
  const canViewDeepAnalysis = analysisFeatureMode === 'full';
  const canViewRelatedQuestions = questionsFeatureMode === 'full';
  const canUseReaderAnnotations = annotationsFeatureMode === 'full';
  const canUseFocusMode = focusFeatureMode === 'full';
  const canUseLegalFavorites = favoritesFeatureMode === 'full';
  const canRequestTeacherComment = teacherRequestFeatureMode === 'full';
  const currentAccessPlanName = getAccessPlanName(currentUser);
  const commentsPerDayLimit = getPlanUsageLimitForPlanName(
    currentAccessPlanName,
    'comments_per_day',
    systemSettings.planUsageLimits,
  );
  const commentsPerDayUnlimited = isPlanUsageUnlimitedForPlanName(
    currentAccessPlanName,
    'comments_per_day',
    systemSettings.planUsageLimits,
  );
  const legalFavoritesLimit = getPlanUsageLimitForPlanName(
    currentAccessPlanName,
    'lei_favorites_limit',
    systemSettings.planUsageLimits,
  );
  const legalFavoritesUnlimited = isPlanUsageUnlimitedForPlanName(
    currentAccessPlanName,
    'lei_favorites_limit',
    systemSettings.planUsageLimits,
  );
  const legalRelatedQuestionsLimit = getPlanUsageLimitForPlanName(
    currentAccessPlanName,
    'lei_related_questions_limit',
    systemSettings.planUsageLimits,
  );
  const legalRelatedQuestionsUnlimited = isPlanUsageUnlimitedForPlanName(
    currentAccessPlanName,
    'lei_related_questions_limit',
    systemSettings.planUsageLimits,
  );
  const relatedQuestionsPageSize = legalRelatedQuestionsUnlimited
    ? 6
    : Math.max(0, Math.min(6, Number(legalRelatedQuestionsLimit || 0)));
  const canLoadRelatedQuestions = canViewRelatedQuestions && (legalRelatedQuestionsUnlimited || relatedQuestionsPageSize > 0);
  const relatedQuestionsFallbackMode = canViewRelatedQuestions && !canLoadRelatedQuestions
    ? 'locked'
    : questionsFeatureMode;
  const readerAnnotationsRequiredPlan = getBenefitRequiredPlan(
    'lei.anotacoes',
    systemSettings.planEntitlements,
  ) as CanonicalPlanName;

  const readingStorageLawId = law ? (requestedLawId || law.id) : '';
  const backendFavoriteSectionIds = React.useMemo(() => new Set((law?.sections || [])
    .filter((section) => section.isFavorite)
    .map((section) => String(section.id))), [law?.sections]);

  React.useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      if (!readingStorageLawId || !userId) {
        setFavoriteSectionIds(new Set());
        setSectionReadingState({});
        setRequestedTeacherCommentKeys(new Set());
        return;
      }

      const nextFavorites = readFavoriteSectionIds(userId, readingStorageLawId);
      backendFavoriteSectionIds.forEach((sectionId) => nextFavorites.add(sectionId));
      setFavoriteSectionIds(nextFavorites);
      saveFavoriteSectionIds(userId, readingStorageLawId, nextFavorites);
      setSectionReadingState(readSectionReadingState(userId, readingStorageLawId));
      setRequestedTeacherCommentKeys(readTeacherCommentRequestKeys(userId, readingStorageLawId));
    });

    return () => window.cancelAnimationFrame(frame);
  }, [backendFavoriteSectionIds, readingStorageLawId, userId]);

  React.useEffect(() => {
    if (activeTab !== 'questions' || !law || !canLoadRelatedQuestions) {
      return;
    }

    let isActive = true;
    const fetchRelatedQuestions = async () => {
      setRelatedQuestionsState((current) => ({ ...current, status: 'loading', error: undefined }));
      try {
        const baseFilters = {
          page: 1,
          limit: relatedQuestionsPageSize,
          excludeCanceled: true,
          subject: relatedQuestionScope.subject || undefined,
        };
        const topicFilter = relatedQuestionScope.topics.slice(0, 4).join(',');
        const firstResult = await questionService.getQuestionPage({
          ...baseFilters,
          topic: topicFilter || undefined,
        });
        const result = firstResult.rows.length > 0 || !topicFilter
          ? firstResult
          : await questionService.getQuestionPage(baseFilters);

        if (!isActive) return;
        setRelatedQuestionsState({
          status: 'ready',
          rows: result.rows,
          total: result.total,
        });
      } catch {
        if (!isActive) return;
        setRelatedQuestionsState({
          status: 'error',
          rows: [],
          total: 0,
          error: 'Não foi possível carregar as questões desta seção agora.',
        });
      }
    };

    void fetchRelatedQuestions();

    return () => {
      isActive = false;
    };
  }, [activeTab, canLoadRelatedQuestions, law, relatedQuestionScope, relatedQuestionsPageSize]);

  const practiceSectionHref = React.useMemo(() => {
    const params = new URLSearchParams();
    params.set('source', 'lei-comentada');

    if (law?.id) {
      params.set('lawId', String(law.id));
    }

    if (activeSection) {
      params.set('sectionId', String(activeSection.id));
      params.set('from', String(activeSection.fromArticle || ''));
      params.set('to', String(activeSection.toArticle || activeSection.fromArticle || ''));
    }

    const questionIds = Array.from(new Set((relatedQuestionsState.rows || [])
      .map((question) => String(question.id || '').trim())
      .filter((id) => /^\d+$/.test(id))));

    if (questionIds.length > 0) {
      params.set('questionIds', questionIds.join(','));
    } else {
      if (relatedQuestionScope.subject) {
        params.set('subject', relatedQuestionScope.subject);
      }
      const topicFilter = relatedQuestionScope.topics.slice(0, 4).join(',');
      if (topicFilter) {
        params.set('topic', topicFilter);
      }
    }

    return `/practice?${params.toString()}`;
  }, [activeSection, law, relatedQuestionScope, relatedQuestionsState.rows]);

  const visibleArticles = React.useMemo(() => {
    if (!law) return [];
    const sourceArticles = normalizedSearchTerm
      ? (Array.isArray(law.articles) ? law.articles : [])
      : activeSectionArticles;

    return sourceArticles.filter((article) => (
      !normalizedSearchTerm || buildArticleSearchHaystack(law, article, sections, userId).includes(normalizedSearchTerm)
    ));
  }, [activeSectionArticles, law, normalizedSearchTerm, sections, userId]);

  const sectionTargetOptions = React.useMemo<SectionTargetOption[]>(() => {
    const sectionLabel = activeSection
      ? (activeSection.fromArticle === activeSection.toArticle
        ? `Artigo ${activeSection.fromArticle}`
        : `Artigos ${activeSection.fromArticle} a ${activeSection.toArticle}`)
      : 'Faixa completa';
    const options: SectionTargetOption[] = [{
      id: 'section',
      label: activeSection ? `Seção inteira - ${sectionLabel}` : 'Seção inteira',
      details: '',
    }];

    visibleArticles.forEach((article) => {
      const articleNumber = getArticleNumber(article) || article.number || '-';
      buildArticleBlocks(article)
        .filter((block) => !block.isLegalNote)
        .forEach((block) => {
          const blockLabel = String(block.label || (block.isCaput ? 'caput' : block.kind) || 'trecho').trim();
          const blockText = stripRichText(block.text || '').slice(0, 900);
          options.push({
            id: `${article.id}:${block.id}`,
            label: `Art. ${articleNumber} - ${blockLabel}`,
            details: [
              `Artigo: Art. ${articleNumber}`,
              `Trecho: ${blockLabel}`,
              '',
              blockText,
            ].filter(Boolean).join('\n'),
          });
        });
    });

    return options;
  }, [activeSection, visibleArticles]);

  const sectionEditorial = React.useMemo<LawSectionEditorial | null>(() => {
    if (!law || !activeSection) {
      return null;
    }

    const currentSectionId = String(activeSection.id || '');
    const currentRangeLabel = activeSection.fromArticle === activeSection.toArticle
      ? `Art. ${activeSection.fromArticle}`
      : `Art. ${activeSection.fromArticle} a Art. ${activeSection.toArticle}`;
    const persistedEditorial = Array.isArray(law.sectionEditorials)
      ? law.sectionEditorials.find((item) => (
        (item.sectionId && String(item.sectionId) === currentSectionId)
        || (
          normalizeText(item.rangeLabel) === normalizeText(currentRangeLabel)
          && normalizeText(item.sectionTitle) === normalizeText(activeSection.title)
        )
      ))
      : null;

    return persistedEditorial || null;
  }, [activeSection, law]);

  const sectionSummary = String(sectionEditorial?.summary || '').trim();
  const sectionExamFocus = React.useMemo(
    () => (sectionEditorial?.examFocus || []).map((item) => String(item || '').trim()).filter(Boolean),
    [sectionEditorial],
  );
  const sectionMacetes = React.useMemo(
    () => (sectionEditorial?.macetes || []).map((item) => String(item || '').trim()).filter(Boolean),
    [sectionEditorial],
  );
  const sectionDoctrine = React.useMemo(
    () => (sectionEditorial?.doctrine || []).map((item) => String(item || '').trim()).filter(Boolean),
    [sectionEditorial],
  );
  const sectionHighlights = React.useMemo(
    () => (sectionEditorial?.highlights || []).filter((item) => (
      String(item.title || '').trim()
      || String(item.excerpt || '').trim()
      || String(item.articleNumber || '').trim()
    )),
    [sectionEditorial],
  );
  const sectionJurisprudence = React.useMemo(
    () => (sectionEditorial?.jurisprudence || []).filter((entry) => (
      String(entry.title || '').trim()
      || String(entry.summary || entry.texto || '').trim()
      || String(entry.court || '').trim()
    )),
    [sectionEditorial],
  );
  const sectionSumulas = React.useMemo(
    () => (sectionEditorial?.sumulas || []).filter((entry) => (
      String(entry.text || entry.texto || '').trim()
      || String(entry.number || '').trim()
      || String(entry.court || '').trim()
    )),
    [sectionEditorial],
  );
  const sectionAnalysisContent = React.useMemo(
    () => buildSingleSectionAnalysisHtml(sectionEditorial),
    [sectionEditorial],
  );
  const showLegacySectionAnalysisDetails = false;
  const hasSectionDeepAnalysis = Boolean(
    sectionAnalysisContent
    || sectionExamFocus.length
    || sectionMacetes.length
    || sectionDoctrine.length
    || sectionHighlights.length
    || sectionJurisprudence.length
    || sectionSumulas.length,
  );
  const progressPercent = articleProgressPercent ?? (sections.length > 0
    ? sectionProgressPercent
    : backendProgressPercent);

  const currentSectionIndex = React.useMemo(() => {
    if (!activeSection) return -1;
    return sections.findIndex((section) => section.id === activeSection.id);
  }, [activeSection, sections]);

  const previousSection = currentSectionIndex > 0 ? sections[currentSectionIndex - 1] : null;
  const nextSection = currentSectionIndex >= 0 && currentSectionIndex < sections.length - 1
    ? sections[currentSectionIndex + 1]
    : null;

  const handleLegalSearchChange = React.useCallback((value: string) => {
    setSearchTerm(value);
    if (value.trim() && activeTab !== 'law') {
      setActiveTab('law');
    }
  }, [activeTab]);

  const changeSection = React.useCallback((sectionId: string) => {
    if (!law) return;
    const section = sections.find((item) => String(item.id) === String(sectionId));
    if (!section) return;

    setSearchTerm('');
    const query = new URLSearchParams(searchParams.toString());
    query.set('lawId', law.id);
    query.set('sectionId', String(section.id));
    query.set('from', section.fromArticle);
    query.set('to', section.toArticle);
    query.set('view', 'pdf');
    query.delete('section');
    query.delete('articleId');
    router.push(`/lei-comentada/${encodeURIComponent(law.slug)}?${query.toString()}`);
  }, [law, router, searchParams, sections]);

  const toggleSectionFavorite = React.useCallback(async () => {
    if (!law || !activeSection || isTogglingFavorite) return;
    if (!userId) {
      addToast('Entre na sua conta para favoritar seções.', 'warning');
      return;
    }
    if (!canUseLegalFavorites) {
      openLegalFeatureUpgradeModal('lei.favoritos', 'favoritar seções da Lei Comentada');
      return;
    }

    setIsTogglingFavorite(true);
    const optimistic = !favoriteSectionIds.has(activeSection.id);
    if (optimistic && !legalFavoritesUnlimited && legalFavoritesLimit !== null && favoriteSectionIds.size >= legalFavoritesLimit) {
      openLegalFeatureUpgradeModal('lei.favoritos', 'mais favoritos na Lei Comentada');
      setIsTogglingFavorite(false);
      return;
    }
    setFavoriteSectionIds((current) => {
      const next = new Set(current);
      if (optimistic) {
        next.add(activeSection.id);
      } else {
        next.delete(activeSection.id);
      }
      saveFavoriteSectionIds(userId, law.id, next);
      return next;
    });

    try {
      const result = await legalCommentaryApiService.toggleFavorite('section', activeSection.id);
      applyUserProgressMutation(result);
      setFavoriteSectionIds((current) => {
        const next = new Set(current);
        if (result.isFavorite) {
          next.add(activeSection.id);
        } else {
          next.delete(activeSection.id);
        }
        saveFavoriteSectionIds(userId, law.id, next);
        return next;
      });
      addToast(
        result.isFavorite && result.xpGain
          ? `Seção adicionada aos favoritos. +${result.xpGain} XP.`
          : result.isFavorite ? 'Seção adicionada aos favoritos.' : 'Seção removida dos favoritos.',
        'success',
      );
    } catch {
      setFavoriteSectionIds((current) => {
        const next = new Set(current);
        if (optimistic) {
          next.delete(activeSection.id);
        } else {
          next.add(activeSection.id);
        }
        saveFavoriteSectionIds(userId, law.id, next);
        return next;
      });
      addToast('Não foi possível atualizar o favorito agora.', 'error');
    } finally {
      setIsTogglingFavorite(false);
    }
  }, [
    activeSection,
    addToast,
    applyUserProgressMutation,
    canUseLegalFavorites,
    favoriteSectionIds,
    isTogglingFavorite,
    law,
    legalFavoritesLimit,
    legalFavoritesUnlimited,
    openLegalFeatureUpgradeModal,
    userId,
  ]);

  const copyLawLink = React.useCallback(async () => {
    if (typeof window === 'undefined') return;
    try {
      await navigator.clipboard.writeText(window.location.href);
      addToast('Link copiado.', 'success');
    } catch {
      addToast('Não foi possível copiar o link.', 'error');
    }
  }, [addToast]);

  const shareLaw = React.useCallback(async () => {
    if (typeof window === 'undefined') return;
    if (navigator.share) {
      try {
        await navigator.share({
          title: law?.shortTitle || law?.title || 'Lei comentada',
          url: window.location.href,
        });
      } catch {
        // cancelado pelo usuario
      }
      return;
    }
    await copyLawLink();
  }, [copyLawLink, law]);

  const openSectionReportModal = React.useCallback(() => {
    setSectionSupportActionMode('report');
    setSectionReportTitle('Problema nesta seção');
    setSectionReportReason('Erro no texto da lei');
    setSectionReportDetails('');
    setSectionSupportTargetId('section');
    setSectionReportModalOpen(true);
  }, []);

  const openTeacherCommentRequestModal = React.useCallback(() => {
    if (!canRequestTeacherComment) {
      openLegalFeatureUpgradeModal('lei.solicitar_comentario', 'solicitar comentário do professor');
      return;
    }

    setSectionSupportActionMode('teacher_request');
    setSectionReportTitle('Solicitar comentário do professor');
    setSectionReportReason('Solicitar comentário do professor');
    setSectionReportDetails('');
    setSectionSupportTargetId('section');
    setSectionReportModalOpen(true);
  }, [canRequestTeacherComment, openLegalFeatureUpgradeModal]);

  const openDetailedAnalysisRequestModal = React.useCallback(() => {
    setSectionSupportActionMode('analysis_request');
    setSectionReportTitle('Solicitar análise detalhada');
    setSectionReportReason('Solicitar análise detalhada');
    setSectionReportDetails('');
    setSectionSupportTargetId('section');
    setSectionReportModalOpen(true);
  }, []);

  const submitSectionReport = React.useCallback(async () => {
    if (!law || !activeSection || isReportingSection) return;
    if (!userId) {
      addToast(
        sectionSupportActionMode === 'report'
          ? 'Entre na sua conta para reportar erro.'
          : 'Entre na sua conta para abrir este chamado.',
        'warning',
      );
      return;
    }

    const details = sectionReportDetails.trim();
    if (sectionSupportActionMode === 'report' && !details) {
      addToast('Descreva rapidamente o erro encontrado.', 'warning');
      return;
    }

    const selectedTarget = sectionTargetOptions.find((item) => item.id === sectionSupportTargetId) || sectionTargetOptions[0];
    const scopedLawId = readingStorageLawId || law.id;
    const actionRequestKey = `${sectionSupportActionMode}:${scopedLawId}:${activeSection.id}:${selectedTarget?.id || 'section'}`;

    if (sectionSupportActionMode !== 'report' && requestedTeacherCommentKeys.has(actionRequestKey)) {
      addToast('Você já abriu uma solicitação para este item.', 'info');
      return;
    }

    setIsReportingSection(true);
    try {
      if (sectionSupportActionMode !== 'report') {
        const result = await supportService.createThread({
          type: 'support',
          reason: sectionReportReason,
          details: [
            `Codigo do pedido: ${actionRequestKey}`,
            `Lei: ${law.title || law.shortTitle || slug}`,
            `Seção: ${activeSection.title} (${activeSection.fromArticle}-${activeSection.toArticle})`,
            selectedTarget && selectedTarget.id !== 'section' ? `Item vinculado: ${selectedTarget.label}` : 'Item vinculado: seção inteira',
            selectedTarget?.details || '',
            details ? `Observações do aluno:\n${details}` : '',
          ].filter(Boolean).join('\n'),
          gamificationEvent: 'support_feedback_submitted',
          notificationEvent: 'support_opened',
        });

        applyUserProgressMutation(result);
        setRequestedTeacherCommentKeys((current) => {
          const next = new Set(current);
          next.add(actionRequestKey);
          saveTeacherCommentRequestKeys(userId, scopedLawId, next);
          return next;
        });
        addToast(
          result.xpGain
            ? `Solicitação enviada ao suporte. +${result.xpGain} XP.`
            : 'Solicitação enviada ao suporte.',
          'success',
        );
        setSectionReportModalOpen(false);
        setSectionReportDetails('');
        return;
      }

      const result = await reportsService.createReport({
        reporterId: userId,
        targetType: 'law_section',
        targetId: selectedTarget?.id && selectedTarget.id !== 'section'
          ? `${activeSection.id}:${selectedTarget.id}`
          : activeSection.id,
        reason: sectionReportReason,
        details: [
          details,
          `Lei: ${law.shortTitle || law.title}`,
          `Seção: ${activeSection.title} (${activeSection.fromArticle}-${activeSection.toArticle})`,
          selectedTarget && selectedTarget.id !== 'section' ? `Item vinculado: ${selectedTarget.label}` : '',
          selectedTarget?.details || '',
        ].join('\n'),
        evidenceUrl: typeof window !== 'undefined' ? window.location.href : undefined,
      });

      if (result.duplicate) {
        addToast(result.message || 'Já existe um reporte pendente para esta seção.', 'warning');
      } else {
        applyUserProgressMutation(result);
        addToast(
          result.xpGain ? `Erro reportado para moderação. +${result.xpGain} XP.` : 'Erro reportado para moderação.',
          'success',
        );
      }
      setSectionReportModalOpen(false);
      setSectionReportDetails('');
    } catch {
      addToast('Não foi possível reportar o erro agora.', 'error');
    } finally {
      setIsReportingSection(false);
    }
  }, [
    activeSection,
    addToast,
    applyUserProgressMutation,
    isReportingSection,
    law,
    readingStorageLawId,
    requestedTeacherCommentKeys,
    sectionReportDetails,
    sectionReportReason,
    sectionSupportActionMode,
    sectionSupportTargetId,
    sectionTargetOptions,
    slug,
    userId,
  ]);

  const openOfficialPdf = React.useCallback(() => {
    if (typeof window === 'undefined') return;
    const officialUrl = String(law?.officialUrl || law?.urlPlanalto || '').trim();
    if (officialUrl) {
      window.open(officialUrl, '_blank', 'noopener,noreferrer');
      return;
    }
    addToast('URL oficial do Planalto não cadastrada para esta lei.', 'info');
  }, [addToast, law]);

  const startSectionReading = React.useCallback(() => {
    if (!activeSection || !activeSectionReadingKey || !readingStorageLawId) return;
    if (!userId) {
      addToast('Entre na sua conta para iniciar a leitura.', 'warning');
      return;
    }

    const startedAt = new Date().toISOString();
    const sectionId = String(activeSection.id || activeSectionReadingKey);

    setSectionReadingState((current) => {
      const currentEntry = getSectionReadingEntry(current, activeSection);
      if (currentEntry?.startedAt && !isSectionReadingRestartPending(currentEntry)) {
        return current;
      }

      const next = {
        ...current,
        [activeSectionReadingKey]: {
          ...current[activeSectionReadingKey],
          startedAt,
          completedAt: undefined,
        },
        [sectionId]: {
          ...current[sectionId],
          startedAt,
          completedAt: undefined,
        },
      };
      saveSectionReadingState(userId, readingStorageLawId, next);
      return next;
    });

    addToast('Leitura iniciada. Quando terminar, marque a seção como lida.', 'success');
  }, [activeSection, activeSectionReadingKey, addToast, readingStorageLawId, userId]);

  const saveReadingProgress = React.useCallback(async (options?: { silent?: boolean }) => {
    if (!law || !activeSection || !activeSectionReadingKey || !readingStorageLawId) return;
    if (!userId) {
      if (!options?.silent) {
        addToast('Entre na sua conta para salvar o progresso.', 'warning');
      }
      return;
    }

    if (progressCompletionInFlightRef.current) {
      return;
    }

    progressCompletionInFlightRef.current = true;

    try {
      const articleIds = activeSectionArticles.map((article) => String(article.id || '')).filter(Boolean);
      const progressResults = [];
      if (articleIds.length > 0) {
        for (const articleId of articleIds) {
          progressResults.push(await legalCommentaryApiService.recordArticleView(law.id, articleId));
        }
      } else {
        progressResults.push(await legalCommentaryApiService.recordLawView(law.id));
      }
      const latestProgress = [...progressResults].reverse().find((progress) => (
        progress.newXp !== undefined || progress.newLevel !== undefined
      ));
      const totalXpGain = progressResults.reduce((total, progress) => total + Number(progress.xpGain || 0), 0);

      if (latestProgress) {
        applyUserProgressMutation(latestProgress);
      }

      setSectionReadingState((current) => {
        const next = {
          ...current,
          [activeSectionReadingKey]: {
            ...current[activeSectionReadingKey],
            startedAt: current[activeSectionReadingKey]?.startedAt || new Date().toISOString(),
            completedAt: new Date().toISOString(),
          },
          [activeSection.id]: {
            ...current[activeSection.id],
            startedAt: current[activeSection.id]?.startedAt || new Date().toISOString(),
            completedAt: new Date().toISOString(),
          },
        };
        saveSectionReadingState(userId, readingStorageLawId, next);
        return next;
      });
      if (!options?.silent) {
        addToast(
          totalXpGain > 0 ? `Seção marcada como lida. +${totalXpGain} XP.` : 'Seção marcada como lida.',
          'success',
        );
      }
    } catch {
      if (!options?.silent) {
        addToast('Não foi possível salvar o progresso agora.', 'error');
      }
    } finally {
      progressCompletionInFlightRef.current = false;
    }
  }, [activeSection, activeSectionArticles, activeSectionReadingKey, addToast, applyUserProgressMutation, law, readingStorageLawId, userId]);

  const restartSectionReading = React.useCallback(() => {
    if (!activeSection || !activeSectionReadingKey || !readingStorageLawId) return;
    if (!userId) {
      addToast('Entre na sua conta para reiniciar a leitura.', 'warning');
      return;
    }

    const restartedAt = new Date().toISOString();
    const sectionId = String(activeSection.id || activeSectionReadingKey);

    setSectionReadingState((current) => {
      const next = {
        ...current,
        [activeSectionReadingKey]: {
          ...current[activeSectionReadingKey],
          startedAt: restartedAt,
          completedAt: undefined,
          restartedAt,
        },
        [sectionId]: {
          ...current[sectionId],
          startedAt: restartedAt,
          completedAt: undefined,
          restartedAt,
        },
      };
      saveSectionReadingState(userId, readingStorageLawId, next);
      return next;
    });

    addToast('Leitura reiniciada. Use "Marcar como lido" quando concluir novamente.', 'info');
  }, [activeSection, activeSectionReadingKey, addToast, readingStorageLawId, userId]);

  const handleSectionReadingAction = React.useCallback(() => {
    if (isActiveSectionCompleted) {
      restartSectionReading();
      return;
    }

    if (activeSectionReading?.startedAt) {
      void saveReadingProgress();
      return;
    }

    startSectionReading();
  }, [activeSectionReading?.startedAt, isActiveSectionCompleted, restartSectionReading, saveReadingProgress, startSectionReading]);

  const submitLegalComment = React.useCallback(async () => {
    if (!law || isSubmittingComment) return;
    if (!userId) {
      addToast('Entre na sua conta para comentar.', 'warning');
      return;
    }

    const targetArticleId = activeSection?.primaryArticleId || activeSectionArticles[0]?.id || '';
    const body = normalizeQuestionRichHtml(commentBody);
    if (!targetArticleId || !stripRichText(body)) return;
    if (!commentsPerDayUnlimited && commentsPerDayLimit !== null && readDailyUsageCount(userId, 'comments_per_day') >= commentsPerDayLimit) {
      setLegalFeatureUpgradeModal({
        featureName: 'mais comentários por dia',
        requiredPlan: getNextPlanForHigherUsageLimit(currentAccessPlanName, 'comments_per_day', systemSettings.planUsageLimits),
      });
      return;
    }

    setIsSubmittingComment(true);
    try {
      const result = await legalCommentaryApiService.addUserComment({
        articleId: targetArticleId,
        body,
      });
      applyUserProgressMutation(result);
      const createdComment: LegalUserComment = result.comment || {
        id: result.id || `legal-comment-${Date.now()}`,
        articleId: targetArticleId,
        userId,
        userName: String(currentUser?.name || currentUser?.email || 'Aluno'),
        userAvatar: currentUser?.photoUrl,
        userPlan: String(currentUser?.planDisplayName || currentUser?.plan || 'Gratuito'),
        userRole: currentUser?.role,
        body,
        status: result.moderationStatus === 'approved' ? 'visible' : 'hidden',
        moderationStatus: result.moderationStatus,
        createdAt: new Date().toISOString(),
      };

      setLaw((current) => current ? {
        ...current,
        userComments: [
          createdComment,
          ...(current.userComments || []).filter((comment) => String(comment.id) !== String(createdComment.id)),
        ],
      } : current);
      incrementDailyUsageCount(userId, 'comments_per_day');
      setCommentBody('');
      addToast(
        result.xpGain
          ? `${result.requiresModeration ? 'Comentário enviado para moderação.' : 'Comentário publicado.'} +${result.xpGain} XP.`
          : result.requiresModeration ? 'Comentário enviado para moderação.' : 'Comentário publicado.',
        'success',
      );
    } catch {
      addToast('Não foi possível enviar o comentário agora.', 'error');
    } finally {
      setIsSubmittingComment(false);
    }
  }, [
    activeSection,
    activeSectionArticles,
    addToast,
    applyUserProgressMutation,
    commentBody,
    commentsPerDayLimit,
    commentsPerDayUnlimited,
    currentAccessPlanName,
    currentUser,
    isSubmittingComment,
    law,
    systemSettings.planUsageLimits,
    userId,
  ]);

  const reportLegalComment = React.useCallback(async (commentId: string) => {
    if (!userId) {
      addToast('Entre na sua conta para reportar comentários.', 'warning');
      return;
    }

    try {
      const result = await legalCommentaryApiService.reportUserComment(commentId);
      applyUserProgressMutation(result);
      addToast(
        result.xpGain ? `Comentário reportado para moderação. +${result.xpGain} XP.` : 'Comentário reportado para moderação.',
        'success',
      );
    } catch {
      addToast('Não foi possível reportar o comentário agora.', 'error');
    }
  }, [addToast, applyUserProgressMutation, userId]);

  const deleteLegalComment = React.useCallback(async (commentId: string) => {
    try {
      await legalCommentaryApiService.deleteUserComment(commentId);
      setLaw((current) => current ? {
        ...current,
        userComments: (current.userComments || []).filter((comment) => String(comment.id) !== String(commentId)),
      } : current);
      addToast('Comentário excluído.', 'success');
    } catch {
      addToast('Não foi possível excluir o comentário agora.', 'error');
    }
  }, [addToast]);

  const getReaderSelectionRange = React.useCallback(() => {
    if (typeof window === 'undefined') return null;
    const editor = readerEditorRef.current;
    const selection = window.getSelection();
    if (!editor || !selection || selection.rangeCount === 0) return null;

    const range = selection.getRangeAt(0);
    const container = range.commonAncestorContainer;
    const containerElement = container instanceof Element ? container : container.parentElement;
    if (!containerElement || !editor.contains(containerElement)) return null;

    return range;
  }, []);

  const clearReaderToolbarState = React.useCallback(() => {
    setReaderActiveCommands({ bold: false, italic: false, underline: false });
    setReaderActiveTextColor('');
    setReaderActiveHighlightColor('');
  }, []);

  const refreshReaderToolbarState = React.useCallback(() => {
    if (activeTab !== 'law' || typeof window === 'undefined') {
      clearReaderToolbarState();
      return;
    }

    const range = getReaderSelectionRange();
    if (!range) {
      clearReaderToolbarState();
      return;
    }

    const container = range.commonAncestorContainer;
    const element = container instanceof HTMLElement ? container : container.parentElement;
    if (!element) {
      clearReaderToolbarState();
      return;
    }

    const computedStyle = window.getComputedStyle(element);
    const ancestorElements: HTMLElement[] = [];
    let currentElement: HTMLElement | null = element;
    const editor = readerEditorRef.current;
    while (currentElement && currentElement !== editor && (!editor || editor.contains(currentElement))) {
      ancestorElements.push(currentElement);
      currentElement = currentElement.parentElement;
    }

    const selectedTextElements: HTMLElement[] = [];
    if (editor && typeof document !== 'undefined' && typeof NodeFilter !== 'undefined' && !range.collapsed) {
      const walker = document.createTreeWalker(
        editor,
        NodeFilter.SHOW_TEXT,
        {
          acceptNode: (node) => (
            range.intersectsNode(node) && String(node.textContent || '').trim()
              ? NodeFilter.FILTER_ACCEPT
              : NodeFilter.FILTER_REJECT
          ),
        },
      );

      let currentNode = walker.nextNode();
      while (currentNode) {
        const parentElement = currentNode.parentElement;
        if (parentElement) {
          selectedTextElements.push(parentElement);
        }
        currentNode = walker.nextNode();
      }
    }

    const elementOrAncestorMatchesCommand = (baseElement: HTMLElement, command: 'bold' | 'italic' | 'underline') => {
      let current: HTMLElement | null = baseElement;
      while (current && current !== editor && (!editor || editor.contains(current))) {
        if (matchesReaderCommandElement(current, command)) {
          return true;
        }
        current = current.parentElement;
      }

      return false;
    };

    const hasActiveCommand = (command: 'bold' | 'italic' | 'underline') => {
      if (ancestorElements.some((ancestor) => matchesReaderCommandElement(ancestor, command))) {
        return true;
      }

      if (selectedTextElements.some((selectedElement) => elementOrAncestorMatchesCommand(selectedElement, command))) {
        return true;
      }

      if (command === 'bold') {
        const fontWeight = Number.parseInt(computedStyle.fontWeight, 10);
        return Number.isNaN(fontWeight)
          ? ['bold', 'bolder'].includes(computedStyle.fontWeight)
          : fontWeight >= 600;
      }

      if (command === 'italic') {
        return computedStyle.fontStyle === 'italic';
      }

      return computedStyle.textDecorationLine.includes('underline')
        || ancestorElements.some((ancestor) => window.getComputedStyle(ancestor).textDecorationLine.includes('underline'));
    };

    const getActiveInlineColor = (
      styleName: 'color' | 'backgroundColor',
      colorOptions: string[],
    ) => {
      const expectedReaderStyle = styleName === 'color' ? 'text-color' : 'highlight';
      const styledAncestor = ancestorElements.find((ancestor) => {
        const readerStyle = String(ancestor.dataset.readerStyle || '').toLowerCase();
        const inlineValue = styleName === 'color' ? ancestor.style.color : ancestor.style.backgroundColor;
        return readerStyle === expectedReaderStyle
          || Boolean(inlineValue)
          || (styleName === 'backgroundColor' && ancestor.dataset.readerHighlight === 'true');
      });

      if (!styledAncestor) {
        return '';
      }

      const inlineValue = styleName === 'color' ? styledAncestor.style.color : styledAncestor.style.backgroundColor;
      const resolvedValue = inlineValue || window.getComputedStyle(styledAncestor)[styleName];
      const normalizedValue = resolvedValue.toLowerCase();
      return colorOptions.find((colorOption) => {
        const normalizedOption = colorOption.toLowerCase();
        return normalizedValue === normalizedOption || normalizedValue === hexToRgb(colorOption);
      }) || '';
    };

    const textColor = getActiveInlineColor('color', READER_TEXT_COLORS);
    const highlightColor = getActiveInlineColor('backgroundColor', READER_HIGHLIGHT_COLORS);

    setReaderActiveCommands({
      bold: hasActiveCommand('bold'),
      italic: hasActiveCommand('italic'),
      underline: hasActiveCommand('underline'),
    });
    setReaderActiveTextColor(textColor);
    setReaderActiveHighlightColor(highlightColor);
  }, [activeTab, clearReaderToolbarState, getReaderSelectionRange]);

  const syncReaderMarkupFromDom = React.useCallback(() => {
    const editor = readerEditorRef.current;
    if (!editor) return '';

    return normalizeQuestionRichHtml(editor.innerHTML);
  }, []);

  const wrapReaderRangeTextNodes = React.useCallback((
    range: Range,
    createWrapper: () => HTMLElement,
  ) => {
    const editor = readerEditorRef.current;
    if (!editor || typeof document === 'undefined' || typeof NodeFilter === 'undefined') {
      return null;
    }

    const walker = document.createTreeWalker(
      editor,
      NodeFilter.SHOW_TEXT,
      {
        acceptNode: (node) => (
          range.intersectsNode(node)
            ? NodeFilter.FILTER_ACCEPT
            : NodeFilter.FILTER_REJECT
        ),
      },
    );

    const targets: Array<{ node: Text; start: number; end: number }> = [];
    let currentNode = walker.nextNode();
    while (currentNode) {
      const textNode = currentNode as Text;
      const textLength = textNode.data.length;
      const start = textNode === range.startContainer ? range.startOffset : 0;
      const end = textNode === range.endContainer ? range.endOffset : textLength;
      if (start < end) {
        targets.push({ node: textNode, start, end });
      }
      currentNode = walker.nextNode();
    }

    let firstWrapper: HTMLElement | null = null;
    targets.reverse().forEach(({ node, start, end }) => {
      const selectedTextNode = start > 0 ? node.splitText(start) : node;
      const selectedLength = end - start;
      if (selectedLength < selectedTextNode.data.length) {
        selectedTextNode.splitText(selectedLength);
      }

      const wrapper = createWrapper();
      wrapper.dataset.readerMarkup = 'true';
      selectedTextNode.parentNode?.insertBefore(wrapper, selectedTextNode);
      wrapper.appendChild(selectedTextNode);
      firstWrapper = wrapper;
    });

    return firstWrapper;
  }, []);

  const isReaderEditableMarkupElement = React.useCallback((element: HTMLElement) => {
    const tagName = element.tagName.toLowerCase();
    return element.dataset.readerMarkup === 'true'
      || Boolean(element.getAttribute('style'))
      || ['b', 'strong', 'em', 'i', 'u', 'mark', 'span'].includes(tagName);
  }, []);

  const unwrapReaderMarkupElements = React.useCallback((elements: HTMLElement[]) => {
    const editor = readerEditorRef.current;
    if (!editor) {
      return 0;
    }

    const uniqueElements = Array.from(new Set(elements))
      .filter((element) => element !== editor && editor.contains(element));
    uniqueElements.forEach((element) => {
      element.replaceWith(...Array.from(element.childNodes));
    });

    return uniqueElements.length;
  }, []);

  const createReaderCommandMatcher = React.useCallback((command: 'bold' | 'italic' | 'underline') => (
    (element: HTMLElement) => matchesReaderCommandElement(element, command)
  ), []);

  const createReaderInlineStyleMatcher = React.useCallback((
    styleName: 'color' | 'backgroundColor',
    value?: string,
  ) => (
    (element: HTMLElement) => {
      const readerStyle = String(element.dataset.readerStyle || '').toLowerCase();
      const expectedReaderStyle = styleName === 'color' ? 'text-color' : 'highlight';
      const inlineValue = styleName === 'color' ? element.style.color : element.style.backgroundColor;
      const hasStyleType = readerStyle === expectedReaderStyle
        || inlineValue !== ''
        || (styleName === 'backgroundColor' && element.dataset.readerHighlight === 'true');
      if (!hasStyleType) {
        return false;
      }

      if (!value) {
        return true;
      }

      const normalizedTarget = hexToRgb(value) || value.toLowerCase();
      return inlineValue.toLowerCase() === value.toLowerCase()
        || inlineValue === normalizedTarget;
    }
  ), []);

  const findReaderMarkupAncestors = React.useCallback((
    range: Range,
    matcher: (element: HTMLElement) => boolean = isReaderEditableMarkupElement,
  ) => {
    const editor = readerEditorRef.current;
    if (!editor) {
      return [];
    }

    const startElement = range.startContainer instanceof HTMLElement
      ? range.startContainer
      : range.startContainer.parentElement;
    const elements: HTMLElement[] = [];
    let current: HTMLElement | null = startElement;
    while (current && current !== editor && editor.contains(current)) {
      if (matcher(current)) {
        elements.push(current);
      }
      current = current.parentElement;
    }

    return elements;
  }, [isReaderEditableMarkupElement]);

  const unwrapReaderMarkupInRange = React.useCallback((
    range: Range,
    matcher: (element: HTMLElement) => boolean = isReaderEditableMarkupElement,
  ) => {
    const editor = readerEditorRef.current;
    if (!editor || typeof document === 'undefined' || typeof NodeFilter === 'undefined') {
      return 0;
    }

    if (range.collapsed) {
      return unwrapReaderMarkupElements(findReaderMarkupAncestors(range, matcher));
    }

    const walker = document.createTreeWalker(
      editor,
      NodeFilter.SHOW_ELEMENT,
      {
        acceptNode: (node) => {
          if (!(node instanceof HTMLElement) || !range.intersectsNode(node)) {
            return NodeFilter.FILTER_REJECT;
          }

          return matcher(node)
            ? NodeFilter.FILTER_ACCEPT
            : NodeFilter.FILTER_SKIP;
        },
      },
    );

    const wrappers: HTMLElement[] = [
      ...findReaderMarkupAncestors(range, matcher),
    ];
    const endElement = range.endContainer instanceof HTMLElement
      ? range.endContainer
      : range.endContainer.parentElement;
    let currentEndElement: HTMLElement | null = endElement;
    while (currentEndElement && currentEndElement !== editor && editor.contains(currentEndElement)) {
      if (matcher(currentEndElement)) {
        wrappers.push(currentEndElement);
      }
      currentEndElement = currentEndElement.parentElement;
    }

    let currentNode = walker.nextNode();
    while (currentNode) {
      wrappers.push(currentNode as HTMLElement);
      currentNode = walker.nextNode();
    }

    return unwrapReaderMarkupElements(wrappers.reverse());
  }, [findReaderMarkupAncestors, isReaderEditableMarkupElement, unwrapReaderMarkupElements]);

  const ensureReaderSelection = React.useCallback((requiresSelectedText = false) => {
    if (activeTab !== 'law') {
      setActiveTab('law');
      addToast('Abra o conteúdo da lei e selecione um trecho para formatar.', 'warning');
      return null;
    }

    const range = getReaderSelectionRange();
    if (!range || (requiresSelectedText && range.collapsed)) {
      addToast('Selecione um trecho do texto da lei para aplicar a formatação.', 'warning');
      return null;
    }

    readerEditorRef.current?.focus();
    return range;
  }, [activeTab, addToast, getReaderSelectionRange]);

  const applyReaderCommand = React.useCallback((command: 'bold' | 'italic' | 'underline' | 'removeFormat') => {
    const range = ensureReaderSelection(command !== 'removeFormat');
    if (!range || typeof document === 'undefined') return;

    let forcedCommandState: { command: 'bold' | 'italic' | 'underline'; active: boolean } | null = null;

    if (command === 'removeFormat') {
      const removedCount = unwrapReaderMarkupInRange(range);
      if (removedCount === 0) {
        addToast('Nenhuma marcação encontrada nesse trecho.', 'info');
      }
      setReaderActiveCommands({ bold: false, italic: false, underline: false });
      setReaderActiveTextColor('');
      setReaderActiveHighlightColor('');
    } else {
      const matcher = createReaderCommandMatcher(command);
      const shouldRemoveExistingFormat = unwrapReaderMarkupInRange(range, matcher) > 0;
      const nextCommandActive = !shouldRemoveExistingFormat;
      let wrapper: HTMLElement | null = null;
      if (!shouldRemoveExistingFormat) {
        wrapper = wrapReaderRangeTextNodes(range, () => {
          const span = document.createElement('span');
          span.dataset.readerStyle = command;
          if (command === 'bold') span.style.fontWeight = '950';
          if (command === 'italic') span.style.fontStyle = 'italic';
          if (command === 'underline') span.style.textDecoration = 'underline';
          return span;
        });
      }

      const selection = window.getSelection();
      if (wrapper && selection) {
        selection.removeAllRanges();
        const nextRange = document.createRange();
        nextRange.selectNodeContents(wrapper);
        selection.addRange(nextRange);
      }

      setReaderActiveCommands((current) => ({
        ...current,
        [command]: nextCommandActive,
      }));
      forcedCommandState = { command, active: nextCommandActive };
    }

    syncReaderMarkupFromDom();
    window.requestAnimationFrame(() => {
      refreshReaderToolbarState();
      if (forcedCommandState) {
        setReaderActiveCommands((current) => ({
          ...current,
          [forcedCommandState.command]: forcedCommandState.active,
        }));
      }
    });
  }, [addToast, createReaderCommandMatcher, ensureReaderSelection, refreshReaderToolbarState, syncReaderMarkupFromDom, unwrapReaderMarkupInRange, wrapReaderRangeTextNodes]);

  const applyReaderInlineStyle = React.useCallback((styleName: 'color' | 'backgroundColor', value: string) => {
    const range = ensureReaderSelection(true);
    if (!range || typeof document === 'undefined') return;

    const sameStyleMatcher = createReaderInlineStyleMatcher(styleName, value);
    if (unwrapReaderMarkupInRange(range, sameStyleMatcher) > 0) {
      if (styleName === 'color') {
        setReaderActiveTextColor('');
      } else {
        setReaderActiveHighlightColor('');
      }
      syncReaderMarkupFromDom();
      window.requestAnimationFrame(refreshReaderToolbarState);
      return;
    }

    unwrapReaderMarkupInRange(range, createReaderInlineStyleMatcher(styleName));

    const wrapper = wrapReaderRangeTextNodes(range, () => {
      const span = document.createElement('span');
      span.dataset.readerStyle = styleName === 'color' ? 'text-color' : 'highlight';
      span.style[styleName] = value;
      if (styleName === 'backgroundColor') {
        span.dataset.readerHighlight = 'true';
      }
      return span;
    });

    const selection = window.getSelection();
    if (wrapper && selection) {
      selection.removeAllRanges();
      const nextRange = document.createRange();
      nextRange.selectNodeContents(wrapper);
      selection.addRange(nextRange);
    }
    syncReaderMarkupFromDom();
    if (styleName === 'color') {
      setReaderActiveTextColor(value);
    } else {
      setReaderActiveHighlightColor(value);
    }
    window.requestAnimationFrame(refreshReaderToolbarState);
  }, [createReaderInlineStyleMatcher, ensureReaderSelection, refreshReaderToolbarState, syncReaderMarkupFromDom, unwrapReaderMarkupInRange, wrapReaderRangeTextNodes]);

  React.useEffect(() => {
    if (typeof document === 'undefined') {
      return undefined;
    }

    document.addEventListener('selectionchange', refreshReaderToolbarState);
    return () => document.removeEventListener('selectionchange', refreshReaderToolbarState);
  }, [refreshReaderToolbarState]);

  const saveReaderMarkup = React.useCallback(() => {
    if (!readerMarkupKey) return;
    const markupHtml = syncReaderMarkupFromDom();
    saveReaderMarkupHtml(readerMarkupKey, markupHtml);
    setSavedReaderMarkupHtml(markupHtml);
    addToast('Marcações salvas nesta seção.', 'success');
  }, [addToast, readerMarkupKey, syncReaderMarkupFromDom]);

  const resetReaderMarkup = React.useCallback(() => {
    if (!readerMarkupKey) return;
    clearReaderMarkupHtml(readerMarkupKey);
    setSavedReaderMarkupHtml('');
    clearReaderToolbarState();
    if (typeof window !== 'undefined') {
      window.getSelection()?.removeAllRanges();
    }
    setReaderMarkupVersion((current) => current + 1);
    addToast('Marcações removidas. Texto original restaurado.', 'success');
  }, [addToast, clearReaderToolbarState, readerMarkupKey]);

  const totalRelatedQuestions = React.useMemo(() => activeSectionArticles.reduce(
    (sum, article) => sum + Number(article.relatedQuestionCount || article.questoesRelacionadas || 0),
    0,
  ), [activeSectionArticles]);

  React.useEffect(() => {
    if (activeTab !== 'law' || isActiveSectionCompleted || !userId) {
      return undefined;
    }

    const checkReadingCompletion = () => {
      const content = readingContentSectionRef.current;
      if (!content) return;

      const rect = content.getBoundingClientRect();
      const viewportHeight = window.innerHeight || document.documentElement.clientHeight || 0;
      if (rect.bottom <= viewportHeight + 120) {
        void saveReadingProgress({ silent: true });
      }
    };

    const frameId = window.requestAnimationFrame(checkReadingCompletion);
    window.addEventListener('scroll', checkReadingCompletion, { passive: true });
    window.addEventListener('resize', checkReadingCompletion);
    return () => {
      window.cancelAnimationFrame(frameId);
      window.removeEventListener('scroll', checkReadingCompletion);
      window.removeEventListener('resize', checkReadingCompletion);
    };
  }, [activeTab, isActiveSectionCompleted, saveReadingProgress, userId]);

  if (isLoading) {
    return <LegalCommentaryDetailSkeleton />;
  }

  if (!law) {
    return (
      <section className={`${PLATFORM_SURFACE_CARD_CLASS} p-8 text-center`}>
        <BookOpen size={34} className="mx-auto mb-3 text-slate-300 dark:text-slate-600" />
        <h1 className={PLATFORM_PAGE_TITLE_CLASS}>Lei não encontrada</h1>
        <p className={`${PLATFORM_PAGE_DESCRIPTION_CLASS} mt-2`}>{loadError || 'Não foi possível abrir esta lei.'}</p>
        <button
          type="button"
          onClick={() => void loadLaw({ force: true })}
          className="mt-5 inline-flex h-10 items-center justify-center rounded-xl bg-[#615fff] px-4 text-sm font-black text-white transition-colors hover:bg-[#514dff]"
        >
          Tentar novamente
        </button>
      </section>
    );
  }

  if (!canAccessLegalModule) {
    return (
      <section className={`${PLATFORM_SURFACE_CARD_CLASS} p-8`}>
        <LegalFeatureFallbackPanel
          title="Lei Comentada bloqueada para este plano"
          description="O acesso ao módulo de Lei Comentada está desativado para o seu plano no Controle de Acesso por Plano."
          requiredPlan={getBenefitPlanLabel('module.lei_comentada', systemSettings.planEntitlements)}
          mode="locked"
        />
      </section>
    );
  }

  const firstSectionArticle = isSearchingLegalContent
    ? (visibleArticles[0] || activeSectionArticles[0] || null)
    : (activeSectionArticles[0] || visibleArticles[0] || null);
  const titleMarker = firstSectionArticle ? getTitleMarker(firstSectionArticle) : '';
  const sectionName = firstSectionArticle ? getSectionHeaderText(firstSectionArticle) : '';
  const readableActiveSectionTitle = getReadableSectionTitle(activeSection);
  const contentHeaderTitle = isSearchingLegalContent
    ? 'Resultado da busca'
    : (sectionName || readableActiveSectionTitle);
  const contentHeaderMarker = isSearchingLegalContent
    ? 'Busca em toda a lei'
    : (titleMarker && normalizeText(titleMarker) !== normalizeText(contentHeaderTitle)
      ? titleMarker
      : '');
  const activeSectionLabel = activeSection
    ? (activeSection.fromArticle === activeSection.toArticle
      ? `Artigo ${activeSection.fromArticle}`
      : `Artigos ${activeSection.fromArticle} a ${activeSection.toArticle}`)
    : 'Faixa completa';
  const fontSizeStyle: React.CSSProperties = {
    fontSize: `${Math.max(13, Math.min(18, Math.round(fontScale / 7.2)))}px`,
  };
  const isReaderToolbarCollapsed = isScrollToolbarHidden;

  return (
    <div className="space-y-4 pb-10">
      <section className={`${PLATFORM_SURFACE_CARD_CLASS} p-5`}>
        <div className="flex flex-wrap items-center gap-2 text-xs font-black text-slate-400">
          <Link href="/lei-comentada" className="inline-flex items-center gap-1 text-[#615fff] hover:underline">
            <ArrowLeft size={12} />
            Lei Comentada
          </Link>
          <ChevronRight size={12} />
          <span className="text-slate-500">{law.area.name}</span>
          {activeSection ? (
            <>
              <ChevronRight size={12} />
              <span className="text-slate-500">{activeSectionLabel}</span>
            </>
          ) : null}
        </div>

        <div className="mt-3 flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h1 className={PLATFORM_PAGE_TITLE_CLASS}>{law.number ? `Lei nº ${law.number}/${law.year || ''}` : law.shortTitle}</h1>
            <p className={`${PLATFORM_PAGE_DESCRIPTION_CLASS} mt-1`}>{law.shortTitle}</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <ToolbarButton icon={<Bookmark size={14} className={isActiveSectionFavorite ? 'fill-current' : ''} />} label="Favoritar seção" onClick={toggleSectionFavorite} active={isActiveSectionFavorite} />
            <ToolbarButton
              icon={isActiveSectionCompleted ? <RotateCcw size={14} /> : activeSectionReading?.startedAt ? <CheckCircle2 size={14} /> : <Save size={14} />}
              label={activeSectionActionLabel}
              onClick={handleSectionReadingAction}
              active={isActiveSectionCompleted}
            />
            <ToolbarButton icon={<Share2 size={14} />} label="Compartilhar" onClick={shareLaw} />
            <ToolbarButton icon={<MessageSquare size={14} />} label="Solicitar comentário" onClick={openTeacherCommentRequestModal} />
            <ToolbarButton icon={<Flag size={14} />} label="Reportar erro" onClick={openSectionReportModal} />
          </div>
        </div>

        <div className="mt-4 max-w-md">
          <div className="mb-1 flex items-center justify-between text-xs font-bold text-slate-500 dark:text-slate-300">
            <span>Progresso da leitura</span>
            <span>{formatPercent(progressPercent)}</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700">
            <div className="h-full rounded-full bg-[#615fff]" style={{ width: formatPercent(progressPercent) }} />
          </div>
        </div>

        <div className="mt-4 grid gap-3 lg:grid-cols-[minmax(0,1fr)_320px]">
          <label className="relative">
            <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              value={searchTerm}
              onChange={(event) => handleLegalSearchChange(event.target.value)}
              placeholder="Buscar artigo, termo, comentário ou jurisprudência..."
              className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 pl-10 pr-3 text-sm font-semibold text-slate-700 outline-none transition-colors focus:border-[#615fff]/40 focus:bg-white dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
            />
          </label>

          <select
            value={activeSection?.id || ''}
            onChange={(event) => changeSection(event.target.value)}
            className="h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 outline-none transition-colors focus:border-[#615fff]/40 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
          >
            {sections.map((section) => (
              <option key={section.id} value={section.id}>
                {section.fromArticle === section.toArticle
                  ? `Art. ${section.fromArticle}`
                  : `Art. ${section.fromArticle} a ${section.toArticle}`} - {section.title}
              </option>
            ))}
          </select>
        </div>
      </section>

      <div ref={readerToolbarAnchorRef} style={readerFloatingToolbar?.active ? { height: readerFloatingToolbar.height } : undefined}>
      <section
        ref={readerToolbarRef}
        className={`${readerFloatingToolbar?.active ? 'fixed z-50' : 'relative z-30'} space-y-1 sm:space-y-2`}
        style={readerFloatingToolbar?.active ? {
          top: FLOATING_READER_TOOLBAR_TOP_OFFSET,
          left: readerFloatingToolbar.left,
          width: readerFloatingToolbar.width,
        } : undefined}
      >
        {isReaderToolbarCollapsed ? (
          <div className="flex justify-end">
            <button
              type="button"
              onClick={() => setIsScrollToolbarHidden(false)}
              className="inline-flex h-9 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-xs font-black text-slate-700 shadow-sm transition-colors hover:border-[#615fff]/30 hover:text-[#514dff] dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
            >
              <Eye size={14} />
              Mostrar barra
            </button>
          </div>
        ) : (
        <>
        <div className={`${PLATFORM_SURFACE_CARD_CLASS} flex flex-nowrap items-center gap-1 overflow-x-auto px-2 py-1.5 sm:flex-wrap sm:gap-2 sm:px-3 sm:py-2`}>
          <ToolbarButton
            icon={<Table size={14} />}
            label="Sumário"
            active={isSummaryOpen}
            onClick={() => setIsSummaryOpen((state) => !state)}
          />
          <div className="inline-flex h-8 shrink-0 items-center gap-1 rounded-lg border border-slate-200 bg-white px-1.5 dark:border-slate-700 dark:bg-slate-900 sm:h-9 sm:gap-2 sm:px-2">
            <button
              type="button"
              onClick={() => setFontScale((value) => Math.max(90, value - 5))}
              className="grid h-6 w-6 place-items-center rounded-md text-slate-500 transition-colors hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800 sm:h-7 sm:w-7"
              aria-label="Diminuir zoom"
            >
              <Minus size={14} />
            </button>
            <span className="text-xs font-black text-slate-600 dark:text-slate-200">{fontScale}%</span>
            <button
              type="button"
              onClick={() => setFontScale((value) => Math.min(130, value + 5))}
              className="grid h-6 w-6 place-items-center rounded-md text-slate-500 transition-colors hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800 sm:h-7 sm:w-7"
              aria-label="Aumentar zoom"
            >
              <Plus size={14} />
            </button>
          </div>
          <ToolbarButton
            icon={canUseFocusMode ? <Eye size={14} /> : <Lock size={14} />}
            label={isFocusMode ? 'Sair do foco' : 'Modo foco'}
            active={isFocusMode && canUseFocusMode}
            onClick={() => {
              if (!canUseFocusMode) {
                openLegalFeatureUpgradeModal('lei.modo_foco', 'modo foco na Lei Comentada');
                return;
              }
              setIsFocusMode((state) => !state);
            }}
          />
          <ToolbarButton
            icon={canUseLegalFavorites ? <Bookmark size={14} className={isActiveSectionFavorite ? 'fill-current' : ''} /> : <Lock size={14} />}
            label="Favoritar seção"
            onClick={toggleSectionFavorite}
            active={isActiveSectionFavorite && canUseLegalFavorites}
          />
          <ToolbarButton icon={<ExternalLink size={14} />} label="Planalto" onClick={openOfficialPdf} />
          <ToolbarButton
            icon={showLegalTextNotes ? <EyeOff size={14} /> : <FileText size={14} />}
            label={showLegalTextNotes ? 'Ocultar notas da lei' : 'Mostrar notas da lei'}
            active={showLegalTextNotes}
            onClick={() => setShowLegalTextNotes((state) => !state)}
          />
          <ToolbarButton
            icon={showEditorialAnnotations ? <EyeOff size={14} /> : <MessageSquare size={14} />}
            label={showEditorialAnnotations ? 'Ocultar comentários' : 'Mostrar comentários'}
            active={showEditorialAnnotations}
            onClick={() => setShowEditorialAnnotations((state) => !state)}
          />
          <ToolbarButton
            icon={<EyeOff size={14} />}
            label="Ocultar barra"
            disabled={!readerFloatingToolbar?.active}
            onClick={() => setIsScrollToolbarHidden(true)}
          />
        </div>
        {isSummaryOpen ? (
          <div className={`${PLATFORM_SURFACE_CARD_CLASS} max-h-[320px] overflow-y-auto p-2`}>
            <div className="grid gap-1 md:grid-cols-2">
              {sections.map((section) => (
                <button
                  key={section.id}
                  type="button"
                  onClick={() => {
                    setIsSummaryOpen(false);
                    changeSection(section.id);
                  }}
                  className={`flex items-center justify-between gap-3 rounded-lg px-3 py-2 text-left text-xs font-bold transition-colors ${
                    activeSection?.id === section.id
                      ? 'bg-[#615fff]/10 text-[#514dff]'
                      : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800'
                  }`}
                >
                  <span className="line-clamp-1">
                    {section.fromArticle === section.toArticle
                      ? `Art. ${section.fromArticle}`
                      : `Arts. ${section.fromArticle} a ${section.toArticle}`} - {section.title}
                  </span>
                  {completedSectionKeys.has(buildSectionReadingKey(section)) ? <CheckCircle2 size={14} className="shrink-0 text-emerald-500" /> : null}
                </button>
              ))}
            </div>
          </div>
        ) : null}
        {activeTab === 'law' ? (
          <div className={`${PLATFORM_SURFACE_CARD_CLASS} flex flex-nowrap items-center justify-between gap-2 overflow-x-auto px-2 py-1.5 sm:flex-wrap sm:gap-3 sm:px-3 sm:py-2`}>
            <div className="flex shrink-0 flex-nowrap items-center gap-1 sm:flex-wrap sm:gap-2">
              <ReaderEditorButton label="Negrito" icon={<Bold size={15} />} active={readerActiveCommands.bold} onPress={() => applyReaderCommand('bold')} />
              <ReaderEditorButton label="Itálico" icon={<Italic size={15} />} active={readerActiveCommands.italic} onPress={() => applyReaderCommand('italic')} />
              <ReaderEditorButton label="Sublinhado" icon={<Underline size={15} />} active={readerActiveCommands.underline} onPress={() => applyReaderCommand('underline')} />
              <div className="mx-0.5 h-6 w-px bg-slate-200 dark:bg-slate-700 sm:mx-1 sm:h-7" />
              <span className="hidden h-9 items-center gap-1 rounded-lg border border-slate-200 bg-white px-2 text-[10px] font-black uppercase tracking-[0.12em] text-slate-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 sm:inline-flex">
                Texto
              </span>
              {READER_TEXT_COLORS.map((color) => (
                <ReaderColorButton
                  key={`text-${color}`}
                  label={`Cor do texto ${color}`}
                  color={color}
                  active={readerActiveTextColor === color}
                  onPress={() => applyReaderInlineStyle('color', color)}
                />
              ))}
              <div className="mx-0.5 h-6 w-px bg-slate-200 dark:bg-slate-700 sm:mx-1 sm:h-7" />
              <span className="hidden h-9 items-center gap-1 rounded-lg border border-slate-200 bg-white px-2 text-[10px] font-black uppercase tracking-[0.12em] text-slate-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 sm:inline-flex">
                <Highlighter size={13} />
                Destaque
              </span>
              {READER_HIGHLIGHT_COLORS.map((color) => (
                <ReaderColorButton
                  key={`highlight-${color}`}
                  label={`Marca-texto ${color}`}
                  color={color}
                  active={readerActiveHighlightColor === color}
                  onPress={() => applyReaderInlineStyle('backgroundColor', color)}
                />
              ))}
              <ReaderEditorButton label="Limpar formatação" icon={<Eraser size={15} />} onPress={() => applyReaderCommand('removeFormat')} />
              <ReaderEditorButton label="Restaurar texto original" icon={<RotateCcw size={15} />} onPress={resetReaderMarkup} />
            </div>
            <button
              type="button"
              onMouseDown={(event) => {
                event.preventDefault();
                if (!canUseReaderAnnotations) {
                  setReaderSaveUpgradeOpen(true);
                  return;
                }
                saveReaderMarkup();
              }}
              onKeyDown={(event) => {
                if (event.key !== 'Enter' && event.key !== ' ') {
                  return;
                }
                event.preventDefault();
                if (!canUseReaderAnnotations) {
                  setReaderSaveUpgradeOpen(true);
                  return;
                }
                saveReaderMarkup();
              }}
              className={`inline-flex h-8 shrink-0 items-center gap-2 rounded-lg px-3 text-xs font-black transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#615fff]/45 sm:h-9 sm:px-4 ${
                canUseReaderAnnotations
                  ? 'bg-slate-900 text-white hover:bg-[#615fff] dark:bg-slate-100 dark:text-slate-950'
                  : 'border border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-200'
              }`}
            >
              {canUseReaderAnnotations ? <Save size={14} /> : <Lock size={14} />}
              <span className="hidden sm:inline">{canUseReaderAnnotations ? 'Salvar' : `Salvar no ${getLegalFeatureRequiredPlanLabel('lei.anotacoes')}`}</span>
            </button>
          </div>
        ) : null}
        </>
        )}
      </section>
      </div>

      {activeTab === 'questions' ? (
        !canLoadRelatedQuestions ? (
          <section ref={questionsContentSectionRef} className={`${PLATFORM_SURFACE_CARD_CLASS} p-6`}>
            <LegalFeatureFallbackPanel
              title="Treine esta seção com questões certas para o assunto"
              description={canViewRelatedQuestions
                ? 'Seu plano atual não possui cota disponível para abrir questões relacionadas a partir da Lei Comentada.'
                : 'As questões relacionadas conectam o artigo ao modo prática, para você revisar exatamente o que acabou de ler.'}
              requiredPlan={canViewRelatedQuestions ? 'Plano com cota disponível' : getLegalFeatureRequiredPlanLabel('lei.questoes')}
              mode={relatedQuestionsFallbackMode}
              previewItems={['Filtro automático', 'Prática por artigo', 'Revisão guiada']}
            />
          </section>
        ) : (
        <section ref={questionsContentSectionRef} className={`${PLATFORM_SURFACE_CARD_CLASS} p-6`}>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-lg font-black text-slate-900 dark:text-slate-100">Questões relacionadas</h2>
              <p className="mt-2 text-sm font-medium text-slate-500 dark:text-slate-300">
                Cards filtrados pela matéria e pelos tópicos/assuntos desta seção.
              </p>
            </div>
            <Link
              href={practiceSectionHref}
              className="inline-flex h-10 items-center justify-center rounded-xl bg-[#615fff] px-4 text-sm font-black text-white transition-colors hover:bg-[#514dff]"
            >
              Resolver no modo prática
            </Link>
          </div>
          <div className="mt-5">
            {relatedQuestionsState.status === 'loading' ? (
              <SpinnerBlock label="Carregando questões relacionadas..." />
            ) : relatedQuestionsState.status === 'error' ? (
              <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-bold text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-200">
                {relatedQuestionsState.error}
              </div>
            ) : relatedQuestionsState.rows.length ? (
              <div className="space-y-3">
                {relatedQuestionsState.rows.map((question, index) => (
                  <RelatedQuestionPreviewCard key={question.id || question.hashId || index} question={question} index={index} />
                ))}
                <p className="text-xs font-semibold text-slate-400">
                  Exibindo {relatedQuestionsState.rows.length} de {relatedQuestionsState.total || relatedQuestionsState.rows.length} questão(ões) encontradas.
                </p>
              </div>
            ) : (
              <div className="rounded-xl border border-dashed border-slate-200 bg-white px-4 py-8 text-center dark:border-slate-700 dark:bg-slate-900">
                <FileText size={26} className="mx-auto text-slate-300 dark:text-slate-600" />
                <p className="mt-3 text-sm font-bold text-slate-500 dark:text-slate-300">
                  Nenhuma questão encontrada para os filtros desta seção.
                </p>
                {totalRelatedQuestions > 0 ? (
                  <p className="mt-1 text-xs font-semibold text-slate-400">
                    Existem {totalRelatedQuestions} vínculo(s) editoriais, mas eles ainda não retornaram no filtro público.
                  </p>
                ) : null}
              </div>
            )}
          </div>
        </section>
        )
      ) : activeTab === 'comments' ? (
        <div ref={commentsContentSectionRef}>
          <LegalCommentsPanel
            comments={sectionUserComments}
            value={commentBody}
            disabled={!userId}
            isSubmitting={isSubmittingComment}
            onChange={setCommentBody}
            onSubmit={submitLegalComment}
            onReport={reportLegalComment}
            onDelete={deleteLegalComment}
            currentUserId={userId}
          />
        </div>
      ) : activeTab === 'analysis' ? (
        null
      ) : (
        <section ref={readingContentSectionRef} className={`${PLATFORM_SURFACE_CARD_CLASS} overflow-hidden`}>
          <div className="border-b border-slate-200 px-5 py-3 text-xs font-bold text-slate-500 dark:border-slate-700 dark:text-slate-300">
            Última sincronização: {formatDate(law.lastSyncedAt)}
          </div>

          {isSearchingLegalContent ? (
            <div className="border-b border-indigo-100 bg-indigo-50/70 px-5 py-3 text-sm font-semibold text-indigo-900 dark:border-indigo-500/20 dark:bg-indigo-500/10 dark:text-indigo-100">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span>
                  Busca em toda a lei: {visibleArticles.length} artigo(s) encontrado(s) para &quot;{searchTerm.trim()}&quot;.
                </span>
                <button
                  type="button"
                  onClick={() => setSearchTerm('')}
                  className="inline-flex h-8 items-center justify-center rounded-lg border border-indigo-200 bg-white px-3 text-xs font-black uppercase tracking-[0.12em] text-[#615fff] transition-colors hover:bg-indigo-50 dark:border-indigo-500/30 dark:bg-slate-900 dark:text-indigo-100 dark:hover:bg-indigo-500/10"
                >
                  Limpar busca
                </button>
              </div>
            </div>
          ) : null}

          {visibleArticles.length === 0 ? (
            <div className="p-6 text-sm font-semibold text-slate-500 dark:text-slate-300">
              {isSearchingLegalContent
                ? 'Nenhum artigo, comentário, súmula, doutrina ou jurisprudência encontrado com esse termo.'
                : 'Nenhum artigo encontrado com os filtros atuais.'}
            </div>
          ) : (
            <div className="bg-slate-100/70 p-4 dark:bg-slate-950/50">
              <div className="mx-auto max-w-[980px] rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-900 md:p-9">
                <header className="mb-7 text-center">
                  {contentHeaderMarker ? (
                    <p className="text-[11px] font-black uppercase tracking-[0.18em] text-[#615fff]">
                      {contentHeaderMarker}
                    </p>
                  ) : null}
                  {contentHeaderTitle ? (
                    <h2 className="mt-2 text-2xl font-black tracking-tight text-slate-900 dark:text-slate-100">
                      {contentHeaderTitle}
                    </h2>
                  ) : null}
                </header>

                <div
                  key={`${readerMarkupKey}:${readerMarkupVersion}:${savedReaderMarkupHtml ? 'saved' : 'source'}`}
                  ref={readerEditorRef}
                  tabIndex={-1}
                  onMouseUp={refreshReaderToolbarState}
                  className="legal-reader-content outline-none"
                  {...(shouldRenderSavedReaderMarkup ? { dangerouslySetInnerHTML: { __html: sanitizedHtml } } : {})}
                >
                  {shouldRenderSavedReaderMarkup ? null : (
                <div className="space-y-6">
                  {visibleArticles.map((article) => {
                    const blocks = buildArticleBlocks(article);
                    const displayBlocks = showLegalTextNotes
                      ? blocks
                      : blocks.filter((block) => !block.isLegalNote);
                    const teacherComments = resolveArticleTeacherComments(law, article);
                    const jurisprudence = resolveArticleJurisprudence(law, article);
                    const doctrine = Array.isArray(article.doutrina) ? article.doutrina : (Array.isArray(article.doctrine) ? article.doctrine : []);
                    const jurisprudenceNotes = Array.isArray(article.jurisprudenceNotes) ? article.jurisprudenceNotes : [];
                    const sumulas = Array.isArray(article.sumulas) ? article.sumulas : [];
                    const examTips = Array.isArray(law.examTips)
                      ? law.examTips.filter((tip) => String(tip.articleId || '') === String(article.id))
                      : [];
                    const examTip = String(article.examTip || article.macete || '').trim();
                    const inlineNotesByBlock = activeTab === 'law' && showEditorialAnnotations
                      ? groupInlineNotesByBlock(
                        displayBlocks,
                        buildInlineLegalNotes({
                          article,
                          teacherComments,
                          doctrine,
                          jurisprudenceNotes,
                          jurisprudence,
                          sumulas,
                          examTips,
                          fallbackExamTip: examTip,
                        })
                          .map(applyInlineLegalNoteAccess)
                          .filter((note): note is InlineLegalNote => Boolean(note)),
                      )
                      : new Map<string, InlineLegalNote[]>();

                    return (
                      <article key={article.id} className="space-y-4 pb-6 outline-none focus:outline-none focus-visible:outline-none" style={fontSizeStyle}>
                        <div className="flex items-start justify-between gap-4">
                          <h3 className="text-xl font-black tracking-tight text-slate-900 dark:text-slate-100">
                            Art. {getArticleNumber(article) || '-'}
                          </h3>
                          <span className="inline-flex h-7 min-w-[28px] items-center justify-center rounded-full bg-indigo-100 px-2 text-xs font-black text-[#615fff] dark:bg-indigo-500/20">
                            {Math.max(blocks.length - 1, 1)}
                          </span>
                        </div>

                        <div className="space-y-3 font-medium leading-7 text-slate-800 dark:text-slate-100">
                          {displayBlocks.map((block) => {
                            const blockNotes = inlineNotesByBlock.get(block.id) || [];
                            const blockIndentClass = getLegalBlockIndentClass(block.indentLevel);

                            return (
                              <React.Fragment key={block.id}>
                                <div className={`group rounded-xl p-2 transition-colors hover:bg-indigo-50/40 focus:outline-none focus-visible:outline-none dark:hover:bg-indigo-500/10 ${blockIndentClass}`}>
                                  <div className="flex flex-col gap-2">
                                    {block.isLegalNote ? (
                                      <small className="block min-w-0 w-full text-justify text-xs font-semibold leading-5 text-slate-500 dark:text-slate-400">
                                        {block.label ? (
                                          <strong className="font-black text-slate-600 dark:text-slate-300">
                                            {block.label}
                                          </strong>
                                        ) : null}
                                        {block.text ? `${block.label ? ' ' : ''}${block.text}` : ''}
                                      </small>
                                    ) : (
                                      <p className="min-w-0 w-full text-justify">
                                        {block.label ? (
                                          <strong className="font-black text-slate-900 dark:text-slate-100">
                                            {block.label}
                                          </strong>
                                        ) : null}
                                        {block.text ? `${block.label ? ' ' : ''}${block.text}` : ''}
                                      </p>
                                    )}
                                  </div>
                                </div>

                                {blockNotes.length ? (
                                  <div className="space-y-2">
                                    {blockNotes.map((note) => (
                                      <CalloutBlock
                                        key={note.id}
                                        tone={note.tone}
                                        title={note.title}
                                        body={note.body}
                                        blocks={note.blocks}
                                        reactionKey={note.reactionKey || `inline-note:${note.id}`}
                                        initialLikes={Number(note.likes || 0)}
                                        initialDislikes={Number(note.dislikes || 0)}
                                        initialReaction={note.userReaction}
                                        hideReaction={note.isLocked}
                                        isLocked={note.isLocked}
                                        lockedFeatureLabel={note.lockedFeatureLabel}
                                        lockedRequiredPlan={note.lockedRequiredPlan}
                                        actionLabel={note.actionLabel}
                                      />
                                    ))}
                                  </div>
                                ) : null}
                              </React.Fragment>
                            );
                          })}
                        </div>
                      </article>
                    );
                  })}
                </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </section>
      )}

      {activeTab === 'analysis' ? (
        hasSectionDeepAnalysis ? (
        !canViewDeepAnalysis ? (
          <section ref={analysisContentSectionRef} className={`${PLATFORM_SURFACE_CARD_CLASS} p-6`}>
            <LegalFeatureFallbackPanel
              title="Desbloqueie a análise estratégica desta seção"
              description="Veja resumo, pontos de prova, macetes, doutrina e jurisprudência organizados para transformar a leitura em revisão objetiva."
              requiredPlan={getLegalFeatureRequiredPlanLabel('lei.raiox')}
              mode={analysisFeatureMode}
              previewItems={['Pontos-chave', 'Como cai em prova', 'Macetes', 'Jurisprudência']}
            />
          </section>
        ) : (
        <section ref={analysisContentSectionRef} className={`${PLATFORM_SURFACE_CARD_CLASS} overflow-hidden`}>
          <button
            type="button"
            onClick={() => setIsDeepAnalysisOpen((state) => !state)}
            className="flex w-full items-center justify-between px-5 py-4 text-left"
          >
            <span className="text-sm font-black text-slate-900 dark:text-slate-100">Análise aprofundada</span>
            <ChevronDown size={16} className={`text-slate-400 transition-transform ${isDeepAnalysisOpen ? 'rotate-180' : ''}`} />
          </button>
          {isDeepAnalysisOpen ? (
            <div className="border-t border-slate-200 p-5 dark:border-slate-700">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
                <div className="max-w-3xl">
                  <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#615fff]">
                    Análise da seção
                  </p>
                  <h3 className="mt-1 text-2xl font-black tracking-tight text-slate-900 dark:text-slate-100">
                    {sectionEditorial?.sectionTitle || sectionName || law.shortTitle}
                  </h3>
                  <p className="mt-2 text-sm font-medium text-slate-500 dark:text-slate-300">
                    {sectionEditorial?.rangeLabel || activeSectionLabel}
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                  <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 dark:border-slate-700 dark:bg-slate-900">
                    <p className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-500">Artigos</p>
                    <p className="mt-1 text-lg font-black text-slate-900 dark:text-slate-100">
                      {sectionEditorial?.articleCount || activeSectionArticles.length}
                    </p>
                  </div>
                  {sectionJurisprudence.length ? (
                    <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 dark:border-slate-700 dark:bg-slate-900">
                      <p className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-500">Jurisprudências</p>
                      <p className="mt-1 text-lg font-black text-slate-900 dark:text-slate-100">
                        {sectionJurisprudence.length}
                      </p>
                    </div>
                  ) : null}
                  {sectionSumulas.length ? (
                    <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 dark:border-slate-700 dark:bg-slate-900">
                      <p className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-500">Súmulas</p>
                      <p className="mt-1 text-lg font-black text-slate-900 dark:text-slate-100">
                        {sectionSumulas.length}
                      </p>
                    </div>
                  ) : null}
                </div>
              </div>

              {sectionAnalysisContent ? (
                <div className="mt-5 rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900">
                  <MathRichText
                    content={sectionAnalysisContent}
                    className="text-sm font-medium leading-7 text-slate-700 dark:text-slate-200"
                  />
                </div>
              ) : null}

              {showLegacySectionAnalysisDetails ? (
              <div className="mt-5 grid gap-4 xl:grid-cols-[minmax(0,1.35fr)_minmax(0,0.85fr)]">
                <div className="space-y-4">
                  {sectionSummary ? (
                    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900">
                      <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">Resumo da seção</p>
                      <MathRichText
                        content={sectionSummary}
                        className="mt-3 text-sm font-medium leading-7 text-slate-700 dark:text-slate-200"
                      />
                    </div>
                  ) : null}

                  {sectionExamFocus.length ? (
                    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900">
                      <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">Como cai em prova</p>
                      <div className="mt-3 space-y-2">
                        {sectionExamFocus.map((item, index) => (
                          <div key={`section-exam-${index}`} className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-medium leading-6 text-slate-700 dark:border-slate-700 dark:bg-slate-950/60 dark:text-slate-200">
                            <MathRichText content={item} className="text-sm font-medium leading-6 text-slate-700 dark:text-slate-200" />
                            <div className="mt-2 flex justify-end">
                              <ReactionControls storageKey={`section-exam:${activeSection?.id || 'section'}:${index}`} />
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : null}

                  {sectionHighlights.length ? (
                    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900">
                      <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">Pontos-chave da seção</p>
                      <div className="mt-3 space-y-2">
                        {sectionHighlights.map((item, index) => (
                          <div key={`section-highlight-${item.articleId || index}`} className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-3 dark:border-slate-700 dark:bg-slate-950/60">
                            <p className="text-[10px] font-black uppercase tracking-[0.16em] text-[#615fff]">
                              {item.articleNumber ? `Art. ${item.articleNumber}` : 'Artigo'}
                            </p>
                            {item.title ? (
                              <p className="mt-1 text-sm font-bold text-slate-900 dark:text-slate-100">
                                {item.title}
                              </p>
                            ) : null}
                            {item.excerpt ? (
                              <MathRichText content={item.excerpt} className="mt-1 text-sm font-medium leading-6 text-slate-600 dark:text-slate-300" />
                            ) : null}
                            <div className="mt-2 flex justify-end">
                              <ReactionControls storageKey={`section-highlight:${activeSection?.id || 'section'}:${item.articleId || index}`} />
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : null}
                </div>

                <div className="space-y-4">
                  {sectionMacetes.length ? (
                    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900">
                      <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">Macetes</p>
                      <div className="mt-3 space-y-2">
                        {sectionMacetes.map((item, index) => (
                          <div key={`section-macete-${index}`} className="rounded-lg border border-[#615fff]/15 bg-[#615fff]/5 px-3 py-2 text-sm font-medium leading-6 text-slate-700 dark:border-[#615fff]/25 dark:bg-[#615fff]/10 dark:text-slate-100">
                            <MathRichText content={item} className="text-sm font-medium leading-6 text-slate-700 dark:text-slate-100" />
                            <div className="mt-2 flex justify-end">
                              <ReactionControls storageKey={`section-macete:${activeSection?.id || 'section'}:${index}`} />
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : null}

                  {sectionDoctrine.length ? (
                    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900">
                      <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">Doutrina</p>
                      <div className="mt-3 space-y-2">
                        {sectionDoctrine.map((item, index) => (
                          <div key={`section-doctrine-${index}`} className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm font-medium leading-6 text-amber-900 dark:border-amber-500/25 dark:bg-amber-500/10 dark:text-amber-100">
                            <MathRichText content={item} className="text-sm font-medium leading-6 text-amber-900 dark:text-amber-100" />
                            <div className="mt-2 flex justify-end">
                              <ReactionControls storageKey={`section-doctrine:${activeSection?.id || 'section'}:${index}`} />
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : null}

                  {sectionJurisprudence.length || sectionSumulas.length ? (
                    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900">
                      <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">Jurisprudência e súmulas</p>
                      <div className="mt-3 space-y-3">
                        {sectionJurisprudence.length ? (
                          <div>
                            <p className="text-[10px] font-black uppercase tracking-[0.16em] text-sky-500">Jurisprudência</p>
                            <div className="mt-2 space-y-2">
                              {sectionJurisprudence.map((entry, index) => (
                                <div key={`section-juris-${entry.id || index}`} className="rounded-lg border border-sky-200 bg-sky-50 px-3 py-2 text-sm font-medium leading-6 text-sky-900 dark:border-sky-500/25 dark:bg-sky-500/10 dark:text-sky-100">
                                  <span className="font-black">{entry.court}</span>
                                  {entry.title ? ` • ${entry.title}` : ''}
                                  {entry.summary || entry.texto ? ` — ${entry.summary || entry.texto}` : ''}
                                  <div className="mt-2 flex justify-end">
                                    <ReactionControls storageKey={`section-juris:${activeSection?.id || 'section'}:${entry.id || index}`} />
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        ) : null}

                        {sectionSumulas.length ? (
                          <div>
                            <p className="text-[10px] font-black uppercase tracking-[0.16em] text-emerald-500">Súmulas</p>
                            <div className="mt-2 space-y-2">
                              {sectionSumulas.map((entry, index) => (
                                <div key={`section-sumula-${entry.id || index}`} className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-medium leading-6 text-emerald-900 dark:border-emerald-500/25 dark:bg-emerald-500/10 dark:text-emerald-100">
                                  <span className="font-black">{entry.court}</span>
                                  {entry.number || entry.numero ? ` • ${entry.number || entry.numero}` : ''}
                                  {entry.text || entry.texto ? ` — ${entry.text || entry.texto}` : ''}
                                  <div className="mt-2 flex justify-end">
                                    <ReactionControls storageKey={`section-sumula:${activeSection?.id || 'section'}:${entry.id || index}`} />
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        ) : null}
                      </div>
                    </div>
                  ) : null}
                </div>
              </div>
              ) : null}
            </div>
          ) : null}
        </section>
        )
        ) : (
          <section ref={analysisContentSectionRef} className={`${PLATFORM_SURFACE_CARD_CLASS} p-6 text-center`}>
            <BookOpen size={28} className="mx-auto text-slate-300 dark:text-slate-600" />
            <h2 className="mt-3 text-lg font-black text-slate-900 dark:text-slate-100">Análise detalhada indisponível</h2>
            <p className="mx-auto mt-2 max-w-xl text-sm font-medium text-slate-500 dark:text-slate-300">
              Esta seção ainda não possui análise detalhada publicada.
            </p>
            <button
              type="button"
              onClick={openDetailedAnalysisRequestModal}
              className="mt-4 inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-[#615fff] px-4 text-sm font-black text-white transition-colors hover:bg-[#514dff]"
            >
              <MessageSquare size={14} />
              Solicitar análise detalhada
            </button>
          </section>
        )
      ) : null}

      <section className={`${PLATFORM_SURFACE_CARD_CLASS} grid gap-3 px-4 py-3 lg:grid-cols-[auto_minmax(0,1fr)_auto] lg:items-center`}>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            disabled={!previousSection}
            onClick={() => previousSection && changeSection(previousSection.id)}
            className="inline-flex h-9 items-center gap-1 rounded-lg border border-slate-200 bg-white px-3 text-xs font-black text-slate-600 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
          >
            <ArrowLeft size={12} />
            Capítulo anterior
          </button>
          <button
            type="button"
            onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
            className="inline-flex h-9 items-center gap-1 rounded-lg border border-slate-200 bg-white px-3 text-xs font-black text-slate-600 transition-colors hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
          >
            Voltar ao topo
          </button>
        </div>
        <div className="grid grid-cols-2 gap-1 rounded-xl border border-slate-200 bg-slate-50 p-1 dark:border-slate-700 dark:bg-slate-900 sm:grid-cols-4">
          {([
            { key: 'comments', label: 'Comentários' },
            { key: 'law', label: 'Conteúdo da lei' },
            { key: 'analysis', label: 'Análise detalhada' },
            { key: 'questions', label: 'Questões' },
          ] as const).map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => handleBottomTabChange(tab.key)}
              className={`inline-flex h-9 min-w-0 items-center justify-center gap-2 rounded-lg px-2 text-[11px] font-bold transition-colors sm:text-xs ${
                activeTab === tab.key
                  ? 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900'
                  : 'text-slate-500 hover:bg-white dark:text-slate-300 dark:hover:bg-slate-800'
              }`}
            >
              <span className="truncate">{tab.label}</span>
              {tab.key === 'comments' && sectionUserComments.length > 0 ? (
                <span className={`inline-flex min-w-5 items-center justify-center rounded-full px-1.5 py-0.5 text-[9px] font-black ${
                  activeTab === tab.key
                    ? 'bg-white/20 text-current dark:bg-slate-900/20'
                    : 'bg-[#615fff]/10 text-[#514dff] dark:bg-[#615fff]/20 dark:text-indigo-200'
                }`}>
                  {sectionUserComments.length}
                </span>
              ) : null}
            </button>
          ))}
        </div>
        <button
          type="button"
          disabled={!nextSection}
          onClick={() => nextSection && changeSection(nextSection.id)}
          className="inline-flex h-9 items-center gap-1 rounded-lg border border-slate-200 bg-white px-3 text-xs font-black text-slate-600 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
        >
          Próximo capítulo
          <ArrowRight size={12} />
        </button>
      </section>

      {sectionReportModalOpen ? (
        <div className="fixed inset-0 z-[90] flex items-center justify-center bg-slate-950/45 px-4 py-6 backdrop-blur-sm">
          <div className={`${PLATFORM_SURFACE_CARD_CLASS} w-full max-w-lg p-5`}>
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className={`text-[10px] font-black uppercase tracking-[0.18em] ${
                  sectionSupportActionMode === 'report' ? 'text-red-500' : 'text-[#615fff]'
                }`}>
                  {sectionSupportActionMode === 'report' ? 'Reportar erro' : 'Suporte'}
                </p>
                <h2 className="mt-1 text-lg font-black text-slate-900 dark:text-slate-100">{sectionReportTitle}</h2>
                <p className="mt-1 text-sm font-medium text-slate-500 dark:text-slate-300">
                  {sectionSupportActionMode === 'report'
                    ? 'Informe o ponto que precisa ser revisado pela moderação.'
                    : 'Vincule ao item desejado quando a solicitação for sobre um artigo, inciso, parágrafo ou alínea.'}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSectionReportModalOpen(false)}
                className="grid h-8 w-8 place-items-center rounded-lg border border-slate-200 text-slate-500 transition-colors hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
                aria-label="Fechar"
              >
                ×
              </button>
            </div>
            <div className="mt-4 space-y-3">
              <label className="block">
                <span className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-500">Vincular ao item</span>
                <select
                  value={sectionSupportTargetId}
                  onChange={(event) => setSectionSupportTargetId(event.target.value)}
                  className="mt-1 h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 outline-none focus:border-[#615fff]/45 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                >
                  {sectionTargetOptions.map((target) => (
                    <option key={target.id} value={target.id}>{target.label}</option>
                  ))}
                </select>
              </label>
              <label className="block">
                <span className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-500">
                  {sectionSupportActionMode === 'report' ? 'Tipo de erro' : 'Tipo de solicitação'}
                </span>
                <select
                  value={sectionReportReason}
                  onChange={(event) => setSectionReportReason(event.target.value)}
                  className="mt-1 h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 outline-none focus:border-[#615fff]/45 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                >
                  {sectionSupportActionMode === 'report' ? (
                    <>
                      <option>Erro no texto da lei</option>
                      <option>Comentário incorreto</option>
                      <option>Jurisprudência ou súmula incorreta</option>
                      <option>Problema de formatação</option>
                      <option>Outro</option>
                    </>
                  ) : sectionSupportActionMode === 'analysis_request' ? (
                    <>
                      <option>Solicitar análise detalhada</option>
                      <option>Solicitar análise de jurisprudência</option>
                      <option>Solicitar análise de incidência em prova</option>
                    </>
                  ) : (
                    <>
                      <option>Solicitar comentário do professor</option>
                      <option>Solicitar comentário no artigo</option>
                      <option>Solicitar comentário no inciso/parágrafo/alínea</option>
                    </>
                  )}
                </select>
              </label>
              <label className="block">
                <span className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-500">
                  {sectionSupportActionMode === 'report' ? 'Detalhes' : 'Observações'}
                </span>
                <textarea
                  value={sectionReportDetails}
                  onChange={(event) => setSectionReportDetails(event.target.value)}
                  rows={5}
                  placeholder={sectionSupportActionMode === 'report'
                    ? 'Ex.: o inciso II está duplicado, há erro de digitação ou o comentário não corresponde ao artigo.'
                    : 'Opcional: explique o ponto que você quer que a equipe analise.'}
                  className="mt-1 w-full resize-none rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 outline-none focus:border-[#615fff]/45 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                />
              </label>
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setSectionReportModalOpen(false)}
                className="inline-flex h-9 items-center justify-center rounded-lg border border-slate-200 px-4 text-xs font-black text-slate-600 transition-colors hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => void submitSectionReport()}
                disabled={isReportingSection || (sectionSupportActionMode === 'report' && !sectionReportDetails.trim())}
                className={`inline-flex h-9 items-center gap-2 rounded-lg px-4 text-xs font-black text-white transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${
                  sectionSupportActionMode === 'report'
                    ? 'bg-red-600 hover:bg-red-700'
                    : 'bg-[#615fff] hover:bg-[#514dff]'
                }`}
              >
                {isReportingSection ? (
                  <Loader2 size={14} className="animate-spin" />
                ) : sectionSupportActionMode === 'report' ? (
                  <Flag size={14} />
                ) : (
                  <MessageSquare size={14} />
                )}
                {sectionSupportActionMode === 'report' ? 'Enviar reporte' : 'Enviar solicitação'}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <UpgradeModal
        isOpen={readerSaveUpgradeOpen}
        onClose={() => setReaderSaveUpgradeOpen(false)}
        requiredPlan={readerAnnotationsRequiredPlan}
        featureName="marcações e anotações na Lei Comentada"
      />

      <UpgradeModal
        isOpen={Boolean(legalFeatureUpgradeModal)}
        onClose={() => setLegalFeatureUpgradeModal(null)}
        requiredPlan={legalFeatureUpgradeModal?.requiredPlan || 'Elite'}
        featureName={legalFeatureUpgradeModal?.featureName || 'recurso da Lei Comentada'}
      />

      <footer className="text-center text-xs font-semibold text-slate-400 dark:text-slate-500">
        Lei nº {law.number || '-'} - {law.shortTitle}. Este conteúdo não substitui o texto oficial da legislação.
      </footer>
    </div>
  );
};

export default LawDetailPage;
