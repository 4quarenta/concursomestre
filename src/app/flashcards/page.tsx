/*
* ----------------------------------------------------
* @author: 4quarenta
* @author URI: https://github.com/4quarenta
* @copyright: (c) 2026 ConcursoMestre. All rights reserved
* ----------------------------------------------------
*
* @since 1.0.0
*
*/

import React from 'react';
import { Layers } from 'lucide-react';
import { useData } from '@providers/DataProvider';
import BetaFeaturePage from '../../components/shared/feedback/BetaFeaturePage';

const FlashcardsPage: React.FC = () => {
  const { systemSettings } = useData();

  return (
    <BetaFeaturePage
      title="Flashcards"
      description="Espaco reservado para revisao ativa com cartas, repeticao espacada e trilhas de memorizacao."
      icon={Layers}
      isEnabled={systemSettings.features.flashcardsEnabled}
      featureLabel="Flashcards"
    />
  );
};

export default FlashcardsPage;
