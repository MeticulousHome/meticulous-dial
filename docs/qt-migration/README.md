# The Qt Dial: build, run, deploy

The Meticulous Dial in Qt Quick (Qt 6.4, Debian bookworm), in `qt/`. It replaced the React/Tauri Dial,
which was removed from the repository when it landed; the React code is in the history before that merge.
Why and how: [DECISIONS.md](DECISIONS.md). What was ported: [PARITY.md](PARITY.md). Tests:
[TESTING.md](TESTING.md). Porting rules: [CONVENTIONS.md](CONVENTIONS.md).

## Build

Everything builds in Docker from Linux or WSL (`qt/docker/Dockerfile.bookworm`: bookworm, its Qt 6.4.2 for
amd64 and arm64, the arm64 cross compiler, rlottie, qrcodegen, Mesa for headless runs, pytest). The image is
built on first use.

```bash
qt/scripts/build.sh          # qt/build/amd64/meticulous-dial-qt and qt/build/arm64/meticulous-dial-qt
qt/scripts/build.sh arm64    # only the machine's binary
```

The QML is not compiled into the binary: `qt/qml` is used as is (`--qml-dir`).

## Run it on a PC (no machine needed)

```bash
qt/scripts/dev-backend.sh start            # meticulous-backend in emulation mode on 127.0.0.1:18080
python3 qt/scripts/seed-profiles.py --to http://127.0.0.1:18080 --copies 5
qt/scripts/run-dev.sh start                # the Dial under Xvfb, test port 9310
qt/scripts/run-dev.sh ctl state            # route, bubble, history; also: texts, focused, gesture right,
qt/scripts/run-dev.sh ctl grab /repo/qt/build/x.png    # button CONTEXT, push, screen <route>, eval <js>
```

`dev-backend.sh` needs a meticulous-backend checkout (default `~/backend-beta`) and an image with its Python
dependencies in `/opt/venv` (default `meticulous-backend-e2e-baseline`; `IMAGE=` to change). With a display,
the Dial also runs as a normal window (`qt/build/amd64/meticulous-dial-qt --qml-dir qt/qml --api <url>
--rotation 0`); the arrow keys turn, space pushes, Enter is the context button.

Launch options: `--api <url>` (DIAL_API_URL), `--rotation <deg>` (DIAL_ROTATION, default -90),
`--test-port <port>` (DIAL_TEST_PORT; off by default), `--screen <route>` (start on a route),
`--storage <file>` (DIAL_STORAGE), `--show-circle` (DIAL_SHOW_CIRCLE: the round outline).

## Try it on a machine (development)

Needs root SSH by key. On a machine whose image does not have the Dial package yet, once, the runtime
packages from bookworm (never `-t trixie`):

```bash
ssh root@<machine> apt-get install -y -t bookworm --no-install-recommends \
  libqt6core6 libqt6gui6 libqt6network6 libqt6qml6 libqt6quick6 libqt6websockets6 libqt6svg6 \
  qt6-qpa-plugins librlottie0-1 libqrcodegencpp1 libssl3 libcurl4 ca-certificates qml6-module-qtquick \
  qml6-module-qtquick-window qml6-module-qtquick-shapes qml6-module-qtqml-workerscript qml6-module-qtwebsockets
```

Then:

```bash
qt/scripts/deploy-dev.sh <machine>             # binary + QML to /meticulous-user/dial-qt, runs as dial-qt-dev
qt/scripts/deploy-dev.sh <machine> --qml-only  # after a QML-only change
qt/scripts/dev-off.sh <machine>                # stop it, start the installed Dial again
```

The development run is a transient unit: nothing changes at boot, a reboot brings the installed Dial back.
Its test port is the machine's 127.0.0.1:9310 (`ssh -N -L 9311:127.0.0.1:9310 root@<machine>`, then
`qt/scripts/device-shot.sh <name>` for a screenshot).

Frame rate on the machine (`qt/tools/perf/`, copy it to the machine): `python3 flipsrun.py
browse|spin|menu|zoom|bubble|routes|static` counts the frames that reach the panel while it plays knob events
(only entries that open menus; never purge, raise or brew); `python3 fake_shot.py` measures the brewing
screens with a made-up shot fed to the Dial (its socket paused; nothing reaches the machine); `soak.py` loops
them for a long run; `qmlprofile.sh` (with a `-DDIAL_QML_DEBUG=ON` build and bookworm's
`qt6-qmltooling-plugins`) records a qmlprofiler trace and `qtd_top.py` lists what blocked the GUI thread.

## Install it on a machine (package)

meticulous-machine builds this package and installs it in the image. To put a build on a machine by hand:

```bash
qt/scripts/package-deb.sh                      # qt/build/meticulous-dial_<version>_arm64.deb
scp qt/build/meticulous-dial_*_arm64.deb root@<machine>:/tmp/
ssh root@<machine> apt-get install -y -t bookworm /tmp/meticulous-dial_*_arm64.deb
```

The package installs `meticulous-dial.service` (enabled) and starts the new version. The unit keeps the name the
image always used, so its machinery keeps working: the nightly `meticulous-restart` (it restarts
`meticulous-dial`), the watcher's checks and log collection, `crash-reporter`, the smoke report. On a machine
whose image still runs Weston, installing it also disables and stops `weston.service`: the Dial must be the
display's DRM master. The version is `package.json`'s (the release) plus the commit count and hash.

Logs: `journalctl -u meticulous-dial` (`-u dial-qt-dev` for a development run).

## Layout

```
qt/src/            C++: main.cpp, socketio.*, native.*, plotline.*, lottieitem.*, qrcodeitem.*, community/
qt/qml/main.qml    the window: router, bottom status, bubble, scale overlay, App.tsx logic, test port
qt/qml/Dial/Core/  singletons: Nav, Routes, Api, Backend, Stats, Profiles, BackendSettings, Device, ...
qt/qml/Dial/components/  OptionsMenu, Arc, NavTitle, Router, RouteHost, Bubble, BottomStatus, CircleKeyboard, ...
qt/qml/Dial/screens/<group>/  one file per route (Core/Routes.qml)
qt/qml/Dial/assets/      fonts/, public/ (images), icons/, lottie/
qt/packaging/      launcher, systemd unit, kms.json
qt/scripts/        build, run, deploy, package, test scripts
qt/tests/e2e/      end-to-end tests (pytest) through the test port
qt/tests/integration/  the meticulous-integration journeys against the Qt Dial (its CI runs them from here)
qt/tests/js/       the JavaScript unit tests (written for the React modules the QML ports)
qt/tests/unit/     C++ unit tests; qt/tests/test-vectors/ the Community cross-language vector
qt/tools/perf/     on-machine frame meter
```
