<?php

declare(strict_types=1);

require_once __DIR__ . '/controllers/ChangelogController.php';
require_once __DIR__ . '/services/ChangelogService.php';
require_once __DIR__ . '/repositories/ChangelogRepository.php';
require_once __DIR__ . '/validators/ChangelogValidator.php';
require_once __DIR__ . '/../../shared/auth/request_auth.php';
require_once __DIR__ . '/../../shared/security/AdminSecurity.php';
require_once __DIR__ . '/../../shared/responses/Response.php';

function buildChangelogController(PDO $db): ChangelogController
{
    return new ChangelogController(
        new ChangelogService(new ChangelogRepository($db), new ChangelogValidator())
    );
}

function readChangelogJsonBody(): array
{
    $raw = file_get_contents('php://input');
    $decoded = is_string($raw) && trim($raw) !== '' ? json_decode($raw, true) : [];
    if (!is_array($decoded)) {
        throw new InvalidArgumentException('Payload JSON invalido.');
    }
    return $decoded;
}

function handleChangelogListRoute(PDO $db): void
{
    try {
        Response::success(buildChangelogController($db)->listPublic($_GET));
    } catch (InvalidArgumentException $e) {
        Response::badRequest($e->getMessage());
    } catch (Throwable $e) {
        Response::serverError('Nao foi possivel carregar as novidades.', $e);
    }
}

function handleChangelogAdminListRoute(PDO $db): void
{
    try {
        requireAdminSessionContext($db);
        Response::success(buildChangelogController($db)->listAdmin($_GET));
    } catch (InvalidArgumentException $e) {
        Response::badRequest($e->getMessage());
    } catch (Throwable $e) {
        Response::serverError('Nao foi possivel listar as novidades.', $e);
    }
}

function handleChangelogAdminDetailRoute(PDO $db): void
{
    try {
        requireAdminSessionContext($db);
        Response::success(buildChangelogController($db)->detailAdmin((int) ($_GET['id'] ?? 0)));
    } catch (InvalidArgumentException $e) {
        Response::badRequest($e->getMessage());
    } catch (OutOfBoundsException $e) {
        Response::notFound($e->getMessage());
    } catch (Throwable $e) {
        Response::serverError('Nao foi possivel carregar a novidade.', $e);
    }
}

function handleChangelogAdminSaveRoute(PDO $db): void
{
    try {
        $context = requireAdminSessionContext($db);
        $entry = buildChangelogController($db)->save(readChangelogJsonBody(), $context['payload']);
        logAdminAudit(
            $db,
            (string) $context['admin_user_id'],
            'changelog.entry.save',
            'changelog',
            (string) ($entry['id'] ?? ''),
            ['status' => $entry['status'] ?? 'draft']
        );
        Response::success($entry, 'Novidade salva com sucesso.');
    } catch (InvalidArgumentException $e) {
        Response::validationError($e->getMessage());
    } catch (PDOException $e) {
        if ((string) $e->getCode() === '23000') {
            Response::conflict('Ja existe uma novidade com este titulo ou identificador.');
        }
        Response::serverError('Nao foi possivel salvar a novidade.', $e);
    } catch (Throwable $e) {
        Response::serverError('Nao foi possivel salvar a novidade.', $e);
    }
}

function handleChangelogAdminArchiveRoute(PDO $db): void
{
    try {
        $context = requireAdminSessionContext($db);
        $payload = readChangelogJsonBody();
        $id = (int) ($payload['id'] ?? 0);
        buildChangelogController($db)->archive($id, $context['payload']);
        logAdminAudit($db, (string) $context['admin_user_id'], 'changelog.entry.archive', 'changelog', (string) $id);
        Response::success(['id' => $id], 'Novidade arquivada.');
    } catch (InvalidArgumentException $e) {
        Response::badRequest($e->getMessage());
    } catch (OutOfBoundsException $e) {
        Response::notFound($e->getMessage());
    } catch (Throwable $e) {
        Response::serverError('Nao foi possivel arquivar a novidade.', $e);
    }
}

function handleChangelogAdminSuggestionsRoute(PDO $db): void
{
    try {
        $context = requireAdminSessionContext($db);
        $method = strtoupper((string) ($_SERVER['REQUEST_METHOD'] ?? 'GET'));
        if ($method === 'GET') {
            Response::success(buildChangelogController($db)->listSuggestions($_GET));
        }
        if ($method !== 'PUT') {
            Response::error('Metodo nao permitido.', 405);
        }
        $suggestion = buildChangelogController($db)->updateSuggestion(readChangelogJsonBody(), $context['payload']);
        logAdminAudit(
            $db,
            (string) $context['admin_user_id'],
            'changelog.suggestion.status',
            'feedback',
            (string) ($suggestion['id'] ?? ''),
            ['status' => $suggestion['status'] ?? 'pending']
        );
        Response::success($suggestion, 'Status da sugestao atualizado.');
    } catch (InvalidArgumentException $e) {
        Response::validationError($e->getMessage());
    } catch (OutOfBoundsException $e) {
        Response::notFound($e->getMessage());
    } catch (Throwable $e) {
        Response::serverError('Nao foi possivel processar as sugestoes.', $e);
    }
}
