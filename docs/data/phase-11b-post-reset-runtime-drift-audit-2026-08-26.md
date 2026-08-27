# Macroetapa 11B - Auditoria forense do drift pos-reset de auth/user runtime

## Resumo executivo

- Data UTC: 2026-08-26
- Branch: `1.0.0`
- Baseline: `fbb34f83f94bbda0792bd861c20d137916566a58`
- Escopo: `auth_refresh_tokens`, `auth_sessions`, `user_cards`, `user_statistics`
- Producao: somente leitura, credencial SQL sem privilegios de escrita
- MySQL de producao: `8.4.10-10`
- Ensaio descartavel: MySQL `8.4.11`, socket local, `skip-networking`, teardown automatico

O finding anterior nao foi causado por falha do reset nem por writer desconhecido. O reset terminou com `113/113` tabelas RESETTABLE vazias, inclusive depois do primeiro resume/smoke. Cerca de 20 horas depois, um usuario preservado realizou login e usou a aplicacao. Os cinco registros originais foram correlacionados, sem PII, com quatro requests HTTP:

1. login criou uma sessao e o primeiro refresh token;
2. dashboard criou a baseline de `user_statistics`;
3. perfil sincronizou um cartao Stripe remoto para `user_cards`;
4. refresh rotacionou o token e criou a segunda linha de `auth_refresh_tokens`.

Todas as linhas pertenciam ao mesmo ator anonimizado. A auditoria anterior nao executou auth smoke depois de detectar o P1 e, portanto, nao criou os registros.

O problema real e de semantica da policy: `RESET COMPLETION STATE` e `POST-RESUME STEADY STATE` foram tratados como o mesmo invariant. As quatro tabelas podem e devem ser zeradas no reset, mas nao podem permanecer permanentemente vazias enquanto o runtime autenticado e o fluxo de billing/profile funcionam conforme implementados.

```text
POST_RESET_RUNTIME_DRIFT_DIAGNOSIS_READY
RESET_POLICY_V2_STEADY_STATE_RECLASSIFICATION_REQUIRED
MACROSTEP_11B_READY_FOR_GIT_CHECKPOINT = NAO
REAL_DATA_INSERTION_AUTHORIZED = NAO
```

## Evidencia e limites

- O banco de producao foi consultado apenas com `SELECT`, `SHOW` e `information_schema`.
- `SHOW GRANTS FOR CURRENT_USER` confirmou ausencia de privilegios de escrita.
- IDs de usuario, sessao, token e cartao foram correlacionados apenas por hash curto durante a execucao; o relatorio usa `actor-A`.
- Nao foram materializados email, nome, token, hash de token, IP, user agent, ultimos digitos do cartao ou payload privado.
- `AuthLogger` silencia por padrao `auth_session_created`, `refresh_rotated` e `auth_logout`; por isso a causalidade usa timestamps do banco, cadeia de rotacao, access log sanitizado e ensaio descartavel.
- A contagem de refresh tokens continuou crescendo durante a auditoria, como esperado para uma sessao ativa. Isso nao altera a origem das cinco linhas do finding original.

## RUNTIME_ZERO_STATE_WRITER_MATRIX

| Table | Insert/upsert writer | Service/caller | Endpoint/event | Original rows | Category |
| --- | --- | --- | --- | ---: | --- |
| `auth_sessions` | `createAuthSessionRow` | `issueUserAuthBundle` via `AuthService` | `POST /api/auth/login.php` | 1 | A - estado operacional legitimo inevitavel |
| `auth_refresh_tokens` | `persistRefreshToken` | `issueUserAuthBundle`; `refreshAccessTokenUsingToken` | login e `POST /api/auth/refresh.php` | 2 | A - estado operacional legitimo inevitavel |
| `user_statistics` | `StatisticsRepository::createUserStatistics` | `StatisticsService::getUserStatistics` | `GET /api/statistics/user.php` disparado pelo dashboard/StudyTracker | 1 | B - inicializacao automatica legitima, incompatível com zero permanente |
| `user_cards` | `upsertLocalStripeCardMirror` | `UsersCardsService::listSavedCards` -> `syncStripeCardsForUser` | `POST /api/users/list_cards.php` no perfil | 1 | B - sincronizacao automatica legitima, incompatível com zero permanente |

