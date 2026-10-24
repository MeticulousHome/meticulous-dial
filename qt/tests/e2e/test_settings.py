"""The machine's settings from the Dial: config, Brew Settings, Experimental, Advanced Settings, Device Info,
time & date and the time zone picker (ported from meticulous-integration tests/test_dial_settings.py and
the device info journey of tests/test_dial_02_home.py, plus the React screens' own branches).

Every test puts back the settings it changes (the `restore` fixture). Run against a backend of your own
when other groups share the default one (DIAL_API).
"""

import math
import time

import pytest

# The settings these tests may change; `restore` puts them back.
TOUCHED = ["enable_sounds", "auto_start_shot", "auto_purge_after_shot", "partial_retraction", "tare_behavior",
           "reverse_scrolling", "ssh_enabled", "update_channel", "idle_screen", "clock_format_24_hour",
           "timezone_sync", "time_zone"]

PISTON_AREA_MM2 = math.pi * 26.5 * 26.5


def mm_to_ml(mm):
    return round(PISTON_AREA_MM2 * mm / 1000)


def ml_to_mm(ml):
    return round(ml * 1000 * 100 / PISTON_AREA_MM2) / 100


def post_settings(backend, change):
    """POST /settings/ one key at a time. The emulated backend answers an SSH change with an error object
    followed by the settings (two JSON documents), which json cannot parse: the change is still applied."""
    for key, value in change.items():
        try:
            backend.post("/api/v1/settings/", {key: value})
        except ValueError:
            pass


@pytest.fixture
def restore(backend):
    _, before = backend.get("/api/v1/settings/")
    yield before
    _, now = backend.get("/api/v1/settings/")
    changed = {k: before[k] for k in TOUCHED if k in before and now.get(k) != before[k]}
    if changed:
        post_settings(backend, changed)
        _, after = backend.get("/api/v1/settings/")
        assert {k: after[k] for k in changed} == changed


def settings(backend):
    return backend.get("/api/v1/settings/")[1]


def wait_for_setting(backend, key, value, timeout_s=5):
    deadline = time.monotonic() + timeout_s
    while time.monotonic() < deadline:
        if settings(backend).get(key) == value:
            return
        time.sleep(0.1)
    raise AssertionError(f"{key} is {settings(backend).get(key)!r}, not {value!r}")


def open_quick_settings(screen):
    screen.wait_for_home()
    screen.controls.context()
    screen.wait_for_bubble("quick-settings")


def open_config(screen):
    open_quick_settings(screen)
    screen.select("config")
    screen.wait_for_bubble("settings")
    screen.wait_for_focus("Device Info")


def open_brew_settings(screen):
    open_quick_settings(screen)
    screen.select("Brew Settings")
    screen.wait_for_bubble("brewSettings")
    screen.wait_for_focus("Start:")


def open_advanced(screen):
    open_config(screen)
    screen.select("Advanced Settings")
    screen.wait_for_bubble("advancedSettings")
    screen.wait_for_focus("SSH:")


def walk(screen, limit=30):
    """Every entry of the focused menu, top to bottom."""
    for _ in range(limit):
        before = screen.focused()
        screen.controls.left()
        if screen.focused() == before:
            break
    seen = [screen.focused()]
    for _ in range(limit):
        screen.controls.right()
        f = screen.focused()
        if f == seen[-1]:
            break
        seen.append(f)
    return seen


def wait_for_focused(screen, label, timeout_s=5):
    """The focused entry reads exactly `label` (casefold)."""
    deadline = time.monotonic() + timeout_s
    while time.monotonic() < deadline:
        f = screen.focused()
        if f is not None and f.casefold() == label.casefold():
            return
        time.sleep(0.05)
    raise AssertionError(f"focus is on {screen.focused()!r}, not {label!r}")


# ---- config

def test_config_lists_its_entries_with_their_values(screen, backend):
    """Protects: the config menu (Settings.tsx): its entries in order, sounds with its value, Community
    with its connection state (not connected without the uploader)."""
    s = settings(backend)
    open_config(screen)
    assert walk(screen) == ["Device Info", "Community: Not connected", "time & date",
                            "sounds: " + ("ENABLED" if s["enable_sounds"] else "DISABLED"),
                            "calibrate scale", "Scroll Directions", "Advanced Settings", "Back"]
    screen.select("Back")
    screen.wait_for_bubble("quick-settings")


def test_sounds_are_toggled_from_config(screen, backend, restore):
    """Protects: turning the machine's sounds on and off at the Dial (enable_sounds)."""
    before = settings(backend)["enable_sounds"]
    open_config(screen)
    screen.focus("sounds:")
    screen.controls.push()
    wait_for_setting(backend, "enable_sounds", not before)
    wait_for_focused(screen, "sounds: " + ("ENABLED" if not before else "DISABLED"))
    screen.controls.push()
    wait_for_setting(backend, "enable_sounds", before)


