import {
  Activity,
  BarChart3,
  BellRing,
  BookOpenCheck,
  CreditCard,
  FileText,
  Flag,
  Gauge,
  GraduationCap,
  Headphones,
  Landmark,
  Megaphone,
  MessageSquareWarning,
  PackageCheck,
  ReceiptText,
  RefreshCw,
  SearchCheck,
  Settings2,
  ShieldCheck,
  ShieldAlert,
  SlidersHorizontal,
  Sparkles,
  Tags,
  UserCog,
  Users,
  WalletCards,
  type LucideIcon,
} from 'lucide-react';

export type AdminRebuildDomainKey =
  | 'overview'
  | 'operation'
  | 'revenue'
  | 'growth'
  | 'support'
  | 'security'
  | 'settings';

export type AdminRebuildSeverity = 'critical' | 'high' | 'medium' | 'low' | 'healthy';

export interface AdminRebuildSection {
  key: string;
  label: string;
  description: string;
  icon: LucideIcon;
  sourceCapabilities: string[];
  futureCapabilities?: string[];
}

export interface AdminRebuildDomain {
  key: AdminRebuildDomainKey;
  label: string;
  shortLabel: string;
  description: string;
  icon: LucideIcon;
  sections: AdminRebuildSection[];
}

export interface AdminRebuildMetricDefinition {
  key: string;
  label: string;
  domain: AdminRebuildDomainKey;
  description: string;
  severityWhen?: AdminRebuildSeverity;
}

export interface AdminRebuildQueueDefinition {
  key: string;
  label: string;
  domain: AdminRebuildDomainKey;
  severity: AdminRebuildSeverity;
  description: string;
}

