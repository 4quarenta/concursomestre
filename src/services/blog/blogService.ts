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

import { apiClient, assertApiSuccess, ENDPOINTS, readApiData } from '@services/api';
import type { ApiResponse } from '@services/api';
import type { BlogArticle, BlogArticleInput, BlogCategory, BlogPage } from './types';

export const blogService = {
  async list(params: Record<string, string | number | boolean | undefined> = {}): Promise<BlogPage> {
    const response = await apiClient.get<ApiResponse<BlogPage>>(ENDPOINTS.blog.list, { params });
    return readApiData(response, {
      items: [],
      pageInfo: { limit: 12, hasMore: false, nextCursor: null },
    });
  },

  async detail(slug: string): Promise<BlogArticle> {
    const response = await apiClient.get<ApiResponse<BlogArticle>>(ENDPOINTS.blog.detail, {
      params: { slug },
    });
    assertApiSuccess(response, 'Nao foi possivel carregar a noticia.');
    return readApiData(response, {} as BlogArticle);
  },

  async categories(): Promise<BlogCategory[]> {
    const response = await apiClient.get<ApiResponse<{ items: BlogCategory[] }>>(ENDPOINTS.blog.categories);
    return readApiData(response, { items: [] }).items || [];
  },

  async toggleLike(articleId: number): Promise<{ liked: boolean; likesCount: number }> {
    const response = await apiClient.post<ApiResponse<{ liked: boolean; likesCount: number }>>(
      ENDPOINTS.blog.like,
      { articleId },
    );
    assertApiSuccess(response, 'Nao foi possivel curtir a noticia.');
    return readApiData(response, { liked: false, likesCount: 0 });
  },

  async adminList(params: Record<string, string | number | undefined> = {}): Promise<BlogPage> {
    const response = await apiClient.get<ApiResponse<BlogPage>>(ENDPOINTS.blog.adminList, { params });
    assertApiSuccess(response, 'Nao foi possivel listar os artigos.');
    return readApiData(response, {
      items: [],
      pageInfo: { limit: 30, hasMore: false, nextCursor: null },
    });
  },

  async adminDetail(id: number): Promise<BlogArticle> {
    const response = await apiClient.get<ApiResponse<BlogArticle>>(ENDPOINTS.blog.adminDetail, {
      params: { id },
    });
    assertApiSuccess(response, 'Nao foi possivel carregar o artigo.');
    return readApiData(response, {} as BlogArticle);
  },

  async save(input: BlogArticleInput): Promise<BlogArticle> {
    const response = await apiClient.post<ApiResponse<BlogArticle>>(ENDPOINTS.blog.adminSave, input);
    assertApiSuccess(response, 'Nao foi possivel salvar o artigo.');
    return readApiData(response, {} as BlogArticle);
  },

  async archive(id: number): Promise<void> {
    const response = await apiClient.post<ApiResponse>(ENDPOINTS.blog.adminDelete, { id });
    assertApiSuccess(response, 'Nao foi possivel arquivar o artigo.');
  },

  async createCategory(name: string): Promise<BlogCategory> {
    const response = await apiClient.post<ApiResponse<BlogCategory>>(ENDPOINTS.blog.adminCategories, { name });
    assertApiSuccess(response, 'Nao foi possivel salvar a categoria.');
    return readApiData(response, {} as BlogCategory);
  },
};
