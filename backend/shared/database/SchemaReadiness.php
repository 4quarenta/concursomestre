<?php

declare(strict_types=1);

/**
 * Verificacao somente leitura usada pelos repositorios depois da retirada de
 * DDL runtime. O diagnostico aponta o comando CLI de migration necessario.
 */
final class SchemaReadiness
{
    public static function assertTablesAndColumns(PDO $db, string $operation, array $requirements): void
    {
        $cacheKey = $operation . ':' . hash('sha256', serialize($requirements));
        static $validated = [];
        if (isset($validated[$cacheKey])) {
            return;
        }

        foreach ($requirements as $table => $columns) {
            self::assertIdentifier($table);
            $tableStmt = $db->prepare(
                'SELECT COUNT(*)
                 FROM information_schema.TABLES
                 WHERE TABLE_SCHEMA = DATABASE()
                   AND TABLE_NAME = :table_name'
            );
            $tableStmt->execute([':table_name' => $table]);
            if ((int) $tableStmt->fetchColumn() === 0) {
                throw new RuntimeException(self::message($operation, 'Tabela ausente: ' . $table));
            }

            foreach ($columns as $column) {
                self::assertIdentifier($column);
                $columnStmt = $db->prepare(
                    'SELECT COUNT(*)
                     FROM information_schema.COLUMNS
                     WHERE TABLE_SCHEMA = DATABASE()
                       AND TABLE_NAME = :table_name
                       AND COLUMN_NAME = :column_name'
                );
                $columnStmt->execute([
                    ':table_name' => $table,
                    ':column_name' => $column,
                ]);
                if ((int) $columnStmt->fetchColumn() === 0) {
                    throw new RuntimeException(self::message($operation, 'Coluna ausente: ' . $table . '.' . $column));
                }
            }
        }

        $validated[$cacheKey] = true;
    }

    private static function message(string $operation, string $detail): string
    {
        return 'Schema indisponivel para ' . $operation . '. ' . $detail
            . '. Execute via CLI: php backend/scripts/migrations/run_schema_migrations.php --apply';
    }

    private static function assertIdentifier(string $value): void
    {
        if (preg_match('/^[a-z0-9_]+$/i', $value) !== 1) {
            throw new InvalidArgumentException('Identificador de schema invalido.');
        }
    }
}
