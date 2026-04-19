export const adminDesignTokens = {
  color: {
    canvas: '#f8faf9',
    surface: '#ffffff',
    surfaceMuted: '#eef4ef',
    ink: '#16211d',
    muted: '#5f6f68',
    line: '#d8e2dc',
    accent: '#0f766e',
    accentStrong: '#115e59',
    revenue: '#15803d',
    warning: '#a16207',
    danger: '#b42318',
    info: '#2563eb',
  },
  radius: {
    sm: '4px',
    md: '6px',
    lg: '8px',
  },
  shadow: {
    panel: '0 18px 48px rgba(22, 33, 29, 0.08)',
    focus: '0 0 0 3px rgba(15, 118, 110, 0.18)',
  },
  layout: {
    sidebarWidth: '292px',
    contentMaxWidth: '1440px',
    topbarHeight: '64px',
  },
} as const;

export type AdminDesignTokens = typeof adminDesignTokens;

export const adminSeverityTokens = {
  critical: {
    label: 'Critico',
    className: 'border-red-200 bg-red-50 text-red-800',
    dotClassName: 'bg-red-600',
  },
  high: {
    label: 'Alto',
    className: 'border-amber-200 bg-amber-50 text-amber-800',
    dotClassName: 'bg-amber-600',
  },
  medium: {
    label: 'Medio',
    className: 'border-blue-200 bg-blue-50 text-blue-800',
    dotClassName: 'bg-blue-600',
  },
  low: {
    label: 'Baixo',
    className: 'border-zinc-200 bg-zinc-50 text-zinc-700',
    dotClassName: 'bg-zinc-500',
  },
  healthy: {
    label: 'Saudavel',
    className: 'border-emerald-200 bg-emerald-50 text-emerald-800',
    dotClassName: 'bg-emerald-600',
  },
} as const;

export type AdminSeverityTokenKey = keyof typeof adminSeverityTokens;
