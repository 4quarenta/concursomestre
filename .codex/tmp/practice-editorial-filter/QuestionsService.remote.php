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

require_once __DIR__ . '/../../../config/payment_provider.php';
require_once __DIR__ . '/QuestionAnswerEvaluator.php';
require_once __DIR__ . '/QuestionOutputPolicy.php';
require_once __DIR__ . '/QuestionOwnershipPolicy.php';
require_once __DIR__ . '/QuestionPublicPageCache.php';
require_once __DIR__ . '/../repositories/QuestionCanonicalRepository.php';
require_once __DIR__ . '/../../../shared/pagination/SignedKeysetCursor.php';
require_once __DIR__ . '/../../../shared/events/TransactionalOutbox.php';
require_once __DIR__ . '/../../../shared/storage/ObjectStorage.php';

class QuestionsService
{
    public function __construct(
        private readonly QuestionsRepository $repository,
        private readonly QuestionsValidator $validator,
        private readonly QuestionsRewardService $rewardService,
        private readonly PDO $db,
        ?QuestionAnswerEvaluator $answerEvaluator = null,
        ?QuestionCanonicalRepository $canonicalRepository = null,
        ?QuestionOutputPolicy $outputPolicy = null,
        ?QuestionOwnershipPolicy $ownershipPolicy = null,
        ?QuestionPublicPageCache $publicPageCache = null,
        ?TransactionalOutbox $outbox = null
    ) {
        $this->answerEvaluator = $answerEvaluator ?? new QuestionAnswerEvaluator();
        $this->canonicalRepository = $canonicalRepository ?? new QuestionCanonicalRepository($db);
        $this->outputPolicy = $outputPolicy ?? new QuestionOutputPolicy();
        $this->ownershipPolicy = $ownershipPolicy ?? new QuestionOwnershipPolicy();
        $this->publicPageCache = $publicPageCache ?? QuestionPublicPageCache::fromEnvironment();
        $this->outbox = $outbox ?? new TransactionalOutbox($db);
    }

    private readonly QuestionAnswerEvaluator $answerEvaluator;
    private readonly QuestionCanonicalRepository $canonicalRepository;
    private readonly QuestionOutputPolicy $outputPolicy;
    private readonly QuestionOwnershipPolicy $ownershipPolicy;
    private readonly QuestionPublicPageCache $publicPageCache;
    private readonly TransactionalOutbox $outbox;

    public function submitAnswer(
        string $authenticatedUserId,
        bool $isAdmin,
        array $payload,
        array $submissionContext = []
    ): array
    {
        $data = $this->validator->validateAnswerPayload($payload);
        if ($data['requestedUserId'] !== null && $data['requestedUserId'] !== $authenticatedUserId) {
            throw new DomainException('Você não pode registrar resposta para outro usuário.');
        }
        $userId = $authenticatedUserId;

        $question = $this->repository->findQuestionById($data['questionId']);
        if ($question === null) {
            throw new OutOfBoundsException('Questao nao encontrada.');
        }
        $answerEvaluation = $this->answerEvaluator->evaluate($question, $data['selectedOption']);
        $isCorrect = $answerEvaluation['isCorrect'];

        $before = $this->repository->findUserProgressSnapshot($userId);
        if ($before === null) {
            throw new OutOfBoundsException('Usuario nao encontrado.');
        }

        if (!$isAdmin) {
            $this->enforceUsageLimit($userId, 'questions_per_day');
        }

        $xpGain = $isCorrect ? 10 : 2;
        $levelBefore = (int) ($before['level'] ?? 1);
        $selectedOptionId = is_numeric($submissionContext['selectedOptionId'] ?? null)
            ? (int) $submissionContext['selectedOptionId']
            : null;
        $idempotencyKey = trim((string) ($submissionContext['idempotencyKey'] ?? '')) ?: null;
        $requestHash = trim((string) ($submissionContext['requestHash'] ?? '')) ?: null;
        $canonicalAnswerStorageReady = $this->repository->questionScaleColumnsReady();
        if (!$canonicalAnswerStorageReady) {
            $selectedOptionId = null;
            $idempotencyKey = null;
            $requestHash = null;
        }

        $this->db->beginTransaction();
        try {
            $idempotency = null;
            if ($idempotencyKey !== null && $requestHash !== null) {
                $idempotency = $this->repository->reserveAnswerIdempotency([
                    'user_id' => $userId,
                    'idempotency_key' => $idempotencyKey,
                    'request_hash' => $requestHash,
                    'question_id' => $data['questionId'],
                    'selected_option_id' => $selectedOptionId,
                ]);
                $cachedResponse = json_decode((string) ($idempotency['response_json'] ?? ''), true);
                if (($idempotency['status'] ?? '') === 'completed' && is_array($cachedResponse)) {
                    $this->commitIfNeeded();
                    return $cachedResponse;
                }
            }

            $userAnswerId = $this->repository->insertUserAnswer([
                'user_id' => $userId,
                'question_id' => $data['questionId'],
                'simulation_id' => $data['simulationId'],
                'selected_option_index' => $data['selectedOption'],
                'selected_option_id' => $selectedOptionId,
                'is_correct' => $isCorrect ? 1 : 0,
                'time_taken_seconds' => $data['timeTaken'],
            ]);
            $this->repository->incrementQuestionStats($data['questionId'], $isCorrect);
            $this->repository->recordUserAnswerCounter($userId, $isCorrect);
            $this->repository->incrementUserXp($userId, $xpGain);

            $after = $this->repository->findUserProgressSnapshot($userId) ?? $before;
            $this->outbox->enqueue(
                'user_answer',
                (string) $userAnswerId,
                'question.answer.recorded',
                'question-answer:' . $userAnswerId,
                [
                    'userAnswerId' => $userAnswerId,
                    'userId' => $userId,
                    'questionId' => (int) $data['questionId'],
                    'isCorrect' => $isCorrect,
                    'levelBefore' => $levelBefore,
                ]
            );

            $result = [
                'success' => true,
                'message' => 'Resposta salva com sucesso.',
                'new_xp' => (int) ($after['xp'] ?? 0),
                'new_level' => (int) ($after['level'] ?? 1),
                'newXp' => (int) ($after['xp'] ?? 0),
                'newLevel' => (int) ($after['level'] ?? 1),
                'xpGain' => $xpGain,
                'levelUp' => (int) ($after['level'] ?? 1) > $levelBefore,
                'gamification' => [
                    'status' => 'queued',
                    'eventId' => 'question-answer:' . $userAnswerId,
                ],
                'answer' => $answerEvaluation,
            ];
            if (is_array($idempotency)) {
                $this->repository->completeAnswerIdempotency(
                    (int) $idempotency['id'],
                    $userAnswerId,
                    $result
                );
            }
            $this->commitIfNeeded();
        } catch (Throwable $e) {
            $this->rollback();
            throw $e;
        }

        return $result;
    }

    public function listQuestions(
        ?string $authenticatedUserId,
        bool $canViewTeacherComments,
        bool $canViewDetailedAnalysis,
        array $query
    ): array {
        if (!$this->repository->hasQuestionsTable()) {
            return ['rows' => [], 'total' => 0, 'page' => 1, 'perPage' => 0, 'pages' => 0];
        }

        $data = $this->validator->validateListQuery($query);
        $rows = $this->repository->listQuestionPageRows(
            $data['limit'],
            $data['offset'],
            $data['filters'],
            $authenticatedUserId
        );
        $total = $this->repository->countAllQuestions($data['filters'], $authenticatedUserId);

        return [
            // A listagem publica (practice) precisa apenas do vinculo prova_id.
            // O catalogo completo de provas pertence ao fluxo administrativo.
            'rows' => $this->normalizeQuestionRows(
                $rows,
                $authenticatedUserId,
                $canViewTeacherComments,
                $canViewDetailedAnalysis,
                false
            ),
            'total' => $total,
            'page' => $data['page'],
            'perPage' => $data['limit'],
            'pages' => $data['limit'] > 0 ? (int) ceil($total / $data['limit']) : 0,
        ];
    }

    /**
     * Lista publica v2: DTO leve, camelCase e sem aliases/campos legados.
     *
     * @since 1.0.0
     */
    public function listQuestionsV2(
        ?string $authenticatedUserId,
        bool $canViewTeacherComments,
        bool $canViewDetailedAnalysis,
        array $query
    ): array
    {
        if (!$this->repository->hasQuestionsTable()) {
            return [
                'items' => [],
                'pageInfo' => [
                    'limit' => 0,
                    'total' => 0,
                    'hasMore' => false,
                    'nextCursor' => null,
                ],
            ];
        }

        $data = $this->validator->validateListQueryV2($query);
        $scope = $this->questionListCursorScope($data['filters'], $authenticatedUserId);
        $cursorPayload = SignedKeysetCursor::decodePayload($data['cursor'], $scope);
        $total = is_array($cursorPayload) && is_numeric($cursorPayload['total'] ?? null)
            ? max(0, (int) $cursorPayload['total'])
            : $this->publicPageCache->getTotal($data['filters']);

        $cached = $this->publicPageCache->get($data['limit'], $data['cursor'], $data['filters']);
        if ($cached !== null) {
            $rows = $cached['rows'];
            $filters = $cached['filters'];
            $hasMore = !empty($cached['hasMore']);
        } else {
            $rows = $this->repository->listQuestionListRowsByCursor(
                $data['limit'] + 1,
                $cursorPayload,
                $data['filters'],
                $authenticatedUserId
            );
            $hasMore = count($rows) > $data['limit'];
            if ($hasMore) {
                $rows = array_slice($rows, 0, $data['limit']);
            }
            $ids = $this->extractQuestionIds($rows);
            $filters = $this->repository->listQuestionFiltersByIds($ids);
        }

        if ($total === null) {
            $total = $this->repository->countAllQuestions($data['filters'], $authenticatedUserId);
            $this->publicPageCache->setTotal($data['filters'], $total);
        }
        if ($cached === null) {
            $this->publicPageCache->set($data['limit'], $data['cursor'], $data['filters'], [
                'rows' => $rows,
                'filters' => $filters,
                'hasMore' => $hasMore,
            ]);
        }

        $ids = $this->extractQuestionIds($rows);
        $stats = $this->repository->listQuestionStatsMap($ids);
        $commentCounts = $this->repository->listQuestionCommentCounts($ids);
        $answers = $authenticatedUserId !== null && $authenticatedUserId !== ''
            ? $this->repository->listLatestUserAnswersMap($authenticatedUserId, $ids)
            : [];
        $savedQuestionIds = $authenticatedUserId !== null && $authenticatedUserId !== ''
            ? $this->repository->listSavedQuestionIds($authenticatedUserId, $ids)
            : [];
        $practiceRows = [];
        $practiceAggregates = [];
        $practiceExams = [];
        if (($data['contentScope'] ?? 'list') === 'practice' && $ids !== []) {
            $practiceRows = $this->repository->listQuestionContractRowsByIds($ids);
            $practiceAggregates = $this->loadCanonicalAggregatesForRead($ids);
            $practiceExams = $this->repository->listQuestionProvasByIds($ids);
        }
        $lastRow = $rows === [] ? null : $rows[array_key_last($rows)];
        $nextCursor = $hasMore && is_array($lastRow)
            ? SignedKeysetCursor::encodePayload([
                'publishedAt' => (string) ($lastRow['published_sort_at'] ?? ''),
                'id' => (string) ($lastRow['id'] ?? ''),
                'total' => $total,
            ], $scope)
            : null;

        $items = array_map(function (array $row) use (
            $data,
            $filters,
            $stats,
            $commentCounts,
            $answers,
            $savedQuestionIds,
            $practiceRows,
            $practiceAggregates,
            $practiceExams,
            $authenticatedUserId,
            $canViewTeacherComments,
            $canViewDetailedAnalysis
        ): array {
            $id = (string) ($row['id'] ?? '');
            if (($data['contentScope'] ?? 'list') === 'practice' && isset($practiceRows[$id])) {
                $detail = $this->buildQuestionDetailV2(
                    $practiceRows[$id],
                    $practiceAggregates[(int) $id] ?? null,
                    $filters[$id] ?? [],
                    $stats[$id] ?? null,
                    $answers[$id] ?? null,
                    false,
                    $canViewTeacherComments,
                    $canViewDetailedAnalysis,
                    $practiceExams[$id] ?? [],
                    $commentCounts[$id] ?? 0
                );
                if ($authenticatedUserId !== null && $authenticatedUserId !== '') {
                    $detail['userState'] = [
                        'answered' => isset($answers[$id]),
                        'isSaved' => isset($savedQuestionIds[$id]),
                    ];
                }
                return $detail;
            }

            return $this->buildQuestionListItemV2(
                $row,
                $filters[$id] ?? [],
                $stats[$id] ?? null,
                $answers[$id] ?? null,
                isset($savedQuestionIds[$id]),
                $authenticatedUserId !== null && $authenticatedUserId !== '',
                $commentCounts[$id] ?? 0
            );
        }, $rows);

        return [
            'items' => $items,
            'pageInfo' => [
                'limit' => $data['limit'],
                'total' => $total,
                'hasMore' => $hasMore,
                'nextCursor' => $nextCursor,
            ],
        ];
    }

    public function getQuestionDetails(
        ?string $authenticatedUserId,
        bool $canViewTeacherComments,
        bool $canViewDetailedAnalysis,
        array $query
    ): array {
        $identity = $this->validator->validateQuestionIdentityQuery($query, 'ID da questao nao fornecido.');
        $row = $this->repository->findQuestionById($identity['questionId']);
        if ($row === null || !$this->isPublishedNow($row)) {
            throw new OutOfBoundsException('Questao nao encontrada.');
        }

        $id = (string) ($row['id'] ?? $identity['questionId']);
        $filtersMap = $this->repository->listQuestionFiltersByIds([$id]);
        $provasMap = $this->repository->listQuestionProvasByIds([$id]);
        $statsMap = $this->repository->listQuestionStatsMap([$id]);
        $countsMap = $this->repository->listQuestionCommentCounts([$id]);
        $answerMap = $authenticatedUserId ? $this->repository->listLatestUserAnswersMap($authenticatedUserId, [$id]) : [];

        return $this->normalizeQuestionRow(
            $row,
            $statsMap[$id] ?? null,
            $countsMap[$id] ?? 0,
            $filtersMap[$id] ?? [],
            $provasMap[$id] ?? [],
            $answerMap[$id] ?? null,
            $canViewTeacherComments,
            $canViewDetailedAnalysis
        );
    }

    /**
     * Detalhe publico v2 para pratica: inclui conteudo e alternativas, mas
     * nunca inclui gabarito, revisao administrativa ou editoriais bloqueados.
     *
     * @since 1.0.0
     */
    public function getQuestionPracticeV2(
        ?string $authenticatedUserId,
        bool $canViewTeacherComments,
        bool $canViewDetailedAnalysis,
        array $query
    ): array
    {
        $identity = $this->validator->validateQuestionIdentityQuery($query, 'ID da questao nao fornecido.');
        $row = $this->repository->findQuestionContractRowById($identity['questionId']);
        if ($row === null || !$this->isPublishedNow($row)) {
            throw new OutOfBoundsException('Questao nao encontrada.');
        }

        $id = (string) ($row['id'] ?? $identity['questionId']);
        $filtersMap = $this->repository->listQuestionFiltersByIds([$id]);
        $provasMap = $this->repository->listQuestionProvasByIds([$id]);
        $statsMap = $this->repository->listQuestionStatsMap([$id]);
        $countsMap = $this->repository->listQuestionCommentCounts([$id]);
        $answerMap = $authenticatedUserId ? $this->repository->listLatestUserAnswersMap($authenticatedUserId, [$id]) : [];
        $aggregate = $this->loadCanonicalAggregateForRead((int) $id);

        return $this->buildQuestionDetailV2(
            $row,
            $aggregate,
            $filtersMap[$id] ?? [],
            $statsMap[$id] ?? null,
            $answerMap[$id] ?? null,
            false,
            $canViewTeacherComments,
            $canViewDetailedAnalysis,
            $provasMap[$id] ?? [],
            $countsMap[$id] ?? 0
        );
    }

    /**
     * Detalhe administrativo v2: somente admin/staff recebe gabarito,
     * editoriais e estado de revisao.
     *
     * @since 1.0.0
     */
    public function getQuestionAdminV2(string $authenticatedUserId, bool $isAdmin, array $query): array
    {
        $this->assertAdmin($authenticatedUserId, $isAdmin);
        $identity = $this->validator->validateQuestionIdentityQuery($query, 'ID da questao nao fornecido.');
        $row = $this->repository->findQuestionContractRowById($identity['questionId']);
        if ($row === null) {
            throw new OutOfBoundsException('Questao nao encontrada.');
        }

        $id = (string) ($row['id'] ?? $identity['questionId']);
        $filtersMap = $this->repository->listQuestionFiltersByIds([$id]);
        $provasMap = $this->repository->listQuestionProvasByIds([$id]);
        $statsMap = $this->repository->listQuestionStatsMap([$id]);
        $countsMap = $this->repository->listQuestionCommentCounts([$id]);
        $aggregate = $this->loadCanonicalAggregateForRead((int) $id);

        return $this->buildQuestionDetailV2(
            $row,
            $aggregate,
            $filtersMap[$id] ?? [],
            $statsMap[$id] ?? null,
            null,
            true,
            true,
            true,
            $provasMap[$id] ?? [],
            $countsMap[$id] ?? 0
        );
    }

    /**
     * Submissao v2: o cliente envia o identificador da alternativa, e o
     * backend resolve o indice interno antes de corrigir.
     *
     * @since 1.0.0
     */
    public function submitAnswerV2(string $authenticatedUserId, bool $isAdmin, array $payload): array
    {
        $questionId = trim((string) ($payload['questionId'] ?? $payload['question_id'] ?? ''));
        $selectedAlternativeId = trim((string) ($payload['selectedAlternativeId'] ?? $payload['selected_alternative_id'] ?? ''));
        if ($questionId === '' || $selectedAlternativeId === '') {
            throw new InvalidArgumentException('Informe questionId e selectedAlternativeId.');
        }

        $row = $this->repository->findQuestionContractRowById($questionId);
        if ($row === null) {
            throw new OutOfBoundsException('Questao nao encontrada.');
        }

        $aggregate = $this->loadCanonicalAggregateForRead((int) $questionId);
        $alternatives = $this->resolveAlternativesForV2($row, $aggregate);
        $selectedIndex = null;
        $selectedCanonicalOptionId = null;
        foreach ($alternatives as $index => $alternative) {
            $candidates = [
                (string) ($alternative['id'] ?? ''),
                (string) ($alternative['tempId'] ?? ''),
                (string) ($alternative['label'] ?? ''),
            ];
            if (in_array($selectedAlternativeId, $candidates, true)) {
                $selectedIndex = $index;
                $rawAlternative = $aggregate['alternatives'][$index] ?? null;
                $selectedCanonicalOptionId = is_array($rawAlternative)
                    && is_numeric($rawAlternative['canonicalId'] ?? null)
                    ? (int) $rawAlternative['canonicalId']
                    : null;
                break;
            }
        }

        if ($selectedIndex === null) {
            throw new InvalidArgumentException('Alternativa selecionada invalida.');
        }

        $idempotencyKey = trim((string) ($payload['idempotencyKey'] ?? $payload['idempotency_key'] ?? ''));
        if ($idempotencyKey !== '' && preg_match('/^[A-Za-z0-9][A-Za-z0-9._:-]{7,119}$/', $idempotencyKey) !== 1) {
            throw new InvalidArgumentException('Chave de idempotencia invalida.');
        }
        $requestHash = hash('sha256', json_encode([
            'questionId' => (string) $questionId,
            'selectedAlternativeId' => $selectedAlternativeId,
            'selectedOptionId' => $selectedCanonicalOptionId,
            'simulationId' => $payload['simulationId'] ?? $payload['simulation_id'] ?? null,
        ], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES) ?: '');

        return $this->submitAnswer($authenticatedUserId, $isAdmin, [
            'question_id' => $questionId,
            'selected_option' => $selectedIndex,
            'time_taken' => (int) ($payload['timeTaken'] ?? $payload['time_taken'] ?? 0),
            'simulation_id' => $payload['simulationId'] ?? $payload['simulation_id'] ?? null,
        ], [
            'selectedOptionId' => $selectedCanonicalOptionId,
            'idempotencyKey' => $idempotencyKey !== '' ? $idempotencyKey : null,
            'requestHash' => $idempotencyKey !== '' ? $requestHash : null,
        ]);
    }

