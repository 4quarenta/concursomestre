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
require_once __DIR__ . '/LegalCommentaryAiGenerationService.php';
require_once __DIR__ . '/../../../config/payment_provider.php';
require_once __DIR__ . '/../../../config/gamification_helper.php';

/**
 * Regras de negocio do Vade Mecum comentado.
 *
 * @since 1.0.0
 */
class LegalCommentaryService
{
    private LegalCommentaryRepository $repository;
    private LegalCommentaryAiGenerationService $aiGenerationService;

    /** @var array<int, string> */
    private const FEATURE_KEYS = [
        'lei.texto',
        'lei.comentario_basico',
        'lei.doutrina',
        'lei.macete',
        'lei.como_cai',
        'lei.jurisprudencia',
        'lei.sumulas',
        'lei.questoes',
        'lei.raiox',
        'lei.anotacoes',
        'lei.modo_foco',
        'lei.favoritos',
        'lei.solicitar_comentario',
    ];

    public function __construct(
        LegalCommentaryRepository $repository,
        LegalCommentaryAiGenerationService $aiGenerationService
    )
    {
        $this->repository = $repository;
        $this->aiGenerationService = $aiGenerationService;
    }

    public function home(?string $userId = null): array
    {
        return $this->repository->fetchHome($userId);
    }

    public function search(string $query, ?string $userId = null): array
    {
        return $this->repository->search($query, $userId);
    }

    public function detail(string $identifier, ?string $userId = null, bool $incrementAccess = false): array
    {
        $detail = $this->repository->fetchLawDetail($identifier, $userId, $incrementAccess);
        if (!$detail || !$this->isPubliclyVisibleLaw($detail)) {
            throw new RuntimeException('Lei nao encontrada.', 404);
        }

        return $this->decorateLawDetailForStudy($detail, $userId);
    }

    public function detailOutline(string $identifier, ?string $userId = null): array
    {
        $outline = $this->repository->fetchLawOutline($identifier, $userId);
        if (!$outline || !$this->isPubliclyVisibleLaw($outline)) {
            throw new RuntimeException('Lei nao encontrada.', 404);
        }

        return $outline;
    }

    private function isPubliclyVisibleLaw(array $law): bool
    {
        $status = (string) ($law['status'] ?? '');
        if ($status === 'active' || $status === 'published') {
            return true;
        }

        if ($status !== 'scheduled') {
            return false;
        }

        $date = trim((string) ($law['publishedAt'] ?? $law['published_at'] ?? $law['date'] ?? ''));
        if ($date === '') {
            return false;
        }

        $timestamp = strtotime($date);
        return $timestamp !== false && $timestamp <= time();
    }

    public function toggleFavorite(string $userId, string $targetType, string $targetId, string $userRole = ''): array
    {
        $allowedTypes = ['law', 'section', 'article', 'jurisprudence', 'teacher_comment'];
        if (!in_array($targetType, $allowedTypes, true) || trim($targetId) === '') {
            throw new InvalidArgumentException('Favorito invalido.');
        }

        if (!$this->repository->hasFavorite($userId, $targetType, $targetId)) {
            $this->enforceUsageLimit($userId, $userRole, 'lei_favorites_limit');
        }

        $result = $this->repository->toggleFavorite($userId, $targetType, $targetId);

        if (!empty($result['isFavorite'])) {
            try {
                applyLegalFavoriteGamification($this->repository->getConnection(), $userId, $targetType, $targetId);
            } catch (Throwable $e) {
                error_log('[LegalCommentaryService] Falha ao aplicar gamificacao de favorito: ' . $e->getMessage());
            }
        }

        return $result;
    }

    public function recordProgress(string $userId, array $payload): array
    {
        $lawId = trim((string) ($payload['lawId'] ?? ''));
        $articleId = trim((string) ($payload['articleId'] ?? ''));

        if ($lawId === '') {
            throw new InvalidArgumentException('Lei nao informada.');
        }

        if ($articleId === '') {
            $this->repository->recordLawView($userId, $lawId);
            return ['ok' => true];
        }

        $result = $this->repository->recordArticleView($userId, $lawId, $articleId);

        try {
            applyLegalArticleReadGamification(
                $this->repository->getConnection(),
                $userId,
                $lawId,
                $articleId,
                (int) ($result['progressPercent'] ?? 0)
            );
        } catch (Throwable $e) {
            error_log('[LegalCommentaryService] Falha ao aplicar gamificacao de leitura: ' . $e->getMessage());
        }

        return $result;
    }

