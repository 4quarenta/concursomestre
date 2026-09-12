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

require_once __DIR__ . '/../repositories/AdminUserActionsRepository.php';
require_once __DIR__ . '/../validators/AdminUserActionsValidator.php';
require_once __DIR__ . '/../../../config/payment_provider.php';
require_once __DIR__ . '/../../../config/stripe.php';
require_once __DIR__ . '/../../../config/notification_helper.php';
require_once __DIR__ . '/../../../shared/utils/Mailer.php';
require_once __DIR__ . '/../../../shared/utils/EmailTemplateResolver.php';
require_once __DIR__ . '/../../transactions/services/TransactionsRefundSupport.php';
require_once __DIR__ . '/../../benefits/services/BenefitService.php';

/**
 * Servico das mutacoes administrativas de usuario.
 * Encapsula transacoes, validacao e montagem do retorno para auditoria.
 */
class AdminUserActionsService
{
    private PDO $db;
    private AdminUserActionsRepository $repository;
    private AdminUserActionsValidator $validator;

    /**
     * Inicializa o service com repositorio e validador de acoes.
     *
     * @since 1.0.0
     */
    public function __construct(
        PDO $db,
        AdminUserActionsRepository $repository,
        AdminUserActionsValidator $validator
    ) {
        $this->db = $db;
        $this->repository = $repository;
        $this->validator = $validator;
    }

    /**
     * Executa a acao administrativa solicitada para o usuario.
     *
     * @since 1.0.0
     */
    public function execute(array $data): array
    {
        $action = trim((string) ($data['action'] ?? ''));
        $userId = trim((string) ($data['user_id'] ?? ''));

        $this->validator->validateAction($action);
        $this->validator->validateUserIdForAction($action, $userId);

        return match ($action) {
            'create_user' => $this->handleCreateUser($data),
            'add_days' => $this->handleAddDays($userId, $data),
            'upgrade_plan' => $this->handleUpgradePlan($userId, $data),
            'refund_transaction' => $this->handleRefundTransaction($data),
            'update_profile' => $this->handleUpdateProfile($userId, $data),
            'update_user_status' => $this->handleUpdateUserStatus($userId, $data),
            'delete_user' => $this->handleDeleteUser($userId, $data),
            default => throw new InvalidArgumentException('Invalid action'),
        };
    }

    /**
     * Cria um usuario novo pelo painel administrativo.
     *
     * @since 1.0.0
     */
    private function handleCreateUser(array $data): array
    {
        $name = trim((string) ($data['name'] ?? ''));
        $email = strtolower(trim((string) ($data['email'] ?? '')));
        $password = (string) ($data['password'] ?? '');
        $cpf = trim((string) ($data['cpf'] ?? ''));
        $phone = trim((string) ($data['phone'] ?? ''));
        $targetExam = trim((string) ($data['targetExam'] ?? ''));
        $role = trim((string) ($data['role'] ?? 'user'));
        $status = trim((string) ($data['status'] ?? 'active'));
        $reputation = array_key_exists('reputation', $data) ? (int) $data['reputation'] : 100;

        $this->validator->validateCreateUserPayload($name, $email, $password, $role, $status, $reputation);

        if ($this->repository->findUserByEmail($email)) {
            throw new InvalidArgumentException('Este e-mail ja esta cadastrado.');
        }

        $this->repository->ensureUserProfileColumns();

        $newUserId = $this->createUuid();
        $referralCode = strtoupper(substr(str_replace('-', '', $newUserId), 0, 8));
        $preferences = json_encode([
            'shareData' => true,
            'notifications' => true,
        ], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);

        $this->db->beginTransaction();
        $this->repository->createUserProfile([
            'id' => $newUserId,
            'name' => $name,
            'email' => $email,
            'password_hash' => password_hash($password, PASSWORD_DEFAULT),
            'role' => $role !== '' ? $role : 'user',
            'status' => $status !== '' ? $status : 'active',
            'reputation' => max(0, min(100, $reputation)),
            'referral_code' => $referralCode,
            'cpf' => $cpf !== '' ? $cpf : null,
            'phone' => $phone !== '' ? $phone : null,
            'target_exam' => $targetExam !== '' ? $targetExam : null,
            'preferences' => $preferences ?: '{}',
        ]);
        $this->db->commit();

        return [
            'message' => 'Usuario criado com sucesso.',
            'data' => ['user_id' => $newUserId],
            'audit_action' => 'user.create',
            'audit_entity_type' => 'user',
            'audit_entity_id' => $newUserId,
            'audit_metadata' => [
                'email' => $email,
                'role' => $role,
                'status' => $status,
            ],
        ];
    }

