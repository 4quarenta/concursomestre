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

require_once __DIR__ . '/controllers/AuthController.php';
require_once __DIR__ . '/services/AuthService.php';
require_once __DIR__ . '/repositories/AuthRepository.php';
require_once __DIR__ . '/validators/AuthValidator.php';
require_once __DIR__ . '/../../shared/auth/request_auth.php';
require_once __DIR__ . '/../../shared/auth/AuthSession.php';
require_once __DIR__ . '/../../shared/responses/Response.php';
require_once __DIR__ . '/../../shared/security/Recaptcha.php';
require_once __DIR__ . '/../../shared/security/IpBanGuard.php';
require_once __DIR__ . '/../../shared/middleware/RateLimiter.php';
require_once __DIR__ . '/../../shared/http/Request.php';

/**
 * Le o body JSON do modulo auth sem espalhar parsing manual nas rotas.
 *
 * @since 1.0.0
 */
function readAuthJsonRequestBody(): array
{
    return Request::json();
}

/**
 * Impede que endpoints de autenticacao aceitem verbos fora do contrato.
 */
function requireAuthRequestMethod(string $expected): void
{
    $actual = strtoupper((string) ($_SERVER['REQUEST_METHOD'] ?? 'GET'));
    if ($actual !== strtoupper($expected)) {
        Response::error('Metodo nao permitido.', 405, null, 'method_not_allowed');
    }
}

/**
 * Negocia o transporte nativo sem alterar a protecao cookie + CSRF do web.
 * O header seleciona o contrato; ele nao concede autenticacao ou privilegio.
 */
function isNativeMobileAuthRequest(): bool
{
    $platform = strtolower(trim((string) ($_SERVER['HTTP_X_CLIENT_PLATFORM'] ?? '')));
    if ($platform !== 'concursomestre-mobile') {
        return false;
    }

    // O contrato nativo nao deve ser usado por JavaScript executando em uma
    // origem de navegador. Browsers continuam obrigatoriamente em cookie+CSRF.
    return trim((string) ($_SERVER['HTTP_ORIGIN'] ?? '')) === '';
}

/**
 * Valida as credenciais opacas usadas no refresh/logout do cliente nativo.
 */
function readNativeMobileAuthCredentials(array $payload): array
{
    $refreshToken = trim((string) ($payload['refreshToken'] ?? ''));
    $csrfToken = trim((string) ($payload['csrfToken'] ?? ''));

    foreach (['refreshToken' => $refreshToken, 'csrfToken' => $csrfToken] as $field => $value) {
        $length = strlen($value);
        if ($length < 24 || $length > 512 || preg_match('/[\x00-\x20\x7f]/', $value)) {
            throw new InvalidArgumentException("{$field} invalido.");
        }
    }

    return [
        'refreshToken' => $refreshToken,
        'csrfToken' => $csrfToken,
    ];
}

/**
 * Aplica politica de bloqueio por IP antes de processar fluxos de autenticacao.
 *
 * @since 1.0.0
 */
function enforceAuthIpSecurityPolicy(PDO $db): void
{
    ensureAuthTables($db);
    try {
        enforceSecurityIpBanOrFail($db);
    } catch (SecurityIpBannedException) {
        Response::forbidden('IP bloqueado por seguranca. Contate o suporte.');
    }
}

/**
 * Cria o controller do modulo auth com o wiring oficial da fatia.
 *
 * @since 1.0.0
 */
function makeAuthController(PDO $db): AuthController
{
    return new AuthController(
        new AuthService(
            new AuthRepository($db),
            new AuthValidator()
        )
    );
}

/**
 * Ponto de entrada oficial para login por e-mail e senha.
 *
 * @since 1.0.0
 */
