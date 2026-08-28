# Macroetapa 11D - Final Rollout Readiness

Data: 2026-08-28
Branch: `1.0.0`
SHA implantado: `a357501ec74803bd254124995103b87cf5a24cad`
Launch mode efetivo: `PRELAUNCH`

## Veredito executivo

`MACROSTEP_11D_FINAL_ROLLOUT_READINESS_READY`

O candidate da fundacao de ingestao passou pelo rehearsal MySQL 8.4.11,
integracao sintética, auditoria de seguranca, regressao e pos-check somente
leitura de producao. Nenhum dado real foi usado. Nao houve commit, push,
deploy, migration ou escrita no banco de producao.

`CANDIDATE_FINGERPRINT=ad3002958b99a6e1b87efb9fe7c6fe4f94d5c7b65bc5d6547ac68b07f51bdee0`.
O fingerprint cobre os 31 arquivos funcionais 11D anteriores a este relatorio,
ordenados por path, com cada SHA-256 de arquivo incluido no payload. O relatorio
final e o JSON ignored ficam fora do fingerprint para evitar autorreferencia.

## Candidate freeze

| Classe | Quantidade | Estado |
|---|---:|---|
| Arquivos funcionais 11D antes deste relatorio | 31 | NEW |
| Modificados rastreados | 0 | nenhum |
| Removidos | 0 | nenhum |
| Renomeados | 0 | nenhum |
| Relatorios historicos 11B/11C separados | 8 | fora do candidate |
| Artefatos `.tmp` | ignored | fora do candidate |
| Out of scope | 0 | PASS |
| Uncertain | 0 | PASS |

O candidate inclui uma migration, um rollback, 26 arquivos do modulo de
ingestao, dois testes PHP e o relatorio funcional inicial. Este relatorio final
eleva o total versionavel da 11D para 32 arquivos. Os oito relatorios historicos
ja presentes no worktree nao foram alterados nem incorporados ao candidate.

## Correcoes da auditoria final

Os seguintes riscos foram corrigidos antes do gate final:

1. `CanonicalEntityPersistencePort` tornou obrigatoria a persistencia do modelo
   canonico na mesma transacao dos metadados de ingestao.
2. `IngestionWriterRegistry` passou a rejeitar writer desconhecido.
3. Lifecycle de run ganhou start, checkpoint, complete e fail persistidos.
4. O PDO passou a distinguir replay bruto, mesma versao sem mudanca e update
   semantico, incluindo identidade de dominio cross-source.
5. Deduplicacao cross-source passou a preservar provenance sem mutacao canonica.
6. Lookup in-memory ganhou indices por source/domain identity e deixou de ser
   quadratico.
7. Alias de taxonomia passou a retornar a identidade canonica do alias.
8. Redirect de asset passou por nova validacao do destino final.
9. As tres FKs da migration passaram a declarar `ON DELETE RESTRICT ON UPDATE
   RESTRICT` explicitamente.

Depois dessas correcoes: `P0=0` e `P1=0`.

## Migration audit

`MIGRATION_FILE=backend/database/migrations/20260828_140000_ingestion_pipeline_foundation.php`

`MIGRATION_CHECKSUM=876ed111ba68de44a0e5fc77b5fe71132da560ca00101bcca1756f2d4b77461d`

| Objeto | Quantidade | Finalidade |
|---|---:|---|
| `ingestion_runs` | 1 tabela | identidade, estado e checkpoint do run |
| `ingestion_items` | 1 tabela | idempotencia, source identity, estado e retry por item |
| `ingestion_provenance` | 1 tabela | rastreabilidade source para canonical |
| `ingestion_item_events` | 1 tabela | historico de transicoes e observabilidade |
| `ingestion_leases` | 1 tabela | exclusao mutua e recuperacao de lease stale |
| Colunas | 52 | somente capacidades usadas pela 11D |
| Indices, incluindo PK/unique | 19 | lookup, dedupe, retry e lease |
| Foreign keys | 3 | todas `RESTRICT/RESTRICT` |
| Tabelas alteradas | 0 | migration aditiva |
| Triggers | 0 | nenhum |
| Outros objetos | 0 | nenhum |

`NEW_MIGRATIONS=1`; `MODIFIED_EXISTING_MIGRATIONS=0`. Nao ha backfill,
DML de conteudo ou schema especulativo sem consumidor 11D.

## MySQL 8.4 rehearsal

O rehearsal usou MySQL Community `8.4.11` em WSL, loopback-only e datadir
descartavel. O schema-base veio de snapshot somente de schema da producao e foi
reconstruido ate o release implantado pelo runner oficial. Nenhuma row ou PII de
producao foi copiada.

