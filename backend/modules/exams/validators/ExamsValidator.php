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

require_once __DIR__ . '/../../../shared/security/UploadSecurity.php';

class ExamsValidator
{
    public function validateSave(array $payload): array
    {
        $errors = [];
        $name = trim((string) ($payload['nome'] ?? $payload['name'] ?? ''));
        if ($name === '') {
            $errors['nome'] = 'Informe o nome da prova.';
        }

        $year = $payload['ano'] ?? $payload['year'] ?? null;
        if ($year === null || $year === '') {
            $errors['ano'] = 'Informe o ano da prova.';
        } elseif (!is_numeric($year) || (int) $year < 1900 || (int) $year > 2100) {
            $errors['ano'] = 'Informe um ano válido.';
        }

        $status = $payload['publishStatus'] ?? $payload['statusEditorial'] ?? $payload['status_editorial'] ?? 'published';
        if (!in_array($status, ['published', 'draft', 'scheduled', 'archived'], true)) {
            $errors['status'] = 'Status editorial inválido.';
        }

        $visibility = $payload['visibilityStatus'] ?? $payload['visibility_status'] ?? 'public';
        if (!in_array($visibility, ['public', 'elite', 'internal'], true)) {
            $errors['visibility'] = 'Visibilidade inválida.';
        }

        return $errors;
    }

    public function validateAttachmentUpload(?array $file): array
    {
        if (!$file || !isset($file['error']) || (int) $file['error'] === UPLOAD_ERR_NO_FILE) {
            throw new InvalidArgumentException('Arquivo da prova não enviado.');
        }

        return UploadSecurity::validate($file, [
            'application/pdf' => ['extension' => 'pdf', 'maxSize' => 50 * 1024 * 1024],
            'image/jpeg' => ['extension' => 'jpg', 'maxSize' => 15 * 1024 * 1024],
            'image/png' => ['extension' => 'png', 'maxSize' => 15 * 1024 * 1024],
            'image/webp' => ['extension' => 'webp', 'maxSize' => 15 * 1024 * 1024],
        ], [
            'errorMessage' => 'Falha ao enviar o arquivo da prova.',
            'emptyMessage' => 'O arquivo da prova está vazio.',
            'invalidTypeMessage' => 'Envie PDF, PNG, JPG ou WEBP.',
        ]);
    }
}
