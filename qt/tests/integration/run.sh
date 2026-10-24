#!/bin/bash
# meticulous-integration's Dial journeys against the Qt Dial: the real backend, the real firmware on
# fika-sil (the knob and the buttons operated through it), and qt/build/amd64/meticulous-dial-qt
# instead of the React web build in Chromium. See README.md.
#   bash qt/tests/integration/run.sh [pytest args]          e.g. -x, -k pill
#   JOURNEYS=tests/test_dial_02_home.py bash qt/tests/integration/run.sh
#   MODE=react bash qt/tests/integration/run.sh             the React Dial (DIAL_DIR), the reference
# INTEGRATION_DIR (default ~/work/meticulous-integration, mounted read-only), BACKEND_DIR (~/backend-beta),
# FIRMWARE_DIR (~/fw-beta, for sil/harness), FIKASIL_BINARY (~/fika-sil-beta/fika-sil) and FIKASIL_VERSION
# (its fika-sil.version), SIL_SPEED (5, as CI), RUN_ID (artifacts go to
# qt/build/integration-artifacts/<RUN_ID>), QT_INTEG_NAME (the container, default qt-dial-integ-run),
# QT_DIAL_QML (the QML the Dial loads, a container path; default /repo/qt/qml; plant.sh makes a copy with
# planted bugs to check that the journeys catch them), DIAL_DIR (MODE=react: a meticulous-dial checkout,
# default ~/integration-dial, whose src/ is this repository's).
set -euo pipefail
here="$(cd "$(dirname "$0")" && pwd)"
repo="$(cd "$here/../../.." && pwd)"
integration="$(realpath "${INTEGRATION_DIR:-$HOME/work/meticulous-integration}")"
backend="$(realpath "${BACKEND_DIR:-$HOME/backend-beta}")"
firmware="$(realpath "${FIRMWARE_DIR:-$HOME/fw-beta}")"
fikasil="$(realpath "${FIKASIL_BINARY:-$HOME/fika-sil-beta/fika-sil}")"
version="${FIKASIL_VERSION:-$(cat "$(dirname "$fikasil")/fika-sil.version" 2>/dev/null || true)}"
mode="${MODE:-qt}"
name="${QT_INTEG_NAME:-qt-dial-integ-run}"
image="${QT_INTEG_IMAGE:-qt-dial-integ:24.04}"
run_id="${RUN_ID:-$mode-$(date +%Y%m%d-%H%M)}"

if ! docker image inspect "$image" >/dev/null 2>&1 || [ "${REBUILD:-0}" = 1 ]; then
    docker build -t "$image" "$here"
fi
mkdir -p "$repo/qt/build/integration-artifacts/$run_id"
echo "$run_id" > "$repo/qt/build/integration-artifacts/latest"
docker rm -f "$name" >/dev/null 2>&1 || true
dial=(-e DIAL_DIR=/repo)
if [ "$mode" = react ]; then
    dial=(-v "$(realpath "${DIAL_DIR:-$HOME/integration-dial}"):/dial" -e DIAL_DIR=/dial)
fi
# A checkout that is a git worktree keeps its objects in the main checkout's .git: mount that too (at
# the same path, read-only), so the run records the commits it ran (run.json).
gitdirs=()
for checkout in "$repo" "$backend" "$firmware"; do
    common="$(git -C "$checkout" rev-parse --path-format=absolute --git-common-dir 2>/dev/null || true)"
    case "$common" in
        "" | "$checkout/.git") ;;
        *) gitdirs+=(-v "$common:$common:ro") ;;
    esac
done
# Its own network namespace (not the host's): the backend, fika-sil, the proxy and the Dial's test port
# live on the container's loopback, so nothing clashes with the other Dials and backends on the host.
# The script runs from a copy, so editing it does not disturb a run in progress.
exec docker run --rm --name "$name" \
    -v "$repo:/repo" -v "$integration:/integration:ro" -v "$backend:/backend" -v "$firmware:/firmware:ro" \
    -v "$fikasil:/prebuilt/fika-sil:ro" "${dial[@]}" \
    -v meticulous-integration-cache:/root/.cache -v qt-dial-integ-opt:/opt/qt-integ "${gitdirs[@]}" \
    -e BACKEND_DIR=/backend -e FIRMWARE_DIR=/firmware -e SUITE=dial -e MODE="$mode" \
    -e FIKASIL_BINARY=/prebuilt/fika-sil -e FIKASIL_VERSION="$version" -e SIL_SPEED="${SIL_SPEED:-5}" \
    -e ARTIFACTS_DIR="/repo/qt/build/integration-artifacts/$run_id" -e JOURNEYS="${JOURNEYS:-}" \
    -e QT_DIAL_FAIL_ON_QML_ERRORS="${QT_DIAL_FAIL_ON_QML_ERRORS:-0}" -e QT_DIAL_QML="${QT_DIAL_QML:-/repo/qt/qml}" \
    -e HOST_UID="$(id -u)" -e HOST_GID="$(id -g)" \
    -w /repo "$image" bash -c 'cp /repo/qt/tests/integration/in-container.sh /tmp/in-container.sh && exec bash /tmp/in-container.sh "$@"' _ "$@"
