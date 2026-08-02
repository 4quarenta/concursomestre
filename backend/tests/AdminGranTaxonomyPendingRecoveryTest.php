<?php

declare(strict_types=1);

require_once dirname(__DIR__) . '/config/database.php';
require_once dirname(__DIR__) . '/modules/admin/services/AdminGranTaxonomySyncService.php';

function adminGranTaxonomyPendingRecoveryAssert(bool $condition, string $message): void
{
    if (!$condition) {
        throw new RuntimeException($message);
    }
}

$db = (new Database())->getConnection();
$db->exec('DROP TEMPORARY TABLE IF EXISTS filter_relationships');
$db->exec('DROP TEMPORARY TABLE IF EXISTS filter_aliases');
$db->exec('DROP TEMPORARY TABLE IF EXISTS filter_source_identities');
$db->exec('DROP TEMPORARY TABLE IF EXISTS filters');
$db->exec(
    'CREATE TEMPORARY TABLE filters (
        id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
        type VARCHAR(40) NOT NULL,
        name VARCHAR(255) NOT NULL,
        slug VARCHAR(255) NOT NULL,
        acronym VARCHAR(40) NULL,
        parent_id BIGINT UNSIGNED NULL,
        description TEXT NULL,
        website VARCHAR(1000) NULL,
        asset_url VARCHAR(1000) NULL,
        icon_key VARCHAR(120) NULL,
        keywords_json JSON NULL,
        meta_materia TINYINT(1) NOT NULL DEFAULT 0,
        taxonomy_level VARCHAR(20) NULL,
        meta_carreira TINYINT(1) NOT NULL DEFAULT 0,
        source_provider VARCHAR(40) NULL,
        source_entity_type VARCHAR(60) NULL,
        source_external_id VARCHAR(120) NULL,
        source_parent_external_id VARCHAR(120) NULL,
        source_root_external_id VARCHAR(120) NULL,
        meta_uf VARCHAR(2) NULL,
        meta_esfera VARCHAR(50) NULL,
        meta_oab TINYINT(1) NOT NULL DEFAULT 0,
        UNIQUE KEY uq_filters_type_slug (type, slug),
        UNIQUE KEY uq_filters_source_identity (
            source_provider,
            source_entity_type,
            source_external_id
        )
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4'
);
$db->exec(
    'CREATE TEMPORARY TABLE filter_aliases (
        id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
        filter_id BIGINT UNSIGNED NOT NULL,
        alias VARCHAR(255) NOT NULL,
        normalized_alias VARCHAR(255) NOT NULL,
        UNIQUE KEY uq_filter_alias (filter_id, normalized_alias)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4'
);
$db->exec(
    'CREATE TEMPORARY TABLE filter_source_identities (
        id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
        filter_id BIGINT UNSIGNED NOT NULL,
        filter_type VARCHAR(40) NOT NULL,
        source_provider VARCHAR(40) NOT NULL,
        source_entity_type VARCHAR(60) NOT NULL,
        source_external_id VARCHAR(120) NOT NULL,
        source_parent_external_id VARCHAR(120) NULL,
        source_root_external_id VARCHAR(120) NULL,
        source_metadata_json JSON NULL,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        UNIQUE KEY uq_filter_source_identity (
            filter_type, source_provider, source_entity_type, source_external_id
        )
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4'
);
$db->exec(
    'CREATE TEMPORARY TABLE filter_relationships (
        id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
        source_filter_id BIGINT UNSIGNED NOT NULL,
        target_filter_id BIGINT UNSIGNED NOT NULL,
        relation_type VARCHAR(60) NOT NULL,
        source_provider VARCHAR(40) NOT NULL DEFAULT \'platform\',
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        UNIQUE KEY uq_filter_relationship (
            source_filter_id, target_filter_id, relation_type, source_provider
        )
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4'
);

$insert = $db->prepare(
    "INSERT INTO filters (
        type, name, slug, taxonomy_level, source_provider, source_entity_type,
        source_external_id, source_parent_external_id, source_root_external_id
     ) VALUES (
        'assunto', :name, :slug, 'pending', 'gran', 'assunto',
        :external_id, '20', '10'
     )"
);
foreach ([
    ['name' => 'Auditoria Fiscal', 'slug' => 'auditoria-fiscal', 'external_id' => '201'],
    ['name' => 'Auditoria Privada', 'slug' => 'auditoria-privada', 'external_id' => '202'],
] as $row) {
    $insert->execute([
        ':name' => $row['name'],
        ':slug' => $row['slug'],
        ':external_id' => $row['external_id'],
    ]);
}

