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

require_once __DIR__ . '/../repositories/AuthRepository.php';
require_once __DIR__ . '/../validators/AuthValidator.php';
require_once __DIR__ . '/../../../shared/auth/AuthSession.php';
require_once __DIR__ . '/../../../shared/utils/Mailer.php';
require_once __DIR__ . '/../../../shared/utils/EmailTemplateResolver.php';
require_once __DIR__ . '/../../../shared/auth/GoogleAuthenticator.php';
require_once __DIR__ . '/../../../config/payment_provider.php';
require_once __DIR__ . '/../../users/services/UsersService.php';
require_once __DIR__ . '/../../users/repositories/UsersRepository.php';
require_once __DIR__ . '/../../users/validators/UsersValidator.php';

/**
 * Service do dominio de autenticacao.
 * Concentra regras de sessao, recuperacao de senha e confirmacao de e-mail.
 *
 * @since 1.0.0
 */
class AuthService
{
    private AuthRepository $repository;
    private AuthValidator $validator;

    /**
     * Injeta o repositorio e o validador do dominio.
     *
     * @since 1.0.0
     */
    public function __construct(AuthRepository $repository, AuthValidator $validator)
    {
        $this->repository = $repository;
        $this->validator = $validator;
    }

    /**
     * Finaliza a sessao autenticada atual usando a infraestrutura compartilhada.
     *
     * @since 1.0.0
     */
    public function logout(?array $nativeCredentials = null): array
    {
        $db = $this->repository->getConnection();
        ensureAuthTables($db);
        logoutAuthSession(
            $db,
            $nativeCredentials['refreshToken'] ?? null,
            $nativeCredentials['csrfToken'] ?? null,
            $nativeCredentials === null
        );

        return [];
    }

    /**
     * Renova a sessao atual rotacionando o refresh token via infraestrutura oficial.
     *
     * @since 1.0.0
     */
    public function refreshSession(bool $includeUser = false, ?array $nativeCredentials = null): array
    {
        $db = $this->repository->getConnection();
        ensureAuthTables($db);

        $refreshData = $nativeCredentials === null
            ? refreshAccessTokenFromCookie($db)
            : refreshNativeAccessToken(
                $db,
                (string) ($nativeCredentials['refreshToken'] ?? ''),
                (string) ($nativeCredentials['csrfToken'] ?? '')
            );
        $payload = [
            'token' => $refreshData['token'],
            'authSession' => [
                'id' => $refreshData['session_id'],
                'accessExpiresIn' => $refreshData['access_expires_in'],
            ],
        ];

        if ($nativeCredentials !== null) {
            $payload['refreshToken'] = $refreshData['refresh_token'];
            $payload['csrfToken'] = $refreshData['csrf_token'];
        }

        if ($includeUser && !empty($refreshData['user_id'])) {
            $payload = array_merge($payload, $this->buildAuthenticatedSessionPayload((string) $refreshData['user_id']));
        }

        return $payload;
    }

    /**
     * Autentica o usuario por e-mail e senha, emitindo a sessao oficial quando permitido.
     *
     * @since 1.0.0
     */
    public function login(array $payload, bool $nativeClient = false): array
    {
        $normalized = $this->validator->validateLoginPayload($payload);
        $user = $this->repository->findUserForLoginByEmail($normalized['email']);

        if (!$user || !password_verify($normalized['password'], (string) ($user['password_hash'] ?? ''))) {
            throw new RuntimeException('Invalid email or password');
        }

        $this->assertUserCanAuthenticate($user);

        if ($this->shouldRequireTwoFactor($user)) {
            return [
                'require2FA' => true,
                'email' => $user['email'],
            ];
        }

        $db = $this->repository->getConnection();
        $tokenData = issueUserAuthBundle($db, [
            'id' => $user['id'],
            'email' => $user['email'],
            'role' => $user['role'],
        ], $nativeClient, 'auth_login', !$nativeClient);

        $result = array_merge($this->buildAuthenticatedSessionPayload((string) $user['id']), [
            'token' => $tokenData['token'],
            'authSession' => [
                'id' => $tokenData['session_id'],
                'accessExpiresIn' => $tokenData['access_expires_in'],
                'refreshExpiresAt' => $tokenData['refresh_expires_at'],
            ],
        ]);

        if ($nativeClient) {
            $result['refreshToken'] = $tokenData['refresh_token'];
            $result['csrfToken'] = $tokenData['csrf_token'];
        }

        return $result;
    }

    /**
     * Cria uma nova conta de estudante, gera sessao e dispara o onboarding inicial.
     *
     * @since 1.0.0
     */
    public function register(array $payload, bool $nativeClient = false): array
    {
        $normalized = $this->validator->validateRegisterPayload($payload);
        $this->repository->ensureAuthProfileColumns();

        if ($this->repository->findUserByEmail($normalized['email'])) {
            throw new DomainException('Este e-mail ja esta cadastrado.');
        }

        if ($this->repository->findUserByCpf($normalized['cpf'])) {
            throw new DomainException('Este CPF ja esta cadastrado.');
        }

        $newUserId = $this->createUuid();
        $referralCode = strtoupper(substr(str_replace('-', '', $newUserId), 0, 8));
        $referredById = null;

        if ($normalized['referralCode'] !== '') {
            $referrer = $this->repository->findReferrerByCode($normalized['referralCode']);
            if ($referrer) {
                $referredById = $referrer['id'];
            }
        }

        $verificationToken = bin2hex(random_bytes(32));
        $verificationExpiresAt = date('Y-m-d H:i:s', time() + 86400);

        try {
            $this->repository->beginTransaction();
            $this->repository->ensureEmailVerificationTable();
            $this->repository->insertUser([
                'id' => $newUserId,
                'name' => $normalized['name'],
                'cpf' => $normalized['cpf'],
                'phone' => $normalized['phone'],
                'email' => $normalized['email'],
                'password_hash' => password_hash($normalized['password'], PASSWORD_DEFAULT),
                'referral_code' => $referralCode,
                'referred_by_id' => $referredById,
                'preferences' => json_encode([
                    'shareData' => true,
                    'notifications' => true,
                ], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES),
            ]);

            if ($referredById) {
                $this->repository->insertReferral([
                    'referrer_id' => $referredById,
                    'referred_user_id' => $newUserId,
                ]);
            }

            $this->repository->createEmailVerification($newUserId, $verificationToken, $verificationExpiresAt);
            $this->repository->insertNotification([
                'id' => $this->createUuid(),
                'user_id' => $newUserId,
                'title' => 'Bem-vindo ao ConcursoMestre!',
                'message' => 'Que bom ter voce aqui! Aproveite para explorar os planos e acelerar sua aprovacao.',
                'category' => 'system',
                'type' => 'info',
                'link' => '/plans',
            ]);
            $this->repository->commit();
        } catch (Throwable $e) {
            if ($this->repository->inTransaction()) {
                $this->repository->rollBack();
            }
            throw $e;
        }

        $tokenData = issueUserAuthBundle($this->repository->getConnection(), [
            'id' => $newUserId,
            'email' => $normalized['email'],
            'role' => 'student',
        ], $nativeClient, 'auth_registration', !$nativeClient);

        $emailDelivery = $this->sendVerificationEmail($normalized['email'], $normalized['name'], $verificationToken);

        $result = array_merge($this->buildAuthenticatedSessionPayload($newUserId), [
            'token' => $tokenData['token'],
            'emailDelivery' => $emailDelivery,
            'authSession' => [
                'id' => $tokenData['session_id'],
                'accessExpiresIn' => $tokenData['access_expires_in'],
                'refreshExpiresAt' => $tokenData['refresh_expires_at'],
            ],
        ]);

        if ($nativeClient) {
            $result['refreshToken'] = $tokenData['refresh_token'];
            $result['csrfToken'] = $tokenData['csrf_token'];
        }

        return $result;
    }

