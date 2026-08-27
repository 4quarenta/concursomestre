# Macroetapa 11B-POST-R-AUDIT

## Contexto

Auditoria independente da remediacao pos-reset, executada em 2026-08-26 contra
a branch `1.0.0` e baseline
`fbb34f83f94bbda0792bd861c20d137916566a58`. Nenhum dado foi inserido,
alterado ou removido pela auditoria. Nao houve commit, push ou deploy.

## Resumo executivo

Classificacao: **NAO RECOMENDADA PARA CHECKPOINT/DEPLOY**.

O zero-state primario esta estavel: duas capturas read-only posteriores aos
probes confirmaram 113/113 tabelas RESETTABLE vazias, zero linhas RESETTABLE e
zero linhas em `analytics_lifecycle_events`. As 12 tabelas PRESERVE mantiveram
contagens e digests identicos entre as capturas. Os quatro assets PRESERVE
esperados estao intactos e nao ha asset RESETTABLE residual.

A remediacao de sitemap, contudo, nao atende o gate independente. Os endpoints
oficiais `/sitemap.xml`, `/sitemap-index.xml` e `/sitemaps/*` estao fail-closed
com HTTP 503, mas a quarentena foi colocada sob `backend/storage`, que e servida
pela regra geral `location /storage/`. Assim, o indice e os cinco shards antigos
continuam acessiveis por URLs publicas alternativas. Os shards expõem 1.275 URLs
stale. Esse e exatamente o bypass Nginx classificado como P1 pela especificacao.

Tambem permanecem lacunas arquiteturais P1: validacao HTTP de URLs e opt-in e
desativada por default; o fingerprint logico e derivado do XML materializado,
nao de uma versao corrente independente do dataset elegivel; o materializador
replica regras de publicacao/readiness em SQL em vez de consumir a decisao SEO
autoritativa; e nao existe teste integrado com banco descartavel cobrindo o
ciclo add/remove/noindex/redirect/404/bulk-reset.

## Evidencia read-only

| Controle | Captura 1 | Captura 2 |
| --- | ---: | ---: |
| Timestamp UTC | 2026-08-26T13:05:25Z | 2026-08-26T13:06:56Z |
| Banco | concursomestre | concursomestre |
| Engine | MySQL 8.4.10-10 | MySQL 8.4.10-10 |
| Grants read-only | PASS | PASS |
| Tabelas/FKs | 125/91 | 125/91 |
| RESETTABLE vazias | 113/113 | 113/113 |
| RESETTABLE total rows | 0 | 0 |
| analytics_lifecycle_events | 0 | 0 |
| PRESERVE tables | 12 | 12 |
| Writes da auditoria | 0 | 0 |

Fingerprint estrutural nas duas capturas:
`7e9904fc21bfa27ec5fe108f5ba6c0e594bf677fed9a509425beb77043656741`.
A policy de reset nao possui tabela ausente, desconhecida ou sobreposta.

## ZERO_STATE_MATRIX

| Evidencia | Resultado | Status |
| --- | --- | --- |
| 113 tabelas RESETTABLE | todas com COUNT(*) = 0 | PASS |
| Total RESETTABLE | 0 | PASS |
| Observacao repetida | estado identico apos timers e probes | PASS |
| Dataset real carregado | nao | PASS |
| Insercao real autorizada | nao | PASS |

## ANALYTICS_ZERO_STATE_MATRIX

| Caso | Resultado | Status |
| --- | --- | --- |
| Writer efetivo encontrado | `AnalyticsTrackingRepository` | PASS |
| PRELAUNCH + dataset vazio | guard retorna antes do writer | PASS |
| `/api/analytics/track.php` | 200, tracked=false, discarded=true | PASS |
| caminho backend legado | 200, tracked=false, discarded=true | PASS |
| Contagem apos probes | 0 | PASS |
| Condicao reversivel | guard depende de PRELAUNCH + dataset vazio | PASS |
| Auth smoke | `/auth` 200; confirmacao 200; reset redireciona | PASS |

O Nginx de analytics e apenas defesa operacional temporaria. O codigo da
aplicacao preserva tracking quando o launch mode ou o estado do dataset deixar
de satisfazer a condicao de descarte.

## SITEMAP_SOURCE_OF_TRUTH_MATRIX

| Componente | Fonte observada | Status |
| --- | --- | --- |
| Entidades dinamicas | queries keyset ao banco | PASS |
| URLs estaticas | mapa versionado de familias/route builder | PASS |
| Lista manual de entidades | nao encontrada | PASS |
| Publication/Readiness/SeoDecision | regras duplicadas no SQL do gerador | FAIL P1 |
| Artefato anterior como fonte | nao no gerador; ainda publico na quarentena | FAIL P1 |

