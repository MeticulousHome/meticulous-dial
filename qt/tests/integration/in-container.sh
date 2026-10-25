#!/bin/bash
# Inside the qt-dial-integ containers (run.sh starts them), in two phases:
#   PHASE=setup  with network: the backend's virtualenv with the machine group (as meticulous-integration's
#                ci/build.sh) in the qt-dial-integ-opt volume, plus websockets and Pillow; for MODE=react
#                also Node (in the volume) and Playwright's Chromium (in the cache volume).
#   PHASE=test   with no network at all (docker --network none): the journeys with the Qt overlay first,
#                pytest. Nothing in the stack (the Dial, the backend, fika-sil, Chromium) can reach a real
#                service, whatever it is configured with.
#   bash in-container.sh [pytest args]       JOURNEYS (default tests/test_dial_*.py) picks the files
# MODE=react runs the same journeys on the React Dial instead (the suite unchanged: its web build from
# DIAL_DIR in Chromium), as the reference the Qt run is compared with.
set -euo pipefail
: "${ARTIFACTS_DIR:?}" "${BACKEND_DIR:?}" "${FIRMWARE_DIR:?}"
mode="${MODE:-qt}"
export PYTHONDONTWRITEBYTECODE=1
export UV_PROJECT_ENVIRONMENT=/opt/qt-integ/venv UV_PYTHON_INSTALL_DIR=/opt/qt-integ/python
export PATH="/opt/qt-integ/node/bin:$PATH"
python=/opt/qt-integ/venv/bin/python
git config --global --add safe.directory '*'

if [ "${PHASE:-test}" = setup ]; then
    (cd "$BACKEND_DIR" && uv sync -q --frozen --group dev --group machine)
    uv pip install -q --python "$python" websockets pillow
    echo "backend environment ready"
    if [ "$mode" = react ]; then
        : "${DIAL_DIR:?MODE=react needs DIAL_DIR}"
        major="$(cut -d. -f1 "$DIAL_DIR/.node-version" | tr -d 'v')"
        if ! /opt/qt-integ/node/bin/node --version 2>/dev/null | grep -q "^v$major\."; then
            dist="$(curl -fsSL https://nodejs.org/dist/index.json |
                python3 -c "import json,sys; print(next(r['version'] for r in json.load(sys.stdin) if r['version'].startswith('v$major.')))")"
            rm -rf /opt/qt-integ/node && mkdir -p /opt/qt-integ/node
            curl -fsSL "https://nodejs.org/dist/$dist/node-$dist-linux-x64.tar.gz" | tar -xz -C /opt/qt-integ/node --strip-components=1
        fi
        [ -d "$DIAL_DIR/node_modules" ] || (cd "$DIAL_DIR" && npm ci --no-audit --no-fund --loglevel=error)
        uv pip install -q --python "$python" "playwright==1.55.0"
        "$python" -m playwright install chromium >/dev/null
        echo "React Dial dependencies and Chromium ready"
    fi
    exit 0
fi

# ---- PHASE=test (no network)
if [ ! -S /run/dbus/system_bus_socket ]; then
    mkdir -p /run/dbus
    dbus-daemon --system --fork
fi
export BACKEND_PYTHON="$python"
work=/work
rm -rf "$work"
mkdir -p "$work/tests"
cp /integration/tests/*.py "$work/tests/"
cp /integration/pytest.ini "$work/"
cp /repo/qt/tests/integration/trace_plugin.py "$work/tests/"
if [ "$mode" != react ]; then
    # The journeys, unchanged, next to the overlay: the overlay's conftest.py and dial_app.py take the
    # place of the suite's (its conftest is loaded as integration_conftest, its dial_app as react_dial_app).
    mv "$work/tests/conftest.py" "$work/tests/integration_conftest.py"
    rm "$work/tests/dial_app.py"
    cp /repo/qt/tests/integration/conftest.py /repo/qt/tests/integration/dial_app.py \
       /repo/qt/tests/integration/qt_dial_net.py "$work/tests/"
    export INTEGRATION_TESTS=/integration/tests QT_DIAL_E2E=/repo/qt/tests/e2e
    # The Dial's guard against real services stays on (conftest also sets 0 for the Dial and checks its log).
    export DIAL_EXTERNAL_SERVICES=0
fi
export PYTHONPATH="$work/tests"
if getent hosts community.meticuloushome.com >/dev/null 2>&1 || curl -sS -m 3 -o /dev/null https://1.1.1.1 2>/dev/null; then
    echo "the test phase must have no network (docker --network none)" >&2
    exit 3
fi

mkdir -p "$ARTIFACTS_DIR"
cd "$work"
status=0
# shellcheck disable=SC2086
"$python" -m pytest -v -p no:cacheprovider -p trace_plugin -o console_output_style=classic \
    --junitxml="$ARTIFACTS_DIR/junit.xml" ${JOURNEYS:-tests/test_dial_*.py} "$@" || status=$?
"$python" /repo/qt/tests/integration/summarize.py "$ARTIFACTS_DIR" || true
# The suite's own report page (each journey's video, timeline and screenshots): $ARTIFACTS_DIR/report.html.
"$python" /integration/ci/report.py --artifacts "$ARTIFACTS_DIR" || true
chown -R "${HOST_UID:-0}:${HOST_GID:-0}" "$ARTIFACTS_DIR" || true
exit $status
