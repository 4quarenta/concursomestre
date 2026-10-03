<?php

declare(strict_types=1);

require_once dirname(__DIR__, 3) . '/shared/storage/ObjectStorage.php';

/**
 * Materializes Gran question, context and alternative images in platform storage.
 *
 * Remote URLs are input-only. Canonical question assets always receive an URL
 * owned by ConcursoMestre and a deterministic content-addressed storage key.
 */
final class GranQuestionAssetMaterializer
{
    private const ALLOWED_HOST = 'arquivos.infra-questoes.grancursosonline.com.br';
    private const MAX_IMAGE_BYTES = 12_582_912;
    private const MAX_INLINE_IMAGE_BASE64_BYTES = 16_777_472;
    private const MAX_ASSETS_PER_PAYLOAD = 5_000;
    private const MAX_DOWNLOAD_ATTEMPTS = 3;

    /** @var null|Closure(string,int):array{temporaryPath:string,mimeType?:string,size:int,sha256?:string} */
    private ?Closure $downloader;

    /** @var null|Closure(string,string,string):array{storageKey:string,url:string,driver:string,size:int} */
    private ?Closure $storageWriter;

    private ObjectStorage $storage;

    /** @var array<string,array<string,mixed>> */
    private array $materializedBySourceUrl = [];

    /** @var array<string,array<string,mixed>> */
    private array $materializedByContentHash = [];

    public function __construct(
        ?Closure $downloader = null,
        ?Closure $storageWriter = null,
        ?ObjectStorage $storage = null
    ) {
        $this->downloader = $downloader;
        $this->storageWriter = $storageWriter;
        $this->storage = $storage ?? new ObjectStorage();
    }

    public function materialize(array $payload): array
    {
        $assetCount = 0;
        $strictGranPayload = $this->isGranPayload($payload);

        if (isset($payload['contexts']) && is_array($payload['contexts'])) {
            foreach ($payload['contexts'] as $index => $context) {
                if (!is_array($context)) {
                    continue;
                }
                $context['assets'] = $this->materializeCollection(
                    $context['assets'] ?? [],
                    $strictGranPayload,
                    $assetCount
                );
                $payload['contexts'][$index] = $context;
            }
        }

        if (isset($payload['questions']) && is_array($payload['questions'])) {
            foreach ($payload['questions'] as $questionIndex => $question) {
                if (!is_array($question)) {
                    continue;
                }
                $questionIsGran = $strictGranPayload || $this->questionUsesGranSource($question);
                $question['assets'] = $this->materializeCollection(
                    $question['assets'] ?? [],
                    $questionIsGran,
                    $assetCount
                );
                foreach (['alternatives', 'options', 'itens'] as $alternativesKey) {
                    if (!isset($question[$alternativesKey]) || !is_array($question[$alternativesKey])) {
                        continue;
                    }
                    foreach ($question[$alternativesKey] as $alternativeIndex => $alternative) {
                        if (!is_array($alternative)) {
                            continue;
                        }
                        $alternative['assets'] = $this->materializeCollection(
                            $alternative['assets'] ?? [],
                            $questionIsGran,
                            $assetCount
                        );
                        $question[$alternativesKey][$alternativeIndex] = $alternative;
                    }
                }
                $payload['questions'][$questionIndex] = $question;
            }
        }

        return $payload;
    }

