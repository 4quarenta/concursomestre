'use client';

import { useCallback, useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@providers/AuthProvider';
import type { Question } from '@types';
import {
  buildQuestionBankQueryKey,
  fetchQuestionBankPage,
  type QuestionBankPageParams,
} from './questionBankQuery';
import { useQuestionBankStore } from './questionBankStore';
import { clientLog } from '@services/monitoring/clientLog';

/**
 * Question-bank actions backed by Zustand + TanStack Query.
 * Centraliza carga e cache do banco de questoes para paginas que precisam desse dominio.
 *
 * @since 1.0.0
 */
export const useQuestionBankActions = () => {
  const queryClient = useQueryClient();
  const { currentUser, isLoading: authIsLoading } = useAuth();
  const currentUserId = currentUser?.id ?? null;
  const currentRole = currentUser?.role ?? 'guest';
  const currentAccountId = currentUserId || 'guest';
  const currentDataOwnerKey = `${currentAccountId}:${currentRole}`;

  const activeDataOwnerRef = useRef(currentAccountId);
  useEffect(() => {
    activeDataOwnerRef.current = currentAccountId;
  }, [currentAccountId]);

  const questions = useQuestionBankStore((store) => store.questions);
  const totalQuestions = useQuestionBankStore((store) => store.totalQuestions);
  const hasMoreQuestions = useQuestionBankStore((store) => store.hasMoreQuestions);
  const nextQuestionCursor = useQuestionBankStore((store) => store.nextQuestionCursor);
  const isQuestionsLoaded = useQuestionBankStore((store) => store.isQuestionsLoaded);
  const loadedQuestionBankOwnerKey = useQuestionBankStore((store) => store.loadedOwnerKey);
  const replaceQuestionBank = useQuestionBankStore((store) => store.replaceQuestionBank);
  const appendQuestions = useQuestionBankStore((store) => store.appendQuestions);

  const ensureQuestionsLoaded = useCallback(async (
    force = false,
    paramsOverride: QuestionBankPageParams = {},
  ) => {
    if (authIsLoading) {
      return;
    }

    const hasOverride = Object.keys(paramsOverride).length > 0;
    if (
      !force
      && !hasOverride
      && isQuestionsLoaded
      && loadedQuestionBankOwnerKey === currentDataOwnerKey
      && questions.length > 0
    ) {
      return;
    }

    const params: QuestionBankPageParams = { ...paramsOverride };

    try {
      const result = await queryClient.fetchQuery({
        queryKey: buildQuestionBankQueryKey(currentDataOwnerKey, params),
        queryFn: () => fetchQuestionBankPage(params),
        staleTime: force ? 0 : 60_000,
      });

      if (activeDataOwnerRef.current !== currentAccountId) {
        return;
      }

      const sanitized = Array.isArray(result.rows)
        ? result.rows.map((question) => ({ ...question, comments: null as Question['comments'] }))
        : [];

      replaceQuestionBank(currentDataOwnerKey, {
        questions: sanitized,
        totalQuestions: result.total || sanitized.length,
        hasMoreQuestions: result.pageInfo?.hasMore,
        nextQuestionCursor: result.pageInfo?.nextCursor,
      });
    } catch (error) {
      clientLog.warn('Failed to load initial questions:', error);
    }
  }, [
    authIsLoading,
    currentAccountId,
    currentDataOwnerKey,
    isQuestionsLoaded,
    loadedQuestionBankOwnerKey,
    queryClient,
    questions.length,
    replaceQuestionBank,
  ]);

  const fetchMoreQuestions = useCallback(async (_page: number, paramsOverride: QuestionBankPageParams = {}) => {
    if (authIsLoading || !hasMoreQuestions || !nextQuestionCursor) {
      return;
    }

    const params: QuestionBankPageParams = {
      cursor: nextQuestionCursor,
      limit: 50,
      ...paramsOverride,
    };

    try {
      const result = await queryClient.fetchQuery({
        queryKey: buildQuestionBankQueryKey(currentDataOwnerKey, params),
        queryFn: () => fetchQuestionBankPage(params),
        staleTime: 60_000,
      });

      if (activeDataOwnerRef.current !== currentAccountId) {
        return;
      }

      const questionRows = Array.isArray(result.rows) ? result.rows : [];
      const sanitized = questionRows.map((question) => ({ ...question, comments: null as Question['comments'] }));
      appendQuestions(
        currentDataOwnerKey,
        sanitized,
        undefined,
        result.pageInfo?.hasMore,
        result.pageInfo?.nextCursor,
      );
    } catch (error) {
      clientLog.warn('Failed to fetch more questions:', error);
    }
  }, [
    appendQuestions,
    authIsLoading,
    currentAccountId,
    currentDataOwnerKey,
    hasMoreQuestions,
    nextQuestionCursor,
    queryClient,
  ]);

  return {
    questions,
    totalQuestions,
    hasMoreQuestions,
    isQuestionsLoaded,
    ensureQuestionsLoaded,
    fetchMoreQuestions,
  };
};

export default useQuestionBankActions;
