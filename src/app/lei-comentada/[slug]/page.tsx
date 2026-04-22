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
import Link from 'next/link';
import { useParams } from 'next/navigation';
import {
  AlertTriangle,
  ArrowLeft,
  ArrowUp,
  Bookmark,
  BookMarked,
  BookOpen,
  ChevronDown,
  Clipboard,
  Eraser,
  Eye,
  EyeOff,
  ExternalLink,
  FileText,
  GraduationCap,
  Highlighter,
  Landmark,
  Lightbulb,
  Maximize2,
  MessageCircle,
  Minimize2,
  Pencil,
  Scale,
  Search,
  Share2,
  StickyNote,
  Trash2,
  UserRound,
} from 'lucide-react';
import { useAuth } from '@providers/AuthProvider';
import { useToast } from '@providers/ToastProvider';
import {
  PLATFORM_PAGE_DESCRIPTION_CLASS,
  PLATFORM_PAGE_TITLE_CLASS,
  PLATFORM_SECTION_TITLE_CLASS,
  PLATFORM_SURFACE_CARD_CLASS,
} from '@constants/layout';
import { legalCommentaryApiService } from '@services/legal-commentary';
import {
  clearLegalArticleHighlights,
  readLegalArticleHighlights,
  saveLegalArticleHighlights,
} from '@services/legal-commentary/legalHighlights';
import {
  readLegalCommentaryArticleNote,
  saveLegalCommentaryArticleNote,
} from '@services/legal-commentary/legalCommentaryNotes';
import {
  DEFAULT_LEGAL_READING_PREFERENCES,
  readLegalReadingPreferences,
  saveLegalReadingPreferences,
} from '@services/legal-commentary/legalReadingPreferences';
import type {
  ArticleExamTip,
  ArticleJurisprudence,
  LegalCommentedViewMode,
  LawArticle,
  LawDetail,
  LegalFavoriteType,
  LegalHighlightColor,
  LegalHighlightEntry,
  LegalReadingFlowMode,
  LegalReadingMode,
  LegalUserComment,
  LegalReadingPreferences,
  TeacherComment,
} from '@types';

const getUserId = (user: any) => user?.id || user?.userId || user?.email || null;

type HighlightableTextUnit = {
  id: string;
  label?: string;
  text: string;
  kind: LawArticle['blocks'][number]['kind'] | 'fallback';
  isRecentlyChanged?: boolean;
  source: 'block' | 'paragraph' | 'fallback';
};

type SelectionPopoverState = {
  articleId: string;
  unitId: string;
  unitLabel?: string;
  preview: string;
  selectedText: string;
  startOffset: number;
  endOffset: number;
  x: number;
  y: number;
};

type LegalReadingToolsContextValue = {
  registerHighlightUnit: (articleId: string, unitId: string, unitLabel?: string) => (node: HTMLSpanElement | null) => void;
  queueSelectionHighlight: (articleId: string, event: React.MouseEvent<HTMLElement>) => void;
};

type HighlightUnitRegistration = {
  textRoot: HTMLSpanElement;
  container: HTMLElement | null;
  label?: string;
};

type ArticleStudyContentIndex = {
  commentsByArticle: Record<string, TeacherComment[]>;
  jurisprudenceByArticle: Record<string, ArticleJurisprudence[]>;
  tipsByArticle: Record<string, string[]>;
  communityCommentsByArticle: Record<string, LegalUserComment[]>;
};

const LegalReadingToolsContext = React.createContext<LegalReadingToolsContextValue | null>(null);

const useLegalReadingTools = () => React.useContext(LegalReadingToolsContext);

const HIGHLIGHT_COLORS: Array<{
  value: LegalHighlightColor;
  label: string;
  swatchClassName: string;
  selectionClassName: string;
}> = [
  {
    value: 'yellow',
    label: 'Amarelo',
    swatchClassName: 'bg-amber-300',
    selectionClassName: 'bg-amber-200 text-slate-950 dark:bg-amber-300/80',
  },
  {
    value: 'blue',
    label: 'Azul',
    swatchClassName: 'bg-sky-300',
    selectionClassName: 'bg-sky-200 text-slate-950 dark:bg-sky-300/70',
  },
  {
    value: 'pink',
    label: 'Rosa',
    swatchClassName: 'bg-pink-300',
    selectionClassName: 'bg-pink-200 text-slate-950 dark:bg-pink-300/70',
  },
  {
    value: 'green',
    label: 'Verde',
    swatchClassName: 'bg-emerald-300',
    selectionClassName: 'bg-emerald-200 text-slate-950 dark:bg-emerald-300/70',
  },
];

const getHighlightPalette = (color: LegalHighlightColor) =>
  HIGHLIGHT_COLORS.find((item) => item.value === color) || HIGHLIGHT_COLORS[0];

const NATIVE_HIGHLIGHT_NAMES: Record<LegalHighlightColor, string> = {
  yellow: 'cm-legal-highlight-yellow',
  blue: 'cm-legal-highlight-blue',
  pink: 'cm-legal-highlight-pink',
  green: 'cm-legal-highlight-green',
};

const supportsNativeInlineHighlights = () => (
  typeof window !== 'undefined'
  && typeof CSS !== 'undefined'
  && 'highlights' in CSS
  && 'Highlight' in window
);

const buildHighlightAnchor = (unitId: string, offset: number) => `${unitId}:${offset}`;

const parseHighlightAnchor = (anchor?: string) => {
  const normalized = String(anchor || '').trim();
  const separatorIndex = normalized.lastIndexOf(':');
  if (separatorIndex === -1) {
    return null;
  }

  const unitId = normalized.slice(0, separatorIndex);
  const offset = Number(normalized.slice(separatorIndex + 1));
  if (!unitId || !Number.isFinite(offset)) {
    return null;
  }

  return {
    unitId,
    offset,
  };
};

const buildArticleTextUnits = (article: LawArticle): HighlightableTextUnit[] => {
  const blockUnits = (article.blocks || []).map((block) => ({
    id: block.id,
    label: block.kind !== 'note' ? block.label : '',
    text: block.text,
    kind: block.kind,
    isRecentlyChanged: block.isRecentlyChanged,
    source: 'block' as const,
  }));

  const paragraphUnits = (article.paragraphs || []).map((paragraph) => ({
    id: `paragraph:${paragraph.number}`,
    label: paragraph.number,
    text: paragraph.text,
    kind: 'paragraph' as const,
    source: 'paragraph' as const,
  }));

  if (!blockUnits.length && !paragraphUnits.length && article.text) {
    return [{
      id: `fallback:${article.id}`,
      label: `Art. ${article.number}`,
      text: article.text,
      kind: 'fallback',
      source: 'fallback',
    }];
  }

  return [...blockUnits, ...paragraphUnits];
};

const getTextOffsetWithin = (root: HTMLElement, targetNode: Node, targetOffset: number) => {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  let currentNode: Node | null = walker.nextNode();
  let accumulatedOffset = 0;

  while (currentNode) {
    const textLength = currentNode.textContent?.length || 0;
    if (currentNode === targetNode) {
      return accumulatedOffset + targetOffset;
    }

    accumulatedOffset += textLength;
    currentNode = walker.nextNode();
  }

  return accumulatedOffset;
};

const getHighlightEntryUnitId = (entry: LegalHighlightEntry) => (
  entry.unitId
  || parseHighlightAnchor(entry.startAnchor)?.unitId
  || parseHighlightAnchor(entry.endAnchor)?.unitId
  || ''
);

const buildHighlightPreview = (text: string) => {
  const normalized = text.replace(/\s+/g, ' ').trim();
  if (!normalized) {
    return 'Trecho marcado';
  }

  return normalized.length > 88 ? `${normalized.slice(0, 85)}...` : normalized;
};

const findNearestTextOccurrence = (textContent: string, selectedText: string, preferredOffset: number) => {
  const normalizedSelection = selectedText.trim();
  if (!normalizedSelection) {
    return null;
  }

  const candidateOffsets: number[] = [];
  let searchIndex = textContent.indexOf(normalizedSelection);

  while (searchIndex !== -1) {
    candidateOffsets.push(searchIndex);
    searchIndex = textContent.indexOf(normalizedSelection, searchIndex + 1);
  }

  if (!candidateOffsets.length) {
    return null;
  }

  return candidateOffsets.reduce((closestOffset, currentOffset) => (
    Math.abs(currentOffset - preferredOffset) < Math.abs(closestOffset - preferredOffset)
      ? currentOffset
      : closestOffset
  ));
};

const resolveHighlightOffsets = (
  textContent: string,
  entry: LegalHighlightEntry,
) => {
  const startAnchor = parseHighlightAnchor(entry.startAnchor);
  const endAnchor = parseHighlightAnchor(entry.endAnchor);
  if (!startAnchor || !endAnchor) {
    return null;
  }

  const safeStart = Math.max(0, Math.min(startAnchor.offset, endAnchor.offset, textContent.length));
  const safeEnd = Math.max(safeStart, Math.min(Math.max(startAnchor.offset, endAnchor.offset), textContent.length));
  const anchoredSlice = textContent.slice(safeStart, safeEnd);
  const expectedText = String(entry.selectedText || '').trim();

  if (!expectedText) {
    return anchoredSlice ? { start: safeStart, end: safeEnd } : null;
  }

  if (anchoredSlice.trim() === expectedText) {
    return { start: safeStart, end: safeEnd };
  }

  const nearestOffset = findNearestTextOccurrence(textContent, expectedText, safeStart);
  if (nearestOffset === null) {
    return anchoredSlice ? { start: safeStart, end: safeEnd } : null;
  }

  return {
    start: nearestOffset,
    end: nearestOffset + expectedText.length,
  };
};

const formatDate = (iso?: string) => {
  if (!iso) return 'Sem registro';
  return new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(new Date(iso));
};

const getArticleSearchText = (article: LawArticle) => [
  article.number,
  article.title || '',
  article.text || '',
  article.hierarchy.title || '',
  article.hierarchy.chapter || '',
  article.hierarchy.section || '',
  ...article.blocks.map((block) => `${block.label} ${block.text}`),
  ...(article.paragraphs || []).map((paragraph) => `${paragraph.number} ${paragraph.text}`),
  ...(article.jurisprudenceNotes || []),
  ...(article.syllabi || []).map((syllabus) => `${syllabus.court} ${syllabus.number} ${syllabus.text}`),
  ...(article.doctrine || []),
  article.examTip || '',
].join(' ').toLowerCase();

const buildArticleStudyContentIndex = (law: LawDetail): ArticleStudyContentIndex => {
  const commentsByArticle = law.teacherComments.reduce<Record<string, TeacherComment[]>>((accumulator, comment) => {
    accumulator[comment.articleId] = [...(accumulator[comment.articleId] || []), comment];
    return accumulator;
  }, {});

  const jurisprudenceByArticle = law.jurisprudence.reduce<Record<string, ArticleJurisprudence[]>>((accumulator, item) => {
    accumulator[item.articleId] = [...(accumulator[item.articleId] || []), item];
    return accumulator;
  }, {});

  const tipsByArticle = law.examTips.reduce<Record<string, string[]>>((accumulator, tip) => {
    accumulator[tip.articleId] = [...(accumulator[tip.articleId] || []), tip.body];
    return accumulator;
  }, {});

  const communityCommentsByArticle = law.userComments.reduce<Record<string, LegalUserComment[]>>((accumulator, comment) => {
    accumulator[comment.articleId] = [...(accumulator[comment.articleId] || []), comment];
    return accumulator;
  }, {});

  return {
    commentsByArticle,
    jurisprudenceByArticle,
    tipsByArticle,
    communityCommentsByArticle,
  };
};

const getArticleStudyContent = (index: ArticleStudyContentIndex, article: LawArticle) => {
  const comments = index.commentsByArticle[article.id] || [];
  const jurisprudence = index.jurisprudenceByArticle[article.id] || [];
  const tips = index.tipsByArticle[article.id] || [];
  const allTips = [...tips, ...(article.examTip ? [article.examTip] : [])];
  const communityComments = index.communityCommentsByArticle[article.id] || [];

  return {
    comments,
    jurisprudence,
    allTips,
    communityComments,
  };
};

const FavoriteIconButton: React.FC<{
  isFavorite?: boolean;
  title: string;
  onClick: () => void;
}> = ({ isFavorite, title, onClick }) => (
  <button
    onClick={onClick}
    className={`flex h-9 w-9 items-center justify-center rounded-xl transition-colors ${isFavorite ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:bg-slate-100 hover:text-indigo-600 dark:hover:bg-slate-800'}`}
    title={title}
  >
    <Bookmark size={16} fill={isFavorite ? 'currentColor' : 'none'} />
  </button>
);

const AccordionRow: React.FC<{
  icon: any;
  title: string;
  count?: number;
  tone: 'blue' | 'green' | 'purple' | 'amber' | 'red' | 'slate';
  children: React.ReactNode;
  defaultOpen?: boolean;
}> = ({ icon: Icon, title, count, tone, children, defaultOpen = false }) => {
  const tones = {
    blue: 'text-blue-600 bg-blue-50 dark:bg-blue-900/25 dark:text-blue-300',
    green: 'text-emerald-600 bg-emerald-50 dark:bg-emerald-900/25 dark:text-emerald-300',
    purple: 'text-violet-700 bg-violet-50 dark:bg-violet-900/25 dark:text-violet-300',
    amber: 'text-amber-600 bg-amber-50 dark:bg-amber-900/25 dark:text-amber-300',
    red: 'text-red-600 bg-red-50 dark:bg-red-900/25 dark:text-red-300',
    slate: 'text-slate-600 bg-slate-100 dark:bg-slate-800 dark:text-slate-300',
  };

  return (
    <details open={defaultOpen} className="group border-t border-slate-100 first:border-t-0 dark:border-slate-800">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-1 py-3">
        <span className="flex items-center gap-3 text-sm font-black text-slate-800 dark:text-slate-100">
          <span className={`flex h-7 w-7 items-center justify-center rounded-lg ${tones[tone]}`}>
            <Icon size={15} />
          </span>
          {title}
          {typeof count === 'number' ? <span className="text-xs font-bold text-slate-400">({count})</span> : null}
        </span>
        <ChevronDown size={16} className="text-slate-300 transition-transform group-open:rotate-180" />
      </summary>
      <div className="pb-4 pl-10 pr-1">
        {children}
      </div>
    </details>
  );
};