    public function listUserNotes(string $userId): array
    {
        return [
            'notes' => $this->repository->fetchUserNotes($userId),
        ];
    }

    public function saveUserNote(string $userId, array $payload): array
    {
        return $this->repository->saveUserNote($userId, $payload);
    }

    public function deleteUserNote(string $userId, array $payload): array
    {
        $articleId = (int) ($payload['articleId'] ?? $payload['article_id'] ?? 0);
        if ($articleId <= 0) {
            throw new InvalidArgumentException('Informe o artigo da anotacao.');
        }

        return [
            'deleted' => $this->repository->deleteUserNoteByArticle($userId, $articleId),
            'articleId' => (string) $articleId,
        ];
    }

    public function getReaderAnnotation(string $userId, array $payload): array
    {
        $lawId = (int) ($payload['lawId'] ?? $payload['law_id'] ?? 0);
        $sectionId = (int) ($payload['sectionId'] ?? $payload['section_id'] ?? 0);
        if ($lawId <= 0 || $sectionId <= 0) {
            throw new InvalidArgumentException('Informe a lei e a secao das marcacoes.');
        }

        return [
            'annotation' => $this->repository->fetchReaderAnnotation($userId, $lawId, $sectionId),
        ];
    }

    public function saveReaderAnnotation(string $userId, array $payload): array
    {
        return $this->repository->saveReaderAnnotation($userId, $payload);
    }

    public function deleteReaderAnnotation(string $userId, array $payload): array
    {
        $lawId = (int) ($payload['lawId'] ?? $payload['law_id'] ?? 0);
        $sectionId = (int) ($payload['sectionId'] ?? $payload['section_id'] ?? 0);
        if ($lawId <= 0 || $sectionId <= 0) {
            throw new InvalidArgumentException('Informe a lei e a secao das marcacoes.');
        }

        return [
            'deleted' => $this->repository->deleteReaderAnnotation($userId, $lawId, $sectionId),
            'sectionId' => (string) $sectionId,
        ];
    }

    public function createComment(string $userId, string $userName, array $payload, string $userRole = ''): array
    {
        $this->enforceUsageLimit($userId, $userRole, 'comments_per_day');

        $comment = $this->repository->createUserComment(
            $userId,
            $userName,
            (string) ($payload['articleId'] ?? ''),
            (string) ($payload['body'] ?? ''),
            isset($payload['parentCommentId']) ? (string) $payload['parentCommentId'] : null
        );

        try {
            applyLegalUserCommentGamification(
                $this->repository->getConnection(),
                $userId,
                (string) ($comment['id'] ?? ''),
                (string) ($payload['articleId'] ?? '')
            );
        } catch (Throwable $e) {
            error_log('[LegalCommentaryService] Falha ao aplicar gamificacao de comentario legal: ' . $e->getMessage());
        }

        return $comment;
    }

    public function updateComment(string $userId, array $payload): array
    {
        return $this->repository->updateUserComment(
            $userId,
            (string) ($payload['commentId'] ?? $payload['id'] ?? ''),
            (string) ($payload['body'] ?? '')
        );
    }

    public function deleteComment(string $userId, array $payload): void
    {
        $this->repository->deleteUserComment(
            $userId,
            (string) ($payload['commentId'] ?? $payload['id'] ?? '')
        );
    }

    public function reportComment(string $userId, array $payload): array
    {
        return $this->repository->reportUserComment(
            $userId,
            (string) ($payload['commentId'] ?? $payload['id'] ?? '')
        );
    }

    private function enforceUsageLimit(string $userId, string $userRole, string $limitKey): void
    {
        if (in_array($userRole, ['admin', 'staff'], true)) {
            return;
        }

        enforceUserPlanUsageLimitAvailable($this->repository->getConnection(), $userId, $limitKey);
    }

    public function reactToContent(string $userId, array $payload): array
    {
        $rawValue = $payload['value'] ?? $payload['reaction'] ?? null;
        $reactionValue = $rawValue === null ? null : strtolower(trim((string) $rawValue));
        if ($reactionValue === '' || $reactionValue === 'null' || $reactionValue === 'none') {
            $reactionValue = null;
        }

        return $this->repository->setContentReaction(
            $userId,
            (string) ($payload['targetKey'] ?? $payload['target_key'] ?? ''),
            $reactionValue
        );
    }