    /**
     * Autentica ou cria conta usando o ID token emitido pelo Google Identity Services.
     *
     * @since 1.0.0
     */
    public function googleLogin(array $payload): array
    {
        $normalized = $this->validator->validateGooglePayload($payload);
        $googleUser = $this->verifyGoogleIdToken($normalized['credential']);
        $email = strtolower(trim((string) ($googleUser['email'] ?? '')));
        $googleSub = trim((string) ($googleUser['sub'] ?? ''));
        $name = trim((string) ($googleUser['name'] ?? ''));
        $picture = trim((string) ($googleUser['picture'] ?? ''));
        $emailVerified = filter_var($googleUser['email_verified'] ?? false, FILTER_VALIDATE_BOOLEAN);
        $profileName = trim((string) (($normalized['profile']['name'] ?? '')));
        $profileCpf = trim((string) (($normalized['profile']['cpf'] ?? '')));
        $profilePhone = trim((string) (($normalized['profile']['phone'] ?? '')));
        $linkUserId = trim((string) ($normalized['linkUserId'] ?? ''));

        if ($googleSub === '' || $email === '' || !$emailVerified) {
            throw new RuntimeException('Conta Google sem e-mail verificado.');
        }

        if ($profileName !== '') {
            $name = $profileName;
        }

        if ($name === '') {
            $name = explode('@', $email)[0] ?: 'Aluno ConcursoMestre';
        }

        $this->repository->ensureGoogleAuthColumns();

        if ($linkUserId !== '') {
            return $this->linkSocialAccountForAuthenticatedUser(
                'google',
                $linkUserId,
                $googleSub,
                $email,
                $picture ?: null
            );
        }

        $user = $this->repository->findUserForSocialByGoogleSub($googleSub);
        $isNewUser = false;

        if (!$user) {
            $existingUser = $this->repository->findUserForSocialByEmail($email);

            if ($existingUser) {
                $linkedSub = trim((string) ($existingUser['google_sub'] ?? ''));
                if ($linkedSub !== '' && $linkedSub !== $googleSub) {
                    throw new DomainException('Este e-mail ja esta vinculado a outra conta Google.');
                }

                $this->repository->linkGoogleAccount((string) $existingUser['id'], $googleSub, $picture ?: null);
                $user = $this->repository->findUserForSocialByGoogleSub($googleSub)
                    ?: $this->repository->findUserForSocialByEmail($email);
            } else {
                if (!$normalized['createIfMissing']) {
                    throw new OutOfBoundsException('Conta nao encontrada. Crie sua conta antes de entrar com Google.');
                }

                if ($profileCpf === '' || $profilePhone === '') {
                    throw new DomainException('Conta Google sem dados pessoais. Informe CPF, nome e telefone para concluir.');
                }

                if ($this->repository->findUserByCpf($profileCpf)) {
                    throw new DomainException('Este CPF ja esta cadastrado.');
                }

                $newUserId = $this->createUuid();
                $referralCode = strtoupper(substr(str_replace('-', '', $newUserId), 0, 8));
                $referredById = null;

                if ($normalized['referralCode'] !== '') {
                    $referrer = $this->repository->findReferrerByCode($normalized['referralCode']);
                    if ($referrer) {
                        $referredById = $referrer['id'];
                    }
                }

                try {
                    $this->repository->beginTransaction();
                    $this->repository->insertGoogleUser([
                        'id' => $newUserId,
                        'name' => $name,
                        'cpf' => $profileCpf,
                        'phone' => $profilePhone,
                        'email' => $email,
                        'photo_url' => $picture ?: null,
                        'password_hash' => password_hash(bin2hex(random_bytes(32)), PASSWORD_DEFAULT),
                        'google_sub' => $googleSub,
                        'referral_code' => $referralCode,
                        'referred_by_id' => $referredById,
                        'preferences' => json_encode([
                            'shareData' => true,
                            'notifications' => true,
                        ], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES),
                    ]);

                    if ($referredById) {
                        $this->repository->insertReferral([
                            'referrer_id' => $referredById,
                            'referred_user_id' => $newUserId,
                        ]);
                    }

                    $this->repository->insertNotification([
                        'id' => $this->createUuid(),
                        'user_id' => $newUserId,
                        'title' => 'Bem-vindo ao ConcursoMestre!',
                        'message' => 'Sua conta foi criada com Google. Voce ja pode resolver questoes e montar seu plano de estudos.',
                        'category' => 'system',
                        'type' => 'success',
                        'link' => '/profile',
                    ]);
                    $this->repository->commit();
                } catch (Throwable $e) {
                    if ($this->repository->inTransaction()) {
                        $this->repository->rollBack();
                    }
                    throw $e;
                }

                $user = $this->repository->findUserForSocialByGoogleSub($googleSub);
                $isNewUser = true;
            }
        }

        if (!$user) {
            throw new RuntimeException('Nao foi possivel localizar a conta autenticada pelo Google.');
        }

        $this->assertUserCanAuthenticate($user, 'Conta indisponivel para autenticacao.');

        if ($this->shouldRequireTwoFactor($user)) {
            return [
                'require2FA' => true,
                'email' => $user['email'],
            ];
        }

        $tokenData = issueUserAuthBundle($this->repository->getConnection(), [
            'id' => $user['id'],
            'email' => $user['email'],
            'role' => $user['role'],
        ], false, 'auth_social_callback');

        return array_merge($this->buildAuthenticatedSessionPayload((string) $user['id']), [
            'token' => $tokenData['token'],
            'isNewUser' => $isNewUser,
            'authSession' => [
                'id' => $tokenData['session_id'],
                'accessExpiresIn' => $tokenData['access_expires_in'],
                'refreshExpiresAt' => $tokenData['refresh_expires_at'],
            ],
        ]);
    }

    /**
     * Autentica ou cria conta usando o token de acesso do Facebook.
     *
     * @since 1.0.0
     */
    public function facebookLogin(array $payload): array
    {
        $normalized = $this->validator->validateFacebookPayload($payload);
        $facebookUser = $this->verifyFacebookAccessToken($normalized['accessToken']);
        $email = strtolower(trim((string) ($facebookUser['email'] ?? '')));
        $facebookId = trim((string) ($facebookUser['id'] ?? ''));
        $name = trim((string) ($facebookUser['name'] ?? ''));
        $picture = trim((string) ($facebookUser['picture_url'] ?? ''));
        $profileName = trim((string) (($normalized['profile']['name'] ?? '')));
        $profileCpf = trim((string) (($normalized['profile']['cpf'] ?? '')));
        $profilePhone = trim((string) (($normalized['profile']['phone'] ?? '')));
        $linkUserId = trim((string) ($normalized['linkUserId'] ?? ''));

        if ($facebookId === '' || $email === '') {
            throw new RuntimeException('Conta Facebook sem e-mail valido.');
        }

        if ($profileName !== '') {
            $name = $profileName;
        }

        if ($name === '') {
            $name = explode('@', $email)[0] ?: 'Aluno ConcursoMestre';
        }

        return $this->resolveSocialLogin([
            'provider' => 'facebook',
            'provider_id' => $facebookId,
            'email' => $email,
            'name' => $name,
            'photo_url' => $picture !== '' ? $picture : null,
            'profile_cpf' => $profileCpf,
            'profile_phone' => $profilePhone,
            'link_user_id' => $linkUserId,
            'create_if_missing' => (bool) $normalized['createIfMissing'],
            'referral_code' => (string) ($normalized['referralCode'] ?? ''),
            'conflict_message' => 'Este e-mail ja esta vinculado a outra conta Facebook.',
            'not_found_message' => 'Conta nao encontrada. Crie sua conta antes de entrar com Facebook.',
            'profile_required_message' => 'Conta Facebook sem dados pessoais. Informe CPF, nome e telefone para concluir.',
            'welcome_message' => 'Sua conta foi criada com Facebook. Voce ja pode resolver questoes e montar seu plano de estudos.',
        ]);
    }

