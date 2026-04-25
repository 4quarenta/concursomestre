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
import FiltersManagementSection from './FiltersManagementSection';
import AdminMaterialsSection from '../materials/AdminMaterialsSection';
import BlockedMaterialsSection from '../materials/BlockedMaterialsSection';
import AdminExamBankSection from '../exams/AdminExamBankSection';
import AdminImportSection from '../import/AdminImportSection';
import AdminLegalCommentarySection from '../legal-commentary/AdminLegalCommentarySection';
import AdminQuestionsSection from '../questions/AdminQuestionsSection';
import AdminRankingsSection from '../rankings/AdminRankingsSection';
import AdminReportsSection from '../reports/AdminReportsSection';
import {
  getReportTargetBadgeClass,
  getReportTargetLabel,
} from '../reports/reportModeration';
import AdminUsersSection from '../users/AdminUsersSection';

interface AdminDatabaseSectionsProps {
  activeSubTab: string;
  adminQuestions: any[];
  filteredExams: any[];
  totalExams: number;
  linkedCountByExamId: Map<string, number>;
  pagination: any;
  filteredUsers: any[];
  filteredMaterials: any[];
  groupedReports: any[];
  rankings: any[];
  blockedMaterials: any[];
  systemSettings: any;
  filterTypes: any[];
  activeFilterType: string;
  filterSearch: string;
  importWorkflowProps: any;
  renderSortableHeader: (label: string, sortKey: string) => React.ReactNode;
  sortData: <T>(data: T[]) => T[];
  filter: string;
  onFilterChange: (value: string) => void;
  onQuestionsPageChange: (page: number) => void;
  onCreateQuestion: () => void;
  onQuestionEdit: (question?: any) => void;
  onQuestionUpdate: (question: any) => Promise<any> | any;
  onQuestionDelete: (questionId: any) => Promise<any> | any;
  onQuestionsRefresh?: () => Promise<void> | void;
  deletingExam: any;
  onRequestDeleteExam: (exam: any) => void;
  onCancelDeleteExam: () => void;
  onConfirmDeleteExam: () => void;
  examActionLoading: 'save' | 'delete' | null;
  onOpenUserProfile: (userId: string) => void;
  onModerateMaterial: (material: any) => void;
  onDeleteMaterial: (materialId: string) => Promise<any> | any;
  onInspectReport: (report: any) => void;
  onResolveReport: (reportId: any, reason?: string) => Promise<any>;
  onEditRanking: (ranking: any) => void;
  onReanalyzeBlockedMaterial: (material: any) => void;
  onActiveFilterTypeChange: (value: string) => void;
  onFilterSearchChange: (value: string) => void;
  onCreateFilter: () => void;
  onCreateChildFilter: (item: any) => void;
  onEditFilter: (item: any) => void;
  onDeleteFilter: (item: any) => Promise<any> | any;
  onGeminiApiKeyChange: (value: string) => void;
  onSaveImportSettings: () => Promise<any> | any;
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
  onQuestionUpdate,
  onQuestionDelete,
  onQuestionsRefresh,
  deletingExam,
  onRequestDeleteExam,
  onCancelDeleteExam,
  onConfirmDeleteExam,
  examActionLoading,
  onOpenUserProfile,
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
        onUpdate={onQuestionUpdate}
        onDelete={onQuestionDelete}
        onPageChange={onQuestionsPageChange}
        onRefresh={onQuestionsRefresh}
      />
    );
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
