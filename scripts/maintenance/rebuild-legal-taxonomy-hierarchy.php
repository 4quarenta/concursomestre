<?php

declare(strict_types=1);

/*
 * Reorganiza a taxonomia da Lei Comentada para:
 * Materia (filters.meta_materia=1) -> Topico (lei) -> Assunto (blocos de artigos).
 *
 * Uso:
 *   C:\xampp\php\php.exe scripts/maintenance/rebuild-legal-taxonomy-hierarchy.php
 *   CM_BACKEND_PATH=/caminho/backend C:\xampp\php\php.exe scripts/maintenance/rebuild-legal-taxonomy-hierarchy.php
 */

$backendPath = getenv('CM_BACKEND_PATH') ?: 'C:/xampp/htdocs/questao-pro-backend';
$databaseBootstrap = rtrim(str_replace('\\', '/', $backendPath), '/') . '/config/database.php';

if (!is_file($databaseBootstrap)) {
    throw new RuntimeException('Nao foi possivel localizar o backend em: ' . $databaseBootstrap);
}

require_once $databaseBootstrap;

$database = new Database();
$db = $database->getConnection();
$db->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);

function normalizeAreaToSubject(string $areaName): string
{
    $area = trim($areaName);
    $lower = mb_strtolower($area, 'UTF-8');

    return match ($lower) {
        'constitucional' => 'Direito Constitucional',
        'penal' => 'Direito Penal',
        'civil' => 'Direito Civil',
        'administrativo' => 'Direito Administrativo',
        'processual penal' => 'Direito Processual Penal',
        'processual civil' => 'Direito Processual Civil',
        'tributario', 'tributário' => 'Direito Tributário',
        'trabalho' => 'Direito do Trabalho',
        'legislacao especial', 'legislação especial' => 'Legislação Extravagante',
        default => str_starts_with($lower, 'direito ') ? $area : 'Direito ' . $area,
    };
}

function slugify(string $value): string
{
    $value = iconv('UTF-8', 'ASCII//TRANSLIT', $value) ?: $value;
    $value = strtolower((string) preg_replace('/[^A-Za-z0-9]+/', '-', $value));
    $value = trim($value, '-');

    return $value !== '' ? $value : 'lei-comentada';
}

function uniqueSlug(PDO $db, string $base): string
{
    $slug = $base;
    $suffix = 2;
    $stmt = $db->prepare('SELECT id FROM filters WHERE slug = :slug LIMIT 1');

    while (true) {
        $stmt->execute([':slug' => $slug]);
        if (!$stmt->fetchColumn()) {
            return $slug;
        }

        $slug = $base . '-' . $suffix;
        $suffix++;
    }
}

function findOrCreateFilter(PDO $db, string $name, ?int $parentId, bool $isMateria): int
{
    $name = trim($name);
    if ($name === '') {
        throw new RuntimeException('Nome de filtro vazio.');
    }

    if ($parentId === null) {
        $stmt = $db->prepare(
            "SELECT id
             FROM filters
             WHERE type = 'assunto'
               AND parent_id IS NULL
               AND LOWER(name) = LOWER(:name)
             LIMIT 1"
        );
        $stmt->execute([':name' => $name]);
    } else {
        $stmt = $db->prepare(
            "SELECT id
             FROM filters
             WHERE type = 'assunto'
               AND parent_id = :parent_id
               AND LOWER(name) = LOWER(:name)
             LIMIT 1"
        );
        $stmt->execute([
            ':parent_id' => $parentId,
            ':name' => $name,
        ]);
    }

    $existingId = (int) $stmt->fetchColumn();
    if ($existingId > 0) {
        return $existingId;
    }

    $slug = uniqueSlug($db, 'assunto-' . slugify($name));
    $insert = $db->prepare(
        "INSERT INTO filters (
            type,
            name,
            description,
            website,
            slug,
            parent_id,
            meta_uf,
            meta_esfera,
            meta_oab,
            meta_materia,
            meta_carreira
        ) VALUES (
            'assunto',
            :name,
            :description,
            NULL,
            :slug,
            :parent_id,
            NULL,
            NULL,
            0,
            :meta_materia,
            0
        )"
    );
    $insert->execute([
        ':name' => $name,
        ':description' => $isMateria
            ? 'Materia juridica criada automaticamente pela reorganizacao da Lei Comentada.'
            : 'Taxonomia juridica criada automaticamente pela reorganizacao da Lei Comentada.',
        ':slug' => $slug,
        ':parent_id' => $parentId,
        ':meta_materia' => $isMateria ? 1 : 0,
    ]);

    return (int) $db->lastInsertId();
}

