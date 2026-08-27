# Macroetapa 11B-POST-R2 - Sitemap Architecture Hardening

## Contexto

Remediacao executada em 2026-08-26 na branch `1.0.0`, baseline
`fbb34f83f94bbda0792bd861c20d137916566a58`, para fechar exclusivamente os
cinco P1 de sitemap encontrados pela auditoria independente pos-reset.

O banco de producao foi consultado somente pela credencial `Database('read')`.
Nao houve insercao de dados, DML de producao, migration, carga real, commit,
push ou deploy da aplicacao.

## Resumo executivo

Classificacao: **APROVADA COM RESSALVAS P2 PARA AUDITORIA INDEPENDENTE**.

Os cinco P1 foram fechados:

1. a quarentena stale saiu de toda arvore servida e `/storage/` passou a
   falhar fechado;
2. promotion publica exige validacao HTTP/semantica, sem opt-out silencioso;
3. o fingerprint logico v2 nasce do conjunto elegivel corrente do banco e o
   fingerprint fisico continua derivado dos bytes dos XMLs;
4. a decisao final candidate -> eligible usa `PublicSeoEnvelopeService` e
   `SeoPolicyService`, autoridade compartilhada do backend;
5. uma suite MySQL 8.4 descartavel provou zero/add/remove/noindex/redirect/
   404/410/bulk reset/direct mutation/corrupcao/partial/atomic/PRELAUNCH.

O estado operacional segue `PRELAUNCH`. O codigo corrigido permanece apenas no
worktree, como exigido; a contencao Nginx e a quarentena privada ja estao ativas
na producao. O proximo passo e a auditoria independente 11B-POST-R2-AUDIT, nao
a carga do dataset real.

## Evidencia final do banco

Captura read-only final: `2026-08-26T14:31:02Z`.

| Controle | Resultado |
| --- | ---: |
| Engine | MySQL 8.4.10-10 |
| Grants read-only | PASS |
| RESETTABLE vazias | 113/113 |
| RESETTABLE total rows | 0 |
| `analytics_lifecycle_events` | 0 |
| Policy missing/unknown/overlap | 0/0/0 |
| Structural fingerprint | `7e9904fc21bfa27ec5fe108f5ba6c0e594bf677fed9a509425beb77043656741` |

Contagens PRESERVE finais: `addresses=2`, `admin_audit_logs=1926`,
`bank_accounts=0`, `cache_settings=0`, `filter_types=10`, `plans=14`,
`schema_audit_runs=0`, `schema_backfill_runs=1`, `schema_migrations=62`,
`security_ip_bans=0`, `system_settings=99`, `users=6`. Os digests coincidiram
com as duas capturas anteriores desta remediacao.

## PUBLIC_STALE_ARTIFACT_MATRIX

| Caminho | Antes | Depois | Status |
| --- | ---: | ---: | --- |
| `/sitemap.xml` | 503 | 503 | PASS fail-closed |
| `/sitemap-index.xml` | 503 | 503 | PASS fail-closed |
| `/sitemaps/questions-00001.xml` | 503 | 503 | PASS fail-closed |
| `/storage/...stale.../sitemap.xml` | 200 | 404 | PASS |
| `/storage/...stale.../questions-00001.xml` | 200 | 404 | PASS |
| `/storage/.sitemaps-publication-state.json` | exposto pelo alias generico | 404 | PASS |
| `/storage/logs/settings.log` | exposto pelo alias generico | 404 | PASS |
| `/storage/random.xml` | exposto pelo alias generico | 404 | PASS |

`public stale shards = 0`; `stale sitemap URLs accessible = 0`.

## QUARANTINE_SECURITY_MATRIX

| Controle | Evidencia | Status |
| --- | --- | --- |
| Public source | ausente | PASS |
| Private destination | `/root/concursomestre-ops/private-sitemap-quarantine/phase11b-sitemap-remediation-20260826-031017` | PASS |
| Private root mode | `0700` | PASS |
| Private release mode | `2700` | PASS |
| Hashes before/after move | identicos | PASS |
| Web serving | nenhum path publico | PASS |
| Promotion source | quarentena nao participa | PASS |

Contrato formal: `SITEMAP_QUARANTINE_PUBLIC = NEVER`.

## NGINX_STORAGE_MATRIX

| Controle | Resultado | Status |
| --- | --- | --- |
| `nginx -t` antes/depois | syntax ok | PASS |
| `/storage/` | 404 + no-store + noindex | PASS |
| Alias generico de `backend/storage` | removido | PASS |
| `/uploads/` | alias independente preservado | PASS |
| Asset legitimo amostrado em `/uploads/` | HTTP 200 | PASS |
| Config versionada | proxy para app; sem serving direto de sitemap | PASS |

