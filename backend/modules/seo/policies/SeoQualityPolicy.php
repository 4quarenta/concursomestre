<?php

declare(strict_types=1);

require_once dirname(__DIR__) . '/contracts/SeoContractReasonCodes.php';

/**
 * Avalia SeoFacts e evidencias sanitizadas usando exclusivamente os checks
 * declarados em quality-gates.v1.json. enforcement=false e preservado.
 */
final class SeoQualityPolicy
{
    /** @var array<string, mixed> */
    private array $config;

    public function __construct(?string $configPath = null)
    {
        $path = $configPath ?? dirname(__DIR__, 4) . '/config/seo/quality-gates.v1.json';
        $this->config = $this->readJson($path);
        if (($this->config['version'] ?? null) !== 'quality-gates.v1') {
            throw new RuntimeException('Versao dos Quality Gates invalida.');
        }
        if (($this->config['enforcement'] ?? null) !== false) {
            throw new RuntimeException('Quality Gates devem permanecer em shadow mode no Checkpoint 2.');
        }
    }

    /**
     * @param array<string, mixed> $facts
     * @param array<string, mixed> $evidence
     * @return array{status: string, reasonCodes: list<string>, checks: list<array{id:string,kind:string,status:string,reasonCode:?string}>}
     */
    public function evaluate(string $resourceType, array $facts, array $evidence = []): array
    {
        $resourceConfig = $this->config['resources'][$resourceType] ?? null;
        if (!is_array($resourceConfig) || empty($resourceConfig['enabled'])) {
            return [
                'status' => 'NOT_EVALUATED',
                'reasonCodes' => ['quality.not_evaluated'],
                'checks' => [],
            ];
        }

        $checks = [];
        foreach (['hardChecks' => 'hard', 'softChecks' => 'soft'] as $configKey => $kind) {
            foreach ($resourceConfig[$configKey] ?? [] as $definition) {
                if (!is_array($definition)) {
                    continue;
                }
                $id = (string) ($definition['id'] ?? '');
                $reasonCode = (string) ($definition['reasonCode'] ?? 'quality.check_not_evaluable');
                $result = $this->evaluateCheck($resourceType, $id, $facts, $evidence, $resourceConfig['thresholds'] ?? []);
                $checks[] = [
                    'id' => $id,
                    'kind' => $kind,
                    'status' => $result,
                    'reasonCode' => $result === 'FAIL' ? $reasonCode : ($result === 'NOT_EVALUATED' ? 'quality.check_not_evaluable' : null),
                ];
            }
        }

        $hasFailure = false;
        $hasNotEvaluated = false;
        $reasonCodes = [];
        foreach ($checks as $check) {
            if ($check['status'] === 'FAIL') {
                $hasFailure = true;
                $reasonCodes[] = (string) $check['reasonCode'];
            } elseif ($check['status'] === 'NOT_EVALUATED') {
                $hasNotEvaluated = true;
            }
        }

        $status = $hasFailure ? 'FAIL' : ($hasNotEvaluated ? 'NOT_EVALUATED' : 'PASS');
        if ($status === 'NOT_EVALUATED') {
            $reasonCodes[] = 'quality.not_evaluated';
        }
        $reasonCodes = array_values(array_unique($reasonCodes));
        $reasonErrors = SeoContractReasonCodes::validate('quality', $reasonCodes);
        if ($reasonErrors !== []) {
            throw new LogicException('Quality reason codes invalidos: ' . implode(' | ', $reasonErrors));
        }

        return ['status' => $status, 'reasonCodes' => $reasonCodes, 'checks' => $checks];
    }

    /** @param array<string, mixed> $facts
     *  @param array<string, mixed> $evidence
     *  @param array<string, mixed> $thresholds
     */
    private function evaluateCheck(string $resourceType, string $check, array $facts, array $evidence, array $thresholds): string
    {
        return match ($resourceType . ':' . $check) {
            'question:statement_or_visual' => $this->boolResult(
                $this->hasText($facts['content']['questionExcerpt'] ?? '') || ($evidence['hasVisual'] ?? null) === true
            ),
            'question:no_placeholder_content' => $this->boolResult(!$this->containsPlaceholder($facts['content']['questionExcerpt'] ?? '')),
            'question:alternatives_consistent_with_type' => $this->evidenceBoolean($evidence, 'alternativesValid'),
            'question:taxonomy_hierarchy_valid' => $this->evidenceBoolean($evidence, 'taxonomyValid'),
            'question:referenced_assets_resolvable' => $this->evidenceBoolean($evidence, 'assetsValid'),
            'question:exam_context_coherent' => $this->evidenceBoolean($evidence, 'contextCoherent'),
            'question:distinct_content' => $this->evidenceOrConfiguredLength(
                $evidence,
                'distinctContentValid',
                $facts['content']['questionExcerpt'] ?? '',
                $thresholds['minimumDistinctiveCharacters'] ?? null
            ),
            'question:duplicate_candidate_reviewed' => $this->duplicateResult($evidence),

            'exam:stable_identity' => $this->boolResult($this->hasText($facts['identity']['displayName'] ?? '')),
            'exam:board_identity' => $this->boolResult($this->hasText($facts['classification']['boardName'] ?? '')),
            'exam:required_relations' => $this->evidenceBoolean($evidence, 'relationsValid'),
            'exam:official_files_or_public_questions' => $this->countOrThreshold(
                $evidence['officialFileCount'] ?? null,
                $evidence['publicQuestionCount'] ?? null,
                $thresholds['minimumOfficialFiles'] ?? null,
                $thresholds['minimumPublicQuestions'] ?? null
            ),

            'taxonomy:stable_identity' => $this->boolResult($this->hasText($facts['identity']['displayName'] ?? '')),
            'taxonomy:hierarchy_valid' => $this->evidenceBoolean($evidence, 'hierarchyValid'),
            'taxonomy:distinct_public_content' => $this->evidenceOrMinimumCount(
                $evidence,
                'publicContentValid',
                $facts['metrics']['publicItemCount'] ?? null,
                $thresholds['minimumPublicItems'] ?? null
            ),
            'taxonomy:editorial_context_when_required' => $this->evidenceOrConfiguredLength(
                $evidence,
                'editorialContextValid',
                $facts['content']['editorialIntroduction'] ?? '',
                $thresholds['minimumEditorialCharacters'] ?? null
            ),

            'board:consolidated_identity' => $this->boolResult(
                $this->hasText($facts['identity']['displayName'] ?? '')
                && ($this->hasText($facts['board']['acronym'] ?? '') || $this->hasText($facts['board']['fullName'] ?? ''))
            ),
            'board:public_exams_or_questions' => $this->countOrThreshold(
                $facts['metrics']['publicExamCount'] ?? null,
                $facts['metrics']['publicQuestionCount'] ?? null,
                $thresholds['minimumPublicExams'] ?? null,
                $thresholds['minimumPublicQuestions'] ?? null
            ),
            'board:editorial_context_when_required' => $this->evidenceOrConfiguredLength(
                $evidence,
                'editorialContextValid',
                $facts['content']['editorialIntroduction'] ?? '',
                $thresholds['minimumEditorialCharacters'] ?? null
            ),

            'law:legal_identity' => $this->boolResult(
                $this->hasText($facts['identity']['displayName'] ?? '') && $this->hasText($facts['law']['identifier'] ?? '')
            ),
            'law:public_legal_text' => $this->boolResult((int) ($facts['law']['articleCount'] ?? 0) > 0),
            'law:distinct_editorial_value' => $this->evidenceOrConfiguredLength(
                $evidence,
                'editorialContextValid',
                $facts['content']['commentaryExcerpt'] ?? '',
                $thresholds['minimumEditorialCharacters'] ?? null
            ),
            default => 'NOT_EVALUATED',
        };
    }