$catalogFetchCount = 0;
$requestedBatches = [];
$service = new AdminGranTaxonomySyncService(
    $db,
    static function (array $externalIds) use (&$catalogFetchCount, &$requestedBatches): array {
        $catalogFetchCount++;
        $requestedBatches[] = $externalIds;
        $rows = [];
        foreach ($externalIds as $externalId) {
            if ($externalId === '10') {
                $rows[] = ['id' => 10, 'nome' => 'Auditoria', 'pai' => null, 'assunto_raiz' => 10, 'materia' => true];
            }
            if ($externalId === '20') {
                // O pai intermediario revela um ancestral que exige a segunda rodada seletiva.
                $rows[] = ['id' => 20, 'nome' => 'Auditoria Governamental', 'pai' => 15, 'assunto_raiz' => 10];
            }
            if ($externalId === '15') {
                $rows[] = ['id' => 15, 'nome' => 'Fundamentos de Auditoria', 'pai' => 10, 'assunto_raiz' => 10];
            }
        }
        return [
            'data' => [
                'rows' => $rows,
            ],
        ];
    }
);
$before = $service->getMissingSubjectHierarchyExternalIds();
adminGranTaxonomyPendingRecoveryAssert($before === ['10', '20'], 'Somente a raiz e o pai ausentes devem ser detectados.');

$recovery = $service->recoverPendingSubjectHierarchyFromPublicCatalog();

adminGranTaxonomyPendingRecoveryAssert($recovery['requested'] === 3, 'Cada no ausente deve ser solicitado uma unica vez.');
adminGranTaxonomyPendingRecoveryAssert($recovery['found'] === 3, 'Raiz, pai e ancestral intermediario devem ser localizados.');
adminGranTaxonomyPendingRecoveryAssert($recovery['created'] === 3, 'Toda a cadeia ausente deve ser criada.');
adminGranTaxonomyPendingRecoveryAssert($recovery['unresolved'] === 0, 'A cadeia localizada nao pode permanecer pendente.');
adminGranTaxonomyPendingRecoveryAssert($catalogFetchCount === 2, 'A recuperacao deve usar uma consulta em lote por nivel ausente.');
adminGranTaxonomyPendingRecoveryAssert(
    $requestedBatches === [['10', '20'], ['15']],
    'A segunda rodada deve consultar somente o ancestral novo descoberto.'
);

$finalized = $service->finalizeSync();
adminGranTaxonomyPendingRecoveryAssert($finalized['total'] === 5, 'A conciliacao deve considerar toda a cadeia e os descendentes.');
adminGranTaxonomyPendingRecoveryAssert($finalized['resolved'] === 5, 'Toda a cadeia deve ser resolvida.');
adminGranTaxonomyPendingRecoveryAssert($finalized['pending'] === 0, 'Nenhuma pendencia real deve restar.');

$rows = $db->query(
    "SELECT source_external_id, parent_id, taxonomy_level, meta_materia
     FROM filters
     ORDER BY source_external_id"
)->fetchAll(PDO::FETCH_ASSOC);
$byExternalId = [];
foreach ($rows as $row) {
    $byExternalId[(string) $row['source_external_id']] = $row;
}

adminGranTaxonomyPendingRecoveryAssert(
    ($byExternalId['10']['taxonomy_level'] ?? null) === 'materia'
        && (int) ($byExternalId['10']['meta_materia'] ?? 0) === 1
        && ($byExternalId['10']['parent_id'] ?? null) === null,
    'A raiz deve ser persistida como materia sem pai.'
);
foreach (['201', '202'] as $externalId) {
    adminGranTaxonomyPendingRecoveryAssert(
        ($byExternalId[$externalId]['taxonomy_level'] ?? null) === 'assunto'
            && (int) ($byExternalId[$externalId]['parent_id'] ?? 0) > 0,
        'Descendente da cadeia recuperada deve ser vinculado no nivel correto.'
    );
}
adminGranTaxonomyPendingRecoveryAssert(
    ($byExternalId['15']['taxonomy_level'] ?? null) === 'topico'
        && ($byExternalId['20']['taxonomy_level'] ?? null) === 'subtopico',
    'Pais intermediarios devem preservar a profundidade oficial.'
);

$duplicateSync = $service->syncChunk('assunto_tree', [
    'data' => [
        'rows' => [
            ['id' => 301, 'nome' => 'Classificacao de Redes', 'pai' => 20, 'assunto_raiz' => 10],
            ['id' => 302, 'nome' => 'Classificacao de Redes', 'pai' => 20, 'assunto_raiz' => 10],
        ],
    ],
]);
adminGranTaxonomyPendingRecoveryAssert(
    $duplicateSync['created'] === 1 && $duplicateSync['updated'] === 1,
    'IDs externos equivalentes devem reutilizar uma unica taxonomia canonica.'
);

