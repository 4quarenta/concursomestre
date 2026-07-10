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

require_once __DIR__ . '/../repositories/AdminSecurityIpsRepository.php';
require_once __DIR__ . '/../validators/AdminSecurityIpsValidator.php';

/**
 * Service da operacao de seguranca para IPs suspeitos.
 *
 * @since 1.0.0
 */
class AdminSecurityIpsService
{
    public function __construct(
        private readonly AdminSecurityIpsRepository $repository,
        private readonly AdminSecurityIpsValidator $validator
    ) {
    }

    /**
     * Retorna snapshot da tela de seguranca de IPs.
     *
     * @since 1.0.0
     */
    public function overview(array $query): array
    {
        $filters = $this->validator->validateListFilters($query);
        $suspicious = $this->repository->listSuspiciousIps($filters['search'], $filters['limit']);
        $banned = $this->repository->listBannedIps($filters['search']);

        return [
            'suspicious' => $suspicious,
            'banned' => $banned,
            'stats' => [
                'suspiciousCount' => count($suspicious),
                'bannedCount' => count($banned),
            ],
        ];
    }

    /**
     * Executa ban/unban para um IP.
     *
     * @since 1.0.0
     */
    public function mutate(array $payload, string $adminUserId): array
    {
        $normalized = $this->validator->validateMutationPayload($payload);
        $action = $normalized['action'];

        if ($action === 'ban') {
            $data = $this->repository->banIpAddress(
                $normalized['ipAddress'],
                $normalized['reason'],
                $adminUserId
            );

            return [
                'message' => 'IP bloqueado com sucesso.',
                'data' => $data,
                'audit_action' => 'security.ip.ban',
                'audit_entity_type' => 'security_ip',
                'audit_entity_id' => $data['ipAddress'] ?? null,
                'audit_metadata' => [
                    'ip_address' => $data['ipAddress'] ?? null,
                    'reason' => $data['reason'] ?? null,
                ],
            ];
        }

        $data = $this->repository->unbanIpAddress($normalized['ipAddress'], $adminUserId);
        return [
            'message' => 'IP desbloqueado com sucesso.',
            'data' => $data,
            'audit_action' => 'security.ip.unban',
            'audit_entity_type' => 'security_ip',
            'audit_entity_id' => $data['ipAddress'] ?? null,
            'audit_metadata' => [
                'ip_address' => $data['ipAddress'] ?? null,
            ],
        ];
    }
}
