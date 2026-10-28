# Parity: brew group

The shot screens: heating, the barometer, purge / raise, Brew complete with the shot graph, the last shot
and the heating timeout. Checked side by side with the React Dial's production build (vite, served to
headless Chromium at 480 x 480) on the same machine states: both dials behind a small socket.io + REST proxy
in front of the emulated backend, which relays the real shot or injects any status (heating, no water,
sensor errors, manual brews, purge positions) to both at once. Every screen matches to a pixel or two
(text, ring, graph, Lotties); the screenshots and the proxy are not in the repo (qt/build/brew, ignored).

Files: `qt/qml/Dial/screens/brew/` (HeatingScreen, HeatingOptions, BubbleAnimation, Temperature,
RollingNumber, Barometer, TrailArc + `shaders/trail.*`, PurgeScreen, BrewCompleteScreen, RemoveCupAnimation,
MiniPurgePiston, ShotGraph, ShotGraphScreen, HeatTimeoutAfterShot, Gauge, BrewLogic.js, BarometerLogic.js,
`tools/*.py`), assets `lottie/brew-*.json`, `icons/brew-*.svg`, `qt/tests/e2e/test_brew.py`, the
brewDoubleClick / sw120-heating-long-press / meterGeometry / manualTarget / trailGeometry entries of
`qt/tests/js/map.json`.
ReadyAnimation.qml (boot) was done before and is untouched.

