<?php

declare(strict_types=1);

require_once __DIR__ . '/services/AdminGranCrawlerService.php';
require_once __DIR__ . '/services/AdminGranTaxonomySyncService.php';
require_once __DIR__ . '/../../shared/security/AdminSecurity.php';
require_once __DIR__ . '/../../shared/middleware/RateLimiter.php';
require_once __DIR__ . '/../../shared/responses/Response.php';

function handleAdminGranCrawlerRoute(PDO $db): void
{
    try {
        $context = requireAdminSessionContext($db);
        header('Cache-Control: private, no-store, max-age=0');
        header('Pragma: no-cache');
        $actorUserId = (string) $context['admin_user_id'];
        $role = strtolower(trim((string) ($context['payload']['role'] ?? '')));
        $method = strtoupper((string) ($_SERVER['REQUEST_METHOD'] ?? 'GET'));
        $service = new AdminGranCrawlerService($db);

        if ($method === 'GET') {
            Response::success($service->bootstrap($actorUserId));
        }
        if ($method !== 'POST') {
            Response::error('Metodo nao permitido.', 405, null, 'method_not_allowed');
        }

        $rawInput = (string) file_get_contents('php://input');
        if (strlen($rawInput) > 120_000_000) {
            Response::error('O lote recebido excede o limite seguro.', 413, null, 'payload_too_large');
        }
        $input = json_decode($rawInput, true);
        if (!is_array($input)) {
            throw new InvalidArgumentException('Payload JSON invalido.');
        }
        $action = strtolower(trim((string) ($input['action'] ?? '')));

        if ($action === 'fetch') {
            Response::error(
                'A coleta direta pelo servidor foi aposentada. Use a extensao privada do navegador.',
                410,
                null,
                'server_side_collection_retired'
            );
        }

        if ($action === 'taxonomy_status') {
            $result = (new AdminGranTaxonomySyncService($db))->getStatus();
            Response::success(['taxonomies' => $result], 'Status das taxonomias Gran carregado.');
        }

        if ($action === 'check_taxonomy_updates') {
            RateLimiter::enforceProfile('admin_crawler', $actorUserId);
            $manifests = $input['manifests'] ?? null;
            if (!is_array($manifests)) {
                throw new InvalidArgumentException('A extensao nao retornou manifestos validos.');
            }
            $result = (new AdminGranTaxonomySyncService($db))->compareUpdateManifests(array_values($manifests));
            $changedCategories = count(array_filter(
                $result,
                static fn (array $status): bool => ($status['updateAvailable'] ?? false) === true
            ));
            Response::success([
                'taxonomies' => $result,
                'summary' => [
                    'checkedCatalogs' => count($manifests),
                    'changedCategories' => $changedCategories,
                    'currentCategories' => max(0, count($result) - $changedCategories),
                    'checkedAt' => gmdate('c'),
                ],
            ], 'Atualizacoes das taxonomias verificadas sem gravar catalogos.');
        }

        if ($action === 'mark_taxonomy_synced') {
            RateLimiter::enforceProfile('admin_taxonomy_sync', $actorUserId);
            $kind = strtolower(trim((string) ($input['taxonomyKind'] ?? '')));
            $result = (new AdminGranTaxonomySyncService($db))->markManifestSynchronized($kind);
            Response::success(['taxonomies' => $result], 'Manifesto da taxonomia atualizado.');
        }

        if ($action === 'taxonomy_hierarchy_gaps') {
            $roots = (new AdminGranTaxonomySyncService($db))->getMissingSubjectHierarchyExternalIds();
            Response::success([
                'rootExternalIds' => $roots,
                'count' => count($roots),
            ], 'Ramos ausentes da hierarquia Gran carregados.');
        }

        if ($action === 'map') {
            RateLimiter::enforceProfile('admin_crawler_mapping', $actorUserId);
            $result = $service->mapBrowserResponse($input);
            logAdminAudit($db, $actorUserId, 'gran_crawler.map', 'question_ingestion', null, [
                'page' => (int) ($result['page'] ?? 0),
                'per_page' => (int) ($result['perPage'] ?? 0),
                'exam_count' => count($result['payloads'] ?? []),
                'question_count' => (int) ($result['questionCount'] ?? 0),
            ]);
            Response::success($result, 'JSON da extensao carregado para revisao.');
        }

        if ($action === 'map_and_enqueue_publication') {
            RateLimiter::enforceProfile('admin_crawler_mapping', $actorUserId);
            $result = $service->mapAndEnqueuePublication($input, $actorUserId);
            $batch = is_array($result['batch'] ?? null) ? $result['batch'] : [];
            logAdminAudit($db, $actorUserId, 'gran_crawler.map_and_enqueue_publication', 'question_ingestion',
                isset($batch['batchId']) ? (string) $batch['batchId'] : null, [
                    'page' => (int) ($result['page'] ?? 0),
                    'per_page' => (int) ($result['perPage'] ?? 0),
                    'question_count' => (int) ($result['questionCount'] ?? 0),
                ]);
            Response::success($result, 'Pagina Gran mapeada e enfileirada para publicacao.');
        }

        if ($action === 'save_automatic_checkpoint') {
            RateLimiter::enforceProfile('admin_crawler_checkpoint', $actorUserId);
            $result = $service->saveAutomaticCheckpoint($input, $actorUserId);
            logAdminAudit($db, $actorUserId, 'gran_crawler.automatic_checkpoint_saved', 'question_ingestion', null, [
                'year' => (int) ($result['year'] ?? 0),
                'page' => (int) ($result['page'] ?? 0),
                'total_pages' => $result['totalPages'] ?? null,
                'status' => (string) ($result['status'] ?? ''),
            ]);
            Response::success($result, 'Progresso do modo automatico salvo.');
        }

        if ($action === 'clear_automatic_checkpoint') {
            RateLimiter::enforceProfile('admin_crawler', $actorUserId);
            $service->clearAutomaticCheckpoint($actorUserId);
            logAdminAudit($db, $actorUserId, 'gran_crawler.automatic_checkpoint_cleared', 'question_ingestion');
            Response::success([], 'Progresso salvo do modo automatico removido.');
        }

        if ($action === 'sync_taxonomy_chunk') {
            RateLimiter::enforceProfile('admin_taxonomy_sync', $actorUserId);
            $kind = strtolower(trim((string) ($input['taxonomyKind'] ?? '')));
            $granResponse = $input['granResponse'] ?? null;
            if (!is_array($granResponse)) {
                throw new InvalidArgumentException('A extensao nao retornou uma pagina valida de taxonomias.');
            }
            $result = (new AdminGranTaxonomySyncService($db))->syncChunk($kind, $granResponse);
            logAdminAudit($db, $actorUserId, 'gran_crawler.taxonomy_sync', 'filter', null, [
                'kind' => $kind,
                'processed' => (int) ($result['processed'] ?? 0),
                'created' => (int) ($result['created'] ?? 0),
                'updated' => (int) ($result['updated'] ?? 0),
                'pending' => (int) ($result['pending'] ?? 0),
            ]);
            Response::success($result, 'Pagina de taxonomias Gran sincronizada.');
        }

        if ($action === 'sync_taxonomy_batch') {
            RateLimiter::enforceProfile('admin_taxonomy_sync', $actorUserId);
            $kind = strtolower(trim((string) ($input['taxonomyKind'] ?? '')));
            $granResponses = $input['granResponses'] ?? null;
            if (!is_array($granResponses)) {
                throw new InvalidArgumentException('A extensao nao retornou um lote valido de taxonomias.');
            }
            $finalizeRelations = !array_key_exists('finalizeRelations', $input)
                || filter_var($input['finalizeRelations'], FILTER_VALIDATE_BOOLEAN);
            $result = (new AdminGranTaxonomySyncService($db))->syncBatch(
                $kind,
                $granResponses,
                $finalizeRelations
            );
            logAdminAudit($db, $actorUserId, 'gran_crawler.taxonomy_sync_batch', 'filter', null, [
                'kind' => $kind,
                'pages' => (int) ($result['pages'] ?? 0),
                'processed' => (int) ($result['processed'] ?? 0),
                'created' => (int) ($result['created'] ?? 0),
                'updated' => (int) ($result['updated'] ?? 0),
                'pending' => (int) ($result['pending'] ?? 0),
                'relations_finalized' => $finalizeRelations,
            ]);
            Response::success($result, 'Lote de taxonomias Gran sincronizado.');
        }

        if ($action === 'sync_missing_subject_roots') {
            RateLimiter::enforceProfile('admin_taxonomy_sync', $actorUserId);
            $granResponses = $input['granResponses'] ?? null;
            $rootExternalIds = $input['rootExternalIds'] ?? null;
            if (!is_array($granResponses) || !is_array($rootExternalIds)) {
                throw new InvalidArgumentException('O catalogo ou as raizes pendentes sao invalidos.');
            }
            $result = (new AdminGranTaxonomySyncService($db))->syncMissingSubjectRoots(
                $granResponses,
                array_values($rootExternalIds)
            );
            logAdminAudit($db, $actorUserId, 'gran_crawler.taxonomy_root_recovery', 'filter', null, [
                'requested' => (int) ($result['requested'] ?? 0),
                'found' => (int) ($result['found'] ?? 0),
                'created' => (int) ($result['created'] ?? 0),
                'updated' => (int) ($result['updated'] ?? 0),
                'unresolved' => (int) ($result['unresolved'] ?? 0),
            ]);
            Response::success($result, 'Materias-raiz pendentes processadas.');
        }

        if ($action === 'resolve_subject_taxonomy_pending') {
            RateLimiter::enforceProfile('admin_taxonomy_sync', $actorUserId);
            $taxonomyService = new AdminGranTaxonomySyncService($db);
            $granResponses = $input['granResponses'] ?? null;
            $requestedExternalIds = $input['requestedExternalIds'] ?? null;
            if (!is_array($granResponses) || !is_array($requestedExternalIds)) {
                throw new InvalidArgumentException('Os dados da hierarquia pendente sao invalidos.');
            }
            $recovery = $taxonomyService->syncMissingSubjectHierarchyNodes(
                array_values($granResponses),
                array_values($requestedExternalIds)
            );
            $finalized = $taxonomyService->finalizeSync();
            $nextMissingExternalIds = $taxonomyService->getMissingSubjectHierarchyExternalIds();
            $result = [
                'recovery' => $recovery,
                'finalized' => $finalized,
                'nextMissingExternalIds' => $nextMissingExternalIds,
            ];
            logAdminAudit(
                $db,
                $actorUserId,
                'gran_crawler.taxonomy_pending_resolution',
                'filter',
                null,
                [
                    'requested' => (int) ($recovery['requested'] ?? 0),
                    'found' => (int) ($recovery['found'] ?? 0),
                    'created' => (int) ($recovery['created'] ?? 0),
                    'updated' => (int) ($recovery['updated'] ?? 0),
                    'unresolved_nodes' => (int) ($recovery['unresolved'] ?? 0),
                    'resolved' => (int) ($finalized['resolved'] ?? 0),
                    'pending' => (int) ($finalized['pending'] ?? 0),
                ]
            );
            Response::success($result, 'Pais e raizes pendentes da hierarquia foram processados.');
        }

        if ($action === 'finalize_taxonomy_sync') {
            RateLimiter::enforceProfile('admin_taxonomy_sync', $actorUserId);
            $result = (new AdminGranTaxonomySyncService($db))->finalizeSync();
            logAdminAudit($db, $actorUserId, 'gran_crawler.taxonomy_finalize', 'filter', null, $result);
            Response::success($result, 'Hierarquia das taxonomias Gran reconciliada.');
        }

        if ($action === 'finalize_cargo_taxonomy_relations') {
            RateLimiter::enforceProfile('admin_taxonomy_sync', $actorUserId);
            $cursor = max(0, (int) ($input['cursor'] ?? 0));
            $limit = max(100, min(2000, (int) ($input['limit'] ?? 1000)));
            $pendingOnly = filter_var($input['pendingOnly'] ?? false, FILTER_VALIDATE_BOOLEAN);
            $result = (new AdminGranTaxonomySyncService($db))->finalizeCargoRelationsChunk(
                $cursor,
                $limit,
                $pendingOnly
            );
            if (($result['hasMore'] ?? false) === false) {
                logAdminAudit(
                    $db,
                    $actorUserId,
                    'gran_crawler.cargo_taxonomy_finalize',
                    'filter',
                    null,
                    $result + ['pendingOnly' => $pendingOnly]
                );
            }
            Response::success(
                $result,
                ($result['hasMore'] ?? false)
                    ? 'Lote de vinculos de cargos reconciliado.'
                    : 'Vinculos de cargos Gran reconciliados.'
            );
        }

        if ($action === 'enqueue' || $action === 'enqueue_publication') {
            $result = $service->enqueuePublication($input, $actorUserId);
            $payloads = is_array($input['payloads'] ?? null)
                ? array_values(array_filter($input['payloads'], 'is_array'))
                : (is_array($input['payload'] ?? null) ? [$input['payload']] : []);
            $questionCount = array_sum(array_map(
                static fn (array $payload): int => count(
                    is_array($payload['questions'] ?? null) ? $payload['questions'] : []
                ),
                $payloads
            ));
            logAdminAudit(
                $db,
                $actorUserId,
                'gran_crawler.enqueue_publication',
                'question_ingestion',
                isset($result['batchId']) ? (string) $result['batchId'] : null,
                [
                    'exam_count' => count($payloads),
                    'question_count' => $questionCount,
                    'idempotent_replay' => (bool) ($result['idempotentReplay'] ?? false),
                ]
            );
            http_response_code(202);
            Response::success($result, 'Publicacao enfileirada para processamento assincrono.');
        }

        if ($action === 'list_publication_failures') {
            RateLimiter::enforceProfile('admin_crawler', $actorUserId);
            Response::success($service->listPublicationFailures($input));
        }

        if ($action === 'get_publication_failure') {
            RateLimiter::enforceProfile('admin_crawler', $actorUserId);
            Response::success($service->getPublicationFailure($input));
        }

        if ($action === 'retry_publication_failure') {
            RateLimiter::enforceProfile('admin_crawler', $actorUserId);
            $result = $service->retryPublicationFailure($input, $actorUserId);
            logAdminAudit(
                $db,
                $actorUserId,
                'gran_crawler.retry_publication_failure',
                'question_ingestion',
                isset($result['batchId']) ? (string) $result['batchId'] : null,
                ['failure_id' => (int) ($input['failureId'] ?? 0)]
            );
            http_response_code(202);
            Response::success($result, 'Questao reenviada para publicacao.');
        }

        if ($action === 'retry_publication_failures') {
            RateLimiter::enforceProfile('admin_crawler', $actorUserId);
            $result = $service->retryPublicationFailures($input, $actorUserId);
            logAdminAudit(
                $db,
                $actorUserId,
                'gran_crawler.retry_publication_failures',
                'question_ingestion',
                isset($result['batchId']) ? (string) $result['batchId'] : null,
                [
                    'failure_ids' => array_values(array_filter(
                        array_map('intval', is_array($input['failureIds'] ?? null) ? $input['failureIds'] : []),
                        static fn (int $id): bool => $id > 0
                    )),
                ]
            );
            http_response_code(202);
            Response::success($result, 'Falhas selecionadas reenviadas para publicacao.');
        }

        if ($action === 'ignore_publication_failure') {
            RateLimiter::enforceProfile('admin_crawler', $actorUserId);
            $result = $service->ignorePublicationFailure($input);
            logAdminAudit(
                $db,
                $actorUserId,
                'gran_crawler.ignore_publication_failure',
                'question_ingestion',
                (string) ($result['failureId'] ?? ''),
                ['failure_id' => (int) ($input['failureId'] ?? 0)]
            );
            Response::success($result, 'Falha ignorada e removida da fila operacional.');
        }

        if ($action === 'ignore_all_publication_failures') {
            RateLimiter::enforceProfile('admin_crawler', $actorUserId);
            $result = $service->ignoreAllPublicationFailures();
            logAdminAudit(
                $db,
                $actorUserId,
                'gran_crawler.ignore_all_publication_failures',
                'question_ingestion',
                null,
                ['ignored_count' => (int) ($result['ignoredCount'] ?? 0)]
            );
            Response::success($result, 'Falhas ignoradas e removidas da fila operacional.');
        }

        if ($action === 'publication_failure_retention_preview') {
            RateLimiter::enforceProfile('admin_crawler', $actorUserId);
            Response::success($service->previewPublicationFailureRetention());
        }

        if ($action === 'purge_publication_failure_diagnostics') {
            RateLimiter::enforceProfile('admin_crawler', $actorUserId);
            $result = $service->purgePublicationFailureRetention();
            logAdminAudit(
                $db,
                $actorUserId,
                'gran_crawler.purge_publication_failure_diagnostics',
                'question_ingestion',
                null,
                $result
            );
            Response::success($result, 'Diagnosticos encerrados fora da janela de retencao foram removidos.');
        }

        if ($action === 'publication_batch_status') {
            Response::success($service->getPublicationBatch($input, $actorUserId));
        }

        if ($action === 'publication_batch_progress') {
            Response::success($service->getPublicationBatchProgress($input, $actorUserId));
        }

        Response::badRequest('Acao invalida.');
    } catch (InvalidArgumentException $exception) {
        Response::badRequest($exception->getMessage());
    } catch (DomainException $exception) {
        // Uma chave de idempotencia reutilizada com outro conteudo e um
        // conflito de submissao, nao uma falha de permissao. Isso tambem
        // preserva o 403 exclusivamente para sessao/RBAC de fato invalidos.
        if (str_contains(strtolower($exception->getMessage()), 'chave de idempotencia')) {
            Response::error($exception->getMessage(), 409, null, 'idempotency_conflict');
        }
        Response::forbidden($exception->getMessage());
    } catch (RuntimeException $exception) {
        if (str_contains($exception->getMessage(), 'Rate limit compartilhado indisponivel')) {
            Response::serviceUnavailable(
                'O controle compartilhado de taxa esta temporariamente indisponivel. Tente novamente em instantes.',
                $exception,
                'runtime_store_unavailable'
            );
        }

        $status = str_contains($exception->getMessage(), 'limitou temporariamente') ? 429 : 500;
        Response::error(
            $exception->getMessage(),
            $status,
            null,
            $status === 429 ? 'gran_rate_limited' : 'gran_crawler_runtime_error'
        );
    } catch (Throwable $exception) {
        error_log('[admin_gran_crawler] ' . $exception->getMessage());
        Response::serverError('Nao foi possivel executar o crawler da Gran.', $exception);
    }
}
