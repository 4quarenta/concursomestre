<?php

declare(strict_types=1);

require_once dirname(__DIR__) . '/modules/admin/services/AdminGranCrawlerService.php';

function granCrawlerAssert(bool $condition, string $message): void
{
    if (!$condition) {
        throw new RuntimeException($message);
    }
}

final class AdminGranCrawlerTestPdo extends PDO
{
    public function __construct()
    {
    }
}

$remotePayload = [
    'data' => [
        'total' => 2,
        'pages' => 1,
        'rows' => [[
            'id_questao' => 991,
            'numero_questao' => 12,
            'enunciado' => '<p>Assinale a opcao correta. <img src="/media/enunciado.png"></p><script>alert(1)</script>',
            'enunciado_clean' => 'Assinale a opcao correta.',
            'hasImage' => true,
            'textos_questao' => [[
                'texto' => '<p>Texto de apoio. <img src="/media/apoio.png"></p>',
            ]],
            'itens' => [
                ['id' => 10, 'corpo' => 'Alternativa A'],
                [
                    'id' => 11,
                    'corpo' => 'Alternativa B <img src="/media/alternativa-b.png">',
                    'is_correto' => true,
                ],
            ],
            'resposta' => 11,
            'materia_questao' => 'Lingua Portuguesa',
            'topicos' => [['nome' => 'Interpretacao de textos']],
            'assuntos' => [[
                'nome' => 'Inferencia',
                'taxonomyLevel' => 'assunto',
            ]],
            'area' => ['id' => 31, 'nome' => 'Educacao'],
            'provas' => [[
                'prova' => [
                    'id' => 501,
                    'titulo' => 'IBFC - 2024 - PM-PB - Soldado',
                    'banca' => ['sigla' => 'IBFC'],
                    'orgaos' => [['sigla' => 'PM-PB']],
                    'cargos' => [['nome' => 'Soldado']],
                    'carreiras' => [['nome' => 'Policial']],
                    'ano' => 2024,
                    'nivel' => ['nome' => 'Medio'],
                    'tipo_prova' => ['nome' => 'Concurso'],
                ],
            ]],
            'grupo_questao' => [
                'id' => 77,
                'enunciado' => 'Texto para as questoes 12 e 13.',
                'texto' => '<p>Contexto compartilhado. <img src="/media/contexto.png"></p>',
            ],
        ], [
            'id_questao' => 992,
            'numero_questao' => 4,
            'enunciado' => '<p>Calcule o valor solicitado.</p>',
            'enunciado_clean' => 'Calcule o valor solicitado.',
            'hasImage' => true,
            'itens' => [
                ['id' => 20, 'rotulo' => 'A', 'corpo' => '10'],
                ['id' => 21, 'rotulo' => 'B', 'corpo' => '20'],
            ],
            'resposta_correta' => 'A',
            'materia_questao' => 'Matematica',
            'topicos_questao' => [['nome' => 'Aritmetica']],
            'assuntos' => [['nome' => 'Porcentagem']],
            'area' => ['nome' => 'Engenharia'],
            'provas' => [[
                'id' => 601,
                'nome' => 'FGV - 2023 - CBMERJ - Oficial',
                'bancas' => [['sigla' => 'FGV']],
                'orgaos' => [['sigla' => 'CBMERJ']],
                'cargos' => [['nome' => 'Oficial']],
                'carreiras' => [['nome' => 'Bombeiro Militar']],
                'ano' => 2023,
                'escolaridade' => ['nome' => 'Superior'],
            ]],
        ]],
    ],
];

$observedUrl = '';
$observedToken = '';
$observedClientId = '';
$encodeJwtPart = static fn (array $value): string => rtrim(strtr(
    base64_encode((string) json_encode($value, JSON_UNESCAPED_SLASHES)),
    '+/',
    '-_'
), '=');
$testToken = $encodeJwtPart(['alg' => 'RS256', 'typ' => 'JWT'])
    . '.'
    . $encodeJwtPart(['id' => 'gran-client-test', 'exp' => time() + 3600])
    . '.test-signature';
