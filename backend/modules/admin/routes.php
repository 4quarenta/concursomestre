<?php

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

require_once __DIR__ . '/controllers/AdminSystemLogController.php';
require_once __DIR__ . '/controllers/AdminFeedbackController.php';
require_once __DIR__ . '/controllers/AdminReportModerationController.php';
require_once __DIR__ . '/controllers/AdminReportWorkbenchController.php';
require_once __DIR__ . '/controllers/AdminStatsController.php';
require_once __DIR__ . '/controllers/AdminUserDetailsController.php';
require_once __DIR__ . '/controllers/AdminUserActionsController.php';
require_once __DIR__ . '/controllers/AdminDatabaseMaintenanceController.php';
require_once __DIR__ . '/controllers/AdminCacheController.php';
require_once __DIR__ . '/controllers/AdminSettingsController.php';
require_once __DIR__ . '/controllers/AdminAnalyticsController.php';
require_once __DIR__ . '/controllers/AdminCommentsModerationController.php';
require_once __DIR__ . '/controllers/AdminSecurityIpsController.php';
require_once __DIR__ . '/controllers/AdminPlanCatalogController.php';
require_once __DIR__ . '/services/AdminSystemLogService.php';
require_once __DIR__ . '/services/AdminSystemLogPathResolver.php';
require_once __DIR__ . '/services/AdminFeedbackService.php';
require_once __DIR__ . '/services/AdminUserCommunicationService.php';
require_once __DIR__ . '/services/AdminReportModerationService.php';
require_once __DIR__ . '/services/AdminReportWorkbenchService.php';
require_once __DIR__ . '/services/AdminStatsService.php';
require_once __DIR__ . '/services/AdminUserDetailsService.php';
require_once __DIR__ . '/services/AdminUserActionsService.php';
require_once __DIR__ . '/services/AdminDatabaseMaintenanceService.php';
require_once __DIR__ . '/services/AdminCacheService.php';
require_once __DIR__ . '/services/AdminSettingsService.php';
require_once __DIR__ . '/services/AdminBrandAssetsService.php';
require_once __DIR__ . '/services/AdminAnalyticsService.php';
require_once __DIR__ . '/services/AdminCommentsModerationService.php';
require_once __DIR__ . '/services/AdminSecurityIpsService.php';
require_once __DIR__ . '/services/AdminPlanCatalogService.php';
require_once __DIR__ . '/repositories/AdminSystemLogRepository.php';
require_once __DIR__ . '/repositories/AdminFeedbackRepository.php';
require_once __DIR__ . '/repositories/AdminReportModerationRepository.php';
require_once __DIR__ . '/repositories/AdminReportWorkbenchRepository.php';
require_once __DIR__ . '/repositories/AdminStatsRepository.php';
require_once __DIR__ . '/repositories/AdminUserDetailsRepository.php';
require_once __DIR__ . '/repositories/AdminUserActionsRepository.php';
require_once __DIR__ . '/repositories/AdminDatabaseMaintenanceRepository.php';
require_once __DIR__ . '/repositories/AdminCacheRepository.php';
require_once __DIR__ . '/repositories/AdminSettingsRepository.php';
require_once __DIR__ . '/repositories/AdminAnalyticsRepository.php';
require_once __DIR__ . '/repositories/AdminCommentsModerationRepository.php';
require_once __DIR__ . '/repositories/AdminSecurityIpsRepository.php';
require_once __DIR__ . '/repositories/AdminPlanCatalogRepository.php';
require_once __DIR__ . '/validators/AdminSystemLogValidator.php';
require_once __DIR__ . '/validators/AdminFeedbackValidator.php';
require_once __DIR__ . '/validators/AdminReportModerationValidator.php';
require_once __DIR__ . '/validators/AdminStatsValidator.php';
require_once __DIR__ . '/validators/AdminUserDetailsValidator.php';
require_once __DIR__ . '/validators/AdminUserActionsValidator.php';
require_once __DIR__ . '/validators/AdminDatabaseMaintenanceValidator.php';
require_once __DIR__ . '/validators/AdminCacheValidator.php';
require_once __DIR__ . '/validators/AdminSettingsValidator.php';
require_once __DIR__ . '/validators/AdminAnalyticsValidator.php';
require_once __DIR__ . '/validators/AdminCommentsModerationValidator.php';
require_once __DIR__ . '/validators/AdminSecurityIpsValidator.php';
require_once __DIR__ . '/validators/AdminPlanCatalogValidator.php';
require_once __DIR__ . '/../../shared/security/AdminSecurity.php';
require_once __DIR__ . '/../../shared/responses/Response.php';
require_once __DIR__ . '/../../config/payment_provider.php';
require_once __DIR__ . '/../finance/services/ReferralFinance.php';

/**
 * Ponto de entrada do modulo administrativo para logs do sistema.
 * O endpoint legado apenas delega para esta funcao, mantendo compatibilidade
 * enquanto a estrutura modular passa a concentrar a regra do dominio.
 *
 * @since 1.0.0
 */
