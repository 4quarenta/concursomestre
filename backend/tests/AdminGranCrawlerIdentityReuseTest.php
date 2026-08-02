<?php

declare(strict_types=1);

require_once dirname(__DIR__) . '/modules/admin/services/AdminGranCrawlerService.php';

function granIdentityReuseAssert(bool $condition, string $message): void
{
    if (!$condition) {
        throw new RuntimeException($message);
    }
}

if (!in_array('sqlite', PDO::getAvailableDrivers(), true)) {
    fwrite(STDOUT, "AdminGranCrawlerIdentityReuseTest: SKIP (pdo_sqlite indisponivel)\n");
    exit(0);
}

$db = new PDO('sqlite::memory:');
$db->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
$db->exec(
    'CREATE TABLE filters (
        id INTEGER PRIMARY KEY,
        type TEXT NOT NULL,
        name TEXT NOT NULL,
        slug TEXT NOT NULL,
        taxonomy_level TEXT NULL,
        parent_id INTEGER NULL,
        source_provider TEXT NULL,
        source_entity_type TEXT NULL,
        source_external_id TEXT NULL,
        source_parent_external_id TEXT NULL,
        source_root_external_id TEXT NULL
    )'
);
$db->exec(
    'CREATE TABLE filter_source_identities (
        filter_id INTEGER NOT NULL,
        filter_type TEXT NOT NULL,
        source_provider TEXT NOT NULL,
        source_entity_type TEXT NOT NULL,
        source_external_id TEXT NOT NULL,
        source_parent_external_id TEXT NULL,
        source_root_external_id TEXT NULL
    )'
);
$db->exec(
    'CREATE TABLE questions (
        id INTEGER PRIMARY KEY,
        source_provider TEXT NULL,
        source_external_id TEXT NULL,
        publish_status TEXT NULL,
        visibility_status TEXT NULL
    )'
);
$db->exec(
    'CREATE TABLE provas (
        id INTEGER PRIMARY KEY,
        source_provider TEXT NULL,
        source_external_id TEXT NULL,
        status_editorial TEXT NULL,
        visibility_status TEXT NULL
    )'
);

$filters = [
    [101, 'assunto', 'Informatica', 'informatica', 'materia', null, '405030', null, '405030'],
    [102, 'assunto', 'Pacotes de Escritorio', 'pacotes-de-escritorio', 'topico', 101, '405107', '405030', '405030'],
    [103, 'assunto', 'Microsoft Excel', 'microsoft-excel', 'assunto', 102, '405118', '405107', '405030'],
    [201, 'banca', 'Instituto Brasileiro de Formacao', 'ibfc', null, null, '44', null, null],
    [202, 'orgao', 'Policia Militar da Paraiba', 'pm-pb', null, null, '530', null, null],
    [203, 'cargo', 'Soldado', 'soldado', null, null, '8487', null, null],
    [204, 'carreira', 'Policial', 'policial', null, null, '31', null, null],
];
$insertFilter = $db->prepare(
    'INSERT INTO filters (id, type, name, slug, taxonomy_level, parent_id)
     VALUES (:id, :type, :name, :slug, :taxonomy_level, :parent_id)'
);
$insertIdentity = $db->prepare(
    'INSERT INTO filter_source_identities (
        filter_id, filter_type, source_provider, source_entity_type,
        source_external_id, source_parent_external_id, source_root_external_id
     ) VALUES (
        :filter_id, :filter_type, :source_provider, :source_entity_type,
        :source_external_id, :source_parent_external_id, :source_root_external_id
     )'
);
foreach ($filters as [$id, $type, $name, $slug, $level, $parentId, $externalId, $externalParentId, $externalRootId]) {
    $insertFilter->execute([
        ':id' => $id,
        ':type' => $type,
        ':name' => $name,
        ':slug' => $slug,
        ':taxonomy_level' => $level,
        ':parent_id' => $parentId,
    ]);
    $entityType = match ($type) {
        'carreira' => 'area',
        default => $type,
    };
    $insertIdentity->execute([
        ':filter_id' => $id,
        ':filter_type' => $type,
        ':source_provider' => 'gran',
        ':source_entity_type' => $entityType,
        ':source_external_id' => $externalId,
        ':source_parent_external_id' => $externalParentId,
        ':source_root_external_id' => $externalRootId,
    ]);
}

