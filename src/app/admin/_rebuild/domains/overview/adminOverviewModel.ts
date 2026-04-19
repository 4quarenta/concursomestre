import type { ErrorReport, Material, SystemSettings, Transaction } from '@types';
import type { AdminSeverityTokenKey } from '../../design-system';
import { buildAdminRevenueModel, formatAdminCurrency } from '../revenue/adminRevenueModel';

type TransactionLike = Partial<Transaction>;
type ReportLike = Partial<ErrorReport>;
type MaterialLike = Partial<Material>;
type SettingsLike = Partial<SystemSettings>;

export interface AdminOverviewModelInput {
  transactions?: TransactionLike[];
  reports?: ReportLike[];
  materials?: MaterialLike[];
  systemSettings?: SettingsLike;
  sitemapCoveragePercent?: number | null;
}

export interface AdminOverviewMetric {
  key: string;
  label: string;
  value: string;
  description: string;
  trend: string;
  severity: AdminSeverityTokenKey;
}

export interface AdminOverviewQueueItem {
  key: string;
  title: string;
  description: string;
  severity: AdminSeverityTokenKey;
  meta: string;
  targetDomain: 'operation' | 'revenue' | 'growth' | 'support' | 'security';
}

export interface AdminOverviewModel {
  metrics: AdminOverviewMetric[];
  queue: AdminOverviewQueueItem[];
  health: {
    hasBillingRisk: boolean;
    hasSeoRisk: boolean;
    hasSupportRisk: boolean;
  };
}

const readStatus = (value: unknown) => String(value ?? '').trim().toLowerCase();
const readField = (record: object, key: string) => (record as Record<string, unknown>)[key];

const isOpenReport = (report: ReportLike) =>
  !['resolved', 'ignored'].includes(readStatus(report.status));

const isPendingMaterial = (material: MaterialLike) =>
  readStatus(material.status) === 'pending';

const isRejectedOrFailedTransaction = (transaction: TransactionLike) =>
  ['rejected', 'failed'].includes(readStatus(transaction.status));

const hasConfiguredSecret = (settings: SettingsLike, key: string, fallbackKey: string) =>
  Boolean(readField(settings, key)) || Boolean(readField(settings, fallbackKey));

export const buildAdminOverviewModel = ({
  transactions = [],
  reports = [],
  materials = [],
  systemSettings = {},
  sitemapCoveragePercent = null,
}: AdminOverviewModelInput): AdminOverviewModel => {
  const revenue = buildAdminRevenueModel({ transactions });
  const openReports = reports.filter(isOpenReport);
  const pendingMaterials = materials.filter(isPendingMaterial);
  const failedTransactions = transactions.filter(isRejectedOrFailedTransaction);
  const stripeSecretOk = hasConfiguredSecret(systemSettings, 'hasStripeSecretConfigured', 'stripeSecretKey');
  const stripeWebhookOk = hasConfiguredSecret(systemSettings, 'hasStripeWebhookConfigured', 'stripeWebhookSecret');
  const hasBillingRisk = revenue.pendingRefunds > 0 || failedTransactions.length > 0 || !stripeSecretOk || !stripeWebhookOk;
  const hasSeoRisk = sitemapCoveragePercent === null || sitemapCoveragePercent < 90;
  const hasSupportRisk = openReports.length > 0;

  const queue: AdminOverviewQueueItem[] = [
    revenue.pendingRefunds > 0 ? {
      key: 'refunds',
      title: 'Reembolsos aguardando decisao',
      description: 'Pedidos pendentes podem afetar receita, acesso premium e experiencia do usuario.',
      severity: 'high',
      meta: `${revenue.pendingRefunds} pendente(s)`,
      targetDomain: 'revenue',
    } : null,
    openReports.length > 0 ? {
      key: 'reports',
      title: 'Denuncias abertas',
      description: 'Itens reportados precisam de triagem antes de acumularem risco operacional.',
      severity: 'high',
      meta: `${openReports.length} aberta(s)`,
      targetDomain: 'support',
    } : null,
    pendingMaterials.length > 0 ? {
      key: 'materials',
      title: 'Materiais aguardando moderacao',
      description: 'Materiais pendentes travam publicacao e podem afetar vendedores.',
      severity: 'medium',
      meta: `${pendingMaterials.length} pendente(s)`,
      targetDomain: 'operation',
    } : null,
    failedTransactions.length > 0 ? {
      key: 'failed-transactions',
      title: 'Falhas recentes de transacao',
      description: 'Transacoes rejeitadas ou com falha precisam de conciliacao e monitoramento.',
      severity: 'medium',
      meta: `${failedTransactions.length} falha(s)`,
      targetDomain: 'revenue',
    } : null,
    (!stripeSecretOk || !stripeWebhookOk) ? {
      key: 'stripe-secrets',
      title: 'Configuracao Stripe incompleta',
      description: 'Secret key e webhook precisam estar configurados antes de producao.',
      severity: 'critical',
      meta: 'billing',
      targetDomain: 'security',
    } : null,
    hasSeoRisk ? {
      key: 'seo-coverage',
      title: 'Cobertura SEO a confirmar',
      description: 'Sitemap e Search Console precisam de prova publica apos dominio e deploy.',
      severity: sitemapCoveragePercent === null ? 'low' : 'medium',
      meta: sitemapCoveragePercent === null ? 'sem prova' : `${sitemapCoveragePercent}%`,
      targetDomain: 'growth',
    } : null,
  ].filter(Boolean) as AdminOverviewQueueItem[];

  return {
    metrics: [
      {
        key: 'total_revenue',
        label: 'Receita registrada',
        value: formatAdminCurrency(revenue.totalRevenue),
        description: `${revenue.paidTransactions} transacao(oes) paga(s).`,
        trend: revenue.totalRevenue > 0 ? 'Ativo' : 'Sem receita',
        severity: revenue.totalRevenue > 0 ? 'healthy' : 'low',
      },
      {
        key: 'refunds',
        label: 'Reembolsos pendentes',
        value: String(revenue.pendingRefunds),
        description: 'Pedidos aguardando decisao administrativa.',
        trend: revenue.pendingRefunds > 0 ? 'Decidir' : 'Saudavel',
        severity: revenue.pendingRefunds > 0 ? 'high' : 'healthy',
      },
      {
        key: 'support',
        label: 'Denuncias abertas',
        value: String(openReports.length),
        description: 'Fila de moderacao e suporte.',
        trend: openReports.length > 0 ? 'Triar' : 'Saudavel',
        severity: openReports.length > 0 ? 'high' : 'healthy',
      },
      {
        key: 'seo',
        label: 'Cobertura sitemap',
        value: sitemapCoveragePercent === null ? 'Sem prova' : `${sitemapCoveragePercent}%`,
        description: 'Cobertura local; indexacao real depende do Google.',
        trend: hasSeoRisk ? 'Validar' : 'Saudavel',
        severity: hasSeoRisk ? 'medium' : 'healthy',
      },
    ],
    queue,
    health: {
      hasBillingRisk,
      hasSeoRisk,
      hasSupportRisk,
    },
  };
};
