import { cache } from 'react';
import { resolveAbsoluteApiBaseUrl } from '@services/api/baseUrl';
import { publicRoutes } from '@services/routes/publicRoutes';

type RecordValue = Record<string, unknown>;
const record = (value: unknown): value is RecordValue => Boolean(value) && typeof value === 'object' && !Array.isArray(value);
const text = (value: unknown) => typeof value === 'string' ? value.trim() : '';
const nullableText = (value: unknown) => text(value) || null;
const int = (value: unknown) => Math.max(0, Math.trunc(Number(value) || 0));
const slug = (value: unknown) => /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(text(value)) && text(value).length <= 190 ? text(value) : '';
const list = <T>(value: unknown, mapper: (item: RecordValue) => T | null): T[] => Array.isArray(value)
  ? value.filter(record).map(mapper).filter((item): item is T => item !== null) : [];
const unwrap = (value: unknown): unknown => record(value) && 'data' in value ? value.data : value;

export type PublicSimulationSummary = {
  id: number; slug: string; title: string; description: string | null; durationMinutes: number | null;
  questionCount: number; availabilityStatus: string; path: string; updatedAt: string | null;
};
export type PublicSimulationDirectory = {
  items: PublicSimulationSummary[];
  pageInfo: { page: number; pages: number; limit: number; total: number };
};
export type PublicSimulationDetail = PublicSimulationSummary & {
  canonicalPath: string; instructions: string | null; isAttemptAvailable: boolean; practicePath: '/simulation';
  questions: Array<{ id: number; excerpt: string; position: number; path: string }>;
  taxonomies: Array<{ id: number; slug: string; name: string; relationType: string; path: string }>;
  contests: Array<{ id: number; slug: string; title: string; path: string }>;
  exams: Array<{ id: number; slug: string; title: string; year: number | null; path: string }>;
  breadcrumbs: Array<{ label: string; canonicalPath: string }>;
  readiness: { status: 'READY' | 'NOT_READY'; reasonCodes: string[] };
};

const summary = (item: RecordValue): PublicSimulationSummary | null => {
  const persistedSlug = slug(item.slug); const path = text(item.path); const id = int(item.id); const title = text(item.title);
  if (!id || !persistedSlug || !title || path !== publicRoutes.simulations.detail(persistedSlug)) return null;
  return {
    id, slug: persistedSlug, title, path, description: nullableText(item.description),
    durationMinutes: item.durationMinutes == null ? null : int(item.durationMinutes),
    questionCount: int(item.questionCount), availabilityStatus: text(item.availabilityStatus),
    updatedAt: nullableText(item.updatedAt),
  };
};

export const parsePublicSimulationDirectory = (value: unknown): PublicSimulationDirectory => {
  if (!record(value)) throw new Error('public_simulation_directory_contract_invalid');
  const pageInfo = record(value.pageInfo) ? value.pageInfo : {};
  return {
    items: list(value.items, summary),
    pageInfo: { page: Math.max(1, int(pageInfo.page)), pages: Math.max(1, int(pageInfo.pages)), limit: int(pageInfo.limit), total: int(pageInfo.total) },
  };
};

export const parsePublicSimulationDetail = (value: unknown): PublicSimulationDetail | { redirectSlug: string } | null => {
  if (!record(value)) return null;
  const redirectSlug = slug(value.redirectSlug); if (redirectSlug) return { redirectSlug };
  const base = summary({ ...value, path: value.canonicalPath }); if (!base) return null;
  const canonicalPath = text(value.canonicalPath); if (canonicalPath !== base.path) return null;
  const readinessValue = record(value.readiness) ? value.readiness : {};
  const readiness = readinessValue.status === 'READY'
    ? { status: 'READY' as const, reasonCodes: [] }
    : { status: 'NOT_READY' as const, reasonCodes: Array.isArray(readinessValue.reasonCodes) ? readinessValue.reasonCodes.map(text).filter(Boolean) : ['instance_readiness.not_evaluated'] };
  return {
    ...base, canonicalPath, instructions: nullableText(value.instructions), isAttemptAvailable: value.isAttemptAvailable === true,
    practicePath: text(value.practicePath) === '/simulation' ? '/simulation' : '/simulation',
    questions: list(value.questions, (item) => { const id = int(item.id); const path = text(item.path); return id && path.startsWith(`/questoes/${id}/`) ? { id, excerpt: text(item.excerpt), position: int(item.position), path } : null; }),
    taxonomies: list(value.taxonomies, (item) => { const id = int(item.id); const persistedSlug = slug(item.slug); const path = text(item.path); return id && persistedSlug && text(item.name) && path.startsWith('/') ? { id, slug: persistedSlug, name: text(item.name), relationType: text(item.relationType), path } : null; }),
    contests: list(value.contests, (item) => { const id = int(item.id); const persistedSlug = slug(item.slug); const path = text(item.path); return id && persistedSlug && text(item.title) && path === publicRoutes.contests.detail(persistedSlug) ? { id, slug: persistedSlug, title: text(item.title), path } : null; }),
    exams: list(value.exams, (item) => { const id = int(item.id); const persistedSlug = slug(item.slug); const path = text(item.path); return id && persistedSlug && text(item.title) && path === publicRoutes.exams.detail(persistedSlug) ? { id, slug: persistedSlug, title: text(item.title), year: item.year == null ? null : int(item.year), path } : null; }),
    breadcrumbs: list(value.breadcrumbs, (item) => text(item.label) && text(item.canonicalPath) ? { label: text(item.label), canonicalPath: text(item.canonicalPath) } : null),
    readiness,
  };
};

const apiBase = () => resolveAbsoluteApiBaseUrl(process.env.NEXT_PUBLIC_API_BASE_URL || process.env.API_BASE_URL || undefined);
const fetchJson = async (path: string, params: URLSearchParams): Promise<unknown> => {
  const url = new URL(path, apiBase()); url.search = params.toString();
  const response = await fetch(url.toString(), { headers: { Accept: 'application/json' }, next: { revalidate: 300 } });
  if (response.status === 404) return null;
  if (!response.ok) throw new Error(`public_simulation_fetch_failed:${response.status}`);
  return unwrap(await response.json());
};

export const fetchPublicSimulationDirectory = cache(async (query: { pagina?: string; busca?: string }) => {
  const page = /^\d+$/.test(text(query.pagina)) ? text(query.pagina) : '1';
  const params = new URLSearchParams({ page });
  if (text(query.busca)) params.set('search', text(query.busca).slice(0, 120));
  return parsePublicSimulationDirectory(await fetchJson('simulations/public-directory.php', params));
});

export const fetchPublicSimulationDetail = cache(async (persistedSlug: string) => (
  parsePublicSimulationDetail(await fetchJson('simulations/public-detail.php', new URLSearchParams({ slug: persistedSlug })))
));
