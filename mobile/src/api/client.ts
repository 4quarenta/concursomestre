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
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
});

export const apiClient = axios.create({
  baseURL: resolveApiBaseUrl(),
  timeout: API_REQUEST_TIMEOUT_MS,
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
});

export const getAssetUrl = (resourcePath?: string | null): string => {
  if (!resourcePath) return '';
  if (/^https?:\/\//i.test(resourcePath)) return resourcePath;

  const cleanPath = String(resourcePath).replace(/^\/+/, '');
  return `${resolveBackendRoot()}/${cleanPath}`;
};

const refreshSessionToken = async (): Promise<string | null> => {
  const currentToken = sessionStorage.getAccessToken();
  if (!currentToken) return null;

  const response = await authHttp.post<any>(ENDPOINTS.auth.refresh, {
    includeUser: true,
    refreshToken: sessionStorage.getRefreshToken(),
    csrfToken: sessionStorage.getCsrfToken(),
  }, {
    headers: {
      Authorization: `Bearer ${currentToken}`,
      'X-Auth-Token': currentToken,
      'X-ConcursoMestre-Client': 'mobile',
      ...(sessionStorage.getCsrfToken() ? { 'X-CSRF-Token': sessionStorage.getCsrfToken() as string } : {}),
    },
  });

  const payload = parseJsonLikePayload(response.data);
  if (!payload || payload.success === false) {
    return null;
  }

  const nextToken = payload?.data?.token || payload?.token || null;
  if (nextToken) {
    await sessionStorage.setSession(
      nextToken,
      payload?.data?.user || payload?.user || sessionStorage.getCurrentUser(),
      payload?.data?.refresh_token || payload?.data?.refreshToken || payload?.refresh_token || payload?.refreshToken || sessionStorage.getRefreshToken(),
      payload?.data?.csrf_token || payload?.data?.csrfToken || payload?.csrf_token || payload?.csrfToken || sessionStorage.getCsrfToken(),
    );
  }

  return nextToken;
};

let refreshInFlight: Promise<string | null> | null = null;

const refreshSessionTokenSingleFlight = (): Promise<string | null> => {
  if (!refreshInFlight) {
    refreshInFlight = refreshSessionToken()
      .catch(() => null)
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
    const sessionFailure = status === 401 || isLegacySessionFailure(error);

    if (sessionFailure && !authRequest && !config._retry) {
      config._retry = true;
      const refreshedToken = await refreshSessionTokenSingleFlight();

      if (refreshedToken && config.headers) {
        config.headers.Authorization = `Bearer ${refreshedToken}`;
        config.headers['X-Auth-Token'] = refreshedToken;
        return apiClient(config);
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
