import axios, { type AxiosError, type InternalAxiosRequestConfig } from 'axios';
import { runtimeConfig } from '@/config/runtime';
import { sessionStorage } from '@/storage/sessionStorage';
import { ENDPOINTS } from '@/api/endpoints';

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

export const getAssetUrl = (resourcePath?: string | null): string => {
  if (!resourcePath) return '';
  if (/^https?:\/\//i.test(resourcePath)) return resourcePath;

  const cleanPath = String(resourcePath).replace(/^\/+/, '');
  return `${resolveBackendRoot()}/${cleanPath}`;
};

const refreshSessionToken = async (): Promise<string | null> => {
  const currentToken = sessionStorage.getAccessToken();
  const response = await authHttp.post<any>(ENDPOINTS.auth.refresh, undefined, {
    headers: {
      Authorization: currentToken ? `Bearer ${currentToken}` : undefined,
      'X-Auth-Token': currentToken || undefined,
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
      await sessionStorage.clearSession();
    }

    throw error;
  },
);