function handleAuthLoginRoute(PDO $db): void
{
    try {
        requireAuthRequestMethod('POST');
        enforceAuthIpSecurityPolicy($db);
        $payload = readAuthJsonRequestBody();
        $validator = new AuthValidator();
        $normalizedPayload = $validator->validateLoginPayload($payload);
        RateLimiter::enforceProfile('auth_login');
        RateLimiter::enforceProfile('auth_login_subject', strtolower((string) ($normalizedPayload['email'] ?? '')));
        ensureRecaptchaPassed($db, $normalizedPayload['captchaToken'], [
            'action' => 'auth_login',
        ]);

        $controller = makeAuthController($db);
        $result = $controller->login($payload, isNativeMobileAuthRequest());
        Response::success($result, !empty($result['require2FA']) ? '2FA verification required' : 'Login successful');
    } catch (InvalidArgumentException $e) {
        Response::validationError($e->getMessage());
    } catch (PDOException $e) {
        Response::serverError('Login failed', $e);
    } catch (RuntimeException $e) {
        if (str_contains($e->getMessage(), 'reCAPTCHA')) {
            Response::validationError($e->getMessage());
        }
        Response::unauthorized($e->getMessage());
    } catch (Throwable $e) {
        Response::serverError('Login failed', $e);
    }
}

/**
 * Confirma somente se a sessão de refresh atual pode acessar o shell admin.
 * É consumida pelo proxy do Next e falha como 404 para não revelar dados,
 * permissões ou a própria existência do painel a membros comuns.
 */
function handleAuthAdminRouteAccessRoute(PDO $db): void
{
    $notFound = static function (): never {
        Response::notFound('Recurso nao encontrado.');
    };

    try {
        if (strtoupper((string) ($_SERVER['REQUEST_METHOD'] ?? 'GET')) !== 'GET') {
            $notFound();
        }
        if (trim((string) ($_SERVER['HTTP_X_CONCURSOMESTRE_ADMIN_ROUTE_CHECK'] ?? '')) !== '1') {
            $notFound();
        }

        $refreshToken = getRefreshTokenFromCookie();
        if ($refreshToken === null) {
            $notFound();
        }

        $record = findRefreshTokenRecord($db, $refreshToken);
        if ($record === null
            || !empty($record['revoked_at'])
            || (string) ($record['status'] ?? '') !== 'active'
            || (string) ($record['session_status'] ?? '') !== 'active'
            || !empty($record['session_revoked_at'])
            || !empty($record['deletion_requested_at'])
            || in_array(strtolower((string) ($record['user_status'] ?? '')), ['deleted', 'pending_deletion'], true)
            || (!empty($record['expires_at']) && strtotime((string) $record['expires_at']) < time())
            || (!empty($record['session_expires_at']) && strtotime((string) $record['session_expires_at']) < time())
        ) {
            $notFound();
        }

        $userId = trim((string) ($record['user_id'] ?? ''));
        if ($userId === '') {
            $notFound();
        }

        $statement = $db->prepare('SELECT role FROM users WHERE id = :id LIMIT 1');
        $statement->execute([':id' => $userId]);
        $role = strtolower(trim((string) $statement->fetchColumn()));
        if (!in_array($role, ['admin', 'staff'], true)) {
            $notFound();
        }

        header('Cache-Control: no-store, private');
        http_response_code(204);
        exit();
    } catch (Throwable) {
        $notFound();
    }
}

/**
 * Confirma se o refresh cookie atual pertence a uma sessao autenticada ativa.
 * Usado pelo servidor Next para resolver a home antes de entregar qualquer HTML.
 * A resposta nao expoe perfil, token ou papel: somente 204 ou 404.
 */
