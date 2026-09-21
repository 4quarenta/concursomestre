import React from 'react';
import { ModulePlaceholderScreen } from '@/screens/ModulePlaceholderScreen';

/**
 * Shell mobile da area de Lei comentada.
 * Mantem paridade com a superficie beta da web enquanto o modulo real nao e ativado.
 * @since v1.0.0
 */
export const AnnotatedLawsScreen: React.FC = () => (
  <ModulePlaceholderScreen
    title="Lei comentada"
    description="Espaco reservado para consulta guiada de legislacao com anotacoes, contexto e navegacao por modulo."
  />
);

export default AnnotatedLawsScreen;
