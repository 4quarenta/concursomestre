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

import axios, { type AxiosError, type InternalAxiosRequestConfig } from 'axios';
import { runtimeConfig } from '@/config/runtime';
import { sessionStorage } from '@/storage/sessionStorage';
import { ENDPOINTS } from '@/api/endpoints';
import { normalizeApiFailure } from '@/api/errors';
import { API_REQUEST_TIMEOUT_MS } from '@/api/transportPolicy';

type RetryConfig = InternalAxiosRequestConfig & {
  _retry?: boolean;
};

const resolveApiBaseUrl = (): string => runtimeConfig.apiBaseUrl;
const resolveBackendRoot = (): string => resolveApiBaseUrl().replace(/\/api\/?$/, '');

const parseJsonLikePayload = <T>(payload: T): T => {
  if (typeof payload !== 'string') return payload;
  const normalized = payload.trim();
  if (!normalized) return payload;

  try {
    return JSON.parse(normalized) as T;
  } catch {
    return payload;
  }
};

const authHttp = axios.create({
  baseURL: resolveApiBaseUrl(),
  timeout: API_REQUEST_TIMEOUT_MS,
  withCredentials: false,
  headers: {
    'Content-Type': 'application/json',
    'X-Client-Platform': 'concursomestre-mobile',
  },
});

export const apiClient = axios.create({
  baseURL: resolveApiBaseUrl(),
  timeout: API_REQUEST_TIMEOUT_MS,
  withCredentials: false,
  headers: {
    'Content-Type': 'application/json',
    'X-Client-Platform': 'concursomestre-mobile',
  },
});

export const getAssetUrl = (resourcePath?: string | null): string => {
  if (!resourcePath) return '';
  if (/^https?:\/\//i.test(resourcePath)) return resourcePath;

  const cleanPath = String(resourcePath).replace(/^\/+/, '');
  return `${resolveBackendRoot()}/${cleanPath}`;
};

const refreshSessionToken = async (): Promise<string | null> => {
  const refreshToken = sessionStorage.getRefreshToken();
  const csrfToken = sessionStorage.getCsrfToken();
  if (!refreshToken || !csrfToken) return null;

  const response = await authHttp.post<any>(ENDPOINTS.auth.refresh, {
    includeUser: true,
    refreshToken,
    csrfToken,
  }, {
    headers: {
      ...(sessionStorage.getAccessToken()
        ? {
          Authorization: `Bearer ${sessionStorage.getAccessToken()}`,
          'X-Auth-Token': sessionStorage.getAccessToken() as string,
        }
        : {}),
      'X-Client-Platform': 'concursomestre-mobile',
      'X-ConcursoMestre-Client': 'mobile',
      'X-CSRF-Token': csrfToken,
    },
  });

  const payload = parseJsonLikePayload(response.data);
  if (!payload || payload.success === false) {
    return null;
  }

  const data = payload?.data || payload;
  const nextToken = data?.token || null;
  const nextRefreshToken = data?.refreshToken || data?.refresh_token || null;
  const nextCsrfToken = data?.csrfToken || data?.csrf_token || null;
  if (nextToken && nextRefreshToken && nextCsrfToken) {
    await sessionStorage.setSession(
      nextToken,
      data?.user || sessionStorage.getCurrentUser(),
      nextRefreshToken,
      nextCsrfToken,
    );
    return nextToken;
  }

  return null;
};

let refreshInFlight: Promise<string | null> | null = null;

/**
 * Compartilha uma unica rotacao de credenciais entre requisicoes concorrentes.
 * Falhas transitorias continuam rejeitadas para que o interceptor preserve a sessao local.
 * @since v1.0.0
 */
const refreshSessionTokenSingleFlight = (): Promise<string | null> => {
  if (!refreshInFlight) {
    refreshInFlight = refreshSessionToken()
      .finally(() => {
        refreshInFlight = null;
      });
  }

  return refreshInFlight;
};

const isAuthenticationRequest = (config: RetryConfig): boolean => {
  const url = String(config.url || '');
  return [
    ENDPOINTS.auth.login,
    ENDPOINTS.auth.register,
    ENDPOINTS.auth.refresh,
  ].some((endpoint) => url.includes(endpoint));
};

const isLegacySessionFailure = (error: AxiosError): boolean => {
  if (error.response?.status !== 500) return false;
  const payload = error.response.data as any;
  const message = `${payload?.message || ''} ${payload?.error || ''}`;
  return /sess[aã]o.*(inv[aá]lida|expirada)/i.test(message);
};

apiClient.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  if (config.headers) {
    config.headers['X-Client-Platform'] = 'concursomestre-mobile';
    config.headers['X-ConcursoMestre-Client'] = 'mobile';
  }

  const token = sessionStorage.getAccessToken();
  if (token && config.headers) {
    config.headers.Authorization = `Bearer ${token}`;
    config.headers['X-Auth-Token'] = token;
  }

  if (config.data instanceof FormData && config.headers) {
    delete config.headers['Content-Type'];
  }

  return config;
});

apiClient.interceptors.response.use(
  (response) => parseJsonLikePayload(response.data),
  async (error: AxiosError) => {
    const config = (error.config || {}) as RetryConfig;
    const status = error.response?.status;
    const authRequest = isAuthenticationRequest(config);
    // Um 403 representa usuario autenticado sem permissao para o recurso e
    // nunca deve apagar a sessao. Apenas 401 ou a compatibilidade legada de
    // sessao invalida em 500 disparam a tentativa de renovacao.
    const sessionFailure = status === 401 || isLegacySessionFailure(error);

    if (sessionFailure && !authRequest && !config._retry) {
      config._retry = true;
      try {
        const refreshedToken = await refreshSessionTokenSingleFlight();

        if (refreshedToken && config.headers) {
          config.headers.Authorization = `Bearer ${refreshedToken}`;
          config.headers['X-Auth-Token'] = refreshedToken;
          return apiClient(config);
        }
      } catch (refreshError) {
        const refreshFailure = normalizeApiFailure(refreshError);

        // 401 e 422 no endpoint de refresh comprovam que as credenciais
        // persistidas nao podem mais renovar. Timeout, offline, 403 de
        // seguranca e erro 5xx preservam a sessao para uma tentativa futura.
        if (refreshFailure.status === 401 || refreshFailure.status === 422) {
          await sessionStorage.clearSession();
        }

        if (refreshError instanceof Error) {
          refreshError.message = refreshFailure.message;
        }
        throw refreshError;
      }
    }

    if (sessionFailure && !authRequest) {
      await sessionStorage.clearSession();
    }

    const normalizedFailure = normalizeApiFailure(error);
    error.message = normalizedFailure.message;
    throw error;
  },
);
