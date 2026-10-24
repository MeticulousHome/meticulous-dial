"""Free Pour, the guided pour-over, the pour-over history and the manual mode setup (the freepour group).

Ported from meticulous-integration tests/test_dial_modes.py (the free pour and manual journeys) and the unit
tests tests/freePourSetup.test.mts, tests/pourOverProfileContract.test.ts and tests/manualSetup.test.mts
(run in the Dial's own JavaScript engine through FreePourLibTests.qml / ManualSetupTests.qml; qt/tests/js runs
the React files themselves against the same libraries).

The emulated backend has no scale to put things on: the tests play the scale through the screen's
`testScale` ({ w, g }), and the firmware's tare by zeroing it when the Dial asks for one (the screen's
setup status turns "taring" when it sends 'action' 'tare'). Run against a backend whose state may change
(saved brews, a started manual shot): DIAL_API of the group's own backend.
"""

import json
import time
import uuid
from datetime import datetime, timedelta, timezone

import pytest

MANUAL_PROFILE_ID = "4d616e75-616c-4d6f-8465-000000000001"
POUR_OVER_ID = "f47ac10b-58cc-4372-a567-0e02b2c3d479"
SERVER_G, BREWER_G, COFFEE_G, WATER_G, BEVERAGE_G = 300.0, 100.0, 15.0, 250.0, 210.0
STORAGE_PENDING = "meticulous-brew-history/pending-backend-sessions"


# ---- helpers

@pytest.fixture(autouse=True)
def answered_shot_data_sharing(backend, client):
    """A fresh backend has never been told about shot data sharing, and the Dial asks first thing after its
    boot animation: answer "no thanks" so the tests start on the home."""
    status, settings = backend.get("/api/v1/settings/")
    if status == 200 and settings.get("shot_data_sharing", False) is None:
        backend.post("/api/v1/settings/", {"shot_data_sharing": False})
    if client.state()["screen"] in ("shotDataSharingPrompt", "ready"):
        client.call({"cmd": "screen", "name": "profileHome"})
    yield


def ev(screen, js):
    answer = screen.c.call({"cmd": "eval", "js": js})
    assert "error" not in answer, answer
    return answer["value"]


class Scale:
    """The machine's scale as the Free Pour screen reads it: what is on it, minus the last tare."""

    def __init__(self, screen):
        self.screen = screen
        self.mass = 0.0
        self.offset = 0.0
        self.flow = 0.0

    @property
    def reading(self):
        return self.mass - self.offset

    def send(self):
        ev(self.screen, "router.current.item.testScale = ({ w: %r, g: %r })" % (round(self.reading, 2), round(self.flow, 2)))

    def place(self, mass, flow=0.0):
        self.mass, self.flow = mass, flow
        self.send()

    def tare(self):
        self.offset = self.mass
        self.send()

    def pour(self, grams, rate_gps, step_s=0.25):
        """Pour by hand at about `rate_gps`, as from a kettle."""
        target = self.mass + grams
        while self.mass < target - 1e-6:
            self.place(min(target, self.mass + rate_gps * step_s), rate_gps)
            time.sleep(step_s)
        self.flow = 0.0
        self.send()


def wait_probe(screen, name, value, timeout_s=10):
    deadline = time.monotonic() + timeout_s
    while time.monotonic() < deadline:
        if screen.probe(name) == value:
            return
        time.sleep(0.05)
    screen.snapshot(f"probe-{name}")
    raise AssertionError(f"{name} is {screen.probe(name)!r}, not {value!r}")


def record_setup(screen, scale, step, added, expect_text=None):
    """One setup step: put `added` grams on, wait for the stable reading, push, and tare when asked."""
    screen.wait_for_text(step)
    scale.place(scale.mass + added)
    screen.wait_for_text(expect_text or f"{added:.0f}g")
    screen.wait_for_text("Weight stable" if "brewer" not in step.lower() or added else "0g brewer")
    screen.controls.push()
    wait_probe(screen, "freePourSetupStatus", "taring")
    scale.tare()


def setup_free_pour(screen, scale):
    screen.wait_for_text("Water temperature")
    screen.controls.push()
    for step, added in (("Weigh empty server", SERVER_G), ("Add brewer", BREWER_G), ("Add coffee", COFFEE_G)):
        record_setup(screen, scale, step, added)
    screen.wait_for_text("Start pouring")


