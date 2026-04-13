import * as SecureStore from 'expo-secure-store';
import type { UserProfile } from '@/types/auth';

const ACCESS_TOKEN_KEY = 'cm_mobile_access_token';
const USER_KEY = 'cm_mobile_user';

let accessTokenMemory: string | null = null;
let currentUserMemory: UserProfile | null = null;

/**
 * Persistencia de sessao para o app mobile.
 * @since v1.0.0
 */
export const sessionStore = {
  async hydrate(): Promise<{ accessToken: string | null; user: UserProfile | null }> {
    const [token, userRaw] = await Promise.all([
      SecureStore.getItemAsync(ACCESS_TOKEN_KEY),
      SecureStore.getItemAsync(USER_KEY),
    ]);

    accessTokenMemory = token || null;

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
      user: currentUserMemory,
    };
  },

  async setSession(token: string | null, user?: UserProfile | null): Promise<void> {
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
  },

  async clearSession(): Promise<void> {
    accessTokenMemory = null;
    currentUserMemory = null;
    await Promise.all([
      SecureStore.deleteItemAsync(ACCESS_TOKEN_KEY),
      SecureStore.deleteItemAsync(USER_KEY),
    ]);
  },

  getAccessToken(): string | null {
    return accessTokenMemory;
  },

  getCurrentUser(): UserProfile | null {
    return currentUserMemory;
  },
};
