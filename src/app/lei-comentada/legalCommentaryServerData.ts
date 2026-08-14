import { cache } from 'react';
import { resolveAbsoluteApiBaseUrl } from '@services/api/baseUrl';
import { ENDPOINTS } from '@services/api/endpoints';
import type { LawDetail, LegalHomeSnapshot } from '@types';
import { withValidatedSeoEnvelopeShadow } from '@services/seo/seoEnvelope';

type FetchLike = typeof fetch;

export const EMPTY_LEGAL_HOME_SNAPSHOT: LegalHomeSnapshot = {
  areas: [],
  lawsByArea: [],
  mostAccessed: [],
  favoriteLaws: [],
  favoriteItems: [],
  recentlyStudied: [],
  recentlyUpdated: [],
  totals: {
    laws: 0,
    articles: 0,
    commentedArticles: 0,
    updatedRecently: 0,
  },
};

const readEnv = (key: string): string => {
  const value = process.env[key];
  return typeof value === 'string' ? value.trim() : '';
};

const getApiBaseUrl = (): string => resolveAbsoluteApiBaseUrl(
  readEnv('NEXT_PUBLIC_API_BASE_URL') || readEnv('API_BASE_URL') || undefined,
);

const unwrapApiData = (payload: unknown): unknown => {
  if (!payload || typeof payload !== 'object') return payload;
  const record = payload as Record<string, unknown>;
  return Object.prototype.hasOwnProperty.call(record, 'data') ? record.data : payload;
};

const isLegalHomeSnapshot = (value: unknown): value is LegalHomeSnapshot => {
  if (!value || typeof value !== 'object') return false;
  const record = value as Record<string, unknown>;
  return Array.isArray(record.areas) && Array.isArray(record.lawsByArea);
};

const isLawDetail = (value: unknown): value is LawDetail => {
  if (!value || typeof value !== 'object') return false;
  const record = value as Record<string, unknown>;
  return Boolean(String(record.id || '').trim())
    && Boolean(String(record.slug || '').trim())
    && Array.isArray(record.articles);
};

const fetchPublicJson = async (url: URL, fetchImpl: FetchLike): Promise<unknown> => {
  const response = await fetchImpl(url, {
    headers: { Accept: 'application/json' },
    next: { revalidate: 300 },
  });

  if (!response.ok) return null;
  return unwrapApiData(await response.json());
};

export const buildLegalHomeServerUrl = (apiBaseUrl = getApiBaseUrl()): URL => (
  new URL(ENDPOINTS.legalCommentary.list, apiBaseUrl)
);

export const buildLawDetailServerUrl = (
  slug: string,
  apiBaseUrl = getApiBaseUrl(),
): URL => {
  const url = new URL(ENDPOINTS.legalCommentary.detail, apiBaseUrl);
  url.searchParams.set('slug', String(slug || '').trim());
  return url;
};

export const fetchLegalHomeSnapshot = async ({
  fetchImpl = fetch,
  apiBaseUrl,
}: {
  fetchImpl?: FetchLike;
  apiBaseUrl?: string;
} = {}): Promise<LegalHomeSnapshot> => {
  try {
    const payload = await fetchPublicJson(buildLegalHomeServerUrl(apiBaseUrl), fetchImpl);
    return isLegalHomeSnapshot(payload) ? payload : EMPTY_LEGAL_HOME_SNAPSHOT;
  } catch {
    return EMPTY_LEGAL_HOME_SNAPSHOT;
  }
};

const fetchLawDetailUncached = async (
  slug: string,
  fetchImpl: FetchLike = fetch,
  apiBaseUrl?: string,
): Promise<LawDetail | null> => {
  const normalizedSlug = String(slug || '').trim();
  if (!normalizedSlug) return null;

  try {
    const payload = await fetchPublicJson(buildLawDetailServerUrl(normalizedSlug, apiBaseUrl), fetchImpl);
    if (!isLawDetail(payload)) return null;
    return withValidatedSeoEnvelopeShadow(payload as LawDetail & Record<string, unknown>, {
      expectedResourceType: 'law',
      expectedResourceId: payload.id,
      source: 'legalCommentaryServerData.fetchLawDetail',
    });
  } catch {
    return null;
  }
};

export const fetchLawDetailForServer = cache((slug: string): Promise<LawDetail | null> => (
  fetchLawDetailUncached(slug)
));

export const fetchLawDetailForServerTest = fetchLawDetailUncached;
