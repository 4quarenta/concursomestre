<?php

declare(strict_types=1);

require_once dirname(__DIR__, 2) . '/config/env.php';

/**
 * Single storage boundary for public assets and large uploaded documents.
 *
 * The local driver preserves the existing deployment. The s3 driver supports
 * AWS S3, Cloudflare R2 and other Signature V4 compatible providers without
 * coupling domain services to a vendor SDK.
 */
final class ObjectStorage
{
    private string $driver;
    private string $localRoot;
    private string $publicBaseUrl;
    private string $endpoint;
    private string $region;
    private string $bucket;
    private string $accessKey;
    private string $secretKey;
    private bool $pathStyle;

    public function __construct(?array $config = null)
    {
        $config ??= [];
        $this->driver = strtolower(trim((string) ($config['driver'] ?? getEnvString('OBJECT_STORAGE_DRIVER', 'local'))));
        if (!in_array($this->driver, ['local', 's3'], true)) {
            throw new RuntimeException('OBJECT_STORAGE_DRIVER deve ser local ou s3.');
        }

        $backendRoot = dirname(__DIR__, 2);
        $this->localRoot = rtrim((string) ($config['localRoot'] ?? getEnvString('OBJECT_STORAGE_LOCAL_ROOT', $backendRoot . '/uploads')), "/\\");
        $this->publicBaseUrl = rtrim((string) ($config['publicBaseUrl'] ?? getEnvString('OBJECT_STORAGE_PUBLIC_BASE_URL', '/uploads')), '/');
        $this->endpoint = rtrim((string) ($config['endpoint'] ?? getEnvString('OBJECT_STORAGE_ENDPOINT')), '/');
        $this->region = (string) ($config['region'] ?? getEnvString('OBJECT_STORAGE_REGION', 'auto'));
        $this->bucket = trim((string) ($config['bucket'] ?? getEnvString('OBJECT_STORAGE_BUCKET')));
        $this->accessKey = trim((string) ($config['accessKey'] ?? getEnvString('OBJECT_STORAGE_ACCESS_KEY')));
        $this->secretKey = trim((string) ($config['secretKey'] ?? getEnvString('OBJECT_STORAGE_SECRET_KEY')));
        $this->pathStyle = (bool) ($config['pathStyle'] ?? filter_var(getEnvString('OBJECT_STORAGE_PATH_STYLE', 'true'), FILTER_VALIDATE_BOOLEAN));

        if ($this->driver === 's3' && ($this->endpoint === '' || $this->bucket === '' || $this->accessKey === '' || $this->secretKey === '' || $this->publicBaseUrl === '')) {
            throw new RuntimeException('Object storage S3/R2 incompleto. Configure endpoint, bucket, credenciais e URL publica.');
        }
    }

    public function driver(): string
    {
        return $this->driver;
    }

    /** @return array{storageKey:string,url:string,driver:string,size:int} */
    public function storeUploadedFile(string $temporaryPath, string $storageKey, string $mimeType): array
    {
        $storageKey = $this->normalizeKey($storageKey);
        $size = (int) (@filesize($temporaryPath) ?: 0);
        if ($temporaryPath === '' || !is_file($temporaryPath) || $size < 1) {
            throw new RuntimeException('Arquivo temporario de upload invalido.');
        }

        if ($this->driver === 'local') {
            $this->storeLocalFile($temporaryPath, $storageKey);
        } else {
            $this->putS3($storageKey, $temporaryPath, $mimeType);
        }

        return [
            'storageKey' => $storageKey,
            'url' => $this->publicUrl($storageKey),
            'driver' => $this->driver,
            'size' => $size,
        ];
    }

    /** @return array{storageKey:string,url:string,driver:string,size:int} */
    public function storeBytes(string $bytes, string $storageKey, string $mimeType): array
    {
        $temporaryPath = tempnam(sys_get_temp_dir(), 'cm-object-');
        if ($temporaryPath === false || file_put_contents($temporaryPath, $bytes, LOCK_EX) === false) {
            throw new RuntimeException('Nao foi possivel preparar o objeto para armazenamento.');
        }

        try {
            return $this->storeUploadedFile($temporaryPath, $storageKey, $mimeType);
        } finally {
            if (is_file($temporaryPath)) {
                @unlink($temporaryPath);
            }
        }
    }

    public function delete(string $storageKey): void
    {
        $storageKey = $this->normalizeKey($storageKey);
        if ($this->driver === 'local') {
            $path = $this->localPath($storageKey);
            if (is_file($path)) {
                @unlink($path);
            }
            return;
        }

        $this->signedS3Request('DELETE', $storageKey, null, 'application/octet-stream');
    }

    public function publicUrl(string $storageKey): string
    {
        return $this->publicBaseUrl . '/' . implode('/', array_map('rawurlencode', explode('/', $this->normalizeKey($storageKey))));
    }

    public function storageKeyFromPublicUrl(string $url): ?string
    {
        $url = trim($url);
        if ($url === '') {
            return null;
        }

        $candidate = $url;
        if (preg_match('#^https?://#i', $candidate)) {
            if (preg_match('#^https?://#i', $this->publicBaseUrl)) {
                if (!str_starts_with($candidate, $this->publicBaseUrl . '/')) {
                    return null;
                }
                $candidate = substr($candidate, strlen($this->publicBaseUrl) + 1);
            } else {
                $candidate = (string) (parse_url($candidate, PHP_URL_PATH) ?? '');
            }
        }

        $relativeBase = preg_match('#^https?://#i', $this->publicBaseUrl)
            ? ''
            : trim($this->publicBaseUrl, '/');
        $candidate = ltrim($candidate, '/');
        if ($relativeBase !== '') {
            if (!str_starts_with($candidate, $relativeBase . '/')) {
                return null;
            }
            $candidate = substr($candidate, strlen($relativeBase) + 1);
        }

        $decoded = implode('/', array_map('rawurldecode', explode('/', $candidate)));
        try {
            return $this->normalizeKey($decoded);
        } catch (InvalidArgumentException) {
            return null;
        }
    }

