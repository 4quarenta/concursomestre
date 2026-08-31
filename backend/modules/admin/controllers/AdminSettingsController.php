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

require_once __DIR__ . '/../services/AdminSettingsService.php';

/**
 * Controller HTTP das configuracoes sistemicas.
 * Mantem a rota fina e delega leitura/escrita para o service do modulo admin.
 */
class AdminSettingsController
{
    private AdminSettingsService $service;

    /**
     * Inicializa o controller com o servico de configuracoes.
     *
     * @since 1.0.0
     */
    public function __construct(AdminSettingsService $service)
    {
        $this->service = $service;
    }

    /**
     * Retorna as configuracoes atuais para o painel.
     *
     * @since 1.0.0
     */
    public function show(?array $authPayload): array
    {
        return $this->service->getSettings($authPayload);
    }

    /**
     * Atualiza as configuracoes do sistema.
     *
     * @since 1.0.0
     */
    public function update(array $payload): array
    {
        return $this->service->updateSettings($payload);
    }

    /**
     * Executa um teste operacional de SMTP a partir do painel.
     *
     * @since 1.0.0
     */
    public function testSmtp(array $payload): array
    {
        return $this->service->testSmtp($payload);
    }

    /**
     * Envia um e-mail de teste usando um modelo editavel.
     *
     * @since 1.0.0
     */
    public function testEmailTemplate(array $payload): array
    {
        return $this->service->testEmailTemplate($payload);
    }

    /**
     * Executa um diagnostico das integracoes configuradas.
     *
     * @since 1.0.0
     */
    public function testIntegrations(array $payload): array
    {
        return $this->service->testIntegrations($payload);
    }
}
