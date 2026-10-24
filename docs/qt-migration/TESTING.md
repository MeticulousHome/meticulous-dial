# Qt Dial: tests

## What runs where

| Suite | What it protects | How to run | Status |
|---|---|---|---|
| End-to-end (`qt/tests/e2e/test_*.py`) | the user's journeys: the real Qt Dial (Xvfb + Mesa) against meticulous-backend in emulation mode, driven with the backend's own `button` events | see below | see "Results" |
| Frame rate on the machine (`qt/tools/perf/flipsrun.py`) | 63.5 fps with every frame on time | on the machine, see README | see "Results" |
| C++ unit tests (`qt/tests/unit/`, Qt Test) | pure C++ parts: Community queue and crypto; Sentry's rules (when it is on, classification, sanitizer, rate limits, frame windows) and the reporter end to end against a local fake Sentry (events, breadcrumbs, caps, crashes sent on the next start, offline cache) | `cmake -DDIAL_BUILD_TESTS=ON`, `ctest` in the container (also in CI) | all passing |
| Sentry on the real Dial (`qt/tests/sentry/dial-smoke.sh`) | the Dial with a local fake Sentry and a fake `/api/v1/machine`: tags, nothing secret sent, the slowdown event after a stall, SIGTERM exits 0, nothing sent with Sentry off | `qt/tests/sentry/dial-smoke.sh [amd64 build dir]` | passing |
| React suites (`tests/*.test.mts`, `npm test`, Playwright scale overlay) | the React Dial, still the specification | `npm ci && npm run test:all` | unchanged |
| Community contract (`qt/tests/community-contract/`) | the Qt uploader against the Tauri Dial's community_upload.rs, request by request (headers, bodies, signatures, retries, answers, state.json), against local fakes in `--network none` containers | `bash qt/tests/community-contract/run.sh` (WSL, ~4 min) | 16/16 pass; see parity/community-contract.md |
| QML smoke (`qt/scripts/qml-smoke.sh`, `qt/tests/smoke/visit_routes.py`) | every QML/JS file parses on Qt 6.4 (qmllint, syntax errors only) and every route of Routes.qml builds without a QML error or script exception, with no backend and no network | `qt/scripts/qml-smoke.sh` after `build.sh amd64` | 68 routes, 0 problems |
| CI (`.github/workflows/qt-dial.yml`, the fork) | on every push to `qt-migration` that touches the Dial: the image, amd64 + arm64 builds, the QML smoke, the C++ unit tests, the React unit tests on the QML ports, the .deb as an artifact | GitHub Actions, or the same scripts locally | the e2e and integration suites need the private backend and fika-sil: local only |

The React e2e journeys live in meticulous-integration (Playwright in Chromium on the web build, the real
backend and the firmware simulator fika-sil). Playwright cannot drive Qt Quick, so the Qt Dial opens a test
port (`--test-port`): a WebSocket on 127.0.0.1 that answers with the route, the bubble, the visible texts, the
focused menu entry and screen probes, takes gestures and backend `button` events, and saves screenshots
(`qml/Dial/components/TestServer.qml`). `qt/tests/e2e/dial.py` wraps it with the names of meticulous-integration's
`tests/dial_app.py` (`Screen.route()`, `wait_for_route()`, `focused()`, `select()`, `Controls.push()`, ...),
so its journeys port almost line by line. The pure-logic unit tests of `tests/*.test.mts` (geometry,
detectors, selection rules, profile contracts) are ported as checks of the JS libraries that replace those
modules, inside the e2e files of each group.

## No real services in tests

