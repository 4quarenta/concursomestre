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
import { useParams } from 'react-router-dom';
import MarketingPlansLandingPage from '../planos/components/MarketingPlansLandingPage';

/**
 * Shell generico das landing pages comerciais publicadas em /l/:slug.
 * Hoje o renderer inicial cobre a landing de planos e prepara o caminho para novas campanhas.
 *
 * @since v1.0.0
 */
const LandingCampaignPage: React.FC = () => {
  const { slug = '' } = useParams<{ slug?: string }>();
  return <MarketingPlansLandingPage slug={slug} />;
};

export default LandingCampaignPage;
