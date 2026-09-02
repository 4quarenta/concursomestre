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
import type { ErrorReport, Material, Question, Ranking, SystemSettings, UserProfile } from '@types';
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

type AdminDatabaseSubTab =
  | 'questions'
  | 'question-groups'
  | 'exams'
  | 'files'
  | 'blog'
  | 'novidades'
  | 'users'
  | 'materials'
  | 'rankings'
  | 'import'
  | 'gran-crawler'
  | 'reports'
  | 'blocked'
  | 'filters'
  | 'lei-comentada';

type MutationResult = { success?: boolean; message?: string } | null | void;
type SettingsMutationResult = SystemSettings | MutationResult;
type TaxonomyTriggerItem = {
  id?: number | string;
  type?: string;
};
type FilterTableItem = {
  id?: number | string;
  name?: string;
  slug?: string;
  type?: string;
  parentId?: number | string | null;
  parent_id?: number | string | null;
  description?: string;
  website?: string;
  taxonomyLevel?: string;
  metadata?: Record<string, unknown>;
};

const VALID_ADMIN_DATABASE_SUBTABS: AdminDatabaseSubTab[] = [
  'questions',
  'question-groups',
  'exams',
  'files',
  'blog',
  'novidades',
  'users',
  'materials',
  'rankings',
  'import',
  'gran-crawler',
  'reports',
  'blocked',
  'filters',
  'lei-comentada',
];

const resolveInitialDatabaseTab = (value?: string): AdminDatabaseSubTab => (
  value && VALID_ADMIN_DATABASE_SUBTABS.includes(value as AdminDatabaseSubTab)
    ? value as AdminDatabaseSubTab
    : 'questions'
);

const isMutationFailure = (result: MutationResult): result is { success?: boolean; message?: string } => (
  typeof result === 'object' && result !== null
);

export interface AdminDatabaseManagerControllerProps {
  questions: Question[];
  allUsers: UserProfile[];
  allMaterials: Material[];
  allReports: ErrorReport[];
  rankings?: Ranking[];
  onDeleteQuestion: (questionId: string | number) => Promise<MutationResult> | MutationResult;
  onAddQuestion: (question: Question) => Promise<MutationResult> | MutationResult;
  onAddQuestions: (questions: Question[]) => Promise<MutationResult> | MutationResult;
  onUpdateQuestion: (question: Question) => Promise<MutationResult> | MutationResult;
  resolveReport: (reportId: string | number, status: string, reason?: string) => Promise<MutationResult> | MutationResult;
  moderateMaterial: (...args: unknown[]) => Promise<unknown> | unknown;
  onDeleteMaterial: (materialId: string) => Promise<MutationResult> | MutationResult;
  systemSettings: SystemSettings;
  updateSystemSettings: (settings: SystemSettings) => Promise<SettingsMutationResult> | SettingsMutationResult;
  saveSystemSettingsNow: (settings?: SystemSettings) => Promise<SettingsMutationResult> | SettingsMutationResult;
  updateRanking: (ranking: Ranking) => Promise<void> | void;
  ensureUsersLoaded?: (force?: boolean) => Promise<void>;
  initialTab?: string;
  standaloneSection?: boolean;
}

