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

declare(strict_types=1);

/**
 * Check operacional em CLI para validar a conexão basica com Stripe.
 * Não expoe stack trace nem detalhes sensiveis em rota web.
 */
if (PHP_SAPI !== 'cli') {
    http_response_code(403);
    exit("Este script so pode ser executado via CLI.\n");
}

require_once __DIR__ . '/../../config/stripe.php';

try {
    $stripe = getStripeClient();
    $balance = $stripe->balance->retrieve([]);
    $availableCurrencies = [];

    if (is_array($balance->available ?? null)) {
        foreach ($balance->available as $row) {
            $currency = '';

            if (is_object($row) && isset($row->currency)) {
                $currency = (string) $row->currency;
            } elseif (is_array($row)) {
                $currency = (string) ($row['currency'] ?? '');
            }

            if ($currency !== '' && !in_array($currency, $availableCurrencies, true)) {
                $availableCurrencies[] = $currency;
            }
        }
    }

    echo json_encode([
        'success' => true,
        'message' => 'Conexão com Stripe validada.',
        'publishable_key_prefix' => substr((string) STRIPE_PUBLISHABLE_KEY, 0, 8),
        'available_currencies' => $availableCurrencies,
    ], JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES) . PHP_EOL;
} catch (Throwable $e) {
    fwrite(STDERR, json_encode([
        'success' => false,
        'message' => 'Falha ao validar Stripe.',
        'error' => $e->getMessage(),
    ], JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES) . PHP_EOL);

    exit(1);
}
