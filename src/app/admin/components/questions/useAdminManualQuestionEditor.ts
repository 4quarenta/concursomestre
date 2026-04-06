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
import { useManualQuestionReferenceData } from './useManualQuestionReferenceData';
import { useManualQuestionWorkflow } from './useManualQuestionWorkflow';

type ToastHandler = (message: string, type?: string) => void;

interface UseAdminManualQuestionEditorOptions {
  systemSettings: SystemSettings;
  addToast: ToastHandler;
  onAddQuestion: (question: Question) => Promise<any> | any;
  onUpdateQuestion: (question: Question) => Promise<any> | any;
  onRefreshQuestions: () => Promise<void> | void;
  replaceExtractedQuestion: (index: number, question: Question) => void;
}

export const useAdminManualQuestionEditor = ({
  systemSettings,
  addToast,
  onAddQuestion,
  onUpdateQuestion,
  onRefreshQuestions,
  replaceExtractedQuestion,
}: UseAdminManualQuestionEditorOptions) => {
  const manualQuestionWorkflow = useManualQuestionWorkflow({
    systemSettings,
    addToast,
    onAddQuestion,
    onUpdateQuestion,
    onRefreshQuestions,
    replaceExtractedQuestion,
  });

  const manualQuestionReferenceData = useManualQuestionReferenceData(systemSettings);

  return {
    openManualModal: manualQuestionWorkflow.openManualModal,
    closeManualModal: manualQuestionWorkflow.closeManualModal,
    isManualQuestionModalOpen: manualQuestionWorkflow.showAddManual,
    manualQuestionModalProps: {
      manualQ: manualQuestionWorkflow.manualQ,
      setManualQ: manualQuestionWorkflow.setManualQ,
      editingQuestion: manualQuestionWorkflow.editingQuestion,
      editingExtractedIndex: manualQuestionWorkflow.editingExtractedIndex,
      existingAgencies: manualQuestionReferenceData.existingAgencies,
      existingOrgaos: manualQuestionReferenceData.existingOrgaos,
      existingSubjects: manualQuestionReferenceData.existingSubjects,
      existingTopics: manualQuestionReferenceData.existingTopics,
      existingYears: manualQuestionReferenceData.existingYears,
      existingRoles: manualQuestionReferenceData.existingRoles,
      isGeneratingTeacher: manualQuestionWorkflow.isGeneratingTeacher,
      isGeneratingDetailed: manualQuestionWorkflow.isGeneratingDetailed,
      onGenerateTeacherComment: manualQuestionWorkflow.handleGenerateManualTeacherComment,
      onGenerateDetailedComment: manualQuestionWorkflow.handleGenerateManualDetail,
      onClose: manualQuestionWorkflow.closeManualModal,
      onSave: manualQuestionWorkflow.handleSaveManual,
    },
  };
};
