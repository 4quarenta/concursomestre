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

require_once __DIR__ . '/../repositories/AdminCacheRepository.php';
require_once __DIR__ . '/../validators/AdminCacheValidator.php';
require_once __DIR__ . '/../../../shared/utils/SimpleCache.php';

/**
 * Servico das operacoes administrativas de cache.
 * Mantem as regras de estatistica e manutencao fora do endpoint legado.
 */
class AdminCacheService
{
    private AdminCacheRepository $repository;
    private AdminCacheValidator $validator;

    /**
     * Inicializa o servico com repositorio e validador do cache.
     *
     * @since 1.0.0
     */
    public function __construct(
        AdminCacheRepository $repository,
        AdminCacheValidator $validator
    ) {
        $this->repository = $repository;
        $this->validator = $validator;
    }

    /**
     * Resolve a acao solicitada para as rotinas administrativas de cache.
     *
     * @since 1.0.0
     */
    public function handle(string $action, string $method, array $body = []): array
    {
        $this->validator->validateAction($action);

        if (in_array($action, ['clear', 'clean'], true)) {
            $this->validator->validateMutationMethod($method);
        }

        return match ($action) {
            'stats' => $this->buildStatsResponse(''),
            'clear' => $this->handleClear(),
            'clean' => $this->handleCleanExpired(),
            'settings' => $this->handleSettings($method, $body),
            default => throw new InvalidArgumentException('Acao invalida.'),
        };
    }

    /**
     * Limpa completamente a tabela de cache e retorna os novos indicadores.
     *
     * @since 1.0.0
     */
    private function handleClear(): array
    {
        $settings = $this->readOperationalCacheSettings();
        $clearedFiles = $this->makeFileCache($settings)->clearAll();

        $tableInfo = $this->repository->resolveCacheTableInfo();
        if ($tableInfo !== null) {
            $this->repository->clearCacheTable($tableInfo);
        }

        return $this->buildStatsResponse("Cache limpo com sucesso. Arquivos removidos: {$clearedFiles}.");
    }

    /**
     * Remove entradas expiradas do cache e retorna os novos indicadores.
     *
     * @since 1.0.0
     */
    private function handleCleanExpired(): array
    {
        $settings = $this->readOperationalCacheSettings();
        $removedFiles = $this->makeFileCache($settings)->cleanExpired();

        $tableInfo = $this->repository->resolveCacheTableInfo();
        if ($tableInfo !== null) {
            $removedCount = $this->repository->clearExpiredCacheEntries($tableInfo);
            if (!empty($tableInfo['expires_column'])) {
                return $this->buildStatsResponse("Entradas expiradas removidas: " . ($removedFiles + $removedCount) . '.');
            }
        }

        return $this->buildStatsResponse("Entradas expiradas removidas: {$removedFiles}.");
    }

    /**
     * Atualiza configuracoes do cache a partir do corpo da requisicao.
     *
     * @since 1.0.0
     */
    private function handleSettings(string $method, array $body): array
    {
        $this->validator->validateSettingsMethod($method);

        $enabled = isset($body['enabled']) ? (bool) $body['enabled'] : true;
        $defaultTtl = max(1, (int) ($body['default_ttl'] ?? 300));
        $this->repository->upsertCacheSettings($enabled, $defaultTtl);
        $this->repository->upsertSystemSetting('cacheEnabled', json_encode($enabled));
        $this->repository->upsertSystemSetting('cacheDefaultTtl', json_encode($defaultTtl));

        return $this->buildStatsResponse('Configuracao de cache atualizada.');
    }

    /**
     * Resolve configuracao operacional do cache com compatibilidade para system_settings.
     *
     * @since 1.0.0
     */
    private function readOperationalCacheSettings(): array
    {
        $settings = [
            'enabled' => false,
            'default_ttl' => 300,
        ];

        try {
            $row = $this->repository->fetchCacheSettings();
            if (is_array($row)) {
                return [
                    'enabled' => ((int) ($row['enabled'] ?? 0)) === 1,
                    'default_ttl' => max(1, (int) ($row['default_ttl'] ?? 300)),
                ];
            }
        } catch (Throwable $e) {
            error_log('[admin_cache_service] cache_settings fallback: ' . $e->getMessage());
        }

        try {
            $enabledSetting = $this->repository->fetchSystemSetting('cacheEnabled');
            if ($enabledSetting !== null) {
                $decoded = json_decode($enabledSetting, true);
                $enabled = filter_var($decoded ?? $enabledSetting, FILTER_VALIDATE_BOOLEAN, FILTER_NULL_ON_FAILURE);
                if ($enabled !== null) {
                    $settings['enabled'] = $enabled;
                }
            }

            $ttlSetting = $this->repository->fetchSystemSetting('cacheDefaultTtl');
            if ($ttlSetting !== null) {
                $decodedTtl = json_decode($ttlSetting, true);
                $settings['default_ttl'] = max(1, (int) ($decodedTtl ?? $ttlSetting));
            }
        } catch (Throwable $e) {
            error_log('[admin_cache_service] system_settings cache fallback: ' . $e->getMessage());
        }

        return $settings;
    }

    /**
     * Cria o cache em arquivo usado por questions/statistics.
     *
     * @since 1.0.0
     */
    private function makeFileCache(array $settings): SimpleCache
    {
        return new SimpleCache(
            __DIR__ . '/../../../storage/cache',
            (bool) ($settings['enabled'] ?? false),
            (int) ($settings['default_ttl'] ?? 300)
        );
    }

    /**
     * Monta a resposta padrao com o estado atual do cache.
     *
     * @since 1.0.0
     */
    private function buildStatsResponse(string $message): array
    {
        $stats = [
            'total_files' => 0,
            'valid_entries' => 0,
            'expired_entries' => 0,
            'total_size_mb' => 0,
            'enabled' => false,
            'default_ttl' => 300,
            'table_name' => null,
            'source' => 'none',
            'supports_expiration' => false,
            'supports_size_estimate' => false,
        ];

        try {
            $settings = $this->readOperationalCacheSettings();
            $fileStats = $this->makeFileCache($settings)->getStats();
            $stats['total_files'] = (int) ($fileStats['total_files'] ?? 0);
            $stats['valid_entries'] = (int) ($fileStats['valid_entries'] ?? 0);
            $stats['expired_entries'] = (int) ($fileStats['expired_entries'] ?? 0);
            $stats['total_size_mb'] = (float) ($fileStats['total_size_mb'] ?? 0);
            $stats['enabled'] = (bool) ($settings['enabled'] ?? false);
            $stats['default_ttl'] = (int) ($settings['default_ttl'] ?? 300);
            $stats['table_name'] = 'storage/cache';
            $stats['source'] = 'file';
            $stats['supports_expiration'] = true;
            $stats['supports_size_estimate'] = true;

            $tableInfo = $this->repository->resolveCacheTableInfo();
            if ($tableInfo !== null) {
                $row = $this->repository->fetchCacheAggregateStats($tableInfo);
                $stats['database_entries'] = (int) ($row['total'] ?? 0);
                $stats['database_valid_entries'] = (int) ($row['valid_entries'] ?? 0);
                $stats['database_expired_entries'] = (int) ($row['expired_entries'] ?? 0);
                $stats['database_table_name'] = $tableInfo['table_name'];
            }
        } catch (Throwable $e) {
            error_log('[admin_cache_service] stats fallback: ' . $e->getMessage());
        }

        return [
            'message' => $message,
            'data' => $stats,
        ];
    }
}
