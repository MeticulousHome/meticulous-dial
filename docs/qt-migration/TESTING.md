# Qt Dial: tests

## What runs where

| Suite | What it protects | How to run | Status |
|---|---|---|---|
| End-to-end (`qt/tests/e2e/test_*.py`) | the user's journeys: the real Qt Dial (Xvfb + Mesa) against meticulous-backend in emulation mode, driven with the backend's own `button` events | see below | see "Results" |
| Frame rate on the machine (`qt/tools/perf/flipsrun.py`) | 63.5 fps with every frame on time | on the machine, see README | see "Results" |
| C++ unit tests (`qt/tests/unit/`, Qt Test) | pure C++ parts (Community queue and crypto) | `cmake -DDIAL_BUILD_TESTS=ON`, `ctest` in the container | community group |
| React suites (`tests/*.test.mts`, `npm test`, Playwright scale overlay) | the React Dial, still the specification | `npm ci && npm run test:all` | unchanged |

The React e2e journeys live in meticulous-integration (Playwright in Chromium on the web build, the real
backend and the firmware simulator fika-sil). Playwright cannot drive Qt Quick, so the Qt Dial opens a test
port (`--test-port`): a WebSocket on 127.0.0.1 that answers with the route, the bubble, the visible texts, the
focused menu entry and screen probes, takes gestures and backend `button` events, and saves screenshots
(`qml/Dial/components/TestServer.qml`). `qt/tests/e2e/dial.py` wraps it with the names of meticulous-integration's
`tests/dial_app.py` (`Screen.route()`, `wait_for_route()`, `focused()`, `select()`, `Controls.push()`, ...),
so its journeys port almost line by line. The pure-logic unit tests of `tests/*.test.mts` (geometry,
detectors, selection rules, profile contracts) are ported as checks of the JS libraries that replace those
modules, inside the e2e files of each group.

## Running the end-to-end tests

```bash
qt/scripts/build.sh amd64
qt/scripts/dev-backend.sh start                       # backend on 127.0.0.1:18080
python3 qt/scripts/seed-profiles.py --to http://127.0.0.1:18080 --copies 5
qt/scripts/run-dev.sh start                           # Dial on test port 9310
qt/scripts/e2e.sh                                     # all; or e2e.sh tests/e2e/test_home.py -k pill
```

Failures save a screenshot in `qt/build/e2e-artifacts/`. Several Dials can run side by side
(`DIAL_RUN_NAME=<container> TEST_PORT=<port> run-dev.sh start`, then `DIAL_RUN_NAME=... DIAL_TEST_PORT=...
e2e.sh`), and several backends (`DIAL_BACKEND_NAME=... PORT=... STATE=... dev-backend.sh start`).

The same tests can drive the Dial on a machine through a tunnel (`ssh -N -L 9311:127.0.0.1:9310 root@<machine>`,
`DIAL_TEST_PORT=9311 DIAL_API=http://<machine>`); avoid journeys that start shots or purges there.

Against the real firmware: meticulous-integration's stack (backend + fika-sil) can host the Qt Dial too; its
`dial_app.py` would need a Qt variant that starts the Dial binary with `--test-port` instead of Chromium. Not
done yet (see PARITY.md).

## Results

Filled in at the end of the migration run (see the section below and PARITY.md).
