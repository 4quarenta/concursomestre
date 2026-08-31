# Macrostep 17 - Legal, Privacy e Compliance Readiness

Data da auditoria: 2026-08-30
Base: `435986ae705399bb4f1039541aaf5bc2fd4e2a3c`
Cleanroom: `.tmp/macro17-worktree`
Produção tocada: nao

## Resumo executivo

A auditoria foi executada sobre schema, DTOs, APIs, formularios, auth,
billing, analytics, armazenamento, mobile, terceiros, documentos publicos e
admin. O boundary publico nao serializa o retrato privado de usuario. O fluxo
de exclusao foi endurecido: e POST-only, usa CSRF quando ha cookie de browser,
marca a conta de forma transacional e revoga todas as familias de sessao.

O sistema prova o comportamento tecnico de pedido de exclusao e bloqueio de
reautenticacao. Ele nao promete apagamento imediato de todo o grafo, pois essa
decisao exige politica de retenção e revisão jurídica. Nenhum prazo legal foi
inventado.

## Escopo e inventario

| Classificacao | Resultado |
| --- | --- |
| data inventory | COMPLETE |
| data flow map | COMPLETE |
| third-party inventory | COMPLETE |
| out-of-scope | 0 |
| uncertain | 0 |
| Macrostep 13 interference | 0 |
| production DML/DDL/migration | 0 |
| real data insertion | 0 |

Todos os arquivos modificados pertencem a auth/account deletion, documentos
publicos de privacidade/termos, testes de contrato, ledger ou este relatorio.

## Fluxos relevantes

| Fluxo | Origem | Destino | Dados principais | Controle |
| --- | --- | --- | --- | --- |
| cadastro/login | browser/mobile | auth API -> users/auth tables | email, senha/hash, CPF, telefone, ids sociais | validação, rate limit, auth session |
| perfil | browser | users/profile.php -> DB | perfil e endereço privado | bearer ownership; DTO privado |
| estudo | browser/mobile | questions/statistics APIs -> DB | respostas, progresso, sessões | user_id e endpoints autenticados |
| billing | checkout | Stripe -> subscriptions/transactions | email, customer/payment references | Stripe e idempotência |
| IA | admin/fluxo autorizado | AI API -> Gemini/OpenAI | prompt/anexos | RBAC, limites, providers configurados |
| analytics | browser | first-party analytics -> DB | evento, origem, session key e email legado | validator/rate limit/zero-state |
| exclusão | perfil | users/delete.php -> users/auth tables | razão e marcador | POST, auth, CSRF quando aplicável, reCAPTCHA |

## Dados pessoais e minimização

CPF e telefone são solicitados no cadastro e usados em fluxos de identidade e
cobrança; não foram removidos sem prova de substituto. O perfil autenticado
expõe esses campos apenas na área privada. Hashes, tokens, provider IDs,
cartões integrais e campos administrativos não entram no DTO público de sessão.

Analytics ainda aceita email para compatibilidade histórica. Isso foi
classificado como dívida de instrumentação para Macrostep 19, não como nova
feature desta etapa. Não há evidência de senha, token bruto, chave ou payload
financeiro integral em `logAuthEvent`; mensagens cruas de alguns logs gerais
continuam sob revisão de retenção/infra.

## Exclusão, acesso e portabilidade

O contrato implementado é: autenticar o próprio usuário, exigir POST, validar
CSRF para sessões browser, registrar `deletion_requested_at`, revogar sessões e
rejeitar login/refresh/JWT posteriores. O pedido é idempotente: repetir o pedido
atualiza o marcador e não cria outra identidade.

Não existe exportação self-service implementada. O sistema permite localizar a
conta pelo fluxo autenticado/admin existente, sujeito a RBAC. O grafo de
DELETE/ANONYMIZE/RETAIN/BLOCK/UNKNOWN está em
`docs/privacy/privacy-data-contract.md`; billing histórico e backups não são
apagados automaticamente.

## Cookies, storage e consentimento

Cookies de autenticação são definidos em `shared/auth/AuthCookies.php`; refresh
é HttpOnly e CSRF é separado. Mobile usa SecureStore. Há armazenamento local
para estado efêmero, preferências, progresso local e sinais de sessão. O
`CookieConsentProvider` usa a chave versionada `cm:cookie-consent:v1`, nega
analytics e marketing por padrão, sincroniza mudanças entre abas e mantém
essas categorias bloqueadas quando o estado é ausente, inválido ou de versão
desconhecida. O enforcement técnico não é uma conclusão jurídica universal.

## Terceiros

Stripe é o provider de billing ativo. Google/Facebook/Apple sustentam login
social. Gemini/OpenAI recebem prompts/anexos apenas quando o fluxo de IA é
acionado. reCAPTCHA protege os fluxos configurados. Email recebe dados de
entrega transacional. Mercado Pago não é provider ativo; referências históricas
não foram promovidas à documentação corrente.

