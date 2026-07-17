#!/usr/bin/env bash

set -Eeuo pipefail
SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/lib.sh"
CONFIG_PATH=''
for argument in "$@"; do case "$argument" in --config=*) CONFIG_PATH="${argument#*=}";; *) cm_die "Argumento desconhecido: $argument";; esac; done
[[ -n "$CONFIG_PATH" ]] || cm_die 'Informe --config.'
cm_load_config "$CONFIG_PATH"; cm_require_config_values CM_RELEASES_DIR CM_FRONTEND_LINK
current="$(cm_current_symlink_target "$CM_FRONTEND_LINK")"
printf '%-55s %-8s %-10s %s\n' RELEASE CURRENT VERSION COMMIT
while IFS= read -r directory; do
  manifest="$directory/release-manifest.json"; [[ -f "$manifest" ]] || continue
  marker=''; [[ "$directory" == "$current" ]] && marker='yes'
  printf '%-55s %-8s %-10s %s\n' "$(basename "$directory")" "$marker" \
    "$(cm_json_field "$manifest" version 2>/dev/null || echo '?')" \
    "$(cm_json_field "$manifest" commit 2>/dev/null || echo '?')"
done < <(find "$CM_RELEASES_DIR" -mindepth 1 -maxdepth 1 -type d -print 2>/dev/null | sort -r)
