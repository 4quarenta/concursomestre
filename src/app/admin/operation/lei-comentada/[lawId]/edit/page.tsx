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
import { createPortal } from 'react-dom';
import Link from 'next/link';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { useAppConfigStore } from '@/state/app-config/appConfigStore';
import { useTaxonomyActions } from '@/state/app-config/useTaxonomyActions';
import {
  AlertCircle,
  BookOpen,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Download,
  Eye,
  ExternalLink,
  FileText,
  GripVertical,
  Lightbulb,
  Loader2,
  MessageSquare,
  Plus,
  RefreshCcw,
  Save,
  Scale,
  Sparkles,
  Trash2,
  X,
} from 'lucide-react';
import { useAuth } from '@providers/AuthProvider';
import { useConfirm } from '@providers/ModalProvider';
import { useToast } from '@providers/ToastProvider';
import { canAccessAdminPanel } from '@services/auth';
import MathRichText from '@/components/shared/math/MathRichText';
import RichTextEditor from '@/components/shared/ui/RichTextEditor';
import { filtersService } from '@services/filters';
import { legalCommentaryApiService } from '@services/legal-commentary';
import type {
  ArticleExamTip,
  ArticleJurisprudence,
  LawArticle,
  LawDetail,
  LawSection,
  LawSectionEditorial,
  LawUpdate,
  LegalArticleBlock,
  LegalArticleEditorialSnapshot,
  LegalArticleSyllabus,
  LegalTargetedText,
  LegalArea,
  LegalEditorialGenerationResult,
  LegalEditorialGenerationScope,
  LegalRichContentBlock,
  LegalSyncLog,
  TeacherComment,
} from '@types';
import {
  ADMIN_MODAL_FOOTER_CLASS,
  ADMIN_MODAL_HEADER_CLASS,
  ADMIN_MODAL_PANEL_CLASS,
  ADMIN_PRIMARY_BUTTON_CLASS,
  ADMIN_SECONDARY_BUTTON_CLASS,
  ADMIN_SURFACE_CLASS,
  ADMIN_FIELD_CLASS,
  ADMIN_TEXTAREA_CLASS,
} from '../../../../components/shared/adminPanelStyles';
import AdminStandaloneShell from '../../../../components/shared/AdminStandaloneShell';
import { buildAdminLawEditPath } from '../../../../config/adminPageNavigationConfig';

type AdminLawDraft = Partial<LawDetail> & {
  areaId?: string;
  legalAreaId?: string;
  sumulas?: LegalArticleSyllabus[];
  publishedAt?: string;
  published_at?: string;
};

type GeneratedArticleContentKind = 'teacher' | 'tip' | 'jurisprudence' | 'sumula' | 'doctrine' | 'jurisprudenceNote';

interface TaxonomyOption {
  id: string | number;
  name: string;
  slug?: string;
  parentId?: string | number | null;
  rootSubjectId?: string | number | null;
  taxonomyLevel?: string;
}

type RawTaxonomyOption = Record<string, unknown>;
type LawDetailAdminAliases = Partial<LawDetail> & {
  legalAreaId?: unknown;
  preamble?: unknown;
  area?: (Partial<LegalArea> & { legalAreaId?: unknown }) | null;
};
type ArticleEditorialCounts = {
  teacher: number;
  tips: number;
  jurisprudence: number;
  sumulas: number;
  doctrine: number;
  total: number;
};

type AdminLawSectionOverview = LawSection & {
  resolvedSectionId: string;
  articleIds: string[];
  articles: number;
  primaryArticleId: string;
  articlesList: LawArticle[];
  counts: ArticleEditorialCounts;
  savedEditorial?: LawSectionEditorial;
  hasAnalysis: boolean;
};

type LegalAiGenerationKind = 'teacher-comment' | 'exam-tip' | 'jurisprudence' | 'sumula' | 'doctrine' | 'bundle';

type LegalArticleAiKind = Exclude<LegalAiGenerationKind, 'bundle'>;

type LegalAiBulkTask =
  | {
    id: string;
    type: 'section-analysis';
    label: string;
    section: AdminLawSectionOverview;
  }
  | {
    id: string;
    type: 'article-field';
    label: string;
    article: LawArticle;
    kind: LegalArticleAiKind;
  };

type LegalAiBulkProgress = {
  total: number;
  completed: number;
  failed: number;
  currentLabel: string;
  running: boolean;
};

const LEGAL_BLOCK_KINDS: Array<{ value: LegalArticleBlock['kind']; label: string }> = [
  { value: 'caput', label: 'Caput' },
  { value: 'paragraph', label: 'Paragrafo' },
  { value: 'inciso', label: 'Inciso' },
  { value: 'alinea', label: 'Alinea' },
  { value: 'item', label: 'Item' },
  { value: 'note', label: 'Nota oficial' },
];

const LEGAL_BLOCK_KIND_LABEL = LEGAL_BLOCK_KINDS.reduce<Record<string, string>>((labels, kind) => ({
  ...labels,
  [kind.value]: kind.label,
}), {});

