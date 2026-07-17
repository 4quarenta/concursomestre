<?php

/*
* ----------------------------------------------------
* @author: 4quarenta
* @author URI: https://github.com/4quarenta
* @copyright: (c) 2026 ConcursoMestre. All rights reserved
* ----------------------------------------------------
*
* @since 1.0.0
*
*/

declare(strict_types=1);

function assertContainsLegalCommentaryAdmin(string $path, string $needle, string $message): void
{
    $content = file_get_contents($path);
    if ($content === false || strpos($content, $needle) === false) {
        throw new RuntimeException($message . ' [' . $path . ']');
    }
}

$base = dirname(__DIR__) . '';
$routes = $base . '/modules/legal_commentary/routes.php';
$repository = $base . '/modules/legal_commentary/repositories/LegalCommentaryRepository.php';
$service = $base . '/modules/legal_commentary/services/LegalCommentaryService.php';

$adminHandlers = [
    'handleLegalCommentaryAdminListRoute',
    'handleLegalCommentaryAdminDetailRoute',
    'handleLegalCommentaryAdminSaveRoute',
    'handleLegalCommentaryAdminDeleteRoute',
    'handleLegalCommentaryAdminGenerateRoute',
    'handleLegalCommentaryAdminBatchStartRoute',
    'handleLegalCommentaryAdminBatchStatusRoute',
    'handleLegalCommentaryAdminBatchRetryRoute',
    'handleLegalCommentaryAdminBatchStopRoute',
    'handleLegalCommentaryAdminCatalogRoute',
    'handleLegalCommentaryAdminImportRoute',
    'handleLegalCommentaryAdminSyncRoute',
    'handleLegalCommentaryAdminUpdatesRoute',
];

foreach ($adminHandlers as $handler) {
    assertContainsLegalCommentaryAdmin(
        $routes,
        "function {$handler}",
        "{$handler} must exist"
    );
}

$content = (string) file_get_contents($routes);
foreach ($adminHandlers as $handler) {
    $position = strpos($content, "function {$handler}");
    if ($position === false) {
        throw new RuntimeException("{$handler} not found.");
    }

    $nextFunction = strpos($content, "\nfunction ", $position + 1);
    $body = $nextFunction === false
        ? substr($content, $position)
        : substr($content, $position, $nextFunction - $position);

    if (strpos($body, 'requireAdminSessionContext($db)') === false) {
        throw new RuntimeException("{$handler} must require admin session context.");
    }
}

assertContainsLegalCommentaryAdmin(
    $base . '/api/legal-commentary/admin/save.php',
    'handleLegalCommentaryAdminSaveRoute($db);',
    'Legal commentary admin save bridge must delegate to the admin route'
);

assertContainsLegalCommentaryAdmin(
    $base . '/api/legal-commentary/admin/import.php',
    'handleLegalCommentaryAdminImportRoute($db);',
    'Legal commentary admin import bridge must delegate to the admin route'
);

$repositoryContent = (string) file_get_contents($repository);
$ensureColumnPosition = strpos($repositoryContent, 'private function ensureColumnExists');
$nextFunctionPosition = $ensureColumnPosition === false ? false : strpos($repositoryContent, "\n    private function ", $ensureColumnPosition + 1);
$ensureColumnBody = $ensureColumnPosition === false
    ? ''
    : ($nextFunctionPosition === false
        ? substr($repositoryContent, $ensureColumnPosition)
        : substr($repositoryContent, $ensureColumnPosition, $nextFunctionPosition - $ensureColumnPosition));

foreach (['article_jurisprudence', 'article_exam_tips'] as $migrationTable) {
    if (strpos($ensureColumnBody, "'{$migrationTable}'") === false) {
        throw new RuntimeException("Legal commentary migrations must allow {$migrationTable} schema updates.");
    }
}

assertContainsLegalCommentaryAdmin(
    $repository,
    "ensureColumnExists('article_jurisprudence', 'target_json'",
    'Legal commentary schema must migrate target_json for jurisprudence notes'
);

assertContainsLegalCommentaryAdmin(
    $repository,
    "ensureColumnExists('article_exam_tips', 'target_json'",
    'Legal commentary schema must migrate target_json for exam tips'
);

assertContainsLegalCommentaryAdmin(
    $repository,
    'published_at DATETIME NULL',
    'Legal commentary laws schema must store publication date and time'
);

assertContainsLegalCommentaryAdmin(
    $repository,
    "ALTER TABLE laws MODIFY COLUMN published_at DATETIME NULL",
    'Legal commentary migrations must promote published_at from DATE to DATETIME'
);

assertContainsLegalCommentaryAdmin(
    $repository,
    'l.published_at <= NOW()',
    'Scheduled legal commentary laws must become public only after the scheduled time'
);

assertContainsLegalCommentaryAdmin(
    $repository,
    'DELETE FROM legal_content_reactions WHERE target_key = :target_key AND user_id = :user_id',
    'Legal commentary reactions must replace the previous user reaction before inserting to avoid double-counting'
);

assertContainsLegalCommentaryAdmin(
    $repository,
    'deduplicateContentReactionsForTarget',
    'Legal commentary reaction summaries must deduplicate legacy duplicated rows before counting likes'
);