def open_free_pour(screen):
    screen.wait_for_home()
    screen.go_to_card("Free Pour")
    screen.controls.hold(2.2)
    screen.wait_for_route("freePour")
    scale = Scale(screen)
    scale.send()
    return scale


def last_pour_over(backend):
    status, body = backend.get("/api/v1/history/pour-over/last")
    return body if status == 200 else None


def hooks(screen):
    """FreePourTestHooks.qml under the canvas (made once per Dial run)."""
    find = "(function(){ const kids = root.children; for (let i = 0; i < kids.length; i++) if (kids[i].objectName === 'freepour-hooks') return kids[i]; return null })()"
    found = ev(screen, "%s ? 'yes' : 'no'" % find)
    if found == "no":
        made = ev(screen, "(function(){ const c = Qt.createComponent(Qt.resolvedUrl('../screens/freepour/FreePourTestHooks.qml'));"
                          " if (c.status !== Component.Ready) return c.errorString();"
                          " c.createObject(root, { objectName: 'freepour-hooks' }); return 'made' })()")
        assert made == "made", made

    def call(js):
        return ev(screen, "%s.%s" % (find, js))
    return call


def run_qml_suite(screen, path):
    result = ev(screen, "(function(){ const c = Qt.createComponent(Qt.resolvedUrl('%s'));"
                        " if (c.status !== Component.Ready) return JSON.stringify({ passed: 0, failures: [c.errorString()] });"
                        " const o = c.createObject(null); const r = o.run(); o.destroy(); return r })()" % path)
    return json.loads(result)


def short_pour_over_profile():
    return {
        "version": 1, "brew_type": "pour_over", "id": POUR_OVER_ID, "name": "Two Pour V60", "author": "Meticulous",
        "author_id": "f47ac10b-58cc-4372-a567-0e02b2c3d480",
        "display": {"accentColor": "#315566", "shortDescription": "A simple two-pour recipe."},
        "recipe": {"coffee_dose_g": 15, "total_water_g": 250, "water_temperature_c": 93, "target_total_time_s": 60},
        "stages": [
            {"key": "bloom", "name": "Bloom", "starts_at_s": 0,
             "pour": {"water_g": 50, "duration_s": 10, "target_cumulative_water_g": 50, "flow_rate_g_s": 5,
                      "flow_range_g_s": [4, 6]}},
            {"key": "main", "name": "Main pour", "starts_at_s": 15,
             "pour": {"water_g": 200, "duration_s": 40, "target_cumulative_water_g": 250, "flow_rate_g_s": 5}},
        ],
    }


def stop_machine(backend, screen):
    """Ends the emulated shot a manual setup started: stop until the machine stays idle for 3 s."""
    deadline = time.monotonic() + 90
    idle_since = None
    backend.get("/api/v1/action/stop")
    while time.monotonic() < deadline:
        name = ev(screen, "Stats.name")
        if name == "idle":
            idle_since = idle_since or time.monotonic()
            if time.monotonic() - idle_since >= 3:
                return
        else:
            idle_since = None
            backend.get("/api/v1/action/stop")
        time.sleep(0.5)
    raise AssertionError(f"the emulated machine did not stop: {ev(screen, 'Stats.name')}")


def wait_for_route_shown(screen, names, after, timeout_s=15):
    """A route among `names` shown since history entry `after` (the emulated shot can move on from the
    heating screen faster than a poll of the current route sees it)."""
    deadline = time.monotonic() + timeout_s
    while time.monotonic() < deadline:
        shown = [name for _, name in screen.state()["history"][after:]]
        if any(name in names for name in shown):
            return shown
        time.sleep(0.1)
    raise AssertionError(f"the Dial showed none of {names}: {screen.state()['history'][after:]}")


def reseed_manual_profile(backend):
    """The manual profile as the backend seeds it: 90 °C, no weight stop, pressure first."""
    _, profile = backend.get(f"/api/v1/profile/get/{MANUAL_PROFILE_ID}")
    if profile and "stages" in profile:
        stages = sorted(profile["stages"], key=lambda s: s["type"] != "pressure")
        backend.post("/api/v1/profile/save", {**profile, "temperature": 90, "final_weight": 2000, "stages": stages})


