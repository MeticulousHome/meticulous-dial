#!/bin/bash
# Checks the Qt Community uploader against the Tauri Dial's real community_upload.rs, both ways: the
# Tauri uploader takes over a Qt-written state and queue (and uploads it with the same signatures and
# idempotency keys), the Qt uploader finishes a Tauri-started enrollment, and each reads the other's
# state.json byte for byte (tst_community_service interopWithTheTauriUploader).
#   bash qt/tests/unit/community-interop/run.sh        (from WSL: cargo on the host, Qt in qt-dial-bookworm)
# The helper builds offline from the local cargo cache (the crates of src-tauri). It is a host binary;
# it runs inside the container through the host's own dynamic loader and libraries.
set -euo pipefail
here="$(cd "$(dirname "$0")" && pwd)"
repo="$(cd "$here/../../../.." && pwd)"
target="$repo/qt/build/community-interop"
CARGO_TARGET_DIR="$target" cargo build --offline -q --manifest-path "$here/Cargo.toml"
docker run --rm -u "$(id -u):$(id -g)" -e HOME=/tmp -v "$repo:/repo" \
    -v "$target/debug:/helper:ro" -v /usr/lib/x86_64-linux-gnu:/hostlib:ro \
    -e COMMUNITY_RUST_HELPER="/hostlib/ld-linux-x86-64.so.2 --library-path /hostlib /helper/community-interop" \
    qt-dial-bookworm bash -c "
        set -e
        cmake -S /repo/qt -B /repo/qt/build/tests-amd64 -G Ninja -DCMAKE_BUILD_TYPE=Release -DDIAL_BUILD_TESTS=ON >/dev/null
        cmake --build /repo/qt/build/tests-amd64 --target tst_community_service >/dev/null
        /repo/qt/build/tests-amd64/tests/unit/tst_community_service interopWithTheTauriUploader
    "
