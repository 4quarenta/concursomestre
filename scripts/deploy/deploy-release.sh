#!/usr/bin/env bash

set -Eeuo pipefail
SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/lib.sh"
CM_DEPLOY_LOG_PREFIX='deploy-release'

CONFIG_PATH=''; ARCHIVE_PATH=''; EXPECTED_SHA256=''; EXECUTE_TOKEN=''; APPLY_MIGRATIONS='false'; MIGRATION_TOKEN=''
for argument in "$@"; do
  case "$argument" in
    --config=*) CONFIG_PATH="${argument#*=}";; --archive=*) ARCHIVE_PATH="${argument#*=}";;
    --sha256=*) EXPECTED_SHA256="${argument#*=}";; --execute=*) EXECUTE_TOKEN="${argument#*=}";;
    --apply-migrations=*) APPLY_MIGRATIONS="${argument#*=}";; --migration-token=*) MIGRATION_TOKEN="${argument#*=}";;
    --help|-h) echo 'deploy-release.sh --config=... --archive=... [--sha256=... --execute=DEPLOY_STAGING]'; exit 0;;
    *) cm_die "Argumento desconhecido: $argument";;
  esac
done
[[ -n "$CONFIG_PATH" && -n "$ARCHIVE_PATH" ]] || cm_die 'Informe --config e --archive.'
cm_load_config "$CONFIG_PATH"
cm_require_config_values CM_ENVIRONMENT CM_RELEASES_DIR CM_FRONTEND_LINK CM_BACKEND_LINK CM_SHARED_DIR \
  CM_FRONTEND_ENV_SOURCE CM_BACKEND_ENV_SOURCE CM_FRONTEND_SERVICE CM_PHP_FPM_SERVICE CM_NGINX_SERVICE \
  CM_APP_GROUP CM_DEPLOY_LOCK_FILE CM_DEPLOY_STATE_DIR CM_WEB_BASE_URL CM_API_BASE_URL

case "$CM_ENVIRONMENT" in staging) expected_token='DEPLOY_STAGING';; production) expected_token='DEPLOY_PRODUCTION';; *) cm_die 'Ambiente invalido.';; esac
if [[ -n "$EXECUTE_TOKEN" ]]; then [[ "$EXECUTE_TOKEN" == "$expected_token" ]] || cm_die "Use --execute=$expected_token"; CM_DEPLOY_DRY_RUN='false'; else CM_DEPLOY_DRY_RUN='true'; fi
if cm_is_true "$APPLY_MIGRATIONS"; then [[ "$MIGRATION_TOKEN" == 'APPLY_ADDITIVE_MIGRATIONS' ]] || cm_die 'Migrations exigem token explicito.'; fi
if ! cm_is_true "$CM_DEPLOY_DRY_RUN"; then [[ "${EUID:-$(id -u)}" -eq 0 ]] || cm_die 'Execucao exige root.'; [[ -n "$EXPECTED_SHA256" ]] || cm_die 'Execucao exige --sha256.'; fi

for command_name in node npm php composer unzip rsync curl flock systemctl nginx; do cm_require_command "$command_name"; done
actual_sha256="$(cm_sha256 "$ARCHIVE_PATH")"
[[ -z "$EXPECTED_SHA256" || "$actual_sha256" == "$EXPECTED_SHA256" ]] || cm_die 'Checksum divergente.'
"$SCRIPT_DIR/verify-host.sh" --config="$CONFIG_PATH" --archive="$ARCHIVE_PATH" --sha256="$actual_sha256"

work_dir="$(mktemp -d)"; release_dir=''; switched='false'; previous_frontend=''; previous_backend=''
cleanup() { rm -rf "$work_dir"; }
restore_on_error() {
  local code=$?
  if [[ "$switched" == 'true' ]] && ! cm_is_true "$CM_DEPLOY_DRY_RUN"; then
    cm_log 'Falha apos a troca; restaurando somente os symlinks de codigo.'
    [[ -z "$previous_frontend" ]] || cm_atomic_symlink "$previous_frontend" "$CM_FRONTEND_LINK" || true
    [[ -z "$previous_backend" ]] || cm_atomic_symlink "$previous_backend/backend" "$CM_BACKEND_LINK" || true
    systemctl restart "$CM_PHP_FPM_SERVICE" >/dev/null 2>&1 || true
    systemctl restart "$CM_FRONTEND_SERVICE" >/dev/null 2>&1 || true
  fi
  cleanup; exit "$code"
}
trap restore_on_error ERR INT TERM
trap cleanup EXIT

