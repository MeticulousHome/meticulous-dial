# Parity: Free Pour, guided pour-over, pour-over history, manual mode setup (group "freepour")

Qt files: `qt/qml/Dial/screens/freepour/` and `qt/qml/Dial/screens/manual/`, the tests
`qt/tests/e2e/test_freepour.py`, and three entries in `qt/tests/js/map.json`.

Every screen was compared with the React Dial (its Vite build in headless Chromium, the scale fed through
the Redux store, REST forwarded to the same emulated backend, the same steps on both): temperature, the
three setup steps (waiting / ready / busy / error boxes), the setup review (recorded weight and "continue"),
ready / pouring / waiting / drawdown with the pour rail, the guided target rail with its flashing cue and
stop weight, the flow meter, "lift brewer", "measuring", "server removed", the result, the history chart,
and the manual setup's gauges, "Off" and start menu. Text positions agree within 1-2 px (ink boxes); the
logic agrees event for event (the `[FreePour]` journal lines of both runs match: stages, pours, cue, brewer
removal, server missing, accepted weights).

| Feature | React source | Qt file | Status | Notes |
|---|---|---|---|---|
| Free Pour: 8 steps, temperature 70-100 °C (92, or the profile's), push to continue | features/freePour/FreePourScreen.tsx, profile.ts | freepour/FreePourScreen.qml, Profile.js | done | one Loader per stage view (light creation on the route's first frame) |
| Setup: server, brewer (0 g allowed), coffee 5-40 g; record on a stable reading (700 ms within 0.6 g), save cancelled if the weight moved or left the range, then 'action' 'tare' and wait for zero; 5 s → "Tare not confirmed", push retries | FreePourScreen.tsx (useStableWeight, effects), setupFlow.ts | FreePourScreen.qml, SetupFlow.js | done | React's effect order and dependency lists kept (an effect runs with the values of the render that changed it: the stage change that resets `stable` still sees the old one, as in React) |
| Readiness box and record action texts (waiting / ready / busy / error), disabled action at 38 % | FreePourScreen.tsx SetupReadiness, free-pour.css | Readiness.qml, FreePourScreen.qml | done | |
| Setup review: turn on brewer / coffee / ready, recorded weights, "continue"; re-entering restarts from the server | FreePourScreen.tsx | FreePourScreen.qml | done | |
| Brew loop every 100 ms: pour detection, backdated start, pre-start ring buffer, samples every 200 ms, plausible peak (15 g/s), peak flow ≤ 15 g/s, five pours max (a sixth extends the fifth), 10:00 limit | FreePourScreen.tsx, pourDetector.ts, brewWeightFilter.ts | FreePourScreen.qml, PourDetector.js, BrewWeightFilter.js | done | `Native.monotonicMs()` for performance.now() |
| Brewer lift: removal threshold (max(28, 55 % of setup)), 3 s + 700 ms stable confirmation, "setup still on scale" rejection, measuring, server missing → "Server removed", put back or push to skip | FreePourScreen.tsx, brewWeightFilter.ts | FreePourScreen.qml, BrewWeightFilter.js | done | |
| Live screen: timer, status (READY / POUR n [OF n] / WAITING / DRAWDOWN), pour rail, weight (or CURRENT → STOP), flow meter with the profile's target tick, instructions | FreePourScreen.tsx (FlowMeter, PourRail, TargetPourRail) | FreePourScreen.qml, FlowMeter.qml, PourRail.qml, TargetPourRail.qml, RailPoint.qml | done | cue: 5 × (0.5 s white / 0.5 s plain) when ≤ 5 s remain, white when due |
| Result: brewed, water poured, retained, total time; push → history; double press aborts everywhere (exit on the result) | FreePourScreen.tsx | FreePourScreen.qml | done | |
| Session record (schema 4) and save: cache, queue, POST /history/pour-over, unqueue; community scan request after a save | FreePourScreen.tsx createSession, storage.ts, historyApi.ts | FreePourScreen.qml, FreePourStorage.qml, HistoryApi.js | done | the scan goes to main.qml's `communityScanRequested` signal (via `Window.window`) |
| Local history on Native storage, newest first, pending queue, pruning | storage.ts (IndexedDB) | FreePourStorage.qml | done | keeps 16 brews instead of 128, stored as JSON text (see below) |
| syncPendingFreePourSessions (10 per run, key order, missing records dropped, failures kept) | storage.ts, App.tsx | FreePourStorage.syncPendingFreePourSessions / syncAtStartup | done | main.qml must call it (requests) |
| getLatestFreePourSession: the cache or the backend's newer brew (/history/pour-over/last + file), cached | storage.ts, historyApi.ts | FreePourStorage.qml, HistoryApi.js | done | |
| Guided pour-over: GET /pour-over/profile/get/<id>?include_image=false, contract check, loading ring, home without a selection or on errors, reload on a new selection | features/freePour/GuidedPourOverScreen.tsx, profileApi.ts | freepour/GuidedPourOverScreen.qml, ProfileApi.js | done | |
| Pour-over profile contract (structure + semantics), Dial shape | profileContract.ts | freepour/ProfileContract.js | done | `parsePourOverProfile(value)` for `Profiles.parsePourOverProfile` (requests) |
| Installed profiles list / refetch / delete | usePourOverProfiles.ts, profileApi.ts | Core Profiles (existing) | done | ProfileApi.js also has them for completeness |
| profileEvents.isPourOverProfileEvent | profileEvents.ts | freepour/ProfileEvents.js | done | Backend.qml makes the same test |
| History screen: title, dose · temperature · water, weight and flow lines (≤ 1200 points), pour dots, grid, cursor (5 s per detent), pour / time / water / flow, legend, empty and loading states, push or double press → home | features/freePour/FreePourHistoryScreen.tsx, free-pour-history.css | freepour/FreePourHistoryScreen.qml | done | PlotLine for the lines and the dashed grid |
| format.ts, logging.ts (`[FreePour] {json}` lines to the journal) | format.ts, logging.ts | Format.js, Logging.js | done | an Api rejection logs its message (React's errors are Error objects) |
| Free Pour icon | FreePourIcon.tsx | assets/icons/free-pour.svg (home group, already there) | done | |
| Manual setup: read the backend's manual profile (seeded default on 404), temperature (0-99, 0.5), final weight (0-100, 0.5; long press → Off, resumes where it was), start on pressure / flow / abort; save, load, start → heating or manual-purge; failures and abort / double press → previous screen + Experimental menu; useDimScreen | components/ManualModeSetup/ManualModeSetup.tsx | manual/ManualModeSetup.qml | done | gestures off while loading or while the bubble intercepts |
| Gauge (value, dimmed leading zeros, unit, ring) | SettingNumerical/Gauge.tsx, gauge.css | manual/ManualGauge.qml | done | a copy (requests); text wider than its 282 px box overflows from the left as in CSS |
| Manual editing rules | ManualModeSetup/manualSetup.ts, constants/manualMode.ts | manual/ManualSetup.js | done | |
| Entry: quick settings → Experimental → Manual mode | Settings/Experimental.tsx, QuickSettings.tsx | settings/ExperimentalSettings.qml (settings group) | done | the whole path passes in test_manual_mode_is_reached_from_the_experimental_menu |
| createProfileFromManualBrew | api/manualMode.ts | Core ManualMode (existing) | done | used by the quick settings |

## Tests

- `qt/tests/e2e/test_freepour.py`, 16 tests, all passing against the group's emulated backend: the free pour
  journey of meticulous-integration (setup, pour, lift, totals, history, backend record with its
  measurements, nothing left queued), temperature limits, tare timeout and retry, setup review restart,
  server lifted + skip, double-press abort, pending sync to the backend, newest local / backend brew, the
  guided pour-over (rail, stop weight, next pour, drawdown, record naming the profile), the contract
  installed as Profiles' hook, guided without a selection, the manual setup from the Experimental menu, the
  three answers saved before the start, abort / double press back to the menu, and the JS libraries'
  cases run in the Dial's engine (FreePourLibTests.qml: setupFlow, contract, detector, weight filter;
  ManualSetupTests.qml: manualSetup). The emulated backend has no scale: the tests play it through the
  screen's `testScale` and tare it when the Dial asks.
