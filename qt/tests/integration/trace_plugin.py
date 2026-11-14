"""pytest -p trace_plugin: what each journey did and read, in the order it happened.

Loaded in both modes (the Qt overlay and the React reference run, MODE=react). For every test it writes
<artifacts>/traces/<test>.json: the steps the journey took ("Go to ...", "Choose ..."), the controls it
operated (turn N, push, context, hold, ...), every change of the focused menu entry it read, and every
route it saw, in call order. The journey reports' timelines are sorted by wall-clock time, which jumps
under WSL (its clock is resynchronised), so compare.py reads these instead. The focused entries also go
on the timeline ("focus" entries).
"""

import json
import os
from pathlib import Path

TRACE: list = []


def _artifacts() -> Path:
    return Path(os.environ.get("ARTIFACTS_DIR", "artifacts"))


def pytest_configure(config):
    import dial_app

    screen, controls = dial_app.Screen, dial_app.Controls
    if getattr(screen, "_traced", False):
        return
    screen._traced = True

    focused, note, route = screen.focused, screen._note, screen.route

    def traced_focused(self):
        value = focused(self)
        if getattr(self, "_traced_focus", object()) != value:
            self._traced_focus = value
            TRACE.append(["focus", value])
            if self.timeline is not None:
                self.timeline.add("focus", str(value))
        return value

    def traced_note(self, text):
        TRACE.append(["step", text])
        return note(self, text)

    def traced_route(self):
        value = route(self)
        if not TRACE or TRACE[-1] != ["route", value]:
            if getattr(self, "_traced_route", object()) != value:
                self._traced_route = value
                TRACE.append(["route", value])
        return value

    screen.focused, screen._note, screen.route = traced_focused, traced_note, traced_route

    # The home's focused card and its cards, on each change (go_to_card and the tests read them).
    for name, kind in (("active_card", "card"), ("carousel", "cards")):
        def make(original, kind):
            def traced(screen_, *args, **kwargs):
                value = original(screen_, *args, **kwargs)
                last = next((v for k, v in reversed(TRACE) if k == kind), object())
                if value != last:
                    TRACE.append([kind, value])
                return value
            return traced
        setattr(dial_app, name, make(getattr(dial_app, name), kind))

    def wrap(name, describe):
        original = getattr(controls, name)

        def traced(self, *args, **kwargs):
            TRACE.append(["control", describe(*args, **kwargs)])
            return original(self, *args, **kwargs)

        setattr(controls, name, traced)

    wrap("turn", lambda detents: f"turn {detents:+d}")
    for name in ("push", "double_push", "long_push", "context", "tare"):
        wrap(name, lambda _n=name: _n)
    wrap("hold", lambda seconds: f"hold {seconds:g}s")


def pytest_runtest_setup(item):
    TRACE.clear()


def pytest_runtest_logfinish(nodeid, location):
    name = nodeid.split("::")[-1]
    directory = _artifacts() / "traces"
    directory.mkdir(parents=True, exist_ok=True)
    (directory / f"{name}.json").write_text(json.dumps(TRACE, indent=0))
