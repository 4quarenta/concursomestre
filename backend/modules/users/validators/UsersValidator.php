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

/**
 * Validator do dominio de usuarios.
 * Mantem validacoes basicas fora do controller e do service.
 *
 * @since 1.0.0
 */
require_once __DIR__ . '/../../../shared/security/UploadSecurity.php';

class UsersValidator
{
    /**
     * Garante que a sessao atual tenha um identificador valido antes de seguir
     * para leituras ou mutacoes do dominio de usuarios.
     *
     * @since 1.0.0
     */
    public function validateAuthenticatedUserId(string $userId): void
    {
        if (trim($userId) === '') {
            throw new InvalidArgumentException('Sessao invalida ou expirada.');
        }
    }

    /**
     * Resolve o usuario-alvo de consultas do perfil, impedindo acesso arbitrario
     * quando a rota recebe `user_id` ou `userId` por legado.
     *
     * @since 1.0.0
     */
    public function resolveRequestedUserId(string $authenticatedUserId, ?string $requestedUserId, bool $isAdmin): string
    {
        $this->validateAuthenticatedUserId($authenticatedUserId);

        $requestedUserId = trim((string) $requestedUserId);
        if ($requestedUserId === '') {
            return trim($authenticatedUserId);
        }

        if ($requestedUserId !== trim($authenticatedUserId) && !$isAdmin) {
            throw new RuntimeException('Voce nao pode consultar dados de outro usuario.');
        }

        return $requestedUserId;
    }

    /**
     * Restringe operacoes administrativas a sessoes com papel de admin.
     *
     * @since 1.0.0
     */
    public function ensureAdminAccess(bool $isAdmin): void
    {
        if (!$isAdmin) {
            throw new DomainException('Acesso administrativo obrigatorio.');
        }
    }

    /**
     * Valida o payload minimo de troca de senha antes de consultar o hash atual
     * e antes de persistir a nova credencial do usuario.
     *
     * @since 1.0.0
     */
    public function validatePasswordChangePayload(array $payload): void
    {
        $currentPassword = trim((string) ($payload['current'] ?? ''));
        $newPassword = trim((string) ($payload['new'] ?? ''));

        if ($currentPassword === '' || $newPassword === '') {
            throw new InvalidArgumentException('Informe a senha atual e a nova senha.');
        }

        if (mb_strlen($newPassword) < 6) {
            throw new InvalidArgumentException('A nova senha precisa ter pelo menos 6 caracteres.');
        }
    }

    /**
     * Confere upload de foto de perfil por tamanho e MIME real do arquivo.
     * Essa camada barra anexos fora do contrato antes da gravacao no storage.
     *
     * @since 1.0.0
     */
    public function validateProfilePhotoUpload(array $file): array
    {
        if (empty($file)) {
            throw new InvalidArgumentException('Nenhum arquivo valido foi enviado.');
        }

        return UploadSecurity::validate($file, [
            'image/jpeg' => ['extension' => 'jpg', 'maxSize' => 5 * 1024 * 1024],
            'image/png' => ['extension' => 'png', 'maxSize' => 5 * 1024 * 1024],
            'image/webp' => ['extension' => 'webp', 'maxSize' => 5 * 1024 * 1024],
        ], [
            'errorMessage' => 'Nenhum arquivo valido foi enviado.',
            'invalidTypeMessage' => 'Formato de imagem invalido. Use JPG, PNG ou WEBP.',
        ]);
    }

    /**
     * Extrai o alvo legado enviado no body quando o frontend ainda informa `user_id`.
     *
     * @since 1.0.0
     */
    public function extractRequestedUserIdFromPayload(array $payload): ?string
    {
        $requestedUserId = trim((string) (($payload['user_id'] ?? '') ?: ($payload['userId'] ?? '')));
        return $requestedUserId !== '' ? $requestedUserId : null;
    }

    /**
     * Valida o payload das mutacoes de cartao salvo.
     *
     * @since 1.0.0
     */
    public function validateSavedCardMutationPayload(array $payload): array
    {
        $cardId = trim((string) (($payload['card_id'] ?? '') ?: ($payload['cardId'] ?? '')));
        if ($cardId === '') {
            throw new InvalidArgumentException('Card ID e obrigatorio.');
        }

        return [
            'requestedUserId' => $this->extractRequestedUserIdFromPayload($payload),
            'cardId' => $cardId,
        ];
    }

    /**
     * Valida o payload de sincronizacao do cartao Stripe apos o setup intent.
     *
     * @since 1.0.0
     */
    public function validateStripePaymentMethodPayload(array $payload): string
    {
        $paymentMethodId = trim((string) (($payload['payment_method_id'] ?? '') ?: ($payload['paymentMethodId'] ?? '')));
        if ($paymentMethodId === '') {
            throw new InvalidArgumentException('Payment Method invalido.');
        }

        return $paymentMethodId;
    }