    public function adminList(?string $query = null): array
    {
        return [
            'laws' => $this->repository->fetchAdminList($query),
            'home' => $this->repository->fetchHome(null),
        ];
    }

    public function adminDetail(string $identifier): array
    {
        return [
            'law' => $this->detail($identifier, null, false),
            'areas' => $this->repository->fetchHome(null)['areas'],
        ];
    }

    public function adminNew(): array
    {
        return [
            'law' => null,
            'areas' => $this->repository->fetchHome(null)['areas'],
        ];
    }

    public function adminSave(array $payload): array
    {
        return $this->repository->saveAdminPayload($payload);
    }

    public function adminDelete(int $lawId, string $adminUserId = '', string $adminRole = ''): void
    {
        if ($lawId <= 0) {
            throw new InvalidArgumentException('Lei invalida.');
        }

        $this->repository->deleteLaw($lawId, $adminUserId, $adminRole);
    }

    public function adminGenerateEditorial(array $payload): array
    {
        return $this->aiGenerationService->generateArticleEditorial($payload);
    }

    public function adminStartBatch(int $lawId, array $articleIds = [], ?string $adminUserId = null): array
    {
        return $this->aiGenerationService->startBatchRun($lawId, $adminUserId, $articleIds);
    }

    public function adminBatchStatus(int $runId, ?int $lawId = null): array
    {
        return $this->aiGenerationService->fetchBatchRun($runId, $lawId);
    }

    public function adminRetryBatch(int $runId, ?string $adminUserId = null): array
    {
        return $this->aiGenerationService->retryFailedBatch($runId, $adminUserId);
    }

    public function adminStopBatch(int $runId): array
    {
        return $this->aiGenerationService->stopBatchRun($runId);
    }

    private function decorateLawDetailForStudy(array $detail, ?string $userId): array
    {
        $db = $this->repository->getConnection();
        $entitlements = getConfiguredPlanEntitlements($db);
        $limits = getConfiguredPlanUsageLimits($db);
        $featureConfig = getConfiguredLegalCommentaryFeatureConfig($db);
        $snapshot = $userId ? getUserAccessPlanSnapshot($db, $userId) : [
            'exists' => false,
            'is_admin' => false,
            'plan_name' => 'Gratuito',
            'status' => 'inactive',
        ];

        $resolvedPlanName = !empty($snapshot['is_admin'])
            ? 'Elite'
            : (
                hasActivePlanAccess($snapshot['status'] ?? null)
                    ? canonicalUserPlanValue($snapshot['plan_name'] ?? 'Gratuito')
                    : 'Gratuito'
            );

        $featureAccess = $this->buildFeatureAccessMap(
            $db,
            $resolvedPlanName,
            $userId,
            $entitlements,
            $limits,
            $featureConfig
        );

        $articles = is_array($detail['articles'] ?? null) ? $detail['articles'] : [];
        $maxRelatedQuestionCount = 1;
        foreach ($articles as $article) {
            $maxRelatedQuestionCount = max(
                $maxRelatedQuestionCount,
                (int) ($article['relatedQuestionCount'] ?? $article['questoesRelacionadas'] ?? 0)
            );
        }

        $detail['articles'] = array_map(
            fn(array $article): array => $this->decorateArticleForStudy($article, $detail, $featureAccess, $maxRelatedQuestionCount),
            $articles
        );
        $detail['features'] = $featureAccess;
        $detail['hasLockedFeatures'] = $this->hasLockedFeatures($featureAccess);
        $detail['planAccess'] = [
            'planName' => $resolvedPlanName,
            'status' => (string) ($snapshot['status'] ?? 'inactive'),
            'isAdmin' => !empty($snapshot['is_admin']),
        ];
        $detail['teacherComments'] = [];
        $detail['jurisprudence'] = [];
        $detail['examTips'] = [];
        $detail['sumulas'] = [];

        return $detail;
    }

