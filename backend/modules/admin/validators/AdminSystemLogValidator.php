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
 * Validador do fluxo de leitura de logs administrativos.
 * Mantem as pre-condicoes explicitas antes de qualquer leitura em disco.
 */
class AdminSystemLogValidator
{
    /**
     * Garante que o arquivo de log existe e pode ser lido.
     *
     * @since 1.0.0
     */
    public function validateReadableLogFile(string $logFilePath): void
    {
        if (!file_exists($logFilePath)) {
            throw new InvalidArgumentException("Arquivo de log nao encontrado em {$logFilePath}");
        }

        if (!is_readable($logFilePath)) {
            throw new RuntimeException('Arquivo de log sem permissao de leitura.');
        }
    }

    /**
     * Garante que o arquivo de log tambem pode ser truncado pelo admin.
     *
     * @since 1.0.0
     */
    public function validateWritableLogFile(string $logFilePath): void
    {
        $this->validateReadableLogFile($logFilePath);

        if (!is_writable($logFilePath)) {
            throw new RuntimeException('Arquivo de log sem permissao de escrita.');
        }
    }
}
