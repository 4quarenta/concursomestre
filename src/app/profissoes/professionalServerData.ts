import { cache } from 'react';
import { resolveAbsoluteApiBaseUrl } from '@services/api/baseUrl';
import { isQuestionsIndexPath, publicRoutes } from '@services/routes/publicRoutes';

export type ProfessionalKind = 'career' | 'position';
export type ProfessionalSummary = { id: number; slug: string; name: string; description: string | null; questionCount: number; examCount: number; path: string };
export type ProfessionalDirectory = { items: ProfessionalSummary[]; pageInfo: { page: number; pages: number; limit: number; total: number } };
export type ProfessionalDetail = {
  kind: ProfessionalKind; id: number; slug: string; name: string; description: string | null;
  canonicalPath: string; questionsPath: string; contestsPath: string; questionCount: number; examCount: number;
  careers: Array<{ id: number; slug: string; name: string; path: string }>;
  positions: Array<{ id: number; slug: string; name: string; questionCount: number; examCount: number; path: string }>;
  contests: Array<{ id: number; slug: string; title: string; status: string; year: number | null; organization: string | null; path: string }>;
  organizations: Array<{ id: number; slug: string; name: string; acronym: string | null; path: string }>;
  exams: Array<{ id: number; slug: string; name: string; year: number | null; questionCount: number; path: string }>;
  questions: Array<{ id: number; excerpt: string; path: string }>;
  boards: Array<{ id: number; slug: string; name: string; acronym: string | null; path: string }>;
  breadcrumbs: Array<{ label: string; canonicalPath: string }>;
  readiness: { status: 'READY' | 'NOT_READY'; reasonCodes: string[] }; updatedAt: string | null;
};

type RecordValue = Record<string, unknown>;
const record = (value: unknown): value is RecordValue => Boolean(value) && typeof value === 'object' && !Array.isArray(value);
const text = (value: unknown) => typeof value === 'string' ? value.trim() : '';
const nullableText = (value: unknown) => text(value) || null;
const int = (value: unknown) => Math.max(0, Math.trunc(Number(value) || 0));
const slug = (value: unknown) => /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(text(value)) && text(value).length <= 190 ? text(value) : '';
const list = <T>(value: unknown, mapper: (item: RecordValue) => T | null): T[] => Array.isArray(value)
  ? value.filter(record).map(mapper).filter((item): item is T => item !== null) : [];
const unwrap = (value: unknown): unknown => record(value) && 'data' in value ? value.data : value;
const route = (kind: ProfessionalKind, value: string) => kind === 'career' ? publicRoutes.careers.detail(value) : publicRoutes.positions.detail(value);

export const parseProfessionalDirectory = (value: unknown, kind: ProfessionalKind): ProfessionalDirectory => {
  if (!record(value)) throw new Error('public_professional_directory_contract_invalid');
  const pageInfo = record(value.pageInfo) ? value.pageInfo : {};
  return {
    items: list(value.items, (item) => {
      const mapped = { id: int(item.id), slug: slug(item.slug), name: text(item.name), description: nullableText(item.description), questionCount: int(item.questionCount), examCount: int(item.examCount), path: text(item.path) };
      return mapped.id && mapped.slug && mapped.name && mapped.path === route(kind, mapped.slug) ? mapped : null;
    }),
    pageInfo: { page: Math.max(1, int(pageInfo.page)), pages: Math.max(1, int(pageInfo.pages)), limit: int(pageInfo.limit), total: int(pageInfo.total) },
  };
};

