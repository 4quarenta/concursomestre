import React from 'react';
import { useAuth } from '@/providers/AuthProvider';
import { ModulePlaceholderScreen } from '@/screens/ModulePlaceholderScreen';
import { QuestionsScreen } from '@/screens/QuestionsScreen';

export default function QuestionsRoute() {
  const { isFeatureEnabled } = useAuth();

  if (!isFeatureEnabled('practiceEnabled')) {
    return (
      <ModulePlaceholderScreen
        title="Questoes"
        cardTitle="Modulo indisponivel"
        description="O modulo Questoes esta desativado no momento para o seu perfil."
      />
    );
  }

  return <QuestionsScreen />;
}
