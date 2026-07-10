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

require_once __DIR__ . '/../repositories/LegalCommentaryRepository.php';
require_once __DIR__ . '/../validators/LegalCommentaryAiEditorialValidator.php';
require_once __DIR__ . '/../../ai/services/AiService.php';

/**
 * Orquestrador editorial da geracao de IA da Lei Comentada.
 *
 * Ele centraliza:
 * - prompts por etapa
 * - schema JSON rigido
 * - validacao editorial no backend
 * - retry seletivo por campo
 * - persistencia opcional por artigo
 *
 * @since 1.0.0
 */
class LegalCommentaryAiGenerationService
{
    private const DEFAULT_MODEL = '';
    private const SECTION_ANALYSIS_MODEL = '';
    private const SECTION_ANALYSIS_MAX_OUTPUT_TOKENS = 14000;
    private const SECTION_ANALYSIS_TEMPERATURE = 0.35;
    private const SECTION_ANALYSIS_CHUNK_INPUT_THRESHOLD = 12000;
    private const SECTION_ANALYSIS_CHUNK_CONTEXT_LIMIT = 9000;
    private const SECTION_ANALYSIS_CHUNK_ARTICLE_LIMIT = 4;
    private const SECTION_ANALYSIS_CHUNK_MAX_OUTPUT_TOKENS = 10000;
    private const SECTION_ANALYSIS_REQUEST_TIMEOUT_SECONDS = 85;
    private const NO_RELEVANT_JURISPRUDENCE_NOTE = 'Nao ha entendimento jurisprudencial relevante e recorrente em provas especificamente sobre este artigo.';

    /**
     * @var string[]
     */
    private array $allowedScopes = [
        'article-full',
        'stage-a',
        'stage-b',
        'stage-c',
        'field-comment',
        'field-macete',
        'field-doutrina',
        'field-jurisprudencia',
        'field-sumulas',
        'section-analysis',
    ];

    public function __construct(
        private readonly LegalCommentaryRepository $repository,
        private readonly AiService $aiService,
        private readonly LegalCommentaryAiEditorialValidator $validator
    ) {
    }

    public function generateArticleEditorial(array $payload): array
    {
        $scope = trim((string) ($payload['scope'] ?? 'article-full'));
        if (!in_array($scope, $this->allowedScopes, true)) {
            throw new InvalidArgumentException('Escopo de geracao da Lei Comentada invalido.');
        }

        if ($scope === 'section-analysis') {
            return $this->generateSectionEditorial($payload);
        }

        $context = $this->resolveContext($payload);
        $batchRunId = (int) ($payload['batchRunId'] ?? 0);
        $shouldPersist = empty($payload['previewOnly'])
            && (
                !empty($payload['persist'])
                || ($context['lawId'] > 0 && $context['articleId'] > 0)
            );

        if ($batchRunId > 0 && $context['articleId'] > 0) {
            $this->repository->markAiBatchItemRunning($batchRunId, $context['articleId']);
        }

        $editorial = $context['existingEditorial'];
        $stageResults = [
            'stageA' => $this->emptyStageResult('skipped'),
            'stageB' => $this->emptyStageResult('skipped'),
            'stageC' => $this->emptyStageResult('skipped'),
        ];

        $fatalError = null;

        if (in_array($scope, ['article-full', 'stage-a', 'field-comment', 'field-macete'], true)) {
            try {
                $stageResults['stageA'] = $this->runStageA($context, $scope);

                if (in_array($scope, ['article-full', 'stage-a', 'field-comment'], true)) {
                    $editorial['teacherComments'] = $stageResults['stageA']['teacherComments'];
                }

                if (in_array($scope, ['article-full', 'stage-a', 'field-macete'], true)) {
                    $editorial['examTips'] = $stageResults['stageA']['examTips'];
                }
            } catch (Throwable $e) {
                $stageResults['stageA'] = $this->emptyStageResult('failed');
                $stageResults['stageA']['warnings'][] = $e->getMessage();
            }
        }

        if (in_array($scope, ['article-full', 'stage-b', 'field-doutrina'], true)) {
            try {
                $stageResults['stageB'] = $this->runStageB($context);
                $editorial['doctrine'] = $stageResults['stageB']['doctrine'];
            } catch (Throwable $e) {
                $stageResults['stageB'] = $this->emptyStageResult('failed');
                $stageResults['stageB']['warnings'][] = $e->getMessage();
            }
        }

        if (in_array($scope, ['article-full', 'stage-c', 'field-jurisprudencia', 'field-sumulas'], true)) {
            try {
                $stageResults['stageC'] = $this->runStageC($context, $scope);

                if (in_array($scope, ['article-full', 'stage-c', 'field-jurisprudencia'], true)) {
                    $editorial['jurisprudence'] = $stageResults['stageC']['jurisprudence'];
                    $editorial['jurisprudenceNotes'] = $stageResults['stageC']['jurisprudenceNotes'];
                }

                if (in_array($scope, ['article-full', 'stage-c', 'field-sumulas'], true)) {
                    $editorial['sumulas'] = $stageResults['stageC']['sumulas'];
                }
            } catch (Throwable $e) {
                $stageResults['stageC'] = $this->emptyStageResult('failed');
                $stageResults['stageC']['warnings'][] = $e->getMessage();
            }
        }

        $persisted = false;
        if ($fatalError === null && $shouldPersist) {
            try {
                $persistedEditorial = $this->repository->replaceArticleEditorialContent(
                    $context['lawId'],
                    $context['articleId'],
                    $editorial
                );
                $editorial = $persistedEditorial;
                $persisted = true;
            } catch (Throwable $e) {
                $fatalError = $e->getMessage();
            }
        }

        $summary = $this->buildSummary($scope, $stageResults, $fatalError);
        $response = [
            'scope' => $scope,
            'lawId' => $context['lawId'] > 0 ? (string) $context['lawId'] : '',
            'articleId' => (string) ($context['articleId'] ?: ($context['article']['id'] ?? '')),
            'articleNumber' => (string) ($context['article']['number'] ?? ''),
            'persisted' => $persisted,
            'editorial' => $editorial,
            'stages' => $stageResults,
            'summary' => $summary,
        ];

        if ($batchRunId > 0 && $context['articleId'] > 0) {
            $batch = $this->repository->recordAiBatchItemResult($batchRunId, $context['articleId'], [
                'status' => $summary['status'],
                'stageAStatus' => $stageResults['stageA']['status'],
                'stageBStatus' => $stageResults['stageB']['status'],
                'stageCStatus' => $stageResults['stageC']['status'],
                'warnings' => $summary['warnings'],
                'attempts' => [
                    'stageA' => $stageResults['stageA']['attempts'],
                    'stageB' => $stageResults['stageB']['attempts'],
                    'stageC' => $stageResults['stageC']['attempts'],
                ],
                'result' => [
                    'approvedBlocks' => $summary['approvedBlocks'],
                    'persisted' => $persisted,
                ],
                'error' => $fatalError,
            ]);
            $response['batch'] = $batch;
        }

        return $response;
    }

    private function generateSectionEditorial(array $payload): array
    {
        $lawId = (int) ($payload['lawId'] ?? $payload['law_id'] ?? ($payload['law']['id'] ?? 0));
        $sectionPayload = is_array($payload['section'] ?? null) ? $payload['section'] : [];
        $lawPayload = is_array($payload['law'] ?? null) ? $payload['law'] : [];

        $lawDetail = $lawId > 0
            ? $this->repository->fetchLawDetail((string) $lawId, null, false)
            : null;
        $law = is_array($lawDetail) ? $lawDetail : $lawPayload;
        $articles = is_array($law['articles'] ?? null) ? $law['articles'] : [];

        $sectionId = trim((string) (
            $sectionPayload['sectionId']
            ?? $sectionPayload['section_id']
            ?? $sectionPayload['id']
            ?? ''
        ));
        $sectionTitle = trim((string) (
            $sectionPayload['sectionTitle']
            ?? $sectionPayload['title']
            ?? $sectionPayload['name']
            ?? 'Capitulo da lei'
        ));

        if ($sectionId === '') {
            throw new InvalidArgumentException('Informe o capitulo para gerar a analise aprofundada.');
        }

        $sectionArticles = $this->resolveSectionArticles($articles, $sectionPayload);
        if (empty($sectionArticles)) {
            throw new InvalidArgumentException('Nenhum artigo foi encontrado para o capitulo selecionado.');
        }

        $context = $this->buildSectionPromptContext($law, $sectionPayload, $sectionArticles);
        $usedChunkedGeneration = $this->shouldChunkSectionAnalysis($context, $sectionArticles);

        try {
            $response = $usedChunkedGeneration
                ? $this->requestChunkedSectionAnalysisResponse($law, $sectionPayload, $sectionArticles, $context)
                : $this->requestSectionAnalysisResponse($context);
            $response = $this->completeSectionAnalysisResponseIfNeeded($response, $context);
        } catch (RuntimeException $exception) {
            if ($usedChunkedGeneration || !$this->isSectionAnalysisSizeFailure($exception->getMessage())) {
                throw $exception;
            }

            $usedChunkedGeneration = true;
            $response = $this->requestChunkedSectionAnalysisResponse($law, $sectionPayload, $sectionArticles, $context);
            $response = $this->completeSectionAnalysisResponseIfNeeded($response, $context);
        }

        $editorial = $this->normalizeSectionEditorialFromAi(
            $response,
            $lawId,
            $sectionPayload,
            $sectionArticles
        );

        $persisted = false;
        $fatalError = null;
        $shouldPersist = $lawId > 0 && empty($payload['previewOnly']);

        if ($shouldPersist) {
            try {
                $editorial = $this->repository->replaceSectionEditorialContent($lawId, $editorial);
                $persisted = true;
            } catch (Throwable $e) {
                $fatalError = $e->getMessage();
            }
        }

        $warnings = [];
        if ($fatalError !== null) {
            $warnings[] = $fatalError;
        }

        return [
            'scope' => 'section-analysis',
            'lawId' => $lawId > 0 ? (string) $lawId : '',
            'articleId' => '',
            'persisted' => $persisted,
            'editorial' => [
                'articleId' => '',
                'articleNumber' => '',
                'teacherComments' => [],
                'examTips' => [],
                'doctrine' => [],
                'jurisprudenceNotes' => [],
                'jurisprudence' => [],
                'sumulas' => [],
            ],
            'sectionEditorial' => $editorial,
            'stages' => [
                'stageA' => $this->emptyStageResult('skipped'),
                'stageB' => $this->emptyStageResult('skipped'),
                'stageC' => $this->emptyStageResult('skipped'),
            ],
            'summary' => [
                'status' => $fatalError === null ? 'success' : 'failed',
                'scope' => 'section-analysis',
                'approvedBlocks' => $this->countSectionEditorialBlocks($editorial),
                'warnings' => $warnings,
                'generationMode' => $usedChunkedGeneration ? 'chunked' : 'single',
            ],
        ];
    }

    public function startBatchRun(int $lawId, ?string $adminUserId = null, array $articleIds = []): array
    {
        if ($lawId <= 0) {
            throw new InvalidArgumentException('Lei invalida para iniciar o lote.');
        }

        return $this->repository->createAiBatchRun($lawId, $adminUserId, $articleIds);
    }

    public function fetchBatchRun(int $runId, ?int $lawId = null): array
    {
        if ($runId > 0) {
            $run = $this->repository->fetchAiBatchRun($runId);
        } elseif ($lawId !== null && $lawId > 0) {
            $run = $this->repository->fetchLatestAiBatchRunForLaw($lawId);
        } else {
            $run = null;
        }

        if (!$run) {
            return [
                'run' => null,
            ];
        }

        return [
            'run' => $run,
        ];
    }

    public function retryFailedBatch(int $runId, ?string $adminUserId = null): array
    {
        if ($runId <= 0) {
            throw new InvalidArgumentException('Lote invalido para reprocessamento.');
        }

        return $this->repository->createRetryAiBatchRun($runId, $adminUserId);
    }

    public function stopBatchRun(int $runId): array
    {
        if ($runId <= 0) {
            throw new InvalidArgumentException('Lote invalido para interrupcao.');
        }

        $run = $this->repository->stopAiBatchRun($runId);
        if (!$run) {
            throw new InvalidArgumentException('Lote nao encontrado para interrupcao.');
        }

        return $run;
    }

    private function resolveSectionArticles(array $articles, array $sectionPayload): array
    {
        $sectionId = trim((string) ($sectionPayload['sectionId'] ?? $sectionPayload['section_id'] ?? $sectionPayload['id'] ?? ''));
        $articleIds = [];
        $rawIds = $sectionPayload['articleIds'] ?? $sectionPayload['article_ids'] ?? [];
        if (!is_array($rawIds)) {
            $rawIds = [];
        }

        foreach ($rawIds as $rawId) {
            $id = trim((string) $rawId);
            if ($id !== '') {
                $articleIds[$id] = true;
            }
        }

        foreach ((array) ($sectionPayload['articles'] ?? []) as $article) {
            if (!is_array($article)) {
                continue;
            }
            $id = trim((string) ($article['id'] ?? ''));
            if ($id !== '') {
                $articleIds[$id] = true;
            }
        }

        $fromArticle = trim((string) ($sectionPayload['fromArticle'] ?? $sectionPayload['from_article'] ?? ''));
        $toArticle = trim((string) ($sectionPayload['toArticle'] ?? $sectionPayload['to_article'] ?? ''));
        $hasRange = $fromArticle !== '' || $toArticle !== '';

        $matched = [];
        foreach ($articles as $article) {
            if (!is_array($article)) {
                continue;
            }

            $articleId = trim((string) ($article['id'] ?? ''));
            $articleSectionId = trim((string) ($article['sectionId'] ?? $article['section_id'] ?? ''));
            $articleNumber = trim((string) ($article['number'] ?? $article['numero'] ?? $article['article_number'] ?? ''));

            if (!empty($articleIds)) {
                if ($articleId === '' || empty($articleIds[$articleId])) {
                    continue;
                }
            } elseif ($sectionId !== '' && $articleSectionId !== '' && $articleSectionId !== $sectionId) {
                continue;
            } elseif ($hasRange && !$this->articleNumberIsWithinRange($articleNumber, $fromArticle, $toArticle)) {
                continue;
            }

            $matched[] = $article;
        }

        return $matched;
    }

    private function articleNumberIsWithinRange(string $number, string $fromArticle, string $toArticle): bool
    {
        $value = $this->articleNumberValue($number);
        if ($value <= 0) {
            return false;
        }

        $from = $fromArticle !== '' ? $this->articleNumberValue($fromArticle) : $value;
        $to = $toArticle !== '' ? $this->articleNumberValue($toArticle) : $value;

        if ($from <= 0) {
            $from = $value;
        }
        if ($to <= 0) {
            $to = $value;
        }
        if ($from > $to) {
            [$from, $to] = [$to, $from];
        }

        return $value >= $from && $value <= $to;
    }

    private function articleNumberValue(string $number): float
    {
        $normalized = strtoupper(trim(html_entity_decode($number, ENT_QUOTES, 'UTF-8')));
        $normalized = str_replace(['ART.', 'ARTIGO', 'º', '°'], '', $normalized);
        if (!preg_match('/(\d+)(?:\s*[-A-Z]*\s*([A-Z]))?/u', $normalized, $matches)) {
            return 0.0;
        }

        $base = (float) $matches[1];
        $suffix = isset($matches[2]) && $matches[2] !== ''
            ? ((ord($matches[2]) - 64) / 100)
            : 0.0;

        return $base + $suffix;
    }

    private function buildSectionPromptContext(
        array $law,
        array $sectionPayload,
        array $sectionArticles,
        int $articleTextLimit = 2200,
        int $articleStructureLimit = 1400,
        int $sectionContextLimit = 24000
    ): array
    {
        $lawTitle = trim((string) ($law['shortTitle'] ?? $law['title'] ?? 'Lei Comentada'));
        $lawNumber = trim((string) ($law['number'] ?? $law['numero'] ?? ''));
        $sectionTitle = trim((string) (
            $sectionPayload['sectionTitle']
            ?? $sectionPayload['title']
            ?? $sectionPayload['name']
            ?? 'Capitulo da lei'
        ));
        $rangeLabel = trim((string) ($sectionPayload['rangeLabel'] ?? $sectionPayload['range_label'] ?? ''));
        $fromArticle = trim((string) ($sectionPayload['fromArticle'] ?? $sectionPayload['from_article'] ?? ''));
        $toArticle = trim((string) ($sectionPayload['toArticle'] ?? $sectionPayload['to_article'] ?? ''));

        $articleParts = [];
        $existingEditorialParts = [];
        foreach ($sectionArticles as $article) {
            if (!is_array($article)) {
                continue;
            }

            $number = trim((string) ($article['number'] ?? $article['numero'] ?? ''));
            $articleText = $this->buildArticleTextForPrompt([
                'number' => $number,
                'title' => (string) ($article['title'] ?? $article['titulo'] ?? ''),
                'text' => (string) ($article['text'] ?? $article['texto'] ?? ''),
                'blocks' => is_array($article['blocks'] ?? null) ? $article['blocks'] : [],
            ]);
            $structure = $this->buildArticleStructureForPrompt([
                'number' => $number,
                'blocks' => is_array($article['blocks'] ?? null) ? $article['blocks'] : [],
            ]);

            $articleParts[] = trim(
                'ARTIGO ' . ($number !== '' ? $number : '?') . "\n"
                . $this->limitPromptText($articleText, $articleTextLimit)
                . ($structure !== '' ? "\n" . $this->limitPromptText($structure, $articleStructureLimit) : '')
            );

            $comment = $this->firstNonEmptyText($article['comentarios'][0]['body'] ?? null, $article['comentarios'][0]['texto'] ?? null);
            $macete = $this->firstNonEmptyText($article['macete'] ?? null, $article['examTip'] ?? null);
            $doctrine = is_array($article['doctrine'] ?? null)
                ? implode(' | ', array_slice(array_values(array_filter(array_map([$this, 'formatTargetedTextForPrompt'], $article['doctrine']))), 0, 3))
                : '';

            $editorialLine = trim(implode(' | ', array_filter([
                $number !== '' ? 'Art. ' . $number : '',
                $comment !== '' ? 'Comentario: ' . $comment : '',
                $macete !== '' ? 'Macete: ' . $macete : '',
                $doctrine !== '' ? 'Doutrina: ' . $doctrine : '',
            ])));
            if ($editorialLine !== '') {
                $existingEditorialParts[] = $this->limitPromptText($editorialLine, 1200);
            }
        }

        return [
            'lawTitle' => $lawTitle,
            'lawNumber' => $lawNumber,
            'lawOfficialUrl' => trim((string) ($law['officialUrl'] ?? $law['official_url'] ?? $law['sourceUrl'] ?? '')),
            'sectionTitle' => $sectionTitle,
            'rangeLabel' => $rangeLabel,
            'fromArticle' => $fromArticle,
            'toArticle' => $toArticle,
            'articleCount' => count($sectionArticles),
            'articleContext' => $this->limitPromptText(implode("\n\n---\n\n", $articleParts), $sectionContextLimit),
            'existingEditorialContext' => $this->limitPromptText(implode("\n", $existingEditorialParts), 9000),
        ];
    }

    private function normalizeSectionEditorialFromAi(array $response, int $lawId, array $sectionPayload, array $sectionArticles): array
    {
        $sectionTitle = trim((string) (
            $sectionPayload['sectionTitle']
            ?? $sectionPayload['title']
            ?? $sectionPayload['name']
            ?? 'Capitulo da lei'
        ));
        $rangeLabel = trim((string) ($sectionPayload['rangeLabel'] ?? $sectionPayload['range_label'] ?? ''));

        $highlights = [];
        $articlesByNumber = [];
        foreach ($sectionArticles as $article) {
            if (!is_array($article)) {
                continue;
            }
            $number = trim((string) ($article['number'] ?? $article['numero'] ?? ''));
            if ($number !== '') {
                $articlesByNumber[$number] = $article;
            }
        }

        foreach (is_array($response['highlights'] ?? null) ? $response['highlights'] : [] as $item) {
            if (!is_array($item)) {
                continue;
            }
            $articleNumber = trim((string) ($item['articleNumber'] ?? $item['artigo'] ?? ''));
            $article = $articlesByNumber[$articleNumber] ?? null;
            $title = trim((string) ($item['title'] ?? $item['titulo'] ?? ''));
            $excerpt = trim((string) ($item['excerpt'] ?? $item['trecho'] ?? ''));
            if ($articleNumber === '' && $title === '' && $excerpt === '') {
                continue;
            }
            $highlights[] = [
                'articleId' => is_array($article) ? (string) ($article['id'] ?? '') : '',
                'articleNumber' => $articleNumber,
                'title' => $title !== '' ? $title : 'Ponto-chave',
                'excerpt' => $excerpt,
            ];
        }

        if (empty($highlights)) {
            foreach (array_slice($sectionArticles, 0, 4) as $article) {
                if (!is_array($article)) {
                    continue;
                }
                $number = trim((string) ($article['number'] ?? $article['numero'] ?? ''));
                $text = $this->firstNonEmptyText($article['text'] ?? null, $article['texto'] ?? null);
                $highlights[] = [
                    'articleId' => (string) ($article['id'] ?? ''),
                    'articleNumber' => $number,
                    'title' => trim((string) ($article['title'] ?? $article['titulo'] ?? 'Ponto-chave')),
                    'excerpt' => $this->limitPromptText($text, 220),
                ];
            }
        }

        $summary = $this->firstNonEmptyText(
            $response['summary'] ?? null,
            $response['resumoEstrategico'] ?? null,
            $response['panoramaGeral'] ?? null
        );
        $continuousAnalysis = $this->firstNonEmptyText(
            $response['analiseContinuaHtml'] ?? null,
            $response['analiseContinua'] ?? null,
            $response['mainAnalysisHtml'] ?? null,
            $response['mainAnalysis'] ?? null
        );
        $continuousAnalysis = $this->stripSectionAnalysisGreeting($continuousAnalysis);
        $blocks = $this->buildStrategicSectionBlocks($response, $continuousAnalysis);
        $examFocus = $this->cleanStringList($response['examFocus'] ?? [], 12);
        if (empty($examFocus)) {
            $examFocus = $this->extractExamFocusFromSectionResponse($response);
        }
        $keywords = $this->cleanStringList($response['keywords'] ?? [], 16);
        $keywords = array_values(array_unique(array_merge(
            $keywords,
            $this->extractKeywordsFromTerms($response['termosChave'] ?? [])
        )));

        return [
            'lawId' => $lawId > 0 ? (string) $lawId : '',
            'sectionId' => trim((string) ($sectionPayload['sectionId'] ?? $sectionPayload['section_id'] ?? $sectionPayload['id'] ?? '')),
            'sectionTitle' => $sectionTitle,
            'rangeLabel' => $rangeLabel,
            'fromArticle' => $sectionPayload['fromArticle'] ?? $sectionPayload['from_article'] ?? null,
            'toArticle' => $sectionPayload['toArticle'] ?? $sectionPayload['to_article'] ?? null,
            'articleCount' => count($sectionArticles),
            'importance' => $this->normalizeImportance((string) ($response['importance'] ?? '')),
            'style' => $this->sanitizeInlineText((string) ($response['style'] ?? '')),
            'summary' => $summary,
            'blocks' => $blocks,
            'examFocus' => $examFocus,
            'examFocusText' => $this->sanitizeInlineText((string) ($response['exam_focus'] ?? $response['examFocusText'] ?? '')),
            'keywords' => array_slice($keywords, 0, 16),
            'avoidRepetitionNote' => $this->sanitizeInlineText((string) ($response['avoid_repetition_note'] ?? $response['avoidRepetitionNote'] ?? '')),
            'macetes' => $this->normalizeSectionMaceteList($response['macetes'] ?? []),
            'doctrine' => $this->cleanStringList($response['doctrine'] ?? []),
            'jurisprudence' => $this->collectSectionJurisprudence($sectionArticles),
            'sumulas' => $this->collectSectionSumulas($sectionArticles),
            'highlights' => $highlights,
        ];
    }

