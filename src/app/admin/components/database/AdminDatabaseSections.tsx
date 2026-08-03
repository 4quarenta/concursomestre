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
import { CheckCircle2, ListChecks, Loader2, X } from 'lucide-react';
import type { Material, Prova, Question, Ranking, SystemSettings, UserProfile } from '@types';
import { apiClient } from '@services/api';
import type { ImportedQuestionBatchPayload } from '@services/questions';
import { useToast } from '@providers/ToastProvider';
import FiltersManagementSection from './FiltersManagementSection';
import AdminMaterialsSection from '../materials/AdminMaterialsSection';
import BlockedMaterialsSection from '../materials/BlockedMaterialsSection';
import AdminExamBankSection from '../exams/AdminExamBankSection';
import AdminImportSection from '../import/AdminImportSection';
import AdminGranCrawlerSection, {
  type GranImportPayload,
  type GranPublicationBatch,
} from '../import/AdminGranCrawlerSection';
import AdminGranCrawlerReviewBatch, {
  type GranQuestionIndexAvailability,
  type GranReviewBatchPublisher,
} from '../import/AdminGranCrawlerReviewBatch';
import { getGranReviewQueueOffsets } from '../import/granCrawlerReviewUtils';
import AdminLegalCommentarySection from '../legal-commentary/AdminLegalCommentarySection';
import AdminQuestionGroupsSection from '../questions/AdminQuestionGroupsSection';
import AdminQuestionsSection from '../questions/AdminQuestionsSection';
import AdminRankingsSection from '../rankings/AdminRankingsSection';
import AdminReportsSection from '../reports/AdminReportsSection';
import {
  getReportTargetBadgeClass,
  getReportTargetLabel,
} from '../reports/reportModeration';
import AdminUsersSection from '../users/AdminUsersSection';

type AdminQuestionsSectionProps = React.ComponentProps<typeof AdminQuestionsSection>;
type AdminExamBankSectionProps = React.ComponentProps<typeof AdminExamBankSection>;
type AdminUsersSectionProps = React.ComponentProps<typeof AdminUsersSection>;
type AdminMaterialsSectionProps = React.ComponentProps<typeof AdminMaterialsSection>;
type AdminReportsSectionProps = React.ComponentProps<typeof AdminReportsSection>;
type AdminRankingsSectionProps = React.ComponentProps<typeof AdminRankingsSection>;
type BlockedMaterialsSectionProps = React.ComponentProps<typeof BlockedMaterialsSection>;
type FiltersManagementSectionProps = React.ComponentProps<typeof FiltersManagementSection>;
type AdminImportSectionProps = React.ComponentProps<typeof AdminImportSection>;

const getGranPayloadKey = (payload: GranImportPayload) => {
  const examKey = payload.exam.sourceKey || payload.exam.externalId || payload.exam.title || 'proof';
  const firstQuestion = payload.questions[0];
  const questionKey = firstQuestion?.source?.externalId || firstQuestion?.tempId || 'empty';
  return `${examKey}::${questionKey}`;
};

interface AdminGranCrawlerReviewQueueProps {
  payloads: GranImportPayload[];
  publicationBatches: GranPublicationBatch[];
  onPublicationQueued: () => void;
  systemSettings: SystemSettings;
  onGeminiApiKeyChange: (value: string) => void;
  onSaveSettings: () => Promise<unknown> | unknown;
  isSavingSettings?: boolean;
  onImportedQuestionsSaved?: () => Promise<void> | void;
}

type GranSelectableQuestionIndexes = () => GranQuestionIndexAvailability;