const createTempId = (prefix: string) => `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;

const formatSectionRange = (section: Pick<LawSection, 'fromArticle' | 'toArticle'>) => {
  const from = String(section.fromArticle || '').trim();
  const to = String(section.toArticle || '').trim();
  if (!from && !to) return '';
  if (!to || from === to) return `Art. ${from}`;
  return `Art. ${from} ao Art. ${to}`;
};

const normalizeParam = (value?: string | string[]) => Array.isArray(value) ? value[0] : value;

const getErrorMessage = (error: unknown, fallback: string) => (
  error && typeof error === 'object' && 'message' in error && typeof error.message === 'string'
    ? error.message
    : fallback
);

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

const buildSingleSectionAnalysisBlocks = (content: string): LegalRichContentBlock[] => {
  const normalizedContent = String(content || '').trim();
  if (!normalizedContent) {
    return [];
  }

  return [{
    type: 'summary',
    title: 'Analise detalhada da secao',
    content: normalizedContent,
    items: [],
    headers: [],
    rows: [],
    target: { kind: 'section' },
  }];
};

const getLegalAreaId = (area: unknown): string => {
  if (!area || typeof area !== 'object' || !('legalAreaId' in area)) {
    return '';
  }

  const { legalAreaId } = area as { legalAreaId?: unknown };
  return String(legalAreaId || '');
};

const normalizeTaxonomyText = (value: unknown) => String(value || '')
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .toLowerCase()
  .trim();

const slugifyTaxonomy = (value: string) => normalizeTaxonomyText(value)
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/^-+|-+$/g, '');

const sanitizeLegacyTaxonomyLabel = (value: string) => value
  .replace(/\((?:area|área)\s+antiga\)/ig, '')
  .replace(/\s{2,}/g, ' ')
  .trim();

const isNumericOnlyLabel = (value: string) => /^\d+$/.test(String(value || '').trim());

const buildDefaultBlockLabel = (kind: LegalArticleBlock['kind'], articleNumber: string, sequence: number) => {
  if (kind === 'caput') {
    return articleNumber ? `Art. ${articleNumber}` : 'Art.';
  }
  if (kind === 'paragraph') {
    return `§ ${sequence}o`;
  }
  if (kind === 'inciso') {
    return `${sequence}`;
  }
  if (kind === 'alinea') {
    return `${String.fromCharCode(96 + Math.min(sequence, 26))})`;
  }
  if (kind === 'item') {
    return `${sequence}`;
  }
  return 'Nota';
};

const buildArticleTextFromBlocks = (blocks: LegalArticleBlock[]) => blocks
  .map((block) => {
    const label = String(block.label || '').trim();
    const text = String(block.text || '').trim();
    if (!label && !text) return '';
    return [label, text].filter(Boolean).join(' ').trim();
  })
  .filter(Boolean)
  .join('\n');

const normalizeArticleBlocks = (article: LawArticle): LegalArticleBlock[] => {
  const seedBlocks = Array.isArray(article.blocks) ? article.blocks : [];
  const filtered = seedBlocks
    .map((block, index) => {
      const kind = (block.kind || 'caput') as LegalArticleBlock['kind'];
      return {
        id: block.id || `${article.id}-block-${index + 1}`,
        kind,
        label: String(block.label || '').trim(),
        text: String(block.text || '').trim(),
      } as LegalArticleBlock;
    })
    .filter((block) => block.label || block.text);

  const baseBlocks = filtered.length > 0 ? filtered : [{
    id: `${article.id}-caput`,
    kind: 'caput' as const,
    label: article.number ? `Art. ${article.number}` : 'Art.',
    text: String(article.text || '').trim(),
  }];

  const caputIndex = baseBlocks.findIndex((block) => block.kind === 'caput');
  const withCaput = caputIndex >= 0
    ? [
      baseBlocks[caputIndex],
      ...baseBlocks.filter((_, index) => index !== caputIndex),
    ]
    : [{
      id: `${article.id}-caput`,
      kind: 'caput' as const,
      label: article.number ? `Art. ${article.number}` : 'Art.',
      text: String(article.text || '').trim(),
    }, ...baseBlocks];

  const next: LegalArticleBlock[] = [];
  let paragraphCounter = 0;
  let incisoCounter = 0;
  let alineaCounter = 0;
  let itemCounter = 0;
  let currentParagraphId: string | null = null;
  let currentIncisoId: string | null = null;
  let currentAlineaId: string | null = null;
  let lastLegalId: string | null = null;
  const caputId = `${article.id}-caput`;

  withCaput.forEach((block, index) => {
    const id = block.kind === 'caput' ? caputId : (block.id || `${article.id}-${block.kind}-${index + 1}`);
    const text = String(block.text || '').trim();
    if (!text) {
      return;
    }

    if (block.kind === 'paragraph') {
      paragraphCounter += 1;
      incisoCounter = 0;
      alineaCounter = 0;
      itemCounter = 0;
      currentParagraphId = id;
      currentIncisoId = null;
      currentAlineaId = null;
      lastLegalId = id;
    } else if (block.kind === 'inciso') {
      incisoCounter += 1;
      alineaCounter = 0;
      itemCounter = 0;
      currentIncisoId = id;
      currentAlineaId = null;
      lastLegalId = id;
    } else if (block.kind === 'alinea') {
      alineaCounter += 1;
      itemCounter = 0;
      currentAlineaId = id;
      lastLegalId = id;
    } else if (block.kind === 'item') {
      itemCounter += 1;
      lastLegalId = id;
    } else if (block.kind === 'caput') {
      paragraphCounter = 0;
      incisoCounter = 0;
      alineaCounter = 0;
      itemCounter = 0;
      currentParagraphId = null;
      currentIncisoId = null;
      currentAlineaId = null;
      lastLegalId = id;
    }

    const sequence = block.kind === 'paragraph'
      ? paragraphCounter
      : block.kind === 'inciso'
        ? incisoCounter
        : block.kind === 'alinea'
          ? alineaCounter
          : block.kind === 'item'
            ? itemCounter
            : 1;

    const label = String(block.label || '').trim() || buildDefaultBlockLabel(block.kind, String(article.number || '').trim(), Math.max(sequence, 1));
    const parentBlockId = block.kind === 'paragraph'
      ? caputId
      : block.kind === 'inciso'
        ? (currentParagraphId || caputId)
        : block.kind === 'alinea'
          ? (currentIncisoId || currentParagraphId || caputId)
          : block.kind === 'item'
            ? (currentAlineaId || currentIncisoId || currentParagraphId || caputId)
            : block.kind === 'note'
              ? (lastLegalId || caputId)
              : undefined;

    next.push({
      id,
      kind: block.kind,
      label,
      text,
      ...(parentBlockId ? { parentBlockId } : {}),
    });
  });

  return next.length > 0 ? next : [{
    id: caputId,
    kind: 'caput',
    label: article.number ? `Art. ${article.number}` : 'Art.',
    text: String(article.text || '').trim(),
  }];
};

const normalizeArticleForSave = (article: LawArticle): LawArticle => {
  const blocks = normalizeArticleBlocks(article);
  const text = buildArticleTextFromBlocks(blocks);
  const paragraphs = blocks
    .filter((block) => block.kind === 'paragraph')
    .map((block) => ({
      number: String(block.label || '').trim(),
      text: String(block.text || '').trim(),
    }))
    .filter((item) => item.text !== '');

  return {
    ...article,
    text,
    paragraphs,
    blocks,
  };
};

const getTeacherCommentTarget = (comment: Partial<TeacherComment>): LegalRichContentBlock['target'] | undefined => (
  comment.richBlocks?.find((block) => block.target)?.target
  || comment.blocks?.find((block) => block.target)?.target
);

const getEditorialTargetKey = (target?: LegalRichContentBlock['target'] | null) => {
  if (!target) return '';
  const blockId = String(target.blockId || '').trim();
  if (blockId) return `block:${blockId}`;

  const kind = String(target.kind || '').trim().toLowerCase();
  const label = normalizeTaxonomyText(target.label || '');
  return kind || label ? `${kind}:${label}` : '';
};

const getArticleExamTipTarget = (tip: Partial<ArticleExamTip>): LegalRichContentBlock['target'] | undefined => (
  tip.target
);

const mergeTeacherCommentsByTarget = (
  existing: TeacherComment[],
  generated: TeacherComment[],
): TeacherComment[] => {
  if (generated.length === 0) return existing;

  const next = [...existing];
  generated.forEach((comment) => {
    const targetKey = getEditorialTargetKey(getTeacherCommentTarget(comment));
    const generatedId = String(comment.id || '').trim();
    const replaceIndex = next.findIndex((item) => {
      if (generatedId && item.id === generatedId) return true;
      const itemTargetKey = getEditorialTargetKey(getTeacherCommentTarget(item));
      if (targetKey) return itemTargetKey === targetKey;
      return !itemTargetKey;
    });

    if (replaceIndex >= 0) {
      next[replaceIndex] = comment;
    } else {
      next.push(comment);
    }
  });

  return next;
};

const mergeExamTipsByTarget = (
  existing: ArticleExamTip[],
  generated: ArticleExamTip[],
): ArticleExamTip[] => {
  if (generated.length === 0) return existing;

  const next = [...existing];
  generated.forEach((tip) => {
    const targetKey = getEditorialTargetKey(getArticleExamTipTarget(tip));
    const generatedId = String(tip.id || '').trim();
    const bodySignature = normalizeTaxonomyText(`${tip.title || ''} ${tip.body || ''}`);
    const replaceIndex = next.findIndex((item) => {
      if (generatedId && item.id === generatedId) return true;
      const itemTargetKey = getEditorialTargetKey(getArticleExamTipTarget(item));
      if (targetKey) return itemTargetKey === targetKey;
      return !itemTargetKey && bodySignature !== '' && normalizeTaxonomyText(`${item.title || ''} ${item.body || ''}`) === bodySignature;
    });

    if (replaceIndex >= 0) {
      next[replaceIndex] = tip;
    } else {
      next.push(tip);
    }
  });

  return next;
};

const getTargetedTextBody = (item: string | LegalTargetedText): string => (
  typeof item === 'string'
    ? item
    : String(item.body || item.text || '').trim()
);

const getTargetedTextTarget = (item: string | LegalTargetedText): LegalRichContentBlock['target'] | undefined => (
  typeof item === 'string' ? undefined : item.target
);

const updateTargetedTextItem = (
  item: string | LegalTargetedText,
  patch: Record<string, unknown>,
): string | LegalTargetedText => {
  const body = typeof patch.body === 'string' ? patch.body : getTargetedTextBody(item);
  const hasTargetPatch = Object.prototype.hasOwnProperty.call(patch, 'target');
  const target = hasTargetPatch ? patch.target as LegalRichContentBlock['target'] | undefined : getTargetedTextTarget(item);

  if (typeof item === 'string' && !hasTargetPatch) {
    return body;
  }

  return {
    ...(typeof item === 'string' ? {} : item),
    body,
    text: body,
    target,
  };
};

const withTargetOnFirstRichBlock = (
  blocks: LegalRichContentBlock[] | undefined,
  fallbackTitle: string,
  fallbackContent: string,
  target?: LegalRichContentBlock['target'],
): LegalRichContentBlock[] => {
  const sourceBlocks = Array.isArray(blocks) && blocks.length > 0
    ? blocks
    : [{
      type: 'paragraph' as const,
      title: fallbackTitle,
      content: fallbackContent,
    }];

  return sourceBlocks.map((block, index) => {
    if (index !== 0) {
      return block;
    }

    const nextBlock: LegalRichContentBlock = { ...block };
    if (target?.label || target?.blockId) {
      nextBlock.target = target;
    } else {
      delete nextBlock.target;
    }
    return nextBlock;
  });
};

const updateTeacherCommentRichBody = (comment: TeacherComment, body: string): TeacherComment => {
  const richBlocks = withTargetOnFirstRichBlock(
    comment.richBlocks || comment.blocks,
    comment.title || 'Comentario do professor',
    body,
    getTeacherCommentTarget(comment),
  ).map((block, index) => (
    index === 0
      ? { ...block, content: body }
      : block
  ));

  return {
    ...comment,
    body,
    texto: body,
    richBlocks,
    blocks: richBlocks,
  };
};

const updateTeacherCommentTarget = (
  comment: TeacherComment,
  target?: LegalRichContentBlock['target'],
): TeacherComment => {
  const body = String(comment.body || comment.texto || '').trim();
  const richBlocks = withTargetOnFirstRichBlock(
    comment.richBlocks || comment.blocks,
    comment.title || 'Comentario do professor',
    body,
    target,
  );

  return {
    ...comment,
    richBlocks,
    blocks: richBlocks,
  };
};

const isLikelyEditoriallyIrrelevantArticle = (article: Partial<LawArticle>) => {
  const rawText = String(article.text || article.blocks?.map((block) => block.text).join(' ') || '');
  const normalizedText = normalizeTaxonomyText(rawText);
  if (!normalizedText) return true;

  const signatureMarkers = [
    'brasilia,',
    'presidente -',
    'vice-presidente',
    'secretario',
    'relator geral',
    'relator adjunto',
    'participantes:',
    'in memoriam:',
    'este texto nao substitui',
  ];
  const markerCount = signatureMarkers.filter((marker) => normalizedText.includes(marker)).length;
  const dashSeparatedNames = (rawText.match(/\s-\s/g) || []).length;

  return rawText.length > 800 && (markerCount >= 2 || dashSeparatedNames > 70);
};

const isEmptyJurisprudencePlaceholderText = (value: unknown) => {
  const text = normalizeTaxonomyText(
    value && typeof value === 'object'
      ? getTargetedTextBody(value as LegalTargetedText)
      : value,
  );
  if (!text) return false;

  return [
    'nao ha entendimento jurisprudencial',
    'nao ha jurisprudencia',
    'nao existe jurisprudencia',
    'sem jurisprudencia',
    'nenhum entendimento jurisprudencial',
    'jurisprudencia nao localizada',
    'entendimento especifico relevante para prova',
  ].some((pattern) => text.includes(pattern));
};

const hasMeaningfulJurisprudenceContent = (item: Partial<ArticleJurisprudence>) => {
  const title = String(item.title || '').trim();
  const summary = String(item.summary || '').trim();
  const examImpact = String(item.examImpact || '').trim();
  const sourceUrl = String(item.sourceUrl || '').trim();
  const precedentType = String(item.precedentType || '').trim();

  if (isEmptyJurisprudencePlaceholderText(`${title} ${summary} ${examImpact}`)) {
    return false;
  }

  return Boolean(sourceUrl || summary || examImpact || (title && title !== 'Jurisprudencia relevante') || (precedentType && precedentType !== 'Entendimento'));
};

const readRawTaxonomyString = (raw: RawTaxonomyOption, keys: string[]) => {
  for (const key of keys) {
    const value = raw[key];
    if (typeof value === 'string' && value.trim()) {
      return value.trim();
    }
  }
  return '';
};

const normalizeTaxonomyOption = (rawOption: unknown, fallbackLevel?: string): TaxonomyOption | null => {
  if (!rawOption || typeof rawOption !== 'object') return null;
  const raw = rawOption as RawTaxonomyOption;
  const idValue = raw.id ?? raw.value ?? raw.slug ?? null;
  if (idValue === null || idValue === undefined || String(idValue).trim() === '') {
    return null;
  }

  const name = sanitizeLegacyTaxonomyLabel(readRawTaxonomyString(raw, ['name', 'nome', 'title', 'titulo', 'label', 'descricao', 'description']))
    || String(idValue).trim();

  const parentValue = raw.parentId ?? raw.parent_id ?? raw.pai ?? raw.assunto_raiz ?? null;
  const rootValue = raw.rootSubjectId ?? raw.root_subject_id ?? raw.materia_id ?? null;
  const taxonomyLevel = readRawTaxonomyString(raw, ['taxonomyLevel', 'taxonomy_level', 'nivel_taxonomia']) || fallbackLevel || undefined;

  return {
    id: String(idValue),
    name,
    slug: typeof raw.slug === 'string' ? raw.slug : undefined,
    parentId: parentValue === null || parentValue === undefined || parentValue === '' ? null : String(parentValue),
    rootSubjectId: rootValue === null || rootValue === undefined || rootValue === '' ? null : String(rootValue),
    taxonomyLevel,
  };
};

const normalizeTaxonomyCollection = (collection: unknown, fallbackLevel?: string): TaxonomyOption[] => {
  if (!Array.isArray(collection)) {
    return [];
  }

  const seen = new Set<string>();
  const options: TaxonomyOption[] = [];
  collection.forEach((entry) => {
    const normalized = normalizeTaxonomyOption(entry, fallbackLevel);
    if (!normalized) return;
    const key = String(normalized.id);
    if (seen.has(key)) return;
    seen.add(key);
    options.push(normalized);
  });
  return options;
};

const splitKnowledgeTaxonomies = (taxonomies: unknown) => {
  const record = taxonomies && typeof taxonomies === 'object'
    ? taxonomies as Record<string, unknown>
    : {};
  const subjectTopicsSource = Array.isArray(record.subjectTopics) && record.subjectTopics.length > 0
    ? record.subjectTopics
    : null;
  const specificSubjectsSource = Array.isArray(record.specificSubjects) && record.specificSubjects.length > 0
    ? record.specificSubjects
    : null;
  const subjects = normalizeTaxonomyCollection(record.subjects, 'materia');
  const allTopics = normalizeTaxonomyCollection(record.topics);
  const subjectTopics = normalizeTaxonomyCollection(
    subjectTopicsSource
      ? subjectTopicsSource
      : allTopics.filter((item) => (
        item.taxonomyLevel === 'topico'
        || item.taxonomyLevel === 'subtopico'
      )),
    'topico',
  );
  const specificSubjects = normalizeTaxonomyCollection(
    specificSubjectsSource
      ? specificSubjectsSource
      : allTopics.filter((item) => item.taxonomyLevel === 'assunto'),
    'assunto',
  );

  return {
    subjects,
    topics: subjectTopics,
    specificSubjects,
  };
};

const hasTaxonomyPayload = (taxonomies: unknown): boolean => {
  if (!taxonomies || typeof taxonomies !== 'object') {
    return false;
  }

  const record = taxonomies as Record<string, unknown>;
  return Object.values(record).some((value) => Array.isArray(value) && value.length > 0);
};

const buildLegalAreaFromTaxonomy = (subject?: TaxonomyOption, fallback?: Partial<LegalArea> | null): LegalArea | undefined => {
  if (!subject && !fallback) return undefined;

  return {
    id: String(subject?.id || fallback?.id || ''),
    slug: String(subject?.slug || fallback?.slug || 'constitucional') as LegalArea['slug'],
    name: subject?.name || fallback?.name || 'Materia',
    description: fallback?.description || '',
    order: fallback?.order || 0,
    iconTone: fallback?.iconTone || 'sky',
    colorClass: fallback?.colorClass,
    iconName: fallback?.iconName,
    totalLaws: fallback?.totalLaws,
  };
};

const buildEmptyArticle = (lawId = 'new', sectionId?: string | null, assuntoFilterId?: string | null): LawArticle => {
  const id = createTempId('article');
  return {
    id,
    lawId,
    sectionId: sectionId || null,
    slug: id,
    number: '',
    title: '',
    text: '',
    paragraphs: [],
    jurisprudenceNotes: [],
    syllabi: [],
    doctrine: [],
    relatedQuestionCount: 0,
    blocks: [
      {
        id: `${id}-caput`,
        kind: 'caput',
        label: 'Art.',
        text: '',
      },
    ],
    assuntoFilterId: assuntoFilterId || null,
  };
};

const buildEmptyLaw = (): AdminLawDraft => {
  const sectionId = createTempId('section');
  return {
  id: '',
  slug: '',
  areaId: '',
  lawTopicFilterId: null,
  title: '',
  shortTitle: '',
  number: '',
  year: '',
  date: '',
  aliases: [],
  description: '',
  summary: '',
  preamble: '',
  ementa: '',
  status: 'draft',
  officialUrl: '',
  sourceName: 'Portal do Planalto',
  lastSyncedAt: '',
  isRecentlyUpdated: false,
  accessCount: 0,
  articleCount: 0,
  commentedArticleCount: 0,
  jurisprudenceCount: 0,
  examTipCount: 0,
  area: undefined,
  sections: [{
    id: sectionId,
    lawId: 'new',
    slug: sectionId,
    title: 'CAPITULO UNICO',
    displayTitle: 'CAPITULO UNICO',
    articleCount: 1,
    sortOrder: 0,
  }],
  articles: [buildEmptyArticle('new', sectionId)],
  teacherComments: [],
  jurisprudence: [],
  examTips: [],
  userComments: [],
  updates: [],
  sumulas: [],
  };
};

const buildAreasFromSubjects = (subjects: TaxonomyOption[]): LegalArea[] => (
  subjects.map((subject, index) => ({
    id: String(subject.id),
    slug: String(subject.slug || slugifyTaxonomy(subject.name) || `materia-${index + 1}`) as LegalArea['slug'],
    name: subject.name,
    description: '',
    order: index,
    iconTone: 'sky',
  }))
);

const resolveLawMateria = (
  law: Partial<LawDetail>,
  areas: LegalArea[],
  subjects: TaxonomyOption[],
  topics: TaxonomyOption[] = [],
) => {
  const rawAreaId = String(law.areaId || law.area?.id || '');
  const directSubject = subjects.find((subject) => String(subject.id) === rawAreaId);
  if (directSubject) {
    return {
      areaId: String(directSubject.id),
      area: buildLegalAreaFromTaxonomy(directSubject, law.area),
    };
  }

  const lawTopicId = String(law.lawTopicFilterId || '');
  const lawTopic = lawTopicId
    ? topics.find((topic) => String(topic.id) === lawTopicId)
    : null;
  const topicSubjectId = String(lawTopic?.parentId || lawTopic?.rootSubjectId || '');
  const subjectFromTopic = topicSubjectId
    ? subjects.find((subject) => String(subject.id) === topicSubjectId)
    : null;

  if (subjectFromTopic) {
    return {
      areaId: String(subjectFromTopic.id),
      area: buildLegalAreaFromTaxonomy(subjectFromTopic, law.area),
    };
  }

  const lawAreaName = normalizeTaxonomyText(sanitizeLegacyTaxonomyLabel(String(law.area?.name || '')));
  const matchedByName = lawAreaName
    ? subjects.find((subject) => {
      const subjectName = normalizeTaxonomyText(subject.name);
      return subjectName === lawAreaName || subjectName.includes(lawAreaName) || lawAreaName.includes(subjectName);
    })
    : null;

  if (matchedByName) {
    return {
      areaId: String(matchedByName.id),
      area: buildLegalAreaFromTaxonomy(matchedByName, law.area),
    };
  }

  return {
    areaId: rawAreaId,
    area: rawAreaId
      ? areas.find((area) => String(area.id) === rawAreaId) || law.area
      : law.area,
  };
};

const hydrateDraftFromLaw = (
  law: Partial<LawDetail>,
  areas: LegalArea[],
  subjects: TaxonomyOption[] = [],
  topics: TaxonomyOption[] = [],
): AdminLawDraft => {
  const lawAliases = law as LawDetailAdminAliases;
  const articleIdMap = new Map<string, string>();
  const sections = (law.sections || []).map((section, index) => ({
    ...section,
    id: String(section.id || createTempId(`section-${index + 1}`)),
    lawId: String(section.lawId || law.id || 'new'),
    slug: section.slug || `section-${index + 1}`,
    title: String(section.displayTitle || section.title || `CAPITULO ${index + 1}`),
    displayTitle: String(section.displayTitle || section.title || `CAPITULO ${index + 1}`),
    articleCount: Number(section.articleCount || 0),
    sortOrder: Number(section.sortOrder ?? index),
  }));
  const fallbackSectionId = sections[0]?.id || createTempId('section');
  const articles = (law.articles || []).map((article, index) => {
    const nextId = String(article.id || createTempId(`article-${index + 1}`));
    const originalId = String(article.id || '');
    const articleInternalTitle = String(article.title || '').trim();
    const articleSectionId = article.sectionId || fallbackSectionId;
    const articleSection = sections.find((section) => String(section.id) === String(articleSectionId));
    if (originalId) {
      articleIdMap.set(originalId, nextId);
    }

    const hydratedArticle: LawArticle = {
      ...article,
      id: nextId,
      lawId: String(article.lawId || law.id || 'new'),
      sectionId: articleSectionId,
      slug: article.slug || `art-${index + 1}`,
      title: articleInternalTitle,
      blocks: (article.blocks || []).map((block, blockIndex) => ({
        ...block,
        id: block.id || `${nextId}-block-${blockIndex + 1}`,
      })),
      paragraphs: article.paragraphs || [],
      jurisprudenceNotes: article.jurisprudenceNotes || [],
      syllabi: article.syllabi || [],
      doctrine: article.doctrine || [],
      relatedQuestionCount: article.relatedQuestionCount || 0,
      assuntoFilterId: articleSection?.assuntoFilterId ?? null,
    };

    return {
      ...hydratedArticle,
      blocks: normalizeArticleBlocks(hydratedArticle),
    };
  });

  const resolveArticleId = (articleId?: string | null) => {
    if (!articleId) return '';
    return articleIdMap.get(String(articleId)) || String(articleId);
  };

  const resolvedMateria = resolveLawMateria(law, areas, subjects, topics);

  return {
    ...law,
    id: String(law.id || ''),
    areaId: resolvedMateria.areaId,
    legalAreaId: String(lawAliases.legalAreaId || getLegalAreaId(law.area) || law.areaId || ''),
    lawTopicFilterId: law.lawTopicFilterId ? String(law.lawTopicFilterId) : null,
    area: resolvedMateria.area,
    aliases: law.aliases || [],
    title: law.title || '',
    shortTitle: law.shortTitle || '',
    number: law.number || '',
    year: law.year || '',
    date: law.date || '',
    publishedAt: law.publishedAt || law.date || '',
    published_at: law.published_at || law.publishedAt || law.date || '',
    slug: law.slug || '',
    description: law.description || '',
    summary: law.summary || '',
    preamble: String(lawAliases.preamble || ''),
    ementa: law.ementa || '',
    status: law.status || 'active',
    officialUrl: law.officialUrl || '',
    sourceName: law.sourceName || 'Portal do Planalto',
    lastSyncedAt: law.lastSyncedAt || '',
    isRecentlyUpdated: Boolean(law.isRecentlyUpdated),
    accessCount: law.accessCount || 0,
    articleCount: law.articleCount || articles.length,
    commentedArticleCount: law.commentedArticleCount || 0,
    jurisprudenceCount: law.jurisprudenceCount || 0,
    examTipCount: law.examTipCount || 0,
    sections: sections.length > 0 ? sections : [{
      id: fallbackSectionId,
      lawId: String(law.id || 'new'),
      slug: fallbackSectionId,
      title: 'CAPITULO UNICO',
      displayTitle: 'CAPITULO UNICO',
      articleCount: articles.length,
      sortOrder: 0,
    }],
    articles,
    teacherComments: (law.teacherComments || []).map((comment) => ({
      ...comment,
      articleId: resolveArticleId(comment.articleId),
    })),
    jurisprudence: (law.jurisprudence || []).map((item) => ({
      ...item,
      articleId: resolveArticleId(item.articleId),
    })),
    examTips: (law.examTips || []).map((item) => ({
      ...item,
      articleId: resolveArticleId(item.articleId),
    })),
    sectionEditorials: (law.sectionEditorials || []).map((item) => ({
      ...item,
      sectionId: item.sectionId ? String(item.sectionId) : null,
      sectionTitle: String(item.sectionTitle || ''),
      rangeLabel: String(item.rangeLabel || ''),
      articleCount: Number(item.articleCount || 0),
      summary: String(item.summary || ''),
      examFocus: Array.isArray(item.examFocus) ? item.examFocus : [],
      macetes: Array.isArray(item.macetes) ? item.macetes : [],
      doctrine: Array.isArray(item.doctrine) ? item.doctrine : [],
      jurisprudence: Array.isArray(item.jurisprudence) ? item.jurisprudence : [],
      sumulas: Array.isArray(item.sumulas) ? item.sumulas : [],
      highlights: Array.isArray(item.highlights)
        ? item.highlights.map((highlight) => ({
          ...highlight,
          articleId: resolveArticleId(highlight.articleId),
        }))
        : [],
    })),
    userComments: law.userComments || [],
    updates: law.updates || [],
    sumulas: articles.flatMap((article) => (
      (article.syllabi || []).map((sumula) => {
        const syllabusId = 'id' in sumula ? (sumula as { id?: string }).id : undefined;
        return {
          ...sumula,
          id: String(syllabusId || createTempId('sumula')),
        articleId: article.id,
        };
      })
    )),
  };
};

const getArticleLabel = (article: LawArticle) =>
  article.number ? `Art. ${article.number}` : 'Artigo sem numero';

const hasFilledText = (value: unknown) => (
  value && typeof value === 'object'
    ? getTargetedTextBody(value as LegalTargetedText).trim().length > 0
    : String(value || '').trim().length > 0
);

const buildEmptyEditorialCounts = (): ArticleEditorialCounts => ({
  teacher: 0,
  tips: 0,
  jurisprudence: 0,
  sumulas: 0,
  doctrine: 0,
  total: 0,
});

const sumEditorialCounts = (items: ArticleEditorialCounts[]): ArticleEditorialCounts => {
  const total = buildEmptyEditorialCounts();
  items.forEach((item) => {
    total.teacher += item.teacher;
    total.tips += item.tips;
    total.jurisprudence += item.jurisprudence;
    total.sumulas += item.sumulas;
    total.doctrine += item.doctrine;
  });
  total.total = total.teacher + total.tips + total.jurisprudence + total.sumulas + total.doctrine;
  return total;
};

const getArticleEditorialCounts = (draft: AdminLawDraft, article: LawArticle): ArticleEditorialCounts => {
  const teacher = (draft.teacherComments || [])
    .filter((item) => item.articleId === article.id)
    .filter((item) => hasFilledText(item.title) || hasFilledText(item.body))
    .length;
  const tips = (draft.examTips || [])
    .filter((item) => item.articleId === article.id)
    .filter((item) => hasFilledText(item.title) || hasFilledText(item.body))
    .length;
  const jurisprudence = (
    (draft.jurisprudence || [])
      .filter((item) => item.articleId === article.id)
      .filter((item) => hasFilledText(item.title) || hasFilledText(item.summary) || hasFilledText(item.examImpact))
      .length
    + (article.jurisprudenceNotes || []).filter(hasFilledText).length
  );
  const sumulas = (draft.sumulas || [])
    .filter((item) => item.articleId === article.id)
    .filter((item) => hasFilledText(item.number) || hasFilledText(item.text))
    .length;
  const doctrine = (article.doctrine || article.doutrina || []).filter(hasFilledText).length;

  return {
    teacher,
    tips,
    jurisprudence,
    sumulas,
    doctrine,
    total: teacher + tips + jurisprudence + sumulas + doctrine,
  };
};

const FieldLabel = ({ children }: { children: React.ReactNode }) => (
  <label className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400 dark:text-slate-500">{children}</label>
);

const TextInput = (props: React.InputHTMLAttributes<HTMLInputElement>) => (
  <input
    {...props}
    className={`h-10 w-full ${ADMIN_FIELD_CLASS} ${props.className || ''}`}
  />
);

const TextArea = (props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) => (
  <textarea
    {...props}
    className={`min-h-28 resize-y ${ADMIN_TEXTAREA_CLASS} ${props.className || ''}`}
  />
);

const SelectInput = (props: React.SelectHTMLAttributes<HTMLSelectElement>) => (
  <select
    {...props}
    className={`h-10 w-full ${ADMIN_FIELD_CLASS} ${props.className || ''}`}
  />
);

interface CreatableTaxonomySelectProps {
  label: string;
  options: TaxonomyOption[];
  value?: string | number | null;
  selectedLabelOverride?: string;
  placeholder: string;
  createLabel: string;
  disabled?: boolean;
  loading?: boolean;
  helper?: string;
  onChange: (value: string, option?: TaxonomyOption) => void;
  onCreate: (name: string) => Promise<void> | void;
}

const CreatableTaxonomySelect = ({
  label,
  options,
  value,
  selectedLabelOverride,
  placeholder,
  createLabel,
  disabled = false,
  loading = false,
  helper,
  onChange,
  onCreate,
}: CreatableTaxonomySelectProps) => {
  const [inputValue, setInputValue] = React.useState('');
  const [isOpen, setIsOpen] = React.useState(false);
  const selectedValue = String(value || '');
  const selectedOption = options.find((option) => String(option.id) === selectedValue);
  const normalizedInput = normalizeTaxonomyText(inputValue);
  const filteredOptions = options
    .filter((option) => String(option.id) !== selectedValue)
    .filter((option) => !normalizedInput || normalizeTaxonomyText(option.name).includes(normalizedInput))
    .slice(0, 12);
  const hasExactOption = options.some((option) => normalizeTaxonomyText(option.name) === normalizedInput);
  const canCreate = Boolean(normalizedInput && !hasExactOption && !disabled && !loading);

  const selectOption = (option: TaxonomyOption) => {
    onChange(String(option.id), option);
    setInputValue('');
    setIsOpen(false);
  };

  const createOption = async () => {
    const name = inputValue.trim();
    if (!name || disabled || loading) return;

    await onCreate(name);
    setInputValue('');
    setIsOpen(false);
  };

  return (
    <div
      className="space-y-1.5"
      onBlur={(event) => {
        const nextFocus = event.relatedTarget as HTMLElement | null;
        if (!nextFocus || !event.currentTarget.contains(nextFocus)) {
          setIsOpen(false);
        }
      }}
    >
      <FieldLabel>{label}</FieldLabel>
      <div className="relative">
        <div className={`min-h-[44px] rounded-xl border border-slate-300 bg-white p-1.5 transition-all focus-within:ring-2 focus-within:ring-indigo-500/20 dark:border-slate-800 dark:bg-slate-900 ${disabled ? 'opacity-60' : ''}`}>
          <div className="flex flex-wrap items-center gap-2">
            {selectedValue ? (
              <span className="flex items-center gap-1 rounded-lg border border-indigo-100 bg-indigo-50 px-2 py-1 text-xs font-bold text-indigo-700 dark:border-indigo-900/50 dark:bg-indigo-900/30 dark:text-indigo-300">
                {selectedOption?.name || selectedLabelOverride || selectedValue}
                <button
                  type="button"
                  onClick={() => onChange('', undefined)}
                  disabled={disabled || loading}
                  className="transition-colors hover:text-indigo-950 disabled:opacity-40 dark:hover:text-indigo-100"
                  aria-label={`Remover ${label}`}
                >
                  <X size={12} />
                </button>
              </span>
            ) : null}

            <input
              type="text"
              value={inputValue}
              disabled={disabled || loading}
              onChange={(event) => {
                setInputValue(event.target.value);
                setIsOpen(true);
              }}
              onFocus={() => setIsOpen(true)}
              onKeyDown={(event) => {
                if (event.key !== 'Enter') return;
                event.preventDefault();
                if (filteredOptions.length > 0 && hasExactOption) {
                  selectOption(filteredOptions[0]);
                  return;
                }
                if (canCreate) {
                  void createOption();
                }
              }}
              placeholder={selectedValue ? '' : placeholder}
              className="min-w-[120px] flex-1 border-none bg-transparent px-2 py-1 text-sm font-semibold text-slate-900 outline-none placeholder:text-slate-400 disabled:cursor-not-allowed dark:text-slate-100"
            />
          </div>
        </div>

        {isOpen && !disabled && (filteredOptions.length > 0 || canCreate) ? (
          <div className="absolute z-50 mt-1 max-h-56 w-full overflow-y-auto rounded-xl border border-slate-200 bg-white py-2 shadow-xl dark:border-slate-700 dark:bg-slate-800">
            {filteredOptions.map((option) => (
              <button
                key={option.id}
                type="button"
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => selectOption(option)}
                className="w-full px-4 py-2 text-left text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-700"
              >
                {option.name}
              </button>
            ))}
            {canCreate ? (
              <button
                type="button"
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => void createOption()}
                className="flex w-full flex-col gap-0.5 px-4 py-2 text-left text-sm font-bold text-indigo-600 transition-colors hover:bg-indigo-50 dark:text-indigo-300 dark:hover:bg-indigo-500/10"
              >
                <span className="flex items-center gap-2">
                  {loading ? <Loader2 className="animate-spin" size={14} /> : <Plus size={14} />}
                  {createLabel} &quot;{inputValue.trim()}&quot;
                </span>
                <span className="ml-6 text-[10px] font-normal italic text-slate-400">Slug: {slugifyTaxonomy(inputValue)}</span>
              </button>
            ) : null}
          </div>
        ) : null}
      </div>
      {helper ? <p className="text-xs font-medium text-slate-500 dark:text-slate-400">{helper}</p> : null}
    </div>
  );
};

const formatLegalUpdateDate = (value?: string | null) => {
  if (!value) return 'Sem registro';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? String(value) : date.toLocaleString('pt-BR');
};

const withAdminLoadTimeout = async <T,>(promise: Promise<T>, timeoutMs: number, message: string): Promise<T> => (
  new Promise<T>((resolve, reject) => {
    const timeoutId = window.setTimeout(() => {
      reject(new Error(message));
    }, timeoutMs);

    promise
      .then(resolve)
      .catch(reject)
      .finally(() => window.clearTimeout(timeoutId));
  })
);

const padDatePart = (value: number) => String(value).padStart(2, '0');

const formatLocalDateTimeForApi = (date: Date) => (
  `${date.getFullYear()}-${padDatePart(date.getMonth() + 1)}-${padDatePart(date.getDate())} ${padDatePart(date.getHours())}:${padDatePart(date.getMinutes())}:00`
);

const parseAdminPublicationDateTime = (value?: string | null): { date: string; time: string } => {
  const rawValue = String(value || '').trim();
  if (!rawValue) {
    return { date: '', time: '' };
  }

  const explicit = rawValue.match(/^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2}))?/);
  if (explicit) {
    return {
      date: `${explicit[3]}/${explicit[2]}/${explicit[1]}`,
      time: explicit[4] && explicit[5] ? `${explicit[4]}:${explicit[5]}` : '',
    };
  }

  const parsed = new Date(rawValue);
  if (Number.isNaN(parsed.getTime())) {
    return { date: '', time: '' };
  }

  return {
    date: `${padDatePart(parsed.getDate())}/${padDatePart(parsed.getMonth() + 1)}/${parsed.getFullYear()}`,
    time: `${padDatePart(parsed.getHours())}:${padDatePart(parsed.getMinutes())}`,
  };
};

const normalizeAdminPublicationDate = (value: string): string | null => {
  const rawDate = value.trim();
  if (!rawDate) return null;

  const brDate = rawDate.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (brDate) {
    return `${brDate[3]}-${brDate[2]}-${brDate[1]}`;
  }

  if (/^\d{4}-\d{2}-\d{2}$/.test(rawDate)) {
    return rawDate;
  }

  return null;
};

const normalizeAdminPublicationTime = (value: string): string => {
  const rawTime = value.trim();
  const match = rawTime.match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return '00:00';

  const hours = Math.min(23, Math.max(0, Number(match[1])));
  const minutes = Math.min(59, Math.max(0, Number(match[2])));
  return `${padDatePart(hours)}:${padDatePart(minutes)}`;
};

const LEGAL_UPDATE_CHANGE_LABEL: Record<string, string> = {
  created: 'Incluido',
  changed: 'Alterado',
  revoked: 'Revogado',
  renumbered: 'Renumerado',
  editorial_review_required: 'Revisao editorial',
};

const AI_KIND_LABEL: Record<LegalAiGenerationKind, string> = {
  'teacher-comment': 'Comentario',
  'exam-tip': 'Macete',
  jurisprudence: 'Jurisprudencia',
  sumula: 'Sumula',
  doctrine: 'Doutrina',
  bundle: 'Pacote IA',
};

const ARTICLE_AI_GENERATION_CARDS: Array<{
  key: LegalArticleAiKind;
  title: string;
  text: string;
  icon: typeof MessageSquare;
  countKey: keyof Omit<ArticleEditorialCounts, 'total'>;
  shortLabel: string;
}> = [
  {
    key: 'teacher-comment',
    title: 'Comentario do Professor',
    text: 'Gere um comentario didatico e objetivo.',
    icon: MessageSquare,
    countKey: 'teacher',
    shortLabel: 'comentario',
  },
  {
    key: 'sumula',
    title: 'Sumulas',
    text: 'Busque e resuma sumulas relacionadas.',
    icon: BookOpen,
    countKey: 'sumulas',
    shortLabel: 'sumula',
  },
  {
    key: 'doctrine',
    title: 'Doutrinas',
    text: 'Selecione e resuma doutrinas relevantes.',
    icon: FileText,
    countKey: 'doctrine',
    shortLabel: 'doutrina',
  },
  {
    key: 'jurisprudence',
    title: 'Jurisprudencia',
    text: 'Traga julgados relevantes sobre o artigo.',
    icon: Scale,
    countKey: 'jurisprudence',
    shortLabel: 'jurisprudencia',
  },
  {
    key: 'exam-tip',
    title: 'Macete',
    text: 'Gere o pulo do gato: o que a banca cobra, troca ou tenta confundir.',
    icon: Lightbulb,
    countKey: 'tips',
    shortLabel: 'macete',
  },
];

const ARTICLE_AI_REQUIREMENTS: Array<{
  kind: LegalArticleAiKind;
  label: string;
  countKey: keyof Omit<ArticleEditorialCounts, 'total'>;
}> = ARTICLE_AI_GENERATION_CARDS.map((card) => ({
  kind: card.key,
  label: card.shortLabel,
  countKey: card.countKey,
}));

const getMissingArticleAiRequirements = (counts: ArticleEditorialCounts): LegalArticleAiKind[] => (
  ARTICLE_AI_REQUIREMENTS
    .filter((requirement) => Number(counts[requirement.countKey] || 0) <= 0)
    .map((requirement) => requirement.kind)
);

const resolveAiScope = (kind: LegalArticleAiKind): LegalEditorialGenerationScope => {
  if (kind === 'teacher-comment') return 'field-comment';
  if (kind === 'exam-tip') return 'field-macete';
  if (kind === 'jurisprudence') return 'field-jurisprudencia';
  if (kind === 'sumula') return 'field-sumulas';
  return 'field-doutrina';
};

const AdminLegalCommentaryEditPage = () => {
  const params = useParams<{ lawId?: string | string[] }>();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { currentUser, isLoading: isAuthLoading } = useAuth();
  const confirm = useConfirm();
  const { addToast } = useToast();
  const { ensureTaxonomiesLoaded } = useTaxonomyActions();
  const canAccessAdmin = canAccessAdminPanel(currentUser);
  const rawLawId = String(normalizeParam(params.lawId) || 'new').trim();
  const isNew = ['new', 'novo', 'add'].includes(normalizeTaxonomyText(rawLawId));
  const lawId = isNew ? 'new' : rawLawId;
  const shouldOpenUpdatesFromQuery = searchParams.get('updates') === '1';
  const [areas, setAreas] = React.useState<LegalArea[]>([]);
  const [subjects, setSubjects] = React.useState<TaxonomyOption[]>([]);
  const [topics, setTopics] = React.useState<TaxonomyOption[]>([]);
  const [specificSubjects, setSpecificSubjects] = React.useState<TaxonomyOption[]>([]);
  const [draft, setDraft] = React.useState<AdminLawDraft | null>(null);
  const [loadError, setLoadError] = React.useState<string | null>(null);
  const [editorReloadVersion, setEditorReloadVersion] = React.useState(0);
  const draftRef = React.useRef<AdminLawDraft | null>(null);
  const addToastRef = React.useRef(addToast);
  const [activeArticleId, setActiveArticleId] = React.useState('');
  const [activeSectionId, setActiveSectionId] = React.useState('');
  const [openStructureSectionIds, setOpenStructureSectionIds] = React.useState<Set<string>>(() => new Set());
  const [isStructurePreviewOpen, setIsStructurePreviewOpen] = React.useState(true);
  const [isEditingOriginalText, setIsEditingOriginalText] = React.useState(false);
  const [scheduledDate, setScheduledDate] = React.useState('');
  const [scheduledTime, setScheduledTime] = React.useState('');
  const [isLoading, setIsLoading] = React.useState(true);
  const [isSaving, setIsSaving] = React.useState(false);
  const [isImportingFromPlanalto, setIsImportingFromPlanalto] = React.useState(false);
  const [isSyncingFromOfficial, setIsSyncingFromOfficial] = React.useState(false);
  const [isCreatingMateria, setIsCreatingMateria] = React.useState(false);
  const [isCreatingLawTopic, setIsCreatingLawTopic] = React.useState(false);
  const [isCreatingSubtopic, setIsCreatingSubtopic] = React.useState(false);
  const [isCreatingAssunto, setIsCreatingAssunto] = React.useState(false);
  const [aiLoading, setAiLoading] = React.useState<string | null>(null);
  const [selectedTeacherCommentTargetId, setSelectedTeacherCommentTargetId] = React.useState('');
  const [, setAiProgress] = React.useState<{ kind: string; label: string; percent: number } | null>(null);
  const [sectionAnalysisLoadingKey, setSectionAnalysisLoadingKey] = React.useState<string | null>(null);
  const [editingSectionAnalysisId, setEditingSectionAnalysisId] = React.useState<string | null>(null);
  const [isGeneratingAllSectionAnalyses, setIsGeneratingAllSectionAnalyses] = React.useState(false);
  const [lawAiBulkProgress, setLawAiBulkProgress] = React.useState<LegalAiBulkProgress | null>(null);
  const [isUpdatesModalOpen, setIsUpdatesModalOpen] = React.useState(false);
  const [isUpdatesModalLoading, setIsUpdatesModalLoading] = React.useState(false);
  const [updatesModalItems, setUpdatesModalItems] = React.useState<LawUpdate[]>([]);
  const [updatesModalLogs, setUpdatesModalLogs] = React.useState<LegalSyncLog[]>([]);
  const hasOpenedUpdatesFromQueryRef = React.useRef(false);
  const publicationFieldsHydratedRef = React.useRef('');

  const renderAdminShell = (children: React.ReactNode) => (
    <AdminStandaloneShell
      activeTab="operation"
      activeSectionKey="lei-comentada"
      pageTitle="Lei Comentada"
      showPageHeader={false}
    >
      {children}
    </AdminStandaloneShell>
  );

  const resolveKnowledgeTaxonomies = React.useCallback(async (force = false) => {
    await withAdminLoadTimeout(
      ensureTaxonomiesLoaded(force),
      8000,
      'Tempo excedido ao carregar taxonomias.',
    );
    const cachedTaxonomies = useAppConfigStore.getState().systemSettings.taxonomies;
    if (hasTaxonomyPayload(cachedTaxonomies)) {
      return splitKnowledgeTaxonomies(cachedTaxonomies);
    }

    const fallbackTaxonomies = await withAdminLoadTimeout(
      filtersService.listTaxonomies(),
      8000,
      'Tempo excedido ao carregar taxonomias.',
    );
    return splitKnowledgeTaxonomies(fallbackTaxonomies);
  }, [ensureTaxonomiesLoaded]);

  React.useEffect(() => {
    if (!isAuthLoading && !canAccessAdmin) {
      router.replace('/');
    }
  }, [canAccessAdmin, isAuthLoading, router]);

  React.useEffect(() => {
    if (!draft) return;

    const publicationValue = String(draft.publishedAt || draft.published_at || draft.date || '');
    const hydrationKey = `${draft.id || 'new'}:${draft.status || ''}:${publicationValue}`;
    if (publicationFieldsHydratedRef.current === hydrationKey) {
      return;
    }

    publicationFieldsHydratedRef.current = hydrationKey;
    const next = parseAdminPublicationDateTime(publicationValue);
    setScheduledDate(next.date);
    setScheduledTime(next.time);
  }, [draft?.id, draft?.status, draft?.publishedAt, draft?.published_at, draft?.date, draft]);

  React.useEffect(() => {
    draftRef.current = draft;
  }, [draft]);

  React.useEffect(() => {
    addToastRef.current = addToast;
  }, [addToast]);

  React.useEffect(() => {
    if (isAuthLoading) {
      return;
    }

    if (!canAccessAdmin) {
      return;
    }

    let isCurrent = true;
    const hydrateKnowledgeTaxonomies = async (force = false) => {
      try {
        const knowledgeTaxonomies = await resolveKnowledgeTaxonomies(force);
        if (!isCurrent) {
          return null;
        }

        const fallbackAreas = buildAreasFromSubjects(knowledgeTaxonomies.subjects);
        setAreas((currentAreas) => (currentAreas.length > 0 ? currentAreas : fallbackAreas));
        setSubjects(knowledgeTaxonomies.subjects);
        setTopics(knowledgeTaxonomies.topics);
        setSpecificSubjects(knowledgeTaxonomies.specificSubjects);

        return knowledgeTaxonomies;
      } catch {
        if (isCurrent) {
          addToastRef.current(
            'Editor aberto sem taxonomias carregadas. Tente recarregar as taxonomias antes de salvar.',
            'warning',
          );
        }

        return null;
      }
    };

    if (isNew) {
      const initializeTimeoutId = window.setTimeout(() => {
        if (!isCurrent) return;

        setLoadError(null);
        const nextLaw = buildEmptyLaw();
        setOpenStructureSectionIds(new Set());
        setActiveSectionId('');
        setSelectedTeacherCommentTargetId('');
        setIsEditingOriginalText(false);
        setIsUpdatesModalOpen(false);
        setUpdatesModalItems([]);
        setUpdatesModalLogs([]);
        hasOpenedUpdatesFromQueryRef.current = false;
        publicationFieldsHydratedRef.current = '';
        setAreas([]);
        setSubjects([]);
        setTopics([]);
        setSpecificSubjects([]);
        setDraft(nextLaw);
        setActiveArticleId(nextLaw.articles?.[0]?.id || '');
        setIsLoading(false);
        void hydrateKnowledgeTaxonomies();
      }, 0);

      return () => {
        isCurrent = false;
        window.clearTimeout(initializeTimeoutId);
      };
    }

    const loadingFrameId = window.requestAnimationFrame(() => {
      if (!isCurrent) return;
      setIsLoading(true);
      setLoadError(null);
    });

    (async () => {
      try {
        const [knowledgeTaxonomies, payload] = await Promise.all([
          resolveKnowledgeTaxonomies(),
          legalCommentaryApiService.getAdminDetail(lawId),
        ]);

        if (!isCurrent) return;

        const fallbackAreas = buildAreasFromSubjects(knowledgeTaxonomies.subjects);
        const nextAreas = (payload.areas || []).length > 0 ? (payload.areas || []) : fallbackAreas;
        const nextLaw = payload.law
          ? hydrateDraftFromLaw(payload.law, nextAreas, knowledgeTaxonomies.subjects, knowledgeTaxonomies.topics)
          : buildEmptyLaw();

        setAreas(nextAreas);
        setSubjects(knowledgeTaxonomies.subjects);
        setTopics(knowledgeTaxonomies.topics);
        setSpecificSubjects(knowledgeTaxonomies.specificSubjects);
        setDraft(nextLaw);
        setActiveArticleId(nextLaw.articles?.[0]?.id || '');
      } catch {
        if (isCurrent) {
          setLoadError('Nao foi possivel carregar o editor da lei.');
          addToastRef.current('Nao foi possivel carregar o editor da lei.', 'error');
          setDraft(null);
        }
      } finally {
        if (isCurrent) {
          setIsLoading(false);
        }
      }
    })();

    return () => {
      isCurrent = false;
      window.cancelAnimationFrame(loadingFrameId);
    };
  }, [canAccessAdmin, editorReloadVersion, isAuthLoading, isNew, lawId, resolveKnowledgeTaxonomies]);

  const activeArticle = React.useMemo(
    () => draft?.articles?.find((article) => article.id === activeArticleId) || draft?.articles?.[0] || null,
    [activeArticleId, draft?.articles],
  );

  const lawSections = React.useMemo(
    () => (draft?.sections || [])
      .map((section, index) => ({
        ...section,
        id: String(section.id || section.slug || `section-${index}`),
        lawId: String(section.lawId || draft?.id || ''),
        title: String(section.displayTitle || section.title || `CAPITULO ${index + 1}`),
        displayTitle: String(section.displayTitle || section.title || `CAPITULO ${index + 1}`),
        articleCount: Number(section.articleCount || 0),
        sortOrder: Number(section.sortOrder ?? index),
      }))
      .sort((left, right) => Number(left.sortOrder || 0) - Number(right.sortOrder || 0)),
    [draft?.id, draft?.sections],
  );

  const sectionEditorialsByKey = React.useMemo(
    () => {
      const map = new Map<string, LawSectionEditorial>();
      (draft?.sectionEditorials || []).forEach((item) => {
        if (item.sectionId) map.set(String(item.sectionId), item);
      });
      return map;
    },
    [draft?.sectionEditorials],
  );

  const sectionOverviews = React.useMemo<AdminLawSectionOverview[]>(() => {
    if (!draft) {
      return [];
    }

    const articles = draft.articles || [];
    return lawSections.map((section) => {
      const resolvedSectionId = section.id;
      const articlesList = articles.filter((article) => String(article.sectionId || '') === String(section.id));
      const articleIds = articlesList.map((article) => String(article.id));
      const savedEditorial = sectionEditorialsByKey.get(resolvedSectionId);
      return {
        ...section,
        resolvedSectionId,
        articleIds,
        articles: articlesList.length,
        articleCount: section.articleCount || articlesList.length,
        primaryArticleId: articleIds[0] || '',
        articlesList,
        counts: sumEditorialCounts(articlesList.map((article) => getArticleEditorialCounts(draft, article))),
        savedEditorial,
        hasAnalysis: Boolean(savedEditorial),
      };
    });
  }, [draft, lawSections, sectionEditorialsByKey]);

  const activeSectionOverview = React.useMemo(() => (
    sectionOverviews.find((section) => section.id === activeSectionId || section.resolvedSectionId === activeSectionId)
    || sectionOverviews.find((section) => section.articleIds.includes(String(activeArticleId || '')))
    || sectionOverviews[0]
    || null
  ), [activeArticleId, activeSectionId, sectionOverviews]);

  const lawAiCoverage = React.useMemo(() => {
    const currentDraft = draft;
    const eligibleArticles = (currentDraft?.articles || [])
      .filter((article) => !isLikelyEditoriallyIrrelevantArticle(article));
    const articleStatuses = eligibleArticles.map((article) => {
      const counts = currentDraft ? getArticleEditorialCounts(currentDraft, article) : buildEmptyEditorialCounts();
      const missingKinds = getMissingArticleAiRequirements(counts);
      return {
        article,
        counts,
        missingKinds,
        isComplete: missingKinds.length === 0,
        hasAnyContent: counts.total > 0,
      };
    });
    const sectionStatuses = sectionOverviews.map((section) => ({
      section,
      hasAnalysis: Boolean(section.savedEditorial),
    }));
    const pendingSections = sectionStatuses.filter((item) => !item.hasAnalysis);
    const pendingArticles = articleStatuses.filter((item) => item.missingKinds.length > 0);
    const readySections = sectionStatuses.filter((item) => item.hasAnalysis);
    const readyArticles = articleStatuses.filter((item) => item.isComplete);
    const missingArticleFields = pendingArticles.reduce((total, item) => total + item.missingKinds.length, 0);
    const articleRequirementStats = ARTICLE_AI_GENERATION_CARDS.map((card) => {
      const ready = articleStatuses.filter((item) => !item.missingKinds.includes(card.key)).length;
      const pending = articleStatuses.length - ready;
      return {
        ...card,
        ready,
        pending,
        total: articleStatuses.length,
      };
    });

    return {
      totalSections: sectionStatuses.length,
      readySections: readySections.length,
      pendingSections,
      totalArticles: articleStatuses.length,
      readyArticles: readyArticles.length,
      pendingArticles,
      readyArticleSamples: readyArticles.slice(0, 3),
      readySectionSamples: readySections.slice(0, 3),
      pendingTaskCount: pendingSections.length + missingArticleFields,
      missingArticleFields,
      articleRequirementStats,
    };
  }, [draft, sectionOverviews]);
  const lawAiBulkPercent = lawAiBulkProgress?.total
    ? Math.round((lawAiBulkProgress.completed / lawAiBulkProgress.total) * 100)
    : 0;

  const selectSection = React.useCallback((section: AdminLawSectionOverview) => {
    setActiveSectionId(section.resolvedSectionId);
    const firstArticle = section.articlesList[0];
    if (firstArticle) {
      setActiveArticleId(firstArticle.id);
    }
  }, []);

  const selectArticleFromSection = React.useCallback((article: LawArticle) => {
    setActiveArticleId(article.id);
    setIsStructurePreviewOpen(true);
    const section = sectionOverviews.find((item) => item.id === article.sectionId || item.articleIds.includes(article.id));
    if (section) {
      setActiveSectionId(section.resolvedSectionId);
    }
  }, [sectionOverviews]);

  const lawMateriaOptions = React.useMemo(() => {
    const options = [...subjects];
    const currentMateriaId = String(draft?.areaId || '');
    const hasCurrentMateria = currentMateriaId && options.some((subject) => String(subject.id) === currentMateriaId);
    const fallbackName = sanitizeLegacyTaxonomyLabel(String(draft?.area?.name || '')).trim();

    if (currentMateriaId && !hasCurrentMateria && fallbackName) {
      options.unshift({
        id: currentMateriaId,
        name: fallbackName,
      });
    }

    return options;
  }, [draft?.area?.name, draft?.areaId, subjects]);

  const selectedLawTopicFallbackOption = React.useMemo<TaxonomyOption | null>(() => {
    const selectedLawTopicId = String(draft?.lawTopicFilterId || '');
    if (!selectedLawTopicId) return null;
    const existing = topics.find((topic) => String(topic.id) === selectedLawTopicId);
    if (existing && !isNumericOnlyLabel(existing.name)) return existing;
    const fallbackName = String(draft?.title || draft?.shortTitle || '').trim();
    if (!fallbackName) return null;
    return {
      id: selectedLawTopicId,
      name: fallbackName,
      parentId: draft?.areaId || null,
      rootSubjectId: draft?.areaId || null,
    };
  }, [draft?.areaId, draft?.lawTopicFilterId, draft?.shortTitle, draft?.title, topics]);

  const lawTopicoOptions = React.useMemo(() => {
    const materiaId = String(draft?.areaId || '');
    const selectedLawTopicId = String(draft?.lawTopicFilterId || '');
    const selectedLawTopicCandidate = topics.find((topic) => String(topic.id) === selectedLawTopicId);
    const selectedLawTopic = (selectedLawTopicCandidate && !isNumericOnlyLabel(selectedLawTopicCandidate.name))
      ? selectedLawTopicCandidate
      : selectedLawTopicFallbackOption;

    const filtered = materiaId
      ? topics.filter((topic) => (
        String(topic.parentId || '') === materiaId
        || String(topic.rootSubjectId || '') === materiaId
      ))
      : [...topics];

    if (selectedLawTopic && !filtered.some((topic) => String(topic.id) === String(selectedLawTopic.id))) {
      filtered.unshift(selectedLawTopic);
    }

    return filtered;
  }, [draft?.areaId, draft?.lawTopicFilterId, selectedLawTopicFallbackOption, topics]);

  const getSectionSubtopicOptions = React.useCallback((section: LawSection): TaxonomyOption[] => {
    const lawTopicId = String(draft?.lawTopicFilterId || '');
    const selectedSubtopicId = String(section.subtopicFilterId || '');
    const selectedSubtopic = topics.find((topic) => String(topic.id) === selectedSubtopicId)
      || (selectedSubtopicId && section.titleName ? {
        id: selectedSubtopicId,
        name: section.titleName,
        parentId: lawTopicId || null,
      } : null);
    const filtered = lawTopicId
      ? topics.filter((topic) => (
        String(topic.parentId || '') === lawTopicId
        || String(topic.rootSubjectId || '') === lawTopicId
      ))
      : [];
    if (selectedSubtopic && !filtered.some((topic) => String(topic.id) === String(selectedSubtopic.id))) {
      filtered.unshift(selectedSubtopic);
    }
    return filtered;
  }, [draft?.lawTopicFilterId, topics]);

  const getSectionAssuntoOptions = React.useCallback((section: LawSection): TaxonomyOption[] => {
    const lawTopicId = String(draft?.lawTopicFilterId || '');
    const parentTaxonomyId = String(section.subtopicFilterId || lawTopicId || '');
    const selectedAssuntoId = String(section.assuntoFilterId || '');
    const selectedAssunto = specificSubjects.find((subject) => String(subject.id) === selectedAssuntoId)
      || (selectedAssuntoId && section.chapterName ? {
        id: selectedAssuntoId,
        name: section.chapterName,
        parentId: parentTaxonomyId || null,
      } : null);
    const filtered = parentTaxonomyId
      ? specificSubjects.filter((subject) => String(subject.parentId || '') === parentTaxonomyId)
      : [];
    if (selectedAssunto && !filtered.some((subject) => String(subject.id) === String(selectedAssunto.id))) {
      filtered.unshift(selectedAssunto);
    }
    return filtered;
  }, [draft?.lawTopicFilterId, specificSubjects]);

  const reloadKnowledgeTaxonomies = React.useCallback(async () => {
    const knowledgeTaxonomies = await resolveKnowledgeTaxonomies(true);
    setSubjects(knowledgeTaxonomies.subjects);
    setTopics(knowledgeTaxonomies.topics);
    setSpecificSubjects(knowledgeTaxonomies.specificSubjects);
    return knowledgeTaxonomies;
  }, [resolveKnowledgeTaxonomies]);

  const updateLawMateria = (subjectId: string, explicitSubject?: TaxonomyOption) => {
    if (!subjectId) {
      setDraft((current) => current ? {
        ...current,
        areaId: '',
        lawTopicFilterId: null,
        articles: (current.articles || []).map((article) => ({
          ...article,
          assuntoFilterId: null,
        })),
        sections: (current.sections || []).map((section) => ({
          ...section,
          subtopicFilterId: null,
          assuntoFilterId: null,
          titleName: '',
          chapterName: '',
        })),
      } : current);
      return;
    }

    const subject = explicitSubject || subjects.find((item) => String(item.id) === String(subjectId));

    setDraft((current) => {
      if (!current) return current;
      return {
        ...current,
        areaId: subjectId,
        lawTopicFilterId: null,
        area: buildLegalAreaFromTaxonomy(subject, current.area) || current.area,
        articles: (current.articles || []).map((article) => ({
          ...article,
          assuntoFilterId: null,
        })),
        sections: (current.sections || []).map((section) => ({
          ...section,
          subtopicFilterId: null,
          assuntoFilterId: null,
          titleName: '',
          chapterName: '',
        })),
      };
    });
  };

  const updateLawTopico = (lawTopicId: string) => {
    if (!lawTopicId) {
      setDraft((current) => current ? {
        ...current,
        lawTopicFilterId: null,
        articles: (current.articles || []).map((article) => ({
          ...article,
          assuntoFilterId: null,
        })),
        sections: (current.sections || []).map((section) => ({
          ...section,
          subtopicFilterId: null,
          assuntoFilterId: null,
          titleName: '',
          chapterName: '',
        })),
      } : current);
      return;
    }

    setDraft((current) => {
      if (!current) return current;
      const nextSections = (current.sections || []).map((section) => {
        const currentSubtopic = topics.find((topic) => String(topic.id) === String(section.subtopicFilterId || ''));
        const belongsToLawTopic = !currentSubtopic
          || String(currentSubtopic.parentId || '') === String(lawTopicId)
          || String(currentSubtopic.rootSubjectId || '') === String(lawTopicId);

        return belongsToLawTopic
          ? section
          : {
            ...section,
            subtopicFilterId: null,
            assuntoFilterId: null,
            titleName: '',
            chapterName: '',
          };
      });
      const sectionAssuntoById = new Map(nextSections.map((section) => [String(section.id), section.assuntoFilterId || null]));
      return {
        ...current,
        lawTopicFilterId: String(lawTopicId),
        articles: (current.articles || []).map((article) => ({
          ...article,
          assuntoFilterId: sectionAssuntoById.get(String(article.sectionId || '')) || null,
        })),
        sections: nextSections,
      };
    });

  };

  const createMateria = async (rawName: string) => {
    const name = rawName.trim();
    if (!name) {
      addToast('Informe o nome da materia.', 'info');
      return;
    }

    const existing = subjects.find((subject) => normalizeTaxonomyText(subject.name) === normalizeTaxonomyText(name));
    if (existing) {
      updateLawMateria(String(existing.id));
      addToast('Materia existente selecionada.', 'info');
      return;
    }

    setIsCreatingMateria(true);
    try {
      const createdId = await filtersService.save({
        type: 'assunto',
        name,
        slug: slugifyTaxonomy(name),
        materia: true,
        taxonomy_level: 'materia',
        parent_id: null,
        metadata: { taxonomy_level: 'materia' },
      });
      const knowledgeTaxonomies = await reloadKnowledgeTaxonomies();
      const created = knowledgeTaxonomies.subjects.find((subject) => String(subject.id) === String(createdId))
        || knowledgeTaxonomies.subjects.find((subject) => normalizeTaxonomyText(subject.name) === normalizeTaxonomyText(name))
        || { id: createdId || name, name };
      updateLawMateria(String(created.id), created);
      addToast('Materia criada e vinculada a lei.', 'success');
    } catch (error: unknown) {
      addToast(getErrorMessage(error, 'Nao foi possivel criar a materia.'), 'error');
    } finally {
      setIsCreatingMateria(false);
    }
  };

  const createLawTopico = async (rawName: string) => {
    const name = rawName.trim();
    const materiaId = String(draft?.areaId || '');
    if (!name) {
      addToast('Informe o nome do topico da lei.', 'info');
      return;
    }
    if (!materiaId) {
      addToast('Selecione a materia da lei antes de criar o topico.', 'error');
      return;
    }

    const existing = topics.find((topic) => (
      normalizeTaxonomyText(topic.name) === normalizeTaxonomyText(name)
      && (
        String(topic.parentId || '') === materiaId
        || String(topic.rootSubjectId || '') === materiaId
      )
    ));

    if (existing) {
      updateLawTopico(String(existing.id));
      addToast('Topico existente selecionado.', 'info');
      return;
    }

    const parentId = Number(materiaId);
    if (!Number.isFinite(parentId)) {
      addToast('A materia selecionada precisa estar cadastrada nas taxonomias.', 'error');
      return;
    }

    setIsCreatingLawTopic(true);
    try {
      const createdId = await filtersService.save({
        type: 'assunto',
        name,
        slug: slugifyTaxonomy(name),
        materia: false,
        taxonomy_level: 'topico',
        parent_id: parentId,
        metadata: { taxonomy_level: 'topico' },
      });
      const knowledgeTaxonomies = await reloadKnowledgeTaxonomies();
      const created = knowledgeTaxonomies.topics.find((topic) => String(topic.id) === String(createdId))
        || knowledgeTaxonomies.topics.find((topic) => (
          normalizeTaxonomyText(topic.name) === normalizeTaxonomyText(name)
          && (
            String(topic.parentId || '') === materiaId
            || String(topic.rootSubjectId || '') === materiaId
          )
        ))
        || { id: createdId || name, name, parentId: materiaId, rootSubjectId: materiaId };
      updateLawTopico(String(created.id));
      addToast('Topico criado e vinculado a lei.', 'success');
    } catch (error: unknown) {
      addToast(getErrorMessage(error, 'Nao foi possivel criar o topico.'), 'error');
    } finally {
      setIsCreatingLawTopic(false);
    }
  };

  const updateLawField = <K extends keyof AdminLawDraft>(field: K, value: AdminLawDraft[K]) => {
    setDraft((current) => current ? { ...current, [field]: value } : current);
  };

  const updateLawTitle = (value: string) => {
    setDraft((current) => {
      if (!current) return current;
      return {
        ...current,
        title: value,
        shortTitle: value,
      };
    });
  };

  const updateSectionField = (
    sectionId: string,
    patch: Partial<LawSection>,
  ) => {
    setDraft((current) => {
      if (!current) return current;
      return {
        ...current,
        sections: (current.sections || []).map((section) => (
          String(section.id) === String(sectionId)
            ? {
              ...section,
              ...patch,
              title: String(patch.displayTitle || patch.title || section.displayTitle || section.title || ''),
              displayTitle: String(patch.displayTitle || patch.title || section.displayTitle || section.title || ''),
            }
            : section
        )),
        articles: patch.assuntoFilterId !== undefined
          ? (current.articles || []).map((article) => (
            String(article.sectionId || '') === String(sectionId)
              ? {
                ...article,
                assuntoFilterId: patch.assuntoFilterId || null,
              }
              : article
          ))
          : current.articles,
      };
    });
  };

  const addSection = () => {
    setDraft((current) => {
      if (!current) return current;
      const sectionId = createTempId('section');
      const sectionIndex = (current.sections || []).length;
      const section: LawSection = {
        id: sectionId,
        lawId: String(current.id || 'new'),
        slug: sectionId,
        title: `CAPITULO ${sectionIndex + 1}`,
        displayTitle: `CAPITULO ${sectionIndex + 1}`,
        articleCount: 0,
        sortOrder: sectionIndex,
      };
      setActiveSectionId(sectionId);
      return {
        ...current,
        sections: [...(current.sections || []), section],
      };
    });
  };

  const createSectionSubtopic = async (sectionId: string, rawName: string) => {
    const name = rawName.trim();
    const lawTopicId = String(draft?.lawTopicFilterId || '');
    if (!name) {
      addToast('Informe o nome do subtopico.', 'info');
      return;
    }
    if (!lawTopicId) {
      addToast('Selecione o topico da lei antes de criar um subtopico.', 'error');
      return;
    }

    setIsCreatingSubtopic(true);
    try {
      const existing = topics.find((topic) => (
        normalizeTaxonomyText(topic.name) === normalizeTaxonomyText(name)
        && (String(topic.parentId || '') === lawTopicId || String(topic.rootSubjectId || '') === lawTopicId)
      ));
      const createdId = existing?.id || await filtersService.save({
        type: 'assunto',
        name,
        slug: slugifyTaxonomy(name),
        materia: false,
        taxonomy_level: 'subtopico',
        parent_id: Number(lawTopicId),
        metadata: { taxonomy_level: 'subtopico' },
      });
      const knowledgeTaxonomies = existing ? { topics } : await reloadKnowledgeTaxonomies();
      const created = knowledgeTaxonomies.topics.find((topic) => String(topic.id) === String(createdId))
        || { id: createdId || name, name, parentId: lawTopicId, rootSubjectId: lawTopicId };
      updateSectionField(sectionId, {
        subtopicFilterId: String(created.id),
        titleName: created.name,
        assuntoFilterId: null,
        chapterName: '',
      });
      addToast(existing ? 'Subtopico existente selecionado.' : 'Subtopico criado e vinculado ao capitulo.', existing ? 'info' : 'success');
    } catch (error: unknown) {
      addToast(getErrorMessage(error, 'Nao foi possivel criar o subtopico do capitulo.'), 'error');
    } finally {
      setIsCreatingSubtopic(false);
    }
  };

  const createSectionAssunto = async (sectionId: string, rawName: string) => {
    const name = rawName.trim();
    const section = (draft?.sections || []).find((item) => String(item.id) === String(sectionId));
    const parentTaxonomyId = String(section?.subtopicFilterId || draft?.lawTopicFilterId || '');
    if (!name) {
      addToast('Informe o nome do assunto.', 'info');
      return;
    }
    if (!parentTaxonomyId) {
      addToast('Selecione o topico ou subtópico antes de criar o assunto.', 'error');
      return;
    }

    setIsCreatingAssunto(true);
    try {
      const existing = specificSubjects.find((subject) => (
        normalizeTaxonomyText(subject.name) === normalizeTaxonomyText(name)
        && String(subject.parentId || '') === parentTaxonomyId
      ));
      const createdId = existing?.id || await filtersService.save({
        type: 'assunto',
        name,
        slug: slugifyTaxonomy(name),
        materia: false,
        taxonomy_level: 'assunto',
        parent_id: Number(parentTaxonomyId),
        metadata: { taxonomy_level: 'assunto' },
      });
      const knowledgeTaxonomies = existing ? { specificSubjects } : await reloadKnowledgeTaxonomies();
      const created = knowledgeTaxonomies.specificSubjects.find((subject) => String(subject.id) === String(createdId))
        || { id: createdId || name, name, parentId: parentTaxonomyId };
      updateSectionField(sectionId, {
        assuntoFilterId: String(created.id),
        chapterName: created.name,
      });
      addToast(existing ? 'Assunto existente selecionado.' : 'Assunto criado e vinculado ao capitulo.', existing ? 'info' : 'success');
    } catch (error: unknown) {
      addToast(getErrorMessage(error, 'Nao foi possivel criar o assunto do capitulo.'), 'error');
    } finally {
      setIsCreatingAssunto(false);
    }
  };

  const moveArticleToSection = (articleId: string, sectionId: string) => {
    setDraft((current) => {
      if (!current) return current;
      const targetSection = (current.sections || []).find((section) => String(section.id) === String(sectionId));
      return {
        ...current,
        articles: (current.articles || []).map((article) => (
          String(article.id) === String(articleId)
            ? { ...article, sectionId, assuntoFilterId: targetSection?.assuntoFilterId || null }
            : article
        )),
      };
    });
  };

  const updateArticleField = (field: keyof LawArticle | 'assuntoFilterId', value: unknown) => {
    if (!activeArticle) return;

    setDraft((current) => {
      if (!current) return current;
      const nextArticles = (current.articles || []).map((article) => {
        if (article.id !== activeArticle.id) return article;

        if (field === 'text') {
          const nextCaputText = String(value || '').trim();
          return {
            ...article,
            text: nextCaputText,
            blocks: normalizeArticleBlocks({
              ...article,
              text: nextCaputText,
              blocks: [
                {
                  id: article.blocks?.find((block) => block.kind === 'caput')?.id || `${article.id}-caput`,
                  kind: 'caput',
                  label: article.number ? `Art. ${article.number}` : 'Art.',
                  text: nextCaputText,
                },
                ...(article.blocks || []).filter((block) => block.kind !== 'caput'),
              ],
            }),
          };
        }

        if (field === 'number') {
          const nextNumber = String(value || '').trim();
          return {
            ...article,
            number: nextNumber,
            blocks: normalizeArticleBlocks({
              ...article,
              number: nextNumber,
              blocks: (article.blocks || []).map((block) => (
                block.kind === 'caput'
                  ? {
                    ...block,
                    label: nextNumber ? `Art. ${nextNumber}` : 'Art.',
                  }
                  : block
              )),
            }),
          };
        }

        return { ...article, [field]: value as LawArticle[keyof LawArticle] };
      });

      return { ...current, articles: nextArticles };
    });
  };

  const addArticleBlock = (kind: LegalArticleBlock['kind']) => {
    if (!activeArticle) return;
    setDraft((current) => {
      if (!current) return current;
      return {
        ...current,
        articles: (current.articles || []).map((article) => {
          if (article.id !== activeArticle.id) return article;
          const currentBlocks = normalizeArticleBlocks(article);
          const kindCount = currentBlocks.filter((block) => block.kind === kind).length;
          const nextBlock: LegalArticleBlock = {
            id: `${article.id}-${kind}-${Date.now()}`,
            kind,
            label: buildDefaultBlockLabel(kind, String(article.number || '').trim(), kindCount + 1),
            text: '',
          };
          return {
            ...article,
            blocks: normalizeArticleBlocks({
              ...article,
              blocks: [...currentBlocks, nextBlock],
            }),
          };
        }),
      };
    });
  };

  const updateArticleBlock = (blockId: string, patch: Partial<LegalArticleBlock>) => {
    if (!activeArticle) return;
    setDraft((current) => {
      if (!current) return current;
      return {
        ...current,
        articles: (current.articles || []).map((article) => {
          if (article.id !== activeArticle.id) return article;
          const nextBlocks = (article.blocks || []).map((block) => (
            block.id === blockId
              ? {
                ...block,
                ...patch,
              }
              : block
          ));
          return {
            ...article,
            blocks: normalizeArticleBlocks({
              ...article,
              blocks: nextBlocks,
            }),
          };
        }),
      };
    });
  };

  const removeArticleBlock = (blockId: string) => {
    if (!activeArticle) return;
    setDraft((current) => {
      if (!current) return current;
      return {
        ...current,
        articles: (current.articles || []).map((article) => {
          if (article.id !== activeArticle.id) return article;
          const remaining = (article.blocks || []).filter((block) => block.id !== blockId);
          return {
            ...article,
            blocks: normalizeArticleBlocks({
              ...article,
              blocks: remaining,
            }),
          };
        }),
      };
    });
  };

  const addArticle = () => {
    setDraft((current) => {
      if (!current) return current;
      const sectionId = activeSectionOverview?.id || current.sections?.[0]?.id || null;
      const section = (current.sections || []).find((item) => String(item.id) === String(sectionId || ''));
      const article = buildEmptyArticle(current.id || 'new', sectionId, section?.assuntoFilterId || null);
      setActiveArticleId(article.id);
      if (sectionId) {
        setActiveSectionId(sectionId);
      }
      return {
        ...current,
        articles: [...(current.articles || []), article],
      };
    });
  };

  const removeArticle = (articleId: string) => {
    setDraft((current) => {
      if (!current) return current;
      const nextArticles = (current.articles || []).filter((article) => article.id !== articleId);
      setActiveArticleId(nextArticles[0]?.id || '');
      return {
        ...current,
        articles: nextArticles,
        teacherComments: (current.teacherComments || []).filter((item) => item.articleId !== articleId),
        jurisprudence: (current.jurisprudence || []).filter((item) => item.articleId !== articleId),
        examTips: (current.examTips || []).filter((item) => item.articleId !== articleId),
        sumulas: (current.sumulas || []).filter((item) => item.articleId !== articleId),
      };
    });
  };

  const startAiProgress = (kind: string, label: string) => {
    setAiProgress({ kind, label, percent: 8 });
    window.setTimeout(() => {
      setAiProgress((current) => current?.kind === kind ? { ...current, percent: Math.max(current.percent, 32) } : current);
    }, 120);
    window.setTimeout(() => {
      setAiProgress((current) => current?.kind === kind ? { ...current, percent: Math.max(current.percent, 64) } : current);
    }, 650);
  };

  const finishAiProgress = (kind: string, percent = 100) => {
    setAiProgress((current) => current?.kind === kind ? { ...current, percent } : current);
    window.setTimeout(() => {
      setAiProgress((current) => current?.kind === kind ? null : current);
    }, 900);
  };

  const buildArticleEditorialSnapshot = React.useCallback((currentDraft: AdminLawDraft, article: LawArticle): LegalArticleEditorialSnapshot => {
    const draftTeacherComments = (currentDraft.teacherComments || []).filter((item) => item.articleId === article.id);
    const draftExamTips = (currentDraft.examTips || []).filter((item) => item.articleId === article.id);
    const draftJurisprudence = (currentDraft.jurisprudence || []).filter((item) => item.articleId === article.id);
    const draftSumulas = (currentDraft.sumulas || []).filter((item) => item.articleId === article.id);
    const articleLegacyExamTips = Array.isArray((article as { examTips?: ArticleExamTip[] }).examTips)
      ? (article as { examTips?: ArticleExamTip[] }).examTips || []
      : [];
    const fallbackExamTipBody = String(article.examTip || article.macete || '').trim();

    return {
      articleId: article.id,
      articleNumber: article.number,
      teacherComments: draftTeacherComments.length > 0 ? draftTeacherComments : (article.comentarios || []),
      examTips: draftExamTips.length > 0
        ? draftExamTips
        : (articleLegacyExamTips.length > 0
          ? articleLegacyExamTips
          : (fallbackExamTipBody ? [{
            id: createTempId('tip-existing'),
            articleId: article.id,
            title: 'Macete para prova',
            body: fallbackExamTipBody,
            tags: [],
          }] : [])),
      doctrine: article.doctrine || article.doutrina || [],
      jurisprudenceNotes: article.jurisprudenceNotes || [],
      jurisprudence: draftJurisprudence.length > 0 ? draftJurisprudence : (article.jurisprudencia || []),
      sumulas: draftSumulas.length > 0 ? draftSumulas : (article.sumulas || article.syllabi || []),
    };
  }, []);

  const ensureNestedIds = React.useCallback((articleId: string, editorial: LegalArticleEditorialSnapshot): LegalArticleEditorialSnapshot => ({
    articleId,
    articleNumber: editorial.articleNumber,
    teacherComments: (editorial.teacherComments || []).map((item) => ({
      ...item,
      id: item.id || createTempId('teacher'),
      articleId,
    })),
    examTips: (editorial.examTips || []).map((item) => ({
      ...item,
      id: item.id || createTempId('tip'),
      articleId,
    })),
    doctrine: editorial.doctrine || [],
    jurisprudenceNotes: (editorial.jurisprudenceNotes || [])
      .filter((item) => !isEmptyJurisprudencePlaceholderText(item)),
    jurisprudence: (editorial.jurisprudence || []).map((item) => ({
      ...item,
      id: item.id || createTempId('juris'),
      articleId,
    })).filter(hasMeaningfulJurisprudenceContent),
    sumulas: (editorial.sumulas || []).map((item) => ({
      ...item,
      id: item.id || createTempId('sumula'),
      articleId,
    })),
  }), []);

  const applyEditorialResultToDraft = React.useCallback((result: LegalEditorialGenerationResult) => {
    if (!result.articleId) return;

    setDraft((current) => {
      if (!current) return current;
      const editorial = ensureNestedIds(result.articleId, result.editorial);
      const scope = result.scope;
      const updatesTeacherComments = ['article-full', 'stage-a', 'field-comment'].includes(scope);
      const updatesExamTips = ['article-full', 'stage-a', 'field-macete'].includes(scope);
      const updatesDoctrine = ['article-full', 'stage-b', 'field-doutrina'].includes(scope);
      const updatesJurisprudence = ['article-full', 'stage-c', 'field-jurisprudencia'].includes(scope);
      const updatesSumulas = ['article-full', 'stage-c', 'field-sumulas'].includes(scope);
      const activeArticle = (current.articles || []).find((article) => article.id === result.articleId);
      const existingTeacherComments = (current.teacherComments || []).filter((item) => item.articleId === result.articleId);
      const existingExamTips = (current.examTips || []).filter((item) => item.articleId === result.articleId);
      const existingJurisprudence = (current.jurisprudence || []).filter((item) => item.articleId === result.articleId);
      const existingSumulas = (current.sumulas || []).filter((item) => item.articleId === result.articleId);
      const nextTeacherCommentsForArticle = updatesTeacherComments
        ? mergeTeacherCommentsByTarget(
          existingTeacherComments.length > 0 ? existingTeacherComments : (activeArticle?.comentarios || []),
          editorial.teacherComments,
        )
        : (existingTeacherComments.length > 0 ? existingTeacherComments : (activeArticle?.comentarios || []));
      const nextExamTipsForArticle = updatesExamTips
        ? mergeExamTipsByTarget(
          existingExamTips.length > 0 ? existingExamTips : buildArticleEditorialSnapshot(current, activeArticle || { id: result.articleId } as LawArticle).examTips,
          editorial.examTips,
        )
        : (existingExamTips.length > 0 ? existingExamTips : buildArticleEditorialSnapshot(current, activeArticle || { id: result.articleId } as LawArticle).examTips);
      const nextJurisprudenceForArticle = updatesJurisprudence && editorial.jurisprudence.length > 0
        ? editorial.jurisprudence
        : (existingJurisprudence.length > 0 ? existingJurisprudence : (activeArticle?.jurisprudencia || []));
      const nextSumulasForArticle = updatesSumulas && editorial.sumulas.length > 0
        ? editorial.sumulas
        : (existingSumulas.length > 0 ? existingSumulas : (activeArticle?.sumulas || activeArticle?.syllabi || []));

      const nextDraft = {
        ...current,
        teacherComments: updatesTeacherComments
          ? [
            ...(current.teacherComments || []).filter((item) => item.articleId !== result.articleId),
            ...nextTeacherCommentsForArticle,
          ]
          : current.teacherComments || [],
        examTips: updatesExamTips
          ? [
            ...(current.examTips || []).filter((item) => item.articleId !== result.articleId),
            ...nextExamTipsForArticle,
          ]
          : current.examTips || [],
        jurisprudence: updatesJurisprudence
          ? [
            ...(current.jurisprudence || []).filter((item) => item.articleId !== result.articleId),
            ...nextJurisprudenceForArticle,
          ]
          : current.jurisprudence || [],
        sumulas: updatesSumulas
          ? [
            ...(current.sumulas || []).filter((item) => item.articleId !== result.articleId),
            ...nextSumulasForArticle,
          ]
          : current.sumulas || [],
        articles: (current.articles || []).map((article) => article.id === result.articleId ? {
          ...article,
          doctrine: updatesDoctrine && editorial.doctrine.length > 0 ? editorial.doctrine : article.doctrine,
          doutrina: updatesDoctrine && editorial.doctrine.length > 0 ? editorial.doctrine : article.doutrina,
          jurisprudenceNotes: updatesJurisprudence && (editorial.jurisprudenceNotes || []).length > 0
            ? editorial.jurisprudenceNotes || []
            : article.jurisprudenceNotes,
          macete: updatesExamTips && nextExamTipsForArticle[0]?.body ? nextExamTipsForArticle[0].body : article.macete,
          examTip: updatesExamTips && nextExamTipsForArticle[0]?.body ? nextExamTipsForArticle[0].body : article.examTip,
          comentarios: updatesTeacherComments ? nextTeacherCommentsForArticle : article.comentarios,
          jurisprudencia: updatesJurisprudence ? nextJurisprudenceForArticle : article.jurisprudencia,
          sumulas: updatesSumulas ? nextSumulasForArticle : article.sumulas,
          syllabi: updatesSumulas ? nextSumulasForArticle : article.syllabi,
        } : article),
      };
      draftRef.current = nextDraft;
      return nextDraft;
    });
  }, [buildArticleEditorialSnapshot, ensureNestedIds]);

  const generateArticleEditorial = React.useCallback(async (
    article: LawArticle,
    scope: LegalEditorialGenerationScope,
    target?: LegalRichContentBlock['target'] | null,
  ) => {
    const currentDraft = draftRef.current;
    if (!currentDraft) {
      throw new Error('Nenhuma lei carregada para gerar editorial.');
    }

    const result = await legalCommentaryApiService.generateAdminEditorial({
      scope,
      lawId: String(currentDraft.id || ''),
      articleId: article.id,
      law: currentDraft,
      article,
      existingEditorial: buildArticleEditorialSnapshot(currentDraft, article),
      previewOnly: true,
      target,
    });

    applyEditorialResultToDraft(result);
    return result;
  }, [applyEditorialResultToDraft, buildArticleEditorialSnapshot]);

  const applySectionEditorialToDraft = React.useCallback((sectionEditorial?: LawSectionEditorial) => {
    const editorialKey = String(sectionEditorial?.sectionId || '');
    if (!sectionEditorial || !editorialKey) {
      return;
    }

    setDraft((current) => {
      if (!current) {
        return current;
      }

      const existing = current.sectionEditorials || [];
      const nextSectionEditorials = [
        ...existing.filter((item) => String(item.sectionId || '') !== editorialKey),
        sectionEditorial,
      ];

      const nextDraft = {
        ...current,
        sectionEditorials: nextSectionEditorials,
      };
      draftRef.current = nextDraft;
      return nextDraft;
    });
  }, []);

  const updateSectionEditorialInDraft = React.useCallback((
    sectionId: string,
    updater: (editorial: LawSectionEditorial) => LawSectionEditorial,
  ) => {
    const editorialKey = String(sectionId || '');
    if (!editorialKey) {
      return;
    }

    setDraft((current) => {
      if (!current) {
        return current;
      }

      const nextSectionEditorials = (current.sectionEditorials || []).map((item) => (
        String(item.sectionId || '') === editorialKey ? updater(item) : item
      ));

      const nextDraft = {
        ...current,
        sectionEditorials: nextSectionEditorials,
      };
      draftRef.current = nextDraft;
      return nextDraft;
    });
  }, []);

  const removeSectionEditorialFromDraft = React.useCallback((sectionId: string) => {
    const editorialKey = String(sectionId || '');
    if (!editorialKey) {
      return;
    }

    setDraft((current) => {
      if (!current) {
        return current;
      }

      const nextSectionEditorials = (current.sectionEditorials || []).filter((item) => (
        String(item.sectionId || '') !== editorialKey
      ));

      const nextDraft = {
        ...current,
        sectionEditorials: nextSectionEditorials,
      };
      draftRef.current = nextDraft;
      return nextDraft;
    });

    setEditingSectionAnalysisId((current) => (current === editorialKey ? null : current));
  }, []);

  const updateSectionEditorialBlockInDraft = React.useCallback((
    sectionId: string,
    blockIndex: number,
    updater: (block: NonNullable<LawSectionEditorial['blocks']>[number]) => NonNullable<LawSectionEditorial['blocks']>[number],
  ) => {
    updateSectionEditorialInDraft(sectionId, (editorial) => ({
      ...editorial,
      blocks: (editorial.blocks || []).map((block, index) => (index === blockIndex ? updater(block) : block)),
    }));
  }, [updateSectionEditorialInDraft]);

  const generateSectionAnalysis = React.useCallback(async (section: AdminLawSectionOverview | LawSection, options?: { silent?: boolean }) => {
    const currentDraft = draftRef.current;
    if (!currentDraft?.id || !/^\d+$/.test(String(currentDraft.id))) {
      addToastRef.current('Salve a lei antes de gerar a analise dos capitulos.', 'info');
      return null;
    }

    const sectionId = section.id;
    setSectionAnalysisLoadingKey(sectionId);

    try {
      const result = await legalCommentaryApiService.generateAdminEditorial({
        scope: 'section-analysis',
        lawId: String(currentDraft.id),
        law: {
          id: currentDraft.id,
          title: currentDraft.title,
          shortTitle: currentDraft.shortTitle,
          number: currentDraft.number,
          officialUrl: currentDraft.officialUrl,
        },
        section: {
          id: section.id,
          sectionId: section.id,
          sectionTitle: section.title,
          title: section.title,
          rangeLabel: formatSectionRange(section),
          fromArticle: section.fromArticle,
          toArticle: section.toArticle,
          articleIds: 'articleIds' in section ? section.articleIds : [],
        },
        previewOnly: true,
      });

      applySectionEditorialToDraft(result.sectionEditorial);
      if (!options?.silent) {
        addToastRef.current(`Analise do capitulo "${section.title}" gerada.`, 'success');
      }
      return result.sectionEditorial || null;
    } catch (error: unknown) {
      if (!options?.silent) {
        addToastRef.current(getErrorMessage(error, 'Nao foi possivel gerar a analise do capitulo.'), 'error');
      }
      return null;
    } finally {
      setSectionAnalysisLoadingKey(null);
    }
  }, [applySectionEditorialToDraft]);

  const buildMissingLawAiTasks = React.useCallback((
    currentDraft: AdminLawDraft,
    options?: {
      includeSections?: boolean;
      includeArticles?: boolean;
      articleKinds?: LegalArticleAiKind[];
    },
  ): LegalAiBulkTask[] => {
    const tasks: LegalAiBulkTask[] = [];
    const existingSectionKeys = new Set((currentDraft.sectionEditorials || []).map((item) => String(item.sectionId || '')));
    const allowedArticleKinds = options?.articleKinds && options.articleKinds.length > 0
      ? new Set(options.articleKinds)
      : null;

    if (options?.includeSections !== false) {
      sectionOverviews
        .filter((section) => !existingSectionKeys.has(section.resolvedSectionId))
        .forEach((section) => {
          tasks.push({
            id: `section:${section.resolvedSectionId}`,
            type: 'section-analysis',
            label: `Analise do capitulo - ${section.title}`,
            section,
          });
        });
    }

    if (options?.includeArticles !== false) {
      (currentDraft.articles || [])
        .filter((article) => !isLikelyEditoriallyIrrelevantArticle(article))
        .forEach((article) => {
          const counts = getArticleEditorialCounts(currentDraft, article);
          getMissingArticleAiRequirements(counts).filter((kind) => !allowedArticleKinds || allowedArticleKinds.has(kind)).forEach((kind) => {
            tasks.push({
              id: `article:${article.id}:${kind}`,
              type: 'article-field',
              label: `${getArticleLabel(article)} - ${AI_KIND_LABEL[kind]}`,
              article,
              kind,
            });
          });
        });
    }

    return tasks;
  }, [sectionOverviews]);

  const generateMissingLawAiContent = React.useCallback(async (options?: {
    includeSections?: boolean;
    includeArticles?: boolean;
    articleKinds?: LegalArticleAiKind[];
    emptyMessage?: string;
  }) => {
    const currentDraft = draftRef.current;
    if (!currentDraft?.id || !/^\d+$/.test(String(currentDraft.id))) {
      addToastRef.current('Salve a lei antes de gerar conteudo em lote com IA.', 'info');
      return;
    }

    const tasks = buildMissingLawAiTasks(currentDraft, options);

    if (tasks.length === 0) {
      setLawAiBulkProgress({
        total: 0,
        completed: 0,
        failed: 0,
        currentLabel: 'Tudo ja possui conteudo editorial de IA.',
        running: false,
      });
      addToastRef.current(options?.emptyMessage || 'Nada pendente: capitulos e artigos ja possuem conteudo editorial.', 'success');
      return;
    }

    setIsGeneratingAllSectionAnalyses(true);
    setLawAiBulkProgress({
      total: tasks.length,
      completed: 0,
      failed: 0,
      currentLabel: 'Preparando geracao editorial...',
      running: true,
    });

    let successCount = 0;
    let failedCount = 0;
    try {
      for (let index = 0; index < tasks.length; index += 1) {
        const task = tasks[index];
        setLawAiBulkProgress({
          total: tasks.length,
          completed: index,
          failed: failedCount,
          currentLabel: task.label,
          running: true,
        });

        try {
          if (task.type === 'section-analysis') {
            const saved = await generateSectionAnalysis(task.section, { silent: true });
            if (saved) {
              successCount += 1;
            } else {
              failedCount += 1;
            }
          } else {
            await generateArticleEditorial(task.article, resolveAiScope(task.kind));
            successCount += 1;
          }
        } catch {
          failedCount += 1;
        } finally {
          setLawAiBulkProgress({
            total: tasks.length,
            completed: index + 1,
            failed: failedCount,
            currentLabel: task.label,
            running: true,
          });
        }
      }

      setLawAiBulkProgress({
        total: tasks.length,
        completed: tasks.length,
        failed: failedCount,
        currentLabel: failedCount > 0 ? 'Geracao concluida com pendencias.' : 'Geracao editorial concluida.',
        running: false,
      });

      if (failedCount > 0) {
        addToastRef.current(
          `Geracao editorial concluida com pendencias: ${successCount} sucesso(s), ${failedCount} falha(s).`,
          'info',
        );
      } else {
        addToastRef.current(`Conteudo editorial gerado: ${successCount} item(ns) atualizado(s).`, 'success');
      }
    } finally {
      setIsGeneratingAllSectionAnalyses(false);
    }
  }, [buildMissingLawAiTasks, generateArticleEditorial, generateSectionAnalysis]);

  const generateWithAi = async (
    kind: Exclude<LegalAiGenerationKind, 'bundle'>,
    options?: { target?: LegalRichContentBlock['target'] | null; loadingKey?: string; label?: string },
  ) => {
    if (!draft || !activeArticle) {
      addToast('Nenhum artigo ativo para gerar conteudo.', 'info');
      return;
    }

    if (isLikelyEditoriallyIrrelevantArticle(activeArticle)) {
      addToast('Este artigo parece ser bloco final, assinatura ou expediente sem relevancia recorrente para prova. Nao e necessario gerar conteudo editorial.', 'info');
      return;
    }

    const loadingKey = options?.loadingKey || kind;
    const label = options?.label || AI_KIND_LABEL[kind];
    setAiLoading(loadingKey);
    startAiProgress(loadingKey, label);

    try {
      const result = await generateArticleEditorial(activeArticle, resolveAiScope(kind), options?.target || null);
      setAiProgress((current) => current?.kind === loadingKey ? { ...current, percent: 92 } : current);
      const warnings = result.summary.warnings || [];

      if (result.summary.approvedBlocks > 0) {
        addToast(`${label} gerado${result.persisted ? ' e salvo' : ''}. Revise o resultado.`, 'success');
      } else {
        addToast(warnings[0] || `Nada seguro para adicionar em ${label.toLowerCase()}.`, 'info');
      }
    } catch (error: unknown) {
      addToast(getErrorMessage(error, 'Nao foi possivel gerar com IA agora.'), 'error');
    } finally {
      finishAiProgress(loadingKey);
      setAiLoading(null);
    }
  };

  const importFromPlanalto = async () => {
    const officialUrl = draft?.officialUrl?.trim();
    if (!officialUrl) {
      addToast('Informe a URL oficial do Planalto para importar a lei.', 'error');
      return;
    }

    setIsImportingFromPlanalto(true);

    try {
      const result = await legalCommentaryApiService.importLawFromPlanalto(officialUrl, false);
      const knowledgeTaxonomies = await resolveKnowledgeTaxonomies(true);
      const nextDraft = hydrateDraftFromLaw(result.law, areas, knowledgeTaxonomies.subjects, knowledgeTaxonomies.topics);
      setSubjects(knowledgeTaxonomies.subjects);
      setTopics(knowledgeTaxonomies.topics);
      setSpecificSubjects(knowledgeTaxonomies.specificSubjects);
      setDraft(nextDraft);
      setActiveArticleId(nextDraft.articles?.[0]?.id || '');
      addToast('Lei importada do Planalto para revisao no editor.', 'success');
    } catch (error: unknown) {
      addToast(getErrorMessage(error, 'Nao foi possivel importar a lei do Planalto.'), 'error');
    } finally {
      setIsImportingFromPlanalto(false);
    }
  };

  const syncFromOfficialSource = async () => {
    if (!draft?.id || isNew) {
      addToast('Salve a lei antes de sincronizar com a fonte oficial.', 'info');
      return;
    }

    setIsSyncingFromOfficial(true);

    try {
      const result = await legalCommentaryApiService.syncAdminLaw(String(draft.id));
      const knowledgeTaxonomies = await resolveKnowledgeTaxonomies(true);
      const sync = result.sync || { insertedArticles: 0, changedArticles: 0, revokedArticles: 0 };
      const hasChanges = sync.insertedArticles > 0 || sync.changedArticles > 0 || sync.revokedArticles > 0;
      const nextDraft = hydrateDraftFromLaw(result.law, areas, knowledgeTaxonomies.subjects, knowledgeTaxonomies.topics);

      setSubjects(knowledgeTaxonomies.subjects);
      setTopics(knowledgeTaxonomies.topics);
      setSpecificSubjects(knowledgeTaxonomies.specificSubjects);

      setDraft(nextDraft);
      setActiveArticleId((current) => current && nextDraft.articles.some((article) => article.id === current)
        ? current
        : nextDraft.articles?.[0]?.id || '');

      addToast(
        hasChanges
          ? `O que mudou atualizado: ${sync.changedArticles} alterado(s), ${sync.insertedArticles} novo(s), ${sync.revokedArticles} revogado(s).`
          : 'Sincronizacao concluida sem mudancas no texto oficial.',
        hasChanges ? 'success' : 'info',
      );
    } catch (error: unknown) {
      addToast(getErrorMessage(error, 'Nao foi possivel sincronizar esta lei.'), 'error');
    } finally {
      setIsSyncingFromOfficial(false);
    }
  };

  const openUpdatesModal = React.useCallback(async () => {
    if (!draft?.id || isNew) {
      return;
    }

    setIsUpdatesModalOpen(true);
    setIsUpdatesModalLoading(true);

    try {
      const payload = await legalCommentaryApiService.getAdminLawUpdates(String(draft.id));
      setUpdatesModalItems(payload.updates || []);
      setUpdatesModalLogs(payload.syncLogs || []);

      if (payload.law) {
        const nextDraft = hydrateDraftFromLaw(payload.law, areas, subjects, topics);
        setDraft(nextDraft);
        setActiveArticleId((current) => current && nextDraft.articles.some((article) => article.id === current)
          ? current
          : nextDraft.articles?.[0]?.id || '');
      }
    } catch (error: unknown) {
      addToast(getErrorMessage(error, 'Nao foi possivel carregar o historico de atualizacoes.'), 'error');
    } finally {
      setIsUpdatesModalLoading(false);
    }
  }, [addToast, areas, draft?.id, isNew, subjects, topics]);

  const closeUpdatesModal = () => {
    if (isUpdatesModalLoading) return;
    setIsUpdatesModalOpen(false);
  };

  React.useEffect(() => {
    if (
      !shouldOpenUpdatesFromQuery ||
      hasOpenedUpdatesFromQueryRef.current ||
      !draft?.id ||
      isNew ||
      isLoading
    ) {
      return;
    }

    hasOpenedUpdatesFromQueryRef.current = true;
    void openUpdatesModal();
    router.replace(buildAdminLawEditPath(draft.id), { scroll: false });
  }, [draft?.id, isLoading, isNew, openUpdatesModal, router, shouldOpenUpdatesFromQuery]);

  const resolvePublicationDate = (options?: { publish?: boolean }) => {
    if (!options?.publish) {
      return draftRef.current?.publishedAt || draftRef.current?.published_at || draftRef.current?.date || null;
    }

    const normalizedDate = normalizeAdminPublicationDate(scheduledDate);
    if (normalizedDate) {
      return `${normalizedDate} ${normalizeAdminPublicationTime(scheduledTime)}:00`;
    }

    return formatLocalDateTimeForApi(new Date());
  };

  const saveLaw = async (options?: { publish?: boolean; draft?: boolean }) => {
    if (!draft) return;
    const normalizedAreaId = String(draft.areaId || draft.area?.id || '').trim();
    if (!normalizedAreaId) {
      addToast('Selecione a materia da lei antes de salvar.', 'info');
      return;
    }
    if (options?.publish && draft.status === 'scheduled' && !normalizeAdminPublicationDate(scheduledDate)) {
      addToast('Informe a data de agendamento antes de agendar a lei.', 'info');
      return;
    }

    setIsSaving(true);

    try {
      const cleanedPreamble = String(draft.preamble || '').trim();
      const cleanedEmenta = String(draft.ementa || '').trim();
      const cleanedDescription = cleanedPreamble || cleanedEmenta || String(draft.description || '').trim();
      const normalizedLawName = String(draft.title || draft.shortTitle || '').trim();
      const normalizedArticles = (draft.articles || []).map((article) => normalizeArticleForSave(article));
      const shouldSchedulePublication = options?.publish && draft.status === 'scheduled';
      const nextStatus: NonNullable<AdminLawDraft['status']> = (
        options?.draft ? 'draft' : options?.publish ? (shouldSchedulePublication ? 'scheduled' : 'active') : (draft.status || 'draft')
      ) as NonNullable<AdminLawDraft['status']>;
      const nextPublicationDate = resolvePublicationDate({ publish: options?.publish });
      const saved = await legalCommentaryApiService.saveAdminLaw({
        ...draft,
        title: normalizedLawName,
        shortTitle: normalizedLawName,
        status: nextStatus,
        date: nextPublicationDate,
        publishedAt: nextPublicationDate,
        published_at: nextPublicationDate,
        preamble: cleanedPreamble,
        description: cleanedDescription,
        summary: '',
        ementa: cleanedEmenta,
        areaId: normalizedAreaId,
        legalAreaId: String(draft.legalAreaId || getLegalAreaId(draft.area) || ''),
        lawTopicFilterId: draft.lawTopicFilterId ? String(draft.lawTopicFilterId) : null,
        articles: normalizedArticles,
        teacherComments: draft.teacherComments || [],
        jurisprudence: draft.jurisprudence || [],
        examTips: draft.examTips || [],
        sumulas: draft.sumulas || [],
        sectionEditorials: draft.sectionEditorials || [],
      });
      addToast(options?.draft ? 'Rascunho salvo com sucesso.' : 'Lei salva com sucesso.', 'success');
      if (isNew && saved.id) {
        router.replace(buildAdminLawEditPath(saved.id));
      } else {
        const nextDraft = hydrateDraftFromLaw(saved, areas, subjects, topics);
        setDraft(nextDraft);
        setActiveArticleId((current) => current && nextDraft.articles.some((article) => article.id === current)
          ? current
          : nextDraft.articles?.[0]?.id || '');
      }
    } catch (error: unknown) {
      addToast(getErrorMessage(error, 'Nao foi possivel salvar a lei.'), 'error');
    } finally {
      setIsSaving(false);
    }
  };

  if (isAuthLoading || isLoading) {
    return renderAdminShell(
      <div className={`${ADMIN_SURFACE_CLASS} p-8`}>
        <div className="space-y-4">
          {Array.from({ length: 6 }).map((_, index) => (
            <div key={`editor-loading-${index}`} className="h-12 animate-pulse rounded-sm bg-slate-100 dark:bg-slate-800" />
          ))}
        </div>
      </div>,
    );
  }

  if (!draft) {
    return renderAdminShell(
      <div className={`${ADMIN_SURFACE_CLASS} flex min-h-[280px] flex-col items-center justify-center gap-3 p-8 text-center`}>
        <p className="text-sm font-semibold text-red-600 dark:text-red-300">
          {loadError || 'Nao foi possivel montar o editor da Lei Comentada.'}
        </p>
        <button
          type="button"
          onClick={() => {
            setLoadError(null);
            setDraft(null);
            setEditorReloadVersion((current) => current + 1);
          }}
          className={ADMIN_PRIMARY_BUTTON_CLASS}
        >
          Tentar novamente
        </button>
      </div>,
    );
  }

  const recentLawUpdates = (draft.updates || []).slice(0, 3);
  const lawStatusValue = String(draft.status || 'active');
  const lastSyncedLabel = draft.lastSyncedAt
    ? new Date(draft.lastSyncedAt).toLocaleString('pt-BR')
    : 'Ainda nao sincronizada';
  const activeArticleBlocks = activeArticle ? normalizeArticleBlocks(activeArticle) : [];
  const activeArticleHasSubject = Boolean(activeSectionOverview?.assuntoFilterId);
  const activeArticleTextPreview = activeArticle
    ? buildArticleTextFromBlocks(activeArticleBlocks) || activeArticle.text || activeArticle.texto || 'Texto do artigo ainda nao preenchido.'
    : 'Selecione um artigo para visualizar o conteudo.';
  const activeArticleFilterSummary = [
    { label: 'Materia', value: lawMateriaOptions.find((option) => String(option.id) === String(draft.areaId || ''))?.name || draft.area?.name || '' },
    { label: 'Topico', value: lawTopicoOptions.find((option) => String(option.id) === String(draft.lawTopicFilterId || ''))?.name || draft.title || '' },
    { label: 'Subtopico', value: activeSectionOverview?.titleName || '' },
    { label: 'Assunto', value: activeSectionOverview?.chapterName || '' },
  ].filter((item) => String(item.value || '').trim() !== '');
  const selectedLawTitle = draft.title || draft.shortTitle || 'Lei sem titulo';
  const selectedLawNumber = draft.number ? `Lei no ${draft.number}` : selectedLawTitle;
  const pendingUpdatesCount = recentLawUpdates.length;
  const showPreparationToast = (message = 'Funcionalidade em preparacao.') => addToast(message, 'info');
  const activeArticleTargetOptions = activeArticleBlocks
    .filter((block) => ['caput', 'paragraph', 'inciso', 'alinea', 'item'].includes(block.kind))
    .map((block) => {
      const kindLabel = LEGAL_BLOCK_KIND_LABEL[block.kind] || 'Bloco';
      const label = String(block.label || '').trim();
      const text = String(block.text || '').replace(/\s+/g, ' ').trim();
      return {
        id: block.id,
        label: [kindLabel, label].filter(Boolean).join(' - '),
        preview: text.length > 86 ? `${text.slice(0, 86)}...` : text,
        target: {
          kind: block.kind,
          label: label || kindLabel,
          blockId: block.id,
        } satisfies LegalRichContentBlock['target'],
      };
    });
  const selectedTeacherCommentTarget = activeArticleTargetOptions
    .find((option) => option.id === selectedTeacherCommentTargetId)?.target || null;
  const resolveArticleContentTarget = (blockId: string): LegalRichContentBlock['target'] | undefined => (
    activeArticleTargetOptions.find((option) => option.id === blockId)?.target
  );
  const updateGeneratedArticleContent = (
    kind: GeneratedArticleContentKind,
    itemId: string,
    patch: Record<string, unknown>,
    index?: number,
  ) => {
    if (!activeArticle) return;

    setDraft((current) => {
      if (!current) return current;
      const articleId = activeArticle.id;
      const updateTarget = patch.target as LegalRichContentBlock['target'] | undefined;

      const updateTeacher = (item: TeacherComment): TeacherComment => {
        if (String(item.id || '') !== itemId) return item;
        let nextItem: TeacherComment = { ...item };
        if (typeof patch.title === 'string') {
          nextItem.title = patch.title;
        }
        if (typeof patch.body === 'string') {
          nextItem = updateTeacherCommentRichBody(nextItem, patch.body);
        }
        if (Object.prototype.hasOwnProperty.call(patch, 'target')) {
          nextItem = updateTeacherCommentTarget(nextItem, updateTarget);
        }
        if (typeof patch.richBlockIndex === 'number') {
          const richBlockIndex = patch.richBlockIndex;
          const sourceBlocks = nextItem.richBlocks || nextItem.blocks || [];
          const nextBlocks = sourceBlocks
            .map((block, blockIndex) => {
              if (blockIndex !== richBlockIndex) return block;
              const nextBlock: LegalRichContentBlock = { ...block };
              if (typeof patch.richBlockTitle === 'string') {
                nextBlock.title = patch.richBlockTitle;
              }
              if (typeof patch.richBlockContent === 'string') {
                nextBlock.content = patch.richBlockContent;
                if (richBlockIndex === 0) {
                  nextItem.body = patch.richBlockContent;
                  nextItem.texto = patch.richBlockContent;
                }
              }
              if (Object.prototype.hasOwnProperty.call(patch, 'richBlockTarget')) {
                const richBlockTarget = patch.richBlockTarget as LegalRichContentBlock['target'] | undefined;
                if (richBlockTarget?.label || richBlockTarget?.blockId) {
                  nextBlock.target = richBlockTarget;
                } else {
                  delete nextBlock.target;
                }
              }
              return nextBlock;
            })
            .filter((_, blockIndex) => !(patch.removeRichBlock === true && blockIndex === richBlockIndex));

          nextItem.richBlocks = nextBlocks;
          nextItem.blocks = nextBlocks;
        }
        return nextItem;
      };

      const updateTip = (item: ArticleExamTip): ArticleExamTip => (
        String(item.id || '') === itemId
          ? {
            ...item,
            ...(typeof patch.title === 'string' ? { title: patch.title } : {}),
            ...(typeof patch.body === 'string' ? { body: patch.body, texto: patch.body } : {}),
            ...(Object.prototype.hasOwnProperty.call(patch, 'target') ? { target: updateTarget } : {}),
          }
          : item
      );

      const updateJurisprudence = (item: ArticleJurisprudence): ArticleJurisprudence => (
        String(item.id || '') === itemId
          ? {
            ...item,
            ...(typeof patch.court === 'string' ? { court: patch.court as ArticleJurisprudence['court'], tribunal: patch.court } : {}),
            ...(typeof patch.title === 'string' ? { title: patch.title } : {}),
            ...(typeof patch.summary === 'string' ? { summary: patch.summary, texto: patch.summary } : {}),
            ...(Object.prototype.hasOwnProperty.call(patch, 'target') ? { target: updateTarget } : {}),
          }
          : item
      );

      const updateSumula = (item: LegalArticleSyllabus): LegalArticleSyllabus => (
        String(item.id || '') === itemId
          ? {
            ...item,
            ...(typeof patch.court === 'string' ? { court: patch.court, tribunal: patch.court } : {}),
            ...(typeof patch.number === 'string' ? { number: patch.number, numero: patch.number } : {}),
            ...(typeof patch.text === 'string' ? { text: patch.text, texto: patch.text } : {}),
            ...(Object.prototype.hasOwnProperty.call(patch, 'target') ? { target: updateTarget } : {}),
          }
          : item
      );

      const nextDraft: AdminLawDraft = {
        ...current,
        teacherComments: kind === 'teacher'
          ? (current.teacherComments || []).map(updateTeacher)
          : current.teacherComments,
        examTips: kind === 'tip'
          ? (current.examTips || []).map(updateTip)
          : current.examTips,
        jurisprudence: kind === 'jurisprudence'
          ? (current.jurisprudence || []).map(updateJurisprudence)
          : current.jurisprudence,
        sumulas: kind === 'sumula'
          ? (current.sumulas || []).map(updateSumula)
          : current.sumulas,
        articles: (current.articles || []).map((article) => {
          if (article.id !== articleId) return article;

          if (kind === 'teacher') {
            return {
              ...article,
              comentarios: (article.comentarios || []).map(updateTeacher),
            };
          }
          if (kind === 'tip') {
            const nextTips = (current.examTips || []).map(updateTip).filter((item) => item.articleId === articleId);
            const inlineTipBody = itemId === `${article.id}-inline-macete` && typeof patch.body === 'string'
              ? patch.body
              : null;
            const editedTipBody = typeof patch.body === 'string' && nextTips.some((item) => String(item.id || '') === itemId)
              ? patch.body
              : null;
            const nextTipBody = inlineTipBody ?? editedTipBody ?? nextTips[0]?.body ?? article.examTip ?? article.macete ?? null;
            return {
              ...article,
              examTip: nextTipBody || undefined,
              macete: nextTipBody,
            };
          }
          if (kind === 'jurisprudence') {
            return {
              ...article,
              jurisprudencia: (article.jurisprudencia || []).map(updateJurisprudence),
            };
          }
          if (kind === 'sumula') {
            const nextSumulas = (article.sumulas || article.syllabi || []).map(updateSumula);
            return {
              ...article,
              sumulas: nextSumulas,
              syllabi: nextSumulas,
            };
          }
          if (kind === 'doctrine' && typeof index === 'number') {
            const nextDoctrine = [...(article.doctrine || article.doutrina || [])];
            nextDoctrine[index] = updateTargetedTextItem(nextDoctrine[index] || '', patch);
            return {
              ...article,
              doctrine: nextDoctrine,
              doutrina: nextDoctrine,
            };
          }
          if (kind === 'jurisprudenceNote' && typeof index === 'number') {
            const nextNotes = [...(article.jurisprudenceNotes || [])];
            nextNotes[index] = updateTargetedTextItem(nextNotes[index] || '', patch);
            return {
              ...article,
              jurisprudenceNotes: nextNotes,
            };
          }
          return article;
        }),
      };

      draftRef.current = nextDraft;
      return nextDraft;
    });
  };

  const deleteLaw = async () => {
    if (!draft?.id || isNew) {
      addToast('A lei ainda nao foi salva.', 'info');
      return;
    }

    const canDelete = await confirm({
      title: 'Excluir lei?',
      description: `A lei "${draft.shortTitle || draft.title || draft.id}" sera excluida permanentemente. Esta acao nao pode ser desfeita.`,
      confirmText: 'Excluir lei',
      cancelText: 'Cancelar',
      type: 'danger',
    });
    if (!canDelete) {
      return;
    }

    setIsSaving(true);
    try {
      await legalCommentaryApiService.deleteAdminLaw(String(draft.id));
      addToast('Lei excluida com sucesso.', 'success');
      router.push('/admin/operation/lei-comentada');
    } catch (error: unknown) {
      addToast(getErrorMessage(error, 'Nao foi possivel excluir a lei.'), 'error');
    } finally {
      setIsSaving(false);
    }
  };
  const removeGeneratedArticleContent = async (
    kind: GeneratedArticleContentKind,
    itemId: string,
    label: string,
    index?: number,
  ) => {
    if (!activeArticle) return;
    const canRemove = await confirm({
      title: 'Remover conteudo?',
      description: `${label} sera removido do rascunho atual. Salve a lei para confirmar.`,
      confirmText: 'Remover',
      cancelText: 'Cancelar',
      type: 'danger',
    });
    if (!canRemove) return;

    setDraft((current) => {
      if (!current) return current;
      const articleId = activeArticle.id;
      const nextDraft: AdminLawDraft = {
        ...current,
        teacherComments: kind === 'teacher'
          ? (current.teacherComments || []).filter((item) => String(item.id || '') !== itemId)
          : current.teacherComments,
        examTips: kind === 'tip'
          ? (current.examTips || []).filter((item) => String(item.id || '') !== itemId)
          : current.examTips,
        jurisprudence: kind === 'jurisprudence'
          ? (current.jurisprudence || []).filter((item) => String(item.id || '') !== itemId)
          : current.jurisprudence,
        sumulas: kind === 'sumula'
          ? (current.sumulas || []).filter((item) => String(item.id || '') !== itemId)
          : current.sumulas,
        articles: (current.articles || []).map((article) => {
          if (article.id !== articleId) return article;
          if (kind === 'teacher') {
            return {
              ...article,
              comentarios: (article.comentarios || []).filter((item) => String(item.id || '') !== itemId),
            };
          }
          if (kind === 'jurisprudence') {
            return {
              ...article,
              jurisprudencia: (article.jurisprudencia || []).filter((item) => String(item.id || '') !== itemId),
            };
          }
          if (kind === 'tip') {
            const remainingTips = (current.examTips || []).filter((item) => String(item.id || '') !== itemId && item.articleId === articleId);
            const isInlineTip = itemId === `${article.id}-inline-macete`;
            const remainingTipBody = remainingTips[0]?.body || null;
            return {
              ...article,
              examTip: isInlineTip ? undefined : (remainingTipBody || undefined),
              macete: isInlineTip ? null : remainingTipBody,
            };
          }
          if (kind === 'sumula') {
            const nextSumulas = (article.sumulas || article.syllabi || []).filter((item) => String(item.id || '') !== itemId);
            return {
              ...article,
              sumulas: nextSumulas,
              syllabi: nextSumulas,
            };
          }
          if (kind === 'doctrine' && typeof index === 'number') {
            const nextDoctrine = (article.doctrine || article.doutrina || []).filter((_, itemIndex) => itemIndex !== index);
            return {
              ...article,
              doctrine: nextDoctrine,
              doutrina: nextDoctrine,
            };
          }
          if (kind === 'jurisprudenceNote' && typeof index === 'number') {
            return {
              ...article,
              jurisprudenceNotes: (article.jurisprudenceNotes || []).filter((_, itemIndex) => itemIndex !== index),
            };
          }
          return article;
        }),
      };

      draftRef.current = nextDraft;
      return nextDraft;
    });
    addToast('Conteudo removido do rascunho. Salve a lei para confirmar.', 'success');
  };
  const toggleStructureSection = (sectionId: string) => {
    setOpenStructureSectionIds((current) => {
      const next = new Set(current);
      if (next.has(sectionId)) {
        next.delete(sectionId);
      } else {
        next.add(sectionId);
      }
      return next;
    });
  };
  const confirmAndRemoveArticle = async (articleId: string) => {
    if (!articleId) return;
    const canRemove = await confirm({
      title: 'Excluir artigo?',
      description: 'Esta acao remove o artigo do rascunho atual.',
      confirmText: 'Excluir artigo',
      cancelText: 'Cancelar',
      type: 'danger',
    });
    if (canRemove) {
      removeArticle(articleId);
      addToast('Artigo removido do rascunho.', 'success');
    }
  };
  const confirmAndRemoveSectionAnalysis = async (section: AdminLawSectionOverview) => {
    if (!section?.resolvedSectionId) return;
    const canRemove = await confirm({
      title: 'Excluir analise do capitulo?',
      description: `A analise de "${section.title}" sera removida do rascunho atual. Salve a lei para confirmar a exclusao.`,
      confirmText: 'Excluir analise',
      cancelText: 'Cancelar',
      type: 'danger',
    });
    if (canRemove) {
      removeSectionEditorialFromDraft(section.resolvedSectionId);
      addToast('Analise do capitulo removida do rascunho. Salve a lei para confirmar.', 'success');
    }
  };
  const previewLaw = () => {
    if (!draft.slug) {
      showPreparationToast('Salve a lei com um slug antes de visualizar.');
      return;
    }
    window.open(`/lei-comentada/${draft.slug}`, '_blank', 'noopener,noreferrer');
  };
  const renderGeneratedArticleContent = () => {
    if (!activeArticle) return null;

    const dedupeByContent = <T extends { id?: string; title?: string; body?: string; text?: string; summary?: string }>(items: T[]): T[] => {
      const seen = new Set<string>();
      return items.filter((item) => {
        const key = [
          item.id || '',
          item.title || '',
          item.body || '',
          item.text || '',
          item.summary || '',
        ].join('|').trim();
        if (!key || seen.has(key)) return false;
        seen.add(key);
        return true;
      });
    };

    const draftTeacherComments = (draft.teacherComments || []).filter((item) => item.articleId === activeArticle.id);
    const draftExamTips = (draft.examTips || []).filter((item) => item.articleId === activeArticle.id);
    const draftJurisprudence = (draft.jurisprudence || []).filter((item) => item.articleId === activeArticle.id);
    const draftSumulas = (draft.sumulas || []).filter((item) => item.articleId === activeArticle.id);

    const teacherComments = dedupeByContent(draftTeacherComments.length > 0 ? draftTeacherComments : (activeArticle.comentarios || []));
    const examTips = dedupeByContent(draftExamTips.length > 0 ? draftExamTips : [
      ...(activeArticle.examTip || activeArticle.macete ? [{
        id: `${activeArticle.id}-inline-macete`,
        articleId: activeArticle.id,
        title: 'Macete',
        body: activeArticle.examTip || activeArticle.macete || '',
        tags: [],
      }] : []),
    ]);
    const jurisprudence = dedupeByContent(draftJurisprudence.length > 0 ? draftJurisprudence : (activeArticle.jurisprudencia || []));
    const sumulas = dedupeByContent(draftSumulas.length > 0 ? draftSumulas : (activeArticle.sumulas || activeArticle.syllabi || []));
    const dedupeTargetedTexts = (items: Array<string | LegalTargetedText>): Array<string | LegalTargetedText> => {
      const seen = new Set<string>();
      return items.filter((item) => {
        const body = getTargetedTextBody(item);
        const target = getTargetedTextTarget(item);
        const key = `${body}|${target?.blockId || ''}|${target?.label || ''}`;
        if (!body || seen.has(key)) return false;
        seen.add(key);
        return true;
      });
    };
    const doctrine = dedupeTargetedTexts([
      ...(activeArticle.doctrine || []),
      ...(activeArticle.doutrina || []),
    ]);
    const jurisprudenceNotes = dedupeTargetedTexts(activeArticle.jurisprudenceNotes || []);
    const totalGenerated = teacherComments.length + examTips.length + jurisprudence.length + sumulas.length + doctrine.length + jurisprudenceNotes.length;

    const renderTargetSelect = (
      value: string,
      onChange: (target?: LegalRichContentBlock['target']) => void,
    ) => (
      <SelectInput
        value={value}
        onChange={(event) => onChange(resolveArticleContentTarget(event.target.value))}
        className="h-9 text-xs"
      >
        <option value="">Sem vinculo especifico</option>
        {activeArticleTargetOptions.map((option) => (
          <option key={option.id} value={option.id}>
            {option.label}
          </option>
        ))}
      </SelectInput>
    );

    const resolveTargetValue = (target?: LegalRichContentBlock['target']) => {
      const blockId = String(target?.blockId || '').trim();
      if (blockId && activeArticleTargetOptions.some((option) => option.id === blockId)) {
        return blockId;
      }
      return '';
    };

    const contentCardClass = 'rounded-sm border border-slate-200 bg-white p-4 shadow-sm';
    const contentHeaderClass = 'text-[10px] font-black uppercase tracking-[0.18em]';
    const actionButtonClass = 'inline-flex h-8 items-center justify-center gap-1 rounded-sm border border-red-200 bg-white px-2.5 text-xs font-semibold text-red-600 hover:bg-red-50';

    return (
      <div className="rounded-sm border border-slate-200 bg-slate-50 p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className="text-sm font-semibold text-slate-900">Conteudos gerados para este artigo</p>
            <p className="mt-1 text-xs text-slate-500">Revise o material ja criado antes de gerar novos blocos.</p>
          </div>
          <span className="rounded-full bg-white px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-slate-600">
            {totalGenerated} item(ns)
          </span>
        </div>

        {totalGenerated > 0 ? (
          <div className="mt-4 space-y-3">
            {teacherComments.map((comment, index) => {
              const target = getTeacherCommentTarget(comment);
              const commentRichBlocks = (comment.richBlocks || comment.blocks || [])
                .map((block, blockIndex) => ({ block, blockIndex }))
                .filter(({ block }) => hasLegalRichBlockContent(block));
              return (
                <div key={comment.id || `${activeArticle.id}-teacher-${index}`} className={contentCardClass}>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className={`${contentHeaderClass} text-slate-500`}>Comentario do professor</span>
                    <button
                      type="button"
                      onClick={() => void removeGeneratedArticleContent('teacher', comment.id, 'Comentario do professor')}
                      className={actionButtonClass}
                    >
                      <Trash2 size={13} /> Remover
                    </button>
                  </div>
                  <div className="mt-3 grid gap-3">
                    <TextInput
                      value={comment.title || ''}
                      onChange={(event) => updateGeneratedArticleContent('teacher', comment.id, { title: event.target.value })}
                      placeholder="Titulo do comentario"
                    />
                    <TextArea
                      value={comment.body || comment.texto || ''}
                      onChange={(event) => updateGeneratedArticleContent('teacher', comment.id, { body: event.target.value })}
                      placeholder="Comentario do professor..."
                    />
                    <div>
                      <FieldLabel>Direcionar para</FieldLabel>
                      {renderTargetSelect(resolveTargetValue(target), (nextTarget) => updateGeneratedArticleContent('teacher', comment.id, { target: nextTarget }))}
                    </div>
                    {commentRichBlocks.length > 0 ? (
                      <div className="rounded-sm border border-indigo-100 bg-indigo-50/50 p-3">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div>
                            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-indigo-700">Notas direcionadas do comentario</p>
                            <p className="mt-1 text-xs text-indigo-900/70">Cada nota pode ficar vinculada ao caput, paragrafo, inciso, alinea ou item correto.</p>
                          </div>
                          <span className="rounded-full bg-white px-2 py-1 text-[10px] font-bold text-indigo-700">
                            {commentRichBlocks.length} nota(s)
                          </span>
                        </div>
                        <div className="mt-3 space-y-3">
                          {commentRichBlocks.map(({ block, blockIndex }) => (
                            <div key={`${comment.id || index}-rich-${blockIndex}`} className="rounded-sm border border-indigo-100 bg-white p-3 shadow-sm">
                              <div className="grid gap-2">
                                <TextInput
                                  value={block.title || ''}
                                  onChange={(event) => updateGeneratedArticleContent('teacher', comment.id, {
                                    richBlockIndex: blockIndex,
                                    richBlockTitle: event.target.value,
                                  })}
                                  placeholder="Titulo da nota"
                                />
                                <TextArea
                                  value={block.content || ''}
                                  onChange={(event) => updateGeneratedArticleContent('teacher', comment.id, {
                                    richBlockIndex: blockIndex,
                                    richBlockContent: event.target.value,
                                  })}
                                  placeholder="Conteudo da nota..."
                                />
                                <div>
                                  <FieldLabel>Direcionar esta nota para</FieldLabel>
                                  {renderTargetSelect(resolveTargetValue(block.target), (nextTarget) => updateGeneratedArticleContent('teacher', comment.id, {
                                    richBlockIndex: blockIndex,
                                    richBlockTarget: nextTarget,
                                  }))}
                                </div>
                                <div className="flex justify-end">
                                  <button
                                    type="button"
                                    onClick={() => updateGeneratedArticleContent('teacher', comment.id, {
                                      richBlockIndex: blockIndex,
                                      removeRichBlock: true,
                                    })}
                                    className="inline-flex h-8 items-center justify-center gap-1 rounded-sm border border-red-200 bg-white px-2.5 text-xs font-semibold text-red-600 hover:bg-red-50"
                                  >
                                    <Trash2 size={13} /> Remover nota
                                  </button>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : null}
                  </div>
                </div>
              );
            })}

            {examTips.map((tip, index) => (
              <div key={tip.id || `${activeArticle.id}-tip-${index}`} className={`${contentCardClass} border-amber-200 bg-amber-50/40`}>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className={`${contentHeaderClass} text-amber-700`}>Macete</span>
                  <button
                    type="button"
                    onClick={() => void removeGeneratedArticleContent('tip', tip.id, 'Macete')}
                    className={actionButtonClass}
                  >
                    <Trash2 size={13} /> Remover
                  </button>
                </div>
                <div className="mt-3 grid gap-3">
                  <TextInput
                    value={tip.title || ''}
                    onChange={(event) => updateGeneratedArticleContent('tip', tip.id, { title: event.target.value })}
                    placeholder="Titulo do macete"
                  />
                  <TextArea
                    value={tip.body || tip.texto || ''}
                    onChange={(event) => updateGeneratedArticleContent('tip', tip.id, { body: event.target.value })}
                    placeholder="Macete para prova..."
                  />
                  <div>
                    <FieldLabel>Direcionar para</FieldLabel>
                    {renderTargetSelect(resolveTargetValue(tip.target), (nextTarget) => updateGeneratedArticleContent('tip', tip.id, { target: nextTarget }))}
                  </div>
                </div>
              </div>
            ))}

            {sumulas.map((item, index) => (
              <div key={item.id || `${activeArticle.id}-sumula-${index}`} className={`${contentCardClass} border-blue-200 bg-blue-50/40`}>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className={`${contentHeaderClass} text-blue-700`}>Sumula</span>
                  <button
                    type="button"
                    onClick={() => void removeGeneratedArticleContent('sumula', item.id || '', 'Sumula')}
                    className={actionButtonClass}
                  >
                    <Trash2 size={13} /> Remover
                  </button>
                </div>
                <div className="mt-3 grid gap-3 sm:grid-cols-[minmax(0,160px)_minmax(0,1fr)]">
                  <TextInput
                    value={item.court || item.tribunal || ''}
                    onChange={(event) => updateGeneratedArticleContent('sumula', item.id || '', { court: event.target.value })}
                    placeholder="Tribunal"
                  />
                  <TextInput
                    value={item.number || item.numero || ''}
                    onChange={(event) => updateGeneratedArticleContent('sumula', item.id || '', { number: event.target.value })}
                    placeholder="Numero"
                  />
                  <TextArea
                    value={item.text || item.texto || ''}
                    onChange={(event) => updateGeneratedArticleContent('sumula', item.id || '', { text: event.target.value })}
                    placeholder="Texto da sumula..."
                    className="sm:col-span-2"
                  />
                  <div className="sm:col-span-2">
                    <FieldLabel>Direcionar para</FieldLabel>
                    {renderTargetSelect(resolveTargetValue(item.target), (nextTarget) => updateGeneratedArticleContent('sumula', item.id || '', { target: nextTarget }))}
                  </div>
                </div>
              </div>
            ))}

            {jurisprudence.map((item, index) => (
              <div key={item.id || `${activeArticle.id}-juris-${index}`} className={`${contentCardClass} border-emerald-200 bg-emerald-50/40`}>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className={`${contentHeaderClass} text-emerald-700`}>Jurisprudencia</span>
                  <button
                    type="button"
                    onClick={() => void removeGeneratedArticleContent('jurisprudence', item.id, 'Jurisprudencia')}
                    className={actionButtonClass}
                  >
                    <Trash2 size={13} /> Remover
                  </button>
                </div>
                <div className="mt-3 grid gap-3 sm:grid-cols-[minmax(0,160px)_minmax(0,1fr)]">
                  <TextInput
                    value={item.court || item.tribunal || ''}
                    onChange={(event) => updateGeneratedArticleContent('jurisprudence', item.id, { court: event.target.value })}
                    placeholder="Tribunal"
                  />
                  <TextInput
                    value={item.title || ''}
                    onChange={(event) => updateGeneratedArticleContent('jurisprudence', item.id, { title: event.target.value })}
                    placeholder="Titulo da jurisprudencia"
                  />
                  <TextArea
                    value={item.summary || item.texto || item.examImpact || ''}
                    onChange={(event) => updateGeneratedArticleContent('jurisprudence', item.id, { summary: event.target.value })}
                    placeholder="Resumo e impacto em prova..."
                    className="sm:col-span-2"
                  />
                  <div className="sm:col-span-2">
                    <FieldLabel>Direcionar para</FieldLabel>
                    {renderTargetSelect(resolveTargetValue(item.target), (nextTarget) => updateGeneratedArticleContent('jurisprudence', item.id, { target: nextTarget }))}
                  </div>
                </div>
              </div>
            ))}

            {jurisprudenceNotes.map((note, index) => (
              <div key={`${activeArticle.id}-juris-note-${index}`} className={`${contentCardClass} border-emerald-200 bg-emerald-50/40`}>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className={`${contentHeaderClass} text-emerald-700`}>Nota de jurisprudencia</span>
                  <button
                    type="button"
                    onClick={() => void removeGeneratedArticleContent('jurisprudenceNote', `${activeArticle.id}-juris-note-${index}`, 'Nota de jurisprudencia', index)}
                    className={actionButtonClass}
                  >
                    <Trash2 size={13} /> Remover
                  </button>
                </div>
                <TextArea
                  value={getTargetedTextBody(note)}
                  onChange={(event) => updateGeneratedArticleContent('jurisprudenceNote', `${activeArticle.id}-juris-note-${index}`, { body: event.target.value }, index)}
                  placeholder="Nota de jurisprudencia..."
                  className="mt-3"
                />
                <div className="mt-3">
                  <FieldLabel>Direcionar para</FieldLabel>
                  {renderTargetSelect(resolveTargetValue(getTargetedTextTarget(note)), (nextTarget) => updateGeneratedArticleContent('jurisprudenceNote', `${activeArticle.id}-juris-note-${index}`, { target: nextTarget }, index))}
                </div>
              </div>
            ))}

            {doctrine.map((item, index) => (
              <div key={`${activeArticle.id}-doctrine-${index}`} className={`${contentCardClass} border-violet-200 bg-violet-50/40`}>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className={`${contentHeaderClass} text-violet-700`}>Doutrina</span>
                  <button
                    type="button"
                    onClick={() => void removeGeneratedArticleContent('doctrine', `${activeArticle.id}-doctrine-${index}`, 'Doutrina', index)}
                    className={actionButtonClass}
                  >
                    <Trash2 size={13} /> Remover
                  </button>
                </div>
                <TextArea
                  value={getTargetedTextBody(item)}
                  onChange={(event) => updateGeneratedArticleContent('doctrine', `${activeArticle.id}-doctrine-${index}`, { body: event.target.value }, index)}
                  placeholder="Doutrina relevante..."
                  className="mt-3"
                />
                <div className="mt-3">
                  <FieldLabel>Direcionar para</FieldLabel>
                  {renderTargetSelect(resolveTargetValue(getTargetedTextTarget(item)), (nextTarget) => updateGeneratedArticleContent('doctrine', `${activeArticle.id}-doctrine-${index}`, { target: nextTarget }, index))}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="mt-4 rounded-sm border border-dashed border-slate-300 bg-white p-4 text-sm leading-6 text-slate-600">
            Nenhum conteudo juridico foi gerado para este artigo ainda.
          </div>
        )}
      </div>
    );
  };
  const renderArticlePreviewPanel = () => (
    <div className="space-y-5">
      {activeArticle ? (
        <section className="space-y-5 rounded-sm border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-xl font-semibold text-slate-900">{getArticleLabel(activeArticle)}</h3>
                <span className={`rounded-full px-2 py-1 text-[10px] font-bold ${
                  activeArticleHasSubject ? 'bg-violet-50 text-violet-700' : 'bg-amber-50 text-amber-700'
                }`}>
                  {activeArticleHasSubject ? 'Assunto definido' : 'Sem assunto'}
                </span>
              </div>
              <p className="mt-1 text-xs text-slate-500">{activeArticle.title || activeSectionOverview?.chapterName || 'Artigo sem titulo interno'}</p>
            </div>
            <button
              type="button"
              onClick={() => setIsEditingOriginalText((current) => !current)}
              className="inline-flex h-8 items-center gap-2 rounded-sm border border-slate-300 bg-white px-3 text-xs font-medium text-slate-700 hover:bg-slate-50"
            >
              <FileText size={13} /> Editar Texto Original
            </button>
          </div>

          {isEditingOriginalText ? (
            <TextArea
              value={String(activeArticle.text || '')}
              onChange={(event) => updateArticleField('text', event.target.value)}
              placeholder="Texto original do artigo..."
            />
          ) : (
            <div className="whitespace-pre-wrap rounded-sm border border-slate-200 bg-white px-3 py-3 text-sm leading-6 text-slate-700">
              {activeArticleTextPreview}
            </div>
          )}

          <div className="rounded-sm border border-slate-200 bg-slate-50 p-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Filtros herdados do artigo
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              {activeArticleFilterSummary.map((item) => (
                <span key={item.label} className="rounded-full border border-slate-200 bg-white px-2 py-1 text-xs font-medium text-slate-700">
                  <strong>{item.label}:</strong> {item.value}
                </span>
              ))}
              {activeArticleFilterSummary.length === 0 ? (
                <span className="text-xs font-medium text-slate-500">Defina a materia, o topico e o capitulo para classificar este artigo.</span>
              ) : null}
            </div>
          </div>

          {renderGeneratedArticleContent()}

          <div className="rounded-sm border border-slate-200 bg-slate-50 p-4">
            <p className="mb-3 text-sm font-semibold text-slate-900">Enriquecer este artigo com IA e conteudos juridicos</p>
            <div className="grid gap-4 lg:grid-cols-2 2xl:grid-cols-3">
              {ARTICLE_AI_GENERATION_CARDS.map((card) => {
                const Icon = card.icon;
                const isTeacherCommentCard = card.key === 'teacher-comment';
                const hasSelectedTeacherTarget = Boolean(selectedTeacherCommentTarget);
                return (
                  <div
                    key={card.key}
                    className={`flex min-h-[156px] flex-col rounded-sm border border-slate-200 bg-white p-4 ${
                      isTeacherCommentCard ? 'lg:col-span-2' : ''
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-sm bg-[#f0f6fc] text-[#2271b1]">
                        <Icon size={18} />
                      </span>
                      <div className="min-w-0">
                        <h4 className="text-sm font-semibold leading-5 text-slate-900">{card.title}</h4>
                        <p className="mt-1 text-xs leading-5 text-slate-500">{card.text}</p>
                      </div>
                    </div>
                    {isTeacherCommentCard ? (
                      <div className="mt-4 space-y-2 rounded-sm border border-slate-200 bg-slate-50 p-2">
                        <label className="block text-[10px] font-bold uppercase tracking-wide text-slate-500">
                          Comentario direcionado
                        </label>
                        <SelectInput
                          value={activeArticleTargetOptions.some((option) => option.id === selectedTeacherCommentTargetId) ? selectedTeacherCommentTargetId : ''}
                          onChange={(event) => setSelectedTeacherCommentTargetId(event.target.value)}
                        >
                          <option value="">Escolha caput, paragrafo, inciso...</option>
                          {activeArticleTargetOptions.map((option) => (
                            <option key={option.id} value={option.id}>
                              {option.label}{option.preview ? ` - ${option.preview}` : ''}
                            </option>
                          ))}
                        </SelectInput>
                        <button
                          type="button"
                          onClick={() => {
                            if (!selectedTeacherCommentTarget) {
                              addToast('Selecione o caput, paragrafo, inciso ou alinea para gerar um comentario direcionado.', 'info');
                              return;
                            }
                            void generateWithAi('teacher-comment', {
                              target: selectedTeacherCommentTarget,
                              loadingKey: 'teacher-comment-target',
                              label: 'Comentario direcionado',
                            });
                          }}
                          disabled={Boolean(aiLoading) || !hasSelectedTeacherTarget}
                          className="inline-flex h-8 w-full items-center justify-center gap-2 rounded-sm border border-slate-300 bg-white px-3 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60"
                        >
                          {aiLoading === 'teacher-comment-target' ? <Loader2 className="animate-spin" size={13} /> : null}
                          Gerar direcionado
                        </button>
                      </div>
                    ) : null}
                    <button
                      type="button"
                      onClick={() => void generateWithAi(card.key)}
                      disabled={Boolean(aiLoading)}
                      className="mt-auto inline-flex h-8 w-full items-center justify-center gap-2 rounded-sm border border-[#2271b1] bg-white px-3 text-xs font-semibold text-[#2271b1] hover:bg-[#f0f6fc] disabled:opacity-60"
                    >
                      {aiLoading === card.key ? <Loader2 className="animate-spin" size={13} /> : null}
                      Gerar
                    </button>
                  </div>
                );
              })}
            </div>
          </div>

          <details className="rounded-sm border border-slate-200 bg-white" open>
            <summary className="flex cursor-pointer items-center justify-between px-3 py-3 text-sm font-semibold text-slate-900">
              Incisos, Alineas, Paragrafos e Outros
              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] text-slate-500">{activeArticleBlocks.length} itens</span>
            </summary>
            <div className="space-y-2 border-t border-slate-200 p-3">
              {activeArticleBlocks.map((block) => (
                <div key={block.id} className="grid gap-2 rounded-sm border border-slate-200 bg-slate-50 p-2 md:grid-cols-[130px_160px_minmax(0,1fr)_auto]">
                  <SelectInput value={block.kind} onChange={(event) => updateArticleBlock(block.id, { kind: event.target.value as LegalArticleBlock['kind'] })}>
                    {LEGAL_BLOCK_KINDS.map((kind) => <option key={kind.value} value={kind.value}>{kind.label}</option>)}
                  </SelectInput>
                  <TextInput value={block.label || ''} onChange={(event) => updateArticleBlock(block.id, { label: event.target.value })} placeholder="Marcador" />
                  <TextInput value={block.text || ''} onChange={(event) => updateArticleBlock(block.id, { text: event.target.value })} placeholder="Texto do bloco" />
                  <button type="button" onClick={() => removeArticleBlock(block.id)} className="rounded-sm border border-red-200 bg-white px-3 text-xs font-semibold text-red-600 hover:bg-red-50">
                    Excluir
                  </button>
                </div>
              ))}
              <div className="flex flex-col gap-2 border-t border-slate-200 pt-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex flex-wrap gap-2">
                  <button type="button" onClick={() => addArticleBlock('inciso')} className="inline-flex h-8 items-center gap-1 rounded-sm border border-slate-300 bg-white px-3 text-xs font-medium text-slate-700 hover:bg-slate-50">
                    <Plus size={13} /> Inciso
                  </button>
                  <button type="button" onClick={() => addArticleBlock('alinea')} className="inline-flex h-8 items-center gap-1 rounded-sm border border-slate-300 bg-white px-3 text-xs font-medium text-slate-700 hover:bg-slate-50">
                    <Plus size={13} /> Alinea
                  </button>
                  <button type="button" onClick={() => addArticleBlock('paragraph')} className="inline-flex h-8 items-center gap-1 rounded-sm border border-slate-300 bg-white px-3 text-xs font-medium text-slate-700 hover:bg-slate-50">
                    <Plus size={13} /> Paragrafo
                  </button>
                </div>
                <button type="button" onClick={() => confirmAndRemoveArticle(activeArticle.id)} className="inline-flex h-8 items-center justify-center gap-1 rounded-sm border border-red-300 bg-white px-3 text-xs font-medium text-red-600 hover:bg-red-50">
                  <Trash2 size={13} /> Excluir
                </button>
              </div>
            </div>
          </details>
        </section>
      ) : (
        <div className="flex min-h-[220px] flex-col items-center justify-center rounded-sm border border-dashed border-slate-300 bg-slate-50 p-8 text-center">
          <FileText className="mb-3 text-slate-300" size={36} />
          <p className="text-sm font-semibold text-slate-900">Selecione ou adicione um artigo.</p>
          <button type="button" onClick={addArticle} className="mt-4 inline-flex h-9 items-center gap-2 rounded-sm bg-[#2271b1] px-4 text-sm font-semibold text-white hover:bg-[#135e96]">
            <Plus size={14} /> Adicionar Artigo
          </button>
        </div>
      )}
    </div>
  );

  const renderSectionRichBlocksPreview = (
    blocks?: LawSectionEditorial['blocks'],
    options?: { editable?: boolean; sectionId?: string },
  ) => {
    const visibleBlocks = (blocks || [])
      .map((block, originalIndex) => ({ block, originalIndex }))
      .filter(({ block }) => (
        String(block.content || '').trim()
        || (Array.isArray(block.items) && block.items.length > 0)
        || (Array.isArray(block.rows) && block.rows.length > 0)
      ));

    if (visibleBlocks.length === 0) {
      return null;
    }

    return (
      <div className="space-y-3">
        {visibleBlocks.slice(0, 8).map(({ block, originalIndex }, index) => {
          const title = String(block.title || '').trim();
          const content = String(block.content || '').trim();
          const items = (block.items || []).map((item) => String(item || '').trim()).filter(Boolean);
          const headers = (block.headers || []).map((item) => String(item || '').trim()).filter(Boolean);
          const rows = (block.rows || []).filter((row) => Array.isArray(row) && row.some((cell) => String(cell || '').trim()));

          if (block.type === 'table' && rows.length > 0) {
            return (
              <div key={`${block.type}-${title}-${index}`} className="overflow-hidden rounded-sm border border-slate-200 bg-white">
                {title ? <p className="border-b border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-slate-500">{title}</p> : null}
                <div className="overflow-x-auto">
                  <table className="min-w-full border-collapse text-left text-xs">
                    {headers.length > 0 ? (
                      <thead className="bg-slate-50 text-slate-600">
                        <tr>
                          {headers.map((header, headerIndex) => (
                            <th key={`${header}-${headerIndex}`} className="border-b border-slate-200 px-3 py-2 font-semibold">
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
                            <td key={`cell-${cellIndex}`} className="border-b border-slate-100 px-3 py-2 align-top text-slate-700">
                              {options?.editable && options.sectionId ? (
                                <textarea
                                  value={String(cell || '')}
                                  onChange={(event) => {
                                    const nextRows = rows.map((rowValue, nextRowIndex) => (
                                      nextRowIndex === rowIndex
                                        ? rowValue.map((cellValue, nextCellIndex) => (
                                          nextCellIndex === cellIndex ? event.target.value : cellValue
                                        ))
                                        : rowValue
                                    ));
                                    updateSectionEditorialBlockInDraft(options.sectionId || '', originalIndex, (currentBlock) => ({
                                      ...currentBlock,
                                      rows: nextRows,
                                    }));
                                  }}
                                  className="min-h-[72px] w-full resize-y rounded-sm border border-slate-200 px-2 py-1 text-xs leading-5 text-slate-700 outline-none focus:border-[#2271b1] focus:ring-1 focus:ring-[#2271b1]"
                                />
                              ) : (
                                <MathRichText content={String(cell || '')} className="text-xs leading-5 text-slate-700" />
                              )}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            );
          }

          return (
            <div key={`${block.type}-${title}-${index}`} className="rounded-sm border border-slate-200 bg-white p-3">
              {title ? <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{title}</p> : null}
              {content || options?.editable ? (
                options?.editable && options.sectionId ? (
                  <div className="mt-2">
                    <RichTextEditor
                      initialValue={content}
                      onChange={(html) => updateSectionEditorialBlockInDraft(options.sectionId || '', originalIndex, (currentBlock) => ({
                        ...currentBlock,
                        content: html,
                      }))}
                      placeholder="Edite o texto com negrito, sublinhado, cores e destaques."
                    />
                  </div>
                ) : (
                  <MathRichText content={content} className="mt-2 text-sm leading-6 text-slate-700" />
                )
              ) : null}
              {items.length > 0 ? (
                options?.editable && options.sectionId ? (
                  <div className="mt-3 space-y-2">
                    {items.map((item, itemIndex) => (
                      <RichTextEditor
                        key={`${item}-${itemIndex}`}
                        initialValue={item}
                        onChange={(html) => updateSectionEditorialBlockInDraft(options.sectionId || '', originalIndex, (currentBlock) => ({
                          ...currentBlock,
                          items: (currentBlock.items || []).map((currentItem, currentItemIndex) => (
                            currentItemIndex === itemIndex ? html : currentItem
                          )),
                        }))}
                        placeholder="Item da análise"
                      />
                    ))}
                  </div>
                ) : (
                  <ul className="mt-2 list-disc space-y-1 pl-5 text-sm leading-6 text-slate-700">
                    {items.map((item, itemIndex) => (
                      <li key={`${item}-${itemIndex}`}>
                        <MathRichText content={item} className="text-sm leading-6 text-slate-700" />
                      </li>
                    ))}
                  </ul>
                )
              ) : null}
            </div>
          );
        })}
        {visibleBlocks.length > 8 ? (
          <p className="text-xs font-medium text-slate-500">Mais {visibleBlocks.length - 8} bloco(s) serao exibidos na pagina do aluno.</p>
        ) : null}
      </div>
    );
  };

  const renderSectionAnalysisPanel = (section: AdminLawSectionOverview) => {
    const sectionAnalysis = section.savedEditorial || null;
    const isSectionAnalysisLoading = sectionAnalysisLoadingKey === section.resolvedSectionId;
    const isEditingSectionAnalysis = editingSectionAnalysisId === section.resolvedSectionId;
    const rangeLabel = formatSectionRange(section);
    const sectionAnalysisContent = buildSingleSectionAnalysisHtml(sectionAnalysis);
    const showLegacySectionDetails = false;
    const sectionTokens = [...(sectionAnalysis?.macetes || []), ...(sectionAnalysis?.keywords || [])];

    return (
      <section className="rounded-sm border border-slate-200 bg-white">
        <div className="flex flex-col gap-3 border-b border-slate-200 bg-[#f8fbff] px-3 py-3 md:flex-row md:items-start md:justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-sm font-semibold text-slate-900">Analise detalhada do capitulo</h3>
              <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${
                sectionAnalysis ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'
              }`}>
                {sectionAnalysis ? 'Pronta' : 'Pendente'}
              </span>
            </div>
            <p className="mt-1 text-sm font-medium text-slate-700">{section.title}</p>
            <p className="mt-1 text-xs text-slate-500">
              {rangeLabel} - {section.articlesList.length} artigo(s)
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {sectionAnalysis ? (
              <button
                type="button"
                onClick={() => setEditingSectionAnalysisId((current) => (
                  current === section.resolvedSectionId ? null : section.resolvedSectionId
                ))}
                className="inline-flex h-8 shrink-0 items-center justify-center rounded-sm border border-slate-300 bg-white px-3 text-xs font-semibold text-slate-700 hover:bg-slate-50"
              >
                {isEditingSectionAnalysis ? 'Concluir edicao' : 'Editar texto'}
              </button>
            ) : null}
            {sectionAnalysis ? (
              <button
                type="button"
                onClick={() => void confirmAndRemoveSectionAnalysis(section)}
                disabled={isSectionAnalysisLoading || isGeneratingAllSectionAnalyses}
                className="inline-flex h-8 shrink-0 items-center justify-center gap-2 rounded-sm border border-rose-300 bg-white px-3 text-xs font-semibold text-rose-700 hover:bg-rose-50 disabled:opacity-60"
              >
                <Trash2 size={13} />
                Excluir
              </button>
            ) : null}
            <button
              type="button"
              onClick={() => void generateSectionAnalysis(section)}
              disabled={isSectionAnalysisLoading || isGeneratingAllSectionAnalyses}
              className="inline-flex h-8 shrink-0 items-center justify-center gap-2 rounded-sm border border-[#2271b1] bg-white px-3 text-xs font-semibold text-[#2271b1] hover:bg-[#f0f6fc] disabled:opacity-60"
            >
              {isSectionAnalysisLoading ? <Loader2 className="animate-spin" size={13} /> : <Sparkles size={13} />}
              {sectionAnalysis ? 'Regerar analise' : 'Gerar analise'}
            </button>
          </div>
        </div>
        <div className="space-y-3 p-3">
          {sectionAnalysis ? (
            <>
              <div className="rounded-sm border border-slate-200 bg-white p-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Analise detalhada da secao</p>
                <p className="mt-1 text-xs text-slate-500">
                  Conteudo unico exibido ao aluno. Use subtitulos, tabelas, listas e destaques dentro deste editor.
                </p>
                {isEditingSectionAnalysis ? (
                  <div className="mt-2">
                    <RichTextEditor
                      initialValue={sectionAnalysisContent}
                      onChange={(html) => updateSectionEditorialInDraft(section.resolvedSectionId, (editorial) => ({
                        ...editorial,
                        summary: html,
                        blocks: buildSingleSectionAnalysisBlocks(html),
                      }))}
                      placeholder="Escreva uma analise completa e continua da secao."
                    />
                  </div>
                ) : (
                  <MathRichText content={sectionAnalysisContent} className="mt-2 text-sm leading-6 text-slate-700" />
                )}
              </div>
              {showLegacySectionDetails ? renderSectionRichBlocksPreview(sectionAnalysis.blocks, {
                editable: isEditingSectionAnalysis,
                sectionId: section.resolvedSectionId,
              }) : null}
              {showLegacySectionDetails ? (
              <div className="grid gap-3 md:grid-cols-2">
                <div className="rounded-sm border border-slate-200 bg-white p-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Como cai em prova</p>
                  {isEditingSectionAnalysis ? (
                    <div className="mt-2 space-y-2">
                      {(sectionAnalysis.examFocus || []).slice(0, 3).map((item, itemIndex) => (
                        <RichTextEditor
                          key={`${item}-${itemIndex}`}
                          initialValue={item}
                          onChange={(html) => updateSectionEditorialInDraft(section.resolvedSectionId, (editorial) => ({
                            ...editorial,
                            examFocus: (editorial.examFocus || []).map((currentItem, currentIndex) => (
                              currentIndex === itemIndex ? html : currentItem
                            )),
                          }))}
                          placeholder="Como isso cai em prova"
                        />
                      ))}
                      {(sectionAnalysis.examFocus || []).length === 0 ? <p className="text-sm text-slate-500">Nenhum foco registrado.</p> : null}
                    </div>
                  ) : (
                    <ul className="mt-2 space-y-1 text-sm leading-5 text-slate-700">
                      {(sectionAnalysis.examFocus || []).slice(0, 3).map((item) => (
                        <li key={item}>
                          <MathRichText content={item} className="text-sm leading-5 text-slate-700" />
                        </li>
                      ))}
                      {(sectionAnalysis.examFocus || []).length === 0 ? <li>Nenhum foco registrado.</li> : null}
                    </ul>
                  )}
                </div>
                <div className="rounded-sm border border-slate-200 bg-white p-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Macetes e palavras-chave</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {sectionTokens.slice(0, 6).map((item) => (
                      <span key={item} className="rounded-full bg-violet-50 px-2 py-1 text-xs font-medium text-violet-700">{item}</span>
                    ))}
                    {sectionTokens.length === 0 ? (
                      <span className="text-sm text-slate-500">Nenhum item registrado.</span>
                    ) : null}
                  </div>
                </div>
              </div>
              ) : null}
            </>
          ) : (
            <div className="rounded-sm border border-dashed border-slate-300 bg-white p-4 text-sm leading-6 text-slate-600">
              Este capitulo ainda nao possui analise propria. Gere uma analise aqui para orientar o aluno pelo conjunto de artigos, com pegadinhas, pontos de prova e conexoes relevantes.
            </div>
          )}
        </div>
      </section>
    );
  };
  const renderLawExplorer = () => (
    <>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-slate-900">{selectedLawNumber}</p>
          <p className="mt-1 truncate text-xs text-slate-500">{selectedLawTitle}</p>
        </div>
        <span className="rounded-full bg-emerald-50 px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-emerald-700">
          {draft.articles?.length || 0} artigos
        </span>
      </div>

      <div className="mt-4 max-h-[520px] space-y-2 overflow-y-auto pr-1">
        {sectionOverviews.map((section) => {
          const resolvedSectionId = section.resolvedSectionId;
          const isActiveSection = activeSectionOverview?.resolvedSectionId === resolvedSectionId;
          const isOpen = openStructureSectionIds.has(resolvedSectionId);
          const sectionParentLabel = section.titleName || section.titleLabel || 'Estrutura da lei';
          const sectionSubtopicOptions = getSectionSubtopicOptions(section);
          const sectionAssuntoOptions = getSectionAssuntoOptions(section);
          return (
            <div
              key={section.id}
              className={`rounded-sm border bg-white transition-colors ${
                isActiveSection ? 'border-[#72aee6] shadow-sm' : 'border-slate-200 hover:border-slate-300'
              }`}
            >
              <button
                type="button"
                onClick={() => {
                  selectSection(section);
                  toggleStructureSection(resolvedSectionId);
                }}
                className="flex w-full items-center gap-2 px-3 py-2.5 text-left"
              >
                {isOpen ? <ChevronDown size={15} className="text-slate-500" /> : <ChevronRight size={15} className="text-slate-500" />}
                <GripVertical size={14} className="text-slate-300" />
                <span className="min-w-0 flex-1">
                  <span className="block text-[10px] font-semibold uppercase tracking-wide text-slate-500">{sectionParentLabel}</span>
                  <span className="block truncate text-sm font-semibold text-slate-900">{section.title}</span>
                </span>
                <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-600">
                  {section.articlesList.length}
                </span>
              </button>
              {isOpen ? (
                <div className="space-y-1 border-t border-slate-200 bg-slate-50 p-2">
                  <div className="rounded-sm border border-slate-200 bg-white p-3">
                    <div className="grid gap-3 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)_minmax(0,1fr)]">
                      <div>
                        <FieldLabel>Nome exibido do capitulo</FieldLabel>
                        <TextInput
                          value={section.displayTitle || section.title || ''}
                          onChange={(event) => updateSectionField(section.id, {
                            title: event.target.value,
                            displayTitle: event.target.value,
                          })}
                          placeholder="CAPITULO I - Das Disposicoes Gerais"
                        />
                      </div>
                      <CreatableTaxonomySelect
                        label="Subtopico (Titulo)"
                        options={sectionSubtopicOptions}
                        value={section.subtopicFilterId || ''}
                        selectedLabelOverride={String(section.titleName || '').trim() || undefined}
                        placeholder={draft.lawTopicFilterId ? 'Selecione o subtopico' : 'Selecione o topico da lei'}
                        createLabel="Criar subtopico"
                        disabled={!draft.lawTopicFilterId}
                        loading={isCreatingSubtopic}
                        helper="Subtopico herdado do titulo que abrange este capitulo."
                        onChange={(value, option) => updateSectionField(section.id, {
                          subtopicFilterId: value || null,
                          titleName: value ? String(option?.name || '') : '',
                          assuntoFilterId: null,
                          chapterName: '',
                        })}
                        onCreate={(name) => createSectionSubtopic(section.id, name)}
                      />
                      <CreatableTaxonomySelect
                        label="Assunto (Capitulo)"
                        options={sectionAssuntoOptions}
                        value={section.assuntoFilterId || ''}
                        selectedLabelOverride={String(section.chapterName || '').trim() || undefined}
                        placeholder="Selecione o assunto"
                        createLabel="Criar assunto"
                        disabled={!draft.lawTopicFilterId}
                        loading={isCreatingAssunto}
                        helper="Assunto/capitulo herdado pelos artigos deste bloco."
                        onChange={(value, option) => updateSectionField(section.id, {
                          assuntoFilterId: value || null,
                          chapterName: value ? String(option?.name || '') : '',
                        })}
                        onCreate={(name) => createSectionAssunto(section.id, name)}
                      />
                    </div>
                  </div>
                  <div className="mb-2">
                    {renderSectionAnalysisPanel(section)}
                  </div>
                  {section.articlesList.map((article) => {
                    const hasSubject = Boolean(section.assuntoFilterId);
                    const isActiveArticle = article.id === activeArticle?.id;
                    return (
                      <React.Fragment key={article.id}>
                        <button
                          type="button"
                          onClick={() => selectArticleFromSection(article)}
                          className={`flex w-full items-center gap-2 rounded-sm border px-3 py-2 text-left ${
                            isActiveArticle
                              ? 'border-[#72aee6] bg-white shadow-sm'
                              : 'border-transparent hover:border-slate-200 hover:bg-white'
                          }`}
                        >
                          <FileText size={14} className={isActiveArticle ? 'text-[#2271b1]' : 'text-slate-400'} />
                          <span className="min-w-0 flex-1 truncate text-sm font-medium text-slate-800">{getArticleLabel(article)}</span>
                          <span className={`hidden rounded-full px-2 py-0.5 text-[10px] font-bold sm:inline-flex ${
                            hasSubject ? 'bg-violet-50 text-violet-700' : 'bg-amber-50 text-amber-700'
                          }`}>
                            {hasSubject ? 'Assunto definido' : 'Sem assunto'}
                          </span>
                        </button>
                        {isActiveArticle ? (
                          <div className="rounded-sm border border-[#72aee6] bg-white shadow-sm">
                            <div className="flex flex-col gap-2 border-b border-slate-200 bg-[#f8fbff] px-3 py-2 sm:flex-row sm:items-center sm:justify-between">
                              <div>
                                <p className="text-sm font-semibold text-slate-900">Preview do artigo</p>
                                <p className="text-xs text-slate-500">Aberto logo abaixo do item selecionado.</p>
                              </div>
                              <div className="flex flex-wrap items-center gap-2">
                                <select
                                  value={article.sectionId || section.id}
                                  onChange={(event) => moveArticleToSection(article.id, event.target.value)}
                                  className="h-8 rounded-sm border border-slate-300 bg-white px-2 text-xs text-slate-700"
                                  title="Mover artigo para outro capitulo"
                                >
                                  {sectionOverviews.map((option) => (
                                    <option key={option.id} value={option.id}>{option.title}</option>
                                  ))}
                                </select>
                                <button
                                  type="button"
                                  onClick={() => setIsStructurePreviewOpen((current) => !current)}
                                  className="inline-flex h-8 items-center justify-center gap-2 rounded-sm border border-slate-300 bg-white px-3 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                                >
                                  {isStructurePreviewOpen ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
                                  {isStructurePreviewOpen ? 'Ocultar preview' : 'Exibir preview'}
                                </button>
                              </div>
                            </div>
                            {isStructurePreviewOpen ? (
                              <div className="p-3">
                                {renderArticlePreviewPanel()}
                              </div>
                            ) : null}
                          </div>
                        ) : null}
                      </React.Fragment>
                    );
                  })}
                </div>
              ) : null}
            </div>
          );
        })}
        {sectionOverviews.length === 0 ? (
          <div className="rounded-sm border border-dashed border-slate-300 bg-slate-50 p-4 text-sm text-slate-500">
            Nenhum capitulo detectado ainda. Importe uma lei ou adicione artigos manualmente.
          </div>
        ) : null}
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <button type="button" onClick={addSection} className="inline-flex h-8 items-center gap-1 rounded-sm border border-slate-300 bg-white px-3 text-xs font-medium text-slate-700 hover:bg-slate-50">
          <Plus size={13} /> Capitulo
        </button>
        <button type="button" onClick={addArticle} className="inline-flex h-8 items-center gap-1 rounded-sm border border-slate-300 bg-white px-3 text-xs font-medium text-slate-700 hover:bg-slate-50">
          <Plus size={13} /> Artigo
        </button>
      </div>
      <p className="mt-2 text-xs text-slate-500">Explorer da lei. Reordenacao visual preparada para a proxima etapa.</p>
    </>
  );

  return renderAdminShell(
      <div className="space-y-5">
        <div className="space-y-4 text-slate-900">
          <header className="flex flex-col gap-2 border-b border-slate-300 pb-3 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <div className="flex flex-wrap items-center gap-3">
                <h1 className="text-2xl font-normal leading-tight text-slate-900">
                  {isNew ? 'Adicionar Nova Lei' : 'Editar Lei Comentada'}
                </h1>
                <button
                  type="button"
                  onClick={() => showPreparationToast('Guia de uso em preparacao.')}
                  className="inline-flex h-8 items-center rounded-sm border border-[#2271b1] bg-white px-3 text-xs font-medium text-[#2271b1] hover:bg-[#f0f6fc]"
                >
                  Ver guia de uso
                </button>
              </div>
              <p className="mt-1 text-sm text-slate-600">
                Importe uma lei do Planalto, organize pela taxonomia da plataforma e enriqueça com IA.
              </p>
            </div>
            <Link href="/admin/operation/lei-comentada" className="text-sm font-medium text-[#2271b1] hover:underline">
              Ver leis
            </Link>
          </header>

          <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_320px]">
            <main className="space-y-4">
              <section className="rounded-sm border border-slate-300 bg-white shadow-sm">
                <div className="border-b border-slate-200 px-4 py-3">
                  <h2 className="text-base font-semibold text-slate-900">1. Importar Lei do Planalto</h2>
                </div>
                <div className="grid gap-3 p-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
                  <div>
                    <FieldLabel>URL da Lei (Planalto)</FieldLabel>
                    <TextInput
                      value={draft.officialUrl || ''}
                      onChange={(event) => updateLawField('officialUrl', event.target.value)}
                      placeholder="Cole a URL da lei no Planalto"
                    />
                    <p className="mt-1 text-xs text-slate-500">
                      Ex.: https://www.planalto.gov.br/ccivil_03/leis/l2848compilado.htm
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => void importFromPlanalto()}
                    disabled={isImportingFromPlanalto}
                    className="inline-flex h-10 items-center justify-center gap-2 rounded-sm bg-[#2271b1] px-5 text-sm font-semibold text-white hover:bg-[#135e96] disabled:opacity-60"
                  >
                    {isImportingFromPlanalto ? <Loader2 className="animate-spin" size={16} /> : <Download size={16} />}
                    Importar Lei
                  </button>
                </div>
              </section>

              <section className="rounded-sm border border-slate-300 bg-white shadow-sm">
                <div className="border-b border-slate-200 px-4 py-3">
                  <h2 className="text-base font-semibold text-slate-900">2. Classificacao da Lei (Taxonomia da Plataforma)</h2>
                  <p className="mt-1 text-xs text-slate-600">
                    A lei sera organizada pelas mesmas categorias usadas nas questoes, permitindo integracao com os mesmos filtros.
                  </p>
                </div>
                <div className="grid gap-4 p-4 md:grid-cols-2">
                  <CreatableTaxonomySelect
                    label="Disciplina / Materia"
                    options={lawMateriaOptions}
                    value={draft.areaId || ''}
                    placeholder="Selecione a disciplina"
                    createLabel="Criar materia"
                    loading={isCreatingMateria}
                    helper="Agrupa todas as leis da mesma area."
                    onChange={(value, option) => updateLawMateria(value, option)}
                    onCreate={createMateria}
                  />
                  <CreatableTaxonomySelect
                    label="Topico / Nome da Lei"
                    options={lawTopicoOptions}
                    value={draft.lawTopicFilterId || ''}
                    selectedLabelOverride={String(draft.title || draft.shortTitle || '').trim() || undefined}
                    placeholder={draft.areaId ? 'Selecione o topico' : 'Selecione a materia primeiro'}
                    createLabel="Criar topico"
                    disabled={!draft.areaId}
                    loading={isCreatingLawTopic}
                    helper="A lei inteira fica como topico filho da materia."
                    onChange={(value) => updateLawTopico(value)}
                    onCreate={createLawTopico}
                  />
                  <div className="rounded-sm border border-[#72aee6] bg-[#f0f6fc] px-3 py-2 text-sm text-[#135e96] md:col-span-2">
                    <span className="font-semibold">Como funciona:</span> {'Lei = Materia + Topico. Capitulo = Subtopico + Assunto. Artigos herdam o capitulo.'}
                  </div>
                </div>
              </section>

              <section className="rounded-sm border border-slate-300 bg-white shadow-sm">
                <div className="border-b border-slate-200 px-4 py-3">
                  <h2 className="text-base font-semibold text-slate-900">3. Estrutura da Lei</h2>
                  <p className="mt-1 text-xs text-slate-600">
                    Organize capitulos e artigos em uma arvore ampla, sem dividir espaco com o editor.
                  </p>
                </div>
                <div className="p-4">
                  {renderLawExplorer()}
                </div>
              </section>

              <details className="rounded-sm border border-slate-300 bg-white shadow-sm">
                <summary className="cursor-pointer px-4 py-3 text-base font-semibold text-slate-900">4. Informacoes Adicionais (opcional)</summary>
                <div className="grid gap-4 border-t border-slate-200 p-4 md:grid-cols-2">
                  <div>
                    <FieldLabel>Nome da lei</FieldLabel>
                    <TextInput value={draft.title || draft.shortTitle || ''} onChange={(event) => updateLawTitle(event.target.value)} placeholder="Lei Maria da Penha" />
                  </div>
                  <div>
                    <FieldLabel>Slug</FieldLabel>
                    <TextInput value={draft.slug || ''} onChange={(event) => updateLawField('slug', event.target.value)} placeholder="lei-maria-da-penha" />
                  </div>
                  <div>
                    <FieldLabel>Numero</FieldLabel>
                    <TextInput value={draft.number || ''} onChange={(event) => updateLawField('number', event.target.value)} placeholder="11.340/2006" />
                  </div>
                  <div>
                    <FieldLabel>Sigla</FieldLabel>
                    <TextInput value={draft.acronym || ''} onChange={(event) => updateLawField('acronym', event.target.value)} placeholder="LMP" />
                  </div>
                  <div className="md:col-span-2">
                    <FieldLabel>Ementa</FieldLabel>
                    <TextArea value={draft.ementa || ''} onChange={(event) => updateLawField('ementa', event.target.value)} />
                  </div>
                </div>
              </details>
            </main>

            <aside className="space-y-4 xl:sticky xl:top-5 xl:self-start">
              <section className="rounded-sm border border-slate-300 bg-white shadow-sm">
                <h2 className="border-b border-slate-200 px-4 py-3 text-sm font-semibold text-slate-900">Publicar</h2>
                <div className="space-y-4 p-4">
                  <div className="flex gap-2">
                    <button type="button" onClick={() => void saveLaw({ draft: true })} disabled={isSaving} className="h-8 flex-1 rounded-sm border border-slate-300 bg-white px-3 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60">
                      Salvar como rascunho
                    </button>
                    <button type="button" onClick={previewLaw} className="h-8 rounded-sm border border-slate-300 bg-white px-3 text-xs font-medium text-slate-700 hover:bg-slate-50">
                      <Eye size={13} className="mr-1 inline" /> Visualizar
                    </button>
                  </div>
                  <div className="space-y-3 text-sm text-slate-700">
                    <div>
                      <FieldLabel>Status</FieldLabel>
                      <SelectInput
                        value={lawStatusValue === 'active' || lawStatusValue === 'scheduled' ? lawStatusValue : 'draft'}
                        onChange={(event) => updateLawField('status', event.target.value as AdminLawDraft['status'])}
                      >
                        <option value="active">Publicado</option>
                        <option value="scheduled">Agendado</option>
                        <option value="draft">Rascunho (nao visivel ao publico)</option>
                      </SelectInput>
                    </div>
                    <p>Visibilidade: <strong>Publico quando publicado</strong></p>
                    <div>
                      <FieldLabel>Publicar em</FieldLabel>
                      <div className="grid grid-cols-[1fr_96px] gap-2">
                        <TextInput value={scheduledDate} onChange={(event) => setScheduledDate(event.target.value)} placeholder="dd/mm/aaaa" />
                        <TextInput value={scheduledTime} onChange={(event) => setScheduledTime(event.target.value)} placeholder="--:--" />
                      </div>
                      <p className="mt-1 text-xs text-slate-500">
                        Se ficar em branco, a data de publicacao sera definida como hoje ao publicar.
                      </p>
                    </div>
                  </div>
                </div>
                <div className="flex items-center justify-between border-t border-slate-200 bg-slate-50 px-4 py-3">
                  <button type="button" onClick={() => void deleteLaw()} disabled={isSaving || isNew} className="text-xs font-medium text-red-600 hover:underline disabled:cursor-not-allowed disabled:opacity-50">Excluir</button>
                  <button type="button" onClick={() => void saveLaw({ publish: true })} disabled={isSaving} className="inline-flex h-9 items-center gap-2 rounded-sm bg-[#2271b1] px-4 text-sm font-semibold text-white hover:bg-[#135e96] disabled:opacity-60">
                    {isSaving ? <Loader2 className="animate-spin" size={14} /> : <Save size={14} />}
                    {lawStatusValue === 'scheduled' ? 'Agendar' : isNew ? 'Publicar' : 'Atualizar'}
                  </button>
                </div>
              </section>

              <section className="rounded-sm border border-slate-300 bg-white shadow-sm">
                <h2 className="border-b border-slate-200 px-4 py-3 text-sm font-semibold text-slate-900">Atualizacoes da Lei</h2>
                <div className="space-y-3 p-4 text-sm text-slate-700">
                  <p>Compara o texto oficial do Planalto com o que esta salvo e atualiza somente artigos, caput, paragrafos, incisos e alineas alterados.</p>
                  <p className="text-xs leading-5 text-slate-500">
                    Quando o texto oficial muda, a plataforma tambem sinaliza revisao editorial para comentario, macete, doutrina, sumulas e jurisprudencia vinculados ao trecho.
                  </p>
                  <p>Ultima verificacao: <strong>{lastSyncedLabel}</strong></p>
                  <button type="button" onClick={() => void syncFromOfficialSource()} disabled={isSyncingFromOfficial || isNew} className="inline-flex h-9 w-full items-center justify-center gap-2 rounded-sm border border-[#2271b1] bg-white px-3 text-sm font-semibold text-[#2271b1] hover:bg-[#f0f6fc] disabled:opacity-60">
                    {isSyncingFromOfficial ? <Loader2 className="animate-spin" size={14} /> : <RefreshCcw size={14} />}
                    Verificar atualizacoes
                  </button>
                  <div className="rounded-sm border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600">
                    {pendingUpdatesCount > 0 ? `${pendingUpdatesCount} atualizacao(oes) recente(s) registrada(s).` : 'Nenhuma alteracao oficial carregada nesta sessao.'}
                  </div>
                  <button type="button" onClick={() => void openUpdatesModal()} disabled={isSyncingFromOfficial || isNew || pendingUpdatesCount === 0} className="inline-flex h-9 w-full items-center justify-center gap-2 rounded-sm bg-slate-200 px-3 text-sm font-semibold text-slate-600 disabled:opacity-60">
                    Ver alteracoes encontradas
                  </button>
                  {!isNew && draft.id ? (
                    <button type="button" onClick={() => void openUpdatesModal()} className="text-xs font-medium text-[#2271b1] hover:underline">
                      Ver historico de atualizacoes
                    </button>
                  ) : null}
                </div>
              </section>

              <section className="rounded-sm border border-slate-300 bg-white shadow-sm">
                <h2 className="border-b border-slate-200 px-4 py-3 text-sm font-semibold text-slate-900">IA - Gerar informacoes gerais</h2>
                <div className="space-y-3 p-4 text-sm text-slate-700">
                  <p>Gere em lote usando os mesmos padroes dos botoes individuais. O sistema pula o que ja existe e processa apenas pendencias.</p>
                  <div className="rounded-sm border border-sky-200 bg-sky-50 p-2 text-xs leading-5 text-sky-800">
                    A varredura considera caput, paragrafos, incisos, alineas e itens. Quando houver ponto relevante, a IA deve vincular o conteudo ao bloco exato, em vez de concentrar tudo no caput.
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="rounded-sm border border-slate-200 bg-slate-50 p-2">
                      <span className="block font-semibold text-slate-900">{lawAiCoverage.readySections}/{lawAiCoverage.totalSections}</span>
                      <span className="text-slate-500">capitulos com analise</span>
                    </div>
                    <div className="rounded-sm border border-slate-200 bg-slate-50 p-2">
                      <span className="block font-semibold text-slate-900">{lawAiCoverage.readyArticles}/{lawAiCoverage.totalArticles}</span>
                      <span className="text-slate-500">artigos completos</span>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <div className="rounded-sm border border-slate-200 bg-white p-3">
                      <div className="flex items-start gap-3">
                        <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-sm bg-[#f0f6fc] text-[#2271b1]">
                          <Sparkles size={16} />
                        </span>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-xs font-semibold text-slate-900">Analise dos capitulos</span>
                            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-600">
                              {lawAiCoverage.readySections}/{lawAiCoverage.totalSections}
                            </span>
                          </div>
                          <p className="mt-1 text-xs leading-5 text-slate-500">Mesmo padrao da analise detalhada gerada dentro de cada capitulo.</p>
                          <button
                            type="button"
                            onClick={() => void generateMissingLawAiContent({
                              includeSections: true,
                              includeArticles: false,
                              emptyMessage: 'Nenhum capitulo pendente de analise.',
                            })}
                            disabled={isGeneratingAllSectionAnalyses || lawAiCoverage.pendingSections.length === 0}
                            className="mt-2 inline-flex h-8 w-full items-center justify-center gap-2 rounded-sm border border-[#2271b1] bg-white px-3 text-xs font-semibold text-[#2271b1] hover:bg-[#f0f6fc] disabled:opacity-60"
                          >
                            {isGeneratingAllSectionAnalyses ? <Loader2 className="animate-spin" size={13} /> : null}
                            Gerar capitulos pendentes
                          </button>
                        </div>
                      </div>
                    </div>

                    {lawAiCoverage.articleRequirementStats.map((item) => {
                      const Icon = item.icon;
                      return (
                        <div key={`law-ai-bulk-${item.key}`} className="rounded-sm border border-slate-200 bg-white p-3">
                          <div className="flex items-start gap-3">
                            <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-sm bg-[#f0f6fc] text-[#2271b1]">
                              <Icon size={16} />
                            </span>
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center justify-between gap-2">
                                <span className="text-xs font-semibold text-slate-900">{item.title}</span>
                                <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-600">
                                  {item.ready}/{item.total}
                                </span>
                              </div>
                              <p className="mt-1 text-xs leading-5 text-slate-500">{item.text}</p>
                              <button
                                type="button"
                                onClick={() => void generateMissingLawAiContent({
                                  includeSections: false,
                                  includeArticles: true,
                                  articleKinds: [item.key],
                                  emptyMessage: `Nenhum artigo pendente de ${item.shortLabel}.`,
                                })}
                                disabled={isGeneratingAllSectionAnalyses || item.pending === 0}
                                className="mt-2 inline-flex h-8 w-full items-center justify-center gap-2 rounded-sm border border-[#2271b1] bg-white px-3 text-xs font-semibold text-[#2271b1] hover:bg-[#f0f6fc] disabled:opacity-60"
                              >
                                {isGeneratingAllSectionAnalyses ? <Loader2 className="animate-spin" size={13} /> : null}
                                Gerar pendentes
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {lawAiBulkProgress ? (
                    <div className="rounded-sm border border-slate-200 bg-slate-50 p-3">
                      <div className="flex items-center justify-between gap-3 text-xs font-semibold text-slate-700">
                        <span className="truncate">{lawAiBulkProgress.currentLabel}</span>
                        <span>{lawAiBulkPercent}%</span>
                      </div>
                      <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-200">
                        <div className="h-full rounded-full bg-[#2271b1] transition-all" style={{ width: `${lawAiBulkPercent}%` }} />
                      </div>
                      <p className="mt-2 text-xs text-slate-500">
                        {lawAiBulkProgress.completed}/{lawAiBulkProgress.total} item(ns) processado(s)
                        {lawAiBulkProgress.failed > 0 ? ` - ${lawAiBulkProgress.failed} falha(s)` : ''}
                      </p>
                    </div>
                  ) : null}

                  <button type="button" onClick={() => void generateMissingLawAiContent()} disabled={isGeneratingAllSectionAnalyses} className="inline-flex h-9 w-full items-center justify-center gap-2 rounded-sm bg-[#2271b1] px-3 text-sm font-semibold text-white hover:bg-[#135e96] disabled:opacity-60">
                    {isGeneratingAllSectionAnalyses ? <Loader2 className="animate-spin" size={14} /> : <Sparkles size={14} />}
                    Gerar todas as pendencias
                  </button>
                  {lawAiCoverage.pendingTaskCount === 0 ? (
                    <div className="flex items-start gap-2 rounded-sm border border-emerald-200 bg-emerald-50 p-2 text-xs text-emerald-700">
                      <CheckCircle2 size={13} className="mt-0.5 shrink-0" />
                      <span>Todos os capitulos e artigos elegiveis ja possuem conteudo editorial.</span>
                    </div>
                  ) : (
                    <div className="flex items-start gap-2 rounded-sm border border-amber-200 bg-amber-50 p-2 text-xs text-amber-800">
                      <AlertCircle size={13} className="mt-0.5 shrink-0" />
                      <span>{lawAiCoverage.pendingTaskCount} pendencia(s) editorial(is) detectada(s).</span>
                    </div>
                  )}
                  <p className="text-xs text-slate-500">A IA pode manter jurisprudencia ou sumula vazia quando nao houver base segura. Revise e salve a lei apos a geracao.</p>
                </div>
              </section>
            </aside>
          </div>
        </div>

        {isUpdatesModalOpen && typeof document !== 'undefined' ? createPortal(
          <div className="fixed inset-0 z-[9999] flex items-start justify-center overflow-y-auto bg-slate-950/65 px-4 py-8 backdrop-blur-sm">
            <div className={`${ADMIN_MODAL_PANEL_CLASS} w-full max-w-6xl`}>
              <div className={ADMIN_MODAL_HEADER_CLASS}>
                <div className="min-w-0">
                  <p className="text-[10px] font-black uppercase tracking-[0.18em] text-sky-700 dark:text-sky-300">
                    Lei Comentada / O que mudou
                  </p>
                  <h2 className="mt-2 text-xl font-semibold text-slate-900 dark:text-slate-100">
                    Atualizacoes da lei
                  </h2>
                  <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                    {draft.shortTitle || draft.title || 'Lei selecionada'} - ultima sincronizacao: {lastSyncedLabel}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={closeUpdatesModal}
                  className="rounded-sm border border-slate-300 bg-white p-2 text-slate-500 transition-colors hover:bg-slate-50 hover:text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800"
                  aria-label="Fechar atualizacoes"
                >
                  <X size={18} />
                </button>
              </div>

              <div className="grid gap-0 lg:grid-cols-[minmax(0,1fr)_320px]">
                <section className="min-h-[420px] border-b border-slate-300 p-5 dark:border-slate-700 lg:border-b-0 lg:border-r">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">Eventos de alteracao</h3>
                      <p className="mt-1 text-xs font-medium text-slate-500 dark:text-slate-400">
                        Diff resumido entre a redacao anterior e a redacao atual.
                      </p>
                    </div>
                    <span className="inline-flex w-fit rounded-sm border border-slate-300 bg-slate-100 px-2 py-1 text-[10px] font-black uppercase tracking-[0.14em] text-slate-600 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-300">
                      {updatesModalItems.length} evento(s)
                    </span>
                  </div>

                  <div className="mt-4 max-h-[62vh] space-y-3 overflow-y-auto pr-1">
                    {isUpdatesModalLoading ? (
                      <div className="flex min-h-[260px] items-center justify-center text-sm font-semibold text-slate-500 dark:text-slate-400">
                        <Loader2 className="mr-2 animate-spin" size={16} /> Carregando historico...
                      </div>
                    ) : updatesModalItems.length > 0 ? updatesModalItems.map((update) => (
                      <article key={update.id} className="rounded-sm border border-slate-300 bg-white dark:border-slate-700 dark:bg-slate-900">
                        <div className="border-b border-slate-200 bg-slate-50 px-4 py-3 dark:border-slate-800 dark:bg-slate-950/50">
                          <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                            <div>
                              <p className="text-[10px] font-black uppercase tracking-[0.16em] text-sky-700 dark:text-sky-300">
                                {LEGAL_UPDATE_CHANGE_LABEL[update.changeType] || update.changeType} - {formatLegalUpdateDate(update.changedAt)}
                              </p>
                              <h4 className="mt-1 text-sm font-semibold text-slate-900 dark:text-slate-100">{update.title}</h4>
                            </div>
                            {update.sourceUrl ? (
                              <a
                                href={update.sourceUrl}
                                target="_blank"
                                rel="noreferrer"
                                className="inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-[0.14em] text-sky-700 hover:underline dark:text-sky-300"
                              >
                                Fonte <ExternalLink size={12} />
                              </a>
                            ) : null}
                          </div>
                          <p className="mt-2 text-sm font-medium leading-6 text-slate-600 dark:text-slate-300">{update.summary}</p>
                        </div>

                        {(update.previousText || update.currentText) ? (
                          <div className="grid gap-0 md:grid-cols-2">
                            <div className="border-b border-slate-200 p-4 dark:border-slate-800 md:border-b-0 md:border-r">
                              <p className="text-[10px] font-black uppercase tracking-[0.16em] text-rose-600 dark:text-rose-300">Antes</p>
                              <p className="mt-2 max-h-48 overflow-y-auto whitespace-pre-wrap text-xs font-medium leading-5 text-slate-600 dark:text-slate-300">
                                {update.previousText || 'Sem redacao anterior registrada.'}
                              </p>
                            </div>
                            <div className="p-4">
                              <p className="text-[10px] font-black uppercase tracking-[0.16em] text-emerald-700 dark:text-emerald-300">Depois</p>
                              <p className="mt-2 max-h-48 overflow-y-auto whitespace-pre-wrap text-xs font-medium leading-5 text-slate-600 dark:text-slate-300">
                                {update.currentText || 'Sem redacao atual registrada.'}
                              </p>
                            </div>
                          </div>
                        ) : null}
                      </article>
                    )) : (
                      <div className="rounded-sm border border-dashed border-slate-300 bg-slate-50 p-8 text-center dark:border-slate-700 dark:bg-slate-950">
                        <FileText className="mx-auto mb-3 text-slate-300 dark:text-slate-600" size={30} />
                        <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">Nenhuma alteracao registrada.</p>
                        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                          Quando a sincronizacao detectar mudanca no texto oficial, ela aparece aqui.
                        </p>
                      </div>
                    )}
                  </div>
                </section>

                <aside className="p-5">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">Logs</h3>
                      <p className="mt-1 text-xs font-medium text-slate-500 dark:text-slate-400">Sincronizacoes recentes.</p>
                    </div>
                    <span className="rounded-sm border border-slate-300 bg-slate-100 px-2 py-1 text-[10px] font-black text-slate-500 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-300">
                      {updatesModalLogs.length}
                    </span>
                  </div>

                  <div className="mt-4 max-h-[62vh] space-y-2 overflow-y-auto pr-1">
                    {isUpdatesModalLoading ? (
                      <div className="rounded-sm border border-slate-300 p-4 text-sm text-slate-500 dark:border-slate-700 dark:text-slate-400">
                        Atualizando logs...
                      </div>
                    ) : updatesModalLogs.length > 0 ? updatesModalLogs.map((log) => (
                      <div key={log.id} className="rounded-sm border border-slate-300 bg-white p-3 dark:border-slate-700 dark:bg-slate-900">
                        <div className="flex items-start gap-2">
                          {log.status === 'failed' ? (
                            <AlertCircle className="mt-0.5 text-rose-500" size={15} />
                          ) : (
                            <CheckCircle2 className="mt-0.5 text-emerald-600" size={15} />
                          )}
                          <div className="min-w-0">
                            <p className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">
                              {log.status} - {formatLegalUpdateDate(log.startedAt)}
                            </p>
                            <p className="mt-1 text-xs font-medium leading-5 text-slate-600 dark:text-slate-300">{log.message}</p>
                            <p className="mt-2 text-[10px] font-black uppercase tracking-[0.12em] text-slate-400">
                              {log.changedArticles || 0} alt. - {log.insertedArticles || 0} novos - {log.revokedArticles || 0} revog.
                            </p>
                          </div>
                        </div>
                      </div>
                    )) : (
                      <div className="rounded-sm border border-dashed border-slate-300 p-5 text-center text-sm text-slate-500 dark:border-slate-700 dark:text-slate-400">
                        Nenhum log encontrado.
                      </div>
                    )}
                  </div>
                </aside>
              </div>

              <div className={`${ADMIN_MODAL_FOOTER_CLASS} flex flex-col gap-2 sm:flex-row sm:justify-end`}>
                <button type="button" onClick={closeUpdatesModal} className={ADMIN_SECONDARY_BUTTON_CLASS}>
                  Fechar
                </button>
                <button
                  type="button"
                  onClick={() => void openUpdatesModal()}
                  disabled={isUpdatesModalLoading}
                  className={ADMIN_SECONDARY_BUTTON_CLASS}
                >
                  {isUpdatesModalLoading ? <Loader2 className="animate-spin" size={14} /> : <RefreshCcw size={14} />}
                  Recarregar
                </button>
                <button
                  type="button"
                  onClick={() => void syncFromOfficialSource().then(() => openUpdatesModal())}
                  disabled={isSyncingFromOfficial || isUpdatesModalLoading}
                  className={ADMIN_PRIMARY_BUTTON_CLASS}
                >
                  {isSyncingFromOfficial ? <Loader2 className="animate-spin" size={14} /> : <RefreshCcw size={14} />}
                  Sincronizar agora
                </button>
              </div>
            </div>
          </div>,
          document.body,
        ) : null}
      </div>,
  );
};

export default AdminLegalCommentaryEditPage;
