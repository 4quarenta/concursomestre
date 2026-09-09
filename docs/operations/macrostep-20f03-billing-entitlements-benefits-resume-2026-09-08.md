# Macrostep 20F-03 - Retomada e fechamento parcial

Data: 2026-09-08
Ambiente: produção PRELAUNCH

## Contexto

Esta execução retomou a implementação interrompida de Billing, Entitlements,
Benefits e Refund Retention. O trabalho legítimo foi preservado. A correção de
documentação do roadmap já estava incorporada ao blueprint canônico e M20F-04
e M20F-07 permaneceram fora da execução.
Durante a prova da expiração foi encontrado e corrigido um defeito temporal
real: timestamps DATETIME(6) não eram comparados de forma confiável por
`strtotime()`.

## Decisão de produto - PIX deferido

Durante esta retomada o proprietário definiu `PAYMENT_METHODS_AT_LAUNCH =
CARD_ONLY`, com foco em assinaturas recorrentes. A tentativa de adicionar
preço PIX foi removida antes de qualquer migration ou mutação de dados. A
política CARD-only foi aplicada no checkout e no backend, publicada no release
`775263779072c39fe0826cd8a8cfbeb9e65ac921` e verificada em PRELAUNCH; não há
opção PIX inacabada exposta ao usuário.

O TODO `PLAN-SPECIFIC-PIX-PAYMENT-AND-PRICING` foi registrado no blueprint
autoritativo como `DEFERRED_POST_LAUNCH`. Ele deverá, em execução futura,
auditar o contrato real do provedor antes de definir se PIX será avulso ou
recorrente e então tratar preço independente por plano, autoridade server-side,
snapshot, reconciliação, webhooks, reembolso e aceitação de interface. Nenhum
preço ilustrativo foi adotado.

## Resume ledger

```text
RESUME_FROM_INTERRUPTED_M20F03 = PASS
CURRENT_WORKTREE_RECOVERED = PASS
IN_PROGRESS_M20F03_FILES_PRESERVED = 0 (código canônico já commitado no push worktree)
DOCUMENTATION_ONLY_FILES = 14 (relatórios preexistentes preservados no worktree de trabalho)
UNKNOWN_WORKTREE_CHANGES = 0
LAST_COMPLETED_M20F03_GATE = RETENTION_EXPIRY_INTEGRATION_AFTER_FIX
NEXT_RESUMED_GATE = RETENTION_FINANCIAL_CLOCK_AND_BROWSER_ACCEPTANCE
```

## Release e deploy

```text
ACTIVE_PRODUCTION_RELEASE = 775263779072c39fe0826cd8a8cfbeb9e65ac921
ORIGIN_1_0_0 = 6d78a4d810464df9e2d19813a3044ecfa2c95df5
ACTIVE_RELEASE_IN_CANONICAL_HISTORY = PASS
DEPLOYMENT = PASS (PRELAUNCH, runtime release 775263... preserved)
```

O endpoint canônico de health confirmou `commit=77526377...`, readiness retornou
`ready=true`, `pending migrations=0` e `checksum drift=0`. Home retornou 200.
O sitemap retornou 503 com `X-Robots-Tag: noindex, nofollow`. O PHP dos dois
arquivos afetados passou lint no release ativo.

## Alterações efetivadas

- Oferta de retenção usa `offered_days` inteiro definido pelo Admin, limitado a
  1..366, sem valor de negócio fixo.
- `RETENTION_DAYS_MIN=1`; `RETENTION_DAYS_MAX_AUTHORITY=HARDCODED_TECHNICAL_GUARD`.
  O limite 366 é uma guarda técnica existente, não um número de negócio
  aplicado automaticamente.
- A renovação estimada preserva o fuso da representação usada pelo snapshot do
  provedor; a divergência UTC/local foi corrigida.
- Refund Retention passa por BenefitService e BillingExtensionService, com
  eventos de domínio idempotentes e sem mutação direta do plano pago.
