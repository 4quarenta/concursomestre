<?php

declare(strict_types=1);

require_once __DIR__ . '/SafeOperationPolicy.php';
require_once __DIR__ . '/../repositories/SafeOperationRepository.php';
require_once __DIR__ . '/../../../shared/utils/SimpleCache.php';
require_once __DIR__ . '/../../../scripts/data/DatasetResetPolicyV2.php';

/** Autoridade unica para preview, confirmacao e execucao operacional segura. */
final class SafeOperationService
{
    private const PREVIEW_TTL_SECONDS = 300;
    private const CONFIRMATION_TTL_SECONDS = 300;
    private const MAX_FILES = 5000;

    public function __construct(
        private readonly PDO $db,
        private readonly SafeOperationRepository $repository,
        private readonly string $rootDirectory = ''
    ) {
    }

    /** @return array<string, mixed> */
    public function catalog(): array
    {
        return [
            'environment' => SafeOperationPolicy::ENVIRONMENT,
            'operations' => array_map(
                static fn (array $definition, string $operationType): array => [
                    'operation_type' => $operationType,
                    ...$definition,
                ],
                SafeOperationPolicy::catalog(),
                array_keys(SafeOperationPolicy::catalog())
            ),
        ];
    }

    /** @return array<string, mixed> */
    public function preview(string $actorUserId, string $sessionIdentity, array $payload): array
    {
        $operationType = trim((string) ($payload['operation_type'] ?? ''));
        $definition = SafeOperationPolicy::definition($operationType);
        $namespace = SafeOperationPolicy::validateNamespace($payload['namespace'] ?? null);
        $idempotency = trim((string) ($payload['idempotency_key'] ?? ''));
        if ($idempotency === '' || strlen($idempotency) > 160) {
            throw new SafeOperationDenied('Idempotency da operacao e obrigatoria.', 'missing_idempotency');
        }

        $idempotencyHash = hash('sha256', $idempotency);
        $existing = $this->repository->findByIdempotency($actorUserId, $idempotencyHash);
        if ($existing !== null) {
            return $this->publicPreview($existing);
        }

        $scope = [
            'namespace' => $namespace,
            'target' => (string) $definition['target'],
            'operation_type' => $operationType,
        ];
        $snapshot = $this->snapshot($operationType, $namespace);
        $fingerprint = $this->fingerprint($operationType, $scope, $snapshot);
        $operationId = $this->uuid();
        $expiresAt = gmdate('Y-m-d H:i:s.u', time() + self::PREVIEW_TTL_SECONDS);
        $run = [
            'operation_id' => $operationId,
            'operation_type' => $operationType,
            'actor_user_id' => $actorUserId,
            'actor_session_hash' => hash('sha256', $sessionIdentity),
            'environment' => SafeOperationPolicy::ENVIRONMENT,
            'risk_class' => (string) $definition['risk_class'],
            'target_scope_json' => SafeOperationPolicy::canonicalJson($scope),
            'namespace_key' => $namespace,
            'preview_fingerprint' => $fingerprint,
            'preview_expires_at' => $expiresAt,
            'idempotency_hash' => $idempotencyHash,
            'status' => 'PREVIEWED',
            'expected_count' => (int) ($snapshot['affected_count'] ?? 0),
            'recovery_class' => (string) $definition['recovery_class'],
            'recovery_status' => $this->recoveryStatus($operationType),
            'result_json' => SafeOperationPolicy::canonicalJson(['snapshot' => $snapshot]),
        ];

        $this->db->beginTransaction();
        try {
            $this->repository->insert($run);
            $this->repository->appendAudit($actorUserId, 'safe_operation.preview', $operationId, $this->auditPayload($run, $snapshot, null));
            $this->db->commit();
        } catch (Throwable $exception) {
            if ($this->db->inTransaction()) {
                $this->db->rollBack();
            }
            throw $exception;
        }

        return [
            'operation_id' => $operationId,
            'operation_type' => $operationType,
            'environment' => SafeOperationPolicy::ENVIRONMENT,
            'risk_class' => $definition['risk_class'],
            'namespace' => $namespace,
            'snapshot' => $snapshot,
            'preview_fingerprint' => $fingerprint,
            'preview_expires_at' => $expiresAt,
            'confirmation_required' => true,
            'execution_allowed' => (bool) $definition['execution_allowed'],
            'recovery' => [
                'class' => $definition['recovery_class'],
                'status' => $run['recovery_status'],
            ],
        ];
    }

    /** @return array<string, mixed> */
    public function confirm(string $actorUserId, string $sessionIdentity, array $payload): array
    {
        $operationId = trim((string) ($payload['operation_id'] ?? ''));
        $fingerprint = trim((string) ($payload['preview_fingerprint'] ?? ''));
        if ($operationId === '' || $fingerprint === '') {
            throw new SafeOperationDenied('Preview e fingerprint sao obrigatorios.', 'missing_preview');
        }

        $this->db->beginTransaction();
        try {
            $run = $this->repository->find($operationId, true);
            $this->assertOwnedAndCurrent($run, $actorUserId, $sessionIdentity, $fingerprint, ['PREVIEWED']);
            $token = bin2hex(random_bytes(32));
            $confirmationExpiresAt = gmdate('Y-m-d H:i:s.u', time() + self::CONFIRMATION_TTL_SECONDS);
            $this->repository->update($operationId, [
                'status' => 'CONFIRMED',
                'confirmation_hash' => hash('sha256', $token),
                'confirmation_expires_at' => $confirmationExpiresAt,
            ]);
            $this->repository->appendAudit($actorUserId, 'safe_operation.confirm', $operationId, $this->auditPayload($run, $this->decodedSnapshot($run), 'CONFIRMED'));
            $this->db->commit();
        } catch (Throwable $exception) {
            if ($this->db->inTransaction()) {
                $this->db->rollBack();
            }
            throw $exception;
        }

        return [
            'operation_id' => $operationId,
            'status' => 'CONFIRMED',
            'confirmation_token' => $token,
            'confirmation_expires_at' => $confirmationExpiresAt,
        ];
    }

    /** @return array<string, mixed> */
    public function execute(string $actorUserId, string $sessionIdentity, array $payload): array
    {
        $operationId = trim((string) ($payload['operation_id'] ?? ''));
        $fingerprint = trim((string) ($payload['preview_fingerprint'] ?? ''));
        $token = trim((string) ($payload['confirmation_token'] ?? ''));
        if ($operationId === '' || $fingerprint === '' || $token === '') {
            throw new SafeOperationDenied('Confirmacao de escopo incompleta.', 'missing_confirmation');
        }

        $this->db->beginTransaction();
        try {
            $run = $this->repository->find($operationId, true);
            $this->assertOwnedAndCurrent($run, $actorUserId, $sessionIdentity, $fingerprint, ['CONFIRMED', 'EXECUTED']);
            if ((string) ($run['status'] ?? '') === 'EXECUTED') {
                $this->db->commit();
                return $this->publicRun($run);
            }
            if (!hash_equals((string) ($run['confirmation_hash'] ?? ''), hash('sha256', $token))) {
                throw new SafeOperationDenied('Confirmacao invalida.', 'invalid_confirmation');
            }
            if (strtotime((string) ($run['confirmation_expires_at'] ?? '')) < time()) {
                throw new SafeOperationDenied('Confirmacao expirada. Gere um novo preview.', 'expired_confirmation');
            }

            $scope = json_decode((string) $run['target_scope_json'], true);
            $operationType = (string) $run['operation_type'];
            $namespace = SafeOperationPolicy::validateNamespace($scope['namespace'] ?? null);
            $currentSnapshot = $this->snapshot($operationType, $namespace);
            $currentFingerprint = $this->fingerprint($operationType, $scope, $currentSnapshot);
            if (!hash_equals((string) $run['preview_fingerprint'], $currentFingerprint)) {
                throw new SafeOperationDenied('O escopo mudou desde o preview. Gere um novo preview.', 'stale_preview');
            }

            $definition = SafeOperationPolicy::definition($operationType);
            if (!(bool) $definition['execution_allowed']) {
                throw new SafeOperationDenied('Esta operacao e somente de preview; reset amplo permanece proibido.', 'execution_prohibited');
            }
            if ($this->recoveryStatus($operationType) !== 'READY') {
                throw new SafeOperationDenied('Recuperacao operacional indisponivel.', 'recovery_unavailable');
            }

            $this->repository->update($operationId, ['status' => 'EXECUTING']);
            $actualCount = $this->apply($operationType, $namespace);
            $result = [
                'affected_count' => $actualCount,
                'postcondition' => $this->postcondition($operationType, $namespace),
            ];
            $this->repository->update($operationId, [
                'status' => 'EXECUTED',
                'actual_count' => $actualCount,
                'confirmation_hash' => null,
                'confirmation_expires_at' => null,
                'result_json' => SafeOperationPolicy::canonicalJson($result),
                'recovery_status' => 'READY',
            ]);
            $this->repository->appendAudit($actorUserId, 'safe_operation.execute', $operationId, $this->auditPayload($run, $currentSnapshot, 'EXECUTED', $result));
            $this->db->commit();

            return [
                'operation_id' => $operationId,
                'status' => 'EXECUTED',
                'actual_count' => $actualCount,
                'postcondition' => $result['postcondition'],
                'recovery_status' => 'READY',
            ];
        } catch (Throwable $exception) {
            if ($this->db->inTransaction()) {
                $this->db->rollBack();
            }
            throw $exception;
        }
    }

    /** @return list<array<string, mixed>> */
    public function history(string $actorUserId): array
    {
        return $this->repository->history($actorUserId);
    }

    public function cleanup(string $actorUserId, array $payload): int
    {
        return $this->repository->deleteSyntheticRuns($actorUserId, SafeOperationPolicy::validateNamespace($payload['namespace'] ?? null));
    }

    /** @return array<string, mixed> */
    private function snapshot(string $operationType, string $namespace): array
    {
        if ($operationType === 'global_reset.synthetic') {
            $tables = $this->db->query('SHOW TABLES')->fetchAll(PDO::FETCH_COLUMN) ?: [];
            $schemaGuard = DatasetResetPolicyV2::validateAgainstSchema(array_map('strval', $tables));
            return [
                'affected_count' => count(DatasetResetPolicyV2::resetTables()),
                'protected_domains' => DatasetResetPolicyV2::preserveManifest(),
                'schema_guard' => $schemaGuard,
                'schema_fingerprint' => $this->schemaFingerprint($tables),
                'execution' => 'PROHIBITED_IN_PRODUCTION',
            ];
        }

        $directory = $this->scopeDirectory($operationType, $namespace, false);
        $files = $this->boundedFiles($directory);
        $affected = [];
        foreach ($files as $file) {
            $name = basename($file);
            if ($operationType === 'cache.synthetic_expired_cleanup' && str_ends_with($name, '.cache')) {
                $data = json_decode((string) file_get_contents($file), true);
                if (is_array($data) && ($data['namespace'] ?? '') === $namespace && (int) ($data['expires'] ?? 0) < time()) {
                    $affected[] = $name;
                }
            } elseif ($operationType === 'logs.synthetic_rotation' && str_ends_with($name, '.log')) {
                $affected[] = $name;
            } elseif ($operationType === 'filesystem.synthetic_cleanup' && str_ends_with($name, '.tmp')) {
                $affected[] = $name;
            }
        }
        sort($affected);
        return [
            'affected_count' => count($affected),
            'affected_resources' => array_slice($affected, 0, self::MAX_FILES),
            'truncated' => count($affected) > self::MAX_FILES,
            'protected_resources' => ['non_matching_namespace', 'symlink', 'current_production_log', 'application_data'],
        ];
    }

    private function apply(string $operationType, string $namespace): int
    {
        $snapshot = $this->snapshot($operationType, $namespace);
        $directory = $this->scopeDirectory($operationType, $namespace, false);
        $count = 0;
        foreach (($snapshot['affected_resources'] ?? []) as $name) {
            $source = $directory . DIRECTORY_SEPARATOR . $name;
            if ($operationType === 'logs.synthetic_rotation') {
                $target = $source . '.archive';
                if (is_file($source) && !is_link($source) && rename($source, $target)) {
                    $count++;
                }
            } elseif (is_file($source) && !is_link($source) && unlink($source)) {
                $count++;
            }
        }
        return $count;
    }

    private function postcondition(string $operationType, string $namespace): array
    {
        return ['remaining_affected_count' => (int) ($this->snapshot($operationType, $namespace)['affected_count'] ?? 0)];
    }

    private function recoveryStatus(string $operationType): string
    {
        return $operationType === 'global_reset.synthetic' ? 'BLOCKED_BY_POLICY' : 'READY';
    }

    private function scopeDirectory(string $operationType, string $namespace, bool $create): string
    {
        $kind = match (true) {
            str_starts_with($operationType, 'cache.') => 'cache',
            str_starts_with($operationType, 'logs.') => 'logs',
            default => 'files',
        };
        $root = $this->rootDirectory !== '' ? $this->rootDirectory : __DIR__ . '/../../../storage/safe-operations';
        $root = rtrim($root, '/\\') . DIRECTORY_SEPARATOR . $kind;
        if ($create && !is_dir($root)) {
            mkdir($root, 0750, true);
        }
        $directory = $root . DIRECTORY_SEPARATOR . $namespace;
        if ($create && !is_dir($directory)) {
            mkdir($directory, 0750, true);
        }
        if (is_link($directory)) {
            throw new SafeOperationDenied('Escopo de filesystem invalido.', 'filesystem_boundary');
        }
        $realRoot = realpath($root);
        if ($realRoot !== false && str_contains(realpath($directory) ?: $directory, $realRoot . DIRECTORY_SEPARATOR) === false && $create) {
            throw new SafeOperationDenied('Escopo de filesystem invalido.', 'filesystem_boundary');
        }
        return $directory;
    }

    /** @return list<string> */
    private function boundedFiles(string $directory): array
    {
        if (!is_dir($directory)) {
            return [];
        }
        $files = glob($directory . DIRECTORY_SEPARATOR . '*') ?: [];
        if (count($files) > self::MAX_FILES) {
            throw new SafeOperationDenied('Escopo de filesystem excede o limite operacional.', 'boundedness');
        }
        foreach ($files as $file) {
            if (is_link($file)) {
                throw new SafeOperationDenied('Symlink recusado no escopo operacional.', 'symlink_escape');
            }
        }
        return array_values(array_filter($files, 'is_file'));
    }

    private function fingerprint(string $operationType, array $scope, array $snapshot): string
    {
        return hash('sha256', SafeOperationPolicy::canonicalJson([
            'operation_type' => $operationType,
            'scope' => $scope,
            'snapshot' => $snapshot,
        ]));
    }

    private function schemaFingerprint(array $tables): string
    {
        sort($tables);
        return hash('sha256', SafeOperationPolicy::canonicalJson(['tables' => $tables, 'policy' => DatasetResetPolicyV2::VERSION]));
    }

    private function assertOwnedAndCurrent(?array $run, string $actorUserId, string $sessionIdentity, string $fingerprint, array $statuses): void
    {
        if ($run === null) {
            throw new SafeOperationDenied('Operacao nao encontrada.', 'operation_not_found');
        }
        if ((string) $run['actor_user_id'] !== $actorUserId || !hash_equals((string) $run['actor_session_hash'], hash('sha256', $sessionIdentity))) {
            throw new SafeOperationDenied('Operacao fora do escopo da sessao.', 'operation_scope_denied');
        }
        if (!in_array((string) $run['status'], $statuses, true)) {
            throw new SafeOperationDenied('Estado da operacao nao permite esta transicao.', 'invalid_transition');
        }
        if (!hash_equals((string) $run['preview_fingerprint'], $fingerprint)) {
            throw new SafeOperationDenied('Fingerprint de preview invalida.', 'fingerprint_mismatch');
        }
        if (strtotime((string) $run['preview_expires_at']) < time()) {
            throw new SafeOperationDenied('Preview expirado. Gere um novo preview.', 'expired_preview');
        }
    }

