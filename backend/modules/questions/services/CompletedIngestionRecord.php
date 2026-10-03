<?php

declare(strict_types=1);

final class CompletedIngestionRecord
{
    public static function result(array $result): array
    {
        unset($result['created'], $result['batches']);
        return $result;
    }

    public static function payload(array $payload, array $result): array
    {
        // Failed items still need their original payload for canonical retries.
        if (!empty($result['itemFailures'])) return $payload;
        if (isset($payload['batches']) && is_array($payload['batches'])) {
            return ['batches' => array_map(static function (array $batch) use ($result): array {
                return ['clientKey' => $batch['clientKey'] ?? $batch['client_key'] ?? '',
                    'payload' => self::payload($batch['payload'] ?? $batch, $result)];
            }, $payload['batches'])];
        }
        foreach ($payload['questions'] ?? [] as $question) {
            if (empty($question['tempId']) && empty($question['source']['externalId'])) {
                return $payload;
            }
        }
        return [
            'exam' => ['title' => $payload['exam']['title'] ?? ''],
            'import' => ['collectionPage' => $payload['import']['collectionPage'] ?? null],
            'questions' => array_map(static fn (array $question): array => [
                'tempId' => $question['tempId'] ?? '',
                'source' => $question['source'] ?? [],
                'filters' => $question['filters'] ?? [],
            ], $payload['questions'] ?? []),
        ];
    }
}
