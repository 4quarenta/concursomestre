import { questionService } from '@services/questions';
import type { Question } from '@types';

export interface QuestionBankPageParams {
  [key: string]: string | number | boolean | undefined | null;
  user_id?: string;
  page?: number;
  cursor?: string;
  limit?: number;
  publication_scope?: string;
  publish_status?: string;
  content_scope?: 'list' | 'practice';
  includeUnpublished?: boolean;
  includeDrafts?: boolean;
  admin?: boolean;
}

export interface QuestionBankPageResult {
  rows: Question[];
  total: number;
  pageInfo?: {
    limit: number;
    hasMore: boolean;
    nextCursor: string | null;
  };
}

export const buildQuestionBankQueryKey = (
  ownerKey: string,
  params: QuestionBankPageParams = {},
) => (
  ['question-bank', ownerKey, params] as const
);

export const fetchQuestionBankPage = async (
  params: QuestionBankPageParams = {},
): Promise<QuestionBankPageResult> => {
  const result = await questionService.getQuestionPage({
    content_scope: 'practice',
    ...params,
  });
  return {
    rows: Array.isArray(result.rows) ? result.rows : [],
    total: Number(result.total || 0),
    pageInfo: result.pageInfo,
  };
};

export default fetchQuestionBankPage;
