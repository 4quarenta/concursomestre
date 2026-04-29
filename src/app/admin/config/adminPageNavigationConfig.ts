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

/**
 * Define os dominios e secoes oficiais do painel administrativo.
 * Essa estrutura alimenta o shell, as tabs e a compatibilidade com links legados.
 *
 * @since 1.0.0
 */
export type AdminPageTab = 'panel' | 'operation' | 'marketplace' | 'finance' | 'marketing' | 'support' | 'settings';
export type AdminPanelSection = 'dashboard' | 'alerts' | 'billing-health';
export type AdminOperationSection = 'questions' | 'question-groups' | 'exams' | 'import' | 'filters' | 'lei-comentada' | 'users';
export type AdminMarketplaceSection = 'vendors' | 'materials' | 'blocked';
export type AdminFinanceSection = 'transactions' | 'plans' | 'coupons' | 'automation' | 'analytics';
export type AdminMarketingSection = 'landing-pages' | 'campaigns' | 'visual-themes' | 'social-links';
export type AdminSupportSection = 'feedback' | 'threads' | 'reports' | 'rankings' | 'refunds' | 'comments';
export type AdminSettingsSection = 'general' | 'modules' | 'security' | 'integrations' | 'email' | 'ads' | 'seo' | 'performance' | 'logs';

export type AdminNavigationTab = {
  key: AdminPageTab;
  label: string;
  icon: any;
  badge?: number;
  group?: string;
  description: string;
};

export type AdminNavigationSection = {
  key: string;
  label: string;
};

export const TAB_DESCRIPTIONS: Record<AdminPageTab, string> = {
  panel: 'Visao executiva, alertas operacionais e saude do billing.',
  operation: 'Questoes, provas, importacao, taxonomias, lei comentada e usuarios.',
  marketplace: 'Vendedores, catalogo publicado e revisoes bloqueadas do marketplace.',
  finance: 'Transacoes, planos, cupons, analytics e automacao financeira.',
  marketing: 'Landing pages, campanhas, temas visuais e redes sociais da homepage.',
  support: 'Feedbacks, denuncias, comentarios moderados, rankings e reembolsos operacionais.',
  settings: 'Controles globais, integracoes, email, ads, SEO e logs.',
};

export const PANEL_SECTION_KEYS = ['dashboard', 'alerts', 'billing-health'] as const;
export const OPERATION_SECTION_KEYS = ['questions', 'question-groups', 'exams', 'import', 'filters', 'lei-comentada', 'users'] as const;
export const MARKETPLACE_SECTION_KEYS = ['vendors', 'materials', 'blocked'] as const;
export const FINANCE_SECTION_KEYS = ['transactions', 'plans', 'coupons', 'automation', 'analytics'] as const;
export const MARKETING_SECTION_KEYS = ['landing-pages', 'campaigns', 'visual-themes', 'social-links'] as const;
export const SUPPORT_SECTION_KEYS = ['feedback', 'threads', 'reports', 'rankings', 'refunds', 'comments'] as const;
export const SETTINGS_SECTION_KEYS = ['general', 'modules', 'security', 'integrations', 'email', 'ads', 'seo', 'performance', 'logs'] as const;

/**
 * Valida a secao do grupo Painel.
 *
 * @since 1.0.0
 */
export const isPanelSection = (tab: string): tab is AdminPanelSection => PANEL_SECTION_KEYS.includes(tab as AdminPanelSection);

/**
 * Valida a secao do grupo Operacao.
 *
 * @since 1.0.0
 */
export const isOperationSection = (tab: string): tab is AdminOperationSection => OPERATION_SECTION_KEYS.includes(tab as AdminOperationSection);

/**
 * Valida a secao do grupo Marketplace.
 *
 * @since 1.0.0
 */
export const isMarketplaceSection = (tab: string): tab is AdminMarketplaceSection => MARKETPLACE_SECTION_KEYS.includes(tab as AdminMarketplaceSection);

/**
 * Valida a secao do grupo Financeiro.
 *
 * @since 1.0.0
 */
export const isFinanceSection = (tab: string): tab is AdminFinanceSection => FINANCE_SECTION_KEYS.includes(tab as AdminFinanceSection);

/**
 * Valida a secao do grupo Marketing.
 *
 * @since 1.0.0
 */
