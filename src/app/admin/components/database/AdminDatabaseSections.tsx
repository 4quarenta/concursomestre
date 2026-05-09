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
import type { Material, Prova, Question, Ranking, SystemSettings, UserProfile } from '@types';
import FiltersManagementSection from './FiltersManagementSection';
import AdminMaterialsSection from '../materials/AdminMaterialsSection';
import BlockedMaterialsSection from '../materials/BlockedMaterialsSection';
import AdminExamBankSection from '../exams/AdminExamBankSection';
import AdminImportSection from '../import/AdminImportSection';
import AdminLegalCommentarySection from '../legal-commentary/AdminLegalCommentarySection';
import AdminQuestionGroupsSection from '../questions/AdminQuestionGroupsSection';
import AdminQuestionsSection from '../questions/AdminQuestionsSection';
import AdminRankingsSection from '../rankings/AdminRankingsSection';
import AdminReportsSection from '../reports/AdminReportsSection';
import {
  getReportTargetBadgeClass,
  getReportTargetLabel,
} from '../reports/reportModeration';
import AdminUsersSection from '../users/AdminUsersSection';

type AdminQuestionsSectionProps = React.ComponentProps<typeof AdminQuestionsSection>;
type AdminExamBankSectionProps = React.ComponentProps<typeof AdminExamBankSection>;
type AdminUsersSectionProps = React.ComponentProps<typeof AdminUsersSection>;
type AdminMaterialsSectionProps = React.ComponentProps<typeof AdminMaterialsSection>;
type AdminReportsSectionProps = React.ComponentProps<typeof AdminReportsSection>;
type AdminRankingsSectionProps = React.ComponentProps<typeof AdminRankingsSection>;
type BlockedMaterialsSectionProps = React.ComponentProps<typeof BlockedMaterialsSection>;
type FiltersManagementSectionProps = React.ComponentProps<typeof FiltersManagementSection>;
type AdminImportSectionProps = React.ComponentProps<typeof AdminImportSection>;

interface AdminDatabaseSectionsProps {
  activeSubTab: string;
  adminQuestions: Question[];
  filteredExams: Prova[];
  totalExams: number;
  linkedCountByExamId: Map<string, number>;
  pagination: AdminQuestionsSectionProps['pagination'];
  filteredUsers: UserProfile[];
  filteredMaterials: Material[];
  groupedReports: AdminReportsSectionProps['reports'];
  rankings: Ranking[];
  blockedMaterials: Material[];
  systemSettings: SystemSettings;
  filterTypes: FiltersManagementSectionProps['filterTypes'];
  activeFilterType: string;
  filterSearch: string;
  importWorkflowProps: Omit<AdminImportSectionProps, 'systemSettings' | 'onGeminiApiKeyChange' | 'onSaveSettings' | 'isSavingSettings'>;
  renderSortableHeader: (label: string, sortKey: string) => React.ReactNode;
  sortData: <T>(data: T[]) => T[];
  filter: string;
  onFilterChange: (value: string) => void;
  onQuestionsPageChange: (page: number) => void;
  onCreateQuestion: () => void;
  onQuestionEdit: AdminQuestionsSectionProps['onEdit'];
  onAddQuestions: AdminQuestionsSectionProps['onAddQuestions'];
  onQuestionUpdate: AdminQuestionsSectionProps['onUpdate'];
  onQuestionDelete: AdminQuestionsSectionProps['onDelete'];
  onQuestionsRefresh?: () => Promise<void> | void;
  deletingExam: AdminExamBankSectionProps['deletingExam'];
  onRequestDeleteExam: AdminExamBankSectionProps['onRequestDelete'];
  onCancelDeleteExam: () => void;
  onConfirmDeleteExam: () => void;
  examActionLoading: 'save' | 'delete' | null;
  onOpenUserProfile: (userId: string) => void;
  onDeleteUser: AdminUsersSectionProps['onDeleteUser'];
  onModerateMaterial: AdminMaterialsSectionProps['onModerate'];
  onDeleteMaterial: AdminMaterialsSectionProps['onDelete'];
  onInspectReport: AdminReportsSectionProps['onInspect'];
  onResolveReport: AdminReportsSectionProps['onResolve'];
  onEditRanking: AdminRankingsSectionProps['onEdit'];
  onReanalyzeBlockedMaterial: BlockedMaterialsSectionProps['onReanalyze'];
  onActiveFilterTypeChange: (value: string) => void;
  onFilterSearchChange: (value: string) => void;
  onCreateFilter: () => void;
  onCreateChildFilter: FiltersManagementSectionProps['onAddChild'];
  onEditFilter: FiltersManagementSectionProps['onEdit'];
  onDeleteFilter: FiltersManagementSectionProps['onDelete'];
  onGeminiApiKeyChange: (value: string) => void;
  onSaveImportSettings: () => Promise<unknown> | unknown;
  isSavingImportSettings?: boolean;
}