function handleAuthSessionRouteAccessRoute(PDO $db): void
{
    $notFound = static function (): never {
        Response::notFound('Recurso nao encontrado.');
    };

    try {
        if (strtoupper((string) ($_SERVER['REQUEST_METHOD'] ?? 'GET')) !== 'GET') {
            $notFound();
        }
        if (trim((string) ($_SERVER['HTTP_X_CONCURSOMESTRE_SESSION_ROUTE_CHECK'] ?? '')) !== '1') {
            $notFound();
        }

        $refreshToken = getRefreshTokenFromCookie();
        if ($refreshToken === null) {
            $notFound();
        }

        $record = findRefreshTokenRecord($db, $refreshToken);
        if ($record === null
            || !empty($record['revoked_at'])
            || (string) ($record['status'] ?? '') !== 'active'
            || (string) ($record['session_status'] ?? '') !== 'active'
            || !empty($record['session_revoked_at'])
            || (!empty($record['expires_at']) && strtotime((string) $record['expires_at']) < time())
            || (!empty($record['session_expires_at']) && strtotime((string) $record['session_expires_at']) < time())
            || trim((string) ($record['user_id'] ?? '')) === ''
        ) {
            $notFound();
        }

        header('Cache-Control: no-store, private');
        http_response_code(204);
        exit();
    } catch (Throwable) {
        $notFound();
    }
}

/**
 * Ponto de entrada oficial para cadastro de nova conta.
 *
 * @since 1.0.0
 */
function handleAuthRegisterRoute(PDO $db): void
{
    try {
        requireAuthRequestMethod('POST');
        enforceAuthIpSecurityPolicy($db);
        $payload = readAuthJsonRequestBody();
        $validator = new AuthValidator();
        $normalizedPayload = $validator->validateRegisterPayload($payload);
        RateLimiter::enforceProfile('auth_register');
        RateLimiter::enforceProfile('auth_register_subject', strtolower((string) ($normalizedPayload['email'] ?? '')));
        ensureRecaptchaPassed($db, $normalizedPayload['captchaToken'], [
            'action' => 'auth_register',
        ]);

        $controller = makeAuthController($db);
        $result = $controller->register($payload, isNativeMobileAuthRequest());
        $emailDeliveryStatus = (string) ($result['emailDelivery']['status'] ?? 'sent');
        $message = $emailDeliveryStatus === 'sent'
            ? 'Cadastro realizado com sucesso! Verifique seu e-mail para confirmar a conta.'
            : 'Cadastro realizado, mas o e-mail de confirmacao ainda nao foi enviado. Tente reenviar em instantes.';
        Response::success($result, $message);
    } catch (DomainException $e) {
        Response::error($e->getMessage(), 409, null, 'conflict');
    } catch (InvalidArgumentException $e) {
        Response::validationError($e->getMessage());
    } catch (RuntimeException $e) {
        if (str_contains($e->getMessage(), 'reCAPTCHA')) {
            Response::validationError($e->getMessage());
        }
        Response::unauthorized($e->getMessage());
    } catch (Throwable $e) {
        Response::serverError('Erro ao criar conta.', $e);
    }
}

/**
 * Ponto de entrada oficial para login/cadastro com Google.
 *
 * @since 1.0.0
 */
function handleAuthGoogleRoute(PDO $db): void
{
    try {
        requireAuthRequestMethod('POST');
        enforceAuthIpSecurityPolicy($db);
        RateLimiter::enforceProfile('auth_login', 'google');
        $payload = readAuthJsonRequestBody();
        if (!empty($payload['linkCurrentUser'])) {
            $authenticatedUser = verifyAuthenticatedUserPayload();
            $payload['linkUserId'] = trim((string) ($authenticatedUser['user_id'] ?? ''));
        }
        $controller = makeAuthController($db);
        $result = $controller->googleLogin($payload);
        $message = !empty($result['linkedProvider'])
            ? 'Conta Google conectada ao perfil.'
            : (!empty($result['isNewUser']) ? 'Conta criada com Google.' : 'Login com Google realizado.');
        Response::success($result, $message);
    } catch (DomainException $e) {
        Response::error($e->getMessage(), 409, null, 'conflict');
    } catch (InvalidArgumentException $e) {
        Response::validationError($e->getMessage());
    } catch (OutOfBoundsException $e) {
        Response::notFound($e->getMessage());
    } catch (RuntimeException $e) {
        Response::unauthorized($e->getMessage());
    } catch (Throwable $e) {
        Response::serverError('Login com Google falhou.', $e);
    }
}

