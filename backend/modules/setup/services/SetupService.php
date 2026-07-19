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

require_once __DIR__ . '/../../../config/env.php';
require_once __DIR__ . '/../../../shared/auth/AuthSession.php';

/**
 * Service de primeiro boot da plataforma.
 * Mantem o instalador publico somente enquanto nao existe instalacao concluida.
 *
 * @since 1.0.0
 */
class SetupService
{
    private string $rootPath;
    private string $envPath;
    private string $schemaPath;
    private string $setupTokenPath;

    public function __construct(?string $rootPath = null)
    {
        $this->rootPath = $rootPath ?: dirname(__DIR__, 3);
        $this->envPath = $this->rootPath . '/.env';
        $this->schemaPath = $this->rootPath . '/database/schema.sql';
        $this->setupTokenPath = $this->rootPath . '/storage/setup/install.key';
    }

    /**
     * Retorna um diagnostico seguro da instalacao sem vazar credenciais.
     *
     * @since 1.0.0
     */
    public function getStatus(): array
    {
        $envFileExists = is_file($this->envPath);
        $setupCompleted = $this->readBoolEnv('SETUP_COMPLETED', false);
        $checks = [
            'envFileExists' => $envFileExists,
            'setupCompletedFlag' => $setupCompleted,
            'dbConfigured' => $this->readEnvValue('DB_NAME', '') !== '' && $this->readEnvValue('DB_USER', '') !== '',
            'dbReachable' => false,
            'usersTableExists' => false,
            'adminUserExists' => false,
            'schemaFileExists' => is_file($this->schemaPath),
            'envWritable' => $this->isEnvWritable(),
        ];

        $adminCount = 0;
        $databaseName = $this->readEnvValue('DB_NAME', 'concursomestre');
        $databaseHost = $this->readEnvValue('DB_HOST', 'localhost');
        $setupTokenAvailable = $this->hasSetupInstallToken();

        try {
            $pdo = $this->connectWithConfiguredDatabase();
            $checks['dbReachable'] = true;
            $checks['usersTableExists'] = $this->tableExists($pdo, 'users');
            $checks['databaseReadiness'] = $this->inspectDatabaseReadiness($pdo);

            if ($checks['usersTableExists']) {
                $adminCount = $this->countAdminUsers($pdo);
                $checks['adminUserExists'] = $adminCount > 0;
            }
        } catch (Throwable $e) {
            $checks['dbError'] = $this->sanitizeErrorMessage($e->getMessage());
        }

        $installed = $setupCompleted || $checks['adminUserExists'];
        $needsSetup = !$installed;
        $existingConfigurationLocked = $needsSetup
            && $envFileExists
            && $checks['dbConfigured']
            && !$checks['dbReachable']
            && !$this->readBoolEnv('SETUP_ALLOW_RECONFIGURE', false);

        if ($needsSetup && !$setupTokenAvailable) {
            $setupTokenAvailable = $this->ensureSetupInstallToken();
        }

        $checks['setupTokenAvailable'] = $installed || $setupTokenAvailable;
        $checks['existingConfigurationLocked'] = $existingConfigurationLocked;

        if ($installed) {
            return [
                'installed' => true,
                'needsSetup' => false,
                'canInstall' => false,
                'checks' => [
                    'envFileExists' => $envFileExists,
                    'setupCompletedFlag' => $setupCompleted,
                    'dbConfigured' => $checks['dbConfigured'],
                    'dbReachable' => $checks['dbReachable'],
                    'usersTableExists' => $checks['usersTableExists'],
                    'adminUserExists' => $checks['adminUserExists'],
                    'schemaFileExists' => $checks['schemaFileExists'],
                    'setupTokenAvailable' => true,
                ],
                'message' => $checks['dbReachable'] ? 'Plataforma ja configurada.' : 'Instalacao travada, mas o banco nao respondeu.',
            ];
        }

        return [
            'installed' => $installed,
            'needsSetup' => $needsSetup,
            'canInstall' => $needsSetup
                && !$existingConfigurationLocked
                && $checks['envWritable']
                && $checks['schemaFileExists']
                && $setupTokenAvailable,
            'database' => [
                'name' => $databaseName,
                'host' => $databaseHost,
            ],
            'adminCount' => $adminCount,
            'checks' => $checks,
            'setupToken' => [
                'required' => true,
                'path' => 'storage/setup/install.key',
            ],
            'message' => $installed
                ? ($checks['dbReachable'] ? 'Plataforma ja configurada.' : 'Instalacao travada, mas o banco nao respondeu.')
                : ($existingConfigurationLocked
                    ? 'Existe .env com banco configurado, mas a conexao falhou. Instalação bloqueada para evitar takeover.'
                    : 'Configuracao inicial pendente.'),
        ];
    }