- Mutations de refund e retenção passaram a usar o guard CSRF canônico.
- O cron de reconciliação agora processa ofertas vencidas em lote limitado,
  com transição idempotente para `EXPIRED` e encaminhamento pelo refund
  canônico; a comparação de datas aceita precisão de microssegundos.
- Foram preservados eventos transport-neutral para futura ingestão pelo M20F-07;
  nenhuma plataforma global de notificações/email foi iniciada.
- A decisão concorrente `ACCEPTED_PENDING_BENEFIT` agora bloqueia `DECLINE` até
  a resolução do Benefit, impedindo sucesso financeiro simultâneo de retenção e
  reembolso; lint PHP e contrato de retenção passaram.

Commits canônicos publicados em `origin/1.0.0`:

```text
8bc60a5ce1f2ef073e11bdfe57a057af73e64e32 fix(refunds): lock retention decision outcome
775263779072c39fe0826cd8a8cfbeb9e65ac921 fix(refunds): make repeated retention decline idempotent
62948812de670906c66ef096466dbfcf19be9b8b chore(billing): defer pix at launch
50f09b44a67f0c23de8649717ca70395d9e8ecee refactor(admin): extract retention offer fields
b184d8652f425a2adfeac620791720b5e40e2ec8 fix(billing): preserve retention renewal timezone
553b4ee083e42122ac05a8484f403ee04a588104 fix(billing): enforce csrf on refund mutations
d0bcce74a7318f26a3b168fac8a2f6c209fce2de fix(billing): handle fractional retention expiry timestamps
```

## Evidência Stripe TEST

```text
STRIPE_TEST_OPERATIONAL_SUITE = GO
SCENARIOS = 7
OK = 7
RISCO = 0
CRITICO = 0
NAO_COMPROVADO = 0
STRIPE_TEST_LIVEMODE_FALSE = PASS
PROVIDER_LOCAL_RECONCILIATION_BASIC_PATH = PASS
```

A suíte cobriu renovação ponta a ponta, ciclo automático, concorrência de
refund e eventos Stripe duplicados, atrasados e fora de ordem. Nesta retomada,
os 4 cenários de lifecycle e os 3 cenários de webhook foram repetidos com
`CM_SYNTHETIC_EMAIL_SINK=1`, totalizando `GO` sem entrega externa.

Estado da Wave 3 após a geração e execução do denominador formal:

```text
OLD_RENEWAL_DATE_NO_CHARGE_AFTER_RETENTION_EXTENSION = PASS
OLD_RENEWAL_DATE_RETENTION_CHARGE_COUNT = 0
CORRECT_EXTENDED_DATE_RENEWAL_AFTER_RETENTION_EXTENSION = PASS
RETENTION_EXTENDED_DATE_RENEWAL_COUNT = 1
RETENTION_DOUBLE_CHARGE_COUNT = 0
PROVIDER_LOCAL_RECONCILIATION = PASS
FULL_PROVIDER_FAILURE_RECONCILIATION_MATRIX = PASS
FULL_BILLING_SUPPORTED_COMBINATION_MATRIX = PASS
WAVE_3_BILLING_DENOMINATOR = PASS
WAVE_3_BILLING_DENOMINATOR_FILE = scripts/checks/output/m20f03-billing-denominator.json
BILLING_CANDIDATE_COMBINATIONS = 81
BILLING_SUPPORTED_STATE_COMBINATIONS = 65
BILLING_COMBINATIONS_TESTED = 81
BILLING_INVALID_TRANSITIONS = 3
BILLING_PRODUCT_POLICY_DENIED = 6
BILLING_PROVIDER_UNSUPPORTED = 0
BILLING_NOT_APPLICABLE = 7
BILLING_UNCLASSIFIED_COMBINATIONS = 0
BILLING_AMBIGUOUS_COMBINATIONS = 0
BILLING_UNTESTED_SUPPORTED_COMBINATIONS = 0
FULL_REFUND_RETENTION_DECLINE_EXPIRY_CONCURRENCY = PASS
```

