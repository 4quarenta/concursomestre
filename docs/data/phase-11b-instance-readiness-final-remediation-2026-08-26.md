# Macroetapa 11B-POST-R4 - Final Instance Readiness Authority Remediation

Data: 2026-08-26
Branch: `1.0.0`
Baseline: `fbb34f83f94bbda0792bd861c20d137916566a58`
Escopo: correcao exclusiva de `INSTANCE_READINESS_AUTHORITY_NOT_UNIFIED`.

## Resumo executivo

O P1 foi fechado sem escrita em producao. `SeoInstanceReadinessAssembler` e a
unica autoridade final que agrega e normaliza `InstanceReadiness.status` e
`InstanceReadiness.reasonCodes`. Material e Simulation agora apenas adaptam os
campos factuais e delegam. O materializer usa os mesmos adaptadores e nao
injeta nem modifica readiness final.

O teste de paridade anterior foi substituido por um teste factual: o lado
runtime atravessa `PublicMaterialReadiness` ou
`PublicSimulationReadinessValidator`; o lado sitemap atravessa os sinais do
materializer e `AuthoritativeSitemapEligibilityService`. Ambos comparam o
objeto completo de readiness, PublicationDecision e SeoDecision.

Resultados centrais:

```text
FINAL_INSTANCE_READINESS_AUTHORITIES = 1
MATERIAL_RUNTIME_SITEMAP_READINESS_PARITY = PASS
SIMULATION_RUNTIME_SITEMAP_READINESS_PARITY = PASS
readiness status parity = PASS
readiness reason parity = PASS
materializer final readiness rules = 0
wrapper final readiness overrides = 0
```

## Causa raiz

Havia duas causas combinadas:

1. Os wrappers de Material e Simulation montavam status e reasons de forma
   independente, depois das regras compartilhadas.
2. O assembler interrompia a avaliacao no primeiro bloqueio de publication,
   portanto o sitemap perdia blockers de perfil ainda aplicaveis.

Material consultava identidade, slug, titulo, estado editorial, publication,
visibility, archive, rights e asset. Simulation consultava identidade, slug,
titulo, publication, visibility, archive e quantidade de questoes. Esses sao
sinais publicos factuais, nao regras de UI ou workflow privado, e agora entram
na autoridade compartilhada.

## INSTANCE_READINESS_PRODUCER_MATRIX

| Componente | Papel apos R4 | Autoridade final |
| --- | --- | --- |
| `SeoInstanceReadinessAssembler::assemble` | agrega publication, implementacao, explicit facts, perfil e quality | SIM, unica |
| `SeoInstanceReadinessAssembler::fromProfile` | regras de perfil dentro da mesma autoridade | mesma autoridade |
| `SeoInstanceReadiness::validate` | valida contrato, status e reason codes | NAO |
| `ContentPublicationPolicy` | produz PublicationDecision | NAO |
| `PublicSeoEnvelopeService` | orquestra e consome assembler | NAO |
| `SeoPolicyService` | consome readiness validada | NAO |
| `AuthoritativeSitemapEligibilityService` | consome envelope e filtra SeoDecision | NAO |
| `PublicMaterialReadiness` | adaptador factual e delegate | NAO |
| `PublicSimulationReadinessValidator` | adaptador factual e delegate | NAO |
| `ContestsService` | delegate de perfil da mesma autoridade | NAO |
| validators de taxonomy/professional/blog/law | fatos estruturais especializados upstream | NAO, sem override transversal |
| materializer | fornece raw public facts/signals | NAO |

`INSTANCE_READINESS_SINGLE_AUTHORITY_GATE = PASS`.

## READINESS_REASON_OWNERSHIP_MATRIX

| Reason | Sinal factual | Dono final |
| --- | --- | --- |
| `current_implementation_not_ready` | familia ainda nao implementada | assembler |
| `publication_blocked` | PublicationDecision ou archive | assembler |
| `entity_missing` | identidade publica ausente | assembler profile |
| `invalid_slug` | slug persistido invalido | assembler profile |
| `canonical_invalid` | canonical derivada do slug invalido | assembler profile |
| `invalid_definition` | definicao/asset/question/offer/organization requerida ausente | assembler profile |
| `protected` | rights publicos nao permitidos | assembler profile |
| `invalid_hierarchy` | quality estrutural especializada | assembler default mapping |
| `not_evaluated` | quality nao avaliada | assembler default mapping |
| `not_applicable` | explicit fact validado | assembler aggregation |

Reasons sao deduplicados e ordenados por `SORT_STRING`. Aliases e casing
alternativos nao sao produzidos pelos adaptadores R4.

## MATERIAL_READINESS_MATRIX

| Caso | Runtime | Sitemap | Resultado |
| --- | --- | --- | --- |
| READY | `READY []` | `READY []` | PASS |
| draft + titulo/status/rights/asset invalidos | `NOT_READY [invalid_definition, protected, publication_blocked]` | mesmo conjunto | PASS |
| READY -> NOT_READY | transicao preservada | URL removida | PASS |
| NOT_READY -> READY | transicao preservada | URL elegivel | PASS |

