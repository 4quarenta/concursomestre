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

require_once __DIR__ . '/../repositories/UsersRepository.php';
require_once __DIR__ . '/../validators/UsersValidator.php';
require_once __DIR__ . '/../../../config/payment_provider.php';
require_once __DIR__ . '/../../../config/notification_helper.php';
require_once __DIR__ . '/../../../config/gamification_helper.php';
require_once __DIR__ . '/../../subscriptions/services/SubscriptionsBillingSupport.php';
require_once __DIR__ . '/../../../shared/pagination/SignedKeysetCursor.php';
require_once __DIR__ . '/../../finance/services/ReferralFinance.php';

/**
 * Service do dominio de Usuarios.
 * Concentra as regras do perfil autenticado sem vazar SQL para controller.
 */
class UsersService
{
    private UsersRepository $repository;
    private UsersValidator $validator;

    /**
     * Monta a camada de orquestracao do perfil autenticado, cards e rewards.
     *
     * @since 1.0.0
     */
    public function __construct(
        UsersRepository $repository,
        UsersValidator $validator
    ) {
        $this->repository = $repository;
        $this->validator = $validator;
    }

    /**
     * Monta o resumo de indicacoes usado no perfil do aluno.
      * @since 1.0.0
     */
    public function getReferralStats(string $userId, string $frontendBaseUrl): array
    {
        $this->validator->validateAuthenticatedUserId($userId);

        $referralCode = $this->repository->getReferralCode($userId);
        if (!$referralCode) {
            $referralCode = strtoupper(substr(str_replace('-', '', $userId), 0, 8));
            $this->repository->saveReferralCode($userId, $referralCode);
        }

        return ReferralFinance::userSummary(
            $this->repository->getConnection(),
            $userId,
            $frontendBaseUrl
        );
    }

    /**
     * Troca a senha do proprio Usuario autenticado apos validar a senha atual.
      * @since 1.0.0
     */
    public function changePassword(string $userId, array $payload): array
    {
        $this->validator->validateAuthenticatedUserId($userId);
        $this->validator->validatePasswordChangePayload($payload);

        $currentPassword = (string) $payload['current'];
        $newPassword = (string) $payload['new'];

        $passwordHash = $this->repository->getPasswordHashById($userId);
        if (!$passwordHash || !password_verify($currentPassword, $passwordHash)) {
            throw new InvalidArgumentException('A senha atual informada esta incorreta.');
        }

        $this->repository->updatePasswordHash($userId, password_hash($newPassword, PASSWORD_DEFAULT));

        return [
            'message' => 'Senha alterada com sucesso.',
        ];
    }

    /**
     * Salva uma nova foto de perfil em disco e sincroniza o caminho no banco.
      * @since 1.0.0
     */
    public function uploadProfilePhoto(string $userId, array $file, string $projectRoot): array
    {
        $this->validator->validateAuthenticatedUserId($userId);
        $upload = $this->validator->validateProfilePhotoUpload($file);
        $extension = $upload['extension'] ?? 'jpg';
        $uploadsDir = rtrim($projectRoot, DIRECTORY_SEPARATOR) . DIRECTORY_SEPARATOR . 'uploads' . DIRECTORY_SEPARATOR . 'profiles';

        if (!is_dir($uploadsDir) && !mkdir($uploadsDir, 0777, true) && !is_dir($uploadsDir)) {
            throw new RuntimeException('Nao foi possivel preparar o diretorio de upload.');
        }

        $safeName = $userId . '_' . time() . '_' . bin2hex(random_bytes(6)) . '.' . $extension;
        $absolutePath = $uploadsDir . DIRECTORY_SEPARATOR . $safeName;
        $relativePath = 'uploads/profiles/' . $safeName;

        if (!move_uploaded_file($file['tmp_name'], $absolutePath)) {
            throw new RuntimeException('Nao foi possivel salvar a imagem enviada.');
        }

        try {
            $this->repository->updatePhotoUrl($userId, $relativePath);
        } catch (Throwable $e) {
            if (file_exists($absolutePath)) {
                @unlink($absolutePath);
            }
            throw $e;
        }

        try {
            applyProfilePhotoGamification($this->repository->getDb(), $userId);
            $profile = $this->repository->findProfileRowById($userId);
            if (is_array($profile)) {
                applyProfileCompletionGamification($this->repository->getDb(), $userId, $profile);
            }
        } catch (Throwable $e) {
            error_log('[UsersService] Falha ao aplicar gamificacao de foto/perfil: ' . $e->getMessage());
        }

        return [
            'photoUrl' => $relativePath,
            'message' => 'Foto de perfil atualizada com sucesso.',
        ];
    }

    /**
     * Remove a foto de perfil atual e limpa o caminho salvo no banco.
      * @since 1.0.0
     */
    public function removeProfilePhoto(string $userId, string $projectRoot): array
    {
        $this->validator->validateAuthenticatedUserId($userId);

        $currentPhotoUrl = $this->repository->findPhotoUrlById($userId);
        if (trim((string) $currentPhotoUrl) === '') {
            return [
                'message' => 'Nenhuma foto de perfil para remover.',
            ];
        }

        $this->repository->updatePhotoUrl($userId, null);
        $this->cleanupProfilePhotoFile((string) $currentPhotoUrl, $projectRoot);

        return [
            'message' => 'Foto de perfil removida com sucesso.',
        ];
    }