O denominador é machine-readable, possui uma linha por candidato, classificação
única, autoridade de classificação, resultado e referência de evidência. Ele
inclui somente a política de pagamento CARD_ONLY no lançamento; PIX foi
classificado como PRODUCT_POLICY_DENIED e não entra no conjunto suportado.
As operações sem uma entrada canônica no modelo atual foram classificadas como
NOT_APPLICABLE, e o Level Reward permanece negado enquanto
DISABLED_PENDING_GATES.

A execução local dos contratos que sustentam a matriz passou em 7 de 8 arquivos
PHP selecionados. O único arquivo não executado foi
`StripePaymentRecoveryPolicyTest.php`, bloqueado antes das asserções porque este
worktree não contém `backend/vendor/autoload.php`; isso não foi contado como
falha de produto nem como combinação suportada sem evidência. A suíte Vitest
canônica passou integralmente (163 arquivos, 941 testes), e a integridade da
partição do ledger passou de forma independente.

## Retention offer

O ensaio de aceite já preservado provou `N=5` escolhido pelo Admin, paridade da
data esperada, extensão Stripe TEST, grant `APPLIED`, oferta
`CLOSED_RETAINED`, eventos de domínio e zero duplicidade de benefício/reembolso.

Em seguida, a matriz de concorrência foi executada em casos isolados, cada um
com barreira real (`pcntl_fork`), ledger persistente gravado antes da limpeza e
verificação de limpeza. A1 foi preservado da execução anterior e A2-A11 foram
executados individualmente. O ledger final contém 11/11 casos aprovados, sem
efeito financeiro duplicado; nos casos de aceite A2, A7 e A9, a contagem real de
grants `APPLIED` foi 1 e, nos demais, foi 0.

```text
RETENTION_CONCURRENCY_CASES_TOTAL = 11
RETENTION_CONCURRENCY_CASES_PASSED = 11
RETENTION_CONCURRENCY_CASES_FAILED = 0
RETENTION_CONCURRENCY_CASES_NOT_EXECUTED = 0
REFUND_AND_RETENTION_SIMULTANEOUS_SUCCESS = 0
DUPLICATE_RETENTION_BENEFIT = 0
DUPLICATE_RETENTION_REFUND = 0
DUPLICATE_EXPIRY_REFUND = 0
RETENTION_LEDGER_CLEANUP = PASS (11/11)
```

Ledger sanitizado persistido para auditoria da execução:

