'use client';

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
import MarketingPlansLandingPage from './components/MarketingPlansLandingPage';

/**
 * Shell publico da landing oficial de planos.
 * Mantem a rota /planos enxuta e delega a composicao para componentes locais.
 *
 * @since v1.0.0
 */
const PlanosPage: React.FC = () => {
  return <MarketingPlansLandingPage slug="planos" />;
};

export default PlanosPage;
