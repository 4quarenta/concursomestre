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

import type { ErrorReport, Question, QuestionAsset } from '@types';

/**
 * Contratos compartilhados da fachada administrativa.
 * Mantidos fora da implementacao HTTP para impedir que a tipagem volte a transformar o service em um hotspot monolitico.
 * @since v1.0.0
 */
export type FeedbackStatus = 'new' | 'read' | 'resolved';
export type ReportResolution = 'resolved' | 'ignored';
export type AdminLooseRecord = Record<string, unknown>;
export type AdminLaunchMode = 'PRELAUNCH' | 'GO_CANDIDATE' | 'PRODUCTION';

export interface AdminCommunicationHistoryItem {
  id: string;
  event_type?: string | null;
  delivery_class?: string | null;
  recipient?: string | null;
  intent_status?: string | null;
  delivery_status?: string | null;
  channel?: string | null;
  attempts?: number | string | null;
  provider_message_id?: string | null;
  source_revision?: number | string | null;
  source_state?: string | null;
  created_at?: string | null;
  delivered_at?: string | null;
  last_error?: string | null;
  delivery_error?: string | null;
}

export interface AdminCommunicationHistoryPayload {
  items: AdminCommunicationHistoryItem[];
  page: number;
  perPage: number;
  total: number;
  pages: number;
}

export interface AdminLaunchModeStatus {
  runtimeEnvironment: string;
  actualLaunchMode: AdminLaunchMode;
  publicIndexingState: string;
  technicalReadiness: string;
  releaseRecommendation: string;
}

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
  assigned_to?: string | null;
  assigned_user_name?: string | null;
  assigned_user_role?: string | null;
}

export interface AdminFeedbackOperator {
  id: string;
  name: string;
  role: 'admin' | 'staff' | string;
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
  grossCapturedAmount?: number;
  financeSource?: 'ledger' | 'transactions_legacy';
  commercialPlatformRevenue?: number;
  sellerPayable?: number;
  referralPayable?: number;
  referralPending?: number;
  referralAvailable?: number;
  referralScheduled?: number;
  referralPaid?: number;
  providerFees?: number | null;
  platformNet?: number;
  totalPayable?: number;
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

export interface AdminReferralTransfer {
  referrerId: string;
  referrerName: string;
  referrerEmail: string;
  referredUsers: number;
  pendingAmount: number;
  availableAmount: number;
}

export interface AdminReferralPayoutItem {
  id: number;
  cycleId: number;
  referrerId: string;
  referrerName: string;
  referrerEmail: string;
  amount: number;
  status: 'review' | 'approved' | 'paid' | string;
  providerReference: string | null;
  paidAt: string | null;
}

export interface AdminReferralPayoutOverview {
  settings: {
    commissionPercent: number;
    refundGraceDays: number;
    cycleDays: number;
    payoutDay: number;
    nextPayoutDate: string;
  };
  summary: {
    pending: number;
    availableToSchedule: number;
  };
  transfers: AdminReferralTransfer[];
  cycles: Array<Record<string, unknown>>;
  payoutItems: AdminReferralPayoutItem[];
}

export interface AdminReferralPayoutCycleResult {
  created: boolean;
  reason?: 'outside_payout_day' | 'no_available_balance' | string;
  scheduledFor?: string;
  cycleId?: number;
  items?: number;
  amount?: number;
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
  benefit_mode?: 'ACCESS_ONLY' | 'BILLING_EXTENSION_ONLY' | 'ACCESS_AND_BILLING_EXTENSION';
  access_plan?: string;
  ticket_reference?: string;
  reason?: string;
  idempotency_key?: string;
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

export interface SafeOperationDefinition {
  operation_type: string;
  label: string;
  risk_class: string;
  recovery_class: string;
  target: string;
  execution_allowed: boolean;
}

export interface SafeOperationCatalogPayload {
  environment: string;
  operations: SafeOperationDefinition[];
}

export interface SafeOperationSnapshot {
  affected_count: number;
  affected_resources?: string[];
  protected_resources?: string[];
  protected_domains?: Record<string, string>;
  schema_guard?: Record<string, unknown>;
  execution?: string;
  truncated?: boolean;
}

export interface SafeOperationPreviewPayload {
  operation_id: string;
  operation_type: string;
  environment: string;
  risk_class: string;
  namespace: string;
  snapshot: SafeOperationSnapshot;
  preview_fingerprint: string;
  preview_expires_at: string;
  confirmation_required: boolean;
  execution_allowed: boolean;
  recovery: { class: string; status: string };
}

export interface SafeOperationConfirmationPayload {
  operation_id: string;
  status: string;
  confirmation_token: string;
  confirmation_expires_at: string;
}

export interface SafeOperationExecutionPayload {
  operation_id: string;
  status: string;
  actual_count?: number;
  postcondition?: Record<string, unknown>;
  recovery_status?: string;
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
  provaId?: number | string | null;
  prova_id?: number | string | null;
  provaTitle?: string | null;
  prova_title?: string | null;
  texto: string;
  assets?: QuestionAsset[];
  questionIds?: Array<number | string> | string | null;
  question_count?: number;
  questionCount?: number;
  // Leitura temporária de registros legados.
  enunciado?: string;
  enunciado_clean?: string;
  enunciadoClean?: string;
  image_url?: string | null;
  imageUrl?: string | null;
  question_ids?: Array<number | string> | string | null;
}

export interface AdminQuestionGroupPayload {
  id?: number | string | null;
  provaId: number | string;
  texto: string;
  assets: QuestionAsset[];
  questionIds: Array<number | string>;
}