    private function buildFeatureAccessMap(
        PDO $db,
        string $planName,
        ?string $userId,
        array $entitlements,
        array $limits,
        array $featureConfig
    ): array {
        $featureAccess = [];

        foreach (self::FEATURE_KEYS as $featureKey) {
            if ($featureKey === 'lei.texto') {
                $featureAccess[$featureKey] = [
                    'feature_key' => $featureKey,
                    'requires_plan' => 'Gratuito',
                    'enabled' => true,
                    'mode' => 'full',
                    'fallback_mode' => 'full',
                    'limit_key' => null,
                    'limit_value' => null,
                ];
                continue;
            }

            $enabled = $userId
                ? userHasPlanBenefit($db, $userId, $featureKey)
                : planHasBenefit('Gratuito', $featureKey, $entitlements);
            $fallbackMode = (string) ($featureConfig[$featureKey]['fallbackMode'] ?? 'locked');
            if (!in_array($fallbackMode, ['preview', 'locked', 'hidden'], true)) {
                $fallbackMode = 'locked';
            }

            $limitKey = $this->mapFeatureLimitKey($featureKey);

            $featureAccess[$featureKey] = [
                'feature_key' => $featureKey,
                'requires_plan' => getBenefitRequiredPlanName($featureKey, $entitlements),
                'enabled' => $enabled,
                'mode' => $enabled ? 'full' : $fallbackMode,
                'fallback_mode' => $fallbackMode,
                'limit_key' => $limitKey,
                'limit_value' => $limitKey ? getPlanUsageLimitValueForPlanName($planName, $limitKey, $limits) : null,
            ];
        }

        return $featureAccess;
    }

    private function mapFeatureLimitKey(string $featureKey): ?string
    {
        if ($featureKey === 'lei.questoes') {
            return 'lei_related_questions_limit';
        }

        if ($featureKey === 'lei.anotacoes') {
            return 'lei_annotations_limit';
        }

        if ($featureKey === 'lei.favoritos') {
            return 'lei_favorites_limit';
        }

        return null;
    }

    private function hasLockedFeatures(array $featureAccess): bool
    {
        foreach ($featureAccess as $featureKey => $state) {
            if ($featureKey === 'lei.texto') {
                continue;
            }

            if (($state['mode'] ?? 'full') !== 'full') {
                return true;
            }
        }

        return false;
    }

    private function decorateArticleForStudy(array $article, array $detail, array $featureAccess, int $maxRelatedQuestionCount): array
    {
        $teacherComments = array_values(is_array($article['comentarios'] ?? null) ? $article['comentarios'] : []);
        $jurisprudence = array_values(is_array($article['jurisprudencia'] ?? null) ? $article['jurisprudencia'] : []);
        $examTip = $this->normalizeContentText($article['examTip'] ?? $article['macete'] ?? '');
        $firstTeacherComment = $teacherComments[0] ?? null;
        $firstJurisprudence = $jurisprudence[0] ?? null;
        $relatedQuestionCount = (int) ($article['relatedQuestionCount'] ?? $article['questoesRelacionadas'] ?? 0);
        $frequencyPercent = $this->resolveFrequencyPercent($relatedQuestionCount, $maxRelatedQuestionCount);
        $theme = $this->resolveArticleTheme($detail, $article);
        $connections = $this->buildConnections($detail, $article);

        $studyModules = array_filter([
            'basicComment' => $this->resolveModulePayload(
                $featureAccess['lei.comentario_basico'],
                $this->buildBasicCommentModule($article, $firstTeacherComment)
            ),
            'macete' => $this->resolveModulePayload(
                $featureAccess['lei.macete'],
                $this->buildMaceteModule($article, $firstTeacherComment)
            ),
            'howExamCovers' => $this->resolveModulePayload(
                $featureAccess['lei.como_cai'],
                $this->buildHowExamCoversModule($article, $firstTeacherComment)
            ),
            'jurisprudence' => $this->resolveModulePayload(
                $featureAccess['lei.jurisprudencia'],
                $this->buildJurisprudenceModule($firstJurisprudence)
            ),
            'frequency' => $this->resolveModulePayload(
                $featureAccess['lei.como_cai'],
                $this->buildFrequencyModule($relatedQuestionCount, $frequencyPercent)
            ),
            'questions' => $this->resolveModulePayload(
                $featureAccess['lei.questoes'],
                $this->buildQuestionsModule($article, $relatedQuestionCount)
            ),
            'xray' => $this->resolveModulePayload(
                $featureAccess['lei.raiox'],
                $this->buildXRayModule($frequencyPercent, $theme, $connections)
            ),
            'connections' => $this->resolveModulePayload(
                $featureAccess['lei.raiox'],
                $this->buildConnectionsModule($connections)
            ),
        ], static fn($item) => $item !== null);

        $article['studyModules'] = $studyModules;
        $article['comentarios'] = $teacherComments;
        $article['jurisprudencia'] = $jurisprudence;
        $article['macete'] = $examTip !== '' ? $examTip : null;
        $article['examTip'] = $article['macete'];

        return $article;
    }

