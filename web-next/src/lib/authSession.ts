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

import type { UserProfile } from '@/types';
import {
  ApiRequestError,
  getBrowserApiBaseUrl,
  readApiData,
  requestApi,
} from '@/lib/browserApi';

type RefreshPayload = {
  token?: string | null;
};

type AuthenticatedUserPayload = {
  user?: UserProfile;
};

const AUTH_ENDPOINTS = {
  me: 'auth/me.php',
  refresh: 'auth/refresh.php',
  logout: 'auth/logout.php',
} as const;

let accessToken: string | null = null;
let currentUser: UserProfile | null = null;

export type AuthSessionSnapshot = {
  accessToken: string | null;
  currentUser: UserProfile | null;
  isAuthenticated: boolean;
};

export const getAuthSnapshot = (): AuthSessionSnapshot => ({
  accessToken,
  currentUser,
  isAuthenticated: Boolean(accessToken && currentUser),
});

export const getAccessToken = (): string | null => accessToken;

export const clearAuthSession = (): AuthSessionSnapshot => {
  accessToken = null;
  currentUser = null;
  return getAuthSnapshot();
};

export const fetchAuthenticatedUser = async (token = accessToken): Promise<UserProfile> => {
  if (!token) {
    throw new Error('Sessao ausente.');
  }

  const response = await requestApi<any>(AUTH_ENDPOINTS.me, {
    method: 'GET',
    authToken: token,
  });

  const payload = readApiData<AuthenticatedUserPayload>(response, {});
  if (!payload.user) {
    throw new Error('Nao foi possivel obter o usuario autenticado.');
  }

  accessToken = token;
  currentUser = payload.user;
  return payload.user;
};

export const refreshAuthSession = async (): Promise<AuthSessionSnapshot> => {
  const response = await requestApi<any>(AUTH_ENDPOINTS.refresh, {
    method: 'POST',
    includeCsrfToken: true,
  });

  const payload = readApiData<RefreshPayload>(response, {});
  const nextToken = payload.token ?? null;

  if (!nextToken) {
    return clearAuthSession();
  }

  accessToken = nextToken;
  await fetchAuthenticatedUser(nextToken);
  return getAuthSnapshot();
};

export const bootstrapAuthSession = async (): Promise<AuthSessionSnapshot> => {
  try {
    if (accessToken) {
      await fetchAuthenticatedUser(accessToken);
      return getAuthSnapshot();
    }

    return await refreshAuthSession();
  } catch {
    return clearAuthSession();
  }
};

export const establishAuthenticatedSession = async (
  token: string | null | undefined,
  user?: UserProfile | null,
): Promise<AuthSessionSnapshot> => {
  if (!token) {
    throw new Error('Token de autenticacao ausente.');
  }

  accessToken = token;
  currentUser = user ?? null;

  if (!currentUser) {
    await fetchAuthenticatedUser(token);
  }

  return getAuthSnapshot();
};

export const logoutAuthSession = async (): Promise<AuthSessionSnapshot> => {
  try {
    await requestApi<any>(AUTH_ENDPOINTS.logout, {
      method: 'POST',
      authToken: accessToken,
      includeCsrfToken: true,
    });
  } catch {
    // O logout local deve acontecer mesmo se o backend falhar.
  }

  return clearAuthSession();
};

export const requestAuthenticatedApi = async <T = unknown>(
  endpoint: string,
  options: Omit<Parameters<typeof requestApi>[1], 'authToken'> = {},
): Promise<T> => {
  if (!accessToken) {
    await refreshAuthSession();
  }

  if (!accessToken) {
    throw new Error('Sessao expirada. Faca login novamente.');
  }

  try {
    return await requestApi<T>(endpoint, {
      ...options,
      authToken: accessToken,
    });
  } catch (error) {
    if (error instanceof ApiRequestError && (error.status === 401 || error.status === 403)) {
      await refreshAuthSession();

      if (!accessToken) {
        throw new Error('Sessao expirada. Faca login novamente.');
      }

      return requestApi<T>(endpoint, {
        ...options,
        authToken: accessToken,
      });
    }

    throw error;
  }
};

const buildAuthenticatedResourceUrl = (endpoint: string) => {
  const baseUrl = getBrowserApiBaseUrl();
  const normalizedEndpoint = endpoint.startsWith('/') ? endpoint.slice(1) : endpoint;
  return `${baseUrl}${normalizedEndpoint}`;
};

const readResourceErrorMessage = async (response: Response): Promise<string> => {
  const contentType = response.headers.get('content-type') || '';

  if (contentType.includes('application/json')) {
    try {
      const payload = await response.json();
      return payload?.message || payload?.error || `Falha ao acessar o arquivo (${response.status}).`;
    } catch {
      return `Falha ao acessar o arquivo (${response.status}).`;
    }
  }

  try {
    const text = (await response.text()).trim();
    return text || `Falha ao acessar o arquivo (${response.status}).`;
  } catch {
    return `Falha ao acessar o arquivo (${response.status}).`;
  }
};

export const requestAuthenticatedResource = async (
  endpoint: string,
  options: RequestInit = {},
  hasRetried = false,
): Promise<Response> => {
  if (!accessToken) {
    await refreshAuthSession();
  }

  if (!accessToken) {
    throw new Error('Sessao expirada. Faca login novamente.');
  }

  const headers = new Headers(options.headers || {});
  headers.set('Authorization', `Bearer ${accessToken}`);
  headers.set('X-Auth-Token', accessToken);

  const response = await fetch(buildAuthenticatedResourceUrl(endpoint), {
    ...options,
    headers,
    credentials: 'include',
  });

  if ((response.status === 401 || response.status === 403) && !hasRetried) {
    await refreshAuthSession();
    return requestAuthenticatedResource(endpoint, options, true);
  }

  if (!response.ok) {
    throw new ApiRequestError(
      await readResourceErrorMessage(response),
      response.status,
      null,
    );
  }

  return response;
};
