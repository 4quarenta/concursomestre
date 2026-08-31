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
 * Centraliza o material operacional exibido ao admin para cron jobs.
 */
class SubscriptionsAutomationService
{
    /**
     * Monta o payload consumido pelo painel administrativo.
     *
     * @since 1.0.0
     */
    public function buildHelperPayload(string $apiBaseUrl, string $cronSecret): array
    {
        $apiBaseUrl = rtrim($apiBaseUrl, '/');
        $cronUrl = $apiBaseUrl . '/subscriptions/cron_stripe_reconciliation.php?key=' . rawurlencode($cronSecret);

        return [
            'cron_url' => $cronUrl,
            'download_url' => $apiBaseUrl . '/subscriptions/automation_helper.php?action=download_bat',
            'linux_command' => '*/15 * * * * curl -fsS "' . $cronUrl . '" >> /var/log/concursomestre/stripe-cron.log 2>&1',
            'cli_command' => '*/15 * * * * /usr/bin/php /var/www/questao-pro-backend/scripts/tasks/reconcile_stripe_subscriptions.php >> /var/log/concursomestre/stripe-cron.log 2>&1',
            'instructions' => [
                'windows' => [
                    'title' => 'Windows (XAMPP)',
                    'steps' => [
                        'Baixe o arquivo .bat clicando no botao abaixo.',
                        'Abra o "Agendador de Tarefas" do Windows.',
                        'Crie uma nova tarefa basica.',
                        'Configure a execucao recorrente conforme a sua operacao.',
                        'Em "Acao", escolha "Iniciar um programa" e selecione o arquivo .bat baixado.',
                    ],
                ],
                'linux' => [
                    'title' => 'Linux / cPanel',
                    'steps' => [
                        'Acesse o terminal ou a area de Cron Jobs do seu painel.',
                        'Cadastre o comando CLI recomendado abaixo a cada 15 minutos.',
                        'Mantenha a chave secreta somente em ambientes administrativos.',
                    ],
                ],
            ],
        ];
    }

    /**
     * Gera o conteudo do .bat baixado pelo admin para o Agendador do Windows.
     *
     * @since 1.0.0
     */
    public function buildWindowsBatchScript(string $cronUrl): string
    {
        $lines = [
            '@echo off',
            ':: Script de Automacao de Cobranca Recorrente - ConcursoMestre',
            ':: Este script deve ser agendado no Agendador de Tarefas do Windows.',
            '',
            'set CRON_URL=' . $cronUrl,
            '',
            'echo [%date% %time%] Iniciando processamento de cobrancas...',
            'powershell -Command "Invoke-WebRequest -Uri \'%CRON_URL%\' -UseBasicParsing"',
            'echo.',
            'echo Processamento concluido.',
        ];

        return implode("\r\n", $lines) . "\r\n";
    }

