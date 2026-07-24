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

'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Archive, FilePenLine, ImagePlus, Newspaper, Plus, Save, Search, X } from 'lucide-react';
import RichTextEditor from '@/components/shared/ui/RichTextEditor';
import { useToast } from '@/providers/ToastProvider';
import { adminService } from '@services/admin/adminService';
import { blogService, type BlogArticle, type BlogArticleInput, type BlogCategory } from '@services/blog';
import {
  ADMIN_PAGE_PANEL_CLASS,
  ADMIN_PRIMARY_BUTTON_CLASS,
  ADMIN_SECONDARY_BUTTON_CLASS,
} from '../shared/adminPanelStyles';

const toLocalDateTimeInput = (value?: string | null) => {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
};

const emptyDraft = (): BlogArticleInput => ({
  id: null,
  title: '',
  slug: '',
  excerpt: '',
  bodyHtml: '',
  categoryId: null,
  categoryName: '',
  coverImageUrl: '',
  coverImageAlt: '',
  status: 'draft',
  featured: false,
  allowComments: true,
  sourceName: '',
  sourceUrl: '',
  seoTitle: '',
  seoDescription: '',
  canonicalUrl: '',
  scheduledAt: null,
  tags: [],
});

const articleToDraft = (article: BlogArticle): BlogArticleInput => ({
  id: article.id,
  title: article.title,
  slug: article.slug,
  excerpt: article.excerpt,
  bodyHtml: article.bodyHtml || '',
  categoryId: article.category.id,
  categoryName: article.category.name,
  coverImageUrl: article.coverImageUrl,
  coverImageAlt: article.coverImageAlt,
  status: article.status,
  featured: article.featured,
  allowComments: article.allowComments,
  sourceName: article.sourceName || '',
  sourceUrl: article.sourceUrl || '',
  seoTitle: article.seoTitle || '',
  seoDescription: article.seoDescription || '',
  canonicalUrl: article.canonicalUrl || '',
  scheduledAt: toLocalDateTimeInput(article.scheduledAt),
  tags: article.tags.map((tag) => tag.name),
});

const fieldClass = 'h-11 w-full rounded-md border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-800 outline-none focus:border-indigo-500 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100';
const labelClass = 'mb-2 block text-[10px] font-black uppercase tracking-[0.14em] text-slate-500';

