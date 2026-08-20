<?php

declare(strict_types=1);

require_once __DIR__ . '/ProfessionalTaxonomiesController.php';
require_once dirname(__DIR__, 3) . '/shared/responses/Response.php';

function professionalTaxonomiesController(PDO $db): ProfessionalTaxonomiesController
{
    return new ProfessionalTaxonomiesController(new ProfessionalTaxonomiesService(new ProfessionalTaxonomiesRepository($db)));
}

function handlePublicProfessionalDirectoryRoute(PDO $db): void
{
    try {
        $kind = strtolower(trim((string) ($_GET['kind'] ?? '')));
        $page = max(1, (int) ($_GET['page'] ?? 1));
        $limit = min(60, max(10, (int) ($_GET['per_page'] ?? 30)));
        $search = mb_substr(trim((string) ($_GET['search'] ?? '')), 0, 100, 'UTF-8');
        $letter = strtoupper(trim((string) ($_GET['letter'] ?? '')));
        if (!in_array($kind, ['career', 'position'], true) || ($letter !== '' && preg_match('/^[A-Z]$/', $letter) !== 1)) {
            throw new InvalidArgumentException('Diretorio profissional invalido.');
        }
        Response::success(professionalTaxonomiesController($db)->directory($kind, $page, $limit, $search, $letter));
    } catch (InvalidArgumentException $error) {
        Response::badRequest($error->getMessage());
    } catch (Throwable $error) {
        Response::serverError('Nao foi possivel carregar o diretorio profissional.', $error);
    }
}

function handlePublicProfessionalDetailRoute(PDO $db): void
{
    try {
        $kind = strtolower(trim((string) ($_GET['kind'] ?? '')));
        $slug = trim((string) ($_GET['slug'] ?? ''));
        if (!in_array($kind, ['career', 'position'], true)) throw new InvalidArgumentException('Tipo profissional invalido.');
        $payload = professionalTaxonomiesController($db)->detail($kind, $slug);
        if ($payload === null) Response::notFound($kind === 'career' ? 'Carreira nao encontrada.' : 'Cargo nao encontrado.');
        Response::success($payload);
    } catch (InvalidArgumentException $error) {
        Response::badRequest($error->getMessage());
    } catch (Throwable $error) {
        Response::serverError('Nao foi possivel carregar a entidade profissional.', $error);
    }
}