    public function filterQuestions(bool $canViewTeacherComments, bool $canViewDetailedAnalysis, array $query): array
    {
        $data = $this->validator->validateFilterQuery($query);
        $rows = $this->repository->listFilteredQuestionRows($data['perPage'], $data['offset'], $data['keyword']);
        $total = $this->repository->countFilteredQuestions($data['keyword']);

        return [
            'rows' => $this->normalizeAdminQuestionListRows(
                $rows,
                $canViewTeacherComments,
                $canViewDetailedAnalysis
            ),
            'total' => $total,
            'perPage' => $data['perPage'],
            'pages' => $data['perPage'] > 0 ? (int) ceil($total / $data['perPage']) : 0,
            'page' => $data['page'],
        ];
    }

    /**
     * Monta o DTO leve da biblioteca administrativa sem carregar alternativas,
     * gabarito, assets, contextos ou corpos editoriais de cada questao.
     *
     * @return array<int, array<string, mixed>>
     */
    private function normalizeAdminQuestionListRows(
        array $rows,
        bool $canViewTeacherComments,
        bool $canViewDetailedAnalysis
    ): array {
        $ids = $this->extractQuestionIds($rows);
        $counts = $this->repository->listQuestionCommentCounts($ids);
        $filters = $this->repository->listQuestionFiltersByIds($ids);
        $provas = $this->repository->listQuestionProvasByIds($ids);
        $editorialFlags = $this->canonicalRepository->isAvailable()
            ? $this->canonicalRepository->listQuestionEditorialFlags($ids)
            : [];

        $normalized = [];
        foreach ($rows as $row) {
            $id = (string) ($row['id'] ?? '');
            $buckets = $this->partitionFilters($filters[$id] ?? []);
            $questionProvas = $provas[$id] ?? [];
            $flags = $editorialFlags[$id] ?? [];
            // A flag indexada e a fonte usada pelo filtro público. Mantemos a
            // leitura canônica como confirmação para dados anteriores ao
            // backfill, evitando que a própria UI descarte um item já aceito
            // pela consulta SQL.
            $hasStoredTeacherComment = !empty($row['has_teacher_comment'])
                || !empty($flags['hasTeacherComment']);
            $hasStoredDetailedAnalysis = !empty($row['has_detailed_comment'])
                || !empty($flags['hasDetailedAnalysis']);
            $hasTeacherComment = $canViewTeacherComments
                && $hasStoredTeacherComment;
            $hasDetailedAnalysis = $canViewDetailedAnalysis
                && $hasStoredDetailedAnalysis;
            $statement = (string) ($row['enunciado'] ?? '');
            $statementClean = (string) ($row['enunciado_clean'] ?? strip_tags($statement));
            $origin = !empty($row['prova_id']) || $questionProvas !== [] ? 'exam' : 'platform';
            $publicationStatus = (string) ($row['publish_status'] ?? 'published');
            $visibilityStatus = (string) ($row['visibility_status'] ?? 'public');
            $difficulty = (int) ($row['dificuldade'] ?? 1);

            $normalized[] = [
                'id' => is_numeric($row['id'] ?? null) ? (int) $row['id'] : ($row['id'] ?? null),
                'content' => [
                    'statement' => $statement,
                    'statementClean' => $statementClean,
                ],
                'source' => [
                    'origin' => $origin,
                    'examId' => $row['prova_id'] ?? null,
                    'questionNumber' => $row['source_question_number'] ?? null,
                    'provider' => $row['source_provider'] ?? null,
                    'externalId' => $row['source_external_id'] ?? null,
                ],
                'type' => (string) ($row['tipo'] ?? '') === 'certo_errado' ? 'true_false' : 'single_choice',
                'difficulty' => $this->difficultyLabel($difficulty),
                'filters' => [
                    'subjects' => array_values(array_filter($buckets['assuntos'], static fn (array $item): bool => !empty($item['materia']))),
                    'topics' => array_values(array_filter($buckets['assuntos'], static fn (array $item): bool => empty($item['materia']) && !empty($item['parentId']))),
                    'subtopics' => array_values(array_filter($buckets['assuntos'], static fn (array $item): bool => empty($item['materia']) && empty($item['parentId']))),
                    'examBoards' => $buckets['bancas'],
                    'organizations' => $buckets['orgaos'],
                    'roles' => $buckets['cargos'],
                    'careers' => $buckets['carreiras'],
                    'years' => $buckets['anos'],
                    'levels' => $buckets['niveis'],
                    'examTypes' => $buckets['tiposProva'],
                ],
                'exams' => $questionProvas,
                'publication' => [
                    'status' => $publicationStatus,
                    'visibility' => $visibilityStatus,
                    'scheduledAt' => $row['scheduled_at'] ?? null,
                    'publishedAt' => $row['published_at'] ?? null,
                ],
                'editorial' => [
                    'hasTeacherComment' => $hasTeacherComment,
                    'hasDetailedAnalysis' => $hasDetailedAnalysis,
                ],
                'stats' => [
                    'totalAttempts' => (int) ($row['total_attempts'] ?? 0),
                    'correctCount' => (int) ($row['correct_count'] ?? 0),
                    'wrongCount' => (int) ($row['wrong_count'] ?? 0),
                ],
                'commentsCount' => (int) ($counts[$id] ?? 0),
                'flags' => [
                    'annulled' => !empty($row['anulada']),
                    'outdated' => !empty($row['desatualizada']),
                ],
                'createdAt' => $row['created_at'] ?? null,
            ];
        }

        return $normalized;
    }

    public function getQuestionStats(array $query): array
    {
        $identity = $this->validator->validateStatsQuery($query);
        $counts = $this->repository->getQuestionOutcomeCounts($identity['questionId']);
        $optionDistribution = $this->repository->getQuestionOptionDistribution($identity['questionId']);
        $totalAttempts = (int) ($counts['totalAttempts'] ?? 0);

        return [
            'totalAttempts' => $totalAttempts,
            'correctCount' => (int) ($counts['correctCount'] ?? 0),
            'wrongCount' => (int) ($counts['wrongCount'] ?? 0),
            'optionDistribution' => $optionDistribution,
        ];
    }

    public function saveQuestion(string $authenticatedUserId, bool $isAdmin, array $payload): array
    {
        $this->assertAdmin($authenticatedUserId, $isAdmin);
        $payload = $this->persistQuestionRichTextImages($payload);
        $payload = $this->preserveMissingEditorialFields($payload);
        $data = $this->validator->validateSavePayload($payload);
        if ($data['id'] !== null) {
            $this->assertCanManageOwnedRecord(
                $authenticatedUserId,
                $data['id'],
                $this->repository->findQuestionOwnershipById($data['id']),
                'Questao nao encontrada.',
                'Staff so pode editar questoes publicadas por ele.'
            );
        }

        $this->db->beginTransaction();
        try {
            [$questionId, $newTaxonomies] = $this->persistValidatedQuestion($data, $authenticatedUserId);
            $this->commitIfNeeded();
        } catch (Throwable $e) {
            $this->rollback();
            throw $e;
        }
        $this->publicPageCache->invalidate();

        $saved = $this->repository->findQuestionById($questionId);
        $filters = $this->repository->listQuestionFiltersByIds([$questionId]);

        return [
            'id' => is_numeric($questionId) ? (int) $questionId : $questionId,
            'question' => $saved ? $this->normalizeQuestionRow($saved, null, 0, $filters[(string) $questionId] ?? [], [], null, true, true, true) : null,
            'newTaxonomies' => $newTaxonomies,
            'new_taxonomies' => $newTaxonomies,
        ];
    }

    /**
     * Preserva campos editoriais quando um update parcial envia apenas um deles.
     *
     * @since 1.0.0
     */
    private function preserveMissingEditorialFields(array $payload): array
    {
        $questionId = $payload['id'] ?? null;
        if ($questionId === null || $questionId === '') {
            return $payload;
        }

        $needsTeacher = !array_key_exists('teacherComment', $payload)
            && !array_key_exists('teacher_comment', $payload)
            && !array_key_exists('comentarioProfessor', $payload);
        $needsDetailed = !array_key_exists('detailedComment', $payload)
            && !array_key_exists('detailed_comment', $payload)
            && !array_key_exists('analiseDetalhada', $payload);

        if (!$needsTeacher && !$needsDetailed) {
            return $payload;
        }

        $existing = $this->repository->findQuestionById($questionId);
        if (!is_array($existing)) {
            return $payload;
        }

        $data = $this->decodeQuestionJson($existing['data_json'] ?? null);
        if ($needsTeacher) {
            $payload['teacherComment'] = (string) (
                $data['teacherComment']
                ?? $data['teacher_comment']
                ?? $data['comentarioProfessor']
                ?? ''
            );
        }
        if ($needsDetailed) {
            $payload['detailedComment'] = (string) (
                $data['detailedComment']
                ?? $data['detailed_comment']
                ?? $data['analiseDetalhada']
                ?? ''
            );
        }

        return $payload;
    }

    /**
     * Importa um lote oficial extraido de PDF criando prova, contextos e questoes em um unico contrato.
     *
     * @since 1.0.0
     */
    public function bulkImportQuestions(string $authenticatedUserId, bool $isAdmin, array $payload, ?array $proofPdfFile = null): array
    {
        $this->assertAdmin($authenticatedUserId, $isAdmin);

        if (($payload['schemaVersion'] ?? null) !== 'question-import.v2') {
            throw new InvalidArgumentException('Contrato de importacao invalido. Informe schemaVersion question-import.v2.');
        }
        $this->canonicalRepository->assertSchemaReady();

        $questions = is_array($payload['questions'] ?? null) ? $payload['questions'] : [];

        $focus = $this->normalizeBulkImportFocus($payload['focus'] ?? []);
        $questionFocuses = $this->collectBulkQuestionFocuses($questions);
        if ($focus['name'] === '' && $questionFocuses === []) {
            throw new InvalidArgumentException('Informe a area/foco de cada questao ou um foco de fallback para o lote.');
        }
        $examFocus = $focus['name'] !== ''
            ? $focus
            : (count($questionFocuses) === 1 ? $questionFocuses[0] : ['id' => null, 'name' => '', 'slug' => '']);

        $examPayload = is_array($payload['exam'] ?? null) ? $payload['exam'] : [];
        $contexts = is_array($payload['contexts'] ?? null) ? $payload['contexts'] : [];
        $pdfUrl = $this->storeImportedExamPdf($proofPdfFile);
        $createdQuestionIds = [];
        $newTaxonomies = [];
        $groupIdByTempId = [];
        $canonicalContextIdByTempId = [];
        $contextQuestionNumbersByTempId = [];
        $createdQuestionIdBySourceNumber = [];
        $duplicateSkipped = [];
        $itemFailures = [];
        $seenImportKeys = [];
        $createdQuestionProvas = [];
        $importTraceId = $this->repository->beginExamQuestionImportTrace($authenticatedUserId, [
            'examId' => $examPayload['id'] ?? null,
            'requestedQuestionCount' => count($questions),
            'requestedContextCount' => count($contexts),
            'sourceExamKey' => $examPayload['sourceKey']
                ?? $examPayload['source_key']
                ?? $examPayload['title']
                ?? null,
        ]);

        $this->db->beginTransaction();
        try {
            $focusId = $examFocus['name'] !== ''
                ? $this->ensureFilterId(
                    'carreira',
                    $examFocus['name'],
                    $examFocus['slug'],
                    0,
                    1,
                    $examFocus['id']
                )
                : null;
            $focusTaxonomy = $focus['name'] !== '' ? [
                'id' => $this->ensureFilterId('carreira', $focus['name'], $focus['slug'], 0, 1, $focus['id']),
                'name' => $focus['name'],
                'nome' => $focus['name'],
                'slug' => $focus['slug'],
            ] : null;

            $examRecord = $this->withPublicationOwnership(
                $this->buildImportedExamRecord($examPayload, $questions, $focusId, $pdfUrl),
                $authenticatedUserId
            );
            $this->assertCanManageImportedExam($authenticatedUserId, $examRecord);
            $requireExistingExam = filter_var(
                $payload['requireExistingExam'] ?? $payload['require_existing_exam'] ?? false,
                FILTER_VALIDATE_BOOLEAN
            );
            if ($requireExistingExam && $this->repository->findImportedExamId($examRecord) === null) {
                throw new InvalidArgumentException('Publique a prova antes de postar questoes.');
            }

            $examId = (int) $this->repository->saveImportedExam($examRecord);
            if ($examId <= 0) {
                throw new RuntimeException('A prova precisa ser salva antes de vincular questoes.');
            }
            $this->repository->attachExamQuestionImportTraceToExam($importTraceId, $examId);
            $exam = $this->buildImportedExamResponse($examId, $examRecord);

            foreach ($contexts as $context) {
                if (!is_array($context)) {
                    continue;
                }
                $tempId = trim((string) ($context['id'] ?? $context['tempId'] ?? $context['contextKey'] ?? ''));
                if ($tempId === '') {
                    continue;
                }
                $contextQuestionNumbersByTempId[$tempId] = $this->normalizeBulkContextQuestionNumbers(
                    $context['questionIds'] ?? $context['questionNumbers'] ?? []
                );
                $contextData = $this->validator->validateQuestionGroupPayload([
                    'texto' => $context['texto'] ?? $this->resolveImportedContextText($context),
                    'assets' => $context['assets'] ?? [],
                ]);
                $contextData['assets'] = $this->persistQuestionContextAssets($contextData['assets']);
                $contextSource = is_array($context['source'] ?? null) ? $context['source'] : [];
                $contextData['source_provider'] = $this->normalizeImportedSourceProvider(
                    $contextSource['provider'] ?? $context['sourceProvider'] ?? $context['source_provider'] ?? null
                );
                $rawContextExternalId = $this->normalizeImportedSourceExternalId(
                    $contextSource['externalId'] ?? $context['sourceExternalId'] ?? $context['source_external_id'] ?? null
                );
                $contextData['source_external_id'] = $contextData['source_provider'] !== ''
                    ? $this->scopeImportedContextExternalId($examId, $rawContextExternalId)
                    : '';
                $contextData['prova_id'] = $examId;
                $contextData['created_by_user_id'] = $authenticatedUserId;
                $contextData['updated_by_user_id'] = $authenticatedUserId;
                $groupIdByTempId[$tempId] = $this->repository->saveQuestionGroup($contextData);
                $canonicalContext = $context;
                // A chave temporaria do importador (por exemplo, ctx_1) só é
                // única dentro da prova. Escopá-la evita que um novo lote
                // sobrescreva um contexto canônico de outro autor/prova.
                $canonicalContext['tempId'] = 'prova_' . $examId . '_' . $tempId;
                $canonicalContext['provaId'] = $examId;
                $canonicalContext['body'] = $contextData['texto'];
                $canonicalContext['assets'] = $contextData['assets'];
                if ($contextData['source_provider'] !== '' && $contextData['source_external_id'] !== '') {
                    $canonicalContext['source'] = [
                        'provider' => $contextData['source_provider'],
                        'externalId' => $contextData['source_external_id'],
                        'originalExternalId' => $rawContextExternalId !== '' ? $rawContextExternalId : null,
                    ];
                }
                $canonicalContextIdByTempId[$tempId] = $this->canonicalRepository->saveContext($canonicalContext, $authenticatedUserId);
            }

            foreach (array_values($questions) as $questionPosition => $question) {
                if (!is_array($question)) {
                    $diagnostic = [
                        'code' => 'invalid_item_contract',
                        'message' => 'O item da importacao nao e um objeto de questao valido.',
                    ];
                    $itemFailures[] = [
                        'questionNumber' => null,
                        'tempId' => null,
                        'code' => $diagnostic['code'],
                        'message' => $diagnostic['message'],
                    ];
                    $this->repository->recordExamQuestionImportTraceItem($importTraceId, [
                        'examId' => $examId,
                        'status' => 'failed',
                        'diagnosticCode' => $diagnostic['code'],
                        'diagnosticMessage' => $diagnostic['message'],
                    ]);
                    continue;
                }

                $savepoint = 'question_import_' . $questionPosition;
                $this->repository->createSavepoint($savepoint);
                try {

                $questionSource = is_array($question['source'] ?? null) ? $question['source'] : [];
                $contextTempId = trim((string) (
                    $questionSource['questionGroupId']
                    ?? $questionSource['contextTempId']
                    ?? $question['grupoQuestaoTempId']
                    ?? $question['contextTempId']
                    ?? $question['contextKey']
                    ?? ''
                ));
                if ($contextTempId !== '' && !isset($groupIdByTempId[$contextTempId])) {
                    throw new InvalidArgumentException(
                        'A questao referencia um contexto que nao existe neste lote: ' . $contextTempId . '.'
                    );
                }
                if ($contextTempId !== '' && isset($groupIdByTempId[$contextTempId])) {
                    $question['grupoQuestaoId'] = $groupIdByTempId[$contextTempId];
                    $question['grupo_questao_id'] = $groupIdByTempId[$contextTempId];
                }
                if ($contextTempId !== '' && isset($canonicalContextIdByTempId[$contextTempId])) {
                    $question['canonicalContextId'] = $canonicalContextIdByTempId[$contextTempId];
                }

                $question['provaId'] = $examId;
                $question['prova_id'] = $examId;
                $question['questionOrigin'] = 'exam';
                $question['question_origin'] = 'exam';
                $questionFocusItems = $this->readBulkQuestionFocusItems($question);
                if ($questionFocusItems === [] && is_array($focusTaxonomy)) {
                    $question['carreiras'] = [$focusTaxonomy];
                }
                $question['bancas'] = $this->mergeTaxonomyList(
                    $question['bancas'] ?? [],
                    $this->taxonomyPayloadFromFilter('banca', $examRecord['banca_id'], $examRecord['banca_name'] ?? $examPayload['agency'] ?? $examPayload['banca'] ?? '')
                );
                $sourceNames = $this->normalizeImportedExamOrganizations($examPayload, $question);
                if ($sourceNames === []) {
                    $sourceNames = is_array($examRecord['source_names'] ?? null) ? $examRecord['source_names'] : [];
                }
                $question['orgaos'] = $this->mergeTaxonomyList(
                    $question['orgaos'] ?? [],
                    $this->taxonomyPayloadsFromFilterNames('orgao', $sourceNames)
                );
                $roleNames = $this->normalizeImportedExamRoles($examPayload, $question);
                if ($roleNames === []) {
                    $roleNames = is_array($examRecord['role_names'] ?? null) ? $examRecord['role_names'] : [];
                }
                $question['cargos'] = $this->mergeTaxonomyList(
                    $question['cargos'] ?? [],
                    $this->taxonomyPayloadsFromFilterNames('cargo', $roleNames)
                );
                $question['niveis'] = $this->mergeTaxonomyList($question['niveis'] ?? [], $this->taxonomyPayloadFromFilter('nivel', $examRecord['nivel_id'], $examPayload['level'] ?? $examPayload['nivel'] ?? ''));
                $question['tiposProva'] = $this->mergeTaxonomyList($question['tiposProva'] ?? [], $this->taxonomyPayloadFromFilter('tipo_prova', $examRecord['tipo_prova_id'], $examPayload['examType'] ?? $examPayload['tipoProva'] ?? ''));
                $question['anos'] = $question['anos'] ?? [(int) $examRecord['ano']];

                // Esta rota representa a confirmacao de publicacao do lote.
                // Revisao pendente continua em `review`, mas nunca transforma
                // uma questao efetivamente publicada em rascunho privado.
                $question = $this->forceImportedQuestionPublication($question);
                $question = $this->persistQuestionRichTextImages($question);
                $validatedQuestion = $this->validator->validateSavePayload($question);
                $importIdentity = $this->buildImportedQuestionIdentity($validatedQuestion, $examRecord);
                $batchDuplicateKey = $this->buildImportedQuestionBatchKey($importIdentity);
                if (isset($seenImportKeys[$batchDuplicateKey])) {
                    $duplicate = [
                        'reason' => 'duplicate_in_batch',
                        'questionNumber' => $importIdentity['source_question_number'],
                        'tempId' => $question['tempId'] ?? null,
                    ];
                    $duplicateSkipped[] = $duplicate;
                    $this->repository->recordExamQuestionImportTraceItem($importTraceId, [
                        'examId' => $examId,
                        'externalKey' => $question['tempId'] ?? null,
                        'questionNumber' => $importIdentity['source_question_number'],
                        'status' => 'duplicate',
                        'reason' => $duplicate['reason'],
                    ]);
                    $this->repository->releaseSavepoint($savepoint);
                    continue;
                }
                $seenImportKeys[$batchDuplicateKey] = true;

                $existingQuestion = $this->repository->findQuestionByImportIdentity(
                    $importIdentity['import_fingerprint'],
                    $importIdentity['source_exam_key'],
                    $importIdentity['source_question_number'],
                    $importIdentity['source_provider'],
                    $importIdentity['source_external_id']
                );
                $updatingExistingQuestion = false;
                if ($existingQuestion !== null) {
                    $existingStatus = strtolower(trim((string) ($existingQuestion['publish_status'] ?? '')));
                    if (in_array($existingStatus, ['published', 'publicado'], true)) {
                        $duplicate = [
                            'reason' => 'already_published',
                            'questionId' => $existingQuestion['id'] ?? null,
                            'questionNumber' => $importIdentity['source_question_number'],
                            'tempId' => $question['tempId'] ?? null,
                        ];
                        $duplicateSkipped[] = $duplicate;
                        $this->repository->recordExamQuestionImportTraceItem($importTraceId, [
                            'examId' => $examId,
                            'questionId' => $existingQuestion['id'] ?? null,
                            'externalKey' => $question['tempId'] ?? null,
                            'questionNumber' => $importIdentity['source_question_number'],
                            'status' => 'duplicate',
                            'reason' => $duplicate['reason'],
                        ]);
                        $this->repository->releaseSavepoint($savepoint);
                        continue;
                    }

                    // O ID externo identifica a mesma questão. Um rascunho já
                    // existente deve ser atualizado e publicado, nunca inserido
                    // novamente nem ignorado como se já estivesse concluído.
                    $validatedQuestion['id'] = (int) $existingQuestion['id'];
                    $updatingExistingQuestion = true;
                }

                $validatedQuestion = array_merge($validatedQuestion, $importIdentity);
                [$questionId, $createdTaxonomies] = $this->persistValidatedQuestion($validatedQuestion, $authenticatedUserId);
                $createdQuestionIds[] = $questionId;
                if ($importIdentity['source_question_number'] !== '') {
                    $createdQuestionIdBySourceNumber[$importIdentity['source_question_number']] = (int) $questionId;
                }
                foreach ($createdTaxonomies as $taxonomy) {
                    $newTaxonomies[] = $taxonomy;
                }
                $this->repository->recordExamQuestionImportTraceItem($importTraceId, [
                    'examId' => $examId,
                    'questionId' => $questionId,
                    'externalKey' => $question['tempId'] ?? null,
                    'questionNumber' => $importIdentity['source_question_number'],
                    'status' => $updatingExistingQuestion ? 'updated' : 'created',
                ]);
                $this->repository->releaseSavepoint($savepoint);
                } catch (Throwable $questionError) {
                    $this->repository->rollbackToSavepoint($savepoint);
                    $this->repository->releaseSavepoint($savepoint);
                    $source = is_array($question['source'] ?? null) ? $question['source'] : [];
                    $diagnostic = $this->buildSanitizedBulkImportDiagnostic($questionError);
                    $itemFailures[] = [
                        'questionNumber' => $source['questionNumber'] ?? null,
                        'tempId' => $question['tempId'] ?? null,
                        'code' => $diagnostic['code'],
                        'message' => $diagnostic['message'],
                    ];
                    $this->repository->recordExamQuestionImportTraceItem($importTraceId, [
                        'examId' => $examId,
                        'externalKey' => $question['tempId'] ?? null,
                        'questionNumber' => $source['questionNumber'] ?? null,
                        'status' => 'failed',
                        'diagnosticCode' => $diagnostic['code'],
                        'diagnosticMessage' => $diagnostic['message'],
                    ]);
                    continue;
                }
            }

            foreach ($contextQuestionNumbersByTempId as $tempId => $questionNumbers) {
                if (!isset($groupIdByTempId[$tempId]) || $questionNumbers === []) {
                    continue;
                }

                $linkedQuestionIds = [];
                foreach ($questionNumbers as $questionNumber) {
                    if (isset($createdQuestionIdBySourceNumber[$questionNumber])) {
                        $linkedQuestionIds[] = $createdQuestionIdBySourceNumber[$questionNumber];
                    }
                }

                if ($linkedQuestionIds !== []) {
                    $this->repository->syncQuestionGroupLinks($groupIdByTempId[$tempId], $linkedQuestionIds);
                    if (isset($canonicalContextIdByTempId[$tempId])) {
                        foreach ($linkedQuestionIds as $linkedQuestionId) {
                            $this->canonicalRepository->linkQuestionContext((int) $canonicalContextIdByTempId[$tempId], (int) $linkedQuestionId, 'shared');
                        }
                    }
                }
            }

            // O campo legado questions.prova_id e a relacao canonica question_provas
            // precisam ser gravados juntos. A UI administrativa usa a relacao canonica
            // para montar a prova vinculada; sem esta verificacao uma importacao poderia
            // parecer concluida, mas deixar cards sem prova no retorno.
            $createdQuestionProvas = $this->repository->listQuestionProvasByIds($createdQuestionIds);
            $unlinkedQuestionIds = array_values(array_filter(
                $createdQuestionIds,
                static fn ($questionId): bool => empty($createdQuestionProvas[(string) $questionId] ?? [])
            ));
            if ($unlinkedQuestionIds !== []) {
                throw new RuntimeException('A importacao nao conseguiu vincular todas as questoes a prova canonica.');
            }

            $this->commitIfNeeded();
        } catch (Throwable $e) {
            $this->rollback();
            $diagnostic = $this->buildSanitizedBulkImportDiagnostic($e);
            $this->repository->finishExamQuestionImportTrace($importTraceId, 'failed', [
                'createdCount' => count($createdQuestionIds),
                'duplicateCount' => count($duplicateSkipped),
                'failedCount' => count($itemFailures) + 1,
                'processedCount' => count($createdQuestionIds) + count($duplicateSkipped) + count($itemFailures),
                'errorMessage' => $diagnostic['message'],
            ]);
            throw $e;
        }
        $this->repository->finishExamQuestionImportTrace(
            $importTraceId,
            $itemFailures === [] ? 'done' : 'review',
            [
                'createdCount' => count($createdQuestionIds),
                'duplicateCount' => count($duplicateSkipped),
                'failedCount' => count($itemFailures),
                'processedCount' => count($createdQuestionIds) + count($duplicateSkipped) + count($itemFailures),
            ]
        );
        if ($createdQuestionIds !== []) {
            $this->publicPageCache->invalidate();
        }

        $filters = $this->repository->listQuestionFiltersByIds($createdQuestionIds);
        $createdQuestions = [];
        foreach ($createdQuestionIds as $questionId) {
            $row = $this->repository->findQuestionById($questionId);
            if ($row) {
                $createdQuestions[] = $this->normalizeQuestionRow(
                    $row,
                    null,
                    0,
                    $filters[(string) $questionId] ?? [],
                    $createdQuestionProvas[(string) $questionId] ?? [],
                    null,
                    true,
                    true,
                    true
                );
            }
        }

        return [
            'success' => true,
            'exam' => $exam ?? null,
            'count' => count($createdQuestions),
            'created' => $createdQuestions,
            'contexts' => $groupIdByTempId,
            'duplicatesSkipped' => $duplicateSkipped,
            'duplicates_skipped' => $duplicateSkipped,
            'skippedDuplicateCount' => count($duplicateSkipped),
            'skipped_duplicate_count' => count($duplicateSkipped),
            'newTaxonomies' => $newTaxonomies,
            'new_taxonomies' => $newTaxonomies,
            'itemFailures' => $itemFailures,
            'item_failures' => $itemFailures,
            'importTraceId' => $importTraceId,
        ];
    }