export const isMarketingSection = (tab: string): tab is AdminMarketingSection => MARKETING_SECTION_KEYS.includes(tab as AdminMarketingSection);

/**
 * Valida a secao do grupo Suporte.
 *
 * @since 1.0.0
 */
export const isSupportSection = (tab: string): tab is AdminSupportSection => SUPPORT_SECTION_KEYS.includes(tab as AdminSupportSection);

/**
 * Valida a secao do grupo Configuracoes.
 *
 * @since 1.0.0
 */
export const isSettingsSection = (tab: string): tab is AdminSettingsSection => SETTINGS_SECTION_KEYS.includes(tab as AdminSettingsSection);

/**
 * Valida se a chave representa um dominio principal do admin.
 *
 * @since 1.0.0
 */
export const isAdminPageTab = (tab: string): tab is AdminPageTab => ['panel', 'operation', 'marketplace', 'finance', 'marketing', 'support', 'settings'].includes(tab);

/**
 * Mantem compatibilidade com links e atalhos legados do admin.
 *
 * @since 1.0.0
 */
export const LEGACY_TAB_MAP: Record<string, { tab: AdminPageTab; section?: string }> = {
  dashboard: { tab: 'panel', section: 'dashboard' },
  alerts: { tab: 'panel', section: 'alerts' },
  'billing-health': { tab: 'panel', section: 'billing-health' },
  questions: { tab: 'operation', section: 'questions' },
  'question-groups': { tab: 'operation', section: 'question-groups' },
  'questions-groups': { tab: 'operation', section: 'question-groups' },
  groups: { tab: 'operation', section: 'question-groups' },
  exams: { tab: 'operation', section: 'exams' },
  import: { tab: 'operation', section: 'import' },
  filters: { tab: 'operation', section: 'filters' },
  'lei-comentada': { tab: 'operation', section: 'lei-comentada' },
  'legal-commentary': { tab: 'operation', section: 'lei-comentada' },
  'annotated-laws': { tab: 'operation', section: 'lei-comentada' },
  users: { tab: 'operation', section: 'users' },
  marketplace: { tab: 'marketplace', section: 'vendors' },
  vendors: { tab: 'marketplace', section: 'vendors' },
  sellers: { tab: 'marketplace', section: 'vendors' },
  subscriptions: { tab: 'marketplace', section: 'vendors' },
  materials: { tab: 'marketplace', section: 'materials' },
  blocked: { tab: 'marketplace', section: 'blocked' },
  rankings: { tab: 'support', section: 'rankings' },
  reports: { tab: 'support', section: 'reports' },
  finance: { tab: 'finance', section: 'transactions' },
  balance: { tab: 'marketplace', section: 'vendors' },
  transactions: { tab: 'finance', section: 'transactions' },
  refunds: { tab: 'support', section: 'refunds' },
  prices: { tab: 'finance', section: 'plans' },
  'plans-coupons': { tab: 'finance', section: 'plans' },
  coupons: { tab: 'finance', section: 'coupons' },
  'coupon-settings': { tab: 'finance', section: 'coupons' },
  'coupon-config': { tab: 'finance', section: 'coupons' },
  analytics: { tab: 'finance', section: 'analytics' },
  'finance-analytics': { tab: 'finance', section: 'analytics' },
  marketing: { tab: 'marketing', section: 'landing-pages' },
  'landing-pages': { tab: 'marketing', section: 'landing-pages' },
  campaigns: { tab: 'marketing', section: 'campaigns' },
  campaign: { tab: 'marketing', section: 'campaigns' },
  promo: { tab: 'marketing', section: 'campaigns' },
  promotions: { tab: 'marketing', section: 'campaigns' },
  themes: { tab: 'marketing', section: 'visual-themes' },
  'visual-themes': { tab: 'marketing', section: 'visual-themes' },
  'visual-theme': { tab: 'marketing', section: 'visual-themes' },
  social: { tab: 'marketing', section: 'social-links' },
  socials: { tab: 'marketing', section: 'social-links' },
  'social-links': { tab: 'marketing', section: 'social-links' },
  automation: { tab: 'finance', section: 'automation' },
  feedback: { tab: 'support', section: 'feedback' },
  threads: { tab: 'support', section: 'threads' },
  comments: { tab: 'support', section: 'comments' },
  moderation: { tab: 'support', section: 'comments' },
  'comment-moderation': { tab: 'support', section: 'comments' },
  settings: { tab: 'settings', section: 'general' },
  general: { tab: 'settings', section: 'general' },
  modules: { tab: 'settings', section: 'modules' },
  security: { tab: 'settings', section: 'security' },
  integrations: { tab: 'settings', section: 'integrations' },
  email: { tab: 'settings', section: 'email' },
  ads: { tab: 'settings', section: 'ads' },
  seo: { tab: 'settings', section: 'seo' },
  performance: { tab: 'settings', section: 'performance' },
  logs: { tab: 'settings', section: 'logs' },
};