$duplicateFilterCount = (int) $db->query(
    "SELECT COUNT(*) FROM filters WHERE type = 'assunto' AND name = 'Classificacao de Redes'"
)->fetchColumn();
$duplicateIdentityCount = (int) $db->query(
    "SELECT COUNT(*) FROM filter_source_identities
     WHERE source_provider = 'gran' AND source_entity_type = 'assunto'
       AND source_external_id IN ('301', '302')"
)->fetchColumn();
adminGranTaxonomyPendingRecoveryAssert(
    $duplicateFilterCount === 1 && $duplicateIdentityCount === 2,
    'As duas identidades externas devem apontar para um unico filtro.'
);

$db->exec(
    "INSERT INTO filters (
        type, name, slug, taxonomy_level, source_provider, source_entity_type,
        source_external_id, source_parent_external_id, source_root_external_id
     ) VALUES (
        'assunto', 'Seguranca de Redes', 'seguranca-de-redes', 'pending', 'gran', 'assunto',
        '303', '302', '10'
     )"
);
adminGranTaxonomyPendingRecoveryAssert(
    $service->getMissingSubjectHierarchyExternalIds() === [],
    'Um filho que referencia a identidade secundaria nao pode gerar falsa pendencia.'
);
$aliasFinalized = $service->finalizeSync();
adminGranTaxonomyPendingRecoveryAssert(
    $aliasFinalized['pending'] === 0,
    'A identidade secundaria deve resolver a hierarquia do filho.'
);

$bankSync = $service->syncChunk('banca', [
    'data' => [
        'rows' => [[
            'id' => 9001,
            'nome' => 'Instituto Brasileiro de Formação e Capacitação',
            'sigla' => 'IBFC',
            'descricao' => 'Instituição organizadora de concursos e processos seletivos.',
            'site' => 'https://www.ibfc.org.br/',
            'logo' => ['url' => 'https://cdn.example.test/bancas/ibfc.png'],
            'aliases' => ['Instituto IBFC'],
            'qtdQuestoes' => 1200,
            'qtdProvas' => 80,
            'qtdConcursos' => 60,
            'qtdComentarios' => 900,
            'tiposProva' => [1, 2],
        ]],
    ],
]);
adminGranTaxonomyPendingRecoveryAssert(
    $bankSync['created'] === 1 && $bankSync['updated'] === 0,
    'A primeira sincronizacao da banca deve criar um cadastro canonico.'
);
$bank = $db->query(
    "SELECT name, acronym, description, website, asset_url, keywords_json
     FROM filters WHERE type = 'banca' AND source_external_id = '9001'"
)->fetch(PDO::FETCH_ASSOC);
adminGranTaxonomyPendingRecoveryAssert(
    is_array($bank)
        && ($bank['name'] ?? null) === 'Instituto Brasileiro de Formação e Capacitação'
        && ($bank['acronym'] ?? null) === 'IBFC'
        && ($bank['description'] ?? null) === 'Instituição organizadora de concursos e processos seletivos.'
        && ($bank['website'] ?? null) === 'https://www.ibfc.org.br/'
        && ($bank['asset_url'] ?? null) === 'https://cdn.example.test/bancas/ibfc.png',
    'A banca deve persistir nome completo, sigla, descricao, site e imagem quando a origem informar.'
);
$bankKeywords = json_decode((string) ($bank['keywords_json'] ?? '[]'), true);
$bankAliases = $db->query(
    "SELECT alias FROM filter_aliases
     WHERE filter_id = (SELECT id FROM filters WHERE type = 'banca' AND source_external_id = '9001')
     ORDER BY alias"
)->fetchAll(PDO::FETCH_COLUMN);
adminGranTaxonomyPendingRecoveryAssert(
    is_array($bankKeywords)
        && in_array('IBFC', $bankKeywords, true)
        && in_array('Instituto IBFC', $bankKeywords, true)
        && in_array('IBFC', $bankAliases, true)
        && in_array('Instituto IBFC', $bankAliases, true),
    'Sigla e aliases da banca devem permanecer pesquisaveis.'
);

