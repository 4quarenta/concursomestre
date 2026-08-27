# Macroetapa 11B-ZERO-POLICY-R

## Resumo executivo

- Branch: `1.0.0`
- Baseline: `fbb34f83f94bbda0792bd861c20d137916566a58`
- Policy: `RESET_POLICY_V2`
- Semantica: `RESET_POLICY_V2_EXECUTION_AND_STEADY_STATE_V1`
- Producao consultada somente com `Database('read')` e grants sem escrita.
- DML/DDL de producao: `0`
- Commit, push e deploy: `NAO`
- Dataset real carregado/autorizado: `NAO`

A contradicao foi removida sem enfraquecer o reset. As 113 tabelas continuam
resetaveis e obrigatoriamente vazias no instante de conclusao. Depois do
resume, 109 permanecem estritas e quatro podem conter estado operacional
somente quando cada row e atribuida a writer e evento allowlisted.

## POLICY_CLASS_MATRIX

| Classe | Tabelas | Semantica |
| --- | ---: | --- |
| `PRESERVE` | 12 | sobrevive ao reset; classificacao inalterada |
| `RESETTABLE_STRICT` | 109 | zera no reset e nao pode repopular no zero-state |
| `RESETTABLE_RECREATABLE_RUNTIME` | 4 | zera no reset; pode recriar estado operacional autorizado apos resume |
| Total | 125 | `UNKNOWN=0`, `OVERLAP=0` |

As quatro tabelas continuam em `resetTables()`, backup, fingerprint e ordem
FK-safe. Nenhuma foi movida para `PRESERVE`.

## RESET_COMPLETION_STATE_MATRIX

| Classe | Regra | Evidencia | Resultado |
| --- | --- | --- | --- |
| `PRESERVE` | snapshots intactos durante a execucao | gate historico do reset | PASS |
| `RESETTABLE_STRICT` | 109/109 zero | validator e regressao MySQL | PASS |
| `RESETTABLE_RECREATABLE_RUNTIME` | 4/4 zero antes do resume | validator e fixture inicial | PASS |
| Todas resetaveis | 113/113 zero | reset real e regressao descartavel | PASS |

`RESET_COMPLETION_GATE` permanece fail-closed. Qualquer row nas 113 tabelas
antes da liberacao dos writers bloqueia a conclusao.

## POST_RESUME_STEADY_STATE_MATRIX

| Classe | Regra pos-resume | Resultado |
| --- | --- | --- |
| `PRESERVE` | integridade dos snapshots no intervalo auditado | PASS |
| `RESETTABLE_STRICT` | nenhuma repopulacao | 109/109 zero em producao |
| Runtime recreavel | contagem livre, mas atribuicao integral a writer/evento permitido | PASS |
| Evidencia ausente/desconhecida | fail-closed | PASS no teste negativo |

O contrato nao fixa `2/1/1/1`. A cardinalidade pode crescer por uso legitimo;
o que precisa fechar e a atribuicao sem sobra nem evento desconhecido.

## RECREATABLE_RUNTIME_MATRIX

| Tabela | Classe | Zera no reset | Pode recriar apos resume | Motivo |
| --- | --- | --- | --- | --- |
| `auth_refresh_tokens` | runtime recreavel | sim | sim | login e rotacao de token |
| `auth_sessions` | runtime recreavel | sim | sim | estabelecimento de sessao |
| `user_cards` | runtime recreavel | sim | sim | espelho operacional de metodo remoto |
| `user_statistics` | runtime recreavel | sim | sim | bootstrap lazy autenticado |

## STRICT_RESETTABLE_MATRIX

| Verificacao | Resultado |
| --- | --- |
| Quantidade | 109 |
| Producao, snapshot `2026-08-27T00:42:51Z` | 109 consultadas |
| Tabelas estritas positivas | 0 |
| Repopulacao estrita simulada em `questions` | rejeitada |
| Reclassificacoes adicionais sem prova | 0 |

A busca factual de writers nao comprovou outra tabela com o mesmo contrato.
O inventario antigo atribuida `user_statistics` ao worker de platform events,
mas o worker real nao escreve nela; essa cobertura foi corrigida.

## RUNTIME_WRITER_ALLOWLIST_MATRIX

