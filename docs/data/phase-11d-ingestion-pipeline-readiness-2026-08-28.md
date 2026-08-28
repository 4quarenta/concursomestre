# Macroetapa 11D - Ingestion Pipeline Readiness

Data: 2026-08-28 13:30 UTC
Branch: `1.0.0`
Deployed SHA: `a357501ec74803bd254124995103b87cf5a24cad`
Launch mode efetivo: `PRELAUNCH`

## Resumo executivo

Foi adicionada uma fundacao compartilhada de ingestao para uso futuro, sem
importar, crawler, seed, backfill ou carga de dados reais. O adapter entrega um
`CanonicalIngestionItem`; somente o orquestrador valida, normaliza, resolve
identidade, planeja a operacao e delega a persistencia a um port. O dry-run e o
default do harness.

A migration local e aditiva e armazena somente o control plane de ingestao:
runs, itens, provenance, eventos e leases. Ela nao cria tabelas de dominio, nao
faz backfill e nao foi aplicada na producao.

## Preflight 11C read-only

| Invariante | Resultado |
|---|---|
| deployed SHA | `a357501ec74803bd254124995103b87cf5a24cad` |
| readiness HTTP | PASS |
| production migrations pending | `0` |
| schema checksum drift | `0` |
| strict positive tables | `0` |
| analytics lifecycle rows | `0` |
| effective launch mode | `PRELAUNCH` |
| public sitemap | HTTP `503`, private/no-store/noindex |
| stale sitemap URLs | `0` |
| production writes in 11D | `0` |

## Current ingestion writer matrix

| Source/path | Entry point | Current sink | Classification | 11D status |
|---|---|---|---|---|
| Gran browser/admin | `AdminGranCrawlerService` and admin routes | private ingestion queue and question services | known, operator-controlled | inventoried; no remote fetch |
| Gran taxonomy sync | `AdminGranTaxonomySyncService` | filters/source identity tables | known administrative writer | inventoried; remains private |
| question import API | bulk, multi-batch, exam import | question/exam repositories | known private writer | protected by existing queue/auth |
| legal commentary | Planalto admin/cron services | laws/articles tables | known administrative writer | no external fetch |
| materials | admin create/update/import paths | materials tables | known administrative writer | no external fetch |
| manual admin edits | domain admin APIs | domain repositories | known authenticated writer | unchanged |
| runtime events | platform/event workers | operational tables | known runtime writer | outside content core |

`UNKNOWN_INGESTION_WRITERS=0` in the inventoried source tree. The existing
administrative services are sinks/orchestrators of legacy private flows, not
the new source adapter; the new adapter contract has no PDO or SQL dependency.
No external source was called during this step.

## Ingestion authority matrix

| Responsibility | Single authority |
|---|---|
| orchestration | `IngestionOrchestrator` |
| source boundary | `SourceAdapter` |
| payload contract | `IngestionContractRegistry` |
| lifecycle | `IngestionStateMachine` |
| identity/idempotency | `CanonicalIngestionItem` |
| dedup plan | `IngestionOrchestrator` plus persistence port |
| taxonomy resolution | `TaxonomyResolver` |
| field ownership | `FieldOwnershipPolicy` |
| provenance | `IngestionPersistencePort` |
| retry | `IngestionRetryPolicy` and `IngestionRetryExecutor` |
| run/cursor | `IngestionRunTracker` and `IngestionBatchRunner` |
| sitemap consequence | existing `StaticSitemapDatasetRevision` authority, not the adapter |
| runtime attribution | existing `RequestContext` plus ingestion event context |

`SOURCE_ADAPTER_DIRECT_CANONICAL_DB_WRITES=0` for the candidate adapters.
Adapters return canonical inputs only. Existing private legacy paths remain
inventoried and are not activated by this candidate.

## Domain contracts

The registry contains separate contract identities for the existing domains:
question, exam, contest, news, material, law and taxonomy. Each item carries a
contract-compatible domain, source provider, source entity type/id, source
version and event id. Raw payloads are not written to the control-plane
tables.

`contractVersion` is available on adapters and on persisted runs. Unknown
domains are rejected; unknown taxonomy references are `REVIEW_REQUIRED` unless
an exact or explicit alias resolution is supplied.

## State machine

The lifecycle is:

`RECEIVED -> VALIDATED -> NORMALIZED -> RESOLVED -> PLANNED -> PERSISTED -> POST_PROCESSED -> COMPLETED`

Failure states are `REJECTED`, `RETRYABLE_FAILED`, `PERMANENT_FAILED` and
`REVIEW_REQUIRED`. There is no boolean `imported` authority. Run cursors record
the last attempted and committed position, allowing deterministic resume.

## Dry-run and plan

`processBatch(..., dryRun=true)` is the default. It performs contract checks,
content/asset security, identity, taxonomy resolution and dedup planning but
does not persist canonical state. Plans are `CREATE`, `UPDATE`, `NO_CHANGE`,
`DUPLICATE`, `REJECT` or `REVIEW_REQUIRED`.

## Identity, idempotency and deduplication

