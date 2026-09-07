<?php

declare(strict_types=1);

require_once __DIR__ . '/services/BenefitService.php';
require_once __DIR__ . '/../../shared/auth/request_auth.php';
require_once __DIR__ . '/../../shared/security/AdminSecurity.php';
require_once __DIR__ . '/../../shared/responses/Response.php';

function buildBenefitService(PDO $db): BenefitService
{
    return new BenefitService($db);
}

function handleUserBenefitsRoute(PDO $db): void
{
    try {
        if (strtoupper((string) ($_SERVER['REQUEST_METHOD'] ?? 'GET')) !== 'GET') {
            Response::error('Metodo nao permitido.', 405);
        }
        $payload = verifyAuthenticatedUserPayload(true);
        $userId = (string) ($payload['user_id'] ?? '');
        $service = buildBenefitService($db);
        Response::success([
            'benefits' => $service->listUserBenefits($userId),
            'entitlement' => $service->getUserEntitlement($userId),
        ]);
    } catch (RuntimeException $e) {
        Response::unauthorized($e->getMessage());
    } catch (Throwable $e) {
        Response::serverError('Nao foi possivel carregar os Benefits.', $e);
    }
}

function handleUserBenefitRedemptionRoute(PDO $db): void
{
    try {
        if (strtoupper((string) ($_SERVER['REQUEST_METHOD'] ?? 'POST')) !== 'POST') {
            Response::error('Metodo nao permitido.', 405);
        }
        $csrfCookie = getCsrfTokenFromCookie();
        if ($csrfCookie !== null && !assertValidCsrfToken($csrfCookie, getCsrfTokenFromRequest())) {
            Response::forbidden('CSRF token invalido.');
        }
        $payload = verifyAuthenticatedUserPayload(true);
        $body = json_decode(file_get_contents('php://input'), true) ?: [];
        $result = buildBenefitService($db)->redeemCode(
            (string) ($payload['user_id'] ?? ''),
            (string) ($body['code'] ?? ''),
            (string) ($body['idempotency_key'] ?? '')
        );
        Response::success($result, 'Benefit solicitado.');
    } catch (DomainException $e) {
        Response::error($e->getMessage(), 409);
    } catch (InvalidArgumentException $e) {
        Response::badRequest($e->getMessage());
    } catch (RuntimeException $e) {
        Response::unauthorized($e->getMessage());
    } catch (Throwable $e) {
        Response::serverError('Nao foi possivel resgatar o Benefit.', $e);
    }
}

function handleAdminBenefitsRoute(PDO $db): void
{
    try {
        $context = requirePlatformAdminSessionContext($db);
        $body = json_decode(file_get_contents('php://input'), true) ?: [];
        $service = buildBenefitService($db);
        $action = trim((string) ($_GET['action'] ?? $body['action'] ?? ''));
        $actorId = (string) $context['admin_user_id'];

        if (($_SERVER['REQUEST_METHOD'] ?? 'GET') === 'GET' && $action === 'user') {
            $userId = trim((string) ($_GET['user_id'] ?? ''));
            Response::success(['benefits' => $service->listUserBenefits($userId), 'entitlement' => $service->getUserEntitlement($userId)]);
        }
        if (($_SERVER['REQUEST_METHOD'] ?? 'GET') === 'GET' && $action === 'definitions') {
            Response::success(['definitions' => $service->listDefinitions()]);
        }
        if (($_SERVER['REQUEST_METHOD'] ?? 'POST') !== 'POST') {
            Response::error('Metodo nao permitido.', 405);
        }
        $csrfCookie = getCsrfTokenFromCookie();
        if ($csrfCookie !== null && !assertValidCsrfToken($csrfCookie, getCsrfTokenFromRequest())) {
            Response::forbidden('CSRF token invalido.');
        }
        $result = match ($action) {
            'create_definition' => $service->createDefinition($body, $actorId),
            'create_code' => $service->createCode($body, $actorId),
            'grant' => $service->grant((string) ($body['user_id'] ?? ''), (string) ($body['benefit_definition_id'] ?? ''), $body, $actorId),
            'revoke' => $service->revokeGrant((string) ($body['grant_id'] ?? ''), $actorId, (string) ($body['reason'] ?? 'Revogado pelo administrador')),
            'confirm_provider_extension' => $service->confirmProviderBillingExtension((string) ($body['grant_id'] ?? ''), (string) ($body['provider_reference'] ?? ''), (string) ($body['old_period_end'] ?? ''), (string) ($body['new_period_end'] ?? ''), $actorId),
            default => throw new InvalidArgumentException('Acao de Benefit invalida.'),
        };
        logAdminAudit($db, $actorId, 'benefit.' . $action, 'benefit', (string) ($body['grant_id'] ?? $body['benefit_definition_id'] ?? ''), ['source_type' => $body['source_type'] ?? null]);
        Response::success($result, 'Operacao de Benefit concluida.');
    } catch (DomainException $e) {
        Response::error($e->getMessage(), 409);
    } catch (InvalidArgumentException $e) {
        Response::badRequest($e->getMessage());
    } catch (RuntimeException $e) {
        Response::forbidden($e->getMessage());
    } catch (Throwable $e) {
        Response::serverError('Nao foi possivel processar o Benefit administrativo.', $e);
    }
}
