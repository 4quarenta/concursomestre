import { cache } from 'react';
import { resolveAbsoluteApiBaseUrl } from '@services/api/baseUrl';
import { publicRoutes } from '@services/routes/publicRoutes';
import type { Material } from '@types';

type RecordValue = Record<string, unknown>;
const record = (value: unknown): value is RecordValue => Boolean(value) && typeof value === 'object' && !Array.isArray(value);
const text = (value: unknown) => typeof value === 'string' ? value.trim() : '';
const nullableText = (value: unknown) => text(value) || null;
const integer = (value: unknown) => Math.max(0, Math.trunc(Number(value) || 0));
const slug = (value: unknown) => /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(text(value)) && text(value).length <= 190 ? text(value) : '';
const privateHost = (host: string) => host === 'localhost' || host.endsWith('.localhost')
  || /^(?:127\.|10\.|192\.168\.|169\.254\.)/.test(host)
  || /^172\.(?:1[6-9]|2\d|3[01])\./.test(host)
  || host === '::1' || /^(?:fc|fd|fe80):/i.test(host);
const safeUrl = (value: unknown) => {
  const candidate = text(value);
  try {
    const parsed = new URL(candidate);
    if (parsed.protocol !== 'https:' || parsed.username || parsed.password || privateHost(parsed.hostname.toLowerCase())) return null;
    if ([...parsed.searchParams.keys()].some((key) => /^(?:token|signature|credential|secret|key|x-amz-)/i.test(key))) return null;
    return candidate;
  } catch { return null; }
};
const unwrap = (value: unknown): unknown => record(value) && 'data' in value ? value.data : value;
const list = <T>(value: unknown, mapper: (item: RecordValue) => T | null): T[] => Array.isArray(value)
  ? value.filter(record).map(mapper).filter((item): item is T => item !== null) : [];

export type PublicMaterialOffer = {
  mode: 'free' | 'paid' | 'included_in_plan' | 'unavailable' | 'not_for_sale';
  amountMinor: number | null;
  currency: string | null;
  available: boolean;
};
export type PublicMaterialSummary = {
  id: string; slug: string; title: string; description: string | null; format: string | null;
  pageCount: number | null; year: number | null; publicAuthorName: string | null;
  coverUrl: string | null; previewUrl: string | null; hasAsset: boolean; offer: PublicMaterialOffer;
  path: string; updatedAt: string | null;
};
export type PublicMaterialDirectory = {
  items: PublicMaterialSummary[];
  pageInfo: { page: number; pages: number; limit: number; total: number };
  scope: 'materials' | 'marketplace';
};
export type PublicMaterialDetail = PublicMaterialSummary & {
  canonicalPath: string; marketplacePath: '/marketplace';
  taxonomies: Array<{ id: number; slug: string; name: string; relationType: 'discipline' | 'topic'; path: string }>;
  breadcrumbs: Array<{ label: string; canonicalPath: string }>;
  readiness: { status: 'READY' | 'NOT_READY'; reasonCodes: string[] };
  listingReadiness: { status: 'READY' | 'NOT_READY'; reasonCodes: string[] };
};

const offer = (value: unknown): PublicMaterialOffer | null => {
  if (!record(value)) return null;
  const mode = text(value.mode);
  if (!['free', 'paid', 'included_in_plan', 'unavailable', 'not_for_sale'].includes(mode)) return null;
  const currency = nullableText(value.currency);
  return { mode: mode as PublicMaterialOffer['mode'], amountMinor: value.amountMinor == null ? null : integer(value.amountMinor), currency, available: value.available === true };
};
const summary = (value: RecordValue): PublicMaterialSummary | null => {
  const id = text(value.id); const persistedSlug = slug(value.slug); const title = text(value.title); const path = text(value.path); const publicOffer = offer(value.offer);
  if (!id || !persistedSlug || !title || path !== publicRoutes.materials.detail(persistedSlug) || !publicOffer) return null;
  return {
    id, slug: persistedSlug, title, path, offer: publicOffer, description: nullableText(value.description), format: nullableText(value.format),
    pageCount: value.pageCount == null ? null : integer(value.pageCount), year: value.year == null ? null : integer(value.year),
    publicAuthorName: nullableText(value.publicAuthorName), coverUrl: safeUrl(value.coverUrl), previewUrl: safeUrl(value.previewUrl),
    hasAsset: value.hasAsset === true, updatedAt: nullableText(value.updatedAt),
  };
};
const readiness = (value: unknown) => {
  if (!record(value) || value.status !== 'READY') return { status: 'NOT_READY' as const, reasonCodes: record(value) && Array.isArray(value.reasonCodes) ? value.reasonCodes.map(text).filter(Boolean) : ['instance_readiness.not_evaluated'] };
  return { status: 'READY' as const, reasonCodes: [] as string[] };
};

