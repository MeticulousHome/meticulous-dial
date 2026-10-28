# Qt Dial: decisions

Why the Dial moves to Qt and how the port is built. Measured numbers are from the office test machines
(i.MX8M Nano VAR-SOM-MX8MN, 4 x Cortex-A53 at 1.5 GHz, 2 GB, Vivante GC7000UL at 400 MHz with Mesa etnaviv,
OpenGL ES 2.0 only; ST7701S 480 x 480 panel over DSI at 63.53 Hz).

## Why Qt Quick

The React Dial runs in Tauri on WebKitGTK under Weston. Even with every fix found in October 2026 it tops out
around 52-55 fps while something moves (three serial GPU passes a frame: WebKit's compositor, GTK's copy,
Weston's rotation). WPE straight on DRM reached 59-62. A Qt Quick prototype on eglfs_kms drew the carousel,
the menu, the gauge, the keyboard and the heating screen at 63.5 fps with every frame on time and 12-30 % of
one core. Alu decided to migrate. Qt 6.4.2 is what Debian bookworm ships, the release the image is built on
(installing trixie's 6.8 would upgrade ~70 system packages, openssh included): no Qt Quick 3D, Qt Graphs or
MultiEffect. The Dial is GPLv3, so the LGPL/GPL Qt modules are fine.

## Shape of the app

- **A small C++ host, the UI in QML.** `qt/src/main.cpp` parses the launch options and loads `qml/main.qml`.
  C++ only where it pays: the Socket.IO client, the native helpers that replaced Tauri commands
  (`Native`: OS local time, ready markers, persistent storage, files, resource snapshot), `PlotLine` (an
  antialiased polyline in one scene-graph mesh, for the extraction graph), `LottieItem` (rlottie), `QrCode`
  (qrcodegen) and the Community uploader. Everything else is QML/JS, close to the React code it ports, so
  the React tree keeps working as the specification.
- **QML shipped as files, not compiled into the binary.** `/usr/share/meticulous-dial-qt/qml`; Qt keeps its
  bytecode cache under `/meticulous-user/.cache`. A QML fix is a file copy (`deploy-dev.sh --qml-only`), and
  the module layout needs no qmldir generation. qmlcachegen/AOT can come later if startup time asks for it.
- **Straight on DRM/KMS (eglfs_kms), no Weston.** One GPU pass per frame. The panel is mounted turned:
  the root item rotates -90° (Weston's `transform=rotate-90` today). The app must be DRM master, so it never
  runs with Weston. It runs as `meticulous-dial.service`, the name the image always gave the Dial: the image's
  nightly `meticulous-restart` restarts `meticulous-dial`, and the watcher, crash-reporter and the smoke
  report all refer to that name. (While both Dials existed, `dial-switch qt|web` chose between them on test
  machines; the React Dial and `dial-switch` were removed when the Qt Dial landed.)
- **A stop is a clean exit.** eglfs's VT handler answers SIGTERM with `_exit(1)`, which systemd counted as a
  failure: every stop (an upgrade, the nightly restart) ran `crash-reporter@meticulous-dial`,
  which reports a crash to Sentry and restarts the Dial. `main.cpp` takes SIGTERM/SIGINT itself and quits
  the event loop (exit 0, the tty restored on the way out; a stuck loop ends by SIGALRM after 10 s).
- **The backend is the only Pour Over history.** (Alu, 2026-10-24.) As with profiles and shots, Free Pour
  and guided pour-over brews are saved to `/history/pour-over` and read from it; the Dial keeps no cache
  or queue (React keeps 128 brews in IndexedDB). A short retry covers a restarting backend: a request
  without answer or a 5xx is retried after 2, 4 and 8 s when saving, 1 and 2 s when reading; 4xx never.
- **No real services off the machine.** Only the machine's launcher sets `DIAL_EXTERNAL_SERVICES=1`; anything
  else (development, tests, profiling) reaches only the backend and the machine it runs on (`src/netguard.*`).
- **The backend as today.** REST and Socket.IO on `http://localhost:8080`; the knob and buttons arrive as
  the backend's socket.io `button` events, mapped to the same gestures (`Input.qml` = `SocketProviderValue`).
- **Same state shape as the React store.** `Dial.Core` singletons mirror the Redux slices and contexts:
  `Nav` (screens slice), `Stats`, `Notifications`, `UiState` (settings / wifi / images slices), `Profiles`
  (ProfileContext and the profile queries), `BackendSettings` (useSettings, polled every 2 s like the React
  query), `Device`, `Idle`, `ManualMode`. React effects became explicit functions run on the same changes,
  in the same order, so the subtle parts (profile events, hover from the app, the post-ready screen) behave
  the same.
- **Same route table and transitions.** `Routes.qml` is `routes.ts` in the same order (the order decides
  the transition direction). `Router.qml` + `RouteHost.qml` port the Transitioner: 450 ms, the WebKit spring
  (mass 1, stiffness 65, damping 10) sampled as the LESS keyframes did, the fade keyframes, and the leaving
  route drawn on top as in the React DOM. The Transitioner's title hand-over is ported but never triggers
  (React compares freshly created title elements by identity), so every transition is "large", as today.
- **Gestures as signals.** `GestureHandler` = `useHandleGestures`; `enabled` is the inverse of the React
  "ignore" argument, and a leaving route is disabled (Item.enabled is inherited), like VisibilityContext.
  React's `right` / `left` are `turnRight` / `turnLeft` because Item already has `right` / `left`.
  React subscribes a handler after the render a gesture caused; QML bindings update during the signal, so
  `Input.serial` numbers the gestures and a handler skips the one during which it came on (without it, the
  press that picks raise or purge in the quick settings also pressed the home's card under them).
- **Fidelity rules.** Sizes as CSS computes them, the same fonts (ABC Diatype and Diatype Mono, fontello),
  colors, easing curves and durations (`Motion.js`: the spring, CSS `ease`, keyframes).

## Performance rules (learned on the machine)

- Circles and arcs: one `ShaderEffect` whose mesh is bent into the ring band (`Arc.qml`): Qt5Compat masks
  re-render offscreen on every change, and a shader over a whole square costs more fill rate than the GPU has.
- Lines and plots: `PlotLine` (vertex-colored triangles with a 1 px feather). Canvas is QPainter on the CPU
  (~10 ms a frame here); Shapes is not antialiased on this GPU in 6.4.
- Static icons: SVG files rasterized once by Image. Lottie: rlottie on a worker thread into a texture, with
  the file's time base multiplied (`subframes: 2`) so a 30 fps animation shows 60 pictures a second like
  lottie-web's subframes. Qt Lottie 6.4 has no precompositions (most of the Dial's files use them) but stays
  available where it measured better (the heating bubbles).
- Nothing animates while hidden (an invisible running animation makes the render loop draw every vblank:
  the first build drew 63.5 fps on a still home because of a ring pulse; now 0 frames and ~2 % CPU).
- Bubble components that open often are created once and kept (QuickSettings): creating them took 50-100 ms
  at the start of the slide.

## The rlottie and JSON order detail

rlottie's parser reads some objects in key order ("ty" before the rest). Re-serializing a Lottie document
with QJsonDocument sorts the keys and rlottie then draws nothing; `LottieItem` rewrites the time base with
nlohmann::ordered_json, which keeps the order.

## Testing

- The React e2e journeys run Playwright in Chromium; Playwright cannot drive Qt Quick. The Qt Dial has a test
  port instead (`--test-port`, WebSocket on 127.0.0.1): state, visible texts, the focused menu entry, probes,
  gestures and backend "button" events, screenshots. `qt/tests/e2e/dial.py` gives it the vocabulary of
  meticulous-integration's `dial_app.py` (Screen, Controls), so its journeys port almost line by line.
- Off the machine the Dial runs under Xvfb with Mesa (llvmpipe), against meticulous-backend in emulation
  mode in Docker (`dev-backend.sh`, with the host commands stubbed like the backend's boot harness does).
- On the machine, `tools/perf/flipsrun.py` counts the framebuffers that reach the panel (DRM debugfs) while it
  plays knob events, as the prototype measured.

## What is not carried over

- Sentry, in part. The Qt Dial reports through sentry-native 0.17.2 (MIT, not in bookworm: built from the pinned
  release with the project, linked statically; crash backend breakpad, in process, so there is no handler binary
  to ship), on the machine only (`DIAL_EXTERNAL_SERVICES=1`), to the React Dial's project as release
  `meticulous-dial-qt@<version>` with the tag `dial-runtime: qt` (parity/sentry.md). Not carried over: JS stack
  traces (a QML exception carries only the file and line the engine prints) and unhandled promise rejections
  (Qt 6.4 does not report them); the slowdown report has no process ranking and sees stalls only while the Dial
  animates. Added on purpose: crash minidumps, console.error / qCritical as events and warnings as breadcrumbs
  (React sends none), cleaned and rate-limited. The bug report's feedback is still the plain envelope POST.
- The Tauri window management (fullscreen, show after ready): eglfs is fullscreen by construction; the ready
  markers in /run are kept.
