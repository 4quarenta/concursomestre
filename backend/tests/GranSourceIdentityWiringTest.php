<?php

declare(strict_types=1);

function granSourceIdentityAssert(bool $condition, string $message): void
{
    if (!$condition) {
        throw new RuntimeException($message);
    }
}

$backend = dirname(__DIR__);
$migration = (string) file_get_contents($backend . '/database/migrations/20260725_010000_gran_source_identity.php');
$rollback = (string) file_get_contents($backend . '/database/rollbacks/20260725_010000_gran_source_identity.sql');
$granService = (string) file_get_contents($backend . '/modules/admin/services/AdminGranCrawlerService.php');
$questionsService = (string) file_get_contents($backend . '/modules/questions/services/QuestionsService.php');
$questionsRepository = (string) file_get_contents($backend . '/modules/questions/repositories/QuestionsRepository.php');
$canonicalRepository = (string) file_get_contents($backend . '/modules/questions/repositories/QuestionCanonicalRepository.php');
$validator = (string) file_get_contents($backend . '/modules/questions/validators/QuestionsValidator.php');

foreach (['questions', 'provas', 'questions_groups', 'question_contexts'] as $table) {
    granSourceIdentityAssert(
        str_contains($migration, "'" . $table . "'")
        && str_contains($rollback, 'ALTER TABLE ' . $table . ' DROP COLUMN source_provider, DROP COLUMN source_external_id'),
        'Migration/rollback da identidade externa esta incompleta para ' . $table . '.'
    );
}
granSourceIdentityAssert(
    str_contains($migration, 'CREATE UNIQUE INDEX')
    && str_contains($migration, 'HAVING COUNT(*) > 1')
    && str_contains($migration, 'Nao foi possivel criar'),
    'Migration deve recusar duplicatas existentes antes de criar os indices unicos.'
);
granSourceIdentityAssert(
    str_contains($granService, "'provider' => 'gran'")
    && str_contains($granService, "'externalId' => \$groupIdentity !== '' ? \$groupIdentity : null")
    && str_contains($granService, "'externalId' => \$externalId !== '' ? \$externalId : null"),
    'Mapper Gran deve transportar IDs externos de prova, questao e contexto.'
);
granSourceIdentityAssert(
    str_contains($validator, "'source_provider' => \$this->normalizeSourceIdentityValue")
    && str_contains($validator, "\$payload['sourceExternalId'] = \$source['externalId']"),
    'Validador deve normalizar a identidade externa antes da persistencia.'
);
granSourceIdentityAssert(
    str_contains($questionsService, 'findQuestionByImportIdentity(')
    && str_contains($questionsService, "\$importIdentity['source_external_id']")
    && str_contains($questionsService, "return 'external:' . \$sourceProvider . ':' . \$sourceExternalId;")
    && str_contains($questionsService, "'source_provider' => \$sourceProvider"),
    'Servico de importacao deve deduplicar o lote e consultar a questao pela identidade Gran.'
);
granSourceIdentityAssert(
    str_contains($questionsRepository, 'WHERE source_provider = :source_provider AND source_external_id = :source_external_id')
    && str_contains($questionsRepository, 'source_external_id = :source_external_id'),
    'Repositorio de questoes deve localizar a identidade externa antes de inserir.'
);
granSourceIdentityAssert(
    str_contains($granService, 'preloadGranTaxonomyIdentities($rows)')
    && str_contains($granService, 'filter_source_identities i')
    && str_contains($granService, 'preloadGranQuestionIdentities($rows)')
    && str_contains($granService, 'preloadGranExamIdentities($rows)'),
    'Crawler deve reconciliar taxonomias, questoes e provas existentes em lote.'
);
granSourceIdentityAssert(
    str_contains($questionsRepository, 'FROM filter_source_identities')
    && str_contains($questionsService, 'if ($sourceIdentity !== null)')
    && !str_contains($questionsService, 'if ($id === null && $sourceIdentity !== null)'),
    'Publicacao deve tratar a identidade externa como autoritativa mesmo quando o payload trouxer ID local.'
);
granSourceIdentityAssert(
    str_contains($questionsService, "in_array(\$existingStatus, ['published', 'publicado'], true)")
    && str_contains($questionsService, "\$validatedQuestion['id'] = (int) \$existingQuestion['id']")
    && str_contains($questionsService, "'status' => \$updatingExistingQuestion ? 'updated' : 'created'"),
    'Questao publicada deve ser ignorada e rascunho existente deve ser atualizado sem duplicacao.'
);
granSourceIdentityAssert(
    str_contains($questionsRepository, 'a matching external source only reuses it.')
    && str_contains($questionsRepository, 'source_provider = :source_provider')
    && str_contains($questionsRepository, 'source_external_id = :source_external_id'),
    'Provas e grupos Gran existentes devem ser reutilizados sem sobrescrever a revisao local.'
);
granSourceIdentityAssert(
    str_contains($canonicalRepository, 'a repeated collection')
    && str_contains($canonicalRepository, 'source_provider, source_external_id')
    && str_contains($canonicalRepository, 'normalizeSourceExternalId'),
    'Contextos canonicos devem reutilizar a mesma identidade externa Gran.'
);

fwrite(STDOUT, "GranSourceIdentityWiringTest: PASS\n");