assertContainsLegalCommentaryAdmin(
    $repository,
    'FOR UPDATE',
    'Legal commentary article progress must lock the progress row before updating viewed article ids'
);

assertContainsLegalCommentaryAdmin(
    $repository,
    'beginTransaction',
    'Legal commentary article progress must be updated transactionally'
);

assertContainsLegalCommentaryAdmin(
    $service,
    "\$article['comentarios'] = ((\$featureAccess['lei.comentario_basico']['mode'] ?? 'locked') === 'full')",
    'Legal commentary public detail must expose teacher comments when the feature is fully available'
);

assertContainsLegalCommentaryAdmin(
    $service,
    "\$article['jurisprudencia'] = ((\$featureAccess['lei.jurisprudencia']['mode'] ?? 'locked') === 'full')",
    'Legal commentary public detail must expose jurisprudence when the feature is fully available'
);

assertContainsLegalCommentaryAdmin(
    $service,
    "\$article['macete'] = ((\$featureAccess['lei.macete']['mode'] ?? 'locked') === 'full'",
    'Legal commentary public detail must expose exam tips when the feature is fully available'
);

require_once $base . '/modules/legal_commentary/services/LegalCommentaryAiGenerationService.php';

$aiGenerationReflection = new ReflectionClass('LegalCommentaryAiGenerationService');
$aiGenerationContent = (string) file_get_contents($base . '/modules/legal_commentary/services/LegalCommentaryAiGenerationService.php');
if (strpos($aiGenerationContent, 'empty($payload[\'previewOnly\'])') === false) {
    throw new RuntimeException('Legal commentary AI generation must let previewOnly override persistence.');
}

foreach ([
    'shouldChunkSectionAnalysis',
    'requestChunkedSectionAnalysisResponse',
    'completeSectionAnalysisChunkIfNeeded',
    'mergeTeacherCommentItems',
    'mergeExamTipItems',
    'buildMaceteTipEntriesFromResponse',
] as $chunkMethod) {
    if (!$aiGenerationReflection->hasMethod($chunkMethod)) {
        throw new RuntimeException("Legal commentary AI generation must implement {$chunkMethod}.");
    }
}

if (strpos($aiGenerationContent, 'SECTION_ANALYSIS_REQUEST_TIMEOUT_SECONDS') === false) {
    throw new RuntimeException('Legal commentary section analysis must use an explicit long-running AI timeout.');
}

$jsonExtractor = $aiGenerationReflection->getMethod('decodeFirstJsonObject');
$jsonExtractor->setAccessible(true);
$aiGenerationService = $aiGenerationReflection->newInstanceWithoutConstructor();

$shouldChunkSectionAnalysis = $aiGenerationReflection->getMethod('shouldChunkSectionAnalysis');
$shouldChunkSectionAnalysis->setAccessible(true);
$largeSectionArticles = [];
for ($articleIndex = 1; $articleIndex <= 7; $articleIndex++) {
    $largeSectionArticles[] = [
        'number' => (string) $articleIndex,
        'text' => str_repeat('Texto oficial longo do artigo. ', 180),
        'blocks' => [],
    ];
}
if (!$shouldChunkSectionAnalysis->invoke($aiGenerationService, ['articleContext' => str_repeat('x', 24000)], $largeSectionArticles)) {
    throw new RuntimeException('Legal commentary section analysis must switch to chunked mode for long chapters.');
}

$fencedJson = $jsonExtractor->invoke(
    $aiGenerationService,
    "```json\n{\"macete\":\"Pulo do gato\",\"target\":{\"kind\":\"caput\",\"label\":\"Caput\"}}\n```"
);
if (!is_array($fencedJson) || ($fencedJson['macete'] ?? '') !== 'Pulo do gato') {
    throw new RuntimeException('Legal commentary AI JSON extractor must accept fenced JSON responses.');
}

$mixedJson = $jsonExtractor->invoke(
    $aiGenerationService,
    "Segue o JSON solicitado:\n{\"comentario\":\"Texto valido\",\"blocks\":[]}\nFim."
);
if (!is_array($mixedJson) || ($mixedJson['comentario'] ?? '') !== 'Texto valido') {
    throw new RuntimeException('Legal commentary AI JSON extractor must accept explanatory text around JSON.');
}

$targetedTextNormalizer = $aiGenerationReflection->getMethod('normalizeExistingTargetedTexts');
$targetedTextNormalizer->setAccessible(true);
$targetedTexts = $targetedTextNormalizer->invoke($aiGenerationService, [[
    'body' => 'Doutrina direcionada',
    'target' => [
        'kind' => 'inciso',
        'label' => 'I',
        'blockId' => 'block-1',
    ],
]]);
if (!is_array($targetedTexts) || ($targetedTexts[0]['body'] ?? '') !== 'Doutrina direcionada' || ($targetedTexts[0]['target']['blockId'] ?? '') !== 'block-1') {
    throw new RuntimeException('Legal commentary AI existing editorial normalization must preserve targeted text objects.');
}