$service = new AdminGranCrawlerService(
    new AdminGranCrawlerTestPdo(),
    static function (string $url, string $token, string $clientId) use (
        &$observedUrl,
        &$observedToken,
        &$observedClientId,
        $remotePayload
    ): array {
        $observedUrl = $url;
        $observedToken = $token;
        $observedClientId = $clientId;
        return [
            'status' => 200,
            'body' => json_encode($remotePayload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES),
        ];
    }
);

$result = $service->fetchPage([
    'granAccessToken' => 'Bearer ' . $testToken,
    'page' => 1,
    'perPage' => 20,
    'year' => '2024',
]);

granCrawlerAssert(
    str_starts_with($observedUrl, 'https://rota-api.grancursosonline.com.br/v1/elastic/questao?'),
    'A consulta deve usar somente o endpoint conhecido da Gran.'
);
granCrawlerAssert($observedToken === $testToken, 'O prefixo Bearer duplicado deve ser removido.');
granCrawlerAssert($observedClientId === 'gran-client-test', 'O x-client-id deve vir do JWT da Gran.');
$payloads = $result['payloads'] ?? [];
granCrawlerAssert($result['questionCount'] === 2, 'Contagem total das questoes mapeadas esta incorreta.');
granCrawlerAssert(count($payloads) === 2, 'Questoes de provas diferentes devem gerar lotes independentes.');
granCrawlerAssert($payloads[0]['schemaVersion'] === 'question-import.v2', 'Contrato canonico ausente.');
granCrawlerAssert(count($payloads[0]['questions']) === 1, 'Questao da primeira prova nao foi mapeada.');
granCrawlerAssert(count($payloads[0]['contexts']) === 1, 'Contexto compartilhado nao foi mapeado.');
granCrawlerAssert(
    $payloads[0]['questions'][0]['answer']['raw'] === 'B',
    'Gabarito remoto nao foi associado a alternativa canonica.'
);
granCrawlerAssert(
    !str_contains($payloads[0]['questions'][0]['content']['statement'], '<script'),
    'Conteudo executavel nao pode chegar ao importador.'
);
granCrawlerAssert(
    $payloads[0]['questions'][0]['content']['statementClean'] === 'Assinale a opcao correta.',
    'O enunciado limpo fornecido pela Gran deve prevalecer no contrato canonico.'
);
granCrawlerAssert(
    $payloads[0]['questions'][0]['publication']['status'] === 'draft'
    && $payloads[0]['questions'][0]['review']['required'] === true,
    'Coleta externa deve chegar como rascunho sujeito a revisao.'
);
granCrawlerAssert(
    $payloads[0]['exam']['title'] === 'IBFC - 2024 - PM-PB - Soldado'
    && $payloads[1]['exam']['title'] === 'FGV - 2023 - CBMERJ - Oficial',
    'Cada lote deve preservar a prova real informada pela Gran.'
);
granCrawlerAssert(
    ($payloads[0]['exam']['provider'] ?? null) === 'gran'
    && (string) ($payloads[0]['exam']['externalId'] ?? '') === '501',
    'A prova deve preservar provider e externalId da Gran para idempotencia.'
);
granCrawlerAssert(
    ($payloads[0]['questions'][0]['source']['provider'] ?? null) === 'gran'
    && (string) ($payloads[0]['questions'][0]['source']['externalId'] ?? '') === '991',
    'A questao deve preservar provider e externalId da Gran para idempotencia.'
);
granCrawlerAssert(
    ($payloads[0]['contexts'][0]['source']['provider'] ?? null) === 'gran'
    && (string) ($payloads[0]['contexts'][0]['source']['externalId'] ?? '') === '77',
    'O contexto deve preservar provider e externalId da Gran para idempotencia.'
);
granCrawlerAssert(
    ($payloads[0]['questions'][0]['filters']['examBoards'][0]['label'] ?? null) === 'IBFC'
    && ($payloads[0]['questions'][0]['filters']['organizations'][0]['label'] ?? null) === 'PM-PB'
    && ($payloads[0]['questions'][0]['filters']['roles'][0]['label'] ?? null) === 'Soldado'
    && ($payloads[0]['questions'][0]['filters']['subjects'][0]['label'] ?? null) === 'Lingua Portuguesa'
    && ($payloads[0]['questions'][0]['filters']['topics'][0]['label'] ?? null) === 'Interpretacao de textos'
    && ($payloads[0]['questions'][0]['filters']['subtopics'][0]['label'] ?? null) === 'Inferencia'
    && ($payloads[0]['questions'][0]['filters']['careers'][0]['label'] ?? null) === 'Educacao'
    && ($payloads[1]['questions'][0]['filters']['careers'][0]['label'] ?? null) === 'Engenharia',
    'Filtros da questao e metadados da prova devem usar o contrato canonico.'
);
granCrawlerAssert(
    array_key_exists('id', $payloads[0]['questions'][0]['filters']['careers'][0] ?? [])
    && $payloads[0]['questions'][0]['filters']['careers'][0]['id'] === null,
    'Taxonomias externas devem declarar id nulo ate serem conciliadas com a taxonomia interna.'
);
granCrawlerAssert(
    ($payloads[0]['questions'][0]['filters']['careers'][0]['sourceEntityType'] ?? null) === 'area'
    && ($payloads[0]['questions'][0]['filters']['careers'][0]['externalId'] ?? null) === 31,
    'A area da Gran deve ser preservada como foco, com identidade externa propria.'
);
granCrawlerAssert(
    str_contains($payloads[0]['questions'][0]['content']['statement'], '[image:')
    && str_contains($payloads[0]['questions'][0]['content']['supportText'], '[image:')
    && str_contains($payloads[0]['contexts'][0]['body'], '[image:')
    && str_contains($payloads[0]['questions'][0]['alternatives'][1]['text'], '[image:')
    && count($payloads[0]['questions'][0]['assets']) === 2
    && count($payloads[0]['contexts'][0]['assets']) === 1
    && count($payloads[0]['questions'][0]['alternatives'][1]['assets']) === 1,
    'Imagens devem virar assets canonicos e marcadores no ponto correto do texto.'
);
granCrawlerAssert(
    $payloads[0]['questions'][0]['tempId'] !== $payloads[1]['questions'][0]['tempId'],
    'Os identificadores temporarios devem permanecer unicos entre provas.'
);
granCrawlerAssert(
    str_contains($payloads[0]['questions'][0]['content']['statement'], '[image:')
    && ($payloads[0]['questions'][0]['assets'][0]['usage'] ?? null) === 'statement'
    && ($payloads[0]['questions'][0]['assets'][0]['url'] ?? null)
        === 'https://arquivos.infra-questoes.grancursosonline.com.br/media/enunciado.png',
    'hasImage deve extrair a imagem presente no enunciado, criar o asset e preservar seu marcador.'
);

