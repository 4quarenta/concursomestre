<?php

declare(strict_types=1);

/**
 * Autoridade unica para ordenar comunicacoes de uma mesma entidade.
 * Produtores que nao fornecem identidade de transicao preservam o contrato
 * legado; transicoes ordenaveis precisam fornecer revision e transitionId.
 */
final class CommunicationEventOrderingPolicy
{
    public function normalize(array $event): ?array
    {
        $raw = is_array($event['ordering'] ?? null) ? $event['ordering'] : [];
        $key = trim((string) ($raw['key'] ?? $event['orderingKey'] ?? ''));
        $transitionId = trim((string) ($raw['transitionId'] ?? $event['sourceTransitionId'] ?? ''));
        $revision = $raw['revision'] ?? $event['sourceRevision'] ?? null;

        if ($key === '' && $transitionId === '' && $revision === null) {
            return null;
        }

        if ($key === '' || $transitionId === '' || !is_numeric($revision) || (int) $revision < 0) {
            throw new InvalidArgumentException('Evento ordenavel exige key, revision e transitionId.');
        }

        return [
            'key' => mb_substr($key, 0, 191, 'UTF-8'),
            'revision' => (int) $revision,
            'transitionId' => mb_substr($transitionId, 0, 191, 'UTF-8'),
            'state' => mb_substr(trim((string) ($raw['state'] ?? $event['sourceState'] ?? '')), 0, 64, 'UTF-8'),
        ];
    }

    public function decide(?array $latest, array $incoming): string
    {
        if (!is_array($latest)) {
            return 'accept';
        }

        $latestRevision = (int) ($latest['source_revision'] ?? -1);
        if ($incoming['revision'] < $latestRevision) {
            return 'stale';
        }
        if ($incoming['revision'] === $latestRevision) {
            return $incoming['transitionId'] === (string) ($latest['source_transition_id'] ?? '')
                ? 'duplicate'
                : 'conflict';
        }

        return 'accept';
    }
}
