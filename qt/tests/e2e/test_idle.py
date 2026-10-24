"""The idle group: the sleep screen (src/components/IdleScreen, hooks/useDimScreen, utils/localTime), the
scale overlay (src/components/Scale/Scale.tsx and its Playwright suite tests/scale-overlay/scale.spec.ts),
calibrate scale and Snake.

The tests write the idle_screen and clock_format_24_hour settings on the backend the Dial runs against: run
them against a backend of your own (DIAL_API) when the shared one must not change.

The scale tests use Snake as the screen under the overlay (presses do nothing there, so a leaked press is
harmless) and, as the React fixture's UnderlyingGestureObserver, a GestureHandler placed in the router
under the same boundary as the screens: it records every gesture the router lets through. Gestures go in
as the React fixture sends them (straight to the gesture bus, several at once when the React test sends
them in one evaluate()). tests/digitalClockTime.test.mts runs against screens/idle/clockTime.js with
qt/scripts/js-tests.sh; the applicable cases of tests/analogClockTime.test.mts run here in the Dial's own
JavaScript engine.
"""

import json
import time

import pytest

SCALE_ITEM = ("(function(){ for (let i = 0; i < root.children.length; i++) { const c = root.children[i];"
              " if (c.item && typeof c.item.scaleProbe === 'function') return c.item } return null })()")

OBSERVER_QML = """
import QtQuick
import Dial
GestureHandler {
    objectName: "idleTestObserver"
    property var seen: []
    property var brightness: []
    function add(g) { seen = seen.concat([g]) }
    onPressDown: add("pressDown")
    onPressUp: add("pressUp")
    onClick: add("click")
    onDoubleClick: add("doubleClick")
    onLongEncoder: add("longEncoder")
    onTurnRight: add("right")
}
"""
OBSERVER = ("(function(){ for (let i = 0; i < router.children.length; i++) { const c = router.children[i];"
            " if (c.objectName === 'idleTestObserver') return c } return null })()")


# ---------------------------------------------------------------------------------------------- helpers

def ev(client, js):
    answer = client.call({"cmd": "eval", "js": js})
    if "error" in answer:
        raise AssertionError(f"eval failed: {answer['error']}\n{js}")
    return answer["value"]


def ev_json(client, js):
    return json.loads(ev(client, f"JSON.stringify({js})"))


def wait(predicate, what, timeout_s=5, interval=0.05):
    deadline = time.monotonic() + timeout_s
    last = None
    while time.monotonic() < deadline:
        last = predicate()
        if last:
            return last
        time.sleep(interval)
    raise AssertionError(f"timed out waiting for {what}; last {last!r}")


def emit(client, *gestures):
    """Gestures straight to the bus in one go, as the React fixture's handleEvents.emit loop."""
    ev(client, "; ".join(f"Input.emitGesture('{g}', 1000)" for g in gestures))


def scale(client):
    return ev_json(client, f"{SCALE_ITEM}.scaleProbe()")


def visibility(client, value, timeout_s=5):
    wait(lambda: scale(client)["visibility"] == value, f"scale visibility {value}", timeout_s)


def actions(client):
    return scale(client)["actions"]


def underlying(client):
    return ev_json(client, f"{OBSERVER}.seen")


def clear(client):
    ev(client, f"{SCALE_ITEM}.emittedActions = []; {OBSERVER}.seen = []")


def reset_scale(client):
    ev(client, f"(function(){{ const s = {SCALE_ITEM}; if (s.status === 'open') s.closeScale();"
               " s.setScaleState('closed_cold', ''); s.emittedActions = [] })()")
    wait(lambda: (lambda p: p["visibility"] == "closed" and not p["shown"] and p["settled"])(scale(client)),
         "the scale closed")


def open_full_scale(client):
    emit(client, "tareDown")
    visibility(client, "full")
    emit(client, "tareUp")
    # Like the CSS check (identity transform, the weight in the viewport): the card at rest, full size.
    wait(lambda: (lambda p: p["settled"] and p["scale"] == 1 and p["tyFrac"] == 0 and p["geomE"] == 1)(scale(client)),
         "the full scale at rest")


def set_setting(backend, **values):
    status, body = backend.post("/api/v1/settings/", values)
    assert status == 200, body
    # BackendSettings polls every 2 s
    time.sleep(2.5)


def go(screen, name):
    screen.c.call({"cmd": "screen", "name": name})
    screen.wait_for_route(name)


def force_idle(screen):
    """The quick settings' sleep from the home: Idle.forceIdle() and the home goes to the idle screen."""
    ev(screen.c, "Idle.forceIdle()")
    screen.wait_for_route("idle", 10)


