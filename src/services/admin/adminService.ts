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

import { apiClient, ENDPOINTS, assertApiSuccess, downloadAuthenticatedFile, readApiData, resolveApiResourceUrl } from '@services/api';
import type { ApiResponse } from '@services/api';
import { buildRequestCacheKey, withRequestCoalescing } from '@services/api/requestCoalescer';
import { withQuestionPublicationAliases } from '@services/questions/questionPublication';
import type { ErrorReport, Question, Ranking, SystemSettings, UserProfile } from '@types';

type FeedbackStatus = 'new' | 'read' | 'resolved';
type ReportResolution = 'resolved' | 'ignored';
type AdminLooseRecord = Record<string, unknown>;

const requestApi = <T>(request: Promise<unknown>): Promise<ApiResponse<T>> => request as Promise<ApiResponse<T>>;
const toLooseRecord = (value: unknown): AdminLooseRecord | undefined => (
  value && typeof value === 'object' && !Array.isArray(value)
    ? value as AdminLooseRecord
    : undefined
);

export interface AdminUserProfileRecord extends AdminLooseRecord {
  id?: string | number;
  name?: string;
  email?: string;
  cpf?: string;
  phone?: string;
  target_exam?: string;
  role?: 'user' | 'staff' | 'partner' | 'admin' | 'tester';
  status?: 'active' | 'suspended' | 'banned' | 'pending';
  reputation?: string | number;
  email_verified?: boolean;
  has_saved_card?: boolean;
  photo_url?: string | null;
}

export interface AdminUserSubscriptionRecord extends AdminLooseRecord {
  id?: string | number;
  status?: string;
  plan_id?: string | number;
  plan_name?: string;
  current_period_start?: string | null;
  current_period_end?: string | null;
  auto_renew?: boolean;
}

export interface AdminUserTransactionRecord extends AdminLooseRecord {
  id?: string | number;
  created_at?: string | null;
  type?: string;
  amount?: number | string | null;
  status?: string;
}

export interface AdminAvailablePlanRecord extends AdminLooseRecord {
  id?: string | number;
  name?: string;
  price?: number | string | null;
  active?: number | string | boolean;
}

export interface AdminUserCommentRecord extends AdminLooseRecord {
  id?: string | number;
  created_at?: string | null;
  question_id?: string | number;
  comment?: string;
}

export interface AdminUserFeedbackRecord extends AdminLooseRecord {
  id?: string | number;
  type?: string;
  reason?: string;
  details?: string;
  status?: string;
  created_at?: string | null;
  public_rating?: number | string | null;
  public_display_name?: string | null;
  public_headline?: string | null;
  home_published_at?: string | null;
}

export interface AdminUserReportRecord extends AdminLooseRecord {
  id?: string | number;
  target_type?: string;
  target_id?: string | number;
  reason?: string;
  details?: string;
  status?: string;
  created_at?: string | null;
  resolved_at?: string | null;
  admin_reason?: string | null;
}

export interface AdminFeedbackThread {
  id: number;
  user_id: string;
  user_name: string;
  user_email: string;
  user_role?: string;
  type: string;
  reason: string;
  details: string;
  created_at: string;
  status: FeedbackStatus;
  reply_count?: number;
}

export interface AdminFeedbackReply extends AdminFeedbackThread {
  parent_id: number;
}

export interface CacheStatsPayload {
  total_files: number;
  valid_entries: number;
  expired_entries: number;
  total_size_mb: number;
  enabled: boolean;
  default_ttl?: number;
  table_name?: string | null;
  source?: string;
  supports_expiration?: boolean;
  supports_size_estimate?: boolean;
}

export interface SystemLogsPayload {
  lines: string[];
  path?: string;
  size_bytes?: number;
  updated_at?: string | null;
  cleared?: boolean;
}

export interface AdminStatsPayload {
  total_revenue: number;
  available_total_revenue: number;
  platform_revenue: number;
  subscription_revenue: number;
  available_subscription_revenue: number;
  marketplace_revenue: number;
  active_subscriptions: number;
  cancelled_subscriptions: number;
  expired_subscriptions: number;
  trial_subscriptions: number;
  mrr: number;
  new_users: number;
  seller_payout: number;
  available_seller_payout: number;
  transactions_count: number;
  refund_requests_count: number;
  refund_requested_amount: number;
  total_refunded: number;
  held_balance: number;
  total_paid: number;
  feedback_count: number;
  reports_count?: number;
  questions_count: number;
  users_count: number;
  materials_count: number;
  pending_materials_count?: number;
  rankings_count: number;
  available_platform_revenue: number;
  laws_count?: number;
  comments_count?: number;
  pending_comments_count?: number;
  approved_comments_count?: number;
  spam_comments_count?: number;
  active_vendors_count?: number;
  published_marketplace_materials_count?: number;
}

export interface AdminAnalyticsRange {
  startDate?: string | null;
  endDate?: string | null;
}

export interface AdminFinanceAnalyticsSummary {
  totalRevenue: number;
  mrr: number;
  arr: number;
  projectedConfirmedRevenue: number;
  projectedRemainingInstallments: number;
  activeSubscribers: number;
  churnedSubscribers: number;
  churnRate: number;
  pastDueSubscribers: number;
  recoveredSubscribers: number;
  avgTicket: number;
  ltvOperational: number;
  refundRequestedAmount: number;
  refundedAmount: number;
}

export interface AdminAnalyticsFunnelStep {
  key: string;
  label: string;
  count: number;
  conversionFromPrevious: number | null;
}