## SITEMAP_PROMOTION_VALIDATION_MATRIX

| Caso | Resultado | Status |
| --- | --- | --- |
| Promotion publica sem origem HTTP | exception antes da promotion | PASS |
| Opt-out `SITEMAP_VALIDATE_HTTP` | removido | PASS |
| HTTP 200 | obrigatorio | PASS |
| Redirect | rejeitado | PASS |
| 404/410 | rejeitado | PASS |
| Meta/header noindex | rejeitado | PASS |
| Canonical divergente/ausente | rejeitado | PASS |
| Falha de validacao | DIRTY + withdraw; sem promotion | PASS |

`SITEMAP_PROMOTION_VALIDATION_GATE = PASS`.

## AUTHORITATIVE_SEO_DECISION_MATRIX

| Etapa | Autoridade | Status |
| --- | --- | --- |
| PublicationDecision | `ContentPublicationPolicy` via `PublicSeoEnvelopeService` | PASS |
| SeoFacts | `SeoFactsAssembler` | PASS |
| FamilyEligibility/target/sitemap | `SeoProductionPageMap` via `SeoPolicyService` | PASS |
| InstanceReadiness | sinais estruturais fornecidos ao contrato v1 | PASS |
| Canonical/resolution | `SeoPolicyService` + `StructuralRoutePolicy` | PASS |
| INDEX/NOINDEX | `SeoPolicyService` | PASS |
| Sitemap eligible | `SeoDecision.sitemap.eligible` | PASS |

`SITEMAP_AUTHORITATIVE_SEO_DECISION_GATE = PASS`.

## CANDIDATE_ELIGIBILITY_MATRIX

| Camada | Responsabilidade | Regra |
| --- | --- | --- |
| SQL candidate query | keyset/batch e sinais publicos necessarios | nao emite URL |
| Backend projection | normaliza identidade, publicacao e readiness | nao decide sitemap isoladamente |
| Shared SEO authority | produz `SeoDecision` final | unica passagem eligible |
| Logical dataset | recebe apenas INDEX + render 200 + canonical valido | fail-closed |
| XML materializer | serializa records aprovados | output, nunca truth |

Os predicados SQL remanescentes sao pre-selecao tipada/hierarquica e sinais de
entrada. Nenhum candidato entra no dataset logico sem a decisao compartilhada.

## LOGICAL_FINGERPRINT_V2_MATRIX

| Propriedade | Implementacao | Status |
| --- | --- | --- |
| Fonte | conjunto corrente elegivel derivado do DB | PASS |
| Versao | `eligible-sitemap-dataset.v2` | PASS |
| Ordenacao | family + identity, deterministica | PASS |
| Campos | family, identity, canonicalUrl, lastModified, policyVersion | PASS |
| Timestamp arbitrario de geracao | ausente | PASS |
| XML como fonte logica | removido | PASS |
| Canonical host/query/fragment | validado fail-closed | PASS |

## PHYSICAL_FINGERPRINT_MATRIX

| Caso | Resultado | Status |
| --- | --- | --- |
| Hash por XML | SHA-256 | PASS |
| Hash agregado | bytes/nomes dos XMLs | PASS |
| Separado do fingerprint logico | sim | PASS |
| Byte alterado apos promotion | read negado | PASS |
| State/status divergente | read negado | PASS |

## DATABASE_FRESHNESS_MATRIX

| Estado | Resultado | Status |
| --- | --- | --- |
| DB fingerprint = status = state | pode servir quando launch permite | PASS |
| DB fingerprint mudou | read negado | PASS |
| State DIRTY | read negado | PASS |
| State ausente/corrompido | read negado | PASS |
| Recalculo falha/timeout | read negado | PASS |
| Hash fisico diverge | read negado | PASS |

`SITEMAP_DATABASE_FRESHNESS_GATE = PASS`.

## DIRECT_MUTATION_MATRIX

| Caso descartavel | `markDirty()` chamado | Resultado |
| --- | ---: | --- |
| Publicar fixture | nao | fingerprint muda |
| Tornar fixture unpublished | nao | artifact anterior deixa de ser CURRENT |
| Remover fixture | nao | URL desaparece e fingerprint muda |
| Bulk reset | nao | eligible set zera e stale serve e negado |

O hook DIRTY permanece defesa antecipada e otimizacao; nao e autoridade unica
de freshness.

