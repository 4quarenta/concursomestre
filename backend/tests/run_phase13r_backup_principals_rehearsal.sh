#!/usr/bin/env bash
set -euo pipefail

# Disposable-only MySQL 8.4 rehearsal. It binds to loopback, uses synthetic
# credentials and removes the full runtime on exit.
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
TEST_ROOT="/tmp/cm-phase13r-backup-$$"
MYSQL_VERSION="8.4.11"
MYSQL_HOME="/tmp/mysql-${MYSQL_VERSION}-linux-glibc2.28-x86_64-minimal"
MYSQL_ARCHIVE="/tmp/mysql-${MYSQL_VERSION}-linux-glibc2.28-x86_64-minimal.tar.xz"
MYSQL_CLIENT="${MYSQL_CLIENT_PATH:-/usr/bin/mysql}"
MYSQL_ADMIN="${MYSQL_ADMIN_PATH:-/usr/bin/mysqladmin}"
MYSQL_DUMP="${MYSQL_DUMP_PATH:-/usr/bin/mysqldump}"
MYSQL_PORT="$(shuf -i 22000-29000 -n 1)"
MYSQL_SOCKET="$TEST_ROOT/mysql.sock"
MYSQL_PID="$TEST_ROOT/mysql.pid"
MYSQL_DATA="$TEST_ROOT/data"
DB="phase13r_fixture"

cleanup() {
  set +e
  "$MYSQL_ADMIN" --no-defaults --socket="$MYSQL_SOCKET" -uroot shutdown >/dev/null 2>&1 || true
  if [[ -f "$MYSQL_PID" ]]; then kill "$(cat "$MYSQL_PID")" >/dev/null 2>&1 || true; fi
  rm -rf "$TEST_ROOT"
}
trap cleanup EXIT

if [[ ! -x "$MYSQL_HOME/bin/mysqld" ]]; then
  curl -fsSL "https://cdn.mysql.com/Downloads/MySQL-8.4/$(basename "$MYSQL_ARCHIVE")" -o "$MYSQL_ARCHIVE"
  tar -xJf "$MYSQL_ARCHIVE" -C /tmp
fi

mkdir -p "$TEST_ROOT/backups" "$MYSQL_DATA" "$MYSQL_HOME/runtime-lib"
ln -sfn /lib/x86_64-linux-gnu/libaio.so.1t64 "$MYSQL_HOME/runtime-lib/libaio.so.1"
export LD_LIBRARY_PATH="$MYSQL_HOME/runtime-lib${LD_LIBRARY_PATH:+:$LD_LIBRARY_PATH}"
chown -R mysql:mysql "$TEST_ROOT"
"$MYSQL_HOME/bin/mysqld" --no-defaults --initialize-insecure --user=mysql --datadir="$MYSQL_DATA" >/dev/null 2>&1
"$MYSQL_HOME/bin/mysqld" --no-defaults --user=mysql --datadir="$MYSQL_DATA" \
  --socket="$MYSQL_SOCKET" --port="$MYSQL_PORT" --bind-address=127.0.0.1 \
  --pid-file="$MYSQL_PID" --log-error="$TEST_ROOT/mysql.err" &
for _ in $(seq 1 120); do
  if "$MYSQL_ADMIN" --no-defaults --socket="$MYSQL_SOCKET" -uroot ping >/dev/null 2>&1; then break; fi
  sleep 0.25
done
"$MYSQL_ADMIN" --no-defaults --socket="$MYSQL_SOCKET" -uroot ping >/dev/null

mysql_root() { "$MYSQL_CLIENT" --no-defaults --socket="$MYSQL_SOCKET" -uroot "$@"; }
mysql_user() {
  local user="$1" password="$2"; shift 2
  "$MYSQL_CLIENT" --no-defaults --protocol=tcp --host=127.0.0.1 --port="$MYSQL_PORT" \
    -u"$user" -p"$password" "$@"
}
expect_denied() {
  local user="$1" password="$2" sql="$3"
  set +e
  mysql_user "$user" "$password" "$DB" -e "$sql" >/dev/null 2>&1
  local status=$?
  set -e
  [[ "$status" -ne 0 ]]
}