$hierarchyResult = $service->mapBrowserResponse([
    'granResponse' => [
        'data' => [
            'total' => 1,
            'rows' => [[
                'id_questao' => 1200,
                'numero_questao' => 30,
                'enunciado' => 'Sobre aplicativos de escritorio, assinale a alternativa correta.',
                'itens' => [
                    ['id' => 12001, 'corpo' => 'Alternativa A'],
                    ['id' => 12002, 'corpo' => 'Alternativa B'],
                ],
                'resposta' => 12001,
                // A ordem intencionalmente nao representa a hierarquia.
                'assuntos' => [[
                    'nome_clean' => 'Microsoft Excel',
                    'assunto_raiz' => 405030,
                    'pai' => 420298,
                    'palavrasChave' => [],
                    'nome' => 'Microsoft Excel',
                    'materia' => false,
                    'id' => 405118,
                    'slug' => 'informatica-microsoft-excel-405118',
                ], [
                    'nome' => 'Windows',
                    'assunto_raiz' => 405030,
                    'pai' => 405200,
                    'materia' => false,
                    'id' => 405201,
                    'slug' => 'informatica-windows-405201',
                ], [
                    'nome_clean' => 'Suites ou Pacotes de Escritorio',
                    'assunto_raiz' => 405030,
                    'pai' => 405030,
                    'palavrasChave' => [],
                    'nome' => 'Suites ou Pacotes de Escritorio',
                    'materia' => false,
                    'id' => 405107,
                    'slug' => 'informatica-suites-ou-pacotes-de-escritorio-405107',
                ], [
                    'nome' => 'Sistemas Operacionais',
                    'assunto_raiz' => 405030,
                    'pai' => 405030,
                    'materia' => false,
                    'id' => 405200,
                    'slug' => 'informatica-sistemas-operacionais-405200',
                ], [
                    'nome_clean' => 'Informatica',
                    'assunto_raiz' => 405030,
                    'pai' => null,
                    'palavrasChave' => ['Nocoes basicas de informatica'],
                    'nome' => 'Informatica',
                    'materia' => true,
                    'id' => 405030,
                    'slug' => 'informatica-405030',
                ]],
                'provas' => [[
                    'id' => 701,
                    'nome' => 'Teste - 2026 - Tecnologia',
                    'ano' => 2026,
                ]],
            ]],
        ],
    ],
    'granRequestUrl' => 'https://rota-api.grancursosonline.com.br/v1/elastic/questao?perPage=20&page=1',
]);
$hierarchyFilters = $hierarchyResult['payloads'][0]['questions'][0]['filters'] ?? [];
granCrawlerAssert(
    array_column($hierarchyFilters['subjects'] ?? [], 'label') === ['Informatica'],
    'materia=true deve identificar a raiz independentemente da ordem do array.'
);
granCrawlerAssert(
    array_column($hierarchyFilters['topics'] ?? [], 'label')
        === ['Suites ou Pacotes de Escritorio', 'Sistemas Operacionais'],
    'Todo item cujo pai e o assunto_raiz deve ser preservado como topico.'
);
granCrawlerAssert(
    array_column($hierarchyFilters['subtopics'] ?? [], 'label') === ['Microsoft Excel', 'Windows'],
    'Uma questao deve preservar todos os assuntos de todos os ramos recebidos.'
);
granCrawlerAssert(
    array_key_exists('id', $hierarchyFilters['subtopics'][0] ?? [])
    && $hierarchyFilters['subtopics'][0]['id'] === null
    && ($hierarchyFilters['subtopics'][0]['externalId'] ?? null) === 405118
    && ($hierarchyFilters['subtopics'][0]['externalParentId'] ?? null) === 420298
    && ($hierarchyFilters['subtopics'][0]['externalRootId'] ?? null) === 405030
    && ($hierarchyFilters['subtopics'][0]['sourceEntityType'] ?? null) === 'assunto'
    && ($hierarchyFilters['subtopics'][0]['rootSubjectName'] ?? null) === 'Informatica'
    && !isset($hierarchyFilters['subtopics'][0]['pai']),
    'IDs do Gran devem ser metadados externos e nunca IDs de taxonomia local.'
);
granCrawlerAssert(
    ($hierarchyFilters['subtopics'][1]['parentName'] ?? null) === 'Sistemas Operacionais'
    && ($hierarchyFilters['topics'][0]['parentName'] ?? null) === 'Informatica',
    'Pais presentes no array devem ser resolvidos nominalmente para reconciliacao local segura.'
);