function handleAdminSystemLogsRoute(PDO $db, ?string $logFilePath = null): void
{
    try {
        $logFilePath = trim((string) $logFilePath) !== ''
            ? (string) $logFilePath
            : (new AdminSystemLogPathResolver())->resolve();
        $method = strtoupper((string) ($_SERVER['REQUEST_METHOD'] ?? 'GET'));
        $action = trim((string) ($_GET['action'] ?? 'list'));
        $adminContext = requirePlatformAdminSessionContext($db);

        $controller = new AdminSystemLogController(
            new AdminSystemLogService(
                new AdminSystemLogRepository($logFilePath),
                new AdminSystemLogValidator()
            )
        );

        if ($action === 'download') {
            if ($method !== 'GET') {
                Response::error('Metodo nao permitido.', 405);
            }

            $payload = $controller->downloadLogs();

            logAdminAudit(
                $adminContext['db'],
                $adminContext['admin_user_id'],
                'download_system_logs',
                'system_logs',
                null,
                [
                    'path' => $payload['path'],
                    'size_bytes' => $payload['size_bytes'],
                ]
            );

            header('Content-Type: text/plain; charset=UTF-8');
            header('Content-Disposition: attachment; filename="concurso-mestre-logs-' . gmdate('Ymd-His') . '.log"');
            echo $payload['content'];
            exit;
        }

        if ($action === 'clear') {
            if (!in_array($method, ['POST', 'DELETE'], true)) {
                Response::error('Metodo nao permitido.', 405);
            }

            $payload = $controller->clearLogs();

            logAdminAudit(
                $adminContext['db'],
                $adminContext['admin_user_id'],
                'clear_system_logs',
                'system_logs',
                null,
                [
                    'path' => $payload['path'],
                ]
            );

            Response::success($payload, 'Logs limpos com sucesso.');
        }

        if (!in_array($action, ['list', 'info'], true)) {
            Response::badRequest('Acao invalida.');
        }

        if ($method !== 'GET') {
            Response::error('Metodo nao permitido.', 405);
        }

        $payload = $controller->showLatestLogs();

        logAdminAudit(
            $adminContext['db'],
            $adminContext['admin_user_id'],
            'view_system_logs',
            'system_logs',
            null,
            [
                'path' => $payload['path'],
                'line_count' => count($payload['lines']),
            ]
        );

        Response::success($payload);
    } catch (InvalidArgumentException $e) {
        Response::notFound($e->getMessage());
    } catch (RuntimeException $e) {
        Response::forbidden($e->getMessage());
    } catch (Throwable $e) {
        error_log('[admin_system_logs_route] ' . $e->getMessage());
        Response::serverError('Nao foi possivel carregar os logs do sistema.', $e);
    }
}

/**
 * Ponto de entrada do modulo administrativo para feedback e suporte.
 * Preserva o endpoint legado enquanto desloca consulta e atualizacao de
 * conversas para a estrutura modular do backend.
 *
 * @since 1.0.0
 */
function handleAdminFeedbackRoute(PDO $db): void
{
    try {
        $adminContext = requireAdminSessionContext($db);
        $adminUserId = (string) $adminContext['admin_user_id'];
        $method = $_SERVER['REQUEST_METHOD'] ?? 'GET';

        $controller = new AdminFeedbackController(
            new AdminFeedbackService(
                new AdminFeedbackRepository($db),
                new AdminFeedbackValidator(),
                new AdminUserCommunicationService()
            )
        );

        if ($method === 'GET') {
            $threadId = isset($_GET['id']) ? (int) $_GET['id'] : 0;

            if ($threadId > 0) {
                $payload = $controller->showThread($threadId);

                logAdminAudit($db, $adminUserId, 'feedback.view_thread', 'feedback', (string) $threadId, [
                    'reply_count' => count($payload['replies'] ?? []),
                ]);

                Response::success($payload);
            }

            $filters = [
                'status' => trim((string) ($_GET['status'] ?? '')),
                'type' => trim((string) ($_GET['type'] ?? '')),
                'search' => trim((string) ($_GET['search'] ?? '')),
            ];

            $payload = $controller->listThreads($filters);

            logAdminAudit($db, $adminUserId, 'feedback.list', 'feedback', null, [
                'status' => $filters['status'],
                'type' => $filters['type'],
                'search' => $filters['search'],
                'count' => count($payload['items'] ?? []),
            ]);

            Response::success($payload);
        }

        if ($method === 'PUT') {
            $data = json_decode(file_get_contents('php://input'), true) ?: [];
            $feedbackId = isset($data['id']) ? (int) $data['id'] : 0;
            $action = trim((string) ($data['action'] ?? ''));

            if ($action === 'publish_home' || $action === 'unpublish_home') {
                $controller->updateHomePublication($feedbackId, $action === 'publish_home');

                logAdminAudit($db, $adminUserId, 'feedback.update_home_publication', 'feedback', (string) $feedbackId, [
                    'published' => $action === 'publish_home',
                ]);

                Response::success([], $action === 'publish_home' ? 'Avaliação aprovada para a home.' : 'Avaliação removida da home.');
            }

            $status = trim((string) ($data['status'] ?? ''));

            $controller->updateStatus($feedbackId, $status);

            logAdminAudit($db, $adminUserId, 'feedback.update_status', 'feedback', (string) $feedbackId, [
                'status' => $status,
            ]);

            Response::success([], 'Status do feedback atualizado com sucesso.');
        }

        if ($method === 'POST') {
            $data = json_decode(file_get_contents('php://input'), true) ?: [];
            $parentId = isset($data['parent_id']) ? (int) $data['parent_id'] : 0;
            $details = trim((string) ($data['details'] ?? ''));

            $payload = $controller->replyToThread($adminUserId, $parentId, $details);

            logAdminAudit($db, $adminUserId, 'feedback.reply', 'feedback', (string) $parentId, [
                'reply_id' => $payload['id'] ?? null,
            ]);

            Response::success($payload, 'Resposta enviada com sucesso.');
        }

        Response::error('Metodo nao permitido.', 405);
    } catch (InvalidArgumentException $e) {
        $message = $e->getMessage();

        if (stripos($message, 'nao encontrada') !== false) {
            Response::notFound($message);
        }

        Response::validationError($message);
    } catch (Throwable $e) {
        error_log('[admin_feedback_route] ' . $e->getMessage());
        Response::serverError('Nao foi possivel processar os feedbacks administrativos.', $e);
    }
}

/**
 * Ponto de entrada do modulo administrativo para moderacao de denuncias.
 * Mantem compatibilidade com o endpoint legado e desloca a regra para o
 * modulo `modules/admin`.
 *
 * @since 1.0.0
 */