## INVALIDATION_HOOK_MATRIX

| Writer/caso | Hook | Status |
| --- | --- | --- |
| Questions | before write | PASS |
| Exams | before write | PASS |
| Filters/taxonomias | before write | PASS |
| Professional taxonomies | before write | PASS |
| Blog | before write | PASS |
| Materials | before write | PASS |
| Legal Commentary | before write | PASS |
| Contests | before write | PASS |
| Simulations | before write | PASS |
| Gran taxonomy sync | before write | PASS |
| RESET_POLICY_V2 | post-commit invalidate + withdraw | PASS |
| Writer perdido/SQL direto | fingerprint independente | PASS |

## MYSQL_INTEGRATION_MATRIX

Suite executada em `mysqld` isolado, `--skip-networking`, datadir/socket/DB
descartaveis, engine `8.4.10-10`.

| Caso | Resultado |
| --- | --- |
| zero | PASS |
| add | PASS |
| remove | PASS |
| noindex | PASS |
| redirect | PASS |
| 404 | PASS |
| 410 | PASS |
| direct mutation | PASS |
| physical corruption | PASS |
| partial generation | PASS |
| atomic promotion | PASS |
| PRELAUNCH | PASS |
| PRODUCTION fixture | PASS |
| teardown | PASS, fixture schema = 0 tables |

`SITEMAP_MYSQL_INTEGRATION_GATE = PASS`.

## BULK_RESET_FIXTURE_MATRIX

| Etapa | Eligible URLs | Artifact CURRENT |
| --- | ---: | --- |
| Fixture preenchida/materializada | 1 | sim |
| DELETE no DB descartavel sem hook | 0 | nao |
| Rematerializacao | 0 dynamic URLs | novo set vazio valido |

Nenhuma operacao desta matriz usou a conexao MySQL de producao.

## ATOMIC_PROMOTION_MATRIX

| Caso | Evidencia | Status |
| --- | --- | --- |
| Staging separado | `.stage-*` | PASS |
| Validacao antes da promotion | obrigatoria | PASS |
| Linux | release imutavel + troca atomica de symlink | PASS |
| Partial generation | stage descartado, current preservado | PASS |
| Failed generation | DIRTY + withdraw | PASS |
| Retirada PRELAUNCH | atomica | PASS |

## PRELAUNCH_PUBLICATION_MATRIX

| Superficie | Resultado | Status |
| --- | --- | --- |
| Launch efetivo | PRELAUNCH | PASS |
| `/sitemap.xml` | 503 | PASS |
| `/sitemap-index.xml` | 503 | PASS |
| `/sitemaps/*` | 503 | PASS |
| `/storage/*` | 404 | PASS |
| Production fixture isolada | publication permitida apenas no teste | PASS |
| Production real | nao ativada | PASS |

## TIMER_MATRIX

| Service/timer | Enabled | Active/result | Public artifact |
| --- | ---: | --- | --- |
| `concursomestre-sitemap.timer/service` | sim | active/success, exit 0 | ausente |
| `concursomestre-blog-sitemap.timer/service` | sim | active/success, exit 0 | ausente |

Os timers nao republicaram a quarentena nem recriaram o diretorio publico.

## ZERO_STATE_MATRIX

| Controle | Resultado | Status |
| --- | ---: | --- |
| RESETTABLE vazias | 113/113 | PASS |
| RESETTABLE total rows | 0 | PASS |
| analytics lifecycle | 0 | PASS |
| automatic repopulation | 0 | PASS |
| real dataset loaded | nao | PASS |

## PRESERVE_INTEGRITY_MATRIX

| Controle | Resultado | Status |
| --- | --- | --- |
| 12 tabelas PRESERVE | contagens esperadas | PASS |
| Digests em tres capturas | identicos | PASS |
| users | 6 | PASS |
| system_settings | 99 | PASS |
| schema_migrations | 62 | PASS |

## UNAUTHORIZED_WRITE_MATRIX

| Operacao de producao nesta remediacao | Quantidade |
| --- | ---: |
| INSERT/seed/import/crawler/backfill | 0 |
| UPDATE/DELETE de conteudo | 0 |
| Migration/DDL | 0 |
| Reset adicional | 0 |
| Real dataset load | 0 |

As unicas operacoes de producao desta R2 foram filesystem/Nginx autorizados e
consultas SQL read-only.

## TEST_MATRIX