    /**
     * Retorna somente o minimo necessario para abrir o instalador.
     * O diagnostico interno nunca e serializado pela API publica.
     */
    public function getPublicStatus(): array
    {
        $status = $this->getStatus();
        if (!empty($status['installed'])) {
            throw new DomainException('Setup indisponivel.');
        }

        return [
            'needsSetup' => true,
            'canInstall' => (bool) ($status['canInstall'] ?? false),
        ];
    }

    /**
     * Executa a configuracao inicial: banco, schema, .env e primeiro admin.
     *
     * @since 1.0.0
     */
    public function install(array $payload): array
    {
        $status = $this->getStatus();
        if (!empty($status['installed'])) {
            throw new DomainException('A plataforma ja possui configuracao inicial/admin. O instalador foi bloqueado.');
        }

        if (!empty($status['checks']['existingConfigurationLocked'])) {
            throw new DomainException('Existe .env com banco configurado, mas a conexao falhou. Corrija o banco ou remova/libere manualmente o instalador no servidor.');
        }

        $this->assertSetupInstallToken((string) ($payload['setupToken'] ?? ''));

        $input = $this->validateInstallPayload($payload);

        $serverPdo = $this->connectToServer($input);
        try {
            $this->createDatabase($serverPdo, $input['dbName']);
        } catch (PDOException $createError) {
            try {
                $this->connectToDatabase($input);
            } catch (Throwable) {
                throw $createError;
            }
        }

        $pdo = $this->connectToDatabase($input);
        $this->runSchema($pdo);
        $this->applyOperationalBaseline($pdo);
        $this->applySafeProductionDatabaseImprovements($pdo, $input['dbName']);
        $adminId = $this->createFirstAdmin($pdo, $input);
        $this->saveInitialSettings($pdo, $input, $adminId);
        $this->writeEnvFile($input);
        $this->removeSetupInstallToken();

        return [
            'installed' => true,
            'admin' => [
                'id' => $adminId,
                'email' => $input['adminEmail'],
                'name' => $input['adminName'],
            ],
            'database' => [
                'name' => $input['dbName'],
                'host' => $input['dbHost'],
            ],
            'nextUrl' => '/auth',
        ];
    }

    private function validateInstallPayload(array $payload): array
    {
        $dbHost = trim((string) ($payload['dbHost'] ?? 'localhost'));
        $dbPort = trim((string) ($payload['dbPort'] ?? '3306'));
        $dbName = trim((string) ($payload['dbName'] ?? 'concursomestre'));
        $dbUser = trim((string) ($payload['dbUser'] ?? ''));
        $dbPassword = (string) ($payload['dbPassword'] ?? '');
        $appUrl = rtrim(trim((string) ($payload['appUrl'] ?? '')), '/');
        $corsAllowedOrigins = trim((string) ($payload['corsAllowedOrigins'] ?? $appUrl));
        $appEnv = strtolower(trim((string) ($payload['appEnv'] ?? 'production')));
        $appTimezone = trim((string) ($payload['appTimezone'] ?? 'America/Sao_Paulo'));
        $adminName = trim((string) ($payload['adminName'] ?? ''));
        $adminEmail = strtolower(trim((string) ($payload['adminEmail'] ?? '')));
        $adminPassword = (string) ($payload['adminPassword'] ?? '');
        $adminPasswordConfirmation = (string) ($payload['adminPasswordConfirmation'] ?? '');

        if ($dbHost === '' || strlen($dbHost) > 255) {
            throw new InvalidArgumentException('Informe o host do banco de dados.');
        }

        if ($dbPort !== '' && !preg_match('/^[0-9]{1,5}$/', $dbPort)) {
            throw new InvalidArgumentException('A porta do banco de dados e invalida.');
        }

        if (!preg_match('/^[A-Za-z0-9_]{2,64}$/', $dbName)) {
            throw new InvalidArgumentException('O nome do banco deve usar apenas letras, numeros e underscore.');
        }

        if ($dbUser === '') {
            throw new InvalidArgumentException('Informe o usuario do banco de dados.');
        }

        if (!filter_var($appUrl, FILTER_VALIDATE_URL) || !in_array(parse_url($appUrl, PHP_URL_SCHEME), ['http', 'https'], true)) {
            throw new InvalidArgumentException('Informe a URL publica da plataforma.');
        }

        if (!in_array($appEnv, ['production', 'staging', 'development'], true)) {
            throw new InvalidArgumentException('Ambiente da aplicacao invalido.');
        }

        if (!in_array($appTimezone, timezone_identifiers_list(), true)) {
            throw new InvalidArgumentException('Timezone invalido.');
        }

        if ($adminName === '' || strlen($adminName) < 3) {
            throw new InvalidArgumentException('Informe o nome do administrador.');
        }

        if (!filter_var($adminEmail, FILTER_VALIDATE_EMAIL)) {
            throw new InvalidArgumentException('Informe um e-mail valido para o administrador.');
        }

        if (strlen($adminPassword) < 10 || !preg_match('/[A-Za-z]/', $adminPassword) || !preg_match('/[0-9]/', $adminPassword)) {
            throw new InvalidArgumentException('A senha do administrador deve ter ao menos 10 caracteres, letras e numeros.');
        }

        if ($adminPassword !== $adminPasswordConfirmation) {
            throw new InvalidArgumentException('A confirmacao da senha do administrador nao confere.');
        }

        $origins = $this->normalizeCorsOrigins($corsAllowedOrigins, $appUrl);

        return [
            'dbHost' => $dbHost,
            'dbPort' => $dbPort,
            'dbName' => $dbName,
            'dbUser' => $dbUser,
            'dbPassword' => $dbPassword,
            'appUrl' => $appUrl,
            'corsAllowedOrigins' => implode(',', $origins),
            'appEnv' => $appEnv,
            'appDebug' => $appEnv === 'production' ? 'false' : 'true',
            'appTimezone' => $appTimezone,
            'adminName' => $adminName,
            'adminEmail' => $adminEmail,
            'adminPassword' => $adminPassword,
        ];
    }

