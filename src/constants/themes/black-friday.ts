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

import { Zap } from 'lucide-react';
import { ThemeConfig } from './types';

export const blackFridayTheme: ThemeConfig = {
    heroBadge: '🔥 BLACK FRIDAY: APROVAÇÃO EM OFERTA',
    heroGradient: 'from-yellow-400 via-amber-500 to-yellow-600',
    bgOverlay: 'bg-zinc-900',
    accent: 'text-amber-500 bg-zinc-900',
    button: 'bg-amber-700 hover:bg-amber-800',
    icon: Zap,
    forceMode: 'dark',
    ornaments: ['yellow-lights']
};
