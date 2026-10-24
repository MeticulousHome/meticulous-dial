# Parity: idle group

The sleep screen and its clocks, the scale overlay, calibrate scale and Snake. Checked side by side with the
React components rendered by headless Chromium at 480 x 480 (a vite fixture outside the repo with the real
components, the redux store and mocked settings / Wi-Fi / brightness calls; the fake clock for the clocks
and the Lottie): every screen matches to a pixel or two, the weight text and the calibrate screen to the
pixel. The CSS layout quirks of the React screens (below) were measured there, not guessed.

Files: `qt/qml/Dial/screens/idle/` (IdleScreen, AnalogClock, DigitalClock, DVDIdleScreen, BaristaClock,
LocalClock, NetworkStatus, DimScreen, CurrentTime, clockTime.js), `qt/qml/Dial/screens/scale/` (Scale,
CalibrateScale), `qt/qml/Dial/screens/misc/Snake.qml`, assets `icons/idle-*`, `lottie/idle-metcat.json`,
`qt/tests/e2e/test_idle.py`, the `tests/digitalClockTime.test.mts` entry of `qt/tests/js/map.json`.

| Feature | React source | Qt file | Status | Notes |
|---|---|---|---|---|
| Idle route: clock chosen by `idle_screen` (default/analog → analog, digital, metCat, dvd, baristaBarista; anything else analog) | IdleScreen.tsx selectIdleComponent | idle/IdleScreen.qml | done | BackendSettings.data.idle_screen; switches live when the setting changes |
| Pixel shift: rotateZ 0 → -0.5° → 0 → 0.5° → 0 over 3600 s, ease per keyframe, around the middle of the clock's flow box | IdleScreen.tsx ShiftContainer | IdleScreen.qml, clockTime.js pixelShift | done | sampled once a second (see "Differences"); origin = (240, flow height / 2) as in CSS (56 px tall for the analog clock, 336 / 380 digital, 198 MetCat, 480 DVD, 0 Barista) |
| Brightness 0.33 on mount, 1 on leaving and on unmount | IdleScreen.tsx, useDimScreen.updateBrightness | IdleScreen.qml | done | Api.setBrightness; the order of React's effects is kept (the digital clock's 0 first, then 0.33) |
| Dim cycle after 10 min: veil (black 70 %, 1 s ease) + 55 s, then 5 s at 0.33 without veil, 0.03 with it, ... | cycleScreenDim | IdleScreen.qml | done | the first 55 s keep 0.33 under the veil, as React |
| Leaving: on Idle.isIdle false (unless prev is idle): brightness 1, close an unpinned bubble (component = previousComponent), go to prev or the home (no prev / ignoreAsPrevious) | IdleScreen.tsx [shouldGoToIdle] effect | IdleScreen.qml syncIdle | done | runs after the waking gesture is delivered (Qt.callLater), as React's effect runs after the render: a context press that wakes leaves the bubble closed |
| Waking gestures: turns, press down, context, single tare, machine events | SocketProviderValue resetIdleTimer | Core Input / Backend (existing) | done | nothing in the screen itself, as React |
| Forced sleep from the idle screen setting reopens its bubble on unmount; forceBubbleReopen reset | IdleScreen.tsx cleanup, IdleScreenSetting.tsx | IdleScreen.qml | done | values captured at mount (React's closure) |
| Analog clock: 60 indicators, hour 9 x 82.42, minute 6 x 125.5, second 4 x 50.83 (#F5C444, sweeping), logo, hidden until the first sample | AnalogClock.tsx | idle/AnalogClock.qml | done | hands are Rectangles turned by rotation from a FrameAnimation (a few assignments a frame); indicators one SVG |
| Analog Wi-Fi indicator | WifiIndicator.tsx, AnalogClock.tsx | AnalogClock.qml, icons/idle-wifi-on/off.svg | done | drawn at y -74, off the screen, where React puts it (a React quirk kept, see below) |
| OS local time: read now and 1 s after each read, midpoint of the read, kept on errors (reported once), advanced with the monotonic clock | analogClockTime.ts, utils/localTime.ts | idle/clockTime.js, LocalClock.qml | done | Native.localTime() replaces get_os_local_time; no Date in the clocks |
| Digital clock: Wi-Fi status row (icon #606060 by invert+brightness, "Ready"/"Not connected"), hours over minutes 110 px #ddd, AM/PM 55 px in 12-hour, 250 ms refresh | DigitalClock.tsx, DigitalClockBase.tsx, DigitalClock.css, digitalClockTime.ts | idle/DigitalClock.qml, icons/idle-wifi.png, idle-no-wifi.png | done | 'Rubik' is not shipped: the system sans-serif draws it in both (fontconfig); line boxes from its pixel-rounded ascent / descent as Chromium; brightness 0 on mount, 1 on unmount |
| clock_format_24_hour (default 24-hour) | digitalClockTime.ts uses24HourClock, formatTime | clockTime.js | done | tests/digitalClockTime.test.mts passes against clockTime.js (qt/scripts/js-tests.sh) |
| MetCat clock: "HH:MM" 84 px light, the cat: frames 0-120 once then 120-313 looped | MetCatClock.tsx, MetCat.json | DigitalClock.qml, lottie/idle-metcat.json | done | LottieItem; the file is MetCat.json inside a 275 x 280 window (see "Differences") |
| Wi-Fi status for the clocks (refetch on mount, every 60 s) | useNetworkConfig({ idle: true }) | idle/NetworkStatus.qml | done | own fetch of /wifi/config (no shared cache with the Wi-Fi screens) |
| DVD: two 60 px logos on colored squares bouncing in the #111 circle, React's reflection formula with its random ±5°, new palette color per bounce (shared prevColorChoiceIndex) | DVD.tsx | idle/DVDIdleScreen.qml | done | straight runs as x/y animations, the hit time solved per run (see "Differences") |
| Barista clock: outer ring +6°/s from the wall clock, inner logo the other way | BaristaClock.tsx | idle/BaristaClock.qml, icons/idle-barista-*.svg | done | as in React only the red half shows (the white container has no height) |
| useDimScreen for other screens | hooks/useDimScreen.ts | idle/DimScreen.qml | done | `import "../idle"` then `DimScreen {}`; not yet used by the profile / wifi / manual screens (their groups) |
| useCurrentTime | hooks/useCurrentTime.ts | idle/CurrentTime.qml | done | the time group has its own LocalClock.qml for Time & Date |
| Scale overlay states: closed_cold / closed_hot (1 min) / open small / full; all gestures and timers | Scale.tsx | scale/Scale.qml | done | every handler and edge case of the React code, including the lost-release / long-press bookkeeping |
| `visibility` for main.qml (router and bubble disabled while full) | updateScaleVisibility | Scale.qml | done | published after the current gesture's delivery (React's effect): the press that dismisses the full scale never reaches the screen under it |
| Hide after 10 s (small) / 2*60*10000 ms (full, React's typo kept) unless the weight moves > 2 g; tareDown stops it | Scale.tsx | Scale.qml | done | |
| Pull 0 → -20 px, 0.7 s easeIn, then full; release springs back (stiffness 320, damping 15, from the current velocity) | framer-motion variants | Scale.qml | done | closeScale during a pull does not stop it (React's y.set(0)); its end opens the full scale, as React |
| Card transitions: open/close slides (small 50 % ↔ 17.5 %, full 75 % scale .5 ↔ identity), small → full morph of margin/width/height/padding/radius/color/scale/origin, 0.3 s ease | scale.css, SwitchTransition out-in | Scale.qml | done | measured in Chromium (getAnimations); opening while a closing slide runs waits for it (out-in) |
| Weight: toFixed(1) padded to 5 with 10 % zeros, mono 110 px, letter-spacing -2 %, "g" 50 px | Scale.tsx Weight, scale.css | Scale.qml | done | `w || 0` as React, so "Scale not connected" never shows (kept) |
| Tare on calibrateScale / Free Pour screens without opening | second useHandleGestures | Scale.qml | done | |
| Close on extraction; gestures ignored while extracting / bubble intercepts | Scale.tsx | Scale.qml | done | |
| Calibrate scale: title pill, drip tray, blurred veil, 500 g weight sliding in, grams (thin 38 px), set zero / calibrate (bordered, grey outside 470-530 g) / done, 0.5 s transitions after 0.8 s | CalibrateScale.tsx, DripTray.tsx, Weight.tsx | scale/CalibrateScale.qml, icons/idle-scale-* | done | socket "calibrate" via Backend.emitEvent; home 5 s after; double press home. The weight's feGaussianBlur shadow and the blur(10px) veil are PNGs drawn by Chromium from the same CSS/SVG |
| Snake: 20 x 20 grid, 150 ms steps, last turn wins, no turn into the body, wrap skipping off-screen cells, apple (red + logo), reset on self-bite, double press home | Snake.tsx | misc/Snake.qml | done | Rectangles instead of a canvas; bottom status on (route) |

## Differences on purpose

- Pixel shift sampled once a second instead of every frame: the curve moves at most 0.003 px a second at the
  screen's edge, and a per-frame animation would redraw the still digital clock 60 times a second.
- MetCat drawn through a cropped copy (`lottie/idle-metcat.json`: MetCat.json as a precomposition seen
  through a 275 x 280 window at comp (375, 375), shown at 132 x 134 from (180, 240)). Over all its frames the
  cat stays inside comp x 394-631, y 390-638 (measured from lottie-web frames), so the picture is the same,
  with 1/13 of the pixels to render and upload per frame.
- DVD: React moves each logo 1 px per animation frame and checks its corners every frame. Here a straight run
  is a linear x/y animation whose length (time until a corner reaches the circle) is solved when it starts,
  at 60 px/s (1 px per 60 Hz frame; React's speed followed the frame rate). The bounce is React's formula,
  applied at the exact contact point; a direction that would leave again within a pixel bounces again (new
  color each time), as React does on the following frames. React's logo-overlap state (`collision`) changes
  nothing on screen and is not ported.
- Analog hands are not quantized to 0.1° (React does it only to cache transform strings).
- Barista clock: the black drawings (invisible on black, as in React) are drawn anyway.

## React quirks kept (visible in React too)

- Analog clock: its container has no height (`height: 100%` of an auto-height parent), so the Wi-Fi
  indicator lands at y -74 (invisible) and the pixel shift turns around (240, 28).
- Barista clock: white background never shows (zero-height container): only the red half of the logo turns.
- Digital clock sets the brightness to 0 on mount and 1 on unmount (the idle screen then sets 0.33); a change
  of idle_screen while asleep goes through those calls.
- Scale: full-screen hide timer 20 min (2 * 60 * 10000), "Scale not connected" unreachable (`w || 0`), a
  pull that completes after the scale was closed opens the full scale, the jump back by the pull's 20 px
  when the morph starts.
- Calibrate: `Math.round(NaN)` weight shows "NaN" and allows calibration (only without a scale reading).
- Snake keeps hearing the knob while a bubble is open (no ignore condition), as React.

## Not done

- `tests/analogClockTime.test.mts` is not in `qt/tests/js/map.json`: three of its cases test the React
  platform choice (browser `Date` vs `__TAURI_INTERNALS__`) by replacing `globalThis.Date` / `window` in the
  test's realm, which the vm-loaded library cannot see, so the file cannot pass as a whole. Its other cases
  run in the Dial's JavaScript engine (test_idle.py `test_analog_clock_time_cases`,
  `test_analog_clock_serializes_slow_reads`), and `test_native_local_time_is_the_os_local_time` checks the
  Qt time source.
- Calibration with the weight in range (470-530 g) is not exercised: the emulated scale reads about 0 g
  (xfail test).
- scale.spec.ts "becoming ready during dismissal does not turn that press into brew" is not ported: it needs
  the heating screen turning to "click to start" mid-press; the Qt boundary (router disabled until the
  gesture is delivered) is covered by the batched / split dismissal cases.
- The rendering cost on the i.MX8M Nano is not measured here (no machine access); the per-frame work is
  three rotations (analog), two rotations (Barista), x/y animations (DVD), the scale card's numbers during
  its 0.3 s transitions, and a 132 x 134 Lottie (MetCat).

## Requests for the core

- TestServer: `texts` / `probe` do not look into the scale overlay (main.qml's Loader); test_idle.py reads
  it through `eval` (`root.children[i].item.scaleProbe()`). A `scale` item passed to TestServer (searched
  like the bubble) would let the generic helpers see it.
- qt/tests/js/run.mjs: an optional per-test skip list (or the outer realm's `Date` / `window` reachable from
  the library) would let `tests/analogClockTime.test.mts` run with its three platform cases skipped.
- Settings group (IdleScreenSetting): call `Idle.forceIdle()` and `Idle.setForceBubbleReopen(true)` together
  300 ms after updating idle_screen, as React; the idle screen reads both when it is created.
- Profile / wifi / manual groups: `useDimScreen` is `DimScreen {}` from `screens/idle` (import "../idle").
