# Parity: profile group

The circular keyboard (shared), the profile editor and its setting screens. Checked side by side with the
React Dial (vite dev build in headless Chromium at 480 x 480, driven with its keyboard bindings, against the
same emulated backend): the keyboard in every key state, the editor at every line, the gauges and the
image picker match to a pixel or two.

| Feature | React source | Qt file | Status | Notes |
|---|---|---|---|---|
| Keyboard ring: keys every 7.25° (10° only-letters), baselines 171.6 px out, the selected key lifted out | CircleKeyboard.tsx, Keys.tsx, circle-keyboard.css | components/CircleKeyboard.qml | done | Repeater over the alphabet's length (no rebuild per step) |
| Ring turn 250 ms cubic-bezier(0.47, 1.63, 0.41, 0.8), jump over the gap at the ends | moveElements, getJumpRotate | CircleKeyboard.qml | done | same arithmetic (rotation grows without bound, as in React) |
| Selected key: 60 px letter; icon keys with labels (Ok, Back, CAPSLOCK/capslock, Abort, Special Characters) | getMainLetter | CircleKeyboard.qml + assets/icons/profile-kb-*.svg, profile-globe-alt.svg | done | fontello glyphs as SVG paths with the same fill and -webkit-text-stroke (gen script: qt-dial-tmp/profile/gen_icons.py); labels in the 'Abc' fallback font (DejaVu Sans Bold), as WebKit |
| Caps lock: click toggles, double click locks, on while the text is empty (capitalizeFirstLetter), off after an ASCII letter unless locked; ring/selected icon outline / grey / white | click, doubleClick, useEffect([caption.length]) | CircleKeyboard.qml | done | |
| Character sets: default → accents (capitals with caps lock) → special → default | pressDown keyboardType | CircleKeyboard.qml | done | the switch back to default is not re-cased until the next step (React) |
| Typing: space (not on blank text), ok (trimmed; refused on blank), backspace, cancel, 64-character limit | pressDown | CircleKeyboard.qml | done | at the limit only ok / cancel (cancel resets to defaultValue) / backspace |
| Caption: title 25 px light 40 %, text bold 40 px shrinking to 28 px past 10 characters, "..." + last 35, invisible "_" for spaces, cursor blinking (1 s linear fade) | caption render, font effect | CircleKeyboard.qml | done | RichText; the cursor is a second identical layout with only the cursor visible, its opacity animated (no relayout per frame). Font shrink keeps React's quirk (does not grow back) |
| prefix / suffix (40 %, light) | circle-caption-affix | CircleKeyboard.qml | done | |
| Shake on refused ok / space (±10 px, 300 ms) | addAnimation, globals.css shakeAnimation | CircleKeyboard.qml | done | |
| reverse_scrolling.keyboard | useSettings | CircleKeyboard.qml | done | |
| Long press (onLongPress): takes back the character the press typed, then fires | longEncoder | CircleKeyboard.qml | done | `longPressed` always fires (a screen without a handler: nothing, as React without onLongPress); QML cannot tell whether a handler is connected, so the take-back needs `longPressEnabled: true` |
| shouldIgnoreGesture ?? bubbleDisplay.interceptsGesture | useHandleGestures | CircleKeyboard.qml | done | `ignoreGestures` defaults to a binding to Nav.bubbleInterceptsGesture; assigning it replaces that (e.g. `!Nav.bubbleInterceptsGesture` in the bubble) |
| defaultValue resets the text when it changes | useEffect([defaultValue]) | CircleKeyboard.qml | done | a string: a change of value resets; `reset(value)` for the identity changes React also reacts to |
| Profile editor list, focus at the middle, 150 ms ease, fades, capitalized labels, value / unit / image of the focused line | PressetSettings.tsx | screens/profile/PressetSettings.qml | done | the flex column's shrink past 9 lines (48 px lines, still moved 52 px a step) is reproduced |
| Marquee of a focused line over 24 characters (−240 px and back, 8 s ease-in-out) | MarqueeAnimation | PressetSettings.qml | done | |
| Value 25 px when label + value pass 21 characters | SettingsValue $small | PressetSettings.qml | done | |
| Save (no wait, home), discard, brew without saving (load, start, heating / manual-purge by piston position) | pressDown | PressetSettings.qml | done | see "Differences" for the failing start |
| Opening the setting screens by key (name, output, *pressure*, *time*, *weight*, *piston_position*, *power*, *flow*, temperature, image) | pressDown | PressetSettings.qml | done | same order of tests (e.g. a "flow_time" key opens time) |
| Creating a profile (isCreatingProfile hides the title pill) | Router.tsx | components/Router.qml (core) | done | nothing to do in the screen |
| Limited access | ProfileHomeScreen (new → unlock) | screens/home (home group) | n/a | the editor has no limited-access branch in React |
| Numerical settings: intervals, units, ranges per type; stops only exactly at max / min; output not rounded | SettingNumerical.tsx | screens/profile/SettingNumerical.qml | done | each step from the stored profile |
| Gauge: mono 140 px digits padded with 20 % zeros, unit, grey ring + yellow arc (negative values from the end) | Gauge.tsx, gauge.css | screens/profile/Gauge.qml | done | Arc shader; ring centre (240.96, 239.04), r 227.1, 2.9 px, as the rotated SVG circle lands |
| Name editor | EditNameScreen.tsx | screens/profile/EditNameScreen.qml | done | |
| Image picker: Swiper 2 per view, 230 px slides, 20 px gap, 300 ms ease, bounce of the neighbours, "n / total" at 352 px, starts at the first image, left = next | PressetProfileImage.tsx, utils/preset.ts (clearSlides, handlePresetSlideChange) | screens/profile/PressetProfileImage.qml | done | images loaded for the active ± 2 slides only |
| useDimScreen (backlight off when idle on these screens) | hooks/useDimScreen.ts | screens/profile/DimScreen.qml | done | |
| CSS line boxes | — | all | done | Chromium lays ABC Diatype out with hhea metrics (0.85 / 0.15 em, rounded); Qt uses the win metrics (0.975 em): texts are placed by baseline (topPadding / baselineOffset). Rich text with a fixed line height puts the baseline at 4/5 of the line |

