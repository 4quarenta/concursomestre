import React from 'react';
import { Redirect, useLocalSearchParams } from 'expo-router';
import { PlansScreen } from '@/screens/PlansScreen';

/**
 * Ponte temporaria para chamadas legadas `navigate('MainTabs', { screen })`.
 * Sera removida quando Conta/Planos migrarem integralmente na fase de account.
 */
export default function LegacyMainTabsRoute() {
  const { screen } = useLocalSearchParams<{ screen?: string }>();

  if (screen === 'Planos') {
    return <PlansScreen />;
  }

  return <Redirect href="/questoes" />;
}