/**
 * Ponto de entrada oficial para login/cadastro com Facebook.
 *
 * @since 1.0.0
 */
function handleAuthFacebookRoute(PDO $db): void
{
    try {
        requireAuthRequestMethod('POST');
        enforceAuthIpSecurityPolicy($db);
        RateLimiter::enforceProfile('auth_login', 'facebook');
        $payload = readAuthJsonRequestBody();
        if (!empty($payload['linkCurrentUser'])) {
            $authenticatedUser = verifyAuthenticatedUserPayload();
            $payload['linkUserId'] = trim((string) ($authenticatedUser['user_id'] ?? ''));
        }
        $controller = makeAuthController($db);
        $result = $controller->facebookLogin($payload);
        $message = !empty($result['linkedProvider'])
            ? 'Conta Facebook conectada ao perfil.'
            : (!empty($result['isNewUser']) ? 'Conta criada com Facebook.' : 'Login com Facebook realizado.');
        Response::success($result, $message);
    } catch (DomainException $e) {
        Response::error($e->getMessage(), 409, null, 'conflict');
    } catch (InvalidArgumentException $e) {
        Response::validationError($e->getMessage());
    } catch (OutOfBoundsException $e) {
        Response::notFound($e->getMessage());
    } catch (RuntimeException $e) {
        Response::unauthorized($e->getMessage());
    } catch (Throwable $e) {
        Response::serverError('Login com Facebook falhou.', $e);
    }
}

/**
 * Ponto de entrada oficial para login/cadastro com Apple.
 *
 * @since 1.0.0
 */
function handleAuthAppleRoute(PDO $db): void
{
    try {
        requireAuthRequestMethod('POST');
        enforceAuthIpSecurityPolicy($db);
        RateLimiter::enforceProfile('auth_login', 'apple');
        $payload = readAuthJsonRequestBody();
        $controller = makeAuthController($db);
        $result = $controller->appleLogin($payload);
        Response::success($result, !empty($result['isNewUser']) ? 'Conta criada com Apple.' : 'Login com Apple realizado.');
    } catch (DomainException $e) {
        Response::error($e->getMessage(), 409, null, 'conflict');
    } catch (InvalidArgumentException $e) {
        Response::validationError($e->getMessage());
    } catch (OutOfBoundsException $e) {
        Response::notFound($e->getMessage());
    } catch (RuntimeException $e) {
        Response::unauthorized($e->getMessage());
    } catch (Throwable $e) {
        Response::serverError('Login com Apple falhou.', $e);
    }
}

/**
 * Ponto de entrada oficial para logout da sessao corrente.
 *
 * @since 1.0.0
 */
function handleAuthLogoutRoute(PDO $db): void
{
    try {
        requireAuthRequestMethod('POST');

        enforceAuthIpSecurityPolicy($db);
        RateLimiter::enforceProfile('auth_refresh');
        $nativeCredentials = null;
        if (isNativeMobileAuthRequest()) {
            $nativeCredentials = readNativeMobileAuthCredentials(readAuthJsonRequestBody());
        }
        $controller = makeAuthController($db);
        $result = $controller->logout($nativeCredentials);
        Response::success($result, 'Logout realizado com sucesso');
    } catch (InvalidArgumentException $e) {
        Response::validationError($e->getMessage());
    } catch (RuntimeException $e) {
        clearAuthCookies();
        Response::unauthorized($e->getMessage());
    } catch (Throwable $e) {
        clearAuthCookies();
        Response::serverError('Nao foi possivel finalizar a sessao', $e);
    }
}

/**
 * Ponto de entrada oficial para rotacao de sessao via refresh token.
 *
 * @since 1.0.0
 */
