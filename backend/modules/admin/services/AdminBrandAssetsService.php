<?php

declare(strict_types=1);

require_once dirname(__DIR__, 3) . '/shared/security/UploadSecurity.php';

final class AdminBrandAssetsService
{
    private const ALLOWED_PURPOSES = ['email-logo', 'og-image', 'taxonomy-logo'];

    private const ALLOWED_MIME_TYPES = [
        'image/png' => ['extension' => 'png', 'maxSize' => 5242880],
        'image/jpeg' => ['extension' => 'jpg', 'maxSize' => 5242880],
        'image/webp' => ['extension' => 'webp', 'maxSize' => 5242880],
    ];

    /**
     * @return array{url:string,mimeType:string,size:int,width:int,height:int,storageKey:string}
     */
    public function upload(array $file, string $purpose, string $backendRoot): array
    {
        if (!in_array($purpose, self::ALLOWED_PURPOSES, true)) {
            throw new InvalidArgumentException('Finalidade da imagem administrativa invalida.');
        }

        $upload = UploadSecurity::validate($file, self::ALLOWED_MIME_TYPES, [
            'errorMessage' => 'Selecione uma imagem valida.',
            'invalidTypeMessage' => 'Use uma imagem PNG, JPEG ou WebP.',
        ]);

        $dimensions = @getimagesize((string) ($file['tmp_name'] ?? ''));
        $width = (int) ($dimensions[0] ?? 0);
        $height = (int) ($dimensions[1] ?? 0);
        if ($width <= 0 || $height <= 0 || $width > 4096 || $height > 4096) {
            throw new InvalidArgumentException('A imagem deve ter dimensoes entre 1 e 4096 pixels.');
        }

        $directory = rtrim($backendRoot, DIRECTORY_SEPARATOR)
            . DIRECTORY_SEPARATOR . 'uploads'
            . DIRECTORY_SEPARATOR . 'admin-assets'
            . DIRECTORY_SEPARATOR . $purpose;
        if (!is_dir($directory) && !mkdir($directory, 0775, true) && !is_dir($directory)) {
            throw new RuntimeException('Nao foi possivel preparar o diretorio de imagens administrativas.');
        }

        $filename = $purpose . '-' . gmdate('YmdHis') . '-' . bin2hex(random_bytes(12)) . '.' . $upload['extension'];
        $targetPath = $directory . DIRECTORY_SEPARATOR . $filename;
        if (!move_uploaded_file((string) ($file['tmp_name'] ?? ''), $targetPath)) {
            throw new RuntimeException('Nao foi possivel armazenar a imagem enviada.');
        }
        @chmod($targetPath, 0644);

        return [
            'url' => '/uploads/admin-assets/' . rawurlencode($purpose) . '/' . rawurlencode($filename),
            'mimeType' => (string) $upload['mimeType'],
            'size' => (int) $upload['size'],
            'width' => $width,
            'height' => $height,
            'storageKey' => 'admin-assets/' . $purpose . '/' . $filename,
        ];
    }
}