    /**
     * Matriz operacional dos cenarios oficiais de teste da Stripe.
     * A matriz combina os casos documentados pela Stripe com o status real de cobertura no produto.
     *
     * @since 1.0.0
     */
    public function buildStripeTestingMatrixPayload(): array
    {
        $cases = [
            // Pagamentos aprovados por cartao
            $this->buildCase('card_visa', 'success_cards', 'Visa aprovado', 'pm_card_visa', 'Pagamento aprovado.', 'supported', 'checkout_inline', 'Cobertura nativa do checkout com Stripe Elements.'),
            $this->buildCase('card_mastercard', 'success_cards', 'Mastercard aprovado', 'pm_card_mastercard', 'Pagamento aprovado.', 'supported', 'checkout_inline', 'Cobertura nativa do checkout com Stripe Elements.'),
            $this->buildCase('card_amex', 'success_cards', 'Amex aprovado', 'pm_card_amex', 'Pagamento aprovado.', 'supported', 'checkout_inline', 'Cobertura nativa do checkout com Stripe Elements.'),
            $this->buildCase('card_discover', 'success_cards', 'Discover aprovado', 'pm_card_discover', 'Pagamento aprovado.', 'supported', 'checkout_inline', 'Cobertura nativa do checkout com Stripe Elements.'),
            $this->buildCase('card_unionpay', 'success_cards', 'UnionPay aprovado', 'pm_card_unionpay', 'Pagamento aprovado.', 'supported', 'checkout_inline', 'Cobertura nativa do checkout com Stripe Elements.'),
            $this->buildCase('card_br', 'success_cards', 'Cartao regional Brasil aprovado', 'pm_card_br', 'Pagamento aprovado.', 'supported', 'checkout_inline', 'Valida cartao regional em modo de teste.'),
            $this->buildCase('card_au', 'success_cards', 'Cartao regional Australia aprovado', 'pm_card_au', 'Pagamento aprovado.', 'supported', 'checkout_inline', 'Valida cartao regional em modo de teste.'),
            $this->buildCase('card_gb', 'success_cards', 'Cartao regional Reino Unido aprovado', 'pm_card_gb', 'Pagamento aprovado.', 'supported', 'checkout_inline', 'Valida cartao regional em modo de teste.'),
            $this->buildCase('card_ca', 'success_cards', 'Cartao regional Canada aprovado', 'pm_card_ca', 'Pagamento aprovado.', 'supported', 'checkout_inline', 'Valida cartao regional em modo de teste.'),
            $this->buildCase('card_hk', 'success_cards', 'Cartao regional Hong Kong aprovado', 'pm_card_hk', 'Pagamento aprovado.', 'supported', 'checkout_inline', 'Valida cartao regional em modo de teste.'),
            $this->buildCase('card_sg', 'success_cards', 'Cartao regional Singapura aprovado', 'pm_card_sg', 'Pagamento aprovado.', 'supported', 'checkout_inline', 'Valida cartao regional em modo de teste.'),
            $this->buildCase('card_de', 'success_cards', 'Cartao regional Alemanha aprovado', 'pm_card_de', 'Pagamento aprovado.', 'supported', 'checkout_inline', 'Valida cartao regional em modo de teste.'),

            // 3DS e autenticacao
            $this->buildCase('auth_required', 'authentication_3ds', 'Autenticacao obrigatoria no pagamento', 'pm_card_authenticationRequired', 'Pagamento exige autenticacao adicional (3DS).', 'supported', 'checkout_inline', 'Fluxo coberto com Stripe PaymentIntent + confirmacao no client.'),
            $this->buildCase('auth_required_setup', 'authentication_3ds', 'Autenticacao obrigatoria no setup', 'pm_card_authenticationRequiredOnSetup', 'SetupIntent exige autenticacao adicional.', 'supported', 'saved_card_setup', 'Coberto no fluxo de salvar cartao Stripe.'),
            $this->buildCase('auth_required_off_session', 'authentication_3ds', 'Autenticação para uso off-session', 'pm_card_authenticationRequiredSetupForOffSession', 'Necessário autenticar para permitir cobrança futura.', 'supported', 'saved_card_setup', 'Importante para renovação automática.'),
            $this->buildCase('auth_decline_insufficient', 'authentication_3ds', 'Autenticacao + saldo insuficiente', 'pm_card_authenticationRequiredChargeDeclinedInsufficientFunds', 'Fluxo autenticado retorna saldo insuficiente.', 'supported', 'checkout_inline', 'Permite validar erro pos-autenticacao.'),
            $this->buildCase('adaptive_3ds', 'authentication_3ds', 'Adaptive acceptance com challenge 3DS', 'pm_card_adaptive3dsChallenge', 'Pagamento pode exigir challenge por adaptive acceptance.', 'partial', 'checkout_inline', 'Depende de regra/modelo da conta Stripe e do comportamento da API no ambiente de teste.'),

            // Recusas
            $this->buildCase('decline_generic', 'declines', 'Recusa generica', 'pm_card_chargeDeclined', 'Pagamento recusado (generic_decline).', 'supported', 'checkout_inline', 'A UI e o backend devem exibir erro consistente sem aprovar assinatura.'),
            $this->buildCase('decline_insufficient', 'declines', 'Saldo insuficiente', 'pm_card_chargeDeclinedInsufficientFunds', 'Pagamento recusado por saldo insuficiente.', 'supported', 'checkout_inline', 'Cobre retorno financeiro de insuficiencia de fundos.'),
            $this->buildCase('decline_lost', 'declines', 'Cartao perdido', 'pm_card_chargeDeclinedLostCard', 'Pagamento recusado por cartao perdido.', 'supported', 'checkout_inline', 'Cobre recusas por motivo de seguranca.'),
            $this->buildCase('decline_stolen', 'declines', 'Cartao roubado', 'pm_card_chargeDeclinedStolenCard', 'Pagamento recusado por cartao roubado.', 'supported', 'checkout_inline', 'Cobre recusas por motivo de seguranca.'),
            $this->buildCase('decline_expired', 'declines', 'Cartao expirado', 'pm_card_chargeDeclinedExpiredCard', 'Pagamento recusado por cartao expirado.', 'supported', 'checkout_inline', 'Conectado aos alertas de vencimento no perfil do usuario.'),
            $this->buildCase('decline_processing_error', 'declines', 'Erro de processamento', 'pm_card_chargeDeclinedProcessingError', 'Pagamento recusado por processing_error.', 'supported', 'checkout_inline', 'Valida mensagens e reprocessamento de tentativa.'),
            $this->buildCase('decline_incorrect_cvc', 'declines', 'CVC incorreto', 'pm_card_chargeDeclinedIncorrectCvc', 'Pagamento recusado por CVC incorreto.', 'supported', 'checkout_inline', 'Valida tratamento de erro de dados de seguranca.'),
            $this->buildCase('decline_incorrect_zip', 'declines', 'CEP incorreto', 'pm_card_chargeDeclinedIncorrectZip', 'Pagamento recusado por endereco/zip.', 'supported', 'checkout_inline', 'Valida retorno de AVS em checkout.'),
            $this->buildCase('decline_on_setup', 'declines', 'Recusa ao anexar cartao ao cliente', 'pm_card_chargeDeclinedOnAttach', 'Falha no setup/anexo do metodo de pagamento.', 'supported', 'saved_card_setup', 'Valida erro no fluxo de cofre Stripe.'),

            // Radar / fraude
            $this->buildCase('radar_block_generic', 'fraud_radar', 'Bloqueio por Radar', 'pm_card_radarBlock', 'Pagamento bloqueado por regra antifraude.', 'partial', 'checkout_inline', 'O bloqueio depende de regras Radar habilitadas na conta Stripe.'),
            $this->buildCase('radar_block_no_postal', 'fraud_radar', 'Bloqueio por falta de postal code', 'pm_card_radarBlockIfPostalCodeNotProvided', 'Bloqueio se postal code estiver ausente.', 'partial', 'checkout_inline', 'Depende de regra Radar configurada para postal code.'),
            $this->buildCase('radar_block_postal_fail', 'fraud_radar', 'Bloqueio por postal code invalido', 'pm_card_radarBlockIfPostalCodeFails', 'Bloqueio quando postal code falha.', 'partial', 'checkout_inline', 'Depende de regra Radar configurada para AVS.'),
            $this->buildCase('radar_block_no_cvc', 'fraud_radar', 'Bloqueio por CVC ausente', 'pm_card_radarBlockIfCvcNotProvided', 'Bloqueio quando CVC nao e informado.', 'partial', 'checkout_inline', 'Depende de regra Radar configurada para CVC.'),
            $this->buildCase('radar_block_cvc_fail', 'fraud_radar', 'Bloqueio por CVC invalido', 'pm_card_radarBlockIfCvcFails', 'Bloqueio quando CVC falha.', 'partial', 'checkout_inline', 'Depende de regra Radar configurada para CVC.'),
            $this->buildCase('radar_block_fingerprint_present', 'fraud_radar', 'Bloqueio com fingerprint presente', 'pm_card_radarBlockWhenFingerprintPresent', 'Bloqueio condicionado a device/card fingerprint.', 'partial', 'checkout_inline', 'Depende de regra Radar com fingerprint.'),
            $this->buildCase('radar_block_fingerprint_absent', 'fraud_radar', 'Bloqueio sem fingerprint', 'pm_card_radarBlockWhenFingerprintAbsent', 'Bloqueio condicionado a ausencia de fingerprint.', 'partial', 'checkout_inline', 'Depende de regra Radar com fingerprint.'),
            $this->buildCase('radar_block_fingerprint_known', 'fraud_radar', 'Bloqueio com fingerprint reconhecido', 'pm_card_radarBlockWhenFingerprintRecognized', 'Bloqueio para fingerprint reconhecido.', 'partial', 'checkout_inline', 'Depende de regra Radar com fingerprint.'),

            // Disputas e reembolso
            $this->buildCase('dispute_standard', 'disputes_refunds', 'Criar disputa padrao', 'pm_card_createDispute', 'Disputa criada no webhook de charge/dispute.', 'supported', 'webhook_dispute', 'A plataforma deve refletir status e trilha de auditoria.'),
            $this->buildCase('dispute_product_not_received', 'disputes_refunds', 'Disputa por produto nao recebido', 'pm_card_createDisputeProductNotReceived', 'Disputa com motivo product_not_received.', 'supported', 'webhook_dispute', 'Cobertura do fluxo de disputa e status financeiro.'),
            $this->buildCase('dispute_inquiry', 'disputes_refunds', 'Abrir inquiry', 'pm_card_createDisputeInquiry', 'Abre inquiry antes da disputa formal.', 'partial', 'webhook_dispute', 'Cobertura parcial: fluxo depende da modalidade de rede e payload recebido.'),
            $this->buildCase('dispute_inquiry_not_received', 'disputes_refunds', 'Inquiry por nao recebimento', 'pm_card_createDisputeInquiryNotReceived', 'Inquiry com motivo de nao recebimento.', 'partial', 'webhook_dispute', 'Cobertura parcial: depende do tipo de webhook/inquiry habilitado.'),
            $this->buildCase('dispute_multiple', 'disputes_refunds', 'Multiplas disputas', 'pm_card_createMultipleDisputes', 'Gera mais de uma disputa em sequencia.', 'partial', 'webhook_dispute', 'Cobertura parcial: exige monitorar idempotencia e deduplicacao por evento.'),
            $this->buildCase('dispute_withdraw_fail', 'disputes_refunds', 'Falha ao retirar disputa', 'pm_card_createDisputeAndFailToWithdraw', 'Tentativa de retirada da disputa falha.', 'partial', 'webhook_dispute', 'Depende da resposta da rede no ambiente de teste.'),
            $this->buildCase('dispute_withdraw_success', 'disputes_refunds', 'Retirada da disputa com sucesso', 'pm_card_createDisputeAndSucceedToWithdraw', 'Retirada da disputa finalizada com sucesso.', 'partial', 'webhook_dispute', 'Depende da resposta da rede no ambiente de teste.'),

            // Debito bancario EUA (exemplos oficiais de teste Stripe)
            $this->buildCase('us_bank_success', 'non_card_methods', 'US bank debit aprovado', 'pm_usBankAccount_success', 'Pagamento ACH aprovado.', 'not_supported', 'external_method', 'Checkout interno atual e focado em cartao/pix para assinatura.'),
            $this->buildCase('us_bank_insufficient_funds', 'non_card_methods', 'US bank saldo insuficiente', 'pm_usBankAccount_insufficientFunds', 'Falha por saldo insuficiente no debito bancario.', 'not_supported', 'external_method', 'Metodo nao disponivel no checkout interno atual.'),
            $this->buildCase('us_bank_account_closed', 'non_card_methods', 'US bank conta encerrada', 'pm_usBankAccount_accountClosed', 'Falha por conta encerrada.', 'not_supported', 'external_method', 'Metodo nao disponivel no checkout interno atual.'),
            $this->buildCase('us_bank_dispute', 'non_card_methods', 'US bank disputa', 'pm_usBankAccount_dispute', 'Disputa em debito bancario.', 'not_supported', 'external_method', 'Metodo nao disponivel no checkout interno atual.'),
            $this->buildCase('acss_debit_suite', 'non_card_methods', 'ACSS Debit (suite oficial Stripe)', 'see_docs_acss_debit', 'Cenarios de aprovado, falha e contestacao em ACSS.', 'not_supported', 'external_method', 'Metodo nao disponivel no checkout interno atual. Analise pela matriz e docs oficiais.'),
            $this->buildCase('au_becs_suite', 'non_card_methods', 'AU BECS Direct Debit (suite oficial Stripe)', 'see_docs_au_becs_debit', 'Cenarios de aprovado, falha e contestacao em AU BECS.', 'not_supported', 'external_method', 'Metodo nao disponivel no checkout interno atual. Analise pela matriz e docs oficiais.'),
            $this->buildCase('bacs_debit_suite', 'non_card_methods', 'Bacs Direct Debit (suite oficial Stripe)', 'see_docs_bacs_debit', 'Cenarios de aprovado, falha e contestacao em Bacs.', 'not_supported', 'external_method', 'Metodo nao disponivel no checkout interno atual. Analise pela matriz e docs oficiais.'),
            $this->buildCase('sepa_debit_suite', 'non_card_methods', 'SEPA Direct Debit (suite oficial Stripe)', 'see_docs_sepa_debit', 'Cenarios de aprovado, falha e contestacao em SEPA.', 'not_supported', 'external_method', 'Metodo nao disponivel no checkout interno atual. Analise pela matriz e docs oficiais.'),

            // Casos de validacao de dados
            $this->buildCase('invalid_data_number', 'invalid_data', 'Numero de cartao invalido', 'n/a', 'Validacao client-side e Stripe rejeitam numero invalido.', 'supported', 'checkout_inline', 'Coberto por Stripe Elements + validacoes de formulario.'),
            $this->buildCase('invalid_data_expiry', 'invalid_data', 'Validade invalida', 'n/a', 'Validacao client-side e Stripe rejeitam validade invalida.', 'supported', 'checkout_inline', 'Coberto por Stripe Elements + validacoes de formulario.'),
            $this->buildCase('invalid_data_cvc', 'invalid_data', 'CVC invalido', 'n/a', 'Validacao client-side e Stripe rejeitam CVC invalido.', 'supported', 'checkout_inline', 'Coberto por Stripe Elements + validacoes de formulario.'),
        ];

        $cases = array_map(function (array $case): array {
            $status = strtolower((string) ($case['platform_status'] ?? ''));
            $flow = strtolower((string) ($case['platform_flow'] ?? ''));
            $case['can_execute'] = $status === 'supported';
            $case['execution_steps'] = $this->buildExecutionGuideByFlow($flow, $status);
            return $case;
        }, $cases);

        $summary = [
            'total' => count($cases),
            'supported' => 0,
            'partial' => 0,
            'not_supported' => 0,
        ];

        foreach ($cases as $case) {
            $status = (string) ($case['platform_status'] ?? '');
            if (array_key_exists($status, $summary)) {
                $summary[$status]++;
            }
        }

        return [
            'generated_at' => gmdate(DATE_ATOM),
            'source' => [
                [
                    'title' => 'Stripe - Testing payment methods',
                    'url' => 'https://docs.stripe.com/testing?testing-method=payment-methods',
                ],
                [
                    'title' => 'Stripe - Testing card numbers',
                    'url' => 'https://docs.stripe.com/testing?locale=pt-BR&testing-method=card-numbers',
                ],
                [
                    'title' => 'Stripe - Radar testing',
                    'url' => 'https://docs.stripe.com/radar/testing',
                ],
                [
                    'title' => 'Stripe - Prevent card testing attacks',
                    'url' => 'https://docs.stripe.com/disputes/prevention/card-testing',
                ],
            ],
            'categories' => [
                ['id' => 'success_cards', 'label' => 'Pagamentos aprovados por cartao'],
                ['id' => 'authentication_3ds', 'label' => 'Autenticacao e 3DS'],
                ['id' => 'declines', 'label' => 'Pagamentos recusados'],
                ['id' => 'fraud_radar', 'label' => 'Fraude e Radar'],
                ['id' => 'disputes_refunds', 'label' => 'Disputas e reembolsos'],
                ['id' => 'non_card_methods', 'label' => 'Metodos nao-cartao da Stripe'],
                ['id' => 'invalid_data', 'label' => 'Dados invalidos'],
            ],
            'summary' => $summary,
            'cases' => $cases,
        ];
    }