```json
{
  "suite": "refund_retention_concurrency",
  "total": 11,
  "passed": 11,
  "cases": [
    {"case_id":"A1","operation_a":"accept","operation_b":"decline","result_a":"DomainException","result_b":"SUCCESS","final_state":"RETENTION_OFFER_REJECTED/refunded","refund_count":1,"benefit_count":0,"provider_extension_count":0,"domain_event_count":2,"duplicate_financial_effect":false,"cleanup":"PASS","evidence_reference":"previous real barrier run"},
    {"case_id":"A2","operation_a":"accept","operation_b":"admin_refund","result_a":"SUCCESS","result_b":"DomainException","final_state":"CLOSED_RETAINED/refund_retained","refund_count":0,"benefit_count":1,"provider_extension_count":1,"domain_event_count":3,"duplicate_financial_effect":false,"cleanup":"PASS"},
    {"case_id":"A3","operation_a":"decline","operation_b":"admin_refund","result_a":"SUCCESS","result_b":"DomainException","final_state":"RETENTION_OFFER_REJECTED/refunded","refund_count":1,"benefit_count":0,"provider_extension_count":0,"domain_event_count":2,"duplicate_financial_effect":false,"cleanup":"PASS"},
    {"case_id":"A4","operation_a":"accept","operation_b":"expiry","result_a":"DomainException","result_b":"SUCCESS","final_state":"EXPIRED/refunded","refund_count":1,"benefit_count":0,"provider_extension_count":0,"domain_event_count":2,"duplicate_financial_effect":false,"cleanup":"PASS"},
    {"case_id":"A5","operation_a":"decline","operation_b":"expiry","result_a":"SUCCESS","result_b":"SUCCESS","final_state":"EXPIRED/refunded","refund_count":1,"benefit_count":0,"provider_extension_count":0,"domain_event_count":2,"duplicate_financial_effect":false,"cleanup":"PASS"},
    {"case_id":"A6","operation_a":"expiry","operation_b":"expiry","result_a":"SUCCESS","result_b":"SUCCESS","final_state":"EXPIRED/refunded","refund_count":1,"benefit_count":0,"provider_extension_count":0,"domain_event_count":2,"duplicate_financial_effect":false,"cleanup":"PASS"},
    {"case_id":"A7","operation_a":"accept","operation_b":"accept","result_a":"SUCCESS","result_b":"DomainException","final_state":"CLOSED_RETAINED/refund_retained","refund_count":0,"benefit_count":1,"provider_extension_count":1,"domain_event_count":3,"duplicate_financial_effect":false,"cleanup":"PASS"},
    {"case_id":"A8","operation_a":"decline","operation_b":"decline","result_a":"SUCCESS","result_b":"SUCCESS","final_state":"RETENTION_OFFER_REJECTED/refunded","refund_count":1,"benefit_count":0,"provider_extension_count":0,"domain_event_count":2,"duplicate_financial_effect":false,"cleanup":"PASS"},
    {"case_id":"A9","operation_a":"accept","operation_b":"admin_refund","result_a":"SUCCESS","result_b":"DomainException","final_state":"CLOSED_RETAINED/refund_retained","refund_count":0,"benefit_count":1,"provider_extension_count":1,"domain_event_count":3,"duplicate_financial_effect":false,"cleanup":"PASS"},
    {"case_id":"A10","operation_a":"accept","operation_b":"expiry","result_a":"SUCCESS","result_b":"SUCCESS","final_state":"EXPIRED/refunded","refund_count":1,"benefit_count":0,"provider_extension_count":0,"domain_event_count":2,"duplicate_financial_effect":false,"cleanup":"PASS"},
    {"case_id":"A11","operation_a":"admin_refund","operation_b":"admin_refund","result_a":"RuntimeException","result_b":"SUCCESS","final_state":"NONE/refunded","refund_count":1,"benefit_count":0,"provider_extension_count":0,"domain_event_count":0,"duplicate_financial_effect":false,"cleanup":"PASS"}
  ]
}
```

## Wave 2 — falhas de provedor

Wave 2 foi concluída com dez invocações SSH independentes, dez processos PHP
isolados e um arquivo atômico de evidência por caso. P1/P2 usaram falha no
adapter antes da confirmação; P3/P4/P8/P10 executaram a operação real no
Stripe TEST e injetaram a falha após o sucesso; P5/P6/P7 provaram idempotência e
convergência; P9 percorreu o aceite real da oferta de retenção e preservou o
refund recuperável quando a assinatura foi cancelada antes da extensão. Não
houve Stripe LIVE nem confirmação local falsa.

```text
PROVIDER_FAILURE_CASES_TOTAL = 10
PROVIDER_FAILURE_CASES_PASSED = 10
PROVIDER_FAILURE_CASES_FAILED_PRODUCT = 0
PROVIDER_FAILURE_CASES_NOT_EXECUTED_ENVIRONMENT = 0
PROVIDER_FAILURE_CASES_NOT_EXECUTED_SAFETY = 0
PROVIDER_FAILURE_FAILED_CASE_IDS = NONE
PROVIDER_FAILURE_NOT_EXECUTED_CASE_IDS = NONE
FULL_PROVIDER_FAILURE_RECONCILIATION_MATRIX = PASS
LOCAL_FALSE_PROVIDER_CONFIRMATION = 0
DUPLICATE_PROVIDER_EXTENSION = 0
STUCK_PROVIDER_PENDING_WITHOUT_RECOVERY = 0
UNRESOLVED_PROVIDER_LOCAL_DRIFT = 0
RETENTION_ACCEPTANCE_WITHOUT_CONFIRMED_BENEFIT = 0
PROVIDER_EVIDENCE_CLEANUP = PASS
```

