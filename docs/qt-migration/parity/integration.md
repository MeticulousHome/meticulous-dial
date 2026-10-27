# Integration journeys (meticulous-integration) on the Qt Dial

meticulous-integration's Dial journeys (`tests/test_dial_*.py`, 31 tests in 8 files) run unchanged on the
Qt Dial: the real backend (`boot_harness.py --serve`), the real firmware on fika-sil at `SIL_SPEED` 5 (as
CI), the knob and the buttons operated through fika-sil, and `qt/build/amd64/meticulous-dial-qt` started
fresh for each test under Xvfb instead of the React web build in Chromium. The overlay, how to run it and
what each piece does: [`qt/tests/integration/README.md`](../../../qt/tests/integration/README.md).

Re-run: `bash qt/tests/integration/run.sh` (about 13 min); the React reference: `MODE=react bash
qt/tests/integration/run.sh`; side by side: `python3 qt/tests/integration/compare.py <react run> <qt run>`.

## No real services

No run reaches the support ticket service, Sentry or Community. Since the coordinator's request of
2026-10-24 (after full1 to full4), every run is **offline and guarded**: the test container has no
network (`docker run --network none`, checked before pytest starts), the Qt Dial runs with
`DIAL_EXTERNAL_SERVICES=0` (run.sh refuses `1`) and the fixture stops any Dial whose log lacks
"external services are off" (full5 and full6: 34 Dial starts each, 34 with the line, no request blocked
by the guard). The earlier runs
(smoke1, full1 to full4, plant1) had network in the container but the Dial's only way out was the
overlay's gate (its `http_proxy`/`https_proxy`), which refused every third party (`refused` empty in every
report) and answered the ticket service locally (ticket 424242, never sent out); the backend's preflight
probes went to meticulous-integration's local `third_parties.py` (the journey asserts it). The React runs
are isolated by the suite itself (Chromium resolves only localhost; the backend's third parties local).

## Results

Each run on a fresh machine. Components: meticulous-backend `32ddb73` (beta, with #451), fika-sil
`7e9fbea-sil` (EspressoFirmware beta), meticulous-integration `f99365b`; Qt Dial: the working tree of
`qt-migration` at each run (HEAD `76f6b00d` for full1/full2, `3e6902e9` after, plus what the other groups
had landed uncommitted; the guarded binary of 01:43 for full5/full6); React reference: meticulous-dial
`c77d6e7` (`~/integration-dial`, `src/` identical to this repository's), same containers, same stack.

| Journey (file :: test) | catalog journey | React (react1, react2) | Qt, before the guard (full1–3) | Qt, guarded and offline (full5, full6) | Notes |
|---|---|---|---|---|---|
| 01_first_boot :: a_fresh_machine_asks_once_whether_to_share_shot_data | boot-to-ready | pass | pass | pass | ready → shotDataSharingPrompt → profileHome; no prompt after a restart |
| 01_first_boot :: the_title_pill_names_the_card_a_new_machine_opens_on | boot-to-ready | pass | pass | pass | |
| 01_first_boot :: the_first_boot_offers_the_simple_profile_first | boot-to-ready | xfail | xfail | xfail | the suite's known backend gap; same failing check and value as React (`carousel(screen)[0]` is 'Free Pour') |
| 02_home :: the_home_offers_every_profile_then_free_pour_and_new | boot-to-ready | pass | pass | pass | |
| 02_home :: device_info_shows_the_identity_and_firmware_the_machine_reports | update-and-diagnostics | pass | pass | pass | every Device Info label equal to React's |
| 02_home :: the_title_pill_names_the_selected_card | boot-to-ready | pass | pass | pass | |
| espresso :: an_espresso_brewed_from_the_dial_reaches_the_cup_and_the_history | espresso-complete | pass | pass | pass | profileHome → heating → barometer → brewComplete → profileHome, as React |
| espresso :: a_double_push_while_heating_cancels_the_shot | espresso-abort-and-recover | pass | pass | pass | |
| espresso :: abort_brew_from_the_menu_stops_the_shot_and_the_next_one_runs | espresso-abort-and-recover | pass | pass | pass | |
| espresso :: a_double_push_during_extraction_ends_the_shot_early_and_keeps_it | espresso-interactions | pass | pass | pass | |
| espresso :: skip_this_step_moves_the_shot_to_the_next_stage | espresso-interactions | pass | pass | pass | |
| espresso :: the_shot_graph_stays_while_you_look_at_it_and_a_push_puts_it_away | espresso-complete | pass | pass | pass | graph read as the drawn `PlotLine` items (≥ 2) and the route's texts |
| input :: every_fast_turn_the_dial_receives_takes_effect × 8 (carousel, number, text, menu × keyboard, burst) | knob-fast-turns | pass ×8 | pass ×8 | pass ×8 | 16 of 16 turns everywhere, as React |
| modes :: a_manual_shot_is_steered_with_the_knob_and_ends_on_the_brew_complete_screen | manual-brew | pass | pass | pass | pressure setpoint after 4 detents 0.4, as React |
| modes :: a_free_pour_is_guided_by_the_scale_and_saved_to_the_pour_over_history | pour-over-brew | pass | pass | pass | one POST /history/pour-over; 210 / 250 / 40 g |
| profiles :: a_profile_created_on_the_dial_is_saved_with_what_was_set | profile-create-and-delete | pass | pass | pass | |
| profiles :: the_home_focuses_the_profile_just_made | profile-create-and-delete | xfail | xfail | xfail | the React bug, ported as is: the home stays on "new" |
| profiles :: editing_a_profile_on_the_dial_saves_it_under_the_same_identity | profile-select-edit-persist | pass | pass | pass | |
| profiles :: discarding_the_changes_leaves_the_profile_as_it_was | profile-select-edit-persist | pass | pass | pass | no /profile/save (recording proxy) |
| profiles :: deleting_a_profile_from_the_menu_removes_it_everywhere | profile-create-and-delete | pass | pass | pass | |
| settings :: brew_settings_changed_on_the_dial_are_kept_by_the_machine | settings-persistence | pass | pass | pass | |
| settings :: purge_from_the_menu_runs_and_returns_home | maintenance-actions | pass | pass | pass | |
| settings :: raise_from_the_menu_homes_the_piston | maintenance-actions | pass | pass | pass | |
| support :: a_report_without_an_email_creates_the_report_and_sends_only_its_id | update-and-diagnostics | pass | pass (ticket answered by the gate) | **fail, by design of the guard** | `preflight = next(... "/reports/preflight?" in url)` (test_dial_support.py:59): StopIteration. Under the guard the Dial has no ticket service and sends no probes: GET /reports/preflight without `?probe=`, then "We could not get a tracking number for your report. Error code BR-03" (`screens/test_a_report_without_an_email_creates_the_report_and_sends_only_its_id-01-failed.png` in full5). Everything before it (quick settings, Report an issue, Report, the contact email skipped with a long push, Ok) passes. |

Totals: React 29 passed, 2 xfailed (both runs). Qt before the guard: 29 passed, 2 xfailed (full1, full2,
full3; smoke1 and the 11 tests of full4 too). Qt guarded and offline: 28 passed, 1 failed (support, by
design), 2 xfailed (full5 and full6 alike).

### Is the overlay able to fail? (planted bugs)

`qt/tests/integration/plant.sh` copies the QML with two planted bugs (run `plant1`): NavTitle's pill never
scrolls to the selected card, and Device Info values end in "!". Both pill journeys fail
(`wait_for_pill(...)` gives 'catalog' instead of 'free pour' / the profile's name) and the Device Info
journey fails ('firmware: 7e9fbea-sil!' == 'firmware: 7e9fbea-sil'); the three others pass.

## Gaps seen in the Qt Dial

Fixed after these runs (commit "fix(qt): profileHover payload, one history query per graph, FpText loops"):
`emitEvent` converts a `QJSValue` payload (checked: the emulated backend logs "Profile hover updated: {'id':
..., 'type': 'scroll', 'from': 'dial'}"), ShotGraph queries once per profile, FpText reads the size from a
plain property. The table describes what the runs saw.

The journeys pass, so these come from comparing the Qt runs with the React runs (`compare.py`: routes,
every focused entry read, the controls of each step and the home's focused card, in call order;
`react2`/`full5`, `react-cards`/`qt-cards`), the backend's log and the Dial's own log.

| Gap | Seen | Where | Effect |
|---|---|---|---|
| **`profileHover` reaches the backend as `null`** | every focus change on the home, every Qt run (156 per full run; 0 with React): backend "Hovering Profile null", then `AttributeError: 'NoneType' object has no attribute 'get'` in `ProfileHover.from_dict` (profiles.py:49) | `src/socketio.cpp` `SocketIO::emitEvent`: `QJsonValue::fromVariant(data)` gets the JS object as a `QVariant` holding a `QJSValue`, which it turns into `null` (strings, as in `action`, are fine). Checked against a fake Socket.IO server: `Socket.emitEvent("profileHover", { id: "abc", type: "focus", from: "dial" })` sends `42["profileHover",null]`; `Socket.emitEvent("action", "abort")` sends `42["action","abort"]` | The app never follows the Dial's focused card, and the backend keeps a stale hover. Visible in the journeys: on start the Qt home opens on the profile the app saved last (the backend's own hover on save), where React opens on the card the user had focused (React's hovers keep the backend in step): in the espresso journeys React turns 5 to 9 detents to reach the new profile, Qt is already on it. Would break meticulous-integration's mobile journey "the knob and the app agree on the profile". Fix: convert first, `QVariant v = data; if (v.metaType() == QMetaType::fromType<QJSValue>()) v = v.value<QJSValue>().toVariant();`. |
| Every menu label equal to React's | all focused entries the journeys read (quick settings, Config, Device Info's 18 entries, Brew Settings, the profile editor, manual setup, bug report) | | none, except `VERSION_HISTORY: ` with a trailing space (React's reads trim it; the overlay trims too) |
| Brew complete asks for the shot twice | POST /history twice per Brew complete (React once) | brew/ShotGraph.qml: `onProfileIdChanged` and `Component.onCompleted` both call `fetch()` at creation | one extra request per shot (the first answer is dropped) |
| FpText binding loops | ~100 `Binding loop detected for property "font.letterSpacing"` / `"font.wordSpacing"` per Free Pour journey, a few in manual mode | freepour/FpText.qml (FreePourScreen, Readiness, FlowMeter, RailPoint, FreePourHistoryScreen, StepLabel, AbortHint, manual/ManualGauge, ManualModeSetup) | `font.letterSpacing` / `font.wordSpacing` are bound to expressions reading `font.pixelSize`; the values end right but each change logs and re-lays out. Read the size from a plain property. |
| Mini purge piston did not load | full1 only (`rlottie cannot read .../brew-mini-piston.json`, 6×) | brew/MiniPurgePiston.qml | fixed during the run (the file was replaced); full2 onwards load it |
| JavaScript exceptions | none in any run | | |

Same as React, for the record: the routes of every journey, the statuses and the pressure setpoint the knob
gives in manual mode, the fast-turn counts, the free-pour totals, the bug report's screens up to the error.
Requests that differ without effect: the Qt Dial sets the backlight twice at start (on purpose, main.qml:
again when the backend comes online), and refetches the profile list and the last profile on fewer
occasions than React's query cache (same data on screen in every journey).

## Differences on purpose (the overlay against the React fixture)

- One fresh Dial process per test (new storage file) where React opens a fresh browser context;
  `screen.restart()` starts a new process on the same storage, as a page reload keeps localStorage.
- `routes()` is `Nav.history`: no "+bubble" entries (no journey reads them).
- `carousel()` is every card (`dialProbe_cards`); the React page lays out only the cards around the focused
  one. `go_to_card` and `home_cards` are the suite's algorithm unchanged.
- `text()` is every visible Text of the canvas (route, bottom status, bubble, scale overlay), through
  TestServer's own collector; `focused()` is `dialFocusedLabel`, trimmed (React reads the rendered label,
  upper case where CSS transforms it; every journey compares without case).
- `pill_text()` reads the Text whose middle is inside the pill's 230 × 24 box, as `_PILL_JS` does.
- `inject_turns`: "keyboard" is the test port's gestures, "socket" backend `button` events through
  `Input.handleButton`, all sent before reading any answer for a burst.
- `watch.requests` comes from a recording proxy between the Dial and the backend (Socket.IO's own requests
  left out). Third parties go to a local gate (the Dial's `http_proxy`/`https_proxy`): refused and
  recorded, or answered over TLS with a certificate of the run's CA (`answer_external`), so `answered` and
  `refused` mean what they mean for Chromium. Under the guard the Dial does not even try.
- JavaScript exceptions in the Dial's log are listed (`pages/<test>.json`) but fail a test only with
  `QT_DIAL_FAIL_ON_QML_ERRORS=1`; there were none.
- Video by ffmpeg from the Xvfb screen (60 fps H.264 MP4, upright) instead of Playwright's WebM, from the
  Dial's start to the end of the journey; screenshots at each failed wait and at the end of a failed test,
  composited over black.

## Not done

- The mobile suite (`tests/test_mobile_*.py`) still opens the React Dial as the machine's display; its
  `machine_display` could take `QtDialApp` the same way.
- Not wired into meticulous-integration's CI (it would need the Qt binary as an artifact and the Qt runtime
  on the runner; the Dockerfile lists the packages).
- `test_dial_support.py` cannot pass under the guard (it asserts the preflight probes and the real ticket
  service URL); it passed before the guard with the ticket service answered locally.

## Requests for the core

- `src/socketio.cpp` `emitEvent`: convert a `QJSValue` payload before `QJsonValue::fromVariant` (above);
  today every `profileHover` the Dial emits is `null`.
- TestServer: a `pill` probe (the line NavTitle shows) would replace the overlay's geometry through `eval`;
  ShotGraph already has `dialProbe_graphShown` / `graphCurves` / `selection` (the overlay counts the drawn
  PlotLines, closer to what `_GRAPH_JS` reads).
- TestServer `texts`: cover the whole canvas (bottom status, scale overlay), as the React journeys read
  `.meticulous-main-canvas`; the overlay calls `collectTexts(root)` through `eval` meanwhile.
- `docs/qt-migration/TESTING.md`, "Against the real firmware": point at `qt/tests/integration/` (it says
  "not done yet").
