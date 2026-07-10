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
 * Repositorio do dominio de IA.
 * Centraliza a leitura das configuracoes de provedores persistidas.
 *
 * @since 1.0.0
 */
class AiRepository
{
    /**
     * Inicializa o repository com a conexao do banco.
     *
     * @since 1.0.0
     */
    public function __construct(private readonly PDO $db)
    {
    }

    /**
     * Busca a chave Gemini nas configuracoes do sistema.
     *
     * @since 1.0.0
     */
    public function findGeminiApiKey(): ?string
    {
        return $this->findSystemSettingValue('geminiApiKey');
    }

    /**
     * Busca a chave OpenAI nas configuracoes do sistema.
     *
     * @since 1.0.0
     */
    public function findOpenAiApiKey(): ?string
    {
        return $this->findSystemSettingValue('openaiApiKey');
    }

    /**
     * Busca o provedor principal de IA nas configuracoes do sistema.
     *
     * @since 1.0.0
     */
    public function findAiProvider(): ?string
    {
        return $this->findSystemSettingValue('aiProvider');
    }

    /**
     * Busca o modelo Gemini preferencial nas configuracoes do sistema.
     */
    public function findGeminiModel(): ?string
    {
        return $this->findSystemSettingValue('geminiModel');
    }

    /**
     * Busca o modelo OpenAI preferencial nas configuracoes do sistema.
     *
     * @since 1.0.0
     */
    public function findOpenAiModel(): ?string
    {
        return $this->findSystemSettingValue('openAiModel');
    }

    /**
     * Le uma configuracao textual simples, aceitando valor JSON ou valor bruto.
     *
     * @since 1.0.0
     */
    private function findSystemSettingValue(string $keyName): ?string
    {
        $stmt = $this->db->prepare("
            SELECT value_json
            FROM system_settings
            WHERE key_name = :keyName
            LIMIT 1
        ");
        $stmt->execute([':keyName' => $keyName]);
        $value = $stmt->fetchColumn();

        if ($value === false || $value === null) {
            return null;
        }

        $rawValue = trim((string) $value);
        if ($rawValue === '') {
            return null;
        }

        $decoded = json_decode($rawValue, true);
        if (is_string($decoded) && trim($decoded) !== '') {
            return trim($decoded);
        }

        return $rawValue;
    }
}