## SITEMAP_ELIGIBILITY_MATRIX

| Gate | Implementacao | Resultado |
| --- | --- | --- |
| Family target/eligibility | `SeoProductionPageMap` | PASS |
| Publication/visibility | predicados SQL por familia | PARTIAL |
| Instance readiness | predicados SQL por familia | PARTIAL |
| SeoDecision INDEX/render | nao consumido diretamente | FAIL P1 |
| Canonical host/slug | route builders e validacao XML | PASS parcial |
| HTTP 200/noindex/redirect/404 | `SITEMAP_VALIDATE_HTTP`, default `0` | FAIL P1 |

## SITEMAP_INVALIDATION_MATRIX

| Mutacao | Invalida antes da mutacao | Status |
| --- | ---: | --- |
| filters/taxonomias | sim | PASS |
| questions | sim | PASS |
| provas | sim | PASS |
| blog/taxonomias do blog | sim | PASS |
| materiais/publicacao | sim | PASS |
| Lei Comentada | sim | PASS |
| importacao taxonomica Gran | sim | PASS |
| RESET_POLICY_V2 commit | invalida e retira artefato | PASS |
| SQL direto/writer futuro nao instrumentado | nao detectado pelo state atual | FAIL P1 |

## CANONICAL_WRITER_COVERAGE_MATRIX

| Familia | Writer atual | Cobertura |
| --- | --- | --- |
| Questions | repository canonico | PASS |
| Exams | repository canonico | PASS |
| Filters/professional taxonomies | repositories canonicos | PASS |
| Blog | repository canonico | PASS |
| Materials | repository canonico | PASS |
| Laws/articles | repository canonico | PASS |
| Contests | nenhum CRUD editorial ativo auditado | GATE FUTURO |
| Public simulations | nenhum CRUD editorial ativo auditado | GATE FUTURO |
| Mutacao fora da aplicacao | sem CDC/trigger/version counter | FAIL P1 |

## PRIVATE_WRITER_MATRIX

| Writer privado | Deve invalidar | Resultado |
| --- | ---: | --- |
| Respostas/progresso | nao | PASS |
| Favoritos/bookmarks | nao | PASS |
| Auth/sessao | nao | PASS |
| Progresso de simulado privado | nao | PASS |
| Analytics | nao | PASS |

## LOGICAL_FINGERPRINT_MATRIX

| Caso | Resultado | Status |
| --- | --- | --- |
| Alterar URL/lastmod do shard | muda fingerprint | PASS |
| DIRTY vs CURRENT | estado divergente e recusado | PASS |
| Comparar com dataset elegivel corrente | nao; hash nasce dos XMLs gerados | FAIL P1 |
| Writer perdido/SQL direto | artifact pode continuar CURRENT | FAIL P1 |

## PHYSICAL_FINGERPRINT_MATRIX

| Caso | Resultado | Status |
| --- | --- | --- |
| Hash agregado dos XMLs | SHA-256 versionado no status/state | PASS |
| Hash por arquivo na leitura | conferido antes de servir | PASS |
| Corrupcao posterior | teste recusa arquivo alterado | PASS |

## ATOMIC_PROMOTION_MATRIX

| Caso | Resultado | Status |
| --- | --- | --- |
| Geracao em staging | sim | PASS |
| Validacao antes da promocao | XML completo sim; HTTP opcional | PARTIAL |
| Linux | rename de symlink para release imutavel | PASS |
| Teste Linux em `/tmp` | publisher e state PASS | PASS |
| Falha de stage | stage descartado; current preservado | PASS |
| Falha de geracao | DIRTY + withdraw | PASS |

## DIRTY_CURRENT_STATE_MATRIX

| Estado | Aplicacao serve | Resultado |
| --- | ---: | --- |
| CURRENT + fingerprints validos | sim, quando launch permite | PASS |
| DIRTY | nao | PASS |
| state ausente/corrompido | nao | PASS |
| hash fisico divergente | nao | PASS |
| DB mudou sem invalidacao | pode permanecer CURRENT | FAIL P1 |

## PRELAUNCH_PUBLICATION_MATRIX

| Caminho | HTTP | Resultado |
| --- | ---: | --- |
| `/sitemap.xml` | 503 | PASS |
| `/sitemap-index.xml` | 503 | PASS |
| `/sitemaps/questions-00001.xml` | 503 | PASS |
| quarentena `/storage/.../sitemap.xml` | 200 | FAIL P1 |
| quarentena `/storage/.../questions-00001.xml` | 200 | FAIL P1 |

## SITEMAP_TIMER_MATRIX

