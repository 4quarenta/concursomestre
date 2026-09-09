import axios, { type AxiosError, type InternalAxiosRequestConfig } from 'axios';
import { runtimeConfig } from '@/config/runtime';
import { sessionStore } from '@/services/auth/sessionStore';
import { ENDPOINTS } from '@/services/api/endpoints';

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
  timeout: 30000,
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
});

export const apiClient = axios.create({
  baseURL: resolveApiBaseUrl(),
  timeout: 30000,
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
});

/**
 * Converte caminhos relativos do backend em URLs absolutas para abertura externa no mobile.
 * @since v1.0.0
 */
export const getAssetUrl = (resourcePath?: string | null): string => {
  if (!resourcePath) return '';
  if (/^https?:\/\//i.test(resourcePath)) return resourcePath;

  const cleanPath = String(resourcePath).replace(/^\/+/, '');
  return `${resolveBackendRoot()}/${cleanPath}`;
};

/**
 * Refresh de token usado pelos interceptors do app mobile.
 * @since v1.0.0
 */
const refreshSessionToken = async (): Promise<string | null> => {
  const response = await authHttp.post<any>(ENDPOINTS.auth.refresh, undefined, {
    headers: {
      Authorization: sessionStore.getAccessToken() ? `Bearer ${sessionStore.getAccessToken()}` : undefined,
      'X-Auth-Token': sessionStore.getAccessToken() || undefined,
    },
  });

  const payload = parseJsonLikePayload(response.data);
  if (!payload || payload.success === false) {
    return null;
  }

  const nextToken = payload?.data?.token || payload?.token || null;
  if (nextToken) {
    await sessionStore.setSession(nextToken, payload?.data?.user || payload?.user || sessionStore.getCurrentUser());
  }

  return nextToken;
};

apiClient.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  const token = sessionStore.getAccessToken();
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

    if (status === 401 && !config._retry) {
      config._retry = true;
      const refreshedToken = await refreshSessionToken();

      if (refreshedToken && config.headers) {
        config.headers.Authorization = `Bearer ${refreshedToken}`;
        config.headers['X-Auth-Token'] = refreshedToken;
        return apiClient(config);
      }
    }

    if (status === 401) {
      await sessionStore.clearSession();
    }

    throw error;
  },
);
