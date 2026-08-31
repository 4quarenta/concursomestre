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

require_once __DIR__ . '/../middleware/AuthMiddleware.php';
require_once __DIR__ . '/../auth/AuthSession.php';
require_once __DIR__ . '/../auth/JWTAuth.php';

/**
 * Garante a existencia da tabela de auditoria administrativa usada pelo painel.
 * Ela registra quem fez a ação, em qual recurso e com quais detalhes de contexto.
 *
 * @since 1.0.0
 */
function ensureAdminAuditTable(PDO $db): void
{
    $db->exec(
        "CREATE TABLE IF NOT EXISTS admin_audit_logs (
            id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
            admin_user_id VARCHAR(64) NOT NULL,
            action VARCHAR(120) NOT NULL,
            resource_type VARCHAR(80) NOT NULL,
            resource_id VARCHAR(120) NULL,
            details_json LONGTEXT NULL,
            ip_address VARCHAR(45) NULL,
            user_agent TEXT NULL,
            created_at DATETIME NOT NULL,
            INDEX idx_admin_audit_admin (admin_user_id),
            INDEX idx_admin_audit_action (action),
            INDEX idx_admin_audit_resource (resource_type, resource_id),
            INDEX idx_admin_audit_created_at (created_at)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4"
    );
}

/**
 * Exige contexto admin valido e devolve o pacote padrao com conexão, payload e id do admin.
 * Esta funcao e o ponto unico para bootstrap seguro de endpoints administrativos.
 *
 * @since 1.0.0
 */
function requireAdminSessionContext(?PDO $db = null): array
{
    $payload = AuthMiddleware::requireAdmin();

    if (!$db) {
        require_once __DIR__ . '/../../config/database.php';
        $database = new Database();
        $db = $database->getConnection();
    }

    ensureAuthTables($db);
    ensureAdminAuditTable($db);

    return [
        'db' => $db,
        'payload' => $payload,
        'admin_user_id' => (string) ($payload['user_id'] ?? ''),
    ];
}

/**
 * Exige administrador completo. Staff continua tendo acesso operacional,
 * mas nao deve gerenciar financeiro, configuracoes, marketing ou marketplace.
 *
 * @since 1.0.0
 */
function requirePlatformAdminSessionContext(?PDO $db = null): array
{
    $context = requireAdminSessionContext($db);
    $role = strtolower(trim((string) ($context['payload']['role'] ?? '')));

    if ($role !== 'admin') {
        ApiResponse::forbidden('Acesso restrito ao administrador principal.');
    }

    return $context;
}

/**
 * Registra uma trilha de auditoria administrativa sem interromper o fluxo principal em caso de falha.
 * O painel usa esse log para rastrear operações sensiveis de moderação, financeiro e configuração.
 *
 * @since 1.0.0
 */
function logAdminAudit(
    PDO $db,
    string $adminUserId,
    string $action,
    string $resourceType,
    ?string $resourceId = null,
    array $details = []
): void {
    if ($adminUserId === '' || $action === '' || $resourceType === '') {
        return;
    }

    try {
        ensureAdminAuditTable($db);

        $stmt = $db->prepare(
            "INSERT INTO admin_audit_logs (
                admin_user_id,
                action,
                resource_type,
                resource_id,
                details_json,
                ip_address,
                user_agent,
                created_at
            ) VALUES (
                :admin_user_id,
                :action,
                :resource_type,
                :resource_id,
                :details_json,
                :ip_address,
                :user_agent,
                NOW()
            )"
        );

        $stmt->execute([
            ':admin_user_id' => $adminUserId,
            ':action' => $action,
            ':resource_type' => $resourceType,
            ':resource_id' => $resourceId,
            ':details_json' => json_encode($details, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES),
            ':ip_address' => getAuthClientIp(),
            ':user_agent' => getAuthUserAgent(),
        ]);
    } catch (Throwable $e) {
        error_log('[admin_audit] ' . $e->getMessage());
    }
}