    /**
     * Normaliza o payload legado de salvamento local de cartao.
     *
     * @since 1.0.0
     */
    public function validateLegacySavedCardPayload(array $payload): array
    {
        $requestedUserId = $this->extractRequestedUserIdFromPayload($payload);

        $cardNumber = preg_replace('/\D/', '', (string) ($payload['card_number'] ?? ''));
        $fallbackLastFour = trim((string) ($payload['last_four'] ?? '****'));
        $lastFour = strlen($cardNumber) >= 4 ? substr($cardNumber, -4) : $fallbackLastFour;
        $brand = strtolower(trim((string) (($payload['card_brand'] ?? '') ?: ($payload['brand'] ?? 'outros'))));
        $holderName = strtoupper(trim((string) (($payload['card_name'] ?? '') ?: ($payload['holder_name'] ?? 'TITULAR DO CARTAO'))));
        $expiry = trim((string) ($payload['card_expiry'] ?? ''));

        if ($lastFour === '') {
            throw new InvalidArgumentException('Os ultimos digitos do cartao sao obrigatorios.');
        }

        if ($brand === '') {
            $brand = 'outros';
        }

        $expParts = preg_split('/[\/\-]/', $expiry);
        $expMonth = isset($expParts[0]) ? (int) $expParts[0] : 0;
        $expYearRaw = isset($expParts[1]) ? (int) $expParts[1] : 0;
        $expYear = $expYearRaw > 0 && $expYearRaw < 100 ? 2000 + $expYearRaw : $expYearRaw;

        if ($expMonth < 1 || $expMonth > 12) {
            throw new InvalidArgumentException('Mes de validade invalido.');
        }

        if ($expYear < 2000) {
            throw new InvalidArgumentException('Ano de validade invalido.');
        }

        return [
            'requestedUserId' => $requestedUserId,
            'last_four_digits' => $lastFour,
            'brand' => $brand,
            'holder_name' => $holderName,
            'exp_month' => $expMonth,
            'exp_year' => $expYear,
        ];
    }

    /**
     * Normaliza a exclusao de anotacoes, mantendo compatibilidade com `id` e `user_id` legados.
     *
     * @since 1.0.0
     */
    public function validateDeleteNotePayload(array $payload): array
    {
        $noteId = trim((string) ($payload['id'] ?? ''));
        if ($noteId === '') {
            throw new InvalidArgumentException('ID da anotacao e obrigatorio.');
        }

        return [
            'requestedUserId' => $this->extractRequestedUserIdFromPayload($payload),
            'noteId' => $noteId,
        ];
    }

    /**
     * Validates a question note before it reaches the persistence layer.
     *
     * @since 1.0.0
     */
    public function validateQuestionNotePayload(array $payload): array
    {
        $questionId = (int) ($payload['questionId'] ?? $payload['question_id'] ?? $payload['itemId'] ?? 0);
        if ($questionId <= 0) {
            throw new InvalidArgumentException('Questao da anotacao e obrigatoria.');
        }

        $text = trim((string) ($payload['text'] ?? $payload['note'] ?? ''));
        if (mb_strlen($text) > 10000) {
            throw new InvalidArgumentException('A anotacao pode ter no maximo 10.000 caracteres.');
        }

        return [
            'requestedUserId' => $this->extractRequestedUserIdFromPayload($payload),
            'questionId' => $questionId,
            'text' => $text,
        ];
    }

    /**
     * Garante que a solicitacao de exclusao tenha motivo legivel antes de seguir.
     *
     * @since 1.0.0
     */
    public function validateAccountDeletionPayload(array $payload): array
    {
        $reason = trim((string) ($payload['reason'] ?? ''));
        if ($reason === '') {
            throw new InvalidArgumentException('Reason is required for deletion');
        }

        return [
            'reason' => $reason,
            'captchaToken' => trim((string) ($payload['captchaToken'] ?? '')),
        ];
    }

