# Cross-Cutting Improvement Ledger (Macrosteps 01-15)

Date: 2026-08-30

## Authority and scope

This ledger consolidates deferred findings from the committed audit record through
Macrostep 15. It is an engineering planning artifact, not an authorization to
change production. Production remains in `PRELAUNCH`; no real dataset, index,
deploy, migration, production DML, or production DDL was performed for this
audit.

Status vocabulary is deliberately closed: `IMPLEMENTED`, `TRANSFERRED`,
`ACCEPTED_DEBT_WITH_REASON`, `OBSOLETE_WITH_EVIDENCE`, or `BLOCKED`.

| ID | Origin | Finding | Status | Destination / acceptance condition |
| --- | --- | --- | --- | --- |
| CC-01 | 01 | Legacy `/questao-pro-backend/` public route | TRANSFERRED | Macrostep 18 infrastructure/public-surface review; prove no public legacy vhost before Production GO. |
| CC-02 | 01 | Oversized domain and UI modules | ACCEPTED_DEBT_WITH_REASON | Incremental decomposition; source-size budget prevents growth and no functional defect was found. |
| CC-03 | 01/08 | Direct request paths outside the API layer | TRANSFERRED | `FUTURE_TECHNICAL_BACKLOG`; Macrostep 14 is complete and no big-bang rewrite is justified. |
| CC-04 | R6 | Strict TypeScript and `noUncheckedIndexedAccess` rollout | TRANSFERRED | `FUTURE_TECHNICAL_BACKLOG`; Macrostep 14 is complete and no pre-GO blocker is evidenced. |
| CC-05 | R6 | Existing ESLint warnings and slow broad lint | TRANSFERRED | `MACROSTEP_20`; `RC_RECHECK=MACROSTEP_20`; scope lint deterministically without excluding source. |
| CC-06 | R6 | Reverse-filter filesort | TRANSFERRED | `POST_GO_REAL_DATA_VALIDATION`; review the real distribution with EXPLAIN after controlled data load. |
| CC-07 | 05/06 | Ranking client-side SEO mutator | TRANSFERRED | `MACROSTEP_20`; recheck ranking authority before indexed launch. |
| CC-08 | 05/06 | Legacy SeoPayload and stale JSON-LD harness expectations | IMPLEMENTED | SSR harness baseline now matches server-rendered `WebPage` contracts; fixture harness passes 62/62. |
| CC-09 | 06/11B | PRELAUNCH sitemap 503 versus 404/410 policy | TRANSFERRED | Macrostep 20 launch decision; preserve fail-closed behaviour until then. |
| CC-10 | 06/11B | Sitemap eligible fingerprint is request-time O(N) | TRANSFERRED | `MACROSTEP_20`; prove versioned/cacheable invalidation with a representative synthetic/high-volume fixture. |
| CC-11 | 06/11B | Full HTTP sitemap candidate validation cost | TRANSFERRED | `MACROSTEP_20`; prove bounded batching/materialization before indexed launch. |
| CC-12 | 07 | Global provider tree breadth | ACCEPTED_DEBT_WITH_REASON | No regression in SSR ownership; redesign only with a measured client-boundary benefit. |
| CC-13A | 07 | Blog/support desktop CLS and field CWV | TRANSFERRED | `POST_GO_REAL_DATA_VALIDATION`; validate field CWV with real traffic after launch. |
| CC-13B | 07 | Blog prefetch volume and synthetic CLS budget | TRANSFERRED | `MACROSTEP_20`; complete the synthetic RC gate separately from field CWV. |
| CC-14 | 07 | 212-259 KiB dynamic HTML and no public cache | TRANSFERRED | `POST_GO_REAL_DATA_VALIDATION`; review real CDN/TTFB behaviour and payload distribution; current private/no-store behaviour is intentional. |
| CC-15 | 08 | Real-data SEO census, CDN, EXPLAIN and Search Console validation | TRANSFERRED | `POST_GO_REAL_DATA_VALIDATION`; this is post-GO evidence, never a pre-GO requirement for loading real data. |
| CC-16 | 11A | MySQL bind-address hardening | TRANSFERRED | Macrostep 18 network hardening; no evidence in this audit authorizes a server change. |
| CC-17 | 11B | Refresh-token retention, statistics GET bootstrap, card mirror sync | TRANSFERRED | `FUTURE_TECHNICAL_BACKLOG`; retain strict writer attribution and define runtime policy. |
| CC-18 | 11B | Runtime evidence depends on external operational capture | TRANSFERRED | `MACROSTEP_13`; `SUBGATE=B13X-006`; preserve the approved observation and close with external evidence. |
| CC-19 | 11B | Candidate-signal duplication in sitemap eligibility | TRANSFERRED | `FUTURE_TECHNICAL_BACKLOG`; consolidate signals through public projections/readiness. |
| CC-20 | 11C/14 | Node/jsdom CSS ESM test incompatibility | IMPLEMENTED | Node 20.19.5 is pinned in CI and jsdom is pinned to 26.1.0; full Vitest passes. |
| CC-21 | 12 | Manual external security gates | BLOCKED | Requires operator-controlled external evidence; security pre-GO blocker remains true. |
| CC-22A | 13 | MySQL durability controls | TRANSFERRED | `MACROSTEP_13`; `SUBGATE=B13X-006`; authoritative record still requires production observation/closure. |
| CC-22B | 13 | PITR operational availability | TRANSFERRED | `MACROSTEP_13`; `SUBGATE=B13X-006`; disposable rehearsal passed, production availability remains unproven. |
| CC-22C | 13 | Off-host backup | TRANSFERRED | Macrostep 18, `INFRA18-PREGO-DR-01`. |
| CC-22D | 13 | Managed backup encryption / KMS | TRANSFERRED | Macrostep 18, `INFRA18-PREGO-DR-01`. |
| CC-22E | 13 | Backup immutability | TRANSFERRED | Macrostep 18, `INFRA18-PREGO-DR-01`. |
| CC-23 | 13 | Runtime least privilege and separate migration principal | TRANSFERRED | `MACROSTEP_13`; `SUBGATE=B13X-006`; close only after production principal evidence. |
| CC-24 | 13 | Strict-writer observation and cleanup | TRANSFERRED | `MACROSTEP_13`; `SUBGATE=B13X-006`; this audit made no interference. |
| CC-25 | 14 | 96 legacy bridges lacking static per-bridge method proof | ACCEPTED_DEBT_WITH_REASON | Migration by domain; hardened mobile routes are covered and no broad rewrite is justified. |
| CC-26 | 14 | Historical API mostly unversioned | TRANSFERRED | `FUTURE_TECHNICAL_BACKLOG`; Macrostep 14 is complete. |
| CC-27 | 14 | Mobile question list remains capped legacy bridge | TRANSFERRED | `FUTURE_TECHNICAL_BACKLOG`; server-filtered DTO v2 before real mobile scale. |
| CC-28 | 14 | Defensive request-time DDL in legacy PHP | TRANSFERRED | `FUTURE_TECHNICAL_BACKLOG`; preserve `MIGRATION_FIRST_REMOVAL`; static scan still finds legacy guards. |
| CC-29 | 14 | Legacy datetime/type consistency | TRANSFERRED | `FUTURE_TECHNICAL_BACKLOG`; Macrostep 14 is complete. |
| CC-30 | 15 | Source `release:verify` sees stale checked-in manifest | ACCEPTED_DEBT_WITH_REASON | `release:package` is the authoritative release validation and passed; the source manifest remains stale and needs a future verifier/runbook decision. |
| CC-31 | 15 | Local SSR/browser backend harness absent | OBSOLETE_WITH_EVIDENCE | The official fixture API and harness already existed in the base; the blocker was configuration/discovery, not missing implementation. |
| CC-32 | 15 | Auth inputs without explicit label association | IMPLEMENTED | Preserved candidate patch adds stable `id`/`htmlFor` pairs for signup, social signup, login and recovery controls. |
| CC-33 | 15 | Mobile advisories | ACCEPTED_DEBT_WITH_REASON | Direct Axios is aligned to current 1.20.0; remaining Expo/RN transitive advisories require SDK lifecycle upgrade, not mass `audit fix`. |
| CC-34 | 15 | Header checker depends on sibling backend path | TRANSFERRED | `FUTURE_TECHNICAL_BACKLOG`; `RC_RECHECK=MACROSTEP_20` if the checker remains a release gate. |
| CC-35 | 15 | Standard-header checker reports broad historical omissions | ACCEPTED_DEBT_WITH_REASON | The check fails across existing frontend/backend files; `RC_RECHECK=MACROSTEP_20`; mass insertion remains non-functional churn. |

