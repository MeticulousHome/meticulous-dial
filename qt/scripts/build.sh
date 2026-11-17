#!/bin/bash
# Builds the Qt Dial in the bookworm image (docker/Dockerfile.bookworm), from WSL or any Linux with Docker:
#   qt/scripts/build.sh            # both: build/amd64 (tests, offscreen runs) and build/arm64 (the machine)
#   qt/scripts/build.sh arm64      # or amd64
# The image is built on first use. Output: qt/build/<arch>/meticulous-dial-qt.
set -euo pipefail
here="$(cd "$(dirname "$0")/.." && pwd)"
repo="$(cd "$here/.." && pwd)"
image=qt-dial-bookworm
archs=("${@:-amd64 arm64}")
read -r -a archs <<< "${archs[*]}"

if ! docker image inspect "$image" >/dev/null 2>&1; then
    docker build -t "$image" -f "$here/docker/Dockerfile.bookworm" "$here/docker"
fi

for arch in "${archs[@]}"; do
    toolchain=()
    [ "$arch" = arm64 ] && toolchain=(-DCMAKE_TOOLCHAIN_FILE=/repo/qt/cmake/aarch64-linux-gnu.cmake)
    docker run --rm -u "$(id -u):$(id -g)" -v "$repo:/repo" -w /repo/qt "$image" bash -c "
        set -e
        cmake -S /repo/qt -B /repo/qt/build/$arch -G Ninja -DCMAKE_BUILD_TYPE=Release -DCMAKE_INSTALL_PREFIX=/usr ${toolchain[*]} >/dev/null
        cmake --build /repo/qt/build/$arch
    "
    file "$here/build/$arch/meticulous-dial-qt"
done
