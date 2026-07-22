import { ENDPOINTS } from '@services/api/endpoints';
import { resolveAbsoluteApiBaseUrl } from '@services/api/baseUrl';
import {
  mapV2DetailToQuestion,
  mapV2ListItemToQuestion,
  type QuestionV2Detail,
  type QuestionV2ListItem,
  type QuestionV2PageResponse,
} from '@services/questions/questionService';
import { isQuestionPubliclyVisible } from '@services/questions/questionPublication';
import type { PracticeInitialQuestionPage } from './practiceTypes';

type PracticeSearchParams = Record<string, string | string[] | undefined>;
type FetchLike = typeof fetch;

const EMPTY_INITIAL_PAGE: PracticeInitialQuestionPage = {
  questions: [],
  total: 0,
  pageInfo: {
    limit: 10,
    hasMore: false,
    nextCursor: null,
  },
};

const PUBLIC_PRACTICE_QUERY_KEYS = [
  'keyword',
  'subject',
  'materia',
  'difficulty',
  'agency',
  'organization',
  'year',
  'level',
  'topic',
  'assunto',
  'role',
  'career',
  'modality',
  'questionIds',
  'question_ids',
  'ids',
  'hasTeacherComment',
  'hasDetailedComment',
  'excludeCanceled',
  'excludeOutdated',
] as const;

const readEnv = (key: string): string => {
  const value = process.env[key];
  return typeof value === 'string' ? value.trim() : '';
};

const getApiBaseUrl = (): string => resolveAbsoluteApiBaseUrl(
  readEnv('NEXT_PUBLIC_API_BASE_URL') || readEnv('API_BASE_URL') || undefined,
);

const unwrapApiData = (payload: unknown): unknown => {
  if (!payload || typeof payload !== 'object') return payload;
  const record = payload as Record<string, unknown>;
  return Object.prototype.hasOwnProperty.call(record, 'data') ? record.data : payload;
};

const isV2Detail = (item: QuestionV2Detail | QuestionV2ListItem): item is QuestionV2Detail => (
  'content' in item || Array.isArray((item as QuestionV2Detail).alternatives)
);

export const buildPracticeServerUrl = (
  searchParams: PracticeSearchParams = {},
  apiBaseUrl = getApiBaseUrl(),
): URL => {
  const url = new URL(ENDPOINTS.questions.v2List, apiBaseUrl);
  url.searchParams.set('content_scope', 'practice');
  url.searchParams.set('publication_scope', 'public');
  url.searchParams.set('publish_status', 'published');
  url.searchParams.set('limit', '10');

  PUBLIC_PRACTICE_QUERY_KEYS.forEach((key) => {
    const value = searchParams[key];
    if (Array.isArray(value)) {
      value.filter(Boolean).forEach((item) => url.searchParams.append(key, item));
      return;
    }
    if (value) url.searchParams.set(key, value);
  });

  const highlightedQuestionId = String(searchParams.questionId || '').trim();
  if (highlightedQuestionId && !url.searchParams.has('questionIds')) {
    url.searchParams.set('questionIds', highlightedQuestionId);
  }

  return url;
};

export const mapPracticeServerPayload = (payload: unknown): PracticeInitialQuestionPage => {
  const data = unwrapApiData(payload);
  if (!data || typeof data !== 'object') return EMPTY_INITIAL_PAGE;

  const page = data as QuestionV2PageResponse;
  const items = Array.isArray(page.items) ? page.items : [];
  const questions = items
    .map((item) => (isV2Detail(item) ? mapV2DetailToQuestion(item) : mapV2ListItemToQuestion(item)))
    .filter(isQuestionPubliclyVisible);

  return {
    questions,
    total: questions.length,
    pageInfo: {
      limit: Math.max(1, Number(page.pageInfo?.limit || 10)),
      hasMore: Boolean(page.pageInfo?.hasMore),
      nextCursor: typeof page.pageInfo?.nextCursor === 'string' && page.pageInfo.nextCursor
        ? page.pageInfo.nextCursor
        : null,
    },
  };
};

export const fetchPracticeInitialQuestions = async ({
  searchParams = {},
  fetchImpl = fetch,
  apiBaseUrl,
}: {
  searchParams?: PracticeSearchParams;
  fetchImpl?: FetchLike;
  apiBaseUrl?: string;
} = {}): Promise<PracticeInitialQuestionPage> => {
  try {
    const response = await fetchImpl(buildPracticeServerUrl(searchParams, apiBaseUrl), {
      cache: 'no-store',
      headers: {
        Accept: 'application/json',
      },
    });

    if (!response.ok) return EMPTY_INITIAL_PAGE;
    return mapPracticeServerPayload(await response.json());
  } catch {
    return EMPTY_INITIAL_PAGE;
  }
};
