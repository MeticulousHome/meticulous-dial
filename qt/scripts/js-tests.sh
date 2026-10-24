#!/bin/bash
# The React Dial's unit tests run against the Qt Dial's JavaScript ports (qt/tests/js/run.mjs, map.json).
set -euo pipefail
repo="$(cd "$(dirname "$0")/../.." && pwd)"
docker run --rm -u "$(id -u):$(id -g)" -e HOME=/tmp -v "$repo:/repo" -w /repo node:22-bookworm \
    node --experimental-strip-types --disable-warning=ExperimentalWarning qt/tests/js/run.mjs
