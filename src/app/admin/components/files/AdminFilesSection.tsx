/*
* ----------------------------------------------------
* @author: 4quarenta
* @author URI: https://github.com/4quarenta
* @copyright: (c) 2026 ConcursoMestre. All rights reserved
* ----------------------------------------------------
*
* @since 1.0.0
*/

'use client';

import React, { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  ExternalLink,
  File,
  FileText,
  Image as ImageIcon,
  Loader2,
  RefreshCw,
  Search,
  Trash2,
} from 'lucide-react';
import { useToast } from '@providers/ToastProvider';
import {
  apiClient,
  ENDPOINTS,
  readApiData,
  readApiErrorMessage,
  resolveApiResourceUrl,
  type ApiResponse,
} from '@services/api';
import {
  ADMIN_FIELD_CLASS,
  ADMIN_PRIMARY_BUTTON_CLASS,
  ADMIN_SECONDARY_BUTTON_CLASS,
  ADMIN_SURFACE_CLASS,
  ADMIN_SURFACE_HEADER_CLASS,
} from '../shared/adminPanelStyles';
import AdminConfirmDialog from '../ui/AdminConfirmDialog';

type FileType = 'image' | 'pdf' | 'file';
type Availability = 'available' | 'missing' | 'unknown';

type AdminFileItem = {
  id: string;
  name: string;
  type: FileType;
  source: string;
  url: string;
  mimeType: string | null;
  size: number | null;
  createdAt: string | null;
  ownerType: string | null;
  ownerId: string | number | null;
  ownerLabel: string | null;
  linked: boolean;
  deletable: boolean;
  availability: Availability;
};

type AdminFilePage = {
  items: AdminFileItem[];
  pageInfo: { page: number; limit: number; total: number; pages: number };
};

const SOURCE_LABELS: Record<string, string> = {
  question_asset: 'Questões e contextos',
  exam_file: 'Banco de provas',
  material_upload: 'Upload do marketplace',
  material_cover: 'Capa do marketplace',
  material_preview: 'Prévia do marketplace',
  profile_photo: 'Perfil de usuário',
  taxonomy_asset: 'Taxonomia',
  blog_cover: 'Artigo do blog',
  blog_category: 'Categoria do blog',
};

const OWNER_PATHS: Record<string, (id: string | number) => string> = {
  question: (id) => `/admin/operation/questions/${id}/edit`,
  context: () => '/admin/operation/question-groups',
  exam: (id) => `/admin/operation/exams/${id}/edit`,
  material: () => '/admin/marketplace/materials',
  user: () => '/admin/operation/users',
  taxonomy: () => '/admin/operation/filters',
  blog_article: () => '/admin/marketing/blog',
  blog_category: () => '/admin/marketing/blog',
};

const formatSize = (value: number | null) => {
  if (!value || value < 1) return 'Tamanho não informado';
  const units = ['B', 'KB', 'MB', 'GB'];
  const exponent = Math.min(Math.floor(Math.log(value) / Math.log(1024)), units.length - 1);
  return `${(value / (1024 ** exponent)).toFixed(exponent === 0 ? 0 : 1)} ${units[exponent]}`;
};

const formatDate = (value: string | null) => {
  if (!value) return 'Data não informada';
  const date = new Date(value.replace(' ', 'T'));
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString('pt-BR');
};

