# Macroetapa 11B-POST-R2-AUDIT

## Veredito executivo

Auditoria independente executada contra a branch `1.0.0`, baseline
`fbb34f83f94bbda0792bd861c20d137916566a58`.

O zero-state de producao permanece estavel, o sitemap stale anterior nao esta
publicamente acessivel e os timers respeitam PRELAUNCH. A validacao HTTP de
promotion, o fingerprint logico derivado do banco, a deteccao de drift sem
`markDirty()` e o ensaio MySQL 8.4 isolado passaram.

A arquitetura, contudo, nao esta pronta para checkpoint nem rollout. Foram
reproduzidos dois P1:

1. A leitura publica valida apenas o hash do arquivo solicitado. Se um shard
   diferente for corrompido depois da promotion, `sitemap.xml` continua sendo
   servido, embora o fingerprint fisico do conjunto ja nao corresponda ao
   estado publicado.
2. O materializador calcula `InstanceReadiness` com regras proprias e fornece
   esse resultado ao `PublicSeoEnvelopeService`. Como o valor controla a
   elegibilidade final, o materializador ainda e uma segunda autoridade de
   readiness, em desacordo com o contrato de autoridade unica.

Classificacao: **NAO RECOMENDADA para checkpoint ou rollout controlado**.

## Escopo e seguranca

- Auditoria read-only em producao.
- Nenhum INSERT, UPDATE, DELETE, DDL, reset, seed, import, crawler ou backfill.
- O ensaio com escrita foi limitado a MySQL 8.4 descartavel, `--skip-networking`,
  datadir e schema temporarios, com teardown confirmado.
- Nenhum secret, dado pessoal ou conteudo do dataset foi incluido neste relatorio.
- Commit, push e deploy nao executados.

## PRODUCTION_ZERO_STATE_MATRIX

| Evidencia | Resultado | Status |
| --- | ---: | --- |
| Banco | `concursomestre` | PASS |
| Engine | `8.4.10-10` | PASS |
| Tabelas | 125 | PASS |
| Foreign keys | 91 | PASS |
| RESETTABLE | 113 | PASS |
| RESETTABLE vazias | 113 | PASS |
| RESETTABLE total rows | 0 | PASS |
| PRESERVE | 12 | PASS |
| `analytics_lifecycle_events` | 0 | PASS |
| Captura repetida apos timers/probes | zero-state invariavel | PASS |
| Automatic repopulation observada | 0 | PASS |

Captura final: `2026-08-26T18:18:43+00:00`. Structural fingerprint:
`7e9904fc21bfa27ec5fe108f5ba6c0e594bf677fed9a509425beb77043656741`.

## PUBLIC_SURFACE_MATRIX

| Superficie | HTTP | Resultado |
| --- | ---: | --- |
| `/sitemap.xml` | 503 | indisponivel, `noindex,nofollow`, no-store |
| `/sitemap-index.xml` | 503 | indisponivel, `noindex,nofollow`, no-store |
| `/sitemaps/questions-00001.xml` | 503 | shards indisponiveis |
| `/storage/.sitemaps-publication-state.json` | 404 | estado privado |
| `/storage/sitemaps/sitemap.xml` | 404 | storage privado |
| `/backend/storage/sitemaps/sitemap.xml` | 404 | sem bypass alternativo |
| Arquivos sitemap/XML em `public`, `.next/static` e storage ativo | 0 | PASS |
| Amostra de `/uploads` legitimo | 200 `image/png` | PASS |

`public stale sitemap = NAO`, `public stale shards = 0`,
`public alternate stale paths = 0`, `stale URLs accessible = 0`.

## QUARANTINE_MATRIX

| Controle | Evidencia | Status |
| --- | --- | --- |
| Local | `/root/concursomestre-ops/private-sitemap-quarantine/...` | PASS |
| Fora da arvore publica | sim | PASS |
| Diretorio raiz | `0700`, root:root | PASS |
| Artefatos | `0600`, root:root | PASS |
| Hashes antes/depois | 13/13 identicos | PASS |
| Participa da promotion | nao | PASS |
| Alias/root Nginx alcança quarantine | nao encontrado | PASS |

## NGINX_MATRIX