function handleAdminReportModerationRoute(PDO $db): void
{
    try {
        $adminContext = requireAdminSessionContext($db);
        $adminUserId = (string) $adminContext['admin_user_id'];
        $data = json_decode(file_get_contents('php://input'), true) ?: [];

        $reportId = trim((string) ($data['id'] ?? ''));
        $action = trim((string) ($data['action'] ?? ''));
        $adminReason = trim((string) ($data['admin_reason'] ?? ''));
        $userResponse = trim((string) ($data['user_response'] ?? $adminReason));
        $internalNote = trim((string) ($data['internal_note'] ?? ''));
        $moderationAction = trim((string) ($data['moderation_action'] ?? ''));
        $evidenceUrl = trim((string) ($data['evidence_url'] ?? ''));

        $controller = new AdminReportModerationController(
            new AdminReportModerationService(
                $db,
                new AdminReportModerationRepository($db),
                new AdminReportModerationValidator(),
                new AdminUserCommunicationService()
            )
        );

        $payload = $controller->moderate(
            $adminUserId,
            $reportId,
            $action,
            $adminReason,
            $userResponse,
            $internalNote,
            $moderationAction,
            $evidenceUrl
        );

        logAdminAudit($db, $adminUserId, 'report.moderate', 'report', $reportId, [
            'status' => $payload['status'],
            'admin_reason' => $payload['admin_reason'],
            'user_response' => $payload['user_response'] ?? null,
            'internal_note' => $payload['internal_note'] ?? null,
            'moderation_action' => $payload['moderation_action'] ?? null,
            'evidence_url' => $payload['evidence_url'],
        ]);

        Response::success([], 'Denuncia atualizada com sucesso.');
    } catch (InvalidArgumentException $e) {
        $message = $e->getMessage();

        if (stripos($message, 'justificativa') !== false) {
            Response::validationError($message);
        }

        Response::badRequest($message);
    } catch (OutOfBoundsException $e) {
        Response::notFound($e->getMessage());
    } catch (Throwable $e) {
        error_log('[admin_report_moderation_route] ' . $e->getMessage());
        Response::serverError('Nao foi possivel atualizar a denuncia.', $e);
    }
}

/**
 * Workbench contextual de moderacao.
 *
 * GET  ?id=...                       carrega alvo, configuracao, rascunho e historico
 * POST operation=save_draft         salva trabalho sem concluir
 * POST operation=generate_suggestion gera sugestao editorial por IA
 * POST operation=apply              aplica alteracao e decisao na mesma transacao
 */
function handleAdminReportWorkbenchRoute(PDO $db): void
{
    try {
        $adminContext = requireAdminSessionContext($db);
        $adminUserId = (string) $adminContext['admin_user_id'];
        $controller = new AdminReportWorkbenchController(
            new AdminReportWorkbenchService(
                new AdminReportWorkbenchRepository($db),
                new AdminUserCommunicationService()
            )
        );

        $method = strtoupper((string) ($_SERVER['REQUEST_METHOD'] ?? 'GET'));
        if ($method === 'GET') {
            $reportId = trim((string) ($_GET['id'] ?? ''));
            if ($reportId === '') {
                throw new InvalidArgumentException('Informe o atendimento que deseja moderar.');
            }

            Response::success($controller->review($adminUserId, $reportId), 'Contexto de moderação carregado.');
        }

        if ($method === 'POST') {
            $data = json_decode(file_get_contents('php://input'), true);
            if (!is_array($data)) {
                throw new InvalidArgumentException('Payload JSON inválido.');
            }

            $operation = trim((string) ($data['operation'] ?? ''));
            $payload = match ($operation) {
                'save_draft' => $controller->saveDraft($adminUserId, $data),
                'generate_suggestion' => $controller->generateSuggestion($adminUserId, $data),
                'apply' => $controller->apply($adminUserId, $data),
                default => throw new InvalidArgumentException('Operação de moderação inválida.'),
            };

            logAdminAudit(
                $db,
                $adminUserId,
                'report.workbench.' . $operation,
                'report',
                (string) ($data['report_id'] ?? ''),
                [
                    'report_ids' => $data['report_ids'] ?? null,
                    'action_slug' => $data['action_slug'] ?? null,
                ]
            );

            Response::success($payload, match ($operation) {
                'save_draft' => 'Rascunho salvo.',
                'generate_suggestion' => 'Sugestão gerada para revisão.',
                default => 'Moderação aplicada com sucesso.',
            });
        }

        Response::error('Método não permitido.', 405);
    } catch (InvalidArgumentException $e) {
        Response::validationError($e->getMessage());
    } catch (OutOfBoundsException $e) {
        Response::notFound($e->getMessage());
    } catch (DomainException $e) {
        Response::conflict($e->getMessage());
    } catch (RuntimeException $e) {
        if (str_contains($e->getMessage(), 'AI Engine Error')) {
            Response::serviceUnavailable($e->getMessage(), $e, 'ai_unavailable');
        }
        Response::serverError($e->getMessage(), $e);
    } catch (Throwable $e) {
        error_log('[admin_report_workbench_route] ' . $e->getMessage());
        Response::serverError('Não foi possível processar a moderação contextual.', $e);
    }
}

/**
 * Ponto de entrada do modulo administrativo para metricas do dashboard.
 * Mantem o endpoint legado estavel enquanto a regra vai para o modulo admin.
 *
 * @since 1.0.0
 */
function handleAdminStatsRoute(PDO $db): void
{
    try {
        requirePlatformAdminSessionContext($db);

        $controller = new AdminStatsController(
            new AdminStatsService(
                new AdminStatsRepository($db),
                new AdminStatsValidator()
            )
        );

        $payload = $controller->index(
            $_GET['period'] ?? 'today',
            $_GET['startDate'] ?? null,
            $_GET['endDate'] ?? null
        );

        Response::success($payload);
    } catch (InvalidArgumentException $e) {
        Response::validationError($e->getMessage());
    } catch (Throwable $e) {
        error_log('[admin_stats_route] ' . $e->getMessage());
        Response::serverError('Nao foi possivel carregar as metricas administrativas.', $e);
    }
}