Ledger agregado sanitizado da Wave 2:

```json
{"suite":"provider_failure_reconciliation","total":10,"passed":10,"cases":[
  {"case_id":"P1","status":"PASS","local_final_state":"RECONCILIATION_REQUIRED","provider_final_state":"NOT_APPLIED","provider_effect_count":0,"false_local_confirmation":0,"duplicate_provider_effect":0,"unresolved_drift":0,"cleanup":"PASS"},
  {"case_id":"P2","status":"PASS","local_final_state":"RECONCILIATION_REQUIRED","provider_final_state":"NOT_APPLIED","provider_effect_count":0,"false_local_confirmation":0,"duplicate_provider_effect":0,"unresolved_drift":0,"cleanup":"PASS"},
  {"case_id":"P3","status":"PASS","local_final_state":"APPLIED","provider_final_state":"APPLIED","reconciliation_result":"PASS","provider_effect_count":1,"false_local_confirmation":0,"duplicate_provider_effect":0,"unresolved_drift":0,"cleanup":"PASS"},
  {"case_id":"P4","status":"PASS","local_final_state":"APPLIED","provider_final_state":"APPLIED","reconciliation_result":"PASS","provider_effect_count":1,"false_local_confirmation":0,"duplicate_provider_effect":0,"unresolved_drift":0,"cleanup":"PASS"},
  {"case_id":"P5","status":"PASS","local_final_state":"APPLIED","provider_final_state":"APPLIED","reconciliation_result":"IDEMPOTENT","provider_effect_count":1,"false_local_confirmation":0,"duplicate_provider_effect":0,"unresolved_drift":0,"cleanup":"PASS"},
  {"case_id":"P6","status":"PASS","local_final_state":"APPLIED","provider_final_state":"APPLIED","reconciliation_result":"IDEMPOTENT","provider_effect_count":1,"false_local_confirmation":0,"duplicate_provider_effect":0,"unresolved_drift":0,"cleanup":"PASS"},
  {"case_id":"P7","status":"PASS","local_final_state":"APPLIED","provider_final_state":"APPLIED","reconciliation_result":"PASS","provider_effect_count":1,"false_local_confirmation":0,"duplicate_provider_effect":0,"unresolved_drift":0,"cleanup":"PASS"},
  {"case_id":"P8","status":"PASS","local_final_state":"APPLIED","provider_final_state":"APPLIED","reconciliation_result":"PASS","provider_effect_count":1,"false_local_confirmation":0,"duplicate_provider_effect":0,"unresolved_drift":0,"cleanup":"PASS"},
  {"case_id":"P9","status":"PASS","local_final_state":"ACCEPTED_PENDING_BENEFIT","provider_final_state":"CANCELED","retention_refund_recoverable":1,"provider_effect_count":0,"false_local_confirmation":0,"duplicate_provider_effect":0,"unresolved_drift":0,"cleanup":"PASS"},
  {"case_id":"P10","status":"PASS","local_final_state":"APPLIED","provider_final_state":"APPLIED","reconciliation_result":"PASS","provider_effect_count":1,"false_local_confirmation":0,"duplicate_provider_effect":0,"unresolved_drift":0,"cleanup":"PASS"}
]}
```

O novo ensaio criou uma assinatura Stripe TEST e uma oferta com `N=11`, tornou
somente essa oferta vencida, executou o worker e comprovou:

```text
RETENTION_EXPIRY_AUTOMATIC_PROCESSING = PASS
FIRST_RUN_EXPIRED = 1
FIRST_RUN_CANONICAL_REFUNDS = 1
SECOND_RUN_EXPIRED = 0
SECOND_RUN_CANONICAL_REFUNDS = 0
EXPIRATION_DOMAIN_EVENTS = 1
M20F03_SYNTHETIC_EMAIL_ISOLATION = PASS
```

