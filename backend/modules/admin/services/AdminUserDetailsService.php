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

require_once __DIR__ . '/../repositories/AdminUserDetailsRepository.php';
require_once __DIR__ . '/../validators/AdminUserDetailsValidator.php';

/**
 * Servico do detalhamento administrativo de usuario.
 * Monta o payload consumido pelo painel sem expor SQL na camada HTTP.
 */
class AdminUserDetailsService
{
    private AdminUserDetailsRepository $repository;
    private AdminUserDetailsValidator $validator;

    /**
     * Inicializa o service com repositorio e validador de usuarios.
     *
     * @since 1.0.0
     */
    public function __construct(
        AdminUserDetailsRepository $repository,
        AdminUserDetailsValidator $validator
    ) {
        $this->repository = $repository;
        $this->validator = $validator;
    }

    /**
     * Monta o resumo completo do usuario para o painel admin.
     *
     * @since 1.0.0
     */
    public function getDetails(string $userId): array
    {
        $this->validator->validateUserId($userId);

        $user = $this->repository->findProfileById($userId);
        if (!$user) {
            throw new OutOfBoundsException('User not found');
        }

        $user['target_exam'] = $user['target_exam'] ?? ($user['targetExam'] ?? '');
        $user['email_verified'] = $this->resolveBooleanField($user, ['email_verified', 'confirmed', 'email_confirmed']);
        $user['has_saved_card'] = $this->repository->fetchHasSavedCard($userId);
        $user['photo_url'] = $user['photo_url'] ?? ($user['avatar_url'] ?? null);

        $user['address'] = !empty($user['zip_code']) ? [
            'zipCode' => $user['zip_code'] ?? '',
            'street' => $user['street'] ?? '',
            'number' => $user['number'] ?? '',
            'complement' => $user['complement'] ?? '',
            'neighborhood' => $user['neighborhood'] ?? '',
            'city' => $user['city'] ?? '',
            'state' => $user['state'] ?? '',
        ] : null;

        $user['bankAccount'] = (!empty($user['bank_code']) || !empty($user['account'])) ? [
            'bankCode' => $user['bank_code'] ?? '',
            'bankName' => $user['bank_name'] ?? '',
            'agency' => $user['agency'] ?? '',
            'account' => $user['account'] ?? '',
            'accountDigit' => $user['account_digit'] ?? '',
            'holderName' => $user['holder_name'] ?? '',
            'holderDocument' => $user['holder_document'] ?? '',
            'type' => $user['account_type'] ?? '',
        ] : null;

        $user['preferences'] = $this->decodePreferences($user['preferences'] ?? null);
        unset($user['password_hash']);

        $feedbackThreads = $this->repository->fetchUserFeedbackThreads($userId);
        $reports = $this->repository->fetchUserReports($userId);
        $openReportsCount = count(array_filter($reports, static function (array $report): bool {
            return strtolower((string) ($report['status'] ?? '')) === 'pending';
        }));

        return [
            'profile' => $user,
            'subscriptions' => $this->repository->fetchSubscriptions($userId),
            'transactions' => $this->repository->fetchTransactions($userId),
            'available_plans' => $this->repository->fetchAvailablePlans(),
            'materials' => $this->repository->fetchPurchasedMaterials($userId),
            'stats' => [
                'comments_count' => $this->repository->fetchCommentsCount($userId),
                'feedback_count' => count($feedbackThreads),
                'reports_count' => count($reports),
                'open_reports_count' => $openReportsCount,
            ],
            'last_comments' => $this->repository->fetchRecentComments($userId),
            'feedback_threads' => $feedbackThreads,
            'reports' => $reports,
        ];
    }

    /**
     * Resolve flags booleanas entre campos legados e novos.
     *
     * @since 1.0.0
     */
    private function resolveBooleanField(array $payload, array $candidateKeys): bool
    {
        foreach ($candidateKeys as $candidateKey) {
            if (!array_key_exists($candidateKey, $payload)) {
                continue;
            }

            return filter_var($payload[$candidateKey], FILTER_VALIDATE_BOOLEAN);
        }

        return false;
    }

    /**
     * Decodifica o blob de preferencias de forma segura.
     *
     * @since 1.0.0
     */
    private function decodePreferences(mixed $rawPreferences): array
    {
        if (is_array($rawPreferences)) {
            return $rawPreferences;
        }

        if (!is_string($rawPreferences) || trim($rawPreferences) === '') {
            return [];
        }

        $decoded = json_decode($rawPreferences, true);
        return is_array($decoded) ? $decoded : [];
    }
}