    private function resolveModulePayload(array $featureState, array $module): ?array
    {
        $mode = (string) ($featureState['mode'] ?? 'full');
        if ($mode === 'hidden') {
            return null;
        }

        $payload = $module;
        $payload['feature'] = $featureState;
        $payload['mode'] = $mode;

        if ($mode === 'locked') {
            unset($payload['body'], $payload['front'], $payload['back'], $payload['items'], $payload['percent'], $payload['level'], $payload['connections']);
            return $payload;
        }

        if ($mode === 'preview') {
            $payload['body'] = null;
            if (!isset($payload['preview'])) {
                $payload['preview'] = $this->previewText((string) ($module['body'] ?? ''));
            }

            if (isset($payload['front'])) {
                $payload['front'] = $this->previewText((string) $payload['front'], 8);
            }

            if (isset($payload['back'])) {
                $payload['back'] = $this->previewText((string) $payload['back'], 8);
            }

            return $payload;
        }

        if (!isset($payload['preview']) && !empty($payload['body'])) {
            $payload['preview'] = $this->previewText((string) $payload['body']);
        }

        return $payload;
    }

    private function buildBasicCommentModule(array $article, ?array $teacherComment): array
    {
        $body = $this->normalizeContentText(
            $teacherComment['body'] ?? $teacherComment['texto'] ?? ''
        );

        if ($body === '') {
            $body = $this->previewText((string) ($article['text'] ?? $article['texto'] ?? ''), 48);
        }

        return [
            'title' => 'Comentario basico',
            'badge' => 'Gratuito',
            'body' => $body,
            'preview' => $this->previewText($body, 26),
        ];
    }

    private function buildMaceteModule(array $article, ?array $teacherComment): array
    {
        $candidate = $this->firstNonEmptyString([
            $article['macete'] ?? null,
            $teacherComment['pitfalls'][0] ?? null,
            $teacherComment['examFocus'][0] ?? null,
            $teacherComment['body'] ?? null,
        ]);

        return [
            'title' => 'Macete',
            'kicker' => 'Memorize em segundos',
            'body' => $candidate,
            'preview' => $this->previewText($candidate, 16),
        ];
    }

    private function buildHowExamCoversModule(array $article, ?array $teacherComment): array
    {
        $lines = [];

        foreach (($teacherComment['examFocus'] ?? []) as $entry) {
            $text = $this->normalizeContentText($entry);
            if ($text !== '') {
                $lines[] = $text;
            }
        }

        foreach (($teacherComment['pitfalls'] ?? []) as $entry) {
            $text = $this->normalizeContentText($entry);
            if ($text !== '') {
                $lines[] = $text;
            }
        }

        if (empty($lines)) {
            $lines[] = $this->previewText((string) ($teacherComment['body'] ?? $article['text'] ?? ''), 26);
        }

        $body = implode("\n\n", array_slice($lines, 0, 3));

        return [
            'title' => 'Como cai em prova',
            'kicker' => 'Padrao de cobranca',
            'body' => $body,
            'preview' => $this->previewText($body, 20),
        ];
    }

    private function buildJurisprudenceModule(?array $jurisprudence): array
    {
        $summary = $this->normalizeContentText($jurisprudence['summary'] ?? $jurisprudence['texto'] ?? '');
        $impact = $this->normalizeContentText($jurisprudence['examImpact'] ?? '');
        $body = trim($summary . ($impact !== '' ? "\n\n" . $impact : ''));

        return [
            'title' => 'Jurisprudencia direcionada',
            'kicker' => 'O que ja caiu em prova',
            'court' => (string) ($jurisprudence['court'] ?? $jurisprudence['tribunal'] ?? 'STJ'),
            'body' => $body,
            'preview' => $this->previewText($body, 18),
        ];
    }

    private function buildFrequencyModule(int $relatedQuestionCount, int $frequencyPercent): array
    {
        return [
            'title' => 'Frequencia de cobranca',
            'kicker' => 'Historico em provas',
            'count' => $relatedQuestionCount,
            'percent' => $frequencyPercent,
            'level' => $this->resolveFrequencyLevel($frequencyPercent),
            'preview' => $relatedQuestionCount > 0
                ? sprintf('%d questoes encontradas sobre este artigo.', $relatedQuestionCount)
                : 'Sem volume relevante de cobranca mapeado ate aqui.',
        ];
    }