def test_calibrate_scale_closes_the_menu_and_opens_the_calibration(screen):
    open_config(screen)
    screen.select("calibrate scale")
    screen.wait_for_bubble_closed()
    screen.wait_for_route("calibrateScale", timeout_s=5)


def test_scroll_directions_are_toggled(screen, backend, restore):
    """Protects: reversing the knob on the profiles carousel (reverse_scrolling.home) without touching the
    keyboard's direction."""
    before = settings(backend)["reverse_scrolling"]
    open_config(screen)
    screen.select("Scroll Directions")
    screen.wait_for_bubble("scrollDirections")
    assert walk(screen) == ["Profiles: " + ("Reversed" if before["home"] else "Classic"),
                            "Keyboard: " + ("Reversed" if before["keyboard"] else "Classic"), "Back"]
    screen.focus("Profiles:")
    screen.controls.push()
    wait_for_setting(backend, "reverse_scrolling", {**before, "home": not before["home"]})
    wait_for_focused(screen, "Profiles: " + ("Reversed" if not before["home"] else "Classic"))
    screen.select("Back")
    screen.wait_for_bubble("quick-settings")


# ---- Brew Settings (test_dial_settings.py)

def test_brew_settings_changed_on_the_dial_are_kept_by_the_machine(screen, backend, restore):
    """Protects: the start and purge behaviour a user chooses at the machine.

    Limit: BrewSettings toggles the boolean settings auto_start_shot and auto_purge_after_shot with a push;
    the backend stores them. The integration journey restarts the Dial; here the menu is reopened, which
    reads them again from the backend.
    """
    backend.post("/api/v1/settings/", {"auto_start_shot": False, "auto_purge_after_shot": False})
    open_brew_settings(screen)
    wait_for_focused(screen, "Start: On button press")

    screen.controls.push()
    wait_for_focused(screen, "Start: Automatic")
    screen.focus("Purge:")
    screen.controls.push()
    wait_for_focused(screen, "Purge: Automatic")

    after = settings(backend)
    assert (after["auto_start_shot"], after["auto_purge_after_shot"]) == (True, True)

    # Reopened, the menu shows what the machine has.
    screen.controls.context()
    screen.wait_for_bubble_closed()
    open_brew_settings(screen)
    wait_for_focused(screen, "Start: Automatic")
    screen.focus("Purge:")
    wait_for_focused(screen, "Purge: Automatic")


def test_brew_settings_list_their_values(screen, backend):
    """Protects: the Brew Settings labels: the retraction as a volume, Auto Tare unavailable on a machine
    that does not support it (the emulated one), the pre/post-heat timeout."""
    s = settings(backend)
    _, info = backend.get("/api/v1/machine")
    open_brew_settings(screen)
    tare = ("Before retraction" if s["tare_behavior"] == "before_retraction" else "After retraction") \
        if info.get("tare_behavior_supported") else "Unavailable"
    assert walk(screen) == [
        "Start: " + ("Automatic" if s["auto_start_shot"] else "On button press"),
        "Purge: " + ("Automatic" if s["auto_purge_after_shot"] else "On button press"),
        f"Retraction distance: {mm_to_ml(s['partial_retraction'])} mL",
        f"Auto Tare: {tare}",
        f"Pre/Post-heat: {s['heating_timeout']} min",
        "Back",
    ]


def test_auto_tare_does_nothing_when_unsupported(screen, backend):
    _, info = backend.get("/api/v1/machine")
    if info.get("tare_behavior_supported"):
        pytest.skip("this machine supports the tare behaviour")
    open_brew_settings(screen)
    screen.select("Auto Tare:")
    time.sleep(0.5)
    assert screen.bubble_component() == "brewSettings"
    assert screen.route() == "profileHome"


def test_retraction_distance_is_set_on_its_gauge(screen, backend, restore):
    """Protects: the retraction volume (RetractionVolume.tsx): the gauge starts at the stored volume, the
    knob moves it 1 ml a step, a push stores it in mm and reopens Brew Settings over the previous screen."""
    start_ml = mm_to_ml(settings(backend)["partial_retraction"])
    open_brew_settings(screen)
    screen.select("Retraction distance:")
    screen.wait_for_bubble_closed()
    screen.wait_for_route("retraction_volume", timeout_s=5)
    assert screen.probe("retractionVolume") == start_ml
    assert screen.has_text("ml")

    screen.controls.right(3)
    assert screen.probe("retractionVolume") == start_ml + 3
    screen.controls.left(1)
    assert screen.probe("retractionVolume") == start_ml + 2

    screen.controls.push()
    screen.wait_for_bubble("brewSettings")
    screen.wait_for_route("profileHome", timeout_s=5)
    wait_for_setting(backend, "partial_retraction", ml_to_mm(start_ml + 2))
    screen.focus("Retraction distance:")
    wait_for_focused(screen, f"Retraction distance: {start_ml + 2} mL")


