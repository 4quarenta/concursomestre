<?php

declare(strict_types=1);

function adminGranCrawlerWiringAssert(bool $condition, string $message): void
{
    if (!$condition) {
        throw new RuntimeException($message);
    }
}

$backend = dirname(__DIR__);
$root = dirname($backend);
$service = (string) file_get_contents($backend . '/modules/admin/services/AdminGranCrawlerService.php');
$route = (string) file_get_contents($backend . '/modules/admin/gran_crawler_routes.php');
$endpoint = (string) file_get_contents($backend . '/api/admin/gran_crawler.php');
$queue = (string) file_get_contents($backend . '/modules/questions/services/PrivateQuestionIngestionService.php');
$questionsService = (string) file_get_contents($backend . '/modules/questions/services/QuestionsService.php');
$worker = (string) file_get_contents($backend . '/scripts/workers/process_question_ingestion_jobs.php');
$component = (string) file_get_contents(
    $root . '/src/app/admin/components/import/AdminGranCrawlerSection.tsx'
);
$reviewBatch = (string) file_get_contents(
    $root . '/src/app/admin/components/import/AdminGranCrawlerReviewBatch.tsx'
);
$sections = (string) file_get_contents(
    $root . '/src/app/admin/components/database/AdminDatabaseSections.tsx'
);
$bridge = (string) file_get_contents(
    $root . '/src/app/admin/components/import/granExtensionBridge.ts'
);
$legacyEntry = (string) file_get_contents($backend . '/scripts/importers/questions/gran/index.php');

foreach ([
    'requireAdminSessionContext',
    "RateLimiter::enforceProfile('admin_crawler'",
    'AdminGranCrawlerService',
    'Cache-Control: private, no-store',
] as $needle) {
    adminGranCrawlerWiringAssert(str_contains($route, $needle), 'Rota admin sem protecao: ' . $needle);
}
adminGranCrawlerWiringAssert(
    str_contains($endpoint, 'handleAdminGranCrawlerRoute'),
    'Endpoint administrativo nao delega para a rota protegida.'
);
adminGranCrawlerWiringAssert(
    str_contains($service, 'CURLOPT_FOLLOWLOCATION => false')
    && str_contains($service, 'CURLOPT_PROTOCOLS => CURLPROTO_HTTPS')
    && str_contains($service, "'x-client-id: ' . \$clientId")
    && str_contains($service, 'normalizeAccessToken'),
    'Cliente Gran deve bloquear redirects e protocolos inseguros.'
);
adminGranCrawlerWiringAssert(
    str_contains($service, "private const API_HOST = 'rota-api.grancursosonline.com.br'")
    && str_contains($service, "private const API_PATH = '/v1/elastic/questao'")
    && str_contains($service, "\$scheme !== 'https'")
    && str_contains($service, "\$host !== self::API_HOST")
    && str_contains($service, "\$path !== self::API_PATH")
    && !str_contains($service, 'HTTP_COOKIE')
    && !str_contains($service, 'INSERT INTO gran'),
    'URL direta deve permanecer restrita ao host/rota oficial e sem persistir sessao externa.'
);
adminGranCrawlerWiringAssert(
    str_contains($queue, 'enqueueFromAdminSession')
    && str_contains($queue, "'admin-browser:' . \$actorUserId"),
    'Fila deve identificar o ator administrativo sem HMAC exposto ao browser.'
);
adminGranCrawlerWiringAssert(
    str_contains($worker, "\$job['actor_user_id']"),
    'Worker deve publicar usando o ator gravado pela sessao administrativa.'
);
adminGranCrawlerWiringAssert(
    str_contains($worker, 'GranExamFileMaterializer.php')
    && str_contains($worker, '$granExamFileMaterializer->materialize($payload)'),
    'Worker deve copiar documentos Gran para o storage proprio antes da persistencia.'
);
adminGranCrawlerWiringAssert(
    str_contains($questionsService, "'files' => array_values(array_filter(")
    && str_contains($questionsService, "\$examPayload['files']"),
    'Metadado canonico da prova deve encaminhar arquivos materializados para prova_arquivos.'
);
adminGranCrawlerWiringAssert(
    !str_contains($component, 'localStorage')
    && !str_contains($component, 'sessionStorage')
    && !str_contains($component, 'document.cookie')
    && !str_contains($component, 'granAccessToken')
    && str_contains($component, "action: 'map'")
    && str_contains($component, 'granExamFiles: collection.examFiles')
    && str_contains($component, 'collectGranQuestions'),
    'Frontend deve coletar pela extensao sem receber ou persistir a credencial Gran.'
);
adminGranCrawlerWiringAssert(
    str_contains($route, "\$action === 'map'")
    && str_contains($route, 'mapBrowserResponse')
    && str_contains($route, "'exam_count' => count(\$result['payloads'] ?? [])")
    && str_contains($route, 'server_side_collection_retired')
    && str_contains($service, 'gran_browser_extension')
    && str_contains($service, 'mapQuestionImportPayloads')
    && str_contains($service, "'sourceExamKey' =>")
    && str_contains($service, "'provider' => 'gran'")
    && str_contains($service, 'normalizeGranExamFiles'),
    'Backend deve mapear apenas o JSON da extensao e aposentar a coleta exposta pelo servidor.'
);
adminGranCrawlerWiringAssert(
    str_contains($component, 'renderReviewQueue(result.payloads)')
    && str_contains($component, 'Fila de importação')
    && !str_contains($component, 'Revisar no importador')
    && !str_contains($component, 'Adicionar à fila de revisão')
    && !str_contains($component, 'handleReviewPayload')
    && str_contains($component, 'question.filters?.careers')
    && !str_contains($component, "action: 'enqueue'")
    && !str_contains($component, 'examTitle')
    && !str_contains($component, 'Título da prova'),
    'A coleta deve separar provas reais, preservar areas e alimentar automaticamente a fila canonica.'
);
adminGranCrawlerWiringAssert(
    str_contains($sections, 'AdminGranCrawlerReviewBatch')
    && str_contains($sections, 'renderReviewQueue={(payloads)')
    && str_contains($sections, 'payloads.map((payload)')
    && str_contains($reviewBatch, 'useAdminQuestionWorkbench')
    && str_contains($reviewBatch, 'importEnabled: false')
    && str_contains($reviewBatch, 'importWorkflowProps.onImportFromAiJson(payloadJson)')
    && str_contains($reviewBatch, '<AdminImportSection')
    && str_contains($reviewBatch, 'reviewOnly')
    && !str_contains($sections, "onSelectSubTab('import')"),
    'Cada prova Gran deve criar automaticamente um workflow isolado com o mesmo editor completo.'
);
adminGranCrawlerWiringAssert(
    str_contains($bridge, "window.postMessage")
    && str_contains($bridge, "event.origin !== window.location.origin")
    && !str_contains($bridge, 'granAccessToken'),
    'Ponte da extensao deve validar origem e nunca transportar o bearer.'
);
adminGranCrawlerWiringAssert(
    str_contains($legacyEntry, 'http_response_code(410)'),
    'Entrada publica legada deve continuar aposentada.'
);

fwrite(STDOUT, "AdminGranCrawlerWiringTest: PASS\n");