    /**
     * Retorna os dados privados da pagina de perfil, sem misturar sessao,
     * assinatura, billing ou permissoes administrativas.
     *
     * @since 1.0.0
     */
    public function getAuthenticatedProfile(string $userId): array
    {
        $this->validator->validateAuthenticatedUserId($userId);

        $row = $this->repository->findProfileRowById($userId);
        if (!$row) {
            throw new RuntimeException('Usuario Nao encontrado.');
        }

        return [
            'profile' => [
                'id' => (string) $row['id'],
                'displayName' => (string) $row['name'],
                'email' => (string) $row['email'],
                'avatarUrl' => $row['photo_url'] ?: null,
                'status' => (string) ($row['status'] ?? 'active'),
                'emailVerified' => (bool) ($row['email_verified'] ?? false),
                'personal' => [
                    'cpf' => $row['cpf'] ?: null,
                    'phone' => $row['phone'] ?: null,
                    'targetExam' => $row['target_exam'] ?: null,
                    'address' => $this->buildAddressPayload($row),
                    'preferences' => !empty($row['preferences'])
                        ? (json_decode((string) $row['preferences'], true) ?: [])
                        : [],
                ],
                'account' => [
                    'referralCode' => $this->ensureReferralCode($userId, $row['referral_code'] ?? null),
                    'twoFactorEnabled' => (bool) ($row['two_factor_enabled'] ?? false),
                    'deletion' => [
                        'pending' => !empty($row['deletion_requested_at']),
                        'requestedAt' => $row['deletion_requested_at'] ?? null,
                    ],
                ],
                'linkedProviders' => array_values(array_filter([
                    !empty($row['google_id']) ? 'google' : null,
                    !empty($row['facebook_id']) ? 'facebook' : null,
                ])),
            ],
        ];
    }

    /**
     * Retorna o contrato minimo usado para sessao global e refresh.
     * Dados sensiveis de perfil, endereco, banco e billing ficam em rotas proprias.
     *
     * @since 1.0.0
     */
    public function getAuthenticatedSession(string $userId): array
    {
        $this->validator->validateAuthenticatedUserId($userId);

        $row = $this->repository->findSessionRowById($userId);
        if (!$row) {
            throw new RuntimeException('Usuario nao encontrado.');
        }

        $role = $this->normalizeSessionRole($row['role'] ?? 'user');
        $linkedProviders = [];
        if (!empty($row['has_google_linked'])) {
            $linkedProviders[] = 'google';
        }
        if (!empty($row['has_facebook_linked'])) {
            $linkedProviders[] = 'facebook';
        }

        $subscriptionResponse = [
            'status' => 'inactive',
            'plan' => null,
        ];
        $subscription = $this->repository->findLatestSubscriptionSnapshot($userId);
        if ($subscription) {
            $planName = (string) ($subscription['plan_name'] ?? 'Gratuito');
            $subscriptionResponse = [
                'status' => (string) ($subscription['status'] ?? 'inactive'),
                'plan' => [
                    'id' => isset($subscription['plan_id']) ? (int) $subscription['plan_id'] : null,
                    'code' => $this->resolveSessionPlanCode($planName),
                    'displayName' => $planName,
                    'tier' => canonicalPlanTier($planName, $subscription['tier'] ?? null),
                ],
            ];
        }

        return [
            'user' => [
                'id' => (string) $row['id'],
                'displayName' => (string) $row['name'],
                'email' => (string) $row['email'],
                'avatarUrl' => $row['photo_url'] ?: null,
                'status' => (string) ($row['status'] ?? 'active'),
                'emailVerified' => (bool) ($row['email_verified'] ?? false),
                'role' => $role,
                'permissions' => $this->resolveSessionPermissions($role),
            ],
            'subscription' => $subscriptionResponse,
            'gamification' => [
                'level' => (int) ($row['level'] ?? 1),
                'xp' => (int) ($row['xp'] ?? 0),
                'reputation' => (int) ($row['reputation'] ?? 0),
            ],
            'linkedProviders' => $linkedProviders,
            'partnership' => [
                'status' => in_array($role, ['partner', 'admin'], true) ? 'active' : 'inactive',
            ],
        ];
    }

    /**
     * Retorna somente o status financeiro necessário para orientar a conta atual.
     * Dados de cartão e billing detalhado nunca integram o DTO global de sessão.
     *
     * @since 1.0.0
     */
    public function getCurrentUserPaymentStatus(string $userId): array
    {
        $this->validator->validateAuthenticatedUserId($userId);

        $subscription = $this->repository->findLatestSubscriptionSnapshot($userId);
        if (!$subscription) {
            return [
                'subscriptionStatus' => 'inactive',
                'billingMode' => 'free',
                'requiresPaymentMethod' => false,
                'hasValidPaymentMethod' => false,
                'actionRequired' => null,
            ];
        }

        $subscriptionStatus = strtolower(trim((string) ($subscription['status'] ?? 'inactive')));
        $provider = normalizePaymentProvider($subscription['payment_provider'] ?? 'stripe');
        $paymentMethod = strtolower(trim((string) ($subscription['payment_method'] ?? '')));
        $isActive = in_array($subscriptionStatus, ['active', 'trialing'], true);
        $isManual = $provider === 'manual_admin';
        $isOffline = in_array($paymentMethod, ['pix', 'boleto', 'bank_slip'], true);
        $isRecurringCard = $isActive
            && !$isManual
            && !$isOffline
            && !empty($subscription['auto_renew'])
            && empty($subscription['cancel_at_period_end'])
            && !empty($subscription['is_recurring']);

        if ($subscriptionStatus === 'past_due') {
            return [
                'subscriptionStatus' => $subscriptionStatus,
                'billingMode' => 'recurring_card',
                'requiresPaymentMethod' => true,
                'hasValidPaymentMethod' => false,
                'actionRequired' => 'payment_failed',
            ];
        }

        if (!$isRecurringCard) {
            return [
                'subscriptionStatus' => $subscriptionStatus,
                'billingMode' => $isManual ? 'manual' : ($isOffline ? 'offline' : ($subscriptionStatus === 'trialing' ? 'trial' : 'non_recurring')),
                'requiresPaymentMethod' => false,
                'hasValidPaymentMethod' => false,
                'actionRequired' => null,
            ];
        }

        $card = $this->repository->findPreferredCardExpiry($userId);
        $hasValidCard = $this->isValidPaymentCard($card);

        return [
            'subscriptionStatus' => $subscriptionStatus,
            'billingMode' => 'recurring_card',
            'requiresPaymentMethod' => true,
            'hasValidPaymentMethod' => $hasValidCard,
            'actionRequired' => $hasValidCard
                ? null
                : ($card ? 'replace_expired_payment_method' : 'add_payment_method'),
        ];
    }