mysql_root <<SQL
CREATE DATABASE ${DB} CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE TABLE ${DB}.parent (id INT PRIMARY KEY, value_text VARCHAR(60) NOT NULL);
CREATE TABLE ${DB}.child (id INT PRIMARY KEY, parent_id INT NOT NULL,
  CONSTRAINT fk_child_parent FOREIGN KEY (parent_id) REFERENCES parent(id));
CREATE TABLE ${DB}.schema_migrations (
  version VARCHAR(32) PRIMARY KEY, name VARCHAR(190) NOT NULL, checksum CHAR(64) NOT NULL,
  applied_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, execution_ms INT UNSIGNED NULL,
  applied_by VARCHAR(120) NULL
);
INSERT INTO ${DB}.parent VALUES (1, 'baseline');
INSERT INTO ${DB}.child VALUES (1, 1);
CREATE VIEW ${DB}.parent_view AS SELECT id, value_text FROM ${DB}.parent;
CREATE TRIGGER ${DB}.trg_parent_ai AFTER INSERT ON ${DB}.parent FOR EACH ROW SET @phase13r_trigger = NEW.id;
CREATE PROCEDURE ${DB}.phase13r_routine() SELECT COUNT(*) FROM ${DB}.parent;
CREATE EVENT ${DB}.phase13r_event ON SCHEDULE AT CURRENT_TIMESTAMP + INTERVAL 1 DAY DO SET @phase13r_event = 1;
SQL

BACKUP_USER="phase13r_backup"
RUNTIME_USER="phase13r_runtime"
MIGRATION_USER="phase13r_migration"
READONLY_USER="phase13r_readonly"
BACKUP_PASSWORD="phase13r-backup-$RANDOM-$RANDOM"
RUNTIME_PASSWORD="phase13r-runtime-$RANDOM-$RANDOM"
MIGRATION_PASSWORD="phase13r-migration-$RANDOM-$RANDOM"
READONLY_PASSWORD="phase13r-readonly-$RANDOM-$RANDOM"

mysql_root <<SQL
CREATE USER '${BACKUP_USER}'@'127.0.0.1' IDENTIFIED BY '${BACKUP_PASSWORD}';
CREATE USER '${RUNTIME_USER}'@'127.0.0.1' IDENTIFIED BY '${RUNTIME_PASSWORD}';
CREATE USER '${MIGRATION_USER}'@'127.0.0.1' IDENTIFIED BY '${MIGRATION_PASSWORD}';
CREATE USER '${READONLY_USER}'@'127.0.0.1' IDENTIFIED BY '${READONLY_PASSWORD}';
GRANT SELECT, SHOW VIEW, TRIGGER, EVENT ON ${DB}.* TO '${BACKUP_USER}'@'127.0.0.1';
GRANT SHOW_ROUTINE ON *.* TO '${BACKUP_USER}'@'127.0.0.1';
GRANT SELECT, INSERT, UPDATE, DELETE ON ${DB}.* TO '${RUNTIME_USER}'@'127.0.0.1';
GRANT SELECT, INSERT, UPDATE, DELETE, CREATE, ALTER, DROP, INDEX, REFERENCES,
  CREATE VIEW, SHOW VIEW, TRIGGER, EVENT, CREATE ROUTINE, ALTER ROUTINE, EXECUTE,
  CREATE TEMPORARY TABLES, LOCK TABLES ON ${DB}.* TO '${MIGRATION_USER}'@'127.0.0.1';
GRANT SELECT, SHOW VIEW ON ${DB}.* TO '${READONLY_USER}'@'127.0.0.1';
SQL

BACKUP_JSON="$TEST_ROOT/backup.json"
env \
  APP_ENV=test ENV_LOADER_SILENT=1 \
  BACKUP_DB_MODE=dedicated \
  BACKUP_DB_HOST=127.0.0.1 BACKUP_DB_PORT="$MYSQL_PORT" BACKUP_DB_NAME="$DB" \
  BACKUP_DB_USER="$BACKUP_USER" BACKUP_DB_PASSWORD="$BACKUP_PASSWORD" \
  BACKUP_APPLICATION_SHA=38c3925daef9b9f5ca1cd92380eaa1ae0965383c \
  BACKUP_DIR="$TEST_ROOT/backups" BACKUP_DIRECTORY_MODE=0700 BACKUP_FILE_MODE=0600 \
  MYSQLDUMP_PATH="$MYSQL_DUMP" \
  php "$REPO_ROOT/backend/scripts/tasks/backup_mysql.php" > "$BACKUP_JSON"

