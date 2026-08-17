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

const LandingPage: React.FC<{ initialSystemSettings?: SystemSettings | null }> = ({ initialSystemSettings = null }) => (
  <LandingCommercialPage initialSystemSettings={initialSystemSettings} />
);

export default LandingPage;
