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

require_once __DIR__ . '/controllers/UsersController.php';
require_once __DIR__ . '/controllers/UsersCardsController.php';
require_once __DIR__ . '/controllers/UsersRewardsController.php';
require_once __DIR__ . '/services/UsersService.php';
require_once __DIR__ . '/services/UsersCardsService.php';
require_once __DIR__ . '/services/UsersReferralRewardsService.php';
require_once __DIR__ . '/repositories/UsersRepository.php';
require_once __DIR__ . '/validators/UsersValidator.php';
require_once __DIR__ . '/../../config/payment_provider.php';
require_once __DIR__ . '/../../shared/auth/request_auth.php';
require_once __DIR__ . '/../../shared/responses/Response.php';
require_once __DIR__ . '/../../shared/security/Recaptcha.php';
require_once __DIR__ . '/../../shared/middleware/RateLimiter.php';

/**
 * Resolve a URL publica do frontend para compor links de indicacao.
 *
 * @since 1.0.0
 */
function resolveUsersFrontendBaseUrl(): string
{
    $protocol = (isset($_SERVER['HTTPS']) && $_SERVER['HTTPS'] === 'on') ? 'https' : 'http';
    $host = $_SERVER['HTTP_HOST'] ?? 'localhost';

    if (strpos($host, 'localhost') !== false) {
        return 'http://localhost:3000';
    }

    return $protocol . '://' . $host;
}

/**
 * Le o body JSON de rotas do modulo users sem espalhar parsing manual.
 *
 * @since 1.0.0
 */
function readUsersJsonRequestBody(): array
{
    $rawBody = file_get_contents('php://input');
    if (!is_string($rawBody) || trim($rawBody) === '') {
        return [];
    }

    $decoded = json_decode($rawBody, true);
    if (!is_array($decoded)) {
        throw new InvalidArgumentException('Payload JSON invalido.');
    }

    return $decoded;
}

/**
 * Fabrica o controller principal do dominio de usuarios para rotas HTTP.
 *
 * @since 1.0.0
 */
function buildUsersController(PDO $db): UsersController
{
    return new UsersController(
        new UsersService(
            new UsersRepository($db),
            new UsersValidator()
        )
    );
}

/**
 * Fabrica o controller de jobs de recompensa ligados a usuarios.
 *
 * @since 1.0.0
 */
function buildUsersRewardsController(PDO $db): UsersRewardsController
{
    return new UsersRewardsController(
        new UsersReferralRewardsService(
            new UsersRepository($db)
        )
    );
}

/**
 * Segredo compartilhado para jobs legados do dominio de usuarios.
 *
 * @since 1.0.0
 */
function getUsersCronSecret(): string
{
    $secret = $_ENV['CRON_SECRET'] ?? getenv('CRON_SECRET') ?? '';
    return trim((string) $secret);
}

/**
 * Garante que o segredo de cron esteja configurado antes de aceitar bridges HTTP.
 *
 * @since 1.0.0
 */
function requireUsersCronSecret(): string
{
    $secret = getUsersCronSecret();
    if ($secret === '') {
        throw new RuntimeException('CRON_SECRET nao configurado.');
    }

    return $secret;
}

/**
 * Resolve a chave enviada por query string ou header para cron legado.
 *
 * @since 1.0.0
 */
function resolveUsersCronRequestKey(): string
{
    $queryKey = trim((string) ($_GET['key'] ?? ''));
    if ($queryKey !== '') {
        return $queryKey;
    }

    $headerKey = trim((string) ($_SERVER['HTTP_X_CRON_SECRET'] ?? ''));
    return $headerKey;
}

/**
 * Executa o job de recompensas de indicacao sem acoplamento com HTTP.
 *
 * @since 1.0.0
 */
function runUsersReferralRewardsCron(PDO $db, int $graceDays = 7): array
{
    return buildUsersRewardsController($db)->processPendingReferralRewards($graceDays);
}

/**
 * Ponto de entrada do modulo de usurios para estatisticas de indicacao.
 *
 * @since 1.0.0
 */
