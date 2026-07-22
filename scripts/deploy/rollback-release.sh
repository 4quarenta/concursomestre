#!/usr/bin/env bash

set -Eeuo pipefail
SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/lib.sh"
CM_DEPLOY_LOG_PREFIX='rollback-release'
CONFIG_PATH=''; TARGET_RELEASE=''; EXECUTE_TOKEN=''
for argument in "$@"; do
  case "$argument" in
    --config=*) CONFIG_PATH="${argument#*=}";; --release=*) TARGET_RELEASE="${argument#*=}";; --execute=*) EXECUTE_TOKEN="${argument#*=}";;
    --help|-h) echo 'rollback-release.sh --config=... --release=<id> [--execute=ROLLBACK_STAGING]'; exit 0;;
    *) cm_die "Argumento desconhecido: $argument";;
  esac
done
[[ -n "$CONFIG_PATH" && -n "$TARGET_RELEASE" ]] || cm_die 'Informe --config e --release.'
cm_load_config "$CONFIG_PATH"
cm_require_config_values CM_ENVIRONMENT CM_RELEASES_DIR CM_FRONTEND_LINK CM_BACKEND_LINK CM_FRONTEND_SERVICE \
  CM_PHP_FPM_SERVICE CM_NGINX_SERVICE CM_DEPLOY_LOCK_FILE CM_WEB_BASE_URL CM_API_BASE_URL
case "$CM_ENVIRONMENT" in staging) expected_token='ROLLBACK_STAGING';; production) expected_token='ROLLBACK_PRODUCTION';; *) cm_die 'Ambiente invalido.';; esac
if [[ -n "$EXECUTE_TOKEN" ]]; then [[ "$EXECUTE_TOKEN" == "$expected_token" ]] || cm_die "Use --execute=$expected_token"; CM_DEPLOY_DRY_RUN='false'; else CM_DEPLOY_DRY_RUN='true'; fi
if ! cm_is_true "$CM_DEPLOY_DRY_RUN"; then [[ "${EUID:-$(id -u)}" -eq 0 ]] || cm_die 'Execucao exige root.'; fi
for command_name in node curl flock systemctl nginx; do cm_require_command "$command_name"; done

if [[ "$TARGET_RELEASE" == /* ]]; then target_dir="$TARGET_RELEASE"; else target_dir="${CM_RELEASES_DIR%/}/$TARGET_RELEASE"; fi
target_dir="$(cm_safe_release_path "$target_dir" "$CM_RELEASES_DIR")"
cm_require_file "$target_dir/release-manifest.json"; cm_require_directory "$target_dir/backend"
(cd "$target_dir" && node scripts/release/verify-release-manifest.mjs)
current_frontend="$(cm_current_symlink_target "$CM_FRONTEND_LINK")"
current_backend_target="$(cm_current_symlink_target "$CM_BACKEND_LINK")"; current_backend=''; [[ -z "$current_backend_target" ]] || current_backend="$(dirname "$current_backend_target")"
cm_log "Rollback de codigo: ${current_frontend:-nenhum} -> $target_dir"
cm_log 'O banco nao sera restaurado; confirme compatibilidade forward antes da execucao.'
if cm_is_true "$CM_DEPLOY_DRY_RUN"; then cm_log "PASS: repita com --execute=$expected_token."; exit 0; fi

cm_acquire_lock "$CM_DEPLOY_LOCK_FILE"
restore_current() {
  local code=$?
  [[ -z "$current_frontend" ]] || cm_atomic_symlink "$current_frontend" "$CM_FRONTEND_LINK" || true
  [[ -z "$current_backend" ]] || cm_atomic_symlink "$current_backend/backend" "$CM_BACKEND_LINK" || true
  exit "$code"
}
trap restore_current ERR INT TERM
cm_atomic_symlink "$target_dir/backend" "$CM_BACKEND_LINK"; cm_atomic_symlink "$target_dir" "$CM_FRONTEND_LINK"
cm_run nginx -t
cm_service_action restart "$CM_PHP_FPM_SERVICE"; cm_service_action restart "$CM_FRONTEND_SERVICE"; cm_service_action reload "$CM_NGINX_SERVICE"
timeout="${CM_SMOKE_TIMEOUT_SECONDS:-15}"
cm_http_expect_success "${CM_API_BASE_URL%/}/system/health.php" "$timeout"
cm_http_expect_success "${CM_API_BASE_URL%/}/system/readiness.php" "$timeout"
cm_http_expect_success "${CM_WEB_BASE_URL%/}/" "$timeout"
trap - ERR INT TERM
cm_log "ROLLBACK DE CODIGO PASS: $(basename "$target_dir")"