function handleAuthRefreshRoute(PDO $db): void
{
    try {
        requireAuthRequestMethod('POST');
        enforceAuthIpSecurityPolicy($db);
        $payload = readAuthJsonRequestBody();
        $includeUser = !empty($payload['includeUser']);
        $nativeCredentials = isNativeMobileAuthRequest()
            ? readNativeMobileAuthCredentials($payload)
            : null;

        $controller = makeAuthController($db);
        $result = $controller->refreshSession($includeUser, $nativeCredentials);
        Response::success($result, 'Sessao renovada com sucesso');
    } catch (InvalidArgumentException $e) {
        Response::validationError($e->getMessage());
    } catch (RuntimeException $e) {
        clearAuthCookies();
        Response::unauthorized($e->getMessage());
    } catch (Throwable $e) {
        Response::serverError('Erro ao renovar sessao', $e);
    }
}

/**
 * Ponto de entrada oficial para o fluxo de esqueci minha senha.
 *
 * @since 1.0.0
 */
function handleAuthForgotPasswordRoute(PDO $db): void
{
    try {
        requireAuthRequestMethod('POST');
        enforceAuthIpSecurityPolicy($db);
        $payload = readAuthJsonRequestBody();
        $validator = new AuthValidator();
        $normalizedPayload = $validator->validateForgotPasswordPayload($payload);
        RateLimiter::enforceProfile('auth_password');
        RateLimiter::enforceProfile('auth_password', strtolower((string) ($normalizedPayload['email'] ?? '')));
        ensureRecaptchaPassed($db, $normalizedPayload['captchaToken'], [
            'action' => 'auth_forgot_password',
        ]);

        $controller = makeAuthController($db);
        $result = $controller->requestPasswordReset($payload);
        Response::success([], $result['message'] ?? 'Se este e-mail estiver cadastrado, voce recebera as instrucoes em breve.');
    } catch (InvalidArgumentException $e) {
        Response::validationError($e->getMessage());
    } catch (OutOfBoundsException $e) {
        Response::notFound($e->getMessage());
    } catch (RuntimeException $e) {
        if (str_contains($e->getMessage(), 'reCAPTCHA')) {
            Response::validationError($e->getMessage());
        }
        Response::unauthorized($e->getMessage());
    } catch (Throwable $e) {
        Response::serverError('Erro ao processar solicitacao.', $e);
    }
}

/**
 * Ponto de entrada oficial para redefinicao de senha usando token de e-mail.
 *
 * @since 1.0.0
 */
function handleAuthResetPasswordRoute(PDO $db): void
{
    try {
        requireAuthRequestMethod('POST');
        enforceAuthIpSecurityPolicy($db);
        RateLimiter::enforceProfile('auth_password');
        $payload = readAuthJsonRequestBody();
        $validator = new AuthValidator();
        $normalizedPayload = $validator->validateResetPasswordPayload($payload);
        ensureRecaptchaPassed($db, $normalizedPayload['captchaToken'], [
            'action' => 'auth_reset_password',
        ]);
        $controller = makeAuthController($db);
        $result = $controller->resetPassword($payload);
        Response::success([], $result['message'] ?? 'Senha alterada com sucesso!');
    } catch (InvalidArgumentException $e) {
        Response::validationError($e->getMessage());
    } catch (RuntimeException $e) {
        if (str_contains($e->getMessage(), 'reCAPTCHA')) {
            Response::validationError($e->getMessage());
        }

        Response::unauthorized($e->getMessage());
    } catch (Throwable $e) {
        Response::serverError('Erro ao redefinir senha.', $e);
    }
}

/**
 * Ponto de entrada oficial para reenviar o e-mail de confirmacao.
 *
 * @since 1.0.0
 */
function handleAuthResendConfirmationRoute(PDO $db): void
{
    try {
        requireAuthRequestMethod('POST');
        enforceAuthIpSecurityPolicy($db);
        RateLimiter::enforceProfile('auth_password');
        $authenticatedPayload = verifyAuthenticatedUserPayload();
        $controller = makeAuthController($db);
        $result = $controller->resendConfirmation($authenticatedPayload, readAuthJsonRequestBody());
        Response::success([], $result['message'] ?? 'E-mail de confirmacao reenviado com sucesso!');
    } catch (DomainException $e) {
        Response::forbidden($e->getMessage());
    } catch (InvalidArgumentException $e) {
        Response::badRequest($e->getMessage());
    } catch (OutOfBoundsException $e) {
        Response::notFound($e->getMessage());
    } catch (RuntimeException $e) {
        Response::unauthorized($e->getMessage());
    } catch (Throwable $e) {
        Response::serverError('Erro interno do servidor ao reenviar e-mail.', $e);
    }
}

