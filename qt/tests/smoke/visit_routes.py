#!/usr/bin/env python3
"""Opens every route of Routes.qml on a running Dial (test port) and reports the QML errors its log shows.

    visit_routes.py PORT LOG

No backend is needed: the point is that every screen's QML loads and builds. Nothing is pressed, so a
screen never sends an action. Exit status 1 if the Dial logged a load error, a missing type or a script
exception while a route was shown, or if a route never showed.
"""
import json
import re
import sys
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "e2e"))
from dialctl import DialClient  # noqa: E402

# What a broken screen prints: failed component loads, unknown types, syntax errors and JS exceptions.
ERROR = re.compile(r"failed to load|is not a type|unavailable|Expected token|Syntax ?error|Cannot assign|"
                   r"ReferenceError|TypeError|is not defined|is not a function|Unable to assign|"
                   r"Type .* unavailable|module .* is not installed|No such file", re.I)


def main():
    port, log = int(sys.argv[1]), Path(sys.argv[2])
    c = DialClient(port)
    routes = json.loads(c.call({"cmd": "eval", "js": "JSON.stringify(Routes.order)"})["value"])
    failures = []
    # Routes that only open with something to show: given a local stand-in first, removed afterwards.
    prepare = {"notifications": ("Notifications.addOne({ id: 'smoke', message: 'Smoke test', responses: ['Ok'] })",
                                 "Notifications.removeOne('smoke')")}
    for name in routes:
        start = log.stat().st_size
        before, after = prepare.get(name, (None, None))
        if before:
            c.call({"cmd": "eval", "js": before})
        c.call({"cmd": "screen", "name": name})
        deadline = time.monotonic() + 5
        state = {}
        while time.monotonic() < deadline:
            state = c.call({"cmd": "state"})
            if state.get("shown") == name and not state.get("transitioning"):
                break
            time.sleep(0.1)
        time.sleep(0.4)
        if after:
            c.call({"cmd": "eval", "js": after})
        with log.open(errors="replace") as f:
            f.seek(start)
            lines = [line.rstrip() for line in f if ERROR.search(line)]
        # Screens that need the machine (heating, barometer, brewComplete, ...) or data leave by themselves
        # when there is none: entering the route is enough, as long as it built without errors.
        entered = state.get("shown") == name or any(entry[1] == name for entry in state.get("history", [])[-6:])
        if not entered:
            failures.append(f"{name}: never entered (shows {state.get('shown')!r})")
        failures += [f"{name}: {line}" for line in lines]
        note = "" if state.get("shown") == name else " (left by itself)"
        print(f"{'ok ' if entered and not lines else 'BAD'} {name}{note}")
    c.call({"cmd": "screen", "name": "profileHome"})
    c.close()
    print(f"{len(routes)} routes, {len(failures)} problems")
    for failure in failures:
        print("  " + failure)
    sys.exit(1 if failures else 0)


if __name__ == "__main__":
    main()
