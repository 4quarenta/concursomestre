# Macroetapa 14 - API / Backend + Mobile API Readiness

Data da execucao: 2026-08-29/30

Base imutavel: `74a50d00f96de3fa86f804da739ac5c64c1c3c52`

Worktree: `4quarenta/phase-14-api-readiness`
Candidate fingerprint V1 (relatorio excluido): `01fa897fb3c05aab61a74c8a6f11b59b6cc7f6cc1f09e466da49a57de3222ed9`

Fingerprint legado: `68810dd375dca4d6a8d142fbdf4c00942ec3e3f6530a1413909fd9ba5a3aaaf2` (`DEPRECATED_CULTURE_SORT_NON_CANONICAL`)

## 1. Resumo executivo

A camada critica usada pelo aplicativo movel foi consolidada com autenticacao nativa por bearer token, refresh rotativo, deteccao de reuse, revogacao no logout, 2FA e armazenamento seguro. O contrato web baseado em cookie e CSRF foi preservado. A API de questoes v2 continua sendo a autoridade para resposta idempotente, e o cliente deixou de carregar todas as paginas de questoes.

O inventario estatico cobre 287 arquivos PHP, 267 bridges HTTP e 74 aliases do router. A superficie historica permanece majoritariamente nao versionada; cinco endpoints v2 existem. Em 96 bridges legadas o metodo nao e imposto no arquivo bridge de forma estaticamente demonstravel, porque o tratamento e delegado ao handler ou multiplexado. Isso e divida P2 de consistencia/documentacao, nao um P1 novo nas rotas mobile endurecidas.

Resultado tecnico: P0 = 0, P1 = 0, regressao nova = 0. O candidato esta pronto para rollout controlado, mas nao foi commitado, enviado ou implantado.

## 2. Identidade e escopo

O fingerprint inicialmente registrado usou ordenacao cultural do PowerShell. A identidade foi reconciliada para ordenacao bytewise `LC_ALL=C`, sem qualquer diferenca de conteudo ou do conjunto de 40 arquivos funcionais:

```text
MACROSTEP_14_LEGACY_FUNCTIONAL_FINGERPRINT = 68810dd375dca4d6a8d142fbdf4c00942ec3e3f6530a1413909fd9ba5a3aaaf2
LEGACY_STATUS = DEPRECATED_CULTURE_SORT_NON_CANONICAL
MACROSTEP_14_FUNCTIONAL_FINGERPRINT_V1 = 01fa897fb3c05aab61a74c8a6f11b59b6cc7f6cc1f09e466da49a57de3222ed9
FINGERPRINT_RECONCILIATION = POWERSHELL_CULTURE_SORT_TO_BYTEWISE_LC_ALL_C
CONTENT_DIFFERENCE = 0
FUNCTIONAL_FILE_SET_DIFFERENCE = 0
```

| Item | Resultado |
| --- | --- |
| Base SHA | `74a50d00f96de3fa86f804da739ac5c64c1c3c52` |
| Arquivos funcionais | 40 (33 modificados, 7 novos) |
| Diff funcional | `+803/-210` |
| Out of scope | 0 |
| Uncertain | 0 |
| Migration local | 0 |
| Dependencias/lockfiles | 0 |

As alteracoes de compatibilidade Next.js 16 em Lei Comentada, robots e reporter de performance foram exigidas pelos gates de build/teste do proprio candidato. Elas movem exports proibidos de special files para helpers sem alterar contratos publicos.

## 3. Inventario da API

| Metrica | Total |
| --- | ---: |
| Arquivos PHP fisicos | 287 |
| Bridges HTTP chamaveis | 267 |
| Aliases no router | 74 |
| Endpoints v2 | 5 |
| Endpoints nao versionados | 282 |
| Superficie admin estimada | 93 |
| Superficie mobile-relevant estimada | 155 |
| Metodo nao explicito no bridge legado | 96 |