function handleUsersReferralStatsRoute(PDO $db): void
{
    try {
        $payload = verifyAuthenticatedUserPayload();
        $userId = trim((string) ($payload['user_id'] ?? ''));

        Response::success(
            buildUsersController($db)->getReferralStats($userId, resolveUsersFrontendBaseUrl()),
            'Referral stats retrieved'
        );
    } catch (InvalidArgumentException $e) {
        Response::unauthorized($e->getMessage());
    } catch (RuntimeException $e) {
        Response::unauthorized($e->getMessage());
    } catch (Throwable $e) {
        Response::serverError('Failed to fetch referral stats', $e);
    }
}

/**
 * Ponto de entrada do modulo de usurios para troca de senha do proprio usurio.
 *
 * @since 1.0.0
 */
function handleUsersChangePasswordRoute(PDO $db): void
{
    try {
        $payload = verifyAuthenticatedUserPayload();
        $userId = trim((string) ($payload['user_id'] ?? ''));
        $requestBody = json_decode(file_get_contents('php://input'), true);

        if (!is_array($requestBody)) {
            throw new InvalidArgumentException('Payload invalido para troca de senha.');
        }

        $result = buildUsersController($db)->changePassword($userId, $requestBody);
        Response::success($result, $result['message'] ?? 'Senha alterada com sucesso.');
    } catch (InvalidArgumentException $e) {
        Response::badRequest($e->getMessage());
    } catch (RuntimeException $e) {
        Response::unauthorized($e->getMessage());
    } catch (Throwable $e) {
        Response::serverError('Failed to change password', $e);
    }
}

/**
 * Ponto de entrada do modulo de usurios para upload autenticado da foto de perfil.
 *
 * @since 1.0.0
 */
function handleUsersUploadPhotoRoute(PDO $db): void
{
    try {
        RateLimiter::enforceProfile('upload');
        $payload = verifyAuthenticatedUserPayload();
        $userId = trim((string) ($payload['user_id'] ?? ''));
        $file = $_FILES['photo'] ?? [];

        $result = buildUsersController($db)->uploadProfilePhoto($userId, $file, dirname(__DIR__, 2));
        Response::success($result, $result['message'] ?? 'Foto de perfil atualizada com sucesso.');
    } catch (InvalidArgumentException $e) {
        Response::badRequest($e->getMessage());
    } catch (RuntimeException $e) {
        Response::unauthorized($e->getMessage());
    } catch (Throwable $e) {
        Response::serverError('Failed to upload profile photo', $e);
    }
}

/**
 * Ponto de entrada do modulo de usuarios para remover a foto de perfil autenticada.
 *
 * @since 1.0.0
 */
function handleUsersRemovePhotoRoute(PDO $db): void
{
    try {
        $payload = verifyAuthenticatedUserPayload();
        $userId = trim((string) ($payload['user_id'] ?? ''));

        $result = buildUsersController($db)->removeProfilePhoto($userId, dirname(__DIR__, 2));
        Response::success($result, $result['message'] ?? 'Foto de perfil removida com sucesso.');
    } catch (InvalidArgumentException $e) {
        Response::badRequest($e->getMessage());
    } catch (RuntimeException $e) {
        Response::unauthorized($e->getMessage());
    } catch (Throwable $e) {
        Response::serverError('Failed to remove profile photo', $e);
    }
}

/**
 * Ponto de entrada oficial do snapshot autenticado do usurio.
 * Esta rota sustenta tanto o endpoint moderno de users/profile quanto bridges legadas.
 *
 * @since 1.0.0
 */
function handleUsersAuthenticatedProfileRoute(PDO $db): void
{
    try {
        $payload = verifyAuthenticatedUserPayload();
        $userId = trim((string) ($payload['user_id'] ?? ''));

        $result = buildUsersController($db)->getAuthenticatedProfile($userId);
        Response::success($result, 'User data retrieved');
    } catch (InvalidArgumentException $e) {
        Response::badRequest($e->getMessage());
    } catch (RuntimeException $e) {
        Response::unauthorized($e->getMessage());
    } catch (Throwable $e) {
        Response::serverError('Failed to fetch user data', $e);
    }
}

