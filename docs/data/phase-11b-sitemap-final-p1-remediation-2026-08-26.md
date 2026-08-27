# Macroetapa 11B-POST-R3 - Final Sitemap Integrity + Readiness Authority Remediation

Data: 2026-08-26
Branch: `1.0.0`
Baseline: `fbb34f83f94bbda0792bd861c20d137916566a58`
Escopo: fechamento exclusivo dos P1 de integridade fisica set-wide e autoridade duplicada de `InstanceReadiness`.

## Resumo executivo

Os dois P1 da auditoria independente foram corrigidos sem DML, migration,
reset, carga de dados, publicacao de sitemap, commit, push ou deploy.

1. Um release de sitemap passou a possuir manifest deterministico e identidade
   fisica derivada do conjunto completo. Qualquer membro ausente, extra,
   alterado ou inconsistente invalida o release inteiro.
2. `InstanceReadiness` passou a ser montado por
   `SeoInstanceReadinessAssembler`, autoridade compartilhada entre runtime e
   sitemap. O materializador fornece somente perfil e sinais crus.

Resultado: `P0 = 0`, `P1 = 0`.

## Arquitetura final

```text
DB entity
  -> SeoFactsAssembler
  -> SeoInstanceReadinessAssembler
  -> PublicSeoEnvelopeService
  -> SeoPolicyService
  -> SeoDecision
  -> AuthoritativeSitemapEligibilityService
  -> logical dataset fingerprint v2
  -> validated immutable release
  -> atomic publication pointer
```

O fingerprint logico representa o dataset elegivel atual. O fingerprint fisico
representa os bytes do release materializado. Eles permanecem autoridades
separadas.

## RELEASE_PHYSICAL_INTEGRITY_MATRIX

| Caso | Autoridade aplicada | Resultado | Gate |
| --- | --- | --- | --- |
| Arquivo solicitado integro | manifest + hash + tamanho | servido somente se o set inteiro for valido | PASS |
| Arquivo solicitado corrompido | hash por membro e aggregate set fingerprint | release negado | PASS |
| Outro shard corrompido | validacao de todos os membros antes da leitura | release negado | PASS |
| Index corrompido | hash do index e manifest | release negado | PASS |
| Aggregate fisico divergente | recomputacao deterministica do manifest | release negado | PASS |
| State/status divergente | releaseId e manifestHash vinculados | release negado | PASS |

`release physical integrity = SET_WIDE_VALIDATED`.

## CROSS_SHARD_CORRUPTION_MATRIX

| Mutacao | Arquivo solicitado | Esperado | Observado |
| --- | --- | --- | --- |
| corromper `questions-00001.xml` | `sitemap.xml` | deny | deny |
| corromper `sitemap.xml` | `questions-00001.xml` | deny | deny |
| corromper shard nao solicitado depois de cache warm | outro membro | deny | deny |
| alterar membro no MySQL E2E | index/outro membro | deny set-wide | deny set-wide |

`cross shard corruption = FAIL_CLOSED`.

## RELEASE_MANIFEST_MATRIX

| Controle | Implementacao | Resultado |
| --- | --- | --- |
| Schema | `sitemap-release-manifest.v1` | PASS |
| Artifact state | `database-driven-sitemap-state.v3` | PASS |
| Identidade | `releaseId = SHA-256(version, logical, physical)` | PASS |
| Lista | XMLs ordenados por nome | PASS |
| Membro | nome, SHA-256 e tamanho | PASS |
| Fingerprint fisico | lista completa ordenada | PASS |
| Manifest hash | gravado e conferido em status/state | PASS |
| Referencias do index | igualdade exata com XMLs nao-index | PASS |
| Manifest corrompido | fail-closed | PASS |

## MISSING_EXTRA_FILE_MATRIX

| Caso | Resultado |
| --- | --- |
| Shard esperado ausente | release inteiro negado |
| XML inesperado adicionado | release inteiro negado |
| Shard referenciado fora do manifest | release inteiro negado |
| Membro no manifest nao referenciado pelo index | release inteiro negado |
| Arquivo solicitado fora do manifest | negado |

## PHYSICAL_CACHE_MATRIX

| Controle | Resultado |
| --- | --- |
| Namespace | path real imutavel + releaseId + manifestHash |
| Assinatura | nome, tamanho, mtime, ctime, inode e mode de todos os membros |
| Limite | cache bounded por numero de releases |
| Novo release | novo namespace |
| Withdraw | ponteiro/estado invalida acesso ao release antigo |
| Alteracao pos-promotion | assinatura muda; hashes sao revalidados; deny |
| Cache warm + corrupcao cross-shard | deny |

