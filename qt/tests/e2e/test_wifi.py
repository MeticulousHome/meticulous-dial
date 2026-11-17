"""The Wi-Fi menus (src/components/Wifi/**, src/hooks/useWifi.tsx, src/api/wifi.ts): qt/qml/Dial/screens/wifi.

Against the emulated backend, which stubs NetworkManager (no network in range, none saved, connect and
repair fail, the hotspot cannot start), the tests check what it allows: the menu for its state, the
details, the mode picker without saving, repair's error, the empty scan, the password keyboard and the
connect error, the connection code, the "connect via app" explanation and the Wi-Fi texts.

Against qt/tests/e2e/wifi_fake.py (the Dial's API and DIAL_API pointed at it) the same run also covers the
lists, deleting, connecting (wrong password, degraded link), saving a mode and a network config that
cannot load. Saving a mode on the plain emulated backend changes it for good (it cannot go back to the
hotspot), so that test runs only with DIAL_WIFI_MODE_CHANGES=1, against a backend of your own.
"""

import json
import os
import time

import pytest

QT_IMAGE_READY = 1
KEYBOARD_KEYS = list("abcdefghijklmnopqrstuvwxyz1234567890") + ["space", "ok", "backspace", "capslock", "keyboardType", "cancel"]


# ---- the backend and the fake

def fake_state(backend):
    """The fake's machine, or None on a real backend."""
    try:
        status, body = backend.get("/fake/state")
    except (ValueError, json.JSONDecodeError):
        return None
    return body if status == 200 and isinstance(body, dict) and "known_wifis" in body else None


def needs_fake(backend):
    if fake_state(backend) is None:
        pytest.skip("needs qt/tests/e2e/wifi_fake.py: the emulated backend has no Wi-Fi to list or join")


def set_fake(backend, **patch):
    status, _ = backend.post("/fake/state", patch)
    assert status == 200


@pytest.fixture(autouse=True)
def fresh_fake(backend):
    """The fake starts every test as its initial machine."""
    is_fake = fake_state(backend) is not None
    if is_fake:
        set_fake(backend, reset=True)
    yield
    if is_fake:
        set_fake(backend, reset=True)


def wifi_config(backend):
    status, body = backend.get("/api/v1/wifi/config")
    assert status == 200, body
    return body


# ---- src/components/Wifi/wifiHealthMessages.ts (to know what the screens must say)

def status_label(health, connected=True):
    if not connected:
        return "NOT CONNECTED"
    if not health:
        return "UNKNOWN"
    if health.get("mode") == "AP" and health.get("ap_active"):
        return "HOTSPOT ACTIVE"
    if not health.get("degraded"):
        return "CONNECTED"
    return {"internet_unreachable": "NO INTERNET", "dns_unreachable": "DNS ISSUE",
            "gateway_unreachable": "ROUTER ISSUE", "missing_ipv4": "NO IP ADDRESS",
            "wifi_device_unavailable": "WIFI STARTING", "wifi_not_connected": "NOT CONNECTED",
            "hotspot_not_active": "HOTSPOT ISSUE"}.get(health.get("last_error"), "CHECK NETWORK")


def health_message(health):
    if not health:
        return ""
    if health.get("mode") == "AP" and health.get("ap_active"):
        return health.get("message") or "Hotspot active. Connect your phone or computer to the machine's Wi-Fi network."
    if not health.get("degraded"):
        return "HEALTHY"
    if health.get("message"):
        return health["message"]
    return {
        "internet_unreachable": "Connected to Wi-Fi, but this network does not appear to have internet access. Check the router or phone hotspot data connection.",
        "dns_unreachable": "Connected to Wi-Fi, but DNS is not working. Check the router internet or DNS settings.",
        "gateway_unreachable": "Connected to Wi-Fi, but the router is not responding. Move closer or restart the router.",
        "missing_ipv4": "Connected to Wi-Fi, but the router did not assign an IP address. Check DHCP settings on the router.",
        "wifi_device_unavailable": "Wi-Fi is still starting. Wait a moment and try again.",
        "wifi_not_connected": "The machine is not connected to Wi-Fi.",
        "hotspot_not_active": "The machine could not start its Wi-Fi hotspot. Please try again.",
    }.get(health.get("last_error"), "Wi-Fi could not be verified. Please check the network and try again.")