BACKUP_FILE="$(php -r '$p=json_decode(file_get_contents($argv[1]),true); echo $p["backup_file"] ?? "";' "$BACKUP_JSON")"
[[ -s "$BACKUP_FILE" && -s "$BACKUP_FILE.sha256" && -s "$BACKUP_FILE.manifest.json" ]]
php "$REPO_ROOT/backend/scripts/tasks/verify_mysql_backup.php" --file="$BACKUP_FILE" >/dev/null
php -r '
  $m=json_decode(file_get_contents($argv[1]),true,512,JSON_THROW_ON_ERROR);
  foreach (["application_sha","database_name","db_engine","db_version","table_count","trigger_count","foreign_key_count","migration_applied_count","migration_pending_count","migration_checksum_drift","dump_size","dump_sha256"] as $k) {
    if (!array_key_exists($k,$m) || $m[$k] === null || $m[$k] === "" || $m[$k] === "unknown") exit(2);
  }
' "$BACKUP_FILE.manifest.json"

mysql_root -e "CREATE DATABASE phase13r_restored CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"
mysql_root phase13r_restored < "$BACKUP_FILE"
[[ "$(mysql_root -N -B -e 'SELECT COUNT(*) FROM phase13r_restored.parent')" == "1" ]]
[[ "$(mysql_root -N -B -e "SELECT COUNT(*) FROM information_schema.TRIGGERS WHERE TRIGGER_SCHEMA='phase13r_restored'")" == "1" ]]
[[ "$(mysql_root -N -B -e "SELECT COUNT(*) FROM information_schema.ROUTINES WHERE ROUTINE_SCHEMA='phase13r_restored'")" == "1" ]]

expect_denied "$BACKUP_USER" "$BACKUP_PASSWORD" "INSERT INTO parent VALUES (2, 'denied')"
expect_denied "$BACKUP_USER" "$BACKUP_PASSWORD" "UPDATE parent SET value_text='denied' WHERE id=1"
expect_denied "$BACKUP_USER" "$BACKUP_PASSWORD" "DELETE FROM parent WHERE id=1"
expect_denied "$BACKUP_USER" "$BACKUP_PASSWORD" "CREATE TABLE denied_table(id INT)"
expect_denied "$BACKUP_USER" "$BACKUP_PASSWORD" "ALTER TABLE parent ADD COLUMN denied INT"
expect_denied "$BACKUP_USER" "$BACKUP_PASSWORD" "DROP TABLE parent"
expect_denied "$BACKUP_USER" "$BACKUP_PASSWORD" "GRANT SELECT ON ${DB}.* TO '${READONLY_USER}'@'127.0.0.1'"

mysql_user "$RUNTIME_USER" "$RUNTIME_PASSWORD" "$DB" -e \
  "INSERT INTO parent VALUES (2, 'runtime'); SELECT value_text FROM parent WHERE id=2; UPDATE parent SET value_text='runtime-updated' WHERE id=2; DELETE FROM parent WHERE id=2" >/dev/null
expect_denied "$RUNTIME_USER" "$RUNTIME_PASSWORD" "CREATE TABLE runtime_denied(id INT)"
expect_denied "$RUNTIME_USER" "$RUNTIME_PASSWORD" "GRANT SELECT ON ${DB}.* TO '${READONLY_USER}'@'127.0.0.1'"

mysql_user "$READONLY_USER" "$READONLY_PASSWORD" "$DB" -e "SELECT COUNT(*) FROM parent; SELECT * FROM parent_view" >/dev/null
expect_denied "$READONLY_USER" "$READONLY_PASSWORD" "INSERT INTO parent VALUES (3, 'denied')"

MIGRATION_DIR="$TEST_ROOT/migrations"
mkdir -p "$MIGRATION_DIR"
printf '%s\n' 'CREATE TABLE migration_probe (id INT PRIMARY KEY);' 'INSERT INTO migration_probe VALUES (1);' > "$MIGRATION_DIR/20260830_000000_probe.sql"
env PHASE13R_DSN="mysql:host=127.0.0.1;port=$MYSQL_PORT;dbname=$DB;charset=utf8mb4" \
  PHASE13R_USER="$MIGRATION_USER" PHASE13R_PASSWORD="$MIGRATION_PASSWORD" PHASE13R_MIGRATION_DIR="$MIGRATION_DIR" \
  php -r '
    require $argv[1];
    $pdo=new PDO(getenv("PHASE13R_DSN"),getenv("PHASE13R_USER"),getenv("PHASE13R_PASSWORD"),[PDO::ATTR_ERRMODE=>PDO::ERRMODE_EXCEPTION]);
    $runner=new SchemaMigrationRunner($pdo,getenv("PHASE13R_MIGRATION_DIR"),"phase13r");
    if ($runner->apply() !== ["20260830_000000"]) exit(2);
  ' "$REPO_ROOT/backend/shared/database/SchemaMigrationRunner.php"
