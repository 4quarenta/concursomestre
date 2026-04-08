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
export type AdminPageTab = 'panel' | 'operation' | 'finance' | 'support' | 'settings';
export type AdminPanelSection = 'dashboard' | 'alerts' | 'billing-health';
export type AdminOperationSection = 'questions' | 'exams' | 'import' | 'filters' | 'users' | 'materials' | 'rankings';
export type AdminFinanceSection = 'subscriptions' | 'transactions' | 'refunds' | 'plans-coupons' | 'automation';
export type AdminSupportSection = 'feedback' | 'threads' | 'reports';
export type AdminSettingsSection = 'general' | 'modules' | 'security' | 'integrations' | 'email' | 'ads' | 'performance' | 'logs';

export type AdminNavigationTab = {
  key: AdminPageTab;
  label: string;
  icon: any;
  badge?: number;
  description: string;
};

export type AdminNavigationSection = {
  key: string;
  label: string;
};

export const TAB_DESCRIPTIONS: Record<AdminPageTab, string> = {
  panel: 'Visao executiva, alertas operacionais e saude do billing.',
  operation: 'Questoes, importacao, usuarios, materiais e rankings.',
  finance: 'Transacoes, assinaturas, reembolsos, planos e automacao.',
  support: 'Feedbacks, denuncias e threads operacionais.',
  settings: 'Controles globais, integracoes, email, ads e logs.',
};

export const PANEL_SECTION_KEYS = ['dashboard', 'alerts', 'billing-health'] as const;
export const OPERATION_SECTION_KEYS = ['questions', 'exams', 'import', 'filters', 'users', 'materials', 'rankings'] as const;
export const FINANCE_SECTION_KEYS = ['subscriptions', 'transactions', 'refunds', 'plans-coupons', 'automation'] as const;
export const SUPPORT_SECTION_KEYS = ['feedback', 'threads', 'reports'] as const;
export const SETTINGS_SECTION_KEYS = ['general', 'modules', 'security', 'integrations', 'email', 'ads', 'performance', 'logs'] as const;

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
 * Valida a secao do grupo Financeiro.
 *
 * @since 1.0.0
 */
export const isFinanceSection = (tab: string): tab is AdminFinanceSection => FINANCE_SECTION_KEYS.includes(tab as AdminFinanceSection);

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
export const isAdminPageTab = (tab: string): tab is AdminPageTab => ['panel', 'operation', 'finance', 'support', 'settings'].includes(tab);

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
  exams: { tab: 'operation', section: 'exams' },
  import: { tab: 'operation', section: 'import' },
  filters: { tab: 'operation', section: 'filters' },
  users: { tab: 'operation', section: 'users' },
  materials: { tab: 'operation', section: 'materials' },
  rankings: { tab: 'operation', section: 'rankings' },
  reports: { tab: 'support', section: 'reports' },
  blocked: { tab: 'operation', section: 'materials' },
  finance: { tab: 'finance', section: 'subscriptions' },
  balance: { tab: 'finance', section: 'subscriptions' },
  transactions: { tab: 'finance', section: 'transactions' },
  refunds: { tab: 'finance', section: 'refunds' },
  prices: { tab: 'finance', section: 'plans-coupons' },
  marketing: { tab: 'finance', section: 'plans-coupons' },
  automation: { tab: 'finance', section: 'automation' },
  feedback: { tab: 'support', section: 'feedback' },
  threads: { tab: 'support', section: 'threads' },
  settings: { tab: 'settings', section: 'general' },
  general: { tab: 'settings', section: 'general' },
  modules: { tab: 'settings', section: 'modules' },
  security: { tab: 'settings', section: 'security' },
  integrations: { tab: 'settings', section: 'integrations' },
  email: { tab: 'settings', section: 'email' },
  ads: { tab: 'settings', section: 'ads' },
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
    { key: 'exams', label: 'Banco de provas' },
    { key: 'import', label: 'Importador' },
    { key: 'filters', label: 'Filtros' },
    { key: 'users', label: 'Usuarios' },
    { key: 'materials', label: 'Materiais' },
    { key: 'rankings', label: 'Rankings' },
  ],
  finance: [
    { key: 'subscriptions', label: 'Assinaturas' },
    { key: 'transactions', label: 'Transacoes' },
    { key: 'refunds', label: 'Reembolsos' },
    { key: 'plans-coupons', label: 'Planos e cupons' },
    { key: 'automation', label: 'Automacao' },
  ],
  support: [
    { key: 'feedback', label: 'Feedback' },
    { key: 'reports', label: 'Denuncias' },
    { key: 'threads', label: 'Threads' },
  ],
  settings: [
    { key: 'general', label: 'Geral' },
    { key: 'modules', label: 'Modulos' },
    { key: 'security', label: 'Seguranca' },
    { key: 'integrations', label: 'Integracoes' },
    { key: 'email', label: 'Email' },
    { key: 'ads', label: 'Ads' },
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
  finance: 'subscriptions',
  support: 'feedback',
  settings: 'general',
};
