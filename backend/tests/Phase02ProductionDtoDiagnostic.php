<?php

declare(strict_types=1);

require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../modules/users/routes.php';

function phase02ProductionAssert(bool $condition, string $message): void
{
    if (!$condition) {
        throw new RuntimeException($message);
    }
}

try {
    $db = (new Database())->getConnection();
    $userId = (string) $db->query("SELECT id FROM users WHERE status = 'active' LIMIT 1")->fetchColumn();
    phase02ProductionAssert($userId !== '', 'Nenhum usuario ativo disponivel para diagnostico sanitizado.');

    $controller = buildUsersController($db);
    $session = $controller->getAuthenticatedSession($userId);
    $billing = $controller->getCurrentUserPaymentStatus($userId);

    $expectedRootKeys = ['user', 'subscription', 'gamification', 'linkedProviders', 'partnership'];
    $expectedUserKeys = ['id', 'displayName', 'email', 'avatarUrl', 'status', 'emailVerified', 'role', 'permissions'];
    $forbiddenUserKeys = [
        'name',
        'photoUrl',
        'isAdmin',
        'isStaff',
        'canAccessAdmin',
        'plan',
        'planDisplayName',
        'hasActivePlan',
        'hasGoogleLinked',
        'hasFacebookLinked',
        'isPartner',
        'hasSavedCard',
        'billing',
        'bankAccount',
    ];
    $expectedBillingKeys = [
        'subscriptionStatus',
        'billingMode',
        'requiresPaymentMethod',
        'hasValidPaymentMethod',
        'actionRequired',
    ];

    phase02ProductionAssert(array_keys($session) === $expectedRootKeys, 'Chaves de sessao fora do contrato canonico.');
    phase02ProductionAssert(array_keys($session['user']) === $expectedUserKeys, 'Chaves de usuario fora do contrato canonico.');
    phase02ProductionAssert(array_intersect($forbiddenUserKeys, array_keys($session['user'])) === [], 'Alias ou billing encontrado no DTO de sessao.');
    phase02ProductionAssert(array_keys($billing) === $expectedBillingKeys, 'Chaves de billing fora do contrato minimo.');

    fwrite(STDOUT, json_encode([
        'sessionRootKeys' => array_keys($session),
        'sessionUserKeys' => array_keys($session['user']),
        'forbiddenUserKeys' => [],
        'billingKeys' => array_keys($billing),
    ], JSON_UNESCAPED_SLASHES) . PHP_EOL);
    fwrite(STDOUT, "Phase02ProductionDtoDiagnostic: PASS\n");
} catch (Throwable $exception) {
    fwrite(STDERR, 'Phase02ProductionDtoDiagnostic: FAIL - ' . $exception->getMessage() . PHP_EOL);
    exit(1);
}