def watch_idle_screen(client):
    """Copies the idle screen's brightness requests into the observer, even through its destruction."""
    ev(client, f"(function(){{ const s = router.current.item; const o = {OBSERVER}; o.brightness = s.brightnessLog;"
               " s.brightnessLogChanged.connect(function () { o.brightness = s.brightnessLog }) })()")


def brightness(client):
    return ev_json(client, f"{OBSERVER}.brightness")


@pytest.fixture
def observer(client):
    ev(client, f"(function(){{ const o = {OBSERVER}; if (o) o.destroy() }})()")
    ev(client, f"Qt.createQmlObject({json.dumps(OBSERVER_QML)}, router, 'idleTestObserver') !== null")
    wait(lambda: ev(client, f"{OBSERVER} !== null") == "true", "the observer")
    yield
    ev(client, f"(function(){{ const o = {OBSERVER}; if (o) o.destroy() }})()")


@pytest.fixture(autouse=True)
def calm(client):
    """Each test starts and ends with the scale closed and cold, and the Dial awake."""
    reset_scale(client)
    ev(client, "Idle.setForceBubbleReopen(false); Idle.resetTimer()")
    yield
    reset_scale(client)
    ev(client, "Idle.setForceBubbleReopen(false); Idle.resetTimer()")


# ------------------------------------------------------------------------------------ the sleep screen

def test_sleep_shows_the_analog_clock_and_a_turn_wakes_to_the_home(screen, backend, observer):
    """Protects: the quick settings' sleep and the idle timer showing the clock at a third of the
    brightness, and a turn waking the Dial back on the home at full brightness (IdleScreen.tsx)."""
    set_setting(backend, idle_screen="default")
    screen.wait_for_home()
    force_idle(screen)
    watch_idle_screen(screen.c)
    assert screen.probe("idleVariant") == "analog"
    wait(lambda: brightness(screen.c) == [0.33], "brightness 0.33")
    # The hands follow the OS local time (the second hand sweeps).
    first = screen.probe("secondRotation")
    time.sleep(0.5)
    second = screen.probe("secondRotation")
    assert 2 <= (second - first) % 360 <= 4.5, (first, second)
    t = ev_json(screen.c, "Native.localTime()")
    expected = (t["second"] + t["millisecond"] / 1000) * 6
    assert min(abs(second - expected), 360 - abs(second - expected)) < 3, (second, expected)

    screen.controls.right()
    screen.wait_for_route("profileHome")
    wait(lambda: brightness(screen.c)[-1:] == [1] and 1 in brightness(screen.c), "brightness 1 on waking")
    assert not ev_json(screen.c, "Idle.isIdle")


@pytest.mark.parametrize("button", ["ENCODER_PRESSED", "ENCODER_COUNTERCLOCKWISE", "TARE"])
def test_every_waking_gesture_returns_to_the_screen_the_dial_slept_on(screen, button):
    """Protects: the gestures that reset the idle timer (turns, press, context, single tare) leaving the
    idle screen for the screen before it (state.screen.prev)."""
    go(screen, "snake")
    ev(screen.c, "Idle.forceIdle(); Nav.setScreen('idle')")
    screen.wait_for_route("idle")
    screen.c.call({"cmd": "button", "type": button})
    screen.wait_for_route("snake")
    if button == "TARE":
        # The single tare also opened the scale overlay, as in React.
        visibility(screen.c, "small")


def test_waking_returns_home_from_a_screen_that_does_not_count_as_previous(screen):
    """Protects: routes with ignoreAsPrevious (ready, notifications, idle, ...) never being the screen the
    Dial wakes up on: the home instead."""
    go(screen, "unlock")
    ev(screen.c, "Idle.forceIdle(); Nav.setScreen('idle')")
    screen.wait_for_route("idle")
    screen.controls.right()
    screen.wait_for_route("profileHome")


def test_the_context_button_wakes_the_dial_without_leaving_the_quick_settings_open(screen):
    """Protects: React's order on waking: the context button opens the quick settings and the idle screen,
    leaving after that gesture, closes the unpinned bubble; the Dial shows the home."""
    screen.wait_for_home()
    force_idle(screen)
    screen.controls.context()
    screen.wait_for_route("profileHome")
    screen.wait_for_bubble_closed()


