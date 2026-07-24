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
import type { BlogArticle, BlogCategory, BlogPage } from '@services/blog';

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
      next: { revalidate: 300 },
    });
    if (!response.ok) return null;
    return unwrap(await response.json()) as T;
  } catch {
    return null;
  }
};

export const fetchBlogPageForServer = async (params: {
  category?: string;
  author?: string;
  featured?: boolean;
  cursor?: string;
} = {}): Promise<BlogPage> => (
  await fetchPublic<BlogPage>(ENDPOINTS.blog.list, {
    ...(params.category ? { category: params.category } : {}),
    ...(params.author ? { author: params.author } : {}),
    ...(params.featured ? { featured: '1' } : {}),
    ...(params.cursor ? { cursor: params.cursor } : {}),
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