export const parsePublicMaterialDirectory = (value: unknown): PublicMaterialDirectory => {
  if (!record(value)) throw new Error('public_material_directory_contract_invalid');
  const pageInfo = record(value.pageInfo) ? value.pageInfo : {}; const scope = value.scope === 'marketplace' ? 'marketplace' : 'materials';
  return { items: list(value.items, summary), pageInfo: { page: Math.max(1, integer(pageInfo.page)), pages: Math.max(1, integer(pageInfo.pages)), limit: integer(pageInfo.limit), total: integer(pageInfo.total) }, scope };
};
export const parsePublicMaterialDetail = (value: unknown): PublicMaterialDetail | { redirectSlug: string } | null => {
  if (!record(value)) return null; const redirectSlug = slug(value.redirectSlug); if (redirectSlug) return { redirectSlug };
  const base = summary({ ...value, path: value.canonicalPath }); if (!base || text(value.canonicalPath) !== base.path) return null;
  return { ...base, canonicalPath: base.path, marketplacePath: '/marketplace',
    taxonomies: list(value.taxonomies, (item) => { const id = integer(item.id); const persistedSlug = slug(item.slug); const relationType = text(item.relationType); const path = text(item.path); return id && persistedSlug && text(item.name) && ['discipline', 'topic'].includes(relationType) ? { id, slug: persistedSlug, name: text(item.name), relationType: relationType as 'discipline' | 'topic', path } : null; }),
    breadcrumbs: list(value.breadcrumbs, (item) => text(item.label) && text(item.canonicalPath) ? { label: text(item.label), canonicalPath: text(item.canonicalPath) } : null),
    readiness: readiness(value.readiness), listingReadiness: readiness(value.listingReadiness),
  };
};

const apiBase = () => resolveAbsoluteApiBaseUrl(process.env.NEXT_PUBLIC_API_BASE_URL || process.env.API_BASE_URL || undefined);
const fetchJson = async (path: string, params: URLSearchParams): Promise<unknown> => {
  const url = new URL(path, apiBase()); url.search = params.toString();
  const response = await fetch(url.toString(), { headers: { Accept: 'application/json' }, next: { revalidate: 300 } });
  if (response.status === 404) return null;
  if (!response.ok) throw new Error(`public_material_fetch_failed:${response.status}`);
  return unwrap(await response.json());
};
export const fetchPublicMaterialDirectory = cache(async (query: { pagina?: string; busca?: string }, scope: 'materials' | 'marketplace' = 'materials') => {
  const params = new URLSearchParams({ page: /^\d+$/.test(text(query.pagina)) ? text(query.pagina) : '1', scope });
  if (text(query.busca)) params.set('search', text(query.busca).slice(0, 120));
  return parsePublicMaterialDirectory(await fetchJson('materials/public-directory.php', params));
});
export const fetchPublicMaterialDetail = cache(async (persistedSlug: string) => parsePublicMaterialDetail(await fetchJson('materials/public-detail.php', new URLSearchParams({ slug: persistedSlug }))));
export const fetchLegacyMaterialSlug = cache(async (id: string) => {
  const value = await fetchJson('materials/public-legacy.php', new URLSearchParams({ id }));
  return record(value) ? slug(value.redirectSlug) || null : null;
});

export const toMarketplaceMaterial = (item: PublicMaterialSummary): Material => ({
  id: item.id, slug: item.slug, canonicalPath: item.path, title: item.title, description: item.description || '', details: item.description || undefined,
  authorId: '', authorName: item.publicAuthorName || 'ConcursoMestre', publicAuthorName: item.publicAuthorName || undefined,
  price: item.offer.amountMinor == null ? 0 : item.offer.amountMinor / 100, offerMode: item.offer.mode, currency: item.offer.currency || undefined,
  type: (['PDF', 'Simulado', 'Resumo'].includes(item.format || '') ? item.format : 'PDF') as Material['type'],
  subject: '', pageCount: item.pageCount || undefined, year: item.year || undefined, coverUrl: item.coverUrl || undefined,
  previewUrl: item.previewUrl || undefined, hasFile: item.hasAsset, status: 'approved', salesCount: 0, rating: 0,
  createdAt: item.updatedAt ? Date.parse(item.updatedAt) || 0 : 0, comments: [],
});
