/*
* ----------------------------------------------------
* @author: 4quarenta
* @author URI: https://github.com/4quarenta
* @copyright: (c) 2026 ConcursoMestre. All rights reserved
* ----------------------------------------------------
*
* @since 1.1.1
*
*/

import React from 'react';
import { BookOpen, FileText, Lightbulb, Loader2, MessageSquare, Plus, Scale, X } from 'lucide-react';
import type {
  ArticleExamTip,
  ArticleJurisprudence,
  LawArticle,
  LawDetail,
  LawSection,
  LawSectionEditorial,
  LegalArticleBlock,
  LegalArticleSyllabus,
  LegalTargetedText,
  LegalArea,
  LegalEditorialGenerationScope,
  LegalRichContentBlock,
  TeacherComment,
} from '@types';
import {
  ADMIN_FIELD_CLASS,
  ADMIN_TEXTAREA_CLASS,
} from '../../../../components/shared/adminPanelStyles';

export type AdminLawDraft = Partial<LawDetail> & {
  areaId?: string;
  legalAreaId?: string;
  sumulas?: LegalArticleSyllabus[];
  publishedAt?: string;
  published_at?: string;
};

export type GeneratedArticleContentKind = 'teacher' | 'tip' | 'jurisprudence' | 'sumula' | 'doctrine' | 'jurisprudenceNote';

export interface TaxonomyOption {
  id: string | number;
  name: string;
  slug?: string;
  parentId?: string | number | null;
  rootSubjectId?: string | number | null;
  taxonomyLevel?: string;
}

export type RawTaxonomyOption = Record<string, unknown>;
export type LawDetailAdminAliases = Partial<LawDetail> & {
  legalAreaId?: unknown;
  preamble?: unknown;
  area?: (Partial<LegalArea> & { legalAreaId?: unknown }) | null;
};
export type ArticleEditorialCounts = {
  teacher: number;
  tips: number;
  jurisprudence: number;
  sumulas: number;
  doctrine: number;
  total: number;
};

export type AdminLawSectionOverview = LawSection & {
  resolvedSectionId: string;
  articleIds: string[];
  articles: number;
  primaryArticleId: string;
  articlesList: LawArticle[];
  counts: ArticleEditorialCounts;
  savedEditorial?: LawSectionEditorial;
  hasAnalysis: boolean;
};

export type LegalAiGenerationKind = 'teacher-comment' | 'exam-tip' | 'jurisprudence' | 'sumula' | 'doctrine' | 'bundle';

export type LegalArticleAiKind = Exclude<LegalAiGenerationKind, 'bundle'>;

export type LegalAiBulkTask =
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

export type LegalAiBulkProgress = {
  total: number;
  completed: number;
  failed: number;
  currentLabel: string;
  running: boolean;
};

export const LEGAL_BLOCK_KINDS: Array<{ value: LegalArticleBlock['kind']; label: string }> = [
  { value: 'caput', label: 'Caput' },
  { value: 'paragraph', label: 'Paragrafo' },
  { value: 'inciso', label: 'Inciso' },
  { value: 'alinea', label: 'Alinea' },
  { value: 'item', label: 'Item' },
  { value: 'note', label: 'Nota oficial' },
];

export const LEGAL_BLOCK_KIND_LABEL = LEGAL_BLOCK_KINDS.reduce<Record<string, string>>((labels, kind) => ({
  ...labels,
  [kind.value]: kind.label,
}), {});