# ---- the JavaScript libraries

def test_the_free_pour_libraries_pass_their_cases_in_the_dials_engine(screen):
    """Protects: the setup rules, the profile contract, the pour detector and the brew weight filter as the
    Qt Dial's JavaScript engine runs them (the cases of freePourSetup.test.mts and
    pourOverProfileContract.test.ts, plus detector and filter cases)."""
    result = run_qml_suite(screen, "../screens/freepour/FreePourLibTests.qml")
    assert result["failures"] == [], result
    assert result["passed"] > 60, result


def test_the_manual_setup_rules_pass_their_cases_in_the_dials_engine(screen):
    """Protects: the manual profile's editing rules (manualSetup.test.mts)."""
    result = run_qml_suite(screen, "../screens/manual/ManualSetupTests.qml")
    assert result["failures"] == [], result
    assert result["passed"] > 50, result


# ---- Free Pour

def test_a_free_pour_is_guided_by_the_scale_and_saved_to_the_pour_over_history(screen, backend):
    """Protects: a hand-poured brew guided by the machine's scale, from setup to history (the integration
    journey "pour-over-brew").

    Limit: eight steps, each weight recorded once the scale is stable and then tared; the pour detected from
    the weight; lifting the brewer leaves the server's beverage; retained = poured - brewed; the brew saved to
    /history/pour-over and nothing kept on the Dial (the backend is the only history).
    """
    before = last_pour_over(backend)
    scale = open_free_pour(screen)
    setup_free_pour(screen, scale)

    scale.pour(WATER_G, 10)
    screen.wait_for_text("Lift brewer to finish", timeout_s=30)
    assert screen.probe("freePourPours") >= 1
    screen.controls.push()

    # Lift the brewer: the server and the beverage stay on the scale.
    screen.wait_for_text("Keep server on scale")
    scale.place(SERVER_G + BEVERAGE_G)
    screen.wait_for_text("Free pour complete", timeout_s=30)
    summary = screen.text().casefold()
    for value, label in ((BEVERAGE_G, "brewed"), (WATER_G, "water poured"), (WATER_G - BEVERAGE_G, "retained")):
        assert f"{value:.0f}g\n{label}" in summary or f"{label}\n{value:.0f}g" in summary, summary

    screen.controls.push()
    screen.wait_for_route("freePourHistory")
    screen.wait_for_text(f"{COFFEE_G:.0f}g")
    screen.wait_for_text(f"{WATER_G:.0f}g water")
    assert screen.probe("historyState") == "chart"
    screen.controls.right(2)
    assert screen.probe("historySelectedMs") == 10000
    screen.controls.push()
    screen.wait_for_home()

    deadline = time.monotonic() + 10
    while time.monotonic() < deadline and (last_pour_over(backend) or {}).get("id") == (before or {}).get("id"):
        time.sleep(0.2)
    last = last_pour_over(backend)
    assert last and last != before
    assert (last["mode"], last["name"]) == ("free_pour", "Free Pour")
    status, record = backend.get("/api/v1/history/pour-over/files/" + last["file"])
    assert status == 200, record
    m = record["measurements"]
    assert (m["setupG"], m["doseG"], m["waterPouredG"], m["beverageG"], m["retainedG"]) == (115, 15, 250, 210, 40), m
    assert m["serverBaselineG"] == 300 and m["status"] == "measured", m
    assert record["completion"] == "dial_fallback" and record["samples"], record["completion"]
    assert json.loads(hooks(screen)("legacyKeys()")) == []


def test_the_temperature_step_turns_between_70_and_100(screen):
    """Protects: setting the water temperature with the knob (92 °C by default, 70-100 °C)."""
    open_free_pour(screen)
    screen.wait_for_text("Water temperature")
    screen.wait_for_text("92")
    screen.controls.right(3)
    screen.wait_for_text("95")
    screen.controls.right(8)
    screen.wait_for_text("100")
    screen.controls.left(31)
    screen.wait_for_text("70")
    assert screen.probe("freePourStage") == "temperature"


