import { QueryClient } from '@tanstack/react-query';

/**
 * QueryClient compartilhado do frontend.
 * Ele concentra politicas de cache e retry para evitar rajadas desnecessarias no bootstrap.
 *
 * @since 1.0.0
 */
export const createAppQueryClient = () => new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60_000,
      gcTime: 5 * 60_000,
      retry: 1,
      refetchOnWindowFocus: false,
      refetchOnReconnect: true,
      refetchOnMount: false,
    },
    mutations: {
      retry: 0,
    },
  },
});

let browserQueryClient: QueryClient | null = null;

/**
 * Devolve o QueryClient singleton no browser para evitar reset de cache
 * em remounts de desenvolvimento (Strict Mode) e reduzir fetch duplicado.
 *
 * @since 1.0.0
 */
export const getAppQueryClient = (): QueryClient => {
  if (typeof window === 'undefined') {
    return createAppQueryClient();
  }

  if (!browserQueryClient) {
    browserQueryClient = createAppQueryClient();
  }

  return browserQueryClient;
};

export default createAppQueryClient;