$browserResult = $service->mapBrowserResponse([
    'granResponse' => $remotePayload,
    'granExamFiles' => [
        '501' => [
            'edital' => 'https://arquivos.infra-questoes.grancursosonline.com.br/provas/501/edital.pdf',
            'folhaDeProva' => 'https://arquivos.infra-questoes.grancursosonline.com.br/provas/501/prova.pdf',
            'gabarito' => 'https://arquivos.infra-questoes.grancursosonline.com.br/provas/501/gabarito.pdf',
        ],
        '601' => [
            'folhaDeProva' => 'https://arquivos.infra-questoes.grancursosonline.com.br/provas/601/prova.pdf',
        ],
        'unsafe' => [
            'edital' => 'https://example.org/edital.pdf',
        ],
    ],
    'granRequestUrl' => 'https://rota-api.grancursosonline.com.br/v1/elastic/questao?perPage=20&page=1',
    'examTitle' => 'TITULO GLOBAL QUE DEVE SER IGNORADO',
    'year' => '2024',
]);
granCrawlerAssert(
    count($browserResult['payloads']) === 2
    && $browserResult['questionCount'] === 2,
    'Resposta coletada pela extensao deve usar o mesmo mapeamento canonico.'
);
granCrawlerAssert(
    $browserResult['payloads'][0]['import']['extractionMode'] === 'gran_browser_extension',
    'Origem da coleta pelo navegador deve ser registrada sem incluir credenciais.'
);
granCrawlerAssert(
    $browserResult['payloads'][0]['exam']['title'] === 'IBFC - 2024 - PM-PB - Soldado'
    && $browserResult['payloads'][1]['exam']['title'] === 'FGV - 2023 - CBMERJ - Oficial',
    'Um titulo global do painel nao pode sobrescrever as provas reais da Gran.'
);
granCrawlerAssert(
    $browserResult['fileCount'] === 4
    && count($browserResult['payloads'][0]['exam']['files']) === 3
    && count($browserResult['payloads'][1]['exam']['files']) === 1,
    'Edital, prova e gabarito devem permanecer associados a prova Gran correta.'
);
granCrawlerAssert(
    ($browserResult['payloads'][0]['exam']['files'][1]['kind'] ?? null) === 'prova'
    && ($browserResult['payloads'][0]['exam']['files'][1]['sourceExternalExamId'] ?? null) === '501'
    && !isset($browserResult['payloads'][0]['exam']['files'][1]['url']),
    'Folha de prova deve virar documento prova pendente de materializacao no storage proprio.'
);