def recovery_message(health):
    result = (health or {}).get("last_recovery_result")
    if not result:
        return ""
    return {"not_needed": "No repair needed", "not_recoverable": "Network/router issue", "recovered": "Repaired",
            "failed": "Repair failed", "in_progress": "Repairing"}.get(result, result)


def expected_menu(config):
    connected = config["status"]["connected"]
    label = status_label(config.get("health"), connected)
    mode = "Create standalone wifi" if config["config"]["mode"] == "AP" else "Machine joins existing wifi"
    items = [f"Status: {label}"] + (["Show connection code"] if connected else []) + [
        "See network details", f"Wifi mode: {mode}", "Known Wifis", "Connect to a new network"]
    if label not in ("CONNECTED", "HOTSPOT ACTIVE"):
        items.append("Repair WiFi")
    return items + ["Back"]


# ---- driving the Dial

def ensure_home(screen):
    if screen.state()["bubbleVisible"]:
        screen.controls.context()
        screen.wait_for_bubble_closed()
    if screen.route() != "profileHome":
        screen.c.call({"cmd": "screen", "name": "profileHome"})
    screen.wait_for_route("profileHome")
    time.sleep(0.3)


def open_bubble(screen, component):
    screen.c.call({"cmd": "eval", "js": f'Nav.setBubbleDisplay({{ visible: true, component: "{component}" }})'})
    screen.wait_for_bubble(component)
    time.sleep(0.3)


def open_wifi_settings(screen):
    ensure_home(screen)
    screen.controls.context()
    screen.wait_for_bubble("quick-settings")
    screen.select("wifi")
    screen.wait_for_bubble("wifiSettings")
    time.sleep(0.3)


def menu_labels(screen, length_hint=20):
    """Every label of the focused menu, top to bottom (it ends where the focus stops moving)."""
    screen.controls.left(length_hint)
    labels = [screen.focused()]
    for _ in range(length_hint + 5):
        screen.controls.right()
        label = screen.focused()
        if label == labels[-1]:
            break
        labels.append(label)
    return labels


def wait_for(predicate, timeout_s=10, what="condition"):
    deadline = time.monotonic() + timeout_s
    while time.monotonic() < deadline:
        if predicate():
            return
        time.sleep(0.1)
    raise AssertionError(f"timed out waiting for {what}")


def wait_menu_settled(screen, timeout_s=8):
    """Past the "Status: Checking..." of a refetch."""
    wait_for(lambda: not (screen.focused() or "").startswith("Status: Checking"), timeout_s, "the status")


def keyboard_key(screen):
    return screen.probe("keyboardKey")


def key_index(key):
    key = key or ""
    for k in (key, key.lower()):
        if k in KEYBOARD_KEYS:
            return KEYBOARD_KEYS.index(k)
    return None


def press_key(screen, key):
    """Turn the circle keyboard to `key` and push it (whatever the scroll direction setting)."""
    target = KEYBOARD_KEYS.index(key)
    sign = 1
    for _ in range(80):
        current = key_index(keyboard_key(screen))
        if current == target:
            screen.controls.push()
            return
        if current is None:
            screen.controls.right()
            continue
        diff = target - current
        screen.controls.turn(max(-3, min(3, diff)) * sign)
        after = key_index(keyboard_key(screen))
        if after is not None and abs(target - after) > abs(diff):
            sign = -sign
    raise AssertionError(f"could not reach the key {key!r}; on {keyboard_key(screen)!r}")


def type_password(screen, text):
    for ch in text:
        press_key(screen, ch)
    assert screen.probe("keyboardText") == text, screen.probe("keyboardText")
    press_key(screen, "ok")