    private function evidenceBoolean(array $evidence, string $key): string
    {
        return array_key_exists($key, $evidence) && is_bool($evidence[$key])
            ? $this->boolResult($evidence[$key])
            : 'NOT_EVALUATED';
    }

    private function boolResult(bool $value): string
    {
        return $value ? 'PASS' : 'FAIL';
    }

    private function duplicateResult(array $evidence): string
    {
        if (!array_key_exists('exactDuplicateCount', $evidence) || !is_numeric($evidence['exactDuplicateCount'])) {
            return 'NOT_EVALUATED';
        }
        return (int) $evidence['exactDuplicateCount'] > 1 ? 'FAIL' : 'PASS';
    }

    private function configuredLength(mixed $value, mixed $threshold): string
    {
        if (!is_int($threshold) || $threshold < 0) {
            return 'NOT_EVALUATED';
        }
        $text = trim((string) $value);
        $length = function_exists('mb_strlen') ? mb_strlen($text, 'UTF-8') : strlen($text);
        return $this->boolResult($length >= $threshold);
    }

    private function evidenceOrConfiguredLength(
        array $evidence,
        string $evidenceKey,
        mixed $value,
        mixed $threshold
    ): string {
        if (array_key_exists($evidenceKey, $evidence) && is_bool($evidence[$evidenceKey])) {
            return $this->boolResult($evidence[$evidenceKey]);
        }
        return $this->configuredLength($value, $threshold);
    }

    private function minimumCount(mixed $count, mixed $threshold): string
    {
        if (!is_numeric($count) || !is_int($threshold) || $threshold < 0) {
            return 'NOT_EVALUATED';
        }
        return $this->boolResult((int) $count >= $threshold);
    }

    private function evidenceOrMinimumCount(
        array $evidence,
        string $evidenceKey,
        mixed $count,
        mixed $threshold
    ): string {
        if (array_key_exists($evidenceKey, $evidence) && is_bool($evidence[$evidenceKey])) {
            return $this->boolResult($evidence[$evidenceKey]);
        }
        return $this->minimumCount($count, $threshold);
    }

    private function countOrThreshold(mixed $first, mixed $second, mixed $firstThreshold, mixed $secondThreshold): string
    {
        if (!is_numeric($first) || !is_numeric($second)) {
            return 'NOT_EVALUATED';
        }
        $minimumFirst = is_int($firstThreshold) && $firstThreshold >= 0 ? $firstThreshold : 1;
        $minimumSecond = is_int($secondThreshold) && $secondThreshold >= 0 ? $secondThreshold : 1;
        return $this->boolResult((int) $first >= $minimumFirst || (int) $second >= $minimumSecond);
    }

    private function hasText(mixed $value): bool
    {
        return is_string($value) && trim(strip_tags($value)) !== '';
    }

    private function containsPlaceholder(mixed $value): bool
    {
        $text = strtolower(trim(strip_tags((string) $value)));
        foreach (['enunciado ainda nao preenchido', 'enunciado ainda não preenchido', 'texto nao informado', 'texto não informado', 'lorem ipsum'] as $placeholder) {
            if (str_contains($text, $placeholder)) {
                return true;
            }
        }
        return false;
    }

    /** @return array<string, mixed> */
    private function readJson(string $path): array
    {
        $raw = file_get_contents($path);
        if ($raw === false) {
            throw new RuntimeException('Quality Gates nao encontrados.');
        }
        $decoded = json_decode($raw, true, 512, JSON_THROW_ON_ERROR);
        if (!is_array($decoded)) {
            throw new RuntimeException('Quality Gates invalidos.');
        }
        return $decoded;
    }
}
