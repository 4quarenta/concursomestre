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

/**
 * Controller fino de tracking first-party.
 *
 * @since 1.0.0
 */
class AnalyticsTrackingController
{
    public function __construct(private readonly AnalyticsTrackingService $service)
    {
    }

    public function track(array $payload, ?array $authenticatedUserPayload = null): array
    {
        return $this->service->track($payload, $authenticatedUserPayload);
    }
}
