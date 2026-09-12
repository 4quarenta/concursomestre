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
import { getCsrfToken } from '@services/auth/session';
import type { ErrorReport, Ranking, SystemSettings, UserProfile } from '@types';
import { normalizeAdminFeedbackThread, normalizeAdminQuestionListPayload } from './adminService.normalizers';
import { adaptPublicSystemSettings, type PublicSystemSettingsContract } from './publicSettingsContract';
import type {
  FeedbackStatus,
  ReportResolution,
  AdminLooseRecord,
  AdminPlanCatalogItem,
  AdminReportWorkbenchPayload,
  AdminReportWorkbenchApplyPayload,
  AdminReportWorkbenchApplyResult,
  AdminReportWorkbenchSuggestion,
  AdminFeedbackThread,
  AdminFeedbackReply,
  CacheStatsPayload,
  SystemLogsPayload,
  AdminSecurityIpsPayload,
  AdminStatsPayload,
  AdminAnalyticsRange,
  AdminFinanceAnalyticsPayload,
  AdminReferralPayoutOverview,
  AdminReferralPayoutCycleResult,
  AdminDashboardAnalyticsPayload,
  AdminLeadSegment,
  AdminAnalyticsExportParams,
  AdminCommentModerationStatus,
  AdminCommentModerationFilter,
  AdminCommentModerationCounts,
  AdminCommentModerationItem,
  AdminCommentModerationListPayload,
  AdminUserDetailsPayload,
  AdminUserActionPayload,
  AdminUserActionResult,
  AdminDatabaseResetPayload,
  AdminTwoFactorSetupPayload,
  AdminSettingsTestResult,
  AdminQuestionListPayload,
  AdminQuestionGroupItem,
  AdminQuestionGroupPayload,
  AdminLaunchMode,
  AdminLaunchModeStatus,
} from './adminService.types';
export * from './adminService.types';


export interface AdminBrandAsset {
  url: string;
  mimeType: string;
  size: number;
  width: number;
  height: number;
}

const requestApi = <T>(request: Promise<unknown>): Promise<ApiResponse<T>> => request as Promise<ApiResponse<T>>;

const adminPost = <T>(endpoint: string, payload: unknown) => {
  const csrfToken = getCsrfToken();
  return csrfToken
    ? apiClient.post<ApiResponse<T>>(endpoint, payload, { headers: { 'X-CSRF-Token': csrfToken } })
    : apiClient.post<ApiResponse<T>>(endpoint, payload);
};

const adminPut = <T>(endpoint: string, payload: unknown) => {
  const csrfToken = getCsrfToken();
  return csrfToken
    ? apiClient.put<ApiResponse<T>>(endpoint, payload, { headers: { 'X-CSRF-Token': csrfToken } })
    : apiClient.put<ApiResponse<T>>(endpoint, payload);
};
const toLooseRecord = (value: unknown): AdminLooseRecord | undefined => (
  value && typeof value === 'object' && !Array.isArray(value)
    ? value as AdminLooseRecord
    : undefined
);