/**
 * Mapeia as secoes exibidas em cada dominio principal.
 *
 * @since 1.0.0
 */
export const ADMIN_SECTION_CONFIG: Record<AdminPageTab, AdminNavigationSection[]> = {
  panel: [
    { key: 'dashboard', label: 'Dashboard' },
    { key: 'alerts', label: 'Alertas' },
    { key: 'billing-health', label: 'Saude do billing' },
  ],
  operation: [
    { key: 'questions', label: 'Questoes' },
    { key: 'question-groups', label: 'Contexto de questoes' },
    { key: 'exams', label: 'Banco de provas' },
    { key: 'import', label: 'Importador' },
    { key: 'filters', label: 'Filtros' },
    { key: 'lei-comentada', label: 'Lei Comentada' },
    { key: 'users', label: 'Usuarios' },
  ],
  marketplace: [
    { key: 'vendors', label: 'Vendedores' },
    { key: 'materials', label: 'Materiais' },
    { key: 'blocked', label: 'Revisao bloqueada' },
  ],
  finance: [
    { key: 'transactions', label: 'Transacoes' },
    { key: 'plans', label: 'Planos' },
    { key: 'coupons', label: 'Cupons' },
    { key: 'analytics', label: 'Analytics' },
    { key: 'automation', label: 'Automacao' },
  ],
  marketing: [
    { key: 'landing-pages', label: 'Landing Pages' },
    { key: 'campaigns', label: 'Campanhas' },
    { key: 'visual-themes', label: 'Temas visuais' },
    { key: 'social-links', label: 'Redes sociais' },
  ],
  support: [
    { key: 'feedback', label: 'Feedback' },
    { key: 'comments', label: 'Comentarios' },
    { key: 'reports', label: 'Denuncias' },
    { key: 'threads', label: 'Threads' },
    { key: 'rankings', label: 'Rankings' },
    { key: 'refunds', label: 'Reembolsos' },
  ],
  settings: [
    { key: 'general', label: 'Geral' },
    { key: 'modules', label: 'Modulos' },
    { key: 'security', label: 'Seguranca' },
    { key: 'integrations', label: 'Integracoes' },
    { key: 'email', label: 'Email' },
    { key: 'ads', label: 'Ads' },
    { key: 'seo', label: 'SEO' },
    { key: 'performance', label: 'Performance' },
    { key: 'logs', label: 'Logs' },
  ],
};

/**
 * Define a subsecao inicial de cada dominio.
 *
 * @since 1.0.0
 */
export const DEFAULT_SECTION_BY_TAB: Record<AdminPageTab, string> = {
  panel: 'dashboard',
  operation: 'questions',
  marketplace: 'vendors',
  finance: 'transactions',
  marketing: 'landing-pages',
  support: 'feedback',
  settings: 'general',
};

export const buildAdminQuestionEditPath = (
  questionId: string | number,
  reportId?: string | number | null,
) => {
  const query = new URLSearchParams();

  if (reportId) {
    query.set('report', String(reportId));
  }

  return `/admin/operation/questions/${encodeURIComponent(String(questionId))}/edit${query.size > 0 ? `?${query.toString()}` : ''}`;
};

export const buildAdminLawEditPath = (lawId: string | number) =>
  `/admin/operation/lei-comentada/${encodeURIComponent(String(lawId))}/edit`;

export const buildAdminExamEditPath = (examId: string | number) =>
  `/admin/operation/exams/${encodeURIComponent(String(examId))}/edit`;

export const buildAdminUserEditPath = (userId: string | number) =>
  `/admin/operation/users/${encodeURIComponent(String(userId))}/edit`;