const TeacherCommentsContent: React.FC<{
  comments: TeacherComment[];
  onFavorite: (type: LegalFavoriteType, targetId: string) => void;
}> = ({ comments, onFavorite }) => (
  <div className="space-y-3">
    {comments.map((comment) => (
      <article key={comment.id} className="rounded-2xl bg-blue-50 p-4 dark:bg-blue-900/20">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h4 className="text-sm font-black text-slate-950 dark:text-white">{comment.title}</h4>
            <p className="mt-1 text-[11px] font-bold text-slate-400">{comment.authorName}{comment.authorRole ? ` · ${comment.authorRole}` : ''}</p>
            <p className="mt-2 text-sm font-medium leading-relaxed text-slate-600 dark:text-slate-300">{comment.body}</p>
          </div>
          <FavoriteIconButton isFavorite={comment.isFavorite} title="Salvar comentário" onClick={() => onFavorite('teacher_comment', comment.id)} />
        </div>
        <p className="mt-3 text-xs font-bold text-blue-700 dark:text-blue-300">Cai em prova: {comment.examFocus.join(', ')}</p>
      </article>
    ))}
  </div>
);

const JurisprudenceContent: React.FC<{
  items: ArticleJurisprudence[];
  onFavorite: (type: LegalFavoriteType, targetId: string) => void;
}> = ({ items, onFavorite }) => (
  <div className="space-y-3">
    {items.map((item) => (
      <article key={item.id} className="rounded-2xl bg-violet-50 p-4 dark:bg-violet-900/20">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[10px] font-black uppercase tracking-widest text-emerald-700 dark:text-emerald-300">{item.court} · {item.precedentType}</p>
            <h4 className="mt-1 text-sm font-black text-slate-950 dark:text-white">{item.title}</h4>
            <p className="mt-2 text-sm font-medium leading-relaxed text-slate-600 dark:text-slate-300">{item.summary}</p>
          </div>
          <FavoriteIconButton isFavorite={item.isFavorite} title="Salvar jurisprudência" onClick={() => onFavorite('jurisprudence', item.id)} />
        </div>
        <p className="mt-3 text-xs font-bold text-emerald-700 dark:text-emerald-300">{item.examImpact}</p>
      </article>
    ))}
  </div>
);

const TextListContent: React.FC<{ items: string[]; tone?: 'slate' | 'green' | 'purple' | 'amber' | 'red' }> = ({ items, tone = 'slate' }) => {
  const toneClass = {
    slate: 'bg-slate-50 dark:bg-slate-800',
    green: 'bg-emerald-50 dark:bg-emerald-900/20',
    purple: 'bg-violet-50 dark:bg-violet-900/20',
    amber: 'bg-amber-50 dark:bg-amber-900/20',
    red: 'bg-red-50 dark:bg-red-900/20',
  }[tone];

  return (
    <div className="space-y-2">
      {items.map((item, index) => (
        <div key={`${item}-${index}`} className={`rounded-2xl p-4 ${toneClass}`}>
          <p className="text-sm font-medium leading-relaxed text-slate-600 dark:text-slate-300">{item}</p>
        </div>
      ))}
    </div>
  );
};

const SyllabiContent: React.FC<{ items: LawArticle['syllabi'] }> = ({ items = [] }) => (
  <div className="space-y-2">
    {items.map((item) => (
      <div key={`${item.court}-${item.number}`} className="rounded-2xl bg-red-50 p-4 dark:bg-red-900/20">
        <div className="mb-2 flex flex-wrap items-center gap-2">
          <span className="rounded-full bg-white px-2.5 py-1 text-[10px] font-black uppercase tracking-widest text-red-600 dark:bg-slate-900 dark:text-red-300">{item.court}</span>
          <span className="text-xs font-black text-slate-700 dark:text-slate-200">Súmula {item.number}</span>
        </div>
        <p className="text-sm font-medium leading-relaxed text-slate-600 dark:text-slate-300">{item.text}</p>
      </div>
    ))}
  </div>
);

const ExamTipsContent: React.FC<{ tips: string[] }> = ({ tips }) => (
  <div className="space-y-3">
    {tips.map((tip, index) => (
      <article key={`${tip}-${index}`} className="rounded-2xl bg-amber-50 p-4 dark:bg-amber-900/20">
        <p className="text-sm font-medium leading-relaxed text-slate-600 dark:text-slate-300">{tip}</p>
      </article>
    ))}
  </div>
);

const ArticleNotesContent: React.FC<{
  articleId: string;
  law: LawDetail;
  article: LawArticle;
  currentUser: any;
}> = ({ articleId, law, article, currentUser }) => {
  const userKey = String(getUserId(currentUser) || 'guest');
  const [note, setNote] = React.useState('');
  const [savedLabel, setSavedLabel] = React.useState('');

  React.useEffect(() => {
    if (typeof window === 'undefined') return;
    const persistedNote = readLegalCommentaryArticleNote(userKey, articleId);
    setNote(persistedNote?.note || '');
    setSavedLabel('');
  }, [articleId, userKey]);

  const saveNote = () => {
    const persistedNote = saveLegalCommentaryArticleNote({
      userKey,
      articleId,
      note,
      lawId: law.id,
      lawSlug: law.slug,
      lawTitle: law.title,
      lawShortTitle: law.shortTitle,
      areaName: law.area.name,
      articleNumber: article.number,
      articleTitle: article.title || undefined,
    });

    setNote(persistedNote?.note || '');
    setSavedLabel(persistedNote ? 'Anotação salva.' : 'Anotação removida.');
  };

  return (
    <div className="space-y-3">
      <textarea
        value={note}
        onChange={(event) => setNote(event.target.value)}
        placeholder={currentUser ? 'Escreva sua anotação privada sobre este artigo.' : 'Entre para salvar anotações privadas.'}
        disabled={!currentUser}
        className="min-h-[96px] w-full resize-none rounded-2xl border border-slate-200 bg-slate-50 p-3 text-sm font-medium text-slate-900 outline-none transition-colors focus:border-indigo-300 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
      />
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs font-bold text-slate-400">{savedLabel || 'Suas anotações ficam privadas.'}</p>
        <button
          onClick={saveNote}
          disabled={!currentUser}
          className="rounded-xl bg-slate-900 px-4 py-2 text-[10px] font-black uppercase tracking-widest text-white transition-colors hover:bg-indigo-600 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-white dark:text-slate-950 dark:hover:bg-indigo-200"
        >
          Salvar
        </button>
      </div>

    </div>
  );
};

const CommunityCommentsContent: React.FC<{
  articleId: string;
  comments: LegalUserComment[];
  currentUser: any;
  onAdd: (articleId: string, body: string) => void;
  onDelete: (commentId: string) => void;
  onEdit: (commentId: string, body: string) => void;
}> = ({ articleId, comments, currentUser, onAdd, onDelete, onEdit }) => {
  const [body, setBody] = React.useState('');
  const [editingId, setEditingId] = React.useState<string | null>(null);
  const [editingBody, setEditingBody] = React.useState('');
  const userId = String(getUserId(currentUser) || '');
  const articleComments = comments.filter((comment) => comment.articleId === articleId);

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <textarea
          value={body}
          onChange={(event) => setBody(event.target.value)}
          placeholder={currentUser ? 'Comente este artigo...' : 'Entre para comentar.'}
          disabled={!currentUser}
          className="min-h-[88px] w-full resize-none rounded-2xl border border-slate-200 bg-slate-50 p-3 text-sm font-medium text-slate-900 outline-none focus:border-indigo-300 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
        />
        <div className="flex justify-end">
          <button
            onClick={() => {
              onAdd(articleId, body);
              setBody('');
            }}
            disabled={!currentUser || !body.trim()}
            className="rounded-xl bg-indigo-600 px-4 py-2 text-[10px] font-black uppercase tracking-widest text-white transition-colors hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Comentar
          </button>
        </div>
      </div>

      {articleComments.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-slate-200 p-4 text-center text-sm font-bold text-slate-400 dark:border-slate-700">Nenhum comentário ainda.</p>
      ) : articleComments.map((comment) => {
        const isOwner = comment.userId === userId;
        return (
          <article key={comment.id} className="rounded-2xl bg-slate-50 p-4 dark:bg-slate-800">
            <div className="mb-2 flex items-start justify-between gap-3">
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-white text-slate-400 dark:bg-slate-900">
                  <UserRound size={15} />
                </div>
                <div>
                  <p className="text-sm font-black text-slate-950 dark:text-white">{comment.userName}</p>
                  <p className="text-xs font-bold text-slate-400">{formatDate(comment.updatedAt || comment.createdAt)}</p>
                </div>
              </div>
              {isOwner ? (
                <div className="flex gap-1">
                  <button
                    onClick={() => {
                      setEditingId(comment.id);
                      setEditingBody(comment.body);
                    }}
                    className="rounded-lg p-2 text-slate-400 transition-colors hover:bg-white hover:text-indigo-600 dark:hover:bg-slate-900"
                    title="Editar"
                  >
                    <Pencil size={14} />
                  </button>
                  <button
                    onClick={() => onDelete(comment.id)}
                    className="rounded-lg p-2 text-slate-400 transition-colors hover:bg-white hover:text-red-600 dark:hover:bg-slate-900"
                    title="Excluir"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              ) : null}
            </div>

            {editingId === comment.id ? (
              <div className="space-y-2">
                <textarea
                  value={editingBody}
                  onChange={(event) => setEditingBody(event.target.value)}
                  className="min-h-[74px] w-full resize-none rounded-xl border border-slate-200 bg-white p-3 text-sm font-medium outline-none focus:border-indigo-300 dark:border-slate-700 dark:bg-slate-900"
                />
                <div className="flex justify-end gap-2">
                  <button onClick={() => setEditingId(null)} className="rounded-lg bg-slate-200 px-3 py-2 text-[10px] font-black uppercase tracking-widest text-slate-600 dark:bg-slate-700 dark:text-slate-200">Cancelar</button>
                  <button
                    onClick={() => {
                      onEdit(comment.id, editingBody);
                      setEditingId(null);
                    }}
                    className="rounded-lg bg-indigo-600 px-3 py-2 text-[10px] font-black uppercase tracking-widest text-white"
                  >
                    Salvar
                  </button>
                </div>
              </div>
            ) : (
              <p className="text-sm font-medium leading-relaxed text-slate-600 dark:text-slate-300">{comment.body}</p>
            )}
          </article>
        );
      })}
    </div>
  );
};

const ArticleLegalText: React.FC<{
  article: LawArticle;
  variant?: 'card' | 'document' | 'dry';
}> = React.memo(({ article, variant = 'card' }) => {
  const tools = useLegalReadingTools();
  const units = React.useMemo(() => buildArticleTextUnits(article), [article]);

  const wrapperClassName = variant === 'document' || variant === 'dry'
    ? 'space-y-3 text-[15px] font-medium leading-8 text-slate-950'
    : 'space-y-3 text-base font-medium leading-8 text-slate-800 dark:text-slate-100';

  const labelClassName = variant === 'document' || variant === 'dry'
    ? 'text-slate-950'
    : 'text-slate-950 dark:text-white';

  return (
    <div className={wrapperClassName}>
      {units.map((unit) => {
        const isParagraphUnit = unit.source === 'paragraph';
        const isDry = variant === 'dry';
        const isDocument = variant === 'document';

        const unitClassName = [
          isDry
            ? getDryBlockClassName(unit.kind === 'fallback' ? 'caput' : unit.kind)
            : isParagraphUnit
              ? (isDocument ? 'border-l-2 border-slate-200 pl-3' : 'border-l-2 border-slate-200 pl-3 dark:border-slate-700')
              : '',
          unit.isRecentlyChanged
            ? (isDocument || isDry ? 'rounded-xl bg-amber-50 p-3' : 'rounded-xl bg-amber-50 p-3 dark:bg-amber-900/20')
            : '',
        ].filter(Boolean).join(' ');

        return (
          <div
            key={unit.id}
            className={unitClassName}
            data-highlight-unit-container={unit.id}
            onMouseUp={(event) => tools?.queueSelectionHighlight(article.id, event)}
          >
            {unit.label ? <span className={`mr-2 font-black ${labelClassName}`}>{unit.label}</span> : null}
            {isParagraphUnit ? <span className={`mr-2 ${labelClassName}`}>-</span> : null}
            <span
              ref={tools?.registerHighlightUnit(article.id, unit.id, unit.label || `Art. ${article.number}`)}
              data-highlight-text-root="true"
              data-highlight-unit-id={unit.id}
            >
              {unit.text}
            </span>
          </div>
        );
      })}
    </div>
  );
});

ArticleLegalText.displayName = 'ArticleLegalText';