    private function handleAddDays(string $userId, array $data): array
    {
        $days = (int) ($data['days'] ?? 0);
        $this->validator->validatePositiveDays($days);
        $actorId = trim((string) ($data['_admin_user_id'] ?? ''));
        if ($actorId === '') {
            throw new RuntimeException('Operador administrativo ausente.');
        }
        $grant = (new BenefitService($this->db))->grantSupportCompensation($userId, $days, [
            'ticket_reference' => (string) ($data['ticket_reference'] ?? ''),
            'reason' => (string) ($data['reason'] ?? ''),
            'benefit_mode' => (string) ($data['benefit_mode'] ?? ''),
            'access_plan' => (string) ($data['access_plan'] ?? ''),
            'idempotency_key' => $data['idempotency_key'] ?? null,
            'apply_provider' => true,
        ], $actorId);
        $grantData = $grant['grant'] ?? [];
        $pendingProvider = strtoupper((string) ($grantData['status'] ?? '')) === 'PENDING_PROVIDER';

        return [
            'message' => $pendingProvider
                ? 'Compensacao criada e aguardando confirmacao do provedor.'
                : 'Compensacao criada com sucesso.',
            'data' => [
                'grant_id' => $grantData['id'] ?? null,
                'days' => $days,
                'status' => $grantData['status'] ?? null,
            ],
            'audit_action' => 'user.add_days',
            'audit_entity_type' => 'user',
            'audit_entity_id' => $userId,
            'audit_metadata' => [
                'days' => $days,
                'grant_origin' => 'support_compensation',
                'benefit_mode' => $grant['mode'] ?? null,
                'provider_required' => $grant['provider_required'] ?? false,
            ],
        ];
    }

    /**
     * Faz upgrade manual de plano com nova assinatura.
     *
     * @since 1.0.0
     */
    private function handleUpgradePlan(string $userId, array $data): array
    {
        $planId = (int) ($data['plan_id'] ?? 0);
        $this->validator->validatePlanId($planId);

        $plan = $this->repository->findPlanById($planId);
        if (!$plan) {
            throw new InvalidArgumentException('Plano nao encontrado');
        }

        $activeSubscription = $this->repository->findActiveSubscriptionByUserId($userId);
        if ($activeSubscription) {
            if ((int) ($activeSubscription['plan_id'] ?? 0) === $planId) {
                throw new InvalidArgumentException('O usuario ja esta neste plano.');
            }

            if ((float) ($plan['price'] ?? 0) <= (float) ($activeSubscription['plan_price'] ?? 0)) {
                throw new InvalidArgumentException('Este fluxo aceita apenas upgrade para plano acima do atual.');
            }
        }

        $actorId = trim((string) ($data['_admin_user_id'] ?? ''));
        if ($actorId === '') {
            throw new RuntimeException('Operador administrativo ausente.');
        }
        $durationDays = $this->getPlanDurationDays($plan);
        $grant = (new BenefitService($this->db))->grantSupportCompensation($userId, $durationDays, [
            'access_plan' => (string) $plan['name'],
            'ticket_reference' => (string) ($data['ticket_reference'] ?? ('admin-upgrade-' . $userId . '-' . $planId)),
            'reason' => (string) ($data['reason'] ?? 'Upgrade administrativo temporario.'),
            'idempotency_key' => $data['idempotency_key'] ?? null,
            'apply_provider' => false,
        ], $actorId);
        $grantData = $grant['grant'] ?? [];
        $end = (string) ($grantData['grant_expires_at'] ?? date('Y-m-d H:i:s', strtotime('+' . $durationDays . ' days')));
        $this->notifyManualGrantAdjustment($userId, (string) $plan['name'], $end, null, true);

        return [
            'message' => "Plano alterado para {$plan['name']} com sucesso.",
            'data' => ['grant_id' => $grantData['id'] ?? null, 'duration_days' => $durationDays],
            'audit_action' => 'user.upgrade_plan',
            'audit_entity_type' => 'user',
            'audit_entity_id' => $userId,
            'audit_metadata' => [
                'plan_id' => $planId,
                'plan_name' => $plan['name'],
                'grant_origin' => 'support_compensation',
                'benefit_mode' => $grant['mode'] ?? null,
            ],
        ];
    }