    /**
     * Normaliza e valida os campos editaveis do perfil autenticado.
     * O retorno separado por blocos reduz logica de parsing no controller/service.
     *
     * @since 1.0.0
     */
    public function validateProfileUpdatePayload(array $payload): array
    {
        if ($payload === []) {
            throw new InvalidArgumentException('Nenhum dado foi enviado para atualizacao.');
        }

        $userFields = [];
        $address = null;
        $bankAccount = null;

        if (array_key_exists('name', $payload)) {
            $name = trim((string) $payload['name']);
            if ($name === '') {
                throw new InvalidArgumentException('Nome e obrigatorio.');
            }
            $userFields['name'] = $name;
        }

        if (array_key_exists('cpf', $payload)) {
            $cpf = preg_replace('/\D+/', '', (string) $payload['cpf']);
            if ($cpf === null || strlen($cpf) !== 11) {
                throw new InvalidArgumentException('CPF invalido.');
            }
            $userFields['cpf'] = $cpf;
        }

        if (array_key_exists('phone', $payload)) {
            $phone = preg_replace('/\D+/', '', (string) $payload['phone']);
            if ($phone !== '' && !in_array(strlen($phone), [10, 11], true)) {
                throw new InvalidArgumentException('Telefone invalido.');
            }
            $userFields['phone'] = $phone !== '' ? $phone : null;
        }

        if (array_key_exists('targetExam', $payload)) {
            $userFields['target_exam'] = trim((string) $payload['targetExam']);
        }

        if (array_key_exists('preferences', $payload)) {
            if (!is_array($payload['preferences']) && !is_object($payload['preferences'])) {
                throw new InvalidArgumentException('Preferencias invalidas.');
            }

            $userFields['preferences'] = json_encode(
                $payload['preferences'],
                JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES
            );
        }

        if (array_key_exists('role', $payload)) {
            $role = strtolower(trim((string) $payload['role']));
            if ($role !== 'partner') {
                throw new InvalidArgumentException('Somente a migracao para parceiro e permitida neste endpoint.');
            }
            $userFields['role'] = 'partner';
        }

        if (array_key_exists('address', $payload)) {
            if (!is_array($payload['address'])) {
                throw new InvalidArgumentException('Endereco invalido.');
            }

            $address = [
                'zip_code' => preg_replace('/\D+/', '', (string) ($payload['address']['zipCode'] ?? '')),
                'street' => trim((string) ($payload['address']['street'] ?? '')),
                'number' => trim((string) ($payload['address']['number'] ?? '')),
                'complement' => trim((string) ($payload['address']['complement'] ?? '')),
                'neighborhood' => trim((string) ($payload['address']['neighborhood'] ?? '')),
                'city' => trim((string) ($payload['address']['city'] ?? '')),
                'state' => strtoupper(trim((string) ($payload['address']['state'] ?? ''))),
            ];

            $requiredAddressFields = ['zip_code', 'street', 'number', 'neighborhood', 'city', 'state'];
            foreach ($requiredAddressFields as $field) {
                if (trim((string) ($address[$field] ?? '')) === '') {
                    throw new InvalidArgumentException('Endereco incompleto. Revise os campos obrigatorios.');
                }
            }

            if (strlen((string) $address['state']) !== 2) {
                throw new InvalidArgumentException('UF invalida.');
            }
        }

        if (array_key_exists('bankAccount', $payload)) {
            if (!is_array($payload['bankAccount'])) {
                throw new InvalidArgumentException('Conta bancaria invalida.');
            }

            $bankAccount = [
                'bank_code' => trim((string) ($payload['bankAccount']['bankCode'] ?? '')),
                'bank_name' => trim((string) ($payload['bankAccount']['bankName'] ?? '')),
                'agency' => trim((string) ($payload['bankAccount']['agency'] ?? '')),
                'account' => trim((string) ($payload['bankAccount']['account'] ?? '')),
                'account_digit' => trim((string) ($payload['bankAccount']['accountDigit'] ?? '')),
                'holder_name' => trim((string) ($payload['bankAccount']['holderName'] ?? '')),
                'holder_document' => preg_replace('/\D+/', '', (string) ($payload['bankAccount']['holderDocument'] ?? '')),
                'account_type' => strtolower(trim((string) ($payload['bankAccount']['type'] ?? 'checking'))),
            ];

            $requiredBankFields = ['bank_name', 'agency', 'account', 'holder_name', 'holder_document'];
            foreach ($requiredBankFields as $field) {
                if (trim((string) ($bankAccount[$field] ?? '')) === '') {
                    throw new InvalidArgumentException('Conta bancaria incompleta. Revise os campos obrigatorios.');
                }
            }

            if (!in_array($bankAccount['account_type'], ['checking', 'savings'], true)) {
                throw new InvalidArgumentException('Tipo de conta invalido.');
            }
        }

        if ($userFields === [] && $address === null && $bankAccount === null) {
            throw new InvalidArgumentException('Nenhum campo editavel foi enviado.');
        }

        return [
            'userFields' => $userFields,
            'address' => $address,
            'bankAccount' => $bankAccount,
        ];
    }
}