    /**
     * Materializa assets durante a ingestao em lote sem permitir que um unico
     * bloqueio remoto da Gran interrompa todas as demais questoes do job.
     *
     * Falhas HTTP de download sao isoladas na questao afetada. Falhas de
     * storage, contrato ou infraestrutura local continuam sendo propagadas.
     *
     * @return array{payload:array<string,mixed>,itemFailures:array<int,array<string,mixed>>,assetWarnings:array<int,array<string,mixed>>}
     */
    public function materializeForIngestion(array $payload): array
    {
        $assetCount = 0;
        $strictGranPayload = $this->isGranPayload($payload);
        $materializedContexts = [];
        $assetWarnings = [];

        foreach (is_array($payload['contexts'] ?? null) ? $payload['contexts'] : [] as $context) {
            if (!is_array($context)) {
                continue;
            }
            $contextId = trim((string) ($context['tempId'] ?? $context['id'] ?? $context['contextKey'] ?? ''));
            $failedAssets = [];
            $context['assets'] = $this->materializeCollectionBestEffort(
                $context['assets'] ?? [],
                $strictGranPayload,
                $assetCount,
                $failedAssets
            );
            $failedTempIds = $this->failedAssetTempIds($failedAssets);
            if ($failedTempIds !== []) {
                $context = $this->replaceFailedAssetMarkers($context, $failedTempIds);
            }
            foreach ($failedAssets as $failure) {
                $assetWarnings[] = $this->buildAssetWarning($context, $contextId, 'context', $failure);
            }
            $materializedContexts[] = $context;
        }
        $payload['contexts'] = $materializedContexts;

        $materializedQuestions = [];
        foreach (is_array($payload['questions'] ?? null) ? $payload['questions'] : [] as $question) {
            if (!is_array($question)) {
                continue;
            }
            $failedAssets = [];
            $materializedQuestion = $this->materializeQuestionBestEffort(
                $question,
                $strictGranPayload,
                $assetCount,
                $failedAssets
            );
            $failedTempIds = $this->failedAssetTempIds($failedAssets);
            if ($failedTempIds !== []) {
                $materializedQuestion = $this->replaceFailedAssetMarkers($materializedQuestion, $failedTempIds);
            }
            foreach ($failedAssets as $failure) {
                $assetWarnings[] = $this->buildAssetWarning($question, '', 'question', $failure);
            }
            $materializedQuestions[] = $materializedQuestion;
        }
        $payload['questions'] = $materializedQuestions;

        return [
            'payload' => $payload,
            'itemFailures' => [],
            'assetWarnings' => $assetWarnings,
        ];
    }

    /** @return array<string,mixed> */
    public function materializeAsset(array $asset, bool $strictGranSource = true): array
    {
        $sourceUrl = trim((string) ($asset['url'] ?? $asset['sourceUrl'] ?? ''));
        if ($sourceUrl !== '' && $this->isRemoteUrl($sourceUrl) && !$this->isAllowedSourceUrl($sourceUrl)) {
            if ($this->storage->storageKeyFromPublicUrl($sourceUrl) !== null) {
                return $asset;
            }
            if ($strictGranSource) {
                throw new InvalidArgumentException('Asset Gran aponta para um host externo nao autorizado.');
            }
            return $asset;
        }

        $inlineImage = $this->decodeInlineImage($asset);
        if ($inlineImage !== null) {
            $contentKey = 'content:' . $inlineImage['sha256'];
            if (isset($this->materializedByContentHash[$contentKey])) {
                @unlink($inlineImage['temporaryPath']);
                return $this->mergeMaterializedAsset($asset, $this->materializedByContentHash[$contentKey]);
            }
            return $this->materializeDownloadedAsset($asset, $inlineImage, $contentKey, $sourceUrl);
        }

        if ($sourceUrl === '' || str_starts_with(strtolower($sourceUrl), 'data:image/')) {
            return $asset;
        }

        if (!$this->isRemoteUrl($sourceUrl)) {
            return $asset;
        }
        if (($asset['captureStatus'] ?? null) === 'failed') {
            $reason = trim((string) ($asset['captureError'] ?? 'A extensao nao conseguiu capturar esta imagem.'));
            throw new RuntimeException('Imagem Gran indisponivel na extensao: ' . $reason);
        }

        if (isset($this->materializedBySourceUrl[$sourceUrl])) {
            return $this->mergeMaterializedAsset($asset, $this->materializedBySourceUrl[$sourceUrl]);
        }

        $download = $this->downloadWithRetry($sourceUrl);
        return $this->materializeDownloadedAsset($asset, $download, 'source:' . $sourceUrl, $sourceUrl);
    }

    /** @param array{temporaryPath:string,mimeType:string,size:int,sha256:string,extension:string} $download */
    private function materializeDownloadedAsset(
        array $asset,
        array $download,
        string $cacheKey,
        string $sourceUrl = ''
    ): array
    {
        $temporaryPath = $download['temporaryPath'];
        try {
            $storageKey = sprintf(
                'question-assets/gran/%s/%s.%s',
                substr($download['sha256'], 0, 2),
                $download['sha256'],
                $download['extension']
            );
            $stored = $this->store($temporaryPath, $storageKey, $download['mimeType']);
            $materialized = [
                'url' => $stored['url'],
                'storagePath' => $stored['storageKey'],
                'mimeType' => $download['mimeType'],
                'size' => $stored['size'],
                'storageDriver' => $stored['driver'],
                'sourceProvider' => 'gran',
                'sourceUrlHash' => $sourceUrl !== '' ? hash('sha256', $sourceUrl) : null,
                'status' => 'materialized',
                'materializedAt' => gmdate('c'),
            ];
            if ($sourceUrl !== '') {
                $this->materializedBySourceUrl[$sourceUrl] = $materialized;
            }
            $this->materializedByContentHash[$cacheKey] = $materialized;
            return $this->mergeMaterializedAsset($asset, $materialized);
        } finally {
            if (is_file($temporaryPath)) {
                @unlink($temporaryPath);
            }
        }
    }

