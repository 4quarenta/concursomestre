import type { CSSProperties } from 'react';
import type { AppPromotionTheme, SystemSettings } from '@types';

export type PromotionThemeMotif = 'default' | 'black-friday' | 'sao-joao' | 'carnaval' | 'academic' | 'celebration' | 'shopping';

export interface PromotionThemePresentation {
  id: AppPromotionTheme;
  label: string;
  heroMessage: string;
  mastheadMessage: string;
  motif: PromotionThemeMotif;
  colors: {
    page: string;
    header: string;
    headerInk: string;
    hero: string;
    ink: string;
    muted: string;
    accent: string;
    accentInk: string;
    accentSoft: string;
    border: string;
  };
}

const PRESENTATIONS: Record<AppPromotionTheme, PromotionThemePresentation> = {
  default: {
    id: 'default',
    label: 'ConcursoMestre',
    heroMessage: 'Preparação com direção',
    mastheadMessage: '',
    motif: 'default',
    colors: {
      page: '#ffffff',
      header: 'rgba(255, 255, 255, 0.94)',
      headerInk: '#07103a',
      hero: '#ffffff',
      ink: '#07103a',
      muted: '#475569',
      accent: '#684cff',
      accentInk: '#ffffff',
      accentSoft: '#edeaff',
      border: '#e2e8f0',
    },
  },
  'black-friday': {
    id: 'black-friday',
    label: 'BLACK FRIDAY',
    heroMessage: 'Aprovação em oferta',
    mastheadMessage: 'Desconto forte para acelerar sua preparação.',
    motif: 'black-friday',
    colors: {
      page: '#fffdf5',
      header: 'rgba(15, 15, 15, 0.96)',
      headerInk: '#fef3c7',
      hero: '#111111',
      ink: '#fffdf5',
      muted: '#e5e7eb',
      accent: '#facc15',
      accentInk: '#171717',
      accentSoft: '#422006',
      border: '#facc15',
    },
  },
  'black-november': {
    id: 'black-november',
    label: 'BLACK NOVEMBER',
    heroMessage: 'O mês inteiro para estudar melhor',
    mastheadMessage: 'Uma temporada de condições especiais para sua rotina.',
    motif: 'black-friday',
    colors: {
      page: '#fffdf5',
      header: 'rgba(24, 24, 27, 0.96)',
      headerInk: '#fde68a',
      hero: '#18181b',
      ink: '#fff7ed',
      muted: '#e4e4e7',
      accent: '#f59e0b',
      accentInk: '#1c1917',
      accentSoft: '#451a03',
      border: '#f59e0b',
    },
  },
  estudante: {
    id: 'estudante',
    label: 'VOLTA ÀS AULAS',
    heroMessage: 'Preparação total para o próximo passo',
    mastheadMessage: 'Organize sua rotina e volte a estudar com método.',
    motif: 'academic',
    colors: {
      page: '#f8fbff',
      header: 'rgba(239, 246, 255, 0.96)',
      headerInk: '#172554',
      hero: '#eff6ff',
      ink: '#172554',
      muted: '#475569',
      accent: '#2563eb',
      accentInk: '#ffffff',
      accentSoft: '#dbeafe',
      border: '#93c5fd',
    },
  },
  'sao-joao': {
    id: 'sao-joao',
    label: 'SÃO JOÃO',
    heroMessage: 'Acenda a fogueira do seu conhecimento',
    mastheadMessage: 'Uma campanha arretada para manter o estudo aquecido.',
    motif: 'sao-joao',
    colors: {
      page: '#fffaf2',
      header: 'rgba(30, 41, 59, 0.96)',
      headerInk: '#fef3c7',
      hero: '#1e293b',
      ink: '#fff7ed',
      muted: '#ffedd5',
      accent: '#fb923c',
      accentInk: '#431407',
      accentSoft: '#7c2d12',
      border: '#fbbf24',
    },
  },
  carnaval: {
    id: 'carnaval',
    label: 'CARNAVAL',
    heroMessage: 'Folia da aprovação',
    mastheadMessage: 'Cor, ritmo e foco para colocar sua aprovação na avenida.',
    motif: 'carnaval',
    colors: {
      page: '#fff7fb',
      header: 'rgba(255, 247, 251, 0.96)',
      headerInk: '#3b0764',
      hero: '#3b0764',
      ink: '#fff7fb',
      muted: '#fce7f3',
      accent: '#f0abfc',
      accentInk: '#3b0764',
      accentSoft: '#701a75',
      border: '#22d3ee',
    },
  },
  'ano-novo': {
    id: 'ano-novo',
    label: 'ANO NOVO',
    heroMessage: 'Uma nova chance de aprovação',
    mastheadMessage: 'Comece o ano com uma rotina mais clara e consistente.',
    motif: 'celebration',
    colors: {
      page: '#f8fafc',
      header: 'rgba(15, 23, 42, 0.96)',
      headerInk: '#fef08a',
      hero: '#0f172a',
      ink: '#f8fafc',
      muted: '#cbd5e1',
      accent: '#fde047',
      accentInk: '#422006',
      accentSoft: '#713f12',
      border: '#facc15',
    },
  },
  pascoa: {
    id: 'pascoa',
    label: 'PÁSCOA',
    heroMessage: 'Colha conhecimento todos os dias',
    mastheadMessage: 'Uma oportunidade leve para renovar sua preparação.',
    motif: 'celebration',
    colors: {
      page: '#f5fffb',
      header: 'rgba(236, 253, 245, 0.96)',
      headerInk: '#064e3b',
      hero: '#ecfdf5',
      ink: '#064e3b',
      muted: '#475569',
      accent: '#059669',
      accentInk: '#ffffff',
      accentSoft: '#d1fae5',
      border: '#6ee7b7',
    },
  },
  consumidor: {
    id: 'consumidor',
    label: 'DIA DO CONSUMIDOR',
    heroMessage: 'Você merece uma preparação melhor',
    mastheadMessage: 'Condições especiais para investir no seu próximo passo.',
    motif: 'shopping',
    colors: {
      page: '#fff7f9',
      header: 'rgba(255, 241, 242, 0.96)',
      headerInk: '#4c0519',
      hero: '#4c0519',
      ink: '#fff1f2',
      muted: '#ffe4e6',
      accent: '#fb7185',
      accentInk: '#4c0519',
      accentSoft: '#881337',
      border: '#fda4af',
    },
  },
};

