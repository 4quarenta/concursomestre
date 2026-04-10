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
import { FileText } from 'lucide-react';
import { useData } from '@providers/DataProvider';
import BetaFeaturePage from '../../components/shared/feedback/BetaFeaturePage';

const AnnotatedLawsPage: React.FC = () => {
  const { systemSettings } = useData();

  return (
    <BetaFeaturePage
      title="Lei comentada"
      description="Espaco reservado para consulta guiada de legislacao com anotacoes, contexto e navegacao por modulo."
      icon={FileText}
      isEnabled={systemSettings.features.annotatedLawsEnabled}
      featureLabel="Lei comentada"
    />
  );
};

export default AnnotatedLawsPage;
