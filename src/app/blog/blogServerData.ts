/*
* ----------------------------------------------------
* @author: 4quarenta
* @author URI: https://github.com/4quarenta
* @copyright: (c) 2026 ConcursoMestre. All rights reserved
* ----------------------------------------------------
*
* @since 1.0.0
*
*/

import { cache } from 'react';
import { resolveAbsoluteApiBaseUrl } from '@services/api/baseUrl';
import { ENDPOINTS } from '@services/api/endpoints';
import type { BlogArticle, BlogCategory, BlogPage, BlogTag } from '@services/blog';

export interface PublicExamDirectoryItem {
  id: number;
  title: string;
  slug: string;
  year: number;
  board: string | null;
  boardSlug: string | null;
  organizations: string[];
  questionCount: number;
  proofUrl: string | null;
  answerKeyUrl: string | null;
  stateCode: string | null;
  stateName: string;
  region: string;
}

export interface PublicExamDirectoryPage {
  items: PublicExamDirectoryItem[];
  pageInfo: {
    page: number;
    limit: number;
    totalItems: number;
    totalPages: number;
    hasPrevious: boolean;
    hasNext: boolean;
  };
  facets: {
    years: number[];
    regions: string[];
    states: Array<{ code: string; name: string }>;
  };
}

export interface PublicExamTaxonomy {
  id: number;
  name: string;
  slug: string;
}

export interface PublicExamFile {
  id: number;
  kind: string;
  label: string;
  name: string;
  url: string;
  mimeType: string;
  size: number | null;
}

export interface PublicExamDetail extends Omit<PublicExamDirectoryItem, 'board' | 'organizations'> {
  officialTitle: string | null;
  shortTitle: string | null;
  noticeNumber: string | null;
  level: string | null;
  registrationStart: string | null;
  registrationEnd: string | null;
  examDate: string | null;
  resultDate: string | null;
  vacancies: number | null;
  reserveVacancies: number | null;
  officialUrl: string | null;
  board: PublicExamTaxonomy | null;
  organizations: PublicExamTaxonomy[];
  roles: PublicExamTaxonomy[];
  careers: PublicExamTaxonomy[];
  areas: PublicExamTaxonomy[];
  subjects: PublicExamTaxonomy[];
  examTypes: PublicExamTaxonomy[];
  files: PublicExamFile[];
  relatedExams: PublicExamDirectoryItem[];
}

const apiBaseUrl = () => resolveAbsoluteApiBaseUrl(
  process.env.NEXT_PUBLIC_API_BASE_URL || process.env.API_BASE_URL || undefined,
);

const unwrap = (value: unknown): unknown => {
  if (!value || typeof value !== 'object') return value;
  return Object.prototype.hasOwnProperty.call(value, 'data')
    ? (value as { data?: unknown }).data
    : value;
};

const fetchPublic = async <T>(endpoint: string, params: Record<string, string> = {}): Promise<T | null> => {
  try {
    const url = new URL(endpoint, apiBaseUrl());
    Object.entries(params).forEach(([key, value]) => {
      if (value) url.searchParams.set(key, value);
    });
    const response = await fetch(url, {
      headers: { Accept: 'application/json' },
      cache: 'no-store',
    });
    if (!response.ok) return null;
    return unwrap(await response.json()) as T;
  } catch {
    return null;
  }
};

export const fetchBlogPageForServer = async (params: {
  category?: string;
  tag?: string;
  author?: string;
  featured?: boolean;
  cursor?: string;
  search?: string;
} = {}): Promise<BlogPage> => (
  await fetchPublic<BlogPage>(ENDPOINTS.blog.list, {
    ...(params.category ? { category: params.category } : {}),
    ...(params.tag ? { tag: params.tag } : {}),
    ...(params.author ? { author: params.author } : {}),
    ...(params.featured ? { featured: '1' } : {}),
    ...(params.cursor ? { cursor: params.cursor } : {}),
    ...(params.search ? { search: params.search } : {}),
    limit: '24',
  })
) || {
  items: [],
  pageInfo: { limit: 24, hasMore: false, nextCursor: null },
};

export const fetchBlogArticleForServer = cache(async (slug: string): Promise<BlogArticle | null> => (
  fetchPublic<BlogArticle>(ENDPOINTS.blog.detail, { slug })
));

export const fetchBlogCategoriesForServer = cache(async (): Promise<BlogCategory[]> => {
  const payload = await fetchPublic<{ items?: BlogCategory[] }>(ENDPOINTS.blog.categories);
  return Array.isArray(payload?.items) ? payload.items : [];
});

export const fetchBlogTagsForServer = cache(async (): Promise<BlogTag[]> => {
  const payload = await fetchPublic<{ items?: BlogTag[] }>(ENDPOINTS.blog.tags);
  return Array.isArray(payload?.items) ? payload.items : [];
});

export const fetchPublicExamDirectoryPageForServer = cache(async (params: {
  page?: number;
  limit?: number;
  year?: string;
  region?: string;
  state?: string;
} = {}): Promise<PublicExamDirectoryPage> => {
  const limit = Math.max(1, Math.min(48, params.limit || 12));
  const payload = await fetchPublic<Partial<PublicExamDirectoryPage>>(ENDPOINTS.exams.directory, {
    page: String(Math.max(1, params.page || 1)),
    limit: String(limit),
    ...(params.year ? { year: params.year } : {}),
    ...(params.region ? { region: params.region } : {}),
    ...(params.state ? { state: params.state } : {}),
  });
  return {
    items: Array.isArray(payload?.items) ? payload.items : [],
    pageInfo: {
      page: Number(payload?.pageInfo?.page) || 1,
      limit: Number(payload?.pageInfo?.limit) || limit,
      totalItems: Number(payload?.pageInfo?.totalItems) || 0,
      totalPages: Math.max(1, Number(payload?.pageInfo?.totalPages) || 1),
      hasPrevious: payload?.pageInfo?.hasPrevious === true,
      hasNext: payload?.pageInfo?.hasNext === true,
    },
    facets: {
      years: Array.isArray(payload?.facets?.years) ? payload.facets.years : [],
      regions: Array.isArray(payload?.facets?.regions) ? payload.facets.regions : [],
      states: Array.isArray(payload?.facets?.states) ? payload.facets.states : [],
    },
  };
});

export const fetchPublicExamDirectoryForServer = cache(async (limit = 24): Promise<PublicExamDirectoryItem[]> => (
  (await fetchPublicExamDirectoryPageForServer({ page: 1, limit })).items
));

export const fetchPublicExamDetailForServer = cache(async (slug: string): Promise<PublicExamDetail | null> => {
  const payload = await fetchPublic<{ exam?: PublicExamDetail }>(ENDPOINTS.exams.publicDetail, { slug });
  return payload?.exam && typeof payload.exam === 'object' ? payload.exam : null;
});
