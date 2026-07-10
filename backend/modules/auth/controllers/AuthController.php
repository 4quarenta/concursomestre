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

require_once __DIR__ . '/../services/AuthService.php';

/**
 * Controller HTTP do dominio auth.
 * Mantem a camada fina e delega toda regra ao service.
 */
class AuthController
{
    private AuthService $service;

    public function __construct(AuthService $service)
    {
        $this->service = $service;
    }

    public function logout(): array
    {
        return $this->service->logout();
    }

    public function login(array $payload): array
    {
        return $this->service->login($payload);
    }

    public function register(array $payload): array
    {
        return $this->service->register($payload);
    }

    public function googleLogin(array $payload): array
    {
        return $this->service->googleLogin($payload);
    }

    public function facebookLogin(array $payload): array
    {
        return $this->service->facebookLogin($payload);
    }

    public function appleLogin(array $payload): array
    {
        return $this->service->appleLogin($payload);
    }

    public function refreshSession(bool $includeUser = false): array
    {
        return $this->service->refreshSession($includeUser);
    }

    public function requestPasswordReset(array $payload): array
    {
        return $this->service->requestPasswordReset($payload);
    }

    public function resetPassword(array $payload): array
    {
        return $this->service->resetPassword($payload);
    }

    public function resendConfirmation(array $authenticatedUser, array $payload): array
    {
        return $this->service->resendConfirmation($authenticatedUser, $payload);
    }

    public function confirmEmail(array $payload): array
    {
        return $this->service->confirmEmail($payload);
    }

    public function setupTwoFactor(array $authenticatedUser): array
    {
        return $this->service->setupTwoFactor($authenticatedUser);
    }

    public function enableTwoFactor(array $authenticatedUser, array $payload): array
    {
        return $this->service->enableTwoFactor($authenticatedUser, $payload);
    }

    public function verifyTwoFactor(array $payload): array
    {
        return $this->service->verifyTwoFactor($payload);
    }
}