def open_password(screen, ssid, known=False):
    ensure_home(screen)
    screen.c.call({"cmd": "eval", "js": f'UiState.selectWifi({{ ssid: "{ssid}", useKnownCredentials: {str(known).lower()} }}), Nav.setScreen("enterWifiPassword")'})
    screen.wait_for_route("enterWifiPassword")


# ---- the Wi-Fi texts (wifiHealthMessages.ts) in the Dial's own engine

HEALTH_JS = r"""
(function () {
    const W = Qt.createQmlObject('import QtQuick; import "' + Qt.resolvedUrl("../screens/wifi/WifiHealth.js") + '" as W; QtObject { property var w: W }', server).w
    const cases = {}
    const healthy = { mode: "CLIENT", degraded: false, verified: true }
    cases.notConnected = W.getWifiHealthStatusLabel(healthy, false)
    cases.noHealth = W.getWifiHealthStatusLabel(undefined)
    cases.noHealthDisconnected = W.getWifiHealthStatusLabel(undefined, false)
    cases.hotspot = W.getWifiHealthStatusLabel({ mode: "AP", ap_active: true, degraded: true })
    cases.apInactive = W.getWifiHealthStatusLabel({ mode: "AP", ap_active: false, degraded: true, last_error: "hotspot_not_active" })
    cases.healthy = W.getWifiHealthStatusLabel(healthy, true)
    cases.labels = ["internet_unreachable", "dns_unreachable", "gateway_unreachable", "missing_ipv4",
                    "wifi_device_unavailable", "wifi_not_connected", "hotspot_not_active", "other"]
        .map(e => W.getWifiHealthStatusLabel({ mode: "CLIENT", degraded: true, last_error: e }))
    cases.messages = ["internet_unreachable", "dns_unreachable", "gateway_unreachable", "missing_ipv4",
                      "wifi_device_unavailable", "wifi_not_connected", "hotspot_not_active", "other"]
        .map(e => W.getWifiHealthMessage({ mode: "CLIENT", degraded: true, last_error: e }))
    cases.messageNone = W.getWifiHealthMessage(undefined)
    cases.messageHealthy = W.getWifiHealthMessage(healthy)
    cases.messageOwn = W.getWifiHealthMessage({ mode: "CLIENT", degraded: true, last_error: "dns_unreachable", message: "Own text" })
    cases.messageHotspot = W.getWifiHealthMessage({ mode: "AP", ap_active: true })
    cases.messageHotspotOwn = W.getWifiHealthMessage({ mode: "AP", ap_active: true, message: "Join MeticulousX" })
    cases.recovery = ["not_needed", "not_recoverable", "recovered", "failed", "in_progress", "something_else", ""]
        .map(r => W.getWifiRecoveryMessage({ last_recovery_result: r }))
    cases.recoveryNone = W.getWifiRecoveryMessage(undefined)
    cases.apiAnswer = W.getApiErrorMessage({ status: 400, data: { error: "Bad password", code: "invalid_credentials" } }, "fallback")
    cases.apiAnswerMessage = W.getApiErrorMessage({ status: 400, data: { message: "From message" } }, "fallback")
    cases.apiAnswerText = W.getApiErrorMessage({ status: 400, data: "Failed to write config" }, "fallback")
    cases.apiNoAnswer = W.getApiErrorMessage({ status: 0, data: "", message: "Network Error" }, "fallback")
    cases.apiCode = W.getApiErrorCode({ status: 400, data: { error: "x", code: "wifi_join_failed" } })
    cases.apiCodeNone = String(W.getApiErrorCode({ status: 0, data: "" }))
    return JSON.stringify(cases)
})()
"""


