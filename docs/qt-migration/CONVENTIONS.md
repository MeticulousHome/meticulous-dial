# Porting a screen to the Qt Dial: conventions

The React code in `src/` is the specification. A ported screen does what the React screen does, with the
same sizes, colors, fonts, curves and timings, and reacts to the same gestures. Read the React component,
its CSS/LESS/styled-components and the hooks it uses before writing QML.

## Layout of `qt/`

```
qt/src/                 C++ host: main.cpp, Socket.IO client, Native helpers, PlotLine, LottieItem
qt/qml/main.qml         the window: router, bottom status, bubble, scale overlay, App.tsx logic
qt/qml/Dial/qmldir      module "Dial": shared components (and it imports Dial.Core)
qt/qml/Dial/Core/       module "Dial.Core": the singletons (stores, API, navigation), Motion.js, Constants.js
qt/qml/Dial/components/ shared components (OptionsMenu, Arc, NavTitle, GestureHandler, ...)
qt/qml/Dial/screens/<group>/   one file per route (Routes.qml maps route -> file), plus the group's own parts
qt/qml/Dial/assets/     fonts/, public/ (images), icons/, lottie/
qt/tests/e2e/           end-to-end tests (pytest) through the Dial's test port
```

Every screen file starts with `import QtQuick` and `import Dial` (that brings the Core singletons, Motion
and Constants too) and, when it needs C++ types, `import Dial.Native` (Native, Socket, PlotLine, LottieItem).
Files of a group can use each other by file name (same directory). A group that needs its own shared state
puts a singleton in its directory with a local `qmldir` (`singleton WifiStore 1.0 WifiStore.qml`, no `module`
line).

## A screen

- The root is an `Item { anchors.fill: parent }`. Route props come as properties (`property string type`
  for SettingNumerical). Optional: `property bool transitioning` (set while the route animates),
  `property bool inBubble` (set when shown inside the bubble).
- The route's titles (title pill, bottom title) are drawn by the router from `Routes.qml`; do not draw them.
- Gestures: a `GestureHandler` with the same condition the React `useHandleGestures(handlers, ignore)` has,
  inverted: `enabled: !(<React ignore condition>)`. React's `right` / `left` are `onTurnRight` / `onTurnLeft`;
  the others keep their names (`onPressDown`, `onPressUp`, `onClick`, `onDoubleClick`, `onContext`,
  `onLongEncoder`, `onSingleTare`, `onDoubleTare`, `onLongTare`, `onTareDown`, `onTareUp`). A leaving route is
  disabled, so it hears nothing (React's VisibilityContext). A handler that comes on during a gesture (the
  bubble closed by that press, a screen it opened) hears the next gesture, not that one, as in React.
  Typical: a route screen `enabled: !Nav.bubbleInterceptsGesture`; a bubble menu `enabled: Nav.bubbleInterceptsGesture`.
- Menus: use `OptionsMenu` (the mixins.ts menu with the yellow bar): `options` = `[{ key, label, hasSeparator,
  longpress, caseSensitive, annotation, color }]`, move `activeIndex` (or `next()` / `previous()`), handle
  `holdFinished()` for long-press options. It exposes `dialFocusedLabel` to the tests. A screen with its own
  kind of focus sets `readonly property string dialFocusedLabel` on its root.
- Test probes: a screen may expose `readonly property <type> dialProbe_<name>` for tests (TestServer "probe").

## Singletons (qt/qml/Dial/Core)

