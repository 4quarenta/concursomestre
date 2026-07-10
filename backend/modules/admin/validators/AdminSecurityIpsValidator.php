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

require_once __DIR__ . '/../../../shared/security/IpBanGuard.php';

/**
 * Valida filtros e mutacoes da tela de IPs suspeitos.
 *
 * @since 1.0.0
 */
class AdminSecurityIpsValidator
{
    /**
     * Normaliza filtros da listagem de seguranca.
     *
     * @since 1.0.0
     */
    public function validateListFilters(array $query): array
    {
        $search = trim((string) ($query['search'] ?? ''));
        $limit = (int) ($query['limit'] ?? 50);
        $limit = max(10, min(200, $limit));

        return [
            'search' => $search,
            'limit' => $limit,
        ];
    }

    /**
     * Normaliza mutacao de bloqueio/desbloqueio.
     *
     * @since 1.0.0
     */
    public function validateMutationPayload(array $payload): array
    {
        $action = strtolower(trim((string) ($payload['action'] ?? '')));
        $ipAddress = normalizeSecurityIpAddress((string) ($payload['ipAddress'] ?? $payload['ip'] ?? ''));
        $reason = trim((string) ($payload['reason'] ?? ''));

        if (!in_array($action, ['ban', 'unban'], true)) {
            throw new InvalidArgumentException('Acao de seguranca invalida.');
        }

        if ($ipAddress === null) {
            throw new InvalidArgumentException('Informe um IP valido.');
        }

        if ($action === 'ban' && $reason === '') {
            throw new InvalidArgumentException('Informe o motivo do bloqueio.');
        }

        return [
            'action' => $action,
            'ipAddress' => $ipAddress,
            'reason' => $reason,
        ];
    }
}