    /**
     * Processa provas independentes em uma unica resposta HTTP. Cada prova conserva
     * sua propria transacao, evitando que uma falha editorial descarte os demais lotes.
     */
    public function bulkImportQuestionBatches(string $authenticatedUserId, bool $isAdmin, array $payload): array
    {
        $this->assertAdmin($authenticatedUserId, $isAdmin);
        if (($payload['schemaVersion'] ?? null) !== 'question-import.v2') {
            throw new InvalidArgumentException('Contrato de importacao invalido. Informe schemaVersion question-import.v2.');
        }
        $batches = is_array($payload['batches'] ?? null) ? array_values($payload['batches']) : [];
        if ($batches === []) throw new InvalidArgumentException('Informe ao menos um lote de questoes.');
        if (count($batches) > 50) throw new InvalidArgumentException('O lote unificado aceita no maximo 50 provas por requisicao.');

        $results = [];
        $created = [];
        $duplicates = [];
        $failures = [];
        foreach ($batches as $position => $batch) {
            if (!is_array($batch)) {
                $failures[] = ['clientKey' => (string) $position, 'message' => 'Lote de prova invalido.'];
                continue;
            }
            $clientKey = trim((string) ($batch['clientKey'] ?? $batch['client_key'] ?? $position));
            $batchPayload = is_array($batch['payload'] ?? null) ? $batch['payload'] : $batch;
            $batchPayload['schemaVersion'] = 'question-import.v2';
            try {
                $result = $this->bulkImportQuestions($authenticatedUserId, $isAdmin, $batchPayload);
                $result['clientKey'] = $clientKey;
                $results[] = $result;
                $created = array_merge($created, is_array($result['created'] ?? null) ? $result['created'] : []);
                $duplicates = array_merge($duplicates, is_array($result['duplicatesSkipped'] ?? null) ? $result['duplicatesSkipped'] : []);
                foreach (is_array($result['itemFailures'] ?? null) ? $result['itemFailures'] : [] as $failure) {
                    $failures[] = ['clientKey' => $clientKey] + (is_array($failure) ? $failure : []);
                }
            } catch (Throwable $error) {
                $diagnostic = $this->buildSanitizedBulkImportDiagnostic($error);
                $failures[] = ['clientKey' => $clientKey, 'message' => $diagnostic['message'], 'code' => $diagnostic['code']];
                $results[] = ['clientKey' => $clientKey, 'success' => false, 'count' => 0, 'created' => [], 'itemFailures' => [$diagnostic]];
            }
        }

        return [
            'success' => true,
            'count' => count($created),
            'created' => $created,
            'skippedDuplicateCount' => count($duplicates),
            'duplicatesSkipped' => $duplicates,
            'itemFailures' => $failures,
            'batches' => $results,
        ];
    }

    /**
     * Cria ou atualiza somente o post/registro de prova importada.
     *
     * Este caminho nao processa questoes, contextos nem imagens do lote. As questoes
     * devem ser publicadas depois e vinculadas a esta prova.
     *
     * @since 1.0.0
     */
    public function createImportedExam(string $authenticatedUserId, bool $isAdmin, array $payload): array
    {
        $this->assertAdmin($authenticatedUserId, $isAdmin);

        $focus = $this->normalizeBulkImportFocus($payload['focus'] ?? []);
        if ($focus['name'] === '') {
            throw new InvalidArgumentException('Selecione um foco para publicar a prova.');
        }

        $examPayload = is_array($payload['exam'] ?? null) ? $payload['exam'] : [];
        $this->db->beginTransaction();

        try {
            $focusId = $this->ensureFilterId('carreira', $focus['name'], $focus['slug'], 0, 1, $focus['id']);
            $examRecord = $this->withPublicationOwnership(
                $this->buildImportedExamRecord($examPayload, [], $focusId, ''),
                $authenticatedUserId
            );
            $this->assertCanManageImportedExam($authenticatedUserId, $examRecord);
            $examId = (int) $this->repository->saveImportedExam($examRecord);
            if ($examId <= 0) {
                throw new RuntimeException('A prova precisa ser salva antes de vincular questoes.');
            }

            $exam = $this->buildImportedExamResponse($examId, $examRecord);
            $this->commitIfNeeded();
        } catch (Throwable $e) {
            $this->rollback();
            throw $e;
        }

        return [
            'success' => true,
            'exam' => $exam,
        ];
    }

    /**
     * Envia edital, gabarito ou prova para armazenamento persistente.
     *
     * @since 1.0.0
     */
    public function uploadExamAttachment(string $authenticatedUserId, bool $isAdmin, ?array $file, string $kind): array
    {
        $this->assertAdmin($authenticatedUserId, $isAdmin);

        $normalizedKind = strtolower(trim($kind));
        if (!in_array($normalizedKind, ['edital', 'gabarito', 'prova'], true)) {
            throw new InvalidArgumentException('Tipo de arquivo da prova invalido.');
        }

        $upload = $this->validator->validateExamAttachmentUpload($file);
        $extension = (string) ($upload['extension'] ?? 'bin');
        $filename = $normalizedKind . '-' . date('YmdHis') . '-' . bin2hex(random_bytes(6)) . '.' . $extension;
        $originalName = trim((string) ($upload['originalName'] ?? $file['name'] ?? ''));
        $mimeType = (string) ($upload['mimeType'] ?? $file['type'] ?? 'application/octet-stream');
        $stored = (new ObjectStorage())->storeUploadedFile(
            (string) ($file['tmp_name'] ?? ''),
            'exams/' . $filename,
            $mimeType
        );
        $labels = [
            'edital' => 'Edital',
            'gabarito' => 'Gabarito',
            'prova' => 'Prova',
        ];

        return [
            'file' => [
                'kind' => $normalizedKind,
                'label' => $labels[$normalizedKind],
                'name' => $originalName !== '' ? $originalName : $filename,
                'url' => $stored['url'],
                'storageKey' => $stored['storageKey'],
                'storageDriver' => $stored['driver'],
                'mimeType' => $mimeType,
                'size' => (int) $stored['size'],
                'uploadedAt' => date(DATE_ATOM),
            ],
        ];
    }

    public function getQuestionForEdit(string $authenticatedUserId, bool $isAdmin, array $query): array
    {
        $this->assertAdmin($authenticatedUserId, $isAdmin);
        $identity = $this->validator->validateQuestionIdentityQuery($query, 'ID da questao nao fornecido.');
        $row = $this->repository->findQuestionById($identity['questionId']);
        if ($row === null) {
            throw new OutOfBoundsException('Questao nao encontrada.');
        }

        $id = (string) ($row['id'] ?? $identity['questionId']);
        $filters = $this->repository->listQuestionFiltersByIds([$id]);
        $provas = $this->repository->listQuestionProvasByIds([$id]);
        $stats = $this->repository->listQuestionStatsMap([$id]);
        $counts = $this->repository->listQuestionCommentCounts([$id]);

        return $this->normalizeQuestionRow($row, $stats[$id] ?? null, $counts[$id] ?? 0, $filters[$id] ?? [], $provas[$id] ?? [], null, true, true, true);
    }

    public function deleteQuestion(string $authenticatedUserId, bool $isAdmin, array $query): void
    {
        $this->assertAdmin($authenticatedUserId, $isAdmin);
        $identity = $this->validator->validateQuestionIdentityQuery($query, 'ID da questao nao fornecido.');
        $this->assertCanManageOwnedRecord(
            $authenticatedUserId,
            $identity['questionId'],
            $this->repository->findQuestionOwnershipById($identity['questionId']),
            'Questao nao encontrada.',
            'Staff so pode excluir questoes publicadas por ele.'
        );
        if ($this->repository->deleteQuestionById($identity['questionId']) < 1) {
            throw new OutOfBoundsException('Questao nao encontrada.');
        }
        $this->publicPageCache->invalidate();
    }

    public function listQuestionGroups(string $authenticatedUserId, bool $isAdmin, array $query): array
    {
        $this->assertAdmin($authenticatedUserId, $isAdmin);
        $keyword = trim((string) ($query['keyword'] ?? $query['search'] ?? ''));
        $limit = max(1, min(300, (int) ($query['limit'] ?? 100)));

        return [
            'items' => array_map(
                fn (array $row): array => $this->normalizeQuestionGroup($row),
                $this->repository->listQuestionGroups($keyword, $limit)
            ),
        ];
    }

    public function saveQuestionGroup(string $authenticatedUserId, bool $isAdmin, array $payload): array
    {
        $this->assertAdmin($authenticatedUserId, $isAdmin);
        $data = $this->validator->validateQuestionGroupPayload($payload);
        if (!empty($data['id'])) {
            $this->assertCanManageOwnedRecord(
                $authenticatedUserId,
                (int) $data['id'],
                $this->repository->findQuestionGroupOwnershipById((int) $data['id']),
                'Contexto de questoes nao encontrado.',
                'Staff so pode editar contextos publicados por ele.'
            );
        }
        if (str_contains($data['texto'], 'data:image/')) {
            $data['texto'] = $this->persistInlineQuestionAssetImages($data['texto']);
        }
        $data['assets'] = $this->persistQuestionContextAssets($data['assets']);
        $data['created_by_user_id'] = $authenticatedUserId;
        $data['updated_by_user_id'] = $authenticatedUserId;
        $data['prova_id'] = $this->repository->resolveQuestionGroupProvaId(
            $data['prova_id'],
            $data['question_ids'],
            $data['id']
        );

        $this->repository->listQuestionGroups('', 1);

        $this->db->beginTransaction();
        try {
            $groupId = $this->repository->saveQuestionGroup($data);
            if (is_array($data['question_ids'])) {
                $this->repository->syncQuestionGroupLinks($groupId, $data['question_ids']);
            }
            $canonicalContext = is_array($data['canonical_context'] ?? null) ? $data['canonical_context'] : [];
            // Contextos criados no editor manual recebem uma chave estável do
            // próprio registro. Não aceite tempIds arbitrários que possam
            // coincidir com o contexto de outro usuário.
            $canonicalContext['tempId'] = 'legacy_group_' . $groupId;
            $canonicalContext['provaId'] = $data['prova_id'];
            $canonicalContext['assets'] = $data['assets'];
            $canonicalContextId = $this->canonicalRepository->saveContext($canonicalContext, $authenticatedUserId);
            foreach (is_array($data['question_ids']) ? $data['question_ids'] : [] as $questionId) {
                $this->canonicalRepository->linkQuestionContext($canonicalContextId, (int) $questionId, (string) ($canonicalContext['type'] ?? 'shared'));
            }
            $this->commitIfNeeded();
        } catch (Throwable $e) {
            $this->rollback();
            throw $e;
        }
        $this->publicPageCache->invalidate();

        $row = $this->repository->findQuestionGroupById($groupId);
        if ($row === null) {
            throw new OutOfBoundsException('Contexto de questoes nao encontrado.');
        }

        return $this->normalizeQuestionGroup($row) + [
            'body' => $data['texto'],
            'reference' => (string) ($data['canonical_context']['reference'] ?? ''),
            'sourcePage' => $data['canonical_context']['sourcePage'] ?? null,
        ];
    }

    public function uploadQuestionGroupImage(string $authenticatedUserId, bool $isAdmin, ?array $file): array
    {
        $this->assertAdmin($authenticatedUserId, $isAdmin);
        $extension = $this->validator->validateQuestionGroupImageUpload($file);
        $filename = 'context-' . date('YmdHis') . '-' . bin2hex(random_bytes(6)) . '.' . $extension;
        $mimeType = (string) ($file['type'] ?? ('image/' . ($extension === 'jpg' ? 'jpeg' : $extension)));
        $stored = (new ObjectStorage())->storeUploadedFile(
            (string) ($file['tmp_name'] ?? ''),
            'question-contexts/' . $filename,
            $mimeType
        );

        return [
            'url' => $stored['url'],
            'image_url' => $stored['url'],
            'imageUrl' => $stored['url'],
            'storageKey' => $stored['storageKey'],
            'storageDriver' => $stored['driver'],
        ];
    }