def test_a_sleep_forced_from_the_idle_screen_setting_reopens_its_menu(screen):
    """Protects: choosing a sleep screen in the settings: the Dial sleeps at once to show it, and waking
    brings the bubble back on that menu (IdleScreenSetting.tsx setForceBubbleReopen, IdleScreen cleanup)."""
    screen.wait_for_home()
    ev(screen.c, "Nav.setBubbleDisplay({ visible: true, component: 'idleScreenSettings' })")
    screen.wait_for_bubble("idleScreenSettings")
    ev(screen.c, "Idle.forceIdle(); Idle.setForceBubbleReopen(true)")
    screen.wait_for_route("idle")
    screen.wait_for_bubble_closed()
    screen.controls.right()
    screen.wait_for_route("profileHome")
    screen.wait_for_bubble("idleScreenSettings")
    assert not ev_json(screen.c, "Idle.forceBubbleReopen")


@pytest.mark.parametrize("setting,variant", [
    ("default", "analog"), ("analog", "analog"), ("digital", "digital"), ("metCat", "metcat"),
    ("dvd", "dvd"), ("baristaBarista", "barista"), ("unknown-screen", "analog"),
])
def test_the_idle_screen_setting_picks_the_clock(screen, backend, setting, variant):
    """Protects: globalSettings.idle_screen choosing the sleep screen (selectIdleComponent), the analog
    clock for anything else."""
    set_setting(backend, idle_screen=setting)
    screen.wait_for_home()
    force_idle(screen)
    assert screen.probe("idleVariant") == variant


def test_the_digital_clock_shows_the_os_time_in_the_chosen_format(screen, backend, observer):
    """Protects: the digital sleep clock reading the OS local time in 24-hour (the backend's default) and
    12-hour format, with the Wi-Fi status, and its brightness requests (0 on mount, then the idle
    screen's 0.33) (DigitalClock.tsx, digitalClockTime.ts)."""
    set_setting(backend, idle_screen="digital", clock_format_24_hour=True)
    screen.wait_for_home()
    force_idle(screen)
    watch_idle_screen(screen.c)
    shown = wait(lambda: screen.probe("digitalTime"), "the digital time")
    t = ev_json(screen.c, "Native.localTime()")
    assert shown in (f"{t['hour']:02d} {t['minute']:02d}", f"{t['hour']:02d} {(t['minute'] - 1) % 60:02d}"), (shown, t)
    texts = screen.texts()
    assert ("Ready" in texts) != ("Not connected" in texts), texts
    wait(lambda: brightness(screen.c) == [0, 0.33], "brightness 0 then 0.33")

    ev(screen.c, "Idle.resetTimer()")
    screen.wait_for_route("profileHome")
    set_setting(backend, clock_format_24_hour=False)
    force_idle(screen)
    shown = wait(lambda: screen.probe("digitalTime"), "the digital time")
    t = ev_json(screen.c, "Native.localTime()")
    hour12 = (t["hour"] + 11) % 12 + 1
    assert shown.startswith(f"{hour12:02d} ") and shown.endswith("AM" if t["hour"] < 12 else "PM"), (shown, t)
    set_setting(backend, clock_format_24_hour=True, idle_screen="default")


def test_the_metcat_clock_shows_hours_and_minutes_over_the_cat(screen, backend):
    """Protects: the MetCat sleep clock: "HH:MM" from the OS time over the animation."""
    set_setting(backend, idle_screen="metCat")
    screen.wait_for_home()
    force_idle(screen)
    shown = wait(lambda: screen.probe("digitalTime"), "the cat clock time")
    t = ev_json(screen.c, "Native.localTime()")
    assert shown[:2] == f"{t['hour']:02d}" and shown[2] == ":", (shown, t)
    assert ev(screen.c, "router.current.item.clock.children.length > 0") == "true"
    set_setting(backend, idle_screen="default")


def test_the_dvd_logos_bounce_inside_the_circle(screen, backend):
    """Protects: the DVD sleep screen: both logos move, stay inside the round screen and change color on
    every bounce (DVD.tsx)."""
    set_setting(backend, idle_screen="dvd")
    screen.wait_for_home()
    force_idle(screen)
    start = ev_json(screen.c, "router.current.item.clock.positions()")
    colors = screen.probe("dvdColors")
    assert colors == ["#ff0000", "#ff0000"], colors
    for _ in range(40):
        time.sleep(0.5)
        now = ev_json(screen.c, "router.current.item.clock.positions()")
        assert all(p["farthestCorner"] <= 240.5 for p in now), now
        if screen.probe("dvdBounces") >= 2:
            break
    assert screen.probe("dvdBounces") >= 2
    assert now != start
    assert screen.probe("dvdColors") != ["#ff0000", "#ff0000"]
    set_setting(backend, idle_screen="default")