O cache evita re-hash integral quando a assinatura imutavel nao mudou, sem
transformar resultado de um release anterior em autoridade para outro release.

## TOCTOU_MATRIX

| Risco | Controle | Resultado |
| --- | --- | --- |
| Pointer muda durante validacao | `realpath()` fixa o release no inicio | mitigado |
| Arquivo muda apos validacao | release selado e assinatura rechecada | mitigado |
| Membro solicitado muda entre gate e read | re-hash do membro solicitado apos validacao | fail-closed |
| Release mutavel | arquivos 0444 e diretorios 0555 em plataformas POSIX | proibido por contrato |
| Promotion parcial | stage validado e troca atomica | proibido |

Nao existe promessa de atomicidade de filesystem fora dos limites do sistema
operacional; a combinacao de release imutavel, pointer atomico, manifest e
revalidacao do membro solicitado reduz o TOCTOU ao minimo operacional aceito.

## READINESS_AUTHORITY_MATRIX

| Camada | Responsabilidade | Autoridade final? |
| --- | --- | --- |
| Candidate SQL/materializer | coletar sinais crus | NAO |
| `SeoFactsAssembler` | normalizar fatos SEO | NAO |
| `SeoInstanceReadinessAssembler` | montar READY/NOT_READY/NOT_APPLICABLE | SIM |
| `PublicSeoEnvelopeService` | usar e expor a readiness compartilhada | NAO |
| `SeoPolicyService` | aplicar readiness na decisao SEO | NAO |
| `AuthoritativeSitemapEligibilityService` | consumir `SeoDecision` | NAO |

Perfis compartilhados cobertos: default, question, exam, material,
material_listing, simulation, contest e blog_article.

## READINESS_DUPLICATION_SCAN_MATRIX

| Busca | Escopo | Resultado |
| --- | --- | --- |
| final `instanceReadiness` no materializer | scripts/modulos sitemap | 0 |
| `$questionReady` e equivalentes | materializer | 0 |
| regras finais READY/NOT_READY por familia | materializer | 0 |
| `readinessProfile` | materializer | sinais crus permitidos |
| `readinessSignals` | materializer | sinais crus permitidos |
| regra factual de material/simulation | readiness publica | delegada ao assembler |

`sitemap materializer readiness authority = NAO`.

## RUNTIME_SITEMAP_PARITY_MATRIX

| Caso | Runtime | Sitemap | Paridade |
| --- | --- | --- | --- |
| Question READY | READY/INDEX | READY/eligible | PASS |
| Question NOT_READY | NOT_READY/NOINDEX | NOT_READY/excluded | PASS |
| Exam READY/NOT_READY | igual | igual | PASS |
| Material READY/NOT_READY | igual | igual | PASS |
| Contest READY/NOT_READY | igual | igual | PASS |
| Simulation READY/NOT_READY | igual | igual | PASS |
| NOINDEX | NOINDEX | excluded | PASS |
| Redirect | redirect | excluded | PASS |
| 404 | not_found | excluded | PASS |
| 410 | gone | excluded | PASS |

Suite explicita: `SITEMAP_RUNTIME_READINESS_PARITY_GATE = PASS`.

## AUTHORITATIVE_SEO_MATRIX

| Invariante | Resultado |
| --- | --- |
| `Sitemap intersect NOINDEX = empty` | PASS |
| `Sitemap intersect Redirect = empty` | PASS |
| `Sitemap intersect 404 = empty` | PASS |
| `Sitemap intersect 410 = empty` | PASS |
| Canonical host valido | obrigatorio |
| HTTP semantic 200 | obrigatorio |
| Publication allowed | obrigatorio |
| Family eligibility | obrigatoria |
| Instance readiness compartilhada | obrigatoria |

`SITEMAP_AUTHORITATIVE_SEO_DECISION_GATE = PASS`.

## LOGICAL_FINGERPRINT_MATRIX

| Controle | Resultado |
| --- | --- |
| Versao | `eligible-sitemap-dataset.v2` |
| Fonte | dataset elegivel atual do banco |
| Ordenacao | deterministica |
| Campos | family, identity, canonicalUrl, lastModified, policyVersion |
| Timestamp arbitrario | ausente |
| Fingerprint fisico misturado | nao |
| Regressao de versao | nao |

