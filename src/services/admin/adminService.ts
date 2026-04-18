import { requestAuthenticatedApi } from '@/lib/authSession';
import { assertApiSuccess, readApiData } from '@/lib/browserApi';
import type { ErrorReport, Material, SystemSettings, Transaction, UserProfile } from '@/types';

export interface AdminStatsPayload {
  active_subscriptions: number;
  available_platform_revenue: number;
  available_subscription_revenue: number;
  available_total_revenue: number;
  cancelled_subscriptions: number;
  expired_subscriptions: number;
  feedback_count: number;
  held_balance: number;
  marketplace_revenue: number;
  materials_count: number;
  mrr: number;
  new_users: number;
  platform_revenue: number;
  questions_count: number;
  rankings_count: number;
  refund_requested_amount: number;
  refund_requests_count: number;
  seller_payout: number;
  subscription_revenue: number;
  total_paid: number;
  total_refunded: number;
  total_revenue: number;
  transactions_count: number;
  trial_subscriptions: number;
  users_count: number;
}

export interface AdminFeedbackThread {
  created_at: string;
  details: string;
  id: number;
  reason: string;
  reply_count?: number;
  status: 'new' | 'read' | 'resolved';
  type: string;
  user_email: string;
  user_id: string;
  user_name: string;
  user_role?: string;
}

export interface SystemLogsPayload {
  lines: string[];
  path?: string;
}

const ADMIN_ENDPOINTS = {
  stats: 'admin/stats.php',
  users: 'usersList',
  materials: 'materialsList',
  transactions: 'transactionsList',
  reports: 'reportsList',
  feedback: 'admin/feedback.php',
  settingsGet: 'settings.php',
  settingsSave: 'admin/settings.php',
  logs: 'system/logs.php',
} as const;

const defaultStats: AdminStatsPayload = {
  active_subscriptions: 0,
  available_platform_revenue: 0,
  available_subscription_revenue: 0,
  available_total_revenue: 0,
  cancelled_subscriptions: 0,
  expired_subscriptions: 0,
  feedback_count: 0,
  held_balance: 0,
  marketplace_revenue: 0,
  materials_count: 0,
  mrr: 0,
  new_users: 0,
  platform_revenue: 0,
  questions_count: 0,
  rankings_count: 0,
  refund_requested_amount: 0,
  refund_requests_count: 0,
  seller_payout: 0,
  subscription_revenue: 0,
  total_paid: 0,
  total_refunded: 0,
  total_revenue: 0,
  transactions_count: 0,
  trial_subscriptions: 0,
  users_count: 0,
};

const withQuery = (endpoint: string, params: Record<string, string | number | undefined> = {}) => {
  const query = new URLSearchParams();

  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== '') {
      query.set(key, String(value));
    }
  });

  const queryString = query.toString();
  return queryString ? `${endpoint}?${queryString}` : endpoint;
};

const readArray = <T>(response: any): T[] => {
  const payload = readApiData<any>(response, []);

  if (Array.isArray(payload)) {
    return payload;
  }

  if (Array.isArray(payload?.rows)) {
    return payload.rows;
  }

  if (Array.isArray(payload?.items)) {
    return payload.items;
  }

  if (Array.isArray(payload?.data)) {
    return payload.data;
  }

  return [];
};

export const adminService = {
  async getStats(period: 'all' | 'today' | 'week' | 'month' | 'year' = 'month'): Promise<AdminStatsPayload> {
    const response = await requestAuthenticatedApi<any>(
      withQuery(ADMIN_ENDPOINTS.stats, { period }),
      { method: 'GET' },
    );

    return {
      ...defaultStats,
      ...readApiData<Partial<AdminStatsPayload>>(response, {}),
    };
  },

  async getUsers(): Promise<UserProfile[]> {
    const response = await requestAuthenticatedApi<any>(ADMIN_ENDPOINTS.users, { method: 'GET' });
    return readArray<UserProfile>(response);
  },

  async getMaterials(): Promise<Material[]> {
    const response = await requestAuthenticatedApi<any>(ADMIN_ENDPOINTS.materials, { method: 'GET' });
    return readArray<Material>(response);
  },

  async getTransactions(): Promise<Transaction[]> {
    const response = await requestAuthenticatedApi<any>(
      withQuery(ADMIN_ENDPOINTS.transactions, { scope: 'all', limit: 200 }),
      { method: 'GET' },
    );
    return readArray<Transaction>(response);
  },

  async getReports(): Promise<ErrorReport[]> {
    const response = await requestAuthenticatedApi<any>(ADMIN_ENDPOINTS.reports, { method: 'GET' });
    return readArray<ErrorReport>(response);
  },

  async getFeedbackThreads(): Promise<AdminFeedbackThread[]> {
    const response = await requestAuthenticatedApi<any>(ADMIN_ENDPOINTS.feedback, { method: 'GET' });
    const payload = readApiData<any>(response, { items: [] });
    return Array.isArray(payload?.items) ? payload.items : readArray<AdminFeedbackThread>(response);
  },

  async getSettings(): Promise<Partial<SystemSettings>> {
    const response = await requestAuthenticatedApi<any>(ADMIN_ENDPOINTS.settingsGet, { method: 'GET' });
    return readApiData<Partial<SystemSettings>>(response, {});
  },

  async saveSettings(settings: SystemSettings): Promise<Partial<SystemSettings>> {
    const response = await requestAuthenticatedApi<any>(ADMIN_ENDPOINTS.settingsSave, {
      method: 'POST',
      body: settings,
    });

    const envelope = assertApiSuccess<Partial<SystemSettings>>(response, 'Nao foi possivel salvar as configuracoes.');
    return readApiData<Partial<SystemSettings>>(envelope.raw, {});
  },

  async getSystemLogs(): Promise<string[]> {
    const response = await requestAuthenticatedApi<any>(ADMIN_ENDPOINTS.logs, { method: 'GET' });
    const payload = readApiData<SystemLogsPayload>(response, { lines: [] });
    return payload.lines || [];
  },
};

export default adminService;
