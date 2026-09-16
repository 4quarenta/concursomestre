<?php

declare(strict_types=1);

/**
 * Allowlist server-side das operacoes administrativas sensiveis.
 * O cliente escolhe apenas uma chave desta lista; nunca fornece alvo bruto.
 */
final class SafeOperationPolicy
{
    public const ENVIRONMENT = 'production-prelaunch';

    /** @return array<string, array<string, mixed>> */
    public static function catalog(): array
    {
        return [
            'cache.synthetic_expired_cleanup' => [
                'label' => 'Limpar cache sintetico expirado',
                'risk_class' => 'SAFE_REBUILDABLE',
                'recovery_class' => 'REBUILDABLE',
                'target' => 'safe-operation cache fixture',
                'execution_allowed' => true,
            ],
            'logs.synthetic_rotation' => [
                'label' => 'Arquivar log sintetico',
                'risk_class' => 'SCOPED_DESTRUCTIVE',
                'recovery_class' => 'RESTORABLE',
                'target' => 'safe-operation log fixture',
                'execution_allowed' => true,
            ],
            'filesystem.synthetic_cleanup' => [
                'label' => 'Limpar arquivos temporarios sinteticos',
                'risk_class' => 'SCOPED_DESTRUCTIVE',
                'recovery_class' => 'REBUILDABLE',
                'target' => 'safe-operation filesystem fixture',
                'execution_allowed' => true,
            ],
            'global_reset.synthetic' => [
                'label' => 'Simular reset global protegido',
                'risk_class' => 'BROAD_DESTRUCTIVE_PROHIBITED',
                'recovery_class' => 'IRREVERSIBLE_PROHIBITED',
                'target' => 'database policy preview only',
                'execution_allowed' => false,
            ],
        ];
    }

    /** @return array<string, mixed> */
    public static function definition(string $operationType): array
    {
        $definition = self::catalog()[$operationType] ?? null;
        if (!is_array($definition)) {
            throw new SafeOperationDenied('Operacao administrativa nao autorizada.', 'unknown_operation');
        }

        return $definition;
    }

    public static function validateNamespace(mixed $namespace): string
    {
        $value = trim((string) $namespace);
        if (!preg_match('/^m20f06-[a-z0-9][a-z0-9-]{3,100}$/', $value)) {
            throw new SafeOperationDenied('Namespace sintetico invalido.', 'invalid_namespace');
        }

        return $value;
    }

    public static function canonicalJson(array $value): string
    {
        self::sortRecursively($value);
        return (string) json_encode($value, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE | JSON_THROW_ON_ERROR);
    }

    private static function sortRecursively(array &$value): void
    {
        foreach ($value as &$item) {
            if (is_array($item)) {
                self::sortRecursively($item);
            }
        }
        unset($item);
        if (array_keys($value) !== range(0, count($value) - 1)) {
            ksort($value);
        }
    }
}

final class SafeOperationDenied extends RuntimeException
{
    public function __construct(string $message, public readonly string $errorCode)
    {
        parent::__construct($message);
    }
}
