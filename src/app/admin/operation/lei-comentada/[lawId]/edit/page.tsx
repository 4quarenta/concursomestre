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
  ArrowLeft,
  Bot,
  CheckCircle2,
  Download,
  ExternalLink,
  FileText,
  History,
  Loader2,
  Plus,
  RefreshCcw,
  Save,
  Sparkles,
  Trash2,
  X,
} from 'lucide-react';
import { useAuth } from '@providers/AuthProvider';
import { useToast } from '@providers/ToastProvider';
import { canAccessAdminPanel } from '@services/auth';
import { filtersService } from '@services/filters';
import { legalCommentaryApiService } from '@services/legal-commentary';
import { buildLawSections, formatSectionRange, type LawSectionSummary } from '@services/legal-commentary/lawOutline';
import type {
  ArticleExamTip,
  ArticleJurisprudence,
  LawArticle,
  LawDetail,
  LawSectionEditorial,
  LawUpdate,
  LegalArticleBlock,
  LegalArticleEditorialSnapshot,
  LegalArea,
  LegalEditorialBatchRun,
  LegalEditorialGenerationResult,
  LegalEditorialGenerationScope,
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
  ADMIN_SURFACE_HEADER_CLASS,
  ADMIN_FIELD_CLASS,
  ADMIN_TEXTAREA_CLASS,
} from '../../../../components/shared/adminPanelStyles';
import AdminStandaloneShell from '../../../../components/shared/AdminStandaloneShell';
import { buildAdminLawEditPath } from '../../../../config/adminPageNavigationConfig';

type AdminLawDraft = Partial<LawDetail> & {
  areaId?: string;
  legalAreaId?: string;
  sumulas?: Array<{
    id?: string;
    articleId?: string;
    court: string;
    number: string;
    text: string;
    sourceUrl?: string;
    priority?: string;
  }>;
};

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
type EditableCollectionKey = 'teacherComments' | 'examTips' | 'jurisprudence' | 'sumulas';
type EditableCollectionItem =
  | TeacherComment
  | ArticleExamTip
  | ArticleJurisprudence
  | NonNullable<AdminLawDraft['sumulas']>[number];

type LegalAiGenerationKind = 'teacher-comment' | 'exam-tip' | 'jurisprudence' | 'sumula' | 'doctrine' | 'bundle';
type LegalEditorialSection = 'teacher' | 'tips' | 'jurisprudence' | 'sumulas' | 'doctrine' | 'section-analysis' | 'ai';

const LEGAL_EDITORIAL_SECTIONS: Array<{
  key: LegalEditorialSection;
  label: string;
  description: string;
}> = [
  { key: 'teacher', label: 'Professor', description: 'Comentario pedagogico principal do artigo.' },
  { key: 'tips', label: 'Macetes', description: 'Chaves de prova, sem siglas artificiais.' },
  { key: 'jurisprudence', label: 'Jurisprudencia', description: 'Somente decisoes ligadas ao artigo.' },
  { key: 'sumulas', label: 'Sumulas', description: 'Enunciados relevantes para o dispositivo.' },
  { key: 'doctrine', label: 'Doutrina', description: 'Apoio teorico curto e revisavel.' },
  { key: 'section-analysis', label: 'Capitulos', description: 'Analise aprofundada por capitulo.' },
  { key: 'ai', label: 'IA e lote', description: 'Geracao assistida e acompanhamento por artigo.' },
];

const LEGAL_BLOCK_KINDS: Array<{ value: LegalArticleBlock['kind']; label: string }> = [
  { value: 'caput', label: 'Caput' },
  { value: 'paragraph', label: 'Paragrafo' },
  { value: 'inciso', label: 'Inciso' },
  { value: 'alinea', label: 'Alinea' },
  { value: 'item', label: 'Item' },
  { value: 'note', label: 'Nota oficial' },
];

