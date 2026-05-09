'use client';

import React from 'react';
import { QueryClientProvider } from '@tanstack/react-query';
import { getAppQueryClient } from '@/state/query/queryClient';

interface QueryProviderProps {
  children: React.ReactNode;
}

/**
 * Provider raiz do TanStack Query.
 * Mantem um unico QueryClient por sessao do app.
 *
 * @since 1.0.0
 */
export const QueryProvider: React.FC<QueryProviderProps> = ({ children }) => {
  const [queryClient] = React.useState(() => getAppQueryClient());

  return (
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  );
};

export default QueryProvider;
