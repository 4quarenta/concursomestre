<?php

declare(strict_types=1);

require_once __DIR__ . '/../../config/cors.php';
require_once __DIR__ . '/../../config/database.php';
require_once __DIR__ . '/../../shared/security/AdminSecurity.php';
require_once __DIR__ . '/../../shared/responses/Response.php';
require_once __DIR__ . '/../../modules/finance/services/ReferralFinance.php';

$database = new Database();
$db = $database->getConnection();

try {
    $context = requirePlatformAdminSessionContext($db);
    $adminUserId = (string) ($context['admin_user_id'] ?? '');
    $method = strtoupper((string) ($_SERVER['REQUEST_METHOD'] ?? 'GET'));

    if ($method === 'GET') {
        Response::success(ReferralFinance::adminOverview($db), 'Referral payout overview retrieved');
    }

    if ($method !== 'POST') {
        Response::error('Metodo nao permitido.', 405, null, 'method_not_allowed');
    }

    $payload = json_decode((string) file_get_contents('php://input'), true);
    if (!is_array($payload)) {
        Response::badRequest('Payload invalido.');
    }
    $action = strtolower(trim((string) ($payload['action'] ?? '')));
    if ($action === 'create_cycle') {
        $result = ReferralFinance::createCycle($db, $adminUserId, !empty($payload['force']));
        logAdminAudit($db, $adminUserId, 'referral_payout.create_cycle', 'referral_payout_cycle', (string) ($result['cycleId'] ?? ''), $result);
        Response::success($result, 'Ciclo de repasses processado.');
    }
    if ($action === 'mark_paid') {
        $result = ReferralFinance::markPayoutPaid(
            $db,
            (int) ($payload['itemId'] ?? 0),
            $adminUserId,
            (string) ($payload['providerReference'] ?? '')
        );
        logAdminAudit($db, $adminUserId, 'referral_payout.mark_paid', 'referral_payout_item', (string) ($payload['itemId'] ?? ''), $result);
        Response::success($result, 'Repasse marcado como pago.');
    }

    Response::badRequest('Acao financeira invalida.');
} catch (InvalidArgumentException $e) {
    Response::validationError($e->getMessage());
} catch (RuntimeException $e) {
    Response::validationError($e->getMessage());
} catch (Throwable $e) {
    error_log('[admin_referral_payouts] ' . $e->getMessage());
    Response::serverError('Nao foi possivel processar os repasses de indicacao.', $e);
}
