# Parity: settings (group "settings")

Qt files: `qt/qml/Dial/screens/settings/` and `qt/qml/Dial/screens/time/` (one file per route, plus the
group's parts below), the tests `qt/tests/e2e/test_settings.py`.

Group parts: `settings/SettingsStore.qml` (singleton, local `qmldir`: the root password and manufacturing
menu caches of the React queries, and the Community uploader seen by these screens), `settings/Retraction.js`
(utils/retraction.ts), `settings/IdleScreens.js` (the IdleScreens list), `settings/DimScreen.qml`
(useDimScreen), `settings/SettingsGauge.qml` (SettingNumerical/Gauge.tsx for the retraction volume; the
profile group's SettingNumerical is not used), `time/LocalClock.qml` (useCurrentTime / utils/localTime.ts on
`Native.localTime()`), `time/AnimatedCounter.qml` (react-animated-counter 1.9), `time/RegionList.qml`
(Timezone.styled.tsx).

The layouts were measured on the React Dial itself (its web build in Chromium at 480 x 480, DOM boxes and
screenshots; `dial-sim` image, an older build than `src/`) and the Qt screens grabbed side by side: the menus,
Device Info QR, Factory reset (the shaped warning), Set Time / Set Date, the retraction gauge, Auto Tare,
Community (connect, unavailable) and the region lists' title and first entry line up.

| Feature | React source | Qt file | Status | Notes |
|---|---|---|---|---|
| config menu: Device Info, Community: <state>, time & date, sounds (toggle), calibrate scale, Scroll Directions, Advanced Settings, Back; bare labels before the settings | Settings/Settings.tsx | settings/Settings.qml | done | no marquee in the bar (React gives the inner options no `$isMarquee`) |
| Brew Settings: Start / Purge toggles, Retraction distance (mL), Auto Tare (Unavailable when unsupported), Pre/Post-heat, Back; device info refetched every 10 s | Settings/BrewSettings.tsx | settings/BrewSettings.qml | done | non-boolean unknown keys log "not yet implemented" |
| Experimental: Manual mode (bubble closed but still intercepting, then manualSetup), Back | Settings/Experimental.tsx | settings/ExperimentalSettings.qml | done | |
| Scroll Directions: Profiles / Keyboard Reversed or Classic, toggled | Settings/ScrollDirection.tsx | settings/ScrollDirectionSettings.qml | done | |
| Auto Tare route: After / Before retraction, "current", focus on the stored one once the settings are there, Back → previous screen + Brew Settings | Settings/TareBehavior.tsx | settings/TareBehavior.qml | partial | the grey "current" box sits 19 px right of React's (core OptionsMenu, see requests) |
| Retraction volume route: gauge 80-150 ml, 1 ml steps, stored value (or 100 until the settings arrive, then once), push saves mm + previous screen + Brew Settings, loading ring without settings, useDimScreen | Settings/Advanced/RetractionVolume.tsx, SettingNumerical/Gauge.tsx, gauge.css, utils/retraction.ts | settings/RetractionVolume.qml, SettingsGauge.qml, Retraction.js | done | gauge ring with Arc (r 227.1, centre 241/239 as the 460 px SVG puts it), padded digits at 20 % |
| Advanced Settings: SSH toggle, Display Alignment Screen, Update channel (hidden with limited access), Select Idle Screen: <short>, ROOT PASSWORD (case kept, ***** until known, cached 60 s), Factory reset, Manufacturing Options (GET /manufacturing 200, not 204), Back; focus clamped when the list shrinks | Settings/Advanced/Advanced.tsx, hooks/useSettings useRootPassword, hooks/useManufacturing | settings/AdvancedSettings.qml, SettingsStore.qml | done | |
| Device Info: QR entry, every /machine field (ENABLED/DISABLED, UNSET), repositories backend/dial/firmware, Back; loading ring; refetched on open | Settings/Advanced/DeviceInfoScreen.tsx | settings/DeviceInfoScreen.qml | done | |
| Device info QR: "SN: BATCH: COLOR:" (react-qr-code 256 px, level L, 16 px padding), hint, Back bar, push or 30 s → Device Info, "Loading..." | Settings/Advanced/InfoQrCode.tsx, QR/QrImage.tsx, quick-settings.css | settings/InfoQRCode.qml | done | QrCode item; the 20 px margins of `.settings-explanation` kept (the box overflows right as in React) |
| Update channel: stable / beta with "current", Back | Settings/Advanced/UpdateChannel.tsx | settings/UpdateChannel.qml | partial | annotation offset (core) |
| Idle screen: four clocks with "current"; push stores it and 300 ms later forces idle + bubble reopen | Settings/Advanced/IdleScreenSetting.tsx | settings/IdleScreenSetting.qml, IdleScreens.js | partial | annotation offset (core) |
| Factory reset: shaped warning, "!! Factory reset !!" / Back (Back focused), serial prompt on the full-screen circle keyboard ("Enter Serial Number" / "Serial does not match"), Community.factoryResetLocal() then GET /machine/factory_reset?confirm=true, loading ring while pending and after success | Settings/Advanced/FactoryReset.tsx, FactoryReset.css, settings.css, api.ts factoryReset | settings/FactoryReset.qml | done | the warning's line breaks are the ones Chromium renders with the shape-outside floats (only the first line is indented) |
| Manufacturing: one toggle per schema element with the values POST /manufacturing {} answers, ACAIA master calibration (closes the bubble, masterCalibrationLock, warning notification), Back; loading until both answers | Settings/Advanced/Manufacturing.tsx, hooks/useManufacturing.ts | settings/Manufacturing.qml | done | notification id: a local uuid v4 |
| Display alignment route: one white line 1 % wide in the middle; push → previous screen (home if none) + Advanced Settings | Settings/Advanced/DisplayAlignment.tsx | settings/DisplayAlignment.qml | done | |
| OS status: status line + Back in the 8-slide vertical Swiper (Back centres slide 1, as React's slideTo) | OSStatus/OSStatus.tsx, OSStatus.css | settings/OSStatus.qml | partial | geometry computed from the Swiper settings, not measured (no route or menu opens it in React) |
| Community: unavailable / connect (QR 256 px in a 276 x 280.8 white box, countdown, "Try again" after a failure or expiry) / connected (status grid, Back, Pause/Resume uploads, Disconnect) / disconnect confirmation / "Connected to Community" after pairing; "Working..." while a call runs; errors in red | Settings/Community/Community.tsx, Community.css, hooks/useCommunityUpload.ts | settings/Community.qml | done | driven by Dial.Native's Community through `SettingsStore.community` (see requests) |
| Loading rings of the bubble screens cover the whole display (`.loading-center` is `position: fixed`) | LoadingScreen/loadingScreen.css | DeviceInfoScreen, FactoryReset, Manufacturing | done | the core LoadingScreen shifted by -60 px in the bubble |
| time & date: Set time zone: <zone or Not set>, Time format 24/12-hour (one update at a time), Set Time / Set Date from the OS clock every second ("--" before), Back | Settings/Advanced/TimeDate/TimeDateConfig.tsx, useCurrentTime, utils/localTime.ts, digitalClockTime uses24HourClock | time/TimeDate.qml, LocalClock.qml | done | |
| Set Time: zone, HH:MM rolling digits (Mono light 110 px, hours min 130 px, minutes 2 x 65 px), hours/minutes switch on push, knob ±1 h / ±1 min, long press sets the OS time (POST /machine/time), double press aborts | TimeDate/TimeConfig.tsx, TimeConfig.css | time/TimeConfig.qml, AnimatedCounter.qml | done | |
| Set Date: DD.MM.YYYY (60 px, min 70 px), day → month → year, Date roll-over, long press sets, double press aborts | TimeDate/DateConfig.tsx | time/DateConfig.qml, AnimatedCounter.qml | done | |
| Rolling digits: columns 9..0, spring stiffness 328 / damping 22 / mass 0.84 per frame (half velocity on retarget), 500 ms colour pulse once until settled, 160 ms colour transition, `.activeClock` colour overridden by the pulse | react-animated-counter 1.9 (AnimatedCounter.js, useSpringColumnTransform.js, styles.css) | time/AnimatedCounter.qml | done | FrameAnimation, running only while a column moves |
| Time zone menu: Automatic ENABLED/DISABLED toggle, Select Timezone (manual only: closes the bubble → letter keyboard), Back | TimeZone/TimeZoneConfig.tsx | time/TimeZoneConfig.qml | done | |
| Country letter: circle keyboard (letters), a letter → countries, cancel → home + time zone menu, useDimScreen | TimeZone/SelectLetterCountry.tsx | time/SelectLetterCountry.qml | done | the profile group's CircleKeyboard |
| Countries / cities: Back + entries (40 px, capitalised, 50 px + 2 px, 150 ms ease slide), focused yellow, others #e7e7e7 at 56 %, zone name beside the focused city, 8 s marquee past 24 characters, black gradient, title; city stores time_zone, reopens the time zone menu and goes to the barometer | TimeZone/CountrySettings.tsx, TimeZoneSettings.tsx, Timezone.styled.tsx | time/CountrySettings.qml, TimeZoneSettings.qml, RegionList.qml | done | the reference build had no zone data: entries checked against the styled components, Back / title against the React DOM |
| Journeys | meticulous-integration test_dial_settings.py (brew settings), test_dial_02_home.py (device info) | qt/tests/e2e/test_settings.py | done | see "Tests" |

## Differences on purpose

- RetractionVolume ignores gestures while the bubble intercepts them. React's handler only waits for the
  settings, so with the quick settings open over the gauge every turn and push would also change and save
  the retraction (and a push would navigate away).
- A push on an entry that does not exist (empty lists while loading, a list that shrank under the focus)
  does nothing; React throws on `undefined.key` (DeviceInfoScreen, Manufacturing, TimeZoneConfig, FactoryReset
  while loading). TimeZoneConfig acts on the entry shown (the clamped focus).
- DeviceInfoScreen: a repository commit without "-" shows an empty comment (React throws); InfoQRCode: a null
  colour shows "" (React throws).
- Community without an uploader in the build shows "Community Unavailable" (the brief); React in a browser
  would show the failed-enrollment state. The first enrollment starts after the bindings settle
  (`Qt.callLater`), as React's effect runs after the render.
- The bubble screens listen only while the bubble intercepts (CONVENTIONS), also when shown as a route (they
  never are in React). InfoQRCode, OSStatus and Community have no ignore condition in React: they listen
  whenever they are shown.
- FactoryReset's warning is drawn as eight fixed lines (Qt has no `shape-outside`): the breaks and the first
  line's indent are Chromium's.

React behaviour kept as is (noted):
- TimeZoneSettings goes to the barometer after storing a zone (the barometer returns home while idle).
- "Update channel: " shows the raw value ("undefined" when absent); "Select Idle Screen: undefined" for an
  unknown idle screen.
- Settings' Community label says "Not connected" for the unavailable state too.
- The active Set Time / Set Date field flashes light grey → yellow → light grey when its digit changes (the
  CSS pulse animation overrides the `.activeClock` colour while it runs).

## Not done

- The real Community service was not driven end to end: the tests use a stand-in with the C++ API in
  `SettingsStore.communityOverride`, installed before the Community screen opens, so that no pairing code is
  requested from community.meticuloushome.com. (Before that, while the build gained the real uploader, a few
  test runs opened the screen with it and may have requested codes for the emulated serial.)
- The country and city lists were not compared with a live React rendering of entries (the reference
  backend has no zone data); OSStatus not measured (unreachable).
- Set Time's long press is checked to return to time & date; the emulated backend only records the
  `timedatectl` call (not read by the test).

## Requests for the core

1. **OptionsMenu annotations** (`MenuAnnotation`, mixins.ts): the grey list's annotation has
   `margin-right: 1.2rem` (19.2 px) in React (`$marginRigth="1.2rem"` on the outer `SelectedOption`), so it
   lines up with the black one in the bar; OptionsMenu uses 16 px for both. On a full-screen menu (Auto Tare)
   the grey "current" then shows its last letters right of the bar (React shows only the box edge). The
   annotation also inherits the option's `letter-spacing: 2.2px` (77 px wide in React for "current") and is
   24 px tall (15 + 5 + 2 padding + borders, margin-top -5). Suggest an `outerAnnotationMargin` (19.2) and
   the letter spacing on `annotationText`.
2. **BackendSettings.update**: an answer that is not a settings object becomes `data` until the next poll.
   The emulated backend answers an SSH change with `{"status":"error",...}` followed by the settings (two JSON
   documents), so the screens see a string for up to 2 s (React's setQueryData does the same). Keeping `data`
   (and refetching) when the answer is not an object would avoid the flicker.
3. **Community naming**: inside `screens/settings/` the identifier `Community` is the route file
   `Community.qml` (fixed by Routes.qml), which shadows Dial.Native's `Community`. The group reaches the
   singleton through `SettingsStore.community` (`import Dial.Native as DialNative`). Other code in this
   directory must not use the unqualified name.

## Tests

`qt/tests/e2e/test_settings.py`, 34 tests, against an emulated backend of the group's own (port 18097) and
the Dial on test port 9323: all pass. They put back every setting they change (`restore` fixture) and never
type the machine's serial into the factory reset.
