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

import { PartyPopper } from 'lucide-react';
import { ThemeConfig } from './types';

export const carnavalTheme: ThemeConfig = {
    heroBadge: '🎉 CARNAVAL: FOLIA DA APROVAÇÃO',
    heroGradient: 'from-fuchsia-600 to-purple-600',
    bgOverlay: 'bg-fuchsia-400',
    accent: 'text-fuchsia-600 bg-fuchsia-50',
    button: 'bg-indigo-600 hover:bg-indigo-700',
    icon: PartyPopper,
    forceMode: 'light',
    ornaments: ['confetti']
};
