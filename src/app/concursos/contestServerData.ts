import { cache } from 'react';
import { resolveAbsoluteApiBaseUrl } from '@services/api/baseUrl';
import { publicRoutes } from '@services/routes/publicRoutes';

export type ContestSummary = {
  id: number; slug: string; title: string; description: string | null; status: string; isOpen: boolean; year: number | null;
  registrationStart: string | null; registrationEnd: string | null; organization: string | null;
  organizationAcronym: string | null; board: string | null; boardAcronym: string | null;
  path: string; updatedAt: string | null;
};
export type ContestDirectory = { items: ContestSummary[]; pageInfo: { page: number; pages: number; limit: number; total: number } };
export type PublicContest = {
  id: number; slug: string; title: string; description: string | null; status: string; isOpen: boolean; year: number | null;
  officialUrl: string | null; dates: Record<string, string | null>;
  organizations: Array<{ id: number; slug: string; name: string; acronym: string | null; path: string }>;
  board: { id: number; slug: string; name: string; acronym: string | null; path: string } | null;
  positions: Array<{ id: number; roleId: number; slug: string; name: string; path: string; vacancies: number | null; reserveRegistry: boolean; salaryMin: number | null; salaryMax: number | null; educationLevel: string | null; weeklyHours: number | null; locationLabel: string | null }>;
  documents: Array<{ id: number; type: string; title: string; url: string; publishedAt: string | null }>;
  exams: Array<{ id: number; slug: string; title: string; year: number | null; questionCount: number; path: string }>;
  questions: Array<{ id: number; excerpt: string; path: string }>;
  questionCount: number; canonicalPath: string;
  readiness: { status: 'READY' | 'NOT_READY' | 'NOT_APPLICABLE'; reasonCodes: string[] };
  breadcrumbs: Array<{ label: string; canonicalPath: string }>;
  updatedAt: string | null;
};

type RecordValue = Record<string, unknown>;
const record = (value: unknown): value is RecordValue => Boolean(value) && typeof value === 'object' && !Array.isArray(value);
const text = (value: unknown) => typeof value === 'string' ? value.trim() : '';
const nullableText = (value: unknown) => text(value) || null;
const int = (value: unknown) => Math.max(0, Math.trunc(Number(value) || 0));
const persistedSlug = (value: unknown): string => {
  const slug = text(value);
  return slug.length <= 190 && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) ? slug : '';
};
const readiness = (value: unknown): PublicContest['readiness'] => {
  if (!record(value)) return { status: 'NOT_READY', reasonCodes: ['instance_readiness.not_evaluated'] };
  const status = ['READY', 'NOT_READY', 'NOT_APPLICABLE'].includes(text(value.status))
    ? text(value.status) as PublicContest['readiness']['status'] : 'NOT_READY';
  const reasonCodes = Array.isArray(value.reasonCodes) ? value.reasonCodes.map(text).filter(Boolean) : [];
  return { status, reasonCodes };
};
const unwrap = (value: unknown): unknown => record(value) && 'data' in value ? value.data : value;
const safeUrl = (value: unknown): string | null => {
  try {
    const url = new URL(text(value));
    const host = url.hostname.toLowerCase().replace(/\.$/, '');
    const privateIpv4 = /^(?:127\.|10\.|192\.168\.|169\.254\.|172\.(?:1[6-9]|2\d|3[01])\.)/;
    const localHost = host === 'localhost' || host.endsWith('.localhost') || host.endsWith('.local')
      || host.endsWith('.internal') || host === '::1' || host === '[::1]' || privateIpv4.test(host);
    const sensitiveQuery = [...url.searchParams.keys()].some((key) => /(?:^|[_-])(token|signature|sig|credential|secret|key)(?:$|[_-])/.test(key.toLowerCase()) || key.toLowerCase().startsWith('x-amz-'));
    return ['http:', 'https:'].includes(url.protocol) && !url.username && !url.password && !localHost && !sensitiveQuery ? url.toString() : null;
  } catch { return null; }
};
const list = <T>(value: unknown, mapper: (item: RecordValue) => T | null): T[] => Array.isArray(value)
  ? value.filter(record).map(mapper).filter((item): item is T => item !== null) : [];

const parseSummary = (value: unknown): ContestSummary | null => {
  if (!record(value)) return null;
  const item = { id: int(value.id), slug: persistedSlug(value.slug), title: text(value.title), path: text(value.path) };
  if (!item.id || !item.slug || !item.title || item.path !== publicRoutes.contests.detail(item.slug)) return null;
  return { ...item, description: nullableText(value.description), status: text(value.status), isOpen: Boolean(value.isOpen), year: value.year == null ? null : int(value.year), registrationStart: nullableText(value.registrationStart), registrationEnd: nullableText(value.registrationEnd), organization: nullableText(value.organization), organizationAcronym: nullableText(value.organizationAcronym), board: nullableText(value.board), boardAcronym: nullableText(value.boardAcronym), updatedAt: nullableText(value.updatedAt) };
};

export const parseContestDirectory = (value: unknown): ContestDirectory => {
  if (!record(value)) throw new Error('public_contest_directory_contract_invalid');
  const pageInfo = record(value.pageInfo) ? value.pageInfo : {};
  return { items: list(value.items, parseSummary), pageInfo: { page: Math.max(1, int(pageInfo.page)), pages: Math.max(1, int(pageInfo.pages)), limit: int(pageInfo.limit), total: int(pageInfo.total) } };
};

