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

import { useState } from 'react';
import type { ErrorReport, Material, Question } from '@types';
import { getQuickReportResolutionReason } from '../reports/reportModeration';

type ToastHandler = (message: string, type?: string) => void;

interface UseMaterialModerationWorkflowOptions {
  questions: Question[];
  allMaterials: Material[];
  addToast: ToastHandler;
  moderateMaterial: (materialId: string, status: string, reason: string, evidenceUrl?: string) => void;
  resolveReport: (reportId: string, status: string, resolution?: string, evidenceUrl?: string) => void;
  openManualModal: (question?: Question) => void;
}

type MaterialModerationAction = 'hide' | 'block' | null;

export const useMaterialModerationWorkflow = ({
  questions,
  allMaterials,
  addToast,
  moderateMaterial,
  resolveReport,
  openManualModal,
}: UseMaterialModerationWorkflowOptions) => {
  const [editingMaterial, setEditingMaterial] = useState<Material | null>(null);
  const [selectedReport, setSelectedReport] = useState<ErrorReport | null>(null);
  const [moderationReason, setModerationReason] = useState('');
  const [moderationEvidence, setModerationEvidence] = useState<string | null>(null);
  const [pendingModerationAction, setPendingModerationAction] = useState<MaterialModerationAction>(null);
  const [actionLoading, setActionLoading] = useState<'approve' | 'hide' | 'block' | null>(null);

  const closeMaterialModeration = () => {
    setEditingMaterial(null);
    setSelectedReport(null);
    setModerationReason('');
    setModerationEvidence(null);
    setPendingModerationAction(null);
    setActionLoading(null);
  };

  const openMaterialModeration = (material: Material, report?: ErrorReport | null) => {
    setEditingMaterial(material);
    setSelectedReport(report || null);
    setModerationReason(material.rejectionReason || '');
    setModerationEvidence(null);
  };

  const handleEditReportTarget = (report: ErrorReport) => {
    setSelectedReport(report);

    if (report.targetType === 'question' && report.questionId) {
      const question = questions.find((currentQuestion: Question) => currentQuestion.id === report.questionId);
      if (question) {
        openManualModal(question);
      } else {
        addToast('Questão não encontrada (pode ter sido excluida).', 'error');
      }
      return;
    }

    if (report.targetType === 'material') {
      if (!report.materialId) {
        addToast('Erro: ID do material não encontrado na denúncia.', 'error');
        return;
      }

      const material = allMaterials.find((currentMaterial: Material) => currentMaterial.id === report.materialId);
      if (material) {
        openMaterialModeration(material, report);
      } else {
        addToast(`Material não encontrado com ID: ${report.materialId}`, 'error');
      }
      return;
    }

    if (report.targetType === 'comment') {
      setModerationReason(getQuickReportResolutionReason(report));
      addToast('Denúncias de comentário já podem ser resolvidas ou ignoradas. O editor do alvo ainda não foi acoplado ao painel.', 'info');
    }
  };

  const handleApproveMaterial = async () => {
    if (!editingMaterial) return;

    const finalReason = moderationReason.trim() || 'Conteúdo revisado e considerado adequado para a plataforma.';
    setActionLoading('approve');

    try {
      await moderateMaterial(editingMaterial.id, 'approved', finalReason, moderationEvidence || undefined);

      if (selectedReport) {
        await resolveReport(selectedReport.id, 'resolved', finalReason, moderationEvidence || undefined);
      }

      closeMaterialModeration();
    } finally {
      setActionLoading(null);
    }
  };

  const handleHideMaterial = () => {
    if (!editingMaterial || actionLoading) return;
    setPendingModerationAction('hide');
  };

  const handleBlockMaterial = () => {
    if (!editingMaterial || actionLoading) return;
    setPendingModerationAction('block');
  };

  const cancelPendingModerationAction = () => {
    if (actionLoading) return;
    setPendingModerationAction(null);
  };

  const confirmPendingModerationAction = async () => {
    if (!editingMaterial || !pendingModerationAction) return;

    const isHideAction = pendingModerationAction === 'hide';
    const finalReason = isHideAction
      ? moderationReason.trim() || 'O conteúdo foi ocultado temporariamente por não atender as diretrizes da comunidade ou estar em revisao.'
      : moderationReason.trim() || 'Violacao recorrente ou grave das diretrizes da plataforma.';
    const blockMessage = `[CONTEUDO BLOQUEADO] Seu material foi suspenso. Motivo: "${finalReason}". CASO DISCORDE, VOCE TEM 5 DIAS UTEIS PARA CONTESTAR. Envie sua justificativa para suporte@concursomestre.com informando o ID #${editingMaterial.id}.`;

    setActionLoading(pendingModerationAction);

    try {
      await moderateMaterial(
        editingMaterial.id,
        'rejected',
        isHideAction ? finalReason : blockMessage,
        moderationEvidence || undefined,
      );

      if (selectedReport) {
        await resolveReport(selectedReport.id, 'resolved', finalReason, moderationEvidence || undefined);
      }

      closeMaterialModeration();
    } finally {
      setActionLoading(null);
      setPendingModerationAction(null);
    }
  };

  const handleEvidenceSelected = (file: File | null) => {
    if (!file) return;
    setModerationEvidence(URL.createObjectURL(file));
  };

  const openBlockedMaterialForReview = (material: Material) => {
    setSelectedReport(null);
    openMaterialModeration(material, null);
  };

  return {
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
  };
};