    private function materializeCollection(mixed $assets, bool $strictGranSource, int &$assetCount): array
    {
        if (!is_array($assets)) {
            return [];
        }
        $materialized = [];
        foreach ($assets as $asset) {
            if (!is_array($asset)) {
                continue;
            }
            $assetCount++;
            if ($assetCount > self::MAX_ASSETS_PER_PAYLOAD) {
                throw new InvalidArgumentException('O lote excede o limite de 5.000 assets de questao.');
            }
            $materialized[] = $this->materializeAsset($asset, $strictGranSource);
        }
        return $materialized;
    }

    /**
     * Isola falhas conhecidas de transferencia/validacao de imagem como avisos
     * do asset. Falhas de storage, limites do lote e contrato continuam sendo
     * fatais para o job.
     *
     * @param array<int,array<string,mixed>> $failures
     * @return array<int,array<string,mixed>>
     */
    private function materializeCollectionBestEffort(
        mixed $assets,
        bool $strictGranSource,
        int &$assetCount,
        array &$failures
    ): array {
        if (!is_array($assets)) {
            return [];
        }

        $materialized = [];
        foreach ($assets as $asset) {
            if (!is_array($asset)) {
                continue;
            }
            $assetCount++;
            if ($assetCount > self::MAX_ASSETS_PER_PAYLOAD) {
                throw new InvalidArgumentException('O lote excede o limite de 5.000 assets de questao.');
            }
            try {
                $materialized[] = $this->materializeAsset($asset, $strictGranSource);
            } catch (Throwable $exception) {
                if (!$this->isGranImageTransferFailure($exception)) {
                    throw $exception;
                }
                $failures[] = [
                    'tempId' => trim((string) ($asset['tempId'] ?? '')) ?: null,
                    'message' => $exception->getMessage(),
                ];
            }
        }

        return $materialized;
    }

    /** @param array<int,array<string,mixed>> $failures */
    private function materializeQuestionBestEffort(
        array $question,
        bool $strictGranPayload,
        int &$assetCount,
        array &$failures
    ): array {
        $questionIsGran = $strictGranPayload || $this->questionUsesGranSource($question);
        $question['assets'] = $this->materializeCollectionBestEffort(
            $question['assets'] ?? [],
            $questionIsGran,
            $assetCount,
            $failures
        );
        foreach (['alternatives', 'options', 'itens'] as $alternativesKey) {
            if (!isset($question[$alternativesKey]) || !is_array($question[$alternativesKey])) {
                continue;
            }
            foreach ($question[$alternativesKey] as $alternativeIndex => $alternative) {
                if (!is_array($alternative)) {
                    continue;
                }
                $alternative['assets'] = $this->materializeCollectionBestEffort(
                    $alternative['assets'] ?? [],
                    $questionIsGran,
                    $assetCount,
                    $failures
                );
                $question[$alternativesKey][$alternativeIndex] = $alternative;
            }
        }

        return $question;
    }

    /** @param array<int,array<string,mixed>> $failures @return list<string> */
    private function failedAssetTempIds(array $failures): array
    {
        $ids = [];
        foreach ($failures as $failure) {
            $tempId = trim((string) ($failure['tempId'] ?? ''));
            if ($tempId !== '') {
                $ids[$tempId] = true;
            }
        }
        return array_keys($ids);
    }

    private function replaceFailedAssetMarkers(mixed $value, array $failedTempIds): mixed
    {
        if (is_array($value)) {
            foreach ($value as $key => $item) {
                $value[$key] = $this->replaceFailedAssetMarkers($item, $failedTempIds);
            }
            return $value;
        }
        if (!is_string($value) || $failedTempIds === []) {
            return $value;
        }

        foreach ($failedTempIds as $tempId) {
            $value = str_replace('[image:' . $tempId . ']', '[Imagem indisponivel na fonte]', $value);
        }
        return $value;
    }

