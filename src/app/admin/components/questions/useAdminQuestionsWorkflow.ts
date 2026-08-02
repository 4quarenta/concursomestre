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

import { useCallback, useEffect, useRef, useState } from 'react';
import type { Question } from '@types';
import { adminService } from '@services/admin/adminService';
import { readApiErrorMessage } from '@services/api';
import { clientLog } from '@services/monitoring/clientLog';

type ToastHandler = (message: string, type?: string) => void;

interface QuestionsPagination {
  total: number;
  perPage: number;
  pages: number;
  page: number;
}

interface UseAdminQuestionsWorkflowOptions {
  keyword: string;
  activeSubTab: string;
  addToast: ToastHandler;
}

type AdminQuestionPublicationCandidate = Question & {
  publishState?: string;
  publicationStatus?: string;
  status?: string;
  estadoEditorial?: string;
  scheduledAt?: string;
  scheduled_at?: string;
  publishAt?: string;
  publish_at?: string;
  publicationDate?: string;
  publication_date?: string;
  publishedAt?: string;
  published_at?: string;
  published_on?: string;
  data_publicacao?: string;
  publicado_em?: string;
  dataPublicacao?: string;
  timestamp?: string | number;
  createdAt?: string;
  created_at?: string;
  created?: string;
  data_criacao?: string;
  criado_em?: string;
};

type AdminQuestionWithPublicationMeta = Question & {
  adminPublicationDate: string;
  adminPublicationTimestamp: number;
};

const DEFAULT_PAGINATION: QuestionsPagination = {
  total: 0,
  perPage: 20,
  pages: 1,
  page: 1,
};

const resolveQuestionPublicationInput = (question: AdminQuestionPublicationCandidate | null | undefined) => {
  if (!question) return '';

  const editorialState = String(
    question.publishState
      || question.publicationStatus
      || question.status
      || question.estadoEditorial
      || '',
  ).toLowerCase();

  if (editorialState.includes('scheduled') || editorialState.includes('program')) {
    return question.scheduledAt
      || question.scheduled_at
      || question.publishAt
      || question.publish_at
      || question.publicationDate
      || question.publication_date
      || '';
  }

  return question.publishedAt
    || question.published_at
    || question.published_on
    || question.publicationDate
    || question.publication_date
    || question.data_publicacao
    || question.publicado_em
    || question.dataPublicacao
    || question.timestamp
    || question.createdAt
    || question.created_at
    || question.created
    || question.data_criacao
    || question.criado_em
    || '';
};

const parsePublicationTimestamp = (value: unknown) => {
  if (!value) return 0;
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0;

  const rawValue = String(value).trim();
  if (!rawValue) return 0;

  const numericValue = Number(rawValue);
  if (Number.isFinite(numericValue) && rawValue.length >= 10) {
    return numericValue < 100000000000 ? numericValue * 1000 : numericValue;
  }

  const parsed = new Date(rawValue.includes('T') ? rawValue : rawValue.replace(' ', 'T')).getTime();
  return Number.isNaN(parsed) ? 0 : parsed;
};

const withAdminPublicationMetadata = (
  question: AdminQuestionPublicationCandidate,
): AdminQuestionWithPublicationMeta => {
  const publicationInput = resolveQuestionPublicationInput(question);
  const publicationTimestamp = parsePublicationTimestamp(publicationInput);

  return {
    ...question,
    adminPublicationDate: publicationInput || '',
    adminPublicationTimestamp: publicationTimestamp,
  };
};

const sortQuestionsByPublicationDesc = (questions: Question[]) => [...questions]
  .map((question) => withAdminPublicationMetadata(question as AdminQuestionPublicationCandidate))
  .sort((a, b) => Number(b.adminPublicationTimestamp || 0) - Number(a.adminPublicationTimestamp || 0));

export const useAdminQuestionsWorkflow = ({
  keyword,
  activeSubTab,
  addToast,
}: UseAdminQuestionsWorkflowOptions) => {
  const [adminQuestions, setAdminQuestions] = useState<Question[]>([]);
  const [pagination, setPagination] = useState<QuestionsPagination>(DEFAULT_PAGINATION);
  const [isLoadingQuestions, setIsLoadingQuestions] = useState(false);
  const [questionsError, setQuestionsError] = useState('');
  const requestSequence = useRef(0);

  const loadQuestions = useCallback(async (page = 1) => {
    const requestId = requestSequence.current + 1;
    requestSequence.current = requestId;
    setIsLoadingQuestions(true);
    setQuestionsError('');

    try {
      const response = await adminService.getQuestions({
        page,
        keyword,
      });

      if (requestId !== requestSequence.current) {
        return;
      }

      setAdminQuestions(sortQuestionsByPublicationDesc(response.rows || []));
      setPagination({
        total: response.total,
        perPage: response.perPage,
        pages: response.pages,
        page: response.page,
      });
    } catch (error) {
      if (requestId !== requestSequence.current) {
        return;
      }
      clientLog.warn('Error loading questions:', error);
      const message = readApiErrorMessage(error, 'Erro ao carregar questões administrativas.');
      setQuestionsError(message);
      addToast(message, 'error');
    } finally {
      if (requestId === requestSequence.current) {
        setIsLoadingQuestions(false);
      }
    }
  }, [addToast, keyword]);

  const reloadCurrentPage = async () => {
    await loadQuestions(pagination.page || 1);
  };

  const removeQuestionFromPage = (questionId: string | number) => {
    setAdminQuestions((current) => current.filter((question) => String(question.id) !== String(questionId)));
    setPagination((current) => {
      const nextTotal = Math.max(0, Number(current.total || 0) - 1);
      const nextPages = Math.max(1, Math.ceil(nextTotal / Math.max(1, Number(current.perPage || 20))));

      return {
        ...current,
        total: nextTotal,
        pages: nextPages,
        page: Math.min(current.page, nextPages),
      };
    });
  };

  useEffect(() => {
    if (activeSubTab !== 'questions') {
      return undefined;
    }

    const frameId = window.requestAnimationFrame(() => {
      void loadQuestions(1);
    });

    return () => {
      window.cancelAnimationFrame(frameId);
      requestSequence.current += 1;
    };
  }, [activeSubTab, loadQuestions]);

  return {
    adminQuestions,
    pagination,
    isLoadingQuestions,
    questionsError,
    loadQuestions,
    reloadCurrentPage,
    removeQuestionFromPage,
  };
};
