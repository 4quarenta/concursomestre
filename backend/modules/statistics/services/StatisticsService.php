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

require_once __DIR__ . '/../../../shared/observability/RuntimeMutationEvidence.php';

/**
 * Service oficial do dominio de estatisticas.
 * Orquestra autorizacao de benefcio, agregacao do raio-x e scraping seguro.
 *
 * @since 1.0.0
 */
class StatisticsService
{
    /**
     * Reune repositorio, validador e conexao usados pelo raio-x, scraping e agregados admin.
     *
     * @since 1.0.0
     */
    public function __construct(
        private readonly StatisticsRepository $repository,
        private readonly StatisticsValidator $validator,
        private readonly PDO $db
    ) {
    }

    /**
     * Gera o raio-x consolidado da banca com base nos filtros escolhidos.
     *
     * @since 1.0.0
     */
    public function getXrayStats(string $authenticatedUserId, array $query): array
    {
        $filters = $this->validator->validateXrayQuery($query);
        $this->assertXrayAccess($authenticatedUserId);

        $bancaFilterId = $this->repository->findFilterIdByTypeAndName('banca', $filters['banca']);
        if ($bancaFilterId === null) {
            return $this->buildEmptyXrayResponse();
        }

        $cargoFilterId = $filters['cargo'] !== null
            ? $this->repository->findFilterIdByTypeAndName('cargo', $filters['cargo'])
            : null;
        $anoFilterId = $filters['ano'] !== null
            ? $this->repository->findFilterIdByTypeAndName('ano', $filters['ano'])
            : null;

        $questions = $this->repository->listQuestionsForXray(
            $bancaFilterId,
            $cargoFilterId,
            $anoFilterId
        );

        if ($questions === []) {
            return $this->buildEmptyXrayResponse();
        }

        $questionIds = array_map(
            static fn(array $row): int => (int) ($row['id'] ?? 0),
            $questions
        );

        $subjectFilters = $this->repository->listSubjectFiltersForQuestions($questionIds);
        $breakdown = $this->buildSubjectBreakdown($questionIds, $subjectFilters);
        $examList = $this->mapExamList($this->repository->listExamsByBancaId($bancaFilterId));

        return [
            'total' => count($questions),
            'textStyle' => $this->resolveTextStyle($questions),
            'contextUsage' => $this->calculateContextUsage($questions),
            'difficultyData' => $this->buildDifficultyData($questions),
            'subjectData' => $breakdown['subjectData'],
            'detailedBreakdown' => $breakdown['detailedBreakdown'],
            'examList' => $examList,
            'recommendation' => $this->buildRecommendation(
                $filters['banca'],
                $filters['cargo'],
                $breakdown['detailedBreakdown']
            ),
        ];
    }

    /**
     * Coleta links relevantes no site da banca para concursos em andamento e passados.
     *
     * @since 1.0.0
     */
    public function getBancaInfo(string $authenticatedUserId, array $query): array
    {
        $normalized = $this->validator->validateBancaInfoQuery($query);
        $this->assertXrayAccess($authenticatedUserId);

        return $this->scrapeBancaInfo($normalized['url'], $normalized['baseUrl'], $normalized['host']);
    }