    private function buildQuestionListItemV2(
        array $row,
        array $filters,
        ?array $stats,
        ?array $userAnswer,
        bool $isSaved,
        bool $includeUserState,
        int $commentsCount = 0
    ): array
    {
        $buckets = $this->partitionFilters($filters);
        $attempts = max(0, (int) ($stats['totalAttempts'] ?? 0));
        $correct = max(0, (int) ($stats['correctCount'] ?? 0));
        $wrong = max(0, (int) ($stats['wrongCount'] ?? 0));

        $item = [
            'id' => (int) ($row['id'] ?? 0),
            'statementPreview' => $this->truncateQuestionPreview((string) ($row['enunciado_clean'] ?? ''), 180),
            'type' => $this->canonicalQuestionTypeForOutput((string) ($row['tipo'] ?? '')),
            'difficulty' => $this->difficultyLabel((int) ($row['dificuldade'] ?? 2)),
            'hasImage' => !empty($row['has_image']),
            'taxonomySummary' => $this->buildTaxonomySummaryV2($buckets),
            'examSummary' => !empty($row['exam_id']) ? [
                'id' => (int) $row['exam_id'],
                'name' => (string) ($row['exam_name'] ?? ''),
                'year' => is_numeric($row['exam_year'] ?? null) ? (int) $row['exam_year'] : null,
            ] : null,
            'stats' => [
                'attempts' => $attempts,
                'correct' => $correct,
                'wrong' => $wrong,
                'accuracy' => $attempts > 0 ? round(($correct / $attempts) * 100, 2) : 0,
            ],
            'publication' => [
                'status' => (string) ($row['publish_status'] ?? 'draft'),
                'visibility' => (string) ($row['visibility_status'] ?? 'public'),
            ],
            'publishedAt' => $row['published_sort_at'] ?? $row['published_at'] ?? null,
            'createdAt' => $row['created_at'] ?? null,
            'engagement' => [
                'commentsCount' => max(0, $commentsCount),
            ],
        ];

        if ($includeUserState) {
            $item['userState'] = [
                'answered' => $userAnswer !== null,
                'isSaved' => $isSaved,
                'selectedOptionId' => is_numeric($userAnswer['selectedOptionId'] ?? null)
                    ? (int) $userAnswer['selectedOptionId']
                    : null,
                'selectedOptionIndex' => $userAnswer !== null
                    ? (int) ($userAnswer['selectedOptionIndex'] ?? 0)
                    : null,
            ];
        }

        return $item;
    }

    private function questionListCursorScope(array $filters, ?string $authenticatedUserId): string
    {
        $normalized = $this->normalizeCursorScopeValue($filters);
        $privateUser = (!empty($filters['onlySaved']) || !empty($filters['excludeAnswered']))
            ? (string) $authenticatedUserId
            : '';
        $payload = json_encode([
            'filters' => $normalized,
            'user' => $privateUser,
        ], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);

        return 'questions.public.v2.' . hash('sha256', is_string($payload) ? $payload : '');
    }

    private function normalizeCursorScopeValue(mixed $value): mixed
    {
        if (!is_array($value)) {
            return $value;
        }
        if (array_is_list($value)) {
            $normalized = array_map(
                fn (mixed $item): mixed => $this->normalizeCursorScopeValue($item),
                $value
            );
            usort($normalized, static fn (mixed $a, mixed $b): int => strcmp(
                (string) json_encode($a),
                (string) json_encode($b)
            ));
            return $normalized;
        }
        ksort($value);
        foreach ($value as $key => $item) {
            $value[$key] = $this->normalizeCursorScopeValue($item);
        }
        return $value;
    }

    private function buildQuestionDetailV2(
        array $row,
        ?array $aggregate,
        array $filters,
        ?array $stats,
        ?array $userAnswer,
        bool $includeAnswer,
        bool $canViewTeacherComments,
        bool $canViewDetailedAnalysis,
        array $exams = [],
        int $commentsCount = 0
    ): array {
        $legacy = $this->decodeQuestionJson($row['data_json'] ?? null);
        $buckets = $this->partitionFilters($filters);
        $alternatives = $this->resolveAlternativesForV2($row, $aggregate);
        $questionAssets = $this->normalizeAssetsV2(is_array($aggregate['assets'] ?? null) ? $aggregate['assets'] : []);
        $legacyImage = trim((string) ($legacy['imageUrl'] ?? $legacy['image_url'] ?? ''));
        if ($questionAssets === [] && $legacyImage !== '' && !$this->isTransientQuestionAssetUrl($legacyImage)) {
            $questionAssets[] = [
                'tempId' => 'legacy_statement_image',
                'type' => 'image',
                'usage' => 'statement',
                'url' => $legacyImage,
                'base64' => '',
                'alt' => 'Imagem da questao.',
                'caption' => '',
                'sourcePage' => null,
                'order' => 1,
            ];
        }

        $attempts = max(0, (int) ($stats['totalAttempts'] ?? $stats['total_attempts'] ?? 0));
        $correct = max(0, (int) ($stats['correctCount'] ?? $stats['correct_count'] ?? 0));
        $wrong = max(0, (int) ($stats['wrongCount'] ?? $stats['wrong_count'] ?? 0));
        $question = [
            'id' => (int) ($row['id'] ?? 0),
            'source' => [
                'origin' => !empty($row['prova_id']) ? 'exam' : (string) ($legacy['questionOrigin'] ?? $legacy['question_origin'] ?? 'platform'),
                'examId' => is_numeric($row['prova_id'] ?? null) ? (int) $row['prova_id'] : null,
                'questionNumber' => $this->nullableInt($row['source_question_number'] ?? $legacy['sourceQuestionNumber'] ?? $legacy['questionNumber'] ?? null),
                'questionGroupId' => is_numeric($row['grupo_questao_id'] ?? null) ? (int) $row['grupo_questao_id'] : null,
                'sourcePage' => $this->nullableInt($row['source_page'] ?? $legacy['sourcePage'] ?? null),
            ],
            'content' => [
                'statement' => (string) ($row['enunciado'] ?? ''),
                'statementClean' => (string) ($row['enunciado_clean'] ?? ''),
                'supportText' => (string) ($row['intro_text'] ?? $legacy['introText'] ?? ''),
                'reference' => (string) ($row['reference_text'] ?? $legacy['referenceText'] ?? $legacy['reference_text'] ?? ''),
            ],
            'assets' => $questionAssets,
            'contexts' => $this->normalizeContextsV2(is_array($aggregate['contexts'] ?? null) ? $aggregate['contexts'] : []),
            'filters' => $this->buildFiltersV2($buckets),
            'type' => $this->canonicalQuestionTypeForOutput((string) ($row['tipo'] ?? '')),
            'difficulty' => $this->difficultyLabel((int) ($row['dificuldade'] ?? 2)),
            'alternatives' => $alternatives,
            'publication' => [
                'status' => (string) ($row['publish_status'] ?? 'draft'),
                'visibility' => (string) ($row['visibility_status'] ?? 'public'),
                'scheduledAt' => $row['scheduled_at'] ?? null,
                'publishedAt' => $row['published_at'] ?? null,
            ],
            'stats' => [
                'totalAttempts' => $attempts,
                'correctCount' => $correct,
                'wrongCount' => $wrong,
                'accuracy' => $attempts > 0 ? round(($correct / $attempts) * 100, 2) : 0,
            ],
            'examSummary' => array_map(static fn (array $exam): array => [
                'id' => (int) ($exam['id'] ?? 0),
                'name' => (string) ($exam['nome'] ?? $exam['name'] ?? ''),
                'slug' => (string) ($exam['slug'] ?? ''),
                'year' => is_numeric($exam['ano'] ?? null) ? (int) $exam['ano'] : null,
                'questionNumber' => is_numeric($exam['numeroNaProva'] ?? null)
                    ? (int) $exam['numeroNaProva']
                    : null,
                'booklet' => $exam['caderno'] ?? null,
                'bookletType' => $exam['tipoCaderno'] ?? null,
                'bookletColor' => $exam['corCaderno'] ?? null,
            ], array_values($exams)),
            'engagement' => [
                'commentsCount' => max(0, $commentsCount),
            ],
        ];

        if ($userAnswer !== null) {
            $selectedOptionIndex = $userAnswer['selectedOptionIndex'] ?? $userAnswer['selected_option_index'] ?? null;
            $isCorrect = $userAnswer['isCorrect'] ?? $userAnswer['is_correct'] ?? null;
            $question['userAnswer'] = [
                'selectedOptionIndex' => $selectedOptionIndex !== null ? (int) $selectedOptionIndex : null,
                'selectedAlternativeId' => $this->alternativeIdByIndex($alternatives, $selectedOptionIndex),
                'isCorrect' => $isCorrect !== null ? (bool) $isCorrect : null,
                'answeredAt' => $userAnswer['createdAt'] ?? $userAnswer['created_at'] ?? null,
            ];
        }

        if ($includeAnswer) {
            $question['answer'] = $this->resolveAnswerForV2($row, $aggregate, $alternatives);
            $question['review'] = [
                'needsReview' => false,
                'statusReasons' => [],
                'annulled' => !empty($row['anulada']),
                'outdated' => !empty($row['desatualizada']),
            ];
        }

        if ($canViewTeacherComments || $canViewDetailedAnalysis) {
            $question['editorial'] = $this->resolveEditorialForV2($aggregate, $legacy);
        }

        return $this->outputPolicy->forRead(
            $question,
            $includeAnswer,
            $canViewTeacherComments,
            $canViewDetailedAnalysis
        );
    }

    private function loadCanonicalAggregateForRead(int $questionId): ?array
    {
        if (!$this->canonicalRepository->isAvailable()) {
            return null;
        }

        try {
            return $this->canonicalRepository->loadQuestionAggregate($questionId);
        } catch (Throwable) {
            return null;
        }
    }

    /** @return array<int, array<string, mixed>> */
    private function loadCanonicalAggregatesForRead(array $questionIds): array
    {
        if (!$this->canonicalRepository->isAvailable()) {
            return [];
        }

        try {
            return $this->canonicalRepository->loadQuestionAggregates($questionIds);
        } catch (Throwable) {
            return [];
        }
    }

    private function resolveAlternativesForV2(array $row, ?array $aggregate): array
    {
        $legacy = $this->decodeQuestionJson($row['data_json'] ?? null);
        $source = is_array($aggregate['alternatives'] ?? null) && $aggregate['alternatives'] !== []
            ? $aggregate['alternatives']
            : $this->canonicalAlternativesFromItems($this->normalizeItems($legacy['itens'] ?? []));

        $alternatives = [];
        foreach (array_values($source) as $index => $alternative) {
            if (!is_array($alternative)) {
                continue;
            }
            $label = trim((string) ($alternative['label'] ?? chr(65 + $index)));
            $tempId = trim((string) ($alternative['tempId'] ?? $alternative['id'] ?? ''));
            if ($tempId === '') {
                $tempId = 'alt_' . strtolower($label !== '' ? $label : chr(65 + $index));
            }
            $text = (string) ($alternative['text'] ?? $alternative['body'] ?? '');
            $alternatives[] = [
                'id' => $tempId,
                'tempId' => $tempId,
                'order' => (int) ($alternative['order'] ?? $index + 1),
                'label' => $label !== '' ? $label : chr(65 + $index),
                'text' => $text,
                'textClean' => (string) ($alternative['textClean'] ?? $alternative['bodyClean'] ?? strip_tags($text)),
                'assets' => $this->normalizeAssetsV2(is_array($alternative['assets'] ?? null) ? $alternative['assets'] : []),
            ];
        }

        return $alternatives;
    }

    private function resolveAnswerForV2(array $row, ?array $aggregate, array $alternatives): array
    {
        if (is_array($aggregate['answer'] ?? null)) {
            $answer = $aggregate['answer'];
            return [
                'mode' => (string) ($answer['mode'] ?? 'single'),
                'raw' => (string) ($answer['raw'] ?? ''),
                'correctAlternativeTempIds' => array_values(array_filter(array_map('strval', (array) ($answer['correctAlternativeTempIds'] ?? [])))),
            ];
        }

        $answerIndex = is_numeric($row['resposta_correta_item_index'] ?? null) ? (int) $row['resposta_correta_item_index'] : 0;
        $alternative = $alternatives[$answerIndex] ?? null;
        $alternativeId = is_array($alternative) ? (string) ($alternative['tempId'] ?? $alternative['id'] ?? '') : '';

        return [
            'mode' => 'single',
            'raw' => is_array($alternative) ? (string) ($alternative['label'] ?? '') : '',
            'correctAlternativeTempIds' => $alternativeId !== '' ? [$alternativeId] : [],
        ];
    }

    private function resolveEditorialForV2(?array $aggregate, array $legacy): array
    {
        $editorials = is_array($aggregate['editorial'] ?? null) ? $aggregate['editorial'] : [];
        if ($editorials !== []) {
            return array_values(array_map(static fn (array $editorial): array => [
                'type' => (string) ($editorial['type'] ?? ''),
                'title' => (string) ($editorial['title'] ?? ''),
                'body' => (string) ($editorial['body'] ?? ''),
                'status' => (string) ($editorial['status'] ?? 'draft'),
            ], $editorials));
        }

        return [
            [
                'type' => 'teacher_comment',
                'title' => '',
                'body' => (string) ($legacy['teacherComment'] ?? ''),
                'status' => 'draft',
            ],
            [
                'type' => 'detailed_analysis',
                'title' => '',
                'body' => (string) ($legacy['detailedComment'] ?? ''),
                'status' => 'draft',
            ],
        ];
    }

    private function normalizeContextsV2(array $contexts): array
    {
        return array_values(array_map(fn (array $context): array => [
            'id' => is_numeric($context['id'] ?? null) ? (int) $context['id'] : null,
            'tempId' => (string) ($context['tempId'] ?? $context['externalKey'] ?? ''),
            'type' => (string) ($context['type'] ?? 'shared'),
            'body' => (string) ($context['body'] ?? ''),
            'bodyClean' => (string) ($context['bodyClean'] ?? strip_tags((string) ($context['body'] ?? ''))),
            'reference' => (string) ($context['reference'] ?? ''),
            'sourcePage' => $this->nullableInt($context['sourcePage'] ?? null),
            'assets' => $this->normalizeAssetsV2(is_array($context['assets'] ?? null) ? $context['assets'] : []),
        ], $contexts));
    }

    private function normalizeAssetsV2(array $assets): array
    {
        $normalized = [];
        foreach (array_values($assets) as $index => $asset) {
            if (!is_array($asset)) {
                continue;
            }
            $url = trim((string) ($asset['url'] ?? $asset['publicUrl'] ?? $asset['public_url'] ?? ''));
            $base64 = trim((string) ($asset['base64'] ?? ''));
            if ($this->isTransientQuestionAssetUrl($url)) {
                $url = '';
            }
            if ($url === '' && $base64 === '') {
                continue;
            }
            $normalized[] = [
                'tempId' => (string) ($asset['tempId'] ?? $asset['id'] ?? 'asset_' . ($index + 1)),
                'type' => (string) ($asset['type'] ?? 'image'),
                'usage' => (string) ($asset['usage'] ?? 'statement'),
                'url' => $url,
                'base64' => $base64,
                'alt' => (string) ($asset['alt'] ?? ''),
                'caption' => (string) ($asset['caption'] ?? ''),
                'sourcePage' => $this->nullableInt($asset['sourcePage'] ?? $asset['source_page'] ?? null),
                'order' => (int) ($asset['order'] ?? $index + 1),
            ];
        }

        return $normalized;
    }

    private function buildTaxonomySummaryV2(array $buckets): array
    {
        return [
            'subjects' => $this->taxonomyItemsV2($this->filterItemsByTaxonomyLevel($buckets['assuntos'] ?? [], 'materia')),
            'topics' => $this->taxonomyItemsV2($this->filterItemsByTaxonomyLevel($buckets['assuntos'] ?? [], 'topico')),
            'subtopics' => $this->taxonomyItemsV2($this->filterItemsByTaxonomyLevel($buckets['assuntos'] ?? [], 'assunto')),
            'examBoards' => $this->taxonomyItemsV2($buckets['bancas'] ?? []),
            'organizations' => $this->taxonomyItemsV2($buckets['orgaos'] ?? []),
            'roles' => $this->taxonomyItemsV2($buckets['cargos'] ?? []),
            'careers' => $this->taxonomyItemsV2($buckets['carreiras'] ?? []),
            'years' => array_values($buckets['anos'] ?? []),
            'levels' => $this->taxonomyItemsV2($buckets['niveis'] ?? []),
            'examTypes' => $this->taxonomyItemsV2($buckets['tiposProva'] ?? []),
        ];
    }

    private function buildFiltersV2(array $buckets): array
    {
        return $this->buildTaxonomySummaryV2($buckets);
    }

    private function taxonomyItemsV2(array $items): array
    {
        $normalized = [];
        foreach ($items as $item) {
            if (!is_array($item)) {
                continue;
            }
            $label = trim((string) ($item['name'] ?? $item['nome'] ?? $item['label'] ?? ''));
            if ($label === '') {
                continue;
            }
            $normalized[] = [
                'id' => is_numeric($item['id'] ?? null) ? (int) $item['id'] : null,
                'label' => $label,
                'slug' => (string) ($item['slug'] ?? $this->slugify($label)),
                'parentId' => is_numeric($item['parentId'] ?? $item['parent_id'] ?? null) ? (int) ($item['parentId'] ?? $item['parent_id']) : null,
            ];
        }

        return $normalized;
    }

    private function canonicalQuestionTypeForOutput(string $type): string
    {
        $normalized = strtolower(trim($type));
        return match ($normalized) {
            'certo ou errado', 'certo/errado', 'true_false', 'true-false' => 'true_false',
            'multipla escolha', 'multipla-escolha', 'multiple_choice', 'single_choice' => 'single_choice',
            default => $normalized !== '' ? $normalized : 'single_choice',
        };
    }

    private function truncateQuestionPreview(string $text, int $limit): string
    {
        $clean = trim(preg_replace('/\s+/u', ' ', strip_tags($text)) ?? strip_tags($text));
        if (function_exists('mb_strlen') && mb_strlen($clean) > $limit) {
            return rtrim((string) mb_substr($clean, 0, $limit - 1)) . '...';
        }
        if (!function_exists('mb_strlen') && strlen($clean) > $limit) {
            return rtrim(substr($clean, 0, $limit - 1)) . '...';
        }

        return $clean;
    }

    private function alternativeIdByIndex(array $alternatives, mixed $index): ?string
    {
        if (!is_numeric($index)) {
            return null;
        }
        $alternative = $alternatives[(int) $index] ?? null;
        return is_array($alternative) ? (string) ($alternative['tempId'] ?? $alternative['id'] ?? '') : null;
    }

    private function nullableInt(mixed $value): ?int
    {
        return is_numeric($value) ? (int) $value : null;
    }

    public function deleteQuestionGroup(string $authenticatedUserId, bool $isAdmin, array $payload): array
    {
        $this->assertAdmin($authenticatedUserId, $isAdmin);
        $groupId = $this->validator->validateQuestionGroupIdentity($payload);
        $this->assertCanManageOwnedRecord(
            $authenticatedUserId,
            $groupId,
            $this->repository->findQuestionGroupOwnershipById($groupId),
            'Contexto de questoes nao encontrado.',
            'Staff so pode excluir contextos publicados por ele.'
        );
        $deleted = $this->repository->deleteQuestionGroup($groupId);
        if ($deleted < 1) {
            throw new OutOfBoundsException('Contexto de questoes nao encontrado.');
        }

        return ['deleted' => $deleted, 'id' => $groupId];
    }

    public function getQuestionHistory(?array $authenticatedUserPayload, array $query): array
    {
        if (!is_array($authenticatedUserPayload)) {
            return [];
        }

        $authenticatedUserId = trim((string) ($authenticatedUserPayload['user_id'] ?? ''));
        if ($authenticatedUserId === '') {
            return [];
        }

        $data = $this->validator->validateHistoryQuery($query);
        $userId = $this->validator->resolveScopedUserId(
            $authenticatedUserId,
            $data['requestedUserId'],
            (($authenticatedUserPayload['role'] ?? '') === 'admin')
        );

        return array_map(
            static fn (array $row): array => [
                'selectedOptionIndex' => (int) ($row['selected_option_index'] ?? 0),
                'selected_option_index' => (int) ($row['selected_option_index'] ?? 0),
                'isCorrect' => !empty($row['is_correct']),
                'is_correct' => !empty($row['is_correct']),
                'createdAt' => (string) ($row['created_at'] ?? ''),
                'timestamp' => strtotime((string) ($row['created_at'] ?? '')) ?: 0,
            ],
            $this->repository->listQuestionHistory($userId, $data['questionId'])
        );
    }

    public function resetAnswers(string $authenticatedUserId, bool $isAdmin, array $payload): array
    {
        $data = $this->validator->validateScopedUserMutationPayload($payload);
        $userId = $this->validator->resolveScopedUserId($authenticatedUserId, $data['requestedUserId'], $isAdmin);

        return ['deleted' => $this->repository->resetUserAnswers($userId)];
    }