def test_a_tare_the_scale_does_not_confirm_can_be_retried(screen):
    """Protects: the setup waiting for the scale to read zero after its tare; 5 s without it says so and a
    push asks for the tare again."""
    scale = open_free_pour(screen)
    screen.wait_for_text("Water temperature")
    screen.controls.push()
    screen.wait_for_text("Weigh empty server")
    scale.place(SERVER_G)
    screen.wait_for_text("Weight stable")
    screen.controls.push()
    wait_probe(screen, "freePourSetupStatus", "taring")
    screen.wait_for_text("Waiting for zero")
    screen.wait_for_text("Tare not confirmed", timeout_s=8)
    screen.wait_for_text("Press dial to retry")
    screen.controls.push()
    wait_probe(screen, "freePourSetupStatus", "taring")
    scale.tare()
    screen.wait_for_text("Add brewer")
    screen.wait_for_text("0g brewer")


def test_reviewing_a_recorded_weight_restarts_the_setup_from_the_server(screen):
    """Protects: correcting a setup weight: turning the knob reviews the recorded weights, and re-entering
    one restarts from the empty server so every tare stays right."""
    scale = open_free_pour(screen)
    screen.wait_for_text("Water temperature")
    screen.controls.push()
    record_setup(screen, scale, "Weigh empty server", SERVER_G)
    record_setup(screen, scale, "Add brewer", BREWER_G)
    screen.wait_for_text("Add coffee")
    screen.controls.left()
    wait_probe(screen, "freePourStage", "setup-review")
    screen.wait_for_text("Brewer weight")
    screen.wait_for_text("100g")
    screen.controls.left()
    screen.wait_for_text("Server weight")
    screen.wait_for_text("300g")
    screen.controls.right(2)
    screen.wait_for_text("Continue setup")
    screen.wait_for_text("Return to coffee")
    screen.controls.left(2)
    screen.wait_for_text("Server weight")
    screen.controls.push()
    wait_probe(screen, "freePourStage", "server")
    screen.wait_for_text("Weigh empty server")


def test_lifting_the_server_too_asks_for_it_back_and_a_push_skips_the_measure(screen, backend):
    """Protects: the brew weight when the server came off with the brewer: "Server removed", put it back
    and it is measured, or a push saves the brew without a beverage weight."""
    scale = open_free_pour(screen)
    setup_free_pour(screen, scale)
    scale.pour(WATER_G, 12)
    screen.wait_for_text("Lift brewer to finish", timeout_s=30)
    scale.place(0)       # everything lifted
    screen.wait_for_text("Server removed", timeout_s=20)
    screen.wait_for_text("Put back server only")
    screen.controls.push()
    screen.wait_for_text("Free pour complete", timeout_s=10)
    assert screen.probe("freePourResult")["measurements"]["status"] == "skipped"
    assert "—" in screen.texts()


def test_a_double_press_aborts_the_free_pour(screen):
    """Protects: leaving Free Pour at any step with a double press."""
    scale = open_free_pour(screen)
    screen.wait_for_text("Water temperature")
    screen.controls.push()
    scale.place(SERVER_G)
    screen.wait_for_text("Weigh empty server")
    screen.controls.double_push()
    screen.wait_for_home()


def a_session(minutes_ago=2) -> dict:
    """A finished Free Pour brew as the Dial records it (schema 4)."""
    started = datetime.now(timezone.utc) - timedelta(minutes=minutes_ago)
    return {
        "schemaVersion": 4, "id": str(uuid.uuid4()), "brewType": "pour_over", "mode": "free_pour", "name": "Free Pour",
        "source": "dial", "startedAt": started.isoformat().replace("+00:00", "Z"),
        "completedAt": (started + timedelta(seconds=90)).isoformat().replace("+00:00", "Z"),
        "recipe": {"profileId": None, "profileName": "Free Pour", "doseG": 15, "temperatureC": 92, "targetWaterG": None,
                   "targetDurationMs": None, "pourTargets": []},
        "measurements": {"serverBaselineG": 300, "brewerG": 100, "setupG": 115, "doseG": 15, "waterTemperatureC": 92,
                         "waterPouredG": 250, "beverageG": 210, "retainedG": 40, "durationMs": 90000, "status": "measured"},
        "pours": [{"number": 1, "startTimeMs": 0, "endTimeMs": 25000, "startWeightG": 0, "endWeightG": 250, "waterG": 250,
                   "averageFlowGps": 10, "peakFlowGps": 10}],
        "samples": [{"t": 0, "w": 0, "f": 0, "p": 1}, {"t": 25000, "w": 250, "f": 0, "p": 0}],
        "completion": "brewer_removed", "sync": {"status": "pending", "attempts": 0},
    }