    /**
     * Retorna o agregado persistido do usuario ou uma visao neutra sem persistir.
     *
     * @since 1.0.0
     */
    public function getUserStatistics(array $authenticatedUserPayload, array $query): array
    {
        $requestedUserId = $this->validator->validateUserStatisticsQuery($query);
        $targetUserId = $this->validator->resolveScopedUserId($authenticatedUserPayload, $requestedUserId);

        $row = $this->repository->findUserStatisticsByUserId($targetUserId) ?? [
            'user_id' => $targetUserId,
            'total_questions_answered' => 0,
            'correct_answers' => 0,
            'wrong_answers' => 0,
            'accuracy_rate' => 0.0,
            'current_streak' => 0,
            'best_streak' => 0,
            'total_study_time' => 0,
            'question_study_time' => 0,
            'reading_study_time' => 0,
            'last_activity' => '',
        ];

        $subjectBreakdown = array_map(static function (array $subjectRow): array {
            return [
                'subject' => (string) ($subjectRow['subject'] ?? ''),
                'totalQuestions' => (int) ($subjectRow['total_questions'] ?? 0),
                'correctAnswers' => (int) ($subjectRow['correct_answers'] ?? 0),
                'wrongAnswers' => (int) ($subjectRow['wrong_answers'] ?? 0),
                'accuracyRate' => (float) ($subjectRow['accuracy_rate'] ?? 0),
                'averageTime' => (int) ($subjectRow['average_time'] ?? 0),
            ];
        }, $this->repository->listSubjectStatisticsByUserId($targetUserId));

        return [
            'userId' => (string) ($row['user_id'] ?? $targetUserId),
            'totalQuestionsAnswered' => (int) ($row['total_questions_answered'] ?? 0),
            'correctAnswers' => (int) ($row['correct_answers'] ?? 0),
            'wrongAnswers' => (int) ($row['wrong_answers'] ?? 0),
            'accuracyRate' => (float) ($row['accuracy_rate'] ?? 0),
            'currentStreak' => (int) ($row['current_streak'] ?? 0),
            'bestStreak' => (int) ($row['best_streak'] ?? 0),
            'questionStudyTime' => (int) ($row['question_study_time'] ?? 0),
            'readingStudyTime' => (int) ($row['reading_study_time'] ?? 0),
            'totalStudyTime' => (int) ($row['total_study_time'] ?? 0),
            'lastActivity' => (string) ($row['last_activity'] ?? ''),
            'subjectBreakdown' => $subjectBreakdown,
        ];
    }

    /**
     * Registra uma sessao de estudo auditavel e atualiza o agregado do usuario.
     *
     * @since 1.0.0
     */
    public function recordStudySession(array $authenticatedUserPayload, array $payload): array
    {
        $authenticatedUserId = trim((string) ($authenticatedUserPayload['user_id'] ?? ''));
        if ($authenticatedUserId === '') {
            throw new RuntimeException('Sessao invalida. Faca login novamente.');
        }

        $normalizedPayload = $this->validator->validateStudySessionPayload($payload);
        $this->repository->ensureStudyTimeSchema();

        $studySessionId = 'study-' . uniqid('', true) . '-' . time();
        $sourceContext = $normalizedPayload['source_context'] !== []
            ? json_encode($normalizedPayload['source_context'], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES)
            : null;

        $this->db->beginTransaction();

        try {
            $this->repository->createStudySession([
                'id' => $studySessionId,
                'user_id' => $authenticatedUserId,
                'practice_study_time' => $normalizedPayload['practice_seconds'],
                'simulation_study_time' => $normalizedPayload['simulation_seconds'],
                'reading_study_time' => $normalizedPayload['reading_seconds'],
                'question_study_time' => $normalizedPayload['question_seconds'],
                'total_study_time' => $normalizedPayload['total_seconds'],
                'started_at' => $normalizedPayload['started_at'],
                'ended_at' => $normalizedPayload['ended_at'],
                'source_context' => $sourceContext,
            ]);

            $statisticsRowDelta = $this->repository->incrementUserStudyTimeTotals(
                $authenticatedUserId,
                (int) $normalizedPayload['question_seconds'],
                (int) $normalizedPayload['reading_seconds'],
                (string) $normalizedPayload['ended_at']
            );

            $this->db->commit();
            RuntimeMutationEvidence::record(
                'user_statistics',
                'UPSERT',
                'http-practice-user-activity',
                'statistics_study_session_recorded',
                $statisticsRowDelta
            );
        } catch (Throwable $exception) {
            if ($this->db->inTransaction()) {
                $this->db->rollBack();
            }

            throw $exception;
        }

        return [
            'sessionId' => $studySessionId,
            'questionStudyTime' => (int) $normalizedPayload['question_seconds'],
            'readingStudyTime' => (int) $normalizedPayload['reading_seconds'],
            'totalStudyTime' => (int) $normalizedPayload['total_seconds'],
            'statistics' => $this->getUserStatistics($authenticatedUserPayload, [
                'user_id' => $authenticatedUserId,
            ]),
        ];
    }