| Tabela | Writer | Eventos permitidos |
| --- | --- | --- |
| `auth_refresh_tokens` | `http-auth-account` | login, registro, social callback, 2FA completion, token refresh |
| `auth_sessions` | `http-auth-account` | login, registro, social callback, 2FA completion |
| `user_cards` | `http-auth-account` | profile sync, checkout sync, billing card save |
| `user_statistics` | `http-practice-user-activity` | statistics lazy bootstrap |

`manual-backfills-migrations-reset` continua cobrindo as tabelas apenas em
operacao exclusiva e congelada. Ele nao e permitido no steady state.

## AUTH_RUNTIME_MATRIX

| Evento | Sessao | Refresh token | Resultado |
| --- | ---: | ---: | --- |
| fixture inicial | 0 | 0 | PASS |
| login descartavel | +1 | +1 | PASS |
| authenticated bootstrap | 0 | 0 | PASS |
| refresh | 0 | +1 | PASS |
| logout | sem nova row | sem nova row | PASS |
| producao read-only atual | 1 | 11 | PASS por cadeia de uma sessao e 10 rotacoes |

As onze linhas atuais nao alteram o contrato. Sao uma sessao, um token inicial
e dez rotacoes encadeadas; cardinalidade fixa foi explicitamente rejeitada.

## USER_STATISTICS_MATRIX

| Check | Resultado |
| --- | --- |
| Bootstrap lazy descartavel | `0 -> 1` |
| Writer | `http-practice-user-activity` |
| Evento | `statistics_lazy_bootstrap` |
| Producao atual | 1 row |
| Conteudo estrito criado junto | 0 |

## USER_CARDS_MATRIX

| Check | Resultado |
| --- | --- |
| Profile/billing mirror descartavel | `0 -> 1` |
| Writer/evento | `http-auth-account/profile_billing_card_sync` |
| Producao atual | 1 row operacional |
| Subscription do mesmo usuario | 0 |
| Transaction do mesmo usuario | 0 |

## BILLING_SEPARATION_MATRIX

| Tabela estrita | Pos A-H | Producao atual | Estado |
| --- | ---: | ---: | --- |
| `transactions` | 0 | 0 | PASS |
| `user_subscriptions` | 0 | 0 | PASS |
| `financial_ledger_entries` | 0 | 0 | PASS |
| `provider_webhook_events` | 0 | 0 | PASS |
| `coupon_reservations` | 0 | 0 | PASS |

O espelho de cartao nao preserva nem restaura historico financeiro de teste.

## MYSQL_A_H_MATRIX

Engine descartavel: MySQL `8.4.11`, socket-only, sem rede publica.

| Etapa | Delta runtime | Estritas positivas | Resultado |
| --- | --- | ---: | --- |
| A boot sem request | `0/0/0/0` | 0 | PASS |
| B pagina publica | `0/0/0/0` | 0 | PASS |
| C pagina auth | `0/0/0/0` | 0 | PASS |
| D login | tokens `+1`, sessions `+1` | 0 | PASS |
| E authenticated bootstrap | `0/0/0/0` | 0 | PASS |
| F refresh | tokens `+1` | 0 | PASS |
| G dashboard/profile/billing | cards `+1`, statistics `+1` | 0 | PASS |
| H logout | nenhuma row nova | 0 | PASS |

Depois de H, o reset descartavel voltou as 113 resetaveis a zero e preservou o
usuario fixture. O reporter operacional, nao apenas o validator puro, foi
exercitado em ambos os gates.

## UNKNOWN_WRITER_MATRIX

| Caso negativo | Resultado esperado | Resultado |
| --- | --- | --- |
| writer nao inventariado | FAIL P1 | rejeitado |
| evento nao allowlisted | FAIL P1 | rejeitado |
| row sem atribuicao | FAIL P1 | rejeitado |
| evidencia para tabela nao-runtime | FAIL P1 | rejeitado |
| row em tabela estrita | FAIL P1 | rejeitado |

## FREEZE_SEMANTICS_MATRIX

| Momento | Writer runtime | Regra |
| --- | --- | --- |
| antes/durante reset | auth e practice | `MUST_FREEZE_DURING_RESET` |
| completion gate | todos | ainda congelados; 113/113 zero |
| depois do resume | auth e practice | `MAY_WRITE_AFTER_RESUME` apenas nos eventos allowlisted |
| manutencao manual | CLI privilegiado | nunca permitido como steady-state runtime |

O freeze real nao falhou. Os registros originais surgiram horas depois da
conclusao e do resume inicial.

## RESET_REGRESSION_MATRIX