    /**
     * Atualiza o perfil autenticado dentro de uma transacao unica.
     * O service aplica whitelist de campos para evitar mutacoes sensiveis indevidas.
      * @since 1.0.0
     */
    public function updateAuthenticatedProfile(string $userId, array $payload): array
    {
        $this->validator->validateAuthenticatedUserId($userId);
        $normalized = $this->validator->validateProfileUpdatePayload($payload);

        try {
            $this->repository->beginTransaction();

            if ($normalized['userFields'] !== []) {
                $this->repository->updateUserFields($userId, $normalized['userFields']);
            }

            if (is_array($normalized['address'])) {
                $this->repository->upsertAddress($userId, $normalized['address']);
            }

            if (is_array($normalized['bankAccount'])) {
                $this->repository->upsertBankAccount($userId, $normalized['bankAccount']);
            }

            $this->repository->commit();
        } catch (Throwable $e) {
            if ($this->repository->inTransaction()) {
                $this->repository->rollBack();
            }

            if ($this->isDuplicateEntryError($e->getMessage())) {
                throw new InvalidArgumentException($this->resolveDuplicateEntryMessage($e->getMessage()));
            }

            throw $e;
        }

        try {
            $profile = $this->repository->findProfileRowById($userId);
            if (is_array($profile)) {
                applyProfileCompletionGamification($this->repository->getDb(), $userId, $profile);
            }
        } catch (Throwable $e) {
            error_log('[UsersService] Falha ao aplicar gamificacao de perfil completo: ' . $e->getMessage());
        }

        return [
            'message' => 'Perfil atualizado com sucesso.',
        ];
    }

    /**
     * Retorna os comentarios publicados pelo Usuario dentro do escopo permitido.
      * @since 1.0.0
     */
    public function listUserComments(string $authenticatedUserId, ?string $requestedUserId, bool $isAdmin, array $query = []): array
    {
        $targetUserId = $this->validator->resolveRequestedUserId($authenticatedUserId, $requestedUserId, $isAdmin);
        return $this->buildUserCommentsPage($targetUserId, $query, 20, 50);
    }

    /**
     * Lista comentarios exclusivamente do usuario extraido da sessao autenticada.
     * Nenhum identificador vindo da requisicao participa da definicao de escopo.
     *
     * @since 1.0.0
     */
    public function getCurrentUserComments(string $authenticatedUserId, array $query = []): array
    {
        $this->validator->validateAuthenticatedUserId($authenticatedUserId);
        return $this->buildUserCommentsPage($authenticatedUserId, $query, 20, 50);
    }

    private function buildUserCommentsPage(string $userId, array $query, int $defaultLimit, int $maximumLimit): array
    {
        $limit = $this->resolveCursorLimit($query['limit'] ?? null, $defaultLimit, $maximumLimit);
        $since = $this->resolveActivityRangeStart($query);
        $comments = $this->repository->fetchUserCommentsById(
            $userId,
            $limit,
            $this->resolveCursorValue($query, 'users.comments'),
            $since
        );
        $hasMore = count($comments) > $limit;
        if ($hasMore) {
            $comments = array_slice($comments, 0, $limit);
        }

        $items = array_map(
            static function (array $row) use ($userId): array {
                return [
                    'id' => $row['id'],
                    'questionId' => ($row['target_type'] ?? '') === 'question' ? ($row['target_id'] ?? null) : null,
                    'targetId' => $row['target_id'] ?? null,
                    'targetType' => $row['target_type'] ?? 'question',
                    'text' => $row['content'] ?? '',
                    'date' => $row['created_at'] ?? null,
                    'userId' => $userId,
                    'likes' => 0,
                    'replies' => [],
                ];
            },
            $comments
        );

        return [
            'items' => $items,
            'comments' => $items,
            'limit' => $limit,
            'count' => count($items),
            'hasMore' => $hasMore,
            'nextCursor' => $hasMore ? $this->encodeCursorFromRow($comments[count($comments) - 1] ?? null, 'users.comments') : null,
            'summary' => [
                'totalComments' => $this->repository->countUserCommentsByIdSince($userId, $since),
            ],
        ];
    }

    /**
     * Retorna as anotacoes do Usuario com contexto textual resumido.
      * @since 1.0.0
     */
    public function listUserNotes(string $authenticatedUserId, ?string $requestedUserId, bool $isAdmin): array
    {
        $targetUserId = $this->validator->resolveRequestedUserId($authenticatedUserId, $requestedUserId, $isAdmin);
        $notes = $this->repository->fetchUserNotesById($targetUserId);

        return [
            'notes' => array_map(
                static function (array $item): array {
                    $context = '';

                    if (($item['type'] ?? '') === 'question') {
                        $snippet = trim((string) ($item['question_snippet'] ?? ''));
                        $context = $snippet !== '' ? substr($snippet, 0, 100) . '...' : '';
                    } elseif (($item['type'] ?? '') === 'material') {
                        $context = (string) (($item['material_title'] ?? '') ?: 'Material sem titulo');
                    }

                    return [
                        'id' => $item['id'],
                        'itemId' => $item['item_id'],
                        'type' => $item['type'],
                        'text' => $item['note_text'],
                        'context' => $context,
                        'updatedAt' => $item['updated_at'],
                    ];
                },
                $notes
            ),
        ];
    }