/**
 * Ponto de entrada para o snapshot minimo de sessao do usuario autenticado.
 *
 * @since 1.0.0
 */
function handleUsersAuthenticatedSessionRoute(PDO $db): void
{
    try {
        $payload = verifyAuthenticatedUserPayload();
        $userId = trim((string) ($payload['user_id'] ?? ''));

        $result = buildUsersController($db)->getAuthenticatedSession($userId);
        Response::success($result, 'Session data retrieved');
    } catch (InvalidArgumentException $e) {
        Response::unauthorized($e->getMessage());
    } catch (RuntimeException $e) {
        Response::unauthorized($e->getMessage());
    } catch (Throwable $e) {
        Response::serverError('Failed to fetch session data', $e);
    }
}

/**
 * Status financeiro mínimo da própria conta. Não aceita identificadores de usuário
 * nem expõe cartão, conta bancária ou dados completos de cobrança.
 */
function handleCurrentUserPaymentStatusRoute(PDO $db): void
{
    try {
        $payload = verifyAuthenticatedUserPayload();
        $userId = trim((string) ($payload['user_id'] ?? ''));
        $result = buildUsersController($db)->getCurrentUserPaymentStatus($userId);
        Response::success($result, 'Payment status retrieved');
    } catch (InvalidArgumentException $e) {
        Response::unauthorized($e->getMessage());
    } catch (RuntimeException $e) {
        Response::unauthorized($e->getMessage());
    } catch (Throwable $e) {
        Response::serverError('Failed to fetch payment status', $e);
    }
}

/**
 * Ponto de entrada oficial para atualizacao do perfil do proprio usurio.
 * A rota aceita apenas campos previstos pelo dominio para evitar escalacao indevida.
 *
 * @since 1.0.0
 */
function handleUsersUpdateProfileRoute(PDO $db): void
{
    try {
        $payload = verifyAuthenticatedUserPayload();
        $userId = trim((string) ($payload['user_id'] ?? ''));
        $requestBody = json_decode(file_get_contents('php://input'), true);

        if (!is_array($requestBody)) {
            throw new InvalidArgumentException('Payload invalido para atualizacao do perfil.');
        }

        $result = buildUsersController($db)->updateAuthenticatedProfile($userId, $requestBody);
        Response::success($result, $result['message'] ?? 'Perfil atualizado com sucesso.');
    } catch (InvalidArgumentException $e) {
        Response::badRequest($e->getMessage());
    } catch (RuntimeException $e) {
        Response::unauthorized($e->getMessage());
    } catch (Throwable $e) {
        Response::serverError('Failed to update user profile', $e);
    }
}

/**
 * Ponto de entrada oficial para listar comentrios do proprio usurio.
 * A query string legada pode enviar `user_id`, mas a sesso define o escopo real.
 *
 * @since 1.0.0
 */
function handleUsersCommentsRoute(PDO $db): void
{
    try {
        $payload = verifyAuthenticatedUserPayload();
        $authenticatedUserId = trim((string) ($payload['user_id'] ?? ''));
        $requestedUserId = trim((string) (($_GET['user_id'] ?? '') ?: ($_GET['userId'] ?? '')));
        $isAdmin = (($payload['role'] ?? '') === 'admin');

        $result = buildUsersController($db)->listUserComments($authenticatedUserId, $requestedUserId, $isAdmin, $_GET);
        Response::success($result, 'User comments retrieved');
    } catch (InvalidArgumentException $e) {
        Response::badRequest($e->getMessage());
    } catch (RuntimeException $e) {
        Response::unauthorized($e->getMessage());
    } catch (Throwable $e) {
        Response::serverError('Failed to fetch user comments', $e);
    }
}

/**
 * Ponto de entrada autocontido para comentarios do usuario autenticado.
 *
 * @since 1.0.0
 */
