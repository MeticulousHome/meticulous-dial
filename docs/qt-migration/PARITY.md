# Parity checklist: React Dial → Qt Dial

Every route of `src/navigation/routes.ts` and every feature outside the routes, with its state in the Qt Dial.
Details per group in [parity/](parity/). Status: **done** (ported and checked), **partial** (works, with the
gaps noted), **missing**. Out of scope: Pit's take / QTE.

## Framework and app-wide behaviour

| Feature | React | Qt | Status | Notes |
|---|---|---|---|---|
| Window, rotation, fonts, colors | App.tsx, globals.css | main.qml, Core/Theme.qml | done | eglfs_kms, -90°; ABC Diatype / Mono / fontello |
| Route table and order | navigation/routes.ts | Core/Routes.qml | done | same 70 routes, same order |
| Route transitions (spring 450 ms, fade) | Transitioner.tsx, navigation.less | components/Router.qml, RouteHost.qml | done | title hand-over ported (never triggers, as in React) |
| Title pill, bottom title, profile pill with marquee | Transitioner Title, ProfileTitle.tsx | components/NavTitle.qml | done | |
| Bubble (spring slide, component switch, pinned) | Bubble.tsx, bubble.less | components/Bubble.qml | done | QuickSettings kept alive (no hitch) |
| Context button toggles quick settings | App.tsx, Bubble.tsx | main.qml | done | |
| Bottom status (temp, weight, preheat funnel, offline, motor hot) | BottomStatus/* | components/BottomStatus.qml | done | |
| Socket.IO events → stores, status → screens | SocketProviderValue.tsx | Core/Backend.qml, src/socketio.cpp | done | status, sensors, button, notification, heater_status, water_status, profile, profileHover, OSUpdate, upload_report, settings |
| Knob / buttons → gestures | SocketProviderValue eventGestureMap | Core/Input.qml, components/GestureHandler.qml | done | dev keyboard keys too |
| Stores (screens, stats, notifications, wifi, settings, images slices) | store/features/* | Core/Nav, Stats, Notifications, UiState | done | |
| Profile context and queries | context/ProfileContext.tsx, hooks/useProfiles.tsx | Core/Profiles.qml | done | profile events, hover from the app, last profile |
| Backend settings (polled 2 s), update | hooks/useSettings.tsx | Core/BackendSettings.qml | done | also refetches on the `settings` event |
| Device info, OS update status, online | useDeviceOSStatus, useIsOnline | Core/Device.qml | done | |
| Idle timer, sleep | useIdleTimer.tsx | Core/Idle.qml | done | |
| Notifications take the screen | useNotification.ts | main.qml | done | |
| REST API (espresso-api 0.15) | api/*.ts | Core/Api.qml | done | every call of the package |
| Tauri: ready / home_ready markers | lib.rs | src/native.cpp | done | /run/meticulous-dial-ready, -home-ready |
| Tauri: get_os_local_time | local_time.rs | Native.localTime() | done | |
| Tauri: plugin-log (console → journal) | App.tsx forwardConsole | src/main.cpp message handler | done | syslog priorities |
| Tauri: community_* | community_upload.rs | src/community (C++) | in progress | see parity/community.md |
| Tauri: get_profiles (offline prefetch) | profiles.rs | — | missing | disabled in React too (FIXME in useProfiles) |
| Tauri: dial_performance_*, get_dial_resource_snapshot, slowdown monitor | lib.rs, useDialSlowdownMonitor | Native.resourceSnapshot() | partial | detector reported to Sentry only; not ported |
| Sentry | App.tsx | — | missing | no Sentry SDK for Qt in bookworm; errors in the journal |
| Boot animation (Lottie) and post-ready screen | ReadyAnimation.tsx | screens/brew/ReadyAnimation.qml | done | rlottie |
| Brightness 100 % at start | App.tsx | main.qml | done | |
| Community history scan after a shot | App.tsx | main.qml communityScanRequested | partial | wired when Community lands |
| Free Pour pending sessions sync at start | App.tsx | — | in progress | freepour group |

## Screens (routes)

| Route | React | Qt file | Group | Status |
|---|---|---|---|---|
| ready | ReadyAnimation | screens/brew/ReadyAnimation.qml | core | done |
| profileHome | ProfileHomeScreen | screens/home/ProfileHome.qml | core | done |
| quick-settings | QuickSettings | screens/home/QuickSettings.qml | core | done |
| heating, barometer, manual-purge, brewComplete, shot_history, heat_timeout_after_shot | Heating, Barometer, PurgePiston, BrewCompleteScreen, ShotGraph, HeatTimeoutAfterShot | screens/brew/ | brew | in progress |
| pressetSettings, pressure, piston_position, motor_power, time, weight, flow, temperature, output, name, pressetProfileImage | PressetSettings, SettingNumerical, EditNameScreen, CircleKeyboard, PressetProfileImage | screens/profile/, components/CircleKeyboard.qml | profile | in progress |
| settings, brewSettings, experimentalSettings, scrollDirections, tare_behavior, retraction_volume, advancedSettings, deviceInfo, deviceInfoQR, updateChannel, idleScreenSettings, factoryReset, manufacturingSettings, displayAlignment, OSStatus, community | Settings/** | screens/settings/ | settings | in progress |
| timeDate, timeZoneConfig, timeConfig, dateConfig, selectLetterCountry, countrySettings, timeZoneSettings | Settings/Advanced/TimeDate/** | screens/time/ | settings | in progress |
| wifiSettings, wifiModeSettings, wifiQrMenu, wifiDetails, KnownWifi, deleteKnowWifiMenu, connectWifiMenu, selectWifi, connectWifiViaApp, enterWifiPassword | Wifi/** | screens/wifi/ | wifi | in progress |
| notifications | Notification | screens/notifications/Notification.qml | support | in progress |
| bug-report, reportContactEmail, helpUsImprove, shotDataSharingPrompt | BugReport/**, ShotDataSharing/** | screens/support/ | support | in progress |
| unlock, masterCalibrationLock | UnlockScreen | screens/misc/ | support | in progress |
| idle | IdleScreen/** | screens/idle/IdleScreen.qml | idle | in progress |
| (scale overlay), calibrateScale | Scale/** | screens/scale/ | idle | in progress |
| snake | Snake | screens/misc/Snake.qml | idle | in progress |
| manualSetup | ManualModeSetup | screens/manual/ManualModeSetup.qml | freepour | in progress |
| freePour, guidedPourOver, freePourHistory | features/freePour/** | screens/freepour/ | freepour | in progress |
| dose | (no component in React) | — | — | n/a |
