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
 * Define os domínios e seções oficiais do painel administrativo.
 * Essa estrutura alimenta o shell, as tabs e a compatibilidade com links legados.
 *
 * @since 1.0.0
 */
import type { LucideIcon } from 'lucide-react';

export type AdminPageTab = 'panel' | 'operation' | 'marketplace' | 'finance' | 'marketing' | 'support' | 'settings';
export type AdminPanelSection = 'dashboard' | 'alerts' | 'billing-health';
export type AdminOperationSection = 'questions' | 'question-groups' | 'exams' | 'files' | 'blog' | 'novidades' | 'import' | 'gran-crawler' | 'filters' | 'lei-comentada' | 'users';
export type AdminMarketplaceSection = 'vendors' | 'materials' | 'blocked';
export type AdminFinanceSection = 'transactions' | 'plans' | 'coupons' | 'benefits' | 'automation' | 'analytics';
export type AdminMarketingSection = 'landing-pages' | 'campaigns' | 'visual-themes' | 'social-links' | 'featured-organizations';
export type AdminSupportSection = 'feedback' | 'threads' | 'reports' | 'rankings' | 'refunds' | 'comments' | 'communications';
export type AdminSettingsSection = 'general' | 'modules' | 'gamification' | 'notifications' | 'security' | 'integrations' | 'email' | 'email-templates' | 'ads' | 'seo' | 'performance' | 'logs' | 'safe-operations';

export type AdminNavigationTab = {
  key: AdminPageTab;
  label: string;
  icon: LucideIcon;
  badge?: number;
  group?: string;
  description: string;
};

export type AdminNavigationSection = {
  key: string;
  label: string;
};

export type SupportPendingCounts = Partial<Record<'feedback' | 'threads' | 'reports' | 'comments' | 'refunds' | 'communications', number>>;

export const STAFF_ADMIN_ALLOWED_TABS: AdminPageTab[] = ['operation', 'support'];

const STAFF_ADMIN_ALLOWED_SECTIONS: Partial<Record<AdminPageTab, string[]>> = {
  operation: ['questions', 'question-groups', 'exams', 'files', 'blog', 'novidades', 'import', 'gran-crawler', 'filters', 'lei-comentada'],
  support: ['feedback', 'threads', 'reports', 'rankings', 'comments', 'communications'],
};

export const normalizeAdminUserRole = (role?: string | null) =>
  String(role || '').trim().toLowerCase();

export const canAccessAdminTabForRole = (tab: AdminPageTab, role?: string | null) => {
  const normalizedRole = normalizeAdminUserRole(role);

  if (normalizedRole === 'admin') {
    return true;
  }

  if (normalizedRole === 'staff') {
    return STAFF_ADMIN_ALLOWED_TABS.includes(tab);
  }

  return false;
};

export const canAccessAdminSectionForRole = (
  tab: AdminPageTab,
  section?: string | null,
  role?: string | null,
) => {
  const normalizedRole = normalizeAdminUserRole(role);

  if (!canAccessAdminTabForRole(tab, normalizedRole)) {
    return false;
  }

  if (normalizedRole !== 'staff') {
    return true;
  }

  const allowedSections = STAFF_ADMIN_ALLOWED_SECTIONS[tab];
  if (!allowedSections?.length) {
    return true;
  }

  return allowedSections.includes(normalizeAdminRouteSegment(section));
};

export const getDefaultAdminSectionForRole = (
  tab: AdminPageTab,
  role?: string | null,
) => {
  const normalizedRole = normalizeAdminUserRole(role);

  if (normalizedRole === 'staff') {
    const firstAllowedSection = STAFF_ADMIN_ALLOWED_SECTIONS[tab]?.[0];
    if (firstAllowedSection) {
      return firstAllowedSection;
    }
  }

  return DEFAULT_SECTION_BY_TAB[tab];
};

export const filterAdminSectionsForRole = <T extends { key: string }>(
  tab: AdminPageTab,
  sections: T[],
  role?: string | null,
) => {
  const normalizedRole = normalizeAdminUserRole(role);

  if (!normalizedRole || normalizedRole === 'admin') {
    return sections;
  }

  return sections.filter((section) => canAccessAdminSectionForRole(tab, section.key, normalizedRole));
};

export const filterAdminTabsForRole = <T extends { key: AdminPageTab }>(
  tabs: T[],
  role?: string | null,
) => {
  const normalizedRole = normalizeAdminUserRole(role);

  if (!normalizedRole || normalizedRole === 'admin') {
    return tabs;
  }

  return tabs.filter((tab) => canAccessAdminTabForRole(tab.key, normalizedRole));
};

export const resolveSupportLandingSection = (counts: SupportPendingCounts = {}): AdminSupportSection => {
  if (Number(counts.comments || 0) > 0) return 'comments';
  if (Number(counts.reports || 0) > 0) return 'reports';
  if (Number(counts.threads || 0) > 0) return 'threads';
  if (Number(counts.feedback || 0) > 0) return 'feedback';
  if (Number(counts.refunds || 0) > 0) return 'refunds';

  return DEFAULT_SECTION_BY_TAB.support as AdminSupportSection;
};

