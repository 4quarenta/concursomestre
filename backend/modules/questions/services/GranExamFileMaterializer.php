<?php

declare(strict_types=1);

require_once dirname(__DIR__, 3) . '/shared/storage/ObjectStorage.php';

/**
 * Copies official Gran exam documents into the platform object storage.
 *
 * The ingestion queue may contain short-lived public download links, but the
 * canonical exam only receives URLs owned by ConcursoMestre.
 */
final class GranExamFileMaterializer
{
    private const ALLOWED_HOST = 'arquivos.infra-questoes.grancursosonline.com.br';
    private const MAX_FILE_BYTES = 104_857_600;
    private const MAX_FILES_PER_EXAM = 3;

    /** @var null|Closure(string,int):array{temporaryPath:string,mimeType:string,size:int,sha256:string} */
    private ?Closure $downloader;

    /** @var null|Closure(string,string,string):array{storageKey:string,url:string,driver:string,size:int} */
    private ?Closure $storageWriter;

    public function __construct(
        ?Closure $downloader = null,
        ?Closure $storageWriter = null
    ) {
        $this->downloader = $downloader;
        $this->storageWriter = $storageWriter;
    }

    public function materialize(array $payload): array
    {
        $exam = is_array($payload['exam'] ?? null) ? $payload['exam'] : [];
        $files = is_array($exam['files'] ?? null) ? $exam['files'] : [];
        if ($files === []) {
            return $payload;
        }
        if (count($files) > self::MAX_FILES_PER_EXAM) {
            throw new InvalidArgumentException('Uma prova Gran pode materializar somente edital, prova e gabarito.');
        }

        $externalExamId = $this->safeIdentifier(
            (string) ($exam['externalId'] ?? $exam['sourceKey'] ?? 'gran-exam')
        );
        $materialized = [];
        foreach ($files as $file) {
            if (!is_array($file)) {
                continue;
            }
            $existingUrl = trim((string) ($file['url'] ?? ''));
            $sourceUrl = trim((string) ($file['sourceUrl'] ?? ''));
            if ($sourceUrl === '') {
                if ($existingUrl !== '') {
                    $materialized[] = $file;
                }
                continue;
            }

            $kind = strtolower(trim((string) ($file['kind'] ?? '')));
            if (!in_array($kind, ['edital', 'prova', 'gabarito'], true)) {
                throw new InvalidArgumentException('Tipo de documento Gran nao permitido.');
            }
            $this->assertAllowedSourceUrl($sourceUrl);
            $download = $this->download($sourceUrl);
            $temporaryPath = $download['temporaryPath'];

            try {
                $storageKey = sprintf(
                    'exams/gran/%s/%s-%s.pdf',
                    $externalExamId,
                    $kind,
                    substr($download['sha256'], 0, 20)
                );
                $stored = $this->store(
                    $temporaryPath,
                    $storageKey,
                    $download['mimeType']
                );
                $materialized[] = [
                    'kind' => $kind,
                    'name' => trim((string) ($file['name'] ?? ucfirst($kind))) ?: ucfirst($kind),
                    'url' => $stored['url'],
                    'mimeType' => $download['mimeType'],
                    'size' => $stored['size'],
                    'storageKey' => $stored['storageKey'],
                    'storageDriver' => $stored['driver'],
                    'sourceProvider' => 'gran',
                    'sourceExternalExamId' => (string) ($exam['externalId'] ?? ''),
                    'sourceUrlHash' => hash('sha256', $sourceUrl),
                    'importedAt' => gmdate('c'),
                ];
            } finally {
                if (is_file($temporaryPath)) {
                    @unlink($temporaryPath);
                }
            }
        }

        $payload['exam'] = array_merge($exam, ['files' => $materialized]);
        return $payload;
    }

    private function assertAllowedSourceUrl(string $sourceUrl): void
    {
        if (strlen($sourceUrl) > 8_000 || preg_match('/[\r\n]/', $sourceUrl) === 1) {
            throw new InvalidArgumentException('URL de documento Gran invalida.');
        }
        $parts = parse_url($sourceUrl);
        $scheme = strtolower((string) ($parts['scheme'] ?? ''));
        $host = strtolower((string) ($parts['host'] ?? ''));
        $port = isset($parts['port']) ? (int) $parts['port'] : 443;
        if (
            $scheme !== 'https'
            || $host !== self::ALLOWED_HOST
            || $port !== 443
            || isset($parts['user'])
            || isset($parts['pass'])
            || isset($parts['fragment'])
            || trim((string) ($parts['path'] ?? '')) === ''
        ) {
            throw new InvalidArgumentException('O documento nao pertence ao host oficial de arquivos da Gran.');
        }
    }

