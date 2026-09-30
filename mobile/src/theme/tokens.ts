export const palette = {
  brand: {
    lavender: '#6B73D9',
    navy: '#1E1A4D',
    lavenderPressed: '#565FC1',
    lavenderSubtle: '#F0F1FF',
    lavenderBorder: '#C7CBF3',
    navySubtle: '#2A2A59',
    onNavyMuted: '#D9D9F3',
  },
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
  emerald: {
    50: '#ECFDF5',
    200: '#A7F3D0',
    600: '#059669',
    700: '#047857',
    800: '#065F46',
  },
  amber: {
    50: '#FFFBEB',
    200: '#FDE68A',
    500: '#F59E0B',
    600: '#D97706',
  },
  red: {
    50: '#FEF2F2',
    200: '#FECACA',
    300: '#FCA5A5',
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
  primary: palette.brand.lavender,
  primaryPressed: palette.brand.lavenderPressed,
  primarySubtle: palette.brand.lavenderSubtle,
  primaryBorder: palette.brand.lavenderBorder,
  onPrimary: palette.white,
  success: palette.emerald[600],
  successSubtle: palette.emerald[50],
  successBorder: palette.emerald[200],
  warning: palette.amber[600],
  warningSubtle: palette.amber[50],
  warningBorder: palette.amber[200],
  danger: palette.red[600],
  dangerPressed: palette.red[700],
  dangerSubtle: palette.red[50],
  dangerBorder: palette.red[200],
} as const;

export const darkTheme = {
  background: palette.slate[900],
  surface: '#111B30',
  surfaceSubtle: palette.slate[800],
  text: palette.slate[100],
  textMuted: '#B6C0D0',
  textSubtle: palette.slate[500],
  border: palette.slate[700],
  borderStrong: palette.slate[700],
  primary: '#AEB2EE',
  primaryPressed: '#C7CBF3',
  primarySubtle: palette.brand.navySubtle,
  primaryBorder: palette.brand.lavender,
  onPrimary: palette.brand.navy,
  success: palette.emerald[600],
  successSubtle: '#052E24',
  successBorder: palette.emerald[800],
  warning: palette.amber[600],
  warningSubtle: '#451A03',
  warningBorder: palette.amber[600],
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
  // Raios semânticos: controles interativos não herdam o raio dos cards.
  button: 8,
  field: 12,
  card: 16,
  dialog: 18,
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
  role: {
    screenTitle: { fontSize: 21, lineHeight: 27, fontWeight: '700' },
    screenDescription: { fontSize: 13, lineHeight: 20, fontWeight: '400' },
    sectionTitle: { fontSize: 16, lineHeight: 21, fontWeight: '700' },
    body: { fontSize: 13, lineHeight: 20, fontWeight: '400' },
    bodyStrong: { fontSize: 13, lineHeight: 19, fontWeight: '600' },
    caption: { fontSize: 11, lineHeight: 15, fontWeight: '400' },
    label: { fontSize: 11, lineHeight: 15, fontWeight: '600' },
    link: { fontSize: 12, lineHeight: 17, fontWeight: '700' },
    button: { fontSize: 13, lineHeight: 18, fontWeight: '700' },
  },
} as const;

export const borders = {
  hairline: 0.5,
  subtle: 1,
} as const;

export const shadows = {
  card: {
    shadowColor: palette.brand.navy,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.07,
    shadowRadius: 12,
    elevation: 2,
  },
  cardDark: {
    shadowColor: palette.black,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.23,
    shadowRadius: 14,
    elevation: 2,
  },
  floating: {
    shadowColor: palette.brand.navy,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.12,
    shadowRadius: 14,
    elevation: 5,
  },
  modal: {
    shadowColor: '#0A0A23',
    shadowOffset: { width: 0, height: 22 },
    shadowOpacity: 0.24,
    shadowRadius: 30,
    elevation: 14,
  },
  modalDark: {
    shadowColor: palette.black,
    shadowOffset: { width: 0, height: 22 },
    shadowOpacity: 0.48,
    shadowRadius: 30,
    elevation: 14,
  },
} as const;

export const motion = {
  pressInDuration: 90,
  pressOutDuration: 150,
  pressScale: 0.98,
  routeAnimation: 'slide_from_right' as const,
  sheetAnimation: 'slide' as const,
  dialogAnimation: 'fade' as const,
} as const;

export const layout = {
  controlHeight: 48,
  buttonHeight: 46,
  screenHorizontalPadding: spacing[4],
  cardPadding: spacing[4],
} as const;