expect_denied "$MIGRATION_USER" "$MIGRATION_PASSWORD" "GRANT SELECT ON ${DB}.* TO '${READONLY_USER}'@'127.0.0.1'"

GRANTS="$(mysql_root -N -B -e "SHOW GRANTS FOR '${BACKUP_USER}'@'127.0.0.1'")"
! grep -Eqi 'ALL PRIVILEGES|GRANT OPTION|PROCESS' <<<"$GRANTS"
grep -q 'SHOW_ROUTINE' <<<"$GRANTS"

cp "$BACKUP_FILE" "$TEST_ROOT/missing-checksum.sql"
cp "$BACKUP_FILE.manifest.json" "$TEST_ROOT/missing-checksum.sql.manifest.json"
set +e
php "$REPO_ROOT/backend/scripts/tasks/verify_mysql_backup.php" --file="$TEST_ROOT/missing-checksum.sql" >/dev/null 2>&1
MISSING_STATUS=$?
set -e
[[ "$MISSING_STATUS" -ne 0 ]]

cp "$BACKUP_FILE" "$TEST_ROOT/bad-checksum.sql"
cp "$BACKUP_FILE.sha256" "$TEST_ROOT/bad-checksum.sql.sha256"
cp "$BACKUP_FILE.manifest.json" "$TEST_ROOT/bad-checksum.sql.manifest.json"
printf '%064d  bad-checksum.sql\n' 0 > "$TEST_ROOT/bad-checksum.sql.sha256"
set +e
php "$REPO_ROOT/backend/scripts/tasks/verify_mysql_backup.php" --file="$TEST_ROOT/bad-checksum.sql" >/dev/null 2>&1
BAD_STATUS=$?
set -e
[[ "$BAD_STATUS" -ne 0 ]]

head -c 512 "$BACKUP_FILE" > "$TEST_ROOT/truncated.sql"
cp "$BACKUP_FILE.sha256" "$TEST_ROOT/truncated.sql.sha256"
cp "$BACKUP_FILE.manifest.json" "$TEST_ROOT/truncated.sql.manifest.json"
set +e
php "$REPO_ROOT/backend/scripts/tasks/verify_mysql_backup.php" --file="$TEST_ROOT/truncated.sql" >/dev/null 2>&1
TRUNCATED_STATUS=$?
set -e
[[ "$TRUNCATED_STATUS" -ne 0 ]]

cp "$BACKUP_FILE" "$TEST_ROOT/malformed-manifest.sql"
cp "$BACKUP_FILE.sha256" "$TEST_ROOT/malformed-manifest.sql.sha256"
printf '%s\n' '{malformed' > "$TEST_ROOT/malformed-manifest.sql.manifest.json"
set +e
php "$REPO_ROOT/backend/scripts/tasks/verify_mysql_backup.php" --file="$TEST_ROOT/malformed-manifest.sql" >/dev/null 2>&1
MALFORMED_STATUS=$?
set -e
[[ "$MALFORMED_STATUS" -ne 0 ]]

echo "DEDICATED_BACKUP_CREDENTIAL_BOUNDARY=PASS"
echo "BACKUP_GRANT_CONTRACT=PASS"
echo "SHOW_ROUTINE_REQUIRED=YES"
echo "BACKUP_LEAST_PRIVILEGE_REHEARSAL=PASS"
echo "MANIFEST_SELF_CONTAINED_INVENTORY=PASS"
echo "RUNTIME_LEAST_PRIVILEGE_REHEARSAL=PASS"
echo "MIGRATION_PRINCIPAL_REHEARSAL=PASS"
echo "READONLY_PRINCIPAL_REHEARSAL=PASS"
echo "RECOVERY_FAILURE_CONTRACT=PASS"