def test_retraction_gauge_stops_at_its_limits(screen, backend, restore):
    """The gauge runs from 80 to 150 ml."""
    backend.post("/api/v1/settings/", {"partial_retraction": ml_to_mm(82)})
    screen.wait_for_home()
    time.sleep(2.2)   # the settings poll: the gauge starts from the settings the Dial has
    screen.c.call({"cmd": "screen", "name": "retraction_volume"})
    screen.wait_for_route("retraction_volume", timeout_s=5)
    deadline = time.monotonic() + 5
    while screen.probe("retractionVolume") != 82 and time.monotonic() < deadline:
        time.sleep(0.1)
    screen.controls.left(4)
    assert screen.probe("retractionVolume") == 80
    screen.controls.right(72)
    assert screen.probe("retractionVolume") == 150


def test_tare_behavior_marks_and_stores_the_choice(screen, backend, restore):
    """Protects: the Auto Tare screen (TareBehavior.tsx): the stored choice is focused and marked
    "current", a push stores the focused one, Back reopens Brew Settings over the previous screen.

    Limit: reached directly (the emulated machine does not support the tare behaviour, so Brew Settings
    does not open it)."""
    backend.post("/api/v1/settings/", {"tare_behavior": "after_retraction"})
    screen.wait_for_home()
    time.sleep(2.2)   # the settings poll
    screen.c.call({"cmd": "screen", "name": "tare_behavior"})
    screen.wait_for_route("tare_behavior", timeout_s=5)
    wait_for_focused(screen, "After retraction")
    assert screen.has_text("current")

    screen.controls.right()
    wait_for_focused(screen, "Before retraction")
    screen.controls.push()
    wait_for_setting(backend, "tare_behavior", "before_retraction")

    screen.select("Back")
    screen.wait_for_bubble("brewSettings")
    screen.wait_for_route("profileHome", timeout_s=5)


def test_pre_post_heat_opens_its_screen(screen):
    open_brew_settings(screen)
    screen.select("Pre/Post-heat:")
    screen.wait_for_bubble_closed()
    screen.wait_for_route("heat_timeout_after_shot", timeout_s=5)


# ---- Experimental

def test_experimental_opens_the_manual_setup(screen):
    open_quick_settings(screen)
    screen.select("Experimental")
    screen.wait_for_bubble("experimentalSettings")
    assert walk(screen) == ["Manual mode", "Back"]
    screen.select("Manual mode")
    screen.wait_for_bubble_closed()
    screen.wait_for_route("manualSetup", timeout_s=5)


# ---- Device Info (test_dial_02_home.py)

def test_device_info_shows_the_identity_and_firmware_the_machine_reports(screen, backend):
    """Protects: the machine information the user (and support) reads on the Dial.

    Limit: the backend's /api/v1/machine; DeviceInfoScreen prints every field (booleans as ENABLED /
    DISABLED, null as UNSET, without tare_behavior_supported and repository_info). The emulated machine
    has no firmware, so its identity fields stand in for the firmware version of the journey.
    """
    _, info = backend.get("/api/v1/machine")
    open_config(screen)
    screen.select("Device Info")
    screen.wait_for_bubble("deviceInfo")
    screen.wait_for_focus("Show device info QR")

    def shown(value):
        if isinstance(value, bool):
            return "ENABLED" if value else "DISABLED"
        if value is None:
            return "UNSET"
        if isinstance(value, list):
            return ",".join("[object Object]" if isinstance(v, dict) else str(v) for v in value)
        if isinstance(value, dict):
            return "[object Object]"
        return str(value)

    expected = [f"{k}: {shown(v)}" for k, v in info.items() if k not in ("repository_info", "tare_behavior_supported")]
    repo = info.get("repository_info") or {}
    for k in ("backend", "dial", "firmware"):
        if k in repo:
            commit, _, comment = repo[k]["commit"].partition("-")
            expected.append(f"{k}: {repo[k]['branch']} ({commit.strip()} - {comment[:20]}...)")
    assert walk(screen, limit=40) == ["Show device info QR"] + expected + ["Back"]

    for key in ("serial", "name", "hostname"):
        screen.focus(f"{key}:")
        assert screen.focused().casefold() == f"{key}: {shown(info[key])}".casefold()

    screen.select("Back")
    screen.wait_for_bubble("settings")
    screen.wait_for_focus("Device Info")


def test_device_info_qr_encodes_serial_batch_and_color(screen, backend):
    """Protects: the QR code support scans (InfoQrCode.tsx): SN, batch and colour; a push returns."""
    _, info = backend.get("/api/v1/machine")
    open_config(screen)
    screen.select("Device Info")
    screen.wait_for_focus("Show device info QR")
    screen.controls.push()
    screen.wait_for_bubble("deviceInfoQR")
    assert screen.probe("qrValue") == f"SN:{info['serial']} BATCH:{info['batch_number']} COLOR:{(info['color'] or '').upper()}"
    assert screen.has_text("Scan with a QR Code scanner")
    screen.controls.push()
    screen.wait_for_bubble("deviceInfo")


# ---- Community

# A stand-in for Dial.Native's Community (the C++ uploader's API): an invisible item on the bubble
# ("fakeCommunity") that the settings screens use instead of the real uploader once it is in
# SettingsStore.communityOverride (reached through the config screen). Installed before the Community
# screen opens, so that the tests never ask the real Community service for a pairing code.
FIND_FAKE = "(function () { const k = bubble.children; for (let i = 0; i < k.length; i++)" \
            " if (k[i].objectName === 'fakeCommunity') return k[i]; return null })()"
INSTALL_FAKE = r"""
(function () {
  function find(item) {
    if (!item) return null;
    if (item.hasOwnProperty('settingsStore')) return item;
    for (let i = 0; i < item.children.length; i++) { const f = find(item.children[i]); if (f) return f; }
    return null;
  }
  let fake = %s;
  if (!fake) {
    fake = Qt.createQmlObject(`import QtQuick; Item {
      objectName: "fakeCommunity"
      visible: false
      property var store: null
      property var status: ({ state: "not_connected", connected: false, paused: false, pendingCount: 0,
                              lastSuccessAt: null, lastError: null, lastRetryAt: null, enrollmentExpiresAt: null })
      property string lastSerial: "-"
      property int enrollments: 0
      property string failEnrollment: ""
      property int expiresIn: 600
      signal enrollmentResult(var result)
      signal operationFinished(string op, string error)
      function set(change) { status = Object.assign({}, status, change) }
      function beginEnrollment(serial) {
        lastSerial = serial
        enrollments++
        const r = failEnrollment ? { error: failEnrollment }
                                 : { qrUrl: "https://community.meticuloushome.com/pair/ABCDEF123456",
                                     expiresAt: Math.floor(Date.now() / 1000) + expiresIn }
        Qt.callLater(() => enrollmentResult(r))
      }
      function setUploadPaused(p) { set({ paused: p, state: p ? "upload_paused" : "connected" }); Qt.callLater(() => operationFinished("setUploadPaused", "")) }
      function disconnect() { set({ connected: false, paused: false, state: "not_connected" }); Qt.callLater(() => operationFinished("disconnect", "")) }
      function factoryResetLocal() { return "" }
      function scanHistory() { return "" }
    }`, bubble);
  }
  if (!fake.store) {
    const config = find(bubble);
    if (!config) return 'no config screen';
    fake.store = config.settingsStore;
  }
  fake.store.communityOverride = fake;
  return 'ok';
})()
""" % FIND_FAKE

NOT_CONNECTED = ("({ state: 'not_connected', connected: false, paused: false, pendingCount: 0, lastSuccessAt: null,"
                 " lastError: null, lastRetryAt: null, enrollmentExpiresAt: null })")


def fake_community(screen, js=""):
    """Runs `js` on the stand-in (as `c`) and makes the settings screens use it (the first time, the
    config screen must be open: it leads to SettingsStore)."""
    if js:
        screen.c.call({"cmd": "eval", "js": f"(function (c) {{ if (c) {{ {js} }} }})({FIND_FAKE})"})
    assert screen.c.call({"cmd": "eval", "js": INSTALL_FAKE})["value"] == "ok"
    if js:
        screen.c.call({"cmd": "eval", "js": f"(function (c) {{ {js} }})({FIND_FAKE})"})


def fake_value(screen, expr):
    return screen.c.call({"cmd": "eval", "js": f"(function (c) {{ return {expr} }})({FIND_FAKE})"})["value"]


@pytest.fixture
def stand_in(screen):
    yield
    # Back to the real uploader for the other tests.
    screen.c.call({"cmd": "eval", "js": f"(function (c) {{ if (c && c.store) c.store.communityOverride = null }})({FIND_FAKE})"})


def wait_for_probe(screen, name, value, timeout_s=5):
    deadline = time.monotonic() + timeout_s
    while screen.probe(name) != value and time.monotonic() < deadline:
        time.sleep(0.05)
    assert screen.probe(name) == value, f"{name} is {screen.probe(name)!r}, not {value!r}"


def open_community(screen, js):
    open_config(screen)
    fake_community(screen, js)
    screen.select("Community:")
    screen.wait_for_bubble("community")


def test_community_pairs_and_manages_uploads(screen, backend, stand_in):
    """Protects: Community.tsx with the uploader: a pairing code is requested once with the machine's
    serial and shown with its countdown; becoming connected while pairing says so (Done returns to the
    settings, whose label follows the state); connected, uploads pause and resume and Disconnect asks
    first.

    Limit: the uploader is a stand-in with the C++ Community API (no request reaches the real service)."""
    _, info = backend.get("/api/v1/machine")
    open_community(screen, f"c.failEnrollment = ''; c.expiresIn = 600; c.enrollments = 0; c.status = {NOT_CONNECTED}")
    wait_for_probe(screen, "communityMode", "connect")
    screen.wait_for_text("Code expires in", timeout_s=5)
    assert fake_value(screen, "c.lastSerial") == str(info["serial"])
    assert fake_value(screen, "c.enrollments") == "1"
    wait_for_focused(screen, "Back")

    fake_community(screen, "c.set({ connected: true, state: 'connected' })")
    wait_for_probe(screen, "communityMode", "connected-success")
    assert screen.has_text("Connected to Community")
    wait_for_focused(screen, "Done")
    screen.controls.push()
    screen.wait_for_bubble("settings")

    screen.focus("Community:")
    wait_for_focused(screen, "Community: Connected")
    screen.controls.push()
    screen.wait_for_bubble("community")
    fake_community(screen, "c.set({ pendingCount: 3, lastError: 'http_503' })")
    wait_for_probe(screen, "communityMode", "connected")
    assert screen.has_text("Retry state") and screen.has_text("http 503") and screen.has_text("Not yet")
    wait_for_focused(screen, "Back")
    screen.controls.right()
    wait_for_focused(screen, "Pause uploads")
    screen.controls.push()
    wait_for_focused(screen, "Resume uploads")
    assert screen.has_text("Upload paused")
    screen.controls.push()
    wait_for_focused(screen, "Pause uploads")

    screen.controls.right()
    wait_for_focused(screen, "Disconnect")
    screen.controls.push()
    wait_for_probe(screen, "communityMode", "disconnect")
    wait_for_focused(screen, "Cancel")
    screen.controls.right()
    wait_for_focused(screen, "Disconnect")
    screen.controls.push()
    wait_for_probe(screen, "communityMode", "connect")
    wait_for_focused(screen, "Back")
    screen.select("Back")
    screen.wait_for_bubble("settings")
    wait_for_focused(screen, "Device Info")


def test_community_offers_to_try_again(screen, stand_in):
    """A failed or expired pairing code offers Try again, which requests a new one."""
    open_community(screen, f"c.failEnrollment = 'network_down'; c.expiresIn = 600; c.status = {NOT_CONNECTED}")
    screen.wait_for_text("Could not create a secure code", timeout_s=5)
    assert screen.has_text("network_down")
    wait_for_focused(screen, "Try again")
    fake_community(screen, "c.failEnrollment = ''; c.expiresIn = 2")
    screen.controls.push()
    screen.wait_for_text("Code expires in", timeout_s=5)
    screen.wait_for_text("Secure code expired", timeout_s=5)
    wait_for_focused(screen, "Try again")
    screen.controls.right()
    screen.select("Back")
    screen.wait_for_bubble("settings")


def test_community_unavailable_offers_only_back(screen, stand_in):
    """Protects: the unavailable state (the uploader could not use its storage): its explanation, the
    last error and Back to the settings."""
    open_community(screen, "c.status = ({ state: 'unavailable', connected: false, paused: false, pendingCount: 0,"
                           " lastSuccessAt: null, lastError: 'storage_unwritable', lastRetryAt: null,"
                           " enrollmentExpiresAt: null })")
    wait_for_probe(screen, "communityMode", "unavailable")
    assert screen.has_text("Community Unavailable") and screen.has_text("storage unwritable")
    wait_for_focused(screen, "Back")
    screen.controls.right()
    wait_for_focused(screen, "Back")
    screen.controls.push()
    screen.wait_for_bubble("settings")


# ---- Advanced Settings

