import { Flame } from 'lucide-react';
import { ThemeConfig } from './types';

export const saoJoaoTheme: ThemeConfig = {
    heroBadge: '🔥 SÃO JOÃO: ACENDA A FOGUEIRA DO SEU CONHECIMENTO',
    heroGradient: 'from-orange-600 to-red-600',
    bgOverlay: 'bg-orange-400',
    accent: 'text-orange-600 bg-orange-50',
    button: 'bg-orange-600 hover:bg-orange-700',
    icon: Flame,
    forceMode: 'light',
    ornaments: ['flags', 'fire']
};
