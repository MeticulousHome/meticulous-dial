"""The brew screens: heating, the barometer, purge, Brew complete with the shot graph, the last shot and the
heating timeout (ported from meticulous-integration tests/test_dial_espresso.py, and the cases of
tests/sw120-heating-long-press.test.mjs; the pure modules run their React unit tests in qt/scripts/js-tests.sh).

Two kinds of tests:
- shots the emulated backend brews (api/emulation.py replays a recorded shot: closing valve, Preinfusion,
  Infusion, retracting, remove cup, purge, idle; about 130 s). It skips the heating (its samples have
  time 0) and never asks "click to purge", and it ignores "finish".
- machine states the emulation cannot produce (heating, no water, sensor errors, manual brews, ...): the
  Dial's socket events are paused (Backend._socket) and the states go in through Backend.onStatus, the
  path a socket "status" event takes.
The actions a screen sends are read from its dialProbe_sent.
"""

import json
import math
import time
import uuid

import pytest


def js(screen, code):
    return screen.c.call({"cmd": "eval", "js": code})["value"]


def default_profile(backend):
    _, defaults = backend.get("/api/v1/profile/defaults")
    return dict(defaults["default"][0])


def a_profile(backend):
    profile = {**default_profile(backend), "id": str(uuid.uuid4()), "name": f"Espresso {uuid.uuid4().hex[:6]}"}
    status, body = backend.post("/api/v1/profile/save", profile)
    assert status == 200, body
    return profile


def routes(screen):
    return [name for _, name in screen.state()["history"]]


def in_order(seen, wanted):
    it = iter(seen)
    return all(any(x == w for x in it) for w in wanted)


def machine_status(screen):
    return js(screen, "Stats.name")


def wait_for(predicate, timeout_s, what):
    deadline = time.monotonic() + timeout_s
    while time.monotonic() < deadline:
        if predicate():
            return
        time.sleep(0.1)
    raise AssertionError(f"timed out waiting for {what}")


def sent(screen):
    return screen.probe("sent") or []


# ---------------------------------------------------------------------------------------------------------
# Injected machine states

DEFAULT_STATUS = {
    "id": "e2e", "state": "brewing", "name": "heating", "extracting": False,
    "sensors": {"p": 0.0, "f": 0.0, "w": 0.0, "t": 60.0, "g": 0.0},
    "time": 0, "profile_time": 0, "profile": "E2E", "setpoints": {"active": None, "temperature": 90},
    "loaded_profile": "E2E",
}


class Machine:
    """Machine states straight into the Dial, its own socket events paused."""

    def __init__(self, screen):
        self.screen = screen

    def pause(self):
        js(self.screen, "Backend._socket.enabled = false")

    def resume(self):
        js(self.screen, "Stats.setWaterStatus(true); Stats.setWaitingForAction(false); Backend._socket.enabled = true")

    def status(self, **changes):
        s = json.loads(json.dumps(DEFAULT_STATUS))
        for k, v in changes.items():
            if isinstance(v, dict) and isinstance(s.get(k), dict) and k != "setpoints":
                s[k].update(v)
            else:
                s[k] = v
        js(self.screen, f"Backend.onStatus({json.dumps(s)}); 'ok'")
        return s

    def stats(self, **changes):
        """The same status name again (Backend.onStatus only refreshes the stats then)."""
        return self.status(**changes)

    def water(self, present):
        js(self.screen, f"Stats.setWaterStatus({'true' if present else 'false'})")

    def sensors(self, **values):
        base = {k: 0 for k in ("t_ext_1", "t_ext_2", "t_bar_up", "t_bar_mu", "t_bar_md", "t_bar_down", "t_tube",
                               "t_motor_temp", "lam_temp", "p", "a_0", "a_1", "a_2", "a_3", "m_pos", "m_spd",
                               "m_pwr", "m_cur", "bh_pwr", "bh_cur", "motor_temp", "weight_pred")}
        base.update(values)
        js(self.screen, f"Stats.setSensors({json.dumps(base)}); 'ok'")

    def idle(self):
        self.status(name="idle", state="idle", extracting=False)


