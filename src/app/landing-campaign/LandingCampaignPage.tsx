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
import MarketingPlansLandingPage from '../planos/components/MarketingPlansLandingPage';

/**
 * Shell generico das landing pages comerciais publicadas em /l/:slug.
 * Hoje o renderer inicial cobre a landing de planos e prepara o caminho para novas campanhas.
 *
 * @since v1.0.0
 */
const LandingCampaignPage: React.FC<{ slug: string }> = ({ slug }) => {
  return <MarketingPlansLandingPage slug={slug} />;
};

export default LandingCampaignPage;