## Documentação pública

Foram corrigidas contradições factuais pequenas: a coleta de CPF/telefone não é
descrita como exclusiva da conversão paga, o provider atual é Stripe, a
exclusão passou a ser descrita como solicitação sujeita a tratamento, e os
Termos não prometem bônus automático por indisponibilidade. Interpretações
jurídicas, prazos, bases legais, retenção e redação final continuam com owner
jurídico.

## Findings e disposição

| ID | Severity | Finding | Ação | Destino | Status |
| --- | --- | --- | --- | --- | --- |
| P17-01 | P1 técnico | pedido de exclusão não revogava sessões concorrentes | revogação centralizada e transacional | Macrostep 17 | IMPLEMENTED |
| P17-02 | P1 técnico | rota de exclusão não declarava POST-only | validação explícita de método | Macrostep 17 | IMPLEMENTED |
| P17-03 | P1 técnico | refresh/JWT/login podiam continuar após marcador | bloqueio por marker/status em todas as entradas | Macrostep 17 | IMPLEMENTED |
| P17-04 | P2/legal | apagamento/anonymização final e prazos não possuem política aprovada | manter contrato técnico e workflow futuro | PRE_GO_LEGAL_REVIEW / Macrostep 20 | OPEN_WITH_OWNER |
| P17-05 | P2 | export self-service ausente | atendimento controlado e avaliar endpoint futuro | PRE_GO_LEGAL_REVIEW / Macrostep 20 | OPEN_WITH_OWNER |
| P17-06 | P2 | email em analytics e retenção de logs precisam minimização | revisar instrumentação sem executar Macrostep 19 | PRE_GO_LEGAL_REVIEW / Macrostep 18/19 | TRANSFERRED |
| P17-07 | P2/legal | consentimento analytics/marketing exigia enforcement runtime | consent manager bloqueia analytics/marketing até opt-in, com retirada e estado inválido fail-closed | PRE_GO_LEGAL_REVIEW / Macrostep 19 | IMPLEMENTED |
| P17-08 | P2 | versionamento formal dos documentos públicos é incompleto | revisão editorial/legal antes do GO | PRE_GO_LEGAL_REVIEW / Macrostep 20 | OPEN_WITH_OWNER |

P0 restantes: 0. P1 restantes: 0. Os P2 e itens legais não são escondidos nem
convertidos em regra técnica inventada.

## Accounting dos itens jurídicos

| ID | AREA | CURRENT_TECHNICAL_STATE | LEGAL_DECISION_REQUIRED | OWNER | ACCEPTANCE_CONDITION | PRE_GO_REQUIRED | STATUS |
| --- | --- | --- | --- | --- | --- | --- | --- |
| P17-04 | apagamento, anonymização e retenção | marcador transacional e revogação implementados; disposição final e prazos não implementados | aprovar grafo de dados, retenção, apagamento/anonymização e prazos | owner jurídico + privacidade | política aprovada, workflow implementado e evidência de execução | SIM | OPEN_WITH_OWNER |
| P17-05 | acesso e portabilidade | não há exportação self-service; canal controlado permanece disponível | definir escopo, formato, prazo e canal de exportação | owner jurídico + produto | contrato aprovado e fluxo operacional testado | SIM | OPEN_WITH_OWNER |
| P17-06 | analytics e retenção de logs | consent boundary técnico implementado; minimização e retenção final dependem das Macrosteps 18/19 | aprovar base legal, campos e prazo de retenção | owners das Macrosteps 18/19 + jurídico | taxonomia e política aprovadas, com coleta minimizada | SIM | TRANSFERRED |
| P17-07 | categorias e consentimento de cookies | opcionais negados por padrão, retirada e estado inválido fail-closed | aprovar categorias, redação e bases legais | owner jurídico + privacidade | revisão jurídica concluída e política publicada | SIM | IMPLEMENTED_TECHNICAL |
| P17-08 | versionamento documental | versionamento formal de documentos públicos incompleto | aprovar versionamento, histórico e publicação final | jurídico + editorial | documentos versionados, aprovados e publicados | SIM | OPEN_WITH_OWNER |

Todos os itens `PRE_GO_REQUIRED = SIM` apontam para `PRE_GO_LEGAL_REVIEW`
e/ou para a Macrostep indicada; nenhum prazo ou decisão jurídica foi inventado.

## Gates