    /**
     * Autentica ou cria conta usando o ID token da Apple.
     *
     * @since 1.0.0
     */
    public function appleLogin(array $payload): array
    {
        $normalized = $this->validator->validateApplePayload($payload);
        $appleUser = $this->verifyAppleIdToken($normalized['idToken']);
        $email = strtolower(trim((string) ($appleUser['email'] ?? '')));
        $appleSub = trim((string) ($appleUser['sub'] ?? ''));
        $name = trim((string) ($appleUser['name'] ?? ''));
        $profileName = trim((string) (($normalized['profile']['name'] ?? '')));
        $profileCpf = trim((string) (($normalized['profile']['cpf'] ?? '')));
        $profilePhone = trim((string) (($normalized['profile']['phone'] ?? '')));
        $profileEmail = strtolower(trim((string) (($normalized['profile']['email'] ?? ''))));

        if ($email === '' && $profileEmail !== '') {
            $email = $profileEmail;
        }

        if ($appleSub === '' || $email === '') {
            throw new RuntimeException('Conta Apple sem e-mail valido.');
        }

        if ($profileName !== '') {
            $name = $profileName;
        }

        if ($name === '') {
            $name = explode('@', $email)[0] ?: 'Aluno ConcursoMestre';
        }

        return $this->resolveSocialLogin([
            'provider' => 'apple',
            'provider_id' => $appleSub,
            'email' => $email,
            'name' => $name,
            'photo_url' => null,
            'profile_cpf' => $profileCpf,
            'profile_phone' => $profilePhone,
            'create_if_missing' => (bool) $normalized['createIfMissing'],
            'referral_code' => (string) ($normalized['referralCode'] ?? ''),
            'conflict_message' => 'Este e-mail ja esta vinculado a outra conta Apple.',
            'not_found_message' => 'Conta nao encontrada. Crie sua conta antes de entrar com Apple.',
            'profile_required_message' => 'Conta Apple sem dados pessoais. Informe CPF, nome e telefone para concluir.',
            'welcome_message' => 'Sua conta foi criada com Apple. Voce ja pode resolver questoes e montar seu plano de estudos.',
        ]);
    }

    /**
     * Resolve o fluxo comum de login social com vinculo e criacao opcional.
     *
     * @since 1.0.0
     */
    private function resolveSocialLogin(array $context): array
    {
        $provider = (string) ($context['provider'] ?? '');
        $providerId = trim((string) ($context['provider_id'] ?? ''));
        $email = strtolower(trim((string) ($context['email'] ?? '')));
        $name = trim((string) ($context['name'] ?? ''));
        $photoUrl = isset($context['photo_url']) ? trim((string) $context['photo_url']) : '';
        $profileCpf = trim((string) ($context['profile_cpf'] ?? ''));
        $profilePhone = trim((string) ($context['profile_phone'] ?? ''));
        $linkUserId = trim((string) ($context['link_user_id'] ?? ''));
        $createIfMissing = !empty($context['create_if_missing']);
        $referralCode = trim((string) ($context['referral_code'] ?? ''));

        if ($provider === '' || $providerId === '' || $email === '') {
            throw new RuntimeException('Dados de autenticacao social incompletos.');
        }

        $providerColumn = $this->resolveSocialProviderColumn($provider);
        $this->repository->ensureGoogleAuthColumns();

        if ($linkUserId !== '') {
            return $this->linkSocialAccountForAuthenticatedUser(
                $provider,
                $linkUserId,
                $providerId,
                $email,
                $photoUrl !== '' ? $photoUrl : null
            );
        }

        $user = $this->findSocialUserByProvider($provider, $providerId);
        $isNewUser = false;

        if (!$user) {
            $existingUser = $this->repository->findUserForSocialByEmail($email);

            if ($existingUser) {
                $linkedProviderId = trim((string) ($existingUser[$providerColumn] ?? ''));
                if ($linkedProviderId !== '' && $linkedProviderId !== $providerId) {
                    throw new DomainException((string) ($context['conflict_message'] ?? 'Conta ja vinculada a outro provedor social.'));
                }

                $this->linkSocialAccount(
                    $provider,
                    (string) $existingUser['id'],
                    $providerId,
                    $photoUrl !== '' ? $photoUrl : null
                );
                $user = $this->findSocialUserByProvider($provider, $providerId)
                    ?: $this->repository->findUserForSocialByEmail($email);
            } else {
                if (!$createIfMissing) {
                    throw new OutOfBoundsException((string) ($context['not_found_message'] ?? 'Conta nao encontrada.'));
                }

                if ($profileCpf === '' || $profilePhone === '') {
                    throw new DomainException((string) ($context['profile_required_message'] ?? 'Informe CPF, nome e telefone para concluir o cadastro.'));
                }

                if ($this->repository->findUserByCpf($profileCpf)) {
                    throw new DomainException('Este CPF ja esta cadastrado.');
                }

                $newUserId = $this->createUuid();
                $generatedReferralCode = strtoupper(substr(str_replace('-', '', $newUserId), 0, 8));
                $referredById = null;

                if ($referralCode !== '') {
                    $referrer = $this->repository->findReferrerByCode($referralCode);
                    if ($referrer) {
                        $referredById = $referrer['id'];
                    }
                }

                try {
                    $this->repository->beginTransaction();
                    $this->insertSocialUser($provider, [
                        'id' => $newUserId,
                        'name' => $name,
                        'cpf' => $profileCpf,
                        'phone' => $profilePhone,
                        'email' => $email,
                        'photo_url' => $photoUrl !== '' ? $photoUrl : null,
                        'password_hash' => password_hash(bin2hex(random_bytes(32)), PASSWORD_DEFAULT),
                        'provider_id' => $providerId,
                        'referral_code' => $generatedReferralCode,
                        'referred_by_id' => $referredById,
                        'preferences' => json_encode([
                            'shareData' => true,
                            'notifications' => true,
                        ], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES),
                    ]);

                    if ($referredById) {
                        $this->repository->insertReferral([
                            'referrer_id' => $referredById,
                            'referred_user_id' => $newUserId,
                        ]);
                    }

                    $this->repository->insertNotification([
                        'id' => $this->createUuid(),
                        'user_id' => $newUserId,
                        'title' => 'Bem-vindo ao ConcursoMestre!',
                        'message' => (string) ($context['welcome_message'] ?? 'Sua conta foi criada com autenticacao social.'),
                        'category' => 'system',
                        'type' => 'success',
                        'link' => '/profile',
                    ]);
                    $this->repository->commit();
                } catch (Throwable $e) {
                    if ($this->repository->inTransaction()) {
                        $this->repository->rollBack();
                    }
                    throw $e;
                }

                $user = $this->findSocialUserByProvider($provider, $providerId);
                $isNewUser = true;
            }
        }

        if (!$user) {
            throw new RuntimeException('Nao foi possivel localizar a conta autenticada pelo provedor social.');
        }

        $this->assertUserCanAuthenticate($user, 'Conta indisponivel para autenticacao.');

        if ($this->shouldRequireTwoFactor($user)) {
            return [
                'require2FA' => true,
                'email' => $user['email'],
            ];
        }

        $tokenData = issueUserAuthBundle($this->repository->getConnection(), [
            'id' => $user['id'],
            'email' => $user['email'],
            'role' => $user['role'],
        ], false, 'auth_social_callback');

        return array_merge($this->buildAuthenticatedSessionPayload((string) $user['id']), [
            'token' => $tokenData['token'],
            'isNewUser' => $isNewUser,
            'authSession' => [
                'id' => $tokenData['session_id'],
                'accessExpiresIn' => $tokenData['access_expires_in'],
                'refreshExpiresAt' => $tokenData['refresh_expires_at'],
            ],
        ]);
    }

    /**
     * Mapeia o nome do provedor para a coluna de vinculo no banco.
     *
     * @since 1.0.0
     */
    private function resolveSocialProviderColumn(string $provider): string
    {
        if ($provider === 'google') {
            return 'google_sub';
        }

        if ($provider === 'facebook') {
            return 'facebook_id';
        }

        if ($provider === 'apple') {
            return 'apple_sub';
        }

        throw new InvalidArgumentException('Provedor social nao suportado.');
    }