export interface AdminFinanceFunnelLead {
  leadKey: string;
  userId?: string | null;
  email: string;
  name?: string | null;
  referrerLabel: string;
  referrerUrl?: string | null;
  originUrl?: string | null;
  utmSource?: string | null;
  utmMedium?: string | null;
  utmCampaign?: string | null;
  currentStage: string;
  emailCaptured: boolean;
  createdAccount: boolean;
  checkoutStarted: boolean;
  paymentStarted: boolean;
  purchased: boolean;
  firstEventAt: string;
  lastEventAt: string;
}

export interface AdminFinanceFunnelAttributionItem {
  key: string;
  label: string;
  leads: number;
  capturedEmails: number;
  createdAccounts: number;
  checkouts: number;
  purchases: number;
}

export interface AdminFinanceFunnelDetails {
  identifiedLeads: number;
  capturedEmailsCount: number;
  createdAccountsCount: number;
  checkoutStartedCount: number;
  paymentStartedCount: number;
  purchasedCount: number;
  recentLeads: AdminFinanceFunnelLead[];
  topReferrers: AdminFinanceFunnelAttributionItem[];
  topCampaigns: AdminFinanceFunnelAttributionItem[];
}

export interface AdminAnalyticsCycleConversion {
  key: string;
  label: string;
  purchases: number;
  activeSubscribers: number;
}

export interface AdminBillingHealthSnapshot {
  failedPayments: number;
  pastDueSubscribers: number;
  recoveredSubscribers: number;
  refundRequestedCount: number;
  refundedCount: number;
}

export interface AdminAnalyticsAcquisitionCohort {
  month: string;
  capturedEmails: number;
  createdAccounts: number;
  checkoutStarted: number;
  purchases: number;
  signupRate: number;
  purchaseRate: number;
}

export interface AdminAnalyticsRevenueCohort {
  month: string;
  buyers: number;
  currentlyActive: number;
  renewed: number;
  retentionRate: number;
}

export interface AdminAnalyticsCohortsPayload {
  acquisition: AdminAnalyticsAcquisitionCohort[];
  revenue: AdminAnalyticsRevenueCohort[];
}

export interface AdminRevenueProjectionCycle {
  key: string;
  label: string;
  subscriptions: number;
  remainingInstallments: number;
  projectedAmount: number;
}

export interface AdminRevenueProjectionMonth {
  key: string;
  label: string;
  year: number;
  month: number;
  installments: number;
  amount: number;
  atRiskAmount: number;
}

export interface AdminRevenueProjectionItem {
  subscriptionId: string;
  userId: string;
  userName: string;
  userEmail: string;
  planName: string;
  status: string;
  cycleKey: string;
  cycleLabel: string;
  totalInstallments: number;
  paidInstallments: number;
  remainingInstallments: number;
  installmentAmount: number;
  projectedAmount: number;
  nextBillingAt?: string | null;
  currentPeriodEnd?: string | null;
}

export interface AdminRevenueProjectionPayload {
  totalProjectedAmount: number;
  totalRemainingInstallments: number;
  activeContracts: number;
  atRiskProjectedAmount: number;
  breakdownByCycle: AdminRevenueProjectionCycle[];
  breakdownByMonth: AdminRevenueProjectionMonth[];
  items: AdminRevenueProjectionItem[];
}

export interface AdminFinanceAnalyticsPayload {
  period: string;
  range: AdminAnalyticsRange;
  summary: AdminFinanceAnalyticsSummary;
  funnel: AdminAnalyticsFunnelStep[];
  funnelDetails: AdminFinanceFunnelDetails;
  conversionByCycle: AdminAnalyticsCycleConversion[];
  billingHealth: AdminBillingHealthSnapshot;
  cohorts: AdminAnalyticsCohortsPayload;
  revenueProjection: AdminRevenueProjectionPayload;
}

export interface AdminDashboardTrend {
  key: string;
  label: string;
  current: number;
  previous: number;
  deltaPercent: number;
}

export interface AdminDashboardInsight {
  tone: 'success' | 'warning' | 'info';
  title: string;
  body: string;
}

export interface AdminDashboardAnalyticsPayload {
  period: string;
  counts: Record<string, number>;
  trends: AdminDashboardTrend[];
  insights: AdminDashboardInsight[];
  funnelSummary: AdminAnalyticsFunnelStep[];
  billingHealth: AdminBillingHealthSnapshot;
}

export interface AdminLeadSegmentItem {
  userId?: string | null;
  email: string;
  name?: string | null;
  lastEventAt: string;
  notes: string;
}

export interface AdminLeadSegment {
  key: string;
  label: string;
  count: number;
  items: AdminLeadSegmentItem[];
}

export interface AdminAnalyticsExportParams {
  period: 'all' | 'today' | 'week' | 'month' | 'year' | 'custom';
  startDate?: string;
  endDate?: string;
}

export type AdminCommentModerationStatus = 'pending' | 'approved' | 'spam' | 'trash';
export type AdminCommentModerationFilter = 'all' | AdminCommentModerationStatus;
export type AdminCommentModerationCounts = Record<AdminCommentModerationFilter, number>;

export interface AdminCommentModerationItem {
  id: string;
  origin: 'question' | 'material' | 'law';
  sourceType: 'comment' | 'law';
  sourceId: string;
  authorId: string;
  authorName: string;
  excerpt: string;
  targetLabel: string;
  targetPath: string;
  status: AdminCommentModerationStatus;
  createdAt: string;
}

export interface AdminCommentModerationListPayload {
  items: AdminCommentModerationItem[];
  total: number;
  page: number;
  perPage: number;
  pages: number;
  counts: AdminCommentModerationCounts;
}

export interface AdminUserDetailsPayload {
  profile: AdminUserProfileRecord;
  subscriptions: AdminUserSubscriptionRecord[];
  transactions: AdminUserTransactionRecord[];
  available_plans: AdminAvailablePlanRecord[];
  materials: AdminLooseRecord[];
  stats: {
    comments_count: number;
    feedback_count: number;
    reports_count: number;
    open_reports_count: number;
  };
  last_comments: AdminUserCommentRecord[];
  feedback_threads: AdminUserFeedbackRecord[];
  reports: AdminUserReportRecord[];
}

