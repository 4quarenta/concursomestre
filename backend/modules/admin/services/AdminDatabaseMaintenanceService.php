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

require_once __DIR__ . '/../repositories/AdminDatabaseMaintenanceRepository.php';
require_once __DIR__ . '/../validators/AdminDatabaseMaintenanceValidator.php';
require_once __DIR__ . '/../../../shared/auth/GoogleAuthenticator.php';
require_once __DIR__ . '/../../../config/env.php';

/**
 * Servico de manutencao administrativa da base.
 * Reune listagem segura de tabelas e reset controlado com senha e 2FA.
 */
class AdminDatabaseMaintenanceService
{
    private const NON_RESETTABLE_TABLES = [
        'settings',
        'system_settings',
    ];

    private PDO $db;
    private AdminDatabaseMaintenanceRepository $repository;
    private AdminDatabaseMaintenanceValidator $validator;

    /**
     * Inicializa o servico com dependencias de banco e validacao.
     *
     * @since 1.0.0
     */
    public function __construct(
        PDO $db,
        AdminDatabaseMaintenanceRepository $repository,
        AdminDatabaseMaintenanceValidator $validator
    ) {
        $this->db = $db;
        $this->repository = $repository;
        $this->validator = $validator;
    }

    /**
     * Lista tabelas que podem ser resetadas pelo painel admin.
     *
     * @since 1.0.0
     */
    public function listResettableTables(): array
    {
        $tables = $this->repository->listExistingTables();
        $selectable = array_values(array_diff($tables, self::NON_RESETTABLE_TABLES));
        sort($selectable);

        return ['tables' => $selectable];
    }

    /**
     * Executa o reset controlado das tabelas solicitadas.
     *
     * @since 1.0.0
     */
    public function resetDatabase(string $adminUserId, array $data): array
    {
        $password = trim((string) ($data['password'] ?? ''));
        $twoFactorCode = trim((string) ($data['twoFactorCode'] ?? ''));
        $requestedTables = is_array($data['tables'] ?? null) ? $data['tables'] : [];

        $appMode = $this->resolveAppMode();
        $this->assertProductionResetIsExplicitlyEnabled($data);
        $this->validator->validateResetCredentials($appMode, $password, $twoFactorCode);
        $this->validator->validateSelectedTables($requestedTables);

        $adminUser = $this->repository->findAdminCredentialsById($adminUserId);
        if (
            !$adminUser ||
            !password_verify($password, (string) ($adminUser['password_hash'] ?? ''))
        ) {
            throw new InvalidArgumentException('Senha administrativa incorreta.');
        }

        if ($appMode !== 'development') {
            if (empty($adminUser['two_factor_enabled'])) {
                throw new InvalidArgumentException('Ative o 2FA antes de realizar esta acao em producao.');
            }

            $ga = new GoogleAuthenticator();
            if (!$ga->verifyCode((string) $adminUser['two_factor_secret'], $twoFactorCode)) {
                throw new InvalidArgumentException('Codigo 2FA invalido.');
            }
        }

        $existingTables = $this->repository->listExistingTables();
        $allowedTables = array_values(array_diff($existingTables, self::NON_RESETTABLE_TABLES));
        sort($allowedTables);
        $tablesToTruncate = [];
        $shouldCleanUsers = false;

        foreach ($requestedTables as $table) {
            $tableName = trim((string) $table);
            if ($tableName === '') {
                continue;
            }

            if ($tableName === 'users') {
                $shouldCleanUsers = true;
                continue;
            }

            if (in_array($tableName, $allowedTables, true)) {
                $tablesToTruncate[] = $tableName;
            }
        }

        $this->validator->validateAllowedResetPayload($tablesToTruncate, $shouldCleanUsers);

        $this->db->beginTransaction();

        try {
            $this->repository->disableForeignKeyChecks();

            foreach ($tablesToTruncate as $tableName) {
                $this->repository->clearTable($tableName);
            }

            if ($shouldCleanUsers) {
                $this->repository->deleteAllUsersExcept($adminUserId);
            }

            $this->repository->enableForeignKeyChecks();
            $this->db->commit();
        } catch (Throwable $e) {
            try {
                $this->repository->enableForeignKeyChecks();
            } catch (Throwable $foreignKeyError) {
                error_log('[admin_database_maintenance_service.foreign_keys] ' . $foreignKeyError->getMessage());
            }

            if ($this->db->inTransaction()) {
                $this->db->rollBack();
            }

            throw $e;
        }

        return [
            'message' => 'O sistema foi reiniciado com sucesso. Todos os dados selecionados foram removidos.',
            'data' => [],
            'audit_action' => 'database.reset',
            'audit_entity_type' => 'database',
            'audit_entity_id' => null,
            'audit_metadata' => [
                'tables_cleared' => $tablesToTruncate,
                'users_cleaned' => $shouldCleanUsers,
                'app_mode' => $appMode,
            ],
        ];
    }

    /**
     * Resolve o modo do app para validar operacoes destrutivas.
     *
     * @since 1.0.0
     */
    private function resolveAppMode(): string
    {
        if (isProductionEnv()) {
            return 'production';
        }

        $configuredMode = $this->repository->fetchAppModeSetting();
        if ($configuredMode !== null && $configuredMode !== '') {
            return $configuredMode;
        }

        $host = (string) ($_SERVER['HTTP_HOST'] ?? '');
        if (strpos($host, 'localhost') !== false || strpos($host, '127.0.0.1') !== false) {
            return 'development';
        }

        return 'production';
    }

    /**
     * Mantem reset destrutivo desligado por padrao em producao.
     *
     * @since 1.0.0
     */
    private function assertProductionResetIsExplicitlyEnabled(array $data): void
    {
        if (!isProductionEnv()) {
            return;
        }

        $enabled = in_array(strtolower(getEnvString('ADMIN_DATABASE_RESET_ENABLED', 'false')), ['1', 'true', 'yes', 'on'], true);
        $expectedConfirmation = getEnvString('ADMIN_DATABASE_RESET_CONFIRMATION');
        $providedConfirmation = trim((string) ($data['productionConfirmation'] ?? $data['confirmation'] ?? ''));

        if (!$enabled || $expectedConfirmation === '' || !hash_equals($expectedConfirmation, $providedConfirmation)) {
            throw new InvalidArgumentException('Reset de banco desativado em producao. Habilite ADMIN_DATABASE_RESET_ENABLED e informe a confirmacao operacional.');
        }
    }
}