Writers adicionais de `user_cards` existem nos fluxos explicitos de salvar cartao, checkout, assinatura, refund e reconciliacao. Eles nao originaram a linha observada: o timestamp de criacao coincide com a primeira chamada de `list_cards.php`, e a linha e um espelho Stripe com provider/customer presentes.

`user_statistics` tambem pode ser atualizado por respostas, estudo e pelo consumer de eventos. A linha observada era a baseline zero criada no primeiro `GET statistics/user.php`.

## WRITE_TIMELINE_MATRIX

| UTC | Evidencia | Delta factual | Interpretacao |
| --- | --- | --- | --- |
| `2026-08-26 01:24` (run ID) | reset 11B retry2 | `113/113 = 0` | reset completion correto |
| apos resume/smoke | relatorio 11B | ainda `113/113 = 0` | freeze/resume correto |
| `21:49:30` | access log: login 200; DB `18:49:30 -03:00` | sessions `+1`, tokens `+1` | inicio de sessao de `actor-A` |
| `22:01:27-28` | dashboard 200; statistics endpoint 200 | statistics `+1` | baseline lazy de estatisticas |
| `22:02:44-46` | profile 200; list cards 200 | cards `+1` | espelho local do cartao Stripe |
| `22:03:31` | refresh 200 | tokens `+1` | segunda linha original; primeira rotacao |
| `22:12:56-22:13:17` | auditoria anterior read-only | `2/1/1/1` | finding original de cinco linhas |
| `23:51:35` | snapshot read-only atual | `9/1/1/1` | sete rotacoes adicionais da mesma sessao |

Entre `21:49:30` e `23:41:58`, o access log sanitizado registrou um login 200, oito refreshes 200, um `statistics/user.php` 200 e nove `list_cards.php` 200. A cadeia de nove tokens no banco possui um unico session ID anonimizado, links `previous_token_id`/`rotated_to_token_id` coerentes, oito tokens `rotated` e um `active`.

## AUTH_RUNTIME_MATRIX

| Event | Session behavior | Refresh-token behavior | Necessario para auth atual? | Expected |
| --- | --- | --- | --- | --- |
| login | cria sessao persistente | cria token inicial | sim | sim |
| authenticated verify/bootstrap | atualiza heartbeat, sem nova linha | nenhuma nova linha | sim | sim |
| refresh | mantem a sessao | cria novo token e marca anterior `rotated` | sim | sim |
| logout | revoga sessao/token family | nao apaga historico | sim | sim |

Resposta critica:

- `auth_sessions` pode permanecer permanentemente zero com login funcional? **NAO**.
- `auth_refresh_tokens` pode permanecer permanentemente zero com login/refresh funcional? **NAO**.

Impedir esses writes apenas para preservar um contador zero quebraria autenticacao, rotacao, revogacao e reuse detection.

## USER_BOOTSTRAP_MATRIX

| Table | Trigger real | O login isolado cria? | Pode ficar zero durante uso completo? | Necessidade funcional |
| --- | --- | --- | --- | --- |
| `user_statistics` | primeiro carregamento autenticado de estatisticas pelo `StudyTrackerProvider`/dashboard | nao | nao no runtime atual | necessaria para a UX atual; a persistencia poderia ser redesenhada futuramente |
| `user_cards` | perfil/checkout chama listagem, que sincroniza Stripe | nao | nao para usuario com cartao remoto que usa billing/profile | necessaria condicionalmente para cofre/billing; nao para autenticacao |

O owner anonimizado do finding tinha `stripe_customer_id` preservado e `has_saved_card=1`. A linha local possuia payment method/customer provider, enquanto assinaturas e transacoes locais estavam zeradas. Isso prova um espelho reconstruivel, nao uma inferencia por nome ou um seed.