    /**
     * Persists a question note and returns the authoritative row for an
     * optimistic frontend update. Clearing a note is intentionally idempotent.
     *
     * @since 1.0.0
     */
    public function saveUserQuestionNote(
        string $authenticatedUserId,
        ?string $requestedUserId,
        bool $isAdmin,
        int $questionId,
        string $text
    ): array {
        $targetUserId = $this->validator->resolveRequestedUserId($authenticatedUserId, $requestedUserId, $isAdmin);

        if ($text === '') {
            $this->repository->deleteUserNoteByItem($targetUserId, (string) $questionId, 'question');
            return [
                'deleted' => true,
                'note' => null,
            ];
        }

        $note = $this->repository->upsertUserQuestionNote($targetUserId, $questionId, $text);
        if (!is_array($note)) {
            throw new RuntimeException('Nao foi possivel salvar a anotacao.');
        }

        return [
            'deleted' => false,
            'note' => [
                'id' => (string) ($note['id'] ?? ''),
                'itemId' => (string) ($note['item_id'] ?? $questionId),
                'type' => 'question',
                'text' => (string) ($note['note_text'] ?? $text),
                'updatedAt' => $note['updated_at'] ?? null,
            ],
        ];
    }

    /**
     * Retorna as respostas do Usuario no formato esperado pela camada de progresso.
      * @since 1.0.0
     */
    public function listUserAnswers(string $authenticatedUserId, ?string $requestedUserId, bool $isAdmin, array $query = []): array
    {
        $targetUserId = $this->validator->resolveRequestedUserId($authenticatedUserId, $requestedUserId, $isAdmin);
        return $this->buildUserAnswersPage($targetUserId, $query, 20, 50);
    }

    /**
     * Lista respostas exclusivamente do usuario extraido da sessao autenticada.
     * Nenhum identificador vindo da requisicao participa da definicao de escopo.
     *
     * @since 1.0.0
     */
    public function getCurrentUserAnswers(string $authenticatedUserId, array $query = []): array
    {
        $this->validator->validateAuthenticatedUserId($authenticatedUserId);
        return $this->buildUserAnswersPage($authenticatedUserId, $query, 20, 50);
    }

    private function buildUserAnswersPage(string $userId, array $query, int $defaultLimit, int $maximumLimit): array
    {
        $limit = $this->resolveCursorLimit($query['limit'] ?? null, $defaultLimit, $maximumLimit);
        $since = $this->resolveActivityRangeStart($query);
        $answers = $this->repository->fetchUserAnswersById(
            $userId,
            $limit,
            $this->resolveCursorValue($query, 'users.answers'),
            $since
        );
        $hasMore = count($answers) > $limit;
        if ($hasMore) {
            $answers = array_slice($answers, 0, $limit);
        }

        $items = array_map(
            static function (array $answer): array {
                $subjectName = trim((string) ($answer['subject_name'] ?? ''));
                $subjects = [];
                $rawSubjectFilters = array_filter(explode('||', (string) ($answer['subject_filters'] ?? '')));
                foreach ($rawSubjectFilters as $rawFilter) {
                    $parts = explode('::', $rawFilter);
                    $filterId = isset($parts[0]) ? (int) $parts[0] : 0;
                    $filterName = trim((string) ($parts[1] ?? ''));
                    if ($filterId <= 0 || $filterName === '') {
                        continue;
                    }

                    $subjects[] = [
                        'id' => $filterId,
                        'nome' => $filterName,
                        'name' => $filterName,
                        'slug' => (string) ($parts[2] ?? ''),
                        'parentId' => trim((string) ($parts[3] ?? '')) !== '' ? (int) $parts[3] : null,
                        'materia' => ((int) ($parts[4] ?? 0)) === 1,
                        'meta_materia' => ((int) ($parts[4] ?? 0)) === 1,
                    ];
                }

                return [
                    'questionId' => isset($answer['question_id']) ? (int) $answer['question_id'] : 0,
                    'isCorrect' => (bool) ($answer['is_correct'] ?? false),
                    'selectedOptionIndex' => isset($answer['selected_option_index']) ? (int) $answer['selected_option_index'] : 0,
                    'timestamp' => !empty($answer['created_at']) ? (strtotime((string) $answer['created_at']) * 1000) : 0,
                    'timeTaken' => isset($answer['time_taken_seconds']) ? (int) $answer['time_taken_seconds'] : 0,
                    'simulationId' => $answer['simulation_id'] ?? null,
                    'subjectName' => $subjectName,
                    'subject' => $subjectName,
                    'materia' => $subjectName,
                    'assuntos' => $subjects,
                ];
            },
            $answers
        );

        $summary = $this->repository->fetchUserAnswerSummary($userId, $since);
        $total = (int) ($summary['total_attempts'] ?? 0);
        $correct = (int) ($summary['correct_count'] ?? 0);
        $wrong = (int) ($summary['wrong_count'] ?? 0);

        return [
            'items' => $items,
            'answers' => $items,
            'limit' => $limit,
            'count' => count($items),
            'hasMore' => $hasMore,
            'nextCursor' => $hasMore ? $this->encodeCursorFromRow($answers[count($answers) - 1] ?? null, 'users.answers') : null,
            'summary' => [
                'totalAttempts' => $total,
                'correct' => $correct,
                'wrong' => $wrong,
                'accuracy' => $total > 0 ? round(($correct / $total) * 100, 2) : 0.0,
                'firstActivityAt' => $summary['first_activity_at'] ?? null,
                'lastActivityAt' => $summary['last_activity_at'] ?? null,
            ],
        ];
    }

    /**
     * Lista Usuarios para o painel administrativo mantendo o contrato historico.
      * @since 1.0.0
     */
    public function listUsers(bool $isAdmin): array
    {
        $this->validator->ensureAdminAccess($isAdmin);

        if (!$this->repository->usersTableExists()) {
            return [];
        }

        $users = $this->repository->fetchUsersAdminList();

        return array_map(
            static function (array $user): array {
                return [
                    'id' => $user['id'],
                    'name' => $user['name'],
                    'email' => $user['email'],
                    'photo_url' => $user['photo_url'],
                    'role' => $user['role'] ?? 'user',
                    'status' => $user['status'] ?? 'active',
                    'xp' => isset($user['xp']) ? (int) $user['xp'] : 0,
                    'level' => isset($user['level']) ? (int) $user['level'] : 1,
                    'reputation' => isset($user['reputation']) ? (int) $user['reputation'] : 0,
                    'targetExam' => $user['target_exam'] ?? null,
                    'createdAt' => $user['created_at'],
                    'billing' => [
                        'plan' => $user['plan_name'] ?? $user['user_plan'] ?? 'Gratuito',
                        'status' => $user['subscription_status'] ?? 'free',
                        'nextBilling' => $user['current_period_end'] ?? null,
                        'amount' => isset($user['plan_price']) ? (float) $user['plan_price'] : null,
                    ],
                ];
            },
            $users
        );
    }