    private function buildStrategicSectionBlocks(array $response, string $continuousAnalysis = ''): array
    {
        $blocks = [];

        $narrative = $this->sanitizeGeneratedStudyHtml($this->stripSectionAnalysisGreeting($continuousAnalysis));
        if ($narrative === '') {
            $narrative = $this->sanitizeGeneratedStudyHtml($this->stripSectionAnalysisGreeting($this->buildContinuousSectionAnalysisHtml($response)));
        }

        if ($narrative !== '') {
            $blocks[] = [
                'type' => 'summary',
                'title' => 'Analise detalhada da secao',
                'content' => $narrative,
                'items' => [],
                'headers' => [],
                'rows' => [],
                'target' => ['kind' => 'section'],
            ];

            return $blocks;
        }

        $this->appendBlock($blocks, $this->buildTableBlockFromRecords(
            $response['visaoGeralTabela'] ?? [],
            'Visao geral estrategica',
            [
                'Unidade' => ['unidade'],
                'Artigos' => ['artigos'],
                'Importancia' => ['importancia'],
                'Incidencia' => ['incidencia', 'incidenciaEstimada'],
                'Bancas' => ['bancas'],
                'Perfil' => ['perfilCobranca', 'perfil_cobranca'],
                'Dificuldade' => ['dificuldade'],
                'Pontos perigosos' => ['pontosPerigosos', 'pontos_perigosos'],
                'Prioridade' => ['prioridade'],
            ],
            3
        ));

        $panorama = $this->firstNonEmptyText($response['panoramaGeral'] ?? null, $response['resumoEstrategico'] ?? null);
        if ($panorama !== '') {
            $blocks[] = [
                'type' => 'summary',
                'title' => 'Panorama geral',
                'content' => $panorama,
                'items' => [],
                'headers' => [],
                'rows' => [],
                'target' => ['kind' => 'section'],
            ];
        }

        $this->appendBlock($blocks, $this->buildTableBlockFromRecords(
            $response['analisePorDispositivo'] ?? [],
            'Aprofundamento por dispositivo',
            [
                'Dispositivo' => ['dispositivo', 'artigo'],
                'Nucleo' => ['nucleo', 'nucleoDispositivo'],
                'Finalidade / interpretacao' => ['finalidade', 'interpretacaoJuridica', 'interpretacao'],
                'Como a banca cobra' => ['comoBancaCobra', 'como_cobra', 'cobranca'],
                'Pegadinha / erro comum' => ['pegadinha', 'erroComum'],
                'Assertiva exemplo' => ['assertivaExemplo', 'assertiva'],
                'Estrategia' => ['comentarioEstrategico', 'estrategia'],
            ],
            12
        ));

        $this->appendBlock($blocks, $this->buildTableOrTextBlock(
            $response['comoCaiEmProva'] ?? null,
            'Como isso cai em prova',
            ['Tipo', 'Cobranca', 'Atencao'],
            [
                'Tipo' => ['tipo'],
                'Cobranca' => ['cobranca', 'comoCobra'],
                'Atencao' => ['atencao', 'cuidado'],
            ],
            'tip'
        ));

        $this->appendBlock($blocks, $this->buildTableBlockFromRecords(
            $response['perfilPorBanca'] ?? [],
            'Perfil por banca',
            [
                'Banca' => ['banca'],
                'Estilo provavel' => ['estilo'],
                'Profundidade' => ['profundidade'],
                'Exemplo' => ['exemplo'],
                'Risco de pegadinha' => ['riscoPegadinha', 'risco'],
            ],
            8
        ));

        $this->appendBlock($blocks, $this->buildTableBlockFromRecords(
            $response['incidenciaEstimativa'] ?? [],
            'Incidencia estimada em provas',
            [
                'Tema' => ['tema'],
                'Relevancia' => ['relevancia'],
                'Incidencia estimada' => ['incidenciaEstimada', 'incidencia'],
                'Justificativa' => ['justificativa'],
                'Prioridade' => ['prioridade'],
            ],
            10
        ));

        $this->appendBlock($blocks, $this->buildTableBlockFromRecords(
            $response['pegadinhas'] ?? [],
            'Pegadinhas que a banca adora',
            [
                'Pegadinha' => ['pegadinha'],
                'Por que esta errada' => ['porQueErrada', 'porqueErrada', 'erro'],
                'Como memorizar' => ['comoMemorizar', 'memorizacao'],
            ],
            10,
            'warning'
        ));

        $jurisprudencia = $this->firstNonEmptyText($response['jurisprudencia'] ?? null, $response['jurisprudence'] ?? null);
        if ($jurisprudencia !== '') {
            $blocks[] = [
                'type' => 'jurisprudence',
                'title' => 'Jurisprudencia e sumulas',
                'content' => $jurisprudencia,
                'items' => [],
                'headers' => [],
                'rows' => [],
                'target' => ['kind' => 'section'],
            ];
        }

        $doctrineItems = $this->cleanStringList($response['doctrine'] ?? [], 6);
        if (!empty($doctrineItems)) {
            $blocks[] = [
                'type' => 'comparison',
                'title' => 'Doutrina majoritaria e leitura segura',
                'content' => '',
                'items' => $doctrineItems,
                'headers' => [],
                'rows' => [],
                'target' => ['kind' => 'section'],
            ];
        }

        $this->appendBlock($blocks, $this->buildTableBlockFromRecords(
            $response['termosChave'] ?? [],
            'Termos-chave para grifar',
            [
                'Termo' => ['termo', 'expressao'],
                'Por que importa' => ['motivo', 'relevancia'],
                'Risco' => ['risco', 'pegadinha'],
            ],
            14,
            'tip'
        ));

        $this->appendBlock($blocks, $this->buildTableBlockFromRecords(
            $response['macetes'] ?? [],
            'Macetes uteis',
            [
                'Macete' => ['nome', 'macete'],
                'Aplicacao' => ['aplicacao'],
                'Ajuda a lembrar' => ['ajudaLembrar', 'ajuda'],
                'Limite' => ['limite'],
            ],
            8,
            'macete'
        ));

        $mapaMental = $this->firstNonEmptyText($response['mapaMental'] ?? null, $response['mindMap'] ?? null);
        if ($mapaMental !== '') {
            $blocks[] = [
                'type' => 'summary',
                'title' => 'Mapa mental textual',
                'content' => $mapaMental,
                'items' => [],
                'headers' => [],
                'rows' => [],
                'target' => ['kind' => 'section'],
            ];
        }

        $this->appendBlock($blocks, $this->buildTableBlockFromRecords(
            $response['questoesSimuladas'] ?? [],
            'Questoes simuladas',
            [
                'Tipo' => ['tipo'],
                'Enunciado' => ['enunciado'],
                'Alternativas' => ['alternativas'],
                'Gabarito' => ['gabarito'],
                'Comentario' => ['comentario'],
            ],
            5,
            'example'
        ));

        $checklistItems = $this->recordsToBulletItems(
            $response['checklistRevisao'] ?? [],
            ['categoria', 'item'],
            10
        );
        if (!empty($checklistItems)) {
            $blocks[] = [
                'type' => 'summary',
                'title' => 'Checklist de revisao rapida',
                'content' => '',
                'items' => $checklistItems,
                'headers' => [],
                'rows' => [],
                'target' => ['kind' => 'section'],
            ];
        }

        return $blocks;
    }

    private function stripSectionAnalysisGreeting(string $html): string
    {
        $content = trim($html);
        if ($content === '') {
            return '';
        }

        $plainPrefix = mb_substr(trim(strip_tags($content)), 0, 260);
        if (preg_match('/^Ol(?:a|\x{00E1})[,!]/iu', $plainPrefix) !== 1) {
            return $content;
        }

        if (preg_match('/^\s*<p\b[^>]*>[\s\S]{0,500}?<\/p>\s*/iu', $content, $match) === 1) {
            return trim(substr($content, strlen($match[0])));
        }

        return trim((string) preg_replace('/^\s*Ol(?:a|\x{00E1})[^.!?]{0,260}[.!?]\s*/iu', '', $content, 1));
    }

    private function sanitizeGeneratedStudyHtml(string $html): string
    {
        $content = trim($html);
        if ($content === '') {
            return '';
        }

        $content = preg_replace('/^```(?:html)?\s*/iu', '', $content) ?: $content;
        $content = preg_replace('/\s*```$/u', '', $content) ?: $content;
        $content = preg_replace('#<\s*(script|style|iframe|object|embed)\b[^>]*>[\s\S]*?<\s*/\s*\1\s*>#iu', '', $content) ?: $content;
        $content = preg_replace('#<\s*(script|style|iframe|object|embed)\b[^>]*\/?\s*>#iu', '', $content) ?: $content;
        $content = preg_replace('/\son[a-z]+\s*=\s*("[^"]*"|\'[^\']*\'|[^\s>]+)/iu', '', $content) ?: $content;
        $content = preg_replace('/\s(href|src)\s*=\s*([\'"])\s*javascript:[\s\S]*?\2/iu', '', $content) ?: $content;
        $content = trim($content);

        if (preg_match('/<(p|h1|h2|h3|h4|ul|ol|li|table|blockquote|div|section|strong|em|mark|span)\b/i', $content) === 1) {
            return $content;
        }

        $paragraphs = preg_split('/\R{2,}/u', $content) ?: [];
        $htmlParts = [];
        foreach ($paragraphs as $paragraph) {
            $paragraph = trim($paragraph);
            if ($paragraph === '') {
                continue;
            }
            if (preg_match('/^#{1,4}\s+(.+)$/u', $paragraph, $match) === 1) {
                $htmlParts[] = '<h3>' . htmlspecialchars(trim($match[1]), ENT_QUOTES, 'UTF-8') . '</h3>';
                continue;
            }
            $htmlParts[] = '<p>' . nl2br(htmlspecialchars($paragraph, ENT_QUOTES, 'UTF-8')) . '</p>';
        }

        return trim(implode('', $htmlParts));
    }

    private function normalizeSupplementalSectionBlocks($value, int $limit = 2): array
    {
        $blocks = $this->normalizeRichBlocks($value, 8);
        if (empty($blocks)) {
            return [];
        }

        $supplemental = [];
        foreach ($blocks as $block) {
            $type = (string) ($block['type'] ?? 'paragraph');
            $title = $this->sanitizeInlineText((string) ($block['title'] ?? ''));
            if ($type === 'paragraph' || $type === 'summary') {
                continue;
            }
            if (preg_match('/analise|panorama|proposito|fundamento|universalidade|direitos assegurados/i', $title)) {
                continue;
            }
            $supplemental[] = $block;
            if (count($supplemental) >= $limit) {
                break;
            }
        }

        return $supplemental;
    }

    private function buildContinuousSectionAnalysisHtml(array $response): string
    {
        $parts = [];

        $overviewRows = $this->normalizeRecordList($response['visaoGeralTabela'] ?? []);
        if (!empty($overviewRows)) {
            $cells = [];
            $overview = $overviewRows[0];
            foreach ([
                'Unidade' => ['unidade'],
                'Artigos' => ['artigos'],
                'Importancia' => ['importancia'],
                'Incidencia' => ['incidencia', 'incidenciaEstimada'],
                'Bancas' => ['bancas'],
                'Prioridade' => ['prioridade'],
            ] as $label => $keys) {
                $value = $this->readRecordValue($overview, $keys);
                if ($value !== '') {
                    $cells[] = '<tr><th>' . $label . '</th><td>' . $value . '</td></tr>';
                }
            }
            if (!empty($cells)) {
                $parts[] = '<h3>Visao geral estrategica</h3><table><tbody>' . implode('', $cells) . '</tbody></table>';
            }
        }

        $panorama = $this->firstNonEmptyText($response['panoramaGeral'] ?? null, $response['resumoEstrategico'] ?? null);
        if ($panorama !== '') {
            $parts[] = '<h3>Panorama da secao</h3><p>' . $panorama . '</p>';
        }

        $deviceParagraphs = [];
        foreach ($this->normalizeRecordList($response['analisePorDispositivo'] ?? []) as $record) {
            $dispositivo = $this->readRecordValue($record, ['dispositivo', 'artigo']);
            $nucleo = $this->readRecordValue($record, ['nucleo', 'nucleoDispositivo']);
            $explicacao = $this->readRecordValue($record, ['explicacaoProva', 'interpretacaoJuridica', 'interpretacao']);
            $cobranca = $this->readRecordValue($record, ['comoBancaCobra', 'como_cobra', 'cobranca']);
            $pegadinha = $this->readRecordValue($record, ['pegadinha', 'erroComum']);
            $estrategia = $this->readRecordValue($record, ['comentarioEstrategico', 'estrategia']);

            $lineParts = array_filter([
                $nucleo !== '' ? '<strong>' . $nucleo . '.</strong>' : '',
                $explicacao,
                $cobranca !== '' ? '<strong>Em prova:</strong> ' . $cobranca : '',
                $pegadinha !== '' ? '<mark>Pegadinha:</mark> ' . $pegadinha : '',
                $estrategia !== '' ? '<em>' . $estrategia . '</em>' : '',
            ]);
            if (!empty($lineParts)) {
                $deviceParagraphs[] = '<p>' . ($dispositivo !== '' ? '<strong>' . $dispositivo . ':</strong> ' : '') . implode(' ', $lineParts) . '</p>';
            }
        }
        if (!empty($deviceParagraphs)) {
            $parts[] = '<h3>Leitura de prova dos dispositivos</h3>' . implode('', array_slice($deviceParagraphs, 0, 12));
        }

        $examItems = $this->recordsToBulletItems($response['comoCaiEmProva'] ?? [], ['tipo', 'cobranca', 'atencao'], 8);
        if (!empty($examItems)) {
            $parts[] = '<h3>Como isso cai em prova</h3><ul><li>' . implode('</li><li>', $examItems) . '</li></ul>';
        }

        $pitfallItems = $this->recordsToBulletItems($response['pegadinhas'] ?? [], ['pegadinha', 'porQueErrada', 'comoMemorizar'], 8);
        if (!empty($pitfallItems)) {
            $parts[] = '<h3>Pegadinhas que a banca adora</h3><ul><li>' . implode('</li><li>', $pitfallItems) . '</li></ul>';
        }

        $jurisprudencia = $this->firstNonEmptyText($response['jurisprudencia'] ?? null, $response['jurisprudence'] ?? null);
        if ($jurisprudencia !== '') {
            $parts[] = '<h3>Jurisprudencia, sumulas e conexoes</h3><p>' . $jurisprudencia . '</p>';
        }

        $termItems = $this->recordsToBulletItems($response['termosChave'] ?? [], ['termo', 'motivo', 'risco'], 10);
        if (!empty($termItems)) {
            $parts[] = '<h3>Termos-chave para grifar</h3><ul><li>' . implode('</li><li>', $termItems) . '</li></ul>';
        }

        $maceteItems = $this->recordsToBulletItems($response['macetes'] ?? [], ['nome', 'aplicacao', 'limite'], 6);
        if (!empty($maceteItems)) {
            $parts[] = '<h3>Macetes uteis</h3><ul><li>' . implode('</li><li>', $maceteItems) . '</li></ul>';
        }

        $mapaMental = $this->firstNonEmptyText($response['mapaMental'] ?? null, $response['mindMap'] ?? null);
        if ($mapaMental !== '') {
            $parts[] = '<h3>Mapa mental textual</h3><p>' . nl2br($mapaMental) . '</p>';
        }

        $questions = $this->normalizeRecordList($response['questoesSimuladas'] ?? []);
        if (!empty($questions)) {
            $questionItems = [];
            foreach (array_slice($questions, 0, 5) as $question) {
                $enunciado = $this->readRecordValue($question, ['enunciado']);
                $gabarito = $this->readRecordValue($question, ['gabarito']);
                $comentario = $this->readRecordValue($question, ['comentario']);
                if ($enunciado !== '') {
                    $questionItems[] = '<li>' . $enunciado . ($gabarito !== '' ? ' <strong>Gabarito:</strong> ' . $gabarito : '') . ($comentario !== '' ? ' ' . $comentario : '') . '</li>';
                }
            }
            if (!empty($questionItems)) {
                $parts[] = '<h3>Questoes simuladas para revisar</h3><ol>' . implode('', $questionItems) . '</ol>';
            }
        }

        $checklistItems = $this->recordsToBulletItems($response['checklistRevisao'] ?? [], ['categoria', 'item'], 10);
        if (!empty($checklistItems)) {
            $parts[] = '<h3>Checklist de revisao rapida</h3><ul><li>' . implode('</li><li>', $checklistItems) . '</li></ul>';
        }

        return trim(implode("\n\n", $parts));
    }

    private function appendBlock(array &$blocks, ?array $block): void
    {
        if ($block !== null && $this->richBlockHasContent($block)) {
            $blocks[] = $block;
        }
    }

    private function buildTableOrTextBlock($value, string $title, array $headers, array $columns, string $type = 'table'): ?array
    {
        if (is_string($value) && trim($value) !== '') {
            return [
                'type' => $type === 'table' ? 'paragraph' : $type,
                'title' => $title,
                'content' => trim($value),
                'items' => [],
                'headers' => [],
                'rows' => [],
                'target' => ['kind' => 'section'],
            ];
        }

        return $this->buildTableBlockFromRecords($value, $title, $columns, 10, $type);
    }

    private function buildTableBlockFromRecords($value, string $title, array $columns, int $limit = 10, string $type = 'table'): ?array
    {
        $records = $this->normalizeRecordList($value);
        if (empty($records)) {
            return null;
        }

        $headers = array_keys($columns);
        $rows = [];
        foreach ($records as $record) {
            $row = [];
            foreach ($columns as $keys) {
                $row[] = $this->readRecordValue($record, (array) $keys);
            }
            if (implode('', $row) !== '') {
                $rows[] = $row;
            }
            if (count($rows) >= $limit) {
                break;
            }
        }

        if (empty($rows)) {
            return null;
        }

        return [
            'type' => 'table',
            'title' => $title,
            'content' => '',
            'items' => [],
            'headers' => $headers,
            'rows' => $rows,
            'target' => ['kind' => 'section'],
        ];
    }

    private function normalizeRecordList($value): array
    {
        if (!is_array($value)) {
            return [];
        }

        if ($this->isListArray($value)) {
            return array_values(array_filter($value, 'is_array'));
        }

        return [$value];
    }

    private function isListArray(array $value): bool
    {
        if ($value === []) {
            return true;
        }

        return array_keys($value) === range(0, count($value) - 1);
    }

    private function readRecordValue(array $record, array $keys): string
    {
        foreach ($keys as $key) {
            if (array_key_exists($key, $record)) {
                $text = $this->valueToPlainText($record[$key]);
                if ($text !== '') {
                    return $text;
                }
            }
        }

        return '';
    }

    private function valueToPlainText($value): string
    {
        if (is_array($value)) {
            if ($this->isListArray($value)) {
                return $this->sanitizeInlineText(implode(' | ', array_map(fn ($item): string => $this->valueToPlainText($item), $value)));
            }

            return $this->sanitizeInlineText(implode(' | ', array_map(fn ($item): string => $this->valueToPlainText($item), array_values($value))));
        }

        return $this->sanitizeInlineText((string) $value);
    }

    private function recordsToBulletItems($value, array $keys, int $limit): array
    {
        $items = [];
        foreach ($this->normalizeRecordList($value) as $record) {
            $parts = [];
            foreach ($keys as $key) {
                $text = $this->readRecordValue($record, [$key]);
                if ($text !== '') {
                    $parts[] = $text;
                }
            }
            if (!empty($parts)) {
                $items[] = implode(': ', array_slice($parts, 0, 2));
            }
            if (count($items) >= $limit) {
                break;
            }
        }

        return $items;
    }

    private function extractExamFocusFromSectionResponse(array $response): array
    {
        $items = [];
        foreach ($this->normalizeRecordList($response['comoCaiEmProva'] ?? []) as $record) {
            $tipo = $this->readRecordValue($record, ['tipo']);
            $cobranca = $this->readRecordValue($record, ['cobranca', 'comoCobra']);
            $atencao = $this->readRecordValue($record, ['atencao', 'cuidado']);
            $line = trim(($tipo !== '' ? $tipo . ': ' : '') . $cobranca . ($atencao !== '' ? ' Atencao: ' . $atencao : ''));
            if ($line !== '') {
                $items[] = $line;
            }
        }

        return array_slice(array_values(array_unique($items)), 0, 8);
    }

    private function extractKeywordsFromTerms($value): array
    {
        $keywords = [];
        foreach ($this->normalizeRecordList($value) as $record) {
            $term = $this->readRecordValue($record, ['termo', 'expressao']);
            if ($term !== '') {
                $keywords[] = $term;
            }
        }

        return $keywords;
    }

    private function normalizeSectionMaceteList($value): array
    {
        if (!is_array($value)) {
            return $this->cleanStringList($value);
        }

        if ($this->isListArray($value) && isset($value[0]) && !is_array($value[0])) {
            return $this->cleanStringList($value, 8);
        }

        $items = [];
        foreach ($this->normalizeRecordList($value) as $record) {
            $name = $this->readRecordValue($record, ['nome', 'macete']);
            $application = $this->readRecordValue($record, ['aplicacao']);
            $memory = $this->readRecordValue($record, ['ajudaLembrar', 'ajuda']);
            $limit = $this->readRecordValue($record, ['limite']);
            $text = trim(implode(' | ', array_filter([
                $name !== '' ? $name : null,
                $application !== '' ? 'Aplicacao: ' . $application : null,
                $memory !== '' ? 'Ajuda a lembrar: ' . $memory : null,
                $limit !== '' ? 'Limite: ' . $limit : null,
            ])));
            if ($text !== '') {
                $items[] = $text;
            }
            if (count($items) >= 8) {
                break;
            }
        }

        return array_values(array_unique($items));
    }

    private function dedupeRichBlocks(array $blocks, int $limit): array
    {
        $result = [];
        $seen = [];
        foreach ($blocks as $block) {
            if (!is_array($block) || !$this->richBlockHasContent($block)) {
                continue;
            }
            $key = md5(json_encode([
                $block['type'] ?? '',
                $block['title'] ?? '',
                $block['content'] ?? '',
                $block['items'] ?? [],
                $block['headers'] ?? [],
                $block['rows'] ?? [],
            ], JSON_UNESCAPED_UNICODE));
            if (isset($seen[$key])) {
                continue;
            }
            $seen[$key] = true;
            $result[] = $block;
            if (count($result) >= $limit) {
                break;
            }
        }

        return $result;
    }

    private function richBlockHasContent(array $block): bool
    {
        return trim((string) ($block['content'] ?? '')) !== ''
            || !empty($block['items'])
            || !empty($block['rows']);
    }

