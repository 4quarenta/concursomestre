import { Timer } from 'lucide-react';
import { ThemeConfig } from './types';

export const blackNovemberTheme: ThemeConfig = {
    heroBadge: '🏴 BLACK NOVEMBER: O MÊS TODO COM DESCONTO',
    heroGradient: 'from-amber-400 via-amber-500 to-amber-700',
    bgOverlay: 'bg-zinc-900',
    accent: 'text-amber-500 bg-zinc-900',
    button: 'bg-amber-600 hover:bg-amber-700',
    icon: Timer,
    forceMode: 'dark',
    ornaments: ['sliding-amber']
};
