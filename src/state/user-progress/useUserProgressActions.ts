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

/**
 * User-progress actions backed by Zustand + TanStack Query.
 * Replaces DataProvider dependency for progress-centric pages.
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
      console.error('Failed to load user progress:', error);
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

  const saveNote = useCallback((questionId: number, text: string) => {
    saveUserQuestionNote(questionId, text);

    if (currentUserId) {
      const updatedNotes = useUserProgressStore.getState().userNotes;
      patchUserProgressCache(currentUserId, (current) => ({
        ...current,
        notes: updatedNotes,
      }));
    }

    addToast('Nota salva!', 'success');
  }, [addToast, currentUserId, patchUserProgressCache, saveUserQuestionNote]);

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
