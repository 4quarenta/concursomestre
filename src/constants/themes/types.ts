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

import { LucideIcon } from 'lucide-react';

export interface ThemeConfig {
    heroBadge: string;
    heroGradient: string;
    bgOverlay: string;
    accent: string;
    button: string;
    icon: LucideIcon;
    forceMode?: 'light' | 'dark' | 'none';
    primaryColor?: string;
    ornaments?: string[];
}

export type ThemeRegistry = Record<string, ThemeConfig>;
