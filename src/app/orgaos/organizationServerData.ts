import { cache } from 'react';
import { resolveAbsoluteApiBaseUrl } from '@services/api/baseUrl';
import {
  isQuestionsIndexPath,
  matchesPublicRouteFamily,
  publicRoutes,
} from '@services/routes/publicRoutes';

export type PublicOrganizationRole = {
  id: number;
  name: string;
  questionsPath: string;
};

export type PublicOrganizationDiscipline = {
  id: number;
  slug: string;
  name: string;
  questionCount: number;
  path: string;
};

export type PublicOrganizationBoard = {
  id: number;
  slug: string;
  name: string;
  acronym: string | null;
  examCount: number;
  path: string;
};

export type PublicOrganizationExam = {
  id: number;
  slug: string;
  name: string;
  year: number;
  questionCount: number;
  path: string;
};

export type PublicOrganizationQuestion = {
  id: number;
  excerpt: string;
  updatedAt: string | null;
  path: string;
};

export type PublicOrganization = {
  id: number;
  slug: string;
  name: string;
  acronym: string | null;
  description: string | null;
  website: string | null;
  imageUrl: string | null;
  stateCode: string | null;
  sphere: string | null;
  canonicalPath: string;
  questionsPath: string;
  questionCount: number;
  examCount: number;
  roles: PublicOrganizationRole[];
  disciplines: PublicOrganizationDiscipline[];
  boards: PublicOrganizationBoard[];
  exams: PublicOrganizationExam[];
  questions: PublicOrganizationQuestion[];
  breadcrumbs: Array<{ label: string; canonicalPath: string }>;
  updatedAt: string | null;
};

type FetchOrganizationOptions = {
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
const publicUrl = (value: unknown): string | null => {
  const candidate = text(value);
  if (!candidate) return null;
  try {
    const url = new URL(candidate);
    return url.protocol === 'http:' || url.protocol === 'https:' ? url.toString() : null;
  } catch {
    return null;
  }
};
const mapRecords = <T>(value: unknown, mapper: (record: Record<string, unknown>) => T | null): T[] => (
  Array.isArray(value)
    ? value.filter(isRecord).map(mapper).filter((item): item is T => item !== null)
    : []
);

export const parsePublicOrganization = (value: unknown): PublicOrganization | null => {
  if (!isRecord(value)) return null;
  const id = nonNegativeInt(value.id);
  const slug = text(value.slug);
  const name = text(value.name);
  const canonicalPath = publicPath(value.canonicalPath);
  const questionsPath = publicPath(value.questionsPath);
  if (id <= 0 || !slug || !name || canonicalPath !== publicRoutes.organizations.detail(slug)) return null;
  if (!isQuestionsIndexPath(questionsPath) || !questionsPath.startsWith('/questoes?')) return null;

  const roles = mapRecords(value.roles, (item) => {
    const role = {
      id: nonNegativeInt(item.id),
      name: text(item.name),
      questionsPath: publicPath(item.questionsPath),
    };
    return role.id > 0 && role.name && role.questionsPath.startsWith('/questoes?')
      && isQuestionsIndexPath(role.questionsPath) ? role : null;
  });
  const disciplines = mapRecords(value.disciplines, (item) => {
    const discipline = {
      id: nonNegativeInt(item.id),
      slug: text(item.slug),
      name: text(item.name),
      questionCount: nonNegativeInt(item.questionCount),
      path: publicPath(item.path),
    };
    return discipline.id > 0 && discipline.slug && discipline.name
      && discipline.path === publicRoutes.disciplines.detail(discipline.slug) ? discipline : null;
  });
  const boards = mapRecords(value.boards, (item) => {
    const board = {
      id: nonNegativeInt(item.id),
      slug: text(item.slug),
      name: text(item.name),
      acronym: nullableText(item.acronym),
      examCount: nonNegativeInt(item.examCount),
      path: publicPath(item.path),
    };
    return board.id > 0 && board.slug && board.name
      && board.path === publicRoutes.boards.detail(board.slug) ? board : null;
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
    return exam.id > 0 && exam.slug && exam.name
      && exam.path === publicRoutes.exams.detail(exam.slug) ? exam : null;
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
      && (breadcrumb.canonicalPath === '/'
        || breadcrumb.canonicalPath === publicRoutes.organizations.index()
        || breadcrumb.canonicalPath === canonicalPath)
      ? breadcrumb
      : null;
  });
  if (breadcrumbs.length !== 3 || breadcrumbs.at(-1)?.canonicalPath !== canonicalPath) return null;

  return {
    id,
    slug,
    name,
    acronym: nullableText(value.acronym),
    description: nullableText(value.description),
    website: publicUrl(value.website),
    imageUrl: publicUrl(value.imageUrl),
    stateCode: nullableText(value.stateCode),
    sphere: nullableText(value.sphere),
    canonicalPath,
    questionsPath,
    questionCount: nonNegativeInt(value.questionCount),
    examCount: nonNegativeInt(value.examCount),
    roles,
    disciplines,
    boards,
    exams,
    questions,
    breadcrumbs,
    updatedAt: nullableText(value.updatedAt),
  };
};

const unwrapData = (payload: unknown): unknown => (
  isRecord(payload) && Object.prototype.hasOwnProperty.call(payload, 'data') ? payload.data : payload
);

export const fetchPublicOrganizationForServerTest = async (
  slug: string,
  { fetchImpl = fetch, apiBaseUrl }: FetchOrganizationOptions = {},
): Promise<PublicOrganization | null> => {
  const baseUrl = resolveAbsoluteApiBaseUrl(
    apiBaseUrl || process.env.NEXT_PUBLIC_API_BASE_URL || process.env.API_BASE_URL || undefined,
  );
  const url = new URL('filters/organization.php', baseUrl);
  url.searchParams.set('slug', String(slug || '').trim());
  const response = await fetchImpl(url.toString(), {
    headers: { Accept: 'application/json' },
    next: { revalidate: 300 },
  });
  if (response.status === 404) return null;
  if (!response.ok) throw new Error(`public_organization_fetch_failed:${response.status}`);
  const organization = parsePublicOrganization(unwrapData(await response.json()));
  if (!organization) throw new Error('public_organization_contract_invalid');
  return organization;
};

const fetchPublicOrganizationCached = cache((slug: string) => fetchPublicOrganizationForServerTest(slug));

export const fetchPublicOrganizationForServer = (slug: string): Promise<PublicOrganization | null> => (
  fetchPublicOrganizationCached(String(slug || '').trim())
);