export interface AdminUserActionPayload {
  user_id?: string;
  action: string;
  transaction_id?: number;
  plan_id?: number;
  days?: number;
  password?: string;
  name?: string;
  email?: string;
  cpf?: string;
  phone?: string;
  targetExam?: string;
  role?: string;
  status?: string;
  reputation?: number;
}

export interface AdminUserActionResult {
  message?: string;
  data?: AdminLooseRecord;
}

export interface AdminDatabaseResetPayload {
  password: string;
  twoFactorCode?: string;
  tables: string[];
}

export interface AdminTwoFactorSetupPayload {
  secret: string;
  qrCodeUrl: string;
}

export interface AdminSettingsTestResult {
  message: string;
  data?: AdminLooseRecord;
}

export interface AdminQuestionListPayload {
  rows: Question[];
  total: number;
  perPage: number;
  pages: number;
  page: number;
}

export interface AdminQuestionGroupItem {
  id: number;
  enunciado: string;
  enunciado_clean?: string;
  enunciadoClean?: string;
  texto?: string | null;
  image_url?: string | null;
  imageUrl?: string | null;
  question_count?: number;
  questionCount?: number;
  question_ids?: Array<number | string> | string | null;
  questionIds?: Array<number | string> | string | null;
}

export interface AdminQuestionGroupPayload {
  id?: number | string | null;
  enunciado?: string;
  texto?: string;
  image_url?: string;
  imageUrl?: string;
  question_ids?: Array<number | string>;
  questionIds?: Array<number | string>;
}

const EMPTY_COMMENT_MODERATION_COUNTS: AdminCommentModerationCounts = {
  all: 0,
  pending: 0,
  approved: 0,
  spam: 0,
  trash: 0,
};

/**
 * Normaliza a resposta da fila de comentarios para aceitar backends antigos e novos.
 * O admin usa essa base para tabs WordPress-like e acoes em massa sem depender de shape perfeito.
 * @since v1.0.0
 */
const normalizeCommentModerationPayload = (
  payload: Partial<AdminCommentModerationListPayload> | null | undefined,
  fallbackPage: number,
  fallbackPerPage: number,
): AdminCommentModerationListPayload => {
  const items = Array.isArray(payload?.items) ? payload.items : [];
  const total = Number(payload?.total ?? items.length);
  const page = Number(payload?.page ?? fallbackPage);
  const perPage = Number(payload?.perPage ?? fallbackPerPage);
  const rawPages = payload?.pages ?? Math.ceil(total / Math.max(1, perPage));
  const pages = Math.max(1, Number(rawPages || 1));
  const rawCounts = payload?.counts || {};
  const counts = {
    ...EMPTY_COMMENT_MODERATION_COUNTS,
    ...Object.fromEntries(
      Object.entries(rawCounts).map(([key, value]) => [key, Number(value || 0)]),
    ),
  } as AdminCommentModerationCounts;

  if (!counts.all) {
    counts.all = counts.pending + counts.approved + counts.spam + counts.trash;
  }

  return {
    items,
    total,
    page,
    perPage,
    pages,
    counts,
  };
};

/**
 * Fachada oficial do painel administrativo.
 * Ela concentra os contratos usados por dashboard, base de dados, financeiro, feedback e segurança no admin.
 * @since v1.0.0
 */