def test_wifi_texts_match_the_react_helpers(screen):
    """Protects: the status labels, health messages, repair results and error texts of
    wifiHealthMessages.ts and api/wifi.ts (WifiHealth.js), every branch."""
    answer = screen.c.call({"cmd": "eval", "js": HEALTH_JS})
    assert "value" in answer, answer
    cases = json.loads(answer["value"])
    assert cases["notConnected"] == "NOT CONNECTED"
    assert cases["noHealth"] == "UNKNOWN"
    assert cases["noHealthDisconnected"] == "NOT CONNECTED"
    assert cases["hotspot"] == "HOTSPOT ACTIVE"
    assert cases["apInactive"] == "HOTSPOT ISSUE"
    assert cases["healthy"] == "CONNECTED"
    assert cases["labels"] == ["NO INTERNET", "DNS ISSUE", "ROUTER ISSUE", "NO IP ADDRESS", "WIFI STARTING",
                               "NOT CONNECTED", "HOTSPOT ISSUE", "CHECK NETWORK"]
    errors = ["internet_unreachable", "dns_unreachable", "gateway_unreachable", "missing_ipv4",
              "wifi_device_unavailable", "wifi_not_connected", "hotspot_not_active", "other"]
    assert cases["messages"] == [health_message({"mode": "CLIENT", "degraded": True, "last_error": e}) for e in errors]
    assert cases["messageNone"] == ""
    assert cases["messageHealthy"] == "HEALTHY"
    assert cases["messageOwn"] == "Own text"
    assert cases["messageHotspot"] == "Hotspot active. Connect your phone or computer to the machine's Wi-Fi network."
    assert cases["messageHotspotOwn"] == "Join MeticulousX"
    assert cases["recovery"] == ["No repair needed", "Network/router issue", "Repaired", "Repair failed", "Repairing",
                                 "something_else", ""]
    assert cases["recoveryNone"] == ""
    assert cases["apiAnswer"] == "Bad password"
    assert cases["apiAnswerMessage"] == "From message"
    assert cases["apiAnswerText"] == "fallback"
    assert cases["apiNoAnswer"] == "Network Error"
    assert cases["apiCode"] == "wifi_join_failed"
    assert cases["apiCodeNone"] == "undefined"


# ---- the Wi-Fi menu

def test_the_wifi_menu_follows_the_network_config(screen, backend):
    """Protects: WifiSettings' entries for the machine's state: the health label, the connection code
    only while connected, the mode, and Repair unless the link is fine; opened from the quick settings."""
    open_wifi_settings(screen)
    wait_menu_settled(screen)
    labels = menu_labels(screen)
    expected = expected_menu(wifi_config(backend))
    assert labels[0] in (expected[0], "Status: Checking..."), labels
    assert labels[1:] == expected[1:], labels


def test_back_returns_to_the_quick_settings(screen):
    """Protects: the Wi-Fi menu's Back (setBubbleDisplay quick-settings)."""
    open_wifi_settings(screen)
    screen.select("Back")
    screen.wait_for_bubble("quick-settings")


def test_the_details_show_the_network(screen, backend):
    """Protects: WifiDetails' rows from /wifi/config (network, hostname, AP, IP, MAC, health, checks, last
    error, recovery) and its Back."""
    open_wifi_settings(screen)
    screen.select("See network details")
    screen.wait_for_bubble("wifiDetails")
    config = wifi_config(backend)
    status, cfg, health = config["status"], config["config"], config.get("health")
    hotspot = bool(health) and health.get("mode") == "AP" and health.get("ap_active")
    unverified = bool(health) and health.get("verified") is False

    def check(key):
        if hotspot:
            return "N/A"
        if not health:
            return ""
        return "OK" if (not unverified and health.get(key)) else "FAILED"

    expected = [
        f"NETWORK: {status.get('connection_name') or ''}", f"HOSTNAME: {status.get('hostname') or ''}",
        f"AP NAME: {cfg.get('apName') or ''}", f"AP PASSWORD: {cfg.get('apPassword') or ''}",
        f"IP: {(status.get('ips') or [''])[0]}", f"MAC: {status.get('mac') or ''}",
        f"HEALTH: {status_label(health, status.get('connected'))}", f"GATEWAY: {check('gateway_reachable')}",
        f"DNS: {check('dns_resolves')}", f"INTERNET: {check('internet_reachable')}",
        f"LAST ERROR: {health_message(health)}", f"RECOVERY: {recovery_message(health)}", "Back"]
    assert menu_labels(screen) == expected
    screen.controls.push()
    screen.wait_for_bubble("wifiSettings")


# ---- the mode picker

