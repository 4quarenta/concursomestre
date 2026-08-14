<?php

declare(strict_types=1);

require_once dirname(__DIR__, 2) . '/modules/seo/contracts/SeoContractValidator.php';

/**
 * Traduz o estado editorial existente para PublicationDecision v1.
 *
 * A policy nao autentica usuarios nem calcula permissoes. O chamador fornece
 * o resultado do RBAC atual em existingAccessAllowed. Neste checkpoint a
 * decisao e apenas informativa e nao substitui as regras de publicacao.
 */
final class ContentPublicationPolicy
{
    /**
     * @param array<string, mixed> $content
     * @param array{existingAccessAllowed?: bool, evaluatedAt?: string} $context
     * @return array<string, mixed>
     */
    public function decide(array $content, array $context = []): array
    {
        $evaluatedAt = $this->dateTime($context['evaluatedAt'] ?? null) ?? new DateTimeImmutable('now');
        $rawStatus = strtolower(trim((string) ($content['status'] ?? 'unpublished')));
        $scheduledAt = $this->dateTime($content['scheduledAt'] ?? null);
        $embargoUntil = $this->dateTime($content['embargoUntil'] ?? null);
        $visibility = $this->normalizeVisibility($content['visibility'] ?? null);
        $reasonCodes = [];

        $status = match ($rawStatus) {
            'published', 'active' => 'published',
            'scheduled' => $scheduledAt !== null && $scheduledAt <= $evaluatedAt ? 'published' : 'scheduled',
            'blocked', 'rejected' => 'blocked',
            default => 'unpublished',
        };

        if ($status === 'unpublished') {
            $reasonCodes[] = 'publication.unpublished';
        } elseif ($status === 'scheduled') {
            $reasonCodes[] = 'publication.scheduled';
        }

        if ($embargoUntil !== null && $embargoUntil > $evaluatedAt) {
            $status = 'scheduled';
            $reasonCodes[] = 'publication.embargo_active';
        }

        $moderation = strtolower(trim((string) ($content['moderationStatus'] ?? '')));
        if (!empty($content['blocked']) || in_array($moderation, ['blocked', 'rejected'], true)) {
            $status = 'blocked';
            $reasonCodes[] = 'publication.moderation_blocked';
        }

        $provenance = strtolower(trim((string) ($content['provenanceStatus'] ?? 'unknown')));
        if (!in_array($provenance, ['known', 'verified'], true)) {
            $reasonCodes[] = 'publication.provenance_unknown';
        }

        $rights = strtolower(trim((string) ($content['rightsStatus'] ?? 'not_evaluable')));
        if ($rights === 'denied') {
            $status = 'blocked';
            $reasonCodes[] = 'publication.rights_denied';
        } elseif ($rights === 'unknown') {
            $reasonCodes[] = 'publication.rights_unknown';
        } elseif (!in_array($rights, ['allowed', 'verified'], true)) {
            $reasonCodes[] = 'publication.rights_not_evaluable';
        }

        if ($visibility === 'authenticated') {
            $reasonCodes[] = 'publication.visibility_authenticated';
        } elseif ($visibility === 'restricted') {
            $reasonCodes[] = 'publication.visibility_restricted';
        }

        $existingAccessAllowed = array_key_exists('existingAccessAllowed', $context)
            ? (bool) $context['existingAccessAllowed']
            : $visibility === 'public';
        $access = $status === 'blocked' || !$existingAccessAllowed ? 'denied' : 'allowed';
        if ($access === 'denied') {
            $reasonCodes[] = 'publication.access_denied';
        }
        if ($status === 'blocked') {
            $reasonCodes[] = 'publication.blocked';
        }

        $decision = [
            'policyVersion' => SeoContractEnums::PUBLICATION_POLICY_VERSION,
            'status' => $status,
            'visibility' => $visibility,
            'access' => $access,
            'reasonCodes' => array_values(array_unique($reasonCodes)),
        ];
        $errors = SeoContractValidator::validatePublicationDecision($decision);
        if ($errors !== []) {
            throw new LogicException('PublicationDecision invalida: ' . implode(' | ', $errors));
        }

        return $decision;
    }

    private function normalizeVisibility(mixed $value): string
    {
        return match (strtolower(trim((string) $value))) {
            'public' => 'public',
            'authenticated', 'private' => 'authenticated',
            default => 'restricted',
        };
    }

    private function dateTime(mixed $value): ?DateTimeImmutable
    {
        if (!is_string($value) || trim($value) === '') {
            return null;
        }

        try {
            return new DateTimeImmutable($value);
        } catch (Throwable) {
            return null;
        }
    }
}
