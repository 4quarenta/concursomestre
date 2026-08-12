<?php

declare(strict_types=1);

function granFailureRetentionAssert(bool $condition, string $message): void
{
    if (!$condition) {
        throw new RuntimeException($message);
    }
}

$backend = dirname(__DIR__);
$root = dirname($backend);
$service = (string) file_get_contents($backend . '/modules/questions/services/PrivateQuestionIngestionService.php');
$adminService = (string) file_get_contents($backend . '/modules/admin/services/AdminGranCrawlerService.php');
$route = (string) file_get_contents($backend . '/modules/admin/gran_crawler_routes.php');
$component = (string) file_get_contents($root . '/src/app/admin/components/import/AdminGranCrawlerSection.tsx');
$migration = (string) file_get_contents($backend . '/database/migrations/20260808_170000_gran_failure_diagnostics_retention.php');
$rollback = (string) file_get_contents($backend . '/database/rollbacks/20260808_170000_gran_failure_diagnostics_retention.sql');

granFailureRetentionAssert(
    str_contains($service, 'previewGranQuestionFailureRetention')
    && str_contains($service, 'purgeExpiredGranQuestionFailureDiagnostics')
    && str_contains($service, "status IN ('resolved', 'ignored')")
    && str_contains($service, 'canonical_payload_json = NULL')
    && str_contains($service, 'GRAN_FAILURE_PAYLOAD_RETENTION_DAYS = 30')
    && str_contains($service, 'GRAN_FAILURE_RECORD_RETENTION_DAYS = 90')
    && !str_contains($service, "DELETE FROM gran_question_publication_failures\nWHERE status IN ('open'") ,
    'A retencao deve atingir somente falhas resolvidas ou ignoradas, em duas janelas seguras.'
);
granFailureRetentionAssert(
    str_contains($adminService, "'failureRetention' => \$ingestion->previewGranQuestionFailureRetention()")
    && str_contains($adminService, 'purgePublicationFailureRetention')
    && str_contains($route, "\$action === 'publication_failure_retention_preview'")
    && str_contains($route, "\$action === 'purge_publication_failure_diagnostics'")
    && str_contains($route, 'gran_crawler.purge_publication_failure_diagnostics'),
    'O painel administrativo deve exibir a previsao e auditar a limpeza manual.'
);
granFailureRetentionAssert(
    str_contains($component, 'Limpar diagnosticos antigos')
    && str_contains($component, "action: 'purge_publication_failure_diagnostics'")
    && str_contains($component, 'Falhas abertas e em nova tentativa ficam preservadas.'),
    'A interface deve informar a retencao e exigir uma acao explicita para a limpeza.'
);
granFailureRetentionAssert(
    str_contains($migration, 'idx_gran_failure_retention (status, resolved_at, id)')
    && str_contains($rollback, 'DROP INDEX idx_gran_failure_retention'),
    'A limpeza precisa de indice aditivo com rollback explicito.'
);

fwrite(STDOUT, "GranFailureDiagnosticsRetentionWiringTest: PASS\n");