/**
 * Ponto de entrada do modulo administrativo para detalhamento de usuario.
 * Mantem o endpoint legado funcional enquanto desloca a regra para modules/admin.
 *
 * @since 1.0.0
 */
function handleAdminUserDetailsRoute(PDO $db): void
{
    try {
        $context = requirePlatformAdminSessionContext($db);
        $adminUserId = (string) $context['admin_user_id'];
        $userId = trim((string) ($_GET['id'] ?? ''));

        $controller = new AdminUserDetailsController(
            new AdminUserDetailsService(
                new AdminUserDetailsRepository($db),
                new AdminUserDetailsValidator()
            )
        );

        $payload = $controller->show($userId);

        logAdminAudit($db, $adminUserId, 'user.view_details', 'user', $userId);

        Response::success($payload);
    } catch (InvalidArgumentException $e) {
        Response::badRequest($e->getMessage());
    } catch (OutOfBoundsException $e) {
        Response::notFound($e->getMessage());
    } catch (Throwable $e) {
        error_log('[admin_user_details_route] ' . $e->getMessage());
        Response::serverError('Failed to fetch user details', $e);
    }
}

/**
 * Ponto de entrada do modulo administrativo para mutacoes sobre usuario.
 * Mantem o endpoint legado funcional enquanto desloca a regra para modules/admin.
 *
 * @since 1.0.0
 */
function handleAdminUserActionsRoute(PDO $db): void
{
    try {
        ensurePaymentProviderSchema($db);

        $context = requirePlatformAdminSessionContext($db);
        $adminUserId = (string) $context['admin_user_id'];
        $data = json_decode(file_get_contents('php://input'), true) ?: [];
        $data['_admin_user_id'] = $adminUserId;

        $controller = new AdminUserActionsController(
            new AdminUserActionsService(
                $db,
                new AdminUserActionsRepository($db),
                new AdminUserActionsValidator()
            )
        );

        $payload = $controller->execute($data);

        logAdminAudit(
            $db,
            $adminUserId,
            (string) $payload['audit_action'],
            (string) $payload['audit_entity_type'],
            $payload['audit_entity_id'] ?? null,
            $payload['audit_metadata'] ?? []
        );

        Response::success($payload['data'] ?? [], (string) ($payload['message'] ?? 'Acao executada com sucesso.'));
    } catch (InvalidArgumentException $e) {
        Response::badRequest($e->getMessage());
    } catch (OutOfBoundsException $e) {
        Response::notFound($e->getMessage());
    } catch (Throwable $e) {
        if ($db->inTransaction()) {
            $db->rollBack();
        }

        error_log('[admin_user_actions_route] ' . $e->getMessage());
        Response::serverError('Nao foi possivel executar a acao administrativa.', $e);
    }
}

/**
 * Ponto de entrada do modulo administrativo para listagem das tabelas resetaveis.
 *
 * @since 1.0.0
 */
function handleAdminDatabaseTablesRoute(PDO $db): void
{
    try {
        $context = requirePlatformAdminSessionContext($db);
        $adminUserId = (string) $context['admin_user_id'];

        $controller = new AdminDatabaseMaintenanceController(
            new AdminDatabaseMaintenanceService(
                $db,
                new AdminDatabaseMaintenanceRepository($db),
                new AdminDatabaseMaintenanceValidator()
            )
        );

        $payload = $controller->listTables();

        logAdminAudit($db, $adminUserId, 'database.list_tables', 'database');
        Response::success($payload, 'Categorias listadas com sucesso');
    } catch (Throwable $e) {
        error_log('[admin_database_tables_route] ' . $e->getMessage());
        Response::serverError('Erro ao listar tabelas.', $e);
    }
}

/**
 * Ponto de entrada do modulo administrativo para reset controlado da base.
 *
 * @since 1.0.0
 */
function handleAdminDatabaseResetRoute(PDO $db): void
{
    try {
        $context = requirePlatformAdminSessionContext($db);
        $adminUserId = (string) $context['admin_user_id'];
        $data = json_decode(file_get_contents('php://input'), true) ?: [];

        $controller = new AdminDatabaseMaintenanceController(
            new AdminDatabaseMaintenanceService(
                $db,
                new AdminDatabaseMaintenanceRepository($db),
                new AdminDatabaseMaintenanceValidator()
            )
        );

        $payload = $controller->reset($adminUserId, $data);

        logAdminAudit(
            $db,
            $adminUserId,
            (string) $payload['audit_action'],
            (string) $payload['audit_entity_type'],
            $payload['audit_entity_id'] ?? null,
            $payload['audit_metadata'] ?? []
        );

        Response::success($payload['data'] ?? [], (string) ($payload['message'] ?? 'Reset concluido com sucesso.'));
    } catch (InvalidArgumentException $e) {
        Response::validationError($e->getMessage());
    } catch (Throwable $e) {
        try {
            if ($db->inTransaction()) {
                $db->rollBack();
            }
        } catch (Throwable $rollbackError) {
            error_log('[admin_database_reset_route.rollback] ' . $rollbackError->getMessage());
        }

        try {
            $db->exec('SET FOREIGN_KEY_CHECKS = 1');
        } catch (Throwable $foreignKeyError) {
            error_log('[admin_database_reset_route.foreign_keys] ' . $foreignKeyError->getMessage());
        }

        error_log('[admin_database_reset_route] ' . $e->getMessage());
        Response::serverError('Erro ao resetar banco de dados.', $e);
    }
}

/**
 * Ponto de entrada do modulo administrativo para gerenciamento de cache.
 * Preserva o endpoint legado `api/cache/manage.php` sem manter regra procedural.
 *
 * @since 1.0.0
 */