O inventario completo esta em `.tmp/api/phase-14-api-route-inventory.json`. `legacy` significa superficie de compatibilidade nao versionada, e nao codigo comprovadamente morto. Nenhuma rota foi removida sem evidencia de consumidores.

## 4. Versionamento e consumidores

- Contrato canonico mobile: endpoints de auth endurecidos e questoes v2 para show/list/answer.
- Compatibilidade web: endpoints nao versionados continuam ativos.
- A listagem mobile de questoes ainda usa bridge legado limitado a 50 itens por causa do view model existente; deixou de fazer varredura integral. Migracao total para DTO v2 server-filtered fica como P2.
- Aliases do router foram preservados e inventariados.

## 5. Matriz de autenticacao

| Fluxo | Web | Mobile nativo |
| --- | --- | --- |
| Transporte | cookie de sessao | bearer access token |
| Refresh | cookie + CSRF | refresh token + CSRF explicito |
| CSRF | obrigatorio | token vinculado ao refresh |
| Rotacao | preservada | single-flight e persistencia atomica |
| Reuse | rejeitado | rejeitado e sessao revogada |
| Logout | revoga sessao | revoga refresh e limpa SecureStore |
| 2FA | preservado | tela e fluxo dedicados |

O opt-in mobile exige `X-Client-Platform: concursomestre-mobile` e ausencia de `Origin` de navegador. Um browser nao pode trocar o boundary web por bearer apenas adicionando o header.

## 6. Seguranca e autoridade

| Gate | Resultado |
| --- | --- |
| Public question DTO | PASS |
| Gabarito/editorial em payload publico | 0 |
| Autoridade server-side | PASS |
| Ownership/object authorization | PASS |
| Admin authorization | PASS |
| JSON malformado | rejeitado |
| CORS/CSRF boundary | PASS |
| Private cache | `private, no-store` |
| Upload/security wiring | PASS |
| Segredos no diff | 0 |

O sanitizador publico remove recursivamente respostas, gabaritos e conteudo editorial protegido. IDs, ownership e regras de negocio sao revalidados no servidor; o cliente nao e autoridade.

## 7. Contratos HTTP e dados

As rotas criticas agora possuem guards de metodo, JSON estrito, envelopes de erro estaveis e status coerentes. O contrato mobile usa HTTPS canonico, tipos explicitos e datas ISO-8601 no boundary documentado. Paginacao e filtros sao limitados no servidor; a tela de questoes nao percorre mais toda a colecao.

O scan SQL encontrou interpolacoes apenas em expressoes internas allowlisted, booleanos e inteiros limitados nas superficies auditadas. Nao foi encontrado SQL injection. Repositories legados ainda contem DDL defensivo em request-time; a remocao exige migrations e revisao transversal, portanto permanece P2.

## 8. Retry, idempotencia e concorrencia

- Resposta de questao usa chave idempotente persistida pelo cliente.
- Refresh concorrente usa single-flight.
- Falha/reuse de refresh limpa credenciais locais.
- Resposta envia `selectedAlternativeId`, nunca gabarito calculado no cliente.
- Nenhuma query por card/chip foi adicionada.

## 9. Mobile E2E descartavel

Executado contra MySQL 8.4 descartavel, sem conexao com producao:

| Caso | Resultado |
| --- | --- |
| Public request | PASS |
| Login | PASS |
| Authenticated account | PASS |
| Refresh rotation | PASS |
| Refresh reuse rejected | PASS |
| Logout revocation | PASS |
| Malformed JSON rejected | PASS |
| Browser native opt-in rejected | PASS |
| Production connections | 0 |

## 10. Clean-room audit

O patch foi reaplicado sobre checkout limpo da base. Dependencias foram somente referenciadas por junctions locais; nenhum lockfile foi alterado.

