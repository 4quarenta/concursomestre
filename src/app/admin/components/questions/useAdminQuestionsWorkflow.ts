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

      setAdminQuestions(response.rows);
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
  };
};