function handleAdminCacheRoute(PDO $db): void
{
    try {
        $context = requirePlatformAdminSessionContext($db);
        $adminUserId = (string) $context['admin_user_id'];
        $action = trim((string) ($_GET['action'] ?? 'stats'));
        $method = (string) ($_SERVER['REQUEST_METHOD'] ?? 'GET');
        $body = json_decode(file_get_contents('php://input'), true) ?: [];

        $controller = new AdminCacheController(
            new AdminCacheService(
                new AdminCacheRepository($db),
                new AdminCacheValidator()
            )
        );

        $payload = $controller->handle($action, $method, $body);

        $auditAction = match ($action) {
            'clear' => 'cache.clear',
            'clean' => 'cache.clean_expired',
            'settings' => 'cache.toggle',
            default => 'cache.view_stats',
        };

        $auditMetadata = [];
        if ($action === 'settings') {
            $auditMetadata['enabled'] = isset($body['enabled']) ? (bool) $body['enabled'] : true;
            $auditMetadata['default_ttl'] = isset($body['default_ttl']) ? (int) $body['default_ttl'] : null;
        }

        logAdminAudit($db, $adminUserId, $auditAction, 'cache', null, $auditMetadata);
        Response::success($payload['data'] ?? [], (string) ($payload['message'] ?? 'Operacao de cache concluida.'));
    } catch (RuntimeException $e) {
        Response::error($e->getMessage(), 405);
    } catch (InvalidArgumentException $e) {
        Response::badRequest($e->getMessage());
    } catch (Throwable $e) {
        error_log('[admin_cache_route] ' . $e->getMessage());
        Response::serverError('Nao foi possivel processar a operacao de cache.', $e);
    }
}

/**
 * Ponto de entrada oficial das configuracoes sistemicas.
 * Mantem `api/settings.php` apenas como bridge e concentra leitura/escrita no modulo admin.
 *
 * @since 1.0.0
 */
function handleAdminSettingsRoute(PDO $db): void
{
    try {
        $method = strtoupper((string) ($_SERVER['REQUEST_METHOD'] ?? 'GET'));
        $action = trim((string) ($_GET['action'] ?? 'update'));
        $context = requirePlatformAdminSessionContext($db);
        $adminUserId = (string) $context['admin_user_id'];
        $controller = new AdminSettingsController(
            new AdminSettingsService(
                $db,
                new AdminSettingsRepository($db),
                new AdminSettingsValidator()
            )
        );

        if ($method === 'GET') {
            $payload = $controller->show(['role' => 'admin', 'user_id' => $adminUserId]);
            Response::success($payload);
        }

        if ($method === 'POST') {
            $raw = file_get_contents('php://input');
            $data = json_decode($raw ?: '', true);
            if (!is_array($data) || $data === []) {
                Response::badRequest('Dados invalidos.');
            }

            if ($action === 'test_smtp') {
                $payload = $controller->testSmtp($data);
            } elseif ($action === 'test_email_template') {
                $payload = $controller->testEmailTemplate($data);
            } elseif ($action === 'test_integrations') {
                $payload = $controller->testIntegrations($data);
            } else {
                $payload = $controller->update($data);
            }

            logAdminAudit(
                $db,
                $adminUserId,
                (string) $payload['audit_action'],
                (string) $payload['audit_entity_type'],
                $payload['audit_entity_id'],
                $payload['audit_metadata'] ?? []
            );

            Response::success($payload['data'] ?? [], (string) ($payload['message'] ?? 'Configuracoes salvas com sucesso!'));
        }

        Response::error('Metodo nao permitido.', 405);
    } catch (InvalidArgumentException $e) {
        Response::badRequest($e->getMessage());
    } catch (Throwable $e) {
        error_log('[admin_settings_route] ' . $e->getMessage());
        Response::serverError('Nao foi possivel carregar/salvar configuracoes.', $e);
    }
}

/**
 * Recebe imagens de identidade visual sem reutilizar uploads de outros dominios.
 *
 * @since 1.0.0
 */
function handleAdminBrandAssetUploadRoute(PDO $db): void
{
    try {
        $method = strtoupper((string) ($_SERVER['REQUEST_METHOD'] ?? 'GET'));
        if ($method !== 'POST') {
            Response::error('Metodo nao permitido.', 405);
        }

        $context = requirePlatformAdminSessionContext($db);
        $purpose = trim((string) ($_POST['purpose'] ?? ''));
        $file = $_FILES['asset'] ?? null;
        if (!is_array($file)) {
            Response::validationError('Selecione uma imagem valida.');
        }

        $asset = (new AdminBrandAssetsService())->upload($file, $purpose, dirname(__DIR__, 2));

        logAdminAudit(
            $context['db'],
            (string) $context['admin_user_id'],
            'settings.brand_asset.upload',
            'brand_asset',
            null,
            [
                'purpose' => $purpose,
                'mime_type' => $asset['mimeType'],
                'size_bytes' => $asset['size'],
                'width' => $asset['width'],
                'height' => $asset['height'],
                'storage_key' => $asset['storageKey'],
            ]
        );

        unset($asset['storageKey']);
        Response::success($asset, 'Imagem enviada com sucesso.');
    } catch (InvalidArgumentException $e) {
        Response::validationError($e->getMessage());
    } catch (Throwable $e) {
        error_log('[admin_brand_asset_upload_route] ' . $e->getMessage());
        Response::serverError('Nao foi possivel enviar a imagem administrativa.', $e);
    }
}

/**
 * Endpoint administrativo para gestao direta do catalogo de planos.
 * Permite ajustar valor, ciclo (dias/semanas/meses/anos) e status ativo.
 *
 * @since 1.0.0
 */
