import { cache } from 'react';
import type { Question } from '@types';
import { ENDPOINTS } from '@services/api/endpoints';
import { resolveAbsoluteApiBaseUrl } from '@services/api/baseUrl';
import { isQuestionPubliclyVisible, withQuestionPublicationAliases } from '@services/questions/questionPublication';
import { publicRoutes } from '@services/routes/publicRoutes';
import { getQuestionSeoLabel } from '@services/seo/slug';
import { buildContractSlugV1 } from '@services/seo/slugContract';
import { parseSeoEnvelopeShadow, seoEnvelopeFields } from '@services/seo/seoEnvelope';

const readEnv = (key: string) => {
  const value = process.env[key];
  return typeof value === 'string' ? value.trim() : '';
};

const getApiBaseUrl = () => resolveAbsoluteApiBaseUrl(
  readEnv('NEXT_PUBLIC_API_BASE_URL') || readEnv('API_BASE_URL') || undefined,
);

const readEnvelopeData = (payload: unknown): unknown => {
  if (payload && typeof payload === 'object' && Object.prototype.hasOwnProperty.call(payload, 'data')) {
    return (payload as { data?: unknown }).data;
  }
  return payload;
};

export const readPublicQuestionPayload = (payload: unknown): Question | null => {
  const data = readEnvelopeData(payload);
  const dataRecord = data && typeof data === 'object' ? data as Record<string, unknown> : {};
  const question = Array.isArray(data)
    ? data[0]
    : dataRecord.question || dataRecord.row || dataRecord.item || data;

  if (!question || typeof question !== 'object') {
    return null;
  }

  const record = question as Record<string, unknown>;
  const envelope = parseSeoEnvelopeShadow(record, {
    expectedResourceType: 'question',
    expectedResourceId: record.id as string | number | null | undefined,
    source: 'question.server.readPublicQuestionPayload',
  });

  return withQuestionPublicationAliases({
    ...record,
    ...seoEnvelopeFields(envelope.envelope),
  });
};

const shadowCanonicalPath = (question: Question): string | null => {
  const decision = (question as unknown as Record<string, unknown>).seoDecision;
  if (!decision || typeof decision !== 'object') return null;
  const canonical = (decision as Record<string, unknown>).canonical;
  if (!canonical || typeof canonical !== 'object') return null;
  const path = (canonical as Record<string, unknown>).path;
  return typeof path === 'string' && path.startsWith('/') ? path : null;
};

export type PublicQuestionRouteResolution = {
  question: Question;
  futurePath: string;
  futureSlug: string;
  shadowCanonicalPath: string | null;
  shadowCanonicalMatchesFutureRoute: boolean | null;
};

export const resolvePublicQuestionRouteFromQuestion = (
  question: Question,
): PublicQuestionRouteResolution => {
  const id = String(question.id || '').trim();
  if (!id) {
    throw new Error('Questao publica sem identidade para resolver a rota.');
  }

  const futureSlug = buildContractSlugV1(getQuestionSeoLabel(question), {
    type: 'questao',
    id,
  });
  const futurePath = publicRoutes.questions.detail(id, futureSlug);
  const reportedCanonicalPath = shadowCanonicalPath(question);

  return {
    question,
    futurePath,
    futureSlug,
    shadowCanonicalPath: reportedCanonicalPath,
    shadowCanonicalMatchesFutureRoute: reportedCanonicalPath === null
      ? null
      : reportedCanonicalPath === futurePath,
  };
};

export const fetchPublicQuestionRoute = cache(async (
  id?: string,
): Promise<PublicQuestionRouteResolution | null> => {
  const questionId = String(id || '').trim();
  if (!questionId) return null;

  try {
    const url = new URL(ENDPOINTS.questions.show, getApiBaseUrl());
    url.searchParams.set('id', questionId);

    const response = await fetch(url.toString(), {
      next: { revalidate: 300 },
      headers: { Accept: 'application/json' },
    });
    if (!response.ok) return null;

    const question = readPublicQuestionPayload(await response.json());
    if (!question || !isQuestionPubliclyVisible(question)) return null;
    return resolvePublicQuestionRouteFromQuestion(question);
  } catch {
    return null;
  }
});
