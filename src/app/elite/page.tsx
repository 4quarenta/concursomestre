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
import MarketingPlansLandingPage from '../planos/components/MarketingPlansLandingPage';

/**
 * Shell publico da landing comercial dedicada ao Plano Elite.
 * Mantem a rota /elite enxuta e delega a composicao ao renderer oficial de landing pages.
 *
 * @since v1.0.0
 */
const EliteLandingPage: React.FC = () => <MarketingPlansLandingPage slug="elite" />;

export default EliteLandingPage;
