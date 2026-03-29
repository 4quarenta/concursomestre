/**
 * API Client Configuration
 * Centralized Axios instance with a single auth/session flow.
 */

import axios, {
  AxiosError,
  AxiosHeaders,
  AxiosResponse,
  InternalAxiosRequestConfig,
} from 'axios';
import { logger } from '../debug/DebugLogger';
import {
  clearStoredSession,
  getRawStoredToken,
  setStoredToken,
} from '../auth/session';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost/questao-pro-backend/api/';
const REFRESH_ENDPOINT = 'auth/refresh.php';
const SESSION_EXPIRED_EVENT = 'auth:session-expired';

type RetriableRequestConfig = InternalAxiosRequestConfig & {
  _retry?: boolean;
};

const refreshClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 15000,
  headers: {
    'Content-Type': 'application/json',
  },
});

export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
});

let refreshPromise: Promise<string | null> | null = null;

const normalizeUrl = (url?: string): string => (url || '').replace(/^\/+/, '');

const isRefreshRequest = (url?: string): boolean => normalizeUrl(url).includes(REFRESH_ENDPOINT);

const isSessionExemptRequest = (url?: string): boolean => {
  const normalized = normalizeUrl(url);

  return [
    'auth/login.php',
    'auth/register.php',
    'auth/forgot-password.php',
    'auth/resend-confirmation.php',
    'auth/verify_2fa.php',
    REFRESH_ENDPOINT,
  ].some((segment) => normalized.includes(segment));
};

const getHeaderValue = (headers: unknown, key: string): string | null => {
  if (!headers) return null;

  if (headers instanceof AxiosHeaders) {
    const value = headers.get(key);
    return typeof value === 'string' ? value : null;
  }

  const record = headers as Record<string, unknown>;
  const value = record[key] ?? record[key.toLowerCase()];
  return typeof value === 'string' ? value : null;
};

const extractBearerToken = (headers: unknown): string | null => {
  const authorization = getHeaderValue(headers, 'Authorization');
  if (authorization?.startsWith('Bearer ')) {
    return authorization.replace(/^Bearer\s+/i, '').trim();
  }

  return getHeaderValue(headers, 'X-Auth-Token');
};

const applyAuthHeaders = (config: InternalAxiosRequestConfig, token: string): InternalAxiosRequestConfig => {
  const headers = config.headers instanceof AxiosHeaders ? config.headers : new AxiosHeaders(config.headers);

  headers.set('Authorization', `Bearer ${token}`);
  headers.set('X-Auth-Token', token);
  config.headers = headers;

  return config;
};

const notifySessionExpired = (message: string, failedToken?: string | null) => {
  const currentToken = getRawStoredToken();

  if (failedToken && currentToken && currentToken !== failedToken) {
    return;
  }

  clearStoredSession();
  window.dispatchEvent(
    new CustomEvent(SESSION_EXPIRED_EVENT, {
      detail: { message },
    }),
  );
};

const requestSessionRefresh = async (token: string): Promise<string | null> => {
  if (!token) return null;

  if (!refreshPromise) {
    refreshPromise = (async () => {
      try {
        const response = await refreshClient.get(REFRESH_ENDPOINT, {
          headers: {
            Authorization: `Bearer ${token}`,
            'X-Auth-Token': token,
          },
          validateStatus: (status) => (status >= 200 && status < 300) || status === 401,
        });

        if (response.status !== 200) {
          return null;
        }

        const refreshedToken = response.data?.data?.token || response.data?.token || null;
        if (typeof refreshedToken === 'string' && refreshedToken.trim()) {
          setStoredToken(refreshedToken);
          return refreshedToken.trim();
        }

        return null;
      } catch {
        return null;
      } finally {
        refreshPromise = null;
      }
    })();
  }

  return refreshPromise;
};