    /**
     * Avisa o aluno quando uma cortesia manual e concedida ou ajustada.
     *
     * O envio e tolerante a falhas para nao reverter a acao administrativa se
     * SMTP/notificacoes estiverem indisponiveis.
     *
     * @since 1.0.0
     */
    private function notifyManualGrantAdjustment(
        string $userId,
        string $planName,
        string $endDate,
        ?int $daysDelta,
        bool $remainsActive
    ): void {
        try {
            $user = $this->repository->findUserById($userId);
            if (!$user) {
                return;
            }

            $safePlanName = trim($planName) !== '' ? trim($planName) : 'Plano premium';
            $endTimestamp = strtotime($endDate);
            $endLabel = $endTimestamp ? date('d/m/Y', $endTimestamp) : 'o fim do período concedido';
            $billingPath = '/profile/personal#saved-cards-personal-section';
            $billingUrl = rtrim((string) (getenv('APP_URL') ?: 'http://localhost:3000'), '/') . $billingPath;
            $isGift = $daysDelta === null || $daysDelta > 0;
            $daysLabel = $daysDelta !== null ? abs($daysDelta) . ' dia(s)' : 'um período de cortesia';

            if ($isGift && $remainsActive) {
                $title = 'Você recebeu uma cortesia';
                $message = "Você recebeu {$daysLabel} grátis no {$safePlanName}. Seu acesso fica liberado até {$endLabel}. Para continuar depois, cadastre um cartão; ele só será usado na renovação.";
            } elseif ($remainsActive) {
                $title = 'Cortesia ajustada';
                $message = "Seu período de cortesia no {$safePlanName} foi ajustado. O acesso permanece ativo até {$endLabel}.";
            } else {
                $title = 'Cortesia encerrada';
                $message = 'Seu período de cortesia foi encerrado e sua conta voltou para o plano Gratuito.';
            }

            createNotification(
                $this->db,
                $userId,
                $title,
                $message,
                $isGift ? 'success' : 'info',
                'system',
                $billingPath,
                'subscription_manual_gift'
            );

            if (!$isGift || !$remainsActive) {
                return;
            }

            $email = trim((string) ($user['email'] ?? ''));
            if ($email === '') {
                return;
            }

            $name = trim((string) ($user['name'] ?? 'Aluno')) ?: 'Aluno';
            $contentHtml = '<p>Olá <strong>' . htmlspecialchars($name, ENT_QUOTES, 'UTF-8') . '</strong>,</p>'
                . '<p>Você recebeu uma cortesia do <strong>' . htmlspecialchars($safePlanName, ENT_QUOTES, 'UTF-8') . '</strong> no ConcursoMestre.</p>'
                . '<p><strong>Período liberado:</strong> ' . htmlspecialchars($daysLabel, ENT_QUOTES, 'UTF-8') . '<br>'
                . '<strong>Acesso ativo até:</strong> ' . htmlspecialchars($endLabel, ENT_QUOTES, 'UTF-8') . '</p>'
                . '<p>As funcionalidades do plano estão liberadas durante a cortesia. Para continuar usando os benefícios depois desse período, cadastre um cartão. Ele só será usado na renovação.</p>';

            $bodyHtml = Mailer::htmlTemplate(
                'Você ganhou uma cortesia',
                $contentHtml,
                $billingUrl,
                'Cadastrar cartão para renovar'
            );

            $template = resolveSystemEmailTemplate(
                'subscription_manual_gift',
                [
                    'subject' => 'Você recebeu uma cortesia no ConcursoMestre',
                    'htmlBody' => $bodyHtml,
                    'textBody' => "Olá {$name},\n\nVocê recebeu {$daysLabel} grátis no {$safePlanName}. Seu acesso fica ativo até {$endLabel}.\n\nPara continuar depois, cadastre um cartão: {$billingUrl}",
                ],
                [
                    'name' => $name,
                    'plan_name' => $safePlanName,
                    'days_label' => $daysLabel,
                    'end_date' => $endLabel,
                    'billing_url' => $billingUrl,
                    'app_url' => rtrim((string) (getenv('APP_URL') ?: 'http://localhost:3000'), '/'),
                ],
                $this->db
            );

            if ($template['enabled']) {
                Mailer::send($email, $name, $template['subject'], $template['htmlBody'], $template['textBody']);
            }
        } catch (Throwable $error) {
            error_log('[admin_user_actions] manual grant notification warning: ' . $error->getMessage());
        }
    }

