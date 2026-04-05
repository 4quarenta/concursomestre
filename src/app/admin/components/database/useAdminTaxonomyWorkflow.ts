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

import { useEffect, useState } from 'react';
import { useData } from '@providers/DataProvider';
import { filtersService } from '@services/filters';
import { readApiErrorMessage } from '@services/api';
import { slugify } from './slugify';

type ToastHandler = (message: string, type?: string) => void;

interface EditingFilterItem {
  id?: number;
  item: any;
  originalName: string;
  type?: string;
}

interface UseAdminTaxonomyWorkflowOptions {
  addToast: ToastHandler;
}

export const FILTER_TYPES = [
  { key: 'all', label: 'Todos os Tipos' },
  { key: 'banca', label: 'Bancas' },
  { key: 'orgao', label: 'Orgaos' },
  { key: 'cargo', label: 'Cargos' },
  { key: 'assunto', label: 'Assuntos (Materias/Topicos)', hierarchical: true },
  { key: 'ano', label: 'Anos' },
  { key: 'carreira', label: 'Carreiras' },
  { key: 'area', label: 'Areas' },
];

export const useAdminTaxonomyWorkflow = ({
  addToast,
}: UseAdminTaxonomyWorkflowOptions) => {
  const { dispatch } = useData();
  const [activeFilterType, setActiveFilterType] = useState<string>('all');
  const [filterInput, setFilterInput] = useState('');
  const [filterSlug, setFilterSlug] = useState('');
  const [filterDescription, setFilterDescription] = useState('');
  const [filterWebsite, setFilterWebsite] = useState('');
  const [filterSearch, setFilterSearch] = useState('');
  const [editingFilterItem, setEditingFilterItem] = useState<EditingFilterItem | null>(null);
  const [selectedParentId, setSelectedParentId] = useState<number | null>(null);
  const [showTaxonomyModal, setShowTaxonomyModal] = useState(false);

  const fetchFilters = async () => {
    try {
      const taxonomies = await filtersService.listTaxonomies();
      dispatch({ type: 'SET_TAXONOMIES', payload: taxonomies });
    } catch (error) {
      console.error('Error fetching filters:', error);
    }
  };

  const resetTaxonomyForm = () => {
    setFilterInput('');
    setFilterSlug('');
    setFilterDescription('');
    setFilterWebsite('');
    setEditingFilterItem(null);
    setSelectedParentId(null);
  };

  const handleSaveFilter = async () => {
    if (!filterInput.trim()) return;

    try {
      const typeToSave = editingFilterItem?.type || activeFilterType;
      if (typeToSave === 'all') {
        addToast('Selecione um tipo de filtro especifico no modal.', 'error');
        return;
      }

      await filtersService.save({
        id: editingFilterItem?.id,
        type: typeToSave,
        name: filterInput.trim(),
        slug: filterSlug,
        description: filterDescription,
        website: filterWebsite,
        parent_id: selectedParentId,
        metadata: editingFilterItem?.item?.metadata || {},
      });

      resetTaxonomyForm();
      setShowTaxonomyModal(false);
      await fetchFilters();
      addToast(editingFilterItem ? 'Item atualizado!' : 'Item adicionado!', 'success');
    } catch (error: any) {
      addToast(readApiErrorMessage(error, 'Erro ao salvar filtro'), 'error');
    }
  };

  const handleDeleteFilter = async (id: number) => {
    if (!confirm('Tem certeza?')) return;

    try {
      await filtersService.remove(id);
      await fetchFilters();
    } catch (error) {
      addToast(readApiErrorMessage(error, 'Erro ao deletar filtro'), 'error');
    }
  };

  const startEditingFilter = (item: any) => {
    setFilterInput(item.name);
    setFilterSlug(item.slug || slugify(item.name));
    setFilterDescription(item.description || '');
    setFilterWebsite(item.website || '');
    setEditingFilterItem({ id: item.id, item, originalName: item.name, type: item.type });
    setSelectedParentId(item.parent_id || item.parentId);
    setShowTaxonomyModal(true);
  };

  const cancelEditingFilter = () => {
    resetTaxonomyForm();
    setShowTaxonomyModal(false);
  };

  const openCreateFilterModal = () => {
    cancelEditingFilter();
    setShowTaxonomyModal(true);
  };

  const openCreateChildFilterModal = (type: string, parentId: number) => {
    cancelEditingFilter();
    setActiveFilterType(type);
    setSelectedParentId(parentId);
    setShowTaxonomyModal(true);
  };

  useEffect(() => {
    fetchFilters();
  }, []);

  useEffect(() => {
    if (showTaxonomyModal && !editingFilterItem) {
      setFilterSlug(slugify(filterInput));
    }
  }, [filterInput, showTaxonomyModal, editingFilterItem]);

  return {
    filterTypes: FILTER_TYPES,
    activeFilterType,
    setActiveFilterType,
    filterInput,
    setFilterInput,
    filterSlug,
    setFilterSlug,
    filterDescription,
    setFilterDescription,
    filterWebsite,
    setFilterWebsite,
    filterSearch,
    setFilterSearch,
    editingFilterItem,
    selectedParentId,
    setSelectedParentId,
    showTaxonomyModal,
    handleSaveFilter,
    handleDeleteFilter,
    startEditingFilter,
    cancelEditingFilter,
    openCreateFilterModal,
    openCreateChildFilterModal,
  };
};