@pytest.fixture
def machine(screen):
    screen.wait_for_home()
    m = Machine(screen)
    m.pause()
    m.idle()
    yield m
    m.idle()
    m.resume()


# ---- heating


def test_heating_shows_the_temperature_its_target_and_the_time_left(screen, machine):
    """Protects: following the preheat (HeatingScreen preheatTimeLeft).

    Limit: the temperature rounded, the target from the setpoint, the estimate in 15 s steps from the
    distance to the target ("a few seconds" within 2 °C, "less than 30 seconds" within 5, "stabilizing..."
    without a setpoint).
    """
    machine.status(name="heating", sensors={"t": 61.4})
    screen.wait_for_route("heating")
    screen.wait_for_text("Estimated time")
    assert screen.probe("temperature") == 61
    assert screen.probe("temperatureTarget") == 90
    assert screen.has_text("Target")
    assert screen.probe("estimate") == "1:45"
    screen.wait_for_text("1:45")

    machine.stats(name="heating", sensors={"t": 86.4})
    wait_for(lambda: screen.probe("estimate") == "less than 30 seconds", 3, "less than 30 seconds")
    machine.stats(name="heating", sensors={"t": 88.5})
    wait_for(lambda: screen.probe("estimate") == "a few seconds", 3, "a few seconds")
    machine.stats(name="heating", sensors={"t": 70}, setpoints={"active": None})
    wait_for(lambda: screen.probe("estimate") == "stabilizing...", 3, "stabilizing...")
    # The cached target stays.
    assert screen.probe("temperatureTarget") == 90


def test_heating_without_water_asks_for_it(screen, machine):
    """Protects: the "pour water" step of a shot (Pour water and click to continue)."""
    machine.status(name="heating", sensors={"t": 70})
    screen.wait_for_route("heating")
    machine.status(name="Pour water and click to continue", sensors={"t": 70})
    screen.wait_for_text("No water")
    screen.wait_for_text("Waiting...")
    screen.wait_for_text("Tap to retry")
    assert screen.probe("bubbleGradient") == 0
    # Water again: the temperature comes back (the footer fades out and in, 600 ms).
    machine.water(True)
    wait_for(lambda: not screen.has_text("No water"), 3, "the temperature back")
    screen.wait_for_text("Estimated time")


@pytest.mark.parametrize(("temperature", "label"), [
    (4000, "Temperature calculation failed"),
    (2000, "Waiting for sensor data to become valid"),
    (1000, "All sensors offline. Please restart"),
    (3000, "Unknown sensor error"),
])
def test_heating_names_the_sensor_errors(screen, machine, temperature, label):
    """Protects: SensorErrorLabel: the firmware's temperature error codes in place of the temperature."""
    machine.status(name="heating", sensors={"t": temperature})
    screen.wait_for_route("heating")
    screen.wait_for_text(label)
    assert not screen.has_text("Target")


def test_heating_options_and_brew_now(screen, machine):
    """Protects: choosing how the shot starts while heating (Heating/OptionsMenu.tsx).

    Limit: PUSH TO BREW focused unless auto_start_shot; turning moves through AUTO BREW, PUSH TO BREW and
    BREW NOW; BREW NOW sends continue after its 2 s fill (brew now, without waiting for the target).
    """
    _, settings = screen_settings(screen)
    machine.status(name="heating", sensors={"t": 70})
    screen.wait_for_route("heating")
    screen.wait_for_focus("Auto brew" if settings.get("auto_start_shot") else "Push to brew")
    screen.controls.left(2)
    screen.wait_for_focus("Auto brew")
    assert screen.probe("option") == "auto_start"
    screen.controls.right()
    screen.wait_for_focus("Push to brew")
    screen.controls.right()
    screen.wait_for_focus("Brew now")
    assert sent(screen) == []
    time.sleep(1.0)
    assert sent(screen) == [], "brew now fired before its fill ended"
    wait_for(lambda: sent(screen) == ["continue"], 3, "continue after the 2 s fill")
    # Leaving BREW NOW before the end cancels it.
    screen.controls.left()
    screen.controls.right()
    time.sleep(0.8)
    screen.controls.left()
    time.sleep(2)
    assert sent(screen) == ["continue"], sent(screen)