    /**
     * Realiza o estorno administrativo de uma transacao.
     *
     * @since 1.0.0
     */
    private function handleRefundTransaction(array $data): array
    {
        $transactionId = (int) ($data['transaction_id'] ?? 0);
        $this->validator->validateTransactionId($transactionId);
        $refundResult = [];
        $cancellationResult = [];

        $this->db->beginTransaction();

        try {
            $transaction = $this->repository->findTransactionByIdForUpdate($transactionId);
            if (!$transaction) {
                throw new OutOfBoundsException('Transaction not found');
            }

            $currentStatus = strtolower(trim((string) ($transaction['status'] ?? '')));
            $existingRefundId = trim((string) ($transaction['provider_refund_id'] ?? ''));

            if ($currentStatus === 'refunded' || $existingRefundId !== '') {
                throw new InvalidArgumentException('Transacao ja estornada');
            }

            $refundResult = processGatewayRefundForTransaction($this->db, $transaction, 'Aprovado pelo administrador');
            markTransactionAsRefunded($this->db, (string) $transactionId, 'Aprovado pelo administrador', $refundResult);
            $cancellationResult = cancelStripeSubscriptionImmediatelyAfterRefund($this->db, $transaction, $refundResult);
            if (!empty($cancellationResult['warning'])) {
                error_log('[admin_user_actions] refund cancellation warning: ' . $cancellationResult['warning']);
            }
            $this->db->commit();
        } catch (Throwable $error) {
            if ($this->db->inTransaction()) {
                $this->db->rollBack();
            }

            throw $error;
        }

        return [
            'message' => 'Transacao estornada com sucesso.',
            'data' => [],
            'audit_action' => 'transaction.refund',
            'audit_entity_type' => 'transaction',
            'audit_entity_id' => (string) $transactionId,
            'audit_metadata' => [
                'provider_refund' => $refundResult,
                'subscription_cancellation' => $cancellationResult,
            ],
        ];
    }

    /**
     * Atualiza dados cadastrais, papel operacional e sinais de conta do usuario.
     *
     * @since 1.0.0
     */
    private function handleUpdateProfile(string $userId, array $data): array
    {
        $name = trim((string) ($data['name'] ?? ''));
        $email = trim((string) ($data['email'] ?? ''));
        $cpf = trim((string) ($data['cpf'] ?? ''));
        $phone = trim((string) ($data['phone'] ?? ''));
        $targetExam = trim((string) ($data['targetExam'] ?? ''));
        $role = trim((string) ($data['role'] ?? ''));
        $status = array_key_exists('status', $data) ? trim((string) ($data['status'] ?? '')) : null;
        $reputation = array_key_exists('reputation', $data) ? (int) $data['reputation'] : null;

        $this->validator->validateProfilePayload($name, $email, $role, $status, $reputation);

        $profilePayload = [
            'name' => $name,
            'email' => $email,
            'cpf' => $cpf !== '' ? $cpf : null,
            'phone' => $phone !== '' ? $phone : null,
            'target_exam' => $targetExam !== '' ? $targetExam : null,
            'role' => $role !== '' ? $role : 'user',
        ];

        if ($status !== null && $status !== '') {
            $profilePayload['status'] = $status;
        }

        if ($reputation !== null) {
            $profilePayload['reputation'] = $reputation;
        }

        $this->repository->ensureUserProfileColumns();

        $this->db->beginTransaction();
        $this->repository->updateUserProfile($userId, $profilePayload);
        $this->db->commit();

        return [
            'message' => 'Perfil atualizado com sucesso.',
            'data' => [],
            'audit_action' => 'user.update_profile',
            'audit_entity_type' => 'user',
            'audit_entity_id' => $userId,
            'audit_metadata' => [
                'email' => $email,
                'role' => $profilePayload['role'],
                'status' => $profilePayload['status'] ?? null,
                'reputation' => $profilePayload['reputation'] ?? null,
                'target_exam' => $targetExam,
            ],
        ];
    }

