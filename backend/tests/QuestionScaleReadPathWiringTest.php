<?php

declare(strict_types=1);

function questionScaleAssert(bool $condition, string $message): void
{
    if (!$condition) {
        throw new RuntimeException($message);
    }
}

function questionScaleRead(string $relativePath): string
{
    $content = file_get_contents(__DIR__ . '/../' . $relativePath);
    if (!is_string($content)) {
        throw new RuntimeException('Arquivo nao encontrado: ' . $relativePath);
    }
    return $content;
}

try {
    $repository = questionScaleRead('modules/questions/repositories/QuestionsRepository.php');
    $service = questionScaleRead('modules/questions/services/QuestionsService.php');
    $migration = questionScaleRead('database/migrations/20260717_010000_question_scale_foundation.php');
    $backfill = questionScaleRead('scripts/backfills/backfill_question_scale_read_model.php');
    $answerBackfill = questionScaleRead('scripts/backfills/backfill_selected_option_ids.php');
    $canonicalRepository = questionScaleRead('modules/questions/repositories/QuestionCanonicalRepository.php');
    $environment = questionScaleRead('.env.production.example');

    questionScaleAssert(str_contains($repository, 'listQuestionListRowsByCursor'), 'Listagem por cursor nao foi implementada.');
    questionScaleAssert(
        str_contains($repository, "\$sortExpression = \$scaleReady ? 'q.published_sort_at' : 'COALESCE(q.published_at, q.created_at)'")
        && str_contains($repository, 'ORDER BY {$sortExpression} DESC, q.id DESC'),
        'Ordenacao keyset nao e estavel.'
    );
    questionScaleAssert(!str_contains(
        substr($service, strpos($service, 'public function listQuestionsV2'), 5000),
        'countAllQuestions'
    ), 'Listagem v2 ainda executa COUNT(*).');
    questionScaleAssert(str_contains($service, "'pageInfo'"), 'Contrato v2 nao expoe pageInfo.');
    questionScaleAssert(str_contains($service, 'QuestionPublicPageCache'), 'Cache publico nao esta conectado ao service.');
    questionScaleAssert(
        str_contains($service, 'listLatestUserAnswersMap($authenticatedUserId, $ids)')
        && str_contains($service, 'listSavedQuestionIds($authenticatedUserId, $ids)'),
        'Estado privado do usuario nao e aplicado em lote depois do cache publico.'
    );
    questionScaleAssert(
        str_contains($service, "\$item['userState']")
        && str_contains($service, "'isSaved' => \$isSaved"),
        'DTO v2 nao expoe o estado privado calculado fora do cache.'
    );
    questionScaleAssert(str_contains($service, "'selectedOptionId' => \$selectedCanonicalOptionId"), 'Resposta v2 nao preserva selected_option_id canonico.');
    questionScaleAssert(str_contains($service, "'idempotencyKey' => \$idempotencyKey"), 'Resposta v2 nao e idempotente.');
    questionScaleAssert(str_contains($migration, 'question_search_documents'), 'Read model de busca nao esta na migration.');
    questionScaleAssert(str_contains($migration, 'selected_option_id'), 'Alternativa canonica nao esta na migration.');
    questionScaleAssert(!str_contains($migration, 'MODIFY COLUMN type VARCHAR'), 'Migration nao pode converter o enum existente de filtros.');
    questionScaleAssert(!str_contains($migration, 'fk_filters_type'), 'Migration nao pode acoplar o enum legado ao registro de tipos.');
    questionScaleAssert(str_contains($backfill, "'mode' => \$apply ? 'apply' : 'dry-run'"), 'Backfill nao e dry-run por padrao.');
    questionScaleAssert(str_contains($backfill, 'ORDER BY id'), 'Backfill nao e retomavel por chave.');
    questionScaleAssert(str_contains($answerBackfill, "'mode' => \$apply ? 'apply' : 'dry-run'"), 'Backfill de alternativas nao e dry-run por padrao.');
    questionScaleAssert(str_contains($answerBackfill, 'selected_option_index + 1'), 'Backfill nao reconcilia a ordem legada com a alternativa canonica.');
    questionScaleAssert(str_contains($canonicalRepository, 'UPDATE question_options'), 'Atualizacao canonica ainda recria todas as alternativas.');
    questionScaleAssert(str_contains($canonicalRepository, 'external_key duplicada'), 'Repositorio nao valida chaves estaveis duplicadas.');
    questionScaleAssert(str_contains($environment, 'QUESTIONS_SCALE_COLUMNS_READY=false'), 'Flag segura do read model nao foi documentada.');
    questionScaleAssert(str_contains($environment, 'QUESTIONS_SEARCH_DOCUMENTS_READY=false'), 'Flag segura da busca nao foi documentada.');

    fwrite(STDOUT, "QuestionScaleReadPathWiringTest: PASS\n");
} catch (Throwable $exception) {
    fwrite(STDERR, 'QuestionScaleReadPathWiringTest: FAIL - ' . $exception->getMessage() . "\n");
    exit(1);
}