const createTempId = (prefix: string) => `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;

const normalizeParam = (value?: string | string[]) => Array.isArray(value) ? value[0] : value;

const getErrorMessage = (error: unknown, fallback: string) => (
  error && typeof error === 'object' && 'message' in error && typeof error.message === 'string'
    ? error.message
    : fallback
);

const getLegalAreaId = (area: unknown): string => {
  if (!area || typeof area !== 'object' || !('legalAreaId' in area)) {
    return '';
  }

  const { legalAreaId } = area as { legalAreaId?: unknown };
  return String(legalAreaId || '');
};

const normalizeLawStatus = (value: string): NonNullable<LawDetail['status']> => {
  const allowedStatuses: NonNullable<LawDetail['status']>[] = ['active', 'revoked', 'partially_revoked', 'monitoring'];
  return allowedStatuses.includes(value as NonNullable<LawDetail['status']>)
    ? value as NonNullable<LawDetail['status']>
    : 'active';
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
    hierarchy: {
      ...(article.hierarchy || {}),
      title: String(
        (article.hierarchy as Record<string, unknown>)?.resolvedSubtopic
        || article.hierarchy?.title
        || (article.hierarchy as Record<string, unknown>)?.titleLabel
        || '',
      ).trim(),
      chapter: String(
        (article.hierarchy as Record<string, unknown>)?.resolvedAssunto
        || article.hierarchy?.chapter
        || (article.hierarchy as Record<string, unknown>)?.chapterLabel
        || '',
      ).trim(),
    },
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
  const text = normalizeTaxonomyText(value);
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

const buildEmptyArticle = (lawId = 'new'): LawArticle => {
  const id = createTempId('article');
  return {
    id,
    lawId,
    slug: id,
    number: '',
    title: '',
    text: '',
    paragraphs: [],
    jurisprudenceNotes: [],
    syllabi: [],
    doctrine: [],
    relatedQuestionCount: 0,
    hierarchy: {},
    blocks: [
      {
        id: `${id}-caput`,
        kind: 'caput',
        label: 'Art.',
        text: '',
      },
    ],
    subjectFilterId: null,
    topicFilterId: null,
  };
};

const buildEmptyLaw = (): AdminLawDraft => {
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
  status: 'active',
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
  articles: [buildEmptyArticle()],
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
  const articles = (law.articles || []).map((article, index) => {
    const nextId = String(article.id || createTempId(`article-${index + 1}`));
    const originalId = String(article.id || '');
    const hierarchy = (article.hierarchy || {}) as Record<string, unknown>;
    const articleInternalTitle = String(article.title || '').trim();
    const resolvedSubtopic = String(
      hierarchy.resolvedSubtopic
      || hierarchy.title
      || hierarchy.titleLabel
      || hierarchy.book
      || hierarchy.bookLabel
      || hierarchy.part
      || hierarchy.partLabel
      || '',
    ).trim();
    const resolvedChapter = String(
      hierarchy.resolvedAssunto
      || hierarchy.chapter
      || hierarchy.chapterLabel
      || hierarchy.section
      || hierarchy.sectionLabel
      || hierarchy.subsection
      || hierarchy.subsectionLabel
      || '',
    ).trim();
    if (originalId) {
      articleIdMap.set(originalId, nextId);
    }

    const hydratedArticle: LawArticle = {
      ...article,
      id: nextId,
      lawId: String(article.lawId || law.id || 'new'),
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
      hierarchy: {
        ...hierarchy,
        title: resolvedSubtopic || String(hierarchy.title || ''),
        chapter: resolvedChapter || String(hierarchy.chapter || ''),
        ...(resolvedSubtopic ? { resolvedSubtopic } : {}),
        ...(resolvedChapter ? { resolvedAssunto: resolvedChapter } : {}),
      },
      relatedQuestionCount: article.relatedQuestionCount || 0,
      subjectFilterId: article.subjectFilterId ?? null,
      topicFilterId: article.topicFilterId ?? null,
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
      sectionKey: String(item.sectionKey || ''),
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

const getHierarchyDisplayText = (
  keys: string[],
  article?: Partial<LawArticle> | null,
): string => {
  const hierarchy = (article?.hierarchy || {}) as Record<string, unknown>;

  for (const key of keys) {
    const value = String(hierarchy[key] || '').trim();
    if (value !== '') {
      return value;
    }
  }

  return '';
};

const getArticleSubtopicDisplayText = (article?: Partial<LawArticle> | null): string => getHierarchyDisplayText([
  'resolvedSubtopic',
  'title',
  'titleLabel',
  'book',
  'bookLabel',
  'part',
  'partLabel',
], article);

const getArticleAssuntoDisplayText = (article?: Partial<LawArticle> | null): string => getHierarchyDisplayText([
  'resolvedAssunto',
  'chapter',
  'chapterLabel',
  'section',
  'sectionLabel',
  'subsection',
  'subsectionLabel',
], article);

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

const LEGAL_UPDATE_CHANGE_LABEL: Record<string, string> = {
  created: 'Incluido',
  changed: 'Alterado',
  revoked: 'Revogado',
  renumbered: 'Renumerado',
};

const EditorPanel = ({ title, description, children }: { title: string; description?: string; children: React.ReactNode }) => (
  <section className={`${ADMIN_SURFACE_CLASS} overflow-hidden`}>
    <div className={ADMIN_SURFACE_HEADER_CLASS}>
      <div className="space-y-1">
        <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">{title}</h2>
        {description ? (
          <p className="text-sm text-slate-500 dark:text-slate-400">{description}</p>
        ) : null}
      </div>
    </div>
    <div className="p-5">{children}</div>
  </section>
);

const EditorMetaBox = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <section className={`${ADMIN_SURFACE_CLASS} overflow-hidden`}>
    <div className={ADMIN_SURFACE_HEADER_CLASS}>
      <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">{title}</h2>
    </div>
    <div className="p-4">{children}</div>
  </section>
);

const AI_KIND_LABEL: Record<LegalAiGenerationKind, string> = {
  'teacher-comment': 'Comentario',
  'exam-tip': 'Macete',
  jurisprudence: 'Jurisprudencia',
  sumula: 'Sumula',
  doctrine: 'Doutrina',
  bundle: 'Pacote IA',
};

const formatBatchStatusLabel = (status?: string) => {
  switch (status) {
    case 'success':
      return 'Sucesso';
    case 'partial':
      return 'Parcial';
    case 'failed':
      return 'Falha';
    case 'running':
      return 'Em execucao';
    case 'pending':
      return 'Pendente';
    case 'completed':
      return 'Concluido';
    case 'stopped':
      return 'Interrompido';
    case 'skipped':
      return 'Ignorado';
    default:
      return status || 'Sem status';
  }
};

const getBatchStatusClasses = (status?: string) => {
  switch (status) {
    case 'success':
      return 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300';
    case 'failed':
      return 'bg-rose-50 text-rose-700 dark:bg-rose-500/10 dark:text-rose-300';
    case 'running':
      return 'bg-indigo-50 text-indigo-700 dark:bg-indigo-500/10 dark:text-indigo-300';
    case 'stopped':
      return 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300';
    case 'pending':
      return 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300';
    default:
      return 'bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-300';
  }
};

const AdminLegalCommentaryEditPage = () => {
  const params = useParams<{ lawId?: string | string[] }>();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { currentUser, isLoading: isAuthLoading } = useAuth();
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
  const [isLoading, setIsLoading] = React.useState(true);
  const [isSaving, setIsSaving] = React.useState(false);
  const [isImportingFromPlanalto, setIsImportingFromPlanalto] = React.useState(false);
  const [isSyncingFromOfficial, setIsSyncingFromOfficial] = React.useState(false);
  const [isCreatingMateria, setIsCreatingMateria] = React.useState(false);
  const [isCreatingLawTopic, setIsCreatingLawTopic] = React.useState(false);
  const [isCreatingSubtopic, setIsCreatingSubtopic] = React.useState(false);
  const [isCreatingAssunto, setIsCreatingAssunto] = React.useState(false);
  const [aiLoading, setAiLoading] = React.useState<string | null>(null);
  const [aiProgress, setAiProgress] = React.useState<{ kind: string; label: string; percent: number } | null>(null);
  const [sectionAnalysisLoadingKey, setSectionAnalysisLoadingKey] = React.useState<string | null>(null);
  const [isGeneratingAllSectionAnalyses, setIsGeneratingAllSectionAnalyses] = React.useState(false);
  const [activeEditorialSection, setActiveEditorialSection] = React.useState<LegalEditorialSection>('teacher');
  const [isUpdatesModalOpen, setIsUpdatesModalOpen] = React.useState(false);
  const [isUpdatesModalLoading, setIsUpdatesModalLoading] = React.useState(false);
  const [updatesModalItems, setUpdatesModalItems] = React.useState<LawUpdate[]>([]);
  const [updatesModalLogs, setUpdatesModalLogs] = React.useState<LegalSyncLog[]>([]);
  const hasOpenedUpdatesFromQueryRef = React.useRef(false);
  const [batchRun, setBatchRun] = React.useState<LegalEditorialBatchRun | null>(null);
  const [isBatchRunning, setIsBatchRunning] = React.useState(false);
  const [isBatchRefreshing, setIsBatchRefreshing] = React.useState(false);
  const [isBatchPaused, setIsBatchPaused] = React.useState(false);
  const [batchOnlyMissingComments, setBatchOnlyMissingComments] = React.useState(true);
  const batchPauseRef = React.useRef(false);
  const batchStopRef = React.useRef(false);
  const batchStatusLoadedForLawRef = React.useRef('');

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
    await ensureTaxonomiesLoaded(force);
    const cachedTaxonomies = useAppConfigStore.getState().systemSettings.taxonomies;
    if (hasTaxonomyPayload(cachedTaxonomies)) {
      return splitKnowledgeTaxonomies(cachedTaxonomies);
    }

    const fallbackTaxonomies = await filtersService.listTaxonomies();
    return splitKnowledgeTaxonomies(fallbackTaxonomies);
  }, [ensureTaxonomiesLoaded]);

  React.useEffect(() => {
    if (!isAuthLoading && !canAccessAdmin) {
      router.replace('/');
    }
  }, [canAccessAdmin, isAuthLoading, router]);

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
    const loadingFrameId = window.requestAnimationFrame(() => {
      if (!isCurrent) return;
      setIsLoading(true);
      setLoadError(null);
    });

    (async () => {
      try {
        const knowledgeTaxonomies = await resolveKnowledgeTaxonomies();
        const payload = isNew
          ? { law: null, areas: [] as LegalArea[] }
          : await legalCommentaryApiService.getAdminDetail(lawId);

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

  React.useEffect(() => {
    if (!draft?.id || isNew) {
      batchStatusLoadedForLawRef.current = '';
      const resetFrameId = window.requestAnimationFrame(() => setBatchRun(null));
      return () => window.cancelAnimationFrame(resetFrameId);
    }

    if (activeEditorialSection !== 'ai') {
      return;
    }

    const currentLawId = String(draft.id);
    if (batchStatusLoadedForLawRef.current === currentLawId) {
      return;
    }

    let active = true;
    const refreshingFrameId = window.requestAnimationFrame(() => {
      if (active) setIsBatchRefreshing(true);
    });

    legalCommentaryApiService.getAdminEditorialBatchStatus({ lawId: currentLawId })
      .then((run) => {
        if (active) {
          setBatchRun(run);
          batchStatusLoadedForLawRef.current = currentLawId;
        }
      })
      .catch(() => {
        if (active) {
          setBatchRun(null);
          batchStatusLoadedForLawRef.current = currentLawId;
        }
      })
      .finally(() => {
        if (active) {
          setIsBatchRefreshing(false);
        }
      });

    return () => {
      active = false;
      window.cancelAnimationFrame(refreshingFrameId);
    };
  }, [activeEditorialSection, draft?.id, isNew]);

  const activeArticle = React.useMemo(
    () => draft?.articles?.find((article) => article.id === activeArticleId) || draft?.articles?.[0] || null,
    [activeArticleId, draft?.articles],
  );

  const lawSections = React.useMemo(
    () => buildLawSections(
      draft?.articles || [],
      [draft?.id, draft?.slug, draft?.shortTitle, draft?.number].filter(Boolean),
    ),
    [draft?.articles, draft?.id, draft?.number, draft?.shortTitle, draft?.slug],
  );

  React.useEffect(() => {
    if (!draft || draft.lawTopicFilterId) {
      return;
    }

    const materiaId = String(draft.areaId || '');
    if (!materiaId) {
      return;
    }

    const topicById = new Map(topics.map((item) => [String(item.id), item]));
    const assuntoById = new Map(specificSubjects.map((item) => [String(item.id), item]));

    const resolveLawTopicFromArticle = (article: LawArticle): string => {
      const subtopicId = String(article.subjectFilterId || '');
      if (subtopicId) {
        const subtopic = topicById.get(subtopicId);
        if (subtopic) {
          const directParent = String(subtopic.parentId || '');
          const root = String(subtopic.rootSubjectId || '');
          if (directParent === materiaId || root === materiaId) {
            return subtopicId;
          }

          const parentTopic = topicById.get(directParent);
          if (parentTopic) {
            const parentRoot = String(parentTopic.rootSubjectId || '');
            const parentParent = String(parentTopic.parentId || '');
            if (parentParent === materiaId || parentRoot === materiaId) {
              return String(parentTopic.id);
            }
          }
        }
      }

      const assuntoId = String(article.topicFilterId || '');
      if (assuntoId) {
        const assunto = assuntoById.get(assuntoId);
        const parentId = String(assunto?.parentId || '');
        if (!parentId) return '';

        const parentTopic = topicById.get(parentId);
        if (parentTopic) {
          const parentParent = String(parentTopic.parentId || '');
          const parentRoot = String(parentTopic.rootSubjectId || '');
          if (parentParent === materiaId || parentRoot === materiaId) {
            return String(parentTopic.id);
          }

          const grandParentTopic = topicById.get(parentParent);
          if (grandParentTopic) {
            const grandParentParent = String(grandParentTopic.parentId || '');
            const grandParentRoot = String(grandParentTopic.rootSubjectId || '');
            if (grandParentParent === materiaId || grandParentRoot === materiaId) {
              return String(grandParentTopic.id);
            }
          }
        }
      }

      return '';
    };

    const inferredLawTopicId = (draft.articles || [])
      .map(resolveLawTopicFromArticle)
      .find((value) => value !== '');

    if (!inferredLawTopicId) {
      return;
    }

    const inferTopicFrameId = window.requestAnimationFrame(() => {
      setDraft((current) => {
        if (!current || current.lawTopicFilterId) return current;
        return {
          ...current,
          lawTopicFilterId: inferredLawTopicId,
        };
      });
    });

    return () => window.cancelAnimationFrame(inferTopicFrameId);
  }, [draft, specificSubjects, topics]);

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

  const selectedSubtopicFallbackOption = React.useMemo<TaxonomyOption | null>(() => {
    const selectedSubtopicId = String(activeArticle?.subjectFilterId || '');
    if (!selectedSubtopicId) return null;
    const existing = topics.find((topic) => String(topic.id) === selectedSubtopicId);
    if (existing && !isNumericOnlyLabel(existing.name)) return existing;
    const titleName = String(getArticleSubtopicDisplayText(activeArticle) || '').trim();
    if (!titleName) return null;
    return {
      id: selectedSubtopicId,
      name: titleName,
      parentId: draft?.lawTopicFilterId || null,
    };
  }, [activeArticle, draft?.lawTopicFilterId, topics]);

  const articleSubtopicOptions = React.useMemo(() => {
    const lawTopicId = String(draft?.lawTopicFilterId || '');
    const selectedSubtopicId = String(activeArticle?.subjectFilterId || '');
    const selectedSubtopicCandidate = topics.find((topic) => String(topic.id) === selectedSubtopicId);
    const selectedSubtopic = (selectedSubtopicCandidate && !isNumericOnlyLabel(selectedSubtopicCandidate.name))
      ? selectedSubtopicCandidate
      : selectedSubtopicFallbackOption;

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
  }, [activeArticle?.subjectFilterId, draft?.lawTopicFilterId, selectedSubtopicFallbackOption, topics]);

  const selectedAssuntoFallbackOption = React.useMemo<TaxonomyOption | null>(() => {
    const selectedAssuntoId = String(activeArticle?.topicFilterId || '');
    if (!selectedAssuntoId) return null;
    const existing = specificSubjects.find((subject) => String(subject.id) === selectedAssuntoId);
    if (existing && !isNumericOnlyLabel(existing.name)) return existing;
    const chapterName = String(getArticleAssuntoDisplayText(activeArticle)).trim();
    if (!chapterName) return null;
    return {
      id: selectedAssuntoId,
      name: chapterName,
      parentId: activeArticle?.subjectFilterId || draft?.lawTopicFilterId || null,
    };
  }, [activeArticle, draft?.lawTopicFilterId, specificSubjects]);

  const articleAssuntoOptions = React.useMemo(() => {
    const selectedSubtopicId = String(activeArticle?.subjectFilterId || '');
    const selectedAssuntoId = String(activeArticle?.topicFilterId || '');
    const lawTopicId = String(draft?.lawTopicFilterId || '');
    const assuntoParentId = selectedSubtopicId || lawTopicId;
    const selectedAssuntoCandidate = specificSubjects.find((subject) => String(subject.id) === selectedAssuntoId);
    const selectedAssunto = (selectedAssuntoCandidate && !isNumericOnlyLabel(selectedAssuntoCandidate.name))
      ? selectedAssuntoCandidate
      : selectedAssuntoFallbackOption;

    const filtered = assuntoParentId
      ? specificSubjects.filter((subject) => String(subject.parentId || '') === assuntoParentId)
      : [];

    if (selectedAssunto && !filtered.some((subject) => String(subject.id) === String(selectedAssunto.id))) {
      filtered.unshift(selectedAssunto);
    }

    return filtered;
  }, [activeArticle?.subjectFilterId, activeArticle?.topicFilterId, draft?.lawTopicFilterId, selectedAssuntoFallbackOption, specificSubjects]);

  const reloadKnowledgeTaxonomies = React.useCallback(async () => {
    const knowledgeTaxonomies = await resolveKnowledgeTaxonomies(true);
    setSubjects(knowledgeTaxonomies.subjects);
    setTopics(knowledgeTaxonomies.topics);
    setSpecificSubjects(knowledgeTaxonomies.specificSubjects);
    return knowledgeTaxonomies;
  }, [resolveKnowledgeTaxonomies]);

  const updateActiveArticleTaxonomy = React.useCallback((
    patch: {
      subjectFilterId?: string | null;
      topicFilterId?: string | null;
      title?: string;
      chapter?: string;
      resetTitleLabel?: boolean;
      resetChapterLabel?: boolean;
    },
  ) => {
    setDraft((current) => {
      if (!current) return current;
      const nextArticles = (current.articles || []).map((article) => (
        article.id === activeArticleId
          ? {
            ...article,
            subjectFilterId: patch.subjectFilterId !== undefined ? patch.subjectFilterId : article.subjectFilterId,
            topicFilterId: patch.topicFilterId !== undefined ? patch.topicFilterId : article.topicFilterId,
            hierarchy: {
              ...(article.hierarchy || {}),
              ...(patch.title !== undefined ? { title: patch.title, resolvedSubtopic: patch.title } : {}),
              ...(patch.chapter !== undefined ? { chapter: patch.chapter, resolvedAssunto: patch.chapter } : {}),
              ...(patch.resetTitleLabel ? { titleLabel: '' } : {}),
              ...(patch.resetChapterLabel ? { chapterLabel: '' } : {}),
            },
          }
          : article
      ));
      return { ...current, articles: nextArticles };
    });
  }, [activeArticleId]);

  const updateLawMateria = (subjectId: string, explicitSubject?: TaxonomyOption) => {
    if (!subjectId) {
      setDraft((current) => current ? {
        ...current,
        areaId: '',
        lawTopicFilterId: null,
        articles: (current.articles || []).map((article) => ({
          ...article,
          subjectFilterId: null,
          topicFilterId: null,
          hierarchy: {
            ...(article.hierarchy || {}),
            title: '',
            chapter: '',
            titleLabel: '',
            chapterLabel: '',
          },
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
          subjectFilterId: null,
          topicFilterId: null,
          hierarchy: {
            ...(article.hierarchy || {}),
            title: '',
            chapter: '',
            titleLabel: '',
            chapterLabel: '',
          },
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
          subjectFilterId: null,
          topicFilterId: null,
          hierarchy: {
            ...(article.hierarchy || {}),
            title: '',
            chapter: '',
            titleLabel: '',
            chapterLabel: '',
          },
        })),
      } : current);
      return;
    }

    setDraft((current) => {
      if (!current) return current;
      return {
        ...current,
        lawTopicFilterId: String(lawTopicId),
        articles: (current.articles || []).map((article) => {
          const currentSubtopic = topics.find((topic) => String(topic.id) === String(article.subjectFilterId || ''));
          const subtopicBelongsToLawTopic = !currentSubtopic
            || String(currentSubtopic.parentId || '') === String(lawTopicId)
            || String(currentSubtopic.rootSubjectId || '') === String(lawTopicId);

          if (subtopicBelongsToLawTopic) {
            const currentAssunto = specificSubjects.find((subject) => String(subject.id) === String(article.topicFilterId || ''));
            const assuntoParentId = String(currentAssunto?.parentId || '');
            const allowedAssuntoParentId = String(article.subjectFilterId || lawTopicId);
            if (!currentAssunto || assuntoParentId === allowedAssuntoParentId) {
              return article;
            }
          }

          return {
            ...article,
            subjectFilterId: null,
            topicFilterId: null,
            hierarchy: {
              ...(article.hierarchy || {}),
              title: '',
              chapter: '',
              titleLabel: '',
              chapterLabel: '',
            },
          };
        }),
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

  const createArticleSubtopic = async (rawName: string) => {
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

    const existing = topics.find((topic) => (
      normalizeTaxonomyText(topic.name) === normalizeTaxonomyText(name)
      && (
        String(topic.parentId || '') === lawTopicId
        || String(topic.rootSubjectId || '') === lawTopicId
      )
    ));

    if (existing) {
      updateActiveArticleTaxonomy({
        subjectFilterId: String(existing.id),
        topicFilterId: null,
        title: existing.name,
        chapter: '',
        resetChapterLabel: true,
      });
      addToast('Subtopico existente selecionado.', 'info');
      return;
    }

    const parentId = Number(lawTopicId);
    if (!Number.isFinite(parentId)) {
      addToast('O topico selecionado precisa estar cadastrado nas taxonomias.', 'error');
      return;
    }

    setIsCreatingSubtopic(true);
    try {
      const createdId = await filtersService.save({
        type: 'assunto',
        name,
        slug: slugifyTaxonomy(name),
        materia: false,
        taxonomy_level: 'subtopico',
        parent_id: parentId,
        metadata: { taxonomy_level: 'subtopico' },
      });
      const knowledgeTaxonomies = await reloadKnowledgeTaxonomies();
      const created = knowledgeTaxonomies.topics.find((topic) => String(topic.id) === String(createdId))
        || knowledgeTaxonomies.topics.find((topic) => (
          normalizeTaxonomyText(topic.name) === normalizeTaxonomyText(name)
          && (
            String(topic.parentId || '') === lawTopicId
            || String(topic.rootSubjectId || '') === lawTopicId
          )
        ))
        || { id: createdId || name, name, parentId: lawTopicId, rootSubjectId: lawTopicId };
      updateActiveArticleTaxonomy({
        subjectFilterId: String(created.id),
        topicFilterId: null,
        title: created.name,
        chapter: '',
        resetChapterLabel: true,
      });
      addToast('Subtopico criado e vinculado ao artigo.', 'success');
    } catch (error: unknown) {
      addToast(getErrorMessage(error, 'Nao foi possivel criar o subtopico.'), 'error');
    } finally {
      setIsCreatingSubtopic(false);
    }
  };

  const createArticleAssunto = async (rawName: string) => {
    const name = rawName.trim();
    const parentTaxonomyId = String(activeArticle?.subjectFilterId || draft?.lawTopicFilterId || '');
    if (!name) {
      addToast('Informe o nome do capitulo.', 'info');
      return;
    }
    if (!parentTaxonomyId) {
      addToast('Selecione o topico da lei ou um subtopico antes de criar o assunto.', 'error');
      return;
    }

    const existing = specificSubjects.find((subject) => (
      normalizeTaxonomyText(subject.name) === normalizeTaxonomyText(name)
      && String(subject.parentId || '') === parentTaxonomyId
    ));

    if (existing) {
      updateActiveArticleTaxonomy({
        topicFilterId: String(existing.id),
        chapter: existing.name,
      });
      addToast('Capitulo existente selecionado.', 'info');
      return;
    }

    const parentId = Number(parentTaxonomyId);
    if (!Number.isFinite(parentId)) {
      addToast('O item selecionado precisa estar cadastrado nas taxonomias.', 'error');
      return;
    }

    setIsCreatingAssunto(true);
    try {
      const createdId = await filtersService.save({
        type: 'assunto',
        name,
        slug: slugifyTaxonomy(name),
        materia: false,
        taxonomy_level: 'assunto',
        parent_id: parentId,
        metadata: { taxonomy_level: 'assunto' },
      });
      const knowledgeTaxonomies = await reloadKnowledgeTaxonomies();
      const created = knowledgeTaxonomies.specificSubjects.find((subject) => String(subject.id) === String(createdId))
        || knowledgeTaxonomies.specificSubjects.find((subject) => (
          normalizeTaxonomyText(subject.name) === normalizeTaxonomyText(name)
          && String(subject.parentId || '') === parentTaxonomyId
        ))
        || { id: createdId || name, name, parentId: parentTaxonomyId };
      updateActiveArticleTaxonomy({
        topicFilterId: String(created.id),
        chapter: created.name,
      });
      addToast('Capitulo criado e vinculado ao artigo.', 'success');
    } catch (error: unknown) {
      addToast(getErrorMessage(error, 'Nao foi possivel criar o capitulo.'), 'error');
    } finally {
      setIsCreatingAssunto(false);
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

  const updateArticleField = (field: keyof LawArticle | 'subjectFilterId' | 'topicFilterId', value: unknown) => {
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

  const moveArticleBlock = (blockId: string, direction: 'up' | 'down') => {
    if (!activeArticle) return;
    setDraft((current) => {
      if (!current) return current;
      return {
        ...current,
        articles: (current.articles || []).map((article) => {
          if (article.id !== activeArticle.id) return article;
          const blocks = [...(article.blocks || [])];
          const index = blocks.findIndex((block) => block.id === blockId);
          if (index < 0) return article;
          const nextIndex = direction === 'up' ? index - 1 : index + 1;
          if (nextIndex < 0 || nextIndex >= blocks.length) return article;
          const [block] = blocks.splice(index, 1);
          blocks.splice(nextIndex, 0, block);
          return {
            ...article,
            blocks: normalizeArticleBlocks({
              ...article,
              blocks,
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
      const article = buildEmptyArticle(current.id || 'new');
      setActiveArticleId(article.id);
      return { ...current, articles: [...(current.articles || []), article] };
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

  const addDoctrine = (text = '') => {
    if (!activeArticle) return;
    setDraft((current) => {
      if (!current) return current;
      return {
        ...current,
        articles: (current.articles || []).map((article) => article.id === activeArticle.id ? {
          ...article,
          doctrine: [...(article.doctrine || []), text],
        } : article),
      };
    });
  };

  const updateDoctrine = (index: number, text: string) => {
    if (!activeArticle) return;
    setDraft((current) => {
      if (!current) return current;
      return {
        ...current,
        articles: (current.articles || []).map((article) => {
          if (article.id !== activeArticle.id) return article;
          return {
            ...article,
            doctrine: (article.doctrine || []).map((item, itemIndex) => itemIndex === index ? text : item),
          };
        }),
      };
    });
  };

  const removeDoctrine = (index: number) => {
    if (!activeArticle) return;
    setDraft((current) => {
      if (!current) return current;
      return {
        ...current,
        articles: (current.articles || []).map((article) => article.id === activeArticle.id ? {
          ...article,
          doctrine: (article.doctrine || []).filter((_, itemIndex) => itemIndex !== index),
        } : article),
      };
    });
  };

  const addTeacherComment = (comment?: Partial<TeacherComment>) => {
    if (!activeArticle) return;
    const nextComment: TeacherComment = {
      id: createTempId('teacher'),
      articleId: activeArticle.id,
      title: comment?.title || 'Comentario do professor',
      body: comment?.body || '',
      examFocus: comment?.examFocus || [],
      pitfalls: comment?.pitfalls || [],
      relatedRefs: comment?.relatedRefs || [],
      authorName: comment?.authorName || 'Equipe editorial',
      authorRole: comment?.authorRole || 'Professor especialista',
      reviewedAt: new Date().toISOString(),
    };
    setDraft((current) => current ? { ...current, teacherComments: [...(current.teacherComments || []), nextComment] } : current);
  };

  const addExamTip = (tip?: Partial<ArticleExamTip>) => {
    if (!activeArticle) return;
    const nextTip: ArticleExamTip = {
      id: createTempId('tip'),
      articleId: activeArticle.id,
      title: tip?.title || 'Macete para prova',
      body: tip?.body || '',
      tags: tip?.tags || [],
    };
    setDraft((current) => current ? { ...current, examTips: [...(current.examTips || []), nextTip] } : current);
  };

  const addJurisprudence = (item?: Partial<ArticleJurisprudence>) => {
    if (!activeArticle) return;
    const nextItem: ArticleJurisprudence = {
      id: createTempId('juris'),
      articleId: activeArticle.id,
      court: (item?.court || 'STJ') as ArticleJurisprudence['court'],
      precedentType: item?.precedentType || '',
      title: item?.title || '',
      summary: item?.summary || '',
      examImpact: item?.examImpact || '',
      isConsolidated: Boolean(item?.isConsolidated),
      priority: item?.priority || 'medium',
      sourceUrl: item?.sourceUrl || '',
    };
    setDraft((current) => current ? {
      ...current,
      jurisprudence: [...(current.jurisprudence || []), nextItem],
      articles: (current.articles || []).map((article) => article.id === activeArticle.id ? {
        ...article,
        jurisprudenceNotes: [],
      } : article),
    } : current);
  };

  const addSumula = (item?: Partial<NonNullable<AdminLawDraft['sumulas']>[number]>) => {
    if (!activeArticle) return;
    const nextItem = {
      id: createTempId('sumula'),
      articleId: activeArticle.id,
      court: item?.court || 'STJ',
      number: item?.number || '',
      text: item?.text || '',
      sourceUrl: item?.sourceUrl || '',
      priority: item?.priority || 'medium',
    };
    setDraft((current) => current ? { ...current, sumulas: [...(current.sumulas || []), nextItem] } : current);
  };

  const getEditableCollection = (current: AdminLawDraft, collection: EditableCollectionKey): EditableCollectionItem[] => {
    const items = current[collection];
    return Array.isArray(items) ? items as EditableCollectionItem[] : [];
  };

  const getEditableCollectionItemId = (item: EditableCollectionItem) => String('id' in item ? item.id || '' : '');

  const updateNestedItem = (collection: EditableCollectionKey, id: string, field: string, value: unknown) => {
    setDraft((current) => {
      if (!current) return current;
      return {
        ...current,
        [collection]: getEditableCollection(current, collection).map((item) => (
          getEditableCollectionItemId(item) === id ? { ...item, [field]: value } : item
        )),
      };
    });
  };

  const removeNestedItem = (collection: EditableCollectionKey, id: string) => {
    setDraft((current) => current ? {
      ...current,
      [collection]: getEditableCollection(current, collection).filter((item) => getEditableCollectionItemId(item) !== id),
    } : current);
  };

  const resolveAiScope = (kind: Exclude<LegalAiGenerationKind, 'bundle'>): LegalEditorialGenerationScope => {
    if (kind === 'teacher-comment') return 'field-comment';
    if (kind === 'exam-tip') return 'field-macete';
    if (kind === 'jurisprudence') return 'field-jurisprudencia';
    if (kind === 'sumula') return 'field-sumulas';
    return 'field-doutrina';
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

  const buildArticleEditorialSnapshot = React.useCallback((currentDraft: AdminLawDraft, article: LawArticle): LegalArticleEditorialSnapshot => ({
    articleId: article.id,
    articleNumber: article.number,
    teacherComments: (currentDraft.teacherComments || []).filter((item) => item.articleId === article.id),
    examTips: (currentDraft.examTips || []).filter((item) => item.articleId === article.id),
    doctrine: article.doctrine || [],
    jurisprudenceNotes: article.jurisprudenceNotes || [],
    jurisprudence: (currentDraft.jurisprudence || []).filter((item) => item.articleId === article.id),
    sumulas: (currentDraft.sumulas || []).filter((item) => item.articleId === article.id),
  }), []);

  const articleHasTeacherComment = React.useCallback((currentDraft: AdminLawDraft, article: LawArticle) => {
    const snapshot = buildArticleEditorialSnapshot(currentDraft, article);
    return (snapshot.teacherComments || []).some((item) => String(item.body || '').trim().length > 0);
  }, [buildArticleEditorialSnapshot]);

  const articleHasEditorialSection = React.useCallback((currentDraft: AdminLawDraft, article: LawArticle, section: LegalEditorialSection) => {
    const snapshot = buildArticleEditorialSnapshot(currentDraft, article);
    if (section === 'teacher') {
      return (snapshot.teacherComments || []).some((item) => String(item.body || item.title || '').trim().length > 0);
    }
    if (section === 'tips') {
      return (snapshot.examTips || []).some((item) => String(item.body || item.title || '').trim().length > 0);
    }
    if (section === 'jurisprudence') {
      return (snapshot.jurisprudence || []).some(hasMeaningfulJurisprudenceContent)
        || (snapshot.jurisprudenceNotes || []).some((item) => (
          String(item || '').trim().length > 0
          && !isEmptyJurisprudencePlaceholderText(item)
        ));
    }
    if (section === 'sumulas') {
      return (snapshot.sumulas || []).some((item) => String(item.text || item.number || '').trim().length > 0);
    }
    if (section === 'doctrine') {
      return (snapshot.doctrine || []).some((item) => String(item || '').trim().length > 0);
    }
    return false;
  }, [buildArticleEditorialSnapshot]);

  const editorialCoverage = React.useMemo(() => {
    if (!draft || activeEditorialSection === 'ai' || activeEditorialSection === 'section-analysis') {
      return null;
    }

    const articles = draft.articles || [];
    const relevantArticles = articles.filter((article) => !isLikelyEditoriallyIrrelevantArticle(article));
    const missingArticles = relevantArticles.filter((article) => !articleHasEditorialSection(draft, article, activeEditorialSection));

    return {
      total: relevantArticles.length,
      covered: relevantArticles.length - missingArticles.length,
      missingArticles,
      skippedArticles: articles.length - relevantArticles.length,
    };
  }, [activeEditorialSection, articleHasEditorialSection, draft]);

  const addEditorialPlaceholdersToArticles = (section: LegalEditorialSection, onlyMissing: boolean) => {
    if (!draft || section === 'ai') return;

    const articles = (draft.articles || []).filter((article) => !isLikelyEditoriallyIrrelevantArticle(article));
    const targets = articles.filter((article) => (
      onlyMissing ? !articleHasEditorialSection(draft, article, section) : true
    ));

    if (targets.length === 0) {
      addToast('Todos os artigos ja possuem esse bloco editorial.', 'info');
      return;
    }

    const targetIds = new Set(targets.map((article) => article.id));

    setDraft((current) => {
      if (!current) return current;
      const currentArticles = current.articles || [];

      if (section === 'teacher') {
        return {
          ...current,
          teacherComments: [
            ...(current.teacherComments || []),
            ...targets.map((article) => ({
              id: createTempId('teacher'),
              articleId: article.id,
              title: 'Comentario do professor',
              body: '',
              examFocus: [],
              pitfalls: [],
              relatedRefs: [],
              authorName: 'Equipe editorial',
              authorRole: 'Professor especialista',
              reviewedAt: new Date().toISOString(),
            })),
          ],
        };
      }

      if (section === 'tips') {
        return {
          ...current,
          examTips: [
            ...(current.examTips || []),
            ...targets.map((article) => ({
              id: createTempId('tip'),
              articleId: article.id,
              title: 'Macete para prova',
              body: '',
              tags: [],
            })),
          ],
        };
      }

      if (section === 'jurisprudence') {
        return {
          ...current,
          jurisprudence: [
            ...(current.jurisprudence || []),
            ...targets.map((article) => ({
              id: createTempId('juris'),
              articleId: article.id,
              court: 'STJ' as ArticleJurisprudence['court'],
              precedentType: '',
              title: '',
              summary: '',
              examImpact: '',
              isConsolidated: false,
              priority: 'medium' as ArticleJurisprudence['priority'],
              sourceUrl: '',
            })),
          ],
        };
      }

      if (section === 'sumulas') {
        return {
          ...current,
          sumulas: [
            ...(current.sumulas || []),
            ...targets.map((article) => ({
              id: createTempId('sumula'),
              articleId: article.id,
              court: 'STJ',
              number: '',
              text: '',
              sourceUrl: '',
              priority: 'medium',
            })),
          ],
        };
      }

      if (section === 'doctrine') {
        return {
          ...current,
          articles: currentArticles.map((article) => targetIds.has(article.id)
            ? { ...article, doctrine: [...(article.doctrine || []), ''] }
            : article),
        };
      }

      return current;
    });

    addToast(
      onlyMissing
        ? `Bloco adicionado em ${targets.length} artigo(s) pendente(s).`
        : `Bloco adicionado em ${targets.length} artigo(s).`,
      'success',
    );
  };

  const batchEligibleArticlesCount = React.useMemo(() => {
    if (!draft?.articles?.length) return 0;
    return (draft.articles || [])
      .filter((article) => !isLikelyEditoriallyIrrelevantArticle(article))
      .filter((article) => (
        batchOnlyMissingComments ? !articleHasTeacherComment(draft, article) : true
      )).length;
  }, [articleHasTeacherComment, batchOnlyMissingComments, draft]);

  const waitWhileBatchPaused = React.useCallback(async () => {
    while (batchPauseRef.current && !batchStopRef.current) {
      await new Promise((resolve) => setTimeout(resolve, 250));
    }
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

      return {
        ...current,
        teacherComments: [
          ...(current.teacherComments || []).filter((item) => item.articleId !== result.articleId),
          ...editorial.teacherComments,
        ],
        examTips: [
          ...(current.examTips || []).filter((item) => item.articleId !== result.articleId),
          ...editorial.examTips,
        ],
        jurisprudence: [
          ...(current.jurisprudence || []).filter((item) => item.articleId !== result.articleId),
          ...editorial.jurisprudence,
        ],
        sumulas: [
          ...(current.sumulas || []).filter((item) => item.articleId !== result.articleId),
          ...editorial.sumulas,
        ],
        articles: (current.articles || []).map((article) => article.id === result.articleId ? {
          ...article,
          doctrine: editorial.doctrine,
          doutrina: editorial.doctrine,
          jurisprudenceNotes: editorial.jurisprudenceNotes || [],
          macete: editorial.examTips[0]?.body || null,
          examTip: editorial.examTips[0]?.body || null,
          comentarios: editorial.teacherComments,
          jurisprudencia: editorial.jurisprudence,
          sumulas: editorial.sumulas,
          syllabi: editorial.sumulas,
        } : article),
      };
    });
  }, [ensureNestedIds]);

  const refreshBatchRun = React.useCallback(async (runId?: string) => {
    if (!runId && !draftRef.current?.id) return null;

    setIsBatchRefreshing(true);
    try {
      const nextRun = await legalCommentaryApiService.getAdminEditorialBatchStatus(
        runId ? { runId } : { lawId: String(draftRef.current?.id || '') },
      );
      setBatchRun(nextRun);
      return nextRun;
    } finally {
      setIsBatchRefreshing(false);
    }
  }, []);

  const generateArticleEditorial = React.useCallback(async (
    article: LawArticle,
    scope: LegalEditorialGenerationScope,
    batchRunId?: string,
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
      previewOnly: !/^\d+$/.test(String(currentDraft.id || '')) || !/^\d+$/.test(String(article.id || '')),
      batchRunId,
    });

    applyEditorialResultToDraft(result);
    if (result.batch) {
      setBatchRun(result.batch);
    }
    return result;
  }, [applyEditorialResultToDraft, buildArticleEditorialSnapshot]);

  const applySectionEditorialToDraft = React.useCallback((sectionEditorial?: LawSectionEditorial) => {
    if (!sectionEditorial?.sectionKey) {
      return;
    }

    setDraft((current) => {
      if (!current) {
        return current;
      }

      const existing = current.sectionEditorials || [];
      const nextSectionEditorials = [
        ...existing.filter((item) => item.sectionKey !== sectionEditorial.sectionKey),
        sectionEditorial,
      ];

      return {
        ...current,
        sectionEditorials: nextSectionEditorials,
      };
    });
  }, []);

  const generateSectionAnalysis = React.useCallback(async (section: LawSectionSummary, options?: { silent?: boolean }) => {
    const currentDraft = draftRef.current;
    if (!currentDraft?.id || !/^\d+$/.test(String(currentDraft.id))) {
      addToastRef.current('Salve a lei antes de gerar a analise dos capitulos.', 'info');
      return null;
    }

    const sectionKey = section.sectionKey || section.id;
    setSectionAnalysisLoadingKey(sectionKey);

    try {
      const result = await legalCommentaryApiService.generateAdminEditorial({
        scope: 'section-analysis',
        lawId: String(currentDraft.id),
        law: currentDraft,
        section: {
          id: section.id,
          sectionKey,
          sectionTitle: section.title,
          title: section.title,
          rangeLabel: formatSectionRange(section),
          fromArticle: section.fromArticle,
          toArticle: section.toArticle,
          articleIds: section.articleIds,
        },
        previewOnly: false,
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

  const generateMissingSectionAnalyses = React.useCallback(async () => {
    const currentDraft = draftRef.current;
    if (!currentDraft?.id || !/^\d+$/.test(String(currentDraft.id))) {
      addToastRef.current('Salve a lei antes de gerar as analises dos capitulos.', 'info');
      return;
    }

    const existingKeys = new Set((currentDraft.sectionEditorials || []).map((item) => item.sectionKey));
    const pendingSections = lawSections.filter((section) => !existingKeys.has(section.sectionKey || section.id));
    const sectionsToGenerate = pendingSections.length > 0 ? pendingSections : lawSections;

    if (sectionsToGenerate.length === 0) {
      addToastRef.current('Nao ha capitulos detectados para esta lei.', 'info');
      return;
    }

    setIsGeneratingAllSectionAnalyses(true);
    let successCount = 0;
    let failedCount = 0;
    try {
      for (const section of sectionsToGenerate) {
        const saved = await generateSectionAnalysis(section, { silent: true });
        if (saved) {
          successCount += 1;
        } else {
          failedCount += 1;
        }
      }

      if (failedCount > 0) {
        addToastRef.current(
          `Geracao dos capitulos concluida com pendencias: ${successCount} sucesso(s), ${failedCount} falha(s).`,
          'info',
        );
      } else {
        addToastRef.current(`Analises dos capitulos concluidas: ${successCount} capitulo(s) atualizado(s).`, 'success');
      }
    } finally {
      setIsGeneratingAllSectionAnalyses(false);
    }
  }, [generateSectionAnalysis, lawSections]);

  const generateWithAi = async (kind: Exclude<LegalAiGenerationKind, 'bundle'>) => {
    if (!draft || !activeArticle) {
      addToast('Nenhum artigo ativo para gerar conteudo.', 'info');
      return;
    }

    if (isLikelyEditoriallyIrrelevantArticle(activeArticle)) {
      addToast('Este artigo parece ser bloco final, assinatura ou expediente sem relevancia recorrente para prova. Nao e necessario gerar conteudo editorial.', 'info');
      return;
    }

    setAiLoading(kind);
    startAiProgress(kind, AI_KIND_LABEL[kind]);

    try {
      const result = await generateArticleEditorial(activeArticle, resolveAiScope(kind));
      setAiProgress((current) => current?.kind === kind ? { ...current, percent: 92 } : current);
      const warnings = result.summary.warnings || [];

      if (result.summary.approvedBlocks > 0) {
        addToast(`${AI_KIND_LABEL[kind]} gerado${result.persisted ? ' e salvo' : ''}. Revise o resultado.`, 'success');
      } else {
        addToast(warnings[0] || `Nada seguro para adicionar em ${AI_KIND_LABEL[kind].toLowerCase()}.`, 'info');
      }
    } catch (error: unknown) {
      addToast(getErrorMessage(error, 'Nao foi possivel gerar com IA agora.'), 'error');
    } finally {
      finishAiProgress(kind);
      setAiLoading(null);
    }
  };

  const generateAiBundle = async () => {
    if (!draft || !activeArticle) {
      addToast('Nenhum artigo ativo para gerar conteudo.', 'info');
      return;
    }

    if (isLikelyEditoriallyIrrelevantArticle(activeArticle)) {
      addToast('Este artigo parece ser bloco final, assinatura ou expediente sem relevancia recorrente para prova. Nao e necessario gerar pacote editorial.', 'info');
      return;
    }

    setAiLoading('bundle');
    startAiProgress('bundle', AI_KIND_LABEL.bundle);

    try {
      const result = await generateArticleEditorial(activeArticle, 'article-full');
      setAiProgress((current) => current?.kind === 'bundle' ? { ...current, percent: 92 } : current);
      const warnings = result.summary.warnings || [];

      if (result.summary.approvedBlocks > 0) {
        addToast(
          `Pacote IA concluido${result.persisted ? ' e salvo' : ''}: ${result.summary.approvedBlocks} bloco(s) aprovados. Revise o artigo.`,
          'success',
        );
      } else {
        addToast(warnings[0] || 'A IA nao encontrou conteudo editorial seguro para este artigo.', 'info');
      }
    } catch (error: unknown) {
      addToast(getErrorMessage(error, 'Nao foi possivel gerar o pacote com IA agora.'), 'error');
    } finally {
      finishAiProgress('bundle');
      setAiLoading(null);
    }
  };

  const executeBatchRun = React.useCallback(async (run: LegalEditorialBatchRun) => {
    setIsBatchRunning(true);
    batchStopRef.current = false;
    batchPauseRef.current = false;
    setIsBatchPaused(false);

    try {
      for (const item of run.items) {
        if (batchStopRef.current) {
          break;
        }

        await waitWhileBatchPaused();
        if (batchStopRef.current) {
          break;
        }

        const currentDraft = draftRef.current;
        const article = currentDraft?.articles?.find((entry) => entry.id === item.articleId);
        if (!currentDraft || !article) {
          continue;
        }
        if (isLikelyEditoriallyIrrelevantArticle(article)) {
          continue;
        }

        try {
          await generateArticleEditorial(article, 'article-full', run.id);
        } catch {
          await refreshBatchRun(run.id);
        }
      }

      const finalRun = batchStopRef.current
        ? await legalCommentaryApiService.stopAdminEditorialBatch(run.id).catch(async () => refreshBatchRun(run.id))
        : await refreshBatchRun(run.id);

      if (finalRun) {
        setBatchRun(finalRun);
      }

      if (finalRun) {
        if (finalRun.status === 'stopped') {
          addToast('Lote interrompido. O progresso concluido foi mantido.', 'info');
        } else if (finalRun.failedArticles > 0 || finalRun.partialArticles > 0) {
          addToast(
            `Lote concluido com revisoes pendentes: ${finalRun.successfulArticles} sucesso, ${finalRun.partialArticles} parcial, ${finalRun.failedArticles} falha.`,
            'info',
          );
        } else {
          addToast(`Lote concluido com sucesso em ${finalRun.successfulArticles} artigo(s).`, 'success');
        }
      }
    } finally {
      setIsBatchRunning(false);
      batchPauseRef.current = false;
      batchStopRef.current = false;
      setIsBatchPaused(false);
    }
  }, [generateArticleEditorial, refreshBatchRun, addToast, waitWhileBatchPaused]);

  const startBatchGeneration = async (options?: { onlyMissingComments?: boolean }) => {
    if (!draft?.id || !/^\d+$/.test(String(draft.id))) {
      addToast('Salve a lei antes de iniciar a geracao em lote.', 'info');
      return;
    }

    const unsavedArticles = (draft.articles || []).some((article) => !/^\d+$/.test(String(article.id || '')));
    if (unsavedArticles) {
      addToast('Salve os artigos novos antes de rodar o lote.', 'info');
      return;
    }

    try {
      const onlyMissingComments = options?.onlyMissingComments ?? batchOnlyMissingComments;
      const eligibleArticles = (draft.articles || [])
        .filter((article) => !isLikelyEditoriallyIrrelevantArticle(article))
        .filter((article) => (
          onlyMissingComments ? !articleHasTeacherComment(draft, article) : true
        ));

      if (eligibleArticles.length === 0) {
        addToast(
          onlyMissingComments
            ? 'Todos os artigos ja possuem comentario do professor.'
            : 'Nao ha artigos elegiveis para o lote.',
          'info',
        );
        return;
      }

      const run = await legalCommentaryApiService.startAdminEditorialBatch(
        String(draft.id),
        eligibleArticles.map((article) => article.id),
      );
      setBatchRun(run);
      await executeBatchRun(run);
    } catch (error: unknown) {
      addToast(getErrorMessage(error, 'Nao foi possivel iniciar o lote editorial.'), 'error');
    }
  };

  const retryFailedBatch = async () => {
    if (!batchRun?.id) {
      addToast('Nenhum lote disponivel para reprocessar.', 'info');
      return;
    }

    try {
      const run = await legalCommentaryApiService.retryAdminEditorialBatch(batchRun.id);
      setBatchRun(run);
      await executeBatchRun(run);
    } catch (error: unknown) {
      addToast(getErrorMessage(error, 'Nao foi possivel reprocessar os artigos falhados.'), 'error');
    }
  };

  const toggleBatchPause = () => {
    const nextPaused = !batchPauseRef.current;
    batchPauseRef.current = nextPaused;
    setIsBatchPaused(nextPaused);
  };

  const stopBatchRun = () => {
    batchStopRef.current = true;
    batchPauseRef.current = false;
    setIsBatchPaused(false);
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

  const saveLaw = async () => {
    if (!draft) return;
    const normalizedAreaId = String(draft.areaId || draft.area?.id || '').trim();
    if (!normalizedAreaId) {
      addToast('Selecione a materia da lei antes de salvar.', 'info');
      return;
    }

    setIsSaving(true);

    try {
      const cleanedPreamble = String(draft.preamble || '').trim();
      const cleanedEmenta = String(draft.ementa || '').trim();
      const cleanedDescription = cleanedPreamble || cleanedEmenta || String(draft.description || '').trim();
      const normalizedLawName = String(draft.title || draft.shortTitle || '').trim();
      const normalizedArticles = (draft.articles || []).map((article) => normalizeArticleForSave(article));
      const saved = await legalCommentaryApiService.saveAdminLaw({
        ...draft,
        title: normalizedLawName,
        shortTitle: normalizedLawName,
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
      addToast('Lei salva com sucesso.', 'success');
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

  const articleComments = (draft.teacherComments || []).filter((item) => item.articleId === activeArticle?.id);
  const articleTips = (draft.examTips || []).filter((item) => item.articleId === activeArticle?.id);
  const articleJurisprudence = (draft.jurisprudence || []).filter((item) => item.articleId === activeArticle?.id);
  const articleSumulas = (draft.sumulas || []).filter((item) => item.articleId === activeArticle?.id);
  const sectionEditorialsByKey = new Map((draft.sectionEditorials || []).map((item) => [item.sectionKey, item]));
  const recentLawUpdates = (draft.updates || []).slice(0, 3);
  const activeSectionMeta = LEGAL_EDITORIAL_SECTIONS.find((section) => section.key === activeEditorialSection);
  const sectionAnalysesCount = lawSections.filter((section) => sectionEditorialsByKey.has(section.sectionKey || section.id)).length;
  const editorialSectionCounts: Record<LegalEditorialSection, number> = {
    teacher: articleComments.length,
    tips: articleTips.length,
    jurisprudence: articleJurisprudence.length + (activeArticle?.jurisprudenceNotes || []).length,
    sumulas: articleSumulas.length,
    doctrine: activeArticle?.doctrine?.length || 0,
    'section-analysis': sectionAnalysesCount,
    ai: batchRun ? Math.max(batchRun.processedArticles, batchRun.totalArticles) : batchEligibleArticlesCount,
  };
  const batchProgressPercent = batchRun?.totalArticles
    ? Math.min(100, Math.round((batchRun.processedArticles / batchRun.totalArticles) * 100))
    : 0;
  const batchStartLabel = batchOnlyMissingComments
    ? `Gerar comentarios pendentes (${batchEligibleArticlesCount})`
    : `Gerar comentarios de todos (${batchEligibleArticlesCount})`;
  const lawStatusValue = String(draft.status || 'active');
  const lastSyncedLabel = draft.lastSyncedAt
    ? new Date(draft.lastSyncedAt).toLocaleString('pt-BR')
    : 'Ainda nao sincronizada';

  return renderAdminShell(
      <div className="space-y-5">
        <div className={`${ADMIN_SURFACE_CLASS} overflow-hidden`}>
          <div className={`${ADMIN_SURFACE_HEADER_CLASS} flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between`}>
            <div className="flex min-w-0 items-start gap-4">
            <Link href="/admin/operation/lei-comentada" className={`${ADMIN_SECONDARY_BUTTON_CLASS} mt-0.5 h-9 w-9 justify-center p-0`}>
              <ArrowLeft size={18} />
            </Link>
            <div>
              <h1 className="text-2xl font-semibold text-slate-900 dark:text-slate-100">
                {isNew ? 'Nova lei comentada' : draft.shortTitle || draft.title || 'Editar lei'}
              </h1>
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                Base oficial, artigos, comentarios editoriais e sincronizacao com a fonte normativa.
              </p>
            </div>
          </div>

            <div className="flex flex-col gap-2 sm:flex-row">
              {!isNew && draft.id ? (
                <button type="button" onClick={() => void openUpdatesModal()} className={ADMIN_SECONDARY_BUTTON_CLASS}>
                  <History size={14} /> Atualizacoes
                </button>
              ) : null}
              {!isNew && draft.id ? (
                <button
                  type="button"
                  onClick={() => void syncFromOfficialSource()}
                  disabled={isSyncingFromOfficial}
                  className={ADMIN_SECONDARY_BUTTON_CLASS}
                >
                  {isSyncingFromOfficial ? <Loader2 className="animate-spin" size={14} /> : <RefreshCcw size={14} />}
                  Sincronizar
                </button>
              ) : null}
              <button
                type="button"
                onClick={() => void saveLaw()}
                disabled={isSaving}
                className={ADMIN_PRIMARY_BUTTON_CLASS}
              >
                {isSaving ? <Loader2 className="animate-spin" size={14} /> : <Save size={14} />}
                Salvar lei
              </button>
            </div>
          </div>
        </div>

        {!isNew && draft.id ? (
          <div className={`${ADMIN_SURFACE_CLASS} p-4`}>
            <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_260px]">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.18em] text-amber-600 dark:text-amber-300">O que mudou</p>
                <h2 className="mt-1 text-base font-semibold text-slate-900 dark:text-slate-100">
                  Novidades da ultima sincronizacao
                </h2>
                <p className="mt-1 text-sm leading-6 text-slate-500 dark:text-slate-400">
                  Quando o Planalto altera, inclui ou remove artigo, essa area vira o resumo que o aluno ve na leitura.
                </p>
              </div>
              <div className="flex flex-col gap-2">
                <button
                  type="button"
                  onClick={() => void syncFromOfficialSource()}
                  disabled={isSyncingFromOfficial}
                  className={`${ADMIN_PRIMARY_BUTTON_CLASS} justify-center`}
                >
                  {isSyncingFromOfficial ? <Loader2 className="animate-spin" size={14} /> : <RefreshCcw size={14} />}
                  Sincronizar agora
                </button>
                <button type="button" onClick={() => void openUpdatesModal()} className={`${ADMIN_SECONDARY_BUTTON_CLASS} justify-center`}>
                  <History size={14} /> Historico completo
                </button>
              </div>
            </div>

            <div className="mt-4 grid gap-3 md:grid-cols-3">
              {recentLawUpdates.length > 0 ? recentLawUpdates.map((update) => (
                <div key={update.id} className="rounded-sm border border-amber-200 bg-amber-50 p-3 dark:border-amber-500/30 dark:bg-amber-500/10">
                  <p className="text-[10px] font-black uppercase tracking-[0.14em] text-amber-700 dark:text-amber-300">
                    {update.changeType === 'created' ? 'Novo' : update.changeType === 'revoked' ? 'Revogado' : 'Alterado'}
                  </p>
                  <p className="mt-2 text-sm font-black text-slate-900 dark:text-slate-100">{update.title}</p>
                  <p className="mt-1 line-clamp-2 text-xs font-medium leading-5 text-slate-600 dark:text-slate-300">{update.summary}</p>
                </div>
              )) : (
                <div className="rounded-sm border border-dashed border-slate-300 bg-slate-50 p-4 text-sm font-medium text-slate-500 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-400 md:col-span-3">
                  Nenhuma mudanca registrada ainda. Use a sincronizacao para comparar o texto oficial e preencher esta area automaticamente.
                </div>
              )}
            </div>
          </div>
        ) : null}

        <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_320px]">
          <main className="space-y-5">
            <EditorPanel
              title="Dados da lei"
              description="Identificacao, fonte oficial e metadados basicos da norma."
            >
              <div className="space-y-4">
                <div>
                  <CreatableTaxonomySelect
                    label="Materia"
                    options={lawMateriaOptions}
                    value={draft.areaId || ''}
                    placeholder="Selecionar ou criar materia"
                    createLabel="Criar materia"
                    loading={isCreatingMateria}
                    helper="Essa materia e a raiz que vincula a lei ao banco de questoes."
                    onChange={(value, option) => updateLawMateria(value, option)}
                    onCreate={createMateria}
                  />
                </div>
                <div>
                  <CreatableTaxonomySelect
                    label="Topico (nome da lei)"
                    options={lawTopicoOptions}
                    value={draft.lawTopicFilterId || ''}
                    selectedLabelOverride={String(draft.title || draft.shortTitle || '').trim() || undefined}
                    placeholder={draft.areaId ? 'Selecionar ou criar topico da lei' : 'Selecione a materia primeiro'}
                    createLabel="Criar topico"
                    disabled={!draft.areaId}
                    loading={isCreatingLawTopic}
                    helper="Hierarquia oficial: materia -> topico -> subtopico -> assunto."
                    onChange={(value) => updateLawTopico(value)}
                    onCreate={createLawTopico}
                  />
                </div>
                <div>
                  <FieldLabel>Nome da lei</FieldLabel>
                  <TextInput
                    value={draft.title || draft.shortTitle || ''}
                    onChange={(event) => updateLawTitle(event.target.value)}
                    placeholder="Lei Maria da Penha"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <FieldLabel>Sigla</FieldLabel>
                    <TextInput value={draft.acronym || ''} onChange={(event) => updateLawField('acronym', event.target.value)} placeholder="CP" />
                  </div>
                  <div>
                    <FieldLabel>Ano</FieldLabel>
                    <TextInput value={draft.year || ''} onChange={(event) => updateLawField('year', event.target.value)} placeholder="1940" />
                  </div>
                </div>
                <div>
                  <FieldLabel>Numero</FieldLabel>
                  <TextInput value={draft.number || ''} onChange={(event) => updateLawField('number', event.target.value)} placeholder="Decreto-Lei 2.848" />
                </div>
                <div>
                  <FieldLabel>Slug</FieldLabel>
                  <TextInput value={draft.slug || ''} onChange={(event) => updateLawField('slug', event.target.value)} placeholder="codigo-penal" />
                </div>
                <div>
                  <FieldLabel>Link oficial do Planalto</FieldLabel>
                  <div className="flex flex-col gap-2 sm:flex-row">
                    <TextInput
                      value={draft.officialUrl || ''}
                      onChange={(event) => updateLawField('officialUrl', event.target.value)}
                      placeholder="https://www.planalto.gov.br/..."
                      className="flex-1"
                    />
                    <button
                      type="button"
                      onClick={() => void importFromPlanalto()}
                      disabled={isImportingFromPlanalto}
                      className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-indigo-200 bg-indigo-50 px-4 text-[10px] font-black uppercase tracking-[0.16em] text-indigo-700 transition-colors hover:bg-indigo-100 disabled:opacity-60 dark:border-indigo-500/20 dark:bg-indigo-500/10 dark:text-indigo-300 dark:hover:bg-indigo-500/20"
                    >
                      {isImportingFromPlanalto ? <Loader2 className="animate-spin" size={15} /> : <Download size={15} />}
                      Importar
                    </button>
                  </div>
                </div>
                <div>
                  <FieldLabel>Preambulo (quando houver)</FieldLabel>
                  <TextArea
                    value={String(draft.preamble || '')}
                    onChange={(event) => updateLawField('preamble', event.target.value)}
                    placeholder="Ex.: Nos termos do art. 84, inciso IV, da Constituicao Federal..."
                  />
                </div>
                <div>
                  <FieldLabel>Ementa</FieldLabel>
                  <TextArea value={draft.ementa || ''} onChange={(event) => updateLawField('ementa', event.target.value)} />
                </div>
              </div>
            </EditorPanel>
            {activeArticle ? (
              <>
                <EditorPanel title={getArticleLabel(activeArticle)} description="Texto legal, vinculos editoriais e estrutura do artigo.">
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                    <div>
                      <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Texto legal</p>
                      <h2 className="mt-1 text-xl font-semibold text-slate-900 dark:text-slate-100">{getArticleLabel(activeArticle)}</h2>
                    </div>
                    <button
                      type="button"
                      onClick={() => removeArticle(activeArticle.id)}
                      className="inline-flex h-9 items-center justify-center gap-2 rounded-sm border border-red-300 bg-white px-3 text-xs font-medium text-red-700 transition-colors hover:bg-red-50 dark:border-red-800 dark:bg-slate-900 dark:text-red-300 dark:hover:bg-red-500/10"
                    >
                      <Trash2 size={14} /> Remover artigo
                    </button>
                  </div>

                  <div className="mt-5 grid gap-4 lg:grid-cols-3">
                    <div>
                      <FieldLabel>Numero do artigo</FieldLabel>
                      <TextInput value={activeArticle.number || ''} onChange={(event) => updateArticleField('number', event.target.value)} placeholder="1o, 121, 5o" />
                    </div>
                    <div className="lg:col-span-2">
                      <FieldLabel>Titulo interno do artigo (opcional)</FieldLabel>
                      <TextInput
                        value={String(activeArticle.title || '')}
                        onChange={(event) => updateArticleField('title', event.target.value)}
                        placeholder="Ex.: Anterioridade da lei / Lei penal no tempo"
                      />
                    </div>
                    <div className="lg:col-span-3">
                      <div className="rounded-sm border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950/60">
                        <div className="flex flex-col gap-1">
                          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Vinculo com questoes</p>
                          <p className="text-sm text-slate-500 dark:text-slate-400">
                            Neste artigo, selecione subtopico e assunto. Quando nao houver subtopico, vincule o assunto direto ao topico da lei.
                          </p>
                        </div>
                        <div className="mt-4 grid gap-4 lg:grid-cols-2">
                          <div>
                            <CreatableTaxonomySelect
                              label="Subtopico (titulo)"
                              options={articleSubtopicOptions}
                              value={activeArticle.subjectFilterId || ''}
                              selectedLabelOverride={String(getArticleSubtopicDisplayText(activeArticle) || '').trim() || undefined}
                              placeholder={draft.lawTopicFilterId ? 'Selecionar ou criar subtopico' : 'Selecione o topico da lei primeiro'}
                              createLabel="Criar subtopico"
                              disabled={!draft.lawTopicFilterId}
                              loading={isCreatingSubtopic}
                              onChange={(value, option) => {
                                updateActiveArticleTaxonomy({
                                  subjectFilterId: value || null,
                                  topicFilterId: null,
                                title: value ? String(option?.name || getArticleSubtopicDisplayText(activeArticle) || '') : '',
                                  chapter: '',
                                  resetChapterLabel: true,
                                });
                              }}
                              onCreate={createArticleSubtopic}
                            />
                          </div>
                          <div>
                            <CreatableTaxonomySelect
                              label="Assunto (capitulo)"
                              options={articleAssuntoOptions}
                              value={activeArticle.topicFilterId || ''}
                              selectedLabelOverride={String(getArticleAssuntoDisplayText(activeArticle) || '').trim() || undefined}
                              placeholder={draft.lawTopicFilterId ? 'Selecionar ou criar assunto' : 'Selecione o topico da lei primeiro'}
                              createLabel="Criar assunto"
                              disabled={!draft.lawTopicFilterId}
                              loading={isCreatingAssunto}
                              onChange={(value, option) => updateActiveArticleTaxonomy({
                                topicFilterId: value || null,
                                chapter: value ? String(option?.name || getArticleAssuntoDisplayText(activeArticle) || '') : '',
                              })}
                              onCreate={createArticleAssunto}
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                    <div className="lg:col-span-3">
                      <div className="rounded-sm border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-950/50">
                        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                          <div>
                            <p className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">Estrutura legal</p>
                            <p className="mt-1 text-sm font-semibold text-slate-900 dark:text-slate-100">
                              Caput, paragrafos, incisos, alineas e notas oficiais
                            </p>
                            <p className="mt-1 text-xs font-medium text-slate-500 dark:text-slate-400">
                              Organize o artigo por blocos. O texto final e montado automaticamente na ordem juridica.
                            </p>
                          </div>
                          <div className="flex flex-wrap gap-2">
                            {LEGAL_BLOCK_KINDS.map((kind) => (
                              <button
                                key={kind.value}
                                type="button"
                                onClick={() => addArticleBlock(kind.value)}
                                className="inline-flex h-8 items-center gap-1 rounded-sm border border-slate-300 bg-white px-2 text-[10px] font-black uppercase tracking-[0.12em] text-slate-600 transition-colors hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800"
                              >
                                <Plus size={12} /> {kind.label}
                              </button>
                            ))}
                          </div>
                        </div>

                        <div className="mt-4 space-y-3">
                          {(normalizeArticleBlocks(activeArticle) || []).map((block, index, list) => (
                            <div key={block.id} className="rounded-sm border border-slate-200 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-900/70">
                              <div className="grid gap-3 lg:grid-cols-[140px_minmax(0,1fr)_auto]">
                                <SelectInput
                                  value={block.kind}
                                  onChange={(event) => updateArticleBlock(block.id, { kind: event.target.value as LegalArticleBlock['kind'] })}
                                >
                                  {LEGAL_BLOCK_KINDS.map((option) => (
                                    <option key={option.value} value={option.value}>{option.label}</option>
                                  ))}
                                </SelectInput>
                                <TextInput
                                  value={block.label || ''}
                                  onChange={(event) => updateArticleBlock(block.id, { label: event.target.value })}
                                  placeholder="Rotulo (ex.: Art. 5o, § 1o, I, a)"
                                />
                                <div className="flex items-center justify-end gap-1">
                                  <button
                                    type="button"
                                    onClick={() => moveArticleBlock(block.id, 'up')}
                                    disabled={index === 0}
                                    className="inline-flex h-8 w-8 items-center justify-center rounded-sm border border-slate-300 bg-white text-xs font-black text-slate-500 transition-colors hover:bg-slate-100 disabled:opacity-40 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800"
                                    aria-label="Mover bloco para cima"
                                  >
                                    ↑
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => moveArticleBlock(block.id, 'down')}
                                    disabled={index >= list.length - 1}
                                    className="inline-flex h-8 w-8 items-center justify-center rounded-sm border border-slate-300 bg-white text-xs font-black text-slate-500 transition-colors hover:bg-slate-100 disabled:opacity-40 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800"
                                    aria-label="Mover bloco para baixo"
                                  >
                                    ↓
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => removeArticleBlock(block.id)}
                                    disabled={list.length <= 1}
                                    className="inline-flex h-8 w-8 items-center justify-center rounded-sm border border-rose-200 bg-rose-50 text-rose-700 transition-colors hover:bg-rose-100 disabled:opacity-40 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-300 dark:hover:bg-rose-500/20"
                                    aria-label="Remover bloco"
                                  >
                                    <Trash2 size={12} />
                                  </button>
                                </div>
                              </div>
                              <TextArea
                                className="mt-3 min-h-[110px]"
                                value={block.text || ''}
                                onChange={(event) => updateArticleBlock(block.id, { text: event.target.value })}
                                placeholder="Texto do bloco legal..."
                              />
                            </div>
                          ))}
                        </div>

                        <div className="mt-4 rounded-sm border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-900">
                          <p className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">Texto oficial consolidado (preview)</p>
                          <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-700 dark:text-slate-200">
                            {buildArticleTextFromBlocks(normalizeArticleBlocks(activeArticle)) || 'Sem conteudo preenchido.'}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                </EditorPanel>

                <EditorPanel title="Conteudo do artigo" description="IA, lote editorial e ajustes manuais do conteudo complementar.">
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                    <div>
                      <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Editorial e IA</p>
                      <h2 className="mt-1 text-xl font-semibold text-slate-900 dark:text-slate-100">Conteudo do artigo</h2>
                      <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Gere com IA e ajuste manualmente o conteudo editorial quando necessario.</p>
                    </div>
                    {activeEditorialSection === 'ai' ? (
                      <div className="flex flex-wrap gap-2">
                        {!isNew && draft.id ? (
                        <>
                          <button
                            type="button"
                            onClick={() => void startBatchGeneration()}
                            disabled={isBatchRunning || Boolean(aiLoading) || batchEligibleArticlesCount <= 0}
                            className="inline-flex h-10 items-center gap-2 rounded-xl border border-indigo-200 bg-indigo-50 px-4 text-[10px] font-black uppercase tracking-[0.14em] text-indigo-700 transition-colors hover:bg-indigo-100 disabled:opacity-60 dark:border-indigo-500/30 dark:bg-indigo-500/10 dark:text-indigo-300 dark:hover:bg-indigo-500/20"
                          >
                            {isBatchRunning ? <Loader2 className="animate-spin" size={14} /> : <Sparkles size={14} />}
                            {batchStartLabel}
                          </button>
                          <button
                            type="button"
                            onClick={() => void startBatchGeneration({ onlyMissingComments: false })}
                            disabled={isBatchRunning || Boolean(aiLoading) || !(draft.articles || []).length}
                            className="inline-flex h-10 items-center gap-2 rounded-xl border border-violet-200 bg-violet-50 px-4 text-[10px] font-black uppercase tracking-[0.14em] text-violet-700 transition-colors hover:bg-violet-100 disabled:opacity-60 dark:border-violet-500/30 dark:bg-violet-500/10 dark:text-violet-300 dark:hover:bg-violet-500/20"
                          >
                            {isBatchRunning ? <Loader2 className="animate-spin" size={14} /> : <Sparkles size={14} />}
                            Gerar comentarios de todos os artigos
                          </button>
                        </>
                        ) : null}
                        <button
                          type="button"
                          onClick={() => void generateAiBundle()}
                          disabled={Boolean(aiLoading) || isBatchRunning}
                          className="inline-flex h-10 items-center gap-2 rounded-xl bg-indigo-600 px-4 text-[10px] font-black uppercase tracking-[0.14em] text-white transition-colors hover:bg-indigo-700 disabled:opacity-60"
                        >
                          {aiLoading === 'bundle' ? <Loader2 className="animate-spin" size={14} /> : <Sparkles size={14} />}
                          Gerar pacote IA
                        </button>
                        {[
                          ['teacher-comment', 'Comentario'],
                          ['exam-tip', 'Macete'],
                          ['jurisprudence', 'Jurisprudencia'],
                          ['sumula', 'Sumula'],
                          ['doctrine', 'Doutrina'],
                        ].map(([kind, label]) => (
                          <button
                            key={kind}
                            type="button"
                            onClick={() => void generateWithAi(kind as Exclude<LegalAiGenerationKind, 'bundle'>)}
                            disabled={Boolean(aiLoading) || isBatchRunning}
                            className="inline-flex h-10 items-center gap-2 rounded-xl bg-slate-900 px-3 text-[10px] font-black uppercase tracking-[0.14em] text-white transition-colors hover:bg-slate-700 disabled:opacity-60 dark:bg-white dark:text-slate-950"
                          >
                            {aiLoading === kind ? <Loader2 className="animate-spin" size={14} /> : <Sparkles size={14} />}
                            {label}
                          </button>
                        ))}
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setActiveEditorialSection('ai')}
                        className={ADMIN_SECONDARY_BUTTON_CLASS}
                      >
                        <Sparkles size={14} /> Abrir IA e lote
                      </button>
                    )}
                  </div>

                  {aiProgress ? (
                    <div className="mt-5 rounded-sm border border-indigo-200 bg-indigo-50 p-4 dark:border-indigo-500/30 dark:bg-indigo-500/10">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <p className="text-[10px] font-black uppercase tracking-[0.16em] text-indigo-700 dark:text-indigo-300">Geracao IA</p>
                          <p className="mt-1 text-sm font-semibold text-slate-900 dark:text-slate-100">
                            {aiProgress.label} em andamento
                          </p>
                        </div>
                        <span className="text-sm font-black text-indigo-700 dark:text-indigo-200">{aiProgress.percent}%</span>
                      </div>
                      <div className="mt-3 h-2 overflow-hidden rounded-full bg-white dark:bg-slate-900">
                        <div
                          className="h-full rounded-full bg-indigo-600 transition-all duration-300"
                          style={{ width: `${aiProgress.percent}%` }}
                        />
                      </div>
                    </div>
                  ) : null}

                  <div className="mt-5 rounded-sm border border-slate-200 bg-slate-50 p-2 dark:border-slate-800 dark:bg-slate-950">
                    <div className="flex gap-2 overflow-x-auto pb-1">
                      {LEGAL_EDITORIAL_SECTIONS.map((section) => (
                        <button
                          key={section.key}
                          type="button"
                          onClick={() => setActiveEditorialSection(section.key)}
                          className={`flex min-w-[138px] flex-col rounded-sm border px-3 py-2 text-left transition-colors ${
                            activeEditorialSection === section.key
                              ? 'border-sky-600 bg-white text-sky-700 shadow-sm dark:border-sky-500 dark:bg-slate-900 dark:text-sky-300'
                              : 'border-transparent text-slate-500 hover:bg-white hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-900 dark:hover:text-slate-100'
                          }`}
                        >
                          <span className="flex items-center justify-between gap-2 text-xs font-black">
                            {section.label}
                            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] text-slate-500 dark:bg-slate-800 dark:text-slate-300">
                              {editorialSectionCounts[section.key]}
                            </span>
                          </span>
                          <span className="mt-1 line-clamp-2 text-[11px] font-medium leading-4 text-slate-500 dark:text-slate-400">
                            {section.description}
                          </span>
                        </button>
                      ))}
                    </div>
                    <p className="px-2 pt-2 text-xs font-medium text-slate-500 dark:text-slate-400">
                      {activeSectionMeta?.description}
                    </p>
                  </div>

                  {editorialCoverage && activeSectionMeta ? (
                    <div className="mt-5 rounded-sm border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
                      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                        <div>
                          <p className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">Cobertura editorial</p>
                          <h3 className="mt-1 text-sm font-black text-slate-900 dark:text-slate-100">
                            {editorialCoverage.covered}/{editorialCoverage.total} artigo(s) com {activeSectionMeta.label.toLowerCase()}
                          </h3>
                          <p className="mt-1 text-xs font-medium text-slate-500 dark:text-slate-400">
                            Visualize os pendentes e adicione um bloco vazio em massa quando precisar revisar artigo por artigo.
                            {editorialCoverage.skippedArticles > 0
                              ? ` ${editorialCoverage.skippedArticles} artigo(s) finais de expediente foram ignorados.`
                              : ''}
                          </p>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <button
                            type="button"
                            onClick={() => addEditorialPlaceholdersToArticles(activeEditorialSection, true)}
                            disabled={editorialCoverage.missingArticles.length === 0}
                            className="inline-flex h-9 items-center gap-2 rounded-sm border border-sky-200 bg-sky-50 px-3 text-[10px] font-black uppercase tracking-[0.14em] text-sky-700 transition-colors hover:bg-sky-100 disabled:opacity-50 dark:border-sky-500/30 dark:bg-sky-500/10 dark:text-sky-300"
                          >
                            <Plus size={13} /> Adicionar nos pendentes
                          </button>
                          <button
                            type="button"
                            onClick={() => addEditorialPlaceholdersToArticles(activeEditorialSection, false)}
                            disabled={editorialCoverage.total === 0}
                            className="inline-flex h-9 items-center gap-2 rounded-sm border border-slate-300 bg-white px-3 text-[10px] font-black uppercase tracking-[0.14em] text-slate-600 transition-colors hover:bg-slate-50 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-300 dark:hover:bg-slate-800"
                          >
                            <Plus size={13} /> Adicionar em todos
                          </button>
                        </div>
                      </div>

                      <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                        <div
                          className="h-full rounded-full bg-sky-700 transition-all"
                          style={{
                            width: editorialCoverage.total
                              ? `${Math.round((editorialCoverage.covered / editorialCoverage.total) * 100)}%`
                              : '0%',
                          }}
                        />
                      </div>

                      <div className="mt-3 flex flex-wrap gap-2">
                        {editorialCoverage.missingArticles.length > 0 ? editorialCoverage.missingArticles.slice(0, 18).map((article) => (
                          <button
                            key={article.id}
                            type="button"
                            onClick={() => setActiveArticleId(article.id)}
                            className="rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-[10px] font-black uppercase tracking-[0.12em] text-amber-700 hover:bg-amber-100 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-300"
                          >
                            {getArticleLabel(article)}
                          </button>
                        )) : (
                          <span className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-[10px] font-black uppercase tracking-[0.12em] text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-300">
                            Nenhum artigo pendente
                          </span>
                        )}
                        {editorialCoverage.missingArticles.length > 18 ? (
                          <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-[10px] font-black uppercase tracking-[0.12em] text-slate-500 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-300">
                            +{editorialCoverage.missingArticles.length - 18} pendente(s)
                          </span>
                        ) : null}
                      </div>
                    </div>
                  ) : null}

                  {activeEditorialSection === 'section-analysis' ? (
                    <div className="mt-5 rounded-sm border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
                      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                        <div>
                          <p className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">Analise por capitulo</p>
                          <h3 className="mt-1 text-sm font-black text-slate-900 dark:text-slate-100">
                            {sectionAnalysesCount}/{lawSections.length} capitulo(s) com analise
                          </h3>
                          <p className="mt-1 text-xs font-medium text-slate-500 dark:text-slate-400">
                            Gere a analise aprofundada por capitulo com base no intervalo de artigos e no conteudo editorial ja salvo.
                          </p>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <button
                            type="button"
                            onClick={() => void generateMissingSectionAnalyses()}
                            disabled={isGeneratingAllSectionAnalyses || lawSections.length === 0}
                            className="inline-flex h-9 items-center gap-2 rounded-sm border border-indigo-200 bg-indigo-50 px-3 text-[10px] font-black uppercase tracking-[0.14em] text-indigo-700 transition-colors hover:bg-indigo-100 disabled:opacity-50 dark:border-indigo-500/30 dark:bg-indigo-500/10 dark:text-indigo-300"
                          >
                            {isGeneratingAllSectionAnalyses ? <Loader2 className="animate-spin" size={13} /> : <Sparkles size={13} />}
                            Gerar faltantes
                          </button>
                          <button
                            type="button"
                            onClick={() => void generateMissingSectionAnalyses()}
                            disabled={isGeneratingAllSectionAnalyses || lawSections.length === 0}
                            className="inline-flex h-9 items-center gap-2 rounded-sm border border-slate-300 bg-white px-3 text-[10px] font-black uppercase tracking-[0.14em] text-slate-600 transition-colors hover:bg-slate-50 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-300 dark:hover:bg-slate-800"
                          >
                            {isGeneratingAllSectionAnalyses ? <Loader2 className="animate-spin" size={13} /> : <RefreshCcw size={13} />}
                            Regerar lista
                          </button>
                        </div>
                      </div>

                      <div className="mt-4 space-y-2">
                        {lawSections.map((section, index) => {
                          const sectionKey = section.sectionKey || section.id;
                          const savedEditorial = sectionEditorialsByKey.get(sectionKey);
                          const loading = sectionAnalysisLoadingKey === sectionKey;
                          const statusLabel = savedEditorial ? 'Pronto' : 'Pendente';
                          return (
                            <div key={section.id} className="rounded-xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-950">
                              <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                                <div className="min-w-0">
                                  <p className="text-[10px] font-black uppercase tracking-[0.16em] text-[#615fff]">
                                    Capitulo {String(index + 1).padStart(2, '0')}
                                  </p>
                                  <h4 className="mt-1 text-sm font-black text-slate-900 dark:text-slate-100">
                                    {section.title}
                                  </h4>
                                  <p className="mt-1 text-xs font-semibold text-slate-500 dark:text-slate-400">
                                    {formatSectionRange(section)} • {section.articles} artigo(s)
                                  </p>
                                  <p className="mt-2 text-xs leading-5 text-slate-600 dark:text-slate-300">
                                    {savedEditorial?.summary || 'Sem analise aprofundada salva ainda para este capitulo.'}
                                  </p>
                                </div>
                                <div className="flex flex-col items-start gap-2 lg:items-end">
                                  <span className={`inline-flex h-7 items-center rounded-full px-3 text-[10px] font-black uppercase tracking-[0.14em] ${
                                    savedEditorial
                                      ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300'
                                      : 'bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-300'
                                  }`}>
                                    {statusLabel}
                                  </span>
                                  <button
                                    type="button"
                                    onClick={() => void generateSectionAnalysis(section)}
                                    disabled={loading || isGeneratingAllSectionAnalyses}
                                    className="inline-flex h-9 items-center gap-2 rounded-lg border border-[#615fff]/20 bg-white px-3 text-[10px] font-black uppercase tracking-[0.14em] text-[#615fff] transition-colors hover:bg-[#615fff]/5 disabled:opacity-50 dark:border-[#615fff]/30 dark:bg-slate-900 dark:hover:bg-[#615fff]/10"
                                  >
                                    {loading ? <Loader2 className="animate-spin" size={13} /> : <Sparkles size={13} />}
                                    {savedEditorial ? 'Regerar' : 'Gerar'}
                                  </button>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                        {lawSections.length === 0 ? (
                          <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 p-4 text-sm font-medium text-slate-500 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-400">
                            Nenhum capitulo detectado para esta lei.
                          </div>
                        ) : null}
                      </div>
                    </div>
                  ) : null}

                  {activeEditorialSection === 'ai' && !isNew && draft.id ? (
                    <div className="mt-6 rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950">
                      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                        <div>
                          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Lote editorial</p>
                          <h3 className="mt-1 text-sm font-black text-slate-900 dark:text-slate-100">Status por artigo</h3>
                          <p className="mt-1 text-sm font-medium text-slate-500 dark:text-slate-400">
                            O lote processa artigo por artigo, salva o que passou pela validacao e permite reprocessar apenas as falhas.
                          </p>
                          <p className="mt-2 text-xs font-semibold text-slate-500 dark:text-slate-400">
                            Pausa e parada acontecem entre artigos. O que ja foi salvo permanece no banco.
                          </p>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <button
                            type="button"
                            onClick={toggleBatchPause}
                            disabled={!isBatchRunning}
                            className="inline-flex h-10 items-center gap-2 rounded-xl border border-sky-200 bg-sky-50 px-3 text-[10px] font-black uppercase tracking-[0.14em] text-sky-700 transition-colors hover:bg-sky-100 disabled:opacity-50 dark:border-sky-500/30 dark:bg-sky-500/10 dark:text-sky-300 dark:hover:bg-sky-500/20"
                          >
                            {isBatchPaused ? <CheckCircle2 size={14} /> : <RefreshCcw size={14} />}
                            {isBatchPaused ? 'Retomar lote' : 'Pausar lote'}
                          </button>
                          <button
                            type="button"
                            onClick={stopBatchRun}
                            disabled={!isBatchRunning}
                            className="inline-flex h-10 items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-3 text-[10px] font-black uppercase tracking-[0.14em] text-rose-700 transition-colors hover:bg-rose-100 disabled:opacity-50 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-300 dark:hover:bg-rose-500/20"
                          >
                            <AlertCircle size={14} />
                            Parar lote
                          </button>
                          <button
                            type="button"
                            onClick={() => void refreshBatchRun(batchRun?.id)}
                            disabled={isBatchRefreshing || isBatchRunning}
                            className="inline-flex h-10 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-[10px] font-black uppercase tracking-[0.14em] text-slate-600 transition-colors hover:bg-slate-100 disabled:opacity-60 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800"
                          >
                            {isBatchRefreshing ? <Loader2 className="animate-spin" size={14} /> : <RefreshCcw size={14} />}
                            Atualizar status
                          </button>
                          <button
                            type="button"
                            onClick={() => void retryFailedBatch()}
                            disabled={!batchRun || batchRun.failedArticles <= 0 || isBatchRunning}
                            className="inline-flex h-10 items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 text-[10px] font-black uppercase tracking-[0.14em] text-amber-700 transition-colors hover:bg-amber-100 disabled:opacity-50 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-300 dark:hover:bg-amber-500/20"
                          >
                            <RefreshCcw size={14} />
                            Reprocessar falhados
                          </button>
                        </div>
                      </div>

                      <label className="mt-4 flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm font-semibold text-slate-700 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200">
                        <input
                          type="checkbox"
                          className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                          checked={batchOnlyMissingComments}
                          onChange={(event) => setBatchOnlyMissingComments(event.target.checked)}
                          disabled={isBatchRunning}
                        />
                        Processar somente artigos sem comentario do professor
                        <span className="ml-auto rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.14em] text-slate-500 dark:bg-slate-800 dark:text-slate-300">
                          {batchEligibleArticlesCount} elegiveis
                        </span>
                      </label>

                      {batchRun ? (
                        <>
                          <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
                            <div className="rounded-xl border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-900">
                              <p className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">Processado</p>
                              <p className="mt-2 text-lg font-black text-slate-900 dark:text-slate-100">
                                {batchRun.processedArticles}/{batchRun.totalArticles}
                              </p>
                            </div>
                            <div className="rounded-xl border border-indigo-200 bg-indigo-50/80 p-3 dark:border-indigo-500/20 dark:bg-indigo-500/10">
                              <p className="text-[10px] font-black uppercase tracking-[0.16em] text-indigo-600 dark:text-indigo-300">Progresso</p>
                              <p className="mt-2 text-lg font-black text-indigo-700 dark:text-indigo-200">{batchProgressPercent}%</p>
                            </div>
                            <div className="rounded-xl border border-emerald-200 bg-emerald-50/80 p-3 dark:border-emerald-500/20 dark:bg-emerald-500/10">
                              <p className="text-[10px] font-black uppercase tracking-[0.16em] text-emerald-600 dark:text-emerald-300">Sucesso</p>
                              <p className="mt-2 text-lg font-black text-emerald-700 dark:text-emerald-200">{batchRun.successfulArticles}</p>
                            </div>
                            <div className="rounded-xl border border-amber-200 bg-amber-50/80 p-3 dark:border-amber-500/20 dark:bg-amber-500/10">
                              <p className="text-[10px] font-black uppercase tracking-[0.16em] text-amber-600 dark:text-amber-300">Parcial</p>
                              <p className="mt-2 text-lg font-black text-amber-700 dark:text-amber-200">{batchRun.partialArticles}</p>
                            </div>
                            <div className="rounded-xl border border-rose-200 bg-rose-50/80 p-3 dark:border-rose-500/20 dark:bg-rose-500/10">
                              <p className="text-[10px] font-black uppercase tracking-[0.16em] text-rose-600 dark:text-rose-300">Falha</p>
                              <p className="mt-2 text-lg font-black text-rose-700 dark:text-rose-200">{batchRun.failedArticles}</p>
                            </div>
                          </div>

                          <div className="mt-4 flex items-center justify-between gap-3">
                            <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                              {batchProgressPercent}% concluido
                              {isBatchPaused ? ' • pausado' : ''}
                              {isBatchRunning && !isBatchPaused ? ' • em execucao' : ''}
                            </p>
                            <span className={`inline-flex h-8 items-center rounded-full px-3 text-[10px] font-black uppercase tracking-[0.16em] ${getBatchStatusClasses(batchRun.status)}`}>
                              {batchRun.status === 'success' || batchRun.status === 'completed' ? <CheckCircle2 size={12} className="mr-1.5" /> : null}
                              {batchRun.status === 'failed' || batchRun.status === 'stopped' ? <AlertCircle size={12} className="mr-1.5" /> : null}
                              {batchRun.status === 'running' ? <Loader2 size={12} className="mr-1.5 animate-spin" /> : null}
                              {formatBatchStatusLabel(batchRun.status)}
                            </span>
                          </div>

                          <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800">
                            <div
                              className="h-full rounded-full bg-indigo-600 transition-all"
                              style={{
                                width: `${batchProgressPercent}%`,
                              }}
                            />
                          </div>

                          <div className="mt-4 max-h-[280px] space-y-2 overflow-y-auto pr-1">
                            {batchRun.items.map((item) => (
                              <div key={item.id} className="flex flex-col gap-2 rounded-xl border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-900 lg:flex-row lg:items-center lg:justify-between">
                                <div className="min-w-0">
                                  <p className="text-sm font-black text-slate-900 dark:text-slate-100">Art. {item.articleNumber || item.articleId}</p>
                                  <p className="mt-1 text-xs font-medium text-slate-500 dark:text-slate-400">
                                    A: {item.stageAStatus} • B: {item.stageBStatus} • C: {item.stageCStatus}
                                  </p>
                                  {item.errorMessage ? (
                                    <p className="mt-1 text-xs font-semibold text-rose-600 dark:text-rose-300">{item.errorMessage}</p>
                                  ) : null}
                                  {!item.errorMessage && item.warnings?.[0] ? (
                                    <p className="mt-1 text-xs font-semibold text-amber-600 dark:text-amber-300">{item.warnings[0]}</p>
                                  ) : null}
                                </div>
                                <div className={`inline-flex h-8 items-center rounded-full px-3 text-[10px] font-black uppercase tracking-[0.16em] ${
                                  item.status === 'success'
                                    ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300'
                                    : item.status === 'failed'
                                      ? 'bg-rose-50 text-rose-700 dark:bg-rose-500/10 dark:text-rose-300'
                                      : item.status === 'stopped'
                                        ? 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300'
                                      : item.status === 'running'
                                        ? 'bg-indigo-50 text-indigo-700 dark:bg-indigo-500/10 dark:text-indigo-300'
                                        : 'bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-300'
                                }`}>
                                  {item.status === 'success' ? <CheckCircle2 size={12} className="mr-1.5" /> : null}
                                  {item.status === 'failed' ? <AlertCircle size={12} className="mr-1.5" /> : null}
                                  {item.status === 'stopped' ? <AlertCircle size={12} className="mr-1.5" /> : null}
                                  {item.status === 'running' ? <Loader2 size={12} className="mr-1.5 animate-spin" /> : null}
                                  {item.status}
                                </div>
                              </div>
                            ))}
                          </div>
                        </>
                      ) : (
                        <div className="mt-4 rounded-xl border border-dashed border-slate-200 bg-white p-4 text-sm font-medium text-slate-500 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400">
                          Nenhum lote editorial registrado para esta lei ainda.
                        </div>
                      )}
                    </div>
                  ) : null}

                    <div className="mt-6 space-y-5">
                      {activeEditorialSection === 'teacher' ? (
                      <div className="space-y-3 rounded-2xl border border-slate-200 p-4 dark:border-slate-800">
                        <div className="flex items-center justify-between gap-3">
                          <h3 className="text-sm font-black text-slate-900 dark:text-slate-100">Comentarios de professor</h3>
                          <div className="flex flex-wrap items-center justify-end gap-2">
                            {!isNew && draft.id ? (
                              <button
                                type="button"
                                onClick={() => void startBatchGeneration({ onlyMissingComments: false })}
                                disabled={isBatchRunning || Boolean(aiLoading) || !(draft.articles || []).length}
                                className="rounded-lg border border-violet-200 bg-violet-50 px-3 py-2 text-[10px] font-black uppercase text-violet-700 transition-colors hover:bg-violet-100 disabled:opacity-60 dark:border-violet-500/30 dark:bg-violet-500/10 dark:text-violet-300 dark:hover:bg-violet-500/20"
                              >
                                Gerar em varios artigos
                              </button>
                            ) : null}
                            <button type="button" onClick={() => addTeacherComment()} className="rounded-lg bg-indigo-50 px-3 py-2 text-[10px] font-black uppercase text-indigo-600 dark:bg-indigo-500/10 dark:text-indigo-300">Adicionar</button>
                          </div>
                        </div>
                      {articleComments.map((comment) => (
                        <div key={comment.id} className="space-y-2 rounded-xl bg-slate-50 p-3 dark:bg-slate-950">
                          <TextInput value={comment.title} onChange={(event) => updateNestedItem('teacherComments', comment.id, 'title', event.target.value)} />
                          <TextArea value={comment.body} onChange={(event) => updateNestedItem('teacherComments', comment.id, 'body', event.target.value)} />
                          <button type="button" onClick={() => removeNestedItem('teacherComments', comment.id)} className="text-[10px] font-black uppercase text-red-600">Remover</button>
                        </div>
                      ))}
                    </div>
                      ) : null}

                    {activeEditorialSection === 'tips' ? (
                    <div className="space-y-3 rounded-2xl border border-slate-200 p-4 dark:border-slate-800">
                      <div className="flex items-center justify-between gap-3">
                        <h3 className="text-sm font-black text-slate-900 dark:text-slate-100">Macetes para prova</h3>
                        <button type="button" onClick={() => addExamTip()} className="rounded-lg bg-indigo-50 px-3 py-2 text-[10px] font-black uppercase text-indigo-600 dark:bg-indigo-500/10 dark:text-indigo-300">Adicionar</button>
                      </div>
                      {articleTips.map((tip) => (
                        <div key={tip.id} className="space-y-2 rounded-xl bg-slate-50 p-3 dark:bg-slate-950">
                          <TextInput value={tip.title} onChange={(event) => updateNestedItem('examTips', tip.id, 'title', event.target.value)} />
                          <TextArea value={tip.body} onChange={(event) => updateNestedItem('examTips', tip.id, 'body', event.target.value)} />
                          <button type="button" onClick={() => removeNestedItem('examTips', tip.id)} className="text-[10px] font-black uppercase text-red-600">Remover</button>
                        </div>
                      ))}
                    </div>
                    ) : null}

                    {activeEditorialSection === 'jurisprudence' ? (
                    <div className="space-y-3 rounded-2xl border border-slate-200 p-4 dark:border-slate-800">
                      <div className="flex items-center justify-between gap-3">
                        <h3 className="text-sm font-black text-slate-900 dark:text-slate-100">Jurisprudencia</h3>
                        <button type="button" onClick={() => addJurisprudence()} className="rounded-lg bg-indigo-50 px-3 py-2 text-[10px] font-black uppercase text-indigo-600 dark:bg-indigo-500/10 dark:text-indigo-300">Adicionar</button>
                      </div>
                      {(activeArticle.jurisprudenceNotes || []).map((note, index) => (
                        <div key={`${activeArticle.id}-juris-note-${index}`} className="rounded-xl border border-amber-200 bg-amber-50/80 p-3 text-sm font-semibold leading-6 text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200">
                          {note}
                        </div>
                      ))}
                      {articleJurisprudence.map((item) => (
                        <div key={item.id} className="space-y-2 rounded-xl bg-slate-50 p-3 dark:bg-slate-950">
                          <div className="grid grid-cols-2 gap-2">
                            <TextInput value={item.court} onChange={(event) => updateNestedItem('jurisprudence', item.id, 'court', event.target.value)} />
                            <TextInput value={item.precedentType} onChange={(event) => updateNestedItem('jurisprudence', item.id, 'precedentType', event.target.value)} />
                          </div>
                          <TextInput value={item.title} onChange={(event) => updateNestedItem('jurisprudence', item.id, 'title', event.target.value)} />
                          <TextArea value={item.summary} onChange={(event) => updateNestedItem('jurisprudence', item.id, 'summary', event.target.value)} />
                          <TextArea value={item.examImpact} onChange={(event) => updateNestedItem('jurisprudence', item.id, 'examImpact', event.target.value)} />
                          <button type="button" onClick={() => removeNestedItem('jurisprudence', item.id)} className="text-[10px] font-black uppercase text-red-600">Remover</button>
                        </div>
                      ))}
                    </div>
                    ) : null}

                    {activeEditorialSection === 'sumulas' ? (
                    <div className="space-y-3 rounded-2xl border border-slate-200 p-4 dark:border-slate-800">
                      <div className="flex items-center justify-between gap-3">
                        <h3 className="text-sm font-black text-slate-900 dark:text-slate-100">Sumulas</h3>
                        <button type="button" onClick={() => addSumula()} className="rounded-lg bg-indigo-50 px-3 py-2 text-[10px] font-black uppercase text-indigo-600 dark:bg-indigo-500/10 dark:text-indigo-300">Adicionar</button>
                      </div>
                      {articleSumulas.map((item) => (
                        <div key={item.id} className="space-y-2 rounded-xl bg-slate-50 p-3 dark:bg-slate-950">
                          <div className="grid grid-cols-2 gap-2">
                            <TextInput value={item.court} onChange={(event) => updateNestedItem('sumulas', item.id || '', 'court', event.target.value)} />
                            <TextInput value={item.number} onChange={(event) => updateNestedItem('sumulas', item.id || '', 'number', event.target.value)} />
                          </div>
                          <TextArea value={item.text} onChange={(event) => updateNestedItem('sumulas', item.id || '', 'text', event.target.value)} />
                          <button type="button" onClick={() => removeNestedItem('sumulas', item.id || '')} className="text-[10px] font-black uppercase text-red-600">Remover</button>
                        </div>
                      ))}
                    </div>
                    ) : null}

                    {activeEditorialSection === 'doctrine' ? (
                    <div className="space-y-3 rounded-2xl border border-slate-200 p-4 dark:border-slate-800">
                      <div className="flex items-center justify-between gap-3">
                        <h3 className="text-sm font-black text-slate-900 dark:text-slate-100">Doutrina</h3>
                        <button type="button" onClick={() => addDoctrine()} className="rounded-lg bg-indigo-50 px-3 py-2 text-[10px] font-black uppercase text-indigo-600 dark:bg-indigo-500/10 dark:text-indigo-300">Adicionar</button>
                      </div>
                      {(activeArticle.doctrine || []).map((item, index) => (
                        <div key={`${activeArticle.id}-doctrine-${index}`} className="space-y-2 rounded-xl bg-slate-50 p-3 dark:bg-slate-950">
                          <TextArea value={item} onChange={(event) => updateDoctrine(index, event.target.value)} />
                          <button type="button" onClick={() => removeDoctrine(index)} className="text-[10px] font-black uppercase text-red-600">Remover</button>
                        </div>
                      ))}
                    </div>
                    ) : null}

                    {activeEditorialSection === 'ai' ? (
                      <div className="rounded-sm border border-dashed border-slate-300 bg-slate-50 p-4 text-sm font-medium text-slate-500 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-400">
                        Use os botoes no topo desta aba para gerar conteudo. Depois revise cada resultado nas abas Professor, Macetes, Jurisprudencia, Sumulas e Doutrina.
                      </div>
                    ) : null}
                  </div>
                </EditorPanel>
              </>
            ) : (
              <section className={`${ADMIN_SURFACE_CLASS} p-10 text-center`}>
                <FileText className="mx-auto mb-3 text-slate-300 dark:text-slate-600" size={36} />
                <p className="text-sm font-black text-slate-900 dark:text-slate-100">Adicione um artigo para comecar.</p>
                <button type="button" onClick={addArticle} className={`mt-4 ${ADMIN_PRIMARY_BUTTON_CLASS}`}>
                  <Plus size={16} /> Novo artigo
                </button>
              </section>
            )}
          </main>

          <aside className="space-y-5">
            <EditorMetaBox title="Publicar">
              <div className="space-y-4">
                <div>
                  <FieldLabel>Status da lei</FieldLabel>
                  <SelectInput value={lawStatusValue} onChange={(event) => updateLawField('status', normalizeLawStatus(event.target.value))}>
                    <option value="active">Ativa</option>
                    <option value="monitoring">Em monitoramento</option>
                    <option value="partially_revoked">Parcialmente revogada</option>
                    <option value="revoked">Revogada</option>
                  </SelectInput>
                </div>
                <div className="space-y-2 text-sm text-slate-600 dark:text-slate-300">
                  <div className="flex items-start justify-between gap-3">
                    <span className="font-medium text-slate-500 dark:text-slate-400">Fonte</span>
                    <span className="text-right font-semibold text-slate-900 dark:text-slate-100">{draft.sourceName || 'Portal do Planalto'}</span>
                  </div>
                  <div className="flex items-start justify-between gap-3">
                    <span className="font-medium text-slate-500 dark:text-slate-400">Ultima sincronizacao</span>
                    <span className="text-right font-semibold text-slate-900 dark:text-slate-100">{lastSyncedLabel}</span>
                  </div>
                  <div className="flex items-start justify-between gap-3">
                    <span className="font-medium text-slate-500 dark:text-slate-400">Artigos</span>
                    <span className="text-right font-semibold text-slate-900 dark:text-slate-100">{draft.articles?.length || 0}</span>
                  </div>
                </div>
                <div className="flex flex-col gap-2">
                  {!isNew && draft.id ? (
                    <button type="button" onClick={() => void openUpdatesModal()} className={ADMIN_SECONDARY_BUTTON_CLASS}>
                      <History size={14} /> Ver atualizacoes
                    </button>
                  ) : null}
                  <button
                    type="button"
                    onClick={() => void saveLaw()}
                    disabled={isSaving}
                    className={`${ADMIN_PRIMARY_BUTTON_CLASS} justify-center`}
                  >
                    {isSaving ? <Loader2 className="animate-spin" size={14} /> : <Save size={14} />}
                    {isNew ? 'Publicar lei' : 'Atualizar lei'}
                  </button>
                </div>
              </div>
            </EditorMetaBox>

            <EditorMetaBox title="Artigos">
              <div className="space-y-3">
                <button type="button" onClick={addArticle} className={`${ADMIN_PRIMARY_BUTTON_CLASS} w-full justify-center`}>
                  <Plus size={14} /> Adicionar artigo
                </button>
                <div className="max-h-[540px] space-y-2 overflow-y-auto pr-1">
                  {(draft.articles || []).map((article) => (
                    <button
                      type="button"
                      key={article.id}
                      onClick={() => setActiveArticleId(article.id)}
                      className={`w-full rounded-sm border px-3 py-2 text-left transition-colors ${
                        article.id === activeArticle?.id
                          ? 'border-sky-700 bg-sky-50 text-sky-900 dark:border-sky-600 dark:bg-sky-950/40 dark:text-sky-100'
                          : 'border-slate-300 bg-white hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800'
                      }`}
                    >
                      <p className="text-sm font-semibold">{getArticleLabel(article)}</p>
                      <p className="mt-1 line-clamp-2 text-xs text-slate-500 dark:text-slate-400">{article.title || article.text || 'Sem texto cadastrado'}</p>
                    </button>
                  ))}
                </div>
              </div>
            </EditorMetaBox>
          </aside>
        </div>

        <div className={`${ADMIN_SURFACE_CLASS} p-5`}>
          <div className="flex items-start gap-3">
            <div className="rounded-sm bg-slate-100 p-3 text-sky-700 dark:bg-slate-800 dark:text-sky-300">
              <Bot size={18} />
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">Revisao editorial obrigatoria</p>
              <p className="mt-1 text-sm leading-6 text-slate-500 dark:text-slate-400">
                A IA acelera o rascunho, mas o conteudo publicado deve ser conferido contra fonte oficial, jurisprudencia real e criterio pedagogico antes de ficar disponivel aos alunos.
              </p>
            </div>
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
