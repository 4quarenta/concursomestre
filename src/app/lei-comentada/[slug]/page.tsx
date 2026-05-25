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
  BookOpen,
  Bold,
  ChevronDown,
  ChevronRight,
  CheckCircle2,
  Crown,
  Eraser,
  Eye,
  FileText,
  Flag,
  Highlighter,
  Italic,
  Loader2,
  MessageSquare,
  Minus,
  Plus,
  RotateCcw,
  Save,
  Search,
  Share2,
  Star,
  Table,
  Trash2,
  Underline,
  Zap,
} from 'lucide-react';
import { useAuth } from '@providers/AuthProvider';
import { useToast } from '@providers/ToastProvider';
import MathRichText from '@/components/shared/math/MathRichText';
import RichTextEditor from '@/components/shared/ui/RichTextEditor';
import { getAssetUrl } from '@services/api';
import {
  PLATFORM_PAGE_DESCRIPTION_CLASS,
  PLATFORM_PAGE_TITLE_CLASS,
  PLATFORM_SURFACE_CARD_CLASS,
} from '@constants/layout';
import { legalCommentaryApiService } from '@services/legal-commentary';
import { reportsService } from '@services/reports';
import { questionService } from '@services/questions';
import { normalizeQuestionRichHtml } from '@services/questions/questionHtmlSanitizer';
import type {
  ArticleJurisprudence,
  LegalRichContentBlock,
  LegalUserComment,
  LawArticle,
  LawDetail,
  LawSection,
  LawSectionEditorial,
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

type ReadingTab = 'comments' | 'law' | 'questions';
type CalloutTone = 'teacher' | 'doctrine' | 'juris' | 'tip' | 'question';
type LawSectionSummary = LawSection & {
  sectionKey?: string;
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
};

type InlineLegalNote = {
  id: string;
  tone: CalloutTone;
  title: string;
  body: string;
  referenceText: string;
  blocks?: LegalRichContentBlock[];
};

type RelatedQuestionsState = {
  status: 'idle' | 'loading' | 'ready' | 'error';
  rows: Question[];
  total: number;
  error?: string;
};

const getUserId = (user: CurrentUserLike) => user?.id || user?.userId || user?.email || null;

const normalizeText = (value: unknown) => String(value || '')
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .toLowerCase()
  .trim();

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

const truncateText = (value: unknown, maxLength = 220) => {
  const text = stripRichText(value);
  return text.length > maxLength ? `${text.slice(0, maxLength - 1).trim()}…` : text;
};

type SectionReadingState = Record<string, { startedAt?: string; completedAt?: string }>;

const getSectionReadingStorageKey = (userKey: string, lawId: string) => `cm:legal-commentary:section-reading:${userKey}:${lawId}`;
const getSectionFavoriteStorageKey = (userKey: string, lawId: string) => `cm:legal-commentary:favorite-sections:${userKey}:${lawId}`;
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

const getSectionHeaderText = (article: LawArticle): string => {
  const raw = String(article.title || article.titulo || '').trim();
  if (!raw) return '';

  return raw
    .replace(/^(?:T[IÍ]TULO|CAP[IÍ]TULO|SE[CÇ][AÃ]O|SUBSE[CÇ][AÃ]O|LIVRO|PARTE)\s+[IVXLCDM0-9]+(?:\s*[---]\s*|\s+)/i, '')
    .replace(/\s+/g, ' ')
    .trim();
};

const getTitleMarker = (article: LawArticle): string => {
  return String(article.title || article.titulo || '').trim();
};

const buildArticleBlocks = (article: LawArticle): RenderableBlock[] => {
  const blocks = Array.isArray(article.blocks) ? article.blocks : [];
  if (blocks.length > 0) {
    return blocks
      .map((block, index) => ({
        id: `${article.id}-block-${index}`,
        sourceId: block.id,
        kind: block.kind || 'caput',
        label: String(block.label || '').trim(),
        text: String(block.text || '').trim(),
        isCaput: String(block.kind || '') === 'caput',
      }))
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
    });
  });

  return lines;
};

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
  jurisprudence,
  sumulas,
  examTip,
}: {
  article: LawArticle;
  teacherComments: TeacherComment[];
  doctrine: string[];
  jurisprudence: ArticleJurisprudence[];
  sumulas: NonNullable<LawArticle['sumulas']>;
  examTip: string;
}): InlineLegalNote[] => {
  const articleNumber = getArticleNumber(article);

  return [
    ...teacherComments.map((comment) => ({
      id: `teacher-${comment.id}`,
      tone: 'teacher' as const,
      title: comment.title || 'Comentário do professor',
      body: String(comment.body || comment.texto || '').trim(),
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
    })),
    ...doctrine.map((text, index) => ({
      id: `doctrine-${article.id}-${index}`,
      tone: 'doctrine' as const,
      title: 'Doutrina',
      body: String(text || '').trim(),
      referenceText: text,
    })),
    ...jurisprudence.map((entry, index) => ({
      id: `juris-${entry.id || `${article.id}-${index}`}`,
      tone: 'juris' as const,
      title: entry.title ? `Jurisprudência: ${entry.title}` : 'Jurisprudência',
      body: String(entry.summary || entry.texto || entry.examImpact || '').trim(),
      referenceText: [entry.title, entry.summary, entry.texto, entry.examImpact, entry.court, entry.precedentType].join(' '),
    })),
    ...sumulas.map((sumula, index) => ({
      id: `sumula-${sumula.id || `${article.id}-${index}`}`,
      tone: 'juris' as const,
      title: sumula.number ? `Súmula ${sumula.number}` : 'Súmula',
      body: String(sumula.text || sumula.texto || '').trim(),
      referenceText: [sumula.number, sumula.numero, sumula.text, sumula.texto, sumula.court, sumula.tribunal].join(' '),
    })),
    ...(examTip ? [{
      id: `tip-${article.id}-${articleNumber || 'article'}`,
      tone: 'tip' as const,
      title: 'Macete',
      body: examTip,
      referenceText: examTip,
    }] : []),
  ].filter((note) => note.body);
};

