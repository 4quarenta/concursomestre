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
import { buildRequestCacheKey, clearRequestCoalescing, withRequestCoalescing } from '@services/api/requestCoalescer';
import { withQuestionPublicationAliases } from '@services/questions/questionPublication';
import { getSupportReasonLabel } from '@services/support/supportReasonLabels';
import type { ErrorReport, Question, Ranking, SystemSettings, UserProfile } from '@types';

type FeedbackStatus = 'new' | 'read' | 'resolved';
type ReportResolution = 'resolved' | 'ignored';
export type AdminLooseRecord = Record<string, unknown>;

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

export interface AdminPlanCatalogItem extends AdminLooseRecord {
  id: number;
  name: string;
  description?: string;
  price: number;
  interval_count: number;
  interval_unit: 'day' | 'week' | 'month' | 'year';
  tier?: number | null;
  active: boolean;
  external_plan_id?: string | null;
  stripe_product_id?: string | null;
  stripe_price_id?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  is_test_plan?: boolean;
  can_edit_interval?: boolean;
  can_toggle_active?: boolean;
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
  user_response?: string | null;
  internal_note?: string | null;
  moderation_action?: string | null;
}

export interface AdminReportWorkbenchAction {
  slug: string;
  label: string;
  fields?: string[];
  mutatesTarget?: boolean;
  finalizes?: boolean;
  destructive?: boolean;
  reasonSlug?: string;
}

export interface AdminReportWorkbenchPayload {
  report: {
    id: string;
    reportType: 'error' | 'request' | string;
    reason: string;
    reasonSlug: string;
    details: string;
    status: string;
    workflowStatus?: string;
    priority?: string;
    targetType: ErrorReport['targetType'] | string;
    targetId: string;
    reporter?: {
      id?: string;
      name?: string;
      email?: string | null;
      role?: string | null;
    };
    evidenceUrl?: string | null;
    createdAt?: string | null;
  };
  target: {
    type: string;
    id: string;
    exists: boolean;
    label?: string;
    url?: string | null;
    error?: string;
    current?: AdminLooseRecord;
  };
  configuration: {
    title: string;
    reportType: 'error' | 'request' | string;
    reasonSlug: string;
    actions: AdminReportWorkbenchAction[];
  };
  draft?: {
    id?: number;
    action_slug?: string | null;
    changes_json?: string | AdminLooseRecord | null;
    user_response?: string | null;
    internal_note?: string | null;
  } | null;
  history?: AdminLooseRecord[];
}

export interface AdminReportWorkbenchApplyPayload {
  report_id: string;
  report_ids?: string[];
  action_slug: string;
  changes?: AdminLooseRecord;
  justification?: string;
  user_response: string;
  internal_note?: string;
}

export interface AdminReportWorkbenchApplyResult {
  actionSlug: string;
  status: string;
  workflowStatus?: string;
  target?: AdminLooseRecord;
  historyIds?: Record<string, number>;
  emailResults?: Record<string, AdminLooseRecord>;
}

export interface AdminReportWorkbenchSuggestion {
  kind: string;
  text: string;
  generatedAt?: string;
  moderatorId?: string;
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
  public_rating?: number | string | null;
  public_display_name?: string | null;
  public_headline?: string | null;
  home_published_at?: string | null;
  reply_count?: number;
}

export interface AdminFeedbackReply extends AdminFeedbackThread {
  parent_id: number;
}

const normalizeAdminFeedbackThread = <T extends AdminFeedbackThread>(thread: T): T => ({
  ...thread,
  reason: getSupportReasonLabel(thread.reason),
});

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

export interface AdminSecurityIpSignal {
  key: string;
  label: string;
  count: number;
}

export interface AdminSecuritySuspiciousIp {
  ipAddress: string;
  score: number;
  signals: AdminSecurityIpSignal[];
  sessionsCount: number;
  refreshCount: number;
  usersCount: number;
  firstSeenAt?: string | null;
  lastSeenAt?: string | null;
  isBanned: boolean;
  banReason?: string | null;
  bannedAt?: string | null;
  blockedHits?: number;
}

