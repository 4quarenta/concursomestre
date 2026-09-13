<?php

declare(strict_types=1);

require_once __DIR__ . '/../IngestionPipeline.php';

/**
 * Provider adapter for mapped Gran records.
 *
 * Collection and publication remain separate: this boundary only creates a
 * deterministic preview. The private question queue remains the canonical
 * publication writer after an explicit administrative review.
 */
final class GranIngestionBoundary
{
    /** @return array{runId:string,provider:string,contractVersion:string,publicationGuard:string,items:list<array<string,mixed>>,metrics:array<string,int>} */
    public function previewPayloads(array $payloads, ?string $runId = null): array
    {
        $runId ??= self::uuid();
        $store = new InMemoryIngestionStore();
        $orchestrator = new IngestionOrchestrator(
            $store,
            writerRegistry: new IngestionWriterRegistry(['gran']),
        );
        $items = [];
        $seen = [];
        $metrics = array_fill_keys(['received', 'planned', 'duplicates', 'reviewRequired', 'rejected'], 0);

        foreach ($payloads as $payloadIndex => $payload) {
            if (!is_array($payload)) {
                $metrics['rejected']++;
                continue;
            }
            $questions = is_array($payload['questions'] ?? null) ? $payload['questions'] : [];
            foreach ($questions as $questionIndex => $question) {
                if (!is_array($question)) {
                    $metrics['rejected']++;
                    continue;
                }
                $source = is_array($question['source'] ?? null) ? $question['source'] : [];
                $externalId = trim((string) ($source['externalId'] ?? ''));
                if ($externalId === '') {
                    $externalId = trim((string) ($question['tempId'] ?? ''));
                }
                if ($externalId === '') {
                    $externalId = 'row-' . $payloadIndex . '-' . $questionIndex;
                }
                $content = is_array($question['content'] ?? null) ? $question['content'] : [];
                $statement = trim((string) ($content['statement'] ?? $question['statement'] ?? ''));
                $normalizedPayload = [
                    'statement' => $statement,
                    'source' => [
                        'provider' => 'gran',
                        'externalId' => $externalId,
                    ],
                    'domainIdentity' => [
                        'provider' => 'gran',
                        'entityType' => 'question',
                        'externalId' => $externalId,
                    ],
                ];
                $contentHash = CanonicalIngestionItem::payloadHash($normalizedPayload);
                $item = new CanonicalIngestionItem(
                    'question',
                    'gran',
                    'question',
                    $externalId,
                    $contentHash,
                    $runId . ':' . $externalId,
                    $normalizedPayload,
                    ['reference' => 'gran://question/' . $externalId],
                );
                $metrics['received']++;

                $sourceKey = $item->sourceIdentityKey();
                if (isset($seen[$sourceKey])) {
                    $previous = $seen[$sourceKey];
                    $action = $previous === $contentHash ? IngestionPlan::DUPLICATE : IngestionPlan::REVIEW_REQUIRED;
                    $state = $action === IngestionPlan::DUPLICATE
                        ? IngestionStateMachine::COMPLETED
                        : IngestionStateMachine::REVIEW_REQUIRED;
                    $reason = $action === IngestionPlan::DUPLICATE
                        ? 'duplicate_source_record'
                        : 'changed_duplicate_source_record';
                    $metrics[$action === IngestionPlan::DUPLICATE ? 'duplicates' : 'reviewRequired']++;
                    $items[] = self::itemSummary($item, $action, $state, [$reason]);
                    continue;
                }
                $seen[$sourceKey] = $contentHash;
                $result = $orchestrator->processOne($item, $runId, true);
                $action = (string) ($result['action'] ?? IngestionPlan::REJECT);
                $state = (string) ($result['state'] ?? IngestionStateMachine::REJECTED);
                if ($action === IngestionPlan::CREATE || $action === IngestionPlan::UPDATE) {
                    $metrics['planned']++;
                } elseif ($action === IngestionPlan::REVIEW_REQUIRED) {
                    $metrics['reviewRequired']++;
                } else {
                    $metrics['rejected']++;
                }
                $items[] = self::itemSummary(
                    $item,
                    $action,
                    $state,
                    is_array($result['reasonCodes'] ?? null) ? $result['reasonCodes'] : [],
                );
            }
        }

        return [
            'runId' => $runId,
            'provider' => 'gran',
            'contractVersion' => 'question-ingestion.v1',
            'publicationGuard' => 'REVIEW_REQUIRED',
            'items' => $items,
            'metrics' => $metrics,
        ];
    }

    /** @return array<string,mixed> */
    private static function itemSummary(
        CanonicalIngestionItem $item,
        string $action,
        string $state,
        array $reasonCodes,
    ): array {
        return [
            'sourceEntityType' => $item->sourceEntityType,
            'sourceEntityId' => $item->sourceEntityId,
            'sourceIdentityKey' => $item->sourceIdentityKey(),
            'contentHash' => $item->contentHash(),
            'idempotencyKey' => $item->idempotencyKey(),
            'action' => $action,
            'state' => $state,
            'reasonCodes' => array_values(array_map('strval', $reasonCodes)),
        ];
    }

    private static function uuid(): string
    {
        $bytes = random_bytes(16);
        $bytes[6] = chr((ord($bytes[6]) & 0x0f) | 0x40);
        $bytes[8] = chr((ord($bytes[8]) & 0x3f) | 0x80);
        return vsprintf('%s%s-%s-%s-%s-%s%s%s', str_split(bin2hex($bytes), 4));
    }
}
