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

import { useMemo, useState } from 'react';
import type { Prova, Question, SystemSettings } from '@types';
import {
  applyProvaToQuestion,
  buildProvaSearchText,
  formatProvaLabel,
  isQuestionLinkedToProva,
  mergeExamBankSources,
  normalizeProvaRecord,
  removeProvaFromQuestion,
} from './examBankUtils';

type ToastHandler = (message: string, type?: string) => void;

export interface ExamDraftState {
  id: string;
  nome: string;
  ano: string;
  nivel: string;
  index: string;
  publishStatus: 'published' | 'draft' | 'scheduled';
  visibilityStatus: 'public' | 'elite' | 'internal';
  scheduledAt: string;
  bancaId: string;
  bancaSigla: string;
  bancaNome: string;
  orgaoId: string;
  orgaoSigla: string;
  orgaoNome: string;
  cargoDescricao: string;
}

interface UseAdminExamBankWorkflowOptions {
  questions: Question[];
  systemSettings: SystemSettings;
  updateSystemSettings: (settings: SystemSettings) => Promise<any> | any;
  saveSystemSettingsNow: (settings?: SystemSettings) => Promise<any> | any;
  onUpdateQuestion: (question: Question) => Promise<any> | any;
  filter: string;
  addToast: ToastHandler;
}

export const createDraftFromProva = (prova: Prova): ExamDraftState => ({
  id: String(prova.id),
  nome: prova.nome || '',
  ano: String(prova.ano || ''),
  nivel: prova.nivel || '',
  index: prova.index || '',
  publishStatus: prova.publishStatus || 'published',
  visibilityStatus: prova.visibilityStatus || 'public',
  scheduledAt: prova.scheduledAt || '',
  bancaId: String((prova.banca as any)?.id || ''),
  bancaSigla: prova.banca?.sigla || '',
  bancaNome: prova.banca?.nome || prova.banca?.name || '',
  orgaoId: String((prova.orgao as any)?.id || ''),
  orgaoSigla: prova.orgao?.sigla || '',
  orgaoNome: prova.orgao?.nome || prova.orgao?.name || '',
  cargoDescricao: prova.cargo?.descricao || prova.cargo?.['descrição'] || '',
});

export const createEmptyExamDraft = (): ExamDraftState => ({
  id: '',
  nome: '',
  ano: '',
  nivel: '',
  index: '',
  publishStatus: 'published',
  visibilityStatus: 'public',
  scheduledAt: '',
  bancaId: '',
  bancaSigla: '',
  bancaNome: '',
  orgaoId: '',
  orgaoSigla: '',
  orgaoNome: '',
  cargoDescricao: '',
});

/**
 * Orquestra o banco de provas do admin.
 * A prova e persistida em settings e sincronizada nas questoes vinculadas.
 *
 * @since 1.0.0
 */
