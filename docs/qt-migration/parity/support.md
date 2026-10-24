# Parity: support group

Reporting an issue (the bug report bubble, the contact email screen, the mobile app's dispatched reports),
notifications, shot data sharing (the boot prompt and Help us improve) and the unlock screens. Checked side
by side with the React Dial's production build in headless Chromium (vite build against an emulated
backend, driven with its keyboard listeners; markup of the notification and contact email steps injected
with the real CSS where the flow could not be reached): positions match to a pixel or two, the shaped
explanation text line for line (see "Differences on purpose" for the font metrics).

Files: `qt/qml/Dial/screens/support/` (BugReport, BugReportAnimation, BugReportOptions, ExplanationText,
IssueDateCounter, GestureHints, ReportContactEmail, ShotDataSharingPrompt, HelpUsImprove, ShotDataSharingView,
Pill, CssText; singletons ReportFlow, ReportApi, DispatchedReports; ReportLib.js; qmldir),
`screens/notifications/Notification.qml`, `screens/misc/UnlockScreen.qml`, `screens/misc/UnlockMasterCalibration.qml`,
`assets/lottie/support-{collecting-data,collapsing-bridge,processing-submission,finished}.json`,
`qt/tests/e2e/test_support.py`, the `tests/reportHandoff.test.mts` entry of `qt/tests/js/map.json`.