| Regra operacional | Resultado | Status |
| --- | --- | --- |
| Sitemap oficial | 503 fail-closed em PRELAUNCH | PASS |
| `/sitemaps/` | 503 fail-closed | PASS |
| `/storage/` | 404, private/no-store/noindex | PASS |
| `/uploads/` | alias publico separado e funcional | PASS |
| PHP em uploads/storage | negado | PASS |
| Config versionada com alias direto de sitemap/storage | nao | PASS |

## PROMOTION_VALIDATION_MATRIX

| Controle | Evidencia | Status |
| --- | --- | --- |
| `SITEMAP_VALIDATION_ORIGIN` | obrigatorio para promotion publica | PASS |
| Opt-out `SITEMAP_VALIDATE_HTTP` | ausente | PASS |
| Redirect/404/410 | recusados | PASS |
| Noindex/canonical ausente ou divergente | recusados | PASS |
| HTTP diferente de 200 | recusado | PASS |
| Timeout/falha | exception, withdraw/fail-closed | PASS |
| Promotion parcial | stage descartado | PASS |

`SITEMAP_PROMOTION_VALIDATION_GATE = PASS`.

## AUTHORITATIVE_SEO_MATRIX

| Componente | Papel | Status |
| --- | --- | --- |
| `ContentPublicationPolicy` | publication | compartilhado |
| `SeoFactsAssembler` | fatos publicos | compartilhado |
| `SeoPolicyService` | decisao final | compartilhado |
| `SeoProductionPageMap` | eligibility/target | compartilhado |
| `StructuralRoutePolicy` | rota/canonical | compartilhado |
| `AuthoritativeSitemapEligibilityService` | valida INDEX/render/200/sitemap/canonical host | PASS |
| Materializador | calcula readiness por familia e injeta no envelope | **FAIL P1** |

O SQL nao emite URL final sozinho, mas o gerador define diretamente
`instanceReadiness` para questions, contests, simulations, materials e exams.
`SeoPolicyService` aceita esse valor como autoridade. Isso pode incluir ou
excluir URLs sem passar pela mesma montagem de readiness usada pelo endpoint.

`SITEMAP_AUTHORITATIVE_SEO_DECISION_GATE = FAIL`.

## LOGICAL_FINGERPRINT_V2_MATRIX

| Propriedade | Resultado | Status |
| --- | --- | --- |
| Versao | `eligible-sitemap-dataset.v2` | PASS |
| Fonte | current eligible dataset do DB | PASS |
| Ordenacao | estavel | PASS |
| Campos | family, identity, canonicalUrl, lastModified, policyVersion | PASS |
| Timestamp arbitrario de geracao | ausente | PASS |
| Derivacao de XML/state anterior | nao | PASS |

## PHYSICAL_FINGERPRINT_MATRIX

| Caso | Esperado | Observado | Status |
| --- | --- | --- | --- |
| Fingerprint na geracao | hashes dos bytes/arquivos | calculado | PASS |
| Arquivo solicitado corrompido | negar leitura | negado | PASS |
| State/status ausente ou divergente | negar leitura | negado | PASS |
| Shard B corrompido, solicitar index A | negar todo o set | index A servido | **FAIL P1** |

Reproducao independente: conjunto CURRENT com `sitemap.xml` e
`questions-00001.xml`; apos corromper somente o shard, a expectativa para
`readStaticSitemapArtifact('sitemap.xml')` era `null`, mas o retorno foi
`<sitemapindex/>`.

Causa: `readStaticSitemapStatus()` compara apenas os fingerprints armazenados;
`readStaticSitemapArtifact()` recalcula somente o hash do arquivo solicitado.
O fingerprint fisico completo do conjunto nao e recalculado antes da leitura.

## DATABASE_DRIFT_MATRIX

| Mutacao sem `markDirty()` | Fingerprint logico mudou | CURRENT negado | Status |
| --- | --- | --- | --- |
| publish | sim | sim | PASS |
| unpublish | sim | sim | PASS |
| remove | sim | sim | PASS |
| bulk reset | sim | sim | PASS |

`SITEMAP_DATABASE_FRESHNESS_GATE = PASS`.

## DIRECT_MUTATION_MATRIX

