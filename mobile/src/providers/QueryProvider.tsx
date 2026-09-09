import React from 'react';
import { AppState, Platform, type AppStateStatus } from 'react-native';
import {
  QueryClient,
  QueryClientProvider,
  focusManager,
} from '@tanstack/react-query';

const shouldRetryQuery = (failureCount: number, error: unknown): boolean => {
  const status = (error as { response?: { status?: number } } | undefined)?.response?.status;

  if (typeof status === 'number' && status >= 400 && status < 500) {
    return false;
  }

  return failureCount < 1;
};

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60_000,
      gcTime: 10 * 60_000,
      retry: shouldRetryQuery,
      refetchOnReconnect: true,
    },
    mutations: {
      retry: false,
    },
  },
});

const onAppStateChange = (status: AppStateStatus): void => {
  if (Platform.OS !== 'web') {
    focusManager.setFocused(status === 'active');
  }
};

/**
 * Fonte unica para cache e estado remoto do app.
 * Telas devem migrar carregamentos manuais para queries/mutations por feature.
 */
export const QueryProvider: React.FC<React.PropsWithChildren> = ({ children }) => {
  React.useEffect(() => {
    const subscription = AppState.addEventListener('change', onAppStateChange);
    return () => subscription.remove();
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  );
};
