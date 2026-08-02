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

import { useCallback, useRef, useState } from 'react';
import { filtersService } from '@services/filters';
import { adminService } from '@services/admin/adminService';
import { readApiErrorMessage } from '@services/api';
import { clientLog } from '@services/monitoring/clientLog';
import { useTaxonomyActions } from '@/state/app-config/useTaxonomyActions';
import { slugify } from './slugify';

type ToastHandler = (message: string, type?: string) => void;

interface EditingFilterItem {
  id?: number;
  item: TaxonomyItem;
  originalName: string;
  type?: string;
}

interface PendingDeleteFilterItem {
  id: number;
  name: string;
}

interface UseAdminTaxonomyWorkflowOptions {
  addToast: ToastHandler;
}

type TaxonomyItem = {
  id?: number;
  name?: string;
  slug?: string;
  sigla?: string;
  type?: string;
  description?: string;
  website?: string;
  assetUrl?: string;
  iconKey?: string;
  aliases?: string[];
  keywords?: string[];
  parent_id?: number | string | null;
  parentId?: number | string | null;
  metadata?: Record<string, unknown>;
};

export const FILTER_TYPES = [
  { key: 'all', label: 'Todos os Tipos' },
  { key: 'banca', label: 'Bancas' },
  { key: 'orgao', label: 'Orgaos' },
  { key: 'cargo', label: 'Cargos' },
  { key: 'materia', label: 'Materias', hierarchical: true },
  { key: 'topico', label: 'Topicos', hierarchical: true },
  { key: 'assunto', label: 'Assuntos', hierarchical: false },
  { key: 'ano', label: 'Anos' },
  { key: 'carreira', label: 'Focos' },
  { key: 'area', label: 'Areas' },
];

const KNOWLEDGE_TAXONOMY_TYPES = ['materia', 'topico', 'assunto'];

const getSaveTypeForFilterType = (type: string) => (
  KNOWLEDGE_TAXONOMY_TYPES.includes(type) ? 'assunto' : type
);

const getChildFilterType = (type: string) => {
  if (type === 'materia') return 'topico';
  if (type === 'topico') return 'assunto';
  if (type === 'carreira') return 'cargo';
  return type;
};