export const parsePublicContest = (value: unknown): PublicContest | { redirectSlug: string } | null => {
  if (!record(value)) return null;
  if (persistedSlug(value.redirectSlug)) return { redirectSlug: persistedSlug(value.redirectSlug) };
  const id = int(value.id); const slug = persistedSlug(value.slug); const title = text(value.title); const canonicalPath = text(value.canonicalPath);
  if (!id || !slug || !title || canonicalPath !== publicRoutes.contests.detail(slug)) return null;
  const taxonomy = (item: RecordValue, kind: 'organizations' | 'boards') => {
    const mapped = { id: int(item.id), slug: persistedSlug(item.slug), name: text(item.name), acronym: nullableText(item.acronym), path: text(item.path) };
    return mapped.id && mapped.slug && mapped.name && mapped.path === publicRoutes[kind].detail(mapped.slug) ? mapped : null;
  };
  const dates = record(value.dates) ? Object.fromEntries(Object.entries(value.dates).map(([key, val]) => [key, nullableText(val)])) : {};
  return {
    id, slug, title, canonicalPath, description: nullableText(value.description), status: text(value.status), isOpen: Boolean(value.isOpen),
    year: value.year == null ? null : int(value.year), officialUrl: safeUrl(value.officialUrl), dates,
    organizations: list(value.organizations, (item) => taxonomy(item, 'organizations')),
    board: record(value.board) ? taxonomy(value.board, 'boards') : null,
    positions: list(value.positions, (item) => { const roleSlug=persistedSlug(item.slug); const path=text(item.path); return int(item.id)&&int(item.roleId)&&roleSlug&&text(item.name)&&path===publicRoutes.positions.detail(roleSlug)?{ id: int(item.id), roleId: int(item.roleId), slug: roleSlug, name: text(item.name), path, vacancies: item.vacancies == null ? null : int(item.vacancies), reserveRegistry: Boolean(item.reserveRegistry), salaryMin: item.salaryMin == null ? null : Number(item.salaryMin), salaryMax: item.salaryMax == null ? null : Number(item.salaryMax), educationLevel: nullableText(item.educationLevel), weeklyHours: item.weeklyHours == null ? null : int(item.weeklyHours), locationLabel: nullableText(item.locationLabel) }:null; }),
    documents: list(value.documents, (item) => { const url = safeUrl(item.url); return int(item.id) && text(item.title) && url ? { id: int(item.id), type: text(item.type), title: text(item.title), url, publishedAt: nullableText(item.publishedAt) } : null; }),
    exams: list(value.exams, (item) => { const exam = { id: int(item.id), slug: persistedSlug(item.slug), title: text(item.title), year: item.year == null ? null : int(item.year), questionCount: int(item.questionCount), path: text(item.path) }; return exam.id && exam.slug && exam.title && exam.path === publicRoutes.exams.detail(exam.slug) ? exam : null; }),
    questions: list(value.questions, (item) => { const question = { id: int(item.id), excerpt: text(item.excerpt), path: text(item.path) }; return question.id && question.path.startsWith(`/questoes/${question.id}/`) ? question : null; }),
    questionCount: int(value.questionCount), readiness: readiness(value.readiness),
    breadcrumbs: list(value.breadcrumbs, (item) => text(item.label) && text(item.canonicalPath) ? { label: text(item.label), canonicalPath: text(item.canonicalPath) } : null),
    updatedAt: nullableText(value.updatedAt),
  };
};

const apiBase = () => resolveAbsoluteApiBaseUrl(process.env.NEXT_PUBLIC_API_BASE_URL || process.env.API_BASE_URL || undefined);
const CONTEST_STATUSES = new Set(['announced', 'authorized', 'notice_published', 'registration_open', 'registration_closed', 'exam_scheduled', 'exam_completed', 'results', 'completed', 'suspended', 'cancelled']);
const fetchJson = async (path: string, params: URLSearchParams): Promise<unknown> => {
  const url = new URL(path, apiBase()); url.search = params.toString();
  const response = await fetch(url.toString(), { headers: { Accept: 'application/json' }, next: { revalidate: 300 } });
  if (response.status === 404) return null;
  if (!response.ok) throw new Error(`public_contest_fetch_failed:${response.status}`);
  return unwrap(await response.json());
};

export const fetchContestDirectoryForServer = cache(async (query: { pagina?: string; busca?: string; ano?: string; status?: string }, openOnly = false) => {
  const params = new URLSearchParams();
  if (/^\d+$/.test(text(query.pagina))) params.set('pagina', text(query.pagina));
  if (text(query.busca)) params.set('busca', text(query.busca));
  if (/^\d{4}$/.test(text(query.ano))) params.set('ano', text(query.ano));
  if (CONTEST_STATUSES.has(text(query.status))) params.set('status', text(query.status));
  return parseContestDirectory(await fetchJson(openOnly ? 'contests/open.php' : 'contests/index.php', params));
});
export const fetchPublicContestForServer = cache(async (slug: string) => parsePublicContest(await fetchJson('contests/detail.php', new URLSearchParams({ slug }))));
