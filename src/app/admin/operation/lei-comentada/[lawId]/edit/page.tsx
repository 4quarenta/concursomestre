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
  CalendarDays,
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
import { useToast } from '@providers/ToastProvider';
import { canAccessAdminPanel } from '@services/auth';
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

type ArticleEditorialCounts = {
  teacher: number;
  tips: number;
  jurisprudence: number;
  sumulas: number;
  doctrine: number;
  total: number;
};

type AdminLawSectionOverview = LawSection & {
  sectionKeyResolved: string;
  articleIds: string[];
  articles: number;
  primaryArticleId: string;
  articlesList: LawArticle[];
  counts: ArticleEditorialCounts;
  savedEditorial?: LawSectionEditorial;
  hasAnalysis: boolean;
};

type LegalAiGenerationKind = 'teacher-comment' | 'exam-tip' | 'jurisprudence' | 'sumula' | 'doctrine' | 'bundle';
type LegalEditorialSection = 'teacher' | 'tips' | 'jurisprudence' | 'sumulas' | 'doctrine' | 'section-analysis' | 'ai';

const LEGAL_BLOCK_KINDS: Array<{ value: LegalArticleBlock['kind']; label: string }> = [
  { value: 'caput', label: 'Caput' },
  { value: 'paragraph', label: 'Paragrafo' },
  { value: 'inciso', label: 'Inciso' },
  { value: 'alinea', label: 'Alinea' },
  { value: 'item', label: 'Item' },
  { value: 'note', label: 'Nota oficial' },
];

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

