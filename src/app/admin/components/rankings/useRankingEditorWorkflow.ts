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
import { readApiErrorMessage } from '@services/api';

type ToastHandler = (message: string, type?: string) => void;

interface UseRankingEditorWorkflowOptions {
  addToast: ToastHandler;
  updateRanking: (ranking: any) => Promise<void> | void;
}

export const useRankingEditorWorkflow = ({
  addToast,
  updateRanking,
}: UseRankingEditorWorkflowOptions) => {
  const [editingRanking, setEditingRanking] = useState<any | null>(null);

  const openRankingEditor = (ranking: any) => {
    setEditingRanking(ranking);
  };

  const closeRankingEditor = () => {
    setEditingRanking(null);
  };

  const handleSaveRanking = async () => {
    if (!editingRanking) return;

    try {
      await updateRanking(editingRanking);
      closeRankingEditor();
      addToast('Ranking atualizado com sucesso!', 'success');
    } catch (error) {
      console.error(error);
      addToast(readApiErrorMessage(error, 'Erro ao salvar ranking'), 'error');
    }
  };

  return {
    editingRanking,
    setEditingRanking,
    openRankingEditor,
    closeRankingEditor,
    handleSaveRanking,
  };
};