unzip -q "$ARCHIVE_PATH" -d "$work_dir/extracted"
package_root="$(cm_find_package_root "$work_dir/extracted")"
(cd "$package_root" && node scripts/checks/check-release-package.mjs)
manifest="$package_root/release-manifest.json"
version="$(cm_json_field "$manifest" version)"; commit="$(cm_json_field "$manifest" commit)"; revision="$(cm_json_field "$manifest" revision)"
release_id="${version}-${revision}-${commit:0:12}-$(date -u +%Y%m%d%H%M%S)"
release_id="$(printf '%s' "$release_id" | tr -cs 'A-Za-z0-9._-' '-')"
release_dir="${CM_RELEASES_DIR%/}/$release_id"
cm_log "Plano: $release_dir; migrations=$APPLY_MIGRATIONS; sha256=$actual_sha256"
if cm_is_true "$CM_DEPLOY_DRY_RUN"; then cm_log "PASS: repita com --execute=$expected_token para executar."; exit 0; fi

cm_acquire_lock "$CM_DEPLOY_LOCK_FILE"
[[ ! -e "$release_dir" ]] || cm_die 'Release ja existe.'
install -d -m 0750 -o root -g "$CM_APP_GROUP" "$CM_RELEASES_DIR" "$CM_SHARED_DIR" "$CM_DEPLOY_STATE_DIR" "$release_dir"
install -d -m 0770 -o root -g "$CM_APP_GROUP" "$CM_SHARED_DIR/backend/storage" "$CM_SHARED_DIR/backend/uploads"
rsync -a --delete "$package_root/" "$release_dir/"
rsync -a --ignore-existing "$release_dir/backend/storage/" "$CM_SHARED_DIR/backend/storage/" || true
rsync -a --ignore-existing "$release_dir/backend/uploads/" "$CM_SHARED_DIR/backend/uploads/" || true
rm -rf "$release_dir/backend/storage" "$release_dir/backend/uploads"
ln -s "$CM_SHARED_DIR/backend/storage" "$release_dir/backend/storage"
ln -s "$CM_SHARED_DIR/backend/uploads" "$release_dir/backend/uploads"
ln -s "$CM_FRONTEND_ENV_SOURCE" "$release_dir/.env.production"
ln -s "$CM_BACKEND_ENV_SOURCE" "$release_dir/backend/.env"

cm_run composer install --working-dir="$release_dir/backend" --no-dev --prefer-dist --no-interaction --no-progress --classmap-authoritative
cm_run_in "$release_dir" npm ci --no-audit --no-fund
cm_run_in "$release_dir" npm run build
cm_run php "$release_dir/backend/scripts/migrations/run_schema_migrations.php" --dry-run

if cm_is_true "$APPLY_MIGRATIONS"; then
  cm_log 'Aplicando somente migrations aditivas apos backup operacional externo confirmado.'
  if [[ "$CM_ENVIRONMENT" == 'production' ]]; then
    cm_run env APP_ENV=production MIGRATIONS_ALLOW_APPLY=true MIGRATIONS_ALLOW_PRODUCTION=true php "$release_dir/backend/scripts/migrations/run_schema_migrations.php" --apply
  else
    cm_run env MIGRATIONS_ALLOW_APPLY=true php "$release_dir/backend/scripts/migrations/run_schema_migrations.php" --apply
  fi
fi
cm_run php "$release_dir/backend/scripts/tasks/production_preflight.php"

previous_frontend="$(cm_current_symlink_target "$CM_FRONTEND_LINK")"
previous_backend_target="$(cm_current_symlink_target "$CM_BACKEND_LINK")"; [[ -z "$previous_backend_target" ]] || previous_backend="$(dirname "$previous_backend_target")"
cm_atomic_symlink "$release_dir/backend" "$CM_BACKEND_LINK"; cm_atomic_symlink "$release_dir" "$CM_FRONTEND_LINK"; switched='true'
cm_run nginx -t
cm_service_action restart "$CM_PHP_FPM_SERVICE"; cm_service_action restart "$CM_FRONTEND_SERVICE"; cm_service_action reload "$CM_NGINX_SERVICE"
timeout="${CM_SMOKE_TIMEOUT_SECONDS:-15}"
cm_http_expect_success "${CM_API_BASE_URL%/}/system/health.php" "$timeout"
cm_http_expect_success "${CM_API_BASE_URL%/}/system/readiness.php" "$timeout"
cm_http_expect_success "${CM_WEB_BASE_URL%/}/" "$timeout"

state_file="$CM_DEPLOY_STATE_DIR/current.json"
node - "$state_file" "$release_id" "$release_dir" "$previous_frontend" "$previous_backend" "$actual_sha256" <<'NODE'
const fs = require('node:fs');
const [file, releaseId, releaseDir, previousFrontend, previousBackend, sha256] = process.argv.slice(2);
fs.writeFileSync(file, `${JSON.stringify({ releaseId, releaseDir, previousFrontend: previousFrontend || null, previousBackend: previousBackend || null, artifactSha256: sha256, deployedAt: new Date().toISOString() }, null, 2)}\n`, { mode: 0o640 });
NODE
switched='false'; cm_log "DEPLOY PASS: $release_id"
