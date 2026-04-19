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
  questions: Question[];
  systemSettings: SystemSettings;
  addToast: ToastHandler;
  onAddQuestion: (question: Question) => Promise<any> | any;
  onAddQuestions: (questions: Question[]) => Promise<any> | any;
  onUpdateQuestion: (question: Question) => Promise<any> | any;
  onRefreshQuestions: () => Promise<void> | void;
}

export const useAdminQuestionWorkbench = ({
  questions,
  systemSettings,
  addToast,
  onAddQuestion,
  onAddQuestions,
  onUpdateQuestion,
  onRefreshQuestions,
}: UseAdminQuestionWorkbenchOptions) => {
  const importWorkflow = useAdminImportWorkflow({
    systemSettings,
    addToast,
    onAddQuestions,
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
      extractWithComment: importWorkflow.extractWithComment,
      onExtractWithCommentChange: importWorkflow.setExtractWithComment,
      isProcessing: importWorkflow.isProcessing,
      examProgress: importWorkflow.examProgress,
      keyProgress: importWorkflow.keyProgress,
      onStartImport: importWorkflow.handleImportProcess,
      logs: importWorkflow.logs,
      extractedQuestions: importWorkflow.extractedQuestions,
      isBulkGenerating: importWorkflow.isBulkGenerating,
      bulkProgress: importWorkflow.bulkProgress,
      onGenerateDetailedAll: importWorkflow.handleBulkGenerateDetailed,
      onPublishAll: importWorkflow.handlePublishAllExtracted,
      onEditExtractedQuestion: manualQuestionEditor.openManualModal,
      generatingSpecific: importWorkflow.generatingSpecific,
      onGenerateSpecific: importWorkflow.handleGenerateSpecific,
    },
  };
};
