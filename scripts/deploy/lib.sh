#!/usr/bin/env bash

set -Eeuo pipefail
IFS=$'\n\t'
umask 027

CM_DEPLOY_DRY_RUN="${CM_DEPLOY_DRY_RUN:-true}"
CM_DEPLOY_LOG_PREFIX="${CM_DEPLOY_LOG_PREFIX:-deploy}"

cm_log() { printf '[%s] [%s] %s\n' "$(date -u +'%Y-%m-%dT%H:%M:%SZ')" "$CM_DEPLOY_LOG_PREFIX" "$*" >&2; }
cm_die() { cm_log "ERRO: $*"; exit 1; }
cm_is_true() { case "${1:-}" in 1|true|TRUE|yes|YES|on|ON) return 0;; *) return 1;; esac; }
cm_require_command() { command -v "$1" >/dev/null 2>&1 || cm_die "Comando obrigatorio ausente: $1"; }
cm_require_file() { [[ -f "$1" ]] || cm_die "Arquivo obrigatorio ausente: $1"; }
cm_require_directory() { [[ -d "$1" ]] || cm_die "Diretorio obrigatorio ausente: $1"; }

cm_run() {
  if cm_is_true "$CM_DEPLOY_DRY_RUN"; then
    printf '[dry-run]' >&2; printf ' %q' "$@" >&2; printf '\n' >&2; return 0
  fi
  "$@"
}

cm_run_in() {
  local directory="$1"; shift
  if cm_is_true "$CM_DEPLOY_DRY_RUN"; then
    printf '[dry-run] (cd %q &&' "$directory" >&2; printf ' %q' "$@" >&2; printf ')\n' >&2; return 0
  fi
  (cd "$directory" && "$@")
}

cm_load_config() {
  local config_path="$1" mode group other
  cm_require_file "$config_path"
  if [[ "$(uname -s)" == 'Linux' ]]; then
    mode="$(stat -c '%a' "$config_path" 2>/dev/null || true)"
    if [[ -n "$mode" ]]; then
      group=$((10#${mode: -2:1})); other=$((10#${mode: -1}))
      (( (group & 2) == 0 && (other & 2) == 0 )) || cm_die "Configuracao gravavel por grupo/outros: $config_path"
    fi
  fi
  set -a
  # shellcheck disable=SC1090
  source "$config_path"
  set +a
}

cm_require_config_values() {
  local name
  for name in "$@"; do [[ -n "${!name:-}" ]] || cm_die "Configuracao obrigatoria ausente: $name"; done
}

cm_assert_secret_file_permissions() {
  local file_path="$1" mode group other
  cm_require_file "$file_path"
  [[ "$(uname -s)" == 'Linux' ]] || return 0
  mode="$(stat -c '%a' "$file_path" 2>/dev/null || true)"; [[ -n "$mode" ]] || return 0
  group=$((10#${mode: -2:1})); other=$((10#${mode: -1}))
  (( (group & 2) == 0 && other == 0 )) || cm_die "Arquivo sensivel deve ser no maximo 0640: $file_path"
}

cm_sha256() {
  if command -v sha256sum >/dev/null 2>&1; then sha256sum "$1" | awk '{print $1}'; return; fi
  if command -v shasum >/dev/null 2>&1; then shasum -a 256 "$1" | awk '{print $1}'; return; fi
  cm_die 'sha256sum ou shasum e obrigatorio.'
}

cm_json_field() {
  node - "$1" "$2" <<'NODE'
const fs = require('node:fs');
const [file, fieldPath] = process.argv.slice(2);
let value = JSON.parse(fs.readFileSync(file, 'utf8'));
for (const segment of fieldPath.split('.')) value = value?.[segment];
if (value === undefined || value === null || value === '') process.exit(2);
process.stdout.write(String(value));
NODE
}

cm_find_package_root() {
  local extract_dir="$1" candidate_count=0 candidate=''
  if [[ -f "$extract_dir/package.json" && -f "$extract_dir/release-manifest.json" ]]; then printf '%s\n' "$extract_dir"; return; fi
  while IFS= read -r package_file; do
    candidate="$(dirname "$package_file")"
    [[ -f "$candidate/release-manifest.json" ]] && candidate_count=$((candidate_count + 1))
  done < <(find "$extract_dir" -mindepth 2 -maxdepth 2 -type f -name package.json -print)
  [[ "$candidate_count" -eq 1 ]] || cm_die 'O ZIP deve conter exatamente uma raiz valida.'
  printf '%s\n' "$candidate"
}

cm_atomic_symlink() {
  local target="$1" link_path="$2" temp_link="${2}.next.$$"
  if cm_is_true "$CM_DEPLOY_DRY_RUN"; then cm_log "Trocaria symlink: $link_path -> $target"; return; fi
  mkdir -p "$(dirname "$link_path")"; rm -f "$temp_link"; ln -s "$target" "$temp_link"; mv -Tf "$temp_link" "$link_path"
}

cm_current_symlink_target() { [[ -L "$1" ]] && readlink -f "$1" || true; }
cm_service_action() { [[ -n "${2:-}" ]] && cm_run systemctl "$1" "$2"; }
cm_acquire_lock() { mkdir -p "$(dirname "$1")"; exec 9>"$1"; flock -n 9 || cm_die "Outro deploy esta em andamento: $1"; }

cm_http_expect_success() {
  local url="$1" timeout="${2:-10}" body_file status sample
  if cm_is_true "$CM_DEPLOY_DRY_RUN"; then cm_log "Testaria HTTP: $url"; return; fi
  body_file="$(mktemp)"
  status="$(curl --silent --show-error --location --max-time "$timeout" --output "$body_file" --write-out '%{http_code}' "$url")" || {
    rm -f "$body_file"; cm_die "Falha de conexao: $url";
  }
  if [[ ! "$status" =~ ^2 ]]; then
    sample="$(head -c 300 "$body_file" | tr '\n' ' ')"; rm -f "$body_file"; cm_die "HTTP $status em $url: $sample"
  fi
  rm -f "$body_file"
}

cm_safe_release_path() {
  local candidate root
  candidate="$(readlink -f "$1" 2>/dev/null || true)"; root="$(readlink -f "$2" 2>/dev/null || true)"
  [[ -n "$candidate" && -n "$root" && "$candidate" == "$root"/* ]] || cm_die "Caminho fora da raiz de releases: $1"
  printf '%s\n' "$candidate"
}