    /** @return array{temporaryPath:string,mimeType:string,size:int,sha256:string} */
    private function download(string $sourceUrl): array
    {
        if ($this->downloader !== null) {
            $result = ($this->downloader)($sourceUrl, self::MAX_FILE_BYTES);
            try {
                return $this->validateDownloadedFile($result);
            } catch (Throwable $exception) {
                $temporaryPath = (string) ($result['temporaryPath'] ?? '');
                if (is_file($temporaryPath)) {
                    @unlink($temporaryPath);
                }
                throw $exception;
            }
        }
        if (!function_exists('curl_init')) {
            throw new RuntimeException('Extensao cURL obrigatoria para copiar documentos da Gran.');
        }

        $temporaryPath = tempnam(sys_get_temp_dir(), 'cm-gran-exam-');
        $stream = $temporaryPath !== false ? fopen($temporaryPath, 'wb') : false;
        if ($temporaryPath === false || $stream === false) {
            throw new RuntimeException('Nao foi possivel preparar o download do documento da prova.');
        }

        $bytes = 0;
        $tooLarge = false;
        $handle = curl_init($sourceUrl);
        curl_setopt_array($handle, [
            CURLOPT_FOLLOWLOCATION => false,
            CURLOPT_PROTOCOLS => CURLPROTO_HTTPS,
            CURLOPT_CONNECTTIMEOUT => 10,
            CURLOPT_TIMEOUT => 120,
            CURLOPT_FAILONERROR => false,
            CURLOPT_HTTPHEADER => ['Accept: application/pdf'],
            CURLOPT_USERAGENT => 'ConcursoMestre-ExamImporter/1.0',
            CURLOPT_WRITEFUNCTION => static function ($curl, string $chunk) use (
                $stream,
                &$bytes,
                &$tooLarge
            ): int {
                $length = strlen($chunk);
                $bytes += $length;
                if ($bytes > self::MAX_FILE_BYTES) {
                    $tooLarge = true;
                    return 0;
                }
                $written = fwrite($stream, $chunk);
                return $written === false ? 0 : $written;
            },
        ]);
        $ok = curl_exec($handle);
        $status = (int) curl_getinfo($handle, CURLINFO_RESPONSE_CODE);
        $contentType = trim((string) curl_getinfo($handle, CURLINFO_CONTENT_TYPE));
        $error = curl_error($handle);
        curl_close($handle);
        fclose($stream);

        if ($tooLarge) {
            @unlink($temporaryPath);
            throw new RuntimeException('Documento Gran excede o limite de 100 MB.');
        }
        if ($ok === false || $error !== '' || $status < 200 || $status >= 300) {
            @unlink($temporaryPath);
            throw new RuntimeException('Nao foi possivel copiar o documento Gran (HTTP ' . $status . ').');
        }

        try {
            return $this->validateDownloadedFile([
                'temporaryPath' => $temporaryPath,
                'mimeType' => $contentType,
                'size' => $bytes,
                'sha256' => (string) hash_file('sha256', $temporaryPath),
            ]);
        } catch (Throwable $exception) {
            @unlink($temporaryPath);
            throw $exception;
        }
    }

    /** @return array{temporaryPath:string,mimeType:string,size:int,sha256:string} */
    private function validateDownloadedFile(array $result): array
    {
        $temporaryPath = (string) ($result['temporaryPath'] ?? '');
        $size = (int) ($result['size'] ?? 0);
        if (
            $temporaryPath === ''
            || !is_file($temporaryPath)
            || $size < 5
            || $size > self::MAX_FILE_BYTES
        ) {
            throw new RuntimeException('Documento Gran baixado e invalido.');
        }
        $magic = (string) file_get_contents($temporaryPath, false, null, 0, 5);
        $finfo = new finfo(FILEINFO_MIME_TYPE);
        $detectedMime = strtolower((string) $finfo->file($temporaryPath));
        if ($magic !== '%PDF-' || $detectedMime !== 'application/pdf') {
            throw new RuntimeException('O arquivo remoto nao e um PDF valido.');
        }

        return [
            'temporaryPath' => $temporaryPath,
            'mimeType' => 'application/pdf',
            'size' => $size,
            'sha256' => (string) ($result['sha256'] ?? hash_file('sha256', $temporaryPath)),
        ];
    }

    /** @return array{storageKey:string,url:string,driver:string,size:int} */
    private function store(string $temporaryPath, string $storageKey, string $mimeType): array
    {
        if ($this->storageWriter !== null) {
            return ($this->storageWriter)($temporaryPath, $storageKey, $mimeType);
        }
        return (new ObjectStorage())->storeUploadedFile($temporaryPath, $storageKey, $mimeType);
    }

    private function safeIdentifier(string $value): string
    {
        $normalized = preg_replace('/[^a-zA-Z0-9_-]+/', '-', trim($value));
        $normalized = trim((string) $normalized, '-_');
        return $normalized !== '' ? substr($normalized, 0, 80) : 'gran-exam';
    }
}