$targetedTextFormatter = $aiGenerationReflection->getMethod('formatTargetedTextForPrompt');
$targetedTextFormatter->setAccessible(true);
$formattedTargetedText = $targetedTextFormatter->invoke($aiGenerationService, $targetedTexts[0]);
if (!is_string($formattedTargetedText) || strpos($formattedTargetedText, '[I]') === false || strpos($formattedTargetedText, 'Doutrina direcionada') === false) {
    throw new RuntimeException('Legal commentary AI prompt context must format targeted text without Array casts.');
}

$mergeTeacherComments = $aiGenerationReflection->getMethod('mergeTeacherCommentItems');
$mergeTeacherComments->setAccessible(true);
$mergedTeacherComments = $mergeTeacherComments->invoke($aiGenerationService, [
    [
        'id' => 'teacher-general',
        'articleId' => '10',
        'title' => 'Comentario do professor',
        'body' => 'Comentario geral existente',
        'richBlocks' => [],
    ],
    [
        'id' => 'teacher-inciso-i',
        'articleId' => '10',
        'title' => 'Comentario do professor - I',
        'body' => 'Comentario do inciso I antigo',
        'richBlocks' => [[
            'target' => ['kind' => 'inciso', 'label' => 'I', 'blockId' => 'block-i'],
        ]],
    ],
], [
    [
        'id' => '',
        'articleId' => '10',
        'title' => 'Comentario do professor - II',
        'body' => 'Comentario do inciso II novo',
        'richBlocks' => [[
            'target' => ['kind' => 'inciso', 'label' => 'II', 'blockId' => 'block-ii'],
        ]],
    ],
]);
if (count($mergedTeacherComments) !== 3) {
    throw new RuntimeException('Legal commentary teacher comments must coexist when generated for different article blocks.');
}

$mergedTeacherComments = $mergeTeacherComments->invoke($aiGenerationService, $mergedTeacherComments, [
    [
        'id' => '',
        'articleId' => '10',
        'title' => 'Comentario do professor - I',
        'body' => 'Comentario do inciso I atualizado',
        'richBlocks' => [[
            'target' => ['kind' => 'inciso', 'label' => 'I', 'blockId' => 'block-i'],
        ]],
    ],
]);
if (count($mergedTeacherComments) !== 3 || ($mergedTeacherComments[1]['body'] ?? '') !== 'Comentario do inciso I atualizado') {
    throw new RuntimeException('Legal commentary teacher comments must replace only the same targeted block.');
}

$mergeExamTips = $aiGenerationReflection->getMethod('mergeExamTipItems');
$mergeExamTips->setAccessible(true);
$mergedExamTips = $mergeExamTips->invoke($aiGenerationService, [
    [
        'id' => 'tip-caput',
        'articleId' => '10',
        'title' => 'Macete - Caput',
        'body' => 'Macete do caput existente',
        'target' => ['kind' => 'caput', 'label' => 'Caput', 'blockId' => 'block-caput'],
    ],
], [
    [
        'id' => '',
        'articleId' => '10',
        'title' => 'Macete - Paragrafo unico',
        'body' => 'Macete do paragrafo novo',
        'target' => ['kind' => 'paragraph', 'label' => 'Paragrafo unico', 'blockId' => 'block-pu'],
    ],
]);
if (count($mergedExamTips) !== 2) {
    throw new RuntimeException('Legal commentary exam tips must coexist for caput, paragraphs, incisos and alineas.');
}

$mergedExamTips = $mergeExamTips->invoke($aiGenerationService, $mergedExamTips, [
    [
        'id' => '',
        'articleId' => '10',
        'title' => 'Macete - Caput',
        'body' => 'Macete do caput atualizado',
        'target' => ['kind' => 'caput', 'label' => 'Caput', 'blockId' => 'block-caput'],
    ],
]);
if (count($mergedExamTips) !== 2 || ($mergedExamTips[0]['body'] ?? '') !== 'Macete do caput atualizado') {
    throw new RuntimeException('Legal commentary exam tips must replace only the same targeted block.');
}

foreach ([
    'macetes' => 'Legal commentary macete schema must support multiple targeted tips.',
    'Retorne de 1 a 4 macetes' => 'Legal commentary macete prompt must request multiple relevant block tips.',
    '$this->mergeTeacherCommentItems($teacherComments, [$newComment])' => 'Teacher comments must be merged, not replaced wholesale.',
    '$this->mergeExamTipItems($examTips, $maceteEntries)' => 'Exam tips must be merged, not replaced wholesale.',
] as $needle => $message) {
    if (strpos($aiGenerationContent, $needle) === false) {
        throw new RuntimeException($message);
    }
}

foreach ([
    '$teacherComments = [$newComment];' => 'Teacher comments must not be replaced wholesale by a new generated comment.',
    '$examTips = $macete !== \'\' ? [[' => 'Exam tips must not be replaced wholesale by a new generated macete.',
] as $forbidden => $message) {
    if (strpos($aiGenerationContent, $forbidden) !== false) {
        throw new RuntimeException($message);
    }
}

fwrite(STDOUT, "Legal commentary admin wiring assertions passed.\n");