export interface AdminSecurityBannedIp {
  ipAddress: string;
  reason: string;
  blockedHits: number;
  lastBlockedAt?: string | null;
  bannedUntil?: string | null;
  createdBy?: string | null;
  updatedBy?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
}

export interface AdminSecurityIpsPayload {
  suspicious: AdminSecuritySuspiciousIp[];
  banned: AdminSecurityBannedIp[];
  stats: {
    suspiciousCount: number;
    bannedCount: number;
  };
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
  new_questions: number;
  seller_payout: number;
  available_seller_payout: number;
  transactions_count: number;
  refund_requests_count: number;
  refund_requested_amount: number;
  total_refunded: number;
  held_balance: number;
  total_paid: number;
  feedback_count: number;
  support_threads_count?: number;
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
  cardExpiredSubscribers?: number;
  cardExpiringSubscribers?: number;
  missingCardSubscribers?: number;
  riskRows?: AdminBillingRiskRow[];
}

export interface AdminBillingRiskRow {
  riskType: string;
  severity: 'blocking' | 'warning' | 'attention' | 'error' | string;
  source: string;
  reason: string;
  actionLabel?: string;
  subscriptionId?: string;
  userId?: string | null;
  userName?: string | null;
  userEmail: string;
  planName?: string;
  status?: string;
  cardLabel?: string;
  lastSignalAt?: string | null;
  canSendEmail?: boolean;
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
  intervalUnit?: 'day' | 'week' | 'month' | 'year' | string;
  intervalCount?: number;
  chargeIntervalUnit?: 'day' | 'week' | 'month' | 'year' | string;
  chargeIntervalCount?: number;
  projectionMode?: 'installments' | 'auto_renew' | string;
}

export interface AdminRevenueProjectionOverduePayment {
  subscriptionId: string;
  userId: string;
  userName: string;
  userEmail: string;
  planName: string;
  status: string;
  cycleKey: string;
  cycleLabel: string;
  installmentNumber: number;
  installmentCount: number;
  amount: number;
  dueAt: string;
  daysOverdue: number;
  reason: string;
}

export interface AdminRevenueProjectionPayload {
  totalProjectedAmount: number;
  totalRemainingInstallments: number;
  activeContracts: number;
  atRiskProjectedAmount: number;
  overduePaymentCount?: number;
  overduePaymentAmount?: number;
  overduePayments?: AdminRevenueProjectionOverduePayment[];
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
 * Normaliza a resposta da fila de comentários para aceitar backends antigos e novos.
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
   * Carrega as configurações públicas usadas no bootstrap da aplicação.
   * @since v1.0.0
   */
  async getPublicSystemSettings(): Promise<Partial<SystemSettings>> {
    return withRequestCoalescing('settings:public', async () => {
      const response = await requestApi<Partial<SystemSettings>>(apiClient.get<ApiResponse<Partial<SystemSettings>>>(ENDPOINTS.settings.get, {
        params: {
          _: Date.now(),
        },
      }));
      return readApiData(response, {});
    }, 5000);
  },