A prova de decline criou uma assinatura Stripe TEST e uma oferta com `N=13`,
executou o decline pelo serviço canônico e comprovou:

```text
RETENTION_DECLINE_CANONICAL_REFUND = PASS
RETENTION_DECLINE_REFUND_COUNT = 1
RETENTION_DECLINE_BENEFIT_COUNT = 0
RETENTION_DECLINE_PROVIDER_EXTENSION_COUNT = 0
RETENTION_DECLINE_DOMAIN_EVENT = PASS
RETENTION_DECLINE_REPLAY = IDEMPOTENT
```

O replay revelou um defeito real no release anterior: um segundo decline era
rejeitado em vez de ser idempotente. A correção foi publicada em
`775263779072c39fe0826cd8a8cfbeb9e65ac921`, verificada em PRELAUNCH e não
duplicou refund, benefício ou evento.

A evidência histórica inicial não cobria a matriz completa de falhas; a Wave 2
agora a fechou. O denominador formal da Wave 3 foi gerado e passou. A Wave 3B
foi iniciada para fechar as matrizes operacionais restantes antes da Wave 4.

## Wave 3B - matrizes operacionais

A execução remota em PRELAUNCH, com fixtures sintéticos reversíveis e limpeza
por prefixo exato, passou 24 casos de serviço canônico. A evidência está em
`scripts/checks/output/m20f03-wave3b-remote-operational.json` e o agregador em
`scripts/checks/output/m20f03-wave3b-operational-matrix.json`.

```text
CURRENT_CLOSURE_WAVE = WAVE_3B_RESIDUAL_OPERATIONAL_MATRICES
WAVE_3B_RESIDUAL_OPERATIONAL_MATRICES = PARTIAL
TEMPORARY_ENTITLEMENT_MATRIX = PASS (22/22, contrato + PRELAUNCH)
DUAL_AXIS_UPGRADE_SCENARIO = PASS
PAID_UPGRADE_SURVIVES_GRANT_EXPIRY = PASS
MARKETING_BENEFIT_INTEGRATION = PASS
OVERLAPPING_ACCESS_GRANTS_MATRIX = PARTIAL (4/5)
EXPIRATION_REVERSION_MATRIX = PARTIAL (9/11)
BILLING_CONCURRENCY_MATRIX = PARTIAL (1/8)
SEQUENTIAL_EXTENSION_USES_CURRENT_PROVIDER_STATE = PARTIAL (0/1)
BENEFIT_MODE_MATRIX = PARTIAL (1/3)
BENEFIT_STACKING_MATRIX = PARTIAL (2/5)
BENEFIT_CODE_PROVIDER_FLOW = PARTIAL (1/2)
REFUND_BENEFIT_INTERACTION_MATRIX = PARTIAL (0/1)
```

Os casos remotos provaram as combinações de tier, sobreposição com maior e
menor acesso, reversion sem restaurar plano histórico, dual-axis, idempotência
de Marketing, replay de código e idempotência de grant administrativo. Eles
não provam concurrency sincronizada, extensão sequencial contra o estado atual
do provedor, nem as políticas de stacking `EXTEND`, `REPLACE_IF_BETTER` e
`PARALLEL`; a allowlist estática não foi usada para promover essas células.

## Segurança e gates técnicos

```text
PHP_LINT = PASS
REFUND_RETENTION_CONTRACT_TEST = PASS
TYPECHECK = PASS
TYPECHECK_STRICT = PASS
VITEST = PASS (163 arquivos, 941 testes)
BUILD = PASS
ESLINT = PASS (execução canônica completa; 0 erros, 97 avisos preexistentes)
SOURCE_SIZE_CHECK = PASS (débitos estruturais preexistentes reportados)
RUNTIME_DDL_STATIC_GATE = PASS (evidência anterior preservada)
ADMIN_SERVER_SIDE_RBAC = PASS (evidência anterior preservada)
CSRF_PROTECTION = PASS
SECRET_SCAN = PASS
ENCODING_SCAN = PASS
GENERATED_ARTIFACTS_CHECK = PASS
GIT_DIFF_CHECK = PASS
```

