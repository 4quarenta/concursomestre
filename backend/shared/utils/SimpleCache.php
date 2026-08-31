<?php

/*
* ----------------------------------------------------
* @author: 4quarenta
* @author URI: https://github.com/4quarenta
* @copyright: (c) 2026 ConcursoMestre. All rights reserved
* ----------------------------------------------------
*
* @since 1.0.0
*
*/

/**
 * Cache simples em arquivos para endpoints PHP.
 *
 * @since 1.0.0
 */
class SimpleCache
{
    private string $cacheDir;
    private bool $enabled;
    private int $defaultTTL;

    /**
     * Inicializa o cache local com diretorio, estado e TTL default.
     *
     * @since 1.0.0
     */
    public function __construct($cacheDir = null, $enabled = true, $defaultTTL = 300)
    {
        $this->cacheDir = (string) ($cacheDir ?: dirname(__DIR__, 2) . '/storage/cache');
        $this->enabled = (bool) $enabled;
        $this->defaultTTL = (int) $defaultTTL;

        if (!file_exists($this->cacheDir)) {
            mkdir($this->cacheDir, 0755, true);
        }
    }

    /**
     * Gera chave de cache a partir do endpoint e parametros.
     *
     * @since 1.0.0
     */
    private function getCacheKey($endpoint, $params = []): string
    {
        ksort($params);
        $paramString = http_build_query($params);
        return md5($endpoint . ':' . $paramString);
    }

    /**
     * Resolve o caminho do arquivo cacheado.
     *
     * @since 1.0.0
     */
    private function getCacheFilePath($key): string
    {
        return $this->cacheDir . '/' . $key . '.cache';
    }

    /**
     * Retorna dados do cache quando o TTL ainda eh valido.
     *
     * @since 1.0.0
     */
    public function get($endpoint, $params = [])
    {
        if (!$this->enabled) {
            return null;
        }

        $key = $this->getCacheKey($endpoint, $params);
        $filePath = $this->getCacheFilePath($key);

        if (!file_exists($filePath)) {
            return null;
        }

        $cacheData = json_decode(file_get_contents($filePath), true);
        if (!$cacheData || !isset($cacheData['expires']) || !isset($cacheData['data'])) {
            return null;
        }

        if (time() > $cacheData['expires']) {
            unlink($filePath);
            return null;
        }

        return $cacheData['data'];
    }

    /**
     * Persiste dados em cache usando TTL informado.
     *
     * @since 1.0.0
     */
    public function set($endpoint, $data, $params = [], $ttl = null): bool
    {
        if (!$this->enabled) {
            return false;
        }

        $ttl = $ttl ?? $this->defaultTTL;
        $key = $this->getCacheKey($endpoint, $params);
        $filePath = $this->getCacheFilePath($key);

        $cacheData = [
            'expires' => time() + $ttl,
            'data' => $data,
            'created' => time(),
        ];

        return file_put_contents($filePath, json_encode($cacheData)) !== false;
    }

    /**
     * Limpa todos os arquivos de cache do diretorio.
     *
     * @since 1.0.0
     */
    public function clearAll(): int
    {
        $files = glob($this->cacheDir . '/*.cache');
        $cleared = 0;

        foreach ($files as $file) {
            if (is_file($file)) {
                unlink($file);
                $cleared++;
            }
        }

        return $cleared;
    }

    /**
     * Remove apenas a entrada de cache do endpoint informado.
     *
     * @since 1.0.0
     */
    public function clear($endpoint, $params = []): bool
    {
        $key = $this->getCacheKey($endpoint, $params);
        $filePath = $this->getCacheFilePath($key);

        if (file_exists($filePath)) {
            return unlink($filePath);
        }

        return false;
    }

    /**
     * Devolve estatisticas de uso do cache em disco.
     *
     * @since 1.0.0
     */
    public function getStats(): array
    {
        $files = glob($this->cacheDir . '/*.cache');
        $totalSize = 0;
        $validCount = 0;
        $expiredCount = 0;

        foreach ($files as $file) {
            if (is_file($file)) {
                $totalSize += filesize($file);
                $cacheData = json_decode(file_get_contents($file), true);

                if ($cacheData && isset($cacheData['expires'])) {
                    if (time() > $cacheData['expires']) {
                        $expiredCount++;
                    } else {
                        $validCount++;
                    }
                }
            }
        }

        return [
            'total_files' => count($files),
            'valid_entries' => $validCount,
            'expired_entries' => $expiredCount,
            'total_size_bytes' => $totalSize,
            'total_size_mb' => round($totalSize / 1024 / 1024, 2),
        ];
    }

    /**
     * Limpa entradas expiradas do cache.
     *
     * @since 1.0.0
     */
    public function cleanExpired(): int
    {
        $files = glob($this->cacheDir . '/*.cache');
        $cleaned = 0;

        foreach ($files as $file) {
            if (is_file($file)) {
                $cacheData = json_decode(file_get_contents($file), true);

                if ($cacheData && isset($cacheData['expires']) && time() > $cacheData['expires']) {
                    unlink($file);
                    $cleaned++;
                }
            }
        }

        return $cleaned;
    }

    /**
     * Alterna o cache on/off em runtime.
     *
     * @since 1.0.0
     */
    public function setEnabled($enabled): void
    {
        $this->enabled = (bool) $enabled;
    }

    /**
     * Atualiza o TTL default aplicado a novos registros.
     *
     * @since 1.0.0
     */
    public function setDefaultTTL($ttl): void
    {
        $this->defaultTTL = (int) $ttl;
    }
}
