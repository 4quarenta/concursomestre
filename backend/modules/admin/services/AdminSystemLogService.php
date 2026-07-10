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

require_once __DIR__ . '/../repositories/AdminSystemLogRepository.php';
require_once __DIR__ . '/../validators/AdminSystemLogValidator.php';
require_once __DIR__ . '/AdminSystemLogAnalyzer.php';

/**
 * Servico do modulo admin para leitura de logs do sistema.
 * Centraliza a regra de negocio e mantem a politica de leitura previsivel.
 */
class AdminSystemLogService
{
    private AdminSystemLogRepository $repository;
    private AdminSystemLogValidator $validator;
    private AdminSystemLogAnalyzer $analyzer;

    /**
     * Inicializa o service com repositorio e validador de logs.
     *
     * @since 1.0.0
     */
    public function __construct(
        AdminSystemLogRepository $repository,
        AdminSystemLogValidator $validator,
        ?AdminSystemLogAnalyzer $analyzer = null
    ) {
        $this->repository = $repository;
        $this->validator = $validator;
        $this->analyzer = $analyzer ?: new AdminSystemLogAnalyzer();
    }

    /**
     * Retorna o payload padronizado do endpoint de logs.
     *
     * @return array{lines: string[], path: string, size_bytes: int, updated_at: ?string, analysis: array<string, mixed>}
     *
     * @since 1.0.0
     */
    public function getLatestLogs(int $maxLines = 100): array
    {
        $logFilePath = $this->repository->getLogFilePath();
        $this->validator->validateReadableLogFile($logFilePath);

        $lines = $this->repository->readLatestLines($maxLines);

        return [
            'lines' => $lines,
            'path' => $logFilePath,
            'size_bytes' => $this->repository->getSizeBytes(),
            'updated_at' => $this->repository->getUpdatedAt(),
            'analysis' => $this->analyzer->analyze($lines),
        ];
    }

    /**
     * Retorna o arquivo completo para download administrativo.
     *
     * @return array{content: string, path: string, size_bytes: int, updated_at: ?string}
     *
     * @since 1.0.0
     */
    public function downloadLogs(): array
    {
        $logFilePath = $this->repository->getLogFilePath();
        $this->validator->validateReadableLogFile($logFilePath);

        return [
            'content' => $this->repository->readAll(),
            'path' => $logFilePath,
            'size_bytes' => $this->repository->getSizeBytes(),
            'updated_at' => $this->repository->getUpdatedAt(),
        ];
    }

    /**
     * Limpa o arquivo de log e retorna o estado atualizado.
     *
     * @return array{lines: string[], path: string, size_bytes: int, updated_at: ?string, cleared: bool, analysis: array<string, mixed>}
     *
     * @since 1.0.0
     */
    public function clearLogs(): array
    {
        $logFilePath = $this->repository->getLogFilePath();
        $this->validator->validateWritableLogFile($logFilePath);
        $this->repository->clear();

        return [
            'lines' => [],
            'path' => $logFilePath,
            'size_bytes' => $this->repository->getSizeBytes(),
            'updated_at' => $this->repository->getUpdatedAt(),
            'cleared' => true,
            'analysis' => $this->analyzer->analyze([]),
        ];
    }
}