const ArticleHighlightChips: React.FC<{
  article: LawArticle;
  highlights: LegalHighlightEntry[];
  nativeInlineHighlightsSupported: boolean;
  onFocus: (entry: LegalHighlightEntry) => void;
  onRemove: (articleId: string, highlightId: string) => void;
}> = ({ article, highlights, nativeInlineHighlightsSupported, onFocus, onRemove }) => {
  const selectionHighlights = React.useMemo(
    () => highlights.filter((entry) => entry.type === 'selection'),
    [highlights],
  );

  if (!selectionHighlights.length) {
    return null;
  }

  return (
    <section className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 dark:border-slate-800 dark:bg-slate-950/70">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400 dark:text-slate-500">Trechos marcados</p>
          <p className="mt-1 text-xs font-medium text-slate-500 dark:text-slate-400">
            {nativeInlineHighlightsSupported ? 'Use os chips para localizar ou remover as marcações deste artigo.' : 'Seu navegador usa um modo leve: os trechos ficam salvos como referência rápida.'}
          </p>
        </div>
        <span className="inline-flex h-7 items-center rounded-full bg-white px-3 text-[11px] font-black text-slate-500 dark:bg-slate-900 dark:text-slate-300">
          {selectionHighlights.length} marcação(ões)
        </span>
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        {selectionHighlights.map((entry) => (
          <div key={entry.id} className="inline-flex max-w-full items-center gap-1 rounded-full border border-slate-200 bg-white pr-1 dark:border-slate-700 dark:bg-slate-900">
            <button
              type="button"
              onClick={() => onFocus(entry)}
              className="inline-flex min-w-0 items-center gap-2 rounded-full px-3 py-1.5 text-left text-xs font-bold text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
            >
              <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${getHighlightPalette(entry.color).swatchClassName}`} />
              <span className="truncate">{entry.preview || entry.selectedText || 'Trecho marcado'}</span>
              {entry.unitLabel ? <span className="shrink-0 text-[10px] uppercase tracking-[0.12em] text-slate-400">{entry.unitLabel}</span> : null}
            </button>
            <button
              type="button"
              onClick={() => onRemove(article.id, entry.id)}
              className="inline-flex h-7 w-7 items-center justify-center rounded-full text-slate-400 transition-colors hover:bg-red-50 hover:text-red-500 dark:hover:bg-red-900/20"
              title="Remover marcação"
            >
              <Trash2 size={13} />
            </button>
          </div>
        ))}
      </div>
    </section>
  );
};

const DocumentSectionHeading: React.FC<{
  icon: any;
  title: string;
  count?: number;
  tone?: 'blue' | 'green' | 'purple' | 'amber' | 'red' | 'slate';
  className?: string;
}> = ({ icon: Icon, title, count, tone = 'slate', className = '' }) => {
  const tones = {
    blue: 'border-blue-200 bg-blue-50 text-blue-700',
    green: 'border-emerald-200 bg-emerald-50 text-emerald-700',
    purple: 'border-violet-200 bg-violet-50 text-violet-700',
    amber: 'border-amber-200 bg-amber-50 text-amber-700',
    red: 'border-red-200 bg-red-50 text-red-700',
    slate: 'border-slate-200 bg-slate-100 text-slate-700',
  };

  return (
    <div className={`flex items-center gap-3 ${className}`.trim()}>
      <span className={`flex h-8 w-8 items-center justify-center rounded-xl border ${tones[tone]}`}>
        <Icon size={15} />
      </span>
      <div className="min-w-0">
        <p className="text-[11px] font-black uppercase tracking-[0.16em] text-slate-400">{title}</p>
        {typeof count === 'number' ? <p className="mt-1 text-xs font-bold text-slate-500">{count} item(ns)</p> : null}
      </div>
    </div>
  );
};

const DocumentCollapsibleSection: React.FC<{
  icon: any;
  title: string;
  count?: number;
  tone?: 'blue' | 'green' | 'purple' | 'amber' | 'red' | 'slate';
  children: React.ReactNode;
  defaultOpen?: boolean;
}> = ({ icon, title, count, tone = 'slate', children, defaultOpen = false }) => (
  <details
    open={defaultOpen}
    className="group rounded-2xl border border-slate-200 bg-slate-50/70 px-4 py-3 transition-colors"
  >
    <summary className="flex cursor-pointer list-none items-center justify-between gap-3">
      <DocumentSectionHeading icon={icon} title={title} count={count} tone={tone} className="min-w-0" />
      <ChevronDown size={16} className="shrink-0 text-slate-400 transition-transform group-open:rotate-180" />
    </summary>
    <div className="border-t border-slate-200 pt-4">
      {children}
    </div>
  </details>
);

type PagedArticleNavigatorProps = {
  articleNumber?: string;
  totalArticles: number;
  articleIndex: number;
  onPrevious: () => void;
  onNext: () => void;
};

const PagedArticleNavigator = React.memo(({
  articleNumber,
  totalArticles,
  articleIndex,
  onPrevious,
  onNext,
}: PagedArticleNavigatorProps) => (
  <section className={`${PLATFORM_SURFACE_CARD_CLASS} flex flex-col gap-3 p-4 md:flex-row md:items-center md:justify-between`}>
    <div>
      <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400 dark:text-slate-500">Navegação</p>
      <p className="mt-1 text-sm font-black text-slate-900 dark:text-slate-100">
        Art. {articleNumber || '-'} • {Math.max(articleIndex + 1, 1)} de {totalArticles} artigos filtrados
      </p>
    </div>
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={onPrevious}
        disabled={articleIndex <= 0}
        className="inline-flex h-10 items-center gap-2 rounded-xl bg-slate-100 px-4 text-xs font-black text-slate-600 transition-colors hover:bg-slate-200 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
      >
        <ArrowLeft size={14} />
        Anterior
      </button>
      <button
        type="button"
        onClick={onNext}
        disabled={articleIndex === -1 || articleIndex >= totalArticles - 1}
        className="inline-flex h-10 items-center gap-2 rounded-xl bg-indigo-600 px-4 text-xs font-black text-white transition-colors hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
      >
        Próximo
        <ChevronDown size={14} className="-rotate-90" />
      </button>
    </div>
  </section>
));

PagedArticleNavigator.displayName = 'PagedArticleNavigator';

type LegalReadingToolsBarProps = {
  readingMode: LegalReadingMode;
  readingFlowMode: LegalReadingFlowMode;
  isImmersiveMode: boolean;
  showComments: boolean;
  highlightColor: LegalHighlightColor;
  hasHighlightsForActiveArticle: boolean;
  onToggleImmersiveMode: () => void;
  onToggleComments: () => void;
  onSetReadingFlowMode: (mode: LegalReadingFlowMode) => void;
  onSetHighlightColor: (color: LegalHighlightColor) => void;
  onClearActiveArticleHighlights: () => void;
};

const LegalReadingToolsBar = React.memo(({
  readingMode,
  readingFlowMode,
  isImmersiveMode,
  showComments,
  highlightColor,
  hasHighlightsForActiveArticle,
  onToggleImmersiveMode,
  onToggleComments,
  onSetReadingFlowMode,
  onSetHighlightColor,
  onClearActiveArticleHighlights,
}: LegalReadingToolsBarProps) => (
  <section className="sticky bottom-4 z-20 mx-auto w-full max-w-[56rem] px-2 md:px-0">
    <div className={`${PLATFORM_SURFACE_CARD_CLASS} overflow-hidden border border-slate-200/80 bg-white/94 px-3 py-2 shadow-xl shadow-slate-900/10 backdrop-blur dark:border-slate-800/80 dark:bg-slate-900/94 dark:shadow-black/20`}>
      <div className="no-scrollbar flex items-center gap-2 overflow-x-auto">
        <div className="min-w-max rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 dark:border-slate-800 dark:bg-slate-950/70">
          <p className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">Leitura</p>
          <div className="mt-2 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={onToggleImmersiveMode}
              className={`inline-flex h-8 shrink-0 items-center gap-2 rounded-xl px-3 text-[11px] font-black transition-colors ${isImmersiveMode ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700'}`}
            >
              {isImmersiveMode ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
              Foco
            </button>
          </div>
        </div>

        <div className="min-w-max rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 dark:border-slate-800 dark:bg-slate-950/70">
          <p className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">Conteúdo</p>
          <div className="mt-2 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={onToggleComments}
              disabled={readingMode === 'dry'}
              className={`inline-flex h-8 shrink-0 items-center gap-2 rounded-xl px-3 text-[11px] font-black transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${showComments ? 'bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700' : 'bg-slate-900 text-white dark:bg-indigo-600'}`}
            >
              {showComments ? <Eye size={14} /> : <EyeOff size={14} />}
              {readingMode === 'dry' ? 'Lei seca' : showComments ? 'Recolher seções' : 'Expandir seções'}
            </button>
            <div className="grid shrink-0 grid-cols-2 rounded-xl bg-slate-100 p-1 dark:bg-slate-800">
              <button
                type="button"
                onClick={() => onSetReadingFlowMode('paged')}
                className={`rounded-lg px-3 py-2 text-[11px] font-black transition-colors ${readingFlowMode === 'paged' ? 'bg-white text-indigo-600 shadow-sm dark:bg-slate-900 dark:text-indigo-300' : 'text-slate-500 dark:text-slate-300'}`}
              >
                Artigo por artigo
              </button>
              <button
                type="button"
                onClick={() => onSetReadingFlowMode('list')}
                className={`rounded-lg px-3 py-2 text-[11px] font-black transition-colors ${readingFlowMode === 'list' ? 'bg-white text-indigo-600 shadow-sm dark:bg-slate-900 dark:text-indigo-300' : 'text-slate-500 dark:text-slate-300'}`}
              >
                Lista
              </button>
            </div>
          </div>
        </div>

        <div className="min-w-max rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 dark:border-slate-800 dark:bg-slate-950/70">
          <p className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">Destaques</p>
          <div className="mt-2 flex flex-wrap gap-2">
            <div className="flex shrink-0 items-center gap-2 rounded-xl bg-slate-100 px-3 py-1.5 dark:bg-slate-800">
              <Highlighter size={14} className="text-slate-400" />
              {HIGHLIGHT_COLORS.map((color) => (
                <button
                  key={color.value}
                  type="button"
                  onClick={() => onSetHighlightColor(color.value)}
                  title={color.label}
                  className={`h-6 w-6 rounded-full border-2 transition-transform hover:scale-105 ${color.swatchClassName} ${highlightColor === color.value ? 'border-slate-900 dark:border-white' : 'border-white/70 dark:border-slate-700'}`}
                />
              ))}
            </div>
            <button
              type="button"
              onClick={onClearActiveArticleHighlights}
              disabled={!hasHighlightsForActiveArticle}
              className="inline-flex h-8 shrink-0 items-center gap-2 rounded-xl bg-slate-100 px-3 text-[11px] font-black text-slate-600 transition-colors hover:bg-slate-200 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
            >
              <Eraser size={14} />
              Limpar
            </button>
          </div>
        </div>
      </div>
    </div>
  </section>
));

LegalReadingToolsBar.displayName = 'LegalReadingToolsBar';

const getDryBlockClassName = (kind: LawArticle['blocks'][number]['kind']) => {
  const base = 'text-[15px] leading-8 text-slate-950';
  const styles = {
    caput: 'mt-3',
    paragraph: 'mt-3',
    inciso: 'mt-2 pl-8',
    alinea: 'mt-2 pl-14',
    item: 'mt-2 pl-20',
    note: 'mt-1 pl-6 text-[12px] italic leading-6 text-slate-500',
  };

  return `${base} ${styles[kind] || 'mt-2'}`;
};

const buildHierarchyKey = (article: LawArticle, kind: 'title' | 'chapter' | 'section' | 'subsection') => {
  const hierarchy = article.hierarchy || {};
  const label = String(hierarchy[`${kind}Label` as keyof typeof hierarchy] || '');
  const name = String(hierarchy[kind] || '');
  return label || name ? `${label}|${name}` : '';
};

type DryLawDocumentProps = {
  law: LawDetail;
  articles: LawArticle[];
  onArticleFocus: (article: LawArticle) => void;
  getArticleHighlights: (articleId: string) => LegalHighlightEntry[];
  nativeInlineHighlightsSupported: boolean;
  onFocusHighlight: (entry: LegalHighlightEntry) => void;
  onRemoveHighlight: (articleId: string, highlightId: string) => void;
};

const DryLawDocument = React.memo(({
  law,
  articles,
  onArticleFocus,
  getArticleHighlights,
  nativeInlineHighlightsSupported,
  onFocusHighlight,
  onRemoveHighlight,
}: DryLawDocumentProps) => {
  const seenHierarchy = {
    title: '',
    chapter: '',
    section: '',
    subsection: '',
  };

  return (
    <div className="mx-auto max-w-[980px]">
      <section className="rounded-lg border border-slate-200 bg-slate-100/70 p-3 shadow-sm dark:border-slate-800 dark:bg-slate-950/50">
        <div className="min-h-[calc(100vh-220px)] rounded-sm bg-white px-7 py-9 text-slate-950 shadow-[0_18px_50px_rgba(15,23,42,0.14)] sm:px-10 md:px-14 md:py-12 lg:px-16">
          <header className="mb-10 border-b border-slate-200 pb-8 text-center">
            <p className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-500">Texto legal consolidado</p>
            <h2 className="mt-3 text-2xl font-black leading-tight text-slate-950 md:text-3xl">{law.shortTitle}</h2>
            <p className="mx-auto mt-3 max-w-2xl text-sm font-medium leading-6 text-slate-600">
              {law.number}{law.date ? `, de ${formatDate(law.date)}` : ''}. Fonte oficial: Portal do Planalto.
            </p>
          </header>

          {articles.length === 0 ? (
            <div className="py-20 text-center">
              <p className="text-sm font-bold text-slate-500">Nenhum artigo encontrado para os filtros atuais.</p>
            </div>
          ) : (
            <div className="space-y-1">
              {articles.map((article) => {
                const headings: React.ReactNode[] = [];
                const titleKey = buildHierarchyKey(article, 'title');
                const chapterKey = buildHierarchyKey(article, 'chapter');
                const sectionKey = buildHierarchyKey(article, 'section');
                const subsectionKey = buildHierarchyKey(article, 'subsection');

                if (titleKey && titleKey !== seenHierarchy.title) {
                  seenHierarchy.title = titleKey;
                  seenHierarchy.chapter = '';
                  seenHierarchy.section = '';
                  seenHierarchy.subsection = '';
                  headings.push(
                    <div key={`${article.id}-title`} className="pt-8 text-center">
                      {article.hierarchy.titleLabel ? <p className="text-sm font-black uppercase tracking-[0.12em] text-slate-950">{article.hierarchy.titleLabel}</p> : null}
                      {article.hierarchy.title ? <p className="mt-3 text-sm font-black uppercase leading-6 text-slate-950">{article.hierarchy.title}</p> : null}
                    </div>
                  );
                }

                if (chapterKey && chapterKey !== seenHierarchy.chapter) {
                  seenHierarchy.chapter = chapterKey;
                  seenHierarchy.section = '';
                  seenHierarchy.subsection = '';
                  headings.push(
                    <div key={`${article.id}-chapter`} className="pt-8 text-center">
                      {article.hierarchy.chapterLabel ? <p className="text-sm font-black uppercase tracking-[0.12em] text-slate-950">{article.hierarchy.chapterLabel}</p> : null}
                      {article.hierarchy.chapter ? <p className="mt-3 text-sm font-black uppercase leading-6 text-slate-950">{article.hierarchy.chapter}</p> : null}
                    </div>
                  );
                }

                if (sectionKey && sectionKey !== seenHierarchy.section) {
                  seenHierarchy.section = sectionKey;
                  seenHierarchy.subsection = '';
                  headings.push(
                    <div key={`${article.id}-section`} className="pt-7 text-center">
                      {article.hierarchy.sectionLabel ? <p className="text-xs font-black uppercase tracking-[0.12em] text-slate-900">{article.hierarchy.sectionLabel}</p> : null}
                      {article.hierarchy.section ? <p className="mt-2 text-xs font-black uppercase leading-5 text-slate-900">{article.hierarchy.section}</p> : null}
                    </div>
                  );
                }

                if (subsectionKey && subsectionKey !== seenHierarchy.subsection) {
                  seenHierarchy.subsection = subsectionKey;
                  headings.push(
                    <div key={`${article.id}-subsection`} className="pt-6 text-center">
                      {article.hierarchy.subsectionLabel ? <p className="text-xs font-black uppercase tracking-[0.12em] text-slate-800">{article.hierarchy.subsectionLabel}</p> : null}
                      {article.hierarchy.subsection ? <p className="mt-2 text-xs font-black uppercase leading-5 text-slate-800">{article.hierarchy.subsection}</p> : null}
                    </div>
                  );
                }

                return (
                  <React.Fragment key={article.id}>
                    {headings}
                    <article
                      id={article.id}
                      onClick={() => onArticleFocus(article)}
                      className="scroll-mt-6 break-inside-avoid py-3"
                    >
                      <ArticleLegalText article={article} variant="dry" />
                      <ArticleHighlightChips
                        article={article}
                        highlights={getArticleHighlights(article.id)}
                        nativeInlineHighlightsSupported={nativeInlineHighlightsSupported}
                        onFocus={onFocusHighlight}
                        onRemove={onRemoveHighlight}
                      />
                    </article>
                  </React.Fragment>
                );
              })}
            </div>
          )}
        </div>
      </section>
    </div>
  );
});

DryLawDocument.displayName = 'DryLawDocument';

const CommentedLawDocument: React.FC<{
  law: LawDetail;
  articles: LawArticle[];
  currentUser: any;
  studyContentIndex: ArticleStudyContentIndex;
  getArticleHighlights: (articleId: string) => LegalHighlightEntry[];
  nativeInlineHighlightsSupported: boolean;
  onFocusHighlight: (entry: LegalHighlightEntry) => void;
  onRemoveHighlight: (articleId: string, highlightId: string) => void;
  onFavorite: (type: LegalFavoriteType, targetId: string) => void;
  onArticleFocus: (article: LawArticle) => void;
  onAddComment: (articleId: string, body: string) => void;
  onDeleteComment: (commentId: string) => void;
  onEditComment: (commentId: string, body: string) => void;
}> = ({
  law,
  articles,
  currentUser,
  studyContentIndex,
  getArticleHighlights,
  nativeInlineHighlightsSupported,
  onFocusHighlight,
  onRemoveHighlight,
  onFavorite,
  onArticleFocus,
  onAddComment,
  onDeleteComment,
  onEditComment,
}) => {
  const seenHierarchy = {
    title: '',
    chapter: '',
    section: '',
    subsection: '',
  };

  return (
    <div className="mx-auto max-w-[1040px]">
      <section className="rounded-lg border border-slate-200 bg-slate-100/70 p-3 shadow-sm dark:border-slate-800 dark:bg-slate-950/50">
        <div className="min-h-[calc(100vh-220px)] rounded-sm bg-white px-7 py-9 text-slate-950 shadow-[0_18px_50px_rgba(15,23,42,0.14)] sm:px-10 md:px-14 md:py-12 lg:px-16">
          <header className="mb-10 border-b border-slate-200 pb-8 text-center">
            <p className="text-[10px] font-black uppercase tracking-[0.22em] text-indigo-600">Lei Comentada</p>
            <h2 className="mt-3 text-2xl font-black leading-tight text-slate-950 md:text-3xl">{law.shortTitle}</h2>
            <p className="mx-auto mt-3 max-w-2xl text-sm font-medium leading-6 text-slate-600">
              Texto oficial com comentários, jurisprudência, súmulas, macetes e anotações em leitura contínua.
            </p>
          </header>

          {articles.length === 0 ? (
            <div className="py-20 text-center">
              <p className="text-sm font-bold text-slate-500">Nenhum artigo encontrado para os filtros atuais.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {articles.map((article) => {
                const { comments, jurisprudence, allTips, communityComments } = getArticleStudyContent(studyContentIndex, article);
                const headings: React.ReactNode[] = [];
                const titleKey = buildHierarchyKey(article, 'title');
                const chapterKey = buildHierarchyKey(article, 'chapter');
                const sectionKey = buildHierarchyKey(article, 'section');
                const subsectionKey = buildHierarchyKey(article, 'subsection');

                if (titleKey && titleKey !== seenHierarchy.title) {
                  seenHierarchy.title = titleKey;
                  seenHierarchy.chapter = '';
                  seenHierarchy.section = '';
                  seenHierarchy.subsection = '';
                  headings.push(
                    <div key={`${article.id}-title`} className="pt-8 text-center">
                      {article.hierarchy.titleLabel ? <p className="text-sm font-black uppercase tracking-[0.12em] text-slate-950">{article.hierarchy.titleLabel}</p> : null}
                      {article.hierarchy.title ? <p className="mt-3 text-sm font-black uppercase leading-6 text-slate-950">{article.hierarchy.title}</p> : null}
                    </div>
                  );
                }

                if (chapterKey && chapterKey !== seenHierarchy.chapter) {
                  seenHierarchy.chapter = chapterKey;
                  seenHierarchy.section = '';
                  seenHierarchy.subsection = '';
                  headings.push(
                    <div key={`${article.id}-chapter`} className="pt-8 text-center">
                      {article.hierarchy.chapterLabel ? <p className="text-sm font-black uppercase tracking-[0.12em] text-slate-950">{article.hierarchy.chapterLabel}</p> : null}
                      {article.hierarchy.chapter ? <p className="mt-3 text-sm font-black uppercase leading-6 text-slate-950">{article.hierarchy.chapter}</p> : null}
                    </div>
                  );
                }

                if (sectionKey && sectionKey !== seenHierarchy.section) {
                  seenHierarchy.section = sectionKey;
                  seenHierarchy.subsection = '';
                  headings.push(
                    <div key={`${article.id}-section`} className="pt-7 text-center">
                      {article.hierarchy.sectionLabel ? <p className="text-xs font-black uppercase tracking-[0.12em] text-slate-900">{article.hierarchy.sectionLabel}</p> : null}
                      {article.hierarchy.section ? <p className="mt-2 text-xs font-black uppercase leading-5 text-slate-900">{article.hierarchy.section}</p> : null}
                    </div>
                  );
                }

                if (subsectionKey && subsectionKey !== seenHierarchy.subsection) {
                  seenHierarchy.subsection = subsectionKey;
                  headings.push(
                    <div key={`${article.id}-subsection`} className="pt-6 text-center">
                      {article.hierarchy.subsectionLabel ? <p className="text-xs font-black uppercase tracking-[0.12em] text-slate-800">{article.hierarchy.subsectionLabel}</p> : null}
                      {article.hierarchy.subsection ? <p className="mt-2 text-xs font-black uppercase leading-5 text-slate-800">{article.hierarchy.subsection}</p> : null}
                    </div>
                  );
                }

                return (
                  <React.Fragment key={article.id}>
                    {headings}
                    <article
                      id={article.id}
                      onClick={() => onArticleFocus(article)}
                      className="scroll-mt-6 border-b border-slate-200 py-5 last:border-b-0"
                    >
                      <header className="mb-4 flex items-start justify-between gap-4">
                        <div>
                          <div className="mb-3 flex flex-wrap items-center gap-2">
                            <span className="rounded-full bg-indigo-600 px-3 py-1 text-[10px] font-black uppercase tracking-widest text-white">Art. {article.number}</span>
                            <span className="text-xs font-semibold text-slate-400">{article.hierarchy.chapter || article.hierarchy.title || law.area.name}</span>
                          </div>
                          {article.title ? <h3 className="text-lg font-black text-slate-950">{article.title}</h3> : null}
                        </div>
                        <FavoriteIconButton isFavorite={article.isFavorite} title="Favoritar artigo" onClick={() => onFavorite('article', article.id)} />
                      </header>

                      <ArticleLegalText article={article} variant="document" />
                      <ArticleHighlightChips
                        article={article}
                        highlights={getArticleHighlights(article.id)}
                        nativeInlineHighlightsSupported={nativeInlineHighlightsSupported}
                        onFocus={onFocusHighlight}
                        onRemove={onRemoveHighlight}
                      />

                      <div className="mt-6 space-y-5 border-t border-slate-200 pt-5">
                        {comments.length > 0 ? (
                          <section>
                            <DocumentSectionHeading icon={GraduationCap} title="Comentário do professor" count={comments.length} tone="blue" />
                            <TeacherCommentsContent comments={comments} onFavorite={onFavorite} />
                          </section>
                        ) : null}

                        {article.doctrine && article.doctrine.length > 0 ? (
                          <section>
                            <DocumentSectionHeading icon={BookMarked} title="Doutrina" count={article.doctrine.length} tone="green" />
                            <TextListContent items={article.doctrine} tone="green" />
                          </section>
                        ) : null}

                        {jurisprudence.length > 0 ? (
                          <section>
                            <DocumentSectionHeading icon={Scale} title="Jurisprudência" count={jurisprudence.length} tone="purple" />
                            <JurisprudenceContent items={jurisprudence} onFavorite={onFavorite} />
                          </section>
                        ) : null}

                        {article.jurisprudenceNotes && article.jurisprudenceNotes.length > 0 ? (
                          <section>
                            <DocumentSectionHeading icon={Scale} title="Jurisprudência" count={article.jurisprudenceNotes.length} tone="purple" />
                            <TextListContent items={article.jurisprudenceNotes} tone="purple" />
                          </section>
                        ) : null}

                        {article.syllabi && article.syllabi.length > 0 ? (
                          <section>
                            <DocumentSectionHeading icon={Landmark} title="Súmulas relacionadas" count={article.syllabi.length} tone="red" />
                            <SyllabiContent items={article.syllabi} />
                          </section>
                        ) : null}

                        {allTips.length > 0 ? (
                          <section>
                            <DocumentSectionHeading icon={Lightbulb} title="Macete para prova" count={allTips.length} tone="amber" />
                            <ExamTipsContent tips={allTips} />
                          </section>
                        ) : null}

                        <section>
                          <DocumentSectionHeading icon={StickyNote} title="Minhas anotações" tone="slate" />
                          <ArticleNotesContent articleId={article.id} law={law} article={article} currentUser={currentUser} />
                        </section>

                        <section>
                          <DocumentSectionHeading icon={MessageCircle} title="Comentários da comunidade" count={communityComments.length} tone="red" />
                          <CommunityCommentsContent
                            articleId={article.id}
                            comments={law.userComments}
                            currentUser={currentUser}
                            onAdd={onAddComment}
                            onDelete={onDeleteComment}
                            onEdit={onEditComment}
                          />
                        </section>

                        {typeof article.relatedQuestionCount === 'number' ? (
                          <div className="flex items-center justify-between border-t border-slate-100 pt-4 text-xs font-black">
                            <Link href="/practice" className="text-indigo-600 hover:underline">
                              {article.relatedQuestionCount} questões relacionadas
                            </Link>
                            <button className="inline-flex items-center gap-1 text-slate-400 transition-colors hover:text-slate-700">
                              <MessageCircle size={13} /> Comentar
                            </button>
                          </div>
                        ) : null}
                      </div>
                    </article>
                  </React.Fragment>
                );
              })}
            </div>
          )}
        </div>
      </section>
    </div>
  );
};

type CommentedLawDocumentCollapsibleProps = {
  law: LawDetail;
  articles: LawArticle[];
  currentUser: any;
  commentsExpanded: boolean;
  accordionSyncToken: number;
  studyContentIndex: ArticleStudyContentIndex;
  getArticleHighlights: (articleId: string) => LegalHighlightEntry[];
  nativeInlineHighlightsSupported: boolean;
  onFocusHighlight: (entry: LegalHighlightEntry) => void;
  onRemoveHighlight: (articleId: string, highlightId: string) => void;
  onFavorite: (type: LegalFavoriteType, targetId: string) => void;
  onArticleFocus: (article: LawArticle) => void;
  onAddComment: (articleId: string, body: string) => void;
  onDeleteComment: (commentId: string) => void;
  onEditComment: (commentId: string, body: string) => void;
};

const CommentedLawDocumentCollapsible = React.memo(({
  law,
  articles,
  currentUser,
  commentsExpanded,
  accordionSyncToken,
  studyContentIndex,
  getArticleHighlights,
  nativeInlineHighlightsSupported,
  onFocusHighlight,
  onRemoveHighlight,
  onFavorite,
  onArticleFocus,
  onAddComment,
  onDeleteComment,
  onEditComment,
}: CommentedLawDocumentCollapsibleProps) => {
  const seenHierarchy = {
    title: '',
    chapter: '',
    section: '',
    subsection: '',
  };

  return (
    <div className="mx-auto max-w-[1040px]">
      <section className="rounded-lg border border-slate-200 bg-slate-100/70 p-3 shadow-sm dark:border-slate-800 dark:bg-slate-950/50">
        <div className="min-h-[calc(100vh-220px)] rounded-sm bg-white px-7 py-9 text-slate-950 shadow-[0_18px_50px_rgba(15,23,42,0.14)] sm:px-10 md:px-14 md:py-12 lg:px-16">
          <header className="mb-10 border-b border-slate-200 pb-8 text-center">
            <p className="text-[10px] font-black uppercase tracking-[0.22em] text-indigo-600">Lei Comentada</p>
            <h2 className="mt-3 text-2xl font-black leading-tight text-slate-950 md:text-3xl">{law.shortTitle}</h2>
            <p className="mx-auto mt-3 max-w-2xl text-sm font-medium leading-6 text-slate-600">
              Texto oficial em leitura contínua, com blocos editoriais recolhidos para abrir sob demanda.
            </p>
          </header>

          {articles.length === 0 ? (
            <div className="py-20 text-center">
              <p className="text-sm font-bold text-slate-500">Nenhum artigo encontrado para os filtros atuais.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {articles.map((article) => {
                const { comments, jurisprudence, allTips, communityComments } = getArticleStudyContent(studyContentIndex, article);
                const headings: React.ReactNode[] = [];
                const titleKey = buildHierarchyKey(article, 'title');
                const chapterKey = buildHierarchyKey(article, 'chapter');
                const sectionKey = buildHierarchyKey(article, 'section');
                const subsectionKey = buildHierarchyKey(article, 'subsection');

                if (titleKey && titleKey !== seenHierarchy.title) {
                  seenHierarchy.title = titleKey;
                  seenHierarchy.chapter = '';
                  seenHierarchy.section = '';
                  seenHierarchy.subsection = '';
                  headings.push(
                    <div key={`${article.id}-title`} className="pt-8 text-center">
                      {article.hierarchy.titleLabel ? <p className="text-sm font-black uppercase tracking-[0.12em] text-slate-950">{article.hierarchy.titleLabel}</p> : null}
                      {article.hierarchy.title ? <p className="mt-3 text-sm font-black uppercase leading-6 text-slate-950">{article.hierarchy.title}</p> : null}
                    </div>
                  );
                }

                if (chapterKey && chapterKey !== seenHierarchy.chapter) {
                  seenHierarchy.chapter = chapterKey;
                  seenHierarchy.section = '';
                  seenHierarchy.subsection = '';
                  headings.push(
                    <div key={`${article.id}-chapter`} className="pt-8 text-center">
                      {article.hierarchy.chapterLabel ? <p className="text-sm font-black uppercase tracking-[0.12em] text-slate-950">{article.hierarchy.chapterLabel}</p> : null}
                      {article.hierarchy.chapter ? <p className="mt-3 text-sm font-black uppercase leading-6 text-slate-950">{article.hierarchy.chapter}</p> : null}
                    </div>
                  );
                }

                if (sectionKey && sectionKey !== seenHierarchy.section) {
                  seenHierarchy.section = sectionKey;
                  seenHierarchy.subsection = '';
                  headings.push(
                    <div key={`${article.id}-section`} className="pt-7 text-center">
                      {article.hierarchy.sectionLabel ? <p className="text-xs font-black uppercase tracking-[0.12em] text-slate-900">{article.hierarchy.sectionLabel}</p> : null}
                      {article.hierarchy.section ? <p className="mt-2 text-xs font-black uppercase leading-5 text-slate-900">{article.hierarchy.section}</p> : null}
                    </div>
                  );
                }

                if (subsectionKey && subsectionKey !== seenHierarchy.subsection) {
                  seenHierarchy.subsection = subsectionKey;
                  headings.push(
                    <div key={`${article.id}-subsection`} className="pt-6 text-center">
                      {article.hierarchy.subsectionLabel ? <p className="text-xs font-black uppercase tracking-[0.12em] text-slate-800">{article.hierarchy.subsectionLabel}</p> : null}
                      {article.hierarchy.subsection ? <p className="mt-2 text-xs font-black uppercase leading-5 text-slate-800">{article.hierarchy.subsection}</p> : null}
                    </div>
                  );
                }

                return (
                  <React.Fragment key={article.id}>
                    {headings}
                    <article
                      id={article.id}
                      onClick={() => onArticleFocus(article)}
                      className="scroll-mt-6 border-b border-slate-200 py-5 last:border-b-0"
                    >
                      <header className="mb-4 flex items-start justify-between gap-4">
                        <div>
                          <div className="mb-3 flex flex-wrap items-center gap-2">
                            <span className="rounded-full bg-indigo-600 px-3 py-1 text-[10px] font-black uppercase tracking-widest text-white">Art. {article.number}</span>
                            <span className="text-xs font-semibold text-slate-400">{article.hierarchy.chapter || article.hierarchy.title || law.area.name}</span>
                          </div>
                          {article.title ? <h3 className="text-lg font-black text-slate-950">{article.title}</h3> : null}
                        </div>
                        <FavoriteIconButton isFavorite={article.isFavorite} title="Favoritar artigo" onClick={() => onFavorite('article', article.id)} />
                      </header>

                      <ArticleLegalText article={article} variant="document" />
                      <ArticleHighlightChips
                        article={article}
                        highlights={getArticleHighlights(article.id)}
                        nativeInlineHighlightsSupported={nativeInlineHighlightsSupported}
                        onFocus={onFocusHighlight}
                        onRemove={onRemoveHighlight}
                      />

                      <div className="mt-6 space-y-4 border-t border-slate-200 pt-5">
                        {comments.length > 0 ? (
                          <DocumentCollapsibleSection key={`teacher-${article.id}-${accordionSyncToken}`} icon={GraduationCap} title="Comentário do professor" count={comments.length} tone="blue" defaultOpen={commentsExpanded}>
                            <TeacherCommentsContent comments={comments} onFavorite={onFavorite} />
                          </DocumentCollapsibleSection>
                        ) : null}

                        {article.doctrine && article.doctrine.length > 0 ? (
                          <DocumentCollapsibleSection key={`doctrine-${article.id}-${accordionSyncToken}`} icon={BookMarked} title="Doutrina" count={article.doctrine.length} tone="green" defaultOpen={commentsExpanded}>
                            <TextListContent items={article.doctrine} tone="green" />
                          </DocumentCollapsibleSection>
                        ) : null}

                        {jurisprudence.length > 0 ? (
                          <DocumentCollapsibleSection key={`juris-${article.id}-${accordionSyncToken}`} icon={Scale} title="Jurisprudência" count={jurisprudence.length} tone="purple" defaultOpen={commentsExpanded}>
                            <JurisprudenceContent items={jurisprudence} onFavorite={onFavorite} />
                          </DocumentCollapsibleSection>
                        ) : null}

                        {article.jurisprudenceNotes && article.jurisprudenceNotes.length > 0 ? (
                          <DocumentCollapsibleSection key={`juris-note-${article.id}-${accordionSyncToken}`} icon={Scale} title="Jurisprudência" count={article.jurisprudenceNotes.length} tone="purple" defaultOpen={commentsExpanded}>
                            <TextListContent items={article.jurisprudenceNotes} tone="purple" />
                          </DocumentCollapsibleSection>
                        ) : null}

                        {article.syllabi && article.syllabi.length > 0 ? (
                          <DocumentCollapsibleSection key={`syllabi-${article.id}-${accordionSyncToken}`} icon={Landmark} title="Súmulas relacionadas" count={article.syllabi.length} tone="red" defaultOpen={commentsExpanded}>
                            <SyllabiContent items={article.syllabi} />
                          </DocumentCollapsibleSection>
                        ) : null}

                        {allTips.length > 0 ? (
                          <DocumentCollapsibleSection key={`tips-${article.id}-${accordionSyncToken}`} icon={Lightbulb} title="Macete para prova" count={allTips.length} tone="amber" defaultOpen={commentsExpanded}>
                            <ExamTipsContent tips={allTips} />
                          </DocumentCollapsibleSection>
                        ) : null}

                        <DocumentCollapsibleSection key={`notes-${article.id}-${accordionSyncToken}`} icon={StickyNote} title="Minhas anotações" tone="slate" defaultOpen={commentsExpanded}>
                          <ArticleNotesContent articleId={article.id} law={law} article={article} currentUser={currentUser} />
                        </DocumentCollapsibleSection>

                        <DocumentCollapsibleSection key={`community-${article.id}-${accordionSyncToken}`} icon={MessageCircle} title="Comentários da comunidade" count={communityComments.length} tone="red" defaultOpen={commentsExpanded}>
                          <CommunityCommentsContent
                            articleId={article.id}
                            comments={law.userComments}
                            currentUser={currentUser}
                            onAdd={onAddComment}
                            onDelete={onDeleteComment}
                            onEdit={onEditComment}
                          />
                        </DocumentCollapsibleSection>

                        {typeof article.relatedQuestionCount === 'number' ? (
                          <div className="flex items-center justify-between border-t border-slate-100 pt-4 text-xs font-black">
                            <Link href="/practice" className="text-indigo-600 hover:underline">
                              {article.relatedQuestionCount} questões relacionadas
                            </Link>
                            <button className="inline-flex items-center gap-1 text-slate-400 transition-colors hover:text-slate-700">
                              <MessageCircle size={13} /> Comentar
                            </button>
                          </div>
                        ) : null}
                      </div>
                    </article>
                  </React.Fragment>
                );
              })}
            </div>
          )}
        </div>
      </section>
    </div>
  );
});

CommentedLawDocumentCollapsible.displayName = 'CommentedLawDocumentCollapsible';

const LawDetailLoadingState: React.FC = () => (
  <div className="w-full space-y-6 animate-fade-in">
    <section className={`${PLATFORM_SURFACE_CARD_CLASS} overflow-hidden`}>
      <div className="grid gap-0 xl:grid-cols-[minmax(0,1fr)_340px]">
        <div className="space-y-6 px-6 py-7 md:px-8">
          <div className="h-4 w-36 animate-pulse rounded-full bg-slate-200 dark:bg-slate-800" />
          <div className="space-y-3">
            <div className="h-3 w-28 animate-pulse rounded-full bg-indigo-100 dark:bg-indigo-900/40" />
            <div className="h-10 w-3/4 animate-pulse rounded-2xl bg-slate-200 dark:bg-slate-800" />
            <div className="h-4 w-full animate-pulse rounded-full bg-slate-100 dark:bg-slate-800/70" />
            <div className="h-4 w-5/6 animate-pulse rounded-full bg-slate-100 dark:bg-slate-800/70" />
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            {Array.from({ length: 3 }).map((_, index) => (
              <div key={index} className="rounded-2xl bg-slate-50 p-4 dark:bg-slate-800/70">
                <div className="h-3 w-20 animate-pulse rounded-full bg-slate-200 dark:bg-slate-700" />
                <div className="mt-3 h-6 w-24 animate-pulse rounded-xl bg-slate-200 dark:bg-slate-700" />
              </div>
            ))}
          </div>
        </div>

        <aside className="border-t border-slate-200 bg-slate-50 px-6 py-7 dark:border-slate-800 dark:bg-slate-950/70 md:px-8 xl:border-l xl:border-t-0">
          <div className="h-3 w-24 animate-pulse rounded-full bg-slate-200 dark:bg-slate-800" />
          <div className="mt-4 h-14 w-full animate-pulse rounded-2xl bg-white dark:bg-slate-900" />
          <div className="mt-5 h-3 w-28 animate-pulse rounded-full bg-slate-200 dark:bg-slate-800" />
          <div className="mt-3 h-4 w-32 animate-pulse rounded-full bg-slate-200 dark:bg-slate-800" />
          <div className="mt-5 h-2 w-full animate-pulse rounded-full bg-slate-200 dark:bg-slate-800" />
        </aside>
      </div>
    </section>

    <div className="grid items-start gap-6 xl:grid-cols-[300px_minmax(0,1fr)]">
      <aside className="hidden xl:sticky xl:top-0 xl:block xl:h-fit">
        <section className={`${PLATFORM_SURFACE_CARD_CLASS} p-4 shadow-xl shadow-slate-200/60 dark:shadow-none`}>
          <div className="h-3 w-14 animate-pulse rounded-full bg-slate-200 dark:bg-slate-800" />
          <div className="mt-3 h-5 w-36 animate-pulse rounded-xl bg-slate-200 dark:bg-slate-800" />
          <div className="mt-5 space-y-2">
            {Array.from({ length: 8 }).map((_, index) => (
              <div key={index} className="h-10 animate-pulse rounded-xl bg-slate-100 dark:bg-slate-800/70" />
            ))}
          </div>
        </section>
      </aside>

      <section className="space-y-5">
        <section className={`${PLATFORM_SURFACE_CARD_CLASS} space-y-4 p-4 md:p-5`}>
          <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_320px]">
            <div className="h-12 animate-pulse rounded-2xl bg-slate-100 dark:bg-slate-800/70" />
            <div className="h-12 animate-pulse rounded-2xl bg-slate-100 dark:bg-slate-800/70" />
          </div>
          <div className="h-16 animate-pulse rounded-2xl bg-slate-50 dark:bg-slate-800/60" />
        </section>

        <section className="mx-auto max-w-[1040px] rounded-lg border border-slate-200 bg-slate-100/70 p-3 shadow-sm dark:border-slate-800 dark:bg-slate-950/50">
          <div className="min-h-[calc(100vh-220px)] rounded-sm bg-white px-7 py-9 shadow-[0_18px_50px_rgba(15,23,42,0.14)] dark:bg-slate-900 sm:px-10 md:px-14 md:py-12 lg:px-16">
            <div className="mb-10 space-y-4 border-b border-slate-200 pb-8 dark:border-slate-800">
              <div className="mx-auto h-3 w-28 animate-pulse rounded-full bg-indigo-100 dark:bg-indigo-900/40" />
              <div className="mx-auto h-8 w-56 animate-pulse rounded-2xl bg-slate-200 dark:bg-slate-800" />
              <div className="mx-auto h-4 w-2/3 animate-pulse rounded-full bg-slate-100 dark:bg-slate-800/70" />
            </div>
            <div className="space-y-6">
              {Array.from({ length: 4 }).map((_, index) => (
                <div key={index} className="space-y-4 border-b border-slate-200 pb-6 last:border-b-0 dark:border-slate-800">
                  <div className="flex items-start justify-between gap-4">
                    <div className="space-y-3">
                      <div className="h-6 w-24 animate-pulse rounded-full bg-indigo-100 dark:bg-indigo-900/40" />
                      <div className="h-4 w-40 animate-pulse rounded-full bg-slate-200 dark:bg-slate-800" />
                    </div>
                    <div className="h-9 w-9 animate-pulse rounded-xl bg-slate-100 dark:bg-slate-800/70" />
                  </div>
                  <div className="space-y-2">
                    <div className="h-4 w-full animate-pulse rounded-full bg-slate-100 dark:bg-slate-800/70" />
                    <div className="h-4 w-11/12 animate-pulse rounded-full bg-slate-100 dark:bg-slate-800/70" />
                    <div className="h-4 w-4/5 animate-pulse rounded-full bg-slate-100 dark:bg-slate-800/70" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      </section>
    </div>
  </div>
);

const LawDetailPage: React.FC = () => {
  const LIST_INITIAL_BATCH = 12;
  const LIST_BATCH_SIZE = 10;
  const params = useParams<{ slug: string }>();
  const { currentUser } = useAuth();
  const { addToast } = useToast();
  const slug = String(params?.slug || '');
  const [law, setLaw] = React.useState<LawDetail | null>(null);
  const [isLoading, setIsLoading] = React.useState(true);
  const [articleQuery, setArticleQuery] = React.useState('');
  const [updatedOnly, setUpdatedOnly] = React.useState(false);
  const [activeArticleId, setActiveArticleId] = React.useState<string>('');
  const [readingMode, setReadingMode] = React.useState<LegalReadingMode>(DEFAULT_LEGAL_READING_PREFERENCES.readingMode);
  const [commentedViewMode, setCommentedViewMode] = React.useState<LegalCommentedViewMode>(DEFAULT_LEGAL_READING_PREFERENCES.commentedViewMode);
  const [readingFlowMode, setReadingFlowMode] = React.useState<LegalReadingFlowMode>(DEFAULT_LEGAL_READING_PREFERENCES.readingFlowMode);
  const [isImmersiveMode, setIsImmersiveMode] = React.useState(DEFAULT_LEGAL_READING_PREFERENCES.isImmersiveMode);
  const [showComments, setShowComments] = React.useState(DEFAULT_LEGAL_READING_PREFERENCES.showComments);
  const [commentsSyncToken, setCommentsSyncToken] = React.useState(0);
  const [highlightColor, setHighlightColor] = React.useState<LegalHighlightColor>(DEFAULT_LEGAL_READING_PREFERENCES.highlightColor);
  const [articleHighlights, setArticleHighlights] = React.useState<Record<string, LegalHighlightEntry[]>>({});
  const [selectionPopover, setSelectionPopover] = React.useState<SelectionPopoverState | null>(null);
  const [loadedReadingPreferencesKey, setLoadedReadingPreferencesKey] = React.useState('');
  const [listVisibleCount, setListVisibleCount] = React.useState(LIST_INITIAL_BATCH);
  const [intersectionRoot, setIntersectionRoot] = React.useState<HTMLElement | null>(null);
  const pageRootRef = React.useRef<HTMLDivElement | null>(null);
  const scrollTargetRef = React.useRef<HTMLElement | Window | null>(null);
  const previousPagedArticleIdRef = React.useRef<string>('');
  const selectionPopoverRef = React.useRef<HTMLDivElement | null>(null);
  const recordedArticleViewsRef = React.useRef<Set<string>>(new Set());
  const highlightUnitRegistrationsRef = React.useRef<Map<string, HighlightUnitRegistration>>(new Map());
  const highlightFlashTimersRef = React.useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
  const listSentinelRef = React.useRef<HTMLDivElement | null>(null);
  const [showBackToTop, setShowBackToTop] = React.useState(false);
  const currentUserKey = React.useMemo(() => String(getUserId(currentUser) || 'guest'), [currentUser]);
  const hideSecondaryPanels = isImmersiveMode;
  const isDocumentMode = readingMode === 'dry' || commentedViewMode === 'pdf';
  const nativeInlineHighlightsSupported = React.useMemo(() => supportsNativeInlineHighlights(), []);

  const reloadLaw = React.useCallback(async (options?: { force?: boolean }) => {
    const nextLaw = await legalCommentaryApiService.getLawDetail(slug, options);
    setLaw(nextLaw);
  }, [slug]);

  React.useEffect(() => {
    let isCurrent = true;
    setIsLoading(true);

    reloadLaw()
      .catch(() => {
        if (isCurrent) {
          setLaw(null);
          addToast('Nao foi possivel carregar a lei salva no banco.', 'error');
        }
      })
      .finally(() => {
        if (isCurrent) setIsLoading(false);
      });

    return () => {
      isCurrent = false;
    };
  }, [addToast, reloadLaw]);

  React.useEffect(() => {
    if (!law) return;
    if (currentUser) {
      legalCommentaryApiService.recordLawView(law.id).catch(() => undefined);
    }
    const hash = typeof window !== 'undefined' ? window.location.hash.replace('#', '') : '';
    setActiveArticleId(hash || law.progress?.lastArticleId || law.articles[0]?.id || '');
  }, [currentUser, law]);

  React.useEffect(() => {
    if (!law) return;
    const preferencesKey = `${currentUserKey}:${law.id}`;

    const preferences = readLegalReadingPreferences(currentUserKey, law.id);
    setReadingMode(preferences.readingMode);
    setCommentedViewMode(preferences.commentedViewMode);
    setReadingFlowMode(preferences.readingFlowMode);
    setIsImmersiveMode(preferences.isImmersiveMode);
    setShowComments(false);
    setHighlightColor(preferences.highlightColor);
    setLoadedReadingPreferencesKey(preferencesKey);
  }, [currentUserKey, law]);

  React.useEffect(() => {
    recordedArticleViewsRef.current.clear();
  }, [law?.id]);

  React.useEffect(() => {
    if (!law || loadedReadingPreferencesKey !== `${currentUserKey}:${law.id}`) return;

    saveLegalReadingPreferences(currentUserKey, law.id, {
      readingMode,
      commentedViewMode,
      readingFlowMode,
      isFocusMode: false,
      hideSecondaryPanels,
      highlightMode: 'selection',
      highlightColor,
      showComments,
      isImmersiveMode,
    });
  }, [
    commentedViewMode,
    currentUserKey,
    hideSecondaryPanels,
    highlightColor,
    isImmersiveMode,
    law,
    loadedReadingPreferencesKey,
    readingFlowMode,
    readingMode,
    showComments,
  ]);

  React.useEffect(() => {
    if (!law) {
      setArticleHighlights({});
      return;
    }

    setArticleHighlights(
      law.articles.reduce<Record<string, LegalHighlightEntry[]>>((accumulator, article) => {
        accumulator[article.id] = readLegalArticleHighlights(currentUserKey, law.id, article.id);
        return accumulator;
      }, {}),
    );
  }, [currentUserKey, law]);

  React.useEffect(() => {
    if (!selectionPopover) {
      return undefined;
    }

    const handlePointerDown = (event: MouseEvent | TouchEvent) => {
      if (selectionPopoverRef.current?.contains(event.target as Node)) {
        return;
      }

      const selection = window.getSelection();
      if (selection && !selection.isCollapsed) {
        return;
      }

      setSelectionPopover(null);
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') {
        return;
      }

      window.getSelection()?.removeAllRanges();
      setSelectionPopover(null);
    };

    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('touchstart', handlePointerDown);
    document.addEventListener('keydown', handleEscape);

    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('touchstart', handlePointerDown);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [selectionPopover]);

  React.useEffect(() => {
    const resolveScrollableParent = (element: HTMLElement | null): HTMLElement | Window => {
      let parent = element?.parentElement ?? null;

      while (parent) {
        const style = window.getComputedStyle(parent);
        const isScrollable = /(auto|scroll)/.test(style.overflowY);
        if (isScrollable && parent.scrollHeight > parent.clientHeight + 4) {
          return parent;
        }
        parent = parent.parentElement;
      }

      return window;
    };

    const target = resolveScrollableParent(pageRootRef.current);
    scrollTargetRef.current = target;
    setIntersectionRoot(target instanceof HTMLElement ? target : null);

    const getScrollTop = () => {
      if (target === window) return window.scrollY || document.documentElement.scrollTop || 0;
      return (target as HTMLElement).scrollTop;
    };

    const onScroll = () => {
      setShowBackToTop(getScrollTop() > 700);
    };

    onScroll();

    if (target === window) {
      window.addEventListener('scroll', onScroll, { passive: true });
      return () => window.removeEventListener('scroll', onScroll);
    }

    (target as HTMLElement).addEventListener('scroll', onScroll, { passive: true });
    return () => (target as HTMLElement).removeEventListener('scroll', onScroll);
  }, []);

  React.useEffect(() => {
    setListVisibleCount(LIST_INITIAL_BATCH);
  }, [LIST_INITIAL_BATCH, articleQuery, updatedOnly, readingMode, commentedViewMode, readingFlowMode, law?.id]);

  React.useEffect(() => {
    return () => {
      highlightFlashTimersRef.current.forEach((timer) => clearTimeout(timer));
      highlightFlashTimersRef.current.clear();
    };
  }, []);

  React.useEffect(() => {
    if (typeof document === 'undefined') return undefined;

    const body = document.body;
    if (isImmersiveMode) {
      body.dataset.legalReadingFocus = 'true';
    } else {
      delete body.dataset.legalReadingFocus;
    }

    return () => {
      delete body.dataset.legalReadingFocus;
    };
  }, [isImmersiveMode]);

  const visibleArticles = React.useMemo(() => {
    if (!law) return [];
    const normalizedQuery = articleQuery.toLowerCase().trim();
    return law.articles.filter((article) => {
      const matchesQuery = !normalizedQuery || getArticleSearchText(article).includes(normalizedQuery);
      const matchesUpdated = !updatedOnly || article.isRecentlyChanged || article.blocks.some((block) => block.isRecentlyChanged);
      return matchesQuery && matchesUpdated;
    });
  }, [articleQuery, law, updatedOnly]);

  const studyContentIndex = React.useMemo(
    () => (law ? buildArticleStudyContentIndex(law) : {
      commentsByArticle: {},
      jurisprudenceByArticle: {},
      tipsByArticle: {},
      communityCommentsByArticle: {},
    }),
    [law],
  );

  const currentReadingArticleId = React.useMemo(
    () => (visibleArticles.some((article) => article.id === activeArticleId) ? activeArticleId : (visibleArticles[0]?.id || '')),
    [activeArticleId, visibleArticles],
  );

  const currentReadingArticleIndex = React.useMemo(
    () => visibleArticles.findIndex((article) => article.id === currentReadingArticleId),
    [currentReadingArticleId, visibleArticles],
  );

  const displayedArticles = React.useMemo(
    () => (readingFlowMode === 'paged'
      ? visibleArticles.filter((article) => article.id === currentReadingArticleId)
      : visibleArticles.slice(0, listVisibleCount)),
    [currentReadingArticleId, listVisibleCount, readingFlowMode, visibleArticles],
  );

  const currentDisplayedArticle = displayedArticles[0] || null;
  const shouldShowPagedNavigator = readingFlowMode === 'paged' && Boolean(currentDisplayedArticle);
  const hasMoreListArticles = readingFlowMode === 'list' && displayedArticles.length < visibleArticles.length;
  const loadMoreListArticles = React.useCallback(() => {
    setListVisibleCount((current) => Math.min(visibleArticles.length, current + LIST_BATCH_SIZE));
  }, [LIST_BATCH_SIZE, visibleArticles.length]);

  React.useEffect(() => {
    if (!hasMoreListArticles || !listSentinelRef.current) {
      return undefined;
    }

    const sentinelNode = listSentinelRef.current;
    const preloadMoreIfNeeded = () => {
      const rect = sentinelNode.getBoundingClientRect();
      const viewportHeight = window.innerHeight || document.documentElement.clientHeight || 0;
      if (rect.top - viewportHeight <= 320) {
        loadMoreListArticles();
      }
    };

    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries.some((entry) => entry.isIntersecting)) {
          return;
        }

        loadMoreListArticles();
      },
      {
        rootMargin: '320px 0px',
      },
    );

    preloadMoreIfNeeded();
    observer.observe(sentinelNode);
    window.addEventListener('resize', preloadMoreIfNeeded, { passive: true });

    return () => {
      observer.disconnect();
      window.removeEventListener('resize', preloadMoreIfNeeded);
    };
  }, [hasMoreListArticles, loadMoreListArticles]);

  React.useEffect(() => {
    if (readingFlowMode !== 'paged' || !currentReadingArticleId) {
      previousPagedArticleIdRef.current = currentReadingArticleId;
      return;
    }

    if (!previousPagedArticleIdRef.current || previousPagedArticleIdRef.current === currentReadingArticleId) {
      previousPagedArticleIdRef.current = currentReadingArticleId;
      return;
    }

    const scrollToArticleTop = () => {
      const targetElement = document.getElementById(currentReadingArticleId);
      if (!targetElement) {
        return;
      }

      targetElement.scrollIntoView({
        behavior: 'smooth',
        block: 'start',
      });
    };

    const frameId = window.requestAnimationFrame(scrollToArticleTop);
    previousPagedArticleIdRef.current = currentReadingArticleId;

    return () => window.cancelAnimationFrame(frameId);
  }, [currentReadingArticleId, readingFlowMode]);

  const persistArticleHighlights = React.useCallback((articleId: string, entries: LegalHighlightEntry[]) => {
    if (!law) return;

    saveLegalArticleHighlights(currentUserKey, law.id, articleId, entries);
    setArticleHighlights((current) => ({
      ...current,
      [articleId]: entries,
    }));
  }, [currentUserKey, law]);

  const getArticleHighlights = React.useCallback((articleId: string) => (
    articleHighlights[articleId] || []
  ), [articleHighlights]);

  const registerHighlightUnit = React.useCallback((articleId: string, unitId: string, unitLabel?: string) => (
    (node: HTMLSpanElement | null) => {
      const registrationKey = `${articleId}::${unitId}`;

      if (!node) {
        highlightUnitRegistrationsRef.current.delete(registrationKey);
        return;
      }

      highlightUnitRegistrationsRef.current.set(registrationKey, {
        textRoot: node,
        container: node.closest('[data-highlight-unit-container]') as HTMLElement | null,
        label: unitLabel,
      });
    }
  ), []);

  const flashHighlightUnit = React.useCallback((articleId: string, unitId: string) => {
    const registration = highlightUnitRegistrationsRef.current.get(`${articleId}::${unitId}`);
    if (!registration?.container) {
      return;
    }

    registration.container.scrollIntoView({ behavior: 'smooth', block: 'center' });
    registration.container.classList.remove('cm-legal-highlight-flash');
    void registration.container.offsetWidth;
    registration.container.classList.add('cm-legal-highlight-flash');

    const existingTimer = highlightFlashTimersRef.current.get(`${articleId}::${unitId}`);
    if (existingTimer) {
      clearTimeout(existingTimer);
    }

    const timer = setTimeout(() => {
      registration.container?.classList.remove('cm-legal-highlight-flash');
      highlightFlashTimersRef.current.delete(`${articleId}::${unitId}`);
    }, 1400);

    highlightFlashTimersRef.current.set(`${articleId}::${unitId}`, timer);
  }, []);

  const focusHighlightEntry = React.useCallback((entry: LegalHighlightEntry) => {
    const unitId = getHighlightEntryUnitId(entry);
    if (!unitId) {
      return;
    }

    flashHighlightUnit(entry.articleId, unitId);
  }, [flashHighlightUnit]);

  const removeHighlightEntry = React.useCallback((articleId: string, highlightId: string) => {
    const currentEntries = getArticleHighlights(articleId);
    persistArticleHighlights(
      articleId,
      currentEntries.filter((entry) => entry.id !== highlightId),
    );
  }, [getArticleHighlights, persistArticleHighlights]);

  React.useEffect(() => {
    if (!nativeInlineHighlightsSupported) {
      return undefined;
    }

    const cssRegistry = (CSS as any).highlights;
    const HighlightConstructor = (window as any).Highlight;

    if (!cssRegistry || typeof HighlightConstructor !== 'function') {
      return undefined;
    }

    const groupedRanges = new Map<LegalHighlightColor, Range[]>(
      HIGHLIGHT_COLORS.map((color) => [color.value, []]),
    );

    Object.values(articleHighlights).flat().forEach((entry) => {
      if (entry.type !== 'selection') {
        return;
      }

      const unitId = getHighlightEntryUnitId(entry);
      if (!unitId) {
        return;
      }

      const registration = highlightUnitRegistrationsRef.current.get(`${entry.articleId}::${unitId}`);
      const textNode = registration?.textRoot.firstChild;
      if (!registration?.textRoot || !textNode || textNode.nodeType !== Node.TEXT_NODE) {
        return;
      }

      const textContent = textNode.textContent || '';
      const resolvedOffsets = resolveHighlightOffsets(textContent, entry);
      if (!resolvedOffsets) {
        return;
      }

      const range = new Range();
      range.setStart(textNode, resolvedOffsets.start);
      range.setEnd(textNode, resolvedOffsets.end);
      groupedRanges.get(entry.color)?.push(range);
    });

    HIGHLIGHT_COLORS.forEach((color) => {
      const ranges = groupedRanges.get(color.value) || [];
      const registryName = NATIVE_HIGHLIGHT_NAMES[color.value];

      if (!ranges.length) {
        cssRegistry.delete?.(registryName);
        return;
      }

      cssRegistry.set(registryName, new HighlightConstructor(...ranges));
    });

    return () => {
      HIGHLIGHT_COLORS.forEach((color) => {
        (CSS as any).highlights?.delete?.(NATIVE_HIGHLIGHT_NAMES[color.value]);
      });
    };
  }, [articleHighlights, displayedArticles, nativeInlineHighlightsSupported]);

  const queueSelectionHighlight = React.useCallback((articleId: string, event: React.MouseEvent<HTMLElement>) => {
    const selection = window.getSelection();
    if (!selection || selection.isCollapsed || selection.rangeCount === 0) {
      setSelectionPopover(null);
      return;
    }

    const range = selection.getRangeAt(0);
    const startRoot = range.startContainer.parentElement?.closest('[data-highlight-text-root="true"]') as HTMLElement | null;
    const endRoot = range.endContainer.parentElement?.closest('[data-highlight-text-root="true"]') as HTMLElement | null;

    if (!startRoot || !endRoot || startRoot !== endRoot) {
      setSelectionPopover(null);
      return;
    }

    const unitId = String(startRoot.dataset.highlightUnitId || '');
    if (!unitId) {
      setSelectionPopover(null);
      return;
    }

    const registration = highlightUnitRegistrationsRef.current.get(`${articleId}::${unitId}`);

    const startOffset = getTextOffsetWithin(startRoot, range.startContainer, range.startOffset);
    const endOffset = getTextOffsetWithin(startRoot, range.endContainer, range.endOffset);
    const selectedText = selection.toString().trim();

    if (!selectedText || startOffset === endOffset) {
      setSelectionPopover(null);
      return;
    }

    const rect = range.getBoundingClientRect();
    const hostRect = (event.currentTarget as HTMLElement).getBoundingClientRect();

    if (
      rect.bottom < hostRect.top
      || rect.top > hostRect.bottom
      || rect.right < hostRect.left
      || rect.left > hostRect.right
    ) {
      setSelectionPopover(null);
      return;
    }

    setSelectionPopover({
      articleId,
      unitId,
      unitLabel: registration?.label,
      preview: buildHighlightPreview(selectedText),
      selectedText,
      startOffset: Math.min(startOffset, endOffset),
      endOffset: Math.max(startOffset, endOffset),
      x: rect.left + (rect.width / 2),
      y: rect.top - 12,
    });
  }, []);

  const applySelectionHighlight = React.useCallback((color: LegalHighlightColor) => {
    if (!selectionPopover) return;

    const currentEntries = getArticleHighlights(selectionPopover.articleId);
    persistArticleHighlights(selectionPopover.articleId, [
      ...currentEntries,
      {
        id: `highlight:${Date.now()}:${Math.random().toString(16).slice(2)}`,
        type: 'selection',
        articleId: selectionPopover.articleId,
        color,
        createdAt: Date.now(),
        unitId: selectionPopover.unitId,
        unitLabel: selectionPopover.unitLabel,
        preview: selectionPopover.preview,
        selectedText: selectionPopover.selectedText,
        startAnchor: buildHighlightAnchor(selectionPopover.unitId, selectionPopover.startOffset),
        endAnchor: buildHighlightAnchor(selectionPopover.unitId, selectionPopover.endOffset),
      },
    ]);

    window.getSelection()?.removeAllRanges();
    setSelectionPopover(null);
  }, [getArticleHighlights, persistArticleHighlights, selectionPopover]);

  const clearHighlightsForArticle = React.useCallback((articleId: string) => {
    if (!law || !articleId) return;

    clearLegalArticleHighlights(currentUserKey, law.id, articleId);
    setArticleHighlights((current) => ({
      ...current,
      [articleId]: [],
    }));
    setSelectionPopover((current) => (current?.articleId === articleId ? null : current));
  }, [currentUserKey, law]);

  const toggleFavorite = React.useCallback(async (type: LegalFavoriteType, targetId: string) => {
    if (!currentUser) {
      addToast('Entre na sua conta para salvar favoritos.', 'warning');
      return;
    }

    try {
      const result = await legalCommentaryApiService.toggleFavorite(type, targetId);
      await reloadLaw({ force: true });
      addToast(result.isFavorite ? 'Item salvo nos favoritos.' : 'Item removido dos favoritos.', 'success');
    } catch {
      addToast('Nao foi possivel atualizar o favorito.', 'error');
    }
  }, [addToast, currentUser, reloadLaw]);

  const handleArticleFocus = React.useCallback((article: LawArticle) => {
    if (!law || activeArticleId === article.id) return;
    setActiveArticleId(article.id);
    if (!currentUser) return;
    if (recordedArticleViewsRef.current.has(article.id)) return;

    setLaw((current) => {
      if (!current) {
        return current;
      }

      const previousProgress = current.progress;
      const viewedArticleIds = Array.from(new Set([...(previousProgress?.viewedArticleIds || []), article.id]));
      const articleCount = Math.max(1, current.articleCount || current.articles.length || 1);

      return {
        ...current,
        progress: {
          id: previousProgress?.id || `local-progress:${current.id}`,
          userId: previousProgress?.userId || String(getUserId(currentUser) || 'guest'),
          lawId: current.id,
          viewedArticleIds,
          lastArticleId: article.id,
          lastViewedAt: new Date().toISOString(),
          progressPercent: Math.min(100, Math.round((viewedArticleIds.length / articleCount) * 100)),
        },
      };
    });

    recordedArticleViewsRef.current.add(article.id);
    void legalCommentaryApiService.recordArticleView(law.id, article.id).catch(() => {
      recordedArticleViewsRef.current.delete(article.id);
    });
  }, [activeArticleId, currentUser, law]);

  const handleCopyLink = React.useCallback(async () => {
    if (typeof window === 'undefined') return;
    await navigator.clipboard?.writeText(window.location.href);
    addToast('Link copiado.', 'success');
  }, [addToast]);

  const handleShare = React.useCallback(async () => {
    if (!law || typeof window === 'undefined') return;
    if (navigator.share) {
      await navigator.share({ title: law.shortTitle, url: window.location.href });
      return;
    }

    await handleCopyLink();
  }, [handleCopyLink, law]);

  const handleBackToTop = React.useCallback(() => {
    const target = scrollTargetRef.current;
    if (!target || target === window) {
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }

    (target as HTMLElement).scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  const toggleCommentsVisibility = React.useCallback(() => {
    setShowComments((current) => !current);
    setCommentsSyncToken((current) => current + 1);
  }, []);

  const toggleImmersiveMode = React.useCallback(() => {
    setIsImmersiveMode((current) => !current);
  }, []);

  const navigatePagedArticle = React.useCallback((direction: -1 | 1) => {
    const nextArticle = visibleArticles[currentReadingArticleIndex + direction];
    if (!nextArticle) return;
    void handleArticleFocus(nextArticle);
  }, [currentReadingArticleIndex, handleArticleFocus, visibleArticles]);

  const handleArticleClick = React.useCallback((article: LawArticle) => {
    const selection = window.getSelection();
    if (selection && !selection.isCollapsed) {
      return;
    }

    void handleArticleFocus(article);
  }, [handleArticleFocus]);

  const readingToolsContextValue = React.useMemo<LegalReadingToolsContextValue>(() => ({
    registerHighlightUnit,
    queueSelectionHighlight,
  }), [
    registerHighlightUnit,
    queueSelectionHighlight,
  ]);

  const addComment = React.useCallback(async (articleId: string, body: string) => {
    if (!currentUser) {
      addToast('Entre na sua conta para comentar.', 'warning');
      return;
    }

    try {
      await legalCommentaryApiService.addUserComment({
        articleId,
        body,
      });
      await reloadLaw({ force: true });
      addToast('Comentário publicado.', 'success');
    } catch (error: any) {
      addToast(error?.message || 'Não foi possível comentar.', 'error');
    }
  }, [addToast, currentUser, reloadLaw]);

  const editComment = React.useCallback(async (commentId: string, body: string) => {
    try {
      await legalCommentaryApiService.updateUserComment(commentId, body);
      await reloadLaw({ force: true });
      addToast('Comentário atualizado.', 'success');
    } catch (error: any) {
      addToast(error?.message || 'Não foi possível editar.', 'error');
    }
  }, [addToast, reloadLaw]);

  const deleteComment = React.useCallback(async (commentId: string) => {
    try {
      await legalCommentaryApiService.deleteUserComment(commentId);
      await reloadLaw({ force: true });
      addToast('Comentário excluído.', 'success');
    } catch (error: any) {
      addToast(error?.message || 'Não foi possível excluir.', 'error');
    }
  }, [addToast, reloadLaw]);

  if (isLoading) {
    return <LawDetailLoadingState />;
  }

  if (!law) {
    return (
      <div className={`${PLATFORM_SURFACE_CARD_CLASS} p-10 text-center`}>
        <BookOpen className="mx-auto mb-4 text-slate-300 dark:text-slate-600" size={42} />
        <h1 className={PLATFORM_PAGE_TITLE_CLASS}>Lei não encontrada</h1>
        <Link href="/lei-comentada" className="mt-6 inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-5 py-3 text-xs font-black uppercase tracking-widest text-white transition-colors hover:bg-indigo-700">
          <ArrowLeft size={14} /> Voltar
        </Link>
      </div>
    );
  }

  return (
    <LegalReadingToolsContext.Provider value={readingToolsContextValue}>
    <div
      ref={pageRootRef}
      data-reading-focus={isImmersiveMode ? 'true' : 'false'}
      className={`cm-legal-reading-page w-full animate-fade-in ${isImmersiveMode ? 'space-y-4' : 'space-y-6'}`}
    >
      <section className={`${PLATFORM_SURFACE_CARD_CLASS} overflow-hidden`}>
        <div className="cm-legal-reading-top-grid grid gap-0 xl:grid-cols-[minmax(0,1fr)_340px]">
          <div className="px-6 py-7 md:px-8">
            <Link href="/lei-comentada" className="mb-5 inline-flex items-center gap-2 text-xs font-black uppercase tracking-[0.16em] text-slate-400 transition-colors hover:text-indigo-600 dark:text-slate-500 dark:hover:text-indigo-300">
              <ArrowLeft size={14} /> Voltar para leis
            </Link>

            <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
              <div className="min-w-0">
                <p className="text-[10px] font-black uppercase tracking-[0.22em] text-indigo-600 dark:text-indigo-300">{law.area.name}</p>
                <h1 className={`${PLATFORM_PAGE_TITLE_CLASS} mt-2`}>{law.shortTitle}</h1>
                <p className={`${PLATFORM_PAGE_DESCRIPTION_CLASS} mt-2`}>{law.ementa}</p>
              </div>

              <div className="flex shrink-0 flex-wrap gap-2">
                <FavoriteIconButton isFavorite={law.isFavorite} title="Favoritar lei" onClick={() => toggleFavorite('law', law.id)} />
                <button onClick={handleShare} className="flex h-9 w-9 items-center justify-center rounded-xl text-slate-400 transition-colors hover:bg-slate-100 hover:text-indigo-600 dark:hover:bg-slate-800 dark:hover:text-indigo-300" title="Compartilhar">
                  <Share2 size={16} />
                </button>
                <button onClick={handleCopyLink} className="flex h-9 w-9 items-center justify-center rounded-xl text-slate-400 transition-colors hover:bg-slate-100 hover:text-indigo-600 dark:hover:bg-slate-800 dark:hover:text-indigo-300" title="Copiar link">
                  <Clipboard size={16} />
                </button>
              </div>
            </div>

            <div className="mt-6 grid gap-3 sm:grid-cols-3">
              <div className="rounded-2xl bg-slate-50 p-4 dark:bg-slate-800/70">
                <p className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">Promulgada</p>
                <p className="mt-2 text-sm font-black text-slate-900 dark:text-slate-100">{formatDate(law.date)}</p>
              </div>
              <div className="rounded-2xl bg-slate-50 p-4 dark:bg-slate-800/70">
                <p className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">Comentados</p>
                <p className="mt-2 text-sm font-black text-slate-900 dark:text-slate-100">{law.commentedArticleCount}/{law.articleCount}</p>
              </div>
              <div className="rounded-2xl bg-slate-50 p-4 dark:bg-slate-800/70">
                <p className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">Progresso</p>
                <p className="mt-2 text-sm font-black text-slate-900 dark:text-slate-100">{law.progress?.progressPercent || 0}% lido</p>
              </div>
            </div>
          </div>

          <aside className="cm-legal-reading-source-panel border-t border-slate-200 bg-slate-50 px-6 py-7 dark:border-slate-800 dark:bg-slate-950/70 md:px-8 xl:border-l xl:border-t-0">
            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400 dark:text-slate-500">Fonte oficial</p>
            <a href={law.officialUrl} target="_blank" rel="noreferrer" className="mt-3 inline-flex w-full items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-4 text-sm font-black text-slate-700 transition-colors hover:border-indigo-200 hover:text-indigo-600 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200 dark:hover:border-indigo-500/40 dark:hover:text-indigo-300">
              Portal do Planalto
              <ExternalLink size={16} />
            </a>
            <div className="mt-5">
              <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400 dark:text-slate-500">Última sincronização</p>
              <p className="mt-2 text-sm font-black text-slate-900 dark:text-slate-100">{formatDate(law.lastSyncedAt)}</p>
            </div>
            <div className="mt-5 h-2 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800">
              <div className="h-full rounded-full bg-indigo-600 dark:bg-indigo-500" style={{ width: `${law.progress?.progressPercent || 0}%` }} />
            </div>
          </aside>
        </div>
      </section>

      <div className="cm-legal-reading-body-grid grid items-start gap-6 xl:grid-cols-[300px_minmax(0,1fr)]">
        <aside className="cm-legal-reading-index-panel hidden xl:sticky xl:top-0 xl:block xl:h-fit">
          <section className={`${PLATFORM_SURFACE_CARD_CLASS} p-4 shadow-xl shadow-slate-200/60 dark:shadow-none`}>
              <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400 dark:text-slate-500">Índice</p>
              <h2 className="mt-2 text-base font-black text-slate-900 dark:text-slate-100">Artigos desta lei</h2>
              <nav className="no-scrollbar mt-4 max-h-[calc(100vh-7rem)] space-y-1 overflow-y-auto pr-1">
                {visibleArticles.map((article) => (
                  <a
                    key={article.id}
                    href={`#${article.id}`}
                    onClick={() => handleArticleFocus(article)}
                    className={`flex items-center justify-between rounded-xl px-3 py-2.5 text-sm font-bold transition-colors ${activeArticleId === article.id ? 'bg-indigo-600 text-white' : 'text-slate-500 hover:bg-slate-50 hover:text-indigo-600 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-indigo-300'}`}
                  >
                    <span className="truncate">Art. {article.number}</span>
                    <ChevronDown size={13} className="-rotate-90 shrink-0" />
                  </a>
                ))}
              </nav>
            </section>
        </aside>

        <section className={`min-w-0 space-y-5 pb-28 md:pb-32 ${isImmersiveMode ? 'xl:max-w-none' : ''}`}>
          <section className={`${PLATFORM_SURFACE_CARD_CLASS} p-4 md:p-5`}>
            <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_320px]">
              <div className="relative">
                <Search className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                <input
                  value={articleQuery}
                  onChange={(event) => setArticleQuery(event.target.value)}
                  placeholder={readingMode === 'dry' ? 'Buscar artigo ou termo no texto legal' : 'Buscar artigo, termo, jurisprudência ou macete'}
                  className="h-12 w-full rounded-2xl border border-slate-200 bg-slate-50 pl-11 pr-4 text-sm font-semibold text-slate-900 outline-none transition-all focus:border-indigo-300 focus:bg-white focus:ring-4 focus:ring-indigo-500/10 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100 dark:focus:border-indigo-500 dark:focus:bg-slate-900"
                />
              </div>

              <div className="grid grid-cols-2 rounded-2xl bg-slate-100 p-1 dark:bg-slate-800">
                <button
                  onClick={() => setReadingMode('commented')}
                  className={`flex h-10 items-center justify-center gap-2 rounded-xl text-xs font-black transition-all ${readingMode === 'commented' ? 'bg-white text-indigo-600 shadow-sm dark:bg-slate-900 dark:text-indigo-300' : 'text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100'}`}
                  aria-pressed={readingMode === 'commented'}
                >
                  <BookOpen size={15} />
                  Comentada
                </button>
                <button
                  onClick={() => setReadingMode('dry')}
                  className={`flex h-10 items-center justify-center gap-2 rounded-xl text-xs font-black transition-all ${readingMode === 'dry' ? 'bg-white text-indigo-600 shadow-sm dark:bg-slate-900 dark:text-indigo-300' : 'text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100'}`}
                  aria-pressed={readingMode === 'dry'}
                >
                  <FileText size={15} />
                  Lei seca
                </button>
              </div>
            </div>

            <div className="mt-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400 dark:text-slate-500">Modo de leitura</p>
                <h2 className={PLATFORM_SECTION_TITLE_CLASS}>
                  {readingMode === 'dry' ? 'Leitura do texto legal' : 'Estudo comentado para concursos'}
                </h2>
                <p className="mt-1 text-xs font-medium leading-5 text-slate-500 dark:text-slate-400">
                  {readingMode === 'dry'
                    ? 'Exibe apenas o texto oficial dos artigos, com foco em leitura rápida e revisão literal.'
                    : 'Mantém comentários de professores, jurisprudência, súmulas, macetes, anotações e comunidade.'}
                </p>
              </div>

              {readingMode === 'commented' ? (
                <div className="grid grid-cols-2 rounded-2xl bg-slate-100 p-1 dark:bg-slate-800">
                  <button
                    onClick={() => setCommentedViewMode('cards')}
                    className={`flex h-10 min-w-[118px] items-center justify-center gap-2 rounded-xl px-4 text-xs font-black transition-all ${commentedViewMode === 'cards' ? 'bg-white text-indigo-600 shadow-sm dark:bg-slate-900 dark:text-indigo-300' : 'text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100'}`}
                    aria-pressed={commentedViewMode === 'cards'}
                  >
                    <BookOpen size={14} />
                    Cards
                  </button>
                  <button
                    onClick={() => setCommentedViewMode('pdf')}
                    className={`flex h-10 min-w-[118px] items-center justify-center gap-2 rounded-xl px-4 text-xs font-black transition-all ${commentedViewMode === 'pdf' ? 'bg-white text-indigo-600 shadow-sm dark:bg-slate-900 dark:text-indigo-300' : 'text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100'}`}
                    aria-pressed={commentedViewMode === 'pdf'}
                  >
                    <FileText size={14} />
                    Modo PDF
                  </button>
                </div>
              ) : null}

              {law.updates.length > 0 ? (
                <button
                  onClick={() => setUpdatedOnly((current) => !current)}
                  className={`flex h-11 min-w-[220px] items-center justify-between rounded-2xl border px-4 text-sm font-black transition-colors ${updatedOnly ? 'border-amber-300 bg-amber-100 text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200' : 'border-slate-200 bg-slate-50 text-slate-500 hover:text-amber-700 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-300 dark:hover:text-amber-300'}`}
                >
                  <span className="inline-flex items-center gap-2"><AlertTriangle size={16} /> Atualizações</span>
                  <span>{law.updates.length}</span>
                </button>
              ) : null}
            </div>
          </section>

          <LegalReadingToolsBar
            readingMode={readingMode}
            readingFlowMode={readingFlowMode}
            isImmersiveMode={isImmersiveMode}
            showComments={showComments}
            highlightColor={highlightColor}
            hasHighlightsForActiveArticle={(articleHighlights[currentReadingArticleId] || []).length > 0}
            onToggleImmersiveMode={toggleImmersiveMode}
            onToggleComments={toggleCommentsVisibility}
            onSetReadingFlowMode={setReadingFlowMode}
            onSetHighlightColor={setHighlightColor}
            onClearActiveArticleHighlights={() => clearHighlightsForArticle(currentReadingArticleId)}
          />

          {shouldShowPagedNavigator && currentDisplayedArticle ? (
            <PagedArticleNavigator
              articleNumber={currentDisplayedArticle.number}
              totalArticles={visibleArticles.length}
              articleIndex={currentReadingArticleIndex}
              onPrevious={() => navigatePagedArticle(-1)}
              onNext={() => navigatePagedArticle(1)}
            />
          ) : null}

          {isDocumentMode ? (
            <div className="min-w-0">
              {readingMode === 'dry' ? (
                <DryLawDocument
                  law={law}
                  articles={displayedArticles}
                  onArticleFocus={handleArticleClick}
                  getArticleHighlights={getArticleHighlights}
                  nativeInlineHighlightsSupported={nativeInlineHighlightsSupported}
                  onFocusHighlight={focusHighlightEntry}
                  onRemoveHighlight={removeHighlightEntry}
                />
              ) : (
                <CommentedLawDocumentCollapsible
                  law={law}
                  articles={displayedArticles}
                  currentUser={currentUser}
                  commentsExpanded={showComments}
                  accordionSyncToken={commentsSyncToken}
                  studyContentIndex={studyContentIndex}
                  getArticleHighlights={getArticleHighlights}
                  nativeInlineHighlightsSupported={nativeInlineHighlightsSupported}
                  onFocusHighlight={focusHighlightEntry}
                  onRemoveHighlight={removeHighlightEntry}
                  onFavorite={toggleFavorite}
                  onArticleFocus={handleArticleClick}
                  onAddComment={addComment}
                  onDeleteComment={deleteComment}
                  onEditComment={editComment}
                />
              )}
            </div>
          ) : (
          <div className="space-y-5">
            {displayedArticles.map((article) => {
              const { comments, jurisprudence, allTips, communityComments } = getArticleStudyContent(studyContentIndex, article);

              return (
                <article
                  key={article.id}
                  id={article.id}
                  onClick={() => handleArticleClick(article)}
                  className="scroll-mt-6 rounded-[2rem] border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900 md:p-6"
                >
                  <header className="mb-4 flex items-start justify-between gap-4">
                    <div>
                      <div className="mb-3 flex items-center gap-2">
                        <span className="rounded-full bg-indigo-600 px-3 py-1 text-[10px] font-black uppercase tracking-widest text-white">Art. {article.number}</span>
                        <span className="text-xs font-semibold text-slate-400">{article.hierarchy.chapter || article.hierarchy.title || law.area.name}</span>
                      </div>
                      {article.title ? <h2 className="text-lg font-black text-slate-950 dark:text-white">{article.title}</h2> : null}
                    </div>
                    <FavoriteIconButton isFavorite={article.isFavorite} title="Favoritar artigo" onClick={() => toggleFavorite('article', article.id)} />
                  </header>

                  <ArticleLegalText article={article} variant="card" />
                  <ArticleHighlightChips
                    article={article}
                    highlights={getArticleHighlights(article.id)}
                    nativeInlineHighlightsSupported={nativeInlineHighlightsSupported}
                    onFocus={focusHighlightEntry}
                    onRemove={removeHighlightEntry}
                  />

                  {readingMode === 'commented' ? (
                  <div className="mt-5">
                    {comments.length > 0 ? (
                      <AccordionRow key={`teacher-${article.id}-${commentsSyncToken}`} icon={GraduationCap} title="Comentário do professor" count={comments.length} tone="blue" defaultOpen={showComments}>
                        <TeacherCommentsContent comments={comments} onFavorite={toggleFavorite} />
                      </AccordionRow>
                    ) : null}

                    {article.doctrine && article.doctrine.length > 0 ? (
                      <AccordionRow key={`doctrine-${article.id}-${commentsSyncToken}`} icon={BookMarked} title="Doutrina" count={article.doctrine.length} tone="green" defaultOpen={showComments}>
                        <TextListContent items={article.doctrine} tone="green" />
                      </AccordionRow>
                    ) : null}

                    {jurisprudence.length > 0 ? (
                      <AccordionRow key={`juris-${article.id}-${commentsSyncToken}`} icon={Scale} title="Jurisprudência" count={jurisprudence.length} tone="purple" defaultOpen={showComments}>
                        <JurisprudenceContent items={jurisprudence} onFavorite={toggleFavorite} />
                      </AccordionRow>
                    ) : null}

                    {article.jurisprudenceNotes && article.jurisprudenceNotes.length > 0 ? (
                      <AccordionRow key={`juris-note-${article.id}-${commentsSyncToken}`} icon={Scale} title="Jurisprudência" count={article.jurisprudenceNotes.length} tone="purple" defaultOpen={showComments}>
                        <TextListContent items={article.jurisprudenceNotes} tone="purple" />
                      </AccordionRow>
                    ) : null}

                    {article.syllabi && article.syllabi.length > 0 ? (
                      <AccordionRow key={`syllabi-${article.id}-${commentsSyncToken}`} icon={Landmark} title="Súmulas relacionadas" count={article.syllabi.length} tone="red" defaultOpen={showComments}>
                        <SyllabiContent items={article.syllabi} />
                      </AccordionRow>
                    ) : null}

                    {allTips.length > 0 ? (
                      <AccordionRow key={`tips-${article.id}-${commentsSyncToken}`} icon={Lightbulb} title="Macete" count={allTips.length} tone="amber" defaultOpen={showComments}>
                        <ExamTipsContent tips={allTips} />
                      </AccordionRow>
                    ) : null}

                    <AccordionRow key={`notes-${article.id}-${commentsSyncToken}`} icon={StickyNote} title="Minhas anotações" tone="slate" defaultOpen={showComments}>
                      <ArticleNotesContent articleId={article.id} law={law} article={article} currentUser={currentUser} />
                    </AccordionRow>

                    <AccordionRow key={`community-${article.id}-${commentsSyncToken}`} icon={MessageCircle} title="Comentários dos alunos" count={communityComments.length} tone="red" defaultOpen={showComments}>
                      <CommunityCommentsContent
                        articleId={article.id}
                        comments={law.userComments}
                        currentUser={currentUser}
                        onAdd={addComment}
                        onDelete={deleteComment}
                        onEdit={editComment}
                      />
                    </AccordionRow>

                    {typeof article.relatedQuestionCount === 'number' ? (
                      <div className="flex items-center justify-between border-t border-slate-100 pt-3 text-xs font-black dark:border-slate-800">
                        <Link href="/practice" className="text-indigo-600 hover:underline dark:text-indigo-300">
                          {article.relatedQuestionCount} questões relacionadas
                        </Link>
                        <button className="inline-flex items-center gap-1 text-slate-400 transition-colors hover:text-slate-700 dark:hover:text-slate-200">
                          <MessageCircle size={13} /> Comentar
                        </button>
                      </div>
                    ) : null}
                  </div>
                  ) : null}
                </article>
              );
            })}

          </div>
          )}

          {hasMoreListArticles ? (
            <div className="flex flex-col items-center gap-3 py-2">
              <div ref={listSentinelRef} className="h-4 w-full" aria-hidden="true" />
              <button
                type="button"
                onClick={loadMoreListArticles}
                className="inline-flex h-10 items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-xs font-black text-slate-700 transition-colors hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-800"
              >
                Carregar mais artigos
              </button>
            </div>
          ) : null}

          {shouldShowPagedNavigator && currentDisplayedArticle ? (
            <PagedArticleNavigator
              articleNumber={currentDisplayedArticle.number}
              totalArticles={visibleArticles.length}
              articleIndex={currentReadingArticleIndex}
              onPrevious={() => navigatePagedArticle(-1)}
              onNext={() => navigatePagedArticle(1)}
            />
          ) : null}
        </section>
      </div>

      <style jsx global>{`
        .cm-legal-reading-page[data-reading-focus='true'] .cm-legal-reading-top-grid {
          grid-template-columns: minmax(0, 1fr);
        }

        .cm-legal-reading-page[data-reading-focus='true'] .cm-legal-reading-source-panel,
        .cm-legal-reading-page[data-reading-focus='true'] .cm-legal-reading-index-panel {
          display: none;
        }

        .cm-legal-reading-page[data-reading-focus='true'] .cm-legal-reading-body-grid {
          grid-template-columns: minmax(0, 1fr);
        }

        ::highlight(${NATIVE_HIGHLIGHT_NAMES.yellow}) {
          background: rgba(252, 211, 77, 0.7);
          color: #0f172a;
        }

        ::highlight(${NATIVE_HIGHLIGHT_NAMES.blue}) {
          background: rgba(125, 211, 252, 0.72);
          color: #0f172a;
        }

        ::highlight(${NATIVE_HIGHLIGHT_NAMES.pink}) {
          background: rgba(249, 168, 212, 0.72);
          color: #0f172a;
        }

        ::highlight(${NATIVE_HIGHLIGHT_NAMES.green}) {
          background: rgba(110, 231, 183, 0.72);
          color: #0f172a;
        }

        .cm-legal-highlight-flash {
          box-shadow: 0 0 0 2px rgba(99, 102, 241, 0.16);
          background: rgba(99, 102, 241, 0.08);
          border-radius: 1rem;
          transition: background-color 180ms ease, box-shadow 180ms ease;
        }
      `}</style>

      {selectionPopover ? (
        <div
          ref={selectionPopoverRef}
          className="fixed z-50 -translate-x-1/2 rounded-2xl border border-slate-200 bg-white/95 p-2 shadow-2xl backdrop-blur dark:border-slate-800 dark:bg-slate-900/95"
          style={{
            left: Math.max(84, Math.min(selectionPopover.x, (typeof window !== 'undefined' ? window.innerWidth : selectionPopover.x) - 84)),
            top: Math.max(16, selectionPopover.y),
          }}
        >
          <div className="flex items-center gap-2">
            {HIGHLIGHT_COLORS.map((color) => (
              <button
                key={color.value}
                type="button"
                title={`Destacar com ${color.label.toLowerCase()}`}
                onClick={() => applySelectionHighlight(color.value)}
                className={`h-7 w-7 rounded-full border-2 ${color.swatchClassName} ${highlightColor === color.value ? 'border-slate-900 dark:border-white' : 'border-white/70 dark:border-slate-700'}`}
              />
            ))}
          </div>
        </div>
      ) : null}

      <button
        onClick={handleBackToTop}
        aria-label="Voltar ao topo"
        className={`fixed bottom-4 right-4 z-40 inline-flex items-center gap-2 rounded-full border border-indigo-200 bg-white/95 px-3 py-2 text-[10px] font-black uppercase tracking-widest text-indigo-700 shadow-lg shadow-indigo-200/60 transition-all duration-300 dark:border-indigo-900/40 dark:bg-slate-900/95 dark:text-indigo-300 dark:shadow-none sm:bottom-6 sm:right-6 sm:px-4 sm:text-[11px] ${showBackToTop ? 'translate-y-0 opacity-100' : 'pointer-events-none translate-y-4 opacity-0'}`}
      >
        <ArrowUp size={14} />
        Topo
      </button>
    </div>
    </LegalReadingToolsContext.Provider>
  );
};

export default LawDetailPage;





