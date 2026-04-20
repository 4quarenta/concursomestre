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
  ArrowLeft,
  BookOpen,
  Bot,
  FileText,
  Loader2,
  Plus,
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
  LegalArea,
  TeacherComment,
} from '@types';

type AdminLawDraft = Partial<LawDetail> & {
  areaId?: string;
  sumulas?: Array<{
    id?: string;
    articleId: string;
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
  const [activeArticleId, setActiveArticleId] = React.useState('');
  const [isLoading, setIsLoading] = React.useState(true);
  const [isSaving, setIsSaving] = React.useState(false);
  const [aiLoading, setAiLoading] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!isAuthLoading && !canAccessAdminPanel(currentUser)) {
      router.replace('/');
    }
  }, [currentUser, isAuthLoading, router]);

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
        const nextLaw = payload.law
          ? {
              ...payload.law,
              areaId: payload.law.areaId || payload.law.area?.id || nextAreas[0]?.id || '',
              sumulas: payload.law.articles.flatMap((article) => (
                (article.syllabi || []).map((sumula) => ({
                  ...sumula,
                  id: createTempId('sumula'),
                  articleId: article.id,
                }))
              )),
            }
          : buildEmptyLaw(nextAreas);

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
    setDraft((current) => current ? { ...current, jurisprudence: [...(current.jurisprudence || []), nextItem] } : current);
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

  const generateWithAi = async (kind: 'teacher-comment' | 'exam-tip' | 'jurisprudence' | 'sumula') => {
    if (!draft || !activeArticle) return;
    setAiLoading(kind);

    try {
      if (kind === 'teacher-comment') {
        const suggestion = await legalCommentaryApiService.generateEditorialSuggestion<Partial<TeacherComment>>(
          { kind, law: draft, article: activeArticle },
          {},
        );
        addTeacherComment(suggestion);
      } else if (kind === 'exam-tip') {
        const suggestion = await legalCommentaryApiService.generateEditorialSuggestion<Partial<ArticleExamTip>>(
          { kind, law: draft, article: activeArticle },
          {},
        );
        addExamTip(suggestion);
      } else if (kind === 'jurisprudence') {
        const suggestion = await legalCommentaryApiService.generateEditorialSuggestion<Partial<ArticleJurisprudence>>(
          { kind, law: draft, article: activeArticle },
          {},
        );
        addJurisprudence(suggestion);
      } else {
        const suggestion = await legalCommentaryApiService.generateEditorialSuggestion<Partial<NonNullable<AdminLawDraft['sumulas']>[number]>>(
          { kind, law: draft, article: activeArticle },
          {},
        );
        addSumula(suggestion);
      }

      addToast('Conteudo gerado. Revise antes de salvar.', 'success');
    } catch {
      addToast('Nao foi possivel gerar com IA agora.', 'error');
    } finally {
      setAiLoading(null);
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
        setDraft({
          ...saved,
          areaId: saved.areaId || saved.area?.id,
          sumulas: saved.articles.flatMap((article) => (
            (article.syllabi || []).map((sumula) => ({
              ...sumula,
              id: createTempId('sumula'),
              articleId: article.id,
            }))
          )),
        });
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
                  <TextInput value={draft.officialUrl || ''} onChange={(event) => updateLawField('officialUrl', event.target.value)} placeholder="https://www.planalto.gov.br/..." />
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
                    <div>
                      <FieldLabel>Materia vinculada</FieldLabel>
                      <SelectInput value={activeArticle.subjectFilterId || ''} onChange={(event) => {
                        updateArticleField('subjectFilterId', event.target.value || null);
                        updateArticleField('topicFilterId', null);
                      }}>
                        <option value="">Sem materia</option>
                        {subjects.map((subject) => <option key={subject.id} value={subject.id}>{subject.name}</option>)}
                      </SelectInput>
                    </div>
                    <div>
                      <FieldLabel>Assunto vinculado</FieldLabel>
                      <SelectInput value={activeArticle.topicFilterId || ''} onChange={(event) => updateArticleField('topicFilterId', event.target.value || null)}>
                        <option value="">Sem assunto</option>
                        {filteredTopics.map((topic) => <option key={topic.id} value={topic.id}>{topic.name}</option>)}
                      </SelectInput>
                    </div>
                    <div>
                      <FieldLabel>Questoes relacionadas</FieldLabel>
                      <TextInput type="number" value={activeArticle.relatedQuestionCount || 0} onChange={(event) => updateArticleField('relatedQuestionCount', Number(event.target.value) || 0)} />
                    </div>
                    <div className="lg:col-span-3">
                      <FieldLabel>Texto oficial do artigo</FieldLabel>
                      <TextArea className="min-h-[220px]" value={activeArticle.text || ''} onChange={(event) => updateArticleField('text', event.target.value)} />
                    </div>
                  </div>
                </section>

                <section className="rounded-[2rem] border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                    <div>
                      <p className="text-[10px] font-black uppercase tracking-[0.18em] text-indigo-600 dark:text-indigo-300">Editorial e IA</p>
                      <h2 className="mt-1 text-xl font-black text-slate-900 dark:text-slate-100">Conteudo do artigo</h2>
                      <p className="mt-1 text-sm font-medium text-slate-500 dark:text-slate-400">Gere com IA, revise e salve no banco como conteudo editorial da plataforma.</p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {[
                        ['teacher-comment', 'Comentario'],
                        ['exam-tip', 'Macete'],
                        ['jurisprudence', 'Jurisprudencia'],
                        ['sumula', 'Sumula'],
                      ].map(([kind, label]) => (
                        <button
                          key={kind}
                          type="button"
                          onClick={() => void generateWithAi(kind as any)}
                          disabled={Boolean(aiLoading)}
                          className="inline-flex h-10 items-center gap-2 rounded-xl bg-slate-900 px-3 text-[10px] font-black uppercase tracking-[0.14em] text-white transition-colors hover:bg-slate-700 disabled:opacity-60 dark:bg-white dark:text-slate-950"
                        >
                          {aiLoading === kind ? <Loader2 className="animate-spin" size={14} /> : <Sparkles size={14} />}
                          {label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="mt-6 grid gap-5 xl:grid-cols-2">
                    <div className="space-y-3 rounded-2xl border border-slate-200 p-4 dark:border-slate-800">
                      <div className="flex items-center justify-between gap-3">
                        <h3 className="text-sm font-black text-slate-900 dark:text-slate-100">Comentarios de professor</h3>
                        <button type="button" onClick={() => addTeacherComment()} className="rounded-lg bg-indigo-50 px-3 py-2 text-[10px] font-black uppercase text-indigo-600 dark:bg-indigo-500/10 dark:text-indigo-300">Adicionar</button>
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
