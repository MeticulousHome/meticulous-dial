#!/bin/bash
# The whole QML tree, loaded once (no backend needed; also what CI runs):
#   qt/scripts/qml-smoke.sh
# 1. every .qml and .js file parsed by qmllint (syntax errors only: Qt 6.4's parser rejects some words other
#    engines accept, e.g. `transient`), 2. the amd64 Dial started under Xvfb with no backend and every route
#    of Routes.qml shown through the test port, failing on any QML load error or script exception it logs.
# Needs qt/build/amd64/meticulous-dial-qt (qt/scripts/build.sh amd64).
set -euo pipefail
repo="$(cd "$(dirname "$0")/../.." && pwd)"
docker run --rm -u "$(id -u):$(id -g)" -e HOME=/tmp --network none -v "$repo:/repo" -w /repo/qt qt-dial-bookworm bash -c '
    set -e
    bad=$(find qml -name "*.qml" -print0 | xargs -0 /usr/lib/qt6/bin/qmllint 2>&1 \
          | grep -E "Expected token|Syntax error|Unexpected token|Unexpected character|Unterminated" || true)
    if [ -n "$bad" ]; then echo "QML syntax errors:"; echo "$bad"; exit 1; fi
    echo "qmllint: no syntax errors"
    Xvfb :93 -screen 0 480x480x24 -nolisten tcp >/tmp/xvfb.log 2>&1 &
    sleep 1
    export DISPLAY=:93 QT_QPA_PLATFORM=xcb LIBGL_ALWAYS_SOFTWARE=1 QSG_RENDER_LOOP=basic
    export DIAL_EXTERNAL_SERVICES=0 CONFIG_PATH=/tmp/dial-config COMMUNITY_API_BASE=http://127.0.0.1:9
    ./build/amd64/meticulous-dial-qt --qml-dir qml --storage /tmp/dial-storage.json \
        --api http://127.0.0.1:9 --test-port 9399 >/tmp/dial.log 2>&1 &
    for _ in $(seq 60); do python3 tests/e2e/dialctl.py --port 9399 state >/dev/null 2>&1 && break; sleep 0.5; done
    if grep -E "failed to load component|is not a type|unavailable" /tmp/dial.log; then cat /tmp/dial.log; exit 1; fi
    python3 tests/smoke/visit_routes.py 9399 /tmp/dial.log
'
