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

import { useEffect, useState } from 'react';
import type { Question } from '@types';
import { adminService } from '@services/admin/adminService';
import { readApiErrorMessage } from '@services/api';

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

const DEFAULT_PAGINATION: QuestionsPagination = {
  total: 0,
  perPage: 20,
  pages: 1,
  page: 1,
};

const resolveQuestionPublicationInput = (question: any) => {
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

const withAdminPublicationMetadata = (question: Question) => {
  const publicationInput = resolveQuestionPublicationInput(question as any);
  const publicationTimestamp = parsePublicationTimestamp(publicationInput);

  return {
    ...(question as any),
    adminPublicationDate: publicationInput || '',
    adminPublicationTimestamp: publicationTimestamp,
  } as Question;
};

const sortQuestionsByPublicationDesc = (questions: Question[]) => [...questions]
  .map(withAdminPublicationMetadata)
  .sort((a: any, b: any) => (
    Number(b.adminPublicationTimestamp || 0) - Number(a.adminPublicationTimestamp || 0)
  ));

export const useAdminQuestionsWorkflow = ({
  keyword,
  activeSubTab,
  addToast,
}: UseAdminQuestionsWorkflowOptions) => {
  const [adminQuestions, setAdminQuestions] = useState<Question[]>([]);
  const [pagination, setPagination] = useState<QuestionsPagination>(DEFAULT_PAGINATION);

  const loadQuestions = async (page = 1) => {
    try {
      const response = await adminService.getQuestions({
        page,
        keyword,
      });

      setAdminQuestions(sortQuestionsByPublicationDesc(response.rows || []));
      setPagination({
        total: response.total,
        perPage: response.perPage,
        pages: response.pages,
        page: response.page,
      });
    } catch (error) {
      console.error('Error loading questions:', error);
      addToast(readApiErrorMessage(error, 'Erro ao carregar questões administrativas.'), 'error');
    }
  };

  const reloadCurrentPage = async () => {
    await loadQuestions(pagination.page || 1);
  };

  const removeQuestionFromPage = (questionId: string | number) => {
    setAdminQuestions((current) => current.filter((question: any) => String(question.id) !== String(questionId)));
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
    if (activeSubTab === 'questions') {
      void loadQuestions(1);
    }
  }, [activeSubTab, keyword]);

  return {
    adminQuestions,
    pagination,
    loadQuestions,
    reloadCurrentPage,
    removeQuestionFromPage,
  };
};
