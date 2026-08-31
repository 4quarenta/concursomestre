# Production External Monitor

This monitor is intentionally hosted in GitHub Actions rather than on the
production VPS. It performs public, read-only HTTPS probes and has only
`contents: read` permissions. It contains no SSH key, database credential,
provider credential or deployment step.

The expected PRELAUNCH contract is:

- `/` returns HTTP 200 and contains the public main element;
- `/api/system/health.php` returns HTTP 200 with liveness `ok`;
- `/api/system/readiness.php` returns HTTP 200 with `ready=true`;
- `/sitemap.xml` returns HTTP 503 with `X-Robots-Tag: noindex, nofollow`.

The workflow also exercises a local mock failure path so that host-loss
detection is not dependent on taking production offline. A real run and alert
receipt must still be recorded by the operations owner after this workflow is
placed on the repository default branch.
