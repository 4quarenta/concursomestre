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

require_once __DIR__ . '/../repositories/AnalyticsTrackingRepository.php';
require_once __DIR__ . '/../validators/AnalyticsTrackingValidator.php';

/**
 * Service do ledger first-party.
 *
 * @since 1.0.0
 */
class AnalyticsTrackingService
{
    public function __construct(
        private readonly AnalyticsTrackingRepository $repository,
        private readonly AnalyticsTrackingValidator $validator
    ) {
    }

    public function track(array $payload, ?array $authenticatedUserPayload = null): array
    {
        $normalized = $this->validator->validateTrackPayload($payload);

        $authenticatedUserId = trim((string) ($authenticatedUserPayload['user_id'] ?? ''));
        if ($authenticatedUserId !== '') {
            $normalized['user_id'] = $authenticatedUserId;
        } else {
            $normalized['user_id'] = null;
        }

        $this->repository->insertEvent($normalized);

        return [
            'tracked' => true,
            'eventName' => $normalized['event_name'],
        ];
    }
}
