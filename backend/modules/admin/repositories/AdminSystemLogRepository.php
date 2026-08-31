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

/**
 * Repositorio responsavel por ler trechos do arquivo de log do servidor.
 * Mantem a logica de acesso ao arquivo isolada da camada HTTP e da regra de negocio.
 */
class AdminSystemLogRepository
{
    private string $logFilePath;

    /**
     * Inicializa o repositorio com o caminho do arquivo de log.
     *
     * @since 1.0.0
     */
    public function __construct(string $logFilePath)
    {
        $this->logFilePath = $logFilePath;
    }

    /**
     * Retorna o caminho absoluto do arquivo de log.
     *
     * @since 1.0.0
     */
    public function getLogFilePath(): string
    {
        return $this->logFilePath;
    }

    /**
     * Le as ultimas linhas do arquivo de log com suporte a arquivos pequenos.
     *
     * @return string[]
     *
     * @since 1.0.0
     */
    public function readLatestLines(int $maxLines = 100): array
    {
        $lines = file($this->logFilePath, FILE_IGNORE_NEW_LINES);
        if ($lines === false) {
            throw new RuntimeException('Nao foi possivel ler o arquivo de log.');
        }

        $lines = array_values(array_filter(
            array_map(static fn ($line): string => trim((string) $line), $lines),
            static fn (string $line): bool => $line !== ''
        ));

        return array_slice($lines, -max(1, $maxLines));
    }

    /**
     * Le o conteudo completo do log para download administrativo.
     *
     * @since 1.0.0
     */
    public function readAll(): string
    {
        $content = file_get_contents($this->logFilePath);
        if ($content === false) {
            throw new RuntimeException('Nao foi possivel ler o arquivo de log.');
        }

        return $content;
    }

    /**
     * Esvazia o arquivo de log mantendo o arquivo no mesmo caminho.
     *
     * @since 1.0.0
     */
    public function clear(): void
    {
        if (file_put_contents($this->logFilePath, '') === false) {
            throw new RuntimeException('Nao foi possivel limpar o arquivo de log.');
        }
    }

    /**
     * Retorna o tamanho atual do arquivo em bytes.
     *
     * @since 1.0.0
     */
    public function getSizeBytes(): int
    {
        $size = filesize($this->logFilePath);
        return $size === false ? 0 : (int) $size;
    }

    /**
     * Retorna a data de alteracao do arquivo em ISO-8601 UTC.
     *
     * @since 1.0.0
     */
    public function getUpdatedAt(): ?string
    {
        $timestamp = filemtime($this->logFilePath);
        return $timestamp === false ? null : gmdate(DATE_ATOM, $timestamp);
    }
}