## B15 verification disposition

| Blocker | Final disposition | Evidence |
| --- | --- | --- |
| B15-V01 | IMPLEMENTED | jsdom 26.1.0 removes the CJS-to-ESM css-calc failure under Node 20.19.5. |
| B15-V02 | IMPLEMENTED | Official SSR/hydration fixture harness: 31 routes, 62 executions, 62 equivalent, zero semantic/security divergence. |
| B15-V03 | IMPLEMENTED | A package built from immutable baseline `b4ab179d` regenerated its manifest and passed release-package verification (2,386 files, 70 migrations). |
| B15-V04 | IMPLEMENTED | `scripts/seo/ssr-hydration-fixture-api.mjs` is a complete local disposable backend harness. |
| B15-V05 | ACCEPTED_DEBT_WITH_REASON | Mobile typecheck passes. Axios patch is applied; Expo 52/React Native 0.76 transitive advisories need a separately rehearsed SDK upgrade. |

## Candidate patch preserved

The only pre-existing functional patch carried into the clean candidate is
`src/app/auth/components/Auth.tsx`. It is not committed, pushed, or deployed.

## Prohibitions retained

`MACROSTEP_13_OBSERVATION_INTERFERENCE=0`.

`REAL_DATA_INSERTION_AUTHORIZED=NAO`; `REAL_DATA_LOADED=NAO`; `PRODUCTION_GO=NAO`.