The stable source identity is `(domain, sourceProvider, sourceEntityType,
sourceEntityId)`. The idempotency key also includes source version, event id and
normalized payload hash. Exact replays produce `NO_CHANGE`; cross-source exact
domain duplicates produce `DUPLICATE`; ambiguous cross-source matches produce
`REVIEW_REQUIRED`. The PDO schema has unique idempotency and source/version
constraints; the disposable store exercises the same contract.

## Provenance and field ownership

Every persisted fixture has source, source entity, version, run and canonical
identity. Metadata sanitization drops secrets, credentials, payloads and
credential-bearing references. Field ownership is explicit:
`SOURCE_OWNED`, `EDITORIAL_OWNED`, `DERIVED` and `SYSTEM_OWNED`. Editorial and
system-owned fields are preserved during source updates.

## Taxonomy resolution matrix

| Input | Decision |
|---|---|
| canonical id | `EXACT_MATCH` |
| explicit alias | `ALIAS_MATCH` |
| authorized creation | supported as an explicit policy value only |
| unknown | `REVIEW_REQUIRED` |
| invalid/rejected | `REJECT` |

No silent taxonomy creation, name-only merge or uncontrolled canonical insert
is available in the new core.

## Update and deprecation semantics

Source disappearance maps to `STALE_SOURCE` by default. `REMOVED_BY_SOURCE`
requires an explicit removal policy. Hard delete is not the default. No-change
replays do not apply canonical writes or bump derived state.

## Transaction, retry and resume matrix

| Scenario | Expected result | Fixture result |
|---|---|---|
| valid create | one canonical record plus provenance | PASS |
| identical replay | `NO_CHANGE`, zero duplicate canonical rows | PASS |
| new source version | `UPDATE`, identity preserved | PASS |
| concurrent source run | lease rejects overlap | PASS |
| transient failure | bounded retry then completion | PASS |
| validation failure | one attempt, `REJECTED` | PASS |
| crash after partial batch | committed prefix preserved, resume remainder | PASS |
| ambiguous duplicate | `REVIEW_REQUIRED` | PASS |
| unknown taxonomy | review, no silent insert | PASS |

The PDO port wraps control-plane item/provenance/event persistence in an item
transaction. Large batches are processed per item and controlled by a source
lease; they are not one unbounded transaction.

## Asset and content security

Only HTTPS assets are accepted. Local, private and reserved IP hosts, localhost
names, credentials in URLs, unsafe MIME types, oversized files and missing
checksums are rejected. Imported strings are rejected when they contain script,
event-handler or javascript URL payloads. Logs and events exclude content,
payloads, secrets and credentials.

## Observability and lineage

Each run has a stable run id, provider, contract version, cursor/checkpoint and
status. Each item is correlated by source identity, version, run, outcome and
canonical id. The metric vocabulary covers received, validated, created,
updated, no-change, duplicate, rejected, review, retry, failed, asset failures,
duration and lag. Structured events use sanitized context only.

## Sitemap integration

The ingestion core does not edit sitemap files. Future canonical mutations must
use the existing database-backed dataset revision authority and then let
`PublicationDecision`, `SeoDecision`, readiness and the materializer derive
the sitemap consequence. This candidate introduces no second revision
authority and does not publish a sitemap.

## Migration / schema change matrix

| Migration | Local candidate | Production |
|---|---|---|
| `20260828_140000_ingestion_pipeline_foundation.php` | created, additive | not applied |

Tables are `ingestion_runs`, `ingestion_items`, `ingestion_provenance`,
`ingestion_item_events` and `ingestion_leases`. No domain table is altered, no
canonical content is backfilled, and no destructive DDL is present. Rollback
drops only these five new tables. A staging MySQL 8.4 rehearsal is still
required before production authorization.

## Synthetic tests and gates

| Gate | Result |
|---|---|
| PHP syntax for new module/migration | PASS, PHP 8.3.6 |
| ingestion synthetic integration | PASS |
| dry-run no canonical write | PASS |
| idempotent replay | PASS |
| cross-source dedup | PASS |
| retry/dead-letter classification | PASS |
| lease/concurrency guard | PASS |
| crash/partial resume | PASS |
| taxonomy unknown policy | PASS |
| asset/content security | PASS |
| secret scan | PASS |
| text encoding | PASS |
| generated artifacts | PASS |
| launch-control validator | PASS |
| source-size gate | PASS; known historical debt unchanged |
| production read-only preflight | PASS |
| frontend typecheck | PASS; Next route types and `tsc --noEmit` |
| production build | PASS; 52 static pages generated |
| focused ESLint (`src`, `scripts`) | PASS; 0 errors, 93 existing warnings |
| full Vitest | 152 suites passed, 898 tests passed; 2 pre-existing CJS/ESM suites failed |

The two failing Vitest suites are the pre-existing CJS/ESM incompatibility in
`phase8FinalGateReporter.test.mjs` and `semantic-page-snapshot.test.mjs`;
their error is the CommonJS require of the ESM `@csstools/css-calc` package.
No ingestion test failed. The repository-wide lint command also traverses
historical generated `.tmp` build backups; the focused source lint completed
with zero errors and only existing warnings.

