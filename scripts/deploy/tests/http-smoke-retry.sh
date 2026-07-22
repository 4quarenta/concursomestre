#!/usr/bin/env bash

set -Eeuo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/../lib.sh"

test_dir="$(mktemp -d)"
cleanup() { rm -rf "$test_dir"; }
trap cleanup EXIT

mkdir -p "$test_dir/bin"
cat > "$test_dir/bin/curl" <<'MOCK'
#!/usr/bin/env bash
set -Eeuo pipefail

output=''
while (($#)); do
  case "$1" in
    --output) output="$2"; shift 2 ;;
    --write-out) shift 2 ;;
    *) shift ;;
  esac
done

count="$(cat "$CM_CURL_COUNTER")"
count=$((count + 1))
printf '%s\n' "$count" > "$CM_CURL_COUNTER"
printf 'mock response %s\n' "$count" > "$output"

if (( count == 1 )); then
  printf '502'
else
  printf '200'
fi
MOCK
chmod 0750 "$test_dir/bin/curl"

export CM_DEPLOY_DRY_RUN='false'
export CM_CURL_COUNTER="$test_dir/counter"
export PATH="$test_dir/bin:$PATH"
printf '0\n' > "$CM_CURL_COUNTER"

cm_http_expect_success 'https://example.invalid/health' 3

[[ "$(cat "$CM_CURL_COUNTER")" == '2' ]] || cm_die 'O smoke HTTP nao repetiu a requisicao transitoria.'
printf 'PASS: smoke HTTP repetiu 502 transitorio e aceitou a resposta 200.\n'