export const TAB_DESCRIPTIONS: Record<AdminPageTab, string> = {
  panel: 'Visão executiva, alertas operacionais e saúde do billing.',
  operation: 'Questões, provas, blog, importação, taxonomias e Lei Comentada.',
  marketplace: 'Vendedores, catálogo publicado e revisões bloqueadas do marketplace.',
  finance: 'Transações, planos, cupons, analytics e automação financeira.',
  marketing: 'Landing pages, campanhas, temas visuais e redes sociais da homepage.',
  support: 'Solicitações, feedbacks, avaliações, denúncias e comentários moderados.',
  settings: 'Controles globais, integrações, e-mail, ads, SEO e logs.',
};

export const PANEL_SECTION_KEYS = ['dashboard', 'alerts', 'billing-health'] as const;
export const OPERATION_SECTION_KEYS = ['questions', 'question-groups', 'exams', 'files', 'blog', 'novidades', 'import', 'gran-crawler', 'filters', 'lei-comentada', 'users'] as const;
export const MARKETPLACE_SECTION_KEYS = ['vendors', 'materials', 'blocked'] as const;
export const FINANCE_SECTION_KEYS = ['transactions', 'plans', 'coupons', 'benefits', 'automation', 'analytics'] as const;
export const MARKETING_SECTION_KEYS = ['landing-pages', 'campaigns', 'visual-themes', 'social-links', 'featured-organizations'] as const;
export const SUPPORT_SECTION_KEYS = ['feedback', 'threads', 'reports', 'rankings', 'refunds', 'comments', 'communications'] as const;
export const SETTINGS_SECTION_KEYS = ['general', 'modules', 'gamification', 'notifications', 'security', 'integrations', 'email', 'email-templates', 'ads', 'seo', 'performance', 'logs', 'safe-operations'] as const;

/**
 * Valida a seção do grupo Painel.
 *
 * @since 1.0.0
 */
export const isPanelSection = (tab: string): tab is AdminPanelSection => PANEL_SECTION_KEYS.includes(tab as AdminPanelSection);

/**
 * Valida a seção do grupo Operação.
 *
 * @since 1.0.0
 */
export const isOperationSection = (tab: string): tab is AdminOperationSection => OPERATION_SECTION_KEYS.includes(tab as AdminOperationSection);

/**
 * Valida a seção do grupo Marketplace.
 *
 * @since 1.0.0
 */
export const isMarketplaceSection = (tab: string): tab is AdminMarketplaceSection => MARKETPLACE_SECTION_KEYS.includes(tab as AdminMarketplaceSection);

/**
 * Valida a seção do grupo Financeiro.
 *
 * @since 1.0.0
 */
export const isFinanceSection = (tab: string): tab is AdminFinanceSection => FINANCE_SECTION_KEYS.includes(tab as AdminFinanceSection);

/**
 * Valida a seção do grupo Marketing.
 *
 * @since 1.0.0
 */
export const isMarketingSection = (tab: string): tab is AdminMarketingSection => MARKETING_SECTION_KEYS.includes(tab as AdminMarketingSection);

/**
 * Valida a seção do grupo Suporte.
 *
 * @since 1.0.0
 */
export const isSupportSection = (tab: string): tab is AdminSupportSection => SUPPORT_SECTION_KEYS.includes(tab as AdminSupportSection);

