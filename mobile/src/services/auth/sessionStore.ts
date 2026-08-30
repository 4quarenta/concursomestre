import * as SecureStore from 'expo-secure-store';
import type { UserProfile } from '@/types/auth';

const ACCESS_TOKEN_KEY = 'cm_mobile_access_token';
const REFRESH_TOKEN_KEY = 'cm_mobile_refresh_token';
const CSRF_TOKEN_KEY = 'cm_mobile_csrf_token';
const USER_KEY = 'cm_mobile_user';

let accessTokenMemory: string | null = null;
let refreshTokenMemory: string | null = null;
let csrfTokenMemory: string | null = null;
let currentUserMemory: UserProfile | null = null;

type NativeSessionCredentials = {
  refreshToken: string;
  csrfToken: string;
};

/**
 * Persistencia de sessao para o app mobile.
 * @since v1.0.0
 */
export const sessionStore = {
  async hydrate(): Promise<{
    accessToken: string | null;
    refreshToken: string | null;
    csrfToken: string | null;
    user: UserProfile | null;
  }> {
    const [token, refreshToken, csrfToken, userRaw] = await Promise.all([
      SecureStore.getItemAsync(ACCESS_TOKEN_KEY),
      SecureStore.getItemAsync(REFRESH_TOKEN_KEY),
      SecureStore.getItemAsync(CSRF_TOKEN_KEY),
      SecureStore.getItemAsync(USER_KEY),
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

    return {
      accessToken: accessTokenMemory,
      refreshToken: refreshTokenMemory,
      csrfToken: csrfTokenMemory,
      user: currentUserMemory,
    };
  },

  async setSession(
    token: string | null,
    user?: UserProfile | null,
    credentials?: NativeSessionCredentials,
  ): Promise<void> {
    accessTokenMemory = token || null;

    if (accessTokenMemory) {
      await SecureStore.setItemAsync(ACCESS_TOKEN_KEY, accessTokenMemory);
    } else {
      await SecureStore.deleteItemAsync(ACCESS_TOKEN_KEY);
    }

    if (credentials !== undefined) {
      refreshTokenMemory = credentials.refreshToken;
      csrfTokenMemory = credentials.csrfToken;
      await Promise.all([
        SecureStore.setItemAsync(REFRESH_TOKEN_KEY, refreshTokenMemory),
        SecureStore.setItemAsync(CSRF_TOKEN_KEY, csrfTokenMemory),
      ]);
    }

    if (user !== undefined) {
      currentUserMemory = user ?? null;
      if (currentUserMemory) {
        await SecureStore.setItemAsync(USER_KEY, JSON.stringify(currentUserMemory));
      } else {
        await SecureStore.deleteItemAsync(USER_KEY);
      }
    }
  },

  async clearSession(): Promise<void> {
    accessTokenMemory = null;
    refreshTokenMemory = null;
    csrfTokenMemory = null;
    currentUserMemory = null;
    await Promise.all([
      SecureStore.deleteItemAsync(ACCESS_TOKEN_KEY),
      SecureStore.deleteItemAsync(REFRESH_TOKEN_KEY),
      SecureStore.deleteItemAsync(CSRF_TOKEN_KEY),
      SecureStore.deleteItemAsync(USER_KEY),
    ]);
  },

  getAccessToken(): string | null {
    return accessTokenMemory;
  },

  getRefreshToken(): string | null {
    return refreshTokenMemory;
  },

  getCsrfToken(): string | null {
    return csrfTokenMemory;
  },

  getCurrentUser(): UserProfile | null {
    return currentUserMemory;
  },
};
