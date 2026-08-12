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

import { Timer } from 'lucide-react';
import { ThemeConfig } from './types';

export const blackNovemberTheme: ThemeConfig = {
    heroBadge: '🏴 BLACK NOVEMBER: O MÊS TODO COM DESCONTO',
    heroGradient: 'from-amber-400 via-amber-500 to-amber-700',
    bgOverlay: 'bg-zinc-900',
    accent: 'text-amber-500 bg-zinc-900',
    button: 'bg-amber-700 hover:bg-amber-800',
    icon: Timer,
    forceMode: 'dark',
    ornaments: ['sliding-amber']
};