def test_after_ten_minutes_the_idle_screen_dims_in_a_cycle(screen, backend, observer):
    """Protects: the burn-in dimming: after SCREEN_TIMEOUT the 70 % veil and 55 s at the current
    brightness, then 5 s at 0.33 without the veil, then 0.03 with it, and so on (cycleScreenDim). The
    durations are shortened here."""
    set_setting(backend, idle_screen="default")
    screen.wait_for_home()
    force_idle(screen)
    watch_idle_screen(screen.c)
    ev(screen.c, "(function(){ const s = router.current.item; s.darkMs = 600; s.brightMs = 400;"
                 " s.schedule(50, function () { s.cycleScreenDim() }) })()")
    wait(lambda: screen.probe("screenDim") is True, "the veil")
    assert brightness(screen.c) == [0.33]
    wait(lambda: screen.probe("screenDim") is False, "the veil lifted")
    assert brightness(screen.c) == [0.33, 0.33]
    wait(lambda: screen.probe("screenDim") is True, "the veil again")
    assert brightness(screen.c) == [0.33, 0.33, 0.03]
    wait(lambda: len(brightness(screen.c)) >= 4, "the next cycle", 3)
    assert brightness(screen.c)[3] == 0.33


def test_native_local_time_is_the_os_local_time(screen):
    """Replaces the React tests of the browser / Tauri selection (analogClockTime.test.mts): the clocks
    read Native.localTime() (the get_os_local_time of the Tauri Dial), which follows the OS time zone."""
    t = ev_json(screen.c, "Native.localTime()")
    now = time.localtime()
    got = t["hour"] * 3600 + t["minute"] * 60 + t["second"]
    expected = now.tm_hour * 3600 + now.tm_min * 60 + now.tm_sec
    assert min(abs(got - expected), 86400 - abs(got - expected)) <= 2, (t, now)
    assert (t["year"], t["month"], t["day"]) == (now.tm_year, now.tm_mon, now.tm_mday) or abs(got - expected) > 80000


# ---------------------------------------------------------- analogClockTime.test.mts in the Dial's engine