export const useAdminExamBankWorkflow = ({
  questions,
  systemSettings,
  updateSystemSettings,
  saveSystemSettingsNow,
  onUpdateQuestion,
  filter,
  addToast,
}: UseAdminExamBankWorkflowOptions) => {
  const [editingExamId, setEditingExamId] = useState<string | null>(null);
  const [examDraft, setExamDraft] = useState<ExamDraftState | null>(null);
  const [deletingExam, setDeletingExam] = useState<Prova | null>(null);
  const [actionLoading, setActionLoading] = useState<'save' | 'delete' | null>(null);

  const examBank = useMemo(
    () => mergeExamBankSources(systemSettings, questions),
    [questions, systemSettings],
  );

  const filteredExamBank = useMemo(() => {
    const normalizedFilter = String(filter || '').trim().toLowerCase();
    if (!normalizedFilter) {
      return examBank;
    }

    return examBank.filter((exam) => buildProvaSearchText(exam).includes(normalizedFilter));
  }, [examBank, filter]);

  const syncLinkedQuestions = async (prova: Prova | null, previousId: string, mode: 'save' | 'delete') => {
    const linkedQuestions = questions.filter((question) => isQuestionLinkedToProva(question, previousId));
    const failures: Array<string | number> = [];

    for (const question of linkedQuestions) {
      const nextQuestion = mode === 'delete'
        ? removeProvaFromQuestion(question, previousId)
        : applyProvaToQuestion(question, prova as Prova);

      const result = await onUpdateQuestion(nextQuestion);
      if (!result?.success) {
        failures.push(question.id || previousId);
      }
    }

    return failures;
  };

  const startEditingExam = (exam: Prova) => {
    setEditingExamId(String(exam.id));
    setExamDraft(createDraftFromProva(exam));
  };

  const startCreatingExam = () => {
    setEditingExamId('new');
    setExamDraft(createEmptyExamDraft());
  };

  const cancelEditingExam = () => {
    setEditingExamId(null);
    setExamDraft(null);
  };

  const requestDeleteExam = (exam: Prova) => {
    setDeletingExam(exam);
  };

  const cancelDeleteExam = () => {
    setDeletingExam(null);
  };

  const handleSaveExam = async () => {
    if (!examDraft) {
      return;
    }

    const nextExam = normalizeProvaRecord({
      id: examDraft.id,
      nome: examDraft.nome,
      ano: examDraft.ano,
      nivel: examDraft.nivel,
      index: examDraft.index,
      banca: {
        id: examDraft.bancaId || undefined,
        sigla: examDraft.bancaSigla || examDraft.bancaNome,
        nome: examDraft.bancaNome || examDraft.bancaSigla,
      },
      orgao: {
        id: examDraft.orgaoId || undefined,
        sigla: examDraft.orgaoSigla || examDraft.orgaoNome,
        nome: examDraft.orgaoNome || examDraft.orgaoSigla,
      },
      cargo: {
        descricao: examDraft.cargoDescricao,
        ['descrição']: examDraft.cargoDescricao,
      },
      publishStatus: examDraft.publishStatus,
      visibilityStatus: examDraft.visibilityStatus,
      scheduledAt: examDraft.scheduledAt,
    });

    if (!nextExam) {
      addToast('Preencha pelo menos ID e nome da prova.', 'error');
      return;
    }

    setActionLoading('save');
    try {
      const hasExistingExam = examBank.some((exam) => String(exam.id) === String(nextExam.id));
      const nextExamBank = hasExistingExam
        ? examBank.map((exam) => (String(exam.id) === String(nextExam.id) ? nextExam : exam))
        : [nextExam, ...examBank];

      const failedQuestions = await syncLinkedQuestions(nextExam, String(nextExam.id), 'save');

      const nextSettings: SystemSettings = {
        ...systemSettings,
        examBank: nextExamBank,
      };

      updateSystemSettings(nextSettings);
      await saveSystemSettingsNow(nextSettings);

      if (failedQuestions.length > 0) {
        addToast(`Banco de provas salvo, mas ${failedQuestions.length} questoes nao sincronizaram.`, 'error');
      } else {
        addToast(
          hasExistingExam
            ? `Prova "${formatProvaLabel(nextExam)}" atualizada com sucesso.`
            : `Prova "${formatProvaLabel(nextExam)}" criada com sucesso.`,
          'success',
        );
      }

      cancelEditingExam();
    } catch (error) {
      console.error('Error saving exam bank record:', error);
      addToast('Nao foi possivel salvar a prova.', 'error');
    } finally {
      setActionLoading(null);
    }
  };

  const handleDeleteExam = async () => {
    if (!deletingExam) {
      return;
    }

    setActionLoading('delete');
    try {
      const failedQuestions = await syncLinkedQuestions(null, String(deletingExam.id), 'delete');

      const nextSettings: SystemSettings = {
        ...systemSettings,
        examBank: examBank.filter((exam) => String(exam.id) !== String(deletingExam.id)),
      };

      updateSystemSettings(nextSettings);
      await saveSystemSettingsNow(nextSettings);

      if (failedQuestions.length > 0) {
        addToast(`Prova removida do banco, mas ${failedQuestions.length} questoes nao sincronizaram.`, 'error');
      } else {
        addToast('Prova removida com sucesso.', 'success');
      }

      cancelDeleteExam();
      cancelEditingExam();
    } catch (error) {
      console.error('Error deleting exam bank record:', error);
      addToast('Nao foi possivel remover a prova.', 'error');
    } finally {
      setActionLoading(null);
    }
  };

  const linkedCountByExamId = useMemo(() => {
    const countMap = new Map<string, number>();

    questions.forEach((question) => {
      examBank.forEach((exam) => {
        if (isQuestionLinkedToProva(question, exam.id)) {
          countMap.set(String(exam.id), (countMap.get(String(exam.id)) || 0) + 1);
        }
      });
    });

    return countMap;
  }, [examBank, questions]);

  return {
    examBank,
    filteredExamBank,
    linkedCountByExamId,
    editingExamId,
    examDraft,
    setExamDraft,
    startEditingExam,
    startCreatingExam,
    cancelEditingExam,
    handleSaveExam,
    deletingExam,
    requestDeleteExam,
    cancelDeleteExam,
    handleDeleteExam,
    actionLoading,
  };
};