def test_advanced_settings_list_their_values(screen, backend):
    """Protects: Advanced.tsx: SSH, the display alignment, the update channel (unless limited access), the
    idle screen's short name, the root password (case kept), factory reset, the manufacturing options when
    the backend offers them, Back."""
    s = settings(backend)
    short = {"default": "Analog", "digital": "Digital", "metCat": "Cat", "dvd": "DVD"}
    _, pw = backend.get("/api/v1/machine/root-password")
    status, _ = backend.get("/api/v1/manufacturing")
    open_advanced(screen)
    time.sleep(0.5)
    expected = ["SSH: " + ("ENABLED" if s["ssh_enabled"] else "DISABLED"), "Display Alignment Screen"]
    if s.get("update_channel") != "factory":
        expected.append(f"Update channel: {s['update_channel']}")
    expected += [f"Select Idle Screen: {short.get(s['idle_screen'], 'undefined')}",
                 f"ROOT PASSWORD: {pw['root_password']}", "Factory reset"]
    if status == 200:
        expected.append("Manufacturing Options")
    expected.append("Back")
    assert walk(screen) == expected


def test_ssh_is_toggled(screen, backend, restore):
    """SSH toggles with a push. Limit: the emulated backend stores it but answers with an error object
    followed by the settings, which the Dial takes as its settings until the next poll (2 s)."""
    before = settings(backend)["ssh_enabled"]
    open_advanced(screen)
    screen.controls.push()
    wait_for_setting(backend, "ssh_enabled", not before)
    wait_for_focused(screen, "SSH: " + ("ENABLED" if not before else "DISABLED"))


def test_update_channel_is_chosen_and_marked_current(screen, backend, restore):
    open_advanced(screen)
    screen.select("Update channel:")
    screen.wait_for_bubble("updateChannel")
    assert walk(screen) == ["stable", "beta", "Back"]
    screen.select("beta")
    wait_for_setting(backend, "update_channel", "beta")
    deadline = time.monotonic() + 3
    while "current" not in [t.casefold() for t in screen.texts()] and time.monotonic() < deadline:
        time.sleep(0.1)
    assert "current" in [t.casefold() for t in screen.texts()]
    screen.select("Back")
    screen.wait_for_bubble("advancedSettings")
    wait_for_focused(screen, "SSH: " + ("ENABLED" if settings(backend)["ssh_enabled"] else "DISABLED"))


def test_idle_screen_is_chosen_and_shown(screen, backend, restore):
    """Protects: IdleScreenSetting.tsx: a push stores the idle screen and sends the Dial to sleep to show
    it."""
    open_advanced(screen)
    screen.select("Select Idle Screen:")
    screen.wait_for_bubble("idleScreenSettings")
    assert walk(screen) == ["Analog Clock", "Digital Clock", "Digital Cat Clock", "DVD Style", "Back"]
    screen.select("Digital Clock")
    wait_for_setting(backend, "idle_screen", "digital")
    deadline = time.monotonic() + 3
    while not screen.state()["idle"] and time.monotonic() < deadline:
        time.sleep(0.1)
    assert screen.state()["idle"]
    # Wake it: the idle screen reopens the bubble it was forced from; close it for the next test.
    screen.controls.push()
    deadline = time.monotonic() + 3
    while (screen.state()["idle"] or not screen.state()["bubbleVisible"]) and time.monotonic() < deadline:
        time.sleep(0.1)
    if screen.state()["bubbleVisible"]:
        screen.controls.context()
        screen.wait_for_bubble_closed()


def test_display_alignment_screen_returns_to_advanced(screen):
    open_advanced(screen)
    screen.select("Display Alignment Screen")
    screen.wait_for_bubble_closed()
    screen.wait_for_route("displayAlignment", timeout_s=5)
    screen.controls.push()
    screen.wait_for_bubble("advancedSettings")
    screen.wait_for_route("profileHome", timeout_s=5)


def test_factory_reset_asks_for_the_serial(screen, backend):
    """Protects: FactoryReset.tsx up to the serial: Back is focused first, the reset asks for the serial
    on the keyboard, a wrong one is refused ("Serial does not match") and cancel returns to the warning.
    The right serial is never typed: it would reset the backend."""
    open_advanced(screen)
    screen.select("Factory reset")
    screen.wait_for_bubble("factoryReset")
    wait_for_focused(screen, "Back")
    assert screen.has_text("WARNING") and screen.has_text("This operation cannot be undone")
    screen.controls.left()
    wait_for_focused(screen, "!! Factory reset !!")
    screen.controls.push()
    screen.wait_for_text("Enter Serial Number", timeout_s=5)

    # Type "a" (the first letter) and "ok": not the serial.
    _, info = backend.get("/api/v1/machine")
    assert str(info["serial"]).strip().lower() != "a"
    screen.controls.push()
    screen.focus("ok", max_steps=50)
    screen.controls.push()
    screen.wait_for_text("Serial does not match", timeout_s=5)
    assert screen.probe("resetState") == "idle"

    screen.focus("cancel", max_steps=50)
    screen.controls.push()
    wait_for_focused(screen, "!! Factory reset !!")
    screen.controls.right()
    screen.select("Back")
    screen.wait_for_bubble("advancedSettings")