def wait_for_hook(call, name, timeout_s=30):
    deadline = time.monotonic() + timeout_s
    while time.monotonic() < deadline:
        value = call(name)
        if value:
            return value
        time.sleep(0.1)
    raise AssertionError(f"no answer in {name} after {timeout_s} s")


def backend_has(backend, session_id) -> bool:
    status, body = backend.get("/api/v1/history/pour-over?max_results=200")
    return status == 200 and session_id in [h["id"] for h in body["history"]]


def test_a_brew_is_saved_once_the_restarting_backend_answers(screen, backend):
    """Protects: a finished brew reaching the history when the machine's backend is restarting at that moment.
    Limit: the backend is the only Pour Over history (no local cache or queue, Alu's decision); saving retries
    a request that gets no answer or a 5xx after 2, 4 and 8 s, then gives up (FreePourStorage)."""
    call = hooks(screen)
    session = a_session()
    assert call("saveThroughRestart(%s, 2)" % json.dumps(json.dumps(session))) == "started"
    result = json.loads(wait_for_hook(call, "lastSave", 30))
    assert result["ok"], result
    assert call("failedRequests") == "2"
    assert backend_has(backend, session["id"])
    assert json.loads(call("legacyKeys()")) == []


def test_a_brew_the_backend_never_takes_is_not_kept_on_the_dial(screen, backend):
    """Protects: no second history on the Dial: after the retries the brew is reported lost, not queued."""
    call = hooks(screen)
    session = a_session()
    assert call("saveThroughRestart(%s, 9)" % json.dumps(json.dumps(session))) == "started"
    result = json.loads(wait_for_hook(call, "lastSave", 40))
    assert not result["ok"], result
    assert call("failedRequests") == "4"   # the first try and three retries
    assert not backend_has(backend, session["id"])
    assert json.loads(call("legacyKeys()")) == []


def test_the_old_local_cache_is_sent_to_the_backend_and_removed(screen, backend):
    """Protects: brews an older build left queued on the Dial reaching the history once, at start, and the old
    cache going away (main.qml runs FreePourStorage.syncAtStartup)."""
    call = hooks(screen)
    session = a_session(minutes_ago=5)
    assert call("plantLegacy(%s)" % json.dumps(json.dumps(session))) == "planted"
    assert len(json.loads(call("legacyKeys()"))) == 2
    assert call("startupSync()") == "started"
    result = json.loads(wait_for_hook(call, "lastSync", 30))
    assert result == {"sent": 1}, result
    assert backend_has(backend, session["id"])
    assert json.loads(call("legacyKeys()")) == []


def test_the_history_shows_the_backends_newest_brew(screen, backend):
    """Protects: the last pour-over on the history screen comes from the backend (GET /history/pour-over/last
    and its file), with nothing on the Dial."""
    call = hooks(screen)
    last = last_pour_over(backend)
    if not last:
        pytest.skip("the backend has no pour-over brew yet")
    assert call("latest()") == "started"
    assert json.loads(wait_for_hook(call, "lastLatest", 15))["id"] == last["id"]
    assert json.loads(call("legacyKeys()")) == []
    screen.c.call({"cmd": "screen", "name": "freePourHistory"})
    screen.wait_for_route("freePourHistory")
    deadline = time.monotonic() + 10
    while time.monotonic() < deadline and screen.probe("historyState") == "loading":
        time.sleep(0.1)
    assert screen.probe("historyState") == "chart"
    screen.wait_for_text("Turn dial · 5 sec")
    screen.controls.double_push()
    screen.wait_for_home()


# ---- the guided pour-over

