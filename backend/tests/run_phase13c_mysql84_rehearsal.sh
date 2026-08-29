#!/usr/bin/env bash
set -euo pipefail

# Disposable-only rehearsal. It never reads application credentials or a
# production host and always uses a private local socket with networking off.
ROOT="/tmp/cm-phase13c-mysql84-$$"
MYSQL_VERSION="8.4.11"
MYSQL_HOME="/tmp/mysql-${MYSQL_VERSION}-linux-glibc2.28-x86_64-minimal"
MYSQL_ARCHIVE="/tmp/mysql-${MYSQL_VERSION}-linux-glibc2.28-x86_64-minimal.tar.xz"
MYSQL_CLIENT="${MYSQL_CLIENT_PATH:-/usr/bin/mysql}"
MYSQL_ADMIN="${MYSQL_ADMIN_PATH:-/usr/bin/mysqladmin}"
MYSQL_DUMP="${MYSQL_DUMP_PATH:-/usr/bin/mysqldump}"
MYSQL_BINLOG="${MYSQL_BINLOG_PATH:-/usr/bin/mysqlbinlog}"
ORIGINAL_DATA="$ROOT/original-data"
RESTORED_DATA="$ROOT/restored-data"
RUN="$ROOT/run"
ORIGINAL_SOCKET="$RUN/original.sock"
RESTORED_SOCKET="$RUN/restored.sock"
ORIGINAL_PID="$RUN/original.pid"
RESTORED_PID="$RUN/restored.pid"
LOG_BIN_PREFIX="$ROOT/binlog/concursomestre-bin"
DB="phase13c_pitr_fixture"

cleanup() {
  set +e
  for socket in "$ORIGINAL_SOCKET" "$RESTORED_SOCKET"; do
    "$MYSQL_ADMIN" --no-defaults --socket="$socket" -uroot shutdown >/dev/null 2>&1 || true
  done
  for pidfile in "$ORIGINAL_PID" "$RESTORED_PID"; do
    if [[ -f "$pidfile" ]]; then
      kill "$(cat "$pidfile")" >/dev/null 2>&1 || true
    fi
  done
  rm -rf "$ROOT"
}
trap cleanup EXIT

if [[ ! -x "$MYSQL_HOME/bin/mysqld" ]]; then
  curl -fsSL "https://cdn.mysql.com/Downloads/MySQL-8.4/$(basename "$MYSQL_ARCHIVE")" -o "$MYSQL_ARCHIVE"
  tar -xJf "$MYSQL_ARCHIVE" -C /tmp
fi

mkdir -p "$ROOT/binlog" "$ORIGINAL_DATA" "$RESTORED_DATA" "$RUN" "$ROOT/dumps"
mkdir -p "$MYSQL_HOME/runtime-lib"
ln -sfn /lib/x86_64-linux-gnu/libaio.so.1t64 "$MYSQL_HOME/runtime-lib/libaio.so.1"
export LD_LIBRARY_PATH="$MYSQL_HOME/runtime-lib${LD_LIBRARY_PATH:+:$LD_LIBRARY_PATH}"

start_server() {
  local datadir="$1"
  local socket="$2"
  local pidfile="$3"
  local log_file="$4"
  shift 4
  "$MYSQL_HOME/bin/mysqld" --no-defaults --user=mysql --datadir="$datadir" \
    --socket="$socket" --port=0 --skip-networking --pid-file="$pidfile" \
    --log-error="$log_file" "$@" &
  for _ in $(seq 1 120); do
    if [[ -S "$socket" ]] && "$MYSQL_ADMIN" --no-defaults --socket="$socket" -uroot ping >/dev/null 2>&1; then
      return 0
    fi
    sleep 0.2
  done
  return 1
}

mysql_exec() {
  local socket="$1"
  shift
  "$MYSQL_CLIENT" --no-defaults --socket="$socket" -uroot "$@"
}

chown -R mysql:mysql "$ROOT"
"$MYSQL_HOME/bin/mysqld" --no-defaults --initialize-insecure --user=mysql --datadir="$ORIGINAL_DATA" >/dev/null 2>&1
start_server "$ORIGINAL_DATA" "$ORIGINAL_SOCKET" "$ORIGINAL_PID" "$RUN/original.err" \
  --log-bin="$LOG_BIN_PREFIX" --server-id=130001 --binlog-format=ROW \
  --sync-binlog=1 --innodb-flush-log-at-trx-commit=1 --binlog-expire-logs-seconds=604800 \
  --gtid-mode=OFF --enforce-gtid-consistency=OFF

[[ "$(mysql_exec "$ORIGINAL_SOCKET" -N -B -e 'SELECT @@log_bin')" == '1' ]]
[[ "$(mysql_exec "$ORIGINAL_SOCKET" -N -B -e 'SELECT @@binlog_format')" == 'ROW' ]]
[[ "$(mysql_exec "$ORIGINAL_SOCKET" -N -B -e 'SELECT @@sync_binlog')" == '1' ]]
[[ "$(mysql_exec "$ORIGINAL_SOCKET" -N -B -e 'SELECT @@innodb_flush_log_at_trx_commit')" == '1' ]]
[[ "$(mysql_exec "$ORIGINAL_SOCKET" -N -B -e 'SELECT @@binlog_expire_logs_seconds')" == '604800' ]]
[[ "$(mysql_exec "$ORIGINAL_SOCKET" -N -B -e 'SELECT @@server_id')" == '130001' ]]
[[ "$(mysql_exec "$ORIGINAL_SOCKET" -N -B -e 'SELECT @@gtid_mode')" == 'OFF' ]]

