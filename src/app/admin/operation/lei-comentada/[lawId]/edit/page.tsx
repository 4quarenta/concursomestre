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
import { useParams, useRouter } from 'next/navigation';
import {
  AlertCircle,
  ArrowLeft,
  BookOpen,
  Bot,
  CheckCircle2,
  Download,
  FileText,
  History,
  Loader2,
  Plus,
  RefreshCcw,
  Save,
  Sparkles,
  Trash2,
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
  LegalArticleEditorialSnapshot,
  LegalArea,
  LegalEditorialBatchRun,
  LegalEditorialGenerationResult,
  LegalEditorialGenerationScope,
  TeacherComment,
} from '@types';

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
  parentId?: string | number | null;
}

type LegalAiGenerationKind = 'teacher-comment' | 'exam-tip' | 'jurisprudence' | 'sumula' | 'doctrine' | 'bundle';

const createTempId = (prefix: string) => `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;

const normalizeParam = (value?: string | string[]) => Array.isArray(value) ? value[0] : value;

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

const buildEmptyLaw = (areas: LegalArea[]): AdminLawDraft => ({
  id: '',
  slug: '',
  areaId: areas[0]?.id || '',
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
  area: areas[0],
  articles: [buildEmptyArticle()],
  teacherComments: [],
  jurisprudence: [],
  examTips: [],
  userComments: [],
  updates: [],
  sumulas: [],
});

const hydrateDraftFromLaw = (law: Partial<LawDetail>, areas: LegalArea[]): AdminLawDraft => {
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

  const resolvedAreaId = String(law.areaId || law.area?.id || areas[0]?.id || '');
  const resolvedArea = areas.find((area) => String(area.id) === resolvedAreaId) || law.area || areas[0];

  return {
    ...law,
    id: String(law.id || ''),
    areaId: resolvedAreaId,
    area: resolvedArea,
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
    className={`h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm font-semibold text-slate-900 outline-none transition-colors focus:border-indigo-300 focus:bg-white dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:focus:border-indigo-500 ${props.className || ''}`}
  />
);

const TextArea = (props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) => (
  <textarea
    {...props}
    className={`min-h-28 w-full resize-y rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm font-medium leading-6 text-slate-900 outline-none transition-colors focus:border-indigo-300 focus:bg-white dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:focus:border-indigo-500 ${props.className || ''}`}
  />
);

const SelectInput = (props: React.SelectHTMLAttributes<HTMLSelectElement>) => (
  <select
    {...props}
    className={`h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm font-semibold text-slate-900 outline-none transition-colors focus:border-indigo-300 focus:bg-white dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:focus:border-indigo-500 ${props.className || ''}`}
  />
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
  const { currentUser, isLoading: isAuthLoading } = useAuth();
  const { addToast } = useToast();
  const lawId = normalizeParam(params.lawId) || 'new';
  const isNew = lawId === 'new';
  const [areas, setAreas] = React.useState<LegalArea[]>([]);
  const [subjects, setSubjects] = React.useState<TaxonomyOption[]>([]);
  const [topics, setTopics] = React.useState<TaxonomyOption[]>([]);
  const [draft, setDraft] = React.useState<AdminLawDraft | null>(null);
  const draftRef = React.useRef<AdminLawDraft | null>(null);
  const [activeArticleId, setActiveArticleId] = React.useState('');
  const [isLoading, setIsLoading] = React.useState(true);
  const [isSaving, setIsSaving] = React.useState(false);
  const [isImportingFromPlanalto, setIsImportingFromPlanalto] = React.useState(false);
  const [aiLoading, setAiLoading] = React.useState<string | null>(null);
  const [batchRun, setBatchRun] = React.useState<LegalEditorialBatchRun | null>(null);
  const [isBatchRunning, setIsBatchRunning] = React.useState(false);
  const [isBatchRefreshing, setIsBatchRefreshing] = React.useState(false);
  const [isBatchPaused, setIsBatchPaused] = React.useState(false);
  const [batchOnlyMissingComments, setBatchOnlyMissingComments] = React.useState(true);
  const batchPauseRef = React.useRef(false);
  const batchStopRef = React.useRef(false);

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
        const nextLaw = payload.law ? hydrateDraftFromLaw(payload.law, nextAreas) : buildEmptyLaw(nextAreas);

        setAreas(nextAreas);
        setSubjects((taxonomies.subjects || []) as TaxonomyOption[]);
        setTopics((taxonomies.topics || []) as TaxonomyOption[]);
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

  const filteredTopics = React.useMemo(() => {
    if (!activeArticle?.subjectFilterId) return topics;
    return topics.filter((topic) => String(topic.parentId || '') === String(activeArticle.subjectFilterId));
  }, [activeArticle?.subjectFilterId, topics]);

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
      precedentType: item?.precedentType || 'Entendimento',
      title: item?.title || 'Jurisprudencia relevante',
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

  const batchEligibleArticlesCount = React.useMemo(() => {
    if (!draft?.articles?.length) return 0;
    return (draft.articles || []).filter((article) => (
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
    jurisprudenceNotes: editorial.jurisprudenceNotes || [],
    jurisprudence: (editorial.jurisprudence || []).map((item) => ({
      ...item,
      id: item.id || createTempId('juris'),
      articleId,
    })),
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

    setAiLoading(kind);

    try {
      const result = await generateArticleEditorial(activeArticle, resolveAiScope(kind));
      const warnings = result.summary.warnings || [];

      if (result.summary.approvedBlocks > 0) {
        addToast(`${AI_KIND_LABEL[kind]} gerado${result.persisted ? ' e salvo' : ''}. Revise o resultado.`, 'success');
      } else {
        addToast(warnings[0] || `Nada seguro para adicionar em ${AI_KIND_LABEL[kind].toLowerCase()}.`, 'info');
      }
    } catch (error: any) {
      addToast(error?.message || 'Nao foi possivel gerar com IA agora.', 'error');
    } finally {
      setAiLoading(null);
    }
  };

  const generateAiBundle = async () => {
    if (!draft || !activeArticle) {
      addToast('Nenhum artigo ativo para gerar conteudo.', 'info');
      return;
    }

    setAiLoading('bundle');

    try {
      const result = await generateArticleEditorial(activeArticle, 'article-full');
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
      const eligibleArticles = (draft.articles || []).filter((article) => (
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
      const nextDraft = hydrateDraftFromLaw(result.law, areas);
      setSubjects((taxonomies.subjects || []) as TaxonomyOption[]);
      setTopics((taxonomies.topics || []) as TaxonomyOption[]);
      setDraft(nextDraft);
      setActiveArticleId(nextDraft.articles?.[0]?.id || '');
      addToast('Lei importada do Planalto para revisao no editor.', 'success');
    } catch (error: any) {
      addToast(error?.message || 'Nao foi possivel importar a lei do Planalto.', 'error');
    } finally {
      setIsImportingFromPlanalto(false);
    }
  };

  const saveLaw = async () => {
    if (!draft) return;
    setIsSaving(true);

    try {
      const saved = await legalCommentaryApiService.saveAdminLaw({
        ...draft,
        areaId: draft.areaId || draft.area?.id || areas[0]?.id,
        articles: draft.articles || [],
        teacherComments: draft.teacherComments || [],
        jurisprudence: draft.jurisprudence || [],
        examTips: draft.examTips || [],
        sumulas: draft.sumulas || [],
      });
      addToast('Lei salva com sucesso.', 'success');
      if (isNew && saved.id) {
        router.replace(`/admin/operation/lei-comentada/${saved.id}/edit`);
      } else {
        const nextDraft = hydrateDraftFromLaw(saved, areas);
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
    return (
      <div className="min-h-[100dvh] bg-slate-50 p-6 dark:bg-slate-950">
        <div className="mx-auto flex max-w-6xl items-center justify-center rounded-[2rem] border border-slate-200 bg-white p-12 text-slate-500 shadow-sm dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400">
          <Loader2 className="mr-3 animate-spin" size={18} /> Carregando editor da Lei Comentada...
        </div>
      </div>
    );
  }

  const articleComments = (draft.teacherComments || []).filter((item) => item.articleId === activeArticle?.id);
  const articleTips = (draft.examTips || []).filter((item) => item.articleId === activeArticle?.id);
  const articleJurisprudence = (draft.jurisprudence || []).filter((item) => item.articleId === activeArticle?.id);
  const articleSumulas = (draft.sumulas || []).filter((item) => item.articleId === activeArticle?.id);
  const batchProgressPercent = batchRun?.totalArticles
    ? Math.min(100, Math.round((batchRun.processedArticles / batchRun.totalArticles) * 100))
    : 0;
  const batchStartLabel = batchOnlyMissingComments
    ? `Gerar comentarios pendentes (${batchEligibleArticlesCount})`
    : `Gerar comentarios de todos (${batchEligibleArticlesCount})`;

  return (
    <div className="min-h-[100dvh] bg-slate-50 px-4 py-6 dark:bg-slate-950 md:px-8">
      <div className="mx-auto max-w-7xl space-y-5">
        <div className="flex flex-col gap-4 rounded-[2rem] border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex min-w-0 items-start gap-4">
            <Link href="/admin/operation/lei-comentada" className="mt-1 rounded-xl border border-slate-200 p-3 text-slate-500 transition-colors hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800">
              <ArrowLeft size={18} />
            </Link>
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.18em] text-indigo-600 dark:text-indigo-300">Admin / Lei Comentada</p>
              <h1 className="mt-2 text-2xl font-black text-slate-900 dark:text-slate-100">
                {isNew ? 'Nova lei comentada' : draft.shortTitle || draft.title || 'Editar lei'}
              </h1>
              <p className="mt-1 text-sm font-medium text-slate-500 dark:text-slate-400">
                Persistencia real no banco, fonte oficial do Planalto e conteudo editorial revisavel.
              </p>
            </div>
          </div>

          <div className="flex flex-col gap-2 sm:flex-row">
            {!isNew && draft.id ? (
              <Link
                href={`/admin/operation/lei-comentada/${encodeURIComponent(String(draft.id))}/updates`}
                className="inline-flex h-12 items-center justify-center gap-2 rounded-xl border border-slate-200 px-4 text-[10px] font-black uppercase tracking-[0.16em] text-slate-600 transition-colors hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
              >
                <History size={15} /> Atualizacoes
              </Link>
            ) : null}
            <button
              type="button"
              onClick={() => void saveLaw()}
              disabled={isSaving}
              className="inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-indigo-600 px-6 text-[10px] font-black uppercase tracking-[0.16em] text-white shadow-sm transition-colors hover:bg-indigo-700 disabled:opacity-60"
            >
              {isSaving ? <Loader2 className="animate-spin" size={16} /> : <Save size={16} />}
              Salvar lei
            </button>
          </div>
        </div>

        <div className="grid gap-5 xl:grid-cols-[360px_minmax(0,1fr)]">
          <aside className="space-y-5">
            <section className="rounded-[2rem] border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
              <div className="flex items-center gap-2">
                <BookOpen size={18} className="text-indigo-600 dark:text-indigo-300" />
                <h2 className="text-sm font-black uppercase tracking-[0.16em] text-slate-700 dark:text-slate-200">Dados da lei</h2>
              </div>

              <div className="mt-5 space-y-4">
                <div>
                  <FieldLabel>Area</FieldLabel>
                  <SelectInput value={draft.areaId || ''} onChange={(event) => updateLawField('areaId', event.target.value)}>
                    {areas.map((area) => <option key={area.id} value={area.id}>{area.name}</option>)}
                  </SelectInput>
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
            </section>

            <section className="rounded-[2rem] border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Artigos</p>
                  <h2 className="mt-1 text-sm font-black text-slate-900 dark:text-slate-100">{draft.articles?.length || 0} cadastrados</h2>
                </div>
                <button type="button" onClick={addArticle} className="rounded-xl bg-indigo-600 p-3 text-white transition-colors hover:bg-indigo-700">
                  <Plus size={16} />
                </button>
              </div>

              <div className="mt-4 max-h-[480px] space-y-2 overflow-y-auto pr-1">
                {(draft.articles || []).map((article) => (
                  <button
                    type="button"
                    key={article.id}
                    onClick={() => setActiveArticleId(article.id)}
                    className={`w-full rounded-2xl border p-3 text-left transition-all ${article.id === activeArticle?.id ? 'border-indigo-500 bg-indigo-50 dark:border-indigo-700 dark:bg-indigo-500/10' : 'border-slate-200 bg-slate-50 hover:bg-white dark:border-slate-800 dark:bg-slate-950 dark:hover:bg-slate-800'}`}
                  >
                    <p className="text-xs font-black text-slate-900 dark:text-slate-100">{getArticleLabel(article)}</p>
                    <p className="mt-1 line-clamp-2 text-[11px] font-medium leading-4 text-slate-500 dark:text-slate-400">{article.title || article.text || 'Sem texto cadastrado'}</p>
                  </button>
                ))}
              </div>
            </section>
          </aside>

          <main className="space-y-5">
            {activeArticle ? (
              <>
                <section className="rounded-[2rem] border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                    <div>
                      <p className="text-[10px] font-black uppercase tracking-[0.18em] text-indigo-600 dark:text-indigo-300">Texto legal</p>
                      <h2 className="mt-1 text-xl font-black text-slate-900 dark:text-slate-100">{getArticleLabel(activeArticle)}</h2>
                    </div>
                    <button
                      type="button"
                      onClick={() => removeArticle(activeArticle.id)}
                      className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-red-200 px-3 text-[10px] font-black uppercase tracking-[0.16em] text-red-600 transition-colors hover:bg-red-50 dark:border-red-900/60 dark:hover:bg-red-500/10"
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
                      <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4 dark:border-slate-800 dark:bg-slate-950/60">
                        <div className="flex flex-col gap-1">
                          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-indigo-600 dark:text-indigo-300">Vinculo com questoes</p>
                          <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Use apenas os filtros editoriais que relacionam este artigo ao banco de questoes: materia e assunto.</p>
                        </div>
                        <div className="mt-4 grid gap-4 lg:grid-cols-2">
                          <div>
                            <FieldLabel>Materia</FieldLabel>
                            <SelectInput value={activeArticle.subjectFilterId || ''} onChange={(event) => {
                              updateArticleField('subjectFilterId', event.target.value || null);
                              updateArticleField('topicFilterId', null);
                            }}>
                              <option value="">Selecionar materia</option>
                              {subjects.map((subject) => <option key={subject.id} value={subject.id}>{subject.name}</option>)}
                            </SelectInput>
                          </div>
                          <div>
                            <FieldLabel>Assunto</FieldLabel>
                            <SelectInput
                              value={activeArticle.topicFilterId || ''}
                              onChange={(event) => updateArticleField('topicFilterId', event.target.value || null)}
                              disabled={!activeArticle.subjectFilterId}
                            >
                              <option value="">{activeArticle.subjectFilterId ? 'Selecionar assunto' : 'Selecione uma materia primeiro'}</option>
                              {filteredTopics.map((topic) => <option key={topic.id} value={topic.id}>{topic.name}</option>)}
                            </SelectInput>
                          </div>
                        </div>
                      </div>
                    </div>
                    <div className="lg:col-span-3">
                      <FieldLabel>Texto oficial do artigo</FieldLabel>
                      <TextArea className="min-h-[220px]" value={activeArticle.text || ''} onChange={(event) => updateArticleField('text', event.target.value)} />
                    </div>
                    <div>
                      <FieldLabel>Questoes relacionadas</FieldLabel>
                      <TextInput type="number" value={activeArticle.relatedQuestionCount || 0} onChange={(event) => updateArticleField('relatedQuestionCount', Number(event.target.value) || 0)} />
                    </div>
                  </div>
                </section>

                <section className="rounded-[2rem] border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                    <div>
                      <p className="text-[10px] font-black uppercase tracking-[0.18em] text-indigo-600 dark:text-indigo-300">Editorial e IA</p>
                      <h2 className="mt-1 text-xl font-black text-slate-900 dark:text-slate-100">Conteudo do artigo</h2>
                      <p className="mt-1 text-sm font-medium text-slate-500 dark:text-slate-400">Gere com IA e ajuste manualmente o conteudo editorial quando necessario.</p>
                    </div>
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
                  </div>

                  {!isNew && draft.id ? (
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

                    <div className="mt-6 grid gap-5 xl:grid-cols-2">
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
                  </div>
                </section>
              </>
            ) : (
              <section className="rounded-[2rem] border border-slate-200 bg-white p-10 text-center shadow-sm dark:border-slate-800 dark:bg-slate-900">
                <FileText className="mx-auto mb-3 text-slate-300 dark:text-slate-600" size={36} />
                <p className="text-sm font-black text-slate-900 dark:text-slate-100">Adicione um artigo para comecar.</p>
                <button type="button" onClick={addArticle} className="mt-4 inline-flex h-11 items-center gap-2 rounded-xl bg-indigo-600 px-5 text-[10px] font-black uppercase tracking-[0.16em] text-white">
                  <Plus size={16} /> Novo artigo
                </button>
              </section>
            )}
          </main>
        </div>

        <div className="rounded-[2rem] border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-start gap-3">
            <div className="rounded-2xl bg-indigo-50 p-3 text-indigo-600 dark:bg-indigo-500/10 dark:text-indigo-300">
              <Bot size={18} />
            </div>
            <div>
              <p className="text-sm font-black text-slate-900 dark:text-slate-100">Revisao editorial obrigatoria</p>
              <p className="mt-1 text-sm font-medium leading-6 text-slate-500 dark:text-slate-400">
                A IA acelera o rascunho, mas o conteudo publicado deve ser conferido contra fonte oficial, jurisprudencia real e criterio pedagogico antes de ficar disponivel aos alunos.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminLegalCommentaryEditPage;
