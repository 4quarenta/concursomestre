<?php

declare(strict_types=1);

/** Persistencia sem DDL para a maquina de estados de SafeOperation. */
final class SafeOperationRepository
{
    public function __construct(private readonly PDO $db)
    {
    }

    public function insert(array $run): void
    {
        $statement = $this->db->prepare(
            'INSERT INTO safe_operation_runs
                (operation_id, operation_type, actor_user_id, actor_session_hash, environment, risk_class,
                 target_scope_json, namespace_key, dry_run, preview_fingerprint, preview_expires_at,
                 idempotency_hash, status, expected_count, recovery_class, recovery_status, result_json)
             VALUES
                (:operation_id, :operation_type, :actor_user_id, :actor_session_hash, :environment, :risk_class,
                 :target_scope_json, :namespace_key, 1, :preview_fingerprint, :preview_expires_at,
                 :idempotency_hash, :status, :expected_count, :recovery_class, :recovery_status, :result_json)'
        );
        $statement->execute([
            ':operation_id' => $run['operation_id'],
            ':operation_type' => $run['operation_type'],
            ':actor_user_id' => $run['actor_user_id'],
            ':actor_session_hash' => $run['actor_session_hash'],
            ':environment' => $run['environment'],
            ':risk_class' => $run['risk_class'],
            ':target_scope_json' => $run['target_scope_json'],
            ':namespace_key' => $run['namespace_key'],
            ':preview_fingerprint' => $run['preview_fingerprint'],
            ':preview_expires_at' => $run['preview_expires_at'],
            ':idempotency_hash' => $run['idempotency_hash'],
            ':status' => $run['status'],
            ':expected_count' => $run['expected_count'],
            ':recovery_class' => $run['recovery_class'],
            ':recovery_status' => $run['recovery_status'],
            ':result_json' => $run['result_json'],
        ]);
    }

    public function find(string $operationId, bool $forUpdate = false): ?array
    {
        $sql = 'SELECT * FROM safe_operation_runs WHERE operation_id = :operation_id LIMIT 1';
        if ($forUpdate) {
            $sql .= ' FOR UPDATE';
        }
        $statement = $this->db->prepare($sql);
        $statement->execute([':operation_id' => $operationId]);
        $row = $statement->fetch(PDO::FETCH_ASSOC);
        return is_array($row) ? $row : null;
    }

    public function findByIdempotency(string $actorUserId, string $idempotencyHash): ?array
    {
        $statement = $this->db->prepare(
            'SELECT * FROM safe_operation_runs
             WHERE actor_user_id = :actor_user_id AND idempotency_hash = :idempotency_hash LIMIT 1'
        );
        $statement->execute([':actor_user_id' => $actorUserId, ':idempotency_hash' => $idempotencyHash]);
        $row = $statement->fetch(PDO::FETCH_ASSOC);
        return is_array($row) ? $row : null;
    }

    public function update(string $operationId, array $fields): void
    {
        $allowed = [
            'status', 'confirmation_hash', 'confirmation_expires_at', 'actual_count',
            'result_json', 'error_code', 'recovery_status',
        ];
        $sets = [];
        $params = [':operation_id' => $operationId];
        foreach ($fields as $field => $value) {
            if (!in_array($field, $allowed, true)) {
                throw new InvalidArgumentException('Campo de operacao nao permitido.');
            }
            $sets[] = "`{$field}` = :{$field}";
            $params[":{$field}"] = $value;
        }
        if ($sets === []) {
            return;
        }
        $statement = $this->db->prepare('UPDATE safe_operation_runs SET ' . implode(', ', $sets) . ' WHERE operation_id = :operation_id');
        $statement->execute($params);
    }

    /** @return list<array<string, mixed>> */
    public function history(string $actorUserId, int $limit = 50): array
    {
        $statement = $this->db->prepare(
            'SELECT operation_id, operation_type, environment, risk_class, namespace_key, status,
                    expected_count, actual_count, recovery_class, recovery_status,
                    preview_expires_at, created_at, updated_at
             FROM safe_operation_runs
             WHERE actor_user_id = :actor_user_id
             ORDER BY created_at DESC LIMIT ' . max(1, min(50, $limit))
        );
        $statement->execute([':actor_user_id' => $actorUserId]);
        return $statement->fetchAll(PDO::FETCH_ASSOC) ?: [];
    }

    public function deleteSyntheticRuns(string $actorUserId, string $namespace): int
    {
        $statement = $this->db->prepare(
            "DELETE FROM safe_operation_runs
             WHERE actor_user_id = :actor_user_id
               AND namespace_key = :namespace_key
               AND status <> 'EXECUTING'"
        );
        $statement->execute([':actor_user_id' => $actorUserId, ':namespace_key' => $namespace]);
        return $statement->rowCount();
    }

    public function appendAudit(string $actorUserId, string $action, string $operationId, array $details): void
    {
        if (preg_match('/password|token|secret|credential|authorization/i', json_encode($details) ?: '') === 1) {
            throw new RuntimeException('Detalhe sensivel recusado no audit.');
        }
        $statement = $this->db->prepare(
            'INSERT INTO admin_audit_logs
                (admin_user_id, action, resource_type, resource_id, details_json, ip_address, user_agent, created_at)
             VALUES (:admin_user_id, :action, :resource_type, :resource_id, :details_json, :ip_address, :user_agent, NOW())'
        );
        $statement->execute([
            ':admin_user_id' => $actorUserId,
            ':action' => $action,
            ':resource_type' => 'safe_operation',
            ':resource_id' => $operationId,
            ':details_json' => SafeOperationPolicy::canonicalJson($details),
            ':ip_address' => function_exists('getAuthClientIp') ? getAuthClientIp() : null,
            ':user_agent' => function_exists('getAuthUserAgent') ? getAuthUserAgent() : null,
        ]);
    }
}