    /**
     * Busca usuario vinculado pelo identificador do provedor social.
     *
     * @since 1.0.0
     */
    private function findSocialUserByProvider(string $provider, string $providerId): ?array
    {
        if ($provider === 'google') {
            return $this->repository->findUserForSocialByGoogleSub($providerId);
        }

        if ($provider === 'facebook') {
            return $this->repository->findUserForSocialByFacebookId($providerId);
        }

        if ($provider === 'apple') {
            return $this->repository->findUserForSocialByAppleSub($providerId);
        }

        throw new InvalidArgumentException('Provedor social nao suportado.');
    }

    /**
     * Vincula conta existente ao provedor social informado.
     *
     * @since 1.0.0
     */
    private function linkSocialAccount(string $provider, string $userId, string $providerId, ?string $photoUrl): void
    {
        if ($provider === 'google') {
            $this->repository->linkGoogleAccount($userId, $providerId, $photoUrl);
            return;
        }

        if ($provider === 'facebook') {
            $this->repository->linkFacebookAccount($userId, $providerId, $photoUrl);
            return;
        }

        if ($provider === 'apple') {
            $this->repository->linkAppleAccount($userId, $providerId, $photoUrl);
            return;
        }

        throw new InvalidArgumentException('Provedor social nao suportado.');
    }

    /**
     * Vincula o provedor social ao usuario autenticado sem trocar a sessao atual.
     *
     * @since 1.0.0
     */
    private function linkSocialAccountForAuthenticatedUser(
        string $provider,
        string $userId,
        string $providerId,
        string $providerEmail,
        ?string $photoUrl
    ): array {
        $this->repository->ensureGoogleAuthColumns();

        $currentUser = $this->repository->findUserById($userId);
        if (!$currentUser) {
            throw new RuntimeException('Usuario autenticado nao encontrado para vincular a conta social.');
        }

        $localEmail = strtolower(trim((string) ($currentUser['email'] ?? '')));
        $normalizedProviderEmail = strtolower(trim($providerEmail));
        if ($localEmail === '' || $normalizedProviderEmail === '' || $localEmail !== $normalizedProviderEmail) {
            throw new DomainException('Use uma conta social com o mesmo e-mail do seu cadastro para conectar com seguranca.');
        }

        $providerColumn = $this->resolveSocialProviderColumn($provider);
        $linkedProviderId = trim((string) ($currentUser[$providerColumn] ?? ''));
        if ($linkedProviderId !== '' && $linkedProviderId !== $providerId) {
            throw new DomainException('Esta conta ja esta vinculada a outro perfil social desse provedor.');
        }

        $linkedUser = $this->findSocialUserByProvider($provider, $providerId);
        if ($linkedUser && (string) ($linkedUser['id'] ?? '') !== $userId) {
            throw new DomainException('Esta conta social ja esta conectada a outro usuario.');
        }

        if ($linkedProviderId === '') {
            $this->linkSocialAccount($provider, $userId, $providerId, $photoUrl);
        }

        return array_merge($this->buildAuthenticatedSessionPayload($userId), [
            'linkedProvider' => $provider,
            'isLinked' => true,
        ]);
    }

    /**
     * Insere novo usuario social de acordo com o provedor.
     *
     * @since 1.0.0
     */
    private function insertSocialUser(string $provider, array $payload): void
    {
        if ($provider === 'google') {
            $this->repository->insertGoogleUser([
                'id' => $payload['id'],
                'name' => $payload['name'],
                'cpf' => $payload['cpf'],
                'phone' => $payload['phone'],
                'email' => $payload['email'],
                'photo_url' => $payload['photo_url'],
                'password_hash' => $payload['password_hash'],
                'google_sub' => $payload['provider_id'],
                'referral_code' => $payload['referral_code'],
                'referred_by_id' => $payload['referred_by_id'],
                'preferences' => $payload['preferences'],
            ]);
            return;
        }

        if ($provider === 'facebook') {
            $this->repository->insertFacebookUser([
                'id' => $payload['id'],
                'name' => $payload['name'],
                'cpf' => $payload['cpf'],
                'phone' => $payload['phone'],
                'email' => $payload['email'],
                'photo_url' => $payload['photo_url'],
                'password_hash' => $payload['password_hash'],
                'facebook_id' => $payload['provider_id'],
                'referral_code' => $payload['referral_code'],
                'referred_by_id' => $payload['referred_by_id'],
                'preferences' => $payload['preferences'],
            ]);
            return;
        }

        if ($provider === 'apple') {
            $this->repository->insertAppleUser([
                'id' => $payload['id'],
                'name' => $payload['name'],
                'cpf' => $payload['cpf'],
                'phone' => $payload['phone'],
                'email' => $payload['email'],
                'photo_url' => $payload['photo_url'],
                'password_hash' => $payload['password_hash'],
                'apple_sub' => $payload['provider_id'],
                'referral_code' => $payload['referral_code'],
                'referred_by_id' => $payload['referred_by_id'],
                'preferences' => $payload['preferences'],
            ]);
            return;
        }

        throw new InvalidArgumentException('Provedor social nao suportado.');
    }

    /**
     * Gera um token de reset de senha e envia o e-mail para a conta encontrada.
     *
     * @since 1.0.0
     */
    public function requestPasswordReset(array $payload): array
    {
        $normalized = $this->validator->validateForgotPasswordPayload($payload);

        $this->repository->ensurePasswordResetTable();
        $user = $this->repository->findUserByEmail($normalized['email']);
        if (!$user) {
            throw new OutOfBoundsException('E-mail nao cadastrado. Deseja criar uma conta?');
        }

        $token = bin2hex(random_bytes(32));
        $expiresAt = date('Y-m-d H:i:s', time() + 3600);

        $this->repository->deletePasswordResetsByUserId((string) $user['id']);
        $this->repository->createPasswordReset((string) $user['id'], $token, $expiresAt);

        $appUrl = $this->resolveAppUrl();
        $resetUrl = $appUrl . '/reset-password?token=' . urlencode($token) . '&email=' . urlencode((string) $normalized['email']);

        $defaultHtml = Mailer::htmlTemplate(
            'Redefinicao de Senha',
            "<p>Ola, <strong>{$user['name']}</strong>!</p>
             <p>Recebemos uma solicitacao para redefinir a senha da sua conta no <strong>ConcursoMestre</strong>.</p>
             <p>Use o botao abaixo para criar uma nova senha. O link expira em <strong>1 hora</strong>.</p>",
            $resetUrl,
            'Redefinir minha senha'
        );
        $defaultText = "Ola {$user['name']},\n\nAcesse o link para redefinir sua senha:\n{$resetUrl}\n\nO link expira em 1 hora.";

        $template = $this->resolveEmailTemplate(
            'auth_password_reset',
            [
                'subject' => 'Redefina sua senha - ConcursoMestre',
                'htmlBody' => $defaultHtml,
                'textBody' => $defaultText,
            ],
            [
                'name' => (string) ($user['name'] ?? ''),
                'email' => (string) ($user['email'] ?? ''),
                'reset_url' => $resetUrl,
                'app_url' => $appUrl,
            ]
        );

        if ($template['enabled']) {
            Mailer::send(
                (string) $normalized['email'],
                (string) $user['name'],
                $template['subject'],
                $template['htmlBody'],
                $template['textBody']
            );
        }

        return [
            'message' => 'Se este e-mail estiver cadastrado, voce recebera as instrucoes em breve.',
        ];
    }

    /**
     * Conclui a redefinicao de senha a partir do token valido.
     *
     * @since 1.0.0
     */
    public function resetPassword(array $payload): array
    {
        $normalized = $this->validator->validateResetPasswordPayload($payload);

        $this->repository->ensurePasswordResetTable();
        $reset = $this->repository->findActivePasswordResetByToken($normalized['token']);
        if (!$reset) {
            throw new InvalidArgumentException('Token de redefinicao invalido ou expirado.');
        }

        try {
            $this->repository->beginTransaction();
            $this->repository->updateUserPasswordHash(
                (string) $reset['user_id'],
                password_hash($normalized['password'], PASSWORD_BCRYPT)
            );
            $this->repository->markPasswordResetAsUsed($normalized['token']);
            $this->repository->commit();
        } catch (Throwable $e) {
            if ($this->repository->inTransaction()) {
                $this->repository->rollBack();
            }
            throw $e;
        }

        return [
            'message' => 'Senha alterada com sucesso! Voce ja pode fazer login com sua nova senha.',
        ];
    }

