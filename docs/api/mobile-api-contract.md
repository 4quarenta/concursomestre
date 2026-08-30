# Mobile API Contract

Status: authoritative integration contract for the native ConcursoMestre client.

## Base And Versioning

- Production base: `https://concursomestre.com/api/`.
- The backend has an established unversioned compatibility surface and a focused `v2` question surface. There is no global `/api/v2` contract.
- Native clients use the existing unversioned endpoints for account, profile, and compatibility domains.
- New question list/detail integrations should prefer `v2/questions/list.php` and `v2/questions/show.php`. Answer submission must use `v2/questions/answer.php`.
- An unversioned endpoint is not considered dead merely because a v2 endpoint exists. Removal requires consumer evidence and a separate deprecation decision.

## Native Authentication

Every native request sends:

```http
X-Client-Platform: concursomestre-mobile
```

Authenticated requests additionally send:

```http
Authorization: Bearer <access-token>
```

The native contract is selected only when the platform header is present and the request has no browser `Origin`. A browser cannot use this header to obtain native refresh credentials. Browser authentication remains cookie based and retains its CSRF controls.

The native client stores access, refresh, and CSRF tokens in the operating system secure store. It does not use browser cookies. Refresh is single-flight, rotates both opaque credentials, and replaces the full local token bundle atomically. A reused or revoked refresh token revokes the session family. Refresh failure and logout both clear the local bundle.

### Authentication Endpoints

| Method | Path | Authentication | Notes |
| --- | --- | --- | --- |
| `POST` | `auth/login.php` | Public | May return `require2FA`; native success returns the full token bundle. |
| `POST` | `auth/register.php` | Public | Requires the backend registration fields, including CPF and phone. |
| `POST` | `auth/verify_2fa.php` | Public pending 2FA | Completes the native session. |
| `GET` | `auth/me.php` | Bearer | Returns the current server-resolved account. |
| `POST` | `auth/refresh.php` | Native refresh + CSRF tokens | Rotates credentials; old refresh reuse is rejected. |
| `POST` | `auth/logout.php` | Bearer plus native refresh + CSRF tokens | Revokes the session family. |

## Common Response Envelope

Canonical JSON responses use the shared envelope:

```json
{
  "success": true,
  "message": "Optional human-readable message",
  "data": {}
}
```

Errors use a non-2xx HTTP status and a stable code:

```json
{
  "success": false,
  "message": "Safe human-readable message",
  "error_code": "validation_error"
}
```

Validation details may be present only under the shared debug-safe policy. Production responses do not expose stack traces, SQL messages, filesystem paths, credentials, or raw exceptions. Expected status classes are `400` malformed input, `401` missing/invalid authentication, `403` authenticated but forbidden, `404` missing object, `409` state conflict, `422` field validation, `429` rate limit, and `500/503` server/dependency failure.

## Questions And Practice

| Method | Path | Authentication | Retry | Contract |
| --- | --- | --- | --- | --- |
| `GET` | `v2/questions/list.php` | Optional bearer | Safe | Cursor pagination, maximum 50, public projection. |
| `GET` | `v2/questions/show.php` | Optional bearer | Safe | Public detail projection. |
| `POST` | `v2/questions/answer.php` | Bearer | Idempotent | Requires `questionId`, persisted `selectedAlternativeId`, and `idempotencyKey`. |

The current native UI retains `questionsList` as a bounded compatibility read while its view model remains legacy-shaped. It performs one server-bounded request, never an all-dataset pagination loop. Answer writes use the authoritative v2 boundary.

Public question payloads never include the answer key, correctness flags, correct alternative IDs, teacher commentary, detailed analysis, or equivalent nested fields before the server-authorized disclosure point. The client never computes authoritative correctness.

## Pagination, Filters, And Dates

- V2 question lists use `limit` (1 to 50), opaque `cursor`, `items`, and `pageInfo` (`limit`, `total`, `hasMore`, `nextCursor`).
- Compatibility collections retain their documented `page`/`limit` or `page`/`perPage` contracts and server-side maxima.
- Filter and sort fields are endpoint allowlists. Clients must not send SQL expressions or column names.
- Machine timestamps are ISO-8601 or database timestamps already documented by that compatibility endpoint. New native contracts require ISO-8601 with an explicit timezone; clients must not infer timezone from localized display strings.
- IDs are opaque even when represented as JSON numbers by an existing endpoint.

## Retry And Concurrency

- `GET` requests are safe to retry.
- Authentication refresh is single-flight and rotation-aware.
- Question answers require an idempotency key and bind it to the request hash.
- Billing endpoints are not implicitly retryable. Their complete financial contract belongs to Macrostep 16; the mobile client must not repeat a checkout/finalization write without endpoint-specific evidence.

## Media And Uploads

- Relative public asset paths are resolved against the HTTPS backend origin before native display.
- Production builds contain no localhost API fallback.
- Upload endpoints remain authenticated and server-authorized and enforce their existing MIME, size, extension, and path protections.
- Tokens, local filesystem paths, private attachments, and provider credentials are never media URLs.

## Cache And CORS

- Authenticated API responses use `Cache-Control: no-store, private`.
- Browser CORS uses the configured allowlist and never an authenticated wildcard.
- Native authentication does not depend on CORS as an authorization mechanism.

## Compatibility And Deprecation

The complete static bridge and alias inventory is generated as part of the Macrostep 14 audit. Unversioned endpoints are classified as compatibility surfaces until their web, admin, cron, webhook, and mobile consumers have been proven absent. No endpoint is removed by this contract.