    private function hasSetupInstallToken(): bool
    {
        return trim((string) $this->readEnvValue('SETUP_INSTALL_TOKEN', '')) !== ''
            || (is_file($this->setupTokenPath) && is_readable($this->setupTokenPath));
    }

    private function ensureSetupInstallToken(): bool
    {
        if ($this->hasSetupInstallToken()) {
            return true;
        }

        $directory = dirname($this->setupTokenPath);
        if (!is_dir($directory) && !@mkdir($directory, 0770, true)) {
            return false;
        }

        $token = bin2hex(random_bytes(32));
        if (file_put_contents($this->setupTokenPath, $token . PHP_EOL, LOCK_EX) === false) {
            return false;
        }

        @chmod($this->setupTokenPath, 0640);
        return true;
    }

    private function assertSetupInstallToken(string $providedToken): void
    {
        $expectedToken = trim((string) $this->readEnvValue('SETUP_INSTALL_TOKEN', ''));
        if ($expectedToken === '' && is_file($this->setupTokenPath) && is_readable($this->setupTokenPath)) {
            $expectedToken = trim((string) file_get_contents($this->setupTokenPath));
        }

        if ($expectedToken === '' || !hash_equals($expectedToken, trim($providedToken))) {
            throw new DomainException('Chave de instalacao invalida. Leia storage/setup/install.key no servidor.');
        }
    }

    private function removeSetupInstallToken(): void
    {
        if (is_file($this->setupTokenPath)) {
            @unlink($this->setupTokenPath);
        }
    }

    private function normalizeCorsOrigins(string $rawOrigins, string $appUrl): array
    {
        $origins = array_values(array_filter(array_map('trim', explode(',', $rawOrigins))));
        if (!$origins) {
            $origins = [$appUrl];
        }

        $validOrigins = [];
        foreach ($origins as $origin) {
            $origin = rtrim($origin, '/');
            if (!filter_var($origin, FILTER_VALIDATE_URL) || !in_array(parse_url($origin, PHP_URL_SCHEME), ['http', 'https'], true)) {
                throw new InvalidArgumentException('Origem CORS invalida: ' . $origin);
            }
            $validOrigins[] = $origin;
        }

        return array_values(array_unique($validOrigins));
    }

    private function connectWithConfiguredDatabase(): PDO
    {
        return $this->connectToDatabase([
            'dbHost' => $this->readEnvValue('DB_HOST', 'localhost'),
            'dbPort' => $this->readEnvValue('DB_PORT', ''),
            'dbName' => $this->readEnvValue('DB_NAME', 'concursomestre'),
            'dbUser' => $this->readEnvValue('DB_USER', 'root'),
            'dbPassword' => $this->readEnvValue('DB_PASSWORD', $this->readEnvValue('DB_PASS', '')),
        ]);
    }