    /**
     * Reenvia a confirmacao para o proprio usuario autenticado ainda nao verificado.
     *
     * @since 1.0.0
     */
    public function resendConfirmation(array $authenticatedUser, array $payload): array
    {
        $sessionUser = $this->validator->validateAuthenticatedUser($authenticatedUser);
        $email = $this->validator->validateResendConfirmationPayload($sessionUser['email'], $payload);

        $this->repository->ensureEmailVerificationTable();
        $user = $this->repository->findUserById($sessionUser['userId']);
        if (!$user) {
            throw new OutOfBoundsException('Usuario nao encontrado.');
        }

        if ($email !== '' && strcasecmp($email, (string) $user['email']) !== 0) {
            throw new DomainException('O reenvio so pode ser solicitado para o e-mail da sessao atual.');
        }

        if ((int) ($user['email_verified'] ?? 0) === 1) {
            return [
                'message' => 'Este e-mail ja foi verificado anteriormente.',
            ];
        }

        $token = bin2hex(random_bytes(32));
        $expiresAt = date('Y-m-d H:i:s', time() + 86400);

        $this->repository->deleteEmailVerificationsByUserId((string) $user['id']);
        $this->repository->createEmailVerification((string) $user['id'], $token, $expiresAt);

        $confirmUrl = $this->resolveAppUrl() . '/confirm-email?token=' . urlencode($token);
        $defaultHtml = Mailer::htmlTemplate(
            'Confirme seu E-mail',
            "<p>Ola, <strong>{$user['name']}</strong>!</p>
             <p>Voce solicitou o reenvio do link de confirmacao.</p>
             <p>Confirme seu endereco de e-mail clicando no botao abaixo para ativar a conta e ganhar <strong>50 XP</strong> de bonus.</p>",
            $confirmUrl,
            'Confirmar meu E-mail'
        );

        $defaultText = "Ola {$user['name']},\n\nAcesse o link para confirmar sua conta:\n{$confirmUrl}\n\nVoce ganhara 50 XP apos confirmar.";
        $template = $this->resolveEmailTemplate(
            'auth_email_confirmation_resend',
            [
                'subject' => 'Confirme sua conta - ConcursoMestre',
                'htmlBody' => $defaultHtml,
                'textBody' => $defaultText,
            ],
            [
                'name' => (string) ($user['name'] ?? ''),
                'email' => (string) ($user['email'] ?? ''),
                'confirm_url' => $confirmUrl,
                'xp_bonus' => '50',
                'app_url' => $this->resolveAppUrl(),
            ]
        );

        if ($template['enabled']) {
            Mailer::send(
                (string) $user['email'],
                (string) $user['name'],
                $template['subject'],
                $template['htmlBody'],
                $template['textBody']
            );
        }

        return [
            'message' => 'E-mail de confirmacao reenviado com sucesso! Verifique sua caixa de entrada.',
        ];
    }

    /**
     * Confirma o token de verificacao, soma XP e cria notificacao de boas-vindas.
     *
     * @since 1.0.0
     */
    public function confirmEmail(array $payload): array
    {
        $token = $this->validator->validateConfirmationTokenPayload($payload);

        $this->repository->ensureEmailVerificationTable();
        $verification = $this->repository->findActiveEmailVerificationByToken($token);
        if (!$verification) {
            throw new InvalidArgumentException('Link de verificacao invalido ou expirado.');
        }

        try {
            $this->repository->beginTransaction();
            $this->repository->markEmailVerificationAsUsed($token);

            $user = $this->repository->findUserById((string) $verification['user_id']);
            if (!$user) {
                throw new OutOfBoundsException('Usuario nao encontrado.');
            }

            if ((int) ($user['email_verified'] ?? 0) === 1) {
                $this->repository->rollBack();
                return [
                    'message' => 'Este e-mail ja foi verificado anteriormente.',
                    'newXp' => (int) ($user['xp'] ?? 0),
                ];
            }

            $newXp = (int) ($user['xp'] ?? 0) + 50;
            $this->repository->markUserEmailVerified((string) $user['id'], $newXp);
            $this->repository->insertNotification([
                'id' => $this->createUuid(),
                'user_id' => (string) $user['id'],
                'title' => 'Conta ativada com sucesso!',
                'message' => 'Sua conta foi verificada. Voce ganhou +50 XP de bonus de boas-vindas!',
                'category' => 'system',
                'type' => 'success',
                'link' => '/profile',
            ]);
            $this->repository->commit();

            $this->sendWelcomeEmail((string) $user['email'], (string) $user['name']);

            return [
                'message' => 'E-mail verificado com sucesso! Voce ganhou 50 XP.',
                'newXp' => $newXp,
            ];
        } catch (Throwable $e) {
            if ($this->repository->inTransaction()) {
                $this->repository->rollBack();
            }
            throw $e;
        }
    }

    /**
     * Prepara o onboarding de 2FA para o admin autenticado.
     *
     * @since 1.0.0
     */
    public function setupTwoFactor(array $authenticatedUser): array
    {
        $user = $this->validator->ensureAdminAuthenticated($authenticatedUser);
        $ga = new GoogleAuthenticator();
        $secret = $ga->createSecret();
        $qrCodeUrl = $ga->getQRCodeGoogleUrl(
            'ConcursoMestreAdmin: ' . $user['email'],
            $secret,
            'ConcursoMestre'
        );

        return [
            'secret' => $secret,
            'qrCodeUrl' => $qrCodeUrl,
        ];
    }

    /**
     * Ativa o 2FA do admin apos verificar o codigo informado.
     *
     * @since 1.0.0
     */
    public function enableTwoFactor(array $authenticatedUser, array $payload): array
    {
        $user = $this->validator->ensureAdminAuthenticated($authenticatedUser);
        $normalized = $this->validator->validateEnableTwoFactorPayload($payload);

        $ga = new GoogleAuthenticator();
        if (!$ga->verifyCode($normalized['secret'], $normalized['code'])) {
            throw new InvalidArgumentException('Codigo invalido. Tente novamente.');
        }

        $this->repository->enableTwoFactor($user['userId'], $normalized['secret']);

        return [
            'message' => '2FA ativado com sucesso!',
        ];
    }

    /**
     * Valida o codigo 2FA e libera a sessao definitiva.
     *
     * @since 1.0.0
     */
    public function verifyTwoFactor(array $payload, bool $nativeClient = false): array
    {
        $normalized = $this->validator->validateVerifyTwoFactorPayload($payload);
        $user = $this->repository->findUserForTwoFactorByEmail($normalized['email']);

        if (!$user || empty($user['two_factor_enabled'])) {
            throw new RuntimeException('2FA nao configurado para este usuario.');
        }

        $ga = new GoogleAuthenticator();
        if (!$ga->verifyCode((string) $user['two_factor_secret'], $normalized['code'])) {
            throw new RuntimeException('Codigo 2FA invalido.');
        }

        $tokenData = issueUserAuthBundle($this->repository->getConnection(), [
            'id' => $user['id'],
            'email' => $user['email'],
            'role' => $user['role'],
        ], $nativeClient, 'auth_two_factor_completion', !$nativeClient);

        $result = array_merge($this->buildAuthenticatedSessionPayload((string) $user['id']), [
            'token' => $tokenData['token'],
            'authSession' => [
                'id' => $tokenData['session_id'],
                'accessExpiresIn' => $tokenData['access_expires_in'],
                'refreshExpiresAt' => $tokenData['refresh_expires_at'],
            ],
        ]);

        if ($nativeClient) {
            $result['refreshToken'] = $tokenData['refresh_token'];
            $result['csrfToken'] = $tokenData['csrf_token'];
        }

        return $result;
    }

    /**
     * Resolve a URL publica do frontend usada nos links de e-mail.
     *
     * @since 1.0.0
     */
    private function resolveAppUrl(): string
    {
        return rtrim(getenv('APP_URL') ?: 'http://localhost:3000', '/');
    }