## DATABASE_FRESHNESS_MATRIX

| Mutacao em fixture sem depender de hook | Logical fingerprint muda | Artifact anterior |
| --- | --- | --- |
| add/publicar | sim | negado |
| unpublish/noindex | sim | negado |
| remove | sim | negado |
| readiness READY -> NOT_READY | sim | negado |
| bulk reset | sim | negado |

`database drift detection = INDEPENDENT_OF_DIRTY_HOOK`. Os hooks existentes
foram preservados como antecipacao/otimizacao.

## PROMOTION_VALIDATION_MATRIX

| Gate antes da promotion | Resultado |
| --- | --- |
| Stage separado | PASS |
| Manifest completo | PASS |
| Referencias do index | PASS |
| HTTP 200 | obrigatorio |
| Canonical | obrigatorio |
| NOINDEX | rejeitado |
| Redirect | rejeitado |
| 404 | rejeitado |
| 410 | rejeitado |
| Swap atomico | PASS |
| Geracao parcial/falha | nao publicada |

`promotion validation = MANDATORY_FAIL_CLOSED`.

## MYSQL_E2E_MATRIX

Ambiente descartavel MySQL `8.4.10-10`, rede desabilitada e teardown validado.

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
| bulk reset | PASS |
| requested-file corruption | PASS |
| cross-shard corruption | PASS |
| missing shard | PASS |
| manifest corruption | PASS |
| partial generation | PASS |
| atomic promotion | PASS |
| PRELAUNCH | PASS |
| PRODUCTION fixture | PASS |
| runtime/sitemap readiness parity | PASS |
| teardown | PASS |

`SITEMAP_MYSQL_INTEGRATION_GATE = PASS` e
`ISOLATED_MYSQL84_TEARDOWN_GATE = PASS`.

## PRELAUNCH_MATRIX

| Superficie de producao | HTTP | Estado |
| --- | ---: | --- |
| `/sitemap.xml` | 503 | indisponivel fail-closed |
| `/sitemap-index.xml` | 503 | indisponivel fail-closed |
| `/sitemaps/questions-00001.xml` | 503 | indisponivel |
| `/sitemaps/exams-00001.xml` | 503 | indisponivel |
| `/storage/random.xml` | 404 | privado |
| `/storage/logs/settings.log` | 404 | privado |
| `/storage/sitemaps/sitemap.xml` | 404 | privado |
| Sitemap timer | ativo, publicacao ignorada em PRELAUNCH | PASS |
| Blog sitemap timer | ativo, publicacao ignorada em PRELAUNCH | PASS |

`effective launch mode = PRELAUNCH` e nenhum sitemap real foi publicado.

## PRODUCTION_ZERO_STATE_MATRIX

Captura read-only: `2026-08-26T19:45:44+00:00`.

| Evidencia | Resultado |
| --- | ---: |
| Banco | `concursomestre` |
| Engine | MySQL `8.4.10-10` |
| RESETTABLE | 113 |
| RESETTABLE vazias | 113 |
| RESETTABLE total rows | 0 |
| `analytics_lifecycle_events` | 0 |
| Automatic repopulation observada | 0 |
| Production DB writes nesta remediacao | 0 |

Structural fingerprint:
`7e9904fc21bfa27ec5fe108f5ba6c0e594bf677fed9a509425beb77043656741`.

## PRESERVE_MATRIX

| Tabela | Rows | Digest read-only | Resultado |
| --- | ---: | --- | --- |
| `users` | 6 | `f982653942a2cb08ece0bbcef328bfa11e2d1b07b14296d908c9c10e3dd03bcf` | preservada |
| `system_settings` | 99 | `a44cc121213361af0f0b40a9c9d947a007a57d9fdb47534ac86c94d4d9666267` | preservada |
| `schema_migrations` | 62 | `2c42c88e2c5806aedf1264b4e800f4ad6480047ef8e4b76c01705c1f7f60ae6d` | preservada |

As demais tabelas PRESERVE foram verificadas pelo reporter sem escrita.

## SECURITY_MATRIX

| Controle | Resultado |
| --- | --- |
| Credencial de producao | read-only |
| DML/DDL de producao | 0 |
| Secrets no diff/relatorio | 0; scan PASS |
| PII no relatorio | 0 |
| Quarentena publica | NAO |
| `/storage` publico | NAO |
| Release parcial | nao publicavel |
| Manifest/state corrompido | fail-closed |
| Real dataset | nao carregado |