    /**
     * Retorna o agregado pblico de uma questo.
     *
     * @since 1.0.0
     */
    public function getQuestionStatistics(array $query): array
    {
        $questionId = $this->validator->validateQuestionStatisticsQuery($query);
        $row = $this->repository->findQuestionStatisticsByQuestionId($questionId) ?? [
            'question_id' => $questionId,
            'total_attempts' => 0,
            'correct_count' => 0,
            'wrong_count' => 0,
            'option_distribution' => null,
            'average_time_spent' => 0,
            'difficulty_rating' => 0.0,
        ];

        $totalAttempts = (int) ($row['total_attempts'] ?? 0);
        $correctCount = (int) ($row['correct_count'] ?? 0);
        $accuracyRate = $totalAttempts > 0 ? ($correctCount / $totalAttempts) * 100 : 0.0;

        $optionDistribution = [];
        $rawDistribution = $row['option_distribution'] ?? null;
        if (is_string($rawDistribution) && trim($rawDistribution) !== '') {
            $decoded = json_decode($rawDistribution, true);
            if (is_array($decoded)) {
                $optionDistribution = $decoded;
            }
        }

        return [
            'questionId' => (int) ($row['question_id'] ?? $questionId),
            'totalAttempts' => $totalAttempts,
            'correctCount' => $correctCount,
            'wrongCount' => (int) ($row['wrong_count'] ?? 0),
            'accuracyRate' => round($accuracyRate, 2),
            'averageTimeSpent' => (int) ($row['average_time_spent'] ?? 0),
            'difficultyRating' => (float) ($row['difficulty_rating'] ?? 0),
            'optionDistribution' => $optionDistribution,
        ];
    }

    /**
     * Retorna indicadores consolidados da plataforma para o contexto admin.
     *
     * @since 1.0.0
     */
    public function getPlatformStatistics(array $authenticatedUserPayload): array
    {
        $this->validator->assertAdminContext($authenticatedUserPayload);

        $popularSubjects = array_map(static function (array $row): array {
            return [
                'subject' => (string) ($row['subject'] ?? ''),
                'questionCount' => (int) ($row['question_count'] ?? 0),
                'attemptCount' => (int) ($row['attempt_count'] ?? 0),
            ];
        }, $this->repository->listPopularSubjects());

        $topPerformers = array_map(static function (array $row): array {
            return [
                'userId' => (string) ($row['user_id'] ?? ''),
                'userName' => (string) ($row['user_name'] ?? 'Usurio'),
                'score' => (int) ($row['score'] ?? 0),
                'accuracy' => (float) ($row['accuracy'] ?? 0),
            ];
        }, $this->repository->listTopPerformers());

        return [
            'totalUsers' => $this->repository->countTotalUsers(),
            'activeUsers' => $this->repository->countActiveUsersLast30Days(),
            'totalQuestions' => $this->repository->countTotalQuestions(),
            'totalAnswers' => $this->repository->sumTotalAnswers(),
            'averageAccuracy' => round($this->repository->getAverageAccuracy(), 2),
            'popularSubjects' => $popularSubjects,
            'topPerformers' => $topPerformers,
        ];
    }

    /**
     * Executa a garantia das tabelas estatisticas em contexto administrativo.
     *
     * @since 1.0.0
     */
    public function installStatistics(array $authenticatedUserPayload): array
    {
        $this->validator->assertAdminContext($authenticatedUserPayload);

        $steps = [];
        $steps[] = 'Starting statistics tables installation...';

        $this->repository->ensureStudyTimeSchema();
        $steps[] = "Table 'user_statistics' checked/created.";
        $steps[] = "Table 'study_sessions' checked/created.";

        $this->repository->ensureSubjectStatisticsTable();
        $steps[] = "Table 'subject_statistics' checked/created.";

        if ($this->repository->ensureQuestionStatsEnhancements()) {
            $steps[] = "Enhanced 'question_stats' table with additional columns.";
        } else {
            $steps[] = "Table 'question_stats' already has required columns.";
        }

        return [
            'steps' => $steps,
        ];
    }

