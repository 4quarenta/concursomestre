'use client';

import { useCallback, useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@providers/AuthProvider';
import { useToast } from '@providers/ToastProvider';
import {
  buildUserProgressQueryKey,
  fetchUserProgressBundle,
  type UserProgressBundle,
  type UserProgressFetchScope,
} from './userProgressQuery';
import { useUserProgressStore } from './userProgressStore';
import { clientLog } from '@services/monitoring/clientLog';
import { userProgressService } from '@services/progress';

/**
 * User-progress actions backed by Zustand + TanStack Query.
 * Fonte oficial das mutacoes de progresso usadas por paginas de estudo/perfil.
 *
 * @since 1.0.0
 */
export const useUserProgressActions = () => {
  const queryClient = useQueryClient();
  const { currentUser, isLoading: authIsLoading } = useAuth();
  const { addToast } = useToast();
  const currentUserId = currentUser?.id ?? null;
  const currentAccountId = currentUserId || 'guest';
  const activeDataOwnerRef = useRef(currentAccountId);

  useEffect(() => {
    activeDataOwnerRef.current = currentAccountId;
  }, [currentAccountId]);

  const userAnswers = useUserProgressStore((store) => store.userAnswers);
  const userComments = useUserProgressStore((store) => store.userComments);
  const userNotes = useUserProgressStore((store) => store.userNotes);
  const isUserProgressLoaded = useUserProgressStore((store) => store.isUserProgressLoaded);
  const loadedUserId = useUserProgressStore((store) => store.loadedUserId);
  const loadedSlices = useUserProgressStore((store) => store.loadedSlices);
  const replaceUserProgress = useUserProgressStore((store) => store.replaceUserProgress);
  const saveUserQuestionNote = useUserProgressStore((store) => store.saveUserQuestionNote);
  const setUserNotes = useUserProgressStore((store) => store.setUserNotes);

  const resolveProgressScope = useCallback((scope?: UserProgressFetchScope) => ({
    includeAnswers: scope?.includeAnswers !== false,
    includeComments: scope?.includeComments !== false,
    includeNotes: scope?.includeNotes !== false,
  }), []);

  const hasLoadedRequestedSlices = useCallback((scope?: UserProgressFetchScope) => {
    const requested = resolveProgressScope(scope);

    return (
      (!requested.includeAnswers || loadedSlices.answers)
      && (!requested.includeComments || loadedSlices.comments)
      && (!requested.includeNotes || loadedSlices.notes)
    );
  }, [loadedSlices.answers, loadedSlices.comments, loadedSlices.notes, resolveProgressScope]);

  const patchUserProgressCache = useCallback((
    userId: string,
    updater: (current: UserProgressBundle) => UserProgressBundle,
  ) => {
    queryClient.setQueriesData({ queryKey: ['user-progress', userId] }, (current?: UserProgressBundle) => {
      const fallback: UserProgressBundle = {
        answers: [],
        comments: [],
        notes: [],
      };
      return updater(current || fallback);
    });
  }, [queryClient]);

  const ensureUserProgressLoaded = useCallback(async (
    force = false,
    scope?: UserProgressFetchScope,
  ) => {
    if (authIsLoading) {
      return;
    }

    const userId = currentUserId;
    if (!userId) return;
    if (
      isUserProgressLoaded
      && loadedUserId === userId
      && hasLoadedRequestedSlices(scope)
      && !force
    ) {
      return;
    }

    const requestedScope = resolveProgressScope(scope);

    try {
      const progressBundle = await queryClient.fetchQuery({
        queryKey: buildUserProgressQueryKey(userId, requestedScope),
        queryFn: () => fetchUserProgressBundle(userId, requestedScope),
        staleTime: force ? 0 : 60_000,
      });

      if (activeDataOwnerRef.current !== userId) {
        return;
      }

      replaceUserProgress(userId, progressBundle, {
        answers: requestedScope.includeAnswers,
        comments: requestedScope.includeComments,
        notes: requestedScope.includeNotes,
      });
    } catch (error) {
      clientLog.warn('Failed to load user progress:', error);
    }
  }, [
    authIsLoading,
    currentUserId,
    hasLoadedRequestedSlices,
    isUserProgressLoaded,
    loadedUserId,
    queryClient,
    replaceUserProgress,
    resolveProgressScope,
  ]);

  const saveNote = useCallback(async (questionId: number, text: string) => {
    if (!currentUserId) {
      addToast('Entre na sua conta para salvar uma nota.', 'warning');
      return;
    }

    if (!Number.isFinite(questionId) || questionId <= 0) {
      addToast('Nao foi possivel identificar a questao da anotacao.', 'error');
      return;
    }

    const previousNotes = useUserProgressStore.getState().userNotes;
    saveUserQuestionNote(questionId, text);
    const optimisticNotes = useUserProgressStore.getState().userNotes;
    patchUserProgressCache(currentUserId, (current) => ({ ...current, notes: optimisticNotes }));

    try {
      const persistedNote = await userProgressService.saveUserQuestionNote(questionId, text);
      const authoritativeNotes = persistedNote
        ? [...optimisticNotes.filter((note) => Number(note.questionId) !== questionId), persistedNote]
        : optimisticNotes.filter((note) => Number(note.questionId) !== questionId);
      setUserNotes(currentUserId, authoritativeNotes);
      patchUserProgressCache(currentUserId, (current) => ({ ...current, notes: authoritativeNotes }));
      addToast(persistedNote ? 'Nota salva!' : 'Nota removida.', 'success');
    } catch (error) {
      setUserNotes(currentUserId, previousNotes);
      patchUserProgressCache(currentUserId, (current) => ({ ...current, notes: previousNotes }));
      clientLog.warn('Failed to save user question note:', error);
      addToast('Nao foi possivel salvar a nota. Tente novamente.', 'error');
    }
  }, [addToast, currentUserId, patchUserProgressCache, saveUserQuestionNote, setUserNotes]);

  return {
    userAnswers,
    userComments,
    userNotes,
    isUserProgressLoaded,
    ensureUserProgressLoaded,
    saveNote,
  };
};

export default useUserProgressActions;
