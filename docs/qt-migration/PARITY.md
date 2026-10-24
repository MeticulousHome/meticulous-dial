# Parity checklist: React Dial → Qt Dial

Every route of `src/navigation/routes.ts` and every feature outside the routes, with its state in the Qt Dial.
Details, deliberate differences and test lists per group in [parity/](parity/). Status: **done** (ported,
compared with the React Dial, covered by tests), **partial** (works, with the gaps noted), **missing**.
Out of scope: Pit's take / QTE.

Fidelity was checked screen by screen against the React Dial itself: its production web build in headless
Chromium against the same emulated backend, screenshots side by side (most screens within 1-2 px; text
antialiasing differs). On the machine (10.10.0.130, eglfs) see "Performance" at the end.

## Framework and app-wide behaviour

| Feature | React | Qt | Status | Notes |
|---|---|---|---|---|
| Window, rotation, fonts, colors | App.tsx, globals.css | main.qml, Core/Theme.qml | done | eglfs_kms, -90°; ABC Diatype / Mono / fontello |
| Route table and order | navigation/routes.ts | Core/Routes.qml | done | same 70 routes, same order |
| Route transitions (spring 450 ms, fade) | Transitioner.tsx, navigation.less | components/Router.qml, RouteHost.qml | done | title hand-over ported (never triggers, as in React) |
| Title pill, bottom title, profile pill with marquee | Transitioner Title, ProfileTitle.tsx | components/NavTitle.qml | done | |
| Bubble (spring slide, component switch, pinned) | Bubble.tsx, bubble.less | components/Bubble.qml | done | QuickSettings kept created (no hitch when it opens) |
| Menus with the yellow bar (mixins.ts) | styles/utils/mixins.ts | components/OptionsMenu.qml | done | hold-to-confirm, marquee, OS status line, version box, annotations, Chromium dashes |
| Context button toggles quick settings | App.tsx, Bubble.tsx | main.qml | done | |
| Bottom status (temp, weight, preheat funnel, offline, motor hot) | BottomStatus/* | components/BottomStatus.qml | done | |
| Socket.IO events → stores, status → screens | SocketProviderValue.tsx | Core/Backend.qml, src/socketio.cpp | done | status, sensors, button, notification, heater_status, water_status, profile, profileHover, OSUpdate, upload_report, settings; the Dial's own `profileHover` reaches the backend with its payload (it went out as `null` until `af29c3ae`, found by the integration journeys) |
| Knob / buttons → gestures | eventGestureMap | Core/Input.qml, components/GestureHandler.qml | done | the development keyboard keys too |
| Stores (screens, stats, notifications, wifi, settings, images slices) | store/features/* | Core/Nav, Stats, Notifications, UiState | done | |
| Profile context and queries | ProfileContext.tsx, useProfiles.tsx | Core/Profiles.qml, Core/HomeSelection.js | done | the React unit test of homeSelection passes against HomeSelection.js |
| Backend settings (polled 2 s), update | useSettings.tsx | Core/BackendSettings.qml | done | also refetches on the `settings` event |
| Device info, OS update status, online | useDeviceOSStatus, useIsOnline | Core/Device.qml | done | |
| Idle timer, sleep | useIdleTimer.tsx | Core/Idle.qml | done | |
| Notifications take the screen | useNotification.ts | main.qml | done | |
| REST API (espresso-api 0.15) | api/*.ts | Core/Api.qml | done | every call of the package |
| Circular keyboard | CircleKeyboard/** | components/CircleKeyboard.qml | done | shared by name, Wi-Fi password, report email, unlock, factory reset, country letter |
| Tauri: ready / home_ready markers | lib.rs | src/native.cpp | done | /run/meticulous-dial-ready, -home-ready |
| Tauri: get_os_local_time | local_time.rs | Native.localTime() | done | |
| Tauri: plugin-log (console → journal) | App.tsx forwardConsole | src/main.cpp message handler | done | syslog priorities |
| Tauri: community_* (Community uploader) | community_upload.rs, diagnostics.rs | src/community/ (C++) | done | same files and protocol as the Tauri Dial (interop tested both ways); not run against the real server |
| Community history scan after a shot | App.tsx | main.qml → Community.scanHistory() | done | |
| Free Pour pending sessions sync at start | App.tsx | main.qml → FreePourStorage.syncAtStartup() | done | |
| Mobile app's dispatched reports, headless | SocketProviderValue | main.qml → DispatchedReports.start() | done | |
| Tauri: get_profiles (offline prefetch) | profiles.rs | — | missing | disabled in React too (FIXME in useProfiles) |
| Tauri: dial_performance_*, resource snapshot, slowdown monitor | lib.rs, useDialSlowdownMonitor | Native.resourceSnapshot() | partial | the detector only reported to Sentry: not ported |
| Sentry | App.tsx | — | partial | no Sentry SDK for Qt in bookworm; errors go to the journal; a bug report still reaches support as its Sentry feedback (plain HTTP POST, on the machine only) |
| Boot animation (Lottie) and post-ready screen | ReadyAnimation.tsx | screens/brew/ReadyAnimation.qml | done | rlottie |
| Brightness 100 % at start | App.tsx | main.qml | done | again when the backend comes online |
| Service stop / restart | Tauri exits 0 on SIGTERM | src/main.cpp | done | a stop exits 0, so systemd does not hand it to crash-reporter (eglfs's VT handler exited 1) |
| No real services off the machine | — | src/netguard.*, `DIAL_EXTERNAL_SERVICES` | done | only the machine's launcher enables tickets, Sentry feedback and Community; tests and development runs reach only the backend |

## Screens (routes)

| Route(s) | React | Qt | Status | Notes |
|---|---|---|---|---|
| ready | ReadyAnimation | screens/brew/ReadyAnimation.qml | done | |
| profileHome | ProfileHomeScreen | screens/home/ProfileHome.qml | done | carousel, zoom, hold ring, slide-exit on delete |
| quick-settings | QuickSettings | screens/home/QuickSettings.qml | done | every context (profile, Free Pour, pour-over, brewing, Free Pour in progress, manual brew save), snake easter egg |
| heating | Heating/** | screens/brew/HeatingScreen.qml | done | water bubbles (baked Lottie), temperatures, options, long press (sw120 test passes) |
| barometer | Barometer/** | screens/brew/Barometer.qml | done | meter, target tick and trail of manual brews (meterGeometry, trailGeometry, manualTarget tests pass) |
| manual-purge | PurgePiston/**, MiniPurgePiston | screens/brew/PurgeScreen.qml | done | |
| brewComplete | BrewCompleteScreen | screens/brew/BrewCompleteScreen.qml | done | remove cup animation, double push (brewDoubleClick test passes) |
| shot_history | ShotGraph/** | screens/brew/ShotGraphScreen.qml | done | PlotLine graph |
| heat_timeout_after_shot | HeatTimeoutAfterShot | screens/brew/HeatTimeoutAfterShot.qml | done | |
| pressetSettings | PressetSettings, Pressets | screens/profile/PressetSettings.qml | done | save / discard / brew without saving, new profile |
| pressure, piston_position, motor_power, time, weight, flow, temperature, output | SettingNumerical | screens/profile/SettingNumerical.qml, Gauge.qml | done | |
| name | EditNameScreen | screens/profile/EditNameScreen.qml | done | |
| pressetProfileImage | PressetProfileImage | screens/profile/PressetProfileImage.qml | done | |
| settings, brewSettings, experimentalSettings, scrollDirections, tare_behavior, retraction_volume, advancedSettings, deviceInfo, deviceInfoQR, updateChannel, idleScreenSettings, factoryReset, manufacturingSettings, displayAlignment, community | Settings/** | screens/settings/ | done | |
| OSStatus | OSStatus | screens/settings/OSStatus.qml | partial | laid out from the code; nothing in React opens it |
| timeDate, timeConfig, dateConfig, timeZoneConfig, selectLetterCountry | TimeDate/** | screens/time/ | done | |
| countrySettings, timeZoneSettings | TimeZone/** | screens/time/ | partial | checked against the CSS only (the reference backend has no zone data) |
| wifiSettings, wifiModeSettings, wifiQrMenu, wifiDetails, KnownWifi, deleteKnowWifiMenu, connectWifiMenu, selectWifi, connectWifiViaApp, enterWifiPassword | Wifi/** | screens/wifi/ | done | lists tested with a fake of the Wi-Fi endpoints (the emulated backend stubs NetworkManager) |
| notifications | Notification | screens/notifications/Notification.qml | done | |
| bug-report, reportContactEmail | BugReport/** | screens/support/ | done | collection, hand-off, submission with BR-01..BR-11 (reportHandoff test passes) |
| helpUsImprove, shotDataSharingPrompt | ShotDataSharing/** | screens/support/ | done | |
| unlock, masterCalibrationLock | UnlockScreen | screens/misc/Unlock*.qml | done | |
| idle | IdleScreen/** | screens/idle/ | done | analog, digital 12/24 h, MetCat, DVD, Barista; dimming (digitalClockTime test passes) |
| (scale overlay), calibrateScale | Scale/** | screens/scale/ | done | Playwright scale-overlay cases ported but one (needs a live "click to start" mid-press) |
| snake | Snake | screens/misc/Snake.qml | done | |
| manualSetup | ManualModeSetup | screens/manual/ManualModeSetup.qml | done | manualSetup test passes; the brew's manual stages need the firmware (not in the emulated backend) |
| freePour, guidedPourOver, freePourHistory | features/freePour/** | screens/freepour/ | done | pourOverProfileContract and freePourSetup tests pass; local history keeps 16 brews (React 128) |
| dose | (no component in React) | — | n/a | |

## Tests

- React unit tests run against the Qt ports (`qt/scripts/js-tests.sh`): 11 of the 14 `tests/*.test.*` files
  pass unchanged (homeSelection, digitalClockTime, brewDoubleClick, sw120 heating long press, meterGeometry,
  manualTarget, trailGeometry, reportHandoff, pourOverProfileContract, freePourSetup, manualSetup). Not mapped:
  analogClockTime (3 of its cases fake the browser's Date; the others run in test_idle.py), postReadyScreen
  (a one-line rule inside ReadyAnimation.qml), slowdownDetector (not ported).
- End-to-end (`qt/scripts/e2e.sh`, 177 tests in `qt/tests/e2e/`): 161 passed, 13 skipped, 3 xfailed and one
  teardown error since fixed (TESTING.md has the list and why).
- Integration journeys with the real backend and fika-sil (`qt/tests/integration/`, meticulous-integration's
  31 Dial journeys unchanged): 28 passed, 2 xfailed as on React, 1 failing by design of the no-real-services
  guard (parity/integration.md).

## Performance on the machine (10.10.0.130, eglfs, frames that reach the panel)

Final package (`0.1.0+1770.gaf29c3ae`), 2026-10-24, `qt/tools/perf/flipsrun.py` and `fake_shot.py`:

| Scenario | fps while moving | frames on consecutive vblanks | worst frame |
|---|---|---|---|
| Home carousel, one detent at a time / fast spin | 63.7 / 63.7 | 100 % / 99.3 % | 18.6 / 21.3 ms |
| Quick settings open, scroll, close | 65.1 (the counter double-counts a few) | 97.7 % | 18.5 ms |
| Bubble component switch (quick settings → config) | 64.9 | 96.4 % (the rest double-counted, none late) | 21.6 ms |
| Route transitions | 62.8 | 98 % (2 frames on the second vblank) | 35.8 ms |
| Heating (bubbles) / extraction (live meter and graph) / brew complete, made-up shot | 61.8 / 62.6 / 63.5 | 98.8 % / 98.9 % / 100 % | 87 / 89 / 17.5 ms (the screen being created at the route change) |
| Nothing moving | 0 frames, 2.2 % CPU | | |

Memory ~145 MB RSS (WebKit Dial: 330-540 MB), stable over a 20-minute loop. Start: first frame 1.1 s after the
service starts. Remaining cost: creating a screen takes 100-250 ms on the A53 before its transition starts
(latency, not a dropped frame mid-animation; it shows as the one or two late frames at heating → extraction);
the most used bubble menu is created ahead of time.

## What is missing or different (honest list)

- **Sentry**: no Sentry SDK for Qt in bookworm. Errors go to the journal; the slowdown detector (it only
  reported to Sentry) is not ported. The bug report's Sentry feedback is sent by hand, as before.
- **Not checked against real services**: the Community uploader (interop with the Tauri files tested both
  ways, protocol ported, never run against the real server: tests are kept off it on purpose); the bug report's
  real ticket service (ported; off the machine it ends in BR-03/BR-05 by design of the guard).
- **Partial screens**: OSStatus (nothing in React opens it), countrySettings / timeZoneSettings (checked
  against the CSS only, the reference backend has no zone data).
- **Free Pour local history** keeps 16 brews (React 128).
- **Tauri `get_profiles` offline prefetch**: not ported (disabled in React too).
- **Tests not run here**: the Wi-Fi list journeys need a Wi-Fi fake (6 skipped: the emulated backend stubs
  NetworkManager); changing the Wi-Fi mode, the shot-data-sharing prompt, dispatched reports and "help us
  improve" need a backend of their own (`DIAL_PRIVATE_BACKEND=1`); scale calibration needs a loaded scale
  (xfail); meticulous-integration's mobile journeys still open the React Dial; nothing is wired into CI.
- **Requests from the integration overlay** (test port only): a pill probe, and the text list covering the
  whole canvas.
- **Machine use**: validated on one office machine (10.10.0.130) with the frame meter, a 20-minute soak, a
  reboot, the nightly restart and switching both ways; not in daily use yet.