export const parseProfessionalDetail = (value: unknown, kind: ProfessionalKind): ProfessionalDetail | { redirectSlug: string } | null => {
  if (!record(value)) return null;
  const redirectSlug = slug(value.redirectSlug);
  if (redirectSlug) return { redirectSlug };
  const id = int(value.id); const persistedSlug = slug(value.slug); const name = text(value.name); const canonicalPath = text(value.canonicalPath);
  if (!id || !persistedSlug || !name || value.kind !== kind || canonicalPath !== route(kind, persistedSlug)) return null;
  const taxonomy = (item: RecordValue, relatedKind: ProfessionalKind) => {
    const mapped = { id: int(item.id), slug: slug(item.slug), name: text(item.name), path: text(item.path) };
    return mapped.id && mapped.slug && mapped.name && mapped.path === route(relatedKind, mapped.slug) ? mapped : null;
  };
  const questionsPath = text(value.questionsPath); const contestsPath = text(value.contestsPath);
  if (!isQuestionsIndexPath(questionsPath) || !(contestsPath === publicRoutes.contests.index() || contestsPath.startsWith('/concursos?cargo='))) return null;
  return {
    kind, id, slug: persistedSlug, name, canonicalPath, questionsPath, contestsPath,
    description: nullableText(value.description), questionCount: int(value.questionCount), examCount: int(value.examCount),
    careers: list(value.careers, (item) => taxonomy(item, 'career')),
    positions: list(value.positions, (item) => { const base = taxonomy(item, 'position'); return base ? { ...base, questionCount: int(item.questionCount), examCount: int(item.examCount) } : null; }),
    contests: list(value.contests, (item) => { const s = slug(item.slug); const path = text(item.path); return int(item.id) && s && text(item.title) && path === publicRoutes.contests.detail(s) ? { id: int(item.id), slug: s, title: text(item.title), status: text(item.status), year: item.year == null ? null : int(item.year), organization: nullableText(item.organization), path } : null; }),
    organizations: list(value.organizations, (item) => { const s = slug(item.slug); const path = text(item.path); return int(item.id) && s && text(item.name) && path === publicRoutes.organizations.detail(s) ? { id: int(item.id), slug: s, name: text(item.name), acronym: nullableText(item.acronym), path } : null; }),
    exams: list(value.exams, (item) => { const s = slug(item.slug); const path = text(item.path); return int(item.id) && s && text(item.name) && path === publicRoutes.exams.detail(s) ? { id: int(item.id), slug: s, name: text(item.name), year: item.year == null ? null : int(item.year), questionCount: int(item.questionCount), path } : null; }),
    questions: list(value.questions, (item) => { const qid = int(item.id); const path = text(item.path); return qid && path.startsWith(`/questoes/${qid}/`) ? { id: qid, excerpt: text(item.excerpt), path } : null; }),
    boards: list(value.boards, (item) => { const s = slug(item.slug); const path = text(item.path); return int(item.id) && s && text(item.name) && path === publicRoutes.boards.detail(s) ? { id: int(item.id), slug: s, name: text(item.name), acronym: nullableText(item.acronym), path } : null; }),
    breadcrumbs: list(value.breadcrumbs, (item) => text(item.label) && text(item.canonicalPath) ? { label: text(item.label), canonicalPath: text(item.canonicalPath) } : null),
    readiness: record(value.readiness) && value.readiness.status === 'READY' ? { status: 'READY', reasonCodes: [] } : { status: 'NOT_READY', reasonCodes: [] },
    updatedAt: nullableText(value.updatedAt),
  };
};

const apiBase = () => resolveAbsoluteApiBaseUrl(process.env.NEXT_PUBLIC_API_BASE_URL || process.env.API_BASE_URL || undefined);
const fetchJson = async (path: string, params: URLSearchParams): Promise<unknown> => {
  const url = new URL(path, apiBase()); url.search = params.toString();
  const response = await fetch(url.toString(), { headers: { Accept: 'application/json' }, next: { revalidate: 300 } });
  if (response.status === 404) return null;
  if (!response.ok) throw new Error(`public_professional_fetch_failed:${response.status}`);
  return unwrap(await response.json());
};

export const fetchProfessionalDirectory = cache(async (kind: ProfessionalKind, query: { pagina?: string; busca?: string; letra?: string }) => {
  const params = new URLSearchParams({ kind, page: /^\d+$/.test(text(query.pagina)) ? text(query.pagina) : '1', per_page: '30' });
  if (text(query.busca)) params.set('search', text(query.busca).slice(0, 100));
  if (/^[A-Z]$/.test(text(query.letra).toUpperCase())) params.set('letter', text(query.letra).toUpperCase());
  return parseProfessionalDirectory(await fetchJson('filters/professional-directory.php', params), kind);
});

export const fetchProfessionalDetail = cache(async (kind: ProfessionalKind, persistedSlug: string) => (
  parseProfessionalDetail(await fetchJson('filters/professional-taxonomy.php', new URLSearchParams({ kind, slug: persistedSlug })), kind)
));