| Gate | Resultado |
| --- | --- |
| PHP lint | 60 arquivos PASS |
| PHP focused | 20 gates PASS; contrato rerun PASS |
| MySQL 8.4 integration | PASS, 14 casos + teardown |
| Vitest completo Node 24 | 154/154 files, 912/912 tests PASS |
| Typecheck + route types | PASS |
| Clean Next build | PASS, 52 paginas |
| ESLint afetado `--no-cache` | PASS |
| Launch validator | PASS, 55 familias/19 fixtures |
| Secret scan | PASS |
| Encoding | PASS |
| Generated artifacts check | PASS |
| `git diff --check` | PASS, somente warnings EOL |
| `nginx -t` | PASS |

O primeiro Vitest sob Node 20 encontrou incompatibilidade ESM ambiental em
dois suites antes da coleta e uma assercao historica obsoleta de route builder.
A assercao foi alinhada ao `SeoDecision` autoritativo; a suite completa passou
sob o runtime Node 24 do Codex.

## FINAL_RISK_MATRIX

| ID | Nivel | Estado | Acao futura |
| --- | --- | --- | --- |
| P1-01 public quarantine bypass | P1 | CLOSED | manter `/storage/` fail-closed |
| P1-02 optional HTTP validation | P1 | CLOSED | nenhuma promotion sem origin |
| P1-03 XML-derived logical hash | P1 | CLOSED | manter v2 logical dataset |
| P1-04 duplicated final SEO policy | P1 | CLOSED | final eligibility somente shared authority |
| P1-05 missing MySQL E2E | P1 | CLOSED | manter gate isolado no CI/release |
| P2-01 503 vs 404/410 official semantics | P2 | OPEN | decidir antes do Production GO |
| P2-02 request-time full DB fingerprint | P2 | OPEN | adicionar cache/version counter sem perder fail-closed |
| P2-03 full HTTP candidate validation cost | P2 | OPEN | planejar lotes/amostragem equivalente antes de escala real |
| P2-04 candidate signal duplication | P2 | OPEN | mover mais sinais para projections/readiness compartilhados |
| P2-05 application code not deployed | P2 operational | EXPECTED | auditoria independente, commit e rollout controlado |

`P0 = 0`.

`P1 = 0`.

## Diff e estado do worktree

O diff continua acumulado desde a baseline 11A/11B porque esta macroetapa nao
autoriza commit. Ele inclui reset policy/tooling, writer freeze, analytics
zero-state, sitemap database-driven/invalidation/fingerprints/publisher,
writers canonicos, Nginx versionado, leitura Next, testes e documentacao.
Nenhuma dependencia, lockfile ou migration foi adicionada nesta R2.

Um cache `.next` anterior foi movido para `.tmp/build-cache-backups/` e continua
ignorado. Pacotes/scripts temporarios do gate MySQL foram removidos do VPS; o
JSON machine-readable permanece somente sob `.tmp/data/`.

## Declaracoes finais

- `RESET_POLICY_V2 = EXECUTED_AND_STABLE`.
- `113 resettable tables empty = SIM`.
- `RESETTABLE_TOTAL_ROWS = 0`.
- `automatic repopulation = 0`.
- `analytics_lifecycle_events = 0`.
- `public stale sitemap = NAO`.
- `public stale shards = 0`.
- `public alternate stale paths = 0`.
- `stale sitemap URLs accessible = 0`.
- `sitemap source of truth = DATABASE`.
- `sitemap authoritative SEO decision = SHARED_BACKEND_AUTHORITY`.
- `sitemap logical fingerprint = CURRENT_ELIGIBLE_DATASET_DERIVED`.
- `sitemap physical fingerprint = ARTIFACT_BYTES_DERIVED`.
- `sitemap DB freshness = FAIL_CLOSED`.
- `sitemap promotion validation = MANDATORY`.
- `sitemap MySQL integration = PASS`.
- `effective launch mode = PRELAUNCH`.
- `real dataset loaded = NAO`.
- `REAL_DATA_INSERTION_AUTHORIZED = NAO`.
- `production DB writes = 0`.
- `commit = NAO`.
- `push = NAO`.
- `deploy = NAO`.

## Recomendacao

Executar agora a auditoria independente `11B-POST-R2-AUDIT`. Nao carregar o
dataset real ate essa auditoria validar o codigo, a contencao operacional e os
P2 que forem definidos como blockers do Production GO.

`DATASET_RESET_SITEMAP_ARCHITECTURE_READY`

`TEST_DATASET_REMOVED_CONFIRMED`

`REAL_DATA_INSERTION_AUTHORIZED = NAO`
