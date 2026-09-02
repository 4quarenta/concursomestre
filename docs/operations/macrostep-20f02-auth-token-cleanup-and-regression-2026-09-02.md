# Macrostep 20F-0.2 - Auth token cleanup and regression

## Scope and result

This report records the controlled PRELAUNCH remediation completed on 2026-09-02. It does not certify the separate, still incomplete, function-by-function Admin audit.

| Item | Result |
| --- | --- |
| Active production release | `d6308a174e2d0c9e096f8ae498e79142d5cd404c` |
| Launch mode | `PRELAUNCH` preserved |
| Production migrations in this remediation | `0` |
| Real-data insertions | `0` |
| Stripe LIVE mutations | `0` |
| Home / health / readiness | `200 / 200 / 200` |
| Public sitemap | `503`, `X-Robots-Tag: noindex, nofollow` |

## Refresh-token finding

The historical count of 419 refresh-token rows for two controlled accounts was not, by itself, evidence that obsolete tokens were concurrently usable. The auth model persists a new token on refresh, links rotations, invalidates the predecessor, and performs reuse detection. Browser bootstrap and route traversal call the refresh endpoint repeatedly; this explains the observed high row count as **`EXPECTED_TOKEN_ROTATION + TEST_AUTOMATION_BEHAVIOR`**.

The historical per-token metadata was intentionally removed by the canonical cleanup, so this classification is based on the implemented lifecycle and the controlled browser observations, not on a reconstructed sample of deleted token hashes.

| Security question | Result |
| --- | --- |
| Old refresh token remains active after a successful rotation | No; source contract revokes/replaces it |
| Reuse detection exists | Yes |
| Rotation is persisted with predecessor/successor linkage | Yes |
| Active usable orphan refresh tokens after cleanup | `0` |
| Refresh-token security | `PASS` |

## Cross-tab regression

### Finding

The server-side Admin route check previously depended on the rotating `cm_refresh` cookie. During client bootstrap, a parallel refresh could invalidate the old cookie before another tab reached the route check. The resulting `404` was fail-closed but user-visible.

### Remediation

Commit `d6308a17` adds `cm_route_session`, an HttpOnly, Secure, SameSite session-anchor cookie. It contains only the opaque UUID of the already-persisted auth session. The Admin route endpoint validates that session against `auth_sessions` and `users` for active status, revocation, expiry, deletion state, and `admin`/`staff` role. It is not a bearer credential for API calls.

The cookie is issued on login and refresh, and cleared on logout. The old refresh-cookie validation remains only as a temporary compatibility path for already-authenticated browsers that have not yet refreshed.

| Browser evidence | Result |
| --- | --- |
| Admin login | `200` |
| Immediate Admin route check | `204` |
| Same-tab Admin navigation | `200` |
| Same-context second tab | `200` |
| Restored browser context | `200` |
| Staff immediate route check | `204` |
| Staff permitted route | `200` |
| Staff forbidden dashboard | redirected to permitted operation route |
| Logout | `200` |
| Admin route check after logout | `404` |
| Route-session cookie after logout | absent |

## Controlled fixture cleanup

Only records identified by `macro20f02-%@example.invalid` were affected. No product/content rows, settings, migrations, or Stripe data were changed.

| Synthetic residue | Before cleanup | Deleted | Remaining |
| --- | ---: | ---: | ---: |
| Controlled accounts | 2 | 2 | 0 |
| Auth sessions | 11 | 11 | 0 |
| Refresh tokens | 51 | 51 | 0 |
| Other FK-backed fixture rows | 0 | 0 | 0 |

Six attributable `admin_audit_logs` rows were preserved under the security-audit retention contract. They are documented audit evidence, not unresolved operational data. The temporary local and VPS credential files were removed after account cleanup.

## Regression checks

| Gate | Result |
| --- | --- |
| PHP parser check for all changed PHP files | `PASS` |
| `AdminRouteAccessWiringTest` source assertions | included in commit |
| `adminRouting.test.ts` | `7/7 PASS` |
| Versioned secret scan | `PASS` |
| Release package validation | `PASS` |
| Official deploy dry-run | `PASS` |
| Official atomic PRELAUNCH deploy | `PASS` |
| Production readiness after deploy | `ready`, zero pending migrations, zero checksum drift |

## Explicit boundary

This report closes the auth/session regression and its controlled cleanup only. It does **not** claim that all Admin pages, meaningful functions, standalone editors, mobile paths, or Stripe TEST workflows have been audited function by function.