As execuções sintéticas desta retomada usaram o sink CLI explícito e não
contactaram destinatários reais (`REAL_EMAIL_RECIPIENTS_CONTACTED_BY_M20F03_TESTS=0`).
O histórico anterior, executado antes do sink, não pode ser certificado
retroativamente como isolado; por isso a evidência antiga permanece separada.

## Cleanup

Após o ensaio, a consulta somente leitura confirmou:

```text
PIX_SUPPORTED_AT_LAUNCH = NO
PIX_BLOCKS_M20F03_PASS = NO
PUBLIC_UNFINISHED_PIX_OPTION = 0
SYNTHETIC_ACTIVE_ACCOUNTS_REMAINING = 0
SYNTHETIC_SESSIONS_REMAINING = 0
SYNTHETIC_REFRESH_TOKENS_REMAINING = 0
SYNTHETIC_TRANSACTIONS_REMAINING = 0
SYNTHETIC_SUBSCRIPTIONS_REMAINING = 0
SYNTHETIC_RETENTION_OFFERS_REMAINING = 0
SYNTHETIC_BENEFIT_DEFINITIONS_REMAINING = 0
SYNTHETIC_BENEFIT_GRANTS_REMAINING = 0
SYNTHETIC_NOTIFICATIONS_REMAINING = 0
SYNTHETIC_PROVIDER_WEBHOOK_ROWS_REMAINING = 0
PRESERVED_SYNTHETIC_DOMAIN_AUDIT_EVENTS = 12
```

As fixtures mutáveis das tentativas foram removidas por identidade/marcador
exato. Os 12 eventos de domínio foram preservados como auditoria imutável;
nenhuma conta, sessão, assinatura, oferta, grant ou notificação sintética
permaneceu ativa.

## Estado final honesto

```text
M20F03 = PARTIAL
CURRENT_CLOSURE_WAVE = WAVE_3B_RESIDUAL_OPERATIONAL_MATRICES
ACTIVE_PRODUCTION_RELEASE = 775263779072c39fe0826cd8a8cfbeb9e65ac921
ORIGIN_1_0_0 = ba8fb59a6605030aee05255823de45ca76a4a576
ORIGIN_HEAD_AHEAD_OF_ACTIVE_RELEASE = YES
ORIGIN_AHEAD_RUNTIME_DEPLOY_REQUIRED = NO
WAVE_1_RETENTION_CONCURRENCY = PASS (11/11)
WAVE_2_PROVIDER_FAILURE_RECONCILIATION = PASS (10/10)
WAVE_3_BILLING_DENOMINATOR = PASS
WAVE_3B_RESIDUAL_OPERATIONAL_MATRICES = PARTIAL
NEXT_WAVE = WAVE_4_BROWSER_ACCESSIBILITY (depois de fechar a Wave 3B)
HARD_BLOCKER = NO
M20F04 = NOT_STARTED
M20F07 = NOT_STARTED
ACTUAL_LAUNCH_MODE = PRELAUNCH
REAL_DATA_INSERTIONS = 0
STRIPE_LIVE_MUTATIONS = 0
```

O pacote ainda não pode ser fechado porque permanecem células operacionais da
Wave 3B e, depois delas, as provas browser autenticadas de Benefits/Admin/User
da Wave 4. A concorrência A1-A11, a matriz de falhas do provedor e o ciclo de
renovação específico após uma extensão de retenção já passaram. O estado é uma
pendência de completude de evidência, não falta de autorização nem um hard
blocker de infraestrutura.

O runner Playwright Chromium existente foi adaptado e executado em modo estrito
contra o domínio PRELAUNCH com contas sintéticas criadas por provisionamento
temporário, login normal e sem bypass. A adaptação reutiliza um único contexto
autenticado por papel durante a inspeção das rotas, parametriza viewport e espera
pós-carregamento, e ignora somente o `ERR_ABORTED` de prefetch RSC (`?_rsc=`).