function handleAdminPlanCatalogRoute(PDO $db): void
{
    try {
        $method = strtoupper((string) ($_SERVER['REQUEST_METHOD'] ?? 'GET'));
        $context = requirePlatformAdminSessionContext($db);
        $adminUserId = (string) $context['admin_user_id'];

        $controller = new AdminPlanCatalogController(
            new AdminPlanCatalogService(
                new AdminPlanCatalogRepository($db),
                new AdminPlanCatalogValidator()
            )
        );

        if ($method === 'GET') {
            Response::success($controller->list($_GET));
        }

        if (in_array($method, ['POST', 'PATCH', 'PUT'], true)) {
            $payload = json_decode(file_get_contents('php://input'), true) ?: [];
            $result = $controller->update($payload, $adminUserId);

            logAdminAudit(
                $db,
                $adminUserId,
                (string) ($result['audit_action'] ?? 'plans.catalog.update'),
                (string) ($result['audit_entity_type'] ?? 'plan'),
                $result['audit_entity_id'] ?? null,
                is_array($result['audit_metadata'] ?? null) ? $result['audit_metadata'] : []
            );

            Response::success(
                $result['data'] ?? [],
                (string) ($result['message'] ?? 'Plano atualizado com sucesso.')
            );
        }

        Response::error('Metodo nao permitido.', 405);
    } catch (InvalidArgumentException $e) {
        Response::validationError($e->getMessage());
    } catch (OutOfBoundsException $e) {
        Response::notFound($e->getMessage());
    } catch (Throwable $e) {
        error_log('[admin_plan_catalog_route] ' . $e->getMessage());
        Response::serverError('Nao foi possivel processar o catalogo de planos.', $e);
    }
}

/**
 * Endpoint administrativo para gestao de IPs suspeitos e bloqueios manuais.
 *
 * @since 1.0.0
 */
function handleAdminSecurityIpsRoute(PDO $db): void
{
    try {
        $method = strtoupper((string) ($_SERVER['REQUEST_METHOD'] ?? 'GET'));
        $context = requirePlatformAdminSessionContext($db);
        $adminUserId = (string) $context['admin_user_id'];

        $controller = new AdminSecurityIpsController(
            new AdminSecurityIpsService(
                new AdminSecurityIpsRepository($db),
                new AdminSecurityIpsValidator()
            )
        );

        if ($method === 'GET') {
            Response::success($controller->overview($_GET));
        }

        if ($method === 'POST') {
            $payload = json_decode(file_get_contents('php://input'), true) ?: [];
            $result = $controller->mutate($payload, $adminUserId);

            logAdminAudit(
                $db,
                $adminUserId,
                (string) ($result['audit_action'] ?? 'security.ip.mutate'),
                (string) ($result['audit_entity_type'] ?? 'security_ip'),
                (string) ($result['audit_entity_id'] ?? ''),
                is_array($result['audit_metadata'] ?? null) ? $result['audit_metadata'] : []
            );

            Response::success(
                $result['data'] ?? [],
                (string) ($result['message'] ?? 'Operacao de seguranca executada com sucesso.')
            );
        }

        Response::error('Metodo nao permitido.', 405);
    } catch (InvalidArgumentException $e) {
        Response::validationError($e->getMessage());
    } catch (OutOfBoundsException $e) {
        Response::notFound($e->getMessage());
    } catch (Throwable $e) {
        error_log('[admin_security_ips_route] ' . $e->getMessage());
        Response::serverError('Nao foi possivel processar a seguranca de IPs.', $e);
    }
}

/**
 * Construtor unico do controller de analytics do admin.
 *
 * @since 1.0.0
 */
function buildAdminAnalyticsController(PDO $db): AdminAnalyticsController
{
    return new AdminAnalyticsController(
        new AdminAnalyticsService(
            new AdminAnalyticsRepository($db),
            new AdminAnalyticsValidator()
        )
    );
}

/**
 * Analytics financeiro/comercial do SaaS.
 *
 * @since 1.0.0
 */
function handleAdminAnalyticsFinanceRoute(PDO $db): void
{
    try {
        $context = requirePlatformAdminSessionContext($db);
        $controller = buildAdminAnalyticsController($db);
        $method = strtoupper((string) ($_SERVER['REQUEST_METHOD'] ?? 'GET'));
        $action = trim((string) ($_GET['action'] ?? ''));

        if ($method === 'POST' && $action === 'send_billing_risk_email') {
            $data = json_decode(file_get_contents('php://input'), true) ?: [];
            $payload = $controller->sendBillingRiskEmail($data);

            logAdminAudit(
                $db,
                (string) ($context['admin_user_id'] ?? ''),
                'analytics.billing_risk_email',
                'user',
                $payload['userId'] ?? null,
                [
                    'email' => $payload['email'] ?? null,
                    'reason' => $payload['reason'] ?? null,
                ]
            );

            Response::success($payload, 'Email de regularizacao enviado com sucesso.');
            return;
        }

        if ($method !== 'GET') {
            Response::badRequest('Metodo invalido para analytics financeiro.');
            return;
        }

        Response::success($controller->finance(
            $_GET['period'] ?? 'month',
            $_GET['startDate'] ?? null,
            $_GET['endDate'] ?? null
        ));
    } catch (InvalidArgumentException $e) {
        Response::validationError($e->getMessage());
    } catch (Throwable $e) {
        error_log('[admin_analytics_finance_route] ' . $e->getMessage());
        Response::serverError('Nao foi possivel carregar o analytics financeiro.', $e);
    }
}

/**
 * Analytics operacional hibrido do dashboard.
 *
 * @since 1.0.0
 */
function handleAdminAnalyticsDashboardRoute(PDO $db): void
{
    try {
        requirePlatformAdminSessionContext($db);
        $controller = buildAdminAnalyticsController($db);
        Response::success($controller->dashboard(
            $_GET['period'] ?? 'month',
            $_GET['startDate'] ?? null,
            $_GET['endDate'] ?? null
        ));
    } catch (InvalidArgumentException $e) {
        Response::validationError($e->getMessage());
    } catch (Throwable $e) {
        error_log('[admin_analytics_dashboard_route] ' . $e->getMessage());
        Response::serverError('Nao foi possivel carregar o analytics do dashboard.', $e);
    }
}

/**
 * Analytics de funil e conversao.
 *
 * @since 1.0.0
 */
