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
import { Archive, ArrowLeft, ExternalLink, ImagePlus, Loader2, Save } from 'lucide-react';
import { useParams, useRouter } from 'next/navigation';
import RichTextEditor from '@/components/shared/ui/RichTextEditor';
import { useAuth } from '@providers/AuthProvider';
import { useToast } from '@providers/ToastProvider';
import { adminService } from '@services/admin/adminService';
import { canAccessAdminPanel } from '@services/auth';
import {
  blogService,
  type BlogArticle,
  type BlogArticleInput,
  type BlogCategory,
  type BlogTag,
  type BlogTagKind,
} from '@services/blog';
import AdminConfirmDialog from '../../../../components/ui/AdminConfirmDialog';
import AdminStandaloneShell from '../../../../components/shared/AdminStandaloneShell';
import { SmartTagSelector } from '../../../../components/database/SmartTagSelector';
import {
  ADMIN_FIELD_CLASS,
  ADMIN_PRIMARY_BUTTON_CLASS,
  ADMIN_SECONDARY_BUTTON_CLASS,
  ADMIN_SURFACE_CLASS,
  ADMIN_SURFACE_HEADER_CLASS,
  ADMIN_TEXTAREA_CLASS,
} from '../../../../components/shared/adminPanelStyles';
import {
  buildAdminBlogEditPath,
  buildAdminPath,
} from '../../../../config/adminPageNavigationConfig';
import RouteContentSkeleton from '@/components/shared/feedback/RouteContentSkeleton';

const emptyDraft = (): BlogArticleInput => ({
  id: null,
  title: '',
  slug: '',
  excerpt: '',
  bodyHtml: '',
  taxonomy: {
    category: null,
    tags: [],
  },
  coverImageUrl: '',
  coverImageAlt: '',
  status: 'draft',
  featured: false,
  allowComments: true,
  sourceName: '',
  sourceUrl: '',
  scheduledAt: null,
});

const slugify = (value: string) => value
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/^-+|-+$/g, '')
  .slice(0, 240);

const toLocalDateTimeInput = (value?: string | null) => {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
};

const articleToDraft = (article: BlogArticle): BlogArticleInput => ({
  id: article.id,
  title: article.title,
  slug: article.slug,
  excerpt: article.excerpt,
  bodyHtml: article.bodyHtml || '',
  taxonomy: {
    category: article.taxonomy.category,
    tags: article.taxonomy.tags,
  },
  coverImageUrl: article.coverImageUrl || '',
  coverImageAlt: article.coverImageAlt || '',
  status: article.status,
  featured: article.featured,
  allowComments: article.allowComments,
  sourceName: article.sourceName || '',
  sourceUrl: article.sourceUrl || '',
  scheduledAt: toLocalDateTimeInput(article.scheduledAt),
});

const labelClass = 'mb-2 block text-[10px] font-bold uppercase tracking-[0.12em] text-slate-500';
const BLOG_TAG_KINDS: Array<{ value: BlogTagKind; label: string }> = [
  { value: 'general', label: 'Geral' },
  { value: 'topic', label: 'Assunto' },
  { value: 'region', label: 'Região' },
  { value: 'state', label: 'Estado' },
  { value: 'career', label: 'Carreira' },
  { value: 'organization', label: 'Órgão' },
  { value: 'exam_board', label: 'Banca' },
];