Classificação dos achados anteriores:

```text
BROWSER_SESSION_ISSUE_CLASSIFICATION = HARNESS_DEFECT
RSC_ERR_ABORTED_CLASSIFICATION = EXPECTED_PREFETCH_ABORT
AUTH_BYPASS_USED = NO
```

Com a conta Admin sintética correta, as rotas financeiras inspecionadas passaram
em 1440, 1280, 1024 e 430px, sem erro de console, erro de página ou request
inesperadamente falho. A rota de Benefits do usuário passou em 1440, 1280, 1024,
430 e 390px. Uma nova tentativa Admin em 390px foi bloqueada por rate limit dos
logins repetidos do próprio ensaio; portanto essa célula não é declarada PASS.
Isso não demonstrou defeito de layout ou autenticação do produto, mas também não
substitui a aceitação Admin interativa completa.

As contas, sessões e tokens sintéticos foram removidos depois; a verificação
final no banco retornou zero para `users`, `auth_sessions` e
`auth_refresh_tokens` sob o prefixo sintético. O resultado é evidência de smoke
autenticado e diagnóstico do harness, não fechamento browser completo.

A adaptação do runner foi preservada no commit de teste
`6d78a4d810464df9e2d19813a3044ecfa2c95df5` e enviada para `origin/1.0.0`. Como
ela não altera o runtime do produto, o deploy PRELAUNCH ativo continua sendo
`775263779072c39fe0826cd8a8cfbeb9e65ac921`; não foi feito deploy desnecessário.

Foi executada uma barreira real de concorrência para A1-A11 com `pcntl_fork`:
os dois processos chegaram ao mesmo limite lógico, o lock transacional foi
liberado de forma determinística e cada caso foi persistido no ledger antes da
limpeza. O resultado agregado foi 11/11 aprovados. A1 terminou com
`accept=DomainException`, `decline=success` e `RETENTION_OFFER_REJECTED/refunded`;
A2, A7 e A9 terminaram retidos com um grant aplicado; os demais terminaram
com reembolso ou replay idempotente, sem grant duplicado. O harness anterior
tinha falhado por conexão PDO herdada após `fork`; a versão corrigida abriu uma
conexão independente em cada filho. A limpeza por identidade retornou zero
usuários sintéticos e o ledger confirmou `cleanup=PASS` nos 11 casos.

Uma prova separada de renovação específica da retenção passou no Stripe TEST:
`N=2`, extensão confirmada de `172800` segundos, uma invoice de valor zero no
limite antigo (`subscription_update`) sem novo PaymentIntent ou charge, e uma
única invoice/charge de `R$18,00` no limite estendido (`subscription_cycle`). A
reconciliação local terminou sem issues. A primeira falha dessa prova foi apenas
de extração do harness (`current_period_end` ausente no nível superior); a
segunda foi uma contagem bruta que incluía a invoice legítima de valor zero.
Ambas foram corrigidas no teste temporário, sem alteração de runtime. A prova
foi executada contra o release PRELAUNCH ativo e não exigiu deploy adicional.

## Recomendação para leigos

O núcleo já está protegido: existe uma conta de benefícios central, o número de
dias é escolhido pelo administrador, o Stripe TEST confirmou a renovação e o
sistema impede chamadas mutáveis sem CSRF. Também não sobraram contas ou dados
financeiros sintéticos ativos.

Ainda não recomendo liberar o Billing ao público. O denominador formal e as
provas financeiras principais estão fechados, mas a Wave 3B ainda tem lacunas
operacionais em concurrency, extensão sequencial, stacking e interação de
reembolso; a aceitação browser vem depois. Mantenha PRELAUNCH até concluir
essas células e a Wave 4; o email sintético está isolado nas execuções novas.

```text
SAFE_TO_PROCEED_TO_M20F04 = NO
SAFE_TO_PROCEED_TO_M20F07 = NO
```