    /**
     * Atualiza campos de status e reputacao do usuario.
     *
     * @since 1.0.0
     */
    private function handleUpdateUserStatus(string $userId, array $data): array
    {
        $this->validator->validateUserStatusPayload($data);

        $payload = [];
        if (array_key_exists('status', $data)) {
            $payload['status'] = trim((string) $data['status']);
        }
        if (array_key_exists('reputation', $data)) {
            $payload['reputation'] = (int) $data['reputation'];
        }

        $this->repository->ensureUserProfileColumns();

        $this->repository->updateUserStatusFields($userId, $payload);

        return [
            'message' => 'Dados do usuario atualizados com sucesso.',
            'data' => [],
            'audit_action' => 'user.update_status',
            'audit_entity_type' => 'user',
            'audit_entity_id' => $userId,
            'audit_metadata' => $payload,
        ];
    }

    /**
     * Remove administrativamente uma conta sem apagar trilhas de auditoria.
     *
     * @since 1.0.0
     */
    private function handleDeleteUser(string $userId, array $data): array
    {
        $adminUserId = trim((string) ($data['_admin_user_id'] ?? ''));
        if ($adminUserId !== '' && $adminUserId === $userId) {
            throw new InvalidArgumentException('Voce nao pode remover o proprio usuario pelo painel.');
        }

        $user = $this->repository->findUserById($userId);
        if (!$user) {
            throw new OutOfBoundsException('Usuario nao encontrado.');
        }

        if ((string) ($user['role'] ?? '') === 'admin' && $this->repository->countActiveAdminsExcluding($userId) <= 0) {
            throw new InvalidArgumentException('Nao e possivel remover o ultimo administrador ativo.');
        }

        $reason = trim((string) ($data['reason'] ?? 'Remocao administrativa pelo painel.'));

        $this->db->beginTransaction();
        $this->repository->cancelActiveSubscriptionsByUserId($userId);
        $cleanupSummary = $this->repository->cleanupUserOwnedNonFinancialData($userId);
        $this->repository->softDeleteUserById($userId, $reason);
        $this->db->commit();

        return [
            'message' => 'Usuario removido com sucesso.',
            'data' => [
                'user_id' => $userId,
                'deleted' => true,
            ],
            'audit_action' => 'user.delete',
            'audit_entity_type' => 'user',
            'audit_entity_id' => $userId,
            'audit_metadata' => [
                'email' => $user['email'] ?? null,
                'role' => $user['role'] ?? null,
                'previous_status' => $user['status'] ?? null,
                'reason' => $reason,
                'content_cleanup' => $cleanupSummary ?? [],
            ],
        ];
    }

    /**
     * Converte a periodicidade do plano em duracao de acesso temporario.
     * A assinatura paga permanece sob a autoridade Billing.
     */
    private function getPlanDurationDays(array $plan): int
    {
        $intervalUnit = strtolower((string) ($plan['interval_unit'] ?? 'month'));
        $intervalCount = max(1, (int) ($plan['interval_count'] ?? 1));

        if ($intervalUnit === 'day') {
            return min(3660, $intervalCount);
        }

        if ($intervalUnit === 'week') {
            return min(3660, $intervalCount * 7);
        }

        if ($intervalUnit === 'year') {
            return min(3660, $intervalCount * 365);
        }

        return min(3660, $intervalCount * 30);
    }

    /**
     * Gera um UUID v4 para novos usuarios criados pelo admin.
     *
     * @since 1.0.0
     */
    private function createUuid(): string
    {
        $data = random_bytes(16);
        $data[6] = chr((ord($data[6]) & 0x0f) | 0x40);
        $data[8] = chr((ord($data[8]) & 0x3f) | 0x80);

        return vsprintf('%s%s-%s-%s-%s-%s%s%s', str_split(bin2hex($data), 4));
    }
}
