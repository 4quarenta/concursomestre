<?php

declare(strict_types=1);

final class SeoInstanceReadiness
{
    private const STATUSES = ['READY', 'NOT_READY', 'NOT_APPLICABLE'];
    private const REASON_CODES = [
        'instance_readiness.entity_missing',
        'instance_readiness.invalid_slug',
        'instance_readiness.pending',
        'instance_readiness.publication_blocked',
        'instance_readiness.invalid_hierarchy',
        'instance_readiness.invalid_taxonomy_chain',
        'instance_readiness.orphan',
        'instance_readiness.cycle',
        'instance_readiness.wrong_parent_level',
        'instance_readiness.wrong_type',
        'instance_readiness.internal',
        'instance_readiness.placeholder',
        'instance_readiness.protected',
        'instance_readiness.canonical_invalid',
        'instance_readiness.not_evaluated',
        'instance_readiness.not_applicable',
        'instance_readiness.current_implementation_not_ready',
    ];

    /** @param mixed $value
     *  @return array{status:string,reasonCodes:list<string>}
     */
    public static function validate(mixed $value): array
    {
        if (!is_array($value)) {
            throw new InvalidArgumentException('InstanceReadiness deve ser um objeto.');
        }
        $status = strtoupper(trim((string) ($value['status'] ?? '')));
        $reasonCodes = is_array($value['reasonCodes'] ?? null)
            ? array_values(array_unique(array_filter($value['reasonCodes'], 'is_string')))
            : [];
        if (!in_array($status, self::STATUSES, true)) {
            throw new InvalidArgumentException('InstanceReadiness possui status invalido.');
        }
        foreach ($reasonCodes as $reasonCode) {
            if (!in_array($reasonCode, self::REASON_CODES, true)) {
                throw new InvalidArgumentException('InstanceReadiness possui reason code invalido.');
            }
        }
        if ($status === 'READY' && $reasonCodes !== []) {
            throw new InvalidArgumentException('InstanceReadiness READY nao aceita bloqueios.');
        }
        if ($status !== 'READY' && $reasonCodes === []) {
            throw new InvalidArgumentException('InstanceReadiness bloqueada exige reason code.');
        }
        return ['status' => $status, 'reasonCodes' => $reasonCodes];
    }

    /** @param array<string,mixed> $publication
     *  @param array<string,mixed> $quality
     *  @return array{status:string,reasonCodes:list<string>}
     */
    public static function fromSignals(array $publication, array $quality, bool $currentImplementationReady = true): array
    {
        if (!$currentImplementationReady) {
            return ['status' => 'NOT_READY', 'reasonCodes' => ['instance_readiness.current_implementation_not_ready']];
        }
        if (($publication['status'] ?? null) !== 'published'
            || ($publication['visibility'] ?? null) !== 'public'
            || ($publication['access'] ?? null) !== 'allowed') {
            return ['status' => 'NOT_READY', 'reasonCodes' => ['instance_readiness.publication_blocked']];
        }
        if (($quality['status'] ?? null) !== 'PASS') {
            $qualityReasons = is_array($quality['reasonCodes'] ?? null) ? $quality['reasonCodes'] : [];
            if (in_array('quality.taxonomy.invalid_hierarchy', $qualityReasons, true)) {
                return ['status' => 'NOT_READY', 'reasonCodes' => ['instance_readiness.invalid_hierarchy']];
            }
            return ['status' => 'NOT_READY', 'reasonCodes' => ['instance_readiness.not_evaluated']];
        }
        return ['status' => 'READY', 'reasonCodes' => []];
    }

    private function __construct()
    {
    }
}
