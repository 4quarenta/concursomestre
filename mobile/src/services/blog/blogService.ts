import { apiClient } from "@/services/api/client";
import { ENDPOINTS } from "@/services/api/endpoints";
import {
  assertApiSuccess,
  readApiData,
  readApiErrorMessage,
} from "@/services/api/response";

export type MobileBlogArticle = {
  id: number;
  title: string;
  slug: string;
  excerpt: string;
  readingMinutes: number;
  bodyHtml?: string;
  bodyText?: string;
  allowComments: boolean;
  publishedAt?: string | null;
  author?: { name?: string };
  taxonomy?: { category?: { label?: string } };
  engagement: {
    likesCount: number;
    commentsCount: number;
    isLiked: boolean;
  };
};

export type MobileBlogPage = {
  items: MobileBlogArticle[];
  pageInfo?: { total?: number; hasMore?: boolean; nextCursor?: string | null };
};

export const blogService = {
  async list(): Promise<MobileBlogPage> {
    try {
      const response = await apiClient.get<any>(ENDPOINTS.blog.list, {
        params: { limit: 30 },
      });
      return readApiData<MobileBlogPage>(response, { items: [] });
    } catch (error) {
      throw new Error(readApiErrorMessage(error, "Nao foi possivel carregar as noticias."));
    }
  },

  async detail(slug: string): Promise<MobileBlogArticle> {
    try {
      const response = await apiClient.get<any>(ENDPOINTS.blog.detail, {
        params: { slug },
      });
      assertApiSuccess(response, "Nao foi possivel carregar a noticia.");
      return readApiData<MobileBlogArticle>(response, {} as MobileBlogArticle);
    } catch (error) {
      throw new Error(readApiErrorMessage(error, "Nao foi possivel carregar a noticia."));
    }
  },

  async toggleLike(articleId: number): Promise<{ liked: boolean; likesCount: number }> {
    try {
      const response = await apiClient.post<any>(ENDPOINTS.blog.like, { articleId });
      assertApiSuccess(response, "Nao foi possivel curtir a noticia.");
      return readApiData(response, { liked: false, likesCount: 0 });
    } catch (error) {
      throw new Error(readApiErrorMessage(error, "Nao foi possivel curtir a noticia."));
    }
  },
};

export default blogService;