$emptyBrowserResponseRejected = false;
try {
    $service->mapBrowserResponse([
        'granResponse' => ['data' => ['rows' => []]],
        'page' => 1,
        'perPage' => 20,
    ]);
} catch (InvalidArgumentException) {
    $emptyBrowserResponseRejected = true;
}
granCrawlerAssert(
    $emptyBrowserResponseRejected,
    'JSON sem questoes nao deve criar lote vazio.'
);

$directUrl = 'https://rota-api.grancursosonline.com.br/v1/elastic/questao'
    . '?perPage=10&page=3&bancas%5B%5D=IBFC'
    . '&sort=%5B%7B%22anos%22%3A%22asc%22%7D%5D';
$directResult = $service->fetchPage([
    'granAccessToken' => $testToken,
    'granRequestUrl' => $directUrl,
]);
granCrawlerAssert($directResult['page'] === 3, 'A pagina deve ser lida da URL direta.');
granCrawlerAssert($directResult['perPage'] === 10, 'O limite deve ser lido da URL direta.');
granCrawlerAssert(
    str_contains($observedUrl, 'bancas%5B0%5D=IBFC')
    && str_contains($observedUrl, 'page=3')
    && str_contains($observedUrl, 'perPage=10'),
    'A URL direta deve preservar filtros e paginacao da Gran.'
);

$unsafeUrlRejected = false;
try {
    $service->fetchPage([
        'granAccessToken' => $testToken,
        'granRequestUrl' => 'https://example.org/v1/elastic/questao?page=1&perPage=20',
    ]);
} catch (InvalidArgumentException) {
    $unsafeUrlRejected = true;
}
granCrawlerAssert($unsafeUrlRejected, 'Uma URL externa ao host oficial da Gran deve ser rejeitada.');

$unsafePathRejected = false;
try {
    $service->fetchPage([
        'granAccessToken' => $testToken,
        'granRequestUrl' => 'https://rota-api.grancursosonline.com.br/v1/elastic/usuario?page=1',
    ]);
} catch (InvalidArgumentException) {
    $unsafePathRejected = true;
}
granCrawlerAssert($unsafePathRejected, 'Uma rota diferente da rota de questoes deve ser rejeitada.');

fwrite(STDOUT, "AdminGranCrawlerBehaviorTest: PASS\n");
