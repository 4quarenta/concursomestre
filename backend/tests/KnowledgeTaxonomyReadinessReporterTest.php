<?php

declare(strict_types=1);

require_once dirname(__DIR__) . '/modules/seo/reports/KnowledgeTaxonomyReadinessReporter.php';

function readinessReportAssert(bool $condition, string $message): void
{
    if (!$condition) throw new RuntimeException($message);
}

try {
    $matter = ['id' => 1, 'name' => 'Direito', 'slug' => 'direito', 'type' => 'assunto', 'taxonomy_level' => 'materia', 'meta_materia' => 1, 'own_parent_id' => 0];
    $topic = ['id' => 2, 'name' => 'Controle', 'slug' => 'controle', 'type' => 'assunto', 'taxonomy_level' => 'topico', 'own_parent_id' => 1, 'parent_id' => 1, 'parent_parent_id' => 0, 'parent_type' => 'assunto', 'parent_taxonomy_level' => 'materia', 'parent_meta_materia' => 1, 'parent_name' => 'Direito', 'parent_slug' => 'direito'];
    $orphanSubject = ['id' => 3, 'name' => 'Orfao', 'slug' => 'orfao', 'type' => 'assunto', 'taxonomy_level' => 'assunto', 'own_parent_id' => 999];
    $report = KnowledgeTaxonomyReadinessReporter::summarize([$matter, $topic, $orphanSubject], 2);

    readinessReportAssert($report['readOnly'] === true && $report['runtimeEnforcement'] === false, 'Reporter confundiu diagnostico com enforcement.');
    readinessReportAssert($report['levels']['materia']['ready'] === 1, 'Materia valida nao foi contabilizada.');
    readinessReportAssert($report['levels']['topico']['ready'] === 1, 'Topico valido nao foi contabilizado.');
    readinessReportAssert($report['levels']['assunto']['notReady'] === 1, 'Assunto orfao nao foi contabilizado.');
    readinessReportAssert(($report['levels']['assunto']['reasonCodes']['instance_readiness.orphan'] ?? 0) === 1, 'Reason code de orfao nao foi agregado.');

    $script = (string) file_get_contents(dirname(__DIR__) . '/scripts/seo/report_knowledge_taxonomy_readiness.php');
    readinessReportAssert(str_contains($script, "new Database('read')"), 'Reporter nao usa conexao read-only.');
    readinessReportAssert(!preg_match('/\\b(INSERT|UPDATE|DELETE|ALTER|DROP|TRUNCATE)\\b/i', $script), 'Reporter contem operacao de escrita.');
    echo "KnowledgeTaxonomyReadinessReporterTest: PASS\n";
    exit(0);
} catch (Throwable $error) {
    fwrite(STDERR, 'KnowledgeTaxonomyReadinessReporterTest: FAIL - ' . $error->getMessage() . PHP_EOL);
    exit(1);
}