    private function connectToServer(array $input): PDO
    {
        $portSegment = $input['dbPort'] !== '' ? ';port=' . $input['dbPort'] : '';
        $dsn = 'mysql:host=' . $input['dbHost'] . $portSegment . ';charset=utf8mb4';

        return $this->makePdo($dsn, $input['dbUser'], $input['dbPassword']);
    }

    private function connectToDatabase(array $input): PDO
    {
        $portSegment = $input['dbPort'] !== '' ? ';port=' . $input['dbPort'] : '';
        $dsn = 'mysql:host=' . $input['dbHost'] . $portSegment . ';dbname=' . $input['dbName'] . ';charset=utf8mb4';

        return $this->makePdo($dsn, $input['dbUser'], $input['dbPassword']);
    }

    private function makePdo(string $dsn, string $user, string $password): PDO
    {
        $pdo = new PDO($dsn, $user, $password, [
            PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_TIMEOUT => 8,
            PDO::ATTR_PERSISTENT => false,
        ]);
        $pdo->exec('SET NAMES utf8mb4 COLLATE utf8mb4_unicode_ci');
        return $pdo;
    }

    private function createDatabase(PDO $pdo, string $databaseName): void
    {
        $pdo->exec(
            'CREATE DATABASE IF NOT EXISTS `' . str_replace('`', '``', $databaseName) . '` '
            . 'DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci'
        );
        $pdo->exec(
            'ALTER DATABASE `' . str_replace('`', '``', $databaseName) . '` '
            . 'DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci'
        );
    }

    private function runSchema(PDO $pdo): void
    {
        if (!is_file($this->schemaPath)) {
            throw new RuntimeException('Arquivo database/schema.sql nao encontrado.');
        }

        $sql = (string) file_get_contents($this->schemaPath);
        $sql = preg_replace('/^\s*CREATE\s+DATABASE\b.*?;\s*$/mi', '', $sql) ?? $sql;
        $sql = preg_replace('/^\s*USE\s+`?[A-Za-z0-9_]+`?\s*;\s*$/mi', '', $sql) ?? $sql;

        foreach ($this->splitSqlStatements($sql) as $statement) {
            $pdo->exec($statement);
        }
    }

    private function splitSqlStatements(string $sql): array
    {
        $sql = preg_replace('/^\xEF\xBB\xBF/', '', $sql) ?? $sql;
        $sql = preg_replace('#/\*.*?\*/#s', '', $sql) ?? $sql;
        $sql = preg_replace('/^\s*--.*$/m', '', $sql) ?? $sql;

        $statements = [];
        $buffer = '';
        $quote = null;
        $length = strlen($sql);

        for ($i = 0; $i < $length; $i++) {
            $char = $sql[$i];
            $prev = $i > 0 ? $sql[$i - 1] : '';

            if (($char === "'" || $char === '"') && $prev !== '\\') {
                if ($quote === $char) {
                    $quote = null;
                } elseif ($quote === null) {
                    $quote = $char;
                }
            }

            if ($char === ';' && $quote === null) {
                $statement = trim($buffer);
                if ($statement !== '') {
                    $statements[] = $statement;
                }
                $buffer = '';
                continue;
            }

            $buffer .= $char;
        }

        $tail = trim($buffer);
        if ($tail !== '') {
            $statements[] = $tail;
        }

        return $statements;
    }