    /** @return array<string, mixed> */
    private function decodedSnapshot(array $run): array
    {
        $decoded = json_decode((string) ($run['result_json'] ?? '{}'), true);
        return is_array($decoded['snapshot'] ?? null) ? $decoded['snapshot'] : [];
    }

    private function auditPayload(array $run, array $snapshot, ?string $result, ?array $outcome = null): array
    {
        return [
            'operation_id' => $run['operation_id'],
            'operation_type' => $run['operation_type'],
            'actor_user_id' => $run['actor_user_id'],
            'environment' => $run['environment'],
            'risk_class' => $run['risk_class'],
            'scope' => json_decode((string) $run['target_scope_json'], true),
            'namespace' => $run['namespace_key'],
            'dry_run' => true,
            'preview_fingerprint' => $run['preview_fingerprint'],
            'expected_count' => $run['expected_count'],
            'actual_count' => $outcome['affected_count'] ?? null,
            'result' => $result,
            'recovery_class' => $run['recovery_class'],
            'recovery_status' => $run['recovery_status'],
            'snapshot_summary' => [
                'affected_count' => $snapshot['affected_count'] ?? 0,
                'protected_resources' => $snapshot['protected_resources'] ?? [],
            ],
        ];
    }

    /** @return array<string, mixed> */
    private function publicRun(array $run): array
    {
        return [
            'operation_id' => $run['operation_id'],
            'operation_type' => $run['operation_type'],
            'status' => $run['status'],
            'namespace' => $run['namespace_key'],
            'preview_fingerprint' => $run['preview_fingerprint'],
            'preview_expires_at' => $run['preview_expires_at'],
            'expected_count' => (int) $run['expected_count'],
            'actual_count' => $run['actual_count'] === null ? null : (int) $run['actual_count'],
            'recovery_status' => $run['recovery_status'],
        ];
    }

    /** @return array<string, mixed> */
    private function publicPreview(array $run): array
    {
        $scope = json_decode((string) ($run['target_scope_json'] ?? '{}'), true);
        $scope = is_array($scope) ? $scope : [];
        $operationType = (string) ($run['operation_type'] ?? '');
        $definition = SafeOperationPolicy::definition($operationType);
        $result = json_decode((string) ($run['result_json'] ?? '{}'), true);
        $snapshot = is_array($result['snapshot'] ?? null) ? $result['snapshot'] : [
            'affected_count' => (int) ($run['expected_count'] ?? 0),
            'affected_resources' => [],
            'truncated' => false,
            'protected_resources' => ['non_matching_namespace', 'symlink', 'current_production_log', 'application_data'],
        ];

        return [
            'operation_id' => $run['operation_id'],
            'operation_type' => $operationType,
            'environment' => $run['environment'],
            'risk_class' => $run['risk_class'],
            'namespace' => (string) ($scope['namespace'] ?? $run['namespace_key']),
            'snapshot' => $snapshot,
            'preview_fingerprint' => $run['preview_fingerprint'],
            'preview_expires_at' => $run['preview_expires_at'],
            'confirmation_required' => true,
            'execution_allowed' => (bool) $definition['execution_allowed'],
            'recovery' => [
                'class' => $run['recovery_class'],
                'status' => $run['recovery_status'],
            ],
        ];
    }

    private function uuid(): string
    {
        $bytes = random_bytes(16);
        $bytes[6] = chr((ord($bytes[6]) & 0x0f) | 0x40);
        $bytes[8] = chr((ord($bytes[8]) & 0x3f) | 0x80);
        return vsprintf('%s%s-%s-%s-%s-%s%s%s', str_split(bin2hex($bytes), 4));
    }
}