    /**
     * Garante que o usurio tenha direito ao raio-x da banca.
     *
     * @since 1.0.0
     */
    private function assertXrayAccess(string $authenticatedUserId): void
    {
        if (!userHasPlanBenefit($this->db, $authenticatedUserId, 'xray_banca')) {
            throw new DomainException('Seu plano atual no possui acesso ao Raio-X da banca.');
        }
    }

    /**
     * Mantem o contrato antigo quando no ha dados para a banca selecionada.
     *
     * @since 1.0.0
     */
    private function buildEmptyXrayResponse(): array
    {
        return [
            'total' => 0,
            'textStyle' => 'Objetiva e Direta',
            'contextUsage' => 0,
            'difficultyData' => [],
            'subjectData' => [],
            'detailedBreakdown' => [],
            'examList' => [],
            'recommendation' => 'Para obter uma recomendacao estrategica personalizada, continue seus estudos focando nos topicos de maior incidencia apresentados acima.',
        ];
    }

    /**
     * Resolve o estilo medio de prova com base no tamanho do enunciado.
     *
     * @since 1.0.0
     */
    private function resolveTextStyle(array $questions): string
    {
        $totalTextLength = 0;
        foreach ($questions as $question) {
            $totalTextLength += mb_strlen((string) ($question['enunciado_clean'] ?? ''), 'UTF-8');
        }

        $averageLength = (int) round($totalTextLength / max(count($questions), 1));
        if ($averageLength > 300) {
            return 'Textos Longos e Complexos';
        }

        if ($averageLength > 100) {
            return 'Tamanho Medio';
        }

        return 'Objetiva e Direta';
    }

    /**
     * Calcula quantas questes possuem texto introdutorio relevante.
     *
     * @since 1.0.0
     */
    private function calculateContextUsage(array $questions): int
    {
        $count = 0;
        foreach ($questions as $question) {
            if (trim((string) ($question['intro_text'] ?? '')) !== '') {
                $count++;
            }
        }

        return (int) round(($count / max(count($questions), 1)) * 100);
    }

    /**
     * Converte a distribuicao de dificuldade para o formato do frontend.
     *
     * @since 1.0.0
     */
    private function buildDifficultyData(array $questions): array
    {
        $map = [
            '1' => 'Facil',
            '2' => 'Medio',
            '3' => 'Dificil',
        ];

        $countByDifficulty = [
            '1' => 0,
            '2' => 0,
            '3' => 0,
        ];

        foreach ($questions as $question) {
            $difficulty = (string) (int) ($question['dificuldade'] ?? 0);
            if (!array_key_exists($difficulty, $countByDifficulty)) {
                $countByDifficulty[$difficulty] = 0;
            }
            $countByDifficulty[$difficulty]++;
        }

        $result = [];
        foreach ($countByDifficulty as $difficulty => $count) {
            if ($count <= 0) {
                continue;
            }

            $result[] = [
                'name' => $map[$difficulty] ?? 'Desconhecido',
                'value' => $count,
            ];
        }

        return $result;
    }

