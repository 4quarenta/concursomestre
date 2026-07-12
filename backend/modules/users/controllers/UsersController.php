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

require_once __DIR__ . '/../services/UsersService.php';

/**
 * Controller HTTP do dominio de usuarios.
 * Mantem o controller fino e delega o fluxo real ao service.
 */
class UsersController
{
    private UsersService $service;

    /**
     * Injeta o service oficial do dominio para manter o controller como casca HTTP.
     * @since 1.0.0
     */
    public function __construct(UsersService $service)
    {
        $this->service = $service;
    }

    /**
     * Expande os dados de indicacao do usuario autenticado para o frontend.
     * @since 1.0.0
     */
    public function getReferralStats(string $userId, string $frontendBaseUrl): array
    {
        return $this->service->getReferralStats($userId, $frontendBaseUrl);
    }

    /**
     * Encaminha a troca de senha apos autenticacao da sessao atual.
     * @since 1.0.0
     */
    public function changePassword(string $userId, array $payload): array
    {
        return $this->service->changePassword($userId, $payload);
    }

    /**
     * Recebe o upload de foto e delega a gravacao segura ao service.
     * @since 1.0.0
     */
    public function uploadProfilePhoto(string $userId, array $file, string $projectRoot): array
    {
        return $this->service->uploadProfilePhoto($userId, $file, $projectRoot);
    }

    /**
     * Remove a foto de perfil atual do usuario autenticado.
     * @since 1.0.0
     */
    public function removeProfilePhoto(string $userId, string $projectRoot): array
    {
        return $this->service->removeProfilePhoto($userId, $projectRoot);
    }

    /**
     * Retorna o perfil autenticado consolidado para a pagina de perfil.
     * @since 1.0.0
     */
    public function getAuthenticatedProfile(string $userId): array
    {
        return $this->service->getAuthenticatedProfile($userId);
    }

    /**
     * Retorna somente o DTO minimo de sessao para auth/login, refresh e /auth/me.
     * @since 1.0.0
     */
    public function getAuthenticatedSession(string $userId): array
    {
        return $this->service->getAuthenticatedSession($userId);
    }

    /**
     * Atualiza os campos editaveis do perfil e estruturas relacionadas.
     * @since 1.0.0
     */
    public function updateAuthenticatedProfile(string $userId, array $payload): array
    {
        return $this->service->updateAuthenticatedProfile($userId, $payload);
    }

    /**
     * Lista comentarios do usuario em escopo proprio ou administrativo.
     * @since 1.0.0
     */
    public function listUserComments(string $authenticatedUserId, ?string $requestedUserId, bool $isAdmin, array $query = []): array
    {
        return $this->service->listUserComments($authenticatedUserId, $requestedUserId, $isAdmin, $query);
    }

    /**
     * Lista anotacoes privadas do usuario no escopo autorizado.
     * @since 1.0.0
     */
    public function listUserNotes(string $authenticatedUserId, ?string $requestedUserId, bool $isAdmin): array
    {
        return $this->service->listUserNotes($authenticatedUserId, $requestedUserId, $isAdmin);
    }

    /**
     * Saves or clears one question note inside the authenticated user scope.
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
        return $this->service->saveUserQuestionNote(
            $authenticatedUserId,
            $requestedUserId,
            $isAdmin,
            $questionId,
            $text
        );
    }

    /**
     * Lista historico de respostas do usuario no escopo autorizado.
     * @since 1.0.0
     */
    public function listUserAnswers(string $authenticatedUserId, ?string $requestedUserId, bool $isAdmin, array $query = []): array
    {
        return $this->service->listUserAnswers($authenticatedUserId, $requestedUserId, $isAdmin, $query);
    }

    /**
     * Exponibiliza a listagem administrativa de usuarios.
     * @since 1.0.0
     */
    public function listUsers(bool $isAdmin): array
    {
        return $this->service->listUsers($isAdmin);
    }

    /**
     * Retorna ranking publico de XP separado do ranking pos-prova.
     * @since 1.0.0
     */
    public function listPublicXpLeaderboard(int $limit = 50): array
    {
        return $this->service->listPublicXpLeaderboard($limit);
    }

    /**
     * Exclui uma anotacao no escopo autorizado.
     * @since 1.0.0
     */
    public function deleteUserNote(string $authenticatedUserId, ?string $requestedUserId, bool $isAdmin, string $noteId): array
    {
        return $this->service->deleteUserNote($authenticatedUserId, $requestedUserId, $isAdmin, $noteId);
    }

    /**
     * Encaminha a solicitacao de exclusao de conta para auditoria e fila interna.
     * @since 1.0.0
     */
    public function requestAccountDeletion(string $userId, string $reason): array
    {
        return $this->service->requestAccountDeletion($userId, $reason);
    }
}