const NON_FINAL_REPORT_WORKBENCH_ACTIONS = new Set([
  'request_more_information',
  'forward_to_teacher',
  'forward_to_legal_review',
  'forward_to_manual_review',
  'forward_to_technical_team',
]);

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
      const response = await requestApi<PublicSystemSettingsContract>(apiClient.get<ApiResponse<PublicSystemSettingsContract>>(ENDPOINTS.settings.get, {
        params: {
          _: Date.now(),
        },
      }));
      return adaptPublicSystemSettings(readApiData<PublicSystemSettingsContract | Partial<SystemSettings>>(response, {}));
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

  async getLaunchModeStatus(): Promise<AdminLaunchModeStatus> {
    const response = await requestApi<AdminLaunchModeStatus>(apiClient.get<ApiResponse<AdminLaunchModeStatus>>(ENDPOINTS.settings.launchMode));
    return readApiData(response, {
      runtimeEnvironment: 'unknown',
      actualLaunchMode: 'PRELAUNCH',
      publicIndexingState: 'NOINDEX',
      technicalReadiness: 'NOT_READY',
      releaseRecommendation: 'NO_GO_RECOMMENDED',
    });
  },

  async updateLaunchMode(mode: AdminLaunchMode, confirmation: string, reason = ''): Promise<AdminLaunchModeStatus> {
    const response = await requestApi<AdminLaunchModeStatus>(apiClient.post<ApiResponse<AdminLaunchModeStatus>>(
      ENDPOINTS.settings.launchMode,
      { mode, confirmation, reason },
    ));
    return readApiData(assertApiSuccess<AdminLaunchModeStatus>(response, 'Não foi possível atualizar o launch mode.'), {} as AdminLaunchModeStatus);
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
   * Envia uma imagem de identidade visual pelo endpoint administrativo dedicado.
   * @since v1.0.0
   */
  async uploadBrandAsset(file: File, purpose: 'email-logo' | 'og-image' | 'taxonomy-logo' | 'blog-cover' | 'blog-content'): Promise<AdminBrandAsset> {
    const formData = new FormData();
    formData.append('purpose', purpose);
    formData.append('asset', file);

    const response = await requestApi<AdminBrandAsset>(apiClient.post<ApiResponse<AdminBrandAsset>>(
      ENDPOINTS.settings.uploadBrandAsset,
      formData,
    ));
    const envelope = assertApiSuccess<AdminBrandAsset>(response, 'Nao foi possivel enviar a imagem.');
    const asset = readApiData<AdminBrandAsset>(envelope.raw, {
      url: '',
      mimeType: '',
      size: 0,
      width: 0,
      height: 0,
    });

    if (!asset.url) {
      throw new Error('O backend nao retornou a URL da imagem.');
    }

    return asset;
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
        const response = await requestApi<ErrorReport[] | { items?: ErrorReport[] }>(
          apiClient.get<ApiResponse<ErrorReport[] | { items?: ErrorReport[] }>>(ENDPOINTS.reports.list),
        );
        const payload = readApiData<ErrorReport[] | { items?: ErrorReport[] }>(response, []);
        return Array.isArray(payload) ? payload : payload.items || [];
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
    const response = await requestApi<unknown>(adminPost(ENDPOINTS.admin.reportActions, {
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
    const response = await requestApi<unknown>(adminPost(ENDPOINTS.admin.reportWorkbench, {
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
    const response = await requestApi<AdminReportWorkbenchSuggestion>(adminPost<AdminReportWorkbenchSuggestion>(
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
    const response = await requestApi<AdminReportWorkbenchApplyResult>(adminPost<AdminReportWorkbenchApplyResult>(
      ENDPOINTS.admin.reportWorkbench,
      {
        operation: 'apply',
        ...payload,
      },
    ));
    const envelope = assertApiSuccess(response, 'Não foi possível concluir a moderação.');
    return readApiData(envelope.raw, {
      actionSlug: payload.action_slug,
      status: NON_FINAL_REPORT_WORKBENCH_ACTIONS.has(payload.action_slug)
        ? 'pending'
        : payload.action_slug === 'keep_current_content' || payload.action_slug.startsWith('reject_')
          ? 'ignored'
          : 'resolved',
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
    const response = await requestApi<unknown>(apiClient.post<ApiResponse>(`${ENDPOINTS.cache.manage}?action=clear`, {}));
    clearRequestCoalescing();
    return assertApiSuccess(response, 'Não foi possível limpar o cache.').message || 'Cache limpo com sucesso.';
  },

  /**
   * Remove apenas entradas expiradas do cache pela tela de operação.
   * @since v1.0.0
   */
  async cleanExpiredCache(): Promise<string> {
    const response = await requestApi<unknown>(apiClient.post<ApiResponse>(`${ENDPOINTS.cache.manage}?action=clean`, {}));
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

  async getReferralPayoutOverview(): Promise<AdminReferralPayoutOverview> {
    const response = await requestApi<AdminReferralPayoutOverview>(
      apiClient.get<ApiResponse<AdminReferralPayoutOverview>>(ENDPOINTS.admin.referralPayouts),
    );
    return readApiData(response, {
      settings: { commissionPercent: 0, refundGraceDays: 0, cycleDays: 30, payoutDay: 10, nextPayoutDate: '' },
      summary: { pending: 0, availableToSchedule: 0 },
      transfers: [],
      cycles: [],
      payoutItems: [],
    });
  },

  async createReferralPayoutCycle(force = false): Promise<AdminReferralPayoutCycleResult> {
    const response = await requestApi<AdminReferralPayoutCycleResult>(apiClient.post<ApiResponse<AdminReferralPayoutCycleResult>>(ENDPOINTS.admin.referralPayouts, {
      action: 'create_cycle',
      force,
    }));
    assertApiSuccess(response, 'Não foi possível gerar o ciclo de repasses.');
    return readApiData(response, { created: false });
  },

  async markReferralPayoutPaid(itemId: number, providerReference: string): Promise<void> {
    const response = await requestApi<unknown>(apiClient.post<ApiResponse>(ENDPOINTS.admin.referralPayouts, {
      action: 'mark_paid',
      itemId,
      providerReference,
    }));
    assertApiSuccess(response, 'Não foi possível confirmar o repasse.');
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
    const response = await requestApi<AdminCommentModerationItem>(adminPost<AdminCommentModerationItem>(ENDPOINTS.admin.commentsModeration, { id, status }));
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
    const response = await requestApi<{ updated: number }>(adminPost<{ updated: number }>(ENDPOINTS.admin.commentsModerationBulk, { ids, status }));
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
    const requestParams = {
      page: String(params.page || 1),
      keyword: params.keyword || '',
    };

    return withRequestCoalescing(
      buildRequestCacheKey('admin:questions', requestParams),
      async () => {
        const response = await requestApi<AdminQuestionListPayload>(apiClient.get<ApiResponse<AdminQuestionListPayload>>(
          ENDPOINTS.questions.filter,
          { params: requestParams },
        ));
        const payload = readApiData(response, {
          rows: [],
          total: 0,
          perPage: 20,
          pages: 1,
          page: params.page || 1,
        });

        return normalizeAdminQuestionListPayload(payload, params.page || 1);
      },
      0,
    );
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
      provaId: payload.provaId,
      texto: payload.texto,
      assets: payload.assets,
      question_count: 0,
      questionIds: payload.questionIds,
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
    const csrfToken = getCsrfToken();
    const response = await requestApi<AdminLooseRecord>(csrfToken
      ? apiClient.post<ApiResponse>(ENDPOINTS.admin.userActions, payload, { headers: { 'X-CSRF-Token': csrfToken } })
      : apiClient.post<ApiResponse>(ENDPOINTS.admin.userActions, payload));
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
    const csrfToken = getCsrfToken();
    const response = await requestApi<unknown>(csrfToken
      ? apiClient.post<ApiResponse>(ENDPOINTS.admin.userActions, payload, { headers: { 'X-CSRF-Token': csrfToken } })
      : apiClient.post<ApiResponse>(ENDPOINTS.admin.userActions, payload));
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
    const response = await requestApi<unknown>(adminPut(ENDPOINTS.admin.feedback, { id, status }));
    assertApiSuccess(response, 'Não foi possível atualizar o feedback.');
  },

  async updateFeedbackHomePublication(id: number, published: boolean): Promise<void> {
    const response = await requestApi<unknown>(adminPut(ENDPOINTS.admin.feedback, {
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
    const response = await requestApi<unknown>(adminPost(ENDPOINTS.admin.feedback, {
      parent_id: parentId,
      details,
    }));

    assertApiSuccess(response, 'Não foi possível enviar a resposta.');
  },
};

export default adminService;