| Gate | Evidencia | Resultado |
|---|---|---|
| Banco descartavel | porta 33082, datadir `/tmp`, teardown por trap | PASS |
| Pre-schema | 126 tabelas | PASS |
| Pre-schema fingerprint | `85828171eea1331da1848459fadb8e3ca84d12b6089f1a25dbce49864038b642` | registrado |
| Apply oficial | target `20260828_140000` | PASS |
| Tabelas criadas | 5 | PASS |
| Colunas criadas | 52 | PASS |
| Indices criados | 19 | PASS |
| FKs criadas | 3, non-RESTRICT = 0 | PASS |
| Mudancas inesperadas | 0 | PASS |
| Segundo runner | migrations executadas = 0 | PASS |
| Pending apos apply | 0 | PASS |
| Old release smoke | users/questions/settings/migrations | PASS |
| Rollback vazio | removeu somente as cinco tabelas | PASS |
| Fingerprint pos-rollback | igual ao pre-schema | PASS |
| Teardown | nenhum mysqld residual | PASS |

`MYSQL84_MIGRATION_APPLY=PASS`; `SCHEMA_INTEGRITY=PASS`;
`OLD_RELEASE_POST_MIGRATION_COMPATIBILITY=PASS`;
`RECOVERY_REHEARSAL=PASS`.

## Recovery

`BACKUP_REQUIRED=SIM`. Antes da futura aplicacao controlada deve existir backup
de schema/metadata de migrations e o backup operacional normal validado.

`ROLL_FORWARD_PREFERRED=SIM`, pois a migration e aditiva e o release antigo
permanece compativel. O rollback SQL foi validado com tabelas vazias e e seguro
antes da ativacao/ingestao. Depois que houver dados de ingestao, descartar as
cinco tabelas exige autorizacao explicita e nao deve ser a resposta automatica.

## Pipeline MySQL integration

Fixtures usadas: entidades e taxonomias exclusivamente sintéticas. Uma tabela
canonica test-only e um trigger test-only existiram apenas no banco descartavel.

| Capacidade | Resultado |
|---|---|
| Create canonico | PASS |
| Replay identico | `NO_CHANGE`, zero duplicata |
| Source version update | `UPDATE` apenas em campos permitidos |
| Concorrencia | uma canonical row |
| Same-source dedupe | PASS |
| Cross-source exact | provenance preservada, sem merge destrutivo |
| Ambiguous duplicate | `REVIEW_REQUIRED` |
| Provenance | 100% |
| Taxonomy exact/alias | PASS |
| Taxonomy unknown/ambiguous | sem criacao/merge silencioso |
| Field ownership | campo editorial preservado |
| Source-owned update | PASS |
| Item atomicity | zero persistencia canonica parcial |
| Batch partial recovery | PASS |
| Transient retry | conclui dentro da policy |
| Permanent failure | sem retry infinito |
| Max attempts/review | PASS |
| Crash/resume | zero duplicata e zero item confirmado perdido |
| Stale lease recovery | PASS |
| Source disappearance | sem hard delete automatico |
| Dry-run | zero canonical content writes |

`CANONICAL_INGESTION_CORE=PASS`; `IDEMPOTENT_REPLAY=PASS`;
`CONCURRENT_IDEMPOTENCY=PASS`; `TRANSACTION_BOUNDARIES=PASS`;
`CRASH_RESUME=PASS`; `PARTIAL_BATCH_RECOVERY=PASS`.

## Authorities and contracts

| Authority | Implementacao | Cardinalidade |
|---|---|---:|
| Orchestration | `IngestionOrchestrator` + `IngestionBatchRunner` | 1 |
| Idempotency/persistence metadata | `IngestionPersistencePort` | 1 |
| Canonical mutation boundary | `CanonicalEntityPersistencePort` | 1 |
| Taxonomy resolution | `TaxonomyResolver` | 1 |
| Provenance | persistence port/repository | 1 |
| Writer allowlist | `IngestionWriterRegistry` | 1 |
| Dataset revision | authority 11C existente | 1 |
| SEO/readiness | contratos existentes, nao duplicados | 1 |

Adapters somente produzem `CanonicalIngestionItem`; nao recebem PDO nem acesso
direto ao modelo canonico. `SOURCE_ADAPTER_DIRECT_CANONICAL_DB_WRITES=0`.

## Security and observability

Payload oversized, HTML perigoso, MIME/assinatura divergente, asset oversized,
`file:`, `javascript:`, localhost, loopback/private/reserved IP e redirect para
destino privado foram rejeitados. Logs e provenance nao carregaram secret nem
PII desnecessaria.

Cada run possui source, inicio/fim, status e checkpoint. Cada item possui
correlation, outcome, attempt e error class. Contadores cobrem received,
created, updated, no_change, duplicate, rejected, review_required, retry e
failed. Writer negativo falha fechado.

`INGESTION_SECURITY_GATE=PASS`; `UNSAFE_ASSET_FETCH=0`;
`UNATTRIBUTED_INGESTION_WRITES=0`; `UNKNOWN_INGESTION_WRITERS=0`.

## Sitemap revision

Mutation canonica efetiva incrementou a authority 11C de revision. Replay
`NO_CHANGE` manteve a revision. Nao foi criada segunda authority.

