import React from 'react';
import { useAuth } from '@/providers/AuthProvider';
import { ModulePlaceholderScreen } from '@/screens/ModulePlaceholderScreen';
import { SimulationsScreen } from '@/features/simulations/screens/SimulationsScreen';

export default function SimulationsRoute() {
  const { isFeatureEnabled } = useAuth();

  if (!isFeatureEnabled('simulationsEnabled')) {
    return (
      <ModulePlaceholderScreen
        title="Simulados"
        cardTitle="Modulo indisponivel"
        description="O modulo Simulados esta desativado no momento para o seu perfil."
      />
    );
  }

  return <SimulationsScreen />;
}