const buildEmptyArticle = (lawId = 'new', sectionId?: string | null): LawArticle => {
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
    assuntoFilterId: null,
    subjectFilterId: null,
    topicFilterId: null,
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
  sections: [{
    id: sectionId,
    lawId: 'new',
    slug: sectionId,
    title: 'Secao 1',
    displayTitle: 'Secao 1',
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
    title: String(section.displayTitle || section.title || `Secao ${index + 1}`),
    displayTitle: String(section.displayTitle || section.title || `Secao ${index + 1}`),
    articleCount: Number(section.articleCount || 0),
    sortOrder: Number(section.sortOrder ?? index),
  }));
  const fallbackSectionId = sections[0]?.id || createTempId('section');
  const articles = (law.articles || []).map((article, index) => {
    const nextId = String(article.id || createTempId(`article-${index + 1}`));
    const originalId = String(article.id || '');
    const articleInternalTitle = String(article.title || '').trim();
    if (originalId) {
      articleIdMap.set(originalId, nextId);
    }

    const hydratedArticle: LawArticle = {
      ...article,
      id: nextId,
      lawId: String(article.lawId || law.id || 'new'),
      sectionId: article.sectionId || fallbackSectionId,
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
      assuntoFilterId: article.assuntoFilterId ?? article.topicFilterId ?? null,
      subjectFilterId: null,
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
    sections: sections.length > 0 ? sections : [{
      id: fallbackSectionId,
      lawId: String(law.id || 'new'),
      slug: fallbackSectionId,
      title: 'Secao 1',
      displayTitle: 'Secao 1',
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

const hasFilledText = (value: unknown) => String(value || '').trim().length > 0;

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
  const [, setAiProgress] = React.useState<{ kind: string; label: string; percent: number } | null>(null);
  const [sectionAnalysisLoadingKey, setSectionAnalysisLoadingKey] = React.useState<string | null>(null);
  const [isGeneratingAllSectionAnalyses, setIsGeneratingAllSectionAnalyses] = React.useState(false);
  const [activeEditorialSection] = React.useState<LegalEditorialSection>('teacher');
  const [isUpdatesModalOpen, setIsUpdatesModalOpen] = React.useState(false);
  const [isUpdatesModalLoading, setIsUpdatesModalLoading] = React.useState(false);
  const [updatesModalItems, setUpdatesModalItems] = React.useState<LawUpdate[]>([]);
  const [updatesModalLogs, setUpdatesModalLogs] = React.useState<LegalSyncLog[]>([]);
  const hasOpenedUpdatesFromQueryRef = React.useRef(false);
  const [batchRun, setBatchRun] = React.useState<LegalEditorialBatchRun | null>(null);
  const [isBatchRunning, setIsBatchRunning] = React.useState(false);
  const [, setIsBatchRefreshing] = React.useState(false);
  const [, setIsBatchPaused] = React.useState(false);
  const [batchOnlyMissingComments] = React.useState(true);
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
    () => (draft?.sections || [])
      .map((section, index) => ({
        ...section,
        id: String(section.id || section.slug || `section-${index}`),
        lawId: String(section.lawId || draft?.id || ''),
        title: String(section.displayTitle || section.title || `Secao ${index + 1}`),
        displayTitle: String(section.displayTitle || section.title || `Secao ${index + 1}`),
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
        if (item.sectionKey) map.set(String(item.sectionKey), item);
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
      const sectionKeyResolved = section.id;
      const articlesList = articles.filter((article) => String(article.sectionId || '') === String(section.id));
      const articleIds = articlesList.map((article) => String(article.id));
      const savedEditorial = sectionEditorialsByKey.get(sectionKeyResolved);
      return {
        ...section,
        sectionKeyResolved,
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
    sectionOverviews.find((section) => section.id === activeSectionId || section.sectionKeyResolved === activeSectionId)
    || sectionOverviews.find((section) => section.articleIds.includes(String(activeArticleId || '')))
    || sectionOverviews[0]
    || null
  ), [activeArticleId, activeSectionId, sectionOverviews]);

  const selectSection = React.useCallback((section: AdminLawSectionOverview) => {
    setActiveSectionId(section.sectionKeyResolved);
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
      setActiveSectionId(section.sectionKeyResolved);
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
          subjectFilterId: null,
          assuntoFilterId: null,
          topicFilterId: null,
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
          subjectFilterId: null,
          assuntoFilterId: null,
          topicFilterId: null,
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
          subjectFilterId: null,
          assuntoFilterId: null,
          topicFilterId: null,
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
      return {
        ...current,
        lawTopicFilterId: String(lawTopicId),
        articles: (current.articles || []).map((article) => article),
        sections: (current.sections || []).map((section) => {
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
                topicFilterId: patch.assuntoFilterId || null,
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
        title: `Secao ${sectionIndex + 1}`,
        displayTitle: `Secao ${sectionIndex + 1}`,
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
      addToast(existing ? 'Subtopico existente selecionado.' : 'Subtopico criado e vinculado a secao.', existing ? 'info' : 'success');
    } catch (error: unknown) {
      addToast(getErrorMessage(error, 'Nao foi possivel criar o subtopico da secao.'), 'error');
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
      addToast(existing ? 'Assunto existente selecionado.' : 'Assunto criado e vinculado a secao.', existing ? 'info' : 'success');
    } catch (error: unknown) {
      addToast(getErrorMessage(error, 'Nao foi possivel criar o assunto da secao.'), 'error');
    } finally {
      setIsCreatingAssunto(false);
    }
  };

  const moveArticleToSection = (articleId: string, sectionId: string) => {
    setDraft((current) => {
      if (!current) return current;
      return {
        ...current,
        articles: (current.articles || []).map((article) => (
          String(article.id) === String(articleId)
            ? { ...article, sectionId }
            : article
        )),
      };
    });
  };

  const updateArticleField = (field: keyof LawArticle | 'subjectFilterId' | 'topicFilterId' | 'assuntoFilterId', value: unknown) => {
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
      const sectionId = activeSectionOverview?.id || current.sections?.[0]?.id || null;
      const article = buildEmptyArticle(current.id || 'new', sectionId);
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
    const editorialKey = String(sectionEditorial?.sectionId || sectionEditorial?.sectionKey || '');
    if (!sectionEditorial || !editorialKey) {
      return;
    }

    setDraft((current) => {
      if (!current) {
        return current;
      }

      const existing = current.sectionEditorials || [];
      const nextSectionEditorials = [
        ...existing.filter((item) => String(item.sectionId || item.sectionKey || '') !== editorialKey),
        sectionEditorial,
      ];

      return {
        ...current,
        sectionEditorials: nextSectionEditorials,
      };
    });
  }, []);

  const generateSectionAnalysis = React.useCallback(async (section: AdminLawSectionOverview | LawSection, options?: { silent?: boolean }) => {
    const currentDraft = draftRef.current;
    if (!currentDraft?.id || !/^\d+$/.test(String(currentDraft.id))) {
      addToastRef.current('Salve a lei antes de gerar a analise dos capitulos.', 'info');
      return null;
    }

    const sectionKey = section.id;
    setSectionAnalysisLoadingKey(sectionKey);

    try {
      const result = await legalCommentaryApiService.generateAdminEditorial({
        scope: 'section-analysis',
        lawId: String(currentDraft.id),
        law: currentDraft,
        section: {
          id: section.id,
          sectionId: section.id,
          sectionKey,
          sectionTitle: section.title,
          title: section.title,
          rangeLabel: formatSectionRange(section),
          fromArticle: section.fromArticle,
          toArticle: section.toArticle,
          articleIds: 'articleIds' in section ? section.articleIds : [],
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

    const existingKeys = new Set((currentDraft.sectionEditorials || []).map((item) => String(item.sectionId || item.sectionKey || '')));
    const pendingSections = lawSections.filter((section) => !existingKeys.has(section.id));
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

  const recentLawUpdates = (draft.updates || []).slice(0, 3);
  const lawStatusValue = String(draft.status || 'active');
  const lastSyncedLabel = draft.lastSyncedAt
    ? new Date(draft.lastSyncedAt).toLocaleString('pt-BR')
    : 'Ainda nao sincronizada';
  const activeArticleBlocks = activeArticle ? normalizeArticleBlocks(activeArticle) : [];
  const activeArticleHasSubject = Boolean(activeArticle?.assuntoFilterId || activeArticle?.topicFilterId || activeSectionOverview?.assuntoFilterId || getArticleAssuntoDisplayText(activeArticle));
  const activeArticleTextPreview = activeArticle
    ? buildArticleTextFromBlocks(activeArticleBlocks) || activeArticle.text || activeArticle.texto || 'Texto do artigo ainda nao preenchido.'
    : 'Selecione um artigo para visualizar o conteudo.';
  const selectedLawTitle = draft.title || draft.shortTitle || 'Lei sem titulo';
  const selectedLawNumber = draft.number ? `Lei no ${draft.number}` : selectedLawTitle;
  const pendingUpdatesCount = recentLawUpdates.length;
  const showPreparationToast = (message = 'Funcionalidade em preparacao.') => addToast(message, 'info');
  const toggleStructureSection = (sectionKey: string) => {
    setOpenStructureSectionIds((current) => {
      const next = new Set(current);
      if (next.has(sectionKey)) {
        next.delete(sectionKey);
      } else {
        next.add(sectionKey);
      }
      return next;
    });
  };
  const confirmAndRemoveArticle = (articleId: string) => {
    if (!articleId) return;
    const canRemove = typeof window === 'undefined'
      ? false
      : window.confirm('Tem certeza que deseja excluir este artigo? Esta acao remove o artigo do rascunho atual.');
    if (canRemove) {
      removeArticle(articleId);
      addToast('Artigo removido do rascunho.', 'success');
    }
  };
  const previewLaw = () => {
    if (!draft.slug) {
      showPreparationToast('Salve a lei com um slug antes de visualizar.');
      return;
    }
    window.open(`/lei-comentada/${draft.slug}`, '_blank', 'noopener,noreferrer');
  };
  const schedulePublication = () => {
    if (!scheduledDate || !scheduledTime) {
      addToast('Informe data e hora para agendar a publicacao.', 'info');
      return;
    }
    showPreparationToast('Agendamento sera conectado ao fluxo de publicacao.');
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
              <p className="mt-1 text-xs text-slate-500">{activeArticle.title || getArticleAssuntoDisplayText(activeArticle) || 'Artigo sem titulo interno'}</p>
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

          <div className="rounded-sm border border-slate-200 bg-slate-50 p-4">
            <p className="mb-3 text-sm font-semibold text-slate-900">Enriquecer este artigo com IA e conteudos juridicos</p>
            <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
              {[
                { key: 'teacher-comment', title: 'Comentario do Professor', text: 'Gere um comentario didatico e objetivo.', icon: MessageSquare },
                { key: 'sumula', title: 'Sumulas', text: 'Busque e resuma sumulas relacionadas.', icon: BookOpen },
                { key: 'doctrine', title: 'Doutrinas', text: 'Selecione e resuma doutrinas relevantes.', icon: FileText },
                { key: 'jurisprudence', title: 'Jurisprudencia', text: 'Traga julgados relevantes sobre o artigo.', icon: Scale },
                { key: 'exam-tip', title: 'Macete', text: 'Crie um macete para facilitar a memorizacao.', icon: Lightbulb },
              ].map((card) => {
                const Icon = card.icon;
                return (
                  <div key={card.key} className="flex min-h-[156px] flex-col rounded-sm border border-slate-200 bg-white p-4">
                    <div className="flex items-start gap-3">
                      <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-sm bg-[#f0f6fc] text-[#2271b1]">
                        <Icon size={18} />
                      </span>
                      <div className="min-w-0">
                        <h4 className="text-sm font-semibold leading-5 text-slate-900">{card.title}</h4>
                        <p className="mt-1 text-xs leading-5 text-slate-500">{card.text}</p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => void generateWithAi(card.key as Exclude<LegalAiGenerationKind, 'bundle'>)}
                      disabled={Boolean(aiLoading) || isBatchRunning}
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
  const renderSectionAnalysisPanel = (section: AdminLawSectionOverview) => {
    const sectionAnalysis = section.savedEditorial || null;
    const isSectionAnalysisLoading = sectionAnalysisLoadingKey === section.sectionKeyResolved;
    const rangeLabel = formatSectionRange(section);
    const sectionTokens = [...(sectionAnalysis?.macetes || []), ...(sectionAnalysis?.keywords || [])];

    return (
      <section className="rounded-sm border border-slate-200 bg-white">
        <div className="flex flex-col gap-3 border-b border-slate-200 bg-[#f8fbff] px-3 py-3 md:flex-row md:items-start md:justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-sm font-semibold text-slate-900">Analise detalhada da secao</h3>
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
        <div className="space-y-3 p-3">
          {sectionAnalysis ? (
            <>
              <div className="rounded-sm border border-slate-200 bg-white p-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Resumo da analise</p>
                <p className="mt-2 text-sm leading-6 text-slate-700">{sectionAnalysis.summary}</p>
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                <div className="rounded-sm border border-slate-200 bg-white p-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Como cai em prova</p>
                  <ul className="mt-2 space-y-1 text-sm leading-5 text-slate-700">
                    {(sectionAnalysis.examFocus || []).slice(0, 3).map((item) => (
                      <li key={item}>- {item}</li>
                    ))}
                    {(sectionAnalysis.examFocus || []).length === 0 ? <li>Nenhum foco registrado.</li> : null}
                  </ul>
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
            </>
          ) : (
            <div className="rounded-sm border border-dashed border-slate-300 bg-white p-4 text-sm leading-6 text-slate-600">
              Esta secao ainda nao possui analise propria. Gere uma analise aqui para orientar o aluno pelo conjunto de artigos, com pegadinhas, pontos de prova e conexoes relevantes.
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
          const sectionKey = section.sectionKeyResolved;
          const isActiveSection = activeSectionOverview?.sectionKeyResolved === sectionKey;
          const isOpen = openStructureSectionIds.has(sectionKey) || isActiveSection;
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
                  toggleStructureSection(sectionKey);
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
                        <FieldLabel>Nome exibido da secao</FieldLabel>
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
                        helper="Classificacao da secao pelo titulo da lei."
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
                        helper="Artigos desta secao herdam este assunto."
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
                    const hasSubject = Boolean(article.assuntoFilterId || article.topicFilterId || section.assuntoFilterId || getArticleAssuntoDisplayText(article));
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
                                  title="Mover artigo para outra secao"
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
            Nenhuma secao detectada ainda. Importe uma lei ou adicione artigos manualmente.
          </div>
        ) : null}
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <button type="button" onClick={addSection} className="inline-flex h-8 items-center gap-1 rounded-sm border border-slate-300 bg-white px-3 text-xs font-medium text-slate-700 hover:bg-slate-50">
          <Plus size={13} /> Secao
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
                <div className="grid gap-5 p-4 lg:grid-cols-[minmax(0,1fr)_420px]">
                  <div className="space-y-3">
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
                    <div className="rounded-sm border border-[#72aee6] bg-[#f0f6fc] px-3 py-2 text-sm text-slate-700">
                      <span className="font-semibold text-[#135e96]">Dica:</span> A importacao preserva a hierarquia da lei, incluindo titulos, capitulos, secoes e artigos.
                    </div>
                  </div>
                  <div className="flex flex-col justify-between gap-4">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wide text-slate-700">O que sera importado automaticamente</p>
                      <ul className="mt-3 space-y-2 text-sm text-slate-600">
                        {['Texto completo da lei', 'Todos os artigos', 'Incisos, alineas, paragrafos, caput', 'Estrutura de capitulos/titulos/secoes'].map((item) => (
                          <li key={item} className="flex items-center gap-2">
                            <CheckCircle2 size={15} className="text-emerald-600" /> {item}
                          </li>
                        ))}
                      </ul>
                    </div>
                    <div className="flex flex-col items-start gap-2 sm:items-end">
                      <button
                        type="button"
                        onClick={() => void importFromPlanalto()}
                        disabled={isImportingFromPlanalto}
                        className="inline-flex h-10 items-center justify-center gap-2 rounded-sm bg-[#2271b1] px-5 text-sm font-semibold text-white hover:bg-[#135e96] disabled:opacity-60"
                      >
                        {isImportingFromPlanalto ? <Loader2 className="animate-spin" size={16} /> : <Download size={16} />}
                        Importar Lei
                      </button>
                      <button type="button" onClick={() => showPreparationToast('Use uma URL publica do Planalto no campo ao lado.')} className="text-xs font-medium text-[#2271b1] hover:underline">
                        Ver exemplo de URL
                      </button>
                    </div>
                  </div>
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
                    <span className="font-semibold">Como funciona:</span> {'Lei = Materia + Topico. Secao = Subtopico + Assunto. Artigos herdam a secao.'}
                  </div>
                </div>
              </section>

              <section className="rounded-sm border border-slate-300 bg-white shadow-sm">
                <div className="border-b border-slate-200 px-4 py-3">
                  <h2 className="text-base font-semibold text-slate-900">3. Estrutura da Lei</h2>
                  <p className="mt-1 text-xs text-slate-600">
                    Organize secoes e artigos em uma arvore ampla, sem dividir espaco com o editor.
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
                    <button type="button" onClick={() => void saveLaw()} disabled={isSaving} className="h-8 flex-1 rounded-sm border border-slate-300 bg-white px-3 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60">
                      Salvar como rascunho
                    </button>
                    <button type="button" onClick={previewLaw} className="h-8 rounded-sm border border-slate-300 bg-white px-3 text-xs font-medium text-slate-700 hover:bg-slate-50">
                      <Eye size={13} className="mr-1 inline" /> Visualizar
                    </button>
                  </div>
                  <div className="space-y-3 text-sm text-slate-700">
                    <p>Status: <strong>{lawStatusValue === 'active' ? 'Publicado' : 'Rascunho'}</strong> <button type="button" onClick={() => showPreparationToast()} className="text-[#2271b1] hover:underline">Editar</button></p>
                    <p>Visibilidade: <strong>Publico</strong> <button type="button" onClick={() => showPreparationToast()} className="text-[#2271b1] hover:underline">Editar</button></p>
                    <p>Publicado em: <strong>Imediatamente</strong> <button type="button" onClick={() => showPreparationToast()} className="text-[#2271b1] hover:underline">Editar</button></p>
                  </div>
                </div>
                <div className="flex items-center justify-between border-t border-slate-200 bg-slate-50 px-4 py-3">
                  <button type="button" onClick={() => showPreparationToast('Movimento para lixeira em preparacao.')} className="text-xs font-medium text-red-600 hover:underline">Mover para lixeira</button>
                  <button type="button" onClick={() => void saveLaw()} disabled={isSaving} className="inline-flex h-9 items-center gap-2 rounded-sm bg-[#2271b1] px-4 text-sm font-semibold text-white hover:bg-[#135e96] disabled:opacity-60">
                    {isSaving ? <Loader2 className="animate-spin" size={14} /> : <Save size={14} />}
                    {isNew ? 'Publicar' : 'Atualizar'}
                  </button>
                </div>
              </section>

              <section className="rounded-sm border border-slate-300 bg-white shadow-sm">
                <h2 className="border-b border-slate-200 px-4 py-3 text-sm font-semibold text-slate-900">Agendar Publicacao</h2>
                <div className="space-y-3 p-4">
                  <p className="text-xs text-slate-500">Publicar em:</p>
                  <div className="grid grid-cols-[1fr_96px] gap-2">
                    <TextInput value={scheduledDate} onChange={(event) => setScheduledDate(event.target.value)} placeholder="dd/mm/aaaa" />
                    <TextInput value={scheduledTime} onChange={(event) => setScheduledTime(event.target.value)} placeholder="--:--" />
                  </div>
                  <button type="button" onClick={schedulePublication} className="text-sm font-medium text-[#2271b1] hover:underline">
                    <CalendarDays size={14} className="mr-1 inline" /> Agendar
                  </button>
                </div>
              </section>

              <section className="rounded-sm border border-slate-300 bg-white shadow-sm">
                <h2 className="border-b border-slate-200 px-4 py-3 text-sm font-semibold text-slate-900">Atualizacoes da Lei</h2>
                <div className="space-y-3 p-4 text-sm text-slate-700">
                  <p>Verifique se ha atualizacoes no site do Planalto e importe as alteracoes.</p>
                  <p>Ultima verificacao: <strong>{lastSyncedLabel}</strong></p>
                  <button type="button" onClick={() => void syncFromOfficialSource()} disabled={isSyncingFromOfficial || isNew} className="inline-flex h-9 w-full items-center justify-center gap-2 rounded-sm border border-[#2271b1] bg-white px-3 text-sm font-semibold text-[#2271b1] hover:bg-[#f0f6fc] disabled:opacity-60">
                    {isSyncingFromOfficial ? <Loader2 className="animate-spin" size={14} /> : <RefreshCcw size={14} />}
                    Verificar atualizacoes
                  </button>
                  <div className="rounded-sm border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600">
                    {pendingUpdatesCount > 0 ? `${pendingUpdatesCount} atualizacao(oes) recente(s) registrada(s).` : 'Nenhuma alteracao carregada nesta sessao.'}
                  </div>
                  <button type="button" onClick={() => void syncFromOfficialSource()} disabled={isSyncingFromOfficial || isNew} className="inline-flex h-9 w-full items-center justify-center gap-2 rounded-sm bg-slate-200 px-3 text-sm font-semibold text-slate-600 disabled:opacity-60">
                    Importar alteracoes encontradas
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
                  <p>Gere uma analise completa da lei, com resumo, comentarios do professor e pontos importantes.</p>
                  <button type="button" onClick={() => void generateMissingSectionAnalyses()} disabled={isGeneratingAllSectionAnalyses} className="inline-flex h-9 w-full items-center justify-center gap-2 rounded-sm bg-[#2271b1] px-3 text-sm font-semibold text-white hover:bg-[#135e96] disabled:opacity-60">
                    {isGeneratingAllSectionAnalyses ? <Loader2 className="animate-spin" size={14} /> : <Sparkles size={14} />}
                    Gerar analise da Lei
                  </button>
                  <p className="text-xs text-slate-500">Sera criado conteudo global por secao, disponivel para os artigos relacionados.</p>
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
