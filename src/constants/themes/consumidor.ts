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

import { ShoppingBag } from 'lucide-react';
import { ThemeConfig } from './types';

export const consumidorTheme: ThemeConfig = {
    heroBadge: 'ðŸ›ï¸ DIA DO CONSUMIDOR: VOCÃŠ MERECE A PROVAÃ‡ÃƒO',
    heroGradient: 'from-rose-500 to-slate-800',
    bgOverlay: 'bg-rose-400',
    accent: 'text-rose-600 bg-rose-50',
    button: 'bg-slate-900 hover:bg-black',
    icon: ShoppingBag,
    forceMode: 'light',
    ornaments: ['price-tags']
};
