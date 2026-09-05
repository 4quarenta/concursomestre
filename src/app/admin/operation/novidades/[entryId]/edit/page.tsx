'use client';

import React from 'react';
import Link from 'next/link';
import { ArrowLeft, ExternalLink, Loader2, Plus, Save, Trash2 } from 'lucide-react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@providers/AuthProvider';
import { useToast } from '@providers/ToastProvider';
import { canAccessAdminPanel } from '@services/auth';
import {
  changelogService,
  type ChangelogDraft,
  type ChangelogEntry,
  type ChangelogSection,
} from '@services/changelog';
import AdminStandaloneShell from '../../../../components/shared/AdminStandaloneShell';
import AdminConfirmDialog from '../../../../components/ui/AdminConfirmDialog';
import { AdminEditorShell } from '../../../../components/shared/AdminDesignSystem';
import {
  ADMIN_FIELD_CLASS,
  ADMIN_PRIMARY_BUTTON_CLASS,
  ADMIN_SECONDARY_BUTTON_CLASS,
  ADMIN_SURFACE_CLASS,
  ADMIN_SURFACE_HEADER_CLASS,
  ADMIN_TEXTAREA_CLASS,
} from '../../../../components/shared/adminPanelStyles';
import {
  buildAdminChangelogEditPath,
  buildAdminPath,
} from '../../../../config/adminPageNavigationConfig';
import RouteContentSkeleton from '@/components/shared/feedback/RouteContentSkeleton';

const today = () => new Date().toISOString().slice(0, 10);
const emptySection = (): ChangelogSection => ({ title: 'O que mudou', icon: 'Sparkles', items: [''] });
const emptyDraft = (): ChangelogDraft => ({
  id: null,
  title: '',
  slug: '',
  releaseDate: today(),
  description: '',
  content: [emptySection()],
  status: 'draft',
});

const slugify = (value: string) => value
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/^-+|-+$/g, '')
  .slice(0, 190);

const entryToDraft = (entry: ChangelogEntry): ChangelogDraft => ({
  id: entry.id,
  version: entry.version,
  title: entry.title,
  slug: entry.slug,
  releaseDate: entry.releaseDate,
  description: entry.description,
  content: entry.content.length > 0 ? entry.content : [emptySection()],
  status: entry.status,
});

const labelClass = 'mb-2 block text-[10px] font-bold uppercase tracking-[0.12em] text-slate-500';