    private function buildQuestionsModule(array $article, int $relatedQuestionCount): array
    {
        return [
            'title' => 'Questoes relacionadas',
            'count' => $relatedQuestionCount,
            'ctaUrl' => '/practice?articleId=' . urlencode((string) ($article['id'] ?? '')),
            'preview' => sprintf('%d questoes disponiveis para praticar este artigo.', max(0, $relatedQuestionCount)),
        ];
    }

    private function buildFlashcardModule(array $article): array
    {
        $articleNumber = trim((string) ($article['number'] ?? $article['numero'] ?? 'Artigo'));
        $text = $this->normalizeContentText((string) ($article['text'] ?? $article['texto'] ?? ''));

        return [
            'title' => 'Flashcard automatico',
            'front' => $articleNumber,
            'back' => $this->previewText($text, 12),
            'preview' => $this->previewText($text, 14),
        ];
    }

    private function buildXRayModule(int $frequencyPercent, string $theme, array $connections): array
    {
        return [
            'title' => 'Raio-X do artigo',
            'importance' => $this->resolveFrequencyLevel($frequencyPercent),
            'theme' => $theme,
            'connections' => array_slice($connections, 0, 3),
            'preview' => sprintf('%s e conectado a %s.', $theme, implode(', ', array_slice($connections, 0, 2))),
        ];
    }

    private function buildConnectionsModule(array $connections): array
    {
        return [
            'title' => 'Conexoes do tema',
            'items' => array_slice($connections, 0, 4),
            'preview' => implode(' • ', array_slice($connections, 0, 3)),
        ];
    }

    private function resolveFrequencyPercent(int $relatedQuestionCount, int $maxRelatedQuestionCount): int
    {
        if ($maxRelatedQuestionCount <= 0) {
            return 0;
        }

        return max(8, (int) round(($relatedQuestionCount / $maxRelatedQuestionCount) * 100));
    }

    private function resolveFrequencyLevel(int $frequencyPercent): string
    {
        if ($frequencyPercent >= 70) {
            return 'Alta';
        }

        if ($frequencyPercent >= 40) {
            return 'Media';
        }

        return 'Baixa';
    }

    private function resolveArticleTheme(array $detail, array $article): string
    {
        $hierarchy = is_array($article['hierarchy'] ?? null) ? $article['hierarchy'] : [];

        return $this->firstNonEmptyString([
            $hierarchy['title'] ?? null,
            $hierarchy['section'] ?? null,
            $hierarchy['chapter'] ?? null,
            $detail['shortTitle'] ?? null,
            $detail['title'] ?? null,
            'Tema central do artigo',
        ]);
    }

    private function buildConnections(array $detail, array $article): array
    {
        $hierarchy = is_array($article['hierarchy'] ?? null) ? $article['hierarchy'] : [];
        $areaName = is_array($detail['area'] ?? null) ? (string) ($detail['area']['name'] ?? $detail['area']['nome'] ?? '') : '';
        $lawName = (string) ($detail['shortTitle'] ?? $detail['title'] ?? '');

        $connections = [
            $areaName,
            (string) ($hierarchy['title'] ?? ''),
            (string) ($hierarchy['chapter'] ?? ''),
            (string) ($hierarchy['section'] ?? ''),
            $lawName,
        ];

        $normalized = [];
        foreach ($connections as $connection) {
            $value = trim((string) $connection);
            if ($value === '' || in_array($value, $normalized, true)) {
                continue;
            }
            $normalized[] = $value;
        }

        return $normalized;
    }

    private function previewText(string $text, int $wordLimit = 20): string
    {
        $normalized = $this->normalizeContentText($text);
        if ($normalized === '') {
            return '';
        }

        $words = preg_split('/\s+/', $normalized) ?: [];
        if (count($words) <= $wordLimit) {
            return $normalized;
        }

        return implode(' ', array_slice($words, 0, $wordLimit)) . '...';
    }

    private function normalizeContentText($value): string
    {
        $text = trim((string) $value);
        if ($text === '') {
            return '';
        }

        $text = preg_replace('/<[^>]+>/', ' ', $text) ?: $text;
        $text = preg_replace('/\s+/', ' ', $text) ?: $text;

        return trim($text);
    }

    private function firstNonEmptyString(array $values): string
    {
        foreach ($values as $value) {
            $text = $this->normalizeContentText($value);
            if ($text !== '') {
                return $text;
            }
        }

        return '';
    }
}