def mode_label(mode):
    return "Create standalone WiFi" if mode == "AP" else "Join existing WiFi"


def test_the_mode_picker_starts_on_the_current_mode_and_cancel_keeps_it(screen, backend):
    """Protects: WifiModeSettings: the focus on the current mode ("current"), a pushed mode becoming the
    draft ("selected"), Cancel and a Save of the current mode returning without a change."""
    mode = wifi_config(backend)["config"]["mode"]
    other = "CLIENT" if mode == "AP" else "AP"
    open_wifi_settings(screen)
    screen.select("Wifi mode")
    screen.wait_for_bubble("wifiModeSettings")
    screen.wait_for_focus(mode_label(mode))
    assert "current" in screen.texts()
    assert "selected" not in screen.texts()
    screen.select(mode_label(other))
    assert screen.route() and screen.bubble_component() == "wifiModeSettings"
    wait_for(lambda: "selected" in screen.texts(), 3, "the selected annotation")
    screen.select("Cancel")
    screen.wait_for_bubble("wifiSettings")
    assert wifi_config(backend)["config"]["mode"] == mode

    screen.select("Wifi mode")
    screen.wait_for_bubble("wifiModeSettings")
    screen.select("Save")
    screen.wait_for_bubble("wifiSettings")
    assert wifi_config(backend)["config"]["mode"] == mode


def save_mode(screen, mode):
    screen.select("Wifi mode")
    screen.wait_for_bubble("wifiModeSettings")
    screen.select(mode_label(mode))
    screen.select("Save")


def test_saving_a_mode_switches_it(screen, backend):
    """Protects: Save of another mode: POST /wifi/config with the draft, the mode's loading messages, back
    to the Wi-Fi menu, which shows the new mode once the config is refetched; a failure shows "Could not
    update WiFi" with the reason and OK returns to the menu. (The fake: CLIENT ↔ AP both work.)"""
    needs_fake(backend)
    open_wifi_settings(screen)
    save_mode(screen, "AP")
    screen.wait_for_text("Starting hotspot", 3)
    screen.wait_for_bubble("wifiSettings", 10)
    assert fake_state(backend)["mode"] == "AP"
    # The React Dial merges the answer (the whole status) into `config`: the old mode shows until the
    # next refetch, at most 5 s later.
    wait_for(lambda: screen.has_text("Wifi mode: Create standalone wifi"), 12, "the new mode in the menu")

    set_fake(backend, mode_change_fails=True)
    save_mode(screen, "CLIENT")
    screen.wait_for_text("Joining WiFi mode", 3)
    screen.wait_for_text("Could not update WiFi", 10)
    assert screen.has_text("The machine could not start its Wi-Fi hotspot. Please try again.")
    assert screen.focused() == "Ok"
    screen.controls.push()
    screen.wait_for_bubble("wifiSettings")
    assert fake_state(backend)["mode"] == "AP"


@pytest.mark.skipif(os.environ.get("DIAL_WIFI_MODE_CHANGES") != "1",
                    reason="changes the backend's Wi-Fi mode for good: set DIAL_WIFI_MODE_CHANGES=1 with a backend of your own")
def test_saving_a_mode_on_the_emulated_backend(screen, backend):
    """Protects: the emulated backend's answers to Save: joining (CLIENT) works; the hotspot (AP) cannot
    start: its four loading messages cycle every 7 s for the ~34 s the backend tries, then "Could not
    update WiFi" with "Error updating Network Config." (the answer is plain text)."""
    if fake_state(backend) is not None:
        pytest.skip("for the plain emulated backend")
    open_wifi_settings(screen)
    if wifi_config(backend)["config"]["mode"] == "AP":
        save_mode(screen, "CLIENT")
        screen.wait_for_bubble("wifiSettings", 30)
        assert wifi_config(backend)["config"]["mode"] == "CLIENT"
        # Until the refetch the Dial still holds the old mode (see test_saving_a_mode_switches_it).
        wait_for(lambda: screen.has_text("Wifi mode: Machine joins existing wifi"), 12, "the new mode in the menu")
    save_mode(screen, "AP")
    screen.wait_for_text("Starting hotspot", 3)
    screen.wait_for_text("Trying WiFi channels", 10)
    screen.wait_for_text("Could not update WiFi", 60)
    assert screen.has_text("Error updating Network Config.")
    screen.controls.push()
    screen.wait_for_bubble("wifiSettings")
    # (The emulated backend keeps AP in its config after the exception, so the next run starts from AP.)


