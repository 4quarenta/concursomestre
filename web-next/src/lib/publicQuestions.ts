import type { Metadata } from 'next';
import { safeServerFetch } from '@/lib/api';
import type { Question } from '@/types';
import { buildAbsoluteUrl, buildQuestionPath, getQuestionSeoLabel, summarizeSeoText } from '@/services/seo/slug';

export const loadPublicQuestionById = async (id: string): Promise<Question | null> => {
  const question = await safeServerFetch<Question | null>(`questions/show.php?id=${encodeURIComponent(id)}`, null);

  if (!question || !question.id || !question.enunciado) {
    return null;
  }

  return question;
};

export const buildQuestionMetadata = (question: Question): Metadata => {
  const canonicalPath = buildQuestionPath(question);
  const seoLabel = getQuestionSeoLabel(question);
  const title = `${summarizeSeoText(seoLabel, 60)} | ConcursoMestre`;
  const description = summarizeSeoText(seoLabel, 160);

  return {
    title: {
      absolute: title,
    },
    description,
    alternates: {
      canonical: canonicalPath,
    },
    openGraph: {
      title: summarizeSeoText(seoLabel, 95),
      description: summarizeSeoText(seoLabel, 180),
      type: 'article',
      url: buildAbsoluteUrl(canonicalPath),
    },
  };
};
