import { LucideIcon, BrainCircuit } from 'lucide-react';

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