| Gate | Resultado |
| --- | --- |
| PHP focused (11 suites) | PASS |
| PHP lint | PASS, 1091/1091 |
| Mobile E2E | PASS |
| Root typecheck | PASS |
| Mobile typecheck | PASS |
| Next.js Webpack build | PASS |
| Secret scan | PASS |
| Encoding | PASS |
| Generated artifacts | PASS |
| `git diff --check` | PASS |

Vitest completo: 901 testes passaram. Duas suites preexistentes falham de forma identica na base e no candidato por incompatibilidade CJS/ESM em `@csstools/css-calc`: `phase8FinalGateReporter.test.mjs` e `semantic-page-snapshot.test.mjs`. Nenhum teste novo falhou; isso e divida P2 do ambiente de testes.

O teste PHP de integracao de cursor que depende do banco local padrao nao pode usar `concursomestre` ausente. O mesmo caminho de persistencia foi exercitado no E2E MySQL 8.4 descartavel.

## 11. Compatibilidade web e SEO

Auth web, pratica, conteudo publico, metadata de Lei Comentada e robots foram revalidados. Os helpers extraidos preservam o comportamento e eliminam exports invalidos em special files do Next.js. Nao foi criado SEO paralelo, nao houve alteracao de launch mode e nenhuma URL foi promovida.

## 12. Legacy e P2

| Item | Classificacao | Acao futura |
| --- | --- | --- |
| 96 bridges sem metodo explicitamente imposto no bridge | P2 | documentar/normalizar por dominio |
| API historica majoritariamente nao versionada | P2 | migracao incremental, sem big bang |
| Listagem mobile ainda em bridge legado limitado | P2 | DTO/listagem v2 server-filtered |
| DDL defensivo em request-time legado | P2 | migration-first removal |
| Uniformidade global de datetime/tipos no legado | P2 | convergir por contrato versionado |
| Rate limiting amplo | deferred Security 12 | manter controles criticos existentes |
| Billing completo | deferred Macro 16 | nao misturar com esta fase |
| Duas suites Vitest CJS/ESM | P2 tooling | corrigir ambiente sem mascarar testes |

## 13. Blocker ledger

| Severidade | Restantes |
| --- | ---: |
| P0 | 0 |
| P1 | 0 |
| P2/deferred | 8 |

## 14. Estado operacional

Nenhuma conexao de producao foi realizada. O SHA produtivo e o estado PRELAUNCH abaixo sao premissas do prompt, nao verificacao live desta execucao. A janela da Macroetapa 13 continuou sem interferencia; o heartbeat ocorreu antes de completar 93600 segundos e, por isso, nenhuma acao na VPS foi antecipada.

```text
MACROSTEP_13_OBSERVATION_INTERFERENCE = 0
CURRENT_PRODUCTION_SHA = 74a50d00f96de3fa86f804da739ac5c64c1c3c52
LAUNCH_MODE = PRELAUNCH
PRODUCTION_DEPLOY_THIS_RUN = NÃO
PRODUCTION_DML_THIS_RUN = 0
PRODUCTION_DDL_THIS_RUN = 0
PRODUCTION_MIGRATIONS_THIS_RUN = 0
MYSQL_PRODUCTION_MUTATIONS = 0
STRIPE_MUTATIONS = 0
REAL_DATA_INSERTIONS = 0
```

## 15. Decisao

```text
MACROSTEP_14_CONSOLIDATED_API_BACKEND_MOBILE_READINESS_READY
MACROSTEP_14_IMPLEMENTATION = READY
MACROSTEP_14_INDEPENDENT_AUDIT = PASS
API_BACKEND_READINESS = PASS
MOBILE_API_READINESS = PASS
P0_REMAINING = 0
P1_REMAINING = 0
NEW_TEST_REGRESSIONS = 0
MACROSTEP_14_READY_FOR_CONTROLLED_ROLLOUT = SIM
MACROSTEP_14_COMPLETED = NÃO
```

O proximo passo e uma autorizacao separada para checkpoint/rollout controlado da candidata. Nenhum commit, push ou deploy foi executado.