    /**
     * Lista o ranking publico de XP da plataforma sem misturar com rankings pos-prova.
      * @since 1.0.0
     */
    public function listPublicXpLeaderboard(int $limit = 50): array
    {
        if (!$this->repository->usersTableExists()) {
            return ['entries' => []];
        }

        $entries = [];
        foreach ($this->repository->fetchPublicXpLeaderboardCandidates(max(80, $limit * 4)) as $user) {
            $preferences = !empty($user['preferences'])
                ? json_decode((string) $user['preferences'], true)
                : [];

            if (is_array($preferences) && array_key_exists('isPublic', $preferences) && $preferences['isPublic'] === false) {
                continue;
            }

            $showPhoto = !is_array($preferences)
                || !array_key_exists('showProfilePhoto', $preferences)
                || $preferences['showProfilePhoto'] !== false;

            $badges = [];
            foreach (explode('||', (string) ($user['badges_summary'] ?? '')) as $badgeSummary) {
                $badgeSummary = trim($badgeSummary);
                if ($badgeSummary === '') {
                    continue;
                }

                [$badgeKey, $badgeTitle] = array_pad(explode('::', $badgeSummary, 2), 2, '');
                $badgeKey = trim((string) $badgeKey);
                $badgeTitle = trim((string) $badgeTitle);
                if ($badgeKey === '' && $badgeTitle === '') {
                    continue;
                }

                $badges[] = [
                    'key' => $badgeKey !== '' ? $badgeKey : $badgeTitle,
                    'title' => $badgeTitle !== '' ? $badgeTitle : $badgeKey,
                ];
            }

            $entries[] = [
                'rank' => count($entries) + 1,
                'id' => (string) ($user['id'] ?? ''),
                'name' => trim((string) ($user['name'] ?? 'Aluno')),
                'photoUrl' => $showPhoto ? (string) ($user['photo_url'] ?? '') : '',
                'xp' => (int) ($user['xp'] ?? 0),
                'level' => max(1, (int) ($user['level'] ?? 1)),
                'reputation' => (int) ($user['reputation'] ?? 0),
                'targetExam' => $user['target_exam'] ?? null,
                'streakDays' => (int) ($user['streak_days'] ?? 0),
                'answeredQuestions' => (int) ($user['answered_questions'] ?? 0),
                'correctAnswers' => (int) ($user['correct_answers'] ?? 0),
                'badges' => array_slice($badges, 0, 3),
            ];

            if (count($entries) >= $limit) {
                break;
            }
        }

        return ['entries' => $entries];
    }

    /**
     * Exclui uma anotacao do Usuario respeitando ownership e compatibilidade legada.
      * @since 1.0.0
     */
    public function deleteUserNote(string $authenticatedUserId, ?string $requestedUserId, bool $isAdmin, string $noteId): array
    {
        $targetUserId = $this->validator->resolveRequestedUserId($authenticatedUserId, $requestedUserId, $isAdmin);
        $deletedRows = $this->repository->deleteUserNoteById($targetUserId, $noteId);

        if ($deletedRows <= 0) {
            throw new OutOfBoundsException('Note not found or access denied');
        }

        return [
            'deleted' => true,
            'message' => 'Note deleted',
        ];
    }

    /**
     * Registra o pedido de exclusao da propria conta sem apagar dados imediatamente.
      * @since 1.0.0
     */
    public function requestAccountDeletion(string $userId, string $reason): array
    {
        $this->validator->validateAuthenticatedUserId($userId);

        if (!$this->repository->userExistsById($userId)) {
            throw new OutOfBoundsException('Usuario Nao encontrado.');
        }

        $this->repository->markDeletionRequested($userId, $reason);

        return [
            'message' => 'Account deletion requested successfully',
        ];
    }

    /**
     * Garante que todo Usuario tenha codigo de indicacao antes de devolver o perfil.
      * @since 1.0.0
     */
    private function ensureReferralCode(string $userId, ?string $currentCode): string
    {
        $code = trim((string) $currentCode);
        if ($code !== '') {
            return $code;
        }

        $code = strtoupper(substr(md5(uniqid($userId, true)), 0, 8));
        $this->repository->saveReferralCode($userId, $code);
        return $code;
    }

    /**
     * Converte as colunas planas do endereco para o contrato camelCase consumido no frontend.
      * @since 1.0.0
     */
    private function buildAddressPayload(array $row): ?array
    {
        $hasAddressData = !empty($row['zip_code'])
            || !empty($row['street'])
            || !empty($row['city'])
            || !empty($row['state'])
            || !empty($row['neighborhood']);

        if (!$hasAddressData) {
            return null;
        }

        return [
            'zipCode' => $row['zip_code'] ?? null,
            'street' => $row['street'] ?? null,
            'number' => $row['number'] ?? null,
            'complement' => $row['complement'] ?? null,
            'neighborhood' => $row['neighborhood'] ?? null,
            'city' => $row['city'] ?? null,
            'state' => $row['state'] ?? null,
        ];
    }

    /**
     * Normaliza os dados bancarios persistidos para o shape esperado pelo frontend.
      * @since 1.0.0
     */
    private function buildBankAccountPayload(array $row): ?array
    {
        $hasBankData = !empty($row['bank_code'])
            || !empty($row['bank_name'])
            || !empty($row['agency'])
            || !empty($row['account']);

        if (!$hasBankData) {
            return null;
        }

        return [
            'bankCode' => $row['bank_code'] ?? null,
            'bankName' => $row['bank_name'] ?? null,
            'agency' => $row['agency'] ?? null,
            'account' => $row['account'] ?? null,
            'accountDigit' => $row['account_digit'] ?? null,
            'holderName' => $row['holder_name'] ?? null,
            'holderDocument' => $row['holder_document'] ?? null,
            'type' => $row['account_type'] ?? 'checking',
        ];
    }