| Regressao | Resultado |
| --- | --- |
| Reset order e manifests | inalterados |
| Runtime recreavel participa do reset | 4/4 |
| Reset completion exige runtime zero | PASS |
| Reset completion exige estritas zero | PASS |
| Preserve snapshot mismatch bloqueia | PASS |
| Legacy reset perigoso | continua fail-closed |
| Sitemaps/readiness | regressao focada PASS |

## PRODUCTION_READONLY_MATRIX

| Check | Resultado |
| --- | --- |
| Database | `concursomestre` |
| Engine | MySQL `8.4.10-10` |
| `SHOW GRANTS` com escrita | 0 |
| Tabelas estritas consultadas | 109 |
| Tabelas estritas positivas | 0 |
| Runtime atual | tokens 11; sessions 1; cards 1; statistics 1 |
| SQL de mutacao | 0 |
| Credenciais/PII no relatorio | 0 |

As cinco linhas da evidencia original continuam classificadas como estado
legitimo. As rotacoes posteriores elevaram apenas tokens de 2 para 11, o que e
comportamento esperado e prova por que contagem fixa seria incorreta.

## TEST_MATRIX

| Gate | Resultado |
| --- | --- |
| Policy validator | PASS |
| Reset dry-run/wiring | PASS |
| Steady-state validator | PASS |
| Writer allowlist/freeze/evidence/systemd | PASS |
| A-H MySQL 8.4.11 | PASS |
| Auth login/refresh | PASS no A-H |
| Billing separation | PASS |
| PHP focused + lint | PASS |
| Vitest completo | `154/154`, `912/912` |
| Route types + TypeScript | PASS |
| Clean Next build | PASS |
| ESLint sem cache | 0 errors; 96 warnings preexistentes |
| Launch validator | PASS, 55 families |
| Secret scan | PASS |
| Encoding | PASS |
| `git diff --check` | PASS |

O primeiro Vitest foi iniciado com Node `20.12.2`, abaixo do engine minimo, e
duas suites falharam na coleta CJS/ESM. A repeticao autoritativa com o Node
`24.19.0` do workspace passou integralmente. Nenhuma dependencia mudou.

## FINAL_RISK_MATRIX

| Prioridade | Finding | Estado/acao futura |
| --- | --- | --- |
| P0 | nenhum | 0 |
| P1 | nenhum apos a reclassificacao | 0 |
| P2 | retencao de refresh tokens expirados/rotacionados | definir cleanup separado |
| P2 | GET de statistics faz bootstrap persistente | avaliar desenho sem side effect |
| P2 | listagem de cards sincroniza espelho remoto | avaliar frequencia/cache |
| P2 | evidencia runtime hoje depende de captura operacional externa | automatizar ledger/correlacao antes de escala |

## Declaracoes finais

```text
RESET_POLICY_V2 = EXECUTION_AND_STEADY_STATE_SEMANTICS_VALIDATED
RESET_COMPLETION_STATE = ALL_RESETTABLE_ZERO
POST_RESUME_STEADY_STATE = STRICT_ZERO_PLUS_AUTHORIZED_RECREATABLE_RUNTIME

auth_sessions = RESETTABLE_RECREATABLE_RUNTIME
auth_refresh_tokens = RESETTABLE_RECREATABLE_RUNTIME
user_cards = RESETTABLE_RECREATABLE_RUNTIME
user_statistics = RESETTABLE_RECREATABLE_RUNTIME

PRESERVE = UNCHANGED
runtime writers = KNOWN_AND_ALLOWLISTED
unknown runtime writers = 0
reset completion = PASS
post resume steady state = PASS
current runtime rows = LEGITIMATE_RECREATED_STATE

real dataset loaded = NAO
REAL_DATA_INSERTION_AUTHORIZED = NAO
production DB writes = 0
commit = NAO
push = NAO
deploy = NAO

P0 = 0
P1 = 0
RESET_POLICY_V2_STEADY_STATE_RECLASSIFICATION_READY
POST_RESUME_STEADY_STATE_VALID = SIM
MACROSTEP_11B_READY_FOR_GIT_CHECKPOINT = NAO
REAL_DATA_INSERTION_AUTHORIZED = NAO
```

## Proximo gate

Executar somente `11B-FINAL-AUDIT`, com auditoria independente de toda a 11B
usando a separacao entre `RESET_COMPLETION_STATE` e
`POST_RESUME_STEADY_STATE`. Nao criar checkpoint antes dessa auditoria.