## Required matrices

The following matrices are represented by the contracts, ports, runner,
security policy and this report: `CURRENT_INGESTION_WRITER_MATRIX`,
`INGESTION_AUTHORITY_MATRIX`, `DOMAIN_CONTRACT_MATRIX`,
`INGESTION_STATE_MACHINE_MATRIX`, `IDEMPOTENCY_MATRIX`, `CONCURRENCY_MATRIX`,
`DEDUPLICATION_MATRIX`, `PROVENANCE_MATRIX`, `TAXONOMY_RESOLUTION_MATRIX`,
`FIELD_OWNERSHIP_MATRIX`, `UPDATE_SEMANTICS_MATRIX`, `DEPRECATION_MATRIX`,
`TRANSACTION_MATRIX`, `CHECKPOINT_RESUME_MATRIX`, `RETRY_MATRIX`,
`DEAD_LETTER_MATRIX`, `ASSET_PIPELINE_MATRIX`, `INGESTION_SECURITY_MATRIX`,
`OBSERVABILITY_MATRIX`, `INGESTION_WRITER_ATTRIBUTION_MATRIX`,
`SITEMAP_REVISION_INTEGRATION_MATRIX`, `SYNTHETIC_TEST_MATRIX`,
`PERFORMANCE_MATRIX`, `SCHEMA_CHANGE_MATRIX`, `PRODUCTION_READONLY_MATRIX`,
`FINAL_RISK_MATRIX`.

## Risk classification

`P0=0`. `P1=0` introduced by this candidate. Remaining risks are operational
and intentionally outside this non-production step: production migration
rehearsal, final integration of each legacy adapter behind the shared core,
real-source contract review, production-scale benchmark and 11E synthetic
ingestion validation.

## Final output

```text
DEPLOYED_SHA=a357501ec74803bd254124995103b87cf5a24cad
FILES_CHANGED=27 new candidate files plus this report
NEW_MIGRATIONS=1 local, 0 applied production
NEW_DEPENDENCIES=0
OUT_OF_SCOPE=0
CANONICAL_INGESTION_CORE=PASS
SOURCE_ADAPTER_CONTRACT=PASS
SOURCE_ADAPTER_DIRECT_CANONICAL_DB_WRITES=0
DRY_RUN_MODE=PASS
IDEMPOTENT_REPLAY=PASS
CONCURRENT_IDEMPOTENCY=PASS
DUPLICATE_POLICY=PASS
AMBIGUOUS_DUPLICATE_POLICY=REVIEW_REQUIRED
PROVENANCE_COVERAGE=100% fixtures
TAXONOMY_RESOLUTION=PASS
UNCONTROLLED_TAXONOMY_CREATION=0
FIELD_OWNERSHIP_POLICY=PASS
UPDATE_SEMANTICS=PASS
DEPRECATION_SEMANTICS=PASS
HARD_DELETE_DEFAULT=DENY
TRANSACTION_BOUNDARIES=PASS
CRASH_RESUME=PASS
PARTIAL_BATCH_RECOVERY=PASS
RETRY_POLICY=PASS
DEAD_LETTER_OR_REVIEW_FLOW=PASS
ASSET_PIPELINE=PASS
INGESTION_SECURITY_GATE=PASS
RUNTIME_ATTRIBUTION_INTEGRATION=PASS
UNATTRIBUTED_INGESTION_WRITES=0 candidate paths
UNKNOWN_INGESTION_WRITERS=0 inventoried
OBSERVABILITY=PASS
SITEMAP_REVISION_INTEGRATION=PASS
SYNTHETIC_TESTS=PASS
PERFORMANCE_TESTS=PASS bounded fixture path
TYPECHECK=PASS
BUILD=PASS
ESLINT_FOCUSED=PASS, 0 errors, 93 existing warnings
VITEST=152 suites passed, 898 tests passed, 2 pre-existing CJS/ESM suites failed
NEW_VITEST_REGRESSIONS=0 observed
PRODUCTION_DB_WRITES=0
RECAPTCHA_SECURITY_GATE=DEFERRED_TO_PHASE_12_MANUAL_GATE
P0=0
P1=0
SAFE_TO_COMMIT_11D=SIM
SAFE_TO_PROCEED_TO_11E_AFTER_11D_ROLLOUT=NAO, rollout ainda nao executado
PRODUCTION_GO=NAO
REAL_DATA_LOADED=NAO
REAL_DATA_INSERTION_AUTHORIZED=NAO
```

## Decision

`MACROSTEP_11D_INGESTION_PIPELINE_READINESS_READY`

Nesta execucao: `COMMIT=NAO`, `PUSH=NAO`, `DEPLOY=NAO`,
`PRODUCTION_MIGRATION=NAO`. O proximo passo permitido e a auditoria final da
11D, seguida de rehearsal MySQL 8.4 e autorizacao operacional separada. A 11E
nao foi iniciada.
