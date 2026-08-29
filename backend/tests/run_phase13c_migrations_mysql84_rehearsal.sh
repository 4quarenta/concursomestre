#!/usr/bin/env bash
set -euo pipefail

# Disposable schema rehearsal only. Production credentials and hosts are not
# read, and no application schema is touched.
ROOT="/tmp/cm-phase13c-migrations-$$"
MYSQL_VERSION="8.4.11"
MYSQL_HOME="/tmp/mysql-${MYSQL_VERSION}-linux-glibc2.28-x86_64-minimal"
MYSQL_ARCHIVE="/tmp/mysql-${MYSQL_VERSION}-linux-glibc2.28-x86_64-minimal.tar.xz"
MYSQL_CLIENT="${MYSQL_CLIENT_PATH:-/usr/bin/mysql}"
MYSQL_ADMIN="${MYSQL_ADMIN_PATH:-/usr/bin/mysqladmin}"
DATA="$ROOT/data"
RUN="$ROOT/run"
SOCKET="$RUN/mysql.sock"
PIDFILE="$RUN/mysql.pid"
DB="phase13c_migration_fixture"
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"

cleanup() {
  set +e
  "$MYSQL_ADMIN" --no-defaults --socket="$SOCKET" -uroot shutdown >/dev/null 2>&1 || true
  if [[ -f "$PIDFILE" ]]; then kill "$(cat "$PIDFILE")" >/dev/null 2>&1 || true; fi
  rm -rf "$ROOT"
}
trap cleanup EXIT

if [[ ! -x "$MYSQL_HOME/bin/mysqld" ]]; then
  curl -fsSL "https://cdn.mysql.com/Downloads/MySQL-8.4/$(basename "$MYSQL_ARCHIVE")" -o "$MYSQL_ARCHIVE"
  tar -xJf "$MYSQL_ARCHIVE" -C /tmp
fi
mkdir -p "$MYSQL_HOME/runtime-lib" "$DATA" "$RUN"
ln -sfn /lib/x86_64-linux-gnu/libaio.so.1t64 "$MYSQL_HOME/runtime-lib/libaio.so.1"
export LD_LIBRARY_PATH="$MYSQL_HOME/runtime-lib${LD_LIBRARY_PATH:+:$LD_LIBRARY_PATH}"
chown -R mysql:mysql "$ROOT"
"$MYSQL_HOME/bin/mysqld" --no-defaults --initialize-insecure --user=mysql --datadir="$DATA" >/dev/null 2>&1
"$MYSQL_HOME/bin/mysqld" --no-defaults --user=mysql --datadir="$DATA" --socket="$SOCKET" \
  --port=0 --skip-networking --skip-log-bin --pid-file="$PIDFILE" --log-error="$RUN/mysql.err" &
for _ in $(seq 1 120); do
  if [[ -S "$SOCKET" ]] && "$MYSQL_ADMIN" --no-defaults --socket="$SOCKET" -uroot ping >/dev/null 2>&1; then break; fi
  sleep 0.2
done
"$MYSQL_ADMIN" --no-defaults --socket="$SOCKET" -uroot ping >/dev/null

"$MYSQL_CLIENT" --no-defaults --socket="$SOCKET" -uroot <<SQL
CREATE DATABASE ${DB} CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE ${DB};
CREATE TABLE filters (id INT AUTO_INCREMENT PRIMARY KEY, type VARCHAR(40) NOT NULL, name VARCHAR(255) NOT NULL, slug VARCHAR(255) NOT NULL, UNIQUE KEY unique_type_slug (type, slug)) ENGINE=InnoDB;
CREATE TABLE provas (id INT AUTO_INCREMENT PRIMARY KEY, nome VARCHAR(255) NOT NULL, slug VARCHAR(255) NOT NULL, ano INT NOT NULL) ENGINE=InnoDB;
CREATE TABLE questions (id INT AUTO_INCREMENT PRIMARY KEY, enunciado TEXT NOT NULL) ENGINE=InnoDB;
CREATE TABLE materials (id VARCHAR(36) PRIMARY KEY, author_id VARCHAR(36) NOT NULL, title VARCHAR(255) NOT NULL, description TEXT, price DECIMAL(10,2) NOT NULL DEFAULT 0, type VARCHAR(40) NOT NULL, cover_url VARCHAR(500) NULL, preview_url VARCHAR(500) NULL, status VARCHAR(40) NOT NULL DEFAULT 'pending', created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP) ENGINE=InnoDB;
SQL

cat > "$ROOT/rehearse.php" <<'PHP'
<?php
declare(strict_types=1);
$socket = (string) getenv('REHEARSAL_SOCKET');
$dbName = (string) getenv('REHEARSAL_DB');
$repoRoot = (string) getenv('REHEARSAL_REPO');
require $repoRoot . '/backend/shared/database/SchemaMigrationRunner.php';
$db = new PDO('mysql:unix_socket=' . $socket . ';dbname=' . $dbName . ';charset=utf8mb4', 'root', '', [
    PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
]);
$runner = new SchemaMigrationRunner($db, $repoRoot . '/backend/database/migrations', 'phase13c-rehearsal');
$runner->baselineLegacy();
$wanted = [
    '20260819_120000',
    '20260819_130000',
    '20260821_120000',
    '20260829_120000',
];
$applied = [];
foreach ($wanted as $baseVersion) {
    $match = array_values(array_filter($runner->discoverMigrations(), static fn (array $m): bool => $m['base_version'] === $baseVersion));
    if (count($match) !== 1) {
        throw new RuntimeException('Migration nao encontrada de forma univoca: ' . $baseVersion);
    }
    $applied = [...$applied, ...$runner->apply((string) $match[0]['version'])];
}
$expectedTables = [
    'contests', 'contest_organizations', 'contest_positions', 'contest_exams', 'contest_documents', 'contest_aliases',
    'public_simulations', 'public_simulation_questions', 'public_simulation_filters', 'public_simulation_contests', 'public_simulation_exams', 'public_simulation_aliases',
    'material_aliases',
];
$tableCheck = $db->prepare('SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = :table');
foreach ($expectedTables as $table) {
    $tableCheck->execute([':table' => $table]);
    if ((int) $tableCheck->fetchColumn() !== 1) throw new RuntimeException('Tabela ausente: ' . $table);
}
$unique = $db->query("SELECT NON_UNIQUE FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'provas' AND INDEX_NAME = 'uq_provas_slug' LIMIT 1")->fetchColumn();
if ((int) $unique !== 0) throw new RuntimeException('Indice uq_provas_slug nao e UNIQUE.');
$audit = $runner->audit();
if (($audit['codes']['CHECKSUM_DRIFT'] ?? 1) !== 0) throw new RuntimeException('Checksum drift na rehearsal.');
echo json_encode(['applied' => $applied, 'tables_checked' => count($expectedTables), 'slug_unique' => true], JSON_THROW_ON_ERROR) . PHP_EOL;
PHP

REHEARSAL_SOCKET="$SOCKET" REHEARSAL_DB="$DB" REHEARSAL_REPO="$REPO_ROOT" \
  php "$ROOT/rehearse.php"