def test_manufacturing_options_toggle_and_go_back(screen, backend):
    """Protects: Manufacturing.tsx: the toggles the backend lists, with the values POST /manufacturing
    answers; master calibration and Back after them."""
    status, schema = backend.get("/api/v1/manufacturing")
    if status != 200:
        pytest.skip("the backend offers no manufacturing options")
    _, current = backend.post("/api/v1/manufacturing", {})
    open_advanced(screen)
    screen.select("Manufacturing Options")
    screen.wait_for_bubble("manufacturingSettings")
    labels = [f"{e['label']}: {'ENABLED' if current.get(e['key']) else 'DISABLED'}" for e in schema["Elements"]]
    assert walk(screen) == labels + ["ACAIA master calibration", "Back"]

    skip = next(e for e in schema["Elements"] if e["key"] == "skip_stage")
    screen.focus(skip["label"] + ":")
    screen.controls.push()
    wait_for_focused(screen, f"{skip['label']}: {'DISABLED' if current['skip_stage'] else 'ENABLED'}")
    screen.controls.push()
    wait_for_focused(screen, f"{skip['label']}: {'ENABLED' if current['skip_stage'] else 'DISABLED'}")
    assert backend.post("/api/v1/manufacturing", {})[1]["skip_stage"] == current["skip_stage"]
    screen.select("Back")
    screen.wait_for_bubble("advancedSettings")


def test_os_status_reads_the_update_status(screen):
    """OSStatus.tsx (no menu opens it in the React Dial): the status line, then Back."""
    screen.wait_for_home()
    screen.c.call({"cmd": "eval", "js": "Nav.setBubbleDisplay({ visible: true, component: 'OSStatus' })"})
    screen.wait_for_bubble("OSStatus")
    assert screen.focused() in ("OS up to date.", "Update Complete", "Failed to get update status") \
        or screen.focused().startswith(("Downloading Update", "Installing Update"))
    screen.controls.right()
    wait_for_focused(screen, "Back")
    screen.controls.push()
    screen.wait_for_bubble("advancedSettings")


# ---- time & date

def open_time_date(screen):
    open_config(screen)
    screen.select("time & date")
    screen.wait_for_bubble("timeDate")
    screen.wait_for_focus("Set time zone:")


def test_time_and_date_show_the_os_time(screen, backend):
    """Protects: TimeDateConfig.tsx: the time zone, the clock format, and the OS local time and date
    (read every second)."""
    s = settings(backend)
    open_time_date(screen)
    labels = walk(screen)
    assert labels[0] == f"Set time zone: {s['time_zone'] or 'Not set'}"
    assert labels[1] == "Time format: " + ("12-hour" if s.get("clock_format_24_hour") is False else "24-hour")
    now = time.localtime()
    assert labels[2].startswith("Set Time: ") and len(labels[2]) == len("Set Time: 00:00")
    hh, mm = labels[2][len("Set Time: "):].split(":")
    assert abs((int(hh) * 60 + int(mm)) - (now.tm_hour * 60 + now.tm_min)) % (24 * 60) in (0, 1, 24 * 60 - 1)
    assert labels[3] == "Set Date: " + time.strftime("%Y-%m-%d", now)
    assert labels[4] == "Back"


def test_clock_format_is_toggled(screen, backend, restore):
    before = settings(backend).get("clock_format_24_hour") is not False
    open_time_date(screen)
    screen.focus("Time format:")
    screen.controls.push()
    wait_for_setting(backend, "clock_format_24_hour", not before)
    wait_for_focused(screen, "Time format: " + ("24-hour" if not before else "12-hour"))


def test_set_time_moves_hours_and_minutes_and_aborts(screen):
    """Protects: TimeConfig.tsx: the knob moves the hours, a push switches to the minutes, a double press
    aborts back to time & date."""
    open_time_date(screen)
    screen.select("Set Time:")
    screen.wait_for_bubble("timeConfig")
    wait_for_focused(screen, "hours")
    start = screen.probe("time")
    h, m = map(int, start.split(":"))
    screen.controls.right(2)
    assert screen.probe("time") == f"{(h + 2) % 24:02d}:{m:02d}"
    screen.controls.push()
    wait_for_focused(screen, "minutes")
    screen.controls.left(3)
    total = ((h + 2) * 60 + m - 3) % (24 * 60)
    assert screen.probe("time") == f"{total // 60:02d}:{total % 60:02d}"
    screen.controls.double_push()
    screen.wait_for_bubble("timeDate")


