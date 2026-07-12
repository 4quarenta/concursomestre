<?php

declare(strict_types=1);

/**
 * Regra única de ownership para os comandos administrativos de questões,
 * contextos e provas importadas. Editar ou publicar um registro não transfere
 * a autoria ao staff que executou a ação.
 */
final class QuestionOwnershipPolicy
{
    /**
     * @param array<string, mixed> $ownership
     */
    public function canManage(string $role, string $authenticatedUserId, array $ownership): bool
    {
        if ($role === 'admin') {
            return true;
        }

        if ($role !== 'staff') {
            return false;
        }

        $creatorId = trim((string) ($ownership['created_by_user_id'] ?? ''));
        return $creatorId !== '' && hash_equals($creatorId, $authenticatedUserId);
    }
}