| Feature | React source | Qt file | Status | Notes |
|---|---|---|---|---|
| Heating layout: ModularScreen halves (bubbles right-aligned at 58,104; options + temperatures centered in the right half), footer 250 px down | HeatingScreen.tsx, ModularScreen/modular.less | brew/HeatingScreen.qml | done | to the pixel against Chromium |
| Water bubbles Lottie: 0-60 once, 60-314 looped (loopComplete re-segments), water gone: finish the loop then 314-375 once, water back: 0-314 at once; 29 fps (setSubframe false) | LottieBubbleAnimation.tsx, WaterBubbles.json | brew/BubbleAnimation.qml, lottie/brew-water-bubbles.json | done | segment queue reproduced on LottieItem (loops 1, onFinished); `loopOut()` baked (tools/bake_water_bubbles.py); starts only on changes after mount, like React |
| Temperature gradient multiplied over the bubbles: 12 stops (grey, purple .. orange, rounded % stops), 1200 % tall, window at 20..90 °C, 0.5 s ease, grey without water | LottieBubbleAnimation.tsx GradientContainer | BubbleAnimation.qml | done | no blend effect: the baked file is black with bubble-shaped holes over the gradient (= white bubbles × gradient), see "Differences" |
| Rolling temperature (AnimatedCounter: digit columns, spring 328 / 22 / 0.84, retarget halves velocity, columns kept by position) | Temperatures.tsx, react-animated-counter 1.9 | brew/RollingNumber.qml, Temperature.qml | done | FrameAnimation steps the same integration; the colour pulse is the same colour here, not drawn |
| Target (cached setpoint, last profile's temperature fallback), "Target" label, fade 300 ms out when heating ends | HeatingScreen.tsx | HeatingScreen.qml | done | |
| Estimated time: "a few seconds" (≤ 2 °C), "less than 30 seconds" (≤ 5), m:ss in 15 s steps, "stabilizing..." without setpoint, "Waiting... / Tap to retry" without water | HeatingScreen.tsx preheatTimeLeft | BrewLogic.js preheatTimeLeft | done | |
| "No water" / sensor error labels (4000, 2000, 1000, other) | HeatingScreen.tsx SensorErrorLabel, StatusLabel | HeatingScreen.qml, BrewLogic.js | done | wraps as the flex item does (19.2 px lines) |
| SwitchTransitions (temperature keyed on water, footer on finished-water): 300 ms out, then in | HeatingScreen.tsx, transitions.css | HeatingScreen.qml | done | the branch is frozen during the fade-out, the values inside stay live (React freezes the whole element) |
| Options AUTO BREW / PUSH TO BREW / BREW NOW: 220 x 38 rows, yellow active row; start on index 0, then auto_start_shot; BREW NOW 2 s linear fill then back to transparent and "continue" (only while heating) | Heating/OptionsMenu.tsx | brew/HeatingOptions.qml | done | mount effect order kept (auto_start, then the setting) |
| Options leave on "click to start" (600 ms height/margins/opacity, unmounted; the 10 px jump at unmount kept), halves slide 95 px (0.6 s) | HeatingScreen.tsx fade-options, transitionStyle | HeatingScreen.qml | done | |
| AUTO BREW starts the shot at "click to start"; click / long press start it with PUSH TO BREW or BREW NOW (once: no pressUp handler, sw120) | HeatingScreen.tsx, startBrewGestures.ts | HeatingScreen.qml, BrewLogic.js | done | e2e; tests/sw120-heating-long-press.test.mjs against BrewLogic.js |
| Home when idle (no notification, not starting) | HeatingScreen.tsx | HeatingScreen.qml | done | |
| Double click on brew screens: finish only on the barometer inside a profile stage, abort elsewhere, nothing at idle | hooks/brewDoubleClick.ts, useBrewDoubleClickHandler.ts | BrewLogic.js decideDoubleClick, each screen | done | tests/brewDoubleClick.test.mts runs against BrewLogic.js (js-tests.sh) |
| Barometer ring: 22 steps over 300° (#4A4A4A), needle 197 x 4 px rotated to the rounded degree, 0.2 s linear | Meter.tsx, meterGeometry.ts | brew/Barometer.qml, icons/brew-barometer-steps.svg, BarometerLogic.js | done | steps as one SVG; tests/meterGeometry.test.mts against BarometerLogic.js |
| Barometer readout: Pressure / value + unit, Time, Flow, Weight, Grav. Flow (formatStatValue), stage name capitalized | Barometer.tsx, barometer.css | Barometer.qml | done | the CSS margins (-48 / -53 px) that keep values centered reproduced |
| Manual brew: flow stage turns the ring to flow, "Target x.x bar|ml/s", target tick in the control's colour (150 ms linear), comet trail while it moves | Barometer.tsx, TargetTick.tsx, useManualTarget.ts, manualTarget.ts, trailGeometry.ts | Barometer.qml, TrailArc.qml, shaders/trail.vert/.frag, BarometerLogic.js | done | the trail is a shader on a bent mesh (antialiased, exact curves); manualTarget/trailGeometry tests run against BarometerLogic.js |
| Barometer home at idle unless waitingForActionAlreadySent; clears it on any other status | Barometer.tsx | Barometer.qml | done | |
| Purge / raise: piston at m_pos (0..74 mm → the Lottie's 60 frames), blink Lottie (206.5 px higher at "home"), pressure and flow in 64 px columns | PurgeScreen.tsx, PurgePiston.tsx, piston.css | brew/PurgeScreen.qml, SmoothPiston.qml, images/brew-piston-*.png (baked from lottie/brew-piston.json), brew-blink.json | done | files cropped to where they draw (identical pixels, ~15x fewer for the blink); the piston starts where it is, follows the readings 350 ms behind them, interpolated (React: 200 ms linear to each reading), and slides baked pictures by fractions of a pixel; leaves after 2 s without a position (NaN) |
| Purge title Purging / Raising / profile | routes.ts selectPurgeTitle | Core/Routes.qml (existing) | done | |
| Brew complete: remove-cup animation (4 s ease-out per keyframe), weight (1 decimal, 0 past 1000), "Scale not connected", Remove cup / Push to purge, brew time | BrewCompleteScreen.tsx, RemoveCupAnimation.tsx | brew/BrewCompleteScreen.qml, RemoveCupAnimation.qml, icons/brew-drip-tray/cup/cup-arrow.svg | done | |
| Brew complete: graph from the purge on (latched), mini piston 500 ms after the purge starts (100 ms in, 250 ms out) | BrewCompleteScreen.tsx, MiniPurgePiston.tsx | BrewCompleteScreen.qml, MiniPurgePiston.qml, images/brew-mini-piston-*.png (baked from lottie/brew-mini-piston.json) | done | the GraphContainer squeezed by flex-shrink (plot at 117 px) as measured in Chromium |
| Brew complete leaving: home at idle; a turn keeps it until a push; manual brews hold it until a push and rest on the idle screen at the idle timeout; click answers "click to purge" | BrewCompleteScreen.tsx | BrewCompleteScreen.qml | done | the manual-brew branch is ported but the emulation cannot run a manual shot to the end (checked by reading only) |
| Shot graph: last shot of the profile (POST /history), flow / pressure / weight PlotLines 270 x 175, dashed dividers and ends, axis, end weight / time, red selection with fading triangles moved in 50 steps, labels; "Not historicial shot..." and loading states | ShotGraphScreen.tsx ShotGraph, GraphAnnotations.tsx, GraphPath.ts, types/dataTypes.ts | brew/ShotGraph.qml | done | to the pixel; the JSX stray `;` (5 px, black) kept as spacing |
| Last shot route: push or double click home, idle → idle screen | ShotGraphScreen.tsx | brew/ShotGraphScreen.qml | done | |
| Heating timeout: gauge 0..10 min (leading zeros 20 %), ring, "Time"; push saves heating_timeout and opens Brew settings; dims at idle | HeatTimeoutAfterShot.tsx, SettingNumerical/Gauge.tsx, useDimScreen | brew/HeatTimeoutAfterShot.qml, brew/Gauge.qml | done | initial value read once (useSyncedState), as React |
| utils/preheat.ts (simpleJson) | utils/preheat.ts | — | n/a | not used by any screen (dead in React too) |

## Tests

`qt/tests/e2e/test_brew.py` (22 tests, all passing against the emulated backend, ~6 min):
- three real shots the emulation brews: from the home hold to barometer, Brew complete and home with the
  shot in the history (espresso-complete); the graph kept while read at idle and put away with a push, then
  the same shot as "Last shot"; finish inside the stage and abort in the retract (the backend homes the
  piston: raise screen, then home).
- states the emulation cannot produce, injected with the Dial's socket events paused
  (`Backend._socket.enabled = false`, then `Backend.onStatus(...)`): heating texts and estimates, no water,
  the four sensor errors, options and BREW NOW, push / long press to brew (sw120), AUTO BREW, double clicks,
  barometer readout / needle / idle, manual target and trail, flow ring, purge piston and raise, Brew
  complete texts / click to purge / no scale / idle and keep, the heating timeout with fast turns.
The pure modules: `qt/scripts/js-tests.sh` runs tests/brewDoubleClick, sw120-heating-long-press,
meterGeometry, manualTarget and trailGeometry against BrewLogic.js / BarometerLogic.js (all pass).

## Differences on purpose

- The bubbles' multiply: no blend effect (Qt5Compat / layers are out). WaterBubbles is white bubbles on
  black, so multiply = the gradient seen through the bubbles; the baked file draws black with a hole per
  bubble (one shape layer, even-odd fill, an animated ellipse per bubble) over the gradient Rectangle. An
  inverted track matte would do the same, but rlottie's mattes top out at alpha 251 and leak 1.6 % of the
  gradient into the black. Same pixels, except the React gradient box is 1 px narrower and shorter than the
  bubbles (169 x 269), which only matters if a bubble touches the right edge.
- Inactive heating option rows: Chromium draws a faint 1 px yellow line at their left edge (the gradient's
  hard stop on the edge); not reproduced.
- The purge Lotties are cropped to their drawn area; the mini piston's file is fixed for rlottie (integer
  composition size, the hatch's 14 track mattes turned into layer masks: rlottie drew none of them); both
  checked pixel-identical / against lottie-web frame by frame. Both pistons are drawn from pictures baked
  from them (screens/brew/tools/bake_piston.py, 4x and reduced): their moving layers only slide, and the
  pictures slide by fractions of a pixel instead of rlottie redrawing whole frames.
- The manual trail is computed in a shader from `delta` (exact arcs) instead of the 1° polyline path.
- RollingNumber draws no increment/decrement colour pulse (the heating screen passes the text colour).
- In the SwitchTransitions the fading-out content keeps updating its values (React shows the frozen old
  element); only the branch is frozen.

## Not done

- Nothing known missing. Not checked on the machine (no deploy from here): the CPU cost of the Lotties is
  measured on amd64 only (bubbles 0.2 ms, blink 0.14 ms, piston 0.21 ms per frame at their sizes).

## Requests for the core

- LottieItem: `loadedChanged` is emitted before `load()` rewinds to the segment start, so a `gotoAndStop()`
  in `onLoadedChanged` is lost. Worked around with `Qt.callLater`; better to emit it after the rewind (or
  keep a pending frame).
- rlottie: refuses non-integer composition sizes, does not draw track mattes on parented layers, and its
  mattes reach only alpha 251. The brew files are fixed in `screens/brew/tools/`; other groups' files may hit
  the same. The tools could move to `qt/tools/lottie/`.
- `qt/scripts/run-dev.sh`: every instance runs Xvfb on :99 with `--network host`, where the abstract socket
  `@/tmp/.X11-unix/X99` is shared: starting or stopping one instance killed all the others ("X11 connection
  broke" in six run containers at once). Please give each instance its own display (e.g. derived from TEST_PORT); I used a
  copy with :121 (qt/build/brew/run-brew.sh, not in the repo).
- A test API to pause the socket's events (the e2e uses `Backend._socket.enabled`), e.g.
  `Backend.setEventsPaused(bool)`.
- A shared Gauge (SettingNumerical/Gauge.tsx): brew has its own copy (screens/brew/Gauge.qml); the profile
  group needs the same component.
- Conventions hint: in the Dial's WebKit, `line-height: normal` is 1 em for ABC Diatype and Diatype Mono
  (1.24 em for the thin cut) while Qt's font metrics give 1.25 em: a CSS box of normal line height is
  `height: fontSize` with `verticalAlignment: AlignVCenter` (centering matches Chromium exactly).