const AdminFilesSection = () => {
  const { addToast } = useToast();
  const [items, setItems] = useState<AdminFileItem[]>([]);
  const [pageInfo, setPageInfo] = useState({ page: 1, limit: 30, total: 0, pages: 1 });
  const [draftSearch, setDraftSearch] = useState('');
  const [search, setSearch] = useState('');
  const [type, setType] = useState('');
  const [source, setSource] = useState('');
  const [link, setLink] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [pendingDelete, setPendingDelete] = useState<AdminFileItem | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [brokenImages, setBrokenImages] = useState<Set<string>>(new Set());

  const loadFiles = useCallback(async (page = 1) => {
    setLoading(true);
    setError('');
    try {
      const response = await apiClient.get<ApiResponse<AdminFilePage>>(ENDPOINTS.admin.files, {
        params: { page, limit: 30, search, type, source, link },
      }) as unknown;
      const payload = readApiData<AdminFilePage>(response, {
        items: [],
        pageInfo: { page: 1, limit: 30, total: 0, pages: 1 },
      });
      setItems(Array.isArray(payload.items) ? payload.items : []);
      setPageInfo(payload.pageInfo);
    } catch (requestError) {
      setError(readApiErrorMessage(requestError, 'Não foi possível carregar os arquivos.'));
    } finally {
      setLoading(false);
    }
  }, [link, search, source, type]);

  useEffect(() => {
    const timer = window.setTimeout(() => void loadFiles(1), 0);
    return () => window.clearTimeout(timer);
  }, [loadFiles]);

  const onSearch = (event: FormEvent) => {
    event.preventDefault();
    setSearch(draftSearch.trim());
  };

  const confirmDelete = async () => {
    if (!pendingDelete) return;
    setDeleting(true);
    try {
      await apiClient.delete(ENDPOINTS.admin.files, { params: { id: pendingDelete.id } });
      addToast('Arquivo excluído.', 'success');
      setPendingDelete(null);
      await loadFiles(pageInfo.page);
    } catch (deleteError) {
      addToast(readApiErrorMessage(deleteError, 'Não foi possível excluir o arquivo.'), 'error');
    } finally {
      setDeleting(false);
    }
  };

  const resultLabel = useMemo(
    () => `${pageInfo.total} arquivo${pageInfo.total === 1 ? '' : 's'}`,
    [pageInfo.total],
  );

  return (
    <section className="space-y-5" aria-labelledby="admin-files-title">
      <div className={ADMIN_SURFACE_CLASS}>
        <div className={`${ADMIN_SURFACE_HEADER_CLASS} flex flex-wrap items-start justify-between gap-4`}>
          <div>
            <h2 id="admin-files-title" className="text-lg font-semibold text-slate-950 dark:text-white">Arquivos</h2>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              Modere imagens, PDFs e uploads vinculados à plataforma.
            </p>
          </div>
          <span className="rounded-sm border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300">
            {resultLabel}
          </span>
        </div>

        <form onSubmit={onSearch} className="grid gap-3 p-4 lg:grid-cols-[minmax(260px,1fr)_180px_220px_180px_auto]">
          <label className="relative">
            <span className="sr-only">Buscar arquivos</span>
            <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
            <input
              value={draftSearch}
              onChange={(event) => setDraftSearch(event.target.value)}
              className={`${ADMIN_FIELD_CLASS} w-full pl-9`}
              placeholder="Nome ou caminho do arquivo"
            />
          </label>
          <select value={type} onChange={(event) => setType(event.target.value)} className={ADMIN_FIELD_CLASS} aria-label="Filtrar por tipo">
            <option value="">Todos os tipos</option>
            <option value="image">Imagens</option>
            <option value="pdf">PDFs</option>
            <option value="file">Outros arquivos</option>
          </select>
          <select value={source} onChange={(event) => setSource(event.target.value)} className={ADMIN_FIELD_CLASS} aria-label="Filtrar por origem">
            <option value="">Todas as origens</option>
            {Object.entries(SOURCE_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
          <select value={link} onChange={(event) => setLink(event.target.value)} className={ADMIN_FIELD_CLASS} aria-label="Filtrar por vínculo">
            <option value="">Todos os vínculos</option>
            <option value="linked">Vinculados</option>
            <option value="orphan">Sem vínculo</option>
          </select>
          <div className="flex gap-2">
            <button type="submit" className={ADMIN_PRIMARY_BUTTON_CLASS}><Search size={15} /> Buscar</button>
            <button type="button" onClick={() => void loadFiles(pageInfo.page)} className={ADMIN_SECONDARY_BUTTON_CLASS} title="Atualizar lista">
              <RefreshCw size={15} />
              <span className="sr-only">Atualizar</span>
            </button>
          </div>
        </form>
      </div>

      <div className={`${ADMIN_SURFACE_CLASS} overflow-hidden`}>
        {error ? <div className="border-b border-red-200 bg-red-50 px-5 py-4 text-sm text-red-700">{error}</div> : null}
        <div className="overflow-x-auto">
          <table className="w-full min-w-[980px] text-left text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase text-slate-500 dark:border-slate-800 dark:bg-slate-950/50 dark:text-slate-400">
              <tr>
                <th className="w-24 px-5 py-3">Prévia</th>
                <th className="px-4 py-3">Arquivo</th>
                <th className="px-4 py-3">Origem e vínculo</th>
                <th className="px-4 py-3">Tamanho e data</th>
                <th className="w-44 px-5 py-3 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
              {loading ? (
                <tr><td colSpan={5} className="px-5 py-16 text-center text-slate-500"><Loader2 className="mx-auto mb-2 animate-spin" /> Carregando arquivos...</td></tr>
              ) : items.length === 0 ? (
                <tr><td colSpan={5} className="px-5 py-16 text-center text-slate-500">Nenhum arquivo corresponde aos filtros.</td></tr>
              ) : items.map((item) => {
                const fileUrl = item.url ? resolveApiResourceUrl(item.url) : '';
                const ownerPath = item.ownerType && item.ownerId !== null ? OWNER_PATHS[item.ownerType]?.(item.ownerId) : null;
                const imageUnavailable = item.availability === 'missing' || brokenImages.has(item.id);
                return (
                  <tr key={item.id} className="align-middle hover:bg-slate-50 dark:hover:bg-slate-800/40">
                    <td className="px-5 py-3">
                      <div className="flex h-14 w-16 items-center justify-center overflow-hidden rounded-sm border border-slate-200 bg-slate-100 dark:border-slate-700 dark:bg-slate-800">
                        {item.type === 'image' && fileUrl && !imageUnavailable ? (
                          // Imagens remotas e locais convivem neste inventario; o dominio nao e conhecido pelo Next Image.
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={fileUrl} alt={item.name} className="h-full w-full object-contain" loading="lazy" onError={() => setBrokenImages((current) => new Set(current).add(item.id))} />
                        ) : item.type === 'pdf' ? <FileText size={23} className="text-red-500" /> : item.type === 'image' ? <ImageIcon size={23} className="text-slate-400" /> : <File size={23} className="text-slate-400" />}
                      </div>
                    </td>
                    <td className="max-w-md px-4 py-3">
                      <p className="truncate font-semibold text-slate-900 dark:text-slate-100" title={item.name}>{item.name}</p>
                      <p className="mt-1 truncate text-xs text-slate-500" title={item.mimeType || item.url}>{item.mimeType || item.url || 'Formato não informado'}</p>
                      {item.availability === 'missing' ? <span className="mt-1 inline-block text-xs font-semibold text-red-600">Arquivo físico ausente</span> : null}
                    </td>
                    <td className="px-4 py-3">
                      <p className="font-medium text-slate-700 dark:text-slate-200">
                        {item.source === 'exam_file' && item.ownerLabel ? item.ownerLabel : (SOURCE_LABELS[item.source] || item.source)}
                      </p>
                      <p className="mt-1 text-xs text-slate-500">
                        {item.source === 'exam_file'
                          ? `Banco de provas · Prova #${item.ownerId ?? '-'}`
                          : item.linked
                            ? `${item.ownerLabel || 'Recurso vinculado'} · #${item.ownerId ?? '-'}`
                            : 'Sem vínculo ativo'}
                      </p>
                    </td>
                    <td className="px-4 py-3 text-slate-600 dark:text-slate-300">
                      <p>{formatSize(item.size)}</p>
                      <p className="mt-1 text-xs text-slate-500">{formatDate(item.createdAt)}</p>
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex justify-end gap-2">
                        {ownerPath ? <Link href={ownerPath} className={ADMIN_SECONDARY_BUTTON_CLASS}>Moderar</Link> : null}
                        {fileUrl ? <a href={fileUrl} target="_blank" rel="noopener noreferrer" className={ADMIN_SECONDARY_BUTTON_CLASS} title="Abrir arquivo"><ExternalLink size={15} /><span className="sr-only">Abrir</span></a> : null}
                        {item.deletable ? <button type="button" onClick={() => setPendingDelete(item)} className="inline-flex items-center rounded-sm border border-red-300 p-2 text-red-600 hover:bg-red-50" title="Excluir arquivo"><Trash2 size={15} /><span className="sr-only">Excluir</span></button> : null}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 px-5 py-4 text-sm text-slate-500 dark:border-slate-800">
          <span>Página {pageInfo.page} de {pageInfo.pages}</span>
          <div className="flex gap-2">
            <button type="button" disabled={loading || pageInfo.page <= 1} onClick={() => void loadFiles(pageInfo.page - 1)} className={ADMIN_SECONDARY_BUTTON_CLASS}>Anterior</button>
            <button type="button" disabled={loading || pageInfo.page >= pageInfo.pages} onClick={() => void loadFiles(pageInfo.page + 1)} className={ADMIN_SECONDARY_BUTTON_CLASS}>Próxima</button>
          </div>
        </div>
      </div>

      <AdminConfirmDialog
        isOpen={pendingDelete !== null}
        title="Excluir arquivo?"
        description={pendingDelete?.linked
          ? `Este arquivo está vinculado a ${pendingDelete.ownerLabel || 'outro conteúdo'}. A exclusão removerá o vínculo e o arquivo armazenado quando ele não for compartilhado.`
          : 'A exclusão remove o registro e o objeto armazenado e não pode ser desfeita.'}
        confirmLabel="Excluir arquivo"
        loading={deleting}
        onConfirm={() => void confirmDelete()}
        onCancel={() => setPendingDelete(null)}
      />
    </section>
  );
};

export default AdminFilesSection;
