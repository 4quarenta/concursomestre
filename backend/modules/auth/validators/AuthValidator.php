<?php

require_once __DIR__ . '/../../../shared/legal/LegalAcceptance.php';

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
 * Validator do dominio de autenticacao.
 * Mantem parsing e saneamento de payloads fora dos controllers e services.
 *
 * @since 1.0.0
 */
class AuthValidator
{
    /**
     * Valida o payload de login tradicional por e-mail e senha.
     *
     * @since 1.0.0
     */
    public function validateLoginPayload(array $payload): array
    {
        $email = trim((string) ($payload['email'] ?? ''));
        $password = (string) ($payload['password'] ?? '');

        if ($email === '' || $password === '') {
            throw new InvalidArgumentException('Os campos email e password sao obrigatorios.');
        }

        if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
            throw new InvalidArgumentException('Invalid email format');
        }

        return [
            'email' => $email,
            'password' => $password,
            'captchaToken' => trim((string) ($payload['captchaToken'] ?? '')),
        ];
    }

    /**
     * Valida o payload de cadastro.
     *
     * @since 1.0.0
     */
    public function validateRegisterPayload(array $payload): array
    {
        $name = trim((string) ($payload['name'] ?? ''));
        $email = trim((string) ($payload['email'] ?? ''));
        $cpf = preg_replace('/\D+/', '', (string) ($payload['cpf'] ?? ''));
        $phone = preg_replace('/\D+/', '', (string) ($payload['phone'] ?? ''));
        $password = (string) ($payload['password'] ?? '');

        if ($name === '' || $email === '' || $password === '' || $cpf === '' || $phone === '') {
            throw new InvalidArgumentException('Os campos name, cpf, phone, email e password sao obrigatorios.');
        }

        if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
            throw new InvalidArgumentException('Formato de e-mail invalido.');
        }

        if (!in_array(strlen((string) $phone), [10, 11], true)) {
            throw new InvalidArgumentException('Telefone invalido. Informe DDD + numero com 10 ou 11 digitos.');
        }

        if (!$this->isValidCpf((string) $cpf)) {
            throw new InvalidArgumentException('CPF invalido. Verifique e tente novamente.');
        }

        if (mb_strlen($password) < 6) {
            throw new InvalidArgumentException('A senha deve ter pelo menos 6 caracteres.');
        }

        $acceptance = $this->validateRegistrationAcceptance($payload, true);

        return array_merge([
            'name' => $name,
            'cpf' => (string) $cpf,
            'phone' => (string) $phone,
            'email' => $email,
            'password' => $password,
            'captchaToken' => trim((string) ($payload['captchaToken'] ?? '')),
            'referralCode' => trim((string) ($payload['referralCode'] ?? '')),
        ], $acceptance);
    }

    /**
     * Valida o credential JWT retornado pelo Google Identity Services.
     *
     * @since 1.0.0
     */
    public function validateGooglePayload(array $payload): array
    {
        $credential = trim((string) ($payload['credential'] ?? ''));
        $profile = is_array($payload['profile'] ?? null) ? $payload['profile'] : [];
        $profileName = trim((string) ($profile['name'] ?? ''));
        $profileCpf = preg_replace('/\D+/', '', (string) ($profile['cpf'] ?? ''));
        $profilePhone = preg_replace('/\D+/', '', (string) ($profile['phone'] ?? ''));

        if ($credential === '') {
            throw new InvalidArgumentException('Credencial do Google ausente.');
        }

        if (substr_count($credential, '.') !== 2) {
            throw new InvalidArgumentException('Credencial do Google invalida.');
        }

        if ($profilePhone !== '' && !in_array(strlen((string) $profilePhone), [10, 11], true)) {
            throw new InvalidArgumentException('Telefone invalido. Informe DDD + numero com 10 ou 11 digitos.');
        }

        if ($profileCpf !== '' && !$this->isValidCpf((string) $profileCpf)) {
            throw new InvalidArgumentException('CPF invalido. Verifique e tente novamente.');
        }

        $createIfMissing = array_key_exists('createIfMissing', $payload)
            ? filter_var($payload['createIfMissing'], FILTER_VALIDATE_BOOLEAN)
            : true;

        return array_merge([
            'credential' => $credential,
            'referralCode' => trim((string) ($payload['referralCode'] ?? '')),
            'linkUserId' => trim((string) ($payload['linkUserId'] ?? '')),
            'createIfMissing' => $createIfMissing,
            'profile' => [
                'name' => $profileName,
                'cpf' => (string) $profileCpf,
                'phone' => (string) $profilePhone,
            ],
        ], $this->validateRegistrationAcceptance($payload, $createIfMissing));
    }

    /**
     * Valida o payload enviado pelo fluxo de login/cadastro via Facebook.
     *
     * @since 1.0.0
     */
    public function validateFacebookPayload(array $payload): array
    {
        $accessToken = trim((string) ($payload['accessToken'] ?? ''));
        $profile = is_array($payload['profile'] ?? null) ? $payload['profile'] : [];
        $profileName = trim((string) ($profile['name'] ?? ''));
        $profileCpf = preg_replace('/\D+/', '', (string) ($profile['cpf'] ?? ''));
        $profilePhone = preg_replace('/\D+/', '', (string) ($profile['phone'] ?? ''));

        if ($accessToken === '') {
            throw new InvalidArgumentException('Token do Facebook ausente.');
        }

        if (strlen($accessToken) < 16) {
            throw new InvalidArgumentException('Token do Facebook invalido.');
        }

        if ($profilePhone !== '' && !in_array(strlen((string) $profilePhone), [10, 11], true)) {
            throw new InvalidArgumentException('Telefone invalido. Informe DDD + numero com 10 ou 11 digitos.');
        }

        if ($profileCpf !== '' && !$this->isValidCpf((string) $profileCpf)) {
            throw new InvalidArgumentException('CPF invalido. Verifique e tente novamente.');
        }

        $createIfMissing = array_key_exists('createIfMissing', $payload)
            ? filter_var($payload['createIfMissing'], FILTER_VALIDATE_BOOLEAN)
            : true;

        return array_merge([
            'accessToken' => $accessToken,
            'referralCode' => trim((string) ($payload['referralCode'] ?? '')),
            'linkUserId' => trim((string) ($payload['linkUserId'] ?? '')),
            'createIfMissing' => $createIfMissing,
            'profile' => [
                'name' => $profileName,
                'cpf' => (string) $profileCpf,
                'phone' => (string) $profilePhone,
            ],
        ], $this->validateRegistrationAcceptance($payload, $createIfMissing));
    }

    /**
     * Valida o payload enviado pelo fluxo de login/cadastro via Apple.
     *
     * @since 1.0.0
     */
    public function validateApplePayload(array $payload): array
    {
        $idToken = trim((string) ($payload['idToken'] ?? ''));
        $profile = is_array($payload['profile'] ?? null) ? $payload['profile'] : [];
        $profileName = trim((string) ($profile['name'] ?? ''));
        $profileCpf = preg_replace('/\D+/', '', (string) ($profile['cpf'] ?? ''));
        $profilePhone = preg_replace('/\D+/', '', (string) ($profile['phone'] ?? ''));
        $profileEmail = trim((string) ($profile['email'] ?? ''));

        if ($idToken === '') {
            throw new InvalidArgumentException('Token da Apple ausente.');
        }

        if (substr_count($idToken, '.') !== 2) {
            throw new InvalidArgumentException('Token da Apple invalido.');
        }

        if ($profileEmail !== '' && filter_var($profileEmail, FILTER_VALIDATE_EMAIL) === false) {
            throw new InvalidArgumentException('E-mail da Apple invalido.');
        }

        if ($profilePhone !== '' && !in_array(strlen((string) $profilePhone), [10, 11], true)) {
            throw new InvalidArgumentException('Telefone invalido. Informe DDD + numero com 10 ou 11 digitos.');
        }

        if ($profileCpf !== '' && !$this->isValidCpf((string) $profileCpf)) {
            throw new InvalidArgumentException('CPF invalido. Verifique e tente novamente.');
        }

        $createIfMissing = array_key_exists('createIfMissing', $payload)
            ? filter_var($payload['createIfMissing'], FILTER_VALIDATE_BOOLEAN)
            : true;

        return array_merge([
            'idToken' => $idToken,
            'referralCode' => trim((string) ($payload['referralCode'] ?? '')),
            'createIfMissing' => $createIfMissing,
            'profile' => [
                'name' => $profileName,
                'cpf' => (string) $profileCpf,
                'phone' => (string) $profilePhone,
                'email' => strtolower($profileEmail),
            ],
        ], $this->validateRegistrationAcceptance($payload, $createIfMissing));
    }

    /**
     * Exige aceite de termos/privacidade para criacao de conta social e aceita
     * aceite de adesao apenas quando o fluxo de checkout o envia explicitamente.
     */
    private function validateRegistrationAcceptance(array $payload, bool $required): array
    {
        if (!$required) {
            return [
                'termsAccepted' => false,
                'termsVersion' => '',
                'privacyAccepted' => false,
                'privacyVersion' => '',
                'checkoutAdhesionTermsAccepted' => false,
                'checkoutAdhesionTermsVersion' => '',
            ];
        }

        $acceptance = [
            'termsAccepted' => true,
            'termsVersion' => LegalAcceptance::assertAccepted(
                $payload,
                'termsAccepted',
                'termsVersion',
                'terms_of_use'
            ),
            'privacyAccepted' => true,
            'privacyVersion' => LegalAcceptance::assertAccepted(
                $payload,
                'privacyAccepted',
                'privacyVersion',
                'privacy_policy'
            ),
            'checkoutAdhesionTermsAccepted' => false,
            'checkoutAdhesionTermsVersion' => '',
        ];

        $hasCheckoutAcceptance = array_key_exists('checkoutAdhesionTermsAccepted', $payload)
            || array_key_exists('checkoutAdhesionTermsVersion', $payload);
        if ($hasCheckoutAcceptance) {
            $acceptance['checkoutAdhesionTermsAccepted'] = true;
            $acceptance['checkoutAdhesionTermsVersion'] = LegalAcceptance::assertAccepted(
                $payload,
                'checkoutAdhesionTermsAccepted',
                'checkoutAdhesionTermsVersion',
                'checkout_adhesion_terms'
            );
        }

        return $acceptance;
    }

    /**
     * Valida o payload de solicitacao de recuperacao de senha.
     *
     * @since 1.0.0
     */
    public function validateForgotPasswordPayload(array $payload): array
    {
        $email = trim((string) ($payload['email'] ?? ''));
        if ($email === '') {
            throw new InvalidArgumentException('O campo email e obrigatorio.');
        }

        if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
            throw new InvalidArgumentException('Formato de e-mail invalido.');
        }

        return [
            'email' => $email,
            'captchaToken' => trim((string) ($payload['captchaToken'] ?? '')),
        ];
    }

    /**
     * Valida o payload de redefinicao de senha enviado pela tela de reset.
     *
     * @since 1.0.0
     */
    public function validateResetPasswordPayload(array $payload): array
    {
        $token = trim((string) ($payload['token'] ?? ''));
        $password = (string) ($payload['password'] ?? '');

        if ($token === '' || $password === '') {
            throw new InvalidArgumentException('Os campos token e password sao obrigatorios.');
        }

        if (mb_strlen($password) < 6) {
            throw new InvalidArgumentException('A nova senha deve ter pelo menos 6 caracteres.');
        }

        return [
            'token' => $token,
            'password' => $password,
            'captchaToken' => trim((string) ($payload['captchaToken'] ?? '')),
        ];
    }

    /**
     * Valida o token de confirmacao de e-mail.
     *
     * @since 1.0.0
     */
    public function validateConfirmationTokenPayload(array $payload): string
    {
        $token = trim((string) ($payload['token'] ?? ''));
        if ($token === '') {
            throw new InvalidArgumentException('O token de confirmacao e obrigatorio.');
        }

        return $token;
    }

    /**
     * Garante que a sessao autenticada esteja presente antes de rotas protegidas.
     *
     * @since 1.0.0
     */
    public function validateAuthenticatedUser(array $payload): array
    {
        $userId = trim((string) ($payload['user_id'] ?? ''));
        $email = trim((string) ($payload['email'] ?? ''));

        if ($userId === '') {
            throw new RuntimeException('Sessao invalida ou expirada.');
        }

        return [
            'userId' => $userId,
            'email' => $email,
            'role' => trim((string) ($payload['role'] ?? '')),
        ];
    }

    /**
     * Restringe rotas administrativas de 2FA a administradores autenticados.
     *
     * @since 1.0.0
     */
    public function ensureAdminAuthenticated(array $payload): array
    {
        $user = $this->validateAuthenticatedUser($payload);
        if (($user['role'] ?? '') !== 'admin') {
            throw new DomainException('Acesso restrito a administradores.');
        }

        return $user;
    }

    /**
     * Valida o reenvio de confirmacao sem permitir trocar o e-mail alvo por payload.
     *
     * @since 1.0.0
     */
    public function validateResendConfirmationPayload(string $authenticatedEmail, array $payload): string
    {
        $requestedEmail = trim((string) ($payload['email'] ?? ''));
        if ($requestedEmail === '') {
            return $authenticatedEmail;
        }

        if ($authenticatedEmail !== '' && strcasecmp($requestedEmail, $authenticatedEmail) !== 0) {
            throw new DomainException('O reenvio so pode ser solicitado para o e-mail da sessao atual.');
        }

        return $requestedEmail;
    }

    /**
     * Valida o payload de ativacao de 2FA.
     *
     * @since 1.0.0
     */
    public function validateEnableTwoFactorPayload(array $payload): array
    {
        $secret = trim((string) ($payload['secret'] ?? ''));
        $code = trim((string) ($payload['code'] ?? ''));

        if ($secret === '' || $code === '') {
            throw new InvalidArgumentException('Secret e codigo sao obrigatorios.');
        }

        return [
            'secret' => $secret,
            'code' => $code,
        ];
    }

    /**
     * Valida o payload de verificacao do codigo 2FA.
     *
     * @since 1.0.0
     */
    public function validateVerifyTwoFactorPayload(array $payload): array
    {
        $email = trim((string) ($payload['email'] ?? ''));
        $code = trim((string) ($payload['code'] ?? ''));

        if ($email === '' || $code === '') {
            throw new InvalidArgumentException('E-mail e codigo sao obrigatorios.');
        }

        if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
            throw new InvalidArgumentException('Formato de e-mail invalido.');
        }

        return [
            'email' => $email,
            'code' => $code,
        ];
    }

    /**
     * Valida CPF com os digitos verificadores oficiais.
     *
     * @since 1.0.0
     */
    private function isValidCpf(string $cpf): bool
    {
        if (!preg_match('/^\d{11}$/', $cpf) || preg_match('/^(\d)\1{10}$/', $cpf)) {
            return false;
        }

        for ($position = 9; $position < 11; $position++) {
            $sum = 0;
            for ($index = 0; $index < $position; $index++) {
                $sum += ((int) $cpf[$index]) * (($position + 1) - $index);
            }

            $digit = ((10 * $sum) % 11) % 10;
            if ($digit !== (int) $cpf[$position]) {
                return false;
            }
        }

        return true;
    }
}
