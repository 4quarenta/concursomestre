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

  const response = await authHttp.post<any>(ENDPOINTS.auth.refresh, undefined, {
    headers: {
      Authorization: `Bearer ${currentToken}`,
      'X-Auth-Token': currentToken,
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

apiClient.interceptors.request.use((config: InternalAxiosRequestConfig) => {
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

    if (status === 401 && !authRequest && !config._retry) {
      config._retry = true;
      const refreshedToken = await refreshSessionTokenSingleFlight();

      if (refreshedToken && config.headers) {
        config.headers.Authorization = `Bearer ${refreshedToken}`;
        config.headers['X-Auth-Token'] = refreshedToken;
        return apiClient(config);
      }
    }

    if (status === 401 && !authRequest) {
      await sessionStorage.clearSession();
    }

    const normalizedFailure = normalizeApiFailure(error);
    error.message = normalizedFailure.message;
    throw error;
  },
);
