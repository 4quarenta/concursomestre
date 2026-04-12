# Stripe Testing Matrix (Admin)

## Objetivo

Padronizar a validacao dos cenarios oficiais de teste da Stripe dentro da plataforma, com rastreabilidade no admin e sem logica paralela no frontend.

Fonte de verdade da matriz:

- Backend: `api/subscriptions/stripe_testing_matrix.php`
- Dominio: `modules/subscriptions` (`SubscriptionsAutomationService::buildStripeTestingMatrixPayload`)
- UI admin: `Admin > Financeiro > Automacao`

Documentacao Stripe usada como referencia:

- `https://docs.stripe.com/testing?testing-method=payment-methods`
- `https://docs.stripe.com/testing?locale=pt-BR&testing-method=card-numbers`
- `https://docs.stripe.com/radar/testing`
- `https://docs.stripe.com/disputes/prevention/card-testing`

## Status de cobertura

- `supported`: fluxo coberto ponta a ponta no produto atual.
- `partial`: depende de configuracao especifica da conta Stripe (ex.: Radar rules) ou de variacao da rede/evento.
- `not_supported`: metodo fora do escopo do checkout interno atual (ex.: debitos bancarios nao-cartao).

## Como a plataforma trata cada categoria

- `success_cards`
  - Executa no checkout inline.
  - Esperado: assinatura/pagamento aprovado, sincronizacao no backend e reflexo no perfil/admin.
- `authentication_3ds`
  - Executa no checkout inline ou no setup de cartao salvo.
  - Esperado: desafio 3DS/autenticacao, conclusao ou erro coerente.
- `declines`
  - Executa no checkout inline e setup quando aplicavel.
  - Esperado: erro financeiro sem ativacao indevida de assinatura.
- `fraud_radar`
  - Executa no checkout inline com regras Radar ativas.
  - Esperado: bloqueio/filtro antifraude conforme regra.
- `disputes_refunds`
  - Executa via webhook/eventos de disputa.
  - Esperado: status financeiro refletido em transacoes e trilha administrativa.
- `non_card_methods`
  - Fora do escopo do checkout interno de assinatura atual.
- `invalid_data`
  - Coberto por validacao de input + Stripe Elements.

## Matriz por caso (o que e feito para cada um)

