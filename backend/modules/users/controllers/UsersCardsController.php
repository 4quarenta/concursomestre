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

require_once __DIR__ . '/../services/UsersCardsService.php';

/**
 * Controller HTTP do cofre de cartoes do usuario.
 * Mantem a camada HTTP fina e delega a regra ao service especializado.
 *
 * @since 1.0.0
 */
class UsersCardsController
{
    private UsersCardsService $service;

    /**
     * Injeta o service do cofre de cartoes.
     *
     * @since 1.0.0
     */
    public function __construct(UsersCardsService $service)
    {
        $this->service = $service;
    }

    /**
     * Lista cartoes salvos do usuario.
     *
     * @since 1.0.0
     */
    public function listSavedCards(string $authenticatedUserId, ?string $requestedUserId, bool $isAdmin): array
    {
        return $this->service->listSavedCards($authenticatedUserId, $requestedUserId, $isAdmin);
    }

    /**
     * Remove um cartao salvo.
     *
     * @since 1.0.0
     */
    public function removeSavedCard(
        string $authenticatedUserId,
        ?string $requestedUserId,
        bool $isAdmin,
        string $cardId
    ): array {
        return $this->service->removeSavedCard($authenticatedUserId, $requestedUserId, $isAdmin, $cardId);
    }

    /**
     * Define o cartao padrao do usuario.
     *
     * @since 1.0.0
     */
    public function setDefaultSavedCard(
        string $authenticatedUserId,
        ?string $requestedUserId,
        bool $isAdmin,
        string $cardId
    ): array {
        return $this->service->setDefaultSavedCard($authenticatedUserId, $requestedUserId, $isAdmin, $cardId);
    }

    /**
     * Cria SetupIntent Stripe para o usuario.
     *
     * @since 1.0.0
     */
    public function createStripeSetupIntent(string $authenticatedUserId): array
    {
        return $this->service->createStripeSetupIntent($authenticatedUserId);
    }

    /**
     * Sincroniza um cartao Stripe salvo.
     *
     * @since 1.0.0
     */
    public function syncStripeCard(string $authenticatedUserId, string $paymentMethodId): array
    {
        return $this->service->syncStripeCard($authenticatedUserId, $paymentMethodId);
    }

    /**
     * Persiste um cartao legado no cofre local.
     *
     * @since 1.0.0
     */
    public function saveLegacyCard(
        string $authenticatedUserId,
        ?string $requestedUserId,
        bool $isAdmin,
        array $payload
    ): array {
        return $this->service->saveLegacyCard($authenticatedUserId, $requestedUserId, $isAdmin, $payload);
    }
}
