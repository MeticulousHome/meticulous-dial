# meticulous-integration's Dial journeys on the Qt Dial

meticulous-integration (private, `~/work/meticulous-integration`) runs the Dial's journeys
(`tests/test_dial_*.py`) on the real backend (`tests/boot/boot_harness.py --serve`) and the real
firmware on a simulated machine (fika-sil), with the knob and the buttons operated through fika-sil:
a turn crosses the firmware, the UART and the backend's Socket.IO before it reaches the Dial. There the
Dial is the React web build in Chromium (Playwright). This overlay runs the same journeys, unchanged,
against the Qt Dial (`qt/build/amd64/meticulous-dial-qt`), started fresh for each test under Xvfb.

Nothing is written to the meticulous-integration checkout: it is mounted read-only and its tests are
copied next to the overlay in the container.

**No run reaches a real service** (the support ticket service, Sentry, Community). The journeys run in a
container with no network at all (`docker run --network none`; a setup container with network prepares
the virtualenv, Node and Chromium in volumes first, and the test phase refuses to start if it can reach
anything). The Qt Dial runs with its own guard on: `DIAL_EXTERNAL_SERVICES=0` is set for it (run.sh
refuses to start with `DIAL_EXTERNAL_SERVICES=1`), and the fixture stops a Dial whose log does not say
"external services are off" at start. On top of that, the Dial's `http_proxy`/`https_proxy` is a local
gate that refuses every third party, and the backend's third parties are answered on the container
(meticulous-integration's `third_parties.py`). Under the guard the bug report has no ticket service and
sends no preflight probes, so `test_dial_support.py` fails by design (BR-03, no preflight request).

## Run

```bash
bash qt/tests/integration/run.sh                                   # the whole Dial suite, SIL_SPEED 5 as CI
bash qt/tests/integration/run.sh -k pill                           # pytest arguments
JOURNEYS=tests/test_dial_02_home.py bash qt/tests/integration/run.sh
REBUILD=1 bash qt/tests/integration/run.sh                         # rebuild the image first
MODE=react bash qt/tests/integration/run.sh                        # the same journeys on the React Dial
python3 qt/tests/integration/compare.py qt/build/integration-artifacts/<react run> qt/build/integration-artifacts/<qt run>
bash qt/tests/integration/plant.sh && RUN_ID=plant QT_DIAL_QML=/repo/qt/build/integration-plant/qml \
  JOURNEYS="tests/test_dial_01_first_boot.py tests/test_dial_02_home.py" bash qt/tests/integration/run.sh
```

`MODE=react` is the reference: the suite unchanged (its conftest and dial_app, Chromium, Playwright) on
the React web build of `DIAL_DIR` (default `~/integration-dial`, whose `src/` is this repository's), in
the same containers. `compare.py` puts both runs side by side, journey by journey: outcome, the routes
seen, every focused menu entry the journey read and the controls of each "Go to" / "Choose" step
(`trace_plugin.py` records them in both modes). `plant.sh` copies the QML with two planted bugs (the
pill never names the selected card; Device Info values end in "!") to check that the journeys, through
this overlay, catch them: the two pill journeys and the Device Info journey must fail.

It needs, on the WSL host: Docker, the amd64 binary (`qt/scripts/build.sh amd64`), and the pieces
ci/local.sh takes: `INTEGRATION_DIR` (default `~/work/meticulous-integration`), `BACKEND_DIR`
(`~/backend-beta`), `FIRMWARE_DIR` (`~/fw-beta`: `sil/harness/fikasil.py`), `FIKASIL_BINARY`
(`~/fika-sil-beta/fika-sil`, with its `fika-sil.version` as `FIKASIL_VERSION`). A journey that depends
on the first boot (`test_dial_01_first_boot.py`) needs a fresh machine: every run starts one (a new
fika-sil NVS and backend data directory), and the files run in name order, so it runs first.

Artifacts: `qt/build/integration-artifacts/<RUN_ID>/` (default `<mode>-<timestamp>`; `latest` names the last):
`results.md` (one line per journey: outcome, failing check, screenshots), `junit.xml`,
`screens/<test>-NN-<what>.png` (a screenshot at each failed wait and at the end of a failed test),
`pages/<test>.dial.log` (the Dial's own log, every start) and `pages/<test>.json` (its JavaScript
exceptions, its requests to the backend), `reports/<test>.json` (the journey's timeline: what the
test did, each machine status, each screen), `backend.log`, `fika-sil.stderr.log`, `journeys.json`,
`observations.json`. There is no video.

## How

| Piece | File | What |
|---|---|---|
| Image | `Dockerfile`, `Dockerfile.react` | `qt-dial-integ:24.04`: `ubuntu:24.04` with ci/setup-host.sh's packages, uv, and the Qt 6.4.2 runtime (Ubuntu 24.04 ships the Qt the binary is built against on bookworm), Xvfb and Mesa; `qt-dial-integ-react:24.04` adds Chromium's system libraries for MODE=react |
| Runner | `run.sh`, `in-container.sh` | `qt-dial-integ-run-setup` (network: the backend's virtualenv in volume `qt-dial-integ-opt`, uv cache `meticulous-integration-cache`; Node and Chromium for MODE=react), then `qt-dial-integ-run` (`--network none`): the journeys copied with the overlay first, pytest, `summarize.py` |
| Fixtures | `conftest.py` | imports meticulous-integration's conftest (copied as `integration_conftest.py`) and replaces `dial_server`, `browser`, `dial_app`: Xvfb for the session; the Qt Dial process for each test (new storage file), `screen.restart()` a new process on the same storage |
| Screen | `dial_app.py` | tests/dial_app.py's API over the test port (`qt/tests/e2e/dialctl.py`): `route()` (Nav.screen), `routes()` (Nav.history), `text()` (visible Texts), `focused()` (`dialFocusedLabel`), `active_card()` / `carousel()` / `card_selected()` (ProfileHome's `dialProbe_activeCard` / `cards` / `cardSelected`), `pill_text()` (the Text inside the pill's box), `inject_turns()` (test-port gestures and `button` events); the controls, timeline and profile helpers are the suite's own |
| Tracing, comparing | `trace_plugin.py`, `compare.py`, `summarize.py` | `traces/<test>.json` in both modes: the steps, controls, focused entries and routes in call order (the reports' timelines are sorted by wall-clock time, which jumps under WSL); React vs Qt side by side; `results.md` |
| Network | `qt_dial_net.py` | `--api` is a recording proxy to the backend (HTTP and Socket.IO): `dial_app.watch.requests`; the Dial's `http_proxy`/`https_proxy` is a gate that refuses every third party (`dial_app.refused`) and answers the ones a test declares (`dial_app.answer_external`, over TLS with a CA of the run installed in the container's trust store) |

What a journey reads from the React page itself is mapped in `dial_app.QtPage.evaluate`: Brew
complete's graph (`PlotLine` items with points and the route's texts) and the circular keyboard's
selected key (`dialProbe_keyboardKey`). Differences from the React fixture: no video; `routes()` has no
"+bubble" entries; `focused()` is the label as written (trimmed), not as CSS renders it (journeys compare
without case); the carousel lists every card (the React page draws only those around the focused
one); `watch.requests` leaves out Socket.IO; JavaScript exceptions in the Dial's log are reported but do
not fail a test unless `QT_DIAL_FAIL_ON_QML_ERRORS=1`.

Results and the gaps found: `docs/qt-migration/parity/integration.md`.