    /**
     * Organiza materias e assuntos no formato usado pelos graficos detalhados.
     *
     * @since 1.0.0
     */
    private function buildSubjectBreakdown(array $questionIds, array $subjectFilters): array
    {
        $filtersByQuestion = [];
        $parentIds = [];

        foreach ($subjectFilters as $row) {
            $questionId = (int) ($row['question_id'] ?? 0);
            if ($questionId <= 0) {
                continue;
            }

            $filtersByQuestion[$questionId][] = $row;

            $parentId = (int) ($row['parent_id'] ?? 0);
            if ($parentId > 0) {
                $parentIds[] = $parentId;
            }
        }

        $parentNames = $this->repository->listFilterNamesByIds($parentIds);
        $subjectDetails = [];

        foreach ($questionIds as $questionId) {
            $filters = $filtersByQuestion[$questionId] ?? [];
            $roots = [];
            $topics = [];

            foreach ($filters as $filter) {
                if ((int) ($filter['meta_materia'] ?? 0) === 1) {
                    $roots[] = $filter;
                    continue;
                }

                $topics[] = $filter;
            }

            if ($roots === []) {
                $rootName = 'Assuntos Gerais';
                if ($topics !== []) {
                    $firstParentId = (int) ($topics[0]['parent_id'] ?? 0);
                    if ($firstParentId > 0 && isset($parentNames[$firstParentId])) {
                        $rootName = $parentNames[$firstParentId];
                    }
                }

                $this->appendSubjectOccurrence($subjectDetails, $rootName, $topics[0]['name'] ?? 'Geral');
                continue;
            }

            foreach ($roots as $root) {
                $topicName = 'Geral';
                foreach ($topics as $topic) {
                    $topicName = (string) ($topic['name'] ?? 'Geral');
                    break;
                }

                $this->appendSubjectOccurrence(
                    $subjectDetails,
                    (string) ($root['name'] ?? 'Assuntos Gerais'),
                    $topicName
                );
            }
        }

        return $this->normalizeSubjectDetails($subjectDetails, count($questionIds));
    }

    /**
     * Soma a incidencia de um assunto dentro da materia correspondente.
     *
     * @since 1.0.0
     */
    private function appendSubjectOccurrence(array &$subjectDetails, string $subjectName, string $topicName): void
    {
        if (!isset($subjectDetails[$subjectName])) {
            $subjectDetails[$subjectName] = [
                'total' => 0,
                'topics' => [],
            ];
        }

        $subjectDetails[$subjectName]['total']++;

        if (!isset($subjectDetails[$subjectName]['topics'][$topicName])) {
            $subjectDetails[$subjectName]['topics'][$topicName] = 0;
        }

        $subjectDetails[$subjectName]['topics'][$topicName]++;
    }

    /**
     * Transforma a estrutura agregada no shape esperado pelo app.
     *
     * @since 1.0.0
     */
    private function normalizeSubjectDetails(array $subjectDetails, int $totalQuestions): array
    {
        $subjectData = [];
        $detailedBreakdown = [];

        foreach ($subjectDetails as $subjectName => $data) {
            $subjectTotal = (int) ($data['total'] ?? 0);
            if ($subjectTotal <= 0) {
                continue;
            }

            $subjectData[] = [
                'name' => $subjectName,
                'value' => $subjectTotal,
            ];

            $topics = [];
            foreach (($data['topics'] ?? []) as $topicName => $count) {
                $topicCount = (int) $count;
                $topics[] = [
                    'topic' => $topicName,
                    'count' => $topicCount,
                    'percent' => round(($topicCount / max($subjectTotal, 1)) * 100, 1),
                ];
            }

            usort($topics, static fn(array $left, array $right): int => $right['count'] <=> $left['count']);

            $detailedBreakdown[] = [
                'subject' => $subjectName,
                'total' => $subjectTotal,
                'percent' => round(($subjectTotal / max($totalQuestions, 1)) * 100, 1),
                'topics' => $topics,
            ];
        }

        usort($subjectData, static fn(array $left, array $right): int => $right['value'] <=> $left['value']);
        usort($detailedBreakdown, static fn(array $left, array $right): int => $right['total'] <=> $left['total']);

        return [
            'subjectData' => array_slice($subjectData, 0, 5),
            'detailedBreakdown' => $detailedBreakdown,
        ];
    }

    /**
     * Adapta o histrico de provas para o contrato atual do frontend.
     *
     * @since 1.0.0
     */
    private function mapExamList(array $rows): array
    {
        return array_map(static function (array $row): array {
            return [
                'id' => (string) ($row['id'] ?? ''),
                'name' => (string) ($row['nome'] ?? ''),
                'year' => (string) ($row['ano'] ?? ''),
            ];
        }, $rows);
    }