## DISPOSABLE_EVENT_DELTA_MATRIX

Ensaio com um usuario preservado, quatro alvos vazios e os writers reais. O MySQL descartavel nao aceitou rede e foi removido ao final.

| Event | refresh delta | sessions delta | cards delta | statistics delta | Writer | Result |
| --- | ---: | ---: | ---: | ---: | --- | --- |
| A. boot sem request | 0 | 0 | 0 | 0 | nenhum | expected |
| B. pagina publica | 0 | 0 | 0 | 0 | nenhum | expected |
| C. `/auth` | 0 | 0 | 0 | 0 | nenhum | expected |
| D. login | +1 | +1 | 0 | 0 | `issueUserAuthBundle` | expected |
| E. authenticated bootstrap | 0 | 0 | 0 | 0 | `verifyAuthenticatedSession` | expected |
| F. refresh | +1 | 0 | 0 | 0 | `refreshAccessTokenUsingToken` | expected |
| G. dashboard/profile | 0 | 0 | +1 | +1 | statistics service + Stripe mirror upsert | expected |
| H. logout | 0 | 0 | 0 | 0 | `revokeSessionFamily` | expected; linhas revogadas permanecem |

Contagem final descartavel: tokens 2, sessions 1, cards 1, statistics 1. E exatamente a assinatura das cinco linhas originais.

## RESET_VS_STEADY_STATE_MATRIX

| Table | Reset completion expected | Post-resume steady state | Permanent zero viable? |
| --- | --- | --- | --- |
| `auth_sessions` | 0 | cresce por login; rows podem permanecer revogadas/expiradas | nao |
| `auth_refresh_tokens` | 0 | cresce por login e por cada rotacao | nao |
| `user_statistics` | 0 | baseline criada no primeiro uso autenticado de statistics | nao no runtime atual |
| `user_cards` | 0 para remover estado de pagamento de teste | espelho recriado ao consultar billing/profile com Stripe remoto | nao para o fluxo completo de billing |

Invariant correto:

```text
RESET_COMPLETION_STATE:
  113/113 RESETTABLE = 0 antes de liberar writers

POST_RESUME_STEADY_STATE:
  conteudo/editorial/import/atividade de teste permanece zero ate eventos reais;
  runtime recreatable pode receber apenas writes ligados a eventos funcionais auditaveis.
```

## POLICY_CLASSIFICATION_MATRIX

| Table | Current policy class | Recommended class | Expected after resume | Action required |
| --- | --- | --- | --- | --- |
| `auth_sessions` | `RESET_SAFE_OPERATIONAL_AUTH_STATE` dentro de RESETTABLE | `RECREATABLE_RUNTIME_AUTH` | sim apos login | explicitar que zero vale no reset completion, nao permanentemente |
| `auth_refresh_tokens` | `RESET_SAFE_OPERATIONAL_AUTH_STATE` dentro de RESETTABLE | `RECREATABLE_RUNTIME_AUTH` | sim apos login/refresh | mesma separacao; definir retencao/cleanup de tokens expirados separadamente |
| `user_statistics` | RESETTABLE user activity | `RECREATABLE_RUNTIME_USER_BASELINE` | sim no primeiro statistics bootstrap | reclassificar steady-state; avaliar futuramente retorno zero sem insert |
| `user_cards` | `RESET_TEST_PAYMENT_OPERATIONAL_STATE` dentro de RESETTABLE | `RECREATABLE_RUNTIME_PAYMENT_MIRROR` | sim quando Stripe remoto e billing/profile forem usados | reclassificar espelho; preservar autoridade remota e revisar politica de billing |

A recomendacao nao remove essas tabelas do reset. Ela separa a decisao de limpeza pontual da expectativa posterior ao resume.

## WRITER_INVENTORY_RECONCILIATION_MATRIX