## Differences on purpose

- Brew without saving, start request failing at the transport level: React throws there (`'error' in
  undefined`) and leaves `profileStarting` set, which locks the home's knob. The Qt screen takes the branch the
  code means: profileStarting false, error logged, back home. A failing *load* keeps the editor open, as React
  does (it throws before navigating).
- A broken image on the editor's image line shows nothing (Chromium / WebKit draw the alt text "No image"
  clipped in the 50 px box).
- With no default images the picker shows nothing (React would render a stray `0` in the Swiper).
- The ring's letters are 25 px (0.4rem in a 390 px / viewBox-100 svg is 24.96 px); the icon SVGs are
  rasterized once at their CSS size and rotate with the ring.
- The cursor is not a span: a second layout of the same text, transparent but for the cursor.

- The ring's group sets `dominant-baseline: text-bottom`, which its `<text>` elements do not take (the
  reference shows alphabetic baselines at 171.6 px): ported as alphabetic.

## Not done

- No pixel check of the marquee and of the shake against React (both are plain keyframes, ported from the CSS).

## Requests for the core

- `qt/scripts/run-dev.sh`: every instance runs `Xvfb :99` with `--network host`, where the X abstract socket
  is shared: an instance can connect to another one's X server and dies when that one restarts ("The X11
  connection broke"). The profile group ran its own copy with `:122`. Suggest a display per instance (e.g.
  derived from TEST_PORT) or `Xvfb -nolisten local`.
- `qt/tests/e2e/dial.py`: a `restart()` (the integration journey "editing ... saves under the same identity"
  reboots the Dial) and a request log (the "discard" journey checks no `/profile/save` was sent); the port
  checks the backend instead.
- Support group (ReportContactEmail): add `longPressEnabled: true` next to its `onLongPressed: screen.bail()`
  so the long press first takes back the character its press typed, as React does (without it the long press
  still bails, with that character left in the draft it discards). Factory reset already sets
  `ignoreGestures` for its keyboard in the bubble.

## Tests

`qt/tests/e2e/test_profile.py` (16): the five journeys of meticulous-integration `test_dial_profiles.py`
(create, focus-after-create xfail as there, edit keeps the id, discard, delete), the editor's list, the
temperature maximum, a flow variable's steps, typing a name (backspace, caps on an empty text, ok, saved),
keyboard cancel, ok / space refused on blank text, wrap + caps lock + character sets, reverse scrolling, long
press with and without `longPressEnabled`, the image picker (saved image), brew without saving (heating,
nothing saved, the loaded profile has the edited temperature).
