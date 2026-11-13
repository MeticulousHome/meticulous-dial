# Parity: Sentry (crash and error reports)

The Qt Dial reports to the same Sentry project as the React Dial (`src/sentryConfig.ts`, project 8), through
[sentry-native](https://github.com/getsentry/sentry-native) 0.17.2 (MIT, the official C/C++ SDK). It is not in
Debian bookworm, so CMake fetches the pinned release (`sentry-native.zip`, SHA-256 checked) and builds it
with the project, linked statically: crash backend **breakpad**, transport **curl** (bookworm's `libcurl4`).

Files: `qt/src/sentry/` (`sentryreporter.*` start/stop, message hook, `before_send`, the `Sentry` QML
singleton; `logfilter.*` the pure rules: classification, sanitizer, rate limits; `framemonitor.*` frame timing
for the slowdown monitor; `dial_build_info.h.in`), `qt/src/main.cpp` (the session, the singleton),
`qt/qml/Dial/Core/Device.qml` (device tags), `qt/qml/Dial/Core/SlowdownMonitor.qml` and `SlowdownDetector.js`,
`qt/qml/main.qml` (starts the monitor), `qt/CMakeLists.txt`, `qt/docker/Dockerfile.bookworm` (libcurl dev
packages), `qt/scripts/package-deb.sh` (Depends `libcurl4`). Tests: `qt/tests/unit/tst_sentry_filter.cpp`,
`tst_sentry_reporter.cpp`, `fakesentry.h`, `qt/tests/sentry/` (`dial-smoke.sh`, `fake_sentry.py`), the
`tests/slowdownDetector.test.mts` entry of `qt/tests/js/map.json`.

## When it is on

Sentry starts first thing in `main()` (before `QGuiApplication`, so a crash during start-up is caught), only
when the environment says so. Off means off: no `sentry_init`, no message hook, no files, nothing sent; the
journal shows `sentry: off (...)`.

| Environment | Result |
|---|---|
| `DIAL_EXTERNAL_SERVICES=1` (only the machine's launcher sets it) | on, the React Dial's DSN |
| `DIAL_EXTERNAL_SERVICES` unset or anything else (tests, development, `deploy-dev.sh`, the frame meter) | **off** |
| `DIAL_SENTRY_DSN=<dsn on 127.0.0.1, localhost or ::1>` | on, with that DSN, whatever `DIAL_EXTERNAL_SERVICES` says: for a test's fake Sentry |
| `DIAL_SENTRY_DSN=<any other host>` | ignored: off without external services, the React DSN on the machine |
| `DIAL_SENTRY_DSN=` (set, empty) | off, also on the machine (a kill switch) |
| `DIAL_SENTRY_DATABASE=<dir>` | the database somewhere else (tests) |
| `DIAL_SENTRY_DEBUG=1` | sentry-native's own log on stderr |
| `DIAL_PERFORMANCE_DISABLE=1` / `DIAL_PERFORMANCE_DEBUG=1` | the slowdown monitor off / its samples in the journal (src-tauri lib.rs's switches) |

The journal says where it reports: `sentry: on, reporting to sentry.meticulousespresso.com as
meticulous-dial-qt@0.1.0 (dist 1775.g6bf0cb70), database /meticulous-user/.cache/meticulous-dial-qt/sentry`.
The bug report's feedback (`ReportApi.qml`) is unchanged: its own envelope POST, with its own
`DIAL_SENTRY_DSN` reading.

## What is sent, and when

| What | When | As | Limits |
|---|---|---|---|
| Crash (SIGSEGV, SIGABRT, SIGBUS, SIGFPE, SIGILL, SIGTRAP) | breakpad writes a minidump in the crashed process; it is **sent on the next start** (systemd restarts the Dial in 1 s) | level `fatal` event with the minidump attached (`event.minidump`), the scope at the crash (tags, the last breadcrumbs) | 3 crash reports an hour |
| `qFatal` | Qt aborts right after the message | the crash report above, with the message as its last breadcrumb (level fatal) and in its `qt_fatal` context | as crashes |
| `qCritical`, QML `console.error` | at once | message event, level `error`, logger = the Qt category (`qml` for QML), fingerprint `["qt-log", level, message with numbers collapsed]`, extra `qt_message {category, file, line, function, repeated}`, tag `log-source: qml\|native` | the event caps |
| QML/JS exception (the engine's warning `file:///.../X.qml:12: TypeError: ...`, any `*Error:` with a QML location) | at once | exception event: type (`TypeError`, `ReferenceError`, `Error`, ...), value, one stack frame with the QML file (relative to the QML root) and line; fingerprint `["qml-exception", type, file, value]` | the event caps |
| Warning naming an error without a location (`TypeError`, `ReferenceError`, `SyntaxError`, `RangeError`, `URIError`, `EvalError`, or `Error:`) | at once | message event, level `error` | the event caps |
| Other warnings (`qWarning`, `console.warn`, binding loops, ...) | kept on the scope | **breadcrumbs** (level warning, the Qt category), the last 40, sent with the next event | identical: once a minute; 30 a minute |
| Debug and info (`console.log`, `qInfo`) | never | — | — |
| "Dial UI sustained slowdown" | the slowdown monitor (below) | message event as React's `captureSlowdown` | its 30 min cooldown and the event caps |

Every event carries: release `meticulous-dial-qt@<version>`, dist `<commits>.g<hash>` of the build, environment
`production`, tags `dial-version`, `dial-runtime: qt`, and once `/api/v1/machine` answered (`Device.qml` calls
`Sentry.setDeviceInfo`) `serial`, `build-version` (image_version) and `build-channel` (image_build_channel) as
React's `SentryRuntimeMetadata`; sentry-native adds the `os` context (Linux, kernel release), a trace context
and the list of loaded modules (`debug_meta`, for symbolication). No sessions (React removes BrowserSession;
`auto_session_tracking` off). No `user` (sentry-native's installation id is removed), no `server_name`, no
`request`.

### Release and tags: the choice

Release `meticulous-dial-qt@<version>` (today `0.1.0`), not `meticulous-dial@<version>`, plus the tag
`dial-runtime: qt`, plus `dist` = the build (`<commits>.g<hash>`, the package version's suffix). Why: the Qt
Dial has its own version line (0.1.0, the React Dial is at 1.105.1); under React's release name Sentry would
read it as a very old React version and mix both apps in release health, "first seen in" and regression
detection. Both stay in project 8, so the same issues show side by side; `dial-runtime:qt` filters the Qt
Dial's events (React's have no such tag), the release name splits them. `dist` tells development builds of the
same version apart. It is also what the bug report's feedback already used (`ReportApi.qml`:
`meticulous-dial-qt@` + `Native.version`, `dial-version` = `Native.version`).

## Personal data

- **Structure, as React's `sanitizeAutomaticSentryEvent`** (src/sentryPrivacy.ts), in sentry-native's
  `before_send` (which also runs for crash reports, inside the crash handler: allocation-free key matching):
  `user`, `request`, `server_name` removed; tags `machine`, `machine_name`, `hostname` and every sensitive
  key dropped; `contexts` and `extra` scrubbed of sensitive keys at any depth. The sensitive keys and the
  matching rule are React's (`password`, `ssid`, `ip`, `email`, `token`, ...; a key matches when, normalized,
  it equals one or has it as a `_`-separated part).
- **Text** (React had no message text to clean: no breadcrumbs, no console capture): every message and
  breadcrumb loses the values of sensitive keys (`password=x`, `ssid: x`, `{"token":"x"}`, `?token=x`),
  credentials in URLs, `Bearer`/`Basic` credentials, e-mail addresses, IPv4 (not loopback), IPv6 and MAC
  addresses, `*.local` host names, and the machine's own name and hostname (learnt from `/api/v1/machine`;
  generic names such as "Meticulous" are kept), and is cut at 4096 characters. `[Filtered]`, `[ip]`,
  `[email]`, `[mac]`, `[host].local`, `[machine]` take their place.
- **Minidumps** hold the crashed process's thread stacks and registers (breakpad: no heap). A string that
  happened to be on a stack can be in one. React had no minidumps.

## Rate limits (a repeating message cannot flood Sentry)

- An identical event (numbers and hex ids collapsed: "retry 3 of 5" = "retry 4 of 5") at most once an hour;
  the next one after the hour carries `repeated: N`.
- At most 10 events in any 10 minutes and 50 in 24 hours (all kinds but crashes; the slowdown report counts
  too). The first dropped one is noted in the journal (`sentry: event limit reached`).
- Breadcrumbs: an identical one at most once a minute, at most 30 a minute, 40 kept.
- Crash reports: 3 an hour. After the third, the Dial starts without the crash handler until the hour has
  passed (a crash loop restarts every second); systemd's `crash-reporter` still sees every crash.
- The windows are kept in `<database>/dial-rate-limits.json` (times and 64-bit hashes, no text), so restarts
  and crash loops do not reset them.

What to expect in practice: when the backend is down or restarting, the QML logs `console.error` for every
failed query (`Error fetching profiles: ...`, `GetDefaultProfiles error: ...`); these become events now, each
once an hour, within the caps. If they turn out to be noise they can move to `console.warn` (breadcrumbs).

## Offline: the disk database

Database: `$XDG_CACHE_HOME/meticulous-dial-qt/sentry` (else `$HOME/.cache/...`); the launcher sets
`XDG_CACHE_HOME=/meticulous-user/.cache`, so on the machine `/meticulous-user/.cache/meticulous-dial-qt/sentry`.
The sentry-native 0.17.2 options used (`sentryreporter.cpp`):

| Option | Value | Effect |
|---|---|---|
| `http_retry` | on | a send that fails **on the network** (no route, DNS, refused, timed out) is written to `<db>/cache/<time>-<try>-<uuid>.envelope` and retried 15 min later, then 30, 60, 120, 240 and 480 min after each failed retry, and at every start (all waiting envelopes, 100 ms after `sentry_init`); 6 retries after the first try. An HTTP answer, any status (4xx/5xx too), is final |
| `cache_keep` | `SENTRY_CACHE_KEEP_OFFLINE` | when the retries run out the envelope stays in the cache as `<uuid>.envelope` instead of being deleted |
| `cache_max_items` / `cache_max_size` / `cache_max_age` | 30 / 20 MB / 14 days | pruned at every start, oldest first |
| `transfer_timeout` | 30 s | a stalled connection (a captive portal) fails instead of holding the queue |
| `shutdown_timeout` | 2 s | a stop waits up to 2 s for sends in flight; what is left is written to the run folder and sent at the next start |

sentry-native never sends a `<uuid>.envelope` again. The Dial renames them back to a retry name at its next
start (`rearmCachedEnvelopes`), so a machine that was offline longer than the retry schedule (about 16 hours of
uptime, or 6 starts) still delivers them later, within the 30 / 20 MB / 14 days bounds. Crash reports are
written to the run folder at the crash and sent at the next start; if that fails they join the retry queue
like any envelope. Note: the Dial often starts before Wi-Fi is up (at boot); that start's try then fails and
counts as one of the six retries.

Known in 0.17.2: a failed upload can be lost if it races with `sentry_close` while `http_retry` is on (fixed in
0.17.4, released 2026-10-16, too new for the two-week rule; worth the bump after 2026-10-30).

## Crash backend: breakpad, and why

- **breakpad** runs in the Dial's process: its signal handler writes the minidump on an alternate stack and
  sentry-native writes the crash envelope to disk, which the next start sends. Nothing else to ship, start or
  keep alive: no handler binary, no IPC, no ptrace permission. It cross-compiles for arm64 with the project
  (breakpad client, its getcontext assembly, the vendored libunwind; only libcurl from bookworm).
- **crashpad** needs `crashpad_handler` shipped in the package and running beside the Dial (another process
  on a 2 GB machine, started per run, ptracing the Dial) and uploads from that handler; its advantage, catching
  crashes that corrupt the crashing process badly, did not outweigh that here. sentry-native's newer `native`
  backend also needs its own daemon binary (`sentry-crash`); `inproc` writes no minidump.
- The Dial's own SIGTERM/SIGINT handling (a stop exits 0) is untouched; breakpad takes only the crash signals.
  systemd's `OnFailure=crash-reporter@` still runs on a crash, as for the WebKit Dial.
- Symbols: the binary has a build id and its symbol table (the package does not strip it), but the minidump
  has no symbols: for function names in Sentry upload the binary (better: a `-g` build of the same commit)
  with `sentry-cli debug-files upload`. Not set up yet.

## The slowdown monitor (useDialSlowdownMonitor)

- `Core/SlowdownDetector.js` is `src/performance/slowdownDetector.ts` and `slowdownMonitorConfig.ts`
  unchanged (the class as a constructor function); `tests/slowdownDetector.test.mts` passes against it
  (`qt/scripts/js-tests.sh`; `qt/tests/js/run.mjs` now also proxies constructors).
- `Core/SlowdownMonitor.qml` is the hook: on only where Sentry is and without `DIAL_PERFORMANCE_DISABLE`;
  30 s warm-up, 10 s windows, `DIAL_PERFORMANCE_DEBUG` samples, and the report React's `captureSlowdown`
  sends: message "Dial UI sustained slowdown", level warning, fingerprint `dial-ui-sustained-slowdown`, tags
  `performance-detector-version: 4`, `slowdown-report-kind`, `screen`, `is-extracting`, `machine-serial`,
  contexts `dial_performance` (the same keys) and `dial_resources`.
- The frames (`src/sentry/framemonitor.*`): React times `requestAnimationFrame`, which a browser fires every
  vsync even on a still screen. Qt Quick draws nothing when nothing changes, so a gap between frames is
  usually idle time. The monitor times `QQuickWindow::frameSwapped` on the GUI thread; intervals of up to two
  vsyncs count; while frames come back to back a GUI-thread heartbeat runs (16 ms) and a longer interval counts
  only when the heartbeat was about as late (the GUI thread was blocked, which with the threaded render loop
  also covers a slow render thread); otherwise it is idle time and left out. The heartbeat stops 150 ms after
  the last frame. A window is 10 s of drawing, not of wall time.
- Cost: a still Dial runs no timer (0.0-0.2 % of one core with Sentry and the monitor on, settings screen,
  Xvfb); while it animates, one queued signal per frame and the 16 ms heartbeat (on the animated ready screen
  under llvmpipe at ~170 fps: 674 vs 654 CPU ticks in 10 s, monitor on vs Sentry off; not measured on the
  machine).
- Differences: a GUI stall while nothing animates is not seen (React's rAF would see it); the resource
  context comes from `Native.resourceSnapshot()`, taken when a window closes, so it has no process ranking
  (`top_processes_by_cpu` / `_by_memory` are not sent) and no `available_cpu_count`.

## Differences from the React Dial

1. **Breadcrumbs**: React sends none (`maxBreadcrumbs: 0`, `beforeBreadcrumb: () => null`, and its sanitizer
   deletes `breadcrumbs`). The Qt Dial sends its warnings as breadcrumbs (cleaned, at most 40, rate-limited),
   as Alu asked.
2. **console.error / qCritical become events.** React's SDK did not capture console calls (no CaptureConsole);
   it sent uncaught exceptions and unhandled rejections (GlobalHandlers) and explicit captures. So the Qt Dial
   sends errors React only logged; the caps bound them.
3. **Exceptions** carry the QML file and line the engine prints, not a JS stack trace. Unhandled promise
   rejections are not reported by Qt 6.4's engine, so they are not sent.
4. **Crashes**: native crash reports with minidumps (React had none from the Dial itself).
5. **Release** `meticulous-dial-qt@<version>` + `dist` + tag `dial-runtime: qt` (above); `dial-version` is the
   Qt Dial's version.
6. **Message text is cleaned** (React only scrubbed keys of structured data).
7. `sendDefaultPii: false`: sentry-native has no such option on Linux (only on the Switch); its one identifying
   default, `user.id` = an installation id, is removed. Events are `platform: native`, SDK `sentry.native`.
8. **Gate**: React initialises in its production build under Tauri; the Qt Dial with `DIAL_EXTERNAL_SERVICES=1`.
9. The slowdown monitor's frame source and context (above).

## How to test

Nothing here reaches a real service: the scenarios that start Sentry use a fake on 127.0.0.1, the others keep
it off, and the containers run with `--network none`. Never run the Dial with `DIAL_EXTERNAL_SERVICES=1` off
the machine.

```bash
# C++ (in the qt-dial-bookworm image): the rules, then the reporter end to end in child processes
cmake -S qt -B qt/build/tests -G Ninja -DDIAL_BUILD_TESTS=ON && cmake --build qt/build/tests
cd qt/build/tests && ctest -R sentry --output-on-failure
# the React detector test on the port
qt/scripts/js-tests.sh
# the real Dial binary (amd64 build with Sentry), Xvfb, a fake Sentry that also answers /api/v1/machine
qt/tests/sentry/dial-smoke.sh qt/build/amd64
```

- `tst_sentry_filter` (18 test functions, 35 results with the data rows): the gate (unset / 0 / non-local DSN / empty DSN are off; the machine gets React's
  DSN and `/meticulous-user/.cache/...`; local DSNs on), classification, React's sensitive keys, the text
  cleaning (16 cases, from `password=` to IPv6 and C++'s `a::b`), the machine's name, normalization, dedupe,
  the 10-in-10-min and 50-a-day caps, breadcrumb caps, the crash cap, limits across a restart, and the frame
  windows (an animation fills one, 10 Hz redraws and idle time count nothing, stalls of 80 ms and 1.5 s count).
- `tst_sentry_reporter` (9 test functions, ~12 s): (a) four "off" environments: not initialised, no database, no request;
  (b) qCritical with the release, dist and device tags, the earlier warning as a cleaned breadcrumb, five
  repeats sent once, a TypeError as an exception with its QML frame, no secret anywhere in the bodies; a QML
  engine (console.warn/error, a real TypeError, the `Sentry` singleton's `setDeviceInfo` and `captureMessage`
  with a sensitive tag and context dropped); 15 distinct errors → 10 events, and 0 after a restart;
  (c) a SIGSEGV → nothing sent from the crashing process, a fatal event with a `MDMP` minidump (~160 KB) on
  the next start; a `qFatal` → the crash report with its `qt_fatal` context; 5 crashes in a row → 3 reports;
  (d) an event made with the fake down waits in `<db>/cache` and is sent at the next start once it is up; one
  whose retries ran out is rearmed and sent.
- `dial-smoke.sh`: Sentry on from `DIAL_SENTRY_DSN`, the singleton and the monitor running, a `console.error`
  from the test port arrives with `serial`/`build-version`/`build-channel` from the fake `/api/v1/machine`,
  cleaned, with the warning before it as a breadcrumb, the journal output unchanged; a still Dial ≤ 3 % CPU
  (0.0-0.2 % measured); a 6 s GUI stall during the ready screen's animation after the warm-up → one
  "Dial UI sustained slowdown" (immediate, `max_frame_gap_ms` 6001); SIGTERM exits 0; and with no switch:
  `sentry: off`, `Sentry.enabled` false, nothing sent, no database.

Manually, against the fake: `python3 qt/tests/sentry/fake_sentry.py --port 18765 --out /tmp/fake-sentry`, then
the Dial with `DIAL_SENTRY_DSN=http://0123456789abcdef0123456789abcdef@127.0.0.1:18765/8`; envelopes land in
`/tmp/fake-sentry/envelopes.jsonl`.

## Build and package

- `qt/CMakeLists.txt`: `DIAL_WITH_SENTRY` (default ON) fetches the release at configure time (network needed
  once per build directory); offline: `-DFETCHCONTENT_SOURCE_DIR_SENTRY=<sentry-native.zip extracted>`;
  `-DDIAL_WITH_SENTRY=OFF` builds the same Dial without it (the module becomes no-ops). The project now enables
  C (sentry-native) besides C++.
- The image adds `libcurl4-openssl-dev` and `libcurl4-openssl-dev:arm64`.
- The package depends on `libcurl4` (bookworm 7.88.1); no extra files (breakpad needs no handler).
- Size (arm64): the binary 923,552 → 1,567,664 bytes (+644 KB; stripped 730,856 → 1,256,968); the .deb
  5,920,380 → 6,127,652 bytes (+207 KB).
