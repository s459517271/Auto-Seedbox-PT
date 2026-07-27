#!/bin/bash

set -euo pipefail
IFS=$'\n\t'

TEST_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
REPO_DIR=$(cd "$TEST_DIR/.." && pwd)
SCRIPT_FILE="$REPO_DIR/auto_seedbox_pt.sh"

load_function() {
    local function_name="$1" function_body
    function_body=$(sed -n "/^${function_name}()/,/^}/p" "$SCRIPT_FILE")
    if [[ -z "$function_body" ]]; then
        echo "FAIL: missing function ${function_name}" >&2
        return 1
    fi
    eval "$function_body"
}

review_tmp=$(mktemp -d -t asp-password-test.XXXXXX)
sentinel="$review_tmp/command-was-executed"
capture="$review_tmp/docker-args"
cleanup() {
    rm -f "$sentinel" "$capture"
    rmdir "$review_tmp" 2>/dev/null || true
}
trap cleanup EXIT

dangerous_password=$(printf 'space " quote $(touch %q) `touch %q` ; # back\\slash' "$sentinel" "$sentinel")

load_function write_shell_assignment
assignment=$(write_shell_assignment APP_PASS "$dangerous_password")
unset APP_PASS
eval "$assignment"
[[ "$APP_PASS" == "$dangerous_password" ]]
[[ ! -e "$sentinel" ]]
echo "PASS: shell assignment round-trips special characters without execution"

load_function create_filebrowser_admin
HB="$review_tmp/home with spaces"
APP_USER="review user"
APP_PASS="$dangerous_password"
docker() {
    printf '%s\0' "$@" > "$capture"
}

create_filebrowser_admin
mapfile -d '' docker_args < "$capture"
[[ ${#docker_args[@]} -eq 14 ]]
[[ "${docker_args[0]}" == "run" ]]
[[ "${docker_args[5]}" == "$HB/filebrowser_data:/database" ]]
[[ "${docker_args[9]}" == "users" ]]
[[ "${docker_args[10]}" == "add" ]]
[[ "${docker_args[11]}" == "$APP_USER" ]]
[[ "${docker_args[12]}" == "$APP_PASS" ]]
[[ "${docker_args[13]}" == "--perm.admin" ]]
[[ ! -e "$sentinel" ]]
echo "PASS: FileBrowser receives username and password as literal arguments"
