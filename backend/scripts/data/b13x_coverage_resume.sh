#!/usr/bin/env bash
set -Eeuo pipefail

config="${1:?observation env required}"
source "$config"

release_root="$(cd "$(dirname "$0")/../../.." && pwd)"
backend_env="$release_root/backend/.env"
systemd_state="$OPS_ROOT/systemd-freeze-state.json"
nginx_conf=/etc/nginx/sites-enabled/concursomestre.com.conf
cron_file=/etc/cron.d/concursomestre
rollback_root="$OPS_ROOT/coverage-rollback"

test -r "$STATE_FILE"
test -r "$KEY_FILE"
test -r "$backend_env"
test -r "$OPS_ROOT/cron.before-freeze"
test -r "$OPS_ROOT/nginx.conf.before-freeze"
test -r "$systemd_state"
test "$(jq -r '.status // empty' "$STATE_FILE")" = FROZEN
test "$(jq -r '.phase // empty' "$STATE_FILE")" = frozen

expected="$(jq -cS 'del(.signature)' "$STATE_FILE" | openssl dgst -sha256 -hmac "$(cat "$KEY_FILE")" -hex | awk '{print $2}')"
test "$expected" = "$(jq -r '.signature // empty' "$STATE_FILE")"

http_guard="$(jq -r '.httpWriteBoundary.path // empty' "$STATE_FILE")"
install -d -m 0700 "$rollback_root"
cp -pf "$STATE_FILE" "$rollback_root/freeze-state.pre-resume.json"
cp -pf "$cron_file" "$rollback_root/cron.frozen"
cp -pf "$nginx_conf" "$rollback_root/nginx.conf.frozen"
if [[ -n "$http_guard" && -f "$http_guard" ]]; then
  cp -pf "$http_guard" "$rollback_root/http-freeze.conf"
fi

cp -pf "$OPS_ROOT/cron.before-freeze" "$cron_file"
cp -pf "$OPS_ROOT/nginx.conf.before-freeze" "$nginx_conf"
if [[ -n "$http_guard" ]]; then
  rm -f "$http_guard"
fi
nginx -t
systemctl reload nginx

set -a
source "$backend_env"
set +a
php "$release_root/backend/scripts/data/manage_writer_systemd_freeze.php" \
  --mode=resume \
  --run-id="$RUN_ID" \
  --state-file="$systemd_state" \
  --target-kind=PRODUCTION

systemctl disable --now \
  cm-phase13x-strict-window1-monitor.timer \
  cm-phase13x-strict-window1-deadline.timer 2>/dev/null || true
systemctl stop \
  cm-phase13x-strict-window1-monitor.service \
  cm-phase13x-strict-window1-deadline.service 2>/dev/null || true
systemctl reset-failed \
  cm-phase13x-strict-window1-monitor.service \
  cm-phase13x-strict-window1-deadline.service 2>/dev/null || true

jq -cn \
  --arg status PASS \
  --arg phase coverage_validation \
  --arg runId "$RUN_ID" \
  --arg resumedAt "$(date -u +%FT%TZ)" \
  --arg systemdState "$systemd_state" \
  --arg rollbackRoot "$rollback_root" \
  '{status:$status,phase:$phase,runId:$runId,resumedAt:$resumedAt,systemdState:$systemdState,rollbackRoot:$rollbackRoot}'