function handleAdminAnalyticsFunnelRoute(PDO $db): void
{
    try {
        requirePlatformAdminSessionContext($db);
        $controller = buildAdminAnalyticsController($db);
        Response::success($controller->funnel(
            $_GET['period'] ?? 'month',
            $_GET['startDate'] ?? null,
            $_GET['endDate'] ?? null
        ));
    } catch (InvalidArgumentException $e) {
        Response::validationError($e->getMessage());
    } catch (Throwable $e) {
        error_log('[admin_analytics_funnel_route] ' . $e->getMessage());
        Response::serverError('Nao foi possivel carregar o analytics de funil.', $e);
    }
}

/**
 * Segmentos acionaveis para relacionamento/marketing.
 *
 * @since 1.0.0
 */
function handleAdminAnalyticsSegmentsRoute(PDO $db): void
{
    try {
        requirePlatformAdminSessionContext($db);
        $controller = buildAdminAnalyticsController($db);
        Response::success($controller->segments(
            $_GET['period'] ?? 'month',
            $_GET['startDate'] ?? null,
            $_GET['endDate'] ?? null
        ));
    } catch (InvalidArgumentException $e) {
        Response::validationError($e->getMessage());
    } catch (Throwable $e) {
        error_log('[admin_analytics_segments_route] ' . $e->getMessage());
        Response::serverError('Nao foi possivel carregar os segmentos analiticos.', $e);
    }
}

/**
 * Exporta os leads do funil comercial em CSV.
 *
 * @since 1.0.0
 */
function handleAdminAnalyticsFunnelExportRoute(PDO $db): void
{
    try {
        requirePlatformAdminSessionContext($db);
        $controller = buildAdminAnalyticsController($db);
        $items = $controller->exportFunnelLeads(
            $_GET['period'] ?? 'month',
            $_GET['startDate'] ?? null,
            $_GET['endDate'] ?? null
        );

        $filename = 'analytics-funnel-leads-' . date('Ymd-His') . '.csv';
        header('Content-Type: text/csv; charset=utf-8');
        header('Content-Disposition: attachment; filename="' . $filename . '"');

        $output = fopen('php://output', 'w');
        if ($output === false) {
            throw new RuntimeException('Nao foi possivel gerar o CSV de leads.');
        }

        fputcsv($output, [
            'lead_key',
            'email',
            'nome',
            'user_id',
            'referencia',
            'origem_url',
            'utm_source',
            'utm_medium',
            'utm_campaign',
            'etapa_atual',
            'criou_conta',
            'iniciou_checkout',
            'iniciou_pagamento',
            'comprou',
            'primeiro_evento',
            'ultimo_evento',
        ], ';');

        foreach ($items as $item) {
            fputcsv($output, [
                $item['leadKey'] ?? '',
                $item['email'] ?? '',
                $item['name'] ?? '',
                $item['userId'] ?? '',
                $item['referrer'] ?? '',
                $item['originUrl'] ?? '',
                $item['utmSource'] ?? '',
                $item['utmMedium'] ?? '',
                $item['utmCampaign'] ?? '',
                $item['currentStage'] ?? '',
                $item['createdAccount'] ?? '',
                $item['checkoutStarted'] ?? '',
                $item['paymentStarted'] ?? '',
                $item['purchased'] ?? '',
                $item['firstEventAt'] ?? '',
                $item['lastEventAt'] ?? '',
            ], ';');
        }

        fclose($output);
        exit;
    } catch (InvalidArgumentException $e) {
        Response::validationError($e->getMessage());
    } catch (Throwable $e) {
        error_log('[admin_analytics_funnel_export_route] ' . $e->getMessage());
        Response::serverError('Nao foi possivel exportar os leads do funil.', $e);
    }
}

/**
 * Exporta os segmentos acionaveis em CSV.
 *
 * @since 1.0.0
 */
function handleAdminAnalyticsSegmentsExportRoute(PDO $db): void
{
    try {
        requirePlatformAdminSessionContext($db);
        $controller = buildAdminAnalyticsController($db);
        $items = $controller->exportSegments(
            $_GET['period'] ?? 'month',
            $_GET['startDate'] ?? null,
            $_GET['endDate'] ?? null,
            $_GET['segmentKey'] ?? null
        );

        $filename = 'analytics-segmentos-' . date('Ymd-His') . '.csv';
        header('Content-Type: text/csv; charset=utf-8');
        header('Content-Disposition: attachment; filename="' . $filename . '"');

        $output = fopen('php://output', 'w');
        if ($output === false) {
            throw new RuntimeException('Nao foi possivel gerar o CSV de segmentos.');
        }

        fputcsv($output, [
            'segmento_key',
            'segmento',
            'email',
            'nome',
            'user_id',
            'ultimo_evento',
            'observacao',
        ], ';');

        foreach ($items as $item) {
            fputcsv($output, [
                $item['segmentKey'] ?? '',
                $item['segmentLabel'] ?? '',
                $item['email'] ?? '',
                $item['name'] ?? '',
                $item['userId'] ?? '',
                $item['lastEventAt'] ?? '',
                $item['notes'] ?? '',
            ], ';');
        }

        fclose($output);
        exit;
    } catch (InvalidArgumentException $e) {
        Response::validationError($e->getMessage());
    } catch (Throwable $e) {
        error_log('[admin_analytics_segments_export_route] ' . $e->getMessage());
        Response::serverError('Nao foi possivel exportar os segmentos.', $e);
    }
}

/**
 * Caixa de entrada unica de moderacao de comentarios.
 *
 * @since 1.0.0
 */
