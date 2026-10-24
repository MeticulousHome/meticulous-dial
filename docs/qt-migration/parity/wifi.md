# Parity: Wi-Fi (group "wifi")

Qt files: `qt/qml/Dial/screens/wifi/` (one file per route, plus the group's parts below), the icons
`qt/qml/Dial/assets/icons/wifi-level-{1..4}.svg`, the tests `qt/tests/e2e/test_wifi.py` and the fake
backend `qt/tests/e2e/wifi_fake.py`.

Every screen was compared pixel by pixel with the React Dial (its Vite build in headless Chromium, driven
through the same fake backend, same states): menus, annotations, separators, icons, the result screens,
the loading screens, the QR screen and the shaped "connect via app" text line up to the pixel; the only
differences left are glyph rendering (Chromium rounds advances to whole pixels at 16 px).

| Feature | React source | Qt file | Status | Notes |
|---|---|---|---|---|
| Wi-Fi menu: status (Checking... while stale), connection code (connected only), details, mode, known, connect, repair (unless CONNECTED / HOTSPOT ACTIVE), back | Wifi/WifiSettings.tsx | WifiSettings.qml | done | core OptionsMenu; marquee on long labels |
| Repair: loading with 3 messages every 7 s, refetch on success, focus back to the top | WifiSettings.tsx, hooks/useWifi.tsx useRepairWiFi, api/wifi.ts repairWifi | WifiSettings.qml, WifiStore.repair | done | gestures ignored while repairing |
| Errors: "Network issue" (repair) / "Could not load WiFi" (config after 3 retries), OK → quick settings | WifiSettings.tsx | WifiSettings.qml, WifiResponse.qml | done | |
| Mode picker: focus on the current mode, current / selected annotations, Save / Cancel, same-mode Save | Wifi/WifiModeSettings.tsx | WifiModeSettings.qml, WifiMenu.qml | done | gestures only while the bubble intercepts, not while loading / saving |
| Mode save: cancelQueries, POST /wifi/config, per-mode loading messages every 7 s, setQueryData, errors "Could not update WiFi" / "Could not load WiFi mode" | WifiModeSettings.tsx, useUpdateNetworkConfig, updateNetworkConfig | WifiModeSettings.qml, WifiStore.updateConfig | done | React's merge bug kept (see below) |
| Connection code: backend QR PNG 280 px, caption, Back, 30 s auto exit | Wifi/WifiQrMenu.tsx, QR/QrImage.tsx | WifiQrMenu.qml | done | `Api.wifiQrUrl()`, `cache: false` (fresh code on every open) |
| Network details: 12 rows + Back, deep checks kept while unverified, N/A for an active hotspot | Wifi/WifiDetails.tsx | WifiDetails.qml | done | |
| Known networks with WifiIcon (level = distance from the end, max 4), Back | Wifi/KnownWifi.tsx, WifiIcon.tsx | KnownWifi.qml, WifiMenu.qml, icons wifi-level-N.svg | done | |
| Saved network menu: connect (saved credentials) / delete (3 retries, then error with failureReason) / back | Wifi/DeleteWifiMenu.tsx, useDeleteKnownWiFi | DeleteWifiMenu.qml | done | delete keeps the QueryClient's mutation retries (App.tsx) |
| Scan: networks + "Scanning..." (disabled) + Back, refetch on mount and every 5 s; known networks use saved credentials | Wifi/SelectWifi.tsx, useAvailableWiFiList | SelectWifi.qml | done | focus clamped when the list shrinks (see below) |
| Password: CircleKeyboard "password for <ssid>", connect, loading, "Connected" (+ health label and message when degraded) / "Check password" / "Check WiFi" / "Could not connect to WiFi"; OK back to the keyboard (text kept) or home; cancel → previous screen + scan (or saved network menu) | Wifi/EnterWifiPassword.tsx, useConnectToWiFi, connectToWiFi | EnterWifiPassword.qml | done | useDimScreen ported (backlight follows the idle timer) |
| Saved credentials connect at once (no keyboard), once per selection | EnterWifiPassword.tsx | EnterWifiPassword.qml | done | |
| "Connect to a new network" menu (via app / network / back) | Wifi/ConnectWifiMenu.tsx | ConnectWifiMenu.qml | done | unreachable in React too |
| "Connect via APP" explanation wrapped by the shape-outside floats | Wifi/ConnetWifiViaApp.tsx, Settings/settings.css shapers | ConnectWifiViaApp.qml, WifiExplanation.qml | done | line breaks and indents identical to Chromium's |
| Health labels / messages / recovery texts | Wifi/wifiHealthMessages.ts | WifiHealth.js | done | every branch checked in test_wifi_texts_match_the_react_helpers |
| Wi-Fi calls and their error texts (2xx bodies with `error`, answers, no answer) | api/wifi.ts | WifiStore.qml, WifiHealth.js | done | |
| Queries: shared network config (stale 2 s, poll 5 s / 60 s idle, 3 retries 1/2/4 s, gc 5 min), list (refetch on mount, 5 s) | hooks/useWifi.tsx, App.tsx QueryClient | WifiQuery.qml, WifiStore.qml | done | |
| Mutations (retry off but delete: 3 retries), latest call wins, nothing after unmount | useWifi.tsx | WifiMutation.qml | done | |
| wifi slice: selectedWifi, useKnownCredentials, selectedWifiToDelete | store/features/wifi/wifi-slice.ts | Core UiState (existing) | done | |
| Loading screen in the bubble covers the whole display (`position: fixed`) | LoadingScreen/loadingScreen.css | the screens shift the core LoadingScreen by -60 px in the bubble | done | |

## Differences on purpose

- SelectWifi clamps the focus when the list shrinks ("Scanning..." disappears after every scan). React
  leaves the index past the end: an empty yellow bar and a dead push until the next scan, visible on the
  machine every 5 s while the user sits on Back.
- EnterWifiPassword's result screen ignores presses while the bubble intercepts them; React's handler has no
  ignore condition, so a press in the quick settings opened over it would also act on it.
- The bubble screens, shown as routes (`--screen=wifiSettings`), only listen while the bubble does not
  intercept (the PendingScreen rule). In React they are never routes.
- WifiDetails shows the loading screen and then the menu; React calls its hooks after `if (isLoading) return`,
  which throws when the config arrives while it is mounted (normally the config is cached by then).
- A push on a menu entry that no longer exists (the visible entries changed under the focus) does nothing;
  React throws on `undefined.key`.
- repairWifi without an answer reports "Load failed" (WebKit's fetch TypeError text), the React text on the
  machine's WebKitGTK as far as can be told; a non-JSON error answer reports "Error repairing Wi-Fi." where
  React would show the JSON parser's message.
- The shaped explanation decides line breaks with whole-pixel character advances (what the browser's
  shaping does), then draws with Qt's: the lines are the browser's, a line may end up to 2 px into the
  4 px shape margin.

React behaviour kept as is (bugs or oddities, noted):
- Saving a mode merges the whole answer (`{config, status, health, known_wifis}`) into `config`: the menu
  shows the old mode until the next refetch (at most 5 s), and the picker reopened meanwhile thinks the old
  mode is current (a Save then does nothing).
- "Status: Checking..." flickers during every 5 s poll (a refetch of data older than 2 s).
- Cancelling the keyboard returns to the saved network's menu only within the bubble's 450 ms exit (then
  previousComponent is cleared); otherwise to the scan.
- DeleteWifiMenu does not ignore gestures while deleting (another push deletes again).
- WifiIcon's level comes from the row's position, not from the signal.
- ConnectWifiMenu and ConnectWifiViaApp are reachable from nowhere.
- Texts kept with their typos ("An error occured", "quide").
- The "OK" entry is 138 px wide with its text 9 px right of center (`.settings-item`'s padding beats
  `.connect-item`'s in the CSS order).
- On the emulated backend a failed hotspot (AP) save leaves AP in its config (its exception path).

## Not done

- Nothing functional. The React mode picker, with the config not yet cached, slides its list from the first
  entry to "Create standalone WiFi" after its first paint (an effect); the Qt picker starts on it when the
  config is cached (it always is when opened from the Wi-Fi menu).
- The idle clocks' `useNetworkConfig({ idle: true })` (IdleScreen/AnalogClock, DigitalClock) belongs to the
  idle group: they can `import "../wifi"` and use `WifiStore.networkConfig.observe(true)` /
  `.unobserve(token)` and `WifiStore.networkConfig.data.status.connected`.

## Tests

`qt/tests/e2e/test_wifi.py`, 20 tests:
- against the shared emulated backend (Dial on :18080): 13 pass, 7 skip (they need the fake or
  DIAL_WIFI_MODE_CHANGES);
- against the fake (`wifi_fake.py` on :18095 in front of an emulated backend, Dial and DIAL_API on :18095):
  19 pass, 1 skips (the emulated-backend-only mode save);
- `test_saving_a_mode_on_the_emulated_backend` (CLIENT works, AP fails after ~34 s with its four loading
  messages): passes against a backend of my own with `DIAL_WIFI_MODE_CHANGES=1`; it changes the backend's
  mode for good, so it never runs by default. e2e.sh does not forward that variable: run pytest with
  `docker exec -e DIAL_TEST_PORT=... -e DIAL_API=... -e DIAL_WIFI_MODE_CHANGES=1 -w /repo/qt <dial> python3 -m pytest tests/e2e/test_wifi.py`.

The fake: `docker run -d --name <name> --network host -v $REPO:/repo qt-dial-bookworm python3 -u
/repo/qt/tests/e2e/wifi_fake.py --port 18095 --upstream http://127.0.0.1:<backend>` (standard library only;
it proxies everything else, the Socket.IO websocket included). `/fake/state` reads and changes its machine
(networks, saved networks, connected, mode, failures, delays); the tests reset it around each test.

## Requests for the core

1. **OptionsMenu**: what WifiMenu.qml (a fork) adds: a per-option icon before the label (NetworkOption:
   28 px, 16 px gap, scrolling with the marquee); the outer list's annotation margin (WifiModeSettings'
   1.2rem); the annotation as the CSS draws it (12 px with the option's 2.2 px letter spacing, 24 px box
   8 px from the top, placed right after the label when the two do not fit); separator dashes as Chromium
   draws a 2 px dashed border (6 px dashes, gaps stretched to about 4 px so it starts and ends with a dash;
   the core has 4 / 4 px). With those in the core, WifiMenu.qml can go.
2. **run-dev.sh**: every instance runs `Xvfb :99` with `--network host`, so they share the host's abstract
   X11 socket: a Dial may connect to another container's Xvfb and dies ("The X11 connection broke") when that
   container is restarted. My Dial ran on display :24 (a copy of the start command) to stay up. Fix: a
   display per instance (e.g. from TEST_PORT) or `Xvfb ... -nolisten local`.
3. **e2e.sh**: forward the tests' own variables (e.g. every `DIAL_*`), so `DIAL_WIFI_MODE_CHANGES=1` works
   through it.
4. **LoadingScreen**: a `fixed` option (cover the 480 px display when inside the 420 px bubble, as
   `.loading-center { position: fixed }` does); the Wi-Fi screens shift it themselves.
5. **WifiExplanation.qml** (the shape-outside text wrap of `.settings-explanation`) could move to
   components: FactoryReset and BugReport use the same shapers.