    /**
     * Valida token do Facebook e retorna dados minimos do usuario.
     *
     * @since 1.0.0
     */
    private function verifyFacebookAccessToken(string $accessToken): array
    {
        $appId = $this->resolveFacebookAppId();
        $appSecret = $this->resolveFacebookAppSecret();
        $appToken = rawurlencode($appId . '|' . $appSecret);
        $encodedUserToken = rawurlencode($accessToken);

        $debugPayload = $this->loadJsonFromUrl(
            "https://graph.facebook.com/debug_token?input_token={$encodedUserToken}&access_token={$appToken}",
            'Nao foi possivel validar o Facebook no momento.'
        );
        $debugData = is_array($debugPayload['data'] ?? null) ? $debugPayload['data'] : [];

        if (empty($debugData['is_valid'])) {
            throw new RuntimeException('Token do Facebook invalido ou expirado.');
        }

        if ((string) ($debugData['app_id'] ?? '') !== $appId) {
            throw new RuntimeException('Token do Facebook emitido para outro aplicativo.');
        }

        $userPayload = $this->loadJsonFromUrl(
            "https://graph.facebook.com/me?fields=id,name,email,picture&access_token={$encodedUserToken}",
            'Nao foi possivel carregar os dados do Facebook no momento.'
        );

        $pictureUrl = '';
        if (is_array($userPayload['picture']['data'] ?? null)) {
            $pictureUrl = trim((string) ($userPayload['picture']['data']['url'] ?? ''));
        }

        return [
            'id' => trim((string) ($userPayload['id'] ?? '')),
            'name' => trim((string) ($userPayload['name'] ?? '')),
            'email' => strtolower(trim((string) ($userPayload['email'] ?? ''))),
            'picture_url' => $pictureUrl,
        ];
    }

    /**
     * Verifica assinatura e claims do ID token da Apple.
     *
     * @since 1.0.0
     */
    private function verifyAppleIdToken(string $idToken): array
    {
        $parts = explode('.', $idToken);
        if (count($parts) !== 3) {
            throw new InvalidArgumentException('Token da Apple invalido.');
        }

        [$encodedHeader, $encodedPayload, $encodedSignature] = $parts;
        $header = json_decode($this->base64UrlDecodeSafe($encodedHeader, 'Token da Apple malformado.'), true);
        $payload = json_decode($this->base64UrlDecodeSafe($encodedPayload, 'Token da Apple malformado.'), true);

        if (!is_array($header) || !is_array($payload)) {
            throw new InvalidArgumentException('Token da Apple malformado.');
        }

        if (($header['alg'] ?? '') !== 'RS256' || empty($header['kid'])) {
            throw new InvalidArgumentException('Assinatura da Apple nao suportada.');
        }

        $publicKey = $this->resolveApplePublicKeyPem((string) $header['kid']);
        $signature = $this->base64UrlDecodeSafe($encodedSignature, 'Token da Apple malformado.');
        $verified = openssl_verify(
            $encodedHeader . '.' . $encodedPayload,
            $signature,
            $publicKey,
            OPENSSL_ALGO_SHA256
        );

        if ($verified !== 1) {
            throw new RuntimeException('Assinatura da Apple invalida.');
        }

        $clientId = $this->resolveAppleClientId();
        $audience = $payload['aud'] ?? '';
        $audiences = is_array($audience) ? $audience : [$audience];
        if (!in_array($clientId, $audiences, true)) {
            throw new RuntimeException('Token da Apple emitido para outro aplicativo.');
        }

        $issuer = (string) ($payload['iss'] ?? '');
        if ($issuer !== 'https://appleid.apple.com') {
            throw new RuntimeException('Emissor da Apple invalido.');
        }

        $now = time();
        if ((int) ($payload['exp'] ?? 0) < ($now - 60)) {
            throw new RuntimeException('Token da Apple expirado.');
        }

        if ((int) ($payload['iat'] ?? 0) > ($now + 300)) {
            throw new RuntimeException('Token da Apple ainda nao e valido.');
        }

        $emailVerifiedRaw = $payload['email_verified'] ?? true;
        $emailVerified = is_bool($emailVerifiedRaw)
            ? $emailVerifiedRaw
            : in_array(strtolower((string) $emailVerifiedRaw), ['1', 'true', 'yes'], true);
        if (!$emailVerified) {
            throw new RuntimeException('Conta Apple sem e-mail verificado.');
        }

        return $payload;
    }

    /**
     * Verifica assinatura e claims do ID token do Google.
     *
     * @since 1.0.0
     */
    private function verifyGoogleIdToken(string $credential): array
    {
        $parts = explode('.', $credential);
        if (count($parts) !== 3) {
            throw new InvalidArgumentException('Credencial do Google invalida.');
        }

        [$encodedHeader, $encodedPayload, $encodedSignature] = $parts;
        $header = json_decode($this->base64UrlDecode($encodedHeader), true);
        $payload = json_decode($this->base64UrlDecode($encodedPayload), true);

        if (!is_array($header) || !is_array($payload)) {
            throw new InvalidArgumentException('Credencial do Google malformada.');
        }

        if (($header['alg'] ?? '') !== 'RS256' || empty($header['kid'])) {
            throw new InvalidArgumentException('Assinatura do Google nao suportada.');
        }

        $certificate = $this->resolveGoogleCertificate((string) $header['kid']);
        $signature = $this->base64UrlDecode($encodedSignature);
        $verified = openssl_verify(
            $encodedHeader . '.' . $encodedPayload,
            $signature,
            $certificate,
            OPENSSL_ALGO_SHA256
        );

        if ($verified !== 1) {
            throw new RuntimeException('Assinatura do Google invalida.');
        }

        $clientId = $this->resolveGoogleClientId();
        $audience = $payload['aud'] ?? '';
        $audiences = is_array($audience) ? $audience : [$audience];
        if (!in_array($clientId, $audiences, true)) {
            throw new RuntimeException('Credencial do Google emitida para outro aplicativo.');
        }

        $issuer = (string) ($payload['iss'] ?? '');
        if (!in_array($issuer, ['accounts.google.com', 'https://accounts.google.com'], true)) {
            throw new RuntimeException('Emissor do Google invalido.');
        }

        $now = time();
        if ((int) ($payload['exp'] ?? 0) < ($now - 60)) {
            throw new RuntimeException('Credencial do Google expirada.');
        }

        if ((int) ($payload['iat'] ?? 0) > ($now + 300)) {
            throw new RuntimeException('Credencial do Google ainda nao e valida.');
        }

        return $payload;
    }

    private function resolveGoogleClientId(): string
    {
        $clientId = trim((string) (getenv('GOOGLE_CLIENT_ID') ?: getenv('GOOGLE_OAUTH_CLIENT_ID') ?: ''));

        if ($clientId === '') {
            $clientId = $this->resolveGoogleClientIdFromSettings();
        }

        if ($clientId === '') {
            throw new RuntimeException('Login com Google nao configurado.');
        }

        if (!$this->isValidGoogleClientId($clientId)) {
            throw new RuntimeException('Login com Google nao configurado corretamente.');
        }

        return $clientId;
    }

    private function isValidGoogleClientId(string $clientId): bool
    {
        return preg_match('/^[0-9]+-[a-z0-9_-]+\.apps\.googleusercontent\.com$/i', trim($clientId)) === 1;
    }

    private function resolveGoogleClientIdFromSettings(): string
    {
        try {
            $stmt = $this->repository->getConnection()->prepare(
                "SELECT value_json FROM system_settings WHERE key_name IN ('googleAuthClientId', 'googleClientId') ORDER BY FIELD(key_name, 'googleAuthClientId', 'googleClientId') LIMIT 1"
            );
            $stmt->execute();
            $rawValue = $stmt->fetchColumn();
            if (!is_string($rawValue) || trim($rawValue) === '') {
                return '';
            }

            $decoded = json_decode($rawValue, true);
            if (json_last_error() === JSON_ERROR_NONE) {
                return trim((string) $decoded);
            }

            return trim($rawValue, "\" \t\n\r\0\x0B");
        } catch (Throwable $e) {
            error_log('[auth_google_settings] ' . $e->getMessage());
            return '';
        }
    }