- `qt/scripts/js-tests.sh`: tests/pourOverProfileContract.test.ts and tests/freePourSetup.test.mts pass;
  tests/manualSetup.test.mts passes once run.mjs clones results into the test's realm (requests).
- Not ported: the manual brew itself (knob steering the setpoint, push switching control, long press
  ending) needs the firmware's manual stages, which the emulated backend does not run (the Barometer is the
  brew group's).

## Differences on purpose

- The local history keeps 16 brews, not 128: Native storage is one JSON file rewritten on every
  `storageSet` (by any feature) and a brew carries up to 3000 samples. The backend keeps the full history
  and the Dial only shows the newest brew; queued brews beyond 16 are pruned as React prunes beyond 128.
- `font-variant-numeric: tabular-nums`: ABC Diatype's tnum makes the space, digits and `: · + ° –` 0.6 em
  wide. Qt 6.4 has no font features: spaces get the difference as word spacing (word gaps match); digits
  and punctuation keep proportional widths (a line like "NEXT POUR · START 0:15" is ~10 px narrower).
- Mono text gets the browser's whole-pixel advances (0.6 em rounded) as letter spacing, so 11-13 px labels
  are as wide as in the browser.
- Logging an Api failure keeps the rejection's message instead of "[object Object]".

## Not done

- The manual brew journey's second half (firmware manual stages), see Tests.
- Digit / punctuation tabular widths (Qt 6.6 font features).

## Requests for the core

- main.qml: install the contract parser and run App.tsx's start-up sync (checked with an equivalent scratch
  file: the qualified directory import gives the same singleton the screens use):

  ```qml
  import "Dial/screens/freepour" as FreePour
  import "Dial/screens/freepour/ProfileContract.js" as PourOverContract
  ...
  Component.onCompleted: {
      Profiles.parsePourOverProfile = PourOverContract.parsePourOverProfile
      FreePour.FreePourStorage.syncAtStartup()
  }
  ```
- `Native.storageSet` writes a JS array or object as null (the QVariant holds a QJSValue; convert it with
  `QJSValue::toVariant()` before `QJsonValue::fromVariant`). FreePourStorage stores JSON text meanwhile.
- Native storage rewrites one file on every set: a per-key file would let the Free Pour cache keep 128 brews.
- `qt/tests/js/run.mjs`: `v.map(clone)` makes the copy in the vm's realm (species), so deepStrictEqual on
  arrays fails; `Array.from(v, clone)` fixes tests/manualSetup.test.mts (verified with a local copy).
- `run-dev.sh`: every instance starts Xvfb on :99 with `--network host`, and the abstract X socket is shared
  between containers: a second instance attaches to the first one's server and dies with it ("The X11
  connection broke"). Derive the display from TEST_PORT. (I ran mine on :127 with a copy of the script.)
- `e2e.sh` passes `tests/e2e "$@"`, so naming one file still runs the whole directory.
- The Community uploader (when ported) should listen to main.qml's `communityScanRequested`, which Free
  Pour emits after saving a brew (React: `invoke('community_scan_history')`).
- A shared Gauge component in `components/` (manual/ManualGauge.qml copies Gauge.tsx; SettingNumerical
  has its own).