## Reconciliation invariants

Every `TRANSFERRED` row has an explicit destination and, where applicable, a
subgate. Findings that require real traffic, real dataset distribution, Search
Console, or field CWV are owned by `POST_GO_REAL_DATA_VALIDATION`; they are not
preconditions that require real data before Production GO. Macrostep 13 items
remain attached to `B13X-006` because the available authoritative record keeps
that observation in progress; local rehearsal evidence is not treated as proof
of production closure.

```text
OPEN_FINDINGS_WITH_COMPLETED_TARGET = 0
TRANSFERRED_WITHOUT_EXPLICIT_OWNER = 0
P2_WITHOUT_STATUS = 0
DEFERRED_WITHOUT_OWNER = 0
BLOCKED_WITHOUT_ACCEPTANCE_CONDITION = 0
REAL_DATA_PRE_GO_CONTRADICTIONS = 0
```

## Macrostep 16 disposition (2026-08-30)

| ID | Finding | Status | Destination / acceptance condition |
| --- | --- | --- | --- |
| B16-01 | Checkout sem `checkout_attempt_id` permitia omitir a chave de idempotencia do provider | IMPLEMENTED | Backend agora rejeita tentativa sem identificador e preserva a chave Stripe; teste `BillingCheckoutIdempotencyContractTest` passa. |
| B16-02 | E2E financeiro e testes de concorrencia dependentes do provedor nao puderam ser concluídos no cleanroom | VERIFIED | Candidato executado em cleanroom VPS isolado com Stripe TEST e Percona/MySQL 8.4 descartável; 7/7 cenarios provider-backed passaram; nenhum writer de producao foi acionado. |
| B16-03 | Renovacao real com Test Clock, webhook replay e reconciliacao | VERIFIED | Cleanroom VPS isolado com Stripe TEST e Percona/MySQL 8.4 descartável; 7/7 cenarios provider-backed passaram sem mutacao de producao. |
| B16-04 | Remocao do provider legado Mercado Pago e preservacao do dominio Stripe/materials | IMPLEMENTED | Superficies MP removidas; abstracoes genericas e pagamentos Stripe/materials preservados. |
| B16-05 | Duplicacao de preview de preco/cupom no cliente | ACCEPTED_DEBT_WITH_REASON | UI pode projetar preview; backend continua autoridade final do plano, valor e cobranca. |
| B16-06 | Dependencia de settings globais e payload billing historico | TRANSFERRED | Revisar no proximo ciclo de performance/contratos, sem alterar o fluxo financeiro nesta auditoria. |
| B16-07 | Gamificacao concedia tempo de assinatura no level-up | IMPLEMENTED | O worker preserva XP, nivel, streaks, badges e marcos; a fronteira de gamificacao nao escreve assinatura, cria entitlement pago nem chama Stripe. Regressao coberta por `GamificationCannotGrantSubscriptionTimeTest`. |

`MACROSTEP_16_IMPROVEMENT_AUDIT = COMPLETE`

`MACROSTEP_16_READINESS_AUDIT = PASS`

`P0_REMAINING = 0`

`P1_IMPLEMENTATION_REMAINING = 0`

`READINESS_BLOCKER = none`

`SECONDARY_BLOCKERS = none`

## Macrostep 17 disposition (2026-08-30)

