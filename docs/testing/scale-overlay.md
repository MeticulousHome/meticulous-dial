# Fullscreen scale gesture regression

SW-103: closing the fullscreen scale over **Push to brew** must consume the
encoder interaction without continuing the shot. The next complete encoder
press must still work. The small scale remains nonmodal.

Firmware sends physical pressed/released events separately from its logical
single, double or long press notification. Dismissing the overlay on pressed
previously made the underlying screen visible before the logical click arrived.
Scale now keeps fullscreen modal until a recognized click or double click.
A long gesture waits for its raw release too, in either arrival order. Only
Scale stores the observed pressed state and pending long gesture; a new press
discards an old pending long gesture. The shared event distributor is unchanged.
No elapsed-time threshold is used.

A brief raw press/release may never produce a logical notification because
OneButton debounces it. In that case fullscreen stays visible and the next
recognized gesture closes it. If a long gesture loses its release, the next
complete interaction likewise closes the still-visible overlay. There is no
hidden global capture that can swallow a later gesture after the scale closes.
The visible UX change is waiting for the recognized click (the firmware's
double-click window) or the end of a long press before dismissing fullscreen.

## Running

Use the Node version in `.node-version`:

```bash
npm ci
npx playwright install chromium
npm test
npm run test:scale-overlay
```

On Linux, `npx playwright install --with-deps chromium` also installs browser
system dependencies. The CI workflow runs both suites and uploads browser
artifacts on failure. `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH` optionally selects
an existing Chromium/Chrome executable; `SCALE_TEST_OUTPUT` selects the output
directory, which defaults to `test-results/scale-overlay`.

## Coverage and evidence

The browser fixture imports the actual Scale, HeatingScreen, gesture hook,
event distributor, store and continue-action hook. Its visibility boundary
matches App. Settings, profile context and socket transport are simulated;
the fixture does not mount the complete App/Router or connect to a machine.
Requests outside its local Vite server are rejected. The fixture uses 480×480,
93 °C, 18.5 g, water available and manual Push to brew.

Tests cover dismissal, the next intentional press, batched and separately
delivered release/click, long/double presses, small-scale tare and reopening,
hold cancellation, double tare, transition to brew-ready during dismissal,
both release/long orders, incomplete raw interactions, omitted release/terminal,
and the calibration/Free Pour overlay exclusions. A listener under the real
visibility boundary also detects leaked encoder releases or terminal events
that HeatingScreen itself would ignore.

The main regression saves three screenshots, video and `events.json`. Compare
the same test against the baseline and fix: the baseline emits `action,continue`
at dismissal; the fix emits it only on the following intentional press. The
mock does not start a shot, so screenshot appearance alone cannot prove command
suppression. Review the command log with the captures.

The existing Node module tests run separately. Browser tests exercise the same
missing-event sequences that can cross a connection gap, but their socket is
mocked. They do not certify physical encoder timing, Tauri/Wayland packaging,
the actual transport, firmware or actuators.
Hardware verification requires a coordinated lab session. Backend/firmware
abort behavior and automatic brewing are outside this change.
