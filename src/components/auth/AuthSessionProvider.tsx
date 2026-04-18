'use client';

import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { UserProfile } from '@/types';
import {
  bootstrapAuthSession,
  establishAuthenticatedSession,
  fetchAuthenticatedUser,
  getAuthSnapshot,
  logoutAuthSession,
  refreshAuthSession,
  type AuthSessionSnapshot,
} from '@/lib/authSession';

type AuthSessionContextValue = AuthSessionSnapshot & {
  isLoading: boolean;
  login: (token: string | null | undefined, user?: UserProfile | null) => Promise<AuthSessionSnapshot>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<UserProfile | null>;
  refreshSession: () => Promise<AuthSessionSnapshot>;
};

const AuthSessionContext = createContext<AuthSessionContextValue | null>(null);

export function AuthSessionProvider({ children }: { children: React.ReactNode }) {
  const [snapshot, setSnapshot] = useState<AuthSessionSnapshot>(getAuthSnapshot());
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    const runBootstrap = async () => {
      setIsLoading(true);

      try {
        const nextSnapshot = await bootstrapAuthSession();
        if (mounted) {
          setSnapshot(nextSnapshot);
        }
      } finally {
        if (mounted) {
          setIsLoading(false);
        }
      }
    };

    void runBootstrap();

    return () => {
      mounted = false;
    };
  }, []);

  const login = useCallback(async (token: string | null | undefined, user?: UserProfile | null) => {
    setIsLoading(true);

    try {
      const nextSnapshot = await establishAuthenticatedSession(token, user);
      setSnapshot(nextSnapshot);
      return nextSnapshot;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const logout = useCallback(async () => {
    setIsLoading(true);

    try {
      const nextSnapshot = await logoutAuthSession();
      setSnapshot(nextSnapshot);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const refreshUser = useCallback(async () => {
    try {
      const user = await fetchAuthenticatedUser();
      setSnapshot(getAuthSnapshot());
      return user;
    } catch {
      return null;
    }
  }, []);

  const refreshSession = useCallback(async () => {
    setIsLoading(true);

    try {
      const nextSnapshot = await refreshAuthSession();
      setSnapshot(nextSnapshot);
      return nextSnapshot;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const value = useMemo<AuthSessionContextValue>(() => ({
    ...snapshot,
    isLoading,
    login,
    logout,
    refreshUser,
    refreshSession,
  }), [snapshot, isLoading, login, logout, refreshUser, refreshSession]);

  return (
    <AuthSessionContext.Provider value={value}>
      {children}
    </AuthSessionContext.Provider>
  );
}

export function useAuthSession() {
  const context = useContext(AuthSessionContext);

  if (!context) {
    throw new Error('useAuthSession must be used inside AuthSessionProvider.');
  }

  return context;
}