    /** @param array<string,mixed> $owner @param array<string,mixed> $failure */
    private function buildAssetWarning(array $owner, string $contextId, string $scope, array $failure): array
    {
        $source = is_array($owner['source'] ?? null) ? $owner['source'] : [];
        $message = trim((string) ($failure['message'] ?? 'Imagem Gran indisponivel.'));
        return [
            'scope' => $scope,
            'contextTempId' => $contextId !== '' ? $contextId : null,
            'questionNumber' => trim((string) ($source['questionNumber'] ?? '')) ?: null,
            'tempId' => trim((string) ($owner['tempId'] ?? '')) ?: null,
            'assetTempId' => trim((string) ($failure['tempId'] ?? '')) ?: null,
            'code' => str_contains($message, '(HTTP 403)')
                ? 'gran_image_forbidden'
                : 'gran_image_copy_warning',
            'message' => $message,
        ];
    }

    private function materializeQuestion(array $question, bool $strictGranPayload, int &$assetCount): array
    {
        $questionIsGran = $strictGranPayload || $this->questionUsesGranSource($question);
        $question['assets'] = $this->materializeCollection(
            $question['assets'] ?? [],
            $questionIsGran,
            $assetCount
        );
        foreach (['alternatives', 'options', 'itens'] as $alternativesKey) {
            if (!isset($question[$alternativesKey]) || !is_array($question[$alternativesKey])) {
                continue;
            }
            foreach ($question[$alternativesKey] as $alternativeIndex => $alternative) {
                if (!is_array($alternative)) {
                    continue;
                }
                $alternative['assets'] = $this->materializeCollection(
                    $alternative['assets'] ?? [],
                    $questionIsGran,
                    $assetCount
                );
                $question[$alternativesKey][$alternativeIndex] = $alternative;
            }
        }
        return $question;
    }

    /** @return array{questionNumber:null|string,tempId:null|string,code:string,message:string} */
    private function buildQuestionFailure(array $question, string $message): array
    {
        $source = is_array($question['source'] ?? null) ? $question['source'] : [];
        return [
            'questionNumber' => trim((string) ($source['questionNumber'] ?? '')) ?: null,
            'tempId' => trim((string) ($question['tempId'] ?? '')) ?: null,
            'code' => str_contains($message, '(HTTP 403)')
                ? 'gran_image_forbidden'
                : 'gran_image_copy_failed',
            'message' => $message,
        ];
    }

    /** @return array<int,string> */
    private function normalizeQuestionNumbers(mixed $numbers): array
    {
        if (!is_array($numbers)) {
            return [];
        }
        $normalized = [];
        foreach ($numbers as $number) {
            $value = trim((string) $number);
            if ($value !== '') {
                $normalized[$value] = true;
            }
        }
        return array_keys($normalized);
    }

    private function isGranImageTransferFailure(Throwable $exception): bool
    {
        $message = trim($exception->getMessage());
        if (preg_match('/^Nao foi possivel copiar a imagem Gran \\(HTTP (?:0|[1-5][0-9]{2})\\)\\.?$/', $message) === 1) {
            return true;
        }

        return str_starts_with($message, 'Imagem Gran indisponivel na extensao:')
            || $message === 'O asset remoto da Gran nao e uma imagem valida.'
            || $message === 'Formato de imagem Gran nao permitido.'
            || $message === 'Imagem Gran baixada e invalida.'
            || $message === 'Asset Gran aponta para um host externo nao autorizado.';
    }

    private function isRetryableGranImageTransferFailure(Throwable $exception): bool
    {
        if (preg_match('/HTTP (0|[1-5][0-9]{2})/', $exception->getMessage(), $matches) !== 1) {
            return false;
        }
        $status = (int) $matches[1];
        return $status === 0
            || in_array($status, [408, 425, 429], true)
            || $status >= 500;
    }

    /** @return array{temporaryPath:string,mimeType:string,size:int,sha256:string,extension:string} */
    private function downloadWithRetry(string $sourceUrl): array
    {
        for ($attempt = 1; ; $attempt++) {
            try {
                return $this->download($sourceUrl);
            } catch (Throwable $exception) {
                if (!$this->isRetryableGranImageTransferFailure($exception)
                    || $attempt >= self::MAX_DOWNLOAD_ATTEMPTS) {
                    throw $exception;
                }
                usleep(200_000 * $attempt);
            }
        }
    }