export default function AdminBlogManager() {
  const { addToast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [items, setItems] = useState<BlogArticle[]>([]);
  const [categories, setCategories] = useState<BlogCategory[]>([]);
  const [draft, setDraft] = useState<BlogArticleInput | null>(null);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const [page, categoryItems] = await Promise.all([
        blogService.adminList({ ...(search ? { search } : {}), ...(status ? { status } : {}) }),
        blogService.categories(),
      ]);
      setItems(page.items);
      setCategories(categoryItems);
    } catch (error) {
      addToast(error instanceof Error ? error.message : 'Nao foi possivel carregar o blog.', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void load();
    }, 0);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status]);

  const tagsText = useMemo(() => (draft?.tags || []).join(', '), [draft?.tags]);

  const editArticle = async (id: number) => {
    try {
      const article = await blogService.adminDetail(id);
      setDraft(articleToDraft(article));
    } catch (error) {
      addToast(error instanceof Error ? error.message : 'Nao foi possivel abrir o artigo.', 'error');
    }
  };

  const save = async () => {
    if (!draft) return;
    setSaving(true);
    try {
      const saved = await blogService.save({
        ...draft,
        scheduledAt: draft.status === 'scheduled' && draft.scheduledAt
          ? new Date(draft.scheduledAt).toISOString()
          : null,
      });
      addToast(saved.status === 'published' ? 'Noticia publicada.' : 'Artigo salvo.', 'success');
      setDraft(null);
      await load();
    } catch (error) {
      addToast(error instanceof Error ? error.message : 'Nao foi possivel salvar o artigo.', 'error');
    } finally {
      setSaving(false);
    }
  };

  if (draft) {
    return (
      <div className="space-y-5">
        <section className={ADMIN_PAGE_PANEL_CLASS}>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.16em] text-indigo-600">Edição editorial</p>
              <h2 className="mt-1 text-xl font-black text-slate-950 dark:text-white">
                {draft.id ? 'Editar notícia' : 'Nova notícia'}
              </h2>
            </div>
            <button type="button" onClick={() => setDraft(null)} className={ADMIN_SECONDARY_BUTTON_CLASS}>
              <X size={16} /> Fechar
            </button>
          </div>
        </section>

        <section className={ADMIN_PAGE_PANEL_CLASS}>
          <div className="grid gap-5 lg:grid-cols-2">
            <label className="lg:col-span-2">
              <span className={labelClass}>Título</span>
              <input className={fieldClass} value={draft.title} onChange={(event) => setDraft({ ...draft, title: event.target.value })} />
            </label>
            <label>
              <span className={labelClass}>Slug</span>
              <input className={fieldClass} value={draft.slug || ''} onChange={(event) => setDraft({ ...draft, slug: event.target.value })} placeholder="Gerado automaticamente se ficar vazio" />
            </label>
            <label>
              <span className={labelClass}>Categoria</span>
              <select
                className={fieldClass}
                value={draft.categoryId || ''}
                onChange={(event) => {
                  const category = categories.find((item) => item.id === Number(event.target.value));
                  setDraft({ ...draft, categoryId: category?.id || null, categoryName: category?.name || '' });
                }}
              >
                <option value="">Nova categoria</option>
                {categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
              </select>
            </label>
            {!draft.categoryId ? (
              <label>
                <span className={labelClass}>Nome da nova categoria</span>
                <input className={fieldClass} value={draft.categoryName || ''} onChange={(event) => setDraft({ ...draft, categoryName: event.target.value })} />
              </label>
            ) : null}
            <label className={draft.categoryId ? 'lg:col-span-2' : ''}>
              <span className={labelClass}>Tags</span>
              <input
                className={fieldClass}
                value={tagsText}
                onChange={(event) => setDraft({ ...draft, tags: event.target.value.split(',').map((item) => item.trim()).filter(Boolean) })}
                placeholder="edital, polícia militar, inscrições"
              />
            </label>
            <label className="lg:col-span-2">
              <span className={labelClass}>Resumo</span>
              <textarea className="min-h-28 w-full rounded-md border border-slate-200 bg-white p-3 text-sm leading-6 outline-none focus:border-indigo-500 dark:border-slate-700 dark:bg-slate-950" value={draft.excerpt} onChange={(event) => setDraft({ ...draft, excerpt: event.target.value })} />
            </label>
          </div>
        </section>

        <section className={ADMIN_PAGE_PANEL_CLASS}>
          <p className={labelClass}>Conteúdo</p>
          <RichTextEditor
            key={draft.id || 'new'}
            initialValue={draft.bodyHtml}
            onChange={(bodyHtml) => setDraft((current) => current ? { ...current, bodyHtml } : current)}
            placeholder="Escreva a notícia com subtítulos, listas, fontes e contexto útil."
            allowImages={false}
            contentClassName="min-h-[420px]"
          />
        </section>

        <section className={ADMIN_PAGE_PANEL_CLASS}>
          <div className="grid gap-5 lg:grid-cols-[280px_1fr]">
            <div>
              {draft.coverImageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={draft.coverImageUrl} alt={draft.coverImageAlt || ''} className="aspect-[16/9] w-full object-cover" />
              ) : (
                <div className="flex aspect-[16/9] items-center justify-center border border-dashed border-slate-300 text-slate-400 dark:border-slate-700">
                  <ImagePlus size={28} />
                </div>
              )}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/png,image/jpeg,image/webp"
                className="hidden"
                onChange={async (event) => {
                  const file = event.target.files?.[0];
                  if (!file) return;
                  setUploading(true);
                  try {
                    const asset = await adminService.uploadBrandAsset(file, 'blog-cover');
                    setDraft((current) => current ? { ...current, coverImageUrl: asset.url } : current);
                  } catch (error) {
                    addToast(error instanceof Error ? error.message : 'Não foi possível enviar a capa.', 'error');
                  } finally {
                    setUploading(false);
                    event.target.value = '';
                  }
                }}
              />
              <button type="button" onClick={() => fileInputRef.current?.click()} disabled={uploading} className={`mt-3 w-full ${ADMIN_SECONDARY_BUTTON_CLASS}`}>
                <ImagePlus size={16} /> {uploading ? 'Enviando...' : 'Selecionar capa'}
              </button>
            </div>
            <div className="grid gap-5">
              <label>
                <span className={labelClass}>Texto alternativo da capa</span>
                <input className={fieldClass} value={draft.coverImageAlt} onChange={(event) => setDraft({ ...draft, coverImageAlt: event.target.value })} />
              </label>
              <label>
                <span className={labelClass}>Fonte</span>
                <input className={fieldClass} value={draft.sourceName || ''} onChange={(event) => setDraft({ ...draft, sourceName: event.target.value })} placeholder="Ex.: Diário Oficial da União" />
              </label>
              <label>
                <span className={labelClass}>URL da fonte</span>
                <input className={fieldClass} value={draft.sourceUrl || ''} onChange={(event) => setDraft({ ...draft, sourceUrl: event.target.value })} />
              </label>
            </div>
          </div>
        </section>

        <section className={ADMIN_PAGE_PANEL_CLASS}>
          <div className="grid gap-5 lg:grid-cols-2">
            <label>
              <span className={labelClass}>Título SEO</span>
              <input className={fieldClass} value={draft.seoTitle || ''} onChange={(event) => setDraft({ ...draft, seoTitle: event.target.value })} />
            </label>
            <label>
              <span className={labelClass}>URL canônica externa (opcional)</span>
              <input className={fieldClass} value={draft.canonicalUrl || ''} onChange={(event) => setDraft({ ...draft, canonicalUrl: event.target.value })} />
            </label>
            <label className="lg:col-span-2">
              <span className={labelClass}>Descrição SEO</span>
              <textarea className="min-h-24 w-full rounded-md border border-slate-200 bg-white p-3 text-sm outline-none focus:border-indigo-500 dark:border-slate-700 dark:bg-slate-950" value={draft.seoDescription || ''} onChange={(event) => setDraft({ ...draft, seoDescription: event.target.value })} />
            </label>
          </div>
        </section>

        <section className={`${ADMIN_PAGE_PANEL_CLASS} sticky bottom-4 z-20`}>
          <div className="flex flex-wrap items-end gap-4">
            <label className="min-w-48 flex-1">
              <span className={labelClass}>Status</span>
              <select className={fieldClass} value={draft.status} onChange={(event) => setDraft({ ...draft, status: event.target.value as BlogArticle['status'] })}>
                <option value="draft">Rascunho</option>
                <option value="scheduled">Agendado</option>
                <option value="published">Publicado</option>
                <option value="archived">Arquivado</option>
              </select>
            </label>
            {draft.status === 'scheduled' ? (
              <label className="min-w-60 flex-1">
                <span className={labelClass}>Publicar em</span>
                <input type="datetime-local" className={fieldClass} value={draft.scheduledAt?.slice(0, 16) || ''} onChange={(event) => setDraft({ ...draft, scheduledAt: event.target.value })} />
              </label>
            ) : null}
            <label className="flex h-11 items-center gap-2 text-sm font-bold text-slate-700 dark:text-slate-200">
              <input type="checkbox" checked={draft.featured} onChange={(event) => setDraft({ ...draft, featured: event.target.checked })} />
              Destaque
            </label>
            <label className="flex h-11 items-center gap-2 text-sm font-bold text-slate-700 dark:text-slate-200">
              <input type="checkbox" checked={draft.allowComments} onChange={(event) => setDraft({ ...draft, allowComments: event.target.checked })} />
              Comentários
            </label>
            <button type="button" onClick={() => void save()} disabled={saving} className={ADMIN_PRIMARY_BUTTON_CLASS}>
              <Save size={17} /> {saving ? 'Salvando...' : 'Salvar artigo'}
            </button>
          </div>
        </section>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <section className={ADMIN_PAGE_PANEL_CLASS}>
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.16em] text-indigo-600">Conteúdo orgânico</p>
            <h2 className="mt-1 text-xl font-black text-slate-950 dark:text-white">Notícias do blog</h2>
            <p className="mt-1 text-sm text-slate-500">Edite, agende e publique conteúdo assinado por admin ou staff.</p>
          </div>
          <button type="button" onClick={() => setDraft(emptyDraft())} className={ADMIN_PRIMARY_BUTTON_CLASS}>
            <Plus size={17} /> Nova notícia
          </button>
        </div>
        <div className="mt-5 grid gap-3 md:grid-cols-[1fr_220px_auto]">
          <label className="relative">
            <Search size={17} className="absolute left-3 top-3 text-slate-400" />
            <input className={`${fieldClass} pl-10`} value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar notícia..." />
          </label>
          <select className={fieldClass} value={status} onChange={(event) => setStatus(event.target.value)}>
            <option value="">Todos os status</option>
            <option value="draft">Rascunho</option>
            <option value="scheduled">Agendado</option>
            <option value="published">Publicado</option>
            <option value="archived">Arquivado</option>
          </select>
          <button type="button" onClick={() => void load()} className={ADMIN_SECONDARY_BUTTON_CLASS}>Buscar</button>
        </div>
      </section>

      <section className="overflow-hidden border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-950">
        <div className="hidden grid-cols-[minmax(0,1fr)_140px_140px_110px] border-b border-slate-200 bg-slate-50 px-5 py-3 text-[10px] font-black uppercase tracking-[0.12em] text-slate-500 dark:border-slate-800 dark:bg-slate-900 md:grid">
          <span>Notícia</span><span>Categoria</span><span>Autor</span><span>Ações</span>
        </div>
        {loading ? (
          <p className="px-5 py-12 text-center text-sm text-slate-500">Carregando...</p>
        ) : items.length === 0 ? (
          <p className="px-5 py-12 text-center text-sm text-slate-500">Nenhuma notícia cadastrada.</p>
        ) : items.map((article) => (
          <div key={article.id} className="grid grid-cols-1 items-center gap-3 border-b border-slate-100 px-5 py-4 last:border-b-0 dark:border-slate-800 md:grid-cols-[minmax(0,1fr)_140px_140px_110px] md:gap-4">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <Newspaper size={15} className="shrink-0 text-indigo-600" />
                <p className="truncate text-sm font-black text-slate-900 dark:text-white">{article.title}</p>
              </div>
              <p className="mt-1 truncate text-xs text-slate-500">{article.status} · {article.updatedAt}</p>
            </div>
            <span className="truncate text-xs font-semibold text-slate-600 dark:text-slate-300">
              <span className="mr-1 text-slate-400 md:hidden">Categoria:</span>{article.category.name}
            </span>
            <span className="truncate text-xs font-semibold text-slate-600 dark:text-slate-300">
              <span className="mr-1 text-slate-400 md:hidden">Autor:</span>{article.author.name}
            </span>
            <div className="flex items-center gap-2">
              <button type="button" title="Editar" onClick={() => void editArticle(article.id)} className="rounded-md border border-slate-200 p-2 text-slate-600 hover:text-indigo-600 dark:border-slate-700">
                <FilePenLine size={15} />
              </button>
              <button
                type="button"
                title="Arquivar"
                onClick={async () => {
                  await blogService.archive(article.id);
                  await load();
                }}
                className="rounded-md border border-rose-200 p-2 text-rose-600"
              >
                <Archive size={15} />
              </button>
            </div>
          </div>
        ))}
      </section>
    </div>
  );
}