    /**
     * Mantém os papéis serializados pela sessão dentro do conjunto reconhecido.
     */
    private function normalizeSessionRole($role): string
    {
        $normalized = strtolower(trim((string) $role));
        return in_array($normalized, ['user', 'staff', 'partner', 'admin'], true)
            ? $normalized
            : 'user';
    }

    /**
     * Expõe permissões de interface sem substituir a autorização final do backend.
     */
    private function resolveSessionPermissions(string $role): array
    {
        if ($role === 'admin') {
            return [
                'admin.access',
                'questions.create',
                'questions.edit.any',
                'questions.delete.any',
                'users.manage',
            ];
        }

        if ($role === 'staff') {
            return [
                'admin.access',
                'questions.create',
                'questions.edit.own',
                'questions.delete.own',
            ];
        }

        if ($role === 'partner') {
            return ['partner.access'];
        }

        return [];
    }

    /**
     * Converte o nome comercial armazenado para o identificador estável do DTO.
     */
    private function resolveSessionPlanCode(string $planName): string
    {
        $canonicalPlan = canonicalUserPlanValue($planName);
        return match ($canonicalPlan) {
            'Elite' => 'elite',
            'Pro' => 'pro',
            'Essencial' => 'essencial',
            default => 'free',
        };
    }

    /**
     * Uma data de expiração ausente não é considerada cartão válido para recorrência.
     */
    private function isValidPaymentCard(?array $card): bool
    {
        if (!$card) {
            return false;
        }

        $month = (int) ($card['exp_month'] ?? 0);
        $year = (int) ($card['exp_year'] ?? 0);
        if ($month < 1 || $month > 12 || $year < 2000) {
            return false;
        }

        $currentYear = (int) date('Y');
        $currentMonth = (int) date('n');
        return $year > $currentYear || ($year === $currentYear && $month >= $currentMonth);
    }

    /**
     * Acrescenta dados de assinatura e alertas de pagamento ao snapshot do Usuario.
      * @since 1.0.0
     */
    private function attachSubscriptionPayload(array &$userResponse, array $subscription, string $userId): void
    {
        $canonicalPlan = canonicalUserPlanValue($subscription['plan_name'] ?? null);
        $planTier = canonicalPlanTier($subscription['plan_name'] ?? null, $subscription['tier'] ?? null);
        $billingCycle = billingCycleFromInterval($subscription['interval_unit'] ?? null, $subscription['interval_count'] ?? null);
        $paymentProvider = normalizePaymentProvider($subscription['payment_provider'] ?? 'stripe');
        $latestTransactionStatus = $this->repository->findLatestPlanTransactionStatus($userId);
        $renewalForecast = $paymentProvider === 'manual_admin'
            ? [
                'amount' => 0,
                'date' => null,
                'price_source' => 'manual_admin',
                'price_source_label' => 'concessao manual gratuita',
                'cycle_label' => 'sem cobranca recorrente',
            ]
            : buildStripeRenewalForecast($this->repository->getDb(), $subscription, [
                'id' => (int) ($subscription['plan_id'] ?? 0),
                'name' => (string) ($subscription['plan_name'] ?? 'Assinatura'),
                'price' => (float) ($subscription['price'] ?? 0),
                'interval_unit' => (string) ($subscription['interval_unit'] ?? 'month'),
                'interval_count' => (int) ($subscription['interval_count'] ?? 1),
            ]);
        $paymentBlocking = (string) ($subscription['status'] ?? '') === 'past_due';

        $userResponse['subscription'] = [
            'id' => $subscription['id'],
            'user_id' => $subscription['user_id'],
            'plan_id' => $subscription['plan_id'],
            'created_at' => $subscription['created_at'] ?? null,
            'status' => $subscription['status'],
            'auto_renew' => (bool) ($subscription['auto_renew'] ?? false),
            'refund_requested' => $latestTransactionStatus === 'refund_requested',
            'payment_provider' => $paymentProvider,
            'provider_subscription_id' => $subscription['provider_subscription_id'] ?? null,
            'provider_customer_id' => $subscription['provider_customer_id'] ?? null,
            'provider_schedule_id' => $subscription['provider_schedule_id'] ?? null,
            'provider_current_period_start' => $subscription['provider_current_period_start'] ?? null,
            'provider_current_period_end' => $subscription['provider_current_period_end'] ?? null,
            'cancel_at_period_end' => !empty($subscription['cancel_at_period_end']),
            'current_period_start' => $subscription['current_period_start'] ?? null,
            'current_period_end' => $subscription['current_period_end'] ?? null,
            'is_recurring' => (bool) ($subscription['is_recurring'] ?? false),
            'total_installments' => isset($subscription['total_installments']) ? (int) $subscription['total_installments'] : null,
            'paid_installments' => isset($subscription['paid_installments']) ? (int) $subscription['paid_installments'] : null,
            'recurring_amount' => isset($subscription['recurring_amount']) ? (float) $subscription['recurring_amount'] : null,
            'renewal_iteration' => isset($subscription['renewal_iteration']) ? (int) $subscription['renewal_iteration'] : 0,
            'next_renewal_amount' => round((float) ($subscription['next_renewal_amount'] ?? $renewalForecast['amount'] ?? 0), 2),
            'next_renewal_date' => $subscription['next_renewal_date'] ?? ($renewalForecast['date'] ?? null),
            'next_renewal_price_source' => $subscription['next_renewal_price_source'] ?? ($renewalForecast['price_source'] ?? null),
            'next_renewal_cycle_label' => $subscription['next_renewal_cycle_label'] ?? ($renewalForecast['cycle_label'] ?? null),
            'payment_block_reason' => $paymentBlocking ? 'past_due' : null,
            'payment_blocking' => $paymentBlocking,
            'plan' => [
                'id' => $subscription['plan_id'],
                'name' => $subscription['plan_name'],
                'price' => isset($subscription['price']) ? (float) $subscription['price'] : 0.0,
                'interval_unit' => $subscription['interval_unit'] ?? null,
                'interval_count' => isset($subscription['interval_count']) ? (int) $subscription['interval_count'] : 1,
                'tier' => $planTier,
            ],
        ];

        $userResponse['plan'] = $canonicalPlan;
        $userResponse['planDisplayName'] = $subscription['plan_name'] ?? $canonicalPlan;
        $userResponse['billing'] = [
            'plan' => $canonicalPlan,
            'billingCycle' => $billingCycle,
            'nextBilling' => $subscription['next_renewal_date'] ?? ($renewalForecast['date'] ?? ($subscription['current_period_end'] ?? null)),
        ];
        $userResponse['hasActivePlan'] = hasActivePlanAccess($subscription['status'] ?? null);

        if (hasActivePlanAccess($subscription['status'] ?? null) || (string) ($subscription['status'] ?? '') === 'past_due') {
            $this->attachPaymentIssueIfNeeded($userResponse, $subscription, $userId);
        }
    }

