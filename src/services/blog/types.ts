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

export type BlogCategory = {
  id: number;
  name: string;
  slug: string;
  description?: string | null;
  imageUrl?: string | null;
  articleCount?: number;
};

export type BlogTag = {
  id: number;
  name: string;
  slug: string;
};

export type BlogAuthor = {
  id: string;
  name: string;
  avatarUrl?: string | null;
  role: string;
};

export type BlogArticle = {
  id: number;
  title: string;
  slug: string;
  excerpt: string;
  readingMinutes: number;
  bodyHtml?: string;
  bodyText?: string;
  coverImageUrl: string;
  coverImageAlt: string;
  status: 'draft' | 'scheduled' | 'published' | 'archived';
  featured: boolean;
  allowComments: boolean;
  sourceName?: string | null;
  sourceUrl?: string | null;
  seoTitle?: string | null;
  seoDescription?: string | null;
  canonicalUrl?: string | null;
  scheduledAt?: string | null;
  publishedAt?: string | null;
  createdAt: string;
  updatedAt: string;
  category: BlogCategory;
  author: BlogAuthor;
  tags: BlogTag[];
  engagement: {
    likesCount: number;
    commentsCount: number;
    isLiked: boolean;
  };
};

export type BlogPage = {
  items: BlogArticle[];
  pageInfo: {
    limit: number;
    hasMore: boolean;
    nextCursor: string | null;
  };
};

export type BlogArticleInput = {
  id?: number | null;
  title: string;
  slug?: string;
  excerpt: string;
  bodyHtml: string;
  categoryId?: number | null;
  categoryName?: string;
  coverImageUrl: string;
  coverImageAlt: string;
  status: BlogArticle['status'];
  featured: boolean;
  allowComments: boolean;
  sourceName?: string;
  sourceUrl?: string;
  seoTitle?: string;
  seoDescription?: string;
  canonicalUrl?: string;
  scheduledAt?: string | null;
  tags: string[];
};
