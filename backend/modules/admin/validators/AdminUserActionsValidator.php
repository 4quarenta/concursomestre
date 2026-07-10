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
 * Validador das mutacoes administrativas aplicadas ao usuario.
 * Mantem as pre-condicoes do endpoint legado em um unico lugar.
 */
class AdminUserActionsValidator
{
    private const ALLOWED_ACTIONS = [
        'create_user',
        'add_days',
        'upgrade_plan',
        'refund_transaction',
        'update_profile',
        'update_user_status',
        'delete_user',
    ];

    /**
     * Garante que a acao informada e suportada pelo fluxo.
     *
     * @since 1.0.0
     */
    public function validateAction(string $action): void
    {
        if ($action === '') {
            throw new InvalidArgumentException('Acao obrigatoria.');
        }

        if (!in_array($action, self::ALLOWED_ACTIONS, true)) {
            throw new InvalidArgumentException('Acao invalida.');
        }
    }

    /**
     * Garante que um usuario foi informado quando necessario.
     *
     * @since 1.0.0
     */
    public function validateUserIdForAction(string $action, string $userId): void
    {
        if ($userId === '' && !in_array($action, ['create_user', 'refund_transaction'], true)) {
            throw new InvalidArgumentException("ID do usuario e obrigatorio para a acao: {$action}");
        }
    }

    /**
     * Valida o payload usado para criar usuarios pelo painel admin.
     *
     * @since 1.0.0
     */
    public function validateCreateUserPayload(string $name, string $email, string $password, string $role, ?string $status = null, mixed $reputation = null): void
    {
        $this->validateProfilePayload($name, $email, $role, $status, $reputation);

        if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
            throw new InvalidArgumentException('E-mail invalido.');
        }

        if (strlen($password) < 8) {
            throw new InvalidArgumentException('A senha temporaria deve ter pelo menos 8 caracteres.');
        }
    }

    /**
     * Garante que a quantidade de dias representa um ajuste real.
     *
     * @since 1.0.0
     */
    public function validateNonZeroDays(int $days): void
    {
        if ($days === 0) {
            throw new InvalidArgumentException('Quantidade de dias invalida.');
        }
    }

    /**
     * Mantem compatibilidade com testes/fluxos antigos que so adicionavam dias.
     *
     * @since 1.0.0
     */
    public function validatePositiveDays(int $days): void
    {
        $this->validateNonZeroDays($days);
        if ($days < 0) {
            throw new InvalidArgumentException('Use um ajuste negativo apenas em cortesia manual.');
        }
    }

    /**
     * Garante que o plano informado e valido.
     *
     * @since 1.0.0
     */
    public function validatePlanId(int $planId): void
    {
        if ($planId <= 0) {
            throw new InvalidArgumentException('ID do plano e obrigatorio.');
        }
    }

    /**
     * Garante que a transacao informada e valida.
     *
     * @since 1.0.0
     */
    public function validateTransactionId(int $transactionId): void
    {
        if ($transactionId <= 0) {
            throw new InvalidArgumentException('ID da transacao e obrigatorio.');
        }
    }

    /**
     * Valida o payload de atualizacao de perfil do usuario.
     *
     * @since 1.0.0
     */
    public function validateProfilePayload(string $name, string $email, string $role, ?string $status = null, mixed $reputation = null): void
    {
        if ($name === '' || $email === '') {
            throw new InvalidArgumentException('Nome e e-mail sao obrigatorios.');
        }

        $validRoles = ['user', 'staff', 'partner', 'admin'];
        if ($role !== '' && !in_array($role, $validRoles, true)) {
            throw new InvalidArgumentException('Perfil invalido.');
        }

        if ($status !== null && $status !== '' && !in_array($status, ['active', 'suspended', 'banned', 'pending'], true)) {
            throw new InvalidArgumentException('Status invalido.');
        }

        if ($reputation !== null) {
            $numericReputation = (int) $reputation;
            if ($numericReputation < 0 || $numericReputation > 100) {
                throw new InvalidArgumentException('Reputacao deve ficar entre 0 e 100.');
            }
        }
    }

    /**
     * Garante que o payload de status contem ao menos um campo valido.
     *
     * @since 1.0.0
     */
    public function validateUserStatusPayload(array $data): void
    {
        $hasStatus = array_key_exists('status', $data);
        $hasReputation = array_key_exists('reputation', $data);

        if (!$hasStatus && !$hasReputation) {
            throw new InvalidArgumentException('Informe ao menos status ou reputacao para atualizar o usuario.');
        }

        if ($hasStatus) {
            $status = trim((string) ($data['status'] ?? ''));
            if ($status !== '' && !in_array($status, ['active', 'suspended', 'banned', 'pending'], true)) {
                throw new InvalidArgumentException('Status invalido.');
            }
        }

        if ($hasReputation) {
            $reputation = (int) ($data['reputation'] ?? 0);
            if ($reputation < 0 || $reputation > 100) {
                throw new InvalidArgumentException('Reputacao deve ficar entre 0 e 100.');
            }
        }
    }
}