`MATERIAL_RUNTIME_SITEMAP_READINESS_PARITY = PASS`.

## SIMULATION_READINESS_MATRIX

| Caso | Runtime | Sitemap | Resultado |
| --- | --- | --- | --- |
| READY | `READY []` | `READY []` | PASS |
| draft + titulo/question invalidos | `NOT_READY [invalid_definition, publication_blocked]` | mesmo conjunto | PASS |
| READY -> NOT_READY | transicao preservada | URL removida | PASS |
| NOT_READY -> READY | transicao preservada | URL elegivel | PASS |

`SIMULATION_RUNTIME_SITEMAP_READINESS_PARITY = PASS`.

## WRAPPER_AUTHORITY_MATRIX

| Wrapper | Mapeia facts | Chama autoridade | Adiciona reason depois | Recalcula status |
| --- | --- | --- | --- | --- |
| Material detail | sim | sim | nao | nao |
| Material listing | sim, incluindo oferta | sim | nao | nao |
| Simulation | sim | sim | nao | nao |

`wrapper final readiness overrides = 0`.

## MATERIALIZER_AUTHORITY_MATRIX

| Controle | Resultado |
| --- | --- |
| `instanceReadiness` final injetada | 0 |
| Material facts | adaptador compartilhado |
| Simulation facts | adaptador compartilhado |
| PublicationDecision | envelope autoritativo |
| SeoDecision | policy autoritativa |
| Elegibilidade final | INDEX + render + 200 + canonical + sitemap eligible |

`materializer final readiness rules = 0`.

## RUNTIME_FACTUAL_PATH_MATRIX

| Familia | Caminho factual |
| --- | --- |
| Material | row publica -> `PublicMaterialReadiness` -> assembler -> runtime payload/envelope |
| Simulation | row publica -> validator delegate -> assembler -> runtime payload/envelope |
| Question | public projection -> envelope -> assembler |
| Exam | public projection -> envelope -> assembler |
| Contest | service profile -> assembler -> projection/envelope |

## SITEMAP_FACTUAL_PATH_MATRIX

| Familia | Caminho factual |
| --- | --- |
| Material | DB row -> shared publication/signals adapter -> envelope -> assembler -> sitemap eligibility |
| Simulation | DB row -> shared publication/signals adapter -> envelope -> assembler -> sitemap eligibility |
| Question/Exam/Contest | DB candidate -> envelope -> assembler -> sitemap eligibility |

## RUNTIME_SITEMAP_PARITY_MATRIX

| Campo comparado | Material | Simulation |
| --- | --- | --- |
| readiness status | PASS | PASS |
| normalized reasons | PASS | PASS |
| PublicationDecision | PASS | PASS |
| indexability | PASS | PASS |
| resolution | PASS | PASS |
| canonical | PASS | PASS |
| sitemap eligible | PASS | PASS |

O gate tambem cobre Question, Exam, Contest, NOT_APPLICABLE, NOINDEX,
redirect, 404 e 410.

`RUNTIME_SITEMAP_FACTUAL_READINESS_PARITY_GATE = PASS`.

## READINESS_TRANSITION_MATRIX

| Transicao | Material | Simulation | Fingerprint logico |
| --- | --- | --- | --- |
| READY -> NOT_READY | PASS | PASS | muda quando elegibilidade muda |
| NOT_READY -> READY | PASS | PASS | muda quando elegibilidade muda |
| direct DB mutation sem dirty hook | detectada | detectada pelo mesmo contrato | artifact antigo nao CURRENT |

## AUTHORITATIVE_SEO_MATRIX

| Invariante | Resultado |
| --- | --- |
| Sitemap intersect NOINDEX | vazio |
| Sitemap intersect redirect | vazio |
| Sitemap intersect 404 | vazio |
| Sitemap intersect 410 | vazio |
| Canonical host | `https://concursomestre.com` |
| Runtime e sitemap compartilham readiness factual | PASS |

## LOGICAL_FINGERPRINT_REGRESSION_MATRIX

| Caso | Resultado |
| --- | --- |
| entidade adicionada | fingerprint muda |
| entidade removida | fingerprint muda |
| publication -> NOINDEX | fingerprint muda |
| READY -> NOT_READY | fingerprint muda |
| bulk reset | fingerprint vazio e artifact anterior stale |
| deteccao sem markDirty | PASS |

`SITEMAP_DATABASE_FRESHNESS_GATE = PASS`.

## PHYSICAL_INTEGRITY_REGRESSION_MATRIX

| Mutacao independente | Resultado |
| --- | --- |
| corrupcao de shard solicitado | FAIL_CLOSED |
| corrupcao de outro shard | FAIL_CLOSED set-wide |
| shard ausente/extra | FAIL_CLOSED |
| manifest ausente/corrompido | FAIL_CLOSED |
| publication state corrompido | FAIL_CLOSED |

`release physical integrity = SET_WIDE_VALIDATED`.

## MYSQL_E2E_MATRIX

MySQL Community `8.4.11`, datadir e schema descartaveis, loopback/socket local.

