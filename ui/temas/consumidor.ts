import { ShoppingBag } from 'lucide-react';
import { ThemeConfig } from './types';

export const consumidorTheme: ThemeConfig = {
    heroBadge: '🛍️ DIA DO CONSUMIDOR: VOCÊ MERECE A PROVAÇÃO',
    heroGradient: 'from-rose-500 to-slate-800',
    bgOverlay: 'bg-rose-400',
    accent: 'text-rose-600 bg-rose-50',
    button: 'bg-slate-900 hover:bg-black',
    icon: ShoppingBag,
    forceMode: 'light',
    ornaments: ['price-tags']
};
