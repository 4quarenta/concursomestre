import React from 'react';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthProvider } from '@/providers/AuthProvider';
import { QueryProvider } from '@/providers/QueryProvider';

/**
 * Composicao unica dos providers globais do app.
 * Novos providers transversais devem entrar aqui, evitando arvore duplicada por rota.
 */
export const AppProviders: React.FC<React.PropsWithChildren> = ({ children }) => (
  <SafeAreaProvider>
    <QueryProvider>
      <AuthProvider>
        <StatusBar style="auto" />
        {children}
      </AuthProvider>
    </QueryProvider>
  </SafeAreaProvider>
);