export const adminService = {
  buildAnalyticsExportUrl(
    endpoint: string,
    params: AdminAnalyticsExportParams & { segmentKey?: string }
  ): string {
    const query = new URLSearchParams({ period: params.period });

    if (params.period === 'custom' && params.startDate && params.endDate) {
      query.set('startDate', params.startDate);
      query.set('endDate', params.endDate);
    }

    if (params.segmentKey) {
      query.set('segmentKey', params.segmentKey);
    }

    return resolveApiResourceUrl(`${endpoint}?${query.toString()}`);
  },

  /**
   * Carrega as configuracoes publicas usadas no bootstrap da aplicacao.
   * @since v1.0.0
   */
  async getPublicSystemSettings(): Promise<Partial<SystemSettings>> {
    return withRequestCoalescing('settings:public', async () => {
      const response = await requestApi<Partial<SystemSettings>>(apiClient.get<ApiResponse<Partial<SystemSettings>>>(ENDPOINTS.settings.get));
      return readApiData(response, {});
    }, 5000);
  },

  /**
   * Carrega as configuracoes globais exibidas na aba de settings do admin.
   * @since v1.0.0
   */
  async getSystemSettings(): Promise<Partial<SystemSettings>> {
    return withRequestCoalescing('settings:admin', async () => {
      const response = await requestApi<Partial<SystemSettings>>(apiClient.get<ApiResponse<Partial<SystemSettings>>>(ENDPOINTS.settings.update));
      return readApiData(response, {});
    }, 5000);
  },

  /**
   * Persiste as configurações globais alteradas pelo painel administrativo.
   * @since v1.0.0
   */
  async saveSystemSettings(settings: SystemSettings): Promise<Partial<SystemSettings>> {
    const response = await requestApi<Partial<SystemSettings>>(apiClient.post<ApiResponse<Partial<SystemSettings>>>(ENDPOINTS.settings.update, settings));
    const envelope = assertApiSuccess<Partial<SystemSettings>>(response, 'Não foi possível salvar as configurações.');
    return readApiData<Partial<SystemSettings>>(envelope.raw, {});
  },

  /**
   * Lista os usuários para gestão e moderação no admin.
   * @since v1.0.0
   */
  async getUsers(): Promise<UserProfile[]> {
    const response = await requestApi<UserProfile[]>(apiClient.get<ApiResponse<UserProfile[]>>(ENDPOINTS.users.list));
    const payload = readApiData(response, []);
    return Array.isArray(payload) ? payload : [];
  },

  /**
   * Lista as denúncias/reportes visiveis na operação administrativa.
   * @since v1.0.0
   */
  async getReports(): Promise<ErrorReport[]> {
    return withRequestCoalescing(
      buildRequestCacheKey('admin:reports'),
      async () => {
        const response = await requestApi<ErrorReport[]>(apiClient.get<ApiResponse<ErrorReport[]>>(ENDPOINTS.reports.list));
        const payload = readApiData(response, []);
        return Array.isArray(payload) ? payload : [];
      },
      3_000,
    );
  },

  /**
   * Executa a moderação final de uma denúncia com justificativa administrativa.
   * @since v1.0.0
   */
  async moderateReport(id: string, action: ReportResolution, adminReason: string, evidenceUrl?: string): Promise<void> {
    const response = await requestApi<unknown>(apiClient.post<ApiResponse>(ENDPOINTS.admin.reportActions, {
      id,
      action,
      admin_reason: adminReason,
      evidence_url: evidenceUrl,
    }));

    assertApiSuccess(response, 'Não foi possível moderar a denúncia.');
  },

  /**
   * Atualiza um ranking existente pelo fluxo do admin.
   * @since v1.0.0
   */
  async updateRanking(ranking: Ranking): Promise<void> {
    const response = await requestApi<unknown>(apiClient.post<ApiResponse>(ENDPOINTS.rankings.update, ranking));
    assertApiSuccess(response, 'Não foi possível atualizar o ranking.');
  },

  /**
   * Exclui um ranking na operação administrativa.
   * @since v1.0.0
   */
  async deleteRanking(id: string): Promise<void> {
    const response = await requestApi<unknown>(apiClient.post<ApiResponse>(ENDPOINTS.rankings.delete, { id }));
    assertApiSuccess(response, 'Não foi possível excluir o ranking.');
  },

  /**
   * Le o estado atual do cache administrativo para a tela de manutencao.
   * @since v1.0.0
   */
  async getCacheStats(): Promise<CacheStatsPayload> {
    const response = await requestApi<CacheStatsPayload>(apiClient.get<ApiResponse<CacheStatsPayload>>(`${ENDPOINTS.cache.manage}?action=stats`));
    return readApiData(response, {
      total_files: 0,
      valid_entries: 0,
      expired_entries: 0,
      total_size_mb: 0,
      enabled: true,
      default_ttl: 300,
      table_name: null,
      source: 'unknown',
      supports_expiration: false,
      supports_size_estimate: false,
    });
  },

  /**
   * Ativa ou desativa o cache do backend a partir do painel admin.
   * @since v1.0.0
   */
  async toggleCache(enabled: boolean): Promise<string> {
    const response = await requestApi<unknown>(apiClient.post<ApiResponse>(`${ENDPOINTS.cache.manage}?action=settings`, { enabled }));
    return assertApiSuccess(response, 'Não foi possível atualizar o cache.').message || 'Configuração do cache atualizada.';
  },

  /**
   * Persiste as configuracoes de cache com confirmacao do backend.
   * @since v1.0.0
   */
  async saveCacheSettings(payload: { enabled: boolean; default_ttl: number }): Promise<string> {
    const response = await requestApi<unknown>(apiClient.post<ApiResponse>(`${ENDPOINTS.cache.manage}?action=settings`, payload));
    return assertApiSuccess(response, 'Nao foi possivel salvar as configuracoes de cache.').message || 'Configuracoes do cache atualizadas.';
  },

  /**
   * Limpa completamente o cache pelo fluxo administrativo.
   * @since v1.0.0
   */
  async clearCache(): Promise<string> {
    const response = await requestApi<unknown>(apiClient.get<ApiResponse>(`${ENDPOINTS.cache.manage}?action=clear`));
    return assertApiSuccess(response, 'Não foi possível limpar o cache.').message || 'Cache limpo com sucesso.';
  },

  /**
   * Remove apenas entradas expiradas do cache pela tela de operação.
   * @since v1.0.0
   */
  async cleanExpiredCache(): Promise<string> {
    const response = await requestApi<unknown>(apiClient.get<ApiResponse>(`${ENDPOINTS.cache.manage}?action=clean`));
    return assertApiSuccess(response, 'Não foi possível limpar o cache expirado.').message || 'Entradas expiradas removidas.';
  },

  /**
   * Carrega o payload de logs exibido no viewer administrativo.
   * @since v1.0.0
   */
  async getSystemLogPayload(): Promise<SystemLogsPayload> {
    const response = await requestApi<SystemLogsPayload>(apiClient.get<ApiResponse<SystemLogsPayload>>(ENDPOINTS.admin.logs));
    return readApiData(response, {
      lines: [],
      path: '',
      size_bytes: 0,
      updated_at: null,
    });
  },

  /**
   * Carrega as linhas de log exibidas no viewer administrativo.
   * @since v1.0.0
   */
  async getSystemLogs(): Promise<string[]> {
    const payload = await adminService.getSystemLogPayload();
    return payload.lines || [];
  },

  /**
   * Baixa o arquivo de log usando o fluxo autenticado do backend.
   * @since v1.0.0
   */
  async downloadSystemLogs(): Promise<void> {
    await downloadAuthenticatedFile(`${ENDPOINTS.admin.logs}?action=download`, 'concurso-mestre-logs.log');
  },

  /**
   * Limpa o arquivo de log pelo endpoint administrativo.
   * @since v1.0.0
   */
  async clearSystemLogs(): Promise<SystemLogsPayload> {
    const response = await requestApi<SystemLogsPayload>(apiClient.post<ApiResponse<SystemLogsPayload>>(`${ENDPOINTS.admin.logs}?action=clear`, {}));
    assertApiSuccess(response, 'Nao foi possivel limpar os logs.');
    return readApiData(response, {
      lines: [],
      path: '',
      size_bytes: 0,
      updated_at: null,
      cleared: true,
    });
  },

  /**
   * Carrega os KPIs do dashboard executivo com suporte a recorte por período.
   * @since v1.0.0
   */
  async getStats(params: {
    period: 'all' | 'today' | 'week' | 'month' | 'year' | 'custom';
    startDate?: string;
    endDate?: string;
  }): Promise<AdminStatsPayload> {
    const normalizedParams = {
      period: params.period,
      ...(params.period === 'custom' && params.startDate ? { startDate: params.startDate } : {}),
      ...(params.period === 'custom' && params.endDate ? { endDate: params.endDate } : {}),
    };

    return withRequestCoalescing(
      buildRequestCacheKey('admin:stats', normalizedParams),
      async () => {
        const query = new URLSearchParams({ period: normalizedParams.period });

        if (normalizedParams.period === 'custom' && normalizedParams.startDate && normalizedParams.endDate) {
          query.set('startDate', normalizedParams.startDate);
          query.set('endDate', normalizedParams.endDate);
        }

        const response = await requestApi<AdminStatsPayload>(apiClient.get<ApiResponse<AdminStatsPayload>>(`${ENDPOINTS.admin.stats}?${query.toString()}`));
        return readApiData(response, {
          total_revenue: 0,
          available_total_revenue: 0,
          platform_revenue: 0,
          subscription_revenue: 0,
          available_subscription_revenue: 0,
          marketplace_revenue: 0,
          active_subscriptions: 0,
          cancelled_subscriptions: 0,
          expired_subscriptions: 0,
          trial_subscriptions: 0,
          mrr: 0,
          new_users: 0,
          seller_payout: 0,
          available_seller_payout: 0,
          transactions_count: 0,
          refund_requests_count: 0,
          refund_requested_amount: 0,
          total_refunded: 0,
          held_balance: 0,
          total_paid: 0,
          feedback_count: 0,
          reports_count: 0,
          questions_count: 0,
          users_count: 0,
          materials_count: 0,
          pending_materials_count: 0,
          rankings_count: 0,
          available_platform_revenue: 0,
          laws_count: 0,
          comments_count: 0,
          pending_comments_count: 0,
          approved_comments_count: 0,
          spam_comments_count: 0,
          active_vendors_count: 0,
          published_marketplace_materials_count: 0,
        });
      },
      30_000,
    );
  },

  /**
   * Carrega o analytics financeiro/comercial do SaaS.
   * @since v1.0.0
   */
  async getFinanceAnalytics(params: {
    period: 'all' | 'today' | 'week' | 'month' | 'year' | 'custom';
    startDate?: string;
    endDate?: string;
  }): Promise<AdminFinanceAnalyticsPayload> {
    const query = new URLSearchParams({ period: params.period });

    if (params.period === 'custom' && params.startDate && params.endDate) {
      query.set('startDate', params.startDate);
      query.set('endDate', params.endDate);
    }

    const response = await requestApi<AdminFinanceAnalyticsPayload>(apiClient.get<ApiResponse<AdminFinanceAnalyticsPayload>>(`${ENDPOINTS.admin.analyticsFinance}?${query.toString()}`));
    return readApiData(response, {
      period: params.period,
      range: { startDate: null, endDate: null },
      summary: {
        totalRevenue: 0,
        mrr: 0,
        arr: 0,
        projectedConfirmedRevenue: 0,
        projectedRemainingInstallments: 0,
        activeSubscribers: 0,
        churnedSubscribers: 0,
        churnRate: 0,
        pastDueSubscribers: 0,
        recoveredSubscribers: 0,
        avgTicket: 0,
        ltvOperational: 0,
        refundRequestedAmount: 0,
        refundedAmount: 0,
      },
      funnel: [],
      funnelDetails: {
        identifiedLeads: 0,
        capturedEmailsCount: 0,
        createdAccountsCount: 0,
        checkoutStartedCount: 0,
        paymentStartedCount: 0,
        purchasedCount: 0,
        recentLeads: [],
        topReferrers: [],
        topCampaigns: [],
      },
      conversionByCycle: [],
      billingHealth: {
        failedPayments: 0,
        pastDueSubscribers: 0,
        recoveredSubscribers: 0,
        refundRequestedCount: 0,
        refundedCount: 0,
      },
      cohorts: {
        acquisition: [],
        revenue: [],
      },
      revenueProjection: {
        totalProjectedAmount: 0,
        totalRemainingInstallments: 0,
        activeContracts: 0,
        atRiskProjectedAmount: 0,
        breakdownByCycle: [],
        breakdownByMonth: [],
        items: [],
      },
    });
  },

  /**
   * Carrega o dashboard analitico consolidado do admin.
   * @since v1.0.0
   */
  async getDashboardAnalytics(params: {
    period: 'all' | 'today' | 'week' | 'month' | 'year' | 'custom';
    startDate?: string;
    endDate?: string;
  }): Promise<AdminDashboardAnalyticsPayload> {
    const normalizedParams = {
      period: params.period,
      ...(params.period === 'custom' && params.startDate ? { startDate: params.startDate } : {}),
      ...(params.period === 'custom' && params.endDate ? { endDate: params.endDate } : {}),
    };

    return withRequestCoalescing(
      buildRequestCacheKey('admin:dashboard-analytics', normalizedParams),
      async () => {
        const query = new URLSearchParams({ period: normalizedParams.period });

        if (normalizedParams.period === 'custom' && normalizedParams.startDate && normalizedParams.endDate) {
          query.set('startDate', normalizedParams.startDate);
          query.set('endDate', normalizedParams.endDate);
        }

        const response = await requestApi<AdminDashboardAnalyticsPayload>(apiClient.get<ApiResponse<AdminDashboardAnalyticsPayload>>(`${ENDPOINTS.admin.analyticsDashboard}?${query.toString()}`));
        return readApiData(response, {
          period: params.period,
          counts: {},
          trends: [],
          insights: [],
          funnelSummary: [],
          billingHealth: {
            failedPayments: 0,
            pastDueSubscribers: 0,
            recoveredSubscribers: 0,
            refundRequestedCount: 0,
            refundedCount: 0,
          },
        });
      },
      30_000,
    );
  },

  /**
   * Carrega o funil e a conversao por ciclo para a area comercial.
   * @since v1.0.0
   */
  async getFunnelAnalytics(params: {
    period: 'all' | 'today' | 'week' | 'month' | 'year' | 'custom';
    startDate?: string;
    endDate?: string;
  }): Promise<Pick<AdminFinanceAnalyticsPayload, 'period' | 'range' | 'funnel' | 'funnelDetails' | 'conversionByCycle'>> {
    const query = new URLSearchParams({ period: params.period });

    if (params.period === 'custom' && params.startDate && params.endDate) {
      query.set('startDate', params.startDate);
      query.set('endDate', params.endDate);
    }

    const response = await requestApi<Pick<AdminFinanceAnalyticsPayload, 'period' | 'range' | 'funnel' | 'funnelDetails' | 'conversionByCycle'>>(apiClient.get<ApiResponse<Pick<AdminFinanceAnalyticsPayload, 'period' | 'range' | 'funnel' | 'funnelDetails' | 'conversionByCycle'>>>(`${ENDPOINTS.admin.analyticsFunnel}?${query.toString()}`));
    return readApiData(response, {
      period: params.period,
      range: { startDate: null, endDate: null },
      funnel: [],
      funnelDetails: {
        identifiedLeads: 0,
        capturedEmailsCount: 0,
        createdAccountsCount: 0,
        checkoutStartedCount: 0,
        paymentStartedCount: 0,
        purchasedCount: 0,
        recentLeads: [],
        topReferrers: [],
        topCampaigns: [],
      },
      conversionByCycle: [],
    });
  },

  /**
   * Segmentos acionaveis para relacionamento e campanhas.
   * @since v1.0.0
   */
  async getAnalyticsSegments(params: {
    period: 'all' | 'today' | 'week' | 'month' | 'year' | 'custom';
    startDate?: string;
    endDate?: string;
  }): Promise<{ period: string; range: AdminAnalyticsRange; segments: AdminLeadSegment[] }> {
    const query = new URLSearchParams({ period: params.period });

    if (params.period === 'custom' && params.startDate && params.endDate) {
      query.set('startDate', params.startDate);
      query.set('endDate', params.endDate);
    }

    const response = await requestApi<{ period: string; range: AdminAnalyticsRange; segments: AdminLeadSegment[] }>(apiClient.get<ApiResponse<{ period: string; range: AdminAnalyticsRange; segments: AdminLeadSegment[] }>>(`${ENDPOINTS.admin.analyticsSegments}?${query.toString()}`));
    return readApiData(response, {
      period: params.period,
      range: { startDate: null, endDate: null },
      segments: [],
    });
  },

  getFunnelExportUrl(params: AdminAnalyticsExportParams): string {
    return this.buildAnalyticsExportUrl(ENDPOINTS.admin.analyticsFunnelExport, params);
  },

  getSegmentsExportUrl(params: AdminAnalyticsExportParams & { segmentKey?: string }): string {
    return this.buildAnalyticsExportUrl(ENDPOINTS.admin.analyticsSegmentsExport, params);
  },

  /**
   * Lista a fila unificada de moderacao de comentarios.
   * @since v1.0.0
   */
  async getModerationComments(params: {
    status?: AdminCommentModerationFilter;
    origin?: 'all' | 'question' | 'material' | 'law';
    search?: string;
    page?: number;
    perPage?: number;
  }): Promise<AdminCommentModerationListPayload> {
    return withRequestCoalescing(
      buildRequestCacheKey('admin:comments-moderation', params),
      async () => {
        const response = await requestApi<AdminCommentModerationListPayload>(apiClient.get<ApiResponse<AdminCommentModerationListPayload>>(ENDPOINTS.admin.commentsModeration, {
          params: {
            status: params.status || 'pending',
            origin: params.origin || 'all',
            search: params.search || '',
            page: params.page || 1,
            perPage: params.perPage || 20,
          },
        }));

        return normalizeCommentModerationPayload(readApiData(response, {
          items: [],
          total: 0,
          page: params.page || 1,
          perPage: params.perPage || 20,
          pages: 1,
          counts: EMPTY_COMMENT_MODERATION_COUNTS,
        }), params.page || 1, params.perPage || 20);
      },
      3_000,
    );
  },

  /**
   * Atualiza um comentario individual na caixa de moderacao.
   * @since v1.0.0
   */
  async updateModerationComment(id: string, status: AdminCommentModerationStatus): Promise<AdminCommentModerationItem> {
    const response = await requestApi<AdminCommentModerationItem>(apiClient.post<ApiResponse<AdminCommentModerationItem>>(ENDPOINTS.admin.commentsModeration, { id, status }));
    const envelope = assertApiSuccess<AdminCommentModerationItem>(response, 'Nao foi possivel atualizar o comentario.');
    return readApiData<AdminCommentModerationItem>(envelope.raw, {
      id,
      origin: 'question',
      sourceType: 'comment',
      sourceId: '',
      authorId: '',
      authorName: '',
      excerpt: '',
      targetLabel: '',
      targetPath: '',
      status,
      createdAt: '',
    });
  },

  /**
   * Atualiza varios comentarios de uma vez.
   * @since v1.0.0
   */
  async bulkUpdateModerationComments(ids: string[], status: AdminCommentModerationStatus): Promise<{ updated: number }> {
    const response = await requestApi<{ updated: number }>(apiClient.post<ApiResponse<{ updated: number }>>(ENDPOINTS.admin.commentsModerationBulk, { ids, status }));
    return readApiData(
      assertApiSuccess(response, 'Nao foi possivel atualizar os comentarios selecionados.').raw,
      { updated: 0 },
    );
  },

  /**
   * Lista as questões para a grade administrativa com pagina e busca.
   * @since v1.0.0
   */
  async getQuestions(params: {
    page?: number;
    keyword?: string;
  }): Promise<AdminQuestionListPayload> {
    const response = await requestApi<AdminQuestionListPayload>(apiClient.get<ApiResponse<AdminQuestionListPayload>>(ENDPOINTS.questions.filter, {
      params: {
        page: String(params.page || 1),
        keyword: params.keyword || '',
      },
    }));

    const payload = readApiData(response, {
      rows: [],
      total: 0,
      perPage: 20,
      pages: 1,
      page: params.page || 1,
    });

    return {
      rows: Array.isArray(payload.rows) ? payload.rows.map((row: Question) => withQuestionPublicationAliases(row)) : [],
      total: Number(payload.total || 0),
      perPage: Number(payload.perPage || 20),
      pages: Number(payload.pages || 1),
      page: Number(payload.page || params.page || 1),
    };
  },

  /**
   * Lista contextos reutilizaveis por questoes.
   * @since v1.0.0
   */
  async getQuestionGroups(params: { keyword?: string } = {}): Promise<AdminQuestionGroupItem[]> {
    const response = await requestApi<{ items?: AdminQuestionGroupItem[] } | AdminQuestionGroupItem[]>(apiClient.get<ApiResponse<{ items?: AdminQuestionGroupItem[] } | AdminQuestionGroupItem[]>>(
      ENDPOINTS.questions.groups,
      {
        params: {
          keyword: params.keyword || '',
        },
      },
    ));

    const payload = readApiData(response, { items: [] as AdminQuestionGroupItem[] });
    const items = Array.isArray(payload) ? payload : payload.items;
    return Array.isArray(items) ? items : [];
  },

  /**
   * Cria ou atualiza um contexto do banco de questoes.
   * @since v1.0.0
   */
  async saveQuestionGroup(payload: AdminQuestionGroupPayload): Promise<AdminQuestionGroupItem> {
    const response = await requestApi<AdminQuestionGroupItem>(apiClient.post<ApiResponse<AdminQuestionGroupItem>>(ENDPOINTS.questions.groups, payload));
    const envelope = assertApiSuccess<AdminQuestionGroupItem>(response, 'Nao foi possivel salvar o contexto de questoes.');
    return readApiData<AdminQuestionGroupItem>(envelope.raw, {
      id: Number(payload.id || 0),
      enunciado: payload.enunciado || '',
      texto: payload.texto || '',
      image_url: payload.image_url || payload.imageUrl || '',
      question_count: 0,
      question_ids: payload.question_ids || payload.questionIds || [],
    });
  },

  /**
   * Envia imagem para um contexto de questoes.
   * @since v1.0.0
   */
  async uploadQuestionContextImage(file: File): Promise<string> {
    const formData = new FormData();
    formData.append('action', 'upload_image');
    formData.append('image', file);

    const response = await requestApi<{ url?: string; image_url?: string; imageUrl?: string }>(apiClient.post<ApiResponse<{ url?: string; image_url?: string; imageUrl?: string }>>(
      ENDPOINTS.questions.groups,
      formData,
    ));
    const envelope = assertApiSuccess<{ url?: string; image_url?: string; imageUrl?: string }>(
      response,
      'Nao foi possivel enviar a imagem do contexto.',
    );
    const payload = readApiData<{ url?: string; image_url?: string; imageUrl?: string }>(envelope.raw, {});
    const imageUrl = payload.url || payload.image_url || payload.imageUrl || '';

    if (!imageUrl) {
      throw new Error('O backend nao retornou a URL da imagem.');
    }

    return imageUrl;
  },

  /**
   * Remove um contexto e desvincula as questoes associadas.
   * @since v1.0.0
   */
  async deleteQuestionGroup(id: string | number): Promise<void> {
    const response = await requestApi<unknown>(apiClient.post<ApiResponse>(ENDPOINTS.questions.groups, { action: 'delete', id }));
    assertApiSuccess(response, 'Nao foi possivel remover o contexto de questoes.');
  },

  /**
   * Carrega o perfil detalhado de um usuário para o modal administrativo.
   * @since v1.0.0
   */
  async getUserDetails(userId: string): Promise<AdminUserDetailsPayload> {
    const response = await requestApi<AdminUserDetailsPayload>(apiClient.get<ApiResponse<AdminUserDetailsPayload>>(`${ENDPOINTS.admin.userDetails}?id=${userId}`));
    return readApiData(response, {
      profile: {},
      subscriptions: [],
      transactions: [],
      available_plans: [],
      materials: [],
      stats: {
        comments_count: 0,
        feedback_count: 0,
        reports_count: 0,
        open_reports_count: 0,
      },
      last_comments: [],
      feedback_threads: [],
      reports: [],
    });
  },

  /**
   * Executa a acao administrativa e devolve a mensagem confirmada pelo backend.
   * @since v1.0.0
   */
  async performUserActionWithResult(payload: AdminUserActionPayload): Promise<AdminUserActionResult> {
    const response = await requestApi<AdminLooseRecord>(apiClient.post<ApiResponse>(ENDPOINTS.admin.userActions, payload));
    const result = assertApiSuccess(response, 'Nao foi possivel executar a acao administrativa.');
    return {
      message: result.message,
      data: toLooseRecord(result.data),
    };
  },

  /**
   * Executa ações administrativas em usuários, assinaturas e transações.
   * @since v1.0.0
   */
  async performUserAction(payload: AdminUserActionPayload): Promise<void> {
    const response = await requestApi<unknown>(apiClient.post<ApiResponse>(ENDPOINTS.admin.userActions, payload));
    assertApiSuccess(response, 'Não foi possível executar a ação administrativa.');
  },

  /**
   * Lista as tabelas liberadas para reset controlado de base.
   * @since v1.0.0
   */
  async listResettableTables(): Promise<string[]> {
    const response = await requestApi<{ tables: string[] }>(apiClient.get<ApiResponse<{ tables: string[] }>>(ENDPOINTS.admin.listTables));
    return readApiData(response, { tables: [] }).tables || [];
  },

  /**
   * Inicia o setup de 2FA do admin retornando segredo e QR code.
   * @since v1.0.0
   */
  async setupTwoFactor(): Promise<AdminTwoFactorSetupPayload> {
    const response = await requestApi<AdminTwoFactorSetupPayload>(apiClient.get<ApiResponse<AdminTwoFactorSetupPayload>>(ENDPOINTS.auth.setupTwoFactor));
    return readApiData(response, {
      secret: '',
      qrCodeUrl: '',
    });
  },

  /**
   * Confirma a ativacao do 2FA com o código informado pelo administrador.
   * @since v1.0.0
   */
  async enableTwoFactor(secret: string, code: string): Promise<string> {
    const response = await requestApi<unknown>(apiClient.post<ApiResponse>(ENDPOINTS.auth.enableTwoFactor, {
      secret,
      code,
    }));

    return assertApiSuccess(response, 'Não foi possível ativar o 2FA.').message || '2FA ativado com sucesso!';
  },

  /**
   * Dispara o reset administrativo da base conforme as tabelas selecionadas.
   * @since v1.0.0
   */
  async resetDatabase(payload: AdminDatabaseResetPayload): Promise<void> {
    const response = await requestApi<unknown>(apiClient.post<ApiResponse>(ENDPOINTS.admin.resetDatabase, payload));
    assertApiSuccess(response, 'Não foi possível resetar a base de dados.');
  },

  /**
   * Dispara um teste real do SMTP com o endpoint oficial de settings.
   * @since v1.0.0
   */
  async testSmtpSettings(payload: object): Promise<AdminSettingsTestResult> {
    const response = await requestApi<AdminLooseRecord>(apiClient.post<ApiResponse>(`${ENDPOINTS.settings.update}?action=test_smtp`, payload));
    const result = assertApiSuccess(response, 'Nao foi possivel testar o SMTP.');
    return {
      message: result.message || 'SMTP validado com sucesso.',
      data: toLooseRecord(result.data),
    };
  },

  /**
   * Executa uma checagem administrativa das integracoes configuradas.
   * @since v1.0.0
   */
  async testIntegrations(payload: object): Promise<AdminSettingsTestResult> {
    const response = await requestApi<AdminLooseRecord>(apiClient.post<ApiResponse>(`${ENDPOINTS.settings.update}?action=test_integrations`, payload));
    const result = assertApiSuccess(response, 'Nao foi possivel validar as integracoes.');
    return {
      message: result.message || 'Integracoes verificadas com sucesso.',
      data: toLooseRecord(result.data),
    };
  },

  /**
   * Lista as threads de feedback/chamados visiveis no suporte administrativo.
   * @since v1.0.0
   */
  async getFeedbackThreads(): Promise<AdminFeedbackThread[]> {
    return withRequestCoalescing(
      buildRequestCacheKey('admin:feedback-threads'),
      async () => {
        const response = await requestApi<{ items: AdminFeedbackThread[] }>(apiClient.get<ApiResponse<{ items: AdminFeedbackThread[] }>>(ENDPOINTS.admin.feedback));
        return readApiData(response, { items: [] }).items || [];
      },
      15_000,
    );
  },

  /**
   * Atualiza o status operacional de uma thread de feedback.
   * @since v1.0.0
   */
  async updateFeedbackStatus(id: number, status: FeedbackStatus): Promise<void> {
    const response = await requestApi<unknown>(apiClient.put<ApiResponse>(ENDPOINTS.admin.feedback, { id, status }));
    assertApiSuccess(response, 'Não foi possível atualizar o feedback.');
  },

  /**
   * Carrega as respostas de uma thread de feedback para o painel de suporte.
   * @since v1.0.0
   */
  async getFeedbackReplies(parentId: number): Promise<AdminFeedbackReply[]> {
    const response = await requestApi<{ replies: AdminFeedbackReply[] }>(apiClient.get<ApiResponse<{ replies: AdminFeedbackReply[] }>>(`${ENDPOINTS.admin.feedback}?id=${parentId}`));
    return readApiData(response, { replies: [] }).replies || [];
  },

  /**
   * Envia uma resposta administrativa para a thread de feedback selecionada.
   * @since v1.0.0
   */
  async replyToFeedback(parentId: number, details: string): Promise<void> {
    const response = await requestApi<unknown>(apiClient.post<ApiResponse>(ENDPOINTS.admin.feedback, {
      parent_id: parentId,
      details,
    }));

    assertApiSuccess(response, 'Não foi possível enviar a resposta.');
  },
};

export default adminService;
