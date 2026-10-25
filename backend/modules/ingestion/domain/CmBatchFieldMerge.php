<?php
declare(strict_types=1);

/** Conservative field decisions; evidence verification is supplied by server-side review. */
final class CmBatchFieldMerge
{
    public static function decide(mixed $existing, mixed $incoming, bool $verified, bool $protected = false): array
    {
        if ($incoming === null || $incoming === '' || $incoming === []) {
            return ['action' => 'unchanged', 'value' => $existing, 'reason' => 'empty_incoming_preserved'];
        }
        if ($existing === $incoming) {
            return ['action' => 'unchanged', 'value' => $existing, 'reason' => 'same_value_additional_provenance'];
        }
        if (!$verified) {
            return ['action' => 'needs_review', 'value' => $existing, 'reason' => 'evidence_not_verified'];
        }
        if ($protected) {
            return ['action' => 'needs_review', 'value' => $existing, 'reason' => 'manual_value_protected'];
        }
        if ($existing === null || $existing === '' || $existing === []) {
            return ['action' => 'enrich', 'value' => $incoming, 'reason' => 'verified_missing_value'];
        }
        return ['action' => 'needs_review', 'value' => $existing, 'reason' => 'existing_value_preserved'];
    }
}
