'use client';

import React from 'react';
import type { Question, SystemSettings } from '@types';
import { useToast } from '@providers/ToastProvider';
import type { ImportedQuestionBatchPayload } from '@services/questions';
import ManualQuestionModal from '../questions/ManualQuestionModal';
import { useAdminQuestionWorkbench } from '../questions/useAdminQuestionWorkbench';
import AdminImportSection from './AdminImportSection';
import { isQuestionReadyForImportPublication } from './adminImportWorkflowPublicationCore';
import type { GranImportPayload } from './AdminGranCrawlerSection';

type SelectableQuestionIndexesHandler = () => number[];
export type GranReviewBatchPublisher = {
  prepare: (indexes: number[]) => { error?: string; questionNumbers?: number[]; payload?: ImportedQuestionBatchPayload };
  apply: (result: Record<string, unknown>) => void;
};

interface AdminGranCrawlerReviewBatchProps {
  payload: GranImportPayload;
  cardsOnly?: boolean;
  selectedQuestionIndexes?: ReadonlySet<number>;
  reviewQuestionQueueStatuses?: Record<number, 'queued' | 'processing' | 'published' | 'failed'>;
  onPublishQuestion?: (index: number) => void;
  onSelectedQuestionChange?: (payloadKey: string, index: number, selected: boolean) => void;
  onRegisterBatchPublisher?: (payloadKey: string, handler: GranReviewBatchPublisher | null) => void;
  onRegisterSelectableQuestionIndexes?: (payloadKey: string, handler: SelectableQuestionIndexesHandler | null) => void;
  systemSettings: SystemSettings;
  onGeminiApiKeyChange: (value: string) => void;
  onSaveSettings: () => Promise<unknown> | unknown;
  isSavingSettings?: boolean;
  onImportedQuestionsSaved?: () => Promise<void> | void;
}

const getPayloadKey = (payload: GranImportPayload) => {
  const examKey = payload.exam.sourceKey || payload.exam.externalId || payload.exam.title || 'proof';
  const firstQuestion = payload.questions[0];
  const questionKey = firstQuestion?.source?.externalId || firstQuestion?.tempId || 'empty';
  return `${examKey}::${questionKey}`;
};

const ignoreDirectQuestionMutation = async () => null;

const AdminGranCrawlerReviewBatch = ({
  payload,
  cardsOnly = false,
  selectedQuestionIndexes,
  reviewQuestionQueueStatuses,
  onPublishQuestion,
  onSelectedQuestionChange,
  onRegisterBatchPublisher,
  onRegisterSelectableQuestionIndexes,
  systemSettings,
  onGeminiApiKeyChange,
  onSaveSettings,
  isSavingSettings,
  onImportedQuestionsSaved,
}: AdminGranCrawlerReviewBatchProps) => {
  const { addToast } = useToast();
  const {
    importWorkflowProps,
    isManualQuestionModalOpen,
    manualQuestionModalProps,
  } = useAdminQuestionWorkbench({
    importEnabled: false,
    questions: [],
    systemSettings,
    addToast,
    onAddQuestion: ignoreDirectQuestionMutation,
    onUpdateQuestion: ignoreDirectQuestionMutation,
    onRefreshQuestions: onImportedQuestionsSaved || (() => undefined),
    onImportedQuestionsSaved: cardsOnly ? () => undefined : onImportedQuestionsSaved,
  });
  const payloadJson = React.useMemo(() => JSON.stringify(payload), [payload]);
  const importedPayloadRef = React.useRef('');
  const payloadKey = React.useMemo(() => getPayloadKey(payload), [payload]);
  const getSelectableQuestionIndexes = React.useCallback(() => {
    const publishedQuestionNumbers = new Set(importWorkflowProps.publishedQuestionNumbers || []);

    return importWorkflowProps.extractedQuestions.reduce<number[]>((indexes, question, index) => {
      const questionRecord = question as Question & {
        questionNumber?: number | string;
        question_number?: number | string;
        number?: number | string;
      };
      const candidateNumber = Number(
        questionRecord.questionNumber
        ?? questionRecord.question_number
        ?? questionRecord.number
        ?? index + 1,
      );
      const questionNumber = Number.isFinite(candidateNumber) && candidateNumber > 0
        ? candidateNumber
        : index + 1;

      if (
        isQuestionReadyForImportPublication(question)
        && !publishedQuestionNumbers.has(questionNumber)
        && !['queued', 'processing', 'published'].includes(reviewQuestionQueueStatuses?.[index] || '')
      ) {
        indexes.push(index);
      }

      return indexes;
    }, []);
  }, [importWorkflowProps.extractedQuestions, importWorkflowProps.publishedQuestionNumbers, reviewQuestionQueueStatuses]);

  React.useEffect(() => {
    if (importedPayloadRef.current === payloadJson) {
      return;
    }

    importedPayloadRef.current = payloadJson;
    void importWorkflowProps.onImportFromAiJson(payloadJson, { silentSuccess: true });
    // The payload signature owns this isolated queue. Workflow callbacks are intentionally
    // excluded because they are recreated while the imported review state is updated.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [payloadJson]);

  React.useEffect(() => {
    if (!cardsOnly || !onRegisterBatchPublisher) return;
    onRegisterBatchPublisher(payloadKey, {
      prepare: importWorkflowProps.prepareSelectedGranReviewPublication,
      apply: importWorkflowProps.onGranReviewPublicationResult,
    });
    return () => onRegisterBatchPublisher(payloadKey, null);
  }, [cardsOnly, importWorkflowProps.onGranReviewPublicationResult, importWorkflowProps.prepareSelectedGranReviewPublication, onRegisterBatchPublisher, payloadKey]);

  React.useEffect(() => {
    if (!cardsOnly || !onRegisterSelectableQuestionIndexes) return;

    onRegisterSelectableQuestionIndexes(payloadKey, getSelectableQuestionIndexes);
    return () => onRegisterSelectableQuestionIndexes(payloadKey, null);
  }, [cardsOnly, getSelectableQuestionIndexes, onRegisterSelectableQuestionIndexes, payloadKey]);

  return (
    <section
      className="space-y-3"
      data-gran-review-batch={payloadKey}
    >
      <AdminImportSection
        reviewOnly
        reviewDisplayMode={cardsOnly ? 'cards' : 'full'}
        reviewSelectedQuestionIndexes={selectedQuestionIndexes}
        reviewQuestionQueueStatuses={reviewQuestionQueueStatuses}
        onReviewQuestionPublishRequest={onPublishQuestion}
        onReviewQuestionSelectionChange={(index, selected) => onSelectedQuestionChange?.(payloadKey, index, selected)}
        reviewSourceLabel={payload.exam.title || 'Prova de origem não identificada'}
        systemSettings={systemSettings}
        onGeminiApiKeyChange={onGeminiApiKeyChange}
        onSaveSettings={onSaveSettings}
        isSavingSettings={isSavingSettings}
        {...importWorkflowProps}
      />
      {isManualQuestionModalOpen ? (
        <ManualQuestionModal
          {...manualQuestionModalProps as unknown as React.ComponentProps<typeof ManualQuestionModal>}
        />
      ) : null}
    </section>
  );
};

export default AdminGranCrawlerReviewBatch;