    public function toggleSavedQuestion(string $authenticatedUserId, bool $isAdmin, array $payload): array
    {
        $data = $this->validator->validateScopedUserMutationPayload($payload, true);
        $userId = $this->validator->resolveScopedUserId($authenticatedUserId, $data['requestedUserId'], $isAdmin);

        if ($this->repository->findQuestionById($data['questionId']) === null) {
            throw new OutOfBoundsException('Questao nao encontrada.');
        }

        if ($this->repository->hasSavedQuestion($userId, $data['questionId'])) {
            $this->repository->removeSavedQuestion($userId, $data['questionId']);
            return ['isSaved' => false, 'message' => 'Questao removida dos salvos.'];
        }

        if (!$isAdmin) {
            $this->enforceUsageLimit($userId, 'saved_questions_limit');
        }

        $this->repository->addSavedQuestion($userId, $data['questionId']);
        $reward = $this->repository->grantGamificationEvent(
            $userId,
            'question_saved_for_review',
            'question_saved:' . $userId . ':' . (string) $data['questionId'],
            3,
            0,
            [
                'key' => 'first_saved_question',
                'title' => 'Primeira questao salva',
                'description' => 'Voce salvou uma questao para revisar depois.',
            ],
            ['question_id' => (string) $data['questionId']]
        );

        if (!empty($reward['badge_awarded'])) {
            $this->repository->insertNotification([
                'id' => $this->generateNotificationId(),
                'user_id' => $userId,
                'title' => 'Badge desbloqueado',
                'message' => 'Primeira questao salva: sua revisao ficou organizada.',
                'category' => 'system',
                'type' => 'success',
                'link' => '/profile?tab=achievements',
            ]);
        }

        if (!empty($reward['applied'])) {
            $this->repository->insertNotification([
                'id' => $this->generateNotificationId(),
                'user_id' => $userId,
                'title' => 'Questao salva',
                'message' => 'Voce ganhou +3 XP por salvar uma questao para revisar.',
                'category' => 'system',
                'type' => 'success',
                'link' => '/practice?questionId=' . rawurlencode((string) $data['questionId']),
            ]);
        }

        $after = $this->repository->findUserProgressSnapshot($userId);

        return [
            'isSaved' => true,
            'message' => !empty($reward['applied']) ? 'Questao salva. +3 XP para revisao organizada.' : 'Questao salva.',
            'xpGain' => !empty($reward['applied']) ? 3 : 0,
            'new_xp' => isset($after['xp']) ? (int) $after['xp'] : null,
            'new_level' => isset($after['level']) ? (int) $after['level'] : null,
            'newXp' => isset($after['xp']) ? (int) $after['xp'] : null,
            'newLevel' => isset($after['level']) ? (int) $after['level'] : null,
        ];
    }

    private function normalizeQuestionRows(
        array $rows,
        ?string $userId,
        bool $canViewTeacherComments,
        bool $canViewDetailedAnalysis,
        bool $includeExamCatalog = true,
        bool $includeAnswerKey = false
    ): array
    {
        $ids = $this->extractQuestionIds($rows);
        $stats = $this->repository->listQuestionStatsMap($ids);
        $counts = $this->repository->listQuestionCommentCounts($ids);
        $filters = $this->repository->listQuestionFiltersByIds($ids);
        $provas = $includeExamCatalog
            ? $this->repository->listQuestionProvasByIds($ids)
            : [];
        $answers = $userId ? $this->repository->listLatestUserAnswersMap($userId, $ids) : [];

        $normalized = [];
        foreach ($rows as $row) {
            $id = (string) ($row['id'] ?? '');
            $rowFilters = $filters[$id] ?? [];
            if ($rowFilters === [] && !empty($row['filters_string'])) {
                $rowFilters = $this->parseSerializedFilters((string) $row['filters_string']);
            }
            $normalized[] = $this->normalizeQuestionRow(
                $row,
                $stats[$id] ?? null,
                $counts[$id] ?? 0,
                $rowFilters,
                $provas[$id] ?? [],
                $answers[$id] ?? null,
                $canViewTeacherComments,
                $canViewDetailedAnalysis,
                $includeAnswerKey
            );
        }

        return $normalized;
    }

    private function normalizeQuestionRow(array $row, ?array $stats, int $commentsCount, array $filters, array $provas, ?array $userAnswer, bool $canViewTeacherComments, bool $canViewDetailedAnalysis, bool $includeAnswerKey = false): array
    {
        $data = $this->decodeQuestionJson($row['data_json'] ?? null);
        $canonicalAggregate = null;
        if ($this->canonicalRepository->isAvailable() && is_numeric($row['id'] ?? null)) {
            $canonicalAggregate = $this->canonicalRepository->loadQuestionAggregate((int) $row['id']);
        }
        $items = $this->normalizeItems(
            $canonicalAggregate['alternatives']
                ?? $data['itens']
                ?? $data['items']
                ?? []
        );
        $answerIndex = (int) ($row['resposta_correta_item_index'] ?? $data['correctOptionIndex'] ?? 0);
        $editorials = is_array($canonicalAggregate['editorial'] ?? null) ? $canonicalAggregate['editorial'] : [];
        $teacher = $this->normalizeEditorialText($this->editorialBodyByType($editorials, 'teacher_comment') ?? $data['teacherComment'] ?? $data['teacher_comment'] ?? $data['comentarioProfessor'] ?? '');
        $detailed = $this->normalizeEditorialText($this->editorialBodyByType($editorials, 'detailed_analysis') ?? $data['detailedComment'] ?? $data['detailed_comment'] ?? $data['analiseDetalhada'] ?? '');
        $buckets = $this->partitionFilters($filters);
        $group = $this->resolveQuestionGroup($row);
        $assets = is_array($canonicalAggregate['assets'] ?? null) ? $canonicalAggregate['assets'] : [];
        $imageUrl = trim((string) ($assets[0]['url'] ?? $data['imageUrl'] ?? $data['image_url'] ?? ''));
        if ($this->isTransientQuestionAssetUrl($imageUrl)) {
            $imageUrl = '';
        }
        $origin = (string) ($data['questionOrigin'] ?? $data['question_origin'] ?? '');
        if ($origin === '') {
            $origin = !empty($row['prova_id']) || $provas !== [] ? 'exam' : 'platform';
        }
        $stats = $stats ?: [
            'totalAttempts' => (int) ($row['total_attempts'] ?? 0),
            'correctCount' => (int) ($row['correct_count'] ?? 0),
            'wrongCount' => (int) ($row['wrong_count'] ?? 0),
        ];

        $question = [
            'id' => is_numeric($row['id'] ?? null) ? (int) $row['id'] : ($row['id'] ?? null),
            'enunciado' => (string) ($row['enunciado'] ?? ''),
            'enunciado_clean' => (string) ($row['enunciado_clean'] ?? strip_tags((string) ($row['enunciado'] ?? ''))),
            'introText' => (string) ($row['intro_text'] ?? $data['introText'] ?? $data['intro_text'] ?? ''),
            'referenceText' => (string) ($row['reference_text'] ?? $data['referenceText'] ?? $data['reference_text'] ?? ''),
            'reference_text' => (string) ($row['reference_text'] ?? $data['referenceText'] ?? $data['reference_text'] ?? ''),
            'imageUrl' => $imageUrl,
            'hasImage' => $imageUrl !== '',
            'tipo' => (string) ($row['tipo'] ?? 'multipla_escolha'),
            'dificuldade' => (int) ($row['dificuldade'] ?? 1),
            'difficulty' => $this->difficultyLabel((int) ($row['dificuldade'] ?? 1)),
            'itens' => $items,
            'bancas' => $buckets['bancas'],
            'orgaos' => $buckets['orgaos'],
            'cargos' => $buckets['cargos'],
            'assuntos' => $buckets['assuntos'],
            'anos' => $buckets['anos'],
            'carreiras' => $buckets['carreiras'],
            'topic' => $this->firstTaxonomyName($buckets['assuntos']),
            'provaId' => $row['prova_id'] ?? null,
            'prova_id' => $row['prova_id'] ?? null,
            'provas' => $provas,
            'questionOrigin' => $origin,
            'question_origin' => $origin,
            'grupoQuestao' => $group,
            'grupoQuestaoId' => $group['id'] ?? ($row['grupo_questao_id'] ?? null),
            'grupo_questao_id' => $row['grupo_questao_id'] ?? ($group['id'] ?? null),
            'anulada' => !empty($row['anulada']),
            'desatualizada' => !empty($row['desatualizada']),
            'isCanceled' => !empty($row['anulada']),
            'isOutdated' => !empty($row['desatualizada']),
            'publishStatus' => (string) ($row['publish_status'] ?? 'published'),
            'publish_status' => (string) ($row['publish_status'] ?? 'published'),
            'visibilityStatus' => (string) ($row['visibility_status'] ?? 'public'),
            'visibility_status' => (string) ($row['visibility_status'] ?? 'public'),
            'scheduledAt' => $row['scheduled_at'] ?? null,
            'scheduled_at' => $row['scheduled_at'] ?? null,
            'publishedAt' => $row['published_at'] ?? null,
            'published_at' => $row['published_at'] ?? null,
            'importFingerprint' => $row['import_fingerprint'] ?? ($data['importFingerprint'] ?? ''),
            'import_fingerprint' => $row['import_fingerprint'] ?? ($data['importFingerprint'] ?? ''),
            'sourceExamKey' => $row['source_exam_key'] ?? ($data['sourceExamKey'] ?? ''),
            'source_exam_key' => $row['source_exam_key'] ?? ($data['sourceExamKey'] ?? ''),
            'sourceQuestionNumber' => $row['source_question_number'] ?? ($data['sourceQuestionNumber'] ?? ''),
            'source_question_number' => $row['source_question_number'] ?? ($data['sourceQuestionNumber'] ?? ''),
            'createdAt' => $row['created_at'] ?? null,
            'created_at' => $row['created_at'] ?? null,
            'timestamp' => (string) ($row['published_at'] ?? $row['created_at'] ?? ''),
            'stats' => [
                'totalAttempts' => (int) ($stats['totalAttempts'] ?? 0),
                'correctCount' => (int) ($stats['correctCount'] ?? 0),
                'wrongCount' => (int) ($stats['wrongCount'] ?? 0),
            ],
            'commentsCount' => $commentsCount,
            'hasTeacherComment' => $teacher !== '',
            'hasDetailedComment' => $detailed !== '',
        ];

        $canonicalAlternatives = is_array($canonicalAggregate['alternatives'] ?? null)
            ? $canonicalAggregate['alternatives']
            : $this->canonicalAlternativesFromItems($items);
        $correctAlternative = $canonicalAlternatives[$answerIndex]['tempId'] ?? null;
        $question['source'] = [
            'origin' => $origin,
            'examId' => $row['prova_id'] ?? null,
            'questionNumber' => $row['source_question_number'] ?? ($data['questionNumber'] ?? null),
            'contextTempId' => (string) ($canonicalAggregate['contexts'][0]['tempId'] ?? $data['supportContextKey'] ?? ''),
            'sourcePage' => $row['source_page'] ?? ($data['sourcePage'] ?? null),
        ];
        $question['content'] = [
            'statement' => $question['enunciado'],
            'statementClean' => $question['enunciado_clean'],
            'supportText' => $question['introText'],
            'reference' => $question['referenceText'],
        ];
        $question['assets'] = $assets;
        $question['filters'] = [
            'subjects' => $this->filterItemsByTaxonomyLevel($buckets['assuntos'], 'materia'),
            'topics' => $this->filterItemsByTaxonomyLevel($buckets['assuntos'], 'topico'),
            'subtopics' => $this->filterItemsByTaxonomyLevel($buckets['assuntos'], 'assunto'),
            'examBoards' => $buckets['bancas'],
            'organizations' => $buckets['orgaos'],
            'roles' => $buckets['cargos'],
            'careers' => $buckets['carreiras'],
            'years' => $buckets['anos'],
            'levels' => $buckets['niveis'] ?? [],
            'examTypes' => $buckets['tiposProva'] ?? [],
        ];
        $question['type'] = $question['tipo'] === 'certo ou errado' ? 'true_false' : 'single_choice';
        $question['alternatives'] = $canonicalAlternatives;
        if ($includeAnswerKey) {
            $question['answer'] = [
                'mode' => $question['type'] === 'true_false' ? 'boolean' : 'single',
                'raw' => (string) ($items[$answerIndex]['rotulo'] ?? ''),
                'correctAlternativeTempIds' => $correctAlternative !== null ? [$correctAlternative] : [],
            ];
        }

        $question['editorial'] = $this->canonicalEditorialsForOutput($editorials, $teacher, $detailed);
        $question['publication'] = [
            'status' => $question['publishStatus'],
            'visibility' => $question['visibilityStatus'],
            'scheduledAt' => $question['scheduledAt'],
        ];
        $question['review'] = [
            'required' => false,
            'status' => 'reviewed',
            'reasons' => [],
        ];
        if ($canonicalAggregate !== null) {
            $question['contexts'] = $canonicalAggregate['contexts'] ?? [];
        }

        if ($includeAnswerKey) {
            $question['resposta'] = $answerIndex + 1;
            $question['correctOptionIndex'] = $answerIndex;
        }

        if ($canViewTeacherComments) {
            $question['teacherComment'] = $teacher;
        }
        if ($canViewDetailedAnalysis) {
            $question['detailedComment'] = $detailed;
        }
        if ($userAnswer !== null) {
            $question['userAnswer'] = $userAnswer;
            $question['resolvida'] = true;
        }

        return $this->outputPolicy->forRead(
            $question,
            $includeAnswerKey,
            $canViewTeacherComments,
            $canViewDetailedAnalysis
        );
    }

    private function editorialBodyByType(array $editorials, string $type): ?string
    {
        foreach ($editorials as $editorial) {
            if (is_array($editorial) && (string) ($editorial['type'] ?? '') === $type) {
                return (string) ($editorial['body'] ?? '');
            }
        }
        return null;
    }

    private function canonicalAlternativesFromItems(array $items): array
    {
        return array_map(static fn (array $item, int $index): array => [
            'tempId' => 'alt_' . strtolower((string) ($item['rotulo'] ?? chr(65 + $index))),
            'order' => (int) ($item['ordem'] ?? $index + 1),
            'label' => (string) ($item['rotulo'] ?? chr(65 + $index)),
            'text' => (string) ($item['corpo'] ?? ''),
            'textClean' => (string) ($item['corpo_clean'] ?? ''),
            'assets' => [],
        ], $items, array_keys($items));
    }

    private function canonicalEditorialsForOutput(array $editorials, string $teacher, string $detailed): array
    {
        $byType = [];
        foreach ($editorials as $editorial) {
            if (is_array($editorial) && isset($editorial['type'])) {
                $byType[(string) $editorial['type']] = $editorial;
            }
        }
        return [
            $byType['teacher_comment'] ?? ['type' => 'teacher_comment', 'title' => '', 'body' => $teacher, 'status' => 'draft'],
            $byType['detailed_analysis'] ?? ['type' => 'detailed_analysis', 'title' => '', 'body' => $detailed, 'status' => 'draft'],
        ];
    }

    private function filterItemsByTaxonomyLevel(array $items, string $level): array
    {
        return array_values(array_filter($items, static function (mixed $item) use ($level): bool {
            if (!is_array($item)) {
                return false;
            }
            return strtolower((string) ($item['taxonomyLevel'] ?? $item['taxonomy_level'] ?? 'assunto')) === $level;
        }));
    }

    private function buildQuestionDataJson(array $data, int $answerIndex): string
    {
        $payload = [
            'itens' => $this->normalizeItems($data['itens']),
            'teacherComment' => $this->normalizeEditorialText($data['teacherComment'] ?? ''),
            'detailedComment' => $this->normalizeEditorialText($data['detailedComment'] ?? ''),
            'imageUrl' => trim((string) ($data['imageUrl'] ?? '')),
            'questionOrigin' => (string) ($data['question_origin'] ?? 'platform'),
            'question_origin' => (string) ($data['question_origin'] ?? 'platform'),
            'correctOptionIndex' => $answerIndex,
            'referenceText' => (string) ($data['reference_text'] ?? ''),
            'reference_text' => (string) ($data['reference_text'] ?? ''),
            'sourcePage' => $data['source_page'] ?? null,
            'questionNumber' => $data['question_number'] ?? null,
            'supportContextKey' => trim((string) ($data['support_context_key'] ?? '')),
            'figureDescription' => trim((string) ($data['figure_description'] ?? '')),
            'importFingerprint' => trim((string) ($data['import_fingerprint'] ?? '')),
            'sourceExamKey' => trim((string) ($data['source_exam_key'] ?? '')),
            'sourceQuestionNumber' => trim((string) ($data['source_question_number'] ?? '')),
            'sourceProvider' => trim((string) ($data['source_provider'] ?? '')),
            'sourceExternalId' => trim((string) ($data['source_external_id'] ?? '')),
        ];

        $json = json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_INVALID_UTF8_SUBSTITUTE);
        if (!is_string($json)) {
            throw new RuntimeException('Nao foi possivel serializar os dados da questao.');
        }

