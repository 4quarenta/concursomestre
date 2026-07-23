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

class ExamsController
{
    private ExamsService $service;

    public function __construct(ExamsService $service)
    {
        $this->service = $service;
    }

    public function list(): void
    {
        try {
            Response::success($this->service->list($_GET), 'Banco de provas carregado.');
        } catch (InvalidArgumentException $exception) {
            Response::badRequest($exception->getMessage());
        }
    }

    public function show(int $id): void
    {
        $exam = $this->service->show($id);
        if (!$exam) {
            Response::notFound('Prova não encontrada.');
        }
        Response::success(['exam' => $exam]);
    }

    public function save(array $payload, array $user): void
    {
        try {
            $exam = $this->service->save($payload, $user);
            Response::success(['exam' => $exam], 'Prova salva com sucesso.');
        } catch (InvalidArgumentException $exception) {
            $decoded = json_decode($exception->getMessage(), true);
            Response::validationError(is_array($decoded) ? $decoded : $exception->getMessage());
        } catch (Throwable $exception) {
            $traceId = 'exam-save-' . bin2hex(random_bytes(6));
            error_log(sprintf(
                '[%s] %s in %s:%d',
                $traceId,
                $exception->getMessage(),
                $exception->getFile(),
                $exception->getLine()
            ));
            Response::serverError('Não foi possível salvar a prova.', $exception);
        }
    }

    public function archive(int $id): void
    {
        try {
            $this->service->archive($id);
            Response::success(['id' => $id], 'Prova arquivada com sucesso.');
        } catch (Throwable $exception) {
            Response::serverError('Não foi possível arquivar a prova.', $exception);
        }
    }

    public function uploadFile(array $user): void
    {
        try {
            $kind = (string) ($_POST['kind'] ?? $_POST['tipo'] ?? 'outro');
            $examId = isset($_POST['exam_id']) && is_numeric($_POST['exam_id']) ? (int) $_POST['exam_id'] : null;
            $payload = $this->service->uploadFile($_FILES['file'] ?? null, $kind, $examId, $user);
            Response::success($payload, 'Arquivo anexado à prova.');
        } catch (InvalidArgumentException $exception) {
            Response::badRequest($exception->getMessage());
        } catch (Throwable $exception) {
            Response::serverError('Não foi possível anexar o arquivo da prova.', $exception);
        }
    }

    public function listFiles(int $examId): void
    {
        Response::success(['items' => $this->service->listFiles($examId)]);
    }

    public function archiveFile(int $examId, int $fileId): void
    {
        try {
            $this->service->archiveFile($examId, $fileId);
            Response::success(['id' => $fileId], 'Arquivo removido da prova.');
        } catch (Throwable $exception) {
            Response::serverError('Não foi possível remover o arquivo da prova.', $exception);
        }
    }

    public function startExtraction(array $payload, array $user): void
    {
        try {
            Response::success($this->service->startExtraction($payload, $user), 'Extração registrada para revisão.');
        } catch (InvalidArgumentException $exception) {
            Response::badRequest($exception->getMessage());
        } catch (Throwable $exception) {
            Response::serverError('Não foi possível iniciar a extração da prova.', $exception);
        }
    }

    public function showExtraction(int $id): void
    {
        $extraction = $this->service->showExtraction($id);
        if (!$extraction) {
            Response::notFound('Extração não encontrada.');
        }
        Response::success(['extraction' => $extraction]);
    }

    public function reviewExtraction(int $id, array $payload, array $user): void
    {
        try {
            Response::success($this->service->reviewExtraction($id, $payload, $user), 'Revisão da extração salva.');
        } catch (InvalidArgumentException $exception) {
            Response::badRequest($exception->getMessage());
        } catch (Throwable $exception) {
            Response::serverError('Não foi possível revisar a extração da prova.', $exception);
        }
    }
}