def screen_settings(screen):
    return None, json.loads(js(screen, "JSON.stringify(BackendSettings.data || {})"))


def test_heating_finished_push_to_brew(screen, machine):
    """Protects: "click to start": the options leave, both halves slide right, "Push to brew", and a push
    (or a long press, once: sw120) sends continue; before the target a push sends nothing."""
    machine.status(name="heating", sensors={"t": 85})
    screen.wait_for_route("heating")
    screen.wait_for_focus("Push to brew")
    screen.controls.push()
    assert sent(screen) == [], "a push while heating started the shot"
    screen.controls.long_push()
    assert sent(screen) == []

    machine.status(name="click to start", sensors={"t": 90})
    wait_for(lambda: screen.probe("heatingFinished"), 3, "heating finished")
    screen.wait_for_text("Push to brew")
    time.sleep(0.8)
    assert screen.focused() is None, "the options are still there"
    assert not screen.has_text("Estimated time")
    screen.controls.push()
    assert sent(screen) == ["continue"]
    screen.controls.long_push()
    assert sent(screen) == ["continue", "continue"], "a long press must start exactly once"


def test_auto_brew_starts_the_shot_at_the_target(screen, machine):
    """Protects: AUTO BREW: the shot starts by itself when heating ends."""
    machine.status(name="heating", sensors={"t": 85})
    screen.wait_for_route("heating")
    screen.controls.left(2)
    screen.wait_for_focus("Auto brew")
    assert sent(screen) == []
    machine.status(name="click to start", sensors={"t": 90})
    wait_for(lambda: sent(screen) == ["continue"], 3, "the automatic continue")
    # AUTO BREW keeps its menu.
    assert screen.focused() == "Auto brew"


def test_a_double_push_while_heating_aborts(screen, machine):
    """Protects: changing your mind before the shot (brewDoubleClick.ts): heating may only abort."""
    machine.status(name="heating", sensors={"t": 70})
    screen.wait_for_route("heating")
    screen.controls.double_push()
    assert sent(screen) == ["abort"]
    machine.idle()
    screen.wait_for_route("profileHome")


# ---- barometer


def test_the_barometer_reads_the_running_shot(screen, machine):
    """Protects: the shot's live readout (Barometer.tsx).

    Limit: pressure in large with its needle (0..21 bar over 300°, rounded degrees), time, flow, weight,
    gravimetric flow (one decimal, ".0" padded) and the stage's name with its first letter capitalized.
    """
    machine.status(name="Infusion", extracting=True, profile_time=12345,
                   sensors={"p": 8.73, "f": 2.15, "w": 18.4, "g": 1.92, "t": 90})
    screen.wait_for_route("barometer")
    for text in ["Pressure", "8.7", "bar", "Time", "12.3", "sec", "Flow", "2.2", "ml/s", "Weight", "18.4",
                 "gr", "Grav. Flow", "1.9", "g/s", "Infusion"]:
        assert text in screen.texts(), (text, screen.texts())
    assert screen.probe("needleDeg") == round(120 + 8.73 / 21 * 300)
    machine.stats(name="Infusion", extracting=True, sensors={"p": 0, "f": 0, "w": 3, "g": 0, "t": 90})
    wait_for(lambda: screen.probe("needleDeg") == 120, 2, "the needle at 0")
    assert "0.0" in screen.texts() and "3.0" in screen.texts()
    machine.stats(name="Infusion", extracting=True, sensors={"p": 30, "f": 0, "w": 3, "g": 0, "t": 90})
    wait_for(lambda: screen.probe("needleDeg") == 420, 2, "the needle clamped at 21")
    machine.status(name="retracting", extracting=True)
    screen.wait_for_text("Retracting")