    private function resolveFacebookAppId(): string
    {
        $appId = trim((string) (getenv('FACEBOOK_APP_ID') ?: getenv('META_APP_ID') ?: ''));
        if ($appId === '') {
            $appId = $this->resolveScalarSettingValue(['facebookAuthAppId', 'facebook_app_id']);
        }

        if ($appId === '') {
            throw new RuntimeException('Login com Facebook nao configurado.');
        }

        return $appId;
    }

    private function resolveFacebookAppSecret(): string
    {
        $appSecret = trim((string) (getenv('FACEBOOK_APP_SECRET') ?: getenv('META_APP_SECRET') ?: ''));
        if ($appSecret === '') {
            $appSecret = $this->resolveScalarSettingValue(['facebookAuthAppSecret', 'facebook_app_secret']);
        }

        if ($appSecret === '') {
            throw new RuntimeException('Login com Facebook nao configurado corretamente.');
        }

        return $appSecret;
    }

    private function resolveAppleClientId(): string
    {
        $clientId = trim((string) (getenv('APPLE_CLIENT_ID') ?: getenv('APPLE_SERVICE_ID') ?: ''));
        if ($clientId === '') {
            $clientId = $this->resolveScalarSettingValue(['appleAuthClientId', 'apple_client_id']);
        }

        if ($clientId === '') {
            throw new RuntimeException('Login com Apple nao configurado.');
        }

        return $clientId;
    }

    private function resolveScalarSettingValue(array $keys): string
    {
        $sanitizedKeys = array_values(array_filter($keys, static function ($key): bool {
            return is_string($key) && preg_match('/^[a-z0-9_]+$/i', $key) === 1;
        }));
        if ($sanitizedKeys === []) {
            return '';
        }

        $quotedKeys = array_map(static fn(string $key): string => "'" . $key . "'", $sanitizedKeys);
        $sql = 'SELECT key_name, value_json FROM system_settings WHERE key_name IN (' . implode(', ', $quotedKeys) . ')';

        try {
            $rows = $this->repository->getConnection()->query($sql)->fetchAll(PDO::FETCH_ASSOC) ?: [];
        } catch (Throwable $e) {
            error_log('[auth_settings_scalar] ' . $e->getMessage());
            return '';
        }

        $priority = array_flip($sanitizedKeys);
        usort($rows, static function (array $left, array $right) use ($priority): int {
            $leftIndex = $priority[(string) ($left['key_name'] ?? '')] ?? PHP_INT_MAX;
            $rightIndex = $priority[(string) ($right['key_name'] ?? '')] ?? PHP_INT_MAX;
            return $leftIndex <=> $rightIndex;
        });

        foreach ($rows as $row) {
            $rawValue = (string) ($row['value_json'] ?? '');
            if (trim($rawValue) === '') {
                continue;
            }

            $decoded = json_decode($rawValue, true);
            if (json_last_error() === JSON_ERROR_NONE && (is_string($decoded) || is_numeric($decoded))) {
                $value = trim((string) $decoded);
                if ($value !== '') {
                    return $value;
                }
            }

            $fallback = trim($rawValue, "\" \t\n\r\0\x0B");
            if ($fallback !== '') {
                return $fallback;
            }
        }

        return '';
    }

    private function resolveGoogleCertificate(string $kid): string
    {
        $certificates = $this->loadGoogleCertificates();
        if (empty($certificates[$kid]) || !is_string($certificates[$kid])) {
            throw new RuntimeException('Certificado do Google nao encontrado.');
        }

        return $certificates[$kid];
    }

    private function loadGoogleCertificates(): array
    {
        $cachePath = sys_get_temp_dir() . DIRECTORY_SEPARATOR . 'concursomestre_google_certs.json';
        $cached = $this->readGoogleCertificatesCache($cachePath);

        if (!empty($cached)) {
            return $cached;
        }

        $context = stream_context_create([
            'http' => [
                'timeout' => 5,
            ],
        ]);
        $json = @file_get_contents('https://www.googleapis.com/oauth2/v1/certs', false, $context);
        $certificates = is_string($json) ? json_decode($json, true) : null;

        if (!is_array($certificates) || empty($certificates)) {
            throw new RuntimeException('Nao foi possivel validar o Google no momento.');
        }

        @file_put_contents($cachePath, json_encode([
            'expiresAt' => time() + 3600,
            'certificates' => $certificates,
        ], JSON_UNESCAPED_SLASHES));

        return $certificates;
    }

    private function resolveApplePublicKeyPem(string $kid): string
    {
        $keys = $this->loadApplePublicKeys();
        foreach ($keys as $key) {
            if (!is_array($key)) {
                continue;
            }

            if ((string) ($key['kid'] ?? '') !== $kid) {
                continue;
            }

            return $this->convertAppleJwkToPem($key);
        }

        throw new RuntimeException('Chave publica da Apple nao encontrada.');
    }

    private function loadApplePublicKeys(): array
    {
        $cachePath = sys_get_temp_dir() . DIRECTORY_SEPARATOR . 'concursomestre_apple_keys.json';
        $cached = $this->readGoogleCertificatesCache($cachePath);
        if (!empty($cached['keys']) && is_array($cached['keys'])) {
            return $cached['keys'];
        }

        $payload = $this->loadJsonFromUrl(
            'https://appleid.apple.com/auth/keys',
            'Nao foi possivel validar a Apple no momento.'
        );
        $keys = is_array($payload['keys'] ?? null) ? $payload['keys'] : [];
        if ($keys === []) {
            throw new RuntimeException('Nao foi possivel validar a Apple no momento.');
        }

        @file_put_contents($cachePath, json_encode([
            'expiresAt' => time() + 3600,
            'certificates' => [
                'keys' => $keys,
            ],
        ], JSON_UNESCAPED_SLASHES));

        return $keys;
    }

    private function convertAppleJwkToPem(array $jwk): string
    {
        if (($jwk['kty'] ?? '') !== 'RSA' || empty($jwk['n']) || empty($jwk['e'])) {
            throw new RuntimeException('Chave da Apple invalida.');
        }

        $modulus = $this->base64UrlDecodeSafe((string) $jwk['n'], 'Chave da Apple invalida.');
        $exponent = $this->base64UrlDecodeSafe((string) $jwk['e'], 'Chave da Apple invalida.');

        $rsaPublicKey = $this->asn1EncodeSequence(
            $this->asn1EncodeInteger($modulus) .
            $this->asn1EncodeInteger($exponent)
        );
        $algorithmIdentifier = hex2bin('300d06092a864886f70d0101010500');
        $subjectPublicKeyInfo = $this->asn1EncodeSequence(
            $algorithmIdentifier .
            "\x03" . $this->asn1EncodeLength(strlen($rsaPublicKey) + 1) . "\x00" . $rsaPublicKey
        );

        return "-----BEGIN PUBLIC KEY-----\n"
            . chunk_split(base64_encode($subjectPublicKeyInfo), 64, "\n")
            . "-----END PUBLIC KEY-----\n";
    }

    private function asn1EncodeInteger(string $value): string
    {
        $cleanValue = ltrim($value, "\x00");
        if ($cleanValue === '') {
            $cleanValue = "\x00";
        }

        if ((ord($cleanValue[0]) & 0x80) !== 0) {
            $cleanValue = "\x00" . $cleanValue;
        }

        return "\x02" . $this->asn1EncodeLength(strlen($cleanValue)) . $cleanValue;
    }

    private function asn1EncodeSequence(string $value): string
    {
        return "\x30" . $this->asn1EncodeLength(strlen($value)) . $value;
    }

    private function asn1EncodeLength(int $length): string
    {
        if ($length < 0x80) {
            return chr($length);
        }

        $encoded = '';
        $remaining = $length;
        while ($remaining > 0) {
            $encoded = chr($remaining & 0xFF) . $encoded;
            $remaining >>= 8;
        }

        return chr(0x80 | strlen($encoded)) . $encoded;
    }

