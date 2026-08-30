# Retrospective Cross-Cutting Audit: Macrosteps 01-15

Date: 2026-08-30
Candidate base: `b4ab179d5ab9bea3a52e070bc6f599be0ec544f4`

The retrospective is frozen by commit `876383cacdaf97c09ab84a3733938eb8707586e2`,
whose parent is the candidate base above. The authoritative fingerprints are:

- Functional files only: `7b20e30e824801dc99dfd850e6f90bbd0068fb3b24d71ba7954e5d3bc856baed`
- Complete commit tree: `af7b6a1dc6cb2ba71d3bc3b026a53cf5cba9ab6ab3de8d0a6b68bba1b595057c`

The earlier values `7994a010ec6cd15ab05e4fcd9476b49fac6c91ac5139beb36783ee5f3c1be637`
and `5046c7517cfbd5debe0b8a2c9d674f113e61c446494108be0dae89e8606d8ab2` are
`LEGACY_NON_CANONICAL` / `AUXILIARY_PRECHECKPOINT_FINGERPRINT` values. They were
computed before the commit with worktree/auxiliary serialization variants and
are not competing authorities.

Fingerprint V1 uses UTF-8 bytewise path ordering, Git blob bytes, serialization
`path UTF-8 + NUL + blob bytes + NUL`, SHA-256, and rename detection disabled.

## Scope

This is a local cleanroom audit of the historical technical record through
Macrostep 15 and the verification blockers discovered in the product/UX audit.
It did not contact or mutate production. Macrostep 13's approved strict-writer
observation was not touched.

## Facts verified in this run

- Node `20.19.5` satisfies the repository engine floor and is explicitly pinned
  for the frontend CI workflow.
- Full Vitest is reproducible after pinning `jsdom` to `26.1.0`: 155 test
  files and 915 tests passed. The old failure was the CJS
  `@asamuzakjp/css-color` to ESM `@csstools/css-calc` dependency boundary, not
  a test assertion failure.
- The official SSR fixture API and local Next server produced 62 equivalent
  desktop/mobile comparisons over 31 routes, with zero semantic and security
  divergence after correcting stale schema expectations to the actual visible
  `WebPage` contracts.
- `release:verify` against the checked-in source manifest remains intentionally
  stale, but the authoritative `release:package` flow regenerates its manifest
  inside a clean package and passed for immutable baseline `b4ab179d`.
- Root and mobile Axios constraints were updated to current compatible 1.x
  releases. The remaining `npm audit` mobile findings are inherited largely from
  Expo 52/React Native 0.76 toolchain packages; the linked `file:..` lock entry
  can still report an old parent Axios version even though the installed mobile
  client resolves Axios 1.20.0.
- `npm run check:secrets`, encoding, generated-artifact, source-size and
  `git diff --check` passed. Source-size debt remains bounded and explicit.
- Root typecheck and clean Next build passed under Node 20.19.5; mobile
  TypeScript validation passed under the same runtime.
- The standard-header checker still reports broad historical omissions in both
  repositories. It is recorded as non-functional tooling debt, not treated as
  evidence of a candidate regression or fixed through a mass-formatting change.
- Static PHP inspection still finds request-time DDL guards across legacy
  repositories. This is a real architecture debt and is retained for
  migration-first removal, rather than being hidden by this audit.

## Interpretation

The Macrostep 15 verification result is no longer blocked by local toolchain,
SSR harness, release-package verification, or the audited label associations.
That does not close operational Production GO gates. In particular, manual
external security gates, Macrostep 13 backup/PITR/least-privilege observation,
real-data validation, and the planned mobile SDK lifecycle upgrade remain
separate decisions.

## Deferred work

All known P2/deferred findings from the available Macrostep 01-15 reports are
classified in [the cross-cutting ledger](cross-cutting-improvement-ledger.md).
The ledger now gives every transferred item an explicit owner, separates
pre-GO synthetic validation from post-GO real-data validation, and does not
claim closure for Macrostep 13 controls that the authoritative operational
record still marks open.

## Candidate files

The candidate contains only the focused remediation set plus this audit record:

- `.github/workflows/frontend-ci.yml`
- `package.json`, `package-lock.json`
- `mobile/package.json`, `mobile/package-lock.json`
- `config/seo/ssr-hydration-baseline.v1.json`
- `src/app/auth/components/Auth.tsx`
- `docs/audit/*`

The audit commit was created and pushed. No deploy, production migration,
production DML, production DDL, or real-data insertion was performed.

## Outcome

```text
RETROSPECTIVE_CROSS_CUTTING_AUDIT_01_15 = PASS
READINESS_AUDIT_01_15 = PASS
IMPROVEMENT_AUDIT_01_15 = COMPLETE
IMPROVEMENT_LEDGER_COMPLETE = SIM
ALL_P2_ACCOUNTED_FOR = SIM
ALL_DEFERRED_ACCOUNTED_FOR = SIM
OPEN_FINDINGS_WITH_COMPLETED_TARGET = 0
TRANSFERRED_WITHOUT_EXPLICIT_OWNER = 0
P2_WITHOUT_STATUS = 0
DEFERRED_WITHOUT_OWNER = 0
REAL_DATA_PRE_GO_CONTRADICTIONS = 0

MACROSTEP_15_READINESS_AUDIT = PASS
MACROSTEP_15_IMPROVEMENT_AUDIT = COMPLETE
PRODUCT_UX_READINESS = PASS
P0_REMAINING = 0
P1_REMAINING = 0
MACROSTEP_15_REMOTE_CHECKPOINT = PASS
MACROSTEP_15_READY_FOR_CONTROLLED_ROLLOUT = SIM
MACROSTEP_15_COMPLETED = NAO

RETROSPECTIVE_01_15_COMMIT_SHA = 876383cacdaf97c09ab84a3733938eb8707586e2
REMOTE_CHECKPOINT = PASS
COMMIT = SIM
PUSH = SIM
DEPLOY = NAO
CURRENT_PRODUCTION_SHA = b4ab179d5ab9bea3a52e070bc6f599be0ec544f4
MACROSTEP_13_OBSERVATION_INTERFERENCE = 0
REAL_DATA_INSERTION_AUTHORIZED = NAO
REAL_DATA_LOADED = NAO
PRODUCTION_GO = NAO
```

`MACROSTEP_13_OBSERVATION_INTERFERENCE = 0`

`REAL_DATA_INSERTION_AUTHORIZED = NAO`
