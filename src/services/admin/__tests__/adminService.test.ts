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

import { beforeEach, describe, expect, it, vi } from 'vitest';

type MockApiResponse = {
  data?: unknown;
  success?: boolean;
  message?: string;
  error?: string;
} | null | undefined;

const { mockClearRequestCoalescing, mockDownloadAuthenticatedFile, mockGet, mockPost, mockPut } = vi.hoisted(() => ({
  mockClearRequestCoalescing: vi.fn(),
  mockDownloadAuthenticatedFile: vi.fn(),
  mockGet: vi.fn(),
  mockPost: vi.fn(),
  mockPut: vi.fn(),
}));

vi.mock('@services/api', () => ({
  apiClient: {
    get: mockGet,
    post: mockPost,
    put: mockPut,
  },
  downloadAuthenticatedFile: mockDownloadAuthenticatedFile,
  readApiData: (response: MockApiResponse, fallback: unknown) => {
    if (response?.data !== undefined) return response.data;
    return response ?? fallback;
  },
  assertApiSuccess: (response: MockApiResponse, fallbackMessage: string) => {
    if (!response?.success) {
      throw new Error(response?.message || response?.error || fallbackMessage);
    }

    return {
      success: true,
      message: response?.message,
      data: response?.data,
      raw: response,
    };
  },
  ENDPOINTS: {
    questions: { filter: 'questionsFilter' },
    users: { list: 'usersList' },
    reports: { list: 'reportsList' },
    auth: {
      setupTwoFactor: 'auth/setup_2fa.php',
      enableTwoFactor: 'auth/enable_2fa.php',
    },
    admin: {
      listTables: 'admin/list_tables.php',
      resetDatabase: 'admin/reset_db.php',
      userDetails: 'admin/user_details.php',
      userActions: 'admin/user_actions.php',
      feedback: 'admin/feedback.php',
      stats: 'admin/stats.php',
      commentsModeration: 'admin/comments_moderation.php',
      commentsModerationBulk: 'admin/comments_moderation_bulk.php',
      logs: 'admin/logs.php',
    },
    cache: { manage: 'admin/cache.php' },
    settings: {
      get: 'settings.php',
      update: 'admin/settings.php',
      uploadBrandAsset: 'admin/brand_asset_upload.php',
    },
    rankings: { update: 'rankingsUpdate', delete: 'rankingsDelete' },
    system: { logs: 'system/logs.php' },
  },
}));

vi.mock('@services/questions/questionPublication', () => ({
  withQuestionPublicationAliases: (question: unknown) => question,
}));

vi.mock('@services/api/requestCoalescer', () => ({
  buildRequestCacheKey: (prefix: string, payload?: unknown) => (
    payload === undefined ? prefix : `${prefix}:${JSON.stringify(payload)}`
  ),
  clearRequestCoalescing: mockClearRequestCoalescing,
  withRequestCoalescing: <T,>(_key: string, loader: () => Promise<T>) => loader(),
}));

import { adminService } from '../adminService';