    /**
     * Gera uma recomendacao curta. Se Gemini no estiver configurado, cai em fallback seguro.
     *
     * @since 1.0.0
     */
    private function buildRecommendation(string $banca, ?string $cargo, array $detailedBreakdown): string
    {
        $fallback = 'Para obter uma recomendacao estrategica personalizada, continue seus estudos focando nos topicos de maior incidencia apresentados acima.';
        $apiKey = $this->repository->getSystemSettingValue('geminiApiKey', getenv('GEMINI_API_KEY'));
        if (!is_string($apiKey) || trim($apiKey) === '') {
            return $fallback;
        }

        $topSubjects = array_slice($detailedBreakdown, 0, 3);
        if ($topSubjects === []) {
            return $fallback;
        }

        $subjectContext = '';
        foreach ($topSubjects as $subject) {
            $topicNames = array_map(
                static fn(array $topic): string => (string) ($topic['topic'] ?? ''),
                array_slice((array) ($subject['topics'] ?? []), 0, 3)
            );
            $subjectContext .= '- ' . $subject['subject'] . ' (' . $subject['total'] . ' questes): ' . implode(', ', array_filter($topicNames)) . ".\n";
        }

        $prompt = "Aja como um mentor de concursos experiente. Com base nos dados da banca {$banca}, cargos: "
            . ($cargo ?: 'Geral')
            . ", gere uma recomendacao estrategica curta em portugues com no mximo quatro paragrafos pequenos.\n"
            . "Dados de incidencia:\n{$subjectContext}\n"
            . "Explique quais materias merecem mais foco e como essa banca costuma cobrar os temas.";

        try {
            $response = $this->callGeminiRecommendationApi($apiKey, $prompt);
            $text = $response['candidates'][0]['content']['parts'][0]['text'] ?? null;
            if (is_string($text) && trim($text) !== '') {
                return trim($text);
            }
        } catch (Throwable) {
            // Falha de IA no deve quebrar o raio-x.
        }

        return $fallback;
    }

    /**
     * Executa a chamada externa ao Gemini.
     *
     * @since 1.0.0
     */
    private function callGeminiRecommendationApi(string $apiKey, string $prompt): array
    {
        $model = trim((string) $this->repository->getSystemSettingValue('geminiModel', 'gemini-3.5-flash'));
        if (preg_match('/^gemini-[A-Za-z0-9._-]+$/', $model) !== 1) {
            $model = 'gemini-3.5-flash';
        }
        $url = 'https://generativelanguage.googleapis.com/v1beta/models/' . rawurlencode($model) . ':generateContent?key='
            . rawurlencode($apiKey);
        $payload = json_encode([
            'contents' => [
                [
                    'parts' => [
                        ['text' => $prompt],
                    ],
                ],
            ],
        ], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);

        if (!is_string($payload)) {
            throw new RuntimeException('No foi possvel serializar o payload do Gemini.');
        }

        $curl = curl_init($url);
        curl_setopt($curl, CURLOPT_RETURNTRANSFER, true);
        curl_setopt($curl, CURLOPT_POST, true);
        curl_setopt($curl, CURLOPT_POSTFIELDS, $payload);
        curl_setopt($curl, CURLOPT_HTTPHEADER, ['Content-Type: application/json']);

        $response = curl_exec($curl);
        $error = curl_error($curl);
        curl_close($curl);

        if (!is_string($response) || $response === '') {
            throw new RuntimeException($error !== '' ? $error : 'Gemini sem resposta.');
        }

        $decoded = json_decode($response, true);
        if (!is_array($decoded)) {
            throw new RuntimeException('Resposta invalida do Gemini.');
        }

        return $decoded;
    }

