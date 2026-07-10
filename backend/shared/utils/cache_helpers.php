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
 * Helpers de cache para endpoints PHP legados.
 *
 * @since 1.0.0
 */

require_once __DIR__ . '/SimpleCache.php';

/**
 * Inicializa cache com configuracao persistida quando existir.
 *
 * @since 1.0.0
 */
function initCache($db): SimpleCache
{
    try {
        $stmt = $db->prepare("SELECT * FROM cache_settings LIMIT 1");
        $stmt->execute();
        $result = $stmt->fetch(PDO::FETCH_ASSOC);
        if ($result) {
            return new SimpleCache(dirname(__DIR__, 2) . '/storage/cache', (bool) $result['enabled'], (int) $result['default_ttl']);
        }
    } catch (Exception $e) {
        // Mantem fallback quando a tabela ainda nao existe.
    }

    return new SimpleCache(dirname(__DIR__, 2) . '/storage/cache', false, 300);
}

/**
 * Retorna resposta cacheada e finaliza o request quando existir hit.
 *
 * @since 1.0.0
 */
function checkCache(SimpleCache $cache, $endpoint, $params = []): void
{
    $cachedData = $cache->get($endpoint, $params);
    if ($cachedData !== null) {
        header('X-Cache: HIT');
        header('Content-Type: application/json');
        echo json_encode($cachedData);
        exit();
    }

    header('X-Cache: MISS');
}

/**
 * Persiste uma resposta no cache com TTL customizado.
 *
 * @since 1.0.0
 */
function setCache(SimpleCache $cache, $endpoint, $params, $data, $ttl = null): void
{
    $cache->set($endpoint, $data, $params, $ttl);
}