HARNESS = r"""
(function () {
  const lib = %(lib)s.lib;
  function eq(a, b, msg) {
    const sa = JSON.stringify(a), sb = JSON.stringify(b);
    if (sa !== sb) throw new Error((msg || "") + " expected " + sb + " got " + sa);
  }
  function ok(v, msg) { if (!v) throw new Error(msg || "not ok"); }
  const sample = (hour, minute, second, millisecond) =>
    ({ year: 2026, month: 8, day: 17, hour: hour, minute: minute || 0, second: second || 0, millisecond: millisecond || 0 });
  function clock(readTime) {
    let now = 0, nextId = 0;
    const frames = new Map(), timers = new Map(), rendered = [], errors = [];
    const stop = lib.startAnalogClock({
      readTime: () => readTime(t => { now = t }),
      renderTime: t => rendered.push(t),
      onError: e => errors.push(e),
      now: () => now,
      requestFrame: cb => { frames.set(++nextId, () => cb(now)); return nextId },
      cancelFrame: id => { frames.delete(id) },
      setTimer: (cb, delay) => { eq(delay, 1000); timers.set(++nextId, cb); return nextId },
      clearTimer: id => { timers.delete(id) }
    });
    const run = callbacks => {
      eq(callbacks.size, 1, "one pending callback");
      const first = callbacks.entries().next().value;
      callbacks.delete(first[0]);
      first[1]();
    };
    return { stop: stop, frames: frames, timers: timers, rendered: rendered, errors: errors,
             setNow: t => { now = t }, frame: () => run(frames), sync: () => run(timers) };
  }
  const last = a => a[a.length - 1];
  const cases = {
    "follows automatic UTC to Zurich and manual London to Mexico City changes": function () {
      let native = sample(12, 34, 56, 500);
      const c = clock(() => native);
      c.frame();
      eq(last(c.rendered), lib.millisecondsSinceMidnight(native));
      for (const hour of [14, 13, 6]) {
        native = sample(hour, 34, 56, 500);
        c.sync();
        c.frame();
        eq(last(c.rendered), lib.millisecondsSinceMidnight(native));
      }
      c.stop();
    },
    "resynchronizes across both London and Zurich DST jumps": function () {
      for (const pair of [[0, 2], [1, 3], [1, 1], [2, 2]]) {
        let native = sample(pair[0], 59, 59, 900);
        const c = clock(() => native);
        c.setNow(200);
        c.frame();
        eq(last(c.rendered), lib.millisecondsSinceMidnight(native) + 200);
        native = sample(pair[1], 0, 0, 100);
        c.sync();
        c.frame();
        eq(last(c.rendered), lib.millisecondsSinceMidnight(native));
        c.stop();
      }
    },
    "wraps midnight and negative local-day arithmetic": function () {
      eq(lib.advanceLocalTime(lib.millisecondsSinceMidnight(sample(23, 59, 59, 900)), 200), 100);
      eq(lib.advanceLocalTime(-3600000, 0), 23 * 3600000);
      eq(lib.advanceLocalTime(0, 3 * 86400000 + 500), 500);
    },
    "animates smoothly between reads with one read per second": function () {
      let reads = 0;
      const c = clock(() => { reads++; return sample(12) });
      for (let frame = 1; frame <= 60; frame++) {
        c.setNow((frame * 1000) / 60);
        c.frame();
      }
      eq(reads, 1);
      eq(c.rendered.length, 60);
      eq(last(c.rendered), 12 * 3600000 + 1000);
      ok(c.rendered[0] > 12 * 3600000);
      c.stop();
    },
    "initial failure retries, avoids a false time, and recovers": function () {
      let fail = true;
      const c = clock(() => { if (fail) throw new Error("IPC unavailable"); return sample(6, 15) });
      c.frame();
      eq(c.rendered, []);
      eq(c.errors.length, 1);
      c.sync();
      eq(c.errors.length, 1, "reported once");
      fail = false;
      c.sync();
      c.frame();
      eq(last(c.rendered), lib.millisecondsSinceMidnight(sample(6, 15)));
      fail = true;
      c.setNow(1500);
      c.sync();
      c.frame();
      eq(c.errors.length, 2);
      eq(last(c.rendered), lib.millisecondsSinceMidnight(sample(6, 15)) + 1500);
      c.stop();
    },
    "synchronous retrieval failures follow the same recovery path": function () {
      let fail = true;
      const c = clock(() => { if (fail) throw new Error("Unavailable"); return sample(8) });
      eq(c.errors.length, 1);
      fail = false;
      c.sync();
      c.frame();
      eq(last(c.rendered), 8 * 3600000);
      c.stop();
    },
    "compensates for read latency without mutating the sample": function () {
      // The read takes 200 ms: the sample is the time at its middle.
      const native = Object.freeze(sample(8));
      const c = clock(setNow => { setNow(200); return native });
      c.frame();
      eq(last(c.rendered), 8 * 3600000 + 100);
      eq(native.millisecond, 0);
      c.stop();
    },
    "cleanup cancels frames and retries": function () {
      const c = clock(() => sample(9));
      eq(c.timers.size, 1);
      c.stop();
      eq(c.timers.size, 0);
      eq(c.frames.size, 0);
    },
    "the pixel shift turns half a degree each way in an hour": function () {
      eq(lib.pixelShift(0), 0);
      ok(Math.abs(lib.pixelShift(900000) + 0.5) < 1e-9);
      ok(Math.abs(lib.pixelShift(1800000)) < 1e-9);
      ok(Math.abs(lib.pixelShift(2700000) - 0.5) < 1e-9);
      ok(Math.abs(lib.pixelShift(3600000)) < 1e-9);
      // ease(0.5) = 0.8024
      ok(Math.abs(lib.pixelShift(450000) + 0.5 * 0.8024) < 0.001, String(lib.pixelShift(450000)));
    }
  };
  const results = {};
  for (const name in cases) {
    try { cases[name](); results[name] = "ok" } catch (e) { results[name] = String(e) }
  }
  return JSON.stringify(results);
})()
"""

PROMISE_START = r"""
(function () {
  const h = %(lib)s;
  const lib = h.lib;
  const st = { rendered: [], errors: [], timers: 0, reads: 0, now: 0, resolve: null };
  h.state = st;
  st.stop = lib.startAnalogClock({
    readTime: () => { st.reads++; return new Promise(r => { st.resolve = r }) },
    renderTime: t => st.rendered.push(t), onError: e => st.errors.push(String(e)),
    now: () => st.now, requestFrame: cb => { st.frame = cb; return 1 }, cancelFrame: id => { st.frame = null },
    setTimer: (cb, d) => { st.timers++; st.sync = cb; return 2 }, clearTimer: id => { st.timers-- }
  });
  st.now = 200;
  st.frame();
  const before = { rendered: st.rendered.length, timers: st.timers };
  st.resolve(Object.freeze({ year: 2026, month: 8, day: 17, hour: 8, minute: 0, second: 0, millisecond: 0 }));
  return JSON.stringify(before);
})()
"""
PROMISE_CHECK = r"""
(function () {
  const st = %(lib)s.state;
  st.frame();
  const out = { reads: st.reads, last: st.rendered[st.rendered.length - 1], timers: st.timers };
  st.stop();
  out.timersAfterStop = st.timers;
  return JSON.stringify(out);
})()
"""