function handleCurrentUserCommentsRoute(PDO $db): void
{
    try {
        $payload = verifyAuthenticatedUserPayload();
        $authenticatedUserId = trim((string) ($payload['user_id'] ?? ''));
        $result = buildUsersController($db)->getCurrentUserComments($authenticatedUserId, $_GET);
        Response::success($result, 'Current user comments retrieved');
    } catch (InvalidArgumentException $e) {
        Response::badRequest($e->getMessage());
    } catch (RuntimeException $e) {
        Response::unauthorized($e->getMessage());
    } catch (Throwable $e) {
        Response::serverError('Failed to fetch current user comments', $e);
    }
}

/**
 * Ponto de entrada oficial para listar anotacoes do proprio usurio.
 *
 * @since 1.0.0
 */
function handleUsersNotesRoute(PDO $db): void
{
    try {
        $authPayload = verifyAuthenticatedUserPayload();
        $authenticatedUserId = trim((string) ($authPayload['user_id'] ?? ''));
        $isAdmin = (($authPayload['role'] ?? '') === 'admin');
        $method = strtoupper((string) ($_SERVER['REQUEST_METHOD'] ?? 'GET'));

        if ($method === 'GET') {
            $requestedUserId = trim((string) (($_GET['userId'] ?? '') ?: ($_GET['user_id'] ?? '')));
            $result = buildUsersController($db)->listUserNotes($authenticatedUserId, $requestedUserId, $isAdmin);
            Response::success($result, 'User notes retrieved');
        }

        if ($method !== 'POST') {
            Response::badRequest('Metodo nao suportado para anotacoes.');
        }

        $validator = new UsersValidator();
        $normalized = $validator->validateQuestionNotePayload(readUsersJsonRequestBody());
        $result = buildUsersController($db)->saveUserQuestionNote(
            $authenticatedUserId,
            $normalized['requestedUserId'],
            $isAdmin,
            $normalized['questionId'],
            $normalized['text']
        );
        Response::success($result, $result['deleted'] ? 'Anotacao removida.' : 'Anotacao salva.');
    } catch (InvalidArgumentException $e) {
        Response::badRequest($e->getMessage());
    } catch (RuntimeException $e) {
        Response::unauthorized($e->getMessage());
    } catch (Throwable $e) {
        Response::serverError('Failed to fetch user notes', $e);
    }
}

/**
 * Ponto de entrada oficial para listar respostas do proprio usurio.
 *
 * @since 1.0.0
 */
function handleUsersAnswersRoute(PDO $db): void
{
    try {
        $payload = verifyAuthenticatedUserPayload();
        $authenticatedUserId = trim((string) ($payload['user_id'] ?? ''));
        $requestedUserId = trim((string) (($_GET['user_id'] ?? '') ?: ($_GET['userId'] ?? '')));
        $isAdmin = (($payload['role'] ?? '') === 'admin');

        $result = buildUsersController($db)->listUserAnswers($authenticatedUserId, $requestedUserId, $isAdmin, $_GET);
        Response::success($result, 'User answers retrieved');
    } catch (InvalidArgumentException $e) {
        Response::badRequest($e->getMessage());
    } catch (RuntimeException $e) {
        Response::unauthorized($e->getMessage());
    } catch (Throwable $e) {
        Response::serverError('Failed to fetch user answers', $e);
    }
}

/**
 * Ponto de entrada autocontido para respostas do usuario autenticado.
 *
 * @since 1.0.0
 */
function handleCurrentUserAnswersRoute(PDO $db): void
{
    try {
        $payload = verifyAuthenticatedUserPayload();
        $authenticatedUserId = trim((string) ($payload['user_id'] ?? ''));
        $result = buildUsersController($db)->getCurrentUserAnswers($authenticatedUserId, $_GET);
        Response::success($result, 'Current user answers retrieved');
    } catch (InvalidArgumentException $e) {
        Response::badRequest($e->getMessage());
    } catch (RuntimeException $e) {
        Response::unauthorized($e->getMessage());
    } catch (Throwable $e) {
        Response::serverError('Failed to fetch current user answers', $e);
    }
}

/**
 * Ponto de entrada oficial para a listagem administrativa de usurios.
 *
 * @since 1.0.0
 */
