<?php

require_once __DIR__ . '/../../config/cors.php';
require_once __DIR__ . '/../../config/database.php';
require_once __DIR__ . '/../../shared/responses/Response.php';
require_once __DIR__ . '/../../modules/marketing/repositories/MarketingCampaignRepository.php';
require_once __DIR__ . '/../../modules/marketing/services/MarketingCampaignService.php';
require_once __DIR__ . '/../../modules/marketing/controllers/MarketingCampaignController.php';

$database = new Database();
$db = $database->getConnection();

try {
    $service = new MarketingCampaignService(new MarketingCampaignRepository($db));
    $controller = new MarketingCampaignController($service);
    $method = strtoupper((string) ($_SERVER['REQUEST_METHOD'] ?? 'GET'));
    if ($method === 'GET') {
        Response::success($controller->publicCampaigns());
    }
    if ($method !== 'POST') Response::error('Metodo nao permitido.', 405);
    $payload = json_decode(file_get_contents('php://input') ?: '', true);
    if (!is_array($payload) || ($payload['action'] ?? '') !== 'interaction') Response::badRequest('Acao de campanha invalida.');
    Response::success($controller->interaction($payload, null));
} catch (InvalidArgumentException $e) {
    Response::validationError($e->getMessage());
} catch (Throwable $e) {
    error_log('[marketing_campaigns_route] ' . $e->getMessage());
    Response::serverError('Nao foi possivel registrar a interacao da campanha.', $e);
}