A Dial started without `DIAL_EXTERNAL_SERVICES=1` (every test and development run; only the machine's
launcher sets it) reaches only the backend and the machine it runs on: requests of the QML to any other host
go to a dead local port and are logged ("blocked a request to ..."), the Community uploader talks to a dead
address, and the bug report has no real ticket service / Sentry defaults and asks the backend to probe
nothing. Tests that exercise those flows give the Dial local stand-ins (the support tests' report-service
override, the settings tests' Community stand-in). The Dial logs "external services are off" when it starts
this way.

The network enforces it too, for the Dial and for the emulated backend (which has real Sentry DSNs, the
production shared-shots bucket and a time zone lookup built in): `run-dev.sh` and `dev-backend.sh` start
their containers with those services' names resolving to 127.0.0.1 (`qt/scripts/real-services.sh`), and the
backend's shot sharing points at a dead address. The fika-sil journeys run with no network at all
(`qt/tests/integration`, `docker run --network none`), and the React reference screenshots resolve only
localhost. A run on a machine (`deploy-dev.sh`, the frame meter) starts the Dial guarded as well; that
machine's own backend keeps reporting as any machine does.

## Running the end-to-end tests

```bash
qt/scripts/build.sh amd64
qt/scripts/dev-backend.sh start                       # backend on 127.0.0.1:18080
python3 qt/scripts/seed-profiles.py --to http://127.0.0.1:18080 --copies 5
qt/scripts/run-dev.sh start                           # Dial on test port 9310
qt/scripts/e2e.sh                                     # all; or e2e.sh tests/e2e/test_home.py -k pill
```

Every run writes an HTML report, `qt/build/e2e-report/report.html` (`qt/tests/e2e/html_report.py`): per
test what it protects (its docstring), the outcome, the time, the failure and its screenshots, copied next to
the page (`DIAL_E2E_REPORT=<dir>` writes it elsewhere, `DIAL_E2E_REPORT=0` not at all). Failures save a
screenshot in `qt/build/e2e-artifacts/`. Several Dials can run side by side
(`DIAL_RUN_NAME=<container> TEST_PORT=<port> run-dev.sh start`, then `DIAL_RUN_NAME=... DIAL_TEST_PORT=...
e2e.sh`), and several backends (`DIAL_BACKEND_NAME=... PORT=... STATE=... dev-backend.sh start`).

The same tests can drive the Dial on a machine through a tunnel (`ssh -N -L 9311:127.0.0.1:9310 root@<machine>`,
`DIAL_TEST_PORT=9311 DIAL_API=http://<machine>`); avoid journeys that start shots or purges there.

Against the real firmware: `qt/tests/integration/` runs meticulous-integration's 31 Dial journeys unchanged
on the Qt Dial, with the real backend and the real firmware on fika-sil (`bash qt/tests/integration/run.sh`,
about 13 min, no network in the container; `MODE=react` runs the same journeys on the React Dial). Results
and the gaps it found: `parity/integration.md`. Its HTML report is meticulous-integration's own generator run
on the run's artifacts, `python3 ~/work/meticulous-integration/ci/report.py --artifacts
qt/build/integration-artifacts/<run>` → `qt/build/integration-artifacts/<run>/report.html` (screenshots
instead of the React suite's videos).

## Results

2026-10-24 evening, branch `qt-migration` at `0ee84dcf` (Sentry, the Community HTTP client, the backend-only
Pour Over history and the image-picker and shot-graph fixes included), every run guarded and with the real
services blocked on the network:

| Suite | Result | HTML report |
|---|---|---|
| End-to-end, all of `qt/tests/e2e` (183 tests, one emulated backend, ~20 min) | **167 passed, 13 skipped, 3 xfailed, 0 failed**; no request blocked by the Dial's guard, Sentry never on | `qt/build/e2e-report/report.html` |
| Integration journeys (meticulous-integration, real backend + fika-sil, run `final3`) | **28 passed, 2 xfailed, 1 failed**: the xfails are the suite's known gaps, same check and value as on React; `test_dial_support` fails by design of the guard (no ticket service, no preflight probes). React in the same setup: 29 passed, 2 xfailed. `profileHover` as `null`: 0 | `qt/build/integration-artifacts/final3/report.html` (meticulous-integration's `ci/report.py`; screenshots instead of videos) |
| Community contract (`qt/tests/community-contract/run.sh`) | 16 of 16 scenarios match the Tauri uploader | `qt/build/contract-report/report.md` |
| C++ unit tests (`ctest`) | 4 of 4 (Community model and service, Sentry rules and reporter) | |
| QML smoke | 68 routes, 0 problems | |
| React unit tests on the QML ports (`qt/scripts/js-tests.sh`) | 12 of the mapped files, all passing (slowdownDetector added) | |
| CI on the fork (`.github/workflows/qt-dial.yml`) | green on every push since `6bf0cb70` | GitHub Actions |
| Frame rate on 10.10.0.130 | PARITY.md, "Performance" | |

What the skips and xfails are:

- Skipped (13): the Wi-Fi list journeys need a Wi-Fi fake (6; the emulated backend stubs NetworkManager);
  changing the Wi-Fi mode for good (`DIAL_WIFI_MODE_CHANGES=1`); the shot-data-sharing prompt needs a backend
  whose sharing was never answered; "help us improve" (2) and dispatched reports (2) change state every Dial on
  the backend sees (`DIAL_PRIVATE_BACKEND=1`); one tare case where the emulated backend leaves guided pour-over
  by itself.
- Xfailed (3): scale calibration needs a loaded scale; the home focusing a just-made profile (the React bug,
  as in meticulous-integration); cancelling a report while collecting when the emulated backend collects
  faster than Cancel can be pressed.

Things learned for steady runs: a report the mobile app dispatched is uploaded by every Dial on the backend
and announced with a notification of the Dial's own (the fixture acknowledges it); tests delete the profiles
they save (a long carousel slows every test); `go_to_card` moves by position, since profiles can share a name.
