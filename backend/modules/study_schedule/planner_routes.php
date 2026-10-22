<?php
require_once __DIR__ . '/services/StudyPlannerService.php';
require_once __DIR__ . '/../../shared/auth/request_auth.php';
require_once __DIR__ . '/../../shared/responses/Response.php';

function handleStudyPlannerRoute(PDO $db): void
{
    try { $auth = verifyAuthenticatedUserPayload(); }
    catch (Throwable $e) { Response::unauthorized('Faca login para acessar seus cronogramas.'); return; }
    try {
        $service = new StudyPlannerService($db, (string) $auth['user_id'], in_array($auth['role'] ?? '', ['admin', 'staff'], true));
        $method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
        if ($method === 'GET') { Response::success($service->read($_GET)); return; }
        if ($method !== 'POST') { http_response_code(405); return; }
        $body = file_get_contents('php://input');
        if (strlen($body) > 200000) throw new InvalidArgumentException('Formulario muito grande.');
        $input = json_decode($body, true, 64, JSON_THROW_ON_ERROR);
        if (!is_array($input)) throw new InvalidArgumentException('Formulario invalido.');
        Response::success($service->write($input));
    } catch (JsonException | InvalidArgumentException $e) { Response::validationError($e->getMessage()); }
    catch (DomainException $e) { Response::forbidden($e->getMessage()); }
    catch (OutOfBoundsException $e) { Response::error($e->getMessage(), 404); }
    catch (UnexpectedValueException $e) { Response::error($e->getMessage(), 409); }
    catch (Throwable $e) { Response::serverError('Nao foi possivel atualizar o cronograma.', $e); }
}