| Timer/service | Estado/ensaio | Resultado |
| --- | --- | --- |
| sitemap principal | timer active; service success | PASS |
| blog sitemap | timer active; service success | PASS |
| Execucao manual PRELAUNCH | diretorio oficial permaneceu ausente | PASS |
| Republicacao da quarentena | nao pelo timer | PASS |
| Exposicao da quarentena apos timer | continua HTTP 200 | FAIL P1 |

## NGINX_BYPASS_MATRIX

| Regra | Resultado | Status |
| --- | --- | --- |
| Snippet oficial de sitemap | 503 fail-closed; sem alias | PASS |
| Exemplo versionado | proxy para app; sem alias | PASS |
| `location /storage/` ativo | serve `backend/storage` diretamente | FAIL P1 |
| Quarentena sob storage | cinco shards acessiveis | FAIL P1 |

## NGINX_CONTAINMENT_MATRIX

| Superficie | Contencao atual | Status |
| --- | --- | --- |
| Rotas oficiais de sitemap | sim | PASS |
| Artefato oficial em filesystem | ausente | PASS |
| Caminhos alternativos sob storage | nao contidos | FAIL P1 |
| Analytics tracker | contido em dois caminhos exatos | PASS |

## HTTP_SEMANTICS_MATRIX

| Caso | Semantica | Avaliacao |
| --- | --- | --- |
| Sitemap oficial PRELAUNCH | 503 + no-store + noindex | APPROVED_SEMANTIC temporario |
| Quarentena | 200 XML publico | INVALID |
| Validacao de candidatos futuros | opt-in, default off | INVALID |

O 503 e aceitavel como indisponibilidade temporaria enquanto PRELAUNCH. Nao e
substituto para remover o bypass e deve deixar de ser uma edicao manual
permanente quando a aplicacao corrigida for implantada.

## APPLICATION_TARGET_ARCHITECTURE_MATRIX

| Controle | Resultado | Status |
| --- | --- | --- |
| LaunchMode no app | fail-safe PRELAUNCH | PASS |
| CURRENT/DIRTY | verificado | PASS |
| Fingerprint fisico | verificado | PASS |
| Fingerprint logico vs DB corrente | nao verificado | FAIL P1 |
| Decisao SEO autoritativa unica | SQL replica regras | FAIL P1 |
| Config Nginx versionada | encaminha ao app | PASS |
| Codigo implantado em producao | nao | PENDENTE, sem deploy nesta auditoria |

## DATABASE_CHANGE_REGENERATION_MATRIX

| Fixture obrigatoria | Evidencia atual | Status |
| --- | --- | --- |
| 0 entidades -> 0 URLs dinamicas | inferido por SQL/zero-state, sem integration test | FAIL P1 |
| add eligible -> aparece | nao executado em DB descartavel | FAIL P1 |
| remove -> desaparece | nao executado em DB descartavel | FAIL P1 |
| NOINDEX -> excluido | policy unit test, nao materializer integrado | PARTIAL |
| redirect/404 -> excluido | contract unit test, nao materializer integrado | PARTIAL |
| bulk reset -> zero stale | teste de wiring/state, nao ciclo DB completo | PARTIAL |

## BULK_RESET_INVALIDATION_MATRIX

| Etapa | Resultado | Status |
| --- | --- | --- |
| Pos-commit do reset | `RESET_POLICY_V2_COMMITTED` | PASS |
| State | DIRTY | PASS |
| Artefato oficial | withdraw atomico | PASS |
| Quarentena fora da web root | nao | FAIL P1 |
| XML vazio manual | nao criado | PASS |

## PRESERVE_INTEGRITY_MATRIX

| Tabela | Rows captura final | Integridade entre capturas |
| --- | ---: | --- |
| addresses | 2 | estavel |
| admin_audit_logs | 1926 | estavel |
| bank_accounts | 0 | estavel |
| cache_settings | 0 | estavel |
| filter_types | 10 | estavel |
| plans | 14 | estavel |
| schema_audit_runs | 0 | estavel |
| schema_backfill_runs | 1 | estavel |
| schema_migrations | 62 | estavel |
| security_ip_bans | 0 | estavel |
| system_settings | 99 | estavel |
| users | 6 | estavel |

Os digests atuais permaneceram identicos nas duas observacoes desta auditoria.
Eles nao foram tratados como iguais ao snapshot historico anterior porque
operacoes administrativas legitimas podem ter ocorrido entre as macroetapas.

## UNAUTHORIZED_WRITE_MATRIX

| Operacao | Quantidade |
| --- | ---: |
| INSERT/seed/crawler/import/backfill | 0 |
| UPDATE/DELETE da auditoria | 0 |
| Migration/DDL | 0 |
| Real dataset load | 0 |
| Busca read-only | 2 snapshots + contagens |

## Assets e schema

- Assets: 4 preservados, 4 intactos, 0 RESETTABLE residual, 0 desconhecidos,
  0 symlinks.
