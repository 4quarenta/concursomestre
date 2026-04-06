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
import { useSearchParams } from 'react-router-dom';
import { useToast } from '@providers/ToastProvider';
import AdminDatabaseNavigation from './AdminDatabaseNavigation';
import AdminDatabaseModals from './AdminDatabaseModals';
import AdminDatabaseSections from './AdminDatabaseSections';
import { ADMIN_DATABASE_CATEGORIES, ADMIN_DATABASE_SUBTAB_LABELS } from './adminDatabaseNavigationConfig';
import { useAdminModerationWorkbench } from './useAdminModerationWorkbench';
import SortableHeader from './SortableHeader';
import { useAdminDatabaseDatasets } from './useAdminDatabaseDatasets';
import { useAdminDatabaseNavigationState } from './useAdminDatabaseNavigationState';
import { useAdminTableSorting } from './useAdminTableSorting';
import { useAdminTaxonomyWorkflow } from './useAdminTaxonomyWorkflow';
import { useAdminImportSettingsBridge } from '../import/useAdminImportSettingsBridge';
import { useAdminQuestionsWorkflow } from '../questions/useAdminQuestionsWorkflow';
import { useAdminQuestionWorkbench } from '../questions/useAdminQuestionWorkbench';
import { useRankingEditorWorkflow } from '../rankings/useRankingEditorWorkflow';
import { useAdminUserProfileWorkflow } from '../users/useAdminUserProfileWorkflow';

export interface AdminDatabaseManagerControllerProps {
  questions: any[];
  allUsers: any[];
  allMaterials: any[];
  allReports: any[];
  rankings?: any[];
  onDeleteQuestion: (questionId: any) => Promise<any> | any;
  onAddQuestion: (question: any) => Promise<any> | any;
  onAddQuestions: (questions: any[]) => Promise<any> | any;
  onUpdateQuestion: (question: any) => Promise<any> | any;
  resolveReport: (reportId: any, status: string, reason?: string) => Promise<any> | any;
  moderateMaterial: (...args: any[]) => Promise<any> | any;
  onDeleteMaterial: (materialId: string) => Promise<any> | any;
  systemSettings: any;
  updateSystemSettings: (settings: any) => Promise<any> | any;
  updateRanking: (ranking: any) => Promise<void> | void;
  initialTab?: string;
}

/**
 * Controller central da aba "Base de Dados".
 * Ele orquestra navegacao interna, datasets filtrados, workbenches de questões/importacao, moderação, perfil de usuário, ranking e taxonomias.
 */
