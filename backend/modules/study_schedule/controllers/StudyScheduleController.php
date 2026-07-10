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
 * Controller HTTP do cronograma de estudos.
 *
 * @since 1.0.0
 */
class StudyScheduleController
{
    public function __construct(private readonly StudyScheduleService $service)
    {
    }

    public function get(array $authenticatedUserPayload): array
    {
        return $this->service->getSchedule($authenticatedUserPayload);
    }

    public function save(array $payload, array $authenticatedUserPayload): array
    {
        return $this->service->saveSchedule($payload, $authenticatedUserPayload);
    }

    public function delete(array $authenticatedUserPayload): array
    {
        return $this->service->deleteSchedule($authenticatedUserPayload);
    }
}
