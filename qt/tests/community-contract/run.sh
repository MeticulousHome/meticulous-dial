#!/bin/bash
# Community uploader contract test: the Tauri Dial's community_upload.rs (the specification, kept as is in
# reference/ when the Tauri Dial was removed) and the Qt Dial's port (qt/src/community*) against the same local
# fake Community server and fake machine backend, through the same scenarios, compared request by request.
# See docs/qt-migration/parity/community-contract.md.
#
#   bash qt/tests/community-contract/run.sh [--only SCENARIO]...      (from WSL, in the checkout)
#
# 1. The Rust driver builds on the host with cargo --offline (the crates the Tauri Dial used, from the local
#    cargo cache, as qt/tests/unit/community-interop does) into qt/build/contract-rust.
# 2. The C++ driver builds against Qt 6.4 in the qt-dial-bookworm image into qt/build/contract-cpp.
# 3. contract.py runs both drivers, one scenario at a time, with its fake servers on 127.0.0.1, in a
#    qt-dial-bookworm container started with --network none: nothing can reach a real service.
# Writes qt/build/contract-report/report.md (and report.json, runs/); exits non-zero on any difference
# that is not an explained one.
set -euo pipefail
here="$(cd "$(dirname "$0")" && pwd)"
repo="$(cd "$here/../../.." && pwd)"
rust_target="$repo/qt/build/contract-rust"
cpp_build="$repo/qt/build/contract-cpp"
report="$repo/qt/build/contract-report"

echo "== building the Rust driver (cargo --offline, community_upload.rs as is)"
CARGO_TARGET_DIR="$rust_target" cargo build --offline -q --manifest-path "$here/rust/Cargo.toml"

echo "== building the C++ driver (Qt 6.4, qt-dial-bookworm, --network none)"
docker run --rm --network none -u "$(id -u):$(id -g)" -e HOME=/tmp -v "$repo:/repo" qt-dial-bookworm bash -c "
    set -e
    cmake -S /repo/qt/tests/community-contract/cpp -B /repo/qt/build/contract-cpp -G Ninja -DCMAKE_BUILD_TYPE=Release >/dev/null
    cmake --build /repo/qt/build/contract-cpp >/dev/null
"

echo "== running the scenarios (qt-dial-bookworm, --network none)"
rm -rf "$report"
mkdir -p "$report"
status=0
docker run --rm --network none -u "$(id -u):$(id -g)" -e HOME=/tmp -v "$repo:/repo" \
    -v "$rust_target/debug:/rust-driver:ro" qt-dial-bookworm \
    python3 -B /repo/qt/tests/community-contract/contract.py \
        --rust /rust-driver/community-contract \
        --cpp /repo/qt/build/contract-cpp/community-contract-cpp \
        --out /repo/qt/build/contract-report "$@" || status=$?
echo "report: $report/report.md"
exit $status