    /**
     * Faz o scraping do site da banca preservando o contrato legado do app.
     *
     * @since 1.0.0
     */
    private function scrapeBancaInfo(string $url, string $baseUrl, string $host): array
    {
        $targetUrls = [$url];
        if (in_array($host, ['www.ibfc.org.br', 'ibfc.selecao.net.br'], true)) {
            $targetUrls = ['https://ibfc.selecao.net.br/index/1/'];
        }

        $userAgents = [
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
            'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1',
            'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
        ];

        $lastHttpCode = 0;
        $lastHtml = '';
        $lastError = '';
        $resolvedUrl = $url;

        foreach ($targetUrls as $targetUrl) {
            foreach ($userAgents as $userAgent) {
                $attempt = $this->fetchHtmlDocument($targetUrl, $userAgent);
                $lastHttpCode = $attempt['httpCode'];
                $lastError = $attempt['error'];

                if ($attempt['html'] !== '') {
                    $lastHtml = $attempt['html'];
                    $resolvedUrl = $targetUrl;
                    break 2;
                }

                if ($lastHttpCode === 403) {
                    usleep(500000);
                }
            }
        }

        if ($lastHtml === '') {
            error_log('Statistics banca_info failure for ' . $url . '. Last HTTP Code: ' . $lastHttpCode . '. Error: ' . $lastError);

            return [
                'success' => false,
                'error' => 'Access Denied (403). Automated access blocked by the board\'s firewall.',
                'data' => [
                    'emAndamento' => [],
                    'realizados' => [],
                    'totalFound' => 0,
                    'targetUrl' => $url,
                    'status' => 'scraper_failed',
                ],
            ];
        }

        return [
            'success' => true,
            'data' => $this->extractBoardLinksFromHtml($lastHtml, $baseUrl, $resolvedUrl),
        ];
    }

    /**
     * Faz uma tentativa de download HTML com cookies e cabealhos prximos do navegador.
     *
     * @since 1.0.0
     */
    private function fetchHtmlDocument(string $url, string $userAgent): array
    {
        $curl = curl_init();
        $cookieFile = dirname(__DIR__, 3) . '/storage/runtime/cookies/cookies_' . md5($url) . '.txt';

        curl_setopt($curl, CURLOPT_URL, $url);
        curl_setopt($curl, CURLOPT_RETURNTRANSFER, true);
        curl_setopt($curl, CURLOPT_FOLLOWLOCATION, true);
        curl_setopt($curl, CURLOPT_MAXREDIRS, 5);
        curl_setopt($curl, CURLOPT_TIMEOUT, 20);
        curl_setopt($curl, CURLOPT_ENCODING, '');
        curl_setopt($curl, CURLOPT_COOKIEJAR, $cookieFile);
        curl_setopt($curl, CURLOPT_COOKIEFILE, $cookieFile);
        curl_setopt($curl, CURLOPT_HTTPHEADER, [
            'Host: ' . (parse_url($url, PHP_URL_HOST) ?: ''),
            'Accept: text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
            'Accept-Language: pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7',
            'Cache-Control: max-age=0',
            'Sec-Fetch-Dest: document',
            'Sec-Fetch-Mode: navigate',
            'Sec-Fetch-Site: none',
            'Sec-Fetch-User: ?1',
            'Upgrade-Insecure-Requests: 1',
            'User-Agent: ' . $userAgent,
        ]);
        curl_setopt($curl, CURLOPT_SSL_VERIFYPEER, false);
        curl_setopt($curl, CURLOPT_SSL_VERIFYHOST, false);

        if (defined('CURL_HTTP_VERSION_2_0')) {
            curl_setopt($curl, CURLOPT_HTTP_VERSION, CURL_HTTP_VERSION_2_0);
        }

        $html = curl_exec($curl);
        $httpCode = (int) curl_getinfo($curl, CURLINFO_HTTP_CODE);
        $error = curl_error($curl);
        curl_close($curl);

        if (!is_string($html) || $httpCode !== 200 || !str_contains($html, '<body')) {
            return [
                'html' => '',
                'httpCode' => $httpCode,
                'error' => $error,
            ];
        }

        return [
            'html' => $html,
            'httpCode' => $httpCode,
            'error' => '',
        ];
    }