    /**
     * Define o passo a passo guiado por tipo de fluxo para execucao no admin.
     *
     * @since 1.0.0
     */
    private function buildExecutionGuideByFlow(string $flow, string $status): array
    {
        if ($status !== 'supported') {
            return [
                'Cenario sem execucao guiada direta no produto atual.',
                'Use a documentacao oficial Stripe para validacao complementar.',
            ];
        }

        if ($flow === 'saved_card_setup') {
            return [
                'Abra checkout interno e escolha salvar novo cartao.',
                'Use o metodo de teste Stripe informado na referencia do cenario.',
                'Confirme o setup e finalize a assinatura.',
                'Registre o resultado e as evidencias (PaymentIntent/Subscription).',
            ];
        }

        if ($flow === 'webhook_dispute') {
            return [
                'Execute pagamento de teste elegivel para disputa.',
                'Dispare o evento de disputa no ambiente Stripe de teste.',
                'Valide sincronizacao em transacoes/admin via webhook.',
                'Registre o resultado e IDs de evidencia.',
            ];
        }

        return [
            'Abra checkout interno com plano de teste.',
            'Informe o metodo Stripe de referencia do cenario.',
            'Conclua o fluxo e valide comportamento no app.',
            'Registre o resultado e as evidencias (PaymentIntent/Subscription/Transaction).',
        ];
    }

    /**
     * Helper para padronizar cada caso da matriz.
     *
     * @since 1.0.0
     */
    private function buildCase(
        string $id,
        string $categoryId,
        string $scenario,
        string $stripeReference,
        string $expectedOutcome,
        string $platformStatus,
        string $platformFlow,
        string $notes
    ): array {
        return [
            'id' => $id,
            'category_id' => $categoryId,
            'scenario' => $scenario,
            'stripe_reference' => $stripeReference,
            'expected_outcome' => $expectedOutcome,
            'platform_status' => $platformStatus,
            'platform_flow' => $platformFlow,
            'notes' => $notes,
        ];
    }
}
