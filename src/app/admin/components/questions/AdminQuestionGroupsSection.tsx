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
import { Image as ImageIcon, Link2, Loader2, Pencil, Save, Trash2, Upload, X } from 'lucide-react';
import { readApiErrorMessage, resolveApiResourceUrl } from '@services/api';
import { adminService, type AdminQuestionGroupItem } from '@services/admin/adminService';
import {
  ADMIN_FIELD_CLASS,
  ADMIN_MODAL_FOOTER_CLASS,
  ADMIN_MODAL_HEADER_CLASS,
  ADMIN_MODAL_PANEL_CLASS,
  ADMIN_PAGE_PANEL_CLASS,
  ADMIN_PRIMARY_BUTTON_CLASS,
  ADMIN_SECONDARY_BUTTON_CLASS,
  ADMIN_SURFACE_CLASS,
  ADMIN_SURFACE_HEADER_CLASS,
  ADMIN_TEXTAREA_CLASS,
} from '../shared/adminPanelStyles';
import AdminCollectionToolbar from '../shared/AdminCollectionToolbar';
import AdminConfirmDialog from '../ui/AdminConfirmDialog';

interface QuestionContextDraft {
  id?: number | null;
  enunciado: string;
  texto: string;
  image_url: string;
  questionIds: string[];
  questionIdInput: string;
}

type PendingDelete =
  | { mode: 'single'; context: AdminQuestionGroupItem }
  | { mode: 'bulk'; ids: number[] };

const EMPTY_DRAFT: QuestionContextDraft = {
  id: null,
  enunciado: '',
  texto: '',
  image_url: '',
  questionIds: [],
  questionIdInput: '',
};

const stripHtml = (value: string) => value.replace(/<[^>]*>?/gm, '').replace(/\s+/g, ' ').trim();

const normalizeQuestionIds = (value: unknown): string[] => {
  const source = Array.isArray(value)
    ? value
    : String(value ?? '').split(/[,\s;]+/);
  const seen = new Set<string>();

  source.forEach((item) => {
    const id = String(item ?? '').trim();
    if (/^\d+$/.test(id) && Number(id) > 0) {
      seen.add(String(Number(id)));
    }
  });

  return Array.from(seen);
};

const getContextQuestionIds = (context: AdminQuestionGroupItem) =>
  normalizeQuestionIds(context.question_ids ?? context.questionIds ?? []);

const getContextTitle = (context: AdminQuestionGroupItem) => {
  const title = stripHtml(
    context.enunciado_clean
    || context.enunciadoClean
    || context.enunciado
    || context.texto
    || '',
  );
  return title || `Contexto #${context.id}`;
};

const getContextExcerpt = (context: AdminQuestionGroupItem) => {
  const text = stripHtml(context.texto || context.enunciado_clean || context.enunciadoClean || context.enunciado || '');
  return text || 'Sem texto cadastrado.';
};

const getContextUsage = (context: AdminQuestionGroupItem) => {
  const ids = getContextQuestionIds(context);
  return Number(context.question_count ?? context.questionCount ?? ids.length ?? 0);
};

const buildDraftFromContext = (context: AdminQuestionGroupItem): QuestionContextDraft => ({
  id: context.id,
  enunciado: context.enunciado || '',
  texto: context.texto || '',
  image_url: context.image_url || context.imageUrl || '',
  questionIds: getContextQuestionIds(context),
  questionIdInput: '',
});