    private function collectSectionJurisprudence(array $sectionArticles): array
    {
        $items = [];
        foreach ($sectionArticles as $article) {
            if (!is_array($article)) {
                continue;
            }
            foreach (is_array($article['jurisprudencia'] ?? null) ? $article['jurisprudencia'] : [] as $entry) {
                if (is_array($entry)) {
                    $items[] = $entry;
                }
            }
        }

        return array_slice($items, 0, 8);
    }

    private function collectSectionSumulas(array $sectionArticles): array
    {
        $items = [];
        foreach ($sectionArticles as $article) {
            if (!is_array($article)) {
                continue;
            }
            foreach (is_array($article['sumulas'] ?? null) ? $article['sumulas'] : [] as $entry) {
                if (is_array($entry)) {
                    $items[] = $entry;
                }
            }
        }

        return array_slice($items, 0, 8);
    }

    private function countSectionEditorialBlocks(array $editorial): int
    {
        $count = trim((string) ($editorial['summary'] ?? '')) !== '' ? 1 : 0;
        foreach (['blocks', 'examFocus', 'macetes', 'doctrine', 'jurisprudence', 'sumulas', 'highlights'] as $key) {
            $count += count(is_array($editorial[$key] ?? null) ? $editorial[$key] : []);
        }

        return $count;
    }

    private function runStageA(array $context, string $scope): array
    {
        $stage = $this->emptyStageResult('success');
        $stage['attempts'] = ['comentario' => 0, 'macete' => 0];
        $comment = '';
        $macete = '';
        $maceteEntries = [];
        $richBlocks = [];
        $importance = '';
        $style = '';
        $keywords = [];
        $avoidRepetitionNote = '';

        if ($scope === 'field-comment') {
            $stage['attempts']['comentario'] = 1;
            $response = $this->requestJson(
                $this->buildPromptFieldComment($context),
                $this->schemaFieldComment()
            );
            $comment = $this->fitGeneratedComment($this->validator->normalizeComment((string) ($response['comentario'] ?? '')));
            $richBlocks = $this->normalizeRichBlocksTargets($this->normalizeRichBlocks($response['blocks'] ?? []), $context);
            $importance = $this->normalizeImportance((string) ($response['importance'] ?? ''));
            $style = $this->sanitizeInlineText((string) ($response['style'] ?? ''));
            $keywords = $this->cleanStringList($response['keywords'] ?? [], 12);
            $avoidRepetitionNote = $this->sanitizeInlineText((string) ($response['avoid_repetition_note'] ?? $response['avoidRepetitionNote'] ?? ''));
        } elseif ($scope === 'field-macete') {
            $stage['attempts']['macete'] = 1;
            $response = $this->requestJson(
                $this->buildPromptFieldMacete($context),
                $this->schemaFieldMacete()
            );
            $maceteEntries = $this->buildMaceteTipEntriesFromResponse($response, $context, $comment);
            $macete = (string) ($maceteEntries[0]['body'] ?? '');
        } else {
            $stage['attempts'] = ['comentario' => 1, 'macete' => 1];
            $response = $this->requestJson(
                $this->buildPromptStageA($context),
                $this->schemaStageA()
            );
            $comment = $this->fitGeneratedComment($this->validator->normalizeComment((string) ($response['comentario'] ?? '')));
            $maceteEntries = $this->buildMaceteTipEntriesFromResponse($response, $context, $comment);
            $macete = (string) ($maceteEntries[0]['body'] ?? '');
            $richBlocks = $this->normalizeRichBlocksTargets($this->normalizeRichBlocks($response['blocks'] ?? []), $context);
            $importance = $this->normalizeImportance((string) ($response['importance'] ?? ''));
            $style = $this->sanitizeInlineText((string) ($response['style'] ?? ''));
            $keywords = $this->cleanStringList($response['keywords'] ?? [], 12);
            $avoidRepetitionNote = $this->sanitizeInlineText((string) ($response['avoid_repetition_note'] ?? $response['avoidRepetitionNote'] ?? ''));
        }

        if (in_array($scope, ['article-full', 'stage-a', 'field-comment'], true)
            && !$this->validator->isValidComment($comment, $context['articleText'])) {
            $stage['regeneratedFields'][] = 'comentario';
            $stage['attempts']['comentario'] = 2;
            $retry = $this->requestJson(
                $this->buildPromptFieldComment($context),
                $this->schemaFieldComment()
            );
            $comment = $this->fitGeneratedComment($this->validator->normalizeComment((string) ($retry['comentario'] ?? '')));
            $retryBlocks = $this->normalizeRichBlocksTargets($this->normalizeRichBlocks($retry['blocks'] ?? []), $context);
            if (!empty($retryBlocks)) {
                $richBlocks = $retryBlocks;
            }
            $importance = $this->normalizeImportance((string) ($retry['importance'] ?? $importance));
            $style = $this->sanitizeInlineText((string) ($retry['style'] ?? $style));
            $keywords = $this->cleanStringList($retry['keywords'] ?? $keywords, 12);
            $avoidRepetitionNote = $this->sanitizeInlineText((string) ($retry['avoid_repetition_note'] ?? $retry['avoidRepetitionNote'] ?? $avoidRepetitionNote));
            if (!$this->validator->isValidComment($comment, $context['articleText'])) {
                $comment = '';
                $stage['warnings'][] = 'Comentario descartado por falta de densidade pedagogica.';
            }
        }

        if (in_array($scope, ['article-full', 'stage-a', 'field-macete'], true)
            && !$this->validator->isValidMacete($macete, $context['articleText'], $comment)) {
            $stage['regeneratedFields'][] = 'macete';
            $stage['attempts']['macete'] = 2;
            $retry = $this->requestJson(
                $this->buildPromptFieldMacete($context),
                $this->schemaFieldMacete()
            );
            $maceteEntries = $this->buildMaceteTipEntriesFromResponse($retry, $context, $comment);
            $macete = (string) ($maceteEntries[0]['body'] ?? '');
            if (!empty($retry['target'] ?? null)) {
                $response['target'] = $retry['target'];
            }
            if (!$this->validator->isValidMacete($macete, $context['articleText'], $comment)) {
                $macete = '';
                $maceteEntries = [];
                $stage['warnings'][] = 'Macete descartado por nao funcionar como recurso real de prova.';
            }
        }

        $requestedTarget = is_array($context['requestedTarget'] ?? null) ? $context['requestedTarget'] : [];
        $isTargetedComment = $scope === 'field-comment' && !empty($requestedTarget);
        if ($isTargetedComment && $comment !== '') {
            if (empty($richBlocks)) {
                $richBlocks = [[
                    'type' => 'paragraph',
                    'title' => 'Comentario direcionado',
                    'content' => $comment,
                    'items' => [],
                    'headers' => [],
                    'rows' => [],
                    'target' => $requestedTarget,
                ]];
            } else {
                $richBlocks = array_map(function (array $block) use ($requestedTarget): array {
                    $block['target'] = $requestedTarget;
                    return $block;
                }, $richBlocks);
            }
        }

        $teacherComments = $context['existingEditorial']['teacherComments'] ?? [];
        $examTips = $context['existingEditorial']['examTips'] ?? [];
        $maceteTarget = $this->normalizeGeneratedTarget($response['target'] ?? [], $context, $macete);

        if (in_array($scope, ['article-full', 'stage-a', 'field-comment'], true)) {
            $newComment = $comment !== '' ? [
                'id' => '',
                'articleId' => (string) ($context['articleId'] ?: ($context['article']['id'] ?? '')),
                'title' => $isTargetedComment
                    ? 'Comentario do professor - ' . $this->targetReferenceLabel($requestedTarget)
                    : 'Comentario do professor',
                'body' => $comment,
                'importance' => $importance,
                'style' => $style,
                'richBlocks' => $richBlocks,
                'blocks' => $richBlocks,
                'keywords' => $keywords,
                'avoidRepetitionNote' => $avoidRepetitionNote,
                'examFocus' => [],
                'pitfalls' => [],
                'relatedRefs' => [],
                'authorName' => 'Equipe editorial',
                'authorRole' => 'Professor especialista',
                'reviewedAt' => date(DateTime::ATOM),
            ] : null;

            if ($newComment === null) {
                $teacherComments = $teacherComments;
            } else {
                $teacherComments = $this->mergeTeacherCommentItems($teacherComments, [$newComment]);
            }
        }

        if (in_array($scope, ['article-full', 'stage-a', 'field-macete'], true)) {
            if (empty($maceteEntries) && $macete !== '') {
                $maceteEntries = [[
                    'id' => '',
                    'articleId' => (string) ($context['articleId'] ?: ($context['article']['id'] ?? '')),
                    'title' => 'Macete para prova',
                    'body' => $macete,
                    'tags' => [],
                    'target' => $maceteTarget,
                ]];
            }

            $examTips = $this->mergeExamTipItems($examTips, $maceteEntries);
        }

        $stage['teacherComments'] = $teacherComments;
        $stage['examTips'] = $examTips;
        $stage['approvedCount'] = 0;
        if (in_array($scope, ['article-full', 'stage-a', 'field-comment'], true)) {
            $stage['approvedCount'] += count($teacherComments);
        }
        if (in_array($scope, ['article-full', 'stage-a', 'field-macete'], true)) {
            $stage['approvedCount'] += count($examTips);
        }
        $stage['status'] = $stage['approvedCount'] > 0
            ? (empty($stage['warnings']) ? 'success' : 'partial')
            : (empty($stage['warnings']) ? 'partial' : 'failed');

        return $stage;
    }

    private function runStageB(array $context): array
    {
        $stage = $this->emptyStageResult('success');
        $stage['attempts'] = ['doutrina' => 1];

        $response = $this->requestJson(
            $this->buildPromptStageB($context),
            $this->schemaStageB()
        );

        $rawEntries = is_array($response['doutrina'] ?? null) ? $response['doutrina'] : [];
        $approvedEntries = $this->validator->filterDoctrineEntries($rawEntries, $context['articleText']);
        $approvedEntries = $this->normalizeGeneratedEntryTargets($approvedEntries, $context, 'entendimento');

        if (!empty($rawEntries) && empty($approvedEntries)) {
            $stage['attempts']['doutrina'] = 2;
            $stage['regeneratedFields'][] = 'doutrina';
            $retry = $this->requestJson(
                $this->buildPromptStageB($context, true),
                $this->schemaStageB()
            );
            $approvedEntries = $this->validator->filterDoctrineEntries(
                is_array($retry['doutrina'] ?? null) ? $retry['doutrina'] : [],
                $context['articleText']
            );
            $approvedEntries = $this->normalizeGeneratedEntryTargets($approvedEntries, $context, 'entendimento');
        }

        $stage['doctrine'] = $this->validator->doctrineToStructuredEntries($approvedEntries);
        $stage['approvedCount'] = count($stage['doctrine']);

        if (empty($stage['doctrine']) && !empty($rawEntries)) {
            $stage['warnings'][] = 'Doutrina descartada por falta de base segura ou utilidade pratica.';
        }

        $stage['status'] = $stage['approvedCount'] > 0
            ? (empty($stage['warnings']) ? 'success' : 'partial')
            : 'partial';

        return $stage;
    }

    private function runStageC(array $context, string $scope): array
    {
        $stage = $this->emptyStageResult('success');
        $stage['attempts'] = ['jurisprudencia' => 0, 'sumulas' => 0];
        $rawJuris = [];
        $rawSumulas = [];

        if ($scope === 'field-jurisprudencia') {
            $stage['attempts']['jurisprudencia'] = 1;
            $response = $this->requestJson(
                $this->buildPromptFieldJurisprudencia($context),
                $this->schemaFieldJurisprudencia()
            );
            $rawJuris = is_array($response['jurisprudencia'] ?? null) ? $response['jurisprudencia'] : [];
        } elseif ($scope === 'field-sumulas') {
            $stage['attempts']['sumulas'] = 1;
            $response = $this->requestJson(
                $this->buildPromptFieldSumulas($context),
                $this->schemaFieldSumulas()
            );
            $rawSumulas = is_array($response['sumulas'] ?? null) ? $response['sumulas'] : [];
        } else {
            $stage['attempts'] = ['jurisprudencia' => 1, 'sumulas' => 1];
            $response = $this->requestJson(
                $this->buildPromptStageC($context),
                $this->schemaStageC()
            );
            $rawJuris = is_array($response['jurisprudencia'] ?? null) ? $response['jurisprudencia'] : [];
            $rawSumulas = is_array($response['sumulas'] ?? null) ? $response['sumulas'] : [];
        }

        $approvedJuris = $this->validator->filterJurisprudenceEntries(
            $rawJuris,
            $context['articleText'],
            (string) ($context['article']['number'] ?? '')
        );
        $approvedJuris = $this->normalizeGeneratedEntryTargets($approvedJuris, $context, 'tese');
        $approvedSumulas = $this->validator->filterSumulaEntries($rawSumulas, $context['articleText'], $context['law']['number']);
        $approvedSumulas = $this->normalizeGeneratedEntryTargets($approvedSumulas, $context, 'enunciado');

        if (in_array($scope, ['article-full', 'stage-c', 'field-jurisprudencia'], true)
            && !empty($rawJuris) && empty($approvedJuris)) {
            $stage['attempts']['jurisprudencia'] = 2;
            $stage['regeneratedFields'][] = 'jurisprudencia';
            $retry = $this->requestJson(
                $this->buildPromptFieldJurisprudencia($context),
                $this->schemaFieldJurisprudencia()
            );
            $approvedJuris = $this->validator->filterJurisprudenceEntries(
                is_array($retry['jurisprudencia'] ?? null) ? $retry['jurisprudencia'] : [],
                $context['articleText'],
                (string) ($context['article']['number'] ?? '')
            );
            $approvedJuris = $this->normalizeGeneratedEntryTargets($approvedJuris, $context, 'tese');
            if (empty($approvedJuris)) {
                $stage['warnings'][] = 'Jurisprudencia descartada por nao estar ligada de forma segura e direta a este artigo.';
            }
        }

        if (in_array($scope, ['article-full', 'stage-c', 'field-sumulas'], true)
            && !empty($rawSumulas) && empty($approvedSumulas)) {
            $stage['attempts']['sumulas'] = 2;
            $stage['regeneratedFields'][] = 'sumulas';
            $retry = $this->requestJson(
                $this->buildPromptFieldSumulas($context),
                $this->schemaFieldSumulas()
            );
            $approvedSumulas = $this->validator->filterSumulaEntries(
                is_array($retry['sumulas'] ?? null) ? $retry['sumulas'] : [],
                $context['articleText'],
                $context['law']['number']
            );
            $approvedSumulas = $this->normalizeGeneratedEntryTargets($approvedSumulas, $context, 'enunciado');
            if (empty($approvedSumulas)) {
                $stage['warnings'][] = 'Sumulas descartadas por suspeita, baixa relevancia ou ausencia de base segura.';
            }
        }

        $jurisprudence = $context['existingEditorial']['jurisprudence'] ?? [];
        $jurisprudenceNotes = $context['existingEditorial']['jurisprudenceNotes'] ?? [];
        $sumulas = $context['existingEditorial']['sumulas'] ?? [];

        if (in_array($scope, ['article-full', 'stage-c', 'field-jurisprudencia'], true)) {
            $jurisprudence = array_map(function (array $entry) use ($context): array {
                $court = (string) ($entry['tribunal'] ?? 'STJ');
                $process = trim((string) ($entry['processo'] ?? ''));
                return [
                    'id' => '',
                    'articleId' => (string) ($context['articleId'] ?: ($context['article']['id'] ?? '')),
                    'court' => $court,
                    'precedentType' => $process !== '' ? 'Precedente' : 'Entendimento',
                    'title' => $process !== '' ? ($court . ' — ' . $process) : ('Entendimento ' . $court),
                    'summary' => (string) ($entry['tese'] ?? ''),
                    'examImpact' => '',
                    'isConsolidated' => false,
                    'priority' => 'high',
                    'sourceUrl' => '',
                    'target' => $entry['target'] ?? [],
                ];
            }, $approvedJuris);
            $jurisprudenceNotes = empty($approvedJuris)
                ? [self::NO_RELEVANT_JURISPRUDENCE_NOTE]
                : [];
        }

        if (in_array($scope, ['article-full', 'stage-c', 'field-sumulas'], true)) {
            $sumulas = array_map(function (array $entry) use ($context): array {
                return [
                    'id' => '',
                    'articleId' => (string) ($context['articleId'] ?: ($context['article']['id'] ?? '')),
                    'court' => (string) ($entry['tribunal'] ?? 'STJ'),
                    'number' => (string) ($entry['numero'] ?? ''),
                    'text' => (string) ($entry['enunciado'] ?? ''),
                    'sourceUrl' => '',
                    'priority' => 'high',
                    'isBinding' => false,
                    'target' => $entry['target'] ?? [],
                ];
            }, $approvedSumulas);
        }

        $stage['jurisprudence'] = $jurisprudence;
        $stage['jurisprudenceNotes'] = $jurisprudenceNotes;
        $stage['sumulas'] = $sumulas;
        $stage['approvedCount'] = 0;
        if (in_array($scope, ['article-full', 'stage-c', 'field-jurisprudencia'], true)) {
            $stage['approvedCount'] += count($approvedJuris);
        }
        if (in_array($scope, ['article-full', 'stage-c', 'field-sumulas'], true)) {
            $stage['approvedCount'] += count($approvedSumulas);
        }
        $stage['status'] = $stage['approvedCount'] > 0
            ? (empty($stage['warnings']) ? 'success' : 'partial')
            : 'partial';

        return $stage;
    }

    private function resolveContext(array $payload): array
    {
        $lawPayload = is_array($payload['law'] ?? null) ? $payload['law'] : [];
        $articlePayload = is_array($payload['article'] ?? null) ? $payload['article'] : [];
        $existingEditorialPayload = is_array($payload['existingEditorial'] ?? null) ? $payload['existingEditorial'] : [];

        $lawId = (int) ($payload['lawId'] ?? $lawPayload['id'] ?? 0);
        $articleId = (int) ($payload['articleId'] ?? $articlePayload['id'] ?? 0);

        $law = [
            'id' => $lawId > 0 ? (string) $lawId : (string) ($lawPayload['id'] ?? ''),
            'title' => trim((string) ($lawPayload['title'] ?? '')),
            'shortTitle' => trim((string) ($lawPayload['shortTitle'] ?? $lawPayload['title'] ?? '')),
            'number' => trim((string) ($lawPayload['number'] ?? '')),
            'officialUrl' => trim((string) ($lawPayload['officialUrl'] ?? '')),
        ];

        $article = [
            'id' => $articleId > 0 ? (string) $articleId : (string) ($articlePayload['id'] ?? ''),
            'number' => trim((string) ($articlePayload['number'] ?? '')),
            'title' => trim((string) ($articlePayload['title'] ?? '')),
            'text' => trim((string) ($articlePayload['text'] ?? $articlePayload['official_text'] ?? '')),
            'blocks' => is_array($articlePayload['blocks'] ?? null) ? $articlePayload['blocks'] : [],
            'hierarchy' => is_array($articlePayload['hierarchy'] ?? null) ? $articlePayload['hierarchy'] : [],
        ];
        $previousArticles = [];

        if (($law['title'] === '' || $article['text'] === '') && $lawId > 0) {
            $lawDetail = $this->repository->fetchLawDetail((string) $lawId, null, false);
            if (is_array($lawDetail)) {
                $law['title'] = $law['title'] !== '' ? $law['title'] : (string) ($lawDetail['title'] ?? '');
                $law['shortTitle'] = $law['shortTitle'] !== '' ? $law['shortTitle'] : (string) ($lawDetail['shortTitle'] ?? '');
                $law['number'] = $law['number'] !== '' ? $law['number'] : (string) ($lawDetail['number'] ?? '');

                if ($articleId > 0) {
                    foreach (array_values($lawDetail['articles'] ?? []) as $rowIndex => $row) {
                        if ((string) ($row['id'] ?? '') !== (string) $articleId) {
                            continue;
                        }

                        $article['number'] = $article['number'] !== '' ? $article['number'] : (string) ($row['number'] ?? '');
                        $article['title'] = $article['title'] !== '' ? $article['title'] : trim((string) ($row['title'] ?? ''));
                        $article['text'] = $article['text'] !== '' ? $article['text'] : trim((string) ($row['text'] ?? ''));
                        $article['blocks'] = !empty($article['blocks']) ? $article['blocks'] : (is_array($row['blocks'] ?? null) ? $row['blocks'] : []);
                        $article['hierarchy'] = !empty($article['hierarchy']) ? $article['hierarchy'] : (is_array($row['hierarchy'] ?? null) ? $row['hierarchy'] : []);
                        foreach (array_slice(array_values($lawDetail['articles'] ?? []), max(0, $rowIndex - 2), 2) as $previousRow) {
                            if ((string) ($previousRow['id'] ?? '') === (string) $articleId) {
                                continue;
                            }
                            $previousArticles[] = [
                                'number' => trim((string) ($previousRow['number'] ?? $previousRow['numero'] ?? '')),
                                'title' => trim((string) ($previousRow['title'] ?? $previousRow['titulo'] ?? '')),
                                'text' => $this->limitPromptText((string) ($previousRow['text'] ?? $previousRow['texto'] ?? ''), 650),
                            ];
                        }

                        $rowEditorialPayload = [
                            'teacherComments' => is_array($row['comentarios'] ?? null) ? $row['comentarios'] : [],
                            'examTips' => !empty($row['macete']) ? [[
                                'title' => 'Macete para prova',
                                'body' => (string) $row['macete'],
                                'tags' => [],
                            ]] : [],
                            'jurisprudenceNotes' => is_array($row['jurisprudenceNotes'] ?? null) ? $row['jurisprudenceNotes'] : [],
                            'jurisprudence' => is_array($row['jurisprudencia'] ?? null) ? $row['jurisprudencia'] : [],
                            'sumulas' => is_array($row['sumulas'] ?? null) ? $row['sumulas'] : [],
                            'doctrine' => is_array($row['doctrine'] ?? null) ? $row['doctrine'] : [],
                        ];

                        foreach ($rowEditorialPayload as $key => $fallbackValue) {
                            if (empty($existingEditorialPayload[$key]) && !empty($fallbackValue)) {
                                $existingEditorialPayload[$key] = $fallbackValue;
                            }
                        }
                        break;
                    }
                }
            }
        }

        $articleText = $this->buildArticleTextForPrompt($article);
        if ($articleText === '') {
            throw new InvalidArgumentException('Informe o texto oficial do artigo antes de gerar conteudo com IA.');
        }

        $articleStructure = $this->buildArticleStructureForPrompt($article);
        $requestedTarget = $this->normalizeRichBlockTarget(is_array($payload['target'] ?? null) ? $payload['target'] : []);
        if (!empty($requestedTarget)) {
            $requestedTarget = $this->normalizeGeneratedTarget($requestedTarget, ['article' => $article], (string) ($requestedTarget['label'] ?? ''));
        }

        return [
            'lawId' => $lawId,
            'articleId' => $articleId,
            'law' => $law,
            'article' => $article,
            'articleText' => $articleText,
            'articleStructure' => $articleStructure,
            'requestedTarget' => $requestedTarget,
            'previousArticles' => $previousArticles,
            'existingEditorial' => [
                'teacherComments' => is_array($existingEditorialPayload['teacherComments'] ?? null) ? $existingEditorialPayload['teacherComments'] : [],
                'examTips' => is_array($existingEditorialPayload['examTips'] ?? null) ? $existingEditorialPayload['examTips'] : [],
                'jurisprudenceNotes' => $this->normalizeExistingTargetedTexts(is_array($existingEditorialPayload['jurisprudenceNotes'] ?? null) ? $existingEditorialPayload['jurisprudenceNotes'] : []),
                'jurisprudence' => is_array($existingEditorialPayload['jurisprudence'] ?? null) ? $existingEditorialPayload['jurisprudence'] : [],
                'sumulas' => is_array($existingEditorialPayload['sumulas'] ?? null) ? $existingEditorialPayload['sumulas'] : [],
                'doctrine' => $this->normalizeExistingTargetedTexts(is_array($existingEditorialPayload['doctrine'] ?? null) ? $existingEditorialPayload['doctrine'] : []),
            ],
        ];
    }