/**
 * Controller central da aba "Base de Dados".
 * Ele orquestra navegação interna, datasets filtrados, workbenches de questões/importação, moderação, perfil de usuário, ranking e taxonomias.
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
  const resolvedInitialTab = resolveInitialDatabaseTab(initialTab);
  const addAdminToast = React.useCallback((message: string, type?: string) => {
    const normalizedType = type === 'success' || type === 'error' || type === 'warning' || type === 'info'
      ? type
      : 'info';
    addToast(message, normalizedType);
  }, [addToast]);

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
    initialTab: resolvedInitialTab,
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
  } = useAdminTaxonomyWorkflow({
    addToast: addAdminToast,
  });

  /**
   * Padroniza ordenação compartilhada entre tabelas da feature.
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
    addToast: addAdminToast,
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
    addToast: addAdminToast,
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
   * Carrega a listagem administrativa de questões com paginação e reload da página atual.
   */
  const {
    adminQuestions,
    pagination,
    isLoadingQuestions,
    questionsError,
    loadQuestions,
    reloadCurrentPage,
    removeQuestionFromPage,
  } = useAdminQuestionsWorkflow({
    keyword: filter,
    activeSubTab,
    addToast: addAdminToast,
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
    hasMoreExams,
    isLoadingMoreExams,
    loadMoreExams,
  } = useAdminExamBankWorkflow({
    enabled: activeSubTab === 'exams',
    questions,
    systemSettings,
    updateSystemSettings,
    saveSystemSettingsNow,
    onUpdateQuestion,
    filter,
    addToast: addAdminToast,
  });

  /**
   * Unifica o fluxo de importação e de criação/edição manual de questões.
   */
  const {
    isManualQuestionModalOpen,
    manualQuestionModalProps,
    importWorkflowProps,
  } = useAdminQuestionWorkbench({
    importEnabled: activeSubTab === 'import',
    questions,
    systemSettings,
    addToast: addAdminToast,
    onAddQuestion,
    onUpdateQuestion,
    onRefreshQuestions: reloadCurrentPage,
    onImportedQuestionsSaved: () => {
      void reloadCurrentPage();
    },
    updateSystemSettings,
    saveSystemSettingsNow,
  });

  const openQuestionEditPage = React.useCallback((question?: Partial<Question> | null, report?: Partial<ErrorReport> | null) => {
    const questionId = question?.id ?? report?.questionId;

    if (!questionId) {
      addToast('Não foi possível identificar a questão para edição.', 'error');
      return;
    }

    router.push(buildAdminQuestionEditPath(questionId, report?.id));
  }, [addToast, router]);

  const handleDeleteQuestion = React.useCallback(async (questionId: string | number) => {
    const result = await onDeleteQuestion(questionId);

    if (isMutationFailure(result) && result.success === false) {
      throw new Error(result.message || 'Não foi possível remover a questão.');
    }

    removeQuestionFromPage(questionId);
    if (adminQuestions.length <= 1 && pagination.page > 1) {
      await loadQuestions(pagination.page - 1);
    }
    return result;
  }, [adminQuestions.length, loadQuestions, onDeleteQuestion, pagination.page, removeQuestionFromPage]);

  const handleDeleteUser = React.useCallback(async (user: Partial<UserProfile>) => {
    const userId = String(user?.id || '');

    if (!userId) {
      addToast('Não foi possível identificar o usuário para remoção.', 'error');
      return null;
    }

    try {
      const result = await adminService.performUserActionWithResult({
        action: 'delete_user',
        user_id: userId,
      });
      await ensureUsersLoaded(true);
      addToast(result.message || 'Usuário removido com sucesso.', 'success');
      return result;
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Não foi possível remover o usuário.';
      addToast(message, 'error');
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
    addToast: addAdminToast,
    moderateMaterial,
    resolveReport,
    openManualModal: openQuestionEditPage,
    openUserProfile,
  });

  /**
   * Props prontas da navegação lateral/interna da aba de base de dados.
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
    isLoadingQuestions,
    questionsError,
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
    hasMoreExams,
    isLoadingMoreExams,
    onLoadMoreExams: loadMoreExams,
    onOpenUserProfile: openUserProfile,
    onDeleteUser: handleDeleteUser,
    onModerateMaterial: openMaterialModerationFromList,
    onDeleteMaterial,
    onInspectReport: (group) => inspectReportTarget(group.lastReport),
    onResolveReport: (group) => Promise.all(group.reports.map((report) => Promise.resolve(resolveReportQuickly(report)))),
    onEditRanking: openRankingEditor,
    onReanalyzeBlockedMaterial: openBlockedMaterialForReview,
    onActiveFilterTypeChange: setActiveFilterType,
    onFilterSearchChange: setFilterSearch,
    onCreateFilter: openCreateFilterModal,
    onCreateChildFilter: (item: TaxonomyTriggerItem | number | string) => {
      const parentId = typeof item === 'object' && item !== null ? item.id : item;
      const parentType = typeof item === 'object' && item !== null ? item.type : undefined;
      openCreateChildFilterModal(String(parentType || activeFilterType), Number(parentId || item));
    },
    onEditFilter: (item: FilterTableItem) => startEditingFilter({
      id: typeof item.id === 'number' ? item.id : Number(item.id || 0) || undefined,
      name: item.name,
      slug: item.slug,
      type: item.type,
      parentId: item.parentId ?? item.parent_id,
      parent_id: item.parent_id ?? item.parentId,
      description: item.description,
      website: item.website,
      metadata: item.metadata,
    }),
    onDeleteFilter: (item: FilterTableItem) => requestDeleteFilter({
      id: typeof item.id === 'number' ? item.id : Number(item.id || 0),
      name: item.name,
    }),
    onDeleteFiltersInBulk: deleteFiltersInBulk,
    isDeletingFilters: isDeletingFilter,
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
    onUserAction: (action, payload, options) => handleUserAction(
      action,
      payload && typeof payload === 'object' ? payload as Record<string, unknown> : {},
      options,
    ),
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
    filterAcronym,
    filterDescription,
    filterWebsite,
    filterAssetUrl,
    isUploadingFilterAsset,
    filterAliases,
    filterKeywords,
    selectedParentId,
    taxonomies: systemSettings.taxonomies || {
      agencies: [],
      organizations: [],
      subjects: [],
      topics: [],
      roles: [],
      careers: [],
      years: [],
      modalities: [],
    },
    onActiveFilterTypeChange: setActiveFilterType,
    onFilterInputChange: setFilterInput,
    onFilterSlugChange: setFilterSlug,
    onFilterAcronymChange: setFilterAcronym,
    onFilterDescriptionChange: setFilterDescription,
    onFilterWebsiteChange: setFilterWebsite,
    onFilterAssetUrlChange: setFilterAssetUrl,
    onFilterAssetUpload: uploadFilterAsset,
    onFilterAliasesChange: setFilterAliases,
    onFilterKeywordsChange: setFilterKeywords,
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