function handleAdminCommentsModerationRoute(PDO $db): void
{
    try {
        $context = requireAdminSessionContext($db);
        $adminUserId = (string) $context['admin_user_id'];
        $method = strtoupper((string) ($_SERVER['REQUEST_METHOD'] ?? 'GET'));
        $controller = new AdminCommentsModerationController(
            new AdminCommentsModerationService(
                new AdminCommentsModerationRepository($db),
                new AdminCommentsModerationValidator()
            )
        );

        if ($method === 'GET') {
            Response::success($controller->list($_GET));
        }

        if (in_array($method, ['PATCH', 'PUT', 'POST'], true)) {
            $payload = json_decode(file_get_contents('php://input'), true) ?: [];
            $result = $controller->update($payload, $adminUserId);
            logAdminAudit($db, $adminUserId, 'comments.moderate', 'comment', (string) ($result['id'] ?? ''), [
                'status' => $result['status'] ?? null,
            ]);
            Response::success($result, 'Status do comentario atualizado com sucesso.');
        }

        Response::error('Metodo nao permitido.', 405);
    } catch (InvalidArgumentException $e) {
        Response::validationError($e->getMessage());
    } catch (Throwable $e) {
        error_log('[admin_comments_moderation_route] ' . $e->getMessage());
        Response::serverError('Nao foi possivel processar a moderacao de comentarios.', $e);
    }
}

/**
 * Atualizacao em massa da moderacao de comentarios.
 *
 * @since 1.0.0
 */
function handleAdminCommentsModerationBulkRoute(PDO $db): void
{
    try {
        $context = requireAdminSessionContext($db);
        $adminUserId = (string) $context['admin_user_id'];
        $payload = json_decode(file_get_contents('php://input'), true) ?: [];
        $controller = new AdminCommentsModerationController(
            new AdminCommentsModerationService(
                new AdminCommentsModerationRepository($db),
                new AdminCommentsModerationValidator()
            )
        );

        $result = $controller->bulkUpdate($payload, $adminUserId);
        logAdminAudit($db, $adminUserId, 'comments.moderate_bulk', 'comment', null, [
            'status' => $payload['status'] ?? null,
            'total' => $result['updated'] ?? 0,
        ]);
        Response::success($result, 'Comentarios atualizados com sucesso.');
    } catch (InvalidArgumentException $e) {
        Response::validationError($e->getMessage());
    } catch (Throwable $e) {
        error_log('[admin_comments_moderation_bulk_route] ' . $e->getMessage());
        Response::serverError('Nao foi possivel atualizar os comentarios selecionados.', $e);
    }
}

/**
 * Exporta a fila unificada de comentarios em CSV.
 *
 * @since 1.0.0
 */
function handleAdminCommentsModerationExportRoute(PDO $db): void
{
    try {
        requireAdminSessionContext($db);
        $controller = new AdminCommentsModerationController(
            new AdminCommentsModerationService(
                new AdminCommentsModerationRepository($db),
                new AdminCommentsModerationValidator()
            )
        );

        $items = $controller->export($_GET);
        $filename = 'moderacao-comentarios-' . date('Ymd-His') . '.csv';

        header('Content-Type: text/csv; charset=utf-8');
        header('Content-Disposition: attachment; filename="' . $filename . '"');

        $output = fopen('php://output', 'w');
        if ($output === false) {
            throw new RuntimeException('Nao foi possivel gerar o arquivo CSV.');
        }

        fputcsv($output, ['origem', 'autor', 'trecho', 'alvo', 'link', 'status', 'criado_em'], ';');
        foreach ($items as $item) {
            fputcsv($output, [
                $item['origin'] ?? '',
                $item['authorName'] ?? '',
                $item['excerpt'] ?? '',
                $item['targetLabel'] ?? '',
                $item['targetPath'] ?? '',
                $item['status'] ?? '',
                $item['createdAt'] ?? '',
            ], ';');
        }

        fclose($output);
        exit;
    } catch (InvalidArgumentException $e) {
        Response::validationError($e->getMessage());
    } catch (Throwable $e) {
        error_log('[admin_comments_moderation_export_route] ' . $e->getMessage());
        Response::serverError('Nao foi possivel exportar os comentarios moderados.', $e);
    }
}

/**
 * Consulta e processa ciclos de repasses por indicacao.
 *
 * @since 1.0.0
 */
function handleAdminReferralPayoutsRoute(PDO $db): void
{
    try {
        $context = requirePlatformAdminSessionContext($db);
        $adminUserId = (string) ($context['admin_user_id'] ?? '');
        $method = strtoupper((string) ($_SERVER['REQUEST_METHOD'] ?? 'GET'));

        if ($method === 'GET') {
            Response::success(ReferralFinance::adminOverview($db), 'Referral payout overview retrieved');
        }

        if ($method !== 'POST') {
            Response::error('Metodo nao permitido.', 405, null, 'method_not_allowed');
        }

        $payload = json_decode((string) file_get_contents('php://input'), true);
        if (!is_array($payload)) {
            Response::badRequest('Payload invalido.');
        }

        $action = strtolower(trim((string) ($payload['action'] ?? '')));
        if ($action === 'create_cycle') {
            $result = ReferralFinance::createCycle($db, $adminUserId, !empty($payload['force']));
            logAdminAudit(
                $db,
                $adminUserId,
                'referral_payout.create_cycle',
                'referral_payout_cycle',
                (string) ($result['cycleId'] ?? ''),
                $result
            );
            Response::success($result, 'Ciclo de repasses processado.');
        }

        if ($action === 'mark_paid') {
            $result = ReferralFinance::markPayoutPaid(
                $db,
                (int) ($payload['itemId'] ?? 0),
                $adminUserId,
                (string) ($payload['providerReference'] ?? '')
            );
            logAdminAudit(
                $db,
                $adminUserId,
                'referral_payout.mark_paid',
                'referral_payout_item',
                (string) ($payload['itemId'] ?? ''),
                $result
            );
            Response::success($result, 'Repasse marcado como pago.');
        }

        Response::badRequest('Acao financeira invalida.');
    } catch (InvalidArgumentException $e) {
        Response::validationError($e->getMessage());
    } catch (RuntimeException $e) {
        Response::validationError($e->getMessage());
    } catch (Throwable $e) {
        error_log('[admin_referral_payouts_route] ' . $e->getMessage());
        Response::serverError('Nao foi possivel processar os repasses de indicacao.', $e);
    }
}
