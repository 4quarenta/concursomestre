import { lightTheme } from '@/theme/tokens';

/**
 * Adaptador temporario para o codigo mobile legado.
 * Novos componentes devem consumir tokens/tema sem criar cores locais.
 */
export const colors = {
  bg: lightTheme.background,
  card: lightTheme.surface,
  text: lightTheme.text,
  muted: lightTheme.textMuted,
  border: lightTheme.border,
  primary: lightTheme.primary,
  primaryDark: lightTheme.primaryPressed,
  success: lightTheme.success,
  warning: lightTheme.warning,
  danger: lightTheme.danger,
} as const;