| Caso | Status |
| --- | --- |
| zero | PASS |
| add/remove | PASS |
| noindex | PASS |
| redirect/404/410 | PASS |
| direct mutation | PASS |
| bulk reset | PASS |
| readiness transitions | PASS |
| material parity | PASS |
| simulation parity | PASS |
| logical fingerprint transition | PASS |
| PRELAUNCH | PASS |
| production fixture | PASS |
| teardown | PASS |

`SITEMAP_MYSQL_INTEGRATION_GATE = PASS` e
`ISOLATED_MYSQL84_TEARDOWN_GATE = PASS`.

## PRODUCTION_ZERO_STATE_MATRIX

Duas capturas read-only: `2026-08-26T21:45:12Z` e
`2026-08-26T21:46:03Z`.

| Evidencia | Resultado |
| --- | ---: |
| Engine | MySQL 8.4.10-10 |
| Credencial read-only | PASS |
| RESETTABLE | 113 |
| RESETTABLE vazias | 113 |
| RESETTABLE total rows | 0 |
| `analytics_lifecycle_events` | 0 |
| repopulacao entre capturas | 0 |
| production DB writes R4 | 0 |

Preservados: `users=6`, `system_settings=99`, `schema_migrations=62`, com os
mesmos digests do gate anterior. Structural fingerprint:
`7e9904fc21bfa27ec5fe108f5ba6c0e594bf677fed9a509425beb77043656741`.

## PUBLIC_SURFACE_MATRIX

| Superficie | HTTP/estado |
| --- | --- |
| `/sitemap.xml` | 503 fail-closed |
| `/sitemap-index.xml` | 503 fail-closed |
| question/exam shard probes | 503 |
| `/storage/.sitemaps-publication-state.json` | 404 |
| `/storage/logs/settings.log` | 404 |
| `/storage/sitemaps/sitemap.xml` | 404 |
| public stale quarantine path | 404/absent |
| private quarantine | presente e privada |
| sitemap timers | ativos; PRELAUNCH impede publicacao |
| `SEO_LAUNCH_MODE` | ausente, fail-safe PRELAUNCH |

## TEST_MATRIX

| Gate | Resultado |
| --- | --- |
| PHP focused | PASS |
| PHP lint | PASS, 72 arquivos |
| factual readiness parity | PASS |
| single authority gate | PASS |
| independent physical regression | PASS, 5/5 |
| MySQL 8.4 E2E | PASS |
| Vitest completo | PASS, 154 files / 912 tests |
| route types + typecheck | PASS |
| Next production build | PASS, 52/52 paginas |
| ESLint deterministico focado | PASS, 8 arquivos |
| launch validator | PASS, 55/44/40/15/19 |
| secret scan | PASS |
| encoding | PASS |
| generated artifacts | PASS |
| `git diff --check` | PASS, somente warnings EOL preexistentes |

O sandbox impediu a exclusao manual de `.next`; nao houve contorno. O build
padrao do Next concluiu integralmente e produziu 52/52 paginas.

## FINAL_RISK_MATRIX

| Severidade | Item | Estado |
| --- | --- | --- |
| P0 | escrita/dano/exposicao em producao | 0 |
| P1 | Material runtime vs sitemap | fechado |
| P1 | Simulation runtime vs sitemap | fechado |
| P1 | status igual, reasons divergentes | fechado |
| P1 | wrapper/materializer com autoridade final | fechado |
| P1 | freshness/fingerprint regredido | 0 |
| P1 | integridade fisica regredida | 0 |
| P2 | semantica 503 | aberto, fora da R4 |
| P2 | fingerprint O(N) em escala | aberto, pre-Production GO |
| P2 | validacao HTTP em escala | aberto, pre-Production GO |

## Declaracoes finais

```text
RESET_POLICY_V2 = EXECUTED_AND_STABLE
113 resettable tables empty = SIM
RESETTABLE_TOTAL_ROWS = 0
analytics_lifecycle_events = 0
automatic repopulation = 0
InstanceReadiness authority = SINGLE_SHARED_RUNTIME_SITEMAP
FINAL_INSTANCE_READINESS_AUTHORITIES = 1
material runtime sitemap parity = PASS
simulation runtime sitemap parity = PASS
readiness status parity = PASS
readiness reason parity = PASS
materializer final readiness rules = 0
wrapper final readiness overrides = 0
release physical integrity = SET_WIDE_VALIDATED
logical fingerprint = CURRENT_ELIGIBLE_DATASET_DERIVED
database drift detection = INDEPENDENT_OF_DIRTY_HOOK
effective launch mode = PRELAUNCH
real dataset loaded = NAO
REAL_DATA_INSERTION_AUTHORIZED = NAO
production DB writes = 0
commit = NAO
push = NAO
deploy = NAO
P0 = 0
P1 = 0
```

## Veredito

`DATASET_RESET_INSTANCE_READINESS_FINAL_REMEDIATION_READY`

Proximo gate: `11B-POST-R4-AUDIT`. Nenhum checkpoint, carga de dados, commit,
push ou deploy foi iniciado.