    private function normalizeExistingTargetedTexts(array $items): array
    {
        $normalized = [];

        foreach ($items as $item) {
            if (is_array($item)) {
                $body = $this->firstNonEmptyText(
                    $item['body'] ?? '',
                    $item['text'] ?? '',
                    $item['content'] ?? '',
                    !empty($item['author'] ?? '') && !empty($item['entendimento'] ?? '')
                        ? ((string) $item['author'] . ': ' . (string) $item['entendimento'])
                        : ''
                );

                if ($body === '') {
                    continue;
                }

                $normalized[] = [
                    'id' => $this->sanitizeInlineText((string) ($item['id'] ?? '')),
                    'title' => $this->sanitizeInlineText((string) ($item['title'] ?? '')),
                    'author' => $this->sanitizeInlineText((string) ($item['author'] ?? '')),
                    'body' => $body,
                    'text' => $body,
                    'target' => $this->normalizeRichBlockTarget($item['target'] ?? []),
                ];
                continue;
            }

            $text = trim((string) $item);
            if ($text !== '') {
                $normalized[] = $text;
            }
        }

        return $normalized;
    }

    private function formatTargetedTextForPrompt($item): string
    {
        if (!is_array($item)) {
            return $this->sanitizeInlineText((string) $item);
        }

        $body = $this->firstNonEmptyText(
            $item['body'] ?? '',
            $item['text'] ?? '',
            $item['content'] ?? '',
            $item['entendimento'] ?? ''
        );
        if ($body === '') {
            return '';
        }

        $targetLabel = is_array($item['target'] ?? null)
            ? $this->targetReferenceLabel($item['target'])
            : '';
        $author = $this->sanitizeInlineText((string) ($item['author'] ?? ''));

        return trim(implode(' ', array_filter([
            $targetLabel !== '' ? '[' . $targetLabel . ']' : '',
            $author !== '' && !str_contains($body, $author) ? $author . ':' : '',
            $body,
        ])));
    }

    private function buildSummary(string $scope, array $stageResults, ?string $fatalError): array
    {
        $warnings = [];
        $approvedBlocks = 0;

        foreach ($stageResults as $stage) {
            $warnings = array_merge($warnings, $stage['warnings']);
            $approvedBlocks += (int) ($stage['approvedCount'] ?? 0);
        }

        if ($fatalError !== null) {
            $warnings[] = $fatalError;
        }

        $warnings = array_values(array_unique(array_filter(array_map('strval', $warnings))));

        $status = 'success';
        if ($fatalError !== null) {
            $status = 'failed';
        } elseif ($approvedBlocks === 0 || !empty($warnings)) {
            $status = 'partial';
        }

        return [
            'status' => $status,
            'scope' => $scope,
            'approvedBlocks' => $approvedBlocks,
            'warnings' => $warnings,
        ];
    }

    private function emptyStageResult(string $status): array
    {
        return [
            'status' => $status,
            'warnings' => [],
            'regeneratedFields' => [],
            'attempts' => [],
            'approvedCount' => 0,
            'teacherComments' => [],
            'examTips' => [],
            'doctrine' => [],
            'jurisprudenceNotes' => [],
            'jurisprudence' => [],
            'sumulas' => [],
        ];
    }

    private function buildArticleTextForPrompt(array $article): string
    {
        $parts = [];
        $title = trim((string) ($article['title'] ?? ''));
        $number = trim((string) ($article['number'] ?? ''));

        if ($number !== '' || $title !== '') {
            $parts[] = trim('Art. ' . $number . ' ' . $title);
        }

        foreach ((array) ($article['blocks'] ?? []) as $block) {
            if (!is_array($block)) {
                continue;
            }

            $label = trim((string) ($block['label'] ?? ''));
            $text = trim((string) ($block['text'] ?? ''));
            if ($label === '' && $text === '') {
                continue;
            }

            $parts[] = trim($label . ' ' . $text);
        }

        if (empty($parts)) {
            $text = trim((string) ($article['text'] ?? ''));
            if ($text !== '') {
                $parts[] = $text;
            }
        }

        return trim(implode("\n", $parts));
    }

    private function buildArticleStructureForPrompt(array $article): string
    {
        $blocks = is_array($article['blocks'] ?? null) ? $article['blocks'] : [];
        if (empty($blocks)) {
            return '';
        }

        $articleNumber = trim((string) ($article['number'] ?? ''));
        $labelsById = [];
        foreach ($blocks as $block) {
            if (!is_array($block)) {
                continue;
            }

            $blockId = trim((string) ($block['id'] ?? ''));
            $blockLabel = $this->sanitizeInlineText((string) ($block['label'] ?? ''));
            if ($blockId !== '' && $blockLabel !== '') {
                $labelsById[$blockId] = $blockLabel;
            }
        }

        $lines = [];
        $caputLabel = $articleNumber !== '' ? 'Art. ' . $articleNumber : 'Art.';
        $currentParagraphLabel = null;
        $currentIncisoLabel = null;
        $currentAlineaLabel = null;
        $lastLegalLabel = $caputLabel;

        foreach ($blocks as $block) {
            if (!is_array($block)) {
                continue;
            }

            $kind = strtolower(trim((string) ($block['kind'] ?? 'caput')));
            $label = $this->sanitizeInlineText((string) ($block['label'] ?? ''));
            $text = $this->sanitizeInlineText((string) ($block['text'] ?? ''));
            if ($label === '' && $text === '') {
                continue;
            }

            $parentId = trim((string) ($block['parentBlockId'] ?? ''));
            $parentLabel = $parentId !== '' ? ($labelsById[$parentId] ?? '') : '';
            $kindLabel = match ($kind) {
                'paragraph' => 'PARAGRAFO',
                'inciso' => 'INCISO',
                'alinea' => 'ALINEA',
                'item' => 'ITEM',
                'note' => 'NOTA',
                default => 'CAPUT',
            };

            if ($kind === 'caput') {
                $caputLabel = $label !== '' ? $label : $caputLabel;
                $currentParagraphLabel = null;
                $currentIncisoLabel = null;
                $currentAlineaLabel = null;
                $lastLegalLabel = $caputLabel;
            } elseif ($kind === 'paragraph') {
                if ($parentLabel === '') {
                    $parentLabel = $caputLabel;
                }
                $currentParagraphLabel = $label !== '' ? $label : $currentParagraphLabel;
                $currentIncisoLabel = null;
                $currentAlineaLabel = null;
                $lastLegalLabel = $label !== '' ? $label : $lastLegalLabel;
            } elseif ($kind === 'inciso') {
                if ($parentLabel === '') {
                    $parentLabel = $currentParagraphLabel ?: $caputLabel;
                }
                $currentIncisoLabel = $label !== '' ? $label : $currentIncisoLabel;
                $currentAlineaLabel = null;
                $lastLegalLabel = $label !== '' ? $label : $lastLegalLabel;
            } elseif ($kind === 'alinea') {
                if ($parentLabel === '') {
                    $parentLabel = $currentIncisoLabel ?: $currentParagraphLabel ?: $caputLabel;
                }
                $currentAlineaLabel = $label !== '' ? $label : $currentAlineaLabel;
                $lastLegalLabel = $label !== '' ? $label : $lastLegalLabel;
            } elseif ($kind === 'item') {
                if ($parentLabel === '') {
                    $parentLabel = $currentAlineaLabel ?: $currentIncisoLabel ?: $currentParagraphLabel ?: $caputLabel;
                }
                $lastLegalLabel = $label !== '' ? $label : $lastLegalLabel;
            } elseif ($kind === 'note' && $parentLabel === '') {
                $parentLabel = $lastLegalLabel;
            }

            $snippet = $text !== '' ? $text : $label;
            if (mb_strlen($snippet) > 180) {
                $snippet = mb_substr($snippet, 0, 177) . '...';
            }

            $line = '- ' . $kindLabel;
            if (trim((string) ($block['id'] ?? '')) !== '') {
                $line .= ' | blockId=' . trim((string) ($block['id'] ?? ''));
            }
            $line .= ' | kind=' . $kind;
            if ($label !== '') {
                $line .= ' | label=' . $label;
            }
            if ($parentLabel !== '') {
                $line .= ' | filho de ' . $parentLabel;
            }
            if ($snippet !== '') {
                $line .= ' | texto=' . $snippet;
            }

            $lines[] = $line;
        }

        if (empty($lines)) {
            return '';
        }

        return "ESTRUTURA EM BLOCOS:\n" . implode("\n", $lines);
    }

    private function buildEditorialPromptContext(array $context): string
    {
        $parts = [];
        $parts[] = 'Lei: ' . trim((string) ($context['law']['shortTitle'] ?? ''));
        $parts[] = 'Numero: ' . trim((string) ($context['law']['number'] ?? ''));
        $parts[] = 'Artigo: ' . trim((string) ($context['article']['number'] ?? ''));

        $hierarchy = is_array($context['article']['hierarchy'] ?? null) ? $context['article']['hierarchy'] : [];
        $hierarchyLine = trim(implode(' > ', array_filter(array_map('strval', [
            $hierarchy['part'] ?? $hierarchy['partLabel'] ?? '',
            $hierarchy['book'] ?? $hierarchy['bookLabel'] ?? '',
            $hierarchy['title'] ?? $hierarchy['titleLabel'] ?? '',
            $hierarchy['chapter'] ?? $hierarchy['chapterLabel'] ?? '',
            $hierarchy['section'] ?? $hierarchy['sectionLabel'] ?? '',
            $hierarchy['subsection'] ?? $hierarchy['subsectionLabel'] ?? '',
        ]))));
        if ($hierarchyLine !== '') {
            $parts[] = 'Contexto editorial: ' . $hierarchyLine;
        }

        $previousLines = [];
        foreach (is_array($context['previousArticles'] ?? null) ? $context['previousArticles'] : [] as $previous) {
            if (!is_array($previous)) {
                continue;
            }
            $previousLines[] = trim('Art. ' . ($previous['number'] ?? '') . ' ' . ($previous['title'] ?? '') . ' - ' . ($previous['text'] ?? ''));
        }
        if (!empty($previousLines)) {
            $parts[] = "Artigos anteriores relevantes para comparacao:\n" . implode("\n", $previousLines);
        }

        $parts[] = "Texto oficial:\n" . trim((string) ($context['articleText'] ?? ''));

        $articleStructure = trim((string) ($context['articleStructure'] ?? ''));
        if ($articleStructure !== '') {
            $parts[] = $articleStructure;
            $parts[] = "REGRA OBRIGATORIA PARA target:\n"
                . "- target.blockId deve copiar exatamente um blockId da ESTRUTURA EM BLOCOS.\n"
                . "- target.kind deve copiar o kind do mesmo bloco.\n"
                . "- target.label deve ser curto, no maximo 40 caracteres, como \"Art. 1º\", \"Caput\", \"§ 1º\", \"Inciso I\" ou \"Alinea a\".\n"
                . "- Nunca copie texto legal, ementa, paragrafo inteiro ou comentario dentro de target.label.\n"
                . "- Se estiver em duvida, use o blockId do caput.";
        }

        $requestedTarget = is_array($context['requestedTarget'] ?? null) ? $context['requestedTarget'] : [];
        if (!empty($requestedTarget)) {
            $targetKind = trim((string) ($requestedTarget['kind'] ?? ''));
            $targetLabel = trim((string) ($requestedTarget['label'] ?? ''));
            $targetBlockId = trim((string) ($requestedTarget['blockId'] ?? ''));
            $parts[] = "ALVO DIRECIONADO PELO ADMIN:\n"
                . "- Gere o comentario somente para este bloco do artigo.\n"
                . "- kind: {$targetKind}\n"
                . "- label: {$targetLabel}\n"
                . "- blockId: {$targetBlockId}\n"
                . "- Preserve exatamente esse target na resposta. Nao use outro bloco.";
        }

        $existing = $context['existingEditorial'] ?? [];
        $existingLines = [];
        foreach (is_array($existing['teacherComments'] ?? null) ? $existing['teacherComments'] : [] as $comment) {
            if (is_array($comment)) {
                $existingLines[] = 'Comentario ja existente: ' . $this->limitPromptText((string) ($comment['body'] ?? $comment['texto'] ?? ''), 600);
            }
        }
        foreach (is_array($existing['examTips'] ?? null) ? $existing['examTips'] : [] as $tip) {
            if (is_array($tip)) {
                $existingLines[] = 'Macete ja existente: ' . $this->limitPromptText((string) ($tip['body'] ?? $tip['texto'] ?? ''), 400);
            }
        }
        foreach (is_array($existing['doctrine'] ?? null) ? $existing['doctrine'] : [] as $doctrine) {
            $existingDoctrine = $this->formatTargetedTextForPrompt($doctrine);
            if ($existingDoctrine !== '') {
                $existingLines[] = 'Doutrina ja existente: ' . $this->limitPromptText($existingDoctrine, 400);
            }
        }
        if (!empty($existingLines)) {
            $parts[] = "Conteudo ja gerado, para evitar repeticao:\n" . implode("\n", array_slice($existingLines, 0, 8));
        }

        $parts[] = 'LEITURA ESTRATEGICA: analise caput, incisos, alineas, paragrafos e itens separadamente. Caput e a regra central. Paragrafos normalmente complementam, delimitam ou excepcionam. Incisos trazem hipoteses, condicoes ou excecoes. Alineas detalham o inciso. Itens detalham a alinea. Use apenas o bloco que realmente sustenta cada saida editorial. Quando retornar target, copie exatamente o blockId exibido na ESTRUTURA EM BLOCOS. Nao force doutrina, sumula ou macete quando a estrutura do artigo nao justificar.';
        $parts[] = "AUDITORIA OBRIGATORIA DOS BLOCOS INTERNOS:\n"
            . "- Antes de responder, percorra todos os blocos exibidos na ESTRUTURA EM BLOCOS.\n"
            . "- Se houver paragrafo, inciso, alinea ou item com regra, excecao, requisito, sujeito, prazo, competencia, obrigacao, vedacao, hipotese ou palavra perigosa, avalie esse bloco antes do caput.\n"
            . "- Para geracoes em lote, nao produza conteudo generico do artigo inteiro quando um bloco interno carrega a pegadinha de prova.\n"
            . "- Comentario, macete, doutrina, sumula e jurisprudencia devem ficar vinculados ao bloco juridico que realmente sustenta a nota.";

        return implode("\n\n", array_values(array_filter($parts, static fn ($part): bool => trim((string) $part) !== '')));
    }

