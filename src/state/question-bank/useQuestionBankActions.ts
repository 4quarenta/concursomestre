'use client';

import { useCallback, useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@providers/AuthProvider';
import type { Question } from '@types';
import {
  buildQuestionBankQueryKey,
  buildQuestionBankFilterSignature,
  canAdvanceQuestionBankCursor,
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
  const loadedQuestionBankFilterSignature = useQuestionBankStore((store) => store.loadedFilterSignature);
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
    const filterSignature = buildQuestionBankFilterSignature(params);

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
        filterSignature,
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

  const fetchMoreQuestions = useCallback(async (_page: number, paramsOverride: QuestionBankPageParams = {}): Promise<number> => {
    if (authIsLoading || !hasMoreQuestions) {
      return 0;
    }

    if (!nextQuestionCursor) {
      appendQuestions(currentDataOwnerKey, [], undefined, false, null, buildQuestionBankFilterSignature(paramsOverride));
      return 0;
    }

    const requestedCursor = nextQuestionCursor;
    const params: QuestionBankPageParams = {
      ...paramsOverride,
      cursor: requestedCursor,
      limit: Number(paramsOverride.limit || 20),
    };
    const filterSignature = buildQuestionBankFilterSignature(params);

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
      const existingQuestionIds = new Set(questions.map((question) => String(question.id ?? '')));
      const uniqueLoadedCount = sanitized.filter((question) => {
        const questionId = String(question.id ?? '');
        return questionId !== '' && !existingQuestionIds.has(questionId);
      }).length;
      const responseCursor = result.pageInfo?.nextCursor || null;
      const canContinue = canAdvanceQuestionBankCursor({
        requestedCursor,
        nextCursor: responseCursor,
        hasMore: Boolean(result.pageInfo?.hasMore),
        uniqueLoadedCount,
      });
      appendQuestions(
        currentDataOwnerKey,
        sanitized,
        result.total,
        canContinue,
        responseCursor,
        filterSignature,
      );
      return uniqueLoadedCount;
    } catch (error) {
      clientLog.warn('Failed to fetch more questions:', error);
      throw error;
    }
  }, [
    appendQuestions,
    authIsLoading,
    currentAccountId,
    currentDataOwnerKey,
    hasMoreQuestions,
    nextQuestionCursor,
    queryClient,
    questions,
  ]);

  return {
    questions,
    totalQuestions,
    hasMoreQuestions,
    isQuestionsLoaded,
    loadedQuestionBankFilterSignature,
    ensureQuestionsLoaded,
    fetchMoreQuestions,
  };
};

export default useQuestionBankActions;
