#!/bin/bash
# Runs the end-to-end tests (qt/tests/e2e) against a running Dial and backend:
#   qt/scripts/e2e.sh [pytest args]          # e.g. -k home, tests/e2e/test_wifi.py
# Without a test path among the arguments it runs all of tests/e2e.
# DIAL_RUN_NAME (the run-dev.sh container to run in, default qt-dial-run), DIAL_TEST_PORT (default 9310),
# DIAL_API (default http://127.0.0.1:18080).
set -euo pipefail
name="${DIAL_RUN_NAME:-qt-dial-run}"
paths=()
for a in "$@"; do
    case "$a" in tests/*|*.py|*.py::*) paths+=("$a") ;; esac
done
[ ${#paths[@]} -gt 0 ] || set -- "$@" tests/e2e
# Every other DIAL_* variable of the caller reaches the tests too (e.g. DIAL_WIFI_MODE_CHANGES).
extra=()
while IFS= read -r var; do extra+=(-e "$var"); done < <(env | grep -E "^DIAL_" | grep -vE "^DIAL_(TEST_PORT|API|RUN_NAME)=" || true)
docker exec -e DIAL_TEST_PORT="${DIAL_TEST_PORT:-9310}" -e DIAL_API="${DIAL_API:-http://127.0.0.1:18080}" "${extra[@]}" \
    -w /repo/qt "$name" python3 -m pytest -p no:cacheprovider -q "$@"