export const buildAdminLandingPageEditPath = (landingId: string | number) =>
  `/admin/operation/marketing/landing-pages/${encodeURIComponent(String(landingId))}/edit`;

const normalizeAdminRouteSegment = (value?: string | null) =>
  String(value || '').trim().toLowerCase();

const resolveSectionByTab = (tab: AdminPageTab, rawSection?: string | null) => {
  const section = normalizeAdminRouteSegment(rawSection);

  if (tab === 'panel') {
    return isPanelSection(section) ? section : DEFAULT_SECTION_BY_TAB.panel;
  }

  if (tab === 'operation') {
    return isOperationSection(section) ? section : DEFAULT_SECTION_BY_TAB.operation;
  }

  if (tab === 'marketplace') {
    return isMarketplaceSection(section) ? section : DEFAULT_SECTION_BY_TAB.marketplace;
  }

  if (tab === 'finance') {
    return isFinanceSection(section) ? section : DEFAULT_SECTION_BY_TAB.finance;
  }

  if (tab === 'marketing') {
    return isMarketingSection(section) ? section : DEFAULT_SECTION_BY_TAB.marketing;
  }

  if (tab === 'support') {
    return isSupportSection(section) ? section : DEFAULT_SECTION_BY_TAB.support;
  }

  return isSettingsSection(section) ? section : DEFAULT_SECTION_BY_TAB.settings;
};

/**
 * Resolve a rota administrativa canonica a partir de segmentos atuais ou legados.
 *
 * @since 1.0.0
 */
export const resolveAdminRoute = (rawTab?: string | null, rawSection?: string | null) => {
  const normalizedTab = normalizeAdminRouteSegment(rawTab);
  const normalizedSection = normalizeAdminRouteSegment(rawSection);

  if (normalizedTab === 'operation' && ['materials', 'blocked'].includes(normalizedSection)) {
    return {
      tab: 'marketplace' as const,
      section: resolveSectionByTab('marketplace', normalizedSection),
    };
  }

  if (normalizedTab === 'operation' && normalizedSection === 'rankings') {
    return {
      tab: 'support' as const,
      section: resolveSectionByTab('support', normalizedSection),
    };
  }

  if (normalizedTab === 'operation' && normalizedSection === 'reports') {
    return { tab: 'support' as const, section: 'reports' as const };
  }

  if (normalizedTab === 'finance' && normalizedSection === 'subscriptions') {
    return { tab: 'marketplace' as const, section: 'vendors' as const };
  }

  if (normalizedTab === 'finance' && normalizedSection === 'balance') {
    return { tab: 'marketplace' as const, section: 'vendors' as const };
  }

  if (normalizedTab === 'finance' && normalizedSection === 'refunds') {
    return { tab: 'support' as const, section: 'refunds' as const };
  }

  if (normalizedTab === 'support' && ['materials', 'blocked'].includes(normalizedSection)) {
    return {
      tab: 'marketplace' as const,
      section: resolveSectionByTab('marketplace', normalizedSection),
    };
  }

  if (isAdminPageTab(normalizedTab)) {
    const legacySection = LEGACY_TAB_MAP[normalizedSection];
    const section = legacySection?.tab === normalizedTab
      ? legacySection.section || DEFAULT_SECTION_BY_TAB[normalizedTab]
      : normalizedSection;

    return {
      tab: normalizedTab,
      section: resolveSectionByTab(normalizedTab, section),
    };
  }

  if (LEGACY_TAB_MAP[normalizedTab]) {
    const legacy = LEGACY_TAB_MAP[normalizedTab];
    return {
      tab: legacy.tab,
      section: resolveSectionByTab(legacy.tab, normalizedSection || legacy.section),
    };
  }

  return {
    tab: 'panel' as const,
    section: DEFAULT_SECTION_BY_TAB.panel as AdminPanelSection,
  };
};

/**
 * Monta a URL canonica do admin no formato `/admin/<tab>/<section>`.
 *
 * @since 1.0.0
 */
export const buildAdminPath = (
  tab: AdminPageTab,
  section?: string | null,
  hash = '',
) => {
  const resolved = resolveAdminRoute(tab, section);
  const safeHash = hash.startsWith('#') ? hash : '';
  return `/admin/${resolved.tab}/${resolved.section}${safeHash}`;
};