export const adminRebuildDomains: AdminRebuildDomain[] = [
  {
    key: 'overview',
    label: 'Overview',
    shortLabel: 'Home',
    description: 'Cockpit executivo para decisoes, filas criticas e saude da plataforma.',
    icon: Gauge,
    sections: [
      {
        key: 'cockpit',
        label: 'Executive cockpit',
        description: 'Visao de receita, operacao, suporte, SEO e incidentes.',
        icon: Activity,
        sourceCapabilities: ['dashboard executivo', 'indicadores operacionais', 'score de SEO'],
        futureCapabilities: ['period comparison', 'executive drilldown', 'decision feed'],
      },
      {
        key: 'queue',
        label: 'Fila critica',
        description: 'Itens que exigem decisao humana agora.',
        icon: BellRing,
        sourceCapabilities: ['denuncias abertas', 'reembolsos pendentes', 'materiais pendentes'],
        futureCapabilities: ['SLA por item', 'acoes em lote', 'proprietario da fila'],
      },
      {
        key: 'incidents',
        label: 'Incidentes',
        description: 'Billing, cron, webhooks e integracoes com falha.',
        icon: ShieldAlert,
        sourceCapabilities: ['falhas de transacao', 'saude do billing', 'cron e webhook'],
        futureCapabilities: ['timeline de incidente', 'acknowledge', 'postmortem interno'],
      },
    ],
  },
  {
    key: 'operation',
    label: 'Operacao',
    shortLabel: 'Ops',
    description: 'Conteudo, usuarios, importacao, materiais e rankings.',
    icon: BookOpenCheck,
    sections: [
      {
        key: 'questions',
        label: 'Questoes',
        description: 'CRUD, revisao e qualidade da base de questoes.',
        icon: GraduationCap,
        sourceCapabilities: ['CRUD de questoes', 'editor manual', 'revisao de questoes'],
      },
      {
        key: 'exams',
        label: 'Provas',
        description: 'Banco de provas e vinculos com questoes.',
        icon: FileText,
        sourceCapabilities: ['banco de provas', 'vinculos de prova', 'edicao de exames'],
      },
      {
        key: 'import',
        label: 'Importacao',
        description: 'Pipeline assistido para extracao, revisao e publicacao em massa.',
        icon: RefreshCw,
        sourceCapabilities: ['importador assistido', 'publicacao em massa', 'revisao antes de publicar'],
        futureCapabilities: ['quality gate', 'fila de aprovacao', 'diff de importacao'],
      },
      {
        key: 'taxonomies',
        label: 'Taxonomias',
        description: 'Filtros, bancas, cargos, orgaos, anos e materias.',
        icon: Tags,
        sourceCapabilities: ['filtros', 'taxonomias', 'metadados de questao'],
      },
      {
        key: 'users',
        label: 'Usuarios',
        description: 'Gestao administrativa de usuarios e perfis.',
        icon: Users,
        sourceCapabilities: ['gestao de usuarios', 'perfil administrativo', 'acoes de usuario'],
      },
      {
        key: 'materials',
        label: 'Materiais',
        description: 'Moderacao, marketplace e materiais bloqueados.',
        icon: PackageCheck,
        sourceCapabilities: ['moderacao de materiais', 'exclusao de materiais', 'reanalise'],
      },
      {
        key: 'rankings',
        label: 'Rankings',
        description: 'Gestao, ajustes e saude dos rankings.',
        icon: Landmark,
        sourceCapabilities: ['gestao de rankings', 'ajustes de ranking'],
      },
    ],
  },
  {
    key: 'revenue',
    label: 'Revenue',
    shortLabel: 'Receita',
    description: 'Receita, billing, planos, assinaturas, transacoes, refunds e payouts.',
    icon: BarChart3,
    sections: [
      {
        key: 'analytics',
        label: 'Analytics de receita',
        description: 'MRR, ARR, churn, LTV, ARPU, cohorts e conversao.',
        icon: WalletCards,
        sourceCapabilities: ['metricas financeiras atuais', 'sellers e payout'],
        futureCapabilities: ['MRR', 'ARR', 'churn', 'LTV', 'cohort', 'inadimplencia'],
      },
      {
        key: 'subscriptions',
        label: 'Assinaturas',
        description: 'Ciclo de vida, status, renovacao e acesso premium.',
        icon: CreditCard,
        sourceCapabilities: ['assinaturas', 'renovacao', 'cancelamento'],
      },
      {
        key: 'transactions',
        label: 'Transacoes',
        description: 'Historico, filtros, falhas e conciliacao.',
        icon: ReceiptText,
        sourceCapabilities: ['transacoes', 'falhas recentes', 'conciliacao Stripe'],
      },
      {
        key: 'refunds',
        label: 'Reembolsos',
        description: 'Fila de pedidos, decisao e evidencias.',
        icon: MessageSquareWarning,
        sourceCapabilities: ['fila de reembolsos', 'aprovacao', 'rejeicao'],
      },
      {
        key: 'plans',
        label: 'Planos e cupons',
        description: 'Pricing, beneficios, limites, promocoes e cupons.',
        icon: SlidersHorizontal,
        sourceCapabilities: ['planos', 'pricing', 'cupons', 'limites por plano'],
      },
      {
        key: 'automation',
        label: 'Automacao Stripe',
        description: 'Cron, matriz de testes, webhooks e evidencias operacionais.',
        icon: SearchCheck,
        sourceCapabilities: ['helper de automacao', 'matriz Stripe', 'historico de execucao'],
      },
    ],
  },
  {
    key: 'growth',
    label: 'Growth',
    shortLabel: 'Growth',
    description: 'Campanhas, landing pages, SEO, aquisicao e conteudo comercial.',
    icon: Megaphone,
    sections: [
      {
        key: 'campaigns',
        label: 'Campanhas',
        description: 'Ativos comerciais, campanhas e promocoes publicas.',
        icon: Sparkles,
        sourceCapabilities: ['landing pages comerciais', 'conteudo comercial associado'],
        futureCapabilities: ['calendario de campanha', 'UTM registry', 'experimentos'],
      },
      {
        key: 'seo',
        label: 'SEO',
        description: 'Sitemap, robots, paginas publicas e descoberta organica.',
        icon: SearchCheck,
        sourceCapabilities: ['configuracoes de SEO', 'cobertura de sitemap'],
        futureCapabilities: ['Search Console checklist', 'schema.org inventory', 'indexation queue'],
      },
    ],
  },
  {
    key: 'support',
    label: 'Suporte',
    shortLabel: 'Suporte',
    description: 'Feedback, denuncias, threads, SLA e resolucao.',
    icon: Headphones,
    sections: [
      {
        key: 'inbox',
        label: 'Inbox',
        description: 'Fila unica de atendimento e moderacao.',
        icon: Headphones,
        sourceCapabilities: ['feedbacks', 'threads', 'denuncias'],
        futureCapabilities: ['SLA', 'owner', 'priorizacao'],
      },
      {
        key: 'reports',
        label: 'Denuncias',
        description: 'Triagem, alvo, decisao e historico de resolucao.',
        icon: Flag,
        sourceCapabilities: ['fila oficial de denuncias', 'resolucao rapida', 'roteamento de alvo'],
      },
    ],
  },
  {
    key: 'security',
    label: 'Seguranca',
    shortLabel: 'Risco',
    description: 'Permissoes, auditoria, segredos, logs e incidentes.',
    icon: ShieldCheck,
    sections: [
      {
        key: 'access',
        label: 'Acesso admin',
        description: 'RBAC, 2FA, permissoes e politicas de acesso.',
        icon: UserCog,
        sourceCapabilities: ['2FA para admin', 'perfil admin'],
        futureCapabilities: ['RBAC granular', 'permissoes por dominio', 'approval policy'],
      },
      {
        key: 'audit',
        label: 'Auditoria',
        description: 'Trilha de alteracoes por entidade, usuario e acao.',
        icon: ShieldAlert,
        sourceCapabilities: ['logs operacionais'],
        futureCapabilities: ['audit trail', 'diff por entidade', 'exportacao'],
      },
    ],
  },
  {
    key: 'settings',
    label: 'Configuracoes',
    shortLabel: 'Config',
    description: 'Configuracoes versionadas, integracoes, email, ads, SEO e cache.',
    icon: Settings2,
    sections: [
      {
        key: 'general',
        label: 'Geral',
        description: 'Nome do site, modo, taxa, WhatsApp e conteudo base.',
        icon: Settings2,
        sourceCapabilities: ['configuracoes gerais', 'motivacao diaria', 'landing principal'],
      },
      {
        key: 'integrations',
        label: 'Integracoes',
        description: 'Stripe, reCAPTCHA, analytics, pixel, Gemini e SMTP.',
        icon: SlidersHorizontal,
        sourceCapabilities: ['integracoes', 'teste de integracoes', 'SMTP write-only'],
      },
      {
        key: 'releases',
        label: 'Releases de config',
        description: 'Versionamento, diff, publicacao e rollback de configuracoes.',
        icon: RefreshCw,
        sourceCapabilities: ['feature flags', 'configuracoes atuais'],
        futureCapabilities: ['config diff', 'rollback', 'janela de publicacao'],
      },
    ],
  },
];

