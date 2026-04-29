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
import { useRouter } from 'next/navigation';
import { useToast } from '@providers/ToastProvider';
import AdminDatabaseNavigation from './AdminDatabaseNavigation';
import AdminDatabaseModals from './AdminDatabaseModals';
import AdminDatabaseSections from './AdminDatabaseSections';
import { ADMIN_DATABASE_CATEGORIES, ADMIN_DATABASE_SUBTAB_LABELS, ADMIN_DATABASE_SUBTAB_META } from './adminDatabaseNavigationConfig';
import { useAdminModerationWorkbench } from './useAdminModerationWorkbench';
import { useAdminExamBankWorkflow } from '../exams/useAdminExamBankWorkflow';
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
import { buildAdminQuestionEditPath } from '../../config/adminPageNavigationConfig';
import { adminService } from '@services/admin/adminService';

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
  saveSystemSettingsNow: (settings?: any) => Promise<any> | any;
  updateRanking: (ranking: any) => Promise<void> | void;
  ensureUsersLoaded?: (force?: boolean) => Promise<void>;
  initialTab?: string;
  standaloneSection?: boolean;
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
  saveSystemSettingsNow,
  updateRanking,
  ensureUsersLoaded = async () => undefined,
  initialTab = 'questions',
  standaloneSection = false,
}: AdminDatabaseManagerControllerProps) => {
  const { addToast } = useToast();
  const router = useRouter();

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
    initialTab: initialTab as any,
    searchTab: initialTab,
    locationHash: typeof window !== 'undefined' ? window.location.hash : '',
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
    pendingDeleteFilter,
    isDeletingFilter,
    requestDeleteFilter,
    cancelDeleteFilter,
    confirmDeleteFilter,
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
  } = useAdminUserProfileWorkflow({
    addToast,
    reloadUsers: () => ensureUsersLoaded(true),
  });

  /**
   * Faz a ponte entre configurações do importador e o provider global de settings.
   */
  const {
    handleGeminiApiKeyChange,
    handleSaveImportSettings,
    isSavingImportSettings,
  } = useAdminImportSettingsBridge({
    systemSettings,
    updateSystemSettings,
    saveSystemSettingsNow,
  });

  /**
   * Carrega a listagem administrativa de questões com paginacao e reload da pagina atual.
   */
  const {
    adminQuestions,
    pagination,
    loadQuestions,
    reloadCurrentPage,
    removeQuestionFromPage,
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
   * Centraliza o banco de provas global para vinculo rapido nas questoes.
   */
  const {
    examBank,
    filteredExamBank,
    linkedCountByExamId,
    deletingExam,
    requestDeleteExam,
    cancelDeleteExam,
    handleDeleteExam,
    actionLoading: examActionLoading,
  } = useAdminExamBankWorkflow({
    questions,
    systemSettings,
    updateSystemSettings,
    saveSystemSettingsNow,
    onUpdateQuestion,
    filter,
    addToast,
  });

  /**
   * Unifica o fluxo de importacao e de criacao/edicao manual de questões.
   */
  const {
    isManualQuestionModalOpen,
    manualQuestionModalProps,
    importWorkflowProps,
  } = useAdminQuestionWorkbench({
    questions,
    systemSettings,
    addToast,
    onAddQuestion,
    onAddQuestions,
    onUpdateQuestion,
    onRefreshQuestions: reloadCurrentPage,
  });

  const openQuestionEditPage = React.useCallback((question: any, report?: any) => {
    const questionId = question?.id ?? report?.questionId;

    if (!questionId) {
      addToast('Nao foi possivel identificar a questao para edicao.', 'error');
      return;
    }

    router.push(buildAdminQuestionEditPath(questionId, report?.id));
  }, [addToast, router]);

  const handleDeleteQuestion = React.useCallback(async (questionId: any) => {
    const result = await onDeleteQuestion(questionId);

    if (result?.success === false) {
      throw new Error(result?.message || 'Nao foi possivel remover a questao.');
    }

    removeQuestionFromPage(questionId);
    if (adminQuestions.length <= 1 && pagination.page > 1) {
      await loadQuestions(pagination.page - 1);
    }
    return result;
  }, [adminQuestions.length, loadQuestions, onDeleteQuestion, pagination.page, removeQuestionFromPage]);

  const handleDeleteUser = React.useCallback(async (user: any) => {
    const userId = String(user?.id || '');

    if (!userId) {
      addToast('Nao foi possivel identificar o usuario para remocao.', 'error');
      return null;
    }

    try {
      const result = await adminService.performUserActionWithResult({
        action: 'delete_user',
        user_id: userId,
      });
      await ensureUsersLoaded(true);
      addToast(result.message || 'Usuario removido com sucesso.', 'success');
      return result;
    } catch (error: any) {
      addToast(error?.message || 'Nao foi possivel remover o usuario.', 'error');
      throw error;
    }
  }, [addToast, ensureUsersLoaded]);

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
    openManualModal: openQuestionEditPage,
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
    subTabMeta: ADMIN_DATABASE_SUBTAB_META,
    bulkImportEnabled: Boolean(systemSettings.features?.bulkImportEnabled),
    standaloneSection,
  };

  /**
   * Props das secoes visiveis da aba, incluindo callbacks de ação e datasets já preparados.
   */
  const sectionsProps: React.ComponentProps<typeof AdminDatabaseSections> = {
    activeSubTab,
    adminQuestions,
    filteredExams: filteredExamBank,
    totalExams: examBank.length,
    linkedCountByExamId,
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
    filter,
    onFilterChange: setFilter,
    onQuestionsPageChange: loadQuestions,
    onCreateQuestion: () => router.push(buildAdminQuestionEditPath('new')),
    onQuestionEdit: openQuestionEditPage,
    onAddQuestions,
    onQuestionUpdate: onUpdateQuestion,
    onQuestionDelete: handleDeleteQuestion,
    onQuestionsRefresh: reloadCurrentPage,
    deletingExam,
    onRequestDeleteExam: requestDeleteExam,
    onCancelDeleteExam: cancelDeleteExam,
    onConfirmDeleteExam: handleDeleteExam,
    examActionLoading,
    onOpenUserProfile: openUserProfile,
    onDeleteUser: handleDeleteUser,
    onModerateMaterial: openMaterialModerationFromList,
    onDeleteMaterial,
    onInspectReport: inspectReportTarget,
    onResolveReport: (report: any) => Promise.resolve(resolveReportQuickly(report)),
    onEditRanking: openRankingEditor,
    onReanalyzeBlockedMaterial: openBlockedMaterialForReview,
    onActiveFilterTypeChange: setActiveFilterType,
    onFilterSearchChange: setFilterSearch,
    onCreateFilter: openCreateFilterModal,
    onCreateChildFilter: (item: any) => openCreateChildFilterModal(String(item?.type || activeFilterType), Number(item?.id || item)),
    onEditFilter: startEditingFilter,
    onDeleteFilter: requestDeleteFilter,
    onGeminiApiKeyChange: handleGeminiApiKeyChange,
    onSaveImportSettings: handleSaveImportSettings,
    isSavingImportSettings,
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
    pendingDeleteFilter,
    isDeletingFilter,
    onCancelDeleteFilter: cancelDeleteFilter,
    onConfirmDeleteFilter: confirmDeleteFilter,
  };

  return {
    navigationProps,
    sectionsProps,
    modalsProps,
  };
};