@pytest.fixture
def clock_lib(client):
    ev(client, "(function(){ for (let i = 0; i < root.children.length; i++) if (root.children[i].objectName === 'idleClockHarness') root.children[i].destroy() })()")
    created = ev(client, "Qt.createQmlObject('import QtQuick; import \"clockTime.js\" as ClockTime; Item { objectName: \"idleClockHarness\";"
                         " property var lib: ClockTime; property var state: ({}) }', root, Qt.resolvedUrl('../screens/idle/ClockTimeHarness.qml')) !== null")
    assert created == "true"
    yield "(function(){ for (let i = 0; i < root.children.length; i++) if (root.children[i].objectName === 'idleClockHarness') return root.children[i] })()"
    ev(client, "(function(){ for (let i = 0; i < root.children.length; i++) if (root.children[i].objectName === 'idleClockHarness') root.children[i].destroy() })()")


def test_analog_clock_time_cases(client, clock_lib):
    """The cases of tests/analogClockTime.test.mts that apply to the Qt Dial (its time source is the
    synchronous Native.localTime(); the browser / Tauri selection cases are replaced by
    test_native_local_time_is_the_os_local_time), on screens/idle/clockTime.js in the Dial's engine."""
    results = json.loads(ev(client, HARNESS % {"lib": clock_lib}))
    failed = {k: v for k, v in results.items() if v != "ok"}
    assert not failed, failed
    assert len(results) == 9


def test_analog_clock_serializes_slow_reads(client, clock_lib):
    """analogClockTime.test.mts 'serializes slow reads and compensates for IPC latency': with a read that
    answers later (a promise), nothing renders and no next read is planned until it answers; the sample's
    instant is the middle of the read."""
    before = json.loads(ev(client, PROMISE_START % {"lib": clock_lib}))
    assert before == {"rendered": 0, "timers": 0}
    time.sleep(0.2)
    after = json.loads(ev(client, PROMISE_CHECK % {"lib": clock_lib}))
    assert after == {"reads": 1, "last": 8 * 3600000 + 100, "timers": 1, "timersAfterStop": 0}, after


# -------------------------------------------------------------------- the scale overlay (scale.spec.ts)

@pytest.fixture
def under_snake(screen, observer):
    """Snake under the overlay, with the observer listening under the router's boundary."""
    go(screen, "snake")
    clear(screen.c)
    yield screen
    if screen.route() != "profileHome":
        go(screen, "profileHome")


def test_fullscreen_dismissal_consumes_the_whole_press_then_next_press_reaches_the_screen(under_snake):
    c = under_snake.c
    open_full_scale(c)
    under_snake.snapshot("fullscreen")
    clear(c)
    emit(c, "pressDown")
    time.sleep(0.1)
    emit(c, "pressUp")
    # Match the separate firmware click notification, after the UI has rendered.
    time.sleep(0.28)
    emit(c, "click")
    visibility(c, "closed")
    wait(lambda: not scale(c)["shown"], "the card gone")
    assert actions(c) == []
    assert underlying(c) == []
    emit(c, "pressDown", "pressUp", "click")
    assert underlying(c) == ["pressDown", "pressUp", "click"]


def test_batched_release_and_click_cannot_leak_after_dismissal(under_snake):
    c = under_snake.c
    open_full_scale(c)
    clear(c)
    emit(c, "pressDown")
    visibility(c, "full")
    emit(c, "pressUp", "click")
    visibility(c, "closed")
    assert actions(c) == []
    assert underlying(c) == []
    emit(c, "pressDown", "pressUp", "click")
    assert underlying(c) == ["pressDown", "pressUp", "click"]


@pytest.mark.parametrize("name,tail", [
    ("double press", ["pressUp", "pressDown", "pressUp", "doubleClick"]),
    ("long press", ["longEncoder", "pressUp"]),
    ("release before long notification", ["pressUp", "longEncoder"]),
])
def test_press_stays_consumed_through_its_terminal_event_and_release(under_snake, name, tail):
    c = under_snake.c
    open_full_scale(c)
    clear(c)
    emit(c, "pressDown")
    visibility(c, "full")
    for gesture in tail[:-1]:
        emit(c, gesture)
        visibility(c, "full")
    emit(c, tail[-1])
    visibility(c, "closed")
    assert underlying(c) == []
    assert actions(c) == []
    emit(c, "pressDown", "pressUp", "click")
    assert underlying(c) == ["pressDown", "pressUp", "click"]