mysql_exec "$ORIGINAL_SOCKET" -e "CREATE DATABASE ${DB}; CREATE TABLE ${DB}.events (id INT PRIMARY KEY, value_text VARCHAR(40) NOT NULL); INSERT INTO ${DB}.events VALUES (1, 'baseline');"
BASELINE_DUMP="$ROOT/dumps/baseline.sql"
"$MYSQL_DUMP" --no-defaults --socket="$ORIGINAL_SOCKET" -uroot --single-transaction "$DB" events > "$BASELINE_DUMP"
MASTER_FILE="$(mysql_exec "$ORIGINAL_SOCKET" -N -B -e 'SHOW BINARY LOG STATUS' | awk 'NR == 1 {print $1}')"
MASTER_POSITION="$(mysql_exec "$ORIGINAL_SOCKET" -N -B -e 'SHOW BINARY LOG STATUS' | awk 'NR == 1 {print $2}')"
if [[ -z "$MASTER_FILE" || -z "$MASTER_POSITION" ]]; then
  echo 'PITR rehearsal failed: missing binlog coordinates.' >&2
  exit 1
fi

mysql_exec "$ORIGINAL_SOCKET" -e "INSERT INTO ${DB}.events VALUES (2, 'after-baseline'); UPDATE ${DB}.events SET value_text = 'after-pitr' WHERE id = 2;"
TARGET_POSITION="$(mysql_exec "$ORIGINAL_SOCKET" -N -B -e 'SHOW BINARY LOG STATUS' | awk 'NR == 1 {print $2}')"
mysql_exec "$ORIGINAL_SOCKET" -e "INSERT INTO ${DB}.events VALUES (3, 'after-target-must-not-replay');"
BINLOG_FILE="$LOG_BIN_PREFIX.$(printf '%06d' "${MASTER_FILE##*.}")"
if [[ ! -f "$BINLOG_FILE" || -z "$TARGET_POSITION" ]]; then
  echo "PITR rehearsal failed: binlog not found at $BINLOG_FILE." >&2
  exit 1
fi

"$MYSQL_ADMIN" --no-defaults --socket="$ORIGINAL_SOCKET" -uroot shutdown
for _ in $(seq 1 60); do
  [[ ! -f "$ORIGINAL_PID" ]] && break
  sleep 0.2
done

chown -R mysql:mysql "$RESTORED_DATA"
"$MYSQL_HOME/bin/mysqld" --no-defaults --initialize-insecure --user=mysql --datadir="$RESTORED_DATA" >/dev/null 2>&1
start_server "$RESTORED_DATA" "$RESTORED_SOCKET" "$RESTORED_PID" "$RUN/restored.err" --skip-log-bin
mysql_exec "$RESTORED_SOCKET" -e "CREATE DATABASE ${DB};"
mysql_exec "$RESTORED_SOCKET" "$DB" < "$BASELINE_DUMP"
"$MYSQL_BINLOG" --no-defaults --start-position="$MASTER_POSITION" --stop-position="$TARGET_POSITION" "$BINLOG_FILE" \
  | "$MYSQL_CLIENT" --no-defaults --socket="$RESTORED_SOCKET" -uroot "$DB"
PITR_ROWS="$(mysql_exec "$RESTORED_SOCKET" -N -B -e "SELECT COUNT(*) FROM ${DB}.events")"
PITR_VALUE="$(mysql_exec "$RESTORED_SOCKET" -N -B -e "SELECT value_text FROM ${DB}.events WHERE id = 2")"
[[ "$PITR_ROWS" == '2' && "$PITR_VALUE" == 'after-pitr' ]]

# Least-privilege check on the disposable original schema only.
TEST_USER="phase13c_ro_runtime"
TEST_PASSWORD="$(od -An -N16 -tx1 /dev/urandom | tr -d ' \n')"
"$MYSQL_CLIENT" --no-defaults --socket="$RESTORED_SOCKET" -uroot -e \
  "CREATE USER '${TEST_USER}'@'localhost' IDENTIFIED BY '${TEST_PASSWORD}'; GRANT SELECT, INSERT, UPDATE, DELETE ON ${DB}.* TO '${TEST_USER}'@'localhost';"
"$MYSQL_CLIENT" --no-defaults --socket="$RESTORED_SOCKET" -u"$TEST_USER" -p"$TEST_PASSWORD" "$DB" \
  -e "INSERT INTO events VALUES (3, 'least-privilege'); SELECT COUNT(*) FROM events;" >/dev/null
set +e
"$MYSQL_CLIENT" --no-defaults --socket="$RESTORED_SOCKET" -u"$TEST_USER" -p"$TEST_PASSWORD" "$DB" \
  -e 'DROP TABLE events' >/dev/null 2>&1
DDL_EXIT=$?
set -e
[[ "$DDL_EXIT" -ne 0 ]]
mysql_exec "$RESTORED_SOCKET" -e "DROP USER '${TEST_USER}'@'localhost';"

echo "PITR_REHEARSAL=PASS"
echo "PITR_BASELINE_POSITION=${MASTER_FILE}:${MASTER_POSITION}"
echo "PITR_TARGET_POSITION=${MASTER_FILE}:${TARGET_POSITION}"
echo "PITR_RESTORED_ROWS=${PITR_ROWS}"
echo "GTID_TARGET=OFF"
echo "PITR_DURABILITY_TARGET=PASS"
echo "LEAST_PRIVILEGE_DDL_DENIED=PASS"