export const createTempId = (prefix: string) => `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;

export const formatSectionRange = (section: Pick<LawSection, 'fromArticle' | 'toArticle'>) => {
  const from = String(section.fromArticle || '').trim();
  const to = String(section.toArticle || '').trim();
  if (!from && !to) return '';
  if (!to || from === to) return `Art. ${from}`;
  return `Art. ${from} ao Art. ${to}`;
};

export const normalizeParam = (value?: string | string[]) => Array.isArray(value) ? value[0] : value;

export const getErrorMessage = (error: unknown, fallback: string) => (
  error && typeof error === 'object' && 'message' in error && typeof error.message === 'string'
    ? error.message
    : fallback
);

export const escapeLegalAnalysisHtml = (value: unknown) => String(value || '')
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&#039;');

export const hasLegalRichBlockContent = (block?: LegalRichContentBlock | null) => Boolean(
  String(block?.content || '').trim()
  || (Array.isArray(block?.items) && block.items.some((item) => String(item || '').trim()))
  || (Array.isArray(block?.rows) && block.rows.some((row) => Array.isArray(row) && row.some((cell) => String(cell || '').trim()))),
);

export const legalRichBlockToSingleAnalysisHtml = (block: LegalRichContentBlock) => {
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

export const buildSingleSectionAnalysisHtml = (editorial?: LawSectionEditorial | null) => {
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

export const buildSingleSectionAnalysisBlocks = (content: string): LegalRichContentBlock[] => {
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

export const getLegalAreaId = (area: unknown): string => {
  if (!area || typeof area !== 'object' || !('legalAreaId' in area)) {
    return '';
  }

  const { legalAreaId } = area as { legalAreaId?: unknown };
  return String(legalAreaId || '');
};

export const normalizeTaxonomyText = (value: unknown) => String(value || '')
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .toLowerCase()
  .trim();

export const slugifyTaxonomy = (value: string) => normalizeTaxonomyText(value)
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/^-+|-+$/g, '');

export const sanitizeLegacyTaxonomyLabel = (value: string) => value
  .replace(/\((?:area|área)\s+antiga\)/ig, '')
  .replace(/\s{2,}/g, ' ')
  .trim();

export const isNumericOnlyLabel = (value: string) => /^\d+$/.test(String(value || '').trim());

export const buildDefaultBlockLabel = (kind: LegalArticleBlock['kind'], articleNumber: string, sequence: number) => {
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

export const buildArticleTextFromBlocks = (blocks: LegalArticleBlock[]) => blocks
  .map((block) => {
    const label = String(block.label || '').trim();
    const text = String(block.text || '').trim();
    if (!label && !text) return '';
    return [label, text].filter(Boolean).join(' ').trim();
  })
  .filter(Boolean)
  .join('\n');

export const normalizeArticleBlocks = (article: LawArticle): LegalArticleBlock[] => {
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

export const normalizeArticleForSave = (article: LawArticle): LawArticle => {
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

export const getTeacherCommentTarget = (comment: Partial<TeacherComment>): LegalRichContentBlock['target'] | undefined => (
  comment.richBlocks?.find((block) => block.target)?.target
  || comment.blocks?.find((block) => block.target)?.target
);

export const getEditorialTargetKey = (target?: LegalRichContentBlock['target'] | null) => {
  if (!target) return '';
  const blockId = String(target.blockId || '').trim();
  if (blockId) return `block:${blockId}`;

  const kind = String(target.kind || '').trim().toLowerCase();
  const label = normalizeTaxonomyText(target.label || '');
  return kind || label ? `${kind}:${label}` : '';
};

export const getArticleExamTipTarget = (tip: Partial<ArticleExamTip>): LegalRichContentBlock['target'] | undefined => (
  tip.target
);

export const mergeTeacherCommentsByTarget = (
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

export const mergeExamTipsByTarget = (
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

export const getTargetedTextBody = (item: string | LegalTargetedText): string => (
  typeof item === 'string'
    ? item
    : String(item.body || item.text || '').trim()
);

export const getTargetedTextTarget = (item: string | LegalTargetedText): LegalRichContentBlock['target'] | undefined => (
  typeof item === 'string' ? undefined : item.target
);

export const updateTargetedTextItem = (
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

export const withTargetOnFirstRichBlock = (
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

export const updateTeacherCommentRichBody = (comment: TeacherComment, body: string): TeacherComment => {
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

export const updateTeacherCommentTarget = (
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

export const isLikelyEditoriallyIrrelevantArticle = (article: Partial<LawArticle>) => {
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

export const isEmptyJurisprudencePlaceholderText = (value: unknown) => {
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

export const hasMeaningfulJurisprudenceContent = (item: Partial<ArticleJurisprudence>) => {
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

export const readRawTaxonomyString = (raw: RawTaxonomyOption, keys: string[]) => {
  for (const key of keys) {
    const value = raw[key];
    if (typeof value === 'string' && value.trim()) {
      return value.trim();
    }
  }
  return '';
};

export const normalizeTaxonomyOption = (rawOption: unknown, fallbackLevel?: string): TaxonomyOption | null => {
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

export const normalizeTaxonomyCollection = (collection: unknown, fallbackLevel?: string): TaxonomyOption[] => {
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

export const splitKnowledgeTaxonomies = (taxonomies: unknown) => {
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

export const hasTaxonomyPayload = (taxonomies: unknown): boolean => {
  if (!taxonomies || typeof taxonomies !== 'object') {
    return false;
  }

  const record = taxonomies as Record<string, unknown>;
  return Object.values(record).some((value) => Array.isArray(value) && value.length > 0);
};

export const buildLegalAreaFromTaxonomy = (subject?: TaxonomyOption, fallback?: Partial<LegalArea> | null): LegalArea | undefined => {
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

export const buildEmptyArticle = (lawId = 'new', sectionId?: string | null, assuntoFilterId?: string | null): LawArticle => {
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

export const buildEmptyLaw = (): AdminLawDraft => {
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

export const buildAreasFromSubjects = (subjects: TaxonomyOption[]): LegalArea[] => (
  subjects.map((subject, index) => ({
    id: String(subject.id),
    slug: String(subject.slug || slugifyTaxonomy(subject.name) || `materia-${index + 1}`) as LegalArea['slug'],
    name: subject.name,
    description: '',
    order: index,
    iconTone: 'sky',
  }))
);

export const resolveLawMateria = (
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

export const hydrateDraftFromLaw = (
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

export const getArticleLabel = (article: LawArticle) =>
  article.number ? `Art. ${article.number}` : 'Artigo sem numero';

export const hasFilledText = (value: unknown) => (
  value && typeof value === 'object'
    ? getTargetedTextBody(value as LegalTargetedText).trim().length > 0
    : String(value || '').trim().length > 0
);

export const buildEmptyEditorialCounts = (): ArticleEditorialCounts => ({
  teacher: 0,
  tips: 0,
  jurisprudence: 0,
  sumulas: 0,
  doctrine: 0,
  total: 0,
});

export const sumEditorialCounts = (items: ArticleEditorialCounts[]): ArticleEditorialCounts => {
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

export const getArticleEditorialCounts = (draft: AdminLawDraft, article: LawArticle): ArticleEditorialCounts => {
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

export const FieldLabel = ({ children }: { children: React.ReactNode }) => (
  <label className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400 dark:text-slate-500">{children}</label>
);

export const TextInput = (props: React.InputHTMLAttributes<HTMLInputElement>) => (
  <input
    {...props}
    className={`h-10 w-full ${ADMIN_FIELD_CLASS} ${props.className || ''}`}
  />
);

export const TextArea = (props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) => (
  <textarea
    {...props}
    className={`min-h-28 resize-y ${ADMIN_TEXTAREA_CLASS} ${props.className || ''}`}
  />
);

export const SelectInput = (props: React.SelectHTMLAttributes<HTMLSelectElement>) => (
  <select
    {...props}
    className={`h-10 w-full ${ADMIN_FIELD_CLASS} ${props.className || ''}`}
  />
);

export interface CreatableTaxonomySelectProps {
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

export const CreatableTaxonomySelect = ({
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

export const formatLegalUpdateDate = (value?: string | null) => {
  if (!value) return 'Sem registro';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? String(value) : date.toLocaleString('pt-BR');
};

export const withAdminLoadTimeout = async <T,>(promise: Promise<T>, timeoutMs: number, message: string): Promise<T> => (
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

export const padDatePart = (value: number) => String(value).padStart(2, '0');

export const formatLocalDateTimeForApi = (date: Date) => (
  `${date.getFullYear()}-${padDatePart(date.getMonth() + 1)}-${padDatePart(date.getDate())} ${padDatePart(date.getHours())}:${padDatePart(date.getMinutes())}:00`
);

export const parseAdminPublicationDateTime = (value?: string | null): { date: string; time: string } => {
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

export const normalizeAdminPublicationDate = (value: string): string | null => {
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

export const normalizeAdminPublicationTime = (value: string): string => {
  const rawTime = value.trim();
  const match = rawTime.match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return '00:00';

  const hours = Math.min(23, Math.max(0, Number(match[1])));
  const minutes = Math.min(59, Math.max(0, Number(match[2])));
  return `${padDatePart(hours)}:${padDatePart(minutes)}`;
};

export const LEGAL_UPDATE_CHANGE_LABEL: Record<string, string> = {
  created: 'Incluido',
  changed: 'Alterado',
  revoked: 'Revogado',
  renumbered: 'Renumerado',
  editorial_review_required: 'Revisao editorial',
};

export const AI_KIND_LABEL: Record<LegalAiGenerationKind, string> = {
  'teacher-comment': 'Comentario',
  'exam-tip': 'Macete',
  jurisprudence: 'Jurisprudencia',
  sumula: 'Sumula',
  doctrine: 'Doutrina',
  bundle: 'Pacote IA',
};

export const ARTICLE_AI_GENERATION_CARDS: Array<{
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

export const ARTICLE_AI_REQUIREMENTS: Array<{
  kind: LegalArticleAiKind;
  label: string;
  countKey: keyof Omit<ArticleEditorialCounts, 'total'>;
}> = ARTICLE_AI_GENERATION_CARDS.map((card) => ({
  kind: card.key,
  label: card.shortLabel,
  countKey: card.countKey,
}));

export const getMissingArticleAiRequirements = (counts: ArticleEditorialCounts): LegalArticleAiKind[] => (
  ARTICLE_AI_REQUIREMENTS
    .filter((requirement) => Number(counts[requirement.countKey] || 0) <= 0)
    .map((requirement) => requirement.kind)
);

export const resolveAiScope = (kind: LegalArticleAiKind): LegalEditorialGenerationScope => {
  if (kind === 'teacher-comment') return 'field-comment';
  if (kind === 'exam-tip') return 'field-macete';
  if (kind === 'jurisprudence') return 'field-jurisprudencia';
  if (kind === 'sumula') return 'field-sumulas';
  return 'field-doutrina';
};