    /**
     * Replica o alerta funcional quando a assinatura perde um meio de pagamento valido.
      * @since 1.0.0
     */
    private function attachPaymentIssueIfNeeded(array &$userResponse, array $subscription, string $userId): void
    {
        if ((string) ($subscription['status'] ?? '') === 'past_due') {
            $userResponse['paymentIssue'] = [
                'type' => 'past_due',
                'code' => 'payment_past_due',
                'severity' => 'blocking',
                'interactionLock' => true,
                'actionLabel' => 'Regularizar pagamento',
                'actionTarget' => '/profile/billing',
                'message' => 'Existe uma fatura em aberto na sua assinatura. Regularize o pagamento para desbloquear novamente os recursos premium.',
            ];

            $this->notifyCardIssueIfNeeded(
                $userId,
                'Pagamento pendente na assinatura',
                $userResponse['paymentIssue']['message'],
                'error'
            );
            return;
        }

        $planPrice = isset($subscription['price']) ? (float) $subscription['price'] : 0.0;
        $savedCardsCount = $this->repository->countUserCards($userId);
        $hasVisibleSavedCard = !empty($userResponse['hasSavedCard']) || $savedCardsCount > 0;

        if (!$hasVisibleSavedCard) {
            if (normalizePaymentProvider($subscription['payment_provider'] ?? '') === 'manual_admin') {
                $endTimestamp = strtotime((string) ($subscription['current_period_end'] ?? ''));
                $endLabel = $endTimestamp ? date('d/m/Y', $endTimestamp) : 'o fim da cortesia';

                $userResponse['hasSavedCard'] = false;
                $userResponse['paymentIssue'] = [
                    'type' => 'manual_gift_no_card',
                    'code' => 'manual_gift_missing_card',
                    'severity' => 'warning',
                    'interactionLock' => false,
                    'actionLabel' => 'Cadastrar cartão para renovar',
                    'actionTarget' => '/profile/personal#saved-cards-personal-section',
                    'message' => "Você recebeu uma cortesia do plano {$userResponse['planDisplayName']}. Seu acesso está liberado até {$endLabel}. Para continuar usando os benefícios no próximo ciclo, adicione um cartão; ele só será usado na renovação.",
                ];

                return;
            }

            if ($planPrice > 0) {
                $intervalUnit = strtolower((string) ($subscription['interval_unit'] ?? ''));
                $intervalCount = max(1, (int) ($subscription['interval_count'] ?? 1));
                $totalInstallments = max(1, (int) ($subscription['total_installments'] ?? 1));
                $requiresImmediateCard = $intervalUnit === 'year'
                    || $intervalCount >= 3
                    || $totalInstallments >= 3;

                $userResponse['hasSavedCard'] = false;
                $userResponse['paymentIssue'] = [
                    'type' => 'no_card',
                    'code' => 'missing_required_card',
                    'severity' => $requiresImmediateCard ? 'blocking' : 'warning',
                    'interactionLock' => $requiresImmediateCard,
                    'actionLabel' => 'Cadastrar cartao',
                    'actionTarget' => '/profile/personal#saved-cards-personal-section',
                    'message' => 'Nenhum cartao de pagamento encontrado para sua assinatura ativa. Por favor, cadastre um cartao.',
                ];

                $this->notifyCardIssueIfNeeded(
                    $userId,
                    'Cartao obrigatorio para assinatura ativa',
                    $userResponse['paymentIssue']['message'],
                    $requiresImmediateCard ? 'error' : 'warning'
                );
            }

            return;
        }

        $card = $this->repository->findPreferredCardExpiry($userId);
        if ($card) {
            $timezone = new DateTimeZone('America/Sao_Paulo');
            $now = new DateTimeImmutable('now', $timezone);
            $currentMonth = (int) $now->format('m');
            $currentYear = (int) $now->format('Y');
            $expMonth = (int) ($card['exp_month'] ?? 0);
            $expYear = (int) ($card['exp_year'] ?? 0);
            $cardLabel = $this->buildCardAlertLabel($card);

            if ($expYear < $currentYear || ($expYear === $currentYear && $expMonth < $currentMonth)) {
                $userResponse['paymentIssue'] = [
                    'type' => 'expired_card',
                    'code' => 'card_expired',
                    'severity' => 'blocking',
                    'interactionLock' => true,
                    'actionLabel' => 'Atualizar cartao',
                    'actionTarget' => '/profile/personal#saved-cards-personal-section',
                    'blockingReason' => 'expired_card',
                    'message' => $cardLabel === ''
                        ? 'Seu cartao da assinatura expirou. Atualize seus dados para manter o acesso aos simulados e materiais.'
                        : "O cartao {$cardLabel} da sua assinatura expirou. Atualize seus dados para manter o acesso aos simulados e materiais.",
                ];
                $this->notifyCardIssueIfNeeded(
                    $userId,
                    'Cartao expirado',
                    $userResponse['paymentIssue']['message'],
                    'error'
                );
                return;
            }

            $monthsUntilExpiry = (($expYear - $currentYear) * 12) + ($expMonth - $currentMonth);
            if ($monthsUntilExpiry <= 1) {
                $userResponse['paymentIssue'] = [
                    'type' => 'expiring_card',
                    'code' => 'card_expiring',
                    'severity' => 'warning',
                    'interactionLock' => false,
                    'actionLabel' => 'Atualizar cartao',
                    'actionTarget' => '/profile/personal#saved-cards-personal-section',
                    'message' => $cardLabel === ''
                        ? 'O cartao da sua assinatura esta proximo de vencer. Atualize-o para evitar falhas na renovacao.'
                        : "O cartao {$cardLabel} da sua assinatura esta proximo de vencer. Atualize-o para evitar falhas na renovacao.",
                ];
                $this->notifyCardIssueIfNeeded(
                    $userId,
                    'Cartao proximo do vencimento',
                    $userResponse['paymentIssue']['message'],
                    'warning'
                );
            }

            return;
        }
    }