| Dependencia | Resultado |
| --- | --- |
| `markDirty()` como antecipacao | permitido |
| `markDirty()` como unica autoridade | nao |
| Deteccao independente por DB fingerprint | PASS |

## DIRTY_CURRENT_MATRIX

| Estado | Publicavel | Evidencia |
| --- | --- | --- |
| DIRTY | nao | state gate |
| CURRENT com DB drift | nao | logical mismatch |
| CURRENT com arquivo solicitado corrompido | nao | per-file hash |
| CURRENT com outro shard corrompido | **parcialmente sim** | **FAIL P1** |

## ATOMIC_PROMOTION_MATRIX

| Caso | Resultado | Status |
| --- | --- | --- |
| Stage separado | sim | PASS |
| Validacao antes da promotion | sim | PASS |
| Release imutavel | sim | PASS |
| Swap atomico | rename/symlink conforme plataforma | PASS |
| Falha parcial | active set preservado | PASS |
| Withdraw PRELAUNCH | atomico | PASS |

## MYSQL_E2E_MATRIX

Suite repetida em MySQL `8.4.10-10` isolado, sem rede.

| Caso | Status |
| --- | --- |
| zero/add/remove/noindex | PASS |
| redirect/404/410 | PASS |
| direct mutation/bulk reset | PASS |
| physical corruption test existente | PASS, mas cobertura insuficiente para corrupcao cruzada |
| partial generation/atomic promotion | PASS |
| PRELAUNCH/PRODUCTION fixture | PASS |
| teardown e fixture schema = 0 | PASS |

`SITEMAP_MYSQL_INTEGRATION_GATE = PASS` e
`ISOLATED_MYSQL84_TEARDOWN_GATE = PASS`.

## INVALIDATION_MATRIX

| Writer | Hook | Status |
| --- | --- | --- |
| Questions, Exams, Filters | before write | PASS |
| Professional taxonomies | writes convergem em Filters/Gran hooks | PASS |
| Blog | before write | PASS |
| Materials, Legal Commentary | before write | PASS |
| Contests, Simulations | nenhum writer canonico atual encontrado | N/A; hook obrigatorio ao criar CRUD/import |
| Gran taxonomy sync | before write | PASS |
| RESET_POLICY_V2 | post-commit invalidate + withdraw | PASS |
| Auth/analytics/progress/private state | sem invalidacao publica | PASS |

## PRELAUNCH_MATRIX

| Controle | Resultado | Status |
| --- | --- | --- |
| Launch efetivo | PRELAUNCH | PASS |
| Public production sitemap | disabled | PASS |
| Conteudo elegivel em fixture PRELAUNCH | 0 URLs | PASS |
| Static sitemap timer | success/no-publication | PASS |
| Blog sitemap timer | success/no-publication | PASS |
| Republish de artefato antigo | nao observado | PASS |

## TIMER_MATRIX

| Timer | Ultima execucao observada | Resultado |
| --- | --- | --- |
| `concursomestre-sitemap.timer` | 2026-08-26 14:08:58 UTC | skipped PRELAUNCH, exit 0 |
| `concursomestre-blog-sitemap.timer` | 2026-08-26 18:09:03 UTC | skipped PRELAUNCH, exit 0 |

## PRESERVE_MATRIX

| Tabela | Rows | Digest status |
| --- | ---: | --- |
| users | 6 | estavel |
| system_settings | 99 | estavel |
| schema_migrations | 62 | estavel |
| admin_audit_logs | 1926 | estavel |
| filter_types | 10 | estavel |
| plans | 14 | estavel |
| schema_backfill_runs | 1 | estavel |
| addresses | 2 | estavel |
| demais PRESERVE | 0 | estavel |

## SECURITY_MATRIX

| Gate | Resultado |
| --- | --- |
| Secret scan oficial | PASS |
| PII no relatorio | 0 |
| Backup/dump em Git | 0 |
| Quarantine privada | PASS |
| `/storage` privado | PASS |
| Production writes by audit | 0 |

## WORKTREE_MATRIX

| Item | Resultado |
| --- | --- |
| Branch | `1.0.0` |
| HEAD | `fbb34f83f94bbda0792bd861c20d137916566a58` |
| Tracked modificados | 32 |
| Untracked | tooling, testes e docs acumulados das Macroetapas 11A/11B |
| Out-of-scope identificado | 0 |
| Staging | vazio |
| Commit/push/deploy | nao |
| `git diff --check` | sem erro; apenas avisos de normalizacao EOL |