| ID | Finding | Status | Destination / acceptance condition |
| --- | --- | --- | --- |
| P17-01 | Pedido de exclusao nao revogava sessoes concorrentes | IMPLEMENTED | `revokeAllUserSessionFamilies` revoga sessoes e refresh tokens na mesma transacao do marcador. |
| P17-02 | Rota de exclusao nao declarava POST-only | IMPLEMENTED | `POST /api/users/delete.php`; metodo diferente e rejeitado. |
| P17-03 | Login/refresh/JWT podiam continuar apos pedido de exclusao | IMPLEMENTED | Marker/status sao verificados nas entradas de senha, social, refresh, cookie e JWT. |
| P17-04 | Apagamento/anonymizacao final e prazos dependem de politica aprovada | OPEN_WITH_OWNER | Owner juridico + Macrostep 17; definir grafo e prazos antes do Production GO. |
| P17-05 | Exportacao self-service nao existe | OPEN_WITH_OWNER | Macrostep 17; manter atendimento controlado e avaliar contrato de exportacao. |
| P17-06 | Email em analytics e retencao de logs precisam minimizacao | TRANSFERRED | Macrostep 19 para instrumentacao; Macrostep 18 para log pipeline/retencao. |
| P17-07 | Consentimento analytics/marketing nao tinha enforcement runtime provado | IMPLEMENTED | Consent manager versionado nega opcionais por padrao, bloqueia GA/ads/analytics proprio, sincroniza abas e permite retirada; revisao juridica permanece separada. |
| P17-08 | Versionamento formal dos documentos publicos e incompleto | OPEN_WITH_OWNER | Macrostep 20 + owner juridico/editorial. |

`MACROSTEP_17_IMPORTED_LEDGER_FINDINGS = 1` (CC-17, por retenção de refresh
tokens e política de sessão).

`ALL_IMPORTED_LEDGER_FINDINGS_ACCOUNTED_FOR = SIM`

`ALL_NEW_P2_ACCOUNTED_FOR = SIM`

`ALL_NEW_DEFERRED_ACCOUNTED_FOR = SIM`

`TRANSFERRED_WITHOUT_OWNER = 0`

`MACROSTEP_17_IMPROVEMENT_AUDIT = COMPLETE`

## Macrostep 18 disposition (2026-08-31)

| ID | Origin | Area | Finding | Status | Owner / acceptance condition |
| --- | --- | --- | --- | --- | --- |
| INFRA18-P1-01 | 18 | availability / freeze | The versioned systemd freeze policy included Nginx, PHP-FPM and the frontend in its suppression inventory. | CLOSED_LOCAL | Versioned policy now excludes serving units, classifies them explicitly, and regression tests the availability-safe boundary. Production rollout remains separately planned. |
| INFRA18-P1-02 | 18 | network exposure | MySQL classic/X were publicly bound; additional legacy listeners include FTP, SMTP and Varnish. | CLOSED | MySQL classic/X and SMTP now bind loopback; FTP and Varnish are inactive; final listener inventory contains no targeted wildcard listener and public probes remain blocked. |
| INFRA18-P1-03 | 18 | TLS / availability | The certificate expires on 2026-09-12. Renewal is panel-managed and the installed implementation renews at seven days before expiry. | TIME_BOUND_PREGO_VALIDATION | Owner: Infrastructure. Validate from 2026-09-05 05:10 UTC: certificate serial/fingerprint or issuance evidence changes, expiry extends, issuer/SANs remain valid, HTTPS stays healthy, and external expiry alerting is proven. Hard deadline: 2026-09-12. |
| INFRA18-P1-04 | 18 | service health | `systemctl is-system-running` remains `degraded` because `motd-news` fails with `203/EXEC`; two stale failure records were cleared. | RECLASSIFIED_P2_OS_HYGIENE | The only remaining failed unit is static `motd-news` with an absent script and no application/security/backup/availability dependency; no `reset-failed` was used in V2. |
| INFRA18-P1-05 | 18 | public surface | The production Nginx configuration exposed the legacy `/questao-pro-backend/` route surface. | CLOSED | Exact and slash variants now return 404 after syntax validation and safe reload; public health/readiness stayed healthy. |
| INFRA18-P1-06 | 18 | monitoring independence | Health/heartbeat files and local timers existed, but independent alert delivery and host-loss detection were not proven. | PENDING_NEXT_SCHEDULE | Workflow `666a04e3` is on the GitHub default branch with read-only probes and a stable User-Agent; no matching external access-log request has appeared yet. Validate the next eligible scheduled run and failure-state persistence. Owner: Operations. Personal alert receipt remains a separate pre-GO manual check. |
| INFRA18-P1-07 | 18 | configuration drift | Production uses manually maintained release, cron and Nginx paths that cannot be compared byte-for-byte with a versioned production snapshot. Runtime DB grants also conflicted with the successful public health evidence. | CLOSED | Production identity and effective grants match the exact disposable MySQL rehearsal; the rehearsal proved required writes and denied DDL/grant paths, so no persistent production DML smoke was required. |
| INFRA18-P1-08 | 18 | TLS key permissions | The active TLS private-key path was observed with mode `0644`, which was broader than the required private-key boundary. | TIME_BOUND_PREGO_VALIDATION | Owner: Infrastructure. Immediately after the first eligible real renewal, verify root-owned mode `0600` or stricter; reopen as P1 if renewal recreates `0644`. Validation window starts 2026-09-05 05:10 UTC; hard deadline: 2026-09-12. |
| INFRA18-DR-01 | 18 | disaster recovery | Off-host backup, managed encryption/KMS and immutability remain unproven. | BLOCKED | User decision required: select a provider/storage policy, accept the residual single-host risk, or defer Production GO. |
| INFRA18-P2-01 | 18 | TLS | Nginx emits non-blocking OCSP stapling and deprecated `listen ... http2` warnings. | ACCEPTED_DEBT_WITH_REASON | Recheck during TLS hardening; no blind production change during Macrostep 13 observation. |
| INFRA18-P2-02 | 18 | capacity | Swap use is material despite healthy available memory; journal and legacy service inventory need capacity review. | ACCEPTED_DEBT_WITH_REASON | Monitor with real traffic and review limits before scale-up. |
| INFRA18-P2-03 | 18 | backup | Local DB backup is current and verified, but asset backup freshness and a full combined restore signal are not independently proven in this run. | TRANSFERRED | Macrostep 13 / recovery owner; preserve existing backup evidence and prove asset/combined restore in the next approved gate. |
| INFRA18-P2-04 | 18 | OS hygiene | `motd-news.service` has no production dependency but remains failed with `203/EXEC` because its package-owned script is absent. | OPEN | OS owner should repair or intentionally retire the static unit; do not use failure-state reset as remediation. |

