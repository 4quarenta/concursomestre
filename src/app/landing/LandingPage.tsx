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
import type { SystemSettings } from '@types';
import LandingCommercialPage from './components/LandingCommercialPage';
import type { HomeFeaturedOrganization, HomeLatestArticle } from './homeSeoServerData';

const LandingPage: React.FC<{
  initialSystemSettings?: SystemSettings | null;
  latestArticles?: HomeLatestArticle[];
  featuredOrganizations?: HomeFeaturedOrganization[];
}> = ({ initialSystemSettings = null, latestArticles = [], featuredOrganizations = [] }) => (
  <LandingCommercialPage
    initialSystemSettings={initialSystemSettings}
    latestArticles={latestArticles}
    featuredOrganizations={featuredOrganizations}
  />
);

export default LandingPage;
