<?php

declare(strict_types=1);

final class BackupDatabaseConfig
{
    public const DEFAULT_CREDENTIAL_FILE = '/etc/concursomestre/backup-db.env';

    /** @return array{host:string,port:string,name:string,user:string,password:string,source:string} */
    public static function fromEnvironment(): array
    {
        $environment = [];
        foreach (array_merge($_ENV, $_SERVER) as $key => $value) {
            if (is_string($key) && (is_scalar($value) || $value === null)) {
                $environment[$key] = (string) $value;
            }
        }
        foreach ([
            'BACKUP_DB_MODE', 'BACKUP_DB_CREDENTIAL_FILE', 'BACKUP_ALLOW_RUNTIME_FALLBACK',
            'BACKUP_DB_HOST', 'BACKUP_DB_PORT', 'BACKUP_DB_NAME', 'BACKUP_DB_USER', 'BACKUP_DB_PASSWORD',
            'DB_HOST', 'DB_PORT', 'DB_NAME', 'DB_USER', 'DB_PASSWORD', 'DB_PASS',
        ] as $key) {
            $value = getenv($key);
            if ($value !== false) {
                $environment[$key] = (string) $value;
            }
        }

        return self::resolve($environment);
    }

    /**
     * @param array<string, string> $environment
     * @return array{host:string,port:string,name:string,user:string,password:string,source:string}
     */
    public static function resolve(array $environment, ?array $credentialValues = null): array
    {
        $mode = strtolower(trim((string) ($environment['BACKUP_DB_MODE'] ?? 'dedicated')));
        if (!in_array($mode, ['dedicated', 'runtime_compat'], true)) {
            throw new RuntimeException('BACKUP_DB_MODE invalido; use dedicated ou runtime_compat.');
        }

        $credentialFile = trim((string) ($environment['BACKUP_DB_CREDENTIAL_FILE'] ?? self::DEFAULT_CREDENTIAL_FILE));
        if ($credentialValues === null && $credentialFile !== '' && is_file($credentialFile)) {
            self::assertCredentialFileIsPrivate($credentialFile);
            $credentialValues = self::parseCredentialFile($credentialFile);
        }
        $credentialValues ??= [];

        $dedicated = [];
        foreach (['HOST', 'PORT', 'NAME', 'USER', 'PASSWORD'] as $suffix) {
            $key = 'BACKUP_DB_' . $suffix;
            $value = trim((string) ($environment[$key] ?? ''));
            if ($value === '') {
                $value = trim((string) ($credentialValues[$key] ?? ''));
            }
            $dedicated[strtolower($suffix)] = $value;
        }

        $provided = array_filter($dedicated, static fn (string $value): bool => $value !== '');
        if ($provided !== [] && count($provided) !== count($dedicated)) {
            $missing = array_keys(array_filter($dedicated, static fn (string $value): bool => $value === ''));
            throw new RuntimeException('Configuracao dedicada de backup incompleta: ' . implode(', ', $missing));
        }
        if (count($provided) === count($dedicated)) {
            return self::validate([...$dedicated, 'source' => 'dedicated']);
        }

        $allowRuntimeFallback = filter_var(
            $environment['BACKUP_ALLOW_RUNTIME_FALLBACK'] ?? 'false',
            FILTER_VALIDATE_BOOL
        );
        if ($mode === 'dedicated' || !$allowRuntimeFallback) {
            throw new RuntimeException('Credenciais dedicadas de backup ausentes; fallback runtime nao autorizado.');
        }

        return self::validate([
            'host' => trim((string) ($environment['DB_HOST'] ?? 'localhost')),
            'port' => trim((string) ($environment['DB_PORT'] ?? '3306')),
            'name' => trim((string) ($environment['DB_NAME'] ?? '')),
            'user' => trim((string) ($environment['DB_USER'] ?? '')),
            'password' => trim((string) ($environment['DB_PASSWORD'] ?? $environment['DB_PASS'] ?? '')),
            'source' => 'runtime_compat',
        ]);
    }

    /** @return array<string, string> */
    private static function parseCredentialFile(string $path): array
    {
        $lines = file($path, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);
        if ($lines === false) {
            throw new RuntimeException('Nao foi possivel ler o arquivo privado de credenciais de backup.');
        }
        $values = [];
        foreach ($lines as $line) {
            $line = trim($line);
            if ($line === '' || str_starts_with($line, '#')) {
                continue;
            }
            if (!str_contains($line, '=')) {
                throw new RuntimeException('Linha invalida no arquivo privado de credenciais de backup.');
            }
            [$key, $value] = array_map('trim', explode('=', $line, 2));
            if (!preg_match('/^BACKUP_DB_(HOST|PORT|NAME|USER|PASSWORD)$/', $key)) {
                throw new RuntimeException('Chave nao permitida no arquivo privado de credenciais de backup: ' . $key);
            }
            if (preg_match('/^(["\'])(.*)\1$/', $value, $matches) === 1) {
                $value = $matches[2];
            }
            $values[$key] = $value;
        }
        return $values;
    }

    private static function assertCredentialFileIsPrivate(string $path): void
    {
        if (!is_readable($path)) {
            throw new RuntimeException('Arquivo privado de credenciais de backup nao pode ser lido.');
        }
        if (PHP_OS_FAMILY !== 'Windows') {
            clearstatcache(true, $path);
            $permissions = fileperms($path);
            if ($permissions === false || ($permissions & 0007) !== 0 || ($permissions & 0020) !== 0) {
                throw new RuntimeException('Arquivo de credenciais de backup deve usar modo 0640 ou mais restritivo.');
            }
        }
    }

    /** @param array<string, string> $config @return array{host:string,port:string,name:string,user:string,password:string,source:string} */
    private static function validate(array $config): array
    {
        foreach (['host', 'port', 'name', 'user', 'password', 'source'] as $key) {
            if (trim((string) ($config[$key] ?? '')) === '') {
                throw new RuntimeException('Configuracao de backup invalida: ' . $key . ' ausente.');
            }
        }
        if (filter_var($config['port'], FILTER_VALIDATE_INT, ['options' => ['min_range' => 1, 'max_range' => 65535]]) === false) {
            throw new RuntimeException('BACKUP_DB_PORT invalido.');
        }
        if (preg_match('/^[A-Za-z0-9_.:-]+$/', $config['host']) !== 1) {
            throw new RuntimeException('BACKUP_DB_HOST invalido.');
        }
        if (preg_match('/^[A-Za-z0-9_]+$/', $config['name']) !== 1) {
            throw new RuntimeException('BACKUP_DB_NAME invalido.');
        }
        if (preg_match('/^[A-Za-z0-9_.-]+$/', $config['user']) !== 1) {
            throw new RuntimeException('BACKUP_DB_USER invalido.');
        }

        return [
            'host' => $config['host'],
            'port' => $config['port'],
            'name' => $config['name'],
            'user' => $config['user'],
            'password' => $config['password'],
            'source' => $config['source'],
        ];
    }
}
