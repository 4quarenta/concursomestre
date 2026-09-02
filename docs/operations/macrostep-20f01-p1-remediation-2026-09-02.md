# Macrostep 20F-0.1 - P1 remediation

Date: 2026-09-02
Candidate: `4quarenta/macrostep-20h5-legal-security`

## Scope

This change addresses only the two confirmed P1 findings from Macrostep 20F-0:

1. Cache maintenance actions no longer mutate state through HTTP GET. The client sends `POST` for `clear` and `clean`, and the PHP service rejects every non-POST method before executing either action.
2. Application/runtime schema bootstrapping no longer executes DDL. Runtime paths now assert the provisioned schema through `SchemaReadiness`; schema changes remain in explicit migrations, first-boot provisioning, or the CLI migration runner.

## Runtime DDL inventory

The static gate scans PHP runtime code under `backend/modules`, `backend/config`, and `backend/shared` for `CREATE TABLE`, `ALTER TABLE`, `DROP TABLE`, index DDL, and `ALTER DATABASE`.

Result for runtime paths: `0` findings.

Explicitly excluded and documented as non-request paths:

- `backend/modules/setup/services/SetupService.php`: guarded first-boot provisioning.
- `backend/modules/legal_commentary/schema/LegalCommentarySchemaInstaller.php`: explicit schema installer.
- `backend/shared/database/SchemaMigrationRunner.php`: CLI migration runner.

No runtime DDL was moved into a new hidden path. The temporary-table DDL in the administrative taxonomy synchronization flow was replaced by read-only derived SQL subqueries.

## Verification

- Focused Admin Vitest: passed, 29 tests.
- Full Vitest: passed, 159 files and 928 tests.
- `npm run typecheck`: passed.
- `npm run typecheck:strict`: passed.
- Production build: passed. An existing Turbopack NFT tracing warning remains in `next.config.ts`.
- Focused ESLint: passed with no errors.
- Secret scan: passed.
- Text encoding scan: passed.
- PHP lint for all changed PHP files: passed on PHP 8.4 VPS runtime.
- PHP focused wiring/static gates: passed.
- `git diff --check`: passed.

`typecheck:no-unchecked` remains failing on pre-existing errors across unrelated files; it did not identify the files changed by this remediation.

## Operational invariants

- No application data migration was created or executed.
- No production database DDL/DML was executed by this remediation.
- Launch mode remains PRELAUNCH.
- No deployment, commit, or push is included in this report itself.
