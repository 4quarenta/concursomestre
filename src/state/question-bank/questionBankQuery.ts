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

const PAGINATION_QUERY_KEYS = new Set([
  'cursor',
  'limit',
  'page',
  'content_scope',
  'contentScope',
]);

/**
 * Identifies the server-side filter set that produced a question-bank page.
 * Pagination is intentionally excluded so subsequent pages can be appended to
 * the same filtered result without making the practice screen re-filter rows
 * with potentially stale client-side taxonomy shapes.
 */
export const buildQuestionBankFilterSignature = (
  params: QuestionBankPageParams = {},
): string => JSON.stringify(
  Object.entries(params)
    .filter(([key, value]) => (
      !PAGINATION_QUERY_KEYS.has(key)
      && value !== undefined
      && value !== null
      && value !== ''
    ))
    .sort(([left], [right]) => left.localeCompare(right)),
);

export const canAdvanceQuestionBankCursor = ({
  requestedCursor,
  nextCursor,
  hasMore,
  uniqueLoadedCount,
}: {
  requestedCursor: string;
  nextCursor: string | null;
  hasMore: boolean;
  uniqueLoadedCount: number;
}): boolean => Boolean(
  hasMore
  && uniqueLoadedCount > 0
  && nextCursor
  && nextCursor !== requestedCursor
);

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
    ...params,
    // This store feeds full question cards. Never allow a caller override to
    // downgrade the response to the lightweight catalogue DTO.
    content_scope: 'practice',
  });
  return {
    rows: Array.isArray(result.rows) ? result.rows : [],
    total: Number(result.total || 0),
    pageInfo: result.pageInfo,
  };
};

export default fetchQuestionBankPage;