    private function mergeMaterializedAsset(array $asset, array $materialized): array
    {
        unset(
            $asset['sourceUrl'],
            $asset['source_url'],
            $asset['base64'],
            $asset['captureStatus'],
            $asset['captureError']
        );
        return array_merge($asset, $materialized);
    }

    /** @return null|array{temporaryPath:string,mimeType:string,size:int,sha256:string,extension:string} */
    private function decodeInlineImage(array $asset): ?array
    {
        $base64 = trim((string) ($asset['base64'] ?? ''));
        if ($base64 === '') {
            return null;
        }
        if (strlen($base64) > self::MAX_INLINE_IMAGE_BASE64_BYTES) {
            throw new RuntimeException('Imagem capturada pela extensao excede o limite de 12 MB.');
        }
        if (preg_match('#^data:image/[a-z0-9.+-]+;base64,#i', $base64) === 1) {
            $base64 = (string) preg_replace('#^data:image/[a-z0-9.+-]+;base64,#i', '', $base64, 1);
        }
        $base64 = preg_replace('/\s+/', '', $base64) ?? '';
        $binary = base64_decode($base64, true);
        if (!is_string($binary) || $binary === '' || strlen($binary) > self::MAX_IMAGE_BYTES) {
            throw new RuntimeException('Imagem capturada pela extensao e invalida.');
        }
        $temporaryPath = tempnam(sys_get_temp_dir(), 'cm-gran-inline-image-');
        if ($temporaryPath === false || file_put_contents($temporaryPath, $binary) === false) {
            if ($temporaryPath !== false) {
                @unlink($temporaryPath);
            }
            throw new RuntimeException('Nao foi possivel preparar a imagem capturada pela extensao.');
        }
        try {
            return $this->validateDownloadedImage([
                'temporaryPath' => $temporaryPath,
                'size' => strlen($binary),
                'sha256' => hash('sha256', $binary),
            ]);
        } catch (Throwable $exception) {
            @unlink($temporaryPath);
            throw $exception;
        }
    }

    private function isGranPayload(array $payload): bool
    {
        $import = is_array($payload['import'] ?? null) ? $payload['import'] : [];
        $sourceType = strtolower(trim((string) ($import['sourceType'] ?? $import['source_type'] ?? '')));
        $mode = strtolower(trim((string) ($import['extractionMode'] ?? $import['extraction_mode'] ?? '')));
        return $sourceType === 'authorized_admin_collection'
            || $mode === 'gran_browser_extension'
            || str_contains($sourceType, 'gran');
    }

    private function questionUsesGranSource(array $question): bool
    {
        $source = is_array($question['source'] ?? null) ? $question['source'] : [];
        return strtolower(trim((string) ($source['provider'] ?? $source['sourceProvider'] ?? ''))) === 'gran';
    }

    private function isRemoteUrl(string $url): bool
    {
        return preg_match('#^https?://#i', $url) === 1;
    }

    private function isAllowedSourceUrl(string $sourceUrl): bool
    {
        if (strlen($sourceUrl) > 8_000 || preg_match('/[\r\n]/', $sourceUrl) === 1) {
            return false;
        }
        $parts = parse_url($sourceUrl);
        return strtolower((string) ($parts['scheme'] ?? '')) === 'https'
            && strtolower((string) ($parts['host'] ?? '')) === self::ALLOWED_HOST
            && (!isset($parts['port']) || (int) $parts['port'] === 443)
            && !isset($parts['user'])
            && !isset($parts['pass'])
            && !isset($parts['fragment'])
            && trim((string) ($parts['path'] ?? '')) !== '';
    }