    private function applyOperationalBaseline(PDO $pdo): void
    {
        $pdo->exec("ALTER TABLE users MODIFY COLUMN role VARCHAR(30) NOT NULL DEFAULT 'student'");
        $pdo->exec("ALTER TABLE users MODIFY COLUMN status VARCHAR(30) NOT NULL DEFAULT 'active'");

        $columns = [
            'phone' => 'VARCHAR(30) DEFAULT NULL',
            'photo_url' => 'VARCHAR(500) DEFAULT NULL',
            'auth_provider' => "VARCHAR(50) NOT NULL DEFAULT 'email'",
            'google_sub' => 'VARCHAR(255) NULL',
            'google_id' => 'VARCHAR(255) NULL',
            'facebook_id' => 'VARCHAR(255) NULL',
            'apple_sub' => 'VARCHAR(255) NULL',
            'two_factor_secret' => 'VARCHAR(64) NULL',
            'two_factor_enabled' => 'TINYINT(1) NOT NULL DEFAULT 0',
            'referral_code' => 'VARCHAR(16) DEFAULT NULL',
            'referred_by_id' => 'VARCHAR(36) DEFAULT NULL',
            'deletion_requested_at' => 'DATETIME DEFAULT NULL',
            'deletion_reason' => 'TEXT NULL',
            'plan_tier' => "VARCHAR(40) DEFAULT 'Gratuito'",
            'terms_agreed' => 'TINYINT(1) NOT NULL DEFAULT 1',
        ];

        foreach ($columns as $column => $definition) {
            $this->addColumnIfMissing($pdo, 'users', $column, $definition);
        }

        $this->createIndexIfMissing($pdo, 'users', 'idx_users_role_status', 'CREATE INDEX idx_users_role_status ON users (role, status)');
        $this->createUniqueIndexIfColumnHasNoDuplicates($pdo, 'users', 'referral_code', 'uniq_users_referral_code');
        $this->createUniqueIndexIfColumnHasNoDuplicates($pdo, 'users', 'google_sub', 'uniq_users_google_sub');
        $this->createUniqueIndexIfColumnHasNoDuplicates($pdo, 'users', 'facebook_id', 'uniq_users_facebook_id');
        $this->createUniqueIndexIfColumnHasNoDuplicates($pdo, 'users', 'apple_sub', 'uniq_users_apple_sub');

        ensureAuthTables($pdo);
        $this->ensureReferralsTable($pdo);
    }

    private function applySafeProductionDatabaseImprovements(PDO $pdo, string $databaseName): void
    {
        try {
            $pdo->exec(
                'ALTER DATABASE `' . str_replace('`', '``', $databaseName) . '` '
                . 'DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci'
            );
        } catch (Throwable $e) {
            error_log('[setup_database_improvements] database charset: ' . $e->getMessage());
        }

        $safeIndexes = [
            ['users', 'idx_users_created_at', 'CREATE INDEX idx_users_created_at ON users (created_at)'],
            ['notifications', 'idx_notifications_created_at', 'CREATE INDEX idx_notifications_created_at ON notifications (created_at)'],
            ['system_settings', 'idx_system_settings_updated_at', 'CREATE INDEX idx_system_settings_updated_at ON system_settings (updated_at)'],
        ];

        foreach ($safeIndexes as [$table, $indexName, $sql]) {
            try {
                if ($this->tableExists($pdo, $table)) {
                    $this->createIndexIfMissing($pdo, $table, $indexName, $sql);
                }
            } catch (Throwable $e) {
                error_log('[setup_database_improvements] index ' . $indexName . ': ' . $e->getMessage());
            }
        }
    }