const AdminBlogEditPage = () => {
  const params = useParams<{ articleId?: string | string[] }>();
  const router = useRouter();
  const { currentUser, isLoading: isAuthLoading } = useAuth();
  const { addToast } = useToast();
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const rawArticleId = Array.isArray(params.articleId) ? params.articleId[0] : params.articleId;
  const isNewArticle = rawArticleId === 'new';
  const articleId = isNewArticle ? null : Number(rawArticleId);
  const returnPath = buildAdminPath('operation', 'blog');

  const [draft, setDraft] = React.useState<BlogArticleInput>(emptyDraft);
  const [categories, setCategories] = React.useState<BlogCategory[]>([]);
  const [tags, setTags] = React.useState<BlogTag[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  const [uploading, setUploading] = React.useState(false);
  const [loadError, setLoadError] = React.useState('');
  const [archiveOpen, setArchiveOpen] = React.useState(false);
  const [archiving, setArchiving] = React.useState(false);

  React.useEffect(() => {
    if (!isAuthLoading && !canAccessAdminPanel(currentUser)) {
      router.replace('/');
    }
  }, [currentUser, isAuthLoading, router]);

  React.useEffect(() => {
    if (isAuthLoading || !canAccessAdminPanel(currentUser)) return;

    let active = true;
    const load = async () => {
      setLoading(true);
      setLoadError('');
      try {
        if (!isNewArticle && (!articleId || articleId <= 0)) {
          throw new Error('Identificador do post inválido.');
        }

        const [categoryItems, tagItems, article] = await Promise.all([
          blogService.categories(),
          blogService.adminTags(),
          isNewArticle ? Promise.resolve(null) : blogService.adminDetail(articleId as number),
        ]);
        if (!active) return;

        setCategories(categoryItems);
        setTags(tagItems);
        const nextDraft = article ? articleToDraft(article) : emptyDraft();
        setDraft(nextDraft);
      } catch (error) {
        if (active) setLoadError(error instanceof Error ? error.message : 'Não foi possível abrir o post.');
      } finally {
        if (active) setLoading(false);
      }
    };

    void load();
    return () => {
      active = false;
    };
  }, [articleId, currentUser, isAuthLoading, isNewArticle]);

  const updateDraft = <K extends keyof BlogArticleInput>(key: K, value: BlogArticleInput[K]) => {
    setDraft((current) => ({ ...current, [key]: value }));
  };

  const updateTitle = (title: string) => {
    setDraft((current) => ({
      ...current,
      title,
      slug: slugify(title),
    }));
  };

  const updateTags = (labels: string[]) => {
    setDraft((current) => {
      const nextTags = labels.map((label) => {
        const normalizedSlug = slugify(label);
        return tags.find((tag) => tag.slug === normalizedSlug)
          || current.taxonomy.tags.find((tag) => tag.slug === normalizedSlug)
          || { id: null, label, slug: normalizedSlug, kind: 'general' as const };
      });
      return {
        ...current,
        taxonomy: {
          ...current.taxonomy,
          tags: nextTags,
        },
      };
    });
  };

  const updateTagKind = (slug: string, kind: BlogTagKind) => {
    setDraft((current) => ({
      ...current,
      taxonomy: {
        ...current.taxonomy,
        tags: current.taxonomy.tags.map((tag) => (tag.slug === slug ? { ...tag, kind } : tag)),
      },
    }));
  };

  const save = async () => {
    setSaving(true);
    try {
      const saved = await blogService.save({
        ...draft,
        scheduledAt: draft.status === 'scheduled' && draft.scheduledAt
          ? new Date(draft.scheduledAt).toISOString()
          : null,
      });
      const nextDraft = articleToDraft(saved);
      setDraft(nextDraft);
      addToast(saved.status === 'published' ? 'Post publicado.' : 'Post salvo.', 'success');
      if (isNewArticle) router.replace(buildAdminBlogEditPath(saved.id));
    } catch (error) {
      addToast(error instanceof Error ? error.message : 'Não foi possível salvar o post.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const archive = async () => {
    if (!draft.id) return;
    setArchiving(true);
    try {
      await blogService.archive(draft.id);
      addToast('Post arquivado.', 'success');
      router.push(returnPath);
    } catch (error) {
      addToast(error instanceof Error ? error.message : 'Não foi possível arquivar o post.', 'error');
    } finally {
      setArchiving(false);
    }
  };

  const uploadCover = async (file?: File) => {
    if (!file) return;
    setUploading(true);
    try {
      const asset = await adminService.uploadBrandAsset(file, 'blog-cover');
      updateDraft('coverImageUrl', asset.url);
    } catch (error) {
      addToast(error instanceof Error ? error.message : 'Não foi possível enviar a capa.', 'error');
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const uploadInlineImage = async (file: File) => {
    try {
      const asset = await adminService.uploadBrandAsset(file, 'blog-content');
      return { url: asset.url, alt: file.name || 'Imagem do post' };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Não foi possível enviar a imagem.';
      addToast(message, 'error');
      throw new Error(message);
    }
  };

  return (
    <AdminStandaloneShell
      activeTab="operation"
      activeSectionKey="blog"
      pageTitle={isNewArticle ? 'Novo post' : 'Editar post'}
      pageDescription="Conteúdo editorial, publicação e SEO do blog."
      showPageHeader={false}
    >
      <div className="space-y-4">
        <section className={`${ADMIN_SURFACE_CLASS} p-5`}>
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-sky-700">Blog</p>
              <h1 className="mt-1 text-xl font-semibold text-slate-950 dark:text-white">
                {isNewArticle ? 'Adicionar post' : draft.title || 'Editar post'}
              </h1>
              <p className="mt-1 text-sm text-slate-500">O autor será definido pela conta administrativa que salvar o conteúdo.</p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Link href={returnPath} className={ADMIN_SECONDARY_BUTTON_CLASS}>
                <ArrowLeft size={15} /> Voltar
              </Link>
              {draft.status === 'published' && draft.slug ? (
                <Link href={`/blog/${draft.slug}`} target="_blank" className={ADMIN_SECONDARY_BUTTON_CLASS}>
                  <ExternalLink size={15} /> Visualizar
                </Link>
              ) : null}
              <button type="button" onClick={() => void save()} disabled={saving || loading} className={ADMIN_PRIMARY_BUTTON_CLASS}>
                {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                {saving ? 'Salvando...' : 'Salvar post'}
              </button>
            </div>
          </div>
        </section>

        {loading ? (
          <RouteContentSkeleton variant="admin" />
        ) : loadError ? (
          <section className={`${ADMIN_SURFACE_CLASS} p-8 text-center text-sm text-red-600 dark:text-red-400`}>{loadError}</section>
        ) : (
          <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_340px]">
            <div className="space-y-4">
              <section className={ADMIN_SURFACE_CLASS}>
                <div className={ADMIN_SURFACE_HEADER_CLASS}>
                  <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Dados editoriais</h2>
                </div>
                <div className="grid gap-4 p-5 md:grid-cols-2">
                  <label className="md:col-span-2">
                    <span className={labelClass}>Título</span>
                    <input className={`${ADMIN_FIELD_CLASS} w-full`} value={draft.title} onChange={(event) => updateTitle(event.target.value)} />
                  </label>
                  <label>
                    <span className={labelClass}>Slug</span>
                    <input className={`${ADMIN_FIELD_CLASS} w-full bg-slate-50 text-slate-500 dark:bg-slate-900`} value={draft.slug || ''} readOnly placeholder="Gerado automaticamente" />
                  </label>
                  <div className="md:col-span-2">
                    <SmartTagSelector
                      label="Categoria"
                      options={categories}
                      selected={draft.taxonomy.category ? [draft.taxonomy.category] : []}
                      multiple={false}
                      placeholder="Busque ou crie uma categoria"
                      onChange={(values) => {
                        const label = String(values[0] || '').trim();
                        const normalizedLabel = slugify(label);
                        const existing = categories.find((category) => (
                          slugify(category.label) === normalizedLabel
                        ));
                        setDraft((current) => ({
                          ...current,
                          taxonomy: {
                            ...current.taxonomy,
                            category: !label
                              ? null
                              : existing
                                ? { id: existing.id, label: existing.label, slug: existing.slug }
                                : { id: null, label, slug: normalizedLabel },
                          },
                        }));
                      }}
                    />
                  </div>
                  <div className="md:col-span-2 space-y-3">
                    <SmartTagSelector
                      label="Tags editoriais"
                      options={tags}
                      selected={draft.taxonomy.tags}
                      placeholder="Busque ou crie tags para região, carreira, banca, órgão ou assunto"
                      onChange={updateTags}
                    />
                    {draft.taxonomy.tags.length > 0 ? (
                      <div className="grid gap-2 sm:grid-cols-2">
                        {draft.taxonomy.tags.map((tag) => (
                          <label key={tag.slug} className="flex items-center justify-between gap-3 rounded-sm border border-slate-200 bg-slate-50 px-3 py-2 dark:border-slate-700 dark:bg-slate-900">
                            <span className="min-w-0 truncate text-xs font-semibold text-slate-700 dark:text-slate-200">{tag.label}</span>
                            <select
                              value={tag.kind}
                              onChange={(event) => updateTagKind(tag.slug, event.target.value as BlogTagKind)}
                              className={`${ADMIN_FIELD_CLASS} h-9 min-w-28 text-xs`}
                              aria-label={`Tipo da tag ${tag.label}`}
                            >
                              {BLOG_TAG_KINDS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                            </select>
                          </label>
                        ))}
                      </div>
                    ) : null}
                    <p className="text-xs text-slate-500">Classifique estados e regiões corretamente para criar páginas editoriais navegáveis e indexáveis.</p>
                  </div>
                  <label className="md:col-span-2">
                    <span className={labelClass}>Resumo</span>
                    <textarea className={`${ADMIN_TEXTAREA_CLASS} min-h-28`} value={draft.excerpt} onChange={(event) => updateDraft('excerpt', event.target.value)} />
                  </label>
                </div>
              </section>

              <section className={ADMIN_SURFACE_CLASS}>
                <div className={ADMIN_SURFACE_HEADER_CLASS}>
                  <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Conteúdo</h2>
                </div>
                <div className="p-5">
                  <RichTextEditor
                    key={draft.id || 'new-blog-post'}
                    initialValue={draft.bodyHtml}
                    onChange={(bodyHtml) => updateDraft('bodyHtml', bodyHtml)}
                    placeholder="Escreva o post com subtítulos, listas, fontes e informações úteis."
                    allowImages
                    allowTables
                    onImageUpload={uploadInlineImage}
                    contentClassName="min-h-[680px] max-h-none"
                  />
                </div>
              </section>

              <section className={ADMIN_SURFACE_CLASS}>
                <div className={ADMIN_SURFACE_HEADER_CLASS}>
                  <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">SEO</h2>
                </div>
                <div className="space-y-3 p-5">
                  <p className="text-sm text-slate-500 dark:text-slate-400">Título, descrição e URL canônica usam automaticamente os dados do post. As tags editoriais alimentam palavras-chave e páginas temáticas.</p>
                  <div className="rounded-sm border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300">
                    <span className="font-semibold">Palavras-chave: </span>
                    {draft.taxonomy.tags.map((tag) => tag.label).join(', ') || 'Nenhuma tag selecionada.'}
                  </div>
                </div>
              </section>
            </div>

            <aside className="space-y-4">
              <section className={ADMIN_SURFACE_CLASS}>
                <div className={ADMIN_SURFACE_HEADER_CLASS}>
                  <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Publicação</h2>
                </div>
                <div className="space-y-4 p-5">
                  <label>
                    <span className={labelClass}>Status</span>
                    <select className={`${ADMIN_FIELD_CLASS} w-full`} value={draft.status} onChange={(event) => updateDraft('status', event.target.value as BlogArticle['status'])}>
                      <option value="draft">Rascunho</option>
                      <option value="scheduled">Agendado</option>
                      <option value="published">Publicado</option>
                      <option value="archived">Arquivado</option>
                    </select>
                  </label>
                  {draft.status === 'scheduled' ? (
                    <label>
                      <span className={labelClass}>Publicar em</span>
                      <input type="datetime-local" className={`${ADMIN_FIELD_CLASS} w-full`} value={draft.scheduledAt?.slice(0, 16) || ''} onChange={(event) => updateDraft('scheduledAt', event.target.value)} />
                    </label>
                  ) : null}
                  <label className="flex items-center gap-2 text-sm font-medium text-slate-700 dark:text-slate-200">
                    <input type="checkbox" checked={draft.featured} onChange={(event) => updateDraft('featured', event.target.checked)} /> Em destaque
                  </label>
                  <label className="flex items-center gap-2 text-sm font-medium text-slate-700 dark:text-slate-200">
                    <input type="checkbox" checked={draft.allowComments} onChange={(event) => updateDraft('allowComments', event.target.checked)} /> Permitir comentários
                  </label>
                </div>
              </section>

              <section className={ADMIN_SURFACE_CLASS}>
                <div className={ADMIN_SURFACE_HEADER_CLASS}>
                  <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Imagem de capa</h2>
                </div>
                <div className="space-y-4 p-5">
                  {draft.coverImageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={draft.coverImageUrl} alt={draft.coverImageAlt || ''} className="aspect-video w-full border border-slate-200 object-cover dark:border-slate-700" />
                  ) : (
                    <div className="flex aspect-video items-center justify-center border border-dashed border-slate-300 text-slate-400 dark:border-slate-700">
                      <ImagePlus size={28} />
                    </div>
                  )}
                  <input ref={fileInputRef} type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={(event) => void uploadCover(event.target.files?.[0])} />
                  <button type="button" onClick={() => fileInputRef.current?.click()} disabled={uploading} className={`w-full ${ADMIN_SECONDARY_BUTTON_CLASS}`}>
                    {uploading ? <Loader2 size={15} className="animate-spin" /> : <ImagePlus size={15} />}
                    {uploading ? 'Enviando...' : 'Selecionar capa'}
                  </button>
                  <label>
                    <span className={labelClass}>Texto alternativo</span>
                    <input className={`${ADMIN_FIELD_CLASS} w-full`} value={draft.coverImageAlt} onChange={(event) => updateDraft('coverImageAlt', event.target.value)} />
                  </label>
                </div>
              </section>

              <section className={ADMIN_SURFACE_CLASS}>
                <div className={ADMIN_SURFACE_HEADER_CLASS}>
                  <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Fonte</h2>
                </div>
                <div className="space-y-4 p-5">
                  <label>
                    <span className={labelClass}>Nome da fonte</span>
                    <input className={`${ADMIN_FIELD_CLASS} w-full`} value={draft.sourceName || ''} onChange={(event) => updateDraft('sourceName', event.target.value)} />
                  </label>
                  <label>
                    <span className={labelClass}>URL da fonte</span>
                    <input className={`${ADMIN_FIELD_CLASS} w-full`} value={draft.sourceUrl || ''} onChange={(event) => updateDraft('sourceUrl', event.target.value)} />
                  </label>
                </div>
              </section>

              <section className={`${ADMIN_SURFACE_CLASS} space-y-2 p-5`}>
                <button type="button" onClick={() => void save()} disabled={saving} className={`w-full justify-center ${ADMIN_PRIMARY_BUTTON_CLASS}`}>
                  {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                  {saving ? 'Salvando...' : 'Salvar post'}
                </button>
                {draft.id ? (
                  <button type="button" onClick={() => setArchiveOpen(true)} className="inline-flex w-full items-center justify-center gap-2 rounded-sm border border-red-300 px-4 py-2 text-sm font-semibold text-red-700 hover:bg-red-50 dark:border-red-800 dark:text-red-300 dark:hover:bg-red-950/30">
                    <Archive size={15} /> Arquivar post
                  </button>
                ) : null}
              </section>
            </aside>
          </div>
        )}
      </div>

      <AdminConfirmDialog
        isOpen={archiveOpen}
        title="Arquivar post"
        description="O post deixará de aparecer no blog público, mas seu histórico será preservado."
        confirmLabel="Arquivar post"
        loading={archiving}
        onCancel={() => setArchiveOpen(false)}
        onConfirm={() => void archive()}
      />
    </AdminStandaloneShell>
  );
};

export default AdminBlogEditPage;
