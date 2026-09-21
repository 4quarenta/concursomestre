import React from "react";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { AppErrorBoundary } from "@/components/AppErrorBoundary";
import { AuthProvider, useAuth } from "@/providers/AuthProvider";
import { AppearanceProvider } from "@/providers/AppearanceProvider";
import { QueryProvider, queryClient } from "@/providers/QueryProvider";
import { analyticsService } from "@/services/analytics/analyticsService";

const QuerySessionBoundary: React.FC<React.PropsWithChildren> = ({
  children,
}) => {
  const { user, isBootstrapped } = useAuth();
  const previousUserIdRef = React.useRef<string | null | undefined>(undefined);

  React.useEffect(() => {
    if (!isBootstrapped) return;

    const currentUserId =
      user?.id === undefined || user?.id === null ? null : String(user.id);
    const previousUserId = previousUserIdRef.current;

    if (previousUserId !== undefined && previousUserId !== currentUserId) {
      queryClient.clear();
    }

    previousUserIdRef.current = currentUserId;
  }, [isBootstrapped, user?.id]);

  return <>{children}</>;
};

const AnalyticsSessionBoundary: React.FC<React.PropsWithChildren> = ({
  children,
}) => {
  const { user } = useAuth();

  React.useEffect(() => {
    void analyticsService.initialize();
  }, []);

  React.useEffect(() => {
    void analyticsService.setUserId(user?.id);
  }, [user?.id]);

  return <>{children}</>;
};

/**
 * Composicao unica dos providers globais do app.
 * Novos providers transversais devem entrar aqui, evitando arvore duplicada por rota.
 */
export const AppProviders: React.FC<React.PropsWithChildren> = ({
  children,
}) => (
  <SafeAreaProvider>
    <AppearanceProvider>
      <AppErrorBoundary onReset={() => queryClient.resetQueries()}>
        <QueryProvider>
          <AuthProvider>
            <AnalyticsSessionBoundary>
              <QuerySessionBoundary>{children}</QuerySessionBoundary>
            </AnalyticsSessionBoundary>
          </AuthProvider>
        </QueryProvider>
      </AppErrorBoundary>
    </AppearanceProvider>
  </SafeAreaProvider>
);
