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
  Bookmark,
  BookMarked,
  BookOpen,
  ChevronDown,
  Clipboard,
  ExternalLink,
  FileText,
  GraduationCap,
  Landmark,
  Lightbulb,
  MessageCircle,
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
import type {
  ArticleExamTip,
  ArticleJurisprudence,
  LawArticle,
  LawDetail,
  LegalFavoriteType,
  LegalUserComment,
  TeacherComment,
} from '@types';

type ReadingMode = 'commented' | 'dry';

const getUserId = (user: any) => user?.id || user?.userId || user?.email || null;

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
  tone: 'blue' | 'green' | 'amber' | 'red' | 'slate';
  children: React.ReactNode;
  defaultOpen?: boolean;
}> = ({ icon: Icon, title, count, tone, children, defaultOpen = false }) => {
  const tones = {
    blue: 'text-blue-600 bg-blue-50 dark:bg-blue-900/25 dark:text-blue-300',
    green: 'text-emerald-600 bg-emerald-50 dark:bg-emerald-900/25 dark:text-emerald-300',
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
      <article key={item.id} className="rounded-2xl bg-emerald-50 p-4 dark:bg-emerald-900/20">
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

const TextListContent: React.FC<{ items: string[]; tone?: 'slate' | 'green' | 'amber' | 'red' }> = ({ items, tone = 'slate' }) => {
  const toneClass = {
    slate: 'bg-slate-50 dark:bg-slate-800',
    green: 'bg-emerald-50 dark:bg-emerald-900/20',
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
  currentUser: any;
}> = ({ articleId, currentUser }) => {
  const userKey = String(getUserId(currentUser) || 'guest');
  const storageKey = `cm:legal-commentary:notes:${userKey}:${articleId}`;
  const [note, setNote] = React.useState('');
  const [savedLabel, setSavedLabel] = React.useState('');

  React.useEffect(() => {
    if (typeof window === 'undefined') return;
    setNote(window.localStorage.getItem(storageKey) || '');
    setSavedLabel('');
  }, [storageKey]);

  const saveNote = () => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(storageKey, note.trim());
    setSavedLabel('Anotação salva.');
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

const LawDetailPage: React.FC = () => {
  const params = useParams<{ slug: string }>();
  const { currentUser } = useAuth();
  const { addToast } = useToast();
  const slug = String(params?.slug || '');
  const [law, setLaw] = React.useState<LawDetail | null>(null);
  const [isLoading, setIsLoading] = React.useState(true);
  const [articleQuery, setArticleQuery] = React.useState('');
  const [updatedOnly, setUpdatedOnly] = React.useState(false);
  const [activeArticleId, setActiveArticleId] = React.useState<string>('');
  const [readingMode, setReadingMode] = React.useState<ReadingMode>('commented');

  const reloadLaw = React.useCallback(async () => {
    const nextLaw = await legalCommentaryApiService.getLawDetail(slug);
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

  const visibleArticles = React.useMemo(() => {
    if (!law) return [];
    const normalizedQuery = articleQuery.toLowerCase().trim();
    return law.articles.filter((article) => {
      const matchesQuery = !normalizedQuery || getArticleSearchText(article).includes(normalizedQuery);
      const matchesUpdated = !updatedOnly || article.isRecentlyChanged || article.blocks.some((block) => block.isRecentlyChanged);
      return matchesQuery && matchesUpdated;
    });
  }, [articleQuery, law, updatedOnly]);

  const toggleFavorite = async (type: LegalFavoriteType, targetId: string) => {
    if (!currentUser) {
      addToast('Entre na sua conta para salvar favoritos.', 'warning');
      return;
    }

    try {
      const result = await legalCommentaryApiService.toggleFavorite(type, targetId);
      await reloadLaw();
      addToast(result.isFavorite ? 'Item salvo nos favoritos.' : 'Item removido dos favoritos.', 'success');
    } catch {
      addToast('Nao foi possivel atualizar o favorito.', 'error');
    }
  };

  const handleArticleFocus = async (article: LawArticle) => {
    if (!law || activeArticleId === article.id) return;
    setActiveArticleId(article.id);
    if (!currentUser) return;

    try {
      await legalCommentaryApiService.recordArticleView(law.id, article.id);
      await reloadLaw();
    } catch {
      // Progresso nao deve bloquear a leitura da lei.
    }
  };

  const handleCopyLink = async () => {
    if (typeof window === 'undefined') return;
    await navigator.clipboard?.writeText(window.location.href);
    addToast('Link copiado.', 'success');
  };

  const handleShare = async () => {
    if (!law || typeof window === 'undefined') return;
    if (navigator.share) {
      await navigator.share({ title: law.shortTitle, url: window.location.href });
      return;
    }

    handleCopyLink();
  };

  const addComment = async (articleId: string, body: string) => {
    if (!currentUser) {
      addToast('Entre na sua conta para comentar.', 'warning');
      return;
    }

    try {
      await legalCommentaryApiService.addUserComment({
        articleId,
        body,
      });
      await reloadLaw();
      addToast('Comentário publicado.', 'success');
    } catch (error: any) {
      addToast(error?.message || 'Não foi possível comentar.', 'error');
    }
  };

  const editComment = async (commentId: string, body: string) => {
    try {
      await legalCommentaryApiService.updateUserComment(commentId, body);
      await reloadLaw();
      addToast('Comentário atualizado.', 'success');
    } catch (error: any) {
      addToast(error?.message || 'Não foi possível editar.', 'error');
    }
  };

  const deleteComment = async (commentId: string) => {
    try {
      await legalCommentaryApiService.deleteUserComment(commentId);
      await reloadLaw();
      addToast('Comentário excluído.', 'success');
    } catch (error: any) {
      addToast(error?.message || 'Não foi possível excluir.', 'error');
    }
  };

  if (isLoading) {
    return (
      <div className={`${PLATFORM_SURFACE_CARD_CLASS} p-10 text-center`}>
        <BookOpen className="mx-auto mb-4 text-slate-300 dark:text-slate-600" size={42} />
        <h1 className={PLATFORM_PAGE_TITLE_CLASS}>Carregando lei...</h1>
        <p className={`${PLATFORM_PAGE_DESCRIPTION_CLASS} mt-2`}>Buscando texto e comentarios salvos no banco da plataforma.</p>
      </div>
    );
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
    <div className="w-full space-y-6 animate-fade-in">
      <section className={`${PLATFORM_SURFACE_CARD_CLASS} overflow-hidden`}>
        <div className="grid gap-0 xl:grid-cols-[minmax(0,1fr)_340px]">
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

          <aside className="border-t border-slate-200 bg-slate-50 px-6 py-7 dark:border-slate-800 dark:bg-slate-950/70 md:px-8 xl:border-l xl:border-t-0">
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

      <div className="grid gap-6 xl:grid-cols-[300px_minmax(0,1fr)]">
        <aside className="hidden xl:block">
          <div className="sticky top-6 space-y-4">
            <section className={`${PLATFORM_SURFACE_CARD_CLASS} p-4`}>
              <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400 dark:text-slate-500">Índice</p>
              <h2 className="mt-2 text-base font-black text-slate-900 dark:text-slate-100">Artigos desta lei</h2>
              <nav className="no-scrollbar mt-4 max-h-[64vh] space-y-1 overflow-y-auto pr-1">
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
          </div>
        </aside>

        <section className="min-w-0 space-y-5">
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

          <div className="space-y-5">
            {visibleArticles.map((article, index) => {
              const comments = law.teacherComments.filter((comment) => comment.articleId === article.id);
              const jurisprudence = law.jurisprudence.filter((item) => item.articleId === article.id);
              const tips = law.examTips.filter((tip) => tip.articleId === article.id);
              const allTips = [...tips.map((tip) => tip.body), ...(article.examTip ? [article.examTip] : [])];
              const communityComments = law.userComments.filter((comment) => comment.articleId === article.id);

              return (
                <article
                  key={article.id}
                  id={article.id}
                  onMouseEnter={() => handleArticleFocus(article)}
                  className={`scroll-mt-6 rounded-[2rem] border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900 ${readingMode === 'dry' ? 'p-6 md:p-8' : 'p-5 md:p-6'}`}
                >
                  <header className="mb-4 flex items-start justify-between gap-4">
                    <div>
                      <div className="mb-3 flex items-center gap-2">
                        <span className="rounded-full bg-indigo-600 px-3 py-1 text-[10px] font-black uppercase tracking-widest text-white">Art. {article.number}</span>
                        <span className="text-xs font-semibold text-slate-400">{article.hierarchy.chapter || article.hierarchy.title || law.area.name}</span>
                        {readingMode === 'dry' ? (
                          <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.16em] text-slate-500 dark:bg-slate-800 dark:text-slate-400">Lei seca</span>
                        ) : null}
                      </div>
                      {article.title ? <h2 className="text-lg font-black text-slate-950 dark:text-white">{article.title}</h2> : null}
                    </div>
                    <FavoriteIconButton isFavorite={article.isFavorite} title="Favoritar artigo" onClick={() => toggleFavorite('article', article.id)} />
                  </header>

                  <div className={`space-y-3 font-medium text-slate-800 dark:text-slate-100 ${readingMode === 'dry' ? 'text-lg leading-9' : 'text-base leading-8'}`}>
                    {article.blocks.map((block) => (
                      <div key={block.id} className={block.isRecentlyChanged ? 'rounded-xl bg-amber-50 p-3 dark:bg-amber-900/20' : ''}>
                        <span className="mr-2 font-black text-slate-950 dark:text-white">{block.label}</span>
                        {block.text}
                      </div>
                    ))}
                    {article.paragraphs?.map((paragraph) => (
                      <p key={paragraph.number} className="border-l-2 border-slate-200 pl-3 dark:border-slate-700">
                        <span className="font-black text-slate-950 dark:text-white">{paragraph.number}</span> — {paragraph.text}
                      </p>
                    ))}
                  </div>

                  {readingMode === 'commented' ? (
                  <div className="mt-5">
                    {comments.length > 0 ? (
                      <AccordionRow icon={GraduationCap} title="Comentário do professor" count={comments.length} tone="blue" defaultOpen={index === 0}>
                        <TeacherCommentsContent comments={comments} onFavorite={toggleFavorite} />
                      </AccordionRow>
                    ) : null}

                    {article.doctrine && article.doctrine.length > 0 ? (
                      <AccordionRow icon={BookMarked} title="Doutrina" count={article.doctrine.length} tone="green">
                        <TextListContent items={article.doctrine} tone="green" />
                      </AccordionRow>
                    ) : null}

                    {jurisprudence.length > 0 ? (
                      <AccordionRow icon={Scale} title="Jurisprudência" count={jurisprudence.length} tone="green">
                        <JurisprudenceContent items={jurisprudence} onFavorite={toggleFavorite} />
                      </AccordionRow>
                    ) : null}

                    {article.jurisprudenceNotes && article.jurisprudenceNotes.length > 0 ? (
                      <AccordionRow icon={Scale} title="Jurisprudência" count={article.jurisprudenceNotes.length} tone="green">
                        <TextListContent items={article.jurisprudenceNotes} tone="green" />
                      </AccordionRow>
                    ) : null}

                    {article.syllabi && article.syllabi.length > 0 ? (
                      <AccordionRow icon={Landmark} title="Súmulas relacionadas" count={article.syllabi.length} tone="red">
                        <SyllabiContent items={article.syllabi} />
                      </AccordionRow>
                    ) : null}

                    {allTips.length > 0 ? (
                      <AccordionRow icon={Lightbulb} title="Macete" count={allTips.length} tone="amber">
                        <ExamTipsContent tips={allTips} />
                      </AccordionRow>
                    ) : null}

                    <AccordionRow icon={StickyNote} title="Minhas anotações" tone="slate">
                      <ArticleNotesContent articleId={article.id} currentUser={currentUser} />
                    </AccordionRow>

                    <AccordionRow icon={MessageCircle} title="Comentários dos alunos" count={communityComments.length} tone="red">
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
        </section>
      </div>
    </div>
  );
};

export default LawDetailPage;
