<?php

declare(strict_types=1);

/**
 * Resolve as versoes legais ativas a partir do contrato versionado compartilhado.
 * O backend nunca aceita uma versao enviada pelo cliente sem comparar com esta fonte.
 */
final class LegalDocumentVersion
{
    private const CONTRACT_PATH = __DIR__ . '/../../../contracts/legal/legal-document-versions.v1.json';

    /** @var array<string, array{version: string, effectiveDate: string}>|null */
    private static ?array $documents = null;

    public static function version(string $documentType): string
    {
        return self::document($documentType)['version'];
    }

    public static function effectiveDate(string $documentType): string
    {
        return self::document($documentType)['effectiveDate'];
    }

    /**
     * @return array{version: string, effectiveDate: string}
     */
    private static function document(string $documentType): array
    {
        $documents = self::loadDocuments();
        if (!isset($documents[$documentType])) {
            throw new InvalidArgumentException('Documento legal nao suportado.');
        }

        return $documents[$documentType];
    }

    /**
     * @return array<string, array{version: string, effectiveDate: string}>
     */
    private static function loadDocuments(): array
    {
        if (self::$documents !== null) {
            return self::$documents;
        }

        if (!is_file(self::CONTRACT_PATH)) {
            throw new RuntimeException('Contrato de versoes legais ausente.');
        }

        $decoded = json_decode((string) file_get_contents(self::CONTRACT_PATH), true);
        $documents = is_array($decoded['documents'] ?? null) ? $decoded['documents'] : null;
        if (!is_array($documents)) {
            throw new RuntimeException('Contrato de versoes legais invalido.');
        }

        $normalized = [];
        foreach ($documents as $documentType => $document) {
            $version = trim((string) ($document['version'] ?? ''));
            $effectiveDate = trim((string) ($document['effectiveDate'] ?? ''));
            if ($version === '' || !preg_match('/^\d{4}\.\d{2}$/', $version) || !preg_match('/^\d{4}-\d{2}-\d{2}$/', $effectiveDate)) {
                throw new RuntimeException('Contrato de versoes legais contem registro invalido.');
            }
            $normalized[(string) $documentType] = [
                'version' => $version,
                'effectiveDate' => $effectiveDate,
            ];
        }

        return self::$documents = $normalized;
    }
}
