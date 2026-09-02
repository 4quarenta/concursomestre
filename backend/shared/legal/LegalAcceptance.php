<?php

declare(strict_types=1);

require_once __DIR__ . '/LegalDocumentVersion.php';

/**
 * Valida e registra aceite legal sem substituir o histórico de versões.
 */
final class LegalAcceptance
{
    private const SOURCE_PATTERN = '/^[a-z][a-z0-9_]{2,79}$/';

    public static function assertActiveVersion(string $documentType, string $submittedVersion): void
    {
        $normalizedVersion = trim($submittedVersion);
        if ($normalizedVersion === '' || !hash_equals(LegalDocumentVersion::version($documentType), $normalizedVersion)) {
            throw new InvalidArgumentException('A versao vigente do documento legal deve ser aceita.');
        }
    }

    public static function assertAccepted(array $payload, string $acceptedKey, string $versionKey, string $documentType): string
    {
        if (($payload[$acceptedKey] ?? false) !== true) {
            throw new InvalidArgumentException('O aceite do documento legal e obrigatorio.');
        }

        $version = trim((string) ($payload[$versionKey] ?? ''));
        self::assertActiveVersion($documentType, $version);
        return $version;
    }

    public static function record(PDO $db, string $userId, string $documentType, string $version, string $sourceFlow): void
    {
        $normalizedUserId = trim($userId);
        $normalizedSource = trim($sourceFlow);
        if ($normalizedUserId === '' || !preg_match('/^[A-Za-z0-9_-]{8,80}$/', $normalizedUserId)) {
            throw new InvalidArgumentException('Identidade de usuario invalida para aceite legal.');
        }
        if (!preg_match(self::SOURCE_PATTERN, $normalizedSource)) {
            throw new InvalidArgumentException('Origem do aceite legal invalida.');
        }

        self::assertActiveVersion($documentType, $version);
        $statement = $db->prepare(
            'INSERT INTO legal_document_acceptances '
            . '(user_id, document_type, document_version, accepted_at, source_flow) '
            . 'VALUES (:user_id, :document_type, :document_version, CURRENT_TIMESTAMP(6), :source_flow) '
            . 'ON DUPLICATE KEY UPDATE id = id'
        );
        $statement->execute([
            'user_id' => $normalizedUserId,
            'document_type' => $documentType,
            'document_version' => trim($version),
            'source_flow' => $normalizedSource,
        ]);
    }

    public static function recordCheckout(PDO $db, string $userId, string $version): void
    {
        self::record($db, $userId, 'checkout_adhesion_terms', $version, 'checkout_payment');
    }
}