    private function storeLocalFile(string $source, string $storageKey): void
    {
        $target = $this->localPath($storageKey);
        $directory = dirname($target);
        if (!is_dir($directory) && !mkdir($directory, 0775, true) && !is_dir($directory)) {
            throw new RuntimeException('Nao foi possivel preparar o diretorio de armazenamento.');
        }

        $stored = is_uploaded_file($source) ? move_uploaded_file($source, $target) : @copy($source, $target);
        if (!$stored) {
            throw new RuntimeException('Nao foi possivel armazenar o arquivo enviado.');
        }
        @chmod($target, 0644);
    }

    private function localPath(string $storageKey): string
    {
        return $this->localRoot . DIRECTORY_SEPARATOR . str_replace('/', DIRECTORY_SEPARATOR, $storageKey);
    }

    private function putS3(string $storageKey, string $source, string $mimeType): void
    {
        $this->signedS3Request('PUT', $storageKey, $source, $mimeType);
    }

    private function signedS3Request(string $method, string $storageKey, ?string $source, string $mimeType): void
    {
        if (!function_exists('curl_init')) {
            throw new RuntimeException('Extensao cURL obrigatoria para object storage S3/R2.');
        }

        $timestamp = gmdate('Ymd\THis\Z');
        $date = substr($timestamp, 0, 8);
        $payloadHash = $source !== null ? (string) hash_file('sha256', $source) : hash('sha256', '');
        $endpoint = parse_url($this->endpoint);
        $scheme = (string) ($endpoint['scheme'] ?? 'https');
        $host = (string) ($endpoint['host'] ?? '');
        $basePath = rtrim((string) ($endpoint['path'] ?? ''), '/');
        $encodedKey = implode('/', array_map('rawurlencode', explode('/', $storageKey)));
        if ($this->pathStyle) {
            $canonicalUri = $basePath . '/' . rawurlencode($this->bucket) . '/' . $encodedKey;
        } else {
            $host = $this->bucket . '.' . $host;
            $canonicalUri = $basePath . '/' . $encodedKey;
        }
        $canonicalUri = '/' . ltrim($canonicalUri, '/');
        $canonicalHeaders = "host:{$host}\nx-amz-content-sha256:{$payloadHash}\nx-amz-date:{$timestamp}\n";
        $signedHeaders = 'host;x-amz-content-sha256;x-amz-date';
        $canonicalRequest = implode("\n", [$method, $canonicalUri, '', $canonicalHeaders, $signedHeaders, $payloadHash]);
        $scope = "{$date}/{$this->region}/s3/aws4_request";
        $stringToSign = "AWS4-HMAC-SHA256\n{$timestamp}\n{$scope}\n" . hash('sha256', $canonicalRequest);
        $dateKey = hash_hmac('sha256', $date, 'AWS4' . $this->secretKey, true);
        $regionKey = hash_hmac('sha256', $this->region, $dateKey, true);
        $serviceKey = hash_hmac('sha256', 's3', $regionKey, true);
        $signingKey = hash_hmac('sha256', 'aws4_request', $serviceKey, true);
        $signature = hash_hmac('sha256', $stringToSign, $signingKey);
        $authorization = "AWS4-HMAC-SHA256 Credential={$this->accessKey}/{$scope}, SignedHeaders={$signedHeaders}, Signature={$signature}";

        $handle = curl_init("{$scheme}://{$host}{$canonicalUri}");
        $headers = [
            'Authorization: ' . $authorization,
            'Content-Type: ' . $mimeType,
            'x-amz-content-sha256: ' . $payloadHash,
            'x-amz-date: ' . $timestamp,
        ];
        $options = [
            CURLOPT_CUSTOMREQUEST => $method,
            CURLOPT_HTTPHEADER => $headers,
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_CONNECTTIMEOUT => 5,
            CURLOPT_TIMEOUT => 120,
        ];
        $stream = null;
        if ($source !== null) {
            $stream = fopen($source, 'rb');
            if ($stream === false) {
                throw new RuntimeException('Nao foi possivel abrir o arquivo para object storage.');
            }
            $options[CURLOPT_UPLOAD] = true;
            $options[CURLOPT_INFILE] = $stream;
            $options[CURLOPT_INFILESIZE] = (int) filesize($source);
        }
        curl_setopt_array($handle, $options);
        $response = curl_exec($handle);
        $status = (int) curl_getinfo($handle, CURLINFO_RESPONSE_CODE);
        $error = curl_error($handle);
        curl_close($handle);
        if (is_resource($stream)) {
            fclose($stream);
        }
        if ($response === false || $status < 200 || $status >= 300) {
            throw new RuntimeException('Falha no object storage (HTTP ' . $status . '): ' . ($error !== '' ? $error : 'resposta rejeitada pelo provedor.'));
        }
    }

    private function normalizeKey(string $storageKey): string
    {
        $storageKey = trim(str_replace('\\', '/', $storageKey), '/');
        if ($storageKey === '' || str_contains($storageKey, '..') || !preg_match('#^[A-Za-z0-9._/-]+$#', $storageKey)) {
            throw new InvalidArgumentException('Chave de armazenamento invalida.');
        }
        return $storageKey;
    }
}
