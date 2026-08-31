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

declare(strict_types=1);

class UploadSecurity
{
    private const DANGEROUS_EXTENSIONS = [
        'php', 'php3', 'php4', 'php5', 'phtml', 'phar',
        'html', 'htm', 'xhtml', 'shtml',
        'js', 'mjs', 'svg',
        'exe', 'bat', 'cmd', 'com', 'scr', 'ps1', 'sh',
    ];

    /**
     * @param array<string, array<string, mixed>> $allowedMimeTypes
     *
     * @return array{mimeType: string, extension: string, folder: string, maxSize: int, size: int, originalName: string}
     */
    public static function validate(array $file, array $allowedMimeTypes, array $options = []): array
    {
        if (!isset($file['error']) || (int) $file['error'] !== UPLOAD_ERR_OK) {
            throw new InvalidArgumentException((string) ($options['errorMessage'] ?? 'Nenhum arquivo valido foi enviado.'));
        }

        $tmpName = (string) ($file['tmp_name'] ?? '');
        if ($tmpName === '' || !is_file($tmpName) || !is_readable($tmpName)) {
            throw new InvalidArgumentException('Arquivo temporario de upload invalido.');
        }

        $requireUploadedFile = $options['requireUploadedFile'] ?? true;
        if ($requireUploadedFile && !is_uploaded_file($tmpName)) {
            throw new InvalidArgumentException('Arquivo temporario de upload invalido.');
        }

        $originalName = self::normalizeOriginalName((string) ($file['name'] ?? 'arquivo'));
        self::rejectDangerousOriginalName($originalName);

        $size = (int) ($file['size'] ?? 0);
        if ($size <= 0) {
            throw new InvalidArgumentException((string) ($options['emptyMessage'] ?? 'Arquivo enviado esta vazio.'));
        }

        $mimeType = self::detectMimeType($tmpName);
        $config = $allowedMimeTypes[$mimeType] ?? null;
        if (!is_array($config)) {
            throw new InvalidArgumentException((string) ($options['invalidTypeMessage'] ?? 'Tipo de arquivo invalido.'));
        }

        $maxSize = (int) ($config['maxSize'] ?? 0);
        if ($maxSize > 0 && $size > $maxSize) {
            $maxSizeMb = max(1, (int) ceil($maxSize / 1024 / 1024));
            throw new InvalidArgumentException('Arquivo muito grande. Tamanho maximo permitido: ' . $maxSizeMb . 'MB.');
        }

        self::assertFileContentMatchesMime($tmpName, $mimeType);

        return [
            'mimeType' => $mimeType,
            'extension' => (string) ($config['extension'] ?? 'bin'),
            'folder' => (string) ($config['folder'] ?? ''),
            'maxSize' => $maxSize,
            'size' => $size,
            'originalName' => $originalName,
        ];
    }

    public static function normalizeOriginalName(string $name): string
    {
        $name = str_replace(["\\", '/', "\0"], '', $name);
        $name = preg_replace('/\s+/', ' ', trim($name)) ?? '';

        return $name !== '' ? mb_substr($name, 0, 180) : 'arquivo';
    }

    public static function rejectDangerousOriginalName(string $name): void
    {
        $parts = array_filter(explode('.', strtolower($name)), static fn (string $part): bool => $part !== '');
        foreach ($parts as $part) {
            if (in_array($part, self::DANGEROUS_EXTENSIONS, true)) {
                throw new InvalidArgumentException('Nome de arquivo contem extensao nao permitida.');
            }
        }
    }

    private static function detectMimeType(string $tmpName): string
    {
        if (class_exists('finfo')) {
            $finfo = new finfo(FILEINFO_MIME_TYPE);
            $mimeType = (string) $finfo->file($tmpName);
            if ($mimeType !== '') {
                return $mimeType;
            }
        }

        if (function_exists('mime_content_type')) {
            $mimeType = (string) mime_content_type($tmpName);
            if ($mimeType !== '') {
                return $mimeType;
            }
        }

        return 'application/octet-stream';
    }

    private static function assertFileContentMatchesMime(string $tmpName, string $mimeType): void
    {
        if ($mimeType === 'application/pdf') {
            $handle = fopen($tmpName, 'rb');
            if ($handle === false) {
                throw new InvalidArgumentException('Nao foi possivel ler o arquivo enviado.');
            }

            $header = fread($handle, 5);
            fclose($handle);

            if ($header !== '%PDF-') {
                throw new InvalidArgumentException('Arquivo PDF invalido.');
            }
            return;
        }

        if (str_starts_with($mimeType, 'image/')) {
            $imageInfo = @getimagesize($tmpName);
            if ($imageInfo === false) {
                throw new InvalidArgumentException('Imagem invalida ou corrompida.');
            }
        }
    }
}
