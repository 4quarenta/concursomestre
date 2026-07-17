#!/usr/bin/env bash

set -Eeuo pipefail
SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=./lib.sh
source "$SCRIPT_DIR/lib.sh"
CM_DEPLOY_LOG_PREFIX='verify-host'

CONFIG_PATH=''; ARCHIVE_PATH=''; EXPECTED_SHA256=''
for argument in "$@"; do
  case "$argument" in
    --config=*) CONFIG_PATH="${argument#*=}";;
    --archive=*) ARCHIVE_PATH="${argument#*=}";;
    --sha256=*) EXPECTED_SHA256="${argument#*=}";;
    --help|-h) echo 'verify-host.sh --config=... [--archive=... --sha256=...]'; exit 0;;
    *) cm_die "Argumento desconhecido: $argument";;
  esac
done

[[ -n "$CONFIG_PATH" ]] || cm_die 'Informe --config.'
cm_load_config "$CONFIG_PATH"
cm_require_config_values CM_ENVIRONMENT CM_RELEASES_DIR CM_FRONTEND_LINK CM_BACKEND_LINK CM_SHARED_DIR \
  CM_FRONTEND_ENV_SOURCE CM_BACKEND_ENV_SOURCE CM_FRONTEND_SERVICE CM_PHP_FPM_SERVICE \
  CM_WEB_BASE_URL CM_API_BASE_URL CM_APP_GROUP
for command_name in bash node npm php unzip rsync curl flock systemctl nginx; do cm_require_command "$command_name"; done

node_major="$(node -p 'Number(process.versions.node.split(".")[0])')"
(( node_major >= 20 )) || cm_die "Node.js 20+ obrigatorio: $(node --version)"
php_version_id="$(php -r 'echo PHP_VERSION_ID;')"
(( php_version_id >= 80200 )) || cm_die "PHP 8.2+ obrigatorio: $(php -r 'echo PHP_VERSION;')"
cm_assert_secret_file_permissions "$CM_BACKEND_ENV_SOURCE"
cm_require_file "$CM_FRONTEND_ENV_SOURCE"
[[ "$CM_WEB_BASE_URL" =~ ^https:// && "$CM_API_BASE_URL" =~ ^https:// ]] || cm_die 'URLs devem usar HTTPS.'
case "$CM_ENVIRONMENT" in staging|production) ;; *) cm_die 'CM_ENVIRONMENT deve ser staging ou production.';; esac

if [[ -n "$ARCHIVE_PATH" ]]; then
  cm_require_file "$ARCHIVE_PATH"
  actual_sha256="$(cm_sha256 "$ARCHIVE_PATH")"
  [[ -z "$EXPECTED_SHA256" || "$actual_sha256" == "$EXPECTED_SHA256" ]] || cm_die 'Checksum do ZIP divergente.'
  cm_log "ZIP verificado: $actual_sha256"
fi
cm_log "PASS: ambiente=$CM_ENVIRONMENT node=$(node --version) php=$(php -r 'echo PHP_VERSION;')"
