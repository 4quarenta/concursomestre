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

const getBrowserApiBaseUrl = () => {
  const baseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost/questao-pro-backend/api/';
  return baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`;
};

const getBrowserBackendRoot = () => getBrowserApiBaseUrl().replace(/\/api\/?$/, '');

export class ApiRequestError extends Error {
  status: number;
  payload: unknown;

  constructor(message: string, status: number, payload: unknown) {
    super(message);
    this.name = 'ApiRequestError';
    this.status = status;
    this.payload = payload;
  }
}

export type NormalizedApiEnvelope<T = unknown> = {
  success: boolean;
  message?: string;
  data?: T;
  raw: any;
};

export const normalizeApiEnvelope = <T = unknown>(response: any): NormalizedApiEnvelope<T> => {
  if (response && typeof response === 'object' && typeof response.success === 'boolean') {
    return {
      success: response.success,
      message: typeof response.message === 'string' ? response.message : undefined,
      data: response.data as T | undefined,
      raw: response,
    };
  }

  return {
    success: true,
    data: response as T,
    raw: response,
  };
};

export const readApiData = <T>(response: any, fallback: T): T => {
  const envelope = normalizeApiEnvelope<T>(response);

  if (envelope.data !== undefined) {
    return envelope.data;
  }

  if (envelope.raw !== undefined && envelope.raw !== null) {
    return envelope.raw as T;
  }

  return fallback;
};

export const assertApiSuccess = <T = unknown>(response: any, fallbackMessage: string): NormalizedApiEnvelope<T> => {
  const envelope = normalizeApiEnvelope<T>(response);

  if (!envelope.success) {
    const rawMessage = typeof envelope.raw?.error === 'string' ? envelope.raw.error : undefined;
    throw new ApiRequestError(
      envelope.message || rawMessage || fallbackMessage,
      200,
      envelope.raw,
    );
  }

  return envelope;
};

export const readApiErrorMessage = (error: any, fallbackMessage: string): string => {
  if (typeof error?.payload?.message === 'string' && error.payload.message.trim()) {
    return error.payload.message;
  }

  if (typeof error?.payload?.error === 'string' && error.payload.error.trim()) {
    return error.payload.error;
  }

  if (typeof error?.message === 'string' && error.message.trim()) {
    return error.message;
  }

  return fallbackMessage;
};

export const getCookieValue = (name: string): string | null => {
  if (typeof document === 'undefined') {
    return null;
  }

  const match = document.cookie
    .split('; ')
    .find((entry) => entry.startsWith(`${name}=`));

  if (!match) {
    return null;
  }

  const [, rawValue = ''] = match.split('=');
  const value = decodeURIComponent(rawValue);
  return value.trim() !== '' ? value.trim() : null;
};

type BrowserApiRequestOptions = Omit<RequestInit, 'body'> & {
  body?: unknown;
  authToken?: string | null;
  includeCsrfToken?: boolean;
};

const buildBrowserApiUrl = (endpoint: string) => {
  const baseUrl = getBrowserApiBaseUrl();
  const normalizedEndpoint = endpoint.startsWith('/') ? endpoint.slice(1) : endpoint;
  return `${baseUrl}${normalizedEndpoint}`;
};

const parseResponsePayload = async (response: Response) => {
  const rawText = await response.text();

  if (!rawText.trim()) {
    return null;
  }

  try {
    return JSON.parse(rawText);
  } catch {
    return rawText;
  }
};

export const requestApi = async <T = unknown>(
  endpoint: string,
  options: BrowserApiRequestOptions = {},
): Promise<T> => {
  const headers = new Headers(options.headers || {});
  const url = buildBrowserApiUrl(endpoint);
  const { body, authToken, includeCsrfToken, ...restOptions } = options;

  if (!(body instanceof FormData) && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  if (authToken) {
    headers.set('Authorization', `Bearer ${authToken}`);
    headers.set('X-Auth-Token', authToken);
  }

  if (includeCsrfToken) {
    const csrfToken = getCookieValue('cm_csrf');
    if (csrfToken) {
      headers.set('X-CSRF-Token', csrfToken);
    }
  }

  const response = await fetch(url, {
    ...restOptions,
    method: options.method || 'GET',
    headers,
    credentials: 'include',
    body: body === undefined
      ? undefined
      : body instanceof FormData
        ? body
        : JSON.stringify(body),
  });

  const payload = await parseResponsePayload(response);
  const envelope = normalizeApiEnvelope(payload);

  if (!response.ok) {
    throw new ApiRequestError(
      envelope.message || `Falha na requisicao (${response.status}).`,
      response.status,
      payload,
    );
  }

  if (!envelope.success) {
    throw new ApiRequestError(
      envelope.message || 'Falha logica da API.',
      response.status,
      payload,
    );
  }

  return payload as T;
};

export { getBrowserApiBaseUrl };

export const getAssetUrl = (path: string | null | undefined) => {
  if (!path) {
    return '';
  }

  if (/^https?:\/\//i.test(path)) {
    return path;
  }

  const cleanPath = path.replace(/^\/+/, '');
  return `${getBrowserBackendRoot()}/${cleanPath}`;
};
