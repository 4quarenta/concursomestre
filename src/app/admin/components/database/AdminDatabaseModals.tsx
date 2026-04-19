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
import TaxonomyModal from './TaxonomyModal';
import MaterialModerationModal from '../materials/MaterialModerationModal';
import ManualQuestionModal from '../questions/ManualQuestionModal';
import RankingEditorModal from '../rankings/RankingEditorModal';
import UserProfileAdminModal from '../users/UserProfileAdminModal';
import { AdminConfirmDialog } from '../ui/AdminConfirmDialog';

interface AdminDatabaseModalsProps {
  isManualQuestionModalOpen: boolean;
  manualQuestionModalProps: any;
  editingMaterial: any;
  materialModerationModalProps: any;
  viewingProfileId: string | null;
  detailedUser: any;
  isLoadingDetail: boolean;
  detailTab: React.ComponentProps<typeof UserProfileAdminModal>['detailTab'];
  onDetailTabChange: React.ComponentProps<typeof UserProfileAdminModal>['onDetailTabChange'];
  isEditingUser: boolean;
  editUserForm: any;
  onEditUserFormChange: (value: any) => void;
  onStartEditingUser: () => void;
  onCancelEditingUser: () => void;
  onUserAction: (action: string, payload?: any, options?: { actionKey?: string; successMessage?: string }) => Promise<any>;
  actionLoading: string | null;
  onCloseUserProfile: () => void;
  editingRanking: any;
  onEditingRankingChange: (value: any) => void;
  onCloseRankingEditor: () => void;
  onSaveRanking: () => Promise<any>;
  showTaxonomyModal: boolean;
  editingFilterItem: any;
  activeFilterType: string;
  filterTypes: any[];
  filterInput: string;
  filterSlug: string;
  filterDescription: string;
  filterWebsite: string;
  selectedParentId: number | null;
  taxonomies: Record<string, any[]>;
  onActiveFilterTypeChange: (value: string) => void;
  onFilterInputChange: (value: string) => void;
  onFilterSlugChange: (value: string) => void;
  onFilterDescriptionChange: (value: string) => void;
  onFilterWebsiteChange: (value: string) => void;
  onSelectedParentIdChange: (value: number | null) => void;
  onCloseTaxonomyModal: () => void;
  onSaveFilter: () => Promise<any>;
  pendingDeleteFilter: { id: number; name: string } | null;
  isDeletingFilter: boolean;
  onCancelDeleteFilter: () => void;
  onConfirmDeleteFilter: () => Promise<any> | any;
}

const AdminDatabaseModals = ({
  isManualQuestionModalOpen,
  manualQuestionModalProps,
  editingMaterial,
  materialModerationModalProps,
  viewingProfileId,
  detailedUser,
  isLoadingDetail,
  detailTab,
  onDetailTabChange,
  isEditingUser,
  editUserForm,
  onEditUserFormChange,
  onStartEditingUser,
  onCancelEditingUser,
  onUserAction,
  actionLoading,
  onCloseUserProfile,
  editingRanking,
  onEditingRankingChange,
  onCloseRankingEditor,
  onSaveRanking,
  showTaxonomyModal,
  editingFilterItem,
  activeFilterType,
  filterTypes,
  filterInput,
  filterSlug,
  filterDescription,
  filterWebsite,
  selectedParentId,
  taxonomies,
  onActiveFilterTypeChange,
  onFilterInputChange,
  onFilterSlugChange,
  onFilterDescriptionChange,
  onFilterWebsiteChange,
  onSelectedParentIdChange,
  onCloseTaxonomyModal,
  onSaveFilter,
  pendingDeleteFilter,
  isDeletingFilter,
  onCancelDeleteFilter,
  onConfirmDeleteFilter,
}: AdminDatabaseModalsProps) => (
  <>
    {isManualQuestionModalOpen && <ManualQuestionModal {...manualQuestionModalProps} />}

    {editingMaterial && materialModerationModalProps && <MaterialModerationModal {...materialModerationModalProps} />}

    {viewingProfileId && (
      <UserProfileAdminModal
        viewingProfileId={viewingProfileId}
        detailedUser={detailedUser}
        isLoadingDetail={isLoadingDetail}
        detailTab={detailTab}
        onDetailTabChange={onDetailTabChange}
        isEditingUser={isEditingUser}
        editUserForm={editUserForm}
        onEditUserFormChange={onEditUserFormChange}
        onStartEditingUser={onStartEditingUser}
        onCancelEditingUser={onCancelEditingUser}
        onUserAction={onUserAction}
        actionLoading={actionLoading}
        onClose={onCloseUserProfile}
      />
    )}

    {editingRanking && (
      <RankingEditorModal
        ranking={editingRanking}
        setRanking={onEditingRankingChange}
        onClose={onCloseRankingEditor}
        onSave={onSaveRanking}
      />
    )}

    {showTaxonomyModal && (
      <TaxonomyModal
        editingFilterItem={editingFilterItem}
        activeFilterType={activeFilterType}
        filterTypes={filterTypes}
        filterInput={filterInput}
        filterSlug={filterSlug}
        filterDescription={filterDescription}
        filterWebsite={filterWebsite}
        selectedParentId={selectedParentId}
        taxonomies={taxonomies}
        onActiveFilterTypeChange={onActiveFilterTypeChange}
        onFilterInputChange={onFilterInputChange}
        onFilterSlugChange={onFilterSlugChange}
        onFilterDescriptionChange={onFilterDescriptionChange}
        onFilterWebsiteChange={onFilterWebsiteChange}
        onSelectedParentIdChange={onSelectedParentIdChange}
        onClose={onCloseTaxonomyModal}
        onSave={onSaveFilter}
      />
    )}

    <AdminConfirmDialog
      isOpen={pendingDeleteFilter !== null}
      title="Excluir filtro"
      description={`O filtro "${pendingDeleteFilter?.name || ''}" sera removido permanentemente do cadastro oficial.`}
      confirmLabel="Excluir filtro"
      loading={isDeletingFilter}
      onCancel={onCancelDeleteFilter}
      onConfirm={() => void onConfirmDeleteFilter()}
    />
  </>
);

export default AdminDatabaseModals;