`SITEMAP_REVISION_INTEGRATION=PASS`;
`SITEMAP_REVISION_AUTHORITIES=1`; `NO_CHANGE_REVISION_CHURN=0`.

## Performance

| Store / itens | Duracao | Throughput | DB questions | Peak memory |
|---|---:|---:|---:|---:|
| MySQL / 100 | 1822.66 ms | 54.86/s | 1005 | 2 MiB |
| MySQL / 1,000 | 19031.38 ms | 52.54/s | 10005 | 4 MiB |
| In-memory / 100 | 7.30 ms | 13703.86/s | n/a | medido no processo |
| In-memory / 1,000 | 85.96 ms | 11633.84/s | n/a | 4 MiB aprox. |
| In-memory / 10,000 | 1056.82 ms | 9462.34/s | n/a | 50 MiB aprox. |

O comportamento foi aproximadamente linear. O teste MySQL observou custo
constante por item, sem query explosion ou crescimento superlinear factual.
`INGESTION_PERFORMANCE_READINESS=PASS`.

## Full regression

| Gate | Resultado |
|---|---|
| Ingestion unit | PASS |
| Ingestion MySQL 8.4 integration | PASS |
| Statistics read side-effect | PASS |
| Runtime attribution | PASS |
| Sitemap revision/readiness | PASS |
| PHP focused | PASS, 8 scripts |
| PHP lint candidate | PASS, 29 arquivos |
| Vitest | 152 suites / 898 tests PASS; 2 suites baseline CJS/ESM |
| New Vitest regressions | 0 |
| Typecheck + route types | PASS |
| Build | PASS, 52/52 static pages |
| ESLint `src scripts` | 0 errors, 93 warnings preexistentes |
| Launch validator | PASS, 55 families / 40 TARGET_INDEX |
| Secret scan | PASS |
| Encoding | PASS |
| Source-size | PASS, divida historica inalterada |
| Candidate release package | PASS, 2348 arquivos / 21.99 MiB com este relatorio |
| Git diff/check + untracked whitespace scan | PASS |

O primeiro `check:release-package` na raiz foi corretamente rejeitado por
artefatos de desenvolvimento e manifesto do release implantado. O gate
autoritativo foi repetido em pacote descartavel criado pela rotina oficial,
com archives historicos excluidos, candidate 11D copiado e manifesto isolado
regenerado. Esse pacote limpo passou. Nenhum manifesto versionado foi alterado.

As suites `phase8FinalGateReporter.test.mjs` e
`semantic-page-snapshot.test.mjs` mantiveram a mesma falha preexistente
`ERR_REQUIRE_ESM` em `@csstools/css-calc`; nenhum teste chegou a falhar dentro
dessas suites. `NEW_VITEST_REGRESSIONS=0`.

## Production read-only postcheck

Captura em 2026-08-28, sem DDL/DML:

| Controle | Resultado |
|---|---|
| Deployed SHA | `a357501ec74803bd254124995103b87cf5a24cad` |
| Home / health / readiness | 200 / 200 / 200 |
| Effective launch mode | `PRELAUNCH` |
| Pending migrations conhecidas pelo release implantado | 0 |
| Strict tables / positive / rows | 109 / 0 / 0 |
| Stripe test repopulation delta | 0 |
| Reconciliation authorities | 1 |
| Analytics rows | 0 |
| Public sitemap | HTTP 503, private/no-store, noindex/nofollow |
| Stale sitemap URLs served | 0 |
| Migration 11D aplicada | NAO |
| Production DB writes nesta etapa | 0 |

A migration 11D e untracked e portanto ainda nao integra o inventario do
release implantado; o `pending=0` acima significa zero migrations pendentes do
release atual, nao autorizacao nem aplicacao da migration 11D.

## Risk and authorization

`P0=0`; `P1=0`.

`RECAPTCHA_SECURITY_GATE=DEFERRED_TO_PHASE_12_MANUAL_GATE`.
Isso nao bloqueia 11D, mas continua bloqueando Production GO.

```text
SAFE_TO_COMMIT_11D = SIM
SAFE_TO_PUSH_11D = SIM
SAFE_TO_APPLY_11D_MIGRATION_IN_CONTROLLED_ROLLOUT = SIM
SAFE_TO_ROLLOUT_11D = SIM
SAFE_TO_START_11E_AFTER_SUCCESSFUL_11D_ROLLOUT = SIM
```

Esses vereditos nao executam nem autorizam automaticamente qualquer acao.

## Estado final

```text
COMMIT = NAO
PUSH = NAO
DEPLOY = NAO
PRODUCTION_MIGRATION_APPLIED = NAO
PRODUCTION_DB_WRITES = 0
START_11E = NAO
PRODUCTION_GO = NAO
REAL_DATA_LOADED = NAO
REAL_DATA_INSERTION_AUTHORIZED = NAO
```

`MACROSTEP_11D_FINAL_ROLLOUT_READINESS_READY`