def test_raw_press_and_release_without_a_terminal_keep_fullscreen_for_the_next_valid_gesture(under_snake):
    c = under_snake.c
    open_full_scale(c)
    clear(c)
    emit(c, "pressDown", "pressUp")
    visibility(c, "full")
    assert underlying(c) == []
    emit(c, "pressDown", "pressUp", "click")
    visibility(c, "closed")
    assert underlying(c) == []
    assert actions(c) == []
    emit(c, "pressDown", "pressUp", "click")
    assert underlying(c) == ["pressDown", "pressUp", "click"]


def test_a_fresh_press_discards_a_long_gesture_whose_release_was_lost(under_snake):
    c = under_snake.c
    open_full_scale(c)
    clear(c)
    emit(c, "pressDown", "longEncoder")
    visibility(c, "full")
    emit(c, "pressDown", "pressUp")
    visibility(c, "full")
    assert underlying(c) == []
    emit(c, "click")
    visibility(c, "closed")
    assert underlying(c) == []
    assert actions(c) == []
    emit(c, "pressDown", "pressUp", "click")
    assert underlying(c) == ["pressDown", "pressUp", "click"]


def test_a_recognized_click_can_close_even_if_its_raw_release_was_omitted(under_snake):
    c = under_snake.c
    open_full_scale(c)
    clear(c)
    emit(c, "pressDown", "click")
    visibility(c, "closed")
    assert underlying(c) == []
    assert actions(c) == []
    emit(c, "pressDown", "pressUp", "click")
    assert underlying(c) == ["pressDown", "pressUp", "click"]


def test_a_missing_long_notification_does_not_make_the_following_long_press_leak(under_snake):
    c = under_snake.c
    open_full_scale(c)
    clear(c)
    emit(c, "pressDown", "pressUp")
    visibility(c, "full")
    emit(c, "pressDown", "longEncoder")
    visibility(c, "full")
    emit(c, "pressUp")
    visibility(c, "closed")
    assert underlying(c) == []
    assert actions(c) == []
    emit(c, "pressDown", "pressUp", "click")
    assert underlying(c) == ["pressDown", "pressUp", "click"]


def test_closing_by_tare_clears_a_pending_long_gesture_before_reopening(under_snake):
    c = under_snake.c
    open_full_scale(c)
    emit(c, "pressDown", "longEncoder")
    visibility(c, "full")
    emit(c, "doubleTare")
    visibility(c, "closed")
    open_full_scale(c)
    clear(c)
    emit(c, "pressUp")
    visibility(c, "full")
    emit(c, "pressDown", "pressUp", "click")
    visibility(c, "closed")
    assert underlying(c) == []
    assert actions(c) == []


def test_the_small_scale_stays_nonmodal_and_tare_behavior_is_preserved(under_snake):
    c = under_snake.c
    emit(c, "singleTare")
    visibility(c, "small")
    assert actions(c) == [["action", "tare"]]
    emit(c, "singleTare")
    assert actions(c) == [["action", "tare"], ["action", "tare"]]
    clear(c)
    emit(c, "pressDown")
    visibility(c, "closed")
    emit(c, "pressUp", "click")
    assert underlying(c) == ["pressDown", "pressUp", "click"]
    clear(c)
    emit(c, "singleTare")
    visibility(c, "small")
    assert actions(c) == []  # Reopening a warm scale does not tare.


def test_a_tare_hold_can_be_cancelled_and_a_double_tare_still_closes_fullscreen(under_snake):
    c = under_snake.c
    emit(c, "tareDown")
    visibility(c, "small")
    emit(c, "tareUp")
    time.sleep(0.8)  # Wait beyond the pull animation's completion.
    visibility(c, "small")
    assert scale(c)["pullY"] == 0
    open_full_scale(c)
    emit(c, "singleTare")
    assert actions(c) == [["action", "tare"]]
    emit(c, "right")
    assert underlying(c) == []
    emit(c, "doubleTare")
    visibility(c, "closed")
    clear(c)
    emit(c, "pressDown", "pressUp", "click")
    assert underlying(c) == ["pressDown", "pressUp", "click"]