    /**
     * Remove o arquivo fisico da foto quando ele pertence ao storage local de perfis.
      * @since 1.0.0
     */
    private function cleanupProfilePhotoFile(string $photoUrl, string $projectRoot): void
    {
        $normalizedPath = ltrim(str_replace('\\', '/', $photoUrl), '/');
        if (!str_starts_with($normalizedPath, 'uploads/profiles/')) {
            return;
        }

        $uploadsRoot = rtrim($projectRoot, DIRECTORY_SEPARATOR) . DIRECTORY_SEPARATOR . 'uploads' . DIRECTORY_SEPARATOR . 'profiles';
        $absoluteFilePath = rtrim($projectRoot, DIRECTORY_SEPARATOR) . DIRECTORY_SEPARATOR . str_replace('/', DIRECTORY_SEPARATOR, $normalizedPath);

        if (!file_exists($absoluteFilePath)) {
            return;
        }

        $realUploadsRoot = realpath($uploadsRoot);
        $realFilePath = realpath($absoluteFilePath);

        if ($realUploadsRoot === false || $realFilePath === false) {
            return;
        }

        if (strpos($realFilePath, $realUploadsRoot) !== 0) {
            return;
        }

        @unlink($realFilePath);
    }

    /**
     * Monta um identificador simples do cartao para alertas de cobranca.
      * @since 1.0.0
     */
    private function buildCardAlertLabel(array $card): string
    {
        $brand = strtoupper(trim((string) ($card['brand'] ?? '')));
        $lastFour = trim((string) ($card['last_four_digits'] ?? ''));

        if ($brand === '' && $lastFour === '') {
            return '';
        }

        if ($brand === '') {
            return 'final ' . $lastFour;
        }

        if ($lastFour === '') {
            return $brand;
        }

        return $brand . ' final ' . $lastFour;
    }

    /**
     * Dispara notificacao de cartao expirado ou prestes a vencer sem duplicar alertas recentes.
      * @since 1.0.0
     */
    private function notifyCardIssueIfNeeded(string $userId, string $title, string $message, string $type): void
    {
        $link = '/profile/personal';
        if ($this->repository->hasRecentNotification($userId, $title, $link, 168)) {
            return;
        }

        $this->repository->insertNotification([
            'id' => 'not-' . uniqid('', true),
            'user_id' => $userId,
            'title' => $title,
            'message' => $message,
            'category' => 'system',
            'type' => $type,
            'link' => $link,
        ]);
    }

    /**
     * Detecta o erro classico de chave unica do MySQL para traduzir melhor a resposta.
      * @since 1.0.0
     */
    private function isDuplicateEntryError(string $message): bool
    {
        return strpos($message, '1062 Duplicate entry') !== false;
    }

    /**
     * Traduz conflitos de unicidade para mensagens de dominio mais claras.
      * @since 1.0.0
     */
    private function resolveDuplicateEntryMessage(string $message): string
    {
        if (strpos($message, "for key 'cpf'") !== false || strpos($message, 'for key `cpf`') !== false) {
            return 'Este CPF ja esta cadastrado em outra conta.';
        }

        if (strpos($message, "for key 'email'") !== false || strpos($message, 'for key `email`') !== false) {
            return 'Este e-mail ja esta em uso.';
        }

        return 'Os dados informados conflitam com um registro existente.';
    }

    private function resolveCursorLimit(mixed $rawLimit, int $default, int $maximum): int
    {
        $limit = is_numeric($rawLimit) ? (int) $rawLimit : $default;
        return max(1, min($limit, $maximum));
    }

    private function resolveCursorValue(array $query, string $scope): ?array
    {
        $cursor = trim((string) ($query['cursor'] ?? $query['after'] ?? ''));
        return SignedKeysetCursor::decode($cursor !== '' ? $cursor : null, $scope);
    }

    private function resolveActivityRangeStart(array $query): ?string
    {
        $range = strtolower(trim((string) ($query['range'] ?? 'all')));
        $today = new DateTimeImmutable('today');

        return match ($range) {
            '', 'all' => null,
            'today' => $today->format('Y-m-d H:i:s'),
            'week' => $today->modify('-6 days')->format('Y-m-d H:i:s'),
            'month' => $today->modify('-29 days')->format('Y-m-d H:i:s'),
            'year' => $today->modify('first day of -11 months')->format('Y-m-d H:i:s'),
            default => throw new InvalidArgumentException('Recorte de atividade invalido.'),
        };
    }

    private function encodeCursorFromRow(?array $row, string $scope): ?string
    {
        if (!is_array($row)) {
            return null;
        }

        $createdAt = trim((string) ($row['created_at'] ?? ''));
        $id = trim((string) ($row['id'] ?? ''));
        if ($createdAt === '' || $id === '') {
            return null;
        }

        return SignedKeysetCursor::encode($scope, $createdAt, $id);
    }
}
