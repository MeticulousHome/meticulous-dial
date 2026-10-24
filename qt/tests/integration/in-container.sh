#!/bin/bash
# Inside the qt-dial-integ container (run.sh starts it): the backend's virtualenv with the machine group
# (as meticulous-integration's ci/build.sh), the journeys with the Qt overlay first, then pytest.
#   bash in-container.sh [pytest args]       JOURNEYS (default tests/test_dial_*.py) picks the files
# MODE=react runs the same journeys on the React Dial instead (the suite unchanged: its web build from
# DIAL_DIR in Chromium), as the reference the Qt run is compared with.
set -euo pipefail
: "${ARTIFACTS_DIR:?}" "${BACKEND_DIR:?}" "${FIRMWARE_DIR:?}"
mode="${MODE:-qt}"
export PYTHONDONTWRITEBYTECODE=1
git config --global --add safe.directory '*'

# The backend connects to the system bus when it is imported (ci/setup-host.sh).
if [ ! -S /run/dbus/system_bus_socket ]; then
    mkdir -p /run/dbus
    dbus-daemon --system --fork
fi

# The backend's virtualenv (ci/build.sh), kept in the qt-dial-integ-opt volume between runs, plus the
# test port's client (websockets) and Pillow for the screenshots.
export UV_PROJECT_ENVIRONMENT=/opt/qt-integ/venv UV_PYTHON_INSTALL_DIR=/opt/qt-integ/python
(cd "$BACKEND_DIR" && uv sync -q --frozen --group dev --group machine)
python=/opt/qt-integ/venv/bin/python
uv pip install -q --python "$python" websockets pillow
export BACKEND_PYTHON="$python"
echo "backend environment ready"

work=/work
rm -rf "$work"
mkdir -p "$work/tests"
cp /integration/tests/*.py "$work/tests/"
cp /integration/pytest.ini "$work/"
cp /repo/qt/tests/integration/trace_plugin.py "$work/tests/"
if [ "$mode" = react ]; then
    # ci/setup-host.sh and ci/build.sh for the Dial suite: Node, Playwright with Chromium.
    : "${DIAL_DIR:?MODE=react needs DIAL_DIR}"
    if ! command -v node >/dev/null; then
        major="$(cut -d. -f1 "$DIAL_DIR/.node-version" | tr -d 'v')"
        dist="$(curl -fsSL https://nodejs.org/dist/index.json |
            python3 -c "import json,sys; print(next(r['version'] for r in json.load(sys.stdin) if r['version'].startswith('v$major.')))")"
        curl -fsSL "https://nodejs.org/dist/$dist/node-$dist-linux-x64.tar.gz" | tar -xz -C /usr/local --strip-components=1
    fi
    [ -d "$DIAL_DIR/node_modules" ] || (cd "$DIAL_DIR" && npm ci --no-audit --no-fund --loglevel=error)
    uv pip install -q --python "$python" "playwright==1.55.0"
    "$python" -m playwright install --with-deps chromium >/dev/null
    echo "React Dial dependencies and Chromium ready"
else
    # The journeys, unchanged, next to the overlay: the overlay's conftest.py and dial_app.py take the
    # place of the suite's (its conftest is loaded as integration_conftest, its dial_app as react_dial_app).
    mv "$work/tests/conftest.py" "$work/tests/integration_conftest.py"
    rm "$work/tests/dial_app.py"
    cp /repo/qt/tests/integration/conftest.py /repo/qt/tests/integration/dial_app.py \
       /repo/qt/tests/integration/qt_dial_net.py "$work/tests/"
    export INTEGRATION_TESTS=/integration/tests QT_DIAL_E2E=/repo/qt/tests/e2e
fi
export PYTHONPATH="$work/tests"

mkdir -p "$ARTIFACTS_DIR"
cd "$work"
status=0
# shellcheck disable=SC2086
"$python" -m pytest -v -p no:cacheprovider -p trace_plugin -o console_output_style=classic \
    --junitxml="$ARTIFACTS_DIR/junit.xml" ${JOURNEYS:-tests/test_dial_*.py} "$@" || status=$?
"$python" /repo/qt/tests/integration/summarize.py "$ARTIFACTS_DIR" || true
chown -R "${HOST_UID:-0}:${HOST_GID:-0}" "$ARTIFACTS_DIR" || true
exit $status
