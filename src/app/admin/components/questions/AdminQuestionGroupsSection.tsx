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
import Image from 'next/image';
import { createPortal } from 'react-dom';
import { Image as ImageIcon, Link2, Loader2, Pencil, Save, Trash2, Upload, X } from 'lucide-react';
import { readApiErrorMessage, resolveApiResourceUrl } from '@services/api';
import { adminService, type AdminQuestionGroupItem } from '@services/admin/adminService';
import { examService } from '@services/exams/examService';
import type { Prova, QuestionAsset } from '@types';
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
import {
  buildQuestionImageMarker,
  createQuestionImageAsset,
  removeQuestionImageMarker,
} from './questionEditorShared';

interface QuestionContextDraft {
  id?: number | null;
  provaId: string;
  texto: string;
  assets: QuestionAsset[];
  questionIds: string[];
  questionIdInput: string;
}

type PendingDelete =
  | { mode: 'single'; context: AdminQuestionGroupItem }
  | { mode: 'bulk'; ids: number[] };

const EMPTY_DRAFT: QuestionContextDraft = {
  id: null,
  provaId: '',
  texto: '',
  assets: [],
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
    context.texto
    || context.enunciado_clean
    || context.enunciadoClean
    || context.enunciado
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

const getContextAssetUrl = (asset?: QuestionAsset) => {
  const url = String(asset?.url || '').trim();
  if (url) return url;
  const base64 = String(asset?.base64 || '').trim();
  if (!base64) return '';
  return base64.startsWith('data:') ? base64 : `data:image/jpeg;base64,${base64}`;
};

const buildDraftFromContext = (context: AdminQuestionGroupItem): QuestionContextDraft => ({
  id: context.id,
  provaId: String(context.provaId ?? context.prova_id ?? ''),
  texto: context.texto || context.enunciado || '',
  assets: Array.isArray(context.assets)
    ? context.assets
    : String(context.image_url || context.imageUrl || '').trim()
      ? [{
        id: 'img_context_1',
        type: 'image',
        usage: 'context',
        url: String(context.image_url || context.imageUrl),
        alt: 'Imagem do contexto.',
        order: 1,
      }]
      : [],
  questionIds: getContextQuestionIds(context),
  questionIdInput: '',
});

const AdminQuestionGroupsSection = () => {
  const [contexts, setContexts] = React.useState<AdminQuestionGroupItem[]>([]);
  const [provas, setProvas] = React.useState<Prova[]>([]);
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
      setNotice({ type: 'error', message: readApiErrorMessage(error, 'Não foi possível carregar os contextos.') });
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

  React.useEffect(() => {
    let active = true;
    void examService.list({ limit: 500 }).then((items) => {
      if (active) setProvas(items);
    }).catch(() => {
      if (active) setProvas([]);
    });
    return () => { active = false; };
  }, []);

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

  const handleImageUpload = async (files: FileList | null) => {
    const selectedFiles = Array.from(files || []);
    if (selectedFiles.length === 0) {
      return;
    }

    if (selectedFiles.some((file) => !file.type.startsWith('image/'))) {
      setNotice({ type: 'error', message: 'Envie um arquivo de imagem valido.' });
      return;
    }

    setIsUploading(true);
    try {
      const uploadedUrls = await Promise.all(
        selectedFiles.map((file) => adminService.uploadQuestionContextImage(file)),
      );
      setDraft((previous) => {
        let nextAssets = [...previous.assets];
        let nextText = previous.texto;
        uploadedUrls.forEach((url, index) => {
          const asset = createQuestionImageAsset({
            assets: nextAssets,
            usage: 'context',
            url,
            alt: selectedFiles[index]?.name || 'Imagem do contexto.',
          });
          nextAssets = [...nextAssets, asset];
          nextText = [nextText.trimEnd(), buildQuestionImageMarker(asset.id)].filter(Boolean).join('\n\n');
        });
        return { ...previous, assets: nextAssets, texto: nextText };
      });
      setNotice({ type: 'success', message: `${uploadedUrls.length} imagem(ns) enviada(s) para o contexto.` });
    } catch (error) {
      setNotice({ type: 'error', message: readApiErrorMessage(error, 'Não foi possível enviar a imagem.') });
    } finally {
      setIsUploading(false);
      if (uploadInputRef.current) {
        uploadInputRef.current.value = '';
      }
    }
  };

  const handleSave = async () => {
    if (!draft.texto.trim() && draft.assets.length === 0) {
      setNotice({ type: 'error', message: 'Informe um texto ou imagem para o contexto.' });
      return;
    }
    if (!draft.provaId) {
      setNotice({ type: 'error', message: 'Selecione a prova a que este contexto pertence.' });
      return;
    }

    setIsSaving(true);
    try {
      await adminService.saveQuestionGroup({
        id: draft.id,
        provaId: draft.provaId,
        texto: draft.texto,
        assets: draft.assets,
        questionIds: draft.questionIds.map(Number),
      });
      setNotice({ type: 'success', message: draft.id ? 'Contexto atualizado.' : 'Contexto criado.' });
      setIsEditorOpen(false);
      setDraft(EMPTY_DRAFT);
      await loadContexts();
    } catch (error) {
      setNotice({ type: 'error', message: readApiErrorMessage(error, 'Não foi possível salvar o contexto.') });
    } finally {
      setIsSaving(false);
    }
  };

  const handleBulkApply = () => {
    if (bulkAction !== 'delete') {
      setNotice({ type: 'error', message: 'Selecione uma ação em massa.' });
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
      setNotice({ type: 'error', message: readApiErrorMessage(error, 'Não foi possível remover os contextos.') });
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
              {draft.id ? `Editar contexto #${draft.id}` : 'Adicionar contexto de questão'}
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
                <label className="text-[11px] font-semibold uppercase text-slate-600 dark:text-slate-300">Texto do contexto</label>
                <textarea
                  value={draft.texto}
                  onChange={(event) => setDraft((previous) => ({ ...previous, texto: event.target.value }))}
                  className={`${ADMIN_TEXTAREA_CLASS} min-h-[330px]`}
                  placeholder="Digite o contexto. Posicione imagens no texto com [image:ID]."
                />
              </div>
            </div>

            <div className="space-y-5">
              <div className="rounded-sm border border-slate-300 bg-white p-4 dark:border-slate-700 dark:bg-slate-900">
                <label className="text-[11px] font-semibold uppercase text-slate-600 dark:text-slate-300">Prova vinculada *</label>
                <select
                  value={draft.provaId}
                  onChange={(event) => setDraft((previous) => ({ ...previous, provaId: event.target.value }))}
                  className={`${ADMIN_FIELD_CLASS} mt-2 w-full`}
                >
                  <option value="">Selecione a prova</option>
                  {provas.map((prova) => (
                    <option key={prova.id} value={String(prova.id)}>
                      {prova.nome || `Prova #${prova.id}`}
                    </option>
                  ))}
                </select>
                <p className="mt-2 text-xs leading-5 text-slate-500 dark:text-slate-400">
                  Um contexto pertence a uma unica prova. As questoes vinculadas devem pertencer a ela.
                </p>
              </div>
              <div className="rounded-sm border border-slate-300 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-950/40">
                <div className="flex items-center justify-between gap-3">
                  <label className="text-[11px] font-semibold uppercase text-slate-600 dark:text-slate-300">Imagens</label>
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
                    multiple
                    className="hidden"
                    onChange={(event) => handleImageUpload(event.target.files)}
                  />
                </div>

                {draft.assets.length > 0 ? (
                  <div className="mt-3 space-y-3">
                    {draft.assets.map((asset) => (
                      <div key={asset.id} className="rounded-sm border border-slate-300 bg-white p-2 dark:border-slate-700 dark:bg-slate-900">
                        <Image
                          src={resolveApiResourceUrl(String(asset.url || ''))}
                          alt={asset.alt || ''}
                          width={960}
                          height={288}
                          unoptimized
                          className="h-28 w-full rounded-sm object-contain"
                        />
                        <div className="mt-2 flex items-center justify-between gap-2">
                          <code className="truncate text-[11px] font-semibold text-violet-700 dark:text-violet-300">
                            {buildQuestionImageMarker(asset.id)}
                          </code>
                          <button
                            type="button"
                            onClick={() => setDraft((previous) => ({
                              ...previous,
                              texto: removeQuestionImageMarker(previous.texto, asset.id),
                              assets: previous.assets.filter((item) => item.id !== asset.id),
                            }))}
                            className={ADMIN_SECONDARY_BUTTON_CLASS}
                            aria-label={`Remover ${asset.alt || asset.id}`}
                          >
                            <X size={14} />
                          </button>
                        </div>
                      </div>
                    ))}
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
                  <label className="text-[11px] font-semibold uppercase text-slate-600 dark:text-slate-300">Questões vinculadas</label>
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
                          Questão #{id}
                          <button
                            type="button"
                            onClick={() => handleRemoveQuestionId(id)}
                            className="text-slate-400 hover:text-red-600 dark:hover:text-red-400"
                            aria-label={`Desvincular questão ${id}`}
                          >
                            <X size={12} />
                          </button>
                        </span>
                      ))}
                    </div>
                  ) : (
                    <p className="py-3 text-center text-xs font-medium text-slate-400">Nenhuma questão vinculada por ID.</p>
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
        <table className="w-full min-w-[1020px] table-fixed border-separate border-spacing-0 text-left text-sm">
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
              <th className="w-[20%] border-b border-slate-300 px-4 py-3 dark:border-slate-700">Prova</th>
              <th className="w-[30%] border-b border-slate-300 px-4 py-3 dark:border-slate-700">Imagem</th>
              <th className="w-[16%] border-b border-slate-300 px-4 py-3 text-center dark:border-slate-700">Questões vinculadas</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-sm font-medium text-slate-500">
                  <Loader2 size={18} className="mx-auto mb-2 animate-spin" />
                  Carregando contextos...
                </td>
              </tr>
            ) : contexts.length > 0 ? contexts.map((context) => {
              const contextAssets = Array.isArray(context.assets) ? context.assets : [];
              const imageUrls = contextAssets.map(getContextAssetUrl).filter(Boolean);
              const legacyImageUrl = String(context.image_url || context.imageUrl || '').trim();
              if (imageUrls.length === 0 && legacyImageUrl) imageUrls.push(legacyImageUrl);
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
                  <td className="border-b border-slate-200 px-4 py-3 align-top text-xs font-semibold text-slate-600 dark:border-slate-800 dark:text-slate-300">
                    {context.provaTitle || context.prova_title || (context.provaId || context.prova_id ? `Prova #${context.provaId ?? context.prova_id}` : 'Pendente de migracao')}
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
                    {imageUrls.length > 0 ? (
                      <div className="flex min-w-0 items-center gap-3">
                        <div className="flex max-w-52 gap-1 overflow-x-auto">
                          {imageUrls.map((url, index) => (
                            <Image
                              key={`${context.id}-asset-${index}`}
                              src={resolveApiResourceUrl(url)}
                              alt={`Imagem ${index + 1} do contexto`}
                              width={80}
                              height={56}
                              unoptimized
                              className="h-14 w-20 shrink-0 rounded-sm border border-slate-300 object-cover dark:border-slate-700"
                            />
                          ))}
                        </div>
                        <span className="block min-w-0 truncate text-xs text-slate-500 dark:text-slate-400">
                          {imageUrls.length > 1 ? `${imageUrls.length} imagens` : '1 imagem'}
                        </span>
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
                <td colSpan={5} className="px-4 py-8 text-center text-sm font-medium text-slate-500">
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
