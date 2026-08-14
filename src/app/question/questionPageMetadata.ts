import type { Metadata } from 'next';
import { buildAbsoluteUrl } from '@services/seo/slug';
import type { PublicQuestionRouteResolution } from './questionServerResolver';
import {
  buildQuestionKeywords,
  buildQuestionMetaDescription,
  buildQuestionMetaTitle,
} from './questionSeo';

export const buildQuestionMetadata = (
  resolution: PublicQuestionRouteResolution | null,
): Metadata => {
  const question = resolution?.question;
  if (!question) {
    return {
      title: 'Questão de concurso',
      description: 'Resolva questões de concursos por banca, órgão, cargo, ano e assunto no ConcursoMestre.',
      robots: { index: false, follow: true },
    };
  }

  const title = buildQuestionMetaTitle(question);
  const description = buildQuestionMetaDescription(question);
  const canonicalUrl = buildAbsoluteUrl(resolution.futurePath);
  return {
    title,
    description,
    keywords: buildQuestionKeywords(question),
    alternates: { canonical: canonicalUrl },
    openGraph: { title, description, type: 'article', url: canonicalUrl },
    twitter: { card: 'summary', title, description },
    robots: { index: true, follow: true },
  };
};
