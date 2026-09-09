export const palette = {
  slate: {
    50: '#F8FAFC',
    100: '#F1F5F9',
    200: '#E2E8F0',
    300: '#CBD5E1',
    400: '#94A3B8',
    500: '#64748B',
    600: '#475569',
    700: '#334155',
    800: '#1E293B',
    900: '#0F172A',
    950: '#020617',
  },
  indigo: {
    50: '#EEF2FF',
    100: '#E0E7FF',
    200: '#C7D2FE',
    300: '#A5B4FC',
    400: '#818CF8',
    500: '#6366F1',
    600: '#4F46E5',
    700: '#4338CA',
    800: '#3730A3',
    900: '#312E81',
    950: '#1E1B4B',
  },
  emerald: {
    50: '#ECFDF5',
    600: '#059669',
    700: '#047857',
  },
  amber: {
    50: '#FFFBEB',
    500: '#F59E0B',
    600: '#D97706',
  },
  red: {
    50: '#FEF2F2',
    200: '#FECACA',
    600: '#DC2626',
    700: '#B91C1C',
    800: '#991B1B',
  },
  white: '#FFFFFF',
  black: '#000000',
} as const;

export const lightTheme = {
  background: palette.slate[50],
  surface: palette.white,
  surfaceSubtle: palette.slate[100],
  text: palette.slate[900],
  textMuted: palette.slate[500],
  textSubtle: palette.slate[400],
  border: palette.slate[200],
  borderStrong: palette.slate[300],
  primary: palette.indigo[600],
  primaryPressed: palette.indigo[700],
  primarySubtle: palette.indigo[50],
  primaryBorder: palette.indigo[200],
  onPrimary: palette.white,
  success: palette.emerald[600],
  successSubtle: palette.emerald[50],
  warning: palette.amber[500],
  warningSubtle: palette.amber[50],
  danger: palette.red[600],
  dangerPressed: palette.red[700],
  dangerSubtle: palette.red[50],
  dangerBorder: palette.red[200],
} as const;

export const darkTheme = {
  background: palette.slate[900],
  surface: palette.slate[900],
  surfaceSubtle: palette.slate[800],
  text: palette.slate[100],
  textMuted: palette.slate[400],
  textSubtle: palette.slate[500],
  border: palette.slate[800],
  borderStrong: palette.slate[700],
  primary: palette.indigo[400],
  primaryPressed: palette.indigo[300],
  primarySubtle: palette.indigo[950],
  primaryBorder: palette.indigo[800],
  onPrimary: palette.slate[950],
  success: palette.emerald[600],
  successSubtle: '#052E24',
  warning: palette.amber[500],
  warningSubtle: '#451A03',
  danger: palette.red[600],
  dangerPressed: palette.red[700],
  dangerSubtle: '#450A0A',
  dangerBorder: palette.red[800],
} as const;

export const spacing = {
  0: 0,
  1: 4,
  2: 8,
  3: 12,
  4: 16,
  5: 20,
  6: 24,
  8: 32,
  10: 40,
  12: 48,
} as const;

export const radius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  pill: 999,
} as const;

export const typography = {
  size: {
    xs: 12,
    sm: 14,
    md: 16,
    lg: 18,
    xl: 20,
    '2xl': 24,
    '3xl': 30,
  },
  weight: {
    regular: '400',
    medium: '500',
    semibold: '600',
    bold: '700',
    extrabold: '800',
    black: '900',
  },
} as const;

export const layout = {
  controlHeight: 48,
  screenHorizontalPadding: spacing[4],
  cardPadding: spacing[4],
} as const;

export type AppTheme = typeof lightTheme;