export default function AdminChangelogEditPage() {
  const params = useParams<{ entryId?: string | string[] }>();
  const router = useRouter();
  const { currentUser, isLoading: isAuthLoading } = useAuth();
  const { addToast } = useToast();
  const rawEntryId = Array.isArray(params.entryId) ? params.entryId[0] : params.entryId;
  const isNew = rawEntryId === 'new';
  const entryId = isNew ? null : Number(rawEntryId);
  const returnPath = buildAdminPath('operation', 'novidades');
  const [draft, setDraft] = React.useState<ChangelogDraft>(emptyDraft);
  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  const [loadError, setLoadError] = React.useState('');
  const [archiveOpen, setArchiveOpen] = React.useState(false);
  const [archiving, setArchiving] = React.useState(false);

  React.useEffect(() => {
    if (!isAuthLoading && !canAccessAdminPanel(currentUser)) router.replace('/');
  }, [currentUser, isAuthLoading, router]);

  React.useEffect(() => {
    if (isAuthLoading || !canAccessAdminPanel(currentUser)) return;
    let active = true;
    const load = async () => {
      setLoading(true);
      setLoadError('');
      try {
        if (!isNew && (!entryId || entryId <= 0)) throw new Error('Identificador da novidade inválido.');
        const entry = isNew ? null : await changelogService.adminDetail(entryId as number);
        if (active) setDraft(entry ? entryToDraft(entry) : emptyDraft());
      } catch (error) {
        if (active) setLoadError(error instanceof Error ? error.message : 'Não foi possível abrir a novidade.');
      } finally {
        if (active) setLoading(false);
      }
    };
    void load();
    return () => { active = false; };
  }, [currentUser, entryId, isAuthLoading, isNew]);

  const updateSection = (index: number, patch: Partial<ChangelogSection>) => {
    setDraft((current) => ({
      ...current,
      content: current.content.map((section, sectionIndex) => (
        sectionIndex === index ? { ...section, ...patch } : section
      )),
    }));
  };

  const save = async () => {
    setSaving(true);
    try {
      const normalized = {
        ...draft,
        content: draft.content
          .map((section) => ({
            ...section,
            title: section.title.trim(),
            items: section.items.map((item) => item.trim()).filter(Boolean),
          }))
          .filter((section) => section.title || section.items.length > 0),
      };
      const saved = await changelogService.save(normalized);
      setDraft(entryToDraft(saved));
      addToast(saved.status === 'published' ? 'Novidade publicada.' : 'Novidade salva.', 'success');
      if (isNew) router.replace(buildAdminChangelogEditPath(saved.id));
    } catch (error) {
      addToast(error instanceof Error ? error.message : 'Não foi possível salvar a novidade.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const archive = async () => {
    if (!draft.id) return;
    setArchiving(true);
    try {
      await changelogService.archive(draft.id);
      addToast('Novidade arquivada.', 'success');
      router.push(returnPath);
    } catch (error) {
      addToast(error instanceof Error ? error.message : 'Não foi possível arquivar a novidade.', 'error');
    } finally {
      setArchiving(false);
    }
  };

  return (
    <AdminStandaloneShell
      activeTab="operation"
      activeSectionKey="novidades"
      pageTitle={isNew ? 'Nova novidade' : 'Editar novidade'}
      pageDescription="Comunique mudanças da plataforma de forma simples e útil."
      showPageHeader={false}
    >
      <AdminEditorShell>
      <div className="space-y-4">
        <section className={`${ADMIN_SURFACE_CLASS} p-5`}>
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-sky-700">Novidades</p>
              <h1 className="mt-1 text-xl font-semibold text-slate-950 dark:text-white">{isNew ? 'Adicionar novidade' : draft.title || 'Editar novidade'}</h1>
              <p className="mt-1 text-sm text-slate-500">Explique o benefício para o usuário, sem termos técnicos internos.</p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Link href={returnPath} className={ADMIN_SECONDARY_BUTTON_CLASS}><ArrowLeft size={15} /> Voltar</Link>
              {draft.status === 'published' && draft.slug ? <Link href={`/novidades#${draft.slug}`} target="_blank" className={ADMIN_SECONDARY_BUTTON_CLASS}><ExternalLink size={15} /> Visualizar</Link> : null}
              <button type="button" onClick={() => void save()} disabled={saving || loading} className={ADMIN_PRIMARY_BUTTON_CLASS}>
                {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}{saving ? 'Salvando...' : isNew ? 'Salvar rascunho' : 'Salvar alterações'}
              </button>
            </div>
          </div>
        </section>

        {loading ? (
          <RouteContentSkeleton variant="admin" />
        ) : loadError ? (
          <section className={`${ADMIN_SURFACE_CLASS} p-8 text-center text-sm text-red-600 dark:text-red-400`}>{loadError}</section>
        ) : (
          <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
            <div className="space-y-4">
              <section className={ADMIN_SURFACE_CLASS}>
                <div className={ADMIN_SURFACE_HEADER_CLASS}><h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Mensagem principal</h2></div>
                <div className="grid gap-4 p-5 md:grid-cols-2">
                  <label className="md:col-span-2">
                    <span className={labelClass}>Título</span>
                    <input className={`${ADMIN_FIELD_CLASS} w-full`} value={draft.title} onChange={(event) => setDraft((current) => ({ ...current, title: event.target.value, slug: slugify(event.target.value) }))} placeholder="Ex.: Agora ficou mais fácil revisar questões" />
                  </label>
                  <label>
                    <span className={labelClass}>Identificador</span>
                    <input className={`${ADMIN_FIELD_CLASS} w-full bg-slate-50 text-slate-500 dark:bg-slate-900`} value={draft.slug} readOnly />
                  </label>
                  <label>
                    <span className={labelClass}>Data</span>
                    <input type="date" className={`${ADMIN_FIELD_CLASS} w-full`} value={draft.releaseDate} onChange={(event) => setDraft((current) => ({ ...current, releaseDate: event.target.value }))} />
                  </label>
                  <label className="md:col-span-2">
                    <span className={labelClass}>Resumo</span>
                    <textarea className={`${ADMIN_TEXTAREA_CLASS} min-h-28`} value={draft.description} onChange={(event) => setDraft((current) => ({ ...current, description: event.target.value }))} placeholder="Conte em uma frase o que mudou e por que isso é útil." />
                  </label>
                </div>
              </section>

              <section className={ADMIN_SURFACE_CLASS}>
                <div className={`${ADMIN_SURFACE_HEADER_CLASS} flex items-center justify-between gap-3`}>
                  <div><h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">O que mudou</h2><p className="mt-1 text-xs text-slate-500">Use frases curtas e centradas no benefício.</p></div>
                  <button type="button" onClick={() => setDraft((current) => ({ ...current, content: [...current.content, emptySection()] }))} className={ADMIN_SECONDARY_BUTTON_CLASS}><Plus size={14} /> Adicionar bloco</button>
                </div>
                <div className="space-y-4 p-5">
                  {draft.content.map((section, index) => (
                    <div key={`${index}-${section.title}`} className="rounded-sm border border-slate-200 p-4 dark:border-slate-700">
                      <div className="flex items-start gap-3">
                        <div className="grid min-w-0 flex-1 gap-3">
                          <label><span className={labelClass}>Título do bloco</span><input className={`${ADMIN_FIELD_CLASS} w-full`} value={section.title} onChange={(event) => updateSection(index, { title: event.target.value })} /></label>
                          <label><span className={labelClass}>Itens, um por linha</span><textarea className={`${ADMIN_TEXTAREA_CLASS} min-h-36`} value={section.items.join('\n')} onChange={(event) => updateSection(index, { items: event.target.value.split('\n') })} placeholder="Explique cada melhoria em uma linha." /></label>
                        </div>
                        <button type="button" aria-label="Remover bloco" title="Remover bloco" onClick={() => setDraft((current) => ({ ...current, content: current.content.filter((_, itemIndex) => itemIndex !== index) }))} className="mt-6 inline-flex h-9 w-9 items-center justify-center rounded-sm border border-red-200 text-red-600 hover:bg-red-50"><Trash2 size={15} /></button>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            </div>

            <aside className="space-y-4">
              <section className={ADMIN_SURFACE_CLASS}>
                <div className={ADMIN_SURFACE_HEADER_CLASS}><h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Publicação</h2></div>
                <div className="space-y-4 p-5">
                  <label><span className={labelClass}>Status</span><select className={`${ADMIN_FIELD_CLASS} w-full`} value={draft.status} onChange={(event) => setDraft((current) => ({ ...current, status: event.target.value as ChangelogDraft['status'] }))}><option value="draft">Rascunho</option><option value="published">Publicado</option><option value="archived">Arquivado</option></select></label>
                  <p className="text-xs leading-5 text-slate-500">Somente itens publicados aparecem em `/novidades`.</p>
                  {draft.id ? <button type="button" onClick={() => setArchiveOpen(true)} className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-sm border border-red-200 text-sm font-bold text-red-600 hover:bg-red-50"><Trash2 size={15} /> Arquivar</button> : null}
                </div>
              </section>
            </aside>
          </div>
        )}
      </div>
      </AdminEditorShell>

      <AdminConfirmDialog isOpen={archiveOpen} title="Arquivar novidade" description="A novidade deixará de aparecer para os usuários, mas continuará registrada no arquivo administrativo." confirmLabel="Arquivar" loading={archiving} onCancel={() => setArchiveOpen(false)} onConfirm={() => void archive()} />
    </AdminStandaloneShell>
  );
}