function handleUsersListRoute(PDO $db): void
{
    try {
        $payload = verifyAuthenticatedUserPayload();
        $isAdmin = (($payload['role'] ?? '') === 'admin');

        $result = buildUsersController($db)->listUsers($isAdmin);
        Response::success($result, 'Users retrieved');
    } catch (DomainException $e) {
        Response::forbidden($e->getMessage());
    } catch (RuntimeException $e) {
        Response::unauthorized($e->getMessage());
    } catch (Throwable $e) {
        Response::serverError('Failed to fetch users', $e);
    }
}

/**
 * Ponto de entrada publico para ranking de usuarios por XP.
 *
 * @since 1.0.0
 */
function handleUsersLevelLeaderboardRoute(PDO $db): void
{
    try {
        $limit = isset($_GET['limit']) ? (int) $_GET['limit'] : 50;
        $result = buildUsersController($db)->listPublicXpLeaderboard($limit);
        Response::success($result, 'XP leaderboard retrieved');
    } catch (Throwable $e) {
        Response::serverError('Failed to fetch XP leaderboard', $e);
    }
}

/**
 * Ponto de entrada oficial para excluir uma anotacao do usurio.
 *
 * @since 1.0.0
 */
function handleUsersDeleteNoteRoute(PDO $db): void
{
    try {
        $payload = verifyAuthenticatedUserPayload();
        $authenticatedUserId = trim((string) ($payload['user_id'] ?? ''));
        $isAdmin = (($payload['role'] ?? '') === 'admin');
        $validator = new UsersValidator();
        $normalizedPayload = $validator->validateDeleteNotePayload(readUsersJsonRequestBody());

        $result = buildUsersController($db)->deleteUserNote(
            $authenticatedUserId,
            $normalizedPayload['requestedUserId'],
            $isAdmin,
            $normalizedPayload['noteId']
        );
        Response::success($result, $result['message'] ?? 'Note deleted');
    } catch (InvalidArgumentException $e) {
        Response::badRequest($e->getMessage());
    } catch (OutOfBoundsException $e) {
        Response::notFound($e->getMessage());
    } catch (RuntimeException $e) {
        Response::unauthorized($e->getMessage());
    } catch (Throwable $e) {
        Response::serverError('Failed to delete note', $e);
    }
}

/**
 * Ponto de entrada oficial para registrar o pedido de exclusao da propria conta.
 *
 * @since 1.0.0
 */
function handleUsersDeleteAccountRoute(PDO $db): void
{
    try {
        $payload = verifyAuthenticatedUserPayload();
        $authenticatedUserId = trim((string) ($payload['user_id'] ?? ''));
        $validator = new UsersValidator();
        $normalizedPayload = $validator->validateAccountDeletionPayload(readUsersJsonRequestBody());

        ensureRecaptchaPassed($db, $normalizedPayload['captchaToken']);

        $result = buildUsersController($db)->requestAccountDeletion($authenticatedUserId, $normalizedPayload['reason']);
        Response::success($result, $result['message'] ?? 'Account deletion requested successfully');
    } catch (InvalidArgumentException $e) {
        Response::badRequest($e->getMessage());
    } catch (OutOfBoundsException $e) {
        Response::notFound($e->getMessage());
    } catch (RuntimeException $e) {
        if ($e->getMessage() === 'Confirme o reCAPTCHA antes de continuar.'
            || $e->getMessage() === 'Falha na verificacao de segurana (reCAPTCHA).'
            || str_contains($e->getMessage(), 'reCAPTCHA')
        ) {
            Response::validationError($e->getMessage());
        }

        Response::unauthorized($e->getMessage());
    } catch (Throwable $e) {
        Response::serverError('Failed to delete account', $e);
    }
}

/**
 * Entrada oficial do cron legado de recompensas por indicacao.
 *
 * @since 1.0.0
 */