def test_set_time_long_press_confirms(screen):
    """A long press sets the time (POST /machine/time) and returns to time & date. Limit: the emulated
    backend only records the timedatectl call."""
    open_time_date(screen)
    screen.select("Set Time:")
    screen.wait_for_bubble("timeConfig")
    screen.controls.long_push()
    screen.wait_for_bubble("timeDate")


def test_set_date_cycles_day_month_year(screen):
    """Protects: DateConfig.tsx: day, month and year in turn, rolling over as Date does."""
    open_time_date(screen)
    screen.select("Set Date:")
    screen.wait_for_bubble("dateConfig")
    wait_for_focused(screen, "day")
    y, mo, d = map(int, screen.probe("date").split("-"))
    screen.controls.push()
    wait_for_focused(screen, "month")
    screen.controls.push()
    wait_for_focused(screen, "year")
    screen.controls.right()
    assert screen.probe("date").startswith(f"{y + 1}-")
    screen.controls.push()
    wait_for_focused(screen, "day")
    screen.controls.double_push()
    screen.wait_for_bubble("timeDate")


def test_time_zone_is_picked_by_country_and_city(screen, backend, restore):
    """Protects: the manual time zone: Automatic off shows Select Timezone, the country's first letter on
    the keyboard lists its countries (GET /timezones/countries), a country its cities, and a city stores its
    zone and reopens the time zone menu (TimeZoneConfig, SelectLetterCountry, CountrySettings,
    TimeZoneSettings)."""
    backend.post("/api/v1/settings/", {"timezone_sync": "automatic"})
    time.sleep(2.2)
    open_time_date(screen)
    screen.select("Set time zone:")
    screen.wait_for_bubble("timeZoneConfig")
    assert walk(screen) == ["Automatic: ENABLED", "Back"]
    screen.select("Automatic:")
    wait_for_setting(backend, "timezone_sync", "manual")
    wait_for_focused(screen, "Automatic: DISABLED")
    screen.select("Select Timezone")
    screen.wait_for_bubble_closed()
    screen.wait_for_route("selectLetterCountry", timeout_s=5)
    screen.wait_for_text("Your country", timeout_s=5)

    screen.focus("m", max_steps=30)
    screen.controls.push()
    screen.wait_for_route("countrySettings", timeout_s=5)
    _, countries = backend.get("/api/v1/timezones/countries?filter=m")
    deadline = time.monotonic() + 5
    while screen.probe("countries") != countries["countries"] and time.monotonic() < deadline:
        time.sleep(0.1)
    assert screen.probe("countries") == countries["countries"]
    wait_for_focused(screen, "Back")
    screen.focus("Mexico", max_steps=40)
    screen.controls.push()
    screen.wait_for_route("timeZoneSettings", timeout_s=5)
    _, cities = backend.get("/api/v1/timezones/cities?filter=Mexico")
    deadline = time.monotonic() + 5
    while screen.probe("cities") != cities["cities"] and time.monotonic() < deadline:
        time.sleep(0.1)
    screen.focus("Mexico City", max_steps=40)
    assert screen.has_text("America/Mexico_City")
    screen.controls.push()
    wait_for_setting(backend, "time_zone", "America/Mexico_City")
    screen.wait_for_bubble("timeZoneConfig")
    # The barometer it goes to returns home while the machine is idle.
    screen.wait_for_any_route(["barometer", "profileHome"], timeout_s=5)


def test_letter_keyboard_cancel_returns_home_with_the_time_zone_menu(screen):
    screen.wait_for_home()
    screen.c.call({"cmd": "screen", "name": "selectLetterCountry"})
    screen.wait_for_route("selectLetterCountry", timeout_s=5)
    screen.focus("cancel", max_steps=30)
    screen.controls.push()
    screen.wait_for_bubble("timeZoneConfig")
    screen.wait_for_route("profileHome", timeout_s=5)


def test_city_list_back_returns_to_the_countries(screen):
    screen.wait_for_home()
    screen.c.call({"cmd": "eval", "js": "UiState.countryLetter = 'm'; UiState.country = 'Mexico'"})
    screen.c.call({"cmd": "screen", "name": "timeZoneSettings"})
    screen.wait_for_route("timeZoneSettings", timeout_s=5)
    wait_for_focused(screen, "Back")
    screen.controls.push()
    screen.wait_for_route("countrySettings", timeout_s=5)


def test_country_list_back_returns_to_the_letter(screen):
    screen.wait_for_home()
    screen.c.call({"cmd": "eval", "js": "UiState.countryLetter = 'z'"})
    screen.c.call({"cmd": "screen", "name": "countrySettings"})
    screen.wait_for_route("countrySettings", timeout_s=5)
    wait_for_focused(screen, "Back")
    screen.controls.push()
    screen.wait_for_route("selectLetterCountry", timeout_s=5)
