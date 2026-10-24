#!/bin/bash
# Runs the amd64 build of the Qt Dial under Xvfb (Mesa llvmpipe: shaders work) in the bookworm image,
# against a backend (default: the emulated one of dev-backend.sh), with the test port open:
#   qt/scripts/run-dev.sh start [--screen=<route>]   # then qt/tests/e2e/dialctl.py state | grab x.png | ...
#   qt/scripts/run-dev.sh ctl <dialctl args>      # e.g. ctl gesture right 3, ctl grab /repo/qt/build/x.png
#   qt/scripts/run-dev.sh stop | logs | restart
# API (default http://127.0.0.1:18080), TEST_PORT (default 9310), DIAL_RUN_NAME (container, default qt-dial-run):
# give each parallel instance its own DIAL_RUN_NAME and TEST_PORT.
set -euo pipefail
here="$(cd "$(dirname "$0")/.." && pwd)"
repo="$(cd "$here/.." && pwd)"
cmd="${1:-start}"
shift || true
api="${API:-http://127.0.0.1:18080}"
port="${TEST_PORT:-9310}"
name="${DIAL_RUN_NAME:-qt-dial-run}"

case "$cmd" in
start|restart)
    docker rm -f "$name" >/dev/null 2>&1 || true
    # Extra arguments go to the Dial (e.g. --screen=settings). Each instance gets its own X display: on the
    # host network the containers share X's abstract socket namespace, so a fixed :99 would be shared.
    # The Community uploader keeps its files in the container and talks to a dead address unless
    # COMMUNITY_API_BASE says otherwise: a development enrollment never reaches the production server.
    display=$(( port % 1000 + 100 ))
    docker run -d --name "$name" --network host -u "$(id -u):$(id -g)" -e HOME=/tmp \
        -e DISPLAY_NUM="$display" -e CONFIG_PATH=/tmp/dial-config -e DIAL_EXTERNAL_SERVICES=0 \
        -e COMMUNITY_API_BASE="${COMMUNITY_API_BASE:-http://127.0.0.1:9}" -e MACHINE_API_BASE="$api" \
        -v "$repo:/repo" -w /repo/qt qt-dial-bookworm bash -c '
            Xvfb ":$DISPLAY_NUM" -screen 0 480x480x24 -nolisten tcp >/tmp/xvfb.log 2>&1 &
            sleep 1
            export DISPLAY=":$DISPLAY_NUM" QT_QPA_PLATFORM=xcb LIBGL_ALWAYS_SOFTWARE=1 QSG_RENDER_LOOP=basic
            exec /repo/qt/build/amd64/meticulous-dial-qt --qml-dir /repo/qt/qml --storage /tmp/dial-storage.json "$@"
        ' _ --api "$api" --test-port "$port" "$@" >/dev/null
    for _ in $(seq 40); do
        docker exec "$name" python3 /repo/qt/tests/e2e/dialctl.py --port "$port" state >/dev/null 2>&1 && { echo "dial up, test port $port"; exit 0; }
        sleep 0.5
    done
    docker logs --tail 60 "$name"
    exit 1
    ;;
stop) docker rm -f "$name" ;;
ctl) docker exec "$name" python3 /repo/qt/tests/e2e/dialctl.py --port "$port" "$@" ;;
logs) docker logs --tail "${1:-80}" "$name" 2>&1 ;;
*) echo "usage: $0 start|restart|stop|logs" >&2; exit 2 ;;
esac
