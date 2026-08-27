<?php

declare(strict_types=1);

final class AnalyticsDatasetStateRepository
{
    private const REQUIRED_ROOT_TABLES = ['questions', 'filters', 'provas'];
    private const CANONICAL_ROOT_TABLES = [
        'questions',
        'filters',
        'provas',
        'contests',
        'public_simulations',
        'materials',
        'laws',
        'blog_articles',
    ];

    public function __construct(private readonly PDO $db)
    {
    }

    public function isCanonicalDatasetEmpty(): bool
    {
        $placeholders = implode(',', array_fill(0, count(self::CANONICAL_ROOT_TABLES), '?'));
        $stmt = $this->db->prepare(
            'SELECT TABLE_NAME
               FROM information_schema.TABLES
              WHERE TABLE_SCHEMA = DATABASE()
                AND TABLE_NAME IN (' . $placeholders . ')'
        );
        $stmt->execute(self::CANONICAL_ROOT_TABLES);
        $existing = array_map('strval', $stmt->fetchAll(PDO::FETCH_COLUMN) ?: []);
        if (array_diff(self::REQUIRED_ROOT_TABLES, $existing) !== []) {
            return false;
        }

        foreach ($existing as $table) {
            if (!in_array($table, self::CANONICAL_ROOT_TABLES, true)) {
                throw new RuntimeException('Unexpected canonical dataset table.');
            }
            $hasRows = (int) $this->db->query(
                'SELECT EXISTS(SELECT 1 FROM `' . $table . '` LIMIT 1)'
            )->fetchColumn();
            if ($hasRows === 1) {
                return false;
            }
        }

        return true;
    }
}