| Caso | Referencia Stripe | Fluxo na plataforma | Status | O que e feito |
|---|---|---|---|---|
| `card_visa` | `pm_card_visa` | `checkout_inline` | `supported` | Pagamento aprovado e sincronizado no ciclo de assinatura/transacao. |
| `card_mastercard` | `pm_card_mastercard` | `checkout_inline` | `supported` | Mesmo fluxo de aprovacao com Mastercard em teste. |
| `card_amex` | `pm_card_amex` | `checkout_inline` | `supported` | Mesmo fluxo de aprovacao com Amex em teste. |
| `card_discover` | `pm_card_discover` | `checkout_inline` | `supported` | Mesmo fluxo de aprovacao com Discover em teste. |
| `card_unionpay` | `pm_card_unionpay` | `checkout_inline` | `supported` | Mesmo fluxo de aprovacao com UnionPay em teste. |
| `card_br` | `pm_card_br` | `checkout_inline` | `supported` | Aprova cartao regional BR no fluxo inline. |
| `card_au` | `pm_card_au` | `checkout_inline` | `supported` | Aprova cartao regional AU no fluxo inline. |
| `card_gb` | `pm_card_gb` | `checkout_inline` | `supported` | Aprova cartao regional GB no fluxo inline. |
| `card_ca` | `pm_card_ca` | `checkout_inline` | `supported` | Aprova cartao regional CA no fluxo inline. |
| `card_hk` | `pm_card_hk` | `checkout_inline` | `supported` | Aprova cartao regional HK no fluxo inline. |
| `card_sg` | `pm_card_sg` | `checkout_inline` | `supported` | Aprova cartao regional SG no fluxo inline. |
| `card_de` | `pm_card_de` | `checkout_inline` | `supported` | Aprova cartao regional DE no fluxo inline. |
| `auth_required` | `pm_card_authenticationRequired` | `checkout_inline` | `supported` | Exige autenticacao adicional antes da conclusao. |
| `auth_required_setup` | `pm_card_authenticationRequiredOnSetup` | `saved_card_setup` | `supported` | Exige autenticacao no setup intent para salvar cartao. |
| `auth_required_off_session` | `pm_card_authenticationRequiredSetupForOffSession` | `saved_card_setup` | `supported` | Garante setup para cobranca futura off-session (renovacao). |
| `auth_decline_insufficient` | `pm_card_authenticationRequiredChargeDeclinedInsufficientFunds` | `checkout_inline` | `supported` | Depois da autenticacao, trata recusa por saldo insuficiente. |
| `adaptive_3ds` | `pm_card_adaptive3dsChallenge` | `checkout_inline` | `partial` | Cobertura depende de regra/comportamento adaptive da conta Stripe. |
| `decline_generic` | `pm_card_chargeDeclined` | `checkout_inline` | `supported` | Recusa generica sem ativar assinatura; exibe erro consistente. |
| `decline_insufficient` | `pm_card_chargeDeclinedInsufficientFunds` | `checkout_inline` | `supported` | Recusa por saldo insuficiente tratada no checkout e backend. |
| `decline_lost` | `pm_card_chargeDeclinedLostCard` | `checkout_inline` | `supported` | Recusa por cartao perdido com retorno claro no fluxo. |
| `decline_stolen` | `pm_card_chargeDeclinedStolenCard` | `checkout_inline` | `supported` | Recusa por cartao roubado com retorno claro no fluxo. |
| `decline_expired` | `pm_card_chargeDeclinedExpiredCard` | `checkout_inline` | `supported` | Recusa por expiracao + alerta de pagamento no perfil quando aplicavel. |
| `decline_processing_error` | `pm_card_chargeDeclinedProcessingError` | `checkout_inline` | `supported` | Trata erro de processamento sem confirmar assinatura indevida. |
| `decline_incorrect_cvc` | `pm_card_chargeDeclinedIncorrectCvc` | `checkout_inline` | `supported` | Retorno de CVC invalido no checkout. |
| `decline_incorrect_zip` | `pm_card_chargeDeclinedIncorrectZip` | `checkout_inline` | `supported` | Retorno de AVS/zip invalido no checkout. |
| `decline_on_setup` | `pm_card_chargeDeclinedOnAttach` | `saved_card_setup` | `supported` | Falha ao anexar/salvar cartao no cofre Stripe. |
| `radar_block_generic` | `pm_card_radarBlock` | `checkout_inline` | `partial` | Bloqueio depende de regras Radar habilitadas. |
| `radar_block_no_postal` | `pm_card_radarBlockIfPostalCodeNotProvided` | `checkout_inline` | `partial` | Exige regra Radar para ausencia de postal code. |
| `radar_block_postal_fail` | `pm_card_radarBlockIfPostalCodeFails` | `checkout_inline` | `partial` | Exige regra Radar para falha AVS/postal code. |
| `radar_block_no_cvc` | `pm_card_radarBlockIfCvcNotProvided` | `checkout_inline` | `partial` | Exige regra Radar para ausencia de CVC. |
| `radar_block_cvc_fail` | `pm_card_radarBlockIfCvcFails` | `checkout_inline` | `partial` | Exige regra Radar para falha de CVC. |
| `radar_block_fingerprint_present` | `pm_card_radarBlockWhenFingerprintPresent` | `checkout_inline` | `partial` | Exige regra Radar com condicao de fingerprint presente. |
| `radar_block_fingerprint_absent` | `pm_card_radarBlockWhenFingerprintAbsent` | `checkout_inline` | `partial` | Exige regra Radar com condicao de fingerprint ausente. |
| `radar_block_fingerprint_known` | `pm_card_radarBlockWhenFingerprintRecognized` | `checkout_inline` | `partial` | Exige regra Radar com fingerprint reconhecido. |
| `dispute_standard` | `pm_card_createDispute` | `webhook_dispute` | `supported` | Disputa refletida via webhook em status/transacoes/admin. |
| `dispute_product_not_received` | `pm_card_createDisputeProductNotReceived` | `webhook_dispute` | `supported` | Disputa por nao recebimento refletida via webhook. |
| `dispute_inquiry` | `pm_card_createDisputeInquiry` | `webhook_dispute` | `partial` | Cobertura depende de payload/evento de inquiry. |
| `dispute_inquiry_not_received` | `pm_card_createDisputeInquiryNotReceived` | `webhook_dispute` | `partial` | Cobertura depende de payload/evento de inquiry. |
| `dispute_multiple` | `pm_card_createMultipleDisputes` | `webhook_dispute` | `partial` | Exige validar idempotencia e ordem de eventos em lote. |
| `dispute_withdraw_fail` | `pm_card_createDisputeAndFailToWithdraw` | `webhook_dispute` | `partial` | Resultado depende da simulacao da rede para withdraw. |
| `dispute_withdraw_success` | `pm_card_createDisputeAndSucceedToWithdraw` | `webhook_dispute` | `partial` | Resultado depende da simulacao da rede para withdraw. |
| `us_bank_success` | `pm_usBankAccount_success` | `external_method` | `not_supported` | Metodo nao-cartao fora do checkout interno atual. |
| `us_bank_insufficient_funds` | `pm_usBankAccount_insufficientFunds` | `external_method` | `not_supported` | Metodo nao-cartao fora do checkout interno atual. |
| `us_bank_account_closed` | `pm_usBankAccount_accountClosed` | `external_method` | `not_supported` | Metodo nao-cartao fora do checkout interno atual. |
| `us_bank_dispute` | `pm_usBankAccount_dispute` | `external_method` | `not_supported` | Metodo nao-cartao fora do checkout interno atual. |
| `acss_debit_suite` | `see_docs_acss_debit` | `external_method` | `not_supported` | Suite ACSS fora do escopo do checkout atual. |
| `au_becs_suite` | `see_docs_au_becs_debit` | `external_method` | `not_supported` | Suite AU BECS fora do escopo do checkout atual. |
| `bacs_debit_suite` | `see_docs_bacs_debit` | `external_method` | `not_supported` | Suite Bacs fora do escopo do checkout atual. |
| `sepa_debit_suite` | `see_docs_sepa_debit` | `external_method` | `not_supported` | Suite SEPA fora do escopo do checkout atual. |
| `invalid_data_number` | `n/a` | `checkout_inline` | `supported` | Validacao client + Stripe impede numero invalido. |
| `invalid_data_expiry` | `n/a` | `checkout_inline` | `supported` | Validacao client + Stripe impede validade invalida. |
| `invalid_data_cvc` | `n/a` | `checkout_inline` | `supported` | Validacao client + Stripe impede CVC invalido. |

