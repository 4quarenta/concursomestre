import { cache } from 'react';
import { resolveAbsoluteApiBaseUrl } from '@services/api/baseUrl';
import { ENDPOINTS } from '@services/api/endpoints';
import { officialOrganizationLogoPath } from './officialOrganizationLogos';
import type {
  LandingFeaturedOrganization,
  LandingFeaturedOrganizationStatus,
} from '@types';

export type HomeFeaturedOrganization = {
  id: number;
  filterId: number;
  name: string;
  slug: string;
  acronym: string | null;
  description: string | null;
  imageUrl: string | null;
  status: LandingFeaturedOrganizationStatus;
  statusLabel: string;
  iconKey: LandingFeaturedOrganization['iconKey'];
};

export type HomeLatestArticle = {
  id: number;
  title: string;
  slug: string;
  excerpt: string;
  coverImageUrl: string;
  coverImageAlt: string;
  publishedAt: string | null;
  updatedAt: string | null;
  taxonomy: { category: { label: string } };
};

const STATUS_LABELS: Record<LandingFeaturedOrganizationStatus, string> = {
  FEATURED: 'Em destaque',
  OPEN_NOTICE: 'Edital publicado',
  COMING_SOON: 'Em breve',
  LONG_TERM: 'Planejamento',
};

const unwrap = (value: unknown): unknown => (
  value && typeof value === 'object' && Object.prototype.hasOwnProperty.call(value, 'data')
    ? (value as { data?: unknown }).data
    : value
);

const fetchHomeJson = async (path: string, params: Record<string, string> = {}): Promise<unknown> => {
  try {
    const url = new URL(path, resolveAbsoluteApiBaseUrl(
      process.env.NEXT_PUBLIC_API_BASE_URL || process.env.API_BASE_URL || undefined,
    ));
    Object.entries(params).forEach(([key, value]) => url.searchParams.set(key, value));
    const response = await fetch(url, {
      headers: { Accept: 'application/json' },
      next: { revalidate: 300, tags: ['home-seo'] },
    });
    return response.ok ? unwrap(await response.json()) : null;
  } catch {
    return null;
  }
};

export const resolveHomeFeaturedOrganizations = (
  configured: LandingFeaturedOrganization[],
  items: Array<Record<string, unknown>>,
): HomeFeaturedOrganization[] => {
  const active = configured
    .filter((item) => item.enabled && Number.isInteger(Number(item.filterId)) && Number(item.filterId) > 0)
    .sort((left, right) => left.order - right.order || left.filterId - right.filterId)
    .slice(0, 6);
  const byId = new Map(items.map((item) => [Number(item.id), item]));

  return active.flatMap((config) => {
    const item = byId.get(Number(config.filterId));
    const id = Number(item?.id || 0);
    const slug = String(item?.slug || '').trim();
    const name = String(item?.name || '').trim();
    if (id <= 0 || !slug || !name) return [];
    return [{
      id,
      filterId: id,
      name,
      slug,
      acronym: item?.acronym ? String(item.acronym).trim() : null,
      description: item?.description ? String(item.description).trim() : null,
      imageUrl: officialOrganizationLogoPath(slug) || safeOrganizationImageUrl(item?.imageUrl),
      status: config.status,
      statusLabel: STATUS_LABELS[config.status],
      iconKey: config.iconKey,
    }];
  });
};

const safeHomeImageUrl = (value: unknown): string => {
  const candidate = String(value || '').trim();
  if (candidate.startsWith('/blog/') || candidate.startsWith('/uploads/')) return candidate;
  try {
    const url = new URL(candidate);
    if (url.protocol !== 'https:' || url.username || url.password) return '';
    return url.toString();
  } catch {
    return '';
  }
};

const safeOrganizationImageUrl = (value: unknown): string | null => {
  const candidate = String(value || '').trim();
  const isCanonicalTaxonomyLogo = /^\/uploads\/admin-assets\/taxonomy-logo\/[A-Za-z0-9][A-Za-z0-9._-]*\.(?:avif|gif|jpe?g|png|webp)$/i.test(candidate);
  return candidate.startsWith('/assets/organizations/')
    || candidate.startsWith('/uploads/organizations/')
    || isCanonicalTaxonomyLogo
    ? candidate
    : null;
};

export const fetchLatestPublicArticlesForHome = cache(async (): Promise<HomeLatestArticle[]> => {
  const data = await fetchHomeJson(ENDPOINTS.blog.list, { limit: '6', published_only: '1' });
  const items = data && typeof data === 'object' && Array.isArray((data as { items?: unknown[] }).items)
    ? (data as { items: Array<Record<string, unknown>> }).items
    : [];
  return items.flatMap((article) => {
    const taxonomy = article.taxonomy && typeof article.taxonomy === 'object'
      ? article.taxonomy as { category?: unknown }
      : {};
    const category = taxonomy.category && typeof taxonomy.category === 'object'
      ? taxonomy.category as { label?: unknown }
      : {};
    const id = Number(article.id);
    const slug = String(article.slug || '').trim();
    const title = String(article.title || '').trim();
    if (id <= 0 || !slug || !title) return [];
    return [{
      id,
      title,
      slug,
      excerpt: String(article.excerpt || '').trim(),
      coverImageUrl: safeHomeImageUrl(article.coverImageUrl),
      coverImageAlt: String(article.coverImageAlt || 'Noticia do ConcursoMestre').trim(),
      publishedAt: article.publishedAt ? String(article.publishedAt) : null,
      updatedAt: article.updatedAt ? String(article.updatedAt) : null,
      taxonomy: { category: { label: String(category.label || 'Notícias').trim() } },
    }];
  }).slice(0, 6);
});

export const fetchFeaturedOrganizationsForHome = cache(async (
  configured: LandingFeaturedOrganization[] = [],
): Promise<HomeFeaturedOrganization[]> => {
  const active = configured
    .filter((item) => item.enabled && Number.isInteger(Number(item.filterId)) && Number(item.filterId) > 0)
    .sort((left, right) => left.order - right.order || left.filterId - right.filterId)
    .slice(0, 6);
  if (active.length === 0) return [];

  const data = await fetchHomeJson(ENDPOINTS.filters.featuredOrganizations, {
    filter_ids: active.map((item) => String(item.filterId)).join(','),
  });
  const items = data && typeof data === 'object' && Array.isArray((data as { items?: unknown[] }).items)
    ? (data as { items: Array<Record<string, unknown>> }).items
    : [];
  return resolveHomeFeaturedOrganizations(active, items);
});

export const fetchHomeSeoDataForServer = async (configured: LandingFeaturedOrganization[] = []) => {
  const [latestArticles, featuredOrganizations] = await Promise.all([
    fetchLatestPublicArticlesForHome(),
    fetchFeaturedOrganizationsForHome(configured),
  ]);
  return { latestArticles, featuredOrganizations };
};
