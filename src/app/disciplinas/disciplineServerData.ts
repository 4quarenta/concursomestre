import { cache } from 'react';
import { resolveAbsoluteApiBaseUrl } from '@services/api/baseUrl';
import {
  isQuestionsIndexPath,
  matchesPublicRouteFamily,
  publicRoutes,
} from '@services/routes/publicRoutes';

export type PublicDisciplineTopic = {
  id: number;
  slug: string;
  name: string;
  questionCount: number;
  questionsPath: string;
};

export type PublicDisciplineExam = {
  id: number;
  slug: string;
  name: string;
  year: number;
  questionCount: number;
  path: string;
};

export type PublicDisciplineBoard = {
  id: number;
  slug: string;
  name: string;
  acronym: string | null;
  questionCount: number;
  path: string;
};

export type PublicDisciplineQuestion = {
  id: number;
  excerpt: string;
  updatedAt: string | null;
  path: string;
};

export type PublicDiscipline = {
  id: number;
  slug: string;
  name: string;
  description: string | null;
  canonicalPath: string;
  questionsPath: string;
  parent: null;
  root: null;
  questionCount: number;
  topics: PublicDisciplineTopic[];
  exams: PublicDisciplineExam[];
  boards: PublicDisciplineBoard[];
  questions: PublicDisciplineQuestion[];
  breadcrumbs: Array<{ label: string; canonicalPath: string }>;
  updatedAt: string | null;
};

type FetchDisciplineOptions = {
  fetchImpl?: typeof fetch;
  apiBaseUrl?: string;
};

const isRecord = (value: unknown): value is Record<string, unknown> => (
  Boolean(value) && typeof value === 'object' && !Array.isArray(value)
);

const text = (value: unknown): string => typeof value === 'string' ? value.trim() : '';
const nullableText = (value: unknown): string | null => text(value) || null;
const nonNegativeInt = (value: unknown): number => Math.max(0, Math.trunc(Number(value) || 0));
const publicPath = (value: unknown): string => {
  const path = text(value);
  return /^\/[^?#]*?(?:\?[^#]*)?$/.test(path) ? path : '';
};

const mapRecords = <T>(value: unknown, mapper: (record: Record<string, unknown>) => T | null): T[] => (
  Array.isArray(value)
    ? value.filter(isRecord).map(mapper).filter((item): item is T => item !== null)
    : []
);

export const parsePublicDiscipline = (value: unknown): PublicDiscipline | null => {
  if (!isRecord(value)) return null;
  const id = nonNegativeInt(value.id);
  const slug = text(value.slug);
  const name = text(value.name);
  const canonicalPath = publicPath(value.canonicalPath);
  const questionsPath = publicPath(value.questionsPath);
  if (id <= 0 || !slug || !name || !canonicalPath || !questionsPath) return null;
  if (canonicalPath !== publicRoutes.disciplines.detail(slug)) return null;
  if (!isQuestionsIndexPath(questionsPath) || !questionsPath.startsWith('/questoes?')) return null;

  const topics = mapRecords(value.topics, (item) => {
    const topic = {
      id: nonNegativeInt(item.id),
      slug: text(item.slug),
      name: text(item.name),
      questionCount: nonNegativeInt(item.questionCount),
      questionsPath: publicPath(item.questionsPath),
    };
    return topic.id > 0
      && topic.name
      && topic.questionsPath.startsWith('/questoes?')
      && isQuestionsIndexPath(topic.questionsPath) ? topic : null;
  });
  const exams = mapRecords(value.exams, (item) => {
    const exam = {
      id: nonNegativeInt(item.id),
      slug: text(item.slug),
      name: text(item.name),
      year: nonNegativeInt(item.year),
      questionCount: nonNegativeInt(item.questionCount),
      path: publicPath(item.path),
    };
    return exam.id > 0 && exam.slug && exam.name && exam.path === publicRoutes.exams.detail(exam.slug) ? exam : null;
  });
  const boards = mapRecords(value.boards, (item) => {
    const board = {
      id: nonNegativeInt(item.id),
      slug: text(item.slug),
      name: text(item.name),
      acronym: nullableText(item.acronym),
      questionCount: nonNegativeInt(item.questionCount),
      path: publicPath(item.path),
    };
    return board.id > 0 && board.slug && board.name && board.path === publicRoutes.boards.detail(board.slug) ? board : null;
  });
  const questions = mapRecords(value.questions, (item) => {
    const question = {
      id: nonNegativeInt(item.id),
      excerpt: text(item.excerpt),
      updatedAt: nullableText(item.updatedAt),
      path: publicPath(item.path),
    };
    return question.id > 0
      && question.path.startsWith(`/questoes/${question.id}/`)
      && matchesPublicRouteFamily('question_detail', question.path, { includeLegacy: false })
      ? question
      : null;
  });
  const breadcrumbs = mapRecords(value.breadcrumbs, (item) => {
    const breadcrumb = { label: text(item.label), canonicalPath: publicPath(item.canonicalPath) };
    return breadcrumb.label
      && (breadcrumb.canonicalPath === '/' || breadcrumb.canonicalPath === '/disciplinas' || breadcrumb.canonicalPath === canonicalPath)
      ? breadcrumb
      : null;
  });
  if (breadcrumbs.length < 3 || breadcrumbs.at(-1)?.canonicalPath !== canonicalPath) return null;

  return {
    id,
    slug,
    name,
    description: nullableText(value.description),
    canonicalPath,
    questionsPath,
    parent: null,
    root: null,
    questionCount: nonNegativeInt(value.questionCount),
    topics,
    exams,
    boards,
    questions,
    breadcrumbs,
    updatedAt: nullableText(value.updatedAt),
  };
};

const unwrapData = (payload: unknown): unknown => (
  isRecord(payload) && Object.prototype.hasOwnProperty.call(payload, 'data') ? payload.data : payload
);

export const fetchPublicDisciplineForServerTest = async (
  slug: string,
  { fetchImpl = fetch, apiBaseUrl }: FetchDisciplineOptions = {},
): Promise<PublicDiscipline | null> => {
  const baseUrl = resolveAbsoluteApiBaseUrl(
    apiBaseUrl || process.env.NEXT_PUBLIC_API_BASE_URL || process.env.API_BASE_URL || undefined,
  );
  const url = new URL('filters/discipline.php', baseUrl);
  url.searchParams.set('slug', String(slug || '').trim());
  const response = await fetchImpl(url.toString(), {
    headers: { Accept: 'application/json' },
    next: { revalidate: 300 },
  });
  if (response.status === 404) return null;
  if (!response.ok) throw new Error(`public_discipline_fetch_failed:${response.status}`);
  const discipline = parsePublicDiscipline(unwrapData(await response.json()));
  if (!discipline) throw new Error('public_discipline_contract_invalid');
  return discipline;
};

const fetchPublicDisciplineCached = cache((slug: string) => fetchPublicDisciplineForServerTest(slug));

export const fetchPublicDisciplineForServer = (slug: string): Promise<PublicDiscipline | null> => (
  fetchPublicDisciplineCached(String(slug || '').trim())
);