# ---- repair

def test_repair_reports_its_outcome(screen, backend):
    """Protects: Repair WiFi: the loading screen ("Checking WiFi"), then the menu again (focus back on the
    status) or "Network issue" with the backend's reason, whose OK returns to the quick settings."""
    is_fake = fake_state(backend) is not None
    if is_fake:
        set_fake(backend, connected=False, repair_fails=True)
    elif "Repair WiFi" not in expected_menu(wifi_config(backend)):
        pytest.skip("the backend's Wi-Fi is fine: no Repair entry")
    open_wifi_settings(screen)
    screen.select("Repair WiFi")
    screen.wait_for_text("Network issue", 15)
    if is_fake:
        assert screen.has_text("The router is not responding.")
    else:
        texts = screen.texts()
        assert len(texts[texts.index("NETWORK ISSUE") + 1]) > 0, texts
    assert screen.focused() == "Ok"
    screen.controls.push()
    screen.wait_for_bubble("quick-settings")

    if not is_fake:
        return
    set_fake(backend, repair_fails=False)
    screen.select("wifi")
    screen.wait_for_bubble("wifiSettings")
    screen.select("Repair WiFi")
    screen.wait_for_text("Checking WiFi", 2)
    wait_for(lambda: (screen.focused() or "").startswith("Status:"), 10, "the menu after the repair")


def test_a_network_config_that_cannot_load_shows_the_error(screen, backend):
    """Protects: WifiSettings' "Could not load WiFi" once /wifi/config has failed 3 retries; OK returns to
    the quick settings."""
    needs_fake(backend)
    set_fake(backend, config_fails=True)
    open_wifi_settings(screen)
    screen.wait_for_text("Could not load WiFi", 25)
    assert screen.has_text("Connection could not be verified. Please check the connection details.")
    screen.controls.push()
    screen.wait_for_bubble("quick-settings")


# ---- saved networks

def test_known_wifis_list_the_saved_networks(screen, backend):
    """Protects: KnownWifi: the known_wifis of /wifi/config then Back; a network opens its menu
    (connect / delete / back) and back returns to the list."""
    known = list(wifi_config(backend)["known_wifis"].keys())
    open_wifi_settings(screen)
    screen.select("Known Wifis")
    screen.wait_for_bubble("KnownWifi")
    assert menu_labels(screen) == known + ["Back"]
    if known:
        screen.select(known[0])
        screen.wait_for_bubble("deleteKnowWifiMenu")
        assert menu_labels(screen) == ["connect", "delete", "back"]
        screen.select("back")
        screen.wait_for_bubble("KnownWifi")
    screen.select("Back")
    screen.wait_for_bubble("wifiSettings")


def test_deleting_a_saved_network(screen, backend):
    """Protects: DeleteWifiMenu's delete: POST /wifi/delete, back to the list without it; a delete that
    keeps failing (3 retries) shows "An error occured. Please try again" with the reason."""
    needs_fake(backend)
    open_wifi_settings(screen)
    screen.select("Known Wifis")
    screen.wait_for_bubble("KnownWifi")
    screen.select("Cafe Guest")
    screen.wait_for_bubble("deleteKnowWifiMenu")
    screen.select("delete")
    screen.wait_for_bubble("KnownWifi", 5)
    assert "Cafe Guest" not in fake_state(backend)["known_wifis"]
    wait_for(lambda: menu_labels(screen) == ["Home WiFi", "Office 5G", "Back"], 10, "the list without it")

    screen.select("Office 5G")
    screen.wait_for_bubble("deleteKnowWifiMenu")
    set_fake(backend, known_wifis={"Home WiFi": {"ssid": "Home WiFi", "type": "PSK"}})
    screen.select("delete")
    screen.wait_for_text("An error occured. Please try again", 20)
    assert screen.has_text("Error deleting known Wi-Fi.")
    screen.controls.push()
    screen.wait_for_bubble("KnownWifi")


