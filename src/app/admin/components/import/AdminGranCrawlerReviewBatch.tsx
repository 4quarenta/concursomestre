'use client';

import React from 'react';
import type { SystemSettings } from '@types';
import { useToast } from '@providers/ToastProvider';
import ManualQuestionModal from '../questions/ManualQuestionModal';
import { useAdminQuestionWorkbench } from '../questions/useAdminQuestionWorkbench';
import AdminImportSection from './AdminImportSection';
import type { GranImportPayload } from './AdminGranCrawlerSection';

interface AdminGranCrawlerReviewBatchProps {
  payload: GranImportPayload;
  cardsOnly?: boolean;
  systemSettings: SystemSettings;
  onGeminiApiKeyChange: (value: string) => void;
  onSaveSettings: () => Promise<unknown> | unknown;
  isSavingSettings?: boolean;
  onImportedQuestionsSaved?: () => Promise<void> | void;
}

const getPayloadKey = (payload: GranImportPayload) => (
  payload.exam.sourceKey
  || payload.exam.externalId
  || payload.exam.title
  || `gran-${payload.questions[0]?.tempId || 'proof'}`
);

const ignoreDirectQuestionMutation = async () => null;

const AdminGranCrawlerReviewBatch = ({
  payload,
  cardsOnly = false,
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
    onImportedQuestionsSaved,
  });
  const payloadJson = React.useMemo(() => JSON.stringify(payload), [payload]);
  const importedPayloadRef = React.useRef('');

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

  return (
    <section
      className="space-y-3"
      data-gran-review-batch={getPayloadKey(payload)}
    >
      <AdminImportSection
        reviewOnly
        reviewDisplayMode={cardsOnly ? 'cards' : 'full'}
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