def test_a_double_push_on_the_barometer_finishes_a_stage_and_aborts_the_retract(screen, machine):
    """Protects: ending a shot early without losing it (brewDoubleClick.ts): "finish" inside a profile
    stage, only on the barometer; "abort" during the machine's own stages."""
    machine.status(name="Infusion", extracting=True, sensors={"p": 9, "t": 90})
    screen.wait_for_route("barometer")
    screen.controls.double_push()
    assert sent(screen) == ["finish"]
    machine.status(name="retracting", extracting=True)
    screen.controls.double_push()
    assert sent(screen) == ["finish", "abort"]
    machine.status(name="Infusion", extracting=False)
    screen.controls.double_push()
    assert sent(screen)[-1] == "abort"


def test_the_barometer_goes_home_when_the_machine_is_idle(screen, machine):
    """Protects: the shot screens never strand the user: idle (and no notification) is home."""
    machine.status(name="Infusion", extracting=True, sensors={"p": 9, "t": 90})
    screen.wait_for_route("barometer")
    machine.idle()
    screen.wait_for_route("profileHome")


def manual_brew(screen, machine, control, target, **extra):
    """A manual brew: the loaded profile carries manual: true (set once the status change refetched it)."""
    status = dict(name=f"Manual {control}", extracting=True, profile="Manual mode",
                  sensors={"p": 6.1, "f": 1.9, "w": 10.2, "g": 1.2, "t": 90},
                  setpoints={"active": control, control: target}, **extra)
    machine.status(**status)
    time.sleep(1.0)
    js(screen, "Profiles.lastProfile = { load_time: 0, profile: { id: 'manual', name: 'Manual mode', manual: true } }")
    machine.stats(**status)
    return status


def test_a_manual_brew_shows_its_target_and_a_trail_while_it_moves(screen, machine):
    """Protects: the manual brew target (useManualTarget, TargetTick, manualTarget.ts).

    Limit: the tick follows the streamed setpoint in tenths (0..12 bar), "Target x.x bar" under the value;
    a trail follows it while it changes and retracts 400 ms after the last change.
    """
    status = manual_brew(screen, machine, "pressure", 6.0)
    screen.wait_for_route("barometer")
    wait_for(lambda: screen.probe("targetShown"), 3, "the target tick")
    assert screen.probe("targetTenths") == 60
    screen.wait_for_text("Target 6.0 bar")
    assert not screen.probe("trail")
    trail_seen = False
    for i in range(1, 9):
        machine.stats(**{**status, "setpoints": {"active": "pressure", "pressure": 6.0 + 0.3 * i}})
        trail_seen = trail_seen or screen.probe("trail")
        time.sleep(0.1)
    assert trail_seen, "no trail while the target moved"
    assert screen.probe("targetTenths") == 84
    screen.wait_for_text("Target 8.4 bar")
    wait_for(lambda: not screen.probe("trail"), 2, "the trail to retract")
    # Out of range: clamped to 12 bar.
    machine.stats(**{**status, "setpoints": {"active": "pressure", "pressure": 15}})
    wait_for(lambda: screen.probe("targetTenths") == 120, 2, "the target clamped")


def test_the_flow_stage_of_a_manual_brew_turns_the_ring_into_flow(screen, machine):
    """Protects: the flow stage: the needle reads flow (ml/s), the second cell the pressure."""
    manual_brew(screen, machine, "flow", 3.0)
    screen.wait_for_route("barometer")
    wait_for(lambda: screen.probe("flowRing"), 3, "the flow ring")
    texts = screen.texts()
    assert texts.index("Flow") < texts.index("Pressure"), texts
    assert screen.probe("ringValue") == "1.9"
    assert screen.probe("targetTenths") == 30
    screen.wait_for_text("Target 3.0 ml/s")


# ---- purge


