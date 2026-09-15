<?php

declare(strict_types=1);

require_once __DIR__ . '/../IngestionPipeline.php';
require_once __DIR__ . '/../services/CanonicalImportSessionService.php';
require_once __DIR__ . '/../../seo/launch/SeoLaunchModeAuthority.php';

/**
 * Deterministic PRELAUNCH-only provider for browser acceptance.
 *
 * It produces synthetic provider records that travel through the same
 * CanonicalIngestionItem boundary used by real adapters. It never fetches
 * arbitrary URLs, accepts no provider secrets and is exposed only through the
 * authenticated admin crawler endpoint.
 */
final class BrowserFixtureProviderAdapter
{
    private const CONTRACT_VERSION = 'question-ingestion.v1';

    public function assertAvailable(): void
    {
        if (SeoLaunchModeAuthority::read() !== SeoLaunchMode::PRELAUNCH) {
            throw new DomainException('Provider fixture disponivel somente em PRELAUNCH.');
        }
    }

    /** @return array{runId:string,page:int,perPage:int,total:int,pages:int,items:list<CanonicalIngestionItem>,payloads:list<array<string,mixed>>} */
    public function collectPage(string $runId, int $page, int $perPage): array
    {
        $this->assertAvailable();
        $page = max(1, min(3, $page));
        $perPage = max(1, min(3, $perPage));
        $records = array_slice($this->records(), ($page - 1) * $perPage, $perPage);
        $items = [];
        $payloads = [];
        foreach ($records as $record) {
            $payload = $this->payload($record, $runId, $page, $perPage);
            $payloads[] = $payload;
            foreach ($payload['questions'] as $question) {
                $externalId = (string) ($question['source']['externalId'] ?? $question['tempId']);
                $normalized = [
                    'statement' => (string) ($question['content']['statement'] ?? ''),
                    'source' => [
                        'provider' => self::provider(),
                        'externalId' => $externalId,
                    ],
                    'domainIdentity' => [
                        'provider' => self::provider(),
                        'entityType' => 'question',
                        'externalId' => $externalId,
                    ],
                ];
                $items[] = new CanonicalIngestionItem(
                    'question',
                    self::provider(),
                    'question',
                    $externalId,
                    (string) ($record['version'] ?? '1'),
                    $runId . ':' . $externalId,
                    $normalized,
                    ['reference' => 'fixture://m20f05/' . $externalId],
                    'page:' . $page,
                );
            }
        }

        return [
            'runId' => $runId,
            'page' => $page,
            'perPage' => $perPage,
            'total' => count($this->records()),
            'pages' => (int) ceil(count($this->records()) / $perPage),
            'items' => $items,
            'payloads' => $payloads,
        ];
    }

    public static function provider(): string
    {
        return CanonicalImportSessionService::PROVIDER_FIXTURE;
    }

    public static function contractVersion(): string
    {
        return self::CONTRACT_VERSION;
    }

    /** @return list<array<string,mixed>> */
    private function records(): array
    {
        return [
            ['id' => 'm20f05-valid-001', 'statement' => 'Questao fixture valida para selecao.', 'status' => 'publishable', 'version' => '1'],
            ['id' => 'm20f05-duplicate-001', 'statement' => 'Questao fixture duplicada controlada.', 'status' => 'duplicate', 'version' => '1'],
            ['id' => 'm20f05-changed-001', 'statement' => 'Questao fixture com mudanca externa.', 'status' => 'changed', 'version' => '2'],
            ['id' => 'm20f05-invalid-001', 'statement' => '', 'status' => 'invalid', 'version' => '1'],
            ['id' => 'm20f05-retry-001', 'statement' => 'Questao fixture para tentativa repetivel.', 'status' => 'retryable_failure', 'version' => '1'],
            ['id' => 'm20f05-blocked-001', 'statement' => 'Questao fixture bloqueada pela guarda de publicacao.', 'status' => 'publication_blocked', 'version' => '1'],
        ];
    }

    /** @return array<string,mixed> */
    private function payload(array $record, string $runId, int $page, int $perPage): array
    {
        $baseExternalId = (string) $record['id'];
        $externalId = $baseExternalId . ':' . $runId;
        $statement = (string) $record['statement'];
        $reviewReason = match ((string) $record['status']) {
            'duplicate' => 'fixture_duplicate_candidate',
            'changed' => 'fixture_changed_external_record',
            'invalid' => 'fixture_invalid_candidate',
            'retryable_failure' => 'fixture_retryable_provider_failure',
            'publication_blocked' => 'fixture_publication_guard_blocked',
            default => 'fixture_requires_review',
        };

        return [
            'schemaVersion' => 'question-import.v2',
            'import' => [
                'sourceType' => self::provider(),
                'extractionMode' => 'm20f05_browser_fixture',
                'collectionPage' => $page,
                'collectionPerPage' => $perPage,
                'syntheticRunId' => $runId,
                'fixtureExternalId' => $baseExternalId,
                'fixtureStatus' => (string) $record['status'],
                'publicationGuard' => (string) $record['status'] === 'publishable'
                    ? 'SYNTHETIC_PRELAUNCH_REVIEW_REQUIRED'
                    : 'BLOCKED_OR_REVIEW_REQUIRED',
            ],
            'exam' => [
                'sourceKey' => self::provider() . ':exam:m20f05',
                'provider' => self::provider(),
                'externalId' => 'm20f05-fixture-exam',
                'title' => 'M20F-05 Fixture Provider - Prova Sintetica',
                'agency' => 'Fixture',
                'organizations' => ['ConcursoMestre PRELAUNCH'],
                'roles' => ['Analista Sintetico'],
                'year' => 2026,
                'questionRange' => ['start' => 1, 'end' => 6, 'total' => 6],
            ],
            'contexts' => [],
            'questions' => [[
                'tempId' => self::provider() . '_' . $externalId,
                'source' => [
                    'provider' => self::provider(),
                    'externalId' => $externalId,
                    'fixtureStatus' => (string) $record['status'],
                ],
                'content' => [
                    'statement' => $statement,
                    'statementClean' => strip_tags($statement),
                ],
                'alternatives' => [
                    ['tempId' => $externalId . '-a', 'label' => 'A', 'text' => 'Alternativa A'],
                    ['tempId' => $externalId . '-b', 'label' => 'B', 'text' => 'Alternativa B'],
                ],
                'answer' => ['raw' => 'A', 'correctAlternativeTempIds' => [$externalId . '-a']],
                'filters' => [
                    'subjects' => [['id' => null, 'label' => 'Direito Administrativo', 'slug' => 'direito-administrativo']],
                    'topics' => [['id' => null, 'label' => 'Atos administrativos', 'slug' => 'atos-administrativos']],
                    'careers' => [['id' => null, 'label' => 'Controle', 'slug' => 'controle']],
                ],
                'publication' => ['status' => 'draft'],
                'review' => [
                    'required' => true,
                    'status' => 'pending',
                    'reasons' => [$reviewReason],
                ],
            ]],
        ];
    }
}