const isPromotionTheme = (value: unknown): value is AppPromotionTheme => (
  typeof value === 'string' && Object.prototype.hasOwnProperty.call(PRESENTATIONS, value)
);

export const resolvePromotionThemeId = (
  settings?: Pick<SystemSettings, 'activeTheme' | 'activePromotion'> | null,
): AppPromotionTheme => {
  if (settings && isPromotionTheme(settings.activeTheme) && settings.activeTheme !== 'default') {
    return settings.activeTheme;
  }

  const promotion = settings?.activePromotion;
  const promotionIsActive = Boolean(promotion?.isActive) || String((promotion as { status?: unknown } | undefined)?.status || '').toLowerCase() === 'active';
  const promotionSlug = promotion?.slug;

  if (promotionIsActive && isPromotionTheme(promotionSlug) && promotionSlug !== 'default') {
    return promotionSlug;
  }

  return isPromotionTheme(settings?.activeTheme) ? settings.activeTheme : 'default';
};

export const getPromotionThemePresentation = (themeId: AppPromotionTheme): PromotionThemePresentation => (
  PRESENTATIONS[themeId] || PRESENTATIONS.default
);

export const getPromotionThemeCssVars = (themeId: AppPromotionTheme): CSSProperties => {
  const { colors } = getPromotionThemePresentation(themeId);

  return {
    '--cm-theme-page': colors.page,
    '--cm-theme-header': colors.header,
    '--cm-theme-header-ink': colors.headerInk,
    '--cm-theme-hero': colors.hero,
    '--cm-theme-ink': colors.ink,
    '--cm-theme-muted': colors.muted,
    '--cm-theme-accent': colors.accent,
    '--cm-theme-accent-ink': colors.accentInk,
    '--cm-theme-accent-soft': colors.accentSoft,
    '--cm-theme-border': colors.border,
  } as CSSProperties;
};
