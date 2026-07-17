<?php

declare(strict_types=1);

function phase02CanonicalRead(string $path): string
{
    $content = file_get_contents($path);
    if ($content === false) {
        throw new RuntimeException('Arquivo nao encontrado: ' . $path);
    }

    return $content;
}

function phase02CanonicalMethod(string $content, string $methodName): string
{
    $start = strpos($content, 'function ' . $methodName . '(');
    if ($start === false) {
        throw new RuntimeException('Metodo ausente: ' . $methodName);
    }

    $brace = strpos($content, '{', $start);
    $depth = 0;
    for ($index = $brace, $length = strlen($content); $index < $length; $index++) {
        if ($content[$index] === '{') {
            $depth++;
        } elseif ($content[$index] === '}') {
            $depth--;
            if ($depth === 0) {
                return substr($content, $start, $index - $start + 1);
            }
        }
    }

    throw new RuntimeException('Metodo nao fechado: ' . $methodName);
}

function phase02CanonicalAssert(bool $condition, string $message): void
{
    if (!$condition) {
        throw new RuntimeException($message);
    }
}

try {
    $backend = dirname(__DIR__);
    $usersService = phase02CanonicalRead($backend . '/modules/users/services/UsersService.php');
    $sessionMethod = phase02CanonicalMethod($usersService, 'getAuthenticatedSession');
    foreach (["'displayName' =>", "'avatarUrl' =>", "'permissions' =>", "'subscription' =>", "'gamification' =>", "'linkedProviders' =>", "'partnership' =>"] as $field) {
        phase02CanonicalAssert(strpos($sessionMethod, $field) !== false, 'Campo canônico ausente: ' . $field);
    }
    foreach (["'name' =>", "'photoUrl' =>", "'isAdmin' =>", "'isStaff' =>", "'canAccessAdmin' =>", "'planDisplayName' =>", "'hasActivePlan' =>", "'hasGoogleLinked' =>", "'hasFacebookLinked' =>", "'isPartner' =>"] as $alias) {
        phase02CanonicalAssert(strpos($sessionMethod, $alias) === false, 'Alias de sessao proibido: ' . $alias);
    }

    $billingMethod = phase02CanonicalMethod($usersService, 'getCurrentUserPaymentStatus');
    foreach (["'subscriptionStatus' =>", "'billingMode' =>", "'requiresPaymentMethod' =>", "'hasValidPaymentMethod' =>", "'actionRequired' =>"] as $field) {
        phase02CanonicalAssert(strpos($billingMethod, $field) !== false, 'Campo financeiro ausente: ' . $field);
    }
    phase02CanonicalAssert(strpos($billingMethod, 'has_saved_card') === false, 'Status financeiro nao pode confiar no espelho has_saved_card.');

    $routes = phase02CanonicalRead($backend . '/modules/users/routes.php');
    $paymentRoute = phase02CanonicalMethod($routes, 'handleCurrentUserPaymentStatusRoute');
    phase02CanonicalAssert(strpos($paymentRoute, 'verifyAuthenticatedUserPayload') !== false, 'Status financeiro deve usar sessao autenticada.');
    phase02CanonicalAssert(strpos($paymentRoute, '$_GET') === false, 'Status financeiro nao pode aceitar user_id por query string.');

    $endpoint = phase02CanonicalRead($backend . '/api/v2/users/me/billing/payment-status.php');
    phase02CanonicalAssert(strpos($endpoint, 'handleCurrentUserPaymentStatusRoute($db)') !== false, 'Endpoint v2 deve delegar para a rota financeira autocontida.');

    fwrite(STDOUT, "Phase02CanonicalSessionAndBillingTest: PASS\n");
} catch (Throwable $exception) {
    fwrite(STDERR, 'Phase02CanonicalSessionAndBillingTest: FAIL - ' . $exception->getMessage() . "\n");
    exit(1);
}