def test_the_purge_screen_follows_the_piston(screen, machine):
    """Protects: the purge and raise screens (PurgeScreen, PurgePiston): pressure and flow, the piston at
    m_pos (0..74 mm over 60 frames), "Purging" / "Raising"; home when idle; a double push aborts."""
    machine.sensors(m_pos=37)
    machine.status(name="purge", state="purge", sensors={"p": 0.4, "f": 12.78, "t": 30})
    screen.wait_for_route("manual-purge")
    assert "0.4" in screen.texts() and "12.8" in screen.texts(), screen.texts()
    screen.wait_for_text("Purging")
    wait_for(lambda: abs(screen.probe("pistonFrame") - 30) < 0.01, 2, "the piston at 37 mm")
    machine.sensors(m_pos=74)
    wait_for(lambda: abs(screen.probe("pistonFrame") - 60) < 0.01, 2, "the piston at the end")
    screen.controls.double_push()
    assert sent(screen) == ["abort"]
    machine.idle()
    screen.wait_for_route("profileHome")

    machine.status(name="home", state="home", sensors={"p": 0, "f": 0, "t": 30})
    screen.wait_for_route("manual-purge")
    screen.wait_for_text("Raising")
    assert screen.probe("blinkRaised")


# ---- brew complete


def test_brew_complete_shows_the_weight_and_answers_click_to_purge(screen, machine):
    """Protects: Brew complete before the purge: the weight, "Remove cup" / "Push to purge", the brew
    time; a push answers "click to purge"; without a scale "Scale not connected"."""
    machine.status(name="Infusion", extracting=True, sensors={"p": 9, "t": 90})
    machine.status(name="remove cup", extracting=True, profile_time=41000, sensors={"w": 36.24, "t": 90})
    screen.wait_for_route("brewComplete")
    for text in ["36.2", "g", "REMOVE CUP", "BREW TIME", "0:41"]:
        assert text in screen.texts(), (text, screen.texts())
    machine.status(name="click to purge", extracting=True, profile_time=41000, sensors={"w": 36.24, "t": 90})
    screen.wait_for_text("Push to purge")
    screen.controls.push()
    assert sent(screen) == ["continue"]
    js(screen, "Backend.onStatus(Object.assign({}, Stats.status, { sensors: { p: 0, f: 0, w: NaN, t: 90, g: 0 } })); 'ok'")
    screen.wait_for_text("Scale not connected")


def test_brew_complete_goes_home_at_idle_unless_the_knob_turned(screen, machine):
    """Protects: Brew complete leaves by itself at idle; turning the knob keeps it for reading, until a
    push."""
    machine.status(name="remove cup", extracting=True, sensors={"w": 30, "t": 90})
    screen.wait_for_route("brewComplete")
    machine.idle()
    screen.wait_for_route("profileHome")

    machine.status(name="remove cup", extracting=True, sensors={"w": 30, "t": 90})
    screen.wait_for_route("brewComplete")
    screen.controls.right()
    assert screen.probe("keepGraph")
    machine.idle()
    time.sleep(1.5)
    assert screen.route() == "brewComplete"
    screen.controls.push()
    screen.wait_for_route("profileHome")


# ---- heating timeout


def test_the_heating_timeout_is_set_on_its_gauge(screen, backend):
    """Protects: Pre/Post-heat (HeatTimeoutAfterShot): 0..10 minutes, saved with a push, back to the brew
    settings menu; fast turns each count (test_dial_input)."""
    _, settings = backend.get("/api/v1/settings/")
    before = settings["heating_timeout"]
    try:
        screen.wait_for_home()
        screen.c.call({"cmd": "screen", "name": "heat_timeout_after_shot"})
        screen.wait_for_route("heat_timeout_after_shot")
        assert screen.probe("heatingTimeout") == (before or 10)
        assert "MIN" in [t.upper() for t in screen.texts()] and "Time" in screen.texts()
        for _ in range(12):
            screen.c.call({"cmd": "button", "type": "ENCODER_COUNTERCLOCKWISE", "t": 20})
        time.sleep(0.5)
        assert screen.probe("heatingTimeout") == 0, "fast turns were lost"
        screen.controls.right(4)
        assert screen.probe("heatingTimeout") == 4
        screen.controls.push()
        screen.wait_for_route("profileHome")
        screen.wait_for_bubble("brewSettings")
        wait_for(lambda: backend.get("/api/v1/settings/")[1]["heating_timeout"] == 4, 5, "the setting saved")
        screen.controls.context()
    finally:
        backend.post("/api/v1/settings/", {"heating_timeout": before})