/**
 * Valida a seção do grupo Configurações.
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
 * Mantém compatibilidade com links e atalhos legados do admin.
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
  files: { tab: 'operation', section: 'files' },
  arquivos: { tab: 'operation', section: 'files' },
  import: { tab: 'operation', section: 'import' },
  'gran-crawler': { tab: 'operation', section: 'gran-crawler' },
  gran: { tab: 'operation', section: 'gran-crawler' },
  crawler: { tab: 'operation', section: 'gran-crawler' },
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
  blog: { tab: 'operation', section: 'blog' },
  news: { tab: 'operation', section: 'blog' },
  novidades: { tab: 'operation', section: 'novidades' },
  changelog: { tab: 'operation', section: 'novidades' },
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
  gamification: { tab: 'settings', section: 'gamification' },
  gamificacao: { tab: 'settings', section: 'gamification' },
  notifications: { tab: 'settings', section: 'notifications' },
  notificacoes: { tab: 'settings', section: 'notifications' },
  security: { tab: 'settings', section: 'security' },
  integrations: { tab: 'settings', section: 'integrations' },
  email: { tab: 'settings', section: 'email' },
  'email-templates': { tab: 'settings', section: 'email-templates' },
  ads: { tab: 'settings', section: 'ads' },
  seo: { tab: 'settings', section: 'seo' },
  performance: { tab: 'settings', section: 'performance' },
  logs: { tab: 'settings', section: 'logs' },
  'safe-operations': { tab: 'settings', section: 'safe-operations' },
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
    { key: 'billing-health', label: 'Saúde do billing' },
  ],
  operation: [
    { key: 'questions', label: 'Questões' },
    { key: 'question-groups', label: 'Contextos de questões' },
    { key: 'exams', label: 'Banco de provas' },
    { key: 'files', label: 'Arquivos' },
    { key: 'blog', label: 'Blog' },
    { key: 'novidades', label: 'Novidades' },
    { key: 'import', label: 'Importador' },
    { key: 'gran-crawler', label: 'Crawler Gran' },
    { key: 'filters', label: 'Filtros' },
    { key: 'lei-comentada', label: 'Lei Comentada' },
    { key: 'users', label: 'Usuários' },
  ],
  marketplace: [
    { key: 'vendors', label: 'Vendedores' },
    { key: 'materials', label: 'Materiais' },
    { key: 'blocked', label: 'Revisão bloqueada' },
  ],
  finance: [
    { key: 'transactions', label: 'Transações' },
    { key: 'plans', label: 'Planos' },
    { key: 'coupons', label: 'Cupons' },
    { key: 'benefits', label: 'Benefícios' },
    { key: 'analytics', label: 'Analytics' },
    { key: 'automation', label: 'Automação' },
  ],
  marketing: [
    { key: 'landing-pages', label: 'Landing Pages' },
    { key: 'campaigns', label: 'Campanhas' },
    { key: 'visual-themes', label: 'Temas visuais' },
    { key: 'social-links', label: 'Redes sociais' },
    { key: 'featured-organizations', label: 'Orgaos em destaque' },
  ],
  support: [
    { key: 'feedback', label: 'Feedback e avaliações' },
    { key: 'comments', label: 'Comentários' },
    { key: 'reports', label: 'Denúncias' },
    { key: 'threads', label: 'Solicitações' },
    { key: 'rankings', label: 'Rankings' },
    { key: 'refunds', label: 'Reembolsos' },
    { key: 'communications', label: 'Comunicações' },
  ],
  settings: [
    { key: 'general', label: 'Geral' },
    { key: 'modules', label: 'Módulos' },
    { key: 'gamification', label: 'Gamificação' },
    { key: 'notifications', label: 'Notificações' },
    { key: 'security', label: 'Segurança' },
    { key: 'integrations', label: 'Integrações' },
    { key: 'email', label: 'E-mail' },
    { key: 'email-templates', label: 'Modelos de E-mail' },
    { key: 'ads', label: 'Ads' },
    { key: 'seo', label: 'SEO' },
    { key: 'performance', label: 'Performance' },
    { key: 'logs', label: 'Logs' },
    { key: 'safe-operations', label: 'Operações seguras' },
  ],
};

/**
 * Define a subseção inicial de cada domínio.
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

/**
 * Expõe o inventário de rotas canônicas a partir da mesma configuração que
 * desenha a navegação. Auditorias não devem manter uma segunda lista manual.
 */
export const getCanonicalAdminRoutablePaths = (): string[] => (
  (Object.entries(ADMIN_SECTION_CONFIG) as [AdminPageTab, AdminNavigationSection[]][])
    .flatMap(([tab, sections]) => sections.map((section) => buildAdminPath(tab, section.key)))
);

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

export const buildAdminBlogEditPath = (articleId: string | number) =>
  `/admin/operation/blog/${encodeURIComponent(String(articleId))}/edit`;

export const buildAdminChangelogEditPath = (entryId: string | number) =>
  `/admin/operation/novidades/${encodeURIComponent(String(entryId))}/edit`;

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

  if (normalizedTab === 'marketing' && normalizedSection === 'blog') {
    return { tab: 'operation' as const, section: 'blog' as const };
  }

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

export const resolveAdminRouteForRole = (
  rawTab?: string | null,
  rawSection?: string | null,
  role?: string | null,
) => {
  const resolved = resolveAdminRoute(rawTab, rawSection);
  const normalizedRole = normalizeAdminUserRole(role);

  if (!normalizedRole) {
    return resolved;
  }

  if (canAccessAdminSectionForRole(resolved.tab, resolved.section, normalizedRole)) {
    return resolved;
  }

  if (canAccessAdminTabForRole(resolved.tab, normalizedRole)) {
    return {
      tab: resolved.tab,
      section: getDefaultAdminSectionForRole(resolved.tab, normalizedRole),
    };
  }

  const fallbackTab = filterAdminTabsForRole(
    (['panel', 'operation', 'marketplace', 'finance', 'marketing', 'support', 'settings'] as AdminPageTab[]).map((key) => ({ key })),
    normalizedRole,
  )[0]?.key || 'operation';

  return {
    tab: fallbackTab,
    section: getDefaultAdminSectionForRole(fallbackTab, normalizedRole),
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