## TEST_MATRIX

| Gate | Resultado |
| --- | --- |
| PHP focado | PASS |
| PHP lint | PASS, 70 arquivos modificados/novos |
| Readiness parity suite | PASS |
| Cross-shard corruption suite | PASS |
| MySQL 8.4 integration | PASS |
| Vitest completo com Node 24.19.0 | PASS, 154 files / 912 tests |
| Vitest focado final | PASS, 4 files / 19 tests |
| Typecheck + route types | PASS |
| Clean Next build | PASS, 52/52 paginas |
| ESLint focado deterministico | PASS, 0 errors / 0 warnings |
| Launch validator | PASS, 55 mapped / 44 graph / 40 TARGET_INDEX / 15 permanent noindex / 19 fixtures |
| Secret scan | PASS |
| Encoding/mojibake | PASS |
| Generated artifacts | PASS |
| `git diff --check` | PASS; somente avisos EOL existentes |

Nota ambiental: a primeira execucao completa do Vitest com Node 20.12.2
encontrou incompatibilidade ESM da toolchain. A repeticao com o runtime Node
24.19.0 configurado para o workspace passou integralmente; nao houve falha
funcional de teste.

## FINAL_RISK_MATRIX

| Severidade | Item | Estado | Acao |
| --- | --- | --- | --- |
| P0 | escrita/dano/exposicao de producao | 0 | fechado |
| P1 | corrupcao cross-shard servindo outro membro | 0 | fechado set-wide |
| P1 | readiness final duplicada no materializer | 0 | fechado por autoridade compartilhada |
| P2 | 503 vs 404/410 em PRELAUNCH | aberto, nao blocker desta R3 | decidir antes do SEO GO |
| P2 | fingerprint DB O(N) por request | aberto, PRE_PRODUCTION_GO_BLOCKER | desenhar cache/versionamento sem reduzir correctness |
| P2 | validacao HTTP completa em escala | aberto, PRE_PRODUCTION_GO_BLOCKER | validar estrategia em lotes/cache |
| Operacional | codigo ainda nao implantado | dependencia de rollout futuro | rehearsal e auditoria independente |

## Worktree e escopo

O worktree ja continha alteracoes acumuladas e aprovadas das Macroetapas 11A e
11B. Esta R3 nao reverteu nem ocultou essas alteracoes. Nao houve staging,
commit, push ou deploy. Nao houve mudanca de dependencia ou migration.

Arquivos centrais desta R3:

- `backend/modules/seo/sitemaps/StaticSitemapReleaseManifest.php`
- `backend/modules/seo/sitemaps/StaticSitemapArtifactState.php`
- `backend/modules/seo/sitemaps/StaticSitemapPublisher.php`
- `backend/modules/seo/launch/SeoInstanceReadinessAssembler.php`
- `backend/modules/seo/services/PublicSeoEnvelopeService.php`
- `backend/modules/seo/services/SeoPolicyService.php`
- `backend/scripts/seo/generate_static_sitemaps.php`
- `src/services/seo/staticSitemapArtifacts.ts`
- `backend/tests/SitemapRuntimeReadinessParityTest.php`
- `backend/tests/SitemapMysqlIntegrationTest.php`
- `src/services/seo/staticSitemapArtifacts.test.ts`

## Declaracoes finais

```text
RESET_POLICY_V2 = EXECUTED_AND_STABLE
113 resettable tables empty = SIM
RESETTABLE_TOTAL_ROWS = 0
analytics_lifecycle_events = 0
automatic repopulation = 0
public stale sitemap = NAO
public alternate stale paths = 0
release physical integrity = SET_WIDE_VALIDATED
cross shard corruption = FAIL_CLOSED
sitemap authoritative SEO = SHARED_BACKEND_AUTHORITY
InstanceReadiness authority = SHARED_RUNTIME_SITEMAP
sitemap materializer readiness authority = NAO
logical fingerprint = CURRENT_ELIGIBLE_DATASET_DERIVED
physical fingerprint = COMPLETE_RELEASE_ARTIFACT_SET_DERIVED
database drift detection = INDEPENDENT_OF_DIRTY_HOOK
promotion validation = MANDATORY_FAIL_CLOSED
MySQL integration = PASS
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

`DATASET_RESET_SITEMAP_FINAL_P1_REMEDIATION_READY`

Proximo gate: `11B-POST-R3-AUDIT`, auditoria independente final dos dois P1.