const AdminQuestionGroupsSection = () => {
  const [contexts, setContexts] = React.useState<AdminQuestionGroupItem[]>([]);
  const [filter, setFilter] = React.useState('');
  const [draft, setDraft] = React.useState<QuestionContextDraft>(EMPTY_DRAFT);
  const [isEditorOpen, setIsEditorOpen] = React.useState(false);
  const [selectedIds, setSelectedIds] = React.useState<Set<number>>(() => new Set());
  const [bulkAction, setBulkAction] = React.useState('');
  const [pendingDelete, setPendingDelete] = React.useState<PendingDelete | null>(null);
  const [isLoading, setIsLoading] = React.useState(false);
  const [isSaving, setIsSaving] = React.useState(false);
  const [isDeleting, setIsDeleting] = React.useState(false);
  const [isUploading, setIsUploading] = React.useState(false);
  const [notice, setNotice] = React.useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const uploadInputRef = React.useRef<HTMLInputElement | null>(null);

  const loadContexts = React.useCallback(async () => {
    setIsLoading(true);
    try {
      const items = await adminService.getQuestionGroups({ keyword: filter });
      setContexts(items);
      setSelectedIds((previous) => {
        const availableIds = new Set(items.map((item) => Number(item.id)));
        return new Set(Array.from(previous).filter((id) => availableIds.has(id)));
      });
    } catch (error) {
      setNotice({ type: 'error', message: readApiErrorMessage(error, 'Nao foi possivel carregar os contextos.') });
    } finally {
      setIsLoading(false);
    }
  }, [filter]);

  React.useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      loadContexts();
    }, 200);

    return () => window.clearTimeout(timeoutId);
  }, [loadContexts]);

  const visibleIds = React.useMemo(() => contexts.map((context) => Number(context.id)), [contexts]);
  const allVisibleSelected = visibleIds.length > 0 && visibleIds.every((id) => selectedIds.has(id));
  const selectedCount = selectedIds.size;

  const openCreateModal = () => {
    setDraft(EMPTY_DRAFT);
    setIsEditorOpen(true);
    setNotice(null);
  };

  const openEditModal = (context: AdminQuestionGroupItem) => {
    setDraft(buildDraftFromContext(context));
    setIsEditorOpen(true);
    setNotice(null);
  };

  const closeEditor = () => {
    if (isSaving || isUploading) {
      return;
    }

    setIsEditorOpen(false);
    setDraft(EMPTY_DRAFT);
  };

  const toggleContextSelection = (id: number, checked: boolean) => {
    setSelectedIds((previous) => {
      const next = new Set(previous);
      if (checked) {
        next.add(id);
      } else {
        next.delete(id);
      }
      return next;
    });
  };

  const toggleAllVisible = (checked: boolean) => {
    setSelectedIds((previous) => {
      const next = new Set(previous);
      visibleIds.forEach((id) => {
        if (checked) {
          next.add(id);
        } else {
          next.delete(id);
        }
      });
      return next;
    });
  };

  const handleAddQuestionId = () => {
    const ids = normalizeQuestionIds(draft.questionIdInput);
    if (ids.length === 0) {
      setNotice({ type: 'error', message: 'Informe um ou mais IDs numericos de questoes.' });
      return;
    }

    setDraft((previous) => ({
      ...previous,
      questionIds: normalizeQuestionIds([...previous.questionIds, ...ids]),
      questionIdInput: '',
    }));
  };

  const handleRemoveQuestionId = (id: string) => {
    setDraft((previous) => ({
      ...previous,
      questionIds: previous.questionIds.filter((item) => item !== id),
    }));
  };

  const handleImageUpload = async (file: File | null) => {
    if (!file) {
      return;
    }

    if (!file.type.startsWith('image/')) {
      setNotice({ type: 'error', message: 'Envie um arquivo de imagem valido.' });
      return;
    }

    setIsUploading(true);
    try {
      const imageUrl = await adminService.uploadQuestionContextImage(file);
      setDraft((previous) => ({ ...previous, image_url: imageUrl }));
      setNotice({ type: 'success', message: 'Imagem enviada para o contexto.' });
    } catch (error) {
      setNotice({ type: 'error', message: readApiErrorMessage(error, 'Nao foi possivel enviar a imagem.') });
    } finally {
      setIsUploading(false);
      if (uploadInputRef.current) {
        uploadInputRef.current.value = '';
      }
    }
  };

  const handleSave = async () => {
    if (!draft.enunciado.trim() && !draft.texto.trim() && !draft.image_url.trim()) {
      setNotice({ type: 'error', message: 'Informe um texto, enunciado ou imagem para o contexto.' });
      return;
    }

    setIsSaving(true);
    try {
      await adminService.saveQuestionGroup({
        id: draft.id,
        enunciado: draft.enunciado,
        texto: draft.texto,
        image_url: draft.image_url,
        questionIds: draft.questionIds.map(Number),
      });
      setNotice({ type: 'success', message: draft.id ? 'Contexto atualizado.' : 'Contexto criado.' });
      setIsEditorOpen(false);
      setDraft(EMPTY_DRAFT);
      await loadContexts();
    } catch (error) {
      setNotice({ type: 'error', message: readApiErrorMessage(error, 'Nao foi possivel salvar o contexto.') });
    } finally {
      setIsSaving(false);
    }
  };

  const handleBulkApply = () => {
    if (bulkAction !== 'delete') {
      setNotice({ type: 'error', message: 'Selecione uma acao em massa.' });
      return;
    }

    const ids = Array.from(selectedIds);
    if (ids.length === 0) {
      setNotice({ type: 'error', message: 'Selecione ao menos um contexto.' });
      return;
    }

    setPendingDelete({ mode: 'bulk', ids });
  };

  const confirmDelete = async () => {
    if (!pendingDelete) {
      return;
    }

    const ids = pendingDelete.mode === 'single'
      ? [Number(pendingDelete.context.id)]
      : pendingDelete.ids;

    setIsDeleting(true);
    try {
      await Promise.all(ids.map((id) => adminService.deleteQuestionGroup(id)));
      setNotice({
        type: 'success',
        message: ids.length === 1
          ? 'Contexto removido e questoes desvinculadas.'
          : `${ids.length} contextos removidos e questoes desvinculadas.`,
      });
      setPendingDelete(null);
      setBulkAction('');
      setSelectedIds((previous) => new Set(Array.from(previous).filter((id) => !ids.includes(id))));
      await loadContexts();
    } catch (error) {
      setNotice({ type: 'error', message: readApiErrorMessage(error, 'Nao foi possivel remover os contextos.') });
    } finally {
      setIsDeleting(false);
    }
  };

  const deleteTitle = pendingDelete?.mode === 'bulk'
    ? 'Mover contextos para lixeira?'
    : 'Mover contexto para lixeira?';
  const deleteDescription = pendingDelete?.mode === 'bulk'
    ? 'As questoes vinculadas aos contextos selecionados serao mantidas, mas ficarao sem esses vinculos.'
    : 'As questoes vinculadas serao mantidas, mas ficarao sem este contexto.';

  const editorModal = isEditorOpen ? createPortal(
    <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-slate-950/65 px-4 py-6 backdrop-blur-sm">
      <div className={`${ADMIN_MODAL_PANEL_CLASS} flex max-h-[92vh] w-full max-w-5xl flex-col`}>
        <div className={`${ADMIN_MODAL_HEADER_CLASS} shrink-0`}>
          <div>
            <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">
              {draft.id ? `Editar contexto #${draft.id}` : 'Adicionar contexto de questao'}
            </h3>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              Texto, imagem e vinculos por ID usados no enunciado das questoes.
            </p>
          </div>
          <button
            type="button"
            onClick={closeEditor}
            disabled={isSaving || isUploading}
            className="rounded-sm p-1 text-slate-500 hover:bg-slate-200 hover:text-slate-800 disabled:opacity-60 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100"
            aria-label="Fechar"
          >
            <X size={18} />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-5">
          <div className="grid gap-5 lg:grid-cols-[1.35fr_0.9fr]">
            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-[11px] font-semibold uppercase text-slate-600 dark:text-slate-300">Enunciado / HTML</label>
                <textarea
                  value={draft.enunciado}
                  onChange={(event) => setDraft((previous) => ({ ...previous, enunciado: event.target.value }))}
                  className={`${ADMIN_TEXTAREA_CLASS} min-h-[190px]`}
                  placeholder="Contexto principal. Aceita HTML quando necessario."
                />
              </div>

              <div className="space-y-2">
                <label className="text-[11px] font-semibold uppercase text-slate-600 dark:text-slate-300">Texto simples</label>
                <textarea
                  value={draft.texto}
                  onChange={(event) => setDraft((previous) => ({ ...previous, texto: event.target.value }))}
                  className={`${ADMIN_TEXTAREA_CLASS} min-h-[120px]`}
                  placeholder="Resumo ou versao sem HTML para busca e listagem."
                />
              </div>
            </div>

            <div className="space-y-5">
              <div className="rounded-sm border border-slate-300 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-950/40">
                <div className="flex items-center justify-between gap-3">
                  <label className="text-[11px] font-semibold uppercase text-slate-600 dark:text-slate-300">Imagem</label>
                  <button
                    type="button"
                    onClick={() => uploadInputRef.current?.click()}
                    disabled={isUploading}
                    className={ADMIN_SECONDARY_BUTTON_CLASS}
                  >
                    {isUploading ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
                    Enviar imagem
                  </button>
                  <input
                    ref={uploadInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(event) => handleImageUpload(event.target.files?.[0] || null)}
                  />
                </div>

                {draft.image_url ? (
                  <div className="mt-3 space-y-3">
                    <img
                      src={resolveApiResourceUrl(draft.image_url)}
                      alt=""
                      className="h-36 w-full rounded-sm border border-slate-300 object-cover dark:border-slate-700"
                    />
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        value={draft.image_url}
                        onChange={(event) => setDraft((previous) => ({ ...previous, image_url: event.target.value }))}
                        className={`${ADMIN_FIELD_CLASS} min-w-0 flex-1`}
                        placeholder="/uploads/question-contexts/imagem.jpg"
                      />
                      <button
                        type="button"
                        onClick={() => setDraft((previous) => ({ ...previous, image_url: '' }))}
                        className={ADMIN_SECONDARY_BUTTON_CLASS}
                        aria-label="Remover imagem"
                      >
                        <X size={14} />
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="mt-3 flex min-h-[8rem] items-center justify-center rounded-sm border border-dashed border-slate-300 bg-white text-sm font-medium text-slate-400 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-500">
                    <ImageIcon size={18} className="mr-2" />
                    Nenhuma imagem vinculada
                  </div>
                )}
              </div>

              <div className="rounded-sm border border-slate-300 bg-white p-4 dark:border-slate-700 dark:bg-slate-900">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <label className="text-[11px] font-semibold uppercase text-slate-600 dark:text-slate-300">Questoes vinculadas</label>
                  <span className="rounded-sm border border-slate-300 bg-slate-50 px-2 py-1 text-[11px] font-semibold text-slate-500 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-300">
                    {draft.questionIds.length} vinculada(s)
                  </span>
                </div>

                <div className="mt-3 flex gap-2">
                  <input
                    type="text"
                    inputMode="numeric"
                    value={draft.questionIdInput}
                    onChange={(event) => setDraft((previous) => ({ ...previous, questionIdInput: event.target.value }))}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter') {
                        event.preventDefault();
                        handleAddQuestionId();
                      }
                    }}
                    className={`${ADMIN_FIELD_CLASS} min-w-0 flex-1`}
                    placeholder="IDs separados por virgula"
                  />
                  <button type="button" onClick={handleAddQuestionId} className={ADMIN_SECONDARY_BUTTON_CLASS}>
                    <Link2 size={14} />
                    Vincular
                  </button>
                </div>

                <div className="mt-3 max-h-40 overflow-y-auto rounded-sm border border-slate-200 bg-slate-50 p-2 dark:border-slate-800 dark:bg-slate-950/50">
                  {draft.questionIds.length > 0 ? (
                    <div className="flex flex-wrap gap-2">
                      {draft.questionIds.map((id) => (
                        <span
                          key={id}
                          className="inline-flex items-center gap-2 rounded-sm border border-slate-300 bg-white px-2 py-1 text-xs font-semibold text-slate-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300"
                        >
                          Questao #{id}
                          <button
                            type="button"
                            onClick={() => handleRemoveQuestionId(id)}
                            className="text-slate-400 hover:text-red-600 dark:hover:text-red-400"
                            aria-label={`Desvincular questao ${id}`}
                          >
                            <X size={12} />
                          </button>
                        </span>
                      ))}
                    </div>
                  ) : (
                    <p className="py-3 text-center text-xs font-medium text-slate-400">Nenhuma questao vinculada por ID.</p>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className={`${ADMIN_MODAL_FOOTER_CLASS} flex shrink-0 flex-wrap items-center justify-end gap-2`}>
          <button type="button" onClick={closeEditor} disabled={isSaving || isUploading} className={ADMIN_SECONDARY_BUTTON_CLASS}>
            Cancelar
          </button>
          <button type="button" onClick={handleSave} disabled={isSaving || isUploading} className={ADMIN_PRIMARY_BUTTON_CLASS}>
            {isSaving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
            {draft.id ? 'Salvar alteracoes' : 'Criar contexto'}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  ) : null;

  return (
    <div className="space-y-6 animate-slide-up">
      <AdminCollectionToolbar
        title="Contexto de questoes"
        description="Textos e imagens reutilizaveis vinculados ao enunciado das questoes."
        searchValue={filter}
        onSearchChange={setFilter}
        searchPlaceholder="Pesquisar contextos..."
        itemCount={contexts.length}
        itemCountLabel="contextos"
        primaryActionLabel="Adicionar contexto"
        onPrimaryAction={openCreateModal}
        actions={(
          <div className="flex flex-wrap items-center gap-2">
            <select
              value={bulkAction}
              onChange={(event) => setBulkAction(event.target.value)}
              className={`${ADMIN_FIELD_CLASS} h-9 min-w-[160px]`}
            >
              <option value="">Acoes em massa</option>
              <option value="delete">Mover para lixeira</option>
            </select>
            <button type="button" onClick={handleBulkApply} className={ADMIN_SECONDARY_BUTTON_CLASS}>
              Aplicar
            </button>
            {selectedCount > 0 ? (
              <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                {selectedCount} selecionado(s)
              </span>
            ) : null}
          </div>
        )}
      />

      {notice ? (
        <div className={`${ADMIN_PAGE_PANEL_CLASS} ${notice.type === 'error' ? 'border-red-200 bg-red-50 text-red-700 dark:border-red-900/40 dark:bg-red-950/20 dark:text-red-300' : 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/40 dark:bg-emerald-950/20 dark:text-emerald-300'}`}>
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm font-semibold">{notice.message}</p>
            <button type="button" onClick={() => setNotice(null)} className="rounded-sm p-1 hover:bg-white/60 dark:hover:bg-slate-900/40" aria-label="Dispensar aviso">
              <X size={14} />
            </button>
          </div>
        </div>
      ) : null}

      <div className={`${ADMIN_SURFACE_CLASS} overflow-hidden overflow-x-auto`}>
        <div className={ADMIN_SURFACE_HEADER_CLASS}>
          <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">Biblioteca de contextos</p>
        </div>
        <table className="w-full min-w-[860px] table-fixed border-separate border-spacing-0 text-left text-sm">
          <thead className="bg-slate-100 text-xs font-semibold uppercase text-slate-500 dark:bg-slate-950/50 dark:text-slate-400">
            <tr>
              <th className="w-12 border-b border-slate-300 px-4 py-3 dark:border-slate-700">
                <input
                  type="checkbox"
                  checked={allVisibleSelected}
                  onChange={(event) => toggleAllVisible(event.target.checked)}
                  aria-label="Selecionar todos os contextos visiveis"
                />
              </th>
              <th className="w-[42%] border-b border-slate-300 px-4 py-3 dark:border-slate-700">Contexto</th>
              <th className="w-[30%] border-b border-slate-300 px-4 py-3 dark:border-slate-700">Imagem</th>
              <th className="w-[16%] border-b border-slate-300 px-4 py-3 text-center dark:border-slate-700">Questoes vinculadas</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-sm font-medium text-slate-500">
                  <Loader2 size={18} className="mx-auto mb-2 animate-spin" />
                  Carregando contextos...
                </td>
              </tr>
            ) : contexts.length > 0 ? contexts.map((context) => {
              const imageUrl = String(context.image_url || context.imageUrl || '').trim();
              const usage = getContextUsage(context);
              const isSelected = selectedIds.has(Number(context.id));

              return (
                <tr key={context.id} className="group border-b border-slate-200 hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-900/60">
                  <td className="border-b border-slate-200 px-4 py-3 align-top dark:border-slate-800">
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={(event) => toggleContextSelection(Number(context.id), event.target.checked)}
                      aria-label={`Selecionar contexto ${context.id}`}
                    />
                  </td>
                  <td className="border-b border-slate-200 px-4 py-3 align-top dark:border-slate-800">
                    <div className="min-w-0">
                      <div className="truncate font-semibold text-slate-900 dark:text-slate-100">{getContextTitle(context)}</div>
                      <div className="mt-1 line-clamp-2 min-h-[32px] text-xs leading-4 text-slate-500 dark:text-slate-400">
                        {getContextExcerpt(context)}
                      </div>
                      <div className="mt-2 flex flex-wrap items-center gap-1 text-xs">
                        <button type="button" onClick={() => openEditModal(context)} className="inline-flex items-center gap-1 text-sky-700 hover:text-sky-900 dark:text-sky-300 dark:hover:text-sky-100">
                          <Pencil size={12} />
                          Editar
                        </button>
                        <span className="text-slate-300">|</span>
                        <button type="button" onClick={() => setPendingDelete({ mode: 'single', context })} className="inline-flex items-center gap-1 text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300">
                          <Trash2 size={12} />
                          Lixeira
                        </button>
                      </div>
                    </div>
                  </td>
                  <td className="border-b border-slate-200 px-4 py-3 align-top dark:border-slate-800">
                    {imageUrl ? (
                      <div className="flex min-w-0 items-center gap-3">
                        <img src={resolveApiResourceUrl(imageUrl)} alt="" className="h-14 w-20 shrink-0 rounded-sm border border-slate-300 object-cover dark:border-slate-700" />
                        <span className="block min-w-0 truncate text-xs text-slate-500 dark:text-slate-400">{imageUrl}</span>
                      </div>
                    ) : (
                      <span className="inline-flex items-center gap-2 text-xs font-medium text-slate-400">
                        <ImageIcon size={14} />
                        Sem imagem
                      </span>
                    )}
                  </td>
                  <td className="border-b border-slate-200 px-4 py-3 text-center align-top dark:border-slate-800">
                    <span className="inline-flex min-w-10 justify-center rounded-sm border border-slate-300 bg-white px-2 py-1 text-xs font-semibold text-slate-600 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-300">
                      {usage}
                    </span>
                  </td>
                </tr>
              );
            }) : (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-sm font-medium text-slate-500">
                  Nenhum contexto cadastrado.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {editorModal}

      <AdminConfirmDialog
        isOpen={Boolean(pendingDelete)}
        title={deleteTitle}
        description={deleteDescription}
        confirmLabel={pendingDelete?.mode === 'bulk' ? 'Remover contextos' : 'Remover contexto'}
        loading={isDeleting}
        onConfirm={confirmDelete}
        onCancel={() => setPendingDelete(null)}
      />
    </div>
  );
};

export default AdminQuestionGroupsSection;