describe('adminService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('unwraps feedback threads from the admin feedback endpoint', async () => {
    mockGet.mockResolvedValueOnce({
      success: true,
      data: {
        items: [
          {
            id: 10,
            user_id: 'user-1',
            user_name: 'Teste',
            user_email: 'teste@example.com',
            type: 'support',
            reason: 'Ajuda',
            details: 'Preciso de suporte',
            created_at: '2026-03-31 10:00:00',
            status: 'new',
            reply_count: 2,
          },
        ],
      },
    });

    const threads = await adminService.getFeedbackThreads();

    expect(mockGet).toHaveBeenCalledWith('admin/feedback.php');
    expect(threads).toHaveLength(1);
    expect(threads[0].id).toBe(10);
    expect(threads[0].reply_count).toBe(2);
  });

  it('unwraps public system settings from the public settings endpoint', async () => {
    mockGet.mockResolvedValueOnce({
      success: true,
      data: {
        contractVersion: 'public-settings.v1',
        commerce: {
          paymentProvider: 'stripe',
        },
        authentication: {
          recaptcha: {
            enabled: true,
            siteKey: 'public-site-key',
          },
        },
      },
    });

    const settings = await adminService.getPublicSystemSettings();

    expect(mockGet).toHaveBeenCalledWith('settings.php', {
      params: {
        _: expect.any(Number),
      },
    });
    expect(settings.paymentProvider).toBe('stripe');
    expect(settings.recaptchaEnabled).toBe(true);
    expect(settings.recaptchaSiteKey).toBe('public-site-key');
  });

  it('loads admin system settings through the protected admin endpoint', async () => {
    mockGet.mockResolvedValueOnce({
      success: true,
      data: {
        hasStripeSecretConfigured: true,
        hasGeminiApiKeyConfigured: true,
      },
    });

    const settings = await adminService.getSystemSettings();

    expect(mockGet).toHaveBeenCalledWith('admin/settings.php', {
      params: {
        _: expect.any(Number),
      },
    });
    expect(settings.hasStripeSecretConfigured).toBe(true);
    expect(settings.hasGeminiApiKeyConfigured).toBe(true);
  });

  it('saves system settings through the official admin settings endpoint', async () => {
    mockPost.mockResolvedValueOnce({
      data: {
        paymentProvider: 'stripe',
        activeTheme: 'default',
      },
      success: true,
      message: 'Configurações salvas com sucesso!',
    });

    await expect(adminService.saveSystemSettings({
      paymentProvider: 'stripe',
      activeTheme: 'default',
    })).resolves.toEqual({
      paymentProvider: 'stripe',
      activeTheme: 'default',
    });

    expect(mockPost).toHaveBeenCalledWith('admin/settings.php', {
      paymentProvider: 'stripe',
      activeTheme: 'default',
    });
  });

  it('loads users through the official users endpoint', async () => {
    mockGet.mockResolvedValueOnce([
      {
        id: 'user-1',
        name: 'Teste',
      },
    ]);

    const users = await adminService.getUsers();

    expect(mockGet).toHaveBeenCalledWith('usersList');
    expect(users).toHaveLength(1);
    expect(users[0].id).toBe('user-1');
  });

  it('loads admin questions through the official filtered questions endpoint', async () => {
    mockGet.mockResolvedValueOnce({
      success: true,
      data: {
        rows: [{ id: 'q-1', statement: 'Questão teste' }],
        total: 12,
        perPage: 20,
        pages: 1,
        page: 1,
      },
    });

    const payload = await adminService.getQuestions({
      page: 1,
      keyword: 'teste',
    });

    expect(mockGet).toHaveBeenCalledWith('questionsFilter', {
      params: {
        page: '1',
        keyword: 'teste',
      },
    });
    expect(payload.rows).toHaveLength(1);
    expect(payload.total).toBe(12);
  });

  it('normalizes the lightweight canonical admin question list contract', async () => {
    mockGet.mockResolvedValueOnce({
      success: true,
      data: {
        rows: [{
          id: 53,
          content: {
            statement: '<p>Enunciado completo</p>',
            statementClean: 'Enunciado completo',
          },
          filters: {
            subjects: [{ id: 10, nome: 'Psicologia' }],
            topics: [{ id: 11, nome: 'Atenção' }],
            subtopics: [],
            examBoards: [{ id: 12, nome: 'FGV' }],
            organizations: [],
            roles: [],
            careers: [],
            years: [2026],
          },
          exams: [{ id: 29, nome: 'Prova de Psicologia', ano: 2026 }],
          publication: {
            status: 'published',
            visibility: 'public',
            publishedAt: '2026-08-01 15:00:00',
          },
          editorial: {
            hasTeacherComment: true,
            hasDetailedAnalysis: true,
          },
          type: 'true_false',
          difficulty: 'hard',
          flags: {
            annulled: true,
            outdated: false,
          },
        }],
        total: 1,
        perPage: 20,
        pages: 1,
        page: 1,
      },
    });

    const payload = await adminService.getQuestions({ page: 1 });
    const question = payload.rows[0];

    expect(question.enunciado_clean).toBe('Enunciado completo');
    expect(question.provas?.[0]?.nome).toBe('Prova de Psicologia');
    expect(question.bancas?.[0]?.nome).toBe('FGV');
    expect(question.assuntos).toHaveLength(2);
    expect(question.hasTeacherComment).toBe(true);
    expect(question.hasDetailedComment).toBe(true);
    expect(question.publishStatus).toBe('published');
    expect(question.tipo).toBe('certo_errado');
    expect(question.dificuldade).toBe(3);
    expect(question.anulada).toBe(true);
  });

  it('loads reports through the official reports endpoint', async () => {
    mockGet.mockResolvedValueOnce({
      success: true,
      data: [
        {
          id: 'rep-1',
          reason: 'Erro',
        },
      ],
    });

    const reports = await adminService.getReports();

    expect(mockGet).toHaveBeenCalledWith('reportsList');
    expect(reports).toHaveLength(1);
    expect(reports[0].id).toBe('rep-1');
  });

  it('unwraps feedback replies from the admin feedback thread endpoint', async () => {
    mockGet.mockResolvedValueOnce({
      success: true,
      data: {
        replies: [
          {
            id: 11,
            parent_id: 10,
            user_id: 'admin-1',
            user_name: 'Admin',
            user_email: 'admin@example.com',
            type: 'support',
            reason: 'Resposta do suporte',
            details: 'Vamos resolver isso.',
            created_at: '2026-03-31 10:05:00',
            status: 'read',
          },
        ],
      },
    });

    const replies = await adminService.getFeedbackReplies(10);

    expect(mockGet).toHaveBeenCalledWith('admin/feedback.php?id=10');
    expect(replies).toHaveLength(1);
    expect(replies[0].parent_id).toBe(10);
  });

  it('throws when feedback status update fails', async () => {
    mockPut.mockResolvedValueOnce({
      success: false,
      message: 'Falha ao atualizar',
    });

    await expect(adminService.updateFeedbackStatus(1, 'resolved')).rejects.toThrow('Falha ao atualizar');
  });

  it('returns normalized cache stats payload', async () => {
    mockGet.mockResolvedValueOnce({
      success: true,
      data: {
        total_files: 12,
        valid_entries: 10,
        expired_entries: 2,
        total_size_mb: 4.5,
        enabled: true,
      },
    });

    const stats = await adminService.getCacheStats();

    expect(stats).toEqual({
      total_files: 12,
      valid_entries: 10,
      expired_entries: 2,
      total_size_mb: 4.5,
      enabled: true,
    });
  });

  it('uploads brand images through the protected admin endpoint', async () => {
    mockPost.mockResolvedValueOnce({
      success: true,
      data: {
        url: '/uploads/admin-assets/email-logo/logo.png',
        mimeType: 'image/png',
        size: 128,
        width: 300,
        height: 80,
      },
    });

    const file = new File(['png'], 'logo.png', { type: 'image/png' });
    const asset = await adminService.uploadBrandAsset(file, 'email-logo');

    expect(mockPost).toHaveBeenCalledWith(
      'admin/brand_asset_upload.php',
      expect.any(FormData),
    );
    const formData = mockPost.mock.calls[0]?.[1] as FormData;
    expect(formData.get('purpose')).toBe('email-logo');
    expect(formData.get('asset')).toBe(file);
    expect(asset.url).toBe('/uploads/admin-assets/email-logo/logo.png');
  });

  it('clears frontend request coalescing after cache mutations', async () => {
    mockPost.mockResolvedValueOnce({
      success: true,
      message: 'Configuracoes do cache atualizadas.',
    });
    mockPost.mockResolvedValueOnce({
      success: true,
      message: 'Cache limpo.',
    });

    await expect(adminService.saveCacheSettings({ enabled: true, default_ttl: 120 })).resolves.toBe('Configuracoes do cache atualizadas.');
    await expect(adminService.clearCache()).resolves.toBe('Cache limpo.');

    expect(mockPost).toHaveBeenCalledWith('admin/cache.php?action=settings', { enabled: true, default_ttl: 120 });
    expect(mockPost).toHaveBeenCalledWith('admin/cache.php?action=clear', {});
    expect(mockClearRequestCoalescing).toHaveBeenCalledTimes(2);
  });

  it('returns normalized system logs payload', async () => {
    mockGet.mockResolvedValueOnce({
      success: true,
      data: {
        lines: ['linha 1', 'linha 2'],
        path: 'C:\\xampp\\apache\\logs\\error.log',
      },
    });

    const logs = await adminService.getSystemLogs();

    expect(mockGet).toHaveBeenCalledWith('system/logs.php');
    expect(logs).toEqual(['linha 1', 'linha 2']);
  });

  it('loads the complete system log payload for the viewer', async () => {
    mockGet.mockResolvedValueOnce({
      success: true,
      data: {
        lines: ['linha 1'],
        path: 'C:\\xampp\\apache\\logs\\error.log',
        size_bytes: 120,
        updated_at: '2026-04-27T10:00:00+00:00',
      },
    });

    const payload = await adminService.getSystemLogPayload();

    expect(mockGet).toHaveBeenCalledWith('system/logs.php');
    expect(payload.size_bytes).toBe(120);
    expect(payload.lines).toEqual(['linha 1']);
  });

  it('clears system logs through the official admin endpoint', async () => {
    mockPost.mockResolvedValueOnce({
      success: true,
      data: {
        lines: [],
        cleared: true,
      },
    });

    const payload = await adminService.clearSystemLogs();

    expect(mockPost).toHaveBeenCalledWith('system/logs.php?action=clear', {});
    expect(payload.cleared).toBe(true);
  });

  it('downloads system logs through an authenticated file request', async () => {
    mockDownloadAuthenticatedFile.mockResolvedValueOnce(undefined);

    await adminService.downloadSystemLogs();

    expect(mockDownloadAuthenticatedFile).toHaveBeenCalledWith('system/logs.php?action=download', 'concurso-mestre-logs.log');
  });

  it('loads user details through the official admin endpoint', async () => {
    mockGet.mockResolvedValueOnce({
      success: true,
      data: {
        profile: { id: 'user-1', name: 'Usuário Teste' },
        subscriptions: [{ id: 'sub-1' }],
        transactions: [{ id: 'txn-1' }],
        materials: [{ id: 'mat-1' }],
        stats: { comments_count: 3 },
        last_comments: [{ id: 1, comment: 'Ótima questão' }],
      },
    });

    const payload = await adminService.getUserDetails('user-1');

    expect(mockGet).toHaveBeenCalledWith('admin/user_details.php?id=user-1');
    expect(payload.profile.id).toBe('user-1');
    expect(payload.stats.comments_count).toBe(3);
    expect(payload.transactions).toHaveLength(1);
  });

  it('executes administrative user actions through the official endpoint', async () => {
    mockPost.mockResolvedValueOnce({
      success: true,
      message: 'Perfil atualizado com sucesso.',
    });

    await expect(adminService.performUserAction({
      user_id: 'user-1',
      action: 'update_profile',
      name: 'Usuário Teste',
      email: 'teste@example.com',
      role: 'partner',
    })).resolves.toBeUndefined();

    expect(mockPost).toHaveBeenCalledWith('admin/user_actions.php', {
      user_id: 'user-1',
      action: 'update_profile',
      name: 'Usuário Teste',
      email: 'teste@example.com',
      role: 'partner',
    });
  });

  it('returns backend confirmation when the admin flow needs the persisted message', async () => {
    mockPost.mockResolvedValueOnce({
      success: true,
      message: 'Perfil atualizado com sucesso.',
      data: {
        audit_action: 'user.update_profile',
      },
    });

    const result = await adminService.performUserActionWithResult({
      user_id: 'user-1',
      action: 'update_profile',
      name: 'Usuario Teste',
      email: 'teste@example.com',
      role: 'staff',
    });

    expect(result.message).toBe('Perfil atualizado com sucesso.');
    expect(result.data?.audit_action).toBe('user.update_profile');
  });

  it('lists resettable database tables through the official endpoint', async () => {
    mockGet.mockResolvedValueOnce({
      success: true,
      data: {
        tables: ['users', 'transactions', 'materials'],
      },
    });

    const tables = await adminService.listResettableTables();

    expect(mockGet).toHaveBeenCalledWith('admin/list_tables.php');
    expect(tables).toEqual(['users', 'transactions', 'materials']);
  });

  it('loads the 2FA setup payload through the official auth endpoint', async () => {
    mockGet.mockResolvedValueOnce({
      success: true,
      data: {
        secret: 'ABC123',
        qrCodeUrl: 'otpauth://totp/teste',
      },
    });

    const payload = await adminService.setupTwoFactor();

    expect(mockGet).toHaveBeenCalledWith('auth/setup_2fa.php');
    expect(payload.secret).toBe('ABC123');
    expect(payload.qrCodeUrl).toBe('otpauth://totp/teste');
  });

  it('enables 2FA through the official auth endpoint', async () => {
    mockPost.mockResolvedValueOnce({
      success: true,
      message: '2FA ativado com sucesso!',
    });

    const message = await adminService.enableTwoFactor('ABC123', '123456');

    expect(mockPost).toHaveBeenCalledWith('auth/enable_2fa.php', {
      secret: 'ABC123',
      code: '123456',
    });
    expect(message).toBe('2FA ativado com sucesso!');
  });

  it('resets the database through the official endpoint', async () => {
    mockPost.mockResolvedValueOnce({
      success: true,
      message: 'Reset concluido.',
    });

    await expect(adminService.resetDatabase({
      password: 'segredo',
      twoFactorCode: '123456',
      tables: ['transactions'],
    })).resolves.toBeUndefined();

    expect(mockPost).toHaveBeenCalledWith('admin/reset_db.php', {
      password: 'segredo',
      twoFactorCode: '123456',
      tables: ['transactions'],
    });
  });

  it('loads admin stats using the official query parameters', async () => {
    mockGet.mockResolvedValueOnce({
      success: true,
      data: {
        total_revenue: 120,
        available_total_revenue: 110,
        platform_revenue: 40,
        subscription_revenue: 80,
        available_subscription_revenue: 50,
        marketplace_revenue: 40,
        active_subscriptions: 3,
        cancelled_subscriptions: 1,
        expired_subscriptions: 2,
        trial_subscriptions: 1,
        mrr: 33,
        new_users: 8,
        seller_payout: 20,
        available_seller_payout: 12,
        transactions_count: 6,
        refund_requests_count: 1,
        refund_requested_amount: 9,
        total_refunded: 4,
        held_balance: 10,
        total_paid: 116,
        feedback_count: 2,
        questions_count: 100,
        users_count: 50,
        materials_count: 12,
        rankings_count: 4,
        available_platform_revenue: 15,
      },
    });

    const stats = await adminService.getStats({
      period: 'custom',
      startDate: '2026-04-01',
      endDate: '2026-04-30',
    });

    expect(mockGet).toHaveBeenCalledWith('admin/stats.php?period=custom&startDate=2026-04-01&endDate=2026-04-30');
    expect(stats.total_revenue).toBe(120);
    expect(stats.available_total_revenue).toBe(110);
    expect(stats.feedback_count).toBe(2);
    expect(stats.refund_requests_count).toBe(1);
    expect(stats.refund_requested_amount).toBe(9);
  });

  it('replies to feedback through the official admin endpoint', async () => {
    mockPost.mockResolvedValueOnce({
      success: true,
      message: 'Resposta enviada com sucesso.',
    });

    await expect(adminService.replyToFeedback(10, 'Vamos seguir com a análise.')).resolves.toBeUndefined();

    expect(mockPost).toHaveBeenCalledWith('admin/feedback.php', {
      parent_id: 10,
      details: 'Vamos seguir com a análise.',
    });
  });

  it('loads the WordPress-like comments moderation list with normalized counts', async () => {
    mockGet.mockResolvedValueOnce({
      success: true,
      data: {
        items: [
          {
            id: 'comment:1',
            origin: 'question',
            sourceType: 'comment',
            sourceId: '1',
            status: 'pending',
          },
        ],
        total: 1,
        page: 1,
        perPage: 20,
        pages: 1,
        counts: {
          pending: 1,
          approved: 2,
          spam: 0,
        },
      },
    });

    const payload = await adminService.getModerationComments({
      status: 'all',
      origin: 'all',
      search: 'teste',
      page: 1,
      perPage: 20,
    });

    expect(mockGet).toHaveBeenCalledWith('admin/comments_moderation.php', {
      params: {
        status: 'all',
        origin: 'all',
        search: 'teste',
        page: 1,
        perPage: 20,
      },
    });
    expect(payload.items).toHaveLength(1);
    expect(payload.counts.all).toBe(3);
    expect(payload.counts.trash).toBe(0);
  });

  it('updates a moderated comment status through the official admin endpoint', async () => {
    mockPost.mockResolvedValueOnce({
      success: true,
      data: {
        id: 'comment:1',
        status: 'trash',
      },
    });

    const result = await adminService.updateModerationComment('comment:1', 'trash');

    expect(mockPost).toHaveBeenCalledWith('admin/comments_moderation.php', {
      id: 'comment:1',
      status: 'trash',
    });
    expect(result.status).toBe('trash');
  });

  it('bulk updates moderated comments through the official admin endpoint', async () => {
    mockPost.mockResolvedValueOnce({
      success: true,
      data: {
        updated: 2,
      },
    });

    const result = await adminService.bulkUpdateModerationComments(['comment:1', 'law:2'], 'approved');

    expect(mockPost).toHaveBeenCalledWith('admin/comments_moderation_bulk.php', {
      ids: ['comment:1', 'law:2'],
      status: 'approved',
    });
    expect(result.updated).toBe(2);
  });
});
