<?php

declare(strict_types=1);

require_once __DIR__ . '/services/CmBatchImportService.php';
require_once __DIR__ . '/services/CmBatchTaxonomyReviewService.php';
require_once __DIR__ . '/../../shared/auth/request_auth.php';
require_once __DIR__ . '/../../shared/auth/AuthCookies.php';
require_once __DIR__ . '/../../shared/middleware/RateLimiter.php';
require_once __DIR__ . '/../../shared/responses/Response.php';

function handleCmBatchImportRoute(PDO $db): void
{
    try {
        $auth = verifyAuthenticatedUserPayload(false);
        if (!$auth || empty($auth['user_id'])) Response::unauthorized('Sessao invalida. Faca login novamente.');
        $role = strtolower(trim((string) ($auth['role'] ?? '')));
        if ($role !== 'admin') {
            Response::forbidden('Acesso restrito a administradores.');
        }
        $actorId = trim((string) ($auth['user_id'] ?? ''));
        $method = strtoupper((string) ($_SERVER['REQUEST_METHOD'] ?? 'GET'));
        $service = new CmBatchImportService($db, $actorId);
        $review = new CmBatchTaxonomyReviewService($db, $actorId);
        if ($method === 'GET') {
            $jobId = trim((string) ($_GET['job_id'] ?? ''));
            if (($_GET['action'] ?? '') === 'taxonomy_candidates') {
                Response::success($review->candidates($jobId, (string) ($_GET['category'] ?? ''), (string) ($_GET['key'] ?? ''), (string) ($_GET['search'] ?? '')));
            }
            Response::success($service->getJob($jobId), 'Previa de importacao carregada.');
        }
        if ($method !== 'POST') {
            Response::error('Metodo nao permitido.', 405, null, 'method_not_allowed');
        }
        if (!assertValidCsrfToken(getCsrfTokenFromCookie(), getCsrfTokenFromRequest())) {
            Response::forbidden('CSRF token invalido.');
        }
        RateLimiter::enforceProfile('upload', 'cm-batch:' . $actorId);
        if (($_POST['action'] ?? '') === 'resolve_taxonomy') {
            $review->decide($_POST);
            Response::success($service->getJob((string) ($_POST['jobId'] ?? '')), 'Decisao registrada na previa.');
        }
        if (!in_array((string) ($_POST['action'] ?? ''), ['preview', 'dry_run'], true)) {
            Response::error('Acao nao suportada. A importacao efetiva ainda depende da revisao do lote.', 409, null, 'review_required');
        }
        if (!isset($_FILES['archive']) || !is_array($_FILES['archive'])) {
            throw new InvalidArgumentException('Selecione um arquivo ZIP para validar.');
        }
        $persist = ($_POST['action'] ?? '') === 'preview';
        $job = $service->previewUpload($_FILES['archive'], $persist);
        Response::success($job, $persist ? 'Previa salva; nenhum conteudo canonico foi importado.' : 'Validacao concluida sem gravacao.', $persist ? 201 : 200);
    } catch (InvalidArgumentException $error) {
        Response::badRequest($error->getMessage());
    } catch (OutOfBoundsException $error) {
        Response::notFound($error->getMessage());
    } catch (DomainException $error) {
        Response::error($error->getMessage(), 409, null, 'review_conflict');
    } catch (RuntimeException $error) {
        $message = strtolower($error->getMessage());
        if (str_contains($message, 'sessao') || str_contains($message, 'token') || str_contains($message, 'autentic')) {
            Response::unauthorized($error->getMessage());
        }
        Response::serverError('Nao foi possivel validar o lote CM Batch.', $error);
    } catch (Throwable $error) {
        Response::serverError('Nao foi possivel validar o lote CM Batch.', $error);
    }
}