@pytest.mark.parametrize("name", ["calibrateScale", "freePour", "guidedPourOver", "freePourHistory"])
def test_screens_without_the_overlay_keep_the_tare(screen, name):
    """scale.spec.ts '<screen> retains tare without opening scale overlay'."""
    screen.wait_for_home()
    screen.c.call({"cmd": "screen", "name": name})
    screen.wait_for_transition()
    time.sleep(0.5)
    if screen.route() != name:
        pytest.skip(f"{name} left by itself for {screen.route()} on this backend")
    ev(screen.c, f"{SCALE_ITEM}.emittedActions = []")
    emit(screen.c, "tareDown")
    time.sleep(1)
    emit(screen.c, "tareUp")
    visibility(screen.c, "closed")
    assert actions(screen.c) == [["action", "tare"]]


def test_the_scale_closes_after_ten_seconds_without_a_weight_change(under_snake):
    """Protects: the small scale hiding itself after 10 s without a weight change over 2 g."""
    c = under_snake.c
    emit(c, "singleTare")
    visibility(c, "small")
    time.sleep(9)
    assert scale(c)["visibility"] == "small"
    visibility(c, "closed", 3)


def test_a_shot_starting_closes_the_scale(under_snake):
    """Protects: the overlay closing when the machine starts extracting (and ignoring the gestures then)."""
    c = under_snake.c
    emit(c, "singleTare")
    visibility(c, "small")
    status = ev_json(c, "Stats.status")
    try:
        ev(c, "Stats.setStats(Object.assign({}, Stats.status, { extracting: true }))")
        visibility(c, "closed")
    finally:
        ev(c, f"Stats.setStats({json.dumps(status)})")


def test_the_overlay_shows_the_weight_padded_to_five_characters(under_snake):
    """Protects: the weight with one decimal, zero-padded to five characters (the padding dimmed), and
    "g"; a scale without a reading shows 000.0 (weight || 0)."""
    c = under_snake.c
    emit(c, "singleTare")
    visibility(c, "small")
    w = ev_json(c, "Stats.sensors.w") or 0
    formatted = f"{w:.1f}"
    assert scale(c)["text"] == formatted.rjust(5, "0") + "g"


# ------------------------------------------------------------------------------------- calibrate scale

def test_calibrate_scale_sets_zero_then_offers_calibration_in_range_only(screen):
    """Protects: the calibrate screen: "set zero" over the tray, a single tare puts the 500 g weight on
    and offers "calibrate", refused outside 470-530 g (the emulated scale reads about 0 g); a double press
    goes home (CalibrateScale.tsx)."""
    screen.wait_for_home()
    go(screen, "calibrateScale")
    assert screen.probe("calibrateState") == "set zero"
    texts = screen.texts()
    assert "CALIBRATE SCALE" in texts and "SET ZERO" in texts, texts
    screen.controls.tare()
    assert screen.probe("calibrateState") == "calibrate"
    assert screen.probe("calibrateAllowed") is False
    screen.wait_for_text("CALIBRATE")
    screen.controls.push()
    time.sleep(0.5)
    assert screen.probe("calibrateState") == "calibrate"
    assert screen.route() == "calibrateScale"
    screen.controls.double_push()
    screen.wait_for_route("profileHome")


@pytest.mark.xfail(reason="the emulated backend's scale reads about 0 g: the 470-530 g calibration press "
                          "(socket 'calibrate', 'done', home after 5 s) needs a loaded scale", strict=False)
def test_calibrate_scale_calibrates_with_the_weight_on(screen):
    screen.wait_for_home()
    go(screen, "calibrateScale")
    screen.controls.tare()
    assert screen.probe("calibrateAllowed") is True
    screen.controls.push()
    assert screen.probe("calibrateState") == "done"
    screen.wait_for_route("profileHome", 8)


# ------------------------------------------------------------------------------------------------ snake

def test_twenty_turns_past_exit_open_snake_and_the_knob_steers_it(screen):
    """Protects: the easter egg: in the quick settings, turning on past "exit" twenty times opens Snake;
    the knob turns the snake and a double press goes home (Snake.tsx)."""
    screen.wait_for_home()
    screen.controls.context()
    screen.wait_for_bubble("quick-settings")
    screen.focus("exit")
    screen.controls.right(20)
    screen.wait_for_route("snake")
    screen.wait_for_bubble_closed()

    body = screen.probe("snake")
    assert len(body) == 3
    # Going down (+y) at first: a clockwise turn heads left (-x).
    head = body[0]
    screen.controls.right()
    time.sleep(0.5)
    moved = screen.probe("snake")[0]
    assert moved[0] < head[0] or moved[0] > head[0] + 5, (head, moved)   # left, or wrapped around
    screen.controls.double_push()
    screen.wait_for_route("profileHome")
