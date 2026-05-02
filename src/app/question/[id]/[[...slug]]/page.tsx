import type { Metadata } from 'next';
import type { Question } from '@types';
import { ENDPOINTS } from '@services/api/endpoints';
import { isQuestionPubliclyVisible, withQuestionPublicationAliases } from '@services/questions/questionPublication';
import { buildAbsoluteUrl, buildQuestionPath } from '@services/seo/slug';
import { normalizeSiteUrl } from '@/config/siteUrl';
import QuestionPublicPage from '../../QuestionPublicPage';
import {
  buildQuestionKeywords,
  buildQuestionMetaDescription,
  buildQuestionMetaTitle,
} from '../../questionSeo';

type QuestionPageParams = {
  id?: string;
  slug?: string[];
};

const readEnv = (key: string) => {
  const value = process.env[key];
  return typeof value === 'string' ? value.trim() : '';
};

const getApiBaseUrl = () => normalizeSiteUrl(
  readEnv('NEXT_PUBLIC_API_BASE_URL') || readEnv('API_BASE_URL') || 'http://localhost/questao-pro-backend/api/',
  'http://localhost/questao-pro-backend/api/',
);

const readEnvelopeData = (payload: any) => {
  if (payload && typeof payload === 'object' && Object.prototype.hasOwnProperty.call(payload, 'data')) {
    return payload.data;
  }

  return payload;
};

const readQuestionPayload = (payload: any): Question | null => {
  const data = readEnvelopeData(payload);
  const question = Array.isArray(data)
    ? data[0]
    : data?.question || data?.row || data?.item || data;

  if (!question || typeof question !== 'object') {
    return null;
  }

  return withQuestionPublicationAliases(question) as Question;
};

const fetchQuestionForPage = async (id?: string): Promise<Question | null> => {
  const questionId = String(id || '').trim();
  if (!questionId) return null;

  try {
    const url = new URL(ENDPOINTS.questions.show, getApiBaseUrl());
    url.searchParams.set('id', questionId);

    const response = await fetch(url.toString(), {
      cache: 'no-store',
      headers: {
        Accept: 'application/json',
      },
    });

    if (!response.ok) {
      return null;
    }

    const question = readQuestionPayload(await response.json());
    if (!question || !isQuestionPubliclyVisible(question)) {
      return null;
    }

    return question;
  } catch {
    return null;
  }
};

export async function generateMetadata({ params }: { params: Promise<QuestionPageParams> }): Promise<Metadata> {
  const resolvedParams = await params;
  const question = await fetchQuestionForPage(resolvedParams.id);

  if (!question) {
    return {
      title: 'Questão de concurso',
      description: 'Resolva questões de concursos por banca, órgão, cargo, ano e assunto no ConcursoMestre.',
      robots: {
        index: false,
        follow: true,
      },
    };
  }

  const title = buildQuestionMetaTitle(question);
  const description = buildQuestionMetaDescription(question);
  const canonicalPath = buildQuestionPath(question);
  const canonicalUrl = buildAbsoluteUrl(canonicalPath);

  return {
    title,
    description,
    keywords: buildQuestionKeywords(question),
    alternates: {
      canonical: canonicalUrl,
    },
    openGraph: {
      title,
      description,
      type: 'article',
      url: canonicalUrl,
    },
    twitter: {
      card: 'summary',
      title,
      description,
    },
    robots: {
      index: true,
      follow: true,
    },
  };
}

export default async function Page({ params }: { params: Promise<QuestionPageParams> }) {
  const resolvedParams = await params;
  const initialQuestion = await fetchQuestionForPage(resolvedParams.id);

  return <QuestionPublicPage initialQuestion={initialQuestion} />;
}
