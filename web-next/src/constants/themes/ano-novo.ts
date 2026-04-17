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

import { Sparkles } from 'lucide-react';
import { ThemeConfig } from './types';

export const anoNovoTheme: ThemeConfig = {
    heroBadge: '🎆 ANO NOVO: UMA NOVA CHANCE DE APROVAÇÃO',
    heroGradient: 'from-amber-200 via-yellow-400 to-amber-600',
    bgOverlay: 'bg-indigo-950',
    accent: 'text-amber-400 bg-indigo-900',
    button: 'bg-amber-600 hover:bg-amber-700',
    icon: Sparkles,
    forceMode: 'dark',
    ornaments: ['fireworks']
};