| Singleton | React | What |
|---|---|---|
| `Nav` | screens slice | `screen`, `prev`, `setScreen(name)`, `bubbleVisible`, `bubbleComponent`, `bubbleInterceptsGesture`, `bubblePinned`, `setBubbleDisplay({visible, component, interceptsGesture})`, `closeBubble(intercepts)`, `openBubble(component)`, `setBubblePinned(b)` |
| `Routes` | routes.ts | `table`, `route(name)` (url, title, parent, bottomStatusHidden, props...) |
| `Input` | HandleEvents | `gesture(type, t)` signal (use GestureHandler instead) |
| `Api` | api/*.ts, espresso-api | every REST call as a Promise of the parsed body (rejects with `{status, data, message}`); `get/post/put/del(path, body, {timeout})`; `profileImageUrl(image)`, `wifiQrUrl()`, `base` |
| `Backend` | SocketProviderValue | `action(name)` (socket `action`), `continueBrew()`, `emitEvent(name, data)`, `connected`, signals `uploadReport(event)`, `connectedToServer()` |
| `Stats` | stats slice | `status` (raw), `name`, `machineState`, `extracting`, `sensors {p,f,w,t,g}`, `time`, `profileTime`, `profile`, `setpoints`, `loadedProfile`, `sensorData`, `waterStatus`, `preheatTimeLeft`, `scaleConnected`, setters |
| `Profiles` | ProfileContext + profile queries | `profiles`, `mergedProfiles`, `lastProfile`, `localProfileIndex`, `localProfile`, `localHoverState`, `homeCardSelected`, `detailProfileSelected`, `isCreatingProfile`, `settingsIndex`, `settingsProfile`, `profileStarting`, `homeMode`, `selectedPourOverProfileId`, `pourOverProfiles`, `defaultProfiles`, `simpleProfile`, `defaultImages`, `limitedAccess`; `refetch()`, `saveProfile(p)`, `deleteProfile(id)`, `addSettingsToProfile`, `applySettingsToProfile`, `newProfileFromTemplate`, `homeSelection(option)`, `activeOption`, `freePourOptionIndex`, `newOptionIndex`, `parsePourOverProfile` (hook for the Free Pour contract) |
| `BackendSettings` | useSettings / useUpdateSettings | `data` (Settings or null; polled every 2 s), `update(partial)` (Promise), `value(key, fallback)`, `limitedAccess` |
| `Device` | useDeviceInfo / useOSStatus / useIsOnline | `info`, `infoPending`, `refreshInfo()`, `osStatus {status, progress, info}`, `osStatusError`, `isOnline` |
| `Notifications` | notification slice | `items`, `count`, `motorHot`, `load()`, `addOne`, `removeOne`, `removeAll` |
| `Idle` | useIdleTimer | `isIdle`, `resetTimer()`, `setTimer(ms)`, `forceIdle()`, `forceBubbleReopen` |
| `UiState` | settings / wifi / images slices | `countryLetter`, `country`, `selectedWifi`, `selectedWifiUseKnownCredentials`, `selectedWifiToDelete`, `selectWifi()`, `profileImages`, `addNewImageProfile()` |
| `ManualMode` | useManualBrew, api/manualMode.ts | `isManualProfile`, `isManualBrew`, `activeControl`, `streamedTarget`, `createProfileFromManualBrew(name)` |
| `Theme` | globals.css, colors.ts | fonts (`fontRegular`, `fontThin`, `fontMono`, `fontIcons`), colors, menu sizes, `asset(path)`, `publicImage(path)` |
| `Motion` (JS) | spring plugin, keyframes | `spring`, `routeSpring`, `bubbleSpring`, `keyframes([[t, v]...], t)`, `fadeIn/fadeOut`, easing curves `EASE`, `EASE_IN`, `EASE_OUT`, `EASE_IN_OUT`, `MATERIAL` |
| `Constants` (JS) | constants/*.ts | `HIDDEN_STAGES`, `MACHINE_OWNED_STAGES`, `MANUAL_MODE_PROFILE_ID`, `DEFAULT_SETTING`, ... |
| `QrCode` (C++ item) | react-qr-code | `value`, `level` (L/M/Q/H), `color`, `background`, `margin` (modules); crisp at any size |
| `CircleKeyboard` (component) | CircleKeyboard.tsx | `name`, `defaultValue`, `onlyLetters`, `capitalizeFirstLetter`, `ignoreGestures`, `prefix`, `suffix`; signals `submitted(text)`, `cancelled()`, `edited(text)`, `longPressed()` (the profile group ports it; until then a placeholder with the same API) |
| `Native` (C++) | Tauri commands | `apiUrl`, `localTime()` (get_os_local_time), `storageGet/Set/Remove` (localStorage / IndexedDB), `readTextFile`, `writeTextFile`, `monotonicMs()`, `resourceSnapshot()`, `log(level, msg)` |

Do not edit `qt/qml/Dial/Core/`, `qt/qml/Dial/components/`, `qt/qml/main.qml` or `qt/src/`: other people work in
them at the same time. If a screen needs something there, write it in your group's directory, or note the
request in your parity file ("Requests for the core") and work around it.

## Fidelity and performance on the machine

The machine is an i.MX8M Nano (4 x A53, GPU GC7000UL with OpenGL ES 2.0 only). Target: 63.5 fps, no
dropped frames, in every animation.

- Sizes in px as the CSS computes them (mind `box-sizing: content-box`: padding and borders add up).
- Line heights: in the Dial's WebKit `line-height: normal` is 1 em for ABC Diatype and Diatype Mono (1.24 em
  for the thin cut), Qt's font metrics give 1.25 em: a CSS box of normal line height is `height: fontSize`
  with `verticalAlignment: Text.AlignVCenter` (centering then matches Chromium).
- Fonts: `Theme.fontRegular` ('ABC Diatype'; weight 300 = `Font.Light`), `Theme.fontThin` (weight 200),
  `Theme.fontMono` ('ABC Diatype Mono'), `Theme.fontIcons` (fontello). `letter-spacing: 0.1em` at 22 px is
  `font.letterSpacing: 2.2`. `text-transform: uppercase` is `font.capitalization: Font.AllUppercase`.
- Animations: same durations and curves. CSS `ease` = `Easing.Bezier` with `Motion.EASE`; keyframes with
  `Motion.keyframes`; the springs with `Motion.spring`. Prefer `Behavior`/`NumberAnimation` on numbers that
  drive `x`, `y`, `scale`, `opacity`, `rotation` (all cheap on the GPU).
- Circles and arcs (SVG circles with dashes, CSS round borders): `Arc` (shader, antialiased, cheap).
- Plots and lines: `PlotLine` (C++, antialiased triangle mesh). Not Canvas (QPainter, ~10 ms a frame on the
  Nano) and not Shapes for thin lines (not antialiased on this GPU). Shapes is fine for big filled areas.
- Static vector icons: an SVG file in `qml/Dial/assets/icons/<group>-<name>.svg` shown with `Image`
  (`sourceSize` set to the CSS size); rasterized once, antialiased.
- Lottie: `LottieItem` (rlottie, handles precomps and mattes; `source`, `loops` (-1 forever), `startFrame`,
  `endFrame`, `play()`, `stop()`, `gotoAndPlay(frame)`, `gotoAndStop(frame)`, `finished()`); copy the JSON into
  `qml/Dial/assets/lottie/`. Neither rlottie nor Qt Lottie run expressions: an animation that loops with
  `loopOut()` needs its keys baked (see the prototype's `lottie_qt.py` idea).
- No Qt5Compat graphical effects, no `layer.enabled`, no ShaderEffect over large areas (fill rate is short).
- `Repeater` over a JS array rebuilds every delegate when the array is reassigned: for lists that change
  often use `model: array.length` and read `array[index]`, or a `ListModel`.
- No timers ticking faster than needed; nothing animating while invisible (`running: visible && ...`).

## Testing

- `qt/scripts/build.sh amd64` builds the binary for the container (only needed after C++ changes).
- `qt/scripts/dev-backend.sh start` (port 18080) is meticulous-backend in emulation mode; it is shared.
  For flows that change machine state (shots), start your own: `DIAL_BACKEND_NAME=qt-dial-backend-brew
  PORT=18081 STATE=$HOME/.cache/qt-dial-backend-brew qt/scripts/dev-backend.sh start` and run the Dial with
  `API=http://127.0.0.1:18081`.
- `DIAL_RUN_NAME=qt-dial-run-<group> TEST_PORT=<93xx> qt/scripts/run-dev.sh start [--screen=<route>]` runs your
  own instance under Xvfb; `... run-dev.sh ctl state | texts | focused | gesture right | button CONTEXT |
  push | screen <route> | grab /repo/qt/build/<file>.png | eval <js>`; `... run-dev.sh logs`.
  QML changes need only `run-dev.sh restart`. Screenshots are 480 x 480 straight alpha: composite over black
  (`qt/scripts/strip.py` does it for side-by-side strips).
- End-to-end tests: `qt/tests/e2e/test_<group>.py` with the `screen` and `backend` fixtures (`qt/tests/e2e/dial.py`
  has the controls and the waits, named as in meticulous-integration's `tests/dial_app.py`). Port the relevant
  journeys of meticulous-integration (`~/work/meticulous-integration/tests/test_dial_*.py`) and the cases of
  the JavaScript unit tests (`qt/tests/js`). Run: `DIAL_RUN_NAME=... DIAL_TEST_PORT=<93xx> qt/scripts/e2e.sh tests/e2e/test_<group>.py`.
- Do not deploy to a machine and do not run git commands that change the repository (commit, add, stash,
  checkout, reset): the coordinator commits and validates on the machine.

## Parity notes

Keep `docs/qt-migration/parity/<group>.md`: a table with one row per feature (React file → Qt file, status
done / partial / missing, notes), then "Differences on purpose", "Not done" and "Requests for the core".