def test_connecting_to_a_saved_network(screen, backend):
    """Protects: DeleteWifiMenu's connect: the bubble closes, EnterWifiPassword connects with the saved
    credentials at once (no keyboard) and says "Connected"; OK goes home."""
    needs_fake(backend)
    open_wifi_settings(screen)
    screen.select("Known Wifis")
    screen.wait_for_bubble("KnownWifi")
    screen.select("Office 5G")
    screen.wait_for_bubble("deleteKnowWifiMenu")
    screen.select("connect")
    screen.wait_for_route("enterWifiPassword")
    screen.wait_for_bubble_closed()
    screen.wait_for_text("Connected", 10)
    assert fake_state(backend)["connection_name"] == "Office 5G"
    screen.controls.push()
    screen.wait_for_route("profileHome")


# ---- the scan and the password

def test_the_scan_lists_the_networks_in_range(screen, backend):
    """Protects: SelectWifi: "Scanning..." while /wifi/list runs, then its networks and Back (back to
    the Wi-Fi menu)."""
    is_fake = fake_state(backend) is not None
    open_wifi_settings(screen)
    screen.select("Connect to a new network")
    screen.wait_for_bubble("selectWifi")
    if is_fake:
        assert screen.has_text("Scanning...")
        # Later scans come back at once, so that "Scanning..." does not come and go during the walk.
        set_fake(backend, delays={"list": 0.0, "connect": 1.0, "delete": 0.5, "repair": 2.0, "config": 1.0})
    wait_for(lambda: not screen.has_text("Scanning..."), 10, "the end of the scan")
    status, networks = backend.get("/api/v1/wifi/list")
    assert status == 200
    labels = [label for label in menu_labels(screen) if label != "Scanning..."]
    assert labels == [n["ssid"] for n in networks] + ["Back"]
    screen.select("Back")
    screen.wait_for_bubble("wifiSettings")


def test_a_network_from_the_scan_asks_its_password(screen, backend):
    """Protects: picking a network that is not saved: the bubble closes and the keyboard asks "password
    for <ssid>"; a wrong password says "Check password" and OK goes back to the keyboard with the text
    kept; cancel returns to the previous screen with the scan reopened."""
    needs_fake(backend)
    open_wifi_settings(screen)
    screen.select("Connect to a new network")
    screen.wait_for_bubble("selectWifi")
    wait_for(lambda: not screen.has_text("Scanning..."), 10, "the end of the scan")
    screen.select("Neighbours")
    screen.wait_for_route("enterWifiPassword")
    screen.wait_for_bubble_closed()
    screen.wait_for_text("password for Neighbours", 5)
    type_password(screen, "wrongpass")
    screen.wait_for_text("Check password", 10)
    assert screen.has_text("The password for Neighbours is not correct.")
    screen.controls.push()
    wait_for(lambda: screen.probe("keyboardText") == "wrongpass", 5, "the keyboard with the text")
    press_key(screen, "cancel")
    screen.wait_for_route("profileHome")
    screen.wait_for_bubble("selectWifi")


def test_a_degraded_link_is_reported_after_connecting(screen, backend):
    """Protects: "Connected" with the health label and message when the new link is degraded."""
    needs_fake(backend)
    open_password(screen, "NoInternet Cafe")
    screen.wait_for_text("password for NoInternet Cafe", 5)
    type_password(screen, "abc")
    screen.wait_for_text("Connected", 10)
    assert screen.has_text("NO INTERNET")
    assert screen.has_text("does not appear to have internet access")
    screen.controls.push()
    screen.wait_for_route("profileHome")


