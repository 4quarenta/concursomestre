import React from 'react';
import { Stack } from 'expo-router';
import { typography } from '@/theme/tokens';
import { useAppTheme } from '@/theme/useAppTheme';

export default function AppLayout() {
  const theme = useAppTheme();

  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: theme.surface },
        headerTintColor: theme.text,
        headerTitleStyle: { fontWeight: typography.weight.extrabold },
        contentStyle: { backgroundColor: theme.background },
      }}
    >
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="simulados/novo" options={{ title: 'Novo simulado' }} />
      <Stack.Screen name="SimulationRun" options={{ title: 'Simulado em andamento', headerBackVisible: false }} />
      <Stack.Screen name="simulados/historico/[simulationId]" options={{ title: 'Detalhe do simulado' }} />
      <Stack.Screen name="MainTabs" options={{ title: 'Planos' }} />
      <Stack.Screen name="Checkout" options={{ title: 'Checkout' }} />
    </Stack>
  );
}