## Padrao do cofre Stripe entre checkout e perfil

- A listagem usa o mesmo service oficial: `cardsService.listSavedCards()`.
- Checkout e perfil leem os metodos salvos do mesmo endpoint oficial (`users/list_cards.php`) com usuario autenticado pela sessao.
- O usuario administra cartoes no perfil:
  - adicionar via `createStripeSetupIntent + syncStripeCard`
  - remover via `removeSavedCard`
  - tornar padrao via `setDefaultSavedCard`
- Regra de seguranca de remocao:
  - cartao vinculado a assinatura recorrente nao pode ser removido sem trocar o padrao antes
  - se for o unico cartao vinculado, a remocao e bloqueada no backend
- Vencimento:
  - cartao vencido/proximo do vencimento gera `paymentIssue` no perfil
  - notificacao deduplicada orienta o usuario a atualizar cartao

## Execucao guiada (admin-only)

- Disponivel apenas para perfil admin em `Admin > Financeiro > Automacao`.
- O botao `Rodar teste` aparece apenas em cenarios `supported`.
- Fluxo:
  1. Admin abre o modal do cenario.
  2. Executa o passo a passo guiado.
  3. Registra resultado (`passed`, `failed`, `blocked`) com evidencias.
  4. A execucao entra no historico de evidencias da matriz.
- Endpoint de historico/registro:
  - `GET/POST api/subscriptions/stripe_testing_runs.php`
- Persistencia:
  - tabela `stripe_testing_matrix_runs`
- Seguranca:
  - acesso protegido por `requireAdminSessionContext`.
  - toda acao grava trilha em `admin_audit_logs`.