    private function loadJsonFromUrl(string $url, string $errorMessage): array
    {
        $context = stream_context_create([
            'http' => [
                'timeout' => 8,
                'ignore_errors' => true,
                'header' => "Accept: application/json\r\n",
            ],
        ]);

        $json = @file_get_contents($url, false, $context);
        $decoded = is_string($json) ? json_decode($json, true) : null;
        if (!is_array($decoded)) {
            throw new RuntimeException($errorMessage);
        }

        return $decoded;
    }

    private function readGoogleCertificatesCache(string $cachePath): array
    {
        if (!is_file($cachePath)) {
            return [];
        }

        $payload = json_decode((string) @file_get_contents($cachePath), true);
        if (!is_array($payload) || (int) ($payload['expiresAt'] ?? 0) <= time()) {
            return [];
        }

        return is_array($payload['certificates'] ?? null) ? $payload['certificates'] : [];
    }

    private function base64UrlDecode(string $value): string
    {
        return $this->base64UrlDecodeSafe($value, 'Credencial do Google malformada.');
    }

    private function base64UrlDecodeSafe(string $value, string $errorMessage): string
    {
        $padded = strtr($value, '-_', '+/');
        $padding = strlen($padded) % 4;
        if ($padding > 0) {
            $padded .= str_repeat('=', 4 - $padding);
        }

        $decoded = base64_decode($padded, true);
        if (!is_string($decoded)) {
            throw new InvalidArgumentException($errorMessage);
        }

        return $decoded;
    }

    /**
     * Reaproveita o snapshot oficial de perfil do dominio users para login/cadastro.
     *
     * @since 1.0.0
     */
    private function buildAuthenticatedSessionPayload(string $userId): array
    {
        $db = $this->repository->getConnection();
        if (function_exists('ensurePaymentProviderSchema')) {
            ensurePaymentProviderSchema($db);
        }

        $usersService = new UsersService(
            new UsersRepository($db),
            new UsersValidator()
        );

        return $usersService->getAuthenticatedSession($userId);
    }

    /**
     * Impede novas sessoes para contas que ja solicitaram exclusao ou foram
     * encerradas. O estado de exclusao continua separado do status operacional
     * para preservar o fluxo de retencao/anonymizacao decidido posteriormente.
     *
     * @since 1.0.0
     */
    private function assertUserCanAuthenticate(array $user, string $message = 'Invalid email or password'): void
    {
        $status = strtolower(trim((string) ($user['status'] ?? '')));
        if (!empty($user['deletion_requested_at']) || in_array($status, ['deleted', 'pending_deletion'], true)) {
            throw new RuntimeException($message);
        }
    }

    /**
     * Define se o login precisa ser interrompido para 2FA.
     *
     * @since 1.0.0
     */
    private function shouldRequireTwoFactor(array $user): bool
    {
        if (($user['role'] ?? '') !== 'admin' || empty($user['two_factor_enabled'])) {
            return false;
        }

        $appMode = getSystemSettingValue($this->repository->getConnection(), 'appMode', $this->resolveDefaultAppMode());
        return $appMode !== 'development';
    }

    /**
     * Resolve o modo padrao em ambientes locais.
     *
     * @since 1.0.0
     */
    private function resolveDefaultAppMode(): string
    {
        $host = (string) ($_SERVER['HTTP_HOST'] ?? '');
        return (strpos($host, 'localhost') !== false || strpos($host, '127.0.0.1') !== false)
            ? 'development'
            : 'production';
    }

    /**
     * Dispara o e-mail de confirmacao apos o cadastro.
     *
     * @since 1.0.0
     */
    private function sendVerificationEmail(string $email, string $name, string $token): array
    {
        $confirmUrl = $this->resolveAppUrl() . '/confirm-email?token=' . urlencode($token);
        $defaultHtml = Mailer::htmlTemplate(
            'Confirme seu E-mail',
            "<p>Ola, <strong>{$name}</strong>!</p>
             <p>Falta pouco para voce comecar seus estudos no <strong>ConcursoMestre</strong>.</p>
             <p>Confirme seu endereco de e-mail para ativar a conta e ganhar <strong>50 XP</strong> de bonus.</p>",
            $confirmUrl,
            'Confirmar meu E-mail'
        );

        $defaultText = "Ola {$name},\n\nAcesse o link para confirmar sua conta:\n{$confirmUrl}\n\nVoce ganhara 50 XP apos confirmar.";
        $template = $this->resolveEmailTemplate(
            'auth_email_confirmation',
            [
                'subject' => 'Confirme sua conta - ConcursoMestre',
                'htmlBody' => $defaultHtml,
                'textBody' => $defaultText,
            ],
            [
                'name' => $name,
                'email' => $email,
                'confirm_url' => $confirmUrl,
                'xp_bonus' => '50',
                'app_url' => $this->resolveAppUrl(),
            ]
        );

        if (!$template['enabled']) {
            return [
                'status' => 'disabled',
                'message' => 'Template de confirmacao de e-mail desativado.',
            ];
        }

        try {
            Mailer::send($email, $name, $template['subject'], $template['htmlBody'], $template['textBody']);

            return [
                'status' => 'sent',
                'message' => 'E-mail de confirmacao enviado.',
            ];
        } catch (Throwable $e) {
            error_log('Register mailer error: ' . $e->getMessage());

            return [
                'status' => 'failed',
                'message' => 'Conta criada, mas nao foi possivel enviar o e-mail de confirmacao agora.',
                'reason' => $e->getMessage(),
            ];
        }
    }

    /**
     * Dispara o e-mail de boas-vindas sem deixar falha de SMTP reverter a confirmacao.
     *
     * @since 1.0.0
     */
    private function sendWelcomeEmail(string $email, string $name): void
    {
        $appUrl = $this->resolveAppUrl();
        $loginUrl = $appUrl . '/auth';

        $defaultHtml = Mailer::htmlTemplate(
            'Conta ativada com sucesso!',
            "<p>Ola <strong>{$name}</strong>, bem-vindo(a) ao <strong>ConcursoMestre</strong>!</p>
             <p>Seu e-mail foi verificado e sua conta recebeu <strong>+50 XP</strong> de boas-vindas.</p>
             <p>Agora voce ja pode resolver questoes, fazer simulados e acompanhar seu desempenho.</p>",
            $loginUrl,
            'Comecar a estudar'
        );

        $defaultText = "Bem-vindo ao ConcursoMestre, {$name}!\n\nSeu e-mail foi verificado com sucesso e voce ganhou 50 XP.\n\nAcesse a plataforma: {$loginUrl}";
        $template = $this->resolveEmailTemplate(
            'auth_welcome',
            [
                'subject' => 'Bem-vindo ao ConcursoMestre',
                'htmlBody' => $defaultHtml,
                'textBody' => $defaultText,
            ],
            [
                'name' => $name,
                'email' => $email,
                'login_url' => $loginUrl,
                'app_url' => $appUrl,
                'xp_bonus' => '50',
            ]
        );

        try {
            if ($template['enabled']) {
                Mailer::send($email, $name, $template['subject'], $template['htmlBody'], $template['textBody']);
            }
        } catch (Throwable $e) {
            error_log('Welcome mailer error: ' . $e->getMessage());
        }
    }

    /**
     * Resolve o template de e-mail (subject/html/text) com fallback padrao.
     * Os modelos sao carregados de `system_settings.emailTemplates`.
     *
     * @since 1.0.0
     */
    private function resolveEmailTemplate(string $templateKey, array $defaults, array $variables = []): array
    {
        return resolveSystemEmailTemplate(
            $templateKey,
            $defaults,
            $variables,
            $this->repository->getConnection()
        );
    }

    /**
     * Gera identificador para notificacoes sem depender de helper legado de rota.
     *
     * @since 1.0.0
     */
    private function createUuid(): string
    {
        return sprintf(
            '%04x%04x-%04x-%04x-%04x-%04x%04x%04x',
            mt_rand(0, 0xffff),
            mt_rand(0, 0xffff),
            mt_rand(0, 0xffff),
            mt_rand(0, 0x0fff) | 0x4000,
            mt_rand(0, 0x3fff) | 0x8000,
            mt_rand(0, 0xffff),
            mt_rand(0, 0xffff),
            mt_rand(0, 0xffff)
        );
    }
}