## P2_CLASSIFICATION_MATRIX

| P2 | Classificacao | Justificativa |
| --- | --- | --- |
| 503 vs 404/410 | PRE_GO_BLOCKER = NAO | PRELAUNCH esta fail-closed; decidir semantica antes do GO |
| Fingerprint DB por request | PRE_PRODUCTION_GO_BLOCKER | processo PHP e varredura O(N) por leitura nao escalam para milhoes |
| HTTP validation completa | PRE_PRODUCTION_GO_BLOCKER | precisa estrategia de lotes/cache sem reduzir correctness |
| Candidate signal duplication | promovido a P1 | readiness altera eligibility final |
| Codigo ainda nao implantado | rollout dependency | esperado nesta fase, exige rehearsal |

## TEST_MATRIX

| Gate | Resultado |
| --- | --- |
| PHP focado | PASS |
| PHP lint | PASS |
| MySQL 8.4 integration | PASS |
| Vitest completo | 154 files, 912 tests PASS |
| Typecheck + route types | PASS |
| Clean Next build | PASS |
| ESLint focado deterministico | PASS |
| Launch validator | PASS, 55 mapped/44 graph |
| Secret scan | PASS |
| Encoding/mojibake | PASS |
| Generated artifacts | PASS |
| `git diff --check` | PASS com avisos EOL |
| Cross-shard corruption audit case | **FAIL P1** |

## FINAL_RISK_MATRIX

| Severidade | Finding | Consequencia | Gate |
| --- | --- | --- | --- |
| P0 | nenhum | - | 0 |
| P1 | integridade fisica validada por arquivo, nao pelo set | index pode referenciar shard corrompido | blocker |
| P1 | readiness duplicada no materializador | eligibility pode divergir do runtime | blocker |
| P2 | custo O(N) por request | latencia/carga futura | antes do Production GO |
| P2 | escala da validacao HTTP | tempo de materializacao futuro | antes do Production GO |
| P2 | semantica 503 | decisao operacional/crawl | antes do SEO GO |

## Recomendacao

Interromper o checkpoint. Corrigir os dois P1 e repetir esta auditoria:

1. validar o fingerprint fisico do conjunto inteiro antes de servir qualquer
   arquivo, com cache seguro vinculado a release imutavel quando necessario;
2. remover do materializador a decisao propria de `InstanceReadiness`, usando
   um assembler/readiness service compartilhado por runtime e sitemap;
3. adicionar testes que corrompam um shard e solicitem outro arquivo, e testes
   de paridade de readiness entre endpoint e materializador.

## Declaracoes finais

```text
RESET_POLICY_V2 = EXECUTED_AND_STABLE
113 resettable tables empty = SIM
RESETTABLE_TOTAL_ROWS = 0
analytics_lifecycle_events = 0
automatic repopulation = 0
public stale sitemap = NAO
public alternate stale paths = 0
quarantine public = NAO
sitemap source of truth = DATABASE
sitemap authoritative SEO = SHARED_BACKEND_AUTHORITY_WITH_P1_READINESS_DUPLICATION
logical fingerprint = CURRENT_ELIGIBLE_DATASET_DERIVED
physical fingerprint = ARTIFACT_BYTES_DERIVED_BUT_NOT_SET_VALIDATED_ON_READ
database drift detection = INDEPENDENT_OF_DIRTY_HOOK
promotion validation = MANDATORY_FAIL_CLOSED
MySQL integration = PASS_WITH_CROSS_SHARD_COVERAGE_GAP
effective launch mode = PRELAUNCH
real dataset loaded = NAO
REAL_DATA_INSERTION_AUTHORIZED = NAO
production DB writes by audit = 0
commit = NAO
push = NAO
deploy = NAO
P0 = 0
P1 = 2
MACROSTEP_11B_READY_FOR_GIT_CHECKPOINT = NAO
SITEMAP_ARCHITECTURE_READY_FOR_CONTROLLED_ROLLOUT = NAO
```

`DATASET_RESET_SITEMAP_ARCHITECTURE_AUDIT_NOT_READY`