apiClient.interceptors.request.use(
  async (config: InternalAxiosRequestConfig) => {
    const token = getRawStoredToken();

    if (token) {
      applyAuthHeaders(config, token);
    }

    if (config.data instanceof FormData && config.headers) {
      if (config.headers instanceof AxiosHeaders) {
        config.headers.delete('Content-Type');
      } else {
        delete (config.headers as Record<string, unknown>)['Content-Type'];
      }
    }

    if (import.meta.env.DEV) {
      logger.addLog('request', `${config.method?.toUpperCase()} ${config.url}`, config.data);
    }

    return config;
  },
  (error: AxiosError) => Promise.reject(error),
);

apiClient.interceptors.response.use(
  (response: AxiosResponse) => {
    if (import.meta.env.DEV) {
      logger.addLog('response', `SUCCESS: ${response.config.url}`, response.data);
    }

    return response.data;
  },
  async (error: AxiosError) => {
    const responseStatus = error.response?.status;
    const responseData = error.response?.data as any;
    const requestConfig = error.config as RetriableRequestConfig | undefined;
    const requestUrl = requestConfig?.url;
    const failedToken = extractBearerToken(requestConfig?.headers);

    if (import.meta.env.DEV) {
      logger.addLog(
        'api-error',
        `ERROR ${responseStatus ?? 'unknown'}: ${requestUrl ?? 'unknown request'}`,
        responseData ?? error.message,
      );
    }

    if (
      responseStatus === 401 &&
      requestConfig &&
      !requestConfig._retry &&
      !isSessionExemptRequest(requestUrl)
    ) {
      requestConfig._retry = true;

      const latestToken = getRawStoredToken();

      if (!failedToken && latestToken) {
        applyAuthHeaders(requestConfig, latestToken);
        return apiClient.request(requestConfig);
      }

      const tokenToRefresh = failedToken || latestToken;
      if (tokenToRefresh) {
        const refreshedToken = await requestSessionRefresh(tokenToRefresh);
        const newestStoredToken = getRawStoredToken();

        if (refreshedToken) {
          applyAuthHeaders(requestConfig, refreshedToken);
          return apiClient.request(requestConfig);
        }

        if (newestStoredToken && newestStoredToken !== tokenToRefresh) {
          applyAuthHeaders(requestConfig, newestStoredToken);
          return apiClient.request(requestConfig);
        }

        notifySessionExpired(responseData?.message || 'Sessao expirada. Faca login novamente.', tokenToRefresh);
      }
    }

    if (responseStatus && responseStatus !== 401) {
      switch (responseStatus) {
        case 403:
          console.error('Access forbidden:', responseData?.message);
          break;
        case 404:
          console.error('Resource not found:', requestUrl);
          break;
        case 429:
          console.error('Rate limit exceeded. Please try again later.');
          break;
        case 500:
          console.error('Server error:', responseData?.message);
          break;
        default:
          console.error('API Error:', responseData?.message || 'Unknown error');
      }
    } else if (!error.response && error.request) {
      console.error('Network error: no response from server');
    }

    return Promise.reject(error);
  },
);

export const buildDownloadUrl = (materialId: string): string => {
  const token = getRawStoredToken() || '';
  const backendRoot = API_BASE_URL.replace(/\/api\/$/, '');

  return `${backendRoot}/api/materials/download.php?material_id=${encodeURIComponent(materialId)}&token=${encodeURIComponent(token)}`;
};

export const getAssetUrl = (path: string) => {
  if (!path) return '';
  if (path.startsWith('http')) return path;

  let backendRoot = API_BASE_URL.replace(/\/api\/$/, '');

  if (!backendRoot.startsWith('http')) {
    const origin = window.location.origin;
    const backendOrigin = origin.replace(':3000', '');
    backendRoot = `${backendOrigin}${backendRoot.startsWith('/') ? '' : '/'}${backendRoot}`;
  }

  const cleanPath = path.startsWith('/') ? path.substring(1) : path;

  if (cleanPath.startsWith('uploads/')) {
    return `${backendRoot}/${cleanPath}`;
  }

  return `${backendRoot}/${cleanPath}`;
};

export default apiClient;