def test_a_failed_connection_returns_to_the_keyboard(screen, backend):
    """Protects: EnterWifiPassword's error: "Could not connect to WiFi" with the backend's reason; OK goes
    back to the keyboard (the text kept) as long as a network is selected. (The emulated backend: its
    radio is never ready; the fake: a saved network it does not know.)"""
    is_fake = fake_state(backend) is not None
    open_password(screen, "Mystery Net")
    screen.wait_for_text("password for Mystery Net", 5)
    if is_fake:
        # Without a password the fake wants a saved network: use the saved-credentials path instead.
        open_password(screen, "Mystery Net", known=True)
        reason = "Wi-Fi credentials were not provided."
    else:
        type_password(screen, "x")
        reason = "Wi-Fi radio is not ready. Please wait a moment and try again."
    screen.wait_for_text("Could not connect to WiFi", 15)
    assert screen.has_text(reason)
    assert screen.focused() == "Ok"
    screen.controls.push()
    wait_for(lambda: screen.probe("keyboardKey") is not None, 5, "the keyboard")
    assert screen.has_text("password for Mystery Net")
    if not is_fake:
        assert screen.probe("keyboardText") == "x"


def test_saved_credentials_connect_without_the_keyboard(screen, backend):
    """Protects: useKnownCredentials: the connection starts at once (loading, no keyboard); its result
    shows as for a typed password."""
    is_fake = fake_state(backend) is not None
    open_password(screen, "Home WiFi" if is_fake else "Saved Net", known=True)
    assert screen.probe("keyboardKey") is None
    if is_fake:
        screen.wait_for_text("Connected", 10)
        screen.controls.push()
        screen.wait_for_route("profileHome")
    else:
        screen.wait_for_text("Could not connect to WiFi", 15)
        screen.controls.push()
        wait_for(lambda: screen.probe("keyboardKey") is not None, 5, "the keyboard")


def test_cancelling_the_password_reopens_the_scan(screen):
    """Protects: the keyboard's cancel: back to the previous screen with the scan in the bubble."""
    open_password(screen, "Cancel Net")
    screen.wait_for_text("password for Cancel Net", 5)
    press_key(screen, "cancel")
    screen.wait_for_route("profileHome")
    screen.wait_for_bubble("selectWifi")


# ---- the connection code and "connect via app"

def test_the_connection_code_shows_the_backend_qr(screen, backend):
    """Protects: WifiQrMenu: the backend's QR PNG at 280 px with its caption; a push returns to the Wi-Fi
    menu, and so do 30 s without one. Reached from the menu while connected."""
    if wifi_config(backend)["status"]["connected"]:
        open_wifi_settings(screen)
        screen.select("Show connection code")
        screen.wait_for_bubble("wifiQrMenu")
    else:
        ensure_home(screen)
        open_bubble(screen, "wifiQrMenu")
    wait_for(lambda: screen.probe("qrStatus") == QT_IMAGE_READY, 10, "the QR image")
    assert screen.has_text("Scan with meticulous App to connect to the machine")
    assert screen.focused() == "Back"
    screen.controls.push()
    screen.wait_for_bubble("wifiSettings")

    open_bubble(screen, "wifiQrMenu")
    time.sleep(28)
    assert screen.bubble_component() == "wifiQrMenu"
    screen.wait_for_bubble("wifiSettings", 5)


def test_connect_via_app_explains_the_app(screen):
    """Protects: ConnectWifiMenu (Connect via APP / Connect to a network / Back) and ConnectWifiViaApp's
    explanation, whose push returns to the menu."""
    ensure_home(screen)
    open_bubble(screen, "connectWifiMenu")
    assert menu_labels(screen) == ["Connect via APP", "Connect to a network", "Back"]
    screen.select("Connect via APP")
    screen.wait_for_bubble("connectWifiViaApp")
    text = " ".join(screen.texts())
    assert "existing WiFi download" in text and "the process." in text, text
    screen.controls.push()
    screen.wait_for_bubble("connectWifiMenu")
    screen.select("Connect to a network")
    screen.wait_for_bubble("selectWifi")
    wait_for(lambda: not screen.has_text("Scanning..."), 10, "the end of the scan")
    screen.select("Back")
    screen.wait_for_bubble("wifiSettings")
