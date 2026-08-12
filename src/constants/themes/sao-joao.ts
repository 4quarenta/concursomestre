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

import { Flame } from 'lucide-react';
import { ThemeConfig } from './types';

export const saoJoaoTheme: ThemeConfig = {
    heroBadge: '🔥 SÃO JOÃO: ACENDA A FOGUEIRA DO SEU CONHECIMENTO',
    heroGradient: 'from-orange-600 to-red-600',
    bgOverlay: 'bg-orange-400',
    accent: 'text-orange-600 bg-orange-50',
    button: 'bg-orange-700 hover:bg-orange-800',
    icon: Flame,
    forceMode: 'light',
    ornaments: ['flags', 'fire']
};