function handleUsersProcessReferralRewardsCronRoute(PDO $db): void
{
    try {
        $configuredSecret = requireUsersCronSecret();
    } catch (RuntimeException $e) {
        http_response_code(500);
        header('Content-Type: application/json; charset=UTF-8');
        echo json_encode([
            'success' => false,
            'message' => $e->getMessage(),
        ], JSON_UNESCAPED_UNICODE);
        exit;
    }

    $providedKey = resolveUsersCronRequestKey();
    if ($providedKey === '' || !hash_equals($configuredSecret, $providedKey)) {
        http_response_code(403);
        header('Content-Type: application/json; charset=UTF-8');
        echo json_encode([
            'success' => false,
            'message' => 'Acesso negado: chave invalida.',
        ], JSON_UNESCAPED_UNICODE);
        exit;
    }

    $graceDays = isset($_GET['grace_days']) ? max(0, (int) $_GET['grace_days']) : 7;

    try {
        $summary = runUsersReferralRewardsCron($db, $graceDays);

        http_response_code(200);
        header('Content-Type: application/json; charset=UTF-8');
        echo json_encode([
            'success' => true,
            'summary' => $summary,
        ], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
        exit;
    } catch (Throwable $e) {
        http_response_code(500);
        header('Content-Type: application/json; charset=UTF-8');
        echo json_encode([
            'success' => false,
            'message' => 'Falha ao processar recompensas de indicacao.',
            'details' => $e->getMessage(),
        ], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
        exit;
    }
}

/**
 * Ponto de entrada oficial para listar cartoes salvos do usurio.
 *
 * @since 1.0.0
 */
function handleUsersListCardsRoute(PDO $db): void
{
    try {
        ensurePaymentProviderSchema($db);

        $payload = verifyAuthenticatedUserPayload();
        $authenticatedUserId = trim((string) ($payload['user_id'] ?? ''));
        $requestBody = readUsersJsonRequestBody();
        $requestedUserId = (new UsersValidator())->extractRequestedUserIdFromPayload($requestBody);
        $isAdmin = (($payload['role'] ?? '') === 'admin');

        $controller = new UsersCardsController(
            new UsersCardsService(
                new UsersRepository($db),
                new UsersValidator(),
                $db
            )
        );

        $result = $controller->listSavedCards($authenticatedUserId, $requestedUserId, $isAdmin);
        Response::success($result, 'Saved cards retrieved');
    } catch (InvalidArgumentException $e) {
        Response::badRequest($e->getMessage());
    } catch (OutOfBoundsException $e) {
        Response::notFound($e->getMessage());
    } catch (DomainException $e) {
        Response::forbidden($e->getMessage());
    } catch (RuntimeException $e) {
        Response::unauthorized($e->getMessage());
    } catch (Throwable $e) {
        Response::serverError('Failed to fetch saved cards', $e);
    }
}

/**
 * Ponto de entrada oficial para remover um carto salvo do usurio.
 *
 * @since 1.0.0
 */
function handleUsersRemoveCardRoute(PDO $db): void
{
    try {
        ensurePaymentProviderSchema($db);

        $payload = verifyAuthenticatedUserPayload();
        $authenticatedUserId = trim((string) ($payload['user_id'] ?? ''));
        $requestBody = readUsersJsonRequestBody();
        $validator = new UsersValidator();
        $cardPayload = $validator->validateSavedCardMutationPayload($requestBody);
        $isAdmin = (($payload['role'] ?? '') === 'admin');

        $controller = new UsersCardsController(
            new UsersCardsService(
                new UsersRepository($db),
                $validator,
                $db
            )
        );

        $result = $controller->removeSavedCard(
            $authenticatedUserId,
            $cardPayload['requestedUserId'],
            $isAdmin,
            $cardPayload['cardId']
        );
        Response::success($result, $result['message'] ?? 'Card removed successfully.');
    } catch (InvalidArgumentException $e) {
        Response::badRequest($e->getMessage());
    } catch (OutOfBoundsException $e) {
        Response::notFound($e->getMessage());
    } catch (DomainException $e) {
        Response::forbidden($e->getMessage());
    } catch (RuntimeException $e) {
        Response::unauthorized($e->getMessage());
    } catch (Throwable $e) {
        Response::serverError('Failed to remove saved card', $e);
    }
}

/**
 * Ponto de entrada oficial para definir o carto padrao do usurio.
 *
 * @since 1.0.0
 */
function handleUsersSetDefaultCardRoute(PDO $db): void
{
    try {
        ensurePaymentProviderSchema($db);

        $payload = verifyAuthenticatedUserPayload();
        $authenticatedUserId = trim((string) ($payload['user_id'] ?? ''));
        $requestBody = readUsersJsonRequestBody();
        $validator = new UsersValidator();
        $cardPayload = $validator->validateSavedCardMutationPayload($requestBody);
        $isAdmin = (($payload['role'] ?? '') === 'admin');

        $controller = new UsersCardsController(
            new UsersCardsService(
                new UsersRepository($db),
                $validator,
                $db
            )
        );

        $result = $controller->setDefaultSavedCard(
            $authenticatedUserId,
            $cardPayload['requestedUserId'],
            $isAdmin,
            $cardPayload['cardId']
        );
        Response::success($result, $result['message'] ?? 'Default card updated successfully.');
    } catch (InvalidArgumentException $e) {
        Response::badRequest($e->getMessage());
    } catch (OutOfBoundsException $e) {
        Response::notFound($e->getMessage());
    } catch (DomainException $e) {
        Response::forbidden($e->getMessage());
    } catch (RuntimeException $e) {
        Response::unauthorized($e->getMessage());
    } catch (Throwable $e) {
        Response::serverError('Failed to set default card', $e);
    }
}

/**
 * Ponto de entrada oficial para preparar o SetupIntent do cofre Stripe.
 *
 * @since 1.0.0
 */
function handleUsersCreateStripeSetupIntentRoute(PDO $db): void
{
    try {
        ensurePaymentProviderSchema($db);

        $payload = verifyAuthenticatedUserPayload();
        $authenticatedUserId = trim((string) ($payload['user_id'] ?? ''));

        $controller = new UsersCardsController(
            new UsersCardsService(
                new UsersRepository($db),
                new UsersValidator(),
                $db
            )
        );

        $result = $controller->createStripeSetupIntent($authenticatedUserId);
        Response::success($result, 'SetupIntent criado com sucesso.');
    } catch (InvalidArgumentException $e) {
        Response::badRequest($e->getMessage());
    } catch (RuntimeException $e) {
        Response::unauthorized($e->getMessage());
    } catch (Throwable $e) {
        Response::serverError('No foi possvel preparar o cadastro do carto Stripe.', $e);
    }
}

/**
 * Ponto de entrada oficial para sincronizar o payment method Stripe salvo.
 *
 * @since 1.0.0
 */
function handleUsersSyncStripeCardRoute(PDO $db): void
{
    try {
        ensurePaymentProviderSchema($db);

        $payload = verifyAuthenticatedUserPayload();
        $authenticatedUserId = trim((string) ($payload['user_id'] ?? ''));
        $requestBody = readUsersJsonRequestBody();
        $validator = new UsersValidator();
        $paymentMethodId = $validator->validateStripePaymentMethodPayload($requestBody);

        $controller = new UsersCardsController(
            new UsersCardsService(
                new UsersRepository($db),
                $validator,
                $db
            )
        );

        $result = $controller->syncStripeCard($authenticatedUserId, $paymentMethodId);
        Response::success($result, $result['message'] ?? 'Carto Stripe sincronizado com sucesso.');
    } catch (InvalidArgumentException $e) {
        Response::badRequest($e->getMessage());
    } catch (RuntimeException $e) {
        Response::unauthorized($e->getMessage());
    } catch (Throwable $e) {
        Response::serverError('No foi possvel sincronizar o carto Stripe.', $e);
    }
}

/**
 * Ponto de entrada oficial para salvar carto no cofre legado/local.
 *
 * @since 1.0.0
 */
function handleUsersSaveCardRoute(PDO $db): void
{
    Response::error('O endpoint legado de cartoes foi removido. Use apenas o fluxo Stripe SetupIntent.', 410);
}