def test_a_guided_pour_over_follows_the_installed_profile(screen, backend):
    """Protects: brewing an installed pour-over profile: its temperature and dose, the target rail with
    each pour's stop weight and start time, the drawdown, and a history record that names the profile."""
    status, body = backend.post("/api/v1/profile/save", short_pour_over_profile())
    assert status == 200, body
    try:
        screen.wait_for_home()
        screen.wait_for_cards({"Two Pour V60"})
        screen.go_to_card("Two Pour V60")
        screen.controls.hold(2.2)
        screen.wait_for_route("guidedPourOver")
        wait_probe(screen, "guidedProfileId", POUR_OVER_ID)
        scale = Scale(screen)
        scale.send()
        screen.wait_for_text("Water temperature")
        screen.wait_for_text("93")
        screen.controls.push()
        record_setup(screen, scale, "Weigh empty server", SERVER_G)
        record_setup(screen, scale, "Add brewer", BREWER_G)
        screen.wait_for_text("Add coffee")
        scale.place(scale.mass + COFFEE_G)
        screen.wait_for_text("Target 15g")
        screen.controls.push()
        wait_probe(screen, "freePourSetupStatus", "taring")
        scale.tare()
        screen.wait_for_text("Start pouring")
        screen.wait_for_text("Two Pour V60")

        scale.pour(30, 10)
        screen.wait_for_text("Pour 1 of 2")
        screen.wait_for_text("Stop")
        screen.wait_for_text("50g")
        scale.pour(20, 10)
        screen.wait_for_text("Next pour · start 0:15", timeout_s=10)
        scale.pour(200, 12)
        screen.wait_for_text("Drawdown · target 1:00", timeout_s=10)
        screen.controls.push()
        screen.wait_for_text("Keep server on scale")
        scale.place(SERVER_G + BEVERAGE_G)
        screen.wait_for_text("Free pour complete", timeout_s=30)

        deadline = time.monotonic() + 10
        while time.monotonic() < deadline and (last_pour_over(backend) or {}).get("mode") != "profile":
            time.sleep(0.2)
        last = last_pour_over(backend)
        assert (last["mode"], last["name"]) == ("profile", "Two Pour V60"), last
        _, record = backend.get("/api/v1/history/pour-over/files/" + last["file"])
        assert record["recipe"]["profileId"] == POUR_OVER_ID
        assert len(record["recipe"]["pourTargets"]) == 2 and len(record["pours"]) == 2, record["pours"]
        screen.controls.double_push()
        screen.wait_for_home()
    finally:
        backend.request("DELETE", f"/api/v1/pour-over/profile/delete/{POUR_OVER_ID}")


def test_the_contract_parser_installs_as_the_profiles_hook(screen, backend):
    """Protects: the installed pour-over profiles reaching the home in the Dial's shape (doseG,
    pourTargets...) through ProfileContract.parsePourOverProfile installed as Profiles.parsePourOverProfile,
    the line main.qml runs at start."""
    status, body = backend.post("/api/v1/profile/save", short_pour_over_profile())
    assert status == 200, body
    try:
        assert hooks(screen)("installContract()") == "installed"
        deadline = time.monotonic() + 10
        shape = None
        while time.monotonic() < deadline:
            shape = json.loads(ev(screen, "JSON.stringify(Profiles.pourOverProfiles.map(p => [p.id, p.doseG, p.targetDurationMs, (p.pourTargets || []).length]))"))
            if [POUR_OVER_ID, 15, 60000, 2] in shape:
                break
            time.sleep(0.2)
        assert [POUR_OVER_ID, 15, 60000, 2] in shape, shape
    finally:
        backend.request("DELETE", f"/api/v1/pour-over/profile/delete/{POUR_OVER_ID}")


def test_a_guided_pour_over_without_a_selection_goes_home(screen):
    """Protects: the guided route never runs without a selected profile (GuidedPourOverScreen)."""
    screen.wait_for_home()
    ev(screen, "Profiles.selectedPourOverProfileId = null")
    screen.c.call({"cmd": "screen", "name": "guidedPourOver"})
    screen.wait_for_route("profileHome", timeout_s=5)


# ---- manual mode

def open_manual_setup_directly(screen):
    screen.wait_for_home()
    screen.c.call({"cmd": "screen", "name": "manualSetup"})
    screen.wait_for_route("manualSetup")
    deadline = time.monotonic() + 10
    while time.monotonic() < deadline and screen.probe("manualStep") == "loading":
        time.sleep(0.1)