| Table | Observed writer ID in 25-writer inventory | Other inventoried coverage | Classification |
| --- | --- | --- | --- |
| `auth_sessions` | `http-auth-account` | `manual-backfills-migrations-reset` | KNOWN |
| `auth_refresh_tokens` | `http-auth-account` | `manual-backfills-migrations-reset` | KNOWN |
| `user_cards` | `http-auth-account` | `manual-backfills-migrations-reset` | KNOWN |
| `user_statistics` | `http-practice-user-activity` | `systemd-platform-event-consumer`, manual maintenance | KNOWN |

Resumo: `KNOWN=4`, `MISCLASSIFIED_WRITER=0`, `MISSING=0`. A classificacao incorreta estava no invariant de steady state, nao no inventario de processos.

## FREEZE_COVERAGE_MATRIX

| Writer | Freeze mechanism | Zero during reset | Write after resume | Freeze failure? |
| --- | --- | --- | --- | --- |
| `http-auth-account` | full maintenance ingress barrier; ingress restored last | sim | login/refresh/profile posteriores | nao |
| `http-practice-user-activity` | full maintenance ingress barrier | sim | dashboard statistics posterior | nao |
| `systemd-platform-event-consumer` | producer block, boundary wait, systemd stop | sim | nenhuma das cinco linhas atribuida a ele | nao |
| manual maintenance | exclusive operation authorization/session allowlist | sim | nenhuma linha atribuida | nao |

O relatorio do reset prova zero enquanto frozen e zero imediatamente depois do primeiro resume/smoke. Os writes comecaram somente no login de `21:49:30 UTC`, muitas horas depois.

## PRODUCTION_READONLY_MATRIX

| Check | Result |
| --- | --- |
| Database | `concursomestre` |
| Engine | MySQL `8.4.10-10` |
| `SHOW GRANTS` write-capable privileges | 0 |
| SQL usado | `SELECT`, `SHOW`, `information_schema` |
| Production DML/DDL | 0 |
| Tokens/secrets/PII materializados no relatorio | 0 |
| Remote temporary helper residue | 0 |
| Reset repetido | nao |

## FINAL_RISK_MATRIX

| Priority | Finding | Consequence | Required next action |
| --- | --- | --- | --- |
| P0 | nenhum | nenhuma evidencia de corrupcao, auth compromise ou writer desconhecido | none |
| P1 | policy/auditoria exige zero permanente para runtime que legitimamente escreve | falso blocker recorrente ou tentacao de quebrar auth/billing com guard | alterar policy e reporter para dois estados antes do checkpoint |
| P2 | `GET statistics/user.php` persiste baseline | read path possui side effect evitavel em desenho alternativo | avaliar separadamente; nao bloquear diagnostico |
| P2 | `list_cards.php` sincroniza e atualiza espelho a cada consulta | acoplamento read/sync e churn de `updated_at` | revisar frequencia/cache no gate de billing |
| P2 | refresh tokens rotacionados acumulam historico | crescimento normal sem politica explicita de retencao pode aumentar tabela | definir cleanup seguro para expirados/revogados |

## Decisao

Classificacao dos cinco registros originais:

- Categoria A: tres registros (`auth_sessions=1`, `auth_refresh_tokens=2`).
- Categoria B: dois registros (`user_cards=1`, `user_statistics=1`).
- Categoria C: zero.
- Categoria D: zero.

Nao ha evidencia que justifique guard ou remediation de writer. O proximo passo correto e uma etapa separada para tornar `RESET_POLICY_V2`, readiness reporter e gate de checkpoint conscientes de `RESET_COMPLETION_STATE` versus `POST_RESUME_STEADY_STATE`, com allowlist explicita de runtime recreatable e deteccao de writes sem evento funcional.

```text
P0 = 0
P1 = 1
POST_RESET_RUNTIME_DRIFT_DIAGNOSIS_READY
RESET_POLICY_V2_STEADY_STATE_RECLASSIFICATION_REQUIRED
MACROSTEP_11B_READY_FOR_GIT_CHECKPOINT = NAO
REAL_DATA_INSERTION_AUTHORIZED = NAO

production DB writes = 0
rows deleted = 0
policy changed = NAO
guard applied = NAO
commit = NAO
push = NAO
deploy = NAO
```