  /**
   * Carrega as configurações globais exibidas na aba de settings do admin.
   * @since v1.0.0
   */
  async getSystemSettings(): Promise<Partial<SystemSettings>> {
    return withRequestCoalescing('settings:admin', async () => {
      const response = await requestApi<Partial<SystemSettings>>(apiClient.get<ApiResponse<Partial<SystemSettings>>>(ENDPOINTS.settings.update, {
        params: {
          _: Date.now(),
        },
      }));
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
  /**
   * Lista o catalogo completo de planos para gestao financeira no admin.
   * Inclui planos de ciclo curto (ex.: 2 dias) e planos desativados.
   * @since v1.0.0
   */
  async getPlanCatalog(search = ''): Promise<AdminPlanCatalogItem[]> {
    const response = await requestApi<{ items?: AdminPlanCatalogItem[] } | AdminPlanCatalogItem[]>(apiClient.get<ApiResponse<{ items?: AdminPlanCatalogItem[] } | AdminPlanCatalogItem[]>>(
      ENDPOINTS.admin.plansCatalog,
      {
        params: {
          search: search.trim(),
        },
      },
    ));
    const payload = readApiData(response, { items: [] as AdminPlanCatalogItem[] });
    const items = Array.isArray(payload) ? payload : (Array.isArray(payload.items) ? payload.items : []);

    return items.map((item) => ({
      id: Number(item.id || 0),
      name: String(item.name || ''),
      description: typeof item.description === 'string' ? item.description : '',
      price: Number(item.price || 0),
      interval_count: Math.max(1, Number(item.interval_count || 1)),
      interval_unit: (['day', 'week', 'month', 'year'].includes(String(item.interval_unit || 'month'))
        ? String(item.interval_unit)
        : 'month') as 'day' | 'week' | 'month' | 'year',
      tier: item.tier == null ? null : Number(item.tier),
      active: item.active !== false,
      external_plan_id: item.external_plan_id ?? null,
      stripe_product_id: item.stripe_product_id ?? null,
      stripe_price_id: item.stripe_price_id ?? null,
      created_at: item.created_at ?? null,
      updated_at: item.updated_at ?? null,
      is_test_plan: item.is_test_plan === true,
      can_edit_interval: item.can_edit_interval === true,
      can_toggle_active: item.can_toggle_active === true,
    })).filter((item) => item.id > 0 && item.name !== '');
  },

  /**
   * Atualiza valor, ciclo e status de um plano do catalogo.
   * @since v1.0.0
   */
  async updatePlanCatalog(payload: {
    plan_id: number;
    price?: number;
    interval_count?: number;
    interval_unit?: 'day' | 'week' | 'month' | 'year';
    active?: boolean;
  }): Promise<AdminPlanCatalogItem> {
    const response = await requestApi<AdminPlanCatalogItem>(apiClient.post<ApiResponse<AdminPlanCatalogItem>>(
      ENDPOINTS.admin.plansCatalog,
      payload,
    ));
    const envelope = assertApiSuccess(response, 'Não foi possível atualizar o plano.');
    const item = readApiData<AdminPlanCatalogItem>(envelope.raw, {
      id: payload.plan_id,
      name: '',
      price: Number(payload.price || 0),
      interval_count: Math.max(1, Number(payload.interval_count || 1)),
      interval_unit: payload.interval_unit || 'month',
      active: payload.active !== false,
    });

    return {
      id: Number(item.id || payload.plan_id),
      name: String(item.name || ''),
      description: typeof item.description === 'string' ? item.description : '',
      price: Number(item.price || 0),
      interval_count: Math.max(1, Number(item.interval_count || 1)),
      interval_unit: (['day', 'week', 'month', 'year'].includes(String(item.interval_unit || 'month'))
        ? String(item.interval_unit)
        : 'month') as 'day' | 'week' | 'month' | 'year',
      tier: item.tier == null ? null : Number(item.tier),
      active: item.active !== false,
      external_plan_id: item.external_plan_id ?? null,
      stripe_product_id: item.stripe_product_id ?? null,
      stripe_price_id: item.stripe_price_id ?? null,
      created_at: item.created_at ?? null,
      updated_at: item.updated_at ?? null,
      is_test_plan: item.is_test_plan === true,
      can_edit_interval: item.can_edit_interval === true,
      can_toggle_active: item.can_toggle_active === true,
    };
  },

  async getUsers(): Promise<UserProfile[]> {
    const response = await requestApi<UserProfile[]>(apiClient.get<ApiResponse<UserProfile[]>>(ENDPOINTS.users.list));
    const payload = readApiData(response, []);
    return Array.isArray(payload) ? payload : [];
  },

  /**
   * Lista as denúncias/reportes visíveis na operação administrativa.
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
  async moderateReport(
    id: string,
    action: ReportResolution,
    adminReason: string,
    evidenceUrl?: string,
    options: {
      userResponse?: string;
      internalNote?: string;
      moderationAction?: string;
    } = {},
  ): Promise<void> {
    const response = await requestApi<unknown>(apiClient.post<ApiResponse>(ENDPOINTS.admin.reportActions, {
      id,
      action,
      admin_reason: adminReason,
      user_response: options.userResponse || adminReason,
      internal_note: options.internalNote || '',
      moderation_action: options.moderationAction || '',
      evidence_url: evidenceUrl,
    }));

    assertApiSuccess(response, 'Não foi possível moderar a denúncia.');
  },

  /**
   * Carrega o workbench contextual de uma denuncia/solicitacao.
   * @since v1.0.0
   */
  async getReportWorkbench(reportId: string | number): Promise<AdminReportWorkbenchPayload> {
    const response = await requestApi<AdminReportWorkbenchPayload>(apiClient.get<ApiResponse<AdminReportWorkbenchPayload>>(
      ENDPOINTS.admin.reportWorkbench,
      { params: { id: reportId } },
    ));
    return readApiData(response, {
      report: {
        id: String(reportId),
        reportType: 'error',
        reason: '',
        reasonSlug: 'other',
        details: '',
        status: 'pending',
        targetType: 'comment',
        targetId: '',
      },
      target: {
        type: 'comment',
        id: '',
        exists: false,
      },
      configuration: {
        title: 'Moderação',
        reportType: 'error',
        reasonSlug: 'other',
        actions: [],
      },
      draft: null,
      history: [],
    });
  },

  /**
   * Salva rascunho do workbench contextual.
   * @since v1.0.0
   */
  async saveReportModerationDraft(payload: {
    report_id: string;
    action_slug?: string;
    changes?: AdminLooseRecord;
    user_response?: string;
    internal_note?: string;
  }): Promise<void> {
    const response = await requestApi<unknown>(apiClient.post<ApiResponse>(ENDPOINTS.admin.reportWorkbench, {
      operation: 'save_draft',
      ...payload,
    }));
    assertApiSuccess(response, 'Não foi possível salvar o rascunho da moderação.');
  },

  /**
   * Solicita sugestao editorial por IA para a denuncia/solicitacao.
   * @since v1.0.0
   */
  async generateReportModerationSuggestion(payload: {
    report_id: string;
    kind?: string;
  }): Promise<AdminReportWorkbenchSuggestion> {
    const response = await requestApi<AdminReportWorkbenchSuggestion>(apiClient.post<ApiResponse<AdminReportWorkbenchSuggestion>>(
      ENDPOINTS.admin.reportWorkbench,
      {
        operation: 'generate_suggestion',
        ...payload,
      },
    ));
    const envelope = assertApiSuccess(response, 'Não foi possível gerar a sugestão.');
    return readApiData(envelope.raw, {
      kind: payload.kind || 'teacher_comment',
      text: '',
    });
  },

  /**
   * Aplica a acao contextual e conclui o atendimento.
   * @since v1.0.0
   */
  async applyReportModeration(payload: AdminReportWorkbenchApplyPayload): Promise<AdminReportWorkbenchApplyResult> {
    const response = await requestApi<AdminReportWorkbenchApplyResult>(apiClient.post<ApiResponse<AdminReportWorkbenchApplyResult>>(
      ENDPOINTS.admin.reportWorkbench,
      {
        operation: 'apply',
        ...payload,
      },
    ));
    const envelope = assertApiSuccess(response, 'Não foi possível concluir a moderação.');
    return readApiData(envelope.raw, {
      actionSlug: payload.action_slug,
      status: 'pending',
    });
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
    clearRequestCoalescing();
    return assertApiSuccess(response, 'Não foi possível atualizar o cache.').message || 'Configuração do cache atualizada.';
  },

  /**
   * Persiste as configurações de cache com confirmação do backend.
   * @since v1.0.0
   */
  async saveCacheSettings(payload: { enabled: boolean; default_ttl: number }): Promise<string> {
    const response = await requestApi<unknown>(apiClient.post<ApiResponse>(`${ENDPOINTS.cache.manage}?action=settings`, payload));
    clearRequestCoalescing();
    return assertApiSuccess(response, 'Não foi possível salvar as configurações de cache.').message || 'Configurações do cache atualizadas.';
  },

  /**
   * Limpa completamente o cache pelo fluxo administrativo.
   * @since v1.0.0
   */
  async clearCache(): Promise<string> {
    const response = await requestApi<unknown>(apiClient.get<ApiResponse>(`${ENDPOINTS.cache.manage}?action=clear`));
    clearRequestCoalescing();
    return assertApiSuccess(response, 'Não foi possível limpar o cache.').message || 'Cache limpo com sucesso.';
  },

  /**
   * Remove apenas entradas expiradas do cache pela tela de operação.
   * @since v1.0.0
   */
  async cleanExpiredCache(): Promise<string> {
    const response = await requestApi<unknown>(apiClient.get<ApiResponse>(`${ENDPOINTS.cache.manage}?action=clean`));
    clearRequestCoalescing();
    return assertApiSuccess(response, 'Não foi possível limpar o cache expirado.').message || 'Entradas expiradas removidas.';
  },

  /**
   * Carrega o payload de logs exibido no viewer administrativo.
   * @since v1.0.0
   */
  async getSystemLogPayload(): Promise<SystemLogsPayload> {
    const response = await requestApi<SystemLogsPayload>(apiClient.get<ApiResponse<SystemLogsPayload>>(ENDPOINTS.system.logs));
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
    await downloadAuthenticatedFile(`${ENDPOINTS.system.logs}?action=download`, 'concurso-mestre-logs.log');
  },

  /**
   * Limpa o arquivo de log pelo endpoint administrativo.
   * @since v1.0.0
   */
  async clearSystemLogs(): Promise<SystemLogsPayload> {
    const response = await requestApi<SystemLogsPayload>(apiClient.post<ApiResponse<SystemLogsPayload>>(`${ENDPOINTS.system.logs}?action=clear`, {}));
    assertApiSuccess(response, 'Não foi possível limpar os logs.');
    return readApiData(response, {
      lines: [],
      path: '',
      size_bytes: 0,
      updated_at: null,
      cleared: true,
    });
  },

  /**
   * Snapshot administrativo de IPs suspeitos/bloqueados.
   * @since v1.0.0
   */
  async getSecurityIps(search = '', limit = 50): Promise<AdminSecurityIpsPayload> {
    const response = await requestApi<AdminSecurityIpsPayload>(apiClient.get<ApiResponse<AdminSecurityIpsPayload>>(ENDPOINTS.admin.securityIps, {
      params: {
        search,
        limit,
      },
    }));

    return readApiData(response, {
      suspicious: [],
      banned: [],
      stats: {
        suspiciousCount: 0,
        bannedCount: 0,
      },
    });
  },

  /**
   * Bloqueia manualmente um IP suspeito.
   * @since v1.0.0
   */
  async banSecurityIp(ipAddress: string, reason: string): Promise<void> {
    const response = await requestApi<unknown>(apiClient.post<ApiResponse>(ENDPOINTS.admin.securityIps, {
      action: 'ban',
      ipAddress,
      reason,
    }));
    assertApiSuccess(response, 'Não foi possível bloquear o IP.');
  },

  /**
   * Remove o bloqueio manual de um IP.
   * @since v1.0.0
   */
  async unbanSecurityIp(ipAddress: string): Promise<void> {
    const response = await requestApi<unknown>(apiClient.post<ApiResponse>(ENDPOINTS.admin.securityIps, {
      action: 'unban',
      ipAddress,
    }));
    assertApiSuccess(response, 'Não foi possível desbloquear o IP.');
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
          new_questions: 0,
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
        cardExpiredSubscribers: 0,
        cardExpiringSubscribers: 0,
        missingCardSubscribers: 0,
        riskRows: [],
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
   * Envia ao aluno um email de regularização quando o financeiro detecta risco de cobranca.
   * @since v1.0.0
   */
  async sendBillingRiskEmail(payload: { userId: string; reason?: string }): Promise<{ sent: boolean; email?: string }> {
    const response = await requestApi<{ sent: boolean; email?: string }>(apiClient.post<ApiResponse<{ sent: boolean; email?: string }>>(
      `${ENDPOINTS.admin.analyticsFinance}?action=send_billing_risk_email`,
      payload,
    ));

    return readApiData(response, { sent: false });
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
            cardExpiredSubscribers: 0,
            cardExpiringSubscribers: 0,
            missingCardSubscribers: 0,
            riskRows: [],
          },
        });
      },
      30_000,
    );
  },

  /**
   * Carrega o funil e a conversao por ciclo para a área comercial.
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
   * Lista a fila unificada de moderação de comentários.
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
   * Atualiza um comentário individual na caixa de moderação.
   * @since v1.0.0
   */
  async updateModerationComment(id: string, status: AdminCommentModerationStatus): Promise<AdminCommentModerationItem> {
    const response = await requestApi<AdminCommentModerationItem>(apiClient.post<ApiResponse<AdminCommentModerationItem>>(ENDPOINTS.admin.commentsModeration, { id, status }));
    const envelope = assertApiSuccess<AdminCommentModerationItem>(response, 'Não foi possível atualizar o comentário.');
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
   * Atualiza varios comentários de uma vez.
   * @since v1.0.0
   */
  async bulkUpdateModerationComments(ids: string[], status: AdminCommentModerationStatus): Promise<{ updated: number }> {
    const response = await requestApi<{ updated: number }>(apiClient.post<ApiResponse<{ updated: number }>>(ENDPOINTS.admin.commentsModerationBulk, { ids, status }));
    return readApiData(
      assertApiSuccess(response, 'Não foi possível atualizar os comentários selecionados.').raw,
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
   * Lista contextos reutilizaveis por questões.
   * @since v1.0.0
   */
  async getQuestionGroups(params: { keyword?: string } = {}): Promise<AdminQuestionGroupItem[]> {
    const keyword = String(params.keyword || '').trim();
    return withRequestCoalescing(
      buildRequestCacheKey('admin:question-groups', { keyword }),
      async () => {
        const response = await requestApi<{ items?: AdminQuestionGroupItem[] } | AdminQuestionGroupItem[]>(apiClient.get<ApiResponse<{ items?: AdminQuestionGroupItem[] } | AdminQuestionGroupItem[]>>(
          ENDPOINTS.questions.groups,
          {
            params: {
              keyword,
            },
          },
        ));

        const payload = readApiData(response, { items: [] as AdminQuestionGroupItem[] });
        const items = Array.isArray(payload) ? payload : payload.items;
        return Array.isArray(items) ? items : [];
      },
      10_000,
    );
  },

  /**
   * Cria ou atualiza um contexto do banco de questões.
   * @since v1.0.0
   */
  async saveQuestionGroup(payload: AdminQuestionGroupPayload): Promise<AdminQuestionGroupItem> {
    const response = await requestApi<AdminQuestionGroupItem>(apiClient.post<ApiResponse<AdminQuestionGroupItem>>(ENDPOINTS.questions.groups, payload));
    const envelope = assertApiSuccess<AdminQuestionGroupItem>(response, 'Não foi possível salvar o contexto de questões.');
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
   * Envia imagem para um contexto de questões.
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
      'Não foi possível enviar a imagem do contexto.',
    );
    const payload = readApiData<{ url?: string; image_url?: string; imageUrl?: string }>(envelope.raw, {});
    const imageUrl = payload.url || payload.image_url || payload.imageUrl || '';

    if (!imageUrl) {
      throw new Error('O backend nao retornou a URL da imagem.');
    }

    return imageUrl;
  },

  /**
   * Remove um contexto e desvincula as questões associadas.
   * @since v1.0.0
   */
  async deleteQuestionGroup(id: string | number): Promise<void> {
    const response = await requestApi<unknown>(apiClient.post<ApiResponse>(ENDPOINTS.questions.groups, { action: 'delete', id }));
    assertApiSuccess(response, 'Não foi possível remover o contexto de questões.');
  },

  /**
   * Carrega o perfil detalhado de um usuário para o modal administrativo.
   * @since v1.0.0
   */
  async getUserDetails(userId: string): Promise<AdminUserDetailsPayload> {
    const normalizedUserId = String(userId || '').trim();
    return withRequestCoalescing(
      buildRequestCacheKey('admin:user-details', { userId: normalizedUserId }),
      async () => {
        const response = await requestApi<AdminUserDetailsPayload>(apiClient.get<ApiResponse<AdminUserDetailsPayload>>(`${ENDPOINTS.admin.userDetails}?id=${normalizedUserId}`));
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
      15_000,
    );
  },

  /**
   * Executa a ação administrativa e devolve a mensagem confirmada pelo backend.
   * @since v1.0.0
   */
  async performUserActionWithResult(payload: AdminUserActionPayload): Promise<AdminUserActionResult> {
    const response = await requestApi<AdminLooseRecord>(apiClient.post<ApiResponse>(ENDPOINTS.admin.userActions, payload));
    const result = assertApiSuccess(response, 'Não foi possível executar a ação administrativa.');
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
   * Confirma a ativação do 2FA com o código informado pelo administrador.
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
    const result = assertApiSuccess(response, 'Não foi possível testar o SMTP.');
    return {
      message: result.message || 'SMTP validado com sucesso.',
      data: toLooseRecord(result.data),
    };
  },

  /**
   * Envia um e-mail de teste usando um modelo editavel do painel.
   * @since v1.0.0
   */
  async testEmailTemplate(payload: object): Promise<AdminSettingsTestResult> {
    const response = await requestApi<AdminLooseRecord>(apiClient.post<ApiResponse>(`${ENDPOINTS.settings.update}?action=test_email_template`, payload));
    const result = assertApiSuccess(response, 'Não foi possível testar o modelo de e-mail.');
    return {
      message: result.message || 'Modelo de e-mail testado com sucesso.',
      data: toLooseRecord(result.data),
    };
  },

  /**
   * Executa uma checagem administrativa das integrações configuradas.
   * @since v1.0.0
   */
  async testIntegrations(payload: object): Promise<AdminSettingsTestResult> {
    const response = await requestApi<AdminLooseRecord>(apiClient.post<ApiResponse>(`${ENDPOINTS.settings.update}?action=test_integrations`, payload));
    const result = assertApiSuccess(response, 'Não foi possível validar as integrações.');
    return {
      message: result.message || 'Integrações verificadas com sucesso.',
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
        return (readApiData(response, { items: [] }).items || []).map(normalizeAdminFeedbackThread);
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

  async updateFeedbackHomePublication(id: number, published: boolean): Promise<void> {
    const response = await requestApi<unknown>(apiClient.put<ApiResponse>(ENDPOINTS.admin.feedback, {
      id,
      action: published ? 'publish_home' : 'unpublish_home',
    }));
    assertApiSuccess(response, published ? 'Não foi possível aprovar a avaliação na home.' : 'Não foi possível remover a avaliação da home.');
  },

  /**
   * Carrega as respostas de uma thread de feedback para o painel de suporte.
   * @since v1.0.0
   */
  async getFeedbackReplies(parentId: number): Promise<AdminFeedbackReply[]> {
    const response = await requestApi<{ replies: AdminFeedbackReply[] }>(apiClient.get<ApiResponse<{ replies: AdminFeedbackReply[] }>>(`${ENDPOINTS.admin.feedback}?id=${parentId}`));
    return (readApiData(response, { replies: [] }).replies || []).map(normalizeAdminFeedbackThread);
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