    private function inspectDatabaseReadiness(PDO $pdo): array
    {
        $issues = [];
        $recommendations = [];
        $coreTables = [
            'users',
            'filters',
            'provas',
            'questions',
            'user_answers',
            'notifications',
            'system_settings',
            'auth_sessions',
            'auth_refresh_tokens',
            'plans',
            'user_subscriptions',
            'user_cards',
            'transactions',
        ];

        $databaseRow = $pdo->query(
            "SELECT DEFAULT_CHARACTER_SET_NAME AS charset_name, DEFAULT_COLLATION_NAME AS collation_name
             FROM information_schema.SCHEMATA
             WHERE SCHEMA_NAME = DATABASE()
             LIMIT 1"
        )->fetch(PDO::FETCH_ASSOC) ?: [];

        $charsetOk = strtolower((string) ($databaseRow['charset_name'] ?? '')) === 'utf8mb4';
        $collation = strtolower((string) ($databaseRow['collation_name'] ?? ''));
        if (!$charsetOk) {
            $issues[] = 'database_charset_nao_utf8mb4';
            $recommendations[] = 'Definir o banco como utf8mb4 para preservar acentos, destaques e textos juridicos.';
        }

        $missingTables = [];
        foreach ($coreTables as $table) {
            if (!$this->tableExists($pdo, $table)) {
                $missingTables[] = $table;
            }
        }

        if ($missingTables) {
            $issues[] = 'tabelas_essenciais_ausentes';
            $recommendations[] = 'Executar o setup/migracoes antes de liberar a plataforma em producao.';
        }

        $nonInnoDbTables = [];
        $stmt = $pdo->query(
            "SELECT TABLE_NAME, ENGINE
             FROM information_schema.TABLES
             WHERE TABLE_SCHEMA = DATABASE()
               AND TABLE_TYPE = 'BASE TABLE'"
        );
        foreach ($stmt->fetchAll(PDO::FETCH_ASSOC) ?: [] as $row) {
            $engine = strtolower((string) ($row['ENGINE'] ?? ''));
            if ($engine !== 'innodb') {
                $nonInnoDbTables[] = (string) $row['TABLE_NAME'];
            }
        }

        if ($nonInnoDbTables) {
            $issues[] = 'engine_nao_innodb';
            $recommendations[] = 'Usar InnoDB nas tabelas para transacoes, indices e integridade referencial.';
        }

        $requiredUserColumns = [
            'id',
            'name',
            'email',
            'password_hash',
            'role',
            'status',
            'plan',
            'photo_url',
            'two_factor_enabled',
            'referral_code',
            'preferences',
            'current_plan_id',
            'subscription_end',
            'stripe_customer_id',
            'has_saved_card',
        ];
        $missingUserColumns = [];
        if ($this->tableExists($pdo, 'users')) {
            foreach ($requiredUserColumns as $column) {
                if (!$this->columnExists($pdo, 'users', $column)) {
                    $missingUserColumns[] = $column;
                }
            }
        }

        if ($missingUserColumns) {
            $issues[] = 'users_schema_incompleto';
            $recommendations[] = 'Aplicar baseline operacional de usuarios antes de liberar login, perfil e admin.';
        }

        $criticalIndexes = [
            ['users', 'email'],
            ['notifications', 'idx_notifications_user_visible'],
            ['auth_refresh_tokens', 'token_hash'],
        ];
        $missingIndexes = [];
        foreach ($criticalIndexes as [$table, $indexName]) {
            if ($this->tableExists($pdo, $table) && !$this->indexExists($pdo, $table, $indexName)) {
                $missingIndexes[] = $table . '.' . $indexName;
            }
        }

        if ($missingIndexes) {
            $issues[] = 'indices_criticos_ausentes';
            $recommendations[] = 'Criar indices criticos para login, notificacoes e refresh tokens.';
        }

        return [
            'status' => $issues ? 'warning' : 'ok',
            'charset' => $databaseRow['charset_name'] ?? null,
            'collation' => $databaseRow['collation_name'] ?? null,
            'missingTables' => $missingTables,
            'nonInnoDbTables' => $nonInnoDbTables,
            'missingUserColumns' => $missingUserColumns,
            'missingIndexes' => $missingIndexes,
            'issues' => $issues,
            'recommendations' => array_values(array_unique($recommendations)),
        ];
    }

    private function ensureReferralsTable(PDO $pdo): void
    {
        $pdo->exec(
            "CREATE TABLE IF NOT EXISTS referrals (
                id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
                referrer_id VARCHAR(36) NOT NULL,
                referred_user_id VARCHAR(36) NOT NULL,
                status VARCHAR(30) NOT NULL DEFAULT 'pending',
                reward_type VARCHAR(30) DEFAULT 'xp',
                reward_amount DECIMAL(10,2) DEFAULT 0,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                UNIQUE KEY uq_referrals_referred_user (referred_user_id),
                INDEX idx_referrals_referrer (referrer_id),
                INDEX idx_referrals_status (status)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci"
        );
    }

    private function createFirstAdmin(PDO $pdo, array $input): string
    {
        if ($this->countAdminUsers($pdo) > 0) {
            throw new DomainException('Ja existe administrador cadastrado.');
        }

        $adminId = $this->createUuid();
        $referralCode = strtoupper(substr(str_replace('-', '', $adminId), 0, 8));

        $stmt = $pdo->prepare(
            "INSERT INTO users (
                id,
                name,
                email,
                password_hash,
                role,
                plan,
                level,
                xp,
                reputation,
                status,
                email_verified,
                referral_code,
                auth_provider,
                preferences,
                created_at,
                updated_at
            ) VALUES (
                :id,
                :name,
                :email,
                :password_hash,
                'admin',
                'Elite',
                1,
                0,
                100,
                'active',
                1,
                :referral_code,
                'email',
                :preferences,
                NOW(),
                NOW()
            )"
        );

        $stmt->execute([
            ':id' => $adminId,
            ':name' => $input['adminName'],
            ':email' => $input['adminEmail'],
            ':password_hash' => password_hash($input['adminPassword'], PASSWORD_DEFAULT),
            ':referral_code' => $referralCode,
            ':preferences' => json_encode([
                'notifications' => true,
                'shareData' => false,
                'showProfilePhoto' => true,
            ], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES),
        ]);

