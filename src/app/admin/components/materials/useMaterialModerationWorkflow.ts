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

  const closeMaterialModeration = () => {
    setEditingMaterial(null);
    setSelectedReport(null);
    setModerationReason('');
    setModerationEvidence(null);
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

  const handleApproveMaterial = () => {
    if (!editingMaterial) return;

    const finalReason = moderationReason.trim() || 'Conteúdo revisado e considerado adequado para a plataforma.';
    moderateMaterial(editingMaterial.id, 'approved', finalReason, moderationEvidence || undefined);

    if (selectedReport) {
      resolveReport(selectedReport.id, 'resolved', finalReason, moderationEvidence || undefined);
    }

    closeMaterialModeration();
  };

  const handleHideMaterial = () => {
    if (!editingMaterial) return;

    const finalReason = moderationReason.trim() || 'O conteúdo foi ocultado temporariamente por não atender as diretrizes da comunidade ou estar em revisao.';
    if (!confirm('Ocultar este material da loja?')) return;

    moderateMaterial(editingMaterial.id, 'rejected', finalReason, moderationEvidence || undefined);

    if (selectedReport) {
      resolveReport(selectedReport.id, 'resolved', finalReason, moderationEvidence || undefined);
    }

    closeMaterialModeration();
  };

  const handleBlockMaterial = () => {
    if (!editingMaterial) return;

    const blockReason = moderationReason.trim() || 'Violacao recorrente ou grave das diretrizes da plataforma.';
    const blockMessage = `[CONTEÚDO BLOQUEADO] Seu material foi suspenso. Motivo: "${blockReason}". CASO DISCORDE, VOCÊ TEM 5 DIAS UTEIS PARA CONTESTAR. Envie sua justificativa para suporte@concursomestre.com informando o ID #${editingMaterial.id}.`;

    if (!confirm('Bloquear material permanentemente e solicitar contestacao?')) return;

    moderateMaterial(editingMaterial.id, 'rejected', blockMessage, moderationEvidence || undefined);

    if (selectedReport) {
      resolveReport(selectedReport.id, 'resolved', blockReason, moderationEvidence || undefined);
    }

    closeMaterialModeration();
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
    openMaterialModeration,
    openBlockedMaterialForReview,
    handleEditReportTarget,
    closeMaterialModeration,
    handleApproveMaterial,
    handleHideMaterial,
    handleBlockMaterial,
    handleEvidenceSelected,
  };
};
