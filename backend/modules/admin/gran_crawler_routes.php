<?php

declare(strict_types=1);

require_once __DIR__ . '/services/AdminGranCrawlerService.php';
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
            Response::success([
                'jobs' => $service->listJobs($actorUserId, $role === 'admin'),
            ]);
        }
        if ($method !== 'POST') {
            Response::error('Metodo nao permitido.', 405, null, 'method_not_allowed');
        }

        $rawInput = (string) file_get_contents('php://input');
        if (strlen($rawInput) > 12_000_000) {
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

        if ($action === 'map') {
            RateLimiter::enforceProfile('admin_crawler', $actorUserId);
            $result = $service->mapBrowserResponse($input);
            logAdminAudit($db, $actorUserId, 'gran_crawler.map', 'question_ingestion', null, [
                'page' => (int) ($result['page'] ?? 0),
                'per_page' => (int) ($result['perPage'] ?? 0),
                'exam_count' => count($result['payloads'] ?? []),
                'question_count' => (int) ($result['questionCount'] ?? 0),
            ]);
            Response::success($result, 'JSON da extensao carregado para revisao.');
        }

        if ($action === 'enqueue') {
            $result = $service->enqueue($input, $actorUserId);
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
                'gran_crawler.enqueue',
                'question_ingestion',
                isset($result['jobs'][0]['jobId']) ? (string) $result['jobs'][0]['jobId'] : null,
                [
                    'exam_count' => count($payloads),
                    'question_count' => $questionCount,
                    'idempotent_replay' => (bool) ($result['idempotentReplay'] ?? false),
                ]
            );
            http_response_code(202);
            Response::success($result, 'Lotes por prova enfileirados para importacao.');
        }

        Response::badRequest('Acao invalida.');
    } catch (InvalidArgumentException $exception) {
        Response::badRequest($exception->getMessage());
    } catch (DomainException $exception) {
        Response::forbidden($exception->getMessage());
    } catch (RuntimeException $exception) {
        $status = str_contains($exception->getMessage(), 'limitou temporariamente') ? 429 : 502;
        Response::error(
            $exception->getMessage(),
            $status,
            null,
            $status === 429 ? 'gran_rate_limited' : 'gran_upstream_error'
        );
    } catch (Throwable $exception) {
        error_log('[admin_gran_crawler] ' . $exception->getMessage());
        Response::serverError('Nao foi possivel executar o crawler da Gran.', $exception);
    }
}