    /**
     * Extrai links do HTML da banca e classifica em andamento ou realizados.
     *
     * @since 1.0.0
     */
    private function extractBoardLinksFromHtml(string $html, string $baseUrl, string $currentUrl): array
    {
        libxml_use_internal_errors(true);
        $document = new DOMDocument();
        $htmlContent = mb_convert_encoding($html, 'HTML-ENTITIES', 'UTF-8');
        @$document->loadHTML($htmlContent);
        libxml_clear_errors();

        $xpath = new DOMXPath($document);
        $anchors = $xpath->query('//a');

        $ongoingKeywords = ['inscri', 'andamento', 'aberta', 'futuro', 'breves', 'edital', 'concurso', 'certame'];
        $finishedKeywords = ['resultado', 'encerrado', 'homologado', 'gabarito', 'realizado', 'anterior'];

        $ongoing = [];
        $finished = [];
        $seenUrls = [];

        foreach ($anchors ?: [] as $node) {
            $text = trim((string) $node->textContent);
            if ($text === '' || mb_strlen($text, 'UTF-8') < 3) {
                continue;
            }

            $href = trim((string) $node->getAttribute('href'));
            if ($href === '' || $href === '#') {
                continue;
            }

            if (str_starts_with($href, 'javascript:') || str_starts_with($href, 'mailto:') || str_starts_with($href, 'tel:')) {
                continue;
            }

            $absoluteUrl = $this->toAbsoluteUrl($href, $baseUrl, $currentUrl);
            if (isset($seenUrls[$absoluteUrl])) {
                continue;
            }

            $lowerText = mb_strtolower($text, 'UTF-8');
            $lowerHref = strtolower($href);

            $isOngoing = $this->containsAnyKeyword($lowerText, $ongoingKeywords)
                || $this->containsAnyKeyword($lowerHref, $ongoingKeywords);
            $isFinished = !$isOngoing && $this->containsAnyKeyword($lowerText, $finishedKeywords);

            $link = [
                'text' => mb_strlen($text, 'UTF-8') > 100
                    ? mb_substr($text, 0, 97, 'UTF-8') . '...'
                    : $text,
                'url' => $absoluteUrl,
            ];

            if ($isOngoing) {
                $ongoing[] = $link;
                $seenUrls[$absoluteUrl] = true;
            } elseif ($isFinished) {
                $finished[] = $link;
                $seenUrls[$absoluteUrl] = true;
            }

            if (count($ongoing) >= 20 && count($finished) >= 20) {
                break;
            }
        }

        return [
            'emAndamento' => array_slice($ongoing, 0, 10),
            'realizados' => array_slice($finished, 0, 10),
            'totalFound' => count($ongoing) + count($finished),
            'targetUrl' => $currentUrl,
        ];
    }

    /**
     * Resolve links relativos para URL absoluta.
     *
     * @since 1.0.0
     */
    private function toAbsoluteUrl(string $href, string $baseUrl, string $currentUrl): string
    {
        if (str_starts_with($href, 'http://') || str_starts_with($href, 'https://')) {
            return $href;
        }

        if (str_starts_with($href, '//')) {
            return 'https:' . $href;
        }

        if (str_starts_with($href, '/')) {
            return $baseUrl . $href;
        }

        $path = parse_url($currentUrl, PHP_URL_PATH) ?: '/';
        $directory = dirname($path);
        if ($directory === '/' || $directory === '\\') {
            $directory = '';
        }

        return $baseUrl . $directory . '/' . $href;
    }

    /**
     * Ajuda a classificar texto/URL sem repetir loops na rotina de scraping.
     *
     * @since 1.0.0
     */
    private function containsAnyKeyword(string $haystack, array $keywords): bool
    {
        foreach ($keywords as $keyword) {
            if ($keyword !== '' && mb_stripos($haystack, $keyword) !== false) {
                return true;
            }
        }

        return false;
    }
}