$bankResync = $service->syncChunk('banca', [
    'data' => [
        'rows' => [[
            'id' => 9001,
            'nome' => 'IBFC',
            'sigla' => 'IBFC',
        ]],
    ],
]);
$bankAfterSparseSync = $db->query(
    "SELECT name, description, website, asset_url
     FROM filters WHERE type = 'banca' AND source_external_id = '9001'"
)->fetch(PDO::FETCH_ASSOC);
adminGranTaxonomyPendingRecoveryAssert(
    $bankResync['created'] === 0
        && $bankResync['updated'] === 1
        && ($bankAfterSparseSync['name'] ?? null) === 'Instituto Brasileiro de Formação e Capacitação'
        && ($bankAfterSparseSync['description'] ?? null) === 'Instituição organizadora de concursos e processos seletivos.'
        && ($bankAfterSparseSync['website'] ?? null) === 'https://www.ibfc.org.br/'
        && ($bankAfterSparseSync['asset_url'] ?? null) === 'https://cdn.example.test/bancas/ibfc.png',
    'Resposta parcial da origem nao pode apagar o nome completo nem metadados ja salvos.'
);

$service->syncBatch('carreira', [[
    'data' => ['rows' => [
        ['id' => 28, 'nome' => 'Outras', 'descricao' => 'Carreira generica oficial da origem.'],
        ['id' => 29, 'nome' => 'Seguranca Publica / Policias', 'descricao' => 'Carreira policial.', 'qtdProvasPorTipo' => ['1' => 30]],
        ['id' => 98, 'nome' => 'Seguranca Publica', 'descricao' => 'Carreira de seguranca publica.', 'qtdProvasPorTipo' => ['1' => 50, '2' => 10]],
    ]],
]]);
$service->syncBatch('orgao', [[
    'data' => ['rows' => [
        ['id' => 530, 'nome' => 'Policia Civil A', 'sigla' => 'PC-A', 'uf' => 'SP', 'esfera' => 'Estadual', 'qtdQuestoes' => 100],
        ['id' => 518, 'nome' => 'Policia Civil B', 'sigla' => 'PC-B', 'estado' => ['sigla' => 'RJ', 'regiao' => 'Sudeste']],
    ]],
]]);
$service->syncBatch('area', [[
    'data' => ['rows' => [[
        'id' => 5,
        'descricao' => 'Seguranca',
        'slug' => 'seguranca',
        'palavrasChave' => ['Policial', 'Seguranca Publica'],
        'index' => 'area-1.0.0-0',
    ]]],
]]);
$cargoSync = $service->syncBatch('cargo', [[
    'data' => ['rows' => [[
        'id' => 8487,
        'descricao' => 'Agente de Policia',
        'palavrasChave' => ['Agente de Policia'],
        'orgaos' => [530, 518],
        'niveis' => ['Superior', 'Fundamental', 'Medio'],
        'carreiras' => [
            ['nome' => 'Carreira ainda nao sincronizada', 'id' => 26],
            ['nome' => 'Seguranca Publica / Policias', 'id' => 29],
            ['nome' => 'Seguranca Publica', 'id' => 98],
        ],
        'tiposProva' => [2, 1],
        'qtdConcursos' => 21,
        'qtdProvas' => 23,
        'qtdQuestoes' => 1762,
        'qtdComentarios' => 1092,
        'slug' => 'agente-de-policia-8487',
        'index' => 'cargo-1.11.0-6',
    ], [
        'id' => 8488,
        'descricao' => 'Investigador de Policia',
        'orgaos' => [530],
        'niveis' => ['Superior'],
        'slug' => 'investigador-de-policia-8488',
    ]]],
]]);

