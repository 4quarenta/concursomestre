import type { BlogArticle } from '@services/blog';

type BlogPublicationDates = Pick<BlogArticle, 'publishedAt'> & Partial<Pick<BlogArticle, 'createdAt'>>;

export const BLOG_TIME_ZONE = 'America/Sao_Paulo';

export const publicationValue = (article: BlogPublicationDates): string => (
  article.publishedAt || article.createdAt || ''
);

export const formatBlogDateTime = (value?: string | null, dateStyle: 'medium' | 'long' = 'medium'): string => {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat('pt-BR', {
    dateStyle,
    timeStyle: 'short',
    timeZone: BLOG_TIME_ZONE,
  }).format(date);
};

export const wasMeaningfullyUpdated = (article: BlogArticle): boolean => {
  const published = new Date(publicationValue(article)).getTime();
  const updated = new Date(article.updatedAt).getTime();
  return Number.isFinite(published) && Number.isFinite(updated) && updated - published > 60_000;
};

export const articlePopularity = (article: BlogArticle): number => (
  article.engagement.likesCount * 2 + article.engagement.commentsCount
);
