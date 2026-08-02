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

import type { Question, SystemSettings } from '@types';
import { useAdminImportWorkflow } from '../import/useAdminImportWorkflow';
import { useAdminManualQuestionEditor } from './useAdminManualQuestionEditor';

type ToastHandler = (message: string, type?: string) => void;

interface UseAdminQuestionWorkbenchOptions {
  importEnabled?: boolean;
  questions: Question[];
  systemSettings: SystemSettings;
  addToast: ToastHandler;
  onAddQuestion: (question: Question) => Promise<unknown> | unknown;
  onUpdateQuestion: (question: Question) => Promise<unknown> | unknown;
  onRefreshQuestions: () => Promise<void> | void;
  onImportedQuestionsSaved?: (questions: Question[]) => void;
  updateSystemSettings?: (settings: SystemSettings) => Promise<unknown> | unknown;
  saveSystemSettingsNow?: (settings?: SystemSettings) => Promise<unknown> | unknown;
}

export const useAdminQuestionWorkbench = ({
  importEnabled = true,
  questions,
  systemSettings,
  addToast,
  onAddQuestion,
  onUpdateQuestion,
  onRefreshQuestions,
  onImportedQuestionsSaved,
  updateSystemSettings,
  saveSystemSettingsNow,
}: UseAdminQuestionWorkbenchOptions) => {
  const importWorkflow = useAdminImportWorkflow({
    enabled: importEnabled,
    systemSettings,
    addToast,
    onImportedQuestionsSaved,
    updateSystemSettings,
    saveSystemSettingsNow,
  });

  const manualQuestionEditor = useAdminManualQuestionEditor({
    questions,
    systemSettings,
    addToast,
    onAddQuestion,
    onUpdateQuestion,
    onRefreshQuestions,
    replaceExtractedQuestion: importWorkflow.replaceExtractedQuestion,
  });

  return {
    openManualModal: manualQuestionEditor.openManualModal,
    isManualQuestionModalOpen: manualQuestionEditor.isManualQuestionModalOpen,
    manualQuestionModalProps: manualQuestionEditor.manualQuestionModalProps,
    importWorkflowProps: {
      qFile: importWorkflow.qFile,
      onQFileChange: importWorkflow.setQFile,
      kFile: importWorkflow.kFile,
      onKFileChange: importWorkflow.setKFile,
      examBank: importWorkflow.examBank,
      isLoadingExamBank: importWorkflow.isLoadingExamBank,
      selectedExamId: importWorkflow.selectedExamId,
      onSelectedExamIdChange: importWorkflow.handleSelectedExamIdChange,
      selectedExamFocusLabel: importWorkflow.selectedExamFocusLabel,
      inheritedProofFileName: importWorkflow.inheritedProofFileName,
      inheritedAnswerKeyFileName: importWorkflow.inheritedAnswerKeyFileName,
      selectedFocusId: importWorkflow.selectedFocusId,
      onSelectedFocusIdChange: importWorkflow.setSelectedFocusId,
      manualFocusName: importWorkflow.manualFocusName,
      onManualFocusNameChange: importWorkflow.setManualFocusName,
      importMetadata: importWorkflow.importMetadata ? { ...importWorkflow.importMetadata } : null,
      importDiagnostics: importWorkflow.importDiagnostics,
      onImportMetadataChange: importWorkflow.updateImportMetadataField,
      extractedContexts: importWorkflow.extractedContexts,
      extractWithComment: importWorkflow.extractWithComment,
      onExtractWithCommentChange: importWorkflow.setExtractWithComment,
      extractWithDetailedAnalysis: importWorkflow.extractWithDetailedAnalysis,
      onExtractWithDetailedAnalysisChange: importWorkflow.setExtractWithDetailedAnalysis,
      isProcessing: importWorkflow.isProcessing,
      examProgress: importWorkflow.examProgress,
      keyProgress: importWorkflow.keyProgress,
      onStartImport: importWorkflow.handleImportProcess,
      logs: importWorkflow.logs,
      extractedQuestions: importWorkflow.extractedQuestions,
      isBulkGenerating: importWorkflow.isBulkGenerating,
      bulkGenerationType: importWorkflow.bulkGenerationType,
      isRetryingMissingQuestions: importWorkflow.isRetryingMissingQuestions,
      bulkProgress: importWorkflow.bulkProgress,
      publishedExam: importWorkflow.publishedExam,
      publishedQuestionNumbers: importWorkflow.publishedQuestionNumbers,
      publishingAction: importWorkflow.publishingAction,
      onGenerateTeacherAll: importWorkflow.handleBulkGenerateTeacher,
      onGenerateDetailedAll: importWorkflow.handleBulkGenerateDetailed,
      onRetryMissingQuestions: importWorkflow.handleRetryMissingQuestions,
      onParseQuestionsFromText: importWorkflow.handleParseQuestionsFromText,
      onImportFromAiJson: importWorkflow.handleImportFromAiJson,
      onImportExternalEditorialJson: importWorkflow.handleImportExternalEditorialJson,
      onPublishExam: importWorkflow.handlePublishExamOnly,
      onPublishAllQuestions: importWorkflow.handlePublishAllQuestions,
      onPublishSelectedQuestions: importWorkflow.handlePublishSelectedQuestions,
      onPublishQuestion: importWorkflow.handlePublishSingleQuestion,
      prepareSelectedGranReviewPublication: importWorkflow.prepareSelectedGranReviewPublication,
      onGranReviewPublicationResult: importWorkflow.applyGranReviewPublicationResult,
      onEditExtractedQuestion: manualQuestionEditor.openManualModal,
      onMarkExtractedQuestionReviewed: importWorkflow.markExtractedQuestionReviewed,
      onDeleteExtractedQuestion: importWorkflow.removeExtractedQuestion,
      onContextFigureCropChange: importWorkflow.updateContextFigureCrop,
      onExtractedQuestionFieldChange: importWorkflow.updateExtractedQuestionField,
      onExtractedQuestionStatementChange: importWorkflow.updateExtractedQuestionStatement,
      onExtractedQuestionIntroTextChange: importWorkflow.updateExtractedQuestionIntroText,
      onExtractedQuestionReferenceTextChange: importWorkflow.updateExtractedQuestionReferenceText,
      onExtractedQuestionOptionChange: importWorkflow.updateExtractedQuestionOption,
      onExtractedQuestionCorrectOptionChange: importWorkflow.updateExtractedQuestionCorrectOption,
      onExtractedQuestionOptionAdd: importWorkflow.addExtractedQuestionOption,
      onExtractedQuestionOptionRemove: importWorkflow.removeExtractedQuestionOption,
      onExtractedQuestionSupportImageAdd: importWorkflow.addExtractedQuestionSupportImage,
      onExtractedQuestionOptionImageChange: importWorkflow.updateExtractedQuestionOptionImage,
      onExtractedQuestionContextAdd: importWorkflow.addExtractedContextForQuestion,
      onExtractedContextAdd: importWorkflow.addExtractedContext,
      onExtractedContextRemove: importWorkflow.removeExtractedContext,
      onExtractedContextContentChange: importWorkflow.updateExtractedContextContent,
      onExtractedContextFieldChange: importWorkflow.updateExtractedContextField,
      onExtractedContextQuestionNumbersChange: importWorkflow.updateExtractedContextQuestionNumbers,
      onExtractedContextImageChange: importWorkflow.updateExtractedContextImage,
      onExtractedQuestionSupportImageCropChange: importWorkflow.updateExtractedQuestionSupportImageCrop,
      onExtractedQuestionSupportImageRemove: importWorkflow.removeExtractedQuestionSupportImage,
      onExtractedQuestionOptionImageCropChange: importWorkflow.updateExtractedQuestionOptionImageCrop,
      generatingSpecific: importWorkflow.generatingSpecific,
      onGenerateSpecific: importWorkflow.handleGenerateSpecific,
    },
  };
};