$cargo = $db->query(
    "SELECT id, parent_id
     FROM filters
     WHERE type = 'cargo' AND source_external_id = '8487'"
)->fetch(PDO::FETCH_ASSOC);
$cargoParentExternalId = null;
if (is_array($cargo) && (int) ($cargo['parent_id'] ?? 0) > 0) {
    $parentStatement = $db->prepare('SELECT source_external_id FROM filters WHERE id = :id');
    $parentStatement->execute([':id' => (int) $cargo['parent_id']]);
    $cargoParentExternalId = $parentStatement->fetchColumn();
}
adminGranTaxonomyPendingRecoveryAssert(
    $cargoSync['pending'] === 0
        && is_array($cargo)
        && (string) $cargoParentExternalId === '29',
    'Cargo deve usar a primeira carreira oficial disponivel como raiz primaria.'
);
$fallbackCargoParentId = $db->query(
    "SELECT parent_id FROM filters
     WHERE type = 'cargo' AND source_external_id = '8488'"
)->fetchColumn();
$fallbackCargoParentExternalId = false;
if ((int) $fallbackCargoParentId > 0) {
    $fallbackParentStatement = $db->prepare(
        'SELECT source_external_id FROM filters WHERE id = :id'
    );
    $fallbackParentStatement->execute([':id' => (int) $fallbackCargoParentId]);
    $fallbackCargoParentExternalId = $fallbackParentStatement->fetchColumn();
}
adminGranTaxonomyPendingRecoveryAssert(
    (string) $fallbackCargoParentExternalId === '28',
    'Cargo sem carreiras na origem deve usar a carreira oficial Outras como raiz.'
);
$cargoRelationCounts = $db->query(
    "SELECT relation_type, COUNT(*) AS total
     FROM filter_relationships
     WHERE source_filter_id = (SELECT id FROM filters WHERE type = 'cargo' AND source_external_id = '8487')
     GROUP BY relation_type"
)->fetchAll(PDO::FETCH_KEY_PAIR);
adminGranTaxonomyPendingRecoveryAssert(
    (int) ($cargoRelationCounts['cargo_career'] ?? 0) === 2
        && (int) ($cargoRelationCounts['cargo_organization'] ?? 0) === 2
        && (int) ($cargoRelationCounts['cargo_level'] ?? 0) === 3,
    'Todas as carreiras, orgaos e niveis do cargo devem ser preservados como relacoes.'
);
$cargoMetadataJson = $db->query(
    "SELECT source_metadata_json FROM filter_source_identities
     WHERE source_provider = 'gran' AND source_entity_type = 'cargo' AND source_external_id = '8487'"
)->fetchColumn();
$cargoMetadata = json_decode((string) $cargoMetadataJson, true);
adminGranTaxonomyPendingRecoveryAssert(
    is_array($cargoMetadata)
        && ($cargoMetadata['questionCount'] ?? null) === 1762
        && ($cargoMetadata['examCount'] ?? null) === 23
        && ($cargoMetadata['organizationExternalIds'] ?? []) === ['530', '518']
        && ($cargoMetadata['careerExternalIds'] ?? []) === ['26', '29', '98'],
    'Metadados operacionais e relacoes externas do cargo devem permanecer auditaveis.'
);
$firstCargoChunk = $service->finalizeCargoRelationsChunk(0, 1);
$secondCargoChunk = $service->finalizeCargoRelationsChunk(
    (int) ($firstCargoChunk['nextCursor'] ?? 0),
    1
);
adminGranTaxonomyPendingRecoveryAssert(
    $firstCargoChunk['processed'] === 1
        && $firstCargoChunk['hasMore'] === true
        && (int) ($firstCargoChunk['nextCursor'] ?? 0) > 0
        && $secondCargoChunk['processed'] === 1
        && $secondCargoChunk['hasMore'] === false
        && $secondCargoChunk['pending'] === 0,
    'A reconciliacao de cargos deve avancar por cursor sem manter uma unica requisicao longa.'
);

$organization = $db->query(
    "SELECT acronym, meta_uf, meta_esfera FROM filters
     WHERE type = 'orgao' AND source_external_id = '530'"
)->fetch(PDO::FETCH_ASSOC);
adminGranTaxonomyPendingRecoveryAssert(
    is_array($organization)
        && ($organization['acronym'] ?? null) === 'PC-A'
        && ($organization['meta_uf'] ?? null) === 'SP'
        && ($organization['meta_esfera'] ?? null) === 'Estadual',
    'Orgao deve promover sigla, UF e esfera para os campos canonicos.'
);
$area = $db->query(
    "SELECT keywords_json FROM filters
     WHERE type = 'carreira' AND source_entity_type = 'area' AND source_external_id = '5'"
)->fetchColumn();
adminGranTaxonomyPendingRecoveryAssert(
    in_array('Seguranca Publica', json_decode((string) $area, true) ?: [], true),
    'Area da Gran deve virar foco local pesquisavel com suas palavras-chave.'
);
$bankMetadata = json_decode((string) $db->query(
    "SELECT source_metadata_json FROM filter_source_identities
     WHERE source_provider = 'gran' AND source_entity_type = 'banca' AND source_external_id = '9001'"
)->fetchColumn(), true);
adminGranTaxonomyPendingRecoveryAssert(
    is_array($bankMetadata)
        && ($bankMetadata['questionCount'] ?? null) === 1200
        && ($bankMetadata['examTypeExternalIds'] ?? []) === ['1', '2'],
    'Banca deve preservar contagens e tipos de prova informados pela origem.'
);

echo "AdminGranTaxonomyPendingRecoveryTest: PASS\n";