`MACROSTEP_18_IMPORTED_LEDGER_FINDINGS_ACCOUNTED_FOR = SIM`

`ALL_NEW_P2_ACCOUNTED_FOR = SIM`

`ALL_NEW_DEFERRED_ACCOUNTED_FOR = SIM`

`TRANSFERRED_WITHOUT_OWNER = 0`

`DEFERRED_WITHOUT_ACCEPTANCE_CONDITION = 0`

## Macrostep 19 disposition (2026-08-31)

| ID | Area | Category | Current state | Finding | Target state | Status | Owner / acceptance condition |
| --- | --- | --- | --- | --- | --- | --- | --- |
| M19-01 | edge privacy | privacy | Cloudflare Google Tag Gateway injected tags before consent | Edge injection bypassed the application consent boundary | GTG disabled; application loader remains consent-gated | IMPLEMENTED | Operations; re-run fresh-browser gate after any edge configuration change |
| M19-02 | analytics payload | privacy | Client and validator accepted identity, raw URLs and arbitrary metadata | New analytics events could persist direct identity and payment-adjacent values | Aggregate allowlisted payload with zero direct PII fields | IMPLEMENTED_IN_CANDIDATE | Engineering; PHP security tests and candidate deployment |
| M19-03 | conversion | correctness | Public browser event list included paid conversion names | Browser signals could be mistaken for billing authority | Billing state is the only paid-conversion authority | IMPLEMENTED_IN_CANDIDATE | Billing/Engineering; validator rejection and billing-state reconciliation |
| M19-04 | attribution | product/legal | UTM ownership and retention were implicit | First/last touch and expiry were not defined | Bounded, consented attribution contract approved by Product/Legal | TRANSFERRED | Product + Legal; explicit retention and attribution decision |
| M19-05 | measurement | product | SPA pageview and marketing destinations are not fully defined | Adding tags without a duplicate policy would create noisy data | One pageview policy and provider-specific dedup contract | TRANSFERRED | Product/Marketing; route-transition test and provider owner |
| M19-06 | legal | compliance | Legal retention/basis review remains pending from Macrostep 17 | Analytics retention cannot be self-authorized | Approved legal basis, retention, and user-rights treatment | OPEN_WITH_OWNER | Legal; Macrostep 17 final review |

`MACROSTEP_19_IMPORTED_LEDGER_FINDINGS_ACCOUNTED_FOR = SIM`
`ALL_NEW_P2_ACCOUNTED_FOR = SIM`
`TRANSFERRED_WITHOUT_OWNER = 0`
`DEFERRED_WITHOUT_ACCEPTANCE_CONDITION = 0`