def test_manual_mode_is_reached_from_the_experimental_menu(screen, backend):
    """Protects: the way into manual mode (integration journey "manual-brew", first half): context menu,
    Experimental, Manual mode, then the three answers on a machine that never saved the manual profile
    start it on pressure with 90 °C and no weight stop.

    Breaks when the settings group's Experimental menu does not open the setup (xfail until it is ported).
    """
    reseed_manual_profile(backend)
    screen.wait_for_home()
    screen.controls.context()
    screen.select("Experimental")
    screen.wait_for_bubble("experimentalSettings")
    if screen.focused() is None:
        pytest.xfail("the Experimental menu (settings group) is not ported yet")
    screen.select("Manual mode")
    screen.wait_for_route("manualSetup")
    screen.wait_for_bubble_closed()
    screen.wait_for_text("Click to continue")
    screen.controls.push()  # temperature: keep it
    screen.wait_for_text("Click to continue")
    screen.controls.push()  # output: as saved
    screen.wait_for_focus("Start on pressure")
    before = len(screen.state()["history"])
    screen.controls.push()
    try:
        wait_for_route_shown(screen, ["heating", "manual-purge"], before)
        _, profile = backend.get(f"/api/v1/profile/get/{MANUAL_PROFILE_ID}")
        assert profile["manual"] is True and profile["stages"][0]["type"] == "pressure", profile
    finally:
        stop_machine(backend, screen)


def test_the_manual_setup_saves_the_three_answers_and_starts_the_shot(screen, backend):
    """Protects: the manual setup's gauges and its start: temperature in half degrees, the final weight
    turned off by a long press and back on where it was, the start control, and the manual profile saved
    with exactly those answers before the shot starts."""
    reseed_manual_profile(backend)
    open_manual_setup_directly(screen)
    _, saved = backend.get(f"/api/v1/profile/get/{MANUAL_PROFILE_ID}")
    temperature = screen.probe("manualTemperature")
    assert temperature == saved["temperature"]
    screen.wait_for_text("Click to continue")
    screen.controls.right(3)
    assert screen.probe("manualTemperature") == min(99, temperature + 1.5)
    screen.controls.push()
    wait_probe(screen, "manualStep", "output")

    screen.controls.long_push()
    wait_probe(screen, "manualWeight", 2000)
    screen.wait_for_text("Off")
    screen.wait_for_text("Rotate knob to set weight")
    screen.controls.right()
    wait_probe(screen, "manualWeight", 36)       # back where it was, or 36 g
    screen.wait_for_text("Long press disables the final weight")
    screen.controls.right(4)
    wait_probe(screen, "manualWeight", 38)
    screen.controls.long_push()
    screen.wait_for_text("Off")
    screen.controls.left()
    wait_probe(screen, "manualWeight", 38)
    screen.controls.push()
    wait_probe(screen, "manualStep", "start")
    screen.focus("Start on flow")
    before = len(screen.state()["history"])
    screen.controls.push()
    try:
        wait_for_route_shown(screen, ["heating", "manual-purge"], before)
        _, profile = backend.get(f"/api/v1/profile/get/{MANUAL_PROFILE_ID}")
        assert profile["temperature"] == min(99, temperature + 1.5), profile
        assert profile["final_weight"] == 38, profile
        assert [s["type"] for s in profile["stages"]] == ["flow", "pressure"], profile["stages"]
        assert profile["manual"] is True
    finally:
        stop_machine(backend, screen)
        reseed_manual_profile(backend)


def test_aborting_the_manual_setup_reopens_the_experimental_menu(screen):
    """Protects: leaving the manual setup by its Abort option or a double press: back to the screen
    before it with the Experimental menu open."""
    open_manual_setup_directly(screen)
    screen.controls.push()
    screen.controls.push()
    wait_probe(screen, "manualStep", "start")
    screen.focus("Abort")
    screen.controls.push()
    screen.wait_for_bubble("experimentalSettings")
    assert screen.route() == "profileHome"
    screen.controls.context()
    screen.wait_for_bubble_closed()

    open_manual_setup_directly(screen)
    screen.controls.double_push()
    screen.wait_for_bubble("experimentalSettings")
    assert screen.route() == "profileHome"
