<?php

declare(strict_types=1);

require_once __DIR__ . '/../../../shared/communications/CommunicationRepository.php';

/** Projecao operacional somente leitura da autoridade de comunicacoes. */
final class AdminCommunicationHistoryService
{
    public function __construct(private readonly CommunicationRepository $repository)
    {
    }

    public function list(array $filters): array
    {
        return $this->repository->listForAdmin([
            'page' => max(1, (int) ($filters['page'] ?? 1)),
            'perPage' => max(1, (int) ($filters['perPage'] ?? 25)),
            'search' => trim((string) ($filters['search'] ?? '')),
            'event_type' => trim((string) ($filters['event_type'] ?? '')),
            'delivery_class' => trim((string) ($filters['delivery_class'] ?? '')),
            'status' => trim((string) ($filters['status'] ?? '')),
            'channel' => trim((string) ($filters['channel'] ?? '')),
        ]);
    }
}
