# Integration journeys (meticulous-integration) on the Qt Dial

meticulous-integration's Dial journeys (`tests/test_dial_*.py`, 31 tests in 8 files) run unchanged on the
Qt Dial: the real backend (`boot_harness.py --serve`), the real firmware on fika-sil at `SIL_SPEED` 5 (as
CI), the knob and the buttons operated through fika-sil, and `qt/build/amd64/meticulous-dial-qt` started
fresh for each test under Xvfb instead of the React web build in Chromium. The overlay, how to run it and
what each piece does: [`qt/tests/integration/README.md`](../../../qt/tests/integration/README.md).

Re-run: `bash qt/tests/integration/run.sh` (about 13 min); the React reference: `MODE=react bash
qt/tests/integration/run.sh`; side by side: `python3 qt/tests/integration/compare.py <react run> <qt run>`.

## Results

Runs of 2026-10-24, each on a fresh machine. Components: meticulous-backend `32ddb73` (beta, with #451),
fika-sil `7e9fbea-sil` (EspressoFirmware beta), meticulous-integration `f99365b`; Qt Dial: the working tree
of `qt-migration` at the time of each run (HEAD `76f6b00d` for full1/full2, `3e6902e9` for full3/full4,
plus the screens the other groups had landed uncommitted); React reference: meticulous-dial `c77d6e7`
(`~/integration-dial`, whose `src/` is identical to this repository's), same container, same stack.

| Journey (file :: test) | catalog journey | React (react1, react2) | Qt (full1, full2, full3, full4) | Notes |
|---|---|---|---|---|
| 01_first_boot :: a_fresh_machine_asks_once_whether_to_share_shot_data | boot-to-ready | pass | pass ×4 | routes ready → shotDataSharingPrompt → profileHome; no prompt after a restart |
| 01_first_boot :: the_title_pill_names_the_card_a_new_machine_opens_on | boot-to-ready | pass | pass ×4 | |
| 01_first_boot :: the_first_boot_offers_the_simple_profile_first | boot-to-ready | xfail | xfail ×4 | known backend gap (no default profiles installed); fails on the same check as React: `carousel(screen)[0] == simple` gives 'Free Pour' |
| 02_home :: the_home_offers_every_profile_then_free_pour_and_new | boot-to-ready | pass | pass ×4 | |
| 02_home :: device_info_shows_the_identity_and_firmware_the_machine_reports | update-and-diagnostics | pass | pass ×4 | |
| 02_home :: the_title_pill_names_the_selected_card | boot-to-ready | pass | pass ×4 | |
| espresso :: an_espresso_brewed_from_the_dial_reaches_the_cup_and_the_history | espresso-complete | pass | pass ×4 | profileHome → heating → barometer → brewComplete → profileHome |
| espresso :: a_double_push_while_heating_cancels_the_shot | espresso-abort-and-recover | pass | pass ×4 | |
| espresso :: abort_brew_from_the_menu_stops_the_shot_and_the_next_one_runs | espresso-abort-and-recover | pass | pass ×4 | |
| espresso :: a_double_push_during_extraction_ends_the_shot_early_and_keeps_it | espresso-interactions | pass | pass ×4 | |
| espresso :: skip_this_step_moves_the_shot_to_the_next_stage | espresso-interactions | pass | pass ×4 | |
| espresso :: the_shot_graph_stays_while_you_look_at_it_and_a_push_puts_it_away | espresso-complete | pass | pass ×4 | the graph read as `PlotLine` items with points (≥ 2) and the route's texts |
| input :: every_fast_turn_the_dial_receives_takes_effect [carousel, number, text, menu] × [keyboard, burst] | knob-fast-turns | pass ×8 | pass ×8 ×4 | 16 of 16 turns everywhere (observations: same as React; keyboard turns spread over ~115 ms instead of 100 ms, the test port's pacing) |
| modes :: a_manual_shot_is_steered_with_the_knob_and_ends_on_the_brew_complete_screen | manual-brew | pass | pass ×4 | `manual_pressure_after_4_detents` 0.4, as React |
| modes :: a_free_pour_is_guided_by_the_scale_and_saved_to_the_pour_over_history | pour-over-brew | pass | pass ×4 | one POST /history/pour-over, totals 210 / 250 / 40 g |
| profiles :: a_profile_created_on_the_dial_is_saved_with_what_was_set | profile-create-and-delete | pass | pass ×4 | |
| profiles :: the_home_focuses_the_profile_just_made | profile-create-and-delete | xfail | xfail ×4 | the React bug is ported as is: the home stays on "new" after a save |
| profiles :: editing_a_profile_on_the_dial_saves_it_under_the_same_identity | profile-select-edit-persist | pass | pass ×4 | |
| profiles :: discarding_the_changes_leaves_the_profile_as_it_was | profile-select-edit-persist | pass | pass ×4 | no /profile/save request (recording proxy) |
| profiles :: deleting_a_profile_from_the_menu_removes_it_everywhere | profile-create-and-delete | pass | pass ×4 | a short push does not delete; the hold does |
| settings :: brew_settings_changed_on_the_dial_are_kept_by_the_machine | settings-persistence | pass | pass ×4 | |
| settings :: purge_from_the_menu_runs_and_returns_home | maintenance-actions | pass | pass ×4 | |
| settings :: raise_from_the_menu_homes_the_piston | maintenance-actions | pass | pass ×4 | |
| support :: a_report_without_an_email_creates_the_report_and_sends_only_its_id | update-and-diagnostics | pass | pass ×4 | the ticket service answered through the gate (TLS, the run's CA); only `{"eventID": "<serial>-<localID>"}` sent; nothing else refused; BR-05 without Sentry, as React off Tauri |

**29 passed, 2 xfailed, in every run, on both Dials.** The two xfails are the suite's own known bugs
(strict for the first), failing on the same check with the same value as on React.

### Is the overlay able to fail? (planted bugs)

`qt/tests/integration/plant.sh` copies the QML with two bugs; run `plant1`:

| Planted bug | Journey | Result |
|---|---|---|
| NavTitle's pill never scrolls to the selected card (`scroll: false`) | first_boot :: the_title_pill_names_the_card_a_new_machine_opens_on | **failed**: `(wait_for_pill(screen, "Free Pour") or "").casefold() == "free pour"`: 'catalog' |
| same | home :: the_title_pill_names_the_selected_card | **failed**: 'catalog' == 'pill 91b4' |
| Device Info values end in "!" | home :: device_info_shows_the_identity_and_firmware_the_machine_reports | **failed**: 'firmware: 7e9fbea-sil!' == 'firmware: 7e9fbea-sil' |
| (none) | the three others of the two files | pass |

## Gaps seen in the Qt Dial

No journey fails, so the gaps below come from the Dial's logs during the runs and from the React run next
to it (`compare.py react2 full4`).

COMPARE_PLACEHOLDER

From the Qt Dial's own log (`pages/<test>.dial.log`), over a whole run:

| What | Where | Seen | Effect |
|---|---|---|---|
| `QML FpText: Binding loop detected for property "font.letterSpacing"` / `"font.wordSpacing"` | freepour/FpText.qml (used by FreePourScreen, Readiness, FlowMeter, RailPoint, FreePourHistoryScreen, StepLabel, AbortHint, manual/ManualGauge, manual/ManualModeSetup) | ~100 warnings in the Free Pour journey, a few in manual mode | `font.letterSpacing` and `font.wordSpacing` are bound to expressions that read `font.pixelSize`: writing a member of the `font` group while reading another re-evaluates the binding; the value ends right but each change logs and costs a re-layout. Read the size from a plain property (e.g. `property real px: 16; font.pixelSize: px` and use `px`). For the freepour group. |
| `LottieItem: rlottie cannot read .../lottie/brew-mini-piston.json` | brew/MiniPurgePiston.qml | full1 only (6×, the brew-complete purge) | the small piston on Brew complete did not draw; the file was replaced during the run and full2 to full4 load it. |
| `[BR-05] Sentry is not initialized` | support | every report | expected off the machine (`DIAL_SENTRY_DSN` unset), as React off Tauri. |
| No JavaScript exception (TypeError, ReferenceError, ...) | | 0 in every run | |

## Differences on purpose (the overlay against the React fixture)

- One fresh Dial process per test (new storage file) where React opens a fresh browser context;
  `screen.restart()` starts a new process on the same storage, as a page reload keeps localStorage.
- `routes()` is `Nav.history`: no "+bubble" entries (no journey reads them; `in_order` and membership are
  unaffected).
- `carousel()` is every card (`dialProbe_cards`); the React page lays out only the cards around the focused
  one. `go_to_card` and `home_cards` are the suite's algorithm unchanged.
- `text()` is every visible Text of the canvas (route, bottom status, bubble, scale overlay), through
  TestServer's own collector; `focused()` is `dialFocusedLabel` as written (React reads the rendered label,
  upper case where CSS transforms it; every journey compares without case).
- `pill_text()` reads the Text whose middle is inside the pill's 230 × 24 box, as `_PILL_JS` does.
- `inject_turns`: "keyboard" is the test port's gestures, "socket" backend `button` events through
  `Input.handleButton`, all sent before reading any answer for a burst.
- `watch.requests` comes from a recording proxy between the Dial and the backend (Socket.IO's own requests
  left out). Third parties go to a gate (the Dial's `http_proxy`/`https_proxy`): refused and recorded, or
  answered over TLS with a certificate of the run's CA installed in the container (Qt reads the system
  store), so `answer_external`, `answered` and `refused` mean what they mean for Chromium.
- JavaScript exceptions in the Dial's log are listed (`pages/<test>.json`) but fail a test only with
  `QT_DIAL_FAIL_ON_QML_ERRORS=1` (React fails on page errors); there were none.
- No video. Screenshots at each failed wait and at the end of a failed test, composited over black.

## Not done

- The mobile suite (`tests/test_mobile_*.py`) still opens the React Dial as the machine's display; its
  `machine_display` could take `QtDialApp` the same way.
- No `report.html` (ci/report.py needs the videos); `results.md` and `compare.py` instead.
- Not wired into meticulous-integration's CI (it would need the Qt binary as an artifact and the Qt runtime
  in the runner; the Dockerfile lists the packages).

## Requests for the core

- TestServer: a `pill` probe (NavTitle: the line it shows) and a `graph` probe on Brew complete (curves,
  selected point) would replace the geometry and the PlotLine walk the overlay does through `eval`.
- TestServer `texts`: cover the whole canvas (bottom status, scale overlay), as the React journeys read
  `.meticulous-main-canvas`; the overlay calls `collectTexts(root)` through `eval` meanwhile.
- `docs/qt-migration/TESTING.md`, "Against the real firmware": point at `qt/tests/integration/` (it says
  "not done yet").
