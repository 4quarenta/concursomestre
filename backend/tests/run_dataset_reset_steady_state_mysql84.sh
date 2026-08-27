#!/usr/bin/env bash
set -euo pipefail

ROOT="/tmp/cm-reset-steady-state-$$"
MYSQL_VERSION="8.4.11"
MYSQL_HOME="/tmp/mysql-${MYSQL_VERSION}-linux-glibc2.28-x86_64-minimal"
MYSQL_ARCHIVE="/tmp/mysql-${MYSQL_VERSION}-linux-glibc2.28-x86_64-minimal.tar.xz"
DATA="$ROOT/data"
RUN="$ROOT/run"
SOCKET="$RUN/mysql.sock"
PIDFILE="$RUN/mysql.pid"
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"

cleanup() {
  set +e
  if [[ -f "$PIDFILE" ]]; then
    kill "$(cat "$PIDFILE")" 2>/dev/null || true
  fi
  for _ in $(seq 1 30); do
    [[ ! -f "$PIDFILE" ]] && break
    sleep 0.2
  done
  rm -rf "$ROOT"
}
trap cleanup EXIT

if [[ ! -x "$MYSQL_HOME/bin/mysqld" ]]; then
  curl -fsSL "https://cdn.mysql.com/Downloads/MySQL-8.4/$(basename "$MYSQL_ARCHIVE")" -o "$MYSQL_ARCHIVE"
  tar -xJf "$MYSQL_ARCHIVE" -C /tmp
fi

mkdir -p "$MYSQL_HOME/runtime-lib"
ln -sfn /lib/x86_64-linux-gnu/libaio.so.1t64 "$MYSQL_HOME/runtime-lib/libaio.so.1"
export LD_LIBRARY_PATH="$MYSQL_HOME/runtime-lib${LD_LIBRARY_PATH:+:$LD_LIBRARY_PATH}"

mkdir -p "$DATA" "$RUN"
chown -R mysql:mysql "$DATA" "$RUN"
"$MYSQL_HOME/bin/mysqld" --no-defaults --initialize-insecure --user=mysql --datadir="$DATA" >/dev/null 2>&1
"$MYSQL_HOME/bin/mysqld" --no-defaults \
  --user=mysql \
  --datadir="$DATA" \
  --socket="$SOCKET" \
  --port=0 \
  --skip-networking \
  --pid-file="$PIDFILE" \
  --log-error="$RUN/mysql.err" \
  --skip-log-bin &

for _ in $(seq 1 100); do
  if [[ -S "$SOCKET" ]] && "$MYSQL_HOME/bin/mysqladmin" --no-defaults --socket="$SOCKET" -uroot ping >/dev/null 2>&1; then
    break
  fi
  sleep 0.2
done
"$MYSQL_HOME/bin/mysqladmin" --no-defaults --socket="$SOCKET" -uroot ping >/dev/null
mysql --no-defaults --socket="$SOCKET" -uroot \
  -e 'CREATE DATABASE reset_steady_state_fixture CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci'

RESET_STEADY_STATE_TEST_MYSQL_DSN="mysql:unix_socket=$SOCKET;dbname=reset_steady_state_fixture;charset=utf8mb4" \
  php "$REPO_ROOT/backend/tests/DatasetResetSteadyStateMysqlIntegrationTest.php"

echo 'ISOLATED_MYSQL84_TEARDOWN_GATE=PASS'
