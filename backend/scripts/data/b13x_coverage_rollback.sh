#!/usr/bin/env bash
set -Eeuo pipefail

config="${1:?observation env required}"
source "$config"

release_root="$(cd "$(dirname "$0")/../../.." && pwd)"
backend_env="$release_root/backend/.env"
nginx_conf=/etc/nginx/sites-enabled/concursomestre.com.conf
cron_file=/etc/cron.d/concursomestre
rollback_root="$OPS_ROOT/coverage-rollback"
rollback_state="$rollback_root/systemd-freeze-rollback-state.json"
rollback_run_id="${RUN_ID}-coverage-rollback-$(date -u +%Y%m%dT%H%M%SZ)"

test -r "$backend_env"
test -r "$rollback_root/cron.frozen"
test -r "$rollback_root/nginx.conf.frozen"
test -r "$rollback_root/freeze-state.pre-resume.json"

http_guard="$(jq -r '.httpWriteBoundary.path // empty' "$rollback_root/freeze-state.pre-resume.json")"
cp -pf "$rollback_root/cron.frozen" "$cron_file"
cp -pf "$rollback_root/nginx.conf.frozen" "$nginx_conf"
if [[ -n "$http_guard" && -f "$rollback_root/http-freeze.conf" ]]; then
  install -d -m 0755 "$(dirname "$http_guard")"
  cp -pf "$rollback_root/http-freeze.conf" "$http_guard"
fi
nginx -t
systemctl reload nginx

set -a
source "$backend_env"
set +a
php "$release_root/backend/scripts/data/manage_writer_systemd_freeze.php" \
  --mode=freeze \
  --run-id="$rollback_run_id" \
  --state-file="$rollback_state" \
  --target-kind=PRODUCTION

jq -cn \
  --arg status PASS \
  --arg rollbackRunId "$rollback_run_id" \
  --arg rollbackState "$rollback_state" \
  --arg rolledBackAt "$(date -u +%FT%TZ)" \
  '{status:$status,rollbackRunId:$rollbackRunId,rollbackState:$rollbackState,rolledBackAt:$rolledBackAt}'
