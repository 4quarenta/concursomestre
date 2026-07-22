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
import type { GlobalTaxonomies } from '@types';
import TaxonomyModal from './TaxonomyModal';
import MaterialModerationModal from '../materials/MaterialModerationModal';
import ManualQuestionModal from '../questions/ManualQuestionModal';
import RankingEditorModal from '../rankings/RankingEditorModal';
import UserProfileAdminModal from '../users/UserProfileAdminModal';
import { AdminConfirmDialog } from '../ui/AdminConfirmDialog';

type MaterialModerationModalProps = React.ComponentProps<typeof MaterialModerationModal>;
type UserProfileAdminModalProps = React.ComponentProps<typeof UserProfileAdminModal>;
type RankingEditorModalProps = React.ComponentProps<typeof RankingEditorModal>;
type TaxonomyModalEditingFilterItem = React.ComponentProps<typeof TaxonomyModal>['editingFilterItem'];

interface AdminDatabaseModalsProps {
  isManualQuestionModalOpen: boolean;
  manualQuestionModalProps: Record<string, unknown>;
  editingMaterial: unknown;
  materialModerationModalProps: MaterialModerationModalProps;
  viewingProfileId: string | null;
  detailedUser: UserProfileAdminModalProps['detailedUser'];
  isLoadingDetail: boolean;
  detailTab: UserProfileAdminModalProps['detailTab'];
  onDetailTabChange: UserProfileAdminModalProps['onDetailTabChange'];
  isEditingUser: boolean;
  editUserForm: UserProfileAdminModalProps['editUserForm'];
  onEditUserFormChange: (value: UserProfileAdminModalProps['editUserForm']) => void;
  onStartEditingUser: () => void;
  onCancelEditingUser: () => void;
  onUserAction: (action: string, payload?: unknown, options?: { actionKey?: string; successMessage?: string }) => Promise<unknown>;
  actionLoading: string | null;
  onCloseUserProfile: () => void;
  editingRanking: RankingEditorModalProps['ranking'];
  onEditingRankingChange: (value: RankingEditorModalProps['ranking']) => void;
  onCloseRankingEditor: () => void;
  onSaveRanking: () => Promise<unknown>;
  showTaxonomyModal: boolean;
  editingFilterItem: TaxonomyModalEditingFilterItem | unknown;
  activeFilterType: string;
  filterTypes: React.ComponentProps<typeof TaxonomyModal>['filterTypes'];
  filterInput: string;
  filterSlug: string;
  filterAcronym: string;
  filterDescription: string;
  filterWebsite: string;
  filterAssetUrl: string;
  isUploadingFilterAsset: boolean;
  filterAliases: string;
  filterKeywords: string;
  selectedParentId: number | string | null;
  taxonomies: GlobalTaxonomies;
  onActiveFilterTypeChange: (value: string) => void;
  onFilterInputChange: (value: string) => void;
  onFilterSlugChange: (value: string) => void;
  onFilterAcronymChange: (value: string) => void;
  onFilterDescriptionChange: (value: string) => void;
  onFilterWebsiteChange: (value: string) => void;
  onFilterAssetUrlChange: (value: string) => void;
  onFilterAssetUpload: (file: File) => Promise<void>;
  onFilterAliasesChange: (value: string) => void;
  onFilterKeywordsChange: (value: string) => void;
  onSelectedParentIdChange: (value: number | string | null) => void;
  onCloseTaxonomyModal: () => void;
  onSaveFilter: () => Promise<unknown>;
  pendingDeleteFilter: { id: number; name: string } | null;
  isDeletingFilter: boolean;
  onCancelDeleteFilter: () => void;
  onConfirmDeleteFilter: () => Promise<unknown> | unknown;
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
  filterAcronym,
  filterDescription,
  filterWebsite,
  filterAssetUrl,
  isUploadingFilterAsset,
  filterAliases,
  filterKeywords,
  selectedParentId,
  taxonomies,
  onActiveFilterTypeChange,
  onFilterInputChange,
  onFilterSlugChange,
  onFilterAcronymChange,
  onFilterDescriptionChange,
  onFilterWebsiteChange,
  onFilterAssetUrlChange,
  onFilterAssetUpload,
  onFilterAliasesChange,
  onFilterKeywordsChange,
  onSelectedParentIdChange,
  onCloseTaxonomyModal,
  onSaveFilter,
  pendingDeleteFilter,
  isDeletingFilter,
  onCancelDeleteFilter,
  onConfirmDeleteFilter,
}: AdminDatabaseModalsProps) => (
  <>
    {isManualQuestionModalOpen && <ManualQuestionModal {...manualQuestionModalProps as unknown as React.ComponentProps<typeof ManualQuestionModal>} />}

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
        editingFilterItem={editingFilterItem as TaxonomyModalEditingFilterItem}
        activeFilterType={activeFilterType}
        filterTypes={filterTypes}
        filterInput={filterInput}
        filterSlug={filterSlug}
        filterAcronym={filterAcronym}
        filterDescription={filterDescription}
        filterWebsite={filterWebsite}
        filterAssetUrl={filterAssetUrl}
        isUploadingFilterAsset={isUploadingFilterAsset}
        filterAliases={filterAliases}
        filterKeywords={filterKeywords}
        selectedParentId={selectedParentId}
        taxonomies={taxonomies}
        onActiveFilterTypeChange={onActiveFilterTypeChange}
        onFilterInputChange={onFilterInputChange}
        onFilterSlugChange={onFilterSlugChange}
        onFilterAcronymChange={onFilterAcronymChange}
        onFilterDescriptionChange={onFilterDescriptionChange}
        onFilterWebsiteChange={onFilterWebsiteChange}
        onFilterAssetUrlChange={onFilterAssetUrlChange}
        onFilterAssetUpload={onFilterAssetUpload}
        onFilterAliasesChange={onFilterAliasesChange}
        onFilterKeywordsChange={onFilterKeywordsChange}
        onSelectedParentIdChange={onSelectedParentIdChange}
        onClose={onCloseTaxonomyModal}
        onSave={onSaveFilter}
      />
    )}

    <AdminConfirmDialog
      isOpen={pendingDeleteFilter !== null}
      title="Excluir filtro"
      description={`O filtro "${pendingDeleteFilter?.name || ''}" será removido permanentemente do cadastro oficial.`}
      confirmLabel="Excluir filtro"
      loading={isDeletingFilter}
      onCancel={onCancelDeleteFilter}
      onConfirm={() => void onConfirmDeleteFilter()}
    />
  </>
);

export default AdminDatabaseModals;
