import React from 'react';
import { ModulePlaceholderScreen } from '@/screens/ModulePlaceholderScreen';

/**
 * Shell mobile da area de Flashcards.
 * Mantem paridade com a superficie beta da web enquanto repeticao espacada e trilhas ainda nao foram implementadas.
 * @since v1.0.0
 */
export const FlashcardsScreen: React.FC = () => (
  <ModulePlaceholderScreen
    title="Flashcards"
    description="Espaco reservado para revisao ativa com cartas, repeticao espacada e trilhas de memorizacao."
  />
);

export default FlashcardsScreen;