$db->exec(
    "INSERT INTO questions (id, source_provider, source_external_id, publish_status, visibility_status)
     VALUES (9001, 'gran', '991', 'published', 'public')"
);
$db->exec(
    "INSERT INTO provas (id, source_provider, source_external_id, status_editorial, visibility_status)
     VALUES (7001, 'gran', '501', 'published', 'public')"
);

$service = new AdminGranCrawlerService($db);
$result = $service->mapBrowserResponse([
    'granRequestUrl' => 'https://rota-api.grancursosonline.com.br/v1/elastic/questao?perPage=100&page=1',
    'granResponse' => [
        'data' => [
            'total' => 1,
            'rows' => [[
                'id_questao' => 991,
                'numero_questao' => 12,
                'enunciado' => 'Assinale a alternativa correta.',
                'itens' => [
                    ['id' => 1, 'corpo' => 'Alternativa A'],
                    ['id' => 2, 'corpo' => 'Alternativa B'],
                ],
                'resposta' => 1,
                // O provedor pode enviar somente IDs. Os nomes e a hierarquia
                // precisam vir do cadastro canonico ja sincronizado.
                'assuntos' => [405118, 405107, 405030],
                'banca' => ['id' => 44, 'sigla' => 'IBFC'],
                'orgao' => ['id' => 530, 'sigla' => 'PM-PB'],
                'cargo' => ['id' => 8487, 'descricao' => 'Soldado'],
                'area' => ['id' => 31, 'nome' => 'Policial'],
                'provas' => [[
                    'id' => 501,
                    'nome' => 'IBFC - 2024 - PM-PB - Soldado',
                    'ano' => 2024,
                    'banca' => ['id' => 44, 'sigla' => 'IBFC'],
                    'orgaos' => [['id' => 530, 'sigla' => 'PM-PB']],
                    'cargos' => [['id' => 8487, 'descricao' => 'Soldado']],
                ]],
            ]],
        ],
    ],
]);

$payload = $result['payloads'][0] ?? [];
$question = $payload['questions'][0] ?? [];
$filtersPayload = $question['filters'] ?? [];

granIdentityReuseAssert(($payload['exam']['id'] ?? null) === 7001, 'A prova Gran existente deve reutilizar o ID local.');
granIdentityReuseAssert(($question['id'] ?? null) === 9001, 'A questao Gran existente deve reutilizar o ID local.');
granIdentityReuseAssert(($question['source']['examId'] ?? null) === 7001, 'A questao deve apontar para a prova local existente.');
granIdentityReuseAssert(($question['source']['alreadyPublished'] ?? null) === true, 'Questao publicada deve ser marcada para a fila oculta.');
granIdentityReuseAssert(($question['publication']['status'] ?? null) === 'published', 'Status publicado existente deve ser preservado.');
granIdentityReuseAssert(($filtersPayload['subjects'][0]['id'] ?? null) === 101, 'Materia deve reutilizar a identidade local.');
granIdentityReuseAssert(($filtersPayload['subjects'][0]['label'] ?? null) === 'Informatica', 'Nome canonico da materia deve prevalecer sobre o ID cru.');
granIdentityReuseAssert(($filtersPayload['topics'][0]['id'] ?? null) === 102, 'Topico deve reutilizar a identidade local.');
granIdentityReuseAssert(($filtersPayload['subtopics'][0]['id'] ?? null) === 103, 'Assunto deve reutilizar a identidade local.');
granIdentityReuseAssert(($filtersPayload['examBoards'][0]['id'] ?? null) === 201, 'Banca deve reutilizar a identidade local.');
granIdentityReuseAssert(($filtersPayload['organizations'][0]['id'] ?? null) === 202, 'Orgao deve reutilizar a identidade local.');
granIdentityReuseAssert(($filtersPayload['roles'][0]['id'] ?? null) === 203, 'Cargo deve reutilizar a identidade local.');
granIdentityReuseAssert(($filtersPayload['careers'][0]['id'] ?? null) === 204, 'Foco deve reutilizar a identidade local.');

fwrite(STDOUT, "AdminGranCrawlerIdentityReuseTest: PASS\n");
