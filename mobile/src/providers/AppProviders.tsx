import React from 'react';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthProvider, useAuth } from '@/providers/AuthProvider';
import { QueryProvider, queryClient } from '@/providers/QueryProvider';

const QuerySessionBoundary: React.FC<React.PropsWithChildren> = ({ children }) => {
  const { user, isBootstrapped } = useAuth();
  const previousUserIdRef = React.useRef<string | null | undefined>(undefined);

  React.useEffect(() => {
    if (!isBootstrapped) return;

    const currentUserId = user?.id === undefined || user?.id === null
      ? null
      : String(user.id);
    const previousUserId = previousUserIdRef.current;

    if (previousUserId !== undefined && previousUserId !== currentUserId) {
      queryClient.clear();
    }

    previousUserIdRef.current = currentUserId;
  }, [isBootstrapped, user?.id]);

  return <>{children}</>;
};

/**
 * Composicao unica dos providers globais do app.
 * Novos providers transversais devem entrar aqui, evitando arvore duplicada por rota.
 */
export const AppProviders: React.FC<React.PropsWithChildren> = ({ children }) => (
  <SafeAreaProvider>
    <QueryProvider>
      <AuthProvider>
        <QuerySessionBoundary>
          <StatusBar style="auto" />
          {children}
        </QuerySessionBoundary>
      </AuthProvider>
    </QueryProvider>
  </SafeAreaProvider>
);
