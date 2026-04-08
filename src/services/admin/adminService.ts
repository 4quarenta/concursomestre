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

import { apiClient, ENDPOINTS, assertApiSuccess, readApiData } from '@services/api';
import type { ApiResponse } from '@services/api';
import type { ErrorReport, Question, Ranking, SystemSettings, UserProfile } from '@types';

type FeedbackStatus = 'new' | 'read' | 'resolved';
type ReportResolution = 'resolved' | 'ignored';

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
}

export interface SystemLogsPayload {
  lines: string[];
  path?: string;
}

export interface AdminStatsPayload {
  total_revenue: number;
  platform_revenue: number;
  subscription_revenue: number;
  available_subscription_revenue: number;
  marketplace_revenue: number;
  active_subscriptions: number;
  cancelled_subscriptions: number;
  mrr: number;
  new_users: number;
  seller_payout: number;
  available_seller_payout: number;
  transactions_count: number;
  total_refunded: number;
  held_balance: number;
  total_paid: number;
  feedback_count: number;
  questions_count: number;
  users_count: number;
  materials_count: number;
  rankings_count: number;
  available_platform_revenue: number;
}

export interface AdminUserDetailsPayload {
  profile: Record<string, any>;
  subscriptions: Record<string, any>[];
  transactions: Record<string, any>[];
  available_plans: Record<string, any>[];
  materials: Record<string, any>[];
  stats: {
    comments_count: number;
  };
  last_comments: Record<string, any>[];
}

