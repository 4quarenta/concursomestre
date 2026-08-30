import axios, { type AxiosError, type InternalAxiosRequestConfig } from 'axios';
import Constants from 'expo-constants';
import { sessionStore } from '@/services/auth/sessionStore';
import { ENDPOINTS } from '@/services/api/endpoints';

type RetryConfig = InternalAxiosRequestConfig & {
  _retry?: boolean;
};

const resolveApiBaseUrl = (): string => {
  const expoBaseUrl =
    process.env.EXPO_PUBLIC_API_BASE_URL
    || (Constants.expoConfig?.extra?.apiBaseUrl as string | undefined)
    || 'https://concursomestre.com/api/';

  return expoBaseUrl.endsWith('/') ? expoBaseUrl : `${expoBaseUrl}/`;
};

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
  withCredentials: false,
  headers: {
    'Content-Type': 'application/json',
    'X-Client-Platform': 'concursomestre-mobile',
  },
});

export const apiClient = axios.create({
  baseURL: resolveApiBaseUrl(),
  timeout: 30000,
  withCredentials: false,
  headers: {
    'Content-Type': 'application/json',
    'X-Client-Platform': 'concursomestre-mobile',
  },
});

let refreshPromise: Promise<string | null> | null = null;

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
  if (refreshPromise) {
    return refreshPromise;
  }

  refreshPromise = (async () => {
    const refreshToken = sessionStore.getRefreshToken();
    const csrfToken = sessionStore.getCsrfToken();
    if (!refreshToken || !csrfToken) {
      return null;
    }

    const response = await authHttp.post<any>(ENDPOINTS.auth.refresh, {
      refreshToken,
      csrfToken,
      includeUser: true,
    }, {
    headers: {
      Authorization: sessionStore.getAccessToken() ? `Bearer ${sessionStore.getAccessToken()}` : undefined,
    },
    });

    const payload = parseJsonLikePayload(response.data);
    if (!payload || payload.success === false) {
      return null;
    }

    const data = payload?.data || payload;
    const nextToken = data?.token || null;
    const nextRefreshToken = data?.refreshToken || null;
    const nextCsrfToken = data?.csrfToken || null;
    if (!nextToken || !nextRefreshToken || !nextCsrfToken) {
      return null;
    }

    await sessionStore.setSession(
      nextToken,
      data?.user || sessionStore.getCurrentUser(),
      {
        refreshToken: nextRefreshToken,
        csrfToken: nextCsrfToken,
      },
    );

    return nextToken;
  })().finally(() => {
    refreshPromise = null;
  });

  return refreshPromise;
};

apiClient.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  const token = sessionStore.getAccessToken();
  if (token && config.headers) {
    config.headers.Authorization = `Bearer ${token}`;
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
      let refreshedToken: string | null = null;

      try {
        refreshedToken = await refreshSessionToken();
      } catch {
        await sessionStore.clearSession();
        throw error;
      }

      if (refreshedToken && config.headers) {
        config.headers.Authorization = `Bearer ${refreshedToken}`;
        return apiClient(config);
      }
    }

    if (status === 401) {
      await sessionStore.clearSession();
    }

    throw error;
  },
);