export const adminRebuildMetrics: AdminRebuildMetricDefinition[] = [
  {
    key: 'mrr',
    label: 'MRR',
    domain: 'revenue',
    description: 'Receita recorrente mensal normalizada.',
    severityWhen: 'high',
  },
  {
    key: 'refund_queue',
    label: 'Reembolsos pendentes',
    domain: 'revenue',
    description: 'Pedidos aguardando decisao administrativa.',
    severityWhen: 'medium',
  },
  {
    key: 'billing_incidents',
    label: 'Incidentes de billing',
    domain: 'overview',
    description: 'Falhas de webhook, cron ou conciliacao financeira.',
    severityWhen: 'critical',
  },
  {
    key: 'open_reports',
    label: 'Denuncias abertas',
    domain: 'support',
    description: 'Itens reportados sem resolucao final.',
    severityWhen: 'high',
  },
  {
    key: 'sitemap_coverage',
    label: 'Cobertura do sitemap',
    domain: 'growth',
    description: 'URLs publicas cobertas pelo sitemap dinamico.',
    severityWhen: 'low',
  },
];

export const adminRebuildQueues: AdminRebuildQueueDefinition[] = [
  {
    key: 'refunds',
    label: 'Reembolsos para decidir',
    domain: 'revenue',
    severity: 'high',
    description: 'Pedidos financeiros que podem afetar caixa, acesso e experiencia do usuario.',
  },
  {
    key: 'reports',
    label: 'Denuncias sensiveis',
    domain: 'support',
    severity: 'high',
    description: 'Conteudo ou comentario denunciado aguardando moderacao.',
  },
  {
    key: 'materials',
    label: 'Materiais pendentes',
    domain: 'operation',
    severity: 'medium',
    description: 'Materiais do marketplace aguardando aprovacao ou reanalise.',
  },
  {
    key: 'billing_health',
    label: 'Saude do billing',
    domain: 'overview',
    severity: 'critical',
    description: 'Sinais de falha em Stripe, cron, webhook ou recorrencia.',
  },
];

export const findAdminRebuildDomain = (key: AdminRebuildDomainKey) =>
  adminRebuildDomains.find((domain) => domain.key === key) || adminRebuildDomains[0];