export const useAdminDatabaseManagerController = ({
  questions,
  allUsers,
  allMaterials,
  allReports,
  rankings = [],
  onDeleteQuestion,
  onAddQuestion,
  onAddQuestions,
  onUpdateQuestion,
  resolveReport,
  moderateMaterial,
  onDeleteMaterial,
  systemSettings,
  updateSystemSettings,
  updateRanking,
  initialTab = 'questions',
}: AdminDatabaseManagerControllerProps) => {
  const { addToast } = useToast();
  const [searchParams] = useSearchParams();

  /**
   * Controla categoria ativa, subaba e filtro textual da area de base de dados.
   */
  const {
    activeSubTab,
    activeCategory,
    filter,
    setFilter,
    handleSelectCategory,
    handleSelectSubTab,
  } = useAdminDatabaseNavigationState({
    initialTab,
    searchTab: searchParams.get('tab'),
    locationHash: window.location.hash,
  });

  /**
   * Reune o CRUD de taxonomias e filtros usado pela subaba de filtros.
   */
  const {
    filterTypes,
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
  } = useAdminTaxonomyWorkflow({
    addToast,
  });

  /**
   * Padroniza ordenacao compartilhada entre tabelas da feature.
   */
  const { sortConfig, requestSort, sortData } = useAdminTableSorting();

  /**
   * Gera cabecalhos ordenaveis reaproveitados pelas tabelas internas do admin.
   */
  const renderSortableHeader = (label: string, sortKey: string) => (
    <SortableHeader
      label={label}
      sortKey={sortKey}
      sortConfig={sortConfig}
      onRequestSort={requestSort}
    />
  );

  /**
   * Controla abertura e persistencia do editor de ranking.
   */
  const {
    editingRanking,
    setEditingRanking,
    openRankingEditor,
    closeRankingEditor,
    handleSaveRanking,
  } = useRankingEditorWorkflow({
    addToast,
    updateRanking,
  });

  /**
   * Orquestra o perfil administrativo detalhado do usuário, incluindo abas, edicao e ações operacionais.
   */
  const {
    viewingProfileId,
    detailedUser,
    isLoadingDetail,
    detailTab,
    setDetailTab,
    actionLoading,
    isEditingUser,
    editUserForm,
    setEditUserForm,
    openUserProfile,
    closeUserProfile,
    startEditingUser,
    cancelEditingUser,
    handleUserAction,
  } = useAdminUserProfileWorkflow({ addToast });

  /**
   * Faz a ponte entre configurações do importador e o provider global de settings.
   */
  const {
    handleGeminiApiKeyChange,
    handleSaveImportSettings,
  } = useAdminImportSettingsBridge({
    systemSettings,
    updateSystemSettings,
  });

  /**
   * Carrega a listagem administrativa de questões com paginacao e reload da pagina atual.
   */
  const {
    adminQuestions,
    pagination,
    loadQuestions,
    reloadCurrentPage,
  } = useAdminQuestionsWorkflow({
    keyword: filter,
    activeSubTab,
    addToast,
  });

  /**
   * Prepara os datasets derivados usados pelas subabas de usuários, materiais e reports.
   */
  const {
    filteredUsers,
    filteredMaterials,
    blockedMaterials,
    groupedReports,
  } = useAdminDatabaseDatasets({
    allUsers,
    allMaterials,
    allReports,
    filter,
  });

  /**
   * Unifica o fluxo de importacao e de criacao/edicao manual de questões.
   */
  const {
    openManualModal,
    isManualQuestionModalOpen,
    manualQuestionModalProps,
    importWorkflowProps,
  } = useAdminQuestionWorkbench({
    systemSettings,
    addToast,
    onAddQuestion,
    onAddQuestions,
    onUpdateQuestion,
    onRefreshQuestions: reloadCurrentPage,
  });

  /**
   * Concentra a moderação cruzada de materiais e reports, incluindo atalhos para questões e perfis.
   */
  const {
    editingMaterial,
    materialModerationModalProps,
    openMaterialModerationFromList,
    openBlockedMaterialForReview,
    inspectReportTarget,
    resolveReportQuickly,
  } = useAdminModerationWorkbench({
    questions,
    allMaterials,
    addToast,
    moderateMaterial,
    resolveReport,
    openManualModal,
    openUserProfile,
  });

  /**
   * Props prontas da navegacao lateral/interna da aba de base de dados.
   */
  const navigationProps: React.ComponentProps<typeof AdminDatabaseNavigation> = {
    categories: ADMIN_DATABASE_CATEGORIES,
    activeCategory,
    onSelectCategory: handleSelectCategory,
    activeSubTab,
    onSelectSubTab: handleSelectSubTab,
    subTabLabels: ADMIN_DATABASE_SUBTAB_LABELS,
    filter,
    onFilterChange: setFilter,
    bulkImportEnabled: Boolean(systemSettings.features?.bulkImportEnabled),
    onCreateQuestion: () => openManualModal(),
  };

  /**
   * Props das secoes visiveis da aba, incluindo callbacks de ação e datasets já preparados.
   */
  const sectionsProps: React.ComponentProps<typeof AdminDatabaseSections> = {
    activeSubTab,
    adminQuestions,
    pagination,
    filteredUsers,
    filteredMaterials,
    groupedReports,
    rankings,
    blockedMaterials,
    systemSettings,
    filterTypes,
    activeFilterType,
    filterSearch,
    importWorkflowProps,
    renderSortableHeader,
    sortData,
    onQuestionsPageChange: loadQuestions,
    onQuestionEdit: openManualModal,
    onQuestionDelete: onDeleteQuestion,
    onOpenUserProfile: openUserProfile,
    onModerateMaterial: openMaterialModerationFromList,
    onDeleteMaterial,
    onInspectReport: inspectReportTarget,
    onResolveReport: resolveReportQuickly,
    onEditRanking: openRankingEditor,
    onReanalyzeBlockedMaterial: openBlockedMaterialForReview,
    onActiveFilterTypeChange: setActiveFilterType,
    onFilterSearchChange: setFilterSearch,
    onCreateFilter: openCreateFilterModal,
    onCreateChildFilter: openCreateChildFilterModal,
    onEditFilter: startEditingFilter,
    onDeleteFilter: handleDeleteFilter,
    onGeminiApiKeyChange: handleGeminiApiKeyChange,
    onSaveImportSettings: handleSaveImportSettings,
  };

  /**
   * Props de todos os modais operacionais da area: questões, moderação, perfil, ranking e taxonomias.
   */
  const modalsProps: React.ComponentProps<typeof AdminDatabaseModals> = {
    isManualQuestionModalOpen,
    manualQuestionModalProps,
    editingMaterial,
    materialModerationModalProps,
    viewingProfileId,
    detailedUser,
    isLoadingDetail,
    detailTab,
    onDetailTabChange: setDetailTab,
    isEditingUser,
    editUserForm,
    onEditUserFormChange: setEditUserForm,
    onStartEditingUser: startEditingUser,
    onCancelEditingUser: cancelEditingUser,
    onUserAction: handleUserAction,
    actionLoading,
    onCloseUserProfile: closeUserProfile,
    editingRanking,
    onEditingRankingChange: setEditingRanking,
    onCloseRankingEditor: closeRankingEditor,
    onSaveRanking: handleSaveRanking,
    showTaxonomyModal,
    editingFilterItem,
    activeFilterType,
    filterTypes,
    filterInput,
    filterSlug,
    filterDescription,
    filterWebsite,
    selectedParentId,
    taxonomies: systemSettings.taxonomies,
    onActiveFilterTypeChange: setActiveFilterType,
    onFilterInputChange: setFilterInput,
    onFilterSlugChange: setFilterSlug,
    onFilterDescriptionChange: setFilterDescription,
    onFilterWebsiteChange: setFilterWebsite,
    onSelectedParentIdChange: setSelectedParentId,
    onCloseTaxonomyModal: cancelEditingFilter,
    onSaveFilter: handleSaveFilter,
  };

  return {
    navigationProps,
    sectionsProps,
    modalsProps,
  };
};