        return $json;
    }

    private function persistValidatedQuestion(array $data, string $authenticatedUserId = ''): array
    {
        if (($data['question_origin'] ?? '') === 'exam' && empty($data['prova_id'])) {
            throw new InvalidArgumentException('Questoes importadas de prova precisam estar vinculadas a uma prova salva.');
        }

        $ownership = null;
        if ($data['id'] !== null) {
            $ownership = $this->repository->findQuestionOwnershipById($data['id']);
            if ($ownership === null) {
                throw new OutOfBoundsException('Questao nao encontrada.');
            }
        }

        $answerIndex = $this->resolveCorrectAnswerIndex($data['itens'], $data['resposta']);
        $record = [
            'enunciado' => $data['enunciado'],
            'enunciado_clean' => $data['enunciado_clean'],
            'tipo' => $data['tipo'],
            'dificuldade' => $data['dificuldade'],
            'intro_text' => $data['intro_text'],
            'reference_text' => $data['reference_text'] ?? '',
            'data_json' => $this->buildQuestionDataJson($data, $answerIndex),
            'import_fingerprint' => $data['import_fingerprint'] ?? null,
            'source_exam_key' => $data['source_exam_key'] ?? null,
            'source_question_number' => $data['source_question_number'] ?? null,
            'source_provider' => $data['source_provider'] ?? null,
            'source_external_id' => $data['source_external_id'] ?? null,
            'resposta_correta_item_index' => $answerIndex,
            'prova_id' => $data['prova_id'],
            'grupo_questao_id' => $data['grupo_questao_id'],
            'anulada' => $data['anulada'] ? 1 : 0,
            'desatualizada' => $data['desatualizada'] ? 1 : 0,
            'publish_status' => $data['publish_status'],
            'visibility_status' => $data['visibility_status'],
            'scheduled_at' => $data['scheduled_at'],
            'published_at' => $data['published_at'],
            // The author is immutable. Updates only change the explicit audit
            // fields for the editor and, when applicable, the publisher.
            'created_by_user_id' => trim((string) ($ownership['created_by_user_id'] ?? '')) ?: $authenticatedUserId,
            'updated_by_user_id' => $authenticatedUserId,
            'published_by_user_id' => ($data['publish_status'] ?? '') === 'published'
                ? (trim((string) ($ownership['published_by_user_id'] ?? '')) ?: $authenticatedUserId)
                : (trim((string) ($ownership['published_by_user_id'] ?? '')) ?: null),
        ];

        if ($data['id'] !== null) {
            $questionId = $data['id'];
            $this->repository->updateQuestion($questionId, $record);
        } else {
            $questionId = $this->repository->insertQuestion($record);
        }

        $this->repository->syncPrimaryQuestionProva(
            $questionId,
            $record['prova_id'] ?? null,
            $record['source_question_number'] ?? null
        );

        $this->repository->clearQuestionFilters($questionId);
        $newTaxonomies = $this->syncQuestionFilters($questionId, $data['taxonomies']);

        $canonical = is_array($data['canonical'] ?? null)
            ? $data['canonical']
            : $this->buildCanonicalQuestionSnapshot($data, $answerIndex);
        $canonical['id'] = is_numeric($questionId) ? (int) $questionId : $questionId;
        $canonical['source'] = array_merge(
            is_array($canonical['source'] ?? null) ? $canonical['source'] : [],
            [
                'origin' => (string) ($data['question_origin'] ?? 'platform'),
                'examId' => $record['prova_id'] ?? null,
                'questionNumber' => $data['question_number'] ?? null,
                'sourcePage' => $data['source_page'] ?? null,
            ]
        );
        $this->canonicalRepository->replaceQuestionAggregate(
            (int) $questionId,
            $canonical,
            is_numeric($data['canonical_context_id'] ?? null) ? (int) $data['canonical_context_id'] : null
        );
        $this->repository->refreshQuestionScaleReadModel($questionId);

        return [$questionId, $newTaxonomies];
    }

    /**
     * Produces the same aggregate used by question-import.v2 for older callers
     * while the frontend completes its migration to the public contract.
     */
    private function buildCanonicalQuestionSnapshot(array $data, int $answerIndex): array
    {
        $alternatives = [];
        foreach ($this->normalizeItems($data['itens'] ?? []) as $index => $item) {
            $tempId = 'alt_' . strtolower((string) ($item['rotulo'] ?? chr(65 + $index)));
            $alternatives[] = [
                'tempId' => $tempId,
                'order' => (int) ($item['ordem'] ?? $index + 1),
                'label' => (string) ($item['rotulo'] ?? chr(65 + $index)),
                'text' => (string) ($item['corpo'] ?? ''),
                'textClean' => (string) ($item['corpo_clean'] ?? ''),
                'assets' => [],
            ];
        }
        $correct = $alternatives[$answerIndex]['tempId'] ?? null;
        return [
            'tempId' => null,
            'source' => [
                'origin' => (string) ($data['question_origin'] ?? 'platform'),
                'examId' => $data['prova_id'] ?? null,
                'questionNumber' => $data['question_number'] ?? null,
                'contextTempId' => (string) ($data['support_context_key'] ?? ''),
                'sourcePage' => $data['source_page'] ?? null,
            ],
            'content' => [
                'statement' => (string) ($data['enunciado'] ?? ''),
                'statementClean' => (string) ($data['enunciado_clean'] ?? ''),
                'supportText' => (string) ($data['intro_text'] ?? ''),
                'reference' => (string) ($data['reference_text'] ?? ''),
            ],
            'assets' => [],
            'filters' => [
                'subjects' => [],
                'topics' => [],
                'subtopics' => [],
                'examBoards' => $data['taxonomies']['banca'] ?? [],
                'organizations' => $data['taxonomies']['orgao'] ?? [],
                'roles' => $data['taxonomies']['cargo'] ?? [],
                'careers' => $data['taxonomies']['carreira'] ?? [],
                'years' => $data['taxonomies']['ano'] ?? [],
                'levels' => $data['taxonomies']['nivel'] ?? [],
                'examTypes' => $data['taxonomies']['tipo_prova'] ?? [],
            ],
            'type' => (string) ($data['tipo'] ?? 'multipla escolha'),
            'difficulty' => $this->difficultyLabel((int) ($data['dificuldade'] ?? 2)),
            'alternatives' => $alternatives,
            'answer' => [
                'mode' => 'single',
                'raw' => $alternatives[$answerIndex]['label'] ?? '',
                'correctAlternativeTempIds' => $correct !== null ? [$correct] : [],
            ],
            'editorial' => [
                ['type' => 'teacher_comment', 'title' => '', 'body' => (string) ($data['teacherComment'] ?? ''), 'status' => 'draft'],
                ['type' => 'detailed_analysis', 'title' => '', 'body' => (string) ($data['detailedComment'] ?? ''), 'status' => 'draft'],
            ],
            'publication' => [
                'status' => (string) ($data['publish_status'] ?? 'draft'),
                'visibility' => (string) ($data['visibility_status'] ?? 'public'),
                'scheduledAt' => $data['scheduled_at'] ?? null,
            ],
            'review' => [
                'required' => !empty($data['needsReview']),
                'status' => !empty($data['needsReview']) ? 'pending' : 'reviewed',
                'reasons' => is_array($data['statusReasons'] ?? null) ? $data['statusReasons'] : [],
            ],
        ];
    }

    private function normalizeBulkImportFocus(mixed $value): array
    {
        $record = is_array($value) ? $value : ['name' => $value];
        $name = $this->extractTaxonomyName($record, 'carreira');
        $slug = $this->extractTaxonomySlug($record, $name);
        $id = $this->extractNumericId($record);

        return [
            'id' => $id,
            'name' => $name,
            'slug' => $slug,
        ];
    }

    /**
     * Le a area/foco do proprio item sem converter um foco de prova em filtro
     * global. O contrato canonico usa filters.careers.
     *
     * @return list<array<string, mixed>>
     */
    private function readBulkQuestionFocusItems(array $question): array
    {
        $filters = is_array($question['filters'] ?? null) ? $question['filters'] : [];
        $values = $question['carreiras']
            ?? $question['focos']
            ?? $filters['careers']
            ?? $filters['carreiras']
            ?? [];
        if (!is_array($values)) {
            $values = [$values];
        }

        return array_values(array_filter($values, function (mixed $value): bool {
            return $this->normalizeBulkImportFocus($value)['name'] !== '';
        }));
    }

    /**
     * @param list<array<string, mixed>> $questions
     * @return list<array{id: ?int, name: string, slug: string}>
     */
    private function collectBulkQuestionFocuses(array $questions): array
    {
        $unique = [];
        foreach ($questions as $question) {
            if (!is_array($question)) {
                continue;
            }
            foreach ($this->readBulkQuestionFocusItems($question) as $item) {
                $focus = $this->normalizeBulkImportFocus($item);
                if ($focus['name'] === '') {
                    continue;
                }
                $key = $focus['slug'] !== '' ? $focus['slug'] : $this->slugify($focus['name']);
                $unique[$key] = $focus;
            }
        }
        return array_values($unique);
    }

    private function withPublicationOwnership(array $record, string $authenticatedUserId): array
    {
        $record['created_by_user_id'] = $authenticatedUserId;
        $record['updated_by_user_id'] = $authenticatedUserId;
        $record['published_by_user_id'] = $authenticatedUserId;

        return $record;
    }

    private function ensureFilterId(string $type, string $name, string $slug = '', int $metaMateria = 0, int $metaCarreira = 0, ?int $preferredId = null): ?int
    {
        $name = trim($name);
        if ($name === '') {
            return null;
        }
        if ($preferredId !== null && $preferredId > 0) {
            return $preferredId;
        }

        $slug = trim($slug) !== '' ? trim($slug) : $this->slugify($name);
        return $this->repository->findFilterIdByIdentity($type, $name, $slug, null)
            ?? $this->repository->findFilterIdByIdentityAnyParent($type, $name, $slug, true)
            ?? $this->repository->createFilter($type, $name, $slug, $metaMateria, $metaCarreira, null);
    }

    /**
     * Garante que todos os nomes de taxonomia da prova existam.
     *
     * @since 1.0.0
     */
    private function ensureImportedExamFilterIds(string $type, array $names): array
    {
        $ids = [];
        foreach ($names as $name) {
            $id = $this->ensureFilterId($type, (string) $name);
            if ($id !== null && $id > 0) {
                $ids[] = $id;
            }
        }

        return $ids;
    }

    private function buildTaxonomyPayload(string $type, ?int $id, string $name): array
    {
        $label = trim($name);
        if ($label === '') {
            return [
                'id' => $id,
                'name' => '',
                'nome' => '',
                'slug' => '',
            ];
        }

        $payload = [
            'id' => $id,
            'name' => $label,
            'nome' => $label,
            'slug' => $this->slugify($label),
        ];

        if ($type === 'banca') {
            $payload['sigla'] = $label;
        }
        if ($type === 'orgao') {
            $payload['sigla'] = $label;
        }
        if ($type === 'cargo') {
            $payload['descricao'] = $label;
            $payload['descrição'] = $label;
        }

        return $payload;
    }

    private function buildImportedExamRecord(array $examPayload, array $questions, ?int $focusId, string $pdfUrl): array
    {
        $firstQuestion = is_array($questions[0] ?? null) ? $questions[0] : [];
        $agencyName = $this->firstNonEmptyBulkValue($examPayload, $firstQuestion, ['agency', 'banca', 'board']);
        $sourceNames = $this->normalizeImportedExamOrganizations($examPayload, $firstQuestion);
        $sourceName = $sourceNames[0] ?? $this->firstNonEmptyBulkValue($examPayload, $firstQuestion, ['source', 'organization', 'orgao', 'organizer']);
        if ($sourceName === '') {
            $sourceName = $agencyName;
        }
        if ($sourceName !== '' && $sourceNames === []) {
            $sourceNames = [$sourceName];
        }
        $sourceTitle = implode('/', $sourceNames);
        $roleNames = $this->normalizeImportedExamRoles($examPayload, $firstQuestion);
        $roleName = $roleNames[0] ?? $this->firstNonEmptyBulkValue($examPayload, $firstQuestion, ['role', 'cargo', 'course', 'curso', 'examName', 'contestName']);
        if ($roleName !== '' && $roleNames === []) {
            $roleNames = [$roleName];
        }
        $roleTitle = implode('/', $roleNames);
        $bancaId = $this->ensureFilterId('banca', $agencyName);
        $sourceIds = $this->ensureImportedExamFilterIds('orgao', $sourceNames);
        $roleIds = $this->ensureImportedExamFilterIds('cargo', $roleNames);
        $levelName = $this->firstNonEmptyBulkValue($examPayload, $firstQuestion, ['level', 'nivel']);
        $examTypeName = $this->firstNonEmptyBulkValue($examPayload, $firstQuestion, ['examType', 'tipoProva', 'tipo_prova']);
        $levelId = $this->ensureFilterId('nivel', $levelName);
        $examTypeId = $this->ensureFilterId('tipo_prova', $examTypeName);
        $explicitTitle = $this->firstNonEmptyBulkValue($examPayload, $firstQuestion, ['title', 'examTitle', 'name', 'nome']);
        $year = (int) ($examPayload['year'] ?? $examPayload['ano'] ?? ($firstQuestion['anos'][0] ?? date('Y')));
        if ($year < 1900 || $year > ((int) date('Y') + 5)) {
            $year = (int) date('Y');
        }
        $examId = (int) (
            $examPayload['publishedExamId']
            ?? $examPayload['provaId']
            ?? $examPayload['prova_id']
            ?? $examPayload['id']
            ?? 0
        );
        $firstSource = is_array($firstQuestion['source'] ?? null) ? $firstQuestion['source'] : [];
        $sourceProvider = $this->normalizeImportedSourceProvider(
            $examPayload['provider']
            ?? $examPayload['sourceProvider']
            ?? $examPayload['source_provider']
            ?? $firstSource['provider']
            ?? null
        );
        $sourceExternalId = $this->normalizeImportedSourceExternalId(
            $examPayload['externalId']
            ?? $examPayload['sourceExternalId']
            ?? $examPayload['source_external_id']
            ?? $firstSource['externalExamId']
            ?? null
        );

        $name = $this->buildImportedExamTitle($agencyName, $sourceTitle, $roleTitle, $year, $explicitTitle);
        $bookletMetadata = $this->normalizeImportedExamBookletMetadata($examPayload, $firstQuestion);
        $publicationStatus = $this->normalizeImportedExamPublicationStatus($examPayload);
        $visibilityStatus = $this->normalizeImportedExamVisibilityStatus($examPayload);
        $scheduledAt = $publicationStatus === 'scheduled'
            ? $this->normalizeImportedExamScheduledAt($examPayload)
            : null;

        $metadataJson = json_encode([
            'source' => 'bulk_import_pdf',
            'sourceProvider' => $sourceProvider,
            'sourceExternalId' => $sourceExternalId,
            'raw' => $examPayload,
            'pdfUrl' => $pdfUrl,
            'files' => array_values(array_filter(
                is_array($examPayload['files'] ?? null) ? $examPayload['files'] : [],
                'is_array'
            )),
            'banca' => $this->buildTaxonomyPayload('banca', $bancaId, $agencyName),
            'roles' => $roleNames,
            'cargos' => $roleNames,
            'roleIds' => $roleIds,
            'cargoIds' => $roleIds,
            'sources' => $sourceNames,
            'orgaos' => $sourceNames,
            'sourceIds' => $sourceIds,
            'orgaoIds' => $sourceIds,
            'caderno' => $bookletMetadata['caderno'],
            'tipoCaderno' => $bookletMetadata['tipoCaderno'],
            'corCaderno' => $bookletMetadata['corCaderno'],
            'bookletType' => $bookletMetadata['bookletType'],
            'bookletColor' => $bookletMetadata['bookletColor'],
        ], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_INVALID_UTF8_SUBSTITUTE);

        return [
            'id' => $examId > 0 ? $examId : null,
            'source_provider' => $sourceProvider,
            'source_external_id' => $sourceExternalId,
            'nome' => $name,
            'slug' => $this->slugify($name),
            'ano' => $year,
            'banca_id' => $bancaId,
            'orgao_id' => $sourceIds[0] ?? null,
            'cargo_id' => $roleIds[0] ?? null,
            'nivel_id' => $levelId,
            'tipo_prova_id' => $examTypeId,
            'carreira_id' => $focusId,
            'pdf_url' => $pdfUrl,
            'metadata_json' => is_string($metadataJson) ? $metadataJson : '{}',
            'banca_name' => $agencyName,
            'source_names' => $sourceNames,
            'source_ids' => $sourceIds,
            'role_names' => $roleNames,
            'role_ids' => $roleIds,
            'level_name' => $levelName,
            'exam_type_name' => $examTypeName,
            'status_editorial' => $publicationStatus,
            'visibility_status' => $visibilityStatus,
            'scheduled_at' => $scheduledAt,
        ];
    }

    private function forceImportedQuestionPublication(array $question): array
    {
        $publication = is_array($question['publication'] ?? null) ? $question['publication'] : [];
        $question['publication'] = array_merge($publication, [
            'status' => 'published',
            'visibility' => 'public',
            'scheduledAt' => null,
        ]);
        $question['publishStatus'] = 'published';
        $question['publish_status'] = 'published';
        $question['visibilityStatus'] = 'public';
        $question['visibility_status'] = 'public';
        $question['scheduledAt'] = null;
        $question['scheduled_at'] = null;

        return $question;
    }

    /**
     * A revisao do importador nao e um estado persistido da prova. O contrato
     * de publicacao envia esse valor explicitamente; chamadas legadas que nao
     * o informam mantem o comportamento historico de publicar a prova.
     */
    private function normalizeImportedExamPublicationStatus(array $payload): string
    {
        $status = strtolower(trim((string) (
            $payload['publishStatus']
            ?? $payload['statusEditorial']
            ?? $payload['status_editorial']
            ?? 'published'
        )));

        return in_array($status, ['published', 'draft', 'scheduled', 'archived'], true)
            ? $status
            : 'published';
    }

    private function normalizeImportedExamVisibilityStatus(array $payload): string
    {
        $visibility = strtolower(trim((string) (
            $payload['visibilityStatus']
            ?? $payload['visibility_status']
            ?? 'public'
        )));

        return in_array($visibility, ['public', 'elite', 'internal'], true)
            ? $visibility
            : 'public';
    }

    private function normalizeImportedExamScheduledAt(array $payload): ?string
    {
        $value = trim((string) ($payload['scheduledAt'] ?? $payload['scheduled_at'] ?? ''));
        if ($value === '') {
            return null;
        }

        try {
            return (new DateTimeImmutable($value))->format('Y-m-d H:i:s');
        } catch (Throwable) {
            return null;
        }
    }

    private function buildImportedExamTitle(string $agencyName, string $sourceName, string $roleName, int $year, string $explicitTitle = ''): string
    {
        $agencyName = trim($agencyName);
        $roleName = trim($roleName);
        $sourceName = trim($sourceName);
        $explicitTitle = trim($explicitTitle);

        if ($explicitTitle !== '') {
            return $this->sanitizeImportedExamTitle($explicitTitle);
        }

        if ($agencyName === '' || $roleName === '' || $sourceName === '' || $year < 1900) {
            throw new InvalidArgumentException('Nao foi possivel definir o titulo da prova no padrao Banca - Ano - Orgao - Cargo/Prova. Revise banca, ano, orgao/fonte e cargo/curso antes de salvar.');
        }

        return $this->sanitizeImportedExamTitle($agencyName . ' - ' . $year . ' - ' . $sourceName . ' - ' . $roleName);
    }

    private function sanitizeImportedExamTitle(string $title): string
    {
        $cleanTitle = trim((string) preg_replace('/\s+/u', ' ', strip_tags($title)));
        if ($cleanTitle === '') {
            throw new InvalidArgumentException('Informe um titulo valido para a prova.');
        }

        return $cleanTitle;
    }

    private function buildImportedQuestionIdentity(array $question, array $examRecord): array
    {
        $sourceExamKey = $this->buildImportedExamKey($examRecord);
        $sourceProvider = $this->normalizeImportedSourceProvider($question['source_provider'] ?? null);
        $sourceExternalId = $this->normalizeImportedSourceExternalId($question['source_external_id'] ?? null);
        $questionNumber = $this->normalizeImportedQuestionNumber($question['question_number'] ?? null);
        $statement = $this->normalizeImportedQuestionText(
            (string) ($question['enunciado_clean'] ?? $question['enunciado'] ?? '')
        );
        $options = array_map(
            fn (array $item): string => $this->normalizeImportedQuestionText((string) ($item['corpo_clean'] ?? $item['corpo'] ?? '')),
            array_values(array_filter($question['itens'] ?? [], 'is_array'))
        );

        $fingerprintPayload = $sourceProvider !== '' && $sourceExternalId !== ''
            ? implode('|', ['external', $sourceProvider, $sourceExternalId])
            : implode('|', array_filter([
                $sourceExamKey,
                $questionNumber,
                $statement,
                implode('||', $options),
            ], static fn (string $value): bool => $value !== ''));

        return [
            'import_fingerprint' => hash('sha256', $fingerprintPayload),
            'source_exam_key' => $sourceExamKey,
            'source_question_number' => $questionNumber,
            'source_provider' => $sourceProvider,
            'source_external_id' => $sourceExternalId,
        ];
    }

    private function buildImportedQuestionBatchKey(array $identity): string
    {
        $sourceProvider = trim((string) ($identity['source_provider'] ?? ''));
        $sourceExternalId = trim((string) ($identity['source_external_id'] ?? ''));
        if ($sourceProvider !== '' && $sourceExternalId !== '') {
            return 'external:' . $sourceProvider . ':' . $sourceExternalId;
        }
        $sourceExamKey = trim((string) ($identity['source_exam_key'] ?? ''));
        $questionNumber = trim((string) ($identity['source_question_number'] ?? ''));
        if ($sourceExamKey !== '' && $questionNumber !== '') {
            return 'exam-number:' . $sourceExamKey . ':' . $questionNumber;
        }

        return 'fingerprint:' . trim((string) ($identity['import_fingerprint'] ?? ''));
    }

    /**
     * Retorna um diagnostico seguro para a revisao do lote sem expor SQL,
     * caminhos internos, e-mails ou payload editorial.
     *
     * @return array{code:string,message:string}
     */
    private function buildSanitizedBulkImportDiagnostic(Throwable $error): array
    {
        $isContractError = $error instanceof InvalidArgumentException
            || $error instanceof OutOfBoundsException
            || $error instanceof DomainException;
        if (!$isContractError) {
            return [
                'code' => 'import_persistence_failed',
                'message' => 'Nao foi possivel persistir este item. Consulte a trilha pelo identificador da importacao.',
            ];
        }

        $message = trim(strip_tags($error->getMessage()));
        $message = preg_replace('/[\r\n\t]+/', ' ', $message) ?? '';
        $message = preg_replace('/\s{2,}/', ' ', $message) ?? '';
        $message = preg_replace(
            '~\b[A-Z]:[\\\\/][^\s]+|/(?:var|home|root|workspace|tmp)/[^\s]+~i',
            '[path]',
            $message
        ) ?? '';
        $message = preg_replace('/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i', '[email]', $message) ?? '';
        $message = preg_replace('/https?:\/\/\S+/i', '[url]', $message) ?? '';

        return [
            'code' => 'import_contract_invalid',
            'message' => substr($message !== '' ? $message : 'O item nao atende ao contrato de importacao.', 0, 300),
        ];
    }

    private function buildImportedExamKey(array $examRecord): string
    {
        $sourceProvider = $this->normalizeImportedSourceProvider($examRecord['source_provider'] ?? null);
        $sourceExternalId = $this->normalizeImportedSourceExternalId($examRecord['source_external_id'] ?? null);
        if ($sourceProvider !== '' && $sourceExternalId !== '') {
            return $sourceProvider . ':exam:' . $sourceExternalId;
        }
        $slug = trim((string) ($examRecord['slug'] ?? ''));
        $year = (int) ($examRecord['ano'] ?? 0);
        $rawKey = $slug . ':' . $year;

        return substr($slug, 0, 120) . ':' . $year . ':' . substr(sha1($rawKey), 0, 12);
    }

    private function normalizeImportedSourceProvider(mixed $value): string
    {
        $value = strtolower(trim((string) $value));
        if ($value === '' || strlen($value) > 40 || preg_match('/^[a-z0-9][a-z0-9_-]*$/', $value) !== 1) {
            return '';
        }

        return $value;
    }

    private function normalizeImportedSourceExternalId(mixed $value): string
    {
        $value = trim((string) $value);
        if ($value === '' || strlen($value) > 120 || preg_match('/[\x00-\x1F\x7F]/', $value) === 1) {
            return '';
        }

        return $value;
    }

    private function normalizeBulkContextQuestionNumbers(mixed $value): array
    {
        if (!is_array($value)) {
            return [];
        }

        $numbers = [];
        foreach ($value as $item) {
            $number = $this->normalizeImportedQuestionNumber($item);
            if ($number !== '') {
                $numbers[$number] = $number;
            }
        }

        return array_values($numbers);
    }

    private function normalizeImportedQuestionNumber(mixed $value): string
    {
        $raw = trim((string) $value);
        if ($raw === '') {
            return '';
        }

        if (preg_match('/\d+/', $raw, $matches) === 1) {
            return (string) ((int) $matches[0]);
        }

        return $raw;
    }

    private function normalizeImportedQuestionText(string $value): string
    {
        $text = trim(strip_tags($value));
        $text = preg_replace('/\s+/u', ' ', $text) ?? $text;
        if (function_exists('mb_strtolower')) {
            return mb_strtolower($text, 'UTF-8');
        }

        return strtolower($text);
    }

    private function buildImportedExamResponse(int $examId, array $examRecord): array
    {
        $bookletMetadata = $this->readImportedExamBookletMetadataFromRecord($examRecord);
        $metadata = $this->readImportedExamMetadataFromRecord($examRecord);
        $raw = is_array($metadata['raw'] ?? null) ? $metadata['raw'] : [];
        $bancaName = trim((string) ($examRecord['banca_name'] ?? ''));
        if ($bancaName === '') {
            $bancaName = $this->firstNonEmptyBulkValue($metadata, $raw, ['agency', 'banca', 'board']);
        }
        $sourceNames = $examRecord['source_names'] ?? [];
        if (!is_array($sourceNames) || $sourceNames === []) {
            $sourceNames = $this->normalizeImportedExamOrganizations($metadata, $raw);
        }
        $sourceIds = $examRecord['source_ids'] ?? [];
        if (!is_array($sourceIds) || $sourceIds === []) {
            $sourceIds = [(int) ($examRecord['orgao_id'] ?? 0)];
        }
        $roleNames = $this->readImportedExamRolesFromRecord($examRecord);
        $roleIds = $examRecord['role_ids'] ?? [];
        if (!is_array($roleIds) || $roleIds === []) {
            $roleIds = [(int) ($examRecord['cargo_id'] ?? 0)];
        }
        $primaryRoleName = $roleNames[0] ?? '';
        $primarySourceName = $sourceNames[0] ?? '';
        $banca = $this->buildTaxonomyPayload('banca', isset($examRecord['banca_id']) ? (int) $examRecord['banca_id'] : null, $bancaName);
        $orgaos = [];
        foreach ($sourceNames as $index => $sourceName) {
            $orgaos[] = $this->buildTaxonomyPayload('orgao', isset($sourceIds[$index]) ? (int) $sourceIds[$index] : null, (string) $sourceName);
        }
        $cargos = [];
        foreach ($roleNames as $index => $roleName) {
            $cargos[] = $this->buildTaxonomyPayload('cargo', isset($roleIds[$index]) ? (int) $roleIds[$index] : null, (string) $roleName);
        }

        return [
            'id' => $examId,
            'nome' => $examRecord['nome'],
            'slug' => $examRecord['slug'],
            'ano' => (int) $examRecord['ano'],
            'tipo' => 0,
            'index' => '',
            'nivel' => '',
            'pdfUrl' => $examRecord['pdf_url'],
            'caderno' => $bookletMetadata['caderno'],
            'tipoCaderno' => $bookletMetadata['tipoCaderno'],
            'corCaderno' => $bookletMetadata['corCaderno'],
            'bookletType' => $bookletMetadata['bookletType'],
            'bookletColor' => $bookletMetadata['bookletColor'],
            'roles' => $roleNames,
            'cargos' => $cargos,
            'sources' => $sourceNames,
            'orgaos' => $orgaos,
            'banca' => $banca,
            'orgao' => $orgaos[0] ?? $this->buildTaxonomyPayload('orgao', isset($examRecord['orgao_id']) ? (int) $examRecord['orgao_id'] : null, $primarySourceName),
            'cargo' => $cargos[0] ?? $this->buildTaxonomyPayload('cargo', isset($examRecord['cargo_id']) ? (int) $examRecord['cargo_id'] : null, $primaryRoleName),
            'metadata' => $metadata,
            'metadata_json' => $examRecord['metadata_json'] ?? '{}',
        ];
    }

    private function normalizeImportedExamBookletMetadata(array $primary, array $secondary = []): array
    {
        $bookletType = $this->firstNonEmptyBulkValue($primary, $secondary, [
            'tipoCaderno',
            'bookletType',
            'cadernoTipo',
            'tipo_caderno',
            'booklet_type',
        ]);
        $bookletColor = $this->firstNonEmptyBulkValue($primary, $secondary, [
            'corCaderno',
            'bookletColor',
            'cadernoCor',
            'cor_caderno',
            'booklet_color',
        ]);
        $bookletSummary = $this->firstNonEmptyBulkValue($primary, $secondary, [
            'caderno',
            'booklet',
            'bookletSummary',
            'cadernoResumo',
        ]);

        if ($bookletSummary === '') {
            $bookletSummary = trim(implode(' - ', array_filter([$bookletType, $bookletColor])));
        }

        return [
            'caderno' => $bookletSummary,
            'tipoCaderno' => $bookletType,
            'corCaderno' => $bookletColor,
            'bookletType' => $bookletType,
            'bookletColor' => $bookletColor,
        ];
    }

    private function readImportedExamBookletMetadataFromRecord(array $examRecord): array
    {
        $metadata = $this->readImportedExamMetadataFromRecord($examRecord);
        $raw = is_array($metadata['raw'] ?? null) ? $metadata['raw'] : [];
        return $this->normalizeImportedExamBookletMetadata($metadata, $raw);
    }

    private function readImportedExamMetadataFromRecord(array $examRecord): array
    {
        $metadata = [];
        $metadataJson = trim((string) ($examRecord['metadata_json'] ?? ''));
        if ($metadataJson !== '') {
            $decoded = json_decode($metadataJson, true);
            if (is_array($decoded)) {
                $metadata = $decoded;
            }
        }

        return $metadata;
    }

    private function readImportedExamRolesFromRecord(array $examRecord): array
    {
        $metadata = $this->readImportedExamMetadataFromRecord($examRecord);

        $raw = is_array($metadata['raw'] ?? null) ? $metadata['raw'] : [];
        return $this->normalizeImportedExamRoles($metadata, $raw);
    }

    private function firstNonEmptyBulkValue(array $primary, array $secondary, array $keys): string
    {
        foreach ($keys as $key) {
            foreach ([$primary, $secondary] as $source) {
                $value = $source[$key] ?? null;
                if (is_array($value)) {
                    $value = $this->extractTaxonomyName($value, $key);
                }
                $text = trim((string) $value);
                if ($text !== '') {
                    return $text;
                }
            }
        }

        return '';
    }

    private function normalizeImportedExamRoles(array $primary, array $secondary = []): array
    {
        $candidates = [];
        foreach ([
            $primary['roles'] ?? null,
            $primary['cargos'] ?? null,
            $secondary['roles'] ?? null,
            $secondary['cargos'] ?? null,
            $primary['role'] ?? null,
            $primary['cargo'] ?? null,
            $secondary['role'] ?? null,
            $secondary['cargo'] ?? null,
        ] as $value) {
            $candidates = array_merge($candidates, $this->extractImportedExamRoleNames($value));
        }

        $seen = [];
        $roles = [];
        foreach ($candidates as $candidate) {
            $name = trim((string) preg_replace('/\s+/u', ' ', $candidate));
            if ($name === '') {
                continue;
            }
            $key = $this->normalizeLooseText($name);
            if ($key === '' || isset($seen[$key])) {
                continue;
            }
            $seen[$key] = true;
            $roles[] = $name;
        }

        return $roles;
    }

    private function normalizeImportedExamOrganizations(array $primary, array $secondary = []): array
    {
        $candidates = [];
        foreach ([
            $primary['sources'] ?? null,
            $primary['orgaos'] ?? null,
            $primary['organizations'] ?? null,
            $secondary['sources'] ?? null,
            $secondary['orgaos'] ?? null,
            $secondary['organizations'] ?? null,
            $primary['source'] ?? null,
            $primary['organization'] ?? null,
            $primary['orgao'] ?? null,
            $secondary['source'] ?? null,
            $secondary['organization'] ?? null,
            $secondary['orgao'] ?? null,
        ] as $value) {
            $candidates = array_merge($candidates, $this->extractImportedExamOrganizationNames($value));
        }

        $seen = [];
        $organizations = [];
        foreach ($candidates as $candidate) {
            $name = trim((string) preg_replace('/\s+/u', ' ', $candidate));
            if ($name === '') {
                continue;
            }
            $key = $this->normalizeLooseText($name);
            if ($key === '' || isset($seen[$key])) {
                continue;
            }
            $seen[$key] = true;
            $organizations[] = $name;
        }

        return $organizations;
    }

    private function normalizeLooseText(string $value): string
    {
        $text = trim(strip_tags($value));
        $text = preg_replace('/\s+/u', ' ', $text) ?? $text;
        if (function_exists('mb_strtolower')) {
            return mb_strtolower($text, 'UTF-8');
        }

        return strtolower($text);
    }

    private function extractImportedExamRoleNames(mixed $value): array
    {
        if ($value === null) {
            return [];
        }

        if (is_array($value)) {
            if ($value === []) {
                return [];
            }
            $isList = array_keys($value) === range(0, count($value) - 1);
            if (!$isList) {
                $name = $this->extractTaxonomyName($value, 'cargo');
                return $name !== '' ? [$name] : [];
            }

            $roles = [];
            foreach ($value as $item) {
                $roles = array_merge($roles, $this->extractImportedExamRoleNames($item));
            }
            return $roles;
        }

        $text = trim((string) $value);
        if ($text === '') {
            return [];
        }

        return array_values(array_filter(array_map('trim', preg_split('/\s*\/\s*|[;\r\n]+/u', $text) ?: [])));
    }

    private function extractImportedExamOrganizationNames(mixed $value): array
    {
        if ($value === null) {
            return [];
        }

        if (is_array($value)) {
            if ($value === []) {
                return [];
            }
            $isList = array_keys($value) === range(0, count($value) - 1);
            if (!$isList) {
                $name = $this->extractTaxonomyName($value, 'orgao');
                return $name !== '' ? [$name] : [];
            }

            $organizations = [];
            foreach ($value as $item) {
                $organizations = array_merge($organizations, $this->extractImportedExamOrganizationNames($item));
            }
            return $organizations;
        }

        $text = trim((string) $value);
        if ($text === '') {
            return [];
        }

        return array_values(array_filter(array_map('trim', preg_split('/\s*\/\s*|[,;\r\n]+/u', $text) ?: [])));
    }

    private function taxonomyPayloadFromFilter(string $type, ?int $id, mixed $name): array
    {
        $label = trim((string) $name);
        if ($label === '' || $id === null) {
            return [];
        }

        $base = [
            'id' => $id,
            'name' => $label,
            'nome' => $label,
            'slug' => $this->slugify($label),
        ];

        if ($type === 'banca') {
            $base['sigla'] = $label;
        } elseif ($type === 'cargo') {
            $base['descricao'] = $label;
        }

        return [$base];
    }

    private function taxonomyPayloadsFromFilterNames(string $type, array $names): array
    {
        $payloads = [];
        foreach ($names as $name) {
            $label = trim((string) $name);
            if ($label === '') {
                continue;
            }
            $payloads = array_merge(
                $payloads,
                $this->taxonomyPayloadFromFilter($type, $this->ensureFilterId($type, $label), $label)
            );
        }

        return $payloads;
    }

    private function mergeTaxonomyList(mixed $current, array $additions): array
    {
        $items = is_array($current) ? $current : [];
        foreach ($additions as $addition) {
            if (!is_array($addition)) {
                continue;
            }
            $name = $this->extractTaxonomyName($addition, 'taxonomy');
            if ($name === '') {
                continue;
            }
            $exists = false;
            foreach ($items as $item) {
                if ($this->extractTaxonomyName($item, 'taxonomy') === $name) {
                    $exists = true;
                    break;
                }
            }
            if (!$exists) {
                $items[] = $addition;
            }
        }

        return $items;
    }

    private function storeImportedExamPdf(?array $file): string
    {
        $upload = $this->validator->validateExamPdfUpload($file);
        if ($upload === null) {
            return '';
        }

        $filename = 'prova-' . date('YmdHis') . '-' . bin2hex(random_bytes(6)) . '.pdf';
        return (new ObjectStorage())->storeUploadedFile(
            (string) ($file['tmp_name'] ?? ''),
            'exams/' . $filename,
            'application/pdf'
        )['url'];
    }

    private function storeBase64ContextImage(string $base64): string
    {
        $normalized = preg_replace('/^data:image\/[a-z0-9.+-]+;base64,/i', '', trim($base64)) ?? '';
        if ($normalized === '') {
            return '';
        }

        $bytes = base64_decode($normalized, true);
        if (!is_string($bytes) || $bytes === '') {
            return '';
        }
        if (strlen($bytes) > 5 * 1024 * 1024 || @getimagesizefromstring($bytes) === false) {
            return '';
        }

        $filename = 'context-import-' . date('YmdHis') . '-' . bin2hex(random_bytes(6)) . '.jpg';
        return (new ObjectStorage())->storeBytes($bytes, 'question-contexts/' . $filename, 'image/jpeg')['url'];
    }

    private function persistQuestionContextAssets(array $assets): array
    {
        $persisted = [];
        foreach ($assets as $asset) {
            if (!is_array($asset)) {
                continue;
            }
            $base64 = trim((string) ($asset['base64'] ?? ''));
            if ($base64 !== '') {
                $asset['url'] = $this->storeBase64ContextImage($base64);
            }
            unset($asset['base64']);
            if (trim((string) ($asset['url'] ?? '')) === '') {
                continue;
            }
            $this->assertGranAssetWasMaterialized((string) $asset['url']);
            $persisted[] = $asset;
        }

        return $persisted;
    }

    private function resolveImportedContextText(array $context): string
    {
        $structuredText = trim((string) ($context['richText'] ?? $context['rich_text'] ?? ''));
        if ($structuredText !== '') {
            return str_contains($structuredText, 'data:image/')
                ? $this->persistInlineQuestionAssetImages($structuredText)
                : $structuredText;
        }

        // `body` e o campo canonico de contexts no contrato question-import.v2.
        // Os demais nomes permanecem apenas para ler lotes antigos ja enfileirados.
        $plainText = trim((string) (
            $context['body']
            ?? $context['text']
            ?? $context['texto']
            ?? ''
        ));
        return str_contains($plainText, 'data:image/')
            ? $this->persistInlineQuestionAssetImages($plainText)
            : $plainText;
    }

    private function scopeImportedContextExternalId(int $examId, string $externalId): string
    {
        if ($examId <= 0 || $externalId === '') {
            return '';
        }

        $scoped = 'exam-' . $examId . ':context:' . $externalId;
        if (strlen($scoped) <= 120) {
            return $scoped;
        }

        return 'exam-' . $examId . ':context-sha256:' . hash('sha256', $externalId);
    }

    private function persistQuestionRichTextImages(array $payload): array
    {
        foreach (['enunciado', 'introText', 'intro_text', 'referenceText', 'reference_text', 'teacherComment', 'detailedComment'] as $field) {
            if (isset($payload[$field]) && is_string($payload[$field]) && str_contains($payload[$field], 'data:image/')) {
                $payload[$field] = $this->persistInlineQuestionAssetImages($payload[$field]);
            }
        }

        if (isset($payload['itens']) && is_array($payload['itens'])) {
            $payload['itens'] = array_map(function ($item) {
                if (!is_array($item)) {
                    return $item;
                }

                foreach (['corpo', 'body', 'text'] as $field) {
                    if (isset($item[$field]) && is_string($item[$field]) && str_contains($item[$field], 'data:image/')) {
                        $item[$field] = $this->persistInlineQuestionAssetImages($item[$field]);
                    }
                }

                return $item;
            }, $payload['itens']);
        }

        if (isset($payload['content']) && is_array($payload['content'])) {
            foreach (['statement', 'supportText', 'reference'] as $field) {
                if (isset($payload['content'][$field]) && is_string($payload['content'][$field]) && str_contains($payload['content'][$field], 'data:image/')) {
                    $payload['content'][$field] = $this->persistInlineQuestionAssetImages($payload['content'][$field]);
                }
            }
        }

        $payload['assets'] = $this->persistCanonicalAssetCollection($payload['assets'] ?? []);
        if (isset($payload['alternatives']) && is_array($payload['alternatives'])) {
            foreach ($payload['alternatives'] as $index => $alternative) {
                if (!is_array($alternative)) {
                    continue;
                }
                if (isset($alternative['text']) && is_string($alternative['text']) && str_contains($alternative['text'], 'data:image/')) {
                    $alternative['text'] = $this->persistInlineQuestionAssetImages($alternative['text']);
                }
                $alternative['assets'] = $this->persistCanonicalAssetCollection($alternative['assets'] ?? []);
                $payload['alternatives'][$index] = $alternative;
            }
        }

        if (isset($payload['editorial']) && is_array($payload['editorial'])) {
            foreach ($payload['editorial'] as $index => $editorial) {
                if (is_array($editorial) && isset($editorial['body']) && is_string($editorial['body']) && str_contains($editorial['body'], 'data:image/')) {
                    $editorial['body'] = $this->persistInlineQuestionAssetImages($editorial['body']);
                    $payload['editorial'][$index] = $editorial;
                }
            }
        }

        return $payload;
    }

    private function persistCanonicalAssetCollection(mixed $assets): array
    {
        if (!is_array($assets)) {
            return [];
        }
        $persisted = [];
        foreach ($assets as $asset) {
            if (!is_array($asset)) {
                continue;
            }
            $base64 = trim((string) ($asset['base64'] ?? ''));
            $url = trim((string) ($asset['url'] ?? ''));
            if ($this->isTransientQuestionAssetUrl($url)) {
                if ($base64 === '') {
                    throw new InvalidArgumentException('A imagem temporaria expirou. Selecione o arquivo novamente antes de salvar.');
                }
                $url = '';
                $asset['url'] = '';
            }
            $dataUrl = $base64 !== '' ? $base64 : $url;
            if (preg_match('/^data:image\/([a-z0-9.+-]+);base64,(.+)$/is', $dataUrl, $matches) === 1) {
                $asset['url'] = $this->storeBase64QuestionAssetImage((string) $matches[1], (string) $matches[2]);
            }
            unset($asset['base64']);
            if (trim((string) ($asset['url'] ?? '')) === '') {
                continue;
            }
            $this->assertGranAssetWasMaterialized((string) $asset['url']);
            $persisted[] = $asset;
        }
        return $persisted;
    }

    private function assertGranAssetWasMaterialized(string $url): void
    {
        $parts = parse_url(trim($url));
        if (
            strtolower((string) ($parts['scheme'] ?? '')) === 'https'
            && strtolower((string) ($parts['host'] ?? '')) === 'arquivos.infra-questoes.grancursosonline.com.br'
        ) {
            throw new InvalidArgumentException(
                'A imagem da Gran nao foi copiada para o armazenamento da plataforma antes da publicacao.'
            );
        }
    }

    private function persistInlineQuestionAssetImages(string $html): string
    {
        return (string) preg_replace_callback(
            '/(<img\b[^>]*\bsrc\s*=\s*)(["\'])(data:image\/([a-z0-9.+-]+);base64,([a-z0-9+\/=\s]+))\2([^>]*>)/i',
            function (array $matches): string {
                $url = $this->storeBase64QuestionAssetImage((string) ($matches[4] ?? ''), (string) ($matches[5] ?? ''));
                if ($url === '') {
                    return (string) ($matches[0] ?? '');
                }

                return (string) ($matches[1] ?? '') . (string) ($matches[2] ?? '"') . $url . (string) ($matches[2] ?? '"') . (string) ($matches[6] ?? '');
            },
            $html
        );
    }

    private function storeBase64QuestionAssetImage(string $mimeSubtype, string $base64): string
    {
        $normalizedSubtype = strtolower(trim($mimeSubtype));
        $extension = match ($normalizedSubtype) {
            'jpeg', 'jpg' => 'jpg',
            'png' => 'png',
            'webp' => 'webp',
            'gif' => 'gif',
            default => '',
        };
        if ($extension === '') {
            return '';
        }

        $normalized = preg_replace('/\s+/', '', trim($base64)) ?? '';
        if ($normalized === '') {
            return '';
        }

        $bytes = base64_decode($normalized, true);
        if (!is_string($bytes) || $bytes === '') {
            return '';
        }
        if (strlen($bytes) > 6 * 1024 * 1024 || @getimagesizefromstring($bytes) === false) {
            return '';
        }

        $filename = 'question-asset-' . date('YmdHis') . '-' . bin2hex(random_bytes(6)) . '.' . $extension;
        $mimeType = $extension === 'jpg' ? 'image/jpeg' : 'image/' . $extension;
        return (new ObjectStorage())->storeBytes($bytes, 'question-assets/' . $filename, $mimeType)['url'];
    }

    private function syncQuestionFilters(string|int $questionId, array $taxonomies): array
    {
        $created = [];
        foreach ($taxonomies as $type => $items) {
            foreach ($items as $item) {
                $name = $this->extractTaxonomyName($item, (string) $type);
                if ($name === '') {
                    continue;
                }

                $filterType = $this->resolveFilterType((string) $type);
                $slug = $this->extractTaxonomySlug($item, $name);
                $metaMateria = $filterType === 'assunto' && $this->isMateriaTaxonomy($item) ? 1 : 0;
                $metaCarreira = $filterType === 'carreira' ? 1 : 0;
                $id = $this->extractNumericId($item);
                $sourceIdentity = $this->extractExternalTaxonomySourceIdentity($item, $filterType);

                if ($sourceIdentity !== null) {
                    $id = $this->repository->findFilterIdBySourceIdentity(
                        $filterType,
                        $sourceIdentity['provider'],
                        $sourceIdentity['entityType'],
                        $sourceIdentity['externalId']
                    );
                    if ($id === null) {
                        throw new InvalidArgumentException(
                            'A taxonomia Gran "' . $name . '" ainda nao foi sincronizada. '
                            . 'Sincronize as taxonomias da Gran antes de publicar o lote.'
                        );
                    }
                }

                // Um item Gran ja resolvido pelo ID local nao precisa recriar
                // nem procurar o pai pelo nome. Isso evita que um ancestral
                // externo ausente vire uma nova taxonomia local.
                $parentId = $sourceIdentity !== null
                    ? null
                    : $this->resolveTaxonomyParentId($item, $filterType);

                if ($id === null) {
                    $id = $this->repository->findFilterIdByIdentity($filterType, $name, $slug, $parentId)
                        ?? $this->repository->findFilterIdByIdentityAnyParent($filterType, $name, $slug, $parentId === null);
                }
                if ($id === null) {
                    $id = $this->repository->createFilter($filterType, $name, $slug, $metaMateria, $metaCarreira, $parentId);
                    $created[] = ['id' => $id, 'type' => $filterType, 'name' => $name, 'slug' => $slug, 'parentId' => $parentId];
                }

                $this->repository->linkQuestionFilter($questionId, $id);
            }
        }

        return $created;
    }

    private function resolveTaxonomyParentId(mixed $item, string $filterType): ?int
    {
        if (!is_array($item)) {
            return null;
        }
        foreach (['parentId', 'parent_id'] as $key) {
            if (isset($item[$key]) && is_numeric($item[$key]) && (int) $item[$key] > 0) {
                return (int) $item[$key];
            }
        }

        $parentName = $this->extractParentName($item);
        if ($parentName === '') {
            return null;
        }

        $parentType = $filterType === 'cargo' ? 'carreira' : 'assunto';
        $parentSlug = $this->slugify($parentName);
        $id = $this->repository->findFilterIdByIdentity($parentType, $parentName, $parentSlug, null)
            ?? $this->repository->findFilterIdByIdentityAnyParent($parentType, $parentName, $parentSlug, true);

        return $id ?? $this->repository->createFilter(
            $parentType,
            $parentName,
            $parentSlug,
            $parentType === 'assunto' ? 1 : 0,
            $parentType === 'carreira' ? 1 : 0,
            null
        );
    }

    /** @return array{provider:string,entityType:string,externalId:string}|null */
    private function extractExternalTaxonomySourceIdentity(mixed $item, string $filterType): ?array
    {
        if (!is_array($item) || strtolower(trim((string) ($item['provider'] ?? ''))) !== 'gran') {
            return null;
        }
        $externalId = trim((string) ($item['externalId'] ?? $item['external_id'] ?? ''));
        if ($externalId === '') {
            return null;
        }
        $entityType = strtolower(trim((string) ($item['sourceEntityType'] ?? $item['source_entity_type'] ?? '')));
        if ($entityType === '') {
            $entityType = match ($filterType) {
                'banca' => 'banca',
                'orgao' => 'orgao',
                'cargo' => 'cargo',
                'carreira' => 'area',
                default => 'assunto',
            };
        }

        return [
            'provider' => 'gran',
            'entityType' => $entityType,
            'externalId' => $externalId,
        ];
    }

    private function partitionFilters(array $filters): array
    {
        $buckets = ['bancas' => [], 'orgaos' => [], 'cargos' => [], 'assuntos' => [], 'anos' => [], 'carreiras' => [], 'niveis' => [], 'tiposProva' => []];
        foreach ($filters as $filter) {
            if (!is_array($filter)) {
                continue;
            }
            $type = strtolower(trim((string) ($filter['type'] ?? '')));
            $name = trim((string) ($filter['name'] ?? $filter['nome'] ?? ''));
            if ($type === '' || $name === '') {
                continue;
            }

            $id = is_numeric($filter['id'] ?? null) ? (int) $filter['id'] : null;
            $parentId = is_numeric($filter['parent_id'] ?? null) ? (int) $filter['parent_id'] : null;
            $base = [
                'id' => $id,
                'name' => $name,
                'nome' => $name,
                'slug' => (string) ($filter['slug'] ?? $this->slugify($name)),
                'parentId' => $parentId,
                'parent_id' => $parentId,
            ];

            if ($type === 'banca') {
                $buckets['bancas'][] = $base + ['sigla' => $name];
            } elseif ($type === 'orgao') {
                $buckets['orgaos'][] = $base + ['sigla' => $name];
            } elseif ($type === 'cargo') {
                $buckets['cargos'][] = $base + ['descricao' => $name, 'description' => $name, 'pai' => $parentId];
            } elseif ($type === 'carreira') {
                $buckets['carreiras'][] = $base + ['description' => $name, 'pai' => $parentId];
            } elseif ($type === 'assunto') {
                $isMateria = !empty($filter['meta_materia']) || !empty($filter['materia']);
                $buckets['assuntos'][] = $base + ['materia' => $isMateria, 'assunto_raiz' => $parentId, 'pai' => $parentId];
            } elseif ($type === 'ano') {
                $buckets['anos'][] = ctype_digit($name) ? (int) $name : $name;
            } elseif ($type === 'nivel') {
                $buckets['niveis'][] = $base;
            } elseif ($type === 'tipo_prova') {
                $buckets['tiposProva'][] = $base;
            }
        }

        return $buckets;
    }

    private function parseSerializedFilters(string $serialized): array
    {
        $filters = [];
        foreach (explode('|||', $serialized) as $chunk) {
            $parts = explode('::', trim($chunk));
            if (trim($chunk) === '') {
                continue;
            }
            $filters[] = [
                'id' => null,
                'type' => $parts[0] ?? '',
                'name' => $parts[1] ?? '',
                'slug' => $parts[2] ?? '',
                'meta_materia' => (int) ($parts[3] ?? 0),
                'parent_id' => null,
            ];
        }

        return $filters;
    }

    private function normalizeQuestionGroup(array $row): array
    {
        $ids = $this->normalizeQuestionGroupIds($row['question_ids'] ?? []);
        $text = trim((string) ($row['texto'] ?? ''));
        if ($text === '') {
            $text = trim((string) ($row['enunciado'] ?? ''));
        }
        $assets = $this->normalizeAssetsV2($this->decodeQuestionJson($row['assets_json'] ?? null));
        $legacyImageUrl = trim((string) ($row['image_url'] ?? ''));
        if ($assets === [] && $legacyImageUrl !== '' && !$this->isTransientQuestionAssetUrl($legacyImageUrl)) {
            $assets[] = [
                'id' => 'img_context_1',
                'type' => 'image',
                'usage' => 'context',
                'url' => $legacyImageUrl,
                'alt' => 'Imagem do contexto.',
                'caption' => '',
                'sourcePage' => null,
                'order' => 1,
            ];
        }

        return [
            'id' => (int) ($row['id'] ?? 0),
            'provaId' => isset($row['prova_id']) && (int) $row['prova_id'] > 0 ? (int) $row['prova_id'] : null,
            'provaTitle' => trim((string) ($row['prova_title'] ?? '')),
            'texto' => $text,
            'assets' => $assets,
            'questionIds' => $ids,
        ];
    }

    private function resolveQuestionGroup(array $row): ?array
    {
        $groupId = $row['group_id'] ?? $row['grupo_questao_id'] ?? null;
        if (!is_numeric($groupId) || (int) $groupId < 1) {
            return null;
        }
        if (array_key_exists('group_enunciado', $row) || array_key_exists('group_texto', $row)) {
            return $this->normalizeQuestionGroup([
                'id' => (int) $groupId,
                'enunciado' => $row['group_enunciado'] ?? '',
                'enunciado_clean' => $row['group_enunciado_clean'] ?? '',
                'texto' => $row['group_texto'] ?? '',
                'image_url' => $row['group_image_url'] ?? '',
                'assets_json' => $row['group_assets_json'] ?? null,
                'question_count' => 0,
                'question_ids' => '',
            ]);
        }

        $group = $this->repository->findQuestionGroupById((int) $groupId);
        return $group ? $this->normalizeQuestionGroup($group) : null;
    }

    private function isTransientQuestionAssetUrl(string $url): bool
    {
        return str_starts_with(strtolower(trim($url)), 'blob:');
    }

    private function decodeQuestionJson(mixed $value): array
    {
        if (!is_string($value) || trim($value) === '') {
            return [];
        }
        $decoded = json_decode($value, true);

        return is_array($decoded) ? $decoded : [];
    }

    private function normalizeItems(mixed $items): array
    {
        if (!is_array($items)) {
            return [];
        }
        $normalized = [];
        foreach (array_values($items) as $index => $item) {
            if (is_string($item) || is_numeric($item)) {
                $body = trim((string) $item);
                if ($body === '') {
                    continue;
                }
                $normalized[] = ['id' => $index + 1, 'ordem' => $index + 1, 'rotulo' => chr(65 + $index), 'corpo' => $body, 'corpo_clean' => strip_tags($body)];
                continue;
            }
            if (!is_array($item)) {
                continue;
            }
            $body = trim((string) ($item['corpo'] ?? $item['body'] ?? $item['text'] ?? ''));
            if ($body === '') {
                continue;
            }
            $normalized[] = [
                'id' => is_numeric($item['id'] ?? null) ? (int) $item['id'] : $index + 1,
                'ordem' => is_numeric($item['ordem'] ?? null) ? (int) $item['ordem'] : $index + 1,
                'rotulo' => (string) ($item['rotulo'] ?? $item['label'] ?? chr(65 + $index)),
                'corpo' => $body,
                'corpo_clean' => trim((string) ($item['corpo_clean'] ?? strip_tags($body))),
            ];
        }

        return $normalized;
    }

    private function resolveCorrectAnswerIndex(array $items, mixed $answer): int
    {
        $normalized = $this->normalizeItems($items);
        $count = count($normalized);
        if ($count < 1) {
            return 0;
        }
        if (is_numeric($answer)) {
            $numeric = (int) $answer;
            if ($numeric >= 1 && $numeric <= $count) {
                return $numeric - 1;
            }
            if ($numeric >= 0 && $numeric < $count) {
                return $numeric;
            }
        }
        $answerText = strtolower(trim((string) $answer));
        foreach (array_values($items) as $index => $item) {
            if (is_array($item) && (
                strtolower((string) ($item['id'] ?? '')) === $answerText ||
                strtolower((string) ($item['rotulo'] ?? $item['label'] ?? '')) === $answerText
            )) {
                return $index;
            }
        }

        return 0;
    }

    private function normalizeEditorialText(mixed $value): string
    {
        $text = trim((string) $value);
        if ($text === '') {
            return '';
        }
        $text = preg_replace('/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/u', '', $text) ?? $text;
        $text = preg_replace('/^```(?:markdown|md)?\s*/i', '', $text) ?? $text;
        $text = preg_replace('/```\s*$/', '', $text) ?? $text;

        return trim($text);
    }

    private function extractQuestionIds(array $rows): array
    {
        $ids = [];
        foreach ($rows as $row) {
            if (is_array($row) && isset($row['id']) && $row['id'] !== '') {
                $ids[(string) $row['id']] = $row['id'];
            }
        }

        return array_values($ids);
    }

    private function normalizeQuestionGroupIds(mixed $value): array
    {
        $items = is_array($value) ? $value : (preg_split('/[\s,;]+/', (string) $value, -1, PREG_SPLIT_NO_EMPTY) ?: []);
        $ids = [];
        foreach ($items as $item) {
            if (is_numeric($item) && (int) $item > 0) {
                $ids[(int) $item] = (int) $item;
            }
        }

        return array_values($ids);
    }

    private function assertAdmin(string $authenticatedUserId, bool $isAdmin): void
    {
        if ($authenticatedUserId === '') {
            throw new RuntimeException('Usuario nao autenticado.');
        }
        if (!$isAdmin) {
            throw new DomainException('Acesso restrito ao admin.');
        }
    }

    private function assertCanManageOwnedRecord(
        string $authenticatedUserId,
        string|int $recordId,
        ?array $ownership,
        string $notFoundMessage,
        string $staffForbiddenMessage
    ): void {
        if ($ownership === null) {
            throw new OutOfBoundsException($notFoundMessage);
        }

        $role = strtolower(trim((string) $this->repository->findUserRoleById($authenticatedUserId)));
        if ($this->ownershipPolicy->canManage($role, $authenticatedUserId, $ownership)) {
            return;
        }

        throw new DomainException($staffForbiddenMessage . ' ID: ' . (string) $recordId);
    }

    private function assertCanManageImportedExam(string $authenticatedUserId, array $record): void
    {
        $existingExamId = $this->repository->findImportedExamId($record);
        if ($existingExamId === null) {
            return;
        }

        $this->assertCanManageOwnedRecord(
            $authenticatedUserId,
            $existingExamId,
            $this->repository->findImportedExamOwnershipById($existingExamId),
            'Prova nao encontrada.',
            'Staff so pode editar provas publicadas por ele.'
        );
    }

    private function rollback(): void
    {
        if ($this->db->inTransaction()) {
            $this->db->rollBack();
        }
    }

    private function commitIfNeeded(): void
    {
        if ($this->db->inTransaction()) {
            $this->db->commit();
        }
    }

    private function isPublishedNow(array $row): bool
    {
        $status = strtolower((string) ($row['publish_status'] ?? 'published'));
        if ($status === 'published') {
            return true;
        }
        if ($status !== 'scheduled') {
            return false;
        }
        $scheduledAt = trim((string) ($row['scheduled_at'] ?? ''));

        return $scheduledAt !== '' && strtotime($scheduledAt) !== false && strtotime($scheduledAt) <= time();
    }

    private function buildUploadUrl(string $path): string
    {
        $scriptName = (string) ($_SERVER['SCRIPT_NAME'] ?? '');
        $basePath = '';
        $apiPos = strpos($scriptName, '/api/');
        if ($apiPos !== false) {
            $basePath = rtrim(substr($scriptName, 0, $apiPos), '/');
        }
        $relative = $basePath . $path;
        $host = trim((string) ($_SERVER['HTTP_HOST'] ?? ''));
        if ($host === '') {
            return $relative;
        }

        $scheme = (!empty($_SERVER['HTTPS']) && strtolower((string) $_SERVER['HTTPS']) !== 'off') ? 'https' : 'http';
        return $scheme . '://' . $host . $relative;
    }

    private function extractTaxonomyName(mixed $item, string $type): string
    {
        if (is_string($item) || is_numeric($item)) {
            return trim((string) $item);
        }
        if (!is_array($item)) {
            return '';
        }
        $keys = $type === 'cargo'
            ? ['descricao', 'description', 'name', 'nome', 'sigla', 'label']
            : ['name', 'nome', 'sigla', 'descricao', 'description', 'label'];
        foreach ($keys as $key) {
            $value = trim((string) ($item[$key] ?? ''));
            if ($value !== '') {
                return $value;
            }
        }

        return '';
    }

    private function extractTaxonomySlug(mixed $item, string $name): string
    {
        if (is_array($item) && trim((string) ($item['slug'] ?? '')) !== '') {
            return trim((string) $item['slug']);
        }

        return $this->slugify($name);
    }

    private function extractNumericId(mixed $item): ?int
    {
        return is_array($item) && isset($item['id']) && is_numeric($item['id']) && (int) $item['id'] > 0
            ? (int) $item['id']
            : null;
    }

    private function resolveFilterType(string $type): string
    {
        $type = strtolower(trim($type));
        return match ($type) {
            'bancas' => 'banca',
            'orgaos' => 'orgao',
            'cargos' => 'cargo',
            'anos' => 'ano',
            'carreiras', 'focos', 'focuses' => 'carreira',
            '' => 'assunto',
            default => $type,
        };
    }

    private function isMateriaTaxonomy(mixed $item): bool
    {
        return is_array($item) && !empty($item['materia']);
    }

    private function extractParentName(array $item): string
    {
        foreach (['parentName', 'parent_name', 'rootSubjectName', 'root_subject_name', 'materiaNome', 'materia_nome'] as $key) {
            $value = trim((string) ($item[$key] ?? ''));
            if ($value !== '') {
                return $value;
            }
        }

        return '';
    }

    private function firstTaxonomyName(array $items): string
    {
        foreach ($items as $item) {
            if (is_array($item) && empty($item['materia'])) {
                return (string) ($item['name'] ?? $item['nome'] ?? '');
            }
        }

        return '';
    }

    private function difficultyLabel(int $difficulty): string
    {
        return match ($difficulty) {
            1 => 'Facil',
            2 => 'Medio',
            3 => 'Dificil',
            4 => 'Muito dificil',
            5 => 'Muito facil',
            default => 'Medio',
        };
    }

    private function slugify(string $value): string
    {
        $ascii = $value;
        if (function_exists('iconv')) {
            $converted = iconv('UTF-8', 'ASCII//TRANSLIT//IGNORE', $value);
            if (is_string($converted) && $converted !== '') {
                $ascii = $converted;
            }
        }
        $slug = strtolower($ascii);
        $slug = preg_replace('/[^a-z0-9]+/i', '-', $slug) ?? '';
        $slug = trim($slug, '-');

        return $slug !== '' ? $slug : 'item-' . substr(sha1($value), 0, 8);
    }

    private function generateNotificationId(): string
    {
        return sprintf(
            '%04x%04x-%04x-%04x-%04x-%04x%04x%04x',
            mt_rand(0, 0xffff),
            mt_rand(0, 0xffff),
            mt_rand(0, 0xffff),
            mt_rand(0, 0x0fff) | 0x4000,
            mt_rand(0, 0x3fff) | 0x8000,
            mt_rand(0, 0xffff),
            mt_rand(0, 0xffff),
            mt_rand(0, 0xffff)
        );
    }

    private function enforceUsageLimit(string $userId, string $limitKey): void
    {
        enforceUserPlanUsageLimitAvailable($this->db, $userId, $limitKey);
    }
}