/**
 * Ponto de entrada oficial para confirmar o e-mail pelo token.
 *
 * @since 1.0.0
 */
function handleAuthConfirmEmailRoute(PDO $db): void
{
    try {
        requireAuthRequestMethod('POST');
        enforceAuthIpSecurityPolicy($db);
        RateLimiter::enforceProfile('auth_password');
        $controller = makeAuthController($db);
        $result = $controller->confirmEmail(readAuthJsonRequestBody());
        Response::success(['newXp' => $result['newXp'] ?? 0], $result['message'] ?? 'E-mail verificado com sucesso!');
    } catch (OutOfBoundsException $e) {
        Response::notFound($e->getMessage());
    } catch (InvalidArgumentException $e) {
        Response::validationError($e->getMessage());
    } catch (Throwable $e) {
        Response::serverError('Erro ao confirmar e-mail.', $e);
    }
}

/**
 * Ponto de entrada oficial para iniciar o setup de 2FA.
 *
 * @since 1.0.0
 */
function handleAuthSetupTwoFactorRoute(PDO $db): void
{
    try {
        requireAuthRequestMethod('GET');
        enforceAuthIpSecurityPolicy($db);
        $authenticatedPayload = verifyAuthenticatedUserPayload();
        $controller = makeAuthController($db);
        $result = $controller->setupTwoFactor($authenticatedPayload);
        Response::success($result, '2FA Setup initiated');
    } catch (DomainException $e) {
        Response::forbidden($e->getMessage());
    } catch (RuntimeException $e) {
        Response::unauthorized($e->getMessage());
    } catch (Throwable $e) {
        Response::serverError('Failed to setup 2FA', $e);
    }
}

/**
 * Ponto de entrada oficial para ativar o 2FA do admin.
 *
 * @since 1.0.0
 */
function handleAuthEnableTwoFactorRoute(PDO $db): void
{
    try {
        requireAuthRequestMethod('POST');
        enforceAuthIpSecurityPolicy($db);
        $authenticatedPayload = verifyAuthenticatedUserPayload();
        $controller = makeAuthController($db);
        $result = $controller->enableTwoFactor($authenticatedPayload, readAuthJsonRequestBody());
        Response::success(null, $result['message'] ?? '2FA ativado com sucesso!');
    } catch (DomainException $e) {
        Response::forbidden($e->getMessage());
    } catch (InvalidArgumentException $e) {
        Response::validationError($e->getMessage());
    } catch (RuntimeException $e) {
        Response::unauthorized($e->getMessage());
    } catch (Throwable $e) {
        Response::serverError('Failed to enable 2FA', $e);
    }
}

/**
 * Ponto de entrada oficial para validar o codigo 2FA e emitir a sessao final.
 *
 * @since 1.0.0
 */
function handleAuthVerifyTwoFactorRoute(PDO $db): void
{
    try {
        requireAuthRequestMethod('POST');
        enforceAuthIpSecurityPolicy($db);
        RateLimiter::enforceProfile('auth_2fa');
        $controller = makeAuthController($db);
        $result = $controller->verifyTwoFactor(readAuthJsonRequestBody(), isNativeMobileAuthRequest());
        Response::success($result, '2FA Verification successful');
    } catch (InvalidArgumentException $e) {
        Response::validationError($e->getMessage());
    } catch (RuntimeException $e) {
        Response::unauthorized($e->getMessage());
    } catch (Throwable $e) {
        Response::serverError('2FA Verification failed', $e);
    }
}
