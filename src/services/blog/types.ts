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

export type BlogTaxonomyReference = {
  id: number | null;
  label: string;
  slug: string;
};

export type BlogCategory = BlogTaxonomyReference & {
  description?: string | null;
  imageUrl?: string | null;
  articleCount?: number;
};

export type BlogTagKind =
  | 'general'
  | 'topic'
  | 'region'
  | 'state'
  | 'career'
  | 'organization'
  | 'exam_board';

export type BlogTag = BlogTaxonomyReference & {
  kind: BlogTagKind;
  description?: string | null;
  imageUrl?: string | null;
  articleCount?: number;
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
  taxonomy: {
    category: BlogCategory;
    tags: BlogTag[];
  };
  author: BlogAuthor;
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
    total?: number;
  };
};

export type BlogArticleCardItem = Pick<BlogArticle,
  | 'id'
  | 'title'
  | 'slug'
  | 'excerpt'
  | 'readingMinutes'
  | 'coverImageUrl'
  | 'coverImageAlt'
  | 'featured'
  | 'publishedAt'
  | 'updatedAt'
  | 'taxonomy'
  | 'author'
  | 'engagement'
>;

export type PublicBlogTaxonomy = {
  id: number;
  type: 'category' | 'tag';
  label: string;
  slug: string;
  kind: BlogTagKind | null;
  description: string | null;
  imageUrl: string | null;
  articleCount: number;
  lastPublishedAt: string | null;
  canonicalPath: string;
  readiness: {
    status: 'READY' | 'NOT_READY';
    reasonCodes: string[];
  };
};

export type PublicBlogTaxonomyArchive = {
  taxonomy: PublicBlogTaxonomy;
  items: BlogArticleCardItem[];
  pageInfo: BlogPage['pageInfo'];
};

export type BlogArticleInput = {
  id?: number | null;
  title: string;
  slug?: string;
  excerpt: string;
  bodyHtml: string;
  taxonomy: {
    category: BlogTaxonomyReference | null;
    tags: BlogTag[];
  };
  coverImageUrl: string;
  coverImageAlt: string;
  status: BlogArticle['status'];
  featured: boolean;
  allowComments: boolean;
  sourceName?: string;
  sourceUrl?: string;
  scheduledAt?: string | null;
};