const AdminGranCrawlerReviewQueue = ({
  payloads,
  publicationBatches,
  onPublicationQueued,
  systemSettings,
  onGeminiApiKeyChange,
  onSaveSettings,
  isSavingSettings,
  onImportedQuestionsSaved,
}: AdminGranCrawlerReviewQueueProps) => {
  const { addToast } = useToast();
  const [selectedQuestionIndexesByPayload, setSelectedQuestionIndexesByPayload] = React.useState<Record<string, number[]>>({});
  const [selectableQuestionIndexesByPayload, setSelectableQuestionIndexesByPayload] = React.useState<Record<string, number[]>>({});
  const [publishableQuestionIndexesByPayload, setPublishableQuestionIndexesByPayload] = React.useState<Record<string, number[]>>({});
  const [isPublishingSelected, setIsPublishingSelected] = React.useState(false);
  const publishersRef = React.useRef(new Map<string, GranReviewBatchPublisher>());
  const queueStatusByQuestionKey = React.useMemo(() => {
    const statuses: Record<string, 'queued' | 'processing' | 'published' | 'failed'> = {};
    publicationBatches.forEach((batch) => {
      Object.entries(batch.questionStatuses || {}).forEach(([key, status]) => {
        if (!(key in statuses)) statuses[key] = status;
      });
    });
    return statuses;
  }, [publicationBatches]);
  const selectedSelectableIndexesByPayload = React.useMemo(() => Object.fromEntries(
    Object.entries(selectedQuestionIndexesByPayload).map(([payloadKey, indexes]) => {
      const selectableIndexes = new Set(selectableQuestionIndexesByPayload[payloadKey] || []);
      return [payloadKey, indexes.filter((index) => selectableIndexes.has(index))];
    }),
  ) as Record<string, number[]>, [selectedQuestionIndexesByPayload, selectableQuestionIndexesByPayload]);
  const selectedReadyIndexesByPayload = React.useMemo(() => Object.fromEntries(
    Object.entries(selectedSelectableIndexesByPayload).map(([payloadKey, indexes]) => {
      const publishableIndexes = new Set(publishableQuestionIndexesByPayload[payloadKey] || []);
      return [payloadKey, indexes.filter((index) => publishableIndexes.has(index))];
    }),
  ) as Record<string, number[]>, [publishableQuestionIndexesByPayload, selectedSelectableIndexesByPayload]);
  const selectedPayloadKeys = Object.entries(selectedReadyIndexesByPayload)
    .filter(([, indexes]) => indexes.length > 0)
    .map(([payloadKey]) => payloadKey);
  const selectedReadyQuestionCount = selectedPayloadKeys.reduce(
    (count, payloadKey) => count + (selectedReadyIndexesByPayload[payloadKey]?.length || 0),
    0,
  );
  const selectedQuestionCount = Object.values(selectedSelectableIndexesByPayload)
    .reduce((count, indexes) => count + indexes.length, 0);
  const selectableQuestionCount = Object.values(selectableQuestionIndexesByPayload)
    .reduce((count, indexes) => count + indexes.length, 0);
  const areAllSelectableQuestionsSelected = selectableQuestionCount > 0
    && Object.entries(selectableQuestionIndexesByPayload).every(([payloadKey, indexes]) => {
      const selectedIndexes = new Set(selectedSelectableIndexesByPayload[payloadKey] || []);
      return indexes.every((index) => selectedIndexes.has(index));
    });
  const handleSelectedQuestionChange = React.useCallback((payloadKey: string, index: number, selected: boolean) => {
    setSelectedQuestionIndexesByPayload((previous) => {
      const indexes = new Set(previous[payloadKey] || []);
      if (selected) indexes.add(index);
      else indexes.delete(index);

      if (indexes.size === 0) {
        const next = { ...previous };
        delete next[payloadKey];
        return next;
      }

      return {
        ...previous,
        [payloadKey]: Array.from(indexes).sort((left, right) => left - right),
      };
    });
  }, []);
  const handleRegisterBatchPublisher = React.useCallback((payloadKey: string, handler: GranReviewBatchPublisher | null) => {
    if (handler) publishersRef.current.set(payloadKey, handler);
    else publishersRef.current.delete(payloadKey);
  }, []);
  const handleRegisterSelectableQuestionIndexes = React.useCallback((payloadKey: string, handler: GranSelectableQuestionIndexes | null) => {
    const availability = handler?.() || null;
    const updateIndexes = (
      setter: React.Dispatch<React.SetStateAction<Record<string, number[]>>>,
      source: number[] | null,
    ) => setter((previous) => {
      if (!handler) {
        if (!(payloadKey in previous)) return previous;
        const next = { ...previous };
        delete next[payloadKey];
        return next;
      }

      const indexes = Array.from(new Set(source || []))
        .filter((index) => Number.isInteger(index) && index >= 0)
        .sort((left, right) => left - right);
      const current = previous[payloadKey] || [];
      if (current.length === indexes.length && current.every((index, position) => index === indexes[position])) {
        return previous;
      }
      return { ...previous, [payloadKey]: indexes };
    });
    updateIndexes(setSelectableQuestionIndexesByPayload, availability?.selectable || null);
    updateIndexes(setPublishableQuestionIndexesByPayload, availability?.publishable || null);
  }, []);
  const handleToggleAllSelectableQuestions = React.useCallback(() => {
    setSelectedQuestionIndexesByPayload(
      areAllSelectableQuestionsSelected
        ? {}
        : Object.fromEntries(
          Object.entries(selectableQuestionIndexesByPayload)
            .filter(([, indexes]) => indexes.length > 0)
            .map(([payloadKey, indexes]) => [payloadKey, indexes]),
        ),
    );
  }, [areAllSelectableQuestionsSelected, selectableQuestionIndexesByPayload]);
  const handlePublishSelected = async () => {
    if (isPublishingSelected || selectedReadyQuestionCount === 0) return;

    setIsPublishingSelected(true);
    try {
      const batches: Array<{ clientKey: string; payload: ImportedQuestionBatchPayload }> = [];
      const preparationErrors: string[] = [];
      for (const payloadKey of selectedPayloadKeys) {
        const handler = publishersRef.current.get(payloadKey);
        const indexes = selectedReadyIndexesByPayload[payloadKey] || [];
        if (!handler || indexes.length === 0) continue;

        const prepared = handler.prepare(indexes);
        if (!prepared.payload) {
          preparationErrors.push(prepared.error || 'Não foi possível preparar este lote para publicação.');
          continue;
        }
        batches.push({ clientKey: payloadKey, payload: prepared.payload });
      }
      if (batches.length === 0) {
        addToast(preparationErrors[0] || 'Nenhuma questão selecionada está pronta para publicação.', 'error');
        return;
      }

      const response = await apiClient.post('admin/gran_crawler.php', {
        action: 'enqueue_publication',
        payloads: batches.map((batch) => batch.payload),
        idempotencyKey: `gran-ui-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`,
      });
      const body = response.data as {
        success?: boolean;
        message?: string;
        data?: { batchId?: string; questionCount?: number; jobCount?: number };
      };
      if (body?.success === false) {
        throw new Error(body.message || 'Não foi possível enfileirar as questões selecionadas.');
      }

      setSelectedQuestionIndexesByPayload({});
      onPublicationQueued();
      addToast(
        `${body.data?.questionCount || selectedReadyQuestionCount} questão(ões) pronta(s) foram enviadas em um lote assíncrono${body.data?.jobCount ? ` com ${body.data.jobCount} job(s)` : ''}${selectedQuestionCount > selectedReadyQuestionCount ? `; ${selectedQuestionCount - selectedReadyQuestionCount} item(ns) incompleto(s) permaneceram na revisão.` : '.'}`,
        preparationErrors.length > 0 || selectedQuestionCount > selectedReadyQuestionCount ? 'warning' : 'success',
      );
    } catch (error) {
      addToast(error instanceof Error ? error.message : 'Não foi possível publicar as questões selecionadas.', 'error');
    } finally {
      setIsPublishingSelected(false);
    }
  };
  const handlePublishQuestion = React.useCallback(async (payloadKey: string, index: number) => {
    if (isPublishingSelected) return;
    const handler = publishersRef.current.get(payloadKey);
    const prepared = handler?.prepare([index]);
    if (!prepared?.payload) {
      addToast(prepared?.error || 'Esta questão ainda não está pronta para publicação.', 'error');
      return;
    }

    setIsPublishingSelected(true);
    try {
      const response = await apiClient.post('admin/gran_crawler.php', {
        action: 'enqueue_publication',
        payloads: [prepared.payload],
        idempotencyKey: `gran-ui-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`,
      });
      const body = response.data as { success?: boolean; message?: string };
      if (body?.success === false) throw new Error(body.message || 'Não foi possível enfileirar a questão.');
      setSelectedQuestionIndexesByPayload((previous) => {
        const next = { ...previous };
        const indexes = (next[payloadKey] || []).filter((candidate) => candidate !== index);
        if (indexes.length > 0) next[payloadKey] = indexes;
        else delete next[payloadKey];
        return next;
      });
      onPublicationQueued();
      addToast('Questão enviada para a fila de publicação.', 'success');
    } catch (error) {
      addToast(error instanceof Error ? error.message : 'Não foi possível enfileirar a questão.', 'error');
    } finally {
      setIsPublishingSelected(false);
    }
  }, [addToast, isPublishingSelected, onPublicationQueued]);

  const reviewQueueOffsets = React.useMemo(() => getGranReviewQueueOffsets(payloads), [payloads]);

  return (
    <div className="space-y-4" aria-label="Fila unificada de revisão do Gran">
      <div className="sticky top-3 z-20 flex flex-wrap items-center justify-between gap-3 rounded-sm border border-sky-200 bg-white/95 px-4 py-3 shadow-sm backdrop-blur dark:border-sky-900/50 dark:bg-slate-950/95">
        <div>
          <p className="text-xs font-black uppercase tracking-widest text-slate-700 dark:text-slate-200">Revisão unificada</p>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            {selectedQuestionCount > 0
              ? `${selectedQuestionCount} de ${selectableQuestionCount} item(ns) selecionado(s); ${selectedReadyQuestionCount} pronto(s) para publicação.`
              : selectableQuestionCount > 0
                ? `${selectableQuestionCount} item(ns) disponível(is) para seleção; os incompletos permanecem bloqueados para publicação.`
                : 'Não há itens disponíveis para seleção.'}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={handleToggleAllSelectableQuestions}
            disabled={selectableQuestionCount === 0 || isPublishingSelected}
            className="inline-flex min-h-10 items-center justify-center gap-2 rounded-sm border border-sky-300 bg-white px-4 text-xs font-black uppercase tracking-wide text-sky-800 transition-colors hover:bg-sky-50 disabled:cursor-not-allowed disabled:border-slate-200 disabled:text-slate-400 dark:border-sky-900/50 dark:bg-slate-950 dark:text-sky-200 dark:hover:bg-sky-950/30 dark:disabled:border-slate-800 dark:disabled:text-slate-600"
            title={areAllSelectableQuestionsSelected ? 'Desmarcar todos os itens' : 'Selecionar todos os itens da revisão'}
          >
            {areAllSelectableQuestionsSelected ? <X size={15} /> : <ListChecks size={15} />}
            {areAllSelectableQuestionsSelected ? 'Desmarcar todas' : 'Selecionar todas'}
          </button>
          <button
            type="button"
            onClick={() => void handlePublishSelected()}
            disabled={selectedReadyQuestionCount === 0 || isPublishingSelected}
            className="inline-flex min-h-10 items-center justify-center gap-2 rounded-sm bg-emerald-700 px-4 text-xs font-black uppercase tracking-wide text-white transition-colors hover:bg-emerald-800 disabled:cursor-not-allowed disabled:bg-emerald-700/40 disabled:text-white/80"
            title="Publicar somente as questões selecionadas e completas"
          >
            {isPublishingSelected ? <Loader2 className="animate-spin" size={15} /> : <CheckCircle2 size={15} />}
            Publicar prontas{selectedReadyQuestionCount > 0 ? ` (${selectedReadyQuestionCount})` : ''}
          </button>
        </div>
      </div>
      {payloads.map((payload, payloadIndex) => {
        const payloadKey = getGranPayloadKey(payload);
        const reviewQuestionQueueStatuses = Object.fromEntries(
          payload.questions.map((question, index) => {
            const externalId = String(question.source?.externalId || '').trim();
            const provider = String(question.source?.provider || 'gran').trim() || 'gran';
            const sourceKey = externalId ? `${provider}:question:${externalId}` : String(question.tempId || '');
            return [index, queueStatusByQuestionKey[sourceKey]];
          }).filter(([, status]) => Boolean(status)),
        ) as Record<number, 'queued' | 'processing' | 'published' | 'failed'>;

        return (
          <AdminGranCrawlerReviewBatch
            key={payloadKey}
            payload={payload}
            cardsOnly
            selectedQuestionIndexes={new Set(selectedQuestionIndexesByPayload[payloadKey] || [])}
            reviewQuestionQueueStatuses={reviewQuestionQueueStatuses}
            onPublishQuestion={(index) => void handlePublishQuestion(payloadKey, index)}
            onSelectedQuestionChange={handleSelectedQuestionChange}
            onRegisterBatchPublisher={handleRegisterBatchPublisher}
            onRegisterSelectableQuestionIndexes={handleRegisterSelectableQuestionIndexes}
            reviewQueueIndexOffset={reviewQueueOffsets[payloadIndex] || 0}
            systemSettings={systemSettings}
            onGeminiApiKeyChange={onGeminiApiKeyChange}
            onSaveSettings={onSaveSettings}
            isSavingSettings={isSavingSettings}
            onImportedQuestionsSaved={onImportedQuestionsSaved}
          />
        );
      })}
    </div>
  );
};

