#!/bin/bash
# Runs the end-to-end tests (qt/tests/e2e) against a running Dial and backend:
#   qt/scripts/e2e.sh [pytest args]          # e.g. -k home, tests/e2e/test_wifi.py
# DIAL_RUN_NAME (the run-dev.sh container to run in, default qt-dial-run), DIAL_TEST_PORT (default 9310),
# DIAL_API (default http://127.0.0.1:18080).
set -euo pipefail
name="${DIAL_RUN_NAME:-qt-dial-run}"
docker exec -e DIAL_TEST_PORT="${DIAL_TEST_PORT:-9310}" -e DIAL_API="${DIAL_API:-http://127.0.0.1:18080}" \
    -w /repo/qt "$name" python3 -m pytest -p no:cacheprovider -q tests/e2e "$@"