const AdminDatabaseSections = ({
  activeSubTab,
  adminQuestions,
  filteredExams,
  totalExams,
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
  onFilterChange,
  onQuestionsPageChange,
  onCreateQuestion,
  onQuestionEdit,
  onAddQuestions,
  onQuestionUpdate,
  onQuestionDelete,
  onQuestionsRefresh,
  deletingExam,
  onRequestDeleteExam,
  onCancelDeleteExam,
  onConfirmDeleteExam,
  examActionLoading,
  onOpenUserProfile,
  onDeleteUser,
  onModerateMaterial,
  onDeleteMaterial,
  onInspectReport,
  onResolveReport,
  onEditRanking,
  onReanalyzeBlockedMaterial,
  onActiveFilterTypeChange,
  onFilterSearchChange,
  onCreateFilter,
  onCreateChildFilter,
  onEditFilter,
  onDeleteFilter,
  onGeminiApiKeyChange,
  onSaveImportSettings,
  isSavingImportSettings,
}: AdminDatabaseSectionsProps) => {
  if (activeSubTab === 'questions') {
    return (
      <AdminQuestionsSection
        questions={sortData(adminQuestions)}
        pagination={pagination}
        filter={filter}
        onFilterChange={onFilterChange}
        renderSortableHeader={renderSortableHeader}
        onCreate={onCreateQuestion}
        onEdit={onQuestionEdit}
        onAddQuestions={onAddQuestions}
        onUpdate={onQuestionUpdate}
        onDelete={onQuestionDelete}
        onPageChange={onQuestionsPageChange}
        onRefresh={onQuestionsRefresh}
        systemSettings={systemSettings}
      />
    );
  }

  if (activeSubTab === 'question-groups') {
    return <AdminQuestionGroupsSection />;
  }

  if (activeSubTab === 'exams') {
    return (
      <AdminExamBankSection
        exams={filteredExams}
        totalExams={totalExams}
        linkedCountByExamId={linkedCountByExamId}
        filter={filter}
        onFilterChange={onFilterChange}
        deletingExam={deletingExam}
        onRequestDelete={onRequestDeleteExam}
        onCancelDelete={onCancelDeleteExam}
        onConfirmDelete={onConfirmDeleteExam}
        actionLoading={examActionLoading}
      />
    );
  }

  if (activeSubTab === 'users') {
    return (
      <AdminUsersSection
        users={sortData(filteredUsers)}
        filter={filter}
        onFilterChange={onFilterChange}
        renderSortableHeader={renderSortableHeader}
        onOpenProfile={onOpenUserProfile}
        onDeleteUser={onDeleteUser}
      />
    );
  }

  if (activeSubTab === 'materials') {
    return (
      <AdminMaterialsSection
        materials={sortData(filteredMaterials)}
        filter={filter}
        onFilterChange={onFilterChange}
        renderSortableHeader={renderSortableHeader}
        onModerate={onModerateMaterial}
        onDelete={onDeleteMaterial}
      />
    );
  }

  if (activeSubTab === 'reports') {
    return (
      <AdminReportsSection
        reports={sortData(groupedReports)}
        filter={filter}
        onFilterChange={onFilterChange}
        renderSortableHeader={renderSortableHeader}
        getReportTargetBadgeClass={getReportTargetBadgeClass}
        getReportTargetLabel={getReportTargetLabel}
        onInspect={onInspectReport}
        onResolve={onResolveReport}
      />
    );
  }

  if (activeSubTab === 'rankings') {
    return (
      <AdminRankingsSection
        rankings={sortData(rankings)}
        filter={filter}
        onFilterChange={onFilterChange}
        renderSortableHeader={renderSortableHeader}
        onEdit={onEditRanking}
      />
    );
  }

  if (activeSubTab === 'blocked') {
    return (
      <BlockedMaterialsSection
        materials={blockedMaterials}
        onReanalyze={onReanalyzeBlockedMaterial}
      />
    );
  }

  if (activeSubTab === 'filters') {
    return (
      <FiltersManagementSection
        systemSettings={systemSettings}
        filterTypes={filterTypes}
        activeFilterType={activeFilterType}
        onActiveFilterTypeChange={onActiveFilterTypeChange}
        filterSearch={filterSearch}
        onFilterSearchChange={onFilterSearchChange}
        onCreate={onCreateFilter}
        onAddChild={onCreateChildFilter}
        onEdit={onEditFilter}
        onDelete={onDeleteFilter}
      />
    );
  }

  if (activeSubTab === 'lei-comentada') {
    return <AdminLegalCommentarySection filter={filterSearch} />;
  }

  if (activeSubTab === 'import') {
    return (
      <AdminImportSection
        systemSettings={systemSettings}
        onGeminiApiKeyChange={onGeminiApiKeyChange}
        onSaveSettings={onSaveImportSettings}
        isSavingSettings={isSavingImportSettings}
        {...importWorkflowProps}
      />
    );
  }

  return null;
};

export default AdminDatabaseSections;