        return $adminId;
    }

    private function saveInitialSettings(PDO $pdo, array $input, string $adminId): void
    {
        $settings = [
            'setup' => [
                'completed' => true,
                'completedAt' => date('c'),
                'adminUserId' => $adminId,
            ],
            'appMode' => $input['appEnv'] === 'production' ? 'production' : 'development',
            'features' => [
                'marketplace' => true,
                'simulation' => true,
                'ai_comments' => false,
                'bulkImportEnabled' => true,
            ],
        ];

        $stmt = $pdo->prepare(
            "INSERT INTO system_settings (key_name, value_json)
             VALUES (:key_name, :value_json)
             ON DUPLICATE KEY UPDATE value_json = VALUES(value_json), updated_at = NOW()"
        );

        foreach ($settings as $key => $value) {
            $stmt->execute([
                ':key_name' => $key,
                ':value_json' => json_encode($value, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES),
            ]);
        }
    }

    private function writeEnvFile(array $input): void
    {
        if (!$this->isEnvWritable()) {
            throw new RuntimeException('O arquivo .env nao pode ser criado ou alterado pelo servidor.');
        }

        $current = $this->readEnvFile();
        $next = array_merge($current, [
            'DB_HOST' => $input['dbHost'],
            'DB_PORT' => $input['dbPort'],
            'DB_NAME' => $input['dbName'],
            'DB_USER' => $input['dbUser'],
            'DB_PASS' => $input['dbPassword'],
            'DB_PASSWORD' => $input['dbPassword'],
            'DB_TIMEOUT_SECONDS' => '5',
            'DB_PERSISTENT' => 'false',
            'JWT_SECRET' => $this->readOrCreateSecret($current, 'JWT_SECRET', 64),
            'API_KEY' => $this->readOrCreateSecret($current, 'API_KEY', 48),
            'CRON_SECRET' => $this->readOrCreateSecret($current, 'CRON_SECRET', 48),
            'CORS_ALLOWED_ORIGINS' => $input['corsAllowedOrigins'],
            'APP_ENV' => $input['appEnv'],
            'APP_DEBUG' => $input['appDebug'],
            'APP_URL' => $input['appUrl'],
            'APP_TIMEZONE' => $input['appTimezone'],
            'SETUP_COMPLETED' => 'true',
            'SETUP_COMPLETED_AT' => date('c'),
            'ADMIN_DATABASE_RESET_ENABLED' => 'false',
        ]);

        $content = "# Environment Configuration\n";
        $content .= "# Generated by ConcursoMestre setup on " . date('c') . "\n\n";

        foreach ($next as $key => $value) {
            if (!preg_match('/^[A-Z0-9_]+$/', $key)) {
                continue;
            }
            $content .= $key . '=' . $this->formatEnvValue((string) $value) . "\n";
        }

        if (is_file($this->envPath)) {
            @copy($this->envPath, $this->envPath . '.bak.' . date('YmdHis'));
        }

        $tmpPath = $this->envPath . '.tmp';
        if (file_put_contents($tmpPath, $content, LOCK_EX) === false) {
            throw new RuntimeException('Nao foi possivel escrever o arquivo .env temporario.');
        }

        if (!@rename($tmpPath, $this->envPath)) {
            @unlink($tmpPath);
            throw new RuntimeException('Nao foi possivel substituir o arquivo .env.');
        }
    }

    private function readEnvFile(): array
    {
        if (!is_file($this->envPath)) {
            return [];
        }

        $lines = file($this->envPath, FILE_IGNORE_NEW_LINES);
        if ($lines === false) {
            return [];
        }

        $values = [];
        foreach ($lines as $line) {
            $line = trim($line);
            if ($line === '' || str_starts_with($line, '#') || !str_contains($line, '=')) {
                continue;
            }
            [$key, $value] = explode('=', $line, 2);
            $key = trim($key);
            $value = trim($value);
            if (preg_match('/^(["\'])(.*)\1$/', $value, $matches)) {
                $value = $matches[2];
            }
            if ($key !== '') {
                $values[$key] = $value;
            }
        }

        return $values;
    }

    private function formatEnvValue(string $value): string
    {
        if ($value === '') {
            return '';
        }

        if (preg_match('/[\s#"\']/', $value)) {
            return '"' . str_replace(['\\', '"'], ['\\\\', '\\"'], $value) . '"';
        }

        return $value;
    }

    private function readOrCreateSecret(array $current, string $key, int $bytes): string
    {
        $existing = trim((string) ($current[$key] ?? $this->readEnvValue($key, '')));
        $lowerExisting = strtolower($existing);
        if ($existing !== '' && !str_contains($lowerExisting, 'change') && !str_contains($lowerExisting, 'your-')) {
            return $existing;
        }

        return bin2hex(random_bytes($bytes));
    }

    private function addColumnIfMissing(PDO $pdo, string $table, string $column, string $definition): void
    {
        if ($this->columnExists($pdo, $table, $column)) {
            return;
        }

        $pdo->exec("ALTER TABLE `{$table}` ADD COLUMN `{$column}` {$definition}");
    }

    private function createIndexIfMissing(PDO $pdo, string $table, string $indexName, string $sql): void
    {
        if ($this->indexExists($pdo, $table, $indexName)) {
            return;
        }

        $pdo->exec($sql);
    }

    private function createUniqueIndexIfColumnHasNoDuplicates(PDO $pdo, string $table, string $column, string $indexName): void
    {
        if ($this->indexExists($pdo, $table, $indexName) || !$this->columnExists($pdo, $table, $column)) {
            return;
        }

        $stmt = $pdo->query(
            "SELECT COUNT(*) FROM (
                SELECT `{$column}`
                FROM `{$table}`
                WHERE `{$column}` IS NOT NULL AND `{$column}` <> ''
                GROUP BY `{$column}`
                HAVING COUNT(*) > 1
            ) duplicates"
        );

        if ((int) $stmt->fetchColumn() > 0) {
            return;
        }

        $pdo->exec("CREATE UNIQUE INDEX `{$indexName}` ON `{$table}` (`{$column}`)");
    }

    private function tableExists(PDO $pdo, string $table): bool
    {
        $stmt = $pdo->prepare(
            'SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = :table'
        );
        $stmt->execute([':table' => $table]);

        return (int) $stmt->fetchColumn() > 0;
    }

    private function columnExists(PDO $pdo, string $table, string $column): bool
    {
        $stmt = $pdo->prepare(
            'SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = :table AND COLUMN_NAME = :column'
        );
        $stmt->execute([
            ':table' => $table,
            ':column' => $column,
        ]);

        return (int) $stmt->fetchColumn() > 0;
    }

    private function indexExists(PDO $pdo, string $table, string $indexName): bool
    {
        $stmt = $pdo->prepare(
            'SELECT COUNT(*) FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = :table AND INDEX_NAME = :index_name'
        );
        $stmt->execute([
            ':table' => $table,
            ':index_name' => $indexName,
        ]);

        return (int) $stmt->fetchColumn() > 0;
    }

    private function countAdminUsers(PDO $pdo): int
    {
        if (!$this->tableExists($pdo, 'users') || !$this->columnExists($pdo, 'users', 'role')) {
            return 0;
        }

        $stmt = $pdo->query(
            "SELECT COUNT(*)
             FROM users
             WHERE role = 'admin'
               AND COALESCE(status, 'active') NOT IN ('deleted', 'pending_deletion', 'banned')"
        );

        return (int) $stmt->fetchColumn();
    }

    private function isEnvWritable(): bool
    {
        if (is_file($this->envPath)) {
            return is_writable($this->envPath);
        }

        return is_writable($this->rootPath);
    }

    private function readEnvValue(string $key, string $fallback): string
    {
        $value = $_ENV[$key] ?? getenv($key);
        if ($value === false || $value === null) {
            return $fallback;
        }

        $value = trim((string) $value);
        return $value !== '' ? $value : $fallback;
    }

    private function readBoolEnv(string $key, bool $fallback): bool
    {
        $value = $this->readEnvValue($key, $fallback ? 'true' : 'false');
        return in_array(strtolower($value), ['1', 'true', 'yes', 'on'], true);
    }

    private function sanitizeErrorMessage(string $message): string
    {
        $password = $this->readEnvValue('DB_PASSWORD', $this->readEnvValue('DB_PASS', ''));
        if ($password !== '') {
            $message = str_replace($password, '[secret]', $message);
        }

        return substr($message, 0, 220);
    }

    private function createUuid(): string
    {
        $data = random_bytes(16);
        $data[6] = chr((ord($data[6]) & 0x0f) | 0x40);
        $data[8] = chr((ord($data[8]) & 0x3f) | 0x80);

        return vsprintf('%s%s-%s-%s-%s-%s%s%s', str_split(bin2hex($data), 4));
    }
}
