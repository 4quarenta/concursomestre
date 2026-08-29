# Production backup contract

The single production scheduler remains:

```text
20 2 * * * concursomestre /home/concursomestre/bin/cm-cron mysql-backup
```

The wrapper continues to execute the current release's
`backend/scripts/tasks/backup_mysql.php`. Before deploying this boundary, the
operator installs `/etc/concursomestre/backup-db.env` from
`backup-db.env.example`, owned by root and mode `0600`. The populated file is
never placed in Git, a command line, cron, a report, or the release directory.

`BACKUP_DB_MODE=dedicated` is the default. Missing or incomplete dedicated
configuration fails closed. Runtime credential reuse is available only for
explicit non-production compatibility with both:

```text
BACKUP_DB_MODE=runtime_compat
BACKUP_ALLOW_RUNTIME_FALLBACK=true
```

The 13-X rollout installs and validates the secret file before switching the
release, then executes the same `cm-cron mysql-backup` entrypoint manually.
There must be exactly one active scheduler.