| Feature | React source | Qt file | Status | Notes |
|---|---|---|---|---|
| Bug report screens: message, contact us (QR), your contact info, report setup, date picker, collecting / slow / sending, failure, submitted | BugReport.tsx, bugReport.css, settings.css, quick-settings.css | support/BugReport.qml | done | every option list, label, copy and layout of BugReport.tsx; options 30 px every 33 px, 392 px flush right, 50 px (80 on your contact info) from the bottom |
| Explanation text flowing around the round display (shape-outside floats) | settings.css `.settings-explanation-shaper-*` | support/ExplanationText.qml, ReportLib.explanationLine | done | the two polygons, 1 % shape-margin, float height = half the box's unshaped height (Chromium sizes the flex item before the floats' % height resolves); `<strong>` bold yellow; line breaks identical to Chromium |
| Option pills, HOLD badge, hold fill (1 s ease, yellow slides out, text to white) | BugReport.tsx optionList, bugReport.css | support/BugReportOptions.qml | done | address option keeps its case, ends in an ellipsis |
| Issue date picker: field cycle on press, long press confirms, double press back, never past now, minutes in 30 min steps | BugReport.tsx changeIssueDate etc. | BugReport.qml, ReportLib.changeIssueDate | done | JS Date in the Dial's time zone, as the webview's |
| AnimatedCounter (rolling digits on a spring, pulse on change, leading zero, active underline 150 ms) | react-animated-counter 1.9 (useSpringColumnTransform, styles.css) | support/IssueDateCounter.qml | done | spring k 328 / c 22 / m 0.84 solved in closed form; retarget keeps half the velocity; pulse keyframes as Chromium runs them (in the active field the digits flash #E6E6E6 → yellow → #E6E6E6, as there) |
| Report summary of the picked date with labels | IssueDateParts | IssueDateCounter (readOnly) | done | |
| Loading animation sequence (collecting loop → bridge on the loop boundary → processing loop; finished waits for the bridge) | BugReportAnimation.tsx, animations/*.json | support/BugReportAnimation.qml, LottieItem | done | the four clips copied to assets/lottie/support-*.json; legacy gathering/transmitting (unwired in React) not copied |
| Collection run: preflight (blockers → BR-08..11), create, cancel (abort; draft deleted), slow after 60 s, no serial | reportCollection.ts | support/ReportFlow.qml | done | |
| Hand-off of the run and the email across the contact screen (never sent twice) | reportHandoff.ts, contactEmailEdit.ts | ReportLib.js | done | `tests/reportHandoff.test.mts` passes against ReportLib.js (qt/scripts/js-tests.sh) |
| Submission: ticket (3 retries), link, archive, Sentry feedback (single attempt), mark submitted, 5 min cap, failure codes BR-01..07, notes with the ticket | BugReport.tsx submitReport, reportSubmission.ts | ReportFlow.submit, ReportApi | done | lives in the singleton so it outlives the bubble; the bubble that started it follows it by owner token; a later bubble shows `inFlight`'s outcome; Finished capped at 12 s |
| Report calls of espresso-api 0.15 (resolve with the body or an APIError) | @meticulous-home/espresso-api | support/ReportApi.qml | done | own XHR wrapper: abort signal (cancel stops the backend's collection), binary archive (arraybuffer), axios-like errors |
| Ticket service | getMeticulousReportTracking, sentryConfig.ts | ReportApi | done | only `{eventID: serial-localID}` leaves the machine |
| Sentry feedback with the archive | reportSubmission.ts sendSentryFeedback | ReportApi.sendSentryFeedback | done | see "Differences on purpose": a raw envelope POST (no SDK) |
| Busy: bubble pinned, idle timer kept alive every 30 s | BugReport.tsx | BugReport.qml | done | |
| Exit / Back to the quick settings | exitToQuickSettings | BugReport.qml | done | |
| Contact email screen: keyboard steps, domain grid with Custom and ⌫, confirm with the lit part, declined (Ok / Enter email), edit mode from Your contact info | ReportContactEmail.tsx, reportContactEmail.css | support/ReportContactEmail.qml | done | CircleKeyboard (profile group) with `longPressEnabled`; `reset()` when React would hand an equal new seed |
| Dispatched reports from the mobile app: queue one at a time, busy retries (30 s, 20x), 15 min cap, 3 attempts per session, replay of pending on connect, outcome notification | dispatchedReports.ts, SocketProviderValue.tsx | support/DispatchedReports.qml | partial | works once started; it is started only when the bug report opens (core request 1) |
| Notification screen: newest notification, image, one or several responses (neighbours behind, 300 ms ease, React's element reuse), scroll 50 px with scrollbar and fade, options disabled until the end | Notification.tsx, notification.css | notifications/Notification.qml | done | acknowledged over REST like React (404 counts as done); buttons in "Arial" like the browser's button default |
| Shot data sharing boot prompt (tri-state, Thanks 4 s, error line, Saving...) | ShotDataSharingPrompt.tsx, ShotDataSharingView.tsx, ShotDataSharing.css | support/ShotDataSharingPrompt.qml, ShotDataSharingView.qml, Pill.qml | done | resolvePostReadyScreen is ReadyAnimation's (brew group) |
| Help us improve (opt in / stop sharing, thanks / stopped 4 s, back to the menu) | HelpUsImprove.tsx | support/HelpUsImprove.qml | done | |
| Unlock screen (complete-looking codes tried as typed, 403 remembered, ok forces, 200 → refetch settings and profiles → home) | UnlockScreen.tsx, api.ts unlockMachine | misc/UnlockScreen.qml | done | statuses 200 / 400 / 403 / 429 / 404 / 0 as api.ts maps them |
| Master calibration lock (8888 → scale_master_calibration → home; cancel → manufacturing menu) | UnlockScreen.tsx UnlockMasterCalibration | misc/UnlockMasterCalibration.qml | done | |

## Differences on purpose

- Text metrics (`CssText`): Chromium lays ABC Diatype out with its hhea metrics (ascent 0.85 em, descent
  0.15, rounded) and Qt with the win metrics (0.975 / 0.276), so plain Qt text sits ~3 px lower and line
  boxes are taller. CssText sets padding so the first baseline and every line box land where Chromium puts
  them for a given CSS line-height (the mono cut agrees in both). Glyph advances still differ slightly
  (Chromium hints them to whole pixels at small sizes): a line can wrap one word differently (e.g. the
  setup's "We will reach you back at …" wraps in Chromium, fits on one line here). Hyphenation (`hyphens:
  auto` in the notification text) is not done.
- Sentry: the Qt Dial has no Sentry SDK (DECISIONS.md), but a report reaches support only as a Sentry
  feedback. ReportApi sends that one feedback as Sentry's envelope over HTTP (feedback item + the archive
  as attachment, the DSN's key; 2xx = delivered), on the machine only (eglfs / wayland / linuxfb; under
  the dev X server it is off, like React's browser build, so reports end in BR-05 there). `captureException`
  goes to the journal only. Overrides: `DIAL_SENTRY_DSN`, `DIAL_TICKET_SERVICE_URL`; with the test port
  open, the storage key `support.reportServices` (a JSON string `{ticketServiceUrl, sentryDsn}`) so tests
  answer both services locally. Release tag `meticulous-dial-qt@<version>`. **Coordinator: confirm this
  exception to the "no Sentry" decision.**
- The preflight always probes the real Sentry and ticket origins (the backend refuses private addresses),
  even when the test overrides where the Dial sends.
- The bug report's gesture handler listens only while in the bubble or while no bubble intercepts the
  knob (React's has no condition, so a bug-report route under an open quick settings would hear both).
- Notification: a selection past the last response of a newly shown notification is clamped (React keeps
  it and shows an empty button).
- Notification button glow (`box-shadow 0 0 10px`) is five translucent rounded rectangles (no effects).
- QR code: the core's QrCode item picks a different mask than react-qr-code; same content, both scan.

## Not done

- DispatchedReports runs only after the bug report screen has opened once in the session (until main.qml
  starts it): a dispatch arriving before that waits for the next connect / open (the backend keeps it
  queued, so nothing is lost).
- Notification text hyphenation (above). The legacy Lottie clips (unwired in React).

## Requests for the core

1. main.qml: start the headless upload of the mobile app's reports at boot, as SocketProviderValue does:
   `import "Dial/screens/support" as Support` and `Support.DispatchedReports.start()` in
   `Component.onCompleted` (it syncs the pending dispatches at once when connected, and on every connect).
2. `Native.storageSet(key, object)` stores `null` for a JS object (QJSValue → JSON); strings work. Either
   convert with `QJSValue::toVariant()` or document "JSON strings only".
3. CssText (support/CssText.qml) could move to components/: every screen with CSS line-heights in ABC
   Diatype is ~3 px off without it.
4. qt/tests/e2e/__pycache__/*.pyc are tracked in git and change on every test run.

## Tests

- `qt/tests/e2e/test_support.py`: 18 tests. Against a backend of my own (fresh STATE, `DIAL_PRIVATE_BACKEND=1`):
  18 passed. Against the shared emulated backend (18080): 13 passed, 5 skipped (the boot prompt needs an
  unanswered `shot_data_sharing`; turning sharing on and dispatching app reports would reach every Dial on
  that backend).
- `qt/scripts/js-tests.sh`: `tests/reportHandoff.test.mts` passes against `screens/support/ReportLib.js`.