function normalizeTopicText(string $value): string
{
    $value = trim((string) preg_replace('/\s+/u', ' ', $value));

    return $value !== '' ? $value : 'Disposições gerais';
}

function resolveAssuntoName(array $hierarchy, string $fallback): string
{
    foreach (['section', 'chapter', 'title', 'book', 'part'] as $key) {
        $value = trim((string) ($hierarchy[$key] ?? ''));
        if ($value !== '') {
            return normalizeTopicText($value);
        }
    }

    foreach (['sectionLabel', 'chapterLabel', 'titleLabel', 'bookLabel', 'partLabel'] as $key) {
        $value = trim((string) ($hierarchy[$key] ?? ''));
        if ($value !== '') {
            return normalizeTopicText($value);
        }
    }

    return normalizeTopicText($fallback);
}

function buildLawTopicName(string $shortTitle, string $year): string
{
    $shortTitle = trim($shortTitle);
    $year = trim($year);

    if ($shortTitle === '') {
        return 'Lei';
    }

    if ($year !== '' && !str_contains($shortTitle, $year)) {
        return $shortTitle . ' de ' . $year;
    }

    return $shortTitle;
}

$lawsStmt = $db->query(
    "SELECT l.id, l.short_title, l.law_year, a.name AS area_name
     FROM laws l
     INNER JOIN legal_areas a ON a.id = l.legal_area_id
     ORDER BY l.id"
);
$laws = $lawsStmt->fetchAll(PDO::FETCH_ASSOC) ?: [];

$articlesStmt = $db->prepare(
    "SELECT id, hierarchy_json
     FROM law_articles
     WHERE law_id = :law_id
     ORDER BY sort_order, id"
);
$updateStmt = $db->prepare(
    "UPDATE law_articles
     SET subject_filter_id = :subject_filter_id,
         topic_filter_id = :topic_filter_id
     WHERE id = :id"
);

$updatedArticles = 0;

foreach ($laws as $law) {
    $subjectName = normalizeAreaToSubject((string) ($law['area_name'] ?? ''));
    $subjectId = findOrCreateFilter($db, $subjectName, null, true);

    $lawTopicName = buildLawTopicName((string) ($law['short_title'] ?? ''), (string) ($law['law_year'] ?? ''));
    $lawTopicId = findOrCreateFilter($db, $lawTopicName, $subjectId, false);

    $articlesStmt->execute([':law_id' => (int) $law['id']]);
    $articles = $articlesStmt->fetchAll(PDO::FETCH_ASSOC) ?: [];

    foreach ($articles as $article) {
        $hierarchy = json_decode((string) ($article['hierarchy_json'] ?? ''), true);
        if (!is_array($hierarchy)) {
            $hierarchy = [];
        }

        $assuntoName = resolveAssuntoName($hierarchy, 'Disposições gerais');
        $assuntoId = findOrCreateFilter($db, $assuntoName, $lawTopicId, false);

        $updateStmt->execute([
            ':subject_filter_id' => $lawTopicId,
            ':topic_filter_id' => $assuntoId,
            ':id' => (int) $article['id'],
        ]);
        $updatedArticles++;
    }
}

echo 'OK: leis processadas=' . count($laws) . ', artigos atualizados=' . $updatedArticles . PHP_EOL;