# ---------------------------------------------------------------------------------------------------------
# Shots the emulated backend brews (about 130 s each)


def start_from_home(screen, profile):
    """Hold the knob on the profile's card (home hold-to-start)."""
    screen.wait_for_home()
    screen.wait_for_cards([profile["name"]])
    screen.go_to_card(profile["name"])
    screen.controls.hold(2.2)
    screen.wait_for_any_route(["heating", "manual-purge", "barometer"], timeout_s=15)


@pytest.fixture
def shot_profile(backend):
    profile = a_profile(backend)
    yield profile
    backend.request("DELETE", f"/api/v1/profile/delete/{profile['id']}")


def test_an_espresso_brewed_from_the_dial_reaches_the_history(screen, backend, shot_profile):
    """Protects: the whole espresso at the machine (test_dial_espresso espresso-complete).

    Limit: the Dial follows the status to its screens (heating, barometer, Brew complete, home) and the
    shot is recorded for the profile held on the home.
    """
    start_from_home(screen, shot_profile)
    screen.wait_for_route("barometer", timeout_s=30)
    screen.wait_for_route("brewComplete", timeout_s=120)
    screen.wait_for_route("profileHome", timeout_s=120)
    seen = routes(screen)
    assert in_order(seen, ["profileHome", "barometer", "brewComplete", "profileHome"]), seen
    _, shot = backend.get("/api/v1/history/last")
    assert shot["profile"]["id"] == shot_profile["id"]


def test_the_shot_graph_stays_while_you_look_at_it_and_a_push_puts_it_away(screen, backend, shot_profile):
    """Protects: looking back at how the shot went (test_dial_espresso).

    Limit: Brew complete shows the shot's graph from the purge on; turning moves through the shot and
    keeps the graph when the machine is idle again; a push puts it away. Then the same shot is the
    quick settings' "Last shot".
    """
    start_from_home(screen, shot_profile)
    screen.wait_for_route("brewComplete", timeout_s=150)
    wait_for(lambda: machine_status(screen) == "purge", 60, "the purge")
    wait_for(lambda: screen.probe("graphShown") and screen.probe("graphCurves") >= 2, 15, "the shot's graph")
    before = screen.probe("selection")
    screen.controls.right(3)
    assert screen.probe("selection") != before, "turning the knob did not move through the shot"

    wait_for(lambda: machine_status(screen) == "idle", 120, "the machine idle after the purge")
    time.sleep(5)
    assert screen.route() == "brewComplete" and screen.probe("graphShown"), "the graph left while being read"
    screen.controls.push()
    screen.wait_for_home()

    # The last shot from the quick settings: the same graph, and a push goes home.
    screen.controls.context()
    screen.select("Last shot")
    screen.wait_for_route("shot_history")
    wait_for(lambda: screen.probe("graphShown"), 15, "the last shot's graph")
    step = screen.probe("selectedIndex")
    screen.controls.right(2)
    assert screen.probe("selectedIndex") > step
    screen.controls.push()
    screen.wait_for_route("profileHome")


def test_aborting_the_retract_raises_the_piston_and_returns_home(screen, backend, shot_profile):
    """Protects: a double push during the retract aborts (end_profile: the machine homes the piston); the
    Dial shows the raise and comes back home. Inside the profile's stage it finishes (the emulation
    ignores "finish": the shot goes on)."""
    start_from_home(screen, shot_profile)
    wait_for(lambda: machine_status(screen) == "Infusion", 60, "the Infusion stage")
    screen.wait_for_route("barometer")
    screen.controls.double_push()
    assert sent(screen) == ["finish"]
    wait_for(lambda: machine_status(screen) == "retracting", 90, "the retract")
    screen.controls.double_push()
    assert sent(screen)[-1] == "abort"
    screen.wait_for_route("manual-purge", timeout_s=15)
    screen.wait_for_route("profileHome", timeout_s=60)