interface AdminDatabaseSectionsProps {
  activeSubTab: string;
  adminQuestions: Question[];
  filteredExams: Prova[];
  totalExams: number;
  linkedCountByExamId: Map<string, number>;
  pagination: AdminQuestionsSectionProps['pagination'];
  isLoadingQuestions: boolean;
  questionsError: string;
  filteredUsers: UserProfile[];
  filteredMaterials: Material[];
  groupedReports: AdminReportsSectionProps['reports'];
  rankings: Ranking[];
  blockedMaterials: Material[];
  systemSettings: SystemSettings;
  filterTypes: FiltersManagementSectionProps['filterTypes'];
  activeFilterType: string;
  filterSearch: string;
  importWorkflowProps: Omit<AdminImportSectionProps, 'systemSettings' | 'onGeminiApiKeyChange' | 'onSaveSettings' | 'isSavingSettings'>;
  renderSortableHeader: (label: string, sortKey: string) => React.ReactNode;
  sortData: <T>(data: T[]) => T[];
  filter: string;
  onFilterChange: (value: string) => void;
  onQuestionsPageChange: (page: number) => void;
  onCreateQuestion: () => void;
  onQuestionEdit: AdminQuestionsSectionProps['onEdit'];
  onAddQuestions: AdminQuestionsSectionProps['onAddQuestions'];
  onQuestionUpdate: AdminQuestionsSectionProps['onUpdate'];
  onQuestionDelete: AdminQuestionsSectionProps['onDelete'];
  onQuestionsRefresh?: () => Promise<void> | void;
  deletingExam: AdminExamBankSectionProps['deletingExam'];
  onRequestDeleteExam: AdminExamBankSectionProps['onRequestDelete'];
  onCancelDeleteExam: () => void;
  onConfirmDeleteExam: () => void;
  examActionLoading: 'save' | 'delete' | null;
  hasMoreExams: boolean;
  isLoadingMoreExams: boolean;
  onLoadMoreExams: () => void;
  onOpenUserProfile: (userId: string) => void;
  onDeleteUser: AdminUsersSectionProps['onDeleteUser'];
  onModerateMaterial: AdminMaterialsSectionProps['onModerate'];
  onDeleteMaterial: AdminMaterialsSectionProps['onDelete'];
  onInspectReport: AdminReportsSectionProps['onInspect'];
  onResolveReport: AdminReportsSectionProps['onResolve'];
  onEditRanking: AdminRankingsSectionProps['onEdit'];
  onReanalyzeBlockedMaterial: BlockedMaterialsSectionProps['onReanalyze'];
  onActiveFilterTypeChange: (value: string) => void;
  onFilterSearchChange: (value: string) => void;
  onCreateFilter: () => void;
  onCreateChildFilter: FiltersManagementSectionProps['onAddChild'];
  onEditFilter: FiltersManagementSectionProps['onEdit'];
  onDeleteFilter: FiltersManagementSectionProps['onDelete'];
  onDeleteFiltersInBulk: FiltersManagementSectionProps['onDeleteMany'];
  isDeletingFilters: boolean;
  onGeminiApiKeyChange: (value: string) => void;
  onSaveImportSettings: () => Promise<unknown> | unknown;
  isSavingImportSettings?: boolean;
}

