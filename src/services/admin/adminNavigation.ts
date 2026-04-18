export type AdminPageTab = 'panel' | 'operation' | 'finance' | 'marketing' | 'support' | 'settings';
export type AdminPanelSection = 'dashboard' | 'alerts' | 'billing-health';
export type AdminOperationSection = 'questions' | 'exams' | 'import' | 'filters' | 'users' | 'materials' | 'rankings';
export type AdminFinanceSection = 'subscriptions' | 'transactions' | 'refunds' | 'plans-coupons' | 'automation';
export type AdminMarketingSection = 'landing-pages';
export type AdminSupportSection = 'feedback' | 'threads' | 'reports';
export type AdminSettingsSection = 'general' | 'modules' | 'security' | 'integrations' | 'email' | 'ads' | 'seo' | 'performance' | 'logs';

export type ResolvedAdminRoute = {
  section: string;
  tab: AdminPageTab;
};

export const ADMIN_SECTION_CONFIG: Record<AdminPageTab, Array<{ key: string; label: string }>> = {
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
  marketing: [
    { key: 'landing-pages', label: 'Landing Pages' },
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
    { key: 'seo', label: 'SEO' },
    { key: 'performance', label: 'Performance' },
    { key: 'logs', label: 'Logs' },
  ],
};

export const TAB_LABELS: Record<AdminPageTab, string> = {
  panel: 'Painel',
  operation: 'Operacao',
  finance: 'Financeiro',
  marketing: 'Marketing',
  support: 'Suporte',
  settings: 'Configuracoes',
};

export const TAB_DESCRIPTIONS: Record<AdminPageTab, string> = {
  panel: 'Visao executiva, alertas operacionais e saude do billing.',
  operation: 'Questoes, usuarios, materiais, rankings e taxonomias.',
  finance: 'Receita, transacoes, reembolsos, planos e automacao.',
  marketing: 'Landing pages, campanhas e ativos comerciais.',
  support: 'Feedbacks, denuncias e threads operacionais.',
  settings: 'Controles globais, integracoes, email, ads, SEO e logs.',
};

const DEFAULT_SECTION_BY_TAB: Record<AdminPageTab, string> = {
  panel: 'dashboard',
  operation: 'questions',
  finance: 'subscriptions',
  marketing: 'landing-pages',
  support: 'feedback',
  settings: 'general',
};

const LEGACY_TAB_MAP: Record<string, ResolvedAdminRoute> = {
  overview: { tab: 'panel', section: 'dashboard' },
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
  marketing: { tab: 'marketing', section: 'landing-pages' },
  'landing-pages': { tab: 'marketing', section: 'landing-pages' },
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
  seo: { tab: 'settings', section: 'seo' },
  performance: { tab: 'settings', section: 'performance' },
  logs: { tab: 'settings', section: 'logs' },
};

const normalizeSegment = (value?: string | null) => String(value || '').trim().toLowerCase();

const isAdminPageTab = (value: string): value is AdminPageTab => (
  value === 'panel'
  || value === 'operation'
  || value === 'finance'
  || value === 'marketing'
  || value === 'support'
  || value === 'settings'
);

const resolveSectionByTab = (tab: AdminPageTab, section?: string | null) => {
  const normalizedSection = normalizeSegment(section);
  const validSections = new Set(ADMIN_SECTION_CONFIG[tab].map((item) => item.key));
  return validSections.has(normalizedSection) ? normalizedSection : DEFAULT_SECTION_BY_TAB[tab];
};

export const resolveAdminRoute = (
  rawTab?: string | null,
  rawSection?: string | null,
): ResolvedAdminRoute => {
  const normalizedTab = normalizeSegment(rawTab);
  const normalizedSection = normalizeSegment(rawSection);

  if (isAdminPageTab(normalizedTab)) {
    const legacySection = LEGACY_TAB_MAP[normalizedSection];
    const section = legacySection?.tab === normalizedTab ? legacySection.section : normalizedSection;

    return {
      tab: normalizedTab,
      section: resolveSectionByTab(normalizedTab, section),
    };
  }

  const legacyRoute = LEGACY_TAB_MAP[normalizedTab] || LEGACY_TAB_MAP[normalizedSection];
  if (legacyRoute) {
    return {
      tab: legacyRoute.tab,
      section: resolveSectionByTab(legacyRoute.tab, normalizedSection || legacyRoute.section),
    };
  }

  return {
    tab: 'panel',
    section: DEFAULT_SECTION_BY_TAB.panel,
  };
};

export const buildAdminPath = (tab: AdminPageTab, section?: string | null) => {
  const route = resolveAdminRoute(tab, section);
  return `/admin/${route.tab}/${route.section}`;
};
