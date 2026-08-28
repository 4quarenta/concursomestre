<?php

/**
 * Consultas de leitura em lote da Lei Comentada.
 *
 * Mantem consultas relacionadas a artigos agrupadas sem acoplar o repository
 * persistente aos detalhes de carregamento das colecoes.
 */
final class LegalCommentaryArticleReadRepository
{
    private PDO $db;

    public function __construct(PDO $db)
    {
        $this->db = $db;
    }

    public function fetchArticleRows(int $lawId): array
    {
        $stmt = $this->db->prepare(
            "SELECT ar.*, COALESCE(ls.assunto_filter_id, ar.assunto_filter_id) AS effective_assunto_filter_id
             FROM law_articles ar
             LEFT JOIN law_sections ls ON ls.id = ar.section_id
             WHERE ar.law_id = :law_id
             ORDER BY ar.sort_order, ar.id"
        );
        $stmt->execute([':law_id' => $lawId]);
        return $stmt->fetchAll(PDO::FETCH_ASSOC);
    }

    public function fetchSectionRows(int $lawId): array
    {
        if ($lawId <= 0) {
            return [];
        }

        $stmt = $this->db->prepare(
            "SELECT *
             FROM law_sections
             WHERE law_id = :law_id
             ORDER BY sort_order, id"
        );
        $stmt->execute([':law_id' => $lawId]);

        return $stmt->fetchAll(PDO::FETCH_ASSOC) ?: [];
    }

    public function fetchSectionAssuntoFilterMap(int $lawId): array
    {
        if ($lawId <= 0) {
            return [];
        }

        $stmt = $this->db->prepare(
            "SELECT id, assunto_filter_id
             FROM law_sections
             WHERE law_id = :law_id"
        );
        $stmt->execute([':law_id' => $lawId]);

        $map = [];
        foreach ($stmt->fetchAll(PDO::FETCH_ASSOC) ?: [] as $row) {
            $map[(int) $row['id']] = $row['assunto_filter_id'] !== null ? (int) $row['assunto_filter_id'] : null;
        }

        return $map;
    }

    public function fetchArticleBlockRows(array $articleIds): array
    {
        if (empty($articleIds)) {
            return [];
        }

        $placeholders = implode(',', array_fill(0, count($articleIds), '?'));
        $stmt = $this->db->prepare(
            "SELECT *
             FROM law_article_blocks
             WHERE law_article_id IN ($placeholders)
             ORDER BY law_article_id, sort_order, id"
        );
        $stmt->execute($articleIds);

        return $stmt->fetchAll(PDO::FETCH_ASSOC) ?: [];
    }

    public function fetchRowsForArticles(string $table, array $articleIds): array
    {
        if (empty($articleIds)) {
            return [];
        }

        $placeholders = implode(',', array_fill(0, count($articleIds), '?'));
        $stmt = $this->db->prepare(
            "SELECT *
             FROM {$table}
             WHERE law_article_id IN ($placeholders)
             ORDER BY id"
        );
        $stmt->execute($articleIds);
        return $stmt->fetchAll(PDO::FETCH_ASSOC);
    }

    public function fetchSectionEditorialRows(int $lawId): array
    {
        if ($lawId <= 0) {
            return [];
        }

        $stmt = $this->db->prepare(
            "SELECT *
             FROM law_section_editorials
             WHERE law_id = :law_id
             ORDER BY id"
        );
        $stmt->execute([':law_id' => $lawId]);

        return $stmt->fetchAll(PDO::FETCH_ASSOC) ?: [];
    }

    public function fetchBatchArticleRows(int $lawId, array $articleIds = []): array
    {
        if ($lawId <= 0) {
            return [];
        }

        $params = [':law_id' => $lawId];
        $where = 'WHERE law_id = :law_id';

        if (!empty($articleIds)) {
            $articleIds = array_values(array_filter(array_map('intval', $articleIds), static fn ($id) => $id > 0));
            if (empty($articleIds)) {
                return [];
            }

            $placeholders = [];
            foreach ($articleIds as $index => $articleId) {
                $key = ':article_' . $index;
                $placeholders[] = $key;
                $params[$key] = $articleId;
            }

            $where .= ' AND id IN (' . implode(',', $placeholders) . ')';
        }

        $stmt = $this->db->prepare(
            "SELECT id, article_number, sort_order
             FROM law_articles
             {$where}
             ORDER BY sort_order, id"
        );
        $stmt->execute($params);

        return $stmt->fetchAll(PDO::FETCH_ASSOC) ?: [];
    }

    public function fetchGroupedRows(string $table, string $column, array $ids): array
    {
        if (empty($ids)) {
            return [];
        }

        $placeholders = implode(',', array_fill(0, count($ids), '?'));
        $stmt = $this->db->prepare(
            "SELECT *
             FROM {$table}
             WHERE {$column} IN ($placeholders)
             ORDER BY id"
        );
        $stmt->execute($ids);

        $groups = [];
        foreach ($stmt->fetchAll(PDO::FETCH_ASSOC) as $row) {
            $groups[(string) $row[$column]][] = $row;
        }

        return $groups;
    }

    public function groupRowsByColumn(array $rows, string $column): array
    {
        $groups = [];
        foreach ($rows as $row) {
            $groups[(string) ($row[$column] ?? '')][] = $row;
        }

        return $groups;
    }

    public function fetchLawUpdates(int $lawId): array
    {
        $stmt = $this->db->prepare(
            "SELECT *
             FROM law_updates
             WHERE law_id = :law_id
             ORDER BY changed_at DESC
             LIMIT 50"
        );
        $stmt->execute([':law_id' => $lawId]);
        return $stmt->fetchAll(PDO::FETCH_ASSOC);
    }


}