const AdminDatabaseSections = ({
  activeSubTab,
  adminQuestions,
  filteredExams,
  totalExams,
  linkedCountByExamId,
  pagination,
  isLoadingQuestions,
  questionsError,
  filteredUsers,
  filteredMaterials,
  groupedReports,
  rankings,
  blockedMaterials,
  systemSettings,
  filterTypes,
  activeFilterType,
  filterSearch,
  importWorkflowProps,
  renderSortableHeader,
  sortData,
  filter,
  onFilterChange,
  onQuestionsPageChange,
  onCreateQuestion,
  onQuestionEdit,
  onAddQuestions,
  onQuestionUpdate,
  onQuestionDelete,
  onQuestionsRefresh,
  deletingExam,
  onRequestDeleteExam,
  onCancelDeleteExam,
  onConfirmDeleteExam,
  examActionLoading,
  hasMoreExams,
  isLoadingMoreExams,
  onLoadMoreExams,
  onOpenUserProfile,
  onDeleteUser,
  onModerateMaterial,
  onDeleteMaterial,
  onInspectReport,
  onResolveReport,
  onEditRanking,
  onReanalyzeBlockedMaterial,
  onActiveFilterTypeChange,
  onFilterSearchChange,
  onCreateFilter,
  onCreateChildFilter,
  onEditFilter,
  onDeleteFilter,
  onDeleteFiltersInBulk,
  isDeletingFilters,
  onGeminiApiKeyChange,
  onSaveImportSettings,
  isSavingImportSettings,
}: AdminDatabaseSectionsProps) => {
  if (activeSubTab === 'questions') {
    return (
      <AdminQuestionsSection
        questions={sortData(adminQuestions)}
        pagination={pagination}
        isLoading={isLoadingQuestions}
        errorMessage={questionsError}
        filter={filter}
        onFilterChange={onFilterChange}
        renderSortableHeader={renderSortableHeader}
        onCreate={onCreateQuestion}
        onEdit={onQuestionEdit}
        onAddQuestions={onAddQuestions}
        onUpdate={onQuestionUpdate}
        onDelete={onQuestionDelete}
        onPageChange={onQuestionsPageChange}
        onRefresh={onQuestionsRefresh}
        systemSettings={systemSettings}
      />
    );
  }

  if (activeSubTab === 'question-groups') {
    return <AdminQuestionGroupsSection />;
  }

  if (activeSubTab === 'exams') {
    return (
      <AdminExamBankSection
        exams={filteredExams}
        totalExams={totalExams}
        linkedCountByExamId={linkedCountByExamId}
        filter={filter}
        onFilterChange={onFilterChange}
        deletingExam={deletingExam}
        onRequestDelete={onRequestDeleteExam}
        onCancelDelete={onCancelDeleteExam}
        onConfirmDelete={onConfirmDeleteExam}
        actionLoading={examActionLoading}
        hasMore={hasMoreExams}
        isLoadingMore={isLoadingMoreExams}
        onLoadMore={onLoadMoreExams}
      />
    );
  }

  if (activeSubTab === 'users') {
    return (
      <AdminUsersSection
        users={sortData(filteredUsers)}
        filter={filter}
        onFilterChange={onFilterChange}
        renderSortableHeader={renderSortableHeader}
        onOpenProfile={onOpenUserProfile}
        onDeleteUser={onDeleteUser}
      />
    );
  }

  if (activeSubTab === 'materials') {
    return (
      <AdminMaterialsSection
        materials={sortData(filteredMaterials)}
        filter={filter}
        onFilterChange={onFilterChange}
        renderSortableHeader={renderSortableHeader}
        onModerate={onModerateMaterial}
        onDelete={onDeleteMaterial}
      />
    );
  }

  if (activeSubTab === 'reports') {
    return (
      <AdminReportsSection
        reports={sortData(groupedReports)}
        filter={filter}
        onFilterChange={onFilterChange}
        renderSortableHeader={renderSortableHeader}
        getReportTargetBadgeClass={getReportTargetBadgeClass}
        getReportTargetLabel={getReportTargetLabel}
        onInspect={onInspectReport}
        onResolve={onResolveReport}
      />
    );
  }

  if (activeSubTab === 'rankings') {
    return (
      <AdminRankingsSection
        rankings={sortData(rankings)}
        filter={filter}
        onFilterChange={onFilterChange}
        renderSortableHeader={renderSortableHeader}
        onEdit={onEditRanking}
      />
    );
  }

  if (activeSubTab === 'blocked') {
    return (
      <BlockedMaterialsSection
        materials={blockedMaterials}
        onReanalyze={onReanalyzeBlockedMaterial}
      />
    );
  }

  if (activeSubTab === 'filters') {
    return (
      <FiltersManagementSection
        filterTypes={filterTypes}
        activeFilterType={activeFilterType}
        onActiveFilterTypeChange={onActiveFilterTypeChange}
        filterSearch={filterSearch}
        onFilterSearchChange={onFilterSearchChange}
        onCreate={onCreateFilter}
        onAddChild={onCreateChildFilter}
        onEdit={onEditFilter}
        onDelete={onDeleteFilter}
        onDeleteMany={onDeleteFiltersInBulk}
        isDeleting={isDeletingFilters}
      />
    );
  }

  if (activeSubTab === 'lei-comentada') {
    return <AdminLegalCommentarySection filter={filterSearch} />;
  }

  if (activeSubTab === 'import') {
    return (
      <AdminImportSection
        systemSettings={systemSettings}
        onGeminiApiKeyChange={onGeminiApiKeyChange}
        onSaveSettings={onSaveImportSettings}
        isSavingSettings={isSavingImportSettings}
        {...importWorkflowProps}
      />
    );
  }

  if (activeSubTab === 'gran-crawler') {
    return (
      <AdminGranCrawlerSection
        renderReviewQueue={(payloads, queueContext) => (
          <AdminGranCrawlerReviewQueue
            payloads={payloads}
            publicationBatches={queueContext.publicationBatches}
            onPublicationQueued={queueContext.onPublicationQueued}
            systemSettings={systemSettings}
            onGeminiApiKeyChange={onGeminiApiKeyChange}
            onSaveSettings={onSaveImportSettings}
            isSavingSettings={isSavingImportSettings}
            onImportedQuestionsSaved={onQuestionsRefresh}
          />
        )}
      />
    );
  }

  return null;
};

export default AdminDatabaseSections;
