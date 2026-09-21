import * as SecureStore from 'expo-secure-store';
import type { UserProfile } from '@/types/auth';

const ACCESS_TOKEN_KEY = 'cm_mobile_access_token';
const USER_KEY = 'cm_mobile_user';
const REFRESH_TOKEN_KEY = 'cm_mobile_refresh_token';
const CSRF_TOKEN_KEY = 'cm_mobile_csrf_token';

let accessTokenMemory: string | null = null;
let currentUserMemory: UserProfile | null = null;
let refreshTokenMemory: string | null = null;
let csrfTokenMemory: string | null = null;

export type SessionSnapshot = {
  accessToken: string | null;
  user: UserProfile | null;
  refreshToken: string | null;
  csrfToken: string | null;
};

type SessionListener = (snapshot: SessionSnapshot) => void;
const sessionListeners = new Set<SessionListener>();

const currentSnapshot = (): SessionSnapshot => ({
  accessToken: accessTokenMemory,
  user: currentUserMemory,
  refreshToken: refreshTokenMemory,
  csrfToken: csrfTokenMemory,
});

const notifySessionListeners = (): void => {
  const snapshot = currentSnapshot();
  sessionListeners.forEach((listener) => {
    try {
      listener(snapshot);
    } catch {
      // Um listener de UI nao pode interromper a persistencia/limpeza da sessao.
    }
  });
};

/**
 * Persistencia segura de identidade/sessao.
 * Mantem um espelho em memoria apenas para leitura sincrona pelo cliente HTTP.
 */
export const sessionStorage = {
  async hydrate(): Promise<SessionSnapshot> {
    const [token, userRaw, refreshToken, csrfToken] = await Promise.all([
      SecureStore.getItemAsync(ACCESS_TOKEN_KEY),
      SecureStore.getItemAsync(USER_KEY),
      SecureStore.getItemAsync(REFRESH_TOKEN_KEY),
      SecureStore.getItemAsync(CSRF_TOKEN_KEY),
    ]);

    accessTokenMemory = token || null;
    refreshTokenMemory = refreshToken || null;
    csrfTokenMemory = csrfToken || null;

    if (userRaw) {
      try {
        currentUserMemory = JSON.parse(userRaw) as UserProfile;
      } catch {
        currentUserMemory = null;
      }
    } else {
      currentUserMemory = null;
    }

    return currentSnapshot();
  },

  async setSession(
    token: string | null,
    user?: UserProfile | null,
    refreshToken?: string | null,
    csrfToken?: string | null,
  ): Promise<void> {
    accessTokenMemory = token || null;

    if (accessTokenMemory) {
      await SecureStore.setItemAsync(ACCESS_TOKEN_KEY, accessTokenMemory);
    } else {
      await SecureStore.deleteItemAsync(ACCESS_TOKEN_KEY);
    }

    if (user !== undefined) {
      currentUserMemory = user ?? null;
      if (currentUserMemory) {
        await SecureStore.setItemAsync(USER_KEY, JSON.stringify(currentUserMemory));
      } else {
        await SecureStore.deleteItemAsync(USER_KEY);
      }
    }

    if (refreshToken !== undefined) {
      refreshTokenMemory = refreshToken || null;
      if (refreshTokenMemory) {
        await SecureStore.setItemAsync(REFRESH_TOKEN_KEY, refreshTokenMemory);
      } else {
        await SecureStore.deleteItemAsync(REFRESH_TOKEN_KEY);
      }
    }

    if (csrfToken !== undefined) {
      csrfTokenMemory = csrfToken || null;
      if (csrfTokenMemory) {
        await SecureStore.setItemAsync(CSRF_TOKEN_KEY, csrfTokenMemory);
      } else {
        await SecureStore.deleteItemAsync(CSRF_TOKEN_KEY);
      }
    }

    notifySessionListeners();
  },

  async clearSession(): Promise<void> {
    accessTokenMemory = null;
    currentUserMemory = null;
    refreshTokenMemory = null;
    csrfTokenMemory = null;
    await Promise.all([
      SecureStore.deleteItemAsync(ACCESS_TOKEN_KEY),
      SecureStore.deleteItemAsync(USER_KEY),
      SecureStore.deleteItemAsync(REFRESH_TOKEN_KEY),
      SecureStore.deleteItemAsync(CSRF_TOKEN_KEY),
    ]);
    notifySessionListeners();
  },

  subscribe(listener: SessionListener): () => void {
    sessionListeners.add(listener);
    return () => sessionListeners.delete(listener);
  },

  getAccessToken(): string | null {
    return accessTokenMemory;
  },

  getCurrentUser(): UserProfile | null {
    return currentUserMemory;
  },

  getRefreshToken(): string | null {
    return refreshTokenMemory;
  },

  getCsrfToken(): string | null {
    return csrfTokenMemory;
  },
};
