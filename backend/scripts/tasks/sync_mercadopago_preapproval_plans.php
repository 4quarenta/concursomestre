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
 * Guarda operacional para o cron legado de sincronizacao de planos Mercado Pago.
 *
 * O produto foi migrado para Stripe, mas alguns ambientes antigos ainda podem
 * ter o agendamento deste arquivo. Manter o entrypoint evita "file not found" e
 * devolve uma resposta explicita para o operador remover o cron legado.
 */
if (PHP_SAPI !== 'cli') {
    http_response_code(403);
    exit("Este script so pode ser executado via CLI.\n");
}

final class SubscriptionsMercadoPagoPlanSyncService
{
    public function run(): array
    {
        return [
            'success' => false,
            'removed' => true,
            'provider' => 'mercadopago',
            'message' => 'Mercado Pago foi removido do produto. Use apenas os crons e webhooks Stripe.',
        ];
    }
}

$service = new SubscriptionsMercadoPagoPlanSyncService();
$summary = $service->run();

echo json_encode($summary, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES) . PHP_EOL;
exit(2);