export const useAdminTaxonomyWorkflow = ({
  addToast,
}: UseAdminTaxonomyWorkflowOptions) => {
  const { ensureTaxonomiesLoaded } = useTaxonomyActions();
  const [activeFilterType, setActiveFilterType] = useState<string>('all');
  const [filterInput, setFilterInput] = useState('');
  const [filterSlug, setFilterSlug] = useState('');
  const [filterAcronym, setFilterAcronym] = useState('');
  const [filterDescription, setFilterDescription] = useState('');
  const [filterWebsite, setFilterWebsite] = useState('');
  const [filterAssetUrl, setFilterAssetUrl] = useState('');
  const [isUploadingFilterAsset, setIsUploadingFilterAsset] = useState(false);
  const [filterAliases, setFilterAliases] = useState('');
  const [filterKeywords, setFilterKeywords] = useState('');
  const [filterSearch, setFilterSearch] = useState('');
  const [editingFilterItem, setEditingFilterItem] = useState<EditingFilterItem | null>(null);
  const [pendingDeleteFilter, setPendingDeleteFilter] = useState<PendingDeleteFilterItem | null>(null);
  const [isDeletingFilter, setIsDeletingFilter] = useState(false);
  const [selectedParentId, setSelectedParentId] = useState<number | string | null>(null);
  const [showTaxonomyModal, setShowTaxonomyModal] = useState(false);
  const editingRequestIdRef = useRef(0);

  const fetchFilters = useCallback(async () => {
    try {
      await ensureTaxonomiesLoaded(true);
    } catch (error) {
      clientLog.warn('Error fetching filters:', error);
    }
  }, [ensureTaxonomiesLoaded]);

  const resetTaxonomyForm = () => {
    editingRequestIdRef.current += 1;
    setFilterInput('');
    setFilterSlug('');
    setFilterAcronym('');
    setFilterDescription('');
    setFilterWebsite('');
    setFilterAssetUrl('');
    setFilterAliases('');
    setFilterKeywords('');
    setEditingFilterItem(null);
    setSelectedParentId(null);
  };

  const handleSaveFilter = async () => {
    if (!filterInput.trim()) return;

    try {
      const uiTypeToSave = editingFilterItem?.type || activeFilterType;
      const typeToSave = getSaveTypeForFilterType(uiTypeToSave);
      if (typeToSave === 'all') {
        addToast('Selecione um tipo de filtro especifico no modal.', 'error');
        return;
      }

      if (uiTypeToSave === 'topico' && !selectedParentId) {
        addToast('Todo topico precisa estar vinculado a uma materia.', 'error');
        return;
      }

      if (uiTypeToSave === 'assunto' && !selectedParentId) {
        addToast('Todo assunto precisa estar vinculado a um topico.', 'error');
        return;
      }

      if (uiTypeToSave === 'cargo' && !selectedParentId) {
        addToast('Todo cargo precisa estar vinculado a um foco.', 'error');
        return;
      }

      const parentIdToSave = uiTypeToSave === 'materia' || !selectedParentId ? null : Number(selectedParentId);

      await filtersService.save({
        id: editingFilterItem?.id,
        type: typeToSave,
        name: filterInput.trim(),
        slug: filterSlug,
        sigla: filterAcronym.trim() || undefined,
        materia: uiTypeToSave === 'materia',
        taxonomy_level: KNOWLEDGE_TAXONOMY_TYPES.includes(uiTypeToSave) ? uiTypeToSave : undefined,
        description: filterDescription,
        website: filterWebsite,
        assetUrl: filterAssetUrl,
        aliases: filterAliases.split(/[,;\n]+/).map((item) => item.trim()).filter(Boolean),
        keywords: filterKeywords.split(/[,;\n]+/).map((item) => item.trim()).filter(Boolean),
        parent_id: parentIdToSave,
        metadata: {
          ...(editingFilterItem?.item?.metadata || {}),
          ...(KNOWLEDGE_TAXONOMY_TYPES.includes(uiTypeToSave) ? { taxonomy_level: uiTypeToSave } : {}),
        },
      });

      resetTaxonomyForm();
      setShowTaxonomyModal(false);
      await fetchFilters();
      window.dispatchEvent(new Event('admin-taxonomies-changed'));
      addToast(editingFilterItem ? 'Item atualizado!' : 'Item adicionado!', 'success');
    } catch (error: unknown) {
      addToast(readApiErrorMessage(error, 'Erro ao salvar filtro'), 'error');
    }
  };

  const requestDeleteFilter = (item: { id: number; name?: string }) => {
    setPendingDeleteFilter({
      id: item.id,
      name: item.name || 'filtro selecionado',
    });
  };

  const cancelDeleteFilter = () => {
    if (isDeletingFilter) {
      return;
    }

    setPendingDeleteFilter(null);
  };

  const confirmDeleteFilter = async () => {
    if (!pendingDeleteFilter || isDeletingFilter) {
      return;
    }

    setIsDeletingFilter(true);
    try {
      await filtersService.remove(pendingDeleteFilter.id);
      await fetchFilters();
      window.dispatchEvent(new Event('admin-taxonomies-changed'));
      addToast('Filtro removido com sucesso.', 'success');
      setPendingDeleteFilter(null);
    } catch (error) {
      addToast(readApiErrorMessage(error, 'Erro ao deletar filtro'), 'error');
    } finally {
      setIsDeletingFilter(false);
    }
  };

  const hydrateEditingFilter = (item: TaxonomyItem) => {
    const itemName = item.name || '';
    setFilterInput(itemName);
    setFilterSlug(item.slug || slugify(itemName));
    setFilterAcronym(item.sigla || '');
    setFilterDescription(item.description || '');
    setFilterWebsite(item.website || '');
    setFilterAssetUrl(item.assetUrl || '');
    setFilterAliases((item.aliases || []).join(', '));
    setFilterKeywords((item.keywords || []).join(', '));
    setEditingFilterItem({ id: item.id, item, originalName: itemName, type: item.type });
    setSelectedParentId(item.parent_id ?? item.parentId ?? null);
  };

  const startEditingFilter = (item: TaxonomyItem) => {
    hydrateEditingFilter(item);
    setShowTaxonomyModal(true);

    const id = Number(item.id || 0);
    if (!Number.isInteger(id) || id <= 0) {
      return;
    }

    const requestId = editingRequestIdRef.current + 1;
    editingRequestIdRef.current = requestId;
    void filtersService.getAdminItem(id)
      .then((canonicalItem) => {
        if (editingRequestIdRef.current !== requestId) {
          return;
        }
        hydrateEditingFilter(canonicalItem);
      })
      .catch((requestError) => {
        if (editingRequestIdRef.current === requestId) {
          addToast(readApiErrorMessage(requestError, 'Nao foi possivel atualizar os dados da taxonomia.'), 'error');
        }
      });
  };

  const handleFilterInputChange = useCallback((nextValue: string) => {
    setFilterInput(nextValue);
    if (showTaxonomyModal && !editingFilterItem) {
      setFilterSlug(slugify(nextValue));
    }
  }, [editingFilterItem, showTaxonomyModal]);

  const uploadFilterAsset = async (file: File) => {
    if (isUploadingFilterAsset) return;
    setIsUploadingFilterAsset(true);
    try {
      const asset = await adminService.uploadBrandAsset(file, 'taxonomy-logo');
      setFilterAssetUrl(asset.url);
      addToast('Imagem da taxonomia enviada com sucesso.', 'success');
    } catch (error) {
      addToast(readApiErrorMessage(error, 'Nao foi possivel enviar a imagem.'), 'error');
    } finally {
      setIsUploadingFilterAsset(false);
    }
  };

  const deleteFiltersInBulk = async (ids: number[]): Promise<boolean> => {
    if (isDeletingFilter) {
      return false;
    }

    setIsDeletingFilter(true);
    try {
      const result = await filtersService.removeMany(ids);
      window.dispatchEvent(new Event('admin-taxonomies-changed'));
      addToast(`${result.deletedCount} taxonomia(s) removida(s) com sucesso.`, 'success');
      return true;
    } catch (error) {
      addToast(readApiErrorMessage(error, 'Erro ao excluir taxonomias'), 'error');
      return false;
    } finally {
      setIsDeletingFilter(false);
    }
  };

  const cancelEditingFilter = () => {
    resetTaxonomyForm();
    setShowTaxonomyModal(false);
  };

  const openCreateFilterModal = () => {
    cancelEditingFilter();
    void fetchFilters();
    if (activeFilterType === 'all') {
      setActiveFilterType('materia');
    }
    setShowTaxonomyModal(true);
  };

  const openCreateChildFilterModal = (type: string, parentId: number | string) => {
    cancelEditingFilter();
    void fetchFilters();
    setActiveFilterType(getChildFilterType(type));
    setSelectedParentId(parentId);
    setShowTaxonomyModal(true);
  };

  return {
    filterTypes: FILTER_TYPES,
    activeFilterType,
    setActiveFilterType,
    filterInput,
    setFilterInput: handleFilterInputChange,
    filterSlug,
    setFilterSlug,
    filterAcronym,
    setFilterAcronym,
    filterDescription,
    setFilterDescription,
    filterWebsite,
    setFilterWebsite,
    filterAssetUrl,
    setFilterAssetUrl,
    isUploadingFilterAsset,
    uploadFilterAsset,
    filterAliases,
    setFilterAliases,
    filterKeywords,
    setFilterKeywords,
    filterSearch,
    setFilterSearch,
    editingFilterItem,
    selectedParentId,
    setSelectedParentId,
    showTaxonomyModal,
    handleSaveFilter,
    pendingDeleteFilter,
    isDeletingFilter,
    requestDeleteFilter,
    cancelDeleteFilter,
    confirmDeleteFilter,
    deleteFiltersInBulk,
    startEditingFilter,
    cancelEditingFilter,
    openCreateFilterModal,
    openCreateChildFilterModal,
  };
};