    /** @return array{temporaryPath:string,mimeType:string,size:int,sha256:string,extension:string} */
    private function download(string $sourceUrl): array
    {
        if ($this->downloader !== null) {
            $result = ($this->downloader)($sourceUrl, self::MAX_IMAGE_BYTES);
            try {
                return $this->validateDownloadedImage($result);
            } catch (Throwable $exception) {
                $temporaryPath = trim((string) ($result['temporaryPath'] ?? ''));
                if (is_file($temporaryPath)) {
                    @unlink($temporaryPath);
                }
                throw $exception;
            }
        }
        if (!function_exists('curl_init')) {
            throw new RuntimeException('Extensao cURL obrigatoria para copiar imagens da Gran.');
        }

        $temporaryPath = tempnam(sys_get_temp_dir(), 'cm-gran-image-');
        $stream = $temporaryPath !== false ? fopen($temporaryPath, 'wb') : false;
        if ($temporaryPath === false || $stream === false) {
            throw new RuntimeException('Nao foi possivel preparar o download da imagem Gran.');
        }

        $bytes = 0;
        $tooLarge = false;
        $handle = curl_init($sourceUrl);
        curl_setopt_array($handle, [
            CURLOPT_FOLLOWLOCATION => false,
            CURLOPT_PROTOCOLS => CURLPROTO_HTTPS,
            CURLOPT_CONNECTTIMEOUT => 10,
            CURLOPT_TIMEOUT => 60,
            CURLOPT_FAILONERROR => false,
            CURLOPT_HTTPHEADER => ['Accept: image/avif,image/webp,image/png,image/jpeg,image/gif,image/bmp'],
            CURLOPT_USERAGENT => 'ConcursoMestre-QuestionAssetImporter/1.0',
            CURLOPT_WRITEFUNCTION => static function ($curl, string $chunk) use ($stream, &$bytes, &$tooLarge): int {
                $length = strlen($chunk);
                $bytes += $length;
                if ($bytes > self::MAX_IMAGE_BYTES) {
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
            throw new RuntimeException('Imagem Gran excede o limite de 12 MB.');
        }
        if ($ok === false || $error !== '' || $status < 200 || $status >= 300) {
            @unlink($temporaryPath);
            throw new RuntimeException('Nao foi possivel copiar a imagem Gran (HTTP ' . $status . ').');
        }

        try {
            return $this->validateDownloadedImage([
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

    /** @return array{temporaryPath:string,mimeType:string,size:int,sha256:string,extension:string} */
    private function validateDownloadedImage(array $result): array
    {
        $temporaryPath = trim((string) ($result['temporaryPath'] ?? ''));
        $size = (int) ($result['size'] ?? 0);
        if ($temporaryPath === '' || !is_file($temporaryPath) || $size < 16 || $size > self::MAX_IMAGE_BYTES) {
            throw new RuntimeException('Imagem Gran baixada e invalida.');
        }

        $imageInfo = @getimagesize($temporaryPath);
        if (!is_array($imageInfo)) {
            throw new RuntimeException('O asset remoto da Gran nao e uma imagem valida.');
        }
        $imageType = (int) ($imageInfo[2] ?? 0);
        $formats = [
            IMAGETYPE_JPEG => ['mimeType' => 'image/jpeg', 'extension' => 'jpg'],
            IMAGETYPE_PNG => ['mimeType' => 'image/png', 'extension' => 'png'],
            IMAGETYPE_GIF => ['mimeType' => 'image/gif', 'extension' => 'gif'],
            IMAGETYPE_BMP => ['mimeType' => 'image/bmp', 'extension' => 'bmp'],
        ];
        if (defined('IMAGETYPE_WEBP')) {
            $formats[IMAGETYPE_WEBP] = ['mimeType' => 'image/webp', 'extension' => 'webp'];
        }
        if (defined('IMAGETYPE_AVIF')) {
            $formats[IMAGETYPE_AVIF] = ['mimeType' => 'image/avif', 'extension' => 'avif'];
        }
        if (!isset($formats[$imageType])) {
            throw new RuntimeException('Formato de imagem Gran nao permitido.');
        }

        return [
            'temporaryPath' => $temporaryPath,
            'mimeType' => $formats[$imageType]['mimeType'],
            'size' => $size,
            'sha256' => preg_match('/^[a-f0-9]{64}$/', trim((string) ($result['sha256'] ?? ''))) === 1
                ? trim((string) $result['sha256'])
                : (string) hash_file('sha256', $temporaryPath),
            'extension' => $formats[$imageType]['extension'],
        ];
    }

    /** @return array{storageKey:string,url:string,driver:string,size:int} */
    private function store(string $temporaryPath, string $storageKey, string $mimeType): array
    {
        if ($this->storageWriter !== null) {
            return ($this->storageWriter)($temporaryPath, $storageKey, $mimeType);
        }
        if ($this->storage->exists($storageKey) === true) {
            return [
                'storageKey' => $storageKey,
                'url' => $this->storage->publicUrl($storageKey),
                'driver' => $this->storage->driver(),
                'size' => (int) filesize($temporaryPath),
            ];
        }
        return $this->storage->storeUploadedFile($temporaryPath, $storageKey, $mimeType);
    }
}
