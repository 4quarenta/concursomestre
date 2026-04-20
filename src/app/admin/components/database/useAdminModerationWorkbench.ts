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

import type { ErrorReport, Material, Question } from '@types';
import { getQuickReportResolutionReason, getReportModerationTemplates } from '../reports/reportModeration';
import { useMaterialModerationWorkflow } from '../materials/useMaterialModerationWorkflow';

type ToastHandler = (message: string, type?: string) => void;

interface UseAdminModerationWorkbenchOptions {
  questions: Question[];
  allMaterials: Material[];
  addToast: ToastHandler;
  moderateMaterial: (materialId: string, status: string, reason: string, evidenceUrl?: string) => void;
  resolveReport: (reportId: string, status: string, resolution?: string, evidenceUrl?: string) => void;
  openManualModal: (question?: Question, report?: ErrorReport) => void;
  openUserProfile: (userId: string) => void;
}

export const useAdminModerationWorkbench = ({
  questions,
  allMaterials,
  addToast,
  moderateMaterial,
  resolveReport,
  openManualModal,
  openUserProfile,
}: UseAdminModerationWorkbenchOptions) => {
  const {
    editingMaterial,
    selectedReport,
    moderationReason,
    setModerationReason,
    moderationEvidence,
    setModerationEvidence,
    pendingModerationAction,
    actionLoading,
    openMaterialModeration,
    openBlockedMaterialForReview,
    handleEditReportTarget,
    closeMaterialModeration,
    handleApproveMaterial,
    handleHideMaterial,
    handleBlockMaterial,
    cancelPendingModerationAction,
    confirmPendingModerationAction,
    handleEvidenceSelected,
  } = useMaterialModerationWorkflow({
    questions,
    allMaterials,
    addToast,
    moderateMaterial,
    resolveReport,
    openManualModal,
  });

  const resolveReportQuickly = (report: ErrorReport) => {
    return resolveReport(report.id, 'resolved', getQuickReportResolutionReason(report));
  };

  const materialModerationModalProps = editingMaterial
    ? {
        material: editingMaterial,
        selectedReport,
        moderationReason,
        onModerationReasonChange: setModerationReason,
        moderationEvidence,
        onEvidenceSelected: handleEvidenceSelected,
        onClearEvidence: () => setModerationEvidence(null),
        templates: getReportModerationTemplates(selectedReport),
        onApplyTemplate: setModerationReason,
        onOpenAuthorProfile: openUserProfile,
        onOpenReporterProfile: openUserProfile,
        onClose: closeMaterialModeration,
        onApprove: handleApproveMaterial,
        onHide: handleHideMaterial,
        onBlock: handleBlockMaterial,
        pendingModerationAction,
        actionLoading,
        onCancelPendingAction: cancelPendingModerationAction,
        onConfirmPendingAction: confirmPendingModerationAction,
      }
    : null;

  return {
    editingMaterial,
    materialModerationModalProps,
    openMaterialModerationFromList: (material: Material) => openMaterialModeration(material, null),
    openBlockedMaterialForReview,
    inspectReportTarget: handleEditReportTarget,
    resolveReportQuickly,
  };
};