export interface AdminUserActionPayload {
  user_id?: string;
  action: string;
  transaction_id?: number;
  plan_id?: number;
  days?: number;
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
  data?: Record<string, any>;
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

export interface AdminQuestionListPayload {
  rows: Question[];
  total: number;
  perPage: number;
  pages: number;
  page: number;
}

/**
 * Fachada oficial do painel administrativo.
 * Ela concentra os contratos usados por dashboard, base de dados, financeiro, feedback e segurança no admin.
 * @since v1.0.0
 */
export const adminService = {
  /**
   * Carrega as configurações globais exibidas na aba de settings do admin.
   * @since v1.0.0
   */
  async getSystemSettings(): Promise<Partial<SystemSettings>> {
    const response = await apiClient.get<ApiResponse<Partial<SystemSettings>>>(ENDPOINTS.settings.get) as any;
    return readApiData(response, {});
  },

  /**
   * Persiste as configurações globais alteradas pelo painel administrativo.
   * @since v1.0.0
   */
  async saveSystemSettings(settings: SystemSettings): Promise<void> {
    const response = await apiClient.post<ApiResponse>(ENDPOINTS.settings.update, settings) as any;
    assertApiSuccess(response, 'Não foi possível salvar as configurações.');
  },

  /**
   * Lista os usuários para gestão e moderação no admin.
   * @since v1.0.0
   */
  async getUsers(): Promise<UserProfile[]> {
    const response = await apiClient.get<ApiResponse<UserProfile[]>>(ENDPOINTS.users.list) as any;
    const payload = readApiData(response, []);
    return Array.isArray(payload) ? payload : [];
  },

  /**
   * Lista as denúncias/reportes visiveis na operação administrativa.
   * @since v1.0.0
   */
  async getReports(): Promise<ErrorReport[]> {
    const response = await apiClient.get<ApiResponse<ErrorReport[]>>(ENDPOINTS.reports.list) as any;
    const payload = readApiData(response, []);
    return Array.isArray(payload) ? payload : [];
  },

  /**
   * Executa a moderação final de uma denúncia com justificativa administrativa.
   * @since v1.0.0
   */
  async moderateReport(id: string, action: ReportResolution, adminReason: string, evidenceUrl?: string): Promise<void> {
    const response = await apiClient.post<ApiResponse>(ENDPOINTS.admin.reportActions, {
      id,
      action,
      admin_reason: adminReason,
      evidence_url: evidenceUrl,
    }) as any;

    assertApiSuccess(response, 'Não foi possível moderar a denúncia.');
  },

  /**
   * Atualiza um ranking existente pelo fluxo do admin.
   * @since v1.0.0
   */
  async updateRanking(ranking: Ranking): Promise<void> {
    const response = await apiClient.post<ApiResponse>(ENDPOINTS.rankings.update, ranking) as any;
    assertApiSuccess(response, 'Não foi possível atualizar o ranking.');
  },

  /**
   * Exclui um ranking na operação administrativa.
   * @since v1.0.0
   */
  async deleteRanking(id: string): Promise<void> {
    const response = await apiClient.post<ApiResponse>(ENDPOINTS.rankings.delete, { id }) as any;
    assertApiSuccess(response, 'Não foi possível excluir o ranking.');
  },

  /**
   * Le o estado atual do cache administrativo para a tela de manutencao.
   * @since v1.0.0
   */
  async getCacheStats(): Promise<CacheStatsPayload> {
    const response = await apiClient.get<ApiResponse<CacheStatsPayload>>(`${ENDPOINTS.cache.manage}?action=stats`) as any;
    return readApiData(response, {
      total_files: 0,
      valid_entries: 0,
      expired_entries: 0,
      total_size_mb: 0,
      enabled: true,
    });
  },

  /**
   * Ativa ou desativa o cache do backend a partir do painel admin.
   * @since v1.0.0
   */
  async toggleCache(enabled: boolean): Promise<string> {
    const response = await apiClient.post<ApiResponse>(`${ENDPOINTS.cache.manage}?action=settings`, { enabled }) as any;
    return assertApiSuccess(response, 'Não foi possível atualizar o cache.').message || 'Configuração do cache atualizada.';
  },

  /**
   * Limpa completamente o cache pelo fluxo administrativo.
   * @since v1.0.0
   */
  async clearCache(): Promise<string> {
    const response = await apiClient.get<ApiResponse>(`${ENDPOINTS.cache.manage}?action=clear`) as any;
    return assertApiSuccess(response, 'Não foi possível limpar o cache.').message || 'Cache limpo com sucesso.';
  },

  /**
   * Remove apenas entradas expiradas do cache pela tela de operação.
   * @since v1.0.0
   */
  async cleanExpiredCache(): Promise<string> {
    const response = await apiClient.get<ApiResponse>(`${ENDPOINTS.cache.manage}?action=clean`) as any;
    return assertApiSuccess(response, 'Não foi possível limpar o cache expirado.').message || 'Entradas expiradas removidas.';
  },

  /**
   * Carrega as linhas de log exibidas no viewer administrativo.
   * @since v1.0.0
   */
  async getSystemLogs(): Promise<string[]> {
    const response = await apiClient.get<ApiResponse<SystemLogsPayload>>(ENDPOINTS.system.logs) as any;
    const payload = readApiData(response, { lines: [] });
    return payload.lines || [];
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
    const query = new URLSearchParams({ period: params.period });

    if (params.period === 'custom' && params.startDate && params.endDate) {
      query.set('startDate', params.startDate);
      query.set('endDate', params.endDate);
    }

    const response = await apiClient.get<ApiResponse<AdminStatsPayload>>(`${ENDPOINTS.admin.stats}?${query.toString()}`) as any;
    return readApiData(response, {
      total_revenue: 0,
      platform_revenue: 0,
      subscription_revenue: 0,
      available_subscription_revenue: 0,
      marketplace_revenue: 0,
      active_subscriptions: 0,
      cancelled_subscriptions: 0,
      mrr: 0,
      new_users: 0,
      seller_payout: 0,
      available_seller_payout: 0,
      transactions_count: 0,
      total_refunded: 0,
      held_balance: 0,
      total_paid: 0,
      feedback_count: 0,
      questions_count: 0,
      users_count: 0,
      materials_count: 0,
      rankings_count: 0,
      available_platform_revenue: 0,
    });
  },

  /**
   * Lista as questões para a grade administrativa com pagina e busca.
   * @since v1.0.0
   */
  async getQuestions(params: {
    page?: number;
    keyword?: string;
  }): Promise<AdminQuestionListPayload> {
    const response = await apiClient.get<ApiResponse<AdminQuestionListPayload>>(ENDPOINTS.questions.filter, {
      params: {
        page: String(params.page || 1),
        keyword: params.keyword || '',
      },
    }) as any;

    const payload = readApiData(response, {
      rows: [],
      total: 0,
      perPage: 20,
      pages: 1,
      page: params.page || 1,
    });

    return {
      rows: Array.isArray(payload.rows) ? payload.rows : [],
      total: Number(payload.total || 0),
      perPage: Number(payload.perPage || 20),
      pages: Number(payload.pages || 1),
      page: Number(payload.page || params.page || 1),
    };
  },

  /**
   * Carrega o perfil detalhado de um usuário para o modal administrativo.
   * @since v1.0.0
   */
  async getUserDetails(userId: string): Promise<AdminUserDetailsPayload> {
    const response = await apiClient.get<ApiResponse<AdminUserDetailsPayload>>(`${ENDPOINTS.admin.userDetails}?id=${userId}`) as any;
    return readApiData(response, {
      profile: {},
      subscriptions: [],
      transactions: [],
      available_plans: [],
      materials: [],
      stats: {
        comments_count: 0,
      },
      last_comments: [],
    });
  },

  /**
   * Executa a acao administrativa e devolve a mensagem confirmada pelo backend.
   * @since v1.0.0
   */
  async performUserActionWithResult(payload: AdminUserActionPayload): Promise<AdminUserActionResult> {
    const response = await apiClient.post<ApiResponse>(ENDPOINTS.admin.userActions, payload) as any;
    const result = assertApiSuccess(response, 'Nao foi possivel executar a acao administrativa.');
    return {
      message: result.message,
      data: result.data,
    };
  },

  /**
   * Executa ações administrativas em usuários, assinaturas e transações.
   * @since v1.0.0
   */
  async performUserAction(payload: AdminUserActionPayload): Promise<void> {
    const response = await apiClient.post<ApiResponse>(ENDPOINTS.admin.userActions, payload) as any;
    assertApiSuccess(response, 'Não foi possível executar a ação administrativa.');
  },

  /**
   * Lista as tabelas liberadas para reset controlado de base.
   * @since v1.0.0
   */
  async listResettableTables(): Promise<string[]> {
    const response = await apiClient.get<ApiResponse<{ tables: string[] }>>(ENDPOINTS.admin.listTables) as any;
    return readApiData(response, { tables: [] }).tables || [];
  },

  /**
   * Inicia o setup de 2FA do admin retornando segredo e QR code.
   * @since v1.0.0
   */
  async setupTwoFactor(): Promise<AdminTwoFactorSetupPayload> {
    const response = await apiClient.get<ApiResponse<AdminTwoFactorSetupPayload>>(ENDPOINTS.auth.setupTwoFactor) as any;
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
    const response = await apiClient.post<ApiResponse>(ENDPOINTS.auth.enableTwoFactor, {
      secret,
      code,
    }) as any;

    return assertApiSuccess(response, 'Não foi possível ativar o 2FA.').message || '2FA ativado com sucesso!';
  },

  /**
   * Dispara o reset administrativo da base conforme as tabelas selecionadas.
   * @since v1.0.0
   */
  async resetDatabase(payload: AdminDatabaseResetPayload): Promise<void> {
    const response = await apiClient.post<ApiResponse>(ENDPOINTS.admin.resetDatabase, payload) as any;
    assertApiSuccess(response, 'Não foi possível resetar a base de dados.');
  },

  /**
   * Lista as threads de feedback/chamados visiveis no suporte administrativo.
   * @since v1.0.0
   */
  async getFeedbackThreads(): Promise<AdminFeedbackThread[]> {
    const response = await apiClient.get<ApiResponse<{ items: AdminFeedbackThread[] }>>(ENDPOINTS.admin.feedback) as any;
    return readApiData(response, { items: [] }).items || [];
  },

  /**
   * Atualiza o status operacional de uma thread de feedback.
   * @since v1.0.0
   */
  async updateFeedbackStatus(id: number, status: FeedbackStatus): Promise<void> {
    const response = await apiClient.put<ApiResponse>(ENDPOINTS.admin.feedback, { id, status }) as any;
    assertApiSuccess(response, 'Não foi possível atualizar o feedback.');
  },

  /**
   * Carrega as respostas de uma thread de feedback para o painel de suporte.
   * @since v1.0.0
   */
  async getFeedbackReplies(parentId: number): Promise<AdminFeedbackReply[]> {
    const response = await apiClient.get<ApiResponse<{ replies: AdminFeedbackReply[] }>>(`${ENDPOINTS.admin.feedback}?id=${parentId}`) as any;
    return readApiData(response, { replies: [] }).replies || [];
  },

  /**
   * Envia uma resposta administrativa para a thread de feedback selecionada.
   * @since v1.0.0
   */
  async replyToFeedback(parentId: number, details: string): Promise<void> {
    const response = await apiClient.post<ApiResponse>(ENDPOINTS.admin.feedback, {
      parent_id: parentId,
      details,
    }) as any;

    assertApiSuccess(response, 'Não foi possível enviar a resposta.');
  },
};

export default adminService;