    private function buildPromptSectionAnalysis(array $context): string
    {
        $lawTitle = trim((string) ($context['lawTitle'] ?? 'Lei Comentada'));
        $lawNumber = trim((string) ($context['lawNumber'] ?? ''));
        $lawOfficialUrl = trim((string) ($context['lawOfficialUrl'] ?? ''));
        $sectionTitle = trim((string) ($context['sectionTitle'] ?? 'Capitulo da lei'));
        $rangeLabel = trim((string) ($context['rangeLabel'] ?? ''));
        $articleCount = (int) ($context['articleCount'] ?? 0);
        $articleContext = trim((string) ($context['articleContext'] ?? ''));
        $existingEditorialContext = trim((string) ($context['existingEditorialContext'] ?? ''));

        return trim("
Voce e professor especialista em concursos publicos, analista de banca, comentarista de legislacao e criador de material premium de estudo.

A tarefa NAO e resumir a lei. A tarefa e transformar a unidade analisada em material estrategico para aprovacao, com leitura de prova, pegadinhas, incidencia pedagogica, bancas, questoes simuladas e checklist.

CONTEXTO DA LEI:
- Lei: {$lawTitle}
- Numero: {$lawNumber}
- Fonte oficial, quando houver: {$lawOfficialUrl}
- Unidade analisada: {$sectionTitle}
- Artigos abrangidos: {$rangeLabel}
- Quantidade de artigos: {$articleCount}

TEXTO OFICIAL DA UNIDADE:
{$articleContext}

CONTEUDO EDITORIAL JA EXISTENTE NOS ARTIGOS:
{$existingEditorialContext}

PERSONA E QUALIDADE:
- Escreva como professor de cursinho para carreiras juridicas, policiais, tribunais e administracao publica.
- Pense como examinador: literalidade, interpretacao, caso concreto, troca de palavras, excecoes, comparacoes e jurisprudencia.
- Nao entregue parafrase da lei. Explique a funcao pratica do trecho, por que ele existe e como ele se conecta ao resto da lei.
- Aprofunde artigo por artigo, mas seja proporcional: artigo central merece analise completa; artigo simples recebe comentario objetivo; procedimento vira fluxo; comparacao vira tabela; ponto perigoso vira alerta.
- Analise caput, paragrafos, incisos, alineas e itens quando forem relevantes.
- Observe termos de pegadinha: devera, podera, sempre, exclusivamente, qualquer, somente, salvo, exceto, independentemente, especialmente, preferencialmente.
- Nao use frases vazias como \"e importante compreender\" sem explicar o motivo.
- Nao invente jurisprudencia, sumula, estatistica, autor ou dado externo. Se nao houver base segura, diga expressamente que nao ha jurisprudencia central indispensavel ou que a incidencia e estimativa pedagogica.
- Se nao houver dados reais de incidencia por banca no banco, use \"estimativa pedagogica\", \"tendencia recorrente em provas\" e \"nao representa estatistica oficial\".
- Use HTML seguro dentro dos campos de texto quando ajudar a leitura: <strong>, <em>, <u>, <mark> e <span style=\"color:#2563eb\">texto</span>. Use cores com moderacao para destacar palavras-chave, pegadinhas e conclusoes.
- Nao use scripts, iframes, estilos de layout, imagens, links inventados ou HTML complexo. O texto precisa ser editavel no painel admin.
- Evite blocos longos: quebre a explicacao em paragrafos curtos, listas e tabelas para reduzir cansaco de leitura.
- Nao use saudacao, chamada motivacional ou frase do tipo \"Ola, futuro aprovado\", \"Ola, concurseiro\" ou \"Esta aula e seu guia\". Comece direto no conteudo.
- Quando criar tabelas em HTML, use sempre estrutura real: <table><thead><tr><th>...</th></tr></thead><tbody><tr><td>...</td></tr></tbody></table>. Nao simule tabela com espacos, pipes ou texto alinhado.

PADRAO EDITORIAL OBRIGATORIO:
- Escreva como uma apostila/aula para um aluno leigo, no estilo: \"Guia para concursos - linguagem simples - foco em pegadinhas - jurisprudencia - cobranca em prova\".
- A analise precisa parecer material de estudo pronto, nao parecer parecer juridico e nao parecer resumo automatico.
- Comece com <h1>{$lawTitle} ({$lawNumber}) - {$sectionTitle}</h1>, uma linha curta de proposta da aula e 1 paragrafo dizendo por que essa unidade cai em prova.
- Em seguida crie uma \"Visao geral\" simples com bullets no formato: \"Art. X -> palavra-chave -> o que lembrar\".
- Para CADA artigo relevante da unidade, crie uma secao com este ritmo:
  <h2>ART. X - TEMA EM LINGUAGEM SIMPLES</h2>
  explicacao direta em poucas linhas;
  <h3>O que cai MUITO em prova</h3> com exemplos de troca que a banca faz;
  <h3>Pegadinha classica</h3> mostrando uma assertiva errada e por que esta errada;
  <h3>Macete</h3> com mnemônico util, curto e memoravel;
  <h3>Chance de cobranca</h3> usando estrelas e percentual aproximado como estimativa pedagogica.
- Depois dos artigos, traga secoes globais:
  Jurisprudencias importantes, Sumulas importantes ligadas ao tema, Doutrinas/conceitos que bancas adoram, Top pegadinhas de concurso, O que decorar para acertar a maior parte das questoes, Resumo ultra-rapido em tabela e Grau de importancia para concursos.
- Use marcadores visuais em texto, como \"ERRADO\", \"CERTO\", \"MUITO COBRADO\", \"ATENCAO\", estrelas em texto (5/5, 4/5) e setas. Isso ajuda o aluno a escanear.
- Percentuais de cobranca devem ser sempre apresentados como \"estimativa pedagogica\". Nao trate como estatistica oficial se a base de questoes nao foi informada.
- Nao crie links inventados. Se usar a fonte oficial informada, cite como \"Fonte oficial da lei\" sem criar URL falsa. Para jurisprudencia/sumulas, cite apenas quando tiver alta seguranca; caso contrario, escreva a ressalva.
- Prefira frases curtas. Evite introducoes como \"O dispositivo estabelece\" ou \"A norma visa\". Diga diretamente: \"Esse artigo serve para...\", \"A banca troca...\", \"Decore assim...\".
- Nunca devolva apenas um comentario por artigo. A unidade precisa virar uma aula completa, com macetes e pegadinhas concretas.

EXEMPLO DE TOM, NAO COPIAR LITERALMENTE:
\"Art. 1 = finalidade. Art. 2 = protecao. Art. 3 = direitos. Art. 4 = interpretacao. Macete geral: 1 finalidade, 2 protecao, 3 direitos, 4 interpretacao. A banca costuma errar dizendo que a lei e apenas repressiva. Errado: ela e preventiva, protetiva e repressiva.\"

CONTEUDO OBRIGATORIO:
1. Visao geral estrategica em tabela: unidade, artigos, importancia, incidencia, bancas, perfil de cobranca, dificuldade, pontos perigosos e prioridade.
2. Panorama geral: papel da unidade no sistema normativo, funcao pratica e conexao com a lei.
3. Aprofundamento por dispositivo relevante: nucleo, explicacao de prova, interpretacao juridica, finalidade, como cobra, pegadinha, palavras-chave, erro comum, assertiva exemplo e comentario estrategico.
4. Como isso cai em prova: literalidade, interpretacao, jurisprudencia, caso concreto, troca de palavras, excecoes e comparacoes.
5. Perfil por banca: CESPE/CEBRASPE, FGV, FCC, VUNESP, IBFC, Instituto AOCP e banca local quando fizer sentido.
6. Incidencia estimada: tema, relevancia, incidencia pedagogica, justificativa e prioridade.
7. Pegadinhas que a banca adora: pegadinha, por que esta errada e como memorizar.
8. Jurisprudencia e sumulas: inclua apenas se houver seguranca; caso contrario, explique o que pode ser relacionado sem inventar precedente.
9. Termos-chave para grifar: expressao e motivo.
10. Macetes uteis: nome, aplicacao, o que ajuda a lembrar e limite.
11. Mapa mental textual hierarquico.
12. Questoes simuladas: 3 certo/errado e 2 multipla escolha, com gabarito e comentario.
13. Checklist de revisao rapida: decorar, entender, cuidado, provavel cobranca e erro a evitar.

FORMATO:
- Retorne APENAS JSON valido.
- A analise principal deve estar inteira em \"analiseContinuaHtml\": um unico texto rico, completo e continuo, com subtitulos, tabelas, listas, alertas, questoes simuladas e checklist dentro do mesmo HTML.
- NAO divida a analise em varios blocos independentes por artigo ou por tema. O aluno e o admin devem ler uma peca unica de estudo.
- Para economizar tokens, \"blocks\" pode ser uma lista vazia. O backend transformara analiseContinuaHtml em bloco unico.
- Use \"summary\" apenas como sinopse interna curta. Nao coloque nela a analise completa.
- Nao deixe secoes obrigatorias vazias. Se nao houver jurisprudencia real, escreva a ressalva prudente dentro da analise continua.

SAIDA:
{
  \"titulo\": \"string\",
  \"importance\": \"alta|media|baixa\",
  \"style\": \"analise_completa|comentario_curto|tabela|fluxo|alerta|comparativo|misto\",
  \"summary\": \"resumo estrategico curto\",
  \"analiseContinuaHtml\": \"HTML unico e completo com toda a analise detalhada da secao, incluindo tabelas, listas, alertas, questoes simuladas e checklist\",
  \"resumoEstrategico\": \"string\",
  \"visaoGeralTabela\": [
    {
      \"unidade\": \"string\",
      \"artigos\": \"string\",
      \"importancia\": \"string\",
      \"incidencia\": \"estimativa pedagogica\",
      \"bancas\": \"string\",
      \"perfilCobranca\": \"string\",
      \"dificuldade\": \"string\",
      \"pontosPerigosos\": \"string\",
      \"prioridade\": \"string\"
    }
  ],
  \"panoramaGeral\": \"string\",
  \"analisePorDispositivo\": [
    {
      \"dispositivo\": \"Art. 1 / paragrafo / inciso\",
      \"nucleo\": \"string\",
      \"explicacaoProva\": \"string\",
      \"interpretacaoJuridica\": \"string\",
      \"finalidade\": \"string\",
      \"comoBancaCobra\": \"string\",
      \"pegadinha\": \"string\",
      \"palavrasChave\": \"string\",
      \"erroComum\": \"string\",
      \"assertivaExemplo\": \"string\",
      \"comentarioEstrategico\": \"string\"
    }
  ],
  \"comoCaiEmProva\": [
    {\"tipo\": \"literalidade|interpretacao|jurisprudencia|caso concreto|troca de palavras|excecoes|comparacao\", \"cobranca\": \"string\", \"atencao\": \"string\"}
  ],
  \"perfilPorBanca\": [
    {\"banca\": \"CESPE/CEBRASPE|FGV|FCC|VUNESP|IBFC|Instituto AOCP|Banca local\", \"estilo\": \"string\", \"profundidade\": \"string\", \"exemplo\": \"string\", \"riscoPegadinha\": \"string\"}
  ],
  \"incidenciaEstimativa\": [
    {\"tema\": \"string\", \"relevancia\": \"string\", \"incidenciaEstimada\": \"estimativa pedagogica\", \"justificativa\": \"string\", \"prioridade\": \"string\"}
  ],
  \"pegadinhas\": [
    {\"pegadinha\": \"string\", \"porQueErrada\": \"string\", \"comoMemorizar\": \"string\"}
  ],
  \"jurisprudencia\": \"string\",
  \"termosChave\": [
    {\"termo\": \"string\", \"motivo\": \"string\", \"risco\": \"string\"}
  ],
  \"macetes\": [
    {\"nome\": \"string\", \"aplicacao\": \"string\", \"ajudaLembrar\": \"string\", \"limite\": \"string\"}
  ],
  \"mapaMental\": \"string\",
  \"questoesSimuladas\": [
    {\"tipo\": \"Certo/Errado|Multipla escolha\", \"enunciado\": \"string\", \"alternativas\": [\"string\"], \"gabarito\": \"string\", \"comentario\": \"string\"}
  ],
  \"checklistRevisao\": [
    {\"categoria\": \"decorar|entender|cuidado|provavel cobranca|erro a evitar\", \"item\": \"string\"}
  ],
  \"blocks\": [
  ],
  \"examFocus\": [\"string\"],
  \"exam_focus\": \"string\",
  \"keywords\": [\"string\"],
  \"avoid_repetition_note\": \"string\",
  \"doctrine\": [\"string\"],
  \"highlights\": [
    {\"articleNumber\": \"string\", \"title\": \"string\", \"excerpt\": \"string\"}
  ]
}
");
    }

    private function cleanStringList($value, int $limit = 10): array
    {
        if (!is_array($value)) {
            $text = trim((string) $value);
            return $text !== '' ? [$text] : [];
        }

        $items = [];
        foreach ($value as $item) {
            $text = $this->stringifyListItem($item);
            if ($text !== '') {
                $items[] = $text;
            }
            if (count($items) >= $limit) {
                break;
            }
        }

        return array_values(array_unique($items));
    }

    private function stringifyListItem($item): string
    {
        if (!is_array($item)) {
            return trim((string) $item);
        }

        $preferred = $this->firstNonEmptyText(
            $item['body'] ?? '',
            $item['text'] ?? '',
            $item['content'] ?? '',
            $item['title'] ?? '',
            $item['item'] ?? ''
        );
        if ($preferred !== '') {
            return $preferred;
        }

        $parts = [];
        foreach ($item as $value) {
            $text = $this->stringifyListItem($value);
            if ($text !== '') {
                $parts[] = $text;
            }
        }

        return trim(implode(' ', $parts));
    }

    private function normalizeImportance(string $value): string
    {
        $value = strtolower($this->sanitizeInlineText($value));
        $value = str_replace(['alta incidencia', 'alto'], 'alta', $value);
        $value = str_replace(['media incidencia', 'medio', 'média'], 'media', $value);
        $value = str_replace(['baixa incidencia', 'baixo'], 'baixa', $value);

        return in_array($value, ['alta', 'media', 'baixa'], true) ? $value : '';
    }

    private function normalizeRichBlocks($value, int $limit = 10): array
    {
        if (!is_array($value)) {
            return [];
        }

        $allowedTypes = [
            'paragraph',
            'bullet_list',
            'table',
            'warning',
            'tip',
            'macete',
            'jurisprudence',
            'example',
            'comparison',
            'summary',
        ];
        $blocks = [];

        foreach ($value as $item) {
            if (!is_array($item)) {
                continue;
            }

            $type = strtolower(trim((string) ($item['type'] ?? 'paragraph')));
            if (!in_array($type, $allowedTypes, true)) {
                $type = 'paragraph';
            }

            $block = [
                'type' => $type,
                'title' => $this->sanitizeInlineText((string) ($item['title'] ?? '')),
                'content' => trim((string) ($item['content'] ?? '')),
                'items' => $this->cleanStringList($item['items'] ?? [], 8),
                'headers' => $this->cleanStringList($item['headers'] ?? [], 6),
                'rows' => [],
                'target' => $this->normalizeRichBlockTarget($item['target'] ?? []),
            ];

            foreach (is_array($item['rows'] ?? null) ? $item['rows'] : [] as $row) {
                if (!is_array($row)) {
                    continue;
                }
                $cells = array_values(array_filter(array_map(
                    fn ($cell): string => $this->sanitizeInlineText((string) $cell),
                    $row
                ), static fn ($cell): bool => $cell !== ''));
                if (!empty($cells)) {
                    $block['rows'][] = $cells;
                }
                if (count($block['rows']) >= 8) {
                    break;
                }
            }

            $hasText = trim((string) $block['content']) !== ''
                || !empty($block['items'])
                || !empty($block['rows']);
            if (!$hasText) {
                continue;
            }

            $blocks[] = $block;
            if (count($blocks) >= $limit) {
                break;
            }
        }

        return $blocks;
    }

    private function normalizeRichBlockTarget($value): array
    {
        if (!is_array($value)) {
            return [];
        }

        $kind = strtolower($this->sanitizeInlineText((string) ($value['kind'] ?? '')));
        $allowedKinds = ['article', 'section', 'caput', 'paragraph', 'inciso', 'alinea', 'item', 'note'];
        if (!in_array($kind, $allowedKinds, true)) {
            $kind = '';
        }

        return array_filter([
            'kind' => $kind,
            'label' => $this->sanitizeInlineText((string) ($value['label'] ?? '')),
            'blockId' => $this->sanitizeInlineText((string) ($value['blockId'] ?? '')),
        ], static fn ($item): bool => trim((string) $item) !== '');
    }

    private function normalizeRichBlocksTargets(array $blocks, array $context): array
    {
        return array_map(function (array $block) use ($context): array {
            $fallbackText = trim(implode(' ', array_filter([
                $block['title'] ?? '',
                $block['content'] ?? '',
                implode(' ', is_array($block['items'] ?? null) ? $block['items'] : []),
            ])));

            $block['target'] = $this->normalizeGeneratedTarget($block['target'] ?? [], $context, $fallbackText);
            return $block;
        }, $blocks);
    }

    private function normalizeGeneratedEntryTargets(array $entries, array $context, string $textKey): array
    {
        return array_map(function (array $entry) use ($context, $textKey): array {
            $entry['target'] = $this->normalizeGeneratedTarget($entry['target'] ?? [], $context, (string) ($entry[$textKey] ?? ''));
            return $entry;
        }, $entries);
    }

    private function teacherCommentMatchesTarget(array $comment, array $target): bool
    {
        if (empty($target)) {
            return false;
        }

        $commentTargets = [];
        foreach (['richBlocks', 'blocks'] as $key) {
            foreach (is_array($comment[$key] ?? null) ? $comment[$key] : [] as $block) {
                if (is_array($block['target'] ?? null)) {
                    $commentTargets[] = $this->normalizeRichBlockTarget($block['target']);
                }
            }
        }

        foreach ($commentTargets as $commentTarget) {
            if (empty($commentTarget)) {
                continue;
            }

            $commentBlockId = (string) ($commentTarget['blockId'] ?? '');
            $targetBlockId = (string) ($target['blockId'] ?? '');
            if ($commentBlockId !== '' && $targetBlockId !== '' && $commentBlockId === $targetBlockId) {
                return true;
            }

            $commentKind = (string) ($commentTarget['kind'] ?? '');
            $targetKind = (string) ($target['kind'] ?? '');
            $commentLabel = $this->normalizeTargetText((string) ($commentTarget['label'] ?? ''));
            $targetLabel = $this->normalizeTargetText((string) ($target['label'] ?? ''));
            if ($commentKind !== '' && $commentKind === $targetKind && $commentLabel !== '' && $commentLabel === $targetLabel) {
                return true;
            }
        }

        return false;
    }

    private function targetReferenceLabel(array $target): string
    {
        $label = trim((string) ($target['label'] ?? ''));
        if ($label !== '') {
            return $label;
        }

        return match ((string) ($target['kind'] ?? '')) {
            'caput' => 'Caput',
            'paragraph' => 'Paragrafo',
            'inciso' => 'Inciso',
            'alinea' => 'Alinea',
            'item' => 'Item',
            default => 'Bloco',
        };
    }

    private function normalizeGeneratedTarget($value, array $context, string $fallbackText = ''): array
    {
        $target = $this->normalizeRichBlockTarget($value);
        $blocks = is_array($context['article']['blocks'] ?? null) ? $context['article']['blocks'] : [];
        if (empty($blocks)) {
            return $target;
        }

        $requestedBlockId = (string) ($target['blockId'] ?? '');
        $requestedKind = (string) ($target['kind'] ?? '');
        $requestedLabel = $this->normalizeTargetText((string) ($target['label'] ?? ''));
        $fallback = $this->normalizeTargetText($fallbackText);

        $normalizedBlocks = [];
        foreach ($blocks as $block) {
            if (!is_array($block)) {
                continue;
            }

            $blockId = $this->sanitizeInlineText((string) ($block['id'] ?? ''));
            $kind = strtolower($this->sanitizeInlineText((string) ($block['kind'] ?? 'caput')));
            $label = $this->sanitizeInlineText((string) ($block['label'] ?? ''));
            $text = $this->sanitizeInlineText((string) ($block['text'] ?? ''));
            if ($blockId === '' && $label === '' && $text === '') {
                continue;
            }

            $normalizedBlocks[] = [
                'blockId' => $blockId,
                'kind' => in_array($kind, ['caput', 'paragraph', 'inciso', 'alinea', 'item', 'note'], true) ? $kind : 'caput',
                'label' => $label,
                'search' => $this->normalizeTargetText($label . ' ' . $text),
            ];
        }

        if (empty($normalizedBlocks)) {
            return $target;
        }

        foreach ($normalizedBlocks as $block) {
            if ($requestedBlockId !== '' && $requestedBlockId === $block['blockId']) {
                return $this->buildGeneratedTargetFromBlock($block);
            }
        }

        foreach ($normalizedBlocks as $block) {
            $blockLabel = $this->normalizeTargetText($block['label']);
            $labelMatch = $requestedLabel !== '' && (
                $blockLabel !== ''
                && ($blockLabel === $requestedLabel
                    || str_contains($blockLabel, $requestedLabel)
                    || str_contains($requestedLabel, $blockLabel))
            );
            $kindMatch = $requestedKind !== '' && $requestedKind === $block['kind'];
            if ($labelMatch && ($requestedKind === '' || $kindMatch)) {
                return $this->buildGeneratedTargetFromBlock($block);
            }
        }

        foreach ($normalizedBlocks as $block) {
            $label = $this->normalizeTargetText($block['label']);
            if ($label !== '' && $fallback !== '' && str_contains($fallback, $label)) {
                return $this->buildGeneratedTargetFromBlock($block);
            }
        }

        foreach ($normalizedBlocks as $block) {
            if ($requestedKind !== '' && $requestedKind === $block['kind']) {
                return $this->buildGeneratedTargetFromBlock($block);
            }
        }

        foreach ($normalizedBlocks as $block) {
            if ($block['kind'] === 'caput') {
                return $this->buildGeneratedTargetFromBlock($block);
            }
        }

        return $this->buildGeneratedTargetFromBlock($normalizedBlocks[0]);
    }

    private function buildGeneratedTargetFromBlock(array $block): array
    {
        $label = $block['label'] !== '' ? $block['label'] : match ($block['kind']) {
            'caput' => 'Caput',
            'paragraph' => 'Paragrafo',
            'inciso' => 'Inciso',
            'alinea' => 'Alinea',
            'item' => 'Item',
            default => 'Bloco',
        };

        return array_filter([
            'kind' => $block['kind'],
            'label' => $label,
            'blockId' => $block['blockId'] ?? '',
        ], static fn ($item): bool => trim((string) $item) !== '');
    }

    private function normalizeTargetText(string $value): string
    {
        $value = $this->sanitizeInlineText($value);
        $value = strtr($value, [
            "\xC2\xBA" => 'o',
            "\xC2\xAA" => 'a',
            "\xC2\xA7" => 'paragrafo ',
            "\xC3\x82" => '',
            "\xC3\x83" => '',
            "\xE2\x80\x9A" => '',
        ]);
        $value = iconv('UTF-8', 'ASCII//TRANSLIT//IGNORE', $value) ?: $value;
        $value = strtolower($value);
        $value = preg_replace('/[^a-z0-9]+/u', ' ', $value) ?: $value;
        return trim((string) preg_replace('/\s+/u', ' ', $value));
    }

    private function firstNonEmptyText(...$values): string
    {
        foreach ($values as $value) {
            $text = trim((string) $value);
            if ($text !== '') {
                return $text;
            }
        }

        return '';
    }

    private function sanitizeInlineText(string $value): string
    {
        $value = html_entity_decode(strip_tags($value), ENT_QUOTES, 'UTF-8');
        return trim((string) preg_replace('/\s+/u', ' ', $value));
    }

    private function escapeHtml(string $value): string
    {
        return htmlspecialchars($this->sanitizeInlineText($value), ENT_QUOTES, 'UTF-8');
    }

    private function limitPromptText(string $value, int $limit): string
    {
        $value = trim($this->sanitizeInlineText($value));
        if ($limit <= 0 || mb_strlen($value) <= $limit) {
            return $value;
        }

        return mb_substr($value, 0, max(0, $limit - 3)) . '...';
    }

    /**
     * Mantem comentario do professor curto o bastante para passar na regra editorial.
     * Gemini tende a responder com analise maior; a UI precisa de nota breve por artigo.
     */
    private function fitGeneratedComment(string $value): string
    {
        $value = trim($this->sanitizeInlineText($value));
        if ($value === '' || mb_strlen($value) <= 340) {
            return $value;
        }

        $sentences = preg_split('/(?<=[.!?])\s+/u', $value) ?: [];
        $selected = [];
        $current = '';

        foreach ($sentences as $sentence) {
            $sentence = trim((string) $sentence);
            if ($sentence === '') {
                continue;
            }

            $candidate = trim($current . ' ' . $sentence);
            if ($candidate !== '' && mb_strlen($candidate) > 340) {
                break;
            }

            $selected[] = $sentence;
            $current = $candidate;
            if (count($selected) >= 3) {
                break;
            }
        }

        $fitted = trim(implode(' ', $selected));
        if ($fitted !== '') {
            return $fitted;
        }

        return rtrim(mb_substr($value, 0, 337), " \t\n\r\0\x0B.,;:") . '...';
    }

    private function requestJson(
        string $prompt,
        array $schema,
        ?string $model = null,
        ?int $maxOutputTokens = null,
        ?float $temperature = null,
        ?int $requestTimeoutSeconds = null
    ): array
    {
        $payload = [
            'model' => $model ?: self::DEFAULT_MODEL,
            'prompt' => $prompt,
            'responseMimeType' => 'application/json',
            'responseSchema' => $schema,
        ];

        if ($maxOutputTokens !== null) {
            $payload['maxOutputTokens'] = $maxOutputTokens;
        }

        if ($temperature !== null) {
            $payload['temperature'] = $temperature;
        }

        if ($requestTimeoutSeconds !== null) {
            $payload['requestTimeoutSeconds'] = $requestTimeoutSeconds;
        }

        $lastText = '';
        $lastProviderError = null;

        for ($attempt = 1; $attempt <= 2; $attempt++) {
            $attemptPayload = $payload;
            if ($attempt > 1) {
                $attemptPayload['prompt'] .= "\n\nATENCAO DE FORMATO: a resposta anterior nao foi JSON parseavel. Retorne somente um unico objeto JSON valido, sem markdown, sem texto antes/depois e sem copiar texto legal longo em target.label.";
                $attemptPayload['temperature'] = 0.0;
            }

            try {
                $response = $this->aiService->generate($attemptPayload);
            } catch (Throwable $e) {
                $lastProviderError = $e;
                break;
            }

            $text = is_array($response) ? (string) ($response['text'] ?? '') : (string) $response;
            $text = trim($text);
            $lastText = $text;

            if ($text === '') {
                return [];
            }

            $decoded = json_decode($text, true);
            if (!is_array($decoded)) {
                $decoded = $this->decodeFirstJsonObject($text);
            }

            if (is_array($decoded)) {
                return $decoded;
            }
        }

        if ($lastProviderError instanceof Throwable) {
            throw new RuntimeException($lastProviderError->getMessage());
        }

        $sample = $this->sanitizeInlineText(mb_substr($lastText, 0, 180));
        $suffix = $sample !== '' ? ' Amostra recebida: ' . $sample : '';
        throw new RuntimeException('A IA nao retornou JSON valido para a Lei Comentada.' . $suffix);
    }

    private function shouldChunkSectionAnalysis(array $context, array $sectionArticles): bool
    {
        $articleContextLength = mb_strlen((string) ($context['articleContext'] ?? ''), 'UTF-8');
        $rawTextLength = $this->estimateSectionRawTextLength($sectionArticles);

        return count($sectionArticles) > self::SECTION_ANALYSIS_CHUNK_ARTICLE_LIMIT
            || $rawTextLength > self::SECTION_ANALYSIS_CHUNK_INPUT_THRESHOLD
            || $articleContextLength >= 23000;
    }

    private function isSectionAnalysisSizeFailure(string $message): bool
    {
        $normalized = strtolower($message);

        return str_contains($normalized, 'json valido')
            || str_contains($normalized, 'json parseavel')
            || str_contains($normalized, 'interrompida')
            || str_contains($normalized, 'timeout')
            || str_contains($normalized, 'timed out')
            || str_contains($normalized, 'maximum execution time')
            || str_contains($normalized, 'max_output')
            || str_contains($normalized, 'finishreason');
    }

    private function estimateSectionRawTextLength(array $sectionArticles): int
    {
        $length = 0;
        foreach ($sectionArticles as $article) {
            if (!is_array($article)) {
                continue;
            }

            $number = trim((string) ($article['number'] ?? $article['numero'] ?? ''));
            $articleText = $this->buildArticleTextForPrompt([
                'number' => $number,
                'title' => (string) ($article['title'] ?? $article['titulo'] ?? ''),
                'text' => (string) ($article['text'] ?? $article['texto'] ?? ''),
                'blocks' => is_array($article['blocks'] ?? null) ? $article['blocks'] : [],
            ]);
            $structure = $this->buildArticleStructureForPrompt([
                'number' => $number,
                'blocks' => is_array($article['blocks'] ?? null) ? $article['blocks'] : [],
            ]);

            $length += mb_strlen($articleText . "\n" . $structure, 'UTF-8');
        }

        return $length;
    }

    private function splitSectionArticlesForAnalysis(array $sectionArticles): array
    {
        $chunks = [];
        $current = [];
        $currentLength = 0;

        foreach ($sectionArticles as $article) {
            if (!is_array($article)) {
                continue;
            }

            $articleLength = max(800, $this->estimateSectionRawTextLength([$article]));
            $shouldStartNewChunk = !empty($current)
                && (
                    count($current) >= self::SECTION_ANALYSIS_CHUNK_ARTICLE_LIMIT
                    || ($currentLength + $articleLength) > self::SECTION_ANALYSIS_CHUNK_CONTEXT_LIMIT
                );

            if ($shouldStartNewChunk) {
                $chunks[] = $current;
                $current = [];
                $currentLength = 0;
            }

            $current[] = $article;
            $currentLength += $articleLength;
        }

        if (!empty($current)) {
            $chunks[] = $current;
        }

        return !empty($chunks) ? $chunks : [$sectionArticles];
    }

    private function requestChunkedSectionAnalysisResponse(
        array $law,
        array $sectionPayload,
        array $sectionArticles,
        array $baseContext
    ): array {
        $chunks = $this->splitSectionArticlesForAnalysis($sectionArticles);
        $totalChunks = count($chunks);
        @set_time_limit(min(900, max(600, 90 * max(1, $totalChunks))));
        $htmlParts = [
            $this->buildChunkedSectionIntroHtml($baseContext, $sectionArticles, $totalChunks),
        ];

        foreach ($chunks as $index => $chunkArticles) {
            $chunkContext = $this->buildSectionPromptContext(
                $law,
                $sectionPayload,
                $chunkArticles,
                5200,
                2600,
                self::SECTION_ANALYSIS_CHUNK_CONTEXT_LIMIT
            );
            $chunkContext['rangeLabel'] = $this->buildArticleRangeLabel($chunkArticles);
            $chunkContext['articleCount'] = count($chunkArticles);

            $chunkHtml = $this->requestText(
                $this->buildPromptSectionAnalysisChunkHtml($baseContext, $chunkContext, $index + 1, $totalChunks),
                self::SECTION_ANALYSIS_MODEL,
                self::SECTION_ANALYSIS_CHUNK_MAX_OUTPUT_TOKENS,
                0.25,
                self::SECTION_ANALYSIS_REQUEST_TIMEOUT_SECONDS
            );
            $chunkHtml = $this->completeSectionAnalysisChunkIfNeeded($chunkHtml, $baseContext, $chunkContext, $index + 1, $totalChunks);
            $chunkHtml = $this->stripRepeatedSectionAnalysisHeading($chunkHtml);

            if ($chunkHtml !== '') {
                $range = $this->escapeHtml((string) ($chunkContext['rangeLabel'] ?? ''));
                $htmlParts[] = '<section><h2>Analise dos artigos ' . $range . '</h2>' . $chunkHtml . '</section>';
            }
        }

        $htmlParts[] = $this->buildChunkedSectionClosingHtml($baseContext, $sectionArticles);

        return $this->buildSectionAnalysisResponseFromHtml(implode("\n\n", array_filter($htmlParts)), $baseContext);
    }

    private function buildArticleRangeLabel(array $articles): string
    {
        $numbers = [];
        foreach ($articles as $article) {
            if (!is_array($article)) {
                continue;
            }
            $number = trim((string) ($article['number'] ?? $article['numero'] ?? ''));
            if ($number !== '') {
                $numbers[] = $number;
            }
        }

        $numbers = array_values(array_unique($numbers));
        if (empty($numbers)) {
            return 'artigos selecionados';
        }

        if (count($numbers) === 1) {
            return 'Art. ' . $numbers[0];
        }

        return 'Art. ' . $numbers[0] . ' ao Art. ' . $numbers[count($numbers) - 1];
    }

    private function buildChunkedSectionIntroHtml(array $context, array $sectionArticles, int $totalChunks): string
    {
        $lawTitle = $this->escapeHtml((string) ($context['lawTitle'] ?? 'Lei Comentada'));
        $lawNumber = $this->escapeHtml((string) ($context['lawNumber'] ?? ''));
        $sectionTitle = $this->escapeHtml((string) ($context['sectionTitle'] ?? 'Capitulo da lei'));
        $rangeLabel = $this->escapeHtml((string) ($context['rangeLabel'] ?? $this->buildArticleRangeLabel($sectionArticles)));
        $rows = [];
        foreach ($sectionArticles as $article) {
            if (!is_array($article)) {
                continue;
            }
            $number = $this->escapeHtml((string) ($article['number'] ?? $article['numero'] ?? ''));
            $title = $this->escapeHtml((string) ($article['title'] ?? $article['titulo'] ?? 'Ponto-chave do artigo'));
            if ($number !== '') {
                $rows[] = '<tr><td>Art. ' . $number . '</td><td>' . ($title !== '' ? $title : 'Leitura de prova do dispositivo') . '</td><td>Literalidade, interpretacao e pegadinhas do texto.</td></tr>';
            }
        }

        $overview = !empty($rows)
            ? '<h2>Visao geral do capitulo</h2><table><thead><tr><th>Artigo</th><th>Nucleo</th><th>Foco de prova</th></tr></thead><tbody>' . implode('', $rows) . '</tbody></table>'
            : '';

        return trim(
            '<h1>' . $lawTitle . ($lawNumber !== '' ? ' (' . $lawNumber . ')' : '') . ' - ' . $sectionTitle . '</h1>'
            . '<p><strong>Guia para concursos</strong> - linguagem simples, foco em pegadinhas, jurisprudencia segura e cobranca em prova.</p>'
            . '<p>Unidade analisada: <strong>' . $rangeLabel . '</strong>. A leitura abaixo prioriza o que o aluno precisa reconhecer em assertivas, casos concretos e trocas de palavras feitas por bancas.</p>'
            . $overview
        );
    }

    private function buildChunkedSectionClosingHtml(array $context, array $sectionArticles): string
    {
        $rows = [];
        foreach ($sectionArticles as $article) {
            if (!is_array($article)) {
                continue;
            }
            $number = $this->escapeHtml((string) ($article['number'] ?? $article['numero'] ?? ''));
            $title = $this->escapeHtml((string) ($article['title'] ?? $article['titulo'] ?? ''));
            if ($number !== '') {
                $rows[] = '<tr><td>Art. ' . $number . '</td><td>' . ($title !== '' ? $title : 'Dispositivo da secao') . '</td><td>Revisar literalidade, termos absolutos e finalidade do trecho.</td></tr>';
            }
        }

        $table = !empty($rows)
            ? '<h2>Resumo ultra-rapido em tabela</h2><table><thead><tr><th>Artigo</th><th>Nucleo</th><th>Cuidado em prova</th></tr></thead><tbody>' . implode('', $rows) . '</tbody></table>'
            : '';

        return trim(
            '<h2>Top pegadinhas de concurso</h2>'
            . '<ul>'
            . '<li><strong>Troca de verbo:</strong> devera, podera, sempre, somente, salvo e exceto costumam mudar o sentido da norma.</li>'
            . '<li><strong>Generalizacao indevida:</strong> a banca tenta transformar regra contextual em regra absoluta.</li>'
            . '<li><strong>Confusao de sujeitos:</strong> cuidado com quem tem dever, quem tem direito e quem recebe protecao.</li>'
            . '</ul>'
            . $table
            . '<h2>Grau de importancia para concursos</h2>'
            . '<p>A incidencia abaixo e <strong>estimativa pedagogica</strong>, nao estatistica oficial: priorize artigos com conceitos, excecoes, direitos, deveres, procedimentos e palavras absolutas.</p>'
            . '<h2>Checklist de revisao rapida</h2>'
            . '<ul>'
            . '<li><strong>Decorar:</strong> palavras-chave, sujeitos da norma, excecoes e verbos que indicam obrigatoriedade ou faculdade.</li>'
            . '<li><strong>Entender:</strong> finalidade pratica do capitulo e conexao entre os artigos.</li>'
            . '<li><strong>Cuidado:</strong> nao confundir protecao, punicao, competencia, procedimento e requisito.</li>'
            . '<li><strong>Provavel cobranca:</strong> literalidade, caso concreto, troca de palavras e comparacao entre dispositivos.</li>'
            . '<li><strong>Erro a evitar:</strong> responder por intuicao sem conferir o termo exato usado pela lei.</li>'
            . '</ul>'
        );
    }

    private function buildPromptSectionAnalysisChunkHtml(array $baseContext, array $chunkContext, int $chunkIndex, int $totalChunks): string
    {
        $lawTitle = trim((string) ($baseContext['lawTitle'] ?? 'Lei Comentada'));
        $lawNumber = trim((string) ($baseContext['lawNumber'] ?? ''));
        $sectionTitle = trim((string) ($baseContext['sectionTitle'] ?? 'Capitulo da lei'));
        $rangeLabel = trim((string) ($chunkContext['rangeLabel'] ?? ''));
        $articleContext = trim((string) ($chunkContext['articleContext'] ?? ''));
        $existingEditorialContext = trim((string) ($chunkContext['existingEditorialContext'] ?? ''));

        return trim("
Voce e professor especialista em concursos publicos e vai gerar uma PARTE da analise detalhada de um capitulo.

CONTEXTO GERAL:
- Lei: {$lawTitle}
- Numero: {$lawNumber}
- Capitulo/secao: {$sectionTitle}
- Parte: {$chunkIndex} de {$totalChunks}
- Artigos desta parte: {$rangeLabel}

TEXTO OFICIAL DESTA PARTE:
{$articleContext}

CONTEUDO EDITORIAL JA EXISTENTE PARA EVITAR REPETICAO:
{$existingEditorialContext}

REGRAS:
- Retorne APENAS HTML seguro, sem JSON, sem markdown fenced block e sem texto antes/depois.
- Nao use <h1>; a capa global ja sera montada pelo backend.
- Cubra TODOS os artigos desta parte. Nao pule artigo.
- Nao resuma genericamente. Explique para leigo, como professor de cursinho, com foco em prova.
- Para cada artigo relevante, use <h2>ART. X - tema em linguagem simples</h2> e, quando fizer sentido, <h3>O que cai muito em prova</h3>, <h3>Pegadinha classica</h3>, <h3>Macete</h3>, <h3>Chance de cobranca</h3>.
- Inclua caput, paragrafos, incisos, alineas e itens quando forem relevantes para a cobranca.
- Cite jurisprudencia, sumula ou doutrina somente quando houver seguranca; se nao houver, diga de forma prudente.
- Use percentuais apenas como estimativa pedagogica.
- Use HTML editavel: <h2>, <h3>, <p>, <strong>, <em>, <u>, <mark>, <span style=\"color:#2563eb\">, <ul>, <ol>, <li>, <blockquote>, <table>, <thead>, <tbody>, <tr>, <th>, <td>.
- Tabelas devem ser HTML real com linhas e colunas, nunca texto alinhado por espacos.
- Termine a parte com <h2>Questoes rapidas desta parte</h2>, contendo 1 questao certo/errado e 1 multipla escolha com gabarito comentado.
- Termine com frase completa e pontuacao final.
");
    }

    private function completeSectionAnalysisChunkIfNeeded(
        string $html,
        array $baseContext,
        array $chunkContext,
        int $chunkIndex,
        int $totalChunks
    ): string {
        $html = $this->sanitizeGeneratedStudyHtml($this->stripSectionAnalysisGreeting($html));

        if ($this->isGeneratedStudyHtmlInterrupted($html)) {
            $html = $this->appendSectionAnalysisChunkFallbackClosing(
                $html,
                $baseContext,
                $chunkContext,
                $chunkIndex,
                $totalChunks
            );
        }

        return $html;
    }

    private function buildPromptSectionAnalysisChunkContinuation(
        array $baseContext,
        array $chunkContext,
        string $currentHtml,
        int $chunkIndex,
        int $totalChunks,
        int $attempt
    ): string {
        $lawTitle = trim((string) ($baseContext['lawTitle'] ?? 'Lei Comentada'));
        $sectionTitle = trim((string) ($baseContext['sectionTitle'] ?? 'Capitulo da lei'));
        $rangeLabel = trim((string) ($chunkContext['rangeLabel'] ?? ''));
        $articleContext = trim((string) ($chunkContext['articleContext'] ?? ''));
        $tail = trim(mb_substr($currentHtml, -5000, null, 'UTF-8'));

        return trim("
A parte {$chunkIndex}/{$totalChunks} da analise abaixo foi cortada. Continue exatamente de onde parou.

CONTEXTO:
- Lei: {$lawTitle}
- Capitulo/secao: {$sectionTitle}
- Artigos desta parte: {$rangeLabel}
- Tentativa: {$attempt}

ARTIGOS DESTA PARTE:
{$articleContext}

ULTIMO TRECHO GERADO:
{$tail}

REGRAS:
- Retorne APENAS HTML seguro.
- Nao reinicie a analise, nao use <h1> e nao repita secoes ja concluidas.
- Complete a frase interrompida e finalize a parte.
- Inclua, se ainda nao houver no trecho, <h2>Questoes rapidas desta parte</h2> com gabarito comentado.
- Termine com frase completa e pontuacao final.
");
    }

    private function stripRepeatedSectionAnalysisHeading(string $html): string
    {
        $html = $this->sanitizeGeneratedStudyHtml($this->stripSectionAnalysisGreeting($html));
        $html = (string) preg_replace('/^\s*<h1\b[^>]*>[\s\S]*?<\/h1>\s*/iu', '', $html);
        return trim($html);
    }

    private function requestSectionAnalysisResponse(array $context): array
    {
        $html = $this->requestText(
            $this->buildPromptSectionAnalysisHtmlFallback($context),
            self::SECTION_ANALYSIS_MODEL,
            self::SECTION_ANALYSIS_MAX_OUTPUT_TOKENS,
            0.25,
            self::SECTION_ANALYSIS_REQUEST_TIMEOUT_SECONDS
        );

        return $this->buildSectionAnalysisResponseFromHtml($html, $context);
    }

    private function requestText(
        string $prompt,
        ?string $model = null,
        ?int $maxOutputTokens = null,
        ?float $temperature = null,
        ?int $requestTimeoutSeconds = null
    ): string
    {
        $payload = [
            'model' => $model ?: self::DEFAULT_MODEL,
            'prompt' => $prompt,
        ];

        if ($maxOutputTokens !== null) {
            $payload['maxOutputTokens'] = $maxOutputTokens;
        }

        if ($temperature !== null) {
            $payload['temperature'] = $temperature;
        }

        if ($requestTimeoutSeconds !== null) {
            $payload['requestTimeoutSeconds'] = $requestTimeoutSeconds;
        }

        if ($requestTimeoutSeconds !== null) {
            $payload['requestTimeoutSeconds'] = $requestTimeoutSeconds;
        }

        $response = $this->aiService->generate($payload);
        $text = is_array($response) ? (string) ($response['text'] ?? '') : (string) $response;
        $text = trim($text);

        if ($text === '') {
            throw new RuntimeException('AI Engine Error: a IA nao retornou conteudo para a analise da Lei Comentada.');
        }

        return $text;
    }

    private function isInvalidAiJsonError(string $message): bool
    {
        return stripos($message, 'JSON valido') !== false
            || stripos($message, 'JSON parseavel') !== false;
    }

    private function buildSectionAnalysisResponseFromHtml(string $html, array $context): array
    {
        $html = $this->sanitizeGeneratedStudyHtml($this->stripSectionAnalysisGreeting($html));
        $summary = $this->limitPromptText($html, 420);

        return [
            'titulo' => trim((string) ($context['sectionTitle'] ?? 'Analise detalhada da secao')),
            'importance' => 'alta',
            'style' => 'analise_completa',
            'summary' => $summary,
            'analiseContinuaHtml' => $html,
            'resumoEstrategico' => $summary,
            'visaoGeralTabela' => [[
                'unidade' => trim((string) ($context['sectionTitle'] ?? 'Secao da lei')),
                'artigos' => trim((string) ($context['rangeLabel'] ?? '')),
                'importancia' => 'Alta, quando o tema for recorrente em concursos',
                'incidencia' => 'Estimativa pedagogica',
                'bancas' => 'CESPE/CEBRASPE, FGV, FCC, VUNESP, IBFC, Instituto AOCP e bancas locais',
                'perfilCobranca' => 'Literalidade, interpretacao, troca de palavras e caso concreto',
                'dificuldade' => 'Media',
                'pontosPerigosos' => 'Excecoes, termos absolutos e confusao entre finalidade, sujeito protegido e deveres',
                'prioridade' => 'Alta',
            ]],
            'panoramaGeral' => '',
            'analisePorDispositivo' => [],
            'comoCaiEmProva' => [],
            'perfilPorBanca' => [],
            'incidenciaEstimativa' => [],
            'pegadinhas' => [],
            'jurisprudencia' => '',
            'termosChave' => [],
            'macetes' => [],
            'mapaMental' => '',
            'questoesSimuladas' => [],
            'checklistRevisao' => [],
            'examFocus' => [],
            'keywords' => [],
            'doctrine' => [],
            'highlights' => [],
        ];
    }

    private function appendSectionAnalysisFallbackClosing(string $html, array $context): string
    {
        $html = $this->sanitizeGeneratedStudyHtml($this->stripSectionAnalysisGreeting($html));
        $html = $this->closeCommonGeneratedHtmlTags($html);
        $plain = $this->sanitizeInlineText($html);

        $needsChecklist = preg_match('/checklist de revis(?:a|ao|Ã£o) rapida|checklist de revis(?:a|ao|Ã£o) r(?:a|Ã¡)pida/iu', $plain) !== 1;
        if ($needsChecklist) {
            $html = rtrim($html) . "\n" . $this->buildSectionAnalysisFallbackClosingHtml($context);
        }

        $html = $this->closeCommonGeneratedHtmlTags($html);
        return $this->sanitizeGeneratedStudyHtml($html);
    }

    private function appendSectionAnalysisChunkFallbackClosing(
        string $html,
        array $baseContext,
        array $chunkContext,
        int $chunkIndex,
        int $totalChunks
    ): string {
        $html = $this->sanitizeGeneratedStudyHtml($this->stripSectionAnalysisGreeting($html));
        $html = $this->closeCommonGeneratedHtmlTags($html);
        $plain = $this->sanitizeInlineText($html);

        if (stripos($plain, 'Questoes rapidas desta parte') === false) {
            $rangeLabel = $this->escapeHtml((string) ($chunkContext['rangeLabel'] ?? 'esta parte'));
            $html = rtrim($html)
                . "\n"
                . '<h2>Questoes rapidas desta parte</h2>'
                . '<ol>'
                . '<li><strong>Certo ou errado:</strong> em prova, a leitura dos artigos ' . $rangeLabel . ' deve priorizar sujeito, verbo da norma e excecoes expressas. <em>Gabarito: certo.</em></li>'
                . '<li><strong>Multipla escolha:</strong> a alternativa mais segura costuma reproduzir a finalidade do dispositivo sem ampliar nem restringir o texto legal. <em>Gabarito comentado:</em> escolha a opcao fiel ao texto e desconfie de termos absolutos.</li>'
                . '</ol>';
        }

        $html = rtrim($html)
            . "\n"
            . '<p><em>Parte ' . (int) $chunkIndex . ' de ' . (int) $totalChunks . ' fechada automaticamente para manter a analise disponivel no painel.</em></p>';

        return $this->sanitizeGeneratedStudyHtml($this->closeCommonGeneratedHtmlTags($html));
    }

    private function buildSectionAnalysisFallbackClosingHtml(array $context): string
    {
        $sectionTitle = $this->escapeHtml((string) ($context['sectionTitle'] ?? 'Secao da lei'));
        $rangeLabel = $this->escapeHtml((string) ($context['rangeLabel'] ?? 'artigos selecionados'));

        return trim(
            '<h2>Resumo ultra-rapido em tabela</h2>'
            . '<table><thead><tr><th>Unidade</th><th>Artigos</th><th>Como revisar</th></tr></thead><tbody>'
            . '<tr><td>' . $sectionTitle . '</td><td>' . $rangeLabel . '</td><td>Revise literalidade, sujeitos, verbos, excecoes e finalidade da norma.</td></tr>'
            . '</tbody></table>'
            . '<h2>Grau de importancia para concursos</h2>'
            . '<p>A importancia deve ser lida como estimativa pedagogica: priorize os pontos com conceitos, deveres, direitos, excecoes e palavras que mudam o alcance da regra.</p>'
            . '<h2>Questoes simuladas</h2>'
            . '<ol>'
            . '<li><strong>Certo ou errado:</strong> a banca pode trocar uma expressao restritiva por uma absoluta para alterar o sentido do dispositivo. <em>Gabarito: certo.</em></li>'
            . '<li><strong>Multipla escolha:</strong> a alternativa correta tende a respeitar o texto legal e a finalidade do artigo sem criar requisito novo. <em>Gabarito comentado:</em> descarte opcoes que ampliem, reduzam ou invertam o comando da lei.</li>'
            . '</ol>'
            . '<h2>Checklist de revisao rapida</h2>'
            . '<ul>'
            . '<li><strong>Decorar:</strong> palavras-chave, excecoes e sujeitos da norma.</li>'
            . '<li><strong>Entender:</strong> a finalidade pratica do trecho e sua ligacao com os demais artigos.</li>'
            . '<li><strong>Cuidado:</strong> termos como sempre, nunca, somente, salvo, exceto, podera e devera.</li>'
            . '<li><strong>Resolver questoes:</strong> comparar o enunciado com o texto literal antes de marcar a alternativa.</li>'
            . '</ul>'
        );
    }

    private function closeCommonGeneratedHtmlTags(string $html): string
    {
        $content = trim($html);
        if ($content === '') {
            return '';
        }

        foreach (['td', 'th', 'tr', 'tbody', 'thead', 'table', 'li', 'ul', 'ol', 'blockquote', 'section', 'div'] as $tag) {
            $openCount = preg_match_all('/<' . preg_quote($tag, '/') . '\b[^>]*>/iu', $content) ?: 0;
            $closeCount = preg_match_all('/<\/' . preg_quote($tag, '/') . '>/iu', $content) ?: 0;
            for ($index = $closeCount; $index < $openCount; $index++) {
                $content .= '</' . $tag . '>';
            }
        }

        return $content;
    }

    private function completeSectionAnalysisResponseIfNeeded(array $response, array $context): array
    {
        $html = $this->extractContinuousSectionAnalysisHtml($response);
        if ($html === '') {
            $html = $this->buildContinuousSectionAnalysisHtml($response);
        }

        $html = $this->sanitizeGeneratedStudyHtml($this->stripSectionAnalysisGreeting($html));
        if ($html === '') {
            return $response;
        }

        if ($this->isSectionAnalysisIncomplete($html)) {
            $html = $this->appendSectionAnalysisFallbackClosing($html, $context);
        }

        $response['analiseContinuaHtml'] = $html;
        $response['analiseContinua'] = '';
        $response['mainAnalysisHtml'] = '';
        $response['mainAnalysis'] = '';
        $response['blocks'] = [];

        return $response;
    }

    private function extractContinuousSectionAnalysisHtml(array $response): string
    {
        return $this->firstNonEmptyText(
            $response['analiseContinuaHtml'] ?? null,
            $response['analiseContinua'] ?? null,
            $response['mainAnalysisHtml'] ?? null,
            $response['mainAnalysis'] ?? null
        );
    }

    private function isSectionAnalysisIncomplete(string $html): bool
    {
        $content = trim($html);
        if ($content === '') {
            return true;
        }

        if ($this->hasUnclosedSectionAnalysisHtmlTags($content)) {
            return true;
        }

        $plain = trim(html_entity_decode(strip_tags($content), ENT_QUOTES, 'UTF-8'));
        $plain = (string) preg_replace('/\s+/u', ' ', $plain);
        if ($plain === '') {
            return true;
        }

        if (preg_match('/checklist de revis(?:a|ao|ão) rapida|checklist de revis(?:a|ao|ão) r(?:a|á)pida/iu', $plain) !== 1) {
            return true;
        }

        $tail = trim(mb_substr($plain, -260));
        if (preg_match('/(?:^|\s)(e|de|da|do|das|dos|a|o|as|os|que|para|por|com|sem|entre|sobre|apenas|somente|salvo|exceto|excluindo|incluindo|quando|pois|porque|ou|ao|aos)$/iu', $tail) === 1) {
            return true;
        }

        $lastChar = mb_substr($plain, -1);
        return preg_match('/[.!?;:)\]"\']$/u', $lastChar) !== 1;
    }

    private function isGeneratedStudyHtmlInterrupted(string $html): bool
    {
        $content = trim($html);
        if ($content === '') {
            return true;
        }

        if ($this->hasUnclosedSectionAnalysisHtmlTags($content)) {
            return true;
        }

        $plain = trim(html_entity_decode(strip_tags($content), ENT_QUOTES, 'UTF-8'));
        $plain = (string) preg_replace('/\s+/u', ' ', $plain);
        if ($plain === '') {
            return true;
        }

        $tail = trim(mb_substr($plain, -260, null, 'UTF-8'));
        if (preg_match('/(?:^|\s)(e|de|da|do|das|dos|a|o|as|os|que|para|por|com|sem|entre|sobre|apenas|somente|salvo|exceto|excluindo|incluindo|quando|pois|porque|ou|ao|aos)$/iu', $tail) === 1) {
            return true;
        }

        $lastChar = mb_substr($plain, -1, null, 'UTF-8');
        return preg_match('/[.!?;:)\]"\']$/u', $lastChar) !== 1;
    }

    private function hasUnclosedSectionAnalysisHtmlTags(string $html): bool
    {
        $lower = mb_strtolower($html, 'UTF-8');
        foreach (['table', 'thead', 'tbody', 'tr', 'ul', 'ol', 'blockquote', 'section', 'div'] as $tag) {
            if (substr_count($lower, '<' . $tag) > substr_count($lower, '</' . $tag . '>')) {
                return true;
            }
        }

        return false;
    }

    private function buildPromptSectionAnalysisContinuation(array $context, string $currentHtml, int $attempt): string
    {
        $lawTitle = trim((string) ($context['lawTitle'] ?? 'Lei Comentada'));
        $lawNumber = trim((string) ($context['lawNumber'] ?? ''));
        $sectionTitle = trim((string) ($context['sectionTitle'] ?? 'Capitulo da lei'));
        $rangeLabel = trim((string) ($context['rangeLabel'] ?? ''));
        $articleContext = trim((string) ($context['articleContext'] ?? ''));
        $tail = trim(mb_substr($currentHtml, -6000));

        return trim("
A analise detalhada abaixo foi cortada ou ficou sem fechamento obrigatorio. Continue exatamente de onde ela parou.

CONTEXTO:
- Lei: {$lawTitle}
- Numero: {$lawNumber}
- Unidade analisada: {$sectionTitle}
- Artigos abrangidos: {$rangeLabel}
- Tentativa de continuacao: {$attempt}

ARTIGOS DA UNIDADE:
{$articleContext}

ULTIMO TRECHO JA GERADO:
{$tail}

REGRAS:
- Retorne APENAS HTML seguro. Nao use markdown fenced block e nao explique o que esta fazendo.
- Nao reinicie a analise, nao cumprimente e nao repita secoes ja escritas.
- Complete a frase interrompida se o ultimo trecho terminar no meio de uma ideia.
- A continuacao deve manter o tom de material de cursinho para concursos: direto, estrategico, com pegadinhas, macetes, jurisprudencia/sumulas apenas quando seguras e foco em prova.
- Finalize obrigatoriamente com:
  <h2>Resumo ultra-rapido em tabela</h2> contendo uma tabela HTML completa com bordas logicas por linhas e colunas.
  <h2>Grau de importancia para concursos</h2>.
  <h2>Questoes simuladas</h2> com gabarito comentado.
  <h2>Checklist de revisao rapida</h2>.
- O texto final precisa terminar com frase completa e pontuacao final.
");
    }

    private function mergeSectionAnalysisContinuation(string $html, string $continuation): string
    {
        $continuation = $this->sanitizeGeneratedStudyHtml($this->stripSectionAnalysisGreeting($continuation));
        $continuation = (string) preg_replace('/^\s*<h1\b[^>]*>[\s\S]*?<\/h1>\s*/iu', '', $continuation);
        $continuation = trim($continuation);

        if ($continuation === '') {
            return $html;
        }

        return $this->sanitizeGeneratedStudyHtml(rtrim($html) . "\n" . ltrim($continuation));
    }

    private function buildPromptSectionAnalysisHtmlFallback(array $context): string
    {
        $lawTitle = trim((string) ($context['lawTitle'] ?? 'Lei Comentada'));
        $lawNumber = trim((string) ($context['lawNumber'] ?? ''));
        $lawOfficialUrl = trim((string) ($context['lawOfficialUrl'] ?? ''));
        $sectionTitle = trim((string) ($context['sectionTitle'] ?? 'Capitulo da lei'));
        $rangeLabel = trim((string) ($context['rangeLabel'] ?? ''));
        $articleCount = (int) ($context['articleCount'] ?? 0);
        $articleContext = trim((string) ($context['articleContext'] ?? ''));
        $existingEditorialContext = trim((string) ($context['existingEditorialContext'] ?? ''));

        return trim("
Voce e professor especialista em concursos publicos, analista de banca e criador de material premium de estudo.

A tentativa estruturada em JSON ficou grande demais. Agora retorne APENAS HTML seguro, sem JSON, sem markdown fenced block, sem texto antes/depois.

CONTEXTO:
- Lei: {$lawTitle}
- Numero: {$lawNumber}
- Fonte oficial, quando houver: {$lawOfficialUrl}
- Unidade analisada: {$sectionTitle}
- Artigos abrangidos: {$rangeLabel}
- Quantidade de artigos: {$articleCount}

TEXTO OFICIAL DA UNIDADE:
{$articleContext}

CONTEUDO EDITORIAL JA EXISTENTE NOS ARTIGOS:
{$existingEditorialContext}

PADRAO DE QUALIDADE:
- Nao resuma a lei. Escreva como material de estudo estrategico para concursos.
- Nao use saudacao, chamada motivacional ou frases como \"Ola, futuro aprovado\".
- Comece direto com <h1>{$lawTitle} ({$lawNumber}) - {$sectionTitle}</h1>.
- Use linguagem simples, tom de professor de cursinho e foco em prova.
- Inclua macetes, pegadinhas, palavras-chave, como a banca cobra, jurisprudencia/sumula apenas quando houver seguranca, conceitos importantes, questoes simuladas e checklist final.
- Use percentuais apenas como estimativa pedagogica, nunca como estatistica oficial sem base.
- Nao invente jurisprudencia, sumula, autor, estatistica ou link.
- Se nao houver jurisprudencia central indispensavel, diga isso de forma prudente e explique conexoes possiveis.
- Use HTML editavel e seguro: <h1>, <h2>, <h3>, <p>, <strong>, <em>, <u>, <mark>, <span style=\"color:#2563eb\">, <ul>, <ol>, <li>, <blockquote>, <table>, <thead>, <tbody>, <tr>, <th>, <td>.
- Tabelas devem ser tabelas HTML reais, com <table><thead><tr><th>...</th></tr></thead><tbody><tr><td>...</td></tr></tbody></table>.
- Nao use <script>, <style>, iframe, imagens, classes CSS ou atributos on*.

ESTRUTURA DO HTML:
1. <h1> com a lei e a unidade.
2. Uma frase curta de proposta da aula, sem saudacao.
3. Um paragrafo dizendo por que esta unidade cai em prova.
4. <h2>Visao geral</h2> com bullets: Art. X -> palavra-chave -> o que lembrar.
5. Para cada artigo relevante:
   <h2>ART. X - tema em linguagem simples</h2>
   explicacao direta;
   <h3>O que cai muito em prova</h3>
   <h3>Pegadinha classica</h3>
   <h3>Macete</h3>
   <h3>Chance de cobranca</h3>.
6. Secoes globais:
   Jurisprudencias importantes, Sumulas importantes ligadas ao tema, Doutrinas/conceitos que bancas adoram, Top pegadinhas de concurso, O que decorar, Resumo ultra-rapido em tabela, Grau de importancia para concursos, Questoes simuladas e Checklist de revisao rapida.

RETORNE SOMENTE O HTML.");
    }

    private function decodeFirstJsonObject(string $text): ?array
    {
        $text = trim($text);
        if ($text === '') {
            return null;
        }

        $text = preg_replace('/^```(?:json)?\s*/iu', '', $text) ?: $text;
        $text = preg_replace('/\s*```$/u', '', $text) ?: $text;
        $text = preg_replace('/[\x00-\x08\x0B\x0C\x0E-\x1F]/u', '', $text) ?: $text;
        $text = trim($text);

        $start = strpos($text, '{');
        $end = strrpos($text, '}');
        if ($start === false || $end === false || $end <= $start) {
            return null;
        }

        $candidate = substr($text, $start, $end - $start + 1);
        $decoded = json_decode($candidate, true);

        return is_array($decoded) ? $decoded : null;
    }

    private function buildPromptStageA(array $context): string
    {
        $promptContext = $this->buildEditorialPromptContext($context);

        return trim("
Voce e um editor juridico especializado em preparacao para concursos publicos.

Sua tarefa e gerar conteudo premium de Lei Comentada para UM artigo, como professor de cursinho para concursos publicos, com foco especial em carreiras policiais e juridicas.

REGRAS GERAIS:
- Nunca escreva introducoes, saudacoes ou frases como \"Prezados alunos\", \"Vamos analisar\", \"Neste artigo\".
- Comente diretamente o artigo.
- Varie naturalmente o formato conforme o dispositivo: artigo muito cobrado pede analise completa; artigo simples pede comentario curto; procedimento pede fluxo; comparacao pede quadro; ponto perigoso pede alerta; trecho repetitivo pede nota curta.
- Nao repita o texto do artigo em forma de parafrase.
- Nao use frases genericas como \"o artigo estabelece\", \"o artigo dispoe\", \"tem como objetivo\", \"visa\", \"trata de\".
- Nao comece todos os comentarios da mesma forma. Nao use molde fixo.
- O foco e: o que memorizar, como a banca cobra, pegadinhas, palavras-chave, termos perigosos (devera, podera, sempre, exclusivamente, qualquer, somente), relacao com CF, jurisprudencia, sumulas ou tratados quando houver base segura.
- Linguagem simples, tecnica e direta.
- Proibido floreio.
- Proibido texto motivacional.
- Nao invente jurisprudencia, sumula, tratado, autor ou entendimento. Se nao houver seguranca, nao cite.
- Se nao souber se e frequente em prova, escreva de modo prudente: \"pode ser explorado em prova\".
- E melhor retornar vazio no macete do que inventar um macete ruim.

CONTEXTO:
{$promptContext}

COMENTARIO:
- 1 a 3 frases curtas.
- Escreva como professor explicando para aluno leigo: direto, didatico e com foco no que muda na prova.
- Deve destacar:
  1. nucleo do artigo;
  2. ponto de maior incidencia em prova;
  3. eventual pegadinha, distincao ou palavra-chave de memorizacao.
- Nao tente comentar a lei inteira. Escolha o bloco mais importante do artigo e explique por que ele importa.
- Nao resumir o caput de forma burocratica.
- Se o artigo tiver caput, incisos, alineas ou paragrafos, foque no trecho que realmente carrega a regra, a excecao ou a pegadinha.

BLOCKS:
- Gere 1 a 5 blocos visuais, sem encher linguica.
- Cada bloco deve ter type, title, content/items/headers/rows e target.
- target.kind deve indicar onde a nota se encaixa: caput, paragraph, inciso, alinea, item ou article.
- target.label deve usar a etiqueta do texto legal quando existir: \"Caput\", \"Paragrafo unico\", \"§ 1º\", \"I\", \"a\".
- target.blockId deve copiar EXATAMENTE o blockId informado na ESTRUTURA EM BLOCOS. Nao invente blockId.
- Tipos permitidos: paragraph, bullet_list, table, warning, tip, macete, jurisprudence, example, comparison, summary.
- Use table apenas se houver comparacao real; use warning para pegadinha; use tip/macete para memorizacao; use paragraph para explicacao curta.

MACETE / PULO DO GATO:
- Regra absoluta: nao gere apenas mnemonico. O aluno precisa entender o que a banca costuma cobrar, alterar ou usar para confundir.
- O macete deve ajudar o aluno a acertar uma questao sem olhar a lei.
- Ele deve ser o pulo do gato: detalhe que a banca costuma trocar, termo perigoso, excecao ou confusao que derruba candidato.
- Deve se vincular ao bloco do artigo que sustenta o macete. Retorne target com kind, label e blockId real.
- PROIBIDO: siglas sem sentido, sequencia de iniciais, abreviacao mecanica, repeticao compactada do artigo.
- PROIBIDO: macetes como \"FIS-PSI-SEX-PAT-MOR-VIC\".
- OBRIGATORIO: frase curta, natural, memoravel e com utilidade pratica.
- So use \"Macete\" quando houver uma associacao mental real e clara.
- Estrutura preferencial:
  - macete: frase curta, natural e memoravel, com no maximo 12 palavras
  - comoLembrarNaProva: 1 linha explicando o que a banca costuma trocar, negar, ampliar, restringir ou confundir
- Se nao houver macete realmente bom, NAO invente sigla.
- Nesse caso, deixe \"macete\" e \"comoLembrarNaProva\" vazios e preencha \"chaveDeProva\" com o ponto mais cobrado ou a confusao mais comum da banca.

SAIDA:
{
  \"importance\": \"alta|media|baixa\",
  \"style\": \"analise_completa|comentario_curto|tabela|fluxo|alerta|comparativo|misto\",
  \"comentario\": \"string\",
  \"blocks\": [
    {
      \"type\": \"paragraph|bullet_list|table|warning|tip|macete|jurisprudence|example|comparison|summary\",
      \"title\": \"string\",
      \"content\": \"string\",
      \"items\": [\"string\"],
      \"headers\": [\"string\"],
      \"rows\": [[\"string\"]],
      \"target\": {\"kind\": \"caput|paragraph|inciso|alinea|item|article\", \"label\": \"string\", \"blockId\": \"string\"}
    }
  ],
  \"exam_focus\": \"string\",
  \"keywords\": [\"string\"],
  \"avoid_repetition_note\": \"string\",
  \"macete\": \"string\",
  \"comoLembrarNaProva\": \"string\",
  \"chaveDeProva\": \"string\",
  \"target\": {\"kind\": \"caput|paragraph|inciso|alinea|item|article\", \"label\": \"string\", \"blockId\": \"string\"},
  \"macetes\": [
    {
      \"macete\": \"string\",
      \"comoLembrarNaProva\": \"string\",
      \"chaveDeProva\": \"string\",
      \"target\": {\"kind\": \"caput|paragraph|inciso|alinea|item|article\", \"label\": \"string\", \"blockId\": \"string\"}
    }
  ]
}

Retorne APENAS JSON valido, sem markdown, sem explicacoes externas.
");
    }

    private function buildPromptFieldComment(array $context): string
    {
        $promptContext = $this->buildEditorialPromptContext($context);

        return trim("
Voce e um editor juridico especializado em preparacao para concursos publicos.

Gere SOMENTE o comentario do professor e os blocos ricos desse comentario para UM artigo de lei, como professor de cursinho para concursos publicos.

REGRAS:
- 1 a 3 frases curtas.
- Comente diretamente o artigo.
- Aja como professor: explique para leigo o que o bloco quer dizer, por que importa e qual cuidado tomar na prova.
- Destaque o nucleo do dispositivo, o ponto que cai em prova, pegadinha, palavra-chave ou distincao.
- Varie o formato: se for simples, seja curto; se for conceito importante, explique; se for procedimento, use fluxo; se houver comparacao, use tabela; se houver ponto perigoso, use alerta.
- Nunca use introducao, saudacao, floreio ou frases como \"o artigo estabelece\", \"o artigo dispoe\", \"tem como objetivo\", \"trata de\".
- Nao comece todos os comentarios da mesma forma e nao use estrutura fixa.
- Nao faca parafrase burocratica do texto legal.
- Nao invente jurisprudencia, sumula, tratado, autor ou frequencia de cobranca.
- Se a recorrencia em prova nao for segura, use \"pode ser explorado em prova\".
- Se nao houver comentario realmente pedagogico e estrategico, retorne string vazia.

CONTEXTO:
{$promptContext}

- Se o artigo estiver dividido em caput, incisos, alineas ou paragrafos, analise o bloco certo e explique o que ele muda, complementa ou excepciona.
- Se houver ALVO DIRECIONADO PELO ADMIN no contexto, comente apenas esse caput/paragrafo/inciso/alinea/item. Nao transforme em comentario geral do artigo.
- Em blocks, amarre cada nota ao target correto: caput, paragraph, inciso, alinea ou item.
- target.blockId deve copiar exatamente o blockId da ESTRUTURA EM BLOCOS. Se a nota for sobre o caput, use o blockId do caput.

SAIDA:
{
  \"importance\": \"alta|media|baixa\",
  \"style\": \"analise_completa|comentario_curto|tabela|fluxo|alerta|comparativo|misto\",
  \"comentario\": \"string\",
  \"blocks\": [
    {
      \"type\": \"paragraph|bullet_list|table|warning|tip|macete|jurisprudence|example|comparison|summary\",
      \"title\": \"string\",
      \"content\": \"string\",
      \"items\": [\"string\"],
      \"headers\": [\"string\"],
      \"rows\": [[\"string\"]],
      \"target\": {\"kind\": \"caput|paragraph|inciso|alinea|item|article\", \"label\": \"string\", \"blockId\": \"string\"}
    }
  ],
  \"exam_focus\": \"string\",
  \"keywords\": [\"string\"],
  \"avoid_repetition_note\": \"string\"
}

Retorne APENAS JSON valido.
");
    }

    private function buildPromptFieldMacete(array $context): string
    {
        $promptContext = $this->buildEditorialPromptContext($context);

        return trim("
Voce e um editor juridico especializado em concursos publicos.

Gere SOMENTE macetes para revisao de UM artigo de lei.

REGRAS:
- Retorne de 1 a 4 macetes quando houver varios blocos relevantes para prova.
- Se apenas um bloco for realmente relevante, retorne apenas um.
- Nao gere apenas mnemonico. Gere um comentario breve com o pulo do gato de prova.
- O macete deve ser uma ferramenta real de memorizacao e revisao para concurso.
- O macete e o pulo do gato: o detalhe que a banca costuma trocar, a palavra perigosa, a excecao ou a confusao mais comum.
- Explique o que a banca costuma cobrar/alterar/tentar confundir.
- PROIBIDO: siglas sem sentido, sequencia de iniciais, abreviacoes mecanicas e repeticao compactada do artigo.
- PROIBIDO: respostas no estilo \"FIS-PSI-SEX-PAT-MOR-VIC\".
- Se houver macete real:
  - \"macete\" deve ter no maximo 12 palavras
  - \"macete\" deve ser frase natural e memoravel, sem parecer codigo
  - \"comoLembrarNaProva\" deve ter 1 linha dizendo o que a banca costuma trocar, negar, restringir, ampliar ou confundir
- Se NAO houver macete realmente bom:
  - deixe \"macete\" e \"comoLembrarNaProva\" vazios
  - preencha \"chaveDeProva\" com o ponto mais cobrado ou a confusao mais comum da banca
- Nunca invente sigla para completar a interface.
- Cada item deve ter target com o bloco exato sustentando o macete: kind, label e blockId real da ESTRUTURA EM BLOCOS.
- Varra caput, paragrafos, incisos, alineas e itens. Escolha os blocos que realmente possuem ponto de prova; nao use sempre o caput por padrao.

CONTEXTO:
{$promptContext}

- Priorize o bloco que realmente e cobrado: caput para a regra central, inciso para a hipotese, alinea para o detalhe e paragrafo para a excecao ou complemento.

SAIDA:
{
  \"macete\": \"string\",
  \"comoLembrarNaProva\": \"string\",
  \"chaveDeProva\": \"string\",
  \"target\": {\"kind\": \"caput|paragraph|inciso|alinea|item|article\", \"label\": \"string\", \"blockId\": \"string\"},
  \"macetes\": [
    {
      \"macete\": \"string\",
      \"comoLembrarNaProva\": \"string\",
      \"chaveDeProva\": \"string\",
      \"target\": {\"kind\": \"caput|paragraph|inciso|alinea|item|article\", \"label\": \"string\", \"blockId\": \"string\"}
    }
  ]
}

Retorne APENAS JSON valido.
");
    }

    private function buildPromptStageB(array $context, bool $retry = false): string
    {
        $promptContext = $this->buildEditorialPromptContext($context);
        $retryRule = $retry
            ? "\nREFORCO DE SEGURANCA:\n- A tentativa anterior trouxe itens fracos ou suspeitos.\n- Seja ainda mais restritivo.\n- Se nao houver base segura e util para prova, retorne lista vazia."
            : '';

        return trim("
Voce e um editor juridico especializado em concursos publicos.

Sua tarefa e identificar doutrina realmente relevante para concursos sobre UM artigo de lei.

REGRAS:
- Nao invente autores, obras ou entendimentos.
- So inclua doutrina se houver entendimento doutrinario conhecido, seguro, pertinente e util para prova.
- Priorize doutrina majoritaria, classica ou frequentemente mencionada em concursos.
- Quantidade nao importa; relevancia importa.
- Nao preencher por obrigacao.
- Se nao houver base segura e utilidade pratica, retorne lista vazia.
- Cada item deve ter:
  - autor
  - entendimento
- O entendimento deve vir em 1 frase curta, objetiva e util para prova.
- Quando a doutrina estiver ligada a bloco especifico, preencha target com kind, label e blockId real informado na ESTRUTURA EM BLOCOS.
- Nao escreva prefixos como \"[Caput]\", \"[Paragrafo unico]\", \"[Inciso I]\" ou \"[Alinea a]\" no entendimento. A UI ja usa o target para posicionar a nota.
- Varra caput, paragrafos, incisos, alineas e itens e retorne doutrina apenas para os blocos em que houver entendimento realmente relevante.
- Nao resumir o artigo.
- Nao explicar a lei em abstrato.
- Nao usar linguagem vaga.
- Nao adicionar itens apenas porque cabem.{$retryRule}

CONTEXTO:
{$promptContext}

- Busque apenas doutrina majoritaria, classica ou recorrente que tenha relacao objetiva com o bloco do artigo que realmente importa.
- Se o artigo for seco e nao houver controversonia util, retorne lista vazia.

SAIDA:
{
  \"doutrina\": [
    {
      \"autor\": \"string\",
      \"entendimento\": \"string\",
      \"target\": {\"kind\": \"caput|paragraph|inciso|alinea|item|article\", \"label\": \"string\", \"blockId\": \"string\"}
    }
  ]
}

Retorne APENAS JSON valido.
");
    }

    private function buildPromptStageC(array $context): string
    {
        $promptContext = $this->buildEditorialPromptContext($context);

        return trim("
Voce e um editor juridico especializado em concursos publicos.

Sua tarefa e identificar jurisprudencia e sumulas realmente pertinentes e uteis para provas sobre UM artigo de lei.

REGRAS:
- Nao invente precedentes.
- Nao invente sumulas.
- A jurisprudencia deve estar diretamente relacionada ao conteudo deste artigo.
- Antes de incluir qualquer precedente, valide mentalmente: \"isso ajudaria a resolver uma questao cobrando exatamente este artigo?\".
- Nao incluir conteudo generico sobre a lei inteira se nao houver relacao concreta com o artigo.
- Nao trazer jurisprudencia de outro artigo da mesma lei, salvo se a conexao com este dispositivo estiver explicada de forma objetiva.
- Nao usar jurisprudencia famosa apenas por ser conhecida.
- So incluir o que for realmente pertinente, seguro e util para prova.
- Priorize entendimentos consolidados, famosos, reiterados ou recorrentes em concursos.
- Quantidade nao importa; relevancia importa.
- Se nao houver base segura e utilidade pratica sobre este artigo, retornar lista vazia em jurisprudencia.
- Jurisprudencia deve ter:
  - tribunal
  - processo
  - tese
- Sumula deve ter:
  - tribunal
  - numero
  - enunciado
- Jurisprudencia e sumula devem apontar o bloco exato do artigo em target: kind, label e blockId real informado na ESTRUTURA EM BLOCOS.
- Varra caput, paragrafos, incisos, alineas e itens e retorne apenas jurisprudencia/sumula que tenha relacao concreta com o bloco relevante.
- Se nao souber processo com seguranca, ainda assim so incluir se a tese for claramente segura, pertinente e recorrente; caso contrario, nao incluir.
- Nunca usar numero da lei como numero de sumula.
- Nao adicionar itens apenas para parecer completo.

CONTEXTO:
{$promptContext}

- Se o caput traz a regra e os incisos ou paragrafos trazem a excecao, a jurisprudencia ou a sumula deve ser ligada ao bloco exato que a banca costuma cobrar.
- Na tese de jurisprudencia e no enunciado da sumula, nao escreva prefixos como \"[Caput]\", \"[Paragrafo unico]\", \"[Inciso I]\" ou \"[Alinea a]\". O frontend posiciona a nota pelo target.
- Se nao houver relacao concreta com o bloco relevante, retorne lista vazia.

SAIDA:
{
  \"jurisprudencia\": [
    {
      \"tribunal\": \"string\",
      \"processo\": \"string\",
      \"tese\": \"string\",
      \"target\": {\"kind\": \"caput|paragraph|inciso|alinea|item|article\", \"label\": \"string\", \"blockId\": \"string\"}
    }
  ],
  \"sumulas\": [
    {
      \"tribunal\": \"string\",
      \"numero\": \"string\",
      \"enunciado\": \"string\",
      \"target\": {\"kind\": \"caput|paragraph|inciso|alinea|item|article\", \"label\": \"string\", \"blockId\": \"string\"}
    }
  ]
}

Retorne APENAS JSON valido.
");
    }

    private function buildPromptFieldJurisprudencia(array $context): string
    {
        $promptContext = $this->buildEditorialPromptContext($context);

        return trim("
Voce e um editor juridico especializado em concursos publicos.

Sua tarefa e identificar SOMENTE jurisprudencia realmente pertinente e util para provas sobre UM artigo de lei.

REGRAS:
- Nao invente precedentes.
- A jurisprudencia deve estar diretamente ligada ao conteudo normativo deste artigo.
- Antes de incluir, valide: \"isso ajudaria a resolver uma questao cobrando exatamente este artigo?\".
- Nao traga precedente de outro artigo da mesma lei sem explicar a conexao com este dispositivo.
- Nao use entendimento geral da lei apenas por ser famoso.
- So inclua o que for realmente pertinente, seguro e recorrente em concursos.
- Se nao houver base segura ou utilidade pratica, retorne lista vazia.
- Cada item deve ter tribunal, processo e tese.
- A tese deve ser curta, objetiva e diretamente vinculada ao artigo.
- Quando houver bloco especifico, preencha target com kind, label e blockId real do bloco usado.
- Nao escreva prefixos como \"[Caput]\", \"[Paragrafo unico]\", \"[Inciso I]\" ou \"[Alinea a]\" na tese. A UI ja usa o target para posicionar a nota.
- Varra caput, paragrafos, incisos, alineas e itens antes de decidir. Nao use sempre o caput por padrao.

CONTEXTO:
{$promptContext}

- Use o bloco do artigo que realmente concentra a cobranca, nao o texto inteiro como se fosse um unico bloco.

SAIDA:
{
  \"jurisprudencia\": [
    {
      \"tribunal\": \"string\",
      \"processo\": \"string\",
      \"tese\": \"string\",
      \"target\": {\"kind\": \"caput|paragraph|inciso|alinea|item|article\", \"label\": \"string\", \"blockId\": \"string\"}
    }
  ]
}

Retorne APENAS JSON valido.
");
    }

    private function buildPromptFieldSumulas(array $context): string
    {
        $promptContext = $this->buildEditorialPromptContext($context);

        return trim("
Voce e um editor juridico especializado em concursos publicos.

Sua tarefa e identificar SOMENTE sumulas reais, pertinentes e uteis para prova sobre UM artigo de lei.

REGRAS:
- Nao invente sumulas.
- Nunca use numero da lei como numero de sumula.
- So inclua sumulas reais e diretamente relacionadas ao artigo.
- Se nao houver sumula realmente pertinente, retorne lista vazia.
- Cada item deve ter tribunal, numero e enunciado.
- Quando houver bloco especifico, preencha target com kind, label e blockId real do bloco usado.
- Nao escreva prefixos como \"[Caput]\", \"[Paragrafo unico]\", \"[Inciso I]\" ou \"[Alinea a]\" no enunciado. A UI ja usa o target para posicionar a nota.
- Varra caput, paragrafos, incisos, alineas e itens antes de decidir. Nao use sempre o caput por padrao.

CONTEXTO:
{$promptContext}

- A sumula deve ser ligada ao ponto realmente cobrado no bloco relevante do artigo.

SAIDA:
{
  \"sumulas\": [
    {
      \"tribunal\": \"string\",
      \"numero\": \"string\",
      \"enunciado\": \"string\",
      \"target\": {\"kind\": \"caput|paragraph|inciso|alinea|item|article\", \"label\": \"string\", \"blockId\": \"string\"}
    }
  ]
}

Retorne APENAS JSON valido.
");
    }

    private function schemaSectionAnalysis(): array
    {
        return [
            'type' => 'OBJECT',
            'properties' => [
                'titulo' => ['type' => 'STRING'],
                'importance' => ['type' => 'STRING'],
                'style' => ['type' => 'STRING'],
                'summary' => ['type' => 'STRING'],
                'analiseContinuaHtml' => ['type' => 'STRING'],
                'resumoEstrategico' => ['type' => 'STRING'],
                'visaoGeralTabela' => [
                    'type' => 'ARRAY',
                    'items' => [
                        'type' => 'OBJECT',
                        'properties' => [
                            'unidade' => ['type' => 'STRING'],
                            'artigos' => ['type' => 'STRING'],
                            'importancia' => ['type' => 'STRING'],
                            'incidencia' => ['type' => 'STRING'],
                            'bancas' => ['type' => 'STRING'],
                            'perfilCobranca' => ['type' => 'STRING'],
                            'dificuldade' => ['type' => 'STRING'],
                            'pontosPerigosos' => ['type' => 'STRING'],
                            'prioridade' => ['type' => 'STRING'],
                        ],
                    ],
                ],
                'panoramaGeral' => ['type' => 'STRING'],
                'analisePorDispositivo' => [
                    'type' => 'ARRAY',
                    'items' => [
                        'type' => 'OBJECT',
                        'properties' => [
                            'dispositivo' => ['type' => 'STRING'],
                            'nucleo' => ['type' => 'STRING'],
                            'explicacaoProva' => ['type' => 'STRING'],
                            'interpretacaoJuridica' => ['type' => 'STRING'],
                            'finalidade' => ['type' => 'STRING'],
                            'comoBancaCobra' => ['type' => 'STRING'],
                            'pegadinha' => ['type' => 'STRING'],
                            'palavrasChave' => ['type' => 'STRING'],
                            'erroComum' => ['type' => 'STRING'],
                            'assertivaExemplo' => ['type' => 'STRING'],
                            'comentarioEstrategico' => ['type' => 'STRING'],
                        ],
                    ],
                ],
                'comoCaiEmProva' => [
                    'type' => 'ARRAY',
                    'items' => [
                        'type' => 'OBJECT',
                        'properties' => [
                            'tipo' => ['type' => 'STRING'],
                            'cobranca' => ['type' => 'STRING'],
                            'atencao' => ['type' => 'STRING'],
                        ],
                    ],
                ],
                'perfilPorBanca' => [
                    'type' => 'ARRAY',
                    'items' => [
                        'type' => 'OBJECT',
                        'properties' => [
                            'banca' => ['type' => 'STRING'],
                            'estilo' => ['type' => 'STRING'],
                            'profundidade' => ['type' => 'STRING'],
                            'exemplo' => ['type' => 'STRING'],
                            'riscoPegadinha' => ['type' => 'STRING'],
                        ],
                    ],
                ],
                'incidenciaEstimativa' => [
                    'type' => 'ARRAY',
                    'items' => [
                        'type' => 'OBJECT',
                        'properties' => [
                            'tema' => ['type' => 'STRING'],
                            'relevancia' => ['type' => 'STRING'],
                            'incidenciaEstimada' => ['type' => 'STRING'],
                            'justificativa' => ['type' => 'STRING'],
                            'prioridade' => ['type' => 'STRING'],
                        ],
                    ],
                ],
                'pegadinhas' => [
                    'type' => 'ARRAY',
                    'items' => [
                        'type' => 'OBJECT',
                        'properties' => [
                            'pegadinha' => ['type' => 'STRING'],
                            'porQueErrada' => ['type' => 'STRING'],
                            'comoMemorizar' => ['type' => 'STRING'],
                        ],
                    ],
                ],
                'jurisprudencia' => ['type' => 'STRING'],
                'termosChave' => [
                    'type' => 'ARRAY',
                    'items' => [
                        'type' => 'OBJECT',
                        'properties' => [
                            'termo' => ['type' => 'STRING'],
                            'motivo' => ['type' => 'STRING'],
                            'risco' => ['type' => 'STRING'],
                        ],
                    ],
                ],
                'mapaMental' => ['type' => 'STRING'],
                'questoesSimuladas' => [
                    'type' => 'ARRAY',
                    'items' => [
                        'type' => 'OBJECT',
                        'properties' => [
                            'tipo' => ['type' => 'STRING'],
                            'enunciado' => ['type' => 'STRING'],
                            'alternativas' => [
                                'type' => 'ARRAY',
                                'items' => ['type' => 'STRING'],
                            ],
                            'gabarito' => ['type' => 'STRING'],
                            'comentario' => ['type' => 'STRING'],
                        ],
                    ],
                ],
                'checklistRevisao' => [
                    'type' => 'ARRAY',
                    'items' => [
                        'type' => 'OBJECT',
                        'properties' => [
                            'categoria' => ['type' => 'STRING'],
                            'item' => ['type' => 'STRING'],
                        ],
                    ],
                ],
                'blocks' => $this->schemaRichBlocks(),
                'examFocus' => [
                    'type' => 'ARRAY',
                    'items' => ['type' => 'STRING'],
                ],
                'exam_focus' => ['type' => 'STRING'],
                'keywords' => [
                    'type' => 'ARRAY',
                    'items' => ['type' => 'STRING'],
                ],
                'avoid_repetition_note' => ['type' => 'STRING'],
                'macetes' => [
                    'type' => 'ARRAY',
                    'items' => [
                        'type' => 'OBJECT',
                        'properties' => [
                            'nome' => ['type' => 'STRING'],
                            'aplicacao' => ['type' => 'STRING'],
                            'ajudaLembrar' => ['type' => 'STRING'],
                            'limite' => ['type' => 'STRING'],
                        ],
                    ],
                ],
                'doctrine' => [
                    'type' => 'ARRAY',
                    'items' => ['type' => 'STRING'],
                ],
                'highlights' => [
                    'type' => 'ARRAY',
                    'items' => [
                        'type' => 'OBJECT',
                        'properties' => [
                            'articleNumber' => ['type' => 'STRING'],
                            'title' => ['type' => 'STRING'],
                            'excerpt' => ['type' => 'STRING'],
                        ],
                        'required' => ['articleNumber', 'title', 'excerpt'],
                    ],
                ],
            ],
            'required' => ['importance', 'style', 'summary', 'analiseContinuaHtml', 'blocks', 'examFocus', 'keywords', 'macetes', 'doctrine', 'highlights'],
        ];
    }

    private function schemaStageA(): array
    {
        return [
            'type' => 'OBJECT',
            'properties' => [
                'importance' => ['type' => 'STRING'],
                'style' => ['type' => 'STRING'],
                'comentario' => ['type' => 'STRING'],
                'blocks' => $this->schemaRichBlocks(),
                'exam_focus' => ['type' => 'STRING'],
                'keywords' => [
                    'type' => 'ARRAY',
                    'items' => ['type' => 'STRING'],
                ],
                'avoid_repetition_note' => ['type' => 'STRING'],
                'macete' => ['type' => 'STRING'],
                'comoLembrarNaProva' => ['type' => 'STRING'],
                'chaveDeProva' => ['type' => 'STRING'],
                'target' => $this->schemaRichTarget(),
                'macetes' => $this->schemaMaceteItems(),
            ],
            'required' => ['importance', 'style', 'comentario', 'blocks', 'keywords', 'macete', 'comoLembrarNaProva', 'chaveDeProva', 'target'],
        ];
    }

    private function schemaFieldComment(): array
    {
        return [
            'type' => 'OBJECT',
            'properties' => [
                'importance' => ['type' => 'STRING'],
                'style' => ['type' => 'STRING'],
                'comentario' => ['type' => 'STRING'],
                'blocks' => $this->schemaRichBlocks(),
                'exam_focus' => ['type' => 'STRING'],
                'keywords' => [
                    'type' => 'ARRAY',
                    'items' => ['type' => 'STRING'],
                ],
                'avoid_repetition_note' => ['type' => 'STRING'],
            ],
            'required' => ['importance', 'style', 'comentario', 'blocks', 'keywords'],
        ];
    }

    private function schemaRichTarget(): array
    {
        return [
            'type' => 'OBJECT',
            'properties' => [
                'kind' => ['type' => 'STRING'],
                'label' => ['type' => 'STRING'],
                'blockId' => ['type' => 'STRING'],
            ],
            'required' => ['kind', 'label', 'blockId'],
        ];
    }

    private function schemaRichBlocks(): array
    {
        return [
            'type' => 'ARRAY',
            'items' => [
                'type' => 'OBJECT',
                'properties' => [
                    'type' => ['type' => 'STRING'],
                    'title' => ['type' => 'STRING'],
                    'content' => ['type' => 'STRING'],
                    'items' => [
                        'type' => 'ARRAY',
                        'items' => ['type' => 'STRING'],
                    ],
                    'headers' => [
                        'type' => 'ARRAY',
                        'items' => ['type' => 'STRING'],
                    ],
                    'rows' => [
                        'type' => 'ARRAY',
                        'items' => [
                            'type' => 'ARRAY',
                            'items' => ['type' => 'STRING'],
                        ],
                    ],
                    'target' => $this->schemaRichTarget(),
                ],
                'required' => ['type', 'title'],
            ],
        ];
    }

    private function schemaFieldMacete(): array
    {
        return [
            'type' => 'OBJECT',
            'properties' => [
                'macete' => ['type' => 'STRING'],
                'comoLembrarNaProva' => ['type' => 'STRING'],
                'chaveDeProva' => ['type' => 'STRING'],
                'target' => $this->schemaRichTarget(),
                'macetes' => $this->schemaMaceteItems(),
            ],
            'required' => ['macete', 'comoLembrarNaProva', 'chaveDeProva', 'target'],
        ];
    }

    private function schemaMaceteItems(): array
    {
        return [
            'type' => 'ARRAY',
            'items' => [
                'type' => 'OBJECT',
                'properties' => [
                    'macete' => ['type' => 'STRING'],
                    'comoLembrarNaProva' => ['type' => 'STRING'],
                    'chaveDeProva' => ['type' => 'STRING'],
                    'target' => $this->schemaRichTarget(),
                ],
                'required' => ['macete', 'comoLembrarNaProva', 'chaveDeProva', 'target'],
            ],
        ];
    }

    private function buildMaceteFromResponse(array $response): string
    {
        return $this->validator->buildMaceteBody(
            (string) ($response['macete'] ?? ''),
            (string) ($response['comoLembrarNaProva'] ?? ''),
            (string) ($response['chaveDeProva'] ?? '')
        );
    }

    private function buildBestMaceteFromResponse(array $response, array $context, string $comment): string
    {
        $primary = $this->buildMaceteFromResponse($response);
        if ($this->validator->isValidMacete($primary, $context['articleText'], $comment)) {
            return $primary;
        }

        $keyPointFallback = $this->validator->buildMaceteBody('', '', (string) ($response['chaveDeProva'] ?? ''));
        if ($this->validator->isValidMacete($keyPointFallback, $context['articleText'], $comment)) {
            return $keyPointFallback;
        }

        return $primary;
    }

    private function buildMaceteTipEntriesFromResponse(array $response, array $context, string $comment): array
    {
        $sources = [];
        if (is_array($response['macetes'] ?? null)) {
            foreach ($response['macetes'] as $item) {
                if (is_array($item)) {
                    $sources[] = $item;
                }
            }
        }
        $sources[] = $response;

        $entries = [];
        $seen = [];
        $requestedTarget = is_array($context['requestedTarget'] ?? null) ? $context['requestedTarget'] : [];
        foreach ($sources as $item) {
            $body = $this->buildBestMaceteFromResponse($item, $context, $comment);
            if (!$this->validator->isValidMacete($body, $context['articleText'], $comment)) {
                continue;
            }

            $target = !empty($requestedTarget)
                ? $requestedTarget
                : $this->normalizeGeneratedTarget($item['target'] ?? [], $context, $body);
            $targetKey = $this->editorialTargetKey($target);
            $signature = $targetKey !== '' ? $targetKey : $this->normalizeTargetText($body);
            if ($signature !== '' && isset($seen[$signature])) {
                continue;
            }
            if ($signature !== '') {
                $seen[$signature] = true;
            }

            $entries[] = [
                'id' => '',
                'articleId' => (string) ($context['articleId'] ?: ($context['article']['id'] ?? '')),
                'title' => $targetKey !== ''
                    ? 'Macete - ' . $this->targetReferenceLabel($target)
                    : 'Macete para prova',
                'body' => $body,
                'tags' => [],
                'target' => $target,
            ];

            if (count($entries) >= 4) {
                break;
            }
        }

        return $entries;
    }

    private function editorialTargetKey(array $target): string
    {
        $target = $this->normalizeRichBlockTarget($target);
        $blockId = trim((string) ($target['blockId'] ?? ''));
        if ($blockId !== '') {
            return 'block:' . $blockId;
        }

        $kind = trim((string) ($target['kind'] ?? ''));
        $label = $this->normalizeTargetText((string) ($target['label'] ?? ''));
        return ($kind !== '' || $label !== '') ? $kind . ':' . $label : '';
    }

    private function mergeTeacherCommentItems(array $existing, array $generated): array
    {
        return $this->mergeEditorialItemsByTarget($existing, $generated, true);
    }

    private function mergeExamTipItems(array $existing, array $generated): array
    {
        return $this->mergeEditorialItemsByTarget($existing, $generated, false);
    }

    private function mergeEditorialItemsByTarget(array $existing, array $generated, bool $targetsInsideBlocks): array
    {
        if (empty($generated)) {
            return array_values($existing);
        }

        $next = array_values(array_filter($existing, 'is_array'));
        foreach ($generated as $item) {
            if (!is_array($item)) {
                continue;
            }

            $targetKey = $this->editorialTargetKey($this->extractEditorialItemTarget($item, $targetsInsideBlocks));
            $id = trim((string) ($item['id'] ?? ''));
            $body = $this->normalizeTargetText((string) ($item['body'] ?? $item['texto'] ?? $item['text'] ?? ''));
            $replaceIndex = null;

            foreach ($next as $index => $existingItem) {
                $existingId = trim((string) ($existingItem['id'] ?? ''));
                if ($id !== '' && $existingId !== '' && $id === $existingId) {
                    $replaceIndex = $index;
                    break;
                }

                $existingTargetKey = $this->editorialTargetKey($this->extractEditorialItemTarget($existingItem, $targetsInsideBlocks));
                if ($targetKey !== '' && $existingTargetKey === $targetKey) {
                    $replaceIndex = $index;
                    break;
                }

                if ($targetKey === '' && $existingTargetKey === '' && $body !== '') {
                    $existingBody = $this->normalizeTargetText((string) ($existingItem['body'] ?? $existingItem['texto'] ?? $existingItem['text'] ?? ''));
                    if ($existingBody === $body) {
                        $replaceIndex = $index;
                        break;
                    }
                }
            }

            if ($replaceIndex === null) {
                $next[] = $item;
            } else {
                $next[$replaceIndex] = $item;
            }
        }

        return array_values($next);
    }

    private function extractEditorialItemTarget(array $item, bool $targetsInsideBlocks): array
    {
        if (!$targetsInsideBlocks) {
            return is_array($item['target'] ?? null) ? $item['target'] : [];
        }

        foreach (['richBlocks', 'blocks'] as $key) {
            foreach (is_array($item[$key] ?? null) ? $item[$key] : [] as $block) {
                if (is_array($block['target'] ?? null)) {
                    return $block['target'];
                }
            }
        }

        return [];
    }

    private function schemaStageB(): array
    {
        return [
            'type' => 'OBJECT',
            'properties' => [
                'doutrina' => [
                    'type' => 'ARRAY',
                    'items' => [
                        'type' => 'OBJECT',
                        'properties' => [
                            'autor' => ['type' => 'STRING'],
                            'entendimento' => ['type' => 'STRING'],
                            'target' => $this->schemaRichTarget(),
                        ],
                        'required' => ['autor', 'entendimento', 'target'],
                    ],
                ],
            ],
            'required' => ['doutrina'],
        ];
    }

    private function schemaStageC(): array
    {
        return [
            'type' => 'OBJECT',
            'properties' => [
                'jurisprudencia' => [
                    'type' => 'ARRAY',
                    'items' => [
                        'type' => 'OBJECT',
                        'properties' => [
                            'tribunal' => ['type' => 'STRING'],
                            'processo' => ['type' => 'STRING'],
                            'tese' => ['type' => 'STRING'],
                            'target' => $this->schemaRichTarget(),
                        ],
                        'required' => ['tribunal', 'processo', 'tese', 'target'],
                    ],
                ],
                'sumulas' => [
                    'type' => 'ARRAY',
                    'items' => [
                        'type' => 'OBJECT',
                        'properties' => [
                            'tribunal' => ['type' => 'STRING'],
                            'numero' => ['type' => 'STRING'],
                            'enunciado' => ['type' => 'STRING'],
                            'target' => $this->schemaRichTarget(),
                        ],
                        'required' => ['tribunal', 'numero', 'enunciado', 'target'],
                    ],
                ],
            ],
            'required' => ['jurisprudencia', 'sumulas'],
        ];
    }

    private function schemaFieldJurisprudencia(): array
    {
        return [
            'type' => 'OBJECT',
            'properties' => [
                'jurisprudencia' => [
                    'type' => 'ARRAY',
                    'items' => [
                        'type' => 'OBJECT',
                        'properties' => [
                            'tribunal' => ['type' => 'STRING'],
                            'processo' => ['type' => 'STRING'],
                            'tese' => ['type' => 'STRING'],
                            'target' => $this->schemaRichTarget(),
                        ],
                        'required' => ['tribunal', 'processo', 'tese', 'target'],
                    ],
                ],
            ],
            'required' => ['jurisprudencia'],
        ];
    }

    private function schemaFieldSumulas(): array
    {
        return [
            'type' => 'OBJECT',
            'properties' => [
                'sumulas' => [
                    'type' => 'ARRAY',
                    'items' => [
                        'type' => 'OBJECT',
                        'properties' => [
                            'tribunal' => ['type' => 'STRING'],
                            'numero' => ['type' => 'STRING'],
                            'enunciado' => ['type' => 'STRING'],
                            'target' => $this->schemaRichTarget(),
                        ],
                        'required' => ['tribunal', 'numero', 'enunciado', 'target'],
                    ],
                ],
            ],
            'required' => ['sumulas'],
        ];
    }
}
