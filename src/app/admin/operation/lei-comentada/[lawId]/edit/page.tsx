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
import type {
  ArticleExamTip,
  ArticleJurisprudence,
  LawArticle,
  LawDetail,
  LawUpdate,
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

type LegalAiGenerationKind = 'teacher-comment' | 'exam-tip' | 'jurisprudence' | 'sumula' | 'doctrine' | 'bundle';
type LegalEditorialSection = 'teacher' | 'tips' | 'jurisprudence' | 'sumulas' | 'doctrine' | 'ai';

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
  { key: 'ai', label: 'IA e lote', description: 'Geracao assistida e acompanhamento por artigo.' },
];

const createTempId = (prefix: string) => `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;

const normalizeParam = (value?: string | string[]) => Array.isArray(value) ? value[0] : value;

const normalizeTaxonomyText = (value: unknown) => String(value || '')
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .toLowerCase()
  .trim();

const slugifyTaxonomy = (value: string) => normalizeTaxonomyText(value)
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/^-+|-+$/g, '');

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

const splitKnowledgeTaxonomies = (taxonomies: any) => ({
  subjects: (taxonomies.subjects || []) as TaxonomyOption[],
  topics: ((taxonomies.subjectTopics?.length
    ? taxonomies.subjectTopics
    : (taxonomies.topics || []).filter((item: any) => item.taxonomyLevel === 'topico')) || []) as TaxonomyOption[],
  specificSubjects: ((taxonomies.specificSubjects?.length
    ? taxonomies.specificSubjects
    : (taxonomies.topics || []).filter((item: any) => item.taxonomyLevel === 'assunto')) || []) as TaxonomyOption[],
});

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

const buildEmptyLaw = (areas: LegalArea[], subjects: TaxonomyOption[] = []): AdminLawDraft => {
  const defaultSubject = subjects[0];
  const defaultArea = buildLegalAreaFromTaxonomy(defaultSubject, areas[0]) || areas[0];

  return {
  id: '',
  slug: '',
  areaId: defaultSubject ? String(defaultSubject.id) : areas[0]?.id || '',
  title: '',
  shortTitle: '',
  number: '',
  year: '',
  date: '',
  aliases: [],
  description: '',
  summary: '',
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
  area: defaultArea,
  articles: [buildEmptyArticle()],
  teacherComments: [],
  jurisprudence: [],
  examTips: [],
  userComments: [],
  updates: [],
  sumulas: [],
  };
};

const resolveLawMateria = (law: Partial<LawDetail>, areas: LegalArea[], subjects: TaxonomyOption[]) => {
  const rawAreaId = String(law.areaId || law.area?.id || areas[0]?.id || '');
  const directSubject = subjects.find((subject) => String(subject.id) === rawAreaId);
  if (directSubject) {
    return {
      areaId: String(directSubject.id),
      area: buildLegalAreaFromTaxonomy(directSubject, law.area || areas[0]),
    };
  }

  const lawAreaName = normalizeTaxonomyText(law.area?.name || '');
  const matchedByName = lawAreaName
    ? subjects.find((subject) => {
      const subjectName = normalizeTaxonomyText(subject.name);
      return subjectName === lawAreaName || subjectName.includes(lawAreaName) || lawAreaName.includes(subjectName);
    })
    : null;

  if (matchedByName) {
    return {
      areaId: String(matchedByName.id),
      area: buildLegalAreaFromTaxonomy(matchedByName, law.area || areas[0]),
    };
  }

  return {
    areaId: rawAreaId,
    area: areas.find((area) => String(area.id) === rawAreaId) || law.area || areas[0],
  };
};

const hydrateDraftFromLaw = (law: Partial<LawDetail>, areas: LegalArea[], subjects: TaxonomyOption[] = []): AdminLawDraft => {
  const articleIdMap = new Map<string, string>();
  const articles = (law.articles || []).map((article, index) => {
    const nextId = String(article.id || createTempId(`article-${index + 1}`));
    const originalId = String(article.id || '');
    if (originalId) {
      articleIdMap.set(originalId, nextId);
    }

    return {
      ...article,
      id: nextId,
      lawId: String(article.lawId || law.id || 'new'),
      slug: article.slug || `art-${index + 1}`,
      blocks: (article.blocks || []).map((block, blockIndex) => ({
        ...block,
        id: block.id || `${nextId}-block-${blockIndex + 1}`,
      })),
      paragraphs: article.paragraphs || [],
      jurisprudenceNotes: article.jurisprudenceNotes || [],
      syllabi: article.syllabi || [],
      doctrine: article.doctrine || [],
      hierarchy: article.hierarchy || {},
      relatedQuestionCount: article.relatedQuestionCount || 0,
      subjectFilterId: article.subjectFilterId ?? null,
      topicFilterId: article.topicFilterId ?? null,
    };
  });

  const resolveArticleId = (articleId?: string | null) => {
    if (!articleId) return '';
    return articleIdMap.get(String(articleId)) || String(articleId);
  };

  const resolvedMateria = resolveLawMateria(law, areas, subjects);

  return {
    ...law,
    id: String(law.id || ''),
    areaId: resolvedMateria.areaId,
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
                {selectedOption?.name || selectedValue}
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
                  {createLabel} "{inputValue.trim()}"
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

const sanitizeInlineText = (value: string) => String(value || '')
  .replace(/\s+/g, ' ')
  .replace(/\s+([,.;:!?])/g, '$1')
  .trim();

const stripAiLead = (value: string) => {
  let nextValue = sanitizeInlineText(value);
  const patterns = [
    /^prezad[oa]s?\s+alun[oa]s?[,:!.\-\s]*/i,
    /^car[oa]s?\s+alun[oa]s?[,:!.\-\s]*/i,
    /^ol[aá][,:!.\-\s]*/i,
    /^vamos\s+(analisar|ao\s+que\s+importa|direto\s+ao\s+ponto)[,:!.\-\s]*/i,
    /^aten[cç][aã]o[,:!.\-\s]*/i,
  ];

  patterns.forEach((pattern) => {
    nextValue = nextValue.replace(pattern, '');
  });

  return nextValue.trim();
};

const splitSentences = (value: string) => sanitizeInlineText(value)
  .split(/(?<=[.!?])\s+/)
  .map((item) => item.trim())
  .filter(Boolean);

const limitSentences = (value: string, maxSentences: number) => {
  const sentences = splitSentences(stripAiLead(value));
  return sanitizeInlineText(sentences.slice(0, maxSentences).join(' '));
};

const normalizeShortText = (value: string, maxLength: number) => {
  const cleanValue = stripAiLead(value);
  if (cleanValue.length <= maxLength) {
    return cleanValue;
  }

  return `${cleanValue.slice(0, Math.max(0, maxLength - 3)).trimEnd()}...`;
};

const normalizeStringList = (values?: string[], limit = 3) => (Array.isArray(values) ? values : [])
  .map((item) => normalizeShortText(item, 120))
  .filter(Boolean)
  .slice(0, limit);

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

const formatDoctrineEntry = (entry: { author?: string; work?: string; text?: string }) => {
  const text = normalizeShortText(entry.text || '', 220);
  if (!text) return '';

  const author = sanitizeInlineText(entry.author || '');
  const work = sanitizeInlineText(entry.work || '');
  const prefix = author ? `${author}: ` : '';
  const suffix = work ? ` (${work})` : '';

  return `${prefix}${text}${suffix}`.trim();
};

const AdminLegalCommentaryEditPage = () => {
  const params = useParams<{ lawId?: string | string[] }>();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { currentUser, isLoading: isAuthLoading } = useAuth();
  const { addToast } = useToast();
  const lawId = normalizeParam(params.lawId) || 'new';
  const isNew = lawId === 'new';
  const shouldOpenUpdatesFromQuery = searchParams.get('updates') === '1';
  const [areas, setAreas] = React.useState<LegalArea[]>([]);
  const [subjects, setSubjects] = React.useState<TaxonomyOption[]>([]);
  const [topics, setTopics] = React.useState<TaxonomyOption[]>([]);
  const [specificSubjects, setSpecificSubjects] = React.useState<TaxonomyOption[]>([]);
  const [draft, setDraft] = React.useState<AdminLawDraft | null>(null);
  const draftRef = React.useRef<AdminLawDraft | null>(null);
  const [activeArticleId, setActiveArticleId] = React.useState('');
  const [isLoading, setIsLoading] = React.useState(true);
  const [isSaving, setIsSaving] = React.useState(false);
  const [isImportingFromPlanalto, setIsImportingFromPlanalto] = React.useState(false);
  const [isSyncingFromOfficial, setIsSyncingFromOfficial] = React.useState(false);
  const [isCreatingMateria, setIsCreatingMateria] = React.useState(false);
  const [isCreatingTopic, setIsCreatingTopic] = React.useState(false);
  const [isCreatingAssunto, setIsCreatingAssunto] = React.useState(false);
  const [aiLoading, setAiLoading] = React.useState<string | null>(null);
  const [aiProgress, setAiProgress] = React.useState<{ kind: string; label: string; percent: number } | null>(null);
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

  React.useEffect(() => {
    if (!isAuthLoading && !canAccessAdminPanel(currentUser)) {
      router.replace('/');
    }
  }, [currentUser, isAuthLoading, router]);

  React.useEffect(() => {
    draftRef.current = draft;
  }, [draft]);

  React.useEffect(() => {
    let isCurrent = true;
    setIsLoading(true);

    Promise.all([
      legalCommentaryApiService.getAdminDetail(lawId),
      filtersService.listTaxonomies(),
    ])
      .then(([payload, taxonomies]) => {
        if (!isCurrent) return;

        const nextAreas = payload.areas || [];
        const knowledgeTaxonomies = splitKnowledgeTaxonomies(taxonomies);
        const nextLaw = payload.law
          ? hydrateDraftFromLaw(payload.law, nextAreas, knowledgeTaxonomies.subjects)
          : buildEmptyLaw(nextAreas, knowledgeTaxonomies.subjects);

        setAreas(nextAreas);
        setSubjects(knowledgeTaxonomies.subjects);
        setTopics(knowledgeTaxonomies.topics);
        setSpecificSubjects(knowledgeTaxonomies.specificSubjects);
        setDraft(nextLaw);
        setActiveArticleId(nextLaw.articles?.[0]?.id || '');
      })
      .catch(() => {
        if (isCurrent) addToast('Nao foi possivel carregar o editor da lei.', 'error');
      })
      .finally(() => {
        if (isCurrent) setIsLoading(false);
      });

    return () => {
      isCurrent = false;
    };
  }, [addToast, lawId]);

  React.useEffect(() => {
    if (!draft?.id || isNew) {
      setBatchRun(null);
      return;
    }

    let active = true;
    setIsBatchRefreshing(true);

    legalCommentaryApiService.getAdminEditorialBatchStatus({ lawId: String(draft.id) })
      .then((run) => {
        if (active) {
          setBatchRun(run);
        }
      })
      .catch(() => {
        if (active) {
          setBatchRun(null);
        }
      })
      .finally(() => {
        if (active) {
          setIsBatchRefreshing(false);
        }
      });

    return () => {
      active = false;
    };
  }, [draft?.id, isNew]);

  const activeArticle = React.useMemo(
    () => draft?.articles?.find((article) => article.id === activeArticleId) || draft?.articles?.[0] || null,
    [activeArticleId, draft?.articles],
  );

  const lawMateriaOptions = React.useMemo(() => {
    const options = [...subjects];
    const currentMateriaId = String(draft?.areaId || '');
    const hasCurrentMateria = currentMateriaId && options.some((subject) => String(subject.id) === currentMateriaId);

    if (currentMateriaId && !hasCurrentMateria) {
      options.unshift({
        id: currentMateriaId,
        name: draft?.area?.name ? `${draft.area.name} (area antiga)` : 'Materia atual sem taxonomia',
      });
    }

    return options;
  }, [draft?.area?.name, draft?.areaId, subjects]);

  const articleTopicOptions = React.useMemo(() => {
    const materiaId = String(draft?.areaId || '');
    if (!materiaId) return topics;

    return topics.filter((topic) => (
      !topic.parentId
      || String(topic.parentId) === materiaId
      || String(topic.rootSubjectId || '') === materiaId
    ));
  }, [draft?.areaId, topics]);

  const articleAssuntoOptions = React.useMemo(() => {
    if (!activeArticle?.subjectFilterId) return [];

    return specificSubjects.filter((subject) => String(subject.parentId || '') === String(activeArticle.subjectFilterId));
  }, [activeArticle?.subjectFilterId, specificSubjects]);

  const reloadKnowledgeTaxonomies = React.useCallback(async () => {
    const taxonomies = await filtersService.listTaxonomies();
    const knowledgeTaxonomies = splitKnowledgeTaxonomies(taxonomies);
    setSubjects(knowledgeTaxonomies.subjects);
    setTopics(knowledgeTaxonomies.topics);
    setSpecificSubjects(knowledgeTaxonomies.specificSubjects);
    return knowledgeTaxonomies;
  }, []);

  const updateActiveArticleTaxonomy = React.useCallback((patch: { subjectFilterId?: string | null; topicFilterId?: string | null }) => {
    setDraft((current) => {
      if (!current) return current;
      const nextArticles = (current.articles || []).map((article) => (
        article.id === activeArticleId ? { ...article, ...patch } : article
      ));
      return { ...current, articles: nextArticles };
    });
  }, [activeArticleId]);

  const updateLawMateria = (subjectId: string, explicitSubject?: TaxonomyOption) => {
    if (!subjectId) {
      setDraft((current) => current ? {
        ...current,
        areaId: '',
        articles: (current.articles || []).map((article) => ({
          ...article,
          subjectFilterId: null,
          topicFilterId: null,
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
        area: buildLegalAreaFromTaxonomy(subject, current.area) || current.area,
        articles: (current.articles || []).map((article) => {
          const selectedTopic = topics.find((topic) => String(topic.id) === String(article.subjectFilterId || ''));
          const topicBelongsToMateria = !selectedTopic
            || String(selectedTopic.parentId || selectedTopic.rootSubjectId || '') === String(subjectId);

          return topicBelongsToMateria
            ? article
            : { ...article, subjectFilterId: null, topicFilterId: null };
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
    } catch (error: any) {
      addToast(error?.message || 'Nao foi possivel criar a materia.', 'error');
    } finally {
      setIsCreatingMateria(false);
    }
  };

  const createArticleTopic = async (rawName: string) => {
    const name = rawName.trim();
    const materiaId = String(draft?.areaId || '');
    if (!name) {
      addToast('Informe o nome do topico.', 'info');
      return;
    }
    if (!materiaId) {
      addToast('Selecione a materia da lei antes de criar um topico.', 'error');
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
      updateActiveArticleTaxonomy({ subjectFilterId: String(existing.id), topicFilterId: null });
      addToast('Topico existente selecionado.', 'info');
      return;
    }

    const parentId = Number(materiaId);
    if (!Number.isFinite(parentId)) {
      addToast('A materia selecionada precisa estar cadastrada nas taxonomias.', 'error');
      return;
    }

    setIsCreatingTopic(true);
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
      updateActiveArticleTaxonomy({ subjectFilterId: String(created.id), topicFilterId: null });
      addToast('Topico criado e vinculado ao artigo.', 'success');
    } catch (error: any) {
      addToast(error?.message || 'Nao foi possivel criar o topico.', 'error');
    } finally {
      setIsCreatingTopic(false);
    }
  };

  const createArticleAssunto = async (rawName: string) => {
    const name = rawName.trim();
    const topicId = String(activeArticle?.subjectFilterId || '');
    if (!name) {
      addToast('Informe o nome do assunto.', 'info');
      return;
    }
    if (!topicId) {
      addToast('Selecione um topico antes de criar o assunto.', 'error');
      return;
    }

    const existing = specificSubjects.find((subject) => (
      normalizeTaxonomyText(subject.name) === normalizeTaxonomyText(name)
      && String(subject.parentId || '') === topicId
    ));

    if (existing) {
      updateActiveArticleTaxonomy({ topicFilterId: String(existing.id) });
      addToast('Assunto existente selecionado.', 'info');
      return;
    }

    const parentId = Number(topicId);
    if (!Number.isFinite(parentId)) {
      addToast('O topico selecionado precisa estar cadastrado nas taxonomias.', 'error');
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
          && String(subject.parentId || '') === topicId
        ))
        || { id: createdId || name, name, parentId: topicId };
      updateActiveArticleTaxonomy({ topicFilterId: String(created.id) });
      addToast('Assunto criado e vinculado ao artigo.', 'success');
    } catch (error: any) {
      addToast(error?.message || 'Nao foi possivel criar o assunto.', 'error');
    } finally {
      setIsCreatingAssunto(false);
    }
  };

  const updateLawField = (field: keyof AdminLawDraft, value: any) => {
    setDraft((current) => current ? { ...current, [field]: value } : current);
  };

  const updateArticleField = (field: keyof LawArticle | 'subjectFilterId' | 'topicFilterId', value: any) => {
    if (!activeArticle) return;

    setDraft((current) => {
      if (!current) return current;
      const nextArticles = (current.articles || []).map((article) => {
        if (article.id !== activeArticle.id) return article;

        if (field === 'text') {
          return {
            ...article,
            text: value,
            blocks: [
              {
                id: article.blocks?.[0]?.id || `${article.id}-caput`,
                kind: 'caput' as const,
                label: article.number ? `Art. ${article.number}` : 'Art.',
                text: value,
              },
            ],
          };
        }

        if (field === 'number') {
          return {
            ...article,
            number: value,
            blocks: (article.blocks || []).map((block, index) => index === 0 ? {
              ...block,
              label: value ? `Art. ${value}` : 'Art.',
            } : block),
          };
        }

        return { ...article, [field]: value };
      });

      return { ...current, articles: nextArticles };
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

  const updateNestedItem = (collection: 'teacherComments' | 'examTips' | 'jurisprudence' | 'sumulas', id: string, field: string, value: any) => {
    setDraft((current) => {
      if (!current) return current;
      return {
        ...current,
        [collection]: ((current as any)[collection] || []).map((item: any) => item.id === id ? { ...item, [field]: value } : item),
      };
    });
  };

  const removeNestedItem = (collection: 'teacherComments' | 'examTips' | 'jurisprudence' | 'sumulas', id: string) => {
    setDraft((current) => current ? {
      ...current,
      [collection]: ((current as any)[collection] || []).filter((item: any) => item.id !== id),
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
    if (!draft || activeEditorialSection === 'ai') {
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
    } catch (error: any) {
      addToast(error?.message || 'Nao foi possivel gerar com IA agora.', 'error');
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
    } catch (error: any) {
      addToast(error?.message || 'Nao foi possivel gerar o pacote com IA agora.', 'error');
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
    } catch (error: any) {
      addToast(error?.message || 'Nao foi possivel iniciar o lote editorial.', 'error');
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
    } catch (error: any) {
      addToast(error?.message || 'Nao foi possivel reprocessar os artigos falhados.', 'error');
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
      const taxonomies = await filtersService.listTaxonomies();
      const knowledgeTaxonomies = splitKnowledgeTaxonomies(taxonomies);
      const nextDraft = hydrateDraftFromLaw(result.law, areas, knowledgeTaxonomies.subjects);
      setSubjects(knowledgeTaxonomies.subjects);
      setTopics(knowledgeTaxonomies.topics);
      setSpecificSubjects(knowledgeTaxonomies.specificSubjects);
      setDraft(nextDraft);
      setActiveArticleId(nextDraft.articles?.[0]?.id || '');
      addToast('Lei importada do Planalto para revisao no editor.', 'success');
    } catch (error: any) {
      addToast(error?.message || 'Nao foi possivel importar a lei do Planalto.', 'error');
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
      const sync = result.sync || { insertedArticles: 0, changedArticles: 0, revokedArticles: 0 };
      const hasChanges = sync.insertedArticles > 0 || sync.changedArticles > 0 || sync.revokedArticles > 0;
      const nextDraft = hydrateDraftFromLaw(result.law, areas, subjects);

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
    } catch (error: any) {
      addToast(error?.message || 'Nao foi possivel sincronizar esta lei.', 'error');
    } finally {
      setIsSyncingFromOfficial(false);
    }
  };

  const openUpdatesModal = async () => {
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
        const nextDraft = hydrateDraftFromLaw(payload.law, areas, subjects);
        setDraft(nextDraft);
        setActiveArticleId((current) => current && nextDraft.articles.some((article) => article.id === current)
          ? current
          : nextDraft.articles?.[0]?.id || '');
      }
    } catch (error: any) {
      addToast(error?.message || 'Nao foi possivel carregar o historico de atualizacoes.', 'error');
    } finally {
      setIsUpdatesModalLoading(false);
    }
  };

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
  }, [draft?.id, isLoading, isNew, router, shouldOpenUpdatesFromQuery]);

  const saveLaw = async () => {
    if (!draft) return;
    setIsSaving(true);

    try {
      const saved = await legalCommentaryApiService.saveAdminLaw({
        ...draft,
        areaId: String(draft.areaId || draft.area?.id || subjects[0]?.id || areas[0]?.id || ''),
        articles: draft.articles || [],
        teacherComments: draft.teacherComments || [],
        jurisprudence: draft.jurisprudence || [],
        examTips: draft.examTips || [],
        sumulas: draft.sumulas || [],
      });
      addToast('Lei salva com sucesso.', 'success');
      if (isNew && saved.id) {
        router.replace(buildAdminLawEditPath(saved.id));
      } else {
        const nextDraft = hydrateDraftFromLaw(saved, areas, subjects);
        setDraft(nextDraft);
        setActiveArticleId((current) => current && nextDraft.articles.some((article) => article.id === current)
          ? current
          : nextDraft.articles?.[0]?.id || '');
      }
    } catch (error: any) {
      addToast(error?.message || 'Nao foi possivel salvar a lei.', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  if (isAuthLoading || isLoading || !draft) {
    return renderAdminShell(
      <div className={`${ADMIN_SURFACE_CLASS} flex min-h-[360px] items-center justify-center p-12 text-slate-500 dark:text-slate-400`}>
          <Loader2 className="mr-3 animate-spin" size={18} /> Carregando editor da Lei Comentada...
      </div>,
    );
  }

  const articleComments = (draft.teacherComments || []).filter((item) => item.articleId === activeArticle?.id);
  const articleTips = (draft.examTips || []).filter((item) => item.articleId === activeArticle?.id);
  const articleJurisprudence = (draft.jurisprudence || []).filter((item) => item.articleId === activeArticle?.id);
  const articleSumulas = (draft.sumulas || []).filter((item) => item.articleId === activeArticle?.id);
  const recentLawUpdates = (draft.updates || []).slice(0, 3);
  const activeSectionMeta = LEGAL_EDITORIAL_SECTIONS.find((section) => section.key === activeEditorialSection);
  const editorialSectionCounts: Record<LegalEditorialSection, number> = {
    teacher: articleComments.length,
    tips: articleTips.length,
    jurisprudence: articleJurisprudence.length + (activeArticle?.jurisprudenceNotes || []).length,
    sumulas: articleSumulas.length,
    doctrine: activeArticle?.doctrine?.length || 0,
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
                  <FieldLabel>Nome curto</FieldLabel>
                  <TextInput value={draft.shortTitle || ''} onChange={(event) => updateLawField('shortTitle', event.target.value)} placeholder="Codigo Penal" />
                </div>
                <div>
                  <FieldLabel>Nome completo</FieldLabel>
                  <TextInput value={draft.title || ''} onChange={(event) => updateLawField('title', event.target.value)} placeholder="Decreto-Lei..." />
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
                  <FieldLabel>Resumo</FieldLabel>
                  <TextArea value={draft.description || ''} onChange={(event) => updateLawField('description', event.target.value)} />
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
                      <FieldLabel>Titulo interno</FieldLabel>
                      <TextInput value={activeArticle.title || ''} onChange={(event) => updateArticleField('title', event.target.value)} placeholder="Anterioridade da lei" />
                    </div>
                    <div className="lg:col-span-3">
                      <div className="rounded-sm border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950/60">
                        <div className="flex flex-col gap-1">
                          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Vinculo com questoes</p>
                          <p className="text-sm text-slate-500 dark:text-slate-400">
                            A materia vem da lei. No artigo, escolha o topico e o assunto especifico para relacionar com as questoes.
                          </p>
                        </div>
                        <div className="mt-4 grid gap-4 lg:grid-cols-2">
                          <div>
                            <CreatableTaxonomySelect
                              label="Topico"
                              options={articleTopicOptions}
                              value={activeArticle.subjectFilterId || ''}
                              placeholder={draft.areaId ? 'Selecionar ou criar topico' : 'Selecione a materia da lei primeiro'}
                              createLabel="Criar topico"
                              disabled={!draft.areaId}
                              loading={isCreatingTopic}
                              onChange={(value) => {
                                updateActiveArticleTaxonomy({
                                  subjectFilterId: value || null,
                                  topicFilterId: null,
                                });
                              }}
                              onCreate={createArticleTopic}
                            />
                          </div>
                          <div>
                            <CreatableTaxonomySelect
                              label="Assunto"
                              options={articleAssuntoOptions}
                              value={activeArticle.topicFilterId || ''}
                              placeholder={activeArticle.subjectFilterId ? 'Selecionar ou criar assunto' : 'Selecione um topico primeiro'}
                              createLabel="Criar assunto"
                              disabled={!activeArticle.subjectFilterId}
                              loading={isCreatingAssunto}
                              onChange={(value) => updateActiveArticleTaxonomy({ topicFilterId: value || null })}
                              onCreate={createArticleAssunto}
                            />
                          </div>
                        </div>
                        <p className="mt-3 text-xs font-medium text-slate-500 dark:text-slate-400">
                          A quantidade de questoes relacionadas sera calculada automaticamente pelo vinculo de materia, topico e assunto.
                        </p>
                      </div>
                    </div>
                    <div className="lg:col-span-3">
                      <FieldLabel>Texto oficial do artigo</FieldLabel>
                      <TextArea className="min-h-[220px]" value={activeArticle.text || ''} onChange={(event) => updateArticleField('text', event.target.value)} />
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
                  <SelectInput value={lawStatusValue} onChange={(event) => updateLawField('status', event.target.value)}>
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