- Schema: 125 tabelas, 91 FKs, migration mais recente `20260811_151000`.
- Policy V2: validacao OK, sem missing, unknown ou overlap.

## TEST_MATRIX

| Gate | Resultado |
| --- | --- |
| PHP focused | 12/12 PASS |
| PHP lint | 52 arquivos PASS |
| Vitest Node 22 | 154/154 files, 911/911 tests PASS |
| Vitest Node 20 | incompatibilidade ambiental ESM; 152 suites e 897 testes passaram antes da coleta falhar |
| Typecheck + route types | PASS |
| Next build | PASS, 52 paginas |
| ESLint focado | 3 arquivos PASS |
| ESLint integral | interrompido apos longa varredura sem output; nao conclusivo |
| Launch validator | PASS, 55 familias, 44 graph families |
| Secret scan | PASS |
| Encoding | PASS |
| `git diff --check` | PASS, somente avisos EOL |
| Publisher/state em Linux | PASS |

## Diff auditado

O diff acumulado possui 27 arquivos rastreados modificados e 20 entradas
untracked agregadas. As alteracoes se classificam em reset policy/tooling,
writer freeze, analytics zero-state, sitemap state/fingerprints/publisher,
materializer, invalidation de writers, Nginx versionado, readers Next, testes e
documentacao. `out-of-scope = 0` para o conjunto acumulado das macroetapas 11A,
11B e remediacao pos-reset. A auditoria acrescenta apenas este relatorio e o JSON
local exigido.

## FINAL_RISK_MATRIX

| ID | Nivel | Finding | Consequencia | Correcao exigida |
| --- | --- | --- | --- | --- |
| P1-01 | P1 | quarentena sob `/storage` retorna 200 | 1.275 URLs stale continuam publicas | mover/remover quarentena para path nao servido e bloquear padroes stale |
| P1-02 | P1 | validacao HTTP default off | sitemap futuro pode conter redirect/404/noindex | tornar validacao obrigatoria e fail-closed antes de production promotion |
| P1-03 | P1 | fingerprint logico nasce do XML | DB drift pode nao invalidar artifact CURRENT | versionar/recalcular dataset elegivel corrente ou cobrir toda mutacao autoritativa |
| P1-04 | P1 | policy de sitemap duplicada em SQL | drift de Publication/Readiness/SeoDecision | consumir decisao autoritativa ou contrato compartilhado executavel |
| P1-05 | P1 | faltam testes DB add/remove/reset integrados | comportamento database-driven nao foi provado end-to-end | criar suite MySQL descartavel do materializador |
| P2-01 | P2 | 503 temporario | crawlers podem repetir tentativas | revisar 404/410 no gate de deploy sem enfraquecer fail-closed |
| P2-02 | P2 | ESLint integral lento no workspace com `.tmp` extensa | gate local pouco previsivel | excluir artefatos locais ou executar escopo versionado deterministico |

`P0 = 0`.

`P1 = 5`.

## Declaracoes finais

- RESET_POLICY_V2 = EXECUTED_AND_STABLE no banco primario.
- 113 resettable tables empty = SIM.
- RESETTABLE_TOTAL_ROWS = 0.
- automatic repopulation = 0.
- analytics_lifecycle_events = 0.
- sitemap source of truth = DATABASE: PARCIAL, com drift arquitetural pendente.
- sitemap manual URL maintenance = NAO.
- sitemap invalidation = PARCIAL, sem cobertura de mutacao fora dos hooks.
- sitemap materialization = DATABASE_DRIVEN: PARCIAL.
- public stale sitemap = SIM, por bypass `/storage`.
- public stale shards = 5.
- stale sitemap URLs = 1275.
- effective launch mode = PRELAUNCH.
- real dataset loaded = NAO.
- real dataset validated = NAO.
- REAL_DATA_INSERTION_AUTHORIZED = NAO.
- production indexing activated = NAO.
- production sitemap published = NAO nos endpoints oficiais, mas shards stale sao publicos por caminho alternativo.
- search engines notified = NAO verificado; nenhuma notificacao foi executada.
- production DB writes by audit = 0.
- commit = NAO.
- push = NAO.
- deploy = NAO.

## Recomendacao

Interromper o checkpoint/deploy desta remediacao. Primeiro retirar a quarentena
da arvore servida, fechar o alias generico para artefatos derivados, tornar a
validacao HTTP obrigatoria, ligar freshness a uma versao corrente do dataset e
adicionar o teste integrado descartavel. Depois repetir esta auditoria desde os
probes publicos.

`DATASET_RESET_POST_REMEDIATION_AUDIT_NOT_READY`

`TEST_DATASET_REMOVAL_NOT_CONFIRMED`

`REAL_DATA_INSERTION_AUTHORIZED = NAO`
