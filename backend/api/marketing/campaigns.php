<?php

require_once __DIR__ . '/../../config/cors.php';
require_once __DIR__ . '/../../config/database.php';
require_once __DIR__ . '/../../shared/responses/Response.php';
require_once __DIR__ . '/../../modules/marketing/repositories/MarketingCampaignRepository.php';
require_once __DIR__ . '/../../modules/marketing/services/MarketingCampaignService.php';
require_once __DIR__ . '/../../modules/marketing/controllers/MarketingCampaignController.php';
require_once __DIR__ . '/../../shared/auth/request_auth.php';

$database = new Database();
$db = $database->getConnection();

try {
    $service = new MarketingCampaignService(new MarketingCampaignRepository($db));
    $controller = new MarketingCampaignController($service);
    $method = strtoupper((string) ($_SERVER['REQUEST_METHOD'] ?? 'GET'));
    if ($method === 'GET') {
        $payload = verifyAuthenticatedUserPayload(false);
        Response::success($controller->publicCampaigns(
            isset($payload['user_id']) ? (string) $payload['user_id'] : null,
            isset($_SERVER['HTTP_X_CM_SESSION_KEY']) ? (string) $_SERVER['HTTP_X_CM_SESSION_KEY'] : null
        ));
    }
    if ($method !== 'POST') Response::error('Metodo nao permitido.', 405);
    $payload = json_decode(file_get_contents('php://input') ?: '', true);
    if (!is_array($payload) || ($payload['action'] ?? '') !== 'interaction') Response::badRequest('Acao de campanha invalida.');
    $payloadContext = verifyAuthenticatedUserPayload(false);
    Response::success($controller->interaction($payload, isset($payloadContext['user_id']) ? (string) $payloadContext['user_id'] : null));
} catch (InvalidArgumentException $e) {
    Response::validationError($e->getMessage());
} catch (Throwable $e) {
    error_log('[marketing_campaigns_route] ' . $e->getMessage());
    Response::serverError('Nao foi possivel registrar a interacao da campanha.', $e);
}