| Gate | Estado |
| --- | --- |
| PRIVATE_USER_DATA_IN_PUBLIC_SURFACE | 0 |
| HIGH_RISK_SECRET_LOGGING | 0 |
| CROSS_USER_PRIVACY_ACCESS | 0 por contratos existentes e ownership |
| PII_DTO_MINIMIZATION | PASS |
| ACCOUNT_DELETION_BEHAVIOR | PROVEN para request/marker/revocation |
| SESSION_REVOCATION_AFTER_DELETION | PASS |
| RETENTION_MATRIX | COMPLETE tecnicamente; prazos legais abertos |
| COOKIE_STORAGE_INVENTORY | COMPLETE |
| COOKIE_CONSENT_TECHNICAL_ENFORCEMENT | PASS; opcionais negados por padrão e estado inválido fail-closed |
| CONSENT_WITHDRAWAL_RUNTIME | PASS por evento compartilhado e flag de desativação do GA |
| CONSENT_CROSS_TAB_SYNC | PASS por `storage` event |
| OPTIONAL_TRACKING_BEFORE_CONSENT | 0 por gates de serviço, GA e anúncios |
| POLICY_CODE_CONTRADICTIONS | 0 não atribuídas; correções aplicadas |
| LEGAL_REVIEW_ITEMS_ACCOUNTED_FOR | SIM |
| SAFE_QUICK_WINS_EVALUATED | SIM |
| IMPROVEMENT_AUDIT | COMPLETE |

## Limites da evidência

Não houve acesso, escrita ou alteração em produção. Não houve carga de dados
reais, Stripe mutation, migration, deploy, commit ou push. Testes que exigem
provedor externo, tráfego real, retenção operacional ou dados reais ficam
explicitamente transferidos aos owners correspondentes.

## Recomendação

Classificação: **Aprovada com ressalvas técnicas e legais**. A candidata pode
seguir para revisão/checkpoint desta macrostep se os gates locais permanecerem
verdes. Antes do Production GO, o owner jurídico precisa aprovar retenção,
apagamento/anonymização, portabilidade, consentimento e versionamento dos
documentos; Macrosteps 18 e 19 precisam fechar seus limites operacionais.

`MACROSTEP_17_READINESS_AUDIT = PASS`

`MACROSTEP_17_IMPROVEMENT_AUDIT = COMPLETE`

`MACROSTEP_17_INDEPENDENT_AUDIT = PASS`

## Evidencia de rerun e identidade

O rerun independente reproduziu o fingerprint funcional com dois metodos,
usando ordenacao bytewise, status, caminho relativo normalizado e bytes crus.
O relatorio e o JSON ignorado ficaram fora do conjunto para evitar
autorreferencia.

```text
MACROSTEP_17_PRE_COOKIE_FUNCTIONAL_FINGERPRINT_V1 = 97de4dc652348a5e2a48185a407863c913fb2c086e593a5aa629a43f67ce7e12 (SUPERSEDED_NON_CANONICAL)
MACROSTEP_17_FUNCTIONAL_FINGERPRINT_V1 = 74835bad69fe7ccdb03b927904ef1537176559aac9b826b7c0e666ec27b6c254
FINGERPRINT_METHOD_POWERSHELL = PASS
FINGERPRINT_METHOD_NODE = PASS
FINGERPRINT_REPRODUCED = PASS
FINGERPRINT_FILE_COUNT = 21 (docs de auditoria e .tmp excluídos)
FULL_VITEST = PASS (157 arquivos, 919 testes)
ROOT_TYPECHECK = PASS
MOBILE_TYPECHECK = PASS
BASELINE_NEXT_BUILD = PASS (webpack, 435986ae705399bb4f1039541aaf5bc2fd4e2a3c)
CANDIDATE_NEXT_BUILD = PASS (webpack, cleanroom consolidado)
NEXT_BUILD = PASS (sem regressão entre baseline e candidata)
PHP_LINT = PASS (1.084 arquivos fora de vendor)
SECRET_SCAN = PASS
ENCODING = PASS
GENERATED_ARTIFACTS = PASS
GIT_DIFF_CHECK = PASS
MYSQL_INTEGRATION = PASS (MySQL Community 8.4.11 descartável, loopback, sem produção)
BROWSER_COOKIE_CONSENT_SMOKE = PASS (SSR, bloqueio inicial, opt-in e retirada)
COOKIE_CROSS_TAB_SMOKE = PASS (storage event entre duas abas)
ACCOUNT_DELETION_MYSQL_INTEGRATION = PASS (marker, revogação, idempotência e rollback)
LEGAL_COOKIE_COMPLIANCE = NOT_CLAIMED; COOKIE_CONSENT_LEGAL_REVIEW = REQUIRED
```

`P0_REMAINING = 0`

`P1_REMAINING = 0`

`COMMIT = NAO`

`PUSH = NAO`

`DEPLOY = NAO`

`PRODUCTION_DML = 0`

`PRODUCTION_DDL = 0`