const SpinnerBlock: React.FC<{ label: string }> = ({ label }) => (
  <div className="flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-5 text-sm font-bold text-slate-500 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300">
    <Loader2 size={16} className="animate-spin text-[#615fff]" />
    <span>{label}</span>
  </div>
);

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
    disabled={disabled}
    onMouseDown={(event) => {
      event.preventDefault();
      if (!disabled) {
        onPress();
      }
    }}
    className={`grid h-8 min-w-8 shrink-0 place-items-center rounded-lg border px-2 text-xs font-black transition-colors disabled:cursor-not-allowed disabled:opacity-50 sm:h-9 sm:min-w-9 ${
      active
        ? 'border-[#615fff]/35 bg-[#615fff]/10 text-[#514dff]'
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
    onMouseDown={(event) => {
      event.preventDefault();
      onPress();
    }}
    className={`grid h-7 w-7 shrink-0 place-items-center rounded-lg border bg-white transition-transform hover:scale-105 dark:bg-slate-900 sm:h-8 sm:w-8 ${
      active ? 'border-[#615fff] ring-2 ring-[#615fff]/20' : 'border-slate-200 dark:border-slate-700'
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
    <article className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition-colors hover:border-[#615fff]/35 dark:border-slate-700 dark:bg-slate-900">
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

          <div className="mt-3 flex gap-3">
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

  return (
    <div className="mt-2 space-y-3">
      {visibleBlocks.map((block, index) => {
        const title = String(block.title || '').trim();
        const content = String(block.content || '').trim();
        const items = (block.items || []).map((item) => String(item || '').trim()).filter(Boolean);
        const headers = (block.headers || []).map((item) => String(item || '').trim()).filter(Boolean);
        const rows = (block.rows || []).filter((row) => Array.isArray(row) && row.some((cell) => String(cell || '').trim()));

        if (block.type === 'table' && rows.length > 0) {
          return (
            <div key={`${block.type}-${index}`} className="overflow-hidden rounded-lg border border-current/15">
              {title ? <p className="px-3 py-2 text-xs font-black uppercase tracking-[0.12em]">{title}</p> : null}
              <table className="w-full border-collapse text-left text-xs">
                {headers.length > 0 ? (
                  <thead className="bg-white/45 dark:bg-slate-950/25">
                    <tr>
                      {headers.map((header, headerIndex) => (
                        <th key={`${header}-${headerIndex}`} className="border-t border-current/10 px-3 py-2 font-black">
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
                        <td key={`cell-${cellIndex}`} className="border-t border-current/10 px-3 py-2 align-top font-semibold">
                          <MathRichText content={String(cell || '')} className="text-xs leading-5" />
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
          <div key={`${block.type}-${index}`} className="rounded-lg border border-current/10 bg-white/35 px-3 py-2 dark:bg-slate-950/20">
            {title ? <p className="text-[10px] font-black uppercase tracking-[0.12em]">{title}</p> : null}
            {content ? <MathRichText content={content} className="mt-1 text-sm font-semibold leading-6" /> : null}
            {items.length > 0 ? (
              <ul className="mt-2 list-disc space-y-1 pl-5 text-sm font-semibold leading-6">
                {items.map((item, itemIndex) => (
                  <li key={`${item}-${itemIndex}`}>
                    <MathRichText content={item} className="text-sm font-semibold leading-6" />
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
}> = ({ tone, title, body, blocks, actionLabel }) => {
  const toneClass: Record<CalloutTone, string> = {
    teacher: 'border-indigo-200 bg-indigo-50/75 text-indigo-900 dark:border-indigo-500/30 dark:bg-indigo-500/10 dark:text-indigo-100',
    doctrine: 'border-amber-200 bg-amber-50/75 text-amber-900 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-100',
    juris: 'border-sky-200 bg-sky-50/75 text-sky-900 dark:border-sky-500/30 dark:bg-sky-500/10 dark:text-sky-100',
    tip: 'border-emerald-200 bg-emerald-50/75 text-emerald-900 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-100',
    question: 'border-fuchsia-200 bg-fuchsia-50/75 text-fuchsia-900 dark:border-fuchsia-500/30 dark:bg-fuchsia-500/10 dark:text-fuchsia-100',
  };

  return (
    <aside className={`ml-4 rounded-xl border px-4 py-3 ${toneClass[tone]}`}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-[10px] font-black uppercase tracking-[0.14em]">Nota: {title}</p>
        {actionLabel ? (
          <span className="text-xs font-bold">{actionLabel} <ArrowRight size={12} className="inline-block" /></span>
        ) : null}
      </div>
      <RichLegalContentBlocks blocks={blocks} />
      {(!blocks || blocks.length === 0) && body ? (
        <MathRichText content={body} className="mt-2 text-sm font-semibold leading-6" />
      ) : null}
    </aside>
  );
};

const LawDetailPage: React.FC = () => {
  const params = useParams<{ slug: string }>();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { currentUser } = useAuth();
  const { addToast } = useToast();
  const readerEditorRef = React.useRef<HTMLDivElement>(null);
  const readingContentSectionRef = React.useRef<HTMLElement>(null);
  const readerToolbarAnchorRef = React.useRef<HTMLDivElement>(null);
  const readerToolbarRef = React.useRef<HTMLElement>(null);
  const progressCompletionInFlightRef = React.useRef(false);

  const slug = String(params?.slug || '').trim();
  const userId = React.useMemo(() => String(getUserId((currentUser as CurrentUserLike) || null) || ''), [currentUser]);

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
  const [isTogglingFavorite, setIsTogglingFavorite] = React.useState(false);
  const [isDeepAnalysisOpen, setIsDeepAnalysisOpen] = React.useState(true);
  const [favoriteSectionIds, setFavoriteSectionIds] = React.useState<Set<string>>(() => new Set());
  const [sectionReadingState, setSectionReadingState] = React.useState<SectionReadingState>({});
  const [isReportingSection, setIsReportingSection] = React.useState(false);
  const [sectionReportModalOpen, setSectionReportModalOpen] = React.useState(false);
  const [sectionReportReason, setSectionReportReason] = React.useState('Erro no texto da lei');
  const [sectionReportDetails, setSectionReportDetails] = React.useState('');
  const [commentBody, setCommentBody] = React.useState('');
  const [isSubmittingComment, setIsSubmittingComment] = React.useState(false);
  const [savedReaderMarkupHtml, setSavedReaderMarkupHtml] = React.useState('');
  const [readerMarkupVersion, setReaderMarkupVersion] = React.useState(0);
  const [readerActiveCommands, setReaderActiveCommands] = React.useState({
    bold: false,
    italic: false,
    underline: false,
  });
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

  const loadLaw = React.useCallback(async (options?: { force?: boolean }) => {
    if (!slug) {
      setLaw(null);
      setIsLoading(false);
      setLoadError('Lei não encontrada.');
      return;
    }

    setIsLoading(true);
    setLoadError('');
    try {
      const detail = await legalCommentaryApiService.getLawDetail(slug, options);
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
  }, [slug]);

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

    return (law.sections || []).map((section): LawSectionSummary => {
      const sectionArticles = articlesBySection.get(String(section.id)) || [];
      const articleIds = sectionArticles.map((article) => String(article.id));
      return {
        ...section,
        id: String(section.id),
        lawId: String(section.lawId || law.id),
        title: String(section.displayTitle || section.title || 'Secao da lei'),
        displayTitle: String(section.displayTitle || section.title || 'Secao da lei'),
        sectionKey: String(section.slug || section.id),
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
      const byId = sections.find((section) => String(section.id) === sectionQueryId || String(section.sectionKey || '') === sectionQueryId);
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

  const completedSectionKeys = React.useMemo(() => new Set(sections
    .filter((section) => {
      if (backendProgressPercent >= 100) {
        return true;
      }

      if (getSectionReadingEntry(sectionReadingState, section)?.completedAt) {
        return true;
      }

      const articleIds = (section.articleIds || []).map((id) => String(id)).filter(Boolean);
      return articleIds.length > 0 && articleIds.every((id) => backendViewedArticleIds.has(id));
    })
    .map((section) => buildSectionReadingKey(section))), [backendProgressPercent, backendViewedArticleIds, sectionReadingState, sections]);

  const sectionProgressPercent = sections.length > 0
    ? Math.round((completedSectionKeys.size / sections.length) * 100)
    : 0;
  const activeSectionReading = activeSection ? getSectionReadingEntry(sectionReadingState, activeSection) : undefined;
  const isActiveSectionFavorite = Boolean(activeSection && favoriteSectionIds.has(activeSection.id));
  const isActiveSectionCompleted = Boolean(activeSectionReadingKey && completedSectionKeys.has(activeSectionReadingKey));
  const activeSectionActionLabel = isActiveSectionCompleted
    ? 'Ler novamente'
    : activeSectionReading?.startedAt
      ? 'Continuar lendo'
      : 'Começar leitura';

  const sectionUserComments = React.useMemo(() => {
    if (!law || activeSectionArticleIds.size === 0) return [];

    return (Array.isArray(law.userComments) ? law.userComments : [])
      .filter((comment) => (
        activeSectionArticleIds.has(String(comment.articleId))
        && comment.status !== 'deleted'
        && (comment.status !== 'hidden' || (comment.moderationStatus === 'pending' && String(comment.userId) === userId))
        && comment.moderationStatus !== 'spam'
      ))
      .sort((left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime());
  }, [activeSectionArticleIds, law, userId]);

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

  const readingStorageLawId = law ? (requestedLawId || law.id) : '';

  React.useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      if (!readingStorageLawId || !userId) {
        setFavoriteSectionIds(new Set());
        setSectionReadingState({});
        return;
      }

      setFavoriteSectionIds(readFavoriteSectionIds(userId, readingStorageLawId));
      setSectionReadingState(readSectionReadingState(userId, readingStorageLawId));
    });

    return () => window.cancelAnimationFrame(frame);
  }, [readingStorageLawId, userId]);

  React.useEffect(() => {
    if (!law || !activeSection || !activeSectionReadingKey || !readingStorageLawId || !userId) return;

    const frameId = window.requestAnimationFrame(() => {
      setSectionReadingState((current) => {
        if (getSectionReadingEntry(current, activeSection)?.startedAt) {
          return current;
        }

        const next = {
          ...current,
          [activeSectionReadingKey]: {
            ...current[activeSectionReadingKey],
            startedAt: new Date().toISOString(),
          },
          [activeSection.id]: {
            ...current[activeSection.id],
            startedAt: new Date().toISOString(),
          },
        };
        saveSectionReadingState(userId, readingStorageLawId, next);
        return next;
      });
    });

    return () => window.cancelAnimationFrame(frameId);
  }, [activeSection, activeSectionReadingKey, law, readingStorageLawId, userId]);

  React.useEffect(() => {
    if (activeTab !== 'questions' || !law) {
      return;
    }

    let isActive = true;
    const fetchRelatedQuestions = async () => {
      setRelatedQuestionsState((current) => ({ ...current, status: 'loading', error: undefined }));
      try {
        const baseFilters = {
          page: 1,
          limit: 6,
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
  }, [activeTab, law, relatedQuestionScope]);

  const visibleArticles = React.useMemo(() => {
    if (!law) return [];
    const normalizedTerm = normalizeText(searchTerm);
    return activeSectionArticles.filter((article) => {
      if (!normalizedTerm) return true;

      const textHaystack = normalizeText([
        article.number,
        article.title,
        article.text,
        article.texto,
        ...getArticleTextLines(article),
        ...resolveArticleTeacherComments(law, article).map((entry) => entry.body || entry.texto),
        ...resolveArticleJurisprudence(law, article).map((entry) => entry.summary || entry.texto),
      ].join(' '));

      return textHaystack.includes(normalizedTerm);
    });
  }, [activeSectionArticles, law, searchTerm]);

  const sectionEditorial = React.useMemo<LawSectionEditorial | null>(() => {
    if (!law || !activeSection) {
      return null;
    }

    const currentSectionId = String(activeSection.id || '');
    const currentSectionKey = normalizeText(activeSection.sectionKey || activeSection.id || activeSection.title);
    const currentRangeLabel = activeSection.fromArticle === activeSection.toArticle
      ? `Art. ${activeSection.fromArticle}`
      : `Art. ${activeSection.fromArticle} a Art. ${activeSection.toArticle}`;
    const persistedEditorial = Array.isArray(law.sectionEditorials)
      ? law.sectionEditorials.find((item) => (
        (item.sectionId && String(item.sectionId) === currentSectionId)
        || normalizeText(item.sectionKey) === currentSectionKey
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
  const sectionRichBlocks = React.useMemo(
    () => (sectionEditorial?.blocks || []).filter((block) => (
      String(block.content || '').trim()
      || (Array.isArray(block.items) && block.items.length > 0)
      || (Array.isArray(block.rows) && block.rows.length > 0)
    )),
    [sectionEditorial],
  );
  const hasSectionDeepAnalysis = Boolean(
    sectionSummary
    || sectionRichBlocks.length
    || sectionExamFocus.length
    || sectionMacetes.length
    || sectionDoctrine.length
    || sectionHighlights.length
    || sectionJurisprudence.length
    || sectionSumulas.length,
  );

  const progressPercent = Math.max(
    sectionProgressPercent,
    backendProgressPercent,
  );

  const currentSectionIndex = React.useMemo(() => {
    if (!activeSection) return -1;
    return sections.findIndex((section) => section.id === activeSection.id);
  }, [activeSection, sections]);

  const previousSection = currentSectionIndex > 0 ? sections[currentSectionIndex - 1] : null;
  const nextSection = currentSectionIndex >= 0 && currentSectionIndex < sections.length - 1
    ? sections[currentSectionIndex + 1]
    : null;

  const changeSection = React.useCallback((sectionId: string) => {
    if (!law) return;
    const section = sections.find((item) => String(item.id) === String(sectionId));
    if (!section) return;

    const query = new URLSearchParams(searchParams.toString());
    query.set('lawId', law.id);
    query.set('from', section.fromArticle);
    query.set('to', section.toArticle);
    query.set('view', 'pdf');
    query.delete('section');
    router.push(`/lei-comentada/${encodeURIComponent(law.slug)}?${query.toString()}`);
  }, [law, router, searchParams, sections]);

  const toggleSectionFavorite = React.useCallback(async () => {
    if (!law || !activeSection || isTogglingFavorite) return;
    if (!userId) {
      addToast('Entre na sua conta para favoritar seções.', 'warning');
      return;
    }

    setIsTogglingFavorite(true);
    const optimistic = !favoriteSectionIds.has(activeSection.id);
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
      const result = await legalCommentaryApiService.toggleFavorite('article', activeSection.id);
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
      addToast(result.isFavorite ? 'Seção adicionada aos favoritos.' : 'Seção removida dos favoritos.', 'success');
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
  }, [activeSection, addToast, favoriteSectionIds, isTogglingFavorite, law, userId]);

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

  const submitSectionReport = React.useCallback(async () => {
    if (!law || !activeSection || isReportingSection) return;
    if (!userId) {
      addToast('Entre na sua conta para reportar erro.', 'warning');
      return;
    }

    const details = sectionReportDetails.trim();
    if (!details) {
      addToast('Descreva rapidamente o erro encontrado.', 'warning');
      return;
    }

    setIsReportingSection(true);
    try {
      const result = await reportsService.createReport({
        reporterId: userId,
        targetType: 'law_section',
        targetId: activeSection.id,
        reason: sectionReportReason,
        details: [
          details,
          `Lei: ${law.shortTitle || law.title}`,
          `Seção: ${activeSection.title} (${activeSection.fromArticle}-${activeSection.toArticle})`,
        ].join('\n'),
        evidenceUrl: typeof window !== 'undefined' ? window.location.href : undefined,
      });

      if (result.duplicate) {
        addToast(result.message || 'Já existe um reporte pendente para esta seção.', 'warning');
      } else {
        addToast('Erro reportado para moderação.', 'success');
      }
      setSectionReportModalOpen(false);
      setSectionReportDetails('');
    } catch {
      addToast('Não foi possível reportar o erro agora.', 'error');
    } finally {
      setIsReportingSection(false);
    }
  }, [activeSection, addToast, isReportingSection, law, sectionReportDetails, sectionReportReason, userId]);

  const openOfficialPdf = React.useCallback(() => {
    if (typeof window === 'undefined') return;
    if (law?.officialUrl) {
      window.open(law.officialUrl, '_blank', 'noopener,noreferrer');
      return;
    }
    window.print();
  }, [law]);

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
      if (articleIds.length > 0) {
        await Promise.all(articleIds.map((articleId) => legalCommentaryApiService.recordArticleView(law.id, articleId)));
      } else {
        await legalCommentaryApiService.recordLawView(law.id);
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
        addToast('Seção marcada como lida.', 'success');
      }
    } catch {
      if (!options?.silent) {
        addToast('Não foi possível salvar o progresso agora.', 'error');
      }
    } finally {
      progressCompletionInFlightRef.current = false;
    }
  }, [activeSection, activeSectionArticles, activeSectionReadingKey, addToast, law, readingStorageLawId, userId]);

  const submitLegalComment = React.useCallback(async () => {
    if (!law || isSubmittingComment) return;
    if (!userId) {
      addToast('Entre na sua conta para comentar.', 'warning');
      return;
    }

    const targetArticleId = activeSection?.primaryArticleId || activeSectionArticles[0]?.id || '';
    const body = normalizeQuestionRichHtml(commentBody);
    if (!targetArticleId || !stripRichText(body)) return;

    setIsSubmittingComment(true);
    try {
      const result = await legalCommentaryApiService.addUserComment({
        articleId: targetArticleId,
        body,
      });
      const createdComment: LegalUserComment = result.comment || {
        id: result.id || `legal-comment-${Date.now()}`,
        articleId: targetArticleId,
        userId,
        userName: String(currentUser?.name || currentUser?.email || 'Aluno'),
        userAvatar: currentUser?.photoUrl,
        userPlan: String(currentUser?.planDisplayName || currentUser?.plan || 'Gratuito'),
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
      setCommentBody('');
      addToast(
        result.requiresModeration ? 'Comentário enviado para moderação.' : 'Comentário publicado.',
        'success',
      );
    } catch {
      addToast('Não foi possível enviar o comentário agora.', 'error');
    } finally {
      setIsSubmittingComment(false);
    }
  }, [activeSection, activeSectionArticles, addToast, commentBody, currentUser, isSubmittingComment, law, userId]);

  const reportLegalComment = React.useCallback(async (commentId: string) => {
    if (!userId) {
      addToast('Entre na sua conta para reportar comentários.', 'warning');
      return;
    }

    try {
      await legalCommentaryApiService.reportUserComment(commentId);
      addToast('Comentário reportado para moderação.', 'success');
    } catch {
      addToast('Não foi possível reportar o comentário agora.', 'error');
    }
  }, [addToast, userId]);

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

  const refreshReaderToolbarState = React.useCallback(() => {
    if (activeTab !== 'law' || typeof window === 'undefined') {
      return;
    }

    const range = getReaderSelectionRange();
    if (!range) {
      return;
    }

    const container = range.commonAncestorContainer;
    const element = container instanceof Element ? container : container.parentElement;
    if (!element) {
      return;
    }

    const computedStyle = window.getComputedStyle(element);
    const fontWeight = Number.parseInt(computedStyle.fontWeight, 10);
    const textColor = READER_TEXT_COLORS.find((colorOption) => hexToRgb(colorOption) === computedStyle.color) || '';
    const highlightColor = READER_HIGHLIGHT_COLORS.find((colorOption) => hexToRgb(colorOption) === computedStyle.backgroundColor) || '';

    setReaderActiveCommands({
      bold: Number.isNaN(fontWeight) ? ['bold', 'bolder'].includes(computedStyle.fontWeight) : fontWeight >= 600,
      italic: computedStyle.fontStyle === 'italic',
      underline: computedStyle.textDecorationLine.includes('underline'),
    });
    setReaderActiveTextColor(textColor);
    setReaderActiveHighlightColor(highlightColor);
  }, [activeTab, getReaderSelectionRange]);

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

  const unwrapReaderMarkupInRange = React.useCallback((range: Range) => {
    const editor = readerEditorRef.current;
    if (!editor || typeof document === 'undefined' || typeof NodeFilter === 'undefined') {
      return;
    }

    const walker = document.createTreeWalker(
      editor,
      NodeFilter.SHOW_ELEMENT,
      {
        acceptNode: (node) => {
          if (!(node instanceof HTMLElement) || !range.intersectsNode(node)) {
            return NodeFilter.FILTER_REJECT;
          }

          return node.dataset.readerMarkup === 'true'
            ? NodeFilter.FILTER_ACCEPT
            : NodeFilter.FILTER_SKIP;
        },
      },
    );

    const wrappers: HTMLElement[] = [];
    let currentNode = walker.nextNode();
    while (currentNode) {
      wrappers.push(currentNode as HTMLElement);
      currentNode = walker.nextNode();
    }

    wrappers.reverse().forEach((wrapper) => {
      wrapper.replaceWith(...Array.from(wrapper.childNodes));
    });
  }, []);

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
    const range = ensureReaderSelection(true);
    if (!range || range.collapsed || typeof document === 'undefined') return;

    if (command === 'removeFormat') {
      unwrapReaderMarkupInRange(range);
      setReaderActiveTextColor('');
      setReaderActiveHighlightColor('');
    } else {
      wrapReaderRangeTextNodes(range, () => {
        const span = document.createElement('span');
        if (command === 'bold') span.style.fontWeight = '700';
        if (command === 'italic') span.style.fontStyle = 'italic';
        if (command === 'underline') span.style.textDecoration = 'underline';
        return span;
      });
    }

    syncReaderMarkupFromDom();
    window.requestAnimationFrame(refreshReaderToolbarState);
  }, [ensureReaderSelection, refreshReaderToolbarState, syncReaderMarkupFromDom, unwrapReaderMarkupInRange, wrapReaderRangeTextNodes]);

  const applyReaderInlineStyle = React.useCallback((styleName: 'color' | 'backgroundColor', value: string) => {
    const range = ensureReaderSelection(true);
    if (!range || typeof document === 'undefined') return;

    const wrapper = wrapReaderRangeTextNodes(range, () => {
      const span = document.createElement('span');
      span.style[styleName] = value;
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
  }, [ensureReaderSelection, syncReaderMarkupFromDom, wrapReaderRangeTextNodes]);

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
    setReaderMarkupVersion((current) => current + 1);
    addToast('Marcações removidas. Texto original restaurado.', 'success');
  }, [addToast, readerMarkupKey]);

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
    return <SpinnerBlock label="Carregando lei comentada..." />;
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

  const firstSectionArticle = activeSectionArticles[0] || visibleArticles[0] || null;
  const titleMarker = firstSectionArticle ? getTitleMarker(firstSectionArticle) : '';
  const sectionName = firstSectionArticle ? getSectionHeaderText(firstSectionArticle) : '';
  const activeSectionLabel = activeSection
    ? (activeSection.fromArticle === activeSection.toArticle
      ? `Artigo ${activeSection.fromArticle}`
      : `Artigos ${activeSection.fromArticle} a ${activeSection.toArticle}`)
    : 'Faixa completa';
  const fontSizeStyle: React.CSSProperties = {
    fontSize: `${Math.max(13, Math.min(18, Math.round(fontScale / 7.2)))}px`,
  };

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
            <ToolbarButton icon={<Star size={14} />} label="Favoritar seção" onClick={toggleSectionFavorite} active={isActiveSectionFavorite} />
            <ToolbarButton icon={<Save size={14} />} label={activeSectionActionLabel} onClick={() => void saveReadingProgress()} active={isActiveSectionCompleted} />
            <ToolbarButton icon={<Share2 size={14} />} label="Compartilhar" onClick={shareLaw} />
            <ToolbarButton icon={<Flag size={14} />} label="Reportar erro" onClick={() => setSectionReportModalOpen(true)} />
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
              onChange={(event) => setSearchTerm(event.target.value)}
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
            icon={<Eye size={14} />}
            label={isFocusMode ? 'Sair do foco' : 'Modo foco'}
            active={isFocusMode}
            onClick={() => setIsFocusMode((state) => !state)}
          />
          <ToolbarButton icon={<Star size={14} />} label="Favoritar seção" onClick={toggleSectionFavorite} active={isActiveSectionFavorite} />
          <ToolbarButton icon={<FileText size={14} />} label="PDF" onClick={openOfficialPdf} />
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
        <div className={`${PLATFORM_SURFACE_CARD_CLASS} p-1`}>
          <div className="grid grid-cols-3 gap-1">
            {([
              { key: 'comments', label: 'Comentários' },
              { key: 'law', label: 'Conteúdo da lei' },
              { key: 'questions', label: 'Questões' },
            ] as const).map((tab) => (
              <button
                key={tab.key}
                type="button"
                onClick={() => setActiveTab(tab.key)}
                className={`h-9 rounded-lg text-[11px] font-bold transition-colors sm:h-10 sm:rounded-xl sm:text-sm ${
                  activeTab === tab.key
                    ? 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900'
                    : 'text-slate-500 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>
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
                saveReaderMarkup();
              }}
              className="inline-flex h-8 shrink-0 items-center gap-2 rounded-lg bg-slate-900 px-3 text-xs font-black text-white transition-colors hover:bg-[#615fff] dark:bg-slate-100 dark:text-slate-950 sm:h-9 sm:px-4"
            >
              <Save size={14} />
              <span className="hidden sm:inline">Salvar</span>
            </button>
          </div>
        ) : null}
      </section>
      </div>

      {activeTab === 'questions' ? (
        <section className={`${PLATFORM_SURFACE_CARD_CLASS} p-6`}>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-lg font-black text-slate-900 dark:text-slate-100">Questões relacionadas</h2>
              <p className="mt-2 text-sm font-medium text-slate-500 dark:text-slate-300">
                Cards filtrados pela matéria e pelos tópicos/assuntos desta seção.
              </p>
            </div>
            <Link
              href={`/practice?lawId=${encodeURIComponent(law.id)}${activeSection ? `&from=${encodeURIComponent(activeSection.fromArticle)}&to=${encodeURIComponent(activeSection.toArticle)}` : ''}`}
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
      ) : activeTab === 'comments' ? (
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
      ) : (
        <section ref={readingContentSectionRef} className={`${PLATFORM_SURFACE_CARD_CLASS} overflow-hidden`}>
          <div className="border-b border-slate-200 px-5 py-3 text-xs font-bold text-slate-500 dark:border-slate-700 dark:text-slate-300">
            Última sincronização: {formatDate(law.lastSyncedAt)}
          </div>

          {visibleArticles.length === 0 ? (
            <div className="p-6 text-sm font-semibold text-slate-500 dark:text-slate-300">
              Nenhum artigo encontrado com os filtros atuais.
            </div>
          ) : (
            <div className="bg-slate-100/70 p-4 dark:bg-slate-950/50">
              <div
                key={`${readerMarkupKey}:${readerMarkupVersion}:${savedReaderMarkupHtml ? 'saved' : 'source'}`}
                ref={readerEditorRef}
                tabIndex={-1}
                onMouseUp={refreshReaderToolbarState}
                className="mx-auto max-w-[980px] rounded-xl border border-slate-200 bg-white p-6 shadow-sm outline-none transition-shadow focus:ring-2 focus:ring-[#615fff]/20 dark:border-slate-700 dark:bg-slate-900 md:p-9"
                {...(savedReaderMarkupHtml ? { dangerouslySetInnerHTML: { __html: savedReaderMarkupHtml } } : {})}
              >
                {savedReaderMarkupHtml ? null : (
                  <>
                <header className="mb-7 text-center">
                  {titleMarker ? (
                    <p className="text-[11px] font-black uppercase tracking-[0.18em] text-[#615fff]">
                      {titleMarker}
                    </p>
                  ) : null}
                  {sectionName ? (
                    <h2 className="mt-2 text-2xl font-black tracking-tight text-slate-900 dark:text-slate-100">
                      {sectionName}
                    </h2>
                  ) : null}
                </header>

                <div className="space-y-6">
                  {visibleArticles.map((article) => {
                    const blocks = buildArticleBlocks(article);
                    const teacherComments = resolveArticleTeacherComments(law, article);
                    const jurisprudence = resolveArticleJurisprudence(law, article);
                    const doctrine = Array.isArray(article.doutrina) ? article.doutrina : (Array.isArray(article.doctrine) ? article.doctrine : []);
                    const sumulas = Array.isArray(article.sumulas) ? article.sumulas : [];
                    const examTip = String(article.examTip || article.macete || '').trim();
                    const inlineNotesByBlock = activeTab === 'law'
                      ? groupInlineNotesByBlock(blocks, buildInlineLegalNotes({
                        article,
                        teacherComments,
                        doctrine,
                        jurisprudence,
                        sumulas,
                        examTip,
                      }))
                      : new Map<string, InlineLegalNote[]>();

                    return (
                      <article key={article.id} className="space-y-4 border-b border-slate-100 pb-6 last:border-b-0 dark:border-slate-800" style={fontSizeStyle}>
                        <div className="flex items-start justify-between gap-4">
                          <h3 className="text-xl font-black tracking-tight text-slate-900 dark:text-slate-100">
                            Art. {getArticleNumber(article) || '-'}
                          </h3>
                          <span className="inline-flex h-7 min-w-[28px] items-center justify-center rounded-full bg-indigo-100 px-2 text-xs font-black text-[#615fff] dark:bg-indigo-500/20">
                            {Math.max(blocks.length - 1, 1)}
                          </span>
                        </div>

                        <div className="space-y-3 font-medium leading-7 text-slate-800 dark:text-slate-100">
                          {blocks.map((block) => {
                            const blockNotes = inlineNotesByBlock.get(block.id) || [];

                            return (
                              <React.Fragment key={block.id}>
                                <p>
                                  <strong className="font-black text-slate-900 dark:text-slate-100">
                                    {block.label}
                                  </strong>
                                  {block.text ? ` ${block.text}` : ''}
                                </p>

                                {blockNotes.length ? (
                                  <div className="space-y-2">
                                    {blockNotes.map((note) => (
                                      <CalloutBlock
                                        key={note.id}
                                        tone={note.tone}
                                        title={note.title}
                                        body={note.body}
                                        blocks={note.blocks}
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
                  </>
                )}
              </div>
            </div>
          )}
        </section>
      )}

      {activeTab === 'law' && hasSectionDeepAnalysis ? (
        <section className={`${PLATFORM_SURFACE_CARD_CLASS} overflow-hidden`}>
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

              {sectionRichBlocks.length ? (
                <div className="mt-5 rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900">
                  <RichLegalContentBlocks blocks={sectionRichBlocks} />
                </div>
              ) : null}

              {!sectionRichBlocks.length ? (
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
      ) : null}

      <section className={`${PLATFORM_SURFACE_CARD_CLASS} flex flex-wrap items-center justify-between gap-2 px-4 py-3`}>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            disabled={!previousSection}
            onClick={() => previousSection && changeSection(previousSection.id)}
            className="inline-flex h-9 items-center gap-1 rounded-lg border border-slate-200 bg-white px-3 text-xs font-black text-slate-600 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
          >
            <ArrowLeft size={12} />
            Artigo anterior
          </button>
          <button
            type="button"
            onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
            className="inline-flex h-9 items-center gap-1 rounded-lg border border-slate-200 bg-white px-3 text-xs font-black text-slate-600 transition-colors hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
          >
            Voltar ao topo
          </button>
        </div>
        <button
          type="button"
          disabled={!nextSection}
          onClick={() => nextSection && changeSection(nextSection.id)}
          className="inline-flex h-9 items-center gap-1 rounded-lg border border-slate-200 bg-white px-3 text-xs font-black text-slate-600 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
        >
          Próximo artigo
          <ArrowRight size={12} />
        </button>
      </section>

      {sectionReportModalOpen ? (
        <div className="fixed inset-0 z-[90] flex items-center justify-center bg-slate-950/45 px-4 py-6 backdrop-blur-sm">
          <div className={`${PLATFORM_SURFACE_CARD_CLASS} w-full max-w-lg p-5`}>
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.18em] text-red-500">Reportar erro</p>
                <h2 className="mt-1 text-lg font-black text-slate-900 dark:text-slate-100">Problema nesta seção</h2>
                <p className="mt-1 text-sm font-medium text-slate-500 dark:text-slate-300">
                  Informe o ponto que precisa ser revisado pela moderação.
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
                <span className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-500">Tipo de erro</span>
                <select
                  value={sectionReportReason}
                  onChange={(event) => setSectionReportReason(event.target.value)}
                  className="mt-1 h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 outline-none focus:border-[#615fff]/45 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                >
                  <option>Erro no texto da lei</option>
                  <option>Comentário incorreto</option>
                  <option>Jurisprudência ou súmula incorreta</option>
                  <option>Problema de formatação</option>
                  <option>Outro</option>
                </select>
              </label>
              <label className="block">
                <span className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-500">Detalhes</span>
                <textarea
                  value={sectionReportDetails}
                  onChange={(event) => setSectionReportDetails(event.target.value)}
                  rows={5}
                  placeholder="Ex.: o inciso II está duplicado, há erro de digitação ou o comentário não corresponde ao artigo."
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
                disabled={isReportingSection || !sectionReportDetails.trim()}
                className="inline-flex h-9 items-center gap-2 rounded-lg bg-red-600 px-4 text-xs font-black text-white transition-colors hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isReportingSection ? <Loader2 size={14} className="animate-spin" /> : <Flag size={14} />}
                Enviar reporte
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <footer className="text-center text-xs font-semibold text-slate-400 dark:text-slate-500">
        Lei nº {law.number || '-'} - {law.shortTitle}. Este conteúdo não substitui o texto oficial da legislação.
      </footer>
    </div>
  );
};

export default LawDetailPage;
