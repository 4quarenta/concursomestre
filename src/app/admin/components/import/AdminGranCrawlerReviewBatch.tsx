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
import { classifyGranReviewQuestionIndexes } from './granCrawlerReviewUtils';

export type GranQuestionIndexAvailability = {
  selectable: number[];
  publishable: number[];
};
type SelectableQuestionIndexesHandler = () => GranQuestionIndexAvailability;
export type GranReviewBatchPublisher = {
  prepare: (indexes: number[]) => { error?: string; questionNumbers?: number[]; payload?: ImportedQuestionBatchPayload };
  apply: (result: Record<string, unknown>) => void;
};

interface AdminGranCrawlerReviewBatchProps {
  payload: GranImportPayload;
  cardsOnly?: boolean;
  selectedQuestionIndexes?: ReadonlySet<number>;
  reviewQuestionQueueStatuses?: Record<number, 'queued' | 'processing' | 'published' | 'failed'>;
  reviewQuestionQueueErrors?: Record<number, string>;
  onPublishQuestion?: (index: number) => void;
  onSelectedQuestionChange?: (payloadKey: string, index: number, selected: boolean) => void;
  onRegisterBatchPublisher?: (payloadKey: string, handler: GranReviewBatchPublisher | null) => void;
  onRegisterSelectableQuestionIndexes?: (payloadKey: string, handler: SelectableQuestionIndexesHandler | null) => void;
  reviewQueueIndexOffset?: number;
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
  reviewQuestionQueueErrors,
  onPublishQuestion,
  onSelectedQuestionChange,
  onRegisterBatchPublisher,
  onRegisterSelectableQuestionIndexes,
  reviewQueueIndexOffset = 0,
  systemSettings,
  onGeminiApiKeyChange,
  onSaveSettings,
  isSavingSettings,
  onImportedQuestionsSaved,
}: AdminGranCrawlerReviewBatchProps) => {
  const { addToast } = useToast();
  const addImportToast = React.useCallback((message: string, type?: string) => {
    const normalizedType = type === 'success' || type === 'error' || type === 'warning' || type === 'info'
      ? type
      : 'info';
    addToast(message, normalizedType);
  }, [addToast]);
  const {
    importWorkflowProps,
    isManualQuestionModalOpen,
    manualQuestionModalProps,
  } = useAdminQuestionWorkbench({
    importEnabled: false,
    questions: [],
    systemSettings,
    addToast: addImportToast,
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
    const questionNumber = (question: Question, index: number) => {
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
      return Number.isFinite(candidateNumber) && candidateNumber > 0
        ? candidateNumber
        : index + 1;
    };

    return classifyGranReviewQuestionIndexes({
      questions: importWorkflowProps.extractedQuestions,
      isPublished: (question, index) => publishedQuestionNumbers.has(questionNumber(question, index)),
      isReady: isQuestionReadyForImportPublication,
      queueStatuses: reviewQuestionQueueStatuses,
    });
  }, [importWorkflowProps.extractedQuestions, importWorkflowProps.publishedQuestionNumbers, reviewQuestionQueueStatuses]);

  const prepareGranPublication = React.useCallback((indexes: number[]) => {
    const prepared = importWorkflowProps.prepareSelectedGranReviewPublication(indexes);
    if (!prepared.payload) return prepared;

    const importMetadata = payload.import && typeof payload.import === 'object'
      ? payload.import as Record<string, unknown>
      : undefined;
    return {
      ...prepared,
      payload: {
        ...prepared.payload,
        ...(importMetadata ? { import: importMetadata } : {}),
      },
    };
  }, [importWorkflowProps.prepareSelectedGranReviewPublication, payload.import]);

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
      prepare: prepareGranPublication,
      apply: importWorkflowProps.onGranReviewPublicationResult,
    });
    return () => onRegisterBatchPublisher(payloadKey, null);
  }, [cardsOnly, importWorkflowProps.onGranReviewPublicationResult, onRegisterBatchPublisher, payloadKey, prepareGranPublication]);

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
        reviewAllowIncompleteSelection
        reviewQueueIndexOffset={reviewQueueIndexOffset}
        reviewQuestionQueueStatuses={reviewQuestionQueueStatuses}
        reviewQuestionQueueErrors={reviewQuestionQueueErrors}
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
